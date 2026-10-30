/* FITIA FARM — configuration publique, sans secret ni clé privée. */
(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.FitiaFarmConfig = config;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return Object.freeze({
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
    MIN_WITHDRAW_COINS: 1000,
    MAX_WITHDRAW_COINS: 10000,
    WITHDRAWAL_COOLDOWN_MS: 86400000,
    ANIMALS: Object.freeze({
      chicken: Object.freeze({ price: 250, durationMs: 14400000, product: 'eggs', icon: 'chicken' }),
      sheep: Object.freeze({ price: 500, durationMs: 28800000, product: 'wool', icon: 'sheep' }),
      cow: Object.freeze({ price: 700, durationMs: 43200000, product: 'milk', icon: 'cow' })
    }),
    CROPS: Object.freeze({
      wheat: Object.freeze({ price: 10, durationMs: 1800000, yield: 2, icon: 'wheat' }),
      carrot: Object.freeze({ price: 15, durationMs: 3600000, yield: 2, icon: 'carrot' })
    }),
    PRODUCTS: Object.freeze({
      wheat: Object.freeze({ price: 12, icon: 'wheat' }),
      carrot: Object.freeze({ price: 18, icon: 'carrot' }),
      eggs: Object.freeze({ price: 30, icon: 'eggs' }),
      wool: Object.freeze({ price: 65, icon: 'wool' }),
      milk: Object.freeze({ price: 90, icon: 'milk' })
    }),
    FEED_PACK_PRICE: 20,
    FEED_PACK_QUANTITY: 5
  });
});
