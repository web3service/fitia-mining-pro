'use strict';

// Production Hub presentation. Existing cards keep their real controllers and
// the administrator visibility settings.
window.setupGameHub = function setupGameHub() {
  const view = document.getElementById('view-hub');
  if (!view || view.querySelector('#game-hub-games')) return;
  const grid = view.querySelector('.hub-grid');
  const games = ['farm', 'wheel', 'dice', 'mines', 'crash', 'coin-flip'].map(name => grid?.querySelector(`.hub-card-${name}`));
  const swap = grid?.querySelector('.hub-card-swap');
  if (!grid || games.some(card => !card) || !swap) return;
  const iconAssets = {
    farm: 'assets/games/farm-hub.jpg', wheel: 'assets/games/wheel.svg',
    dice: 'assets/games/dice.svg', mines: 'assets/games/mines.svg',
    crash: 'assets/games/crash.svg', 'coin-flip': 'assets/games/coin-flip.svg'
  };
  for (const [name, source] of Object.entries(iconAssets)) {
    const icon = grid.querySelector(`.hub-card-${name} .hub-card-icon`);
    if (!icon) continue;
    icon.textContent = '';
    const image = document.createElement('img');
    image.src = source; image.alt = ''; image.draggable = false; image.decoding = 'async';
    if (name === 'farm') image.className = 'ph-farm-image';
    icon.appendChild(image);
  }

  const gamesSection = document.createElement('section');
  gamesSection.id = 'game-hub-games';
  gamesSection.className = 'ph-section ph-games';
  gamesSection.setAttribute('aria-labelledby', 'ph-games-title');
  gamesSection.hidden = true;
  gamesSection.innerHTML = `<div class="ph-game-header"><button id="ph-back-hub" class="ph-back" type="button" aria-label="Back to Hub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7M8 12h11"/></svg></button><div class="ph-heading"><div><span>FITIA GAMES</span><h3 id="ph-games-title">Games</h3><p>Choose your game.</p></div></div></div><div class="hub-grid ph-games-grid"></div>`;
  const gameGrid = gamesSection.querySelector('.hub-grid');
  games.forEach(card => gameGrid.appendChild(card));

  const serviceSection = document.createElement('section');
  serviceSection.className = 'ph-section ph-services';
  serviceSection.setAttribute('aria-labelledby', 'ph-services-title');
  serviceSection.innerHTML = `<div class="ph-heading"><div><span>EXPLORE</span><h3 id="ph-services-title">Services</h3><p>Additional tools.</p></div></div><div class="hub-grid ph-service-grid"></div>`;
  serviceSection.querySelector('.hub-grid').appendChild(swap);
  const landing = document.createElement('div');
  landing.id = 'game-hub-landing';
  landing.innerHTML = `<section class="ph-section ph-gateway" aria-labelledby="ph-gateway-title"><div class="ph-heading"><div><span>DISCOVER</span><h3 id="ph-gateway-title">FITIA universe</h3><p>Choose a category.</p></div></div><button id="ph-open-games" class="ph-gateway-card" type="button" aria-controls="game-hub-games" aria-expanded="false"><img src="assets/games/hub-games.jpg" alt="" draggable="false"><span class="ph-gateway-copy"><small>FITIA GAMES</small><strong>Games</strong><span>FARM and arcade games</span><b>Explore games <i aria-hidden="true">→</i></b></span></button></section>`;
  landing.appendChild(serviceSection);
  grid.replaceWith(landing, gamesSection);
  const open = landing.querySelector('#ph-open-games');
  const back = gamesSection.querySelector('#ph-back-hub');
  const setOpen = (isOpen, focus = true) => {
    landing.hidden = isOpen;
    gamesSection.hidden = !isOpen;
    open.setAttribute('aria-expanded', String(isOpen));
    const scroller = view.closest('main');
    if (scroller) scroller.scrollTop = 0;
    if (focus) (isOpen ? back : open).focus({ preventScroll: true });
  };
  open.addEventListener('click', () => setOpen(true));
  back.addEventListener('click', () => setOpen(false));
  // The Hub tab starts at its categories; a game's own back button preserves
  // the open game list, so returning from a game does not require another tap.
  document.querySelector('[data-nav="hub"]')?.addEventListener('click', () => setOpen(false, false));

  const style = document.createElement('style');
  style.textContent = `
    #view-hub.hub-view{max-width:520px;margin:0 auto}
    #view-hub .hub-header{margin-bottom:18px}
    .ph-section{margin:0 0 22px}
    #game-hub-landing[hidden],#game-hub-games[hidden]{display:none!important}
    .ph-gateway-card{display:flex;align-items:center;gap:20px;position:relative;width:100%;max-width:620px;padding:16px;text-align:left;border:1px solid #8d713b;border-radius:20px;background:radial-gradient(circle at 20% 20%,#6b4f292e,transparent 48%),linear-gradient(135deg,#252a3a,#111a29);color:#fff;cursor:pointer;box-shadow:0 12px 28px #0004;transition:border-color .2s,transform .2s}
    .ph-gateway-card:hover{border-color:#e2b959}.ph-gateway-card:active{transform:scale(.99)}
    .ph-gateway-card>img{display:block;flex:none;width:132px;height:132px;object-fit:cover;border:1px solid #b68c44;border-radius:15px;box-shadow:0 5px 20px #0007}
    .ph-gateway-copy{display:flex;flex-direction:column;align-items:flex-start;min-width:0}.ph-gateway-copy small{font-size:9px;font-weight:900;letter-spacing:.12em;color:#deb860}.ph-gateway-copy strong{margin-top:5px;font-size:23px;letter-spacing:-.03em}.ph-gateway-copy>span{margin-top:5px;color:#b6c3d3;font-size:11px;line-height:1.4}.ph-gateway-copy b{margin-top:13px;padding:7px 10px;border-radius:8px;background:#e5c275;color:#2e260e;font-size:10px}.ph-gateway-copy i{font-style:normal;margin-left:8px}
    .ph-game-header{display:flex;align-items:center;gap:12px;margin-bottom:15px}.ph-game-header .ph-heading{margin:0}.ph-back{display:grid;place-items:center;flex:none;width:40px;height:40px;border:1px solid #485569;border-radius:12px;background:#1e2b3e;color:#f1f5ff;cursor:pointer}.ph-back svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.ph-back:focus-visible,.ph-gateway-card:focus-visible{outline:2px solid #eac775;outline-offset:3px}
    @media(max-width:420px){.ph-gateway-card{gap:13px;padding:12px}.ph-gateway-card>img{width:100px;height:100px}.ph-gateway-copy strong{font-size:20px}.ph-gateway-copy b{margin-top:9px}}

    .ph-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 12px;padding:0 2px}
    .ph-heading>div>span{color:#d9b55b;font:800 9px/1.2 system-ui,sans-serif;letter-spacing:.14em}
    .ph-heading h3{margin:4px 0 0;color:#f8fafc;font-size:20px;letter-spacing:-.03em}
    .ph-heading p{margin:4px 0 0;color:#a8b4c4;font-size:11px;line-height:1.45}
    .ph-heading-icon{display:grid;place-items:center;width:36px;height:36px;border:1px solid #695834;border-radius:12px;background:#413a2b;color:#e9c978;font-size:18px}
    .ph-games-grid .hub-card{grid-column:auto;min-height:126px;align-items:flex-start;flex-direction:column;gap:0}
    .ph-games-grid .hub-card .hub-card-icon{width:50px;height:50px;flex:0 0 50px}
    .ph-games-grid .hub-card .hub-card-icon img{width:46px;height:46px;object-fit:contain}
    .ph-games-grid .hub-card .hub-card-icon img.ph-farm-image{object-fit:cover;border-radius:12px}
    .ph-games-grid .hub-card strong{margin-top:auto;font-size:.78rem;letter-spacing:normal;text-align:left}
    .ph-games-grid .hub-card .hub-chevron{top:12px;right:14px;transform:none}
    .ph-services{padding-top:3px;border-top:1px solid #ffffff13}
    .ph-services .ph-heading{padding-top:14px}
    .ph-services .ph-heading>div>span{color:#8ebdec}
  `;
  document.head.appendChild(style);
};
