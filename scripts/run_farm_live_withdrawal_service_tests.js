'use strict';
const assert = require('assert');
const crypto = require('crypto');
const ethers = require('../vendor/ethers.umd.min.js');
const FarmProtocol = require('../farm-protocol');
const QuoteProtocol = require('../farm-exchange-protocol');
const { createLiveWithdrawalService, SupabaseLiveWithdrawalRepository } = require('../farm-live-withdrawal');
(async () => {
  const wallet = ethers.Wallet.createRandom(), id = crypto.randomUUID(), now = 1700000000000;
  const request = { buyer: wallet.address, timestamp: now, actionId: id, coins: 1000 };
  request.signature = await wallet.signMessage(FarmProtocol.message('withdraw', request));
  const quote = { quoteId:id, wallet:wallet.address.toLowerCase(), direction:'withdraw', coins:'1000', amountUnits:'500000000', rateUnits:'50000000', rateVersion:2, issuedAt:now, expiresAt:now+300000 };
  const calls = []; let existing = null, mfaAllowed = false, storedQuote = quote;
  const repository = new SupabaseLiveWithdrawalRepository({
    async request(method, path, body) { calls.push({method,path,body}); if(path.endsWith('create_withdraw_quote')) return quote; if(path.endsWith('get_withdraw_quote')) return storedQuote; if(path.endsWith('live_withdraw')) { existing = {id,wallet:quote.wallet,coins:1000,ftaUnits:'500000000',status:'pending'}; return existing; } throw Error('unexpected'); },
    async getWithdrawal() { return existing; }
  });
  let guardCount = 0;
  const service = createLiveWithdrawalService(repository, async input => { guardCount++; assert.strictEqual(input.wallet,quote.wallet); assert.strictEqual(input.actionId,id); assert.strictEqual(input.coins,1000); if (!mfaAllowed || input.code !== '123456') throw Error('MFA_REQUIRED'); }, { now: () => now });
  assert.deepStrictEqual(await service.issue(request), quote);
  await assert.rejects(service.issue({ ...request, coins: 1100 }), e => e.code==='LIVE_AUTH');
  await assert.rejects(service.issue({ ...request, timestamp: now - 600001 }), e => e.code==='LIVE_AUTH');
  const sig = await wallet.signMessage(QuoteProtocol.message(quote));
  await assert.rejects(service.withdraw(id, 'wrong', '123456'), e => e.code==='LIVE_AUTH');
  await assert.rejects(service.withdraw(id, sig, ''), /MFA_REQUIRED/);
  assert.strictEqual(calls.filter(c => c.path.endsWith('live_withdraw')).length,0);
  mfaAllowed = true;
  assert.strictEqual((await service.withdraw(id,sig,'123456')).ftaUnits,'500000000');
  assert.strictEqual((await service.withdraw(id,sig,'')).ftaUnits,'500000000');
  assert.strictEqual(guardCount,2);
  await assert.rejects(service.withdraw(id,'wrong',''), e => e.code==='LIVE_AUTH');
  storedQuote = { ...quote, amountUnits:'1000000000', rateUnits:'100000000' };
  await assert.rejects(service.withdraw(id,sig,''), e => e.code==='LIVE_AUTH');
  assert.deepStrictEqual(calls.find(c => c.path.endsWith('live_withdraw')).body,{ p_id:id, p_wallet:quote.wallet });
  assert.throws(() => createLiveWithdrawalService(repository,null));
  console.log('Retrait réel préparé : wallet signé, devis vérifié, garde MFA et reprise sans double débit');
})().catch(e => { console.error(e); process.exitCode = 1; });
