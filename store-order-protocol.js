/* FITIA STORE — protocole public de signature des commandes privées. */
(function (root, factory) {
  const ethers = root.ethers || (typeof require === 'function' ? require('./vendor/ethers.umd.min.js') : null);
  const api = factory(ethers);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FitiaStoreOrderProtocol = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ethers) {
  'use strict';

  if (!ethers) throw new Error('ethers est requis pour les commandes FITIA STORE.');
  const CHAIN_ID = 137;
  const ACTIONS = new Set(['create', 'attach', 'list', 'sync']);

  class OrderProtocolError extends Error {
    constructor(message, code = 'ORDER_INVALID') {
      super(message);
      this.code = code;
    }
  }

  function cleanPrivate(value, maxLength, multiline = false) {
    let text = String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim();
    if (!multiline) text = text.replace(/\s+/g, ' ');
    return text.slice(0, maxLength).trim();
  }

  function normalizeDelivery(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new OrderProtocolError('Les informations de livraison sont invalides.', 'ORDER_DELIVERY');
    }
    const delivery = {
      name: cleanPrivate(value.name, 80),
      phone: cleanPrivate(value.phone, 32),
      country: cleanPrivate(value.country, 60),
      city: cleanPrivate(value.city, 80),
      address: cleanPrivate(value.address, 240, true),
      notes: cleanPrivate(value.notes, 300, true)
    };
    if (!delivery.name || !delivery.phone || !delivery.country || !delivery.city || !delivery.address) {
      throw new OrderProtocolError('Les informations de livraison sont incomplètes.', 'ORDER_DELIVERY');
    }
    return delivery;
  }

  function normalizeCart(value) {
    if (!Array.isArray(value) || !value.length || value.length > 50) {
      throw new OrderProtocolError('Le panier est invalide.', 'ORDER_CART');
    }
    const seen = new Set();
    return value.map((entry) => {
      const productId = typeof entry?.productId === 'string' ? entry.productId : '';
      const quantity = entry?.quantity;
      if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(productId) || seen.has(productId) ||
          !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
        throw new OrderProtocolError('Le panier contient un article invalide.', 'ORDER_CART');
      }
      seen.add(productId);
      return { productId, quantity };
    });
  }

  function normalizeBuyer(value) {
    if (typeof value !== 'string' || !ethers.isAddress(value)) {
      throw new OrderProtocolError('L’adresse du client est invalide.', 'ORDER_AUTH');
    }
    return value.toLowerCase();
  }

  function requireUuid(value, field = 'Order ID') {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new OrderProtocolError(`${field} est invalide.`, 'ORDER_INVALID');
    }
    return value.toLowerCase();
  }

  function requireTxHash(value) {
    if (typeof value !== 'string' || !/^0x[a-f0-9]{64}$/i.test(value)) {
      throw new OrderProtocolError('La transaction est invalide.', 'ORDER_PAYMENT');
    }
    return value.toLowerCase();
  }

  function hashJson(value) {
    return ethers.sha256(ethers.toUtf8Bytes(JSON.stringify(value)));
  }

  function message(action, params = {}) {
    if (!ACTIONS.has(action)) throw new OrderProtocolError('L’action de commande est invalide.');
    const buyer = normalizeBuyer(params.buyer);
    const timestamp = params.timestamp;
    if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
      throw new OrderProtocolError('L’horodatage de la commande est invalide.', 'ORDER_AUTH');
    }
    const lines = [
      'FITIA STORE — PRIVATE ORDER V1',
      `Action: ${action}`,
      `Chain ID: ${CHAIN_ID}`,
      `Buyer: ${buyer}`,
      `Timestamp: ${timestamp}`
    ];
    if (action === 'create') {
      const requestId = requireUuid(params.requestId, 'Request ID');
      const cart = normalizeCart(params.cart);
      const delivery = normalizeDelivery(params.delivery);
      lines.push(`Request ID: ${requestId}`, `Cart SHA-256: ${hashJson(cart)}`, `Delivery SHA-256: ${hashJson(delivery)}`);
    } else if (action === 'attach') {
      lines.push(`Order ID: ${requireUuid(params.orderId)}`, `Transaction: ${requireTxHash(params.txHash)}`);
    } else if (action === 'sync') {
      lines.push(`Order ID: ${requireUuid(params.orderId)}`);
    }
    return lines.join('\n');
  }

  return Object.freeze({ CHAIN_ID, OrderProtocolError, cleanPrivate, normalizeDelivery, normalizeCart, normalizeBuyer, requireUuid, requireTxHash, hashJson, message });
});
