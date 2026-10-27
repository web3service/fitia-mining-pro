'use strict';

/*
 * FITIA STORE — coffre numérique chiffré.
 *
 * Le coffre GitHub ne contient que licences et métadonnées chiffrées. Les
 * fichiers payants, même chiffrés, sont exclusivement dans le bucket Supabase
 * privé (ou sur le disque local en développement), jamais dans GitHub. La clé
 * AES et les secrets de stockage restent strictement côté serveur.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VAULT_VERSION = 1;
const VAULT_PATH = 'digital-vault.json';
const ASSET_DIRECTORY = 'digital-assets';
const MAX_DIGITAL_FILE_BYTES = 3 * 1024 * 1024;
const MAX_DIGITAL_BODY_BYTES = 4300000;
const MAX_LICENSE_KEYS_PER_UPLOAD = 500;
const MAX_LICENSE_KEY_LENGTH = 512;
const MAX_ORDERS = 10000;
const DOWNLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;
const AAD_META = Buffer.from('fitia-store-digital-vault-v1', 'utf8');

class DigitalError extends Error {
  constructor(status, message, code = 'DIGITAL_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanFileName(value) {
  const name = String(value || '').normalize('NFKC')
    .replace(/[\\/\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 120).trim();
  if (!name || name === '.' || name === '..' || /^\.+$/.test(name)) {
    throw new DigitalError(400, 'Le nom du fichier numérique est invalide.', 'DIGITAL_FILE_NAME');
  }
  return name;
}

function cleanContentType(value) {
  const contentType = String(value || '').toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]{0,40}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,60}$/.test(contentType)) {
    throw new DigitalError(400, 'Le type du fichier numérique est invalide.', 'DIGITAL_FILE_TYPE');
  }
  return contentType;
}

function emptyVault() {
  return { version: VAULT_VERSION, assets: [], licenses: [], orders: [] };
}

function validateId(value, field = 'Identifiant') {
  const id = String(value || '');
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(id)) throw new DigitalError(400, `${field} est invalide.`, 'DIGITAL_ID');
  return id;
}

function validateVault(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== VAULT_VERSION ||
      !Array.isArray(raw.assets) || !Array.isArray(raw.licenses) || !Array.isArray(raw.orders)) {
    throw new DigitalError(503, 'Le coffre numérique est illisible.', 'DIGITAL_VAULT_INVALID');
  }
  if (raw.assets.length > 2000 || raw.licenses.length > 100000 || raw.orders.length > MAX_ORDERS) {
    throw new DigitalError(503, 'Le coffre numérique dépasse sa capacité de gestion.', 'DIGITAL_VAULT_LIMIT');
  }
  const assetIds = new Set();
  raw.assets.forEach((asset) => {
    if (!asset || typeof asset !== 'object' || !/^[a-f0-9]{24}$/.test(asset.id || '') || assetIds.has(asset.id)) {
      throw new DigitalError(503, 'Un fichier du coffre est invalide.', 'DIGITAL_VAULT_INVALID');
    }
    validateId(asset.productId, 'Le produit du fichier');
    cleanFileName(asset.fileName);
    cleanContentType(asset.contentType);
    if (!Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > MAX_DIGITAL_FILE_BYTES ||
        !/^[a-f0-9]{64}$/.test(asset.sha256 || '') || typeof asset.createdAt !== 'string') {
      throw new DigitalError(503, 'Les métadonnées du coffre sont invalides.', 'DIGITAL_VAULT_INVALID');
    }
    assetIds.add(asset.id);
  });
  const licenseIds = new Set();
  raw.licenses.forEach((license) => {
    if (!license || typeof license !== 'object' || !/^[a-f0-9]{24}$/.test(license.id || '') || licenseIds.has(license.id) ||
        typeof license.key !== 'string' || !license.key || license.key.length > MAX_LICENSE_KEY_LENGTH) {
      throw new DigitalError(503, 'Une licence du coffre est invalide.', 'DIGITAL_VAULT_INVALID');
    }
    validateId(license.productId, 'Le produit de la licence');
    if (license.assignedTxHash !== null && !/^0x[a-f0-9]{64}$/.test(license.assignedTxHash || '')) {
      throw new DigitalError(503, 'Une attribution de licence est invalide.', 'DIGITAL_VAULT_INVALID');
    }
    if (license.assignedTxHash && !/^0x[a-fA-F0-9]{40}$/.test(license.assignedBuyer || '')) {
      throw new DigitalError(503, 'Un acheteur de licence est invalide.', 'DIGITAL_VAULT_INVALID');
    }
    licenseIds.add(license.id);
  });
  const txHashes = new Set();
  raw.orders.forEach((order) => {
    if (!order || typeof order !== 'object' || !/^0x[a-f0-9]{64}$/.test(order.txHash || '') || txHashes.has(order.txHash) ||
        !/^0x[a-f0-9]{40}$/.test(order.buyer || '') || !['awaiting_inventory', 'complete'].includes(order.status) ||
        !Array.isArray(order.items) || !Array.isArray(order.deliveries) || typeof order.requestFingerprint !== 'string' ||
        typeof order.paymentIntent !== 'string' || !order.paymentIntent) {
      throw new DigitalError(503, 'Une commande du coffre est invalide.', 'DIGITAL_VAULT_INVALID');
    }
    txHashes.add(order.txHash);
  });
  return raw;
}

function deriveKey(config = {}) {
  if (config.digitalKey) {
    const supplied = String(config.digitalKey).trim();
    if (/^[a-f0-9]{64}$/i.test(supplied)) return Buffer.from(supplied, 'hex');
    const decoded = Buffer.from(supplied, 'base64');
    if (decoded.length === 32 && decoded.toString('base64').replace(/=+$/, '') === supplied.replace(/=+$/, '')) return decoded;
    throw new DigitalError(503, 'La clé du coffre numérique doit contenir 32 octets.', 'DIGITAL_KEY_CONFIG');
  }
  const password = String(config.password || '');
  if (password.length < 12 || password.length > 256) {
    throw new DigitalError(503, 'Le coffre numérique n’est pas configuré.', 'DIGITAL_KEY_CONFIG');
  }
  // Le jeton GitHub ajoute une seconde composante aléatoire en production.
  // En mode local, un domaine de dérivation distinct conserve un coffre privé.
  const secondFactor = String(config.githubToken || 'fitia-local-digital-vault');
  return crypto.createHmac('sha256', secondFactor)
    .update(`fitia-store-digital-vault-v1:${password}`).digest();
}

function encryptVault(vault, key) {
  validateVault(vault);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD_META);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(vault), 'utf8'), cipher.final()]);
  return {
    version: VAULT_VERSION,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ciphertext.toString('base64')
  };
}

function decryptVault(envelope, key) {
  if (!envelope || envelope.version !== VAULT_VERSION || envelope.algorithm !== 'aes-256-gcm' ||
      typeof envelope.iv !== 'string' || typeof envelope.tag !== 'string' || typeof envelope.data !== 'string') {
    throw new DigitalError(503, 'Le coffre numérique chiffré est invalide.', 'DIGITAL_VAULT_INVALID');
  }
  try {
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ciphertext = Buffer.from(envelope.data, 'base64');
    if (iv.length !== 12 || tag.length !== 16) throw new Error('envelope');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(AAD_META);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return validateVault(JSON.parse(plaintext));
  } catch (error) {
    if (error instanceof DigitalError) throw error;
    throw new DigitalError(503, 'Impossible de déchiffrer le coffre numérique.', 'DIGITAL_VAULT_DECRYPT');
  }
}

function assetAad(assetId, productId) {
  return Buffer.from(`fitia-store-digital-asset-v1:${assetId}:${productId}`, 'utf8');
}

function encryptAsset(buffer, key, assetId, productId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(assetAad(assetId, productId));
  return Buffer.concat([iv, cipher.update(buffer), cipher.final(), cipher.getAuthTag()]);
}

function decryptAsset(encrypted, key, asset) {
  const buffer = Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted);
  if (buffer.length < 29 || buffer.length > MAX_DIGITAL_FILE_BYTES + 28) {
    throw new DigitalError(503, 'Le fichier chiffré est invalide.', 'DIGITAL_ASSET_INVALID');
  }
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12));
    decipher.setAAD(assetAad(asset.id, asset.productId));
    decipher.setAuthTag(buffer.subarray(buffer.length - 16));
    const plaintext = Buffer.concat([
      decipher.update(buffer.subarray(12, buffer.length - 16)), decipher.final()
    ]);
    const digest = crypto.createHash('sha256').update(plaintext).digest('hex');
    if (plaintext.length !== asset.size || digest !== asset.sha256) throw new Error('integrity');
    return plaintext;
  } catch (_) {
    throw new DigitalError(503, 'Impossible de vérifier ou déchiffrer ce fichier.', 'DIGITAL_ASSET_DECRYPT');
  }
}

function normalizeBase64File(body) {
  const data = String(body.data || '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0) {
    throw new DigitalError(400, 'Le fichier numérique en base64 est invalide.', 'DIGITAL_FILE_DATA');
  }
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > MAX_DIGITAL_FILE_BYTES) {
    throw new DigitalError(413, 'Le fichier doit contenir entre 1 octet et 3 Mo.', 'DIGITAL_FILE_SIZE');
  }
  if (buffer.toString('base64') !== data) throw new DigitalError(400, 'Le fichier base64 n’est pas canonique.', 'DIGITAL_FILE_DATA');
  return buffer;
}

function createAsset(vault, body, key) {
  const productId = validateId(body.productId, 'Le produit');
  const buffer = normalizeBase64File(body);
  const asset = {
    id: crypto.randomBytes(12).toString('hex'), productId,
    fileName: cleanFileName(body.fileName), contentType: cleanContentType(body.contentType),
    size: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    createdAt: new Date().toISOString()
  };
  vault.assets.push(asset);
  return { asset, encrypted: encryptAsset(buffer, key, asset.id, productId) };
}

function normalizeLicenseKeys(values) {
  if (!Array.isArray(values) || !values.length || values.length > MAX_LICENSE_KEYS_PER_UPLOAD) {
    throw new DigitalError(400, 'Ajoutez entre 1 et 500 clés de licence.', 'DIGITAL_LICENSE_COUNT');
  }
  const seen = new Set();
  return values.map((value) => {
    const key = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (!key || key.length > MAX_LICENSE_KEY_LENGTH) {
      throw new DigitalError(400, 'Chaque licence doit contenir entre 1 et 512 caractères.', 'DIGITAL_LICENSE_KEY');
    }
    if (seen.has(key)) throw new DigitalError(400, 'Une licence est dupliquée dans cet import.', 'DIGITAL_LICENSE_DUPLICATE');
    seen.add(key);
    return key;
  });
}

function addLicenses(vault, body) {
  const productId = validateId(body.productId, 'Le produit');
  const keys = normalizeLicenseKeys(body.keys);
  const existing = new Set(vault.licenses.map((entry) => `${entry.productId}\u0000${entry.key}`));
  keys.forEach((key) => {
    if (existing.has(`${productId}\u0000${key}`)) {
      throw new DigitalError(409, 'Une licence existe déjà pour ce produit.', 'DIGITAL_LICENSE_DUPLICATE');
    }
  });
  const now = new Date().toISOString();
  keys.forEach((key) => vault.licenses.push({
    id: crypto.randomBytes(12).toString('hex'), productId, key,
    assignedTxHash: null, assignedBuyer: null, createdAt: now
  }));
  return keys.length;
}

function summarize(vault) {
  const products = {};
  vault.assets.forEach((asset) => {
    const summary = products[asset.productId] || { productId: asset.productId, downloads: [], availableLicenses: 0, assignedLicenses: 0 };
    summary.downloads.push({ id: asset.id, fileName: asset.fileName, contentType: asset.contentType, size: asset.size, sha256: asset.sha256 });
    products[asset.productId] = summary;
  });
  vault.licenses.forEach((license) => {
    const summary = products[license.productId] || { productId: license.productId, downloads: [], availableLicenses: 0, assignedLicenses: 0 };
    if (license.assignedTxHash) summary.assignedLicenses += 1;
    else summary.availableLicenses += 1;
    products[license.productId] = summary;
  });
  return {
    products: Object.values(products),
    awaitingInventory: vault.orders.filter((order) => order.status === 'awaiting_inventory').length,
    completedOrders: vault.orders.filter((order) => order.status === 'complete').length
  };
}

function requestFingerprint(request) {
  return JSON.stringify({
    token: request.token,
    items: request.items.map((item) => [item.productId, item.quantity]).sort((a, b) => a[0].localeCompare(b[0]))
  });
}

function orderFromRequest(request, quote) {
  return {
    txHash: request.txHash,
    buyer: request.buyer.toLowerCase(),
    token: quote.token,
    totalUnits: quote.totalUnits.toString(),
    paymentAddress: quote.paymentAddress.toLowerCase(),
    paymentIntent: request.paymentIntent,
    requestFingerprint: requestFingerprint(request),
    createdAt: new Date().toISOString(),
    status: 'awaiting_inventory',
    items: quote.items.map((item) => ({
      productId: item.product.id,
      type: item.product.type || 'physical',
      quantity: item.quantity,
      assetId: item.product.digital?.assetId || null
    })),
    deliveries: []
  };
}

function allocateOrder(vault, order) {
  if (order.status === 'complete') return order;
  const digitalItems = order.items.filter((item) => item.type === 'download' || item.type === 'license');
  const ready = digitalItems.every((item) => {
    if (item.type === 'download') return vault.assets.some((asset) => asset.id === item.assetId && asset.productId === item.productId);
    const available = vault.licenses.filter((license) => license.productId === item.productId && !license.assignedTxHash).length;
    return available >= item.quantity;
  });
  if (!ready) return order;

  const deliveries = [];
  digitalItems.forEach((item) => {
    if (item.type === 'download') {
      const asset = vault.assets.find((candidate) => candidate.id === item.assetId && candidate.productId === item.productId);
      deliveries.push({ type: 'download', productId: item.productId, assetId: asset.id });
      return;
    }
    const available = vault.licenses.filter((license) => license.productId === item.productId && !license.assignedTxHash);
    available.slice(0, item.quantity).forEach((license) => {
      license.assignedTxHash = order.txHash;
      license.assignedBuyer = order.buyer;
      license.assignedAt = new Date().toISOString();
      deliveries.push({ type: 'license', productId: item.productId, licenseId: license.id, key: license.key });
    });
  });
  order.deliveries = deliveries;
  order.status = 'complete';
  order.completedAt = new Date().toISOString();
  return order;
}

function deliveryPayload(vault, order) {
  return order.deliveries.map((delivery) => {
    if (delivery.type === 'license') return { type: 'license', productId: delivery.productId, key: delivery.key };
    const asset = vault.assets.find((candidate) => candidate.id === delivery.assetId && candidate.productId === delivery.productId);
    if (!asset) throw new DigitalError(503, 'Un fichier déjà vendu est absent du coffre.', 'DIGITAL_ASSET_MISSING');
    return {
      type: 'download', productId: delivery.productId, assetId: asset.id,
      fileName: asset.fileName, contentType: asset.contentType, size: asset.size, sha256: asset.sha256
    };
  });
}

function signToken(payload, key) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', key).update(`fitia-download:${encoded}`).digest('base64url');
  return `${encoded}.${signature}`;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function createDownloadToken(order, assetId, key, now = Date.now()) {
  return signToken({
    txHash: order.txHash, buyer: order.buyer, assetId,
    expiresAt: now + DOWNLOAD_TOKEN_TTL_MS
  }, key);
}

function readDownloadToken(token, key, now = Date.now()) {
  const [encoded, signature, extra] = String(token || '').split('.');
  if (!encoded || !signature || extra || !safeEqual(signature, crypto.createHmac('sha256', key).update(`fitia-download:${encoded}`).digest('base64url'))) {
    throw new DigitalError(403, 'Ce lien de téléchargement est invalide.', 'DIGITAL_DOWNLOAD_AUTH');
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!/^0x[a-f0-9]{64}$/.test(payload.txHash || '') || !/^0x[a-f0-9]{40}$/.test(payload.buyer || '') ||
        !/^[a-f0-9]{24}$/.test(payload.assetId || '') || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= now) {
      throw new Error('token');
    }
    return payload;
  } catch (_) {
    throw new DigitalError(403, 'Ce lien de téléchargement est invalide ou expiré.', 'DIGITAL_DOWNLOAD_AUTH');
  }
}

async function updateVault(store, mutator, attempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const loaded = await store.loadVault();
      const result = await mutator(loaded.vault);
      const revision = await store.saveVault(loaded.vault, loaded.revision);
      return { vault: loaded.vault, result, revision };
    } catch (error) {
      lastError = error;
      if (error?.code !== 'CONFLICT' && error?.status !== 409) throw error;
    }
  }
  throw lastError || new DigitalError(409, 'Le coffre a changé. Réessayez.', 'CONFLICT');
}

class SupabaseDigitalAssetStorage {
  constructor(config = {}, fetchImpl = global.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
  }

  settings() {
    let parsed;
    try { parsed = new URL(String(this.config.supabaseUrl || '')); }
    catch (_) { throw new DigitalError(503, 'Le stockage externe des fichiers payants n’est pas configuré.', 'DIGITAL_ASSET_CONFIG'); }
    const serviceKey = String(this.config.supabaseServiceRoleKey || '').trim();
    const bucket = String(this.config.supabaseBucket || 'fitia-paid-private');
    if (parsed.protocol !== 'https:' || !/^[a-z0-9][a-z0-9-]{2,63}\.supabase\.co$/i.test(parsed.hostname) ||
        parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname) ||
        !/^[a-z0-9][a-z0-9-]{0,62}$/.test(bucket) || !/^[A-Za-z0-9._~-]{40,4096}$/.test(serviceKey)) {
      throw new DigitalError(503, 'Le stockage externe privé est absent ou invalide. Aucun fichier ne sera envoyé vers GitHub.', 'DIGITAL_ASSET_CONFIG');
    }
    return { origin: parsed.origin, serviceKey, bucket };
  }

  status() {
    try { this.settings(); return { provider: 'supabase', configured: true }; }
    catch (_) { return { provider: 'supabase', configured: false }; }
  }

  target(asset, authenticated = false) {
    if (!asset || !/^[a-f0-9]{24}$/.test(asset.id || '')) {
      throw new DigitalError(503, 'Le fichier externe est invalide.', 'DIGITAL_ASSET_INVALID');
    }
    const { origin, bucket } = this.settings();
    const prefix = authenticated ? 'object/authenticated' : 'object';
    return `${origin}/storage/v1/${prefix}/${encodeURIComponent(bucket)}/paid/${asset.id}.bin`;
  }

  async request(url, init = {}) {
    const { serviceKey } = this.settings();
    try {
      return await this.fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          ...(init.headers || {})
        }
      });
    } catch (_) {
      throw new DigitalError(503, 'Le stockage externe privé est momentanément indisponible.', 'DIGITAL_ASSET_STORAGE_UNAVAILABLE');
    }
  }

  async writeAsset(asset, encrypted) {
    const buffer = Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted);
    if (buffer.length < 29 || buffer.length > MAX_DIGITAL_FILE_BYTES + 28) {
      throw new DigitalError(400, 'Le ciphertext externe est invalide.', 'DIGITAL_ASSET_INVALID');
    }
    const response = await this.request(this.target(asset), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' },
      body: buffer
    });
    if (response.status === 409) throw new DigitalError(409, 'Le fichier externe existe déjà.', 'CONFLICT');
    if (!response.ok) throw new DigitalError(503, 'Le stockage externe privé a refusé le fichier.', 'DIGITAL_ASSET_STORAGE_WRITE');
    return `supabase://paid/${asset.id}.bin`;
  }

  async readAsset(asset) {
    const response = await this.request(this.target(asset, true));
    if (!response.ok) throw new DigitalError(503, 'Le fichier payant est absent du stockage externe privé.', 'DIGITAL_ASSET_MISSING');
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_DIGITAL_FILE_BYTES + 28) throw new DigitalError(503, 'Le fichier externe dépasse la limite autorisée.', 'DIGITAL_ASSET_INVALID');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_DIGITAL_FILE_BYTES + 28) throw new DigitalError(503, 'Le fichier externe dépasse la limite autorisée.', 'DIGITAL_ASSET_INVALID');
    return buffer;
  }
}

class GitHubDigitalStore {
  constructor(config, fetchImpl = global.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
    this.key = deriveKey(config);
    this.apiBase = String(config.apiBase || 'https://api.github.com').replace(/\/$/, '');
    this.assets = new SupabaseDigitalAssetStorage(config, fetchImpl);
  }

  assetStorageStatus() {
    return this.assets.status();
  }

  url(target, ref = false) {
    const suffix = target.split('/').map(encodeURIComponent).join('/');
    return `${this.apiBase}/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/contents/${suffix}${ref ? `?ref=${encodeURIComponent(this.config.branch)}` : ''}`;
  }

  async request(url, init = {}) {
    let response;
    try {
      response = await this.fetch(url, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.config.githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'FITIA-STORE-Digital-Vault',
          ...(init.headers || {})
        }
      });
    } catch (_) {
      throw new DigitalError(503, 'Le stockage numérique est momentanément indisponible.', 'DIGITAL_STORAGE_UNAVAILABLE');
    }
    return response;
  }

  async loadVault() {
    const response = await this.request(this.url(VAULT_PATH, true));
    if (response.status === 404) return { vault: emptyVault(), revision: null };
    if (!response.ok) throw new DigitalError(503, 'Impossible de lire le coffre numérique.', 'DIGITAL_STORAGE_READ');
    const metadata = await response.json();
    if (!metadata.sha) throw new DigitalError(503, 'La révision du coffre est absente.', 'DIGITAL_STORAGE_READ');
    let envelope;
    if (metadata.encoding === 'base64' && metadata.content) {
      envelope = JSON.parse(Buffer.from(metadata.content, 'base64').toString('utf8'));
    } else {
      const rawResponse = await this.request(this.url(VAULT_PATH, true), { headers: { Accept: 'application/vnd.github.raw+json' } });
      if (!rawResponse.ok) throw new DigitalError(503, 'Impossible de lire le coffre numérique.', 'DIGITAL_STORAGE_READ');
      envelope = JSON.parse(await rawResponse.text());
    }
    return { vault: decryptVault(envelope, this.key), revision: String(metadata.sha) };
  }

  async saveVault(vault, revision) {
    const serialized = `${JSON.stringify(encryptVault(vault, this.key), null, 2)}\n`;
    const body = {
      message: 'Update encrypted FITIA STORE digital inventory',
      content: Buffer.from(serialized, 'utf8').toString('base64'), branch: this.config.branch
    };
    if (revision) body.sha = revision;
    const response = await this.request(this.url(VAULT_PATH), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (response.status === 409 || response.status === 422) throw new DigitalError(409, 'Le coffre a changé ailleurs.', 'CONFLICT');
    if (!response.ok) throw new DigitalError(503, 'L’enregistrement du coffre numérique a été refusé.', 'DIGITAL_STORAGE_WRITE');
    const result = await response.json();
    return result.content?.sha ? String(result.content.sha) : revision;
  }

  async writeAsset(asset, encrypted) {
    // Aucun fallback GitHub : les octets payants, même chiffrés, restent externes.
    return this.assets.writeAsset(asset, encrypted);
  }

  async readAsset(asset) {
    return this.assets.readAsset(asset);
  }

  async loadCatalog() {
    const response = await this.request(this.url('store-products.json', true));
    if (!response.ok) throw new DigitalError(503, 'Impossible de relire le catalogue vendeur.', 'DIGITAL_CATALOG_READ');
    const data = await response.json();
    if (!data.content || data.encoding !== 'base64') throw new DigitalError(503, 'Le catalogue vendeur est illisible.', 'DIGITAL_CATALOG_READ');
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  }
}

class LocalDigitalStore {
  constructor(options = {}) {
    this.root = path.resolve(options.root || process.cwd());
    this.vaultFile = path.resolve(options.vaultFile || path.join(this.root, VAULT_PATH));
    this.assetDirectory = path.resolve(options.assetDirectory || path.join(this.root, ASSET_DIRECTORY));
    this.catalogFile = path.resolve(options.catalogFile || path.join(this.root, 'store-products.json'));
    this.key = deriveKey(options);
  }

  assetStorageStatus() {
    return { provider: 'local', configured: true };
  }

  async loadVault() {
    try {
      const serialized = await fs.promises.readFile(this.vaultFile, 'utf8');
      const revision = crypto.createHash('sha256').update(serialized).digest('hex');
      return { vault: decryptVault(JSON.parse(serialized), this.key), revision };
    } catch (error) {
      if (error.code === 'ENOENT') return { vault: emptyVault(), revision: null };
      if (error instanceof DigitalError) throw error;
      throw new DigitalError(503, 'Impossible de lire le coffre numérique local.', 'DIGITAL_STORAGE_READ');
    }
  }

  async saveVault(vault, revision) {
    if (revision) {
      const current = await fs.promises.readFile(this.vaultFile, 'utf8').catch(() => '');
      if (crypto.createHash('sha256').update(current).digest('hex') !== revision) throw new DigitalError(409, 'Le coffre local a changé.', 'CONFLICT');
    } else if (fs.existsSync(this.vaultFile)) throw new DigitalError(409, 'Le coffre local a changé.', 'CONFLICT');
    await fs.promises.mkdir(path.dirname(this.vaultFile), { recursive: true });
    const serialized = `${JSON.stringify(encryptVault(vault, this.key), null, 2)}\n`;
    const temporary = `${this.vaultFile}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporary, serialized, { mode: 0o600 });
    await fs.promises.rename(temporary, this.vaultFile);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  async writeAsset(asset, encrypted) {
    await fs.promises.mkdir(this.assetDirectory, { recursive: true, mode: 0o700 });
    const target = path.join(this.assetDirectory, `${asset.id}.bin`);
    await fs.promises.writeFile(target, encrypted, { flag: 'wx', mode: 0o600 });
    return target;
  }

  async readAsset(asset) {
    try { return await fs.promises.readFile(path.join(this.assetDirectory, `${asset.id}.bin`)); }
    catch (_) { throw new DigitalError(503, 'Le fichier chiffré local est absent.', 'DIGITAL_ASSET_MISSING'); }
  }

  async loadCatalog() {
    return JSON.parse(await fs.promises.readFile(this.catalogFile, 'utf8'));
  }
}

module.exports = {
  VAULT_PATH, ASSET_DIRECTORY, MAX_DIGITAL_FILE_BYTES, MAX_DIGITAL_BODY_BYTES,
  MAX_LICENSE_KEYS_PER_UPLOAD, MAX_LICENSE_KEY_LENGTH, DOWNLOAD_TOKEN_TTL_MS,
  DigitalError, emptyVault, validateVault, deriveKey, encryptVault, decryptVault,
  encryptAsset, decryptAsset, normalizeBase64File, createAsset, addLicenses,
  summarize, requestFingerprint, orderFromRequest, allocateOrder, deliveryPayload,
  createDownloadToken, readDownloadToken, updateVault, SupabaseDigitalAssetStorage,
  GitHubDigitalStore, LocalDigitalStore,
  cleanFileName, cleanContentType, clone
};
