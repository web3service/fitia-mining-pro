'use strict';
// Real-account deposit preparation. No production route or activation exists.
const FarmProtocol = require('./farm-protocol');
const QuoteProtocol = require('./farm-exchange-protocol');
const DepositProtocol = require('./farm-live-deposit-protocol');
const { inspectDeposit } = require('./farm-exchange-receipt');
const Config = require('./farm-config');
class LiveDepositError extends Error { constructor(code) { super(code); this.code = code; } }
function createLiveDepositService(repository, provider, options = {}) {
  if (!repository || typeof repository.createQuote !== 'function' || typeof repository.getQuote !== 'function' || typeof repository.recordDeposit !== 'function' || !provider) throw new TypeError('Storage and trusted provider required');
  const now = options.now || Date.now;
  const confirmations = options.confirmations === undefined ? 128 : options.confirmations;
  return Object.freeze({
    async issue(input) {
      let message, wallet, id;
      try {
        if (!input || !Number.isSafeInteger(input.timestamp) || !Number.isSafeInteger(now()) || Math.abs(now() - input.timestamp) > 600000) throw Error('timestamp');
        wallet = FarmProtocol.normalizeBuyer(input.wallet); id = FarmProtocol.requireUuid(input.quoteId);
        message = DepositProtocol.quoteRequest(input);
        if (!DepositProtocol.verify(message,input.signature,wallet)) throw Error('signature');
      } catch (_) { throw new LiveDepositError('LIVE_DEPOSIT_AUTH'); }
      const raw = await repository.createQuote(id,wallet,input.coins); let quote;
      try { quote = QuoteProtocol.normalize(raw); } catch (_) { throw new LiveDepositError('LIVE_DEPOSIT_STORAGE'); }
      if (quote.wallet !== wallet || quote.quoteId !== id || quote.direction !== 'deposit' || quote.coins !== String(input.coins)) throw new LiveDepositError('LIVE_DEPOSIT_STORAGE');
      return quote;
    },
    async submit(input) {
      let id, eventId, txHash, wallet, message;
      try {
        if (!input) throw Error('request');
        id=FarmProtocol.requireUuid(input.quoteId); eventId=FarmProtocol.requireUuid(input.eventId); txHash=FarmProtocol.requireTxHash(input.txHash);
        wallet=FarmProtocol.normalizeBuyer(input.wallet); message=DepositProtocol.submitRequest(input);
        if (!DepositProtocol.verify(message,input.submissionSignature,wallet)) throw Error('signature');
      } catch (_) { throw new LiveDepositError('LIVE_DEPOSIT_AUTH'); }
      let q;
      try { q = QuoteProtocol.normalize(await repository.getQuote(id)); } catch (_) { throw new LiveDepositError('LIVE_DEPOSIT_QUOTE'); }
      if (q.quoteId !== id || q.direction !== 'deposit' || q.wallet !== wallet || !QuoteProtocol.verify(q,input.quoteSignature)) throw new LiveDepositError('LIVE_DEPOSIT_AUTH');
      // Only this server-supplied provider may produce proof. Client data is
      // never accepted as a receipt, amount, block time or confirmation count.
      const receipt = await inspectDeposit(provider,txHash,input.logIndex,{from:q.wallet,to:Config.TREASURY_ADDRESS,amountUnits:q.amountUnits},confirmations);
      if (receipt.status === 'pending') return { status:'pending' };
      return repository.recordDeposit(q.quoteId,eventId,q.wallet,receipt);
    }
  });
}
class SupabaseLiveDepositRepository {
  constructor(storage) { if (!storage || typeof storage.request !== 'function') throw new TypeError('FARM storage required'); this.storage=storage; }
  createQuote(id,wallet,coins) { return this.storage.request('POST','rpc/farm_live_create_deposit_quote',{p_id:id,p_wallet:wallet,p_coins:coins}); }
  getQuote(id) { return this.storage.request('POST','rpc/farm_live_get_deposit_quote',{p_id:id}); }
  recordDeposit(id,eventId,wallet,proof) { return this.storage.request('POST','rpc/farm_live_record_deposit',{
    p_quote_id:id,p_event_id:eventId,p_wallet:wallet,p_tx_hash:proof.txHash,p_log_index:proof.logIndex,
    p_block_number:proof.blockNumber,p_block_hash:proof.blockHash,p_block_time_ms:proof.blockTimeMs
  }); }
}
module.exports = Object.freeze({ createLiveDepositService, SupabaseLiveDepositRepository, LiveDepositError });
