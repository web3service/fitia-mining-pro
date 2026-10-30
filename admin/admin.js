(() => {
  'use strict';

  const LANGUAGES = ['fr', 'en', 'de', 'zh', 'sg'];
  const CATEGORY_LABELS = {
    event: 'Événement',
    information: 'Information',
    referral: 'Parrainage',
    security: 'Sécurité'
  };
  const AVATAR_PRESETS = ['assets/avatars/team-1.svg', 'assets/avatars/team-2.svg', 'assets/avatars/team-3.svg'];
  const MAX_IMAGE_BYTES = 1536 * 1024;
  const ANNOUNCEMENT_TEMPLATES = {
    'maintenance-thanks': {
      category: 'event',
      theme: 'celebration',
      font: 'elegant',
      avatars: AVATAR_PRESETS,
      title: {
        fr: 'Merci pour votre patience',
        en: 'Thank you for your patience',
        de: 'Danke für Ihre Geduld',
        zh: '感谢您的耐心等待',
        sg: 'Thank you for your patience'
      },
      message: {
        fr: 'La maintenance est terminée. FITIA PRO est de nouveau disponible. Merci pour votre confiance et votre fidélité.',
        en: 'Maintenance is complete. FITIA PRO is available again. Thank you for your trust and continued support.',
        de: 'Die Wartung ist abgeschlossen. FITIA PRO ist wieder verfügbar. Vielen Dank für Ihr Vertrauen und Ihre Treue.',
        zh: '维护已完成，FITIA PRO 已恢复使用。感谢您的信任与一如既往的支持。',
        sg: 'Maintenance is complete. FITIA PRO is available again. Thank you for your trust and continued support.'
      }
    },
    'update-thanks': {
      category: 'event',
      theme: 'celebration',
      font: 'elegant',
      avatars: AVATAR_PRESETS,
      title: {
        fr: 'Merci pour votre confiance',
        en: 'Thank you for your trust',
        de: 'Danke für Ihr Vertrauen',
        zh: '感谢您的信任',
        sg: 'Thank you for your trust'
      },
      message: {
        fr: 'La mise à jour est terminée. Merci de continuer votre aventure avec FITIA PRO.',
        en: 'The update is complete. Thank you for continuing your journey with FITIA PRO.',
        de: 'Das Update ist abgeschlossen. Vielen Dank, dass Sie FITIA PRO weiterhin nutzen.',
        zh: '更新已完成。感谢您继续与 FITIA PRO 同行。',
        sg: 'The update is complete. Thank you for continuing your journey with FITIA PRO.'
      }
    }
  };
  const STATUS_LABELS = { active: 'Active', scheduled: 'Programmée', expired: 'Expirée', disabled: 'Désactivée' };
  const SHOP_ITEM_NAMES = ['STARTER', 'STANDARD', 'ADVANCED', 'PRO', 'ELITE', 'ULTRA', 'SUPREME', 'LEGEND'];
  const PROMOTION_VARIANT_LABELS = {
    gift: 'Cadeau emballé',
    bells: 'Cloches de Noël',
    snow: 'Neige et flocons',
    confetti: 'Confettis et célébration',
    fireworks: 'Feux d’artifice — Nouvel An',
    hearts: 'Cœurs — Saint-Valentin',
    blossom: 'Fleurs — Printemps',
    halloween: 'Citrouille — Halloween',
    badge: 'Badge promotionnel'
  };
  const state = {
    csrfToken: '',
    mode: 'local',
    project: null,
    branch: null,
    manifest: null,
    revision: '',
    promotionManifest: null,
    promotionRevision: '',
    lastSync: null,
    editingId: null,
    editingPromotionId: null,
    editorEnabled: true,
    editorBackground: '',
    editorAvatars: [],
    editorAssetData: {},
    editorSession: 0,
    assetUploads: 0,
    saving: false,
    promotionSaving: false,
    section: 'dashboard'
  };

  let gamesAdmin = null;
  let storeAdmin = null;
  let ordersAdmin = null;
  let farmAdmin = null;
  const byId = (id) => document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const localized = (value) => value?.fr || value?.en || '';

  function generateId(category) {
    let suffix;
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      suffix = globalThis.crypto.randomUUID().slice(0, 8);
    } else {
      const random = new Uint8Array(4);
      globalThis.crypto.getRandomValues(random);
      suffix = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    return `${category}-${Date.now().toString(36)}-${suffix}`;
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function toInputDate(value) {
    if (!value) return '';
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function fromInputDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function announcementStatus(item, now = Date.now()) {
    if (item.enabled === false) return 'disabled';
    if (item.startsAt && Date.parse(item.startsAt) > now) return 'scheduled';
    if (item.expiresAt && Date.parse(item.expiresAt) <= now) return 'expired';
    return 'active';
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    byId('toast-container').appendChild(toast);
    window.setTimeout(() => toast.remove(), 4500);
  }

  function setLoading(active, label = 'Synchronisation…') {
    byId('loading-label').textContent = label;
    byId('loading-overlay').classList.toggle('hidden', !active);
  }

  function setConnection(status) {
    const element = byId('connection-status');
    element.classList.remove('online', 'offline');
    if (status) element.classList.add(status);
    const label = status === 'online' ? 'Synchronisé' : status === 'offline' ? 'Non synchronisé' : 'Connexion…';
    element.textContent = '';
    const dot = document.createElement('span');
    element.appendChild(dot);
    element.appendChild(document.createTextNode(` ${label}`));
  }

  function updateSource(session) {
    state.csrfToken = session.csrfToken || state.csrfToken;
    state.mode = session.mode || state.mode;
    state.project = session.project ?? null;
    state.branch = session.branch ?? null;
    const isLocal = state.mode === 'local';
    const shortLabel = isLocal ? 'Mode local — essais uniquement' : `${state.project} · ${state.branch}`;
    byId('sidebar-mode').textContent = shortLabel;
    byId('dashboard-source').textContent = isLocal
      ? 'Fichier local du serveur d’administration'
      : `${state.project} / announcements.json (${state.branch})`;
    byId('save-announcement').textContent = isLocal ? 'Enregistrer en local' : 'Publier l’annonce';
    byId('save-promotion').textContent = isLocal ? 'Enregistrer en local' : 'Publier la décoration';
  }

  async function api(pathname, options = {}) {
    const method = options.method || 'GET';
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && pathname !== '/api/admin/login' && state.csrfToken) {
      headers['X-CSRF-Token'] = state.csrfToken;
    }
    const response = await fetch(pathname, {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    let data = {};
    try { data = await response.json(); } catch (_) { /* Réponse JSON vide ou invalide. */ }
    if (response.status === 401 && pathname !== '/api/admin/login') {
      showLogin();
      const error = new Error('Votre session a expiré. Reconnectez-vous.');
      error.code = 'AUTH_REQUIRED';
      error.status = 401;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(data.error || 'La requête a échoué.');
      error.code = data.code || 'ERROR';
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function showLogin() {
    state.manifest = null;
    state.revision = '';
    state.promotionManifest = null;
    state.promotionRevision = '';
    state.editingPromotionId = null;
    if (gamesAdmin) gamesAdmin.reset();
    if (storeAdmin) storeAdmin.reset();
    if (ordersAdmin) ordersAdmin.reset();
    if (farmAdmin) farmAdmin.reset();
    state.csrfToken = '';
    byId('admin-view').classList.add('hidden');
    byId('login-view').classList.remove('hidden');
    byId('login-password').value = '';
    byId('login-password').focus();
  }

  async function showAdmin(session) {
    updateSource(session);
    byId('login-view').classList.add('hidden');
    byId('admin-view').classList.remove('hidden');
    await loadData();
  }

  async function loadData(options = {}) {
    if (!options.quiet) setLoading(true, 'Chargement du contenu…');
    byId('list-error').classList.add('hidden');
    byId('promotions-list-error').classList.add('hidden');
    byId('store-list-error').classList.add('hidden');
    gamesAdmin.showError(null);
    try {
      const [announcementResult, promotionResult, gamesResult, storeResult] = await Promise.allSettled([
        api('/api/admin/announcements'),
        api('/api/admin/promotions'),
        gamesAdmin.load(),
        storeAdmin.load()
      ]);
      const errors = [];
      if (announcementResult.status === 'fulfilled') {
        state.manifest = announcementResult.value.manifest;
        state.revision = announcementResult.value.revision;
        updateSource(announcementResult.value);
      } else {
        errors.push(announcementResult.reason);
        if (announcementResult.reason.code !== 'AUTH_REQUIRED') {
          byId('list-error').textContent = announcementResult.reason.message;
          byId('list-error').classList.remove('hidden');
        }
      }
      if (promotionResult.status === 'fulfilled') {
        state.promotionManifest = promotionResult.value.manifest;
        state.promotionRevision = promotionResult.value.revision;
        if (announcementResult.status !== 'fulfilled') updateSource(promotionResult.value);
      } else {
        errors.push(promotionResult.reason);
        if (promotionResult.reason.code !== 'AUTH_REQUIRED') {
          byId('promotions-list-error').textContent = promotionResult.reason.message;
          byId('promotions-list-error').classList.remove('hidden');
        }
      }
      if (gamesResult.status === 'fulfilled') {
        if (announcementResult.status !== 'fulfilled' && promotionResult.status !== 'fulfilled') updateSource(gamesResult.value);
      } else {
        errors.push(gamesResult.reason);
        if (gamesResult.reason.code !== 'AUTH_REQUIRED') gamesAdmin.showError(gamesResult.reason);
      }
      if (storeResult.status === 'fulfilled') {
        if (announcementResult.status !== 'fulfilled' && promotionResult.status !== 'fulfilled' && gamesResult.status !== 'fulfilled') updateSource(storeResult.value);
      } else {
        errors.push(storeResult.reason);
        storeAdmin.showError(storeResult.reason);
      }
      if ([announcementResult, promotionResult, gamesResult, storeResult].some((result) => result.status === 'fulfilled')) state.lastSync = new Date();
      renderAll();
      setConnection(errors.length ? 'offline' : 'online');
      const visibleErrors = errors.filter((error) => error.code !== 'AUTH_REQUIRED');
      if (visibleErrors.length) showToast(visibleErrors.map((error) => error.message).join(' · '), 'error');
    } finally {
      if (!options.quiet) setLoading(false);
    }
  }

  async function saveManifest(nextManifest, successMessage) {
    if (state.saving || !state.manifest) return false;
    state.saving = true;
    setLoading(true, state.mode === 'github' ? 'Publication dans le wallet…' : 'Enregistrement local…');
    try {
      const data = await api('/api/admin/announcements', {
        method: 'PUT',
        body: { manifest: nextManifest, revision: state.revision }
      });
      state.manifest = data.manifest;
      state.revision = data.revision;
      state.lastSync = new Date();
      updateSource(data);
      renderAll();
      setConnection('online');
      showToast(successMessage);
      return true;
    } catch (error) {
      if (error.code !== 'AUTH_REQUIRED') {
        showToast(error.message, 'error');
        byId('list-error').textContent = error.message;
        byId('list-error').classList.remove('hidden');
      }
      if (error.code === 'CONFLICT') await loadData({ quiet: true });
      return false;
    } finally {
      state.saving = false;
      setLoading(false);
    }
  }

  async function savePromotions(nextManifest, successMessage) {
    if (state.promotionSaving || !state.promotionManifest) return false;
    state.promotionSaving = true;
    setLoading(true, state.mode === 'github' ? 'Publication dans le wallet…' : 'Enregistrement local…');
    try {
      const data = await api('/api/admin/promotions', {
        method: 'PUT',
        body: { manifest: nextManifest, revision: state.promotionRevision }
      });
      state.promotionManifest = data.manifest;
      state.promotionRevision = data.revision;
      state.lastSync = new Date();
      updateSource(data);
      renderAll();
      setConnection('online');
      showToast(successMessage);
      return true;
    } catch (error) {
      if (error.code !== 'AUTH_REQUIRED') {
        showToast(error.message, 'error');
        byId('promotions-list-error').textContent = error.message;
        byId('promotions-list-error').classList.remove('hidden');
      }
      if (error.code === 'CONFLICT') await loadData({ quiet: true });
      return false;
    } finally {
      state.promotionSaving = false;
      setLoading(false);
    }
  }

  function renderAll() {
    if (state.manifest) {
      renderDashboard();
      renderDistribution();
      renderAnnouncements();
    }
    if (state.promotionManifest) renderPromotions();
    if (gamesAdmin) gamesAdmin.render();
    if (storeAdmin) storeAdmin.render();
  }

  function renderDashboard() {
    const items = state.manifest.announcements;
    const counts = { active: 0, scheduled: 0, expired: 0, disabled: 0 };
    items.forEach((item) => { counts[announcementStatus(item)] += 1; });
    byId('stat-active').textContent = String(counts.active);
    byId('stat-scheduled').textContent = String(counts.scheduled);
    byId('stat-expired').textContent = String(counts.expired);
    byId('stat-total').textContent = String(items.length);
    const enabled = byId('dashboard-enabled');
    enabled.textContent = state.manifest.enabled ? 'Canal activé' : 'Canal désactivé';
    enabled.className = `status-pill ${state.manifest.enabled ? 'status-active' : 'status-disabled'}`;
    byId('dashboard-sync').textContent = state.lastSync ? formatDate(state.lastSync.toISOString()) : '—';
  }

  function renderDistribution() {
    byId('manifest-enabled').checked = state.manifest.enabled;
    byId('manifest-enabled-label').textContent = state.manifest.enabled ? 'Activée' : 'Désactivée';
  }

  function matchesFilters(item) {
    const search = byId('search-input').value.trim().toLowerCase();
    const category = byId('category-filter').value;
    const status = byId('status-filter').value;
    if (category !== 'all' && item.category !== category) return false;
    if (status !== 'all' && announcementStatus(item) !== status) return false;
    if (!search) return true;
    const searchable = [item.id, ...Object.values(item.title), ...Object.values(item.message)].join(' ').toLowerCase();
    return searchable.includes(search);
  }

  function makeButton(label, className, handler, disabled = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener('click', handler);
    return button;
  }

  function renderAnnouncements() {
    const list = byId('announcements-list');
    list.textContent = '';
    const allItems = state.manifest.announcements;
    const visibleItems = allItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => matchesFilters(item));
    byId('empty-state').classList.toggle('hidden', visibleItems.length > 0);

    visibleItems.forEach(({ item, index }) => {
      const status = announcementStatus(item);
      const row = document.createElement('article');
      row.className = `announcement-row${item.enabled === false ? ' is-disabled' : ''}`;
      row.dataset.announcementId = item.id;

      const order = document.createElement('div');
      order.className = 'order-controls';
      const up = makeButton('Haut', 'icon-button small order-button', () => moveAnnouncement(index, -1), index === 0);
      up.setAttribute('aria-label', `Faire monter ${localized(item.title)}`);
      const down = makeButton('Bas', 'icon-button small order-button', () => moveAnnouncement(index, 1), index === allItems.length - 1);
      down.setAttribute('aria-label', `Faire descendre ${localized(item.title)}`);
      order.append(up, down);

      const main = document.createElement('div');
      main.className = 'announcement-main';
      const meta = document.createElement('div');
      meta.className = 'announcement-meta';
      const category = document.createElement('span');
      category.className = `category-badge category-${item.category}`;
      category.textContent = CATEGORY_LABELS[item.category];
      const statusBadge = document.createElement('span');
      statusBadge.className = `status-pill status-${status}`;
      statusBadge.textContent = STATUS_LABELS[status];
      const languages = document.createElement('span');
      languages.className = 'announcement-languages';
      languages.textContent = Object.keys(item.title).join(' · ').toUpperCase();
      meta.append(category, statusBadge, languages);
      const title = document.createElement('h3');
      title.textContent = localized(item.title);
      const message = document.createElement('p');
      message.textContent = localized(item.message);
      const dates = document.createElement('div');
      dates.className = 'announcement-dates';
      const start = document.createElement('span');
      start.textContent = item.startsAt ? `Début : ${formatDate(item.startsAt)}` : 'Début : immédiat';
      const end = document.createElement('span');
      end.textContent = item.expiresAt ? `Fin : ${formatDate(item.expiresAt)}` : 'Fin : aucune';
      dates.append(start, end);
      main.append(meta, title, message, dates);

      const actions = document.createElement('div');
      actions.className = 'announcement-actions';
      const toggle = makeButton(
        item.enabled === false ? 'Réactiver' : 'Désactiver',
        'button button-secondary action-button announcement-toggle',
        () => toggleAnnouncement(item)
      );
      toggle.dataset.announcementToggle = item.id;
      toggle.setAttribute('aria-pressed', String(item.enabled !== false));
      actions.append(
        makeButton('Modifier', 'button button-quiet action-button', () => openEditor(item)),
        makeButton('Dupliquer', 'button button-quiet action-button', () => openEditor(item, { duplicate: true })),
        toggle,
        makeButton('Supprimer', 'button button-danger action-button', () => deleteAnnouncement(item))
      );
      row.append(order, main, actions);
      list.appendChild(row);
    });
  }

  async function moveAnnouncement(index, delta) {
    const next = clone(state.manifest);
    const target = index + delta;
    if (target < 0 || target >= next.announcements.length) return;
    const [item] = next.announcements.splice(index, 1);
    next.announcements.splice(target, 0, item);
    await saveManifest(next, 'Ordre des annonces mis à jour.');
  }

  async function toggleAnnouncement(item) {
    const next = clone(state.manifest);
    const savedItem = next.announcements.find((candidate) => candidate.id === item.id);
    if (!savedItem) return;
    savedItem.enabled = savedItem.enabled === false;
    await saveManifest(next, savedItem.enabled ? 'Annonce réactivée dans le wallet.' : 'Annonce désactivée et conservée dans l’admin.');
  }

  async function deleteAnnouncement(item) {
    if (!window.confirm(`Supprimer « ${localized(item.title)} » ?`)) return;
    const next = clone(state.manifest);
    next.announcements = next.announcements.filter((candidate) => candidate.id !== item.id);
    await saveManifest(next, 'Annonce supprimée.');
  }

  function promotionTargetLabel(item) {
    return `${item.targetType === 'machine' ? 'Machine' : 'Batterie'} n°${item.targetId + 1}`;
  }

  function renderShopVisibility() {
    const container = byId('shop-visibility-list');
    container.textContent = '';
    const hidden = state.promotionManifest.hiddenShopItems || { machine: [], battery: [] };
    [
      { type: 'machine', title: 'Machines', noun: 'Machine' },
      { type: 'battery', title: 'Batteries', noun: 'Batterie' }
    ].forEach((group) => {
      const section = document.createElement('section');
      section.className = 'shop-visibility-group';
      const heading = document.createElement('h3');
      heading.textContent = group.title;
      const grid = document.createElement('div');
      grid.className = 'shop-visibility-grid';
      for (let targetId = 0; targetId < 8; targetId += 1) {
        const isVisible = !hidden[group.type]?.includes(targetId);
        const row = document.createElement('div');
        row.className = `shop-visibility-item${isVisible ? '' : ' is-hidden'}`;
        row.dataset.shopVisibility = `${group.type}:${targetId}`;
        const copy = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = group.type === 'machine' ? `${targetId + 1} · ${SHOP_ITEM_NAMES[targetId]}` : `${group.noun} ${targetId + 1}`;
        const status = document.createElement('small');
        status.textContent = isVisible ? 'Visible dans la Boutique' : 'Masquée dans la Boutique';
        copy.append(name, status);
        const control = document.createElement('label');
        control.className = 'switch-control shop-visibility-switch';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = isVisible;
        input.dataset.shopVisibilityToggle = `${group.type}:${targetId}`;
        input.setAttribute('aria-label', `${isVisible ? 'Masquer' : 'Réactiver'} ${group.noun.toLowerCase()} ${targetId + 1}`);
        const track = document.createElement('span');
        track.className = 'switch-track';
        track.setAttribute('aria-hidden', 'true');
        control.append(input, track);
        input.addEventListener('change', () => toggleShopItemVisibility(group.type, targetId, input.checked));
        row.append(copy, control);
        grid.appendChild(row);
      }
      section.append(heading, grid);
      container.appendChild(section);
    });
  }

  async function toggleShopItemVisibility(targetType, targetId, visible) {
    const next = clone(state.promotionManifest);
    next.hiddenShopItems = next.hiddenShopItems || { machine: [], battery: [] };
    const values = new Set(Array.isArray(next.hiddenShopItems[targetType]) ? next.hiddenShopItems[targetType] : []);
    if (visible) values.delete(targetId);
    else values.add(targetId);
    next.hiddenShopItems[targetType] = [...values].sort((a, b) => a - b);
    const label = `${targetType === 'machine' ? 'Machine' : 'Batterie'} ${targetId + 1}`;
    const success = await savePromotions(next, visible ? `${label} réactivée dans la Boutique.` : `${label} masquée dans la Boutique.`);
    if (!success) renderShopVisibility();
  }

  function renderPromotions() {
    if (!state.promotionManifest) return;
    renderShopVisibility();
    byId('promotions-enabled').checked = state.promotionManifest.enabled;
    byId('promotions-enabled-label').textContent = state.promotionManifest.enabled ? 'Activé' : 'Désactivé';
    const list = byId('promotions-list');
    list.textContent = '';
    const items = state.promotionManifest.promotions;
    byId('promotions-empty').classList.toggle('hidden', items.length > 0);
    items.forEach((item) => {
      const status = announcementStatus(item);
      const row = document.createElement('article');
      row.className = `announcement-row promotion-row promotion-${item.variant}`;
      row.dataset.promotionId = item.id;

      const symbol = document.createElement('div');
      symbol.className = `promotion-symbol promotion-symbol-${item.variant}`;
      if (item.animated === false) symbol.classList.add('promotion-effect-static');
      symbol.setAttribute('aria-hidden', 'true');
      symbol.appendChild(window.FitiaPromotionEffects.createIcon(document, item.variant));

      const main = document.createElement('div');
      main.className = 'announcement-main';
      const meta = document.createElement('div');
      meta.className = 'announcement-meta';
      const variant = document.createElement('span');
      variant.className = `category-badge promotion-variant-${item.variant}`;
      variant.textContent = PROMOTION_VARIANT_LABELS[item.variant] || item.variant;
      const statusBadge = document.createElement('span');
      statusBadge.className = `status-pill status-${status}`;
      statusBadge.textContent = STATUS_LABELS[status];
      const languages = document.createElement('span');
      languages.className = 'announcement-languages';
      languages.textContent = Object.keys(item.label).join(' · ').toUpperCase();
      const animationState = document.createElement('span');
      animationState.className = 'announcement-languages';
      animationState.textContent = item.animated === false ? 'STATIQUE' : 'ANIMÉ';
      meta.append(variant, statusBadge, languages, animationState);
      const title = document.createElement('h3');
      title.textContent = promotionTargetLabel(item);
      const label = document.createElement('p');
      label.textContent = localized(item.label);
      const dates = document.createElement('div');
      dates.className = 'announcement-dates';
      const start = document.createElement('span');
      start.textContent = item.startsAt ? `Début : ${formatDate(item.startsAt)}` : 'Début : immédiat';
      const end = document.createElement('span');
      end.textContent = item.expiresAt ? `Fin : ${formatDate(item.expiresAt)}` : 'Fin : aucune';
      dates.append(start, end);
      main.append(meta, title, label, dates);

      const actions = document.createElement('div');
      actions.className = 'announcement-actions';
      actions.append(
        makeButton('Modifier', 'button button-quiet action-button', () => openPromotionEditor(item)),
        makeButton('Supprimer', 'button button-danger action-button', () => deletePromotion(item))
      );
      row.append(symbol, main, actions);
      list.appendChild(row);
    });
  }

  async function deletePromotion(item) {
    if (!window.confirm(`Supprimer la décoration de ${promotionTargetLabel(item)} ?`)) return;
    const next = clone(state.promotionManifest);
    next.promotions = next.promotions.filter((candidate) => candidate.id !== item.id);
    await savePromotions(next, 'Décoration supprimée.');
  }

  function setSection(section) {
    state.section = section;
    byId('section-dashboard').classList.toggle('hidden', section !== 'dashboard');
    byId('section-announcements').classList.toggle('hidden', section !== 'announcements');
    byId('section-promotions').classList.toggle('hidden', section !== 'promotions');
    byId('section-games').classList.toggle('hidden', section !== 'games');
    byId('section-store').classList.toggle('hidden', section !== 'store');
    byId('section-orders').classList.toggle('hidden', section !== 'orders');
    byId('section-farm').classList.toggle('hidden', section !== 'farm');
    const titles = { dashboard: 'Vue d’ensemble', announcements: 'Événements & annonces', promotions: 'Effets & décorations', games: 'Visibilité des jeux', store: 'FITIA STORE', orders: 'Commandes clients', farm: 'Retraits FITIA FARM' };
    byId('page-title').textContent = titles[section] || titles.dashboard;
    document.querySelectorAll('.nav-button[data-section]').forEach((button) => {
      button.classList.toggle('active', button.dataset.section === section);
    });
    if (section === 'orders' && ordersAdmin) ordersAdmin.load().catch(() => {});
    if (section === 'farm' && farmAdmin) farmAdmin.load().catch(() => {});
  }

  function fillPromotionLabels(values = {}) {
    LANGUAGES.forEach((lang) => { byId(`promotion-label-${lang}`).value = values[lang] || ''; });
  }

  function readPromotionLabels() {
    const values = {};
    LANGUAGES.forEach((lang) => {
      const value = byId(`promotion-label-${lang}`).value.trim();
      if (value) values[lang] = value;
    });
    return values;
  }

  function openPromotionEditor(item = null) {
    state.editingPromotionId = item?.id || null;
    byId('promotion-form').reset();
    byId('promotion-editor-error').textContent = '';
    byId('promotion-target-type').value = item?.targetType || 'machine';
    byId('promotion-target-position').value = String(item ? item.targetId + 1 : 1);
    byId('promotion-variant').value = item?.variant || 'gift';
    byId('promotion-animated').checked = item?.animated !== false;
    fillPromotionLabels(item?.label || {});
    byId('promotion-starts-at').value = item ? toInputDate(item.startsAt) : '';
    byId('promotion-expires-at').value = item ? toInputDate(item.expiresAt) : '';
    byId('promotion-editor-title').textContent = item ? 'Modifier la décoration' : 'Nouvelle décoration';
    updatePromotionPreview();
    byId('promotion-editor-modal').classList.remove('hidden');
    document.body.classList.add('modal-open');
    byId('promotion-label-fr').focus();
  }

  function closePromotionEditor() {
    byId('promotion-editor-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    state.editingPromotionId = null;
    byId('promotion-editor-error').textContent = '';
  }

  function updatePromotionPreview() {
    const variant = byId('promotion-variant').value;
    const targetType = byId('promotion-target-type').value;
    const position = Number(byId('promotion-target-position').value) || 1;
    const previewCard = byId('promotion-preview-card');
    previewCard.className = `promotion-preview-card preview-${variant}`;
    window.FitiaPromotionEffects.decorate(previewCard, variant, byId('promotion-animated').checked);
    byId('promotion-preview-label').textContent = byId('promotion-label-fr').value.trim() || byId('promotion-label-en').value.trim() || 'JOYEUX NOËL';
    byId('promotion-preview-target').textContent = `${targetType === 'machine' ? 'Machine' : 'Batterie'} n°${position}`;
    const startsAt = fromInputDate(byId('promotion-starts-at').value);
    const expiresAt = fromInputDate(byId('promotion-expires-at').value);
    let schedule = 'Affichage sans limite de date';
    if (startsAt && expiresAt) schedule = `Du ${formatDate(startsAt)} au ${formatDate(expiresAt)}`;
    else if (startsAt) schedule = `À partir du ${formatDate(startsAt)}`;
    else if (expiresAt) schedule = `Jusqu’au ${formatDate(expiresAt)}`;
    byId('promotion-preview-schedule').textContent = schedule;
  }

  async function submitPromotionEditor(event) {
    event.preventDefault();
    const startsAt = fromInputDate(byId('promotion-starts-at').value);
    const expiresAt = fromInputDate(byId('promotion-expires-at').value);
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      byId('promotion-editor-error').textContent = 'La date de fin doit être postérieure à la date de début.';
      return;
    }
    const position = Number(byId('promotion-target-position').value);
    if (!Number.isSafeInteger(position) || position < 1 || position > 100) {
      byId('promotion-editor-error').textContent = 'Choisissez un numéro d’article entier entre 1 et 100.';
      return;
    }
    const targetType = byId('promotion-target-type').value;
    const targetId = position - 1;
    const duplicate = state.promotionManifest.promotions.find((candidate) => (
      candidate.targetType === targetType && candidate.targetId === targetId && candidate.id !== state.editingPromotionId
    ));
    if (duplicate) {
      byId('promotion-editor-error').textContent = 'Cet article possède déjà une décoration. Modifiez-la ou choisissez un autre article.';
      return;
    }
    const variant = byId('promotion-variant').value;
    const item = {
      id: state.editingPromotionId || generateId(variant),
      targetType,
      targetId,
      variant,
      animated: byId('promotion-animated').checked,
      label: readPromotionLabels()
    };
    if (startsAt) item.startsAt = startsAt;
    if (expiresAt) item.expiresAt = expiresAt;
    const next = clone(state.promotionManifest);
    if (state.editingPromotionId) {
      const index = next.promotions.findIndex((candidate) => candidate.id === state.editingPromotionId);
      if (index < 0) {
        byId('promotion-editor-error').textContent = 'Cette décoration n’existe plus. Rechargez la liste.';
        return;
      }
      next.promotions[index] = item;
    } else {
      next.promotions.push(item);
    }
    const success = await savePromotions(next, state.editingPromotionId ? 'Décoration mise à jour.' : 'Nouvelle décoration enregistrée.');
    if (success) closePromotionEditor();
  }

  function fillLocalizedField(field, values = {}) {
    LANGUAGES.forEach((lang) => { byId(`item-${field}-${lang}`).value = values[lang] || ''; });
  }

  function readLocalizedField(field) {
    const values = {};
    LANGUAGES.forEach((lang) => {
      const value = byId(`item-${field}-${lang}`).value.trim();
      if (value) values[lang] = value;
    });
    return values;
  }

  function editorAssetUrl(assetPath) {
    return state.editorAssetData[assetPath] || `/${assetPath}`;
  }

  function updateAssetUploadUi() {
    const pending = state.assetUploads > 0;
    byId('item-background-upload').disabled = pending;
    byId('item-avatar-upload').disabled = pending || state.editorAvatars.length >= 3;
    byId('save-announcement').disabled = pending;
  }

  function renderAvatarEditor() {
    byId('item-avatar-count').textContent = `${state.editorAvatars.length}/3`;
    document.querySelectorAll('[data-avatar-preset]').forEach((button) => {
      const selected = state.editorAvatars.includes(button.dataset.avatarPreset);
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = state.assetUploads > 0 || (!selected && state.editorAvatars.length >= 3);
    });
    const list = byId('item-avatar-list');
    list.textContent = '';
    state.editorAvatars.forEach((assetPath, index) => {
      const item = document.createElement('span');
      item.className = 'avatar-selected';
      const image = document.createElement('img');
      image.src = editorAssetUrl(assetPath);
      image.alt = `Avatar ${index + 1}`;
      image.width = 42;
      image.height = 42;
      const remove = makeButton('×', 'avatar-remove', () => {
        state.editorAvatars.splice(index, 1);
        renderAvatarEditor();
        updatePreview();
      });
      remove.setAttribute('aria-label', `Retirer l’avatar ${index + 1}`);
      item.append(image, remove);
      list.appendChild(item);
    });
    updateAssetUploadUi();
  }

  function toggleAvatar(assetPath) {
    const index = state.editorAvatars.indexOf(assetPath);
    if (index >= 0) state.editorAvatars.splice(index, 1);
    else if (state.editorAvatars.length < 3) state.editorAvatars.push(assetPath);
    else {
      showToast('Retirez un avatar avant d’en ajouter un autre.', 'error');
      return;
    }
    renderAvatarEditor();
    updatePreview();
  }

  function applyAnnouncementTemplate() {
    const template = ANNOUNCEMENT_TEMPLATES[byId('item-template').value];
    if (!template) return;
    byId('item-category').value = template.category;
    fillLocalizedField('title', template.title);
    fillLocalizedField('message', template.message);
    byId('item-theme').value = template.theme;
    byId('item-font').value = template.font;
    state.editorBackground = '';
    state.editorAvatars = [...template.avatars];
    byId('asset-upload-status').textContent = '';
    renderAvatarEditor();
    updatePreview();
    showToast('Modèle prêt à personnaliser. Vérifiez le brouillon avant publication.');
  }

  function readFileAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Impossible de lire cette image.'));
      reader.readAsDataURL(blob);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Le contenu de cette image est illisible.'));
      image.src = dataUrl;
    });
  }

  async function optimizeImage(file, kind) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw new Error('Formats autorisés : PNG, JPEG et WebP.');
    }
    if (!file.size || file.size > 12 * 1024 * 1024) {
      throw new Error('Le fichier source doit peser entre 1 octet et 12 Mo.');
    }
    const sourceUrl = await readFileAsDataUrl(file);
    const image = await loadImage(sourceUrl);
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 30000000) {
      throw new Error('Les dimensions de cette image ne sont pas prises en charge.');
    }
    const maxWidth = kind === 'background' ? 1280 : kind === 'product' ? 900 : 256;
    const maxHeight = kind === 'background' ? 720 : kind === 'product' ? 900 : 256;
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Votre navigateur ne permet pas de préparer cette image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (quality) => new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('La conversion de l’image a échoué.')), 'image/webp', quality);
    });
    let blob = await encode(0.84);
    if (blob.size > MAX_IMAGE_BYTES) blob = await encode(0.64);
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('L’image reste trop volumineuse après optimisation.');
    const dataUrl = await readFileAsDataUrl(blob);
    return { dataUrl, data: dataUrl.split(',')[1], contentType: blob.type };
  }

  async function handleImageSelection(event, kind) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (kind === 'avatar' && state.editorAvatars.length >= 3) {
      showToast('Une annonce accepte au maximum trois avatars.', 'error');
      return;
    }
    const editorSession = state.editorSession;
    state.assetUploads += 1;
    byId('asset-upload-status').textContent = 'Optimisation et enregistrement sécurisé du visuel…';
    byId('editor-error').textContent = '';
    updateAssetUploadUi();
    try {
      const image = await optimizeImage(file, kind);
      const result = await api('/api/admin/announcement-assets', {
        method: 'POST',
        body: { data: image.data, contentType: image.contentType }
      });
      const assetPath = result.asset && result.asset.path;
      if (typeof assetPath !== 'string' || !/^assets\/announcements\/announcement-[a-f0-9]{24}\.(png|jpg|webp)$/.test(assetPath)) {
        throw new Error('Le serveur a renvoyé un chemin de visuel invalide.');
      }
      if (editorSession !== state.editorSession) return;
      state.editorAssetData[assetPath] = image.dataUrl;
      if (kind === 'background') state.editorBackground = assetPath;
      else if (!state.editorAvatars.includes(assetPath) && state.editorAvatars.length < 3) state.editorAvatars.push(assetPath);
      byId('asset-upload-status').textContent = 'Visuel enregistré. Publiez l’annonce pour l’associer au manifeste.';
      renderAvatarEditor();
      updatePreview();
      showToast(kind === 'background' ? 'Arrière-plan importé.' : 'Avatar importé.');
    } catch (error) {
      if (editorSession === state.editorSession) {
        byId('asset-upload-status').textContent = error.message;
        showToast(error.message, 'error');
      }
    } finally {
      if (editorSession === state.editorSession) {
        state.assetUploads = Math.max(0, state.assetUploads - 1);
        updateAssetUploadUi();
        renderAvatarEditor();
      }
    }
  }

  function openEditor(item = null, options = {}) {
    const duplicate = Boolean(options.duplicate);
    state.editorSession += 1;
    state.assetUploads = 0;
    state.editorAssetData = {};
    state.editorBackground = item?.backgroundImage || '';
    state.editorAvatars = Array.isArray(item?.avatars) ? [...item.avatars] : [];
    state.editorEnabled = item?.enabled !== false;
    state.editingId = item && !duplicate ? item.id : null;
    byId('announcement-form').reset();
    byId('editor-error').textContent = '';
    byId('asset-upload-status').textContent = '';
    byId('item-template').value = 'custom';
    byId('item-category').value = item?.category || options.category || 'event';
    byId('item-theme').value = item?.theme || 'classic';
    byId('item-font').value = item?.font || 'modern';
    const titleValues = item ? clone(item.title) : {};
    if (duplicate && titleValues.fr) titleValues.fr = `${titleValues.fr} — copie`.slice(0, 80);
    fillLocalizedField('title', titleValues);
    fillLocalizedField('message', item?.message || {});
    byId('item-starts-at').value = item ? toInputDate(item.startsAt) : '';
    byId('item-expires-at').value = item ? toInputDate(item.expiresAt) : '';
    byId('editor-title').textContent = state.editingId ? 'Modifier l’annonce' : duplicate ? 'Dupliquer l’annonce' : 'Nouvelle annonce';
    renderAvatarEditor();
    updatePreview();
    byId('editor-modal').classList.remove('hidden');
    document.body.classList.add('modal-open');
    byId('item-title-fr').focus();
  }

  function closeEditor() {
    byId('editor-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    state.editingId = null;
    state.editorSession += 1;
    state.assetUploads = 0;
    byId('editor-error').textContent = '';
  }

  function updatePreview() {
    const category = byId('item-category').value;
    const theme = byId('item-theme').value;
    const font = byId('item-font').value;
    const title = byId('item-title-fr').value.trim() || byId('item-title-en').value.trim() || 'Votre titre';
    const message = byId('item-message-fr').value.trim() || byId('item-message-en').value.trim() || 'Votre message apparaîtra ici.';
    const slide = byId('preview-slide');
    slide.className = `preview-slide preview-${category} announcement-theme-${theme} announcement-font-${font}`;
    slide.classList.toggle('has-background', Boolean(state.editorBackground));
    slide.classList.toggle('has-avatars', state.editorAvatars.length > 0);
    slide.style.setProperty('--announcement-bg-image', state.editorBackground ? `url(${JSON.stringify(editorAssetUrl(state.editorBackground))})` : 'none');
    byId('preview-category').textContent = CATEGORY_LABELS[category];
    byId('preview-title').textContent = title;
    byId('preview-message').textContent = message;
    byId('message-count').textContent = String(byId('item-message-fr').value.length);
    byId('item-background-status').textContent = state.editorBackground ? 'Image sélectionnée' : 'Aucune image';
    byId('item-background-remove').classList.toggle('hidden', !state.editorBackground);
    const avatarPreview = byId('preview-avatars');
    avatarPreview.textContent = '';
    state.editorAvatars.forEach((assetPath) => {
      const image = document.createElement('img');
      image.src = editorAssetUrl(assetPath);
      image.alt = '';
      image.width = 30;
      image.height = 30;
      avatarPreview.appendChild(image);
    });
    const startsAt = fromInputDate(byId('item-starts-at').value);
    const expiresAt = fromInputDate(byId('item-expires-at').value);
    let schedule = 'Diffusion sans limite de date';
    if (startsAt && expiresAt) schedule = `Du ${formatDate(startsAt)} au ${formatDate(expiresAt)}`;
    else if (startsAt) schedule = `À partir du ${formatDate(startsAt)}`;
    else if (expiresAt) schedule = `Jusqu’au ${formatDate(expiresAt)}`;
    byId('preview-schedule').textContent = schedule;
  }

  async function submitEditor(event) {
    event.preventDefault();
    if (state.assetUploads > 0) {
      byId('editor-error').textContent = 'Attendez la fin de l’enregistrement du visuel.';
      return;
    }
    const startsAt = fromInputDate(byId('item-starts-at').value);
    const expiresAt = fromInputDate(byId('item-expires-at').value);
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      byId('editor-error').textContent = 'La date de fin doit être postérieure à la date de début.';
      return;
    }
    const category = byId('item-category').value;
    const item = {
      id: state.editingId || generateId(category),
      category,
      enabled: state.editorEnabled,
      title: readLocalizedField('title'),
      message: readLocalizedField('message'),
      theme: byId('item-theme').value,
      font: byId('item-font').value
    };
    if (state.editorBackground) item.backgroundImage = state.editorBackground;
    if (state.editorAvatars.length) item.avatars = [...state.editorAvatars];
    if (startsAt) item.startsAt = startsAt;
    if (expiresAt) item.expiresAt = expiresAt;
    const next = clone(state.manifest);
    if (state.editingId) {
      const index = next.announcements.findIndex((candidate) => candidate.id === state.editingId);
      if (index < 0) {
        byId('editor-error').textContent = 'Cette annonce n’existe plus. Rechargez la liste.';
        return;
      }
      next.announcements[index] = item;
    } else {
      next.announcements.push(item);
    }
    const success = await saveManifest(next, state.editingId ? 'Annonce mise à jour.' : 'Nouvelle annonce enregistrée.');
    if (success) closeEditor();
  }

  function bindEvents() {
    byId('login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = byId('login-button');
      button.disabled = true;
      byId('login-error').textContent = '';
      try {
        const session = await api('/api/admin/login', {
          method: 'POST',
          body: { password: byId('login-password').value }
        });
        byId('login-password').value = '';
        await showAdmin(session);
      } catch (error) {
        byId('login-error').textContent = error.message;
      } finally {
        byId('login-password').value = '';
        button.disabled = false;
      }
    });

    byId('logout-button').addEventListener('click', async () => {
      try { await api('/api/admin/logout', { method: 'POST', body: {} }); } catch (_) { /* La session est déjà invalidée. */ }
      showLogin();
    });
    byId('refresh-button').addEventListener('click', () => {
      if (state.section === 'orders' && ordersAdmin) ordersAdmin.load().catch(() => {});
      else if (state.section === 'farm' && farmAdmin) farmAdmin.load().catch(() => {});
      else loadData();
    });
    document.querySelectorAll('.nav-button[data-section]').forEach((button) => {
      button.addEventListener('click', () => setSection(button.dataset.section));
    });
    document.querySelectorAll('[data-new-announcement]').forEach((button) => {
      button.addEventListener('click', () => openEditor(null, { category: 'information' }));
    });
    document.querySelectorAll('[data-new-event]').forEach((button) => {
      button.addEventListener('click', () => openEditor(null, { category: 'event' }));
    });
    document.querySelectorAll('[data-new-promotion]').forEach((button) => {
      button.addEventListener('click', () => openPromotionEditor());
    });
    document.querySelectorAll('[data-close-editor]').forEach((button) => button.addEventListener('click', closeEditor));
    document.querySelectorAll('[data-close-promotion-editor]').forEach((button) => button.addEventListener('click', closePromotionEditor));
    byId('announcement-form').addEventListener('submit', submitEditor);
    byId('announcement-form').addEventListener('input', updatePreview);
    byId('item-category').addEventListener('change', updatePreview);
    byId('item-theme').addEventListener('change', updatePreview);
    byId('item-font').addEventListener('change', updatePreview);
    byId('item-template').addEventListener('change', applyAnnouncementTemplate);
    byId('item-background-upload').addEventListener('click', () => byId('item-background-file').click());
    byId('item-avatar-upload').addEventListener('click', () => byId('item-avatar-file').click());
    byId('item-background-file').addEventListener('change', (event) => handleImageSelection(event, 'background'));
    byId('item-avatar-file').addEventListener('change', (event) => handleImageSelection(event, 'avatar'));
    byId('item-background-remove').addEventListener('click', () => {
      state.editorBackground = '';
      byId('asset-upload-status').textContent = '';
      updatePreview();
    });
    document.querySelectorAll('[data-avatar-preset]').forEach((button) => {
      button.addEventListener('click', () => toggleAvatar(button.dataset.avatarPreset));
    });
    byId('promotion-form').addEventListener('submit', submitPromotionEditor);
    byId('promotion-form').addEventListener('input', updatePromotionPreview);
    byId('promotion-form').addEventListener('change', updatePromotionPreview);
    storeAdmin.bindEvents();
    ordersAdmin.bindEvents();
    farmAdmin.bindEvents();
    ['search-input', 'category-filter', 'status-filter'].forEach((id) => {
      byId(id).addEventListener('input', () => state.manifest && renderAnnouncements());
      byId(id).addEventListener('change', () => state.manifest && renderAnnouncements());
    });
    byId('manifest-enabled').addEventListener('change', async (event) => {
      const next = clone(state.manifest);
      next.enabled = event.target.checked;
      const success = await saveManifest(next, next.enabled ? 'Diffusion des annonces activée.' : 'Diffusion des annonces désactivée.');
      if (!success) renderDistribution();
    });
    byId('promotions-enabled').addEventListener('change', async (event) => {
      const next = clone(state.promotionManifest);
      next.enabled = event.target.checked;
      const success = await savePromotions(next, next.enabled ? 'Décorations activées.' : 'Décorations désactivées.');
      if (!success) renderPromotions();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!byId('editor-modal').classList.contains('hidden')) closeEditor();
      if (!byId('promotion-editor-modal').classList.contains('hidden')) closePromotionEditor();
      if (!byId('store-editor-modal').classList.contains('hidden')) storeAdmin.closeEditor();
    });
  }

  async function init() {
    bindEvents();
    try {
      const session = await api('/api/admin/session');
      await showAdmin(session);
    } catch (error) {
      if (error.code !== 'AUTH_REQUIRED') showLogin();
    }
    window.setInterval(() => {
      if (state.manifest && !state.saving) {
        renderDashboard();
        renderAnnouncements();
      }
      if (state.promotionManifest && !state.promotionSaving) renderPromotions();
      if (storeAdmin.loaded && !storeAdmin.saving) storeAdmin.render();
    }, 60000);
  }

  gamesAdmin = window.FitiaGamesAdmin.create({
    byId, api, clone, showToast, setLoading, setConnection, updateSource,
    getMode: () => state.mode
  });
  storeAdmin = window.FitiaStoreAdmin.create({
    byId, api, clone, generateId, showToast, setLoading, setConnection, updateSource,
    makeButton, optimizeImage, fromInputDate, toInputDate,
    getMode: () => state.mode
  });
  ordersAdmin = window.FitiaOrdersAdmin.create({
    byId, api, showToast, setLoading, setConnection, makeButton, formatDate
  });
  farmAdmin = window.FitiaFarmAdmin.create({
    byId, api, showToast, setLoading, setConnection, makeButton, formatDate
  });

  init();
})();
