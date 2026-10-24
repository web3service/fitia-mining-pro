#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  SUITE D'AUDIT SÉCURITÉ & TESTS E2E — FITIA PRO MINER V3.3.1 (STANDALONE)
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
    vibrations: 0
  };

  return {
    _state: state,
    isNativeApk: () => true,
    vibrate: () => { state.vibrations++; },
    setScreenSecure: (enable) => { state.screenSecure = Boolean(enable); },
    copyText: (t) => { state.clipboard = String(t || ''); },
    copySensitiveText: (t, clearDelayMs) => {
      state.clipboard = String(t || '');
      state.lastClearDelayMs = Number(clearDelayMs);
    },
    shareText: () => {},
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

      if (to === '0xc2132d05d31c914a87c6611c10748aeb04b58e8f') {
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
  console.log('\n🛡️  AUDIT DE SÉCURITÉ & TESTS AUTOMATISÉS — FITIA PRO MINER V3.3.1\n' + '═'.repeat(72));

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
    await runTest('XSS/SSRF', 'Échappement XSS strict & blocage SSRF complet (RFC1918, IPv6, Metadata, HTTP)', async () => {
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
        'https://[::1]:8545',
        'https://[fe80::1]:8545',
        'https://[fd00::1]:8545',
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

      App.startCreateWallet();
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
      assert.ok(e2eWin.document.getElementById('modal-security').classList.contains('active'), 'Le bouton ouvre les réglages et la sécurité');
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

    await runTest('POLYGON-GAS', 'Plancher EIP-1559 Polygon >= 30 Gwei imposé automatiquement par PolygonRpcManager', async () => {
      const fees = await e2eWin.FitiaSecurity.Rpc.getOptimalFeeData(App.provider);
      const min30Gwei = ethersLib.parseUnits('30', 'gwei');
      assert.ok(BigInt(fees.maxPriorityFeePerGas) >= min30Gwei, 'maxPriorityFeePerGas >= 30 Gwei requis sur Polygon');
      assert.ok(BigInt(fees.maxFeePerGas) > BigInt(fees.maxPriorityFeePerGas));
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
      assert.strictEqual(App.activity.getUnreadCount(), 2, 'La confirmation crée une notification non lue');
      App.openActivity('notifications');
      assert.ok(e2eWin.document.getElementById('modal-activity').classList.contains('active'));
      assert.ok(!e2eWin.document.getElementById('activity-notifications-panel').classList.contains('hidden'));
      App.activity.setTab('history');
      assert.ok(!e2eWin.document.getElementById('activity-history-panel').classList.contains('hidden'));
      assert.ok(e2eWin.document.querySelector('#activity-history-list .activity-item'));
      App.closeModals();
    });

    await runTest('ACTIVITY', 'Décodage des envois, approbations, dépôts, retraits, achats, minage, claims, parrainages et swaps', async () => {
      const destination = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      const cases = [
        [{ to: destination, data: '0x', value: 1000000000000000000n }, 'send', 'Envoi de POL'],
        [{ to: App.usdtToken.target, data: App.usdtToken.interface.encodeFunctionData('transfer', [destination, 1000000n]) }, 'send', 'Envoi de USDT'],
        [{ to: App.ftaToken.target, data: App.ftaToken.interface.encodeFunctionData('approve', [App.core.target, 100000000n]) }, 'approval', 'Autorisation FTA'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('depositUsdt', [1000000n]) }, 'deposit', 'Dépôt USDT'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('depositFta', [100000000n]) }, 'deposit', 'Dépôt FTA'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('depositPol'), value: 1000000000000000000n }, 'deposit', 'Dépôt POL'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('withdrawUsdt', [1000000n]) }, 'withdraw', 'Retrait USDT'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('withdrawFta', [100000000n]) }, 'withdraw', 'Retrait FTA'],
        [{ to: App.mine.target, data: App.mine.interface.encodeFunctionData('buyMachine', [0n]) }, 'purchase', 'Achat de machine'],
        [{ to: App.mine.target, data: App.mine.interface.encodeFunctionData('buyBatteryFTA', [1n]) }, 'purchase', 'Achat de batterie'],
        [{ to: App.mine.target, data: App.mine.interface.encodeFunctionData('plugInMachine', [0n, 1n]) }, 'mining', 'Connexion de machine'],
        [{ to: App.mine.target, data: App.mine.interface.encodeFunctionData('claimRewards') }, 'claim', 'Réclamation des récompenses'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('setReferrer', [destination]) }, 'referral', 'Parrainage enregistré'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('swapUForF', [1000000n, 1n, 9999999999n]) }, 'swap', 'Swap USDT → FTA'],
        [{ to: App.core.target, data: App.core.interface.encodeFunctionData('swapFForU', [100000000n, 1n, 9999999999n]) }, 'swap', 'Swap FTA → USDT']
      ];
      cases.forEach(([request, expectedType, expectedTitle]) => {
        const metadata = App.describeActivityTransaction(request);
        assert.strictEqual(metadata.type, expectedType, expectedTitle);
        assert.strictEqual(metadata.title, expectedTitle);
      });
    });

    await runTest('ACTIVITY', 'Reprise après redémarrage, succès/échec on-chain et isolation par adresse', async () => {
      const account = `0x${'33'.repeat(20)}`;
      const successHash = `0x${'44'.repeat(32)}`;
      const failedHash = `0x${'55'.repeat(32)}`;
      const center = new e2eWin.FitiaActivityCenter({ explorer: 'https://polygonscan.com' });
      center.setAccount(account);
      const never = () => new Promise(() => {});
      center.track({ hash: successHash, wait: never }, { title: 'Dépôt USDT', type: 'deposit', amount: '5', token: 'USDT' });
      center.track({ hash: failedHash, wait: never }, { title: 'Retrait FTA', type: 'withdraw', amount: '2', token: 'FTA' });

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
      assert.strictEqual(restored.getUnreadCount(), 4, 'Notifications pending et finales conservées après restauration');

      restored.notify('info', '<img src=x onerror=alert(1)>', 'Notification <b>sûre</b>');
      assert.strictEqual(e2eWin.document.querySelector('#activity-notifications-list img'), null, 'Aucun HTML injecté dans les notifications');
      restored.markAllNotificationsRead();
      assert.strictEqual(restored.getUnreadCount(), 0);
      assert.strictEqual(e2eWin.document.getElementById('activity-unread-badge').classList.contains('hidden'), true);

      restored.setAccount(`0x${'66'.repeat(20)}`);
      assert.strictEqual(restored.state.transactions.length, 0, 'Une autre adresse ne voit pas cet historique');
      restored.setAccount(account);
      assert.strictEqual(restored.state.transactions.length, 2, 'L’historique de la première adresse demeure intact');
      App.activity.setAccount(App.user);
    });

    await runTest('RAM-WIPE', 'Verrouillage du portefeuille : purge complète des clés en RAM + réactivation FLAG_SECURE', async () => {
      App.revealedSecretText = 'sensitive-secret';
      App.lockWallet(true);
      assert.strictEqual(App.signer, null);
      assert.strictEqual(App.user, null);
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
      assert.ok(htmlStr.includes('Update in progress'), 'Le mode maintenance est visible en anglais sur la vitrine');
      assert.ok(!htmlStr.includes('Mise à jour en cours'), 'Ancien libellé français de maintenance supprimé');
      assert.ok(!htmlStr.includes('href="FITIA-PRO-Miner.apk"'), 'Aucun lien APK actif pendant la maintenance');
      assert.ok(!htmlStr.includes('id="auth-screen"'), 'Le wallet n’est plus exposé sur la page publique');

      const apkHead = await httpRequest(8080, 'HEAD', '/FITIA-PRO-Miner.apk');
      assert.strictEqual(apkHead.statusCode, 503);
      assert.strictEqual(apkHead.headers['retry-after'], '3600');
      const apkGet = await httpRequest(8080, 'GET', '/FITIA-PRO-Miner.apk');
      assert.strictEqual(apkGet.statusCode, 503);
      assert.ok(apkGet.body.toString('utf8').includes('temporairement indisponible'));

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
      assert.ok(packagedFiles.includes('assets/www/wallet.html'), 'Le wallet Android reste embarqué localement');
      assert.ok(!packagedFiles.includes('assets/www/index.html'), 'La vitrine publique n’est pas embarquée dans l’APK');

      const aapt2 = '/tmp/android-toolchain/aapt2';
      const java = '/tmp/android-toolchain/jdk/bin/java';
      const apksigner = '/tmp/android-toolchain/apksigner.jar';

      if (fs.existsSync(aapt2) && fs.existsSync(java) && fs.existsSync(apksigner)) {
        const manifestTree = execFileSync(aapt2, ['dump', 'xmltree', apkPath, '--file', 'AndroidManifest.xml'], { encoding: 'utf8' });
        assert.ok(manifestTree.includes('versionCode(0x0101021b)=307'), 'versionCode=307 présent');
        assert.ok(manifestTree.includes('versionName(0x0101021c)="3.3.1"'), 'versionName=3.3.1 présent');
        assert.ok(/allowBackup\([^)]+\)=false/.test(manifestTree), 'android:allowBackup=false vérifié');
        assert.ok(/debuggable\([^)]+\)=false/.test(manifestTree), 'android:debuggable=false vérifié');
        assert.ok(/usesCleartextTraffic\([^)]+\)=false/.test(manifestTree), 'android:usesCleartextTraffic=false vérifié');
        assert.ok(manifestTree.includes('networkSecurityConfig'), 'networkSecurityConfig référencé');

        const netSecTree = execFileSync(aapt2, ['dump', 'xmltree', apkPath, '--file', 'res/xml/network_security_config.xml'], { encoding: 'utf8' });
        assert.ok(netSecTree.includes('cleartextTrafficPermitted=false'), 'cleartextTrafficPermitted=false vérifié');

        const sigOut = execFileSync(java, ['-jar', apksigner, 'verify', '--verbose', apkPath], { encoding: 'utf8' });
        assert.ok(sigOut.includes('Verified using v2 scheme (APK Signature Scheme v2): true'));
        assert.ok(sigOut.includes('Verified using v3 scheme (APK Signature Scheme v3): true'));
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
