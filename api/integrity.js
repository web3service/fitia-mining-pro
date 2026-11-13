'use strict';

// API Play Integrity (item 4) — challenge HMAC + vérification du jeton
// d'intégrité via l'API Google. Requiert INTEGRITY_SERVICE_ACCOUNT_JSON
// et FITIA_SESSION_SECRETS ; sinon 503 INTEGRITY_NOT_CONFIGURED.

const Kit = require('../lib/api-kit');
const IntegrityModule = require('../integrity-service');

const limiter = Kit.createRateLimiter(30, 60 * 1000);

let service = null;

function getService() {
  if (!service) {
    const env = IntegrityModule.fromEnv();
    service = new IntegrityModule.IntegrityService({
      credentials: env.credentials,
      packageName: env.packageName,
      minDeviceVerdicts: env.minDeviceVerdicts,
      requirePlayRecognized: env.requirePlayRecognized,
      expectedCertSha256: env.expectedCertSha256,
      secrets: env.secrets,
      fetchImpl: env.fetchImpl,
      nowFn: env.now ? () => env.now : undefined
    });
  }
  return service;
}

function mapError(res, error) {
  const status = error.status || ({
    INTEGRITY_NOT_CONFIGURED: 503,
    INTEGRITY_TOKEN: 400,
    INTEGRITY_CHALLENGE: 401,
    HMAC_EXPIRED: 401,
    HMAC_UNKNOWN_KID: 401,
    HMAC_BAD_SIGNATURE: 401,
    HMAC_MALFORMED: 400,
    INTEGRITY_NONCE_MISMATCH: 401,
    INTEGRITY_PACKAGE: 401,
    INTEGRITY_DEVICE: 403,
    INTEGRITY_APP_RECOGNITION: 403,
    INTEGRITY_CERTIFICATE: 403,
    INTEGRITY_DECODE_FAILED: 502,
    GOOGLE_OAUTH_FAILED: 502,
    GOOGLE_NOT_CONFIGURED: 503
  }[error.code] || 400);
  const payload = { error: error.message || 'Requête invalide.', code: error.code || 'INTEGRITY_ERROR' };
  if (error.deviceVerdict) payload.deviceVerdict = error.deviceVerdict;
  if (error.appVerdict) payload.appVerdict = error.appVerdict;
  Kit.send(res, status, payload);
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
  const action = Kit.getAction(req, ['challenge', 'verify']);
  if (!action) {
    return Kit.send(res, 404, { error: 'Action Integrity inconnue.', code: 'NOT_FOUND' });
  }
  let body;
  try {
    body = await Kit.readJsonBody(req, 16 * 1024);
  } catch (error) {
    return Kit.send(res, error.status || 400, { error: error.message, code: error.code || 'BAD_JSON' });
  }
  try {
    if (action === 'challenge') {
      return Kit.send(res, 200, getService().challenge());
    }
    const result = await getService().verify({
      integrityToken: body.integrityToken,
      challengeToken: body.challengeToken
    });
    return Kit.send(res, 200, result);
  } catch (error) {
    return mapError(res, error);
  }
};
