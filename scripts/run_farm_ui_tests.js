#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { JSDOM } = require(fs.existsSync('/tmp/test-deps/node_modules/jsdom') ? '/tmp/test-deps/node_modules/jsdom' : 'jsdom');
const ethers = require('../vendor/ethers.umd.min.js');
const { MemoryFarmRepository, createFarmService } = require('../farm-service');
const { createFarmHandler } = require('../api/farm');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'android-src/wallet.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const dom = new JSDOM(html, { url: 'https://app.fitia.pro/wallet.html', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
Object.defineProperty(window, 'crypto', { value: crypto.webcrypto, configurable: true });
for (const file of ['vendor/ethers.umd.min.js', 'farm-config.js', 'farm-protocol.js', 'farm.js']) window.eval(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const sceneCalls = { states: [], active: [], focus: [] };
window.FitiaFarm3D = {
  create(container, options) {
    assert.ok(container.id === 'farm-3d-container'); assert.strictEqual(typeof options.onSelect, 'function');
    return {
      setState(state) { sceneCalls.states.push(JSON.parse(JSON.stringify(state))); },
      setActive(value) { sceneCalls.active.push(value); }, focus(view) { sceneCalls.focus.push(view); },
      zoom() {}, rotate() {}, dispose() {}
    };
  }
};

let verification = { confirmed: true };
const repository = new MemoryFarmRepository();
const service = createFarmService({ repository, paymentVerifier: async () => verification });
const server = http.createServer(createFarmHandler({ farmService: service }));
const wallet = new ethers.Wallet(`0x${'44'.repeat(32)}`);
const otherWallet = new ethers.Wallet(`0x${'55'.repeat(32)}`);
const toasts = []; const transfers = []; let transferHook = null;
const pinSecret = { privateKey: 'temporary-test-secret', mnemonic: 'temporary-test-phrase' };
const app = {
  user: wallet.address, signer: wallet,
  ftaToken: {
    balanceOf: async () => ethers.parseUnits('10000', 8),
    transfer: async (to, units) => {
      const tx = { to, units: units.toString(), hash: `0x${crypto.randomBytes(32).toString('hex')}` };
      transfers.push(tx); if (transferHook) await transferHook(tx); return tx;
    }
  },
  ensurePolGas: async () => true,
  requestPinVerification: async () => ({ secret: pinSecret }),
  refreshAfterConfirmedTransaction: async () => {}, setLoader() {}, t: (key) => key,
  showToast(message, error) { toasts.push({ message, error }); }, showError(error) { toasts.push({ message: error.message, error: true }); }
};
window.fetch = (url, options) => {
  assert.strictEqual(url, 'https://fitia-mining-pro.vercel.app/api/farm');
  return global.fetch(`http://127.0.0.1:${server.address().port}/api/farm`, options);
};
const center = new window.FitiaFarmCenter(app);
let passed = 0; let failed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); }
}
async function waitFor(condition, label) {
  for (let index = 0; index < 200; index += 1) { if (condition()) return; await new Promise((resolve) => setTimeout(resolve, 10)); }
  throw new Error(`Délai dépassé : ${label}`);
}

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  console.log('\n🎮  TESTS UI FITIA FARM\n' + '═'.repeat(68));
  try {
    center.init(); center.setAccount(wallet.address); center.enter();
    await waitFor(() => center.state && center.scene, 'état initial et scène');
    await test('Entrée FARM : état signé, scène initialisée et démarrage verrouillé', async () => {
      assert.strictEqual(center.state.coins, 0); assert.strictEqual(center.started(), false);
      assert.ok(!window.document.getElementById('farm-start-card').classList.contains('hidden'));
      assert.ok(window.document.getElementById('farm-3d-loading').classList.contains('hidden'));
      assert.strictEqual(sceneCalls.states.at(-1).animals.length, 0);
    });

    await test('Conversion FTA : PIN effacé, transfert exact, reprise du même hash et coins crédités une fois', async () => {
      verification = { confirmed: false };
      await center.startDeposit('7.50');
      await waitFor(() => center.pendingDeposit && !center.pendingCheck, 'dépôt en attente');
      assert.strictEqual(center.state.coins, 0); assert.strictEqual(transfers.length, 1);
      assert.strictEqual(transfers[0].to, window.FitiaFarmConfig.TREASURY_ADDRESS);
      assert.strictEqual(transfers[0].units, '750000000');
      assert.strictEqual(pinSecret.privateKey, ''); assert.strictEqual(pinSecret.mnemonic, '');
      const pending = { ...center.pendingDeposit };
      const saved = JSON.parse(window.localStorage.getItem(`fitia_farm_pending_deposit_v1:${wallet.address.toLowerCase()}`));
      assert.strictEqual(saved.txHash, pending.txHash); assert.ok(!JSON.stringify(saved).includes('private'));
      verification = { confirmed: true };
      await center.checkPendingDeposit();
      await waitFor(() => center.state.coins === 750 && !center.pendingDeposit, 'coins crédités');
      await center.checkPendingDeposit();
      assert.strictEqual(center.state.coins, 750); assert.strictEqual(transfers.length, 1);
    });

    await test('Parcours obligatoire : terrain puis poulet, checklist terminée et animal transmis à la 3D', async () => {
      await center.perform('buy_land'); assert.strictEqual(center.state.coins, 250);
      await center.perform('buy_animal', { species: 'chicken' });
      assert.strictEqual(center.started(), true); assert.strictEqual(center.state.coins, 0);
      assert.ok(window.document.getElementById('farm-start-card').classList.contains('hidden'));
      assert.strictEqual(sceneCalls.states.at(-1).animals[0].species, 'chicken');
      assert.strictEqual(window.document.querySelectorAll('#farm-animal-list .farm-item-card').length, 1);
    });

    await test('Culture et caméra : blé planté, parcelle 3D synchronisée et récolte bloquée avant maturité', async () => {
      await center.startDeposit('10'); await waitFor(() => center.state.coins === 1000, 'second dépôt');
      await center.perform('plant', { species: 'wheat' });
      assert.strictEqual(center.state.crops.length, 1); assert.strictEqual(center.state.coins, 990);
      assert.strictEqual(sceneCalls.states.at(-1).crops[0].species, 'wheat');
      center.openEntity('crop', center.state.crops[0].id);
      const action = window.document.querySelector('#farm-dialog-actions button');
      assert.strictEqual(action.disabled, true); assert.ok(action.textContent.includes('GROWING'));
      center.closeDialog(); center.setTab('animals'); assert.ok(sceneCalls.focus.includes('animals'));
    });

    await test('Retrait UI : minimum 1 000 coins / 10 FTA, statut pending puis paid et intervalle de 24 h', async () => {
      await center.withdraw('100'); assert.strictEqual(center.state.coins, 990);
      assert.strictEqual(center.withdrawals.length, 0);
      await center.startDeposit('10'); await waitFor(() => center.state.coins === 1990, 'solde du retrait minimum');
      center.openWithdraw();
      const input = window.document.querySelector('#farm-dialog-content input');
      assert.strictEqual(input.min, '1000'); assert.strictEqual(input.max, '10000'); assert.strictEqual(input.value, '1000');
      assert.strictEqual(window.document.querySelector('#farm-dialog-content .farm-conversion-preview').textContent, '10 FTA');
      center.closeDialog();
      await center.withdraw('1000'); assert.strictEqual(center.state.coins, 990);
      assert.strictEqual(center.withdrawals[0].status, 'pending');
      assert.strictEqual(center.withdrawals[0].ftaUnits, '1000000000');
      center.openWithdraw(); assert.strictEqual(window.document.getElementById('farm-dialog-title').textContent, 'Withdrawal in progress'); center.closeDialog();
      const withdrawal = center.withdrawals[0];
      await service.completeWithdrawal({ id: withdrawal.id, txHash: `0x${'ab'.repeat(32)}` });
      await center.refresh({ quiet: true }); assert.strictEqual(center.withdrawals[0].status, 'paid');
      center.openWithdraw(); assert.strictEqual(window.document.getElementById('farm-dialog-title').textContent, 'Next withdrawal');
    });

    await test('Changement de wallet après diffusion : hash conservé pour l’ancien compte, scène purgée et reprise exacte', async () => {
      verification = { confirmed: false };
      transferHook = async () => {
        app.user = otherWallet.address; app.signer = otherWallet; center.setAccount(otherWallet.address);
      };
      await center.startDeposit('1'); transferHook = null;
      assert.strictEqual(center.account, otherWallet.address.toLowerCase()); assert.strictEqual(center.pendingDeposit, null);
      assert.strictEqual(sceneCalls.states.at(-1).animals.length, 0);
      const saved = JSON.parse(window.localStorage.getItem(`fitia_farm_pending_deposit_v1:${wallet.address.toLowerCase()}`));
      assert.strictEqual(saved.txHash, transfers.at(-1).hash); assert.strictEqual(saved.amountUnits, '100000000');
      verification = { confirmed: true }; app.user = wallet.address; app.signer = wallet; center.setAccount(wallet.address);
      await center.checkPendingDeposit();
      await waitFor(() => center.state?.coins === 1090 && !center.pendingDeposit, 'reprise après changement de wallet');
      assert.strictEqual(window.localStorage.getItem(`fitia_farm_pending_deposit_v1:${wallet.address.toLowerCase()}`), null);
    });

    await test('Présentation : cinq entrées, Hub, illustrations locales et aucun micro-texte FARM', async () => {
      const document = window.document;
      const navItems = Array.from(document.querySelectorAll('.bottom-nav .nav-item'));
      assert.strictEqual(navItems.length, 5);
      assert.deepStrictEqual(navItems.map((item) => item.dataset.nav), ['dashboard', 'shop', 'store', 'my-rigs', 'hub']);
      assert.ok(document.getElementById('view-hub'));
      assert.strictEqual(document.querySelectorAll('#view-hub .hub-card').length, 7);
      assert.deepStrictEqual(Array.from(document.querySelectorAll('#view-hub .hub-card strong')).map((item) => item.textContent), ['FARM', 'Swap', 'Lucky Wheel', 'FITA Dice 3D', 'FITA Mines 3D', 'FITA Crash', 'Coin Flip 3D']);
      assert.ok(document.querySelector('#view-hub .hub-card-wheel img[src="assets/lucky-wheel.svg"]'));
      assert.ok(document.querySelector('#view-hub .hub-card-dice img[src="assets/dice.svg"]'));
      assert.ok(document.querySelector('#view-hub .hub-card-farm img[src="assets/farm/barn.svg"]'));
      assert.strictEqual(document.querySelectorAll('#view-hub .hub-swap-icons img').length, 2);
      assert.strictEqual(document.querySelector('.farm-camera-hint'), null);
      assert.strictEqual(document.querySelector('.farm-hero p'), null);
      assert.strictEqual(document.querySelector('.farm-quick-actions small'), null);
      assert.strictEqual(document.querySelector('.farm-stats-grid small'), null);
      assert.ok(document.querySelector('.farm-quick-actions img[src="assets/farm/chicken.svg"]'));
      const emoji = /[\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}\u{1F300}-\u{1FAFF}]/u;
      assert.ok(!emoji.test(document.getElementById('view-farm').textContent));
      center.openBuyAnimal();
      assert.strictEqual(document.querySelectorAll('#farm-dialog-content .farm-shop-icon').length, 3);
      assert.ok(Array.from(document.querySelectorAll('#farm-dialog-content img')).every((image) => image.getAttribute('src').startsWith('assets/farm/')));
      assert.strictEqual(document.querySelector('#farm-dialog-content .farm-dialog-copy'), null);
      assert.strictEqual(document.querySelector('#farm-dialog-content .farm-dialog-hint'), null);
      assert.ok(document.getElementById('farm-dialog-subtitle').classList.contains('hidden'));
      assert.ok(!emoji.test(document.getElementById('modal-farm-dialog').textContent));
      center.closeDialog(); center.openDeposit();
      assert.strictEqual(document.querySelector('#farm-dialog-content .farm-dialog-hint'), null);
      assert.ok(document.getElementById('farm-dialog-subtitle').classList.contains('hidden'));
      center.closeDialog();
    });

    await test('Verrouillage : compte, état et boucle 3D désactivés sans fuite de secret local', async () => {
      center.closeDialog(); center.setAccount(null);
      assert.strictEqual(center.account, null); assert.strictEqual(center.state, null); assert.strictEqual(center.active, false);
      assert.strictEqual(sceneCalls.active.at(-1), false);
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index); assert.ok(!String(window.localStorage.getItem(key)).includes('temporary-test'));
      }
    });
  } finally {
    clearInterval(center.clockTimer); clearInterval(center.pollTimer); clearInterval(center.backgroundPollTimer); clearTimeout(center.retryTimer);
    await new Promise((resolve) => server.close(resolve)); window.close();
  }
  console.log('═'.repeat(68)); console.log(`📊 RÉSULTAT UI FARM : ${passed} réussis, ${failed} échoués`);
  if (failed) process.exit(1);
})().catch((error) => { console.error(error); server.close(); window.close(); process.exit(1); });
