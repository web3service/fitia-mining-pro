#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { MfaService } = require('../mfa/service');
const { MemoryMfaRepository } = require('../mfa/memory-repository');
const { createFarmMfaGuard } = require('../mfa/farm-guard');
const { hotp } = require('../mfa/totp');
const userId = '7b0f7399-ca7a-4b6f-a4f1-9f4266f0f21c';
const wallet = '0x' + 'a'.repeat(40);
const id = '7b0f7399-ca7a-4b6f-a4f1-9f4266f0f21d';
(async () => {
  let now = 1800000000000;
  const repository = new MemoryMfaRepository();
  repository.findUserByWallet = async (value) => value === wallet ? userId : null;
  const mfa = new MfaService({ repository, key: crypto.randomBytes(32), now: () => now });
  const guard = createFarmMfaGuard({ repository, mfaService: mfa });
  const action = { wallet, actionId: id, coins: 1000 };
  await guard(action); // Optional and disabled.
  const { secret } = await mfa.beginEnrollment(userId);
  const { recoveryCodes } = await mfa.confirmEnrollment(userId, hotp(secret, Math.floor(now / 30000)));
  await assert.rejects(guard(action), (e) => e.code === 'FARM_MFA_REQUIRED');
  await assert.rejects(guard({ ...action, code: 'wrong' }), (e) => e.code === 'FARM_MFA_INVALID');
  await guard({ ...action, code: recoveryCodes[0] });
  assert.deepStrictEqual(repository.records.get(userId).withdrawalApproval, { ...action, expiresAt: now + 120000 });
  await assert.rejects(guard({ ...action, code: recoveryCodes[0] }), (e) => e.code === 'FARM_MFA_INVALID');
  await guard({ ...action, code: recoveryCodes[1], coins: 1200 });
  assert.strictEqual(repository.records.get(userId).withdrawalApproval.coins, 1200);
  const unavailable = createFarmMfaGuard({ repository: { findUserByWallet: async () => { throw new Error('offline'); } }, mfaService: mfa });
  await assert.rejects(unavailable(action), (e) => e.code === 'FARM_MFA_UNAVAILABLE');
  console.log('FARM MFA guard tests passed: optional, bound approval, recovery replay and fail closed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
