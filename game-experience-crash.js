'use strict';

// Local presentation only. The authoritative controller supplies timestamps,
// bets and settled outcomes; this renderer never knows the active crash point.
window.createGameCrashPresentation = function createGameCrashPresentation(container, options = {}) {
  const empty = { available: false, setActive() {}, resize() {}, reset() {}, setRound() {}, startWaiting() {}, showResult() {}, animateResult() { return Promise.resolve(); }, cancelAnimation() {}, dispose() {} };
  if (!container) return empty;
  const Config = window.FitiaArcadeConfig;
  const stage = container.closest('.flight-stage');
  const plane = container.querySelector('.flight-plane');
  const line = container.querySelector('.flight-chart-line');
  const impact = container.querySelector('.flight-impact');
  const multiplierLabel = stage?.querySelector('#crash-multiplier');
  const clock = options.clock || (() => Date.now());
  const onTick = options.onTick || (() => {});
  let active = false; let frame = 0; let round = null; let result = null; let resultKey = null;
  const paint = (travel, bps) => {
    const progress = Math.max(0, Math.min(1, Number(travel) || 0));
    const x = 12 + 68 * progress; const y = 22 + 53 * progress;
    plane.style.left = `${x}%`; plane.style.bottom = `${y}%`;
    impact.style.left = `${x}%`; impact.style.bottom = `${y}%`;
    line.setAttribute('d', `M0 235 Q ${x * 5} 235 ${x * 10} ${235 - (y - 22) * 2.8}`);
    if (multiplierLabel) multiplierLabel.textContent = `${(Math.max(100, bps) / 100).toFixed(2)}×`;
  };
  const progressFor = (bps) => Math.max(0, Math.min(0.96, Math.log(Math.max(100, bps) / 100) / Math.log(100)));
  const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
  const reset = () => {
    stop(); round = null; result = null; resultKey = null;
    container.classList.remove('waiting', 'crashed', 'won', 'settled'); paint(0, 100);
  };
  const showResult = (value, settled = true) => {
    if (!value) { reset(); return; }
    const wasFlying = Boolean(round); stop(); round = null; result = value;
    const key = `${value.id || 'result'}:${value.crashBps || 100}`;
    if (key === resultKey) { if (settled) container.classList.add('settled'); return; }
    resultKey = key;
    const legacyWin = value.version !== 2 && value.won;
    container.classList.remove('waiting', 'crashed', 'won', 'settled');
    container.classList.toggle('won', Boolean(legacyWin));
    container.classList.toggle('crashed', !legacyWin);
    container.classList.toggle('settled', settled || !wasFlying);
    const bps = Number(value.crashBps || value.targetBps || 100);
    paint(progressFor(bps), bps);
  };
  const tick = () => {
    if (!active || !round) { frame = 0; return; }
    if (round.status === 'betting') {
      container.classList.add('waiting'); paint(0, 100); onTick(100, 'betting');
    } else {
      container.classList.remove('waiting');
      const elapsed = Math.max(0, clock() - Date.parse(round.startsAt));
      const bps = Config.crashMultiplierAt(elapsed);
      paint(progressFor(bps), bps); onTick(bps, 'flying');
    }
    frame = requestAnimationFrame(tick);
  };
  const start = () => { if (active && round && !frame) frame = requestAnimationFrame(tick); };
  const setRound = (value, completed = null) => {
    if (value?.status === 'crashed') {
      if (result?.id === value.id) return;
      const wasFlying = round?.id === value.id && round?.status === 'flying';
      showResult(value, !wasFlying); return;
    }
    if (value) {
      const changed = round?.id !== value.id || result;
      round = value; result = null; resultKey = null;
      container.classList.remove('crashed', 'won', 'settled');
      container.classList.toggle('waiting', value.status === 'betting');
      if (changed) paint(0, 100);
      start(); return;
    }
    if (completed) { showResult(completed, !round); return; }
    reset();
  };
  return {
    available: true,
    setActive(value) { active = Boolean(value); if (active) start(); else stop(); },
    resize() {}, reset, setRound,
    startWaiting() { container.classList.add('waiting'); paint(0, 100); },
    showResult,
    animateResult(value) { showResult(value, false); return Promise.resolve(); },
    cancelAnimation() { stop(); },
    dispose() { active = false; reset(); }
  };
};

// Production presentation bound to the existing signed Crash controller.
window.setupGameCrash = function setupGameCrash(app) {
  const game = app.fitaCrash;
  const view = document.getElementById('view-crash');
  if (!game || !view) return;
  const byId = (id) => document.getElementById(id);
  const fmt = (value) => Number(value || 0).toLocaleString('en-US');
  const compact = (bps) => `${(Number(bps || 100) / 100).toFixed(2)}×`;

  view.innerHTML = `
    <div class="preview-flight">
      <div class="flight-header">
        <button type="button" class="flight-back" onclick="App.nav('hub')" aria-label="Back to Hub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7M8 12h11"/></svg></button>
        <img class="flight-brand-mark" src="assets/games/crash.svg" alt="">
        <div class="flight-title"><span class="flight-eyebrow">FITIA GAMES</span><h2>FITIA <span>Crash</span></h2></div>
        <div class="flight-balance"><span>COIN BALANCE</span><strong><i></i> <b id="crash-coin-balance">0</b></strong></div>
      </div>
      <section id="crash-locked" class="arcade-locked hidden"><strong>FARM activation required</strong><button id="crash-open-farm" type="button" class="farm-small-button">OPEN FARM</button></section>
      <div id="crash-game" class="flight-game">
        <section class="flight-arena" aria-label="Crash flight">
          <div class="flight-arena-top"><span class="flight-section-label">FLIGHT HISTORY</span>
            <div id="crash-history-strip" class="flight-history hidden"><span class="flight-history-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 17 17 5M8 5h9v9"/></svg></span><div id="crash-recent-multipliers" class="flight-history-values"></div></div>
            <button id="crash-open-info" class="flight-info" type="button" aria-label="Rules and probabilities">?</button>
          </div>
          <div id="crash-stage" class="flight-stage" data-state="ready">
            <div id="crash-3d-container" class="flight-visual" role="img" aria-label="Airplane waiting for the next flight">
              <div class="flight-sun" aria-hidden="true"></div><div class="flight-stars" aria-hidden="true"></div>
              <svg class="flight-chart" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="flightGradient" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#a73e67"/><stop offset=".48" stop-color="#fa5279"/><stop offset="1" stop-color="#ffb08f"/></linearGradient></defs><g class="flight-chart-grid"><path d="M0 60H1000M0 120H1000M0 180H1000M0 240H1000"/></g><path class="flight-chart-line" d="M0 235 Q 60 235 120 235"/></svg>
              <span class="flight-plane" aria-hidden="true">
                <svg viewBox="0 0 220 120" fill="none">
                  <defs>
                    <linearGradient id="flight-plane-body" x1="45" y1="12" x2="128" y2="72" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset=".35" stop-color="#eef3f8"/><stop offset=".72" stop-color="#b5c3d2"/><stop offset="1" stop-color="#718398"/></linearGradient>
                    <linearGradient id="flight-wing" x1="55" y1="28" x2="120" y2="90" gradientUnits="userSpaceOnUse"><stop stop-color="#f9fbff"/><stop offset=".5" stop-color="#c8d4e0"/><stop offset="1" stop-color="#7c8da2"/></linearGradient>
                    <linearGradient id="flight-red" x1="30" y1="20" x2="140" y2="70" gradientUnits="userSpaceOnUse"><stop stop-color="#ff9aab"/><stop offset=".45" stop-color="#f05272"/><stop offset="1" stop-color="#a8264c"/></linearGradient>
                    <linearGradient id="flight-glass" x1="145" y1="22" x2="165" y2="42" gradientUnits="userSpaceOnUse"><stop stop-color="#d8f7ff"/><stop offset=".5" stop-color="#6b9fb8"/><stop offset="1" stop-color="#263c55"/></linearGradient>
                  </defs>
                  <ellipse cx="104" cy="92" rx="78" ry="8" fill="#f55d7d" opacity=".12"/>
                  <path d="M30 43 16 13c-1-3 1-5 4-4l8 2 25 31Z" fill="url(#flight-red)" stroke="#ff9fb0" stroke-width="1"/>
                  <path d="m45 38-17-1-13 12 43 5Z" fill="url(#flight-wing)" stroke="#9babc0" stroke-width="1"/>
                  <path d="M28 39c13-9 42-15 73-15 35 0 60 7 77 20 7 5 13 8 22 10 5 1 5 5 0 7-20 8-49 12-84 11-37-1-71-8-91-20-7-4-6-10 3-13Z" fill="url(#flight-plane-body)" stroke="#dbe5ef" stroke-width="1.2"/>
                  <path d="M29 40c18-8 44-12 74-12 32 0 55 6 72 17-30-8-74-5-111 3-17 4-30 3-35-1-3-3-3-5 0-7Z" fill="#fff" opacity=".68"/>
                  <path d="M25 52c20 9 52 15 87 16 34 1 61-2 83-9-17 11-47 16-80 15-39-1-74-9-90-20Z" fill="#728499" opacity=".42"/>
                  <path d="M20 44c20-4 40-5 65-5h66" fill="none" stroke="#e54063" stroke-width="1.5" opacity=".9"/>
                  <path d="M144 32c9 1 16 4 21 8h-11l-8-3Z" fill="url(#flight-glass)" stroke="#f5f7fa" stroke-width=".8"/>
                  <path d="m148 33.6 3 4.7m4-3.3 2.5 3.2" fill="none" stroke="#a6d3df" stroke-width=".8"/>
                  <g fill="#384e63"><circle cx="49" cy="38" r="2.1"/><circle cx="59" cy="37.6" r="2.1"/><circle cx="69" cy="37.3" r="2.1"/><circle cx="79" cy="37.2" r="2.1"/><circle cx="89" cy="37.2" r="2.1"/><circle cx="99" cy="37.2" r="2.1"/><circle cx="109" cy="37.2" r="2.1"/><circle cx="119" cy="37.2" r="2.1"/><circle cx="129" cy="37.4" r="2.1"/></g>
                  <path d="m73 51 25-3 24 27-8 2-35-15-17-3Z" fill="url(#flight-wing)" stroke="#8190a2" stroke-width="1.2" stroke-linejoin="round"/>
                  <path d="m109 62 13 13-8 2-11-5Z" fill="url(#flight-red)"/>
                  <path d="M76 51 99 50l14 14-25-9Z" fill="#f9fcff" opacity=".8"/>
                  <path d="M81 57c2-1 9-1 12 1l2 5c-1 3-4 4-9 4s-9-2-9-5c0-2 1-4 4-5Z" fill="#8897a8" stroke="#65768a" stroke-width="1"/>
                  <ellipse cx="83" cy="62" rx="3.2" ry="4" fill="#3c5063"/><ellipse cx="83" cy="62" rx="1.4" ry="2.3" fill="#aab9c8"/>
                  <path d="M23 18h5l9 13-4 1Z" fill="#ffbcc7" opacity=".55"/>
                  <path d="M138 52h15" stroke="#ffd5dd" stroke-width="1" stroke-linecap="round"/>
                </svg>
              </span>
              <div class="flight-flash" aria-hidden="true"></div>
              <div class="flight-impact" aria-hidden="true"><span class="impact-halo"></span><span class="impact-ring"></span><span class="impact-core"></span><span class="impact-smoke"></span><span class="impact-smoke impact-smoke-second"></span>${[[0,-62],[43,-45],[62,-5],[49,41],[0,56],[-49,36],[-62,-5],[-42,-46]].map(([x,y],i) => `<i class="impact-spark" style="--impact-x:${x}px;--impact-y:${y}px;--impact-rotation:${i * 45}deg"></i>`).join('')}${[[52,-35,145],[-54,-24,-90],[35,43,200],[-36,46,-160]].map(([x,y,turn]) => `<i class="impact-debris" style="--debris-x:${x}px;--debris-y:${y}px;--debris-turn:${turn}deg"></i>`).join('')}</div>
            </div>
            <span class="flight-stage-label"><i></i> SERVER FLIGHT</span>
            <div class="flight-center"><span class="flight-center-label">MULTIPLIER</span><strong id="crash-multiplier">1.00×</strong><span id="crash-multiplier-caption" aria-live="polite">READY FOR TAKEOFF</span></div>
            <div class="flight-stage-footer"><span>ROOM <b id="crash-stage-target-value">0 PLAYERS</b></span><span>YOUR CASHOUTS <b id="crash-stage-payout-value">0 coins</b></span></div>
          </div>
        </section>
        <section id="crash-result" class="flight-result hidden" aria-live="polite"><span>FLIGHT RESULT</span><strong id="crash-result-title"></strong><small id="crash-result-detail"></small></section>
        <div class="flight-controls-heading"><div><span class="flight-section-label">AVIATOR CONTROLS</span><h3>Place your bets</h3></div><button id="crash-add-bet" class="flight-add-bet" type="button"><span aria-hidden="true">+</span> ADD BET</button></div>
        <div class="flight-bets">${[1, 2].map((slot) => `
          <section id="crash-bet-panel-${slot}" class="flight-bet ${slot === 2 ? 'hidden' : ''}" data-crash-panel="${slot}">
            <div class="flight-bet-head"><div class="flight-bet-label"><span class="flight-bet-number">0${slot}</span><div><strong>BET ${slot}</strong><small>Independent cashout</small></div></div><span id="crash-bet-state-${slot}">READY</span></div>
            <div class="flight-stake-row"><span class="flight-field-label">STAKE AMOUNT</span><div class="flight-stake-input"><input id="crash-stake-input-${slot}" type="number" min="50" max="500" step="1" value="50" inputmode="numeric" aria-label="Bet ${slot} stake"><span>COINS</span></div></div>
            <div class="flight-quick" role="group" aria-label="Bet ${slot} stake">${[50,100,200,500].map((value) => `<button type="button" data-crash-slot="${slot}" data-crash-stake="${value}" aria-pressed="false">${value}</button>`).join('')}</div>
            <div class="flight-auto-grid">
              <label class="flight-check"><input id="crash-auto-bet-${slot}" type="checkbox"><span>AUTO BET</span></label>
              <label class="flight-check"><input id="crash-auto-cashout-${slot}" type="checkbox"><span>AUTO CASHOUT</span></label>
            </div>
            <div class="flight-target-editor"><span class="flight-field-label">CASHOUT MULTIPLIER</span><div><input id="crash-target-input-${slot}" type="number" min="1.01" max="100" step="0.01" value="${slot === 1 ? '2.00' : '3.00'}" inputmode="decimal" aria-label="Bet ${slot} auto cashout multiplier"><b>×</b></div></div>
            <button id="crash-bet-button-${slot}" class="flight-action" type="button"><span>BET · 50 COINS</span></button>
            ${slot === 2 ? '<button id="crash-remove-bet" class="flight-remove-bet" type="button">REMOVE SECOND BET</button>' : ''}
          </section>`).join('')}
        </div>
        <p id="crash-status" class="flight-status hidden" role="alert"></p>
        <section class="flight-players flight-live-panel" aria-labelledby="flight-live-title">
          <div class="flight-players-header"><div><span class="flight-section-label">MULTIPLAYER ROOM</span><h3 id="flight-live-title">Live players</h3></div><span class="flight-sim-badge">LIVE · SERVER</span></div>
          <div class="flight-players-stats"><div><span>PLAYERS</span><strong id="crash-live-player-count">0</strong></div><div><span>BETS</span><strong id="crash-live-bet-count">0</strong></div><div><span>TOTAL STAKED</span><strong id="crash-live-total-stake">0 coins</strong></div></div>
          <p id="crash-live-bets-empty" class="flight-history-empty">Connecting to the shared round…</p>
          <div id="crash-live-bets-table" class="flight-table-wrap hidden"><table class="flight-table"><thead><tr><th>PLAYER</th><th>STAKE</th><th>CASHOUT</th></tr></thead><tbody id="crash-live-bets-body"></tbody></table></div>
        </section>
        <section class="flight-players flight-history-panel" aria-labelledby="flight-history-title">
          <div class="flight-players-header"><div><span class="flight-section-label">YOUR ACTIVITY</span><h3 id="flight-history-title">Recent flights</h3></div><span class="flight-sim-badge">REAL HISTORY</span></div>
          <div class="flight-players-stats"><div><span>TOTAL FLIGHTS</span><strong id="crash-total-rounds">0</strong></div><div><span>BET PANELS</span><strong>UP TO 2</strong></div><div><span>FAIRNESS</span><strong>SHA-256</strong></div></div>
          <p id="crash-history-empty" class="flight-history-empty">No flights yet.</p>
          <div id="flight-history-table" class="flight-table-wrap hidden"><table class="flight-table"><thead><tr><th>FLIGHT</th><th>STAKE</th><th>NET RESULT</th></tr></thead><tbody id="crash-history-list"></tbody></table></div>
        </section>
      </div>
    </div>`;

  const style = document.createElement('style');
  style.textContent = `
    .preview-flight { --flight-pink:#f75a80; --flight-muted:#8790a7; color:#f6f7fb; max-width:850px; margin:0 auto; padding:4px 2px 28px; font-family:Inter,system-ui,sans-serif; }
    .flight-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
    .flight-back { width:40px; height:40px; flex:none; display:grid; place-items:center; border:1px solid #30384b; border-radius:12px; background:#1a2132; color:#cdd5e6; cursor:pointer; }
    .flight-back svg { width:20px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .flight-back:hover { background:#283146; color:#fff; }
    .flight-brand-mark { flex:none; width:47px; height:47px; object-fit:contain; filter:drop-shadow(0 5px 12px #f1537a25); }
    .flight-title { min-width:0; }.flight-title h2 { margin:3px 0 0; line-height:1; letter-spacing:-.05em; font-size:25px; font-weight:800; }.flight-title h2 span { margin-left:3px; color:#aeb7ca; font-weight:500; }
    .flight-eyebrow,.flight-section-label { font-size:9px; font-weight:800; color:#8792a7; letter-spacing:.14em; }
    .flight-balance { margin-left:auto; padding:8px 12px; background:#1a2234; border:1px solid #30384a; border-radius:12px; text-align:right; white-space:nowrap; }.flight-balance>span { display:block; color:#8995ab; font-size:8px; letter-spacing:.12em; font-weight:800; }.flight-balance strong { display:flex; align-items:center; justify-content:flex-end; gap:5px; margin-top:3px; font-size:14px; font-variant-numeric:tabular-nums; }.flight-balance strong i { width:7px; height:7px; border-radius:50%; background:#f5c65b; box-shadow:inset 0 0 0 2px #fff3; }.flight-balance strong b { font:inherit; }
    .flight-game.locked { opacity:.5; pointer-events:none; }
    .flight-arena { border:1px solid #31394b; border-radius:19px; padding:11px; background:linear-gradient(155deg,#20283a,#171e2c); box-shadow:0 16px 36px #00000024; }
    .flight-arena-top { display:flex; align-items:center; gap:10px; min-width:0; margin:0 2px 10px; }.flight-arena-top>.flight-section-label { white-space:nowrap; }
    .flight-history { display:flex; align-items:center; flex:1; min-width:0; gap:7px; color:#758197; }.flight-history-values { display:flex; flex:1; gap:5px; overflow-x:auto; scrollbar-width:none; white-space:nowrap; }.flight-history-values::-webkit-scrollbar { display:none; }
    .flight-history .crash-recent-chip { flex:none; padding:5px 8px; border:1px solid #6d4053; border-radius:7px; background:#402c3c; color:#f3a1b7; font:700 10px 'JetBrains Mono',monospace; }.flight-history .crash-recent-chip.medium { border-color:#31526b; background:#27364b; color:#98d7fa; }.flight-history .crash-recent-chip.high { border-color:#61456e; background:#42304c; color:#e1b2fd; }
    .flight-history-icon { display:grid; place-items:center; flex:none; color:#7e899e; }.flight-history-icon svg { width:15px; height:15px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
    .flight-info { display:grid; place-items:center; flex:none; width:30px; height:30px; border:1px solid #4a4050; border-radius:9px; background:#2c2737; color:#f3a5b8; font-size:13px; font-weight:800; cursor:pointer; }
    .flight-stage { height:300px; position:relative; overflow:hidden; border:1px solid #f0668929; border-radius:13px; background:radial-gradient(ellipse at 46% 113%,#511d37 0%,#1e1729 43%,#101622 78%); isolation:isolate; transition:border-color .2s,box-shadow .2s; }
    .flight-stage:before { content:''; position:absolute; inset:0; background-image:linear-gradient(#eb7e9a17 1px,transparent 1px),linear-gradient(90deg,#eb7e9a17 1px,transparent 1px); background-size:48px 48px; mask-image:linear-gradient(to top,#000,transparent 92%); }
    .flight-stage[data-state="won"] { border-color:#55c79b88; box-shadow:inset 0 0 60px #25bd7c12; }.flight-stage[data-state="lost"],.flight-stage[data-state="crashed"] { border-color:#ff647ea6; }
    .flight-visual { position:absolute; inset:0; overflow:hidden; pointer-events:none; }
    .flight-sun { position:absolute; left:-25%; bottom:-111%; width:150%; height:150%; opacity:.65; background:repeating-conic-gradient(from 0deg at 50% 100%,#eb366221 0deg 10deg,transparent 10deg 25deg); animation:flight-rays 24s ease-in-out infinite alternate; }
    @keyframes flight-rays { to { transform:rotate(10deg); } }
    .flight-stars { position:absolute; inset:0; opacity:.5; background-image:radial-gradient(#f6b8ca 1px,transparent 1.5px),radial-gradient(#fff 1px,transparent 1.5px); background-size:137px 101px,197px 137px; background-position:17px 23px,61px 37px; }
    .flight-stage-label { position:absolute; z-index:6; top:14px; left:15px; display:flex; align-items:center; gap:6px; color:#a699ad; font-size:8px; font-weight:800; letter-spacing:.13em; }.flight-stage-label i { width:6px; height:6px; flex:none; border-radius:50%; background:#f16c8d; box-shadow:0 0 8px #f16c8d66; }
    .flight-chart { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }.flight-chart-grid path { fill:none; stroke:#d5849b; stroke-width:.6; opacity:.12; vector-effect:non-scaling-stroke; }.flight-chart-line { fill:none; stroke:url(#flightGradient); stroke-width:3; stroke-linecap:round; vector-effect:non-scaling-stroke; filter:drop-shadow(0 0 7px #f44773); }
    .flight-plane { position:absolute; left:12%; bottom:22%; width:118px; height:64px; transform:translate(-40%,28%) rotate(-13deg); z-index:3; filter:drop-shadow(0 5px 12px #fa4a6b55); }.flight-plane svg { display:block; width:100%; height:100%; }
    .flight-visual.waiting .flight-plane { animation:flight-hover 1.2s ease-in-out infinite alternate; }@keyframes flight-hover { to { margin-bottom:7px; } }
    .flight-flash { position:absolute; inset:0; z-index:4; opacity:0; pointer-events:none; background:radial-gradient(circle at 50% 50%,#ffaa7b59,#ff365a3d 45%,transparent 82%); }
    .flight-impact { position:absolute; left:12%; bottom:22%; z-index:5; width:1px; height:1px; opacity:0; pointer-events:none; }
    .impact-halo,.impact-ring,.impact-core,.impact-smoke,.impact-spark,.impact-debris { position:absolute; left:0; top:0; display:block; opacity:0; }
    .impact-halo { width:112px; height:112px; margin:-56px; border-radius:50%; background:radial-gradient(circle,#fff6c8e6,#ff8d51a6 23%,#ff345b40 55%,transparent 73%); }.impact-ring { width:44px; height:44px; margin:-22px; border:3px solid #ffb394; border-radius:50%; box-shadow:0 0 16px #ff617e,inset 0 0 10px #ff7d8e; }.impact-core { width:34px; height:34px; margin:-17px; border-radius:50%; background:radial-gradient(circle,#fff7d7 0%,#ffc174 40%,#fc5966 80%,transparent 100%); box-shadow:0 0 26px #ff8a69; }.impact-smoke { width:80px; height:60px; margin:-30px -40px; border-radius:50%; background:radial-gradient(ellipse,#a97f918c,#5d475e47 45%,transparent 72%); filter:blur(4px); }.impact-spark { width:4px; height:12px; margin:-6px -2px; border-radius:5px; background:linear-gradient(#fff5cf,#ff955f); box-shadow:0 0 8px #ff8d72; }.impact-debris { width:13px; height:7px; margin:-3px -6px; background:linear-gradient(135deg,#ffe2d5 0%,#ef6678 55%,#793548 100%); clip-path:polygon(0 30%,70% 0,100% 60%,28% 100%); filter:drop-shadow(0 0 3px #fa7c72); }.impact-smoke-second { width:55px; height:45px; margin:-22px -27px; background:radial-gradient(ellipse,#bc9ca699,#644d5b42 50%,transparent 72%); }
    .flight-visual.crashed .flight-plane { animation:flight-crash-plane .72s cubic-bezier(.42,0,.86,.54) forwards; }.flight-visual.crashed .flight-flash { animation:flight-crash-flash .95s .32s ease-out both; }.flight-visual.crashed .flight-impact { opacity:1; }.flight-visual.crashed .impact-halo { animation:impact-halo 1.4s .32s ease-out both; }.flight-visual.crashed .impact-ring { animation:impact-ring 1.35s .32s ease-out both; }.flight-visual.crashed .impact-core { animation:impact-core 1s .32s ease-out both; }.flight-visual.crashed .impact-smoke { animation:impact-smoke 2.2s .38s ease-out both; }.flight-visual.crashed .impact-smoke-second { animation:impact-smoke-second 2.1s .55s ease-out both; }.flight-visual.crashed .impact-spark { animation:impact-spark 1.3s .32s cubic-bezier(.1,.7,.2,1) both; }.flight-visual.crashed .impact-debris { animation:impact-debris 1.5s .34s cubic-bezier(.15,.65,.4,1) both; }
    @keyframes flight-crash-plane { 0% { transform:translate(-40%,28%) rotate(-13deg); opacity:1; } 26% { transform:translate(-38%,19%) rotate(-4deg); opacity:1; } 75% { transform:translate(-23%,68%) rotate(38deg) scale(.92); opacity:1; } 100% { transform:translate(-20%,75%) rotate(52deg) scale(.82); opacity:0; } }
    @keyframes flight-crash-flash { 0% { opacity:0; } 20% { opacity:.62; } 100% { opacity:0; } }@keyframes impact-halo { 0% { opacity:0; transform:scale(.15); } 20% { opacity:1; } 100% { opacity:0; transform:scale(1.55); } }@keyframes impact-ring { 0% { opacity:0; transform:scale(.2); } 12% { opacity:.9; } 100% { opacity:0; transform:scale(3.2); } }@keyframes impact-core { 0% { opacity:0; transform:scale(.2); } 18% { opacity:1; transform:scale(1.2); } 100% { opacity:0; transform:scale(.45); } }@keyframes impact-smoke { 0% { opacity:0; transform:scale(.2); } 28% { opacity:.8; } 100% { opacity:0; transform:translate(-15px,-35px) scale(1.65); } }@keyframes impact-smoke-second { 0% { opacity:0; transform:scale(.2); } 25% { opacity:.8; } 100% { opacity:0; transform:translate(24px,-42px) scale(1.55); } }@keyframes impact-spark { 0% { opacity:0; transform:translate(0,0) rotate(var(--impact-rotation)) scale(.3); } 15% { opacity:1; } 100% { opacity:0; transform:translate(var(--impact-x),var(--impact-y)) rotate(var(--impact-rotation)) scale(.45); } }@keyframes impact-debris { 0% { opacity:0; transform:translate(0,0) rotate(0) scale(.4); } 15% { opacity:1; } 100% { opacity:0; transform:translate(var(--debris-x),var(--debris-y)) rotate(var(--debris-turn)) scale(.6); } }
    .flight-center { position:absolute; z-index:4; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column; pointer-events:none; text-shadow:0 4px 20px #090c17; }.flight-center strong { font:800 clamp(48px,8vw,72px)/1.1 'JetBrains Mono',monospace; letter-spacing:-.08em; font-variant-numeric:tabular-nums; }.flight-center-label { margin-bottom:5px; color:#9a8e9f; font-size:9px; font-weight:800; letter-spacing:.19em; }#crash-multiplier-caption { margin-top:8px; color:#e3c7d3; font-size:10px; font-weight:800; letter-spacing:.12em; text-align:center; text-transform:uppercase; }
    .flight-stage[data-state="lost"] .flight-center strong,.flight-stage[data-state="crashed"] .flight-center strong { color:#ff728d; text-shadow:0 0 25px #ff345a55,0 4px 20px #090c17; }.flight-stage[data-state="lost"] #crash-multiplier-caption,.flight-stage[data-state="crashed"] #crash-multiplier-caption { padding:5px 12px; border:1px solid #ff6e8988; border-radius:20px; background:#942c4355; color:#ffd7dd; }.flight-stage[data-state="won"] .flight-center strong { color:#9df0ca; }.flight-stage[data-state="won"] #crash-multiplier-caption { color:#b8f5da; }
    .flight-stage-footer { position:absolute; z-index:6; right:15px; left:15px; bottom:13px; display:flex; justify-content:space-between; gap:10px; color:#c6abb9; font-size:8px; font-weight:800; letter-spacing:.1em; text-shadow:0 1px 5px #0a0b14,0 0 8px #0a0b14; }.flight-stage-footer span:last-child { color:#df9eb0; text-align:right; }.flight-stage-footer b { font:inherit; color:#f3c4d1; }
    .flight-result { display:flex; flex-direction:column; align-items:center; margin-top:11px; padding:12px; border:1px solid #3f7c67; border-radius:12px; background:#203c36; text-align:center; }.flight-result>span { color:#9ed8c1; font-size:8px; font-weight:800; letter-spacing:.12em; }.flight-result strong { margin-top:5px; color:#b7f7db; font-size:14px; }.flight-result small { margin-top:5px; color:#b4c9c3; font-size:10px; line-height:1.45; }.flight-result.lost { border-color:#885262; background:#3c2938; }.flight-result.lost>span,.flight-result.lost strong { color:#ffc0cc; }.flight-result.lost small { color:#d1b5c0; }
    .flight-controls-heading { display:flex; justify-content:space-between; align-items:end; gap:10px; margin:22px 1px 10px; }.flight-controls-heading h3 { margin:5px 0 0; color:#f5f7fb; font-size:17px; letter-spacing:-.03em; }.flight-controls-heading>span { color:#8590a4; font-size:10px; white-space:nowrap; }
    .flight-bets { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }.flight-bet { min-width:0; background:linear-gradient(145deg,#20283a,#1a2130); border:1px solid #333c4e; border-radius:16px; padding:14px; box-shadow:0 8px 24px #0000001a; }
    .flight-bet-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:16px; }.flight-bet-label { display:flex; align-items:center; gap:8px; }.flight-bet-number { display:grid; place-items:center; flex:none; width:33px; height:33px; border:1px solid #59404f; border-radius:10px; background:#392c3a; color:#ff9bb0; font:700 11px 'JetBrains Mono',monospace; }.flight-bet-label strong,.flight-bet-label small { display:block; }.flight-bet-label strong { font-size:11px; letter-spacing:.06em; }.flight-bet-label small { margin-top:3px; color:#8995a8; font-size:9px; }.flight-bet-head>span { max-width:50%; color:#a6b2c3; text-align:right; font-size:10px; line-height:1.3; }.flight-target-bet .flight-bet-head>span { color:#ffadc0; font:700 13px 'JetBrains Mono',monospace; }
    .flight-field-label { display:block; margin-bottom:7px; color:#91a0b6; font-size:9px; font-weight:800; letter-spacing:.11em; }.flight-selected-value { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:43px; padding:9px 11px; border:1px solid #3b465a; border-radius:10px; background:#111927; }.flight-selected-value span { color:#8492a8; font-size:8px; font-weight:800; letter-spacing:.07em; }.flight-selected-value strong { color:#f4f7fc; font:700 14px 'JetBrains Mono',monospace; }
    .flight-quick { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; margin:8px 0 14px; }.flight-quick button { min-height:36px; min-width:0; background:#2b3547; border:1px solid transparent; border-radius:8px; color:#afbacb; font-size:10px; font-weight:700; cursor:pointer; }.flight-quick button:hover,.flight-quick button.active { background:#493244; border-color:#d66d8a; color:#ffd1dc; box-shadow:inset 0 0 0 1px #f75a8022; }.flight-quick button:disabled { opacity:.5; cursor:not-allowed; }.flight-targets { grid-template-columns:repeat(5,1fr); }
    .flight-action { width:100%; min-height:46px; border:0; border-radius:10px; background:linear-gradient(100deg,#159957,#22b66a); box-shadow:0 4px 15px #0ba85b22; color:#fff; font-size:11px; font-weight:800; letter-spacing:.04em; cursor:pointer; }.flight-action:hover:not(:disabled) { filter:brightness(1.12); }.flight-action:disabled { background:#313b4d; color:#8792a5; box-shadow:none; cursor:not-allowed; }.flight-action[data-state="pending"]:not(:disabled) { background:linear-gradient(100deg,#d88627,#f3b64e); color:#2b1b08; }.flight-status { margin:9px 0 0; color:#ffb0bb; font-size:11px; line-height:1.45; }
    .flight-quote { display:grid; grid-template-columns:repeat(3,1fr); margin-top:18px; padding:13px 0; border-top:1px solid #354052; border-bottom:1px solid #354052; }.flight-quote>div { min-width:0; padding:0 9px; border-right:1px solid #354052; }.flight-quote>div:first-child { padding-left:0; }.flight-quote>div:last-child { border:0; padding-right:0; }.flight-quote span { display:block; min-height:22px; color:#8796ab; font-size:8px; font-weight:800; letter-spacing:.06em; line-height:1.35; }.flight-quote strong { display:block; margin-top:6px; color:#f3f5fa; font:700 12px 'JetBrains Mono',monospace; white-space:nowrap; }.flight-quote>div:last-child strong { color:#8fe3bd; }
    .flight-players { margin-top:16px; padding:16px; background:linear-gradient(145deg,#20283a,#192130); border:1px solid #333c4e; border-radius:16px; box-shadow:0 8px 24px #0000001a; }.flight-players-header { display:flex; align-items:start; justify-content:space-between; gap:12px; }.flight-players-header h3 { margin:5px 0; font-size:17px; letter-spacing:-.03em; }.flight-sim-badge { border:1px solid #416557; padding:5px 8px; border-radius:20px; background:#263b38; color:#a5dfc7; font-size:9px; font-weight:800; letter-spacing:.09em; white-space:nowrap; }
    .flight-players-stats { display:grid; grid-template-columns:repeat(3,1fr); margin:15px 0 4px; padding:12px 0; border-top:1px solid #354052; border-bottom:1px solid #354052; }.flight-players-stats div { min-width:0; padding:0 12px; border-right:1px solid #354052; }.flight-players-stats div:first-child { padding-left:0; }.flight-players-stats div:last-child { border:0; }.flight-players-stats span { display:block; color:#8796ab; font-size:9px; font-weight:800; letter-spacing:.08em; }.flight-players-stats strong { display:block; margin-top:5px; color:#f3f5fa; font:700 14px 'JetBrains Mono',monospace; }.flight-players-stats small { color:#8d9aae; font:600 9px Inter,system-ui,sans-serif; }
    .flight-history-empty { margin:13px 0 0; padding:16px; border:1px dashed #414c60; border-radius:10px; color:#94a2b6; font-size:11px; text-align:center; }.flight-table-wrap { max-height:320px; overflow:auto; scrollbar-width:thin; scrollbar-color:#4a566b transparent; }.flight-table { width:100%; border-collapse:collapse; text-align:left; font-size:11px; font-variant-numeric:tabular-nums; }.flight-table th { position:sticky; top:0; z-index:1; padding:11px 3px 8px; background:#1d2535; color:#7e8da3; font-size:9px; font-weight:800; letter-spacing:.1em; }.flight-table td { padding:10px 3px; border-bottom:1px solid #313b4d; color:#d9e1ed; vertical-align:middle; }.flight-table tr:last-child td { border-bottom:0; }.flight-table th:nth-child(2),.flight-table td:nth-child(2) { text-align:right; }.flight-table th:last-child,.flight-table td:last-child { text-align:right; }
    .flight-live-panel .flight-table-wrap { max-height:280px; }.flight-live-row.mine { background:#263b382b; }.flight-live-row.mine .flight-player-avatar { width:34px; background:#285044; color:#a9edcf; font-size:7px; font-weight:900; }.flight-live-row.cashed .flight-player-avatar { background:#28463f; color:#8fe0bc; }
    .flight-player-name { display:flex; align-items:center; gap:8px; min-width:150px; }.flight-player-avatar { display:grid; place-items:center; flex:none; width:30px; height:30px; border-radius:10px; background:#473044; color:#ffa5bd; }.flight-player-avatar svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }.flight-history-row.won .flight-player-avatar { background:#28463f; color:#8fe0bc; }.flight-player-name>div { min-width:0; }.flight-player-name strong,.flight-player-name small { display:block; }.flight-player-name strong { color:#edf1f8; font-size:11px; }.flight-player-name small { margin-top:3px; color:#8a99ae; font-size:9px; }.flight-player-result { color:#9daec4; font-size:10px; font-weight:700; white-space:nowrap; }.flight-player-result.won { color:#78dbab; }.flight-player-result.lost { color:#f28b9c; }.flight-player-result small { display:block; margin-top:3px; color:#96a8bb; font-size:9px; font-weight:500; }
    .flight-visual.settled.crashed .flight-plane,.flight-visual.settled.crashed .flight-flash,.flight-visual.settled.crashed .impact-halo,.flight-visual.settled.crashed .impact-ring,.flight-visual.settled.crashed .impact-core,.flight-visual.settled.crashed .impact-smoke,.flight-visual.settled.crashed .impact-spark,.flight-visual.settled.crashed .impact-debris { animation:none; }
    .flight-visual.settled.crashed .flight-plane { opacity:0; }.flight-visual.settled.crashed .impact-halo { opacity:.35; transform:scale(1.1); }.flight-visual.settled.crashed .impact-ring { opacity:.55; transform:scale(1.4); }.flight-visual.settled.crashed .impact-smoke { opacity:.25; transform:translate(-8px,-20px) scale(1.2); }
    .flight-add-bet { min-height:36px; padding:0 12px; border:1px solid #486474; border-radius:9px; background:#243543; color:#b9d9e8; font-size:10px; font-weight:800; cursor:pointer; }.flight-add-bet span { margin-right:4px; color:#8fe0bc; font-size:16px; vertical-align:-1px; }
    .flight-stake-row { display:flex; align-items:end; justify-content:space-between; gap:10px; }.flight-stake-row>.flight-field-label { margin-bottom:12px; }.flight-stake-input { display:flex; align-items:center; width:155px; min-height:42px; padding:0 10px; border:1px solid #3b465a; border-radius:10px; background:#111927; }.flight-stake-input input { width:100%; min-width:0; border:0; outline:0; background:transparent; color:#f4f7fc; font:700 15px 'JetBrains Mono',monospace; text-align:right; }.flight-stake-input span { margin-left:6px; color:#8492a8; font-size:8px; font-weight:800; }.flight-stake-input input:disabled,.flight-target-editor input:disabled { opacity:.65; }
    .flight-auto-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin:2px 0 12px; }.flight-check { display:flex; align-items:center; justify-content:center; gap:7px; min-height:38px; padding:7px; border:1px solid #354052; border-radius:9px; background:#182130; color:#a7b5c8; font-size:9px; font-weight:800; cursor:pointer; }.flight-check input { width:16px; height:16px; margin:0; accent-color:#20b66c; cursor:pointer; }.flight-check:has(input:checked) { border-color:#2d7458; background:#1d342e; color:#a8e7cb; }.flight-check:has(input:disabled) { cursor:default; opacity:.68; }
    .flight-target-editor { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:13px; }.flight-target-editor>.flight-field-label { margin:0; }.flight-target-editor>div { display:flex; align-items:center; width:112px; min-height:39px; padding:0 10px; border:1px solid #3b465a; border-radius:9px; background:#111927; }.flight-target-editor input { width:100%; min-width:0; border:0; outline:0; background:transparent; color:#f4f7fc; font:700 13px 'JetBrains Mono',monospace; text-align:right; }.flight-target-editor b { margin-left:4px; color:#f3a5b8; font:700 13px 'JetBrains Mono',monospace; }
    .flight-action.cashout { background:linear-gradient(100deg,#d86b24,#f49a36); box-shadow:0 4px 18px #ef852c33; color:#fff; }.flight-action[data-state="cashed"] { background:#294b40; color:#a8e7cb; }.flight-bet.cashed { border-color:#396b59; }.flight-remove-bet { display:block; margin:10px auto 0; border:0; background:transparent; color:#8998ac; font-size:9px; font-weight:700; cursor:pointer; }.flight-remove-bet:hover { color:#ffc0cc; }
    .preview-flight button:focus-visible,.preview-flight input:focus-visible { outline:2px solid #f889a3; outline-offset:2px; }
    @media(max-width:620px) { .preview-flight { padding:0 0 24px; }.flight-header { gap:7px; }.flight-brand-mark { width:38px; height:38px; }.flight-title h2 { font-size:20px; }.flight-eyebrow { font-size:8px; }.flight-balance { padding:7px 8px; }.flight-arena { padding:8px; border-radius:15px; }.flight-stage { height:245px; }.flight-plane { width:100px; height:54px; }.flight-stage-label { font-size:7px; }.flight-center strong { font-size:50px; }.flight-arena-top { gap:7px; }.flight-arena-top>.flight-section-label { font-size:8px; }.flight-bets { grid-template-columns:1fr; gap:9px; }.flight-bet { padding:13px; }.flight-controls-heading { margin-top:18px; }.flight-quick button { min-height:40px; }.flight-quote { margin-top:12px; }.flight-players { padding:13px; }.flight-table { min-width:0; table-layout:fixed; }.flight-table th:first-child { width:52%; }.flight-table th:nth-child(2) { width:20%; }.flight-table th:last-child { width:28%; }.flight-player-name { min-width:0; gap:6px; }.flight-player-avatar { width:26px; height:26px; }.flight-player-name strong { font-size:10px; line-height:1.3; }.flight-player-name small { font-size:8px; line-height:1.35; overflow-wrap:anywhere; }.flight-table td:nth-child(2) { font-size:9px; white-space:nowrap; }.flight-player-result { font-size:9px; white-space:normal; }.flight-player-result small { font-size:8px; }.flight-history-panel .flight-table-wrap { overflow-x:hidden; } }
    @media(max-width:350px) { .flight-title h2 { font-size:18px; }.flight-balance>span { font-size:7px; }.flight-balance strong { font-size:12px; }.flight-stage { height:225px; }.flight-center strong { font-size:44px; }.flight-stage-footer { right:10px; left:10px; font-size:7px; }.flight-controls-heading>span { font-size:8px; }.flight-quote strong { font-size:11px; }.flight-players-stats strong { font-size:12px; } }
    @media(prefers-reduced-motion:reduce) { .flight-sun,.flight-visual.waiting .flight-plane,.flight-visual.crashed .flight-plane,.flight-visual.crashed .flight-flash,.flight-visual.crashed .impact-halo,.flight-visual.crashed .impact-ring,.flight-visual.crashed .impact-core,.flight-visual.crashed .impact-smoke,.flight-visual.crashed .impact-spark,.flight-visual.crashed .impact-debris { animation:none; }.flight-stage { transition:none; }.flight-visual.crashed .flight-plane { opacity:.15; }.flight-visual.crashed .impact-halo { opacity:.65; }.flight-visual.crashed .impact-ring { opacity:.75; transform:scale(1.5); } }
  `;
  document.head.appendChild(style);

  game.createScene = function createPresentationScene() {
    const scene = window.createGameCrashPresentation(byId('crash-3d-container'), {
      clock: () => game.serverNow(), onTick: (bps) => game.updateLive(bps)
    });
    scene.setRound(game.activeRound(), game.currentResult);
    return scene;
  };
  const originalEnter = game.enter.bind(game);
  game.enter = function enterPresentation() {
    originalEnter();
    this.scene?.setRound?.(this.activeRound(), this.currentResult);
  };

  view.querySelectorAll('[data-crash-stake]').forEach((button) => button.addEventListener('click', () => {
    game.setStake(Number(button.dataset.crashSlot || 1), Number(button.dataset.crashStake));
  }));
  for (let slot = 1; slot <= 2; slot += 1) {
    byId(`crash-bet-button-${slot}`).addEventListener('click', () => game.play(slot));
    byId(`crash-auto-bet-${slot}`).addEventListener('change', (event) => game.setAutoBet(slot, event.currentTarget.checked));
    byId(`crash-auto-cashout-${slot}`).addEventListener('change', (event) => game.setAutoCashout(slot, event.currentTarget.checked));
    const stakeInput = byId(`crash-stake-input-${slot}`);
    stakeInput.addEventListener('change', () => {
      const value = Number(stakeInput.value);
      if (!Number.isSafeInteger(value) || !window.FitiaArcadeConfig.normalizeAviatorStake(value)) game.showError({ code: 'CRASH_STAKE' });
      else game.setStake(slot, value);
      game.render();
    });
    stakeInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') stakeInput.blur(); });
    const targetInput = byId(`crash-target-input-${slot}`);
    targetInput.addEventListener('change', () => {
      const value = Math.round(Number(targetInput.value) * 100);
      if (!Number.isSafeInteger(value) || !window.FitiaArcadeConfig.normalizeAviatorTarget(value)) game.showError({ code: 'CRASH_TARGET' });
      else game.setTarget(slot, value);
      game.render();
    });
    targetInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') targetInput.blur(); });
  }
  byId('crash-add-bet').addEventListener('click', () => game.toggleSecondBet(true));
  byId('crash-remove-bet').addEventListener('click', () => game.toggleSecondBet(false));
  byId('crash-open-info').addEventListener('click', () => game.openInfo());
  byId('crash-open-farm').addEventListener('click', () => app.nav('farm'));
  byId('crash-info-title').textContent = 'Aviator rules and fairness';
  byId('crash-close-info').setAttribute('aria-label', 'Close');
  game.render();
};
