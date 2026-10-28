#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const ethers = require('../vendor/ethers.umd.min.js');
const Config = require('../farm-config');
const Protocol = require('../farm-protocol');
const { createFarmHandler } = require('../api/farm');
const { createAdminHandler } = require('../api/admin');
const {
  FarmError, MemoryFarmRepository, SupabaseFarmRepository, createFarmService, validateTransferReceipt
} = require('../farm-service');

let passed = 0; let failed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); }
}
const wallet = new ethers.Wallet(`0x${'11'.repeat(32)}`);
const otherWallet = new ethers.Wallet(`0x${'22'.repeat(32)}`);
const buyer = wallet.address.toLowerCase();
let nowMs = Date.parse('2026-10-28T12:00:00.000Z');
let verification = { confirmed: true };
const repository = new MemoryFarmRepository();
const service = createFarmService({ repository, now: () => new Date(nowMs), paymentVerifier: async () => verification });
const hash = () => `0x${crypto.randomBytes(32).toString('hex')}`;
async function signed(action, signer, params = {}) {
  const body = { action, buyer: signer.address, timestamp: nowMs, ...params };
  body.signature = await signer.signMessage(Protocol.message(action, body));
  return body;
}
const actionId = () => crypto.randomUUID();
async function callAction(type, params = {}, signer = wallet) {
  return service.action(await signed('action', signer, { actionId: actionId(), type, params }));
}
async function deposit(amountFta = '10', signer = wallet, txHash = hash(), id = actionId()) {
  const amountUnits = ethers.parseUnits(amountFta, 8).toString();
  return service.deposit(await signed('deposit', signer, { actionId: id, txHash, amountUnits }));
}
async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error.code === code || String(error.message).includes(code));
}

(async () => {
  console.log('\n🚜  TESTS FITIA FARM\n' + '═'.repeat(68));
  await test('Compte signé : état initial privé et signature falsifiée refusée', async () => {
    const initial = await service.getState(await signed('state', wallet));
    assert.strictEqual(initial.state.coins, 0);
    assert.strictEqual(initial.state.land, null);
    const forged = await signed('state', wallet);
    forged.buyer = otherWallet.address;
    await expectCode(service.getState(forged), 'FARM_AUTH');
    assert.strictEqual(forged.state, undefined);
  });

  await test('Dépôt FTA : attente, confirmation, 100 coins/FTA et aucune double créditation', async () => {
    verification = { confirmed: false };
    const id = actionId(); const txHash = hash(); const amountUnits = ethers.parseUnits('5', 8).toString();
    const pending = await service.deposit(await signed('deposit', wallet, { actionId: id, txHash, amountUnits }));
    assert.strictEqual(pending.pending, true);
    assert.strictEqual(pending.state.coins, 0);
    verification = { confirmed: true };
    const confirmed = await service.deposit(await signed('deposit', wallet, { actionId: id, txHash, amountUnits }));
    assert.strictEqual(confirmed.pending, false);
    assert.strictEqual(confirmed.state.coins, 500);
    const repeated = await service.deposit(await signed('deposit', wallet, { actionId: id, txHash, amountUnits }));
    assert.strictEqual(repeated.state.coins, 500);
  });

  await test('Démarrage : terrain et animal obligatoires, prix débités et production verrouillée', async () => {
    await expectCode(callAction('plant', { species: 'wheat' }), 'FARM_NOT_STARTED');
    const land = await callAction('buy_land');
    assert.strictEqual(land.state.land.owned, true);
    assert.strictEqual(land.state.coins, 0);
    await expectCode(callAction('buy_animal', { species: 'chicken' }), 'FARM_INSUFFICIENT_COINS');
    await deposit('10');
    await expectCode(callAction('plant', { species: 'wheat' }), 'FARM_NOT_STARTED');
    const started = await callAction('buy_animal', { species: 'chicken' });
    assert.strictEqual(started.state.animals.length, 1);
    assert.strictEqual(started.state.coins, 750);
  });

  await test('Élevage : nourrissage, temps réel, collecte et interdiction de double production', async () => {
    let result = await callAction('buy_feed');
    assert.strictEqual(result.state.feed, 5);
    const animalId = result.state.animals[0].id;
    result = await callAction('feed', { animalId });
    assert.ok(result.state.animals[0].produceAt > nowMs);
    await expectCode(callAction('feed', { animalId }), 'FARM_NOT_READY');
    await expectCode(callAction('collect', { animalId }), 'FARM_NOT_READY');
    nowMs += Config.ANIMALS.chicken.durationMs;
    result = await callAction('collect', { animalId });
    assert.strictEqual(result.state.inventory.eggs, 1);
    assert.strictEqual(result.state.animals[0].produceAt, 0);
  });

  await test('Cultures et vente : blé, carotte, récolte et conversion en coins', async () => {
    await callAction('plant', { species: 'wheat' });
    await callAction('plant', { species: 'carrot' });
    nowMs += Config.CROPS.carrot.durationMs;
    let result = await callAction('harvest', { cropId: (await service.view(buyer)).state.crops.find((crop) => crop.species === 'wheat').id });
    assert.strictEqual(result.state.inventory.wheat, 2);
    result = await callAction('harvest', { cropId: result.state.crops[0].id });
    assert.strictEqual(result.state.inventory.carrot, 2);
    const before = result.state.coins;
    result = await callAction('sell');
    assert.strictEqual(result.state.coins, before + 30 + 24 + 36);
    assert.ok(Object.values(result.state.inventory).every((quantity) => quantity === 0));
  });

  await test('Retrait FTA : débit atomique, demande persistante et rejet des montants invalides', async () => {
    const before = (await service.view(buyer)).state.coins;
    const id = actionId();
    const result = await service.withdraw(await signed('withdraw', wallet, { actionId: id, coins: 100 }));
    assert.strictEqual(result.state.coins, before - 100);
    assert.strictEqual(result.withdrawals[0].id, id);
    assert.strictEqual(result.withdrawals[0].status, 'pending');
    assert.strictEqual(result.withdrawals[0].ftaUnits, '100000000');
    const repeated = await service.withdraw(await signed('withdraw', wallet, { actionId: id, coins: 100 }));
    assert.strictEqual(repeated.state.coins, before - 100);
    await expectCode(service.withdraw(await signed('withdraw', wallet, { actionId: actionId(), coins: 99 })), 'FARM_AMOUNT');
    await expectCode(service.withdraw(await signed('withdraw', wallet, { actionId: actionId(), coins: 100 })), 'FARM_WITHDRAWAL_PENDING');
  });

  await test('Clôture du retrait : preuve exacte treasury → wallet puis statut paid', async () => {
    const withdrawal = (await service.view(buyer)).withdrawals[0];
    verification = { confirmed: false };
    const pending = await service.completeWithdrawal({ id: withdrawal.id, txHash: hash() });
    assert.strictEqual(pending.pending, true);
    const txHash = hash(); verification = { confirmed: true };
    const paid = await service.completeWithdrawal({ id: withdrawal.id, txHash });
    assert.strictEqual(paid.withdrawal.status, 'paid');
    assert.strictEqual(paid.withdrawal.payoutTxHash, txHash);
    const repeated = await service.completeWithdrawal({ id: withdrawal.id, txHash });
    assert.strictEqual(repeated.withdrawal.status, 'paid');
    await expectCode(service.withdraw(await signed('withdraw', wallet, { actionId: actionId(), coins: 100 })), 'FARM_WITHDRAWAL_COOLDOWN');
  });

  await test('Une transaction de dépôt ne peut pas être réutilisée par un autre wallet', async () => {
    const txHash = hash();
    await deposit('1', otherWallet, txHash);
    await expectCode(deposit('1', wallet, txHash), 'FARM_TX_USED');
  });

  await test('Un identifiant d’action ne peut pas être rejoué par un autre wallet', async () => {
    const sharedId = actionId();
    await deposit('1', wallet, hash(), sharedId);
    await expectCode(deposit('1', otherWallet, hash(), sharedId), 'FARM_CONFLICT');
    assert.strictEqual((await service.view(otherWallet.address.toLowerCase())).state.coins, 100);
  });

  await test('Reçu Polygon : token, expéditeur, destinataire, montant et trois confirmations', async () => {
    const expectation = { from: buyer, to: Config.TREASURY_ADDRESS, amountUnits: '100000000' };
    const log = {
      address: Config.FTA_CONTRACT,
      topics: [ethers.id('Transfer(address,address,uint256)'), ethers.zeroPadValue(buyer, 32), ethers.zeroPadValue(Config.TREASURY_ADDRESS, 32)],
      data: ethers.toBeHex(100000000n, 32)
    };
    assert.deepStrictEqual(validateTransferReceipt(expectation, { status: 1, blockNumber: 90, logs: [log] }, 92), { confirmed: true });
    assert.deepStrictEqual(validateTransferReceipt(expectation, { status: 1, blockNumber: 90, logs: [log] }, 91), { confirmed: false });
    await expectCode(Promise.resolve().then(() => validateTransferReceipt(expectation, { status: 1, blockNumber: 90, logs: [{ ...log, data: ethers.toBeHex(1n, 32) }] }, 92)), 'FARM_PAYMENT_MISMATCH');
    await expectCode(Promise.resolve().then(() => validateTransferReceipt(expectation, { status: 0, blockNumber: 90, logs: [log] }, 92)), 'FARM_PAYMENT_FAILED');
  });

  await test('API client : OPTIONS, 202 en attente, signature obligatoire et aucune donnée sensible', async () => {
    const server = http.createServer(createFarmHandler({ farmService: service }));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const preflight = await fetch(`${base}/api/farm`, { method: 'OPTIONS' });
      assert.strictEqual(preflight.status, 204);
      const unauthorized = await fetch(`${base}/api/farm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'state' }) });
      assert.strictEqual(unauthorized.status, 401);
      const response = await fetch(`${base}/api/farm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await signed('state', wallet)) });
      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(data.state && Array.isArray(data.withdrawals));
      assert.ok(!JSON.stringify(data).includes('privateKey'));
      verification = { confirmed: false };
      const pending = await fetch(`${base}/api/farm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await signed('deposit', wallet, { actionId: actionId(), txHash: hash(), amountUnits: '100000000' })) });
      assert.strictEqual(pending.status, 202);
      verification = { confirmed: true };
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });

  await test('API admin FARM : session obligatoire, CSRF, attente puis clôture du retrait', async () => {
    nowMs += Config.WITHDRAWAL_COOLDOWN_MS;
    const created = await service.withdraw(await signed('withdraw', wallet, { actionId: actionId(), coins: 100 }));
    const withdrawal = created.withdrawals[0];
    const oldPassword = process.env.FITIA_ADMIN_PASSWORD; const oldToken = process.env.FITIA_GITHUB_TOKEN;
    process.env.FITIA_ADMIN_PASSWORD = 'farm-admin-test-password'; process.env.FITIA_GITHUB_TOKEN = 'test-only-token';
    const server = http.createServer(createAdminHandler({ farmService: service }));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/admin`;
    try {
      const unauthorized = await fetch(`${base}/farm-withdrawals`);
      assert.strictEqual(unauthorized.status, 401);
      const login = await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'farm-admin-test-password' }) });
      assert.strictEqual(login.status, 200);
      const session = await login.json(); const cookie = login.headers.get('set-cookie').split(';')[0];
      const headers = { Cookie: cookie, 'Content-Type': 'application/json' };
      const list = await fetch(`${base}/farm-withdrawals`, { headers });
      assert.strictEqual(list.status, 200); assert.ok((await list.json()).withdrawals.some((item) => item.id === withdrawal.id));
      const body = JSON.stringify({ id: withdrawal.id, txHash: hash() });
      const noCsrf = await fetch(`${base}/farm-withdrawals`, { method: 'PATCH', headers, body });
      assert.strictEqual(noCsrf.status, 403);
      verification = { confirmed: false };
      const pending = await fetch(`${base}/farm-withdrawals`, { method: 'PATCH', headers: { ...headers, 'X-CSRF-Token': session.csrfToken }, body });
      assert.strictEqual(pending.status, 202);
      verification = { confirmed: true };
      const paid = await fetch(`${base}/farm-withdrawals`, { method: 'PATCH', headers: { ...headers, 'X-CSRF-Token': session.csrfToken }, body });
      assert.strictEqual(paid.status, 200); assert.strictEqual((await paid.json()).withdrawal.status, 'paid');
    } finally {
      verification = { confirmed: true };
      if (oldPassword === undefined) delete process.env.FITIA_ADMIN_PASSWORD; else process.env.FITIA_ADMIN_PASSWORD = oldPassword;
      if (oldToken === undefined) delete process.env.FITIA_GITHUB_TOKEN; else process.env.FITIA_GITHUB_TOKEN = oldToken;
      await new Promise((resolve) => server.close(resolve));
    }
  });

  await test('Révision concurrente : une ancienne version ne peut pas écraser le compte', async () => {
    const record = await repository.get(buyer);
    await expectCode(repository.apply(buyer, 0, record.state, actionId(), 'buy_land'), 'FARM_REVISION');
  });

  await test('Client Supabase : apikey secret et appels RPC atomiques sans JWT legacy', async () => {
    const calls = [];
    const repo = new SupabaseFarmRepository({ url: 'https://example-project.supabase.co', key: 'sb_secret_test-only-not-a-real-key' });
    const originalFetch = global.fetch;
    global.fetch = async (url, init) => {
      calls.push({ url, init });
      if (String(url).includes('rpc/farm_apply')) return { ok: true, status: 200, text: async () => '' };
      return { ok: true, status: 200, text: async () => JSON.stringify([{ state: { wallet: buyer, coins: 0 }, revision: 1 }]) };
    };
    try {
      await repo.apply(buyer, 0, { wallet: buyer, coins: 0 }, actionId(), 'buy_land');
      assert.ok(calls[0].url.includes('rpc/farm_apply'));
      assert.strictEqual(calls[0].init.headers.apikey, 'sb_secret_test-only-not-a-real-key');
      assert.strictEqual(calls[0].init.headers.Authorization, undefined);
    } finally { global.fetch = originalFetch; }
  });

  console.log('═'.repeat(68));
  console.log(`📊 RÉSULTAT FARM : ${passed} réussis, ${failed} échoués`);
  if (failed) process.exit(1);
})().catch((error) => { console.error(error); process.exit(1); });
