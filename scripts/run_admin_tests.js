#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAdminServer } = require('../admin-server');

const ROOT = path.resolve(__dirname, '..');
const PASSWORD = 'test-admin-password-123';
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
  fs.copyFileSync(path.join(ROOT, 'announcements.json'), dataFile);
  const localServer = createAdminServer({ password: PASSWORD, localMode: true, dataFile });
  const localPort = await listen(localServer);
  const localBase = `http://127.0.0.1:${localPort}`;
  let githubServer = null;
  let cookie = '';
  let csrf = '';
  let manifest = null;
  let revision = '';
  let staleRevision = '';

  try {
    await runTest('Interface séparée, en-têtes CSP et fichiers du projet non exposés', async () => {
      const page = await request(localBase, '/');
      assert.strictEqual(page.response.status, 200);
      assert.ok(page.text.includes('FITIA PRO'));
      assert.ok(page.text.includes('id="announcement-form"'));
      assert.ok(page.response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
      assert.ok(page.response.headers.get('content-security-policy').includes("script-src 'self'"));
      assert.strictEqual(page.response.headers.get('x-frame-options'), 'DENY');
      for (const forbidden of ['/admin-server.js', '/app.js', '/announcements.json', '/.git/HEAD']) {
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
      assert.strictEqual(result.data.manifest.enabled, true);
      assert.strictEqual(result.data.manifest.announcements.length, 4);
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

    await runTest('Création d’un événement multilingue programmé et enregistrement atomique', async () => {
      const next = clone(manifest);
      next.announcements.push({
        id: 'event-admin-test',
        category: 'event',
        title: { fr: 'Événement de test', en: 'Test event' },
        message: { fr: 'Message de test', en: 'Test message' },
        startsAt: '2030-01-01T00:00:00.000Z',
        expiresAt: '2030-12-31T23:59:59.000Z'
      });
      const result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: next, revision }
      });
      assert.strictEqual(result.response.status, 200, result.text);
      assert.strictEqual(result.data.manifest.announcements.length, 5);
      assert.strictEqual(result.data.manifest.announcements[4].startsAt, '2030-01-01T00:00:00.000Z');
      const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      assert.strictEqual(saved.announcements[4].title.en, 'Test event');
      assert.ok(!fs.readdirSync(temporaryDirectory).some((name) => name.includes('.tmp-')));
      manifest = result.data.manifest;
      revision = result.data.revision;
    });

    await runTest('Validation des catégories, dates, doublons et limite de 12 annonces actives', async () => {
      const invalidCategory = clone(manifest);
      invalidCategory.announcements[0].category = 'unknown';
      let result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidCategory, revision }
      });
      assert.strictEqual(result.response.status, 400);

      const invalidDates = clone(manifest);
      invalidDates.announcements[4].startsAt = '2030-02-01T00:00:00.000Z';
      invalidDates.announcements[4].expiresAt = '2030-01-01T00:00:00.000Z';
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: invalidDates, revision }
      });
      assert.strictEqual(result.response.status, 400);

      const duplicate = clone(manifest);
      duplicate.announcements[4].id = duplicate.announcements[0].id;
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: duplicate, revision }
      });
      assert.strictEqual(result.response.status, 400);

      const tooMany = { enabled: true, announcements: Array.from({ length: 13 }, (_, index) => ({
        id: `event-${index}`, category: 'event', title: { fr: `Titre ${index}` }, message: { fr: 'Message' }
      })) };
      result = await request(localBase, '/api/admin/announcements', {
        method: 'PUT', cookie, csrf, body: { manifest: tooMany, revision }
      });
      assert.strictEqual(result.response.status, 400);
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
      const [eventItem] = next.announcements.splice(4, 1);
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
      assert.strictEqual(result.data.manifest.announcements.length, 4);
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

    await runTest('Publication GitHub avec SHA, branche, contenu Base64 et token strictement serveur', async () => {
      let githubManifest = { enabled: true, announcements: [] };
      let githubRevision = 'sha-initial';
      let writes = 0;
      const mockFetch = async (url, init = {}) => {
        assert.ok(url.includes('/repos/web3service/fitia-mining-pro/contents/announcements.json'));
        assert.strictEqual(init.headers.Authorization, 'Bearer test-token-not-real');
        if ((init.method || 'GET') === 'PUT') {
          const body = JSON.parse(init.body);
          assert.strictEqual(body.sha, githubRevision);
          assert.strictEqual(body.branch, 'main');
          assert.strictEqual(body.message, 'Update FITIA announcements');
          githubManifest = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
          writes += 1;
          githubRevision = `sha-write-${writes}`;
          return new Response(JSON.stringify({ content: { sha: githubRevision } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({
          sha: githubRevision,
          encoding: 'base64',
          content: Buffer.from(JSON.stringify(githubManifest)).toString('base64')
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
