(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.FitiaWheelConfig = config;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STAKES = Object.freeze([50, 100, 200, 500]);
  const SEGMENTS = [
    { id: 'coins_half', kind: 'coins', label: '½×', weight: 32, numerator: 1, denominator: 2, color: '#6d4bc3' },
    { id: 'feed', kind: 'feed', label: 'FEED', weight: 15, color: '#c87532' },
    { id: 'coins_triple', kind: 'coins', label: '3×', weight: 15, numerator: 3, denominator: 1, color: '#c99a2e' },
    { id: 'wheat', kind: 'product', label: 'WHEAT', weight: 10, color: '#4f8b57' },
    { id: 'eggs', kind: 'product', label: 'EGGS', weight: 5, color: '#a65b7d' },
    { id: 'carrot', kind: 'product', label: 'CARROT', weight: 10, color: '#bd6138' },
    { id: 'wool', kind: 'product', label: 'WOOL', weight: 2, color: '#5876ad' },
    { id: 'milk', kind: 'product', label: 'MILK', weight: 1, color: '#3e8992' },
    { id: 'extra_spin', kind: 'extra_spin', label: '+1 SPIN', weight: 5, color: '#8749ad' },
    { id: 'fta_small', kind: 'fta', label: 'FTA', weight: 3, coinsAtBase: 50, color: '#b78b23' },
    { id: 'fta_big', kind: 'fta', label: 'FTA MAX', weight: 2, coinsAtBase: 200, color: '#e0b83e' }
  ].map((segment) => Object.freeze(segment));
  const TOTAL_WEIGHT = SEGMENTS.reduce((sum, segment) => sum + segment.weight, 0);
  if (TOTAL_WEIGHT !== 100) throw new Error('Lucky Wheel probabilities must total 100.');

  function segmentById(id) { return SEGMENTS.find((segment) => segment.id === id) || null; }
  function normalizeStake(value) {
    const stake = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(stake) && STAKES.includes(stake) ? stake : null;
  }
  function selectSegment(randomValue) {
    if (!Number.isSafeInteger(randomValue) || randomValue < 0 || randomValue >= TOTAL_WEIGHT) throw new Error('Invalid wheel random value.');
    let cursor = 0;
    for (const segment of SEGMENTS) {
      cursor += segment.weight;
      if (randomValue < cursor) return segment;
    }
    throw new Error('Wheel selection failed.');
  }
  function rewardFor(segmentOrId, effectiveStake) {
    const segment = typeof segmentOrId === 'string' ? segmentById(segmentOrId) : segmentOrId;
    if (!segment || !Number.isSafeInteger(effectiveStake) || effectiveStake <= 0) throw new Error('Invalid wheel reward.');
    const reward = { segmentId: segment.id, kind: segment.kind, coins: 0, ftaCoins: 0, feed: 0, product: null, quantity: 0, bonusSpins: 0 };
    if (segment.kind === 'coins') reward.coins = Math.round(effectiveStake * segment.numerator / segment.denominator);
    else if (segment.kind === 'fta') {
      reward.coins = Math.round(segment.coinsAtBase * effectiveStake / 100);
      reward.ftaCoins = reward.coins;
    } else if (segment.kind === 'feed') reward.feed = Math.max(1, Math.round(effectiveStake / 100));
    else if (segment.kind === 'product') {
      reward.product = segment.id;
      reward.quantity = Math.max(1, Math.round(effectiveStake / 100));
    } else if (segment.kind === 'extra_spin') reward.bonusSpins = 1;
    return reward;
  }
  function probability(segment) { return segment.weight / TOTAL_WEIGHT; }

  return Object.freeze({
    VERSION: 1,
    STAKES,
    DEFAULT_STAKE: 50,
    FREE_BASE_COINS: 20,
    BONUS_BASE_COINS: 20,
    FREE_INTERVAL_MS: 86400000,
    MAX_BONUS_SPINS: 100,
    HISTORY_LIMIT: 24,
    SEGMENTS: Object.freeze(SEGMENTS),
    TOTAL_WEIGHT,
    segmentById,
    normalizeStake,
    selectSegment,
    rewardFor,
    probability
  });
});
