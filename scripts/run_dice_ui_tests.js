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
const { window } = dom;
Object.defineProperty(window, 'crypto', { value: crypto.webcrypto, configurable: true });
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
for (const file of ['vendor/ethers.umd.min.js', 'farm-config.js', 'farm-protocol.js', 'farm.js', 'dice-config.js', 'dice.js']) window.eval(fs.readFileSync(path.join(ROOT, file), 'utf8'));

const sceneCalls = { active: [], waiting: 0, results: [], cancels: 0, resize: 0 };
window.FitiaDice3D = {
  create(container) {
    assert.strictEqual(container.id, 'dice-3d-container');
    return {
      available: true, pendingResolve: null,
      setActive(value) { sceneCalls.active.push(value); if (!value) this.cancelAnimation(); },
      startWaiting() { sceneCalls.waiting += 1; }, resize() { sceneCalls.resize += 1; },
      animateResult(roll) { sceneCalls.results.push(roll); return this.manual ? new Promise((resolve) => { this.pendingResolve = resolve; }) : Promise.resolve(); },
      cancelAnimation() { sceneCalls.cancels += 1; const resolve = this.pendingResolve; this.pendingResolve = null; if (resolve) resolve(); },
      dispose() {}
    };
  }
};

const wallet = new ethers.Wallet(`0x${'88'.repeat(32)}`);
const otherWallet = new ethers.Wallet(`0x${'99'.repeat(32)}`);
const repository = new MemoryFarmRepository(); const randomValues = [];
const service = createFarmService({ repository, randomInt: () => randomValues.length ? randomValues.shift() : 0, paymentVerifier: async () => ({ confirmed: true }) });
const server = http.createServer(createFarmHandler({ farmService: service }));
const toasts = [];
const app = {
  user: wallet.address, signer: wallet,
  showToast(message, error) { toasts.push({ message, error }); },
  nav(view) { if (view === 'farm') center.enter(); }, activity: { notify() {} }
};
const center = new window.FitiaFarmCenter(app); app.farmCenter = center;
const dice = new window.FitiaDice(app, center); app.fitaDice = dice;
let dropNextDiceResponse = false; let holdNextDiceResponse = false; let heldSeen = false; let releaseHeld = null;
window.fetch = async (url, options) => {
  assert.strictEqual(url, 'https://fitia-mining-pro.vercel.app/api/farm');
  const response = await global.fetch(`http://127.0.0.1:${server.address().port}/api/farm`, options);
  const body = JSON.parse(options.body);
  if (body.type === 'dice_roll' && dropNextDiceResponse) {
    dropNextDiceResponse = false; await response.arrayBuffer(); throw new TypeError('simulated response loss');
  }
  if (body.type === 'dice_roll' && holdNextDiceResponse) {
    holdNextDiceResponse = false; heldSeen = true;
    await new Promise((resolve) => { releaseHeld = resolve; });
  }
  return response;
};
let passed = 0; let failed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); }
}
async function waitFor(condition, label) {
  for (let index = 0; index < 200; index += 1) { if (condition()) return; await new Promise((resolve) => setTimeout(resolve, 10)); }
  throw new Error(`Délai dépassé : ${label}`);
}
async function signed(action, params = {}, signer = wallet) {
  const body = { action, buyer: signer.address, timestamp: Date.now(), ...params };
  body.signature = await signer.signMessage(Protocol.message(action, body)); return body;
}
async function callAction(type, params = {}) { return service.action(await signed('action', { actionId: crypto.randomUUID(), type, params })); }

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  console.log('\n🎲  TESTS UI FITA DICE 3D\n' + '═'.repeat(68));
  try {
    const amountUnits = ethers.parseUnits('20', 8).toString();
    await service.deposit(await signed('deposit', { actionId: crypto.randomUUID(), txHash: `0x${'cc'.repeat(32)}`, amountUnits }));
    await callAction('buy_land'); await callAction('buy_animal', { species: 'chicken' });
    center.init(); dice.init(); center.setAccount(wallet.address); dice.setAccount(wallet.address);
    await center.refresh({ quiet: true }); dice.enter();

    await test('Hub, logo local, cotes accessibles et scène 3D active', async () => {
      assert.strictEqual(window.document.querySelectorAll('#view-hub .hub-card').length, 4);
      assert.ok(window.document.querySelector('.hub-card-dice img[src="assets/dice.svg"]'));
      assert.strictEqual(window.document.querySelectorAll('[data-dice-stake]').length, 4);
      assert.strictEqual(window.document.querySelectorAll('[data-dice-target]').length, 5);
      assert.strictEqual(center.state.coins, 1250); assert.strictEqual(dice.started(), true);
      assert.strictEqual(sceneCalls.active.at(-1), true);
      dice.openInfo();
      assert.strictEqual(window.document.querySelectorAll('#dice-probability-list .dice-probability-row').length, 5);
      assert.strictEqual(window.document.getElementById('modal-dice-info').classList.contains('active'), true);
      assert.ok(window.document.getElementById('modal-dice-info').textContent.includes('RTP ≤ 95%'));
      dice.closeInfo();
    });

    await test('Gain : cible 4, tirage serveur 2, paiement brut 190 et solde net exact', async () => {
      const before = center.state.coins; randomValues.push(1);
      dice.setTarget(4); dice.setStake(100); await dice.roll();
      assert.strictEqual(center.state.coins, before + 90);
      assert.strictEqual(dice.currentResult.roll, 2); assert.strictEqual(dice.currentResult.coins, 190);
      assert.strictEqual(sceneCalls.results.at(-1), 2); assert.strictEqual(dice.pending, null);
      assert.ok(window.document.getElementById('dice-result-title').textContent.includes('ROLL 2 · WIN'));
      assert.ok(window.document.getElementById('dice-result-detail').textContent.includes('+90'));
      assert.strictEqual(window.document.querySelectorAll('#dice-history-list .dice-history-row').length, 1);
    });

    await test('Perte : tirage 6 sous cible 6, aucun gain et historique cohérent', async () => {
      const before = center.state.coins; randomValues.push(5);
      dice.setTarget(6); dice.setStake(50); await dice.roll();
      assert.strictEqual(center.state.coins, before - 50);
      assert.strictEqual(dice.currentResult.won, false); assert.strictEqual(dice.currentResult.coins, 0);
      assert.ok(window.document.getElementById('dice-result-title').textContent.includes('NO WIN'));
      assert.strictEqual(window.document.querySelectorAll('#dice-history-list .dice-history-row').length, 2);
      dice.openInfo(); assert.strictEqual(window.document.getElementById('dice-probability-base').textContent, '50 coins'); dice.closeInfo();
    });

    await test('Réponse perdue : reprise du même identifiant sans nouveau hasard ni second débit', async () => {
      dice.setTarget(4); dice.setStake(50); const before = center.state.coins;
      randomValues.push(0, 4); dropNextDiceResponse = true; await dice.roll();
      assert.ok(dice.pending); assert.strictEqual(dice.operation, false);
      assert.strictEqual(window.document.getElementById('dice-roll-button').textContent, 'RESUME ROLL');
      const pendingId = dice.pending.actionId;
      const serverState = (await service.view(wallet.address.toLowerCase())).state;
      assert.strictEqual(serverState.coins, before + 45); assert.strictEqual(center.state.coins, before);
      assert.strictEqual(randomValues.length, 1);
      dice.setAccount(otherWallet.address); assert.strictEqual(dice.pending, null);
      assert.ok(window.localStorage.getItem(`fitia_dice_pending_v1:${wallet.address.toLowerCase()}`));
      dice.setAccount(wallet.address); assert.strictEqual(dice.pending.actionId, pendingId);
      await dice.roll();
      assert.strictEqual(center.state.coins, before + 45); assert.strictEqual(dice.currentResult.id, pendingId);
      assert.strictEqual(dice.currentResult.roll, 1); assert.strictEqual(dice.pending, null);
      assert.strictEqual(randomValues.length, 1); randomValues.length = 0;
      assert.strictEqual(window.localStorage.getItem(`fitia_dice_pending_v1:${wallet.address.toLowerCase()}`), null);
    });

    await test('Changement de wallet pendant la réponse : aucun état croisé et reprise sur le compte d’origine', async () => {
      dice.setTarget(4); dice.setStake(50); const before = center.state.coins;
      randomValues.push(2); holdNextDiceResponse = true; heldSeen = false;
      const rolling = dice.roll(); await waitFor(() => heldSeen, 'réponse Dice retenue');
      const pendingId = dice.pending.actionId;
      app.user = otherWallet.address; app.signer = otherWallet; center.setAccount(otherWallet.address); dice.setAccount(otherWallet.address);
      assert.strictEqual(dice.pending, null); assert.strictEqual(dice.operation, false); assert.strictEqual(center.state, null);
      releaseHeld(); await rolling;
      assert.strictEqual(center.state, null); assert.strictEqual(dice.currentResult, null);
      app.user = wallet.address; app.signer = wallet; center.setAccount(wallet.address); dice.setAccount(wallet.address);
      await center.refresh({ quiet: true });
      assert.strictEqual(dice.pending.actionId, pendingId); assert.strictEqual(center.state.coins, before + 45);
      await dice.roll();
      assert.strictEqual(center.state.coins, before + 45); assert.strictEqual(dice.currentResult.id, pendingId);
      assert.strictEqual(dice.currentResult.roll, 3); assert.strictEqual(dice.pending, null);
    });

    await test('Sortie pendant le lancer : annulation 3D résolue, résultat serveur conservé et aucun blocage', async () => {
      const before = center.state.coins; randomValues.push(1);
      dice.scene.manual = true; dice.setTarget(4); dice.setStake(50);
      const rolling = dice.roll(); await waitFor(() => dice.scene.pendingResolve, 'animation Dice en cours');
      dice.exit();
      await Promise.race([rolling, new Promise((_, reject) => setTimeout(() => reject(new Error('Dice blocked after exit')), 500))]);
      assert.strictEqual(sceneCalls.active.at(-1), false); assert.strictEqual(dice.active, false);
      assert.strictEqual(center.state.coins, before + 45); assert.strictEqual(dice.pending, null); assert.strictEqual(dice.operation, false);
      dice.scene.manual = false; dice.enter(); assert.strictEqual(sceneCalls.active.at(-1), true);
    });

    await test('Verrouillage : compte, reprise et boucle 3D purgés sans secret local', async () => {
      center.setAccount(null); dice.setAccount(null);
      assert.strictEqual(dice.account, null); assert.strictEqual(dice.pending, null); assert.strictEqual(dice.operation, false);
      assert.strictEqual(sceneCalls.active.at(-1), false);
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const value = String(window.localStorage.getItem(window.localStorage.key(index)));
        assert.ok(!value.includes('privateKey')); assert.ok(!value.includes('mnemonic'));
      }
    });
  } finally {
    clearInterval(center.clockTimer); clearInterval(center.backgroundPollTimer); clearTimeout(center.retryTimer);
    dice.exit(); releaseHeld?.();
    await new Promise((resolve) => server.close(resolve)); window.close();
  }
  console.log('═'.repeat(68)); console.log(`🎲 RÉSULTAT UI DICE : ${passed} réussis, ${failed} échoués`);
  if (failed) process.exit(1);
})().catch((error) => { console.error(error); server.close(); window.close(); process.exit(1); });
