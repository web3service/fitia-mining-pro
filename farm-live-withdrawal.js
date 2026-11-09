'use strict';
// Prepared real withdrawal integration; no route or default service is installed.
// Database migration remains hard-disabled; do not deploy as an active exchange.
const ethers = require('./vendor/ethers.umd.min.js');
const FarmProtocol = require('./farm-protocol');
const QuoteProtocol = require('./farm-exchange-protocol');
class LiveWithdrawalError extends Error { constructor(code) { super(code); this.code = code; } }
function createLiveWithdrawalService(repository, withdrawalGuard, options = {}) {
  if (!repository || typeof repository.createQuote !== 'function' || typeof repository.getQuote !== 'function'
    || typeof repository.getWithdrawal !== 'function' || typeof repository.withdraw !== 'function' || typeof withdrawalGuard !== 'function') throw new TypeError('Storage and MFA guard required');
  const now = options.now || Date.now;
  return Object.freeze({
    async issue(body) {
      let wallet, id, coins;
      try {
        if (!body || !Number.isSafeInteger(body.timestamp) || !Number.isSafeInteger(now()) || Math.abs(now() - body.timestamp) > 600000) throw Error('timestamp');
        wallet = FarmProtocol.normalizeBuyer(body.buyer); id = FarmProtocol.requireUuid(body.actionId); coins = FarmProtocol.requireCoins(body.coins);
        if (ethers.verifyMessage(FarmProtocol.message('withdraw', body), String(body.signature || '')).toLowerCase() !== wallet) throw Error('signature');
      } catch (_) { throw new LiveWithdrawalError('LIVE_AUTH'); }
      // SQL generates timestamps, rate, amount, and checks the hard activation lock.
      const raw = await repository.createQuote(id, wallet, coins);
      let quote;
      try { quote = QuoteProtocol.normalize(raw); } catch (_) { throw new LiveWithdrawalError('LIVE_QUOTE_STORAGE'); }
      if (quote.quoteId !== id || quote.wallet !== wallet || quote.direction !== 'withdraw' || quote.coins !== String(coins)) throw new LiveWithdrawalError('LIVE_QUOTE_STORAGE');
      return quote;
    },
    async withdraw(id, signature, mfaCode) {
      let normalizedId;
      try { normalizedId = FarmProtocol.requireUuid(id); } catch (_) { throw new LiveWithdrawalError('LIVE_AUTH'); }
      let q;
      try { q = QuoteProtocol.normalize(await repository.getQuote(normalizedId)); } catch (_) { throw new LiveWithdrawalError('LIVE_QUOTE'); }
      if (q.quoteId !== normalizedId || q.direction !== 'withdraw' || !QuoteProtocol.verify(q, signature)) throw new LiveWithdrawalError('LIVE_AUTH');
      // A completed operation can be recovered after a lost response without
      // consuming another recovery code. Quote signature is still required.
      const previous = await repository.getWithdrawal(normalizedId);
      if (previous) {
        if (previous.wallet !== q.wallet || String(previous.coins) !== q.coins || previous.ftaUnits !== q.amountUnits) throw new LiveWithdrawalError('LIVE_CONFLICT');
        return previous;
      }
      await withdrawalGuard({ wallet: q.wallet, actionId: normalizedId, coins: Number(q.coins), code: mfaCode });
      // Database transaction checks rate version, expiry, balances and cooldown.
      return repository.withdraw(normalizedId, q.wallet);
    }
  });
}
class SupabaseLiveWithdrawalRepository {
  constructor(farmRepository) { if (!farmRepository || typeof farmRepository.request !== 'function' || typeof farmRepository.getWithdrawal !== 'function') throw new TypeError('FARM storage required'); this.storage = farmRepository; }
  createQuote(id, wallet, coins) { return this.storage.request('POST', 'rpc/farm_live_create_withdraw_quote', { p_id: id, p_wallet: wallet, p_coins: coins }); }
  getQuote(id) { return this.storage.request('POST', 'rpc/farm_live_get_withdraw_quote', { p_id: id }); }
  getWithdrawal(id) { return this.storage.getWithdrawal(id); }
  withdraw(id, wallet) { return this.storage.request('POST', 'rpc/farm_live_withdraw', { p_id: id, p_wallet: wallet }); }
}
module.exports = Object.freeze({ createLiveWithdrawalService, SupabaseLiveWithdrawalRepository, LiveWithdrawalError });
