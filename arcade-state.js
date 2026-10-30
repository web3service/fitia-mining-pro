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
function normalizeCrash(raw) {
  const crash = { version: Config.VERSION, ...stats(raw, 'recentRounds') };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return crash;
  if (Array.isArray(raw.recentRounds)) {
    crash.recentRounds = raw.recentRounds.slice(0, Config.HISTORY_LIMIT).map((entry) => {
      if (!entry || !validId(entry.id)) return null;
      const stake = Config.normalizeStake(entry.stake); const targetBps = Config.normalizeCrashTarget(entry.targetBps);
      const createdAt = isoTime(entry.createdAt);
      if (!stake || !targetBps || !Number.isSafeInteger(entry.crashBps) || entry.crashBps < 100 || entry.crashBps > Config.CRASH_MAX_BPS || !createdAt) return null;
      const expected = Config.crashReward(stake, targetBps, entry.crashBps);
      if (entry.won !== expected.won || safeInteger(entry.coins, -1) !== expected.coins || safeInteger(entry.payout, -1) !== expected.payout) return null;
      return { id: String(entry.id).toLowerCase(), stake, targetBps, crashBps: entry.crashBps, won: expected.won, coins: expected.coins, payout: expected.payout, createdAt };
    }).filter(Boolean);
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

module.exports = { defaultArcadeState, normalizeArcadeState, normalizeMinesRound, findMinesAction };
