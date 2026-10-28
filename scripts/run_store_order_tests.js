#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const ethers = require('../vendor/ethers.umd.min.js');
const Catalog = require('../store-catalog');
const Protocol = require('../store-order-protocol');
const {
  MemoryOrderRepository,
  SupabaseOrderRepository,
  createOrderService,
  validatePaymentReceipt
} = require('../store-order-service');
const { createStoreOrdersHandler } = require('../api/store-orders');
const { createAdminHandler } = require('../api/admin');

const NOW = new Date('2026-10-28T12:00:00.000Z');
const NOW_MS = NOW.getTime();
const TX_HASH = `0x${'ab'.repeat(32)}`;
const PRIVATE_VALUES = ['Alice Private Order', '+49 000 111 222', '1 Secret Delivery Street', 'Confidential door code'];
let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ❌ ${name}\n     ↳ ${error.stack || error.message}`);
  }
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.strictEqual(error.code, code);
    return true;
  });
}

function catalog() {
  return Catalog.validateManifest({
    version: 1,
    enabled: true,
    products: [{
      id: 'product-phone', active: true, sourceType: 'own', category: 'electronics',
      name: { en: 'FITIA Phone', fr: 'Téléphone FITIA' }, description: { en: 'Physical product' },
      image: '', sellerId: 'seller-fitia', sellerName: 'FITIA Seller', sellerContact: '@fitia-seller',
      paymentAddress: '0x1111111111111111111111111111111111111111',
      priceToken: 'USDT', price: '12.5', shippingFee: '0.5', stock: 10,
      deliveryEstimate: '3-7 business days'
    }]
  });
}

function delivery() {
  return {
    name: PRIVATE_VALUES[0], phone: PRIVATE_VALUES[1], country: 'Germany', city: 'Frankfurt',
    address: PRIVATE_VALUES[2], notes: PRIVATE_VALUES[3]
  };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

function close(server) { return new Promise((resolve) => server.close(resolve)); }

(async () => {
  console.log('\n📦  TESTS DES COMMANDES PRIVÉES FITIA STORE\n' + '═'.repeat(68));
  const wallet = ethers.Wallet.createRandom();
  const otherWallet = ethers.Wallet.createRandom();
  const buyer = wallet.address.toLowerCase();
  const repository = new MemoryOrderRepository();
  let confirmPayment = false;
  const service = createOrderService({
    repository,
    encryptionSecret: 'fitia-order-test-encryption-secret-not-for-production',
    loadCatalog: async () => catalog(),
    paymentVerifier: async () => ({ confirmed: confirmPayment }),
    now: () => new Date(NOW_MS)
  });

  async function signed(action, fields = {}, signer = wallet) {
    const body = {
      action,
      buyer: signer.address.toLowerCase(),
      timestamp: NOW_MS,
      ...fields
    };
    body.signature = await signer.signMessage(Protocol.message(action, body));
    return body;
  }

  const requestId = crypto.randomUUID();
  const createFields = { requestId, cart: [{ productId: 'product-phone', quantity: 2 }], delivery: delivery() };
  let created;

  await runTest('Création signée : chiffrement AES-GCM, aucune fuite client et vendeur invisible avant paiement', async () => {
    created = await service.createOrder(await signed('create', createFields));
    assert.strictEqual(created.id, requestId);
    assert.strictEqual(created.status, 'awaiting_payment');
    assert.strictEqual(created.total, '26');
    assert.strictEqual(created.totalUnits, '26000000');
    const record = await repository.getById(requestId);
    assert.ok(record.privateCiphertext.includes('"iv"'));
    for (const privateValue of PRIVATE_VALUES) {
      assert.ok(!record.privateCiphertext.includes(privateValue));
      assert.ok(!JSON.stringify(created).includes(privateValue));
    }
    assert.strictEqual(created.delivery, undefined);
    assert.deepStrictEqual(await service.listAdminOrders(), []);
    const repeated = await service.createOrder(await signed('create', createFields));
    assert.strictEqual(repeated.id, created.id);
    assert.strictEqual(repository.orders.size, 1, 'La même requête doit rester idempotente');
  });

  await runTest('Une signature invalide ou une livraison modifiée après signature est refusée', async () => {
    const valid = await signed('create', { ...createFields, requestId: crypto.randomUUID() });
    const tampered = { ...valid, delivery: { ...valid.delivery, address: 'Attacker controlled address' } };
    await expectCode(service.createOrder(tampered), 'ORDER_AUTH');
    await expectCode(service.createOrder({ ...valid, signature: '0x00' }), 'ORDER_AUTH');
    await expectCode(service.createOrder({ ...valid, timestamp: NOW_MS - 11 * 60 * 1000 }), 'ORDER_AUTH');
  });

  await runTest('Paiement en attente puis confirmé : une seule transaction, une seule commande vendeur', async () => {
    const attachFields = { orderId: requestId, txHash: TX_HASH };
    const pending = await service.attachPayment(await signed('attach', attachFields));
    assert.strictEqual(pending.status, 'payment_pending');
    assert.deepStrictEqual(await service.listAdminOrders(), []);
    confirmPayment = true;
    const paid = await service.attachPayment(await signed('attach', attachFields));
    assert.strictEqual(paid.status, 'paid');
    assert.ok(paid.paidAt);
    const repeated = await service.attachPayment(await signed('attach', attachFields));
    assert.strictEqual(repeated.status, 'paid');
    const adminOrders = await service.listAdminOrders();
    assert.strictEqual(adminOrders.length, 1);
    assert.strictEqual(adminOrders[0].delivery.address, PRIVATE_VALUES[2]);
    assert.strictEqual(adminOrders[0].status, 'paid');
  });

  await runTest('Suivi privé : préparation, expédition, livraison et aucune régression', async () => {
    let updated = await service.updateAdminOrder({ orderId: requestId, status: 'preparing', carrier: '', trackingNumber: '' });
    assert.strictEqual(updated.status, 'preparing');
    updated = await service.updateAdminOrder({ orderId: requestId, status: 'shipped', carrier: 'DHL', trackingNumber: 'TRACK-123-SECURE' });
    assert.strictEqual(updated.trackingNumber, 'TRACK-123-SECURE');
    const customer = await service.syncCustomerOrder(await signed('sync', { orderId: requestId }));
    assert.strictEqual(customer.status, 'shipped');
    assert.strictEqual(customer.carrier, 'DHL');
    assert.strictEqual(customer.trackingNumber, 'TRACK-123-SECURE');
    assert.strictEqual(customer.delivery, undefined);
    await expectCode(service.updateAdminOrder({ orderId: requestId, status: 'preparing' }), 'ORDER_STATUS');
    updated = await service.updateAdminOrder({ orderId: requestId, status: 'delivered', carrier: 'DHL', trackingNumber: 'TRACK-123-SECURE' });
    assert.strictEqual(updated.status, 'delivered');
  });

  await runTest('Un autre wallet ne peut pas lire la commande et une transaction ne peut pas être réutilisée', async () => {
    const otherOrders = await service.listCustomerOrders(await signed('list', {}, otherWallet));
    assert.deepStrictEqual(otherOrders, []);
    await expectCode(service.syncCustomerOrder(await signed('sync', { orderId: requestId }, otherWallet)), 'ORDER_FORBIDDEN');
    const secondId = crypto.randomUUID();
    await service.createOrder(await signed('create', { ...createFields, requestId: secondId }));
    await expectCode(service.attachPayment(await signed('attach', { orderId: secondId, txHash: TX_HASH })), 'ORDER_TX_USED');
    assert.strictEqual((await repository.getById(secondId)).status, 'awaiting_payment');
    assert.strictEqual((await service.listAdminOrders()).length, 1);
  });

  await runTest('Le reçu on-chain exige client, vendeur, contrat, montant exact et trois confirmations', async () => {
    const order = {
      buyerAddress: buyer,
      paymentAddress: '0x1111111111111111111111111111111111111111',
      token: 'USDT',
      totalUnits: '26000000'
    };
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    const receipt = {
      status: 1,
      blockNumber: 100,
      logs: [{
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        topics: [transferTopic, ethers.zeroPadValue(buyer, 32), ethers.zeroPadValue(order.paymentAddress, 32)],
        data: ethers.toBeHex(26000000n, 32)
      }]
    };
    assert.strictEqual(validatePaymentReceipt(order, receipt, 101).confirmed, false);
    assert.strictEqual(validatePaymentReceipt(order, receipt, 102).confirmed, true);
    await assert.rejects(async () => validatePaymentReceipt(order, { ...receipt, status: 0 }, 102), /échoué/);
    const wrongAmount = { ...receipt, logs: [{ ...receipt.logs[0], data: ethers.toBeHex(25000000n, 32) }] };
    assert.throws(() => validatePaymentReceipt(order, wrongAmount, 102), (error) => error.code === 'ORDER_PAYMENT_MISMATCH');
    const wrongSeller = { ...receipt, logs: [{ ...receipt.logs[0], topics: [transferTopic, ethers.zeroPadValue(buyer, 32), ethers.zeroPadValue(otherWallet.address, 32)] }] };
    assert.throws(() => validatePaymentReceipt(order, wrongSeller, 102), (error) => error.code === 'ORDER_PAYMENT_MISMATCH');
  });

  await runTest('L’API client exige la signature et renvoie le suivi sans coordonnées', async () => {
    const handler = createStoreOrdersHandler({ orderService: service });
    const server = http.createServer(handler);
    const base = await listen(server);
    try {
      const preflight = await fetch(`${base}/api/store-orders`, { method: 'OPTIONS' });
      assert.strictEqual(preflight.status, 204);
      assert.strictEqual(preflight.headers.get('access-control-allow-origin'), '*');
      const response = await fetch(`${base}/api/store-orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await signed('list'))
      });
      const data = await response.json();
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get('cache-control'), 'no-store');
      assert.strictEqual(data.orders.length, 1);
      assert.strictEqual(data.orders[0].status, 'delivered');
      assert.strictEqual(data.orders[0].delivery, undefined);
      for (const privateValue of PRIVATE_VALUES) assert.ok(!JSON.stringify(data).includes(privateValue));
    } finally { await close(server); }
  });

  await runTest('L’API admin exige session et CSRF avant de déchiffrer ou modifier une commande', async () => {
    process.env.FITIA_ADMIN_PASSWORD = 'orders-test-password-123';
    process.env.FITIA_GITHUB_TOKEN = 'orders-test-token-not-real';
    const handler = createAdminHandler({ orderService: service });
    const server = http.createServer((req, res) => {
      const action = new URL(req.url, 'http://localhost').pathname.split('/').pop();
      req.query = { action };
      return handler(req, res);
    });
    const base = await listen(server);
    try {
      const unauthorized = await fetch(`${base}/api/admin/store-orders`);
      assert.strictEqual(unauthorized.status, 401);
      const login = await fetch(`${base}/api/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: process.env.FITIA_ADMIN_PASSWORD })
      });
      const loginData = await login.json();
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const csrf = loginData.csrfToken;
      const ordersResponse = await fetch(`${base}/api/admin/store-orders`, { headers: { Cookie: cookie } });
      const ordersData = await ordersResponse.json();
      assert.strictEqual(ordersResponse.status, 200);
      assert.strictEqual(ordersData.orders[0].delivery.name, PRIVATE_VALUES[0]);
      const rejected = await fetch(`${base}/api/admin/store-orders`, {
        method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: requestId, status: 'delivered' })
      });
      assert.strictEqual(rejected.status, 403);
      const updated = await fetch(`${base}/api/admin/store-orders`, {
        method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ orderId: requestId, status: 'delivered', carrier: 'DHL', trackingNumber: 'TRACK-123-SECURE' })
      });
      assert.strictEqual(updated.status, 200);
      const updatedData = await updated.json();
      assert.strictEqual(updatedData.order.status, 'delivered');
      assert.ok(!JSON.stringify(updatedData).includes(process.env.FITIA_GITHUB_TOKEN));
    } finally {
      await close(server);
      delete process.env.FITIA_ADMIN_PASSWORD;
      delete process.env.FITIA_GITHUB_TOKEN;
    }
  });

  await runTest('Le client Supabase secret utilise apikey sans exposer de JWT legacy', async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    try {
      const repository = new SupabaseOrderRepository({ url: 'https://example-project.supabase.co', key: 'sb_secret_test-only-not-a-real-key' });
      await repository.listForAdmin();
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].init.headers.apikey, 'sb_secret_test-only-not-a-real-key');
      assert.strictEqual(calls[0].init.headers.Authorization, undefined);
      assert.ok(calls[0].url.includes('/rest/v1/store_orders'));
    } finally { global.fetch = originalFetch; }
  });

  console.log('═'.repeat(68));
  console.log(`📊 RÉSULTAT COMMANDES : ${passed} réussis, ${failed} échoués`);
  if (failed) process.exitCode = 1;
})();
