'use strict';

const crypto = require('crypto');
const ArcadeConfig = require('./arcade-config');
const FarmConfig = require('./farm-config');

const GLOBAL_VERSION = 3;
const GLOBAL_CLIENT_SEED = 'aviator-global-v3';
const RESULTS_MS = 2500;
const HISTORY_LIMIT = 12;
const MAX_GLOBAL_BETS = 100;
const MAX_ATTEMPTS = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class AviatorError extends Error {
  constructor(status, message, code = 'AVIATOR_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function iso(timestamp) { return new Date(timestamp).toISOString(); }
function validWallet(value) { return typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value); }
function validId(value) { return UUID_PATTERN.test(String(value || '')); }
function safeInteger(value, fallback = 0, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : fallback;
}
function maskWallet(wallet) { return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`; }
function requireStarted(state) {
  if (!state.land?.owned || !state.animals.length) {
    throw new AviatorError(409, 'Achetez un terrain et un animal pour démarrer la ferme.', 'FARM_NOT_STARTED');
  }
}
function incrementStat(game, key, amount) {
  game[key] += amount;
  if (!Number.isSafeInteger(game[key]) || game[key] < 0) {
    throw new AviatorError(409, 'Limite de statistiques atteinte.', 'FARM_LIMIT');
  }
}
function addCoins(state, amount) {
  if (state.coins + amount > FarmConfig.MAX_COINS) throw new AviatorError(409, 'Limite de coins atteinte.', 'FARM_LIMIT');
  state.coins += amount;
}

function normalizeBet(raw) {
  if (!raw || typeof raw !== 'object' || !validWallet(raw.wallet) || !validId(raw.actionId)) return null;
  const wallet = raw.wallet.toLowerCase();
  const slot = ArcadeConfig.normalizeAviatorSlot(raw.slot);
  const stake = ArcadeConfig.normalizeAviatorStake(raw.stake);
  const autoTargetBps = raw.autoTargetBps === null || raw.autoTargetBps === undefined ? null : ArcadeConfig.normalizeAviatorTarget(raw.autoTargetBps);
  const placedAt = typeof raw.placedAt === 'string' ? raw.placedAt : '';
  const status = String(raw.status || '');
  if (!slot || !stake || (raw.autoTargetBps !== null && raw.autoTargetBps !== undefined && !autoTargetBps)
    || !Number.isFinite(Date.parse(placedAt)) || !['active', 'cashed', 'lost'].includes(status)) return null;
  const cashoutBps = status === 'cashed' ? raw.cashoutBps : null;
  if (status === 'cashed' && (!Number.isSafeInteger(cashoutBps) || cashoutBps < 100 || cashoutBps > ArcadeConfig.CRASH_MAX_BPS)) return null;
  const coins = status === 'cashed' ? ArcadeConfig.aviatorPayout(stake, cashoutBps) : 0;
  if (safeInteger(raw.coins, -1) !== coins) return null;
  const cashoutKind = status === 'cashed' ? String(raw.cashoutKind || '') : null;
  if (status === 'cashed' && !['auto', 'manual'].includes(cashoutKind)) return null;
  const settledAt = status === 'active' ? null : raw.settledAt;
  if (status !== 'active' && (!settledAt || !Number.isFinite(Date.parse(settledAt)) || !validId(raw.settlementActionId))) return null;
  return {
    wallet, actionId: String(raw.actionId).toLowerCase(), slot, stake, autoTargetBps,
    status, cashoutBps, cashoutKind, coins, placedAt: new Date(placedAt).toISOString(),
    settledAt: settledAt ? new Date(settledAt).toISOString() : null,
    settlementActionId: status === 'active' ? null : String(raw.settlementActionId).toLowerCase(),
    placementType: ['crash_start', 'crash_bet'].includes(raw.placementType) ? raw.placementType : 'crash_bet'
  };
}

function normalizeRound(raw) {
  if (!raw || typeof raw !== 'object' || !validId(raw.id) || !Array.isArray(raw.bets) || raw.bets.length > MAX_GLOBAL_BETS) return null;
  const id = String(raw.id).toLowerCase();
  const status = String(raw.status || '');
  if (!['betting', 'flying', 'crashed'].includes(status)) return null;
  const bets = raw.bets.map(normalizeBet);
  if (bets.some((bet) => !bet)) return null;
  const keys = bets.map((bet) => `${bet.wallet}:${bet.slot}`);
  if (new Set(keys).size !== keys.length || new Set(bets.map((bet) => bet.actionId)).size !== bets.length) return null;
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : '';
  const startsAt = typeof raw.startsAt === 'string' ? raw.startsAt : '';
  const crashAt = typeof raw.crashAt === 'string' ? raw.crashAt : '';
  if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(crashAt))
    || Date.parse(startsAt) !== Date.parse(createdAt) + ArcadeConfig.CRASH_AVIATOR_BETTING_MS
    || Date.parse(crashAt) !== Date.parse(startsAt) + ArcadeConfig.crashTimeForMultiplier(raw.crashBps)) return null;
  if (!Number.isSafeInteger(raw.crashBps) || raw.crashBps < 100 || raw.crashBps > ArcadeConfig.CRASH_MAX_BPS
    || !Number.isSafeInteger(raw.randomValue) || raw.randomValue < 0 || raw.randomValue >= ArcadeConfig.CRASH_RANDOM_RANGE
    || ArcadeConfig.selectCrashPoint(raw.randomValue) !== raw.crashBps
    || !/^[0-9a-f]{64}$/i.test(String(raw.seedHash || '')) || !/^[0-9a-f]{64}$/i.test(String(raw.serverSeed || ''))
    || raw.clientSeed !== GLOBAL_CLIENT_SEED
    || crypto.createHash('sha256').update(String(raw.serverSeed).toLowerCase()).digest('hex') !== String(raw.seedHash).toLowerCase()
    || randomValue(String(raw.serverSeed).toLowerCase(), id) !== raw.randomValue) return null;
  if (status !== 'crashed' && bets.some((bet) => bet.status === 'lost')) return null;
  if (status === 'crashed' && bets.some((bet) => bet.status === 'active')) return null;
  for (const bet of bets) {
    const placedMs = Date.parse(bet.placedAt);
    if (placedMs < Date.parse(createdAt) || placedMs >= Date.parse(startsAt)) return null;
    if (bet.status === 'active') continue;
    const settledMs = Date.parse(bet.settledAt);
    if (bet.status === 'lost') {
      if (status !== 'crashed' || settledMs !== Date.parse(crashAt)) return null;
      continue;
    }
    if (settledMs < Date.parse(startsAt) || settledMs > Date.parse(crashAt) || bet.cashoutBps > raw.crashBps
      || (bet.cashoutKind === 'manual' && settledMs >= Date.parse(crashAt))) return null;
    if (bet.cashoutKind === 'auto' && (bet.autoTargetBps !== bet.cashoutBps
      || settledMs !== Date.parse(startsAt) + ArcadeConfig.crashTimeForMultiplier(bet.cashoutBps))) return null;
  }
  const completedAt = status === 'crashed' ? raw.completedAt : null;
  if (status === 'crashed' && completedAt !== crashAt) return null;
  const stake = bets.reduce((sum, bet) => sum + bet.stake, 0);
  const coins = bets.reduce((sum, bet) => sum + bet.coins, 0);
  if (safeInteger(raw.stake, -1) !== stake || safeInteger(raw.coins, -1) !== coins) return null;
  return {
    version: GLOBAL_VERSION, id, status, bets, stake, coins,
    crashBps: raw.crashBps, randomValue: raw.randomValue,
    seedHash: String(raw.seedHash).toLowerCase(), serverSeed: String(raw.serverSeed).toLowerCase(), clientSeed: GLOBAL_CLIENT_SEED,
    createdAt: new Date(createdAt).toISOString(), startsAt: new Date(startsAt).toISOString(), crashAt: new Date(crashAt).toISOString(),
    completedAt, lastAction: raw.lastAction && typeof raw.lastAction === 'object' ? clone(raw.lastAction) : null
  };
}

function normalizeGlobal(raw) {
  if (raw === null || raw === undefined) return { version: GLOBAL_VERSION, active: null, history: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== GLOBAL_VERSION || !Array.isArray(raw.history) || raw.history.length > HISTORY_LIMIT) {
    throw new AviatorError(503, 'Le registre Aviator est illisible.', 'AVIATOR_STORAGE');
  }
  const active = raw.active === null ? null : normalizeRound(raw.active);
  if (raw.active !== null && !active) throw new AviatorError(503, 'La manche Aviator est illisible.', 'AVIATOR_STORAGE');
  const history = raw.history.map((round) => {
    const normalized = normalizeRound(round);
    if (!normalized || normalized.status !== 'crashed') throw new AviatorError(503, 'L’historique Aviator est illisible.', 'AVIATOR_STORAGE');
    return normalized;
  });
  return { version: GLOBAL_VERSION, active, history };
}

function randomValue(serverSeed, roundId) {
  const digest = crypto.createHmac('sha256', Buffer.from(serverSeed, 'hex')).update(`${GLOBAL_CLIENT_SEED}:${roundId}`).digest();
  return Math.floor(digest.readUInt32BE(0) * ArcadeConfig.CRASH_RANDOM_RANGE / 0x100000000);
}

function publicBet(bet, wallet, live = false) {
  const mine = bet.wallet === wallet;
  const result = {
    slot: bet.slot, stake: bet.stake, status: bet.status,
    cashoutBps: bet.cashoutBps, cashoutKind: bet.cashoutKind, coins: bet.coins,
    placedAt: bet.placedAt, settledAt: bet.settledAt
  };
  if (live) {
    result.id = crypto.createHash('sha256').update(bet.actionId).digest('hex').slice(0, 16);
    result.wallet = maskWallet(bet.wallet);
    result.mine = mine;
  }
  if (mine) {
    result.actionId = bet.actionId;
    result.autoTargetBps = bet.autoTargetBps;
    result.settlementActionId = bet.settlementActionId;
  }
  return result;
}

function revealProof(round, output) {
  if (round.status !== 'crashed') return output;
  output.crashBps = round.crashBps;
  output.randomValue = round.randomValue;
  output.serverSeed = round.serverSeed;
  output.crashAt = round.crashAt;
  output.completedAt = round.completedAt;
  return output;
}

function publicOwnRound(round, wallet) {
  if (!round) return null;
  const bets = round.bets.filter((bet) => bet.wallet === wallet).map((bet) => publicBet(bet, wallet));
  const output = {
    version: 2, id: round.id, status: round.status, bets,
    stake: bets.reduce((sum, bet) => sum + bet.stake, 0), coins: bets.reduce((sum, bet) => sum + bet.coins, 0),
    clientSeed: round.clientSeed, seedHash: round.seedHash, createdAt: round.createdAt, startsAt: round.startsAt,
    completedAt: round.status === 'crashed' ? round.completedAt : null, lastAction: null
  };
  return revealProof(round, output);
}

function publicLiveRound(round, wallet) {
  if (!round) return null;
  const bets = round.bets.map((bet) => publicBet(bet, wallet, true));
  const output = {
    version: GLOBAL_VERSION, id: round.id, status: round.status, bets,
    stake: round.stake, coins: round.coins, playerCount: new Set(round.bets.map((bet) => bet.wallet)).size,
    clientSeed: round.clientSeed, seedHash: round.seedHash, createdAt: round.createdAt, startsAt: round.startsAt,
    completedAt: round.status === 'crashed' ? round.completedAt : null
  };
  return revealProof(round, output);
}

function publicHistoryRound(round) {
  return revealProof(round, {
    version: GLOBAL_VERSION, id: round.id, status: 'crashed', stake: round.stake, coins: round.coins,
    playerCount: new Set(round.bets.map((bet) => bet.wallet)).size, betCount: round.bets.length,
    clientSeed: round.clientSeed, seedHash: round.seedHash, createdAt: round.createdAt, startsAt: round.startsAt,
    completedAt: round.completedAt
  });
}

function betEvent(bet) {
  return {
    slot: bet.slot, kind: bet.status === 'lost' ? 'lost' : bet.cashoutKind,
    cashoutBps: bet.cashoutBps, coins: bet.coins
  };
}

function createAviatorService(options = {}) {
  if (!options.repository || typeof options.normalizeAccount !== 'function') throw new Error('Le stockage Aviator est requis.');
  const repository = options.repository;
  const normalizeAccount = options.normalizeAccount;
  const now = options.now || (() => new Date());
  const randomBytes = options.randomBytes || ((size) => crypto.randomBytes(size));
  const randomUuid = options.randomUuid || (() => crypto.randomUUID());

  function newRound(timestamp) {
    const id = String(randomUuid()).toLowerCase();
    if (!validId(id)) throw new AviatorError(500, 'La manche Aviator ne peut pas être créée.', 'CRASH_RANDOM');
    const serverSeed = Buffer.from(randomBytes(32, { roundId: id, clientSeed: GLOBAL_CLIENT_SEED, scope: 'multiplayer' })).toString('hex');
    if (!/^[0-9a-f]{64}$/.test(serverSeed)) throw new AviatorError(500, 'Le tirage Aviator est indisponible.', 'CRASH_RANDOM');
    const value = randomValue(serverSeed, id);
    const crashBps = ArcadeConfig.selectCrashPoint(value);
    const startsMs = timestamp + ArcadeConfig.CRASH_AVIATOR_BETTING_MS;
    const crashMs = startsMs + ArcadeConfig.crashTimeForMultiplier(crashBps);
    return {
      version: GLOBAL_VERSION, id, status: 'betting', bets: [], stake: 0, coins: 0,
      crashBps, randomValue: value, seedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
      serverSeed, clientSeed: GLOBAL_CLIENT_SEED, createdAt: iso(timestamp), startsAt: iso(startsMs), crashAt: iso(crashMs),
      completedAt: null, lastAction: null
    };
  }

  function advance(state, timestamp, settlementActionId) {
    const credits = [];
    const events = [];
    let changed = false;
    if (!state.active) {
      state.active = newRound(timestamp);
      return { changed: true, credits, events };
    }
    const round = state.active;
    const startsMs = Date.parse(round.startsAt);
    const crashMs = Date.parse(round.crashAt);
    if (round.status !== 'crashed') {
      if (round.status === 'betting' && timestamp >= startsMs) { round.status = 'flying'; changed = true; }
      if (timestamp >= startsMs) {
        const automatic = round.bets.filter((bet) => bet.status === 'active' && bet.autoTargetBps && bet.autoTargetBps <= round.crashBps)
          .map((bet) => ({ bet, at: startsMs + ArcadeConfig.crashTimeForMultiplier(bet.autoTargetBps) }))
          .filter((entry) => entry.at <= timestamp)
          .sort((a, b) => a.at - b.at || a.bet.placedAt.localeCompare(b.bet.placedAt));
        for (const entry of automatic) {
          const bet = entry.bet;
          const coins = ArcadeConfig.aviatorPayout(bet.stake, bet.autoTargetBps);
          bet.status = 'cashed'; bet.cashoutBps = bet.autoTargetBps; bet.cashoutKind = 'auto'; bet.coins = coins;
          bet.settledAt = iso(entry.at); bet.settlementActionId = settlementActionId;
          round.coins += coins;
          events.push({ ...betEvent(bet), wallet: bet.wallet });
          credits.push({ wallet: bet.wallet, coins });
          changed = true;
        }
      }
      if (timestamp >= crashMs) {
        for (const bet of round.bets) {
          if (bet.status !== 'active') continue;
          bet.status = 'lost'; bet.cashoutBps = null; bet.cashoutKind = null; bet.coins = 0;
          bet.settledAt = round.crashAt; bet.settlementActionId = settlementActionId;
          events.push({ ...betEvent(bet), wallet: bet.wallet });
        }
        round.status = 'crashed'; round.completedAt = round.crashAt;
        changed = true;
      }
      if (changed) {
        round.lastAction = {
          id: settlementActionId, type: 'crash_sync', roundId: round.id, events: events.map((event) => {
            const copy = { ...event }; delete copy.wallet; return copy;
          }), crash: round.status === 'crashed', createdAt: iso(timestamp)
        };
      }
    }
    if (round.status === 'crashed' && timestamp >= crashMs + RESULTS_MS) {
      state.history.unshift(round);
      state.history = state.history.slice(0, HISTORY_LIMIT);
      state.active = newRound(timestamp);
      changed = true;
    }
    return { changed, credits, events };
  }

  async function loadGlobal() {
    const record = await repository.getAviator();
    return { state: normalizeGlobal(record?.state), revision: record?.revision || 0 };
  }

  async function mutate({ wallet = null, actionId = null, type = 'crash_sync', params = {} } = {}) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const timestamp = now().getTime();
      const current = await loadGlobal();
      const draft = clone(current.state);
      const settlementActionId = actionId || String(randomUuid()).toLowerCase();
      if (!validId(settlementActionId)) throw new AviatorError(500, 'L’action Aviator est invalide.', 'AVIATOR_ACTION');
      const advanced = advance(draft, timestamp, settlementActionId);
      const accounts = new Map();
      async function loadAccount(address) {
        if (!accounts.has(address)) {
          const record = await repository.get(address);
          accounts.set(address, {
            wallet: address, expectedRevision: record?.revision || 0,
            state: normalizeAccount(record?.state, address)
          });
        }
        return accounts.get(address);
      }
      for (const credit of advanced.credits) {
        const account = await loadAccount(credit.wallet);
        addCoins(account.state, credit.coins);
        incrementStat(account.state.crash, 'totalWonCoins', credit.coins);
        account.state.updatedAt = timestamp;
      }
      let changed = advanced.changed;
      if (type === 'crash_start' || type === 'crash_bet') {
        const account = await loadAccount(wallet);
        requireStarted(account.state);
        const slot = ArcadeConfig.normalizeAviatorSlot(params.slot);
        const stake = ArcadeConfig.normalizeAviatorStake(params.stake);
        const autoTargetBps = params.autoTargetBps === null || params.autoTargetBps === undefined ? null : ArcadeConfig.normalizeAviatorTarget(params.autoTargetBps);
        if (!slot) throw new AviatorError(400, 'Emplacement de mise Aviator invalide.', 'CRASH_SLOT');
        if (!stake) throw new AviatorError(400, 'Mise Aviator invalide.', 'CRASH_STAKE');
        if (params.autoTargetBps !== null && params.autoTargetBps !== undefined && !autoTargetBps) {
          throw new AviatorError(400, 'Auto cashout Aviator invalide.', 'CRASH_TARGET');
        }
        const round = draft.active;
        if (!round || round.status !== 'betting' || timestamp >= Date.parse(round.startsAt)) {
          throw new AviatorError(409, 'Les mises de ce vol sont closes.', 'CRASH_BETTING_CLOSED');
        }
        if (params.roundId !== undefined && String(params.roundId || '').toLowerCase() !== round.id) {
          throw new AviatorError(409, 'Le vol Aviator est introuvable.', 'CRASH_ROUND');
        }
        if (round.bets.some((bet) => bet.wallet === wallet && bet.slot === slot)) {
          throw new AviatorError(409, 'Cette mise est déjà placée.', 'CRASH_BET_ACTIVE');
        }
        if (round.bets.length >= MAX_GLOBAL_BETS) throw new AviatorError(409, 'Ce vol est complet. Attendez le suivant.', 'CRASH_ROUND_FULL');
        if (account.state.coins < stake) throw new AviatorError(409, 'Coins insuffisants pour cette mise.', 'FARM_INSUFFICIENT_COINS');
        const firstBet = !round.bets.some((bet) => bet.wallet === wallet);
        account.state.coins -= stake;
        incrementStat(account.state.crash, 'totalStaked', stake);
        if (firstBet) incrementStat(account.state.crash, 'totalRounds', 1);
        account.state.updatedAt = timestamp;
        const bet = {
          wallet, actionId, slot, stake, autoTargetBps, status: 'active', cashoutBps: null, cashoutKind: null,
          coins: 0, placedAt: iso(timestamp), settledAt: null, settlementActionId: null, placementType: type
        };
        round.bets.push(bet); round.stake += stake;
        round.lastAction = { id: actionId, type, roundId: round.id, events: [], crash: false, createdAt: iso(timestamp) };
        changed = true;
      } else if (type === 'crash_cashout') {
        const account = await loadAccount(wallet);
        requireStarted(account.state);
        const slot = ArcadeConfig.normalizeAviatorSlot(params.slot);
        if (!slot) throw new AviatorError(400, 'Emplacement de mise Aviator invalide.', 'CRASH_SLOT');
        const round = draft.active;
        if (!round || String(params.roundId || '').toLowerCase() !== round.id || round.status !== 'flying' || timestamp >= Date.parse(round.crashAt)) {
          throw new AviatorError(409, 'Ce cashout arrive trop tard pour ce vol.', 'CRASH_CASHOUT_LATE');
        }
        const bet = round.bets.find((item) => item.wallet === wallet && item.slot === slot);
        if (!bet || bet.status !== 'active') throw new AviatorError(409, 'Cette mise est déjà encaissée ou clôturée.', 'CRASH_CASHOUT_SETTLED');
        const cashoutBps = ArcadeConfig.crashMultiplierAt(timestamp - Date.parse(round.startsAt));
        if (cashoutBps <= 100) throw new AviatorError(409, 'Le multiplicateur doit dépasser 1,00×.', 'CRASH_CASHOUT_EARLY');
        const coins = ArcadeConfig.aviatorPayout(bet.stake, cashoutBps);
        addCoins(account.state, coins);
        incrementStat(account.state.crash, 'totalWonCoins', coins);
        account.state.updatedAt = timestamp;
        bet.status = 'cashed'; bet.cashoutBps = cashoutBps; bet.cashoutKind = 'manual'; bet.coins = coins;
        bet.settledAt = iso(timestamp); bet.settlementActionId = actionId;
        round.coins += coins;
        const event = betEvent(bet);
        round.lastAction = {
          id: actionId, type, roundId: round.id,
          events: [...advanced.events.map((item) => { const copy = { ...item }; delete copy.wallet; return copy; }), event],
          crash: false, createdAt: iso(timestamp)
        };
        changed = true;
      }
      if (!changed) return { changed: false };
      const action = actionId ? { id: actionId, wallet, type } : null;
      try {
        await repository.applyAviator(current.revision, draft, Array.from(accounts.values()), action);
        return { changed: true };
      } catch (error) {
        if (error?.status === 409 && attempt + 1 < MAX_ATTEMPTS) continue;
        throw error;
      }
    }
    throw new AviatorError(409, 'La salle Aviator est très active. Réessayez.', 'AVIATOR_CONFLICT');
  }

  async function view(wallet) {
    const current = await loadGlobal();
    const rounds = current.state.active ? [current.state.active, ...current.state.history] : current.state.history;
    const ownHistory = rounds.filter((round) => round.status === 'crashed' && round.bets.some((bet) => bet.wallet === wallet))
      .map((round) => publicOwnRound(round, wallet));
    return {
      version: GLOBAL_VERSION,
      round: publicLiveRound(current.state.active, wallet),
      history: current.state.history.map(publicHistoryRound),
      ownRound: publicOwnRound(current.state.active, wallet),
      ownHistory
    };
  }

  function findAction(wallet, actionId) {
    const id = String(actionId || '').toLowerCase();
    if (!validId(id)) return null;
    return loadGlobal().then((current) => {
      const rounds = current.state.active ? [current.state.active, ...current.state.history] : current.state.history;
      for (const round of rounds) {
        const placed = round.bets.find((bet) => bet.wallet === wallet && bet.actionId === id);
        if (placed) return { id, type: placed.placementType, roundId: round.id, events: [], crash: false, createdAt: placed.placedAt };
        const settled = round.bets.filter((bet) => bet.wallet === wallet && bet.settlementActionId === id);
        if (settled.length) {
          return {
            id, type: settled.some((bet) => bet.cashoutKind === 'manual') ? 'crash_cashout' : 'crash_sync', roundId: round.id,
            events: settled.map(betEvent), crash: round.status === 'crashed' && settled.some((bet) => bet.status === 'lost'),
            createdAt: settled[0].settledAt
          };
        }
      }
      return null;
    });
  }

  return Object.freeze({
    advance: () => mutate(),
    action: mutate,
    view,
    findAction
  });
}

module.exports = {
  AviatorError, createAviatorService, normalizeGlobal, randomValue,
  GLOBAL_VERSION, GLOBAL_CLIENT_SEED, RESULTS_MS, HISTORY_LIMIT, MAX_GLOBAL_BETS
};
