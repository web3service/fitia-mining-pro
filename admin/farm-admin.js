/* FITIA FARM — administration mobile des retraits FTA vérifiés on-chain. */
(() => {
  'use strict';

  function formatFta(units) {
    try {
      const value = BigInt(String(units));
      const whole = value / 100000000n;
      const fraction = (value % 100000000n).toString().padStart(8, '0').replace(/0+$/, '');
      return fraction ? `${whole}.${fraction}` : String(whole);
    } catch (_) { return '—'; }
  }

  function createFarmAdmin(deps) {
    const state = { withdrawals: [], loading: null, saving: '', loaded: false, rateDraft: null, rateSaving: false, liveRate: null, liveSaving: false };
    const { byId, api } = deps;

    function reset() {
      state.withdrawals = []; state.loaded = false; state.saving = ''; state.rateDraft = null; state.rateSaving = false;
      state.liveRate = null; state.liveSaving = false; byId('farm-live-rate')?.classList.add('hidden');
      byId('farm-rate-draft')?.classList.add('hidden');
      const list = byId('farm-withdrawals-list'); if (list) list.textContent = '';
      const error = byId('farm-withdrawals-error');
      if (error) { error.textContent = ''; error.classList.add('hidden'); }
    }
    function showError(error) {
      if (!error || error.code === 'AUTH_REQUIRED') return;
      byId('farm-withdrawals-error').textContent = error.message;
      byId('farm-withdrawals-error').classList.remove('hidden');
    }
    async function load(options = {}) {
      if (state.loading) return state.loading;
      state.loading = (async () => {
        if (!options.quiet) deps.setLoading(true, 'Chargement des retraits FITIA FARM…');
        try {
          const data = await api('/api/admin/farm-withdrawals');
          state.withdrawals = Array.isArray(data.withdrawals) ? data.withdrawals : [];
          state.loaded = true;
          byId('farm-withdrawals-error').classList.add('hidden');
          render(); await Promise.all([loadRateDraft(), loadLiveRate()]); deps.setConnection('online');
          return data;
        } catch (error) {
          showError(error);
          if (error.code !== 'AUTH_REQUIRED') deps.showToast(error.message, 'error');
          throw error;
        } finally { if (!options.quiet) deps.setLoading(false); }
      })();
      try { return await state.loading; } finally { state.loading = null; }
    }
    function parseRate(value) {
      const text = String(value).trim().replace(',', '.');
      if (!/^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,8})?$/.test(text)) throw new Error('Saisissez un montant FTA positif avec au maximum 8 décimales.');
      const [whole, fraction = ''] = text.split('.');
      const units = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
      if (units <= 0n || units > 1000000000000000n) throw new Error('Le taux est hors limites.');
      return units.toString();
    }
    async function loadRateDraft() {
      const panel = byId('farm-rate-draft'); if (!panel || state.rateSaving) return;
      try {
        const result = await api('/api/admin/farm-exchange-draft'); const draft = result.draft;
        if (!draft || draft.enabled !== false || typeof draft.rateUnits !== 'string' || !Number.isSafeInteger(draft.version)) throw new Error('Brouillon invalide.');
        state.rateDraft = draft; panel.classList.remove('hidden');
        const input = byId('farm-rate-draft-input');
        if (document.activeElement !== input) input.value = formatFta(draft.rateUnits);
        byId('farm-rate-draft-status').textContent = `Brouillon version ${draft.version} · non actif`;
      } catch (error) {
        state.rateDraft = null; panel.classList.add('hidden');
        if (error.code !== 'NOT_FOUND' && error.code !== 'AUTH_REQUIRED') deps.showToast(error.message, 'error');
      }
    }
    async function saveRateDraft(event) {
      event.preventDefault(); if (state.rateSaving || !state.rateDraft) return;
      let rateUnits;
      try { rateUnits = parseRate(byId('farm-rate-draft-input').value); }
      catch (error) { byId('farm-rate-draft-status').textContent = error.message; return; }
      if (!window.confirm('Enregistrer ce brouillon ? Il ne changera pas le taux appliqué aux comptes.')) return;
      state.rateSaving = true; byId('farm-rate-draft-save').disabled = true;
      try {
        const result = await api('/api/admin/farm-exchange-draft', { method: 'PATCH', body: { rateUnits, expectedVersion: state.rateDraft.version } });
        if (!result.draft || result.draft.enabled !== false) throw new Error('Réponse de brouillon invalide.');
        state.rateDraft = result.draft; byId('farm-rate-draft-input').value = formatFta(result.draft.rateUnits);
        byId('farm-rate-draft-status').textContent = `Brouillon version ${result.draft.version} enregistré · non actif`;
        deps.showToast('Brouillon enregistré. Le taux réel reste inchangé.');
      } catch (error) { byId('farm-rate-draft-status').textContent = error.message; }
      finally { state.rateSaving = false; byId('farm-rate-draft-save').disabled = false; }
    }
    function validLiveRate(rate) {
      return rate && typeof rate.enabled === 'boolean' && typeof rate.rateUnits === 'string' && /^[1-9][0-9]{0,15}$/.test(rate.rateUnits)
        && BigInt(rate.rateUnits) <= 1000000000000000n && Number.isSafeInteger(rate.version) && rate.version >= 1;
    }
    async function loadLiveRate() {
      const panel = byId('farm-live-rate'); if (!panel || state.liveSaving) return;
      try {
        const result = await api('/api/admin/farm-live-rate');
        if (!validLiveRate(result.rate)) throw new Error('Taux indisponible.');
        state.liveRate = result.rate; panel.classList.remove('hidden');
        byId('farm-live-rate-mode').textContent = result.rate.enabled ? 'Taux actif : les nouvelles conversions utilisent ce taux.' : 'Taux préparé mais désactivé : les conversions réelles ne l’utilisent pas.';
        if (document.activeElement !== byId('farm-live-rate-input')) byId('farm-live-rate-input').value = formatFta(result.rate.rateUnits);
        byId('farm-live-rate-status').textContent = `Version ${result.rate.version}`;
      } catch (error) {
        state.liveRate = null; panel.classList.add('hidden');
        if (error.code !== 'NOT_FOUND' && error.code !== 'AUTH_REQUIRED') deps.showToast(error.message, 'error');
      }
    }
    async function saveLiveRate(event) {
      event.preventDefault(); if (state.liveSaving || !state.liveRate) return;
      let rateUnits;
      try { rateUnits = parseRate(byId('farm-live-rate-input').value); }
      catch (error) { byId('farm-live-rate-status').textContent = error.message; return; }
      const warning = state.liveRate.enabled ? 'Ce changement affectera les nouvelles conversions de tous les comptes. Les retraits déjà enregistrés gardent leur montant. Confirmer ?' : 'Ce taux reste désactivé et ne change pas les conversions actuelles. Confirmer ?';
      if (!window.confirm(warning)) return;
      state.liveSaving = true; byId('farm-live-rate-save').disabled = true;
      try {
        const result = await api('/api/admin/farm-live-rate', { method: 'PATCH', body: { rateUnits, expectedVersion: state.liveRate.version } });
        if (!validLiveRate(result.rate)) throw new Error('Réponse de taux invalide.');
        state.liveRate = result.rate; byId('farm-live-rate-input').value = formatFta(result.rate.rateUnits);
        byId('farm-live-rate-mode').textContent = result.rate.enabled ? 'Taux actif : les nouvelles conversions utilisent ce taux.' : 'Taux préparé mais désactivé : les conversions réelles ne l’utilisent pas.';
        byId('farm-live-rate-status').textContent = `Version ${result.rate.version} enregistrée`;
      } catch (error) { byId('farm-live-rate-status').textContent = error.message; }
      finally { state.liveSaving = false; byId('farm-live-rate-save').disabled = false; }
    }
    function detail(label, value, mono = false) {
      const row = document.createElement('div'); row.className = 'order-detail-row';
      const small = document.createElement('small'); small.textContent = label;
      const span = document.createElement('span'); span.textContent = value || '—';
      if (mono) span.className = 'farm-mono';
      row.append(small, span); return row;
    }
    async function copy(value, label) {
      try { await navigator.clipboard.writeText(value); deps.showToast(`${label} copié.`); }
      catch (_) { deps.showToast('Copie indisponible. Sélectionnez la valeur affichée.', 'error'); }
    }
    async function complete(withdrawal, card) {
      if (state.saving) return;
      const input = card.querySelector('[data-farm-payout-tx]');
      const txHash = input.value.trim();
      if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
        deps.showToast('Saisissez un hash de transaction Polygon valide.', 'error'); input.focus(); return;
      }
      state.saving = withdrawal.id;
      const button = card.querySelector('[data-farm-pay]'); button.disabled = true;
      try {
        const result = await api('/api/admin/farm-withdrawals', { method: 'PATCH', body: { id: withdrawal.id, txHash } });
        if (result.pending) {
          deps.showToast('Transaction trouvée mais pas encore confirmée. Réessayez dans un instant.', 'error');
          return;
        }
        const index = state.withdrawals.findIndex((item) => item.id === withdrawal.id);
        if (index >= 0) state.withdrawals[index] = result.withdrawal;
        render(); deps.showToast('Paiement FTA vérifié. Retrait clôturé.');
      } catch (error) {
        showError(error); deps.showToast(error.message, 'error');
      } finally { state.saving = ''; button.disabled = false; }
    }
    function render() {
      const list = byId('farm-withdrawals-list'); if (!list) return;
      const filter = byId('farm-withdrawals-filter').value;
      const visible = state.withdrawals.filter((item) => filter === 'all' || item.status === filter);
      const pending = state.withdrawals.filter((item) => item.status === 'pending');
      list.textContent = '';
      byId('farm-withdrawals-empty').classList.toggle('hidden', visible.length > 0);
      byId('farm-stat-pending').textContent = String(pending.length);
      byId('farm-stat-paid').textContent = String(state.withdrawals.filter((item) => item.status === 'paid').length);
      byId('farm-stat-coins').textContent = String(pending.reduce((sum, item) => sum + Number(item.coins || 0), 0));
      byId('farm-stat-fta').textContent = formatFta(pending.reduce((sum, item) => sum + BigInt(item.ftaUnits || 0), 0n));

      visible.forEach((withdrawal) => {
        const card = document.createElement('article'); card.className = 'announcement-row farm-withdrawal-card';
        const main = document.createElement('div'); main.className = 'announcement-main';
        const meta = document.createElement('div'); meta.className = 'announcement-meta';
        const badge = document.createElement('span');
        badge.className = `status-pill ${withdrawal.status === 'paid' ? 'status-active' : 'status-scheduled'}`;
        badge.textContent = withdrawal.status === 'paid' ? 'Payé · vérifié' : 'En attente de paiement';
        const amount = document.createElement('strong'); amount.textContent = `${formatFta(withdrawal.ftaUnits)} FTA`;
        const time = document.createElement('small'); time.textContent = deps.formatDate(withdrawal.createdAt);
        meta.append(badge, amount, time);
        const details = document.createElement('div'); details.className = 'seller-order-details';
        details.append(
          detail('Coins débités', `${withdrawal.coins} coins`),
          detail('Wallet destinataire', withdrawal.wallet, true),
          detail('Référence', withdrawal.id, true),
          detail('Hash du paiement', withdrawal.payoutTxHash || 'Non enregistré', true)
        );
        main.append(meta, details);
        const controls = document.createElement('div'); controls.className = 'seller-order-controls farm-withdrawal-controls';
        if (withdrawal.status === 'pending') {
          const copyWallet = deps.makeButton('Copier le wallet', 'button button-secondary action-button', () => copy(withdrawal.wallet, 'Wallet'));
          const copyAmount = deps.makeButton(`Copier ${formatFta(withdrawal.ftaUnits)} FTA`, 'button button-secondary action-button', () => copy(formatFta(withdrawal.ftaUnits), 'Montant'));
          const label = document.createElement('label'); label.textContent = 'Hash du transfert depuis la trésorerie';
          const input = document.createElement('input'); input.className = 'mono-input'; input.dataset.farmPayoutTx = '';
          input.maxLength = 66; input.placeholder = '0x…'; input.autocomplete = 'off'; input.spellcheck = false;
          label.appendChild(input);
          const pay = deps.makeButton('Vérifier et clôturer', 'button button-primary action-button', () => complete(withdrawal, card));
          pay.dataset.farmPay = '';
          controls.append(copyWallet, copyAmount, label, pay);
        } else {
          const paid = document.createElement('p'); paid.className = 'muted';
          paid.textContent = `Paiement vérifié${withdrawal.paidAt ? ` le ${deps.formatDate(withdrawal.paidAt)}` : ''}. Aucune autre action requise.`;
          controls.appendChild(paid);
        }
        card.append(main, controls); list.appendChild(card);
      });
    }
    function bindEvents() {
      byId('farm-live-rate-form')?.addEventListener('submit', saveLiveRate);
      byId('farm-rate-draft-form')?.addEventListener('submit', saveRateDraft);
      byId('farm-withdrawals-filter').addEventListener('change', render);
      byId('farm-withdrawals-refresh').addEventListener('click', () => load().catch(() => {}));
      window.setInterval(() => {
        if (!byId('section-farm').classList.contains('hidden') && state.loaded && !state.saving) load({ quiet: true }).catch(() => {});
      }, 30000);
    }
    return { load, reset, render, showError, bindEvents, get loaded() { return state.loaded; }, get saving() { return Boolean(state.saving); } };
  }
  window.FitiaFarmAdmin = { create: createFarmAdmin };
})();
