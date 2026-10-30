(() => {
  'use strict';

  function create({ byId, api, clone, showToast, setLoading, setConnection, updateSource, getMode }) {
    const config = window.FitiaGameVisibilityConfig;
    const state = { manifest: null, revision: '', loaded: false, saving: false };

    function showError(error) {
      const element = byId('game-visibility-error');
      if (!error) {
        element.textContent = '';
        element.classList.add('hidden');
        return;
      }
      element.textContent = error.message || 'La visibilité des jeux est indisponible.';
      element.classList.remove('hidden');
    }

    function render() {
      if (!state.loaded || !state.manifest) return;
      const hidden = new Set(state.manifest.hiddenGames);
      const container = byId('game-visibility-list');
      container.textContent = '';
      config.GAMES.forEach((game) => {
        const visible = !hidden.has(game.id);
        const row = document.createElement('article');
        row.className = `game-visibility-item${visible ? '' : ' is-hidden'}`;
        row.dataset.gameVisibility = game.id;

        const logo = document.createElement('span');
        logo.className = 'game-visibility-logo';
        const image = document.createElement('img');
        image.src = `/${game.logo}`;
        image.width = 46;
        image.height = 46;
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        logo.appendChild(image);

        const copy = document.createElement('div');
        copy.className = 'game-visibility-copy';
        const name = document.createElement('strong');
        name.textContent = game.name;
        const status = document.createElement('small');
        status.textContent = visible ? 'Visible dans le Hub' : 'Masqué dans le Hub';
        copy.append(name, status);

        const control = document.createElement('label');
        control.className = 'switch-control game-visibility-switch';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = visible;
        input.dataset.gameVisibilityToggle = game.id;
        input.setAttribute('aria-label', `${visible ? 'Masquer' : 'Réafficher'} ${game.name}`);
        const track = document.createElement('span');
        track.className = 'switch-track';
        track.setAttribute('aria-hidden', 'true');
        control.append(input, track);
        input.addEventListener('change', () => toggle(game.id, input.checked));

        row.append(logo, copy, control);
        container.appendChild(row);
      });
      byId('game-visible-count').textContent = `${config.GAMES.length - hidden.size} / ${config.GAMES.length} visibles`;
    }

    async function load() {
      const data = await api('/api/admin/game-visibility');
      state.manifest = data.manifest;
      state.revision = data.revision;
      state.loaded = true;
      showError(null);
      render();
      return data;
    }

    async function save(nextManifest, successMessage) {
      if (state.saving || !state.manifest) return false;
      state.saving = true;
      setLoading(true, getMode() === 'github' ? 'Publication dans le wallet…' : 'Enregistrement local…');
      try {
        const data = await api('/api/admin/game-visibility', {
          method: 'PUT',
          body: { manifest: nextManifest, revision: state.revision }
        });
        state.manifest = data.manifest;
        state.revision = data.revision;
        updateSource(data);
        render();
        setConnection('online');
        showToast(successMessage);
        return true;
      } catch (error) {
        if (error.code !== 'AUTH_REQUIRED') showError(error);
        if (error.code === 'CONFLICT') await load().catch(() => {});
        return false;
      } finally {
        state.saving = false;
        setLoading(false);
      }
    }

    async function toggle(gameId, visible) {
      const game = config.GAMES.find((item) => item.id === gameId);
      if (!game) return;
      const next = clone(state.manifest);
      const hidden = new Set(next.hiddenGames);
      if (visible) hidden.delete(gameId);
      else hidden.add(gameId);
      next.hiddenGames = config.GAME_IDS.filter((id) => hidden.has(id));
      const success = await save(next, visible ? `${game.name} réaffiché dans le Hub.` : `${game.name} masqué dans le Hub.`);
      if (!success) render();
    }

    function reset() {
      state.manifest = null;
      state.revision = '';
      state.loaded = false;
      state.saving = false;
      byId('game-visibility-list').textContent = '';
      showError(null);
    }

    return {
      load,
      render,
      reset,
      showError,
      get loaded() { return state.loaded; },
      get saving() { return state.saving; }
    };
  }

  window.FitiaGamesAdmin = { create };
})();
