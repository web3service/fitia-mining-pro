'use strict';
// Verification-only simulation. Does not sign, send, record, or settle refunds.
const Protocol = require('./farm-exchange-protocol');
const Config = require('./farm-config');
const { inspectDeposit } = require('./farm-exchange-receipt');
class RefundSimulationError extends Error { constructor(code) { super(code); this.code = code; } }
function createRefundSimulation(provider, confirmations = 128) {
  if (!provider) throw new TypeError('Server provider required');
  return Object.freeze({
    async verify(quoteInput, source, payout) {
      let quote;
      try { quote = Protocol.normalize(quoteInput); } catch (_) { throw new RefundSimulationError('REFUND_QUOTE'); }
      if (quote.direction !== 'deposit' || !source || source.quote_id !== quote.quoteId || source.status !== 'refund_required'
          || !['late', 'duplicate_payment', 'before_issue'].includes(source.reason)
          || !payout || typeof payout.txHash !== 'string' || !Number.isSafeInteger(payout.logIndex)) throw new RefundSimulationError('REFUND_PARAMS');
      // Stored evidence is trusted only after a fresh canonical-chain check.
      const deposit = await inspectDeposit(provider, source.tx_hash, source.log_index,
        { from: quote.wallet, to: Config.TREASURY_ADDRESS, amountUnits: quote.amountUnits }, confirmations);
      if (deposit.status === 'pending') return { status: 'pending_source' };
      if (deposit.blockNumber !== source.block_number || deposit.blockHash !== source.block_hash || deposit.blockTimeMs !== source.block_time_ms) throw new RefundSimulationError('REFUND_SOURCE_CHANGED');
      if (deposit.txHash === payout.txHash.toLowerCase() && deposit.logIndex === payout.logIndex) throw new RefundSimulationError('REFUND_SAME_EVENT');
      const refund = await inspectDeposit(provider, payout.txHash, payout.logIndex,
        { from: Config.TREASURY_ADDRESS, to: quote.wallet, amountUnits: quote.amountUnits }, confirmations);
      if (refund.status === 'pending') return { status: 'pending_payout' };
      // Block/log order prevents an unrelated earlier transfer from masquerading as a refund.
      if (refund.blockNumber < deposit.blockNumber || (refund.blockNumber === deposit.blockNumber && refund.logIndex <= deposit.logIndex)) throw new RefundSimulationError('REFUND_PAYOUT_BEFORE_SOURCE');
      // No completion claim: durable uniqueness and payout reconciliation do not yet exist.
      return { status: 'verified_simulation_only', amountUnits: quote.amountUnits, recipient: quote.wallet,
        source: { txHash: deposit.txHash, logIndex: deposit.logIndex }, payout: { txHash: refund.txHash, logIndex: refund.logIndex, blockNumber: refund.blockNumber, blockHash: refund.blockHash, blockTimeMs: refund.blockTimeMs } };
    }
  });
}
module.exports = Object.freeze({ createRefundSimulation, RefundSimulationError });
