// ═══════════════════════════════════════════════════════════════════
//  CENTRE D'ANNONCES FITIA PRO — bannière permanente, sûre et hors ligne
// ═══════════════════════════════════════════════════════════════════
(() => {
  const MANIFEST_URL = 'https://raw.githubusercontent.com/web3service/fitia-mining-pro/main/announcements.json';
  const COPY = {
    fr: {
      region: 'Annonces officielles FITIA',
      categoryInformation: 'Information',
      categoryEvent: 'Événement',
      categoryReferral: 'Parrainage',
      categorySecurity: 'Sécurité',
      select: 'Afficher l’annonce',
      informationTitle: 'Annonces officielles',
      informationMessage: 'Retrouvez ici les nouveautés et informations importantes de FITIA PRO.',
      eventTitle: 'Événements FITIA',
      eventMessage: 'Les prochains événements officiels seront annoncés ici.',
      referralTitle: 'Parrainage FITIA',
      referralMessage: 'Retrouvez votre ID et partagez votre code depuis la section Parrainage.',
      securityTitle: 'Sécurité du portefeuille',
      securityMessage: 'Ne partagez jamais vos 12 mots, votre clé privée ou votre code PIN.'
    },
    en: {
      region: 'Official FITIA announcements',
      categoryInformation: 'Information',
      categoryEvent: 'Event',
      categoryReferral: 'Referral',
      categorySecurity: 'Security',
      select: 'Show announcement',
      informationTitle: 'Official announcements',
      informationMessage: 'Find FITIA PRO news and important information here.',
      eventTitle: 'FITIA events',
      eventMessage: 'Upcoming official events will be announced here.',
      referralTitle: 'FITIA referral',
      referralMessage: 'Find your ID and share your code in the Referral section.',
      securityTitle: 'Wallet security',
      securityMessage: 'Never share your 12 words, private key or PIN.'
    },
    de: {
      region: 'Offizielle FITIA-Ankündigungen',
      categoryInformation: 'Information',
      categoryEvent: 'Veranstaltung',
      categoryReferral: 'Empfehlung',
      categorySecurity: 'Sicherheit',
      select: 'Ankündigung anzeigen',
      informationTitle: 'Offizielle Ankündigungen',
      informationMessage: 'Hier finden Sie Neuigkeiten und wichtige Informationen zu FITIA PRO.',
      eventTitle: 'FITIA-Veranstaltungen',
      eventMessage: 'Die nächsten offiziellen Veranstaltungen werden hier angekündigt.',
      referralTitle: 'FITIA-Empfehlung',
      referralMessage: 'Ihre ID und Ihren Code finden Sie im Bereich Empfehlungen.',
      securityTitle: 'Wallet-Sicherheit',
      securityMessage: 'Teilen Sie niemals Ihre 12 Wörter, Ihren privaten Schlüssel oder Ihre PIN.'
    },
    zh: {
      region: 'FITIA 官方公告',
      categoryInformation: '信息',
      categoryEvent: '活动',
      categoryReferral: '推荐',
      categorySecurity: '安全',
      select: '查看公告',
      informationTitle: '官方公告',
      informationMessage: '在这里查看 FITIA PRO 的最新消息和重要信息。',
      eventTitle: 'FITIA 活动',
      eventMessage: '最新官方活动将在这里公布。',
      referralTitle: 'FITIA 推荐',
      referralMessage: '在推荐栏目中查找并分享您的推荐 ID。',
      securityTitle: '钱包安全',
      securityMessage: '切勿分享您的 12 个助记词、私钥或 PIN 码。'
    }
  };
  COPY.sg = COPY.en;

  class FitiaAnnouncementCenter {
    constructor(app) {
      this.app = app;
      this.items = [];
      this.index = 0;
      this.timer = null;
      this.fetchInFlight = false;
      this.initialized = false;
      this.localFallback = true;
      this.channelEnabled = true;
      this.lastFetchAt = 0;
      this.touchStart = null;
      this.gesturesBound = false;
    }

    t(key) {
      const lang = this.app.currentLang;
      return COPY[lang]?.[key] || COPY.en[key] || COPY.fr[key] || key;
    }

    defaults() {
      return [
        { id: 'official-news', category: 'information', title: this.t('informationTitle'), message: this.t('informationMessage') },
        { id: 'official-events', category: 'event', title: this.t('eventTitle'), message: this.t('eventMessage') },
        { id: 'official-referral', category: 'referral', title: this.t('referralTitle'), message: this.t('referralMessage') },
        { id: 'wallet-security', category: 'security', title: this.t('securityTitle'), message: this.t('securityMessage') }
      ];
    }

    init() {
      this.items = this.defaults();
      this.localFallback = true;
      this.channelEnabled = true;
      this.initialized = true;
      this.bindGestures();
      this.render();
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

    normalizeLocalizedText(value, maxLength) {
      if (typeof value === 'string') {
        const text = this.cleanText(value, maxLength);
        return text ? { fr: text, en: text } : null;
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const localized = {};
      ['fr', 'en', 'de', 'zh', 'sg'].forEach((lang) => {
        const text = this.cleanText(value[lang], maxLength);
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

    normalizeAssetPath(value, allowAvatarPresets = false) {
      if (typeof value !== 'string') return null;
      const clean = value.trim();
      if (clean.length > 160 || clean.includes('\\') || clean.includes('..')) return null;
      if (/^assets\/announcements\/announcement-[a-f0-9]{24}\.(png|jpg|webp)$/.test(clean)) return clean;
      if (allowAvatarPresets && /^assets\/avatars\/team-[123]\.svg$/.test(clean)) return clean;
      return null;
    }

    assetUrl(assetPath) {
      if (assetPath.startsWith('assets/avatars/')) return assetPath;
      return new URL(assetPath, MANIFEST_URL).href;
    }

    normalizeManifest(raw, now = Date.now()) {
      if (!raw || raw.enabled !== true || !Array.isArray(raw.announcements)) return [];
      const acceptedCategories = new Set(['information', 'event', 'referral', 'security']);
      const seenIds = new Set();
      const normalized = [];
      const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();

      raw.announcements.slice(0, 50).forEach((item) => {
        if (normalized.length >= 12 || !item || typeof item !== 'object') return;
        const id = this.cleanText(item.id, 64);
        const category = this.cleanText(item.category, 20).toLowerCase();
        if (!/^[a-z0-9._-]+$/.test(id) || seenIds.has(id) || !acceptedCategories.has(category)) return;
        const title = this.normalizeLocalizedText(item.title, 80);
        const message = this.normalizeLocalizedText(item.message, 180);
        if (!title || !message) return;
        const theme = item.theme === undefined ? 'classic' : item.theme;
        const font = item.font === undefined ? 'modern' : item.font;
        if (!['classic', 'aurora', 'gold', 'emerald', 'violet', 'celebration'].includes(theme)) return;
        if (!['modern', 'elegant', 'rounded', 'mono'].includes(font)) return;
        const backgroundImage = item.backgroundImage ? this.normalizeAssetPath(item.backgroundImage) : '';
        if (item.backgroundImage && !backgroundImage) return;
        const avatars = [];
        if (item.avatars !== undefined) {
          if (!Array.isArray(item.avatars) || item.avatars.length > 3) return;
          for (const candidate of item.avatars) {
            const avatar = this.normalizeAssetPath(candidate, true);
            if (!avatar || avatars.includes(avatar)) return;
            avatars.push(avatar);
          }
        }
        const startsAt = this.parseDate(item.startsAt);
        const expiresAt = this.parseDate(item.expiresAt);
        if (startsAt === undefined || expiresAt === undefined) return;
        if (startsAt !== null && startsAt > currentTime) return;
        if (expiresAt !== null && expiresAt <= currentTime) return;
        if (startsAt !== null && expiresAt !== null && expiresAt <= startsAt) return;
        seenIds.add(id);
        const normalizedItem = { id, category, title, message, theme, font, startsAt, expiresAt };
        if (backgroundImage) normalizedItem.backgroundImage = backgroundImage;
        if (avatars.length) normalizedItem.avatars = avatars;
        normalized.push(normalizedItem);
      });
      return normalized;
    }

    localizedText(value) {
      if (typeof value === 'string') return value;
      if (!value || typeof value !== 'object') return '';
      const lang = this.app.currentLang;
      return value[lang] || value.en || value.fr || '';
    }

    bindGestures() {
      if (this.gesturesBound) return;
      const track = document.getElementById('announcement-track');
      const viewport = document.getElementById('announcement-viewport');
      if (!track || !viewport) return;
      this.gesturesBound = true;

      track.addEventListener('transitionend', (event) => {
        if (event.propertyName !== 'transform' || this.index !== this.items.length) return;
        track.style.transition = 'none';
        this.index = 0;
        this.updatePosition();
        void track.offsetWidth;
        track.style.transition = '';
      });

      viewport.addEventListener('mouseenter', () => this.stop());
      viewport.addEventListener('mouseleave', () => this.start());
      viewport.addEventListener('touchstart', (event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        this.touchStart = { x: touch.clientX, y: touch.clientY };
        this.stop();
      }, { passive: true });
      viewport.addEventListener('touchend', (event) => {
        const touch = event.changedTouches[0];
        const start = this.touchStart;
        this.touchStart = null;
        if (touch && start) {
          const deltaX = touch.clientX - start.x;
          const deltaY = touch.clientY - start.y;
          if (Math.abs(deltaX) >= 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX < 0) this.next(true);
            else this.previous();
          }
        }
        this.start();
      }, { passive: true });
      viewport.addEventListener('touchcancel', () => {
        this.touchStart = null;
        this.start();
      }, { passive: true });
    }

    createSlide(item, isClone) {
      const slide = document.createElement('div');
      const theme = item.theme || 'classic';
      const font = item.font || 'modern';
      slide.className = `announcement-slide announcement-${item.category} announcement-theme-${theme} announcement-font-${font}`;
      slide.classList.toggle('has-background', Boolean(item.backgroundImage));
      slide.classList.toggle('has-avatars', Boolean(item.avatars?.length));
      if (item.backgroundImage) {
        slide.style.setProperty('--announcement-bg-image', `url(${JSON.stringify(this.assetUrl(item.backgroundImage))})`);
      }
      if (isClone) slide.setAttribute('aria-hidden', 'true');

      const artwork = document.createElement('img');
      artwork.className = 'announcement-artwork';
      artwork.src = 'assets/icon-192.png';
      artwork.alt = '';
      artwork.setAttribute('aria-hidden', 'true');

      const copy = document.createElement('div');
      copy.className = 'announcement-copy';
      const category = document.createElement('small');
      category.className = 'announcement-category';
      category.textContent = this.t(`category${item.category.charAt(0).toUpperCase()}${item.category.slice(1)}`);
      const title = document.createElement('strong');
      title.className = 'announcement-title';
      title.textContent = this.localizedText(item.title);
      const message = document.createElement('p');
      message.className = 'announcement-message';
      message.textContent = this.localizedText(item.message);
      copy.appendChild(category);
      copy.appendChild(title);
      copy.appendChild(message);
      slide.appendChild(artwork);
      slide.appendChild(copy);
      if (item.avatars?.length) {
        const avatarStack = document.createElement('div');
        avatarStack.className = 'announcement-avatars';
        avatarStack.setAttribute('aria-hidden', 'true');
        item.avatars.forEach((assetPath) => {
          const avatar = document.createElement('img');
          avatar.src = this.assetUrl(assetPath);
          avatar.alt = '';
          avatar.draggable = false;
          avatar.addEventListener('error', () => avatar.remove(), { once: true });
          avatarStack.appendChild(avatar);
        });
        slide.appendChild(avatarStack);
      }
      return slide;
    }

    render() {
      if (!this.initialized) return;
      const section = document.getElementById('announcement-center');
      const track = document.getElementById('announcement-track');
      const dots = document.getElementById('announcement-dots');
      if (!section || !track || !dots) return;
      if (this.localFallback && this.channelEnabled) this.items = this.defaults();
      if (!this.channelEnabled || !this.items.length) {
        this.stop();
        this.index = 0;
        section.classList.add('hidden');
        while (track.firstChild) track.removeChild(track.firstChild);
        while (dots.firstChild) dots.removeChild(dots.firstChild);
        dots.classList.add('hidden');
        track.style.transform = 'translate3d(0, 0, 0)';
        return;
      }
      section.classList.remove('hidden');
      if (this.index < 0 || this.index >= this.items.length) this.index = 0;
      section.setAttribute('aria-label', this.t('region'));

      while (track.firstChild) track.removeChild(track.firstChild);
      this.items.forEach((item) => track.appendChild(this.createSlide(item, false)));
      if (this.items.length > 1) track.appendChild(this.createSlide(this.items[0], true));

      while (dots.firstChild) dots.removeChild(dots.firstChild);
      this.items.forEach((item, itemIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'announcement-dot';
        button.setAttribute('aria-label', `${this.t('select')} ${itemIndex + 1}`);
        button.addEventListener('click', () => this.select(itemIndex));
        dots.appendChild(button);
      });
      dots.classList.toggle('hidden', this.items.length < 2);

      track.style.transition = 'none';
      this.updatePosition();
      void track.offsetWidth;
      track.style.transition = '';
    }

    updatePosition() {
      const track = document.getElementById('announcement-track');
      if (!track) return;
      track.style.transform = `translate3d(-${this.index * 100}%, 0, 0)`;
      const activeIndex = this.items.length ? this.index % this.items.length : 0;
      document.querySelectorAll('#announcement-dots .announcement-dot').forEach((dot, dotIndex) => {
        const active = dotIndex === activeIndex;
        dot.classList.toggle('active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
    }

    select(itemIndex) {
      if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= this.items.length) return;
      this.index = itemIndex;
      this.updatePosition();
      this.restart();
    }

    next(manual = false) {
      if (this.items.length < 2) return;
      this.index += 1;
      this.updatePosition();
      if (manual) this.restart();
    }

    previous() {
      if (this.items.length < 2) return;
      this.index = (this.index - 1 + this.items.length) % this.items.length;
      this.updatePosition();
      this.restart();
    }

    start() {
      if (this.timer || !this.channelEnabled || !this.app.user || this.items.length < 2 || document.hidden) return;
      const dashboard = document.getElementById('view-dashboard');
      if (!dashboard?.classList.contains('active')) return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      this.timer = window.setInterval(() => this.next(false), 8000);
    }

    stop() {
      if (!this.timer) return;
      window.clearInterval(this.timer);
      this.timer = null;
    }

    restart() {
      this.stop();
      this.start();
    }

    async refresh({ force = true } = {}) {
      if (this.fetchInFlight) return;
      if (!force && this.lastFetchAt && Date.now() - this.lastFetchAt < 60000) return;
      this.fetchInFlight = true;
      this.lastFetchAt = Date.now();
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeout = window.setTimeout(() => controller?.abort(), 8000);
      try {
        const options = { cache: 'no-store', headers: { Accept: 'application/json' } };
        if (controller) options.signal = controller.signal;
        const response = await fetch(MANIFEST_URL, options);
        if (!response.ok) throw new Error('ANNOUNCEMENTS_UNAVAILABLE');
        const manifest = await response.json();
        if (!manifest || typeof manifest.enabled !== 'boolean' || !Array.isArray(manifest.announcements)) {
          throw new Error('ANNOUNCEMENTS_INVALID');
        }
        const enabled = manifest.enabled;
        const remoteItems = enabled ? this.normalizeManifest(manifest) : [];
        const currentId = this.items.length ? this.items[this.index % this.items.length]?.id : null;
        const preservedIndex = remoteItems.findIndex((item) => item.id === currentId);
        this.stop();
        this.channelEnabled = enabled;
        this.items = remoteItems;
        this.localFallback = false;
        this.index = preservedIndex >= 0 ? preservedIndex : 0;
        this.render();
        this.start();
      } catch (_) {
        // Hors ligne, conserver les annonces locales ou le dernier manifeste valide.
      } finally {
        window.clearTimeout(timeout);
        this.fetchInFlight = false;
      }
    }
  }

  window.FitiaAnnouncementCenter = FitiaAnnouncementCenter;
})();
