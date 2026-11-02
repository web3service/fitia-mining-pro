'use strict';

const Config = require('./arcade-config');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_STAT = Number.MAX_SAFE_INTEGER;

function safeInteger(value, fallback = 0, maximum = MAX_STAT) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : fallback;
}
function isoTime(value) {
  const time = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(time) && time >= 0 && time < 8640000000000000 ? new Date(time).toISOString() : null;
}
function validId(value) { return UUID_PATTERN.test(String(value || '')); }
function normalizeIndexes(value, expectedLength) {
  if (!Array.isArray(value) || (expectedLength !== undefined && value.length !== expectedLength)) return null;
  const indexes = value.map((index) => Config.normalizeTileIndex(index));
  if (indexes.some((index) => index === null) || new Set(indexes).size !== indexes.length) return null;
  return indexes.sort((a, b) => a - b);
}
function stats(raw, historyKey) {
  return {
    totalRounds: safeInteger(raw?.totalRounds),
    totalStaked: safeInteger(raw?.totalStaked),
    totalWonCoins: safeInteger(raw?.totalWonCoins),
    [historyKey]: []
  };
}
function normalizeLastAction(raw, round) {
  if (!raw || typeof raw !== 'object' || !validId(raw.id) || !['mines_reveal', 'mines_cashout'].includes(raw.type)) return null;
  if (String(raw.roundId || '').toLowerCase() !== round.id) return null;
  const createdAt = isoTime(raw.createdAt); if (!createdAt) return null;
  const index = raw.type === 'mines_reveal' ? Config.normalizeTileIndex(raw.index) : null;
  if (raw.type === 'mines_reveal' && index === null) return null;
  const status = ['active', 'lost', 'cashed'].includes(raw.status) ? raw.status : round.status;
  if (status !== round.status) return null;
  const safe = raw.type === 'mines_cashout' ? true : raw.safe === true;
  const coins = raw.type === 'mines_cashout' ? round.coins : 0;
  const payout = raw.type === 'mines_cashout' ? round.coins : Config.minesPayout(round.stake, round.mineCount, round.revealed.length);
  if (raw.safe !== undefined && raw.safe !== safe) return null;
  if (safeInteger(raw.coins, -1) !== coins || safeInteger(raw.payout, -1) !== payout) return null;
  return { id: String(raw.id).toLowerCase(), type: raw.type, roundId: round.id, index, safe, status, coins, payout, createdAt };
}
function normalizeMinesRound(raw) {
  if (!raw || typeof raw !== 'object' || !validId(raw.id)) return null;
  const id = String(raw.id).toLowerCase();
  const stake = Config.normalizeStake(raw.stake); const mineCount = Config.normalizeMineCount(raw.mineCount);
  const minePositions = normalizeIndexes(raw.minePositions, mineCount || undefined);
  const revealed = normalizeIndexes(raw.revealed || []);
  const startedAt = isoTime(raw.startedAt);
  if (!stake || !mineCount || !minePositions || !revealed || !startedAt) return null;
  if (revealed.length > Config.MINES_TILES - mineCount || revealed.some((index) => minePositions.includes(index))) return null;
  const status = String(raw.status || '');
  if (!['active', 'lost', 'cashed'].includes(status)) return null;
  if (status === 'active' && raw.coins !== undefined && safeInteger(raw.coins, -1) !== 0) return null;
  const hitMine = status === 'lost' ? Config.normalizeTileIndex(raw.hitMine) : null;
  if (status === 'lost' && (hitMine === null || !minePositions.includes(hitMine))) return null;
  if (status !== 'lost' && raw.hitMine !== undefined && raw.hitMine !== null) return null;
  const expectedCoins = status === 'cashed' ? Config.minesPayout(stake, mineCount, revealed.length) : 0;
  if (status !== 'active' && safeInteger(raw.coins, -1) !== expectedCoins) return null;
  if (status === 'cashed' && revealed.length < 1) return null;
  const completedAt = status === 'active' ? null : isoTime(raw.completedAt);
  if (status !== 'active' && !completedAt) return null;
  const payout = status === 'active' ? Config.minesPayout(stake, mineCount, revealed.length) : expectedCoins;
  const round = {
    id, stake, mineCount, minePositions, revealed, status, hitMine,
    coins: expectedCoins, payout, startedAt, completedAt, lastAction: null
  };
  round.lastAction = raw.lastAction ? normalizeLastAction(raw.lastAction, round) : null;
  if (raw.lastAction && !round.lastAction) return null;
  return round;
}
function normalizeMines(raw) {
  const mines = { version: Config.VERSION, active: null, ...stats(raw, 'recentRounds') };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return mines;
  if (raw.active) mines.active = normalizeMinesRound(raw.active);
  if (mines.active && mines.active.status !== 'active') mines.active = null;
  if (Array.isArray(raw.recentRounds)) {
    mines.recentRounds = raw.recentRounds.slice(0, Config.HISTORY_LIMIT).map(normalizeMinesRound)
      .filter((round) => round && round.status !== 'active');
  }
  return mines;
}
function normalizeAviatorAction(raw, roundId) {
  if (!raw || typeof raw !== 'object' || !validId(raw.id) || String(raw.roundId || '').toLowerCase() !== roundId) return null;
  if (!['crash_start', 'crash_bet', 'crash_cashout', 'crash_sync'].includes(raw.type)) return null;
  const createdAt = isoTime(raw.createdAt); if (!createdAt || !Array.isArray(raw.events) || raw.events.length > Config.CRASH_AVIATOR_MAX_BETS + 1) return null;
  const events = raw.events.map((event) => {
    const slot = Config.normalizeAviatorSlot(event?.slot);
    if (!slot || !['auto', 'manual', 'lost'].includes(event.kind)) return null;
    const lost = event.kind === 'lost';
    const cashoutBps = lost ? null : event.cashoutBps;
    if (!lost && (!Number.isSafeInteger(cashoutBps) || cashoutBps < 100 || cashoutBps > Config.CRASH_MAX_BPS)) return null;
    const coins = safeInteger(event.coins, -1, Config.MAX_COINS || 1000000000);
    if (coins < 0 || (lost && coins !== 0)) return null;
    return { slot, kind: event.kind, cashoutBps, coins };
  }).filter(Boolean);
  if (events.length !== raw.events.length || new Set(events.map((event) => event.slot)).size !== events.length) return null;
  return { id: String(raw.id).toLowerCase(), type: raw.type, roundId, events, crash: raw.crash === true, createdAt };
}
function normalizeAviatorBet(raw) {
  if (!raw || typeof raw !== 'object' || !validId(raw.actionId)) return null;
  const slot = Config.normalizeAviatorSlot(raw.slot); const stake = Config.normalizeAviatorStake(raw.stake);
  const autoTargetBps = raw.autoTargetBps === null || raw.autoTargetBps === undefined ? null : Config.normalizeAviatorTarget(raw.autoTargetBps);
  const placedAt = isoTime(raw.placedAt); const status = String(raw.status || '');
  if (!slot || !stake || (raw.autoTargetBps !== null && raw.autoTargetBps !== undefined && !autoTargetBps) || !placedAt || !['active', 'cashed', 'lost'].includes(status)) return null;
  const cashoutBps = status === 'cashed' ? raw.cashoutBps : null;
  if (status === 'cashed' && (!Number.isSafeInteger(cashoutBps) || cashoutBps < 100 || cashoutBps > Config.CRASH_MAX_BPS)) return null;
  const coins = status === 'cashed' ? Config.aviatorPayout(stake, cashoutBps) : 0;
  if (safeInteger(raw.coins, -1) !== coins) return null;
  const cashoutKind = status === 'cashed' ? String(raw.cashoutKind || '') : null;
  if (status === 'cashed' && !['auto', 'manual'].includes(cashoutKind)) return null;
  const settledAt = status === 'active' ? null : isoTime(raw.settledAt);
  if (status !== 'active' && (!settledAt || !validId(raw.settlementActionId))) return null;
  const settlementActionId = status === 'active' ? null : String(raw.settlementActionId).toLowerCase();
  return { slot, actionId: String(raw.actionId).toLowerCase(), stake, autoTargetBps, status, cashoutBps, cashoutKind, coins, placedAt, settledAt, settlementActionId };
}
function normalizeAviatorRound(raw) {
  if (!raw || typeof raw !== 'object' || !validId(raw.id) || !Array.isArray(raw.bets)) return null;
  const id = String(raw.id).toLowerCase(); const status = String(raw.status || '');
  if (!['betting', 'flying', 'crashed'].includes(status) || raw.bets.length < 1 || raw.bets.length > Config.CRASH_AVIATOR_MAX_BETS) return null;
  const bets = raw.bets.map(normalizeAviatorBet).filter(Boolean);
  if (bets.length !== raw.bets.length || new Set(bets.map((bet) => bet.slot)).size !== bets.length) return null;
  bets.sort((a, b) => a.slot - b.slot);
  const createdAt = isoTime(raw.createdAt); const startsAt = isoTime(raw.startsAt); const crashAt = isoTime(raw.crashAt);
  if (!createdAt || !startsAt || !crashAt || Date.parse(startsAt) !== Date.parse(createdAt) + Config.CRASH_AVIATOR_BETTING_MS) return null;
  if (!Number.isSafeInteger(raw.crashBps) || raw.crashBps < 100 || raw.crashBps > Config.CRASH_MAX_BPS) return null;
  if (Date.parse(crashAt) !== Date.parse(startsAt) + Config.crashTimeForMultiplier(raw.crashBps)) return null;
  if (!Number.isSafeInteger(raw.randomValue) || raw.randomValue < 0 || raw.randomValue >= Config.CRASH_RANDOM_RANGE || Config.selectCrashPoint(raw.randomValue) !== raw.crashBps) return null;
  if (!/^[0-9a-f]{64}$/i.test(String(raw.seedHash || '')) || !/^[0-9a-f]{64}$/i.test(String(raw.serverSeed || ''))) return null;
  const clientSeed = String(raw.clientSeed || ''); if (!/^[A-Za-z0-9-]{8,64}$/.test(clientSeed)) return null;
  if (status !== 'crashed' && bets.some((bet) => bet.status === 'lost')) return null;
  if (status === 'crashed' && bets.some((bet) => bet.status === 'active')) return null;
  const completedAt = status === 'crashed' ? isoTime(raw.completedAt) : null;
  if (status === 'crashed' && completedAt !== crashAt) return null;
  const stake = bets.reduce((sum, bet) => sum + bet.stake, 0); const coins = bets.reduce((sum, bet) => sum + bet.coins, 0);
  if (safeInteger(raw.stake, -1) !== stake || safeInteger(raw.coins, -1) !== coins) return null;
  const round = {
    version: 2, id, status, bets, stake, coins, crashBps: raw.crashBps, randomValue: raw.randomValue,
    seedHash: String(raw.seedHash).toLowerCase(), serverSeed: String(raw.serverSeed).toLowerCase(), clientSeed,
    createdAt, startsAt, crashAt, completedAt, lastAction: null
  };
  for (const bet of bets) {
    if (bet.status === 'cashed') {
      const settledMs = Date.parse(bet.settledAt);
      if (settledMs < Date.parse(startsAt) || settledMs > Date.parse(crashAt)) return null;
      if (bet.cashoutKind === 'auto' && (bet.autoTargetBps !== bet.cashoutBps || settledMs !== Date.parse(startsAt) + Config.crashTimeForMultiplier(bet.cashoutBps))) return null;
    } else if (bet.status === 'lost' && Date.parse(bet.settledAt) !== Date.parse(crashAt)) return null;
  }
  round.lastAction = raw.lastAction ? normalizeAviatorAction(raw.lastAction, id) : null;
  if (raw.lastAction && !round.lastAction) return null;
  if (round.lastAction) {
    for (const event of round.lastAction.events) {
      const bet = bets.find((item) => item.slot === event.slot);
      if (!bet || bet.settlementActionId !== round.lastAction.id || (event.kind === 'lost' ? bet.status !== 'lost' : bet.status !== 'cashed' || bet.cashoutKind !== event.kind || bet.cashoutBps !== event.cashoutBps || bet.coins !== event.coins)) return null;
    }
  }
  return round;
}
function normalizeLegacyCrashRound(entry) {
  if (!entry || !validId(entry.id)) return null;
  const stake = Config.normalizeStake(entry.stake); const targetBps = Config.normalizeCrashTarget(entry.targetBps);
  const createdAt = isoTime(entry.createdAt);
  if (!stake || !targetBps || !Number.isSafeInteger(entry.crashBps) || entry.crashBps < 100 || entry.crashBps > Config.CRASH_MAX_BPS || !createdAt) return null;
  const expected = Config.crashReward(stake, targetBps, entry.crashBps);
  if (entry.won !== expected.won || safeInteger(entry.coins, -1) !== expected.coins || safeInteger(entry.payout, -1) !== expected.payout) return null;
  return { id: String(entry.id).toLowerCase(), stake, targetBps, crashBps: entry.crashBps, won: expected.won, coins: expected.coins, payout: expected.payout, createdAt };
}
function normalizeCrash(raw) {
  const crash = { version: Config.VERSION, active: null, ...stats(raw, 'recentRounds') };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return crash;
  if (raw.active) crash.active = normalizeAviatorRound(raw.active);
  if (crash.active?.status === 'crashed') crash.active = null;
  if (Array.isArray(raw.recentRounds)) {
    crash.recentRounds = raw.recentRounds.slice(0, Config.HISTORY_LIMIT).map((entry) => Array.isArray(entry?.bets) ? normalizeAviatorRound(entry) : normalizeLegacyCrashRound(entry))
      .filter((round) => round && (!round.version || round.status === 'crashed'));
  }
  return crash;
}
function normalizeCoinFlip(raw) {
  const coinFlip = { version: Config.VERSION, ...stats(raw, 'recentFlips') };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return coinFlip;
  if (Array.isArray(raw.recentFlips)) {
    coinFlip.recentFlips = raw.recentFlips.slice(0, Config.HISTORY_LIMIT).map((entry) => {
      if (!entry || !validId(entry.id)) return null;
      const stake = Config.normalizeStake(entry.stake); const choice = Config.normalizeFlipChoice(entry.choice); const result = Config.normalizeFlipChoice(entry.result);
      const createdAt = isoTime(entry.createdAt);
      if (!stake || !choice || !result || !createdAt) return null;
      const expected = Config.flipReward(stake, choice, result);
      if (entry.won !== expected.won || safeInteger(entry.coins, -1) !== expected.coins || safeInteger(entry.payout, -1) !== expected.payout) return null;
      return { id: String(entry.id).toLowerCase(), stake, choice, result, won: expected.won, coins: expected.coins, payout: expected.payout, createdAt };
    }).filter(Boolean);
  }
  return coinFlip;
}
function defaultArcadeState() {
  return {
    mines: normalizeMines(null),
    crash: normalizeCrash(null),
    coinFlip: normalizeCoinFlip(null)
  };
}
function normalizeArcadeState(raw) {
  return {
    mines: normalizeMines(raw?.mines),
    crash: normalizeCrash(raw?.crash),
    coinFlip: normalizeCoinFlip(raw?.coinFlip)
  };
}
function findMinesAction(state, actionId) {
  const id = String(actionId || '').toLowerCase(); const mines = state.mines;
  if (mines.active?.id === id) return { type: 'mines_start', roundId: id, status: 'active' };
  if (mines.active?.lastAction?.id === id) return mines.active.lastAction;
  for (const round of mines.recentRounds) {
    if (round.id === id) return { type: 'mines_start', roundId: id, status: round.status };
    if (round.lastAction?.id === id) return round.lastAction;
  }
  return null;
}

function crashBetEvent(bet) {
  return { slot: bet.slot, kind: bet.status === 'lost' ? 'lost' : bet.cashoutKind, cashoutBps: bet.cashoutBps, coins: bet.coins };
}
function recoveredCrashAction(round, actionId) {
  if (round.lastAction?.id === actionId) return round.lastAction;
  if (round.id === actionId) return { id: actionId, type: 'crash_start', roundId: round.id, events: [], crash: false, createdAt: round.createdAt };
  const placed = round.bets.find((bet) => bet.actionId === actionId);
  if (placed) return { id: actionId, type: 'crash_bet', roundId: round.id, events: [], crash: false, createdAt: placed.placedAt };
  const settled = round.bets.filter((bet) => bet.settlementActionId === actionId);
  if (settled.length) {
    return {
      id: actionId, type: settled.some((bet) => bet.cashoutKind === 'manual') ? 'crash_cashout' : 'crash_sync', roundId: round.id,
      events: settled.map(crashBetEvent), crash: false, createdAt: settled[0].settledAt
    };
  }
  return null;
}
function findCrashAction(state, actionId) {
  const id = String(actionId || '').toLowerCase(); const crash = state.crash;
  if (crash.active) {
    const recovered = recoveredCrashAction(crash.active, id); if (recovered) return recovered;
  }
  for (const round of crash.recentRounds) {
    if (round.version !== 2) continue;
    const recovered = recoveredCrashAction(round, id); if (recovered) return recovered;
  }
  return null;
}

module.exports = { defaultArcadeState, normalizeArcadeState, normalizeMinesRound, findMinesAction, findCrashAction };
