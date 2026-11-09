'use strict';
const assert = require('assert');
const crypto = require('crypto');
const ethers = require('../vendor/ethers.umd.min.js');
const { createQuoteSimulation } = require('../farm-exchange-quote-simulation');
const { SupabaseExchangeSimulationRepository } = require('../farm-exchange-simulation-repository');
(async () => {
  const wallet = ethers.Wallet.createRandom().address; let rate = { rate_units: 50000000, version: 2, enabled: false }, quote; let writes = 0, stale = false;
  const repo = new SupabaseExchangeSimulationRepository({ request: async (method, path, body) => {
    if (method === 'GET') return [rate];
    if (path === 'rpc/farm_exchange_create_quote_draft') {
      if (stale) throw Error('FARM_QUOTE_RATE_CHANGED'); writes++;
      quote = { quoteId: body.p_quote_id, wallet: body.p_wallet, direction: body.p_direction, coins: body.p_coins, amountUnits: body.p_amount_units, rateUnits: String(rate.rate_units), rateVersion: body.p_expected_version, issuedAt: body.p_issued_at_ms, expiresAt: body.p_expires_at_ms }; return {};
    }
    if (path === 'rpc/farm_exchange_sim_get_quote') return quote;
    throw Error('unexpected');
  } });
  const now = 1700000000000, id = crypto.randomUUID();
  const sim = createQuoteSimulation(repo, { now: () => now, makeId: () => id });
  const q = await sim.issue({ wallet, direction: 'withdraw', coins: '1000' });
  assert.strictEqual(q.amountUnits, '500000000'); assert.strictEqual(q.expiresAt, now + 300000); assert.strictEqual(q.wallet, wallet.toLowerCase());
  await assert.rejects(sim.issue({ wallet, direction: 'withdraw', coins: '900' }), e => e.code === 'SIM_QUOTE_LIMIT');
  await assert.rejects(sim.issue({ wallet, direction: 'withdraw', coins: '1101' }), e => e.code === 'SIM_QUOTE_LIMIT');
  await assert.rejects(sim.issue({ wallet, direction: 'deposit', coins: '0' }), e => e.code === 'SIM_QUOTE_AMOUNT');
  await assert.rejects(sim.issue({ wallet, direction: 'withdraw', coins: '9'.repeat(10000) }), e => e.code === 'SIM_QUOTE_PARAMS');
  rate = { ...rate, enabled: true }; await assert.rejects(sim.issue({ wallet, direction: 'deposit', coins: '100' }), e => e.code === 'SIM_QUOTE_RATE');
  rate = { ...rate, enabled: false, rate_units: 1 }; await assert.rejects(sim.issue({ wallet, direction: 'deposit', coins: '1' }), e => e.code === 'SIM_QUOTE_AMOUNT');
  rate = { ...rate, rate_units: 50000000 }; stale = true;
  await assert.rejects(sim.issue({ wallet, direction: 'deposit', coins: '100' }), /FARM_QUOTE_RATE_CHANGED/);
  assert.strictEqual(writes, 1);
  console.log('Création simulée de devis : montant exact, horloge serveur, limites et taux périmé');
})().catch(e => { console.error(e); process.exitCode = 1; });
