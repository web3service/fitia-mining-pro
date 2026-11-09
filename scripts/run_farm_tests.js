#!/usr/bin/env node
'use strict';
// La suite couvre l’économie complète (moulin, puits, soins, engrais, reproduction, missions) : activation explicite.
// Le défaut de production reste désactivé ; voir scripts/run_farm_economy_gate_tests.js.
process.env.FITIA_FARM_UNVALIDATED_ECONOMY = 'true';
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const ethers = require('../vendor/ethers.umd.min.js');
const Config = require('../farm-config');
const Protocol = require('../farm-protocol');
const WheelConfig = require('../wheel-config');
const DiceConfig = require('../dice-config');
const { createFarmHandler } = require('../api/farm');
const { createAdminHandler } = require('../api/admin');
const {
  FarmError, MemoryFarmRepository, SupabaseFarmRepository, createFarmService, validateTransferReceipt, normalizeState, defaultState
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
const randomValues = [];
const service = createFarmService({ repository, now: () => new Date(nowMs), randomInt: () => randomValues.length ? randomValues.shift() : 0, paymentVerifier: async () => verification });
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
async function wheelAction(id, params, signer = wallet) {
  return service.action(await signed('action', signer, { actionId: id, type: 'wheel_spin', params }));
}
async function diceAction(id, params, signer = wallet, targetService = service) {
  return targetService.action(await signed('action', signer, { actionId: id, type: 'dice_roll', params }));
}
function segmentStart(id) {
  let cursor = 0;
  for (const segment of WheelConfig.SEGMENTS) {
    if (segment.id === id) return cursor;
    cursor += segment.weight;
  }
  throw new Error('Unknown test segment.');
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
    for (const params of [
      { product: '__proto__', quantity: 1 }, { product: 'wheat', quantity: 0 },
      { product: 'wheat', quantity: -1 }, { product: 'wheat', quantity: 1.5 },
      { product: 'wheat', quantity: '1' }, { product: 'wheat', quantity: 1000001 }
    ]) await expectCode(callAction('sell_item', params), 'FARM_PARAMS');
    await expectCode(callAction('sell_item', { product: 'wheat', quantity: 3 }), 'FARM_INVENTORY_EMPTY');
    const signedSale = await signed('action', wallet, { actionId: actionId(), type: 'sell_item', params: { product: 'wheat', quantity: 1, price: 999999999 } });
    result = await service.action(signedSale);
    assert.strictEqual(result.state.coins, before + Config.PRODUCTS.wheat.price, 'Le prix provient du serveur');
    assert.strictEqual(result.state.inventory.wheat, 1);
    assert.strictEqual(result.state.inventory.carrot, 2);
    assert.strictEqual(result.state.inventory.eggs, 1);
    assert.deepStrictEqual(result.state.marketSales[0], { id: signedSale.actionId, at: nowMs, items: [{ product: 'wheat', quantity: 1, unitPrice: 12 }], total: 12 });
    const replay = await service.action(signedSale);
    assert.strictEqual(replay.state.coins, result.state.coins, 'Rejeu sans double crédit');
    assert.strictEqual(replay.state.inventory.wheat, 1);
    assert.strictEqual(replay.state.marketSales.length, 1, 'Aucun doublon dans l’historique');
    const forged = { ...signedSale, params: { product: 'wheat', quantity: 2 } };
    await expectCode(service.action(forged), 'FARM_AUTH');
    const sales = await Promise.allSettled([callAction('sell_item', { product: 'wheat', quantity: 1 }), callAction('sell_item', { product: 'wheat', quantity: 1 })]);
    assert.strictEqual(sales.filter(item => item.status === 'fulfilled').length, 1, 'Ventes concurrentes limitées au stock');
    result = await callAction('sell');
    assert.strictEqual(result.state.coins, before + 30 + 24 + 36);
    assert.ok(Object.values(result.state.inventory).every((quantity) => quantity === 0));
    assert.strictEqual(result.state.marketSales.length, 3);
    assert.deepStrictEqual(result.state.marketSales[0].items.map(item => item.product), ['carrot', 'eggs']);
    assert.strictEqual(result.state.marketSales[0].total, 66);
    const refreshed = await service.view(buyer);
    assert.deepStrictEqual(refreshed.state.marketSales, result.state.marketSales, 'Historique conservé côté serveur');
  });

  await test('Parcelles : compatibilité, validation, rejeu et concurrence', async () => {
    const repo = new MemoryFarmRepository();
    const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const existing = (await service.view(buyer)).state;
    existing.crops = [
      { id: actionId(), species: 'wheat', plantedAt: nowMs, readyAt: nowMs + 1000 },
      { id: actionId(), species: 'carrot', plantedAt: nowMs, readyAt: nowMs + 1000, plot: 0 }
    ];
    repo.accounts.set(buyer, { state: existing, revision: 1 });
    const view = await isolate.view(buyer);
    assert.deepStrictEqual(view.state.crops.map(c => c.plot), [1, 0], 'Anciennes cultures préservées sans collision');
    const send = async (params, id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type: 'plant_plot', params }));
    for (const plot of [-1, 6, 1.5, '2', null]) await expectCode(send({ species: 'wheat', plot }), 'FARM_PARAMS');
    await expectCode(send({ species: '__proto__', plot: 2 }), 'FARM_PARAMS');
    await expectCode(send({ species: 'wheat', plot: 0 }), 'FARM_PLOT_OCCUPIED');
    const id = actionId();
    const result = await send({ species: 'wheat', plot: 5, price: 0 }, id);
    assert.strictEqual(result.state.coins, view.state.coins - Config.CROPS.wheat.price);
    assert.strictEqual(result.state.crops.find(c => c.id === id).plot, 5);
    const replay = await send({ species: 'wheat', plot: 5 }, id);
    assert.strictEqual(replay.state.coins, result.state.coins);
    assert.strictEqual(replay.state.crops.length, 3);
    const forged = await signed('action', wallet, { actionId: actionId(), type: 'plant_plot', params: { species: 'wheat', plot: 2 } });
    forged.params.plot = 3;
    await expectCode(isolate.action(forged), 'FARM_AUTH');
    const concurrent = await Promise.allSettled([send({ species: 'carrot', plot: 2 }), send({ species: 'carrot', plot: 2 })]);
    assert.strictEqual(concurrent.filter(r => r.status === 'fulfilled').length, 1);
    const final = await isolate.view(buyer);
    assert.strictEqual(final.state.crops.filter(c => c.plot === 2).length, 1);
    assert.strictEqual(final.state.coins, result.state.coins - Config.CROPS.carrot.price);
    const legacy = await isolate.action(await signed('action', wallet, { actionId: actionId(), type: 'plant', params: { species: 'wheat' } }));
    assert.strictEqual(legacy.state.crops.at(-1).plot, 3, 'Ancien client choisit la première parcelle libre');
  });

  await test('Progression : actions serveur, rejeu et aucune récompense financière', async () => {
    const repo = new MemoryFarmRepository();
    const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs);
    state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'chicken', acquiredAt: nowMs, produceAt: nowMs - 1 }];
    state.coins = 100; state.inventory.wheat = 2;
    delete state.farmProgress; // Compte créé avant la fonctionnalité.
    repo.accounts.set(buyer, { state, revision: 1 });
    const send = async (type, params, id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type, params }));
    let view = await isolate.view(buyer);
    assert.deepStrictEqual(view.state.farmProgress, { planted: 0, watered: 0, cared: 0, harvested: 0, collected: 0, sales: 0, fertilized: 0, bred: 0, fed: 0, milled: 0 });
    await expectCode(send('plant_plot', { species: 'wheat', plot: -1 }), 'FARM_PARAMS');
    assert.strictEqual((await isolate.view(buyer)).state.farmProgress.planted, 0);
    const plantId = actionId(); view = await send('plant_plot', { species: 'wheat', plot: 4 }, plantId);
    assert.strictEqual(view.state.coins, 90); assert.strictEqual(view.state.farmProgress.planted, 1);
    view = await send('plant_plot', { species: 'wheat', plot: 4 }, plantId);
    assert.strictEqual(view.state.coins, 90); assert.strictEqual(view.state.farmProgress.planted, 1);
    await expectCode(send('harvest', { cropId: plantId }), 'FARM_NOT_READY');
    assert.strictEqual((await isolate.view(buyer)).state.farmProgress.harvested, 0);
    view = await send('collect', { animalId: state.animals[0].id });
    assert.strictEqual(view.state.coins, 90); assert.strictEqual(view.state.farmProgress.collected, 1);
    const saleId = actionId(); view = await send('sell_item', { product: 'wheat', quantity: 1 }, saleId);
    assert.strictEqual(view.state.coins, 102); assert.strictEqual(view.state.farmProgress.sales, 1);
    view = await send('sell_item', { product: 'wheat', quantity: 1 }, saleId);
    assert.strictEqual(view.state.coins, 102); assert.strictEqual(view.state.farmProgress.sales, 1);
    nowMs += Config.CROPS.wheat.durationMs;
    view = await send('harvest', { cropId: plantId });
    assert.strictEqual(view.state.coins, 102);
    assert.deepStrictEqual(view.state.farmProgress, { planted: 1, watered: 0, cared: 0, harvested: 1, collected: 1, sales: 1, fertilized: 0, bred: 0, fed: 0, milled: 0 });
    assert.deepStrictEqual((await isolate.view(buyer)).state.farmProgress, view.state.farmProgress);
    const normalized = normalizeState({ farmProgress: { planted: -3, harvested: 1.5, collected: '5', sales: 1000000001 } }, buyer);
    assert.deepStrictEqual(normalized.farmProgress, { planted: 0, watered: 0, cared: 0, harvested: 0, collected: 0, sales: 0, fertilized: 0, bred: 0, fed: 0, milled: 0 });
  });

  await test('Moulin : recette serveur, protections de stock, rejeu et concurrence', async () => {
    const repo = new MemoryFarmRepository();
    const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs);
    state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'chicken', acquiredAt: nowMs, produceAt: 0 }];
    state.coins = 50; state.inventory.wheat = 1; state.feed = 3;
    repo.accounts.set(buyer, { state, revision: 1 });
    const send = async (params = {}, id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type: 'mill_feed', params }));
    const id = actionId();
    let view = await send({ quantity: 500, output: 100000, price: -100000 }, id);
    assert.strictEqual(view.state.coins, 50); assert.strictEqual(view.state.inventory.wheat, 0); assert.strictEqual(view.state.feed, 5);
    assert.strictEqual(repo.actions.get(id).actionType, 'mill_feed', 'Journal technique distinct');
    view = await send({}, id); assert.strictEqual(view.state.feed, 5); assert.strictEqual(view.state.coins, 50);
    await expectCode(send(), 'FARM_WHEAT_REQUIRED');
    const rec = repo.accounts.get(buyer); rec.state.inventory.wheat = 1; rec.state.feed = Config.MAX_FEED - 1;
    await expectCode(send(), 'FARM_FEED_FULL');
    const signedBuy = await signed('action', wallet, { actionId: actionId(), type: 'buy_feed', params: {} });
    await expectCode(isolate.action(signedBuy), 'FARM_FEED_FULL');
    assert.strictEqual((await isolate.view(buyer)).state.coins, 50, 'Aucun débit si le stockage est plein');
    rec.state.feed = 3;
    const concurrent = await Promise.allSettled([send(), send()]);
    assert.strictEqual(concurrent.filter(r => r.status === 'fulfilled').length, 1);
    view = await isolate.view(buyer);
    assert.strictEqual(view.state.inventory.wheat, 0); assert.strictEqual(view.state.feed, 5); assert.strictEqual(view.state.coins, 50);
    const forged = await signed('action', wallet, { actionId: actionId(), type: 'mill_feed', params: {} }); forged.params.output = 1000;
    await expectCode(isolate.action(forged), 'FARM_AUTH');
    assert.ok(Config.MILL_FEED_OUTPUT * Config.FEED_PACK_PRICE <= Config.MILL_WHEAT_INPUT * Config.PRODUCTS.wheat.price * Config.FEED_PACK_QUANTITY, 'La recette ne dépasse pas le coût d’achat équivalent du blé vendu');
    const migration = fs.readFileSync('supabase/migrations/20261108010000_farm_mill.sql', 'utf8');
    assert.ok(migration.includes("'mill_feed'"));
    assert.ok(migration.includes('revoke execute on function public.farm_apply'));
  });

  await test('Nouvelles cultures : plantation, attente, récolte et vente autoritaires', async () => {
    const repo = new MemoryFarmRepository();
    const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs);
    state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'chicken', acquiredAt: nowMs, produceAt: 0 }];
    state.coins = 100; repo.accounts.set(buyer, { state, revision: 1 });
    const send = async (type, params, id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type, params }));
    for (const [species, plot, baseline] of [['maize', 2, 'wheat'], ['tomato', 4, 'carrot']]) {
      assert.strictEqual(Config.CROPS[species].price, Config.CROPS[baseline].price);
      assert.strictEqual(Config.CROPS[species].durationMs, Config.CROPS[baseline].durationMs);
      assert.strictEqual(Config.CROPS[species].yield, Config.CROPS[baseline].yield);
      assert.strictEqual(Config.PRODUCTS[species].price, Config.PRODUCTS[baseline].price);
      let before = await isolate.view(buyer); const id = actionId();
      let planted = await send('plant_plot', { species, plot, price: 0 }, id);
      assert.strictEqual(planted.state.version, 3);
      assert.strictEqual(planted.state.coins, before.state.coins - Config.CROPS[species].price);
      assert.strictEqual(planted.state.crops.find(crop => crop.id === id).species, species);
      await expectCode(send('harvest', { cropId: id }), 'FARM_NOT_READY');
      nowMs += Config.CROPS[species].durationMs;
      const harvestId = actionId(); let harvest = await send('harvest', { cropId: id }, harvestId);
      assert.strictEqual(harvest.state.inventory[species], 2);
      harvest = await send('harvest', { cropId: id }, harvestId); assert.strictEqual(harvest.state.inventory[species], 2);
      const sale = await send('sell_item', { product: species, quantity: 1, price: 999999 });
      assert.strictEqual(sale.state.coins, planted.state.coins + Config.PRODUCTS[species].price);
      assert.strictEqual(sale.state.inventory[species], 1);
      const final = await isolate.view(buyer); assert.strictEqual(final.state.inventory[species], 1);
    }
    const guard = fs.readFileSync('supabase/migrations/20261108020000_farm_state_version_guard.sql', 'utf8');
    assert.ok(guard.includes('before update of state on public.farm_accounts'));
    assert.ok(guard.includes('FARM_STATE_VERSION'));
  });

  await test('Tracteur : récolte seulement mûre, atomicité et reprise sans doublon', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.coins = 45;
    state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'chicken', acquiredAt: nowMs, produceAt: 0 }];
    state.crops = [
      { id: actionId(), species: 'maize', plot: 1, plantedAt: nowMs - 1000, readyAt: nowMs - 1 },
      { id: actionId(), species: 'tomato', plot: 3, plantedAt: nowMs - 1000, readyAt: nowMs - 1 },
      { id: actionId(), species: 'wheat', plot: 5, plantedAt: nowMs, readyAt: nowMs + 1000 }
    ];
    state.inventory.tomato = 999999;
    repo.accounts.set(buyer, { state, revision: 1 });
    const send = async (id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type: 'harvest_ready', params: {} }));
    await expectCode(send(), 'FARM_LIMIT');
    let v = await isolate.view(buyer); assert.strictEqual(v.state.crops.length, 3); assert.strictEqual(v.state.inventory.maize, 0);
    repo.accounts.get(buyer).state.inventory.tomato = 0;
    const id = actionId(); v = await send(id);
    assert.strictEqual(v.state.coins, 45); assert.strictEqual(v.state.inventory.maize, 2); assert.strictEqual(v.state.inventory.tomato, 2);
    assert.deepStrictEqual(v.state.crops.map(c => c.species), ['wheat']); assert.strictEqual(v.state.farmProgress.harvested, 2);
    assert.strictEqual(repo.actions.get(id).actionType, 'harvest_ready');
    nowMs += 1000; v = await send(id);
    assert.strictEqual(v.state.inventory.wheat, 0, 'Le rejeu ne récolte pas de nouvelles cultures mûries entre-temps');
    const raced = await Promise.allSettled([send(), send()]);
    assert.strictEqual(raced.filter(r => r.status === 'fulfilled').length, 1);
    v = await isolate.view(buyer); assert.strictEqual(v.state.inventory.wheat, 2); assert.strictEqual(v.state.farmProgress.harvested, 3);
    await expectCode(send(), 'FARM_NOT_READY');
    const migration = fs.readFileSync('supabase/migrations/20261108010000_farm_mill.sql', 'utf8');
    assert.ok(migration.includes("'harvest_ready'"));
  });

  await test('Silo : alimentation groupée signée, validation et reprise atomique', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.coins = 100; state.feed = 2;
    state.land = { owned: true, purchasedAt: nowMs };
    const chicken = actionId(), cow = actionId(), sheep = actionId();
    state.animals = [
      { id: chicken, species: 'chicken', acquiredAt: nowMs, produceAt: 0 },
      { id: cow, species: 'cow', acquiredAt: nowMs, produceAt: 0 },
      { id: sheep, species: 'sheep', acquiredAt: nowMs, produceAt: nowMs - 1 }
    ];
    repo.accounts.set(buyer, { state, revision: 1 });
    const send = async (ids, id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type: 'feed_group', params: { animalIds: ids } }));
    for (const ids of [[], [chicken, chicken], ['bad'], Array(13).fill(chicken)]) await expectCode(send(ids), 'FARM_PARAMS');
    await expectCode(send([chicken, actionId()]), 'FARM_NOT_FOUND');
    await expectCode(send([chicken, sheep]), 'FARM_NOT_READY');
    repo.accounts.get(buyer).state.feed = 1;
    await expectCode(send([chicken, cow]), 'FARM_FEED_REQUIRED');
    let v = await isolate.view(buyer); assert.strictEqual(v.state.feed, 1); assert.strictEqual(v.state.animals[0].produceAt, 0);
    repo.accounts.get(buyer).state.feed = 2;
    const id = actionId(); v = await send([chicken, cow], id);
    assert.strictEqual(v.state.feed, 0); assert.strictEqual(v.state.coins, 100);
    assert.strictEqual(v.state.animals.find(a => a.id === chicken).produceAt, nowMs + Config.ANIMALS.chicken.durationMs);
    assert.strictEqual(v.state.animals.find(a => a.id === cow).produceAt, nowMs + Config.ANIMALS.cow.durationMs);
    assert.strictEqual(v.state.animals.find(a => a.id === sheep).produceAt, nowMs - 1);
    assert.strictEqual(repo.actions.get(id).actionType, 'feed_group');
    v = await send([chicken, cow], id); assert.strictEqual(v.state.feed, 0);
    const forged = await signed('action', wallet, { actionId: actionId(), type: 'feed_group', params: { animalIds: [chicken] } });
    forged.params.animalIds = [cow]; await expectCode(isolate.action(forged), 'FARM_AUTH');
    const record = repo.accounts.get(buyer); record.state.feed = 2; record.state.animals[0].produceAt = 0;
    const race = await Promise.allSettled([send([chicken]), send([chicken])]);
    assert.strictEqual(race.filter(r => r.status === 'fulfilled').length, 1);
    assert.strictEqual((await isolate.view(buyer)).state.feed, 1);
    assert.ok(fs.readFileSync('supabase/migrations/20261108010000_farm_mill.sql', 'utf8').includes("'feed_group'"));
  });

  await test('Silo : collecte groupée des animaux sélectionnés, sans double production', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.coins = 100; state.feed = 3;
    state.land = { owned: true, purchasedAt: nowMs };
    const chicken = actionId(), cow = actionId(), sheep = actionId();
    state.animals = [
      { id: chicken, species: 'chicken', acquiredAt: nowMs, produceAt: nowMs - 1 },
      { id: cow, species: 'cow', acquiredAt: nowMs, produceAt: nowMs - 1 },
      { id: sheep, species: 'sheep', acquiredAt: nowMs, produceAt: nowMs + 2000 }
    ];
    repo.accounts.set(buyer, { state, revision: 1 });
    const send = async (ids, id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type: 'collect_group', params: { animalIds: ids } }));
    for (const ids of [[], [chicken, chicken], ['bad']]) await expectCode(send(ids), 'FARM_PARAMS');
    await expectCode(send([chicken, actionId()]), 'FARM_NOT_FOUND');
    await expectCode(send([chicken, sheep]), 'FARM_NOT_READY');
    repo.accounts.get(buyer).state.inventory.milk = 1000000;
    await expectCode(send([chicken, cow]), 'FARM_LIMIT');
    let v = await isolate.view(buyer); assert.strictEqual(v.state.inventory.eggs, 0); assert.strictEqual(v.state.animals[0].produceAt, nowMs - 1);
    repo.accounts.get(buyer).state.inventory.milk = 0;
    const id = actionId(); v = await send([chicken, cow], id);
    assert.strictEqual(v.state.inventory.eggs, 1); assert.strictEqual(v.state.inventory.milk, 1);
    assert.strictEqual(v.state.animals.find(a => a.id === sheep).produceAt, nowMs + 2000);
    assert.strictEqual(v.state.coins, 100); assert.strictEqual(v.state.feed, 3); assert.strictEqual(v.state.farmProgress.collected, 2);
    assert.strictEqual(repo.actions.get(id).actionType, 'collect_group');
    v = await send([chicken, cow], id); assert.strictEqual(v.state.inventory.eggs, 1); assert.strictEqual(v.state.farmProgress.collected, 2);
    const forged = await signed('action', wallet, { actionId: actionId(), type: 'collect_group', params: { animalIds: [chicken] } });
    forged.params.animalIds = [cow]; await expectCode(isolate.action(forged), 'FARM_AUTH');
    nowMs += 2000;
    const race = await Promise.allSettled([send([sheep]), send([sheep])]);
    assert.strictEqual(race.filter(r => r.status === 'fulfilled').length, 1);
    assert.strictEqual((await isolate.view(buyer)).state.inventory.wool, 1);
    assert.ok(fs.readFileSync('supabase/migrations/20261108010000_farm_mill.sql', 'utf8').includes("'collect_group'"));
  });

  await test('Résolution : annulation atomique, action déjà effectuée et rejets tardifs', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.coins = 100;
    state.land = { owned: true, purchasedAt: nowMs }; state.inventory.wheat = 4;
    state.animals = [{ id: actionId(), species: 'chicken', acquiredAt: nowMs, produceAt: 0 }];
    repo.accounts.set(buyer, { state, revision: 1 });
    const id = actionId(); const body = await signed('action', wallet, { actionId: id, type: 'sell_item', params: { product: 'wheat', quantity: 1 } });
    const resolve = await signed('resolve', wallet, { actionId: id });
    const cancelled = await isolate.resolvePending(resolve); assert.strictEqual(cancelled.status, 'cancelled');
    assert.strictEqual((await isolate.resolvePending(resolve)).status, 'cancelled');
    await expectCode(isolate.action(body), 'FARM_CANCELLED');
    assert.strictEqual((await isolate.view(buyer)).state.inventory.wheat, 4);
    await expectCode(isolate.resolvePending({ ...resolve, actionId: actionId() }), 'FARM_AUTH');
    await expectCode(isolate.resolvePending(await signed('resolve', otherWallet, { actionId: id })), 'FARM_CONFLICT');
    const completedId = actionId();
    const complete = await signed('action', wallet, { actionId: completedId, type: 'sell_item', params: { product: 'wheat', quantity: 1 } });
    await isolate.action(complete);
    const committed = await isolate.resolvePending(await signed('resolve', wallet, { actionId: completedId }));
    assert.strictEqual(committed.status, 'committed'); assert.strictEqual(committed.state.coins, 112);
    assert.strictEqual((await isolate.action(complete)).state.inventory.wheat, 3);
    const concurrentId = actionId();
    const concurrentAction = await signed('action', wallet, { actionId: concurrentId, type: 'sell_item', params: { product: 'wheat', quantity: 1 } });
    const concurrentResolve = await signed('resolve', wallet, { actionId: concurrentId });
    const [actionResult, resolution] = await Promise.allSettled([isolate.action(concurrentAction), isolate.resolvePending(concurrentResolve)]);
    assert.strictEqual(resolution.status, 'fulfilled');
    const final = await isolate.view(buyer);
    if (resolution.value.status === 'cancelled') {
      assert.strictEqual(actionResult.status, 'rejected'); assert.strictEqual(actionResult.reason.code, 'FARM_CANCELLED');
      assert.strictEqual(final.state.inventory.wheat, 3);
    } else { assert.strictEqual(final.state.inventory.wheat, 2); assert.strictEqual(final.state.coins, 124); }
    const migration = fs.readFileSync('supabase/migrations/20261108030000_farm_resolve_pending.sql', 'utf8');
    assert.ok(migration.includes('on conflict (action_id) do nothing'));
    assert.ok(migration.includes('from public, anon, authenticated'));
  });

  await test('Marché groupé : prix serveur, validation atomique et reprise idempotente', async () => {
    const repo = new MemoryFarmRepository(), isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'chicken', produceAt: 0 }]; state.inventory.wheat = 3; state.inventory.carrot = 2; state.coins = 100;
    repo.accounts.set(buyer, { state, revision: 1 });
    const act = async items => isolate.action(await signed('action', wallet, { actionId: actionId(), type: 'sell_batch', params: { items } }));
    await expectCode(act([{ product: 'wheat', quantity: 1 }, { product: 'wheat', quantity: 1 }]), 'FARM_PARAMS');
    await expectCode(act([{ product: 'wheat', quantity: 1 }, { product: 'carrot', quantity: 3 }]), 'FARM_INVENTORY_EMPTY');
    await expectCode(act([{ product: 'wheat', quantity: -1 }]), 'FARM_PARAMS');
    assert.strictEqual((await isolate.view(buyer)).state.inventory.wheat, 3); assert.strictEqual((await isolate.view(buyer)).state.coins, 100);
    const msg = await signed('action', wallet, { actionId: actionId(), type: 'sell_batch', params: { items: [{ product: 'wheat', quantity: 2, unitPrice: 9999 }, { product: 'carrot', quantity: 1 }] } });
    let view = await isolate.action(msg); const expected = 100 + 2 * Config.PRODUCTS.wheat.price + Config.PRODUCTS.carrot.price;
    assert.strictEqual(view.state.coins, expected); assert.strictEqual(view.state.inventory.wheat, 1); assert.strictEqual(view.state.inventory.carrot, 1);
    assert.strictEqual(view.state.marketSales[0].items.length, 2); assert.strictEqual(view.state.farmProgress.sales, 1);
    view = await isolate.action(msg); assert.strictEqual(view.state.coins, expected); assert.strictEqual(view.state.farmProgress.sales, 1);
  });

  await test('Analyse économique et niveaux : hypothèses, gains et déblocages décoratifs', async () => {
    const audit = require('./farm-economy-audit').audit();
    assert.strictEqual(audit.crops.wheat.net, 14); assert.strictEqual(audit.crops.wheat.maxDailyCoins, 4032);
    assert.strictEqual(audit.crops.wheat.fertilizer.durationMs, 1530000); assert.strictEqual(audit.crops.wheat.fertilizer.maxMixedDailyCoins, 4200);
    assert.strictEqual(audit.animals.sheep.net, 61); assert.strictEqual(audit.animals.sheep.maxDailyCoins, 2196);
    assert.strictEqual(audit.dailyTheoreticalFta, 63.96); assert.strictEqual(audit.mill.wheatSaleValue, 12);
    assert.strictEqual(audit.mill.feedRetailValue, 8); assert.strictEqual(audit.coinsPerFta, 100);
    assert.strictEqual(Config.progressLevel({ planted: 9 }), 1); assert.strictEqual(Config.progressLevel({ planted: 10 }), 2);
    assert.strictEqual(Config.progressLevel({ harvested: 10 }), 3); assert.strictEqual(Config.progressLevel({ planted: -1, sales: '100' }), 1);
    assert.deepStrictEqual(Config.COSMETIC_UNLOCKS.map(x => x.level), [2, 3]);
  });

  await test('Scénarios économiques : comptes, durée, missions uniques et limites', async () => {
    const { project } = require('./farm-economy-audit');
    const first = project(1, 1); assert.strictEqual(first.productionCoins, 6396); assert.strictEqual(first.missionCoinsOnce, 80); assert.strictEqual(first.totalFta, 64.76);
    const multiple = project(10, 30); assert.strictEqual(multiple.productionCoins, 1918800); assert.strictEqual(multiple.missionCoinsOnce, 800); assert.strictEqual(multiple.totalFta, 19196);
    assert.throws(() => project(0, 1), RangeError); assert.throws(() => project(1, 0), RangeError);
    assert.throws(() => project(1.2, 1), RangeError); assert.throws(() => project(100001, 1), RangeError);
  });

  await test('Puits : arrosage signé, accélération limitée et sans changement de rendement', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.coins = 100;
    state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'chicken', acquiredAt: nowMs, produceAt: 0 }];
    const cropId = actionId(); const readyAt = nowMs + Config.CROPS.maize.durationMs;
    state.crops = [{ id: cropId, species: 'maize', plot: 2, plantedAt: nowMs, readyAt }];
    repo.accounts.set(buyer, { state, revision: 1 });
    const send = async (crop, id = actionId(), extra = {}) => isolate.action(await signed('action', wallet, { actionId: id, type: 'water_crop', params: { cropId: crop, ...extra } }));
    await expectCode(send(actionId()), 'FARM_NOT_FOUND');
    const id = actionId(); let v = await send(cropId, id, { coins: 5000, speed: 999999 });
    assert.strictEqual(v.state.crops[0].wateredAt, nowMs); assert.strictEqual(v.state.crops[0].readyAt, readyAt - Config.CROPS.maize.durationMs * Config.WATER_SPEED_PERCENT / 100);
    assert.strictEqual(v.state.coins, 100); assert.strictEqual(v.state.inventory.maize, 0); assert.strictEqual(v.state.farmProgress.watered, 1);
    v = await send(cropId, id); assert.strictEqual(v.state.farmProgress.watered, 1);
    await expectCode(send(cropId), 'FARM_ALREADY_WATERED');
    const forged = await signed('action', wallet, { actionId: actionId(), type: 'water_crop', params: { cropId } });
    forged.params.cropId = actionId(); await expectCode(isolate.action(forged), 'FARM_AUTH');
    const record = repo.accounts.get(buyer); record.state.crops[0].wateredAt = 0;
    const race = await Promise.allSettled([send(cropId), send(cropId)]);
    assert.strictEqual(race.filter(item => item.status === 'fulfilled').length, 1);
    v = await isolate.view(buyer); assert.strictEqual(v.state.farmProgress.watered, 2); assert.strictEqual(v.state.coins, 100);
    record.state.crops[0].wateredAt = 0; nowMs = readyAt;
    await expectCode(send(cropId), 'FARM_NOT_READY');
    const harvested = await isolate.action(await signed('action', wallet, { actionId: actionId(), type: 'harvest', params: { cropId } }));
    assert.strictEqual(harvested.state.inventory.maize, 2); assert.strictEqual(harvested.state.coins, 100);
    assert.ok(fs.readFileSync('supabase/migrations/20261108010000_farm_mill.sql', 'utf8').includes("'water_crop'"));
  });

  await test('Soins : signature, cycle, concurrence et durée réduite', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const animalId = actionId(); const state = defaultState(buyer, nowMs); state.coins = 50; state.feed = 2;
    state.land = { owned: true, purchasedAt: nowMs }; state.animals = [{ id: animalId, species: 'chicken', acquiredAt: nowMs, produceAt: 0 }];
    repo.accounts.set(buyer, { state, revision: 1 });
    const action = async (type, params, id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type, params }));
    await expectCode(action('care_animal', { animalId: actionId() }), 'FARM_NOT_FOUND');
    const invalid = await signed('action', wallet, { actionId: actionId(), type: 'care_animal', params: { animalId } });
    invalid.params.animalId = actionId(); await expectCode(isolate.action(invalid), 'FARM_AUTH');
    const id = actionId(); let v = await action('care_animal', { animalId, coins: 5000 }, id);
    assert.strictEqual(v.state.animals[0].caredAt, nowMs); assert.strictEqual(v.state.animals[0].produceAt, 0);
    assert.strictEqual(v.state.coins, 50); assert.strictEqual(v.state.feed, 2); assert.strictEqual(v.state.farmProgress.cared, 1);
    v = await action('care_animal', { animalId }, id); assert.strictEqual(v.state.farmProgress.cared, 1);
    await expectCode(action('care_animal', { animalId }), 'FARM_ALREADY_CARED');
    v = await action('feed', { animalId }); const deadline = v.state.animals[0].produceAt;
    assert.strictEqual(deadline, nowMs + Config.ANIMALS.chicken.durationMs * (1 - Config.CARE_SPEED_PERCENT / 100));
    nowMs = deadline; v = await action('collect', { animalId });
    assert.strictEqual(v.state.animals[0].caredAt, 0); assert.strictEqual(v.state.inventory.eggs, 1); assert.strictEqual(v.state.coins, 50);
    const race = await Promise.allSettled([action('care_animal', { animalId }), action('care_animal', { animalId })]);
    assert.strictEqual(race.filter(item => item.status === 'fulfilled').length, 1);
    v = await isolate.view(buyer); assert.strictEqual(v.state.farmProgress.cared, 2);
    assert.ok(fs.readFileSync('supabase/migrations/20261108010000_farm_mill.sql', 'utf8').includes("'care_animal'"));
  });

  await test('Nouveaux animaux : achat, nourriture et collecte au même tarif que les espèces de référence', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.coins = 3000; state.feed = 2; state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'chicken', acquiredAt: nowMs, produceAt: 0 }]; repo.accounts.set(buyer, { state, revision: 1 });
    const act = async (type, params, id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type, params }));
    for (const [species, reference] of [['duck', 'chicken'], ['goat', 'cow']]) {
      assert.strictEqual(Config.ANIMALS[species].price, Config.ANIMALS[reference].price);
      assert.strictEqual(Config.ANIMALS[species].durationMs, Config.ANIMALS[reference].durationMs);
      assert.strictEqual(Config.ANIMALS[species].product, Config.ANIMALS[reference].product);
      const id = actionId(), before = (await isolate.view(buyer)).state.coins;
      let v = await act('buy_animal', { species }, id); assert.strictEqual(v.state.coins, before - Config.ANIMALS[species].price);
      v = await act('feed', { animalId: id }); assert.strictEqual(v.state.animals.find(a => a.id === id).produceAt, nowMs + Config.ANIMALS[species].durationMs);
      nowMs += Config.ANIMALS[species].durationMs; v = await act('collect', { animalId: id });
      assert.strictEqual(v.state.inventory[Config.ANIMALS[species].product], 1);
    }
  });

  await test('Reproduction : parents, coût, jeunesse, rejeu, course et annulation', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const a = actionId(), b = actionId(), c = actionId(); const state = defaultState(buyer, nowMs);
    state.coins = 5000; state.feed = 10; state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: a, species: 'goat', produceAt: 0 }, { id: b, species: 'goat', produceAt: 0 }, { id: c, species: 'duck', produceAt: 0 }]; repo.accounts.set(buyer, { state, revision: 1 });
    const act = async (type, params, id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type, params }));
    await expectCode(act('breed_animal', { parentIds: [a, a] }), 'FARM_PARAMS');
    await expectCode(act('breed_animal', { parentIds: [a, c] }), 'FARM_PARAMS');
    await expectCode(act('breed_animal', { parentIds: [a, actionId()] }), 'FARM_NOT_FOUND');
    const forged = await signed('action', wallet, { actionId: actionId(), type: 'breed_animal', params: { parentIds: [a, b] } }); forged.params.parentIds[1] = c;
    await expectCode(isolate.action(forged), 'FARM_AUTH');
    const id = actionId(); let v = await act('breed_animal', { parentIds: [a, b] }, id);
    assert.strictEqual(v.state.coins, 4370); assert.strictEqual(v.state.feed, 9);
    assert.strictEqual(v.state.animals.find(x => x.id === id).maturesAt, nowMs + Config.ANIMALS.goat.durationMs);
    v = await act('breed_animal', { parentIds: [a, b] }, id); assert.strictEqual(v.state.animals.length, 4); assert.strictEqual(v.state.coins, 4370);
    await expectCode(act('feed', { animalId: id }), 'FARM_YOUNG_ANIMAL');
    await expectCode(act('feed_group', { animalIds: [a, id] }), 'FARM_YOUNG_ANIMAL');
    await expectCode(act('breed_animal', { parentIds: [a, id] }), 'FARM_YOUNG_ANIMAL');
    const cancelId = actionId(); const pending = await signed('action', wallet, { actionId: cancelId, type: 'breed_animal', params: { parentIds: [a, b] } });
    assert.strictEqual((await isolate.resolvePending(await signed('resolve', wallet, { actionId: cancelId }))).status, 'cancelled');
    await expectCode(isolate.action(pending), 'FARM_CANCELLED');
    const race = await Promise.allSettled([act('breed_animal', { parentIds: [a, b] }), act('breed_animal', { parentIds: [a, b] })]);
    assert.strictEqual(race.filter(r => r.status === 'fulfilled').length, 1); // optimistic revision prevents a lost update
    v = await isolate.view(buyer); assert.strictEqual(v.state.animals.length, 5); assert.strictEqual(v.state.coins, 3740); assert.strictEqual(v.state.feed, 8);
    nowMs += Config.ANIMALS.goat.durationMs; v = await act('feed', { animalId: id }); assert.ok(v.state.animals.find(x => x.id === id).produceAt > nowMs);
    assert.ok(fs.readFileSync('supabase/migrations/20261108010000_farm_mill.sql', 'utf8').includes("'breed_animal'"));
  });

  await test('Engrais : coût fixe, effet limité, maturité, rejeu, course et annulation', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs), crop = actionId(); state.coins = 100; state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'duck', produceAt: 0 }]; state.crops = [{ id: crop, species: 'wheat', plot: 0, plantedAt: nowMs, readyAt: nowMs + Config.CROPS.wheat.durationMs }]; repo.accounts.set(buyer, { state, revision: 1 });
    const act = async (id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type: 'fertilize_crop', params: { cropId: crop, price: 0, reduction: 9999999 } }));
    const id = actionId(); let v = await act(id); assert.strictEqual(v.state.coins, 96);
    assert.strictEqual(v.state.crops[0].readyAt, nowMs + Config.CROPS.wheat.durationMs * 0.9); assert.strictEqual(v.state.crops[0].fertilizedAt, nowMs);
    v = await act(id); assert.strictEqual(v.state.coins, 96); await expectCode(act(), 'FARM_ALREADY_FERTILIZED');
    const record = repo.accounts.get(buyer); record.state.crops[0].fertilizedAt = 0;
    const race = await Promise.allSettled([act(), act()]); assert.strictEqual(race.filter(r => r.status === 'fulfilled').length, 1);
    v = await isolate.view(buyer); assert.strictEqual(v.state.coins, 92);
    const cancelId = actionId(); const body = await signed('action', wallet, { actionId: cancelId, type: 'fertilize_crop', params: { cropId: crop } });
    await isolate.resolvePending(await signed('resolve', wallet, { actionId: cancelId })); await expectCode(isolate.action(body), 'FARM_CANCELLED');
    nowMs = v.state.crops[0].readyAt; await expectCode(act(), 'FARM_NOT_READY');
    v = await isolate.action(await signed('action', wallet, { actionId: actionId(), type: 'harvest', params: { cropId: crop } }));
    assert.strictEqual(v.state.inventory.wheat, 2); assert.strictEqual(v.state.coins, 92);
    assert.ok(fs.readFileSync('supabase/migrations/20261108010000_farm_mill.sql', 'utf8').includes("'fertilize_crop'"));
  });

  await test('Reproduction et engrais : limites de capacité et ressources', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const a = actionId(), b = actionId(), crop = actionId(); const state = defaultState(buyer, nowMs);
    state.land = { owned: true, purchasedAt: nowMs }; state.coins = 0; state.feed = 0;
    state.animals = [{ id: a, species: 'duck', produceAt: 0 }, { id: b, species: 'duck', produceAt: 0 }];
    state.crops = [{ id: crop, species: 'carrot', plot: 0, plantedAt: nowMs, readyAt: nowMs + 1000 }]; repo.accounts.set(buyer, { state, revision: 1 });
    const act = async (type, params) => isolate.action(await signed('action', wallet, { actionId: actionId(), type, params }));
    await expectCode(act('fertilize_crop', { cropId: crop }), 'FARM_INSUFFICIENT_COINS');
    await expectCode(act('fertilize_crop', { cropId: actionId() }), 'FARM_NOT_FOUND');
    await expectCode(act('breed_animal', { parentIds: [a, b] }), 'FARM_FEED_REQUIRED');
    const record = repo.accounts.get(buyer); record.state.feed = 1;
    await expectCode(act('breed_animal', { parentIds: [a, b] }), 'FARM_INSUFFICIENT_COINS');
    record.state.coins = 300; record.state.animals[0].produceAt = nowMs + 10000;
    await expectCode(act('breed_animal', { parentIds: [a, b] }), 'FARM_NOT_READY');
    record.state.animals[0].produceAt = 0;
    while (record.state.animals.length < Config.MAX_ANIMALS) record.state.animals.push({ id: actionId(), species: 'duck', produceAt: 0 });
    await expectCode(act('breed_animal', { parentIds: [a, b] }), 'FARM_LIMIT');
    const v = await act('fertilize_crop', { cropId: crop });
    assert.strictEqual(v.state.crops[0].readyAt, nowMs); // never backdates a nearly mature crop
    assert.strictEqual(v.state.coins, 296); assert.strictEqual(v.state.animals.length, Config.MAX_ANIMALS);
  });

  await test('Missions : F-Coins serveur, plafonds, signature et une seule récompense', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.coins = 100; state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'chicken', produceAt: 0 }]; delete state.missionClaims; state.version = 2;
    state.farmProgress.planted = 2; repo.accounts.set(buyer, { state, revision: 1 });
    const claim = async (key, id = actionId(), extra = {}) => isolate.action(await signed('action', wallet, { actionId: id, type: 'claim_mission', params: { missionKey: key, ...extra } }));
    const initial = await isolate.view(buyer); assert.strictEqual(initial.state.version, 3); assert.deepStrictEqual(initial.state.missionClaims, {});
    await expectCode(claim('planted'), 'FARM_MISSION_INCOMPLETE'); await expectCode(claim('unknown'), 'FARM_PARAMS');
    const forged = await signed('action', wallet, { actionId: actionId(), type: 'claim_mission', params: { missionKey: 'planted' } }); forged.params.missionKey = 'sales';
    await expectCode(isolate.action(forged), 'FARM_AUTH');
    const record = repo.accounts.get(buyer); record.state.farmProgress.planted = 3;
    const id = actionId(); let result = await claim('planted', id, { reward: 999999 });
    assert.strictEqual(result.state.coins, 110); assert.strictEqual(result.state.missionClaims.planted, true);
    result = await claim('planted', id); assert.strictEqual(result.state.coins, 110);
    await expectCode(claim('planted'), 'FARM_MISSION_CLAIMED');
    const cancelId = actionId(); const pending = await signed('action', wallet, { actionId: cancelId, type: 'claim_mission', params: { missionKey: 'planted' } });
    await isolate.resolvePending(await signed('resolve', wallet, { actionId: cancelId })); await expectCode(isolate.action(pending), 'FARM_CANCELLED');
    const current = repo.accounts.get(buyer); current.state.farmProgress.watered = 3;
    const race = await Promise.allSettled([claim('watered'), claim('watered')]); assert.strictEqual(race.filter(x => x.status === 'fulfilled').length, 1);
    result = await isolate.view(buyer); assert.strictEqual(result.state.coins, 120); assert.strictEqual(result.state.missionClaims.watered, true);
    const nearMax = repo.accounts.get(buyer); nearMax.state.coins = Config.MAX_COINS - 9; nearMax.state.farmProgress.cared = 3;
    await expectCode(claim('cared'), 'FARM_LIMIT'); result = await isolate.view(buyer);
    assert.strictEqual(result.state.coins, Config.MAX_COINS - 9); assert.strictEqual(result.state.missionClaims.cared, undefined);
    const malicious = normalizeState({ missionClaims: { planted: false, watered: true, cared: 'true', injected: true } }, buyer);
    assert.deepStrictEqual(malicious.missionClaims, { watered: true });
    assert.strictEqual(Config.MISSIONS.reduce((sum, m) => sum + m.reward, 0), 80);
    assert.ok(fs.readFileSync('supabase/migrations/20261108010000_farm_mill.sql', 'utf8').includes("'claim_mission'"));
  });

  await test('Missions supplémentaires : progression atomique et récompenses uniques', async () => {
    const repo = new MemoryFarmRepository(), isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs), a = actionId(), b = actionId(), c = actionId();
    state.land = { owned: true, purchasedAt: nowMs }; state.coins = 2000; state.feed = 5; state.inventory.wheat = 3;
    state.animals = [a, b, c].map(id => ({ id, species: 'chicken', produceAt: 0 }));
    state.crops = [0, 1, 2].map(plot => ({ id: actionId(), species: 'wheat', plot, plantedAt: nowMs, readyAt: nowMs + Config.CROPS.wheat.durationMs }));
    repo.accounts.set(buyer, { state, revision: 1 });
    const act = async (type, params, id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type, params }));
    await expectCode(act('claim_mission', { missionKey: 'fertilized' }), 'FARM_MISSION_INCOMPLETE');
    for (const crop of state.crops) await act('fertilize_crop', { cropId: crop.id });
    await act('breed_animal', { parentIds: [a, b] });
    const feedId = actionId(); let v = await act('feed_group', { animalIds: [a, b, c] }, feedId);
    assert.strictEqual(v.state.farmProgress.fed, 3); v = await act('feed_group', { animalIds: [a, b, c] }, feedId);
    assert.strictEqual(v.state.farmProgress.fed, 3);
    for (let i = 0; i < 3; i++) await act('mill_feed', {});
    v = await isolate.view(buyer);
    for (const key of ['fertilized', 'bred', 'fed', 'milled']) assert.strictEqual(v.state.farmProgress[key], key === 'bred' ? 1 : 3);
    const before = v.state.coins;
    for (const key of ['fertilized', 'bred', 'fed', 'milled']) {
      const id = actionId(); v = await act('claim_mission', { missionKey: key, reward: 99999 }, id);
      const after = v.state.coins; v = await act('claim_mission', { missionKey: key }, id); assert.strictEqual(v.state.coins, after);
      await expectCode(act('claim_mission', { missionKey: key }), 'FARM_MISSION_CLAIMED');
    }
    assert.strictEqual(v.state.coins, before + 20); assert.strictEqual(require('./farm-economy-audit').audit().oneTimeMissionCoinsPerAccount, 80);
  });

  await test('Placement : limites, collisions, signature, persistance et reprise', async () => {
    const repo = new MemoryFarmRepository(), isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'chicken', produceAt: 0 }]; state.coins = 123;
    repo.accounts.set(buyer, { state, revision: 1 });
    const act = async (params, id = actionId()) => isolate.action(await signed('action', wallet, { actionId: id, type: 'move_building', params }));
    await expectCode(act({ building: 'barn', x: 100, z: -5 }), 'FARM_POSITION');
    await expectCode(act({ building: 'barn', x: 3.76, z: -5 }), 'FARM_POSITION');
    await expectCode(act({ building: 'barn', x: -0.25, z: -5 }), 'FARM_POSITION');
    await expectCode(act({ building: 'other', x: 3.75, z: -5.5 }), 'FARM_PARAMS');
    const id = actionId(); let v = await act({ building: 'barn', x: 3.75, z: -5.5 }, id);
    assert.strictEqual(v.state.buildingPositions.barn.z, -5.5); assert.strictEqual(v.state.coins, 123);
    v = await act({ building: 'barn', x: 3.75, z: -5.5 }, id); assert.strictEqual(repo.accounts.get(buyer).revision, 2);
    v = await isolate.view(buyer); assert.strictEqual(v.state.buildingPositions.barn.z, -5.5);
    v = await isolate.action(await signed('action', wallet, { actionId: actionId(), type: 'change_layout', params: { layout: 1 } }));
    assert.deepStrictEqual(v.state.buildingPositions, Config.layoutPositions(1));
    repo.accounts.get(buyer).state.buildingPositions = { barn: { x: 100, z: 0 }, care: { x: 0, z: 0 } };
    v = await isolate.view(buyer); assert.deepStrictEqual(v.state.buildingPositions, Config.layoutPositions(1));
  });

  await test('Placement des six bâtiments : compte existant, plans et conservation des positions', async () => {
    const repo = new MemoryFarmRepository(), isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'chicken', produceAt: 0 }]; state.coins = 500;
    // An earlier v3 state contained only the two original building positions.
    state.buildingPositions = { barn: { x: 3.75, z: -5.5 }, care: { x: -0.25, z: -5 } };
    repo.accounts.set(buyer, { state, revision: 1 });
    let v = await isolate.view(buyer); assert.strictEqual(v.state.buildingPositions.barn.z, -5.5);
    for (const [building, next] of Object.entries({ mill: { x: -6.75, z: -5 }, well: { x: -8.25, z: 0.75 }, silo: { x: 7.5, z: -4.5 }, tractor: { x: 9.25, z: -1.25 } })) {
      v = await isolate.action(await signed('action', wallet, { actionId: actionId(), type: 'move_building', params: { building, ...next } }));
      assert.deepStrictEqual(v.state.buildingPositions[building], next);
    }
    const saved = v.state.buildingPositions;
    v = await isolate.action(await signed('action', wallet, { actionId: actionId(), type: 'change_layout', params: { layout: 1 } }));
    for (const key of ['mill', 'well', 'silo', 'tractor']) assert.deepStrictEqual(v.state.buildingPositions[key], saved[key]);
    assert.strictEqual(v.state.coins, 500);
    assert.deepStrictEqual((await isolate.view(buyer)).state.buildingPositions, v.state.buildingPositions);
    await expectCode(isolate.action(await signed('action', wallet, { actionId: actionId(), type: 'move_building', params: { building: 'tractor', x: 0, z: 0 } })), 'FARM_POSITION');
  });

  await test('Couleurs des bâtiments : validation, état persistant et aucune incidence financière', async () => {
    const repo = new MemoryFarmRepository(), isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.land = { owned: true, purchasedAt: nowMs };
    state.animals = [{ id: actionId(), species: 'chicken', produceAt: 0 }]; state.coins = 123; state.inventory.eggs = 2;
    repo.accounts.set(buyer, { state, revision: 1 });
    const act = async (building, style) => isolate.action(await signed('action', wallet, { actionId: actionId(), type: 'customize_building', params: { building, style } }));
    await expectCode(act('__proto__', 1), 'FARM_PARAMS'); await expectCode(act('barn', -1), 'FARM_PARAMS');
    await expectCode(act('care', 3), 'FARM_PARAMS'); await expectCode(act('barn', '1'), 'FARM_PARAMS');
    const msg = await signed('action', wallet, { actionId: actionId(), type: 'customize_building', params: { building: 'barn', style: 2 } });
    let view = await isolate.action(msg); assert.strictEqual(view.state.buildingStyle.barn, 2);
    view = await isolate.action(msg); assert.strictEqual(repo.accounts.get(buyer).revision, 2);
    view = await act('care', 1); assert.strictEqual(view.state.buildingStyle.care, 1);
    for (const key of ['well', 'mill', 'silo', 'tractor']) { view = await act(key, 2); assert.strictEqual(view.state.buildingStyle[key], 2); }
    assert.strictEqual(view.state.coins, 123); assert.strictEqual(view.state.inventory.eggs, 2);
    view = await isolate.view(buyer); assert.strictEqual(view.state.buildingStyle.barn, 2); assert.strictEqual(view.state.buildingStyle.care, 1);
    repo.accounts.get(buyer).state.buildingStyle = { barn: 100, care: -5, extra: 1 };
    view = await isolate.view(buyer); assert.strictEqual(view.state.buildingStyle.barn, 0); assert.strictEqual(view.state.buildingStyle.care, 0);
  });

  await test('Aménagement : plans validés, sauvegarde et rejeu sans effet financier', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs); state.land = { owned: true, purchasedAt: nowMs }; state.animals = [{ id: actionId(), species: 'chicken', produceAt: 0 }]; state.coins = 123;
    repo.accounts.set(buyer, { state, revision: 1 }); const id = actionId();
    const message = await signed('action', wallet, { actionId: id, type: 'change_layout', params: { layout: 1 } });
    let view = await isolate.action(message); assert.strictEqual(view.state.farmLayout, 1); assert.strictEqual(view.state.coins, 123);
    view = await isolate.action(message); assert.strictEqual(view.state.farmLayout, 1); assert.strictEqual(repo.accounts.get(buyer).revision, 2);
    await expectCode(isolate.action(await signed('action', wallet, { actionId: actionId(), type: 'change_layout', params: { layout: 2 } })), 'FARM_PARAMS');
    view = await isolate.action(await signed('action', wallet, { actionId: actionId(), type: 'change_layout', params: { layout: 0 } }));
    assert.strictEqual(view.state.farmLayout, 0); assert.strictEqual(view.state.coins, 123);
  });

  await test('Entretien : cumuls bornés, soins avant ou pendant production et cas proches de maturité', async () => {
    const repo = new MemoryFarmRepository(); const isolate = createFarmService({ repository: repo, now: () => new Date(nowMs) });
    const state = defaultState(buyer, nowMs), a = actionId(), b = actionId(), crop = actionId(); state.coins = 100; state.feed = 2;
    state.land = { owned: true, purchasedAt: nowMs }; state.animals = [{ id: a, species: 'chicken', produceAt: 0 }, { id: b, species: 'chicken', produceAt: 0 }];
    state.crops = [{ id: crop, species: 'wheat', plot: 0, plantedAt: nowMs, readyAt: nowMs + Config.CROPS.wheat.durationMs }]; repo.accounts.set(buyer, { state, revision: 1 });
    const act = async (type, params) => isolate.action(await signed('action', wallet, { actionId: actionId(), type, params }));
    await act('water_crop', { cropId: crop }); let v = await act('fertilize_crop', { cropId: crop });
    assert.strictEqual(v.state.crops[0].readyAt, nowMs + Config.CROPS.wheat.durationMs * 0.85); assert.strictEqual(v.state.coins, 96);
    await act('care_animal', { animalId: a }); v = await act('feed_group', { animalIds: [a, b] });
    const normal = nowMs + Config.ANIMALS.chicken.durationMs; const cared = nowMs + Config.ANIMALS.chicken.durationMs * 0.95;
    assert.strictEqual(v.state.animals.find(x => x.id === a).produceAt, cared); assert.strictEqual(v.state.animals.find(x => x.id === b).produceAt, normal);
    v = await act('care_animal', { animalId: b }); assert.strictEqual(v.state.animals.find(x => x.id === b).produceAt, cared);
    assert.strictEqual(v.state.feed, 0); assert.strictEqual(v.state.inventory.eggs, 0);
    nowMs = cared - 100; const record = repo.accounts.get(buyer); record.state.animals.find(x => x.id === b).caredAt = 0;
    v = await act('care_animal', { animalId: b }); assert.strictEqual(v.state.animals.find(x => x.id === b).produceAt, nowMs);
    await expectCode(act('care_animal', { animalId: actionId() }), 'FARM_NOT_FOUND');
    const c = actionId(); repo.accounts.get(buyer).state.animals.push({ id: c, species: 'chicken', produceAt: nowMs - 1 });
    await expectCode(act('care_animal', { animalId: c }), 'FARM_NOT_READY');
  });

  await test('Historique marché : anciens comptes, plafond et entrées corrompues', async () => {
    assert.deepStrictEqual(normalizeState({ coins: 7 }, buyer).marketSales, []);
    const good = { id: actionId(), at: nowMs, items: [{ product: 'wheat', quantity: 2, unitPrice: 8 }], total: 16 };
    const malformed = { ...good, id: actionId(), total: 999999999 };
    const duplicate = { ...good, id: actionId(), items: [good.items[0], good.items[0]], total: 32 };
    const old = normalizeState({ marketSales: [malformed, duplicate, good] }, buyer);
    assert.deepStrictEqual(old.marketSales, [good], 'Prix historique conservé, entrées invalides rejetées');
    const many = Array.from({ length: 30 }, () => ({ ...good, id: actionId() }));
    assert.strictEqual(normalizeState({ marketSales: many }, buyer).marketSales.length, 25);
  });

  await test('Lucky Wheel : probabilités à 100 % et récompenses entières pour chaque mise autorisée', async () => {
    assert.strictEqual(WheelConfig.TOTAL_WEIGHT, 100);
    assert.deepStrictEqual(WheelConfig.STAKES, [50, 100, 200, 500]);
    WheelConfig.SEGMENTS.forEach((segment) => {
      assert.ok(segment.weight > 0);
      WheelConfig.STAKES.forEach((stake) => {
        const reward = WheelConfig.rewardFor(segment, stake);
        assert.ok(Number.isSafeInteger(reward.coins) && reward.coins >= 0);
        if (segment.kind === 'fta') assert.strictEqual(reward.ftaCoins, reward.coins);
        if (segment.kind === 'product') assert.ok(Config.PRODUCTS[reward.product] && reward.quantity >= 1);
      });
    });
    assert.strictEqual(WheelConfig.rewardFor('fta_small', 100).coins, 50);
    assert.strictEqual(WheelConfig.rewardFor('fta_big', 100).coins, 200);
  });

  await test('Lucky Wheel payant : avantage trésorerie après coins, FTA, feed, produits et bonus récursifs', async () => {
    const feedUnitValue = Config.FEED_PACK_PRICE / Config.FEED_PACK_QUANTITY;
    const bonusChance = WheelConfig.probability(WheelConfig.segmentById('extra_spin'));
    const immediateValue = (stake) => WheelConfig.SEGMENTS.reduce((total, segment) => {
      const reward = WheelConfig.rewardFor(segment, stake);
      const productValue = reward.product ? Config.PRODUCTS[reward.product].price * reward.quantity : 0;
      return total + WheelConfig.probability(segment) * (reward.coins + reward.feed * feedUnitValue + productValue);
    }, 0);
    // Un bonus peut attribuer un autre bonus : cette borne récursive inclut toute
    // la chaîne. Les tours gratuits et la production FARM restent hors du paid EV.
    const bonusValue = immediateValue(WheelConfig.BONUS_BASE_COINS) / (1 - bonusChance);
    WheelConfig.STAKES.forEach((stake) => {
      const expectedValue = immediateValue(stake) + bonusChance * bonusValue;
      assert.ok(expectedValue < stake, `${stake}: EV ${expectedValue}`);
      assert.ok(expectedValue / stake <= 0.95 + 1e-12, `${stake}: RTP ${expectedValue / stake}`);
    });
  });

  await test('Lucky Wheel : tour gratuit serveur, historique et rejeu sans nouveau débit ni tirage', async () => {
    const id = actionId();
    const body = await signed('action', wallet, { actionId: id, type: 'wheel_spin', params: { mode: 'free' } });
    const before = (await service.view(buyer)).state.coins;
    randomValues.push(segmentStart('coins_triple'));
    const result = await service.action(body);
    assert.strictEqual(result.spin.id, id); assert.strictEqual(result.spin.segmentId, 'coins_triple');
    assert.strictEqual(result.spin.coins, 60); assert.strictEqual(result.state.coins, before + 60);
    assert.strictEqual(result.state.wheel.totalSpins, 1); assert.strictEqual(result.state.wheel.recentSpins[0].id, id);
    const replay = await service.action(body);
    assert.strictEqual(replay.state.coins, result.state.coins); assert.strictEqual(replay.state.wheel.totalSpins, 1);
    assert.strictEqual(replay.spin.id, id); assert.strictEqual(randomValues.length, 0);
    await expectCode(wheelAction(actionId(), { mode: 'free' }), 'WHEEL_FREE_COOLDOWN');
  });

  await test('Lucky Wheel : mise autorisée, FTA converti en coins et paramètres client falsifiés ignorés', async () => {
    let before = (await service.view(buyer)).state.coins;
    randomValues.push(segmentStart('fta_big'));
    let result = await wheelAction(actionId(), { mode: 'paid', stake: '100', segmentId: 'coins_half', coins: '99999999' });
    assert.strictEqual(result.spin.segmentId, 'fta_big'); assert.strictEqual(result.spin.ftaCoins, 200);
    assert.strictEqual(result.state.coins, before - 100 + 200); assert.strictEqual(result.state.wheel.totalStaked, 100);
    before = result.state.coins; randomValues.push(segmentStart('coins_half'));
    result = await wheelAction(actionId(), { mode: 'paid', stake: '50', segmentId: 'fta_big', coins: '99999999' });
    assert.strictEqual(result.spin.segmentId, 'coins_half'); assert.strictEqual(result.spin.coins, 25);
    assert.strictEqual(result.state.coins, before - 50 + 25);
    const unchanged = result.state.coins;
    await expectCode(wheelAction(actionId(), { mode: 'paid', stake: '55' }), 'WHEEL_STAKE');
    assert.strictEqual((await service.view(buyer)).state.coins, unchanged);
  });

  await test('Lucky Wheel : toutes les récompenses créditées et tour bonus consommé sans mise', async () => {
    for (const segment of WheelConfig.SEGMENTS) {
      nowMs += WheelConfig.FREE_INTERVAL_MS;
      const before = (await service.view(buyer)).state;
      randomValues.push(segmentStart(segment.id));
      const result = await wheelAction(actionId(), { mode: 'free' });
      const reward = WheelConfig.rewardFor(segment, WheelConfig.FREE_BASE_COINS);
      assert.strictEqual(result.spin.segmentId, segment.id);
      assert.strictEqual(result.state.coins, before.coins + reward.coins);
      assert.strictEqual(result.state.feed, before.feed + reward.feed);
      assert.strictEqual(result.state.wheel.bonusSpins, before.wheel.bonusSpins + reward.bonusSpins);
      if (reward.product) assert.strictEqual(result.state.inventory[reward.product], before.inventory[reward.product] + reward.quantity);
    }
    const before = (await service.view(buyer)).state;
    assert.ok(before.wheel.bonusSpins >= 1); randomValues.push(segmentStart('feed'));
    const bonus = await wheelAction(actionId(), { mode: 'bonus' });
    assert.strictEqual(bonus.spin.mode, 'bonus'); assert.strictEqual(bonus.spin.stake, 0);
    assert.strictEqual(bonus.state.coins, before.coins); assert.strictEqual(bonus.state.feed, before.feed + 1);
    assert.strictEqual(bonus.state.wheel.bonusSpins, before.wheel.bonusSpins - 1);
    await expectCode(wheelAction(actionId(), { mode: 'bonus' }), 'WHEEL_BONUS_EMPTY');
  });

  await test('FITA Dice : rendement théorique ≤ 95 % pour chaque mise et chaque cible', async () => {
    assert.deepStrictEqual(DiceConfig.STAKES, [50, 100, 200, 500]);
    assert.deepStrictEqual(DiceConfig.TARGETS, [2, 3, 4, 5, 6]);
    DiceConfig.STAKES.forEach((stake) => DiceConfig.TARGETS.forEach((target) => {
      const payout = DiceConfig.payoutFor(stake, target);
      assert.ok(Number.isSafeInteger(payout) && payout > stake);
      assert.ok(DiceConfig.expectedReturnRatio(stake, target) <= 0.95);
      for (let roll = 1; roll <= 6; roll += 1) {
        const reward = DiceConfig.rewardFor(stake, target, roll);
        assert.strictEqual(reward.won, roll < target);
        assert.strictEqual(reward.coins, reward.won ? payout : 0);
      }
    }));
    assert.strictEqual(DiceConfig.payoutFor(50, 2), 285);
    assert.strictEqual(DiceConfig.payoutFor(50, 6), 57);
    assert.throws(() => DiceConfig.payoutFor(55, 4));
    assert.throws(() => DiceConfig.selectRoll(6));
  });

  await test('FITA Dice : tirage serveur, gain exact, historique et rejeu sans nouveau débit', async () => {
    const before = (await service.view(buyer)).state;
    const id = actionId();
    const body = await signed('action', wallet, { actionId: id, type: 'dice_roll', params: { stake: '100', target: '4', roll: '6', coins: '99999999' } });
    randomValues.push(1);
    const result = await service.action(body);
    assert.strictEqual(result.roll.id, id); assert.strictEqual(result.roll.roll, 2);
    assert.strictEqual(result.roll.won, true); assert.strictEqual(result.roll.coins, 190);
    assert.strictEqual(result.state.coins, before.coins + 90);
    assert.strictEqual(result.state.dice.totalRolls, before.dice.totalRolls + 1);
    assert.strictEqual(result.state.dice.recentRolls[0].id, id);
    const replay = await service.action(body);
    assert.strictEqual(replay.state.coins, result.state.coins);
    assert.strictEqual(replay.state.dice.totalRolls, result.state.dice.totalRolls);
    assert.strictEqual(replay.roll.id, id); assert.strictEqual(randomValues.length, 0);

    randomValues.push(1);
    const loss = await diceAction(actionId(), { stake: 50, target: 2 });
    assert.strictEqual(loss.roll.roll, 2); assert.strictEqual(loss.roll.won, false); assert.strictEqual(loss.roll.coins, 0);
    assert.strictEqual(loss.state.coins, result.state.coins - 50);
    const unchanged = loss.state.coins;
    await expectCode(diceAction(actionId(), { stake: 55, target: 4 }), 'DICE_STAKE');
    await expectCode(diceAction(actionId(), { stake: 50, target: 1 }), 'DICE_TARGET');
    assert.strictEqual((await service.view(buyer)).state.coins, unchanged);
  });

  await test('FITA Dice : réponse perdue après commit, récupération du même résultat sans double mutation', async () => {
    const before = (await service.view(buyer)).state;
    const lostRepository = {
      get: (...args) => repository.get(...args), listWithdrawals: (...args) => repository.listWithdrawals(...args),
      isActionProcessed: (...args) => repository.isActionProcessed(...args),
      async apply(...args) { await repository.apply(...args); throw new FarmError(500, 'Réponse perdue après commit.', 'FARM_NETWORK'); }
    };
    const recoveryService = createFarmService({ repository: lostRepository, now: () => new Date(nowMs), randomInt: () => randomValues.length ? randomValues.shift() : 0, paymentVerifier: async () => verification });
    const id = actionId(); randomValues.push(3);
    const recovered = await diceAction(id, { stake: 50, target: 6 }, wallet, recoveryService);
    assert.strictEqual(recovered.roll.id, id); assert.strictEqual(recovered.roll.roll, 4);
    assert.strictEqual(recovered.state.coins, before.coins - 50 + recovered.roll.coins);
    const replay = await diceAction(id, { stake: 50, target: 6 });
    assert.strictEqual(replay.state.coins, recovered.state.coins);
    assert.strictEqual(replay.state.dice.totalRolls, recovered.state.dice.totalRolls);
    assert.strictEqual(replay.roll.roll, 4); assert.strictEqual(randomValues.length, 0);
  });

  await test('Retrait FTA : minimum 10 FTA, débit atomique, demande persistante et montants invalides', async () => {
    assert.strictEqual(Config.MIN_WITHDRAW_COINS, 1000);
    assert.strictEqual(Config.MAX_WITHDRAW_COINS, 10000);
    const before = (await service.view(buyer)).state.coins;
    await expectCode(service.withdraw(await signed('withdraw', wallet, { actionId: actionId(), coins: 100 })), 'FARM_AMOUNT');
    await expectCode(service.withdraw(await signed('withdraw', wallet, { actionId: actionId(), coins: 900 })), 'FARM_AMOUNT');
    const guarded = createFarmService({ repository, now: () => new Date(nowMs), withdrawalGuard: async ({ wallet: actual, coins, code }) => {
      assert.strictEqual(actual, buyer); assert.strictEqual(coins, 1000); assert.strictEqual(code, undefined);
      throw new FarmError(403, 'Code requis', 'FARM_MFA_REQUIRED');
    } });
    await expectCode(guarded.withdraw(await signed('withdraw', wallet, { actionId: actionId(), coins: 1000 })), 'FARM_MFA_REQUIRED');
    assert.strictEqual((await service.view(buyer)).state.coins, before);
    const id = actionId();
    const result = await service.withdraw(await signed('withdraw', wallet, { actionId: id, coins: 1000 }));
    assert.strictEqual(result.state.coins, before - 1000);
    assert.strictEqual(result.withdrawals[0].id, id);
    assert.strictEqual(result.withdrawals[0].status, 'pending');
    assert.strictEqual(result.withdrawals[0].ftaUnits, '1000000000');
    const repeated = await service.withdraw(await signed('withdraw', wallet, { actionId: id, coins: 1000 }));
    assert.strictEqual(repeated.state.coins, before - 1000);
    await expectCode(service.withdraw(await signed('withdraw', wallet, { actionId: actionId(), coins: 99 })), 'FARM_AMOUNT');
    await expectCode(service.withdraw(await signed('withdraw', wallet, { actionId: actionId(), coins: 1100 })), 'FARM_WITHDRAWAL_PENDING');
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
    await expectCode(service.withdraw(await signed('withdraw', wallet, { actionId: actionId(), coins: 1000 })), 'FARM_WITHDRAWAL_COOLDOWN');
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
    await deposit('10');
    const created = await service.withdraw(await signed('withdraw', wallet, { actionId: actionId(), coins: 1000 }));
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

  await test('Migration Supabase : Dice atomique, minimum SQL de 1 000 coins et privilèges serveur', async () => {
    const migration = fs.readFileSync(`${__dirname}/../supabase/migrations/20261029000400_add_dice_and_withdrawal_minimum.sql`, 'utf8');
    assert.ok(migration.includes("'wheel_spin', 'dice_roll'"));
    assert.ok(migration.includes('{dice,recentRolls,0,id}'));
    assert.ok(migration.includes('p_coins < 1000'));
    assert.ok(migration.includes('p_coins % 100 <> 0'));
    assert.ok(migration.includes('to service_role'));
    assert.ok(migration.includes('from public, anon, authenticated'));
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
