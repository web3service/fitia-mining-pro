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
  win.eval(fs.readFileSync(path.join(ROOT, 'store.js'), 'utf8'));
  win.CONFIG = {
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    FTA: '0x5c418b12c7e9c2a8e9a71a68c6d9b319e7b1d1fd',
    CORE: '0x1b8edfb91168fb233f8ca7cf1631038ac193d743',
    MINE: '0xbd9fa9801eda247b28b3bb9ddbf1cf52ca563bc6'
  };
  const sharedTexts = [];
  const copiedTexts = [];
  const digitalDownloads = [];
  win.FitiaSecurity = { Native: {
    shareText: async (title, text) => { sharedTexts.push({ title, text }); return true; },
    copyText: async (text) => { copiedTexts.push(text); return true; },
    downloadDigitalProduct: (url, fileName) => { digitalDownloads.push({ url, fileName }); return true; },
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
  if (options.digital || options.digitalDownload) {
    remoteManifest = manifest([product(options.digitalDownload ? {
      id: 'product-download', type: 'download', shippingFee: '0', deliveryEstimate: 'Instant after confirmed payment',
      digital: { assetId: 'a'.repeat(24), fileName: 'buyer-guide.pdf', contentType: 'application/pdf', size: 4 }
    } : {
      id: 'product-license', type: 'license', shippingFee: '0', deliveryEstimate: 'Instant after confirmed payment'
    })]);
  }
  const toasts = [];
  const errors = [];
  const transfers = [];
  const pinTitles = [];
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
  const digitalWallet = options.digital || options.digitalDownload ? win.ethers.Wallet.createRandom() : null;
  const digitalRequests = [];
  const app = {
    currentLang: 'en', user: digitalWallet ? digitalWallet.address : BUYER,
    signer: digitalWallet ? { signMessage: (message) => digitalWallet.signMessage(message) } : {}, usdtDecimals: 6, ftaDecimals: 8,
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
      return { ok: true, json: async () => clone(remoteManifest) };
    }
    if ((options.digital || options.digitalDownload) && String(url).includes('/api/store-digital')) {
      const body = JSON.parse(init.body);
      if (body.action === 'intent') {
        const quote = Catalog.calculateCart(Catalog.validateManifest(clone(remoteManifest)).products, body.items);
        return {
          ok: true, status: 200,
          json: async () => ({
            paymentIntent: 'test-payment-intent.signature',
            intent: {
              v: 1, token: quote.token, totalUnits: quote.totalUnits.toString(), paymentAddress: quote.paymentAddress,
              sellerId: quote.sellerId, expiresAt: Date.now() + 3600000,
              items: quote.items.map((item) => ({ productId: item.product.id, type: item.product.type || 'physical', quantity: item.quantity, assetId: item.product.digital?.assetId || null }))
            }
          })
        };
      }
      digitalRequests.push(body);
      const message = center.digitalMessage(body);
      assert.strictEqual(win.ethers.verifyMessage(message, body.signature).toLowerCase(), digitalWallet.address.toLowerCase());
      return {
        ok: true, status: 200,
        json: async () => ({ status: 'complete', deliveries: [options.digitalDownload ? {
          type: 'download', productId: 'product-download', assetId: 'a'.repeat(24),
          fileName: 'buyer-guide.pdf', contentType: 'application/pdf', size: 4,
          sha256: crypto.createHash('sha256').update('test').digest('hex'), downloadToken: 'download-token.signature'
        } : { type: 'license', productId: 'product-license', key: 'FITIA-TEST-LICENSE-ONLY-IN-MEMORY' }] })
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  center.init();
  await waitFor(() => center.lastFetchAt > 0, 'initial catalog refresh');
  return {
    win, app, center, transfers, pinTitles, toasts, errors, sharedTexts, copiedTexts, digitalDownloads, hash, digitalWallet, digitalRequests,
    productId: options.digitalDownload ? 'product-download' : options.digital ? 'product-license' : token === 'FTA' ? 'product-fta' : 'product-phone',
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
    await runTest(`Paiement ${token} : PIN, montant exact, reçu partagé et aucune adresse postale persistée`, async () => {
      const h = await createHarness(token);
      try {
        h.center.addToCart(h.productId);
        h.center.addToCart(h.productId);
        await h.center.openCheckout();
        assert.ok(h.win.document.getElementById('modal-store-checkout').classList.contains('active'));
        h.fillShipping();
        await h.center.pay({ preventDefault() {} });
        await waitFor(() => h.center.orders[0]?.status === 'confirmed', `${token} confirmation`);
        assert.strictEqual(h.transfers.length, 1);
        assert.strictEqual(h.transfers[0].symbol, token);
        assert.strictEqual(h.transfers[0].to, h.win.ethers.getAddress(token === 'USDT' ? RECEIVER_USDT : RECEIVER_FTA));
        assert.strictEqual(h.transfers[0].amount, token === 'USDT' ? 26000000n : 700000000n);
        assert.strictEqual(h.pinTitles.length, 1);
        assert.ok(h.pinTitles[0].includes(token === 'USDT' ? '26 USDT' : '7 FTA'));
        assert.strictEqual(h.center.cart.length, 0);
        assert.strictEqual(h.center.orders.length, 1);
        assert.strictEqual(h.center.orders[0].txHash, h.hash);
        const serializedStorage = Object.keys(h.win.localStorage).map((key) => h.win.localStorage.getItem(key)).join('\n');
        for (const privateValue of ['Alice Example', '+49 170 0000000', '1 Private Test Street', 'Private delivery note']) {
          assert.ok(!serializedStorage.includes(privateValue), `Donnée privée persistée: ${privateValue}`);
        }
        assert.ok(h.win.document.getElementById('store-receipt-content').textContent.includes('Alice Example'));
        await h.center.shareCurrentReceipt();
        assert.strictEqual(h.sharedTexts.length, 1);
        assert.ok(h.sharedTexts[0].text.includes(h.hash));
        assert.ok(h.sharedTexts[0].text.includes('1 Private Test Street'));
        assert.ok(!h.sharedTexts[0].text.toLowerCase().includes('polygonscan'));
        h.center.setAccount(null);
        assert.strictEqual(h.center.receipts.size, 0);
        assert.strictEqual(h.win.document.getElementById('store-shipping-name').value, '');
      } finally { h.close(); }
    });
  }

  await runTest('Produit numérique : aucun champ postal, signature acheteur et licence jamais persistée', async () => {
    const h = await createHarness('USDT', { digital: true });
    try {
      h.center.addToCart('product-license');
      await h.center.openCheckout();
      assert.ok(h.win.document.getElementById('store-shipping-fields').classList.contains('hidden'));
      for (const id of ['store-shipping-name', 'store-shipping-phone', 'store-shipping-country', 'store-shipping-city', 'store-shipping-address']) {
        assert.strictEqual(h.win.document.getElementById(id).required, false);
      }
      h.win.document.getElementById('store-checkout-consent').checked = true;
      await h.center.pay({ preventDefault() {} });
      await waitFor(() => h.center.orders[0]?.digitalStatus === 'complete', 'livraison de la licence');
      assert.strictEqual(h.transfers.length, 1);
      assert.strictEqual(h.transfers[0].amount, 12500000n, 'Aucun frais postal sur une licence');
      assert.strictEqual(h.digitalRequests.length, 1);
      assert.strictEqual(h.digitalRequests[0].buyer, h.digitalWallet.address.toLowerCase());
      assert.ok(!JSON.stringify(h.digitalRequests[0]).includes('Alice Example'));
      assert.ok(h.win.document.getElementById('store-digital-delivery').textContent.includes('FITIA-TEST-LICENSE-ONLY-IN-MEMORY'));
      assert.ok(h.win.document.getElementById('store-receipt-share').classList.contains('hidden'));
      assert.ok(!h.win.document.getElementById('store-receipt-content').textContent.includes('Delivery details'));
      const serializedStorage = Object.keys(h.win.localStorage).map((key) => h.win.localStorage.getItem(key)).join('\n');
      assert.ok(!serializedStorage.includes('FITIA-TEST-LICENSE-ONLY-IN-MEMORY'), 'La licence ne doit pas être persistée');
      assert.ok(!serializedStorage.includes(h.digitalRequests[0].signature), 'La signature ne doit pas être persistée');
      h.win.document.querySelector('#store-digital-delivery .store-digital-item button').click();
      await waitFor(() => h.copiedTexts.length === 1, 'copie de la licence');
      assert.strictEqual(h.copiedTexts[0], 'FITIA-TEST-LICENSE-ONLY-IN-MEMORY');
      h.center.setAccount(null);
      assert.strictEqual(h.center.digitalDeliveries.size, 0, 'Les licences en mémoire sont effacées au verrouillage');
    } finally { h.close(); }
  });

  await runTest('Téléchargement numérique : capability transmise au natif sans persistance', async () => {
    const h = await createHarness('USDT', { digitalDownload: true });
    try {
      h.center.addToCart('product-download');
      await h.center.openCheckout();
      h.win.document.getElementById('store-checkout-consent').checked = true;
      await h.center.pay({ preventDefault() {} });
      await waitFor(() => h.center.orders[0]?.digitalStatus === 'complete', 'préparation du téléchargement');
      h.win.document.querySelector('#store-digital-delivery .store-digital-item button').click();
      await waitFor(() => h.digitalDownloads.length === 1, 'téléchargement natif');
      assert.strictEqual(h.digitalDownloads[0].fileName, 'buyer-guide.pdf');
      assert.ok(h.digitalDownloads[0].url.startsWith('https://fitia-mining-pro.vercel.app/api/store-digital?download=download-token.signature'));
      const serializedStorage = Object.keys(h.win.localStorage).map((key) => h.win.localStorage.getItem(key)).join('\n');
      assert.ok(!serializedStorage.includes('download-token.signature'), 'La capability ne doit pas être persistée');
      assert.ok(!serializedStorage.includes('PRIVATE-FILE-CONTENT'));
    } finally { h.close(); }
  });

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

  await runTest('Sécurité : une transaction revertée est marquée échouée et non partageable comme paiement', async () => {
    const h = await createHarness('USDT', { revert: true });
    try {
      h.center.addToCart('product-phone');
      await h.center.openCheckout();
      h.fillShipping();
      await h.center.pay({ preventDefault() {} });
      await waitFor(() => h.center.orders[0]?.status === 'failed', 'failed transaction status');
      assert.strictEqual(h.transfers.length, 1);
      assert.ok(h.win.document.getElementById('store-receipt-share').classList.contains('hidden'));
      await h.center.shareCurrentReceipt();
      assert.strictEqual(h.sharedTexts.length, 0);
      assert.ok(h.toasts.some((entry) => entry.message.includes('failed on-chain')));
    } finally { h.close(); }
  });

  await runTest('Sécurité : 403 réseau en attente et exception de revert réellement échouée', async () => {
    const pendingHarness = await createHarness('USDT', { waitThrows: { code: 'SERVER_ERROR', message: 'server response 403' } });
    try {
      pendingHarness.center.addToCart('product-phone');
      await pendingHarness.center.openCheckout();
      pendingHarness.fillShipping();
      await pendingHarness.center.pay({ preventDefault() {} });
      await waitFor(() => pendingHarness.center.orders[0]?.status === 'submitted', 'submitted after RPC 403');
      const pendingToast = pendingHarness.toasts.at(-1);
      assert.ok(pendingToast.message.includes('confirmation is still pending'));
      assert.strictEqual(pendingToast.isError, false);
      assert.strictEqual(pendingToast.tone, 'pending');
      assert.ok(!pendingToast.message.includes('403'));
    } finally { pendingHarness.close(); }

    const failedHarness = await createHarness('USDT', { revertThrows: true });
    try {
      failedHarness.center.addToCart('product-phone');
      await failedHarness.center.openCheckout();
      failedHarness.fillShipping();
      await failedHarness.center.pay({ preventDefault() {} });
      await waitFor(() => failedHarness.center.orders[0]?.status === 'failed', 'thrown revert status');
      assert.ok(failedHarness.toasts.at(-1).message.includes('failed on-chain'));
      assert.strictEqual(failedHarness.toasts.at(-1).isError, true);
      assert.ok(failedHarness.win.document.getElementById('store-receipt-share').classList.contains('hidden'));
    } finally { failedHarness.close(); }
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
      assert.strictEqual(h.center.receipts.size, 0);
    } finally { h.close(); }
  });

  console.log('═'.repeat(68));
  console.log(`📊 RÉSULTAT STORE : ${passed} réussis, ${failed} échoués`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
