'use strict';

// Domain logic only: it is NOT an API and does not authenticate callers.
// A production adapter must verify account sessions and recent password
// reauthentication, and implement transact as a shared atomic DB transaction.
const crypto = require('crypto');
const { createSecret, verifyTotp, generateRecoveryCodes, hashRecoveryCode } = require('./totp');
const { encryptSeed, decryptSeed } = require('./secrets');

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const PENDING_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class MfaError extends Error {
  constructor(code) { super(code); this.code = code; }
}

class MfaService {
  constructor({ repository, key, now = Date.now }) {
    if (!repository || typeof repository.transact !== 'function') throw new Error('MFA repository required');
    if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('MFA key required');
    this.repository = repository;
    this.key = Buffer.from(key);
    this.now = now;
  }

  async transact(userId, fn) {
    if (typeof userId !== 'string' || !UUID.test(userId)) throw new MfaError('MFA_USER');
    const result = await this.repository.transact(userId.toLowerCase(), fn);
    if (result.error) throw new MfaError(result.error);
    return result.value;
  }

  async status(userId) {
    return this.transact(userId, (record) => ({ value: { enabled: Boolean(record?.enabled) }, record }));
  }

  // Call only after recent password reauthentication, checked by the API.
  async beginEnrollment(userId) {
    return this.transact(userId, (record) => {
      if (record?.enabled) return { error: 'MFA_ALREADY_ENABLED', record };
      if (record?.lockedUntil > this.now()) return { error: 'MFA_LOCKED', record };
      const secret = createSecret();
      const pending = encryptSeed(this.key, userId, secret);
      return { value: { secret }, record: { enabled: false, pending, pendingExpiresAt: this.now() + PENDING_MS, failures: record?.failures || 0, lockedUntil: record?.lockedUntil || 0 } };
    });
  }

  async confirmEnrollment(userId, code) {
    return this.transact(userId, (record) => {
      if (!record || record.enabled || !record.pending || record.pendingExpiresAt <= this.now()) return { error: 'MFA_ENROLLMENT_EXPIRED', record };
      if (record.lockedUntil > this.now()) return { error: 'MFA_LOCKED', record };
      const secret = decryptSeed(this.key, userId, record.pending);
      const counter = verifyTotp(secret, code, { now: this.now() });
      if (counter === null) return this.failure(record);
      const recoveryCodes = generateRecoveryCodes();
      return {
        value: { recoveryCodes },
        record: { enabled: true, seed: record.pending, lastCounter: counter, recoveryHashes: recoveryCodes.map(hashRecoveryCode), failures: 0, lockedUntil: 0 }
      };
    });
  }

  failure(record) {
    const failures = (record.failures || 0) + 1;
    const locked = failures >= MAX_FAILURES;
    return { error: locked ? 'MFA_LOCKED' : 'MFA_INVALID', record: { ...record, failures: locked ? 0 : failures, lockedUntil: locked ? this.now() + LOCK_MS : 0 } };
  }

  // Confirmation proves only that this account passed MFA. Binding and
  // consuming a short-lived approval to a specific action is a separate
  // requirement; this method MUST NOT be treated as transaction authorization.
  async consumeCode(userId, code) { return this.verifyAndUpdate(userId, code, false); }

  // Caller must require recent password reauthentication before disabling.
  async disable(userId, code) { return this.verifyAndUpdate(userId, code, true); }

  async authorizeWithdrawal(userId, code, action) {
    if (!action || !/^0x[0-9a-f]{40}$/.test(action.wallet) || !UUID.test(action.actionId)
      || !Number.isSafeInteger(action.coins) || action.coins <= 0) throw new MfaError('MFA_ACTION');
    return this.verifyAndUpdate(userId, code, false, { wallet: action.wallet, actionId: action.actionId.toLowerCase(), coins: action.coins });
  }

  async verifyAndUpdate(userId, code, disable, withdrawal = null) {
    return this.transact(userId, (record) => {
      if (!record?.enabled) return { error: 'MFA_NOT_ENABLED', record };
      if (record.lockedUntil > this.now()) return { error: 'MFA_LOCKED', record };
      const seed = decryptSeed(this.key, userId, record.seed);
      const counter = verifyTotp(seed, code, { now: this.now(), lastCounter: record.lastCounter });
      const approval = withdrawal ? { ...withdrawal, expiresAt: this.now() + 120000 } : null;
      if (counter !== null) return { value: { method: 'totp' }, record: disable ? null : { ...record, ...(approval ? { withdrawalApproval: approval } : {}), lastCounter: counter, failures: 0, lockedUntil: 0 } };
      let candidate = null;
      try { candidate = Buffer.from(hashRecoveryCode(code), 'hex'); } catch (_) { /* Invalid input. */ }
      const hashes = record.recoveryHashes || [];
      let matched = -1;
      if (candidate) hashes.forEach((hash, i) => {
        const expected = Buffer.from(hash, 'hex');
        if (expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate)) matched = i;
      });
      if (matched < 0) return this.failure(record);
      return { value: { method: 'recovery' }, record: disable ? null : { ...record, ...(approval ? { withdrawalApproval: approval } : {}), recoveryHashes: hashes.filter((_, i) => i !== matched), failures: 0, lockedUntil: 0 } };
    });
  }
}

module.exports = { MfaService, MfaError };
