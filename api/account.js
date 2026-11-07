'use strict';

const { AccountError, getDefaultAccountService } = require('../account-service');
const RequestSecurity = require('../request-security');

const MAX_BODY_BYTES = 16 * 1024;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const MAX_AUTH_FAILURES = 5;
const ALLOWED_ORIGINS = new Set([
  'https://app.fitia.pro',
  'https://fitia-mining-pro.vercel.app'
]);
const ACTIONS = new Set(['signup', 'login', 'refresh', 'session', 'logout', 'challenge', 'link', 'profile', 'email', 'password', 'mfa-status', 'mfa-begin', 'mfa-confirm', 'mfa-disable', 'mfa-verify']);

function setHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
  const origin = String(req.headers.origin || '');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

async function readJson(req) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('application/json')) throw new AccountError(415, 'Content-Type application/json requis.', 'ACCOUNT_CONTENT_TYPE');
  if (req.body !== undefined && req.body !== null) {
    try {
      const serialized = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (Buffer.byteLength(serialized) > MAX_BODY_BYTES) throw new AccountError(413, 'Requête trop volumineuse.', 'ACCOUNT_TOO_LARGE');
      const parsed = typeof req.body === 'string' ? JSON.parse(serialized || '{}') : req.body;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
      return parsed;
    } catch (error) {
      if (error instanceof AccountError) throw error;
      throw new AccountError(400, 'JSON invalide.', 'ACCOUNT_JSON');
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        reject(new AccountError(413, 'Requête trop volumineuse.', 'ACCOUNT_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
        resolve(parsed);
      } catch (_) { reject(new AccountError(400, 'JSON invalide.', 'ACCOUNT_JSON')); }
    });
    req.on('error', (error) => { if (!settled) reject(error); });
  });
}

function getAction(req) {
  const queryAction = req.query && req.query.action;
  if (queryAction) return String(queryAction);
  const parts = String(req.url || '').split('?')[0].split('/').filter(Boolean);
  return parts[parts.length - 1] === 'account' ? '' : parts[parts.length - 1] || '';
}

function getAccessToken(req) {
  const value = String(req.headers.authorization || '');
  const match = value.match(/^Bearer ([A-Za-z0-9._~+\/-]{20,4096})$/);
  if (!match) throw new AccountError(401, 'Session de compte requise.', 'ACCOUNT_AUTH');
  return match[1];
}

function createAccountHandler(options = {}) {
  let service = options.accountService || null;
  const mfa = () => {
    if (options.mfaController) return options.mfaController;
    const configured = require('../mfa/default-service');
    return configured.enabled() ? configured.getDefaultMfa().controller : null;
  };
  const failures = options.failures || new Map();
  const inFlight = new Map();
  // Hors Vercel, un proxy ne doit être approuvé que par configuration explicite.
  const trustProxy = options.trustProxy === true || (options.trustProxy !== false && process.env.VERCEL === '1');
  const account = () => {
    if (!service) service = getDefaultAccountService();
    return service;
  };

  function checkRateLimit(req) {
    const key = RequestSecurity.getClientKey(req, trustProxy);
    const record = RequestSecurity.getLoginFailure(failures, key, Date.now());
    if (record && record.count >= MAX_AUTH_FAILURES) {
      throw new AccountError(429, 'Trop de tentatives. Réessayez dans quelques minutes.', 'ACCOUNT_RATE_LIMIT');
    }
    return key;
  }

  async function withAuthRateLimit(req, operation) {
    const key = checkRateLimit(req);
    const active = inFlight.get(key) || 0;
    if (active >= MAX_AUTH_FAILURES || (!active && inFlight.size >= RequestSecurity.MAX_LOGIN_TRACKERS)) {
      throw new AccountError(429, 'Trop de tentatives simultanées. Réessayez plus tard.', 'ACCOUNT_RATE_LIMIT');
    }
    inFlight.set(key, active + 1);
    try {
      const result = await operation();
      // Une connexion réussie à un autre compte ne remet pas à zéro les
      // échecs de cette adresse pendant la fenêtre anti-force-brute.
      return result;
    } catch (error) {
      if (error.code === 'ACCOUNT_LOGIN' || error.code === 'ACCOUNT_REAUTH') {
        const record = RequestSecurity.recordLoginFailure(failures, key, Date.now(), AUTH_WINDOW_MS);
        if (record.count >= MAX_AUTH_FAILURES) throw new AccountError(429, 'Trop de tentatives. Réessayez dans quelques minutes.', 'ACCOUNT_RATE_LIMIT');
      }
      throw error;
    } finally {
      const remaining = (inFlight.get(key) || 1) - 1;
      if (remaining > 0) inFlight.set(key, remaining); else inFlight.delete(key);
    }
  }

  return async function accountHandler(req, res) {
    setHeaders(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    try {
      const origin = String(req.headers.origin || '');
      if (origin && !ALLOWED_ORIGINS.has(origin)) throw new AccountError(403, 'Origine non autorisée.', 'ACCOUNT_ORIGIN');
      const action = getAction(req);
      if (!ACTIONS.has(action)) throw new AccountError(404, 'Action de compte introuvable.', 'ACCOUNT_NOT_FOUND');
      // MFA remains inaccessible in production until operation enforcement is
      // complete and the feature flag is explicitly enabled; tests may inject one.
      if (action.startsWith('mfa-') && !mfa()) throw new AccountError(404, 'Action de compte introuvable.', 'ACCOUNT_NOT_FOUND');
      if (action === 'mfa-status') {
        if (req.method !== 'GET') throw new AccountError(405, 'Méthode non autorisée.', 'ACCOUNT_METHOD');
        send(res, 200, await mfa().status(getAccessToken(req)));
        return;
      }
      if (action === 'session') {
        if (req.method !== 'GET') throw new AccountError(405, 'Méthode non autorisée.', 'ACCOUNT_METHOD');
        send(res, 200, await account().session(getAccessToken(req)));
        return;
      }
      if (req.method !== 'POST') throw new AccountError(405, 'Méthode non autorisée.', 'ACCOUNT_METHOD');
      const body = await readJson(req);
      if (action === 'mfa-begin') {
        send(res, 200, await withAuthRateLimit(req, () => mfa().begin(getAccessToken(req), body.currentPassword))); return;
      }
      if (action === 'mfa-verify') { send(res, 200, await mfa().verifyOperation(getAccessToken(req), body.wallet, body.code)); return; }
      if (action === 'mfa-confirm') { send(res, 200, await mfa().confirm(getAccessToken(req), body.code)); return; }
      if (action === 'mfa-disable') {
        send(res, 200, await withAuthRateLimit(req, () => mfa().disable(getAccessToken(req), body.currentPassword, body.code))); return;
      }
      if (action === 'signup') {
        send(res, 201, await account().signUp(body));
        return;
      }
      if (action === 'login') {
        send(res, 200, await withAuthRateLimit(req, () => account().signIn(body)));
        return;
      }
      if (action === 'refresh') { send(res, 200, await account().refresh(body)); return; }
      if (action === 'logout') { send(res, 200, await account().logout(getAccessToken(req))); return; }
      if (action === 'challenge') { send(res, 201, await account().createLinkChallenge(getAccessToken(req), body)); return; }
      if (action === 'link') { send(res, 200, await account().linkWallet(getAccessToken(req), body)); return; }
      if (action === 'profile') { send(res, 200, await account().updateProfile(getAccessToken(req), body)); return; }
      if (action === 'email') {
        send(res, 200, await withAuthRateLimit(req, () => account().changeEmail(getAccessToken(req), body)));
        return;
      }
      if (action === 'password') {
        send(res, 200, await withAuthRateLimit(req, () => account().changePassword(getAccessToken(req), body)));
        return;
      }
    } catch (error) {
      if (res.headersSent || res.writableEnded) return;
      if (error instanceof AccountError || (Number.isSafeInteger(error.status) && error.code)) {
        send(res, error.status || 500, { error: error.message, code: error.code || 'ACCOUNT_ERROR' });
        return;
      }
      // Ne jamais journaliser le corps Auth, les jetons ou les mots de passe.
      console.error('FITIA account error:', error?.code || 'INTERNAL');
      send(res, 500, { error: 'Une erreur interne est survenue.', code: 'ACCOUNT_INTERNAL' });
    }
  };
}

const handler = createAccountHandler();
module.exports = handler;
module.exports.createAccountHandler = createAccountHandler;
module.exports.readJson = readJson;
