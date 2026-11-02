'use strict';

// Production presentation bound to the existing authoritative game controller.
window.setupGameWheel = function setupGameWheel(app) {
  const game = app.luckyWheel, config = window.FitiaWheelConfig;
  const view = document.getElementById('view-wheel');
  const id = (name) => document.getElementById(name);
  const fmt = (value) => Number(value || 0).toLocaleString('en-US');
  const fmtFta = (value) => (Number(value || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const names = { coins_half:'½× coins', feed:'Feed', coins_triple:'3× coins', wheat:'Wheat', eggs:'Eggs', carrot:'Carrot', wool:'Wool', milk:'Milk', extra_spin:'Bonus spin', fta_small:'FTA', fta_big:'FTA +' };
  const short = { coins_half:'½×', feed:'FEED', coins_triple:'3×', wheat:'WHEAT', eggs:'EGGS', carrot:'CARROT', wool:'WOOL', milk:'MILK', extra_spin:'+1', fta_small:'FTA', fta_big:'FTA+' };
  const modes = { paid:'Coins', free:'Free', bonus:'Bonus' };
  const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':'); };
  view.innerHTML = `
    <div class="pw-page">
      <div class="pw-header"><button type="button" class="pw-back" onclick="App.nav('hub')" aria-label="Back to Hub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7M8 12h11"/></svg></button><img class="pw-logo" src="assets/games/wheel.svg" alt=""><div class="pw-title"><span>FITIA GAMES</span><h2>Lucky <em>Wheel</em></h2></div><div class="pw-balance"><small>COIN BALANCE</small><strong><i>●</i> <span id="wheel-coin-balance">0</span></strong></div></div>
      <section id="wheel-locked" class="wheel-locked hidden"><strong>FARM activation required</strong><button id="wheel-open-farm" type="button" class="farm-small-button">OPEN FARM</button></section>
      <div id="wheel-game" class="pw-layout">
        <section class="pw-board" aria-label="Reward wheel"><div class="pw-section-head"><div><span class="pw-overline">THE WHEEL</span><h3>11 possible rewards</h3></div><div class="pw-head-actions"><button type="button" id="wheel-settings-link" class="pw-settings-link">Settings ↓</button><button id="wheel-open-info" class="pw-info" type="button" aria-label="Rules and probabilities">?</button></div></div>
          <div class="pw-stage"><div class="pw-stage-top"><span><i></i> <b id="pw-stage-status">READY TO PLAY</b></span><span>11 SECTORS</span></div><div class="wheel-stage pw-wheel"><div class="pw-halo"></div><div class="wheel-pointer" aria-hidden="true"><i></i></div><canvas id="lucky-wheel-canvas" width="1" height="1" role="img" aria-label="Lucky Wheel"></canvas><div id="wheel-celebration" class="wheel-celebration" aria-hidden="true"></div></div><p class="pw-caption" id="pw-caption"></p></div>
          <section class="pw-summary" aria-label="Spin summary" aria-live="polite"><div><span>MODE</span><strong id="pw-mode">Coins</strong></div><div><span>REWARD BASE</span><strong id="pw-base">50 coins</strong></div><div><span>BONUS SPINS</span><strong id="wheel-bonus-count">0</strong></div></section>
          <div class="pw-action"><button id="wheel-spin-button" type="button" class="pw-spin"><span>SPIN · 50 COINS</span></button><p id="wheel-status" class="pw-status hidden" role="alert"></p><div class="pw-recent" aria-label="Recent results"><span>RECENT ROUNDS</span><div id="pw-recent-list"><small>No rounds yet</small></div></div></div>
          <section id="wheel-result" class="pw-result hidden" aria-live="polite"><div><span>ROUND RESULT</span><strong id="wheel-result-title"></strong><small id="wheel-result-detail"></small></div><div class="pw-result-net"><span>BALANCE CHANGE</span><strong id="pw-result-net"></strong></div></section>
          <section class="pw-prizes" aria-labelledby="pw-prizes-title">
            <div class="pw-prizes-head"><div><span class="pw-overline">POSSIBLE REWARDS</span><h4 id="pw-prizes-title">Possible rewards</h4></div><span id="pw-prizes-base">Base: 50 coins</span></div>

            <div id="pw-prizes-grid" class="pw-prizes-grid" aria-label="Possible rewards by sector"></div>
          </section>
        </section>
        <aside id="pw-settings" class="pw-settings"><div class="pw-section-head"><div><span class="pw-overline">GAME SETTINGS</span><h3>Settings</h3></div><span class="pw-tag">COINS</span></div>
          <div class="pw-control-head"><span>GAME MODE</span><small>Server draw</small></div><div class="pw-modes" role="tablist" aria-label="Spin mode"><button type="button" data-wheel-mode="paid" role="tab" aria-selected="false">Coins</button><button type="button" data-wheel-mode="free" role="tab" aria-selected="false">Free</button><button type="button" data-wheel-mode="bonus" role="tab" aria-selected="false">Bonus</button></div>
          <div class="pw-availability"><div><span>FREE SPIN · 24H</span><strong id="wheel-free-status">Available</strong></div><div><span>BONUS SPINS</span><strong id="pw-bonus-side">0</strong></div></div>
          <div class="pw-control-head"><span>COIN STAKE</span><small>Mode coins</small></div><div class="pw-stakes" role="group" aria-label="Stake amount">${config.STAKES.map((n) => `<button type="button" data-wheel-stake="${n}" aria-pressed="false">${n}</button>`).join('')}</div>
          <div class="pw-mode-note"><span id="pw-mode-title">SPIN WITH COINS</span><strong id="pw-mode-cost">Stake: 50 coins</strong><small id="pw-mode-detail">The stake is debited before the spin.</small></div>
          <button type="button" id="wheel-board-link" class="pw-board-link">Back to wheel ↑</button>
        </aside>
      </div>
      <section class="pw-history"><div class="pw-section-head"><div><span class="pw-overline">YOUR ACTIVITY</span><h3>Recent spins</h3></div><span class="pw-tag">RECENT</span></div><p id="wheel-history-empty" class="pw-history-empty">No spins yet.</p><div id="wheel-history-list" class="pw-history-list"></div></section>

    </div>`;
  const style = document.createElement('style');
  style.textContent = `
  .pw-page{max-width:860px;margin:0 auto;padding:4px 2px 28px;color:#f6f7fb;font-family:Inter,system-ui,sans-serif}.pw-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}.pw-back{display:grid;place-items:center;flex:none;width:40px;height:40px;border:1px solid #303b4e;border-radius:12px;background:#192334;color:#cbd9e7;cursor:pointer}.pw-back svg{width:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.pw-logo{width:46px;height:46px;flex:none}.pw-title{min-width:0}.pw-title>span,.pw-overline{color:#a9a1b4;font-size:9px;font-weight:800;letter-spacing:.13em}.pw-title i{display:inline-block;width:3px;height:3px;margin:0 4px 2px;border-radius:50%;background:#e6b969}.pw-title h2{margin:3px 0 0;font-size:25px;line-height:1;letter-spacing:-.05em}.pw-title em{color:#d5c8da;font-style:normal;font-weight:500}.pw-balance{margin-left:auto;padding:8px 11px;border:1px solid #303c4d;border-radius:12px;background:#182434;text-align:right;white-space:nowrap}.pw-balance small{display:block;color:#8fa3b5;font-size:8px;font-weight:800;letter-spacing:.1em}.pw-balance strong{display:block;margin-top:4px;font-size:14px;font-variant-numeric:tabular-nums}.pw-balance i{color:#f1c865;font-size:10px;font-style:normal}
  .pw-intro{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 14px}.pw-intro p{margin:0;color:#a8aab8;font-size:12px}.pw-intro strong{color:#f1e8df;font-weight:600}.pw-intro>span{display:flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid #65554c;border-radius:20px;color:#edcea7;font-size:9px;font-weight:700;white-space:nowrap}.pw-intro i,.pw-stage-top i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#edc77b}
  .pw-layout.locked .wheel-stage{opacity:.55;filter:saturate(.55)}
  .pw-layout{display:grid;grid-template-columns:minmax(0,1fr) 270px;grid-template-areas:'board settings';gap:12px;align-items:start}.pw-board{grid-area:board;min-width:0;padding:14px;border:1px solid #4f4757;border-radius:18px;background:linear-gradient(150deg,#292737,#191f2e);box-shadow:0 16px 36px #0003}.pw-section-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.pw-section-head h3{margin:4px 0 0;font-size:15px;letter-spacing:-.02em}.pw-head-actions{display:flex;align-items:center;gap:7px}.pw-settings-link,.pw-board-link{border:1px solid #705b65;border-radius:9px;background:#40353d;color:#f5dce0;font-size:10px;font-weight:700;cursor:pointer}.pw-settings-link{min-height:32px;padding:0 9px}.pw-board-link{width:100%;min-height:34px;margin-bottom:12px}.pw-info{width:32px;height:32px;border:1px solid #705b65;border-radius:10px;background:#40353d;color:#ffe2c4;font-size:14px;font-weight:800;cursor:pointer}
  .pw-stage{position:relative;overflow:hidden;margin-top:12px;padding:14px;border:1px solid #5f5060;border-radius:13px;background:radial-gradient(ellipse at 50% 12%,#514052 0%,#292638 48%,#171e2e 100%)}.pw-stage-top{display:flex;justify-content:space-between;gap:8px;color:#b4aab8;font-size:8px;font-weight:800;letter-spacing:.1em}.pw-stage-top span:first-child{color:#f3d3b0}.pw-stage-top i{width:5px;height:5px;box-shadow:0 0 8px #f2c46b;margin-right:4px}.pw-stage .pw-wheel{width:min(100%,310px);margin:7px auto 0}.pw-halo{position:absolute;inset:12%;border-radius:50%;background:#e4b46533;filter:blur(24px);pointer-events:none}.pw-wheel.canvas-unavailable .wheel-pointer{display:none}.pw-wheel .wheel-pointer{top:0;width:29px;height:42px}.pw-wheel .wheel-pointer i{top:7px;width:8px;height:8px}.pw-caption,.pw-caption-sub{margin:7px 0 0;color:#d2c5d2;font-size:10px;text-align:center;line-height:1.4}.pw-caption-sub{margin-top:3px;color:#9da5b4;font-size:9px}
  .pw-prizes{margin-top:14px;padding:12px;border:1px solid #574e60;border-radius:12px;background:#1b2231}.pw-prizes-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.pw-prizes-head h4{margin:4px 0 0;font-size:13px;letter-spacing:-.02em}.pw-prizes-head>span{flex:none;padding:5px 7px;border:1px solid #6d5961;border-radius:7px;color:#f0d8be;font-size:9px;font-weight:800}.pw-prizes-note{margin:9px 0;color:#aab3c1;font-size:9px;line-height:1.5}.pw-prizes-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.pw-prize{position:relative;min-width:0;min-height:57px;padding:8px 7px 7px 10px;overflow:hidden;border:1px solid #424858;border-radius:9px;background:#242b3a}.pw-prize::before{content:'';position:absolute;inset:0 auto 0 0;width:3px;background:var(--prize-color)}.pw-prize.is-result{border-color:#e3c285;box-shadow:inset 0 0 0 1px #e3c28555}.pw-prize-top{display:flex;align-items:start;justify-content:space-between;gap:3px}.pw-prize-name{min-width:0;color:#c9c8d4;font-size:9px;font-weight:700;line-height:1.2}.pw-prize-chance{flex:none;color:#aab4c1;font:700 8px 'JetBrains Mono',monospace}.pw-prize-value{display:block;margin-top:6px;color:#f9e5cb;font-size:11px;font-weight:800;line-height:1.2;overflow-wrap:anywhere}.pw-prize.is-result .pw-prize-value{color:#ffe8ad}
  .pw-summary{margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);padding:12px 4px;border:1px solid #394259;border-radius:14px;background:#1b2738}.pw-summary>div{min-width:0;padding:0 10px}.pw-summary>div+div{border-left:1px solid #394259}.pw-summary span{display:block;color:#9aaac0;font-size:8px;font-weight:800;letter-spacing:.06em}.pw-summary strong{display:block;margin-top:7px;color:#f3f3ff;font:700 13px 'JetBrains Mono',monospace}.pw-action{margin-top:12px}.pw-spin{width:100%;min-height:48px;border:0;border-radius:11px;background:linear-gradient(110deg,#dca453,#f2ca80);color:#30210a;font-size:12px;font-weight:900;letter-spacing:.05em;cursor:pointer;box-shadow:0 6px 20px #cc953733}.pw-spin:disabled{opacity:.55;cursor:not-allowed}.pw-spin:not(:disabled):hover{filter:brightness(1.08);transform:translateY(-1px)}.pw-status{margin:8px 0;color:#ffb9ba;font-size:11px}.pw-recent{display:flex;align-items:center;gap:10px;margin-top:11px;min-height:29px}.pw-recent>span{color:#98a2b9;font-size:8px;font-weight:800;letter-spacing:.08em;white-space:nowrap}.pw-recent>div{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.pw-recent small{color:#8b99af;font-size:9px}.pw-recent-chip{display:grid;place-items:center;min-width:28px;height:28px;padding:0 5px;border:1px solid #705b65;border-radius:8px;background:#493747;color:#f5e4d1;font-size:9px;font-weight:800}
  .pw-settings{grid-area:settings;min-width:0;padding:15px;border:1px solid #494354;border-radius:18px;background:#1d2636}.pw-tag{padding:5px 7px;border:1px solid #665b4c;border-radius:6px;color:#e9d1a5;background:#3b3936;font-size:8px;font-weight:800;letter-spacing:.08em}.pw-control-head{display:flex;justify-content:space-between;align-items:center;gap:5px;margin:19px 0 9px}.pw-control-head span{color:#c7cede;font-size:9px;font-weight:800;letter-spacing:.06em}.pw-control-head small{color:#8e9db2;font-size:9px}.pw-modes{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.pw-modes button,.pw-stakes button{min-width:0;min-height:42px;border:1px solid #445168;border-radius:9px;background:#253247;color:#bac4d4;font-size:10px;font-weight:800;cursor:pointer}.pw-modes button.active,.pw-stakes button.active{border-color:#e5bb82;background:#514039;color:#fff0d0;box-shadow:inset 0 0 0 1px #e5bd7a33}.pw-modes button:disabled,.pw-stakes button:disabled{opacity:.55;cursor:not-allowed}.pw-stakes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.pw-availability{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;padding:11px;border:1px solid #494657;border-radius:10px;background:#262c3b}.pw-availability>div+div{padding-left:8px;border-left:1px solid #4a4854}.pw-availability span{display:block;color:#a3a4b0;font-size:8px;font-weight:800;line-height:1.35}.pw-availability strong{display:block;margin-top:6px;color:#f1d5a4;font-size:11px}.pw-mode-note{margin-top:18px;padding:13px;border:1px solid #725c5b;border-radius:11px;background:linear-gradient(145deg,#44343c,#30303f)}.pw-mode-note span,.pw-mode-note strong,.pw-mode-note small{display:block}.pw-mode-note span{color:#d6b6ae;font-size:9px;font-weight:800;letter-spacing:.06em}.pw-mode-note strong{margin-top:7px;color:#ffdfc6;font-size:14px}.pw-mode-note small{margin-top:5px;color:#c7b8ba;font-size:9px;line-height:1.5}.pw-hint{margin:12px 0;color:#9ba7b6;font-size:10px;line-height:1.55}
  .pw-result{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding:12px;border:1px solid #795f50;border-radius:11px;background:#3d3335}.pw-result span,.pw-result strong,.pw-result small{display:block}.pw-result span{color:#d6b8a0;font-size:8px;font-weight:800;letter-spacing:.08em}.pw-result strong{margin-top:5px;color:#ffe9c5;font-size:13px}.pw-result small{margin-top:5px;color:#c9c4cc;font-size:10px;line-height:1.4}.pw-result-net{text-align:right;flex:none;padding-left:12px;border-left:1px solid #ffffff20}.pw-result-net strong{white-space:nowrap;font-size:13px}.pw-result-net strong.negative{color:#ffc0c6}.pw-history{margin-top:16px;padding:15px;border:1px solid #494354;border-radius:16px;background:#1b2637}.pw-history-empty{margin:12px 0 0;padding:17px;border:1px dashed #45536a;border-radius:10px;color:#94a7b7;font-size:11px;text-align:center}.pw-history-list{display:grid;gap:7px;margin-top:12px}.pw-history-row{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #3a485e;border-radius:10px;background:#232f41}.pw-history-mark{display:grid;place-items:center;flex:none;width:40px;height:34px;border-radius:9px;background:#49404c;color:#f5dcae;font-size:9px;font-weight:900}.pw-history-copy{min-width:0;flex:1}.pw-history-copy strong,.pw-history-copy small{display:block}.pw-history-copy strong{font-size:11px;color:#edf0fb}.pw-history-copy small{margin-top:4px;color:#97a7ba;font-size:9px;line-height:1.4}.pw-history-net{font:700 10px 'JetBrains Mono',monospace;color:#e9d4b2;white-space:nowrap}.pw-history-net.negative{color:#ffb5c3}.pw-disclaimer{margin:13px 0 0;color:#879aac;font-size:10px;line-height:1.5;text-align:center}.pw-page button:focus-visible{outline:2px solid #ffe1a5;outline-offset:2px}
  @media(max-width:620px){.pw-page{padding:0 0 24px}.pw-header{gap:7px}.pw-logo{width:38px;height:38px}.pw-title>span{font-size:8px}.pw-title h2{font-size:20px}.pw-balance{padding:7px 8px}.pw-intro p{font-size:11px}.pw-layout{grid-template-columns:1fr;grid-template-areas:'board' 'settings';gap:9px}.pw-board{padding:11px;border-radius:15px}.pw-stage{padding:11px;margin-top:10px}.pw-stage .pw-wheel{width:min(100%,255px)}.pw-summary{padding:10px 3px}.pw-summary>div{padding:0 7px}.pw-summary span{font-size:7px}.pw-summary strong{font-size:11px}.pw-settings{padding:13px}.pw-control-head{margin-top:15px}}
  @media(prefers-reduced-motion:reduce){.pw-spin,.pw-stage{transition:none}.pw-page .wheel-celebration i{animation:none}}
  `;
  document.head.appendChild(style);

  // The controller was initialized against the original DOM before the skin.
  // Reconnect it to the new canvas and retain its weighted landing algorithm.
  game.resizeObserver?.disconnect();
  game.canvas = id('lucky-wheel-canvas');
  try { game.context = game.canvas.getContext('2d'); } catch (_) { game.context = null; }
  if (!game.context) game.setCanvasFallback();
  if (window.ResizeObserver && game.context) { game.resizeObserver = new ResizeObserver(() => game.resize()); game.resizeObserver.observe(game.canvas); }
  // Read the unrotated layout width: getBoundingClientRect grows while a square
  // canvas is rotated and would otherwise shrink text after a subsequent resize.
  game.resize = function resizeGameWheel() {
    if (!this.canvas || !this.context) return;
    try {
      const width = this.canvas.clientWidth;
      if (!width && !this.active) return;
      const size = Math.max(220, Math.round(width || 255)), ratio = Math.min(2, window.devicePixelRatio || 1);
      const pixels = Math.round(size * ratio);
      if (this.canvas.width === pixels && this.canvas.height === pixels) { this.paintRotation(); return; }
      this.canvas.width = this.canvas.height = pixels;
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0); this.draw();
    } catch (_) { this.setCanvasFallback(); }
  };
  // If the player leaves during an animation, the controller cancels its frame.
  // Still align the pointer with the awarded segment before showing the result.
  const animateResult = game.animateResult.bind(game);
  game.animateResult = function animateGameResult(result) {
    const entry = this.layout.find((item) => item.segment.id === result.segmentId);
    return animateResult(result).then(() => {
      if (!entry) return;
      const tau = Math.PI * 2, desired = -Math.PI / 2 - (entry.start + entry.end) / 2;
      this.rotation = ((desired % tau) + tau) % tau;
      this.paintRotation();
    });
  };
  const prizeNodes = new Map();
  for (const segment of config.SEGMENTS) {
    const card = document.createElement('div'); card.className = 'pw-prize'; card.dataset.wheelReward = segment.id; card.style.setProperty('--prize-color', segment.color);
    const top = document.createElement('div'); top.className = 'pw-prize-top';
    const name = document.createElement('span'); name.className = 'pw-prize-name'; name.textContent = names[segment.id];
    const chance = document.createElement('span'); chance.className = 'pw-prize-chance'; chance.textContent = `${segment.weight}%`;
    const value = document.createElement('strong'); value.className = 'pw-prize-value';
    top.append(name, chance); card.append(top, value); id('pw-prizes-grid').appendChild(card); prizeNodes.set(segment.id, { card, value });
  }
  const prizeValue = (reward) => reward.kind === 'fta' ? `+${fmtFta(reward.ftaCoins)} FTA · ${fmt(reward.coins)} coins` : reward.kind === 'coins' ? `${fmt(reward.coins)} coins` : reward.kind === 'feed' ? `×${fmt(reward.feed)}` : reward.kind === 'product' ? `×${fmt(reward.quantity)}` : '+1 bonus spin';
  let lastDrawBase = null;
  game.draw = function drawGameWheel() {
    const ctx = this.context; if (!ctx || !this.canvas) return;
    const base = this.effectiveStake(); lastDrawBase = base;
    const ratio = Math.min(2, window.devicePixelRatio || 1), size = this.canvas.width / ratio, radius = size / 2 - 12, inner = radius - 13, tau = Math.PI * 2;
    ctx.clearRect(0,0,size,size); ctx.save(); ctx.translate(size/2,size/2);
    const rim = ctx.createRadialGradient(-radius*.25,-radius*.3,radius*.1,0,0,radius); rim.addColorStop(0,'#fff1ba');rim.addColorStop(.62,'#c98d48');rim.addColorStop(1,'#614025');
    ctx.beginPath();ctx.arc(0,0,radius,0,tau);ctx.fillStyle=rim;ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=15;ctx.fill();ctx.shadowBlur=0;
    this.layout.forEach(({segment,start,end}) => {
      ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,inner,start,end);ctx.closePath();ctx.fillStyle=segment.color;ctx.fill();ctx.strokeStyle='rgba(255,239,213,.55)';ctx.lineWidth=1.3;ctx.stroke();
      if (segment.weight < 5) return;
      const reward = config.rewardFor(segment, base);
      const value = reward.kind === 'coins' ? `${fmt(reward.coins)} c` : reward.kind === 'feed' ? `×${fmt(reward.feed)}` : reward.kind === 'product' ? `×${fmt(reward.quantity)}` : '';
      const lines = segment.weight >= 10 && value ? [short[segment.id], value] : [short[segment.id]];
      ctx.save();ctx.rotate((start+end)/2);ctx.translate(inner*.64,0);ctx.rotate(Math.PI/2);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff9ef';ctx.shadowColor='#161324';ctx.shadowBlur=3;ctx.font=`800 ${Math.max(8,size*.026)}px Inter, sans-serif`;lines.forEach((line,i)=>ctx.fillText(line,0,(i-(lines.length-1)/2)*size*.038));ctx.restore();
    });
    const shine=ctx.createRadialGradient(-inner*.38,-inner*.4,0,0,0,inner);shine.addColorStop(0,'rgba(255,255,255,.22)');shine.addColorStop(.48,'rgba(255,255,255,0)');shine.addColorStop(1,'rgba(0,0,0,.2)');ctx.beginPath();ctx.arc(0,0,inner,0,tau);ctx.fillStyle=shine;ctx.fill();
    for(let i=0;i<24;i++){const a=i*tau/24;ctx.beginPath();ctx.arc(Math.cos(a)*(radius-5),Math.sin(a)*(radius-5),Math.max(1.8,size*.007),0,tau);ctx.fillStyle=i%2?'#fff5cb':'#f3c074';ctx.fill();}
    const hub=ctx.createRadialGradient(-size*.035,-size*.04,1,0,0,size*.15);hub.addColorStop(0,'#fff0c4');hub.addColorStop(.55,'#e2b366');hub.addColorStop(1,'#80502d');ctx.beginPath();ctx.arc(0,0,size*.13,0,tau);ctx.fillStyle=hub;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#ffe8bb';ctx.stroke();ctx.fillStyle='#5e3a28';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${size*.035}px Inter, sans-serif`;ctx.fillText('FITIA',0,0);ctx.restore();this.paintRotation();
  };
  game.renderResult = function() {
    const result = this.currentResult, card = id('wheel-result');card.classList.toggle('hidden', !result);if(!result)return;
    id('wheel-result-title').textContent=this.rewardText(result, true);
    const net=Number(result.coins || 0)-Number(result.stake || 0);
    id('wheel-result-detail').textContent = result.stake
      ? `${modes[result.mode]} · Stake ${fmt(result.stake)} · Net ${net >= 0 ? '+' : ''}${fmt(net)} coins`
      : `${modes[result.mode]} · Credited`;
    const netEl=id('pw-result-net');netEl.textContent=`${net>=0?'+':''}${fmt(net)} coins`;netEl.classList.toggle('negative',net<0);
  };
  game.renderHistory = function() {
    const rounds=(this.wheelState().recentSpins||[]).filter((r)=>!this.operation||r.id!==this.pending?.actionId), list=id('wheel-history-list'), recent=id('pw-recent-list');list.textContent='';recent.textContent='';id('wheel-history-empty').classList.toggle('hidden',rounds.length>0);
    if(!rounds.length){const e=document.createElement('small');e.textContent='No rounds yet';recent.appendChild(e);}
    for(const r of rounds.slice(0,6)){const e=document.createElement('span');e.className='pw-recent-chip';e.textContent=short[r.segmentId];e.setAttribute('aria-label',`${names[r.segmentId]} : ${this.rewardText(r)}`);e.title=e.getAttribute('aria-label');recent.appendChild(e);}
    for(const r of rounds.slice(0,8)){const row=document.createElement('div');row.className='pw-history-row wheel-history-row';const mark=document.createElement('span');mark.className='pw-history-mark';mark.textContent=short[r.segmentId];const copy=document.createElement('div');copy.className='pw-history-copy';const title=document.createElement('strong');title.textContent=this.rewardText(r);const meta=document.createElement('small');meta.textContent=`${new Date(r.createdAt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })} · ${modes[r.mode]} · ${r.stake?`Stake ${fmt(r.stake)}`:'No stake'}`;copy.append(title,meta);const net=Number(r.coins||0)-Number(r.stake||0),amount=document.createElement('span');amount.className=`pw-history-net${net<0?' negative':''}`;amount.textContent=`Net ${net>=0?'+':''}${fmt(net)}`;row.append(mark,copy,amount);list.appendChild(row);}
  };
  const modal=id('modal-wheel-info');id('wheel-info-title').textContent='Rules and probabilities';id('wheel-close-info').setAttribute('aria-label','Close');modal.querySelector('.wheel-probability-base span').textContent='REWARD BASE';['REWARD','VALUE','CHANCE'].forEach((text,i)=>{modal.querySelectorAll('.wheel-probability-header span')[i].textContent=text;});modal.querySelector('.wheel-rule-chips').innerHTML='<span>FREE / 24H</span><span>SERVER RESULTS</span>';
  game.renderProbabilities = function() {
    const list=id('wheel-probability-list');list.textContent='';const base=this.effectiveStake();
    config.SEGMENTS.forEach((segment)=>{const row=document.createElement('div');row.className='wheel-probability-row';const name=document.createElement('span');name.className='wheel-probability-name';const dot=document.createElement('i');dot.style.background=segment.color;const title=document.createElement('strong');title.textContent=names[segment.id];name.append(dot,title);const val=document.createElement('span');val.textContent=this.rewardText(config.rewardFor(segment,base));const chance=document.createElement('b');chance.textContent=`${segment.weight}%`;row.append(name,val,chance);list.appendChild(row);});
    id('wheel-probability-base').textContent=`${fmt(base)} coins`;
  };
  const originalRender=game.render.bind(game);
  game.render=function() {
    originalRender();const mode=this.pending?.mode||this.mode,stake=this.pending?.stake||this.selectedStake,base=mode==='paid'?stake:mode==='free'?config.FREE_BASE_COINS:config.BONUS_BASE_COINS,remaining=this.freeRemaining(),bonus=this.wheelState().bonusSpins||0,result=this.currentResult;
    id('wheel-coin-balance').textContent=fmt(game.farm.state?.coins || 0);id('wheel-bonus-count').textContent=fmt(bonus);id('pw-bonus-side').textContent=fmt(bonus);id('pw-mode').textContent=modes[mode];id('pw-base').textContent=`${fmt(base)} coins`;
    id('pw-prizes-base').textContent=`Base: ${fmt(base)} coins`;
    for (const segment of config.SEGMENTS) {
      const reward = config.rewardFor(segment, base), node = prizeNodes.get(segment.id), value = prizeValue(reward);
      node.value.textContent = value; node.card.classList.toggle('is-result', Boolean(result) && result.segmentId === segment.id);
      node.card.setAttribute('aria-label', `${names[segment.id]} : ${value}, ${segment.weight}% chance${result?.segmentId === segment.id ? ', winning sector' : ''}`);
    }
    if (this.context && this.canvas.width > 1 && lastDrawBase !== base) this.draw();
    id('wheel-free-status').textContent=remaining>0?clock(remaining):'Available';id('pw-stage-status').textContent=this.operation?'WHEEL SPINNING':result?'SPIN COMPLETE':'READY TO PLAY';
    id('pw-caption').textContent=result?`Winning sector: ${names[result.segmentId]}.`:this.context?'':'Animation unavailable. See the displayed result.';this.canvas?.setAttribute('aria-label',result?`Wheel: ${names[result.segmentId]}`:'Lucky Wheel');
    id('pw-mode-title').textContent=mode==='paid'?'SPIN WITH COINS':mode==='free'?'FREE SPIN':'BONUS SPIN';id('pw-mode-cost').textContent=mode==='paid'?`Stake: ${fmt(stake)} coins`:mode==='free'?'No stake · 20-coin base':'No stake · 20-coin base';id('pw-mode-detail').textContent=mode==='paid'?'The stake is debited before the spin.':mode==='free'?(remaining>0?'Available after the countdown.':'One free spin every 24 hours.'):(bonus?`${fmt(bonus)} bonus spin(s) available.`:'No bonus spins available.');
    id('wheel-spin-button').querySelector('span').textContent=this.operation?'WHEEL SPINNING…':this.pending?'RESUME SPIN':mode==='paid'?`SPIN · ${fmt(stake)} COINS`:mode==='free'?'SPIN FOR FREE':'USE A BONUS';
  };
  game.tick=function() {const remaining=this.freeRemaining(),status=id('wheel-free-status');if(status){status.textContent=remaining>0?clock(remaining):'Available';status.classList.toggle('ready',remaining<=0);}if(!this.operation&&!this.pending&&this.mode==='free'){id('wheel-spin-button').disabled=remaining>0||!this.started();}};
  view.querySelectorAll('[data-wheel-mode]').forEach((button)=>button.addEventListener('click',()=>game.setMode(button.dataset.wheelMode)));
  view.querySelectorAll('[data-wheel-stake]').forEach((button)=>button.addEventListener('click',()=>game.setStake(Number(button.dataset.wheelStake))));
  id('wheel-spin-button').addEventListener('click',()=>game.spin());id('wheel-open-info').addEventListener('click',()=>game.openInfo());
  id('wheel-open-farm').addEventListener('click',()=>app.nav('farm'));
  const scrollTo=(el)=>el.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  id('wheel-settings-link').addEventListener('click',()=>scrollTo(id('pw-settings')));id('wheel-board-link').addEventListener('click',()=>scrollTo(view.querySelector('.pw-board')));
  game.resize();game.render();
};
