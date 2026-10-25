(() => {
  'use strict';

  const LANGUAGES = ['fr', 'en', 'de', 'zh', 'sg'];
  const CATEGORY_LABELS = {
    event: 'Événement',
    information: 'Information',
    referral: 'Parrainage',
    security: 'Sécurité'
  };
  const STATUS_LABELS = { active: 'Active', scheduled: 'Programmée', expired: 'Expirée' };
  const state = {
    csrfToken: '',
    mode: 'local',
    project: null,
    branch: null,
    manifest: null,
    revision: '',
    lastSync: null,
    editingId: null,
    saving: false,
    section: 'dashboard'
  };

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
    if (!options.quiet) setLoading(true, 'Chargement des annonces…');
    byId('list-error').classList.add('hidden');
    try {
      const data = await api('/api/admin/announcements');
      state.manifest = data.manifest;
      state.revision = data.revision;
      state.lastSync = new Date();
      updateSource(data);
      renderAll();
      setConnection('online');
    } catch (error) {
      setConnection('offline');
      if (error.code !== 'AUTH_REQUIRED') {
        byId('list-error').textContent = error.message;
        byId('list-error').classList.remove('hidden');
        showToast(error.message, 'error');
      }
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

  function renderAll() {
    if (!state.manifest) return;
    renderDashboard();
    renderDistribution();
    renderAnnouncements();
  }

  function renderDashboard() {
    const items = state.manifest.announcements;
    const counts = { active: 0, scheduled: 0, expired: 0 };
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
      row.className = 'announcement-row';
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
      actions.append(
        makeButton('Modifier', 'button button-quiet action-button', () => openEditor(item)),
        makeButton('Dupliquer', 'button button-quiet action-button', () => openEditor(item, { duplicate: true })),
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

  async function deleteAnnouncement(item) {
    if (!window.confirm(`Supprimer « ${localized(item.title)} » ?`)) return;
    const next = clone(state.manifest);
    next.announcements = next.announcements.filter((candidate) => candidate.id !== item.id);
    await saveManifest(next, 'Annonce supprimée.');
  }

  function setSection(section) {
    state.section = section;
    byId('section-dashboard').classList.toggle('hidden', section !== 'dashboard');
    byId('section-announcements').classList.toggle('hidden', section !== 'announcements');
    byId('page-title').textContent = section === 'dashboard' ? 'Vue d’ensemble' : 'Événements & annonces';
    document.querySelectorAll('.nav-button[data-section]').forEach((button) => {
      button.classList.toggle('active', button.dataset.section === section);
    });
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

  function openEditor(item = null, options = {}) {
    const duplicate = Boolean(options.duplicate);
    state.editingId = item && !duplicate ? item.id : null;
    byId('announcement-form').reset();
    byId('editor-error').textContent = '';
    byId('item-category').value = item?.category || options.category || 'event';
    const titleValues = item ? clone(item.title) : {};
    if (duplicate && titleValues.fr) titleValues.fr = `${titleValues.fr} — copie`.slice(0, 80);
    fillLocalizedField('title', titleValues);
    fillLocalizedField('message', item?.message || {});
    byId('item-starts-at').value = item ? toInputDate(item.startsAt) : '';
    byId('item-expires-at').value = item ? toInputDate(item.expiresAt) : '';
    byId('editor-title').textContent = state.editingId ? 'Modifier l’annonce' : duplicate ? 'Dupliquer l’annonce' : 'Nouvelle annonce';
    updatePreview();
    byId('editor-modal').classList.remove('hidden');
    document.body.classList.add('modal-open');
    byId('item-title-fr').focus();
  }

  function closeEditor() {
    byId('editor-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    state.editingId = null;
    byId('editor-error').textContent = '';
  }

  function updatePreview() {
    const category = byId('item-category').value;
    const title = byId('item-title-fr').value.trim() || byId('item-title-en').value.trim() || 'Votre titre';
    const message = byId('item-message-fr').value.trim() || byId('item-message-en').value.trim() || 'Votre message apparaîtra ici.';
    byId('preview-slide').className = `preview-slide preview-${category}`;
    byId('preview-category').textContent = CATEGORY_LABELS[category];
    byId('preview-title').textContent = title;
    byId('preview-message').textContent = message;
    byId('message-count').textContent = String(byId('item-message-fr').value.length);
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
      title: readLocalizedField('title'),
      message: readLocalizedField('message')
    };
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
    byId('refresh-button').addEventListener('click', () => loadData());
    document.querySelectorAll('.nav-button[data-section]').forEach((button) => {
      button.addEventListener('click', () => setSection(button.dataset.section));
    });
    document.querySelectorAll('[data-new-announcement]').forEach((button) => {
      button.addEventListener('click', () => openEditor(null, { category: 'information' }));
    });
    document.querySelectorAll('[data-new-event]').forEach((button) => {
      button.addEventListener('click', () => openEditor(null, { category: 'event' }));
    });
    document.querySelectorAll('[data-close-editor]').forEach((button) => button.addEventListener('click', closeEditor));
    byId('announcement-form').addEventListener('submit', submitEditor);
    byId('announcement-form').addEventListener('input', updatePreview);
    byId('item-category').addEventListener('change', updatePreview);
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
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !byId('editor-modal').classList.contains('hidden')) closeEditor();
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
    }, 60000);
  }

  init();
})();
