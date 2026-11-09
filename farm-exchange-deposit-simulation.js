'use strict';
// Isolated preparation only: records verified evidence in simulation tables.
// Does not credit coins, send refunds or expose an API endpoint.
const Protocol = require('./farm-exchange-protocol');
const { inspectDeposit } = require('./farm-exchange-receipt');
const Config = require('./farm-config');
class DepositSimulationError extends Error { constructor(code) { super(code); this.code = code; } }
function createDepositSimulation(repository, provider, options = {}) {
  if (!repository || typeof repository.getQuote !== 'function' || typeof repository.recordReceipt !== 'function' || !provider) throw new TypeError('Simulation dependencies required');
  const confirmations = options.confirmations === undefined ? 128 : options.confirmations;
  return Object.freeze({
    async observe(quoteId, signature, txHash, logIndex) {
      const stored = await repository.getQuote(quoteId);
      let quote;
      try { quote = Protocol.normalize(stored); } catch (_) { throw new DepositSimulationError('SIM_QUOTE'); }
      if (quote.quoteId !== quoteId || quote.direction !== 'deposit' || !Protocol.verify(quote, signature)) throw new DepositSimulationError('SIM_AUTH');
      // The provider is a server dependency, not an object supplied by clients.
      const evidence = await inspectDeposit(provider, txHash, logIndex, { from: quote.wallet, to: Config.TREASURY_ADDRESS, amountUnits: quote.amountUnits }, confirmations);
      if (evidence.status === 'pending') return { status: 'pending' };
      // SQL serializes identical events and classifies duplicate or late payments;
      // this operation never credits the account or makes a refund.
      return repository.recordReceipt(quote.quoteId, evidence);
    }
  });
}
module.exports = Object.freeze({ createDepositSimulation, DepositSimulationError });
