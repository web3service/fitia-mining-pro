/* FITIA STORE — gestion mobile du catalogue public. */
(() => {
  'use strict';

  const CATEGORY_LABELS = {
    electronics: 'Électronique', fashion: 'Mode', home: 'Maison', beauty: 'Beauté',
    sports: 'Sports', toys: 'Jouets', automotive: 'Automobile', grocery: 'Épicerie',
    jewelry: 'Bijoux', office: 'Bureau', other: 'Autres'
  };
  const LANGUAGES = ['fr', 'en', 'de', 'zh', 'sg'];

  function createStoreAdmin(deps) {
    const state = {
      manifest: null,
      revision: '',
      saving: false,
      editingId: null,
      editorImage: '',
      editorAssetData: {},
      editorSession: 0,
      assetUploads: 0
    };
    const { byId, api, clone } = deps;
    const catalog = window.FitiaStoreCatalog;
    const localized = (value) => value?.fr || value?.en || '';

    function reset() {
      state.manifest = null;
      state.revision = '';
      state.editingId = null;
      state.editorSession += 1;
      state.assetUploads = 0;
    }

    async function load() {
      const data = await api('/api/admin/store-products');
      state.manifest = data.manifest;
      state.revision = data.revision;
      return data;
    }

    function showError(error) {
      if (!error || error.code === 'AUTH_REQUIRED') return;
      byId('store-list-error').textContent = error.message;
      byId('store-list-error').classList.remove('hidden');
    }

    function productStatus(item, now = Date.now()) {
      if (!item.active) return 'disabled';
      if (item.startsAt && Date.parse(item.startsAt) > now) return 'scheduled';
      if (item.expiresAt && Date.parse(item.expiresAt) <= now) return 'expired';
      if (item.stock === 0) return 'soldout';
      return 'active';
    }

    function statusLabel(status) {
      return ({ active: 'En vente', disabled: 'Masqué', scheduled: 'Programmé', expired: 'Expiré', soldout: 'Épuisé' })[status] || status;
    }

    function renderCountryOptions() {
      const select = byId('store-delivery-country');
      if (!select || select.options.length > 1 || !catalog) return;
      const countries = catalog.COUNTRY_CODES.map((code) => ({
        code,
        name: catalog.countryName(code, 'fr')
      })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      countries.forEach(({ code, name }) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${name} (${code})`;
        select.appendChild(option);
      });
    }

    function renderDeliveryCountries() {
      const list = byId('store-country-list');
      if (!list || !state.manifest || !catalog) return;
      const countries = state.manifest.shippingCountries || [];
      list.textContent = '';
      byId('store-country-count').textContent = `${countries.length} pays`;
      byId('store-country-empty').classList.toggle('hidden', countries.length > 0);
      const select = byId('store-delivery-country');
      Array.from(select.options).forEach((option) => {
        if (option.value) option.disabled = countries.includes(option.value);
      });
      byId('store-add-country').disabled = !select.value || countries.includes(select.value);
      countries.forEach((code) => {
        const name = catalog.countryName(code, 'fr');
        const chip = document.createElement('span');
        chip.className = 'store-country-chip';
        chip.dataset.countryCode = code;
        const flag = document.createElement('img');
        flag.className = 'store-country-chip-flag';
        flag.src = `/assets/flags/${code.toLowerCase()}.svg`;
        flag.alt = '';
        flag.width = 30;
        flag.height = 22;
        flag.loading = 'lazy';
        flag.setAttribute('aria-hidden', 'true');
        const label = document.createElement('strong');
        label.textContent = name;
        const remove = deps.makeButton('×', 'store-country-remove', async () => {
          const next = clone(state.manifest);
          next.shippingCountries = (next.shippingCountries || []).filter((country) => country !== code);
          await save(next, 'Pays de livraison mis à jour.');
        });
        remove.type = 'button';
        remove.setAttribute('aria-label', `Retirer ${name}`);
        chip.append(flag, label, remove);
        list.appendChild(chip);
      });
    }

    async function addDeliveryCountry() {
      const select = byId('store-delivery-country');
      const code = select.value;
      if (!code || !catalog.COUNTRY_CODES.includes(code) || state.saving || (state.manifest.shippingCountries || []).includes(code)) return;
      const next = clone(state.manifest);
      next.shippingCountries = catalog.normalizeShippingCountries([...(next.shippingCountries || []), code]);
      const success = await save(next, 'Pays de livraison mis à jour.');
      if (success) select.value = '';
    }

    function render() {
      if (!state.manifest) return;
      byId('store-enabled').checked = state.manifest.enabled;
      byId('store-enabled-label').textContent = state.manifest.enabled ? 'Activé' : 'Désactivé';
      byId('save-store-product').textContent = deps.getMode() === 'local' ? 'Enregistrer en local' : 'Publier le produit';
      byId('store-stat-total').textContent = String(state.manifest.products.length);
      byId('store-stat-active').textContent = String(state.manifest.products.filter((item) => productStatus(item) === 'active').length);
      byId('store-stat-stock').textContent = String(state.manifest.products.reduce((sum, item) => sum + item.stock, 0));
      renderDeliveryCountries();
      const search = byId('store-search').value.trim().toLowerCase();
      const source = byId('store-source-filter').value;
      const token = byId('store-token-filter').value;
      const items = state.manifest.products.filter((item) => {
        if (source !== 'all' && item.sourceType !== source) return false;
        if (token !== 'all' && item.priceToken !== token) return false;
        if (!search) return true;
        return [item.id, item.sellerName, ...Object.values(item.name), ...Object.values(item.description)]
          .join(' ').toLowerCase().includes(search);
      });
      const list = byId('store-products-list');
      list.textContent = '';
      byId('store-products-empty').classList.toggle('hidden', items.length > 0);
      items.forEach((item) => {
        const status = productStatus(item);
        const row = document.createElement('article');
        row.className = 'announcement-row store-admin-row';
        row.dataset.storeProductId = item.id;
        const visual = document.createElement('div');
        visual.className = 'store-admin-visual';
        const image = document.createElement('img');
        image.src = item.image ? `/${item.image}` : '/assets/icon-192.png';
        image.alt = '';
        image.width = 72;
        image.height = 72;
        visual.appendChild(image);
        const main = document.createElement('div');
        main.className = 'announcement-main';
        const meta = document.createElement('div');
        meta.className = 'announcement-meta';
        const category = document.createElement('span');
        category.className = 'category-badge category-information';
        category.textContent = CATEGORY_LABELS[item.category] || item.category;
        const supply = document.createElement('span');
        supply.className = 'category-badge category-event';
        supply.textContent = item.sourceType === 'own' ? 'Stock propre' : 'Dropshipping';
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-pill status-${status === 'active' ? 'active' : status === 'scheduled' ? 'scheduled' : 'disabled'}`;
        statusBadge.textContent = statusLabel(status);
        meta.append(category, supply, statusBadge);
        const title = document.createElement('h3');
        title.textContent = localized(item.name);
        const description = document.createElement('p');
        description.textContent = localized(item.description) || item.deliveryEstimate;
        const details = document.createElement('div');
        details.className = 'announcement-dates store-admin-details';
        const price = document.createElement('strong');
        price.textContent = `${item.price} ${item.priceToken}`;
        const stock = document.createElement('span');
        stock.textContent = `Stock affiché : ${item.stock}`;
        const seller = document.createElement('span');
        seller.textContent = `Vendeur : ${item.sellerName}`;
        details.append(price, stock, seller);
        main.append(meta, title, description, details);
        const actions = document.createElement('div');
        actions.className = 'announcement-actions';
        actions.append(
          deps.makeButton('Modifier', 'button button-quiet action-button', () => openEditor(item)),
          deps.makeButton('Dupliquer', 'button button-quiet action-button', () => openEditor(item, true)),
          deps.makeButton('Supprimer', 'button button-danger action-button', () => deleteProduct(item))
        );
        row.append(visual, main, actions);
        list.appendChild(row);
      });
    }

    async function save(nextManifest, successMessage) {
      if (state.saving || !state.manifest) return false;
      state.saving = true;
      deps.setLoading(true, deps.getMode() === 'github' ? 'Publication du catalogue…' : 'Enregistrement local…');
      try {
        const data = await api('/api/admin/store-products', {
          method: 'PUT', body: { manifest: nextManifest, revision: state.revision }
        });
        state.manifest = data.manifest;
        state.revision = data.revision;
        deps.updateSource(data);
        render();
        deps.setConnection('online');
        deps.showToast(successMessage);
        return true;
      } catch (error) {
        showError(error);
        if (error.code !== 'AUTH_REQUIRED') deps.showToast(error.message, 'error');
        return false;
      } finally {
        state.saving = false;
        deps.setLoading(false);
      }
    }

    async function deleteProduct(item) {
      if (!window.confirm(`Supprimer « ${localized(item.name)} » du catalogue ?`)) return;
      const next = clone(state.manifest);
      next.products = next.products.filter((candidate) => candidate.id !== item.id);
      await save(next, 'Produit supprimé.');
    }

    function fillLocalized(field, values = {}) {
      LANGUAGES.forEach((lang) => { byId(`store-${field}-${lang}`).value = values[lang] || ''; });
    }

    function readLocalized(field) {
      const values = {};
      LANGUAGES.forEach((lang) => {
        const value = byId(`store-${field}-${lang}`).value.trim();
        if (value) values[lang] = value;
      });
      return values;
    }

    function editorImageUrl() {
      if (!state.editorImage) return '/assets/icon-192.png';
      return state.editorAssetData[state.editorImage] || `/${state.editorImage}`;
    }

    function updatePreview() {
      byId('store-preview-name').textContent = byId('store-name-fr').value.trim() || byId('store-name-en').value.trim() || 'Nom du produit';
      byId('store-preview-description').textContent = byId('store-description-fr').value.trim() || byId('store-description-en').value.trim() || 'Description du produit';
      byId('store-preview-price').textContent = `${byId('store-price').value.trim() || '0'} ${byId('store-price-token').value}`;
      byId('store-preview-seller').textContent = byId('store-seller-name').value.trim() || 'Vendeur';
      byId('store-preview-source').textContent = byId('store-source-type').value === 'own' ? 'STOCK PROPRE' : 'DROPSHIPPING';
      const image = byId('store-preview-image');
      image.src = editorImageUrl();
      byId('store-image-status').textContent = state.editorImage ? 'Photo enregistrée' : 'Logo FITIA par défaut';
      byId('store-image-remove').classList.toggle('hidden', !state.editorImage);
    }

    function openEditor(item = null, duplicate = false) {
      state.editorSession += 1;
      state.assetUploads = 0;
      state.editingId = item && !duplicate ? item.id : null;
      state.editorImage = item?.image || '';
      state.editorAssetData = {};
      byId('store-product-form').reset();
      byId('store-editor-error').textContent = '';
      byId('store-image-upload-status').textContent = '';
      byId('store-source-type').value = item?.sourceType || 'own';
      byId('store-category').value = item?.category || 'electronics';
      byId('store-active').checked = item ? item.active : true;
      fillLocalized('name', item?.name || {});
      fillLocalized('description', item?.description || {});
      if (duplicate && byId('store-name-fr').value) byId('store-name-fr').value = `${byId('store-name-fr').value} — copie`.slice(0, 100);
      byId('store-seller-id').value = item?.sellerId || 'fitia-store';
      byId('store-seller-name').value = item?.sellerName || 'FITIA STORE';
      byId('store-seller-contact').value = item?.sellerContact || '';
      byId('store-payment-address').value = item?.paymentAddress || '';
      byId('store-price-token').value = item?.priceToken || 'USDT';
      byId('store-price').value = item?.price || '';
      byId('store-shipping-fee').value = item?.shippingFee || '0';
      byId('store-stock').value = String(item?.stock ?? 1);
      byId('store-delivery-estimate').value = item?.deliveryEstimate || '';
      byId('store-starts-at').value = item ? deps.toInputDate(item.startsAt) : '';
      byId('store-expires-at').value = item ? deps.toInputDate(item.expiresAt) : '';
      byId('store-editor-title').textContent = state.editingId ? 'Modifier le produit' : duplicate ? 'Dupliquer le produit' : 'Nouveau produit';
      updatePreview();
      byId('store-editor-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
      byId('store-name-fr').focus();
    }

    function closeEditor() {
      byId('store-editor-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
      state.editingId = null;
      state.editorSession += 1;
      state.assetUploads = 0;
      byId('store-editor-error').textContent = '';
    }

    async function handleImageSelection(event) {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      const session = state.editorSession;
      state.assetUploads += 1;
      byId('save-store-product').disabled = true;
      byId('store-image-upload').disabled = true;
      byId('store-image-upload-status').textContent = 'Optimisation et enregistrement sécurisé de la photo…';
      try {
        const image = await deps.optimizeImage(file, 'product');
        const result = await api('/api/admin/store-assets', {
          method: 'POST', body: { data: image.data, contentType: image.contentType }
        });
        const assetPath = result.asset && result.asset.path;
        if (typeof assetPath !== 'string' || !/^assets\/store\/product-[a-f0-9]{24}\.(png|jpg|webp)$/.test(assetPath)) {
          throw new Error('Le serveur a renvoyé un chemin de photo invalide.');
        }
        if (session !== state.editorSession) return;
        state.editorImage = assetPath;
        state.editorAssetData[assetPath] = image.dataUrl;
        byId('store-image-upload-status').textContent = 'Photo enregistrée. Publiez le produit pour l’associer au catalogue.';
        updatePreview();
      } catch (error) {
        if (session === state.editorSession) {
          byId('store-image-upload-status').textContent = error.message;
          deps.showToast(error.message, 'error');
        }
      } finally {
        if (session === state.editorSession) {
          state.assetUploads = Math.max(0, state.assetUploads - 1);
          byId('save-store-product').disabled = false;
          byId('store-image-upload').disabled = false;
        }
      }
    }

    async function submitEditor(event) {
      event.preventDefault();
      if (state.assetUploads) {
        byId('store-editor-error').textContent = 'Attendez la fin de l’enregistrement de la photo.';
        return;
      }
      const startsAt = deps.fromInputDate(byId('store-starts-at').value);
      const expiresAt = deps.fromInputDate(byId('store-expires-at').value);
      if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
        byId('store-editor-error').textContent = 'La date de fin doit être postérieure à la date de début.';
        return;
      }
      const item = {
        id: state.editingId || deps.generateId('product'),
        active: byId('store-active').checked,
        sourceType: byId('store-source-type').value,
        category: byId('store-category').value,
        name: readLocalized('name'),
        description: readLocalized('description'),
        image: state.editorImage,
        sellerId: byId('store-seller-id').value.trim().toLowerCase(),
        sellerName: byId('store-seller-name').value.trim(),
        sellerContact: byId('store-seller-contact').value.trim(),
        paymentAddress: byId('store-payment-address').value.trim(),
        priceToken: byId('store-price-token').value,
        price: byId('store-price').value.trim().replace(',', '.'),
        shippingFee: byId('store-shipping-fee').value.trim().replace(',', '.') || '0',
        stock: Number(byId('store-stock').value),
        deliveryEstimate: byId('store-delivery-estimate').value.trim()
      };
      if (startsAt) item.startsAt = startsAt;
      if (expiresAt) item.expiresAt = expiresAt;
      const next = clone(state.manifest);
      if (state.editingId) {
        const index = next.products.findIndex((candidate) => candidate.id === state.editingId);
        if (index < 0) {
          byId('store-editor-error').textContent = 'Ce produit n’existe plus. Rechargez le catalogue.';
          return;
        }
        next.products[index] = item;
      } else next.products.push(item);
      const success = await save(next, state.editingId ? 'Produit mis à jour.' : 'Produit ajouté au catalogue.');
      if (success) closeEditor();
    }

    function bindEvents() {
      renderCountryOptions();
      byId('store-add-country').addEventListener('click', addDeliveryCountry);
      byId('store-delivery-country').addEventListener('change', (event) => {
        byId('store-add-country').disabled = !event.target.value;
      });
      byId('store-add-country').disabled = true;
      document.querySelectorAll('[data-new-store-product]').forEach((button) => button.addEventListener('click', () => openEditor()));
      document.querySelectorAll('[data-close-store-editor]').forEach((button) => button.addEventListener('click', closeEditor));
      byId('store-product-form').addEventListener('submit', submitEditor);
      byId('store-product-form').addEventListener('input', updatePreview);
      byId('store-product-form').addEventListener('change', updatePreview);
      byId('store-image-upload').addEventListener('click', () => byId('store-image-file').click());
      byId('store-image-file').addEventListener('change', handleImageSelection);
      byId('store-image-remove').addEventListener('click', () => {
        state.editorImage = '';
        byId('store-image-upload-status').textContent = '';
        updatePreview();
      });
      ['store-search', 'store-source-filter', 'store-token-filter'].forEach((id) => {
        byId(id).addEventListener('input', render);
        byId(id).addEventListener('change', render);
      });
      byId('store-enabled').addEventListener('change', async (event) => {
        const next = clone(state.manifest);
        next.enabled = event.target.checked;
        const success = await save(next, next.enabled ? 'FITIA STORE activé.' : 'FITIA STORE désactivé.');
        if (!success) render();
      });
    }

    return {
      load, reset, render, showError, bindEvents, closeEditor,
      get saving() { return state.saving; },
      get loaded() { return Boolean(state.manifest); }
    };
  }

  window.FitiaStoreAdmin = { create: createStoreAdmin };
})();
