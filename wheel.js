(function () {
  'use strict';
  const Config = globalThis.FitiaWheelConfig;
  if (!Config) throw new Error('FitiaWheelConfig is required.');

  const PRODUCT_NAMES = { wheat: 'Wheat', carrot: 'Carrot', eggs: 'Eggs', wool: 'Wool', milk: 'Milk' };
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const TWO_PI = Math.PI * 2;
  const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const uuid = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  const formatCoins = (value) => Number(value || 0).toLocaleString('en-US');
  const formatFta = (coins) => {
    const value = Number(coins || 0) / 100;
    return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
  const countdown = (milliseconds) => {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const rest = seconds % 60;
    return [hours, minutes, rest].map((part) => String(part).padStart(2, '0')).join(':');
  };

  class FitiaLuckyWheel {
    constructor(app, farmCenter) {
      this.app = app; this.farm = farmCenter; this.account = null; this.session = 0;
      this.active = false; this.operation = false; this.waiting = false; this.mode = 'paid';
      this.selectedStake = Config.DEFAULT_STAKE; this.pending = null; this.currentResult = null;
      this.rotation = 0; this.canvas = null; this.context = null; this.animationFrame = 0;
      this.animationGeneration = 0; this.clockTimer = null; this.resizeObserver = null; this.animationResolve = null;
      this.layout = this.createLayout();
    }

    createLayout() {
      let cursor = 0;
      return Config.SEGMENTS.map((segment) => {
        const start = cursor * TWO_PI / Config.TOTAL_WEIGHT;
        cursor += segment.weight;
        return { segment, start, end: cursor * TWO_PI / Config.TOTAL_WEIGHT };
      });
    }

    init() {
      this.canvas = document.getElementById('lucky-wheel-canvas');
      try { this.context = this.canvas?.getContext('2d') || null; } catch (_) { this.context = null; }
      if (!this.context) this.setCanvasFallback();
      document.querySelectorAll('[data-wheel-mode]').forEach((button) => button.addEventListener('click', () => this.setMode(button.dataset.wheelMode)));
      document.querySelectorAll('[data-wheel-stake]').forEach((button) => button.addEventListener('click', () => this.setStake(Number(button.dataset.wheelStake))));
      document.getElementById('wheel-spin-button')?.addEventListener('click', () => this.spin());
      document.getElementById('wheel-open-info')?.addEventListener('click', () => this.openInfo());
      document.getElementById('wheel-close-info')?.addEventListener('click', () => this.closeInfo());
      document.getElementById('wheel-open-farm')?.addEventListener('click', () => this.app.nav('farm'));
      this.clockTimer = globalThis.setInterval(() => this.tick(), 1000);
      if (globalThis.ResizeObserver && this.canvas) {
        this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.canvas);
      }
      globalThis.addEventListener?.('resize', () => this.resize());
      this.resize(); this.render();
    }

    setAccount(account) {
      this.session += 1; this.cancelAnimation();
      this.account = account && /^0x[0-9a-f]{40}$/i.test(account) ? account.toLowerCase() : null;
      this.operation = false; this.waiting = false; this.currentResult = null; this.pending = this.loadPending();
      this.mode = this.pending?.mode || 'paid';
      if (this.pending?.mode === 'paid') this.selectedStake = this.pending.stake;
      this.render();
    }

    enter() {
      this.active = true; this.render(); this.resize();
      if (this.operation && this.waiting && !this.animationFrame) this.beginWaiting();
      if (!this.farm.state) this.farm.refresh({ quiet: false }).catch((error) => this.showError(error));
      if (this.pending && !this.operation) globalThis.setTimeout(() => {
        if (this.active && this.pending && !this.operation) this.spin();
      }, 0);
    }

    exit() { this.active = false; this.cancelAnimation(); }

    storageKey() { return this.account ? `fitia_wheel_pending_v1:${this.account}` : null; }
    loadPending() {
      if (!this.account) return null;
      try {
        const value = JSON.parse(localStorage.getItem(this.storageKey()) || 'null');
        if (!value || !UUID_PATTERN.test(value.actionId || '') || !['free', 'paid', 'bonus'].includes(value.mode)) return null;
        if (value.mode === 'paid' && !Config.normalizeStake(value.stake)) return null;
        return { actionId: value.actionId.toLowerCase(), mode: value.mode, stake: value.mode === 'paid' ? Number(value.stake) : 0 };
      } catch (_) { return null; }
    }
    savePending() {
      const key = this.storageKey(); if (!key) return;
      try {
        if (this.pending) localStorage.setItem(key, JSON.stringify(this.pending));
        else localStorage.removeItem(key);
      } catch (_) { /* The server ledger remains authoritative if storage is full. */ }
    }
    clearPending() { this.pending = null; this.savePending(); }

    wheelState() {
      return this.farm.state?.wheel || { lastFreeAt: 0, bonusSpins: 0, totalSpins: 0, recentSpins: [] };
    }
    freeRemaining() { return Math.max(0, this.wheelState().lastFreeAt + Config.FREE_INTERVAL_MS - Date.now()); }
    started() { return Boolean(this.farm.state?.land?.owned && this.farm.state?.animals?.length); }
    effectiveStake() { return this.mode === 'paid' ? this.selectedStake : (this.mode === 'free' ? Config.FREE_BASE_COINS : Config.BONUS_BASE_COINS); }

    setMode(mode) {
      if (this.operation || this.pending || !['free', 'paid', 'bonus'].includes(mode)) return;
      this.mode = mode; this.currentResult = null; this.render();
    }
    setStake(stake) {
      if (this.operation || this.pending || !Config.STAKES.includes(stake)) return;
      this.selectedStake = stake; this.mode = 'paid'; this.currentResult = null; this.render();
    }

    async spin() {
      if (this.operation || !this.account) return;
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      const pending = this.pending;
      const mode = pending?.mode || this.mode;
      const stake = pending?.stake || (mode === 'paid' ? this.selectedStake : 0);
      if (!pending) {
        if (mode === 'free' && this.freeRemaining() > 0) { this.showError({ code: 'WHEEL_FREE_COOLDOWN' }); return; }
        if (mode === 'bonus' && !this.wheelState().bonusSpins) { this.showError({ code: 'WHEEL_BONUS_EMPTY' }); return; }
        if (mode === 'paid' && Number(this.farm.state.coins) < stake) { this.showError({ code: 'FARM_INSUFFICIENT_COINS' }); return; }
      }
      const session = this.session;
      this.pending = pending || { actionId: uuid(), mode, stake };
      this.savePending(); this.operation = true; this.waiting = true; this.currentResult = null;
      this.setStatus(''); this.render(); this.beginWaiting();
      try {
        const params = mode === 'paid' ? { mode, stake: String(stake) } : { mode };
        const data = await this.farm.request('action', { actionId: this.pending.actionId, type: 'wheel_spin', params });
        if (session !== this.session) return;
        this.farm.applyView(data);
        const result = data.spin || this.wheelState().recentSpins.find((item) => item.id === this.pending.actionId);
        if (!result) {
          this.clearPending(); this.operation = false; this.waiting = false; this.cancelAnimation(); this.render();
          this.app.showToast('Spin recovered · balance synchronized'); return;
        }
        try { await this.animateResult(result); } catch (_) { this.cancelAnimation(); }
        if (session !== this.session) return;
        this.currentResult = result; this.clearPending(); this.operation = false; this.waiting = false;
        if (mode === 'free' || (mode === 'bonus' && !this.wheelState().bonusSpins)) this.mode = 'paid';
        this.render(); this.celebrate(result);
      } catch (error) {
        if (session !== this.session) return;
        this.operation = false; this.waiting = false; this.cancelAnimation();
        const recoverable = !error?.code || error.code === 'FARM_NETWORK' || error.code === 'FARM_REVISION' || Number(error?.status) >= 500;
        if (!recoverable) this.clearPending();
        this.showError(error);
        if (error?.code === 'FARM_REVISION') {
          try { await this.farm.refresh({ quiet: true }); } catch (_) { /* Resume remains available. */ }
        }
        this.render();
      }
    }

    beginWaiting() {
      if (!this.context || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      this.cancelAnimation(); const generation = this.animationGeneration;
      let previous = performance.now();
      const frame = (time) => {
        if (generation !== this.animationGeneration || !this.waiting) return;
        const elapsed = Math.min(50, time - previous); previous = time;
        this.rotation = mod(this.rotation + elapsed * 0.009, TWO_PI); this.paintRotation();
        this.animationFrame = requestAnimationFrame(frame);
      };
      this.animationFrame = requestAnimationFrame(frame);
    }

    animateResult(result) {
      const entry = this.layout.find((item) => item.segment.id === result.segmentId);
      if (!entry) return Promise.reject(new Error('Unknown server wheel result.'));
      const desired = -Math.PI / 2 - (entry.start + entry.end) / 2;
      const start = this.rotation; const distance = mod(desired - start, TWO_PI) + TWO_PI * 6;
      if (!this.active || !this.context || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        this.rotation = mod(start + distance, TWO_PI); this.cancelAnimation(); this.paintRotation(); return Promise.resolve();
      }
      this.cancelAnimation(); this.waiting = false; const generation = this.animationGeneration;
      const duration = 3900; const startedAt = performance.now();
      return new Promise((resolve) => {
        this.animationResolve = resolve;
        const frame = (time) => {
          if (generation !== this.animationGeneration) { this.animationResolve = null; resolve(); return; }
          const progress = Math.min(1, (time - startedAt) / duration);
          const eased = 1 - Math.pow(1 - progress, 4);
          this.rotation = start + distance * eased; this.paintRotation();
          if (progress >= 1) {
            this.rotation = mod(this.rotation, TWO_PI); this.paintRotation(); this.animationFrame = 0; this.animationResolve = null; resolve();
          } else this.animationFrame = requestAnimationFrame(frame);
        };
        this.animationFrame = requestAnimationFrame(frame);
      });
    }

    cancelAnimation() {
      this.animationGeneration += 1;
      if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
      const resolve = this.animationResolve; this.animationResolve = null;
      if (resolve) resolve();
    }

    paintRotation() {
      if (this.canvas) this.canvas.style.transform = `rotate(${this.rotation}rad)`;
    }

    setCanvasFallback() {
      this.context = null; this.canvas?.closest('.wheel-stage')?.classList.add('canvas-unavailable');
    }

    resize() {
      if (!this.canvas || !this.context) return;
      try {
        const bounds = this.canvas.getBoundingClientRect();
        if (!this.active && bounds.width <= 0) return;
        const size = Math.max(220, Math.round(bounds.width || 320)); const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
        const width = Math.round(size * ratio); const height = Math.round(size * ratio);
        if (this.canvas.width === width && this.canvas.height === height) { this.paintRotation(); return; }
        this.canvas.width = width; this.canvas.height = height;
        this.context.setTransform(ratio, 0, 0, ratio, 0, 0); this.draw();
      } catch (_) { this.setCanvasFallback(); }
    }

    draw() {
      const ctx = this.context; if (!ctx || !this.canvas) return;
      const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
      const size = this.canvas.width / ratio; const center = size / 2; const radius = center - 12;
      ctx.clearRect(0, 0, size, size); ctx.save(); ctx.translate(center, center);
      const rim = ctx.createRadialGradient(-radius * .25, -radius * .3, radius * .1, 0, 0, radius);
      rim.addColorStop(0, '#fff0a6'); rim.addColorStop(.55, '#c28a22'); rim.addColorStop(1, '#503112');
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, TWO_PI); ctx.fillStyle = rim; ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0;
      const wheelRadius = radius - 13;
      this.layout.forEach(({ segment, start, end }) => {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, wheelRadius, start, end); ctx.closePath();
        ctx.fillStyle = segment.color; ctx.fill(); ctx.strokeStyle = 'rgba(255,240,180,.38)'; ctx.lineWidth = 1.2; ctx.stroke();
        const middle = (start + end) / 2; const narrow = segment.weight < 5;
        ctx.save(); ctx.rotate(middle); ctx.translate(wheelRadius * .61, 0); if (!narrow) ctx.rotate(Math.PI / 2);
        ctx.fillStyle = segment.id === 'fta_big' ? '#382332' : '#fff9e9'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = segment.id === 'fta_big' ? 0 : 3;
        ctx.font = `800 ${narrow ? Math.max(7, size * .021) : Math.max(8, size * .027)}px Inter, sans-serif`;
        const words = narrow ? [segment.label] : segment.label.split(' ');
        words.forEach((word, index) => ctx.fillText(word, 0, (index - (words.length - 1) / 2) * size * .032));
        ctx.restore();
      });
      const shine = ctx.createRadialGradient(-wheelRadius * .35, -wheelRadius * .4, 0, 0, 0, wheelRadius);
      shine.addColorStop(0, 'rgba(255,255,255,.2)'); shine.addColorStop(.5, 'rgba(255,255,255,0)'); shine.addColorStop(1, 'rgba(0,0,0,.22)');
      ctx.beginPath(); ctx.arc(0, 0, wheelRadius, 0, TWO_PI); ctx.fillStyle = shine; ctx.fill();
      for (let index = 0; index < 24; index += 1) {
        const angle = index * TWO_PI / 24; const x = Math.cos(angle) * (radius - 5); const y = Math.sin(angle) * (radius - 5);
        ctx.beginPath(); ctx.arc(x, y, Math.max(2, size * .008), 0, TWO_PI);
        ctx.fillStyle = index % 2 ? '#fff2a8' : '#f4b72c'; ctx.shadowColor = '#ffd45c'; ctx.shadowBlur = 5; ctx.fill();
      }
      ctx.shadowBlur = 0;
      const hub = ctx.createRadialGradient(-12, -15, 3, 0, 0, size * .16);
      hub.addColorStop(0, '#fff3b0'); hub.addColorStop(.32, '#e5b83f'); hub.addColorStop(1, '#6d4216');
      ctx.beginPath(); ctx.arc(0, 0, size * .14, 0, TWO_PI); ctx.fillStyle = hub; ctx.fill();
      ctx.strokeStyle = '#ffe992'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#2b1b22'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${size * .037}px Inter, sans-serif`; ctx.fillText('FITIA', 0, -size * .018);
      ctx.font = `800 ${size * .024}px Inter, sans-serif`; ctx.fillText('LUCKY', 0, size * .027);
      ctx.restore(); this.paintRotation();
    }

    rewardText(reward, detailed = false) {
      if (reward.kind === 'fta') return `+${formatFta(reward.ftaCoins)} FTA${detailed ? ` · ${formatCoins(reward.coins)} coins` : ''}`;
      if (reward.kind === 'coins') return `+${formatCoins(reward.coins)} coins`;
      if (reward.kind === 'feed') return `+${formatCoins(reward.feed)} feed`;
      if (reward.kind === 'product') return `+${formatCoins(reward.quantity)} ${PRODUCT_NAMES[reward.product] || reward.product}`;
      if (reward.kind === 'extra_spin') return '+1 bonus spin';
      return 'Reward';
    }

    render() {
      const view = document.getElementById('view-wheel'); if (!view) return;
      const state = this.farm.state; const wheel = this.wheelState(); const remaining = this.freeRemaining();
      const byId = (id) => document.getElementById(id);
      byId('wheel-coin-balance').textContent = formatCoins(state?.coins || 0);
      byId('wheel-bonus-count').textContent = formatCoins(wheel.bonusSpins || 0);
      byId('wheel-free-status').textContent = remaining > 0 ? countdown(remaining) : 'FREE SPIN';
      byId('wheel-free-status').classList.toggle('ready', remaining <= 0);
      byId('wheel-locked').classList.toggle('hidden', this.started());
      byId('wheel-game').classList.toggle('locked', !this.started());
      document.querySelectorAll('[data-wheel-mode]').forEach((button) => {
        const active = button.dataset.wheelMode === this.mode; button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active)); button.disabled = this.operation || Boolean(this.pending);
      });
      document.querySelectorAll('[data-wheel-stake]').forEach((button) => {
        const active = Number(button.dataset.wheelStake) === this.selectedStake;
        button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
        button.disabled = this.mode !== 'paid' || this.operation || Boolean(this.pending);
      });
      const button = byId('wheel-spin-button');
      let label = this.mode === 'free' ? 'FREE SPIN' : this.mode === 'bonus' ? 'BONUS SPIN' : `SPIN · ${formatCoins(this.selectedStake)} COINS`;
      if (this.operation) label = this.waiting ? 'SPINNING…' : 'GOOD LUCK';
      else if (this.pending) label = 'RESUME SPIN';
      button.querySelector('span').textContent = label;
      let disabled = this.operation || !this.started();
      if (!this.pending) {
        if (this.mode === 'free') disabled ||= remaining > 0;
        else if (this.mode === 'bonus') disabled ||= !wheel.bonusSpins;
        else disabled ||= Number(state?.coins || 0) < this.selectedStake;
      }
      button.disabled = disabled;
      this.renderResult(); this.renderHistory();
      if (document.getElementById('modal-wheel-info')?.classList.contains('active')) this.renderProbabilities();
      this.paintRotation();
    }

    renderResult() {
      const card = document.getElementById('wheel-result'); if (!card) return;
      card.classList.toggle('hidden', !this.currentResult);
      if (!this.currentResult) return;
      const result = this.currentResult;
      document.getElementById('wheel-result-title').textContent = this.rewardText(result, true);
      const net = Number(result.coins || 0) - Number(result.stake || 0);
      document.getElementById('wheel-result-detail').textContent = result.stake ? `Stake ${formatCoins(result.stake)} · Net ${net >= 0 ? '+' : ''}${formatCoins(net)} coins` : (result.mode === 'free' ? 'Free spin · credited' : 'Bonus spin · credited');
    }

    renderHistory() {
      const list = document.getElementById('wheel-history-list'); if (!list) return;
      const spins = this.wheelState().recentSpins || []; list.textContent = '';
      document.getElementById('wheel-history-empty').classList.toggle('hidden', spins.length > 0);
      spins.slice(0, 8).forEach((spin) => {
        const row = make('article', 'wheel-history-row');
        const mark = make('span', `wheel-history-mark ${spin.kind}`, Config.segmentById(spin.segmentId)?.label || 'WIN');
        const main = make('div'); main.append(make('strong', '', this.rewardText(spin)), make('small', '', new Date(spin.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })));
        const stake = make('span', 'wheel-history-stake', spin.stake ? `−${formatCoins(spin.stake)}` : (spin.mode === 'free' ? 'FREE' : 'BONUS'));
        row.append(mark, main, stake); list.appendChild(row);
      });
    }

    openInfo() { this.renderProbabilities(); document.getElementById('modal-wheel-info')?.classList.add('active'); }
    closeInfo() { document.getElementById('modal-wheel-info')?.classList.remove('active'); }
    renderProbabilities() {
      const list = document.getElementById('wheel-probability-list'); if (!list) return; list.textContent = '';
      const base = this.effectiveStake();
      Config.SEGMENTS.forEach((segment) => {
        const reward = Config.rewardFor(segment, base); const row = make('div', 'wheel-probability-row');
        const name = make('span', 'wheel-probability-name'); const dot = make('i'); dot.style.background = segment.color;
        name.append(dot, make('strong', '', segment.label));
        row.append(name, make('span', '', this.rewardText(reward, true)), make('b', '', `${segment.weight}%`)); list.appendChild(row);
      });
      document.getElementById('wheel-probability-base').textContent = this.mode === 'paid' ? `${formatCoins(base)} coins` : (this.mode === 'free' ? 'Free spin' : 'Bonus spin');
    }

    celebrate(result) {
      if (!this.active) return;
      const layer = document.getElementById('wheel-celebration'); if (!layer || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      if (!['fta', 'coins', 'extra_spin'].includes(result.kind)) return;
      layer.textContent = '';
      for (let index = 0; index < 18; index += 1) {
        const particle = make('i'); particle.style.setProperty('--particle-angle', `${index * 20}deg`);
        particle.style.setProperty('--particle-delay', `${(index % 4) * 35}ms`); layer.appendChild(particle);
      }
      globalThis.setTimeout(() => { if (layer) layer.textContent = ''; }, 1500);
    }

    tick() {
      if (!document.getElementById('view-wheel')) return;
      const remaining = this.freeRemaining(); const status = document.getElementById('wheel-free-status');
      if (status) { status.textContent = remaining > 0 ? countdown(remaining) : 'FREE SPIN'; status.classList.toggle('ready', remaining <= 0); }
      if (!this.operation && !this.pending && this.mode === 'free') {
        const button = document.getElementById('wheel-spin-button'); if (button) button.disabled = remaining > 0 || !this.started();
      }
    }

    setStatus(message) {
      const status = document.getElementById('wheel-status'); if (!status) return;
      status.textContent = message || ''; status.classList.toggle('hidden', !message);
    }
    showError(error) {
      const messages = {
        FARM_NOT_STARTED: 'FARM activation required.', FARM_INSUFFICIENT_COINS: 'Insufficient FARM coins.',
        WHEEL_FREE_COOLDOWN: 'Free spin available every 24 hours.', WHEEL_BONUS_EMPTY: 'No bonus spin available.',
        WHEEL_STAKE: 'Invalid stake.', WHEEL_MODE: 'Invalid spin mode.',
        FARM_NETWORK: 'Connection lost. Resume to verify the same spin.',
        FARM_REVISION: 'Farm updated. Resume to verify the same spin.',
        WALLET_SESSION_CHANGED: 'Wallet session changed.'
      };
      this.setStatus(messages[error?.code] || error?.message || 'Spin could not be completed.');
    }
  }

  globalThis.FitiaLuckyWheel = FitiaLuckyWheel;
})();
