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
    CRASH_STAKE: 'Invalid Crash stake.', CRASH_TARGET: 'Invalid auto cashout target.', CRASH_SLOT: 'Invalid bet panel.',
    CRASH_ROUND_ACTIVE: 'Finish the current flight first.', CRASH_ROUND: 'The flight is no longer active.',
    CRASH_BETTING_CLOSED: 'Betting is closed for this flight.', CRASH_BET_ACTIVE: 'This bet is already placed.',
    CRASH_NOT_FLYING: 'Wait for takeoff.', CRASH_CASHOUT_EARLY: 'Cashout is available above 1.00×.',
    CRASH_CLIENT_SEED: 'The flight could not be prepared.', CRASH_RANDOM: 'The flight could not be prepared.',
    FLIP_STAKE: 'Invalid Coin Flip stake.', FLIP_CHOICE: 'Choose heads or tails.'
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
    constructor(app, farm) {
      super(app, farm, 'crash');
      this.selectedTarget = 200;
      this.betSettings = [
        { stake: 50, targetBps: 200, autoCashout: false, autoBet: false },
        { stake: 50, targetBps: 300, autoCashout: false, autoBet: false }
      ];
      this.secondBetEnabled = false; this.syncTimer = null; this.syncing = false;
      this.autoTimer = null; this.autoScheduledFor = null; this.lastCashout = null;
    }
    settings(slot = 1) { return this.betSettings[slot - 1]; }
    setAccount(account) {
      clearTimeout(this.syncTimer); clearTimeout(this.autoTimer); this.syncTimer = null; this.autoTimer = null;
      this.syncing = false; this.autoScheduledFor = null; this.lastCashout = null;
      super.setAccount(account); this.scene?.reset?.();
    }
    init() {
      this.initBase();
      document.querySelectorAll('[data-crash-stake]').forEach((button) => button.addEventListener('click', () => this.setStake(Number(button.dataset.crashSlot || 1), Number(button.dataset.crashStake))));
      document.querySelectorAll('[data-crash-target]').forEach((button) => button.addEventListener('click', () => this.setTarget(Number(button.dataset.crashSlot || 1), Number(button.dataset.crashTarget))));
      document.getElementById('crash-play-button')?.addEventListener('click', () => this.play(1)); this.render();
    }
    enter() { super.enter(); this.scheduleSync(0); this.maybeScheduleAuto(); }
    exit() {
      clearTimeout(this.syncTimer); clearTimeout(this.autoTimer); this.syncTimer = null; this.autoTimer = null;
      this.syncing = false; super.exit();
    }
    serverNow() { return this.farm.serverNow ? this.farm.serverNow() : Date.now(); }
    crashState() { return this.farm.state?.crash || { totalRounds: 0, recentRounds: [], active: null }; }
    activeRound() { return this.crashState().active || null; }
    betFor(slot, round = this.activeRound()) { return round?.bets?.find((bet) => bet.slot === Number(slot)) || null; }
    validatePending(value) {
      const pending = super.validatePending(value); if (!pending) return null;
      const { type, params } = pending;
      if (type === 'crash_play') {
        const stake = Config.normalizeStake(params.stake); const targetBps = Config.normalizeCrashTarget(params.targetBps);
        return stake && targetBps ? { ...pending, params: { stake, targetBps } } : null;
      }
      if (!['crash_start', 'crash_bet', 'crash_cashout'].includes(type)) return null;
      if (type !== 'crash_start' && !UUID_PATTERN.test(String(params.roundId || ''))) return null;
      const slot = Config.normalizeAviatorSlot(params.slot); if (!slot) return null;
      if (type === 'crash_cashout') return { ...pending, params: { roundId: String(params.roundId).toLowerCase(), slot } };
      const stake = Config.normalizeAviatorStake(params.stake);
      const autoTargetBps = params.autoTargetBps === null || params.autoTargetBps === undefined ? null : Config.normalizeAviatorTarget(params.autoTargetBps);
      const clientSeed = String(params.clientSeed || '');
      if (!stake || (params.autoTargetBps !== null && params.autoTargetBps !== undefined && !autoTargetBps) || !/^[A-Za-z0-9-]{8,64}$/.test(clientSeed)) return null;
      const normalized = { slot, stake, autoTargetBps, clientSeed };
      if (type === 'crash_bet') normalized.roundId = String(params.roundId).toLowerCase();
      return { ...pending, params: normalized };
    }
    restorePending(pending) {
      if (!pending) return;
      if (pending.type === 'crash_play') { this.selectedStake = pending.params.stake; this.selectedTarget = pending.params.targetBps; return; }
      const { slot, stake, autoTargetBps } = pending.params;
      if (stake) {
        const settings = this.settings(slot); settings.stake = stake; settings.autoCashout = autoTargetBps !== null && autoTargetBps !== undefined;
        if (settings.autoCashout) settings.targetBps = autoTargetBps;
        if (slot === 1) { this.selectedStake = stake; this.selectedTarget = settings.targetBps; }
        if (slot === 2) this.secondBetEnabled = true;
      }
    }
    setStake(slot, stake) {
      if (stake === undefined) { stake = slot; slot = 1; }
      slot = Number(slot); stake = Number(stake);
      if (this.operation || this.pending || this.betFor(slot) || !Config.normalizeAviatorStake(stake)) return;
      this.settings(slot).stake = stake;
      if (slot === 1) this.selectedStake = stake;
      this.render();
    }
    setTarget(slot, target) {
      if (target === undefined) { target = slot; slot = 1; }
      slot = Number(slot); target = Number(target);
      if (this.operation || this.pending || this.betFor(slot) || !Config.normalizeAviatorTarget(target)) return;
      this.settings(slot).targetBps = target;
      if (slot === 1) this.selectedTarget = target;
      this.render();
    }
    setAutoCashout(slot, enabled) {
      if (this.operation || this.pending || this.betFor(slot)) return;
      this.settings(slot).autoCashout = Boolean(enabled); this.render();
    }
    setAutoBet(slot, enabled) {
      if (this.operation || this.pending) return;
      this.settings(slot).autoBet = Boolean(enabled);
      clearTimeout(this.autoTimer); this.autoTimer = null; this.autoScheduledFor = null;
      this.render(); this.maybeScheduleAuto();
    }
    toggleSecondBet(enabled) {
      if (this.operation || this.pending || this.betFor(2)) return;
      this.secondBetEnabled = enabled === undefined ? !this.secondBetEnabled : Boolean(enabled);
      this.render();
    }
    play(slot = 1) {
      slot = Number(slot);
      if (this.pending) return this.resume();
      if (this.operation || !this.account || !Config.normalizeAviatorSlot(slot)) return Promise.resolve();
      if (!this.started()) { this.showError({ code: 'FARM_NOT_STARTED' }); return Promise.resolve(); }
      const round = this.activeRound(); const bet = this.betFor(slot, round);
      if (round?.status === 'flying') {
        if (bet?.status === 'active') return this.perform('crash_cashout', { roundId: round.id, slot });
        return Promise.resolve();
      }
      if (round && round.status !== 'betting') return Promise.resolve();
      if (bet) return Promise.resolve();
      if (slot === 2) this.secondBetEnabled = true;
      const settings = this.settings(slot);
      if (Number(this.farm.state.coins) < settings.stake) { this.showError({ code: 'FARM_INSUFFICIENT_COINS' }); return Promise.resolve(); }
      const params = { slot, stake: settings.stake, autoTargetBps: settings.autoCashout ? settings.targetBps : null, clientSeed: uuid() };
      if (round) params.roundId = round.id;
      else { this.currentResult = null; this.autoScheduledFor = null; }
      this.lastCashout = null;
      return this.perform(round ? 'crash_bet' : 'crash_start', params);
    }
    resume() { if (this.pending && !this.operation) return this.perform(this.pending.type, this.pending.params); return Promise.resolve(); }
    async perform(type, params) {
      if (this.operation || !this.account) return;
      clearTimeout(this.syncTimer); this.syncTimer = null;
      const session = this.session;
      this.pending = this.pending || { actionId: uuid(), type, params };
      const pending = this.pending; this.savePending(); this.operation = true; this.waiting = true;
      this.setStatus(''); this.render();
      try {
        const data = await this.farm.request('action', { actionId: pending.actionId, type: pending.type, params: pending.params });
        if (session !== this.session) return;
        this.farm.applyView(data);
        const result = this.extractResult(data, pending);
        this.handleAction(result, pending);
        this.clearPending(); this.operation = false; this.waiting = false; this.render();
        this.scheduleSync(120); this.maybeScheduleAuto();
      } catch (error) {
        if (session !== this.session) return;
        this.operation = false; this.waiting = false;
        if (!recoverable(error)) this.clearPending();
        this.showError(error);
        if (error?.code === 'FARM_REVISION') { try { await this.farm.refresh({ quiet: true }); } catch (_) { /* Resume remains available. */ } }
        this.render(); this.scheduleSync(500);
      }
    }
    extractResult(data, pending) {
      if (data.crashAction) return data.crashAction;
      if (data.crashResult) return data.crashResult;
      if (pending.type === 'crash_play') return this.crashState().recentRounds.find((round) => round.id === pending.actionId) || null;
      return null;
    }
    handleAction(result, pending) {
      if (result && !result.roundId) { this.currentResult = result; this.lastCashout = null; return; }
      if (result?.type === 'crash_start') { this.currentResult = null; this.lastCashout = null; this.autoScheduledFor = null; }
      for (const event of result?.events || []) this.lastCashout = { ...event, roundId: result.roundId };
      const roundId = result?.roundId || pending?.params?.roundId;
      if (result?.crash || (!this.activeRound() && roundId)) {
        const completed = this.crashState().recentRounds.find((round) => round.id === roundId);
        if (completed) this.currentResult = completed;
      }
    }
    scheduleSync(delay = 300) {
      clearTimeout(this.syncTimer); this.syncTimer = null;
      if (!this.active || !this.account || !this.activeRound()) return;
      this.syncTimer = globalThis.setTimeout(() => this.sync(), Math.max(0, delay));
    }
    async sync() {
      const round = this.activeRound();
      if (this.syncing || this.operation || this.pending || !this.active || !this.account || !round) return;
      const session = this.session; this.syncing = true;
      try {
        const data = await this.farm.request('action', { actionId: uuid(), type: 'crash_sync', params: { roundId: round.id } });
        if (session !== this.session) return;
        this.farm.applyView(data); this.handleAction(data.crashAction, { type: 'crash_sync', params: { roundId: round.id } });
      } catch (error) {
        if (error?.code === 'FARM_REVISION') this.farm.refresh({ quiet: true }).catch(() => {});
      } finally {
        if (session === this.session) { this.syncing = false; this.render(); this.scheduleSync(280); this.maybeScheduleAuto(); }
      }
    }
    maybeScheduleAuto() {
      if (!this.active || this.operation || this.pending || this.activeRound() || !this.currentResult || this.autoTimer) return;
      const slots = this.betSettings.map((settings, index) => ({ settings, slot: index + 1 }))
        .filter((entry) => entry.settings.autoBet && (entry.slot === 1 || this.secondBetEnabled));
      if (!slots.length || this.autoScheduledFor === this.currentResult.id) return;
      const roundId = this.currentResult.id; this.autoScheduledFor = roundId;
      this.autoTimer = globalThis.setTimeout(async () => {
        this.autoTimer = null;
        if (!this.active || this.activeRound() || this.pending || this.operation || this.currentResult?.id !== roundId) return;
        for (const entry of slots) {
          if (!this.settings(entry.slot).autoBet) continue;
          await this.play(entry.slot);
          if (this.pending || !this.activeRound()) break;
        }
      }, 1300);
    }
    liveMultiplier(round = this.activeRound()) {
      if (!round || round.status !== 'flying') return 100;
      return Config.crashMultiplierAt(this.serverNow() - Date.parse(round.startsAt));
    }
    livePayout(slot, bps = this.liveMultiplier()) {
      const bet = this.betFor(slot); if (!bet || bet.status !== 'active') return 0;
      return Config.aviatorPayout(bet.stake, bps);
    }
    updateLive(bps = this.liveMultiplier()) {
      const round = this.activeRound(); if (!round) return;
      const multiplierLabel = document.getElementById('crash-multiplier');
      if (multiplierLabel) multiplierLabel.textContent = multiplier(round.status === 'flying' ? bps : 100);
      const caption = document.getElementById('crash-multiplier-caption');
      if (caption && round.status === 'betting') caption.textContent = `NEXT FLIGHT · ${Math.max(0, Math.ceil((Date.parse(round.startsAt) - this.serverNow()) / 1000))}s`;
      for (let slot = 1; slot <= 2; slot += 1) {
        const bet = this.betFor(slot, round); const button = document.getElementById(`crash-bet-button-${slot}`);
        if (!button || !bet || bet.status !== 'active' || round.status !== 'flying' || this.operation || this.pending) continue;
        button.querySelector('span').textContent = `CASH OUT · ${formatCoins(Config.aviatorPayout(bet.stake, bps))} COINS`;
        button.disabled = bps <= 100;
      }
      const potential = document.getElementById('crash-stage-payout-value');
      if (potential) {
        const total = (round.bets || []).filter((bet) => bet.status === 'active').reduce((sum, bet) => sum + Config.aviatorPayout(bet.stake, bps), 0);
        potential.textContent = `${formatCoins(total)} coins`;
      }
    }
    render() {
      const view = document.getElementById('view-crash'); const byId = (id) => document.getElementById(id);
      if (!view || !byId('crash-bet-button-1')) return;
      const state = this.farm.state; const round = this.activeRound();
      if (!round && !this.currentResult && !this.pending && !this.operation) this.currentResult = this.crashState().recentRounds?.[0] || null;
      const unlocked = this.started() || Boolean(round) || Boolean(this.pending);
      byId('crash-coin-balance').textContent = formatCoins(state?.coins || 0);
      byId('crash-total-rounds').textContent = formatCoins(this.crashState().totalRounds || 0);
      byId('crash-locked').classList.toggle('hidden', unlocked); byId('crash-game').classList.toggle('locked', !unlocked);
      const stageState = round?.status || (this.currentResult ? this.currentResult.version === 2 ? 'crashed' : this.currentResult.won ? 'won' : 'lost' : this.operation ? 'preparing' : 'ready');
      byId('crash-stage').dataset.state = stageState;
      const captions = { ready: 'PLACE YOUR BETS', preparing: 'PREPARING FLIGHT', betting: 'NEXT FLIGHT', flying: 'IN FLIGHT', won: 'AUTO CASHED OUT', lost: 'FLEW AWAY', crashed: 'FLEW AWAY' };
      byId('crash-multiplier-caption').textContent = captions[stageState] || 'IN FLIGHT';
      byId('crash-stage-target-value').textContent = round ? `${round.bets.length} ${round.bets.length === 1 ? 'BET' : 'BETS'}` : this.secondBetEnabled ? '2 BET PANELS' : '1 BET PANEL';
      byId('crash-stage-payout-value').textContent = `${formatCoins(round?.coins || 0)} coins`;
      byId('crash-add-bet').classList.toggle('hidden', this.secondBetEnabled || Boolean(this.betFor(2, round)));
      byId('crash-remove-bet').classList.toggle('hidden', !this.secondBetEnabled || Boolean(this.betFor(2, round)));
      for (let slot = 1; slot <= 2; slot += 1) {
        const settings = this.settings(slot); const bet = this.betFor(slot, round); const panel = byId(`crash-bet-panel-${slot}`);
        panel.classList.toggle('hidden', slot === 2 && !this.secondBetEnabled && !bet);
        panel.classList.toggle('cashed', bet?.status === 'cashed');
        const lockedBet = Boolean(bet) || this.operation || Boolean(this.pending);
        const displayedStake = bet?.stake ?? settings.stake;
        const displayedAutoCashout = bet ? bet.autoTargetBps !== null && bet.autoTargetBps !== undefined : settings.autoCashout;
        const displayedTargetBps = displayedAutoCashout && bet ? bet.autoTargetBps : settings.targetBps;
        byId(`crash-auto-bet-${slot}`).checked = settings.autoBet;
        byId(`crash-auto-cashout-${slot}`).checked = displayedAutoCashout;
        byId(`crash-auto-bet-${slot}`).disabled = this.operation || Boolean(this.pending);
        byId(`crash-auto-cashout-${slot}`).disabled = lockedBet;
        const targetInput = byId(`crash-target-input-${slot}`); targetInput.disabled = lockedBet || !displayedAutoCashout;
        if (document.activeElement !== targetInput) targetInput.value = (displayedTargetBps / 100).toFixed(2);
        const stakeInput = byId(`crash-stake-input-${slot}`); stakeInput.disabled = lockedBet;
        if (document.activeElement !== stakeInput) stakeInput.value = String(displayedStake);
        document.querySelectorAll(`[data-crash-stake][data-crash-slot="${slot}"]`).forEach((button) => {
          const selected = Number(button.dataset.crashStake) === displayedStake;
          button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); button.disabled = lockedBet;
        });
        const status = bet ? bet.status === 'active' ? round.status === 'betting' ? 'BET PLACED' : 'IN FLIGHT' : bet.status === 'cashed' ? `CASHED ${multiplier(bet.cashoutBps)}` : 'LOST' : settings.autoBet ? 'AUTO BET ON' : 'READY';
        byId(`crash-bet-state-${slot}`).textContent = status;
        const button = byId(`crash-bet-button-${slot}`); button.dataset.state = bet?.status || (round ? round.status : 'ready');
        button.classList.toggle('cashout', Boolean(round?.status === 'flying' && bet?.status === 'active'));
        let label = `BET · ${formatCoins(settings.stake)} COINS`; let disabled = !unlocked || Number(state?.coins || 0) < settings.stake;
        if (this.pending) { label = 'RESUME ACTION'; disabled = this.operation; }
        else if (this.operation) { label = 'SYNCHRONIZING…'; disabled = true; }
        else if (round?.status === 'betting' && bet) { label = 'BET PLACED'; disabled = true; }
        else if (round?.status === 'flying' && bet?.status === 'active') { label = `CASH OUT · ${formatCoins(this.livePayout(slot))} COINS`; disabled = this.liveMultiplier() <= 100; }
        else if (bet?.status === 'cashed') { label = `CASHED OUT · ${multiplier(bet.cashoutBps)}`; disabled = true; }
        else if (round?.status === 'flying') { label = 'WAIT FOR NEXT FLIGHT'; disabled = true; }
        button.querySelector('span').textContent = label; button.disabled = disabled;
      }
      this.scene?.setRound?.(round, this.currentResult);
      this.renderResult(); this.renderHistory(); this.updateLive();
      if (document.getElementById('modal-crash-info')?.classList.contains('active')) this.renderProbabilities();
    }
    renderResult() {
      const card = document.getElementById('crash-result'); if (!card) return;
      const round = this.activeRound();
      if (round && this.lastCashout?.roundId === round.id && this.lastCashout.kind !== 'lost') {
        const event = this.lastCashout; card.classList.remove('hidden', 'lost'); card.classList.add('won');
        document.getElementById('crash-result-title').textContent = `${multiplier(event.cashoutBps)} ${event.kind === 'auto' ? 'AUTO ' : ''}CASHED OUT`;
        document.getElementById('crash-result-detail').textContent = `Bet ${event.slot} · ${formatCoins(event.coins)} coins credited`;
        return;
      }
      const result = this.currentResult; card.classList.toggle('hidden', !result || Boolean(round)); if (!result || round) return;
      if (result.version === 2) {
        const net = result.coins - result.stake; const won = net > 0;
        card.classList.toggle('won', won); card.classList.toggle('lost', !won);
        document.getElementById('crash-result-title').textContent = won ? `NET WIN · +${formatCoins(net)} COINS` : `FLEW AWAY · ${multiplier(result.crashBps)}`;
        document.getElementById('crash-result-detail').textContent = `Crash ${multiplier(result.crashBps)} · Stake ${formatCoins(result.stake)} · Net ${net >= 0 ? '+' : ''}${formatCoins(net)} coins`;
      } else {
        card.classList.toggle('won', result.won); card.classList.toggle('lost', !result.won);
        document.getElementById('crash-result-title').textContent = result.won ? `${multiplier(result.targetBps)} TARGET REACHED` : `FLEW AWAY · ${multiplier(result.crashBps)}`;
        const net = result.coins - result.stake;
        document.getElementById('crash-result-detail').textContent = `Legacy auto ${multiplier(result.targetBps)} · Net ${net >= 0 ? '+' : ''}${formatCoins(net)} coins`;
      }
    }
    renderHistory() {
      const list = document.getElementById('crash-history-list'); const recent = document.getElementById('crash-recent-multipliers');
      if (!list || !recent) return;
      const rounds = this.crashState().recentRounds || []; list.textContent = ''; recent.textContent = '';
      document.getElementById('crash-history-empty').classList.toggle('hidden', rounds.length > 0);
      document.getElementById('flight-history-table').classList.toggle('hidden', rounds.length === 0);
      document.getElementById('crash-history-strip').classList.toggle('hidden', rounds.length === 0);
      for (const round of rounds.slice(0, 10)) {
        const chip = make('span', `crash-recent-chip ${round.crashBps >= 1000 ? 'high' : round.crashBps >= 200 ? 'medium' : 'low'}`, multiplier(round.crashBps));
        chip.setAttribute('role', 'listitem'); recent.appendChild(chip);
      }
      for (const round of rounds.slice(0, 10)) {
        const net = round.coins - round.stake; const won = round.version === 2 ? net > 0 : round.won;
        const row = make('tr', `flight-history-row ${won ? 'won' : 'lost'}`);
        const flight = make('td'); const identity = make('div', 'flight-player-name');
        const icon = make('span', 'flight-player-avatar', won ? '✓' : '×'); icon.setAttribute('aria-hidden', 'true');
        const copy = make('div'); const title = make('strong', '', round.version === 2 ? `Flew away at ${multiplier(round.crashBps)}` : round.won ? `${multiplier(round.targetBps)} auto cashout` : `Crashed at ${multiplier(round.crashBps)}`);
        const details = round.version === 2 ? round.bets.map((bet) => `Bet ${bet.slot}: ${bet.status === 'cashed' ? `${multiplier(bet.cashoutBps)} ${bet.cashoutKind}` : 'no cashout'}`).join(' · ') : `Target ${multiplier(round.targetBps)} · Gross ${formatCoins(round.coins)} coins`;
        copy.append(title, make('small', '', details)); identity.append(icon, copy); flight.appendChild(identity);
        const stake = make('td', '', `${formatCoins(round.stake)} coins`);
        const outcome = make('td', `flight-player-result ${won ? 'won' : 'lost'}`, `${net >= 0 ? '+' : ''}${formatCoins(net)} coins`);
        outcome.appendChild(make('small', '', round.version === 2 ? `${round.bets.length} ${round.bets.length === 1 ? 'bet' : 'bets'}` : 'Legacy round'));
        row.append(flight, stake, outcome); list.appendChild(row);
      }
    }
    renderProbabilities() {
      const list = document.getElementById('crash-probability-list'); if (!list) return; list.textContent = '';
      Config.CRASH_TARGETS_BPS.forEach((target) => {
        const row = make('div', 'arcade-probability-row');
        row.append(make('strong', '', multiplier(target)), make('span', '', `${formatCoins(Config.aviatorPayout(this.settings(1).stake, target))} coins`), make('b', '', percent(Config.aviatorWinningOutcomes(target) / Config.CRASH_RANDOM_RANGE)));
        list.appendChild(row);
      });
      document.getElementById('crash-probability-base').textContent = `${formatCoins(this.settings(1).stake)} coins`;
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
