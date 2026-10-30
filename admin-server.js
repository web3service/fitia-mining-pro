#!/usr/bin/env node
// Serveur séparé du panneau d'administration FITIA PRO.
// Aucun secret GitHub n'est envoyé au navigateur.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  MAX_ANNOUNCEMENT_IMAGE_BODY_BYTES,
  normalizeAppearance,
  validateImagePayload
} = require('./announcement-assets');
const { validateManifest: validateStoreCatalog } = require('./store-catalog');
const { getDefaultOrderService } = require('./store-order-service');
const { getDefaultFarmService } = require('./farm-service');
const GameVisibility = require('./game-visibility-config');

const ROOT = __dirname;
const ADMIN_DIR = path.join(ROOT, 'admin');
const SESSION_TTL_MS = 30 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const MAX_BODY_BYTES = 256 * 1024;
const CATEGORIES = new Set(['information', 'event', 'referral', 'security']);
const LANGUAGES = ['fr', 'en', 'de', 'zh', 'sg'];

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
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
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

function normalizeAnnouncement(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new ApiError(400, 'Une annonce est invalide.', 'VALIDATION');
  }
  const id = cleanText(item.id, 64);
  const category = cleanText(item.category, 20).toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(id)) throw new ApiError(400, 'Un identifiant d’annonce est invalide.', 'VALIDATION');
  if (!CATEGORIES.has(category)) throw new ApiError(400, 'Une catégorie d’annonce est invalide.', 'VALIDATION');
  const enabled = item.enabled === undefined ? true : item.enabled;
  if (typeof enabled !== 'boolean') throw new ApiError(400, 'L’état d’une annonce est invalide.', 'VALIDATION');
  const normalized = {
    id,
    category,
    enabled,
    title: normalizeLocalizedText(item.title, 80, 'Le titre'),
    message: normalizeLocalizedText(item.message, 180, 'Le message')
  };
  const appearance = normalizeAppearance(item);
  if (!appearance.ok) throw new ApiError(appearance.status, appearance.message, appearance.code);
  Object.assign(normalized, appearance.value);
  const startsAt = normalizeDate(item.startsAt, 'La date de début');
  const expiresAt = normalizeDate(item.expiresAt, 'La date de fin');
  if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
    throw new ApiError(400, 'La date de fin doit être postérieure à la date de début.', 'VALIDATION');
  }
  if (startsAt) normalized.startsAt = startsAt;
  if (expiresAt) normalized.expiresAt = expiresAt;
  return normalized;
}

function validateManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiError(400, 'Le manifeste est invalide.', 'VALIDATION');
  }
  if (typeof raw.enabled !== 'boolean' || !Array.isArray(raw.announcements)) {
    throw new ApiError(400, 'Le manifeste doit contenir enabled et announcements.', 'VALIDATION');
  }
  if (raw.announcements.length > 50) {
    throw new ApiError(400, 'Le maximum est de 50 annonces, y compris les annonces expirées.', 'VALIDATION');
  }
  const ids = new Set();
  const announcements = raw.announcements.map((item) => {
    const normalized = normalizeAnnouncement(item);
    if (ids.has(normalized.id)) throw new ApiError(400, `L’identifiant ${normalized.id} est dupliqué.`, 'VALIDATION');
    ids.add(normalized.id);
    return normalized;
  });
  const now = Date.now();
  const activeCount = announcements.filter((item) => (
    item.enabled !== false &&
    (!item.startsAt || Date.parse(item.startsAt) <= now) &&
    (!item.expiresAt || Date.parse(item.expiresAt) > now)
  )).length;
  if (activeCount > 12) {
    throw new ApiError(400, 'Douze annonces peuvent être actives simultanément au maximum.', 'VALIDATION');
  }
  return { enabled: raw.enabled, announcements };
}

function normalizeHiddenShopItems(value) {
  if (value === undefined) return { machine: [], battery: [] };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'La visibilité de la boutique est invalide.', 'VALIDATION');
  }
  const normalized = {};
  for (const targetType of ['machine', 'battery']) {
    const values = value[targetType] === undefined ? [] : value[targetType];
    if (!Array.isArray(values) || values.length > 100) {
      throw new ApiError(400, 'La liste des articles masqués est invalide.', 'VALIDATION');
    }
    const ids = new Set();
    values.forEach((targetId) => {
      if (!Number.isSafeInteger(targetId) || targetId < 0 || targetId > 99 || ids.has(targetId)) {
        throw new ApiError(400, 'Un article masqué est invalide ou dupliqué.', 'VALIDATION');
      }
      ids.add(targetId);
    });
    normalized[targetType] = [...ids].sort((a, b) => a - b);
  }
  return normalized;
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
  return { enabled: raw.enabled, hiddenShopItems: normalizeHiddenShopItems(raw.hiddenShopItems), promotions };
}

function validateGameVisibilityManifest(raw) {
  const normalized = GameVisibility.normalizeManifest(raw);
  if (!normalized) throw new ApiError(400, 'Les paramètres de visibilité des jeux sont invalides.', 'VALIDATION');
  return normalized;
}

function validateManifestKind(raw, kind = 'announcements') {
  if (kind === 'store') {
    try { return validateStoreCatalog(raw); }
    catch (error) { throw new ApiError(error.status || 400, error.message, error.code || 'VALIDATION'); }
  }
  if (kind === 'games') return validateGameVisibilityManifest(raw);
  return kind === 'promotions' ? validatePromotionManifest(raw) : validateManifest(raw);
}

function manifestFile(kind) {
  if (kind === 'store') return 'store-products.json';
  if (kind === 'games') return 'game-visibility.json';
  return kind === 'promotions' ? 'promotions.json' : 'announcements.json';
}

function manifestName(kind) {
  if (kind === 'store') return 'produits FITIA STORE';
  if (kind === 'games') return 'paramètres de visibilité des jeux';
  return kind === 'promotions' ? 'décorations' : 'annonces';
}

function parseCookies(req) {
  const cookies = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = value;
  });
  return cookies;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function isSecureRequest(req) {
  return req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'"
  );
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

function readJson(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      reject(new ApiError(415, 'Le contenu doit être envoyé en JSON.', 'CONTENT_TYPE'));
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new ApiError(413, 'La requête est trop volumineuse.', 'TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object expected');
        resolve(parsed);
      } catch (_) {
        reject(new ApiError(400, 'Le JSON est invalide.', 'JSON'));
      }
    });
    req.on('error', reject);
  });
}

function createAdminServer(options = {}) {
  const password = options.password || process.env.FITIA_ADMIN_PASSWORD || '';
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
    throw new Error('FITIA_ADMIN_PASSWORD doit contenir entre 12 et 256 caractères.');
  }
  const githubToken = options.githubToken ?? process.env.FITIA_GITHUB_TOKEN ?? '';
  const localMode = options.localMode ?? (process.env.FITIA_ADMIN_LOCAL_MODE === '1' || !githubToken);
  if (!localMode && !githubToken) throw new Error('FITIA_GITHUB_TOKEN est requis hors mode local.');

  const dataFile = path.resolve(options.dataFile || process.env.FITIA_ADMIN_DATA_FILE || path.join(ROOT, 'announcements.json'));
  const promotionsFile = path.resolve(options.promotionsFile || process.env.FITIA_ADMIN_PROMOTIONS_FILE || path.join(ROOT, 'promotions.json'));
  const gameVisibilityFile = path.resolve(options.gameVisibilityFile || process.env.FITIA_ADMIN_GAME_VISIBILITY_FILE || path.join(ROOT, 'game-visibility.json'));
  const assetDirectory = path.resolve(options.assetDirectory || process.env.FITIA_ADMIN_ASSET_DIRECTORY || path.join(ROOT, 'assets', 'announcements'));
  const storeAssetDirectory = path.resolve(options.storeAssetDirectory || process.env.FITIA_ADMIN_STORE_ASSET_DIRECTORY || path.join(ROOT, 'assets', 'store'));
  const owner = options.owner || process.env.FITIA_ADMIN_GITHUB_OWNER || 'web3service';
  const repo = options.repo || process.env.FITIA_ADMIN_GITHUB_REPO || 'fitia-mining-pro';
  const branch = options.branch || process.env.FITIA_ADMIN_GITHUB_BRANCH || 'main';
  const githubApiBase = String(options.githubApiBase || process.env.FITIA_ADMIN_GITHUB_API || 'https://api.github.com').replace(/\/$/, '');
  const fetchImpl = options.fetch || global.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('Node.js 18+ est requis pour la connexion GitHub.');
  let orderService = options.orderService || null;
  let farmService = options.farmService || null;
  const orders = () => {
    if (!orderService) orderService = getDefaultOrderService();
    return orderService;
  };
  const farm = () => {
    if (!farmService) farmService = getDefaultFarmService();
    return farmService;
  };

  const sessions = new Map();
  const loginFailures = new Map();
  let mutationQueue = Promise.resolve();

  function sourceInfo() {
    return localMode
      ? { mode: 'local', project: null, branch: null }
      : { mode: 'github', project: `${owner}/${repo}`, branch };
  }

  function getSession(req) {
    const id = parseCookies(req).fitia_admin_session;
    if (!id) return null;
    const session = sessions.get(id);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      sessions.delete(id);
      return null;
    }
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    return { id, ...session };
  }

  function requireSession(req, res) {
    const session = getSession(req);
    if (!session) {
      sendJson(res, 401, { error: 'Connexion requise.', code: 'AUTH_REQUIRED' });
      return null;
    }
    return session;
  }

  function requireCsrf(req, res, session) {
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) throw new Error('origin');
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

  function sessionPayload(session) {
    return {
      authenticated: true,
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString(),
      ...sourceInfo()
    };
  }

  async function githubRequest(url, init = {}) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'FITIA-PRO-Admin',
          ...(init.headers || {})
        }
      });
    } catch (_) {
      throw new ApiError(503, 'La connexion à GitHub est momentanément indisponible.', 'GITHUB_UNAVAILABLE');
    }
    return response;
  }

  async function loadGitHub(kind = 'announcements') {
    const url = `${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${manifestFile(kind)}?ref=${encodeURIComponent(branch)}`;
    const response = await githubRequest(url);
    if (!response.ok) throw new ApiError(503, `Impossible de lire les ${manifestName(kind)} depuis GitHub.`, 'GITHUB_READ');
    const data = await response.json();
    if (!data.sha || data.encoding !== 'base64' || !data.content) {
      throw new ApiError(503, 'La réponse GitHub est invalide.', 'GITHUB_READ');
    }
    let parsed;
    try {
      parsed = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    } catch (_) {
      throw new ApiError(503, 'Le manifeste GitHub est illisible.', 'GITHUB_READ');
    }
    return { manifest: validateManifestKind(parsed, kind), revision: String(data.sha) };
  }

  async function saveGitHub(manifest, revision, kind = 'announcements') {
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
    const url = `${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${manifestFile(kind)}`;
    const response = await githubRequest(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: kind === 'store' ? 'Update FITIA STORE catalog' : kind === 'games' ? 'Update FITIA game visibility' : kind === 'promotions' ? 'Update FITIA promotions' : 'Update FITIA announcements',
        content: Buffer.from(serialized, 'utf8').toString('base64'),
        sha: revision,
        branch
      })
    });
    if (response.status === 409) throw new ApiError(409, `Les ${manifestName(kind)} ont changé ailleurs. Rechargez avant de réessayer.`, 'CONFLICT');
    if (!response.ok) throw new ApiError(503, 'La publication GitHub a été refusée. Vérifiez la configuration du serveur.', 'GITHUB_WRITE');
    const result = await response.json();
    if (result.content && result.content.sha) return String(result.content.sha);
    return (await loadGitHub(kind)).revision;
  }

  async function loadLocal(kind = 'announcements') {
    const targetFile = kind === 'store' ? path.resolve(options.storeDataFile || process.env.FITIA_ADMIN_STORE_DATA_FILE || path.join(ROOT, 'store-products.json')) : kind === 'games' ? gameVisibilityFile : kind === 'promotions' ? promotionsFile : dataFile;
    let serialized;
    try {
      serialized = await fs.promises.readFile(targetFile, 'utf8');
    } catch (_) {
      throw new ApiError(503, `Le fichier local des ${manifestName(kind)} est illisible.`, 'LOCAL_READ');
    }
    let parsed;
    try {
      parsed = JSON.parse(serialized);
    } catch (_) {
      throw new ApiError(503, `Le fichier local des ${manifestName(kind)} est invalide.`, 'LOCAL_READ');
    }
    return { manifest: validateManifestKind(parsed, kind), revision: sha256(serialized) };
  }

  async function saveLocal(manifest, kind = 'announcements') {
    const targetFile = kind === 'store' ? path.resolve(options.storeDataFile || process.env.FITIA_ADMIN_STORE_DATA_FILE || path.join(ROOT, 'store-products.json')) : kind === 'games' ? gameVisibilityFile : kind === 'promotions' ? promotionsFile : dataFile;
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
    const temporary = `${targetFile}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.promises.writeFile(temporary, serialized, { encoding: 'utf8', mode: 0o600 });
    await fs.promises.rename(temporary, targetFile);
    return sha256(serialized);
  }

  async function saveGitHubAsset(asset) {
    const encodedPath = asset.path.split('/').map(encodeURIComponent).join('/');
    const url = `${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
    const existing = await githubRequest(`${url}?ref=${encodeURIComponent(branch)}`);
    if (existing.ok) return;
    if (existing.status !== 404) throw new ApiError(503, 'Impossible de vérifier le visuel sur GitHub.', 'GITHUB_READ');
    const response = await githubRequest(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: asset.path.startsWith('assets/store/') ? 'Add FITIA STORE product image' : 'Add FITIA announcement asset', content: asset.base64, branch })
    });
    if (!response.ok) throw new ApiError(503, 'La publication du visuel sur GitHub a été refusée.', 'GITHUB_WRITE');
  }

  async function saveLocalAsset(asset) {
    const directory = asset.path.startsWith('assets/store/') ? storeAssetDirectory : assetDirectory;
    const targetFile = path.join(directory, path.basename(asset.path));
    await fs.promises.mkdir(directory, { recursive: true });
    try {
      const stat = await fs.promises.stat(targetFile);
      if (stat.isFile()) return;
    } catch (_) { /* Le visuel sera créé ci-dessous. */ }
    const temporary = `${targetFile}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    await fs.promises.writeFile(temporary, asset.bytes, { mode: 0o600 });
    await fs.promises.rename(temporary, targetFile);
  }

  function enqueueMutation(task) {
    const result = mutationQueue.then(task);
    mutationQueue = result.catch(() => {});
    return result;
  }

  async function loadManifest(kind = 'announcements') {
    return localMode ? loadLocal(kind) : loadGitHub(kind);
  }

  async function publishAsset(payload, kind = 'announcement') {
    const validation = validateImagePayload(payload, { kind });
    if (!validation.ok) throw new ApiError(validation.status, validation.message, validation.code);
    const asset = validation.value;
    await enqueueMutation(() => (localMode ? saveLocalAsset(asset) : saveGitHubAsset(asset)));
    return { path: asset.path, contentType: asset.contentType, size: asset.size };
  }

  async function updateManifest(rawManifest, expectedRevision, kind = 'announcements') {
    const manifest = validateManifestKind(rawManifest, kind);
    if (typeof expectedRevision !== 'string' || !expectedRevision || expectedRevision.length > 128) {
      throw new ApiError(400, 'La révision du manifeste est requise.', 'REVISION');
    }
    return enqueueMutation(async () => {
      const current = await loadManifest(kind);
      if (current.revision !== expectedRevision) {
        throw new ApiError(409, `Les ${manifestName(kind)} ont changé ailleurs. Rechargez avant de réessayer.`, 'CONFLICT');
      }
      const revision = localMode ? await saveLocal(manifest, kind) : await saveGitHub(manifest, current.revision, kind);
      return { manifest, revision };
    });
  }

  const staticFiles = new Map([
    ['/', { file: path.join(ADMIN_DIR, 'index.html'), type: 'text/html; charset=utf-8' }],
    ['/index.html', { file: path.join(ADMIN_DIR, 'index.html'), type: 'text/html; charset=utf-8' }],
    ['/admin.css', { file: path.join(ADMIN_DIR, 'admin.css'), type: 'text/css; charset=utf-8' }],
    ['/admin.js', { file: path.join(ADMIN_DIR, 'admin.js'), type: 'application/javascript; charset=utf-8' }],
    ['/admin/admin.css', { file: path.join(ADMIN_DIR, 'admin.css'), type: 'text/css; charset=utf-8' }],
    ['/admin/admin.js', { file: path.join(ADMIN_DIR, 'admin.js'), type: 'application/javascript; charset=utf-8' }],
    ['/admin/games-admin.js', { file: path.join(ADMIN_DIR, 'games-admin.js'), type: 'application/javascript; charset=utf-8' }],
    ['/admin/store-admin.js', { file: path.join(ADMIN_DIR, 'store-admin.js'), type: 'application/javascript; charset=utf-8' }],
    ['/admin/orders-admin.js', { file: path.join(ADMIN_DIR, 'orders-admin.js'), type: 'application/javascript; charset=utf-8' }],
    ['/admin/farm-admin.js', { file: path.join(ADMIN_DIR, 'farm-admin.js'), type: 'application/javascript; charset=utf-8' }],
    ['/game-visibility-config.js', { file: path.join(ROOT, 'game-visibility-config.js'), type: 'application/javascript; charset=utf-8' }],
    ['/promotion-effects.js', { file: path.join(ROOT, 'promotion-effects.js'), type: 'application/javascript; charset=utf-8' }],
    ['/promotion-effects.css', { file: path.join(ROOT, 'promotion-effects.css'), type: 'text/css; charset=utf-8' }],
    ['/store-catalog.js', { file: path.join(ROOT, 'store-catalog.js'), type: 'application/javascript; charset=utf-8' }],
    ['/assets/icon-192.png', { file: path.join(ROOT, 'assets/icon-192.png'), type: 'image/png' }],
    ['/assets/avatars/team-1.svg', { file: path.join(ROOT, 'assets', 'avatars', 'team-1.svg'), type: 'image/svg+xml' }],
    ['/assets/avatars/team-2.svg', { file: path.join(ROOT, 'assets', 'avatars', 'team-2.svg'), type: 'image/svg+xml' }],
    ['/assets/avatars/team-3.svg', { file: path.join(ROOT, 'assets', 'avatars', 'team-3.svg'), type: 'image/svg+xml' }],
    ['/assets/lucky-wheel.svg', { file: path.join(ROOT, 'assets', 'lucky-wheel.svg'), type: 'image/svg+xml' }],
    ['/assets/dice.svg', { file: path.join(ROOT, 'assets', 'dice.svg'), type: 'image/svg+xml' }],
    ['/assets/mines.svg', { file: path.join(ROOT, 'assets', 'mines.svg'), type: 'image/svg+xml' }],
    ['/assets/crash.svg', { file: path.join(ROOT, 'assets', 'crash.svg'), type: 'image/svg+xml' }],
    ['/assets/coin-flip.svg', { file: path.join(ROOT, 'assets', 'coin-flip.svg'), type: 'image/svg+xml' }]
  ]);

  async function handleApi(req, res, pathname) {
    pathname = pathname.replace(/^\/api\/admin\//, '/api/');
    if (pathname === '/api/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const record = loginFailures.get(ip);
      if (record && record.resetAt > now && record.count >= MAX_LOGIN_FAILURES) {
        sendJson(res, 429, { error: 'Trop de tentatives. Réessayez plus tard.', code: 'RATE_LIMIT' }, { 'Retry-After': String(Math.ceil((record.resetAt - now) / 1000)) });
        return;
      }
      const body = await readJson(req);
      const validPassword = safeEqual(sha256(String(body.password || '')), sha256(password));
      if (!validPassword) {
        const next = record && record.resetAt > now ? record : { count: 0, resetAt: now + LOGIN_WINDOW_MS };
        next.count += 1;
        loginFailures.set(ip, next);
        sendJson(res, 401, { error: 'Mot de passe incorrect.', code: 'LOGIN' });
        return;
      }
      loginFailures.delete(ip);
      const session = {
        csrfToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: now + SESSION_TTL_MS
      };
      const id = crypto.randomBytes(32).toString('hex');
      sessions.set(id, session);
      const cookie = [
        `fitia_admin_session=${id}`,
        'HttpOnly',
        'SameSite=Strict',
        'Path=/',
        `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
        isSecureRequest(req) ? 'Secure' : ''
      ].filter(Boolean).join('; ');
      sendJson(res, 200, sessionPayload({ id, ...session }), { 'Set-Cookie': cookie });
      return;
    }

    if (pathname === '/api/session' && req.method === 'GET') {
      const session = requireSession(req, res);
      if (session) sendJson(res, 200, sessionPayload(session));
      return;
    }

    if (pathname === '/api/logout' && req.method === 'POST') {
      const session = requireSession(req, res);
      if (!session || !requireCsrf(req, res, session)) return;
      sessions.delete(session.id);
      sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'fitia_admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
      return;
    }

    if ((pathname === '/api/announcement-assets' || pathname === '/api/store-assets') && req.method === 'POST') {
      const session = requireSession(req, res);
      if (!session || !requireCsrf(req, res, session)) return;
      const body = await readJson(req, MAX_ANNOUNCEMENT_IMAGE_BODY_BYTES);
      const asset = await publishAsset(body, pathname.endsWith('/store-assets') ? 'store' : 'announcement');
      sendJson(res, 201, { asset, ...sourceInfo() });
      return;
    }

    if (pathname === '/api/store-orders' && req.method === 'GET') {
      const session = requireSession(req, res);
      if (!session) return;
      sendJson(res, 200, { orders: await orders().listAdminOrders(), serverTime: new Date().toISOString() });
      return;
    }

    if (pathname === '/api/store-orders' && req.method === 'PATCH') {
      const session = requireSession(req, res);
      if (!session || !requireCsrf(req, res, session)) return;
      const body = await readJson(req, MAX_BODY_BYTES);
      sendJson(res, 200, { order: await orders().updateAdminOrder(body) });
      return;
    }

    if (pathname === '/api/farm-withdrawals' && req.method === 'GET') {
      const session = requireSession(req, res);
      if (!session) return;
      sendJson(res, 200, { withdrawals: await farm().listWithdrawals(), serverTime: new Date().toISOString() });
      return;
    }

    if (pathname === '/api/farm-withdrawals' && req.method === 'PATCH') {
      const session = requireSession(req, res);
      if (!session || !requireCsrf(req, res, session)) return;
      const body = await readJson(req, MAX_BODY_BYTES);
      const result = await farm().completeWithdrawal(body);
      sendJson(res, result.pending ? 202 : 200, result);
      return;
    }

    if ((pathname === '/api/announcements' || pathname === '/api/promotions' || pathname === '/api/game-visibility' || pathname === '/api/store-products') && req.method === 'GET') {
      const session = requireSession(req, res);
      if (!session) return;
      const kind = pathname.endsWith('/store-products') ? 'store' : pathname.endsWith('/game-visibility') ? 'games' : pathname.endsWith('/promotions') ? 'promotions' : 'announcements';
      const result = await loadManifest(kind);
      sendJson(res, 200, { ...result, ...sourceInfo(), serverTime: new Date().toISOString() });
      return;
    }

    if ((pathname === '/api/announcements' || pathname === '/api/promotions' || pathname === '/api/game-visibility' || pathname === '/api/store-products') && req.method === 'PUT') {
      const session = requireSession(req, res);
      if (!session || !requireCsrf(req, res, session)) return;
      const kind = pathname.endsWith('/store-products') ? 'store' : pathname.endsWith('/game-visibility') ? 'games' : pathname.endsWith('/promotions') ? 'promotions' : 'announcements';
      const body = await readJson(req, kind === 'store' ? 2 * 1024 * 1024 : MAX_BODY_BYTES);
      const result = await updateManifest(body.manifest, body.revision, kind);
      sendJson(res, 200, { ...result, ...sourceInfo(), serverTime: new Date().toISOString() });
      return;
    }

    sendJson(res, 404, { error: 'Route API introuvable.', code: 'NOT_FOUND' });
  }

  const server = http.createServer(async (req, res) => {
    setSecurityHeaders(res);
    try {
      const parsed = new URL(req.url || '/', 'http://localhost');
      const pathname = parsed.pathname;
      if (pathname.startsWith('/api/')) {
        await handleApi(req, res, pathname);
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { error: 'Méthode non autorisée.', code: 'METHOD' });
        return;
      }
      let staticFile = staticFiles.get(pathname);
      const uploadedAsset = /^\/assets\/(announcements|store)\/((?:announcement|product)-[a-f0-9]{24}\.(png|jpg|webp))$/.exec(pathname);
      if (uploadedAsset) {
        const types = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
        const directory = uploadedAsset[1] === 'store' ? storeAssetDirectory : assetDirectory;
        staticFile = { file: path.join(directory, uploadedAsset[2]), type: types[uploadedAsset[3]] };
      }
      if (!staticFile) {
        sendJson(res, 404, { error: 'Page introuvable.', code: 'NOT_FOUND' });
        return;
      }
      const stat = await fs.promises.stat(staticFile.file);
      res.writeHead(200, {
        'Content-Type': staticFile.type,
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache'
      });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(staticFile.file).pipe(res);
    } catch (error) {
      if (res.headersSent || res.writableEnded) return;
      if (error instanceof ApiError || (Number.isSafeInteger(error.status) && error.code)) {
        sendJson(res, error.status, { error: error.message, code: error.code });
        return;
      }
      console.error('Admin server error:', error && error.code ? error.code : 'INTERNAL');
      sendJson(res, 500, { error: 'Une erreur interne est survenue.', code: 'INTERNAL' });
    }
  });

  server.on('close', () => sessions.clear());
  return server;
}

if (require.main === module) {
  const port = Number(process.env.FITIA_ADMIN_PORT || process.env.PORT || 8090);
  const server = createAdminServer();
  server.listen(port, '0.0.0.0', () => {
    console.log(`FITIA PRO Administration listening on 0.0.0.0:${port}`);
  });
}

module.exports = { createAdminServer, validateManifest, validatePromotionManifest, validateGameVisibilityManifest, ApiError };
