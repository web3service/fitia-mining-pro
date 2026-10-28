/* FITIA STORE — commandes privées et suivi vendeur, sans exposition publique. */
(() => {
  'use strict';

  const STATUS_LABELS = {
    paid: 'Payée · à préparer',
    preparing: 'En préparation',
    shipped: 'Expédiée',
    delivered: 'Livrée'
  };
  const STATUS_RANK = { paid: 0, preparing: 1, shipped: 2, delivered: 3 };

  function createOrdersAdmin(deps) {
    const state = { orders: [], loading: null, saving: '', loaded: false };
    const { byId, api } = deps;
    const localized = (value) => typeof value === 'string' ? value : value?.fr || value?.en || '';

    function reset() {
      state.orders = [];
      state.loaded = false;
      state.saving = '';
      const list = byId('orders-list');
      if (list) list.textContent = '';
      const error = byId('orders-list-error');
      if (error) { error.textContent = ''; error.classList.add('hidden'); }
    }

    function showError(error) {
      if (!error || error.code === 'AUTH_REQUIRED') return;
      byId('orders-list-error').textContent = error.message;
      byId('orders-list-error').classList.remove('hidden');
    }

    async function load(options = {}) {
      if (state.loading) return state.loading;
      state.loading = (async () => {
        if (!options.quiet) deps.setLoading(true, 'Chargement des commandes privées…');
        try {
          const data = await api('/api/admin/store-orders');
          state.orders = Array.isArray(data.orders) ? data.orders : [];
          state.loaded = true;
          byId('orders-list-error').classList.add('hidden');
          render();
          deps.setConnection('online');
          return data;
        } catch (error) {
          showError(error);
          if (error.code !== 'AUTH_REQUIRED') deps.showToast(error.message, 'error');
          throw error;
        } finally {
          if (!options.quiet) deps.setLoading(false);
        }
      })();
      try { return await state.loading; }
      finally { state.loading = null; }
    }

    function detail(label, value, className = '') {
      const row = document.createElement('div');
      row.className = `order-detail-row ${className}`.trim();
      const small = document.createElement('small'); small.textContent = label;
      const span = document.createElement('span'); span.textContent = value || '—';
      row.append(small, span);
      return row;
    }

    async function updateOrder(order, card) {
      if (state.saving) return;
      state.saving = order.id;
      const status = card.querySelector('[data-order-status]').value;
      const carrier = card.querySelector('[data-order-carrier]').value;
      const trackingNumber = card.querySelector('[data-order-tracking]').value;
      const button = card.querySelector('[data-order-save]');
      button.disabled = true;
      try {
        const data = await api('/api/admin/store-orders', {
          method: 'PATCH',
          body: { orderId: order.id, status, carrier, trackingNumber }
        });
        const index = state.orders.findIndex((item) => item.id === order.id);
        if (index >= 0) state.orders[index] = data.order;
        render();
        deps.showToast('Suivi de commande mis à jour.');
      } catch (error) {
        showError(error);
        if (error.code !== 'AUTH_REQUIRED') deps.showToast(error.message, 'error');
      } finally {
        state.saving = '';
        button.disabled = false;
      }
    }

    function render() {
      const list = byId('orders-list');
      if (!list) return;
      const filter = byId('orders-status-filter').value;
      const visible = state.orders.filter((order) => filter === 'all' || order.status === filter);
      list.textContent = '';
      byId('orders-empty').classList.toggle('hidden', visible.length > 0);
      byId('orders-stat-paid').textContent = String(state.orders.filter((order) => order.status === 'paid').length);
      byId('orders-stat-preparing').textContent = String(state.orders.filter((order) => order.status === 'preparing').length);
      byId('orders-stat-shipped').textContent = String(state.orders.filter((order) => order.status === 'shipped').length);
      byId('orders-stat-delivered').textContent = String(state.orders.filter((order) => order.status === 'delivered').length);

      visible.forEach((order) => {
        const card = document.createElement('article');
        card.className = 'announcement-row seller-order-card';
        card.dataset.orderId = order.id;
        const main = document.createElement('div');
        main.className = 'announcement-main seller-order-main';
        const meta = document.createElement('div');
        meta.className = 'announcement-meta';
        const badge = document.createElement('span');
        badge.className = `status-pill seller-order-status status-${order.status === 'paid' ? 'scheduled' : order.status === 'delivered' ? 'active' : 'scheduled'}`;
        badge.textContent = STATUS_LABELS[order.status] || order.status;
        const reference = document.createElement('strong'); reference.textContent = order.orderNumber;
        meta.append(badge, reference);
        const title = document.createElement('h3');
        title.textContent = order.items.map((item) => `${item.quantity} × ${localized(item.name)}`).join(' · ');
        const dates = document.createElement('p');
        dates.className = 'muted';
        dates.textContent = `Créée le ${deps.formatDate(order.createdAt)} · ${order.total} ${order.token}`;
        const publicDetails = document.createElement('div');
        publicDetails.className = 'seller-order-details';
        publicDetails.append(
          detail('Client / wallet', order.buyerAddress),
          detail('Transaction', order.txHash),
          detail('Vendeur', `${order.sellerName}${order.sellerContact ? ` · ${order.sellerContact}` : ''}`)
        );
        const delivery = document.createElement('div');
        delivery.className = 'seller-order-delivery';
        const deliveryTitle = document.createElement('strong'); deliveryTitle.textContent = 'Livraison privée';
        const deliveryGrid = document.createElement('div');
        deliveryGrid.className = 'seller-order-details';
        deliveryGrid.append(
          detail('Nom', order.delivery.name),
          detail('Téléphone', order.delivery.phone),
          detail('Adresse', `${order.delivery.address}\n${order.delivery.city}, ${order.delivery.country}`),
          detail('Note', order.delivery.notes)
        );
        delivery.append(deliveryTitle, deliveryGrid);
        main.append(meta, title, dates, publicDetails, delivery);

        const controls = document.createElement('div');
        controls.className = 'seller-order-controls';
        const statusLabel = document.createElement('label');
        statusLabel.textContent = 'Statut du suivi';
        const status = document.createElement('select');
        status.dataset.orderStatus = '';
        const currentRank = STATUS_RANK[order.status];
        Object.keys(STATUS_RANK).filter((key) => STATUS_RANK[key] >= currentRank).forEach((key) => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = STATUS_LABELS[key];
          status.appendChild(option);
        });
        status.value = order.status;
        statusLabel.appendChild(status);
        const carrierLabel = document.createElement('label');
        carrierLabel.textContent = 'Transporteur (facultatif)';
        const carrier = document.createElement('input');
        carrier.dataset.orderCarrier = '';
        carrier.maxLength = 80;
        carrier.value = order.carrier || '';
        carrierLabel.appendChild(carrier);
        const trackingLabel = document.createElement('label');
        trackingLabel.textContent = 'Numéro de suivi (facultatif)';
        const tracking = document.createElement('input');
        tracking.dataset.orderTracking = '';
        tracking.maxLength = 120;
        tracking.value = order.trackingNumber || '';
        trackingLabel.appendChild(tracking);
        const save = deps.makeButton('Enregistrer le suivi', 'button button-primary action-button', () => updateOrder(order, card));
        save.dataset.orderSave = '';
        controls.append(statusLabel, carrierLabel, trackingLabel, save);
        card.append(main, controls);
        list.appendChild(card);
      });
    }

    function bindEvents() {
      byId('orders-status-filter').addEventListener('change', render);
      byId('orders-refresh').addEventListener('click', () => load().catch(() => {}));
      window.setInterval(() => {
        if (!byId('section-orders').classList.contains('hidden') && state.loaded && !state.saving) {
          load({ quiet: true }).catch(() => {});
        }
      }, 30000);
    }

    return {
      load, reset, render, showError, bindEvents,
      get loaded() { return state.loaded; },
      get saving() { return Boolean(state.saving); }
    };
  }

  window.FitiaOrdersAdmin = { create: createOrdersAdmin };
})();
