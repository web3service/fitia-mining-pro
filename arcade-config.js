/* FITIA ARCADE — règles publiques, paiements entiers et avantage statistique mesurable. */
(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.FitiaArcadeConfig = config;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const STAKES = Object.freeze([50, 100, 200, 500]);
  const HISTORY_LIMIT = 24;
  const RETURN_BPS = 9500;

  const MINES_COUNTS = Object.freeze([1, 3, 5, 10]);
  const MINES_TILES = 25;
  const MINES_MAX_PAYOUT = 1000000;

  const CRASH_TARGETS_BPS = Object.freeze([150, 200, 300, 500, 1000]);
  const CRASH_RANDOM_RANGE = 1000000;
  const CRASH_MAX_BPS = 10000;

  const FLIP_SIDES = Object.freeze(['heads', 'tails']);

  function normalizeStake(value) {
    const stake = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(stake) && STAKES.includes(stake) ? stake : null;
  }
  function normalizeMineCount(value) {
    const count = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(count) && MINES_COUNTS.includes(count) ? count : null;
  }
  function normalizeTileIndex(value) {
    const index = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(index) && index >= 0 && index < MINES_TILES ? index : null;
  }
  function normalizeSafeCount(value, mineCount) {
    const count = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    const mines = normalizeMineCount(mineCount);
    return mines && Number.isSafeInteger(count) && count >= 0 && count <= MINES_TILES - mines ? count : null;
  }
  function normalizeCrashTarget(value) {
    const target = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(target) && CRASH_TARGETS_BPS.includes(target) ? target : null;
  }
  function normalizeFlipChoice(value) {
    const choice = String(value || '').toLowerCase();
    return FLIP_SIDES.includes(choice) ? choice : null;
  }

  function minesPayout(stakeValue, mineCountValue, safeCountValue) {
    const stake = normalizeStake(stakeValue);
    const mineCount = normalizeMineCount(mineCountValue);
    const safeCount = normalizeSafeCount(safeCountValue, mineCount);
    if (!stake || !mineCount || safeCount === null) throw new Error('Invalid mines payout parameters.');
    if (safeCount === 0) return 0;
    let survivalNumerator = 1n;
    let survivalDenominator = 1n;
    for (let index = 0; index < safeCount; index += 1) {
      survivalNumerator *= BigInt(MINES_TILES - mineCount - index);
      survivalDenominator *= BigInt(MINES_TILES - index);
    }
    const payout = BigInt(stake) * BigInt(RETURN_BPS) * survivalDenominator / (10000n * survivalNumerator);
    return Number(payout > BigInt(MINES_MAX_PAYOUT) ? BigInt(MINES_MAX_PAYOUT) : payout);
  }
  function minesSurvivalRatio(mineCountValue, safeCountValue) {
    const mineCount = normalizeMineCount(mineCountValue);
    const safeCount = normalizeSafeCount(safeCountValue, mineCount);
    if (!mineCount || safeCount === null) throw new Error('Invalid mines probability parameters.');
    let probability = 1;
    for (let index = 0; index < safeCount; index += 1) probability *= (MINES_TILES - mineCount - index) / (MINES_TILES - index);
    return probability;
  }
  function minesExpectedReturnRatio(stakeValue, mineCountValue, safeCountValue) {
    const stake = normalizeStake(stakeValue);
    if (!stake) throw new Error('Invalid mines stake.');
    return minesSurvivalRatio(mineCountValue, safeCountValue) * minesPayout(stake, mineCountValue, safeCountValue) / stake;
  }
  function minesNextChance(mineCountValue, safeCountValue) {
    const mineCount = normalizeMineCount(mineCountValue);
    const safeCount = normalizeSafeCount(safeCountValue, mineCount);
    if (!mineCount || safeCount === null) throw new Error('Invalid mines chance parameters.');
    const remaining = MINES_TILES - safeCount;
    return remaining > 0 ? (MINES_TILES - mineCount - safeCount) / remaining : 0;
  }

  function selectCrashPoint(randomValue) {
    if (!Number.isSafeInteger(randomValue) || randomValue < 0 || randomValue >= CRASH_RANDOM_RANGE) throw new Error('Invalid crash random value.');
    const point = Math.floor(95000000 / (CRASH_RANDOM_RANGE - randomValue));
    return Math.max(100, Math.min(CRASH_MAX_BPS, point));
  }
  function crashWinningOutcomes(targetValue) {
    const target = normalizeCrashTarget(targetValue);
    if (!target) throw new Error('Invalid crash target.');
    let low = 0; let high = CRASH_RANDOM_RANGE;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (selectCrashPoint(middle) >= target) high = middle;
      else low = middle + 1;
    }
    return CRASH_RANDOM_RANGE - low;
  }
  function crashPayout(stakeValue, targetValue) {
    const stake = normalizeStake(stakeValue); const target = normalizeCrashTarget(targetValue);
    if (!stake || !target) throw new Error('Invalid crash payout parameters.');
    return Math.floor(stake * target / 100);
  }
  function crashReward(stakeValue, targetValue, crashBps) {
    const stake = normalizeStake(stakeValue); const target = normalizeCrashTarget(targetValue);
    if (!stake || !target || !Number.isSafeInteger(crashBps) || crashBps < 100 || crashBps > CRASH_MAX_BPS) throw new Error('Invalid crash result parameters.');
    const won = crashBps >= target; const payout = crashPayout(stake, target);
    return { won, coins: won ? payout : 0, payout, crashBps, targetBps: target };
  }
  function crashExpectedReturnRatio(stakeValue, targetValue) {
    const stake = normalizeStake(stakeValue); const target = normalizeCrashTarget(targetValue);
    if (!stake || !target) throw new Error('Invalid crash probability parameters.');
    return crashWinningOutcomes(target) / CRASH_RANDOM_RANGE * crashPayout(stake, target) / stake;
  }

  function selectFlipSide(randomValue) {
    if (!Number.isSafeInteger(randomValue) || randomValue < 0 || randomValue >= FLIP_SIDES.length) throw new Error('Invalid coin flip random value.');
    return FLIP_SIDES[randomValue];
  }
  function flipPayout(stakeValue) {
    const stake = normalizeStake(stakeValue);
    if (!stake) throw new Error('Invalid coin flip stake.');
    return Math.floor(stake * 190 / 100);
  }
  function flipReward(stakeValue, choiceValue, resultValue) {
    const stake = normalizeStake(stakeValue); const choice = normalizeFlipChoice(choiceValue); const result = normalizeFlipChoice(resultValue);
    if (!stake || !choice || !result) throw new Error('Invalid coin flip result parameters.');
    const won = choice === result; const payout = flipPayout(stake);
    return { won, coins: won ? payout : 0, payout, choice, result };
  }
  function flipExpectedReturnRatio(stakeValue) {
    const stake = normalizeStake(stakeValue);
    if (!stake) throw new Error('Invalid coin flip stake.');
    return flipPayout(stake) / stake / 2;
  }

  return Object.freeze({
    VERSION, STAKES, HISTORY_LIMIT, RETURN_BPS,
    MINES_COUNTS, MINES_TILES, MINES_MAX_PAYOUT,
    CRASH_TARGETS_BPS, CRASH_RANDOM_RANGE, CRASH_MAX_BPS, FLIP_SIDES,
    normalizeStake, normalizeMineCount, normalizeTileIndex, normalizeSafeCount, normalizeCrashTarget, normalizeFlipChoice,
    minesPayout, minesSurvivalRatio, minesExpectedReturnRatio, minesNextChance,
    selectCrashPoint, crashWinningOutcomes, crashPayout, crashReward, crashExpectedReturnRatio,
    selectFlipSide, flipPayout, flipReward, flipExpectedReturnRatio
  });
});
