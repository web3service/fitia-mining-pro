#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { encryptSeed, decryptSeed } = require('../mfa/secrets');
const { createSecret, encodeBase32, decodeBase32, hotp, verifyTotp, generateRecoveryCodes, hashRecoveryCode } = require('../mfa/totp');

const secret = encodeBase32(Buffer.from('12345678901234567890'));
assert.strictEqual(secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
assert.strictEqual(decodeBase32(secret).toString(), '12345678901234567890');
// RFC 6238, SHA-1, eight digits and 30 second time step.
for (const [seconds, expected] of [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037']]) {
  assert.strictEqual(hotp(secret, Math.floor(seconds / 30), 8), expected);
}
const counter = 100000;
const code = hotp(secret, counter);
assert.strictEqual(verifyTotp(secret, code, { now: counter * 30000 }), counter);
assert.strictEqual(verifyTotp(secret, code, { now: (counter + 1) * 30000 }), counter);
assert.strictEqual(verifyTotp(secret, code, { now: counter * 30000, lastCounter: counter }), null);
assert.strictEqual(verifyTotp(secret, code, { now: (counter + 2) * 30000 }), null);
assert.strictEqual(verifyTotp(secret, 'abc123'), null);
assert.throws(() => decodeBase32('NOT VALID'));
const generated = createSecret();
assert.strictEqual(decodeBase32(generated).length, 20);
assert.notStrictEqual(createSecret(), generated);
const recovery = generateRecoveryCodes();
assert.strictEqual(new Set(recovery).size, 10);
for (const item of recovery) {
  const hash = hashRecoveryCode(item);
  assert.strictEqual(hash.length, 64);
  assert.strictEqual(hashRecoveryCode(item.toLowerCase().replace(/-/g, '')), hash);
  assert.ok(!hash.includes(item.replace(/-/g, '')));
}
assert.throws(() => hashRecoveryCode('123456'));
assert.ok(crypto.timingSafeEqual(Buffer.from(hashRecoveryCode(recovery[0]), 'hex'), Buffer.from(hashRecoveryCode(recovery[0]), 'hex')));
const key = crypto.randomBytes(32);
const user = '7b0f7399-ca7a-4b6f-a4f1-9f4266f0f21c';
const envelope = encryptSeed(key, user, generated);
assert.strictEqual(decryptSeed(key, user, envelope), generated);
assert.ok(!JSON.stringify(envelope).includes(generated));
assert.throws(() => decryptSeed(crypto.randomBytes(32), user, envelope));
assert.throws(() => decryptSeed(key, '7b0f7399-ca7a-4b6f-a4f1-9f4266f0f21d', envelope));
const tampered = { ...envelope, ciphertext: Buffer.from('tampered').toString('base64') };
assert.throws(() => decryptSeed(key, user, tampered));
assert.throws(() => encryptSeed(Buffer.alloc(31), user, generated));
assert.notStrictEqual(encryptSeed(key, user, generated).iv, envelope.iv);
console.log('TOTP primitives: RFC vectors, clock tolerance, replay counters and recovery code hashing passed.');
