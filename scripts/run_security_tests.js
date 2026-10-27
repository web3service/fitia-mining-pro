#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  SUITE D'AUDIT SÉCURITÉ & TESTS E2E — FITIA PRO MINER V3.3.25 (STANDALONE)
// ═══════════════════════════════════════════════════════════════════════════
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const { JSDOM } = require(
  fs.existsSync('/tmp/test-deps/node_modules/jsdom')
    ? '/tmp/test-deps/node_modules/jsdom'
    : 'jsdom'
);

let passed = 0;
let failed = 0;

async function runTest(suiteName, testName, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ [${suiteName}] ${testName}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ [${suiteName}] ${testName}\n     ↳ ${err.stack || err.message}`);
  }
}

async function withDeadline(promise, timeoutMs, message) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ─── Simulateur IndexedDB fidèle (supporte les CryptoKey non-exportables !) ───
function createMockIndexedDB() {
  const stores = { kv: new Map() };

  function makeReq(executor) {
    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      try {
        req.result = executor();
        if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
      } catch (e) {
        req.error = e;
        if (typeof req.onerror === 'function') req.onerror({ target: req });
      }
    });
    return req;
  }

  return {
    _stores: stores,
    open(_name, _version) {
      const openReq = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        const db = {
          objectStoreNames: { contains: (n) => Boolean(stores[n]) },
          createObjectStore: (n) => {
            if (!stores[n]) stores[n] = new Map();
            return stores[n];
          },
          transaction(storeName, _mode) {
            const map = stores[storeName] || (stores[storeName] = new Map());
            const tx = {
              oncomplete: null,
              onerror: null,
              objectStore() {
                return {
                  get: (k) => makeReq(() => map.get(k)),
                  put: (v, k) => {
                    const r = makeReq(() => { map.set(k, v); return k; });
                    queueMicrotask(() => { if (typeof tx.oncomplete === 'function') tx.oncomplete(); });
                    return r;
                  },
                  delete: (k) => {
                    const r = makeReq(() => { map.delete(k); return true; });
                    queueMicrotask(() => { if (typeof tx.oncomplete === 'function') tx.oncomplete(); });
                    return r;
                  }
                };
              }
            };
            return tx;
          },
          close() {}
        };
        openReq.result = db;
        if (typeof openReq.onupgradeneeded === 'function') openReq.onupgradeneeded({ target: openReq });
        if (typeof openReq.onsuccess === 'function') openReq.onsuccess({ target: openReq });
      });
      return openReq;
    }
  };
}

// ─── Simulateur fidèle du pont Android (@JavascriptInterface FitiaBridge) ───
function createMockAndroidBridge() {
  const hardwareTeeKey = crypto.randomBytes(32); // Simule la clé matérielle TEE AndroidKeyStore
  const state = {
    screenSecure: true,
    pinGuardJson: '',
    clipboard: '',
    lastClearDelayMs: 0,
    vibrations: 0,
    appVersionCode: 0,
    appVersionName: '',
    updateDownloads: [],
    sharedTexts: [],
    pendingReferralCode: ''
  };

  return {
    _state: state,
    isNativeApk: () => true,
    getAppVersionCode: () => state.appVersionCode,
    getAppVersionName: () => state.appVersionName,
    consumeReferralDeepLink: () => {
      const code = state.pendingReferralCode;
      state.pendingReferralCode = '';
      return code;
    },
    downloadAndInstallUpdate: (url, expectedSha256) => {
      state.updateDownloads.push({ url: String(url), expectedSha256: String(expectedSha256) });
      return true;
    },
    vibrate: () => { state.vibrations++; },
    setScreenSecure: (enable) => { state.screenSecure = Boolean(enable); },
    copyText: (t) => { state.clipboard = String(t || ''); },
    copySensitiveText: (t, clearDelayMs) => {
      state.clipboard = String(t || '');
      state.lastClearDelayMs = Number(clearDelayMs);
    },
    shareText: (title, text) => { state.sharedTexts.push({ title: String(title || ''), text: String(text || '') }); },
    setPinGuardState: (json) => { state.pinGuardJson = String(json || ''); },
    getPinGuardState: () => state.pinGuardJson,
    sealVault: (plainText) => {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', hardwareTeeKey, iv);
      const enc = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `AKS1:${iv.toString('base64')}:${Buffer.concat([enc, tag]).toString('base64')}`;
    },
    unsealVault: (sealedPayload) => {
      if (!sealedPayload || !sealedPayload.startsWith('AKS1:')) return sealedPayload;
      const parts = sealedPayload.split(':');
      if (parts.length !== 3) return '';
      try {
        const iv = Buffer.from(parts[1], 'base64');
        const raw = Buffer.from(parts[2], 'base64');
        const enc = raw.subarray(0, raw.length - 16);
        const tag = raw.subarray(raw.length - 16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', hardwareTeeKey, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
      } catch (_) {
        return '';
      }
    }
  };
}

// ─── Simulateur JSON-RPC Polygon Mainnet (Chain ID 137 + Contrats Core/Mine V3.2) ───
async function startMockPolygonRpc(ethersLib) {
  const coreIface = new ethersLib.Interface([
    "function difficulty() view returns (uint256)",
    "function rate() view returns (uint256)",
    "function claimFee() view returns (uint256)",
    "function devFee() view returns (uint256)",
    "function comRates(uint256) view returns (uint256)",
    "function uBal(address) view returns (uint256)",
    "function fBal(address) view returns (uint256)",
    "function pol(address) view returns (uint256)",
    "function uid(address) view returns (uint256)",
    "function refr(address) view returns (address)"
  ]);

  const mineIface = new ethersLib.Interface([
    "function mCount() view returns (uint256)",
    "function bCount() view returns (uint256)",
    "function getMType(uint256) view returns (uint256 price, uint256 power, uint256 shopExpiry)",
    "function getBType(uint256) view returns (uint256 price, uint256 dur)",
    "function myMachines(address u) view returns (tuple(uint256 tid, uint256 exp)[])",
    "function myBattery(address u, uint256 t) view returns (uint256)",
    "function myInfo(address u) view returns (uint256 mc, uint256 ap, uint256 lc)"
  ]);

  const legacyMineIface = new ethersLib.Interface([
    "function getMType(uint256) view returns (uint256 price, uint256 power)"
  ]);

  const erc20Iface = new ethersLib.Interface([
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ]);

  const quickswapRouterIface = new ethersLib.Interface([
    "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)"
  ]);
  const quickswapFactoryIface = new ethersLib.Interface([
    "function getPair(address tokenA, address tokenB) view returns (address pair)"
  ]);
  const quickswapPairIface = new ethersLib.Interface([
    "function token0() view returns (address)",
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
  ]);
  const quickswapRouterAddress = '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff';
  const quickswapFactoryAddress = '0x5757371414417b8c6caad45baef941abc7d3ab32';
  const quickswapPairAddress = '0x604229c960e5cacf2aaeac8be68ac07ba9df81c3';
  const wpolAddress = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
  const usdtAddress = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
  const reserveWpol = ethersLib.parseEther('1000000');
  const reserveUsdt = ethersLib.parseUnits('250000', 6);

  function handleSingleRpc(payload) {
    const { id, method, params } = payload;
    const nowSec = Math.floor(Date.now() / 1000);

    if (method === 'eth_chainId') return { jsonrpc: '2.0', id, result: '0x89' };
    if (method === 'net_version') return { jsonrpc: '2.0', id, result: '137' };
    if (method === 'eth_blockNumber') return { jsonrpc: '2.0', id, result: '0x3b9aca0' };
    if (method === 'eth_getBalance') {
      return { jsonrpc: '2.0', id, result: '0x' + ethersLib.parseEther('2.5').toString(16) };
    }
    if (method === 'eth_gasPrice') {
      return { jsonrpc: '2.0', id, result: '0x' + ethersLib.parseUnits('45', 'gwei').toString(16) };
    }
    if (method === 'eth_maxPriorityFeePerGas') {
      // Renvoie volontairement 5 Gwei pour vérifier que le portefeuille force le plancher >= 30 Gwei !
      return { jsonrpc: '2.0', id, result: '0x' + ethersLib.parseUnits('5', 'gwei').toString(16) };
    }
    if (method === 'eth_getBlockByNumber') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          number: '0x3b9aca0',
          hash: '0x' + '11'.repeat(32),
          parentHash: '0x' + '00'.repeat(32),
          timestamp: '0x' + nowSec.toString(16),
          nonce: '0x0000000000000000',
          difficulty: '0x0',
          gasLimit: '0x1c9c380',
          gasUsed: '0x0',
          miner: ethersLib.ZeroAddress,
          extraData: '0x',
          baseFeePerGas: '0x' + ethersLib.parseUnits('35', 'gwei').toString(16),
          transactions: []
        }
      };
    }
    if (method === 'eth_call') {
      const callObj = params[0] || {};
      const to = (callObj.to || '').toLowerCase();
      const data = callObj.data || '0x';
      const sel = data.slice(0, 10);

      if (to === quickswapRouterAddress && sel === quickswapRouterIface.getFunction('getAmountsOut').selector) {
        const [amountIn, path] = quickswapRouterIface.decodeFunctionData('getAmountsOut', data);
        const normalizedPath = Array.from(path).map((address) => address.toLowerCase());
        const isPolToUsdt = normalizedPath.length === 2 && normalizedPath[0] === wpolAddress && normalizedPath[1] === usdtAddress;
        const isUsdtToPol = normalizedPath.length === 2 && normalizedPath[0] === usdtAddress && normalizedPath[1] === wpolAddress;
        if (isPolToUsdt || isUsdtToPol) {
          const reserveIn = isPolToUsdt ? reserveWpol : reserveUsdt;
          const reserveOut = isPolToUsdt ? reserveUsdt : reserveWpol;
          const amountInWithFee = amountIn * 997n;
          const amountOut = (amountInWithFee * reserveOut) / ((reserveIn * 1000n) + amountInWithFee);
          return { jsonrpc: '2.0', id, result: quickswapRouterIface.encodeFunctionResult('getAmountsOut', [[amountIn, amountOut]]) };
        }
      }
      if (to === quickswapFactoryAddress && sel === quickswapFactoryIface.getFunction('getPair').selector) {
        return { jsonrpc: '2.0', id, result: quickswapFactoryIface.encodeFunctionResult('getPair', [quickswapPairAddress]) };
      }
      if (to === quickswapPairAddress) {
        if (sel === quickswapPairIface.getFunction('token0').selector) {
          return { jsonrpc: '2.0', id, result: quickswapPairIface.encodeFunctionResult('token0', [wpolAddress]) };
        }
        if (sel === quickswapPairIface.getFunction('getReserves').selector) {
          return { jsonrpc: '2.0', id, result: quickswapPairIface.encodeFunctionResult('getReserves', [reserveWpol, reserveUsdt, nowSec]) };
        }
      }

      if (to === usdtAddress) {
        if (sel === erc20Iface.getFunction('decimals').selector)
          return { jsonrpc: '2.0', id, result: erc20Iface.encodeFunctionResult('decimals', [6]) };
        if (sel === erc20Iface.getFunction('balanceOf').selector)
          return { jsonrpc: '2.0', id, result: erc20Iface.encodeFunctionResult('balanceOf', [ethersLib.parseUnits('125.50', 6)]) };
      }
      if (to === '0x5c418b12c7e9c2a8e9a71a68c6d9b319e7b1d1fd') {
        if (sel === erc20Iface.getFunction('decimals').selector)
          return { jsonrpc: '2.0', id, result: erc20Iface.encodeFunctionResult('decimals', [8]) };
        if (sel === erc20Iface.getFunction('balanceOf').selector)
          return { jsonrpc: '2.0', id, result: erc20Iface.encodeFunctionResult('balanceOf', [ethersLib.parseUnits('840.25', 8)]) };
      }

      if (to === '0x1b8edfb91168fb233f8ca7cf1631038ac193d743') {
        if (sel === coreIface.getFunction('difficulty').selector)
          return { jsonrpc: '2.0', id, result: coreIface.encodeFunctionResult('difficulty', [2000000000000n]) };
        if (sel === coreIface.getFunction('rate').selector)
          return { jsonrpc: '2.0', id, result: coreIface.encodeFunctionResult('rate', [50000n]) };
        if (sel === coreIface.getFunction('claimFee').selector)
          return { jsonrpc: '2.0', id, result: coreIface.encodeFunctionResult('claimFee', [5n]) };
        if (sel === coreIface.getFunction('devFee').selector)
          return { jsonrpc: '2.0', id, result: coreIface.encodeFunctionResult('devFee', [5n]) };
        if (sel === coreIface.getFunction('comRates').selector)
          return { jsonrpc: '2.0', id, result: coreIface.encodeFunctionResult('comRates', [3n]) };
        if (sel === coreIface.getFunction('uBal').selector)
          return { jsonrpc: '2.0', id, result: coreIface.encodeFunctionResult('uBal', [ethersLib.parseUnits('50', 6)]) };
        if (sel === coreIface.getFunction('fBal').selector)
          return { jsonrpc: '2.0', id, result: coreIface.encodeFunctionResult('fBal', [ethersLib.parseUnits('300', 8)]) };
        if (sel === coreIface.getFunction('pol').selector)
          return { jsonrpc: '2.0', id, result: coreIface.encodeFunctionResult('pol', [0n]) };
        if (sel === coreIface.getFunction('uid').selector)
          return { jsonrpc: '2.0', id, result: coreIface.encodeFunctionResult('uid', [1042n]) };
        if (sel === coreIface.getFunction('refr').selector)
          return { jsonrpc: '2.0', id, result: coreIface.encodeFunctionResult('refr', [ethersLib.ZeroAddress]) };
      }

      if (to === '0xbd9fa9801eda247b28b3bb9ddbf1cf52ca563bc6') {
        if (sel === mineIface.getFunction('mCount').selector)
          return { jsonrpc: '2.0', id, result: mineIface.encodeFunctionResult('mCount', [2n]) };
        if (sel === mineIface.getFunction('bCount').selector)
          return { jsonrpc: '2.0', id, result: mineIface.encodeFunctionResult('bCount', [2n]) };
        if (sel === mineIface.getFunction('getMType').selector) {
          const [tid] = mineIface.decodeFunctionData('getMType', data);
          if (Number(tid) === 0) {
            return { jsonrpc: '2.0', id, result: mineIface.encodeFunctionResult('getMType', [10000000n, 100000n, BigInt(nowSec + 86400 * 10)]) };
          }
          // Simule un contrat V3.0 (64 octets sans shopExpiry) sur la machine #1 pour vérifier le fallback automatique !
          return { jsonrpc: '2.0', id, result: legacyMineIface.encodeFunctionResult('getMType', [50000000n, 600000n]) };
        }
        if (sel === mineIface.getFunction('getBType').selector) {
          const [bid] = mineIface.decodeFunctionData('getBType', data);
          const days = Number(bid) === 0 ? 7n : 30n;
          return { jsonrpc: '2.0', id, result: mineIface.encodeFunctionResult('getBType', [2000000n * (bid + 1n), days * 86400n]) };
        }
        if (sel === mineIface.getFunction('myInfo').selector) {
          return { jsonrpc: '2.0', id, result: mineIface.encodeFunctionResult('myInfo', [1n, 100000n, BigInt(nowSec - 100)]) };
        }
        if (sel === mineIface.getFunction('myMachines').selector) {
          return { jsonrpc: '2.0', id, result: mineIface.encodeFunctionResult('myMachines', [[[0n, BigInt(nowSec + 86400 * 5)]]]) };
        }
        if (sel === mineIface.getFunction('myBattery').selector) {
          return { jsonrpc: '2.0', id, result: mineIface.encodeFunctionResult('myBattery', [2n]) };
        }
      }

      return { jsonrpc: '2.0', id, result: '0x' };
    }

    return { jsonrpc: '2.0', id, result: '0x0' };
  }

  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const out = Array.isArray(parsed) ? parsed.map(handleSingleRpc) : handleSingleRpc(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      } catch (_) {
        res.writeHead(400);
        res.end();
      }
    });
  });

  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

async function bootAppEnvironment(mockRpcUrl) {
  const html = fs.readFileSync(path.join(ROOT, 'android-src', 'wallet.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const dom = new JSDOM(html, {
    url: 'https://app.fitia.pro/wallet.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });

  const win = dom.window;
  Object.defineProperty(win, 'crypto', { value: crypto.webcrypto, configurable: true });
  win.TextEncoder = TextEncoder;
  win.TextDecoder = TextDecoder;
  win.Uint8Array = Uint8Array;
  win.ArrayBuffer = ArrayBuffer;
  win.fetch = async (url, opts) => {
    if (String(url).includes('/announcements.json') || String(url).includes('/promotions.json') || String(url).includes('store-products.json')) throw new Error('offline-sandbox');
    // Bloque les appels prix externes (DexScreener/CoinGecko) en sandbox pour rapidité instantanée
    if (String(url).includes('dexscreener') || String(url).includes('coingecko')) {
      throw new Error('offline-sandbox');
    }
    const cleanOpts = opts ? { ...opts } : {};
    if (cleanOpts.headers) {
      const h = {};
      for (const [k, v] of Object.entries(cleanOpts.headers)) {
        if (k.toLowerCase() !== 'content-length') h[k] = v;
      }
      cleanOpts.headers = h;
    }
    if (cleanOpts.body != null && typeof cleanOpts.body !== 'string') {
      cleanOpts.body = Buffer.from(cleanOpts.body);
    }
    return global.fetch(url, cleanOpts);
  };
  win.indexedDB = createMockIndexedDB();
  win.FitiaNative = createMockAndroidBridge();
  win.confirm = () => true;
  win.HTMLCanvasElement.prototype.getContext = () => ({
    canvas: { width: 300, height: 80, offsetWidth: 150, offsetHeight: 40 },
    clearRect() {},
    fillRect() {}
  });

  win.eval(fs.readFileSync(path.join(ROOT, 'vendor', 'ethers.umd.min.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'vendor', 'qrcode.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'wallet.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'activity.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'announcements.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'promotion-effects.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'promotions.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'store-catalog.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'store.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(ROOT, 'assistant.js'), 'utf8'));

  if (mockRpcUrl) {
    win.FitiaSecurity.Rpc.connectBestProvider = async () => {
      const prov = win.FitiaSecurity.Rpc.createStaticProvider(mockRpcUrl);
      win.FitiaSecurity.Rpc.provider = prov;
      win.FitiaSecurity.Rpc.currentRpcUrl = 'https://polygon-bor-rpc.publicnode.com';
      return { provider: prov, url: mockRpcUrl, latencyMs: 12, block: 62500000 };
    };
  }

  win.eval(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'));
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 80));

  return { dom, win };
}

function httpRequest(port, method, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: reqPath }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  EXÉCUTION DES 6 SUITES D'AUDIT ET DE TESTS
// ═══════════════════════════════════════════════════════════════════════════
(async () => {
  console.log('\n🛡️  AUDIT DE SÉCURITÉ & TESTS AUTOMATISÉS — FITIA PRO MINER V3.3.25\n' + '═'.repeat(72));

  const ethersLib = require(path.join(ROOT, 'vendor', 'ethers.umd.min.js'));
  const mockRpc = await startMockPolygonRpc(ethersLib);

  try {
    const { dom, win } = await bootAppEnvironment(mockRpc.url);
    const { FitiaSecurity } = win;

    // ─── SUITE 1 : Cryptographie & Triple Scellement ────────────────────
    await runTest('CRYPTO', 'Génération BIP-39 12 mots + dérivation secp256k1 déterministe', async () => {
      const w = FitiaSecurity.Vault.generateNewWallet();
      assert.strictEqual(w.mnemonic.split(' ').length, 12);
      assert.ok(ethersLib.isAddress(w.address));
      const reparsed = FitiaSecurity.Vault.parseMnemonic('  ' + w.mnemonic.toUpperCase() + '  ');
      assert.strictEqual(reparsed.address, w.address);
      assert.strictEqual(reparsed.privateKey, w.privateKey);
      const fromPk = FitiaSecurity.Vault.parsePrivateKey(w.privateKey.replace(/^0x/, ''));
      assert.strictEqual(fromPk.address, w.address);
    });

    await runTest('CRYPTO', 'Rejet systématique des codes PIN faibles (123456, 000000, séquences, motifs répétitifs)', async () => {
      for (const bad of ['000000', '111111', '123456', '654321', '121212', '123123', '258025', '012345', '474747', '891891']) {
        assert.strictEqual(FitiaSecurity.Vault.isWeakPin(bad), true, `PIN faible ${bad} aurait dû être bloqué`);
      }
      assert.strictEqual(FitiaSecurity.Vault.isWeakPin('847291'), false);

      const sample = FitiaSecurity.Vault.generateNewWallet();
      await assert.rejects(
        () => FitiaSecurity.Vault.saveVault(sample, '123456'),
        (err) => err.code === 'WEAK_PIN'
      );
    });

    await runTest('CRYPTO', 'Chiffrement 3 couches : PBKDF2 (310k) + CryptoKey non-exportable + AndroidKeyStore AKS1', async () => {
      const secret = FitiaSecurity.Vault.generateNewWallet();
      const strongPin = '847291';
      await FitiaSecurity.Vault.saveVault(secret, strongPin);

      // 1) Stockage scellé matériellement par AndroidKeyStore (AKS1:...)
      const rawStored = win.localStorage.getItem('fitia_secure_vault_v2');
      assert.ok(rawStored && rawStored.startsWith('AKS1:'), 'Le coffre doit être scellé par AndroidKeyStore (préfixe AKS1:)');
      assert.ok(!rawStored.includes(secret.privateKey.slice(4)), 'Aucune trace de clé privée en clair');
      assert.ok(!rawStored.includes(secret.mnemonic.split(' ')[0]), 'Aucune trace des 12 mots en clair');

      // 2) Enveloppe interne v2 : 310 000 itérations PBKDF2-SHA256 + devWrapped
      const unsealedJson = JSON.parse(win.FitiaNative.unsealVault(rawStored));
      assert.strictEqual(unsealedJson.v, 2);
      assert.strictEqual(unsealedJson.iterations, 310000);
      assert.strictEqual(unsealedJson.devWrapped, true);
      assert.ok(unsealedJson.devIv && unsealedJson.ct && unsealedJson.salt && unsealedJson.iv);

      // 3) Clé appareil WebCrypto dans IndexedDB NON-EXPORTABLE (extractable === false)
      const devKey = win.indexedDB._stores.kv.get('fitia_non_extractable_wrap_key_v1');
      assert.ok(devKey, 'Clé appareil présente dans IndexedDB');
      assert.strictEqual(devKey.extractable, false, 'La CryptoKey doit être non-exportable');
      await assert.rejects(() => crypto.webcrypto.subtle.exportKey('raw', devKey));

      // 4) Déverrouillage exact avec le bon PIN
      const unlocked = await FitiaSecurity.Vault.unlockWithPin(strongPin);
      assert.strictEqual(unlocked.address, secret.address);
      assert.strictEqual(unlocked.privateKey, secret.privateKey);
      assert.strictEqual(unlocked.mnemonic, secret.mnemonic);
    });

    await runTest('CRYPTO', 'Détection d’altération du chiffré (intégrité authentifiée AES-GCM)', async () => {
      const orig = win.localStorage.getItem('fitia_secure_vault_v2');
      const parts = orig.split(':');
      const tamperedBuf = Buffer.from(parts[2], 'base64');
      tamperedBuf[5] ^= 0xff;
      const tampered = `${parts[0]}:${parts[1]}:${tamperedBuf.toString('base64')}`;

      win.localStorage.setItem('fitia_secure_vault_v2', tampered);
      win.indexedDB._stores.kv.set('fitia_secure_vault_v2', tampered);

      await assert.rejects(() => FitiaSecurity.Vault.unlockWithPin('847291'));

      win.localStorage.setItem('fitia_secure_vault_v2', orig);
      win.indexedDB._stores.kv.set('fitia_secure_vault_v2', orig);
      await FitiaSecurity.Vault._resetPinFailures();
    });

    await runTest('CRYPTO', 'Échec AndroidKeyStore : aucun repli en clair et aucun coffre existant écrasé', async () => {
      const bridge = win.FitiaNative;
      const originalSeal = bridge.sealVault;
      const beforeLocal = win.localStorage.getItem('fitia_secure_vault_v2');
      const beforeIdb = win.indexedDB._stores.kv.get('fitia_secure_vault_v2');
      const replacement = FitiaSecurity.Vault.generateNewWallet();
      try {
        // Simule l’ancien repli natif qui renvoyait directement son entrée.
        bridge.sealVault = (value) => String(value);
        assert.strictEqual(await FitiaSecurity.Native.hardwareSeal('sensitive-payload'), null);
        await assert.rejects(
          () => FitiaSecurity.Vault.saveVault(replacement, '918273'),
          (err) => err.code === 'HARDWARE_SEAL_FAILED'
        );
        assert.strictEqual(win.localStorage.getItem('fitia_secure_vault_v2'), beforeLocal);
        assert.strictEqual(win.indexedDB._stores.kv.get('fitia_secure_vault_v2'), beforeIdb);

        bridge.sealVault = () => '';
        await assert.rejects(
          () => FitiaSecurity.Vault.saveVault(replacement, '918273'),
          (err) => err.code === 'HARDWARE_SEAL_FAILED'
        );
        assert.strictEqual(win.localStorage.getItem('fitia_secure_vault_v2'), beforeLocal);

        const javaSource = fs.readFileSync(path.join(ROOT, 'android-src', 'java', 'com', 'fitia', 'miningpro', 'MainActivity.java'), 'utf8');
        const nativeSealMethod = javaSource.slice(javaSource.indexOf('private String hardwareSeal('), javaSource.indexOf('private String hardwareUnseal('));
        assert.ok(nativeSealMethod && !nativeSealMethod.includes('return plaintext'), 'Le pont Java ne doit jamais renvoyer le texte non scellé');
      } finally {
        bridge.sealVault = originalSeal;
      }
    });

    // ─── SUITE 2 : Anti-Brute-Force & Résistance à l'Effacement localStorage ───
    await runTest('LOCKOUT', 'Blocage après 5 faux PIN + persistance même si localStorage est vidé', async () => {
      await FitiaSecurity.Vault._resetPinFailures();
      for (let i = 1; i <= 4; i++) {
        await assert.rejects(
          () => FitiaSecurity.Vault.unlockWithPin('909091'),
          (err) => err.code === 'WRONG_PIN' && err.attemptsLeft === 5 - i
        );
      }
      // 5ème essai erroné -> verrouillage temporisé immédiat (30s)
      await assert.rejects(
        () => FitiaSecurity.Vault.unlockWithPin('909091'),
        (err) => err.code === 'LOCKED_OUT' && err.remainingSec >= 25
      );

      // Simulation d'attaque : vidage de localStorage ET du cache mémoire
      win.localStorage.removeItem('fitia_pin_guard_v2');
      FitiaSecurity.Vault.cachedPinGuard = null;
      await FitiaSecurity.Vault._syncPinGuardFromStores();

      assert.ok(
        FitiaSecurity.Vault.getLockoutRemainingSec() >= 25,
        'Le verrouillage résiste à la suppression de localStorage grâce à SharedPreferences & IndexedDB'
      );

      // Même le VRAI PIN est refusé pendant le délai de blocage
      await assert.rejects(
        () => FitiaSecurity.Vault.unlockWithPin('847291'),
        (err) => err.code === 'LOCKED_OUT'
      );

      await FitiaSecurity.Vault._resetPinFailures();
    });

    // ─── SUITE 3 : Anti-XSS, Anti-SSRF & Auto-Nettoyage Presse-Papiers ───
    await runTest('XSS/SSRF', 'Échappement XSS strict & blocage des RPC locaux, privés ou en littéral IP', async () => {
      const payload = `<img src=x onerror="alert('xss')">'&`;
      const escaped = FitiaSecurity.escapeHtml(payload);
      assert.ok(!escaped.includes('<') && !escaped.includes('>') && !escaped.includes('"'));

      const maliciousUrls = [
        'http://polygon-rpc.com',
        'https://localhost:8545',
        'https://127.0.0.1:8545',
        'https://0.0.0.0:8545',
        'https://10.0.0.5/rpc',
        'https://172.16.4.1/rpc',
        'https://172.31.255.1/rpc',
        'https://192.168.1.254/rpc',
        'https://169.254.169.254/latest/meta-data/',
        'https://localhost.:8545',
        'https://127.0.0.1.:8545',
        'https://2130706433:8545',
        'https://0x7f000001:8545',
        'https://8.8.8.8/rpc',
        'https://[::1]:8545',
        'https://[::]:8545',
        'https://[0:0:0:0:0:0:0:1]:8545',
        'https://[::ffff:127.0.0.1]:8545',
        'https://[::ffff:7f00:1]:8545',
        'https://[fe80::1]:8545',
        'https://[fd00::1]:8545',
        'https://rpc.internal',
        'https://rpc.lan',
        'https://node.home.arpa',
        'https://admin:secret@polygon-rpc.com',
        'javascript:alert(1)'
      ];
      for (const badUrl of maliciousUrls) {
        assert.strictEqual(
          FitiaSecurity.Rpc.validateRpcUrl(badUrl),
          null,
          `URL dangereuse ${badUrl} aurait dû être bloquée`
        );
      }
      assert.strictEqual(
        FitiaSecurity.Rpc.validateRpcUrl('https://polygon-bor-rpc.publicnode.com'),
        'https://polygon-bor-rpc.publicnode.com/'
      );
    });

    await runTest('WEBVIEW-CSP', 'Polices et icônes embarquées, images catalogue limitées à GitHub et CSP restrictive', async () => {
      const walletHtml = fs.readFileSync(path.join(ROOT, 'android-src', 'wallet.html'), 'utf8');
      const styleSource = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
      const csp = walletHtml.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1] || '';
      assert.ok(csp.includes("default-src 'self'"));
      assert.ok(csp.includes("base-uri 'none'"));
      assert.ok(csp.includes("object-src 'none'"));
      assert.ok(csp.includes("font-src 'self'"));
      assert.ok(csp.includes("img-src 'self' data: blob: https://raw.githubusercontent.com;"));
      const imageDirective = csp.match(/(?:^|;\s*)img-src\s+([^;]+)/)?.[1] || '';
      assert.ok(!imageDirective.includes('https://*'), 'Les images distantes ne sont pas ouvertes à tous les hôtes HTTPS');
      assert.strictEqual((imageDirective.match(/https:\/\//g) || []).length, 1, 'Seul le stockage public GitHub des images éditoriales est autorisé');
      assert.ok(!csp.includes('https://fonts.googleapis.com'));
      assert.ok(!csp.includes('https://fonts.gstatic.com'));
      assert.ok(!/(?:src|href)=["']https?:\/\//i.test(walletHtml), 'Aucun sous-chargement HTTP(S) ne doit rester dans wallet.html');
      assert.ok(!/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|i\.ibb\.co)/i.test(walletHtml));
      assert.ok(walletHtml.includes('src="assets/pol.svg"') && walletHtml.includes('src="assets/usdt.svg"'));

      const fontFiles = [
        'inter-latin-400-normal.woff2', 'inter-latin-600-normal.woff2',
        'inter-latin-700-normal.woff2', 'inter-latin-800-normal.woff2',
        'jetbrains-mono-latin-500-normal.woff2', 'jetbrains-mono-latin-700-normal.woff2'
      ];
      for (const fontFile of fontFiles) {
        const relativePath = `assets/fonts/${fontFile}`;
        assert.ok(styleSource.includes(relativePath), `${relativePath} doit être référencé localement`);
        assert.ok(fs.statSync(path.join(ROOT, relativePath)).size > 1000, `${relativePath} doit être embarqué`);
      }
    });

    await runTest('CLIPBOARD', 'Copie sensible des secrets avec effacement automatique programmé (45s)', async () => {
      await FitiaSecurity.Native.copySensitive('abandon ability able about above absent absorb abstract absurd abuse access accident');
      assert.strictEqual(win.FitiaNative._state.lastClearDelayMs, 45000);
      assert.ok(win.FitiaNative._state.clipboard.startsWith('abandon '));
    });

    // ─── SUITE 4 : Parcours E2E Interface, Contrats V3.2, Gaz Polygon & Gardes d'Envoi ───
    const e2eEnv = await bootAppEnvironment(mockRpc.url);
    const e2eWin = e2eEnv.win;
    const App = e2eWin.App;

    await runTest('UI-E2E', 'Création complète wallet -> Quiz 12 mots -> Rejet PIN faible UI -> Session Polygon active', async () => {
      assert.strictEqual(e2eWin.ethereum, undefined, 'Aucun wallet externe injecté requis');
      assert.strictEqual(e2eWin.FitiaNative._state.screenSecure, true, 'FLAG_SECURE actif sur écran accueil');
      assert.strictEqual(e2eWin.document.getElementById('loader-text'), null, 'Aucun texte de chargement dans le wallet Android');
      App.setLoader(true, 'Connexion directe à Polygon...');
      assert.strictEqual(e2eWin.document.getElementById('loader').textContent.trim(), '', 'Le loader reste silencieux');
      App.setLoader(false);

      assert.strictEqual(App.currentLang, 'en', 'Une nouvelle installation utilise l’anglais par défaut');
      assert.strictEqual(e2eWin.localStorage.getItem('fitia_lang'), 'en');
      assert.strictEqual(e2eWin.document.documentElement.lang, 'en');
      assert.strictEqual(e2eWin.document.querySelector('[data-i18n="createNewWallet"]').textContent.trim(), 'CREATE NEW WALLET');
      assert.strictEqual(e2eWin.document.getElementById('auth-step-import').querySelector('[data-i18n="importTitle"]').textContent.trim(), 'Import a Wallet');
      assert.strictEqual(e2eWin.document.getElementById('btn-import-continue').textContent.trim(), 'SET MY 6-DIGIT PIN');
      assert.strictEqual(e2eWin.document.getElementById('chat-input').placeholder, 'Ask your question…');

      const authScreen = e2eWin.document.getElementById('auth-screen');
      const welcomeStep = e2eWin.document.getElementById('auth-step-welcome');
      const onboardingEmojiPattern = /[\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}\u{1F300}-\u{1FAFF}]/u;
      assert.strictEqual(welcomeStep.querySelector('.auth-badge-pill'), null, 'Le badge Polygon est retiré de l’accueil');
      assert.strictEqual(welcomeStep.querySelector('.auth-subtitle'), null, 'Le sous-titre promotionnel est retiré');
      assert.strictEqual(welcomeStep.querySelector('.auth-features'), null, 'Les cartes Chiffrement, Non-Custodial et Connexion sont retirées');
      assert.strictEqual(authScreen.querySelectorAll('.auth-step-indicator').length, 0, 'Aucun compteur ou badge à côté de Retour');
      assert.ok(!/PINE/.test(authScreen.textContent), 'La faute PINE est absente');
      assert.ok(!/polygon/i.test(welcomeStep.textContent), 'Polygon n’est plus affiché sur l’accueil Créer/Importer');
      assert.ok(!/chiffrement|non-custodial|connexion directe/i.test(welcomeStep.textContent), 'Les messages promotionnels sont masqués');

      const originalAuthLang = App.currentLang;
      for (const lang of ['fr', 'en', 'de', 'zh', 'sg']) {
        App.setLanguage(lang);
        assert.ok(!onboardingEmojiPattern.test(authScreen.textContent), `Aucun emoji dans les écrans d’authentification (${lang})`);
        assert.ok(!/PINE/.test(authScreen.textContent), `Libellé PIN correct (${lang})`);
      }
      App.setLanguage(originalAuthLang);
      assert.strictEqual(e2eWin.document.getElementById('btn-import-continue').textContent.trim(), App.t('continueToPin'));

      App.startCreateWallet();
      const seedToggleButton = e2eWin.document.getElementById('btn-toggle-seed');
      App.toggleSeedBlur();
      assert.strictEqual(seedToggleButton.textContent, App.t('hideWords'));
      App.toggleSeedBlur();
      assert.strictEqual(seedToggleButton.textContent, App.t('revealWords'));
      assert.ok(!onboardingEmojiPattern.test(authScreen.textContent), 'Les boutons dynamiques des 12 mots restent sans emoji');
      assert.ok(App.pendingWalletSecret?.mnemonic);
      e2eWin.document.getElementById('seed-saved-checkbox').checked = true;
      App.onSeedCheckboxChange();
      App.goToSeedVerify();

      App.quizQuestions.forEach((q, idx) => App.selectQuizOption(idx, q.correct));
      App.completeSeedVerify();

      // PIN faible "123456" bloqué immédiatement dans le clavier UI
      for (const ch of '123456') await App.onSetPinDigit(ch);
      assert.strictEqual(App.setPinStage, 'first');
      assert.ok(e2eWin.document.getElementById('setpin-error').textContent.length > 5);

      // PIN robuste "739184" accepté + confirmation
      for (const ch of '739184') await App.onSetPinDigit(ch);
      await new Promise((r) => setTimeout(r, 200));
      assert.strictEqual(App.setPinStage, 'confirm');
      for (const ch of '739184') await App.onSetPinDigit(ch);
      await new Promise((r) => setTimeout(r, 180));

      assert.ok(ethersLib.isAddress(App.user), 'Adresse utilisateur active');
      assert.strictEqual(App.pendingWalletSecret, null, 'Secret temporaire effacé de la RAM');
      assert.strictEqual(e2eWin.FitiaNative._state.screenSecure, false, 'FLAG_SECURE relâché sur dashboard public');
      assert.strictEqual(e2eWin.document.getElementById('bal-wallet-usdt').textContent, '125.50');
      assert.strictEqual(e2eWin.document.getElementById('bal-usdt').textContent, '50.00');
      assert.ok(App.currentRealPower > 0, 'Puissance de minage V3.2 calculée depuis myInfo()');

      assert.strictEqual(e2eWin.document.getElementById('addr-display'), null, 'Adresse masquée dans l’en-tête');
      const settingsButton = e2eWin.document.getElementById('btn-settings-app');
      assert.ok(settingsButton, 'Bouton Paramètres présent dans l’en-tête');
      assert.strictEqual(settingsButton.getAttribute('aria-label'), 'Ouvrir les paramètres');
      assert.strictEqual(e2eWin.document.getElementById('wallet-card-addr').textContent, App.shortAddr(App.user), 'Adresse conservée dans la carte Portefeuille');
      await App.openSecurityModal();
      const settingsModal = e2eWin.document.getElementById('modal-security');
      assert.ok(settingsModal.classList.contains('active'), 'Le bouton ouvre les réglages et la sécurité');
      const hiddenSettingsSelectors = [
        '.sec-wallet-top',
        '[data-i18n="reqPinHint"]',
        '[data-i18n="changePinSub"]',
        '[data-i18n="autoLockSub"]',
        'button[onclick="App.openPolygonScan()"]',
        'button[onclick="App.lockWallet()"]'
      ];
      hiddenSettingsSelectors.forEach((selector) => {
        const elements = settingsModal.querySelectorAll(selector);
        assert.ok(elements.length > 0, `Élément de paramètres trouvé : ${selector}`);
        elements.forEach((element) => {
          assert.ok(element.classList.contains('hidden'), `Élément masqué dans les paramètres : ${selector}`);
        });
      });
      assert.ok(
        !/[\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}\u{1F300}-\u{1FAFF}]/u.test(settingsModal.textContent),
        'Aucun emoji dans la modale Paramètres'
      );
      assert.ok(!e2eWin.document.getElementById('select-autolock').classList.contains('hidden'), 'Le réglage de verrouillage automatique reste disponible');
      assert.ok(!e2eWin.document.getElementById('btn-lock-app').classList.contains('hidden'), 'Le verrouillage de l’en-tête principal reste disponible');
      App.closeModals();
    });

    await runTest('STARTUP-RPC', 'Ouverture immédiate après PIN même avec un RPC bloqué, puis synchronisation en arrière-plan', async () => {
      const startupEnv = await bootAppEnvironment(mockRpc.url);
      const startupWin = startupEnv.win;
      const startupApp = startupWin.App;
      const secret = startupWin.FitiaSecurity.Vault.generateNewWallet();
      let resolveConnection = null;
      let promotionRefreshed = false;
      try {
        startupApp.promotionCenter.refresh = () => { promotionRefreshed = true; };
        startupWin.FitiaSecurity.Rpc.connectBestProvider = () => new Promise((resolve) => {
          resolveConnection = resolve;
        });
        startupApp.setLoader(true);
        await withDeadline(
          startupApp.activateUnlockedSession(secret),
          400,
          'Le déverrouillage local attend encore une réponse RPC'
        );
        assert.ok(startupApp.user, 'La session locale est active sans réponse blockchain');
        assert.strictEqual(secret.privateKey, '', 'La copie de la clé est effacée immédiatement');
        assert.strictEqual(secret.mnemonic, '', 'La copie de la phrase est effacée immédiatement');
        assert.ok(startupWin.document.getElementById('auth-screen').classList.contains('hidden'));
        assert.ok(!startupWin.document.getElementById('app-shell').classList.contains('hidden'));
        assert.ok(startupWin.document.getElementById('loader').classList.contains('hidden'), 'Le loader ne couvre plus le tableau de bord');
        assert.ok(resolveConnection, 'La connexion Polygon continue en arrière-plan');
        assert.strictEqual(promotionRefreshed, false, 'Aucun chargement de boutique ne part avant la sélection du RPC');

        const mockProvider = startupWin.FitiaSecurity.Rpc.createStaticProvider(mockRpc.url);
        resolveConnection({ provider: mockProvider, url: mockRpc.url, latencyMs: 12, block: 62500000 });
        await withDeadline(startupApp.sessionBootstrapPromise, 2500, 'La synchronisation ne reprend pas après le retour du RPC');
        assert.strictEqual(startupWin.document.getElementById('bal-wallet-usdt').textContent, '125.50');
        assert.ok(startupApp.currentRealPower > 0, 'Les données blockchain arrivent après l’ouverture');
        assert.strictEqual(promotionRefreshed, true, 'La boutique se synchronise après la connexion');
      } finally {
        secret.privateKey = '';
        secret.mnemonic = '';
        startupEnv.dom.window.close();
      }
    });

    await runTest('NETWORK-RESILIENCE', 'Nœuds RPC testés en parallèle et services de prix limités dans le temps', async () => {
      const networkEnv = await bootAppEnvironment();
      const networkWin = networkEnv.win;
      const rpc = networkWin.FitiaSecurity.Rpc;
      const networkApp = networkWin.App;
      const originalFetch = networkWin.fetch;
      try {
        const calls = [];
        let rejectFirst = null;
        let resolveSecond = null;
        rpc.getAvailableRpcs = () => [
          { name: 'RPC A', url: 'https://rpc-a.example' },
          { name: 'RPC B', url: 'https://rpc-b.example' }
        ];
        rpc.pingRpc = (url) => {
          calls.push(url);
          return new Promise((resolve, reject) => {
            if (url.includes('rpc-a')) rejectFirst = reject;
            else resolveSecond = resolve;
          });
        };
        let connectionSettled = false;
        const connection = rpc.connectBestProvider('https://rpc-a.example');
        void connection.then(() => { connectionSettled = true; });
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.deepStrictEqual(calls.sort(), ['https://rpc-a.example', 'https://rpc-b.example'], 'Les deux nœuds démarrent sans attente séquentielle');
        resolveSecond({ ok: true, block: 62500001, latencyMs: 18, provider: { destroy() {} } });
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.strictEqual(connectionSettled, false, 'La préférence du premier nœud reste déterministe');
        rejectFirst(new Error('offline'));
        const selected = await withDeadline(connection, 300, 'Le second nœud ne prend pas le relais');
        assert.strictEqual(selected.url, 'https://rpc-b.example');
        assert.strictEqual(selected.block, 62500001);

        networkWin.fetch = (url, options) => new Promise((resolve, reject) => {
          if (!String(url).includes('dexscreener') && !String(url).includes('coingecko')) {
            originalFetch(url, options).then(resolve, reject);
            return;
          }
          const signal = options?.signal;
          if (signal?.aborted) reject(new Error('aborted'));
          else signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
        networkApp.polPriceUsd = 0;
        const startedAt = Date.now();
        await withDeadline(networkApp.fetchMarketPrices(25), 400, 'Les services de prix restent sans délai maximal');
        assert.ok(Date.now() - startedAt < 350, 'Les deux appels prix sont interrompus rapidement');
        assert.strictEqual(networkApp.polPriceUsd, 0.42, 'Le prix de secours reste disponible hors ligne');
      } finally {
        networkWin.fetch = originalFetch;
        networkEnv.dom.window.close();
      }
    });

    await runTest('UI-REFERRAL', 'Lien direct gratuit, code de secours, préremplissage sécurisé et compatibilité on-chain', async () => {
      const document = e2eWin.document;
      const settingsModal = document.getElementById('modal-security');
      await App.openSecurityModal();

      assert.strictEqual(document.querySelector('#view-dashboard .referral-card'), null, 'Aucune carte Parrainage sur le tableau de bord');
      assert.strictEqual(document.querySelectorAll('.referral-card').length, 1, 'Une seule carte Parrainage dans le wallet');
      const referralCard = settingsModal.querySelector('.referral-card');
      assert.ok(referralCard, 'La carte Parrainage est dans la modale Paramètres');
      ['my-ref-id-label', 'my-ref-link-label', 'current-referrer-status', 'ref-form-wrap', 'ref-address-input'].forEach((id) => {
        assert.ok(referralCard.querySelector(`#${id}`), `Élément Parrainage conservé : ${id}`);
      });
      assert.ok(referralCard.querySelector('.ref-brand-logo[src="assets/fta.png"]'), 'Le logo FITIA local identifie le programme');
      assert.ok(referralCard.querySelector('button[onclick="App.copyMyReferralCode()"]'), 'La copie directe du code de secours est disponible');
      assert.ok(referralCard.querySelector('button[onclick="App.copyMyReferralLink()"]'), 'La copie directe du lien de parrainage est disponible');
      assert.ok(referralCard.querySelector('button[onclick="App.shareMyReferral()"]'), 'Le partage du lien de parrainage reste disponible');
      assert.ok(referralCard.querySelector('button[onclick="App.bindReferrer()"]'), 'La liaison du parrain reste disponible');
      assert.strictEqual(App.formatReferralCode(1042), 'FITIA-001042');
      assert.strictEqual(App.formatReferralCode(42), 'FITIA-000042');
      assert.strictEqual(App.formatReferralCode(1234567), 'FITIA-1234567');
      assert.strictEqual(App.formatReferralCode(0), '', 'Sans UID, le format FITIA ne fabrique pas un faux code');
      assert.strictEqual(document.getElementById('my-ref-id-label').textContent, 'FITIA-001042', 'L’UID on-chain 1042 est présenté sous sa forme professionnelle');
      assert.strictEqual(App.getMyReferralCode(), 'FITIA-001042');
      const expectedLink = 'fitiapro://parrainage/FITIA-001042';
      assert.strictEqual(App.getMyReferralLink(), expectedLink);
      assert.strictEqual(document.getElementById('my-ref-link-label').textContent, expectedLink);
      App.myReferralCode = '';
      assert.strictEqual(App.getMyReferralCode(), App.user, 'Sans code UID, le partage utilise l’adresse complète et non raccourcie');
      assert.strictEqual(App.getMyReferralLink(), `fitiapro://parrainage/${App.user}`, 'Le lien de secours conserve aussi l’adresse complète');
      App.myReferralCode = 'FITIA-001042';

      for (const [input, expected] of [['FITIA-001042', 1042n], ['fitia-1042', 1042n], ['#1042', 1042n], ['1042', 1042n]]) {
        const parsed = App.parseReferralInput(input);
        assert.strictEqual(parsed?.type, 'id', `${input} reste une liaison par UID`);
        assert.strictEqual(parsed?.value, expected, `${input} est converti vers le bon UID`);
      }
      const parsedAddress = App.parseReferralInput(App.user);
      assert.strictEqual(parsedAddress?.type, 'address');
      assert.strictEqual(parsedAddress?.value, e2eWin.ethers.getAddress(App.user));
      for (const invalid of ['', '0', '#0', 'FITIA-0', 'FITIA--1042', 'FITIA-1042-EXTRA', '0x1234', 'FITIA-ABC']) {
        assert.strictEqual(App.parseReferralInput(invalid), null, `Entrée refusée : ${invalid || '(vide)'}`);
      }

      await App.copyMyReferralCode();
      assert.strictEqual(e2eWin.FitiaNative._state.clipboard, 'FITIA-001042', 'La copie utilise le code complet');
      assert.notStrictEqual(e2eWin.FitiaNative._state.lastClearDelayMs, 45000, 'Le code public n’utilise pas le presse-papiers sensible');
      await App.copyMyReferralLink();
      assert.strictEqual(e2eWin.FitiaNative._state.clipboard, expectedLink, 'La copie utilise le lien direct sans domaine payant');
      await App.shareMyReferral();
      const shared = e2eWin.FitiaNative._state.sharedTexts.at(-1);
      assert.ok(shared?.text.includes(expectedLink), 'Le partage contient le lien direct complet');
      assert.ok(shared?.text.includes('FITIA-001042'), 'Le partage conserve le code manuel de secours');
      assert.ok(!shared?.text.includes('vercel.app'), 'Le partage ne contient aucun domaine Vercel');
      assert.ok(shared?.text.includes(App.user) === false, 'Le partage privilégie le code et ne duplique pas l’adresse');

      App.closeModals();
      e2eWin.FitiaNative._state.pendingReferralCode = 'FITIA-002042';
      const deepLinkOpened = await App.consumePendingReferralDeepLink();
      assert.strictEqual(deepLinkOpened, true, 'Un lien reçu ouvre les réglages après déverrouillage');
      assert.ok(settingsModal.classList.contains('active'));
      assert.strictEqual(document.getElementById('ref-address-input').value, 'FITIA-002042', 'Le code reçu est prérempli sans transaction automatique');
      assert.strictEqual(e2eWin.FitiaNative._state.pendingReferralCode, '', 'Le lien consommé ne reste pas dans le pont natif');
      document.getElementById('ref-address-input').value = '';

      const androidManifest = fs.readFileSync(path.join(ROOT, 'android-src/AndroidManifest.xml'), 'utf8');
      const androidActivity = fs.readFileSync(path.join(ROOT, 'android-src/java/com/fitia/miningpro/MainActivity.java'), 'utf8');
      assert.ok(androidManifest.includes('android:scheme="fitiapro"'));
      assert.ok(androidManifest.includes('android:host="parrainage"'));
      assert.ok(androidActivity.includes('consumeReferralDeepLink()'));
      assert.ok(androidActivity.includes('FITIA-[0-9]{1,78}'), 'Le pont natif valide strictement le code reçu');

      const originals = { core: App.core, ensurePolGas: App.ensurePolGas, updateData: App.updateData };
      const calls = [];
      App.ensurePolGas = async () => true;
      App.updateData = async () => {};
      App.core = {
        setReferrerById: async (uid) => { calls.push({ type: 'id', value: uid }); return { wait: async () => ({ status: 1 }) }; },
        setReferrer: async (address) => { calls.push({ type: 'address', value: address }); return { wait: async () => ({ status: 1 }) }; }
      };
      try {
        const input = document.getElementById('ref-address-input');
        input.value = 'fitia-001042';
        await App.bindReferrer();
        input.value = '#1042';
        await App.bindReferrer();
        input.value = App.user;
        await App.bindReferrer();
        assert.deepStrictEqual(calls, [
          { type: 'id', value: 1042n },
          { type: 'id', value: 1042n },
          { type: 'address', value: e2eWin.ethers.getAddress(App.user) }
        ], 'Les nouveaux et anciens formats conservent leurs méthodes de contrat respectives');
        input.value = 'FITIA--1042';
        await App.bindReferrer();
        assert.strictEqual(calls.length, 3, 'Une entrée invalide ne déclenche aucune transaction');
      } finally {
        App.core = originals.core;
        App.ensurePolGas = originals.ensurePolGas;
        App.updateData = originals.updateData;
        document.getElementById('ref-address-input').value = '';
      }

      assert.ok(
        !/[\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}\u{1F300}-\u{1FAFF}]/u.test(referralCard.textContent),
        'La section Parrainage reste sans emoji dans Paramètres'
      );
      App.closeModals();
    });

    await runTest('SMART-CONTRACT', 'Boutique V3.2 (shopExpiry) + fallback automatique V3.0 (64 octets) + Custom Errors', async () => {
      App.setShopView('machines');
      await App.renderShop();
      assert.strictEqual(App.shopMachinesData.length, 2, 'Les 2 machines (V3.2 et fallback V3.0) sont chargées');
      assert.strictEqual(App.shopMachinesData[0].price, 10);
      assert.strictEqual(App.shopMachinesData[1].price, 50);

      assert.strictEqual(App.getErrorMessage({ revert: { name: 'NoM' } }), App.t('errNoMachine'));
      assert.strictEqual(App.getErrorMessage({ revert: { name: 'Running' } }), App.t('errRunning'));
      assert.ok(App.getErrorMessage({ revert: { name: 'Expired', args: ['Shop'] } }).toLowerCase().includes('expir'));
      assert.ok(App.getErrorMessage({ revert: { name: 'InsF', args: ['USDT'] } }).includes('USDT'));
    });

    await runTest('CLAIM-UX', 'Réclamation en attente puis confirmée, avec récupération silencieuse après une réponse RPC 403', async () => {
      const originals = {
        mine: App.mine,
        provider: App.provider,
        ensurePolGas: App.ensurePolGas,
        updateData: App.updateData,
        stopMiningCounter: App.stopMiningCounter,
        startMiningCounter: App.startMiningCounter,
        showToast: App.showToast,
        userMachines: App.userMachines,
        currentRealPower: App.currentRealPower,
        pendingBalance: App.pendingBalance
      };
      const pendingElement = e2eWin.document.getElementById('val-pending');
      const oldPendingText = pendingElement.textContent;
      const messages = [];
      const hash = `0x${'ab'.repeat(32)}`;
      App.ensurePolGas = async () => true;
      App.updateData = async () => {};
      App.stopMiningCounter = () => {};
      App.startMiningCounter = () => {};
      App.showToast = (message, isError = false) => messages.push({ message, isError });
      App.userMachines = [{}];
      App.currentRealPower = 0;

      try {
        let resolveReceipt;
        App.mine = {
          async claimRewards() {
            return { hash, wait: () => new Promise((resolve) => { resolveReceipt = resolve; }) };
          }
        };
        const firstClaim = App.claim();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.strictEqual(messages[0].message, App.t('claiming'), 'Le clic affiche immédiatement la réclamation en attente');
        resolveReceipt({ status: 1, blockNumber: 62500010 });
        await firstClaim;
        assert.strictEqual(messages.at(-1).message, App.t('claimed'));
        assert.strictEqual(messages.at(-1).isError, false);

        messages.length = 0;
        App.mine = {
          async claimRewards() {
            return {
              hash,
              wait: async () => { throw { code: 'SERVER_ERROR', message: 'server response 403', shortMessage: 'server response 403' }; }
            };
          }
        };
        App.provider = {
          async getTransactionReceipt(requestedHash) {
            assert.strictEqual(requestedHash, hash, 'Le reçu est revérifié par le hash après le 403');
            return { status: 1, blockNumber: 62500011 };
          }
        };
        App.updateData = async () => { throw { message: 'server response 403' }; };
        await App.claim();
        assert.deepStrictEqual(messages.map((item) => item.message), [App.t('claiming'), App.t('claimed')]);
        assert.ok(messages.every((item) => !item.message.includes('403') && !item.message.includes('server response')));

        messages.length = 0;
        App.updateData = async () => {};
        App.provider = { async getTransactionReceipt() { return null; } };
        await App.claim();
        assert.strictEqual(messages.at(-1).message, App.t('claimStillPending'));
        assert.ok(!messages.some((item) => item.message === App.t('claimed')), 'Aucune confirmation inventée sans reçu');
        assert.ok(messages.every((item) => !item.message.includes('403')));

        messages.length = 0;
        App.mine = {
          async claimRewards() { throw { code: 'SERVER_ERROR', message: 'server response 403', shortMessage: 'server response 403' }; }
        };
        await App.claim();
        assert.strictEqual(messages.at(-1).message, App.t('claimStillPending'));
        assert.strictEqual(messages.at(-1).isError, false, 'Un 403 RPC ne doit pas être présenté comme un échec de transaction');
        assert.ok(messages.every((item) => !item.message.includes('403') && !item.message.includes('Contrat :')));
      } finally {
        App.mine = originals.mine;
        App.provider = originals.provider;
        App.ensurePolGas = originals.ensurePolGas;
        App.updateData = originals.updateData;
        App.stopMiningCounter = originals.stopMiningCounter;
        App.startMiningCounter = originals.startMiningCounter;
        App.showToast = originals.showToast;
        App.userMachines = originals.userMachines;
        App.currentRealPower = originals.currentRealPower;
        App.pendingBalance = originals.pendingBalance;
        pendingElement.textContent = oldPendingText;
      }
    });

    await runTest('APP-UPDATE', 'Mise à jour obligatoire, message générique, téléchargement natif et blocage de la fermeture', async () => {
      const originalFetch = e2eWin.fetch;
      const nativeState = e2eWin.FitiaNative._state;
      const originalDownloads = nativeState.updateDownloads;
      const update = {
        enabled: true,
        versionCode: 331,
        versionName: '3.3.25',
        apkUrl: 'https://github.com/web3service/fitia-mining-pro/releases/download/v3.3.25/FITIA-PRO-Miner.apk',
        sha256: 'a'.repeat(64),
        notes: '<img src=x onerror=alert(1)> Notes techniques qui ne doivent pas être affichées'
      };
      nativeState.appVersionCode = 318;
      nativeState.updateDownloads = [];
      e2eWin.localStorage.setItem('fitia_update_dismissed_code', '319');
      e2eWin.fetch = async () => ({ ok: true, json: async () => update });

      try {
        await App.checkForUpdates(false);
        const modal = e2eWin.document.getElementById('modal-update');
        assert.ok(modal.classList.contains('active'), 'Une version supérieure ouvre toujours la mise à jour, même si elle était précédemment ignorée');
        assert.strictEqual(e2eWin.document.getElementById('update-required-title').textContent, App.t('updateRequiredTitle'));
        assert.strictEqual(e2eWin.document.getElementById('update-required-message').textContent, App.t('updateRequiredMessage'));
        assert.ok(!modal.textContent.includes('Notes techniques') && !modal.textContent.includes('onerror'), 'Les notes du manifeste ne sont jamais affichées');
        assert.strictEqual(modal.querySelector('img'), null, 'Aucun contenu HTML issu du manifeste');
        assert.strictEqual(e2eWin.document.getElementById('update-version'), null, 'Aucune description de version dans la modale');
        assert.strictEqual(modal.querySelector('.modal-close'), null, 'Aucun bouton de fermeture');
        assert.strictEqual(modal.querySelector('.update-later-btn'), null, 'Aucun bouton Plus tard');
        assert.strictEqual(App.availableUpdate.notes, undefined, 'Les notes distantes sont ignorées à la validation');
        assert.strictEqual(e2eWin.localStorage.getItem('fitia_update_dismissed_code'), null, 'L’ancienne préférence Plus tard est supprimée');

        App.closeModals();
        assert.ok(modal.classList.contains('active'), 'La fermeture générique des modales ne contourne pas la mise à jour');
        assert.strictEqual(e2eWin.onAndroidBackPressed(), true, 'Le bouton Retour Android est consommé');
        assert.ok(modal.classList.contains('active'), 'Le bouton Retour Android ne ferme pas la mise à jour');

        App.startUpdateDownload();
        assert.strictEqual(nativeState.updateDownloads.length, 1);
        assert.strictEqual(nativeState.updateDownloads[0].url, update.apkUrl);
        assert.strictEqual(nativeState.updateDownloads[0].expectedSha256, update.sha256);
        assert.ok(modal.classList.contains('active'), 'La mise à jour reste bloquante pendant le téléchargement et jusqu’à l’installation');

        assert.strictEqual(
          App.normalizeUpdateManifest({ ...update, apkUrl: 'https://example.com/FITIA-PRO-Miner.apk' }),
          null,
          'Une URL de téléchargement non autorisée est rejetée'
        );
        assert.strictEqual(App.normalizeUpdateManifest({ ...update, sha256: 'invalide' }), null);

        modal.classList.remove('active');
        App.availableUpdate = null;
        nativeState.appVersionCode = 331;
        await App.checkForUpdates(true);
        assert.ok(!modal.classList.contains('active'), 'Aucune notification si la version installée est à jour');
      } finally {
        e2eWin.fetch = originalFetch;
        nativeState.appVersionCode = 0;
        nativeState.updateDownloads = originalDownloads;
        e2eWin.localStorage.removeItem('fitia_update_dismissed_code');
        App.availableUpdate = null;
        App.updateCheckInFlight = false;
        e2eWin.document.getElementById('modal-update').classList.remove('active');
      }
    });

    await runTest('APP-ASSISTANT', 'Assistant local multilingue, réponses réelles, repli fiable et protection des secrets', async () => {
      const original = {
        lang: App.currentLang,
        pendingBalance: App.pendingBalance,
        chatHistory: App.chatHistory,
        bubbles: e2eWin.document.getElementById('chat-messages').innerHTML,
        input: e2eWin.document.getElementById('chat-input').value
      };
      try {
        App.setLanguage('en');
        App.pendingBalance = 4000;
        assert.ok(App.getWelcomeMessage().toLowerCase().includes('never share your recovery phrase'));
        const cases = [
          ['How do I create a new wallet?', ['create new wallet', '12 words']],
          ['How can I import my wallet?', ['import', 'private key']],
          ['Why do I need POL?', ['network fees', 'gas']],
          ['How do I buy and connect a machine?', ['shop', 'battery']],
          ['How do I claim my mining rewards?', ['claim', 'confirmation']],
          ['How do I deposit and withdraw?', ['deposit', 'withdraw']],
          ['What is slippage?', ['minimum received', 'price']],
          ['Why is my transaction pending?', ['polygon confirmation', 'history']],
          ['Where is my referral code?', ['settings', 'referral']],
          ['What happens if I forget my PIN?', ['recovery phrase', 'new pin']],
          ['How do I change the language?', ['language selector', 'english']]
        ];
        for (const [question, fragments] of cases) {
          const response = App.generateLocalResponse(question);
          for (const fragment of fragments) {
            assert.ok(response.toLowerCase().includes(fragment), `${question} → réponse utile contenant ${fragment}`);
          }
        }
        const pendingAnswer = App.generateLocalResponse('How much FTA can I claim?');
        assert.ok(pendingAnswer.includes('0.00004 FTA'), 'L’assistant convertit les unités brutes comme le tableau de bord');
        assert.ok(!pendingAnswer.includes('4000 FTA'));

        App.setLanguage('fr');
        const frenchAnswer = App.generateLocalResponse('Comment réclamer mes récompenses ?');
        assert.ok(frenchAnswer.includes('RÉCLAMER') && frenchAnswer.includes('confirmation on-chain'));
        App.setLanguage('en');

        const fallback = App.generateLocalResponse('Who will win the championship next year?');
        assert.ok(fallback.includes('don’t have enough reliable information'), 'Une question inconnue ne fabrique pas de réponse');
        assert.ok(fallback.includes('Rephrase your question'));

        const fakePrivateKey = `0x${'12'.repeat(32)}`;
        const fakeMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        assert.strictEqual(App.chatAssistant.containsSensitiveSecret(fakePrivateKey), true);
        assert.strictEqual(App.chatAssistant.containsSensitiveSecret(fakeMnemonic), true);
        assert.strictEqual(App.chatAssistant.containsSensitiveSecret('What is a private key?'), false);

        const walletSource = fs.readFileSync(path.join(ROOT, 'android-src', 'wallet.html'), 'utf8');
        const buildSource = fs.readFileSync(path.join(ROOT, 'scripts', 'build_apk.py'), 'utf8');
        assert.ok(walletSource.indexOf('src="assistant.js"') > 0);
        assert.ok(walletSource.indexOf('src="assistant.js"') < walletSource.indexOf('src="app.js"'), 'L’assistant est chargé avant l’application');
        assert.ok(buildSource.includes('"assistant.js"'), 'Le build Android embarque explicitement l’assistant hors ligne');

        const messages = e2eWin.document.getElementById('chat-messages');
        const input = e2eWin.document.getElementById('chat-input');
        App.chatHistory = [];
        messages.innerHTML = '';
        input.value = fakePrivateKey;
        App.sendChatMessage();
        await new Promise((resolve) => setTimeout(resolve, 400));
        assert.ok(!messages.textContent.includes(fakePrivateKey), 'Le secret n’est pas affiché dans le chat');
        assert.ok(!JSON.stringify(App.chatHistory).includes(fakePrivateKey), 'Le secret n’est pas conservé dans l’historique du chat');
        assert.ok(messages.textContent.includes('[Sensitive information hidden]'));
        assert.ok(messages.textContent.includes('Never share your recovery phrase'));
        assert.strictEqual(input.maxLength, 500);
      } finally {
        App.setLanguage(original.lang);
        App.pendingBalance = original.pendingBalance;
        App.chatHistory = original.chatHistory;
        e2eWin.document.getElementById('chat-messages').innerHTML = original.bubbles;
        e2eWin.document.getElementById('chat-input').value = original.input;
      }
    });

    await runTest('APP-ANNOUNCEMENTS', 'Bannière permanente, rotation lente, catégories, dates et annonces sans injection', async () => {
      const center = App.announcementCenter;
      const originalFetch = e2eWin.fetch;
      const originalLang = App.currentLang;
      const now = Date.parse('2026-10-24T12:00:00Z');
      assert.ok(center.initialized, 'Le centre est initialisé avec le wallet');
      assert.strictEqual(center.items.length, 4, 'Les quatre catégories locales sont disponibles hors ligne');
      assert.strictEqual(center.localFallback, true);
      assert.strictEqual(e2eWin.document.querySelectorAll('#announcement-track .announcement-slide').length, 5, 'Quatre annonces et le clone de boucle');
      assert.strictEqual(e2eWin.document.querySelector('#announcement-center .announcement-close'), null, 'La bannière permanente ne peut pas être fermée');
      while (center.fetchInFlight) await new Promise((resolve) => setTimeout(resolve, 0));
      while (App.promotionCenter.fetchInFlight) await new Promise((resolve) => setTimeout(resolve, 0));

      try {
        App.setLanguage('fr');
        center.stop();
        center.select(1);
        assert.strictEqual(center.index, 1);
        assert.match(e2eWin.document.getElementById('announcement-track').style.transform, /-100%/);
        assert.strictEqual(e2eWin.document.querySelector('#announcement-dots .active').getAttribute('aria-label'), 'Afficher l’annonce 2');
        center.stop();

        center.select(3);
        center.next(false);
        assert.strictEqual(center.index, 4, 'Le clone de la première annonce assure la continuité');
        const loopEvent = new e2eWin.Event('transitionend');
        Object.defineProperty(loopEvent, 'propertyName', { value: 'transform' });
        e2eWin.document.getElementById('announcement-track').dispatchEvent(loopEvent);
        assert.strictEqual(center.index, 0, 'La boucle revient à la première annonce sans saut');
        center.stop();

        const originalSetInterval = e2eWin.setInterval;
        let carouselDelay = 0;
        e2eWin.setInterval = (fn, milliseconds) => { carouselDelay = milliseconds; return 987654; };
        center.start();
        e2eWin.setInterval = originalSetInterval;
        assert.strictEqual(carouselDelay, 8000, 'Chaque annonce reste huit secondes avant la rotation');
        center.stop();

        const uploadedBackground = `assets/announcements/announcement-${'a'.repeat(24)}.webp`;
        const uploadedAvatar = `assets/announcements/announcement-${'b'.repeat(24)}.png`;
        const safe = {
          id: 'event-safe',
          category: 'event',
          title: { fr: '<img src=x> Événement officiel', en: 'Safe official event' },
          message: { fr: 'Texte <script>alert(1)</script> uniquement', en: 'Plain text only' },
          theme: 'celebration',
          font: 'elegant',
          backgroundImage: uploadedBackground,
          avatars: ['assets/avatars/team-1.svg', uploadedAvatar],
          startsAt: '2026-10-01T00:00:00Z',
          expiresAt: '2026-12-31T23:59:59Z'
        };
        const manifest = {
          enabled: true,
          announcements: [
            safe,
            { ...safe, id: 'event-safe', title: { fr: 'Doublon' } },
            { ...safe, id: 'disabled', enabled: false },
            { ...safe, id: 'bad-enabled', enabled: 'false' },
            { ...safe, id: 'expired', expiresAt: '2026-01-01T00:00:00Z' },
            { ...safe, id: 'future', startsAt: '2027-01-01T00:00:00Z' },
            { ...safe, id: 'bad-category', category: 'unknown' },
            { ...safe, id: 'bad-date', expiresAt: 'date-invalide' },
            { ...safe, id: 'bad-theme', theme: 'injected-theme' },
            { ...safe, id: 'bad-font', font: 'url(https://evil.example/font)' },
            { ...safe, id: 'bad-background', backgroundImage: 'https://evil.example/background.png' },
            { ...safe, id: 'bad-avatar', avatars: ['https://evil.example/avatar.png'] },
            { ...safe, id: 'duplicate-avatar', avatars: ['assets/avatars/team-1.svg', 'assets/avatars/team-1.svg'] },
            { ...safe, id: 'too-many-avatars', avatars: ['assets/avatars/team-1.svg', 'assets/avatars/team-2.svg', 'assets/avatars/team-3.svg', uploadedAvatar] }
          ]
        };
        const normalized = center.normalizeManifest(manifest, now);
        assert.strictEqual(normalized.length, 1, 'Doublons, catégories inconnues et dates invalides sont rejetés');
        assert.strictEqual(normalized[0].id, 'event-safe');

        e2eWin.fetch = async (url) => {
          assert.ok(String(url).includes('/announcements.json'));
          return { ok: true, json: async () => manifest };
        };
        await center.refresh();
        assert.strictEqual(center.localFallback, false);
        assert.strictEqual(center.items.length, 1, 'Seule l’annonce active et valide est publiée');
        assert.strictEqual(e2eWin.document.querySelectorAll('#announcement-track .announcement-slide').length, 1, 'Aucun clone inutile pour une annonce seule');
        assert.ok(e2eWin.document.querySelector('.announcement-title').textContent.includes('<img src=x>'), 'Le balisage reste du texte visible');
        assert.strictEqual(e2eWin.document.querySelector('#announcement-center script'), null, 'Aucun script distant ne peut être injecté');
        assert.strictEqual(e2eWin.document.querySelector('.announcement-copy img'), null, 'Aucune image injectée dans le texte');
        const visualSlide = e2eWin.document.querySelector('.announcement-slide');
        assert.ok(visualSlide.classList.contains('announcement-theme-celebration'));
        assert.ok(visualSlide.classList.contains('announcement-font-elegant'));
        assert.ok(visualSlide.classList.contains('has-background'));
        assert.ok(visualSlide.style.getPropertyValue('--announcement-bg-image').includes(uploadedBackground));
        assert.ok(visualSlide.style.getPropertyValue('--announcement-bg-image').includes('raw.githubusercontent.com'));
        assert.strictEqual(visualSlide.querySelectorAll('.announcement-avatars img').length, 2, 'Les avatars validés sont affichés');
        assert.strictEqual(visualSlide.querySelector('.announcement-avatars img').getAttribute('src'), 'assets/avatars/team-1.svg', 'Les avatars FITIA restent embarqués');
        assert.strictEqual(visualSlide.querySelector('.announcement-avatars').getAttribute('aria-hidden'), 'true');

        App.setLanguage('en');
        assert.strictEqual(e2eWin.document.querySelector('.announcement-title').textContent, 'Safe official event');
        App.setLanguage('fr');

        e2eWin.fetch = async () => ({ ok: true, json: async () => ({ enabled: false, announcements: [safe] }) });
        await center.refresh();
        assert.strictEqual(center.channelEnabled, false);
        assert.strictEqual(center.localFallback, false, 'Un manifeste désactivé ne doit pas réactiver les annonces locales');
        assert.strictEqual(center.items.length, 0);
        assert.ok(e2eWin.document.getElementById('announcement-center').classList.contains('hidden'), 'La section entière est masquée');
        assert.strictEqual(e2eWin.document.querySelectorAll('#announcement-track .announcement-slide').length, 0);
        center.start();
        assert.strictEqual(center.timer, null, 'La désactivation arrête aussi la rotation');

        e2eWin.fetch = async () => { throw new Error('offline'); };
        await center.refresh();
        assert.ok(e2eWin.document.getElementById('announcement-center').classList.contains('hidden'), 'Une panne ne change pas le dernier état désactivé valide');

        e2eWin.fetch = async () => ({ ok: true, json: async () => manifest });
        await center.refresh();
        assert.strictEqual(center.channelEnabled, true, 'La réactivation distante réouvre le canal');
        assert.strictEqual(center.items.length, 1);
        assert.ok(!e2eWin.document.getElementById('announcement-center').classList.contains('hidden'));
        assert.strictEqual(e2eWin.document.querySelectorAll('#announcement-track .announcement-slide').length, 1);

        e2eWin.fetch = async () => { throw new Error('offline'); };
        await center.refresh();
        assert.strictEqual(center.items.length, 1, 'Une panne réseau ne supprime pas les dernières annonces valides');

        const published = JSON.parse(fs.readFileSync(path.join(ROOT, 'announcements.json'), 'utf8'));
        const publishedItems = center.normalizeManifest({ ...published, enabled: true }, now);
        const expectedPublished = published.announcements.filter((item) => {
          if (item.enabled === false) return false;
          const startsAt = item.startsAt ? Date.parse(item.startsAt) : null;
          const expiresAt = item.expiresAt ? Date.parse(item.expiresAt) : null;
          return (startsAt === null || startsAt <= now) && (expiresAt === null || expiresAt > now);
        }).slice(0, 12);
        assert.deepStrictEqual(Array.from(publishedItems, (item) => item.id), expectedPublished.map((item) => item.id), 'Seules les annonces réellement activées et dans leur période sont publiées');
        assert.deepStrictEqual(new Set(publishedItems.map((item) => item.category)), new Set(expectedPublished.map((item) => item.category)));
      } finally {
        e2eWin.fetch = originalFetch;
        App.setLanguage(originalLang);
        center.stop();
        center.localFallback = true;
        center.channelEnabled = true;
        center.lastFetchAt = 0;
        center.items = center.defaults();
        center.index = 0;
        center.fetchInFlight = false;
        center.render();
        center.start();
      }
    });

    await runTest('APP-PROMOTIONS', 'Effets saisonniers ciblés, animations, dates, traductions et achats strictement inchangés', async () => {
      const center = App.promotionCenter;
      const originalFetch = e2eWin.fetch;
      const originals = {
        items: center.items,
        hiddenShopItems: center.hiddenShopItems,
        lastFetchAt: center.lastFetchAt,
        lang: App.currentLang,
        machines: App.shopMachinesData,
        batteries: App.shopBatteriesData,
        userMachines: App.userMachines,
        batteryInventory: App.batteryInventory,
        view: App.shopViewMode,
        payMode: App.payMode,
        ensurePolGas: App.ensurePolGas,
        buyMachine: App.buyMachine,
        buyBattery: App.buyBattery
      };
      const now = Date.now();
      const activeGift = {
        id: 'gift-machine-test', targetType: 'machine', targetId: 0, variant: 'gift',
        label: { fr: '<img src=x> JOYEUX NOËL', en: 'MERRY CHRISTMAS' },
        startsAt: new Date(now - 86400000).toISOString(), expiresAt: new Date(now + 86400000).toISOString()
      };
      const manifest = {
        enabled: true,
        promotions: [
          activeGift,
          { id: 'badge-battery-test', targetType: 'battery', targetId: 0, variant: 'badge', label: { fr: 'CADEAU', en: 'CHRISTMAS GIFT' } },
          { id: 'missing-machine-test', targetType: 'machine', targetId: 9, variant: 'gift', label: { fr: 'ABSENT' } },
          { ...activeGift, id: 'duplicate-target' },
          { ...activeGift, id: 'future', targetId: 1, startsAt: new Date(now + 86400000).toISOString() },
          { ...activeGift, id: 'expired', targetId: 1, expiresAt: new Date(now - 86400000).toISOString() },
          { ...activeGift, id: 'bad-target', targetId: 100 },
          { ...activeGift, id: 'null-target', targetId: null },
          { ...activeGift, id: 'bad-variant', variant: 'unknown-effect' },
          { ...activeGift, id: 'bad-date', expiresAt: 'date-invalide' }
        ]
      };

      try {
        App.setLanguage('fr');
        assert.ok(center.initialized, 'Le centre de décorations est initialisé avec le wallet');
        const normalized = center.normalizeManifest(manifest, now);
        assert.strictEqual(normalized.length, 3, 'Doublons, dates et styles invalides sont rejetés');
        assert.deepStrictEqual(Array.from(normalized, (item) => item.id), ['gift-machine-test', 'badge-battery-test', 'missing-machine-test']);
        center.items = normalized;
        App.shopMachinesData = [
          { price: 10, power: 1000, priceRaw: 10000000n, shopExpiry: 0 },
          { price: 50, power: 5000, priceRaw: 50000000n, shopExpiry: 0 }
        ];
        App.shopBatteriesData = [{ price: 5, days: 7, priceRaw: 5000000n }];
        App.shopViewMode = 'machines';
        App.payMode = 'USDT';
        await App.renderShop();
        const machineCards = e2eWin.document.querySelectorAll('#shop-list .rig-item');
        assert.strictEqual(machineCards.length, 2);
        assert.ok(machineCards[0].classList.contains('shop-promo-gift'));
        assert.strictEqual(normalized[0].animated, true, 'Les décorations existantes restent animées par défaut');
        assert.ok(machineCards[0].querySelector('.promotion-effect-gift svg'));
        assert.ok(machineCards[0].querySelectorAll('.promotion-particle').length > 0);
        assert.strictEqual(machineCards[0].getAttribute('data-promotion-id'), 'gift-machine-test');
        assert.ok(machineCards[0].querySelector('.shop-promo-label').textContent.includes('<img src=x>'));
        assert.strictEqual(machineCards[0].querySelector('.shop-promo-label img'), null, 'Le texte administrateur ne crée aucun HTML');
        assert.strictEqual(machineCards[0].querySelector('.rig-price').textContent, '10.00 $');
        assert.strictEqual(machineCards[0].querySelector('button').getAttribute('onclick'), 'App.buyMachine(0)');
        assert.strictEqual(machineCards[0].querySelector('button').disabled, false);
        assert.strictEqual(machineCards[1].querySelector('.shop-promo-label'), null);
        assert.strictEqual(e2eWin.document.querySelector('[data-promotion-id="missing-machine-test"]'), null, 'Une machine absente ne produit aucune décoration');

        App.setLanguage('en');
        assert.strictEqual(e2eWin.document.querySelector('#shop-list .shop-promo-label').textContent, 'MERRY CHRISTMAS');
        App.shopViewMode = 'batteries';
        await App.renderShop();
        const batteryCard = e2eWin.document.querySelector('#shop-list .battery-shop-item');
        assert.ok(batteryCard.classList.contains('shop-promo-badge'));
        assert.strictEqual(batteryCard.querySelector('.shop-promo-label').textContent, 'CHRISTMAS GIFT');
        assert.strictEqual(batteryCard.querySelector('.battery-price').textContent, '5.00 $');
        assert.strictEqual(batteryCard.querySelector('button').getAttribute('onclick'), 'App.buyBattery(0)');
        assert.strictEqual(App.buyMachine, originals.buyMachine);
        assert.strictEqual(App.buyBattery, originals.buyBattery);
        assert.strictEqual(App.shopMachinesData[0].price, 10);
        assert.strictEqual(App.shopBatteriesData[0].price, 5);

        const visibilityManifest = { ...manifest, hiddenShopItems: { machine: [1], battery: [0] } };
        e2eWin.fetch = async () => ({ ok: true, json: async () => visibilityManifest });
        await center.refresh({ force: true });
        App.shopViewMode = 'machines';
        await App.renderShop();
        let visibleMachines = e2eWin.document.querySelectorAll('#shop-list .rig-item');
        assert.strictEqual(visibleMachines.length, 1, 'Seul le type de machine masqué disparaît');
        assert.strictEqual(visibleMachines[0].querySelector('button').getAttribute('onclick'), 'App.buyMachine(0)');
        assert.strictEqual(visibleMachines[0].querySelector('.rig-price').textContent, '10.00 $');
        App.shopViewMode = 'batteries';
        await App.renderShop();
        assert.strictEqual(e2eWin.document.querySelectorAll('#shop-list .battery-shop-item').length, 0);
        App.userMachines = [{ tid: 1, exp: Math.floor(Date.now() / 1000) + 86400 }];
        App.batteryInventory = { 0: 2 };
        App.renderUserMachines();
        App.renderUserBatteries();
        assert.strictEqual(e2eWin.document.querySelectorAll('#my-machines-list .asset-row').length, 1, 'Une machine possédée reste visible');
        assert.strictEqual(e2eWin.document.querySelectorAll('#my-batteries-list .asset-row').length, 1, 'Une batterie possédée reste visible');
        let gasChecks = 0;
        const originalGasCheck = App.ensurePolGas;
        App.ensurePolGas = async () => { gasChecks += 1; return false; };
        await App.buyMachine(1);
        await App.buyMachine('1');
        await App.buyBattery(0);
        App.ensurePolGas = originalGasCheck;
        assert.strictEqual(gasChecks, 0, 'Un achat masqué est arrêté avant toute transaction');
        App.userMachines = originals.userMachines;
        App.batteryInventory = originals.batteryInventory;

        e2eWin.fetch = async () => ({ ok: true, json: async () => ({ ...manifest, hiddenShopItems: { machine: [], battery: [] } }) });
        await center.refresh({ force: true });
        App.shopViewMode = 'machines';
        await App.renderShop();
        visibleMachines = e2eWin.document.querySelectorAll('#shop-list .rig-item');
        assert.strictEqual(visibleMachines.length, 2, 'La réactivation restaure la machine sans relecture modifiée du contrat');
        assert.strictEqual(App.shopMachinesData[1].price, 50);
        App.shopViewMode = 'batteries';
        await App.renderShop();
        assert.strictEqual(e2eWin.document.querySelectorAll('#shop-list .battery-shop-item').length, 1);

        e2eWin.fetch = async (url) => {
          assert.ok(String(url).includes('/promotions.json'));
          return { ok: true, json: async () => manifest };
        };
        await center.refresh({ force: true });
        assert.strictEqual(center.items.length, 3);
        assert.notStrictEqual(center.boundaryTimer, null, 'La prochaine limite de date programme une réactualisation');
        e2eWin.fetch = async () => { throw new Error('offline'); };
        await center.refresh({ force: true });
        assert.strictEqual(center.items.length, 3, 'Une panne réseau conserve les dernières décorations valides');

        const datedCard = e2eWin.document.createElement('div');
        center.items = [normalized[0]];
        center.decorate(datedCard, 'machine', 0);
        assert.ok(datedCard.querySelector('.shop-promo-label'));
        center.items = [{ ...normalized[0], expiresAt: Date.now() - 1 }];
        center.decorate(datedCard, 'machine', 0);
        assert.strictEqual(datedCard.querySelector('.shop-promo-label'), null, 'Une décoration expirée disparaît au rendu suivant');
        assert.strictEqual(datedCard.classList.contains('shop-promo'), false);
        center.items = normalized;

        const effectVariants = e2eWin.FitiaPromotionEffects.VARIANTS;
        assert.deepStrictEqual(Array.from(effectVariants), ['gift', 'bells', 'snow', 'confetti', 'fireworks', 'hearts', 'blossom', 'halloween', 'badge']);
        const effectCard = e2eWin.document.createElement('div');
        for (const variant of effectVariants) {
          center.items = [{ ...normalized[0], id: `effect-${variant}`, variant, animated: true, startsAt: null, expiresAt: null }];
          center.decorate(effectCard, 'machine', 0);
          assert.ok(effectCard.classList.contains(`shop-promo-${variant}`));
          const effectSvg = effectCard.querySelector(`.promotion-effect-${variant} svg`);
          assert.ok(effectSvg, `Illustration locale ${variant}`);
          assert.strictEqual(effectSvg.querySelector('script, image, foreignObject'), null);
          const gradientIds = new Set(Array.from(effectSvg.querySelectorAll('defs [id]'), (element) => element.id));
          effectSvg.querySelectorAll('[fill], [stroke]').forEach((element) => {
            for (const attribute of ['fill', 'stroke']) {
              const value = element.getAttribute(attribute) || '';
              const match = value.match(/^url\(#(.+)\)$/);
              if (match) assert.ok(gradientIds.has(match[1]), `Dégradé local ${variant}`);
            }
          });
          assert.strictEqual(effectCard.querySelectorAll(':scope > .promotion-effect-decoration').length, 1);
          assert.ok(effectCard.querySelectorAll('.promotion-particle').length > 0, `Particules ${variant}`);
        }
        center.items = [{ ...normalized[0], id: 'static-bells', variant: 'bells', animated: false, startsAt: null, expiresAt: null }];
        center.decorate(effectCard, 'machine', 0);
        assert.ok(effectCard.classList.contains('promotion-effect-static'));
        assert.strictEqual(effectCard.querySelector('.promotion-effect-particles'), null, 'Le mode statique ne crée aucune particule');
        assert.ok(effectCard.querySelector('.promotion-effect-bells svg'));
        center.items = [];
        center.decorate(effectCard, 'machine', 0);
        assert.strictEqual(effectCard.querySelector('.promotion-effect-decoration'), null);
        assert.strictEqual(effectCard.classList.contains('shop-promo-bells'), false);
        center.items = normalized;

        const published = JSON.parse(fs.readFileSync(path.join(ROOT, 'promotions.json'), 'utf8'));
        assert.strictEqual(typeof published.enabled, 'boolean');
        assert.ok(Array.isArray(published.promotions));
        const publishedItems = center.normalizeManifest({ ...published, enabled: true }, now);
        assert.strictEqual(publishedItems.length, published.promotions.length, 'La configuration publiée reste valide sans imposer son activation ni un nombre fixe de promotions');
        const walletSource = fs.readFileSync(path.join(ROOT, 'android-src/wallet.html'), 'utf8');
        assert.ok(walletSource.indexOf('src="promotion-effects.js"') < walletSource.indexOf('src="promotions.js"'));
        assert.ok(walletSource.indexOf('src="promotions.js"') < walletSource.indexOf('src="app.js"'));
        assert.ok(walletSource.includes('href="promotion-effects.css"'));
        const buildSource = fs.readFileSync(path.join(ROOT, 'scripts/build_apk.py'), 'utf8');
        assert.ok(buildSource.includes('"promotions.js"'), 'Le prochain paquet APK embarque le module local');
        assert.ok(buildSource.includes('"promotion-effects.js"') && buildSource.includes('"promotion-effects.css"'), 'Les illustrations et animations sont embarquées localement');
      } finally {
        e2eWin.fetch = originalFetch;
        if (center.boundaryTimer !== null) e2eWin.clearTimeout(center.boundaryTimer);
        center.boundaryTimer = null;
        center.items = originals.items;
        center.hiddenShopItems = originals.hiddenShopItems;
        center.lastFetchAt = originals.lastFetchAt;
        center.fetchInFlight = false;
        App.shopMachinesData = originals.machines;
        App.shopBatteriesData = originals.batteries;
        App.userMachines = originals.userMachines;
        App.batteryInventory = originals.batteryInventory;
        App.ensurePolGas = originals.ensurePolGas;
        App.shopViewMode = originals.view;
        App.payMode = originals.payMode;
        App.setLanguage(originals.lang);
        await App.renderShop();
      }
    });

    await runTest('POLYGON-GAS', 'Plancher EIP-1559 Polygon >= 30 Gwei imposé automatiquement par PolygonRpcManager', async () => {
      const fees = await e2eWin.FitiaSecurity.Rpc.getOptimalFeeData(App.provider);
      const min30Gwei = ethersLib.parseUnits('30', 'gwei');
      assert.ok(BigInt(fees.maxPriorityFeePerGas) >= min30Gwei, 'maxPriorityFeePerGas >= 30 Gwei requis sur Polygon');
      assert.ok(BigInt(fees.maxFeePerGas) > BigInt(fees.maxPriorityFeePerGas));
    });

    await runTest('SWAP-UI', 'Cartes de marché stylées et logos locaux POL/USDT/FTA synchronisés avec la direction', async () => {
      const document = e2eWin.document;
      const options = Array.from(document.querySelectorAll('.swap-market-option[data-swap-market]'));
      assert.strictEqual(options.length, 2);
      assert.deepStrictEqual(options.map((option) => option.dataset.swapMarket), ['CORE_FTA', 'POL_USDT']);
      assert.strictEqual(document.getElementById('swap-market-select'), null, 'Le menu texte est remplacé par les cartes visuelles');
      document.getElementById('swap-from-in').value = '7.5';
      await App.setSwapMarket('CORE_FTA');
      assert.strictEqual(document.getElementById('swap-from-in').value, '7.5', 'Un appui sur le marché déjà actif conserve le montant');
      document.getElementById('swap-from-in').value = '';
      document.querySelectorAll('.swap-market-option img, .token-select img').forEach((image) => {
        const source = image.getAttribute('src');
        assert.ok(source.startsWith('assets/'), 'Les logos sont embarqués localement dans l’APK');
        assert.ok(fs.existsSync(path.join(ROOT, source)), `Logo local présent : ${source}`);
      });

      await App.setSwapMarket('POL_USDT');
      assert.strictEqual(document.getElementById('token-from-logo').getAttribute('src'), 'assets/pol.svg');
      assert.strictEqual(document.getElementById('token-to-logo').getAttribute('src'), 'assets/usdt.svg');
      assert.strictEqual(document.querySelector('[data-swap-market="POL_USDT"]').getAttribute('aria-pressed'), 'true');
      assert.strictEqual(document.querySelector('[data-swap-market="CORE_FTA"]').getAttribute('aria-pressed'), 'false');

      await App.toggleSwap();
      assert.strictEqual(document.getElementById('token-from-logo').getAttribute('src'), 'assets/usdt.svg');
      assert.strictEqual(document.getElementById('token-to-logo').getAttribute('src'), 'assets/pol.svg');

      await App.setSwapMarket('CORE_FTA');
      assert.strictEqual(document.getElementById('token-from-logo').getAttribute('src'), 'assets/usdt.svg');
      assert.strictEqual(document.getElementById('token-to-logo').getAttribute('src'), 'assets/fta.png');
      assert.strictEqual(document.querySelector('[data-swap-market="CORE_FTA"]').getAttribute('aria-pressed'), 'true');
      assert.strictEqual(document.querySelector('[data-swap-market="POL_USDT"]').getAttribute('aria-pressed'), 'false');
    });

    await runTest('MINING-UI', 'Compte Minage : titre corrigé, vrai logo FTA, sélecteur visuel et boutons sans suffixe', async () => {
      const document = e2eWin.document;
      const originalLang = App.currentLang;
      const tokenInput = document.getElementById('deposit-token-select');
      const amountInput = document.getElementById('deposit-amount');
      const originalToken = tokenInput.value;
      const originalAmount = amountInput.value;
      const originalPower = App.currentRealPower;
      const originalMachines = App.userMachines;

      try {
        App.setLanguage('fr');
        const title = document.querySelector('[data-i18n="miningVaultTitle"]');
        const depositButton = document.querySelector('[data-i18n="depositBtn"]');
        const withdrawButton = document.querySelector('[data-i18n="withdrawBtn"]');
        assert.strictEqual(title.textContent.trim(), '⚡ Compte Minage');
        assert.ok(!title.textContent.includes('Contrat FITIA'));
        assert.strictEqual(depositButton.textContent.trim(), 'DÉPOSER');
        assert.ok(!depositButton.textContent.includes('↓'));
        assert.strictEqual(withdrawButton.textContent.trim(), 'RETIRER');
        assert.ok(!withdrawButton.textContent.includes('↑'));
        assert.ok(!withdrawButton.textContent.includes('ij'));

        assert.strictEqual(tokenInput.type, 'hidden', 'La valeur USDT/FTA reste disponible aux opérations existantes');
        const options = Array.from(document.querySelectorAll('.transfer-token-option[data-transfer-token]'));
        assert.deepStrictEqual(options.map((option) => option.dataset.transferToken), ['USDT', 'FTA']);
        assert.deepStrictEqual(options.map((option) => option.querySelector('img').getAttribute('src')), ['assets/usdt.svg', 'assets/fta.png']);
        options.forEach((option) => {
          const source = option.querySelector('img').getAttribute('src');
          assert.ok(fs.existsSync(path.join(ROOT, source)), `Logo du sélecteur présent : ${source}`);
        });

        amountInput.value = '12.5';
        App.onTransferTokenChange('FTA');
        assert.strictEqual(tokenInput.value, 'FTA');
        assert.strictEqual(document.querySelector('[data-transfer-token="FTA"]').getAttribute('aria-pressed'), 'true');
        assert.strictEqual(document.querySelector('[data-transfer-token="USDT"]').getAttribute('aria-pressed'), 'false');
        assert.strictEqual(amountInput.value, '', 'Le changement de token conserve la réinitialisation du montant');

        amountInput.value = '3';
        App.onTransferTokenChange('USDT');
        assert.strictEqual(tokenInput.value, 'USDT');
        assert.strictEqual(document.querySelector('[data-transfer-token="USDT"]').getAttribute('aria-pressed'), 'true');
        assert.strictEqual(amountInput.value, '');
        App.onTransferTokenChange('POL');
        assert.strictEqual(tokenInput.value, 'USDT', 'Un token non pris en charge est ignoré');

        assert.strictEqual(document.getElementById('btn-pay-usdt').querySelector('img').getAttribute('src'), 'assets/usdt.svg');
        assert.strictEqual(document.getElementById('btn-pay-fta').querySelector('img').getAttribute('src'), 'assets/fta.png');
        assert.strictEqual(document.querySelectorAll('#view-shop .shop-tab svg').length, 2);
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .mining-rig').length, 3);
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .rig-gpu').length, 9, 'Chaque rig embarque trois GPU détaillés');
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .rig-control-screen').length, 3);
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .rig-power-cable').length, 3);
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .rig-airflow').length, 3);
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .rig-heatsink-fin').length, 81);
        const miningStyles = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
        assert.ok(!miningStyles.includes('@keyframes mining-rig-float'), 'Les rigs restent posés au lieu de flotter artificiellement');
        assert.ok(miningStyles.includes('.mining-rig.is-active .rig-airflow'), 'La ventilation animée est câblée à l’état actif');
        assert.ok(miningStyles.includes('.mining-rig.is-active .rig-cable-flow'), 'Le flux d’alimentation est câblé à l’état actif');
        App.currentRealPower = 0.25;
        App.userMachines = Array.from({ length: 4 }, (_, tid) => ({ tid, exp: Math.floor(Date.now() / 1000) + 86400 }));
        App.renderActiveMachines();
        assert.strictEqual(document.getElementById('mining-visualizer').dataset.activeMachines, '4');
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .mining-rig:not(.hidden)').length, 3, 'Trois rigs détaillés représentent le parc réel');
        assert.strictEqual(document.getElementById('mining-rig-stage').dataset.visibleRigs, '3');
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .mining-rig.is-active').length, 3);
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .mining-rig.is-active .rig-fan').length, 9);
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .mining-rig.is-active .rig-gpu').length, 9);
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .mining-rig.is-active .rig-cable-flow').length, 3);
        assert.ok(document.getElementById('viz-machine-count').textContent.startsWith('4 • '), 'Le compteur conserve le nombre réel total');
        App.currentRealPower = 0;
        App.syncMiningScene(4);
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .mining-rig.is-active').length, 0, 'Aucune activité simulée lorsque la puissance réelle est nulle');
        App.userMachines = [];
        App.renderActiveMachines();
        assert.strictEqual(document.getElementById('mining-visualizer').dataset.activeMachines, '0');
        assert.strictEqual(document.querySelectorAll('#mining-rig-stage .mining-rig:not(.hidden)').length, 1);
        assert.strictEqual(document.getElementById('viz-machine-count').textContent, '—');

        for (const [lang, depositLabel] of Object.entries({ en: 'DEPOSIT', de: 'EINZAHLEN', zh: '存入' })) {
          App.setLanguage(lang);
          assert.ok(!title.textContent.includes('FITIA Contract') && !title.textContent.includes('(FITIA)') && !title.textContent.includes('FITIA 合约'));
          assert.strictEqual(depositButton.textContent.trim(), depositLabel);
          assert.ok(!depositButton.textContent.includes('↓'));
          assert.ok(!withdrawButton.textContent.includes('↑'));
        }
      } finally {
        App.onTransferTokenChange(originalToken);
        amountInput.value = originalAmount;
        App.currentRealPower = originalPower;
        App.userMachines = originalMachines;
        App.renderActiveMachines();
        App.setLanguage(originalLang);
      }
    });

    await runTest('PLUG-UI', 'Connexion Machine/Batterie : sélection visuelle, stock, aperçu et transaction protégée', async () => {
      const document = e2eWin.document;
      const machineInput = document.getElementById('plug-machine-id');
      const batteryInput = document.getElementById('plug-battery-type');
      const submit = document.getElementById('btn-plug-machine');
      const originals = {
        userMachines: App.userMachines,
        batteryInventory: App.batteryInventory,
        batteryTypeDurations: App.batteryTypeDurations,
        mine: App.mine,
        ensurePolGas: App.ensurePolGas,
        updateData: App.updateData,
        showToast: App.showToast,
        lang: App.currentLang,
        machineValue: machineInput.value,
        batteryValue: batteryInput.value,
        inProgress: App.plugTransactionInProgress
      };
      const messages = [];
      const calls = [];
      const now = Math.floor(Date.now() / 1000);

      try {
        App.userMachines = [
          { tid: 0, exp: 0 },
          { tid: 1, exp: now - 60 },
          { tid: 2, exp: now + 3600 }
        ];
        App.batteryInventory = { 0: 2, 1: 1 };
        App.batteryTypeDurations = { 0: 7, 1: 30, 2: 90 };
        App.showToast = (message, isError = false) => messages.push({ message, isError });
        machineInput.value = '';
        batteryInput.value = '';
        App.renderPlugInterface();

        assert.strictEqual(document.querySelectorAll('[data-plug-machine]').length, 2, 'Seules les machines non actives sont proposées');
        assert.strictEqual(document.querySelector('[data-plug-machine="2"]'), null, 'La machine active est exclue');
        assert.strictEqual(document.querySelectorAll('[data-plug-battery]').length, 2, 'Seules les batteries en stock sont proposées');
        assert.strictEqual(document.querySelector('[data-plug-battery="2"]'), null, 'Le type sans stock est exclu');
        assert.strictEqual(document.getElementById('plug-machine-count').textContent, '2');
        assert.strictEqual(document.getElementById('plug-battery-count').textContent, '3');
        assert.strictEqual(submit.disabled, true, 'La confirmation reste désactivée sans sélection');

        assert.strictEqual(App.selectPlugMachine(1), true);
        assert.strictEqual(App.selectPlugBattery(1), true);
        assert.strictEqual(machineInput.value, '1');
        assert.strictEqual(batteryInput.value, '1');
        assert.strictEqual(document.querySelector('[data-plug-machine="1"]').getAttribute('aria-pressed'), 'true');
        assert.strictEqual(document.querySelector('[data-plug-battery="1"]').getAttribute('aria-pressed'), 'true');
        assert.strictEqual(document.getElementById('plug-connector').classList.contains('ready'), true);
        assert.ok(document.getElementById('plug-summary').textContent.includes('#1'));
        assert.ok(document.getElementById('plug-summary').textContent.includes('30'));
        assert.strictEqual(submit.disabled, false, 'La paire valide active la confirmation');

        App.renderPlugInterface();
        assert.strictEqual(machineInput.value, '1', 'Une actualisation conserve la machine valide');
        assert.strictEqual(batteryInput.value, '1', 'Une actualisation conserve la batterie valide');
        App.quickSelectMachineToPlug(0);
        assert.strictEqual(machineInput.value, '0', 'Le raccourci d’une machine préremplit la sélection visuelle');
        assert.strictEqual(batteryInput.value, '1');

        let resolveReceipt;
        App.ensurePolGas = async () => true;
        App.updateData = async () => {};
        App.mine = {
          plugInMachine: async (...args) => {
            calls.push(args);
            return { wait: () => new Promise((resolve) => { resolveReceipt = resolve; }) };
          }
        };
        const firstConnection = App.plugInMachine();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(App.plugTransactionInProgress, true);
        assert.strictEqual(submit.disabled, true, 'Le bouton est bloqué pendant la confirmation');
        await App.plugInMachine();
        assert.strictEqual(calls.length, 1, 'Un double-clic ne crée pas une deuxième transaction');
        resolveReceipt({ status: 1 });
        await firstConnection;
        assert.deepStrictEqual(calls, [[0, 1]], 'Les index visuels sont transmis sans modification au contrat');
        assert.strictEqual(App.plugTransactionInProgress, false);
        assert.strictEqual(machineInput.value, '', 'La machine connectée est retirée de la sélection après confirmation');
        assert.strictEqual(batteryInput.value, '1', 'Le type de batterie reste disponible pour une prochaine connexion');

        machineInput.value = '2';
        batteryInput.value = '1';
        await App.plugInMachine();
        assert.strictEqual(calls.length, 1, 'Une machine active ne peut pas être envoyée au contrat');
        assert.strictEqual(messages.at(-1).message, App.t('errRunning'));
        machineInput.value = '0';
        batteryInput.value = '2';
        await App.plugInMachine();
        assert.strictEqual(calls.length, 1, 'Une batterie sans stock ne peut pas être envoyée au contrat');
        assert.strictEqual(messages.at(-1).message, App.t('errNoBattery'));
      } finally {
        App.userMachines = originals.userMachines;
        App.batteryInventory = originals.batteryInventory;
        App.batteryTypeDurations = originals.batteryTypeDurations;
        App.mine = originals.mine;
        App.ensurePolGas = originals.ensurePolGas;
        App.updateData = originals.updateData;
        App.showToast = originals.showToast;
        App.plugTransactionInProgress = originals.inProgress;
        machineInput.value = originals.machineValue;
        batteryInput.value = originals.batteryValue;
        App.setLoader(false);
        App.setLanguage(originals.lang);
        App.renderPlugInterface();
      }
    });

    await runTest('IMPORT-UI', 'Importer un portefeuille : Retour et choix du PIN sans caractères parasites', async () => {
      const document = e2eWin.document;
      const originalLang = App.currentLang;
      const importStep = document.getElementById('auth-step-import');
      const backButton = importStep.querySelector('.auth-back-btn');
      const pinButton = document.getElementById('btn-import-continue');

      try {
        App.setLanguage('fr');
        assert.strictEqual(backButton.textContent.trim(), 'Retour');
        assert.strictEqual(pinButton.textContent.trim(), 'CHOISIR MON CODE PIN');
        assert.ok(!backButton.textContent.includes('←') && !backButton.textContent.includes('ij'));
        assert.ok(!pinButton.textContent.includes('→') && !pinButton.textContent.includes("'n") && !pinButton.textContent.includes('\\n'));
        document.querySelectorAll('.auth-back-btn').forEach((button) => {
          assert.strictEqual(button.textContent.trim(), 'Retour', 'Aucun symbole parasite autour de Retour');
        });
        assert.strictEqual(backButton.getAttribute('onclick'), 'App.cancelImportFlow()');
        assert.strictEqual(pinButton.getAttribute('onclick'), 'App.submitImportSecret()');

        App.setLanguage('en');
        assert.strictEqual(backButton.textContent.trim(), 'Back');
        assert.strictEqual(pinButton.textContent.trim(), 'SET MY 6-DIGIT PIN');
      } finally {
        App.setLanguage(originalLang);
      }
    });

    await runTest('BRANDING', 'Le vrai logo FTA est aussi la source des icônes de téléchargement et Android', async () => {
      const officialLogoSha256 = 'ecc7f5ff1020467b333de258cc46cb6aafcf99432edb40698b82dda8f0d37c9d';
      for (const relativePath of ['assets/fta.png', 'assets/icon-512.png']) {
        const contents = fs.readFileSync(path.join(ROOT, relativePath));
        assert.strictEqual(crypto.createHash('sha256').update(contents).digest('hex'), officialLogoSha256, `Logo officiel inchangé : ${relativePath}`);
      }
      assert.ok(!fs.existsSync(path.join(ROOT, 'assets/fta.svg')), 'L’ancien dessin FTA générique est supprimé');
      const walletSource = fs.readFileSync(path.join(ROOT, 'android-src/wallet.html'), 'utf8');
      const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
      const landingSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const buildSource = fs.readFileSync(path.join(ROOT, 'scripts/build_apk.py'), 'utf8');
      assert.ok(!walletSource.includes('assets/fta.svg') && !appSource.includes('assets/fta.svg'));
      assert.ok(landingSource.includes('src="assets/icon-192.png"'), 'La page de téléchargement conserve le logo FITIA');
      assert.ok(buildSource.includes('"assets", "icon-512.png"'), 'Les icônes Android sont générées depuis le logo officiel 512 px');
      assert.ok(buildSource.includes('"fitia_pro_launcher.png"') && buildSource.includes('"fitia_pro_launcher_foreground.png"'));
      const androidManifest = fs.readFileSync(path.join(ROOT, 'android-src/AndroidManifest.xml'), 'utf8');
      assert.ok(androidManifest.includes('android:icon="@mipmap/fitia_pro_launcher"'));
      assert.ok(androidManifest.includes('android:roundIcon="@mipmap/fitia_pro_launcher_round"'));
      assert.ok(!androidManifest.includes('@mipmap/ic_launcher'), 'L’ancien nom de ressource potentiellement mis en cache n’est plus référencé');
      for (const dpi of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
        const resourceDir = path.join(ROOT, 'android-src/res', `mipmap-${dpi}`);
        for (const filename of ['fitia_pro_launcher.png', 'fitia_pro_launcher_round.png', 'fitia_pro_launcher_foreground.png']) {
          assert.ok(fs.existsSync(path.join(resourceDir, filename)), `Ressource FITIA présente : ${dpi}/${filename}`);
        }
        assert.ok(!fs.existsSync(path.join(resourceDir, 'ic_launcher.png')));
      }
      for (const filename of ['fitia_pro_launcher.xml', 'fitia_pro_launcher_round.xml']) {
        const adaptiveIcon = fs.readFileSync(path.join(ROOT, 'android-src/res/mipmap-anydpi-v26', filename), 'utf8');
        assert.ok(adaptiveIcon.includes('@mipmap/fitia_pro_launcher_foreground'));
      }
    });

    await runTest('SWAP-DEX', 'POL ↔ USDT : devis QuickSwap réel, minimum reçu, slippage et conservation du swap FITIA Core', async () => {
      const document = e2eWin.document;
      const marketOptions = Array.from(document.querySelectorAll('.swap-market-option[data-swap-market]'));
      assert.strictEqual(marketOptions.length, 2);
      assert.strictEqual(marketOptions[0].dataset.swapMarket, 'CORE_FTA');
      assert.strictEqual(marketOptions[1].dataset.swapMarket, 'POL_USDT');

      await App.setSwapMarket('POL_USDT');
      assert.strictEqual(App.swapDirection, 'POL_TO_USDT');
      assert.strictEqual(document.getElementById('token-from-display').textContent, 'POL');
      assert.strictEqual(document.getElementById('token-to-display').textContent, 'USDT');
      assert.strictEqual(document.getElementById('btn-execute-swap').disabled, true, 'Aucun swap DEX sans devis valide');

      document.getElementById('swap-from-in').value = '2';
      await App.calcSwap();
      const polQuote = App.pendingDexQuote;
      assert.ok(polQuote, 'Le devis POL → USDT est disponible');
      assert.strictEqual(polQuote.path[0].toLowerCase(), '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270');
      assert.strictEqual(polQuote.path[1].toLowerCase(), '0xc2132d05d31c914a87c6611c10748aeb04b58e8f');
      assert.ok(polQuote.expectedOut > 0n);
      assert.strictEqual(polQuote.minOut, (polQuote.expectedOut * 9950n) / 10000n);
      assert.ok(polQuote.priceImpactBps >= 30n, 'L’écart affiché inclut au moins les 0,30 % du pool');
      assert.strictEqual(document.getElementById('btn-execute-swap').disabled, false);
      assert.strictEqual(document.getElementById('swap-details').classList.contains('hidden'), false);
      assert.strictEqual(document.getElementById('swap-to-in').value, App.formatSwapAmount(polQuote.expectedOut, 6, 6));
      assert.strictEqual(document.getElementById('swap-detail-fee').textContent, '0.30%');
      assert.ok(document.getElementById('swap-detail-min').textContent.includes('USDT'));
      assert.ok(document.getElementById('swap-detail-rate').textContent.startsWith('1 POL = '));

      await App.toggleSwap();
      assert.strictEqual(App.swapDirection, 'USDT_TO_POL');
      assert.strictEqual(document.getElementById('token-from-display').textContent, 'USDT');
      assert.strictEqual(document.getElementById('token-to-display').textContent, 'POL');
      document.getElementById('swap-from-in').value = '10';
      await App.calcSwap();
      const usdtQuote = App.pendingDexQuote;
      assert.ok(usdtQuote, 'Le devis USDT → POL est disponible');
      assert.strictEqual(usdtQuote.path[0].toLowerCase(), '0xc2132d05d31c914a87c6611c10748aeb04b58e8f');
      assert.strictEqual(usdtQuote.path[1].toLowerCase(), '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270');
      assert.ok(usdtQuote.expectedOut > 0n);
      assert.strictEqual(usdtQuote.minOut, (usdtQuote.expectedOut * 9950n) / 10000n);
      assert.ok(document.getElementById('swap-detail-rate').textContent.startsWith('1 USDT = '));

      document.getElementById('swap-from-in').value = '999999';
      await App.calcSwap();
      assert.strictEqual(App.pendingDexQuote, null);
      assert.strictEqual(document.getElementById('btn-execute-swap').disabled, true);
      assert.strictEqual(document.getElementById('swap-rate').textContent, App.t('errInsufficientFunds'));

      await App.setSwapMarket('CORE_FTA');
      const previousFtaPrice = App.ftaPriceUsd;
      App.ftaPriceUsd = 0.01;
      document.getElementById('swap-from-in').value = '10';
      App.calcSwap();
      assert.strictEqual(App.swapDirection, 'USDT_TO_FTA');
      assert.strictEqual(document.getElementById('swap-to-in').value, '960.000000', 'Le calcul USDT → FTA à 4 % est conservé');
      assert.strictEqual(document.getElementById('swap-detail-fee').textContent, '0.400000 USDT');
      assert.strictEqual(document.getElementById('btn-execute-swap').disabled, false);
      App.ftaPriceUsd = previousFtaPrice;
      document.getElementById('swap-from-in').value = '';
      document.getElementById('swap-to-in').value = '';
      document.getElementById('swap-details').classList.add('hidden');
    });

    await runTest('SWAP-DEX', 'Autorisation USDT exacte, remise à zéro USDT et erreurs DEX non mensongères', async () => {
      const originalToken = App.usdtToken;
      const originalToast = App.showToast;
      const approvals = [];
      App.showToast = () => {};
      const fakeToken = (allowance) => ({
        async allowance() { return allowance; },
        async approve(spender, amount) {
          approvals.push({ spender, amount });
          return { wait: async () => ({ status: 1 }) };
        }
      });
      try {
        App.usdtToken = fakeToken(100n);
        await App.ensureDexUsdtAllowance(100n);
        assert.strictEqual(approvals.length, 0, 'Aucune approbation si l’allowance suffit');

        App.usdtToken = fakeToken(0n);
        await App.ensureDexUsdtAllowance(100n);
        assert.strictEqual(approvals.length, 1);
        assert.strictEqual(approvals[0].amount, 100n, 'Allowance limitée au montant du swap');
        assert.strictEqual(approvals[0].spender.toLowerCase(), App.quickswapRouter.target.toLowerCase());

        approvals.length = 0;
        App.usdtToken = fakeToken(50n);
        await App.ensureDexUsdtAllowance(100n);
        assert.deepStrictEqual(approvals.map((item) => item.amount), [0n, 100n], 'USDT est remis à zéro avant la nouvelle allowance');
      } finally {
        App.usdtToken = originalToken;
        App.showToast = originalToast;
      }
      assert.strictEqual(App.getErrorMessage({ code: 'ACTION_REJECTED' }), App.t('swapRejected'));
      assert.strictEqual(App.getErrorMessage({ message: 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT' }), App.t('swapSlippageError'));
      assert.strictEqual(App.getErrorMessage({ message: 'UniswapV2Router: EXPIRED' }), App.t('swapExpired'));
    });

    await runTest('SWAP-DEX', 'Exécution POL/USDT : paramètres router, statut pending puis confirmé dans les deux sens', async () => {
      const document = e2eWin.document;
      await App.setSwapMarket('POL_USDT');
      const originals = {
        ensurePolGas: App.ensurePolGas,
        ensureDexPolGas: App.ensureDexPolGas,
        ensureDexTokenSwapGas: App.ensureDexTokenSwapGas,
        ensureDexUsdtAllowance: App.ensureDexUsdtAllowance,
        updateData: App.updateData,
        showToast: App.showToast
      };
      const toasts = [];
      let polCall = null;
      let usdtCall = null;
      let approvedAmount = 0n;
      try {
        App.ensurePolGas = async () => true;
        App.ensureDexPolGas = async () => true;
        App.ensureDexTokenSwapGas = async () => true;
        App.ensureDexUsdtAllowance = async (amount) => { approvedAmount = amount; };
        App.updateData = async () => {};
        App.showToast = (message) => { toasts.push(message); };

        document.getElementById('swap-from-in').value = '2';
        await App.calcSwap();
        const expectedPolMin = App.pendingDexQuote.minOut;
        App.quickswapRouter.swapExactETHForTokens = async (...args) => {
          polCall = args;
          return { wait: async () => ({ status: 1 }) };
        };
        await App.executeSwap();
        assert.ok(polCall, 'Le router POL → USDT est appelé');
        assert.strictEqual(polCall[0], expectedPolMin);
        assert.strictEqual(polCall[2], App.user);
        assert.ok(polCall[3] > BigInt(Math.floor(Date.now() / 1000)));
        assert.strictEqual(polCall[4].value, ethersLib.parseEther('2'));
        assert.strictEqual(document.getElementById('swap-from-in').value, '');
        assert.ok(toasts.includes(App.t('swapPending')) && toasts.includes(App.t('swapSuccess')));
        assert.strictEqual(App.swapTransactionInProgress, false);

        App.swapDirection = 'USDT_TO_POL';
        App.renderSwapInterface();
        document.getElementById('swap-from-in').value = '10';
        await App.calcSwap();
        const expectedUsdtMin = App.pendingDexQuote.minOut;
        App.quickswapRouter.swapExactTokensForETH = async (...args) => {
          usdtCall = args;
          return { wait: async () => ({ status: 1 }) };
        };
        await App.executeSwap();
        assert.ok(usdtCall, 'Le router USDT → POL est appelé');
        assert.strictEqual(usdtCall[0], ethersLib.parseUnits('10', 6));
        assert.strictEqual(approvedAmount, ethersLib.parseUnits('10', 6));
        assert.strictEqual(usdtCall[1], expectedUsdtMin);
        assert.strictEqual(usdtCall[3], App.user);
        assert.ok(usdtCall[4] > BigInt(Math.floor(Date.now() / 1000)));
        assert.strictEqual(document.getElementById('swap-from-in').value, '');
        assert.strictEqual(App.swapTransactionInProgress, false);
      } finally {
        delete App.quickswapRouter.swapExactETHForTokens;
        delete App.quickswapRouter.swapExactTokensForETH;
        Object.assign(App, originals);
        await App.setSwapMarket('CORE_FTA');
      }
    });

    await runTest('SEND-GUARDS', 'Blocage adresse burn (0x000..0), adresses de contrats (USDT/FTA/Core/Mine) & solde insuffisant', async () => {
      let pinPromptTriggered = false;
      const origReqPin = App.requestPinVerification.bind(App);
      App.requestPinVerification = async (...args) => {
        pinPromptTriggered = true;
        return origReqPin(...args);
      };

      App.openSend();
      e2eWin.document.getElementById('send-token-select').value = 'USDT';

      // 1) Adresse burn 0x000...000
      e2eWin.document.getElementById('send-to-address').value = '0x0000000000000000000000000000000000000000';
      e2eWin.document.getElementById('send-amount').value = '10';
      await App.executeSend();
      assert.strictEqual(pinPromptTriggered, false, 'Adresse burn bloquée avant demande de PIN');

      // 2) Adresse contrat USDT
      e2eWin.document.getElementById('send-to-address').value = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
      e2eWin.document.getElementById('send-amount').value = '10';
      await App.executeSend();
      assert.strictEqual(pinPromptTriggered, false, 'Adresse contrat USDT bloquée avant demande de PIN');

      // 3) Montant supérieur au solde avec virgule européenne
      e2eWin.document.getElementById('send-to-address').value = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      e2eWin.document.getElementById('send-amount').value = '999999,50';
      await App.executeSend();
      assert.strictEqual(pinPromptTriggered, false, 'Solde insuffisant bloqué avant demande de PIN');

      App.requestPinVerification = origReqPin;
    });

    await runTest('TRANSACTION-UX', 'Messages professionnels : 403 neutre, confirmation réelle et échec confirmé sans détail RPC', async () => {
      const originals = { showToast: App.showToast, provider: App.provider };
      const messages = [];
      const hash = `0x${'cd'.repeat(32)}`;
      const rpc403 = () => ({ code: 'SERVER_ERROR', message: 'contract: server response 403', shortMessage: 'contract: server response 403' });
      App.showToast = (message, isError = false, tone = '') => messages.push({ message, isError, tone });
      try {
        App.provider = { getTransactionReceipt: async () => null };
        const pendingTx = { hash, wait: async () => { throw rpc403(); } };
        const pendingError = await App.waitForTransactionReceipt(pendingTx).catch((error) => error);
        assert.strictEqual(pendingError.code, 'TRANSACTION_CONFIRMATION_PENDING');
        App.showError(pendingError);
        assert.strictEqual(messages.at(-1).message, App.t('transactionPendingCheck'));
        assert.strictEqual(messages.at(-1).isError, false);
        assert.strictEqual(messages.at(-1).tone, 'pending');
        assert.ok(messages.every((item) => !/403|contract:|server response/i.test(item.message)));

        App.provider = { getTransactionReceipt: async (requestedHash) => {
          assert.strictEqual(requestedHash, hash);
          return { status: 1, blockNumber: 62500020 };
        } };
        const confirmed = await App.waitForTransactionReceipt(pendingTx);
        assert.strictEqual(confirmed.status, 1, 'Le reçu retrouvé par hash confirme réellement la transaction');

        const failedTx = { hash, wait: async () => ({ status: 0 }) };
        const failedError = await App.waitForTransactionReceipt(failedTx).catch((error) => error);
        assert.strictEqual(failedError.code, 'TRANSACTION_FAILED');
        App.showError(failedError);
        assert.strictEqual(messages.at(-1).message, App.t('transactionFailed'));
        assert.strictEqual(messages.at(-1).isError, true);

        const sanitized = App.getErrorMessage({ shortMessage: 'execution reverted: internal contract detail' });
        assert.strictEqual(sanitized, App.t('transactionNotConfirmed'));
        assert.ok(!sanitized.includes('internal contract detail'));
      } finally {
        App.showToast = originals.showToast;
        App.provider = originals.provider;
      }
    });

    await runTest('SEND-UI', 'Boutons Envoyer/Recevoir professionnels et sélecteur POL/USDT/FTA avec logos locaux', async () => {
      const document = e2eWin.document;
      const primaryActions = Array.from(document.querySelectorAll('.wallet-primary-actions .wallet-primary-action'));
      assert.strictEqual(primaryActions.length, 2);
      assert.ok(primaryActions.every((button) => button.querySelector('.wallet-action-icon svg') && button.querySelector('.wallet-action-copy small')));
      const tokenInput = document.getElementById('send-token-select');
      assert.strictEqual(tokenInput.type, 'hidden');
      const options = Array.from(document.querySelectorAll('[data-send-token]'));
      assert.deepStrictEqual(options.map((option) => option.dataset.sendToken), ['POL', 'USDT', 'FTA']);
      assert.deepStrictEqual(options.map((option) => option.querySelector('img').getAttribute('src')), ['assets/pol.svg', 'assets/usdt.svg', 'assets/fta.png']);
      options.forEach((option) => assert.ok(fs.existsSync(path.join(ROOT, option.querySelector('img').getAttribute('src')))));

      App.openSend();
      document.getElementById('send-amount').value = '12';
      App.selectSendToken('USDT');
      assert.strictEqual(tokenInput.value, 'USDT');
      assert.strictEqual(document.getElementById('send-amount').value, '', 'Le changement de token efface le montant par sécurité');
      assert.strictEqual(document.getElementById('send-token-current-logo').getAttribute('src'), 'assets/usdt.svg');
      assert.strictEqual(document.querySelector('[data-send-token="USDT"]').getAttribute('aria-selected'), 'true');
      App.toggleSendTokenMenu();
      assert.strictEqual(document.getElementById('send-token-trigger').getAttribute('aria-expanded'), 'true');
      App.selectSendToken('FTA');
      assert.strictEqual(document.getElementById('send-token-current-logo').getAttribute('src'), 'assets/fta.png');
      assert.strictEqual(document.getElementById('send-token-trigger').getAttribute('aria-expanded'), 'false');
      App.closeModals();
      App.selectSendToken('POL');
    });

    await runTest('SEND-SECURITY', 'Montant exact, double-clic bloqué et changement de session pendant le PIN sans transfert', async () => {
      const document = e2eWin.document;
      const originals = {
        user: App.user,
        usdtToken: App.usdtToken,
        requestPin: App.requestPinVerification,
        ensurePolGas: App.ensurePolGas,
        updateData: App.updateData,
        showToast: App.showToast
      };
      const transfers = [];
      const messages = [];
      const recipient = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      const hash = `0x${'ef'.repeat(32)}`;
      let resolveReceipt;
      const pinSecret = { privateKey: 'temporary-private', mnemonic: 'temporary-mnemonic' };
      try {
        App.usdtToken = {
          balanceOf: async () => ethersLib.parseUnits('2', 6),
          transfer: async (to, amount) => {
            transfers.push({ to, amount });
            return { hash, wait: () => new Promise((resolve) => { resolveReceipt = resolve; }) };
          }
        };
        App.ensurePolGas = async () => true;
        App.updateData = async () => {};
        App.requestPinVerification = async () => ({ secret: pinSecret });
        App.showToast = (message, isError = false, tone = '') => messages.push({ message, isError, tone });

        App.openSend();
        App.selectSendToken('USDT');
        document.getElementById('send-to-address').value = recipient;
        document.getElementById('send-amount').value = '1.234567';
        const firstSend = App.executeSend();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await App.executeSend();
        if (resolveReceipt) resolveReceipt({ status: 1, blockNumber: 62500021 });
        await firstSend;

        assert.strictEqual(transfers.length, 1, 'Le double-clic ne crée pas une seconde transaction');
        assert.strictEqual(transfers[0].amount, 1234567n, 'Le montant signé conserve exactement les six décimales USDT');
        assert.strictEqual(transfers[0].to, ethersLib.getAddress(recipient));
        assert.strictEqual(pinSecret.privateKey, '');
        assert.strictEqual(pinSecret.mnemonic, '');
        assert.strictEqual(App.sendTransactionInProgress, false);
        assert.strictEqual(document.getElementById('send-confirm-button').disabled, false);
        assert.strictEqual(messages.at(-1).message, App.t('sentSuccess'));
        assert.ok(messages.some((item) => item.message === App.t('sending') && item.tone === 'pending' && !item.isError));

        const sessionSecret = { privateKey: 'temporary-private', mnemonic: 'temporary-mnemonic' };
        App.openSend();
        App.selectSendToken('USDT');
        document.getElementById('send-to-address').value = recipient;
        document.getElementById('send-amount').value = '1';
        App.requestPinVerification = async () => {
          App.user = `0x${'99'.repeat(20)}`;
          return { secret: sessionSecret };
        };
        await App.executeSend();
        assert.strictEqual(transfers.length, 1, 'Aucun transfert n’est signé après un changement de session pendant le PIN');
        assert.strictEqual(messages.at(-1).message, App.t('walletSessionChanged'));
        assert.strictEqual(messages.at(-1).isError, true);
        assert.strictEqual(sessionSecret.privateKey, '');
        assert.strictEqual(sessionSecret.mnemonic, '');
      } finally {
        App.user = originals.user;
        App.usdtToken = originals.usdtToken;
        App.requestPinVerification = originals.requestPin;
        App.ensurePolGas = originals.ensurePolGas;
        App.updateData = originals.updateData;
        App.showToast = originals.showToast;
        App.sendTransactionInProgress = false;
        document.getElementById('send-confirm-button').disabled = false;
        App.setLoader(false);
        App.closeModals();
        App.selectSendToken('POL');
      }
    });

    await runTest('ACTIVITY', 'Suivi central du signer : pending → confirmé, notification persistante et aucun secret stocké', async () => {
      const hash = `0x${'11'.repeat(32)}`;
      let confirmTransaction;
      const confirmation = new Promise((resolve) => { confirmTransaction = resolve; });
      const originalSigner = App.signer;
      App.signer = {
        async sendTransaction() {
          return { hash, wait: () => confirmation };
        }
      };
      App.installActivityTracking();
      const data = App.usdtToken.interface.encodeFunctionData('transfer', [
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        123450000n
      ]);
      const sent = await App.signer.sendTransaction({ to: App.usdtToken.target, data });
      App.signer = originalSigner;
      assert.strictEqual(sent.hash, hash, 'La réponse du signer original est conservée');
      assert.strictEqual(App.activity.state.transactions[0].status, 'pending');
      assert.strictEqual(App.activity.state.transactions[0].type, 'send');
      assert.strictEqual(App.activity.state.transactions[0].amount, '123.45');
      assert.strictEqual(App.activity.getUnreadCount(), 1);

      const activityKey = App.activity.storageKey();
      const serialized = e2eWin.localStorage.getItem(activityKey);
      assert.ok(serialized.includes(hash), 'Le hash est persisté localement');
      assert.ok(!serialized.includes('privateKey') && !serialized.includes('mnemonic'), 'Aucune clé ou phrase dans le stockage activité');
      assert.strictEqual(App.activity.transactionUrl(hash), `https://polygonscan.com/tx/${hash}`);
      assert.strictEqual(App.activity.transactionUrl('javascript:alert(1)'), null);

      confirmTransaction({ status: 1, blockNumber: 62500001 });
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.strictEqual(App.activity.state.transactions[0].status, 'success');
      assert.strictEqual(App.activity.state.transactions[0].blockNumber, 62500001);
      assert.strictEqual(App.activity.state.transactions[0].contractMessage, 'On-chain response: success (status 1).');
      assert.ok(App.activity.state.notifications[0].message.includes('status 1'), 'La notification reprend la réponse on-chain');
      assert.strictEqual(App.activity.getUnreadCount(), 2, 'La confirmation crée une notification non lue');
      App.openActivity('notifications');
      assert.ok(e2eWin.document.getElementById('modal-activity').classList.contains('active'));
      assert.ok(!e2eWin.document.getElementById('activity-notifications-panel').classList.contains('hidden'));
      App.activity.setTab('history');
      assert.ok(!e2eWin.document.getElementById('activity-history-panel').classList.contains('hidden'));
      assert.ok(e2eWin.document.querySelector('#activity-history-list .activity-item'));
      assert.strictEqual(e2eWin.document.querySelector('#activity-history-list .activity-tx-link'), null, 'Aucun bouton PolygonScan dans les transactions');
      assert.strictEqual(e2eWin.document.querySelector('#activity-history-list a'), null, 'Aucun lien externe dans l’historique');
      assert.ok(!e2eWin.document.getElementById('modal-activity').textContent.includes('PolygonScan'), 'Aucun renvoi PolygonScan visible dans le centre d’activité');
      App.closeModals();
    });

    await runTest('ACTIVITY', 'Décodage des envois, approbations, dépôts, retraits, achats, minage, claims, parrainages et swaps', async () => {
      const destination = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      const cases = [
        [{ to: destination, data: '0x', value: 1000000000000000000n }, 'send', 'Send POL'],
        [{ to: App.usdtToken.target, data: App.usdtToken.interface.encodeFunctionData('transfer', [destination, 1000000n]) }, 'send', 'Send USDT'],
        [{ to: App.ftaToken.target, data: App.ftaToken.interface.encodeFunctionData('approve', [App.core.target, 100000000n]) }, 'approval', 'FTA approval'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('depositUsdt', [1000000n]) }, 'deposit', 'Deposit USDT'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('depositFta', [100000000n]) }, 'deposit', 'Deposit FTA'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('depositPol'), value: 1000000000000000000n }, 'deposit', 'Deposit POL'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('withdrawUsdt', [1000000n]) }, 'withdraw', 'Withdraw USDT'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('withdrawFta', [100000000n]) }, 'withdraw', 'Withdraw FTA'],
        [{ to: App.mine.target, data: App.mine.interface.encodeFunctionData('buyMachine', [0n]) }, 'purchase', 'Machine purchase'],
        [{ to: App.mine.target, data: App.mine.interface.encodeFunctionData('buyBatteryFTA', [1n]) }, 'purchase', 'Battery purchase'],
        [{ to: App.mine.target, data: App.mine.interface.encodeFunctionData('plugInMachine', [0n, 1n]) }, 'mining', 'Machine connection'],
        [{ to: App.mine.target, data: App.mine.interface.encodeFunctionData('claimRewards') }, 'claim', 'Mining reward claim'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('setReferrer', [destination]) }, 'referral', 'Referral recorded'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('swapUForF', [1000000n, 1n, 9999999999n]) }, 'swap', 'Swap USDT → FTA'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('swapFForU', [100000000n, 1n, 9999999999n]) }, 'swap', 'Swap FTA → USDT'],
        [{
          to: App.quickswapRouter.target,
          data: App.quickswapRouter.interface.encodeFunctionData('swapExactETHForTokens', [1n, ['0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'], destination, 9999999999n]),
          value: 1000000000000000000n
        }, 'swap', 'Swap POL → USDT'],
        [{
          to: App.quickswapRouter.target,
          data: App.quickswapRouter.interface.encodeFunctionData('swapExactTokensForETH', [1000000n, 1n, ['0xc2132D05D31c914a87C6611C10748AEb04B58e8F', '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'], destination, 9999999999n])
        }, 'swap', 'Swap USDT → POL']
      ];
      cases.forEach(([request, expectedType, expectedTitle]) => {
        const metadata = App.describeActivityTransaction(request);
        assert.strictEqual(metadata.type, expectedType, expectedTitle);
        assert.strictEqual(metadata.title, expectedTitle);
      });

      const original = { lang: App.currentLang, pendingBalance: App.pendingBalance };
      try {
        App.setLanguage('en');
        const claimRequest = { to: App.mine.target, data: App.mine.interface.encodeFunctionData('claimRewards') };
        App.pendingBalance = 4000;
        const claim = App.describeActivityTransaction(claimRequest);
        assert.strictEqual(claim.title, 'Mining reward claim');
        assert.strictEqual(claim.token, 'FTA');
        assert.strictEqual(claim.amount, '0.00004', '4000 unités brutes à 8 décimales correspondent à 0.00004 FTA');
        App.pendingBalance = 8000;
        assert.strictEqual(claim.amount, '0.00004', 'Le montant enregistré reste figé après l’envoi de la transaction');
        App.pendingBalance = 4;
        assert.strictEqual(App.describeActivityTransaction(claimRequest).amount, '0.00000004');
        App.pendingBalance = 0;
        assert.strictEqual(App.describeActivityTransaction(claimRequest).amount, '', 'Aucun montant de réclamation inventé');
      } finally {
        App.pendingBalance = original.pendingBalance;
        App.setLanguage(original.lang);
      }
    });

    await runTest('ACTIVITY', 'Reprise après redémarrage, succès/échec on-chain et isolation par adresse', async () => {
      const account = `0x${'33'.repeat(20)}`;
      const successHash = `0x${'44'.repeat(32)}`;
      const failedHash = `0x${'55'.repeat(32)}`;
      const center = new e2eWin.FitiaActivityCenter({ explorer: 'https://polygonscan.com' });
      center.setAccount(account);
      const never = () => new Promise(() => {});
      center.track({ hash: successHash, wait: never }, { title: 'Deposit USDT', type: 'deposit', amount: '5', token: 'USDT' });
      center.track({ hash: failedHash, wait: never }, { title: 'Withdraw FTA', type: 'withdraw', amount: '2', token: 'FTA' });

      const restored = new e2eWin.FitiaActivityCenter({ explorer: 'https://polygonscan.com' });
      restored.setAccount(account);
      assert.strictEqual(restored.state.transactions.length, 2, 'Les transactions en attente sont restaurées');
      await restored.refreshPending({
        async getTransactionReceipt(hash) {
          return { status: hash === failedHash ? 0 : 1, blockNumber: 62500002 };
        }
      });
      assert.strictEqual(restored.state.transactions.find((tx) => tx.hash === successHash).status, 'success');
      assert.strictEqual(restored.state.transactions.find((tx) => tx.hash === failedHash).status, 'failed');
      assert.strictEqual(restored.state.transactions.find((tx) => tx.hash === successHash).contractMessage, 'On-chain response: success (status 1).');
      assert.strictEqual(
        restored.state.transactions.find((tx) => tx.hash === failedHash).contractMessage,
        'On-chain response: failure (status 0). Contract reason unavailable in the receipt.',
        'Un reçu sans motif ne fabrique aucune réponse du contrat'
      );
      assert.strictEqual(restored.state.transactions.find((tx) => tx.hash === failedHash).blockNumber, 62500002);
      assert.strictEqual(restored.getUnreadCount(), 4, 'Notifications pending et finales conservées après restauration');

      restored.notify('info', '<img src=x onerror=alert(1)>', 'Notification <b>sûre</b>');
      assert.strictEqual(e2eWin.document.querySelector('#activity-notifications-list img'), null, 'Aucun HTML injecté dans les notifications');
      restored.markAllNotificationsRead();
      assert.strictEqual(restored.getUnreadCount(), 0);
      assert.strictEqual(e2eWin.document.getElementById('activity-unread-badge').classList.contains('hidden'), true);

      restored.setAccount(`0x${'66'.repeat(20)}`);
      assert.strictEqual(restored.state.transactions.length, 0, 'Une autre adresse ne voit pas cet historique');
      assert.strictEqual(e2eWin.document.querySelector('#activity-history-list .activity-explorer-empty'), null, 'L’état vide ne propose aucun lien PolygonScan');
      assert.strictEqual(e2eWin.document.querySelector('#activity-history-list a'), null);
      restored.setAccount(account);
      assert.strictEqual(restored.state.transactions.length, 2, 'L’historique de la première adresse demeure intact');
      App.activity.setAccount(App.user);
    });

    await runTest('ACTIVITY', 'Erreur personnalisée du contrat, transaction remplacée et migration des anciennes entrées', async () => {
      const account = `0x${'77'.repeat(20)}`;
      const revertHash = `0x${'88'.repeat(32)}`;
      const replacedHash = `0x${'99'.repeat(32)}`;
      const center = new e2eWin.FitiaActivityCenter({
        explorer: 'https://polygonscan.com',
        formatError: (error) => error?.revert?.name === 'NoM' ? 'Aucune machine disponible.' : 'Transaction refusée.'
      });
      center.setAccount(account);
      const revertError = {
        code: 'CALL_EXCEPTION',
        revert: { name: 'NoM', args: [] },
        shortMessage: 'execution reverted with custom error "NoM()"',
        message: 'Réponse RPC sensible à ne jamais stocker',
        receipt: { status: 0, blockNumber: 62500003 }
      };
      center.track({ hash: revertHash, wait: async () => { throw revertError; } }, { title: 'Machine connection', type: 'mining' });
      center.track({
        hash: replacedHash,
        wait: async () => { throw { code: 'TRANSACTION_REPLACED', reason: 'cancelled', message: 'Détail RPC sensible' }; }
      }, { title: 'Send POL', type: 'send' });
      await new Promise((resolve) => setTimeout(resolve, 40));

      const reverted = center.state.transactions.find((tx) => tx.hash === revertHash);
      const replaced = center.state.transactions.find((tx) => tx.hash === replacedHash);
      assert.strictEqual(reverted.status, 'failed');
      assert.ok(reverted.contractMessage.includes('failure (status 0)'));
      assert.ok(reverted.contractMessage.includes('Contract: NoM.'), 'Le nom exact du custom error est affiché');
      assert.ok(reverted.contractMessage.includes('Aucune machine disponible.'), 'La traduction existante accompagne la réponse brute');
      assert.ok(replaced.contractMessage.includes('transaction not confirmed'));
      assert.ok(replaced.contractMessage.includes('Transaction replaced or cancelled before confirmation.'));
      assert.ok(!replaced.contractMessage.includes('status 0'), 'Aucun statut de reçu inventé pour une transaction remplacée');
      const serialized = e2eWin.localStorage.getItem(center.storageKey());
      assert.ok(serialized.includes('NoM'));
      assert.ok(!serialized.includes('RPC sensible') && !serialized.includes('Détail RPC'), 'Les détails RPC sensibles ne sont pas persistés');

      center.setTab('history');
      const rendered = e2eWin.document.getElementById('activity-history-list').textContent;
      assert.ok(rendered.includes('Contract: NoM.'));
      assert.ok(rendered.includes('Block #62500003'));
      assert.strictEqual(e2eWin.document.querySelector('#activity-history-list img'), null, 'Les réponses du contrat restent du texte sûr');
      center.track({ hash: revertHash, wait: async () => { throw revertError; } }, { title: 'Machine connection', type: 'mining' });
      assert.strictEqual(
        center.state.transactions.find((tx) => tx.hash === revertHash).contractMessage,
        reverted.contractMessage,
        'Un doublon ne remplace pas une réponse finale par un message en attente'
      );

      const legacy = center.normalizeTransaction({
        hash: `0x${'aa'.repeat(32)}`,
        type: 'withdraw',
        title: 'Ancien retrait',
        status: 'failed',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      assert.ok(legacy.contractMessage.includes('Contract reason unavailable.'));
      assert.ok(!legacy.contractMessage.includes('status 0'), 'Une ancienne entrée sans reçu conserve un message prudent');
      App.activity.setAccount(App.user);
    });

    await runTest('RAM-WIPE', 'Verrouillage du portefeuille : purge complète des clés en RAM + réactivation FLAG_SECURE', async () => {
      App.revealedSecretText = 'sensitive-secret';
      App.lockWallet(true);
      assert.strictEqual(App.signer, null);
      assert.strictEqual(App.user, null);
      assert.strictEqual(App.myReferralCode, '', 'Le code de parrainage en mémoire est purgé au verrouillage');
      assert.strictEqual(e2eWin.document.getElementById('my-ref-id-label').textContent, '—');
      assert.strictEqual(e2eWin.document.getElementById('my-ref-link-label').textContent, '—', 'Le lien de parrainage est purgé au verrouillage');
      assert.strictEqual(App.revealedSecretText, '');
      assert.strictEqual(e2eWin.FitiaNative._state.screenSecure, true, 'FLAG_SECURE réactivé au verrouillage');
    });

    // ─── SUITE 5 : Durcissement du Serveur HTTP ─────────────────────────
    await runTest('HTTP-SERVER', 'En-têtes de sécurité CSP/nosniff actifs & blocage 403 sur /.git, /server.js, /scripts', async () => {
      const rootRes = await httpRequest(8080, 'GET', '/');
      assert.strictEqual(rootRes.statusCode, 200);
      assert.strictEqual(rootRes.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(rootRes.headers['referrer-policy'], 'no-referrer');
      const htmlStr = rootRes.body.toString('utf8');
      assert.ok(htmlStr.includes("object-src 'none'"), 'CSP object-src none présent');
      assert.ok(!htmlStr.includes('unsafe-eval'), 'unsafe-eval supprimé de la CSP');
      assert.ok(!htmlStr.includes('http://*'), 'Trafic HTTP non chiffré banni de la CSP');
      assert.ok(htmlStr.includes('id="projet"'), 'La page publique présente le projet');
      assert.ok(htmlStr.includes('<html lang="en">'), 'La page publique est déclarée en anglais');
      assert.ok(htmlStr.includes('Explore the project'), 'Le contenu de présentation est traduit en anglais');
      assert.ok(htmlStr.includes('Official release available.'), 'La disponibilité du téléchargement est visible en anglais');
      assert.ok(!htmlStr.includes('Update in progress'), 'L’ancien message de maintenance est retiré');
      assert.ok(!htmlStr.includes('Mise à jour en cours'), 'Ancien libellé français de maintenance supprimé');
      assert.strictEqual(htmlStr.split('href="FITIA-PRO-Miner.apk"').length - 1, 2, 'Les deux boutons publics téléchargent directement l’APK');
      assert.ok(!htmlStr.includes('button-disabled'), 'Aucun bouton de téléchargement désactivé');
      assert.ok(!htmlStr.includes('id="auth-screen"'), 'Le wallet n’est plus exposé sur la page publique');

      const apkHead = await httpRequest(8080, 'HEAD', '/FITIA-PRO-Miner.apk');
      assert.strictEqual(apkHead.statusCode, 200);
      assert.strictEqual(apkHead.headers['content-type'], 'application/vnd.android.package-archive');
      assert.strictEqual(Number(apkHead.headers['content-length']), fs.statSync(path.join(ROOT, 'FITIA-PRO-Miner.apk')).size);
      const apkGet = await httpRequest(8080, 'GET', '/FITIA-PRO-Miner.apk');
      assert.strictEqual(apkGet.statusCode, 200);
      assert.ok(apkGet.body.equals(fs.readFileSync(path.join(ROOT, 'FITIA-PRO-Miner.apk'))), 'Le serveur public fournit exactement l’APK signé');
      assert.ok(apkGet.headers['content-disposition'].includes('attachment'));
      const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
      assert.ok(!(vercelConfig.redirects || []).some((rule) => rule.source === '/FITIA-PRO-Miner.apk'), 'Vercel ne redirige plus le téléchargement vers la maintenance');

      for (const forbiddenPath of ['/.git/HEAD', '/server.js', '/scripts/build_apk.py', '/android-src/AndroidManifest.xml', '/android-src/wallet.html', '/contracts/FitiaMiningV3_Mine.sol', '/app.js', '/activity.js', '/wallet.js', '/style.css', '/vendor/ethers.umd.min.js']) {
        const r = await httpRequest(8080, 'GET', forbiddenPath);
        assert.strictEqual(r.statusCode, 403, `Chemin sensible ${forbiddenPath} doit renvoyer 403`);
      }

      const postRes = await httpRequest(8080, 'POST', '/index.html');
      assert.strictEqual(postRes.statusCode, 405);
    });

    // ─── SUITE 6 : Audit Binaire de l'APK Android Compilé ───────────────
    await runTest('APK-BINARY', 'Vérification binaire AndroidManifest, networkSecurityConfig, debuggable=false & Signatures v2+v3', async () => {
      const apkPath = path.join(ROOT, 'FITIA-PRO-Miner.apk');
      assert.ok(fs.existsSync(apkPath), 'FITIA-PRO-Miner.apk existe');
      const stats = fs.statSync(apkPath);
      assert.ok(stats.size > 400 * 1024, 'Taille APK cohérente (> 400 KB)');
      const packagedFiles = execFileSync('python3', ['-c', [
        'import zipfile, sys',
        'print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))'
      ].join(';'), apkPath], { encoding: 'utf8' });
      assert.ok(packagedFiles.includes('assets/www/activity.js'), 'Le module activité est embarqué dans l’APK');
      assert.ok(packagedFiles.includes('assets/www/assistant.js'), 'Le moteur local de l’assistant est embarqué dans l’APK');
      assert.ok(packagedFiles.includes('assets/www/announcements.js'), 'Le module annonces est embarqué dans l’APK');
      assert.ok(packagedFiles.includes('assets/www/promotions.js'), 'Le module décorations est embarqué dans l’APK');
      assert.ok(packagedFiles.includes('assets/www/promotion-effects.js'), 'Les illustrations saisonnières sont embarquées dans l’APK');
      assert.ok(packagedFiles.includes('assets/www/promotion-effects.css'), 'Les animations saisonnières sont embarquées dans l’APK');
      assert.ok(packagedFiles.includes('assets/www/store.js'), 'Le module FITIA STORE est embarqué dans l’APK');
      assert.ok(packagedFiles.includes('assets/www/store-catalog.js'), 'Les validations STORE sont embarquées dans l’APK');
      assert.ok(packagedFiles.includes('assets/www/store-products.json'), 'Le catalogue local de secours est embarqué dans l’APK');
      const packagedCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'store-products.json'), 'utf8'));
      for (const product of packagedCatalog.products.filter((item) => item.image)) {
        assert.ok(packagedFiles.includes(`assets/www/${product.image}`), `La photo produit ${product.image} est embarquée dans l’APK`);
      }
      assert.ok(packagedFiles.includes('assets/www/wallet.html'), 'Le wallet Android reste embarqué localement');
      const packagedWallet = execFileSync('python3', ['-c', [
        'import zipfile, sys',
        'sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("assets/www/wallet.html"))'
      ].join(';'), apkPath]);
      assert.ok(packagedWallet.equals(fs.readFileSync(path.join(ROOT, 'android-src', 'wallet.html'))), 'L’APK embarque exactement le wallet durci audité');
      for (const sourceFile of ['app.js', 'wallet.js', 'store.js']) {
        const packagedSource = execFileSync('python3', ['-c', [
          'import zipfile, sys',
          'sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("assets/www/" + sys.argv[2]))'
        ].join(';'), apkPath, sourceFile]);
        assert.ok(packagedSource.equals(fs.readFileSync(path.join(ROOT, sourceFile))), `L’APK embarque exactement ${sourceFile} audité`);
      }
      for (const fontFile of [
        'inter-latin-400-normal.woff2', 'inter-latin-600-normal.woff2',
        'inter-latin-700-normal.woff2', 'inter-latin-800-normal.woff2',
        'jetbrains-mono-latin-500-normal.woff2', 'jetbrains-mono-latin-700-normal.woff2'
      ]) {
        assert.ok(packagedFiles.includes(`assets/www/assets/fonts/${fontFile}`), `La police locale ${fontFile} est embarquée dans l’APK`);
      }
      assert.ok(packagedFiles.includes('assets/www/assets/fta.png'), 'Le vrai logo FTA est embarqué dans l’APK');
      for (const avatar of ['team-1.svg', 'team-2.svg', 'team-3.svg']) {
        assert.ok(packagedFiles.includes(`assets/www/assets/avatars/${avatar}`), `L’avatar FITIA ${avatar} est embarqué dans l’APK`);
      }
      assert.ok(!packagedFiles.includes('assets/www/assets/fta.svg'), 'L’ancien dessin FTA n’est plus embarqué');
      assert.ok(packagedFiles.includes('res/mipmap-anydpi-v26/fitia_pro_launcher.xml'), 'La nouvelle ressource d’icône FITIA est embarquée');
      assert.ok(packagedFiles.includes('res/mipmap-xxxhdpi-v4/fitia_pro_launcher.png'), 'Le vrai logo de lancement est embarqué');
      assert.ok(!packagedFiles.includes('res/mipmap-anydpi-v26/ic_launcher.xml'), 'L’ancienne ressource d’icône mise en cache est absente');
      assert.ok(!packagedFiles.includes('assets/www/index.html'), 'La vitrine publique n’est pas embarquée dans l’APK');
      const updateManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'update-current.json'), 'utf8'));
      const legacy35Manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'update.json'), 'utf8'));
      const legacy36Manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'update-stable.json'), 'utf8'));
      const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
      const apkSha256 = crypto.createHash('sha256').update(fs.readFileSync(apkPath)).digest('hex');
      assert.strictEqual(updateManifest.enabled, true, 'Le canal de mise à jour dans l’application est actif');
      assert.strictEqual(updateManifest.versionCode, 331);
      assert.strictEqual(updateManifest.versionName, '3.3.25');
      assert.ok(updateManifest.apkUrl.includes('/v3.3.25/'));
      assert.strictEqual(updateManifest.sha256, apkSha256, 'Le manifeste courant épingle le SHA-256 exact de l’APK');
      assert.ok(appSource.includes('main/update-current.json'), 'Le wallet 3.3.25 utilise le nouveau canal de mise à jour');
      assert.ok(!appSource.includes('main/update-stable.json'), 'Le nouveau wallet ne consulte plus le canal 3.3.6');
      assert.strictEqual(legacy35Manifest.versionCode, 311, 'Les versions 3.3.5 ne reçoivent pas un APK au certificat incompatible');
      assert.strictEqual(legacy35Manifest.versionName, '3.3.5');
      assert.strictEqual(legacy35Manifest.sha256, '538996f093ab34dc055dc5876c415381b496b21bf1b3de6bbe84e8cb0d95c209', 'Le manifeste historique 3.3.5 reste inchangé');
      assert.strictEqual(legacy36Manifest.versionCode, 312, 'Les versions 3.3.6 ne reçoivent pas un APK au certificat incompatible');
      assert.strictEqual(legacy36Manifest.versionName, '3.3.6');
      assert.strictEqual(legacy36Manifest.sha256, '0762b701eb24240ff88d63236c341df247ef2aa37d2955a49728ad2260e6d948', 'Le manifeste historique 3.3.6 reste inchangé');

      const aapt2 = '/tmp/android-toolchain/aapt2';
      const java = '/tmp/android-toolchain/jdk/bin/java';
      const apksigner = '/tmp/android-toolchain/apksigner.jar';

      if (fs.existsSync(aapt2) && fs.existsSync(java) && fs.existsSync(apksigner)) {
        const badgingOut = execFileSync(aapt2, ['dump', 'badging', apkPath], { encoding: 'utf8' });
        assert.ok(badgingOut.includes('res/mipmap-anydpi-v26/fitia_pro_launcher.xml'), 'Android présente la nouvelle icône FITIA');
        assert.ok(!badgingOut.includes('res/mipmap-anydpi-v26/ic_launcher.xml'), 'Aucune ancienne icône dans le badging APK');
        const manifestTree = execFileSync(aapt2, ['dump', 'xmltree', apkPath, '--file', 'AndroidManifest.xml'], { encoding: 'utf8' });
        assert.ok(manifestTree.includes('versionCode(0x0101021b)=331'), 'versionCode=331 présent');
        assert.ok(manifestTree.includes('versionName(0x0101021c)="3.3.25"'), 'versionName=3.3.25 présent');
        assert.ok(manifestTree.includes('REQUEST_INSTALL_PACKAGES'), 'Permission Android d’installation des mises à jour présente');
        assert.ok(manifestTree.includes('UpdateProvider'), 'Provider APK interne présent');
        assert.ok(manifestTree.includes('grantUriPermissions'), 'Accès URI limité à l’installateur autorisé');
        assert.ok(/allowBackup\([^)]+\)=false/.test(manifestTree), 'android:allowBackup=false vérifié');
        assert.ok(/debuggable\([^)]+\)=false/.test(manifestTree), 'android:debuggable=false vérifié');
        assert.ok(/usesCleartextTraffic\([^)]+\)=false/.test(manifestTree), 'android:usesCleartextTraffic=false vérifié');
        assert.ok(manifestTree.includes('networkSecurityConfig'), 'networkSecurityConfig référencé');
        assert.ok(manifestTree.includes('fitiapro') && manifestTree.includes('parrainage'), 'Le lien de parrainage Android est présent dans l’APK');
        assert.ok(manifestTree.includes('BROWSABLE'), 'Le lien de parrainage peut être ouvert depuis une application externe');

        const netSecTree = execFileSync(aapt2, ['dump', 'xmltree', apkPath, '--file', 'res/xml/network_security_config.xml'], { encoding: 'utf8' });
        assert.ok(netSecTree.includes('cleartextTrafficPermitted=false'), 'cleartextTrafficPermitted=false vérifié');

        const sigOut = execFileSync(java, ['-jar', apksigner, 'verify', '--verbose', '--print-certs', apkPath], { encoding: 'utf8' });
        assert.ok(sigOut.includes('Verified using v2 scheme (APK Signature Scheme v2): true'));
        assert.ok(sigOut.includes('Verified using v3 scheme (APK Signature Scheme v3): true'));
        const expectedCertificate = fs.readFileSync(path.join(ROOT, 'android-src', 'release-certificate-sha256.txt'), 'utf8').trim().toLowerCase();
        assert.ok(sigOut.toLowerCase().includes(expectedCertificate), 'Le certificat stable épinglé signe bien l’APK');
      }
    });

    dom.window.close();
    e2eEnv.dom.window.close();
  } finally {
    await mockRpc.close();
  }

  console.log('═'.repeat(72));
  console.log(`📊 RÉSULTAT FINAL : ${passed} réussis, ${failed} échoués`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})();
