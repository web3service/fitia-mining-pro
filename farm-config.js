/* FITIA FARM — configuration publique, sans secret ni clé privée. */
(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.FitiaFarmConfig = config;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const missions = Object.freeze([
    Object.freeze({ key: 'planted', target: 3, reward: 10, points: 1 }),
    Object.freeze({ key: 'watered', target: 3, reward: 10, points: 1 }),
    Object.freeze({ key: 'cared', target: 3, reward: 10, points: 1 }),
    Object.freeze({ key: 'harvested', target: 3, reward: 10, points: 2 }),
    Object.freeze({ key: 'collected', target: 3, reward: 10, points: 2 }),
    Object.freeze({ key: 'sales', target: 3, reward: 10, points: 1 }),
    Object.freeze({ key: 'fertilized', target: 3, reward: 5, points: 1 }),
    Object.freeze({ key: 'bred', target: 1, reward: 5, points: 2 }),
    Object.freeze({ key: 'fed', target: 3, reward: 5, points: 1 }),
    Object.freeze({ key: 'milled', target: 3, reward: 5, points: 1 })
  ]);
  const pointsPerLevel = 10;
  function progressLevel(progress) {
    const points = missions.reduce((total, mission) => {
      const value = progress?.[mission.key];
      return total + (Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1000000000) : 0) * mission.points;
    }, 0);
    return Math.floor(points / pointsPerLevel) + 1;
  }
  // Server-authoritative, quarter-unit construction zones. Footprints account
  // for roofs, moving mill sails and the rotated tractor; no client sizes used.
  const buildingZones = Object.freeze({
    barn: Object.freeze({ bounds: [-1, 4, -7, -4.5], half: [2.33, 1.68] }),
    care: Object.freeze({ bounds: [-1, 4, -7, -4.5], half: [1.38, 1.28] }),
    mill: Object.freeze({ bounds: [-7.25, -6.25, -5.5, -4.5], half: [2.7, 0.82] }),
    well: Object.freeze({ bounds: [-8.5, -8, -0.5, 1.5], half: [0.9, 0.8] }),
    silo: Object.freeze({ bounds: [7.25, 8.25, -5.75, -4.5], half: [1.02, 1.02] }),
    tractor: Object.freeze({ bounds: [9.25, 9.75, -2, -0.5], half: [1.2, 1.3] })
  });
  function layoutPositions(layout) {
    return { ...(layout === 1 ? { barn: { x: -0.25, z: -5.5 }, care: { x: 3.75, z: -5 } }
      : { barn: { x: 3.75, z: -5.25 }, care: { x: -0.25, z: -5 } }),
      mill: { x: -6.75, z: -4.75 }, well: { x: -8.25, z: 0.5 }, silo: { x: 7.25, z: -4.5 }, tractor: { x: 9.25, z: -1.5 } };
  }
  function validBuildingPositions(positions) {
    if (!positions || typeof positions !== 'object') return false;
    const boxes = [];
    for (const [name, zone] of Object.entries(buildingZones)) {
      const p = positions[name], [minX, maxX, minZ, maxZ] = zone.bounds;
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isInteger(p.x * 4) || !Number.isInteger(p.z * 4)
          || p.x < minX || p.x > maxX || p.z < minZ || p.z > maxZ) return false;
      const [halfX, halfZ] = zone.half;
      boxes.push({ name, rect: [p.x - halfX, p.z - halfZ, p.x + halfX, p.z + halfZ] });
    }
    const fixed = [[-5.84, -8.10, -4.06, -6.90]]; // ground-level hay bales
    for (let i = 0; i < 6; i++) {
      const x = -5.4 + (i % 2) * 3.25, z = -2.4 + Math.floor(i / 2) * 2.55;
      fixed.push([x - 1.5, z - 1.1, x + 1.5, z + 1.1]);
    }
    // Preserve the animal enclosure including its rails.
    fixed.push([1.1, -1.9, 7.9, 5.35]);
    const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) if (overlaps(boxes[i].rect, boxes[j].rect)) return false;
      for (let j = 0; j < fixed.length; j++) if (overlaps(boxes[i].rect, fixed[j])) return false;
    }
    return true;
  }
  function normalizedBuildingPositions(raw, layout) {
    const positions = layoutPositions(layout);
    if (raw && typeof raw === 'object') for (const key of Object.keys(buildingZones)) {
      if (raw[key] !== undefined) positions[key] = { x: raw[key]?.x, z: raw[key]?.z };
    }
    return validBuildingPositions(positions) ? positions : layoutPositions(layout);
  }
  return Object.freeze({
    progressLevel, layoutPositions, validBuildingPositions, normalizedBuildingPositions, BUILDING_ZONES: buildingZones,
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
    // Mission rewards are one-time per account and must be economically approved before deployment.
    PROGRESS_POINTS_PER_LEVEL: pointsPerLevel,
    MISSIONS: missions,
    BUILDING_STYLES: Object.freeze({
      barn: Object.freeze([0x813b32, 0x476b45, 0x9a7950]),
      care: Object.freeze([0xf0d9aa, 0xd0dfbf, 0xd6dcef]),
      mill: Object.freeze([0x8b8c7c, 0x799370, 0xcbb991]),
      well: Object.freeze([0x8b8c7c, 0x799370, 0xcbb991]),
      silo: Object.freeze([0x7d8786, 0x69845f, 0x6e8599]),
      tractor: Object.freeze([0x477c3b, 0x9e4639, 0x436f95])
    }),
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
    WATER_SPEED_PERCENT: 5,
    CARE_SPEED_PERCENT: 5,
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
