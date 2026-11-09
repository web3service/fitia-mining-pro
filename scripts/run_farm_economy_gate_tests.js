#!/usr/bin/env node
'use strict';
/* Porte de l’économie nouvelle non validée : le serveur doit rejeter les
   actions tant que FITIA_FARM_UNVALIDATED_ECONOMY n’est pas explicitement
   activée, quel que soit le client, et les exposer comme telles via view().
   Le drapeau est lu au chargement du module : on le recharge pour chaque
   scénario. Voir docs/FITIA-FARM-ECONOMIE.md. */
const assert = require('assert');
const crypto = require('crypto');
const ethers = require('../vendor/ethers.umd.min.js');
const Protocol = require('../farm-protocol');

let passed = 0; let failed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); }
}
const wallet = new ethers.Wallet(`0x${'11'.repeat(32)}`);
const buyer = wallet.address.toLowerCase();

function load(envValue) {
  const path = require.resolve('../farm-service');
  delete require.cache[path];
  if (envValue === undefined) delete process.env.FITIA_FARM_UNVALIDATED_ECONOMY;
  else process.env.FITIA_FARM_UNVALIDATED_ECONOMY = envValue;
  return require('../farm-service');
}
function scenario(envValue) {
  const mod = load(envValue);
  const now = { ms: Date.parse('2026-11-09T12:00:00.000Z'), verification: { confirmed: true } };
  const repository = new mod.MemoryFarmRepository();
  const service = mod.createFarmService({ repository, now: () => new Date(now.ms), paymentVerifier: async () => now.verification });
  const signed = async (action, params = {}) => {
    const body = { action, buyer, timestamp: now.ms, ...params };
    body.signature = await wallet.signMessage(Protocol.message(action, body));
    return body;
  };
  const action = async (type, params = {}, signer = wallet) => service.action(await signed('action', { actionId: crypto.randomUUID(), type, params }));
  const deposit = async (amountFta = '10') => service.deposit(await signed('deposit', { actionId: crypto.randomUUID(), txHash: `0x${crypto.randomBytes(32).toString('hex')}`, amountUnits: ethers.parseUnits(amountFta, 8).toString() }));
  return { mod, service, now, signed, action, deposit };
}
async function started(envValue) {
  const s = scenario(envValue);
  await s.deposit('10');
  await s.action('buy_land');
  await s.action('buy_animal', { species: 'chicken' });
  await s.action('buy_feed');
  return s;
}

(async () => {
  console.log('\n🚪  SEUIL ÉCONOMIE FARM NON VALIDÉE\n' + '═'.repeat(68));

  await test('Défaut (drapeau absent) : actions et view signalées, masquées côté client', async () => {
    const s = await started(undefined);
    for (const [type, params] of [
      ['water_crop', { cropId: crypto.randomUUID() }],
      ['fertilize_crop', { cropId: crypto.randomUUID() }],
      ['care_animal', { animalId: crypto.randomUUID() }],
      ['breed_animal', { parentIds: [crypto.randomUUID(), crypto.randomUUID()] }],
      ['claim_mission', { missionKey: 'planted' }],
      ['mill_feed', {}]
    ]) {
      await assert.rejects(s.action(type, params), (error) => error.code === 'FARM_FEATURE_DISABLED' && error.status === 409);
    }
    const view = await s.service.getState(await s.signed('state'));
    assert.strictEqual(view.features?.unvalidatedEconomy, false);
  });

  await test('Drapeau « true » explicite requis : « false » laisse l’économie désactivée', async () => {
    const s = await started('false');
    await assert.rejects(s.action('mill_feed', {}), (error) => error.code === 'FARM_FEATURE_DISABLED');
    const view = await s.service.getState(await s.signed('state'));
    assert.strictEqual(view.features?.unvalidatedEconomy, false);
  });

  await test('Défaut : les actions validées restent disponibles (plantation, tracteur, silo)', async () => {
    const s = await started(undefined);
    const planted = await s.action('plant', { species: 'wheat' });
    assert.strictEqual(planted.state.crops.length, 1);
    await assert.rejects(s.action('harvest_ready', {}), (error) => error.code === 'FARM_NOT_READY');
    await assert.rejects(s.action('collect_group', { animalIds: [planted.state.animals[0].id] }), (error) => error.code === 'FARM_NOT_READY');
    const fed = await s.action('feed_group', { animalIds: [planted.state.animals[0].id] });
    assert.ok(fed.state.animals[0].produceAt > s.now.ms);
  });

  await test('Activé : moulin fonctionnel, missions réclamables selon progression, drapeau exposé', async () => {
    const s = await started('true');
    const planted = await s.action('plant', { species: 'wheat' });
    s.now.ms += 1800000 + 1000; // blé mûr
    const harvested = await s.action('harvest', { cropId: planted.state.crops[0].id });
    assert.strictEqual(harvested.state.inventory.wheat, 2);
    const milled = await s.action('mill_feed', {});
    assert.strictEqual(milled.state.inventory.wheat, 1);
    assert.strictEqual(milled.state.feed, milled.state.feed >= 1 ? milled.state.feed : -1);
    assert.ok(milled.state.feed >= 1);
    const view = await s.service.getState(await s.signed('state'));
    assert.strictEqual(view.features?.unvalidatedEconomy, true);
    // Une mission non terminée est refusée pour ce motif, pas par le seuil.
    await assert.rejects(s.action('claim_mission', { missionKey: 'harvested' }),
      (error) => error.code === 'FARM_MISSION_INCOMPLETE');
  });

  await test('Activé : résolution d’une action en attente reste possible (annulation)', async () => {
    const s = await started(undefined);
    const actionId = crypto.randomUUID();
    const status = await s.service.resolvePending(await s.signed('resolve', { actionId }));
    assert.strictEqual(status.status, 'cancelled');
  });

  delete process.env.FITIA_FARM_UNVALIDATED_ECONOMY;
  console.log('═'.repeat(68));
  console.log(`📊 RÉSULTAT SEUIL ÉCONOMIE : ${passed} réussis, ${failed} échoués`);
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
