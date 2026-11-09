#!/usr/bin/env node
'use strict';
const assert = require('assert');
const x = require('../farm-exchange');
const error = (fn, code) => assert.throws(fn, e => e instanceof x.ExchangeError && e.code === code);
// Existing rate: 100 coins = 1 FTA (8 decimal places).
assert.strictEqual(x.coinsToUnits('100', '100000000'), '100000000');
assert.strictEqual(x.unitsToCoins('100000000', '100000000'), '100');
// Changing the rate works in both directions without floating-point rounding.
assert.strictEqual(x.coinsToUnits('1000', '50000000'), '500000000');
assert.strictEqual(x.unitsToCoins('500000000', '50000000'), '1000');
assert.strictEqual(x.coinsToUnits('100', '123456789'), '123456789');
assert.strictEqual(x.unitsToCoins('123456789', '123456789'), '100');
error(() => x.coinsToUnits('1', '1'), 'EXCHANGE_PRECISION');
error(() => x.unitsToCoins('1', '300'), 'EXCHANGE_PRECISION');
for (const rate of ['0', '-1', '1.5', '01', 'NaN', '', '1000000000000001']) error(() => x.coinsToUnits('100', rate), 'EXCHANGE_RATE');
for (const amount of ['0', '-100', '1.1', '1e2', '01', '', '1000000001']) error(() => x.coinsToUnits(amount, '100000000'), 'EXCHANGE_AMOUNT');
error(() => x.unitsToCoins('9999999999999999999', '1'), 'EXCHANGE_AMOUNT');
for (const rate of ['1', '300', '100000000', '123456789', '1000000000000000']) {
  for (const coins of ['100', '1000', '10000']) {
    const units = x.coinsToUnits(coins, rate);
    assert.strictEqual(x.unitsToCoins(units, rate), coins);
  }
}
console.log('Échange : calculs exacts, arrondis interdits, limites et aller-retour OK (non activé)');
