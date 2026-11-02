'use strict';

// Production presentation bound to the existing authoritative game controller.
window.setupGameMines = function setupGameMines(app) {
  const game = app.fitaMines;
  const config = window.FitiaArcadeConfig;
  const view = document.getElementById('view-mines');
  const fmt = (value) => Number(value || 0).toLocaleString('en-US');

  view.innerHTML = `
    <div class="game-mines">
      <div class="mine-header">
        <button type="button" class="mine-back" onclick="App.nav('hub')" aria-label="Back to Hub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7M8 12h11"/></svg></button>
        <span class="mine-brand" aria-hidden="true"><img src="assets/games/mines-gem.svg" alt=""></span>
        <div class="mine-title"><span>FITIA GAMES</span><h2>FITIA <em>Mines</em></h2></div>
        <div class="mine-balance"><small>COIN BALANCE</small><strong><i>●</i> <span id="mines-coin-balance">0</span></strong></div>
      </div>
      <section id="mines-locked" class="arcade-locked hidden"><strong>FARM activation required</strong><button id="mines-open-farm" type="button" class="farm-small-button">OPEN FARM</button></section>
      <div id="mines-game" class="game-mines-layout">
        <section class="mine-board-panel" aria-label="Mines game board">
          <div class="mine-panel-top"><div><span class="mine-overline">THE BOARD</span><h3>25 tiles</h3></div><div class="mine-panel-actions"><button id="mine-settings-link" type="button" class="mine-settings-link">Settings</button><button id="mines-open-info" type="button" class="mine-info" aria-label="Rules and probabilities">?</button></div></div>
          <div class="mine-board-frame"><div class="mine-board-glow"></div>
            <div class="mine-board-top"><span id="mine-board-state"><i></i> READY</span><span id="mine-board-counter">0 / 22 GEMS</span></div>
            <div id="mines-grid" class="game-mines-grid" role="group" aria-label="25-tile board">
              ${Array.from({ length: 25 }, (_, i) => `<button type="button" data-mines-index="${i}" aria-label="Tile ${i + 1}" aria-pressed="false"><span class="mine-tile-mark" aria-hidden="true"></span><img class="hidden" alt="" draggable="false"></button>`).join('')}
            </div>
            <p class="mine-board-caption"><strong id="mine-board-config">3 MINES · STAKE 50 COINS</strong><span id="mine-board-caption"></span></p>
          </div>
          <section id="mines-result" class="mine-result hidden" aria-live="polite"><span>ROUND RESULT</span><strong id="mines-result-title"></strong><small id="mines-result-detail"></small></section>
        </section>
        <section class="mine-stats" aria-label="Round statistics" aria-live="polite">
          <div><span>GEMS</span><strong><b id="mines-safe-count">0</b> <small>found</small></strong></div>
          <div><span>MULTIPLIER</span><strong id="mine-multiplier">—</strong></div>
          <div><span>NEXT GEM</span><strong id="mines-next-chance">88%</strong></div>
        </section>
        <div class="mine-action-area">
          <button id="mines-start-button" type="button" class="mine-action"><span>START · 50 COINS</span></button>
          <button id="mines-cashout-button" type="button" class="mine-action mine-cashout hidden"><span>CASH OUT · 0 COINS</span></button>
          <button id="mines-resume-button" type="button" class="mine-action hidden">RESUME ROUND</button>
          <p id="mines-status" class="mine-status hidden" role="alert"></p>
        </div>
        <aside id="mine-settings" class="mine-settings">
          <div class="mine-settings-heading"><div><span class="mine-overline">GAME SETTINGS</span><h3>Settings</h3></div><span class="mine-tag">COINS</span></div>
          <div class="mine-control-heading"><span>NUMBER OF MINES</span><small>25 tiles</small></div>
          <div class="mine-choices" role="group" aria-label="Number of mines">${[1, 3, 5, 10].map((n) => `<button type="button" data-mines-count="${n}" aria-pressed="false"><img src="assets/games/mines-bomb.svg" alt=""><span>${n}</span></button>`).join('')}</div>
          <div class="mine-control-heading"><span>STAKE</span><small>FARM coins</small></div>
          <div class="mine-stakes" role="group" aria-label="Stake amount">${[50, 100, 200, 500].map((n) => `<button type="button" data-mines-stake="${n}" aria-pressed="false">${n}</button>`).join('')}</div>
          <div class="mine-payout"><div><span>GROSS CASHOUT</span><strong id="mines-current-payout">0 coins</strong><small id="mine-net-payout">No gems revealed</small></div><div class="mine-payout-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10"/></svg></div></div>
          <div class="mine-next-game"><div><span>NEXT GEM</span><strong id="mine-next-probability">88%</strong><small>chance to reveal</small></div><div><span>IF REVEALED</span><strong id="mine-next-payout">53 coins</strong><small>gross cashout</small></div></div>

          <button type="button" id="mine-board-link" class="mine-board-link">Back to board</button>
          <div class="mine-rounds"><span>TOTAL ROUNDS</span><strong id="mines-total-rounds">0</strong></div>
        </aside>
      </div>
      <section class="mine-history"><div class="mine-history-heading"><div><span class="mine-overline">YOUR ACTIVITY</span><h3>Recent rounds</h3></div><span>RECENT</span></div><p id="mines-history-empty" class="mine-history-empty">No rounds yet.</p><div id="mines-history-list" class="mine-history-list"></div></section>

    </div>`;

  const style = document.createElement('style');
  style.textContent = `
    .game-mines { --mine-accent:#45d9bd; max-width:860px; margin:0 auto; padding:4px 2px 28px; color:#f5f8fc; font-family:Inter,system-ui,sans-serif; }
    .mine-header { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
    .mine-back { display:grid; place-items:center; flex:none; width:40px; height:40px; border:1px solid #303b4e; border-radius:12px; background:#192334; color:#cbd9e7; cursor:pointer; }.mine-back svg { width:20px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }.mine-back:hover { background:#253449; }
    .mine-brand { display:grid; place-items:center; flex:none; width:46px; height:46px; border:1px solid #418477; border-radius:14px; background:radial-gradient(circle at 30% 15%,#2e6960,#172f3c 78%); box-shadow:inset 0 1px #c5fff222,0 7px 18px #051d2333; }.mine-brand img { width:39px; height:39px; }
    .mine-title { min-width:0; }.mine-title>span,.mine-overline { color:#8497ab; font-size:9px; font-weight:800; letter-spacing:.13em; }.mine-title i { display:inline-block; width:3px; height:3px; margin:0 4px 2px; border-radius:50%; background:#49dfbd; }.mine-title h2 { margin:3px 0 0; font-size:25px; line-height:1; letter-spacing:-.05em; }.mine-title em { margin-left:3px; color:#b7c8d6; font-style:normal; font-weight:500; }
    .mine-balance { margin-left:auto; padding:8px 11px; border:1px solid #303c4d; border-radius:12px; background:#182434; text-align:right; white-space:nowrap; }.mine-balance small { display:block; color:#8fa3b5; font-size:8px; font-weight:800; letter-spacing:.1em; }.mine-balance strong { display:block; margin-top:4px; font-size:14px; font-variant-numeric:tabular-nums; }.mine-balance i { color:#f1c865; font-size:10px; font-style:normal; }
    .mine-intro { display:flex; justify-content:space-between; align-items:center; gap:10px; margin:0 0 14px; }.mine-intro p { margin:0; color:#91a4b6; font-size:12px; line-height:1.45; }.mine-intro p strong { color:#dce8ee; font-weight:600; }.mine-intro>span { display:flex; flex:none; align-items:center; gap:6px; padding:6px 9px; border:1px solid #37554f; border-radius:20px; color:#b1d8c8; font-size:9px; font-weight:700; }.mine-intro>span i,.mine-board-top i { width:6px; height:6px; border-radius:50%; background:#58e5bd; }
    .game-mines-layout.locked { opacity:.62; }
    .game-mines-layout { display:grid; grid-template-columns:minmax(0,1fr) 270px; grid-template-areas:'board settings' 'stats settings' 'action settings'; gap:12px; align-items:start; }
    .mine-board-panel { grid-area:board; min-width:0; padding:14px; border:1px solid #344657; border-radius:18px; background:linear-gradient(150deg,#1c2b3a,#151f2f); box-shadow:0 16px 36px #0003; }
    .mine-panel-top,.mine-settings-heading,.mine-history-heading { display:flex; justify-content:space-between; align-items:center; gap:10px; }.mine-panel-top h3,.mine-settings-heading h3,.mine-history-heading h3 { margin:4px 0 0; font-size:15px; letter-spacing:-.02em; }.mine-panel-actions { display:flex; align-items:center; gap:7px; }.mine-settings-link { min-height:32px; padding:0 9px; border:1px solid #3b615f; border-radius:9px; background:#223c42; color:#bcebdd; font-size:10px; font-weight:700; cursor:pointer; }.mine-settings-link span { margin-left:3px; color:#69e6c6; }.mine-settings-link:hover { background:#2a5050; }.mine-info { width:32px; height:32px; border:1px solid #3d5662; border-radius:10px; background:#213747; color:#9cebd8; font-size:14px; font-weight:800; cursor:pointer; }
    .mine-board-frame { position:relative; isolation:isolate; overflow:hidden; margin-top:12px; padding:14px 14px 11px; border:1px solid #315363; border-radius:13px; background:radial-gradient(ellipse at 50% 6%,#245052 0%,#172a3c 48%,#111b2b 100%); }
    .mine-board-glow { position:absolute; top:-70px; left:20%; width:60%; height:125px; border-radius:50%; background:#44deb333; filter:blur(50px); z-index:-1; pointer-events:none; }
    .mine-board-top { display:flex; justify-content:space-between; gap:8px; margin-bottom:10px; color:#8da5b6; font-size:8px; font-weight:800; letter-spacing:.12em; }.mine-board-top>span:first-child { display:flex; align-items:center; gap:6px; color:#9bdac6; }.mine-board-top i { width:5px; height:5px; box-shadow:0 0 8px #52e2b9; }.mine-board-frame[data-state="running"] .mine-board-top i { animation:mine-pulse 1.8s ease-in-out infinite; }.mine-board-frame[data-state="lost"] { border-color:#98566d; }.mine-board-frame[data-state="won"] { border-color:#5ab698; } @keyframes mine-pulse { 50% { opacity:.45; box-shadow:0 0 2px #52e2b9; } }
    .game-mines-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:7px; width:100%; max-width:375px; margin:auto; }
    .game-mines-grid button { position:relative; display:grid; place-items:center; min-width:0; aspect-ratio:1; padding:0; overflow:hidden; border:1px solid #3a6273; border-radius:10px; background:linear-gradient(145deg,#31566b,#1c394d 78%); box-shadow:inset 0 1px #ffffff16,0 3px 0 #0a1926,0 5px 10px #0003; cursor:pointer; transition:transform .15s,border-color .2s,box-shadow .2s; }
    .game-mines-grid button:disabled { cursor:default; }.game-mines-grid button:not(:disabled):hover { transform:translateY(-2px); border-color:#87ebd0; box-shadow:inset 0 1px #ffffff26,0 4px 0 #0a1926,0 0 16px #41e4c933; }.game-mines-grid button:not(:disabled):active { transform:translateY(2px); }
    .mine-tile-mark { width:9px; height:9px; border:1px solid #99e8d455; border-radius:3px; transform:rotate(45deg); box-shadow:0 0 8px #48e4ba18; }.game-mines-grid button.safe .mine-tile-mark,.game-mines-grid button.mine .mine-tile-mark { display:none; }
    .game-mines-grid button img { position:relative; width:72%; height:72%; object-fit:contain; filter:drop-shadow(0 4px 6px #001c28aa); animation:mine-reveal .28s cubic-bezier(.2,.8,.2,1); }.game-mines-grid button.safe { border-color:#75edd1; background:radial-gradient(circle at 45% 25%,#428c7c,#1c554f 65%,#173b43); box-shadow:inset 0 1px #d6fff140,0 0 16px #41e3b840,0 3px 0 #0c2930; }.game-mines-grid button.mine { border-color:#8f4f61; background:radial-gradient(circle at 40% 30%,#6b3e50,#382a3d 70%); }.game-mines-grid button.hit { border-color:#ff899b; background:radial-gradient(circle,#a34b62,#472537 75%); box-shadow:0 0 20px #ed576055,0 3px 0 #271622; animation:mine-hit .38s ease-out; }
    @keyframes mine-reveal { from { opacity:0; transform:scale(.35) rotate(-12deg); } to { opacity:1; transform:scale(1) rotate(0); } } @keyframes mine-hit { 0%,100% { transform:translateX(0); } 30% { transform:translateX(-3px); } 65% { transform:translateX(3px); } }
    .mine-board-caption { min-height:13px; margin:11px 0 0; color:#a2b8c8; font-size:10px; text-align:center; line-height:1.4; }.mine-board-caption strong { display:block; margin-bottom:3px; color:#b3dbd0; font-size:9px; letter-spacing:.06em; }.mine-board-caption span { display:block; }
    .mine-result { display:flex; flex-direction:column; align-items:center; margin-top:10px; padding:10px; border:1px solid #438c74; border-radius:10px; background:#244638; text-align:center; }.mine-result.lost { border-color:#885262; background:#3c2938; }.mine-result>span { color:#a4d5c2; font-size:8px; font-weight:800; letter-spacing:.11em; }.mine-result strong { margin-top:4px; color:#a3ffe2; font-size:14px; }.mine-result.lost strong { color:#ffb6c1; }.mine-result small { margin-top:3px; color:#b4c7ce; font-size:10px; }
    .mine-stats { grid-area:stats; display:grid; grid-template-columns:repeat(3,1fr); gap:0; border:1px solid #324152; border-radius:13px; background:#182433; padding:12px 4px; }.mine-stats>div { min-width:0; padding:0 9px; border-right:1px solid #344456; }.mine-stats>div:last-child { border:0; }.mine-stats span { display:block; color:#8ea2b6; font-size:8px; font-weight:800; letter-spacing:.08em; }.mine-stats strong { display:block; margin-top:6px; font:700 14px 'JetBrains Mono',monospace; white-space:nowrap; }.mine-stats strong small { color:#93a6b8; font:600 9px Inter,sans-serif; }.mine-stats strong b { font:inherit; }
    .mine-action-area { grid-area:action; }.mine-action { width:100%; min-height:48px; border:0; border-radius:11px; background:linear-gradient(100deg,#15a866,#35c881); color:white; box-shadow:0 5px 18px #16b67526; font-size:12px; font-weight:800; letter-spacing:.04em; cursor:pointer; }.mine-action:hover:not(:disabled) { filter:brightness(1.1); }.mine-action:disabled { background:#354758; color:#9eafbb; box-shadow:none; cursor:not-allowed; }.mine-action.mine-cashout:not(:disabled) { background:linear-gradient(100deg,#e79924,#ffcb67); color:#2c210d; box-shadow:0 5px 18px #eaa83f2b; }.mine-status { margin:8px 0 0; color:#ffb0bb; font-size:11px; }
    .mine-settings { grid-area:settings; padding:15px; border:1px solid #344455; border-radius:18px; background:linear-gradient(145deg,#1c2b3b,#182332); }.mine-tag,.mine-history-heading>span { padding:5px 8px; border:1px solid #3e6d62; border-radius:20px; background:#24443e; color:#a0e5cc; font-size:9px; font-weight:800; letter-spacing:.07em; }.mine-control-heading { display:flex; justify-content:space-between; gap:6px; margin:20px 0 8px; color:#b5c6d2; font-size:9px; font-weight:800; letter-spacing:.08em; }.mine-control-heading small { color:#8299ab; font-size:9px; font-weight:500; letter-spacing:0; }
    .mine-choices,.mine-stakes { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }.mine-choices button,.mine-stakes button { display:flex; justify-content:center; align-items:center; gap:4px; min-width:0; min-height:42px; border:1px solid #405769; border-radius:9px; background:#243749; color:#d5e3ee; font-size:12px; font-weight:800; cursor:pointer; }.mine-choices img { width:20px; height:20px; }.mine-choices button.active,.mine-stakes button.active { border-color:#6fe8ca; background:#285d56; color:#d4fff0; box-shadow:inset 0 0 0 1px #6fe8ca33; }.mine-choices button:disabled,.mine-stakes button:disabled { opacity:.6; cursor:not-allowed; }
    .mine-payout { display:flex; justify-content:space-between; align-items:center; margin-top:18px; padding:13px; border:1px solid #3b655b; border-radius:11px; background:#203c3b; }.mine-payout span { display:block; color:#96c5b6; font-size:9px; font-weight:800; letter-spacing:.09em; }.mine-payout strong { display:block; margin-top:6px; color:#b2ffe3; font-size:15px; }.mine-payout small { display:block; margin-top:5px; color:#a1c3b7; font-size:9px; }.mine-payout small.is-negative { color:#ffc5a6; }.mine-payout-icon { display:grid; place-items:center; width:32px; height:32px; border-radius:10px; background:#315b52; color:#a5f4d8; font-size:18px; }.mine-payout-icon svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; }.mine-next-game { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; padding:11px 0; border-bottom:1px solid #344456; }.mine-next-game>div { min-width:0; }.mine-next-game>div+div { border-left:1px solid #344456; padding-left:10px; }.mine-next-game span,.mine-next-game small { display:block; color:#8ca1b3; font-size:8px; line-height:1.4; }.mine-next-game span { font-weight:800; letter-spacing:.05em; }.mine-next-game strong { display:block; margin:4px 0; color:#e4f9f4; font:700 12px 'JetBrains Mono',monospace; }.mine-hint { margin:12px 0; color:#90a7b6; font-size:10px; line-height:1.55; }.mine-board-link { width:100%; min-height:34px; margin-bottom:12px; border:1px solid #395d5b; border-radius:9px; background:#203a3e; color:#ade7d6; font-size:10px; font-weight:800; cursor:pointer; }.mine-board-link:hover { background:#2a5050; }.mine-rounds { display:flex; justify-content:space-between; padding-top:10px; border-top:1px solid #344456; color:#95a9b8; font-size:9px; font-weight:800; letter-spacing:.08em; }.mine-rounds strong { color:#e3edf2; font-size:11px; }
    .mine-history { margin-top:16px; padding:15px; border:1px solid #334354; border-radius:16px; background:#192635; }.mine-history-heading { margin-bottom:12px; }.mine-history-heading>span { background:#283a47; border-color:#405866; color:#a2bfcb; }.mine-history-empty { margin:0; padding:17px; border:1px dashed #415466; border-radius:10px; color:#94a7b7; font-size:11px; text-align:center; }.mine-history-list { display:grid; gap:7px; }.mine-history-row { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px; border:1px solid #344657; border-radius:10px; background:#202e3e; }.mine-history-row>div { display:flex; align-items:center; gap:9px; min-width:0; }.mine-history-icon { display:grid; place-items:center; width:32px; height:32px; border-radius:9px; background:#284b45; color:#8cedc9; font-size:15px; }.mine-history-row.lost .mine-history-icon { background:#49323e; color:#ff9bad; }.mine-history-copy strong,.mine-history-copy small { display:block; }.mine-history-copy strong { color:#eaf4f8; font-size:11px; }.mine-history-copy small { margin-top:4px; color:#8ea5b6; font-size:9px; }.mine-history-amount { color:#9aebc9; font:700 11px 'JetBrains Mono',monospace; }.mine-history-row.lost .mine-history-amount { color:#ff9fad; }
    .mine-disclaimer { margin:13px 0 0; color:#879aac; font-size:10px; line-height:1.5; text-align:center; }.game-mines button:focus-visible { outline:2px solid #8df3d7; outline-offset:2px; }
    @media(max-width:620px) { .game-mines { padding:0 0 24px; }.mine-header { gap:7px; }.mine-brand { width:38px; height:38px; border-radius:11px; }.mine-brand img { width:33px; height:33px; }.mine-title>span { font-size:8px; }.mine-title h2 { font-size:20px; }.mine-balance { padding:7px 8px; }.mine-intro p { font-size:11px; }.game-mines-layout { grid-template-columns:1fr; grid-template-areas:'board' 'stats' 'action' 'settings'; gap:9px; }.mine-board-panel { padding:11px; border-radius:15px; }.mine-board-frame { padding:10px; margin-top:10px; }.game-mines-grid { gap:6px; max-width:265px; }.game-mines-grid button { border-radius:9px; }.mine-board-caption { margin-top:9px; }.mine-stats { padding:10px 3px; }.mine-stats>div { padding:0 7px; }.mine-stats span { font-size:7px; }.mine-stats strong { font-size:12px; }.mine-settings { padding:13px; }.mine-control-heading { margin-top:15px; } }
    @media(prefers-reduced-motion:reduce) { .game-mines-grid button,.game-mines-grid button img,.game-mines-grid button.hit,.mine-board-frame[data-state="running"] .mine-board-top i { animation:none; transition:none; } }
  `;
  document.head.appendChild(style);
  const byId = (id) => document.getElementById(id);

  // The 2D board mirrors the same signed server-authoritative Mines state.
  game.scene = {
    setActive() {}, resize() {}, setRound() {}, startWaiting() {}, cancelAnimation() {},
    animateReveal() { return Promise.resolve(); }, animateCashout() { return Promise.resolve(); }
  };
  const modal = byId('modal-mines-info');
  byId('mines-info-title').textContent = 'Rules and probabilities';
  modal.querySelector('.arcade-probability-base span').textContent = 'STAKE';
  ['MINES', 'GROSS FOR 1 GEM', 'FIRST GEM'].forEach((text, index) => { modal.querySelectorAll('.arcade-probability-header span')[index].textContent = text; });
  modal.querySelector('.arcade-rule-chips').innerHTML = '<span>RTP ≤ 95%</span><span>25 TILES</span><span>SERVER DRAW</span>';
  byId('mines-close-info').setAttribute('aria-label', 'Close');
  game.renderProbabilities = function renderGameProbabilities() {
    const list = byId('mines-probability-list'); list.textContent = '';
    for (const count of config.MINES_COUNTS) {
      const row = document.createElement('div'); row.className = 'arcade-probability-row';
      const label = document.createElement('strong'); label.textContent = `${count} ${count === 1 ? 'MINE' : 'MINES'}`;
      const payout = document.createElement('span'); payout.textContent = `${fmt(config.minesPayout(this.selectedStake, count, 1))} coins`;
      const chance = document.createElement('b'); chance.textContent = `${(config.minesNextChance(count, 0) * 100).toFixed(0)}%`;
      row.append(label, payout, chance); list.append(row);
    }
    byId('mines-probability-base').textContent = `${fmt(this.selectedStake)} coins`;
  };
  game.renderResult = function renderGameResult() {
    const card = byId('mines-result');
    const result = this.currentResult;
    const round = this.completedRound(result);
    card.classList.toggle('hidden', !result || !round);
    if (!result || !round) return;
    const won = result.status === 'cashed';
    card.classList.toggle('won', won); card.classList.toggle('lost', !won);
    byId('mines-result-title').textContent = won ? `CASHED OUT · ${fmt(round.coins)} COINS` : 'MINE HIT';
    const net = round.coins - round.stake;
    byId('mines-result-detail').textContent = `${round.revealed.length} gem(s) · ${round.mineCount} mine(s) · Net result ${net >= 0 ? '+' : ''}${fmt(net)} coins`;
    card.classList.toggle('lost', net < 0); card.classList.toggle('won', net >= 0);
  };
  game.renderHistory = function renderGameHistory() {
    const list = byId('mines-history-list');
    const rounds = this.minesState().recentRounds || [];
    list.textContent = '';
    byId('mines-history-empty').classList.toggle('hidden', rounds.length > 0);
    for (const round of rounds.slice(0, 8)) {
      const won = round.status === 'cashed';
      const net = round.coins - round.stake;
      const row = document.createElement('div'); row.className = `mine-history-row ${net >= 0 ? 'won' : 'lost'}`;
      const left = document.createElement('div');
      const icon = document.createElement('span'); icon.className = 'mine-history-icon'; icon.textContent = won ? '◆' : '×';
      const copy = document.createElement('div'); copy.className = 'mine-history-copy';
      const title = document.createElement('strong'); title.textContent = won ? 'Cashout' : 'MINE HIT';
      const meta = document.createElement('small'); meta.textContent = `${round.revealed.length} gem(s) · ${round.mineCount} mine(s) · stake ${fmt(round.stake)}${won ? ` · gross ${fmt(round.coins)}` : ''}`;
      copy.append(title, meta); left.append(icon, copy);
      const amount = document.createElement('span'); amount.className = 'mine-history-amount'; amount.textContent = `Net ${net >= 0 ? '+' : ''}${fmt(net)}`;
      row.append(left, amount); list.append(row);
    }
  };
  const originalRender = game.render.bind(game);
  game.render = function renderGameMines() {
    originalRender();
    byId('mines-coin-balance').textContent = fmt(game.farm.state?.coins || 0);
    const round = this.activeRound();
    const safeCount = round?.revealed.length || 0;
    const payout = round && safeCount ? config.minesPayout(round.stake, round.mineCount, safeCount) : 0;
    byId('mine-multiplier').textContent = round && safeCount ? `${(payout / round.stake).toFixed(2)}×` : '—';
    const stake = round?.stake || this.selectedStake;
    const mines = round?.mineCount || this.selectedMineCount;
    const availableGems = config.MINES_TILES - mines - safeCount;
    const chance = `${(config.minesNextChance(mines, safeCount) * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
    const nextPayout = availableGems > 0 ? `${fmt(config.minesPayout(stake, mines, safeCount + 1))} coins` : '—';
    byId('mines-next-chance').textContent = chance;
    byId('mine-next-probability').textContent = chance;
    byId('mine-next-payout').textContent = nextPayout;
    const net = payout - stake;
    const netPayout = byId('mine-net-payout');
    netPayout.textContent = round && safeCount ? `Net if cashed out: ${net >= 0 ? '+' : ''}${fmt(net)} coins` : 'No gems revealed';
    netPayout.classList.toggle('is-negative', Boolean(round && safeCount && net < 0));
    const displayRound = round || this.completedRound();
    byId('mine-board-counter').textContent = `${displayRound?.revealed.length || 0} / ${config.MINES_TILES - (displayRound?.mineCount || mines)} GEMS`;
    document.querySelector('.mine-board-frame').dataset.state = round ? 'running' : this.currentResult ? (this.currentResult.status === 'lost' ? 'lost' : 'won') : 'idle';
    const status = byId('mine-board-state');
    const statusText = round ? 'ROUND ACTIVE' : this.currentResult ? 'ROUND COMPLETE' : 'READY';
    if (status.lastChild?.textContent !== ` ${statusText}`) status.lastChild.textContent = ` ${statusText}`;
    byId('mine-board-config').textContent = `${mines} ${mines === 1 ? 'MINE' : 'MINES'} · STAKE ${fmt(stake)} COINS`;
    byId('mine-board-caption').textContent = '';
    byId('mines-start-button').querySelector('span').textContent = this.operation && this.pending?.type === 'mines_start' ? 'OPENING…' : `START · ${fmt(this.selectedStake)} COINS`;
    byId('mines-cashout-button').querySelector('span').textContent = this.operation && this.pending?.type === 'mines_cashout' ? 'CASHING OUT…' : `CASH OUT · ${fmt(payout)} COINS`;
    document.querySelectorAll('#view-mines [data-mines-index]').forEach((button) => {
      const n = Number(button.dataset.minesIndex) + 1;
      const safe = button.classList.contains('safe'); const mine = button.classList.contains('mine');
      button.setAttribute('aria-label', `Tile ${n}${safe ? ', gem' : mine ? ', mine' : ''}`);
      const image = button.querySelector('img');
      if (safe || mine) image.setAttribute('src', safe ? 'assets/games/mines-gem.svg' : 'assets/games/mines-bomb.svg');
    });
  };

  document.querySelectorAll('#view-mines [data-mines-stake]').forEach((button) => button.addEventListener('click', () => game.setStake(Number(button.dataset.minesStake))));
  document.querySelectorAll('#view-mines [data-mines-count]').forEach((button) => button.addEventListener('click', () => game.setMineCount(Number(button.dataset.minesCount))));
  document.querySelectorAll('#view-mines [data-mines-index]').forEach((button) => button.addEventListener('click', () => game.reveal(Number(button.dataset.minesIndex))));
  byId('mines-start-button').addEventListener('click', () => game.start());
  byId('mines-cashout-button').addEventListener('click', () => game.cashout());
  byId('mines-resume-button').addEventListener('click', () => game.resume());
  byId('mines-open-info').addEventListener('click', () => game.openInfo());
  byId('mines-open-farm').addEventListener('click', () => app.nav('farm'));
  const scrollTo = (element) => {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };
  byId('mine-settings-link').addEventListener('click', () => scrollTo(byId('mine-settings')));
  byId('mine-board-link').addEventListener('click', () => scrollTo(document.querySelector('.mine-board-panel')));
  game.render();
};
