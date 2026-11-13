#!/usr/bin/env node
// Tests du durcissement 3.7.13 (items 4, 5, 7, 8) :
// SIWE EIP-4361, Play Integrity, Push FCM, ingest d'erreurs, rotation HMAC.
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const HmacTokens = require('../lib/hmac-tokens');
const GoogleOAuth = require('../lib/google-oauth');
const SiweMessage = require('../siwe-message');
const SiweServiceModule = require('../siwe-service');
const IntegrityModule = require('../integrity-service');
const PushModule = require('../push-service');
const ErrorsModule = require('../errors-service');

const ethers = require(path.join(ROOT, 'vendor', 'ethers.umd.min.js'));

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ❌ ${name}\n     ↳ ${(error && error.stack) || error}`);
  }
}

const SECRET_A = 'a'.repeat(32);
const SECRET_B = 'b'.repeat(32);
const SECRET_C = 'c'.repeat(32);

// ── Helpers ─────────────────────────────────────────────────────────
function mockResponse(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text)
  };
}

function jsonHandlerRequest(action, body, headers = {}) {
  return {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, headers),
    body: body || {},
    query: { action },
    socket: { remoteAddress: '127.0.0.1' }
  };
}

function captureResponse() {
  const result = { statusCode: 0, headers: {}, body: '' };
  result.setHeader = (key, value) => { result.headers[String(key).toLowerCase()] = value; };
  result.writeHead = (status) => { result.statusCode = status; };
  result.end = (data) => { result.body = String(data || ''); };
  result.json = () => { try { return JSON.parse(result.body); } catch (_) { return null; } };
  return result;
}

(async () => {
  console.log('═'.repeat(72));
  console.log('🛡️  TESTS DURCISSEMENT (items 4, 5, 7, 8)');
  console.log('═'.repeat(72));

  // ── HMAC tokens + rotation ─────────────────────────────────────────
  await runTest('HMAC : sign/verify roundtrip', () => {
    const secrets = HmacTokens.parseSecrets(`kidA:${SECRET_A},kidB:${SECRET_B}`);
    const token = HmacTokens.sign({ typ: 'test', n: 42 }, secrets, { ttlMs: 60_000 });
    const verified = HmacTokens.verify(token, secrets);
    assert.strictEqual(verified.typ, 'test');
    assert.strictEqual(verified.n, 42);
    assert.strictEqual(verified.kid, 'kidA');
  });

  await runTest('HMAC : rotation — un secret de secours vérifie un jeton du secret actif', () => {
    const secrets = HmacTokens.parseSecrets(`kidA:${SECRET_A},kidB:${SECRET_B}`);
    const token = HmacTokens.sign({ typ: 'test' }, secrets, { ttlMs: 60_000 });
    // Après rotation : kidB promu en actif, kidA conservé en vérification.
    const rotated = HmacTokens.parseSecrets(`kidB:${SECRET_B},kidA:${SECRET_A}`);
    const verified = HmacTokens.verify(token, rotated);
    assert.strictEqual(verified.kid, 'kidA');
  });

  await runTest('HMAC : kid retiré de la liste → jetons rejetés (unknown kid)', () => {
    const secrets = HmacTokens.parseSecrets(`kidA:${SECRET_A}`);
    const token = HmacTokens.sign({ typ: 'test' }, secrets, { ttlMs: 60_000 });
    const rotated = HmacTokens.parseSecrets(`kidB:${SECRET_B}`);
    assert.throws(() => HmacTokens.verify(token, rotated), /Clé de signature inconnue/);
  });

  await runTest('HMAC : secret trop court refusé par parseSecrets', () => {
    const secrets = HmacTokens.parseSecrets('short,autre:petit');
    assert.strictEqual(secrets.length, 0);
  });

  await runTest('HMAC : jeton expiré rejeté', () => {
    const secrets = HmacTokens.parseSecrets(SECRET_A);
    const now = Date.now() - 10_000;
    const token = HmacTokens.sign({ typ: 'test' }, secrets, { ttlMs: 5_000, now });
    assert.throws(() => HmacTokens.verify(token, secrets), /expiré/);
  });

  await runTest('HMAC : payload altéré → signature invalide', () => {
    const secrets = HmacTokens.parseSecrets(SECRET_A);
    const token = HmacTokens.sign({ typ: 'test' }, secrets, { ttlMs: 60_000 });
    const [b64, mac] = token.split('.');
    const forged = HmacTokens.b64urlEncode(JSON.stringify({ typ: 'admin', kid: 'x' }));
    assert.throws(() => HmacTokens.verify(`${forged}.${mac}`, secrets));
    assert.ok(b64.length > 10);
  });

  // ── Google OAuth (injection fetch) ─────────────────────────────────
  await runTest('Google OAuth : échange JWT contre access_token (mockée) + cache', async () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const credentials = {
      client_email: 'test@example.iam.gserviceaccount.com',
      private_key: privateKeyPem,
      token_uri: 'https://oauth2.googleapis.com/token',
      project_id: 'demo-project'
    };
    GoogleOAuth._clearCache();
    let calls = 0;
    const fetchImpl = async (url, options) => {
      calls += 1;
      assert.strictEqual(url, 'https://oauth2.googleapis.com/token');
      assert.ok(String(options.body).includes('jwt-bearer'));
      return mockResponse(200, { access_token: 'ya29.mock-token', expires_in: 3600 });
    };
    const first = await GoogleOAuth.getAccessToken({ credentials, scope: 'scope-a', fetchImpl, now: Date.now() });
    const second = await GoogleOAuth.getAccessToken({ credentials, scope: 'scope-a', fetchImpl, now: Date.now() });
    assert.strictEqual(first, 'ya29.mock-token');
    assert.strictEqual(second, 'ya29.mock-token');
    assert.strictEqual(calls, 1, 'le second appel doit venir du cache');
  });

  await runTest('Google OAuth : parseServiceAccount gère les \\n et rejette les blobs invalides', () => {
    const good = GoogleOAuth.parseServiceAccount(JSON.stringify({
      client_email: 'svc@example.iam.gserviceaccount.com',
      private_key: 'line1\\nline2'
    }));
    assert.strictEqual(good.private_key, 'line1\nline2');
    assert.strictEqual(GoogleOAuth.parseServiceAccount('{invalid'), null);
    assert.strictEqual(GoogleOAuth.parseServiceAccount(JSON.stringify({ client_email: 'x@y.z' })), null);
  });

  // ── SIWE (EIP-4361) ───────────────────────────────────────────────
  const wallet = new ethers.Wallet('0x' + '11'.repeat(32));

  await runTest('SIWE : build/parse/verify roundtrip', async () => {
    const now = Date.now();
    const message = SiweMessage.buildSiweMessage({
      domain: 'app.fitia.pro',
      address: wallet.address,
      chainId: 137,
      nonce: 'abc123XYZ_-nonce123',
      issuedAt: new Date(now),
      expirationTime: new Date(now + 5 * 60 * 1000)
    });
    const parsed = SiweMessage.parseSiweMessage(message);
    assert.strictEqual(parsed.domain, 'app.fitia.pro');
    assert.strictEqual(parsed.chainId, 137);
    assert.strictEqual(parsed.address, ethers.getAddress(wallet.address));
    const signature = await wallet.signMessage(message);
    const verified = SiweMessage.verifySiweMessage({
      message,
      signature,
      allowedDomains: ['app.fitia.pro'],
      chainId: 137,
      now
    });
    assert.strictEqual(verified.address, ethers.getAddress(wallet.address));
    assert.strictEqual(verified.nonce, 'abc123XYZ_-nonce123');
  });

  await runTest('SIWE : domaine non autorisé rejeté', async () => {
    const message = SiweMessage.buildSiweMessage({
      domain: 'evil.example.com', address: wallet.address, chainId: 137, nonce: 'nonceDom123456', issuedAt: new Date()
    });
    const signature = await wallet.signMessage(message);
    assert.throws(
      () => SiweMessage.verifySiweMessage({ message, signature, allowedDomains: ['app.fitia.pro'] }),
      /non autorisé/
    );
  });

  await runTest('SIWE : message expiré rejeté', async () => {
    const past = Date.now() - 60 * 60 * 1000;
    const message = SiweMessage.buildSiweMessage({
      domain: 'app.fitia.pro', address: wallet.address, chainId: 137, nonce: 'nonceExp1234567',
      issuedAt: new Date(past), expirationTime: new Date(past + 60 * 1000)
    });
    const signature = await wallet.signMessage(message);
    assert.throws(() => SiweMessage.verifySiweMessage({ message, signature, allowedDomains: ['app.fitia.pro'] }));
  });

  await runTest('SIWE : signature d’une autre clé rejetée', async () => {
    const other = new ethers.Wallet('0x' + '22'.repeat(32));
    const message = SiweMessage.buildSiweMessage({
      domain: 'app.fitia.pro', address: wallet.address, chainId: 137, nonce: 'nonceSig1234567', issuedAt: new Date()
    });
    const signature = await other.signMessage(message);
    assert.throws(
      () => SiweMessage.verifySiweMessage({ message, signature, allowedDomains: ['app.fitia.pro'] }),
      /ne correspond pas/
    );
  });

  await runTest('SIWE service : nonce à usage unique (rejeu rejeté)', async () => {
    const service = new SiweServiceModule.SiweService({
      secrets: HmacTokens.parseSecrets(SECRET_C),
      store: SiweServiceModule.createMemoryNonceStore(),
      allowedDomains: ['app.fitia.pro']
    });
    const { nonce, nonceToken } = service.issueNonce();
    const message = SiweMessage.buildSiweMessage({
      domain: 'app.fitia.pro', address: wallet.address, chainId: 137,
      nonce, issuedAt: new Date(), expirationTime: new Date(Date.now() + 5 * 60 * 1000)
    });
    const signature = await wallet.signMessage(message);
    const first = await service.verify({ message, signature, nonceToken, chainId: 137 });
    assert.strictEqual(first.nonce, nonce);
    await assert.rejects(
      () => service.verify({ message, signature, nonceToken, chainId: 137 }),
      /déjà utilisé/
    );
  });

  await runTest('SIWE service : nonceToken invalide → rejeté', async () => {
    const service = new SiweServiceModule.SiweService({
      secrets: HmacTokens.parseSecrets(SECRET_C),
      store: SiweServiceModule.createMemoryNonceStore(),
      allowedDomains: ['app.fitia.pro']
    });
    await assert.rejects(
      () => service.verify({ message: 'x', signature: 'y', nonceToken: 'a.b', chainId: 137 })
    );
  });

  await runTest('SIWE service : non configuré → SIWE_NOT_CONFIGURED', async () => {
    const service = new SiweServiceModule.SiweService({ secrets: [], store: SiweServiceModule.createMemoryNonceStore() });
    assert.throws(() => service.issueNonce(), /FITIA_SESSION_SECRETS/);
  });

  // ── Play Integrity (fetch mockée) ─────────────────────────────────
  function integrityFetchMock({ deviceVerdict, appVerdict, nonce }) {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const credentials = {
      client_email: 'svc@fitia-test.iam.gserviceaccount.com',
      private_key: privateKeyPem,
      project_id: 'fitia-test'
    };
    const fetchImpl = async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return mockResponse(200, { access_token: 'ya29.integrity-token', expires_in: 3600 });
      }
      if (String(url).includes(':decodeIntegrityToken')) {
        return mockResponse(200, {
          tokenPayloadExternal: {
            requestDetails: { requestPackageName: 'com.fitia.miningpro', packageName: 'com.fitia.miningpro', nonce },
            appIntegrity: { appRecognitionVerdict: appVerdict, packageName: 'com.fitia.miningpro' },
            deviceIntegrity: { deviceRecognitionVerdict: deviceVerdict },
            accountDetails: { appLicensingVerdict: 'UNLICENSED' }
          }
        });
      }
      throw new Error('unexpected url ' + url);
    };
    GoogleOAuth._clearCache();
    return { credentials, fetchImpl };
  }

  await runTest('Integrity : challenge → verify OK (mockée, device reconnu)', async () => {
    const base = integrityFetchMock({ deviceVerdict: 'MEETS_DEVICE_INTEGRITY', appVerdict: 'UNRECOGNIZED_VERSION', nonce: null });
    const service = new IntegrityModule.IntegrityService({
      credentials: base.credentials,
      packageName: 'com.fitia.miningpro',
      minDeviceVerdicts: ['MEETS_DEVICE_INTEGRITY', 'MEETS_STRONG_INTEGRITY'],
      secrets: HmacTokens.parseSecrets(SECRET_A),
      fetchImpl: base.fetchImpl
    });
    const challenge = service.challenge();
    const fetchImpl = async (url, options) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return mockResponse(200, { access_token: 'ya29.integrity-token', expires_in: 3600 });
      }
      return mockResponse(200, {
        tokenPayloadExternal: {
          requestDetails: { packageName: 'com.fitia.miningpro', nonce: challenge.nonce },
          appIntegrity: { appRecognitionVerdict: 'UNRECOGNIZED_VERSION', packageName: 'com.fitia.miningpro' },
          deviceIntegrity: { deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY' },
          accountDetails: { appLicensingVerdict: 'UNLICENSED' }
        }
      });
    };
    service.fetchImpl = fetchImpl;
    GoogleOAuth._clearCache();
    const result = await service.verify({ integrityToken: 'x'.repeat(64), challengeToken: challenge.challengeToken });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.deviceVerdict, 'MEETS_DEVICE_INTEGRITY');
    assert.strictEqual(result.appVerdict, 'UNRECOGNIZED_VERSION');
  });

  await runTest('Integrity : device verdict insuffisant → INTEGRITY_DEVICE (403)', async () => {
    const base = integrityFetchMock({ deviceVerdict: 'MEETS_BASIC_INTEGRITY', appVerdict: 'UNRECOGNIZED_VERSION', nonce: null });
    const service = new IntegrityModule.IntegrityService({
      credentials: base.credentials,
      secrets: HmacTokens.parseSecrets(SECRET_A),
      fetchImpl: base.fetchImpl
    });
    const challenge = service.challenge();
    service.fetchImpl = async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return mockResponse(200, { access_token: 'ya29.integrity-token', expires_in: 3600 });
      }
      return mockResponse(200, {
        tokenPayloadExternal: {
          requestDetails: { packageName: 'com.fitia.miningpro', nonce: challenge.nonce },
          appIntegrity: { appRecognitionVerdict: 'UNRECOGNIZED_VERSION' },
          deviceIntegrity: { deviceRecognitionVerdict: 'MEETS_BASIC_INTEGRITY' }
        }
      });
    };
    GoogleOAuth._clearCache();
    await assert.rejects(
      () => service.verify({ integrityToken: 'y'.repeat(64), challengeToken: challenge.challengeToken }),
      /Appareil non reconnu/
    );
  });

  await runTest('Integrity : nonce incohérent → INTEGRITY_NONCE_MISMATCH', async () => {
    const base = integrityFetchMock({ deviceVerdict: 'MEETS_DEVICE_INTEGRITY', appVerdict: 'UNRECOGNIZED_VERSION', nonce: 'wrong-nonce' });
    const service = new IntegrityModule.IntegrityService({
      credentials: base.credentials,
      secrets: HmacTokens.parseSecrets(SECRET_A),
      fetchImpl: base.fetchImpl
    });
    const challenge = service.challenge();
    service.fetchImpl = async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return mockResponse(200, { access_token: 'ya29.integrity-token', expires_in: 3600 });
      }
      return mockResponse(200, {
        tokenPayloadExternal: {
          requestDetails: { packageName: 'com.fitia.miningpro', nonce: 'attacker-controlled-nonce' },
          appIntegrity: { appRecognitionVerdict: 'UNRECOGNIZED_VERSION' },
          deviceIntegrity: { deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY' }
        }
      });
    };
    GoogleOAuth._clearCache();
    await assert.rejects(
      () => service.verify({ integrityToken: 'z'.repeat(64), challengeToken: challenge.challengeToken }),
      /nonce/
    );
  });

  await runTest('Integrity : requirePlayRecognized → UNRECOGNIZED_VERSION rejeté', async () => {
    const base = integrityFetchMock({ deviceVerdict: 'MEETS_DEVICE_INTEGRITY', appVerdict: 'UNRECOGNIZED_VERSION', nonce: null });
    const service = new IntegrityModule.IntegrityService({
      credentials: base.credentials,
      secrets: HmacTokens.parseSecrets(SECRET_A),
      requirePlayRecognized: true,
      fetchImpl: base.fetchImpl
    });
    const challenge = service.challenge();
    service.fetchImpl = async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return mockResponse(200, { access_token: 'ya29.integrity-token', expires_in: 3600 });
      }
      return mockResponse(200, {
        tokenPayloadExternal: {
          requestDetails: { packageName: 'com.fitia.miningpro', nonce: challenge.nonce },
          appIntegrity: { appRecognitionVerdict: 'UNRECOGNIZED_VERSION' },
          deviceIntegrity: { deviceRecognitionVerdict: 'MEETS_STRONG_INTEGRITY' }
        }
      });
    };
    GoogleOAuth._clearCache();
    await assert.rejects(
      () => service.verify({ integrityToken: 'w'.repeat(64), challengeToken: challenge.challengeToken }),
      /non reconnue/
    );
  });

  await runTest('Integrity : non configuré → INTEGRITY_NOT_CONFIGURED', async () => {
    const service = new IntegrityModule.IntegrityService({ secrets: [], fetchImpl: async () => { throw new Error('no fetch'); } });
    assert.strictEqual(service.isConfigured(), false);
    await assert.rejects(() => service.verify({ integrityToken: 'v'.repeat(64), challengeToken: 'x.y' }), /non configuré/);
  });

  // ── Push FCM (fetch mockée) ──────────────────────────────────────
  await runTest('Push : validation du format de jeton FCM', () => {
    assert.strictEqual(PushModule.tokenPatternOk('fcm-token:123-abc_def'), true);
    assert.strictEqual(PushModule.tokenPatternOk('short'), false);
    assert.strictEqual(PushModule.tokenPatternOk('has space in it abcdefghij'), false);
    assert.strictEqual(PushModule.tokenPatternOk(''), false);
  });

  await runTest('Push : register/unregister via store mémoire', async () => {
    const store = PushModule.createMemoryPushStore();
    const service = new PushModule.PushService({ store, nowFn: () => 1234 });
    await service.register({ token: 'fcm-token:valid-token-123456', platform: 'android' });
    let list = await store.list();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].platform, 'android');
    await service.unregister({ token: 'fcm-token:valid-token-123456' });
    list = await store.list();
    assert.strictEqual(list.length, 0);
  });

  await runTest('Push : send non configuré → PUSH_NOT_CONFIGURED', async () => {
    const service = new PushModule.PushService({ store: PushModule.createMemoryPushStore() });
    await assert.rejects(() => service.send({ title: 'Hello' }), /FCM non configuré/);
  });

  await runTest('Push : send OK + purge des jetons UNREGISTERED (mockée)', async () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const credentials = {
      client_email: 'svc@fitia-test.iam.gserviceaccount.com',
      private_key: privateKeyPem,
      project_id: 'fitia-test'
    };
    const store = PushModule.createMemoryPushStore();
    await store.upsert({ token: 'fcm-token:good-token-000000001', platform: 'android', createdAt: Date.now() });
    await store.upsert({ token: 'fcm-token:stale-token-000000002', platform: 'android', createdAt: Date.now() });
    const fetchImpl = async (url, options) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return mockResponse(200, { access_token: 'ya29.fcm-token', expires_in: 3600 });
      }
      if (String(url).includes('/messages:send')) {
        const message = JSON.parse(options.body).message;
        if (message.token.includes('stale')) {
          return mockResponse(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } });
        }
        return mockResponse(200, { name: 'projects/fitia-test/messages/abc' });
      }
      throw new Error('unexpected url ' + url);
    };
    GoogleOAuth._clearCache();
    const service = new PushModule.PushService({ credentials, projectId: 'fitia-test', store, fetchImpl });
    const result = await service.send({ title: 'Test', body: 'Contenu' });
    assert.strictEqual(result.sent, 1);
    assert.strictEqual(result.failed, 1);
    assert.strictEqual(result.pruned, 1);
    const remaining = await store.list();
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].token.includes('good'), true);
  });

  await runTest('Push : assertAdminToken — temps constant, fail-closed', () => {
    assert.strictEqual(PushModule.assertAdminToken('secret', 'secret'), true);
    assert.strictEqual(PushModule.assertAdminToken('Secret', 'secret'), false);
    assert.strictEqual(PushModule.assertAdminToken('', 'secret'), false);
    assert.strictEqual(PushModule.assertAdminToken('secret', ''), false);
  });

  // ── Ingest d'erreurs ─────────────────────────────────────────────
  await runTest('Erreurs : sanitizeReport rediège email / JWT / adresse', () => {
    const report = ErrorsModule.sanitizeReport({
      message: 'boom for alice@example.com with 0x' + 'ab'.repeat(20),
      stack: 'at send (jwt eyJ' + 'a'.repeat(12) + '.' + 'b'.repeat(12) + '.' + 'c'.repeat(12) + ')',
      url: 'https://app.fitia.pro/wallet.html?secret=abc#frag',
      release: '3.7.12'
    });
    assert.ok(!report.message.includes('alice@example.com'));
    assert.ok(report.message.includes('[email]'));
    assert.ok(!report.stack.includes('eyJ'));
    assert.strictEqual(report.url, 'https://app.fitia.pro/wallet.html');
  });

  await runTest('Erreurs : ingestion OK (mémoire) puis store en échec → stored:false sans exception', async () => {
    const okService = new ErrorsModule.ErrorService({ store: ErrorsModule.createMemoryErrorStore() });
    const ok = await okService.ingest({ message: 'hello', release: '3.7.12', url: 'https://app.fitia.pro/' });
    assert.deepStrictEqual(ok, { ok: true, stored: true });
    const brokenService = new ErrorsModule.ErrorService({ store: { async insert() { throw new Error('db down'); } } });
    const degraded = await brokenService.ingest({ message: 'hello' });
    assert.deepStrictEqual(degraded, { ok: true, stored: false });
  });

  await runTest('Erreurs : message vide → ERRORS_MESSAGE', async () => {
    const service = new ErrorsModule.ErrorService({ store: ErrorsModule.createMemoryErrorStore() });
    await assert.rejects(() => service.ingest({ message: '   ' }), /Message requis/);
  });

  // ── Endpoints (handlers, sans infra) ─────────────────────────────
  await runTest('API : /api/siwe verify sans secrets → 503 SIWE_NOT_CONFIGURED', async () => {
    delete process.env.FITIA_SESSION_SECRETS;
    delete process.env.SIWE_SESSION_SECRETS;
    const handler = require('../api/siwe');
    const res = captureResponse();
    await handler(jsonHandlerRequest('verify', { message: 'm', signature: 's', nonceToken: 'a.b' }), res);
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(res.json().code, 'SIWE_NOT_CONFIGURED');
  });

  await runTest('API : /api/integrity verify sans compte de service → 503', async () => {
    delete process.env.INTEGRITY_SERVICE_ACCOUNT_JSON;
    delete process.env.FITIA_SESSION_SECRETS;
    const handler = require('../api/integrity');
    const res = captureResponse();
    await handler(jsonHandlerRequest('verify', { integrityToken: 'i'.repeat(64), challengeToken: 'a.b' }), res);
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(res.json().code, 'INTEGRITY_NOT_CONFIGURED');
  });

  await runTest('API : /api/push send sans PUSH_ADMIN_TOKEN → 503 ; jeton faux → 401', async () => {
    delete process.env.PUSH_ADMIN_TOKEN;
    const handler = require('../api/push');
    let res = captureResponse();
    await handler(jsonHandlerRequest('send', { title: 't' }), res);
    assert.strictEqual(res.statusCode, 503);
    process.env.PUSH_ADMIN_TOKEN = 'op-secret';
    res = captureResponse();
    await handler(jsonHandlerRequest('send', { title: 't' }, { 'x-fitia-admin-token': 'nope' }), res);
    assert.strictEqual(res.statusCode, 401);
    delete process.env.PUSH_ADMIN_TOKEN;
  });

  await runTest('API : /api/errors ingest accepte un rapport valide (202)', async () => {
    const handler = require('../api/errors');
    const res = captureResponse();
    await handler(jsonHandlerRequest('ingest', { message: 'test error from suite', release: '3.7.12' }), res);
    assert.strictEqual(res.statusCode, 202);
    assert.strictEqual(res.json().ok, true);
  });

  await runTest('APK : error-reporter.js et siwe-client.js sont embarqués et référencés', () => {
    const builder = fs.readFileSync(path.join(ROOT, 'scripts', 'build_apk.py'), 'utf8');
    assert.ok(builder.includes('"error-reporter.js"'));
    assert.ok(builder.includes('"siwe-client.js"'));
    const shell = fs.readFileSync(path.join(ROOT, 'android-src', 'wallet.html'), 'utf8');
    assert.ok(shell.includes('<script src="error-reporter.js"></script>'));
    assert.ok(shell.includes('<script src="siwe-client.js"></script>'));
    const reporter = fs.readFileSync(path.join(ROOT, 'error-reporter.js'), 'utf8');
    assert.ok(reporter.includes('fitia.errorReporting'));
    assert.ok(!reporter.includes('FITIA_PRIVATE'), 'aucun secret dans le client');
  });

  await runTest('Docs : le guide d’activation 4/5/7/8 existe et liste les prérequis', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'docs', 'DURCISSEMENT-4-5-7-8.md'), 'utf8');
    assert.ok(doc.includes('Play Integrity'));
    assert.ok(doc.includes('FCM'));
    assert.ok(doc.includes('SIWE'));
    assert.ok(doc.includes('FITIA_SESSION_SECRETS'));
  });

  console.log('═'.repeat(72));
  console.log(`📊 RÉSULTAT FINAL : ${passed} réussis, ${failed} échoués`);
  console.log('═'.repeat(72));
  process.exit(failed > 0 ? 1 : 0);
})().catch((error) => {
  console.error('Erreur fatale du runner:', error);
  process.exit(1);
});
