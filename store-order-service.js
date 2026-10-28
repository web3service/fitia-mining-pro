'use strict';

const crypto = require('crypto');
const ethers = require('./vendor/ethers.umd.min.js');
const Catalog = require('./store-catalog');
const Protocol = require('./store-order-protocol');

const ORDER_STATUSES = ['awaiting_payment', 'payment_pending', 'paid', 'preparing', 'shipped', 'delivered'];
const VISIBLE_STATUSES = ['paid', 'preparing', 'shipped', 'delivered'];
const TOKEN_CONTRACTS = Object.freeze({
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  FTA: '0x5c418b12c7e9c2a8e9a71a68c6d9b319e7b1d1fd'
});
const DEFAULT_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://polygon.drpc.org',
  'https://1rpc.io/matic',
  'https://polygon-rpc.com'
];
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

class StoreOrderError extends Error {
  constructor(status, message, code = 'ORDER_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso() { return new Date().toISOString(); }
function assertOrder(order) {
  if (!order) throw new StoreOrderError(404, 'Commande introuvable.', 'ORDER_NOT_FOUND');
  return order;
}

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderNumber: row.order_number,
    createHash: row.create_hash,
    buyerAddress: row.buyer_address,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    sellerContact: row.seller_contact,
    paymentAddress: row.payment_address,
    token: row.token,
    total: row.total,
    totalUnits: row.total_units,
    items: row.items,
    privateCiphertext: row.private_ciphertext,
    txHash: row.tx_hash,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
    expiresAt: row.expires_at
  };
}

function toRow(order) {
  return {
    id: order.id,
    order_number: order.orderNumber,
    create_hash: order.createHash,
    buyer_address: order.buyerAddress,
    seller_id: order.sellerId,
    seller_name: order.sellerName,
    seller_contact: order.sellerContact,
    payment_address: order.paymentAddress,
    token: order.token,
    total: order.total,
    total_units: order.totalUnits,
    items: order.items,
    private_ciphertext: order.privateCiphertext,
    tx_hash: order.txHash,
    status: order.status,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    paid_at: order.paidAt,
    expires_at: order.expiresAt
  };
}

function patchRow(patch) {
  const row = {};
  if (patch.txHash !== undefined) row.tx_hash = patch.txHash;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.updatedAt !== undefined) row.updated_at = patch.updatedAt;
  if (patch.paidAt !== undefined) row.paid_at = patch.paidAt;
  if (patch.privateCiphertext !== undefined) row.private_ciphertext = patch.privateCiphertext;
  return row;
}

class MemoryOrderRepository {
  constructor() { this.orders = new Map(); }
  async getById(id) { const order = this.orders.get(id); return order ? clone(order) : null; }
  async getByTxHash(txHash) {
    const order = Array.from(this.orders.values()).find((item) => item.txHash === txHash);
    return order ? clone(order) : null;
  }
  async create(order) {
    if (this.orders.has(order.id) || (order.txHash && await this.getByTxHash(order.txHash))) {
      throw new StoreOrderError(409, 'La commande existe déjà.', 'ORDER_CONFLICT');
    }
    this.orders.set(order.id, clone(order));
    return clone(order);
  }
  async update(id, patch) {
    const current = assertOrder(this.orders.get(id));
    if (patch.txHash) {
      const used = await this.getByTxHash(patch.txHash);
      if (used && used.id !== id) throw new StoreOrderError(409, 'Cette transaction est déjà utilisée.', 'ORDER_TX_USED');
    }
    const next = { ...current, ...clone(patch) };
    this.orders.set(id, next);
    return clone(next);
  }
  async listForBuyer(buyerAddress) {
    return Array.from(this.orders.values())
      .filter((order) => order.buyerAddress === buyerAddress && order.status !== 'awaiting_payment')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30).map(clone);
  }
  async listForAdmin() {
    return Array.from(this.orders.values()).filter((order) => VISIBLE_STATUSES.includes(order.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100).map(clone);
  }
  async deleteExpired(now) {
    for (const [id, order] of this.orders) {
      if (order.status === 'awaiting_payment' && Date.parse(order.expiresAt) <= Date.parse(now)) this.orders.delete(id);
    }
  }
}

function getSupabaseConfig() {
  const url = String(process.env.FITIA_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.FITIA_SUPABASE_SERVICE_ROLE_KEY || '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || key.length < 20) {
    throw new StoreOrderError(503, 'Le service privé de commandes doit être configuré.', 'ORDER_CONFIG');
  }
  return { url, key };
}

class SupabaseOrderRepository {
  constructor(config) { this.config = config || getSupabaseConfig(); }

  async request(method, query = '', body, prefer = 'return=representation') {
    let response;
    try {
      const headers = {
        apikey: this.config.key,
        Accept: 'application/json',
        Prefer: prefer
      };
      if (!this.config.key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${this.config.key}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      response = await fetch(`${this.config.url}/rest/v1/store_orders${query}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store',
        signal: AbortSignal.timeout(12000)
      });
    } catch (_) {
      throw new StoreOrderError(503, 'La base privée de commandes est indisponible.', 'ORDER_STORAGE');
    }
    if (!response.ok) {
      throw new StoreOrderError(response.status === 409 ? 409 : 503, 'La base privée de commandes a refusé la requête.', response.status === 409 ? 'ORDER_CONFLICT' : 'ORDER_STORAGE');
    }
    if (prefer === 'return=minimal' || response.status === 204) return null;
    try { return await response.json(); }
    catch (_) { throw new StoreOrderError(503, 'La base privée a renvoyé une réponse invalide.', 'ORDER_STORAGE'); }
  }

  async getById(id) {
    const rows = await this.request('GET', `?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    return fromRow(rows[0]);
  }
  async getByTxHash(txHash) {
    const rows = await this.request('GET', `?tx_hash=eq.${encodeURIComponent(txHash)}&select=*&limit=1`);
    return fromRow(rows[0]);
  }
  async create(order) {
    const rows = await this.request('POST', '', toRow(order));
    return fromRow(rows[0]);
  }
  async update(id, patch) {
    const rows = await this.request('PATCH', `?id=eq.${encodeURIComponent(id)}`, patchRow(patch));
    if (!rows[0]) throw new StoreOrderError(404, 'Commande introuvable.', 'ORDER_NOT_FOUND');
    return fromRow(rows[0]);
  }
  async listForBuyer(buyerAddress) {
    const rows = await this.request('GET', `?buyer_address=eq.${encodeURIComponent(buyerAddress)}&status=neq.awaiting_payment&select=*&order=created_at.desc&limit=30`);
    return rows.map(fromRow);
  }
  async listForAdmin() {
    const rows = await this.request('GET', `?status=in.(${VISIBLE_STATUSES.join(',')})&select=*&order=created_at.desc&limit=100`);
    return rows.map(fromRow);
  }
  async deleteExpired(now) {
    await this.request('DELETE', `?status=eq.awaiting_payment&expires_at=lt.${encodeURIComponent(now)}`, undefined, 'return=minimal');
  }
}

function orderNumber(now) {
  return `FITS-${now.getTime().toString(36).toUpperCase()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

function validatePaymentReceipt(order, receipt, currentBlock) {
  if (!receipt) return { confirmed: false };
  if (Number(receipt.status) !== 1) {
    throw new StoreOrderError(409, 'La transaction a échoué sur Polygon.', 'ORDER_PAYMENT_FAILED');
  }
  const token = TOKEN_CONTRACTS[order.token];
  const expectedFrom = ethers.zeroPadValue(order.buyerAddress, 32).toLowerCase();
  const expectedTo = ethers.zeroPadValue(order.paymentAddress, 32).toLowerCase();
  const match = (receipt.logs || []).some((log) => {
    if (!log || String(log.address || '').toLowerCase() !== token.toLowerCase()) return false;
    if (!Array.isArray(log.topics) || log.topics.length < 3) return false;
    if (String(log.topics[0]).toLowerCase() !== TRANSFER_TOPIC.toLowerCase()) return false;
    if (String(log.topics[1]).toLowerCase() !== expectedFrom || String(log.topics[2]).toLowerCase() !== expectedTo) return false;
    try { return BigInt(log.data) === BigInt(order.totalUnits); } catch (_) { return false; }
  });
  if (!match) {
    throw new StoreOrderError(409, 'Le transfert ne correspond pas au client, au vendeur, au jeton ou au montant de la commande.', 'ORDER_PAYMENT_MISMATCH');
  }
  const confirmations = Number(currentBlock) - Number(receipt.blockNumber) + 1;
  return { confirmed: Number.isSafeInteger(confirmations) && confirmations >= 3 };
}

async function withTimeout(promise, milliseconds = 12000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('RPC_TIMEOUT')), milliseconds); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function verifyPolygonPayment(order, txHash, options = {}) {
  const rpcs = options.rpcs || DEFAULT_RPCS;
  let sawMissingReceipt = false;
  for (const rpc of rpcs) {
    const provider = new ethers.JsonRpcProvider(rpc, Protocol.CHAIN_ID, { staticNetwork: true });
    try {
      const receipt = await withTimeout(provider.getTransactionReceipt(txHash));
      if (!receipt) {
        sawMissingReceipt = true;
        continue;
      }
      const currentBlock = await withTimeout(provider.getBlockNumber());
      return validatePaymentReceipt(order, receipt, currentBlock);
    } catch (error) {
      if (error instanceof StoreOrderError && error.status < 500) throw error;
    } finally {
      try { provider.destroy(); } catch (_) { /* Le fournisseur sera libéré par le runtime. */ }
    }
  }
  if (sawMissingReceipt) return { confirmed: false };
  throw new StoreOrderError(503, 'La vérification Polygon est momentanément indisponible.', 'ORDER_RPC_UNAVAILABLE');
}

async function loadRemoteCatalog() {
  const response = await fetch(`https://raw.githubusercontent.com/web3service/fitia-mining-pro/main/store-products.json?orders=${Date.now()}`, {
    cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new StoreOrderError(503, 'Le catalogue actuel est indisponible.', 'ORDER_CATALOG');
  return Catalog.validateManifest(await response.json());
}

function createOrderService(options = {}) {
  if (!options.repository) throw new Error('Un stockage de commandes est requis.');
  const repository = options.repository;
  const encryptionSecret = options.encryptionSecret || process.env.FITIA_SUPABASE_SERVICE_ROLE_KEY || '';
  if (encryptionSecret.length < 20) throw new StoreOrderError(503, 'La clé privée de commandes doit être configurée.', 'ORDER_CONFIG');
  const encryptionKey = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(encryptionSecret), Buffer.from('fitia-store-orders-v1'), Buffer.from('delivery-aes-256-gcm'), 32));
  const loadCatalog = options.loadCatalog || loadRemoteCatalog;
  const paymentVerifier = options.paymentVerifier || ((order, txHash) => verifyPolygonPayment(order, txHash, options.rpc));
  const now = options.now || (() => new Date());

  function encrypt(orderId, payload) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    cipher.setAAD(Buffer.from(`FITIA_STORE_ORDER:${orderId}`));
    const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
  }

  function decrypt(order) {
    try {
      const payload = JSON.parse(order.privateCiphertext);
      if (payload.v !== 1) throw new Error('version');
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(payload.iv, 'base64'));
      decipher.setAAD(Buffer.from(`FITIA_STORE_ORDER:${order.id}`));
      decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
      const text = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString('utf8');
      return JSON.parse(text);
    } catch (_) {
      throw new StoreOrderError(503, 'Les informations privées de la commande sont illisibles.', 'ORDER_PRIVATE_DATA');
    }
  }

  function assertAuthentication(action, body) {
    const timestamp = body.timestamp;
    const current = now().getTime();
    if (!Number.isSafeInteger(timestamp) || Math.abs(current - timestamp) > 10 * 60 * 1000) {
      throw new StoreOrderError(401, 'La signature de la commande a expiré.', 'ORDER_AUTH');
    }
    let buyer;
    try {
      const message = Protocol.message(action, body);
      buyer = Protocol.normalizeBuyer(body.buyer);
      const recovered = ethers.verifyMessage(message, String(body.signature || '')).toLowerCase();
      if (recovered !== buyer) throw new Error('buyer');
    } catch (_) {
      throw new StoreOrderError(401, 'La signature du portefeuille est invalide.', 'ORDER_AUTH');
    }
    return buyer;
  }

  function customerOrder(order) {
    const privateData = decrypt(order);
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      token: order.token,
      total: order.total,
      totalUnits: order.totalUnits,
      sellerName: order.sellerName,
      paymentAddress: order.paymentAddress,
      txHash: order.txHash,
      items: clone(order.items),
      carrier: privateData.carrier || '',
      trackingNumber: privateData.trackingNumber || '',
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt || null
    };
  }

  function adminOrder(order) {
    const privateData = decrypt(order);
    return {
      ...customerOrder(order),
      buyerAddress: order.buyerAddress,
      sellerId: order.sellerId,
      sellerContact: order.sellerContact,
      delivery: Protocol.normalizeDelivery(privateData.delivery),
      expiresAt: order.expiresAt
    };
  }

  async function createOrder(body) {
    const buyer = assertAuthentication('create', body);
    const requestId = Protocol.requireUuid(body.requestId, 'Request ID');
    const cart = Protocol.normalizeCart(body.cart);
    const delivery = Protocol.normalizeDelivery(body.delivery);
    const createHash = crypto.createHash('sha256').update(`${Protocol.hashJson(cart)}:${Protocol.hashJson(delivery)}`).digest('hex');
    const existing = await repository.getById(requestId);
    if (existing) {
      if (existing.buyerAddress !== buyer || existing.createHash !== createHash) {
        throw new StoreOrderError(409, 'Cet identifiant de commande est déjà utilisé.', 'ORDER_CONFLICT');
      }
      return customerOrder(existing);
    }
    await repository.deleteExpired(now().toISOString());
    const manifest = Catalog.validateManifest(await loadCatalog());
    if (!manifest.enabled) throw new StoreOrderError(409, 'FITIA STORE est actuellement désactivé.', 'ORDER_STORE_CLOSED');
    let quote;
    try { quote = Catalog.calculateCart(manifest.products, cart, now().getTime()); }
    catch (error) { throw new StoreOrderError(error.status || 400, error.message, error.code || 'ORDER_CART'); }
    const timestamp = now();
    const order = {
      id: requestId,
      orderNumber: orderNumber(timestamp),
      createHash,
      buyerAddress: buyer,
      sellerId: quote.sellerId,
      sellerName: quote.sellerName,
      sellerContact: quote.sellerContact,
      paymentAddress: quote.paymentAddress.toLowerCase(),
      token: quote.token,
      total: quote.total,
      totalUnits: quote.totalUnits.toString(),
      items: quote.items.map((item) => ({
        productId: item.product.id,
        name: clone(item.product.name),
        quantity: item.quantity,
        price: item.product.price
      })),
      privateCiphertext: encrypt(requestId, { delivery, carrier: '', trackingNumber: '' }),
      txHash: null,
      status: 'awaiting_payment',
      createdAt: timestamp.toISOString(),
      updatedAt: timestamp.toISOString(),
      paidAt: null,
      expiresAt: new Date(timestamp.getTime() + 2 * 60 * 60 * 1000).toISOString()
    };
    return customerOrder(await repository.create(order));
  }

  async function attachPayment(body) {
    const buyer = assertAuthentication('attach', body);
    const orderId = Protocol.requireUuid(body.orderId);
    const txHash = Protocol.requireTxHash(body.txHash);
    const order = assertOrder(await repository.getById(orderId));
    if (order.buyerAddress !== buyer) throw new StoreOrderError(403, 'Cette commande appartient à un autre portefeuille.', 'ORDER_FORBIDDEN');
    if (VISIBLE_STATUSES.includes(order.status)) {
      if (order.txHash !== txHash) throw new StoreOrderError(409, 'La commande possède déjà une autre transaction.', 'ORDER_CONFLICT');
      return customerOrder(order);
    }
    if (order.txHash && order.txHash !== txHash) throw new StoreOrderError(409, 'La commande possède déjà une autre transaction.', 'ORDER_CONFLICT');
    if (order.status === 'awaiting_payment' && Date.parse(order.expiresAt) <= now().getTime()) {
      throw new StoreOrderError(410, 'La commande a expiré. Créez une nouvelle commande sans réutiliser cette transaction.', 'ORDER_EXPIRED');
    }
    const used = await repository.getByTxHash(txHash);
    if (used && used.id !== orderId) throw new StoreOrderError(409, 'Cette transaction est déjà utilisée par une autre commande.', 'ORDER_TX_USED');
    const verification = await paymentVerifier(order, txHash);
    const timestamp = now().toISOString();
    const patch = verification.confirmed
      ? { txHash, status: 'paid', paidAt: order.paidAt || timestamp, updatedAt: timestamp }
      : { txHash, status: 'payment_pending', updatedAt: timestamp };
    return customerOrder(await repository.update(orderId, patch));
  }

  async function refreshPayment(order) {
    if (order.status !== 'payment_pending' || !order.txHash) return order;
    const verification = await paymentVerifier(order, order.txHash);
    if (!verification.confirmed) return order;
    const timestamp = now().toISOString();
    return repository.update(order.id, { status: 'paid', paidAt: order.paidAt || timestamp, updatedAt: timestamp });
  }

  async function listCustomerOrders(body) {
    const buyer = assertAuthentication('list', body);
    const orders = await repository.listForBuyer(buyer);
    const result = [];
    for (const order of orders) {
      let current = order;
      if (order.status === 'payment_pending') {
        try { current = await refreshPayment(order); } catch (_) { /* Un statut non confirmé ne devient jamais payé sur une erreur RPC. */ }
      }
      result.push(customerOrder(current));
    }
    return result;
  }

  async function syncCustomerOrder(body) {
    const buyer = assertAuthentication('sync', body);
    const order = assertOrder(await repository.getById(Protocol.requireUuid(body.orderId)));
    if (order.buyerAddress !== buyer) throw new StoreOrderError(403, 'Cette commande appartient à un autre portefeuille.', 'ORDER_FORBIDDEN');
    if (order.status === 'awaiting_payment') throw new StoreOrderError(404, 'Aucun paiement n’est associé à cette commande.', 'ORDER_NOT_FOUND');
    return customerOrder(await refreshPayment(order));
  }

  async function listAdminOrders() {
    const orders = await repository.listForAdmin();
    return orders.map(adminOrder);
  }

  async function updateAdminOrder(body) {
    const orderId = Protocol.requireUuid(body.orderId);
    const order = assertOrder(await repository.getById(orderId));
    const nextStatus = String(body.status || '');
    const ranks = { paid: 0, preparing: 1, shipped: 2, delivered: 3 };
    if (!Object.hasOwn(ranks, order.status) || !Object.hasOwn(ranks, nextStatus) || ranks[nextStatus] < ranks[order.status]) {
      throw new StoreOrderError(409, 'Cette transition de statut n’est pas autorisée.', 'ORDER_STATUS');
    }
    const privateData = decrypt(order);
    privateData.delivery = Protocol.normalizeDelivery(privateData.delivery);
    privateData.carrier = Protocol.cleanPrivate(body.carrier, 80);
    privateData.trackingNumber = Protocol.cleanPrivate(body.trackingNumber, 120);
    const patch = {
      status: nextStatus,
      privateCiphertext: encrypt(order.id, privateData),
      updatedAt: now().toISOString()
    };
    return adminOrder(await repository.update(order.id, patch));
  }

  return Object.freeze({
    createOrder, attachPayment, listCustomerOrders, syncCustomerOrder,
    listAdminOrders, updateAdminOrder, customerOrder, adminOrder
  });
}

let defaultService = null;
function getDefaultOrderService() {
  if (defaultService) return defaultService;
  const config = getSupabaseConfig();
  defaultService = createOrderService({
    repository: new SupabaseOrderRepository(config),
    encryptionSecret: config.key
  });
  return defaultService;
}

module.exports = {
  ORDER_STATUSES,
  VISIBLE_STATUSES,
  TOKEN_CONTRACTS,
  StoreOrderError,
  MemoryOrderRepository,
  SupabaseOrderRepository,
  createOrderService,
  getDefaultOrderService,
  validatePaymentReceipt,
  verifyPolygonPayment,
  loadRemoteCatalog
};
