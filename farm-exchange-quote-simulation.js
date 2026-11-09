'use strict';
// No API or production wiring. Caller must authenticate the wallet before issue.
const crypto = require('crypto');
const ethers = require('./vendor/ethers.umd.min.js');
const Exchange = require('./farm-exchange');
const Protocol = require('./farm-exchange-protocol');
const Config = require('./farm-config');
class QuoteSimulationError extends Error { constructor(code) { super(code); this.code = code; } }
function createQuoteSimulation(repository, options = {}) {
  if (!repository || typeof repository.getRate !== 'function' || typeof repository.createQuote !== 'function' || typeof repository.getQuote !== 'function') throw new TypeError('Simulation repository required');
  const clock = options.now || Date.now;
  const makeId = options.makeId || crypto.randomUUID;
  const ttl = options.ttlMs === undefined ? 5 * 60 * 1000 : options.ttlMs;
  if (!Number.isSafeInteger(ttl) || ttl < 1000 || ttl > 15 * 60 * 1000) throw new TypeError('Invalid simulation TTL');
  return Object.freeze({
    async issue(input) {
      if (!input || !ethers.isAddress(input.wallet) || !['deposit', 'withdraw'].includes(input.direction) || typeof input.coins !== 'string' || input.coins.length > 10) throw new QuoteSimulationError('SIM_QUOTE_PARAMS');
      if (input.direction === 'withdraw' && (!/^[1-9][0-9]*$/.test(input.coins) || BigInt(input.coins) < BigInt(Config.MIN_WITHDRAW_COINS) || BigInt(input.coins) > BigInt(Config.MAX_WITHDRAW_COINS) || BigInt(input.coins) % BigInt(Config.COINS_PER_FTA) !== 0n)) throw new QuoteSimulationError('SIM_QUOTE_LIMIT');
      const rate = await repository.getRate();
      if (!rate || rate.enabled !== false || !Number.isSafeInteger(rate.version) || rate.version < 1) throw new QuoteSimulationError('SIM_QUOTE_RATE');
      let amountUnits;
      try { amountUnits = Exchange.coinsToUnits(input.coins, rate.rateUnits); } catch (_) { throw new QuoteSimulationError('SIM_QUOTE_AMOUNT'); }
      const now = clock();
      let intended;
      try { intended = Protocol.normalize({ quoteId: makeId(), wallet: input.wallet, direction: input.direction, coins: input.coins, amountUnits, rateUnits: rate.rateUnits, rateVersion: rate.version, issuedAt: now, expiresAt: now + ttl }); }
      catch (_) { throw new QuoteSimulationError('SIM_QUOTE_PARAMS'); }
      // SQL copies the rate under a shared lock and rejects a stale version.
      await repository.createQuote(intended);
      let stored;
      try { stored = Protocol.normalize(await repository.getQuote(intended.quoteId)); } catch (_) { throw new QuoteSimulationError('SIM_QUOTE_STORAGE'); }
      if (Protocol.message(stored) !== Protocol.message(intended)) throw new QuoteSimulationError('SIM_QUOTE_STORAGE');
      return stored;
    }
  });
}
module.exports = Object.freeze({ createQuoteSimulation, QuoteSimulationError });
