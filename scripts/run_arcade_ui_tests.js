#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { JSDOM } = require(fs.existsSync('/tmp/test-deps/node_modules/jsdom') ? '/tmp/test-deps/node_modules/jsdom' : 'jsdom');
const ethers = require('../vendor/ethers.umd.min.js');
const Protocol = require('../farm-protocol');
const { MemoryFarmRepository, createFarmService } = require('../farm-service');
const { createFarmHandler } = require('../api/farm');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'android-src/wallet.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const dom = new JSDOM(html, { url: 'https://app.fitia.pro/wallet.html', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom; Object.defineProperty(window, 'crypto', { value: crypto.webcrypto, configurable: true });
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
for (const file of ['vendor/ethers.umd.min.js', 'farm-config.js', 'farm-protocol.js', 'farm.js', 'arcade-config.js', 'arcade.js']) window.eval(fs.readFileSync(path.join(ROOT, file), 'utf8'));

const calls = { active: [], waiting: 0, reveals: [], cashouts: 0, crash: [], flips: [], rounds: 0, cancels: 0 };
function scene(key) {
  return {
    available: true, setActive(value) { calls.active.push([key, value]); if (!value) this.cancelAnimation(); }, startWaiting() { calls.waiting += 1; }, resize() {}, dispose() {},
    setRound(round) { calls.rounds += 1; this.round = round; }, animateReveal(index, safe) { calls.reveals.push([index, safe]); return Promise.resolve(); },
    animateCashout() { calls.cashouts += 1; return Promise.resolve(); }, animateResult(result) { if (key === 'crash') calls.crash.push(result); else calls.flips.push(result); return Promise.resolve(); },
    cancelAnimation() { calls.cancels += 1; }
  };
}
window.FitiaArcade3D = {
  createMines(container) { assert.strictEqual(container.id, 'mines-3d-container'); return scene('mines'); },
  createCrash(container) { assert.strictEqual(container.id, 'crash-3d-container'); return scene('crash'); },
  createCoinFlip(container) { assert.strictEqual(container.id, 'coin-flip-3d-container'); return scene('coin-flip'); }
};
const wallet = new ethers.Wallet(`0x${'77'.repeat(32)}`); const otherWallet = new ethers.Wallet(`0x${'78'.repeat(32)}`);
const repository = new MemoryFarmRepository(); const randomValues = [];
const service = createFarmService({ repository, randomInt: () => randomValues.length ? randomValues.shift() : 0, paymentVerifier: async () => ({ confirmed: true }) });
const server = http.createServer(createFarmHandler({ farmService: service }));
const toasts = []; const app = { user: wallet.address, signer: wallet, showToast(message, error) { toasts.push({ message, error }); }, nav() {}, activity: { notify() {} } };
const center = new window.FitiaFarmCenter(app); app.farmCenter = center;
const mines = new window.FitiaMines(app, center); const crash = new window.FitiaCrash(app, center); const flip = new window.FitiaCoinFlip(app, center);
app.fitaMines = mines; app.fitaCrash = crash; app.fitaCoinFlip = flip;
const dropTypes = new Set(); let holdType = null; let heldSeen = false; let releaseHeld = null;
window.fetch = async (url, options) => {
  assert.strictEqual(url, 'https://fitia-mining-pro.vercel.app/api/farm');
  const response = await global.fetch(`http://127.0.0.1:${server.address().port}/api/farm`, options); const body = JSON.parse(options.body);
  if (dropTypes.has(body.type)) { dropTypes.delete(body.type); await response.arrayBuffer(); throw new TypeError('simulated response loss'); }
  if (body.type === holdType) { holdType = null; heldSeen = true; await new Promise((resolve) => { releaseHeld = resolve; }); }
  return response;
};
let passed = 0; let failed = 0;
async function test(name, run) { try { await run(); passed += 1; console.log(`  ✅ ${name}`); } catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); } }
async function waitFor(condition, label) { for (let index = 0; index < 200; index += 1) { if (condition()) return; await new Promise((resolve) => setTimeout(resolve, 10)); } throw new Error(`Délai dépassé : ${label}`); }
async function signed(action, params = {}, signer = wallet) { const body = { action, buyer: signer.address, timestamp: Date.now(), ...params }; body.signature = await signer.signMessage(Protocol.message(action, body)); return body; }
async function callAction(type, params = {}) { return service.action(await signed('action', { actionId: crypto.randomUUID(), type, params })); }
function setAccounts(account, signer) {
  app.user = account; app.signer = signer; center.setAccount(account); mines.setAccount(account); crash.setAccount(account); flip.setAccount(account);
}

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); console.log('\n🕹️  TESTS UI FITIA ARCADE\n' + '═'.repeat(72));
  try {
    const amountUnits = ethers.parseUnits('20', 8).toString();
    await service.deposit(await signed('deposit', { actionId: crypto.randomUUID(), txHash: `0x${'cd'.repeat(32)}`, amountUnits }));
    await callAction('buy_land'); await callAction('buy_animal', { species: 'chicken' });
    center.init(); mines.init(); crash.init(); flip.init(); setAccounts(wallet.address.toLowerCase(), wallet);
    await center.refresh({ quiet: true }); mines.enter(); crash.enter(); flip.enter();

    await test('Hub : sept cartes avec logos, cinq navigations principales et aucune mention technique', async () => {
      assert.strictEqual(window.document.querySelectorAll('#view-hub .hub-card').length, 7);
      assert.strictEqual(window.document.querySelectorAll('.bottom-nav .nav-item').length, 5);
      for (const logo of ['mines.svg', 'crash.svg', 'coin-flip.svg']) assert.ok(window.document.querySelector(`#view-hub img[src="assets/${logo}"]`));
      assert.strictEqual(window.document.querySelectorAll('[data-mines-index]').length, 25);
      assert.strictEqual(window.document.getElementById('farm-sync-status'), null);
      assert.ok(!window.document.body.textContent.includes('SERVER DRAW')); assert.ok(!window.document.body.textContent.includes('SERVER ROLL'));
      assert.ok(!window.document.body.textContent.includes('Live · server synchronized'));
    });

    await test('Probabilités accessibles : 4 configurations Mines, 5 cibles Crash et 2 côtés', async () => {
      mines.openInfo(); assert.strictEqual(window.document.querySelectorAll('#mines-probability-list .arcade-probability-row').length, 4); assert.ok(window.document.getElementById('modal-mines-info').textContent.includes('RTP ≤ 95%')); mines.closeInfo();
      crash.openInfo(); assert.strictEqual(window.document.querySelectorAll('#crash-probability-list .arcade-probability-row').length, 5); crash.closeInfo();
      flip.openInfo(); assert.strictEqual(window.document.querySelectorAll('#flip-probability-list .arcade-probability-row').length, 2); assert.strictEqual(window.document.getElementById('flip-probability-base').textContent, '50 coins'); flip.closeInfo();
    });

    await test('Mines 3D : démarrage, case sûre, animation et encaissement au solde exact', async () => {
      const before = center.state.coins; mines.setStake(100); mines.setMineCount(3); await mines.start();
      assert.strictEqual(center.state.coins, before - 100); assert.ok(mines.activeRound()); assert.strictEqual(mines.activeRound().minePositions, undefined);
      await mines.reveal(3); assert.deepStrictEqual(mines.activeRound().revealed, [3]); assert.strictEqual(calls.reveals.at(-1)[0], 3); assert.strictEqual(calls.reveals.at(-1)[1], true);
      assert.strictEqual(window.document.querySelector('[data-mines-index="3"]').classList.contains('safe'), true);
      assert.strictEqual(window.document.getElementById('mines-current-payout').textContent, '107 coins');
      await mines.cashout(); assert.strictEqual(center.state.coins, before + 7); assert.strictEqual(mines.activeRound(), null); assert.strictEqual(calls.cashouts, 1);
      assert.strictEqual(mines.currentResult.status, 'cashed'); assert.ok(window.document.getElementById('mines-result-title').textContent.includes('107 COINS'));
      assert.strictEqual(window.document.querySelectorAll('#mines-history-list .arcade-history-row').length, 1);
    });

    await test('Mines 3D : mine touchée, résultat de perte et nouvelle manche possible', async () => {
      mines.setStake(50); mines.setMineCount(1); await mines.start(); const before = center.state.coins; await mines.reveal(0);
      assert.strictEqual(center.state.coins, before); assert.strictEqual(mines.currentResult.status, 'lost'); assert.strictEqual(mines.activeRound(), null);
      assert.strictEqual(window.document.getElementById('mines-result-title').textContent, 'MINE HIT');
      assert.strictEqual(window.document.querySelector('[data-mines-index="0"]').classList.contains('hit'), true);
      assert.strictEqual(window.document.getElementById('mines-start-button').classList.contains('hidden'), false);
    });

    await test('Mines : réponse perdue sur une révélation, reprise sans double mutation', async () => {
      await mines.start(); const roundId = mines.activeRound().id; dropTypes.add('mines_reveal'); await mines.reveal(4);
      assert.ok(mines.pending); assert.strictEqual(mines.operation, false); assert.strictEqual(window.document.getElementById('mines-resume-button').classList.contains('hidden'), false);
      const pendingId = mines.pending.actionId; await mines.resume();
      assert.strictEqual(mines.pending, null); assert.strictEqual(mines.activeRound().id, roundId); assert.deepStrictEqual(mines.activeRound().revealed, [4]);
      assert.strictEqual(window.localStorage.getItem(`fitia_mines_pending_v1:${wallet.address.toLowerCase()}`), null);
      const serverRound = (await service.view(wallet.address.toLowerCase())).state.mines.active; assert.strictEqual(serverRound.revealed.length, 1);
      await mines.reveal(0); assert.strictEqual(mines.activeRound(), null); assert.ok(pendingId);
    });

    await test('Crash : cible 2×, tirage exact, animation et historique', async () => {
      const before = center.state.coins; crash.setStake(100); crash.setTarget(200); randomValues.push(525000); await crash.play();
      assert.strictEqual(center.state.coins, before + 100); assert.strictEqual(crash.currentResult.crashBps, 200); assert.strictEqual(crash.currentResult.coins, 200);
      assert.strictEqual(calls.crash.at(-1).id, crash.currentResult.id); assert.ok(window.document.getElementById('crash-result-title').textContent.includes('2.00× TARGET REACHED'));
      assert.strictEqual(window.document.querySelectorAll('#crash-history-list .arcade-history-row').length, 1);
    });

    await test('Crash : réponse perdue, reprise du même vol sans nouveau hasard', async () => {
      crash.setStake(50); crash.setTarget(300); const before = center.state.coins; randomValues.push(0, 525000); dropTypes.add('crash_play'); await crash.play();
      assert.ok(crash.pending); assert.strictEqual(center.state.coins, before); const id = crash.pending.actionId; await crash.play();
      assert.strictEqual(crash.currentResult.id, id); assert.strictEqual(crash.currentResult.crashBps, 100); assert.strictEqual(center.state.coins, before - 50);
      assert.strictEqual(randomValues.length, 1); randomValues.length = 0; assert.strictEqual(crash.pending, null);
    });

    await test('Coin Flip 3D : face serveur, paiement 1,90× et animation correspondante', async () => {
      const before = center.state.coins; flip.setStake(100); flip.setChoice('heads'); randomValues.push(0); await flip.play();
      assert.strictEqual(center.state.coins, before + 90); assert.strictEqual(flip.currentResult.result, 'heads'); assert.strictEqual(flip.currentResult.coins, 190);
      assert.strictEqual(calls.flips.at(-1), 'heads'); assert.strictEqual(window.document.getElementById('flip-result-title').textContent, 'HEADS · WIN');
      assert.strictEqual(window.document.querySelectorAll('#flip-history-list .arcade-history-row').length, 1);
    });

    await test('Coin Flip : réponse perdue puis reprise du même lancer', async () => {
      flip.setStake(50); flip.setChoice('tails'); const before = center.state.coins; randomValues.push(1, 0); dropTypes.add('coin_flip'); await flip.play();
      assert.ok(flip.pending); const id = flip.pending.actionId; await flip.play();
      assert.strictEqual(flip.currentResult.id, id); assert.strictEqual(flip.currentResult.result, 'tails'); assert.strictEqual(center.state.coins, before + 45);
      assert.strictEqual(randomValues.length, 1); randomValues.length = 0; assert.strictEqual(flip.pending, null);
    });

    await test('Changement de wallet pendant une réponse : aucun état croisé et reprise isolée', async () => {
      const before = center.state.coins; randomValues.push(1); holdType = 'coin_flip'; heldSeen = false; const playing = flip.play(); await waitFor(() => heldSeen, 'réponse Coin Flip retenue');
      const pendingId = flip.pending.actionId; setAccounts(otherWallet.address.toLowerCase(), otherWallet);
      assert.strictEqual(flip.pending, null); assert.strictEqual(center.state, null); assert.ok(window.localStorage.getItem(`fitia_coin-flip_pending_v1:${wallet.address.toLowerCase()}`));
      releaseHeld(); await playing; assert.strictEqual(center.state, null); assert.strictEqual(flip.currentResult, null);
      setAccounts(wallet.address.toLowerCase(), wallet); await center.refresh({ quiet: true });
      assert.strictEqual(flip.pending.actionId, pendingId); assert.strictEqual(center.state.coins, before + 45); await flip.play();
      assert.strictEqual(flip.currentResult.id, pendingId); assert.strictEqual(flip.pending, null); assert.strictEqual(center.state.coins, before + 45);
    });

    await test('Verrouillage : scènes, opérations et comptes purgés sans secret local', async () => {
      setAccounts(null, null); assert.strictEqual(mines.account, null); assert.strictEqual(crash.pending, null); assert.strictEqual(flip.operation, false);
      assert.strictEqual(calls.active.at(-1)[1], false);
      for (let index = 0; index < window.localStorage.length; index += 1) { const value = String(window.localStorage.getItem(window.localStorage.key(index))); assert.ok(!value.includes('privateKey')); assert.ok(!value.includes('mnemonic')); }
    });
  } finally {
    clearInterval(center.clockTimer); clearInterval(center.backgroundPollTimer); clearTimeout(center.retryTimer); clearInterval(center.pollTimer);
    mines.exit(); crash.exit(); flip.exit(); releaseHeld?.(); await new Promise((resolve) => server.close(resolve)); window.close();
  }
  console.log('═'.repeat(72)); console.log(`🕹️ RÉSULTAT UI ARCADE : ${passed} réussis, ${failed} échoués`); if (failed) process.exit(1);
})().catch((error) => { console.error(error); server.close(); window.close(); process.exit(1); });
