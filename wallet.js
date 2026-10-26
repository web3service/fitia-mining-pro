// ═══════════════════════════════════════════════════════════════════
//  FITIA PRO — Portefeuille Autonome Haute Sécurité (Non-Custodial)
//  • Couche 1 : WebCrypto AES-256-GCM + PBKDF2-SHA256 (310 000 itérations)
//  • Couche 2 : Clé WebCrypto non-exportable (extractable: false, IndexedDB)
//  • Couche 3 : Scellement matériel AndroidKeyStore TEE (APK Android)
//  • Anti-Brute-Force persistant (localStorage + IndexedDB + SharedPreferences)
//  • Anti-Tapjacking, FLAG_SECURE dynamique & Auto-effacement presse-papiers
// ═══════════════════════════════════════════════════════════════════

(function (global) {
  'use strict';

  const VAULT_STORAGE_KEY = 'fitia_secure_vault_v2';
  const LEGACY_VAULT_KEY = 'fitia_secure_vault_v1';
  const PIN_STATE_KEY = 'fitia_pin_guard_v2';
  const BIO_META_KEY = 'fitia_bio_enabled_v2';
  const SETTINGS_KEY = 'fitia_wallet_settings_v1';
  const DEVICE_KEY_ID = 'fitia_non_extractable_wrap_key_v1';
  const IDB_NAME = 'FitiaSecureVaultDB';
  const IDB_VERSION = 1;
  const PBKDF2_ITERATIONS = 310000; // Standard OWASP renforcé
  const POLYGON_CHAIN_ID = 137;
  const MIN_PRIORITY_FEE_GWEI = 30n * (10n ** 9n);
  const MIN_MAX_FEE_GWEI = 65n * (10n ** 9n);

  const WEAK_PINS = new Set([
    '000000', '111111', '222222', '333333', '444444',
    '555555', '666666', '777777', '888888', '999999',
    '012345', '123456', '234567', '345678', '456789',
    '543210', '654321', '765432', '876543', '987654',
    '112233', '121212', '101010', '123123', '000001',
    '258025', '085208', '147258', '159753', '147852',
    '696969', '112211', '123321', '654456'
  ]);

  const DEFAULT_POLYGON_RPCS = [
    { name: 'PublicNode Polygon', url: 'https://polygon-bor-rpc.publicnode.com' },
    { name: 'dRPC Polygon', url: 'https://polygon.drpc.org' },
    { name: '1RPC Polygon', url: 'https://1rpc.io/matic' },
    { name: 'Polygon Official', url: 'https://polygon-rpc.com' }
  ];

  let webClipTimer = null;

  // ─── Utilitaires binaires / Base64 / Échappement HTML ────────────
  function bytesToB64(bytes) {
    let binary = '';
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
    return btoa(binary);
  }

  function b64ToBytes(b64) {
    const binary = atob(b64);
    const u8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
    return u8;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Pont Natif Android APK + Navigateur Sécurisé ────────────────
  const NativeHelper = {
    isNativeApk() {
      try {
        return !!(global.FitiaNative && typeof global.FitiaNative.isNativeApk === 'function' && global.FitiaNative.isNativeApk());
      } catch (_) {
        return false;
      }
    },

    getAppVersionCode() {
      try {
        if (global.FitiaNative && typeof global.FitiaNative.getAppVersionCode === 'function') {
          return Number(global.FitiaNative.getAppVersionCode()) || 0;
        }
      } catch (_) {}
      return 0;
    },

    getAppVersionName() {
      try {
        if (global.FitiaNative && typeof global.FitiaNative.getAppVersionName === 'function') {
          return String(global.FitiaNative.getAppVersionName() || '');
        }
      } catch (_) {}
      return '';
    },

    consumeReferralDeepLink() {
      try {
        if (global.FitiaNative && typeof global.FitiaNative.consumeReferralDeepLink === 'function') {
          return String(global.FitiaNative.consumeReferralDeepLink() || '');
        }
      } catch (_) {}
      return '';
    },

    downloadAndInstallUpdate(url, expectedSha256) {
      try {
        if (global.FitiaNative && typeof global.FitiaNative.downloadAndInstallUpdate === 'function') {
          return !!global.FitiaNative.downloadAndInstallUpdate(String(url || ''), String(expectedSha256 || ''));
        }
      } catch (_) {}
      return false;
    },

    setScreenSecure(secure) {
      try {
        if (global.FitiaNative && typeof global.FitiaNative.setScreenSecure === 'function') {
          global.FitiaNative.setScreenSecure(!!secure);
        }
      } catch (_) {}
    },

    hardwareSeal(str) {
      try {
        if (global.FitiaNative && typeof global.FitiaNative.sealVault === 'function') {
          const out = global.FitiaNative.sealVault(String(str));
          if (out) return out;
        }
      } catch (_) {}
      return String(str);
    },

    hardwareUnseal(str) {
      if (!str) return str;
      try {
        if (String(str).startsWith('AKS1:') && global.FitiaNative && typeof global.FitiaNative.unsealVault === 'function') {
          const out = global.FitiaNative.unsealVault(String(str));
          return out || null;
        }
      } catch (_) {
        return null;
      }
      return String(str);
    },

    vibrate(ms = 18) {
      try {
        if (global.FitiaNative && typeof global.FitiaNative.vibrate === 'function') {
          global.FitiaNative.vibrate(ms);
          return;
        }
        if (navigator.vibrate) navigator.vibrate(ms);
      } catch (_) {}
    },

    async copyText(text, autoClearMs = 0) {
      if (!text) return false;
      const value = String(text);

      try {
        if (global.FitiaNative && typeof global.FitiaNative.copySensitiveText === 'function') {
          global.FitiaNative.copySensitiveText(value, autoClearMs > 0 ? autoClearMs : 0);
          this.vibrate(20);
          return true;
        }
        if (global.FitiaNative && typeof global.FitiaNative.copyText === 'function') {
          global.FitiaNative.copyText(value);
          this.vibrate(20);
          return true;
        }
      } catch (_) {}

      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(value);
          copied = true;
        }
      } catch (_) {}

      if (!copied) {
        try {
          const ta = document.createElement('textarea');
          ta.value = value;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          copied = document.execCommand('copy');
          document.body.removeChild(ta);
        } catch (_) {}
      }

      if (copied) {
        this.vibrate(20);
        if (webClipTimer) {
          clearTimeout(webClipTimer);
          webClipTimer = null;
        }
        if (autoClearMs > 0 && navigator.clipboard && navigator.clipboard.writeText) {
          webClipTimer = setTimeout(async () => {
            try { await navigator.clipboard.writeText(''); } catch (_) {}
          }, autoClearMs);
        }
      }
      return copied;
    },

    async copySensitive(text) {
      // Efface automatiquement les secrets (12 mots / clé privée) du presse-papiers après 45 secondes
      return this.copyText(text, 45000);
    },

    async shareText(title, text) {
      try {
        if (global.FitiaNative && typeof global.FitiaNative.shareText === 'function') {
          global.FitiaNative.shareText(String(title || 'FITIA PRO'), String(text || ''));
          return true;
        }
        if (navigator.share) {
          await navigator.share({ title: title || 'FITIA PRO', text: String(text || '') });
          return true;
        }
      } catch (_) {}
      return this.copyText(text, 0);
    }
  };

  // ─── Stockage redondant IndexedDB (supporte objets & CryptoKey non-exportables) ───
  const VaultIDB = {
    _open() {
      return new Promise((resolve, reject) => {
        if (!global.indexedDB) return reject(new Error('IndexedDB indisponible'));
        const req = global.indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('kv')) {
            db.createObjectStore('kv');
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async get(key) {
      try {
        const db = await this._open();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction('kv', 'readonly');
          const req = tx.objectStore('kv').get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => reject(req.error);
        });
      } catch (_) {
        return null;
      }
    },

    async set(key, value) {
      try {
        const db = await this._open();
        await new Promise((resolve, reject) => {
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
        return true;
      } catch (_) {
        return false;
      }
    },

    async remove(key) {
      try {
        const db = await this._open();
        await new Promise((resolve, reject) => {
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').delete(key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
      } catch (_) {}
    }
  };

  // ─── Clé d'appareil non-exportable (WebCrypto extractable: false) ─
  async function getOrCreateDeviceWrapKey() {
    if (!global.indexedDB) return null;
    try {
      let key = await VaultIDB.get(DEVICE_KEY_ID);
      if (key && key.type === 'secret') return key;
      key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // NON-EXPORTABLE : même du code JS ne peut pas lire les octets bruts de la clé !
        ['encrypt', 'decrypt']
      );
      const saved = await VaultIDB.set(DEVICE_KEY_ID, key);
      return saved ? key : null;
    } catch (_) {
      return null;
    }
  }

  async function deriveAesKeyFromPin(pin, saltBytes, iterations = PBKDF2_ITERATIONS) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(`FITIA_PRO_V3_VAULT::${pin}`),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // ─── Coffre-Fort Sécurisé (FitiaVault) ───────────────────────────
  const FitiaVault = {
    cachedPinGuard: null,

    async init() {
      // Synchronise l'état anti-brute-force depuis tous les stockages
      await this._syncPinGuardFromStores();

      let raw = localStorage.getItem(VAULT_STORAGE_KEY) || localStorage.getItem(LEGACY_VAULT_KEY);
      if (!raw) {
        const fromIdb = (await VaultIDB.get(VAULT_STORAGE_KEY)) || (await VaultIDB.get(LEGACY_VAULT_KEY));
        if (fromIdb) {
          raw = typeof fromIdb === 'string' ? fromIdb : JSON.stringify(fromIdb);
          try { localStorage.setItem(VAULT_STORAGE_KEY, raw); } catch (_) {}
        }
      } else {
        await VaultIDB.set(VAULT_STORAGE_KEY, raw);
      }
      return this.getMetadata();
    },

    isWeakPin(pin) {
      const s = String(pin || '');
      if (!/^\d{6}$/.test(s)) return true;
      if (WEAK_PINS.has(s)) return true;
      // Bloque les motifs répétitifs évidents (ABABAB ou ABCABC)
      if (/^(\d\d)\1\1$/.test(s) || /^(\d\d\d)\1$/.test(s)) return true;
      return false;
    },

    _readRawEnvelope() {
      const raw = localStorage.getItem(VAULT_STORAGE_KEY) || localStorage.getItem(LEGACY_VAULT_KEY);
      if (!raw) return null;
      const unsealed = NativeHelper.hardwareUnseal(raw);
      if (!unsealed) return null;
      return JSON.parse(unsealed);
    },

    getMetadata() {
      try {
        const parsed = this._readRawEnvelope();
        if (!parsed || !parsed.ct || !parsed.salt || !parsed.iv || !parsed.address) {
          return { exists: false, address: null, hasMnemonic: false, createdAt: null, biometricEnabled: false };
        }
        const bioEnabled = localStorage.getItem(BIO_META_KEY) === '1';
        return {
          exists: true,
          address: parsed.address,
          hasMnemonic: !!parsed.hasMnemonic,
          createdAt: parsed.createdAt || null,
          biometricEnabled: bioEnabled
        };
      } catch (_) {
        return { exists: false, address: null, hasMnemonic: false, createdAt: null, biometricEnabled: false };
      }
    },

    getSettings() {
      const defaults = {
        autoLockMinutes: 5,
        requirePinOnSend: true,
        customRpcUrl: '',
        preferredRpcUrl: DEFAULT_POLYGON_RPCS[0].url
      };
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return defaults;
        return { ...defaults, ...JSON.parse(raw) };
      } catch (_) {
        return defaults;
      }
    },

    saveSettings(patch) {
      const next = { ...this.getSettings(), ...patch };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    },

    generateNewWallet() {
      const w = ethers.Wallet.createRandom();
      return {
        address: w.address,
        privateKey: w.privateKey,
        mnemonic: w.mnemonic ? w.mnemonic.phrase : null
      };
    },

    parseMnemonic(phraseInput) {
      const clean = String(phraseInput || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      const words = clean.split(' ').filter(Boolean);
      if (![12, 15, 18, 21, 24].includes(words.length)) {
        throw new Error('INVALID_SEED_LENGTH');
      }
      if (!ethers.Mnemonic.isValidMnemonic(clean)) {
        throw new Error('INVALID_SEED_CHECKSUM');
      }
      const w = ethers.Wallet.fromPhrase(clean);
      return {
        address: w.address,
        privateKey: w.privateKey,
        mnemonic: clean
      };
    },

    parsePrivateKey(pkInput) {
      let clean = String(pkInput || '').trim();
      if (/^[0-9a-fA-F]{64}$/.test(clean)) {
        clean = '0x' + clean;
      }
      if (!/^0x[0-9a-fA-F]{64}$/.test(clean)) {
        throw new Error('INVALID_PRIVATE_KEY');
      }
      const w = new ethers.Wallet(clean);
      return {
        address: w.address,
        privateKey: w.privateKey,
        mnemonic: null
      };
    },

    // ─── Protection Anti-Brute-Force multi-persistance ─────────────
    async _syncPinGuardFromStores() {
      const candidates = [{ fails: 0, lockUntil: 0 }];
      try {
        const ls = localStorage.getItem(PIN_STATE_KEY);
        if (ls) candidates.push(JSON.parse(ls));
      } catch (_) {}
      try {
        const idb = await VaultIDB.get(PIN_STATE_KEY);
        if (idb) candidates.push(typeof idb === 'string' ? JSON.parse(idb) : idb);
      } catch (_) {}
      try {
        if (global.FitiaNative && typeof global.FitiaNative.getPinGuardState === 'function') {
          const nat = global.FitiaNative.getPinGuardState();
          if (nat) candidates.push(JSON.parse(nat));
        }
      } catch (_) {}

      const merged = candidates.reduce((acc, c) => ({
        fails: Math.max(acc.fails, Number(c?.fails || 0)),
        lockUntil: Math.max(acc.lockUntil, Number(c?.lockUntil || 0))
      }), { fails: 0, lockUntil: 0 });

      this.cachedPinGuard = merged;
      return merged;
    },

    _getPinGuard() {
      if (this.cachedPinGuard) return this.cachedPinGuard;
      try {
        const raw = localStorage.getItem(PIN_STATE_KEY);
        if (raw) {
          this.cachedPinGuard = JSON.parse(raw);
          return this.cachedPinGuard;
        }
      } catch (_) {}
      return { fails: 0, lockUntil: 0 };
    },

    async _savePinGuard(state) {
      this.cachedPinGuard = state;
      const json = JSON.stringify(state);
      try { localStorage.setItem(PIN_STATE_KEY, json); } catch (_) {}
      await VaultIDB.set(PIN_STATE_KEY, json);
      try {
        if (global.FitiaNative && typeof global.FitiaNative.setPinGuardState === 'function') {
          global.FitiaNative.setPinGuardState(json);
        }
      } catch (_) {}
    },

    getLockoutRemainingSec() {
      const g = this._getPinGuard();
      if (!g.lockUntil) return 0;
      const rem = Math.ceil((g.lockUntil - Date.now()) / 1000);
      return rem > 0 ? rem : 0;
    },

    async _recordPinFailure() {
      await this._syncPinGuardFromStores();
      const g = this._getPinGuard();
      const fails = (g.fails || 0) + 1;
      let lockUntil = 0;
      if (fails >= 10) {
        lockUntil = Date.now() + 300 * 1000;
      } else if (fails >= 7) {
        lockUntil = Date.now() + 120 * 1000;
      } else if (fails >= 5) {
        lockUntil = Date.now() + 30 * 1000;
      }
      await this._savePinGuard({ fails, lockUntil });
      return {
        fails,
        attemptsLeft: Math.max(0, 5 - fails),
        remainingSec: lockUntil ? Math.ceil((lockUntil - Date.now()) / 1000) : 0
      };
    },

    async _resetPinFailures() {
      this.cachedPinGuard = { fails: 0, lockUntil: 0 };
      try { localStorage.removeItem(PIN_STATE_KEY); } catch (_) {}
      await VaultIDB.remove(PIN_STATE_KEY);
      try {
        if (global.FitiaNative && typeof global.FitiaNative.setPinGuardState === 'function') {
          global.FitiaNative.setPinGuardState('');
        }
      } catch (_) {}
    },

    // ─── Sauvegarde Chiffrée Multi-Couches ─────────────────────────
    async saveVault(secretData, pin, allowWeakPin = false) {
      const pinStr = String(pin || '');
      if (!/^\d{6}$/.test(pinStr)) {
        throw new Error('INVALID_PIN_FORMAT');
      }
      if (!allowWeakPin && this.isWeakPin(pinStr)) {
        const err = new Error('WEAK_PIN');
        err.code = 'WEAK_PIN';
        throw err;
      }
      if (!secretData || !secretData.privateKey || !secretData.address) {
        throw new Error('INVALID_WALLET_DATA');
      }

      // Couche 1 : Chiffrement AES-256-GCM dérivé du PIN via PBKDF2-SHA256 (310k itérations)
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const pinKey = await deriveAesKeyFromPin(pinStr, salt, PBKDF2_ITERATIONS);

      const createdAt = secretData.createdAt || Date.now();
      const cleartextObj = {
        v: 2,
        address: secretData.address,
        privateKey: secretData.privateKey,
        mnemonic: secretData.mnemonic || null,
        createdAt
      };

      const encoded = new TextEncoder().encode(JSON.stringify(cleartextObj));
      let innerCtBytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, pinKey, encoded));

      // Couche 2 : Sur-chiffrement par clé d'appareil WebCrypto non-exportable (IndexedDB)
      let devWrapped = false;
      let devIvB64 = null;
      const devKey = await getOrCreateDeviceWrapKey();
      if (devKey) {
        const devIv = crypto.getRandomValues(new Uint8Array(12));
        innerCtBytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: devIv }, devKey, innerCtBytes));
        devWrapped = true;
        devIvB64 = bytesToB64(devIv);
      }

      const envelope = {
        v: 2,
        address: secretData.address,
        hasMnemonic: !!secretData.mnemonic,
        createdAt,
        kdf: 'PBKDF2-SHA256',
        iterations: PBKDF2_ITERATIONS,
        devWrapped,
        devIv: devIvB64,
        salt: bytesToB64(salt),
        iv: bytesToB64(iv),
        ct: bytesToB64(innerCtBytes)
      };

      // Couche 3 : Scellement matériel AndroidKeyStore TEE (sur APK Android)
      const sealedPayload = NativeHelper.hardwareSeal(JSON.stringify(envelope));
      localStorage.setItem(VAULT_STORAGE_KEY, sealedPayload);
      localStorage.removeItem(LEGACY_VAULT_KEY);
      await VaultIDB.set(VAULT_STORAGE_KEY, sealedPayload);
      await VaultIDB.remove(LEGACY_VAULT_KEY);
      await this._resetPinFailures();
      return envelope;
    },

    // ─── Déverrouillage Sécurisé par PIN ───────────────────────────
    async unlockWithPin(pin) {
      await this._syncPinGuardFromStores();
      const remSec = this.getLockoutRemainingSec();
      if (remSec > 0) {
        const err = new Error('LOCKED_OUT');
        err.code = 'LOCKED_OUT';
        err.remainingSec = remSec;
        throw err;
      }

      let raw = localStorage.getItem(VAULT_STORAGE_KEY) || localStorage.getItem(LEGACY_VAULT_KEY);
      if (!raw) {
        const fromIdb = (await VaultIDB.get(VAULT_STORAGE_KEY)) || (await VaultIDB.get(LEGACY_VAULT_KEY));
        if (fromIdb) {
          raw = typeof fromIdb === 'string' ? fromIdb : JSON.stringify(fromIdb);
          localStorage.setItem(VAULT_STORAGE_KEY, raw);
        }
      }
      if (!raw) {
        const err = new Error('NO_VAULT');
        err.code = 'NO_VAULT';
        throw err;
      }

      const unsealed = NativeHelper.hardwareUnseal(raw);
      if (!unsealed) {
        const err = new Error('CORRUPT_VAULT');
        err.code = 'CORRUPT_VAULT';
        throw err;
      }

      const envelope = JSON.parse(unsealed);
      try {
        let ctBytes = b64ToBytes(envelope.ct);

        // Déchiffrement Couche 2 (clé d'appareil non-exportable)
        if (envelope.devWrapped && envelope.devIv) {
          const devKey = await getOrCreateDeviceWrapKey();
          if (!devKey) throw new Error('MISSING_DEVICE_KEY');
          const unwrappedBuf = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: b64ToBytes(envelope.devIv) },
            devKey,
            ctBytes
          );
          ctBytes = new Uint8Array(unwrappedBuf);
        }

        // Déchiffrement Couche 1 (PBKDF2-SHA256 + PIN)
        const salt = b64ToBytes(envelope.salt);
        const iv = b64ToBytes(envelope.iv);
        const pinKey = await deriveAesKeyFromPin(String(pin), salt, envelope.iterations || PBKDF2_ITERATIONS);
        const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, pinKey, ctBytes);
        const decoded = JSON.parse(new TextDecoder().decode(plainBuf));
        await this._resetPinFailures();
        return decoded;
      } catch (_) {
        const info = await this._recordPinFailure();
        const err = new Error(info.remainingSec > 0 ? 'LOCKED_OUT' : 'WRONG_PIN');
        err.code = info.remainingSec > 0 ? 'LOCKED_OUT' : 'WRONG_PIN';
        err.attemptsLeft = info.attemptsLeft;
        err.remainingSec = info.remainingSec;
        throw err;
      }
    },

    async changePin(oldPin, newPin) {
      const decrypted = await this.unlockWithPin(oldPin);
      await this.saveVault(decrypted, newPin);
      return true;
    },

    // ─── Biométrie (Clé CryptoKey non-exportable + WebAuthn OS) ────
    async isBiometricSupported() {
      try {
        if (!global.PublicKeyCredential || !navigator.credentials) return false;
        if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch (_) {
        return false;
      }
    },

    async enableBiometric(pin) {
      const supported = await this.isBiometricSupported();
      if (!supported) throw new Error('BIOMETRIC_UNSUPPORTED');

      const secret = await this.unlockWithPin(pin);
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));

      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'FITIA PRO Wallet' },
          user: {
            id: userId,
            name: secret.address.slice(0, 10),
            displayName: `FITIA Wallet (${secret.address.slice(0, 6)}...${secret.address.slice(-4)})`
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'discouraged'
          },
          timeout: 60000
        }
      });

      if (!cred || !cred.rawId) throw new Error('BIOMETRIC_CANCELLED');

      // Clé biométrique non-exportable (extractable: false) stockée dans IndexedDB
      const nonExtractableBioKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(JSON.stringify(secret));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, nonExtractableBioKey, encoded);

      const sealedCt = NativeHelper.hardwareSeal(bytesToB64(new Uint8Array(ct)));

      await VaultIDB.set('fitia_bio_crypto_key_v2', nonExtractableBioKey);
      await VaultIDB.set('fitia_bio_record_v2', {
        credId: bytesToB64(new Uint8Array(cred.rawId)),
        iv: bytesToB64(iv),
        ct: sealedCt,
        address: secret.address
      });
      localStorage.setItem(BIO_META_KEY, '1');
      return true;
    },

    async disableBiometric() {
      await VaultIDB.remove('fitia_bio_crypto_key_v2');
      await VaultIDB.remove('fitia_bio_record_v2');
      localStorage.removeItem(BIO_META_KEY);
    },

    async unlockWithBiometric() {
      const bioRecord = await VaultIDB.get('fitia_bio_record_v2');
      const bioKey = await VaultIDB.get('fitia_bio_crypto_key_v2');
      if (!bioRecord || !bioRecord.credId || !bioKey) throw new Error('NO_BIOMETRIC');

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            type: 'public-key',
            id: b64ToBytes(bioRecord.credId)
          }],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (!assertion || !assertion.response || !assertion.response.signature) {
        throw new Error('BIOMETRIC_FAILED');
      }

      const unsealedB64 = NativeHelper.hardwareUnseal(bioRecord.ct);
      if (!unsealedB64) throw new Error('BIOMETRIC_UNSEAL_FAILED');

      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBytes(bioRecord.iv) },
        bioKey,
        b64ToBytes(unsealedB64)
      );
      await this._resetPinFailures();
      return JSON.parse(new TextDecoder().decode(plainBuf));
    },

    async deleteVault() {
      localStorage.removeItem(VAULT_STORAGE_KEY);
      localStorage.removeItem(LEGACY_VAULT_KEY);
      localStorage.removeItem(BIO_META_KEY);
      await VaultIDB.remove(VAULT_STORAGE_KEY);
      await VaultIDB.remove(LEGACY_VAULT_KEY);
      await VaultIDB.remove(DEVICE_KEY_ID);
      await this.disableBiometric();
      await this._resetPinFailures();
    }
  };

  // ─── Signer Polygon Intelligent (EIP-1559 sécurisé) ──────────────
  class PolygonSmartWallet extends ethers.Wallet {
    connect(provider) {
      return new PolygonSmartWallet(this.signingKey, provider);
    }

    async sendTransaction(tx) {
      const txCopy = { ...tx };
      if (this.provider && txCopy.maxPriorityFeePerGas == null && txCopy.gasPrice == null) {
        const fees = await PolygonRpcManager.getOptimalFeeData(this.provider);
        txCopy.maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
        txCopy.maxFeePerGas = fees.maxFeePerGas;
      }
      return super.sendTransaction(txCopy);
    }
  }

  // ─── Gestionnaire Multi-RPC Polygon Sécurisé (HTTPS strict) ──────
  const PolygonRpcManager = {
    currentRpcUrl: DEFAULT_POLYGON_RPCS[0].url,
    provider: null,

    validateRpcUrl(urlInput) {
      try {
        const parsed = new URL(String(urlInput || '').trim());
        if (parsed.protocol !== 'https:') return null;
        if (parsed.username || parsed.password) return null;
        const h = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
        // Bloque les adresses locales/privées IPv4 & IPv6 (protection anti-SSRF complète)
        if (
          h === 'localhost' ||
          h === '::1' ||
          h === '0.0.0.0' ||
          h.startsWith('0.') ||
          h.startsWith('127.') ||
          h.startsWith('10.') ||
          h.startsWith('192.168.') ||
          h.startsWith('169.254.') ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
          h.startsWith('fe80:') ||
          h.startsWith('fc') ||
          h.startsWith('fd') ||
          h.endsWith('.local') ||
          h.endsWith('.internal')
        ) {
          return null;
        }
        return parsed.href;
      } catch (_) {
        return null;
      }
    },

    getAvailableRpcs() {
      const settings = FitiaVault.getSettings();
      const list = [...DEFAULT_POLYGON_RPCS];
      const validCustom = this.validateRpcUrl(settings.customRpcUrl);
      if (validCustom) {
        list.unshift({ name: 'RPC Personnalisé', url: validCustom });
      }
      return list;
    },

    createStaticProvider(rpcUrl) {
      const network = ethers.Network.from({ name: 'matic', chainId: POLYGON_CHAIN_ID });
      return new ethers.JsonRpcProvider(rpcUrl, network, {
        staticNetwork: network,
        batchMaxCount: 1
      });
    },

    async pingRpc(rpcUrl, timeoutMs = 4500) {
      const validUrl = this.validateRpcUrl(rpcUrl);
      if (!validUrl) throw new Error('INVALID_RPC_URL');
      const start = performance.now();
      const prov = this.createStaticProvider(validUrl);
      const block = await Promise.race([
        prov.getBlockNumber(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), timeoutMs))
      ]);
      const latencyMs = Math.round(performance.now() - start);
      return { ok: true, block, latencyMs, provider: prov };
    },

    async connectBestProvider(preferredUrl = null) {
      const settings = FitiaVault.getSettings();
      const rpcs = this.getAvailableRpcs();
      const targetFirst = preferredUrl || settings.customRpcUrl || settings.preferredRpcUrl;

      const ordered = [...rpcs].sort((a, b) => (a.url === targetFirst ? -1 : b.url === targetFirst ? 1 : 0));

      for (const item of ordered) {
        try {
          const res = await this.pingRpc(item.url, 4500);
          if (res.ok && res.block > 0) {
            this.currentRpcUrl = item.url;
            this.provider = res.provider;
            FitiaVault.saveSettings({ preferredRpcUrl: item.url });
            return { provider: res.provider, url: item.url, latencyMs: res.latencyMs, block: res.block };
          }
        } catch (_) {}
      }

      const fallbackUrl = ordered[0].url;
      this.currentRpcUrl = fallbackUrl;
      this.provider = this.createStaticProvider(fallbackUrl);
      return { provider: this.provider, url: fallbackUrl, latencyMs: null, block: null };
    },

    createSigner(privateKey, provider = null) {
      return new PolygonSmartWallet(privateKey, provider || this.provider);
    },

    async getOptimalFeeData(provider) {
      const prov = provider || this.provider;
      let maxPriorityFeePerGas = MIN_PRIORITY_FEE_GWEI;
      let maxFeePerGas = MIN_MAX_FEE_GWEI;

      try {
        const feeData = await prov.getFeeData();
        if (feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas > maxPriorityFeePerGas) {
          maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * 115n) / 100n;
        }
        if (feeData.maxFeePerGas) {
          const candidate = (feeData.maxFeePerGas * 125n) / 100n + maxPriorityFeePerGas;
          maxFeePerGas = candidate > maxPriorityFeePerGas ? candidate : maxPriorityFeePerGas * 2n;
        } else if (feeData.gasPrice) {
          const candidate = (feeData.gasPrice * 125n) / 100n;
          maxFeePerGas = candidate > maxPriorityFeePerGas ? candidate : maxPriorityFeePerGas * 2n;
        }
      } catch (_) {}

      if (maxFeePerGas < maxPriorityFeePerGas + (15n * 10n ** 9n)) {
        maxFeePerGas = maxPriorityFeePerGas + (35n * 10n ** 9n);
      }
      return { maxPriorityFeePerGas, maxFeePerGas };
    }
  };

  global.FitiaSecurity = {
    Vault: FitiaVault,
    Rpc: PolygonRpcManager,
    Native: NativeHelper,
    escapeHtml,
    DEFAULT_POLYGON_RPCS
  };
})(window);
