// Visibilité des cartes de jeux dans le Hub FITIA.
// Aucun appel de jeu, tirage, solde ou historique n'est modifié par ce module.
(() => {
  'use strict';

  const MANIFEST_URL = 'https://raw.githubusercontent.com/web3service/fitia-mining-pro/main/game-visibility.json';
  const CONFIG = window.FitiaGameVisibilityConfig;

  class FitiaGameVisibilityCenter {
    constructor(app) {
      this.app = app;
      this.hiddenGames = new Set();
      this.initialized = false;
      this.fetchInFlight = false;
      this.lastFetchAt = 0;
    }

    init() {
      this.initialized = true;
      this.apply();
    }

    isVisible(gameId) {
      return CONFIG.GAME_IDS.includes(gameId) && !this.hiddenGames.has(gameId);
    }

    apply() {
      if (!this.initialized) return;
      CONFIG.GAMES.forEach(({ id }) => {
        const card = document.querySelector(`#view-hub [data-game-id="${id}"]`);
        if (!card) return;
        const visible = this.isVisible(id);
        card.classList.toggle('hidden', !visible);
        if (visible) card.removeAttribute('aria-hidden');
        else card.setAttribute('aria-hidden', 'true');
      });
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
        if (!response.ok) throw new Error('GAME_VISIBILITY_UNAVAILABLE');
        const raw = await response.json();
        const normalized = CONFIG.normalizeManifest(raw);
        if (!normalized) throw new Error('GAME_VISIBILITY_INVALID');
        this.hiddenGames = new Set(normalized.hiddenGames);
        this.lastFetchAt = Date.now();
        this.apply();
      } catch (_) {
        // Au premier lancement, toutes les cartes restent visibles. Après une
        // synchronisation réussie, la dernière configuration valide est conservée.
      } finally {
        window.clearTimeout(timeout);
        this.fetchInFlight = false;
      }
    }
  }

  window.FitiaGameVisibilityCenter = FitiaGameVisibilityCenter;
})();
