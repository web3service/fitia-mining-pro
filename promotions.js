// ═══════════════════════════════════════════════════════════════════
//  DÉCORATIONS PROMOTIONNELLES FITIA — effets saisonniers animés
//  Aucun prix ni paramètre d'achat n'est modifié par ce module.
// ═══════════════════════════════════════════════════════════════════
(() => {
  const MANIFEST_URL = 'https://raw.githubusercontent.com/web3service/fitia-mining-pro/main/promotions.json';
  const EFFECTS = window.FitiaPromotionEffects;
  const TARGET_TYPES = new Set(['machine', 'battery']);
  const VARIANTS = new Set(EFFECTS.VARIANTS);
  const LANGUAGES = ['fr', 'en', 'de', 'zh', 'sg'];

  class FitiaPromotionCenter {
    constructor(app) {
      this.app = app;
      this.items = [];
      this.initialized = false;
      this.fetchInFlight = false;
      this.lastFetchAt = 0;
      this.boundaryTimer = null;
    }

    init() {
      this.initialized = true;
    }

    cleanText(value, maxLength) {
      if (typeof value !== 'string') return '';
      return value
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
        .trim();
    }

    normalizeLocalizedText(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const localized = {};
      LANGUAGES.forEach((lang) => {
        const text = this.cleanText(value[lang], 32);
        if (text) localized[lang] = text;
      });
      return localized.fr || localized.en ? localized : null;
    }

    parseDate(value) {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'string') return undefined;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) ? timestamp : undefined;
    }

    normalizeManifest(raw, now = Date.now()) {
      if (!raw || raw.enabled !== true || !Array.isArray(raw.promotions)) return [];
      const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();
      const ids = new Set();
      const targets = new Set();
      const normalized = [];
      raw.promotions.slice(0, 50).forEach((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return;
        const id = this.cleanText(item.id, 64);
        const targetType = this.cleanText(item.targetType, 16).toLowerCase();
        const targetId = item.targetId;
        const variant = this.cleanText(item.variant, 16).toLowerCase();
        const animated = item.animated === undefined ? true : item.animated;
        const label = this.normalizeLocalizedText(item.label);
        const targetKey = `${targetType}:${targetId}`;
        if (!/^[a-z0-9._-]+$/.test(id) || ids.has(id) || targets.has(targetKey)) return;
        if (!TARGET_TYPES.has(targetType) || !Number.isSafeInteger(targetId) || targetId < 0 || targetId > 99) return;
        if (!VARIANTS.has(variant) || typeof animated !== 'boolean' || !label) return;
        const startsAt = this.parseDate(item.startsAt);
        const expiresAt = this.parseDate(item.expiresAt);
        if (startsAt === undefined || expiresAt === undefined) return;
        if (startsAt !== null && expiresAt !== null && expiresAt <= startsAt) return;
        if (startsAt !== null && startsAt > currentTime) return;
        if (expiresAt !== null && expiresAt <= currentTime) return;
        ids.add(id);
        targets.add(targetKey);
        normalized.push({ id, targetType, targetId, variant, animated, label, startsAt, expiresAt });
      });
      return normalized;
    }

    localizedText(value) {
      if (!value || typeof value !== 'object') return '';
      const lang = this.app.currentLang;
      return value[lang] || value.en || value.fr || '';
    }

    scheduleBoundaries(raw) {
      if (this.boundaryTimer !== null) window.clearTimeout(this.boundaryTimer);
      this.boundaryTimer = null;
      if (!raw || raw.enabled !== true || !Array.isArray(raw.promotions)) return;
      const now = Date.now();
      const boundaries = [];
      raw.promotions.slice(0, 50).forEach((item) => {
        if (!item || typeof item !== 'object') return;
        [item.startsAt, item.expiresAt].forEach((value) => {
          const timestamp = this.parseDate(value);
          if (typeof timestamp === 'number' && timestamp > now) boundaries.push(timestamp);
        });
      });
      if (!boundaries.length) return;
      const nextBoundary = Math.min(...boundaries);
      const delay = Math.min(Math.max(nextBoundary - now + 50, 100), 2147483647);
      this.boundaryTimer = window.setTimeout(() => {
        this.boundaryTimer = null;
        this.refresh({ force: true });
      }, delay);
    }

    find(targetType, targetId, now = Date.now()) {
      return this.items.find((item) => (
        item.targetType === targetType &&
        item.targetId === targetId &&
        (item.startsAt === null || item.startsAt <= now) &&
        (item.expiresAt === null || item.expiresAt > now)
      )) || null;
    }

    clear(card) {
      if (!card) return;
      card.classList.remove('shop-promo');
      VARIANTS.forEach((variant) => card.classList.remove(`shop-promo-${variant}`));
      card.removeAttribute('data-promotion-id');
      card.querySelectorAll(':scope > .shop-promo-label').forEach((element) => element.remove());
      EFFECTS.clear(card);
    }

    decorate(card, targetType, targetId) {
      if (!card) return;
      this.clear(card);
      if (!this.initialized) return;
      const promotion = this.find(targetType, targetId);
      if (!promotion) return;
      card.classList.add('shop-promo', `shop-promo-${promotion.variant}`);
      card.setAttribute('data-promotion-id', promotion.id);
      const label = card.ownerDocument.createElement('span');
      label.className = 'shop-promo-label';
      label.textContent = this.localizedText(promotion.label);
      label.setAttribute('aria-label', this.localizedText(promotion.label));
      card.appendChild(label);
      EFFECTS.decorate(card, promotion.variant, promotion.animated);
    }

    async refresh(options = {}) {
      if (this.fetchInFlight) return;
      const force = Boolean(options.force);
      if (!force && this.lastFetchAt && Date.now() - this.lastFetchAt < 30000) return;
      this.fetchInFlight = true;
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeout = window.setTimeout(() => controller?.abort(), 8000);
      try {
        const request = { cache: 'no-store', headers: { Accept: 'application/json' } };
        if (controller) request.signal = controller.signal;
        const response = await fetch(MANIFEST_URL, request);
        if (!response.ok) throw new Error('PROMOTIONS_UNAVAILABLE');
        const raw = await response.json();
        this.items = this.normalizeManifest(raw);
        this.scheduleBoundaries(raw);
        this.lastFetchAt = Date.now();
        if (this.app.mine && !this.app.isLoadingShop) await this.app.renderShop();
      } catch (_) {
        // En cas de coupure, les dernières décorations valides sont conservées,
        // mais une décoration qui vient d'expirer est retirée au rendu suivant.
        if (this.app.mine && !this.app.isLoadingShop) {
          try { await this.app.renderShop(); } catch (_) { /* La boutique réessaiera plus tard. */ }
        }
      } finally {
        window.clearTimeout(timeout);
        this.fetchInFlight = false;
      }
    }
  }

  window.FitiaPromotionCenter = FitiaPromotionCenter;
})();
