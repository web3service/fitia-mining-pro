/* FITIA PRO — administration privée des comptes et des actifs Polygon. */
(() => {
  'use strict';

  function createUsersAdmin(deps) {
    const state = { users: [], detail: null, loading: null, detailLoading: null, loaded: false, saving: false };
    const { byId, api } = deps;

    function badge(label, active, kind) {
      const element = document.createElement('span');
      element.className = `account-badge account-badge-${kind}${active ? ' is-active' : ''}`;
      element.textContent = label;
      return element;
    }

    function badges(user, includeInactive = false) {
      const container = document.createElement('div');
      container.className = 'account-badges';
      if (user.emailVerified || includeInactive) container.appendChild(badge(user.emailVerified ? 'Email confirmé' : 'Email non confirmé', user.emailVerified, 'email'));
      if (user.walletVerified || includeInactive) container.appendChild(badge(user.walletVerified ? 'Wallet vérifié' : 'Wallet non vérifié', user.walletVerified, 'wallet'));
      if (user.certified || includeInactive) container.appendChild(badge(user.certified ? 'Certifié par l’admin' : 'Non certifié', user.certified, 'admin'));
      return container;
    }

    function detailRow(label, value, mono = false) {
      const row = document.createElement('div');
      row.className = 'account-detail-row';
      const term = document.createElement('small'); term.textContent = label;
      const content = document.createElement('span'); content.textContent = value || '—';
      if (mono) content.className = 'farm-mono';
      row.append(term, content);
      return row;
    }

    function reset() {
      state.users = []; state.detail = null; state.loaded = false; state.saving = false;
      const list = byId('users-list'); if (list) list.textContent = '';
      const detail = byId('user-detail'); if (detail) { detail.textContent = ''; detail.classList.add('hidden'); }
      const error = byId('users-list-error'); if (error) { error.textContent = ''; error.classList.add('hidden'); }
      const search = byId('users-search'); if (search) search.value = '';
    }

    function showError(error) {
      if (!error || error.code === 'AUTH_REQUIRED') return;
      byId('users-list-error').textContent = error.message;
      byId('users-list-error').classList.remove('hidden');
    }

    async function load(options = {}) {
      if (state.loading) return state.loading;
      state.loading = (async () => {
        if (!options.quiet) deps.setLoading(true, 'Chargement des comptes…');
        try {
          const search = byId('users-search').value.trim();
          const data = await api(`/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`);
          state.users = Array.isArray(data.users) ? data.users : [];
          state.loaded = true;
          byId('users-list-error').classList.add('hidden');
          render();
          deps.setConnection('online');
          return data;
        } catch (error) {
          showError(error);
          if (error.code !== 'AUTH_REQUIRED') deps.showToast(error.message, 'error');
          throw error;
        } finally { if (!options.quiet) deps.setLoading(false); }
      })();
      try { return await state.loading; } finally { state.loading = null; }
    }

    async function loadDetail(userId, options = {}) {
      if (state.detailLoading) return state.detailLoading;
      state.detailLoading = (async () => {
        if (!options.quiet) deps.setLoading(true, 'Lecture du compte et des actifs Polygon…');
        try {
          const data = await api(`/api/admin/users?userId=${encodeURIComponent(userId)}`);
          state.detail = data;
          const index = state.users.findIndex((user) => user.userId === data.user.userId);
          if (index >= 0) state.users[index] = data.user;
          render();
          return data;
        } catch (error) {
          showError(error);
          if (error.code !== 'AUTH_REQUIRED') deps.showToast(error.message, 'error');
          throw error;
        } finally { if (!options.quiet) deps.setLoading(false); }
      })();
      try { return await state.detailLoading; } finally { state.detailLoading = null; }
    }

    async function setCertified(certified) {
      if (!state.detail || state.saving) return;
      const user = state.detail.user;
      const action = certified ? 'attribuer le badge administrateur à' : 'retirer le badge administrateur de';
      if (!window.confirm(`Confirmez-vous vouloir ${action} ${user.username} ?`)) return;
      state.saving = true;
      renderDetail();
      try {
        const result = await api('/api/admin/users', { method: 'PATCH', body: { userId: user.userId, certified } });
        state.detail.user = result.user;
        const index = state.users.findIndex((candidate) => candidate.userId === user.userId);
        if (index >= 0) state.users[index] = result.user;
        render();
        deps.showToast(certified ? 'Badge administrateur attribué et journalisé.' : 'Badge administrateur retiré et journalisé.');
        await loadDetail(user.userId, { quiet: true });
      } catch (error) {
        showError(error); deps.showToast(error.message, 'error');
      } finally { state.saving = false; renderDetail(); }
    }

    function render() {
      const list = byId('users-list'); if (!list) return;
      list.textContent = '';
      byId('users-empty').classList.toggle('hidden', state.users.length > 0);
      byId('users-stat-total').textContent = String(state.users.length);
      byId('users-stat-email').textContent = String(state.users.filter((user) => user.emailVerified).length);
      byId('users-stat-wallet').textContent = String(state.users.filter((user) => user.walletVerified).length);
      byId('users-stat-certified').textContent = String(state.users.filter((user) => user.certified).length);

      state.users.forEach((user) => {
        const card = document.createElement('article'); card.className = 'announcement-row user-account-row';
        const main = document.createElement('div'); main.className = 'announcement-main';
        const heading = document.createElement('div'); heading.className = 'user-account-heading';
        const name = document.createElement('h3'); name.textContent = user.username;
        heading.append(name, badges(user));
        const details = document.createElement('div'); details.className = 'seller-order-details';
        details.append(
          detailRow('Email privé', user.email),
          detailRow('Adresse Polygon publique', user.walletAddress || 'Wallet non lié', true)
        );
        main.append(heading, details);
        const controls = document.createElement('div'); controls.className = 'announcement-actions';
        controls.appendChild(deps.makeButton('Consulter le compte', 'button button-primary action-button', () => loadDetail(user.userId).catch(() => {})));
        card.append(main, controls); list.appendChild(card);
      });
      renderDetail();
    }

    function renderDetail() {
      const panel = byId('user-detail'); if (!panel) return;
      panel.textContent = '';
      panel.classList.toggle('hidden', !state.detail);
      if (!state.detail) return;
      const { user, assets, certificationHistory } = state.detail;
      const header = document.createElement('div'); header.className = 'user-detail-header';
      const titleWrap = document.createElement('div');
      const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'Compte applicatif';
      const title = document.createElement('h3'); title.textContent = user.username;
      titleWrap.append(eyebrow, title);
      const certify = deps.makeButton(
        user.certified ? 'Retirer la certification admin' : 'Certifier par l’admin',
        `button ${user.certified ? 'button-danger' : 'button-primary'} action-button`,
        () => setCertified(!user.certified)
      );
      certify.id = 'user-certify-button'; certify.disabled = state.saving;
      header.append(titleWrap, certify);
      panel.append(header, badges(user, true));

      const privacy = document.createElement('p'); privacy.className = 'account-badge-note';
      privacy.textContent = 'Email confirmé et Wallet vérifié ne prouvent pas une identité réelle. La certification admin reste une décision distincte et journalisée.';
      panel.appendChild(privacy);

      const identity = document.createElement('div'); identity.className = 'account-detail-grid';
      identity.append(
        detailRow('Email privé · admins uniquement', user.email),
        detailRow('Adresse publique Polygon', user.walletAddress || 'Non liée', true),
        detailRow('Identifiant du compte', user.userId, true),
        detailRow('Compte créé le', deps.formatDate(user.createdAt))
      );
      panel.appendChild(identity);

      const assetTitle = document.createElement('h4'); assetTitle.textContent = 'Actifs miniers · lecture Polygon';
      panel.appendChild(assetTitle);
      if (!assets) {
        const empty = document.createElement('p'); empty.className = 'muted';
        empty.textContent = 'Aucun wallet vérifié : aucun actif ne peut être rattaché à ce compte.';
        panel.appendChild(empty);
      } else {
        const stats = document.createElement('div'); stats.className = 'user-asset-stats';
        const values = [
          ['Machines', String(assets.machineCount)],
          ['Machines actives', String(assets.activeMachineCount)],
          ['Batteries possédées', String(assets.batteryCount)],
          ['Minage', assets.miningActive ? 'ACTIF' : 'INACTIF']
        ];
        values.forEach(([label, value]) => {
          const item = document.createElement('div');
          const small = document.createElement('small'); small.textContent = label;
          const strong = document.createElement('strong'); strong.textContent = value;
          if (label === 'Minage') strong.className = assets.miningActive ? 'mining-state-active' : 'mining-state-inactive';
          item.append(small, strong); stats.appendChild(item);
        });
        panel.appendChild(stats);
        const power = document.createElement('p'); power.className = 'field-hint';
        power.textContent = `Puissance active du contrat : ${assets.activePower} · Polygon (137)`;
        panel.appendChild(power);

        const assetsGrid = document.createElement('div'); assetsGrid.className = 'user-asset-lists';
        const machineList = document.createElement('div');
        const machineTitle = document.createElement('strong'); machineTitle.textContent = 'Machines possédées';
        machineList.appendChild(machineTitle);
        if (!assets.machines.length) machineList.appendChild(detailRow('Inventaire', 'Aucune machine'));
        assets.machines.forEach((machine, index) => {
          machineList.appendChild(detailRow(
            `#${index + 1} · Type ${machine.type}`,
            `${machine.active ? 'Active' : 'Inactive / disponible'}${machine.expiresAt ? ` · ${deps.formatDate(machine.expiresAt)}` : ''}`
          ));
        });
        const batteryList = document.createElement('div');
        const batteryTitle = document.createElement('strong'); batteryTitle.textContent = 'Batteries possédées';
        batteryList.appendChild(batteryTitle);
        if (!assets.batteries.length) batteryList.appendChild(detailRow('Inventaire', 'Aucune batterie'));
        assets.batteries.forEach((battery) => batteryList.appendChild(detailRow(`Type ${battery.type}`, `Quantité : ${battery.quantity}`)));
        assetsGrid.append(machineList, batteryList); panel.appendChild(assetsGrid);
      }

      const historyTitle = document.createElement('h4'); historyTitle.textContent = 'Journal des certifications admin';
      panel.appendChild(historyTitle);
      const history = document.createElement('div'); history.className = 'certification-history';
      if (!certificationHistory.length) history.appendChild(detailRow('Historique', 'Aucune attribution ou retrait'));
      certificationHistory.forEach((event) => history.appendChild(detailRow(
        event.certified ? 'Badge attribué' : 'Badge retiré',
        `${deps.formatDate(event.createdAt)} · ${event.actor}`
      )));
      panel.appendChild(history);
    }

    function bindEvents() {
      byId('users-search-form').addEventListener('submit', (event) => { event.preventDefault(); load().catch(() => {}); });
      byId('users-refresh').addEventListener('click', () => {
        load().catch(() => {});
        if (state.detail) loadDetail(state.detail.user.userId).catch(() => {});
      });
    }

    return {
      load, reset, render, bindEvents,
      get loaded() { return state.loaded; },
      get saving() { return state.saving; }
    };
  }

  window.FitiaUsersAdmin = { create: createUsersAdmin };
})();
