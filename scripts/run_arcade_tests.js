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
const wallet = new ethers.Wallet(`0x${'42'.repeat(32)}`);
const otherWallet = new ethers.Wallet(`0x${'43'.repeat(32)}`);
const buyer = wallet.address.toLowerCase(); const nowMs = Date.parse('2026-10-30T02:30:00.000Z');
const repository = new MemoryFarmRepository(); const randomValues = [];
const randomInt = () => randomValues.length ? randomValues.shift() : 0;
const service = createFarmService({ repository, now: () => new Date(nowMs), randomInt, paymentVerifier: async () => ({ confirmed: true }) });
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
function recoveryService() {
  const lostRepository = {
    get: (...args) => repository.get(...args), listWithdrawals: (...args) => repository.listWithdrawals(...args),
    isActionProcessed: (...args) => repository.isActionProcessed(...args),
    async apply(...args) { await repository.apply(...args); throw new FarmError(500, 'Réponse perdue après commit.', 'FARM_NETWORK'); }
  };
  return createFarmService({ repository: lostRepository, now: () => new Date(nowMs), randomInt, paymentVerifier: async () => ({ confirmed: true }) });
}

(async () => {
  console.log('\n🎮  TESTS FITIA ARCADE\n' + '═'.repeat(72));
  await test('Économie : Mines, Crash et Coin Flip conservent un RTP maximal de 95 %', async () => {
    assert.deepStrictEqual(Config.STAKES, [50, 100, 200, 500]);
    Config.STAKES.forEach((stake) => {
      Config.MINES_COUNTS.forEach((mineCount) => {
        for (let safe = 1; safe <= Config.MINES_TILES - mineCount; safe += 1) {
          const payout = Config.minesPayout(stake, mineCount, safe);
          assert.ok(Number.isSafeInteger(payout) && payout > 0 && payout <= Config.MINES_MAX_PAYOUT);
          assert.ok(Config.minesExpectedReturnRatio(stake, mineCount, safe) <= 0.95 + 1e-12, `${stake}/${mineCount}/${safe}`);
        }
      });
      Config.CRASH_TARGETS_BPS.forEach((target) => {
        assert.ok(Config.crashPayout(stake, target) > stake);
        assert.ok(Config.crashExpectedReturnRatio(stake, target) <= 0.95 + 1e-12);
      });
      assert.strictEqual(Config.flipExpectedReturnRatio(stake), 0.95);
      assert.strictEqual(Config.flipPayout(stake), Math.floor(stake * 1.9));
    });
    assert.strictEqual(Config.minesPayout(100, 3, 1), 107);
    assert.strictEqual(Config.crashPayout(100, 200), 200);
    assert.strictEqual(Config.selectCrashPoint(0), 100);
    assert.strictEqual(Config.selectCrashPoint(525000), 200);
    assert.throws(() => Config.selectCrashPoint(Config.CRASH_RANDOM_RANGE));
  });

  await test('Compte FARM partagé : activation et solde initial pour les jeux', async () => {
    const amountUnits = ethers.parseUnits('100', 8).toString();
    await service.deposit(await signed('deposit', { actionId: actionId(), txHash: `0x${'ab'.repeat(32)}`, amountUnits }));
    await call('buy_land'); const started = await call('buy_animal', { species: 'chicken' });
    assert.strictEqual(started.state.coins, 9250);
    assert.ok(started.state.mines && started.state.crash && started.state.coinFlip);
  });

  await test('Mines : tirage secret, rejeu du démarrage et aucune fuite vers le client', async () => {
    const id = actionId(); const before = (await service.view(buyer)).state.coins;
    const body = await signed('action', { actionId: id, type: 'mines_start', params: { stake: 100, mineCount: 3, minePositions: [0, 1, 2] } });
    const result = await service.action(body);
    assert.strictEqual(result.state.coins, before - 100); assert.strictEqual(result.minesAction.type, 'mines_start');
    assert.strictEqual(result.state.mines.active.id, id); assert.strictEqual(result.state.mines.active.minePositions, undefined);
    assert.ok(!JSON.stringify(result).includes('minePositions'));
    const stored = await repository.get(buyer); assert.deepStrictEqual(stored.state.mines.active.minePositions, [0, 1, 2]);
    const replay = await service.action(body); assert.strictEqual(replay.state.coins, result.state.coins);
    assert.strictEqual(replay.state.mines.active.revealed.length, 0); assert.strictEqual(randomValues.length, 0);
    const other = await service.getState(await signed('state', {}, otherWallet)); assert.strictEqual(other.state.mines.active, null);
    await expectCode(call('mines_start', { stake: 50, mineCount: 1 }), 'MINES_ROUND_ACTIVE');
  });

  await test('Mines : case sûre, cote exacte, encaissement atomique et rejeu sans double crédit', async () => {
    const active = (await service.view(buyer)).state.mines.active;
    const revealId = actionId(); const revealBody = await signed('action', { actionId: revealId, type: 'mines_reveal', params: { roundId: active.id, index: 3 } });
    const revealed = await service.action(revealBody);
    assert.strictEqual(revealed.minesAction.safe, true); assert.deepStrictEqual(revealed.state.mines.active.revealed, [3]);
    assert.strictEqual(revealed.state.mines.active.minePositions, undefined);
    const replayReveal = await service.action(revealBody); assert.strictEqual(replayReveal.state.mines.active.revealed.length, 1);
    await expectCode(call('mines_reveal', { roundId: active.id, index: 3 }), 'MINES_TILE_REVEALED');
    const payout = Config.minesPayout(100, 3, 1); const before = revealed.state.coins;
    const cashId = actionId(); const cashBody = await signed('action', { actionId: cashId, type: 'mines_cashout', params: { roundId: active.id } });
    const cashed = await service.action(cashBody);
    assert.strictEqual(cashed.state.coins, before + payout); assert.strictEqual(cashed.state.mines.active, null);
    assert.strictEqual(cashed.state.mines.recentRounds[0].status, 'cashed'); assert.strictEqual(cashed.minesAction.coins, payout);
    const replay = await service.action(cashBody); assert.strictEqual(replay.state.coins, cashed.state.coins);
    assert.strictEqual(replay.state.mines.recentRounds.length, 1);
  });

  await test('Mines : mine touchée, perte exacte et révélation complète seulement après clôture', async () => {
    const started = await call('mines_start', { stake: 50, mineCount: 1 });
    const roundId = started.state.mines.active.id; const before = started.state.coins;
    assert.strictEqual(started.state.mines.active.minePositions, undefined);
    const lost = await call('mines_reveal', { roundId, index: 0 });
    assert.strictEqual(lost.minesAction.safe, false); assert.strictEqual(lost.state.coins, before);
    assert.strictEqual(lost.state.mines.active, null); assert.strictEqual(lost.state.mines.recentRounds[0].status, 'lost');
    assert.deepStrictEqual(lost.state.mines.recentRounds[0].minePositions, [0]);
    assert.strictEqual(lost.state.mines.recentRounds[0].hitMine, 0);
  });

  await test('Mines : réponse perdue après commit, récupération de la même révélation', async () => {
    const started = await call('mines_start', { stake: 50, mineCount: 1 }); const roundId = started.state.mines.active.id;
    const id = actionId(); const recovered = await action(id, 'mines_reveal', { roundId, index: 4 }, recoveryService());
    assert.strictEqual(recovered.minesAction.id, id); assert.strictEqual(recovered.minesAction.index, 4); assert.strictEqual(recovered.minesAction.safe, true);
    assert.strictEqual(recovered.state.mines.active.revealed[0], 4);
    const replay = await action(id, 'mines_reveal', { roundId, index: 4 });
    assert.strictEqual(replay.state.coins, recovered.state.coins); assert.strictEqual(replay.state.mines.active.revealed.length, 1);
    await call('mines_reveal', { roundId, index: 0 });
  });

  await test('Crash : résultat serveur, cible atteinte, perte et rejeu sans nouveau hasard', async () => {
    const before = (await service.view(buyer)).state.coins; const id = actionId();
    const body = await signed('action', { actionId: id, type: 'crash_play', params: { stake: 100, targetBps: 200, crashBps: 10000, coins: 999999 } });
    randomValues.push(525000); const won = await service.action(body);
    assert.strictEqual(won.crashResult.crashBps, 200); assert.strictEqual(won.crashResult.won, true);
    assert.strictEqual(won.crashResult.coins, 200); assert.strictEqual(won.state.coins, before + 100);
    const replay = await service.action(body); assert.strictEqual(replay.state.coins, won.state.coins); assert.strictEqual(randomValues.length, 0);
    randomValues.push(0); const lost = await call('crash_play', { stake: 50, targetBps: 300 });
    assert.strictEqual(lost.crashResult.crashBps, 100); assert.strictEqual(lost.crashResult.won, false); assert.strictEqual(lost.state.coins, won.state.coins - 50);
    await expectCode(call('crash_play', { stake: 55, targetBps: 200 }), 'CRASH_STAKE');
    await expectCode(call('crash_play', { stake: 50, targetBps: 175 }), 'CRASH_TARGET');
  });

  await test('Crash : réponse perdue après commit, récupération sans second débit', async () => {
    const before = (await service.view(buyer)).state.coins; const id = actionId(); randomValues.push(525000);
    const recovered = await action(id, 'crash_play', { stake: 50, targetBps: 200 }, recoveryService());
    assert.strictEqual(recovered.crashResult.id, id); assert.strictEqual(recovered.state.coins, before + 50);
    const replay = await action(id, 'crash_play', { stake: 50, targetBps: 200 });
    assert.strictEqual(replay.state.coins, recovered.state.coins); assert.strictEqual(replay.crashResult.crashBps, 200); assert.strictEqual(randomValues.length, 0);
  });

  await test('Coin Flip 3D : côté serveur, paiement 1,90×, perte et paramètres invalides', async () => {
    const before = (await service.view(buyer)).state.coins; randomValues.push(0);
    const won = await call('coin_flip', { stake: 100, choice: 'heads', result: 'tails', coins: 999999 });
    assert.strictEqual(won.flip.result, 'heads'); assert.strictEqual(won.flip.won, true); assert.strictEqual(won.flip.coins, 190); assert.strictEqual(won.state.coins, before + 90);
    randomValues.push(1); const lost = await call('coin_flip', { stake: 50, choice: 'heads' });
    assert.strictEqual(lost.flip.result, 'tails'); assert.strictEqual(lost.flip.won, false); assert.strictEqual(lost.state.coins, won.state.coins - 50);
    await expectCode(call('coin_flip', { stake: 55, choice: 'heads' }), 'FLIP_STAKE');
    await expectCode(call('coin_flip', { stake: 50, choice: 'edge' }), 'FLIP_CHOICE');
  });

  await test('Coin Flip 3D : réponse perdue et rejeu du même identifiant', async () => {
    const before = (await service.view(buyer)).state.coins; const id = actionId(); randomValues.push(1);
    const recovered = await action(id, 'coin_flip', { stake: 100, choice: 'tails' }, recoveryService());
    assert.strictEqual(recovered.flip.id, id); assert.strictEqual(recovered.flip.result, 'tails'); assert.strictEqual(recovered.state.coins, before + 90);
    const replay = await action(id, 'coin_flip', { stake: 100, choice: 'tails' });
    assert.strictEqual(replay.state.coins, recovered.state.coins); assert.strictEqual(replay.flip.coins, 190); assert.strictEqual(randomValues.length, 0);
  });

  await test('Migration Supabase : cinq actions Arcade atomiques et privilèges service-role', async () => {
    const migration = fs.readFileSync(`${__dirname}/../supabase/migrations/20261030021521_add_arcade_games.sql`, 'utf8');
    for (const type of ['mines_start', 'mines_reveal', 'mines_cashout', 'crash_play', 'coin_flip']) assert.ok(migration.includes(`'${type}'`));
    assert.ok(migration.includes('{mines,active,id}')); assert.ok(migration.includes('{crash,recentRounds,0,id}')); assert.ok(migration.includes('{coinFlip,recentFlips,0,id}'));
    assert.ok(migration.includes('p_coins < 1000')); assert.ok(migration.includes('to service_role')); assert.ok(migration.includes('from public, anon, authenticated'));
  });

  console.log('═'.repeat(72)); console.log(`🎮 RÉSULTAT ARCADE : ${passed} réussis, ${failed} échoués`);
  if (failed) process.exit(1);
})().catch((error) => { console.error(error); process.exit(1); });
