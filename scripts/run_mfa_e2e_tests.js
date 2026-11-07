#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const ethers = require('../vendor/ethers.umd.min');
const Protocol = require('../farm-protocol');
const { AccountError } = require('../account-service');
const { createAccountHandler } = require('../api/account');
const { createFarmHandler } = require('../api/farm');
const { createFarmService, MemoryFarmRepository, defaultState } = require('../farm-service');
const { MfaService } = require('../mfa/service');
const { MemoryMfaRepository } = require('../mfa/memory-repository');
const { MfaAccountController } = require('../mfa/account-controller');
const { createFarmMfaGuard } = require('../mfa/farm-guard');
const { hotp } = require('../mfa/totp');
const id = '7b0f7399-ca7a-4b6f-a4f1-9f4266f0f21c';
const token = 'access-' + 'a'.repeat(40);
const wallet = new ethers.Wallet('0x' + '11'.repeat(32));
const address = wallet.address.toLowerCase();
let now = Date.now();
const account = {
  auth: { async getUser(value) { if (value !== token) throw new AccountError(401, 'Invalid', 'ACCOUNT_AUTH'); return { id }; } },
  async ensureProfile() { return { userId: id, email: 'a@example.test', walletAddress: address, walletVerified: true }; },
  async reauthenticate(_, password) { if (password !== 'correct') throw new AccountError(403, 'Invalid password', 'ACCOUNT_REAUTH'); }
};
const storage = new MemoryMfaRepository();
storage.findUserByWallet = async (value) => value === address ? id : null;
const mfa = new MfaService({ repository: storage, key: crypto.randomBytes(32), now: () => now });
const controller = new MfaAccountController({ accountService: account, mfaService: mfa });
const guard = createFarmMfaGuard({ repository: storage, mfaService: mfa });
const farmRepo = new MemoryFarmRepository();
const state = defaultState(address, now); state.coins = 5000; state.land = { owned: true }; state.animals = [{ id: crypto.randomUUID(), species: 'chicken' }];
farmRepo.accounts.set(address, { state, revision: 1 });
const farm = createFarmService({ repository: farmRepo, now: () => new Date(now), withdrawalGuard: guard });
const accountHandler = createAccountHandler({ mfaController: controller });
const farmHandler = createFarmHandler({ farmService: farm });
const server = http.createServer((req, res) => req.url.startsWith('/api/account/') ? accountHandler(req, res) : farmHandler(req, res));
async function post(base, path, body, authenticated = true) {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const start = await post(base, '/api/account/mfa-begin', { currentPassword: 'correct' }); assert.strictEqual(start.status, 200);
    const confirm = await post(base, '/api/account/mfa-confirm', { code: hotp(start.body.secret, Math.floor(now / 30000)) }); assert.strictEqual(confirm.status, 200);
    const actionId = crypto.randomUUID();
    const body = { action: 'withdraw', buyer: address, timestamp: now, actionId, coins: 1000 };
    body.signature = await wallet.signMessage(Protocol.message('withdraw', body));
    const absent = await post(base, '/api/farm', body, false); assert.strictEqual(absent.body.code, 'FARM_MFA_REQUIRED');
    const wrong = await post(base, '/api/farm', { ...body, mfaCode: 'wrong' }, false); assert.strictEqual(wrong.body.code, 'FARM_MFA_INVALID');
    assert.strictEqual((await farmRepo.get(address)).state.coins, 5000);
    const accepted = await post(base, '/api/farm', { ...body, mfaCode: confirm.body.recoveryCodes[0] }, false);
    assert.strictEqual(accepted.status, 200); assert.strictEqual(accepted.body.state.coins, 4000);
    const approval = storage.records.get(id).withdrawalApproval;
    assert.deepStrictEqual({ wallet: approval.wallet, actionId: approval.actionId, coins: approval.coins }, { wallet: address, actionId, coins: 1000 });
    assert.ok(!JSON.stringify(storage.records.get(id)).includes(confirm.body.recoveryCodes[0]));
    const verify = await post(base, '/api/account/mfa-verify', { wallet: address, code: confirm.body.recoveryCodes[1] }); assert.strictEqual(verify.status, 200);
    const replay = await post(base, '/api/account/mfa-verify', { wallet: address, code: confirm.body.recoveryCodes[1] }); assert.strictEqual(replay.status, 403);
    console.log('MFA end-to-end tests passed: account HTTP activation, signed FARM withdrawal and single-use recovery.');
  } finally { await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; server.close(); });
