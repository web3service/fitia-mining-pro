'use strict';

// Production FARM presentation. The signed controller, server economy and
// animated Three.js scene remain authoritative; this module only adapts the DOM
// and swaps packaged illustrations for local photography where appropriate.
window.setupGameFarm = function setupGameFarm(app) {
  const view = document.getElementById('view-farm');
  const farm = app?.farmCenter;
  if (!view || !farm || view.querySelector('.pf-page')) return;

  const photo = name => `<img class="pf-photo" src="assets/games/farm-${name}.jpg" alt="" draggable="false">`;
  const backIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7M8 12h11"/></svg>';
  const refreshIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7"/></svg>';
  const cameraIcons = {
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6M4.8 10a8 8 0 1 1 .7 7"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4v6h-6m5.2 0a8 8 0 1 0-.7 7"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    in: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>'
  };

  view.innerHTML = `
    <div class="pf-page">
      <header class="pf-header">
        <button class="pf-back" type="button" onclick="App.nav('hub')" aria-label="Back to Hub">${backIcon}</button>
        <img class="pf-logo" src="assets/games/farm-hub.jpg" alt="" draggable="false">
        <div class="pf-title"><span>FITIA GAMES</span><h2>FITIA <em>Farm</em></h2></div>
        <div class="pf-balance"><small>F-COINS</small><strong><i aria-hidden="true"></i><span id="farm-coin-balance">0</span></strong></div>
      </header>

      <section class="pf-wallet-bar" aria-label="Farm wallet">
        <div class="pf-wallet-actions">
          <button type="button" class="farm-primary-button" onclick="App.farmCenter.openDeposit()"><img src="assets/fta.png" width="19" height="19" alt=""><span data-farm-i18n="convertFta">CONVERT FTA</span></button>
          <button type="button" class="farm-secondary-button" data-farm-requires-start onclick="App.farmCenter.openWithdraw()" data-farm-i18n="withdrawFta">WITHDRAW FTA</button>
          <button type="button" class="pf-tool-button" onclick="App.farmCenter.manualRefresh()" aria-label="Refresh farm">${refreshIcon}</button>
        </div>
        <button type="button" id="farm-game-pending" class="farm-secondary-button hidden" onclick="App.farmCenter.openPendingGameAction()" data-farm-i18n="gamePending">CHECK PENDING ACTION</button>
        <p id="farm-deposit-pending" class="farm-pending-note hidden"><span data-farm-i18n="depositPending">FTA deposit pending confirmation.</span></p>
        <p id="farm-sync-status" class="pf-sync-status" role="status"></p>
      </section>

      <main class="pf-main">
        <section class="farm-scene-card pf-scene" aria-label="Interactive 3D farm">
          <div class="pf-scene-top" aria-hidden="true"><span data-farm-i18n="myFarm">MY FARM</span><span><i id="farm-sync-dot" class="farm-sync-dot"></i>LIVE 3D</span></div>
          <div class="farm-scene-toolbar">
            <div class="farm-view-presets" aria-label="Camera views">
              <button type="button" onclick="App.farmCenter.focusCamera('overview')" data-farm-i18n="farm">Farm</button>
              <button type="button" onclick="App.farmCenter.focusCamera('crops')" data-farm-i18n="cropTab">Crops</button>
              <button type="button" onclick="App.farmCenter.focusCamera('animals')" data-farm-i18n="animalTab">Animals</button>
            </div>
          </div>
          <div id="farm-3d-container" class="farm-3d-container">
            <div id="farm-3d-loading" class="farm-3d-loading"><span class="farm-loader-ring"></span><span class="sr-only">Loading</span></div>
            <div class="farm-camera-controls" aria-label="3D camera controls">
              <button type="button" onclick="App.farmCenter.rotateCamera(1)" aria-label="Rotate camera left">${cameraIcons.left}</button>
              <button type="button" onclick="App.farmCenter.focusCamera('overview')" aria-label="Reset camera">${cameraIcons.home}</button>
              <button type="button" onclick="App.farmCenter.rotateCamera(-1)" aria-label="Rotate camera right">${cameraIcons.right}</button>
              <button type="button" onclick="App.farmCenter.zoomCamera(1.18)" aria-label="Zoom out">${cameraIcons.out}</button>
              <button type="button" onclick="App.farmCenter.zoomCamera(0.84)" aria-label="Zoom in">${cameraIcons.in}</button>
            </div>
          </div>
        </section>

        <section class="pf-stats" aria-label="Farm overview">
          <div>${photo('chicken')}<span><small data-farm-i18n="animals">ANIMALS</small><strong id="farm-animal-count">0</strong></span></div>
          <div>${photo('wheat')}<span><small data-farm-i18n="crops">CROPS</small><strong id="farm-crop-count">0</strong></span></div>
          <div><img src="assets/farm/feed.svg" alt="" draggable="false"><span><small data-farm-i18n="feed">FEED</small><strong id="farm-feed-count">0</strong></span></div>
          <div><img src="assets/farm/barn.svg" alt="" draggable="false"><span><small data-farm-i18n="barnValue">BARN VALUE</small><strong><span id="farm-inventory-value">0</span> <i>F-Coins</i></strong></span></div>
        </section>

        <section id="farm-start-card" class="farm-start-card pf-start-card">
          <div class="farm-section-heading"><div><span data-farm-i18n="start">GET STARTED</span><h3 data-farm-i18n="build">Build your farm</h3></div></div>
          <div id="farm-land-check" class="farm-check-row">
            <span class="farm-check-mark">1</span><strong data-farm-i18n="land">Land</strong><b id="farm-land-status">500 F-Coins</b>
            <button id="farm-buy-land" type="button" class="farm-small-button" onclick="App.farmCenter.openBuyLand()" data-farm-i18n="buy">BUY</button>
          </div>
          <div id="farm-animal-check" class="farm-check-row">
            <span class="farm-check-mark">2</span><strong data-farm-i18n="firstAnimal">First animal</strong><b id="farm-animal-status">Required</b>
            <button id="farm-buy-first-animal" type="button" class="farm-small-button" onclick="App.farmCenter.openBuyAnimal()" data-farm-i18n="choose">CHOOSE</button>
          </div>
        </section>

        <section class="pf-ready" aria-labelledby="pf-ready-title">
          <div class="pf-ready-header"><h3 id="pf-ready-title">Ready on your farm</h3><span id="pf-ready-count"></span></div>
          <div id="pf-ready-list" class="pf-ready-list"></div>
          <p id="pf-ready-empty" class="pf-ready-empty"></p>
        </section>

        <section class="pf-progress" aria-labelledby="pf-progress-title">
          <div class="pf-progress-heading"><h3 id="pf-progress-title" data-farm-i18n="progressTitle">Farm progress</h3><strong id="farm-level"></strong></div>
          <p class="pf-progress-note" data-farm-i18n="progressNote">One reward per mission</p>
          <div id="farm-unlocks" class="pf-unlocks" aria-live="polite"></div><div id="farm-missions" class="pf-missions"></div>
        </section>

        <section class="farm-quick-actions pf-shortcuts" aria-label="Farm actions">
          <button type="button" data-farm-requires-land onclick="App.farmCenter.openBuyLand()"><img src="assets/farm/terrain.svg" alt=""><strong data-farm-i18n="land">Land</strong></button>
          <button type="button" data-farm-requires-land onclick="App.farmCenter.openBuyAnimal()">${photo('chicken')}<strong data-farm-i18n="animalTab">Animals</strong></button>
          <button type="button" data-farm-requires-start onclick="App.farmCenter.openPlant()">${photo('wheat')}<strong data-farm-i18n="plant">Plant</strong></button>
          <button type="button" data-farm-requires-start onclick="App.farmCenter.openBuyFeed()"><img src="assets/farm/feed.svg" alt=""><strong data-farm-i18n="feedAction">Feed</strong></button>
          <button type="button" id="farm-sell-inventory" data-farm-requires-start onclick="App.farmCenter.openSell()"><img src="assets/farm/barn.svg" alt=""><strong data-farm-i18n="sell">Sell</strong></button>
        </section>

        <section class="pf-management">
          <div class="pf-section-title"><div><span data-farm-i18n="manage">FARM MANAGEMENT</span><h3 data-farm-i18n="yourFarm">Your farm</h3></div></div>
          <nav class="farm-tabs pf-tabs" role="tablist" aria-label="Farm management">
            <button type="button" class="active" data-farm-tab="overview" role="tab" aria-selected="true" onclick="App.farmCenter.setTab('overview')" data-farm-i18n="overview">Overview</button>
            <button type="button" data-farm-tab="animals" role="tab" aria-selected="false" onclick="App.farmCenter.setTab('animals')" data-farm-i18n="animalTab">Animals</button>
            <button type="button" data-farm-tab="crops" role="tab" aria-selected="false" onclick="App.farmCenter.setTab('crops')" data-farm-i18n="cropTab">Crops</button>
            <button type="button" data-farm-tab="barn" role="tab" aria-selected="false" onclick="App.farmCenter.setTab('barn')" data-farm-i18n="barn">Barn</button>
          </nav>

          <section data-farm-panel="overview" class="farm-panel pf-panel">
            <div class="pf-mill"><div><strong data-farm-i18n="layoutTitle">Farm layout</strong><small data-farm-i18n="layoutDescription">Arrange the barn and house</small></div><button type="button" class="farm-small-button" data-farm-requires-start onclick="App.farmCenter.openLayout()" data-farm-i18n="millOpen">OPEN</button></div>
            <div class="farm-section-heading pf-subhead"><div><span>FTA</span><h3 data-farm-i18n="withdrawals">Withdrawals</h3></div><button type="button" class="farm-text-button" data-farm-requires-start onclick="App.farmCenter.openWithdraw()" data-farm-i18n="request">New request</button></div>
            <div id="farm-withdrawal-list" class="farm-withdrawal-list"></div>
            <p id="farm-withdrawals-empty" class="farm-empty-copy" data-farm-i18n="noWithdrawals">No withdrawals.</p>
          </section>

          <section data-farm-panel="animals" class="farm-panel pf-panel hidden">
            <div class="farm-section-heading pf-subhead"><div><span>PRODUCTION</span><h3 data-farm-i18n="animalTab">Animals</h3></div><button type="button" class="farm-text-button" data-farm-requires-land onclick="App.farmCenter.openBuyAnimal()" data-farm-i18n="addAnimal">Add animal</button></div>
            <div class="pf-mill"><div><strong data-farm-i18n="breedTitle">Breeding</strong><small data-farm-i18n="breedDescription">Raise young animals</small></div><button type="button" class="farm-small-button" data-farm-requires-start onclick="App.farmCenter.openBreeding()" data-farm-i18n="millOpen">OPEN</button></div>
            <div class="pf-mill"><div><strong data-farm-i18n="careTitle">Animal care</strong><small data-farm-i18n="careDescription">Care for your animals</small></div><button type="button" class="farm-small-button" data-farm-requires-start onclick="App.farmCenter.openCare()" data-farm-i18n="millOpen">OPEN</button></div>
            <div class="pf-mill"><div><strong data-farm-i18n="siloTitle">Silo</strong><small data-farm-i18n="siloDescription">Feed available animals</small></div><button type="button" class="farm-small-button" data-farm-requires-start onclick="App.farmCenter.openSilo()" data-farm-i18n="millOpen">OPEN</button></div>
            <div class="pf-mill"><div><strong data-farm-i18n="millTitle">Mill</strong><small data-farm-i18n="millRecipe">1 wheat = 2 feed</small></div><button type="button" class="farm-small-button" data-farm-requires-start onclick="App.farmCenter.openMill()" data-farm-i18n="millOpen">OPEN</button></div>
            <div id="farm-animal-list" class="farm-item-list"></div>
            <div id="farm-animals-empty" class="farm-empty-state">${photo('sheep')}<strong data-farm-i18n="noAnimals">No animals</strong></div>
          </section>

          <section data-farm-panel="crops" class="farm-panel pf-panel hidden">
            <div class="farm-section-heading pf-subhead"><div><span>HARVEST</span><h3 data-farm-i18n="cropTab">Crops</h3></div><button type="button" class="farm-text-button" data-farm-requires-start onclick="App.farmCenter.openPlant()" data-farm-i18n="plantCrop">Plant crop</button></div>
            <div class="pf-mill"><div><strong data-farm-i18n="fertilizerTitle">Fertilizer</strong><small data-farm-i18n="fertilizerDescription">Speed up growing crops</small></div><button type="button" class="farm-small-button" data-farm-requires-start onclick="App.farmCenter.openFertilizer()" data-farm-i18n="millOpen">OPEN</button></div>
            <div class="pf-mill"><div><strong data-farm-i18n="wellTitle">Well</strong><small data-farm-i18n="wellDescription">Care for growing crops</small></div><button type="button" class="farm-small-button" data-farm-requires-start onclick="App.farmCenter.openWell()" data-farm-i18n="millOpen">OPEN</button></div>
            <div class="pf-mill"><div><strong data-farm-i18n="tractorTitle">Tractor</strong><small data-farm-i18n="tractorDescription">Harvest ready plots</small></div><button type="button" class="farm-small-button" data-farm-requires-start onclick="App.farmCenter.openTractor()" data-farm-i18n="millOpen">OPEN</button></div>
            <div id="farm-plot-grid" class="pf-plot-grid" aria-label="Farm plots"></div>
            <div id="farm-crop-list" class="farm-item-list"></div>
            <div id="farm-crops-empty" class="farm-empty-state">${photo('carrot')}<strong data-farm-i18n="noCrops">No active crops</strong></div>
          </section>

          <section data-farm-panel="barn" class="farm-panel pf-panel hidden">
            <div class="farm-section-heading pf-subhead"><div><span>INVENTORY</span><h3 data-farm-i18n="barn">Barn</h3></div><button type="button" class="farm-text-button" data-farm-requires-start onclick="App.farmCenter.openSell()" data-farm-i18n="sellAll">Sell all</button></div>
            <div id="farm-inventory-list" class="farm-inventory-grid"></div>
            <div class="pf-market-history">
              <h4 data-farm-i18n="salesHistory">Recent sales</h4>
              <div id="farm-market-history" class="pf-market-history-list"></div>
              <p id="farm-market-history-empty" class="farm-empty-copy" data-farm-i18n="noSales">No recorded sales yet.</p>
            </div>
          </section>
        </section>
      </main>
    </div>`;

  const style = document.createElement('style');
  style.textContent = `
    #view-farm.farm-view{padding:0 0 28px}
    .pf-page{max-width:900px;margin:0 auto;padding:5px 0 0;color:#f4f5e8;font-family:system-ui,sans-serif}
    .pf-page *{box-sizing:border-box}.pf-page button:focus-visible{outline:2px solid #f8d37b;outline-offset:2px}
    .pf-header{display:flex;align-items:center;gap:10px}.pf-back{display:grid;place-items:center;width:40px;height:40px;flex:none;border:1px solid #435458;border-radius:12px;background:#22343a;color:#eaf4de;cursor:pointer}
    .pf-back svg,.pf-tool-button svg,.pf-page .farm-camera-controls svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    .pf-logo{width:44px;height:44px;flex:none;object-fit:cover;border:1px solid #d5bb6a;border-radius:12px;box-shadow:0 5px 15px #0004}
    .pf-title{min-width:0;flex:1}.pf-title>span,.pf-section-title>div>span,.pf-page .farm-section-heading>div>span{color:#a8be9e;font-size:9px;font-weight:800;letter-spacing:.12em}
    .pf-title h2{margin:2px 0 0;font-size:23px;line-height:1.1;letter-spacing:-.04em;white-space:nowrap}.pf-title em{margin-left:3px;color:#a7d383;font-style:normal}
    .pf-balance{flex:none;padding:7px 10px;border:1px solid #52645c;border-radius:11px;background:#24382e;text-align:right}.pf-balance small,.pf-balance strong{display:block}.pf-balance small{color:#a7bea1;font-size:8px;font-weight:800;letter-spacing:.08em}.pf-balance strong{margin-top:3px;color:#f3ce72;font-size:14px;white-space:nowrap}.pf-balance strong>i{display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:#f3ce72;box-shadow:0 0 8px #f3ce7255}
    .pf-wallet-bar{margin:13px 0 11px}.pf-wallet-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 42px;gap:8px}
    .pf-page .farm-primary-button,.pf-page .farm-secondary-button{display:inline-flex;min-width:0;min-height:42px;align-items:center;justify-content:center;gap:6px;padding:9px 12px;border-radius:11px;font-size:10px;font-weight:850;letter-spacing:.02em;cursor:pointer}
    .pf-page .farm-primary-button{border:1px solid #b4d67e;background:linear-gradient(135deg,#b8d87d,#8db65c);color:#18301e;box-shadow:0 6px 16px #0003}.pf-page .farm-primary-button img{width:19px;height:19px;border-radius:50%}
    .pf-page .farm-secondary-button{border:1px solid #746b48;background:#333c2e;color:#f3d68a}.pf-page .farm-primary-button:disabled,.pf-page .farm-secondary-button:disabled{opacity:.45;cursor:not-allowed}
    .pf-tool-button{display:grid;place-items:center;width:42px;min-height:42px;border:1px solid #4b6255;border-radius:11px;background:#21362d;color:#d7e8c8;cursor:pointer}
    .pf-page .farm-pending-note{margin:8px 0 0;padding:8px 10px;border:1px solid #74643c;border-radius:9px;background:#3e3828;color:#f0d392;font-size:11px}.pf-sync-status{margin:8px 2px 0;color:#e9c980;font-size:11px}.pf-sync-status:empty{display:none}
    .pf-main{min-width:0}.pf-page .farm-scene-card{position:relative;margin:0;overflow:hidden;border:1px solid #789366;border-radius:18px;background:#334b2f;box-shadow:0 16px 40px #0004}
    .pf-page .farm-3d-container{height:clamp(350px,66vw,570px);min-height:350px;overflow:hidden;border-radius:17px;background:linear-gradient(#91cce8,#7fa94e)}
    .pf-scene-top{position:absolute;z-index:4;top:12px;right:12px;left:12px;display:flex;justify-content:space-between;gap:7px;pointer-events:none}.pf-scene-top>span{display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid #ffffff33;border-radius:8px;background:#233b30d9;color:#fff8d9;font-size:8px;font-weight:900;letter-spacing:.09em;box-shadow:0 3px 10px #0002;backdrop-filter:blur(8px)}
    .pf-scene-top .farm-sync-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#b9dc78}.pf-scene-top .farm-sync-dot.working{background:#f0ca67}.pf-scene-top .farm-sync-dot.offline{background:#ef8c78}
    .pf-page .farm-scene-toolbar{top:51px;right:12px;left:auto;z-index:4;min-height:0;padding:0;border:0;pointer-events:none}.pf-page .farm-view-presets{display:flex;padding:3px;border:1px solid #ffffff2b;border-radius:10px;background:#20362edb;pointer-events:auto;box-shadow:0 3px 10px #0002;backdrop-filter:blur(8px)}
    .pf-page .farm-view-presets button{min-height:28px;padding:4px 9px;border:0;border-radius:7px;background:transparent;color:#e0ead6;font-size:9px;font-weight:800;cursor:pointer}.pf-page .farm-view-presets button:active{background:#527149}
    .pf-page .farm-camera-controls{bottom:12px;gap:4px;padding:5px;border:1px solid #ffffff29;border-radius:13px;background:#173220d9;box-shadow:0 5px 15px #0003;backdrop-filter:blur(8px)}
    .pf-page .farm-camera-controls button{display:grid;place-items:center;width:35px;height:35px;border:0;border-radius:9px;background:#ffffff12;color:#fff9e9;cursor:pointer}.pf-page .farm-camera-controls button:active{background:#c5e57b47}
    .pf-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.pf-stats>div{display:flex;align-items:center;gap:9px;min-width:0;padding:10px;border:1px solid #3c5847;border-radius:12px;background:linear-gradient(145deg,#20372e,#192d26);box-shadow:0 5px 13px #0002}
    .pf-stats img{width:38px;height:38px;flex:none;object-fit:contain}.pf-stats>div>span,.pf-stats small,.pf-stats strong{display:block;min-width:0}.pf-stats small{color:#a8bba7;font-size:8px;font-weight:800;letter-spacing:.06em}.pf-stats strong{margin-top:4px;color:#fff2c6;font-size:15px;white-space:nowrap}.pf-stats strong>i{color:#aebb9f;font-size:9px;font-style:normal;font-weight:600}
    .pf-photo{object-fit:cover}.pf-stats img.pf-photo{border:1px solid #637c51;border-radius:9px}
    .pf-page .farm-start-card{margin:12px 0 0;padding:14px;border:1px solid #53674a;border-radius:14px;background:linear-gradient(120deg,#344a33,#243b2b);box-shadow:none}
    .pf-page .farm-section-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.pf-page .farm-section-heading h3{margin:4px 0 0;color:#f3f5e8;font-size:16px;letter-spacing:-.025em}
    .pf-page .farm-check-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:10px 2px;border-bottom:1px solid #ffffff13}.pf-page .farm-check-row:last-child{border-bottom:0}.pf-page .farm-check-row>strong{color:#e7eedc;font-size:12px}.pf-page .farm-check-row>b{color:#d9c77f;font-size:10px}.pf-page .farm-check-mark{display:grid;place-items:center;width:26px;height:26px;border:1px solid #a89455;border-radius:8px;color:#f0d58a;font-size:10px}.pf-page .farm-check-row.complete{background:#bbd9810c}
    .pf-page .farm-small-button{min-height:34px;padding:7px 11px;border:0;border-radius:8px;background:#b3cf77;color:#1c321f;font-size:10px;font-weight:900;box-shadow:none;cursor:pointer}.pf-page .farm-small-button:disabled{opacity:.45;cursor:not-allowed}
    .pf-page .farm-quick-actions{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:12px 0}.pf-page .farm-quick-actions button{min-width:0;min-height:88px;padding:9px 4px;border:1px solid #47624c;border-radius:12px;background:linear-gradient(145deg,#2a4234,#21372b);color:#f0f4df;box-shadow:0 5px 14px #0002;cursor:pointer}.pf-page .farm-quick-actions button:disabled{opacity:.45;cursor:not-allowed}.pf-page .farm-quick-actions img{display:block;width:42px;height:42px;margin:0 auto 6px;object-fit:contain}.pf-page .farm-quick-actions img.pf-photo{border:1px solid #6c8658;border-radius:9px;object-fit:cover}.pf-page .farm-quick-actions strong{display:block;overflow:hidden;color:#eef3df;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
    .pf-mill{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0;padding:12px;border:1px solid #53755a;border-radius:11px;background:#263d2d}.pf-mill strong,.pf-mill small{display:block}.pf-mill strong{color:#edf5e9;font-size:12px}.pf-mill small{margin-top:4px;color:#b9cbb3;font-size:11px}
    .pf-progress{margin:12px 0;padding:14px;border:1px solid #405a46;border-radius:14px;background:#1b3024}.pf-progress-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.pf-progress-heading h3{margin:0;color:#eef5e9;font-size:14px}.pf-progress-heading strong{color:#c1e5b2;font-size:12px}.pf-progress-note{margin:6px 0 10px;color:#aebfae;font-size:10px}.pf-missions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.pf-mission{display:block;text-align:left;padding:9px;border:1px solid #405a46;border-radius:10px;background:#263d2d;color:#e4efe1}.pf-mission strong,.pf-mission span{display:block;font-size:11px}.pf-mission span{margin-top:4px;color:#bcd3b7}.pf-mission progress{width:100%;height:6px;accent-color:#89b879}.pf-mission.complete{border-color:#83ad72}
    .pf-plot-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.pf-plot{min-height:65px;padding:9px 6px;border:1px solid #53755a;border-radius:10px;background:#20392a;color:#e9f1e6;text-align:left}.pf-plot.occupied{background:#354a31;border-color:#7da478}.pf-plot strong,.pf-plot span{display:block;font-size:11px}.pf-plot span{margin-top:4px;color:#b8ccb6;font-size:10px}.pf-plot:disabled{opacity:.5}
    .pf-market-history{margin-top:18px;padding-top:14px;border-top:1px solid #ffffff1c}.pf-market-history h4{margin:0 0 10px;color:#ecf4e8;font-size:14px}.pf-market-history-list{display:grid;gap:7px}.pf-market-sale{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px;border:1px solid #405a46;border-radius:10px;background:#22372b}.pf-market-sale span,.pf-market-sale small{display:block;overflow-wrap:anywhere}.pf-market-sale span{color:#e7f0e4;font-size:12px}.pf-market-sale small{margin-top:3px;color:#b5c7b4;font-size:10px}.pf-market-sale strong{color:#c6e6b7;font-size:12px;white-space:nowrap}
    .pf-ready{margin:12px 0;padding:15px;border:1px solid #496452;border-radius:15px;background:linear-gradient(145deg,#203a2d,#192d26)}
    .pf-ready-header{display:flex;justify-content:space-between;align-items:center;gap:8px}.pf-ready-header h3{margin:0;color:#f1f6eb;font-size:15px}.pf-ready-header span{color:#c5e2b3;font-size:12px;font-weight:700}
    .pf-ready-list{display:grid;gap:7px;margin-top:10px}.pf-ready-list:empty{display:none}.pf-ready-item{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:48px;padding:10px 12px;border:1px solid #53785d;border-radius:10px;background:#2b4835;color:#eff8ea;text-align:left;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.pf-ready-item:disabled{opacity:.5;cursor:not-allowed}.pf-ready-item span:last-child{color:#c4e6b0;font-size:12px;white-space:nowrap}.pf-ready-empty{margin:10px 0 0;color:#bdcdbd;font-size:12px;line-height:1.45}
    .pf-page .farm-quick-actions button{min-height:80px}.pf-page .farm-quick-actions strong{font-size:11px;white-space:normal;overflow:visible;line-height:1.2}
    .pf-management{padding:16px;border:1px solid #3e594d;border-radius:16px;background:linear-gradient(145deg,#21342d,#182920);box-shadow:0 12px 28px #0002}.pf-section-title{display:flex;align-items:center;justify-content:space-between;gap:8px}.pf-section-title h3{margin:5px 0 0;font-size:18px;letter-spacing:-.03em}
    .pf-page .farm-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin:15px 0 4px;padding:4px;border:0;border-radius:10px;background:#15251e}.pf-page .farm-tabs button{min-width:0;min-height:38px;padding:5px 3px;border:0;border-radius:7px;background:transparent;color:#aebfb0;font-size:11px;font-weight:750;cursor:pointer}.pf-page .farm-tabs button.active{background:#486740;color:#f6f9dc;box-shadow:0 2px 6px #0003}
    .pf-page .farm-panel{margin:0;padding:12px 0 0;border:0;border-radius:0;background:transparent;box-shadow:none}.pf-page .pf-subhead{margin:8px 0 10px}.pf-page .farm-text-button{padding:6px 0;border:0;background:transparent;color:#c8e19d;font-size:10px;font-weight:800;cursor:pointer}.pf-page .farm-text-button:disabled{opacity:.45}
    .pf-page .farm-empty-copy{margin:8px 0 0;color:#aebfad;font-size:11px}.pf-page .farm-withdrawal-list{display:grid;gap:7px}.pf-page .farm-withdrawal-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px;border:1px solid #405a46;border-radius:10px;background:#22372b}.pf-page .farm-withdrawal-row strong,.pf-page .farm-withdrawal-row small{display:block}.pf-page .farm-withdrawal-row strong{color:#f1d387;font-size:12px}.pf-page .farm-withdrawal-row small{margin-top:4px;color:#b4c2aa;font-size:10px}.pf-page .farm-withdrawal-status{padding:5px 7px;border-radius:7px;background:#514a2e;color:#f0d18a;font-size:8px;font-weight:900}.pf-page .farm-withdrawal-status.paid{background:#304c31;color:#cde6a8}
    .pf-page .farm-item-list{display:grid;gap:8px}.pf-page .farm-item-card{display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid #405a46;border-radius:12px;background:#22372b}.pf-page .farm-item-icon{width:56px;height:56px;padding:0;border:1px solid #607b50;border-radius:10px;background:#2c4332;object-fit:contain}.pf-page .farm-item-icon.pf-photo{object-fit:cover}.pf-page .farm-item-main{min-width:0}.pf-page .farm-item-main strong,.pf-page .farm-item-main small{display:block}.pf-page .farm-item-main strong{color:#eff4df;font-size:12px}.pf-page .farm-item-main small{margin-top:4px;color:#b4c8ac;font-size:10px;line-height:1.4}.pf-page .farm-item-status{grid-column:2/-1;color:#d8bd75;font-size:10px}.pf-page .farm-item-status.ready{color:#b9db8c}.pf-page .farm-item-card .farm-small-button{grid-row:1;grid-column:3}
    .pf-page .farm-empty-state{padding:18px;color:#b4c3ac;text-align:center}.pf-page .farm-empty-state img{display:block;width:82px;height:82px;margin:0 auto 9px;border:1px solid #62794f;border-radius:14px;object-fit:cover}.pf-page .farm-empty-state strong{color:#dce7d2;font-size:12px}
    .pf-page .farm-inventory-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.pf-page .farm-inventory-item{display:grid;grid-template-columns:38px minmax(0,1fr);gap:3px 8px;align-items:center;padding:10px;border:1px solid #405a46;border-radius:11px;background:#22372b}.pf-page .farm-inventory-item>img{grid-row:1/3;width:38px;height:38px;border-radius:8px;object-fit:contain}.pf-page .farm-inventory-item>img.pf-photo{object-fit:cover}.pf-page .farm-inventory-item strong{color:#f0f4df;font-size:14px}.pf-page .farm-inventory-item small{color:#b4c5aa;font-size:9px;line-height:1.4}
    .farm-dialog-visual img.pf-photo,.farm-shop-icon.pf-photo{border:1px solid #71875b;border-radius:15px;object-fit:cover}
    @media(max-width:700px){.pf-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.pf-stats>div{padding:9px}.pf-management{padding:14px}.pf-page .farm-3d-container{height:min(100vw,480px);min-height:340px}.pf-page .farm-inventory-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:380px){.pf-page .farm-quick-actions{grid-template-columns:repeat(3,minmax(0,1fr))}.pf-header{gap:6px}.pf-back{width:36px;height:36px}.pf-logo{width:36px;height:36px}.pf-title h2{font-size:19px}.pf-title>span{font-size:8px}.pf-balance{padding:6px 7px}.pf-balance small{font-size:7px}.pf-balance strong{font-size:12px}.pf-wallet-actions{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 38px;gap:6px}.pf-tool-button{width:38px}.pf-page .farm-primary-button,.pf-page .farm-secondary-button{padding-inline:6px;font-size:8px}.pf-page .farm-3d-container{min-height:325px}.pf-scene-top{top:9px;right:9px;left:9px}.pf-scene-top>span{padding:5px 6px;font-size:7px}.pf-page .farm-scene-toolbar{top:45px;right:9px}.pf-page .farm-view-presets button{padding-inline:7px;font-size:8px}.pf-page .farm-camera-controls{gap:3px}.pf-page .farm-camera-controls button{width:40px;height:40px}.pf-page .farm-quick-actions{gap:5px}.pf-page .farm-quick-actions button{min-height:79px;padding-inline:2px}.pf-page .farm-quick-actions img{width:36px;height:36px}.pf-page .farm-quick-actions strong{font-size:10px}.pf-page .farm-tabs button{font-size:10px}.pf-page .farm-item-card{grid-template-columns:48px minmax(0,1fr)}.pf-page .farm-item-icon{width:48px;height:48px}.pf-page .farm-item-card .farm-small-button{grid-row:auto;grid-column:2/-1;width:100%}}
  `;
  document.head.appendChild(style);

  const photoSources = Object.fromEntries(['chicken', 'sheep', 'cow', 'wheat', 'carrot'].map(name => [name, `assets/games/farm-${name}.jpg`]));
  const upgradePhotos = root => {
    if (!root) return;
    for (const [name, source] of Object.entries(photoSources)) {
      root.querySelectorAll?.(`img[src="assets/farm/${name}.svg"]`).forEach(image => {
        image.src = source;
        image.classList.add('pf-photo');
        image.draggable = false;
      });
    }
  };
  const readyNames = {
    en: { wheat: 'Wheat', carrot: 'Carrot', maize: 'Maize', tomato: 'Tomato', chicken: 'Chicken', sheep: 'Sheep', cow: 'Cow' },
    fr: { wheat: 'Blé', carrot: 'Carotte', maize: 'Maïs', tomato: 'Tomate', chicken: 'Poule', sheep: 'Mouton', cow: 'Vache' }
  };
  const labels = {
    convertFta: ['CONVERT FTA', 'CONVERTIR FTA'], withdrawFta: ['WITHDRAW FTA', 'RETIRER FTA'], depositPending: ['FTA deposit pending confirmation.', 'Dépôt FTA en attente de confirmation.'],
    gamePending: ['CHECK PENDING ACTION', 'VÉRIFIER L’ACTION EN ATTENTE'],
    layoutTitle: ['Farm layout', 'Aménagement'], layoutDescription: ['Move and customize buildings', 'Déplacer et personnaliser les bâtiments'],
    breedTitle: ['Breeding', 'Reproduction'], breedDescription: ['Raise young animals', 'Élever de jeunes animaux'],
    fertilizerTitle: ['Fertilizer', 'Engrais'], fertilizerDescription: ['Speed up growing crops', 'Accélérer les cultures'],
    careTitle: ['Animal care', 'Soins des animaux'], careDescription: ['Care for your animals', 'Soigner vos animaux'],
    wellTitle: ['Well', 'Puits'], wellDescription: ['Care for growing crops', 'Entretenir les cultures'],
    siloTitle: ['Silo', 'Silo'], siloDescription: ['Feed available animals', 'Nourrir les animaux disponibles'],
    tractorTitle: ['Tractor', 'Tracteur'], tractorDescription: ['Harvest ready plots', 'Récolter les parcelles prêtes'],
    millTitle: ['Mill', 'Moulin'], millRecipe: ['1 wheat = 2 feed', '1 blé = 2 nourritures'], millOpen: ['OPEN', 'OUVRIR'],
    progressTitle: ['Farm progress', 'Progression de la ferme'],
    progressNote: ['One reward per mission', 'Une récompense par mission'],
    salesHistory: ['Recent sales', 'Ventes récentes'],
    noSales: ['No recorded sales yet.', 'Aucune vente enregistrée.'],
    animals: ['ANIMALS', 'Animaux'],
    crops: ['CROPS', 'Cultures'],
    feed: ['FEED', 'Nourriture'],
    barnValue: ['BARN VALUE', 'Valeur du stock'],
    start: ['GET STARTED', 'Premiers pas'],
    build: ['Build your farm', 'Créez votre ferme'],
    firstAnimal: ['First animal', 'Premier animal'],
    required: ['Required', 'Requis'],
    buy: ['BUY', 'ACHETER'],
    choose: ['CHOOSE', 'CHOISIR'],
    manage: ['FARM MANAGEMENT', 'GESTION DE LA FERME'],
    yourFarm: ['Your farm', 'Votre ferme'],
    overview: ['Overview', 'Vue générale'],
    animalTab: ['Animals', 'Animaux'],
    cropTab: ['Crops', 'Cultures'],
    barn: ['Barn', 'Stock'],
    withdrawals: ['Withdrawals', 'Retraits'],
    request: ['New request', 'Demander'],
    noWithdrawals: ['No withdrawals.', 'Aucun retrait.'],
    addAnimal: ['Add animal', 'Ajouter'],
    noAnimals: ['No animals', 'Aucun animal'],
    plantCrop: ['Plant crop', 'Semer'],
    noCrops: ['No active crops', 'Aucune culture en cours'],
    sellAll: ['Sell all', 'Tout vendre'],
    land: ['Land', 'Terrain'],
    plant: ['Plant', 'Semer'],
    feedAction: ['Feed', 'Nourrir'],
    sell: ['Sell', 'Vendre'],
    farm: ['Farm', 'Ferme'],
    myFarm: ['MY FARM', 'MA FERME']
  };
  let renderedLanguage = '';
  function translateLabels() {
    const language = (app.currentLang || app.language) === 'fr' ? 'fr' : 'en';
    if (renderedLanguage === language) return;
    renderedLanguage = language;
    view.querySelectorAll('[data-farm-i18n]').forEach(element => {
      const pair = labels[element.dataset.farmI18n];
      if (pair) element.textContent = pair[language === 'fr' ? 1 : 0];
    });
    farm.renderMarketSales?.(); farm.renderPlotGrid?.(); farm.renderProgress?.(); farm.renderAnimals?.(); farm.renderCrops?.(); farm.renderWithdrawals?.();
  }
  let readyFingerprint = '';
  function renderReady() {
    translateLabels();
    const state = farm.state;
    const list = view.querySelector('#pf-ready-list');
    const empty = view.querySelector('#pf-ready-empty');
    const count = view.querySelector('#pf-ready-count');
    const title = view.querySelector('#pf-ready-title');
    if (!list || !empty || !count || !title) return;
    const fr = (app.currentLang || app.language) === 'fr';
    const names = readyNames[fr ? 'fr' : 'en'];
    title.textContent = fr ? 'Prêt sur votre ferme' : 'Ready on your farm';
    const now = farm.serverNow?.() || Date.now();
    const ready = state && farm.started() ? [
      ...state.crops.filter(crop => crop.readyAt <= now).map(crop => ({ kind: 'crop', id: crop.id, species: crop.species })),
      ...state.animals.filter(animal => animal.produceAt && animal.produceAt <= now).map(animal => ({ kind: 'animal', id: animal.id, species: animal.species }))
    ] : [];
    count.textContent = ready.length ? String(ready.length) : '';
    empty.textContent = !state ? (fr ? 'Synchronisation de la ferme…' : 'Synchronizing your farm…')
      : !farm.started() ? (fr ? 'Achetez un terrain et un animal pour commencer.' : 'Buy land and an animal to get started.')
      : (fr ? 'Rien à récolter pour le moment.' : 'Nothing ready to collect yet.');
    empty.hidden = ready.length > 0;
    const fingerprint = JSON.stringify([fr, farm.operation, ready]);
    if (fingerprint === readyFingerprint) return;
    readyFingerprint = fingerprint;
    list.replaceChildren();
    for (const item of ready) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'pf-ready-item';
      button.disabled = Boolean(farm.operation);
      const name = document.createElement('span'); name.textContent = names[item.species] || item.species;
      const action = document.createElement('span'); action.textContent = item.kind === 'crop' ? (fr ? 'Récolter' : 'Harvest') : (fr ? 'Collecter' : 'Collect');
      button.append(name, action);
      button.addEventListener('click', () => farm.openEntity(item.kind, item.id));
      list.appendChild(button);
    }
  }
  const officialTick = farm.tick.bind(farm);
  farm.tick = function tickWithFarmReady(...args) {
    const result = officialTick(...args);
    renderReady();
    return result;
  };

  const officialRender = farm.render.bind(farm);
  farm.render = function renderWithFarmPresentation(...args) {
    const result = officialRender(...args);
    upgradePhotos(view);
    return result;
  };
  const dialog = document.getElementById('farm-dialog-content');
  if (dialog && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => upgradePhotos(dialog));
    observer.observe(dialog, { childList: true, subtree: true });
  }
  farm.render();
};
