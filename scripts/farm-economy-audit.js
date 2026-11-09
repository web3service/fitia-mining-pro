#!/usr/bin/env node
'use strict';
// Upper-bound arithmetic only; this is not a treasury solvency calculation.
const C = require('../farm-config');
function audit(c = C) {
  const day = 24 * 60 * 60 * 1000;
  const feedCost = c.FEED_PACK_PRICE / c.FEED_PACK_QUANTITY;
  const crops = Object.fromEntries(Object.entries(c.CROPS).map(([key, crop]) => {
    const sale = c.PRODUCTS[key].price * crop.yield;
    const net = sale - crop.price;
    const cyclesPerDay = Math.floor(day / crop.durationMs);
    const wateredDurationMs = crop.durationMs - Math.floor(crop.durationMs * c.WATER_SPEED_PERCENT / 100);
    const fertilizedDurationMs = wateredDurationMs - Math.floor(crop.durationMs * c.FERTILIZER_PERCENT / 100);
    let maxMixedNetPerPlot = 0;
    // Free watering is always at least as fast; enumerate watered cycles with/without fertilizer.
    for (let fertilized = 0; fertilized * fertilizedDurationMs <= day; fertilized++) {
      const watered = Math.floor((day - fertilized * fertilizedDurationMs) / wateredDurationMs);
      maxMixedNetPerPlot = Math.max(maxMixedNetPerPlot, watered * net + fertilized * (net - c.FERTILIZER_PRICE));
    }
    return [key, { cost: crop.price, revenue: sale, net, cyclesPerDay, maxDailyCoins: net * cyclesPerDay * c.MAX_CROPS,
      wateredDurationMs, fertilizer: { price: c.FERTILIZER_PRICE, durationMs: fertilizedDurationMs, netPerCycle: net - c.FERTILIZER_PRICE,
        maxMixedDailyCoins: maxMixedNetPerPlot * c.MAX_CROPS } }];
  }));
  const animals = Object.fromEntries(Object.entries(c.ANIMALS).map(([key, animal]) => {
    const sale = c.PRODUCTS[animal.product].price;
    const net = sale - feedCost;
    const cyclesPerDay = Math.floor(day / animal.durationMs);
    const caredDurationMs = animal.durationMs - Math.floor(animal.durationMs * c.CARE_SPEED_PERCENT / 100);
    const caredCyclesPerDay = Math.floor(day / caredDurationMs);
    return [key, { purchase: animal.price, feedCost, revenue: sale, net, cyclesPerDay, maxDailyCoins: net * cyclesPerDay * c.MAX_ANIMALS,
      caredDurationMs, caredCyclesPerDay, caredMaxDailyCoins: net * caredCyclesPerDay * c.MAX_ANIMALS }];
  }));
  const cropBest = Math.max(...Object.values(crops).map(row => row.fertilizer.maxMixedDailyCoins));
  const animalBest = Math.max(...Object.values(animals).map(row => row.caredMaxDailyCoins));
  return { coinsPerFta: c.COINS_PER_FTA, crops, animals, feedCost,
    oneTimeMissionCoinsPerAccount: c.MISSIONS.reduce((sum, mission) => sum + mission.reward, 0),
    dailyTheoreticalCoins: cropBest + animalBest, dailyTheoreticalFta: (cropBest + animalBest) / c.COINS_PER_FTA,
    minimumWithdrawalCoins: c.MIN_WITHDRAW_COINS, maxWithdrawalCoins: c.MAX_WITHDRAW_COINS,
    withdrawalCooldownHours: c.WITHDRAWAL_COOLDOWN_MS / 3600000,
    mill: { wheatSaleValue: c.MILL_WHEAT_INPUT * c.PRODUCTS.wheat.price, feedRetailValue: c.MILL_FEED_OUTPUT * feedCost } };
}
function project(accounts, days, c = C) {
  if (!Number.isSafeInteger(accounts) || accounts < 1 || accounts > 100000 || !Number.isSafeInteger(days) || days < 1 || days > 3650) {
    throw new RangeError('Accounts must be 1–100000 and days 1–3650.');
  }
  const model = audit(c);
  const productionCoins = model.dailyTheoreticalCoins * accounts * days;
  const missionCoins = model.oneTimeMissionCoinsPerAccount * accounts;
  return {
    accounts, days, assumption: 'idealized fully active, fully equipped accounts; not a solvency forecast',
    productionCoins, missionCoinsOnce: missionCoins,
    totalCoins: productionCoins + missionCoins,
    totalFta: (productionCoins + missionCoins) / c.COINS_PER_FTA,
    exclusions: ['existing balances and stock', 'other games', 'network costs', 'abuse', 'cross-day scheduling', 'additional funding and withdrawals']
  };
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (!args.length) console.log(JSON.stringify(audit(), null, 2));
    else {
      if (args.length !== 2 || !args.every(value => /^[0-9]+$/.test(value))) throw new Error('Usage: node scripts/farm-economy-audit.js [active_accounts days]');
      console.log(JSON.stringify(project(Number(args[0]), Number(args[1])), null, 2));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { audit, project };
