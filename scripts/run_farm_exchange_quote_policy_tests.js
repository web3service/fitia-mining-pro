#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const ethers = require('../vendor/ethers.umd.min.js');
const Protocol = require('../farm-exchange-protocol');
const Policy = require('../farm-exchange-quote-policy');
(async () => {
  const wallet = ethers.Wallet.createRandom(); const treasury = ethers.Wallet.createRandom().address;
  const q = { wallet: wallet.address, quoteId: crypto.randomUUID(), direction: 'withdraw', coins: '1000', amountUnits: '500000000', rateUnits: '50000000', rateVersion: 3, issuedAt: 1000000, expiresAt: 1100000 };
  const sign = item => wallet.signMessage(Protocol.message(item));
  const signature = await sign(q);
  assert.strictEqual(Policy.checkWithdrawal(q, signature, 3, 1050000).amountUnits, '500000000');
  assert.throws(() => Policy.checkWithdrawal(q, signature, 4, 1050000), e => e.code === 'QUOTE_RATE_CHANGED');
  assert.throws(() => Policy.checkWithdrawal(q, signature, 3, q.expiresAt), e => e.code === 'QUOTE_EXPIRED');
  assert.throws(() => Policy.checkWithdrawal(q, signature, 3, q.issuedAt - 1), e => e.code === 'QUOTE_EXPIRED');
  assert.throws(() => Policy.checkWithdrawal({ ...q, rateVersion: 4 }, signature, 4, 1050000), e => e.code === 'QUOTE_AUTH');
  const deposit = { ...q, direction: 'deposit', quoteId: crypto.randomUUID() }; const depSig = await sign(deposit);
  const receipt = { confirmed: true, from: wallet.address, to: treasury, amountUnits: deposit.amountUnits, txHash: `0x${'ab'.repeat(32)}`, logIndex: 7, blockTimeMs: 1050000 };
  assert.strictEqual(Policy.checkDeposit(deposit, depSig, receipt, treasury).status, 'eligible');
  assert.strictEqual(Policy.checkDeposit(deposit, depSig, { ...receipt, blockTimeMs: deposit.expiresAt }, treasury).status, 'refund_required');
  assert.throws(() => Policy.checkDeposit(deposit, depSig, { ...receipt, blockTimeMs: deposit.issuedAt - 1 }, treasury), e => e.code === 'QUOTE_PAYMENT_BEFORE_ISSUE');
  for (const alteration of [{ confirmed: false }, { amountUnits: '1' }, { from: treasury }, { to: wallet.address }, { txHash: 'bad' }, { logIndex: -1 }]) {
    assert.throws(() => Policy.checkDeposit(deposit, depSig, { ...receipt, ...alteration }, treasury), e => e.code === 'QUOTE_PAYMENT_MISMATCH');
  }
  console.log('Devis : expiration, taux modifié, paiement vérifié et transfert tardif à rapprocher OK (simulation)');
})().catch(e => { console.error(e); process.exitCode = 1; });
