'use strict';

const crypto = require('crypto');
const ethers = require('./vendor/ethers.umd.min.js');
const Config = require('./farm-config');
const Protocol = require('./farm-protocol');
const WheelConfig = require('./wheel-config');

const DEFAULT_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://polygon.drpc.org',
  'https://1rpc.io/matic',
  'https://polygon-rpc.com'
];
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const PRODUCT_KEYS = Object.keys(Config.PRODUCTS);

class FarmError extends Error {
  constructor(status, message, code = 'FARM_ERROR') { super(message); this.status = status; this.code = code; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function safeInteger(value, fallback = 0, maximum = Config.MAX_COINS) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : fallback;
}
function safeTime(value) {
  const time = Number(value);
  return Number.isSafeInteger(time) && time >= 0 && time < 8640000000000000 ? time : 0;
}
function requireStarted(state) {
  if (!state.land?.owned || !state.animals.length) throw new FarmError(409, 'Achetez un terrain et un animal pour démarrer la ferme.', 'FARM_NOT_STARTED');
}
function defaultState(wallet, now = Date.now()) {
  return {
    version: 1, wallet, coins: 0, land: null, animals: [], crops: [], feed: 0,
    inventory: Object.fromEntries(PRODUCT_KEYS.map((key) => [key, 0])),
    wheel: { version: WheelConfig.VERSION, lastFreeAt: 0, bonusSpins: 0, totalSpins: 0, totalStaked: 0, totalWonCoins: 0, recentSpins: [] },
    createdAt: now, updatedAt: now
  };
}
function normalizeWheel(raw) {
  const wheel = { version: WheelConfig.VERSION, lastFreeAt: 0, bonusSpins: 0, totalSpins: 0, totalStaked: 0, totalWonCoins: 0, recentSpins: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return wheel;
  wheel.lastFreeAt = safeTime(raw.lastFreeAt);
  wheel.bonusSpins = safeInteger(raw.bonusSpins, 0, WheelConfig.MAX_BONUS_SPINS);
  wheel.totalSpins = safeInteger(raw.totalSpins, 0, Number.MAX_SAFE_INTEGER);
  wheel.totalStaked = safeInteger(raw.totalStaked, 0, Number.MAX_SAFE_INTEGER);
  wheel.totalWonCoins = safeInteger(raw.totalWonCoins, 0, Number.MAX_SAFE_INTEGER);
  if (Array.isArray(raw.recentSpins)) {
    wheel.recentSpins = raw.recentSpins.slice(0, WheelConfig.HISTORY_LIMIT).map((spin) => {
      const segment = WheelConfig.segmentById(spin?.segmentId);
      if (!segment || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(spin?.id || ''))) return null;
      const createdAt = Date.parse(spin.createdAt);
      if (!Number.isFinite(createdAt)) return null;
      return {
        id: String(spin.id).toLowerCase(), mode: ['free', 'paid', 'bonus'].includes(spin.mode) ? spin.mode : 'paid',
        stake: safeInteger(spin.stake, 0, Config.MAX_COINS), baseCoins: safeInteger(spin.baseCoins, WheelConfig.FREE_BASE_COINS, Config.MAX_COINS),
        segmentId: segment.id, kind: segment.kind, coins: safeInteger(spin.coins, 0, Config.MAX_COINS),
        ftaCoins: safeInteger(spin.ftaCoins, 0, Config.MAX_COINS), feed: safeInteger(spin.feed, 0, 100000),
        product: PRODUCT_KEYS.includes(spin.product) ? spin.product : null, quantity: safeInteger(spin.quantity, 0, 1000000),
        bonusSpins: safeInteger(spin.bonusSpins, 0, 1), createdAt: new Date(createdAt).toISOString()
      };
    }).filter(Boolean);
  }
  return wheel;
}
function normalizeState(raw, wallet) {
  const base = defaultState(wallet, safeTime(raw?.createdAt) || Date.now());
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  base.coins = safeInteger(raw.coins);
  if (raw.land?.owned === true) base.land = { owned: true, level: 1, purchasedAt: safeTime(raw.land.purchasedAt) };
  base.feed = safeInteger(raw.feed, 0, 100000);
  PRODUCT_KEYS.forEach((key) => { base.inventory[key] = safeInteger(raw.inventory?.[key], 0, 1000000); });
  base.wheel = normalizeWheel(raw.wheel);
  if (Array.isArray(raw.animals)) {
    base.animals = raw.animals.slice(0, Config.MAX_ANIMALS).map((animal) => {
      if (!animal || !Config.ANIMALS[animal.species]) return null;
      try { Protocol.requireUuid(animal.id); } catch (_) { return null; }
      return { id: String(animal.id).toLowerCase(), species: animal.species, acquiredAt: safeTime(animal.acquiredAt), produceAt: safeTime(animal.produceAt) };
    }).filter(Boolean);
  }
  if (Array.isArray(raw.crops)) {
    base.crops = raw.crops.slice(0, Config.MAX_CROPS).map((crop) => {
      if (!crop || !Config.CROPS[crop.species]) return null;
      try { Protocol.requireUuid(crop.id); } catch (_) { return null; }
      return { id: String(crop.id).toLowerCase(), species: crop.species, plantedAt: safeTime(crop.plantedAt), readyAt: safeTime(crop.readyAt) };
    }).filter(Boolean);
  }
  base.updatedAt = safeTime(raw.updatedAt) || base.createdAt;
  return base;
}
function fromWithdrawal(row) {
  if (!row) return null;
  return {
    id: row.id, wallet: row.wallet, coins: Number(row.coins), ftaUnits: String(row.fta_units),
    status: row.status, createdAt: row.created_at, paidAt: row.paid_at || null,
    payoutTxHash: row.payout_tx_hash || null
  };
}

class MemoryFarmRepository {
  constructor() { this.accounts = new Map(); this.actions = new Map(); this.transactions = new Map(); this.withdrawals = new Map(); }
  async get(wallet) { const value = this.accounts.get(wallet); return value ? clone(value) : null; }
  async isActionProcessed(actionId, wallet) {
    const action = this.actions.get(actionId);
    return Boolean(action && (!wallet || action.wallet === wallet));
  }
  async apply(wallet, expectedRevision, state, actionId, actionType, options = {}) {
    if (this.actions.has(actionId)) throw new FarmError(409, 'Action déjà traitée.', 'FARM_CONFLICT');
    if (options.txHash && this.transactions.has(options.txHash)) throw new FarmError(409, 'Transaction déjà utilisée.', 'FARM_TX_USED');
    const current = this.accounts.get(wallet);
    if ((expectedRevision === 0 && current) || (expectedRevision > 0 && (!current || current.revision !== expectedRevision))) {
      throw new FarmError(409, 'Le compte a changé. Rechargez la ferme.', 'FARM_REVISION');
    }
    if (options.withdrawal) {
      if (this.withdrawals.has(options.withdrawal.id)) throw new FarmError(409, 'Retrait déjà créé.', 'FARM_CONFLICT');
    }
    const record = { state: clone(state), revision: expectedRevision + 1 };
    this.accounts.set(wallet, record);
    this.actions.set(actionId, { wallet, actionType });
    if (options.txHash) this.transactions.set(options.txHash, wallet);
    if (options.withdrawal) this.withdrawals.set(options.withdrawal.id, clone(options.withdrawal));
    return clone(record);
  }
  async listWithdrawals(wallet) {
    return Array.from(this.withdrawals.values()).filter((item) => !wallet || item.wallet === wallet)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100).map(clone);
  }
  async getWithdrawal(id) { const value = this.withdrawals.get(id); return value ? clone(value) : null; }
  async completeWithdrawal(id, txHash, paidAt) {
    const withdrawal = this.withdrawals.get(id);
    if (!withdrawal || withdrawal.status !== 'pending') throw new FarmError(409, 'Retrait déjà clôturé ou introuvable.', 'FARM_WITHDRAWAL_STATUS');
    if (Array.from(this.withdrawals.values()).some((item) => item.payoutTxHash === txHash)) throw new FarmError(409, 'Transaction de paiement déjà utilisée.', 'FARM_TX_USED');
    withdrawal.status = 'paid'; withdrawal.payoutTxHash = txHash; withdrawal.paidAt = paidAt;
    return clone(withdrawal);
  }
}

function getSupabaseConfig() {
  const url = String(process.env.FITIA_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.FITIA_SUPABASE_SERVICE_ROLE_KEY || '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || key.length < 20) throw new FarmError(503, 'Le service FARM doit être configuré.', 'FARM_CONFIG');
  return { url, key };
}
class SupabaseFarmRepository {
  constructor(config) { this.config = config || getSupabaseConfig(); }
  async request(method, path, body) {
    let response;
    try {
      const headers = { apikey: this.config.key, Accept: 'application/json', Prefer: 'return=representation' };
      if (!this.config.key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${this.config.key}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      response = await fetch(`${this.config.url}/rest/v1/${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15000)
      });
    } catch (_) { throw new FarmError(503, 'La base FARM est indisponible.', 'FARM_STORAGE'); }
    if (!response.ok) {
      const conflict = response.status === 409 || response.status === 400;
      throw new FarmError(conflict ? 409 : 503, conflict ? 'Conflit de compte FARM.' : 'La base FARM a refusé la requête.', conflict ? 'FARM_CONFLICT' : 'FARM_STORAGE');
    }
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch (_) { throw new FarmError(503, 'Réponse FARM invalide.', 'FARM_STORAGE'); }
  }
  async get(wallet) {
    const rows = await this.request('GET', `farm_accounts?wallet=eq.${encodeURIComponent(wallet)}&select=state,revision&limit=1`);
    return rows?.[0] ? { state: rows[0].state, revision: Number(rows[0].revision) } : null;
  }
  async isActionProcessed(actionId, wallet) {
    const owner = wallet ? `&wallet=eq.${encodeURIComponent(wallet)}` : '';
    const rows = await this.request('GET', `farm_actions?action_id=eq.${encodeURIComponent(actionId)}${owner}&select=action_id&limit=1`);
    return Boolean(rows?.[0]);
  }
  async apply(wallet, expectedRevision, state, actionId, actionType, options = {}) {
    const withdrawal = options.withdrawal;
    await this.request('POST', 'rpc/farm_apply', {
      p_wallet: wallet, p_expected_revision: expectedRevision, p_state: state,
      p_action_id: actionId, p_action_type: actionType, p_tx_hash: options.txHash || null,
      p_withdrawal_id: withdrawal?.id || null, p_coins: withdrawal?.coins || null,
      p_fta_units: withdrawal?.ftaUnits || null, p_created_at: withdrawal?.createdAt || null
    });
    return this.get(wallet);
  }
  async listWithdrawals(wallet) {
    const filter = wallet ? `&wallet=eq.${encodeURIComponent(wallet)}` : '';
    const rows = await this.request('GET', `farm_withdrawals?select=*${filter}&order=created_at.desc&limit=100`);
    return (rows || []).map(fromWithdrawal);
  }
  async getWithdrawal(id) {
    const rows = await this.request('GET', `farm_withdrawals?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    return fromWithdrawal(rows?.[0]);
  }
  async completeWithdrawal(id, txHash, paidAt) {
    await this.request('POST', 'rpc/farm_complete_withdrawal', { p_id: id, p_tx_hash: txHash, p_paid_at: paidAt });
    return this.getWithdrawal(id);
  }
}

function validateTransferReceipt(expectation, receipt, currentBlock) {
  if (!receipt) return { confirmed: false };
  if (Number(receipt.status) !== 1) throw new FarmError(409, 'La transaction FTA a échoué.', 'FARM_PAYMENT_FAILED');
  const from = ethers.zeroPadValue(expectation.from, 32).toLowerCase();
  const to = ethers.zeroPadValue(expectation.to, 32).toLowerCase();
  const match = (receipt.logs || []).some((log) => {
    if (!log || String(log.address || '').toLowerCase() !== Config.FTA_CONTRACT.toLowerCase()) return false;
    if (!Array.isArray(log.topics) || log.topics.length < 3) return false;
    if (String(log.topics[0]).toLowerCase() !== TRANSFER_TOPIC.toLowerCase()) return false;
    if (String(log.topics[1]).toLowerCase() !== from || String(log.topics[2]).toLowerCase() !== to) return false;
    try { return BigInt(log.data) === BigInt(expectation.amountUnits); } catch (_) { return false; }
  });
  if (!match) throw new FarmError(409, 'Le transfert FTA ne correspond pas au montant ou aux wallets.', 'FARM_PAYMENT_MISMATCH');
  const confirmations = Number(currentBlock) - Number(receipt.blockNumber) + 1;
  return { confirmed: Number.isSafeInteger(confirmations) && confirmations >= 3 };
}
async function withTimeout(promise, milliseconds = 15000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('RPC_TIMEOUT')), milliseconds); })]); }
  finally { if (timer) clearTimeout(timer); }
}
async function verifyFtaTransfer(expectation, txHash, options = {}) {
  let missing = false;
  for (const rpc of options.rpcs || DEFAULT_RPCS) {
    const provider = new ethers.JsonRpcProvider(rpc, Config.CHAIN_ID, { staticNetwork: true });
    try {
      const receipt = await withTimeout(provider.getTransactionReceipt(txHash));
      if (!receipt) { missing = true; continue; }
      const block = await withTimeout(provider.getBlockNumber());
      return validateTransferReceipt(expectation, receipt, block);
    } catch (error) {
      if (error instanceof FarmError && error.status < 500) throw error;
    } finally { try { provider.destroy(); } catch (_) { /* noop */ } }
  }
  if (missing) return { confirmed: false };
  throw new FarmError(503, 'La vérification Polygon est indisponible.', 'FARM_RPC_UNAVAILABLE');
}

function createFarmService(options = {}) {
  if (!options.repository) throw new Error('Un stockage FARM est requis.');
  const repository = options.repository;
  const now = options.now || (() => new Date());
  const randomInt = options.randomInt || ((maximum) => crypto.randomInt(maximum));
  const verifier = options.paymentVerifier || ((expectation, hash) => verifyFtaTransfer(expectation, hash, options.rpc));

  function authenticate(action, body) {
    const timestamp = body.timestamp;
    if (!Number.isSafeInteger(timestamp) || Math.abs(now().getTime() - timestamp) > 600000) throw new FarmError(401, 'Signature expirée.', 'FARM_AUTH');
    try {
      const buyer = Protocol.normalizeBuyer(body.buyer);
      const recovered = ethers.verifyMessage(Protocol.message(action, body), String(body.signature || '')).toLowerCase();
      if (recovered !== buyer) throw new Error('wallet');
      return buyer;
    } catch (_) { throw new FarmError(401, 'Signature du wallet invalide.', 'FARM_AUTH'); }
  }
  async function view(wallet, spinId = null) {
    const record = await repository.get(wallet);
    const state = normalizeState(record?.state, wallet);
    const withdrawals = await repository.listWithdrawals(wallet);
    const result = { state, revision: record?.revision || 0, withdrawals };
    if (spinId) result.spin = state.wheel.recentSpins.find((spin) => spin.id === spinId) || null;
    return result;
  }
  async function getState(body) { return view(authenticate('state', body)); }
  async function applyIdempotent(wallet, actionId, actionType, state, expectedRevision, extra = {}) {
    const spinId = actionType === 'wheel_spin' ? actionId : null;
    try {
      await repository.apply(wallet, expectedRevision, state, actionId, actionType, extra);
    } catch (error) {
      if (await repository.isActionProcessed(actionId, wallet)) return view(wallet, spinId);
      throw error;
    }
    return view(wallet, spinId);
  }
  async function deposit(body) {
    const wallet = authenticate('deposit', body);
    const actionId = Protocol.requireUuid(body.actionId);
    if (await repository.isActionProcessed(actionId, wallet)) return { pending: false, ...(await view(wallet)) };
    const txHash = Protocol.requireTxHash(body.txHash);
    const amountUnits = Protocol.requireUnits(body.amountUnits);
    const units = BigInt(amountUnits);
    if (units % Config.UNITS_PER_COIN !== 0n || units / Config.UNITS_PER_COIN > BigInt(Config.MAX_COINS)) {
      throw new FarmError(400, 'Utilisez des multiples de 0,01 FTA.', 'FARM_AMOUNT');
    }
    const coins = Number(units / Config.UNITS_PER_COIN);
    const verification = await verifier({ from: wallet, to: Config.TREASURY_ADDRESS, amountUnits }, txHash);
    if (!verification.confirmed) return { pending: true, ...(await view(wallet)) };
    const record = await repository.get(wallet);
    const state = normalizeState(record?.state, wallet);
    if (state.coins + coins > Config.MAX_COINS) throw new FarmError(409, 'Limite de coins atteinte.', 'FARM_LIMIT');
    state.coins += coins; state.updatedAt = now().getTime();
    return { pending: false, ...(await applyIdempotent(wallet, actionId, 'deposit', state, record?.revision || 0, { txHash })) };
  }
  function spinWheel(state, params, actionId, timestamp) {
    requireStarted(state);
    const mode = String(params.mode || '');
    if (!['free', 'paid', 'bonus'].includes(mode)) throw new FarmError(400, 'Mode de roue invalide.', 'WHEEL_MODE');
    let stake = 0;
    if (mode === 'paid') {
      stake = WheelConfig.normalizeStake(params.stake);
      if (!stake) throw new FarmError(400, 'Mise de roue invalide.', 'WHEEL_STAKE');
      if (state.coins < stake) throw new FarmError(409, 'Coins insuffisants pour cette mise.', 'FARM_INSUFFICIENT_COINS');
    } else if (params.stake !== undefined && params.stake !== '0') {
      throw new FarmError(400, 'Mise de roue invalide.', 'WHEEL_STAKE');
    }
    if (mode === 'free' && timestamp - state.wheel.lastFreeAt < WheelConfig.FREE_INTERVAL_MS) {
      throw new FarmError(409, 'Le tour gratuit est disponible toutes les 24 heures.', 'WHEEL_FREE_COOLDOWN');
    }
    if (mode === 'bonus' && state.wheel.bonusSpins < 1) throw new FarmError(409, 'Aucun tour bonus disponible.', 'WHEEL_BONUS_EMPTY');

    if (mode === 'paid') state.coins -= stake;
    else if (mode === 'free') state.wheel.lastFreeAt = timestamp;
    else state.wheel.bonusSpins -= 1;

    const segment = WheelConfig.selectSegment(randomInt(WheelConfig.TOTAL_WEIGHT));
    const baseCoins = mode === 'paid' ? stake : (mode === 'free' ? WheelConfig.FREE_BASE_COINS : WheelConfig.BONUS_BASE_COINS);
    const reward = WheelConfig.rewardFor(segment, baseCoins);
    if (state.coins + reward.coins > Config.MAX_COINS) throw new FarmError(409, 'Limite de coins atteinte.', 'FARM_LIMIT');
    if (state.feed + reward.feed > 100000) throw new FarmError(409, 'Limite de nourriture atteinte.', 'FARM_LIMIT');
    if (reward.product && state.inventory[reward.product] + reward.quantity > 1000000) throw new FarmError(409, 'Limite de grange atteinte.', 'FARM_LIMIT');
    if (reward.bonusSpins && state.wheel.bonusSpins + reward.bonusSpins > WheelConfig.MAX_BONUS_SPINS) throw new FarmError(409, 'Limite de tours bonus atteinte.', 'FARM_LIMIT');
    state.coins += reward.coins;
    state.feed += reward.feed;
    if (reward.product) state.inventory[reward.product] += reward.quantity;
    state.wheel.bonusSpins += reward.bonusSpins;
    state.wheel.totalSpins += 1;
    state.wheel.totalStaked += stake;
    state.wheel.totalWonCoins += reward.coins;
    if (!Number.isSafeInteger(state.wheel.totalSpins) || !Number.isSafeInteger(state.wheel.totalStaked) || !Number.isSafeInteger(state.wheel.totalWonCoins)) throw new FarmError(409, 'Limite de statistiques atteinte.', 'FARM_LIMIT');
    state.wheel.recentSpins.unshift({
      id: actionId, mode, stake, baseCoins, segmentId: segment.id, kind: reward.kind,
      coins: reward.coins, ftaCoins: reward.ftaCoins, feed: reward.feed, product: reward.product,
      quantity: reward.quantity, bonusSpins: reward.bonusSpins, createdAt: new Date(timestamp).toISOString()
    });
    state.wheel.recentSpins = state.wheel.recentSpins.slice(0, WheelConfig.HISTORY_LIMIT);
    state.updatedAt = timestamp;
    return state;
  }
  function transition(state, type, params, actionId, timestamp) {
    if (type === 'wheel_spin') return spinWheel(state, params, actionId, timestamp);
    const deduct = (amount) => {
      if (state.coins < amount) throw new FarmError(409, 'Coins insuffisants.', 'FARM_INSUFFICIENT_COINS');
      state.coins -= amount;
    };
    const addCoins = (amount) => {
      if (state.coins + amount > Config.MAX_COINS) throw new FarmError(409, 'Limite de coins atteinte.', 'FARM_LIMIT');
      state.coins += amount;
    };
    if (type === 'buy_land') {
      if (state.land?.owned) throw new FarmError(409, 'Le terrain est déjà possédé.', 'FARM_LAND_OWNED');
      deduct(Config.LAND_PRICE);
      state.land = { owned: true, level: 1, purchasedAt: timestamp };
    } else if (type === 'buy_animal') {
      if (!state.land?.owned) throw new FarmError(409, 'Achetez d’abord le terrain.', 'FARM_LAND_REQUIRED');
      if (state.animals.length >= Config.MAX_ANIMALS) throw new FarmError(409, 'La ferme est complète.', 'FARM_LIMIT');
      const species = String(params.species || '');
      const definition = Config.ANIMALS[species];
      if (!definition) throw new FarmError(400, 'Animal invalide.', 'FARM_PARAMS');
      deduct(definition.price);
      state.animals.push({ id: actionId, species, acquiredAt: timestamp, produceAt: 0 });
    } else {
      requireStarted(state);
      if (type === 'buy_feed') {
        deduct(Config.FEED_PACK_PRICE); state.feed += Config.FEED_PACK_QUANTITY;
      } else if (type === 'plant') {
        if (state.crops.length >= Config.MAX_CROPS) throw new FarmError(409, 'Toutes les parcelles sont occupées.', 'FARM_LIMIT');
        const species = String(params.species || '');
        const definition = Config.CROPS[species];
        if (!definition) throw new FarmError(400, 'Culture invalide.', 'FARM_PARAMS');
        deduct(definition.price);
        state.crops.push({ id: actionId, species, plantedAt: timestamp, readyAt: timestamp + definition.durationMs });
      } else if (type === 'harvest') {
        const index = state.crops.findIndex((crop) => crop.id === params.cropId);
        if (index < 0) throw new FarmError(404, 'Culture introuvable.', 'FARM_NOT_FOUND');
        const crop = state.crops[index];
        if (crop.readyAt > timestamp) throw new FarmError(409, 'La culture pousse encore.', 'FARM_NOT_READY');
        state.inventory[crop.species] += Config.CROPS[crop.species].yield;
        state.crops.splice(index, 1);
      } else if (type === 'feed') {
        const animal = state.animals.find((item) => item.id === params.animalId);
        if (!animal) throw new FarmError(404, 'Animal introuvable.', 'FARM_NOT_FOUND');
        if (state.feed < 1) throw new FarmError(409, 'Achetez de la nourriture.', 'FARM_FEED_REQUIRED');
        if (animal.produceAt > 0) throw new FarmError(409, 'Récoltez la production avant de nourrir à nouveau.', 'FARM_NOT_READY');
        state.feed -= 1;
        animal.produceAt = timestamp + Config.ANIMALS[animal.species].durationMs;
      } else if (type === 'collect') {
        const animal = state.animals.find((item) => item.id === params.animalId);
        if (!animal) throw new FarmError(404, 'Animal introuvable.', 'FARM_NOT_FOUND');
        if (!animal.produceAt || animal.produceAt > timestamp) throw new FarmError(409, 'La production n’est pas prête.', 'FARM_NOT_READY');
        state.inventory[Config.ANIMALS[animal.species].product] += 1;
        animal.produceAt = 0;
      } else if (type === 'sell') {
        let total = 0;
        PRODUCT_KEYS.forEach((key) => { total += state.inventory[key] * Config.PRODUCTS[key].price; });
        if (!total) throw new FarmError(409, 'La grange est vide.', 'FARM_INVENTORY_EMPTY');
        addCoins(total);
        PRODUCT_KEYS.forEach((key) => { state.inventory[key] = 0; });
      } else throw new FarmError(400, 'Action invalide.', 'FARM_PARAMS');
    }
    state.updatedAt = timestamp;
    return state;
  }
  async function action(body) {
    const wallet = authenticate('action', body);
    const actionId = Protocol.requireUuid(body.actionId);
    if (await repository.isActionProcessed(actionId, wallet)) return view(wallet, actionId);
    const type = Protocol.requireType(body.type);
    const params = Protocol.normalizeParams(body.params);
    const record = await repository.get(wallet);
    const state = normalizeState(record?.state, wallet);
    transition(state, type, params, actionId, now().getTime());
    return applyIdempotent(wallet, actionId, type, state, record?.revision || 0);
  }
  async function withdraw(body) {
    const wallet = authenticate('withdraw', body);
    const actionId = Protocol.requireUuid(body.actionId);
    if (await repository.isActionProcessed(actionId, wallet)) return view(wallet);
    const coins = Protocol.requireCoins(body.coins);
    if (coins < Config.MIN_WITHDRAW_COINS || coins > Config.MAX_WITHDRAW_COINS || coins % Config.COINS_PER_FTA !== 0) {
      throw new FarmError(400, 'Le retrait doit être un multiple de 100 coins.', 'FARM_AMOUNT');
    }
    const recent = await repository.listWithdrawals(wallet);
    if (recent.some((item) => item.status === 'pending')) throw new FarmError(409, 'Un retrait est déjà en cours.', 'FARM_WITHDRAWAL_PENDING');
    const latest = recent[0];
    if (latest && now().getTime() - Date.parse(latest.createdAt) < Config.WITHDRAWAL_COOLDOWN_MS) {
      throw new FarmError(409, 'Un seul retrait est autorisé toutes les 24 heures.', 'FARM_WITHDRAWAL_COOLDOWN');
    }
    const record = await repository.get(wallet);
    const state = normalizeState(record?.state, wallet);
    requireStarted(state);
    if (state.coins < coins) throw new FarmError(409, 'Coins insuffisants.', 'FARM_INSUFFICIENT_COINS');
    state.coins -= coins; state.updatedAt = now().getTime();
    const ftaUnits = ((BigInt(coins) / BigInt(Config.COINS_PER_FTA)) * Config.COIN_UNITS_PER_FTA).toString();
    const createdAt = now().toISOString();
    const withdrawal = { id: actionId, wallet, coins, ftaUnits, status: 'pending', createdAt, paidAt: null, payoutTxHash: null };
    return applyIdempotent(wallet, actionId, 'withdraw', state, record?.revision || 0, { withdrawal });
  }
  async function listWithdrawals() { return repository.listWithdrawals(); }
  async function completeWithdrawal(body) {
    const id = Protocol.requireUuid(body.id);
    const txHash = Protocol.requireTxHash(body.txHash);
    const withdrawal = await repository.getWithdrawal(id);
    if (!withdrawal) throw new FarmError(404, 'Retrait introuvable.', 'FARM_NOT_FOUND');
    if (withdrawal.status === 'paid') {
      if (withdrawal.payoutTxHash !== txHash) throw new FarmError(409, 'Retrait déjà payé.', 'FARM_WITHDRAWAL_STATUS');
      return { pending: false, withdrawal };
    }
    const verification = await verifier({ from: Config.TREASURY_ADDRESS, to: withdrawal.wallet, amountUnits: withdrawal.ftaUnits }, txHash);
    if (!verification.confirmed) return { pending: true, withdrawal };
    return { pending: false, withdrawal: await repository.completeWithdrawal(id, txHash, now().toISOString()) };
  }
  return Object.freeze({ getState, deposit, action, withdraw, listWithdrawals, completeWithdrawal, view });
}

let defaultService = null;
function getDefaultFarmService() {
  if (defaultService) return defaultService;
  const config = getSupabaseConfig();
  defaultService = createFarmService({ repository: new SupabaseFarmRepository(config) });
  return defaultService;
}
module.exports = {
  FarmError, MemoryFarmRepository, SupabaseFarmRepository, createFarmService, getDefaultFarmService,
  defaultState, normalizeState, validateTransferReceipt, verifyFtaTransfer
};
