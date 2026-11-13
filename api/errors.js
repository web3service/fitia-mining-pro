'use strict';

// API Ingest d'erreurs client (item 8).
// Endpoint public volontairement (le reporting ne doit jamais être bloqué),
// mais plafonné, assaini et sans donnée sensible ; voir errors-service.js.

const Kit = require('../lib/api-kit');
const ErrorsModule = require('../errors-service');

const limiter = Kit.createRateLimiter(60, 60 * 1000); // 60 rapports / min / ip

let service = null;

function getService() {
  if (!service) {
    const env = ErrorsModule.fromEnv();
    service = new ErrorsModule.ErrorService({ store: env.store, nowFn: env.now ? () => env.now : undefined });
  }
  return service;
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
  const action = Kit.getAction(req, ['ingest']);
  if (action !== 'ingest') {
    return Kit.send(res, 404, { error: 'Action inconnue.', code: 'NOT_FOUND' });
  }
  let body;
  try {
    body = await Kit.readJsonBody(req, 8 * 1024);
  } catch (error) {
    return Kit.send(res, error.status || 400, { error: error.message, code: error.code || 'BAD_JSON' });
  }
  try {
    const result = await getService().ingest({
      message: body.message,
      stack: body.stack,
      url: body.url,
      release: body.release,
      platform: body.platform,
      userAgent: req.headers['user-agent']
    });
    return Kit.send(res, 202, result);
  } catch (error) {
    if (error.code === 'ERRORS_MESSAGE') {
      return Kit.send(res, 400, { error: error.message, code: error.code });
    }
    // L'observability ne doit jamais faire échouer le client.
    return Kit.send(res, 202, { ok: true, stored: false });
  }
};
