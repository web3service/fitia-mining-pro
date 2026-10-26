'use strict';

const crypto = require('crypto');

const MAX_ANNOUNCEMENT_IMAGE_BYTES = 1536 * 1024;
const MAX_ANNOUNCEMENT_IMAGE_BODY_BYTES = 2200 * 1024;
const ANNOUNCEMENT_THEMES = Object.freeze(['classic', 'aurora', 'gold', 'emerald', 'violet', 'celebration']);
const ANNOUNCEMENT_FONTS = Object.freeze(['modern', 'elegant', 'rounded', 'mono']);
const ANNOUNCEMENT_AVATAR_PRESETS = Object.freeze([
  'assets/avatars/team-1.svg',
  'assets/avatars/team-2.svg',
  'assets/avatars/team-3.svg'
]);
const UPLOADED_ASSET_PATTERN = /^assets\/announcements\/announcement-[a-f0-9]{24}\.(?:png|jpg|webp)$/;

function normalizeAssetPath(value, { allowAvatarPresets = false } = {}) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (clean.length > 160 || clean.includes('\\') || clean.includes('..')) return null;
  if (UPLOADED_ASSET_PATTERN.test(clean)) return clean;
  if (allowAvatarPresets && ANNOUNCEMENT_AVATAR_PRESETS.includes(clean)) return clean;
  return null;
}

function normalizeAppearance(item) {
  const theme = item.theme === undefined ? 'classic' : item.theme;
  const font = item.font === undefined ? 'modern' : item.font;
  if (!ANNOUNCEMENT_THEMES.includes(theme)) {
    return { ok: false, status: 400, code: 'THEME', message: 'Thème d’annonce non autorisé.' };
  }
  if (!ANNOUNCEMENT_FONTS.includes(font)) {
    return { ok: false, status: 400, code: 'FONT', message: 'Police d’annonce non autorisée.' };
  }

  const appearance = { theme, font };
  if (item.backgroundImage !== undefined && item.backgroundImage !== '') {
    const backgroundImage = normalizeAssetPath(item.backgroundImage);
    if (!backgroundImage) {
      return { ok: false, status: 400, code: 'BACKGROUND', message: 'Image d’arrière-plan non autorisée.' };
    }
    appearance.backgroundImage = backgroundImage;
  }

  if (item.avatars !== undefined) {
    if (!Array.isArray(item.avatars) || item.avatars.length > 3) {
      return { ok: false, status: 400, code: 'AVATARS', message: 'Une annonce accepte au maximum trois avatars.' };
    }
    const avatars = [];
    for (const candidate of item.avatars) {
      const avatar = normalizeAssetPath(candidate, { allowAvatarPresets: true });
      if (!avatar || avatars.includes(avatar)) {
        return { ok: false, status: 400, code: 'AVATARS', message: 'Avatar non autorisé ou dupliqué.' };
      }
      avatars.push(avatar);
    }
    if (avatars.length) appearance.avatars = avatars;
  }

  return { ok: true, value: appearance };
}

function detectImage(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { contentType: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  return null;
}

function validateImagePayload(payload, options = {}) {
  const imageKind = options.kind === 'store' ? 'store' : 'announcement';
  if (!payload || typeof payload !== 'object' || typeof payload.data !== 'string') {
    return { ok: false, status: 400, code: 'IMAGE_DATA', message: 'Image base64 requise.' };
  }
  const data = payload.data;
  if (!data.length || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    return { ok: false, status: 400, code: 'IMAGE_DATA', message: 'Encodage base64 invalide.' };
  }
  if (data.length > Math.ceil(MAX_ANNOUNCEMENT_IMAGE_BYTES / 3) * 4) {
    return { ok: false, status: 413, code: 'IMAGE_SIZE', message: 'Image trop volumineuse (1,5 Mo maximum).' };
  }
  const bytes = Buffer.from(data, 'base64');
  if (!bytes.length || bytes.length > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
    return { ok: false, status: 413, code: 'IMAGE_SIZE', message: 'Image trop volumineuse (1,5 Mo maximum).' };
  }
  const detected = detectImage(bytes);
  if (!detected) {
    return { ok: false, status: 415, code: 'IMAGE_FORMAT', message: 'Formats autorisés : PNG, JPEG et WebP.' };
  }
  if (payload.contentType !== undefined && payload.contentType !== detected.contentType) {
    return { ok: false, status: 415, code: 'IMAGE_TYPE', message: 'Le type déclaré ne correspond pas au contenu de l’image.' };
  }
  const digest = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 24);
  return {
    ok: true,
    value: {
      bytes,
      base64: data,
      contentType: detected.contentType,
      size: bytes.length,
      path: imageKind === 'store'
        ? `assets/store/product-${digest}.${detected.extension}`
        : `assets/announcements/announcement-${digest}.${detected.extension}`
    }
  };
}

module.exports = {
  MAX_ANNOUNCEMENT_IMAGE_BYTES,
  MAX_ANNOUNCEMENT_IMAGE_BODY_BYTES,
  ANNOUNCEMENT_THEMES,
  ANNOUNCEMENT_FONTS,
  ANNOUNCEMENT_AVATAR_PRESETS,
  normalizeAssetPath,
  normalizeAppearance,
  validateImagePayload
};
