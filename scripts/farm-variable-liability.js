#!/usr/bin/env node
'use strict';
// Partial projection only, never a solvency certificate or an active rate.
// Aggregate F-Coins and each already-recorded pending FTA amount separately.
const { validateRateUnits } = require('../farm-exchange');
function decimal(value, name) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || value.length > 30) throw new Error(`Invalid ${name}`);
  return BigInt(value);
}
function calculate(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid input');
  const balance = decimal(input.balanceCoins, 'balanceCoins');
  const stock = decimal(input.stockCoins, 'stockCoins');
  const pending = decimal(input.pendingFtaUnits, 'pendingFtaUnits');
  const rate = validateRateUnits(input.rateUnits);
  const numerator = (balance + stock) * rate;
  // Ceiling the aggregate fractional FTA base unit avoids understating this
  // projection. Actual per-account withdrawal rules can differ.
  const liquidAndStockUnitsCeiling = (numerator + 99n) / 100n;
  return { rateUnits: rate.toString(), balanceCoins: balance.toString(), stockCoins: stock.toString(),
    pendingFtaUnits: pending.toString(), liquidAndStockUnitsCeiling: liquidAndStockUnitsCeiling.toString(),
    partialFtaUnitsCeiling: (liquidAndStockUnitsCeiling + pending).toString(),
    caveat: 'Partial estimate only: pending withdrawals use their recorded FTA amount; excludes future production, other games, fees, liquidity and solvency.' };
}
if (require.main === module) {
  try {
    const [balanceCoins, stockCoins, pendingFtaUnits, rateUnits, ...extra] = process.argv.slice(2);
    if (extra.length || rateUnits === undefined) throw new Error('Usage: node scripts/farm-variable-liability.js BALANCE_COINS STOCK_COINS PENDING_FTA_UNITS RATE_UNITS');
    console.log(JSON.stringify(calculate({ balanceCoins, stockCoins, pendingFtaUnits, rateUnits }), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = Object.freeze({ calculate });
