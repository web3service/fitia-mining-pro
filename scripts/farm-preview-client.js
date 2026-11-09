/* Aperçu isolé : jamais de portefeuille ou de requête financière réels. */
(() => {
  'use strict';
  const originalFetch = window.fetch.bind(window);
  window.fetch = (url, options) => {
    if (String(url) === 'https://fitia-mining-pro.vercel.app/api/farm') return originalFetch('/preview/farm', options);
    return originalFetch(url, options);
  };
  const keyName = 'fitia_preview_only_key';
  let key = sessionStorage.getItem(keyName);
  if (!key) { key = ethers.Wallet.createRandom().privateKey; sessionStorage.setItem(keyName, key); }
  const signer = new ethers.Wallet(key);
  const toast = document.getElementById('preview-toast'); let toastTimer;
  const app = window.App = {
    currentLang: 'fr', user: signer.address, signer,
    showToast(message) {
      if (message.includes('FTA transfer submitted') || message.includes('Transfert FTA envoyé')) message = 'Transfert fictif envoyé dans la démo.';
      else if (message.includes('FTA confirmed') || message.includes('Dépôt FTA confirmé')) message = 'Conversion fictive confirmée.';
      else if (message.includes('Withdrawal requested') || message.includes('Demande de retrait enregistrée')) message = 'Demande de retrait fictive enregistrée.';
      toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000); },
    nav() {}, activity: { notify() {} },
    ftaToken: {
      async balanceOf() { return ethers.parseUnits('100000', 8); },
      async transfer() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return { hash: ethers.hexlify(bytes) }; }
    },
    async ensurePolGas() { return true; }, async requestPinVerification() { return {}; },
    setLoader() {}, t() { return 'Solde fictif insuffisant.'; },
    mfaClient: { async operation() { return { required: false }; } }

  };
  app.farmCenter = new FitiaFarmCenter(app);
  window.setupGameFarm(app);
  // These controls run only against the isolated in-memory preview server and
  // a fake token; neither the fake transfer nor its verification calls Polygon.
  const openDeposit = app.farmCenter.openDeposit.bind(app.farmCenter);
  app.farmCenter.openDeposit = () => {
    openDeposit();
    document.getElementById('farm-dialog-title').textContent = 'Conversion fictive';
    const button = document.querySelector('#farm-dialog-actions button'); if (button && !app.farmCenter.pendingDeposit) button.textContent = 'CONVERTIR (SIMULATION)';
  };
  const openWithdraw = app.farmCenter.openWithdraw.bind(app.farmCenter);
  app.farmCenter.openWithdraw = () => {
    openWithdraw();
    if (document.getElementById('modal-farm-dialog').classList.contains('active')) {
      document.getElementById('farm-dialog-title').textContent = 'Retrait fictif';
      const button = document.querySelector('#farm-dialog-actions button'); if (button) button.textContent = 'DEMANDER (SIMULATION)';
    }
  };
  const walletButtons = document.querySelectorAll('.pf-wallet-actions button');
  walletButtons[0].textContent = 'CONVERSION FICTIVE'; walletButtons[1].textContent = 'RETRAIT FICTIF';
  const scrollTo = (target) => target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  document.querySelectorAll('[data-preview-action]').forEach(button => button.addEventListener('click', () => {
    if (!app.farmCenter.state) return app.showToast('Chargement de la ferme…');
    const action = button.dataset.previewAction;
    if (action === 'crops' || action === 'animals') { app.farmCenter.setTab(action); scrollTo(document.querySelector(`[data-farm-panel="${action}"]`)); }
    else if (action === 'progress') scrollTo(document.getElementById('pf-progress-title'));
    else if (action === 'market') app.farmCenter.openSell();
    else if (action === 'layout') app.farmCenter.openLayout();
    else if (action === 'breed') app.farmCenter.openBreeding();
    else if (action === 'fertilize') app.farmCenter.openFertilizer();
    else if (action === 'care') app.farmCenter.openCare();
    else if (action === 'well') app.farmCenter.openWell();
    else if (action === 'tractor') app.farmCenter.openTractor();
    else if (action === 'mill') app.farmCenter.openMill();
    else if (action === 'silo') app.farmCenter.openSilo();
    else if (action === 'deposit') app.farmCenter.openDeposit();
    else if (action === 'withdraw') app.farmCenter.openWithdraw();
  }));
  async function previewTool(action, starter = false) {
    if (app.farmCenter.operation || app.farmCenter.pendingCheck || app.farmCenter.refreshPromise) return app.showToast('Une opération est en cours.');
    if (action === 'reset' && !window.confirm('Recommencer la ferme fictive ?')) return;
    const response = await originalFetch(`/preview/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: signer.address, starter }) });
    if (!response.ok) throw new Error('Action de démonstration impossible.');
    if (action === 'reset') {
      const address = signer.address.toLowerCase();
      ['game_pending', 'market_pending', 'plot_pending', 'water_pending', 'care_pending', 'mission_pending', 'layout_pending', 'breed_pending', 'fertilize_pending', 'mill_pending', 'tractor_pending', 'silo_pending', 'pending_deposit', 'withdrawal_status'].forEach(name => localStorage.removeItem(`fitia_farm_${name}_v1:${address}`));
      app.farmCenter.closeDialog(); app.farmCenter.setAccount(signer.address);
    }
    await app.farmCenter.refresh({ quiet: true });
    app.showToast(action === 'reset' ? 'Démo réinitialisée.' : 'Productions fictives prêtes.');
  }
  document.getElementById('preview-ready').addEventListener('click', () => previewTool('ready').catch(error => app.showToast(error.message)));
  document.getElementById('preview-reset').addEventListener('click', () => previewTool('reset').catch(error => app.showToast(error.message)));
  document.getElementById('preview-new-farm').addEventListener('click', () => previewTool('reset', true).catch(error => app.showToast(error.message)));
  (async () => {
    const response = await originalFetch('/preview/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: signer.address }) });
    if (!response.ok) throw new Error('Initialisation de l’aperçu impossible.');
    app.farmCenter.init(); app.farmCenter.setAccount(signer.address); app.farmCenter.enter();
  })().catch(error => { console.error(error); app.showToast(error.message); });
})();
