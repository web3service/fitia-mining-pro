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
const WheelConfig = require('../wheel-config');
const { MemoryFarmRepository, createFarmService } = require('../farm-service');
const { createFarmHandler } = require('../api/farm');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'android-src/wallet.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const dom = new JSDOM(html, { url: 'https://app.fitia.pro/wallet.html', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
Object.defineProperty(window, 'crypto', { value: crypto.webcrypto, configurable: true });
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
window.HTMLCanvasElement.prototype.getContext = function () {
  const gradient = { addColorStop() {} };
  const target = { canvas: this, createRadialGradient: () => gradient, createLinearGradient: () => gradient, measureText: (text) => ({ width: String(text).length * 8 }) };
  return new Proxy(target, { get: (object, property) => property in object ? object[property] : (() => {}), set: (object, property, value) => { object[property] = value; return true; } });
};
for (const file of ['vendor/ethers.umd.min.js', 'farm-config.js', 'farm-protocol.js', 'farm.js', 'wheel-config.js', 'wheel.js']) window.eval(fs.readFileSync(path.join(ROOT, file), 'utf8'));

const wallet = new ethers.Wallet(`0x${'66'.repeat(32)}`);
const otherWallet = new ethers.Wallet(`0x${'77'.repeat(32)}`);
const repository = new MemoryFarmRepository(); const randomValues = [];
const service = createFarmService({ repository, randomInt: () => randomValues.length ? randomValues.shift() : 0, paymentVerifier: async () => ({ confirmed: true }) });
const server = http.createServer(createFarmHandler({ farmService: service }));
const notifications = []; const toasts = [];
const app = {
  user: wallet.address, signer: wallet,
  showToast(message, error) { toasts.push({ message, error }); },
  nav(view) { if (view === 'farm') center.enter(); },
  activity: { notify(...args) { notifications.push(args); } }
};
const center = new window.FitiaFarmCenter(app); app.farmCenter = center;
const wheel = new window.FitiaLuckyWheel(app, center); app.luckyWheel = wheel;
let dropNextWheelResponse = false;
window.fetch = async (url, options) => {
  assert.strictEqual(url, 'https://fitia-mining-pro.vercel.app/api/farm');
  const response = await global.fetch(`http://127.0.0.1:${server.address().port}/api/farm`, options);
  const body = JSON.parse(options.body);
  if (dropNextWheelResponse && body.type === 'wheel_spin') {
    dropNextWheelResponse = false; await response.arrayBuffer(); throw new TypeError('simulated response loss');
  }
  return response;
};
let passed = 0; let failed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); }
}
async function signed(action, params = {}) {
  const body = { action, buyer: wallet.address, timestamp: Date.now(), ...params };
  body.signature = await wallet.signMessage(Protocol.message(action, body)); return body;
}
async function callAction(type, params = {}) { return service.action(await signed('action', { actionId: crypto.randomUUID(), type, params })); }
function segmentStart(id) {
  let cursor = 0;
  for (const segment of WheelConfig.SEGMENTS) { if (segment.id === id) return cursor; cursor += segment.weight; }
  throw new Error('Unknown segment');
}

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  console.log('\n🎡  TESTS UI LUCKY WHEEL\n' + '═'.repeat(68));
  try {
    const amountUnits = ethers.parseUnits('20', 8).toString();
    await service.deposit(await signed('deposit', { actionId: crypto.randomUUID(), txHash: `0x${'aa'.repeat(32)}`, amountUnits }));
    await callAction('buy_land'); await callAction('buy_animal', { species: 'chicken' });
    center.init(); wheel.init(); center.setAccount(wallet.address); wheel.setAccount(wallet.address);
    await center.refresh({ quiet: true }); wheel.enter();

    await test('Hub, logo local, quatre mises et onze probabilités accessibles', async () => {
      assert.strictEqual(window.document.querySelectorAll('#view-hub .hub-card').length, 3);
      assert.ok(window.document.querySelector('.hub-card-wheel img[src="assets/lucky-wheel.svg"]'));
      assert.strictEqual(window.document.querySelectorAll('[data-wheel-stake]').length, 4);
      assert.strictEqual(center.state.coins, 1250); assert.strictEqual(wheel.started(), true);
      wheel.openInfo(); assert.strictEqual(window.document.querySelectorAll('#wheel-probability-list .wheel-probability-row').length, 11);
      assert.strictEqual(window.document.getElementById('modal-wheel-info').classList.contains('active'), true); wheel.closeInfo();
    });

    await test('Tour gratuit : arrêt sur le résultat serveur, solde, historique et résultat affiché', async () => {
      const before = center.state.coins; randomValues.push(segmentStart('coins_triple'));
      wheel.setMode('free'); await wheel.spin();
      assert.strictEqual(center.state.coins, before + 60); assert.strictEqual(wheel.currentResult.segmentId, 'coins_triple');
      assert.strictEqual(wheel.pending, null); assert.strictEqual(center.state.wheel.recentSpins.length, 1);
      assert.ok(window.document.getElementById('wheel-result-title').textContent.includes('60'));
      assert.strictEqual(window.document.querySelectorAll('#wheel-history-list .wheel-history-row').length, 1);
    });

    await test('Mise FTA : 100 coins débités une fois, 2 FTA crédités en 200 coins et gain net exact', async () => {
      const before = center.state.coins; randomValues.push(segmentStart('fta_big'));
      wheel.setMode('paid'); wheel.setStake(100); await wheel.spin();
      assert.strictEqual(center.state.coins, before + 100); assert.strictEqual(wheel.currentResult.ftaCoins, 200);
      assert.ok(window.document.getElementById('wheel-result-title').textContent.includes('2 FTA'));
      assert.ok(window.document.getElementById('wheel-result-detail').textContent.includes('+100'));
      wheel.setStake(500); wheel.openInfo();
      assert.strictEqual(window.document.getElementById('wheel-probability-base').textContent, '500 coins');
      const rows = Array.from(window.document.querySelectorAll('.wheel-probability-row'));
      assert.ok(rows.at(-1).textContent.includes('10 FTA')); assert.ok(rows.at(-1).textContent.includes('2%')); wheel.closeInfo();
    });

    await test('Réponse perdue après tirage : même identifiant repris sans nouveau hasard ni second débit', async () => {
      wheel.setMode('paid'); wheel.setStake(50); const before = center.state.coins;
      randomValues.push(segmentStart('coins_half'), segmentStart('fta_big')); dropNextWheelResponse = true;
      await wheel.spin();
      assert.ok(wheel.pending); assert.strictEqual(wheel.operation, false);
      assert.strictEqual(window.document.getElementById('wheel-spin-button').textContent, 'RESUME SPIN');
      const pendingId = wheel.pending.actionId;
      const serverState = (await service.view(wallet.address.toLowerCase())).state;
      assert.strictEqual(serverState.coins, before - 25); assert.strictEqual(center.state.coins, before);
      assert.strictEqual(randomValues.length, 1);
      wheel.setAccount(otherWallet.address); assert.strictEqual(wheel.pending, null);
      wheel.setAccount(wallet.address); assert.strictEqual(wheel.pending.actionId, pendingId);
      await wheel.spin();
      assert.strictEqual(center.state.coins, before - 25); assert.strictEqual(wheel.currentResult.id, pendingId);
      assert.strictEqual(wheel.currentResult.segmentId, 'coins_half'); assert.strictEqual(wheel.pending, null);
      assert.strictEqual(randomValues.length, 1); randomValues.length = 0;
    });

    await test('Tour bonus : gain de spin affiché puis consommé sans mise', async () => {
      randomValues.push(segmentStart('extra_spin')); const before = center.state.coins;
      wheel.setStake(50); await wheel.spin();
      assert.strictEqual(center.state.coins, before - 50); assert.strictEqual(center.state.wheel.bonusSpins, 1);
      randomValues.push(segmentStart('feed')); const feedBefore = center.state.feed;
      wheel.setMode('bonus'); await wheel.spin();
      assert.strictEqual(center.state.coins, before - 50); assert.strictEqual(center.state.feed, feedBefore + 1);
      assert.strictEqual(center.state.wheel.bonusSpins, 0); assert.strictEqual(wheel.mode, 'paid');
    });

    await test('Retrait : pending silencieux, paid pendant la fermeture puis une seule notification', async () => {
      const id = crypto.randomUUID();
      await service.withdraw(await signed('withdraw', { actionId: id, coins: 100 }));
      await center.refresh({ quiet: true }); assert.strictEqual(notifications.length, 0);
      center.setAccount(null); wheel.setAccount(null);
      await service.completeWithdrawal({ id, txHash: `0x${'bb'.repeat(32)}` });
      center.setAccount(wallet.address); wheel.setAccount(wallet.address); await center.refresh({ quiet: true });
      assert.strictEqual(notifications.length, 1); assert.strictEqual(notifications[0][1], 'FARM withdrawal paid');
      assert.ok(notifications[0][2].startsWith('1 FTA'));
      await center.refresh({ quiet: true }); assert.strictEqual(notifications.length, 1);
    });

    await test('Cycle de vie : aucun redraw masqué et annulation d’animation toujours résolue', async () => {
      const originalDraw = wheel.draw; let drawCount = 0;
      wheel.active = false; wheel.draw = () => { drawCount += 1; };
      wheel.render(); assert.strictEqual(drawCount, 0);
      wheel.draw = originalDraw; wheel.active = true;
      const originalMatchMedia = window.matchMedia;
      try {
        window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
        const animation = wheel.animateResult({ segmentId: 'coins_half' });
        wheel.cancelAnimation();
        await Promise.race([animation, new Promise((_, reject) => setTimeout(() => reject(new Error('Animation cancellation blocked')), 100))]);
      } finally { window.matchMedia = originalMatchMedia; }
    });

    await test('Sortie pendant un tour : arrêt du rendu, résultat serveur conservé et reprise sans blocage', async () => {
      const originalMatchMedia = window.matchMedia;
      try {
        window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
        const before = center.state.coins; randomValues.push(segmentStart('coins_half'));
        wheel.setMode('paid'); wheel.setStake(50);
        const spinning = wheel.spin(); await new Promise((resolve) => setTimeout(resolve, 20));
        wheel.exit();
        await Promise.race([spinning, new Promise((_, reject) => setTimeout(() => reject(new Error('Spin blocked after exit')), 500))]);
        assert.strictEqual(center.state.coins, before - 25); assert.strictEqual(wheel.pending, null); assert.strictEqual(wheel.operation, false);
        wheel.enter(); assert.strictEqual(wheel.active, true);
      } finally { window.matchMedia = originalMatchMedia; }
    });

    await test('Canvas indisponible : logo de secours et ouverture sans exception', async () => {
      wheel.setCanvasFallback(); wheel.resize(); wheel.enter();
      assert.strictEqual(wheel.context, null); assert.strictEqual(wheel.active, true);
      assert.ok(window.document.querySelector('.wheel-stage').classList.contains('canvas-unavailable'));
    });

    await test('Verrouillage : timers et reprise purgés sans fuite de secret', async () => {
      center.setAccount(null); wheel.setAccount(null);
      assert.strictEqual(wheel.account, null); assert.strictEqual(wheel.pending, null); assert.strictEqual(wheel.operation, false);
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index); assert.ok(!String(window.localStorage.getItem(key)).includes('privateKey'));
      }
    });
  } finally {
    clearInterval(center.clockTimer); clearInterval(center.pollTimer); clearInterval(center.backgroundPollTimer); clearTimeout(center.retryTimer);
    clearInterval(wheel.clockTimer); wheel.cancelAnimation(); wheel.resizeObserver?.disconnect();
    await new Promise((resolve) => server.close(resolve)); window.close();
  }
  console.log('═'.repeat(68)); console.log(`📊 RÉSULTAT UI WHEEL : ${passed} réussis, ${failed} échoués`);
  if (failed) process.exit(1);
})().catch((error) => { console.error(error); server.close(); window.close(); process.exit(1); });
