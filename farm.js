/* FITIA FARM — compte signé, économie serveur et contrôle de la scène 3D. */
(() => {
  'use strict';
  const Config = globalThis.FitiaFarmConfig;
  const Protocol = globalThis.FitiaFarmProtocol;
  const API_URL = 'https://fitia-mining-pro.vercel.app/api/farm';
  const NAMES = {
    chicken: 'Chicken', sheep: 'Sheep', cow: 'Cow', wheat: 'Wheat', carrot: 'Carrot',
    eggs: 'Eggs', wool: 'Wool', milk: 'Milk'
  };
  const ACTION_SUCCESS = {
    buy_land: 'Terrain purchased.', buy_animal: 'Animal added.', buy_feed: 'Feed added.',
    plant: 'Crop planted.', harvest: 'Crop harvested.', feed: 'Production started.',
    collect: 'Product collected.', sell: 'Products sold.'
  };
  const ERROR_COPY = {
    FARM_AUTH: 'Your wallet signature expired. Please try again.', FARM_NOT_STARTED: 'Buy the terrain and at least one animal to unlock production.',
    FARM_LAND_REQUIRED: 'Buy the terrain before adding an animal.', FARM_LAND_OWNED: 'You already own the terrain.',
    FARM_INSUFFICIENT_COINS: 'Not enough coins for this action.', FARM_FEED_REQUIRED: 'Buy feed before feeding this animal.',
    FARM_NOT_READY: 'Production is not ready yet.', FARM_NOT_FOUND: 'This farm item no longer exists. Refresh and try again.',
    FARM_INVENTORY_EMPTY: 'Your barn is empty. Harvest or collect a product first.', FARM_LIMIT: 'Your farm has reached its capacity limit.',
    FARM_AMOUNT: 'Enter a valid amount. FTA deposits and withdrawals must follow the displayed increments.',
    FARM_WITHDRAWAL_PENDING: 'You already have a withdrawal in progress. Wait for its FTA payment before creating another.',
    FARM_WITHDRAWAL_COOLDOWN: 'One withdrawal is allowed every 24 hours. Your next available time is shown with your latest request.',
    FARM_REVISION: 'Your farm changed in another session. It has been refreshed.', FARM_CONFLICT: 'This action was already processed. Refresh your farm.',
    FARM_RPC_UNAVAILABLE: 'Polygon verification is temporarily unavailable. Your transaction can be retried safely.',
    FARM_STORAGE: 'The farm service is temporarily unavailable. Please try again.', FARM_CONFIG: 'FITIA FARM is being prepared. Please try again later.',
    FARM_PAYMENT_FAILED: 'The FTA transfer failed on-chain. No coins were credited.', FARM_PAYMENT_MISMATCH: 'The FTA transfer does not match this deposit.',
    FARM_TX_USED: 'This Polygon transaction has already been used.', FARM_PARAMS: 'The requested farm action is invalid.',
    WALLET_SESSION_CHANGED: 'The wallet session changed. The farm action was stopped.'
  };

  function make(tag, className, text) {
    const element = document.createElement(tag); if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text); return element;
  }
  const FARM_ICONS = new Set(['chicken', 'sheep', 'cow', 'wheat', 'carrot', 'eggs', 'wool', 'milk', 'terrain', 'feed', 'barn', 'coins']);
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
      inventory: { wheat: 0, carrot: 0, eggs: 0, wool: 0, milk: 0 }, createdAt: Date.now(), updatedAt: Date.now() };
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
      this.app = app; this.account = null; this.state = null; this.revision = 0; this.withdrawals = [];
      this.scene = null; this.active = false; this.initialized = false; this.operation = false;
      this.refreshPromise = null; this.pendingCheck = null; this.pendingDeposit = null;
      this.pollTimer = null; this.clockTimer = null; this.retryTimer = null; this.session = 0; this.tab = 'overview';
    }
    init() {
      this.initialized = true;
      this.clockTimer = globalThis.setInterval(() => this.tick(), 1000);
      this.render();
    }
    setAccount(account) {
      this.session += 1; this.account = account && ethers.isAddress(account) ? account.toLowerCase() : null;
      this.state = null; this.revision = 0; this.withdrawals = []; this.pendingDeposit = null;
      this.refreshPromise = null; this.pendingCheck = null; this.operation = false;
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
          onSelect: (selection) => this.openEntity(selection.kind, selection.id),
          reducedMotion: () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
        });
        this.scene.setState(this.state || emptyState(this.account)); this.scene.setActive(this.active);
        document.getElementById('farm-3d-loading')?.classList.add('hidden');
      } catch (error) {
        const loading = document.getElementById('farm-3d-loading');
        if (loading) { loading.classList.remove('hidden'); loading.textContent = '3D could not start on this device. Update Android System WebView, then reopen FITIA FARM.'; }
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
      if (revision < this.revision) return;
      this.revision = revision; this.state = data.state; this.withdrawals = Array.isArray(data.withdrawals) ? data.withdrawals : [];
      this.scene?.setState(this.state); this.render();
    }
    async refresh(options = {}) {
      if (!this.account || this.refreshPromise) return this.refreshPromise;
      const session = this.session;
      this.refreshPromise = (async () => {
        if (!options.quiet) this.setStatus('Synchronizing your farm…', 'working');
        try {
          const data = await this.request('state'); if (session !== this.session) return;
          this.applyView(data); this.setStatus('Live · server synchronized', 'online');
        } catch (error) { this.setStatus('Offline · retry shortly', 'offline'); throw error; }
      })();
      try { return await this.refreshPromise; } finally { this.refreshPromise = null; }
    }
    setStatus(text, kind) {
      const status = document.getElementById('farm-sync-status'); if (status) status.textContent = text;
      const dot = document.getElementById('farm-sync-dot'); if (dot) dot.className = `farm-sync-dot ${kind || ''}`;
    }
    showError(error) {
      const message = ERROR_COPY[error?.code] || error?.message || 'FITIA FARM could not complete the action.';
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
      byId('farm-land-status').textContent = state.land?.owned ? 'Owned' : `${Config.LAND_PRICE} coins`;
      byId('farm-animal-status').textContent = state.animals.length ? `${state.animals.length} owned` : 'Required';
      byId('farm-buy-land').disabled = Boolean(state.land?.owned) || this.operation;
      byId('farm-buy-first-animal').disabled = !state.land?.owned || this.operation;
      document.querySelectorAll('[data-farm-requires-start]').forEach((button) => { button.disabled = !this.started() || this.operation; });
      document.querySelectorAll('[data-farm-requires-land]').forEach((button) => { button.disabled = !state.land?.owned || this.operation; });
      byId('farm-deposit-pending').classList.toggle('hidden', !this.pendingDeposit);
      this.renderAnimals(); this.renderCrops(); this.renderInventory(); this.renderWithdrawals(); this.tick();
    }
    renderAnimals() {
      const list = document.getElementById('farm-animal-list'); if (!list) return; list.textContent = '';
      document.getElementById('farm-animals-empty').classList.toggle('hidden', Boolean(this.state?.animals?.length));
      (this.state?.animals || []).forEach((animal) => {
        const definition = Config.ANIMALS[animal.species]; const card = make('article', 'farm-item-card');
        const icon = farmIcon(animal.species); const main = make('div', 'farm-item-main');
        main.append(make('strong', '', NAMES[animal.species]), make('small', '', `${NAMES[definition.product]} · ${durationLabel(definition.durationMs)} cycle`));
        const status = make('span', `farm-item-status ${animal.produceAt && animal.produceAt <= Date.now() ? 'ready' : ''}`);
        status.dataset.farmAnimalStatus = animal.id; status.dataset.readyAt = animal.produceAt || 0;
        card.append(icon, main, status);
        const action = make('button', 'farm-small-button', animal.produceAt ? 'View production' : 'Feed');
        action.addEventListener('click', () => this.openEntity('animal', animal.id)); card.appendChild(action); list.appendChild(card);
      });
    }
    renderCrops() {
      const list = document.getElementById('farm-crop-list'); if (!list) return; list.textContent = '';
      document.getElementById('farm-crops-empty').classList.toggle('hidden', Boolean(this.state?.crops?.length));
      (this.state?.crops || []).forEach((crop) => {
        const definition = Config.CROPS[crop.species]; const card = make('article', 'farm-item-card');
        card.append(farmIcon(crop.species));
        const main = make('div', 'farm-item-main'); main.append(make('strong', '', NAMES[crop.species]), make('small', '', `Yield ${definition.yield} · ${NAMES[crop.species]}`));
        const status = make('span', `farm-item-status ${crop.readyAt <= Date.now() ? 'ready' : ''}`); status.dataset.farmCropStatus = crop.id; status.dataset.readyAt = crop.readyAt;
        const action = make('button', 'farm-small-button', crop.readyAt <= Date.now() ? 'Harvest' : 'Growing'); action.addEventListener('click', () => this.openEntity('crop', crop.id));
        card.append(main, status, action); list.appendChild(card);
      });
    }
    renderInventory() {
      const list = document.getElementById('farm-inventory-list'); if (!list) return; list.textContent = '';
      Object.entries(Config.PRODUCTS).forEach(([key, product]) => {
        const card = make('article', 'farm-inventory-item'); card.append(farmIcon(key), make('strong', '', this.state?.inventory?.[key] || 0), make('small', '', `${NAMES[key]} · ${product.price} coins`)); list.appendChild(card);
      });
      const empty = Object.values(this.state?.inventory || {}).every((quantity) => !quantity);
      const sell = document.getElementById('farm-sell-inventory'); if (sell) sell.disabled = empty || !this.started() || this.operation;
    }
    renderWithdrawals() {
      const list = document.getElementById('farm-withdrawal-list'); if (!list) return; list.textContent = '';
      document.getElementById('farm-withdrawals-empty').classList.toggle('hidden', this.withdrawals.length > 0);
      this.withdrawals.slice(0, 6).forEach((withdrawal) => {
        const row = make('article', 'farm-withdrawal-row');
        const main = make('div'); main.append(make('strong', '', `${formatUnits(withdrawal.ftaUnits)} FTA`), make('small', '', `${withdrawal.coins} coins · ${new Date(withdrawal.createdAt).toLocaleDateString('en-US')}`));
        const status = make('span', `farm-withdrawal-status ${withdrawal.status}`, withdrawal.status === 'paid' ? 'PAID' : 'PENDING'); row.append(main, status); list.appendChild(row);
      });
    }
    tick() {
      if (!this.state || !document.getElementById('view-farm')) return;
      this.state.animals.forEach((animal) => {
        const element = document.querySelector(`[data-farm-animal-status="${animal.id}"]`); if (!element) return;
        element.textContent = !animal.produceAt ? 'Ready to feed' : animal.produceAt <= Date.now() ? `${NAMES[Config.ANIMALS[animal.species].product]} ready` : `Producing · ${countdown(animal.produceAt)}`;
        element.classList.toggle('ready', Boolean(animal.produceAt && animal.produceAt <= Date.now()));
      });
      this.state.crops.forEach((crop) => {
        const element = document.querySelector(`[data-farm-crop-status="${crop.id}"]`); if (!element) return;
        element.textContent = crop.readyAt <= Date.now() ? 'Ready to harvest' : `Growing · ${countdown(crop.readyAt)}`;
        element.classList.toggle('ready', crop.readyAt <= Date.now());
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
    async perform(type, params = {}) {
      if (this.operation) return; this.operation = true; this.render();
      try {
        const data = await this.request('action', { actionId: uuid(), type, params });
        this.applyView(data); this.closeDialog(); this.app.showToast(ACTION_SUCCESS[type] || 'Farm updated.');
        if (type === 'buy_animal') this.setTab('animals'); if (type === 'plant') this.setTab('crops');
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    openBuyLand() {
      this.openDialog('Terrain');
      const content = document.getElementById('farm-dialog-content');
      content.append(farmVisual('terrain'), make('strong', 'farm-dialog-price', `${Config.LAND_PRICE} coins`));
      this.addDialogButton(`BUY TERRAIN · ${Config.LAND_PRICE} COINS`, () => this.perform('buy_land'), false, Boolean(this.state?.land?.owned));
    }
    openBuyAnimal() {
      if (!this.state?.land?.owned) { this.openBuyLand(); return; }
      this.openDialog('Animals');
      const grid = make('div', 'farm-shop-grid'); document.getElementById('farm-dialog-content').appendChild(grid);
      Object.entries(Config.ANIMALS).forEach(([species, animal]) => {
        const card = make('article', 'farm-shop-card'); card.append(farmIcon(species, 'farm-shop-icon'), make('strong', '', NAMES[species]), make('small', '', `${NAMES[animal.product]} · ${durationLabel(animal.durationMs)}`), make('b', '', `${animal.price} coins`));
        const button = make('button', 'farm-small-button', 'BUY'); button.disabled = this.operation || this.state.animals.length >= Config.MAX_ANIMALS;
        button.addEventListener('click', () => this.perform('buy_animal', { species })); card.appendChild(button); grid.appendChild(card);
      });
    }
    openPlant() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      this.openDialog('Crops');
      const grid = make('div', 'farm-shop-grid'); document.getElementById('farm-dialog-content').appendChild(grid);
      Object.entries(Config.CROPS).forEach(([species, crop]) => {
        const card = make('article', 'farm-shop-card'); card.append(farmIcon(species, 'farm-shop-icon'), make('strong', '', NAMES[species]), make('small', '', `${crop.yield} units · ${durationLabel(crop.durationMs)}`), make('b', '', `${crop.price} coins`));
        const button = make('button', 'farm-small-button', 'PLANT'); button.disabled = this.operation || this.state.crops.length >= Config.MAX_CROPS;
        button.addEventListener('click', () => this.perform('plant', { species })); card.appendChild(button); grid.appendChild(card);
      });
    }
    openBuyFeed() {
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      this.openDialog('Animal feed');
      const content = document.getElementById('farm-dialog-content'); content.append(farmVisual('feed'), make('strong', 'farm-dialog-price', `${Config.FEED_PACK_QUANTITY} feed · ${Config.FEED_PACK_PRICE} coins`));
      this.addDialogButton('BUY FEED PACK', () => this.perform('buy_feed'), false, this.operation);
    }
    openSell() {
      if (!this.started()) return;
      const total = Object.keys(Config.PRODUCTS).reduce((sum, key) => sum + (this.state.inventory[key] || 0) * Config.PRODUCTS[key].price, 0);
      this.openDialog('Sell products');
      const content = document.getElementById('farm-dialog-content'); content.append(farmVisual('barn'), make('strong', 'farm-dialog-price', `${total} coins`));
      this.addDialogButton('SELL ALL PRODUCTS', () => this.perform('sell'), false, !total || this.operation);
    }
    openEntity(kind, id) {
      if (!this.state) return;
      if (kind === 'animal') {
        const animal = this.state.animals.find((item) => item.id === id); if (!animal) return;
        const definition = Config.ANIMALS[animal.species]; const ready = animal.produceAt && animal.produceAt <= Date.now();
        this.openDialog(NAMES[animal.species]);
        const content = document.getElementById('farm-dialog-content'); content.append(farmVisual(animal.species));
        content.append(make('strong', 'farm-dialog-price', `${NAMES[definition.product]} · ${durationLabel(definition.durationMs)}`));
        if (ready) this.addDialogButton(`COLLECT ${NAMES[definition.product].toUpperCase()}`, () => this.perform('collect', { animalId: id }));
        else this.addDialogButton(animal.produceAt ? `PRODUCING · ${countdown(animal.produceAt)}` : `FEED · 1 UNIT`, () => this.perform('feed', { animalId: id }), false, Boolean(animal.produceAt) || this.state.feed < 1);
        this.setTab('animals');
      } else if (kind === 'crop') {
        const crop = this.state.crops.find((item) => item.id === id); if (!crop) return;
        const definition = Config.CROPS[crop.species]; const ready = crop.readyAt <= Date.now();
        this.openDialog(NAMES[crop.species]); const content = document.getElementById('farm-dialog-content');
        content.append(farmVisual(crop.species), make('strong', 'farm-dialog-price', `${definition.yield} units`));
        this.addDialogButton(ready ? 'HARVEST CROP' : `GROWING · ${countdown(crop.readyAt)}`, () => this.perform('harvest', { cropId: id }), false, !ready);
        this.setTab('crops');
      }
    }
    openDeposit() {
      if (this.pendingDeposit) {
        this.openDialog('FTA deposit in progress');
        const content = document.getElementById('farm-dialog-content');
        content.append(tokenVisual(), make('strong', 'farm-dialog-price', `${formatUnits(this.pendingDeposit.amountUnits)} FTA`), make('p', 'farm-transaction-hash', `${this.pendingDeposit.txHash.slice(0, 12)}…${this.pendingDeposit.txHash.slice(-8)}`));
        this.addDialogButton('CHECK CONFIRMATION', () => this.checkPendingDeposit().catch((error) => this.showError(error)));
        return;
      }
      this.openDialog('Convert FTA');
      const content = document.getElementById('farm-dialog-content'); const label = make('label', 'farm-input-label', 'FTA amount');
      const input = make('input', 'game-input'); input.type = 'number'; input.min = '0.01'; input.step = '0.01'; input.value = '10'; input.inputMode = 'decimal'; input.maxLength = 18;
      const output = make('p', 'farm-conversion-preview'); const update = () => {
        try { const units = ethers.parseUnits(input.value || '0', 8); output.textContent = `${(units / Config.UNITS_PER_COIN).toLocaleString('en-US')} coins`; }
        catch (_) { output.textContent = 'Invalid amount'; }
      };
      input.addEventListener('input', update); label.appendChild(input); content.append(label, output); update();
      this.addDialogButton('CONVERT WITH PIN', () => this.startDeposit(input.value));
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
          this.app.showToast('FTA transfer submitted. Coins will appear after Polygon confirmation.');
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
          if (data.pending) { this.setStatus('FTA deposit awaiting confirmations', 'working'); this.schedulePendingRetry(); return; }
          if (this.pendingDeposit?.txHash === pending.txHash) { this.pendingDeposit = null; this.savePendingDeposit(); }
          this.applyView(data); this.setStatus('Live · server synchronized', 'online'); this.app.showToast('FTA confirmed. Your coins have been credited.');
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
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      const latest = this.withdrawals[0];
      if (latest?.status === 'pending') {
        this.openDialog('Withdrawal in progress');
        document.getElementById('farm-dialog-content').append(tokenVisual(), make('strong', 'farm-dialog-price', `${formatUnits(latest.ftaUnits)} FTA`), make('span', 'farm-dialog-status', 'PENDING'));
        return;
      }
      if (latest && Date.now() - Date.parse(latest.createdAt) < Config.WITHDRAWAL_COOLDOWN_MS) {
        const availableAt = Date.parse(latest.createdAt) + Config.WITHDRAWAL_COOLDOWN_MS;
        this.openDialog('Next withdrawal');
        document.getElementById('farm-dialog-content').append(tokenVisual(), make('strong', 'farm-dialog-price', countdown(availableAt)));
        return;
      }
      this.openDialog('Withdraw FTA');
      const content = document.getElementById('farm-dialog-content'); const label = make('label', 'farm-input-label', 'Coins to withdraw');
      const input = make('input', 'game-input'); input.type = 'number'; input.min = String(Config.MIN_WITHDRAW_COINS); input.step = String(Config.COINS_PER_FTA); input.value = String(Config.MIN_WITHDRAW_COINS); input.inputMode = 'numeric'; input.maxLength = 9;
      const output = make('p', 'farm-conversion-preview'); const update = () => {
        const coins = Number(input.value); output.textContent = Number.isSafeInteger(coins) && coins > 0 && coins % 100 === 0 ? `${formatUnits(BigInt(coins / 100) * Config.COIN_UNITS_PER_FTA)} FTA` : 'Multiple of 100 coins';
      };
      input.addEventListener('input', update); label.appendChild(input); content.append(label, output); update();
      this.addDialogButton('REQUEST FTA WITHDRAWAL', () => this.withdraw(input.value));
    }
    async withdraw(value) {
      if (this.operation) return; const coins = Number(value);
      if (!Number.isSafeInteger(coins) || coins < Config.MIN_WITHDRAW_COINS || coins > Config.MAX_WITHDRAW_COINS || coins % Config.COINS_PER_FTA !== 0) { this.showError({ code: 'FARM_AMOUNT' }); return; }
      this.operation = true;
      try {
        const data = await this.request('withdraw', { actionId: uuid(), coins }); this.applyView(data); this.closeDialog();
        this.app.showToast('Withdrawal requested. Follow its status here in FITIA FARM.'); this.setTab('overview');
      } catch (error) { this.showError(error); }
      finally { this.operation = false; this.render(); }
    }
    manualRefresh() { this.refresh({ quiet: false }).then(() => this.app.showToast('Farm synchronized.')).catch((error) => this.showError(error)); this.checkPendingDeposit().catch(() => {}); }
  }
  globalThis.FitiaFarmCenter = FitiaFarmCenter;
})();
