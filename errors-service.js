// ═══════════════════════════════════════════════════════════════════
//  Ingest d'erreurs client (item 8) — alternative légère à Sentry.
//  - Pas d'auth (endpoint public), aucune donnée sensible acceptée.
//  - Redactions email/JWT-like, plafonds de taille, rate-limit côté api.
//  - Stockage Supabase si configuré, sinon mémoire plafonnée (dev).
// ═══════════════════════════════════════════════════════════════════
'use strict';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const HEX_RE = /\b0x[0-9a-fA-F]{40}\b/g;
const MAX_RECORDS = 500;

function redact(value) {
  return String(value || '')
    .replace(JWT_RE, '[jwt]')
    .replace(EMAIL_RE, '[email]')
    .replace(HEX_RE, '[address]');
}

function cap(value, max) {
  const text = redact(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    return `${parsed.origin}${parsed.pathname}`.slice(0, 300);
  } catch (_) {
    return cap(url, 300);
  }
}

function sanitizeReport(input = {}) {
  const message = cap(input.message, 500);
  if (!message.trim()) {
    const error = new Error('Message requis.');
    error.code = 'ERRORS_MESSAGE';
    throw error;
  }
  return {
    message,
    stack: input.stack ? cap(input.stack, 2000) : null,
    url: input.url ? sanitizeUrl(input.url) : null,
    release: cap(input.release, 64),
    platform: cap(input.platform, 32),
    user_agent: cap(input.userAgent, 200)
  };
}

function createMemoryErrorStore() {
  const records = [];
  return {
    async insert(record) {
      records.push({ ...record, created_at: new Date().toISOString() });
      if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
      return true;
    },
    async list(limit = 50) {
      return records.slice(-limit);
    }
  };
}

function createSupabaseErrorStore(options) {
  const baseUrl = String(options.url || '').replace(/\/+$/, '');
  const serviceRoleKey = String(options.serviceRoleKey || '');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const endpoint = `${baseUrl}/rest/v1/app_errors`;
  return {
    async insert(record) {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(record)
      });
      return response.ok;
    },
    async list() {
      return [];
    }
  };
}

class ErrorService {
  constructor(options = {}) {
    this.store = options.store || createMemoryErrorStore();
    this.nowFn = typeof options.nowFn === 'function' ? options.nowFn : () => Date.now();
  }

  // Ne lève jamais d'erreur d'ingestion : l'observability ne doit pas
  // perturber l'application. Succès = { ok: true, stored: bool }.
  async ingest(input) {
    try {
      const record = sanitizeReport(input);
      const stored = await this.store.insert(record);
      return { ok: true, stored: stored === true };
    } catch (error) {
      if (error && error.code === 'ERRORS_MESSAGE') throw error;
      return { ok: true, stored: false };
    }
  }
}

function fromEnv(env = process.env, overrides = {}) {
  let store = overrides.store || null;
  const supabaseUrl = env.FITIA_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.FITIA_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!store && supabaseUrl && supabaseKey) {
    store = createSupabaseErrorStore({
      url: supabaseUrl,
      serviceRoleKey: supabaseKey,
      fetchImpl: overrides.fetchImpl
    });
  }
  if (!store) store = createMemoryErrorStore();
  return { store, fetchImpl: overrides.fetchImpl, now: overrides.now };
}

module.exports = {
  ErrorService,
  fromEnv,
  sanitizeReport,
  sanitizeUrl,
  redact,
  createMemoryErrorStore,
  createSupabaseErrorStore
};
