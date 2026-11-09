'use strict';

// Exact rate arithmetic only. This module does not activate a variable rate.
// A rate is the number of 10^-8 FTA base units for 100 F-Coins.
const COINS_PER_QUOTE = 100n;
const FTA_UNITS = 100000000n;
const MAX_RATE_UNITS = 1000000000000000n;
const MAX_TRANSFER_UNITS = 9999999999999999999n;
const MAX_COINS = 1000000000n;

class ExchangeError extends Error {
  constructor(message, code = 'EXCHANGE_AMOUNT') { super(message); this.code = code; }
}
function positiveInteger(value, maximum, code) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || value.length > 19) throw new ExchangeError('Invalid positive integer.', code);
  const result = BigInt(value);
  if (result > maximum) throw new ExchangeError('Value exceeds the maximum.', code);
  return result;
}
function validateRateUnits(value) { return positiveInteger(value, MAX_RATE_UNITS, 'EXCHANGE_RATE'); }
function coinsToUnits(coinsText, rateText) {
  const coins = positiveInteger(coinsText, MAX_COINS, 'EXCHANGE_AMOUNT');
  const rate = validateRateUnits(rateText);
  const numerator = coins * rate;
  if (numerator % COINS_PER_QUOTE !== 0n) throw new ExchangeError('Amount cannot be represented exactly.', 'EXCHANGE_PRECISION');
  const units = numerator / COINS_PER_QUOTE;
  if (units <= 0n || units > MAX_TRANSFER_UNITS) throw new ExchangeError('Amount exceeds supported limits.', 'EXCHANGE_AMOUNT');
  return units.toString();
}
function unitsToCoins(unitsText, rateText) {
  const units = positiveInteger(unitsText, MAX_TRANSFER_UNITS, 'EXCHANGE_AMOUNT');
  const rate = validateRateUnits(rateText);
  const numerator = units * COINS_PER_QUOTE;
  if (numerator % rate !== 0n) throw new ExchangeError('Amount does not convert to whole F-Coins.', 'EXCHANGE_PRECISION');
  const coins = numerator / rate;
  if (coins <= 0n || coins > MAX_COINS) throw new ExchangeError('Amount exceeds supported limits.', 'EXCHANGE_AMOUNT');
  return coins.toString();
}
module.exports = Object.freeze({ ExchangeError, COINS_PER_QUOTE, FTA_UNITS, MAX_RATE_UNITS, MAX_TRANSFER_UNITS, MAX_COINS, validateRateUnits, coinsToUnits, unitsToCoins });
