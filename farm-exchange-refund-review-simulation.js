'use strict';
// Internal test preparation only; no public route, no authorization, no payout.
const { createRefundSimulation } = require('./farm-exchange-refund-simulation');
class RefundReviewError extends Error { constructor(code) { super(code); this.code = code; } }
function createRefundReviewSimulation(repository, provider, confirmations) {
  if (!repository || typeof repository.getReceipt !== 'function' || typeof repository.getQuote !== 'function' || typeof repository.recordSimulatedRefund !== 'function') throw new TypeError('Simulation repository required');
  const verifier = createRefundSimulation(provider, confirmations);
  return Object.freeze({
    async review(sourceTx, sourceIndex, payout) {
      const source = await repository.getReceipt(sourceTx, sourceIndex);
      if (!source || source.tx_hash !== sourceTx || source.log_index !== sourceIndex) throw new RefundReviewError('SIM_REFUND_SOURCE');
      const quote = await repository.getQuote(source.quote_id);
      const checked = await verifier.verify(quote, source, payout);
      if (checked.status !== 'verified_simulation_only') return checked;
      const saved = await repository.recordSimulatedRefund(checked.source, checked.payout);
      if (!saved || saved.status !== 'simulated_only') throw new RefundReviewError('SIM_REFUND_STORAGE');
      return saved;
    }
  });
}
module.exports = Object.freeze({ createRefundReviewSimulation, RefundReviewError });
