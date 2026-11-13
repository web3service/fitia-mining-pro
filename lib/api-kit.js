// ═══════════════════════════════════════════════════════════════════
//  Shared helpers for the new hardening API routes (siwe/integrity/
//  push/errors). Same conventions as api/account.js:
//  - JSON body only, size-capped, strict object
//  - Security headers + Origin allowlist (no credentials cross-site)
//  - Action dispatch via ?action= or path suffix
// ═══════════════════════════════════════════════════════════════════
'use strict';

const ALLOWED_ORIGINS = new Set([
  'https://app.fitia.pro',
  'https://fitia-mining-pro.vercel.app'
]);

function setSecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Fitia-Admin-Token');
  res.setHeader('Access-Control-Max-Age', '600');
  const origin = String(req.headers.origin || '');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readJsonBody(req, maxBytes) {
  const MAX_BODY = maxBytes || 16 * 1024;
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    const error = new Error('Content-Type application/json requis.');
    error.code = 'BAD_CONTENT_TYPE';
    error.status = 415;
    throw error;
  }
  const fromObject = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    const error = new Error('JSON invalide.');
    error.code = 'BAD_JSON';
    error.status = 400;
    throw error;
  };
  if (req.body !== undefined && req.body !== null) {
    const serialized = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(serialized) > MAX_BODY) {
      const error = new Error('Requête trop volumineuse.');
      error.code = 'TOO_LARGE';
      error.status = 413;
      throw error;
    }
    try {
      return fromObject(typeof req.body === 'string' ? JSON.parse(serialized || '{}') : req.body);
    } catch (error) {
      if (error.status) throw error;
      const wrapped = new Error('JSON invalide.');
      wrapped.status = 400;
      wrapped.code = 'BAD_JSON';
      throw wrapped;
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY) {
        settled = true;
        const error = new Error('Requête trop volumineuse.');
        error.code = 'TOO_LARGE';
        error.status = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      let parsed;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      } catch (_) {
        const error = new Error('JSON invalide.');
        error.code = 'BAD_JSON';
        error.status = 400;
        reject(error);
        return;
      }
      try {
        resolve(fromObject(parsed));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', (error) => { if (!settled) { settled = true; reject(error); } });
  });
}

function getAction(req, endpoints) {
  const queryAction = req.query && req.query.action;
  if (queryAction) return String(queryAction);
  const parts = String(req.url || '').split('?')[0].split('/').filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : '';
  if (endpoints.includes(last)) return last;
  return '';
}

function handleOptions(req, res) {
  setSecurityHeaders(req, res);
  res.writeHead(204);
  res.end();
}

// Store de type rate-limit mémoire (suffisant pour une instance serverless ;
// la fenêtre anti-force-brute principale reste côté account-service).
function createRateLimiter(limit, windowMs) {
  const hits = new Map();
  return function hit(key, now = Date.now()) {
    const record = hits.get(key);
    if (!record || now - record.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return { allowed: true, remaining: limit - 1 };
    }
    record.count += 1;
    const allowed = record.count <= limit;
    return { allowed, remaining: Math.max(0, limit - record.count) };
  };
}

function getClientKey(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String(req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = {
  ALLOWED_ORIGINS,
  setSecurityHeaders,
  send,
  readJsonBody,
  getAction,
  handleOptions,
  createRateLimiter,
  getClientKey
};
