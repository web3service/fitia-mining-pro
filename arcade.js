(function () {
  'use strict';
  const Config = globalThis.FitiaArcadeConfig;
  if (!Config) throw new Error('FitiaArcadeConfig is required.');
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const make = (tag, className, text) => {
    const element = document.createElement(tag); if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text); return element;
  };
  const formatCoins = (value) => Number(value || 0).toLocaleString('en-US');
  const multiplier = (bps) => `${(Number(bps || 100) / 100).toFixed(2)}×`;
  const percent = (value) => `${(Number(value || 0) * 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}%`;
  const uuid = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  const recoverable = (error) => !error?.code || error.code === 'FARM_NETWORK' || error.code === 'FARM_REVISION' || Number(error?.status) >= 500;
  const ERROR_COPY = {
    FARM_NOT_STARTED: 'FARM activation required.', FARM_INSUFFICIENT_COINS: 'Insufficient FARM coins.',
    FARM_NETWORK: 'Connection lost. Resume to verify the same action.', FARM_REVISION: 'Your balance changed. Resume to verify the same action.',
    WALLET_SESSION_CHANGED: 'Wallet session changed.', MINES_STAKE: 'Invalid Mines stake.', MINES_COUNT: 'Invalid mine count.',
    MINES_ROUND_ACTIVE: 'Finish the active Mines round first.', MINES_ROUND: 'The Mines round is no longer active.',
    MINES_TILE: 'Invalid Mines tile.', MINES_TILE_REVEALED: 'This tile is already revealed.', MINES_CASHOUT: 'Reveal a safe tile before cashing out.',
    CRASH_STAKE: 'Invalid Crash stake.', CRASH_TARGET: 'Invalid auto cashout target.', FLIP_STAKE: 'Invalid Coin Flip stake.', FLIP_CHOICE: 'Choose heads or tails.'
  };

  class ArcadeBase {
    constructor(app, farm, key) {
      this.app = app; this.farm = farm; this.key = key; this.account = null; this.session = 0;
      this.active = false; this.operation = false; this.waiting = false; this.pending = null;
      this.currentResult = null; this.scene = null; this.selectedStake = Config.STAKES[0];
    }
    initBase() {
      document.getElementById(`${this.key}-open-info`)?.addEventListener('click', () => this.openInfo());
      document.getElementById(`${this.key}-close-info`)?.addEventListener('click', () => this.closeInfo());
      document.getElementById(`${this.key}-open-farm`)?.addEventListener('click', () => this.app.nav('farm'));
    }
    setAccount(account) {
      this.session += 1; this.scene?.cancelAnimation();
      this.account = account && /^0x[0-9a-f]{40}$/i.test(account) ? account.toLowerCase() : null;
      this.operation = false; this.waiting = false; this.currentResult = null; this.pending = this.loadPending();
      this.restorePending(this.pending);
      if (!this.account) { this.active = false; this.scene?.setActive(false); }
      this.render();
    }
    restorePending() {}
    enter() {
      this.active = true;
      if (!this.scene) this.scene = this.createScene();
      this.scene?.setActive(true); this.scene?.resize(); this.render();
      if (!this.farm.state) this.farm.refresh({ quiet: false }).catch((error) => this.showError(error));
      if (this.pending && !this.operation) globalThis.setTimeout(() => {
        if (this.active && this.pending && !this.operation) this.resume();
      }, 0);
    }
    createScene() {
      const container = document.getElementById(`${this.key}-3d-container`);
      if (this.key === 'mines') return globalThis.FitiaArcade3D.createMines(container, { onSelect: (index) => this.reveal(index) });
      if (this.key === 'crash') return globalThis.FitiaArcade3D.createCrash(container, { onMultiplier: (value) => {
        const label = document.getElementById('crash-multiplier'); if (label) label.textContent = `${Number(value).toFixed(2)}×`;
      } });
      return globalThis.FitiaArcade3D.createCoinFlip(container);
    }
    exit() { this.active = false; this.scene?.setActive(false); }
    storageKey() { return this.account ? `fitia_${this.key}_pending_v1:${this.account}` : null; }
    loadPending() {
      if (!this.account) return null;
      try {
        const value = JSON.parse(localStorage.getItem(this.storageKey()) || 'null');
        return this.validatePending(value);
      } catch (_) { return null; }
    }
    validatePending(value) {
      if (!value || !UUID_PATTERN.test(value.actionId || '') || typeof value.type !== 'string' || !value.params || typeof value.params !== 'object') return null;
      return { actionId: value.actionId.toLowerCase(), type: value.type, params: value.params };
    }
    savePending() {
      const key = this.storageKey(); if (!key) return;
      try {
        if (this.pending) localStorage.setItem(key, JSON.stringify(this.pending)); else localStorage.removeItem(key);
      } catch (_) { /* Le registre serveur reste autoritaire. */ }
    }
    clearPending() { this.pending = null; this.savePending(); }
    resume() { if (this.pending && !this.operation) return this.perform(this.pending.type, this.pending.params); return Promise.resolve(); }
    started() { return Boolean(this.farm.state?.land?.owned && this.farm.state?.animals?.length); }
    setStatus(message) {
      const status = document.getElementById(`${this.key}-status`); if (!status) return;
      status.textContent = message || ''; status.classList.toggle('hidden', !message);
    }
    showError(error) { this.setStatus(ERROR_COPY[error?.code] || error?.message || 'The game action could not be completed.'); }
    async perform(type, params) {
      if (this.operation || !this.account) return;
      const session = this.session;
      this.pending = this.pending || { actionId: uuid(), type, params };
      const pending = this.pending;
      this.savePending(); this.operation = true; this.waiting = true; this.currentResult = null;
      this.setStatus(''); this.onWaiting(pending); this.render();
      try {
        const data = await this.farm.request('action', { actionId: pending.actionId, type: pending.type, params: pending.params });
        if (session !== this.session) return;
        this.farm.applyView(data);
        const result = this.extractResult(data, pending);
        if (!result) {
          this.clearPending(); this.operation = false; this.waiting = false; this.scene?.cancelAnimation(); this.render(); return;
        }
        this.waiting = false; this.render();
        try { await this.animateResult(result, pending); } catch (_) { this.scene?.cancelAnimation(); }
        if (session !== this.session) return;
        this.currentResult = this.displayResult(result);
        this.clearPending(); this.operation = false; this.waiting = false; this.render();
      } catch (error) {
        if (session !== this.session) return;
        this.operation = false; this.waiting = false; this.scene?.cancelAnimation();
        if (!recoverable(error)) this.clearPending();
        this.showError(error);
        if (error?.code === 'FARM_REVISION') { try { await this.farm.refresh({ quiet: true }); } catch (_) { /* La reprise reste disponible. */ } }
        this.render();
      }
    }
    onWaiting() { this.scene?.startWaiting(); }
    displayResult(result) { return result; }
    openInfo() { this.renderProbabilities(); document.getElementById(`modal-${this.key}-info`)?.classList.add('active'); }
    closeInfo() { document.getElementById(`modal-${this.key}-info`)?.classList.remove('active'); }
    renderProbabilities() {}
    renderHistoryEmpty() {}
  }

  class FitiaMines extends ArcadeBase {
    constructor(app, farm) {
      super(app, farm, 'mines'); this.selectedMineCount = 3;
    }
    init() {
      this.initBase();
      document.querySelectorAll('[data-mines-stake]').forEach((button) => button.addEventListener('click', () => this.setStake(Number(button.dataset.minesStake))));
      document.querySelectorAll('[data-mines-count]').forEach((button) => button.addEventListener('click', () => this.setMineCount(Number(button.dataset.minesCount))));
      document.querySelectorAll('[data-mines-index]').forEach((button) => button.addEventListener('click', () => this.reveal(Number(button.dataset.minesIndex))));
      document.getElementById('mines-start-button')?.addEventListener('click', () => this.start());
      document.getElementById('mines-cashout-button')?.addEventListener('click', () => this.cashout());
      document.getElementById('mines-resume-button')?.addEventListener('click', () => this.resume());
      this.render();
    }
    validatePending(value) {
      const pending = super.validatePending(value); if (!pending) return null;
      const { type, params } = pending;
      if (type === 'mines_start') {
        const stake = Config.normalizeStake(params.stake); const mineCount = Config.normalizeMineCount(params.mineCount);
        if (!stake || !mineCount) return null;
        return { ...pending, params: { stake, mineCount } };
      }
      if (!['mines_reveal', 'mines_cashout'].includes(type) || !UUID_PATTERN.test(String(params.roundId || ''))) return null;
      const normalized = { roundId: String(params.roundId).toLowerCase() };
      if (type === 'mines_reveal') {
        const index = Config.normalizeTileIndex(params.index); if (index === null) return null; normalized.index = index;
      }
      return { ...pending, params: normalized };
    }
    restorePending(pending) {
      if (pending?.type === 'mines_start') { this.selectedStake = pending.params.stake; this.selectedMineCount = pending.params.mineCount; }
    }
    minesState() { return this.farm.state?.mines || { totalRounds: 0, recentRounds: [], active: null }; }
    activeRound() { return this.minesState().active || null; }
    setStake(stake) {
      if (this.operation || this.pending || this.activeRound() || !Config.STAKES.includes(stake)) return;
      this.selectedStake = stake; this.currentResult = null; this.render();
    }
    setMineCount(count) {
      if (this.operation || this.pending || this.activeRound() || !Config.MINES_COUNTS.includes(count)) return;
      this.selectedMineCount = count; this.currentResult = null; this.render();
    }
    start() {
      if (this.pending) return this.resume();
      if (this.operation || !this.account || this.activeRound()) return Promise.resolve();
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return Promise.resolve(); }
      if (Number(this.farm.state.coins) < this.selectedStake) { this.showError({ code: 'FARM_INSUFFICIENT_COINS' }); return Promise.resolve(); }
      return this.perform('mines_start', { stake: this.selectedStake, mineCount: this.selectedMineCount });
    }
    reveal(index) {
      if (this.pending || this.operation || !this.account) return Promise.resolve();
      const round = this.activeRound(); if (!round || round.revealed.includes(index) || Config.normalizeTileIndex(index) === null) return Promise.resolve();
      return this.perform('mines_reveal', { roundId: round.id, index });
    }
    cashout() {
      if (this.pending) return this.resume();
      const round = this.activeRound();
      if (this.operation || !this.account || !round || !round.revealed.length) return Promise.resolve();
      return this.perform('mines_cashout', { roundId: round.id });
    }
    extractResult(data, pending) {
      if (data.minesAction) return data.minesAction;
      const active = this.activeRound();
      if (active?.id === pending.actionId) return { type: 'mines_start', roundId: active.id, status: 'active' };
      if (active?.lastAction?.id === pending.actionId) return active.lastAction;
      const round = this.minesState().recentRounds.find((item) => item.id === pending.params.roundId || item.id === pending.actionId);
      return round?.lastAction?.id === pending.actionId ? round.lastAction : (round?.id === pending.actionId ? { type: 'mines_start', roundId: round.id, status: round.status } : null);
    }
    displayResult(result) { return ['lost', 'cashed'].includes(result.status) ? result : null; }
    completedRound(result = this.currentResult) {
      if (!result?.roundId) return null;
      return this.minesState().recentRounds.find((round) => round.id === result.roundId) || null;
    }
    async animateResult(result) {
      if (result.type === 'mines_reveal') await this.scene?.animateReveal(result.index, result.safe);
      else if (result.type === 'mines_cashout') await this.scene?.animateCashout();
      else this.scene?.setRound(this.activeRound());
    }
    render() {
      const view = document.getElementById('view-mines'); if (!view) return;
      const byId = (id) => document.getElementById(id); const state = this.farm.state; const active = this.activeRound();
      const stake = active?.stake || this.pending?.params.stake || this.selectedStake;
      const mineCount = active?.mineCount || this.pending?.params.mineCount || this.selectedMineCount;
      const revealed = active?.revealed || []; const payout = active ? Config.minesPayout(stake, mineCount, revealed.length) : 0;
      const unlocked = this.started() || Boolean(active) || Boolean(this.pending);
      byId('mines-coin-balance').textContent = formatCoins(state?.coins || 0);
      byId('mines-total-rounds').textContent = formatCoins(this.minesState().totalRounds || 0);
      byId('mines-locked').classList.toggle('hidden', unlocked); byId('mines-game').classList.toggle('locked', !unlocked);
      document.querySelectorAll('[data-mines-stake]').forEach((button) => {
        const selected = Number(button.dataset.minesStake) === stake;
        button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); button.disabled = this.operation || Boolean(this.pending) || Boolean(active);
      });
      document.querySelectorAll('[data-mines-count]').forEach((button) => {
        const selected = Number(button.dataset.minesCount) === mineCount;
        button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); button.disabled = this.operation || Boolean(this.pending) || Boolean(active);
      });
      const displayRound = active || this.completedRound();
      const safeTiles = new Set(displayRound?.revealed || []); const mineTiles = new Set(displayRound && displayRound.status !== 'active' ? displayRound.minePositions || [] : []);
      document.querySelectorAll('[data-mines-index]').forEach((button) => {
        const index = Number(button.dataset.minesIndex); const safe = safeTiles.has(index); const mine = mineTiles.has(index);
        button.classList.toggle('safe', safe); button.classList.toggle('mine', mine); button.classList.toggle('hit', mine && displayRound?.hitMine === index);
        button.setAttribute('aria-pressed', String(safe || mine));
        button.setAttribute('aria-label', `Tile ${index + 1}${safe ? ', safe gem' : mine ? displayRound?.hitMine === index ? ', hit mine' : ', mine' : ''}`);
        button.disabled = this.operation || Boolean(this.pending) || !active || safe;
        const image = button.querySelector('img');
        if (image) {
          if (safe || mine) image.src = safe ? 'assets/gem.svg' : 'assets/mine.svg'; else image.removeAttribute('src');
          image.classList.toggle('hidden', !safe && !mine);
        }
      });
      byId('mines-safe-count').textContent = String(revealed.length);
      byId('mines-current-payout').textContent = `${formatCoins(payout)} coins`;
      byId('mines-next-chance').textContent = percent(Config.minesNextChance(mineCount, revealed.length));
      const start = byId('mines-start-button'); start.classList.toggle('hidden', Boolean(active) || Boolean(this.pending));
      start.querySelector('span').textContent = this.operation && this.pending?.type === 'mines_start' ? 'OPENING…' : `START · ${formatCoins(stake)} COINS`;
      start.disabled = this.operation || !unlocked || Number(state?.coins || 0) < stake;
      const cashout = byId('mines-cashout-button'); cashout.classList.toggle('hidden', !active || Boolean(this.pending));
      cashout.querySelector('span').textContent = this.operation && this.pending?.type === 'mines_cashout' ? 'CASHING OUT…' : `CASH OUT · ${formatCoins(payout)} COINS`;
      cashout.disabled = this.operation || !revealed.length;
      const resume = byId('mines-resume-button'); resume.classList.toggle('hidden', !this.pending); resume.disabled = this.operation;
      resume.textContent = this.operation ? 'VERIFYING…' : 'RESUME ROUND';
      this.renderResult(); this.renderHistory(); this.scene?.setRound(displayRound);
      if (document.getElementById('modal-mines-info')?.classList.contains('active')) this.renderProbabilities();
    }
    renderResult() {
      const card = document.getElementById('mines-result'); card.classList.toggle('hidden', !this.currentResult); if (!this.currentResult) return;
      const result = this.currentResult; const round = this.completedRound(result); if (!round) return;
      const won = result.status === 'cashed'; card.classList.toggle('lost', !won); card.classList.toggle('won', won);
      document.getElementById('mines-result-title').textContent = won ? `CASHED OUT · ${formatCoins(round.coins)} COINS` : 'MINE HIT';
      const net = round.coins - round.stake;
      document.getElementById('mines-result-detail').textContent = `${round.revealed.length} safe · ${round.mineCount} mines · Net ${net >= 0 ? '+' : ''}${formatCoins(net)} coins`;
    }
    renderHistory() {
      const list = document.getElementById('mines-history-list'); const rounds = this.minesState().recentRounds || []; list.textContent = '';
      document.getElementById('mines-history-empty').classList.toggle('hidden', rounds.length > 0);
      rounds.slice(0, 8).forEach((round) => {
        const won = round.status === 'cashed'; const row = make('article', `arcade-history-row ${won ? 'won' : 'lost'}`);
        const mark = make('span', 'arcade-history-mark', won ? '◆' : '×'); const main = make('div');
        main.append(make('strong', '', won ? `+${formatCoins(round.coins)} coins` : `−${formatCoins(round.stake)} coins`), make('small', '', `${round.revealed.length} safe · ${round.mineCount} mines`));
        row.append(mark, main, make('span', 'arcade-history-stake', `${round.stake}`)); list.appendChild(row);
      });
    }
    renderProbabilities() {
      const list = document.getElementById('mines-probability-list'); if (!list) return; list.textContent = '';
      Config.MINES_COUNTS.forEach((count) => {
        const row = make('div', 'arcade-probability-row');
        row.append(make('strong', '', `${count} ${count === 1 ? 'MINE' : 'MINES'}`), make('span', '', `${formatCoins(Config.minesPayout(this.selectedStake, count, 1))} coins`), make('b', '', percent(Config.minesNextChance(count, 0))));
        list.appendChild(row);
      });
      document.getElementById('mines-probability-base').textContent = `${formatCoins(this.selectedStake)} coins`;
    }
  }

  class FitiaCrash extends ArcadeBase {
    constructor(app, farm) { super(app, farm, 'crash'); this.selectedTarget = 200; }
    setAccount(account) { super.setAccount(account); this.scene?.reset?.(); }
    init() {
      this.initBase();
      document.querySelectorAll('[data-crash-stake]').forEach((button) => button.addEventListener('click', () => this.setStake(Number(button.dataset.crashStake))));
      document.querySelectorAll('[data-crash-target]').forEach((button) => button.addEventListener('click', () => this.setTarget(Number(button.dataset.crashTarget))));
      document.getElementById('crash-play-button')?.addEventListener('click', () => this.play()); this.render();
    }
    validatePending(value) {
      const pending = super.validatePending(value); if (!pending || pending.type !== 'crash_play') return null;
      const stake = Config.normalizeStake(pending.params.stake); const targetBps = Config.normalizeCrashTarget(pending.params.targetBps);
      return stake && targetBps ? { ...pending, params: { stake, targetBps } } : null;
    }
    restorePending(pending) { if (pending) { this.selectedStake = pending.params.stake; this.selectedTarget = pending.params.targetBps; } }
    crashState() { return this.farm.state?.crash || { totalRounds: 0, recentRounds: [] }; }
    setStake(stake) { if (this.operation || this.pending || !Config.STAKES.includes(stake)) return; this.selectedStake = stake; this.currentResult = null; this.scene?.reset?.(); this.render(); }
    setTarget(target) { if (this.operation || this.pending || !Config.CRASH_TARGETS_BPS.includes(target)) return; this.selectedTarget = target; this.currentResult = null; this.scene?.reset?.(); this.render(); }
    play() {
      if (this.pending) return this.resume();
      if (this.operation || !this.account) return Promise.resolve();
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return Promise.resolve(); }
      if (Number(this.farm.state.coins) < this.selectedStake) { this.showError({ code: 'FARM_INSUFFICIENT_COINS' }); return Promise.resolve(); }
      return this.perform('crash_play', { stake: this.selectedStake, targetBps: this.selectedTarget });
    }
    extractResult(data, pending) { return data.crashResult || this.crashState().recentRounds.find((round) => round.id === pending.actionId) || null; }
    async animateResult(result) { await this.scene?.animateResult(result); }
    render() {
      const view = document.getElementById('view-crash'); if (!view) return;
      const byId = (id) => document.getElementById(id); const state = this.farm.state;
      const stake = this.pending?.params.stake || this.selectedStake; const target = this.pending?.params.targetBps || this.selectedTarget;
      const unlocked = this.started() || Boolean(this.pending);
      byId('crash-coin-balance').textContent = formatCoins(state?.coins || 0); byId('crash-total-rounds').textContent = formatCoins(this.crashState().totalRounds || 0);
      byId('crash-locked').classList.toggle('hidden', unlocked); byId('crash-game').classList.toggle('locked', !unlocked);
      document.querySelectorAll('[data-crash-stake]').forEach((button) => { const active = Number(button.dataset.crashStake) === stake; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); button.disabled = this.operation || Boolean(this.pending); });
      document.querySelectorAll('[data-crash-target]').forEach((button) => { const active = Number(button.dataset.crashTarget) === target; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); button.disabled = this.operation || Boolean(this.pending); });
      const payout = Config.crashPayout(stake, target); const chance = Config.crashWinningOutcomes(target) / Config.CRASH_RANDOM_RANGE;
      byId('crash-chance-value').textContent = percent(chance); byId('crash-payout-value').textContent = `${formatCoins(payout)} coins`; byId('crash-net-value').textContent = `+${formatCoins(payout - stake)} coins`;
      byId('crash-stage-target-value').textContent = multiplier(target); byId('crash-stage-payout-value').textContent = `${formatCoins(payout)} coins`;
      const stageState = this.currentResult ? (this.currentResult.won ? 'won' : 'lost') : this.operation ? (this.waiting ? 'preparing' : 'flying') : 'ready';
      byId('crash-stage').dataset.state = stageState;
      const captions = { ready: 'READY FOR LAUNCH', preparing: 'LAUNCHING', flying: 'IN FLIGHT', won: 'AUTO CASHED OUT', lost: 'CRASHED' };
      byId('crash-multiplier-caption').textContent = captions[stageState];
      const button = byId('crash-play-button');
      button.querySelector('span').textContent = this.operation ? this.waiting ? 'LAUNCHING…' : 'IN FLIGHT' : this.pending ? 'RESUME FLIGHT' : `LAUNCH · ${formatCoins(stake)} COINS`;
      button.disabled = this.operation || !unlocked || (!this.pending && Number(state?.coins || 0) < stake);
      this.renderResult(); this.renderHistory(); if (document.getElementById('modal-crash-info')?.classList.contains('active')) this.renderProbabilities();
    }
    renderResult() {
      const card = document.getElementById('crash-result'); card.classList.toggle('hidden', !this.currentResult); if (!this.currentResult) return;
      const result = this.currentResult; card.classList.toggle('won', result.won); card.classList.toggle('lost', !result.won);
      document.getElementById('crash-result-title').textContent = result.won ? `${multiplier(result.targetBps)} TARGET REACHED` : `CRASHED · ${multiplier(result.crashBps)}`;
      const net = result.coins - result.stake;
      document.getElementById('crash-result-detail').textContent = `Auto ${multiplier(result.targetBps)} · Stake ${formatCoins(result.stake)} · Net ${net >= 0 ? '+' : ''}${formatCoins(net)} coins`;
    }
    renderHistory() {
      const list = document.getElementById('crash-history-list'); const rounds = this.crashState().recentRounds || []; list.textContent = '';
      document.getElementById('crash-history-empty').classList.toggle('hidden', rounds.length > 0);
      rounds.slice(0, 8).forEach((round) => {
        const row = make('article', `arcade-history-row ${round.won ? 'won' : 'lost'}`);
        const main = make('div'); main.append(make('strong', '', round.won ? `+${formatCoins(round.coins)} coins` : `−${formatCoins(round.stake)} coins`), make('small', '', `Auto ${multiplier(round.targetBps)} · Crash ${multiplier(round.crashBps)}`));
        row.append(make('span', 'arcade-history-mark', multiplier(round.crashBps)), main, make('span', 'arcade-history-stake', `${round.stake}`)); list.appendChild(row);
      });
      const strip = document.getElementById('crash-history-strip'); const recent = document.getElementById('crash-recent-multipliers');
      strip.classList.toggle('hidden', !rounds.length); recent.textContent = '';
      rounds.slice(0, 8).forEach((round) => {
        const level = round.crashBps >= 500 ? 'high' : round.crashBps >= 200 ? 'medium' : 'low';
        const chip = make('span', `crash-recent-chip ${level}`, multiplier(round.crashBps));
        chip.setAttribute('role', 'listitem'); chip.setAttribute('aria-label', `Crash ${multiplier(round.crashBps)}, auto cashout ${multiplier(round.targetBps)}`);
        recent.appendChild(chip);
      });
    }
    renderProbabilities() {
      const list = document.getElementById('crash-probability-list'); if (!list) return; list.textContent = '';
      Config.CRASH_TARGETS_BPS.forEach((target) => {
        const row = make('div', 'arcade-probability-row');
        row.append(make('strong', '', multiplier(target)), make('span', '', `${formatCoins(Config.crashPayout(this.selectedStake, target))} coins`), make('b', '', percent(Config.crashWinningOutcomes(target) / Config.CRASH_RANDOM_RANGE)));
        list.appendChild(row);
      });
      document.getElementById('crash-probability-base').textContent = `${formatCoins(this.selectedStake)} coins`;
    }
  }

  class FitiaCoinFlip extends ArcadeBase {
    constructor(app, farm) { super(app, farm, 'coin-flip'); this.selectedChoice = 'heads'; }
    init() {
      this.initBase();
      document.querySelectorAll('[data-flip-stake]').forEach((button) => button.addEventListener('click', () => this.setStake(Number(button.dataset.flipStake))));
      document.querySelectorAll('[data-flip-choice]').forEach((button) => button.addEventListener('click', () => this.setChoice(button.dataset.flipChoice)));
      document.getElementById('flip-play-button')?.addEventListener('click', () => this.play()); this.render();
    }
    validatePending(value) {
      const pending = super.validatePending(value); if (!pending || pending.type !== 'coin_flip') return null;
      const stake = Config.normalizeStake(pending.params.stake); const choice = Config.normalizeFlipChoice(pending.params.choice);
      return stake && choice ? { ...pending, params: { stake, choice } } : null;
    }
    restorePending(pending) { if (pending) { this.selectedStake = pending.params.stake; this.selectedChoice = pending.params.choice; } }
    flipState() { return this.farm.state?.coinFlip || { totalRounds: 0, recentFlips: [] }; }
    setStake(stake) { if (this.operation || this.pending || !Config.STAKES.includes(stake)) return; this.selectedStake = stake; this.currentResult = null; this.render(); }
    setChoice(choice) { if (this.operation || this.pending || !Config.FLIP_SIDES.includes(choice)) return; this.selectedChoice = choice; this.currentResult = null; this.render(); }
    play() {
      if (this.pending) return this.resume();
      if (this.operation || !this.account) return Promise.resolve();
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return Promise.resolve(); }
      if (Number(this.farm.state.coins) < this.selectedStake) { this.showError({ code: 'FARM_INSUFFICIENT_COINS' }); return Promise.resolve(); }
      return this.perform('coin_flip', { stake: this.selectedStake, choice: this.selectedChoice });
    }
    extractResult(data, pending) { return data.flip || this.flipState().recentFlips.find((flip) => flip.id === pending.actionId) || null; }
    async animateResult(result) { await this.scene?.animateResult(result.result); }
    render() {
      const view = document.getElementById('view-coin-flip'); if (!view) return;
      const byId = (id) => document.getElementById(id); const state = this.farm.state;
      const stake = this.pending?.params.stake || this.selectedStake; const choice = this.pending?.params.choice || this.selectedChoice;
      const unlocked = this.started() || Boolean(this.pending);
      byId('flip-coin-balance').textContent = formatCoins(state?.coins || 0); byId('flip-total-rounds').textContent = formatCoins(this.flipState().totalRounds || 0);
      byId('flip-locked').classList.toggle('hidden', unlocked); byId('flip-game').classList.toggle('locked', !unlocked);
      document.querySelectorAll('[data-flip-stake]').forEach((button) => { const active = Number(button.dataset.flipStake) === stake; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); button.disabled = this.operation || Boolean(this.pending); });
      document.querySelectorAll('[data-flip-choice]').forEach((button) => { const active = button.dataset.flipChoice === choice; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); button.disabled = this.operation || Boolean(this.pending); });
      const payout = Config.flipPayout(stake); byId('flip-chance-value').textContent = '50%'; byId('flip-payout-value').textContent = `${formatCoins(payout)} coins`; byId('flip-net-value').textContent = `+${formatCoins(payout - stake)} coins`;
      const button = byId('flip-play-button'); button.querySelector('span').textContent = this.operation ? this.waiting ? 'FLIPPING…' : 'IN THE AIR' : this.pending ? 'RESUME FLIP' : `FLIP · ${formatCoins(stake)} COINS`;
      button.disabled = this.operation || !unlocked || (!this.pending && Number(state?.coins || 0) < stake);
      this.renderResult(); this.renderHistory(); if (document.getElementById('modal-coin-flip-info')?.classList.contains('active')) this.renderProbabilities();
    }
    renderResult() {
      const card = document.getElementById('flip-result'); card.classList.toggle('hidden', !this.currentResult); if (!this.currentResult) return;
      const result = this.currentResult; card.classList.toggle('won', result.won); card.classList.toggle('lost', !result.won);
      document.getElementById('flip-result-title').textContent = `${result.result.toUpperCase()} · ${result.won ? 'WIN' : 'NO WIN'}`;
      const net = result.coins - result.stake;
      document.getElementById('flip-result-detail').textContent = `Chose ${result.choice} · Stake ${formatCoins(result.stake)} · Net ${net >= 0 ? '+' : ''}${formatCoins(net)} coins`;
    }
    renderHistory() {
      const list = document.getElementById('flip-history-list'); const flips = this.flipState().recentFlips || []; list.textContent = '';
      document.getElementById('flip-history-empty').classList.toggle('hidden', flips.length > 0);
      flips.slice(0, 8).forEach((flip) => {
        const row = make('article', `arcade-history-row ${flip.won ? 'won' : 'lost'}`); const main = make('div');
        main.append(make('strong', '', flip.won ? `+${formatCoins(flip.coins)} coins` : `−${formatCoins(flip.stake)} coins`), make('small', '', `${flip.result.toUpperCase()} · Chose ${flip.choice}`));
        row.append(make('span', 'arcade-history-mark', flip.result === 'heads' ? 'H' : 'T'), main, make('span', 'arcade-history-stake', `${flip.stake}`)); list.appendChild(row);
      });
    }
    renderProbabilities() {
      const list = document.getElementById('flip-probability-list'); if (!list) return; list.textContent = '';
      Config.FLIP_SIDES.forEach((side) => {
        const row = make('div', 'arcade-probability-row'); row.append(make('strong', '', side.toUpperCase()), make('span', '', `${formatCoins(Config.flipPayout(this.selectedStake))} coins`), make('b', '', '50%')); list.appendChild(row);
      });
      document.getElementById('flip-probability-base').textContent = `${formatCoins(this.selectedStake)} coins`;
    }
  }

  globalThis.FitiaMines = FitiaMines; globalThis.FitiaCrash = FitiaCrash; globalThis.FitiaCoinFlip = FitiaCoinFlip;
})();
