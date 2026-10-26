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
  let githubPromotionManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'promotions.json'), 'utf8'));
  let githubPromotionRevision = 'sha-vercel-promotion-initial';
  let githubPromotionWrites = 0;

  global.fetch = async (url, init = {}) => {
    const target = String(url);
    if (!target.startsWith('https://api.github.com/')) return originalFetch(url, init);
    const isPromotion = target.includes('/contents/promotions.json');
    assert.strictEqual(init.headers.Authorization, `Bearer ${TOKEN}`);
    if ((init.method || 'GET') === 'PUT') {
      const body = JSON.parse(init.body);
      assert.strictEqual(body.sha, isPromotion ? githubPromotionRevision : githubRevision);
      assert.strictEqual(body.branch, 'main');
      assert.strictEqual(body.message, isPromotion ? 'Update FITIA promotions' : 'Update FITIA announcements');
      const published = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
      let nextRevision;
      if (isPromotion) {
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
    return new Response(JSON.stringify({
      sha: isPromotion ? githubPromotionRevision : githubRevision,
      encoding: 'base64',
      content: Buffer.from(JSON.stringify(isPromotion ? githubPromotionManifest : githubManifest)).toString('base64')
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await runTest('Vercel sert /admin et réécrit les cinq routes API serverless', async () => {
      const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
      const rewrites = new Map(config.rewrites.map((item) => [item.source, item.destination]));
      assert.strictEqual(rewrites.get('/admin'), '/admin/index.html');
      assert.strictEqual(rewrites.get('/admin/'), '/admin/index.html');
      for (const action of ['login', 'session', 'logout', 'announcements', 'promotions']) {
        assert.strictEqual(rewrites.get(`/api/admin/${action}`), `/api/admin?action=${action}`);
      }
      const html = fs.readFileSync(path.join(ROOT, 'admin/index.html'), 'utf8');
      assert.ok(html.includes('href="/admin/admin.css"'));
      assert.ok(html.includes('src="/admin/admin.js"'));
      const ignore = fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8');
      assert.ok(!ignore.split('\n').includes('admin/'));
      assert.ok(ignore.split('\n').includes('admin-server.js'));
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

    await runTest('La fonction serverless publie avec CSRF, SHA et token uniquement côté serveur', async () => {
      const loaded = await request(baseB, 'announcements', { cookie });
      assert.strictEqual(loaded.response.status, 200, loaded.text);
      assert.strictEqual(loaded.data.manifest.announcements.length, initialAnnouncementCount);
      assert.strictEqual(loaded.data.revision, 'sha-vercel-initial');
      assert.ok(!loaded.text.includes(TOKEN));

      const next = loaded.data.manifest;
      next.announcements.push({
        id: 'event-vercel-test', category: 'event', title: { fr: 'Test Vercel' }, message: { fr: 'Publication serverless' }
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
      assert.strictEqual(githubWrites, 1);
      assert.ok(!saved.text.includes(TOKEN));
    });

    await runTest('La fonction serverless publie les décorations dans leur propre fichier avec CSRF et validation', async () => {
      const loaded = await request(baseB, 'promotions', { cookie });
      assert.strictEqual(loaded.response.status, 200, loaded.text);
      assert.ok(Array.isArray(loaded.data.manifest.promotions));
      assert.strictEqual(loaded.data.revision, 'sha-vercel-promotion-initial');
      const next = loaded.data.manifest;
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
      assert.strictEqual(githubPromotionWrites, 1);
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
