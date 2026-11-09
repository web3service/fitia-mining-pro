/* Signed quote terms for the planned variable exchange rate. Not active yet. */
(function (root, factory) {
  const ethers = root.ethers || (typeof require === 'function' ? require('./vendor/ethers.umd.min.js') : null);
  const api = factory(ethers);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FitiaFarmExchangeProtocol = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ethers) {
  'use strict';
  if (!ethers) throw new Error('ethers is required.');
  const MAX_COINS = 1000000000n;
  const MAX_RATE = 1000000000000000n;
  const MAX_UNITS = 9999999999999999999n;
  function decimal(value, max, label) {
    if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || value.length > 19) throw new Error(`Invalid ${label}`);
    const n = BigInt(value); if (n > max) throw new Error(`Invalid ${label}`); return n;
  }
  function uuid(value) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid quote id');
    return value.toLowerCase();
  }
  function normalize(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid quote');
    if (!ethers.isAddress(input.wallet)) throw new Error('Invalid wallet');
    const quoteId = uuid(input.quoteId);
    if (!['deposit', 'withdraw'].includes(input.direction)) throw new Error('Invalid direction');
    const coins = decimal(input.coins, MAX_COINS, 'coins');
    const amountUnits = decimal(input.amountUnits, MAX_UNITS, 'FTA amount');
    const rateUnits = decimal(input.rateUnits, MAX_RATE, 'rate');
    if (coins * rateUnits !== amountUnits * 100n) throw new Error('Inexact conversion');
    if (!Number.isSafeInteger(input.rateVersion) || input.rateVersion < 1) throw new Error('Invalid rate version');
    if (!Number.isSafeInteger(input.issuedAt) || input.issuedAt <= 0 || !Number.isSafeInteger(input.expiresAt) || input.expiresAt <= input.issuedAt) throw new Error('Invalid quote times');
    return Object.freeze({ wallet: input.wallet.toLowerCase(), quoteId, direction: input.direction, coins: coins.toString(), amountUnits: amountUnits.toString(), rateUnits: rateUnits.toString(), rateVersion: input.rateVersion, issuedAt: input.issuedAt, expiresAt: input.expiresAt });
  }
  function message(input) {
    const q = normalize(input);
    return ['FITIA FARM — EXCHANGE QUOTE V1', 'Chain ID: 137', `Wallet: ${q.wallet}`, `Quote ID: ${q.quoteId}`,
      `Direction: ${q.direction}`, `F-Coins: ${q.coins}`, `FTA units: ${q.amountUnits}`,
      `FTA units per 100 F-Coins: ${q.rateUnits}`, `Rate version: ${q.rateVersion}`, `Issued at: ${q.issuedAt}`, `Expires at: ${q.expiresAt}`].join('\n');
  }
  function verify(input, signature) {
    const q = normalize(input);
    try { return ethers.verifyMessage(message(q), String(signature)).toLowerCase() === q.wallet; }
    catch (_) { return false; }
  }
  return Object.freeze({ normalize, message, verify });
});
