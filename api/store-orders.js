'use strict';

const { getDefaultOrderService, StoreOrderError } = require('../store-order-service');

const MAX_BODY_BYTES = 48 * 1024;

function setSecurityHeaders(res) {
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

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    try {
      const serialized = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (Buffer.byteLength(serialized) > MAX_BODY_BYTES) throw new StoreOrderError(413, 'La requête est trop volumineuse.', 'ORDER_TOO_LARGE');
      const parsed = typeof req.body === 'string' ? JSON.parse(serialized || '{}') : req.body;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
      return parsed;
    } catch (error) {
      if (error instanceof StoreOrderError) throw error;
      throw new StoreOrderError(400, 'Le JSON est invalide.', 'ORDER_JSON');
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new StoreOrderError(413, 'La requête est trop volumineuse.', 'ORDER_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
        resolve(parsed);
      } catch (_) {
        reject(new StoreOrderError(400, 'Le JSON est invalide.', 'ORDER_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function createStoreOrdersHandler(options = {}) {
  let service = options.orderService || null;
  const orders = () => {
    if (!service) service = getDefaultOrderService();
    return service;
  };

  return async function storeOrdersHandler(req, res) {
    setSecurityHeaders(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      if (req.method !== 'POST') throw new StoreOrderError(405, 'Méthode non autorisée.', 'ORDER_METHOD');
      const body = await readJson(req);
      const action = String(body.action || '');
      if (action === 'create') {
        const order = await orders().createOrder(body);
        sendJson(res, 201, { order });
        return;
      }
      if (action === 'attach') {
        const order = await orders().attachPayment(body);
        sendJson(res, order.status === 'payment_pending' ? 202 : 200, { order });
        return;
      }
      if (action === 'list') {
        sendJson(res, 200, { orders: await orders().listCustomerOrders(body) });
        return;
      }
      if (action === 'sync') {
        sendJson(res, 200, { order: await orders().syncCustomerOrder(body) });
        return;
      }
      throw new StoreOrderError(404, 'Action de commande introuvable.', 'ORDER_NOT_FOUND');
    } catch (error) {
      if (res.headersSent || res.writableEnded) return;
      if (error instanceof StoreOrderError || (Number.isSafeInteger(error.status) && error.code)) {
        sendJson(res, error.status || 500, { error: error.message, code: error.code || 'ORDER_ERROR' });
        return;
      }
      console.error('FITIA STORE order error:', error.code || 'INTERNAL');
      sendJson(res, 500, { error: 'Une erreur interne est survenue.', code: 'ORDER_INTERNAL' });
    }
  };
}

const handler = createStoreOrdersHandler();
module.exports = handler;
module.exports.createStoreOrdersHandler = createStoreOrdersHandler;
module.exports.readJson = readJson;
