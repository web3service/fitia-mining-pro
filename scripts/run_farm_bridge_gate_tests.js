#!/usr/bin/env node
'use strict';
// Arrêt d'urgence du bridge historique (CONVERT/WITHDRAW FTA).
// Défaut : bridge ACTIF (comportement inchangé). Quand FITIA_FARM_BRIDGE_ENABLED=false,
// CONVERT et les nouvelles demandes de retrait sont refusés (503 FARM_BRIDGE_PAUSED),
// mais les retraits déjà en attente restent payables par l'admin et un dépôt déjà
// diffusé reste résoluble — voir docs/FITIA-FARM-BRIDGE-ARRET-URGENCE.md.
const assert = require('assert');
const crypto = require('crypto');
const ethers = require('../vendor/ethers.umd.min.js');
const Protocol = require('../farm-protocol');
const {
  MemoryFarmRepository, createFarmService
} = require('../farm-service');

let passed = 0; let failed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); }
}
const wallet = new ethers.Wallet(`0x${'33'.repeat(32)}`);
const buyer = wallet.address.toLowerCase();
const baseNow = Date.parse('2026-11-09T12:00:00.000Z');
const repository = new MemoryFarmRepository();
const service = createFarmService({
  repository,
  now: () => new Date(baseNow),
  randomInt: () => 0,
  paymentVerifier: async () => ({ confirmed: true })
});
const hash = () => `0x${crypto.randomBytes(32).toString('hex')}`;
const actionId = () => crypto.randomUUID();
async function signed(action, params = {}) {
  const body = { action, buyer: wallet.address, timestamp: baseNow, ...params };
  body.signature = await wallet.signMessage(Protocol.message(action, body));
  return body;
}
const amountUnits = (fta) => ethers.parseUnits(String(fta), 8).toString();
async function expectPaused(promise) {
  await assert.rejects(promise, (error) => error.code === 'FARM_BRIDGE_PAUSED' && error.status === 503);
}

(async () => {
  console.log('\n🔌  TESTS FITIA FARM — ARRÊT D’URGENCE DU BRIDGE\n' + '═'.repeat(68));

  await test('Défaut (drapeau absent) : le bridge est actif, CONVERT crédite les coins, features.bridgePaused=false', async () => {
    delete process.env.FITIA_FARM_BRIDGE_ENABLED;
    const result = await service.deposit(await signed('deposit', { actionId: actionId(), txHash: hash(), amountUnits: amountUnits(10) }));
    assert.strictEqual(result.pending, false);
    assert.strictEqual(result.state.coins, 1000);
    const view = await service.view(buyer);
    assert.strictEqual(view.features.bridgePaused, false);
  });

  await test('FITIA_FARM_BRIDGE_ENABLED=false : CONVERT refusé en 503 FARM_BRIDGE_PAUSED AVANT toute vérification on-chain', async () => {
    process.env.FITIA_FARM_BRIDGE_ENABLED = 'false';
    let verified = false;
    const spy = createFarmService({
      repository, now: () => new Date(baseNow), randomInt: () => 0,
      paymentVerifier: async () => { verified = true; return { confirmed: true }; }
    });
    await expectPaused(spy.deposit(await signed('deposit', { actionId: actionId(), txHash: hash(), amountUnits: amountUnits(10) })));
    assert.strictEqual(verified, false, 'le vérificateur on-chain ne doit pas être appelé quand le bridge est en pause');
    assert.strictEqual((await service.view(buyer)).features.bridgePaused, true);
  });

  await test('FITIA_FARM_BRIDGE_ENABLED=false : WITHDRAW refusé en 503 FARM_BRIDGE_PAUSED, les coins ne sont pas débités', async () => {
    process.env.FITIA_FARM_BRIDGE_ENABLED = 'false';
    const before = (await service.view(buyer)).state.coins;
    await expectPaused(service.withdraw(await signed('withdraw', { actionId: actionId(), coins: 1000 })));
    assert.strictEqual((await service.view(buyer)).state.coins, before);
  });

  await test('FITIA_FARM_BRIDGE_ENABLED=false : le paiement admin d’un retrait déjà en attente reste possible', async () => {
    delete process.env.FITIA_FARM_BRIDGE_ENABLED;
    await service.action(await signed('action', { actionId: actionId(), type: 'buy_land', params: {} }));
    await service.action(await signed('action', { actionId: actionId(), type: 'buy_animal', params: { species: 'chicken' } }));
    await service.deposit(await signed('deposit', { actionId: actionId(), txHash: hash(), amountUnits: amountUnits(10) }));
    const id = actionId();
    const requested = await service.withdraw(await signed('withdraw', { actionId: id, coins: 1000 }));
    assert.strictEqual(requested.withdrawals[0].status, 'pending');
    process.env.FITIA_FARM_BRIDGE_ENABLED = 'false';
    const paid = await service.completeWithdrawal({ id, txHash: hash() });
    assert.strictEqual(paid.pending, false);
    assert.strictEqual(paid.withdrawal.status, 'paid');
    assert.strictEqual(paid.withdrawal.id, id);
    delete process.env.FITIA_FARM_BRIDGE_ENABLED;
  });

  await test('FITIA_FARM_BRIDGE_ENABLED=false : resolvePending reste ouvert (un dépôt déjà diffusé peut être réglé)', async () => {
    process.env.FITIA_FARM_BRIDGE_ENABLED = 'false';
    const status = await service.resolvePending(await signed('resolve', { actionId: actionId() }));
    assert.strictEqual(status.status, 'cancelled');
    delete process.env.FITIA_FARM_BRIDGE_ENABLED;
  });

  await test('Drapeau réactivé : CONVERT et WITHDRAW refonctionnent sans changer le code', async () => {
    process.env.FITIA_FARM_BRIDGE_ENABLED = 'true';
    const result = await service.deposit(await signed('deposit', { actionId: actionId(), txHash: hash(), amountUnits: amountUnits(1) }));
    assert.strictEqual(result.pending, false);
    assert.strictEqual((await service.view(buyer)).features.bridgePaused, false);
    delete process.env.FITIA_FARM_BRIDGE_ENABLED;
  });

  console.log(`\n${'═'.repeat(68)}\n${failed === 0 ? '✅' : '❌'}  ${passed} tests réussis, ${failed} échoués\n`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => { console.error('Échec fatal:', error); process.exit(1); });
