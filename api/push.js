'use strict';

// API Push / FCM HTTP v1 (item 5).
// - register / unregister : publics (jeton FCM de l'appareil, validé).
// - send : réservé aux opérateurs via x-fitia-admin-token == PUSH_ADMIN_TOKEN
//   (comparaison à temps constant ; sans PUSH_ADMIN_TOKEN configuré, 503).

const Kit = require('../lib/api-kit');
const PushModule = require('../push-service');

const limiter = Kit.createRateLimiter(20, 10 * 60 * 1000); // 20 req / 10 min / ip

let service = null;

function getService() {
  if (!service) {
    const env = PushModule.fromEnv();
    service = new PushModule.PushService({
      credentials: env.credentials,
      projectId: env.projectId,
      adminToken: env.adminToken,
      store: env.store,
      fetchImpl: env.fetchImpl,
      nowFn: env.now ? () => env.now : undefined
    });
  }
  return service;
}

function mapError(res, error) {
  const status = error.status || ({
    PUSH_NOT_CONFIGURED: 503,
    PUSH_PAYLOAD: 400,
    PUSH_TOKEN: 400,
    PUSH_STORE: 503,
    PUSH_FETCH_MISSING: 503,
    GOOGLE_OAUTH_FAILED: 502,
    GOOGLE_NOT_CONFIGURED: 503
  }[error.code] || 400);
  Kit.send(res, status, { error: error.message || 'Requête invalide.', code: error.code || 'PUSH_ERROR' });
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
  const action = Kit.getAction(req, ['register', 'unregister', 'send']);
  if (!action) {
    return Kit.send(res, 404, { error: 'Action Push inconnue.', code: 'NOT_FOUND' });
  }
  let body;
  try {
    body = await Kit.readJsonBody(req, 32 * 1024);
  } catch (error) {
    return Kit.send(res, error.status || 400, { error: error.message, code: error.code || 'BAD_JSON' });
  }
  try {
    if (action === 'register') {
      return Kit.send(res, 200, await getService().register({ token: body.token, platform: body.platform }));
    }
    if (action === 'unregister') {
      return Kit.send(res, 200, await getService().unregister({ token: body.token }));
    }
    // action === 'send' : réservé aux opérateurs.
    const cfg = PushModule.fromEnv();
    if (!cfg.adminToken) {
      return Kit.send(res, 503, { error: 'Envoi non configuré (PUSH_ADMIN_TOKEN).', code: 'PUSH_NOT_CONFIGURED' });
    }
    if (!PushModule.assertAdminToken(req.headers['x-fitia-admin-token'], cfg.adminToken)) {
      return Kit.send(res, 401, { error: 'Jeton opérateur invalide.', code: 'PUSH_ADMIN' });
    }
    const result = await getService().send({
      tokens: Array.isArray(body.tokens) ? body.tokens : undefined,
      title: body.title,
      body: body.body,
      data: body.data
    });
    return Kit.send(res, 200, result);
  } catch (error) {
    return mapError(res, error);
  }
};
