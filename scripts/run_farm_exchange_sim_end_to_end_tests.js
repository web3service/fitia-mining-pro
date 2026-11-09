'use strict';
const assert = require('assert');
const ethers = require('../vendor/ethers.umd.min.js');
const { createQuoteSimulation } = require('../farm-exchange-quote-simulation');
const { createWithdrawalSimulation } = require('../farm-exchange-withdrawal-simulation');
const Protocol = require('../farm-exchange-protocol');
(async () => {
  const wallet = ethers.Wallet.createRandom(), quotes = new Map(), withdrawals = new Map(); let balance = 1000, version = 1;
  const repo = {
    getRate: async () => ({ rateUnits: version === 1 ? '100000000' : '50000000', version, enabled: false }),
    createQuote: async q => { if (q.rateVersion !== version) throw Error('RATE_CHANGED'); quotes.set(q.quoteId, q); },
    getQuote: async id => quotes.get(id),
    simulateWithdrawal: async (id, owner) => {
      const q = quotes.get(id); if (withdrawals.has(id)) return withdrawals.get(id);
      if (q.wallet !== owner || q.rateVersion !== version) throw Error('RATE_CHANGED');
      if (balance < Number(q.coins)) throw Error('BALANCE');
      balance -= Number(q.coins); const result = { status: 'simulated', amountUnits: q.amountUnits }; withdrawals.set(id, result); return result;
    }
  };
  const issue = createQuoteSimulation(repo, { now: () => 1700000000000 }); const sim = createWithdrawalSimulation(repo);
  const first = await issue.issue({ wallet: wallet.address, direction: 'withdraw', coins: '1000' });
  const second = await issue.issue({ wallet: wallet.address, direction: 'withdraw', coins: '1000' });
  const signatures = await Promise.all([wallet.signMessage(Protocol.message(first)), wallet.signMessage(Protocol.message(second))]);
  const results = await Promise.allSettled([sim.withdraw(first.quoteId, signatures[0]), sim.withdraw(second.quoteId, signatures[1])]);
  assert.strictEqual(results.filter(r => r.status === 'fulfilled').length, 1); assert.strictEqual(balance, 0); assert.strictEqual(withdrawals.size, 1);
  const winner = withdrawals.has(first.quoteId) ? [first, signatures[0]] : [second, signatures[1]];
  version = 2; const replay = await sim.withdraw(winner[0].quoteId, winner[1]);
  assert.strictEqual(replay.amountUnits, '1000000000'); assert.strictEqual(balance, 0);
  console.log('Parcours de retrait simulé : deux demandes, un débit, montant antérieur préservé (stockage mémoire)');
})().catch(e => { console.error(e); process.exitCode = 1; });
