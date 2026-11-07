#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { AccountError } = require('../account-service');
const { MfaService } = require('../mfa/service');
const { MfaAccountController } = require('../mfa/account-controller');
const { MemoryMfaRepository } = require('../mfa/memory-repository');
const { hotp } = require('../mfa/totp');
const id = '7b0f7399-ca7a-4b6f-a4f1-9f4266f0f21c';
(async () => {
  let now = 1800000000000;
  let verified = false;
  const profile = { userId: id, email: 'private@example.test', walletAddress: '0x' + 'a'.repeat(40), walletVerified: true };
  const accountService = {
    auth: { async getUser(token) { if (token !== 'valid') throw new AccountError(401, 'Invalid', 'ACCOUNT_AUTH'); return { id }; } },
    async ensureProfile() { return { ...profile }; },
    async reauthenticate(_, password) { if (password !== 'correct') throw new AccountError(403, 'Wrong password', 'ACCOUNT_REAUTH'); verified = true; }
  };
  const mfa = new MfaService({ repository: new MemoryMfaRepository(), key: crypto.randomBytes(32), now: () => now });
  const controller = new MfaAccountController({ accountService, mfaService: mfa });
  await assert.rejects(controller.status('invalid'), (e) => e.code === 'ACCOUNT_AUTH');
  await assert.rejects(controller.begin('valid', 'wrong'), (e) => e.code === 'ACCOUNT_REAUTH');
  profile.walletVerified = false;
  await assert.rejects(controller.begin('valid', 'correct'), (e) => e.code === 'MFA_WALLET_REQUIRED');
  profile.walletVerified = true;
  const { secret, uri } = await controller.begin('valid', 'correct');
  assert.ok(verified);
  assert.ok(uri.startsWith('otpauth://totp/'));
  assert.ok(!uri.includes(profile.email));
  assert.strictEqual(new URL(uri).searchParams.get('secret'), secret);
  await assert.rejects(controller.confirm('valid', 'invalid'), (e) => e.code === 'MFA_INVALID');
  const { recoveryCodes } = await controller.confirm('valid', hotp(secret, Math.floor(now / 30000)));
  assert.deepStrictEqual(await controller.status('valid'), { enabled: true });
  await assert.rejects(controller.disable('valid', 'wrong', recoveryCodes[0]), (e) => e.code === 'ACCOUNT_REAUTH');
  assert.deepStrictEqual(await controller.disable('valid', 'correct', recoveryCodes[0]), { enabled: false });
  assert.deepStrictEqual(await controller.status('valid'), { enabled: false });
  await assert.rejects(controller.confirm('invalid', '123456'), (e) => e.code === 'ACCOUNT_AUTH');
  console.log('MFA account controller tests passed: session, linked wallet, password, activation and recovery disable.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
