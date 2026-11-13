// ═══════════════════════════════════════════════════════════════════
//  Google OAuth2 access tokens via the RS256 JWT bearer grant.
//  Zero new dependency: Node 22 + crypto only. Used by the Play
//  Integrity and FCM HTTP v1 integrations (service accounts).
//  The HTTP layer is injectable for tests (options.fetch).
// ═══════════════════════════════════════════════════════════════════
'use strict';

const crypto = require('crypto');

const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const TOKEN_TTL_SECONDS = 3600;

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signJwt(credentials, scope, now) {
  const iat = Math.floor((Number.isFinite(now) ? now : Date.now()) / 1000);
  const tokenUri = credentials.token_uri || DEFAULT_TOKEN_URI;
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: credentials.client_email,
    scope,
    aud: tokenUri,
    iat,
    exp: iat + TOKEN_TTL_SECONDS
  };
  const unsigned = `${base64urlJson(header)}.${base64urlJson(claims)}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(credentials.private_key);
  const signed = signature
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${unsigned}.${signed}`;
}

function parseServiceAccount(raw) {
  if (!raw) return null;
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (!parsed.client_email || !parsed.private_key) return null;
  return {
    client_email: String(parsed.client_email),
    // Vercel exposes multi-line env values with escaped \n
    private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
    token_uri: parsed.token_uri ? String(parsed.token_uri) : DEFAULT_TOKEN_URI,
    project_id: parsed.project_id ? String(parsed.project_id) : null
  };
}

const tokenCache = new Map();
const MAX_CACHE_ENTRIES = 32;

function cacheKey(scope, credentials) {
  return `${credentials.client_email}|${scope}`;
}

function getCachedToken(scope, credentials, now) {
  const entry = tokenCache.get(cacheKey(scope, credentials));
  if (entry && entry.expiresAt > now + 60 * 1000) return entry.accessToken;
  return null;
}

function setCachedToken(scope, credentials, accessToken, expiresInSec, now) {
  if (tokenCache.size >= MAX_CACHE_ENTRIES) tokenCache.clear();
  tokenCache.set(cacheKey(scope, credentials), {
    accessToken,
    expiresAt: now + expiresInSec * 1000
  });
}

// options: { credentials, scope, fetchImpl, now }
async function getAccessToken(options = {}) {
  const credentials = options.credentials;
  const scope = options.scope;
  if (!credentials || !credentials.client_email || !credentials.private_key) {
    const error = new Error('Compte de service Google non configuré.');
    error.code = 'GOOGLE_NOT_CONFIGURED';
    throw error;
  }
  if (!scope) {
    const error = new Error('Scope OAuth manquant.');
    error.code = 'GOOGLE_NOT_CONFIGURED';
    throw error;
  }
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const cached = getCachedToken(scope, credentials, now);
  if (cached) return cached;

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    const error = new Error('fetch indisponible.');
    error.code = 'GOOGLE_FETCH_MISSING';
    throw error;
  }
  const assertion = signJwt(credentials, scope, now);
  const tokenUri = credentials.token_uri || DEFAULT_TOKEN_URI;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });
  const response = await fetchImpl(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    parsed = null;
  }
  if (!response.ok || !parsed || !parsed.access_token) {
    const error = new Error(`Échec OAuth Google (${response.status}).`);
    error.code = 'GOOGLE_OAUTH_FAILED';
    error.status = response.status;
    throw error;
  }
  const expiresIn = Number(parsed.expires_in) > 0 ? Number(parsed.expires_in) : TOKEN_TTL_SECONDS;
  setCachedToken(scope, credentials, String(parsed.access_token), expiresIn, now);
  return String(parsed.access_token);
}

// Tests uniquement : vide le cache mémoire.
function _clearCache() {
  tokenCache.clear();
}

module.exports = {
  parseServiceAccount,
  getAccessToken,
  signJwt,
  DEFAULT_TOKEN_URI,
  _clearCache
};
