'use strict';

// Production presentation bound to the existing authoritative game controller.
window.setupGameDice = function setupGameDice(app) {
  const game = app.fitaDice;
  const config = window.FitiaDiceConfig;
  const view = document.getElementById('view-dice');
  const fmt = (value) => Number(value || 0).toLocaleString('en-US');
  const chance = (target) => `${((target - 1) / 6 * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
  const id = (name) => document.getElementById(name);
  // Opposite faces add up to seven, as on a physical die.
  const pipPositions = { 1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] };
  const face = (value, side) => `<div class="pd-face pd-face-${side}" data-face="${value}" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<span class="pd-pip${pipPositions[value].includes(i) ? ' on' : ''}"></span>`).join('')}</div>`;
  view.innerHTML = `
    <div class="pd-page">
      <div class="pd-header">
        <button type="button" class="pd-back" onclick="App.nav('hub')" aria-label="Back to Hub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7M8 12h11"/></svg></button>
        <img class="pd-logo" src="assets/games/dice.svg" alt="">
        <div class="pd-title"><span>FITIA GAMES</span><h2>FITIA <em>Dice</em></h2></div>
        <div class="pd-balance"><small>COIN BALANCE</small><strong><i>●</i> <span id="dice-coin-balance">0</span></strong></div>
      </div>
      <section id="dice-locked" class="dice-locked hidden"><strong>FARM activation required</strong><button id="dice-open-farm" type="button" class="farm-small-button">OPEN FARM</button></section>
      <div id="dice-game" class="pd-layout">
        <section class="pd-board" aria-label="Dice board">
          <div class="pd-section-head"><div><span class="pd-overline">THE ROLL</span><h3>One die, six outcomes</h3></div><div class="pd-head-actions"><button id="dice-settings-link" class="pd-settings-link" type="button">Settings</button><button id="dice-open-info" class="pd-info" type="button" aria-label="Rules and probabilities">?</button></div></div>
          <div class="pd-stage" id="pd-stage">
            <div class="pd-stage-top"><span><i></i> <b id="pd-stage-status">READY TO PLAY</b></span><span id="pd-winning-faces">3 / 6 WINNING FACES</span></div>
            <div class="pd-stage-center"><div class="pd-die-visual" id="pd-die-visual" role="img" aria-label="Six-sided die"><div id="pd-render" class="pd-render" aria-hidden="true"></div><div class="pd-die-wrap" aria-hidden="true"><div class="pd-die-tilt"><div class="pd-die" id="pd-die" aria-label="Six-sided die">${face(1,'front')}${face(6,'back')}${face(2,'right')}${face(5,'left')}${face(3,'top')}${face(4,'bottom')}</div></div></div></div><span id="pd-stage-label" class="pd-stage-label">Ready to roll</span></div>
            <div class="pd-target-line"><div><span>WIN WHEN THE DIE IS</span><strong id="pd-target-label">UNDER 4</strong></div><span id="pd-stage-chance">50% CHANCE</span></div>
            <div class="pd-outcomes" role="group" aria-label="Winning and losing faces">${[1,2,3,4,5,6].map((n) => `<span data-outcome="${n}"><b>${n}</b></span>`).join('')}</div>
            <div class="pd-legend"><span><i></i> Winner</span><span><i></i> No win</span></div>
          </div>
          <section id="dice-result" class="pd-result hidden" aria-live="polite"><div class="pd-result-copy"><span>ROUND RESULT</span><strong id="dice-result-title"></strong><small id="dice-result-detail"></small></div><div class="pd-result-net"><span>NET RESULT</span><strong id="dice-result-net"></strong></div></section>
        </section>
        <section class="pd-summary" aria-label="Roll summary" aria-live="polite">
          <div><span>CHANCE</span><strong id="dice-chance-value">50%</strong></div><div><span>GROSS MULTIPLIER</span><strong id="pd-multiplier">1,90×</strong></div><div><span>IF YOU WIN · GROSS</span><strong id="dice-payout-value">95 coins</strong></div>
        </section>
        <div class="pd-action"><button id="dice-roll-button" type="button" class="pd-roll"><span>ROLL · 50 COINS</span></button><p id="dice-status" class="pd-status hidden" role="alert"></p><div class="pd-recent" aria-label="Recent results"><span>RECENT ROUNDS</span><div id="pd-recent-list"><small>No rolls yet</small></div></div></div>
        <aside class="pd-settings" id="pd-settings">
          <div class="pd-section-head"><div><span class="pd-overline">GAME SETTINGS</span><h3>Settings</h3></div><span class="pd-tag">COINS</span></div>
          <div class="pd-control-head"><span>WIN BELOW</span><small>Six-sided die</small></div>
          <div class="pd-targets" role="group" aria-label="Winning target">${config.TARGETS.map((n) => `<button type="button" data-dice-target="${n}" aria-pressed="false" aria-label="Under ${n}, ${chance(n)} chance"><strong>&lt; ${n}</strong><span>${chance(n)}</span></button>`).join('')}</div>
          <div class="pd-control-head"><span>STAKE</span><small>FARM coins</small></div>
          <div class="pd-stakes" role="group" aria-label="Stake amount">${config.STAKES.map((n) => `<button type="button" data-dice-stake="${n}" aria-pressed="false">${n}</button>`).join('')}</div>
          <div class="pd-payout"><span>IF THE ROLL WINS</span><strong id="pd-gross">95 coins</strong><small>Gross, stake included</small><div><span>Net if you win</span><b id="dice-net-value">+45 coins</b></div></div>

          <button type="button" class="pd-board-link" id="dice-board-link">Back to roll</button>
          <div class="pd-rounds"><span>TOTAL ROLLS</span><strong id="dice-total-rolls">0</strong></div>
        </aside>
      </div>
      <section class="pd-history"><div class="pd-section-head"><div><span class="pd-overline">YOUR ACTIVITY</span><h3>Recent rolls</h3></div><span class="pd-tag">RECENT</span></div><p id="dice-history-empty" class="pd-history-empty">No rolls yet.</p><div id="dice-history-list" class="pd-history-list"></div></section>

    </div>`;
  const style = document.createElement('style');
  style.textContent = `
  .pd-page{max-width:860px;margin:0 auto;padding:4px 2px 28px;color:#f5f8fc;font-family:Inter,system-ui,sans-serif}
  .pd-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}.pd-back{display:grid;place-items:center;flex:none;width:40px;height:40px;border:1px solid #303b4e;border-radius:12px;background:#192334;color:#cbd9e7;cursor:pointer}.pd-back svg{width:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.pd-logo{width:46px;height:46px;flex:none}.pd-title{min-width:0}.pd-title>span,.pd-overline{color:#9a9ebc;font-size:9px;font-weight:800;letter-spacing:.13em}.pd-title i{display:inline-block;width:3px;height:3px;margin:0 4px 2px;border-radius:50%;background:#ad9cff}.pd-title h2{margin:3px 0 0;font-size:25px;line-height:1;letter-spacing:-.05em}.pd-title em{color:#c4c2dd;font-style:normal;font-weight:500}.pd-balance{margin-left:auto;padding:8px 11px;border:1px solid #303c4d;border-radius:12px;background:#182434;text-align:right;white-space:nowrap}.pd-balance small{display:block;color:#8fa3b5;font-size:8px;font-weight:800;letter-spacing:.1em}.pd-balance strong{display:block;margin-top:4px;font-size:14px;font-variant-numeric:tabular-nums}.pd-balance i{color:#f1c865;font-size:10px;font-style:normal}
  .pd-intro{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 14px}.pd-intro p{margin:0;color:#9aa6ba;font-size:12px}.pd-intro strong{color:#e1e4f3;font-weight:600}.pd-intro>span{display:flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid #514e70;border-radius:20px;color:#d1c7ef;font-size:9px;font-weight:700;white-space:nowrap}.pd-intro i,.pd-stage-top i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#ad9cff}
  .pd-layout.locked{opacity:.62}
  .pd-layout{display:grid;grid-template-columns:minmax(0,1fr) 270px;grid-template-areas:'board settings' 'summary settings' 'action settings';gap:12px;align-items:start}.pd-board{grid-area:board;min-width:0;padding:14px;border:1px solid #42445e;border-radius:18px;background:linear-gradient(150deg,#22283b,#171d2e);box-shadow:0 16px 36px #0003}.pd-section-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.pd-section-head h3{margin:4px 0 0;font-size:15px;letter-spacing:-.02em}.pd-head-actions{display:flex;align-items:center;gap:7px}.pd-settings-link,.pd-board-link{border:1px solid #605b80;border-radius:9px;background:#35334e;color:#ded3ff;font-size:10px;font-weight:700;cursor:pointer}.pd-settings-link{min-height:32px;padding:0 9px}.pd-board-link{width:100%;min-height:34px;margin-bottom:12px}.pd-info{width:32px;height:32px;border:1px solid #585873;border-radius:10px;background:#30334b;color:#d9d0ff;font-size:14px;font-weight:800;cursor:pointer}
  .pd-stage{position:relative;overflow:hidden;margin-top:12px;padding:14px;border:1px solid #4d4c70;border-radius:13px;background:radial-gradient(ellipse at 50% 12%,#44416a 0%,#24283f 48%,#141c2e 100%)}.pd-stage-top{display:flex;justify-content:space-between;gap:8px;color:#a7abc4;font-size:8px;font-weight:800;letter-spacing:.1em}.pd-stage-top span:first-child{color:#cfc4ff}.pd-stage-top i{width:5px;height:5px;box-shadow:0 0 8px #ae9cff;margin-right:4px}.pd-stage-center{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:190px;gap:15px}.pd-die-wrap{filter:drop-shadow(0 13px 13px #070c21a8)}.pd-die{position:relative;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);width:98px;height:98px;padding:15px;border:2px solid #fff;border-radius:22px;background:linear-gradient(145deg,#fff,#e3e1fb 54%,#b4b3e4);box-shadow:inset 0 -6px 0 #8d89c4, inset 0 2px 0 #fff;transform:rotate(-9deg)}.pd-die-question{position:absolute;inset:0;display:grid;place-items:center;color:#8a83bb;font-size:42px;font-weight:800}.pd-die.has-result .pd-die-question{display:none}.pd-pip{display:none;align-self:center;justify-self:center;width:13px;height:13px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#7470ac,#36335f);box-shadow:inset 0 1px 2px #211f4f88}.pd-pip.on{display:block}.pd-stage.rolling .pd-die{animation:pd-roll .48s ease-in-out infinite alternate}@keyframes pd-roll{from{transform:rotate(-16deg) scale(.96)}to{transform:rotate(16deg) scale(1.05)}}.pd-stage-label{color:#c1c5dc;font-size:11px;font-weight:600}.pd-target-line{display:flex;justify-content:space-between;align-items:end;gap:10px;padding-top:12px;border-top:1px solid #ffffff18}.pd-target-line div span{display:block;color:#979bb9;font-size:8px;font-weight:800;letter-spacing:.08em}.pd-target-line strong{display:block;margin-top:5px;color:#e6e1ff;font-size:12px}.pd-target-line>span{color:#d2c6ff;font-size:9px;font-weight:800;white-space:nowrap}.pd-outcomes{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:12px}.pd-outcomes span{display:grid;place-items:center;min-height:36px;border:1px solid #59566a;border-radius:9px;background:#353342;color:#ada9b9;font-size:12px}.pd-outcomes span.winning{border-color:#438876;background:#234e4b;color:#9ff6d7}.pd-outcomes span.drawn{outline:2px solid #f0de94;outline-offset:2px}.pd-legend{display:flex;justify-content:center;gap:15px;margin-top:11px;color:#a4a9bb;font-size:9px}.pd-legend i{display:inline-block;width:6px;height:6px;margin-right:4px;border-radius:50%;background:#67ddbc}.pd-legend span+span i{background:#aaa3b8}
  .pd-summary{grid-area:summary;display:grid;grid-template-columns:repeat(3,1fr);padding:12px 4px;border:1px solid #394259;border-radius:14px;background:#1b2738}.pd-summary>div{min-width:0;padding:0 10px}.pd-summary>div+div{border-left:1px solid #394259}.pd-summary span{display:block;color:#9aaac0;font-size:8px;font-weight:800;letter-spacing:.06em}.pd-summary strong{display:block;margin-top:7px;color:#f3f3ff;font:700 13px 'JetBrains Mono',monospace}.pd-action{grid-area:action}.pd-roll{width:100%;min-height:48px;border:0;border-radius:11px;background:linear-gradient(110deg,#8f71e9,#bd9df9);color:#20163a;font-size:12px;font-weight:900;letter-spacing:.05em;cursor:pointer;box-shadow:0 6px 20px #7044c733}.pd-roll:disabled{opacity:.55;cursor:not-allowed}.pd-status{margin:8px 0;color:#ffb9ba;font-size:11px}
  .pd-settings{grid-area:settings;min-width:0;padding:15px;border:1px solid #39435a;border-radius:18px;background:#1b2637}.pd-tag{padding:5px 7px;border:1px solid #514e70;border-radius:6px;color:#c5b9ea;background:#34344b;font-size:8px;font-weight:800;letter-spacing:.08em}.pd-control-head{display:flex;justify-content:space-between;align-items:center;gap:5px;margin:19px 0 9px}.pd-control-head span{color:#c7cede;font-size:9px;font-weight:800;letter-spacing:.06em}.pd-control-head small{color:#8e9db2;font-size:9px}.pd-targets{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}.pd-targets button,.pd-stakes button{min-width:0;border:1px solid #445168;border-radius:9px;background:#253247;color:#bac4d4;cursor:pointer}.pd-targets button{height:49px;padding:3px 0}.pd-targets strong,.pd-targets span{display:block}.pd-targets strong{font-size:12px}.pd-targets span{margin-top:4px;font-size:7px;white-space:nowrap}.pd-stakes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.pd-stakes button{min-height:42px;font-size:11px;font-weight:800}.pd-targets button.active,.pd-stakes button.active{border-color:#b4a0ff;background:#4a426c;color:#f0e9ff;box-shadow:inset 0 0 0 1px #9f87fb33}.pd-targets button:disabled,.pd-stakes button:disabled{opacity:.6;cursor:not-allowed}.pd-payout{margin-top:18px;padding:13px;border:1px solid #5b5180;border-radius:11px;background:linear-gradient(145deg,#373351,#292b44)}.pd-payout>span{display:block;color:#c5bce0;font-size:9px;font-weight:800;letter-spacing:.06em}.pd-payout>strong{display:block;margin-top:7px;color:#efe8ff;font-size:16px}.pd-payout>small{display:block;margin-top:3px;color:#b4aecb;font-size:9px}.pd-payout>div{display:flex;justify-content:space-between;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #ffffff1a;color:#b8b6cc;font-size:10px}.pd-payout b{color:#a4efd4}.pd-hint{margin:12px 0;color:#94a4b7;font-size:10px;line-height:1.55}.pd-rounds{display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid #374354;color:#95a9b8;font-size:9px;font-weight:800;letter-spacing:.08em}.pd-rounds strong{color:#e3edf2;font-size:11px}
  .pd-result{margin-top:12px;padding:12px;border:1px solid #446a60;border-radius:11px;background:#203c3c}.pd-result.lost{border-color:#845465;background:#402d3a}.pd-result span,.pd-result strong,.pd-result small{display:block}.pd-result span{color:#9dc9bc;font-size:8px;font-weight:800;letter-spacing:.08em}.pd-result strong{margin-top:5px;color:#ccfbea;font-size:13px}.pd-result.lost strong{color:#ffc1ce}.pd-result small{margin-top:5px;color:#bcc8d4;font-size:10px;line-height:1.4}
  .pd-history{margin-top:16px;padding:15px;border:1px solid #39435a;border-radius:16px;background:#1b2637}.pd-history-empty{margin:12px 0 0;padding:17px;border:1px dashed #45536a;border-radius:10px;color:#94a7b7;font-size:11px;text-align:center}.pd-history-list{display:grid;gap:7px;margin-top:12px}.pd-history-row{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #3a485e;border-radius:10px;background:#232f41}.pd-history-face{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:9px;background:#285044;color:#a5f3d2;font-size:14px;font-weight:900}.pd-history-row.lost .pd-history-face{background:#493540;color:#ffb5c3}.pd-history-copy{min-width:0;flex:1}.pd-history-copy strong,.pd-history-copy small{display:block}.pd-history-copy strong{font-size:11px;color:#edf0fb}.pd-history-copy small{margin-top:4px;color:#97a7ba;font-size:9px}.pd-history-net{font:700 11px 'JetBrains Mono',monospace;color:#a5f3d2;white-space:nowrap}.pd-history-row.lost .pd-history-net{color:#ffb5c3}.pd-disclaimer{margin:13px 0 0;color:#879aac;font-size:10px;line-height:1.5;text-align:center}.pd-page button:focus-visible{outline:2px solid #d4c5ff;outline-offset:2px}
  /* Subtle depth and clear, state-specific feedback without changing the roll. */
  .pd-stage{transition:border-color .25s ease,box-shadow .25s ease}.pd-stage[data-state="won"]{border-color:#57a990;box-shadow:inset 0 0 35px #38a37c14}.pd-stage[data-state="lost"]{border-color:#a96e83;box-shadow:inset 0 0 35px #c36b8012}.pd-stage[data-state="won"] .pd-stage-top span:first-child,.pd-stage[data-state="won"] .pd-stage-label{color:#b7f5df}.pd-stage[data-state="lost"] .pd-stage-top span:first-child,.pd-stage[data-state="lost"] .pd-stage-label{color:#ffd1dc}.pd-stage[data-state="won"] .pd-stage-top i{background:#6be2ba;box-shadow:0 0 10px #6be2ba}.pd-stage[data-state="lost"] .pd-stage-top i{background:#f2a0b2;box-shadow:0 0 10px #f2a0b2}
  .pd-stage-center{position:relative;isolation:isolate}.pd-stage-center::before{content:'';position:absolute;z-index:-1;top:50%;left:50%;width:190px;height:125px;transform:translate(-50%,-58%);border:1px solid #d2c8ff17;border-radius:50%;box-shadow:0 0 0 17px #a798ed08,0 0 0 35px #a798ed05;background:radial-gradient(ellipse,#ad9dff1f,transparent 68%);pointer-events:none}.pd-stage-label{padding:5px 10px;border:1px solid #c4baff1c;border-radius:20px;background:#111a2c66;letter-spacing:.01em}.pd-die{transition:box-shadow .25s ease}.pd-stage[data-state="won"] .pd-die{box-shadow:inset 0 -6px 0 #8d89c4,inset 0 2px 0 #fff,0 0 28px #74ecba4d;animation:pd-land .3s ease-out}.pd-stage[data-state="lost"] .pd-die{box-shadow:inset 0 -6px 0 #8d89c4,inset 0 2px 0 #fff,0 0 25px #f18ca43d;animation:pd-land .3s ease-out}@keyframes pd-land{from{transform:rotate(-4deg) scale(1.12)}to{transform:rotate(-9deg) scale(1)}}
  .pd-outcomes span{position:relative}.pd-outcomes span.drawn{outline:2px solid #f0de94;outline-offset:2px;box-shadow:0 0 12px #efce7550}.pd-outcomes span.drawn::after{content:'';position:absolute;top:-5px;width:5px;height:5px;border-radius:50%;background:#ffe39d}.pd-roll:not(:disabled):hover{filter:brightness(1.08);transform:translateY(-1px)}.pd-roll:not(:disabled):active{transform:translateY(1px)}.pd-roll,.pd-targets button,.pd-stakes button,.pd-settings-link,.pd-board-link,.pd-info{transition:background-color .18s ease,border-color .18s ease,transform .18s ease,filter .18s ease}.pd-targets button:not(:disabled):hover,.pd-stakes button:not(:disabled):hover{border-color:#b8aaff}
  .pd-result{display:flex;justify-content:space-between;align-items:center;gap:12px}.pd-result-copy{min-width:0}.pd-result-net{text-align:right;flex:none;padding-left:12px;border-left:1px solid #ffffff20}.pd-result-net strong{white-space:nowrap;font-size:14px}.pd-result.lost .pd-result-copy>span,.pd-result.lost .pd-result-net span{color:#e0b1bc}.pd-recent{display:flex;align-items:center;gap:10px;margin-top:11px;min-height:29px}.pd-recent>span{color:#98a2b9;font-size:8px;font-weight:800;letter-spacing:.08em;white-space:nowrap}.pd-recent>div{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.pd-recent small{color:#8b99af;font-size:9px}.pd-recent-chip{display:grid;place-items:center;width:27px;height:27px;border:1px solid #3a8171;border-radius:8px;background:#21483f;color:#a6f5d4;font-size:11px;font-weight:800}.pd-recent-chip.lost{border-color:#8e6272;background:#443340;color:#ffc0ce}
  /* Six distinct planes in perspective form a real CSS 3D cube. */
  .pd-stage-center{min-height:210px;gap:12px}.pd-die-visual{position:relative;display:grid;place-items:center;width:220px;height:150px}.pd-die-visual::before{content:'';position:absolute;bottom:8px;width:94px;height:12px;border-radius:50%;background:#03061788;filter:blur(8px);pointer-events:none}.pd-render{position:absolute;inset:0;display:none;pointer-events:none}.pd-render canvas{display:block;width:100%;height:100%}.pd-die-visual.webgl-ready .pd-render{display:block}.pd-die-visual.webgl-ready .pd-die-wrap{display:none}.pd-die-wrap{width:98px;height:98px;perspective:620px;perspective-origin:50% 48%;filter:drop-shadow(0 14px 12px #05091da8)}
  .pd-die-tilt{width:100%;height:100%;transform-style:preserve-3d;transform:rotateX(-20deg) rotateY(-25deg)}
  .pd-die,.pd-stage[data-state="won"] .pd-die,.pd-stage[data-state="lost"] .pd-die{--depth:49px;position:relative;display:block;width:100%;height:100%;padding:0;border:0;border-radius:0;background:none;box-shadow:none;transform-style:preserve-3d;transform:rotateX(var(--dice-rx, 0deg)) rotateY(var(--dice-ry, 0deg));animation:none}
  .pd-face{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:14px;border:2px solid #fff;border-radius:12px;backface-visibility:hidden;background:linear-gradient(145deg,#fff 0%,#ecebff 47%,#b6b3e0 100%);box-shadow:inset 0 0 0 2px #bdb8eb80,inset 0 -4px 8px #7773b45c}
  .pd-face-front{transform:translateZ(var(--depth))}.pd-face-back{transform:rotateY(180deg) translateZ(var(--depth))}.pd-face-right{transform:rotateY(90deg) translateZ(var(--depth));background:linear-gradient(140deg,#e1dfff,#a7a4d5)}.pd-face-left{transform:rotateY(-90deg) translateZ(var(--depth));background:linear-gradient(140deg,#e1dfff,#a7a4d5)}.pd-face-top{transform:rotateX(90deg) translateZ(var(--depth));background:linear-gradient(145deg,#fff,#e5e3ff)}.pd-face-bottom{transform:rotateX(-90deg) translateZ(var(--depth));background:linear-gradient(145deg,#d6d3f3,#a3a0cb)}
  .pd-face .pd-pip{display:block;visibility:hidden;align-self:center;justify-self:center;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 25%,#7773ac,#373360 70%);box-shadow:inset 0 1px 2px #211f4f99,0 1px 1px #fff8}.pd-face .pd-pip.on{visibility:visible}
  .pd-stage.rolling[data-state] .pd-die{animation:pd-cube-spin .55s linear infinite}.pd-stage.settling[data-state] .pd-die{animation:pd-cube-settle .65s cubic-bezier(.18,.72,.18,1) forwards}
  @keyframes pd-cube-spin{from{transform:rotateX(0deg) rotateY(0deg) rotateZ(0deg)}to{transform:rotateX(360deg) rotateY(360deg) rotateZ(180deg)}}
  @keyframes pd-cube-settle{from{transform:rotateX(360deg) rotateY(360deg) rotateZ(180deg)}to{transform:rotateX(var(--dice-rx, 0deg)) rotateY(var(--dice-ry, 0deg)) rotateZ(0deg)}}
  @media(max-width:620px){.pd-page{padding:0 0 24px}.pd-header{gap:7px}.pd-logo{width:38px;height:38px}.pd-title>span{font-size:8px}.pd-title h2{font-size:20px}.pd-balance{padding:7px 8px}.pd-intro p{font-size:11px}.pd-layout{grid-template-columns:1fr;grid-template-areas:'board' 'summary' 'action' 'settings';gap:9px}.pd-board{padding:11px;border-radius:15px}.pd-stage{padding:11px;margin-top:10px}.pd-stage-center{min-height:155px;gap:12px}.pd-die{width:82px;height:82px;padding:12px;border-radius:18px}.pd-pip{width:11px;height:11px}.pd-summary{padding:10px 3px}.pd-summary>div{padding:0 7px}.pd-summary span{font-size:7px}.pd-summary strong{font-size:11px}.pd-settings{padding:13px}.pd-control-head{margin-top:15px}}
  @media(max-width:620px){.pd-stage-center{min-height:175px;gap:9px}.pd-die-visual{width:190px;height:135px}.pd-die-wrap{width:82px;height:82px}.pd-die,.pd-stage[data-state="won"] .pd-die,.pd-stage[data-state="lost"] .pd-die{--depth:41px;width:100%;height:100%;padding:0;border-radius:0}.pd-face{padding:11px}.pd-face .pd-pip{width:10px;height:10px}}
  @media(prefers-reduced-motion:reduce){.pd-stage,.pd-die,.pd-roll,.pd-targets button,.pd-stakes button,.pd-settings-link,.pd-board-link,.pd-info{transition:none}.pd-stage.rolling[data-state] .pd-die,.pd-stage.settling[data-state] .pd-die,.pd-stage[data-state="won"] .pd-die,.pd-stage[data-state="lost"] .pd-die{animation:none}}
  `;
  document.head.appendChild(style);

  // Rotate the actual cube so the real result is on the front plane.
  const orientations = { 1:[0,0], 2:[0,-90], 3:[-90,0], 4:[90,0], 5:[0,90], 6:[0,180] };
  const orientDie = (value) => {
    const [x, y] = orientations[value]; const die = id('pd-die');
    die.style.setProperty('--dice-rx', `${x}deg`); die.style.setProperty('--dice-ry', `${y}deg`);
    die.dataset.face = String(value);
  };
  orientDie(1); // Decorative starting position; it is not a roll.
  let timer = null; let finishAnimation = null;
  const stopAnimation = () => {
    if (timer !== null) clearTimeout(timer); timer = null;
    id('pd-stage').classList.remove('rolling', 'settling');
    const done = finishAnimation; finishAnimation = null; if (done) done();
  };
  let realistic = null; let attempted3D = false;
  game.scene = {
    setActive(active) {
      if (active && !attempted3D) {
        attempted3D = true;
        realistic = window.createGameRealisticDie?.(id('pd-render')) || null;
        if (realistic) id('pd-die-visual').classList.add('webgl-ready');
      }
      if (realistic?.available) realistic.setActive(active);
    },
    resize() { if (realistic?.available) realistic.resize(); },
    reset() { stopAnimation(); orientDie(1); if (realistic?.available) realistic.reset(); },
    cancelAnimation() { if (realistic?.available) realistic.cancelAnimation(); stopAnimation(); },
    startWaiting() { id('pd-stage').classList.add('rolling'); if (realistic?.available) realistic.startWaiting(); },
    animateResult(value) {
      orientDie(value);
      id('pd-stage').classList.remove('rolling');
      id('pd-stage').classList.add('settling');
      if (realistic?.available) return realistic.animateResult(value).finally(stopAnimation);
      return new Promise((resolve) => { finishAnimation = resolve; const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; timer = setTimeout(stopAnimation, reduced ? 0 : 650); });
    }
  };
  // Replace English presentation, retaining the controller and its payout math.
  game.renderProbabilities = function() {
    const list = id('dice-probability-list'); list.textContent = '';
    for (const target of config.TARGETS) {
      const row = document.createElement('div'); row.className = 'dice-probability-row';
      for (const [tag, text] of [['strong', `UNDER ${target}`], ['span', `${fmt(config.payoutFor(this.selectedStake, target))} coins`], ['b', chance(target)]]) { const el = document.createElement(tag); el.textContent = text; row.appendChild(el); }
      list.appendChild(row);
    }
    id('dice-probability-base').textContent = `${fmt(this.selectedStake)} coins`;
  };
  const modal = id('modal-dice-info');
  id('dice-info-title').textContent = 'Rules and probabilities';
  id('dice-close-info').setAttribute('aria-label', 'Close');
  modal.querySelector('.dice-probability-base span').textContent = 'STAKE';
  ['WINNING TARGET', 'GROSS IF YOU WIN', 'CHANCE'].forEach((text, i) => { modal.querySelectorAll('.dice-probability-header span')[i].textContent = text; });
  modal.querySelector('.dice-rule-chips').innerHTML = '<span>RTP ≤ 95%</span><span>6 FACES</span><span>SERVER DRAW</span>';
  game.renderResult = function() {
    const result = this.currentResult; const card = id('dice-result'); card.classList.toggle('hidden', !result); if (!result) return;
    card.classList.toggle('won', result.won); card.classList.toggle('lost', !result.won);
    id('dice-result-title').textContent = `Roll ${result.roll} · ${result.won ? 'WIN' : 'NO WIN'}`;
    const net = result.coins - result.stake;
    id('dice-result-detail').textContent = `Target under ${result.target} · Stake ${fmt(result.stake)} · Gross ${fmt(result.coins)} coins`;
    id('dice-result-net').textContent = `${net >= 0 ? '+' : ''}${fmt(net)} coins`;
  };
  game.renderHistory = function() {
    const rolls = (this.diceState().recentRolls || []).filter((roll) => !this.operation || roll.id !== this.pending?.actionId); const list = id('dice-history-list'); list.textContent = '';
    id('dice-history-empty').classList.toggle('hidden', rolls.length > 0);
    const recent = id('pd-recent-list'); recent.textContent = '';
    if (!rolls.length) { const empty = document.createElement('small'); empty.textContent = 'No rolls yet'; recent.appendChild(empty); }
    for (const result of rolls.slice(0, 6)) {
      const chip = document.createElement('span'); chip.className = `pd-recent-chip ${result.won ? 'won' : 'lost'}`;
      chip.textContent = String(result.roll);
      const label = `Roll ${result.roll}, ${result.won ? 'win' : 'no win'}, target under ${result.target}`;
      chip.setAttribute('aria-label', label); chip.title = label; recent.appendChild(chip);
    }
    for (const result of rolls.slice(0, 8)) {
      const row = document.createElement('div'); row.className = `pd-history-row ${result.won ? 'won' : 'lost'}`;
      const face = document.createElement('span'); face.className = 'pd-history-face'; face.textContent = result.roll;
      const copy = document.createElement('div'); copy.className = 'pd-history-copy';
      const title = document.createElement('strong'); title.textContent = result.won ? 'Winning roll' : 'Losing roll';
      const meta = document.createElement('small'); meta.textContent = `Target under ${result.target} · Stake ${fmt(result.stake)} · Gross ${fmt(result.coins)}`;
      copy.append(title, meta); const net = result.coins - result.stake;
      const amount = document.createElement('span'); amount.className = 'pd-history-net'; amount.textContent = `Net ${net >= 0 ? '+' : ''}${fmt(net)}`;
      row.append(face, copy, amount); list.appendChild(row);
    }
  };
  game.celebrate = () => {};
  const originalRender = game.render.bind(game);
  game.render = function() {
    originalRender();
    const target = this.pending?.target || this.selectedTarget; const stake = this.pending?.stake || this.selectedStake;
    const payout = config.payoutFor(stake, target); const result = this.currentResult;
    id('dice-coin-balance').textContent = fmt(game.farm.state?.coins || 0);
    id('dice-total-rolls').textContent = fmt(this.diceState().totalRolls);
    id('dice-chance-value').textContent = chance(target);
    id('dice-payout-value').textContent = `${fmt(payout)} coins`;
    id('dice-net-value').textContent = `+${fmt(payout - stake)} coins`;
    id('pd-gross').textContent = `${fmt(payout)} coins`;
    id('pd-multiplier').textContent = `${(payout / stake).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}×`;
    id('pd-target-label').textContent = `UNDER ${target}`;
    id('pd-stage-chance').textContent = `${chance(target)} CHANCE`;
    id('pd-winning-faces').textContent = `${target - 1} / 6 ${target === 2 ? 'WINNING TARGET' : 'WINNING FACES'}`;
    id('pd-stage').dataset.state = this.operation ? 'rolling' : result ? (result.won ? 'won' : 'lost') : 'idle';
    id('pd-stage-status').textContent = this.operation ? 'ROLLING' : result ? (result.won ? 'WINNING ROLL' : 'LOSING ROLL') : 'READY TO PLAY';
    id('pd-stage-label').textContent = this.operation ? 'Rolling…' : result ? `Front face ${result.roll} · ${result.won ? 'win' : 'no win'}` : 'Ready to roll';
    const die = id('pd-die');
    const dieLabel = result && !this.operation ? `3D die showing ${result.roll}` : 'Six-sided die';
    die.setAttribute('aria-label', dieLabel);
    id('pd-die-visual').setAttribute('aria-label', dieLabel);
    view.querySelectorAll('[data-outcome]').forEach((item) => {
      const n = Number(item.dataset.outcome); item.classList.toggle('winning', n < target); item.classList.toggle('drawn', Boolean(result) && !this.operation && result.roll === n);
      item.setAttribute('aria-label', `Face ${n}: ${n < target ? 'winning' : 'losing'}${result && !this.operation && result.roll === n ? ', roll result' : ''}`);
    });
    id('dice-roll-button').querySelector('span').textContent = this.operation ? 'ROLLING…' : this.pending ? 'RESUME ROLL' : `ROLL · ${fmt(stake)} COINS`;
  };
  view.querySelectorAll('[data-dice-stake]').forEach((button) => button.addEventListener('click', () => game.setStake(Number(button.dataset.diceStake))));
  view.querySelectorAll('[data-dice-target]').forEach((button) => button.addEventListener('click', () => game.setTarget(Number(button.dataset.diceTarget))));
  id('dice-roll-button').addEventListener('click', () => game.roll());
  id('dice-open-info').addEventListener('click', () => game.openInfo());
  id('dice-open-farm').addEventListener('click', () => app.nav('farm'));
  const scrollTo = (element) => element.scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  id('dice-settings-link').addEventListener('click', () => scrollTo(id('pd-settings')));
  id('dice-board-link').addEventListener('click', () => scrollTo(view.querySelector('.pd-board')));
  game.render();
};
