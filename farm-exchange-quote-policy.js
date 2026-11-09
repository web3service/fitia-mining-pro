'use strict';
// Pure pre-commit checks for future quote integration. This does not persist,
// verify Polygon receipts, transfer FTA, credit coins, or activate a rate.
const ethers = require('./vendor/ethers.umd.min.js');
const Protocol = require('./farm-exchange-protocol');
class QuoteError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function authenticatedQuote(input, signature, direction) {
  let quote;
  try { quote = Protocol.normalize(input); } catch (_) { throw new QuoteError('QUOTE_INVALID'); }
  if (quote.direction !== direction || !Protocol.verify(quote, signature)) throw new QuoteError('QUOTE_AUTH');
  return quote;
}
function checkWithdrawal(quoteInput, signature, currentVersion, now) {
  const quote = authenticatedQuote(quoteInput, signature, 'withdraw');
  if (!Number.isSafeInteger(now) || now < quote.issuedAt || now >= quote.expiresAt) throw new QuoteError('QUOTE_EXPIRED');
  if (!Number.isSafeInteger(currentVersion) || currentVersion !== quote.rateVersion) throw new QuoteError('QUOTE_RATE_CHANGED');
  return { quote, coins: quote.coins, amountUnits: quote.amountUnits, rateVersion: quote.rateVersion };
}
function checkDeposit(quoteInput, signature, receipt, treasury) {
  const quote = authenticatedQuote(quoteInput, signature, 'deposit');
  // receipt must come from a server-side chain verifier with sufficient confirmations;
  // a client-submitted object or transaction hash alone is never evidence.
  if (!receipt || receipt.confirmed !== true || !ethers.isAddress(treasury) || !ethers.isAddress(receipt.from)
      || !ethers.isAddress(receipt.to) || receipt.from.toLowerCase() !== quote.wallet
      || receipt.to.toLowerCase() !== treasury.toLowerCase() || receipt.amountUnits !== quote.amountUnits
      || typeof receipt.txHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(receipt.txHash)
      || !Number.isSafeInteger(receipt.logIndex) || receipt.logIndex < 0 || !Number.isSafeInteger(receipt.blockTimeMs)) throw new QuoteError('QUOTE_PAYMENT_MISMATCH');
  if (receipt.blockTimeMs < quote.issuedAt) throw new QuoteError('QUOTE_PAYMENT_BEFORE_ISSUE');
  // A late, valid transfer must never be silently discarded or credited at a
  // surprise rate. It needs a durable refund/reconciliation workflow.
  return { quote, txHash: receipt.txHash.toLowerCase(), logIndex: receipt.logIndex, status: receipt.blockTimeMs >= quote.expiresAt ? 'refund_required' : 'eligible' };
}
module.exports = Object.freeze({ QuoteError, checkWithdrawal, checkDeposit });
