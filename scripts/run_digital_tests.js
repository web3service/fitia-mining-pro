#!/usr/bin/env node
'use strict';

const assert = require('assert');
const http = require('http');
const ethers = require('../vendor/ethers.umd.min.js');
const Catalog = require('../store-catalog');
const Digital = require('../digital-inventory');
const handler = require('../api/store-digital');
const adminHandler = require('../api/admin');

const PASSWORD = 'digital-test-password-123';
const TOKEN = 'digital-test-token-not-real';
const DIGITAL_KEY = 'a1'.repeat(32);
const SUPABASE_URL = 'https://project.supabase.co';
const SUPABASE_KEY = 'sb_secret_fitia_test_key_not_real_1234567890abcdef';
const SUPABASE_BUCKET = 'fitia-paid-private';
const CONFIG = {
  password: PASSWORD, githubToken: TOKEN, digitalKey: DIGITAL_KEY, owner: 'web3service', repo: 'fitia-mining-pro',
  branch: 'main', apiBase: 'https://api.github.com', supabaseUrl: SUPABASE_URL,
  supabaseServiceRoleKey: SUPABASE_KEY, supabaseBucket: SUPABASE_BUCKET
};
const SELLER = '0x1111111111111111111111111111111111111111';
const USDT = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const originalFetch = global.fetch;
const files = new Map();
const externalAssets = new Map();
const receipts = new Map();
let revision = 0;
let supabaseRequests = 0;
let rpcCalls = 0;
let lastReceiptHash = '';
let passed = 0;
let failed = 0;

function responseJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function putFile(target, content) {
  const sha = `test-revision-${++revision}`;
  files.set(target, { content: Buffer.from(content), sha });
  return sha;
}

global.fetch = async (url, init = {}) => {
  const target = String(url);
  if (target.startsWith('http://127.0.0.1:')) return originalFetch(url, init);
  if (target.startsWith(`${SUPABASE_URL}/storage/v1/`)) {
    supabaseRequests += 1;
    assert.strictEqual(init.headers?.Authorization, undefined, 'Une clé sb_secret_ ne doit pas être utilisée comme JWT Bearer');
    assert.strictEqual(init.headers?.apikey, SUPABASE_KEY);
    const upload = target.match(/\/object\/fitia-paid-private\/paid\/([a-f0-9]{24})\.bin$/);
    const download = target.match(/\/object\/authenticated\/fitia-paid-private\/paid\/([a-f0-9]{24})\.bin$/);
    assert.ok(upload || download, `URL Supabase inattendue: ${target}`);
    const assetId = (upload || download)[1];
    if (upload) {
      assert.strictEqual(init.method, 'POST');
      assert.strictEqual(init.headers?.['x-upsert'], 'false');
      assert.ok(!externalAssets.has(assetId), 'Un ciphertext externe ne doit pas être écrasé');
      externalAssets.set(assetId, Buffer.from(init.body));
      return responseJson({ Key: `paid/${assetId}.bin` }, 200);
    }
    const content = externalAssets.get(assetId);
    if (!content) return responseJson({ message: 'not found' }, 404);
    return new Response(content, { status: 200, headers: { 'Content-Length': String(content.length) } });
  }
  if (target.startsWith('https://api.github.com/')) {
    const match = target.match(/\/contents\/([^?]+)(?:\?.*)?$/);
    assert.ok(match, `URL GitHub inattendue: ${target}`);
    const filePath = decodeURIComponent(match[1]);
    assert.ok(!filePath.startsWith('digital-assets/'), 'Aucun octet de fichier payant ne doit partir vers GitHub');
    assert.ok(!JSON.stringify(init.headers || {}).includes(SUPABASE_KEY), 'La clé Supabase ne doit jamais être transmise à GitHub');
    if ((init.method || 'GET') === 'PUT') {
      const body = JSON.parse(init.body);
      const current = files.get(filePath);
      if ((body.sha && (!current || current.sha !== body.sha)) || (!body.sha && current)) return responseJson({ message: 'conflict' }, 409);
      const sha = putFile(filePath, Buffer.from(body.content, 'base64'));
      return responseJson({ content: { sha } });
    }
    const current = files.get(filePath);
    if (!current) return responseJson({ message: 'not found' }, 404);
    const accept = String(init.headers?.Accept || '');
    if (accept.includes('raw')) return new Response(current.content, { status: 200 });
    return responseJson({ sha: current.sha, encoding: 'base64', content: current.content.toString('base64') });
  }
  if (/^https:\/\/(polygon-rpc\.com|polygon-bor-rpc\.publicnode\.com|1rpc\.io)/.test(target)) {
    rpcCalls += 1;
    const body = JSON.parse(init.body);
    if (body.method === 'eth_getTransactionReceipt') {
      lastReceiptHash = body.params[0];
      return responseJson({ jsonrpc: '2.0', id: 1, result: receipts.get(lastReceiptHash)?.receipt || null });
    }
    if (body.method === 'eth_blockNumber') {
      return responseJson({ jsonrpc: '2.0', id: 1, result: receipts.get(lastReceiptHash)?.latest || '0x67' });
    }
    throw new Error(`RPC inattendu ${body.method}`);
  }
  throw new Error(`URL inattendue: ${target}`);
};

function product(overrides = {}) {
  return {
    id: 'product-base', active: true, sourceType: 'own', type: 'physical', category: 'electronics',
    name: { en: 'Test product' }, description: {}, image: '', sellerId: 'seller-test', sellerName: 'Seller',
    sellerContact: '@seller', paymentAddress: SELLER, priceToken: 'USDT', price: '1', shippingFee: '0',
    stock: 20, deliveryEstimate: 'Instant after confirmed payment', ...overrides
  };
}

function setCatalog(products) {
  const manifest = Catalog.validateManifest({ version: 1, enabled: true, products });
  putFile('store-products.json', JSON.stringify(manifest));
  return manifest;
}

function topic(address) {
  return `0x${address.slice(2).toLowerCase().padStart(64, '0')}`;
}

function registerPayment(txHash, buyer, amount, latest = '0x67', overrides = {}) {
  receipts.set(txHash, {
    latest,
    receipt: {
      transactionHash: txHash, status: '0x1', from: buyer, to: USDT, blockNumber: '0x64',
      logs: [{ address: USDT, topics: [TRANSFER, topic(buyer), topic(SELLER)], data: `0x${amount.toString(16).padStart(64, '0')}` }],
      ...overrides
    }
  });
}

async function signedRequest(wallet, txHash, items, base) {
  const issued = await post(base, { action: 'intent', token: 'USDT', items });
  assert.strictEqual(issued.response.status, 200, JSON.stringify(issued.data));
  const request = {
    txHash, buyer: wallet.address.toLowerCase(), token: 'USDT', items,
    paymentIntent: issued.data.paymentIntent,
    expiresAt: Date.now() + 10 * 60 * 1000
  };
  request.signature = await wallet.signMessage(handler.deliveryMessage(request));
  return request;
}

async function post(base, body) {
  const response = await originalFetch(`${base}/api/store-digital`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return { response, data: await response.json() };
}

async function adminRequest(base, action, options = {}) {
  const headers = { Accept: 'application/json' };
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.csrf) headers['X-CSRF-Token'] = options.csrf;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await originalFetch(`${base}/api/admin/${action}`, {
    method: options.method || 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  return { response, data: await response.json() };
}

async function runTest(name, fn) {
  try { await fn(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error.message}`); }
}

(async () => {
  console.log('\n🔐 TESTS FITIA STORE — LIVRAISON NUMÉRIQUE\n' + '═'.repeat(68));
  process.env.FITIA_ADMIN_PASSWORD = PASSWORD;
  process.env.FITIA_GITHUB_TOKEN = TOKEN;
  process.env.FITIA_DIGITAL_VAULT_KEY = DIGITAL_KEY;
  process.env.FITIA_SUPABASE_URL = SUPABASE_URL;
  process.env.FITIA_SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY;
  process.env.FITIA_SUPABASE_BUCKET = SUPABASE_BUCKET;
  delete process.env.FITIA_POLYGON_RPC_URL;
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (pathname.startsWith('/api/admin/')) {
      req.query = { action: pathname.split('/').pop() };
      return adminHandler(req, res);
    }
    return handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const buyer = ethers.Wallet.createRandom();
  const attacker = ethers.Wallet.createRandom();
  const filePlaintext = Buffer.from('FITIA private ebook and software fixture — never public');
  const store = new Digital.GitHubDigitalStore(CONFIG);
  let asset;

  try {
    await runTest('Coffre chiffré : fichier privé externe et aucun octet payant sur GitHub', async () => {
      const updated = await Digital.updateVault(store, async (vault) => {
        const created = Digital.createAsset(vault, {
          productId: 'product-download', data: filePlaintext.toString('base64'),
          fileName: 'guide-private.pdf', contentType: 'application/pdf'
        }, store.key);
        asset = created.asset;
        await store.writeAsset(asset, created.encrypted);
        Digital.addLicenses(vault, { productId: 'product-license', keys: ['LICENSE-ALPHA-001', 'LICENSE-ALPHA-002'] });
        return true;
      });
      assert.strictEqual(Digital.summarize(updated.vault).products.find((entry) => entry.productId === 'product-license').availableLicenses, 2);
      const publicVault = files.get('digital-vault.json').content.toString('utf8');
      const externalAsset = externalAssets.get(asset.id);
      assert.ok(externalAsset, 'Le ciphertext doit être dans le bucket externe privé');
      assert.ok(!files.has(`digital-assets/${asset.id}.bin`), 'Aucun blob payant ne doit exister sur GitHub');
      for (const secret of ['LICENSE-ALPHA-001', 'LICENSE-ALPHA-002', filePlaintext.toString(), filePlaintext.toString('base64'), SUPABASE_KEY]) {
        assert.ok(!publicVault.includes(secret));
        assert.ok(!externalAsset.toString('utf8').includes(secret));
      }
      assert.deepStrictEqual(Digital.decryptAsset(externalAsset, store.key, asset), filePlaintext);
      assert.throws(() => Digital.decryptVault(JSON.parse(publicVault), Digital.deriveKey({ password: 'wrong-password-123', githubToken: 'wrong-token' })), Digital.DigitalError);
      assert.throws(() => Catalog.validateManifest({ version: 1, enabled: true, products: [product({ type: 'license', shippingFee: '1' })] }), /frais postaux/);
    });

    await runTest('Sans stockage externe valide : dépôt refusé et aucun repli GitHub ou SSRF', async () => {
      const before = supabaseRequests;
      const missing = new Digital.GitHubDigitalStore({ ...CONFIG, supabaseUrl: '', supabaseServiceRoleKey: '' });
      await assert.rejects(missing.writeAsset(asset, externalAssets.get(asset.id)), (error) => error.code === 'DIGITAL_ASSET_CONFIG');
      const unsafe = new Digital.GitHubDigitalStore({ ...CONFIG, supabaseUrl: 'https://169.254.169.254/latest/meta-data' });
      await assert.rejects(unsafe.writeAsset(asset, externalAssets.get(asset.id)), (error) => error.code === 'DIGITAL_ASSET_CONFIG');
      assert.strictEqual(supabaseRequests, before, 'Aucune requête externe ne doit partir avec une configuration invalide');
      assert.ok(!files.has(`digital-assets/${asset.id}.bin`));
    });

    await runTest('Authentification Supabase : apikey pour sb_secret et Bearer seulement pour JWT legacy', async () => {
      const legacyKey = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature';
      const legacy = new Digital.SupabaseDigitalAssetStorage({ ...CONFIG, supabaseServiceRoleKey: legacyKey }, async (_url, init) => {
        assert.strictEqual(init.headers.apikey, legacyKey);
        assert.strictEqual(init.headers.Authorization, `Bearer ${legacyKey}`);
        return new Response('{}', { status: 200 });
      });
      await legacy.request(`${SUPABASE_URL}/storage/v1/test`);
    });

    await runTest('API admin Vercel : session, CSRF et même clé dédiée que la livraison', async () => {
      const login = await adminRequest(base, 'login', { method: 'POST', body: { password: PASSWORD } });
      assert.strictEqual(login.response.status, 200, JSON.stringify(login.data));
      const cookie = login.response.headers.get('set-cookie').split(';')[0];
      const csrf = login.data.csrfToken;
      const uploaded = await adminRequest(base, 'digital-inventory', {
        method: 'POST', cookie, csrf,
        body: { productType: 'license', productId: 'product-admin-upload', keys: ['ADMIN-VERCEL-KEY-001'] }
      });
      assert.strictEqual(uploaded.response.status, 201, JSON.stringify(uploaded.data));
      assert.ok(!JSON.stringify(uploaded.data).includes('ADMIN-VERCEL-KEY-001'));
      const inventory = await adminRequest(base, 'digital-inventory', { cookie });
      assert.strictEqual(inventory.response.status, 200);
      assert.deepStrictEqual(inventory.data.assetStorage, { provider: 'supabase', configured: true });
      assert.ok(!JSON.stringify(inventory.data).includes(SUPABASE_KEY), 'La clé de service ne doit jamais apparaître dans une réponse admin');
      assert.strictEqual(inventory.data.inventory.products.find((entry) => entry.productId === 'product-admin-upload').availableLicenses, 1);
      assert.ok(!files.get('digital-vault.json').content.toString('utf8').includes('ADMIN-VERCEL-KEY-001'));
    });

    setCatalog([
      product({ id: 'product-download', type: 'download', price: '2', digital: { assetId: asset.id, fileName: asset.fileName, contentType: asset.contentType, size: asset.size } }),
      product({ id: 'product-license', type: 'license', price: '3' }),
      product({ id: 'product-license-empty', type: 'license', price: '4' })
    ]);

    const txHash = `0x${'11'.repeat(32)}`;
    const items = [{ productId: 'product-download', quantity: 1 }, { productId: 'product-license', quantity: 2 }];
    const quote = Catalog.calculateCart(setCatalog([
      product({ id: 'product-download', type: 'download', price: '2', digital: { assetId: asset.id, fileName: asset.fileName, contentType: asset.contentType, size: asset.size } }),
      product({ id: 'product-license', type: 'license', price: '3' }),
      product({ id: 'product-license-empty', type: 'license', price: '4' })
    ]).products, items);
    registerPayment(txHash, buyer.address, quote.totalUnits);
    const request = await signedRequest(buyer, txHash, items, base);
    let firstDeliveries;

    await runTest('Paiement exact : livraison, idempotence et licences attribuées une seule fois', async () => {
      const originalCatalog = files.get('store-products.json').content;
      const changedCatalog = JSON.parse(originalCatalog.toString('utf8'));
      changedCatalog.products.find((entry) => entry.id === 'product-download').price = '99';
      putFile('store-products.json', JSON.stringify(changedCatalog));
      const first = await post(base, request);
      putFile('store-products.json', originalCatalog);
      assert.strictEqual(first.response.status, 200, JSON.stringify(first.data));
      assert.strictEqual(first.data.status, 'complete');
      assert.strictEqual(first.data.deliveries.filter((item) => item.type === 'license').length, 2);
      assert.deepStrictEqual(first.data.deliveries.filter((item) => item.type === 'license').map((item) => item.key).sort(), ['LICENSE-ALPHA-001', 'LICENSE-ALPHA-002']);
      firstDeliveries = first.data.deliveries;
      const before = rpcCalls;
      const repeated = await post(base, request);
      assert.strictEqual(repeated.response.status, 200);
      assert.deepStrictEqual(repeated.data.deliveries.map((item) => item.key).sort(), firstDeliveries.map((item) => item.key).sort());
      assert.strictEqual(rpcCalls, before, 'Une récupération existante ne revérifie pas inutilement le RPC');
      const { vault } = await store.loadVault();
      assert.strictEqual(vault.licenses.filter((entry) => entry.assignedTxHash === txHash).length, 2);
      assert.strictEqual(vault.licenses.filter((entry) => entry.productId === 'product-license' && !entry.assignedTxHash).length, 0);
      assert.strictEqual(vault.orders.length, 1);
      assert.strictEqual(first.data.paymentAddress, undefined, 'La réponse ne doit pas ajouter de données de commande inutiles');
    });

    await runTest('Preuve de propriété : attaquant, rejeu modifié et capability de téléchargement', async () => {
      const forged = { ...request, signature: await attacker.signMessage(handler.deliveryMessage(request)) };
      const forbidden = await post(base, forged);
      assert.strictEqual(forbidden.response.status, 403);
      assert.strictEqual(forbidden.data.code, 'DIGITAL_BUYER_AUTH');

      const changedItems = [{ productId: 'product-download', quantity: 1 }];
      const changed = await post(base, await signedRequest(buyer, txHash, changedItems, base));
      assert.strictEqual(changed.response.status, 409);
      assert.strictEqual(changed.data.code, 'DIGITAL_ORDER_CONFLICT');

      const download = firstDeliveries.find((item) => item.type === 'download');
      const downloaded = await originalFetch(`${base}/api/store-digital?download=${encodeURIComponent(download.downloadToken)}`);
      assert.strictEqual(downloaded.status, 200);
      assert.strictEqual(downloaded.headers.get('content-type'), 'application/pdf');
      assert.ok(downloaded.headers.get('cache-control').includes('no-store'));
      assert.deepStrictEqual(Buffer.from(await downloaded.arrayBuffer()), filePlaintext);
      const tampered = `${download.downloadToken.slice(0, -2)}xx`;
      const rejected = await originalFetch(`${base}/api/store-digital?download=${encodeURIComponent(tampered)}`);
      assert.strictEqual(rejected.status, 403);
    });

    await runTest('Montant incorrect et confirmations insuffisantes : aucune remise anticipée', async () => {
      const badHash = `0x${'22'.repeat(32)}`;
      const badItems = [{ productId: 'product-download', quantity: 1 }];
      registerPayment(badHash, buyer.address, 1999999n);
      const mismatch = await post(base, await signedRequest(buyer, badHash, badItems, base));
      assert.strictEqual(mismatch.response.status, 409);
      assert.strictEqual(mismatch.data.code, 'PAYMENT_MISMATCH');

      const pendingHash = `0x${'33'.repeat(32)}`;
      const pendingItems = [{ productId: 'product-download', quantity: 1 }];
      registerPayment(pendingHash, buyer.address, 2000000n, '0x65');
      const pendingRequest = await signedRequest(buyer, pendingHash, pendingItems, base);
      const pending = await post(base, pendingRequest);
      assert.strictEqual(pending.response.status, 202);
      assert.strictEqual(pending.data.code, 'PAYMENT_CONFIRMATIONS');
      receipts.get(pendingHash).latest = '0x67';
      const confirmed = await post(base, pendingRequest);
      assert.strictEqual(confirmed.response.status, 200, JSON.stringify(confirmed.data));
      assert.strictEqual(confirmed.data.deliveries[0].type, 'download');
    });

    await runTest('Paiement sans clé disponible : commande conservée puis remise après réassort', async () => {
      const waitingHash = `0x${'44'.repeat(32)}`;
      const waitingItems = [{ productId: 'product-license-empty', quantity: 1 }];
      registerPayment(waitingHash, buyer.address, 4000000n);
      const blocked = await post(base, { action: 'intent', token: 'USDT', items: waitingItems });
      assert.strictEqual(blocked.response.status, 409);
      assert.strictEqual(blocked.data.code, 'DIGITAL_INVENTORY_UNAVAILABLE', 'Le paiement doit être bloqué avant transfert si le stock est vide');
      await Digital.updateVault(store, (vault) => Digital.addLicenses(vault, { productId: 'product-license-empty', keys: ['LICENSE-RACE-001'] }));
      const waitingRequest = await signedRequest(buyer, waitingHash, waitingItems, base);
      await Digital.updateVault(store, (vault) => {
        const raced = vault.licenses.find((entry) => entry.productId === 'product-license-empty' && !entry.assignedTxHash);
        raced.assignedTxHash = `0x${'55'.repeat(32)}`;
        raced.assignedBuyer = buyer.address.toLowerCase();
        return true;
      });
      const waiting = await post(base, waitingRequest);
      assert.strictEqual(waiting.response.status, 202);
      assert.strictEqual(waiting.data.code, 'DIGITAL_INVENTORY_PENDING');
      await Digital.updateVault(store, (vault) => Digital.addLicenses(vault, { productId: 'product-license-empty', keys: ['LICENSE-RESTOCK-002'] }));
      const completed = await post(base, waitingRequest);
      assert.strictEqual(completed.response.status, 200, JSON.stringify(completed.data));
      assert.strictEqual(completed.data.deliveries[0].key, 'LICENSE-RESTOCK-002');
      const repeated = await post(base, waitingRequest);
      assert.strictEqual(repeated.data.deliveries[0].key, 'LICENSE-RESTOCK-002');
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    global.fetch = originalFetch;
  }

  console.log('═'.repeat(68));
  console.log(`📊 RÉSULTAT NUMÉRIQUE : ${passed} réussis, ${failed} échoués`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  global.fetch = originalFetch;
  console.error(error);
  process.exit(1);
});
