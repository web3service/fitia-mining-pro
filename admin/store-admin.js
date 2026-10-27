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
      assetUploads: 0,
      inventory: { products: [], awaitingInventory: 0, completedOrders: 0 },
      assetStorage: { provider: 'supabase', configured: false },
      editorProductId: '',
      editorDigital: null,
      editorFile: null,
      preparing: false
    };
    const { byId, api, clone } = deps;
    const localized = (value) => value?.fr || value?.en || '';

    function reset() {
      state.manifest = null;
      state.revision = '';
      state.editingId = null;
      state.editorSession += 1;
      state.assetUploads = 0;
      state.inventory = { products: [], awaitingInventory: 0, completedOrders: 0 };
      state.assetStorage = { provider: 'supabase', configured: false };
      state.editorProductId = '';
      state.editorDigital = null;
      state.editorFile = null;
      state.preparing = false;
    }

    async function load() {
      const [data, digital] = await Promise.all([
        api('/api/admin/store-products'),
        api('/api/admin/digital-inventory')
      ]);
      state.manifest = data.manifest;
      state.revision = data.revision;
      state.inventory = digital.inventory || { products: [], awaitingInventory: 0, completedOrders: 0 };
      state.assetStorage = digital.assetStorage || { provider: 'supabase', configured: false };
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

    function render() {
      if (!state.manifest) return;
      byId('store-enabled').checked = state.manifest.enabled;
      byId('store-enabled-label').textContent = state.manifest.enabled ? 'Activé' : 'Désactivé';
      byId('save-store-product').textContent = deps.getMode() === 'local' ? 'Enregistrer en local' : 'Publier le produit';
      byId('store-stat-total').textContent = String(state.manifest.products.length);
      byId('store-stat-active').textContent = String(state.manifest.products.filter((item) => productStatus(item) === 'active').length);
      byId('store-stat-stock').textContent = String(state.manifest.products.reduce((sum, item) => sum + item.stock, 0));
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
        const productType = document.createElement('span');
        productType.className = 'category-badge category-referral';
        productType.textContent = ({ physical: 'Physique', download: 'Téléchargement', license: 'Licence' })[item.type || 'physical'];
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-pill status-${status === 'active' ? 'active' : status === 'scheduled' ? 'scheduled' : 'disabled'}`;
        statusBadge.textContent = statusLabel(status);
        meta.append(category, supply, productType, statusBadge);
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
        if ((item.type || 'physical') !== 'physical') {
          const inventory = state.inventory.products.find((entry) => entry.productId === item.id);
          stock.textContent = item.type === 'license'
            ? `Licences : ${inventory?.availableLicenses || 0} disponibles · ${inventory?.assignedLicenses || 0} attribuées`
            : `Fichier : ${item.digital?.fileName || 'à enregistrer'}`;
        }
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

    function inventorySummary(productId) {
      return state.inventory.products.find((entry) => entry.productId === productId) || null;
    }

    function renderStorageStatus(type) {
      const element = byId('store-digital-storage-status');
      if (type === 'license') {
        element.textContent = 'Les licences restent chiffrées dans le coffre ; aucun bucket de fichiers n’est nécessaire.';
        return;
      }
      if (state.assetStorage?.provider === 'local') {
        element.textContent = 'Mode local : fichier chiffré sur ce serveur, hors du catalogue et des routes statiques.';
      } else if (state.assetStorage?.configured) {
        element.textContent = 'Stockage externe privé Supabase configuré : aucun octet du fichier, même chiffré, n’est écrit sur GitHub.';
      } else {
        element.textContent = 'Stockage externe privé non connecté. Le dépôt de fichiers est bloqué ; aucun repli vers GitHub n’est autorisé.';
      }
    }

    function syncProductType(force = false) {
      const type = byId('store-product-type').value;
      const digital = type !== 'physical';
      byId('store-digital-inventory-fields').classList.toggle('hidden', !digital);
      byId('store-download-fields').classList.toggle('hidden', type !== 'download');
      byId('store-license-fields').classList.toggle('hidden', type !== 'license');
      byId('store-shipping-fee-field').classList.toggle('hidden', digital);
      byId('store-shipping-fee').required = !digital;
      byId('store-stock').readOnly = type === 'license';
      byId('store-stock-hint').textContent = type === 'license'
        ? 'Calculé depuis les licences réellement disponibles dans le coffre.'
        : type === 'download' ? 'Stock public indicatif : actualisez-le après les ventes, comme pour un produit physique.' : 'Actualisez-le après les ventes et auprès du fournisseur.';
      if (digital) {
        byId('store-shipping-fee').value = '0';
        if (force || !byId('store-delivery-estimate').value.trim()) byId('store-delivery-estimate').value = 'Instant after confirmed payment';
      }
      const summary = inventorySummary(state.editorProductId);
      byId('store-license-stock-status').textContent = type === 'license'
        ? `${summary?.availableLicenses || 0} disponibles · ${summary?.assignedLicenses || 0} déjà attribuées` : '';
      byId('store-digital-file-status').textContent = type === 'download'
        ? state.editorFile ? `Prêt à chiffrer : ${state.editorFile.name} (${state.editorFile.size} octets)`
          : state.editorDigital ? `Fichier enregistré : ${state.editorDigital.fileName}` : 'Sélectionnez le fichier à vendre avant la publication.' : '';
      renderStorageStatus(type);
      updatePreview();
    }

    function handleDigitalFileSelection(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      if (!state.assetStorage?.configured) {
        state.editorFile = null;
        byId('store-digital-file').value = '';
        byId('store-editor-error').textContent = 'Connectez d’abord le stockage externe privé. Aucun fichier ne sera envoyé vers GitHub.';
        return;
      }
      if (!file.size || file.size > 3 * 1024 * 1024) {
        state.editorFile = null;
        byId('store-digital-file').value = '';
        byId('store-editor-error').textContent = 'Le fichier numérique doit contenir entre 1 octet et 3 Mo.';
        return;
      }
      state.editorFile = file;
      byId('store-editor-error').textContent = '';
      syncProductType();
    }

    function readFileBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Impossible de lire ce fichier sur le téléphone.'));
        reader.onload = () => {
          const result = String(reader.result || '');
          const marker = result.indexOf(';base64,');
          if (marker < 0) reject(new Error('Le fichier ne peut pas être préparé.'));
          else resolve(result.slice(marker + 8));
        };
        reader.readAsDataURL(file);
      });
    }

    async function prepareDigitalInventory(item) {
      if (item.type === 'download') {
        if (state.editorFile) {
          if (!state.assetStorage?.configured) throw new Error('Le stockage externe privé n’est pas connecté. Aucun repli vers GitHub n’est autorisé.');
          const data = await readFileBase64(state.editorFile);
          const result = await api('/api/admin/digital-inventory', {
            method: 'POST',
            body: {
              productType: 'download', productId: item.id, data,
              fileName: state.editorFile.name,
              contentType: state.editorFile.type || 'application/octet-stream'
            }
          });
          state.inventory = result.inventory;
          state.editorDigital = result.asset;
          state.editorFile = null;
          byId('store-digital-file').value = '';
        }
        if (!state.editorDigital?.id) throw new Error('Enregistrez un fichier avant de publier ce produit.');
        item.digital = {
          assetId: state.editorDigital.id,
          fileName: state.editorDigital.fileName,
          contentType: state.editorDigital.contentType,
          size: state.editorDigital.size
        };
        return;
      }
      if (item.type === 'license') {
        const keys = byId('store-license-keys').value.split(/[\r\n]+/).map((key) => key.trim()).filter(Boolean);
        if (keys.length) {
          const result = await api('/api/admin/digital-inventory', {
            method: 'POST', body: { productType: 'license', productId: item.id, keys }
          });
          state.inventory = result.inventory;
          byId('store-license-keys').value = '';
        }
        const summary = inventorySummary(item.id);
        if (!summary || summary.availableLicenses + summary.assignedLicenses < 1) {
          throw new Error('Ajoutez au moins une clé de licence avant de publier ce produit.');
        }
        item.stock = summary.availableLicenses;
        syncProductType();
      }
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
      state.editorProductId = state.editingId || deps.generateId('product');
      state.editorDigital = item && !duplicate && item.digital ? {
        id: item.digital.assetId, fileName: item.digital.fileName,
        contentType: item.digital.contentType, size: item.digital.size
      } : null;
      state.editorFile = null;
      state.editorImage = item?.image || '';
      state.editorAssetData = {};
      byId('store-product-form').reset();
      byId('store-editor-error').textContent = '';
      byId('store-image-upload-status').textContent = '';
      byId('store-digital-file').value = '';
      byId('store-license-keys').value = '';
      byId('store-product-type').value = item?.type || 'physical';
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
      syncProductType(true);
      byId('store-editor-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
      byId('store-name-fr').focus();
    }

    function closeEditor() {
      if (state.preparing) return;
      byId('store-editor-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
      state.editingId = null;
      state.editorProductId = '';
      state.editorDigital = null;
      state.editorFile = null;
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
      if (state.preparing || state.saving) return;
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
      const type = byId('store-product-type').value;
      const item = {
        id: state.editorProductId,
        active: byId('store-active').checked,
        sourceType: byId('store-source-type').value,
        type,
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
        shippingFee: type === 'physical' ? byId('store-shipping-fee').value.trim().replace(',', '.') || '0' : '0',
        stock: Number(byId('store-stock').value),
        deliveryEstimate: byId('store-delivery-estimate').value.trim()
      };
      if (startsAt) item.startsAt = startsAt;
      if (expiresAt) item.expiresAt = expiresAt;
      if (type !== 'physical') {
        state.preparing = true;
        byId('save-store-product').disabled = true;
        deps.setLoading(true, type === 'download' ? 'Chiffrement et enregistrement du fichier…' : 'Enregistrement chiffré des licences…');
        try {
          await prepareDigitalInventory(item);
          byId('store-stock').value = String(item.stock);
        } catch (error) {
          byId('store-editor-error').textContent = error.message;
          return;
        } finally {
          state.preparing = false;
          byId('save-store-product').disabled = false;
          deps.setLoading(false);
        }
      }
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
      document.querySelectorAll('[data-new-store-product]').forEach((button) => button.addEventListener('click', () => openEditor()));
      document.querySelectorAll('[data-close-store-editor]').forEach((button) => button.addEventListener('click', closeEditor));
      byId('store-product-form').addEventListener('submit', submitEditor);
      byId('store-product-form').addEventListener('input', updatePreview);
      byId('store-product-form').addEventListener('change', updatePreview);
      byId('store-image-upload').addEventListener('click', () => byId('store-image-file').click());
      byId('store-image-file').addEventListener('change', handleImageSelection);
      byId('store-product-type').addEventListener('change', () => syncProductType());
      byId('store-digital-file').addEventListener('change', handleDigitalFileSelection);
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
