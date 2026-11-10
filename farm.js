/* FITIA FARM — compte signé, économie serveur et contrôle de la scène 3D. */
(() => {
  'use strict';
  const Config = globalThis.FitiaFarmConfig;
  const Protocol = globalThis.FitiaFarmProtocol;
  const API_URL = 'https://fitia-mining-pro.vercel.app/api/farm';
  const NAMES = {
    chicken: 'Chicken', sheep: 'Sheep', cow: 'Cow', goat: 'Goat', duck: 'Duck', wheat: 'Wheat', carrot: 'Carrot', maize: 'Maize', tomato: 'Tomato',
    eggs: 'Eggs', wool: 'Wool', milk: 'Milk'
  };
  const FRENCH_NAMES = { wheat: 'Blé', carrot: 'Carotte', maize: 'Maïs', tomato: 'Tomate', chicken: 'Poule', sheep: 'Mouton', cow: 'Vache', goat: 'Chèvre', duck: 'Canard', eggs: 'Œufs', wool: 'Laine', milk: 'Lait' };
  const farmName = (key, lang) => (lang === 'fr' ? FRENCH_NAMES[key] : NAMES[key]) || key;
  const ACTION_SUCCESS = {
    buy_land: 'Terrain purchased.', buy_animal: 'Animal added.', buy_feed: 'Feed added.',
    move_building: 'Building moved.', customize_building: 'Building style saved.', change_layout: 'Farm layout saved.', claim_mission: 'Mission reward credited.', plant: 'Crop planted.', plant_plot: 'Crop planted.', water_crop: 'Crop watered.', fertilize_crop: 'Fertilizer applied.', breed_animal: 'Young animal added.', care_animal: 'Animal cared for.', harvest: 'Crop harvested.', harvest_ready: 'Ready crops harvested.', feed: 'Production started.', feed_group: 'Animals fed.', collect_group: 'Products collected.',
    collect: 'Product collected.', mill_feed: 'Feed prepared.', sell: 'Products sold.', sell_item: 'Product sold.'
  };
  const ACTION_SUCCESS_FR = {
    buy_land: 'Terrain acheté.', buy_animal: 'Animal ajouté.', buy_feed: 'Nourriture ajoutée.',
    move_building: 'Bâtiment déplacé.', customize_building: 'Style du bâtiment enregistré.', change_layout: 'Aménagement enregistré.', claim_mission: 'Récompense de mission créditée.', plant: 'Culture plantée.', plant_plot: 'Culture plantée.', water_crop: 'Culture arrosée.', fertilize_crop: 'Engrais appliqué.', breed_animal: 'Jeune animal ajouté.', care_animal: 'Animal soigné.', harvest: 'Culture récoltée.', harvest_ready: 'Cultures prêtes récoltées.',
    feed: 'Production démarrée.', feed_group: 'Animaux nourris.', collect: 'Production collectée.', collect_group: 'Productions collectées.',
    mill_feed: 'Nourriture préparée.', sell: 'Produits vendus.', sell_item: 'Produit vendu.'
  };
  const ERROR_COPY_FR = {
    FARM_AUTH: 'Signature du portefeuille expirée ou invalide.', FARM_NOT_STARTED: 'Achetez un terrain et un animal pour commencer.',
    FARM_LAND_REQUIRED: 'Achetez d’abord le terrain.', FARM_LAND_OWNED: 'Vous possédez déjà ce terrain.',
    FARM_INSUFFICIENT_COINS: 'F-Coins insuffisants.', FARM_FEED_REQUIRED: 'Nourriture insuffisante.',
    FARM_NOT_READY: 'La production n’est pas encore prête.', FARM_NOT_FOUND: 'Cet élément n’existe plus. Actualisez la ferme.',
    FARM_MISSION_CLAIMED: 'Récompense déjà reçue.', FARM_MISSION_INCOMPLETE: 'Mission non terminée.',
    FARM_YOUNG_ANIMAL: 'Cet animal est trop jeune.', FARM_ALREADY_FERTILIZED: 'Cette culture a déjà reçu de l’engrais.',
    FARM_ALREADY_CARED: 'Cet animal a déjà été soigné pour ce cycle.',
    FARM_ALREADY_WATERED: 'Cette culture a déjà été arrosée.',
    FARM_WHEAT_REQUIRED: 'Blé insuffisant pour le moulin.', FARM_FEED_FULL: 'Le stock de nourriture est plein.',
    FARM_PLOT_OCCUPIED: 'Cette parcelle est déjà occupée. Actualisez la ferme.',
    FARM_CLIENT_UPDATE_REQUIRED: 'Les retraits nécessitent la dernière version de l’application.', FARM_INVENTORY_EMPTY: 'Stock insuffisant.', FARM_LIMIT: 'La capacité maximale est atteinte.',
    FARM_AMOUNT: 'Montant invalide. Retrait : minimum 1 000 F-Coins, par multiples de 100.',
    FARM_WITHDRAWAL_PENDING: 'Une demande de retrait est déjà en attente.', FARM_WITHDRAWAL_COOLDOWN: 'Un retrait est autorisé toutes les 24 heures.',
    FARM_CANCELLED: 'Cette action a été annulée sans être exécutée.', FARM_REVISION: 'La ferme a changé dans une autre session. Actualisez-la.', FARM_CONFLICT: 'Action déjà traitée ou conflit de compte. Actualisez la ferme.',
    FARM_RPC_UNAVAILABLE: 'La vérification Polygon est temporairement indisponible.', FARM_NETWORK: 'Connexion au serveur impossible. Réessayez.',
    FARM_STORAGE: 'Le service FARM est temporairement indisponible.', FARM_CONFIG: 'FITIA FARM est en cours de préparation.',
    FARM_PAYMENT_FAILED: 'Le transfert FTA a échoué. Aucun F-Coin crédité.', FARM_PAYMENT_MISMATCH: 'Le transfert FTA ne correspond pas à ce dépôt.',
    FARM_TX_USED: 'Cette transaction Polygon a déjà été utilisée.', FARM_PARAMS: 'Action de ferme invalide.',
    WALLET_SESSION_CHANGED: 'La session du portefeuille a changé. Action arrêtée.'
  };
  const ERROR_COPY = {
    FARM_AUTH: 'Your wallet signature expired. Please try again.', FARM_NOT_STARTED: 'Buy the terrain and at least one animal to unlock production.',
    FARM_LAND_REQUIRED: 'Buy the terrain before adding an animal.', FARM_LAND_OWNED: 'You already own the terrain.',
    FARM_INSUFFICIENT_COINS: 'Not enough F-Coins for this action.', FARM_FEED_REQUIRED: 'Buy feed before feeding this animal.',
    FARM_NOT_READY: 'Production is not ready yet.', FARM_NOT_FOUND: 'This farm item no longer exists. Refresh and try again.',
    FARM_MISSION_CLAIMED: 'Reward already claimed.', FARM_MISSION_INCOMPLETE: 'Mission not completed.',
    FARM_YOUNG_ANIMAL: 'This animal is too young.', FARM_ALREADY_FERTILIZED: 'This crop is already fertilized.',
    FARM_ALREADY_CARED: 'This animal has already been cared for this cycle.',
    FARM_ALREADY_WATERED: 'This crop has already been watered.',
    FARM_WHEAT_REQUIRED: 'Not enough wheat for the mill.', FARM_FEED_FULL: 'The feed storage is full.',
    FARM_PLOT_OCCUPIED: 'This plot is already occupied. Refresh your farm.',
    FARM_FEATURE_DISABLED: 'This feature is coming soon.',
    FARM_CLIENT_UPDATE_REQUIRED: 'Withdrawals require the latest version of the app.', FARM_INVENTORY_EMPTY: 'Your barn is empty. Harvest or collect a product first.', FARM_LIMIT: 'Your farm has reached its capacity limit.',
    FARM_AMOUNT: 'Enter a valid amount. Withdrawals start at 10 FTA (1,000 F-Coins) in multiples of 100 F-Coins.',
    FARM_WITHDRAWAL_PENDING: 'You already have a withdrawal in progress. Wait for its FTA payment before creating another.',
    FARM_WITHDRAWAL_COOLDOWN: 'One withdrawal is allowed every 24 hours. Your next available time is shown with your latest request.',
    FARM_CANCELLED: 'This action was cancelled without being performed.', FARM_REVISION: 'Your farm changed in another session. It has been refreshed.', FARM_CONFLICT: 'This action was already processed. Refresh your farm.',
    FARM_RPC_UNAVAILABLE: 'Polygon verification is temporarily unavailable. Your transaction can be retried safely.',
    FARM_STORAGE: 'The farm service is temporarily unavailable. Please try again.', FARM_CONFIG: 'FITIA FARM is being prepared. Please try again later.',
    FARM_PAYMENT_FAILED: 'The FTA transfer failed on-chain. No F-Coins were credited.', FARM_PAYMENT_MISMATCH: 'The FTA transfer does not match this deposit.',
    FARM_TX_USED: 'This Polygon transaction has already been used.', FARM_PARAMS: 'The requested farm action is invalid.',
    WALLET_SESSION_CHANGED: 'The wallet session changed. The farm action was stopped.'
  };

  function make(tag, className, text) {
    const element = document.createElement(tag); if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text); return element;
  }
  const FARM_ICONS = new Set(['chicken', 'sheep', 'cow', 'goat', 'duck', 'wheat', 'carrot', 'maize', 'tomato', 'eggs', 'wool', 'milk', 'terrain', 'feed', 'barn', 'coins']);
  function farmIcon(key, className = 'farm-item-icon') {
    const image = make('img', className);
    image.src = `assets/farm/${FARM_ICONS.has(key) ? key : 'barn'}.svg`;
    image.alt = ''; image.draggable = false; image.setAttribute('aria-hidden', 'true');
    return image;
  }
  function farmVisual(key) {
    const visual = make('div', 'farm-dialog-visual'); visual.appendChild(farmIcon(key)); return visual;
  }
  function tokenVisual() {
    const visual = make('div', 'farm-dialog-visual'); const image = make('img');
    image.src = 'assets/fta.png'; image.alt = ''; image.draggable = false; visual.appendChild(image); return visual;
  }
  function uuid() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  function formatUnits(units) {
    try {
      const value = BigInt(units); const whole = value / Config.COIN_UNITS_PER_FTA;
      const fraction = (value % Config.COIN_UNITS_PER_FTA).toString().padStart(8, '0').replace(/0+$/, '');
      return fraction ? `${whole}.${fraction}` : String(whole);
    } catch (_) { return '0'; }
  }
  function emptyState(account = '') {
    return { version: 1, wallet: account, coins: 0, land: null, animals: [], crops: [], feed: 0,
      inventory: { wheat: 0, carrot: 0, maize: 0, tomato: 0, eggs: 0, wool: 0, milk: 0 }, createdAt: Date.now(), updatedAt: Date.now() };
  }
  function writePendingDeposit(account, pending) {
    if (!account) return;
    try {
      const key = `fitia_farm_pending_deposit_v1:${account.toLowerCase()}`;
      if (pending) localStorage.setItem(key, JSON.stringify(pending)); else localStorage.removeItem(key);
    } catch (_) { /* Aucune clé ou donnée privée n'est impliquée dans cette reprise publique. */ }
  }
  function durationLabel(milliseconds) {
    const minutes = Math.round(milliseconds / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
  }
  function countdown(timestamp) {
    const remaining = Math.max(0, Number(timestamp) - Date.now());
    if (!remaining) return 'Ready';
    const seconds = Math.ceil(remaining / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }

  class FitiaFarmCenter {
    constructor(app) {
      this.app = app; this.account = null; this.state = null; this.revision = 0; this.withdrawals = []; this.aviator = null;
      this.features = { unvalidatedEconomy: false, liveExchange: false };
      this.scene = null; this.active = false; this.initialized = false; this.operation = false;
      this.refreshPromise = null; this.pendingCheck = null; this.pendingDeposit = null;
      this.pollTimer = null; this.clockTimer = null; this.retryTimer = null; this.backgroundPollTimer = null; this.session = 0; this.tab = 'overview';
      this.serverOffset = 0;
      this.withdrawalStatuses = {};
    }
    text(en, fr) { return this.app.currentLang === 'fr' ? fr : en; }
    success(type) { return (this.app.currentLang === 'fr' ? ACTION_SUCCESS_FR : ACTION_SUCCESS)[type] || this.text('Farm updated.', 'Ferme mise à jour.'); }
    init() {
      this.initialized = true;
      this.clockTimer = globalThis.setInterval(() => this.tick(), 1000);
      this.backgroundPollTimer = globalThis.setInterval(() => {
        if (this.account && !document.hidden && !this.operation) this.refresh({ quiet: true }).catch(() => {});
      }, 45000);
      this.render();
    }
    startSession() {
      const session = this.session;
      globalThis.setTimeout(() => {
        if (this.account && session === this.session) this.refresh({ quiet: true }).catch(() => {});
      }, 0);
    }
    withdrawalStorageKey() { return this.account ? `fitia_farm_withdrawal_status_v1:${this.account}` : null; }
    loadWithdrawalStatuses() {
      this.withdrawalStatuses = {};
      const key = this.withdrawalStorageKey(); if (!key) return;
      try {
        const raw = localStorage.getItem(key); if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
        Object.entries(parsed).slice(-100).forEach(([id, status]) => {
          if (/^[0-9a-f-]{36}$/i.test(id) && ['pending', 'paid'].includes(status)) this.withdrawalStatuses[id] = status;
        });
      } catch (_) { this.withdrawalStatuses = {}; }
    }
    synchronizeWithdrawals(withdrawals) {
      const previous = this.withdrawalStatuses || {}; const next = { ...previous };
      withdrawals.forEach((withdrawal) => {
        if (!withdrawal?.id || !['pending', 'paid'].includes(withdrawal.status)) return;
        if (withdrawal.status === 'paid' && previous[withdrawal.id] === 'pending') {
          this.app.activity?.notify('success', 'FARM withdrawal paid', `${formatUnits(withdrawal.ftaUnits)} FTA · ${Number(withdrawal.coins).toLocaleString('en-US')} F-Coins`);
        }
        next[withdrawal.id] = previous[withdrawal.id] === 'paid' ? 'paid' : withdrawal.status;
      });
      this.withdrawalStatuses = Object.fromEntries(Object.entries(next).slice(-100));
      const key = this.withdrawalStorageKey();
      if (key) { try { localStorage.setItem(key, JSON.stringify(this.withdrawalStatuses)); } catch (_) { /* Notification history remains available in memory. */ } }
    }
    setAccount(account) {
      this.session += 1; this.account = account && ethers.isAddress(account) ? account.toLowerCase() : null;
      this.loadWithdrawalStatuses();
      this.state = null; this.revision = 0; this.withdrawals = []; this.aviator = null; this.pendingDeposit = null;
      this.refreshPromise = null; this.pendingCheck = null; this.operation = false; this.serverOffset = 0;
      clearTimeout(this.retryTimer); this.retryTimer = null;
      if (!this.account) this.setActive(false);
      else this.loadPendingDeposit();
      this.scene?.setState(emptyState(this.account || ''));
      this.render();
    }
    loadPendingDeposit() {
      if (!this.account) return;
      try {
        const value = JSON.parse(localStorage.getItem(`fitia_farm_pending_deposit_v1:${this.account}`) || 'null');
        if (value && Protocol.requireUuid(value.actionId) && Protocol.requireTxHash(value.txHash) && Protocol.requireUnits(value.amountUnits)) this.pendingDeposit = value;
      } catch (_) { this.pendingDeposit = null; }
    }
    savePendingDeposit() { writePendingDeposit(this.account, this.pendingDeposit); }
    enter() {
      this.setActive(true); this.render();
      requestAnimationFrame(() => { this.ensureScene(); this.scene?.setActive(true); });
      this.refresh({ quiet: false }).catch((error) => this.showError(error));
      this.checkPendingDeposit().catch(() => {});
    }
    exit() { this.setActive(false); }
    setActive(value) {
      this.active = Boolean(value); this.scene?.setActive(this.active);
      clearInterval(this.pollTimer); this.pollTimer = null;
      if (this.active && this.account) {
        this.pollTimer = globalThis.setInterval(() => {
          this.refresh({ quiet: true }).catch(() => {}); this.checkPendingDeposit().catch(() => {});
        }, 20000);
      }
    }
    ensureScene() {
      const container = document.getElementById('farm-3d-container');
      if (this.scene || !container || !this.account) return;
      try {
        this.scene = globalThis.FitiaFarm3D.create(container, {
          onSelect: (selection) => {
            if (selection.kind === 'plot') this.openPlant(selection.id);
            else if (selection.kind === 'building' && selection.id === 'mill') { if (this.economyGate('mill')) this.openMill(); }
            else if (selection.kind === 'building' && selection.id === 'barn') this.setTab('barn');
            else if (selection.kind === 'building' && selection.id === 'tractor') this.openTractor();
            else if (selection.kind === 'building' && selection.id === 'silo') this.openSilo();
            else if (selection.kind === 'building' && selection.id === 'well') { if (this.economyGate('water')) this.openWell(); }
            else if (selection.kind === 'building' && selection.id === 'care') { if (this.economyGate('care')) this.openCare(); }
            else this.openEntity(selection.kind, selection.id);
          },
          reducedMotion: () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
        });
        this.scene.setState(this.state || emptyState(this.account)); this.scene.setActive(this.active);
        document.getElementById('farm-3d-loading')?.classList.add('hidden');
      } catch (error) {
        const loading = document.getElementById('farm-3d-loading');
        if (loading) { loading.classList.remove('hidden'); loading.textContent = this.text('3D could not start on this device. Update Android System WebView, then reopen FITIA FARM.', 'La 3D ne peut pas démarrer sur cet appareil. Mettez à jour Android System WebView, puis rouvrez FITIA FARM.'); }
        this.showError(error);
      }
    }
    focusCamera(view) { this.scene?.focus(view); }
    zoomCamera(factor) { this.scene?.zoom(factor); }
    rotateCamera(direction) { this.scene?.rotate(direction); }
    assertSession(session = this.session) {
      if (!this.account || !this.app.signer || !this.app.user || this.app.user.toLowerCase() !== this.account || session !== this.session) {
        const error = new Error(ERROR_COPY.WALLET_SESSION_CHANGED); error.code = 'WALLET_SESSION_CHANGED'; throw error;
      }
    }
    async request(action, params = {}) {
      const session = this.session; this.assertSession(session);
      const body = { action, buyer: this.account, timestamp: Date.now(), ...params };
      body.signature = await this.app.signer.signMessage(Protocol.message(action, body));
      this.assertSession(session);
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 25000);
      let response; let data;
      try {
        response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: controller.signal });
        data = await response.json().catch(() => ({}));
      } catch (error) {
        const wrapped = new Error(error.name === 'AbortError' ? 'The farm server took too long to respond.' : 'Connect to the internet to synchronize FITIA FARM.');
        wrapped.code = 'FARM_NETWORK'; throw wrapped;
      } finally { clearTimeout(timeout); }
      this.assertSession(session);
      if (!response.ok) { const error = new Error(data.error || 'Farm request failed.'); error.code = data.code || 'FARM_ERROR'; error.status = response.status; throw error; }
      return data;
    }
    applyView(data) {
      if (!data?.state || !Array.isArray(data.state.animals) || !Array.isArray(data.state.crops)) throw new Error('Invalid farm response.');
      const revision = Number(data.revision || 0);
      if (data.aviator && typeof data.aviator === 'object') this.aviator = data.aviator;
      if (revision < this.revision) { this.app.fitaCrash?.render(); return; }
      this.revision = revision; this.state = data.state; this.withdrawals = Array.isArray(data.withdrawals) ? data.withdrawals : [];
      this.features = data.features && typeof data.features === 'object' ? data.features : { unvalidatedEconomy: false, liveExchange: false };
      if (Number.isSafeInteger(data.serverTime) && Math.abs(data.serverTime - Date.now()) < 8640000000000000) this.serverOffset = data.serverTime - Date.now();
      this.synchronizeWithdrawals(this.withdrawals);
      this.scene?.setState(this.state); this.render();
    }
    unvalidatedEconomyEnabled() { return this.features?.unvalidatedEconomy === true; }
    // Échange réel activé côté serveur : les retraits historiques sont refusés.
    liveExchangeEnabled() { return this.features?.liveExchange === true; }
    // Économie non validée : chaque point d’entrée vérifie le drapeau serveur ;
    // un dialogue « bientôt » reste possible s’il existe une action en attente
    // à résoudre. Le serveur rejette de toute façon ces actions tant que le
    // drapeau FITIA_FARM_UNVALIDATED_ECONOMY n’est pas activé.
    economyGate(kind) {
      if (this.unvalidatedEconomyEnabled()) return true;
      const pending = kind === 'mission' ? this.readPendingMission()
        : kind === 'care' ? this.readPendingCare()
        : kind === 'water' ? this.readPendingWater()
        : kind === 'mill' ? this.readPendingMill()
        : this.readPendingSpecial(kind);
      if (pending) return true;
      const fr = this.app.currentLang === 'fr';
      this.app.showToast(fr ? 'Cette fonctionnalité sera bientôt disponible.' : 'This feature is coming soon.', false);
      return false;
    }
    async refresh(options = {}) {
      if (!this.account || this.refreshPromise) return this.refreshPromise;
      const session = this.session;
      this.refreshPromise = (async () => {
        if (!options.quiet) this.setStatus(this.text('Synchronizing your farm…', 'Synchronisation de la ferme…'), 'working');
        try {
          const data = await this.request('state'); if (session !== this.session) return;
          this.applyView(data); this.setStatus('', 'online');
        } catch (error) { this.setStatus(this.text('Offline · retry shortly', 'Hors ligne · réessayez'), 'offline'); throw error; }
      })();
      try { return await this.refreshPromise; } finally { this.refreshPromise = null; }
    }
    setStatus(text, kind) {
      const status = document.getElementById('farm-sync-status'); if (status) status.textContent = text;
      const dot = document.getElementById('farm-sync-dot'); if (dot) dot.className = `farm-sync-dot ${kind || ''}`;
    }
    showError(error) {
      const message = (this.app.currentLang === 'fr' ? ERROR_COPY_FR[error?.code] : ERROR_COPY[error?.code]) || error?.message || this.text('FITIA FARM could not complete the action.', 'Action impossible sur FITIA FARM.');
      const dialogError = document.getElementById('farm-dialog-error');
      if (dialogError && document.getElementById('modal-farm-dialog')?.classList.contains('active')) dialogError.textContent = message;
      else this.app.showToast(message, true);
      if (error?.code === 'FARM_REVISION') this.refresh({ quiet: true }).catch(() => {});
    }
    setTab(tab) {
      this.tab = tab;
      document.querySelectorAll('[data-farm-tab]').forEach((button) => { const active = button.dataset.farmTab === tab; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
      document.querySelectorAll('[data-farm-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.farmPanel !== tab));
      this.focusCamera(tab);
    }
    started() { return Boolean(this.state?.land?.owned && this.state?.animals?.length); }
    serverNow() { return Date.now() + Number(this.serverOffset || 0); }
    render() {
      const state = this.state || emptyState(this.account || '');
      const byId = (id) => document.getElementById(id);
      if (!byId('view-farm')) return;
      byId('farm-coin-balance').textContent = Number(state.coins || 0).toLocaleString('en-US');
      byId('farm-animal-count').textContent = String(state.animals.length);
      byId('farm-crop-count').textContent = String(state.crops.length);
      byId('farm-feed-count').textContent = String(state.feed || 0);
      const inventoryValue = Object.keys(Config.PRODUCTS).reduce((sum, key) => sum + Number(state.inventory?.[key] || 0) * Config.PRODUCTS[key].price, 0);
      byId('farm-inventory-value').textContent = inventoryValue.toLocaleString('en-US');
      byId('farm-start-card').classList.toggle('hidden', this.started());
      byId('farm-land-check').classList.toggle('complete', Boolean(state.land?.owned));
      byId('farm-animal-check').classList.toggle('complete', state.animals.length > 0);
      byId('farm-land-status').textContent = state.land?.owned ? this.text('Owned', 'Possédé') : `${Config.LAND_PRICE} F-Coins`;
      byId('farm-animal-status').textContent = state.animals.length ? `${state.animals.length} ${this.text('owned', 'possédé(s)')}` : this.text('Required', 'Requis');
      byId('farm-buy-land').disabled = Boolean(state.land?.owned) || this.operation;
      byId('farm-buy-first-animal').disabled = !state.land?.owned || this.operation;
      document.querySelectorAll('[data-farm-requires-start]').forEach((button) => { button.disabled = !this.started() || this.operation; });
      if (this.liveExchangeEnabled()) {
        // Points d'entrée du retrait historique masqués : le client live prend
        // le relais (voir docs/FITIA-FARM-ACTIVATION.md). Le serveur refuse de
        // toute façon l'ancien chemin avec FARM_CLIENT_UPDATE_REQUIRED.
        document.querySelectorAll('#view-farm button[onclick*="openWithdraw"]').forEach((button) => { button.classList.add('hidden'); });
      }
      document.querySelectorAll('[data-farm-requires-land]').forEach((button) => { button.disabled = !state.land?.owned || this.operation; });
      byId('farm-deposit-pending').classList.toggle('hidden', !this.pendingDeposit);
      const pendingGame = byId('farm-game-pending'); if (pendingGame) { pendingGame.classList.toggle('hidden', !this.readPendingGameAction()); pendingGame.disabled = this.operation; }
      this.renderAnimals(); this.renderCrops(); this.renderPlotGrid(); this.renderInventory(); this.renderWithdrawals(); this.renderMarketSales(); this.renderProgress(); this.tick();
      this.app.luckyWheel?.render();
      this.app.fitaDice?.render();
      this.app.fitaMines?.render();
      this.app.fitaCrash?.render();
      this.app.fitaCoinFlip?.render();
    }
    renderAnimals() {
      const list = document.getElementById('farm-animal-list'); if (!list) return; list.textContent = '';
      document.getElementById('farm-animals-empty').classList.toggle('hidden', Boolean(this.state?.animals?.length));
      (this.state?.animals || []).forEach((animal) => {
        const definition = Config.ANIMALS[animal.species]; const card = make('article', 'farm-item-card');
        const icon = farmIcon(animal.species); const main = make('div', 'farm-item-main');
        main.append(make('strong', '', farmName(animal.species, this.app.currentLang)), make('small', '', `${farmName(definition.product, this.app.currentLang)} · ${durationLabel(definition.durationMs)} ${this.text('cycle', 'par cycle')}`));
        const status = make('span', `farm-item-status ${animal.produceAt && animal.produceAt <= this.serverNow() ? 'ready' : ''}`);
        status.dataset.farmAnimalStatus = animal.id; status.dataset.readyAt = animal.produceAt || 0;
        card.append(icon, main, status);
        const action = make('button', 'farm-small-button', animal.produceAt ? this.text('View production', 'Voir production') : this.text('Feed', 'Nourrir'));
        action.addEventListener('click', () => this.openEntity('animal', animal.id)); card.appendChild(action); list.appendChild(card);
      });
    }
    renderCrops() {
      const list = document.getElementById('farm-crop-list'); if (!list) return; list.textContent = '';
      document.getElementById('farm-crops-empty').classList.toggle('hidden', Boolean(this.state?.crops?.length));
      (this.state?.crops || []).forEach((crop) => {
        const definition = Config.CROPS[crop.species]; const card = make('article', 'farm-item-card');
        card.append(farmIcon(crop.species));
        const main = make('div', 'farm-item-main'); main.append(make('strong', '', farmName(crop.species, this.app.currentLang)), make('small', '', `${this.text('Yield', 'Rendement')} ${definition.yield} · ${farmName(crop.species, this.app.currentLang)}`));
        const status = make('span', `farm-item-status ${crop.readyAt <= this.serverNow() ? 'ready' : ''}`); status.dataset.farmCropStatus = crop.id; status.dataset.readyAt = crop.readyAt;
        const action = make('button', 'farm-small-button', crop.readyAt <= this.serverNow() ? this.text('Harvest', 'Récolter') : this.text('Growing', 'En pousse')); action.addEventListener('click', () => this.openEntity('crop', crop.id));
        card.append(main, status, action); list.appendChild(card);
      });
    }
    renderPlotGrid() {
      const grid = document.getElementById('farm-plot-grid'); if (!grid || !this.state) return;
      grid.textContent = '';
      const fr = this.app.currentLang === 'fr';
      for (let plot = 0; plot < Config.MAX_CROPS; plot += 1) {
        const crop = (this.state.crops || []).find((item, index) => (Number.isInteger(item.plot) ? item.plot : index) === plot);
        const button = make('button', 'pf-plot' + (crop ? ' occupied' : ''), ''); button.type = 'button';
        const species = crop ? (fr ? ({ wheat: 'Blé', carrot: 'Carotte', maize: 'Maïs', tomato: 'Tomate' }[crop.species] || crop.species) : NAMES[crop.species]) : (fr ? 'Disponible' : 'Available');
        button.append(make('strong', '', `${fr ? 'Parcelle' : 'Plot'} ${plot + 1}`), make('span', '', species));
        button.disabled = !this.started() || this.operation;
        button.addEventListener('click', () => crop ? this.openEntity('crop', crop.id) : this.openPlant(plot));
        grid.appendChild(button);
      }
    }
    renderInventory() {
      const list = document.getElementById('farm-inventory-list'); if (!list) return; list.textContent = '';
      Object.entries(Config.PRODUCTS).forEach(([key, product]) => {
        const card = make('article', 'farm-inventory-item'); card.append(farmIcon(key), make('strong', '', this.state?.inventory?.[key] || 0), make('small', '', `${farmName(key, this.app.currentLang)} · ${product.price} F-Coins`)); list.appendChild(card);
      });
      const empty = Object.values(this.state?.inventory || {}).every((quantity) => !quantity);
      const sell = document.getElementById('farm-sell-inventory');
      // A lost response must remain recoverable even when the committed sale emptied the barn.
      if (sell) sell.disabled = (empty && !this.readPendingMarketSale()) || !this.started() || this.operation;
    }
    renderProgress() {
      const container = document.getElementById('farm-missions'); const level = document.getElementById('farm-level');
      if (!container || !level) return;
      const fr = this.app.currentLang === 'fr'; const values = this.state?.farmProgress || {};
      const countFor = (key) => Number.isSafeInteger(values[key]) && values[key] >= 0 ? values[key] : 0;
      const currentLevel = Config.progressLevel(values);
      level.textContent = `${fr ? 'Niveau' : 'Level'} ${currentLevel}`;
      const unlocks = document.getElementById('farm-unlocks');
      if (unlocks) {
        unlocks.textContent = '';
        for (const reward of Config.COSMETIC_UNLOCKS) {
          const name = reward.key === 'flowers' ? (fr ? 'Jardin fleuri' : 'Flower garden') : (fr ? 'Lanternes' : 'Lanterns');
          const status = currentLevel >= reward.level ? (fr ? 'Débloqué' : 'Unlocked') : `${fr ? 'Niveau' : 'Level'} ${reward.level}`;
          unlocks.append(make('span', 'pf-unlock', `${name} · ${status}`));
        }
      }
      if (!this.unvalidatedEconomyEnabled()) {
        // Économie non validée : missions masquées tant que le serveur ne les
        // active pas (les compteurs restent suivis, sans réclamation).
        container.textContent = '';
        container.classList.add('hidden');
        return;
      }
      container.classList.remove('hidden');
      const labels = fr ? { planted: 'Planter', watered: 'Arroser', cared: 'Soigner', harvested: 'Récolter', collected: 'Collecter', sales: 'Vendre', fertilized: 'Fertiliser', bred: 'Reproduire', fed: 'Nourrir', milled: 'Moudre' }
        : { planted: 'Plant', watered: 'Water', cared: 'Care', harvested: 'Harvest', collected: 'Collect', sales: 'Sell', fertilized: 'Fertilize', bred: 'Breed', fed: 'Feed', milled: 'Mill' };
      container.textContent = '';
      Config.MISSIONS.forEach((mission) => {
        const count = countFor(mission.key); const current = Math.min(count, mission.target);
        const button = make('button', `pf-mission${count >= mission.target ? ' complete' : ''}`); button.type = 'button';
        const claimed = this.state?.missionClaims?.[mission.key] === true;
        const rewardStatus = claimed ? (fr ? 'Reçue' : 'Claimed') : count >= mission.target ? (fr ? 'À récupérer' : 'Ready to claim') : `+${mission.reward} F-Coins`;
        button.append(make('strong', '', labels[mission.key]), make('span', '', `${current} / ${mission.target} · ${rewardStatus}`));
        const bar = make('progress'); bar.max = mission.target; bar.value = current; bar.setAttribute('aria-label', `${labels[mission.key]} ${current} / ${mission.target}`); button.appendChild(bar);
        button.addEventListener('click', () => {
          if (this.readPendingMission() || (count >= mission.target && !claimed)) { this.openMission(mission.key); return; }
          if (mission.key === 'fertilized') { this.openFertilizer(); return; }
          if (mission.key === 'bred') { this.openBreeding(); return; }
          if (mission.key === 'milled') { this.openMill(); return; }
          if (mission.key === 'fed') { this.setTab('animals'); return; }
          if (mission.key === 'planted' || mission.key === 'watered') this.setTab('crops');
          else if (mission.key === 'harvested') this.setTab('crops');
          else if (mission.key === 'collected' || mission.key === 'cared') this.setTab('animals');
          else this.setTab('barn');
        });
        container.appendChild(button);
      });
    }
    renderMarketSales() {
      const list = document.getElementById('farm-market-history'); if (!list) return;
      list.textContent = '';
      const sales = Array.isArray(this.state?.marketSales) ? this.state.marketSales : [];
      document.getElementById('farm-market-history-empty')?.classList.toggle('hidden', sales.length > 0);
      const fr = this.app.currentLang === 'fr';
      const names = fr ? { wheat: 'Blé', carrot: 'Carotte', maize: 'Maïs', tomato: 'Tomate', eggs: 'Œufs', wool: 'Laine', milk: 'Lait' } : NAMES;
      sales.slice(0, 25).forEach((sale) => {
        const row = make('article', 'pf-market-sale');
        const details = make('div');
        details.append(make('span', '', sale.items.map(item => `${item.quantity} × ${names[item.product] || item.product}`).join(' · ')));
        details.append(make('small', '', new Date(sale.at).toLocaleString(fr ? 'fr-FR' : 'en-US')));
        row.append(details, make('strong', '', `${sale.total} F-Coins`)); list.appendChild(row);
      });
    }
    renderWithdrawals() {
      const list = document.getElementById('farm-withdrawal-list'); if (!list) return; list.textContent = '';
      document.getElementById('farm-withdrawals-empty').classList.toggle('hidden', this.withdrawals.length > 0);
      this.withdrawals.slice(0, 6).forEach((withdrawal) => {
        const row = make('article', 'farm-withdrawal-row');
        const main = make('div'); main.append(make('strong', '', `${formatUnits(withdrawal.ftaUnits)} FTA`), make('small', '', `${withdrawal.coins} F-Coins · ${new Date(withdrawal.createdAt).toLocaleDateString(this.app.currentLang === 'fr' ? 'fr-FR' : 'en-US')}`));
        const status = make('span', `farm-withdrawal-status ${withdrawal.status}`, withdrawal.status === 'paid' ? this.text('PAID', 'PAYÉ') : this.text('PENDING', 'EN ATTENTE')); row.append(main, status); list.appendChild(row);
      });
    }
    tick() {
      if (!this.state || !document.getElementById('view-farm')) return;
      this.state.animals.forEach((animal) => {
        const element = document.querySelector(`[data-farm-animal-status="${animal.id}"]`); if (!element) return;
        element.textContent = animal.maturesAt > this.serverNow() ? `${this.text('Growing', 'En croissance')} · ${countdown(animal.maturesAt - this.serverOffset)}` : !animal.produceAt ? this.text('Ready to feed', 'Prêt à nourrir') : animal.produceAt <= this.serverNow() ? `${farmName(Config.ANIMALS[animal.species].product, this.app.currentLang)} ${this.text('ready', 'prêt')}` : `${this.text('Producing', 'En production')} · ${countdown(animal.produceAt - this.serverOffset)}`;
        element.classList.toggle('ready', Boolean(animal.produceAt && animal.produceAt <= this.serverNow()));
      });
      this.state.crops.forEach((crop) => {
        const element = document.querySelector(`[data-farm-crop-status="${crop.id}"]`); if (!element) return;
        element.textContent = crop.readyAt <= this.serverNow() ? this.text('Ready to harvest', 'Prêt à récolter') : `${this.text('Growing', 'En pousse')} · ${countdown(crop.readyAt - this.serverOffset)}`;
        element.classList.toggle('ready', crop.readyAt <= this.serverNow());
      });
    }
    openDialog(title, subtitle) {
      const modal = document.getElementById('modal-farm-dialog');
      document.getElementById('farm-dialog-title').textContent = title;
      const subtitleElement = document.getElementById('farm-dialog-subtitle');
      subtitleElement.textContent = subtitle || ''; subtitleElement.classList.toggle('hidden', !subtitle);
      document.getElementById('farm-dialog-content').textContent = '';
      document.getElementById('farm-dialog-actions').textContent = '';
      document.getElementById('farm-dialog-error').textContent = '';
      modal.classList.add('active'); return modal;
    }
    closeDialog() { document.getElementById('modal-farm-dialog')?.classList.remove('active'); }
    addDialogButton(label, handler, secondary = false, disabled = false) {
      const button = make('button', secondary ? 'btn-secondary-outline' : 'btn-primary', label); button.type = 'button'; button.disabled = disabled;
      button.addEventListener('click', handler); document.getElementById('farm-dialog-actions').appendChild(button); return button;
    }
    gamePendingKey() { return this.account ? `fitia_farm_game_pending_v1:${this.account}` : null; }
    readPendingGameAction() {
      const key = this.gamePendingKey(); if (!key) return null;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || 'null'); if (!pending) return null;
        Protocol.requireUuid(pending.actionId);
        if (!['buy_land', 'buy_animal', 'buy_feed', 'plant', 'feed', 'collect', 'harvest', 'sell', 'customize_building', 'move_building'].includes(pending.type)) throw new Error('Invalid action');
        if (!pending.params || typeof pending.params !== 'object' || Array.isArray(pending.params)) throw new Error('Invalid params');
        Protocol.normalizeParams(pending.params); return pending;
      } catch (_) { return { invalid: true }; }
    }
    openPendingGameAction() {
      const pending = this.readPendingGameAction(); if (!pending) return;
      this.openDialog(this.text('Pending farm action', 'Action de ferme en attente'));
      const content = document.getElementById('farm-dialog-content');
      content.append(make('p', 'farm-dialog-copy', pending.invalid
        ? this.text('The saved action cannot be read. Do not repeat it; technical assistance is required.', 'L’action enregistrée est illisible. Ne la répétez pas ; une vérification technique est nécessaire.')
        : this.text('Check the saved action or cancel it if it was not completed.', 'Vérifiez l’action enregistrée ou annulez-la si elle n’a pas été effectuée.')));
      if (!pending.invalid) {
        this.addDialogButton(this.text('CHECK ACTION', 'VÉRIFIER L’ACTION'), () => this.perform(pending.type, pending.params), false, this.operation);
        this.addPendingResolution(this.gamePendingKey(), pending);
      }
    }
    async perform(type, params = {}) {
      if (this.operation || !this.account) return;
      const key = this.gamePendingKey(), existing = this.readPendingGameAction();
      if (existing && (existing.invalid || existing.type !== type || JSON.stringify(existing.params) !== JSON.stringify(params))) {
        this.openPendingGameAction(); return;
      }
      const pending = existing || { actionId: uuid(), type, params: Protocol.normalizeParams(params) };
      try {
        if (!existing) { localStorage.setItem(key, JSON.stringify(pending)); if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable'); }
      } catch (_) { this.showError(new Error(this.text('Cannot save the action safely.', 'Impossible de sauvegarder l’action en sécurité.'))); return; }
      const session = this.session; let reopenMove = false; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: pending.actionId, type: pending.type, params: pending.params });
        this.assertSession(session); this.applyView(data); localStorage.removeItem(key); this.closeDialog(); this.app.showToast(this.success(type));
        if (type === 'buy_animal') this.setTab('animals'); if (type === 'plant') this.setTab('crops');
        reopenMove = type === 'move_building';
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); if (reopenMove && this.session === session) this.openBuildingPositions(params.building); }
    }
    openBuyLand() {
      this.openDialog('Terrain');
      const content = document.getElementById('farm-dialog-content');
      content.append(farmVisual('terrain'), make('strong', 'farm-dialog-price', `${Config.LAND_PRICE} F-Coins`));
      this.addDialogButton(`${this.text('BUY TERRAIN', 'ACHETER LE TERRAIN')} · ${Config.LAND_PRICE} F-COINS`, () => this.perform('buy_land'), false, Boolean(this.state?.land?.owned));
    }
    openBuyAnimal() {
      if (!this.state?.land?.owned) { this.openBuyLand(); return; }
      this.openDialog(this.text('Animals', 'Animaux'));
      const grid = make('div', 'farm-shop-grid'); document.getElementById('farm-dialog-content').appendChild(grid);
      Object.entries(Config.ANIMALS).forEach(([species, animal]) => {
        const card = make('article', 'farm-shop-card'); card.append(farmIcon(species, 'farm-shop-icon'), make('strong', '', farmName(species, this.app.currentLang)), make('small', '', `${farmName(animal.product, this.app.currentLang)} · ${durationLabel(animal.durationMs)}`), make('b', '', `${animal.price} F-Coins`));
        const button = make('button', 'farm-small-button', this.text('BUY', 'ACHETER')); button.disabled = this.operation || this.state.animals.length >= Config.MAX_ANIMALS;
        button.addEventListener('click', () => this.perform('buy_animal', { species })); card.appendChild(button); grid.appendChild(card);
      });
    }
    async resolveGameAction(key, pending) {
      if (this.operation || !this.account || !key || !pending || pending.invalid) return;
      const session = this.session; this.operation = true; this.render();
      try {
        // Server atomically reserves the id if it has not committed; never use
        // this for deposits or withdrawal requests.
        const data = await this.request('resolve', { actionId: pending.actionId });
        this.assertSession(session);
        if (!['cancelled', 'committed'].includes(data.status)) throw new Error('Invalid resolution response');
        this.applyView(data); localStorage.removeItem(key); this.closeDialog();
        this.app.showToast(data.status === 'committed'
          ? this.text('The action was already completed.', 'L’action avait déjà été effectuée.')
          : this.text('The action was cancelled without being performed.', 'L’action a été annulée sans être effectuée.'));
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    addPendingResolution(key, pending) {
      if (!pending.invalid) this.addDialogButton(this.text('CANCEL IF NOT COMPLETED', 'ANNULER SI NON EFFECTUÉE'), () => this.resolveGameAction(key, pending), true, this.operation);
    }
    plotPendingKey() { return this.account ? `fitia_farm_plot_pending_v1:${this.account}` : null; }
    readPendingPlot() {
      const key = this.plotPendingKey(); if (!key) return null;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || 'null');
        if (!pending) return null;
        Protocol.requireUuid(pending.actionId);
        if (!Object.prototype.hasOwnProperty.call(Config.CROPS, pending.species) || !Number.isInteger(pending.plot) || pending.plot < 0 || pending.plot >= Config.MAX_CROPS) throw new Error('Invalid pending planting');
        return pending;
      } catch (_) { return { invalid: true }; }
    }
    async performPlotPlant(species, plot) {
      if (this.operation || !this.account) return;
      const key = this.plotPendingKey(); const existing = this.readPendingPlot();
      if (existing?.invalid) { this.showError(new Error(this.text('Pending planting could not be read.', 'Impossible de lire la plantation en attente.'))); return; }
      if (existing && (existing.species !== species || existing.plot !== plot)) { this.showError(new Error(this.text('Resolve the pending planting first.', 'Résolvez d’abord la plantation en attente.'))); return; }
      const pending = existing || { actionId: uuid(), species, plot };
      try {
        if (!existing) {
          localStorage.setItem(key, JSON.stringify(pending));
          if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable');
        }
      } catch (_) { this.showError(new Error(this.text('Cannot safely save the pending planting.', 'Impossible de sauvegarder la plantation en attente.'))); return; }
      const session = this.session; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: pending.actionId, type: 'plant_plot', params: { species, plot } });
        this.assertSession(session); this.applyView(data); localStorage.removeItem(key);
        this.closeDialog(); this.app.showToast(this.success('plant_plot')); this.setTab('crops');
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    openPlant(requestedPlot) {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      const fr = this.app.currentLang === 'fr';
      const pending = this.readPendingPlot();
      this.openDialog(fr ? 'Cultures' : 'Crops');
      const content = document.getElementById('farm-dialog-content');
      if (pending) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Une plantation attend sa confirmation. Réessayez pour retrouver son résultat sans payer deux fois.' : 'A planting awaits confirmation. Retry to recover its result without paying twice.'));
        if (!pending.invalid) this.addDialogButton(fr ? 'VÉRIFIER LA PLANTATION' : 'CHECK PLANTING', () => this.performPlotPlant(pending.species, pending.plot), false, this.operation);
        this.addPendingResolution(this.plotPendingKey(), pending);
        return;
      }
      const occupied = new Set(this.state.crops.map((crop, index) => Number.isInteger(crop.plot) ? crop.plot : index));
      const plot = Number.isInteger(requestedPlot) ? requestedPlot : Array.from({ length: Config.MAX_CROPS }, (_, index) => index).find((index) => !occupied.has(index));
      if (!Number.isInteger(plot) || plot < 0 || plot >= Config.MAX_CROPS || occupied.has(plot)) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Cette parcelle est occupée ou aucune parcelle n’est disponible.' : 'This plot is occupied or no plot is available.'));
        return;
      }
      content.append(make('strong', 'farm-dialog-price', `${fr ? 'Parcelle' : 'Plot'} ${plot + 1}`));
      const grid = make('div', 'farm-shop-grid'); content.appendChild(grid);
      Object.entries(Config.CROPS).forEach(([species, crop]) => {
        const name = fr ? ({ wheat: 'Blé', carrot: 'Carotte', maize: 'Maïs', tomato: 'Tomate' }[species] || species) : NAMES[species];
        const card = make('article', 'farm-shop-card'); card.append(farmIcon(species, 'farm-shop-icon'), make('strong', '', name), make('small', '', `${crop.yield} ${fr ? 'unités' : 'units'} · ${durationLabel(crop.durationMs)}`), make('b', '', `${crop.price} F-Coins`));
        const button = make('button', 'farm-small-button', fr ? 'PLANTER' : 'PLANT'); button.disabled = this.operation;
        button.addEventListener('click', () => this.performPlotPlant(species, plot)); card.appendChild(button); grid.appendChild(card);
      });
    }
    openBuyFeed() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      this.openDialog(this.text('Animal feed', 'Nourriture pour animaux'));
      const content = document.getElementById('farm-dialog-content'); content.append(farmVisual('feed'), make('strong', 'farm-dialog-price', `${Config.FEED_PACK_QUANTITY} ${this.text('feed', 'nourritures')} · ${Config.FEED_PACK_PRICE} F-Coins`));
      this.addDialogButton(this.text('BUY FEED PACK', 'ACHETER LA NOURRITURE'), () => this.perform('buy_feed'), false, this.operation);
    }
    layoutPendingKey() { return this.account ? `fitia_farm_layout_pending_v1:${this.account}` : null; }
    readPendingLayout() {
      const key = this.layoutPendingKey(); if (!key) return null;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || 'null'); if (!pending) return null;
        if (pending.layout !== 0 && pending.layout !== 1) throw new Error('Invalid layout');
        return { actionId: Protocol.requireUuid(pending.actionId), layout: pending.layout };
      } catch (_) { return { invalid: true }; }
    }
    openLayout() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      const fr = this.app.currentLang === 'fr', pending = this.readPendingLayout();
      this.openDialog(fr ? 'Aménagement' : 'Farm layout'); const content = document.getElementById('farm-dialog-content');
      if (pending) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Un changement attend sa confirmation.' : 'A change awaits confirmation.'));
        if (!pending.invalid) this.addDialogButton(fr ? 'VÉRIFIER' : 'CHECK', () => this.performLayout(pending.layout), false, this.operation);
        this.addPendingResolution(this.layoutPendingKey(), pending); return;
      }
      content.append(make('p', 'farm-dialog-copy', fr ? 'Déplacez et personnalisez les bâtiments. Gratuit, sans effet sur la production. Les plans réorganisent la grange et la maison.' : 'Move and customize buildings for free without changing production. The presets rearrange the barn and house.'));
      this.addDialogButton(fr ? 'DÉPLACER UN BÂTIMENT' : 'MOVE A BUILDING', () => this.openBuildingPositions('barn'), false, this.operation);
      this.addDialogButton(fr ? 'COULEURS DES BÂTIMENTS' : 'BUILDING COLORS', () => this.openBuildingStyles(), true, this.operation);
      for (const layout of [0, 1]) {
        const active = Config.validBuildingPositions(this.state.buildingPositions) ? this.state.buildingPositions : Config.layoutPositions(this.state.farmLayout);
        const preset = Config.layoutPositions(layout);
        const current = ['barn', 'care'].every(key => active[key].x === preset[key].x && active[key].z === preset[key].z);
        const possible = Config.validBuildingPositions({ ...active, barn: preset.barn, care: preset.care });
        this.addDialogButton(`${fr ? 'PLAN' : 'LAYOUT'} ${layout + 1}${current ? (fr ? ' · ACTUEL' : ' · CURRENT') : !possible ? (fr ? ' · BLOQUÉ' : ' · BLOCKED') : ''}`, () => this.performLayout(layout), layout === 1, this.operation || current || !possible);
      }
    }
    openBuildingPositions(building = 'barn') {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      if (!Object.prototype.hasOwnProperty.call(Config.BUILDING_ZONES, building)) return;
      const fr = this.app.currentLang === 'fr';
      this.openDialog(fr ? 'Déplacer un bâtiment' : 'Move a building');
      const content = document.getElementById('farm-dialog-content');
      content.append(make('p', 'farm-dialog-copy', fr
        ? 'Choisissez un bâtiment puis déplacez-le dans sa zone. Les cases occupées sont bloquées.'
        : 'Choose a building, then move it within its area. Occupied spaces are blocked.'));
      const positions = Config.validBuildingPositions(this.state.buildingPositions) ? this.state.buildingPositions : Config.layoutPositions(this.state.farmLayout);
      const selector = make('div', 'farm-move-selector');
      const names = fr ? { barn: 'Grange', care: 'Maison', mill: 'Moulin', well: 'Puits', silo: 'Silo', tractor: 'Tracteur' } : { barn: 'Barn', care: 'House', mill: 'Mill', well: 'Well', silo: 'Silo', tractor: 'Tractor' };
      for (const id of Object.keys(Config.BUILDING_ZONES)) {
        const label = names[id];
        const button = make('button', 'farm-style-choice', label); button.type = 'button';
        button.setAttribute('aria-pressed', String(id === building)); button.disabled = this.operation;
        button.addEventListener('click', () => this.openBuildingPositions(id)); selector.appendChild(button);
      }
      content.appendChild(selector);
      const current = positions[building];
      content.append(make('p', 'farm-dialog-copy', `${fr ? 'Position' : 'Position'} : ${current.x}, ${current.z}`));
      const grid = make('div', 'farm-move-controls');
      for (const [label, dx, dz, description] of [[fr ? 'Haut' : 'Up', 0, -0.25, fr ? 'Reculer' : 'Move back'], [fr ? 'Gauche' : 'Left', -0.25, 0, fr ? 'À gauche' : 'Move left'], [fr ? 'Droite' : 'Right', 0.25, 0, fr ? 'À droite' : 'Move right'], [fr ? 'Bas' : 'Down', 0, 0.25, fr ? 'Avancer' : 'Move forward']]) {
        const next = { x: current.x + dx, z: current.z + dz };
        const candidate = { ...positions, [building]: next };
        const button = make('button', 'farm-move-button', label); button.type = 'button'; button.setAttribute('aria-label', description);
        button.disabled = this.operation || !Config.validBuildingPositions(candidate);
        button.addEventListener('click', () => this.perform('move_building', { building, ...next })); grid.appendChild(button);
      }
      content.appendChild(grid);
      this.addDialogButton(fr ? 'VOIR LA FERME' : 'VIEW FARM', () => { this.closeDialog(); this.focusCamera('overview'); }, false, this.operation);
      this.addDialogButton(fr ? 'RETOUR' : 'BACK', () => this.openLayout(), true, this.operation);
    }
    openBuildingStyles() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      const fr = this.app.currentLang === 'fr';
      this.openDialog(fr ? 'Personnaliser les bâtiments' : 'Customize buildings');
      const content = document.getElementById('farm-dialog-content');
      content.append(make('p', 'farm-dialog-copy', fr ? 'Choisissez une couleur gratuite pour chaque bâtiment. La production ne change pas.' : 'Choose a free color for each building. Production does not change.'));
      const colors = fr ? { barn: ['Rouge', 'Vert', 'Bois'], care: ['Crème', 'Vert pâle', 'Bleu pâle'], mill: ['Pierre', 'Vert', 'Sable'], well: ['Pierre', 'Vert', 'Sable'], silo: ['Métal', 'Vert', 'Bleu'], tractor: ['Vert', 'Rouge', 'Bleu'] }
        : { barn: ['Red', 'Green', 'Wood'], care: ['Cream', 'Pale green', 'Pale blue'], mill: ['Stone', 'Green', 'Sand'], well: ['Stone', 'Green', 'Sand'], silo: ['Metal', 'Green', 'Blue'], tractor: ['Green', 'Red', 'Blue'] };
      const names = fr ? { barn: 'Grange', care: 'Maison', mill: 'Moulin', well: 'Puits', silo: 'Silo', tractor: 'Tracteur' } : { barn: 'Barn', care: 'House', mill: 'Mill', well: 'Well', silo: 'Silo', tractor: 'Tractor' };
      for (const building of Object.keys(Config.BUILDING_STYLES)) {
        const title = names[building];
        const group = make('section', 'farm-style-group'); group.append(make('strong', '', title));
        Config.BUILDING_STYLES[building].forEach((hex, style) => {
          const button = make('button', 'farm-style-choice', colors[building][style]); button.type = 'button';
          button.style.setProperty('--farm-style-color', `#${hex.toString(16).padStart(6, '0')}`);
          const active = (this.state.buildingStyle?.[building] || 0) === style;
          button.setAttribute('aria-pressed', String(active)); button.disabled = this.operation || active;
          button.addEventListener('click', () => this.perform('customize_building', { building, style })); group.appendChild(button);
        });
        content.appendChild(group);
      }
    }
    async performLayout(layout) {
      if (this.operation || !this.account || (layout !== 0 && layout !== 1)) return;
      const key = this.layoutPendingKey(), existing = this.readPendingLayout();
      if (existing?.invalid) { this.showError(new Error(this.text('Pending layout cannot be read.', 'Impossible de lire l’aménagement en attente.'))); return; }
      if (existing && existing.layout !== layout) { this.showError(new Error(this.text('Resolve the pending layout first.', 'Résolvez d’abord l’aménagement en attente.'))); return; }
      const pending = existing || { actionId: uuid(), layout };
      try { if (!existing) { localStorage.setItem(key, JSON.stringify(pending)); if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable'); } }
      catch (_) { this.showError(new Error(this.text('Cannot save the pending layout.', 'Impossible de sauvegarder l’aménagement en attente.'))); return; }
      const session = this.session; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: pending.actionId, type: 'change_layout', params: { layout: pending.layout } });
        this.assertSession(session); this.applyView(data); localStorage.removeItem(key); this.closeDialog(); this.app.showToast(this.success('change_layout'));
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    missionPendingKey() { return this.account ? `fitia_farm_mission_pending_v1:${this.account}` : null; }
    readPendingMission() {
      const key = this.missionPendingKey(); if (!key) return null;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || 'null'); if (!pending) return null;
        if (!Config.MISSIONS.some(item => item.key === pending.missionKey)) throw new Error('Invalid mission');
        return { actionId: Protocol.requireUuid(pending.actionId), missionKey: pending.missionKey };
      } catch (_) { return { invalid: true }; }
    }
    openMission(key) {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      if (!this.economyGate('mission')) return;
      const pending = this.readPendingMission(); const fr = this.app.currentLang === 'fr';
      this.openDialog(fr ? 'Récompense de mission' : 'Mission reward');
      const content = document.getElementById('farm-dialog-content');
      if (pending) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Une récompense attend sa confirmation.' : 'A reward is awaiting confirmation.'));
        if (!pending.invalid) this.addDialogButton(fr ? 'VÉRIFIER' : 'CHECK', () => this.performMission(pending.missionKey), false, this.operation);
        this.addPendingResolution(this.missionPendingKey(), pending); return;
      }
      const mission = Config.MISSIONS.find(item => item.key === key); if (!mission) return;
      const claimed = this.state.missionClaims?.[key] === true;
      const ready = (this.state.farmProgress?.[key] || 0) >= mission.target;
      content.append(make('strong', 'farm-dialog-price', `${mission.reward} F-Coins`));
      content.append(make('p', 'farm-dialog-copy', claimed ? (fr ? 'Récompense déjà reçue.' : 'Reward already claimed.') : (fr ? 'Récompense unique par mission.' : 'One reward per mission.')));
      if (!claimed) this.addDialogButton(fr ? 'RÉCUPÉRER' : 'CLAIM', () => this.performMission(key), false, this.operation || !ready);
    }
    async performMission(missionKey) {
      if (this.operation || !this.account) return;
      const key = this.missionPendingKey(); const existing = this.readPendingMission();
      if (existing?.invalid) { this.showError(new Error(this.text('Pending reward cannot be read.', 'Impossible de lire la récompense en attente.'))); return; }
      if (existing && existing.missionKey !== missionKey) { this.showError(new Error(this.text('Resolve the pending reward first.', 'Résolvez d’abord la récompense en attente.'))); return; }
      if (!Config.MISSIONS.some(item => item.key === missionKey)) return;
      const pending = existing || { actionId: uuid(), missionKey };
      try {
        if (!existing) { localStorage.setItem(key, JSON.stringify(pending)); if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable'); }
      } catch (_) { this.showError(new Error(this.text('Cannot safely save the pending reward.', 'Impossible de sauvegarder la récompense en attente.'))); return; }
      const session = this.session; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: pending.actionId, type: 'claim_mission', params: { missionKey: pending.missionKey } });
        this.assertSession(session); this.applyView(data); localStorage.removeItem(key); this.closeDialog(); this.app.showToast(this.success('claim_mission'));
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    specialPendingKey(kind) { return this.account ? `fitia_farm_${kind}_pending_v1:${this.account}` : null; }
    readPendingSpecial(kind) {
      const key = this.specialPendingKey(kind); if (!key) return null;
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null'); if (!value) return null;
        const id = Protocol.requireUuid(value.actionId);
        if (kind === 'fertilize') return { actionId: id, cropId: Protocol.requireUuid(value.cropId) };
        if (kind !== 'breed' || !Array.isArray(value.parentIds) || value.parentIds.length !== 2) throw new Error('Invalid selection');
        const parentIds = value.parentIds.map(Protocol.requireUuid);
        if (parentIds[0] === parentIds[1]) throw new Error('Duplicate');
        return { actionId: id, parentIds };
      } catch (_) { return { invalid: true }; }
    }
    async performSpecial(kind, selection) {
      if (this.operation || !this.account || !['breed', 'fertilize'].includes(kind)) return;
      const key = this.specialPendingKey(kind); const existing = this.readPendingSpecial(kind);
      if (existing?.invalid) { this.showError(new Error(this.text('Pending action cannot be read.', 'Impossible de lire l’action en attente.'))); return; }
      const candidate = kind === 'breed' ? { parentIds: selection } : { cropId: selection };
      if (existing && JSON.stringify(kind === 'breed' ? existing.parentIds : existing.cropId) !== JSON.stringify(selection)) {
        this.showError(new Error(this.text('Resolve the pending action first.', 'Résolvez d’abord l’action en attente.'))); return;
      }
      const pending = existing || { actionId: uuid(), ...candidate };
      try {
        if (!existing) { localStorage.setItem(key, JSON.stringify(pending)); if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable'); }
      } catch (_) { this.showError(new Error(this.text('Cannot safely save the pending action.', 'Impossible de sauvegarder l’action en attente.'))); return; }
      const session = this.session; this.operation = true; this.render();
      const type = kind === 'breed' ? 'breed_animal' : 'fertilize_crop';
      const params = kind === 'breed' ? { parentIds: pending.parentIds } : { cropId: pending.cropId };
      try {
        const data = await this.request('action', { actionId: pending.actionId, type, params });
        this.assertSession(session); this.applyView(data); localStorage.removeItem(key); this.closeDialog(); this.app.showToast(this.success(type)); this.setTab(kind === 'breed' ? 'animals' : 'crops');
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    openBreeding() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      if (!this.economyGate('breed')) return;
      const fr = this.app.currentLang === 'fr'; const pending = this.readPendingSpecial('breed'); this.openDialog(fr ? 'Reproduction' : 'Breeding');
      const content = document.getElementById('farm-dialog-content');
      if (pending) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Une reproduction attend sa confirmation.' : 'A breeding action awaits confirmation.'));
        if (!pending.invalid) this.addDialogButton(fr ? 'VÉRIFIER' : 'CHECK', () => this.performSpecial('breed', pending.parentIds), false, this.operation);
        this.addPendingResolution(this.specialPendingKey('breed'), pending); return;
      }
      content.append(make('p', 'farm-dialog-copy', fr ? `Deux animaux adultes de même espèce, disponibles. Coût : ${Config.BREED_PRICE_PERCENT} % du prix de l’animal + ${Config.BREED_FEED_COST} nourriture. Le petit grandit pendant un cycle avant de produire.` : `Two available adult animals of the same species. Cost: ${Config.BREED_PRICE_PERCENT}% of the animal price + ${Config.BREED_FEED_COST} feed. The young animal grows for one cycle before producing.`));
      const available = this.state.animals.filter(a => !a.produceAt && !(a.maturesAt > this.serverNow())); let pairs = 0;
      for (let i = 0; i < available.length; i++) for (let j = i + 1; j < available.length; j++) {
        const a = available[i], b = available[j]; if (a.species !== b.species) continue; pairs++;
        const n1 = this.state.animals.findIndex(item => item.id === a.id) + 1, n2 = this.state.animals.findIndex(item => item.id === b.id) + 1;
        const price = Math.ceil(Config.ANIMALS[a.species].price * Config.BREED_PRICE_PERCENT / 100);
        this.addDialogButton(`${farmName(a.species, this.app.currentLang)} ${n1} + ${n2} · ${price} F-Coins + ${Config.BREED_FEED_COST} ${fr ? 'nourriture' : 'feed'}`, () => this.performSpecial('breed', [a.id, b.id]), false, this.operation || this.state.animals.length >= Config.MAX_ANIMALS || this.state.coins < price || this.state.feed < Config.BREED_FEED_COST);
      }
      if (!pairs) content.append(make('p', 'farm-dialog-copy', fr ? 'Aucune paire disponible.' : 'No pair available.'));
    }
    openFertilizer() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      if (!this.economyGate('fertilize')) return;
      const fr = this.app.currentLang === 'fr'; const pending = this.readPendingSpecial('fertilize'); this.openDialog(fr ? 'Engrais' : 'Fertilizer');
      const content = document.getElementById('farm-dialog-content');
      if (pending) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Une application attend sa confirmation.' : 'An application awaits confirmation.'));
        if (!pending.invalid) this.addDialogButton(fr ? 'VÉRIFIER' : 'CHECK', () => this.performSpecial('fertilize', pending.cropId), false, this.operation);
        this.addPendingResolution(this.specialPendingKey('fertilize'), pending); return;
      }
      content.append(make('p', 'farm-dialog-copy', fr ? `Coût : ${Config.FERTILIZER_PRICE} F-Coins. Une application par culture : réduit le temps initial de ${Config.FERTILIZER_PERCENT} %, sans augmenter le rendement.` : `Cost: ${Config.FERTILIZER_PRICE} F-Coins. Once per crop: reduces initial growth time by ${Config.FERTILIZER_PERCENT}%, without increasing yield.`));
      const crops = this.state.crops.filter(c => !c.fertilizedAt && c.readyAt > this.serverNow());
      if (!crops.length) content.append(make('p', 'farm-dialog-copy', fr ? 'Aucune culture disponible.' : 'No eligible crops.'));
      for (const crop of crops) this.addDialogButton(`${fr ? 'APPLIQUER' : 'APPLY'} · ${farmName(crop.species, this.app.currentLang)} · ${fr ? 'PARCELLE' : 'PLOT'} ${crop.plot + 1}`, () => this.performSpecial('fertilize', crop.id), false, this.operation || this.state.coins < Config.FERTILIZER_PRICE);
    }
    carePendingKey() { return this.account ? `fitia_farm_care_pending_v1:${this.account}` : null; }
    readPendingCare() {
      const key = this.carePendingKey(); if (!key) return null;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || 'null'); if (!pending) return null;
        return { actionId: Protocol.requireUuid(pending.actionId), animalId: Protocol.requireUuid(pending.animalId) };
      } catch (_) { return { invalid: true }; }
    }
    async performCare(animalId) {
      if (this.operation || !this.account) return;
      const key = this.carePendingKey(); const existing = this.readPendingCare();
      if (existing?.invalid) { this.showError(new Error(this.text('Pending care could not be read.', 'Impossible de lire le soin en attente.'))); return; }
      if (existing && existing.animalId !== animalId) { this.showError(new Error(this.text('Resolve the pending care first.', 'Résolvez d’abord le soin en attente.'))); return; }
      const pending = existing || { actionId: uuid(), animalId };
      try {
        if (!existing) {
          localStorage.setItem(key, JSON.stringify(pending));
          if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable');
        }
      } catch (_) { this.showError(new Error(this.text('Cannot safely save the pending care.', 'Impossible de sauvegarder le soin en attente.'))); return; }
      const session = this.session; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: pending.actionId, type: 'care_animal', params: { animalId: pending.animalId } });
        this.assertSession(session); this.applyView(data); localStorage.removeItem(key);
        this.closeDialog(); this.app.showToast(this.success('care_animal')); this.setTab('animals');
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    openCare() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      if (!this.economyGate('care')) return;
      const fr = this.app.currentLang === 'fr'; const pending = this.readPendingCare();
      this.openDialog(fr ? 'Soins des animaux' : 'Animal care');
      const content = document.getElementById('farm-dialog-content');
      if (pending) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Un soin attend sa confirmation.' : 'A care action is awaiting confirmation.'));
        if (!pending.invalid) this.addDialogButton(fr ? 'VÉRIFIER LE SOIN' : 'CHECK CARE', () => this.performCare(pending.animalId), false, this.operation);
        this.addPendingResolution(this.carePendingKey(), pending); return;
      }
      content.append(make('p', 'farm-dialog-copy', fr ? `Un soin par cycle : réduit le temps de production de ${Config.CARE_SPEED_PERCENT} %, sans changer le rendement.` : `One care action per cycle: reduces production time by ${Config.CARE_SPEED_PERCENT}% without changing yield.`));
      const eligible = this.state.animals.filter(animal => !animal.caredAt && (!animal.produceAt || animal.produceAt > this.serverNow()));
      if (!eligible.length) content.append(make('p', 'farm-dialog-copy', fr ? 'Tous les animaux ont reçu leurs soins.' : 'All animals have been cared for.'));
      for (const animal of eligible) {
        const number = this.state.animals.findIndex(item => item.id === animal.id) + 1;
        this.addDialogButton(`${fr ? 'SOIGNER' : 'CARE FOR'} ${farmName(animal.species, this.app.currentLang).toUpperCase()} · ${number}`, () => this.performCare(animal.id), false, this.operation);
      }
    }
    waterPendingKey() { return this.account ? `fitia_farm_water_pending_v1:${this.account}` : null; }
    readPendingWater() {
      const key = this.waterPendingKey(); if (!key) return null;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || 'null'); if (!pending) return null;
        return { actionId: Protocol.requireUuid(pending.actionId), cropId: Protocol.requireUuid(pending.cropId) };
      } catch (_) { return { invalid: true }; }
    }
    async performWater(cropId) {
      if (this.operation || !this.account) return;
      const key = this.waterPendingKey(); const existing = this.readPendingWater();
      if (existing?.invalid) { this.showError(new Error(this.text('Pending watering could not be read.', 'Impossible de lire l’arrosage en attente.'))); return; }
      if (existing && existing.cropId !== cropId) { this.showError(new Error(this.text('Resolve the pending watering first.', 'Résolvez d’abord l’arrosage en attente.'))); return; }
      const pending = existing || { actionId: uuid(), cropId };
      try {
        if (!existing) {
          localStorage.setItem(key, JSON.stringify(pending));
          if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable');
        }
      } catch (_) { this.showError(new Error(this.text('Cannot safely save the pending watering.', 'Impossible de sauvegarder l’arrosage en attente.'))); return; }
      const session = this.session; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: pending.actionId, type: 'water_crop', params: { cropId: pending.cropId } });
        this.assertSession(session); this.applyView(data); localStorage.removeItem(key);
        this.closeDialog(); this.app.showToast(this.success('water_crop')); this.setTab('crops');
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    openWell() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      if (!this.economyGate('water')) return;
      const fr = this.app.currentLang === 'fr'; const pending = this.readPendingWater();
      this.openDialog(fr ? 'Puits' : 'Well');
      const content = document.getElementById('farm-dialog-content');
      if (pending) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Un arrosage attend sa confirmation.' : 'A watering is awaiting confirmation.'));
        if (!pending.invalid) this.addDialogButton(fr ? 'VÉRIFIER L’ARROSAGE' : 'CHECK WATERING', () => this.performWater(pending.cropId), false, this.operation);
        this.addPendingResolution(this.waterPendingKey(), pending); return;
      }
      content.append(make('p', 'farm-dialog-copy', fr ? `Un arrosage par culture : réduit le temps initial de ${Config.WATER_SPEED_PERCENT} %, sans changer le rendement.` : `Water once per crop: reduces initial growth time by ${Config.WATER_SPEED_PERCENT}% without changing yield.`));
      const eligible = this.state.crops.filter(crop => crop.readyAt > this.serverNow() && !crop.wateredAt);
      if (!eligible.length) content.append(make('p', 'farm-dialog-copy', fr ? 'Aucune culture à arroser.' : 'No crops need watering.'));
      for (const crop of eligible) {
        this.addDialogButton(`${fr ? 'ARROSER' : 'WATER'} ${farmName(crop.species, this.app.currentLang).toUpperCase()} · ${fr ? 'PARCELLE' : 'PLOT'} ${crop.plot + 1}`, () => this.performWater(crop.id), false, this.operation);
      }
    }
    siloPendingKey() { return this.account ? `fitia_farm_silo_pending_v1:${this.account}` : null; }
    readPendingSilo() {
      const key = this.siloPendingKey(); if (!key) return null;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || 'null'); if (!pending) return null;
        Protocol.requireUuid(pending.actionId);
        if (!Array.isArray(pending.animalIds) || !pending.animalIds.length || pending.animalIds.length > Config.MAX_ANIMALS) throw new Error('Invalid selection');
        const animalIds = pending.animalIds.map(id => Protocol.requireUuid(id));
        if (new Set(animalIds).size !== animalIds.length) throw new Error('Duplicate selection');
        if (pending.type && !['feed_group', 'collect_group'].includes(pending.type)) throw new Error('Invalid action');
        return { actionId: pending.actionId, animalIds, type: pending.type || 'feed_group' };
      } catch (_) { return { invalid: true }; }
    }
    async performSilo(animalIds, type = 'feed_group') {
      if (this.operation || !this.account) return;
      const key = this.siloPendingKey(); const existing = this.readPendingSilo();
      if (existing?.invalid) { this.showError(new Error(this.text('Pending feeding could not be read.', 'Impossible de lire l’opération du silo en attente.'))); return; }
      const pending = existing || { actionId: uuid(), animalIds, type };
      try {
        if (!existing) {
          localStorage.setItem(key, JSON.stringify(pending));
          if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable');
        }
      } catch (_) { this.showError(new Error(this.text('Cannot safely save the pending feeding.', 'Impossible de sauvegarder l’opération du silo en attente.'))); return; }
      const session = this.session; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: pending.actionId, type: pending.type, params: { animalIds: pending.animalIds } });
        this.assertSession(session); this.applyView(data); localStorage.removeItem(key);
        this.closeDialog(); this.app.showToast(this.success(pending.type)); this.setTab('animals');
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    openSilo() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      const fr = this.app.currentLang === 'fr'; const pending = this.readPendingSilo();
      this.openDialog(fr ? 'Silo' : 'Silo');
      const content = document.getElementById('farm-dialog-content'); content.append(farmVisual('feed'));
      if (pending) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Une opération attend sa confirmation. Réessayez pour retrouver son résultat.' : 'An operation is awaiting confirmation. Retry to recover its result.'));
        if (!pending.invalid) this.addDialogButton(pending.type === 'collect_group' ? (fr ? 'VÉRIFIER LA COLLECTE' : 'CHECK COLLECTION') : (fr ? 'VÉRIFIER LA DISTRIBUTION' : 'CHECK FEEDING'), () => this.performSilo(pending.animalIds, pending.type), false, this.operation);
        this.addPendingResolution(this.siloPendingKey(), pending);
        return;
      }
      const animalIds = this.state.animals.filter(animal => !animal.produceAt && !(animal.maturesAt > this.serverNow())).map(animal => animal.id);
      content.append(make('strong', 'farm-dialog-price', fr ? `${animalIds.length} animal(aux) disponible(s)` : `${animalIds.length} available animal(s)`));
      content.append(make('p', 'farm-dialog-copy', fr ? `Nourriture : ${this.state.feed} · Coût : ${animalIds.length}` : `Feed: ${this.state.feed} · Cost: ${animalIds.length}`));
      this.addDialogButton(fr ? 'NOURRIR LES ANIMAUX DISPONIBLES' : 'FEED AVAILABLE ANIMALS', () => this.performSilo(animalIds), false, this.operation || !animalIds.length || this.state.feed < animalIds.length);
      const readyIds = this.state.animals.filter(animal => animal.produceAt && animal.produceAt <= Date.now() + this.serverOffset).map(animal => animal.id);
      content.append(make('p', 'farm-dialog-copy', fr ? `${readyIds.length} production(s) prête(s)` : `${readyIds.length} ready production(s)`));
      this.addDialogButton(fr ? 'COLLECTER LES PRODUCTIONS PRÊTES' : 'COLLECT READY PRODUCTS', () => this.performSilo(readyIds, 'collect_group'), true, this.operation || !readyIds.length);
      this.addDialogButton(fr ? 'ACHETER DE LA NOURRITURE' : 'BUY FEED', () => this.openBuyFeed(), true, this.operation);
    }
    tractorPendingKey() { return this.account ? `fitia_farm_tractor_pending_v1:${this.account}` : null; }
    readPendingTractor() {
      const key = this.tractorPendingKey(); if (!key) return null;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || 'null');
        if (!pending) return null;
        Protocol.requireUuid(pending.actionId); return { actionId: pending.actionId };
      } catch (_) { return { invalid: true }; }
    }
    async performTractor() {
      if (this.operation || !this.account) return;
      const key = this.tractorPendingKey(); const existing = this.readPendingTractor();
      if (existing?.invalid) { this.showError(new Error(this.text('Pending harvest could not be read.', 'Impossible de lire la récolte en attente.'))); return; }
      const pending = existing || { actionId: uuid() };
      try {
        if (!existing) {
          localStorage.setItem(key, JSON.stringify(pending));
          if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable');
        }
      } catch (_) { this.showError(new Error(this.text('Cannot safely save the pending harvest.', 'Impossible de sauvegarder la récolte en attente.'))); return; }
      const session = this.session; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: pending.actionId, type: 'harvest_ready', params: {} });
        this.assertSession(session); this.applyView(data); localStorage.removeItem(key);
        this.closeDialog(); this.app.showToast(this.success('harvest_ready')); this.setTab('crops');
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    openTractor() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      const fr = this.app.currentLang === 'fr'; const pending = this.readPendingTractor();
      this.openDialog(fr ? 'Tracteur' : 'Tractor');
      const content = document.getElementById('farm-dialog-content'); content.append(farmVisual('terrain'));
      if (pending) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Une récolte attend sa confirmation. Réessayez pour retrouver son résultat.' : 'A harvest is awaiting confirmation. Retry to recover its result.'));
        if (!pending.invalid) this.addDialogButton(fr ? 'VÉRIFIER LA RÉCOLTE' : 'CHECK HARVEST', () => this.performTractor(), false, this.operation);
        this.addPendingResolution(this.tractorPendingKey(), pending);
        return;
      }
      const count = this.state.crops.filter(crop => crop.readyAt <= Date.now() + this.serverOffset).length;
      content.append(make('strong', 'farm-dialog-price', fr ? `${count} parcelle(s) prête(s)` : `${count} ready plot(s)`));
      content.append(make('p', 'farm-dialog-copy', fr ? 'Récolte les cultures mûres uniquement, au rendement habituel.' : 'Harvests ripe crops only, at their normal yield.'));
      this.addDialogButton(fr ? 'RÉCOLTER LES PARCELLES PRÊTES' : 'HARVEST READY PLOTS', () => this.performTractor(), false, this.operation || count === 0);
    }
    millPendingKey() { return this.account ? `fitia_farm_mill_pending_v1:${this.account}` : null; }
    readPendingMill() {
      const key = this.millPendingKey(); if (!key) return null;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || 'null');
        if (!pending) return null;
        Protocol.requireUuid(pending.actionId);
        return { actionId: pending.actionId };
      } catch (_) { return { invalid: true }; }
    }
    async performMill() {
      if (this.operation || !this.account) return;
      const key = this.millPendingKey(); const existing = this.readPendingMill();
      if (existing?.invalid) { this.showError(new Error(this.text('Pending mill operation could not be read.', 'Impossible de lire la transformation en attente.'))); return; }
      const pending = existing || { actionId: uuid() };
      try {
        if (!existing) {
          localStorage.setItem(key, JSON.stringify(pending));
          if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable');
        }
      } catch (_) { this.showError(new Error(this.text('Cannot safely save the pending mill operation.', 'Impossible de sauvegarder la transformation en attente.'))); return; }
      const session = this.session; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: pending.actionId, type: 'mill_feed', params: {} });
        this.assertSession(session); this.applyView(data); localStorage.removeItem(key);
        this.closeDialog(); this.app.showToast(this.success('mill_feed')); this.setTab('animals');
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    openMill() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      if (!this.economyGate('mill')) return;
      const fr = this.app.currentLang === 'fr'; const pending = this.readPendingMill();
      this.openDialog(fr ? 'Moulin' : 'Mill');
      const content = document.getElementById('farm-dialog-content');
      content.append(farmVisual('wheat'));
      if (pending) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Une transformation attend sa confirmation. Réessayez pour retrouver son résultat.' : 'A milling operation is awaiting confirmation. Retry to recover its result.'));
        if (!pending.invalid) this.addDialogButton(fr ? 'VÉRIFIER LA TRANSFORMATION' : 'CHECK MILLING', () => this.performMill(), false, this.operation);
        this.addPendingResolution(this.millPendingKey(), pending);
        return;
      }
      content.append(make('strong', 'farm-dialog-price', fr ? '1 blé = 2 nourritures' : '1 wheat = 2 feed'));
      content.append(make('p', 'farm-dialog-copy', fr ? 'Valeur : 1 blé se vend 12 F-Coins ; 5 nourritures coûtent 20 F-Coins à l’achat.' : 'Value: 1 wheat sells for 12 F-Coins; 5 feed cost 20 F-Coins to buy.'));
      content.append(make('p', 'farm-dialog-copy', fr ? `Stock : ${this.state.inventory.wheat} blé · ${this.state.feed} nourritures` : `Stock: ${this.state.inventory.wheat} wheat · ${this.state.feed} feed`));
      this.addDialogButton(fr ? 'TRANSFORMER' : 'MILL FEED', () => this.performMill(), false,
        this.operation || this.state.inventory.wheat < Config.MILL_WHEAT_INPUT || this.state.feed > Config.MAX_FEED - Config.MILL_FEED_OUTPUT);
    }
    marketPendingKey() { return this.account ? `fitia_farm_market_pending_v1:${this.account}` : null; }
    readPendingMarketSale() {
      const key = this.marketPendingKey(); if (!key) return null;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || 'null');
        if (!pending) return null;
        Protocol.requireUuid(pending.actionId);
        if (pending.items) {
          if (!Array.isArray(pending.items) || !pending.items.length || pending.items.length > Object.keys(Config.PRODUCTS).length) throw new Error('Invalid pending sale');
          const seen = new Set();
          for (const item of pending.items) {
            if (!item || !Object.prototype.hasOwnProperty.call(Config.PRODUCTS, item.product) || seen.has(item.product) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000000) throw new Error('Invalid pending sale');
            seen.add(item.product);
          }
          return pending;
        }
        if (!Object.keys(Config.PRODUCTS).includes(pending.product)
            || !Number.isSafeInteger(pending.quantity) || pending.quantity < 1 || pending.quantity > 1000000) throw new Error('Invalid pending sale');
        return pending;
      } catch (_) { return { invalid: true }; }
    }
    async performItemSale(product, quantity) {
      if (this.operation || !this.account) return;
      const key = this.marketPendingKey(); const existing = this.readPendingMarketSale();
      if (existing?.invalid) { this.showError(new Error(this.text('Pending sale could not be read. Contact support before selling.', 'Impossible de lire la vente en attente. Contactez le support avant de vendre.'))); return; }
      if (existing && (existing.product !== product || existing.quantity !== quantity)) {
        this.showError(new Error(this.text('Resolve the pending sale before starting another.', 'Résolvez la vente en attente avant d’en commencer une autre.'))); return;
      }
      const pending = existing || { actionId: uuid(), product, quantity };
      try {
        if (!existing) {
          localStorage.setItem(key, JSON.stringify(pending));
          if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable');
        }
      } catch (_) { this.showError(new Error(this.text('Cannot safely save the pending sale. Please free device storage and try again.', 'Impossible de sauvegarder la vente en attente. Libérez de l’espace et réessayez.'))); return; }
      const session = this.session; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: pending.actionId, type: 'sell_item', params: { product, quantity } });
        this.assertSession(session);
        this.applyView(data);
        localStorage.removeItem(key);
        this.closeDialog(); this.app.showToast(this.success('sell_item'));
      } catch (error) {
        // A lost response may follow a successful commit. Keep the same signed
        // action id for reconciliation, including after an app restart.
        this.showError(error);
      } finally { this.operation = false; this.render(); }
    }
    async performBatchSale(items) {
      if (this.operation || !this.account) return;
      const key = this.marketPendingKey(), existing = this.readPendingMarketSale();
      if (existing?.invalid || (existing && JSON.stringify(existing.items) !== JSON.stringify(items))) {
        this.showError(new Error(this.text('Resolve the pending sale first.', 'Résolvez d’abord la vente en attente.'))); return;
      }
      const pending = existing || { actionId: uuid(), items };
      try { if (!existing) { localStorage.setItem(key, JSON.stringify(pending)); if (localStorage.getItem(key) !== JSON.stringify(pending)) throw new Error('Storage unavailable'); } }
      catch (_) { this.showError(new Error(this.text('Cannot safely save the pending sale.', 'Impossible de sauvegarder la vente en attente.'))); return; }
      const session = this.session; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: pending.actionId, type: 'sell_batch', params: { items: pending.items } });
        this.assertSession(session); this.applyView(data); localStorage.removeItem(key); this.closeDialog(); this.app.showToast(this.success('sell'));
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    openSell() {
      if (!this.started()) return;
      const total = Object.keys(Config.PRODUCTS).reduce((sum, key) => sum + (this.state.inventory[key] || 0) * Config.PRODUCTS[key].price, 0);
      this.openDialog(this.text('Sell products', 'Vendre les produits'));
      const content = document.getElementById('farm-dialog-content'); content.append(farmVisual('barn'), make('strong', 'farm-dialog-price', `${total} F-Coins`));
      const fr = this.app.currentLang === 'fr';
      const pending = this.readPendingMarketSale();
      if (pending) {
        content.append(make('p', 'farm-dialog-copy', fr ? 'Une vente attend sa confirmation. Réessayez pour retrouver son résultat sans la répéter.' : 'A sale is awaiting confirmation. Retry to recover its result without repeating it.'));
        if (!pending.invalid) this.addDialogButton(fr ? 'VÉRIFIER LA VENTE' : 'CHECK SALE', () => pending.items ? this.performBatchSale(pending.items) : this.performItemSale(pending.product, pending.quantity), false, this.operation);
        this.addPendingResolution(this.marketPendingKey(), pending);
        return;
      }
      const grid = make('div', 'farm-market-list'); const selections = [];
      Object.entries(Config.PRODUCTS).forEach(([key, product]) => {
        const available = this.state.inventory[key] || 0;
        if (!available) return;
        const row = make('div', 'farm-market-row');
        const info = make('span', 'farm-market-info');
        info.append(make('strong', '', farmName(key, this.app.currentLang)), make('small', '', `${available} · ${product.price} F-Coins / ${fr ? 'unité' : 'unit'}`));
        const input = make('input', 'game-input farm-market-quantity');
        input.type = 'number'; input.min = '1'; input.max = String(available); input.step = '1'; input.value = '1'; input.inputMode = 'numeric';
        input.setAttribute('aria-label', `${fr ? 'Quantité' : 'Quantity'} · ${farmName(key, this.app.currentLang)}`);
        const button = make('button', 'farm-small-button', fr ? 'Vendre' : 'Sell'); button.type = 'button'; button.disabled = this.operation;
        button.addEventListener('click', () => {
          const quantity = Number(input.value);
          if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > available) {
            document.getElementById('farm-dialog-error').textContent = fr ? 'Choisissez une quantité disponible.' : 'Choose an available quantity.';
            return;
          }
          this.performItemSale(key, quantity);
        });
        const checkbox = make('input', 'farm-market-select'); checkbox.type = 'checkbox';
        checkbox.setAttribute('aria-label', `${fr ? 'Sélectionner' : 'Select'} · ${farmName(key, this.app.currentLang)}`);
        selections.push({ key, available, input, checkbox });
        row.append(info, input, button, checkbox); grid.appendChild(row);
      });
      content.appendChild(grid);
      this.addDialogButton(fr ? 'VENDRE LA SÉLECTION' : 'SELL SELECTED', () => {
        const selected = selections.filter(row => row.checkbox.checked);
        const items = selected.map(row => ({ product: row.key, quantity: Number(row.input.value) }));
        if (!items.length || selected.some((row, i) => !Number.isSafeInteger(items[i].quantity) || items[i].quantity < 1 || items[i].quantity > row.available)) {
          document.getElementById('farm-dialog-error').textContent = fr ? 'Sélectionnez des produits et des quantités disponibles.' : 'Select products and available quantities.'; return;
        }
        this.performBatchSale(items);
      }, true, !total || this.operation);
      this.addDialogButton(fr ? 'TOUT VENDRE' : 'SELL ALL PRODUCTS', () => this.perform('sell'), false, !total || this.operation);
    }
    openEntity(kind, id) {
      if (!this.state) return;
      if (kind === 'animal') {
        const animal = this.state.animals.find((item) => item.id === id); if (!animal) return;
        const definition = Config.ANIMALS[animal.species]; const ready = animal.produceAt && animal.produceAt <= this.serverNow();
        this.openDialog(farmName(animal.species, this.app.currentLang));
        const content = document.getElementById('farm-dialog-content'); content.append(farmVisual(animal.species));
        content.append(make('strong', 'farm-dialog-price', `${farmName(definition.product, this.app.currentLang)} · ${durationLabel(definition.durationMs)}`));
        content.append(make('p', 'farm-dialog-copy', animal.caredAt ? this.text('Cared for', 'Soigné') : this.text('Care available', 'Soin disponible')));
        if (!animal.caredAt && !ready && this.unvalidatedEconomyEnabled()) this.addDialogButton(this.text('CARE', 'SOIGNER'), () => this.openCare(), true, this.operation);
        if (animal.maturesAt > this.serverNow()) content.append(make('p', 'farm-dialog-copy', `${this.text('Growing', 'En croissance')} · ${countdown(animal.maturesAt - this.serverOffset)}`));
        if (ready) this.addDialogButton(`${this.text('COLLECT', 'COLLECTER')} ${farmName(definition.product, this.app.currentLang).toUpperCase()}`, () => this.perform('collect', { animalId: id }));
        else this.addDialogButton(animal.produceAt ? `${this.text('PRODUCING', 'EN PRODUCTION')} · ${countdown(animal.produceAt - this.serverOffset)}` : this.text('FEED · 1 UNIT', 'NOURRIR · 1 UNITÉ'), () => this.perform('feed', { animalId: id }), false, Boolean(animal.produceAt) || animal.maturesAt > this.serverNow() || this.state.feed < 1);
        this.setTab('animals');
      } else if (kind === 'crop') {
        const crop = this.state.crops.find((item) => item.id === id); if (!crop) return;
        const definition = Config.CROPS[crop.species]; const ready = crop.readyAt <= this.serverNow();
        this.openDialog(farmName(crop.species, this.app.currentLang)); const content = document.getElementById('farm-dialog-content');
        content.append(farmVisual(crop.species), make('strong', 'farm-dialog-price', `${definition.yield} ${this.text('units', 'unités')}`));
        content.append(make('p', 'farm-dialog-copy', crop.fertilizedAt ? this.text('Fertilized', 'Engrais appliqué') : this.text('No fertilizer', 'Sans engrais')));
        if (!ready && !crop.fertilizedAt && this.unvalidatedEconomyEnabled()) this.addDialogButton(this.text('FERTILIZE', 'ENGRAIS'), () => this.openFertilizer(), true, this.operation);
        content.append(make('p', 'farm-dialog-copy', crop.wateredAt ? this.text('Watered', 'Arrosée') : this.text('Not watered', 'Non arrosée')));
        if (!ready && !crop.wateredAt && this.unvalidatedEconomyEnabled()) this.addDialogButton(this.text('WATER', 'ARROSER'), () => this.openWell(), true, this.operation);
        this.addDialogButton(ready ? this.text('HARVEST CROP', 'RÉCOLTER') : `${this.text('GROWING', 'EN POUSSE')} · ${countdown(crop.readyAt - this.serverOffset)}`, () => this.perform('harvest', { cropId: id }), false, !ready);
        this.setTab('crops');
      }
    }
    openDeposit() {
      if (this.pendingDeposit) {
        this.openDialog(this.text('FTA deposit in progress', 'Dépôt FTA en cours'));
        const content = document.getElementById('farm-dialog-content');
        content.append(tokenVisual(), make('strong', 'farm-dialog-price', `${formatUnits(this.pendingDeposit.amountUnits)} FTA`), make('p', 'farm-transaction-hash', `${this.pendingDeposit.txHash.slice(0, 12)}…${this.pendingDeposit.txHash.slice(-8)}`));
        this.addDialogButton(this.text('CHECK CONFIRMATION', 'VÉRIFIER LA CONFIRMATION'), () => this.checkPendingDeposit().catch((error) => this.showError(error)));
        return;
      }
      this.openDialog(this.text('Convert FTA', 'Convertir des FTA'));
      const content = document.getElementById('farm-dialog-content'); const label = make('label', 'farm-input-label', this.text('FTA amount', 'Montant en FTA'));
      const input = make('input', 'game-input'); input.type = 'number'; input.min = '0.01'; input.step = '0.01'; input.value = '10'; input.inputMode = 'decimal'; input.maxLength = 18;
      const output = make('p', 'farm-conversion-preview'); const update = () => {
        try { const units = ethers.parseUnits(input.value || '0', 8); output.textContent = `${(units / Config.UNITS_PER_COIN).toLocaleString('en-US')} F-Coins`; }
        catch (_) { output.textContent = this.text('Invalid amount', 'Montant invalide'); }
      };
      input.addEventListener('input', update); label.appendChild(input); content.append(label, output); update();
      this.addDialogButton(this.text('CONVERT WITH PIN', 'CONVERTIR AVEC LE CODE PIN'), () => this.startDeposit(input.value));
    }
    async startDeposit(amount) {
      if (this.operation || this.pendingDeposit) return;
      const session = this.session; const paymentAccount = this.account; this.operation = true;
      try {
        this.assertSession(session);
        const amountUnits = ethers.parseUnits(String(amount).trim(), 8);
        if (amountUnits <= 0n || amountUnits % Config.UNITS_PER_COIN !== 0n || amountUnits / Config.UNITS_PER_COIN > BigInt(Config.MAX_COINS)) throw { code: 'FARM_AMOUNT' };
        const balance = BigInt(await this.app.ftaToken.balanceOf(paymentAccount)); this.assertSession(session);
        if (balance < amountUnits) { this.app.showToast(this.app.t('errInsufficientFunds'), true); return; }
        if (!(await this.app.ensurePolGas())) return; this.assertSession(session);
        const verified = await this.app.requestPinVerification(`FITIA FARM · ${formatUnits(amountUnits)} FTA`);
        if (!verified) return;
        if (verified.secret) { verified.secret.privateKey = ''; verified.secret.mnemonic = ''; }
        this.assertSession(session); this.app.setLoader(true);
        const tx = await this.app.ftaToken.transfer(Config.TREASURY_ADDRESS, amountUnits);
        const pending = { actionId: uuid(), txHash: Protocol.requireTxHash(tx.hash), amountUnits: amountUnits.toString(), createdAt: Date.now() };
        if (session === this.session && this.account === paymentAccount) {
          this.pendingDeposit = pending; this.savePendingDeposit(); this.closeDialog(); this.render();
          this.app.showToast(this.text('FTA transfer submitted. F-Coins will appear after Polygon confirmation.', 'Transfert FTA envoyé. Les F-Coins apparaîtront après confirmation Polygon.'));
          this.app.refreshAfterConfirmedTransaction?.().catch(() => {});
          this.checkPendingDeposit().catch((error) => this.showError(error));
        } else {
          // Le transfert est déjà diffusé : toujours conserver sa reprise pour l’ancien compte.
          writePendingDeposit(paymentAccount, pending);
        }
      } catch (error) { if (error?.code === 'ACTION_REJECTED') this.app.showError(error); else this.showError(error); }
      finally { this.operation = false; this.app.setLoader(false); this.render(); }
    }
    async checkPendingDeposit() {
      if (!this.pendingDeposit || !this.account || this.pendingCheck) return this.pendingCheck;
      const session = this.session; const pending = { ...this.pendingDeposit };
      this.pendingCheck = (async () => {
        try {
          const data = await this.request('deposit', pending); this.assertSession(session);
          if (data.pending) { this.setStatus(this.text('FTA deposit awaiting confirmations', 'Dépôt FTA en attente de confirmation'), 'working'); this.schedulePendingRetry(); return; }
          if (this.pendingDeposit?.txHash === pending.txHash) { this.pendingDeposit = null; this.savePendingDeposit(); }
          this.applyView(data); this.setStatus('', 'online'); this.app.showToast(this.text('FTA confirmed. Your F-Coins have been credited.', 'Dépôt FTA confirmé. Vos F-Coins ont été crédités.'));
        } catch (error) {
          if (['FARM_PAYMENT_FAILED', 'FARM_PAYMENT_MISMATCH', 'FARM_TX_USED'].includes(error.code)) {
            if (this.pendingDeposit?.txHash === pending.txHash) { this.pendingDeposit = null; this.savePendingDeposit(); this.render(); }
          } else this.schedulePendingRetry();
          throw error;
        }
      })();
      try { return await this.pendingCheck; } finally { this.pendingCheck = null; }
    }
    schedulePendingRetry() {
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => { if (this.active) this.checkPendingDeposit().catch(() => {}); }, 12000);
    }
    openWithdraw() {
      if (this.liveExchangeEnabled()) { this.showError({ code: 'FARM_CLIENT_UPDATE_REQUIRED' }); return; }
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      const latest = this.withdrawals[0];
      if (latest?.status === 'pending') {
        this.openDialog(this.text('Withdrawal in progress', 'Retrait en cours'));
        document.getElementById('farm-dialog-content').append(tokenVisual(), make('strong', 'farm-dialog-price', `${formatUnits(latest.ftaUnits)} FTA`), make('span', 'farm-dialog-status', this.text('PENDING', 'EN ATTENTE')));
        return;
      }
      if (latest && Date.now() - Date.parse(latest.createdAt) < Config.WITHDRAWAL_COOLDOWN_MS) {
        const availableAt = Date.parse(latest.createdAt) + Config.WITHDRAWAL_COOLDOWN_MS;
        this.openDialog(this.text('Next withdrawal', 'Prochain retrait'));
        document.getElementById('farm-dialog-content').append(tokenVisual(), make('strong', 'farm-dialog-price', countdown(availableAt)));
        return;
      }
      this.openDialog(this.text('Withdraw FTA', 'Retirer des FTA'));
      const content = document.getElementById('farm-dialog-content'); const label = make('label', 'farm-input-label', this.text('F-Coins to withdraw', 'F-Coins à retirer'));
      const input = make('input', 'game-input'); input.type = 'number'; input.min = String(Config.MIN_WITHDRAW_COINS); input.max = String(Config.MAX_WITHDRAW_COINS); input.step = String(Config.COINS_PER_FTA); input.value = String(Config.MIN_WITHDRAW_COINS); input.inputMode = 'numeric'; input.maxLength = 9;
      const output = make('p', 'farm-conversion-preview'); const update = () => {
        const coins = Number(input.value);
        const valid = Number.isSafeInteger(coins) && coins >= Config.MIN_WITHDRAW_COINS && coins <= Config.MAX_WITHDRAW_COINS && coins % Config.COINS_PER_FTA === 0;
        output.textContent = valid ? `${formatUnits(BigInt(coins / Config.COINS_PER_FTA) * Config.COIN_UNITS_PER_FTA)} FTA` : this.text('Minimum 1,000 F-Coins · multiples of 100', 'Minimum 1 000 F-Coins · multiples de 100');
      };
      input.addEventListener('input', update); label.appendChild(input); content.append(label, output); update();
      this.addDialogButton(this.text('REQUEST FTA WITHDRAWAL', 'DEMANDER LE RETRAIT FTA'), () => this.withdraw(input.value));
    }
    async withdraw(value) {
      if (this.operation) return; const coins = Number(value);
      if (!Number.isSafeInteger(coins) || coins < Config.MIN_WITHDRAW_COINS || coins > Config.MAX_WITHDRAW_COINS || coins % Config.COINS_PER_FTA !== 0) { this.showError({ code: 'FARM_AMOUNT' }); return; }
      this.operation = true;
      try {
        const session = this.session; const wallet = this.account; const actionId = uuid();
        if (!this.app.mfaClient) throw new Error(this.text('Security verification unavailable.', 'Vérification de sécurité indisponible.'));
        const approval = await this.app.mfaClient.operation(wallet, `${coins} F-Coins · FARM withdrawal`, 'farm');
        if (!approval) return;
        this.assertSession(session);
        const data = await this.request('withdraw', { actionId, coins, ...(approval.required ? { mfaCode: approval.code } : {}) }); this.applyView(data); this.closeDialog();
        this.app.showToast(this.text('Withdrawal requested. Follow its status here in FITIA FARM.', 'Demande de retrait enregistrée. Suivez son état dans FITIA FARM.')); this.setTab('overview');
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    manualRefresh() { this.refresh({ quiet: false }).then(() => this.app.showToast(this.text('Farm synchronized.', 'Ferme synchronisée.'))).catch((error) => this.showError(error)); this.checkPendingDeposit().catch(() => {}); }
  }
  globalThis.FitiaFarmCenter = FitiaFarmCenter;
})();
