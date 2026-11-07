'use strict';

// Encrypt TOTP seeds server-side. Key provisioning and rotation are the
// responsibility of the deployment; no key or plaintext is persisted here.
const crypto = require('crypto');
const { decodeBase32 } = require('./totp');
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function context(key, userId) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Invalid MFA encryption key');
  if (typeof userId !== 'string' || !USER_ID.test(userId)) throw new Error('Invalid MFA user');
  return Buffer.from(`FITIA_MFA_SEED_V1:${userId.toLowerCase()}`, 'utf8');
}

function encryptSeed(key, userId, secret) {
  const aad = context(key, userId);
  decodeBase32(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), ciphertext: encrypted.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

function decryptSeed(key, userId, envelope) {
  const aad = context(key, userId);
  if (!envelope || envelope.version !== 1 || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string' || typeof envelope.tag !== 'string'
    || envelope.iv.length !== 16 || envelope.tag.length !== 24 || envelope.ciphertext.length > 256) throw new Error('Invalid MFA envelope');
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const encrypted = Buffer.from(envelope.ciphertext, 'base64');
  if (iv.length !== 12 || tag.length !== 16 || !encrypted.length) throw new Error('Invalid MFA envelope');
  const cipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  cipher.setAuthTag(tag);
  const secret = Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8');
  decodeBase32(secret);
  return secret;
}

module.exports = { encryptSeed, decryptSeed };
