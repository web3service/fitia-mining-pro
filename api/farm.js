'use strict';

const { getDefaultFarmService, FarmError } = require('../farm-service');
const MAX_BODY_BYTES = 32 * 1024;

function headers(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}
function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    try {
      const serialized = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (Buffer.byteLength(serialized) > MAX_BODY_BYTES) throw new FarmError(413, 'Requête trop volumineuse.', 'FARM_TOO_LARGE');
      const parsed = typeof req.body === 'string' ? JSON.parse(serialized || '{}') : req.body;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
      return parsed;
    } catch (error) {
      if (error instanceof FarmError) throw error;
      throw new FarmError(400, 'JSON invalide.', 'FARM_JSON');
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { reject(new FarmError(413, 'Requête trop volumineuse.', 'FARM_TOO_LARGE')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
        resolve(parsed);
      } catch (_) { reject(new FarmError(400, 'JSON invalide.', 'FARM_JSON')); }
    });
    req.on('error', reject);
  });
}
function createFarmHandler(options = {}) {
  let service = options.farmService || null;
  const farm = () => { if (!service) service = getDefaultFarmService(); return service; };
  return async function farmHandler(req, res) {
    headers(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    try {
      if (req.method !== 'POST') throw new FarmError(405, 'Méthode non autorisée.', 'FARM_METHOD');
      const body = await readJson(req);
      const action = String(body.action || '');
      if (action === 'state') { send(res, 200, await farm().getState(body)); return; }
      if (action === 'deposit') {
        const result = await farm().deposit(body);
        send(res, result.pending ? 202 : 200, result); return;
      }
      if (action === 'action') { send(res, 200, await farm().action(body)); return; }
      if (action === 'withdraw') { send(res, 200, await farm().withdraw(body)); return; }
      throw new FarmError(404, 'Action FARM introuvable.', 'FARM_NOT_FOUND');
    } catch (error) {
      if (res.headersSent || res.writableEnded) return;
      if (error instanceof FarmError || (Number.isSafeInteger(error.status) && error.code)) {
        send(res, error.status || 500, { error: error.message, code: error.code || 'FARM_ERROR' }); return;
      }
      console.error('FITIA FARM error:', error?.code || 'INTERNAL');
      send(res, 500, { error: 'Une erreur interne est survenue.', code: 'FARM_INTERNAL' });
    }
  };
}
const handler = createFarmHandler();
module.exports = handler;
module.exports.createFarmHandler = createFarmHandler;
