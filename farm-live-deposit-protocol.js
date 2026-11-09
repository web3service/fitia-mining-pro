/* Signatures for prepared real deposits. No API uses these messages yet. */
(function (root, factory) {
  const ethers = root.ethers || (typeof require === 'function' ? require('./vendor/ethers.umd.min.js') : null);
  const protocol = factory(ethers);
  if (typeof module === 'object' && module.exports) module.exports = protocol;
  else root.FitiaFarmLiveDepositProtocol = protocol;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ethers) {
  'use strict';
  if (!ethers) throw new Error('ethers required');
  function uuid(v) {
    if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) throw Error('Invalid ID');
    return v.toLowerCase();
  }
  function address(v) { if (typeof v !== 'string' || !ethers.isAddress(v)) throw Error('Invalid address'); return v.toLowerCase(); }
  function hash(v) { if (typeof v !== 'string' || !/^0x[0-9a-f]{64}$/i.test(v)) throw Error('Invalid transaction'); return v.toLowerCase(); }
  function quoteRequest(data) {
    if (!data || !Number.isSafeInteger(data.timestamp) || data.timestamp <= 0 || !Number.isSafeInteger(data.coins) || data.coins < 1 || data.coins > 1000000000) throw Error('Invalid request');
    return ['FITIA FARM — DEPOSIT QUOTE REQUEST V1', 'Chain ID: 137', `Wallet: ${address(data.wallet)}`, `Quote ID: ${uuid(data.quoteId)}`, `F-Coins: ${data.coins}`, `Timestamp: ${data.timestamp}`].join('\n');
  }
  function submitRequest(data) {
    if (!data || !Number.isSafeInteger(data.logIndex) || data.logIndex < 0 || data.logIndex > 2147483647) throw Error('Invalid event');
    return ['FITIA FARM — DEPOSIT SUBMISSION V1', 'Chain ID: 137', `Wallet: ${address(data.wallet)}`, `Quote ID: ${uuid(data.quoteId)}`, `Event ID: ${uuid(data.eventId)}`, `Transaction: ${hash(data.txHash)}`, `Log index: ${data.logIndex}`].join('\n');
  }
  function verify(message, signature, wallet) {
    try { return ethers.verifyMessage(message, String(signature)).toLowerCase() === address(wallet); } catch (_) { return false; }
  }
  return Object.freeze({ quoteRequest, submitRequest, verify });
});
