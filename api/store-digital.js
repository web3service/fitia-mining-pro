'use strict';

const crypto = require('crypto');
const ethers = require('../vendor/ethers.umd.min.js');
const Catalog = require('../store-catalog');
const {
  DigitalError, GitHubDigitalStore, requestFingerprint, orderFromRequest,
  allocateOrder, deliveryPayload, createDownloadToken, readDownloadToken,
  decryptAsset, updateVault
} = require('../digital-inventory');

const MAX_BODY_BYTES = 32 * 1024;
const REQUIRED_CONFIRMATIONS = 3;
const PAYMENT_INTENT_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_CONTRACTS = Object.freeze({
  USDT: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
  FTA: '0x5c418b12c7e9c2a8e9a71a68c6d9b319e7b1d1fd'
});
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DEFAULT_RPCS = [
  'https://polygon-rpc.com',
  'https://polygon-bor-rpc.publicnode.com',
  'https://1rpc.io/matic'
];
const rateLimits = globalThis.__fitiaDigitalRateLimits || new Map();
globalThis.__fitiaDigitalRateLimits = rateLimits;

function setHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    try {
      const serialized = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (Buffer.byteLength(serialized) > MAX_BODY_BYTES) throw new DigitalError(413, 'La requête est trop volumineuse.', 'TOO_LARGE');
      const parsed = typeof req.body === 'string' ? JSON.parse(serialized) : req.body;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
      return Promise.resolve(parsed);
    } catch (error) {
      if (error instanceof DigitalError) return Promise.reject(error);
      return Promise.reject(new DigitalError(400, 'Le JSON est invalide.', 'JSON'));
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new DigitalError(413, 'La requête est trop volumineuse.', 'TOO_LARGE'));
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
      } catch (_) { reject(new DigitalError(400, 'Le JSON est invalide.', 'JSON')); }
    });
    req.on('error', reject);
  });
}

function getConfig() {
  const password = process.env.FITIA_ADMIN_PASSWORD || '';
  const githubToken = process.env.FITIA_GITHUB_TOKEN || '';
  if (password.length < 12 || password.length > 256 || !githubToken) {
    throw new DigitalError(503, 'La livraison numérique n’est pas configurée.', 'DIGITAL_CONFIG');
  }
  return {
    password, githubToken,
    digitalKey: process.env.FITIA_DIGITAL_VAULT_KEY || '',
    supabaseUrl: process.env.FITIA_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseServiceRoleKey: process.env.FITIA_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
    supabaseBucket: process.env.FITIA_SUPABASE_BUCKET || 'fitia-paid-private',
    owner: process.env.FITIA_ADMIN_GITHUB_OWNER || 'web3service',
    repo: process.env.FITIA_ADMIN_GITHUB_REPO || 'fitia-mining-pro',
    branch: process.env.FITIA_ADMIN_GITHUB_BRANCH || 'main',
    apiBase: 'https://api.github.com'
  };
}

function normalizeRequest(body, now = Date.now()) {
  const txHash = String(body.txHash || '').toLowerCase();
  const buyer = String(body.buyer || '').toLowerCase();
  const token = String(body.token || '').toUpperCase();
  const signature = String(body.signature || '');
  const paymentIntent = String(body.paymentIntent || '');
  const expiresAt = body.expiresAt;
  if (!/^0x[a-f0-9]{64}$/.test(txHash) || !/^0x[a-f0-9]{40}$/.test(buyer) ||
      !Object.hasOwn(TOKEN_CONTRACTS, token) || !/^0x[a-fA-F0-9]{130}$/.test(signature) ||
      paymentIntent.length < 16 || paymentIntent.length > 16384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(paymentIntent) ||
      !Number.isSafeInteger(expiresAt) || expiresAt <= now - 15000 || expiresAt > now + 20 * 60 * 1000 ||
      !Array.isArray(body.items) || !body.items.length || body.items.length > 50) {
    throw new DigitalError(400, 'La demande de livraison numérique est invalide.', 'DIGITAL_REQUEST');
  }
  const seen = new Set();
  const items = body.items.map((item) => {
    const productId = String(item?.productId || '').toLowerCase();
    const quantity = item?.quantity;
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(productId) || !Number.isSafeInteger(quantity) ||
        quantity < 1 || quantity > 99 || seen.has(productId)) {
      throw new DigitalError(400, 'Les articles de la demande sont invalides.', 'DIGITAL_REQUEST');
    }
    seen.add(productId);
    return { productId, quantity };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
  return { txHash, buyer, token, signature, paymentIntent, expiresAt, items };
}

function deliveryMessage(request) {
  return [
    'FITIA STORE — DIGITAL DELIVERY',
    `Transaction: ${request.txHash}`,
    `Buyer: ${request.buyer}`,
    `Token: ${request.token}`,
    `Intent: ${request.paymentIntent}`,
    `Items: ${request.items.map((item) => `${item.productId}:${item.quantity}`).join(',')}`,
    `Expires: ${request.expiresAt}`
  ].join('\n');
}

function verifyBuyerSignature(request) {
  let recovered;
  try { recovered = ethers.getAddress(ethers.verifyMessage(deliveryMessage(request), request.signature)).toLowerCase(); }
  catch (_) { throw new DigitalError(403, 'La signature de l’acheteur est invalide.', 'DIGITAL_BUYER_AUTH'); }
  if (recovered !== request.buyer) throw new DigitalError(403, 'Cette signature ne correspond pas à l’acheteur.', 'DIGITAL_BUYER_AUTH');
}

function checkRateLimit(req, download = false) {
  const ip = req.socket?.remoteAddress || 'vercel';
  const now = Date.now();
  const key = `${download ? 'd' : 'f'}:${ip}`;
  const current = rateLimits.get(key);
  const record = current && current.resetAt > now ? current : { count: 0, resetAt: now + 15 * 60 * 1000 };
  record.count += 1;
  rateLimits.set(key, record);
  const maximum = download ? 300 : 90;
  if (record.count > maximum) throw new DigitalError(429, 'Trop de demandes. Réessayez plus tard.', 'RATE_LIMIT');
}

function quoteFromCatalog(rawCatalog, request) {
  let manifest;
  try { manifest = Catalog.validateManifest(rawCatalog); }
  catch (_) { throw new DigitalError(503, 'Le catalogue vendeur ne permet pas de vérifier cette commande.', 'DIGITAL_CATALOG_INVALID'); }
  let quote;
  try { quote = Catalog.calculateCart(manifest.products, request.items); }
  catch (error) { throw new DigitalError(409, error.message || 'Le panier n’est plus valide.', error.code || 'DIGITAL_CART'); }
  if (quote.token !== request.token) throw new DigitalError(409, 'Le jeton signé ne correspond pas au catalogue.', 'DIGITAL_CART');
  if (!quote.items.some((item) => (item.product.type || 'physical') !== 'physical')) {
    throw new DigitalError(400, 'Cette commande ne contient aucun produit numérique.', 'DIGITAL_EMPTY');
  }
  return quote;
}

function intentHmac(encoded, key) {
  return crypto.createHmac('sha256', key).update(`fitia-store-payment-intent:${encoded}`).digest('base64url');
}

function createPaymentIntent(quote, key, now = Date.now()) {
  const payload = {
    v: 1, token: quote.token, totalUnits: quote.totalUnits.toString(),
    paymentAddress: quote.paymentAddress.toLowerCase(), sellerId: quote.sellerId,
    expiresAt: now + PAYMENT_INTENT_TTL_MS,
    items: quote.items.map((item) => ({
      productId: item.product.id, type: item.product.type || 'physical', quantity: item.quantity,
      assetId: item.product.digital?.assetId || null
    })).sort((a, b) => a.productId.localeCompare(b.productId))
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return { payload, paymentIntent: `${encoded}.${intentHmac(encoded, key)}` };
}

function readPaymentIntent(paymentIntent, key, request, now = Date.now()) {
  const [encoded, supplied, extra] = String(paymentIntent || '').split('.');
  if (!encoded || !supplied || extra) throw new DigitalError(403, 'L’intent de paiement est invalide.', 'DIGITAL_INTENT_AUTH');
  const expected = Buffer.from(intentHmac(encoded, key));
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !actual.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new DigitalError(403, 'L’intent de paiement est invalide.', 'DIGITAL_INTENT_AUTH');
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
  catch (_) { throw new DigitalError(403, 'L’intent de paiement est illisible.', 'DIGITAL_INTENT_AUTH'); }
  if (!payload || payload.v !== 1 || !Object.hasOwn(TOKEN_CONTRACTS, payload.token) ||
      !/^(0|[1-9][0-9]{0,29})$/.test(payload.totalUnits || '') || BigInt(payload.totalUnits) <= 0n ||
      !/^0x[a-f0-9]{40}$/.test(payload.paymentAddress || '') || payload.paymentAddress === Catalog.ZERO_ADDRESS ||
      !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(payload.sellerId || '') ||
      !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= now ||
      !Array.isArray(payload.items) || !payload.items.length || payload.items.length > 50 ||
      requestFingerprint(payload) !== requestFingerprint(request)) {
    throw new DigitalError(409, 'L’intent de paiement ne correspond plus à cette commande.', 'DIGITAL_INTENT_MISMATCH');
  }
  const seen = new Set();
  let hasDigital = false;
  const items = payload.items.map((item) => {
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(item.productId || '') || seen.has(item.productId) ||
        !['physical', 'download', 'license'].includes(item.type) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 ||
        (item.type === 'download' && !/^[a-f0-9]{24}$/.test(item.assetId || '')) ||
        (item.type !== 'download' && item.assetId !== null)) {
      throw new DigitalError(409, 'Le contenu de l’intent est invalide.', 'DIGITAL_INTENT_MISMATCH');
    }
    seen.add(item.productId);
    if (item.type !== 'physical') hasDigital = true;
    return {
      product: { id: item.productId, type: item.type, digital: item.type === 'download' ? { assetId: item.assetId } : undefined },
      quantity: item.quantity
    };
  });
  if (!hasDigital) throw new DigitalError(400, 'Cette commande ne contient aucun produit numérique.', 'DIGITAL_EMPTY');
  return {
    token: payload.token, totalUnits: BigInt(payload.totalUnits), paymentAddress: payload.paymentAddress,
    sellerId: payload.sellerId, items
  };
}

function assertInventoryAvailable(vault, quote) {
  quote.items.forEach((item) => {
    const type = item.product.type || 'physical';
    if (type === 'download' && !vault.assets.some((asset) => asset.id === item.product.digital?.assetId && asset.productId === item.product.id)) {
      throw new DigitalError(409, 'Un fichier numérique n’est pas disponible. Le paiement doit être bloqué.', 'DIGITAL_INVENTORY_UNAVAILABLE');
    }
    if (type === 'license') {
      const available = vault.licenses.filter((license) => license.productId === item.product.id && !license.assignedTxHash).length;
      if (available < item.quantity) throw new DigitalError(409, 'Le stock de licences est insuffisant. Le paiement doit être bloqué.', 'DIGITAL_INVENTORY_UNAVAILABLE');
    }
  });
}

async function issuePaymentIntent(req, res, config, body) {
  const token = String(body.token || '').toUpperCase();
  if (!Object.hasOwn(TOKEN_CONTRACTS, token) || !Array.isArray(body.items) || !body.items.length || body.items.length > 50) {
    throw new DigitalError(400, 'Le panier de l’intent est invalide.', 'DIGITAL_REQUEST');
  }
  const seen = new Set();
  const items = body.items.map((item) => {
    const productId = String(item?.productId || '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(productId) || seen.has(productId) ||
        !Number.isSafeInteger(item?.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new DigitalError(400, 'Le panier de l’intent est invalide.', 'DIGITAL_REQUEST');
    }
    seen.add(productId);
    return { productId, quantity: item.quantity };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
  checkRateLimit(req, false);
  const store = new GitHubDigitalStore(config);
  const [rawCatalog, { vault }] = await Promise.all([store.loadCatalog(), store.loadVault()]);
  const quote = quoteFromCatalog(rawCatalog, { token, items });
  assertInventoryAvailable(vault, quote);
  const intent = createPaymentIntent(quote, store.key);
  sendJson(res, 200, { paymentIntent: intent.paymentIntent, intent: intent.payload });
}

async function rpcCall(url, method, params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: controller.signal
    });
    if (!response.ok) throw new Error('rpc-http');
    const payload = await response.json();
    if (payload.error) throw new Error('rpc-response');
    return payload.result;
  } finally { clearTimeout(timeout); }
}

function rpcEndpoints() {
  const configured = String(process.env.FITIA_POLYGON_RPC_URL || '').trim();
  const endpoints = configured ? [configured, ...DEFAULT_RPCS] : DEFAULT_RPCS;
  return [...new Set(endpoints.filter((url) => /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[^\s]*)?$/i.test(url)))];
}

async function verifiedReceipt(txHash) {
  let lastError;
  for (const endpoint of rpcEndpoints()) {
    try {
      const receipt = await rpcCall(endpoint, 'eth_getTransactionReceipt', [txHash]);
      if (!receipt) {
        // Un autre nœud peut déjà connaître la transaction.
        continue;
      }
      const latest = await rpcCall(endpoint, 'eth_blockNumber', []);
      return { receipt, latest };
    } catch (error) { lastError = error; }
  }
  if (lastError) throw new DigitalError(503, 'Le réseau Polygon est momentanément indisponible.', 'POLYGON_UNAVAILABLE');
  throw new DigitalError(202, 'La transaction n’est pas encore visible sur Polygon.', 'PAYMENT_PENDING');
}

function topicAddress(topic) {
  return typeof topic === 'string' && /^0x[a-fA-F0-9]{64}$/.test(topic) ? `0x${topic.slice(-40).toLowerCase()}` : '';
}

async function verifyPayment(request, quote) {
  const { receipt, latest } = await verifiedReceipt(request.txHash);
  if (String(receipt.transactionHash || '').toLowerCase() !== request.txHash) {
    throw new DigitalError(409, 'La réponse Polygon ne correspond pas à la transaction.', 'PAYMENT_MISMATCH');
  }
  if (receipt.status !== '0x1') throw new DigitalError(409, 'La transaction Polygon a échoué.', 'PAYMENT_FAILED');
  const contract = TOKEN_CONTRACTS[quote.token];
  if (String(receipt.from || '').toLowerCase() !== request.buyer || String(receipt.to || '').toLowerCase() !== contract) {
    throw new DigitalError(409, 'L’expéditeur ou le contrat payé ne correspond pas à la commande.', 'PAYMENT_MISMATCH');
  }
  let paid = 0n;
  (Array.isArray(receipt.logs) ? receipt.logs : []).forEach((log) => {
    if (String(log.address || '').toLowerCase() !== contract || !Array.isArray(log.topics) || log.topics.length !== 3 ||
        String(log.topics[0]).toLowerCase() !== TRANSFER_TOPIC || topicAddress(log.topics[1]) !== request.buyer ||
        topicAddress(log.topics[2]) !== quote.paymentAddress.toLowerCase() || !/^0x[a-fA-F0-9]{64}$/.test(log.data || '')) return;
    paid += BigInt(log.data);
  });
  if (paid !== quote.totalUnits) throw new DigitalError(409, 'Le montant ou le destinataire du paiement ne correspond pas exactement au panier.', 'PAYMENT_MISMATCH');
  const confirmations = Number(BigInt(latest) - BigInt(receipt.blockNumber) + 1n);
  if (!Number.isSafeInteger(confirmations) || confirmations < REQUIRED_CONFIRMATIONS) {
    throw new DigitalError(202, `Confirmation Polygon en cours (${Math.max(0, confirmations)}/${REQUIRED_CONFIRMATIONS}).`, 'PAYMENT_CONFIRMATIONS');
  }
}

function assertOrderRequest(order, request) {
  if (order.buyer !== request.buyer || order.requestFingerprint !== requestFingerprint(request) || order.paymentIntent !== request.paymentIntent) {
    throw new DigitalError(409, 'Cette transaction est déjà associée à une autre commande.', 'DIGITAL_ORDER_CONFLICT');
  }
}

function completedPayload(vault, order, key) {
  const deliveries = deliveryPayload(vault, order).map((delivery) => {
    if (delivery.type === 'download') delivery.downloadToken = createDownloadToken(order, delivery.assetId, key);
    return delivery;
  });
  return { status: 'complete', txHash: order.txHash, deliveries };
}

async function fulfill(req, res, config) {
  const body = await readJson(req);
  if (body.action === 'intent') { await issuePaymentIntent(req, res, config, body); return; }
  const request = normalizeRequest(body);
  verifyBuyerSignature(request);
  checkRateLimit(req, false);
  const store = new GitHubDigitalStore(config);
  const initial = await store.loadVault();
  const existing = initial.vault.orders.find((order) => order.txHash === request.txHash);
  if (existing) {
    assertOrderRequest(existing, request);
    if (existing.status === 'complete') {
      sendJson(res, 200, completedPayload(initial.vault, existing, store.key));
      return;
    }
    const updated = await updateVault(store, (vault) => {
      const order = vault.orders.find((candidate) => candidate.txHash === request.txHash);
      if (!order) throw new DigitalError(409, 'La commande a changé. Réessayez.', 'CONFLICT');
      assertOrderRequest(order, request);
      return allocateOrder(vault, order);
    });
    if (updated.result.status !== 'complete') {
      sendJson(res, 202, { status: 'awaiting_inventory', code: 'DIGITAL_INVENTORY_PENDING', txHash: request.txHash });
      return;
    }
    sendJson(res, 200, completedPayload(updated.vault, updated.result, store.key));
    return;
  }

  const quote = readPaymentIntent(request.paymentIntent, store.key, request);
  await verifyPayment(request, quote);
  const updated = await updateVault(store, (vault) => {
    let order = vault.orders.find((candidate) => candidate.txHash === request.txHash);
    if (order) assertOrderRequest(order, request);
    else {
      if (vault.orders.length >= 10000) throw new DigitalError(503, 'L’historique du coffre doit être archivé avant une nouvelle vente.', 'DIGITAL_VAULT_LIMIT');
      order = orderFromRequest(request, quote);
      vault.orders.push(order);
    }
    return allocateOrder(vault, order);
  });
  if (updated.result.status !== 'complete') {
    sendJson(res, 202, { status: 'awaiting_inventory', code: 'DIGITAL_INVENTORY_PENDING', txHash: request.txHash });
    return;
  }
  sendJson(res, 200, completedPayload(updated.vault, updated.result, store.key));
}

async function download(req, res, config, token) {
  checkRateLimit(req, true);
  const store = new GitHubDigitalStore(config);
  const capability = readDownloadToken(token, store.key);
  const { vault } = await store.loadVault();
  const order = vault.orders.find((candidate) => candidate.txHash === capability.txHash && candidate.buyer === capability.buyer && candidate.status === 'complete');
  if (!order || !order.deliveries.some((delivery) => delivery.type === 'download' && delivery.assetId === capability.assetId)) {
    throw new DigitalError(403, 'Ce téléchargement n’appartient pas à cette commande.', 'DIGITAL_DOWNLOAD_AUTH');
  }
  const asset = vault.assets.find((candidate) => candidate.id === capability.assetId && order.deliveries.some((delivery) => delivery.productId === candidate.productId));
  if (!asset) throw new DigitalError(503, 'Le fichier vendu est absent du coffre.', 'DIGITAL_ASSET_MISSING');
  const encrypted = await store.readAsset(asset);
  const plaintext = decryptAsset(encrypted, store.key, asset);
  const fallback = asset.fileName.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/["\\]/g, '_');
  res.writeHead(200, {
    'Content-Type': asset.contentType,
    'Content-Length': plaintext.length,
    'Content-Disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(plaintext);
}

module.exports = async function storeDigitalHandler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Cache-Control': 'no-store' }); res.end(); return; }
  try {
    const config = getConfig();
    const url = new URL(req.url || '/', 'http://localhost');
    const downloadToken = req.query?.download || url.searchParams.get('download');
    if (req.method === 'GET' && downloadToken) { await download(req, res, config, String(downloadToken)); return; }
    if (req.method === 'POST' && !downloadToken) { await fulfill(req, res, config); return; }
    throw new DigitalError(404, 'Route de livraison numérique introuvable.', 'NOT_FOUND');
  } catch (error) {
    if (res.headersSent || res.writableEnded) return;
    if (error instanceof DigitalError) { sendJson(res, error.status, { error: error.message, code: error.code }); return; }
    console.error('Digital delivery error:', error && error.message ? error.message : 'unknown error');
    sendJson(res, 500, { error: 'Une erreur interne est survenue.', code: 'INTERNAL' });
  }
};

module.exports.deliveryMessage = deliveryMessage;
module.exports.normalizeRequest = normalizeRequest;
module.exports.verifyPayment = verifyPayment;
module.exports.createPaymentIntent = createPaymentIntent;
module.exports.readPaymentIntent = readPaymentIntent;
