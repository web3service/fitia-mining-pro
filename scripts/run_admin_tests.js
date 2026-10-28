#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAdminServer } = require('../admin-server');

const ROOT = path.resolve(__dirname, '..');
const PASSWORD = 'test-admin-password-123';
const INITIAL_ANNOUNCEMENT_COUNT = JSON.parse(fs.readFileSync(path.join(ROOT, 'announcements.json'), 'utf8')).announcements.length;
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

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function request(base, pathname, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.csrf) headers['X-CSRF-Token'] = options.csrf;
  if (options.origin) headers.Origin = options.origin;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  return { response, data, text };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

(async () => {
  console.log('\n🛡️  TESTS DU PANNEAU D’ADMINISTRATION FITIA PRO\n' + '═'.repeat(68));
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitia-admin-tests-'));
  const dataFile = path.join(temporaryDirectory, 'announcements.json');
  const promotionsFile = path.join(temporaryDirectory, 'promotions.json');
  const assetDirectory = path.join(temporaryDirectory, 'assets', 'announcements');
  const storeDataFile = path.join(temporaryDirectory, 'store-products.json');
  const storeAssetDirectory = path.join(temporaryDirectory, 'assets', 'store');
  fs.copyFileSync(path.join(ROOT, 'announcements.json'), dataFile);
  fs.copyFileSync(path.join(ROOT, 'promotions.json'), promotionsFile);
  fs.copyFileSync(path.join(ROOT, 'store-products.json'), storeDataFile);
  const localServer = createAdminServer({ password: PASSWORD, localMode: true, dataFile, promotionsFile, assetDirectory, storeDataFile, storeAssetDirectory });
  const localPort = await listen(localServer);
  const localBase = `http://127.0.0.1:${localPort}`;
  let githubServer = null;
  let cookie = '';
  let csrf = '';
  let manifest = null;
  let revision = '';
  let staleRevision = '';
  let uploadedAssetPath = '';

  try {
    await runTest('Interface séparée, en-têtes CSP et fichiers du projet non exposés', async () => {
      const page = await request(localBase, '/');
      assert.strictEqual(page.response.status, 200);
      assert.ok(page.text.includes('FITIA PRO'));
      assert.ok(page.text.includes('id="announcement-form"'));
      assert.ok(page.text.includes('id="promotion-form"'));
      assert.ok(page.text.includes('id="store-product-form"'));
      assert.ok(page.response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
      assert.ok(page.response.headers.get('content-security-policy').includes("script-src 'self'"));
      assert.strictEqual(page.response.headers.get('x-frame-options'), 'DENY');
      const ordersScript = await request(localBase, '/admin/orders-admin.js');
      assert.strictEqual(ordersScript.response.status, 200);
      assert.ok(ordersScript.text.includes('FitiaOrdersAdmin'));
      for (const asset of ['/promotion-effects.js', '/promotion-effects.css']) {
        const result = await request(localBase, asset);
        assert.strictEqual(result.response.status, 200, asset);
        assert.ok(result.text.includes('promotion-effect'), asset);
      }
      for (const avatar of ['/assets/avatars/team-1.svg', '/assets/avatars/team-2.svg', '/assets/avatars/team-3.svg']) {
        const result = await request(localBase, avatar);
        assert.strictEqual(result.response.status, 200, avatar);
        assert.ok(result.text.includes('<svg'), avatar);
        assert.ok(result.response.headers.get('content-type').includes('image/svg+xml'));
      }
      for (const forbidden of ['/admin-server.js', '/app.js', '/announcements.json', '/promotions.json', '/store-products.json', '/.git/HEAD']) {
        const result = await request(localBase, forbidden);
        assert.strictEqual(result.response.status, 404, forbidden);
      }
      const post = await request(localBase, '/', { method: 'POST', body: {} });
      assert.strictEqual(post.response.status, 405);
    });

    await runTest('Lecture et mutations protégées par une session administrateur', async () => {
      const session = await request(localBase, '/api/admin/session');
      assert.strictEqual(session.response.status, 401);
      const list = await request(localBase, '/api/admin/announcements');
      assert.strictEqual(list.response.status, 401);
      const update = await request(localBase, '/api/admin/announcements', { method: 'PUT', body: {} });
      assert.strictEqual(update.response.status, 401);
      const promotions = await request(localBase, '/api/admin/promotions', { cookie });
      assert.strictEqual(promotions.response.status, 401);
      const updatePromotions = await request(localBase, '/api/admin/promotions', { method: 'PUT', body: {} });
      assert.strictEqual(updatePromotions.response.status, 401);
      const upload = await request(localBase, '/api/admin/announcement-assets', { method: 'POST', body: {} });
      assert.strictEqual(upload.response.status, 401);
      const orders = await request(localBase, '/api/admin/store-orders');
      assert.strictEqual(orders.response.status, 401);
    });

    await runTest('Connexion par mot de passe, cookie HttpOnly et jeton CSRF temporaire', async () => {
      const wrong = await request(localBase, '/api/admin/login', { method: 'POST', body: { password: 'incorrect-password' } });
      assert.strictEqual(wrong.response.status, 401);
      const login = await request(localBase, '/api/admin/login', { method: 'POST', body: { password: PASSWORD } });
      assert.strictEqual(login.response.status, 200);
      assert.strictEqual(login.data.authenticated, true);
      assert.strictEqual(login.data.mode, 'local');
      assert.match(login.data.csrfToken, /^[0-9a-f]{64}$/);
      const setCookie = login.response.headers.get('set-cookie');
      assert.ok(setCookie.includes('HttpOnly'));
      assert.ok(setCookie.includes('SameSite=Strict'));
      assert.ok(!setCookie.includes(PASSWORD));
      cookie = setCookie.split(';')[0];
      csrf = login.data.csrfToken;
      const session = await request(localBase, '/api/admin/session', { cookie });
      assert.strictEqual(session.response.status, 200);
      assert.strictEqual(session.data.csrfToken, csrf);
    });

    await runTest('Chargement du manifeste sans exposer de secret ni d’identifiant', async () => {
      const result = await request(localBase, '/api/admin/announcements', { cookie });
      assert.strictEqual(result.response.status, 200);
      const published = JSON.parse(fs.readFileSync(path.join(ROOT, 'announcements.json'), 'utf8'));
      assert.strictEqual(result.data.manifest.enabled, published.enabled);
      assert.strictEqual(result.data.manifest.announcements.length, INITIAL_ANNOUNCEMENT_COUNT);
      assert.ok(result.data.revision);
      assert.ok(!result.text.includes(PASSWORD));
      assert.ok(!result.text.includes('FITIA_GITHUB_TOKEN'));
      manifest = result.data.manifest;
      revision = result.data.revision;
      staleRevision = revision;
    });

    await runTest('Refus des mutations sans CSRF ou depuis une origine externe', async () => {
      const withoutCsrf = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, body: { manifest, revision }
      });
      assert.strictEqual(withoutCsrf.response.status, 403);
      const wrongOrigin = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, origin: 'https://example.com', body: { manifest, revision }
      });
      assert.strictEqual(wrongOrigin.response.status, 403);
      assert.strictEqual(fs.readFileSync(dataFile, 'utf8'), fs.readFileSync(path.join(ROOT, 'announcements.json'), 'utf8'));
    });

    await runTest('Import sécurisé des images : CSRF, signature binaire, MIME, stockage et servi statique', async () => {
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      const payload = { data: pngBase64, contentType: 'image/png' };
      const withoutCsrf = await request(localBase, '/api/admin/announcement-assets', { method: 'POST', cookie, body: payload });
      assert.strictEqual(withoutCsrf.response.status, 403);
      const wrongOrigin = await request(localBase, '/api/admin/announcement-assets', {
        method: 'POST', cookie, csrf, origin: 'https://example.com', body: payload
      });
      assert.strictEqual(wrongOrigin.response.status, 403);
      const invalidBase64 = await request(localBase, '/api/admin/announcement-assets', {
        method: 'POST', cookie, csrf, body: { data: 'not-base64!' }
      });
      assert.strictEqual(invalidBase64.response.status, 400);
      const disguisedSvg = await request(localBase, '/api/admin/announcement-assets', {
        method: 'POST', cookie, csrf,
        body: { data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64'), contentType: 'image/png' }
      });
      assert.strictEqual(disguisedSvg.response.status, 415);
      const wrongMime = await request(localBase, '/api/admin/announcement-assets', {
        method: 'POST', cookie, csrf, body: { ...payload, contentType: 'image/jpeg' }
      });
      assert.strictEqual(wrongMime.response.status, 415);

      const uploaded = await request(localBase, '/api/admin/announcement-assets', { method: 'POST', cookie, csrf, body: payload });
      assert.strictEqual(uploaded.response.status, 201, uploaded.text);
      assert.match(uploaded.data.asset.path, /^assets\/announcements\/announcement-[a-f0-9]{24}\.png$/);
      assert.strictEqual(uploaded.data.asset.contentType, 'image/png');
      assert.strictEqual(uploaded.data.asset.size, Buffer.from(pngBase64, 'base64').length);
      uploadedAssetPath = uploaded.data.asset.path;
      const storedFile = path.join(assetDirectory, path.basename(uploadedAssetPath));
      assert.ok(fs.existsSync(storedFile));
      assert.ok(fs.readFileSync(storedFile).equals(Buffer.from(pngBase64, 'base64')));
      const served = await request(localBase, `/${uploadedAssetPath}`);
      assert.strictEqual(served.response.status, 200);
      assert.ok(served.response.headers.get('content-type').includes('image/png'));
      const repeated = await request(localBase, '/api/admin/announcement-assets', { method: 'POST', cookie, csrf, body: payload });
      assert.strictEqual(repeated.response.status, 201);
      assert.strictEqual(repeated.data.asset.path, uploadedAssetPath);
      assert.strictEqual(fs.readdirSync(assetDirectory).length, 1, 'Le nom haché rend les imports identiques idempotents');
    });

    await runTest('Création d’un événement multilingue programmé et enregistrement atomique', async () => {
      const next = clone(manifest);
      next.announcements.push({
        id: 'event-admin-test',
        category: 'event',
        enabled: false,
        title: { fr: 'Événement de test', en: 'Test event' },
        message: { fr: 'Message de test', en: 'Test message' },
        theme: 'aurora',
        font: 'rounded',
        backgroundImage: uploadedAssetPath,
        avatars: ['assets/avatars/team-1.svg', uploadedAssetPath],
        startsAt: '2030-01-01T00:00:00.000Z',
        expiresAt: '2030-12-31T23:59:59.000Z'
      });
      const result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: next, revision }
      });
      assert.strictEqual(result.response.status, 200, result.text);
      assert.strictEqual(result.data.manifest.announcements.length, INITIAL_ANNOUNCEMENT_COUNT + 1);
      assert.strictEqual(result.data.manifest.announcements[INITIAL_ANNOUNCEMENT_COUNT].startsAt, '2030-01-01T00:00:00.000Z');
      const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      assert.strictEqual(saved.announcements[INITIAL_ANNOUNCEMENT_COUNT].title.en, 'Test event');
      assert.strictEqual(saved.announcements[INITIAL_ANNOUNCEMENT_COUNT].theme, 'aurora');
      assert.strictEqual(saved.announcements[INITIAL_ANNOUNCEMENT_COUNT].font, 'rounded');
      assert.strictEqual(saved.announcements[INITIAL_ANNOUNCEMENT_COUNT].backgroundImage, uploadedAssetPath);
      assert.deepStrictEqual(saved.announcements[INITIAL_ANNOUNCEMENT_COUNT].avatars, ['assets/avatars/team-1.svg', uploadedAssetPath]);
      assert.strictEqual(saved.announcements[INITIAL_ANNOUNCEMENT_COUNT].enabled, false);
      assert.ok(!fs.readdirSync(temporaryDirectory).some((name) => name.includes('.tmp-')));
      const reactivation = clone(result.data.manifest);
      reactivation.announcements[INITIAL_ANNOUNCEMENT_COUNT].enabled = true;
      const reactivated = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: reactivation, revision: result.data.revision }
      });
      assert.strictEqual(reactivated.response.status, 200, reactivated.text);
      assert.strictEqual(reactivated.data.manifest.announcements[INITIAL_ANNOUNCEMENT_COUNT].enabled, true);
      assert.strictEqual(reactivated.data.manifest.announcements[INITIAL_ANNOUNCEMENT_COUNT].backgroundImage, uploadedAssetPath);
      assert.deepStrictEqual(reactivated.data.manifest.announcements[INITIAL_ANNOUNCEMENT_COUNT].avatars, ['assets/avatars/team-1.svg', uploadedAssetPath]);
      manifest = reactivated.data.manifest;
      revision = reactivated.data.revision;
    });

    await runTest('Validation des catégories, dates, doublons et limite de 12 annonces actives', async () => {
      const invalidCategory = clone(manifest);
      invalidCategory.announcements[0].category = 'unknown';
      let result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidCategory, revision }
      });
      assert.strictEqual(result.response.status, 400);

      const invalidDates = clone(manifest);
      invalidDates.announcements[INITIAL_ANNOUNCEMENT_COUNT].startsAt = '2030-02-01T00:00:00.000Z';
      invalidDates.announcements[INITIAL_ANNOUNCEMENT_COUNT].expiresAt = '2030-01-01T00:00:00.000Z';
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidDates, revision }
      });
      assert.strictEqual(result.response.status, 400);

      const duplicate = clone(manifest);
      duplicate.announcements[INITIAL_ANNOUNCEMENT_COUNT].id = duplicate.announcements[0].id;
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: duplicate, revision }
      });
      assert.strictEqual(result.response.status, 400);

      const invalidAppearance = clone(manifest);
      invalidAppearance.announcements[0].theme = 'unknown-theme';
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidAppearance, revision }
      });
      assert.strictEqual(result.response.status, 400);
      invalidAppearance.announcements[0].theme = 'classic';
      invalidAppearance.announcements[0].backgroundImage = '../secret.png';
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidAppearance, revision }
      });
      assert.strictEqual(result.response.status, 400);
      invalidAppearance.announcements[0].backgroundImage = '';
      invalidAppearance.announcements[0].avatars = ['assets/avatars/team-1.svg', 'assets/avatars/team-1.svg'];
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidAppearance, revision }
      });
      assert.strictEqual(result.response.status, 400);

      const tooMany = { enabled: true, announcements: Array.from({ length: 13 }, (_, index) => ({
        id: `event-${index}`, category: 'event', title: { fr: `Titre ${index}` }, message: { fr: 'Message' }
      })) };
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: tooMany, revision }
      });
      assert.strictEqual(result.response.status, 400);
      const invalidEnabled = clone(manifest);
      invalidEnabled.announcements[0].enabled = 'yes';
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidEnabled, revision }
      });
      assert.strictEqual(result.response.status, 400);
      const disabledMany = { enabled: true, announcements: Array.from({ length: 13 }, (_, index) => ({
        id: `disabled-${index}`, category: 'event', enabled: false, title: { fr: `Titre ${index}` }, message: { fr: 'Message' }
      })) };
      const disabledResult = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: disabledMany, revision }
      });
      assert.strictEqual(disabledResult.response.status, 200, 'Les annonces désactivées ne comptent pas parmi les 12 actives');
      const restored = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest, revision: disabledResult.data.revision }
      });
      assert.strictEqual(restored.response.status, 200, restored.text);
      manifest = restored.data.manifest;
      revision = restored.data.revision;
    });

    await runTest('Effets saisonniers : CSRF, variantes, animation, ciblage, traductions, dates et doublons validés', async () => {
      const loaded = await request(localBase, '/api/admin/promotions', { cookie });
      assert.strictEqual(loaded.response.status, 200, loaded.text);
      assert.strictEqual(typeof loaded.data.manifest.enabled, 'boolean');
      assert.ok(Array.isArray(loaded.data.manifest.promotions));
      const initialRevision = loaded.data.revision;
      const next = clone(loaded.data.manifest);
      next.hiddenShopItems = { machine: [3, 1], battery: [0] };
      next.promotions = [{
        id: 'gift-admin-test',
        targetType: 'machine',
        targetId: 0,
        variant: 'gift',
        label: { fr: 'JOYEUX <b>NOËL</b>', en: 'MERRY CHRISTMAS' },
        startsAt: '2030-12-01T00:00:00.000Z',
        expiresAt: '2030-12-31T23:59:59.000Z'
      }];
      const withoutCsrf = await request(localBase, '/api/admin/promotions', {
        method: 'PUT', cookie, body: { manifest: next, revision: initialRevision }
      });
      assert.strictEqual(withoutCsrf.response.status, 403);
      const saved = await request(localBase, '/api/admin/promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: next, revision: initialRevision }
      });
      assert.strictEqual(saved.response.status, 200, saved.text);
      assert.strictEqual(saved.data.manifest.promotions[0].targetId, 0);
      assert.strictEqual(saved.data.manifest.promotions[0].animated, true);
      assert.strictEqual(saved.data.manifest.promotions[0].label.fr, 'JOYEUX <b>NOËL</b>');
      assert.deepStrictEqual(saved.data.manifest.hiddenShopItems, { machine: [1, 3], battery: [0] });
      const onDisk = JSON.parse(fs.readFileSync(promotionsFile, 'utf8'));
      assert.strictEqual(onDisk.promotions[0].id, 'gift-admin-test');
      assert.strictEqual(onDisk.promotions[0].startsAt, '2030-12-01T00:00:00.000Z');

      const duplicate = clone(saved.data.manifest);
      duplicate.promotions.push({ ...duplicate.promotions[0], id: 'gift-duplicate' });
      let result = await request(localBase, '/api/admin/promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: duplicate, revision: saved.data.revision }
      });
      assert.strictEqual(result.response.status, 400);

      const invalidTarget = clone(saved.data.manifest);
      invalidTarget.promotions[0].targetId = 100;
      result = await request(localBase, '/api/admin/promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidTarget, revision: saved.data.revision }
      });
      assert.strictEqual(result.response.status, 400);
      invalidTarget.promotions[0].targetId = null;
      result = await request(localBase, '/api/admin/promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidTarget, revision: saved.data.revision }
      });
      assert.strictEqual(result.response.status, 400);

      const invalidDates = clone(saved.data.manifest);
      invalidDates.promotions[0].expiresAt = '2030-11-01T00:00:00.000Z';
      result = await request(localBase, '/api/admin/promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidDates, revision: saved.data.revision }
      });
      assert.strictEqual(result.response.status, 400);

      const invalidAnimation = clone(saved.data.manifest);
      invalidAnimation.promotions[0].animated = 'yes';
      result = await request(localBase, '/api/admin/promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidAnimation, revision: saved.data.revision }
      });
      assert.strictEqual(result.response.status, 400);

      const invalidVisibility = clone(saved.data.manifest);
      invalidVisibility.hiddenShopItems.machine = [100];
      result = await request(localBase, '/api/admin/promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidVisibility, revision: saved.data.revision }
      });
      assert.strictEqual(result.response.status, 400);

      const variants = ['gift', 'bells', 'snow', 'confetti', 'fireworks', 'hearts', 'blossom', 'halloween', 'badge'];
      const seasonal = clone(saved.data.manifest);
      seasonal.promotions = variants.map((variant, index) => ({
        ...saved.data.manifest.promotions[0], id: `${variant}-admin-test`, targetId: index, variant, animated: index % 2 === 0
      }));
      const seasonalSaved = await request(localBase, '/api/admin/promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: seasonal, revision: saved.data.revision }
      });
      assert.strictEqual(seasonalSaved.response.status, 200, seasonalSaved.text);
      assert.deepStrictEqual(seasonalSaved.data.manifest.promotions.map((item) => item.variant), variants);
      assert.strictEqual(seasonalSaved.data.manifest.promotions[1].animated, false);

      const stale = await request(localBase, '/api/admin/promotions', {
        method: 'PUT', cookie, csrf, body: { manifest: saved.data.manifest, revision: initialRevision }
      });
      assert.strictEqual(stale.response.status, 409);
      assert.strictEqual(stale.data.code, 'CONFLICT');
    });

    await runTest('FITIA STORE local : CRUD, image produit et confidentialité du fichier catalogue', async () => {
      const loaded = await request(localBase, '/api/admin/store-products', { cookie });
      assert.strictEqual(loaded.response.status, 200, loaded.text);
      const next = loaded.data.manifest;
      next.enabled = true;
      next.products.push({
        id: 'product-local-test', active: true, sourceType: 'own', category: 'home',
        name: { fr: 'Produit local', en: 'Local product' }, description: {}, image: '',
        sellerId: 'seller-local', sellerName: 'Local seller', sellerContact: '',
        paymentAddress: '0x1111111111111111111111111111111111111111', priceToken: 'FTA', price: '4.25', shippingFee: '0',
        stock: 3, deliveryEstimate: '5 jours', customerAddress: 'NEVER_SAVE_THIS'
      });
      const rejected = await request(localBase, '/api/admin/store-products', {
        method: 'PUT', cookie, body: { manifest: next, revision: loaded.data.revision }
      });
      assert.strictEqual(rejected.response.status, 403);
      const saved = await request(localBase, '/api/admin/store-products', {
        method: 'PUT', cookie, csrf, body: { manifest: next, revision: loaded.data.revision }
      });
      assert.strictEqual(saved.response.status, 200, saved.text);
      assert.strictEqual(saved.data.manifest.products[0].priceToken, 'FTA');
      assert.strictEqual(saved.data.manifest.products[0].customerAddress, undefined);
      const onDisk = fs.readFileSync(storeDataFile, 'utf8');
      assert.ok(onDisk.includes('product-local-test'));
      assert.ok(!onDisk.includes('NEVER_SAVE_THIS'));
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      const uploaded = await request(localBase, '/api/admin/store-assets', {
        method: 'POST', cookie, csrf, body: { data: pngBase64, contentType: 'image/png' }
      });
      assert.strictEqual(uploaded.response.status, 201, uploaded.text);
      assert.match(uploaded.data.asset.path, /^assets\/store\/product-[a-f0-9]{24}\.png$/);
      const served = await request(localBase, `/${uploaded.data.asset.path}`);
      assert.strictEqual(served.response.status, 200);
      assert.strictEqual(served.response.headers.get('content-type'), 'image/png');
      const script = await request(localBase, '/admin/store-admin.js');
      assert.strictEqual(script.response.status, 200);
      assert.ok(script.text.includes('createStoreAdmin'));
    });

    await runTest('Une révision obsolète ne peut pas écraser une modification concurrente', async () => {
      const result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest, revision: staleRevision }
      });
      assert.strictEqual(result.response.status, 409);
      assert.strictEqual(result.data.code, 'CONFLICT');
    });

    await runTest('Réorganisation, désactivation du canal et suppression conservent le manifeste', async () => {
      let next = clone(manifest);
      const [eventItem] = next.announcements.splice(INITIAL_ANNOUNCEMENT_COUNT, 1);
      next.announcements.unshift(eventItem);
      let result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: next, revision }
      });
      assert.strictEqual(result.response.status, 200);
      assert.strictEqual(result.data.manifest.announcements[0].id, 'event-admin-test');
      manifest = result.data.manifest;
      revision = result.data.revision;

      next = clone(manifest);
      next.enabled = false;
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: next, revision }
      });
      assert.strictEqual(result.response.status, 200);
      assert.strictEqual(result.data.manifest.enabled, false);
      manifest = result.data.manifest;
      revision = result.data.revision;

      next = clone(manifest);
      next.announcements = next.announcements.filter((item) => item.id !== 'event-admin-test');
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: next, revision }
      });
      assert.strictEqual(result.response.status, 200);
      assert.strictEqual(result.data.manifest.announcements.length, INITIAL_ANNOUNCEMENT_COUNT);
      assert.strictEqual(result.data.manifest.enabled, false);
      manifest = result.data.manifest;
      revision = result.data.revision;
    });

    await runTest('Le rendu dynamique utilise textContent et aucun secret n’est stocké dans le navigateur', async () => {
      const script = fs.readFileSync(path.join(ROOT, 'admin/admin.js'), 'utf8');
      const html = fs.readFileSync(path.join(ROOT, 'admin/index.html'), 'utf8');
      assert.ok(!script.includes('.innerHTML'));
      assert.ok(!script.includes('localStorage'));
      assert.ok(!script.includes('sessionStorage'));
      assert.ok(script.includes('textContent'));
      assert.ok(!html.includes('onerror='));
      assert.ok(!html.includes('onclick='));
    });

    await runTest('Déconnexion, invalidation de session et limitation des tentatives', async () => {
      const logout = await request(localBase, '/api/admin/logout', { method: 'POST', cookie, csrf, body: {} });
      assert.strictEqual(logout.response.status, 200);
      const session = await request(localBase, '/api/admin/session', { cookie });
      assert.strictEqual(session.response.status, 401);
      for (let index = 0; index < 5; index += 1) {
        const wrong = await request(localBase, '/api/admin/login', { method: 'POST', body: { password: `wrong-${index}` } });
        assert.strictEqual(wrong.response.status, 401);
      }
      const limited = await request(localBase, '/api/admin/login', { method: 'POST', body: { password: PASSWORD } });
      assert.strictEqual(limited.response.status, 429);
      assert.ok(limited.response.headers.get('retry-after'));
    });

    await runTest('Publication GitHub des annonces, décorations et visuels avec secrets strictement serveur', async () => {
      let githubManifest = { enabled: true, announcements: [] };
      let githubRevision = 'sha-initial';
      let writes = 0;
      let assetWrites = 0;
      const githubAssets = new Map();
      let githubPromotionManifest = { enabled: true, promotions: [] };
      let githubPromotionRevision = 'sha-promotion-initial';
      let promotionWrites = 0;
      const mockFetch = async (url, init = {}) => {
        const isPromotion = String(url).includes('/contents/promotions.json');
        assert.strictEqual(init.headers.Authorization, 'Bearer test-token-not-real');
        const assetMatch = String(url).match(/\/contents\/(assets\/announcements\/announcement-[a-f0-9]{24}\.(?:png|jpg|webp))/);
        if (assetMatch) {
          const assetPath = assetMatch[1];
          if ((init.method || 'GET') === 'PUT') {
            const body = JSON.parse(init.body);
            assert.strictEqual(body.message, 'Add FITIA announcement asset');
            assert.strictEqual(body.branch, 'main');
            githubAssets.set(assetPath, Buffer.from(body.content, 'base64'));
            assetWrites += 1;
            return new Response(JSON.stringify({ content: { sha: `sha-asset-${assetWrites}` } }), { status: 201, headers: { 'Content-Type': 'application/json' } });
          }
          if (!githubAssets.has(assetPath)) return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          return new Response(JSON.stringify({ sha: 'sha-asset-existing', encoding: 'base64', content: githubAssets.get(assetPath).toString('base64') }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        assert.ok(String(url).includes(`/repos/web3service/fitia-mining-pro/contents/${isPromotion ? 'promotions.json' : 'announcements.json'}`));
        if ((init.method || 'GET') === 'PUT') {
          const body = JSON.parse(init.body);
          assert.strictEqual(body.sha, isPromotion ? githubPromotionRevision : githubRevision);
          assert.strictEqual(body.branch, 'main');
          assert.strictEqual(body.message, isPromotion ? 'Update FITIA promotions' : 'Update FITIA announcements');
          const published = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
          let nextRevision;
          if (isPromotion) {
            githubPromotionManifest = published;
            promotionWrites += 1;
            githubPromotionRevision = `sha-promotion-write-${promotionWrites}`;
            nextRevision = githubPromotionRevision;
          } else {
            githubManifest = published;
            writes += 1;
            githubRevision = `sha-write-${writes}`;
            nextRevision = githubRevision;
          }
          return new Response(JSON.stringify({ content: { sha: nextRevision } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({
          sha: isPromotion ? githubPromotionRevision : githubRevision,
          encoding: 'base64',
          content: Buffer.from(JSON.stringify(isPromotion ? githubPromotionManifest : githubManifest)).toString('base64')
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      githubServer = createAdminServer({
        password: PASSWORD,
        localMode: false,
        githubToken: 'test-token-not-real',
        fetch: mockFetch
      });
      const port = await listen(githubServer);
      const base = `http://127.0.0.1:${port}`;
      const login = await request(base, '/api/admin/login', { method: 'POST', body: { password: PASSWORD } });
      assert.strictEqual(login.response.status, 200);
      assert.strictEqual(login.data.mode, 'github');
      const ghCookie = login.response.headers.get('set-cookie').split(';')[0];
      const ghCsrf = login.data.csrfToken;
      const loaded = await request(base, '/api/admin/announcements', { cookie: ghCookie });
      assert.strictEqual(loaded.response.status, 200);
      assert.strictEqual(loaded.data.revision, 'sha-initial');
      assert.ok(!loaded.text.includes('test-token-not-real'));
      const next = clone(loaded.data.manifest);
      next.announcements.push({
        id: 'event-github-test', category: 'event', title: { fr: 'Test GitHub' }, message: { fr: 'Publication simulée' }
      });
      const saved = await request(base, '/api/admin/announcements', {
        method: 'PUT', cookie: ghCookie, csrf: ghCsrf, body: { manifest: next, revision: loaded.data.revision }
      });
      assert.strictEqual(saved.response.status, 200, saved.text);
      assert.strictEqual(saved.data.revision, 'sha-write-1');
      assert.strictEqual(githubManifest.announcements[0].id, 'event-github-test');
      assert.strictEqual(writes, 1);
      assert.ok(!saved.text.includes('test-token-not-real'));

      const loadedPromotions = await request(base, '/api/admin/promotions', { cookie: ghCookie });
      assert.strictEqual(loadedPromotions.response.status, 200, loadedPromotions.text);
      assert.strictEqual(loadedPromotions.data.revision, 'sha-promotion-initial');
      const nextPromotions = loadedPromotions.data.manifest;
      nextPromotions.promotions.push({
        id: 'badge-github-test', targetType: 'battery', targetId: 1, variant: 'badge', label: { fr: 'OFFRE DE NOËL' }
      });
      const savedPromotions = await request(base, '/api/admin/promotions', {
        method: 'PUT', cookie: ghCookie, csrf: ghCsrf,
        body: { manifest: nextPromotions, revision: loadedPromotions.data.revision }
      });
      assert.strictEqual(savedPromotions.response.status, 200, savedPromotions.text);
      assert.strictEqual(savedPromotions.data.revision, 'sha-promotion-write-1');
      assert.strictEqual(githubPromotionManifest.promotions[0].id, 'badge-github-test');
      assert.strictEqual(promotionWrites, 1);
      assert.ok(!savedPromotions.text.includes('test-token-not-real'));

      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      const uploaded = await request(base, '/api/admin/announcement-assets', {
        method: 'POST', cookie: ghCookie, csrf: ghCsrf,
        body: { data: pngBase64, contentType: 'image/png' }
      });
      assert.strictEqual(uploaded.response.status, 201, uploaded.text);
      assert.strictEqual(assetWrites, 1);
      assert.ok(githubAssets.get(uploaded.data.asset.path).equals(Buffer.from(pngBase64, 'base64')));
      assert.ok(!uploaded.text.includes('test-token-not-real'));
      const repeated = await request(base, '/api/admin/announcement-assets', {
        method: 'POST', cookie: ghCookie, csrf: ghCsrf,
        body: { data: pngBase64, contentType: 'image/png' }
      });
      assert.strictEqual(repeated.response.status, 201);
      assert.strictEqual(assetWrites, 1);
    });
  } finally {
    await close(localServer);
    if (githubServer) await close(githubServer);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  console.log('═'.repeat(68));
  console.log(`📊 RÉSULTAT ADMIN : ${passed} réussis, ${failed} échoués`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
