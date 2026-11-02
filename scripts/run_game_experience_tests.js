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
window.HTMLCanvasElement.prototype.getContext = function () {
  const gradient = { addColorStop() {} };
  return new Proxy({ canvas: this, createRadialGradient: () => gradient, createLinearGradient: () => gradient }, {
    get: (target, property) => property in target ? target[property] : (() => {}),
    set: (target, property, value) => { target[property] = value; return true; }
  });
};

const scripts = [
  'vendor/ethers.umd.min.js', 'game-visibility-config.js', 'game-visibility.js',
  'farm-config.js', 'farm-protocol.js', 'farm.js', 'dice-config.js', 'dice.js',
  'arcade-config.js', 'arcade.js', 'game-experience-farm.js', 'game-experience-hub.js',
  'game-experience-dice.js', 'game-experience-mines.js', 'game-experience-flip.js'
];
for (const file of scripts) window.eval(fs.readFileSync(path.join(ROOT, file), 'utf8'));

const wallet = new ethers.Wallet(`0x${'55'.repeat(32)}`);
const repository = new MemoryFarmRepository();
const randomValues = [];
const service = createFarmService({ repository, randomInt: () => randomValues.length ? randomValues.shift() : 0, paymentVerifier: async () => ({ confirmed: true }) });
const server = http.createServer(createFarmHandler({ farmService: service }));
const app = {
  user: wallet.address, signer: wallet, nav() {}, showToast() {}, activity: { notify() {} }
};
const center = new window.FitiaFarmCenter(app); app.farmCenter = center;
const dice = new window.FitiaDice(app, center); app.fitaDice = dice;
const mines = new window.FitiaMines(app, center); app.fitaMines = mines;
const flip = new window.FitiaCoinFlip(app, center); app.fitaCoinFlip = flip;
const visibility = new window.FitiaGameVisibilityCenter(app); app.gameVisibility = visibility;
let dropType = null;
window.fetch = async (url, options) => {
  assert.strictEqual(url, 'https://fitia-mining-pro.vercel.app/api/farm');
  const response = await global.fetch(`http://127.0.0.1:${server.address().port}/api/farm`, options);
  const body = JSON.parse(options.body);
  if (body.type === dropType) {
    dropType = null;
    await response.arrayBuffer();
    throw new TypeError('response lost after server commit');
  }
  return response;
};

let passed = 0;
let failed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); }
}
async function signed(action, params = {}) {
  const body = { action, buyer: wallet.address, timestamp: Date.now(), ...params };
  body.signature = await wallet.signMessage(Protocol.message(action, body));
  return body;
}
async function callAction(type, params = {}) {
  return service.action(await signed('action', { actionId: crypto.randomUUID(), type, params }));
}
function setAccounts(account) {
  app.user = account; app.signer = account ? wallet : null;
  center.setAccount(account); dice.setAccount(account); mines.setAccount(account); flip.setAccount(account);
}

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  console.log('\n🎮  TESTS UI GAME EXPERIENCE PRODUCTION\n' + '═'.repeat(72));
  try {
    await service.deposit(await signed('deposit', { actionId: crypto.randomUUID(), txHash: `0x${'ae'.repeat(32)}`, amountUnits: ethers.parseUnits('20', 8).toString() }));
    await callAction('buy_land');
    await callAction('buy_animal', { species: 'chicken' });
    visibility.init(); center.init(); dice.init(); mines.init(); flip.init();
    window.setupGameFarm(app); window.setupGameHub(); window.setupGameDice(app); window.setupGameMines(app); window.setupGameFlip(app);
    visibility.apply(); setAccounts(wallet.address.toLowerCase());
    await center.refresh({ quiet: true });

    await test('Hub regroupé, logos locaux, cinq navigations et masquage uniquement visuel', async () => {
      assert.strictEqual(window.document.querySelectorAll('#view-hub .hub-card').length, 7);
      assert.strictEqual(window.document.querySelectorAll('.bottom-nav .nav-item').length, 5);
      window.document.getElementById('ph-open-games').click();
      assert.strictEqual(window.document.getElementById('game-hub-games').hidden, false);
      assert.strictEqual(window.document.getElementById('game-hub-landing').hidden, true);
      for (const source of ['farm-hub.jpg', 'wheel.svg', 'dice.svg', 'mines.svg', 'crash.svg', 'coin-flip.svg']) {
        assert.ok(window.document.querySelector(`#view-hub img[src="assets/games/${source}"]`), source);
        assert.ok(fs.statSync(path.join(ROOT, 'assets/games', source)).size > 0, source);
      }
      const coins = center.state.coins;
      visibility.hiddenGames = new Set(['dice']); visibility.apply();
      assert.ok(window.document.querySelector('#view-hub [data-game-id="dice"]').classList.contains('hidden'));
      assert.strictEqual(center.state.coins, coins);
      assert.ok(window.document.getElementById('view-dice'));
      visibility.hiddenGames = new Set(); visibility.apply();
      window.document.getElementById('ph-back-hub').click();
      assert.strictEqual(window.document.getElementById('game-hub-landing').hidden, false);
    });

    await test('FARM : présentation adaptée, photos locales et économie réelle inchangée', async () => {
      const farmView = window.document.getElementById('view-farm');
      assert.ok(farmView.querySelector('.pf-page'));
      assert.ok(farmView.querySelector('#farm-3d-container'));
      assert.strictEqual(farmView.querySelectorAll('[data-farm-tab]').length, 4);
      assert.strictEqual(farmView.querySelectorAll('.farm-quick-actions button').length, 5);
      assert.strictEqual(farmView.querySelector('.pf-scene > img'), null, 'La scène 3D ne doit pas être remplacée par une image');
      assert.ok(!/DÉMO|FICTIF|Simulation|10 000|Réinitialise/i.test(farmView.textContent));
      assert.strictEqual(window.document.getElementById('farm-coin-balance').textContent, center.state.coins.toLocaleString('en-US'));
      assert.ok(farmView.querySelector('#farm-animal-list img[src="assets/games/farm-chicken.jpg"]'));
      for (const name of ['chicken', 'sheep', 'cow', 'wheat', 'carrot']) {
        assert.ok(fs.statSync(path.join(ROOT, `assets/games/farm-${name}.jpg`)).size > 0, name);
      }
      assert.ok(!Object.hasOwn(center, 'request'));
      assert.ok(!Object.hasOwn(center, 'perform'));
      const beforeCoins = center.state.coins;
      const beforeFeed = center.state.feed;
      await center.perform('buy_feed');
      assert.strictEqual(center.state.coins, beforeCoins - window.FitiaFarmConfig.FEED_PACK_PRICE);
      assert.strictEqual(center.state.feed, beforeFeed + window.FitiaFarmConfig.FEED_PACK_QUANTITY);
      const serverState = (await service.view(wallet.address.toLowerCase())).state;
      assert.strictEqual(serverState.coins, center.state.coins);
      assert.strictEqual(serverState.feed, center.state.feed);
      assert.strictEqual(window.document.getElementById('farm-feed-count').textContent, String(center.state.feed));
    });

    await test('Aucun contenu de démonstration ni asset distant dans les écrans adaptés', async () => {
      for (const id of ['view-dice', 'view-mines', 'view-coin-flip']) {
        const text = window.document.getElementById(id).textContent;
        assert.ok(!/DÉMO|FICTIF|Simulation|10 000|Réinitialise|hors inventaire/i.test(text), id);
      }
      for (const file of fs.readdirSync(ROOT).filter((name) => /^game-experience.*\.js$/.test(name))) {
        const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
        assert.ok(!/fitia-mining-pro-test|com\.fitia\.miningpro\.test|preview-(?:demo|games|crash|farm)/i.test(source), file);
        for (const match of source.matchAll(/(?:src=\\?"|image\.src = ')([^'"$]+)/g)) {
          const isTemplate = source[match.index + match[0].length] === '$';
          if (match[1].startsWith('assets/') && !isTemplate) assert.ok(fs.existsSync(path.join(ROOT, match[1])), `${file}: ${match[1]}`);
        }
      }
    });

    await test('Dice : contrôles du nouvel écran et gain réel signé de 45 coins nets', async () => {
      dice.enter();
      window.document.querySelector('[data-dice-target="5"]').click();
      assert.strictEqual(dice.selectedTarget, 5);
      window.document.querySelector('[data-dice-target="4"]').click();
      window.document.querySelector('[data-dice-stake="50"]').click();
      const before = center.state.coins; randomValues.push(0);
      await dice.roll();
      assert.strictEqual(dice.currentResult.roll, 1);
      assert.strictEqual(dice.currentResult.won, true);
      assert.strictEqual(center.state.coins, before + 45);
      assert.ok(window.document.getElementById('dice-result-title').textContent.includes('WIN'));
      assert.ok(window.document.getElementById('dice-result-detail').textContent.includes('Gross 95'));
      assert.strictEqual(window.document.querySelectorAll('#dice-history-list .pd-history-row').length, 1);
      assert.strictEqual(window.document.getElementById('dice-coin-balance').textContent, center.state.coins.toLocaleString('en-US'));
    });

    await test('Mines : vraie manche serveur, révélation sûre, cashout et historique', async () => {
      mines.enter();
      window.document.querySelector('[data-mines-count="3"]').click();
      window.document.querySelector('[data-mines-stake="50"]').click();
      const before = center.state.coins;
      await mines.start();
      assert.strictEqual(center.state.coins, before - 50);
      await mines.reveal(3);
      assert.ok(window.document.querySelector('[data-mines-index="3"]').classList.contains('safe'));
      assert.strictEqual(window.document.getElementById('mines-current-payout').textContent, '53 coins');
      await mines.cashout();
      assert.strictEqual(center.state.coins, before + 3);
      assert.strictEqual(window.document.getElementById('mines-result-title').textContent, 'CASHED OUT · 53 COINS');
      assert.strictEqual(window.document.querySelectorAll('#mines-history-list .mine-history-row').length, 1);
      assert.ok(window.document.querySelector('[data-mines-index="3"] img[src="assets/games/mines-gem.svg"]'));
    });

    await test('Coin Flip : réponse perdue puis reprise du même résultat sans nouveau tirage', async () => {
      flip.enter();
      window.document.querySelector('[data-flip-choice="heads"]').click();
      window.document.querySelector('[data-flip-stake="50"]').click();
      const before = center.state.coins; randomValues.push(0, 1); dropType = 'coin_flip';
      await flip.play();
      assert.ok(flip.pending);
      assert.strictEqual(flip.operation, false);
      assert.strictEqual(window.document.getElementById('flip-play-button').textContent, 'RESUME FLIP');
      const actionId = flip.pending.actionId;
      const serverState = (await service.view(wallet.address.toLowerCase())).state;
      assert.strictEqual(serverState.coins, before + 45);
      assert.strictEqual(center.state.coins, before);
      assert.strictEqual(randomValues.length, 1);
      await flip.play();
      assert.strictEqual(flip.currentResult.id, actionId);
      assert.strictEqual(flip.currentResult.result, 'heads');
      assert.strictEqual(center.state.coins, before + 45);
      assert.strictEqual(randomValues.length, 1);
      assert.strictEqual(flip.pending, null);
      assert.strictEqual(window.document.querySelectorAll('#flip-history-list .cf-history-row').length, 1);
      randomValues.length = 0;
    });

    await test('Verrouillage : les nouvelles scènes sont arrêtées et les sessions purgées', async () => {
      setAccounts(null);
      for (const game of [dice, mines, flip]) {
        assert.strictEqual(game.account, null);
        assert.strictEqual(game.pending, null);
        assert.strictEqual(game.operation, false);
      }
    });
  } finally {
    clearInterval(center.clockTimer); clearInterval(center.pollTimer); clearInterval(center.backgroundPollTimer); clearTimeout(center.retryTimer);
    for (const game of [dice, mines, flip]) { game.exit(); game.scene?.cancelAnimation(); }
    await new Promise((resolve) => server.close(resolve));
    window.close();
  }
  console.log('═'.repeat(72));
  console.log(`🎮  RÉSULTAT GAME EXPERIENCE : ${passed} réussis, ${failed} échoués`);
  if (failed) process.exit(1);
})().catch((error) => {
  console.error(error);
  server.close(); window.close(); process.exit(1);
});
