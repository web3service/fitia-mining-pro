// ═══════════════════════════════════════════════════════════════════
//  HMAC-SHA256 stateless tokens with key rotation (kid).
//  - Format : base64url(json).base64url(hmac)
//  - The first configured secret signs; every configured secret verifies.
//  - Secrets come from an env list : "kidA:secretA,kidB:secretB" or bare
//    secrets (kid = sha256(secret)[:12]). Minimum 16 chars per secret.
//  Usage : process.env.FITIA_SESSION_SECRETS = "primary:s3cr3t…,backup:0ld…"
// ═══════════════════════════════════════════════════════════════════
'use strict';

const crypto = require('crypto');

function b64urlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(segment) {
  const normalized = String(segment).replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? normalized : normalized + '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(pad, 'base64');
}

function parseSecrets(raw) {
  const list = String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsed = [];
  for (const item of list) {
    const idx = item.indexOf(':');
    let kid;
    let secret;
    if (idx > 0) {
      kid = item.slice(0, idx).trim();
      secret = item.slice(idx + 1).trim();
    } else {
      secret = item;
      kid = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 12);
    }
    if (!kid || secret.length < 16) continue; // refuse les secrets faibles
    parsed.push({ kid, secret });
  }
  return parsed;
}

function sign(payload, secrets, options = {}) {
  if (!Array.isArray(secrets) || secrets.length === 0) {
    throw new Error('FITIA_HMAC_NO_SECRETS');
  }
  const ttlMs = Number(options.ttlMs) > 0 ? Number(options.ttlMs) : 5 * 60 * 1000;
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const active = secrets[0];
  const body = Object.assign({}, payload, {
    kid: active.kid,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + Math.floor(ttlMs / 1000)
  });
  const b64 = b64urlEncode(JSON.stringify(body));
  const mac = crypto.createHmac('sha256', active.secret).update(b64).digest();
  return `${b64}.${b64urlEncode(mac)}`;
}

function verify(token, secrets, options = {}) {
  if (!Array.isArray(secrets) || secrets.length === 0) {
    throw new Error('FITIA_HMAC_NO_SECRETS');
  }
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const raw = String(token || '');
  const dot = raw.lastIndexOf('.');
  if (dot <= 0 || raw.length > 8192) {
    const error = new Error('Jeton malformé.');
    error.code = 'HMAC_MALFORMED';
    throw error;
  }
  const b64 = raw.slice(0, dot);
  const macPart = raw.slice(dot + 1);
  let body;
  try {
    body = JSON.parse(b64urlDecode(b64).toString('utf8'));
  } catch (_) {
    const error = new Error('Jeton illisible.');
    error.code = 'HMAC_MALFORMED';
    throw error;
  }
  if (!body || typeof body !== 'object' || typeof body.kid !== 'string') {
    const error = new Error('Jeton illisible.');
    error.code = 'HMAC_MALFORMED';
    throw error;
  }
  const secret = secrets.find((entry) => entry.kid === body.kid);
  if (!secret) {
    const error = new Error('Clé de signature inconnue.');
    error.code = 'HMAC_UNKNOWN_KID';
    throw error;
  }
  const expected = crypto.createHmac('sha256', secret.secret).update(b64).digest();
  let provided;
  try {
    provided = b64urlDecode(macPart);
  } catch (_) {
    const error = new Error('Jeton malformé.');
    error.code = 'HMAC_MALFORMED';
    throw error;
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    const error = new Error('Signature invalide.');
    error.code = 'HMAC_BAD_SIGNATURE';
    throw error;
  }
  const nowSec = Math.floor(now / 1000);
  if (!Number.isFinite(body.exp) || body.exp <= nowSec) {
    const error = new Error('Jeton expiré.');
    error.code = 'HMAC_EXPIRED';
    throw error;
  }
  return body;
}

function keyFingerprints(secrets) {
  return (secrets || []).map((entry) => entry.kid);
}

module.exports = {
  b64urlEncode,
  b64urlDecode,
  parseSecrets,
  sign,
  verify,
  keyFingerprints
};
