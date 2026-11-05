#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const ethers = require('../vendor/ethers.umd.min.js');
const Protocol = require('../farm-protocol');
const Config = require('../arcade-config');
const { MemoryFarmRepository, createFarmService, FarmError } = require('../farm-service');
const { GLOBAL_CLIENT_SEED, RESULTS_MS } = require('../aviator-service');

let passed = 0; let failed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); }
}
const walletA = new ethers.Wallet(`0x${'56'.repeat(32)}`);
const walletB = new ethers.Wallet(`0x${'57'.repeat(32)}`);
const actionId = () => crypto.randomUUID();
function randomValue(seed, roundId) {
  const digest = crypto.createHmac('sha256', Buffer.from(seed, 'hex')).update(`${GLOBAL_CLIENT_SEED}:${roundId}`).digest();
  return Math.floor(digest.readUInt32BE(0) * Config.CRASH_RANDOM_RANGE / 0x100000000);
}
function seedFor(roundId, predicate) {
  for (let nonce = 0; nonce < 100000; nonce += 1) {
    const seed = crypto.createHash('sha256').update(`global-aviator-test:${nonce}`).digest('hex');
    if (predicate(Config.selectCrashPoint(randomValue(seed, roundId)))) return seed;
  }
  throw new Error('No deterministic test seed found.');
}
async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error.code === code || String(error.message).includes(code));
}

function harness() {
  let nowMs = Date.parse('2026-11-05T12:00:00.000Z');
  let predicate = (point) => point >= 500;
  const repository = new MemoryFarmRepository();
  const options = {
    repository, now: () => new Date(nowMs), randomInt: () => 0,
    randomBytes: (size, context) => Buffer.from(seedFor(context.roundId, predicate), 'hex'),
    paymentVerifier: async () => ({ confirmed: true })
  };
  const service = createFarmService({ ...options, multiplayer: true });
  async function signed(action, params = {}, signer = walletA) {
    const body = { action, buyer: signer.address, timestamp: nowMs, ...params };
    body.signature = await signer.signMessage(Protocol.message(action, body)); return body;
  }
  async function perform(type, params = {}, signer = walletA, target = service, id = actionId()) {
    const body = await signed('action', { actionId: id, type, params }, signer);
    return { id, body, result: await target.action(body) };
  }
  async function call(type, params = {}, signer = walletA) { return (await perform(type, params, signer)).result; }
  async function state(signer = walletA) { return service.getState(await signed('state', {}, signer)); }
  async function fund(signer) {
    await service.deposit(await signed('deposit', {
      actionId: actionId(), txHash: `0x${signer === walletA ? 'ab' : 'cd'}${'00'.repeat(31)}`,
      amountUnits: ethers.parseUnits('100', 8).toString()
    }, signer));
    await call('buy_land', {}, signer); await call('buy_animal', { species: 'chicken' }, signer);
  }
  async function setup() {
    const first = await state(walletA); const roundId = first.aviator.round.id;
    await fund(walletA); await fund(walletB);
    return roundId;
  }
  async function internal() { return (await repository.getAviator()).state; }
  return {
    repository, service, signed, perform, call, state, fund, setup, internal,
    setNow: (value) => { nowMs = value; }, now: () => nowMs,
    setCrash: (value) => { predicate = value; },
    options: () => ({ ...options, now: () => new Date(nowMs) })
  };
}

(async () => {
  console.log('\n🌐 TESTS AVIATOR MULTIJOUEUR\n' + '═'.repeat(72));
  await test('Manche mondiale automatique : même horloge, même crash et nouvelle manche', async () => {
    const h = harness(); const first = await h.state(walletA); const second = await h.state(walletB);
    const round = first.aviator.round;
    assert.strictEqual(second.aviator.round.id, round.id);
    assert.strictEqual(round.status, 'betting'); assert.strictEqual(round.bets.length, 0);
    assert.strictEqual(round.crashBps, undefined); assert.strictEqual(round.serverSeed, undefined);
    assert.ok(!JSON.stringify(first).includes('serverSeed'));
    h.setNow(Date.parse(round.startsAt));
    const flying = await h.call('crash_sync', { roundId: round.id }, walletB);
    assert.strictEqual(flying.aviator.round.status, 'flying');
    const crashMs = Date.parse((await h.internal()).active.crashAt);
    h.setNow(crashMs + 1);
    const crashedA = await h.state(walletA); const crashedB = await h.state(walletB);
    assert.strictEqual(crashedA.aviator.round.id, round.id);
    assert.strictEqual(crashedA.aviator.round.status, 'crashed');
    assert.strictEqual(crashedA.aviator.round.crashBps, crashedB.aviator.round.crashBps);
    const proof = crashedA.aviator.round;
    assert.strictEqual(proof.seedHash, crypto.createHash('sha256').update(proof.serverSeed).digest('hex'));
    assert.strictEqual(randomValue(proof.serverSeed, proof.id), proof.randomValue);
    assert.strictEqual(Config.selectCrashPoint(proof.randomValue), proof.crashBps);
    h.setNow(crashMs + RESULTS_MS + 1);
    const next = await h.state(walletB);
    assert.notStrictEqual(next.aviator.round.id, round.id);
    assert.strictEqual(next.aviator.round.status, 'betting');
    assert.strictEqual(next.aviator.history[0].id, round.id);
    assert.strictEqual(next.aviator.history[0].crashBps, proof.crashBps);
  });

  await test('Deux wallets réels : mises visibles, adresses masquées et débits isolés', async () => {
    const h = harness(); const roundId = await h.setup();
    const a = await h.call('crash_start', { slot: 1, stake: 100, autoTargetBps: 150, clientSeed: 'wallet-a-seed' }, walletA);
    const b = await h.call('crash_bet', { roundId, slot: 1, stake: 200, autoTargetBps: null }, walletB);
    const a2 = await h.call('crash_bet', { roundId, slot: 2, stake: 50, autoTargetBps: null }, walletA);
    assert.strictEqual(a.aviator.round.id, roundId); assert.strictEqual(b.aviator.round.id, roundId);
    assert.strictEqual(a2.aviator.round.playerCount, 2); assert.strictEqual(a2.aviator.round.bets.length, 3);
    assert.strictEqual(a2.aviator.round.stake, 350);
    assert.strictEqual(a2.state.crash.active.bets.length, 2);
    assert.strictEqual(b.state.crash.active.bets.length, 1);
    const other = b.aviator.round.bets.find((bet) => !bet.mine);
    assert.ok(other); assert.ok(other.wallet.includes('…')); assert.ok(!JSON.stringify(b.aviator).includes(walletA.address.toLowerCase()));
    assert.strictEqual(a2.state.coins, 9100); assert.strictEqual(b.state.coins, 9050);
    assert.strictEqual(a2.state.crash.totalRounds, 1); assert.strictEqual(a2.state.crash.totalStaked, 150);
    assert.ok(a2.aviator.round.bets.every((bet) => bet.mine || bet.actionId === undefined));
  });

  await test('Cashout manuel et automatique entre joueurs, puis preuve et historique communs', async () => {
    const h = harness(); const roundId = await h.setup();
    await h.call('crash_start', { slot: 1, stake: 100, autoTargetBps: 150, clientSeed: 'shared-auto-seed' }, walletA);
    await h.call('crash_bet', { roundId, slot: 2, stake: 50, autoTargetBps: null }, walletA);
    await h.call('crash_bet', { roundId, slot: 1, stake: 200, autoTargetBps: null }, walletB);
    const startsMs = Date.parse((await h.internal()).active.startsAt);
    h.setNow(startsMs + Config.crashTimeForMultiplier(200));
    const cashed = await h.call('crash_cashout', { roundId, slot: 1 }, walletB);
    const live = cashed.aviator.round.bets;
    assert.strictEqual(live.find((bet) => bet.mine).status, 'cashed');
    assert.strictEqual(live.find((bet) => bet.mine).cashoutBps, 200);
    assert.strictEqual(live.filter((bet) => !bet.mine && bet.status === 'cashed').length, 1);
    const a = await h.service.view(walletA.address.toLowerCase());
    assert.strictEqual(a.state.coins, 9250); assert.strictEqual(cashed.state.coins, 9450);
    const ownA = a.state.crash.active.bets;
    assert.strictEqual(ownA.find((bet) => bet.slot === 1).cashoutKind, 'auto');
    assert.strictEqual(ownA.find((bet) => bet.slot === 1).coins, 150);
    assert.strictEqual(ownA.find((bet) => bet.slot === 2).status, 'active');
    const crashMs = Date.parse((await h.internal()).active.crashAt);
    h.setNow(crashMs + 1);
    const closedA = await h.state(walletA); const closedB = await h.state(walletB);
    assert.strictEqual(closedA.state.crash.active.bets.find((bet) => bet.slot === 2).status, 'lost');
    assert.strictEqual(closedA.state.crash.active.crashBps, closedB.state.crash.active.crashBps);
    assert.strictEqual(closedA.state.coins, 9250); assert.strictEqual(closedB.state.coins, 9450);
    h.setNow(crashMs + RESULTS_MS + 1);
    const nextA = await h.state(walletA); const nextB = await h.state(walletB);
    assert.strictEqual(nextA.aviator.history[0].id, nextB.aviator.history[0].id);
    assert.strictEqual(nextA.aviator.history[0].crashBps, nextB.aviator.history[0].crashBps);
    assert.strictEqual(nextA.state.crash.recentRounds[0].id, roundId);
  });

  await test('Auto Cashout serveur pendant la déconnexion, sans double crédit à la reprise', async () => {
    const h = harness(); const roundId = await h.setup();
    const placed = await h.call('crash_start', { slot: 1, stake: 80, autoTargetBps: 200, clientSeed: 'offline-auto-seed' }, walletA);
    const before = placed.state.coins; const startsMs = Date.parse((await h.internal()).active.startsAt);
    h.setNow(startsMs + Config.crashTimeForMultiplier(300) + 500);
    await h.state(walletB);
    const resumed = await h.service.view(walletA.address.toLowerCase());
    const bet = resumed.state.crash.active.bets[0];
    assert.strictEqual(bet.status, 'cashed'); assert.strictEqual(bet.cashoutBps, 200); assert.strictEqual(bet.coins, 160);
    assert.strictEqual(bet.settledAt, new Date(startsMs + Config.crashTimeForMultiplier(200)).toISOString());
    assert.strictEqual(resumed.state.coins, before + 160);
    await h.state(walletA); await h.state(walletB);
    assert.strictEqual((await h.service.view(walletA.address.toLowerCase())).state.coins, before + 160);
    const crashMs = Date.parse((await h.internal()).active.crashAt);
    h.setNow(crashMs + 1); await h.state(walletB);
    assert.strictEqual((await h.service.view(walletA.address.toLowerCase())).state.coins, before + 160);
  });

  await test('Cashout trop tardif : aucun crédit et perte commune constatée après le crash', async () => {
    const h = harness(); const roundId = await h.setup();
    const placed = await h.call('crash_start', { slot: 1, stake: 50, autoTargetBps: null, clientSeed: 'late-player-seed' }, walletB);
    const crashMs = Date.parse((await h.internal()).active.crashAt); h.setNow(crashMs);
    const lateId = actionId();
    const lateBody = await h.signed('action', { actionId: lateId, type: 'crash_cashout', params: { roundId, slot: 1 } }, walletB);
    await expectCode(h.service.action(lateBody), 'CRASH_CASHOUT_LATE');
    await h.state(walletA);
    const lost = await h.service.view(walletB.address.toLowerCase());
    assert.strictEqual(lost.state.crash.active.bets[0].status, 'lost');
    assert.strictEqual(lost.state.coins, placed.state.coins);
    await expectCode(h.service.action(lateBody), 'CRASH_CASHOUT_LATE');
    assert.strictEqual((await h.service.view(walletB.address.toLowerCase())).state.coins, placed.state.coins);
  });

  await test('Réponses perdues après commit : reprise sans double débit ni double crédit', async () => {
    const h = harness(); const roundId = await h.setup();
    const lostRepository = {
      get: (...args) => h.repository.get(...args), getAviator: (...args) => h.repository.getAviator(...args),
      listWithdrawals: (...args) => h.repository.listWithdrawals(...args),
      isActionProcessed: (...args) => h.repository.isActionProcessed(...args),
      apply: (...args) => h.repository.apply(...args),
      async applyAviator(...args) { await h.repository.applyAviator(...args); throw new FarmError(500, 'Réponse perdue après commit.', 'FARM_NETWORK'); }
    };
    const recovery = createFarmService({ ...h.options(), repository: lostRepository, multiplayer: true });
    const before = (await h.service.view(walletA.address.toLowerCase())).state.coins;
    const placed = await h.perform('crash_start', { slot: 1, stake: 60, autoTargetBps: null, clientSeed: 'recovery-global-seed' }, walletA, recovery);
    assert.strictEqual(placed.result.state.coins, before - 60);
    const replay = await h.service.action(placed.body);
    assert.strictEqual(replay.state.coins, before - 60); assert.strictEqual(replay.state.crash.active.bets.length, 1);
    const startsMs = Date.parse((await h.internal()).active.startsAt);
    h.setNow(startsMs + Config.crashTimeForMultiplier(180));
    const cashed = await h.perform('crash_cashout', { roundId, slot: 1 }, walletA, recovery);
    assert.strictEqual(cashed.result.crashAction.events[0].kind, 'manual');
    assert.strictEqual(cashed.result.state.coins, before - 60 + 108);
    const replayCashout = await h.service.action(cashed.body);
    assert.strictEqual(replayCashout.state.coins, cashed.result.state.coins);
  });

  await test('Courses concurrentes : une seule mise par panneau et deux wallets acceptés sur le même vol', async () => {
    const h = harness(); const roundId = await h.setup();
    const before = (await h.service.view(walletA.address.toLowerCase())).state.coins;
    const firstBody = await h.signed('action', { actionId: actionId(), type: 'crash_start', params: { slot: 1, stake: 75, autoTargetBps: null, clientSeed: 'race-one-seed' } }, walletA);
    const secondBody = await h.signed('action', { actionId: actionId(), type: 'crash_start', params: { slot: 1, stake: 75, autoTargetBps: null, clientSeed: 'race-two-seed' } }, walletA);
    const race = await Promise.allSettled([h.service.action(firstBody), h.service.action(secondBody)]);
    assert.strictEqual(race.filter((entry) => entry.status === 'fulfilled').length, 1);
    assert.strictEqual(race.filter((entry) => entry.status === 'rejected').length, 1);
    assert.strictEqual(race.find((entry) => entry.status === 'rejected').reason.code, 'CRASH_BET_ACTIVE');
    assert.strictEqual((await h.service.view(walletA.address.toLowerCase())).state.coins, before - 75);
    const other = await Promise.all([
      h.call('crash_bet', { roundId, slot: 2, stake: 50, autoTargetBps: null }, walletA),
      h.call('crash_bet', { roundId, slot: 1, stake: 100, autoTargetBps: null }, walletB)
    ]);
    assert.strictEqual(other[0].aviator.round.id, roundId); assert.strictEqual(other[1].aviator.round.id, roundId);
    const final = await h.service.view(walletB.address.toLowerCase());
    assert.strictEqual(final.aviator.round.playerCount, 2); assert.strictEqual(final.aviator.round.bets.length, 3);
    assert.strictEqual(final.aviator.round.stake, 225);
  });

  await test('Isolation des cashouts et validation des paramètres multijoueurs', async () => {
    const h = harness(); const roundId = await h.setup();
    await expectCode(h.call('crash_start', { slot: 3, stake: 50, autoTargetBps: null, clientSeed: 'invalid-slot-seed' }, walletA), 'CRASH_SLOT');
    await expectCode(h.call('crash_start', { slot: 1, stake: 49, autoTargetBps: null, clientSeed: 'invalid-stake-seed' }, walletA), 'CRASH_STAKE');
    await expectCode(h.call('crash_start', { slot: 1, stake: 50, autoTargetBps: 100, clientSeed: 'invalid-target-seed' }, walletA), 'CRASH_TARGET');
    await h.call('crash_start', { slot: 1, stake: 50, autoTargetBps: null, clientSeed: 'isolated-cashout-seed' }, walletA);
    await expectCode(h.call('crash_bet', { roundId: actionId(), slot: 2, stake: 50, autoTargetBps: null }, walletA), 'CRASH_ROUND');
    const startsMs = Date.parse((await h.internal()).active.startsAt);
    h.setNow(startsMs + Config.crashTimeForMultiplier(180));
    await expectCode(h.call('crash_cashout', { roundId, slot: 1 }, walletB), 'CRASH_CASHOUT_SETTLED');
    const a = await h.service.view(walletA.address.toLowerCase());
    assert.strictEqual(a.state.crash.active.bets[0].status, 'active');
  });

  await test('Aucun joueur simulé : une salle vide reste vide et un seul wallet reste seul', async () => {
    const h = harness(); const empty = await h.state(walletA);
    assert.strictEqual(empty.aviator.round.playerCount, 0); assert.deepStrictEqual(empty.aviator.round.bets, []);
    const roundId = empty.aviator.round.id; await h.fund(walletA);
    const one = await h.call('crash_start', { slot: 1, stake: 50, autoTargetBps: null, clientSeed: 'single-real-player' }, walletA);
    assert.strictEqual(one.aviator.round.id, roundId); assert.strictEqual(one.aviator.round.playerCount, 1);
    assert.strictEqual(one.aviator.round.bets.length, 1); assert.strictEqual(one.aviator.round.bets[0].mine, true);
    const other = await h.state(walletB);
    assert.strictEqual(other.aviator.round.playerCount, 1); assert.strictEqual(other.aviator.round.bets.length, 1);
    assert.strictEqual(other.aviator.round.bets[0].mine, false);
  });

  await test('Migration mondiale : transaction serveur, révisions et privilèges service-role', async () => {
    const migration = fs.readFileSync(`${__dirname}/../supabase/migrations/20261105120000_add_multiplayer_aviator.sql`, 'utf8');
    assert.ok(migration.includes('create table if not exists public.aviator_state'));
    assert.ok(migration.includes('create or replace function public.aviator_apply'));
    assert.ok(migration.includes('p_expected_revision')); assert.ok(migration.includes('expectedRevision'));
    assert.ok(migration.includes('insert into public.farm_actions'));
    assert.ok(migration.includes('enable row level security'));
    assert.ok(migration.includes('to service_role')); assert.ok(migration.includes('from public, anon, authenticated'));
    assert.ok(!migration.includes('grant select on public.aviator_state to authenticated'));
  });
})().then(() => {
  console.log('═'.repeat(72)); console.log(`🌐 RÉSULTAT MULTIJOUEUR : ${passed} réussis, ${failed} échoués\n`);
  process.exitCode = failed ? 1 : 0;
});
