const crypto = require('crypto');

const SESSION_TTL_MS = 30 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const MAX_BODY_BYTES = 256 * 1024;
const CATEGORIES = new Set(['information', 'event', 'referral', 'security']);
const LANGUAGES = ['fr', 'en', 'de', 'zh', 'sg'];
const loginFailures = globalThis.__fitiaAdminLoginFailures || new Map();
globalThis.__fitiaAdminLoginFailures = loginFailures;

class ApiError extends Error {
  constructor(status, message, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength).trim();
}

function normalizeLocalizedText(value, maxLength, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, `${fieldName} doit contenir des traductions.`, 'VALIDATION');
  }
  const localized = {};
  LANGUAGES.forEach((lang) => {
    const text = cleanText(value[lang], maxLength);
    if (text) localized[lang] = text;
  });
  if (!localized.fr && !localized.en) {
    throw new ApiError(400, `${fieldName} doit être renseigné au moins en français ou en anglais.`, 'VALIDATION');
  }
  return localized;
}

function normalizeDate(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new ApiError(400, `${fieldName} est invalide.`, 'VALIDATION');
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new ApiError(400, `${fieldName} est invalide.`, 'VALIDATION');
  return new Date(timestamp).toISOString();
}

function validateAnnouncementManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.enabled !== 'boolean' || !Array.isArray(raw.announcements)) {
    throw new ApiError(400, 'Le manifeste est invalide.', 'VALIDATION');
  }
  if (raw.announcements.length > 50) throw new ApiError(400, 'Le maximum est de 50 annonces.', 'VALIDATION');
  const ids = new Set();
  const announcements = raw.announcements.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ApiError(400, 'Une annonce est invalide.', 'VALIDATION');
    const id = cleanText(item.id, 64);
    const category = cleanText(item.category, 20).toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(id) || ids.has(id)) throw new ApiError(400, 'Un identifiant est invalide ou dupliqué.', 'VALIDATION');
    if (!CATEGORIES.has(category)) throw new ApiError(400, 'Une catégorie est invalide.', 'VALIDATION');
    ids.add(id);
    const normalized = {
      id,
      category,
      title: normalizeLocalizedText(item.title, 80, 'Le titre'),
      message: normalizeLocalizedText(item.message, 180, 'Le message')
    };
    const startsAt = normalizeDate(item.startsAt, 'La date de début');
    const expiresAt = normalizeDate(item.expiresAt, 'La date de fin');
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      throw new ApiError(400, 'La date de fin doit être postérieure à la date de début.', 'VALIDATION');
    }
    if (startsAt) normalized.startsAt = startsAt;
    if (expiresAt) normalized.expiresAt = expiresAt;
    return normalized;
  });
  const now = Date.now();
  const activeCount = announcements.filter((item) => (
    (!item.startsAt || Date.parse(item.startsAt) <= now) && (!item.expiresAt || Date.parse(item.expiresAt) > now)
  )).length;
  if (activeCount > 12) throw new ApiError(400, 'Douze annonces actives maximum.', 'VALIDATION');
  return { enabled: raw.enabled, announcements };
}

function validatePromotionManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.enabled !== 'boolean' || !Array.isArray(raw.promotions)) {
    throw new ApiError(400, 'Le manifeste des décorations est invalide.', 'VALIDATION');
  }
  if (raw.promotions.length > 50) throw new ApiError(400, 'Le maximum est de 50 décorations.', 'VALIDATION');
  const ids = new Set();
  const targets = new Set();
  const promotions = raw.promotions.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ApiError(400, 'Une décoration est invalide.', 'VALIDATION');
    const id = cleanText(item.id, 64);
    const targetType = cleanText(item.targetType, 16).toLowerCase();
    const targetId = item.targetId;
    const variant = cleanText(item.variant, 16).toLowerCase();
    const animated = item.animated === undefined ? true : item.animated;
    const targetKey = `${targetType}:${targetId}`;
    if (!/^[a-z0-9._-]+$/.test(id) || ids.has(id)) throw new ApiError(400, 'Un identifiant de décoration est invalide ou dupliqué.', 'VALIDATION');
    if (!['machine', 'battery'].includes(targetType) || !Number.isSafeInteger(targetId) || targetId < 0 || targetId > 99) {
      throw new ApiError(400, 'La machine ou la batterie sélectionnée est invalide.', 'VALIDATION');
    }
    if (!['gift', 'bells', 'snow', 'confetti', 'fireworks', 'hearts', 'blossom', 'halloween', 'badge'].includes(variant) || typeof animated !== 'boolean') {
      throw new ApiError(400, 'Le style ou le réglage d’animation de la décoration est invalide.', 'VALIDATION');
    }
    if (targets.has(targetKey)) throw new ApiError(400, 'Un article ne peut avoir qu’une seule décoration.', 'VALIDATION');
    ids.add(id);
    targets.add(targetKey);
    const normalized = {
      id,
      targetType,
      targetId,
      variant,
      animated,
      label: normalizeLocalizedText(item.label, 32, 'Le badge')
    };
    const startsAt = normalizeDate(item.startsAt, 'La date de début');
    const expiresAt = normalizeDate(item.expiresAt, 'La date de fin');
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      throw new ApiError(400, 'La date de fin doit être postérieure à la date de début.', 'VALIDATION');
    }
    if (startsAt) normalized.startsAt = startsAt;
    if (expiresAt) normalized.expiresAt = expiresAt;
    return normalized;
  });
  return { enabled: raw.enabled, promotions };
}

function validateManifest(raw, kind = 'announcements') {
  return kind === 'promotions' ? validatePromotionManifest(raw) : validateAnnouncementManifest(raw);
}

function manifestFile(kind) {
  return kind === 'promotions' ? 'promotions.json' : 'announcements.json';
}

function manifestName(kind) {
  return kind === 'promotions' ? 'décorations' : 'annonces';
}

function parseCookies(req) {
  const cookies = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return;
    const key = part.slice(0, separator).trim();
    if (key) cookies[key] = part.slice(separator + 1).trim();
  });
  return cookies;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    try {
      const parsed = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
      return Promise.resolve(parsed);
    } catch (_) {
      return Promise.reject(new ApiError(400, 'Le JSON est invalide.', 'JSON'));
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new ApiError(413, 'La requête est trop volumineuse.', 'TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
        resolve(parsed);
      } catch (_) {
        reject(new ApiError(400, 'Le JSON est invalide.', 'JSON'));
      }
    });
    req.on('error', reject);
  });
}

function getConfig() {
  const password = process.env.FITIA_ADMIN_PASSWORD || '';
  const githubToken = process.env.FITIA_GITHUB_TOKEN || '';
  if (password.length < 12 || password.length > 256 || !githubToken) {
    throw new ApiError(503, 'Le panneau doit être configuré dans les variables d’environnement de l’hébergeur.', 'ADMIN_CONFIG');
  }
  return {
    password,
    githubToken,
    owner: process.env.FITIA_ADMIN_GITHUB_OWNER || 'web3service',
    repo: process.env.FITIA_ADMIN_GITHUB_REPO || 'fitia-mining-pro',
    branch: process.env.FITIA_ADMIN_GITHUB_BRANCH || 'main',
    apiBase: 'https://api.github.com'
  };
}

function sourceInfo(config) {
  return { mode: 'github', project: `${config.owner}/${config.repo}`, branch: config.branch };
}

function sessionSigningKey(config) {
  return crypto.createHash('sha256').update(`fitia-admin-session-v1:${config.password}`).digest();
}

function signature(payload, config) {
  return crypto.createHmac('sha256', sessionSigningKey(config)).update(payload).digest('base64url');
}

function createSession(config) {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ csrfToken, expiresAt })).toString('base64url');
  return { token: `${payload}.${signature(payload, config)}`, csrfToken, expiresAt };
}

function getSession(req, config) {
  const token = parseCookies(req).fitia_admin_session || '';
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra || !safeEqual(suppliedSignature, signature(payload, config))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!/^[0-9a-f]{64}$/.test(session.csrfToken) || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
    return session;
  } catch (_) {
    return null;
  }
}

function sessionCookie(session) {
  return `fitia_admin_session=${session.token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

function requireSession(req, res, config) {
  const session = getSession(req, config);
  if (!session) {
    sendJson(res, 401, { error: 'Connexion requise.', code: 'AUTH_REQUIRED' });
    return null;
  }
  return session;
}

function requireCsrf(req, res, session) {
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host) throw new Error('origin');
    } catch (_) {
      sendJson(res, 403, { error: 'Origine de la requête refusée.', code: 'ORIGIN' });
      return false;
    }
  }
  if (!safeEqual(req.headers['x-csrf-token'], session.csrfToken)) {
    sendJson(res, 403, { error: 'Jeton de sécurité invalide.', code: 'CSRF' });
    return false;
  }
  return true;
}

async function githubRequest(config, url, init = {}) {
  try {
    return await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'FITIA-PRO-Admin-Vercel',
        ...(init.headers || {})
      }
    });
  } catch (_) {
    throw new ApiError(503, 'La connexion à GitHub est momentanément indisponible.', 'GITHUB_UNAVAILABLE');
  }
}

async function loadManifest(config, kind = 'announcements') {
  const file = manifestFile(kind);
  const url = `${config.apiBase}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${file}?ref=${encodeURIComponent(config.branch)}`;
  const response = await githubRequest(config, url);
  if (!response.ok) throw new ApiError(503, `Impossible de lire les ${manifestName(kind)} depuis GitHub.`, 'GITHUB_READ');
  const data = await response.json();
  if (!data.sha || data.encoding !== 'base64' || !data.content) throw new ApiError(503, 'La réponse GitHub est invalide.', 'GITHUB_READ');
  try {
    return { manifest: validateManifest(JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')), kind), revision: String(data.sha) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) throw error;
    throw new ApiError(503, 'Le manifeste GitHub est illisible.', 'GITHUB_READ');
  }
}

async function saveManifest(config, manifest, expectedRevision, kind = 'announcements') {
  if (typeof expectedRevision !== 'string' || !expectedRevision || expectedRevision.length > 128) {
    throw new ApiError(400, 'La révision du manifeste est requise.', 'REVISION');
  }
  const current = await loadManifest(config, kind);
  if (current.revision !== expectedRevision) throw new ApiError(409, `Les ${manifestName(kind)} ont changé ailleurs. Rechargez avant de réessayer.`, 'CONFLICT');
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const url = `${config.apiBase}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${manifestFile(kind)}`;
  const response = await githubRequest(config, url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: kind === 'promotions' ? 'Update FITIA promotions' : 'Update FITIA announcements', content: Buffer.from(serialized).toString('base64'), sha: current.revision, branch: config.branch })
  });
  if (response.status === 409) throw new ApiError(409, `Les ${manifestName(kind)} ont changé ailleurs. Rechargez avant de réessayer.`, 'CONFLICT');
  if (!response.ok) throw new ApiError(503, 'La publication GitHub a été refusée. Vérifiez la configuration du serveur.', 'GITHUB_WRITE');
  const result = await response.json();
  if (result.content && result.content.sha) return String(result.content.sha);
  return (await loadManifest(config, kind)).revision;
}

module.exports = async function adminHandler(req, res) {
  setSecurityHeaders(res);
  try {
    const config = getConfig();
    const url = new URL(req.url || '/', 'http://localhost');
    const action = req.query?.action || url.searchParams.get('action') || url.pathname.split('/').pop();

    if (action === 'login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'vercel';
      const now = Date.now();
      const record = loginFailures.get(ip);
      if (record && record.resetAt > now && record.count >= MAX_LOGIN_FAILURES) {
        sendJson(res, 429, { error: 'Trop de tentatives. Réessayez plus tard.', code: 'RATE_LIMIT' }, { 'Retry-After': String(Math.ceil((record.resetAt - now) / 1000)) });
        return;
      }
      const body = await readJson(req);
      if (!safeEqual(sha256(String(body.password || '')), sha256(config.password))) {
        const next = record && record.resetAt > now ? record : { count: 0, resetAt: now + LOGIN_WINDOW_MS };
        next.count += 1;
        loginFailures.set(ip, next);
        sendJson(res, 401, { error: 'Mot de passe incorrect.', code: 'LOGIN' });
        return;
      }
      loginFailures.delete(ip);
      const session = createSession(config);
      sendJson(res, 200, { authenticated: true, csrfToken: session.csrfToken, expiresAt: new Date(session.expiresAt).toISOString(), ...sourceInfo(config) }, { 'Set-Cookie': sessionCookie(session) });
      return;
    }

    if (action === 'session' && req.method === 'GET') {
      const session = requireSession(req, res, config);
      if (session) sendJson(res, 200, { authenticated: true, csrfToken: session.csrfToken, expiresAt: new Date(session.expiresAt).toISOString(), ...sourceInfo(config) });
      return;
    }

    if (action === 'logout' && req.method === 'POST') {
      const session = requireSession(req, res, config);
      if (!session || !requireCsrf(req, res, session)) return;
      sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'fitia_admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' });
      return;
    }

    if ((action === 'announcements' || action === 'promotions') && req.method === 'GET') {
      const session = requireSession(req, res, config);
      if (!session) return;
      const result = await loadManifest(config, action);
      sendJson(res, 200, { ...result, ...sourceInfo(config), serverTime: new Date().toISOString() });
      return;
    }

    if ((action === 'announcements' || action === 'promotions') && req.method === 'PUT') {
      const session = requireSession(req, res, config);
      if (!session || !requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const manifest = validateManifest(body.manifest, action);
      const revision = await saveManifest(config, manifest, body.revision, action);
      sendJson(res, 200, { manifest, revision, ...sourceInfo(config), serverTime: new Date().toISOString() });
      return;
    }

    sendJson(res, 404, { error: 'Route API introuvable.', code: 'NOT_FOUND' });
  } catch (error) {
    if (res.headersSent || res.writableEnded) return;
    if (error instanceof ApiError) {
      sendJson(res, error.status, { error: error.message, code: error.code });
      return;
    }
    console.error('Vercel admin error:', error && error.message ? error.message : 'unknown error');
    sendJson(res, 500, { error: 'Une erreur interne est survenue.', code: 'INTERNAL' });
  }
};
