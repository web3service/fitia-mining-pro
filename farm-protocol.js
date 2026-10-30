/* FITIA FARM — signatures publiques des actions de compte. */
(function (root, factory) {
  const ethers = root.ethers || (typeof require === 'function' ? require('./vendor/ethers.umd.min.js') : null);
  const api = factory(ethers);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FitiaFarmProtocol = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ethers) {
  'use strict';
  if (!ethers) throw new Error('ethers est requis pour FITIA FARM.');
  const ACTIONS = new Set(['state', 'deposit', 'action', 'withdraw']);
  const ACTION_TYPES = new Set(['buy_land', 'buy_animal', 'buy_feed', 'plant', 'harvest', 'feed', 'collect', 'sell', 'wheel_spin', 'dice_roll', 'mines_start', 'mines_reveal', 'mines_cashout', 'crash_play', 'coin_flip']);

  class FarmProtocolError extends Error {
    constructor(message, code = 'FARM_INVALID') { super(message); this.code = code; }
  }
  function normalizeBuyer(value) {
    if (typeof value !== 'string' || !ethers.isAddress(value)) throw new FarmProtocolError('Adresse wallet invalide.', 'FARM_AUTH');
    return value.toLowerCase();
  }
  function requireUuid(value) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new FarmProtocolError('Identifiant d’action invalide.');
    }
    return value.toLowerCase();
  }
  function requireTxHash(value) {
    if (typeof value !== 'string' || !/^0x[a-f0-9]{64}$/i.test(value)) throw new FarmProtocolError('Transaction invalide.', 'FARM_PAYMENT');
    return value.toLowerCase();
  }
  function requireUnits(value) {
    const text = String(value || '');
    if (!/^[0-9]{1,19}$/.test(text) || BigInt(text) <= 0n) throw new FarmProtocolError('Montant invalide.', 'FARM_PAYMENT');
    return text;
  }
  function requireCoins(value) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new FarmProtocolError('Solde de coins invalide.');
    return value;
  }
  function requireType(value) {
    const type = String(value || '');
    if (!ACTION_TYPES.has(type)) throw new FarmProtocolError('Action de ferme invalide.');
    return type;
  }
  function hashJson(value) { return ethers.sha256(ethers.toUtf8Bytes(JSON.stringify(value))); }
  function normalizeParams(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const serialized = JSON.stringify(value);
    if (serialized.length > 2048) throw new FarmProtocolError('Paramètres trop volumineux.');
    return JSON.parse(serialized);
  }
  function message(action, params = {}) {
    if (!ACTIONS.has(action)) throw new FarmProtocolError('Action API invalide.', 'FARM_AUTH');
    const buyer = normalizeBuyer(params.buyer);
    const timestamp = params.timestamp;
    if (!Number.isSafeInteger(timestamp) || timestamp <= 0) throw new FarmProtocolError('Horodatage invalide.', 'FARM_AUTH');
    const lines = ['FITIA FARM — ACCOUNT V1', `Action: ${action}`, 'Chain ID: 137', `Buyer: ${buyer}`, `Timestamp: ${timestamp}`];
    if (action === 'deposit') {
      lines.push(`Action ID: ${requireUuid(params.actionId)}`, `Transaction: ${requireTxHash(params.txHash)}`, `FTA units: ${requireUnits(params.amountUnits)}`);
    } else if (action === 'action') {
      lines.push(`Action ID: ${requireUuid(params.actionId)}`, `Type: ${requireType(params.type)}`, `Parameters SHA-256: ${hashJson(normalizeParams(params.params))}`);
    } else if (action === 'withdraw') {
      lines.push(`Action ID: ${requireUuid(params.actionId)}`, `Coins: ${requireCoins(params.coins)}`);
    }
    return lines.join('\n');
  }
  return Object.freeze({ FarmProtocolError, normalizeBuyer, requireUuid, requireTxHash, requireUnits, requireCoins, requireType, normalizeParams, hashJson, message });
});
