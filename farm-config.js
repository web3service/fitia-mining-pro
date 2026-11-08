/* FITIA FARM — configuration publique, sans secret ni clé privée. */
(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.FitiaFarmConfig = config;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const missions = Object.freeze([
    Object.freeze({ key: 'planted', target: 3, points: 1 }),
    Object.freeze({ key: 'watered', target: 3, points: 1 }),
    Object.freeze({ key: 'cared', target: 3, points: 1 }),
    Object.freeze({ key: 'harvested', target: 3, points: 2 }),
    Object.freeze({ key: 'collected', target: 3, points: 2 }),
    Object.freeze({ key: 'sales', target: 3, points: 1 })
  ]);
  const pointsPerLevel = 10;
  function progressLevel(progress) {
    const points = missions.reduce((total, mission) => {
      const value = progress?.[mission.key];
      return total + (Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1000000000) : 0) * mission.points;
    }, 0);
    return Math.floor(points / pointsPerLevel) + 1;
  }
  return Object.freeze({
    progressLevel,
    CHAIN_ID: 137,
    FTA_CONTRACT: '0x5c418b12c7e9c2A8e9A71A68c6d9b319E7B1d1fd',
    TREASURY_ADDRESS: '0xbcd8a903f41157a269615725ac66c8d9d0c8cc90',
    FTA_DECIMALS: 8,
    COINS_PER_FTA: 100,
    COIN_UNITS_PER_FTA: 100000000n,
    UNITS_PER_COIN: 1000000n,
    LAND_PRICE: 500,
    MAX_ANIMALS: 12,
    MAX_CROPS: 6,
    MAX_COINS: 1000000000,
    // Progression is informational only: it never awards coins or FTA.
    PROGRESS_POINTS_PER_LEVEL: pointsPerLevel,
    MISSIONS: missions,
    COSMETIC_UNLOCKS: Object.freeze([Object.freeze({ level: 2, key: 'flowers' }), Object.freeze({ level: 3, key: 'lanterns' })]),
    MIN_WITHDRAW_COINS: 1000,
    MAX_WITHDRAW_COINS: 10000,
    WITHDRAWAL_COOLDOWN_MS: 86400000,
    ANIMALS: Object.freeze({
      chicken: Object.freeze({ price: 250, durationMs: 14400000, product: 'eggs', icon: 'chicken' }),
      sheep: Object.freeze({ price: 500, durationMs: 28800000, product: 'wool', icon: 'sheep' }),
      cow: Object.freeze({ price: 700, durationMs: 43200000, product: 'milk', icon: 'cow' }),
      goat: Object.freeze({ price: 700, durationMs: 43200000, product: 'milk', icon: 'goat' }),
      duck: Object.freeze({ price: 250, durationMs: 14400000, product: 'eggs', icon: 'duck' })
    }),
    CROPS: Object.freeze({
      wheat: Object.freeze({ price: 10, durationMs: 1800000, yield: 2, icon: 'wheat' }),
      carrot: Object.freeze({ price: 15, durationMs: 3600000, yield: 2, icon: 'carrot' }),
      maize: Object.freeze({ price: 10, durationMs: 1800000, yield: 2, icon: 'maize' }),
      tomato: Object.freeze({ price: 15, durationMs: 3600000, yield: 2, icon: 'tomato' })
    }),
    PRODUCTS: Object.freeze({
      wheat: Object.freeze({ price: 12, icon: 'wheat' }),
      carrot: Object.freeze({ price: 18, icon: 'carrot' }),
      maize: Object.freeze({ price: 12, icon: 'maize' }),
      tomato: Object.freeze({ price: 18, icon: 'tomato' }),
      eggs: Object.freeze({ price: 30, icon: 'eggs' }),
      wool: Object.freeze({ price: 65, icon: 'wool' }),
      milk: Object.freeze({ price: 90, icon: 'milk' })
    }),
    FERTILIZER_PRICE: 4,
    FERTILIZER_PERCENT: 10,
    BREED_FEED_COST: 1,
    BREED_PRICE_PERCENT: 90,
    MILL_WHEAT_INPUT: 1,
    MILL_FEED_OUTPUT: 2,
    MAX_FEED: 100000,
    FEED_PACK_PRICE: 20,
    FEED_PACK_QUANTITY: 5
  });
});
