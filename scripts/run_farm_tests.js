#!/usr/bin/env node
'use strict';
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
    result = await callAction('sell');
    assert.strictEqual(result.state.coins, before + 30 + 24 + 36);
    assert.ok(Object.values(result.state.inventory).every((quantity) => quantity === 0));
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
