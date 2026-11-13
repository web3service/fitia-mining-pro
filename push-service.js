// ═══════════════════════════════════════════════════════════════════
//  FCM HTTP v1 (item 5) — enregistrement d'appareils et envoi de push.
//  Envoi réservé aux opérateurs : en-tête x-fitia-admin-token ==
//  PUSH_ADMIN_TOKEN (comparaison à temps constant, fail-closed sinon).
//  Sans Firebase configuré, le service reste en mode dégradé :
//  l'enregistrement fonctionne (mémoire/Supabase) mais l'envoi répond 503.
// ═══════════════════════════════════════════════════════════════════
'use strict';

const crypto = require('crypto');
const GoogleOAuth = require('./lib/google-oauth');

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const MAX_TOKEN_LENGTH = 4096;
const TOKEN_PATTERN = /^[A-Za-z0-9:_-]{20,4096}$/;
const MAX_BATCH = 500;

function tokenPatternOk(token) {
  return typeof token === 'string' && token.length <= MAX_TOKEN_LENGTH && TOKEN_PATTERN.test(token);
}

function createMemoryPushStore() {
  const tokens = new Map(); // token -> { token, platform, createdAt }
  return {
    async upsert(entry) {
      tokens.set(entry.token, { ...entry });
      return true;
    },
    async remove(token) {
      tokens.delete(token);
      return true;
    },
    async list(limit) {
      const all = [...tokens.values()];
      return typeof limit === 'number' ? all.slice(0, limit) : all;
    }
  };
}

function createSupabasePushStore(options) {
  const baseUrl = String(options.url || '').replace(/\/+$/, '');
  const serviceRoleKey = String(options.serviceRoleKey || '');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const endpoint = `${baseUrl}/rest/v1/push_tokens`;
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json'
  };
  return {
    async upsert(entry) {
      const response = await fetchImpl(`${endpoint}?on_conflict=token`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ token: entry.token, platform: entry.platform }])
      });
      return response.ok;
    },
    async remove(token) {
      const response = await fetchImpl(`${endpoint}?token=eq.${encodeURIComponent(token)}`, {
        method: 'DELETE',
        headers: { ...headers, Prefer: 'return=minimal' }
      });
      return response.ok;
    },
    async list(limit) {
      const size = typeof limit === 'number' ? Math.min(limit, MAX_BATCH) : MAX_BATCH;
      const response = await fetchImpl(`${endpoint}?select=token&order=created_at.desc&limit=${size}`, {
        headers: { ...headers, Prefer: 'return=representation' }
      });
      if (!response.ok) return [];
      const rows = await response.json().catch(() => []);
      return Array.isArray(rows) ? rows.map((row) => ({ token: row.token })) : [];
    }
  };
}

function assertAdminToken(headerValue, adminToken) {
  const provided = Buffer.from(String(headerValue || ''), 'utf8');
  const expected = Buffer.from(String(adminToken || ''), 'utf8');
  if (expected.length === 0 || provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

class PushService {
  constructor(options = {}) {
    this.credentials = options.credentials || null;
    this.projectId = options.projectId || (this.credentials && this.credentials.project_id) || null;
    this.adminToken = options.adminToken || null;
    this.store = options.store || createMemoryPushStore();
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.nowFn = typeof options.nowFn === 'function' ? options.nowFn : () => Date.now();
  }

  isSendConfigured() {
    return Boolean(this.credentials && this.projectId);
  }

  async register({ token, platform } = {}) {
    if (!tokenPatternOk(token)) {
      const error = new Error('Jeton de notification invalide.');
      error.code = 'PUSH_TOKEN';
      throw error;
    }
    const cleanedPlatform = ['android', 'web'].includes(String(platform || '').toLowerCase())
      ? String(platform).toLowerCase()
      : 'android';
    const ok = await this.store.upsert({ token, platform: cleanedPlatform, createdAt: this.nowFn() });
    if (!ok) {
      const error = new Error('Enregistrement de l’appairage impossible.');
      error.code = 'PUSH_STORE';
      throw error;
    }
    return { ok: true };
  }

  async unregister({ token } = {}) {
    if (!tokenPatternOk(token)) {
      const error = new Error('Jeton de notification invalide.');
      error.code = 'PUSH_TOKEN';
      throw error;
    }
    await this.store.remove(token);
    return { ok: true };
  }

  // Envoi groupé ; exige un jeton admin en amont (api/push.js).
  // Purge automatique des jetons FCM devenus UNREGISTERED / de notification invalide.
  async send({ tokens, title, body, data } = {}) {
    if (!this.isSendConfigured()) {
      const error = new Error('FCM non configuré (FCM_SERVICE_ACCOUNT_JSON / FCM_PROJECT_ID).');
      error.code = 'PUSH_NOT_CONFIGURED';
      throw error;
    }
    const cleanTitle = String(title || '').slice(0, 120);
    const cleanBody = String(body || '').slice(0, 400);
    if (!cleanTitle) {
      const error = new Error('Titre de notification requis.');
      error.code = 'PUSH_PAYLOAD';
      throw error;
    }
    if (typeof this.fetchImpl !== 'function') {
      const error = new Error('fetch indisponible.');
      error.code = 'PUSH_FETCH_MISSING';
      throw error;
    }
    const recipients = Array.isArray(tokens) && tokens.length
      ? tokens.filter(tokenPatternOk).slice(0, MAX_BATCH)
      : (await this.store.list(MAX_BATCH)).map((entry) => entry.token);
    if (recipients.length === 0) {
      return { ok: true, sent: 0, failed: 0, pruned: 0 };
    }
    const accessToken = await GoogleOAuth.getAccessToken({
      credentials: this.credentials,
      scope: FCM_SCOPE,
      fetchImpl: this.fetchImpl,
      now: this.nowFn()
    });
    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/messages:send`;
    const safeData = {};
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [key, value] of Object.entries(data).slice(0, 20)) {
        if (/^[A-Za-z0-9_.-]{1,64}$/.test(key)) safeData[key] = String(value).slice(0, 400);
      }
    }
    let sent = 0;
    let failed = 0;
    let pruned = 0;
    for (const token of recipients) {
      const message = {
        message: Object.assign(
          { token, notification: { title: cleanTitle, body: cleanBody } },
          Object.keys(safeData).length ? { data: safeData } : {}
        )
      };
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      if (response.ok) {
        sent += 1;
        continue;
      }
      let errorBody = null;
      try { errorBody = await response.json(); } catch (_) { /* ignore */ }
      const status = errorBody && errorBody.error ? String(errorBody.error.status || '') : '';
      const code = errorBody && errorBody.error && Array.isArray(errorBody.error.details)
        ? errorBody.error.details.map((d) => String(d.errorCode || '')).join(',')
        : '';
      if (response.status === 404 || status === 'NOT_FOUND' || code.includes('UNREGISTERED') || code.includes('INVALID_ARGUMENT')) {
        try { await this.store.remove(token); pruned += 1; } catch (_) { /* best effort */ }
      }
      failed += 1;
    }
    return { ok: true, sent, failed, pruned };
  }
}

function fromEnv(env = process.env, overrides = {}) {
  const credentials = GoogleOAuth.parseServiceAccount(env.FCM_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT_JSON);
  let store = overrides.store || null;
  if (!store && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    store = createSupabasePushStore({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      fetchImpl: overrides.fetchImpl
    });
  }
  if (!store) store = createMemoryPushStore();
  return {
    credentials,
    projectId: String(env.FCM_PROJECT_ID || '') || (credentials && credentials.project_id) || null,
    adminToken: env.PUSH_ADMIN_TOKEN || null,
    store,
    fetchImpl: overrides.fetchImpl,
    now: overrides.now
  };
}

module.exports = {
  PushService,
  fromEnv,
  createMemoryPushStore,
  createSupabasePushStore,
  assertAdminToken,
  tokenPatternOk
};
