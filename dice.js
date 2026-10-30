(function () {
  'use strict';
  const Config = globalThis.FitiaDiceConfig;
  if (!Config) throw new Error('FitiaDiceConfig is required.');
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const make = (tag, className, text) => {
    const element = document.createElement(tag); if (className) element.className = className;
    if (text !== undefined) element.textContent = text; return element;
  };
  const formatCoins = (value) => Number(value || 0).toLocaleString('en-US');
  const chanceLabel = (target) => (((target - 1) / 6 * 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') + '%');
  const uuid = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  class FitiaDice {
    constructor(app, farmCenter) {
      this.app = app; this.farm = farmCenter; this.account = null; this.session = 0;
      this.active = false; this.operation = false; this.waiting = false;
      this.selectedStake = Config.STAKES[0]; this.selectedTarget = 4;
      this.pending = null; this.currentResult = null; this.scene = null;
    }
    init() {
      document.querySelectorAll('[data-dice-stake]').forEach((button) => button.addEventListener('click', () => this.setStake(Number(button.dataset.diceStake))));
      document.querySelectorAll('[data-dice-target]').forEach((button) => button.addEventListener('click', () => this.setTarget(Number(button.dataset.diceTarget))));
      document.getElementById('dice-roll-button')?.addEventListener('click', () => this.roll());
      document.getElementById('dice-open-info')?.addEventListener('click', () => this.openInfo());
      document.getElementById('dice-close-info')?.addEventListener('click', () => this.closeInfo());
      document.getElementById('dice-open-farm')?.addEventListener('click', () => this.app.nav('farm'));
      this.render();
    }
    setAccount(account) {
      this.session += 1; this.scene?.cancelAnimation();
      this.account = account && /^0x[0-9a-f]{40}$/i.test(account) ? account.toLowerCase() : null;
      this.operation = false; this.waiting = false; this.currentResult = null; this.pending = this.loadPending();
      if (this.pending) { this.selectedStake = this.pending.stake; this.selectedTarget = this.pending.target; }
      if (!this.account) { this.active = false; this.scene?.setActive(false); }
      this.render();
    }
    enter() {
      this.active = true;
      if (!this.scene) this.scene = globalThis.FitiaDice3D.create(document.getElementById('dice-3d-container'));
      this.scene.setActive(true); this.scene.resize(); this.render();
      if (!this.farm.state) this.farm.refresh({ quiet: false }).catch((error) => this.showError(error));
      if (this.pending && !this.operation) globalThis.setTimeout(() => {
        if (this.active && this.pending && !this.operation) this.roll();
      }, 0);
    }
    exit() { this.active = false; this.scene?.setActive(false); }
    storageKey() { return this.account ? `fitia_dice_pending_v1:${this.account}` : null; }
    loadPending() {
      if (!this.account) return null;
      try {
        const value = JSON.parse(localStorage.getItem(this.storageKey()) || 'null');
        if (!value || !UUID_PATTERN.test(value.actionId || '') || !Config.normalizeStake(value.stake) || !Config.normalizeTarget(value.target)) return null;
        return { actionId: value.actionId.toLowerCase(), stake: Number(value.stake), target: Number(value.target) };
      } catch (_) { return null; }
    }
    savePending() {
      const key = this.storageKey(); if (!key) return;
      try {
        if (this.pending) localStorage.setItem(key, JSON.stringify(this.pending)); else localStorage.removeItem(key);
      } catch (_) { /* Le registre serveur reste autoritaire. */ }
    }
    clearPending() { this.pending = null; this.savePending(); }
    diceState() { return this.farm.state?.dice || { totalRolls: 0, totalStaked: 0, totalWonCoins: 0, recentRolls: [] }; }
    started() { return Boolean(this.farm.state?.land?.owned && this.farm.state?.animals?.length); }
    setStake(stake) {
      if (this.operation || this.pending || !Config.STAKES.includes(stake)) return;
      this.selectedStake = stake; this.currentResult = null; this.render();
    }
    setTarget(target) {
      if (this.operation || this.pending || !Config.TARGETS.includes(target)) return;
      this.selectedTarget = target; this.currentResult = null; this.render();
    }

    async roll() {
      if (this.operation || !this.account) return;
      const pending = this.pending;
      if (!pending && !this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return; }
      const stake = pending?.stake || this.selectedStake; const target = pending?.target || this.selectedTarget;
      if (!pending && Number(this.farm.state.coins) < stake) { this.showError({ code: 'FARM_INSUFFICIENT_COINS' }); return; }
      const session = this.session;
      this.pending = pending || { actionId: uuid(), stake, target };
      this.savePending(); this.operation = true; this.waiting = true; this.currentResult = null;
      this.setStatus(''); this.render(); this.scene?.startWaiting();
      try {
        const data = await this.farm.request('action', {
          actionId: this.pending.actionId, type: 'dice_roll', params: { stake: String(stake), target: String(target) }
        });
        if (session !== this.session) return;
        this.farm.applyView(data);
        const result = data.roll || this.diceState().recentRolls.find((item) => item.id === this.pending.actionId);
        if (!result) {
          this.clearPending(); this.operation = false; this.waiting = false; this.scene?.cancelAnimation(); this.render();
          this.app.showToast('Dice recovered · balance synchronized'); return;
        }
        try { await this.scene?.animateResult(result.roll); } catch (_) { this.scene?.cancelAnimation(); }
        if (session !== this.session) return;
        this.currentResult = result; this.clearPending(); this.operation = false; this.waiting = false;
        this.render(); this.celebrate(result);
      } catch (error) {
        if (session !== this.session) return;
        this.operation = false; this.waiting = false; this.scene?.cancelAnimation();
        const recoverable = !error?.code || error.code === 'FARM_NETWORK' || error.code === 'FARM_REVISION' || Number(error?.status) >= 500;
        if (!recoverable) this.clearPending();
        this.showError(error);
        if (error?.code === 'FARM_REVISION') { try { await this.farm.refresh({ quiet: true }); } catch (_) { /* La reprise reste disponible. */ } }
        this.render();
      }
    }

    render() {
      const view = document.getElementById('view-dice'); if (!view) return;
      const byId = (id) => document.getElementById(id); const state = this.farm.state;
      const stake = this.pending?.stake || this.selectedStake; const target = this.pending?.target || this.selectedTarget;
      const unlocked = this.started() || Boolean(this.pending);
      byId('dice-coin-balance').textContent = formatCoins(state?.coins || 0);
      byId('dice-total-rolls').textContent = formatCoins(this.diceState().totalRolls || 0);
      byId('dice-locked').classList.toggle('hidden', unlocked);
      byId('dice-game').classList.toggle('locked', !unlocked);
      document.querySelectorAll('[data-dice-stake]').forEach((button) => {
        const active = Number(button.dataset.diceStake) === stake;
        button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
        button.disabled = this.operation || Boolean(this.pending);
      });
      document.querySelectorAll('[data-dice-target]').forEach((button) => {
        const active = Number(button.dataset.diceTarget) === target;
        button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
        button.disabled = this.operation || Boolean(this.pending);
      });
      const payout = Config.payoutFor(stake, target);
      byId('dice-chance-value').textContent = chanceLabel(target);
      byId('dice-payout-value').textContent = `${formatCoins(payout)} coins`;
      byId('dice-net-value').textContent = `+${formatCoins(payout - stake)} coins`;
      const button = byId('dice-roll-button');
      let label = this.operation ? 'ROLLING…' : this.pending ? 'RESUME ROLL' : `ROLL · ${formatCoins(stake)} COINS`;
      button.querySelector('span').textContent = label;
      button.disabled = this.operation || !unlocked || (!this.pending && Number(state?.coins || 0) < stake);
      this.renderResult(); this.renderHistory();
      if (document.getElementById('modal-dice-info')?.classList.contains('active')) this.renderProbabilities();
    }
    renderResult() {
      const card = document.getElementById('dice-result'); if (!card) return;
      card.classList.toggle('hidden', !this.currentResult); if (!this.currentResult) return;
      const result = this.currentResult;
      card.classList.toggle('won', result.won); card.classList.toggle('lost', !result.won);
      document.getElementById('dice-result-title').textContent = `ROLL ${result.roll} · ${result.won ? 'WIN' : 'NO WIN'}`;
      const net = result.coins - result.stake;
      document.getElementById('dice-result-detail').textContent = `Target under ${result.target} · Stake ${formatCoins(result.stake)} · Net ${net >= 0 ? '+' : ''}${formatCoins(net)} coins`;
    }
    renderHistory() {
      const list = document.getElementById('dice-history-list'); if (!list) return;
      const rolls = this.diceState().recentRolls || []; list.textContent = '';
      document.getElementById('dice-history-empty').classList.toggle('hidden', rolls.length > 0);
      rolls.slice(0, 8).forEach((roll) => {
        const row = make('article', `dice-history-row ${roll.won ? 'won' : 'lost'}`);
        const mark = make('span', 'dice-history-mark', String(roll.roll));
        const main = make('div'); main.append(
          make('strong', '', roll.won ? `+${formatCoins(roll.coins)} coins` : `−${formatCoins(roll.stake)} coins`),
          make('small', '', `Under ${roll.target} · ${new Date(roll.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
        );
        const stake = make('span', 'dice-history-stake', `−${formatCoins(roll.stake)}`);
        row.append(mark, main, stake); list.appendChild(row);
      });
    }
    openInfo() { this.renderProbabilities(); document.getElementById('modal-dice-info')?.classList.add('active'); }
    closeInfo() { document.getElementById('modal-dice-info')?.classList.remove('active'); }
    renderProbabilities() {
      const list = document.getElementById('dice-probability-list'); if (!list) return; list.textContent = '';
      Config.TARGETS.forEach((target) => {
        const row = make('div', 'dice-probability-row');
        row.append(make('strong', '', `UNDER ${target}`), make('span', '', `${formatCoins(Config.payoutFor(this.selectedStake, target))} coins`), make('b', '', chanceLabel(target)));
        list.appendChild(row);
      });
      document.getElementById('dice-probability-base').textContent = `${formatCoins(this.selectedStake)} coins`;
    }
    celebrate(result) {
      if (!this.active || !result.won || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const layer = document.getElementById('dice-celebration'); if (!layer) return; layer.textContent = '';
      for (let index = 0; index < 18; index += 1) {
        const particle = make('i'); particle.style.setProperty('--particle-angle', `${index * 20}deg`);
        particle.style.setProperty('--particle-delay', `${(index % 4) * 35}ms`); layer.appendChild(particle);
      }
      globalThis.setTimeout(() => { if (layer) layer.textContent = ''; }, 1500);
    }
    setStatus(message) {
      const status = document.getElementById('dice-status'); if (!status) return;
      status.textContent = message || ''; status.classList.toggle('hidden', !message);
    }
    showError(error) {
      const messages = {
        FARM_NOT_STARTED: 'FARM activation required.', FARM_INSUFFICIENT_COINS: 'Insufficient FARM coins.',
        DICE_STAKE: 'Invalid dice stake.', DICE_TARGET: 'Invalid dice target.',
        FARM_NETWORK: 'Connection lost. Resume to verify the same roll.',
        FARM_REVISION: 'Farm updated. Resume to verify the same roll.', WALLET_SESSION_CHANGED: 'Wallet session changed.'
      };
      this.setStatus(messages[error?.code] || error?.message || 'Dice roll could not be completed.');
    }
  }
  globalThis.FitiaDice = FitiaDice;
})();
