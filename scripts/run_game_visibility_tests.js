#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(fs.existsSync('/tmp/test-deps/node_modules/jsdom') ? '/tmp/test-deps/node_modules/jsdom' : 'jsdom');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'android-src/wallet.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const dom = new JSDOM(html, { url: 'https://app.fitia.pro/wallet.html', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
for (const file of ['game-visibility-config.js', 'game-visibility.js']) {
  window.eval(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}
const config = window.FitiaGameVisibilityConfig;
const gameIds = Array.from(config.GAME_IDS);
const normalize = (raw) => JSON.parse(JSON.stringify(config.normalizeManifest(raw)));
const center = new window.FitiaGameVisibilityCenter({});
center.init();
let passed = 0;
let failed = 0;

async function test(name, run) {
  try {
    await run();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`);
  }
}

function resetCenter(hiddenGames = []) {
  center.hiddenGames = new Set(hiddenGames);
  center.lastFetchAt = 0;
  center.fetchInFlight = false;
  center.apply();
}

function visibleGameCards() {
  return Array.from(window.document.querySelectorAll('#view-hub [data-game-id]:not(.hidden)'), (card) => card.dataset.gameId);
}

(async () => {
  console.log('\n🎛️  TESTS DE VISIBILITÉ DES JEUX\n' + '═'.repeat(68));
  try {
    await test('Manifeste public : cinq jeux connus, tous visibles par défaut et ordre canonique', async () => {
      const published = JSON.parse(fs.readFileSync(path.join(ROOT, 'game-visibility.json'), 'utf8'));
      assert.deepStrictEqual(normalize(published), { hiddenGames: [] });
      assert.deepStrictEqual(gameIds, ['wheel', 'dice', 'mines', 'crash', 'coin-flip']);
      assert.deepStrictEqual(normalize({ hiddenGames: ['crash', 'wheel'] }), { hiddenGames: ['wheel', 'crash'] });
      for (const invalid of [null, [], {}, { hiddenGames: null }, { hiddenGames: ['unknown'] }, { hiddenGames: ['wheel', 'wheel'] }, { hiddenGames: [1] }, { hiddenGames: ['wheel', 'dice', 'mines', 'crash', 'coin-flip', 'wheel'] }]) {
        assert.strictEqual(config.normalizeManifest(invalid), null);
      }
    });

    await test('Hub : sept cartes et cinq navigations conservées, seuls les cinq jeux sont configurables', async () => {
      assert.strictEqual(window.document.querySelectorAll('#view-hub .hub-card').length, 7);
      assert.strictEqual(window.document.querySelectorAll('#view-hub [data-game-id]').length, 5);
      assert.strictEqual(window.document.querySelectorAll('.bottom-nav .nav-item').length, 5);
      assert.strictEqual(window.document.querySelector('#view-hub .hub-card-farm').dataset.gameId, undefined);
      assert.strictEqual(window.document.querySelector('#view-hub .hub-card-swap').dataset.gameId, undefined);
      for (const game of config.GAMES) {
        const card = window.document.querySelector(`#view-hub [data-game-id="${game.id}"]`);
        assert.ok(card, game.id);
        assert.ok(card.querySelector(`img[src="${game.logo}"]`), game.logo);
      }
    });

    await test('Masquage visuel indépendant : FARM, Swap, vues et autres jeux restent intacts', async () => {
      resetCenter(['dice', 'crash']);
      assert.deepStrictEqual(visibleGameCards(), ['wheel', 'mines', 'coin-flip']);
      for (const id of ['dice', 'crash']) {
        const card = window.document.querySelector(`[data-game-id="${id}"]`);
        assert.ok(card.classList.contains('hidden'));
        assert.strictEqual(card.getAttribute('aria-hidden'), 'true');
        assert.strictEqual(window.document.getElementById(`view-${id}`).classList.contains('hidden'), false);
      }
      assert.strictEqual(window.document.querySelector('#view-hub .hub-card-farm').classList.contains('hidden'), false);
      assert.strictEqual(window.document.querySelector('#view-hub .hub-card-swap').classList.contains('hidden'), false);
      resetCenter(['coin-flip']);
      assert.deepStrictEqual(visibleGameCards(), ['wheel', 'dice', 'mines', 'crash']);
      resetCenter();
      assert.deepStrictEqual(visibleGameCards(), gameIds);
    });

    await test('Synchronisation : le manifeste valide masque puis réaffiche les cartes sans toucher aux services', async () => {
      resetCenter();
      const requests = [];
      window.fetch = async (url, options) => {
        requests.push({ url, options });
        return { ok: true, json: async () => ({ hiddenGames: ['mines', 'coin-flip'] }) };
      };
      await center.refresh({ force: true });
      assert.strictEqual(requests.length, 1);
      assert.strictEqual(requests[0].url, 'https://raw.githubusercontent.com/web3service/fitia-mining-pro/main/game-visibility.json');
      assert.strictEqual(requests[0].options.cache, 'no-store');
      assert.deepStrictEqual(visibleGameCards(), ['wheel', 'dice', 'crash']);
      window.fetch = async () => ({ ok: true, json: async () => ({ hiddenGames: [] }) });
      await center.refresh({ force: true });
      assert.deepStrictEqual(visibleGameCards(), gameIds);
      assert.strictEqual(window.document.querySelectorAll('.bottom-nav .nav-item').length, 5);
    });

    await test('Repli sûr : configuration invalide ou réseau indisponible, aucune carte n’est masquée au premier lancement', async () => {
      resetCenter();
      window.fetch = async () => ({ ok: true, json: async () => ({ hiddenGames: ['unknown'] }) });
      await center.refresh({ force: true });
      assert.deepStrictEqual(visibleGameCards(), gameIds);
      assert.strictEqual(center.lastFetchAt, 0);
      window.fetch = async () => { throw new Error('offline'); };
      await center.refresh({ force: true });
      assert.deepStrictEqual(visibleGameCards(), gameIds);

      resetCenter(['wheel']);
      window.fetch = async () => ({ ok: false, json: async () => ({}) });
      await center.refresh({ force: true });
      assert.deepStrictEqual(visibleGameCards(), ['dice', 'mines', 'crash', 'coin-flip'], 'La dernière configuration valide est conservée après une panne');
      resetCenter();
    });

    await test('Actualisation limitée à une requête toutes les 30 secondes sauf forçage explicite', async () => {
      resetCenter();
      let requests = 0;
      window.fetch = async () => {
        requests += 1;
        return { ok: true, json: async () => ({ hiddenGames: [] }) };
      };
      await center.refresh({ force: true });
      await center.refresh();
      assert.strictEqual(requests, 1);
      await center.refresh({ force: true });
      assert.strictEqual(requests, 2);
    });
  } finally {
    window.close();
  }
  console.log('═'.repeat(68));
  console.log(`🎛️  RÉSULTAT VISIBILITÉ : ${passed} réussis, ${failed} échoués`);
  if (failed) process.exit(1);
})().catch((error) => {
  console.error(error);
  window.close();
  process.exit(1);
});
