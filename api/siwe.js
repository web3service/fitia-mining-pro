'use strict';

// API SIWE (item 7) — émission de nonce et vérification EIP-4361.
// Rotation des clés HMAC : FITIA_SESSION_SECRETS = "kidA:secretA,kidB:secretB".

const Kit = require('../lib/api-kit');
const SiweServiceModule = require('../siwe-service');

const FAILED_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

const limiter = Kit.createRateLimiter(30, 60 * 1000); // 30 req / min / ip
const failures = Kit.createRateLimiter(MAX_FAILURES, FAILED_WINDOW_MS);

let service = null;

function getService() {
  if (!service) {
    const env = SiweServiceModule.fromEnv();
    service = new SiweServiceModule.SiweService({
      secrets: env.secrets,
      store: env.store,
      allowedDomains: env.allowedDomains,
      nowFn: env.now ? () => env.now : undefined
    });
  }
  return service;
}

function mapError(res, error) {
  const status = error.status || ({
    SIWE_NOT_CONFIGURED: 503,
    SIWE_STORE: 503,
    SIWE_NONCE_REUSED: 401,
    SIWE_SIGNATURE: 401,
    SIWE_NONCE_MISMATCH: 401,
    SIWE_NONCE_TOKEN: 401,
    HMAC_EXPIRED: 401,
    HMAC_UNKNOWN_KID: 401,
    HMAC_BAD_SIGNATURE: 401,
    HMAC_MALFORMED: 400,
    SIWE_PARSE: 400,
    SIWE_SIZE: 400,
    SIWE_DOMAIN: 401,
    SIWE_CHAIN: 401,
    SIWE_TIME: 401
  }[error.code] || 400);
  Kit.send(res, status, { error: error.message || 'Requête invalide.', code: error.code || 'SIWE_ERROR' });
}

module.exports = async function handler(req, res) {
  Kit.setSecurityHeaders(req, res);
  if (req.method === 'OPTIONS') return Kit.handleOptions(req, res);
  if (req.method !== 'POST') {
    return Kit.send(res, 405, { error: 'Méthode non autorisée.', code: 'METHOD_NOT_ALLOWED' });
  }
  const clientKey = Kit.getClientKey(req);
  if (!limiter(clientKey).allowed) {
    return Kit.send(res, 429, { error: 'Trop de requêtes. Réessayez plus tard.', code: 'RATE_LIMIT' });
  }
  const action = Kit.getAction(req, ['nonce', 'verify']);
  if (!action) {
    return Kit.send(res, 404, { error: 'Action SIWE inconnue.', code: 'NOT_FOUND' });
  }
  if (action === 'verify' && !failures(clientKey).allowed) {
    return Kit.send(res, 429, { error: 'Trop de tentatives. Réessayez plus tard.', code: 'RATE_LIMIT' });
  }
  let body;
  try {
    body = await Kit.readJsonBody(req, 16 * 1024);
  } catch (error) {
    return Kit.send(res, error.status || 400, { error: error.message, code: error.code || 'BAD_JSON' });
  }
  try {
    if (action === 'nonce') {
      return Kit.send(res, 200, getService().issueNonce());
    }
    const result = await getService().verify({
      message: body.message,
      signature: body.signature,
      nonceToken: body.nonceToken,
      chainId: body.chainId
    });
    return Kit.send(res, 200, result);
  } catch (error) {
    return mapError(res, error);
  }
};
