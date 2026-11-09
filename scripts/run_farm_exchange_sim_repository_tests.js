'use strict';
const assert = require('assert');
const crypto = require('crypto');
const ethers = require('../vendor/ethers.umd.min.js');
const Protocol = require('../farm-exchange-protocol');
const { createWithdrawalSimulation } = require('../farm-exchange-withdrawal-simulation');
const { SupabaseExchangeSimulationRepository } = require('../farm-exchange-simulation-repository');
(async () => {
  const wallet = ethers.Wallet.createRandom();
  const q = { quoteId: crypto.randomUUID(), wallet: wallet.address.toLowerCase(), direction: 'withdraw', coins: '1000', amountUnits: '9999999999999999000', rateUnits: '999999999999999900', rateVersion: 1, issuedAt: 1000, expiresAt: 2000 };
  // Legal maximum rate and large exact amount, returned as text without JS rounding.
  q.coins = '1000000'; q.rateUnits = '999999999999999'; q.amountUnits = '9999999999999990000';
  const calls = [];
  const repository = new SupabaseExchangeSimulationRepository({ request: async (method, path, data) => {
    calls.push({ method, path, data });
    if (path === 'rpc/farm_exchange_sim_get_quote') return q;
    if (path === 'rpc/farm_exchange_sim_withdraw') return { status: 'simulated', amount_units: q.amountUnits };
    throw Error('Unexpected request');
  } });
  const sim = createWithdrawalSimulation(repository);
  const signature = await wallet.signMessage(Protocol.message(q));
  const response = await sim.withdraw(q.quoteId, signature);
  assert.strictEqual(response.amount_units, '9999999999999990000');
  assert.deepStrictEqual(calls[1].data, { p_quote_id: q.quoteId, p_wallet: q.wallet });
  assert.strictEqual(await repository.getQuote('bad'), null); assert.strictEqual(calls.length, 2);
  await assert.rejects(sim.withdraw(q.quoteId, 'invalid'), e => e.code === 'SIM_AUTH');
  assert.strictEqual(calls.length, 3);
  console.log('Adaptateur Supabase isolé : lecture exacte du devis et retrait simulé authentifié OK');
})().catch(e => { console.error(e); process.exitCode = 1; });
