'use strict';
// Internal simulation adapter only; no API route or real balance repository.
const Protocol = require('./farm-exchange-protocol');
class SimulationError extends Error { constructor(code) { super(code); this.code = code; } }
function createWithdrawalSimulation(repository) {
  if (!repository || typeof repository.getQuote !== 'function' || typeof repository.simulateWithdrawal !== 'function') throw new TypeError('Simulation repository required');
  return Object.freeze({
    async withdraw(quoteId, signature) {
      const stored = await repository.getQuote(quoteId);
      let q;
      try { q = Protocol.normalize(stored); } catch (_) { throw new SimulationError('SIM_QUOTE'); }
      if (q.quoteId !== quoteId || q.direction !== 'withdraw' || !Protocol.verify(q, signature)) throw new SimulationError('SIM_AUTH');
      // Database owns expiry, version, idempotency and atomic balance checks.
      return repository.simulateWithdrawal(q.quoteId, q.wallet);
    }
  });
}
module.exports = Object.freeze({ createWithdrawalSimulation, SimulationError });
