#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const { AccountError } = require('../account-service');
const { createAccountHandler } = require('../api/account');
const { MfaService } = require('../mfa/service');
const { MfaAccountController } = require('../mfa/account-controller');
const { MemoryMfaRepository } = require('../mfa/memory-repository');
const { hotp } = require('../mfa/totp');
const userId = '7b0f7399-ca7a-4b6f-a4f1-9f4266f0f21c';
const access = 'access-' + 'a'.repeat(40);
let now = 1800000000000;
const account = {
  auth: { async getUser(token) { if (token !== access) throw new AccountError(401, 'Session invalide', 'ACCOUNT_AUTH'); return { id: userId }; } },
  async ensureProfile() { return { userId, email: 'private@example.test', walletAddress: '0x' + 'a'.repeat(40), walletVerified: true }; },
  async reauthenticate(_, password) { if (password !== 'correct') throw new AccountError(403, 'Mot de passe incorrect', 'ACCOUNT_REAUTH'); }
};
const mfa = new MfaService({ repository: new MemoryMfaRepository(), key: crypto.randomBytes(32), now: () => now });
const controller = new MfaAccountController({ accountService: account, mfaService: mfa });
async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}/api/account` };
}
async function request(base, action, method, body, token = access) {
  const response = await fetch(`${base}/${action}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
(async () => {
  const exposed = await listen(createAccountHandler({ mfaController: controller }));
  const disabled = await listen(createAccountHandler());
  try {
    assert.strictEqual((await request(disabled.base, 'mfa-status', 'GET')).status, 404);
    assert.strictEqual((await request(disabled.base, 'mfa-begin', 'POST', { currentPassword: 'correct' })).status, 404);
    assert.strictEqual((await request(exposed.base, 'mfa-status', 'GET', null, '')).status, 401);
    assert.strictEqual((await request(exposed.base, 'mfa-begin', 'GET')).status, 405);
    assert.strictEqual((await request(exposed.base, 'mfa-begin', 'POST', { currentPassword: 'wrong' })).status, 403);
    const start = await request(exposed.base, 'mfa-begin', 'POST', { currentPassword: 'correct' });
    assert.strictEqual(start.status, 200);
    assert.match(start.headers.get('cache-control'), /no-store/);
    assert.ok(start.body.secret && start.body.uri);
    const confirm = await request(exposed.base, 'mfa-confirm', 'POST', { code: hotp(start.body.secret, Math.floor(now / 30000)) });
    assert.strictEqual(confirm.status, 200);
    assert.strictEqual(confirm.body.recoveryCodes.length, 10);
    assert.deepStrictEqual((await request(exposed.base, 'mfa-status', 'GET')).body, { enabled: true });
    assert.strictEqual((await request(exposed.base, 'mfa-verify', 'POST', { wallet: '0x' + 'b'.repeat(40), code: confirm.body.recoveryCodes[1] })).status, 403);
    assert.strictEqual((await request(exposed.base, 'mfa-verify', 'POST', { wallet: '0x' + 'a'.repeat(40), code: confirm.body.recoveryCodes[1] })).status, 200);
    assert.strictEqual((await request(exposed.base, 'mfa-verify', 'POST', { wallet: '0x' + 'a'.repeat(40), code: confirm.body.recoveryCodes[1] })).status, 403);
    assert.strictEqual((await request(exposed.base, 'mfa-disable', 'POST', { currentPassword: 'wrong', code: confirm.body.recoveryCodes[0] })).status, 403);
    assert.strictEqual((await request(exposed.base, 'mfa-disable', 'POST', { currentPassword: 'correct', code: confirm.body.recoveryCodes[0] })).status, 200);
    assert.deepStrictEqual((await request(exposed.base, 'mfa-status', 'GET')).body, { enabled: false });
    console.log('MFA API tests passed: production disabled, authenticated test routes, no caching and recovery.');
  } finally { await Promise.all([exposed, disabled].map(({server}) => new Promise((resolve) => server.close(resolve)))); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
