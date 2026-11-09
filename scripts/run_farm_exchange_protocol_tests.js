#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const ethers = require('../vendor/ethers.umd.min.js');
const Protocol = require('../farm-exchange-protocol');
(async () => {
  const wallet = ethers.Wallet.createRandom();
  const q = { wallet: wallet.address, quoteId: crypto.randomUUID(), direction: 'withdraw', coins: '1000', amountUnits: '500000000', rateUnits: '50000000', rateVersion: 3, issuedAt: 1799999400000, expiresAt: 1800000000000 };
  const sig = await wallet.signMessage(Protocol.message(q));
  assert.ok(Protocol.verify(q, sig));
  for (const mutation of [
    { wallet: ethers.Wallet.createRandom().address }, { quoteId: crypto.randomUUID() }, { direction: 'deposit' },
    { coins: '2000', amountUnits: '1000000000' }, { rateUnits: '100000000', amountUnits: '1000000000' },
    { rateVersion: 4 }, { issuedAt: q.issuedAt + 1 }, { expiresAt: q.expiresAt + 1 }
  ]) assert.strictEqual(Protocol.verify({ ...q, ...mutation }, sig), false);
  for (const mutation of [{ coins: '10' }, { amountUnits: '1' }, { rateUnits: '0' }, { rateUnits: '01' }, { direction: 'other' }, { expiresAt: -1 }, { rateVersion: 0 }, { quoteId: 'bad' }]) {
    assert.throws(() => Protocol.normalize({ ...q, ...mutation }));
  }
  assert.strictEqual(Protocol.verify(q, 'invalid'), false);
  const d = { ...q, direction: 'deposit', quoteId: crypto.randomUUID() };
  assert.ok(Protocol.verify(d, await wallet.signMessage(Protocol.message(d))));
  console.log('Devis : signature lie portefeuille, sens, taux, version, montant et échéance ; modifications rejetées');
})().catch(e => { console.error(e); process.exitCode = 1; });
