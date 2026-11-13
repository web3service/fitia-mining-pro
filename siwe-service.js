// ═══════════════════════════════════════════════════════════════════
//  SIWE service : émission de nonces à usage unique (HMAC-signed) et
//  vérification EIP-4361. Les nonces sont brûlés après vérification
//  (Supabase si configuré, sinon mémoire — dev uniquement).
//  Rotation des clés HMAC via lib/hmac-tokens (FITIA_SESSION_SECRETS).
// ═══════════════════════════════════════════════════════════════════
'use strict';

const HmacTokens = require('./lib/hmac-tokens');
const SiweMessage = require('./siwe-message');

const NONCE_TTL_MS = 5 * 60 * 1000;
const MAX_MEMORY_NONCES = 4096;

function createMemoryNonceStore() {
  const spent = new Map(); // nonce -> exp (ms epoch)
  function purge(now) {
    for (const [key, exp] of spent) {
      if (exp <= now) spent.delete(key);
    }
    if (spent.size > MAX_MEMORY_NONCES) {
      const excess = spent.size - MAX_MEMORY_NONCES;
      let i = 0;
      for (const key of spent.keys()) {
        spent.delete(key);
        if (++i >= excess) break;
      }
    }
  }
  return {
    // true si le nonce vient d'être brûlé, false s'il avait déjà été utilisé.
    async burn(nonce, expiresAtMs, now) {
      purge(now);
      if (spent.has(nonce)) return false;
      spent.set(nonce, expiresAtMs || now + NONCE_TTL_MS);
      return true;
    }
  };
}

function createSupabaseNonceStore(options) {
  const baseUrl = String(options.url || '').replace(/\/+$/, '');
  const serviceRoleKey = String(options.serviceRoleKey || '');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const endpoint = `${baseUrl}/rest/v1/siwe_nonces`;
  return {
    async burn(nonce, expiresAtMs, now) {
      if (typeof fetchImpl !== 'function') {
        const error = new Error('Stockage SIWE indisponible.');
        error.code = 'SIWE_STORE';
        throw error;
      }
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          nonce: String(nonce),
          expires_at: new Date(expiresAtMs || now + NONCE_TTL_MS).toISOString()
        })
      });
      if (response.status === 409) return false; // déjà utilisé (contrainte unique)
      if (!response.ok) {
        const error = new Error('Stockage SIWE en échec.');
        error.code = 'SIWE_STORE';
        throw error;
      }
      return true;
    }
  };
}

function fromEnv(env = process.env, overrides = {}) {
  const secrets = HmacTokens.parseSecrets(env.FITIA_SESSION_SECRETS || env.SIWE_SESSION_SECRETS);
  let store = overrides.store || null;
  const supabaseUrl = env.FITIA_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.FITIA_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!store && supabaseUrl && supabaseKey) {
    store = createSupabaseNonceStore({
      url: supabaseUrl,
      serviceRoleKey: supabaseKey,
      fetchImpl: overrides.fetchImpl
    });
  }
  if (!store) store = createMemoryNonceStore();
  const allowedDomains = String(env.SIWE_DOMAINS || env.SIWE_DOMAIN || 'app.fitia.pro')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return {
    secrets,
    store,
    allowedDomains,
    fetchImpl: overrides.fetchImpl,
    now: overrides.now
  };
}

class SiweService {
  constructor(options = {}) {
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    this.secrets = Array.isArray(options.secrets) ? options.secrets : [];
    this.store = options.store || createMemoryNonceStore();
    this.allowedDomains = Array.isArray(options.allowedDomains) ? options.allowedDomains : [];
    this.nowFn = typeof options.nowFn === 'function' ? options.nowFn : () => Date.now();
    void now;
  }

  issueNonce() {
    if (this.secrets.length === 0) {
      const error = new Error('FITIA_SESSION_SECRETS non configuré.');
      error.code = 'SIWE_NOT_CONFIGURED';
      throw error;
    }
    const now = this.nowFn();
    const nonce = SiweMessage.generateNonce(24);
    const nonceToken = HmacTokens.sign({ typ: 'siwe-nonce', nonce }, this.secrets, { ttlMs: NONCE_TTL_MS, now });
    return { nonce, nonceToken, expiresIn: Math.floor(NONCE_TTL_MS / 1000) };
  }

  // message/signature : EIP-4361 ; nonceToken : jeton HMAC émis par issueNonce().
  async verify({ message, signature, nonceToken, chainId } = {}) {
    if (this.secrets.length === 0) {
      const error = new Error('FITIA_SESSION_SECRETS non configuré.');
      error.code = 'SIWE_NOT_CONFIGURED';
      throw error;
    }
    const now = this.nowFn();
    let tokenBody;
    try {
      tokenBody = HmacTokens.verify(nonceToken, this.secrets, { now });
    } catch (error) {
      error.code = error.code || 'SIWE_NONCE_TOKEN';
      throw error;
    }
    if (tokenBody.typ !== 'siwe-nonce' || typeof tokenBody.nonce !== 'string') {
      const error = new Error('Jeton de nonce invalide.');
      error.code = 'SIWE_NONCE_TOKEN';
      throw error;
    }
    const verified = SiweMessage.verifySiweMessage({
      message,
      signature,
      allowedDomains: this.allowedDomains.length ? this.allowedDomains : undefined,
      chainId: chainId ? Number(chainId) : undefined,
      now
    });
    if (verified.nonce !== tokenBody.nonce) {
      const error = new Error('Le nonce du message ne correspond pas.');
      error.code = 'SIWE_NONCE_MISMATCH';
      throw error;
    }
    const burned = await this.store.burn(verified.nonce, Date.parse(verified.expirationTime || '') || now + NONCE_TTL_MS, now);
    if (!burned) {
      const error = new Error('Nonce déjà utilisé.');
      error.code = 'SIWE_NONCE_REUSED';
      throw error;
    }
    return verified;
  }
}

module.exports = {
  SiweService,
  createMemoryNonceStore,
  createSupabaseNonceStore,
  fromEnv,
  NONCE_TTL_MS
};
