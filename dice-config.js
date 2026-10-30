/* FITIA DICE — règles publiques, paiements entiers et avantage statistique mesurable. */
(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.FitiaDiceConfig = config;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const STAKES = Object.freeze([50, 100, 200, 500]);
  const TARGETS = Object.freeze([2, 3, 4, 5, 6]);
  const MIN_ROLL = 1;
  const MAX_ROLL = 6;
  const RETURN_BPS = 9500;
  const HISTORY_LIMIT = 24;

  function normalizeStake(value) {
    const stake = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(stake) && STAKES.includes(stake) ? stake : null;
  }
  function normalizeTarget(value) {
    const target = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(target) && TARGETS.includes(target) ? target : null;
  }
  function selectRoll(randomValue) {
    if (!Number.isSafeInteger(randomValue) || randomValue < 0 || randomValue >= MAX_ROLL) throw new Error('Invalid dice random value.');
    return randomValue + 1;
  }
  function winningOutcomes(target) {
    const normalized = normalizeTarget(target);
    if (!normalized) throw new Error('Invalid dice target.');
    return normalized - 1;
  }
  function payoutFor(stakeValue, targetValue) {
    const stake = normalizeStake(stakeValue);
    const target = normalizeTarget(targetValue);
    if (!stake || !target) throw new Error('Invalid dice payout parameters.');
    // Le gain inclut la mise. L'arrondi inférieur garantit un retour théorique
    // inférieur ou égal à 95 % pour chaque mise et chaque cible autorisées.
    return Math.floor(stake * RETURN_BPS * MAX_ROLL / (10000 * winningOutcomes(target)));
  }
  function rewardFor(stake, target, roll) {
    const payout = payoutFor(stake, target);
    if (!Number.isSafeInteger(roll) || roll < MIN_ROLL || roll > MAX_ROLL) throw new Error('Invalid dice roll.');
    const won = roll < normalizeTarget(target);
    return { won, coins: won ? payout : 0, payout, roll };
  }
  function expectedReturnRatio(stake, target) {
    const normalizedStake = normalizeStake(stake);
    if (!normalizedStake) throw new Error('Invalid dice stake.');
    return winningOutcomes(target) / MAX_ROLL * payoutFor(normalizedStake, target) / normalizedStake;
  }

  return Object.freeze({
    VERSION, STAKES, TARGETS, MIN_ROLL, MAX_ROLL, RETURN_BPS, HISTORY_LIMIT,
    normalizeStake, normalizeTarget, selectRoll, winningOutcomes, payoutFor, rewardFor, expectedReturnRatio
  });
});
