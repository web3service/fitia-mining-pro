#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(
  fs.existsSync('/tmp/test-deps/node_modules/jsdom') ? '/tmp/test-deps/node_modules/jsdom' : 'jsdom'
);
const Catalog = require('../store-catalog');

const ROOT = path.resolve(__dirname, '..');
const RECEIVER_USDT = '0x1111111111111111111111111111111111111111';
const RECEIVER_FTA = '0x3333333333333333333333333333333333333333';
const BUYER = '0x9999999999999999999999999999999999999999';
let passed = 0;
let failed = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function product(overrides = {}) {
  return {
    id: 'product-phone', active: true, sourceType: 'own', category: 'electronics',
    name: { en: 'FITIA Phone', fr: 'Téléphone FITIA' }, description: { en: 'Physical product' },
    image: '', sellerId: 'seller-fitia', sellerName: 'FITIA Seller', sellerContact: '@fitia-seller',
    paymentAddress: RECEIVER_USDT, priceToken: 'USDT', price: '12.5', shippingFee: '0.5',
    stock: 5, deliveryEstimate: '3-7 business days', ...overrides
  };
}

function manifest(products = [product()]) {
  return { version: 1, enabled: true, products };
}

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

async function waitFor(condition, label) {
  for (let index = 0; index < 200; index += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timeout: ${label}`);
}

async function createHarness(token = 'USDT', options = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'android-src/wallet.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const dom = new JSDOM(html, { url: 'https://app.fitia.pro/wallet.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window;
  Object.defineProperty(win, 'crypto', { value: crypto.webcrypto, configurable: true });
  win.confirm = () => true;
  win.eval(fs.readFileSync(path.join(ROOT, 'vendor/ethers.umd.min.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'store-catalog.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'store-order-protocol.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'store.js'), 'utf8'));
  win.CONFIG = {
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    FTA: '0x5c418b12c7e9c2a8e9a71a68c6d9b319e7b1d1fd',
    CORE: '0x1b8edfb91168fb233f8ca7cf1631038ac193d743',
    MINE: '0xbd9fa9801eda247b28b3bb9ddbf1cf52ca563bc6'
  };
  const sharedTexts = [];
  const copiedTexts = [];
  win.FitiaSecurity = { Native: {
    shareText: async (title, text) => { sharedTexts.push({ title, text }); return true; },
    copyText: async (text) => { copiedTexts.push(text); return true; },
    vibrate: () => {}
  } };
  let remoteManifest = manifest([
    product({
      id: token === 'FTA' ? 'product-fta' : 'product-phone',
      sourceType: token === 'FTA' ? 'dropshipping' : 'own',
      paymentAddress: token === 'FTA' ? RECEIVER_FTA : RECEIVER_USDT,
      priceToken: token,
      price: token === 'FTA' ? '3.25' : '12.5',
      shippingFee: token === 'FTA' ? '0.25' : '0.5'
    }),
    product({ id: 'product-accessory', price: '2', shippingFee: '0', stock: 10 }),
    product({ id: 'product-other-seller', sellerId: 'seller-other', sourceType: 'dropshipping', paymentAddress: RECEIVER_FTA, priceToken: 'FTA' })
  ]);
  const toasts = [];
  const errors = [];
  const transfers = [];
  const pinTitles = [];
  const orderRequests = [];
  const serverOrders = new Map();
  const serverDeliveries = new Map();
  let attachAttempts = 0;
  const hash = `0x${token === 'FTA' ? 'ab' : 'cd'}`.padEnd(66, '0').slice(0, 66);
  const makeToken = (symbol) => ({
    balanceOf: async () => symbol === 'USDT' ? win.ethers.parseUnits(String(options.balance ?? 100), 6) : win.ethers.parseUnits(String(options.balance ?? 100), 8),
    transfer: async (to, amount) => {
      transfers.push({ symbol, to, amount });
      return { hash, wait: async () => {
        if (options.revertThrows) throw { code: 'CALL_EXCEPTION', receipt: { status: 0 } };
        if (options.waitThrows) throw options.waitThrows;
        return { status: options.revert ? 0 : 1 };
      } };
    }
  });
  const app = {
    currentLang: 'en', user: BUYER, signer: { signMessage: async (message) => `0xsigned-${message.length}` }, usdtDecimals: 6, ftaDecimals: 8,
    usdtToken: makeToken('USDT'), ftaToken: makeToken('FTA'),
    showToast: (message, isError = false, tone = '') => toasts.push({ message, isError, tone }),
    showError: (error) => errors.push(error),
    setLoader: (visible) => win.document.getElementById('loader').classList.toggle('hidden', !visible),
    closeModals: () => {
      win.document.querySelectorAll('.modal').forEach((modal) => modal.classList.remove('active'));
      center.onModalsClosed();
    },
    ensurePolGas: async () => true,
    requestPinVerification: async (title) => {
      pinTitles.push(title);
      if (options.lockOnPin) center.setAccount(null);
      return { secret: { privateKey: 'temporary-private', mnemonic: 'temporary-mnemonic' } };
    },
    updateData: async () => {},
    t: (key) => key === 'errInsufficientFunds' ? 'Insufficient funds' : key
  };
  const center = new win.FitiaStoreCenter(app);
  app.storeCenter = center;
  win.fetch = async (url, init = {}) => {
    if (String(url) === 'store-products.json' || String(url).includes('/main/store-products.json')) {
      return { ok: true, status: 200, json: async () => clone(remoteManifest) };
    }
    if (String(url) === 'https://fitia-mining-pro.vercel.app/api/store-orders') {
      const body = JSON.parse(init.body || '{}');
      orderRequests.push(body);
      if (body.action === 'create') {
        if (options.createFails) return { ok: false, status: 503, json: async () => ({ code: 'ORDER_CONFIG' }) };
        const quote = Catalog.calculateCart(Catalog.validateManifest(remoteManifest).products, body.cart);
        const order = {
          id: body.requestId,
          orderNumber: `FITS-TEST-${String(serverOrders.size + 1).padStart(4, '0')}`,
          status: 'awaiting_payment', token: quote.token, total: quote.total,
          totalUnits: quote.totalUnits.toString(), sellerName: quote.sellerName,
          paymentAddress: quote.paymentAddress, txHash: null,
          items: quote.items.map((item) => ({ productId: item.product.id, name: item.product.name, quantity: item.quantity, price: item.product.price })),
          carrier: '', trackingNumber: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), paidAt: null
        };
        serverOrders.set(order.id, order);
        serverDeliveries.set(order.id, clone(body.delivery));
        return { ok: true, status: 201, json: async () => ({ order: clone(order) }) };
      }
      if (body.action === 'attach') {
        attachAttempts += 1;
        if (options.attachFailures === Infinity || attachAttempts <= (options.attachFailures || 0)) {
          return { ok: false, status: 503, json: async () => ({ code: 'ORDER_NETWORK' }) };
        }
        if (options.revert || options.revertThrows) return { ok: false, status: 409, json: async () => ({ code: 'ORDER_PAYMENT_FAILED' }) };
        if (options.paymentMismatch) return { ok: false, status: 409, json: async () => ({ code: 'ORDER_PAYMENT_MISMATCH' }) };
        const order = serverOrders.get(body.orderId);
        if (!order) return { ok: false, status: 404, json: async () => ({ code: 'ORDER_NOT_FOUND' }) };
        order.txHash = body.txHash;
        order.status = options.serverPending ? 'payment_pending' : 'paid';
        order.paidAt = order.status === 'paid' ? new Date().toISOString() : null;
        order.updatedAt = new Date().toISOString();
        return { ok: true, status: order.status === 'paid' ? 200 : 202, json: async () => ({ order: clone(order) }) };
      }
      if (body.action === 'list') {
        if (options.listFails) return { ok: false, status: 503, json: async () => ({ code: 'ORDER_NETWORK' }) };
        return { ok: true, status: 200, json: async () => ({ orders: Array.from(serverOrders.values()).filter((order) => order.status !== 'awaiting_payment').map(clone) }) };
      }
      if (body.action === 'sync') {
        const order = serverOrders.get(body.orderId);
        return { ok: Boolean(order), status: order ? 200 : 404, json: async () => order ? ({ order: clone(order) }) : ({ code: 'ORDER_NOT_FOUND' }) };
      }
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  center.init();
  await waitFor(() => center.lastFetchAt > 0, 'initial catalog refresh');
  return {
    win, app, center, transfers, pinTitles, toasts, errors, sharedTexts, copiedTexts, hash,
    orderRequests, serverOrders, serverDeliveries,
    productId: token === 'FTA' ? 'product-fta' : 'product-phone',
    setManifest: (next) => { remoteManifest = next; },
    getManifest: () => clone(remoteManifest),
    fillShipping: () => {
      win.document.getElementById('store-shipping-name').value = 'Alice Example';
      win.document.getElementById('store-shipping-phone').value = '+49 170 0000000';
      win.document.getElementById('store-shipping-country').value = 'Germany';
      win.document.getElementById('store-shipping-city').value = 'Frankfurt';
      win.document.getElementById('store-shipping-address').value = '1 Private Test Street';
      win.document.getElementById('store-shipping-notes').value = 'Private delivery note';
      win.document.getElementById('store-checkout-consent').checked = true;
    },
    close: () => win.close()
  };
}

(async () => {
  console.log('\n🛍️  TESTS FITIA STORE\n' + '═'.repeat(68));

  await runTest('Catalogue : produits propres/dropshipping, USDT/FTA et validations strictes', async () => {
    const validated = Catalog.validateManifest(manifest([
      product(),
      product({ id: 'product-fta', sourceType: 'dropshipping', priceToken: 'FTA', price: '3.25', shippingFee: '0.25', paymentAddress: RECEIVER_FTA })
    ]));
    assert.strictEqual(validated.products.length, 2);
    assert.strictEqual(validated.products[0].price, '12.5');
    assert.strictEqual(validated.products[1].sourceType, 'dropshipping');
    assert.strictEqual(validated.products[1].priceToken, 'FTA');
    for (const invalid of [
      product({ paymentAddress: Catalog.ZERO_ADDRESS }),
      product({ price: '0.0000001' }),
      product({ stock: -1 }),
      product({ image: 'https://example.com/tracking.jpg' }),
      product({ active: 'yes' })
    ]) assert.throws(() => Catalog.validateManifest(manifest([invalid])), Catalog.StoreValidationError);
    const unknown = product();
    unknown.customerAddress = 'NEVER_STORE_THIS';
    const cleaned = Catalog.validateManifest(manifest([unknown])).products[0];
    assert.strictEqual(cleaned.customerAddress, undefined);
  });

  await runTest('Pays de livraison : codes ISO stricts, drapeaux locaux et aucun pays inventé', async () => {
    const configured = Catalog.validateManifest({ ...manifest(), shippingCountries: ['fr', 'DE', 'CI'] });
    assert.deepStrictEqual(configured.shippingCountries, ['FR', 'DE', 'CI']);
    assert.strictEqual(Catalog.countryFlag('FR'), '🇫🇷');
    assert.strictEqual(Catalog.countryName('DE', 'fr'), 'Allemagne');
    assert.strictEqual(Catalog.COUNTRY_CODES.length, 249);
    assert.strictEqual(new Set(Catalog.COUNTRY_CODES).size, 249);
    Catalog.COUNTRY_CODES.forEach((code) => {
      assert.ok(fs.statSync(path.join(ROOT, 'assets/flags', `${code.toLowerCase()}.svg`)).size > 100, `Drapeau local manquant: ${code}`);
    });
    assert.ok(fs.existsSync(path.join(ROOT, 'assets/flags/LICENSE.txt')));
    for (const shippingCountries of [['XX'], ['FR', 'FR'], ['FR', 'not-a-country'], 'FR']) {
      assert.throws(() => Catalog.validateManifest({ ...manifest(), shippingCountries }), Catalog.StoreValidationError);
    }
    const published = Catalog.validateManifest(JSON.parse(fs.readFileSync(path.join(ROOT, 'store-products.json'), 'utf8')));
    assert.deepStrictEqual(published.shippingCountries, [], 'Aucun partenariat public n’est affirmé sans configuration admin');
  });

  await runTest('Produits physiques uniquement : types numériques refusés et parcours retirés', async () => {
    assert.strictEqual(Catalog.validateManifest(manifest([product({ type: 'physical' })])).products.length, 1);
    for (const type of ['download', 'license']) {
      assert.throws(() => Catalog.validateManifest(manifest([product({ type })])), /produits physiques/);
    }
    assert.throws(() => Catalog.validateManifest(manifest([
      product({ digital: { kind: 'file', name: 'private.bin' } })
    ])), /produits numériques/);
    const adminHtml = fs.readFileSync(path.join(ROOT, 'admin/index.html'), 'utf8');
    assert.ok(!adminHtml.includes('fichier à télécharger'));
    assert.ok(!adminHtml.includes('clé de licence'));
    const androidSource = fs.readFileSync(path.join(ROOT, 'android-src/java/com/fitia/miningpro/MainActivity.java'), 'utf8');
    assert.ok(!androidSource.includes('downloadDigitalProduct'));
    assert.ok(!fs.existsSync(path.join(ROOT, 'api/store-digital.js')));
  });

  await runTest('Panier : calcul entier exact, stock et blocage des vendeurs/cryptos mélangés', async () => {
    const products = Catalog.validateManifest(manifest([
      product(), product({ id: 'product-accessory', price: '2', shippingFee: '0' }),
      product({ id: 'product-other', sellerId: 'seller-other', priceToken: 'FTA', paymentAddress: RECEIVER_FTA })
    ])).products;
    const quote = Catalog.calculateCart(products, [
      { productId: 'product-phone', quantity: 2 }, { productId: 'product-accessory', quantity: 1 }
    ]);
    assert.strictEqual(quote.subtotal, '27');
    assert.strictEqual(quote.shipping, '1');
    assert.strictEqual(quote.total, '28');
    assert.strictEqual(quote.totalUnits, 28000000n);
    assert.throws(() => Catalog.calculateCart(products, [
      { productId: 'product-phone', quantity: 1 }, { productId: 'product-other', quantity: 1 }
    ]), /un seul vendeur/);
    assert.throws(() => Catalog.calculateCart(products, [{ productId: 'product-phone', quantity: 6 }]), /stock/);
  });

  await runTest('Interface : recherche, badges propres/dropshipping et panier sans injection DOM', async () => {
    const h = await createHarness();
    try {
      assert.strictEqual(h.win.document.querySelectorAll('#store-product-grid .store-product-card').length, 3);
      assert.ok(h.win.document.querySelector('.store-source-badge.dropshipping'));
      h.center.addToCart('product-phone');
      h.center.addToCart('product-phone');
      assert.strictEqual(h.center.cart[0].quantity, 2);
      h.center.addToCart('product-other-seller');
      assert.strictEqual(h.center.cart.length, 1, 'Un autre vendeur/FTA ne doit pas rejoindre le panier USDT');
      assert.strictEqual(h.win.document.querySelectorAll('.store-custom-select').length, 3);
      assert.strictEqual(h.win.document.querySelectorAll('#store-category-filter-menu .store-filter-option').length, Catalog.CATEGORIES.length + 1);
      assert.strictEqual(h.win.document.querySelectorAll('#store-category-filter-menu .store-filter-visual svg').length, Catalog.CATEGORIES.length + 1);
      assert.ok(h.win.document.querySelector('#store-token-filter-menu [data-filter-value="USDT"] img[src="assets/usdt.svg"]'));
      assert.ok(h.win.document.querySelector('#store-token-filter-menu [data-filter-value="FTA"] img[src="assets/fta.png"]'));
      assert.strictEqual(h.win.document.querySelector('[data-store-i18n="emptyMessage"]'), null);
      assert.ok(!h.win.document.getElementById('view-store').textContent.includes('Les nouveaux produits physiques apparaîtront ici.'));
      const tokenTrigger = h.win.document.getElementById('store-token-filter-trigger');
      tokenTrigger.click();
      assert.strictEqual(tokenTrigger.getAttribute('aria-expanded'), 'true');
      h.win.document.querySelector('#store-token-filter-menu [data-filter-value="FTA"]').click();
      assert.strictEqual(h.win.document.getElementById('store-token-filter').value, 'FTA');
      assert.strictEqual(h.win.document.querySelectorAll('#store-product-grid .store-product-card').length, 1);
      assert.ok(tokenTrigger.querySelector('img[src="assets/fta.png"]'));
      h.win.document.getElementById('store-category-filter-trigger').click();
      h.win.document.querySelector('#store-category-filter-menu [data-filter-value="home"]').click();
      assert.strictEqual(h.win.document.getElementById('store-category-filter').value, 'home');
      assert.strictEqual(h.win.document.querySelectorAll('#store-product-grid .store-product-card').length, 0);
      tokenTrigger.click();
      h.win.document.querySelector('#store-token-filter-menu [data-filter-value="all"]').click();
      assert.strictEqual(h.win.document.getElementById('store-token-filter').value, 'all');
      assert.strictEqual(tokenTrigger.querySelectorAll('.store-filter-dual img').length, 2);
      h.win.document.getElementById('store-category-filter-trigger').click();
      h.win.document.dispatchEvent(new h.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert.strictEqual(h.win.document.getElementById('store-category-filter-trigger').getAttribute('aria-expanded'), 'false');
      h.win.document.getElementById('store-search-input').value = 'no-result-for-this-search';
      h.center.renderProducts();
      assert.strictEqual(h.win.document.querySelectorAll('#store-product-grid .store-product-card').length, 0);
      assert.ok(!h.win.document.getElementById('store-empty').classList.contains('hidden'));
    } finally { h.close(); }
  });

  await runTest('Ruban international : masqué sans configuration puis drapeaux animés de droite à gauche', async () => {
    const h = await createHarness();
    try {
      const section = h.win.document.getElementById('store-delivery-network');
      assert.ok(section.classList.contains('hidden'));
      assert.strictEqual(h.win.document.querySelectorAll('.store-country-card').length, 0);
      const configured = h.getManifest();
      configured.shippingCountries = ['FR', 'DE', 'CI'];
      h.setManifest(configured);
      await h.center.refresh({ force: true });
      assert.ok(!section.classList.contains('hidden'));
      assert.strictEqual(h.win.document.querySelectorAll('.store-country-group').length, 2);
      assert.strictEqual(h.win.document.querySelectorAll('.store-country-card').length, 18);
      assert.strictEqual(h.win.document.querySelectorAll('.store-country-group')[0].querySelectorAll('[role="listitem"]').length, 3);
      assert.strictEqual(h.win.document.querySelector('.store-country-flag').getAttribute('src'), 'assets/flags/fr.svg');
      assert.ok(h.win.document.querySelector('.store-country-group').textContent.includes('France'));
      assert.ok(h.win.document.querySelector('.store-country-group').textContent.includes('Germany'));
      assert.strictEqual(h.win.document.querySelectorAll('.store-country-group')[1].getAttribute('aria-hidden'), 'true');
      assert.strictEqual(h.win.document.getElementById('store-country-track').style.getPropertyValue('--store-country-duration'), '28s');
      const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
      assert.ok(css.includes('@keyframes store-countries-scroll'));
      assert.ok(css.includes('translate3d(-50%,0,0)'));
      section.querySelectorAll('.store-country-flag').forEach((image) => {
        assert.ok(image.getAttribute('src').startsWith('assets/flags/'), 'Chaque drapeau est un actif local embarqué');
        assert.strictEqual(image.getAttribute('alt'), '');
      });
      h.app.currentLang = 'fr';
      h.center.render();
      assert.ok(h.win.document.querySelector('.store-country-group').textContent.includes('Allemagne'));
      h.center.manifest.shippingCountries = ['FR'];
      h.center.renderDeliveryCountries();
      assert.strictEqual(h.win.document.querySelectorAll('.store-country-group')[0].children.length, 8, 'Un seul pays remplit encore le ruban sans vide');
      assert.strictEqual(h.win.document.querySelectorAll('.store-country-group')[0].querySelectorAll('[role="listitem"]').length, 1, 'La répétition visuelle reste invisible aux lecteurs d’écran');
    } finally { h.close(); }
  });

  await runTest('Images produit : photo admin locale, secours GitHub et repli contrôlé', async () => {
    const h = await createHarness();
    try {
      const published = Catalog.validateManifest(JSON.parse(fs.readFileSync(path.join(ROOT, 'store-products.json'), 'utf8')));
      const publishedProduct = published.products.find((item) => item.image);
      assert.ok(publishedProduct, 'Le catalogue contient le produit avec photo publié depuis l’admin');
      assert.ok(fs.statSync(path.join(ROOT, publishedProduct.image)).size > 1000, 'La photo WebP publiée est bien embarquable dans l’APK');
      h.center.manifest = { version: 1, enabled: true, products: [publishedProduct] };
      h.center.renderProducts();
      const image = h.win.document.querySelector('#store-product-grid .store-product-image');
      assert.ok(image);
      assert.strictEqual(image.getAttribute('src'), publishedProduct.image, 'La photo locale embarquée est utilisée avant le logo');
      assert.strictEqual(image.dataset.storeImageSource, 'local');
      assert.ok(!image.classList.contains('store-image-fallback'));
      assert.strictEqual(image.referrerPolicy, 'no-referrer');

      image.dispatchEvent(new h.win.Event('error'));
      assert.strictEqual(image.dataset.storeImageSource, 'remote');
      assert.strictEqual(image.getAttribute('src'), new URL(publishedProduct.image, 'https://raw.githubusercontent.com/web3service/fitia-mining-pro/main/store-products.json').href, 'Une nouvelle photo admin pas encore embarquée est recherchée sur GitHub');
      assert.ok(!image.classList.contains('store-image-fallback'));

      image.dispatchEvent(new h.win.Event('error'));
      assert.strictEqual(image.dataset.storeImageSource, 'fallback');
      assert.strictEqual(image.getAttribute('src'), 'assets/icon-192.png');
      assert.ok(image.classList.contains('store-image-fallback'));
      image.dispatchEvent(new h.win.Event('error'));
      assert.strictEqual(image.getAttribute('src'), 'assets/icon-192.png', 'Le repli ne crée aucune boucle d’erreur');
    } finally { h.close(); }
  });

  for (const token of ['USDT', 'FTA']) {
    await runTest(`Paiement ${token} : transmission automatique au vendeur, suivi et aucune donnée privée locale`, async () => {
      const h = await createHarness(token);
      h.center.orderMaxAttempts = 3;
      h.center.orderRetryDelayMs = 1;
      try {
        h.center.addToCart(h.productId);
        h.center.addToCart(h.productId);
        await h.center.openCheckout();
        assert.ok(h.win.document.getElementById('modal-store-checkout').classList.contains('active'));
        h.fillShipping();
        await h.center.pay({ preventDefault() {} });
        await waitFor(() => h.center.orders[0]?.status === 'paid', `${token} order sent`);
        assert.strictEqual(h.transfers.length, 1);
        assert.strictEqual(h.transfers[0].symbol, token);
        assert.strictEqual(h.transfers[0].to, h.win.ethers.getAddress(token === 'USDT' ? RECEIVER_USDT : RECEIVER_FTA));
        assert.strictEqual(h.transfers[0].amount, token === 'USDT' ? 26000000n : 700000000n);
        assert.strictEqual(h.pinTitles.length, 1);
        assert.ok(h.pinTitles[0].includes(token === 'USDT' ? '26 USDT' : '7 FTA'));
        assert.strictEqual(h.center.cart.length, 0);
        assert.strictEqual(h.center.orders.length, 1);
        assert.strictEqual(h.center.orders[0].txHash, h.hash);
        assert.strictEqual(h.serverDeliveries.size, 1);
        assert.strictEqual(h.serverDeliveries.get(h.center.orders[0].id).address, '1 Private Test Street');
        assert.deepStrictEqual(h.orderRequests.map((request) => request.action), ['create', 'attach']);
        assert.ok(h.orderRequests.every((request) => request.signature));
        const serializedStorage = Object.keys(h.win.localStorage).map((key) => h.win.localStorage.getItem(key)).join('\n');
        for (const privateValue of ['Alice Example', '+49 170 0000000', '1 Private Test Street', 'Private delivery note']) {
          assert.ok(!serializedStorage.includes(privateValue), `Donnée privée persistée: ${privateValue}`);
        }
        assert.ok(!h.win.document.getElementById('store-receipt-content').textContent.includes('Alice Example'));
        assert.ok(h.win.document.getElementById('store-receipt-content').textContent.includes(h.center.orders[0].orderNumber));
        assert.strictEqual(h.sharedTexts.length, 0, 'Le client ne doit plus partager de reçu');
        assert.strictEqual(h.win.document.getElementById('store-receipt-share'), null);
        h.center.openOrders();
        await waitFor(() => h.win.document.querySelectorAll('#store-orders-list .store-order-card').length === 1, 'order tracking card');
        assert.strictEqual(h.win.document.querySelectorAll('#store-orders-list .store-order-step.done').length, 1);
        await h.center.ordersRefreshPromise;
        h.center.setAccount(null);
        assert.strictEqual(h.center.orders.length, 0);
        assert.strictEqual(h.win.document.getElementById('store-shipping-name').value, '');
      } finally { h.close(); }
    });
  }

  await runTest('Sécurité : un prix modifié avant signature bloque le transfert', async () => {
    const h = await createHarness();
    try {
      h.center.addToCart('product-phone');
      await h.center.openCheckout();
      h.fillShipping();
      const changed = h.getManifest();
      changed.products[0].price = '99';
      h.setManifest(changed);
      await h.center.pay({ preventDefault() {} });
      assert.strictEqual(h.transfers.length, 0);
      assert.strictEqual(h.pinTitles.length, 0);
      assert.strictEqual(h.center.orders.length, 0);
      assert.strictEqual(h.center.cart.length, 1);
      assert.ok(h.toasts.some((entry) => entry.message.includes('catalog changed')));
    } finally { h.close(); }
  });

  await runTest('Sécurité : solde insuffisant ou vérification en ligne impossible = aucun transfert', async () => {
    const h = await createHarness('USDT', { balance: 1 });
    try {
      h.center.addToCart('product-phone');
      await h.center.openCheckout();
      h.fillShipping();
      await h.center.pay({ preventDefault() {} });
      assert.strictEqual(h.transfers.length, 0);
      assert.strictEqual(h.pinTitles.length, 0);
      assert.ok(h.win.document.getElementById('store-checkout-error').textContent.includes('Insufficient funds'));
      h.win.fetch = async () => { throw new Error('offline'); };
      h.app.usdtToken.balanceOf = async () => h.win.ethers.parseUnits('100', 6);
      await h.center.pay({ preventDefault() {} });
      assert.strictEqual(h.transfers.length, 0);
      assert.strictEqual(h.pinTitles.length, 0);
    } finally { h.close(); }
  });

  await runTest('Sécurité : une transaction revertée est échouée et jamais visible comme commande payée', async () => {
    const h = await createHarness('USDT', { revert: true });
    h.center.orderMaxAttempts = 2;
    h.center.orderRetryDelayMs = 1;
    try {
      h.center.addToCart('product-phone');
      await h.center.openCheckout();
      h.fillShipping();
      await h.center.pay({ preventDefault() {} });
      await waitFor(() => h.center.orders[0]?.status === 'failed', 'failed transaction status');
      assert.strictEqual(h.transfers.length, 1);
      assert.strictEqual(h.serverOrders.get(h.center.orders[0].id).status, 'awaiting_payment');
      assert.ok(h.win.document.getElementById('store-receipt-status').textContent.includes('failed on-chain'));
      h.serverOrders.get(h.center.orders[0].id).status = 'payment_pending';
      await h.center.refreshOrders();
      assert.strictEqual(h.center.orders[0].status, 'failed', 'Un paiement échoué ne redevient pas simplement en attente');
      assert.strictEqual(h.sharedTexts.length, 0);
      assert.ok(h.toasts.some((entry) => entry.message.includes('failed on-chain')));
    } finally { h.close(); }
  });

  await runTest('Sécurité : 403 réseau en attente et exception de revert réellement échouée', async () => {
    const pendingHarness = await createHarness('USDT', { attachFailures: Infinity, waitThrows: { code: 'SERVER_ERROR', message: 'server response 403' } });
    pendingHarness.center.orderMaxAttempts = 2;
    pendingHarness.center.orderRetryDelayMs = 1;
    try {
      pendingHarness.center.addToCart('product-phone');
      await pendingHarness.center.openCheckout();
      pendingHarness.fillShipping();
      await pendingHarness.center.pay({ preventDefault() {} });
      await waitFor(() => pendingHarness.center.orders[0]?.status === 'payment_pending', 'pending after RPC 403');
      const pendingToast = pendingHarness.toasts.at(-1);
      assert.ok(pendingToast.message.includes('confirmation is still pending'));
      assert.strictEqual(pendingToast.isError, false);
      assert.strictEqual(pendingToast.tone, 'pending');
      assert.ok(!pendingToast.message.includes('403'));
    } finally { pendingHarness.close(); }

    const failedHarness = await createHarness('USDT', { revertThrows: true });
    failedHarness.center.orderMaxAttempts = 2;
    failedHarness.center.orderRetryDelayMs = 1;
    try {
      failedHarness.center.addToCart('product-phone');
      await failedHarness.center.openCheckout();
      failedHarness.fillShipping();
      await failedHarness.center.pay({ preventDefault() {} });
      await waitFor(() => failedHarness.center.orders[0]?.status === 'failed', 'thrown revert status');
      assert.ok(failedHarness.toasts.at(-1).message.includes('failed on-chain'));
      assert.strictEqual(failedHarness.toasts.at(-1).isError, true);
    } finally { failedHarness.close(); }
  });

  await runTest('Sécurité : échec de préparation de la commande = ni PIN ni transfert', async () => {
    const h = await createHarness('USDT', { createFails: true });
    try {
      h.center.addToCart('product-phone');
      await h.center.openCheckout();
      h.fillShipping();
      await h.center.pay({ preventDefault() {} });
      assert.strictEqual(h.transfers.length, 0);
      assert.strictEqual(h.pinTitles.length, 0);
      assert.strictEqual(h.serverOrders.size, 0);
      assert.ok(h.win.document.getElementById('store-checkout-error').textContent.includes('could not be prepared'));
    } finally { h.close(); }
  });

  await runTest('Reprise réseau : même transaction, aucun second paiement et suivi d’expédition', async () => {
    const h = await createHarness('USDT', { attachFailures: 1 });
    h.center.orderMaxAttempts = 3;
    h.center.orderRetryDelayMs = 1;
    try {
      h.center.addToCart('product-phone');
      await h.center.openCheckout();
      h.fillShipping();
      await h.center.pay({ preventDefault() {} });
      await waitFor(() => h.center.orders[0]?.status === 'paid', 'paid after network retry');
      assert.strictEqual(h.transfers.length, 1);
      assert.strictEqual(h.pinTitles.length, 1);
      assert.strictEqual(h.orderRequests.filter((request) => request.action === 'attach').length, 2);
      h.center.setLocalOrderStatus(h.center.orders[0].id, 'payment_pending');
      h.center.resumePendingOrders();
      await waitFor(() => h.center.orders[0]?.status === 'paid', 'automatic unlock recovery');
      await h.center.ordersRefreshPromise;
      assert.strictEqual(h.transfers.length, 1, 'La reprise automatique ne paie jamais une seconde fois');
      const serverOrder = h.serverOrders.get(h.center.orders[0].id);
      serverOrder.status = 'shipped';
      serverOrder.carrier = 'DHL';
      serverOrder.trackingNumber = 'TRACK-PRIVATE-123';
      h.center.openOrders();
      await waitFor(() => h.center.orders[0]?.status === 'shipped', 'shipped tracking refresh');
      assert.strictEqual(h.transfers.length, 1, 'Le suivi ne doit jamais créer un autre transfert');
      const card = h.win.document.querySelector('#store-orders-list .store-order-card');
      assert.ok(card.textContent.includes('DHL'));
      assert.ok(card.textContent.includes('TRACK-PRIVATE-123'));
      assert.strictEqual(card.querySelectorAll('.store-order-step.done').length, 3);
      await h.center.ordersRefreshPromise;
      const serializedStorage = Object.keys(h.win.localStorage).map((key) => h.win.localStorage.getItem(key)).join('\n');
      assert.ok(!serializedStorage.includes('1 Private Test Street'));
    } finally { h.close(); }
  });

  await runTest('Suivi continu : réouverture, actualisation automatique et arrêt après livraison', async () => {
    const h = await createHarness('USDT');
    h.center.orderMaxAttempts = 3;
    h.center.orderRetryDelayMs = 1;
    try {
      h.center.addToCart('product-phone');
      await h.center.openCheckout();
      h.fillShipping();
      await h.center.pay({ preventDefault() {} });
      await waitFor(() => h.center.orders[0]?.status === 'paid', 'paid before automatic tracking');
      h.center.orderAutoRefreshDelayMs = 5;
      h.center.openOrders();
      await waitFor(() => h.center.orderAutoRefreshTimer !== null, 'automatic tracking scheduled');
      const serverOrder = h.serverOrders.get(h.center.orders[0].id);
      serverOrder.status = 'shipped';
      serverOrder.carrier = 'DHL';
      serverOrder.trackingNumber = 'TRACK-AUTO-123';
      serverOrder.updatedAt = new Date().toISOString();
      await waitFor(() => h.center.orders[0]?.status === 'shipped', 'automatic shipped update');
      let card = h.win.document.querySelector('#store-orders-list .store-order-card');
      assert.strictEqual(card.querySelectorAll('.store-order-step.done').length, 3);
      assert.ok(card.textContent.includes('TRACK-AUTO-123'));
      assert.ok(card.textContent.includes('Last update'));
      assert.strictEqual(h.win.document.getElementById('store-order-count').textContent, '1');
      h.app.closeModals();
      assert.strictEqual(h.center.orderAutoRefreshTimer, null, 'Fermer le suivi arrête les requêtes programmées');
      h.center.openOrders();
      await waitFor(() => h.center.orderAutoRefreshTimer !== null, 'tracking resumes on reopening');
      serverOrder.status = 'delivered';
      serverOrder.updatedAt = new Date().toISOString();
      await waitFor(() => h.center.orders[0]?.status === 'delivered' && h.center.orderAutoRefreshTimer === null, 'automatic stop after delivery');
      card = h.win.document.querySelector('#store-orders-list .store-order-card');
      assert.strictEqual(card.querySelectorAll('.store-order-step.done').length, 4);
      assert.ok(h.win.document.getElementById('store-order-count').classList.contains('hidden'));
      assert.strictEqual(h.transfers.length, 1, 'Le suivi automatique ne crée jamais un second paiement');
      h.center.showReceipt(h.center.orders[0].id);
      assert.strictEqual(h.win.document.querySelectorAll('#store-receipt-content .store-order-step.done').length, 4);
      assert.strictEqual(h.center.orderAutoRefreshTimer, null, 'Une commande livrée reste consultable sans polling');
    } finally { h.close(); }
  });

  await runTest('Sécurité : verrouillage ou changement de wallet pendant le PIN bloque le transfert', async () => {
    const h = await createHarness('USDT', { lockOnPin: true });
    try {
      h.center.addToCart('product-phone');
      await h.center.openCheckout();
      h.fillShipping();
      await h.center.pay({ preventDefault() {} });
      assert.strictEqual(h.pinTitles.length, 1);
      assert.strictEqual(h.transfers.length, 0);
      assert.strictEqual(h.center.orders.length, 0);
      assert.strictEqual(h.serverOrders.size, 1, 'La commande temporaire peut exister, mais aucun transfert ne doit partir');
    } finally { h.close(); }
  });

  console.log('═'.repeat(68));
  console.log(`📊 RÉSULTAT STORE : ${passed} réussis, ${failed} échoués`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
