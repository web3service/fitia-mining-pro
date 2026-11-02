#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const ethers = require('../vendor/ethers.umd.min.js');
const Protocol = require('../farm-protocol');
const Config = require('../arcade-config');
const { MemoryFarmRepository, createFarmService, FarmError } = require('../farm-service');

let passed = 0; let failed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); }
}
const wallet = new ethers.Wallet(`0x${'46'.repeat(32)}`);
const otherWallet = new ethers.Wallet(`0x${'47'.repeat(32)}`);
const buyer = wallet.address.toLowerCase();
let nowMs = Date.parse('2026-11-02T12:00:00.000Z');
let nextSeed = `0x${'11'.repeat(32)}`;
const repository = new MemoryFarmRepository();
const randomBytes = () => Buffer.from(nextSeed.replace(/^0x/, ''), 'hex');
const service = createFarmService({ repository, now: () => new Date(nowMs), randomBytes, randomInt: () => 0, paymentVerifier: async () => ({ confirmed: true }) });
const actionId = () => crypto.randomUUID();
async function signed(action, params = {}, signer = wallet) {
  const body = { action, buyer: signer.address, timestamp: nowMs, ...params };
  body.signature = await signer.signMessage(Protocol.message(action, body)); return body;
}
async function action(id, type, params = {}, targetService = service, signer = wallet) {
  return targetService.action(await signed('action', { actionId: id, type, params }, signer));
}
async function call(type, params = {}) { return action(actionId(), type, params); }
async function expectCode(promise, code) { await assert.rejects(promise, (error) => error.code === code || String(error.message).includes(code)); }
function randomValue(seed, clientSeed, roundId) {
  const digest = crypto.createHmac('sha256', Buffer.from(seed, 'hex')).update(`${clientSeed}:${roundId}`).digest();
  return Math.floor(digest.readUInt32BE(0) * Config.CRASH_RANDOM_RANGE / 0x100000000);
}
function seedFor(roundId, clientSeed, predicate) {
  for (let nonce = 0; nonce < 100000; nonce += 1) {
    const seed = crypto.createHash('sha256').update(`aviator-test:${nonce}`).digest('hex');
    if (predicate(Config.selectCrashPoint(randomValue(seed, clientSeed, roundId)))) return seed;
  }
  throw new Error('No deterministic test seed found.');
}
function recoveryService() {
  const lostRepository = {
    get: (...args) => repository.get(...args), listWithdrawals: (...args) => repository.listWithdrawals(...args),
    isActionProcessed: (...args) => repository.isActionProcessed(...args),
    async apply(...args) { await repository.apply(...args); throw new FarmError(500, 'Réponse perdue après commit.', 'FARM_NETWORK'); }
  };
  return createFarmService({ repository: lostRepository, now: () => new Date(nowMs), randomBytes, randomInt: () => 0, paymentVerifier: async () => ({ confirmed: true }) });
}
async function startRound({ id = actionId(), slot = 1, stake = 100, autoTargetBps = null, clientSeed = actionId(), crash = () => true, targetService = service } = {}) {
  nextSeed = seedFor(id, clientSeed, crash);
  const body = await signed('action', { actionId: id, type: 'crash_start', params: { slot, stake, autoTargetBps, clientSeed } });
  const result = await targetService.action(body);
  return { id, clientSeed, body, result, round: result.state.crash.active };
}

(async () => {
  console.log('\n✈️  TESTS FITIA AVIATOR\n' + '═'.repeat(72));
  await test('Économie et horloge : croissance continue, paiements entiers et RTP ≤ 95 %', async () => {
    assert.strictEqual(Config.crashMultiplierAt(0), 100);
    assert.strictEqual(Config.crashMultiplierAt(Config.crashTimeForMultiplier(200)), 200);
    assert.strictEqual(Config.crashMultiplierAt(Config.crashTimeForMultiplier(1000)), 1000);
    assert.strictEqual(Config.aviatorPayout(75, 200), 150);
    assert.strictEqual(Config.aviatorPayout(75, 155), 116);
    for (const target of [101, 125, 150, 200, 333, 500, 1000, 10000]) {
      const chance = Config.aviatorWinningOutcomes(target) / Config.CRASH_RANDOM_RANGE;
      assert.ok(chance * target / 100 <= 0.95 + 1e-12, `${target}: ${chance}`);
    }
    assert.strictEqual(Config.normalizeAviatorStake(75), 75);
    assert.strictEqual(Config.normalizeAviatorStake(49), null);
    assert.strictEqual(Config.normalizeAviatorTarget(175), 175);
    assert.strictEqual(Config.normalizeAviatorTarget(100), null);
  });

  await test('Compte FARM partagé : activation et solde initial', async () => {
    await service.deposit(await signed('deposit', { actionId: actionId(), txHash: `0x${'ab'.repeat(32)}`, amountUnits: ethers.parseUnits('100', 8).toString() }));
    await call('buy_land'); await call('buy_animal', { species: 'chicken' });
    assert.strictEqual((await service.view(buyer)).state.coins, 9250);
  });

  let dual;
  await test('Deux mises sur le même vol, débit exact et point de crash secret', async () => {
    const before = (await service.view(buyer)).state.coins;
    dual = await startRound({ stake: 75, slot: 1, clientSeed: 'dual-client-seed', crash: (point) => point >= 500 });
    assert.strictEqual(dual.result.state.coins, before - 75);
    assert.strictEqual(dual.round.status, 'betting');
    assert.strictEqual(dual.round.crashBps, undefined);
    assert.strictEqual(dual.round.crashAt, undefined);
    assert.strictEqual(dual.round.serverSeed, undefined);
    assert.strictEqual(dual.round.randomValue, undefined);
    assert.ok(!JSON.stringify(dual.result).includes('serverSeed'));
    const stored = await repository.get(buyer);
    assert.ok(stored.state.crash.active.crashBps >= 500);
    assert.strictEqual(stored.state.crash.active.seedHash, crypto.createHash('sha256').update(nextSeed).digest('hex'));
    const replay = await service.action(dual.body);
    assert.strictEqual(replay.state.coins, before - 75);
    assert.strictEqual(replay.state.crash.active.bets.length, 1);
    nowMs += 1000;
    const joined = await call('crash_bet', { roundId: dual.id, slot: 2, stake: 125, autoTargetBps: 150, clientSeed: 'ignored-on-join' });
    assert.strictEqual(joined.state.coins, before - 200);
    assert.strictEqual(joined.state.crash.active.bets.length, 2);
    assert.strictEqual(joined.state.crash.active.stake, 200);
    assert.strictEqual(joined.state.crash.active.bets[1].autoTargetBps, 150);
    await expectCode(call('crash_bet', { roundId: dual.id, slot: 2, stake: 50, autoTargetBps: null }), 'CRASH_BET_ACTIVE');
  });

  let dualCashoutBody;
  await test('Cashouts indépendants : Auto 1,50× puis manuel 2,00× sur le même vol', async () => {
    const stored = await repository.get(buyer); const startsMs = Date.parse(stored.state.crash.active.startsAt);
    nowMs = startsMs - 1;
    const beforeRevision = (await service.view(buyer)).revision;
    const early = await call('crash_sync', { roundId: dual.id });
    assert.strictEqual(early.revision, beforeRevision);
    assert.strictEqual(early.state.crash.active.status, 'betting');
    nowMs = startsMs;
    const flying = await call('crash_sync', { roundId: dual.id });
    assert.strictEqual(flying.state.crash.active.status, 'flying');
    const cashoutId = actionId();
    nowMs = startsMs + Config.crashTimeForMultiplier(200);
    const before = (await service.view(buyer)).state.coins;
    dualCashoutBody = await signed('action', { actionId: cashoutId, type: 'crash_cashout', params: { roundId: dual.id, slot: 1 } });
    const cashed = await service.action(dualCashoutBody);
    const bets = cashed.state.crash.active.bets;
    assert.strictEqual(bets[0].status, 'cashed'); assert.strictEqual(bets[0].cashoutKind, 'manual'); assert.strictEqual(bets[0].cashoutBps, 200); assert.strictEqual(bets[0].coins, 150);
    assert.strictEqual(bets[1].status, 'cashed'); assert.strictEqual(bets[1].cashoutKind, 'auto'); assert.strictEqual(bets[1].cashoutBps, 150); assert.strictEqual(bets[1].coins, 187);
    assert.strictEqual(cashed.state.coins, before + 337);
    assert.strictEqual(cashed.crashAction.events.length, 2);
    assert.strictEqual(cashed.state.crash.active.crashBps, undefined);
    const replay = await service.action(dualCashoutBody);
    assert.strictEqual(replay.state.coins, cashed.state.coins);
    assert.strictEqual(replay.crashAction.events.length, 2);
  });

  await test('Clôture différée : le vol continue après les cashouts puis révèle sa preuve SHA-256', async () => {
    const stored = await repository.get(buyer); const crashMs = Date.parse(stored.state.crash.active.crashAt);
    const before = (await service.view(buyer)).state.coins;
    nowMs = crashMs + 50;
    const finished = await call('crash_sync', { roundId: dual.id });
    assert.strictEqual(finished.state.crash.active, null);
    const round = finished.state.crash.recentRounds[0];
    assert.strictEqual(round.id, dual.id); assert.strictEqual(round.status, 'crashed'); assert.strictEqual(round.coins, 337);
    assert.strictEqual(finished.state.coins, before);
    assert.ok(round.crashBps >= 500); assert.strictEqual(round.serverSeed, nextSeed);
    assert.strictEqual(round.seedHash, crypto.createHash('sha256').update(round.serverSeed).digest('hex'));
    assert.strictEqual(randomValue(round.serverSeed, round.clientSeed, round.id), round.randomValue);
    assert.strictEqual(Config.selectCrashPoint(round.randomValue), round.crashBps);
    const replay = await service.action(dualCashoutBody);
    assert.strictEqual(replay.crashAction.events.length, 2);
    assert.strictEqual(replay.state.coins, before);
  });

  await test('Cashout trop tardif : mise réellement perdue et rejeu sans second débit', async () => {
    const started = await startRound({ stake: 50, crash: (point) => point === 100 });
    const before = started.result.state.coins;
    const stored = await repository.get(buyer); nowMs = Date.parse(stored.state.crash.active.crashAt);
    const id = actionId();
    const body = await signed('action', { actionId: id, type: 'crash_cashout', params: { roundId: started.id, slot: 1 } });
    const lost = await service.action(body);
    assert.strictEqual(lost.crashAction.crash, true);
    assert.strictEqual(lost.crashAction.events[0].kind, 'lost');
    assert.strictEqual(lost.state.crash.recentRounds[0].bets[0].status, 'lost');
    assert.strictEqual(lost.state.coins, before);
    const replay = await service.action(body);
    assert.strictEqual(replay.state.coins, before);
    assert.strictEqual(replay.crashAction.crash, true);
  });

  await test('Auto Cashout serveur : crédit à la cible même si la synchronisation est tardive', async () => {
    const started = await startRound({ stake: 80, autoTargetBps: 200, crash: (point) => point >= 400 });
    const stored = await repository.get(buyer); const startsMs = Date.parse(stored.state.crash.active.startsAt);
    const before = started.result.state.coins;
    nowMs = startsMs + Config.crashTimeForMultiplier(300) + 500;
    const synced = await service.getState(await signed('state'));
    const bet = synced.state.crash.active.bets[0];
    assert.strictEqual(bet.status, 'cashed'); assert.strictEqual(bet.cashoutBps, 200); assert.strictEqual(bet.coins, 160);
    assert.strictEqual(bet.settledAt, new Date(startsMs + Config.crashTimeForMultiplier(200)).toISOString());
    assert.strictEqual(synced.state.coins, before + 160);
    nowMs = Date.parse((await repository.get(buyer)).state.crash.active.crashAt) + 1;
    const closed = await service.getState(await signed('state'));
    assert.strictEqual(closed.state.crash.active, null);
    assert.strictEqual(closed.state.crash.recentRounds[0].id, started.id);
  });

  await test('Réponses perdues : reprise du démarrage et du cashout sans double mutation', async () => {
    const before = (await service.view(buyer)).state.coins;
    const started = await startRound({ stake: 60, crash: (point) => point >= 400, targetService: recoveryService() });
    assert.strictEqual(started.result.state.crash.active.stake, 60);
    let replay = await service.action(started.body);
    assert.strictEqual(replay.state.coins, before - 60);
    const stored = await repository.get(buyer); nowMs = Date.parse(stored.state.crash.active.startsAt) + Config.crashTimeForMultiplier(180);
    const cashoutId = actionId();
    const body = await signed('action', { actionId: cashoutId, type: 'crash_cashout', params: { roundId: started.id, slot: 1 } });
    const recovered = await recoveryService().action(body);
    assert.strictEqual(recovered.crashAction.events[0].kind, 'manual');
    const coins = recovered.state.coins;
    replay = await service.action(body);
    assert.strictEqual(replay.state.coins, coins);
    assert.strictEqual(replay.state.crash.active.bets[0].coins, 108);
    nowMs = Date.parse((await repository.get(buyer)).state.crash.active.crashAt) + 1;
    await call('crash_sync', { roundId: started.id });
  });

  await test('Isolation wallet et validation stricte des paramètres publics', async () => {
    const other = await service.getState(await signed('state', {}, otherWallet));
    assert.strictEqual(other.state.crash.active, null);
    await expectCode(call('crash_start', { slot: 3, stake: 50, autoTargetBps: null }), 'CRASH_SLOT');
    await expectCode(call('crash_start', { slot: 1, stake: 49, autoTargetBps: null }), 'CRASH_STAKE');
    await expectCode(call('crash_start', { slot: 1, stake: 50, autoTargetBps: 100 }), 'CRASH_TARGET');
  });

  await test('Migration Supabase : actions Aviator atomiques et privilèges service-role', async () => {
    const migration = fs.readFileSync(`${__dirname}/../supabase/migrations/20261102120000_add_aviator_crash.sql`, 'utf8');
    for (const type of ['crash_start', 'crash_bet', 'crash_cashout', 'crash_sync', 'crash_play']) assert.ok(migration.includes(`'${type}'`));
    assert.ok(migration.includes('{crash,active,id}')); assert.ok(migration.includes('{crash,recentRounds,0,id}'));
    assert.ok(migration.includes('to service_role')); assert.ok(migration.includes('from public, anon, authenticated'));
  });

  console.log('═'.repeat(72)); console.log(`✈️ RÉSULTAT AVIATOR : ${passed} réussis, ${failed} échoués`);
  if (failed) process.exit(1);
})().catch((error) => { console.error(error); process.exit(1); });
