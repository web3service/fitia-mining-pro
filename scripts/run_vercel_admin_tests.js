#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const adminHandler = require('../api/admin');

const ROOT = path.resolve(__dirname, '..');
const PASSWORD = 'vercel-test-password-123';
const TOKEN = 'vercel-test-token-not-real';
const originalFetch = global.fetch;
let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ❌ ${name}\n     ↳ ${error.stack || error.message}`);
  }
}

function createHarness() {
  return http.createServer((req, res) => {
    const parts = new URL(req.url || '/', 'http://localhost').pathname.split('/').filter(Boolean);
    if (parts[0] === 'api' && parts[1] === 'admin' && parts[2]) {
      req.query = { action: parts[2] };
      return adminHandler(req, res);
    }
    res.writeHead(404);
    res.end();
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function request(base, action, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.csrf) headers['X-CSRF-Token'] = options.csrf;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await originalFetch(`${base}/api/admin/${action}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
  return { response, data, text };
}

(async () => {
  console.log('\n☁️  TESTS VERCEL DU PANNEAU D’ADMINISTRATION\n' + '═'.repeat(68));
  const serverA = createHarness();
  const serverB = createHarness();
  const baseA = await listen(serverA);
  const baseB = await listen(serverB);
  let cookie = '';
  let csrf = '';
  let githubManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'announcements.json'), 'utf8'));
  const initialAnnouncementCount = githubManifest.announcements.length;
  let githubRevision = 'sha-vercel-initial';
  let githubWrites = 0;
  let githubAssetWrites = 0;
  let uploadedAssetPath = '';
  const githubAssets = new Map();
  let githubPromotionManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'promotions.json'), 'utf8'));
  let githubPromotionRevision = 'sha-vercel-promotion-initial';
  let githubPromotionWrites = 0;
  let githubGameManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'game-visibility.json'), 'utf8'));
  let githubGameRevision = 'sha-vercel-games-initial';
  let githubGameWrites = 0;
  let githubStoreManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'store-products.json'), 'utf8'));
  let githubStoreRevision = 'sha-vercel-store-initial';
  let githubStoreWrites = 0;

  global.fetch = async (url, init = {}) => {
    const target = String(url);
    if (!target.startsWith('https://api.github.com/')) return originalFetch(url, init);
    const isPromotion = target.includes('/contents/promotions.json');
    const isGame = target.includes('/contents/game-visibility.json');
    const isStore = target.includes('/contents/store-products.json');
    assert.strictEqual(init.headers.Authorization, `Bearer ${TOKEN}`);
    const assetMatch = target.match(/\/contents\/(assets\/(?:announcements\/announcement|store\/product)-[a-f0-9]{24}\.(?:png|jpg|webp))/);
    if (assetMatch) {
      const assetPath = assetMatch[1];
      if ((init.method || 'GET') === 'PUT') {
        const body = JSON.parse(init.body);
        assert.strictEqual(body.branch, 'main');
        assert.strictEqual(body.message, assetPath.startsWith('assets/store/') ? 'Add FITIA STORE product image' : 'Add FITIA announcement asset');
        assert.strictEqual(body.sha, undefined);
        githubAssets.set(assetPath, Buffer.from(body.content, 'base64'));
        githubAssetWrites += 1;
        return new Response(JSON.stringify({ content: { sha: `sha-asset-${githubAssetWrites}` } }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (!githubAssets.has(assetPath)) return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({
        sha: 'sha-asset-existing', encoding: 'base64', content: githubAssets.get(assetPath).toString('base64')
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if ((init.method || 'GET') === 'PUT') {
      const body = JSON.parse(init.body);
      const expectedRevision = isStore ? githubStoreRevision : isGame ? githubGameRevision : isPromotion ? githubPromotionRevision : githubRevision;
      const expectedMessage = isStore ? 'Update FITIA STORE catalog' : isGame ? 'Update FITIA game visibility' : isPromotion ? 'Update FITIA promotions' : 'Update FITIA announcements';
      assert.strictEqual(body.sha, expectedRevision);
      assert.strictEqual(body.branch, 'main');
      assert.strictEqual(body.message, expectedMessage);
      const published = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
      let nextRevision;
      if (isStore) {
        githubStoreManifest = published;
        githubStoreWrites += 1;
        githubStoreRevision = `sha-vercel-store-write-${githubStoreWrites}`;
        nextRevision = githubStoreRevision;
      } else if (isGame) {
        githubGameManifest = published;
        githubGameWrites += 1;
        githubGameRevision = `sha-vercel-games-write-${githubGameWrites}`;
        nextRevision = githubGameRevision;
      } else if (isPromotion) {
        githubPromotionManifest = published;
        githubPromotionWrites += 1;
        githubPromotionRevision = `sha-vercel-promotion-write-${githubPromotionWrites}`;
        nextRevision = githubPromotionRevision;
      } else {
        githubManifest = published;
        githubWrites += 1;
        githubRevision = `sha-vercel-write-${githubWrites}`;
        nextRevision = githubRevision;
      }
      return new Response(JSON.stringify({ content: { sha: nextRevision } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const manifest = isStore ? githubStoreManifest : isGame ? githubGameManifest : isPromotion ? githubPromotionManifest : githubManifest;
    const revision = isStore ? githubStoreRevision : isGame ? githubGameRevision : isPromotion ? githubPromotionRevision : githubRevision;
    return new Response(JSON.stringify({
      sha: revision, encoding: 'base64', content: Buffer.from(JSON.stringify(manifest)).toString('base64')
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await runTest('Vercel sert /admin et réécrit les onze routes API serverless', async () => {
      const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
      const rewrites = new Map(config.rewrites.map((item) => [item.source, item.destination]));
      assert.strictEqual(rewrites.get('/admin'), '/admin/index.html');
      assert.strictEqual(rewrites.get('/admin/'), '/admin/index.html');
      for (const action of ['login', 'session', 'logout', 'announcements', 'announcement-assets', 'promotions', 'game-visibility', 'store-products', 'store-assets', 'store-orders', 'farm-withdrawals']) {
        assert.strictEqual(rewrites.get(`/api/admin/${action}`), `/api/admin?action=${action}`);
      }
      const html = fs.readFileSync(path.join(ROOT, 'admin/index.html'), 'utf8');
      assert.ok(html.includes('href="/admin/admin.css"'));
      assert.ok(html.includes('src="/admin/admin.js"'));
      const ignore = fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8');
      assert.ok(!ignore.split('\n').includes('admin/'));
      assert.ok(ignore.split('\n').includes('admin-server.js'));
      assert.ok(ignore.split('\n').includes('/farm.js'));
      assert.ok(ignore.split('\n').includes('/farm-3d.js'));
      assert.ok(!ignore.split('\n').includes('farm.js'), 'L’API api/farm.js ne doit pas être exclue');
      assert.ok(!ignore.split('\n').includes('farm-3d.js'));
      assert.ok(ignore.split('\n').includes('vendor/*'));
      assert.ok(ignore.split('\n').includes('!vendor/ethers.umd.min.js'));
      assert.ok(fs.existsSync(path.join(ROOT, 'api/store-orders.js')));
      assert.ok(fs.existsSync(path.join(ROOT, 'store-order-service.js')));
      assert.ok(fs.existsSync(path.join(ROOT, 'api/farm.js')));
      assert.ok(fs.existsSync(path.join(ROOT, 'farm-service.js')));
    });

    await runTest('Une configuration Vercel absente est signalée sans exposer de secret', async () => {
      delete process.env.FITIA_ADMIN_PASSWORD;
      delete process.env.FITIA_GITHUB_TOKEN;
      const result = await request(baseA, 'login', { method: 'POST', body: { password: 'anything' } });
      assert.strictEqual(result.response.status, 503);
      assert.strictEqual(result.data.code, 'ADMIN_CONFIG');
      assert.ok(!result.text.includes(TOKEN));
      process.env.FITIA_ADMIN_PASSWORD = PASSWORD;
      process.env.FITIA_GITHUB_TOKEN = TOKEN;
    });

    await runTest('La session signée et le cookie Secure fonctionnent entre deux instances', async () => {
      const login = await request(baseA, 'login', { method: 'POST', body: { password: PASSWORD } });
      assert.strictEqual(login.response.status, 200, login.text);
      const setCookie = login.response.headers.get('set-cookie');
      assert.ok(setCookie.includes('HttpOnly'));
      assert.ok(setCookie.includes('Secure'));
      assert.ok(setCookie.includes('SameSite=Strict'));
      cookie = setCookie.split(';')[0];
      csrf = login.data.csrfToken;
      const session = await request(baseB, 'session', { cookie });
      assert.strictEqual(session.response.status, 200);
      assert.strictEqual(session.data.csrfToken, csrf);
      assert.strictEqual(session.data.mode, 'github');
    });

    await runTest('Les visuels serverless exigent CSRF et sont publiés comme actifs GitHub validés', async () => {
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      const payload = { data: pngBase64, contentType: 'image/png' };
      const rejected = await request(baseB, 'announcement-assets', { method: 'POST', cookie, body: payload });
      assert.strictEqual(rejected.response.status, 403);
      const invalid = await request(baseB, 'announcement-assets', {
        method: 'POST', cookie, csrf,
        body: { data: Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64'), contentType: 'image/png' }
      });
      assert.strictEqual(invalid.response.status, 415);
      assert.strictEqual(githubAssetWrites, 0);
      const uploaded = await request(baseB, 'announcement-assets', { method: 'POST', cookie, csrf, body: payload });
      assert.strictEqual(uploaded.response.status, 201, uploaded.text);
      assert.match(uploaded.data.asset.path, /^assets\/announcements\/announcement-[a-f0-9]{24}\.png$/);
      assert.strictEqual(githubAssetWrites, 1);
      uploadedAssetPath = uploaded.data.asset.path;
      assert.ok(githubAssets.get(uploadedAssetPath).equals(Buffer.from(pngBase64, 'base64')));
      assert.ok(!uploaded.text.includes(TOKEN));
      const repeated = await request(baseB, 'announcement-assets', { method: 'POST', cookie, csrf, body: payload });
      assert.strictEqual(repeated.response.status, 201);
      assert.strictEqual(repeated.data.asset.path, uploadedAssetPath);
      assert.strictEqual(githubAssetWrites, 1, 'Un actif déjà présent ne doit pas être republié');
    });

    await runTest('La fonction serverless publie avec CSRF, SHA et token uniquement côté serveur', async () => {
      const loaded = await request(baseB, 'announcements', { cookie });
      assert.strictEqual(loaded.response.status, 200, loaded.text);
      assert.strictEqual(loaded.data.manifest.announcements.length, initialAnnouncementCount);
      assert.strictEqual(loaded.data.revision, 'sha-vercel-initial');
      assert.ok(!loaded.text.includes(TOKEN));

      const next = loaded.data.manifest;
      next.announcements.push({
        id: 'event-vercel-test', category: 'event', enabled: false, title: { fr: 'Test Vercel' }, message: { fr: 'Publication serverless' },
        theme: 'gold', font: 'elegant', backgroundImage: uploadedAssetPath, avatars: ['assets/avatars/team-2.svg']
      });
      const rejected = await request(baseB, 'announcements', {
        method: 'PUT', cookie, body: { manifest: next, revision: loaded.data.revision }
      });
      assert.strictEqual(rejected.response.status, 403);
      const saved = await request(baseB, 'announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: next, revision: loaded.data.revision }
      });
      assert.strictEqual(saved.response.status, 200, saved.text);
      assert.strictEqual(saved.data.revision, 'sha-vercel-write-1');
      assert.strictEqual(githubManifest.announcements[initialAnnouncementCount].id, 'event-vercel-test');
      assert.strictEqual(githubManifest.announcements[initialAnnouncementCount].enabled, false);
      assert.strictEqual(githubManifest.announcements[initialAnnouncementCount].theme, 'gold');
      assert.strictEqual(githubManifest.announcements[initialAnnouncementCount].font, 'elegant');
      assert.strictEqual(githubManifest.announcements[initialAnnouncementCount].backgroundImage, uploadedAssetPath);
      assert.deepStrictEqual(githubManifest.announcements[initialAnnouncementCount].avatars, ['assets/avatars/team-2.svg']);
      assert.strictEqual(githubWrites, 1);
      assert.ok(!saved.text.includes(TOKEN));
    });

    await runTest('La fonction serverless publie les décorations dans leur propre fichier avec CSRF et validation', async () => {
      const loaded = await request(baseB, 'promotions', { cookie });
      assert.strictEqual(loaded.response.status, 200, loaded.text);
      assert.ok(Array.isArray(loaded.data.manifest.promotions));
      assert.strictEqual(loaded.data.revision, 'sha-vercel-promotion-initial');
      const next = loaded.data.manifest;
      next.hiddenShopItems = { machine: [2], battery: [1] };
      next.promotions = [{
        id: 'gift-vercel-test', targetType: 'machine', targetId: 2, variant: 'gift', animated: false,
        label: { fr: 'JOYEUX NOËL', en: 'MERRY CHRISTMAS' }
      }];
      const rejected = await request(baseB, 'promotions', {
        method: 'PUT', cookie, body: { manifest: next, revision: loaded.data.revision }
      });
      assert.strictEqual(rejected.response.status, 403);
      const saved = await request(baseB, 'promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: next, revision: loaded.data.revision }
      });
      assert.strictEqual(saved.response.status, 200, saved.text);
      assert.strictEqual(saved.data.revision, 'sha-vercel-promotion-write-1');
      assert.strictEqual(saved.data.manifest.promotions[0].targetId, 2);
      assert.strictEqual(saved.data.manifest.promotions[0].animated, false);
      assert.deepStrictEqual(saved.data.manifest.hiddenShopItems, { machine: [2], battery: [1] });
      assert.deepStrictEqual(githubPromotionManifest.hiddenShopItems, { machine: [2], battery: [1] });
      assert.strictEqual(githubPromotionManifest.promotions[0].id, 'gift-vercel-test');
      assert.strictEqual(githubPromotionWrites, 1);
      assert.strictEqual(githubWrites, 1);
      assert.ok(!saved.text.includes(TOKEN));

      const invalid = saved.data.manifest;
      invalid.promotions[0].targetId = -1;
      const invalidResult = await request(baseB, 'promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: invalid, revision: saved.data.revision }
      });
      assert.strictEqual(invalidResult.response.status, 400);
      invalid.promotions[0].targetId = 2;
      invalid.promotions[0].animated = 'yes';
      const invalidAnimation = await request(baseB, 'promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: invalid, revision: saved.data.revision }
      });
      assert.strictEqual(invalidAnimation.response.status, 400);
      invalid.promotions[0].animated = false;
      invalid.hiddenShopItems.machine = [100];
      const invalidVisibility = await request(baseB, 'promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: invalid, revision: saved.data.revision }
      });
      assert.strictEqual(invalidVisibility.response.status, 400);
      assert.strictEqual(githubPromotionWrites, 1);
    });

    await runTest('La fonction serverless publie la visibilité des jeux avec CSRF, validation et secret côté serveur', async () => {
      const loaded = await request(baseB, 'game-visibility', { cookie });
      assert.strictEqual(loaded.response.status, 200, loaded.text);
      assert.deepStrictEqual(loaded.data.manifest, { hiddenGames: [] });
      assert.strictEqual(loaded.data.revision, 'sha-vercel-games-initial');
      const next = { hiddenGames: ['crash', 'wheel'] };
      const rejected = await request(baseB, 'game-visibility', {
        method: 'PUT', cookie, body: { manifest: next, revision: loaded.data.revision }
      });
      assert.strictEqual(rejected.response.status, 403);
      const saved = await request(baseB, 'game-visibility', {
        method: 'PUT', cookie, csrf, body: { manifest: next, revision: loaded.data.revision }
      });
      assert.strictEqual(saved.response.status, 200, saved.text);
      assert.strictEqual(saved.data.revision, 'sha-vercel-games-write-1');
      assert.deepStrictEqual(saved.data.manifest.hiddenGames, ['wheel', 'crash']);
      assert.deepStrictEqual(githubGameManifest.hiddenGames, ['wheel', 'crash']);
      assert.strictEqual(githubGameWrites, 1);
      assert.ok(!saved.text.includes(TOKEN));

      for (const hiddenGames of [['unknown'], ['wheel', 'wheel'], ['wheel', 'dice', 'mines', 'crash', 'coin-flip', 'wheel']]) {
        const invalid = await request(baseB, 'game-visibility', {
          method: 'PUT', cookie, csrf, body: { manifest: { hiddenGames }, revision: saved.data.revision }
        });
        assert.strictEqual(invalid.response.status, 400);
        assert.strictEqual(invalid.data.code, 'VALIDATION');
      }
      assert.strictEqual(githubGameWrites, 1);
    });

    await runTest('FITIA STORE publie catalogue et photos avec CSRF sans donnée client ni secret', async () => {
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      const uploaded = await request(baseB, 'store-assets', { method: 'POST', cookie, csrf, body: { data: pngBase64, contentType: 'image/png' } });
      assert.strictEqual(uploaded.response.status, 201, uploaded.text);
      assert.match(uploaded.data.asset.path, /^assets\/store\/product-[a-f0-9]{24}\.png$/);
      const loaded = await request(baseB, 'store-products', { cookie });
      assert.strictEqual(loaded.response.status, 200, loaded.text);
      const next = loaded.data.manifest;
      next.enabled = true;
      next.products = [{
        id: 'product-vercel-test', active: true, sourceType: 'dropshipping', category: 'electronics',
        name: { en: 'Test phone', fr: 'Téléphone test' }, description: { en: 'Physical product' },
        image: uploaded.data.asset.path, sellerId: 'seller-test', sellerName: 'FITIA Seller', sellerContact: '@fitia-seller',
        paymentAddress: '0x1111111111111111111111111111111111111111', priceToken: 'USDT', price: '19.99', shippingFee: '1.01',
        stock: 7, deliveryEstimate: '3-7 business days', customerAddress: 'NEVER_PERSIST_THIS'
      }];
      const rejected = await request(baseB, 'store-products', { method: 'PUT', cookie, body: { manifest: next, revision: loaded.data.revision } });
      assert.strictEqual(rejected.response.status, 403);
      const saved = await request(baseB, 'store-products', { method: 'PUT', cookie, csrf, body: { manifest: next, revision: loaded.data.revision } });
      assert.strictEqual(saved.response.status, 200, saved.text);
      assert.strictEqual(saved.data.revision, 'sha-vercel-store-write-1');
      assert.strictEqual(saved.data.manifest.products[0].sourceType, 'dropshipping');
      assert.strictEqual(saved.data.manifest.products[0].image, uploaded.data.asset.path);
      assert.strictEqual(saved.data.manifest.products[0].customerAddress, undefined);
      assert.ok(!saved.text.includes('NEVER_PERSIST_THIS'));
      assert.ok(!saved.text.includes(TOKEN));
      assert.strictEqual(githubStoreWrites, 1);
      const invalid = saved.data.manifest;
      invalid.products[0].paymentAddress = '0x0000000000000000000000000000000000000000';
      const invalidResult = await request(baseB, 'store-products', { method: 'PUT', cookie, csrf, body: { manifest: invalid, revision: saved.data.revision } });
      assert.strictEqual(invalidResult.response.status, 400);
      assert.strictEqual(githubStoreWrites, 1);
    });

    await runTest('Un cookie falsifié est rejeté et la déconnexion efface le cookie', async () => {
      const tampered = `${cookie.slice(0, -1)}${cookie.endsWith('a') ? 'b' : 'a'}`;
      const rejected = await request(baseA, 'session', { cookie: tampered });
      assert.strictEqual(rejected.response.status, 401);
      const logout = await request(baseA, 'logout', { method: 'POST', cookie, csrf, body: {} });
      assert.strictEqual(logout.response.status, 200);
      assert.ok(logout.response.headers.get('set-cookie').includes('Max-Age=0'));
    });
  } finally {
    global.fetch = originalFetch;
    delete process.env.FITIA_ADMIN_PASSWORD;
    delete process.env.FITIA_GITHUB_TOKEN;
    await close(serverA);
    await close(serverB);
  }

  console.log('═'.repeat(68));
  console.log(`📊 RÉSULTAT VERCEL : ${passed} réussis, ${failed} échoués`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
