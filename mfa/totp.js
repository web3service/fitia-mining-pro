'use strict';

// Server-side primitives only. The caller must store secrets encrypted, rate
// limit verification, and atomically consume counters / recovery hashes.
const crypto = require('crypto');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(bytes) {
  let bits = 0, value = 0, result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
      value &= (1 << bits) - 1;
    }
  }
  if (bits) result += ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

function decodeBase32(secret) {
  if (typeof secret !== 'string' || !/^[A-Z2-7]{16,128}$/.test(secret)) throw new Error('Invalid TOTP secret');
  let bits = 0, value = 0;
  const output = [];
  for (const char of secret) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  if (bits && value !== 0) throw new Error('Invalid TOTP secret padding');
  return Buffer.from(output);
}

function createSecret() { return encodeBase32(crypto.randomBytes(20)); }

function hotp(secret, counter, digits = 6) {
  if (!Number.isSafeInteger(counter) || counter < 0 || ![6, 8].includes(digits)) throw new Error('Invalid HOTP parameters');
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)).padStart(digits, '0');
}

// Return the accepted counter, not a boolean. It must be consumed atomically
// with verification against the same account to prevent parallel replay.
function verifyTotp(secret, code, { now = Date.now(), lastCounter = -1 } = {}) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code) || !Number.isSafeInteger(now) || now < 0
    || !Number.isSafeInteger(lastCounter) || lastCounter < -1) return null;
  const current = Math.floor(now / 30000);
  const supplied = Buffer.from(code, 'ascii');
  let accepted = null;
  for (const counter of [current - 1, current, current + 1]) {
    if (counter < 0) continue;
    const expected = Buffer.from(hotp(secret, counter), 'ascii');
    if (crypto.timingSafeEqual(supplied, expected) && counter > lastCounter) accepted = counter;
  }
  return accepted;
}

function generateRecoveryCodes(count = 10) {
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('Invalid recovery code count');
  return Array.from({ length: count }, () => crypto.randomBytes(16).toString('hex').toUpperCase().match(/.{8}/g).join('-'));
}

function hashRecoveryCode(code) {
  const normalized = typeof code === 'string' ? code.trim().toUpperCase().replace(/-/g, '') : '';
  if (!/^[0-9A-F]{32}$/.test(normalized)) throw new Error('Invalid recovery code');
  return crypto.createHash('sha256').update('FITIA_RECOVERY_V1:').update(normalized).digest('hex');
}

module.exports = { createSecret, encodeBase32, decodeBase32, hotp, verifyTotp, generateRecoveryCodes, hashRecoveryCode };
