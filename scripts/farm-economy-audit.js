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
    const fertilizedDurationMs = crop.durationMs - Math.floor(crop.durationMs * c.FERTILIZER_PERCENT / 100);
    let maxMixedNetPerPlot = 0;
    for (let fertilized = 0; fertilized * fertilizedDurationMs <= day; fertilized++) {
      const ordinary = Math.floor((day - fertilized * fertilizedDurationMs) / crop.durationMs);
      maxMixedNetPerPlot = Math.max(maxMixedNetPerPlot, ordinary * net + fertilized * (net - c.FERTILIZER_PRICE));
    }
    return [key, { cost: crop.price, revenue: sale, net, cyclesPerDay, maxDailyCoins: net * cyclesPerDay * c.MAX_CROPS,
      fertilizer: { price: c.FERTILIZER_PRICE, durationMs: fertilizedDurationMs, netPerCycle: net - c.FERTILIZER_PRICE,
        maxMixedDailyCoins: maxMixedNetPerPlot * c.MAX_CROPS } }];
  }));
  const animals = Object.fromEntries(Object.entries(c.ANIMALS).map(([key, animal]) => {
    const sale = c.PRODUCTS[animal.product].price;
    const net = sale - feedCost;
    const cyclesPerDay = Math.floor(day / animal.durationMs);
    return [key, { purchase: animal.price, feedCost, revenue: sale, net, cyclesPerDay, maxDailyCoins: net * cyclesPerDay * c.MAX_ANIMALS }];
  }));
  const cropBest = Math.max(...Object.values(crops).map(row => row.fertilizer.maxMixedDailyCoins));
  const animalBest = Math.max(...Object.values(animals).map(row => row.maxDailyCoins));
  return { coinsPerFta: c.COINS_PER_FTA, crops, animals, feedCost,
    dailyTheoreticalCoins: cropBest + animalBest, dailyTheoreticalFta: (cropBest + animalBest) / c.COINS_PER_FTA,
    minimumWithdrawalCoins: c.MIN_WITHDRAW_COINS, maxWithdrawalCoins: c.MAX_WITHDRAW_COINS,
    withdrawalCooldownHours: c.WITHDRAWAL_COOLDOWN_MS / 3600000,
    mill: { wheatSaleValue: c.MILL_WHEAT_INPUT * c.PRODUCTS.wheat.price, feedRetailValue: c.MILL_FEED_OUTPUT * feedCost } };
}
if (require.main === module) console.log(JSON.stringify(audit(), null, 2));
module.exports = { audit };
