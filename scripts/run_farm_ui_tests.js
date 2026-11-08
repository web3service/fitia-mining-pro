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
for (const file of ['vendor/ethers.umd.min.js', 'farm-config.js', 'farm-protocol.js', 'farm.js', 'game-experience-farm.js']) window.eval(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const sceneCalls = { states: [], active: [], focus: [] };
window.FitiaFarm3D = {
  create(container, options) {
    assert.ok(container.id === 'farm-3d-container'); assert.strictEqual(typeof options.onSelect, 'function'); sceneCalls.select = options.onSelect;
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
  mfaClient: { operation: async () => ({ required: false }) },
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
app.farmCenter = center;
window.setupGameFarm(app);
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
      const action = [...window.document.querySelectorAll('#farm-dialog-actions button')].find(button => button.textContent.includes('GROWING'));
      assert.ok(action); assert.strictEqual(action.disabled, true);
      center.closeDialog(); center.setTab('animals'); assert.ok(sceneCalls.focus.includes('animals'));
    });

    await test('Actions prêtes : mise à jour, ouverture ciblée et aucune modification locale du solde', async () => {
      const document = window.document;
      const crop = center.state.crops[0];
      const previous = crop.readyAt;
      const before = center.state.coins;
      const originalOpen = center.openEntity;
      const opened = [];
      try {
        app.currentLang = 'fr';
        crop.readyAt = Date.now() + 60000; center.tick();
        assert.strictEqual(document.querySelectorAll('.pf-ready-item').length, 0);
        assert.strictEqual(document.getElementById('pf-ready-title').textContent, 'Prêt sur votre ferme');
        crop.readyAt = Date.now() - 1; center.tick();
        assert.strictEqual(document.getElementById('pf-ready-count').textContent, '1');
        const button = document.querySelector('.pf-ready-item');
        assert.ok(button.textContent.includes('Blé')); assert.ok(button.textContent.includes('Récolter'));
        center.openEntity = (kind, id) => opened.push([kind, id]);
        button.click(); assert.deepStrictEqual(opened, [['crop', crop.id]]);
        assert.strictEqual(center.state.coins, before);
        assert.strictEqual(document.querySelector('[data-farm-tab="animals"]').textContent, 'Animaux');
        app.currentLang = 'en'; center.tick();
        assert.strictEqual(document.querySelector('[data-farm-tab="animals"]').textContent, 'Animals');
        const animal = center.state.animals[0]; const originalTime = animal.produceAt;
        try {
          animal.produceAt = Date.now() - 1; center.tick();
          assert.strictEqual(document.querySelectorAll('.pf-ready-item').length, 2);
          document.querySelectorAll('.pf-ready-item')[1].click();
          assert.deepStrictEqual(opened[1], ['animal', animal.id]);
        } finally { animal.produceAt = originalTime; }
        center.operation = true; center.tick(); assert.strictEqual(document.querySelector('.pf-ready-item').disabled, true);
      } finally {
        center.operation = false; center.openEntity = originalOpen; crop.readyAt = previous;
        app.currentLang = 'en'; center.tick();
      }
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
      assert.ok(document.querySelector('#view-farm .pf-page'));
      assert.ok(document.querySelector('#view-farm #farm-3d-container'));
      assert.strictEqual(document.querySelectorAll('#view-farm .pf-stats > div').length, 4);
      assert.ok(document.querySelector('.farm-quick-actions img[src="assets/games/farm-chicken.jpg"]'));
      const emoji = /[\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}\u{1F300}-\u{1FAFF}]/u;
      assert.ok(!emoji.test(document.getElementById('view-farm').textContent));
      center.openBuyAnimal();
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(document.querySelectorAll('#farm-dialog-content .farm-shop-icon').length, 5);
      assert.ok(Array.from(document.querySelectorAll('#farm-dialog-content img')).every((image) => /^assets\/(farm|games)\//.test(image.getAttribute('src'))));
      assert.ok(document.querySelector('#farm-dialog-content img[src="assets/games/farm-chicken.jpg"]'));
      assert.strictEqual(document.querySelector('#farm-dialog-content .farm-dialog-copy'), null);
      assert.strictEqual(document.querySelector('#farm-dialog-content .farm-dialog-hint'), null);
      assert.ok(document.getElementById('farm-dialog-subtitle').classList.contains('hidden'));
      assert.ok(!emoji.test(document.getElementById('modal-farm-dialog').textContent));
      center.closeDialog(); center.openDeposit();
      assert.strictEqual(document.querySelector('#farm-dialog-content .farm-dialog-hint'), null);
      assert.ok(document.getElementById('farm-dialog-subtitle').classList.contains('hidden'));
      center.closeDialog();
    });

    await test('Marché : vente partielle signée, validation de quantité et solde calculé côté serveur', async () => {
      // Jeu mémoire uniquement : un stock connu pour tester le parcours écran -> API.
      const key = wallet.address.toLowerCase();
      const record = repository.accounts.get(key);
      record.state.inventory.wheat = 2; record.state.inventory.carrot = 2;
      await center.refresh({ quiet: true });
      const before = center.state.coins;
      center.openSell();
      const document = window.document;
      const rows = document.querySelectorAll('.farm-market-row');
      assert.strictEqual(rows.length, 2);
      const input = rows[0].querySelector('input'); const button = rows[0].querySelector('button');
      input.value = '3'; button.click();
      assert.ok(document.getElementById('farm-dialog-error').textContent.includes('quantity'));
      assert.strictEqual(center.state.coins, before);
      input.value = '1'; button.click();
      await waitFor(() => center.state.coins === before + 12 && !center.operation, 'vente partielle confirmée');
      assert.strictEqual(center.state.inventory.wheat, 1);
      assert.strictEqual(center.state.inventory.carrot, 2);
      assert.strictEqual(document.querySelectorAll('#farm-market-history .pf-market-sale').length, 1);
      assert.ok(document.getElementById('farm-market-history').textContent.includes('1 × Wheat'));
      assert.ok(document.getElementById('farm-market-history').textContent.includes('12 F-Coins'));
      await center.refresh({ quiet: true });
      assert.strictEqual(document.querySelectorAll('#farm-market-history .pf-market-sale').length, 1);
      assert.strictEqual(document.getElementById('modal-farm-dialog').classList.contains('active'), false);
    });

    await test('Marché : réponse perdue, reprise après reconnexion et aucun double crédit', async () => {
      const record = repository.accounts.get(wallet.address.toLowerCase());
      record.state.inventory.carrot = 0;
      await center.refresh({ quiet: true });
      const initialCoins = center.state.coins;
      const initialStock = center.state.inventory.wheat;
      const realFetch = window.fetch; const ids = []; let loseResponse = true;
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && body.type === 'sell_item') {
          ids.push(body.actionId);
          const response = await realFetch(url, options);
          if (loseResponse) { loseResponse = false; throw new Error('Connection lost after commit'); }
          return response;
        }
        return realFetch(url, options);
      };
      try {
        center.openSell(); window.document.querySelector('.farm-market-row button').click();
        await waitFor(() => ids.length === 1 && !center.operation, 'réponse perdue');
        assert.ok(window.localStorage.getItem(`fitia_farm_market_pending_v1:${wallet.address.toLowerCase()}`));
        center.setAccount(wallet.address); await center.refresh({ quiet: true });
        assert.strictEqual(center.state.coins, initialCoins + 12);
        assert.strictEqual(center.state.inventory.wheat, initialStock - 1);
        assert.strictEqual(center.state.inventory.wheat, 0);
        assert.strictEqual(window.document.getElementById('farm-sell-inventory').disabled, false, 'La vente en attente reste accessible même si le stock est vide');
        center.openSell();
        const retry = window.document.querySelector('#farm-dialog-actions button');
        assert.strictEqual(retry.textContent, 'CHECK SALE'); retry.click();
        await waitFor(() => ids.length === 2 && !center.operation, 'reprise de la vente');
        assert.strictEqual(ids[0], ids[1]);
        assert.strictEqual(center.state.coins, initialCoins + 12);
        assert.strictEqual(center.state.inventory.wheat, initialStock - 1);
        assert.strictEqual(center.state.marketSales.length, 2, 'Le rejeu ne crée pas de vente supplémentaire');
        assert.strictEqual(window.document.querySelectorAll('#farm-market-history .pf-market-sale').length, 2);
        assert.strictEqual(window.localStorage.getItem(`fitia_farm_market_pending_v1:${wallet.address.toLowerCase()}`), null);
      } finally { window.fetch = realFetch; center.closeDialog(); }
    });

    await test('Parcelles : sélection, réponse perdue et reprise sans double débit', async () => {
      const document = window.document; const originalFetch = window.fetch; const ids = []; let lose = true;
      const before = center.state.coins;
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && body.type === 'plant_plot') {
          ids.push(body.actionId); const response = await originalFetch(url, options);
          if (lose) { lose = false; throw new Error('Lost response after commit'); }
          return response;
        }
        return originalFetch(url, options);
      };
      try {
        assert.strictEqual(document.querySelectorAll('#farm-plot-grid button').length, 6);
        sceneCalls.select({ kind: 'plot', id: 5 });
        assert.ok(document.getElementById('farm-dialog-content').textContent.includes('Plot 6'));
        document.querySelector('#farm-dialog-content .farm-shop-card button').click();
        await waitFor(() => ids.length === 1 && !center.operation, 'plantation sans réponse');
        center.setAccount(wallet.address); await center.refresh({ quiet: true });
        assert.strictEqual(center.state.coins, before - 10);
        assert.strictEqual(center.state.crops.find(c => c.id === ids[0]).plot, 5);
        assert.strictEqual(sceneCalls.states.at(-1).crops.find(c => c.id === ids[0]).plot, 5);
        assert.ok(document.querySelectorAll('#farm-plot-grid button')[5].classList.contains('occupied'));
        center.openPlant(); const retry = document.querySelector('#farm-dialog-actions button');
        assert.strictEqual(retry.textContent, 'CHECK PLANTING'); retry.click();
        await waitFor(() => ids.length === 2 && !center.operation, 'reprise plantation');
        assert.strictEqual(ids[0], ids[1]); assert.strictEqual(center.state.coins, before - 10);
        assert.strictEqual(center.state.crops.filter(c => c.plot === 5).length, 1);
        assert.strictEqual(window.localStorage.getItem(`fitia_farm_plot_pending_v1:${wallet.address.toLowerCase()}`), null);
        document.querySelectorAll('#farm-plot-grid button')[5].click();
        assert.ok(document.getElementById('modal-farm-dialog').classList.contains('active'));
      } finally { window.fetch = originalFetch; center.closeDialog(); }
    });

    await test('Progression : objectifs réels, niveau et navigation sans récompense', async () => {
      const document = window.document; const progress = center.state.farmProgress;
      assert.strictEqual(progress.planted, 2);
      assert.strictEqual(progress.sales, 2);
      assert.strictEqual(document.querySelectorAll('#farm-missions .pf-mission').length, 6);
      assert.ok(document.querySelectorAll('#farm-missions .pf-mission')[0].textContent.includes('2 / 3'));
      const coins = center.state.coins;
      document.querySelectorAll('#farm-missions .pf-mission')[2].click();
      assert.strictEqual(center.tab, 'animals'); assert.strictEqual(center.state.coins, coins);
      app.currentLang = 'fr'; center.renderProgress();
      assert.ok(document.getElementById('farm-level').textContent.startsWith('Niveau'));
      assert.ok(document.getElementById('farm-missions').textContent.includes('Planter'));
      app.currentLang = 'en'; center.renderProgress();
      await center.refresh({ quiet: true });
      assert.strictEqual(center.state.farmProgress.planted, 2);
      assert.strictEqual(center.state.farmProgress.sales, 2);
      assert.strictEqual(center.state.coins, coins);
    });

    await test('Moulin : transformation, réponse perdue et reprise sans consommation répétée', async () => {
      const document = window.document; const record = repository.accounts.get(wallet.address.toLowerCase());
      record.state.inventory.wheat = 1;
      await center.refresh({ quiet: true });
      const beforeCoins = center.state.coins; const beforeFeed = center.state.feed;
      const originalFetch = window.fetch; const ids = []; let lose = true;
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && body.type === 'mill_feed') {
          ids.push(body.actionId); const response = await originalFetch(url, options);
          if (lose) { lose = false; throw new Error('Lost response after commit'); }
          return response;
        }
        return originalFetch(url, options);
      };
      try {
        sceneCalls.select({ kind: 'building', id: 'mill' });
        assert.ok(document.getElementById('farm-dialog-content').textContent.includes('1 wheat = 2 feed'));
        assert.ok(document.getElementById('farm-dialog-content').textContent.includes('12 F-Coins'));
        document.querySelector('#farm-dialog-actions button').click();
        await waitFor(() => ids.length === 1 && !center.operation, 'moulin sans réponse');
        center.setAccount(wallet.address); await center.refresh({ quiet: true });
        assert.strictEqual(center.state.inventory.wheat, 0); assert.strictEqual(center.state.feed, beforeFeed + 2); assert.strictEqual(center.state.coins, beforeCoins);
        center.openMill(); const retry = document.querySelector('#farm-dialog-actions button');
        assert.strictEqual(retry.textContent, 'CHECK MILLING'); retry.click();
        await waitFor(() => ids.length === 2 && !center.operation, 'reprise moulin');
        assert.strictEqual(ids[0], ids[1]); assert.strictEqual(center.state.feed, beforeFeed + 2); assert.strictEqual(center.state.coins, beforeCoins);
        assert.strictEqual(window.localStorage.getItem(`fitia_farm_mill_pending_v1:${wallet.address.toLowerCase()}`), null);
        center.openMill(); assert.strictEqual(document.querySelector('#farm-dialog-actions button').disabled, true);
        center.closeDialog(); sceneCalls.select({ kind: 'building', id: 'barn' }); assert.strictEqual(center.tab, 'barn');
      } finally { window.fetch = originalFetch; center.closeDialog(); }
    });

    await test('Maïs : plantation sur parcelle, récolte et vente depuis le jeu', async () => {
      const document = window.document; const originalCoins = center.state.coins;
      center.openPlant(3);
      const cards = [...document.querySelectorAll('#farm-dialog-content .farm-shop-card')];
      assert.strictEqual(cards.length, 4);
      assert.ok(cards[2].textContent.includes('Maize')); assert.ok(cards[3].textContent.includes('Tomato'));
      cards[2].querySelector('button').click();
      await waitFor(() => !center.operation && center.state.crops.some(c => c.species === 'maize'), 'plantation maïs');
      const crop = center.state.crops.find(c => c.species === 'maize');
      assert.strictEqual(crop.plot, 3); assert.strictEqual(center.state.coins, originalCoins - 10);
      assert.strictEqual(sceneCalls.states.at(-1).crops.find(c => c.id === crop.id).species, 'maize');
      const record = repository.accounts.get(wallet.address.toLowerCase());
      record.state.crops.find(c => c.id === crop.id).readyAt = Date.now() - 100;
      await center.refresh({ quiet: true }); center.openEntity('crop', crop.id);
      const harvest = document.querySelector('#farm-dialog-actions button'); assert.strictEqual(harvest.disabled, false); harvest.click();
      await waitFor(() => !center.operation && center.state.inventory.maize === 2, 'récolte maïs');
      center.openSell();
      const row = [...document.querySelectorAll('.farm-market-row')].find(el => el.textContent.includes('Maize'));
      assert.ok(row); row.querySelector('button').click();
      await waitFor(() => !center.operation && center.state.inventory.maize === 1, 'vente maïs');
      assert.strictEqual(center.state.coins, originalCoins + 2);
      assert.strictEqual(center.state.marketSales[0].items[0].product, 'maize');
      assert.ok(document.querySelector('#farm-inventory-list img[src="assets/farm/maize.svg"]'));
    });

    await test('Tracteur : récolte groupée et reprise après réponse perdue', async () => {
      const document = window.document; const record = repository.accounts.get(wallet.address.toLowerCase());
      assert.ok(record.state.crops.length >= 2);
      for (const crop of record.state.crops) crop.readyAt = Date.now() - 100;
      await center.refresh({ quiet: true });
      const before = center.state.inventory.wheat; const count = center.state.crops.length; const coins = center.state.coins;
      const originalFetch = window.fetch; const ids = []; let lose = true;
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && body.type === 'harvest_ready') {
          ids.push(body.actionId); const response = await originalFetch(url, options);
          if (lose) { lose = false; throw new Error('Lost response after commit'); }
          return response;
        }
        return originalFetch(url, options);
      };
      try {
        sceneCalls.select({ kind: 'building', id: 'tractor' });
        assert.ok(document.getElementById('farm-dialog-content').textContent.includes(`${count} ready plot(s)`));
        document.querySelector('#farm-dialog-actions button').click();
        await waitFor(() => ids.length === 1 && !center.operation, 'récolte groupée sans réponse');
        center.setAccount(wallet.address); await center.refresh({ quiet: true });
        assert.strictEqual(center.state.crops.length, 0);
        assert.strictEqual(center.state.inventory.wheat, before + count * 2); assert.strictEqual(center.state.coins, coins);
        center.openTractor(); document.querySelector('#farm-dialog-actions button').click();
        await waitFor(() => ids.length === 2 && !center.operation, 'reprise tracteur');
        assert.strictEqual(ids[0], ids[1]); assert.strictEqual(center.state.inventory.wheat, before + count * 2);
        assert.strictEqual(center.state.coins, coins);
        assert.strictEqual(window.localStorage.getItem(`fitia_farm_tractor_pending_v1:${wallet.address.toLowerCase()}`), null);
      } finally { window.fetch = originalFetch; center.closeDialog(); }
    });

    await test('Silo : nourrissage groupé et reprise sans double consommation', async () => {
      const document = window.document; const record = repository.accounts.get(wallet.address.toLowerCase());
      record.state.feed = 3; record.state.animals[0].produceAt = 0;
      await center.refresh({ quiet: true }); const beforeCoins = center.state.coins;
      const originalFetch = window.fetch; const ids = []; const params = []; let lose = true;
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && body.type === 'feed_group') {
          ids.push(body.actionId); params.push(body.params.animalIds); const response = await originalFetch(url, options);
          if (lose) { lose = false; throw new Error('Lost response after commit'); }
          return response;
        }
        return originalFetch(url, options);
      };
      try {
        sceneCalls.select({ kind: 'building', id: 'silo' });
        assert.ok(document.getElementById('farm-dialog-content').textContent.includes('1 available animal(s)'));
        assert.ok(document.getElementById('farm-dialog-content').textContent.includes('Cost: 1'));
        document.querySelector('#farm-dialog-actions button').click();
        await waitFor(() => ids.length === 1 && !center.operation, 'distribution sans réponse');
        center.setAccount(wallet.address); await center.refresh({ quiet: true });
        assert.strictEqual(center.state.feed, 2); assert.strictEqual(center.state.coins, beforeCoins);
        assert.ok(center.state.animals[0].produceAt > Date.now());
        center.openSilo(); assert.strictEqual(document.querySelector('#farm-dialog-actions button').textContent, 'CHECK FEEDING');
        document.querySelector('#farm-dialog-actions button').click();
        await waitFor(() => ids.length === 2 && !center.operation, 'reprise distribution');
        assert.strictEqual(ids[0], ids[1]); assert.deepStrictEqual(params[0], params[1]);
        assert.strictEqual(center.state.feed, 2); assert.strictEqual(center.state.coins, beforeCoins);
        assert.strictEqual(window.localStorage.getItem(`fitia_farm_silo_pending_v1:${wallet.address.toLowerCase()}`), null);
      } finally { window.fetch = originalFetch; center.closeDialog(); }
    });

    await test('Silo : collecte groupée et reprise après réponse perdue', async () => {
      const document = window.document; const record = repository.accounts.get(wallet.address.toLowerCase());
      record.state.animals[0].produceAt = Date.now() - 100;
      await center.refresh({ quiet: true }); const beforeCoins = center.state.coins, beforeEggs = center.state.inventory.eggs;
      const originalFetch = window.fetch; const ids = []; const selections = []; let lose = true;
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && body.type === 'collect_group') {
          ids.push(body.actionId); selections.push(body.params.animalIds); const response = await originalFetch(url, options);
          if (lose) { lose = false; throw new Error('Lost response after commit'); }
          return response;
        }
        return originalFetch(url, options);
      };
      try {
        center.openSilo(); assert.ok(document.getElementById('farm-dialog-content').textContent.includes('1 ready production(s)'));
        const collect = [...document.querySelectorAll('#farm-dialog-actions button')].find(button => button.textContent === 'COLLECT READY PRODUCTS');
        assert.strictEqual(collect.disabled, false); collect.click();
        await waitFor(() => ids.length === 1 && !center.operation, 'collecte sans réponse');
        center.setAccount(wallet.address); await center.refresh({ quiet: true });
        assert.strictEqual(center.state.inventory.eggs, beforeEggs + 1); assert.strictEqual(center.state.coins, beforeCoins);
        assert.strictEqual(center.state.animals[0].produceAt, 0);
        center.openSilo(); assert.strictEqual(document.querySelector('#farm-dialog-actions button').textContent, 'CHECK COLLECTION');
        document.querySelector('#farm-dialog-actions button').click();
        await waitFor(() => ids.length === 2 && !center.operation, 'reprise collecte');
        assert.strictEqual(ids[0], ids[1]); assert.deepStrictEqual(selections[0], selections[1]);
        assert.strictEqual(center.state.inventory.eggs, beforeEggs + 1);
        assert.strictEqual(window.localStorage.getItem(`fitia_farm_silo_pending_v1:${wallet.address.toLowerCase()}`), null);
      } finally { window.fetch = originalFetch; center.closeDialog(); }
    });

    await test('Français : actions, erreurs et textes financiers sans changer les montants', async () => {
      const document = window.document; const coins = center.state.coins;
      try {
        app.currentLang = 'fr'; center.render();
        assert.ok(document.querySelector('#farm-animal-list').textContent.includes('Poule'));
        center.openBuyAnimal();
        assert.strictEqual(document.getElementById('farm-dialog-title').textContent, 'Animaux');
        assert.ok(document.getElementById('farm-dialog-content').textContent.includes('ACHETER'));
        center.openBuyFeed(); assert.strictEqual(document.getElementById('farm-dialog-title').textContent, 'Nourriture pour animaux');
        assert.ok(document.querySelector('#farm-dialog-actions button').textContent.includes('ACHETER'));
        center.showError({ code: 'FARM_INSUFFICIENT_COINS' });
        assert.strictEqual(document.getElementById('farm-dialog-error').textContent, 'F-Coins insuffisants.');
        center.openDeposit(); assert.strictEqual(document.getElementById('farm-dialog-title').textContent, 'Convertir des FTA');
        assert.ok(document.querySelector('#farm-dialog-content').textContent.includes('Montant en FTA'));
        assert.strictEqual(document.querySelector('#farm-dialog-content input').value, '10');
        center.openSell(); assert.strictEqual(document.getElementById('farm-dialog-title').textContent, 'Vendre les produits');
        assert.strictEqual(center.state.coins, coins, 'La traduction ne modifie pas les fonds');
      } finally { center.closeDialog(); app.currentLang = 'en'; center.render(); }
    });

    await test('Résolution : annuler sans exécuter une vente et bloquer une requête tardive', async () => {
      const document = window.document; const record = repository.accounts.get(wallet.address.toLowerCase());
      record.state.inventory.wheat = 1; await center.refresh({ quiet: true });
      const before = center.state.coins; const originalFetch = window.fetch; let delayed;
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && body.type === 'sell_item') { delayed = { url, options }; throw new Error('lost before send'); }
        return originalFetch(url, options);
      };
      try {
        center.openSell(); const row = [...document.querySelectorAll('.farm-market-row')].find(x => x.textContent.includes('Wheat'));
        row.querySelector('button').click(); await waitFor(() => delayed && !center.operation, 'vente non envoyée');
        center.openSell();
        const cancel = [...document.querySelectorAll('#farm-dialog-actions button')].find(b => b.textContent === 'CANCEL IF NOT COMPLETED');
        assert.ok(cancel); cancel.click();
        await waitFor(() => !center.operation && !window.localStorage.getItem(`fitia_farm_market_pending_v1:${wallet.address.toLowerCase()}`), 'résolution');
        assert.strictEqual(center.state.inventory.wheat, 1); assert.strictEqual(center.state.coins, before);
        const late = await originalFetch(delayed.url, delayed.options); assert.strictEqual(late.status, 409);
        assert.strictEqual((await late.json()).code, 'FARM_CANCELLED');
        await center.refresh({ quiet: true }); assert.strictEqual(center.state.inventory.wheat, 1); assert.strictEqual(center.state.coins, before);
      } finally { window.fetch = originalFetch; center.closeDialog(); }
    });

    await test('Résolution : reconnaître une vente déjà effectuée sans la répéter', async () => {
      const document = window.document; const before = center.state.coins; const originalFetch = window.fetch; let lost = false;
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && body.type === 'sell_item' && !lost) {
          const response = await originalFetch(url, options); lost = true; throw new Error('lost after commit');
        }
        return originalFetch(url, options);
      };
      try {
        center.openSell(); const row = [...document.querySelectorAll('.farm-market-row')].find(x => x.textContent.includes('Wheat'));
        row.querySelector('button').click(); await waitFor(() => lost && !center.operation, 'vente avec réponse perdue');
        center.openSell(); [...document.querySelectorAll('#farm-dialog-actions button')].find(b => b.textContent === 'CANCEL IF NOT COMPLETED').click();
        await waitFor(() => !center.operation && !window.localStorage.getItem(`fitia_farm_market_pending_v1:${wallet.address.toLowerCase()}`), 'résolution vente effectuée');
        assert.strictEqual(center.state.coins, before + 12); assert.strictEqual(center.state.inventory.wheat, 0);
        assert.ok(toasts.some(t => String(t.message).includes('already completed')));
      } finally { window.fetch = originalFetch; center.closeDialog(); }
    });

    await test('Puits : arrosage, réponse perdue et reprise sans changement des gains', async () => {
      const document = window.document; const record = repository.accounts.get(wallet.address.toLowerCase());
      const cropId = crypto.randomUUID(); const readyAt = Date.now() + 1800000;
      record.state.crops.push({ id: cropId, species: 'maize', plot: 4, plantedAt: Date.now(), readyAt });
      await center.refresh({ quiet: true }); const beforeCoins = center.state.coins;
      const before = center.state.farmProgress.watered; const originalFetch = window.fetch; const ids = []; let lose = true;
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && body.type === 'water_crop') {
          ids.push(body.actionId); const response = await originalFetch(url, options);
          if (lose) { lose = false; throw new Error('Lost response after commit'); } return response;
        }
        return originalFetch(url, options);
      };
      try {
        sceneCalls.select({ kind: 'building', id: 'well' });
        const water = [...document.querySelectorAll('#farm-dialog-actions button')].find(button => button.textContent.includes('WATER MAIZE'));
        assert.ok(water); water.click(); await waitFor(() => ids.length === 1 && !center.operation, 'arrosage sans réponse');
        center.setAccount(wallet.address); await center.refresh({ quiet: true });
        assert.ok(center.state.crops.find(c => c.id === cropId).wateredAt);
        assert.strictEqual(center.state.crops.find(c => c.id === cropId).readyAt, readyAt);
        assert.strictEqual(center.state.coins, beforeCoins); assert.strictEqual(center.state.farmProgress.watered, before + 1);
        center.openWell(); assert.strictEqual(document.querySelector('#farm-dialog-actions button').textContent, 'CHECK WATERING');
        document.querySelector('#farm-dialog-actions button').click();
        await waitFor(() => ids.length === 2 && !center.operation, 'reprise arrosage');
        assert.strictEqual(ids[0], ids[1]); assert.strictEqual(center.state.farmProgress.watered, before + 1);
        assert.strictEqual(window.localStorage.getItem(`fitia_farm_water_pending_v1:${wallet.address.toLowerCase()}`), null);
        center.openEntity('crop', cropId); assert.ok(document.getElementById('farm-dialog-content').textContent.includes('Watered'));
      } finally { window.fetch = originalFetch; center.closeDialog(); }
    });

    await test('Soins : bâtiment, réponse perdue et reprise de la même action', async () => {
      const document = window.document; const record = repository.accounts.get(wallet.address.toLowerCase());
      record.state.animals[0].caredAt = 0; await center.refresh({ quiet: true });
      const before = center.state.farmProgress.cared; const coins = center.state.coins; const originalFetch = window.fetch; const ids = []; let lose = true;
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && body.type === 'care_animal') {
          ids.push(body.actionId); const response = await originalFetch(url, options);
          if (lose) { lose = false; throw new Error('Lost response after commit'); } return response;
        }
        return originalFetch(url, options);
      };
      try {
        sceneCalls.select({ kind: 'building', id: 'care' });
        const button = [...document.querySelectorAll('#farm-dialog-actions button')].find(el => el.textContent.includes('CARE FOR'));
        assert.ok(button); button.click(); await waitFor(() => ids.length === 1 && !center.operation, 'soin sans réponse');
        center.setAccount(wallet.address); await center.refresh({ quiet: true });
        assert.strictEqual(center.state.farmProgress.cared, before + 1); assert.strictEqual(center.state.coins, coins);
        center.openCare(); assert.strictEqual(document.querySelector('#farm-dialog-actions button').textContent, 'CHECK CARE');
        document.querySelector('#farm-dialog-actions button').click(); await waitFor(() => ids.length === 2 && !center.operation, 'reprise soin');
        assert.strictEqual(ids[0], ids[1]); assert.strictEqual(center.state.farmProgress.cared, before + 1);
        assert.strictEqual(window.localStorage.getItem(`fitia_farm_care_pending_v1:${wallet.address.toLowerCase()}`), null);
      } finally { window.fetch = originalFetch; center.closeDialog(); }
    });

    await test('Engrais et reproduction : réponse perdue, reprise signée et jeune animal', async () => {
      const document = window.document; const record = repository.accounts.get(wallet.address.toLowerCase());
      const a = crypto.randomUUID(), b = crypto.randomUUID(), cropId = crypto.randomUUID();
      record.state.coins = 3000; record.state.feed = 5;
      record.state.animals = [{ id: a, species: 'goat', produceAt: 0 }, { id: b, species: 'goat', produceAt: 0 }];
      const readyAt = Date.now() + 1800000; record.state.crops = [{ id: cropId, species: 'wheat', plot: 0, plantedAt: Date.now(), readyAt }];
      await center.refresh({ quiet: true }); const originalFetch = window.fetch; const requests = []; const lost = new Set();
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && ['breed_animal', 'fertilize_crop'].includes(body.type)) {
          requests.push(body); const response = await originalFetch(url, options);
          if (!lost.has(body.type)) { lost.add(body.type); throw new Error('Lost response after commit'); } return response;
        } return originalFetch(url, options);
      };
      try {
        app.currentLang = 'fr'; center.openFertilizer(); assert.ok(document.getElementById('farm-dialog-content').textContent.includes('4 F-Coins'));
        document.querySelector('#farm-dialog-actions button').click(); await waitFor(() => requests.length === 1 && !center.operation, 'engrais sans réponse');
        center.setAccount(wallet.address); await center.refresh({ quiet: true });
        assert.strictEqual(center.state.coins, 2996); assert.strictEqual(center.state.crops[0].readyAt, readyAt - 180000);
        center.openFertilizer(); document.querySelector('#farm-dialog-actions button').click();
        await waitFor(() => requests.length === 2 && !center.operation, 'reprise engrais'); assert.strictEqual(requests[0].actionId, requests[1].actionId);
        assert.strictEqual(center.state.coins, 2996); center.openBreeding();
        assert.ok(document.getElementById('farm-dialog-content').textContent.includes('prix de l’animal'));
        document.querySelector('#farm-dialog-actions button').click(); await waitFor(() => requests.length === 3 && !center.operation, 'reproduction sans réponse');
        center.setAccount(wallet.address); await center.refresh({ quiet: true });
        assert.strictEqual(center.state.animals.length, 3); assert.strictEqual(center.state.coins, 2366); assert.strictEqual(center.state.feed, 4);
        center.openBreeding(); document.querySelector('#farm-dialog-actions button').click(); await waitFor(() => requests.length === 4 && !center.operation, 'reprise reproduction');
        assert.strictEqual(requests[2].actionId, requests[3].actionId); assert.strictEqual(center.state.animals.length, 3);
        const young = center.state.animals.find(animal => animal.id === requests[2].actionId); assert.ok(young.maturesAt > Date.now());
        center.openEntity('animal', young.id); assert.ok(document.getElementById('farm-dialog-content').textContent.includes('En croissance'));
        assert.ok([...document.querySelectorAll('#farm-dialog-actions button')].find(el => el.textContent.includes('NOURRIR')).disabled);
        assert.strictEqual(window.localStorage.getItem(`fitia_farm_breed_pending_v1:${wallet.address.toLowerCase()}`), null);
        assert.strictEqual(window.localStorage.getItem(`fitia_farm_fertilize_pending_v1:${wallet.address.toLowerCase()}`), null);
      } finally { window.fetch = originalFetch; center.closeDialog(); app.currentLang = 'en'; }
    });

    await test('Engrais : résolution avant envoi et rejet de la requête tardive', async () => {
      const document = window.document; const record = repository.accounts.get(wallet.address.toLowerCase());
      record.state.crops = [{ id: crypto.randomUUID(), species: 'wheat', plot: 0, plantedAt: Date.now(), readyAt: Date.now() + 1800000 }];
      await center.refresh({ quiet: true }); const before = center.state.coins; const originalFetch = window.fetch; let delayed;
      window.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'action' && body.type === 'fertilize_crop') { delayed = { url, options }; throw new Error('lost before send'); }
        return originalFetch(url, options);
      };
      try {
        center.openFertilizer(); document.querySelector('#farm-dialog-actions button').click();
        await waitFor(() => delayed && !center.operation, 'engrais non envoyé'); center.openFertilizer();
        const cancel = [...document.querySelectorAll('#farm-dialog-actions button')].find(b => b.textContent === 'CANCEL IF NOT COMPLETED');
        assert.ok(cancel); cancel.click();
        await waitFor(() => !center.operation && !window.localStorage.getItem(`fitia_farm_fertilize_pending_v1:${wallet.address.toLowerCase()}`), 'résolution engrais');
        const late = await originalFetch(delayed.url, delayed.options); assert.strictEqual(late.status, 409); assert.strictEqual((await late.json()).code, 'FARM_CANCELLED');
        await center.refresh({ quiet: true }); assert.strictEqual(center.state.coins, before); assert.strictEqual(center.state.crops[0].fertilizedAt, 0);
      } finally { window.fetch = originalFetch; center.closeDialog(); }
    });

    await test('Récompenses de niveau : affichage FR/EN sans modifier les soldes', async () => {
      const original = center.state.farmProgress; const coins = center.state.coins;
      try {
        center.state.farmProgress = { planted: 0 }; app.currentLang = 'fr'; center.renderProgress();
        assert.ok(window.document.getElementById('farm-unlocks').textContent.includes('Jardin fleuri · Niveau 2'));
        center.state.farmProgress = { planted: 20 }; center.renderProgress();
        assert.ok(window.document.getElementById('farm-unlocks').textContent.includes('Lanternes · Débloqué'));
        app.currentLang = 'en'; center.renderProgress();
        assert.ok(window.document.getElementById('farm-unlocks').textContent.includes('Flower garden · Unlocked'));
        assert.strictEqual(center.state.coins, coins);
      } finally { center.state.farmProgress = original; center.renderProgress(); }
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
