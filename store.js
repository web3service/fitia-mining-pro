/* FITIA STORE — catalogue public, panier local et paiement direct au vendeur.
 * Les informations de livraison restent en mémoire et dans le formulaire.
 * Elles ne sont jamais écrites dans localStorage, dans le manifeste ou sur Polygon.
 */
(() => {
  'use strict';

  const MANIFEST_URL = 'https://raw.githubusercontent.com/web3service/fitia-mining-pro/main/store-products.json';
  const CACHE_KEY = 'fitia_store_public_catalog_v1';
  const CART_PREFIX = 'fitia_store_cart_v1:';
  const ORDERS_PREFIX = 'fitia_store_orders_v1:';
  const ORDER_API_URL = 'https://fitia-mining-pro.vercel.app/api/store-orders';
  const MAX_ORDERS = 30;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const COPY = {
    en: {
      tagline: 'Physical products, direct crypto payments.', privateDelivery: 'Delivery details stay off-chain',
      myOrders: 'My orders', refresh: 'Refresh', search: 'Search products…', allSources: 'All fulfillment',
      ownStock: 'Own stock', emptyTitle: 'No products available',
      cartTitle: 'Your cart', cartEmpty: 'Your cart is empty.', subtotal: 'Subtotal', delivery: 'Delivery', total: 'Total',
      checkout: 'DELIVERY & PAYMENT', clearCart: 'Clear cart', singleSeller: 'One seller, one crypto and one receiving address per payment.',
      checkoutTitle: 'Delivery & payment', fullName: 'Full name', phone: 'Phone', country: 'Country', city: 'City',
      postalAddress: 'Full postal address', deliveryNotes: 'Delivery note (optional)',
      consent: 'I understand that the crypto payment is irreversible and that my delivery details will be sent privately to the seller for this order.',
      shippingPrivacy: 'Delivery details are encrypted in the private order service. They are never written to Polygon, GitHub or local order history.',
      payNow: 'PAY WITH PIN', receiptTitle: 'Order status', shareRequired: 'After payment verification, your order is sent automatically. No receipt or delivery details need to be shared manually.',
      done: 'Done', ordersTitle: 'My orders',
      ordersPrivacy: 'Private tracking is linked to your wallet. Delivery addresses are never saved in local order history.', ordersEmpty: 'No store orders yet.',
      own: 'OWN STOCK', dropshipping: 'DROPSHIPPING', outOfStock: 'SOLD OUT', add: 'ADD TO CART', added: 'Added to cart.',
      stock: 'In stock', pieces: 'units', remove: 'Remove', differentSeller: 'Your cart already contains another seller, crypto or receiving address. Clear it before adding this product.',
      storeClosed: 'FITIA STORE is not open yet. Please check back soon.', offline: 'Catalog update failed. Payment requires a fresh online verification.',
      updated: 'Catalog updated.', refreshing: 'Refreshing the catalog…', noFiltered: 'No product matches these filters.',
      invalidCatalog: 'The store catalog is unavailable.', paymentReview: 'Review the current total before payment.',
      catalogChanged: 'The catalog changed. Your payment was stopped; please review the cart again.',
      shippingMissing: 'Complete all required delivery fields and accept the payment notice.',
      notReady: 'Unlock your wallet before making a store payment.', contractBlocked: 'This seller address is not allowed for payment.',
      decimalsBlocked: 'The token configuration changed. Payment was stopped for your safety.',
      paymentSent: 'Payment submitted. Polygon confirmation is in progress.',
      paymentConfirmed: 'Payment confirmed on Polygon and order sent automatically to the seller.', paymentPending: 'Transaction submitted; network confirmation is still pending.',
      paymentFailed: 'The transaction failed on-chain. No successful payment was confirmed; check your wallet before trying again.',
      pending: 'PENDING', confirmed: 'CONFIRMED', submitted: 'SUBMITTED', failed: 'FAILED', payment_pending: 'PAYMENT VERIFICATION', paid: 'PAID · SENT', preparing: 'PREPARING', shipped: 'SHIPPED', delivered: 'DELIVERED', orderRef: 'Order reference', seller: 'Seller',
      sellerContact: 'Seller contact', payment: 'Payment', transaction: 'Transaction', products: 'Products', deliveryTo: 'Delivery details',
      copyHash: 'Copy hash', copied: 'Transaction hash copied.',
      orderSent: 'Order sent automatically to the seller.', orderOffline: 'The private order service is unavailable. No new payment will be requested automatically.', orderPreparationFailed: 'The order could not be prepared. No payment was made.', trackOrder: 'TRACK ORDER', tracking: 'Tracking', carrier: 'Carrier', trackingNumber: 'Tracking number', progressPaid: 'Payment confirmed', progressPreparing: 'Preparing', progressShipped: 'Shipped', progressDelivered: 'Delivered', emptyCartConfirm: 'Clear all products from your cart?', quantity: 'Quantity', orderItems: 'items',
      cat_electronics: 'Electronics', cat_fashion: 'Fashion', cat_home: 'Home', cat_beauty: 'Beauty', cat_sports: 'Sports',
      cat_toys: 'Toys', cat_automotive: 'Automotive', cat_grocery: 'Grocery', cat_jewelry: 'Jewelry', cat_office: 'Office', cat_other: 'Other'
    },
    fr: {
      tagline: 'Produits physiques, paiement direct en crypto.', privateDelivery: 'Livraison hors blockchain',
      myOrders: 'Mes commandes', refresh: 'Actualiser', search: 'Rechercher un produit…', allSources: 'Tous les modes',
      ownStock: 'Stock propre', emptyTitle: 'Aucun produit disponible',
      cartTitle: 'Votre panier', cartEmpty: 'Votre panier est vide.', subtotal: 'Sous-total', delivery: 'Livraison', total: 'Total',
      checkout: 'LIVRAISON & PAIEMENT', clearCart: 'Vider le panier', singleSeller: 'Un vendeur, une crypto et une adresse de réception par paiement.',
      checkoutTitle: 'Livraison et paiement', fullName: 'Nom complet', phone: 'Téléphone', country: 'Pays', city: 'Ville',
      postalAddress: 'Adresse postale complète', deliveryNotes: 'Note de livraison (facultatif)',
      consent: 'Je comprends que le paiement crypto est irréversible et que mes informations de livraison seront transmises confidentiellement au vendeur pour cette commande.',
      shippingPrivacy: 'Les informations de livraison sont chiffrées dans le service privé de commandes. Elles ne sont jamais écrites sur Polygon, GitHub ou dans l’historique local.',
      payNow: 'PAYER AVEC LE PIN', receiptTitle: 'Suivi de commande', shareRequired: 'Après vérification du paiement, votre commande est transmise automatiquement. Vous n’avez aucun reçu ni coordonnée à envoyer.',
      done: 'Terminé', ordersTitle: 'Mes commandes',
      ordersPrivacy: 'Le suivi privé est lié à votre wallet. Les adresses de livraison ne sont jamais enregistrées dans l’historique local.', ordersEmpty: 'Aucune commande STORE.',
      own: 'STOCK PROPRE', dropshipping: 'DROPSHIPPING', outOfStock: 'ÉPUISÉ', add: 'AJOUTER AU PANIER', added: 'Produit ajouté au panier.',
      stock: 'En stock', pieces: 'unités', remove: 'Retirer', differentSeller: 'Votre panier contient déjà un autre vendeur, une autre crypto ou une autre adresse. Videz-le avant d’ajouter ce produit.',
      storeClosed: 'FITIA STORE n’est pas encore ouvert. Revenez bientôt.', offline: 'La mise à jour du catalogue a échoué. Le paiement exige une vérification en ligne récente.',
      updated: 'Catalogue actualisé.', refreshing: 'Actualisation du catalogue…', noFiltered: 'Aucun produit ne correspond à ces filtres.',
      invalidCatalog: 'Le catalogue STORE est indisponible.', paymentReview: 'Vérifiez le total actuel avant le paiement.',
      catalogChanged: 'Le catalogue a changé. Le paiement a été bloqué ; vérifiez de nouveau le panier.',
      shippingMissing: 'Complétez tous les champs de livraison obligatoires et acceptez l’avis de paiement.',
      notReady: 'Déverrouillez votre wallet avant de payer dans STORE.', contractBlocked: 'Cette adresse vendeur n’est pas autorisée pour le paiement.',
      decimalsBlocked: 'La configuration du jeton a changé. Le paiement a été bloqué pour votre sécurité.',
      paymentSent: 'Paiement transmis. Confirmation Polygon en cours.',
      paymentConfirmed: 'Paiement confirmé sur Polygon et commande transmise automatiquement au vendeur.', paymentPending: 'Transaction transmise ; confirmation réseau encore en attente.',
      paymentFailed: 'La transaction a échoué on-chain. Aucun paiement réussi n’est confirmé ; vérifiez votre wallet avant de réessayer.',
      pending: 'EN ATTENTE', confirmed: 'CONFIRMÉ', submitted: 'TRANSMIS', failed: 'ÉCHEC', payment_pending: 'VÉRIFICATION DU PAIEMENT', paid: 'PAYÉE · TRANSMISE', preparing: 'EN PRÉPARATION', shipped: 'EXPÉDIÉE', delivered: 'LIVRÉE', orderRef: 'Référence de commande', seller: 'Vendeur',
      sellerContact: 'Contact vendeur', payment: 'Paiement', transaction: 'Transaction', products: 'Produits', deliveryTo: 'Informations de livraison',
      copyHash: 'Copier le hash', copied: 'Hash de transaction copié.',
      orderSent: 'Commande transmise automatiquement au vendeur.', orderOffline: 'Le service privé de commandes est indisponible. Aucun nouveau paiement ne sera demandé automatiquement.', orderPreparationFailed: 'La commande n’a pas pu être préparée. Aucun paiement n’a été effectué.', trackOrder: 'SUIVRE LA COMMANDE', tracking: 'Suivi', carrier: 'Transporteur', trackingNumber: 'Numéro de suivi', progressPaid: 'Paiement confirmé', progressPreparing: 'En préparation', progressShipped: 'Expédiée', progressDelivered: 'Livrée', emptyCartConfirm: 'Retirer tous les produits du panier ?', quantity: 'Quantité', orderItems: 'articles',
      cat_electronics: 'Électronique', cat_fashion: 'Mode', cat_home: 'Maison', cat_beauty: 'Beauté', cat_sports: 'Sports',
      cat_toys: 'Jouets', cat_automotive: 'Automobile', cat_grocery: 'Épicerie', cat_jewelry: 'Bijoux', cat_office: 'Bureau', cat_other: 'Autres'
    }
  };
  COPY.de = COPY.en;
  COPY.zh = COPY.en;
  COPY.sg = COPY.en;

  const FILTER_ICON_PATHS = {
    category_all: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
    category_electronics: ['M7 2h10v20H7zM10 5h4M11 18h2'],
    category_fashion: ['M8 4 3 7l2 5 3-1v9h8v-9l3 1 2-5-5-3c-1 3-5 3-8 0Z'],
    category_home: ['M3 11 12 3l9 8M5 10v10h14V10M9 20v-6h6v6'],
    category_beauty: ['M12 3c1 4 3 6 7 7-4 1-6 3-7 7-1-4-3-6-7-7 4-1 6-3 7-7ZM19 16v5M16.5 18.5h5'],
    category_sports: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3.5 9c4 1 6 4 7 9M14 3c-1 4 1 7 6 9M5 18c2-4 5-6 10-6'],
    category_toys: ['M4 9h16v11H4zM8 9V5h8v4M8 14h3M13 14h3M9 17h6'],
    category_automotive: ['M4 14 6 8h12l2 6v5h-2v-2H6v2H4zM7 12h10M7 14h.01M17 14h.01'],
    category_grocery: ['M4 9h16l-2 11H6zM8 9l4-6 4 6M9 12v5M15 12v5'],
    category_jewelry: ['M7 4h10l4 5-9 12L3 9zM3 9h18M7 4l5 5 5-5M12 9v12'],
    category_office: ['M4 7h16v13H4zM9 7V4h6v3M4 12h16M10 12v2h4v-2'],
    category_other: ['M4 4h7l9 9-7 7-9-9zM8 8h.01'],
    source_all: ['m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5'],
    source_own: ['M3 10 12 4l9 6v10H3zM7 20v-7h10v7M8 8h8'],
    source_dropshipping: ['M3 6h11v11H3zM14 10h4l3 3v4h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z']
  };

  class StoreUiError extends Error {}

  class FitiaStoreCenter {
    constructor(app) {
      this.app = app;
      this.catalog = globalThis.FitiaStoreCatalog;
      this.manifest = { version: 1, enabled: false, products: [] };
      this.account = '';
      this.cart = [];
      this.orders = [];
      this.currentOrderId = '';
      this.ordersRefreshPromise = null;
      this.checkoutQuote = null;
      this.loaded = false;
      this.error = '';
      this.lastFetchAt = 0;
      this.refreshPromise = null;
      this.paymentInProgress = false;
      this.orderRetryDelayMs = 4000;
      this.orderMaxAttempts = 12;
      this.initialized = false;
      this.filterEventsBound = false;
    }

    t(key) {
      const lang = this.app.currentLang || 'en';
      return COPY[lang]?.[key] || COPY.en[key] || COPY.fr[key] || key;
    }

    storageGet(key) {
      try { return localStorage.getItem(key); } catch (_) { return null; }
    }

    storageSet(key, value) {
      try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
    }

    createFilterVisual(filterId, value) {
      const visual = document.createElement('span');
      visual.className = 'store-filter-visual';
      visual.setAttribute('aria-hidden', 'true');
      if (filterId === 'store-token-filter') {
        const tokens = value === 'all' ? ['USDT', 'FTA'] : [value];
        tokens.forEach((token) => {
          const image = document.createElement('img');
          image.src = token === 'USDT' ? 'assets/usdt.svg' : 'assets/fta.png';
          image.alt = '';
          image.width = 20;
          image.height = 20;
          if (tokens.length > 1) image.classList.add('store-filter-dual-logo');
          visual.appendChild(image);
        });
        if (tokens.length > 1) visual.classList.add('store-filter-dual');
        return visual;
      }
      const kind = filterId === 'store-category-filter' ? 'category' : 'source';
      const paths = FILTER_ICON_PATHS[`${kind}_${value}`] || FILTER_ICON_PATHS[`${kind}_all`] || FILTER_ICON_PATHS.category_other;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      paths.forEach((data) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', data);
        svg.appendChild(path);
      });
      visual.appendChild(svg);
      return visual;
    }

    createFilterChevron() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', 'store-filter-chevron');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'm7 9 5 5 5-5');
      svg.appendChild(path);
      return svg;
    }

    closeFilterSelectors() {
      document.querySelectorAll('.store-filter-menu').forEach((menu) => menu.classList.add('hidden'));
      document.querySelectorAll('.store-filter-trigger').forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
    }

    setupFilterSelectors() {
      ['store-category-filter', 'store-source-filter', 'store-token-filter'].forEach((filterId) => {
        const select = document.getElementById(filterId);
        if (!select) return;
        if (!select.closest('.store-custom-select')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'store-custom-select';
          wrapper.dataset.filterId = filterId;
          select.parentNode.insertBefore(wrapper, select);
          wrapper.appendChild(select);
          select.classList.add('store-filter-native');
          select.setAttribute('aria-hidden', 'true');
          select.tabIndex = -1;
          const trigger = document.createElement('button');
          trigger.type = 'button';
          trigger.id = `${filterId}-trigger`;
          trigger.className = 'store-filter-trigger';
          trigger.setAttribute('aria-expanded', 'false');
          trigger.dataset.filterLabel = select.getAttribute('aria-label') || filterId;
          const menu = document.createElement('div');
          menu.id = `${filterId}-menu`;
          menu.className = 'store-filter-menu hidden';
          trigger.setAttribute('aria-controls', menu.id);
          wrapper.append(trigger, menu);
          trigger.addEventListener('click', () => {
            const shouldOpen = menu.classList.contains('hidden');
            this.closeFilterSelectors();
            if (shouldOpen) {
              menu.classList.remove('hidden');
              trigger.setAttribute('aria-expanded', 'true');
            }
          });
          select.removeAttribute('onchange');
          select.addEventListener('change', () => {
            this.syncFilterSelector(select);
            this.renderProducts();
          });
        }
        this.syncFilterSelector(select);
      });
      if (this.filterEventsBound) return;
      this.filterEventsBound = true;
      document.addEventListener('click', (event) => {
        if (!event.target?.closest?.('.store-custom-select')) this.closeFilterSelectors();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const openTrigger = document.querySelector('.store-filter-trigger[aria-expanded="true"]');
        this.closeFilterSelectors();
        openTrigger?.focus();
      });
    }

    syncFilterSelector(select) {
      const wrapper = select.closest('.store-custom-select');
      if (!wrapper) return;
      const trigger = wrapper.querySelector('.store-filter-trigger');
      const menu = wrapper.querySelector('.store-filter-menu');
      const options = Array.from(select.options);
      const selected = options.find((option) => option.value === select.value) || options[0];
      if (!selected) return;
      trigger.textContent = '';
      const current = document.createElement('span');
      current.className = 'store-filter-current';
      const label = document.createElement('span');
      label.className = 'store-filter-current-label';
      label.textContent = selected.textContent;
      current.append(this.createFilterVisual(select.id, selected.value), label);
      trigger.append(current, this.createFilterChevron());
      trigger.setAttribute('aria-label', `${trigger.dataset.filterLabel}: ${selected.textContent}`);
      menu.textContent = '';
      options.forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `store-filter-option${option.value === selected.value ? ' selected' : ''}`;
        button.dataset.filterValue = option.value;
        button.setAttribute('aria-pressed', String(option.value === selected.value));
        const optionLabel = document.createElement('span');
        optionLabel.textContent = option.textContent;
        const check = document.createElement('span');
        check.className = 'store-filter-check';
        check.textContent = '✓';
        check.setAttribute('aria-hidden', 'true');
        button.append(this.createFilterVisual(select.id, option.value), optionLabel, check);
        button.addEventListener('click', () => {
          this.closeFilterSelectors();
          if (select.value !== option.value) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          trigger.focus();
        });
        menu.appendChild(button);
      });
    }

    applyLanguage() {
      document.querySelectorAll('[data-store-i18n]').forEach((element) => {
        element.textContent = this.t(element.dataset.storeI18n);
      });
      document.querySelectorAll('[data-store-i18n-placeholder]').forEach((element) => {
        element.placeholder = this.t(element.dataset.storeI18nPlaceholder);
      });
      const category = document.getElementById('store-category-filter');
      if (category) {
        const selected = category.value || 'all';
        category.textContent = '';
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = this.app.currentLang === 'fr' ? 'Toutes les catégories' : 'All categories';
        category.appendChild(all);
        this.catalog.CATEGORIES.forEach((value) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = this.t(`cat_${value}`);
          category.appendChild(option);
        });
        category.value = this.catalog.CATEGORIES.includes(selected) ? selected : 'all';
      }
      this.setupFilterSelectors();
    }

    init() {
      if (this.initialized) return;
      this.initialized = true;
      this.applyLanguage();
      this.loadCachedCatalog();
      this.setAccount(this.app.user);
      document.getElementById('store-checkout-form')?.addEventListener('submit', (event) => this.pay(event));
      this.render();
      void (async () => {
        await this.loadPackagedCatalog();
        await this.refresh({ force: true });
      })();
    }

    async loadPackagedCatalog() {
      if (this.loaded) return;
      try {
        const response = await fetch('store-products.json', { cache: 'no-store', credentials: 'omit' });
        if (!response.ok) return;
        this.manifest = this.catalog.validateManifest(await response.json());
        this.loaded = true;
        this.render();
      } catch (_) { /* Le catalogue embarqué est seulement un secours hors ligne. */ }
    }

    loadCachedCatalog() {
      const cached = this.storageGet(CACHE_KEY);
      if (!cached || cached.length > 3000000) return;
      try {
        this.manifest = this.catalog.validateManifest(JSON.parse(cached));
        this.loaded = true;
      } catch (_) { /* Un cache public invalide est ignoré. */ }
    }

    setAccount(address) {
      this.account = address && ethers.isAddress(address) ? address.toLowerCase() : '';
      this.clearSensitive();
      this.cart = this.loadCart();
      this.orders = this.loadOrders();
      this.render();
    }

    clearSensitive() {
      this.currentOrderId = '';
      this.ordersRefreshPromise = null;
      this.checkoutQuote = null;
      const form = document.getElementById('store-checkout-form');
      if (form) form.reset();
      const error = document.getElementById('store-checkout-error');
      if (error) error.textContent = '';
    }

    onModalsClosed() {
      this.checkoutQuote = null;
      const form = document.getElementById('store-checkout-form');
      if (form) form.reset();
      const error = document.getElementById('store-checkout-error');
      if (error) error.textContent = '';
    }

    cartKey() { return this.account ? `${CART_PREFIX}${this.account}` : ''; }
    ordersKey() { return this.account ? `${ORDERS_PREFIX}${this.account}` : ''; }

    loadCart() {
      if (!this.account) return [];
      try {
        const parsed = JSON.parse(this.storageGet(this.cartKey()) || '[]');
        if (!Array.isArray(parsed)) return [];
        const seen = new Set();
        return parsed.slice(0, 50).filter((entry) => {
          if (!entry || typeof entry.productId !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(entry.productId) || seen.has(entry.productId)) return false;
          if (!Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 99) return false;
          seen.add(entry.productId);
          return true;
        }).map((entry) => ({ productId: entry.productId, quantity: entry.quantity }));
      } catch (_) { return []; }
    }

    saveCart() {
      if (this.account) this.storageSet(this.cartKey(), JSON.stringify(this.cart));
      this.renderCartBadge();
    }

    normalizeStoredOrder(order) {
      if (!order || typeof order !== 'object') return null;
      const id = String(order.id || '');
      const orderNumber = String(order.orderNumber || '');
      if ((!UUID_PATTERN.test(id) && !/^FITS-[A-Z0-9-]{6,40}$/.test(id)) || !/^0x[a-f0-9]{64}$/i.test(order.txHash || '')) return null;
      const statuses = ['pending', 'confirmed', 'submitted', 'failed', 'payment_pending', 'paid', 'preparing', 'shipped', 'delivered'];
      return {
        id: id.slice(0, 48),
        orderNumber: /^FITS-[A-Z0-9-]{6,48}$/.test(orderNumber) ? orderNumber : (id.startsWith('FITS-') ? id : ''),
        txHash: String(order.txHash).toLowerCase(),
        createdAt: String(order.createdAt || '').slice(0, 32),
        updatedAt: String(order.updatedAt || order.createdAt || '').slice(0, 32),
        paidAt: order.paidAt ? String(order.paidAt).slice(0, 32) : null,
        status: statuses.includes(order.status) ? order.status : 'submitted',
        token: order.token === 'FTA' ? 'FTA' : 'USDT',
        total: String(order.total || '').slice(0, 40),
        totalUnits: String(order.totalUnits || '').replace(/[^0-9]/g, '').slice(0, 80),
        sellerName: String(order.sellerName || '').slice(0, 80),
        sellerContact: String(order.sellerContact || '').slice(0, 160),
        paymentAddress: String(order.paymentAddress || '').slice(0, 42),
        carrier: String(order.carrier || '').slice(0, 80),
        trackingNumber: String(order.trackingNumber || '').slice(0, 120),
        items: Array.isArray(order.items) ? order.items.slice(0, 50).map((item) => ({
          productId: String(item.productId || '').slice(0, 64),
          name: String(typeof item.name === 'string' ? item.name : this.localize(item.name)).slice(0, 100),
          quantity: Number.isSafeInteger(item.quantity) ? Math.max(1, Math.min(99, item.quantity)) : 1,
          price: String(item.price || '').slice(0, 40)
        })) : []
      };
    }

    loadOrders() {
      if (!this.account) return [];
      try {
        const parsed = JSON.parse(this.storageGet(this.ordersKey()) || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.slice(0, MAX_ORDERS).map((order) => this.normalizeStoredOrder(order)).filter(Boolean);
      } catch (_) { return []; }
    }

    saveOrders() {
      if (!this.account) return;
      const safeOrders = this.orders.slice(0, MAX_ORDERS).map((order) => this.normalizeStoredOrder(order)).filter(Boolean);
      this.storageSet(this.ordersKey(), JSON.stringify(safeOrders));
    }

    async refresh({ force = false } = {}) {
      if (this.refreshPromise) return this.refreshPromise;
      if (!force && Date.now() - this.lastFetchAt < 300000) return this.loaded;
      this.refreshPromise = (async () => {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeout = controller ? setTimeout(() => controller.abort(), 10000) : null;
        try {
          const response = await fetch(MANIFEST_URL, {
            method: 'GET', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
            headers: { Accept: 'application/json' }, signal: controller?.signal
          });
          if (!response.ok) throw new Error('catalog');
          const manifest = this.catalog.validateManifest(await response.json());
          this.manifest = manifest;
          this.loaded = true;
          this.error = '';
          this.lastFetchAt = Date.now();
          this.storageSet(CACHE_KEY, JSON.stringify(manifest));
          this.reconcileCart();
          return true;
        } catch (_) {
          this.error = this.t('offline');
          return false;
        } finally {
          if (timeout) clearTimeout(timeout);
          this.render();
        }
      })();
      try { return await this.refreshPromise; }
      finally { this.refreshPromise = null; }
    }

    async manualRefresh() {
      this.app.showToast(this.t('refreshing'));
      const fresh = await this.refresh({ force: true });
      this.app.showToast(fresh ? this.t('updated') : this.t('offline'), !fresh);
    }

    reconcileCart() {
      const byId = new Map(this.manifest.products.map((product) => [product.id, product]));
      const next = [];
      this.cart.forEach((entry) => {
        const product = byId.get(entry.productId);
        if (!product || !this.catalog.isVisible(product) || product.stock < 1) return;
        next.push({ productId: entry.productId, quantity: Math.min(entry.quantity, product.stock, 99) });
      });
      if (JSON.stringify(next) !== JSON.stringify(this.cart)) {
        this.cart = next;
        this.saveCart();
      }
    }

    localize(value) {
      const lang = this.app.currentLang || 'en';
      return value?.[lang] || value?.en || value?.fr || '';
    }

    assetUrl(product) {
      return product.image || 'assets/icon-192.png';
    }

    remoteAssetUrl(product) {
      return product.image ? new URL(product.image, MANIFEST_URL).href : '';
    }

    setProductImage(image, product) {
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      image.classList.toggle('store-image-fallback', !product.image);
      image.dataset.storeImageSource = product.image ? 'local' : 'fallback';
      image.src = this.assetUrl(product);
      const remoteSource = this.remoteAssetUrl(product);
      image.addEventListener('error', () => {
        const source = image.dataset.storeImageSource;
        if (source === 'local' && remoteSource) {
          image.dataset.storeImageSource = 'remote';
          image.src = remoteSource;
          return;
        }
        if (source === 'fallback') return;
        image.dataset.storeImageSource = 'fallback';
        image.src = 'assets/icon-192.png';
        image.classList.add('store-image-fallback');
      });
    }

    render() {
      if (!this.initialized) return;
      this.applyLanguage();
      this.renderProducts();
      this.renderCartBadge();
      if (document.getElementById('modal-store-cart')?.classList.contains('active')) this.renderCart();
      if (document.getElementById('modal-store-orders')?.classList.contains('active')) this.renderOrders();
    }

    renderProducts() {
      const grid = document.getElementById('store-product-grid');
      if (!grid) return;
      grid.textContent = '';
      const status = document.getElementById('store-catalog-status');
      status.classList.toggle('store-error', Boolean(this.error));
      status.textContent = this.error || (!this.manifest.enabled ? this.t('storeClosed') : '');
      const search = (document.getElementById('store-search-input')?.value || '').trim().toLowerCase();
      const category = document.getElementById('store-category-filter')?.value || 'all';
      const source = document.getElementById('store-source-filter')?.value || 'all';
      const token = document.getElementById('store-token-filter')?.value || 'all';
      const products = this.manifest.enabled ? this.manifest.products.filter((product) => {
        if (!this.catalog.isVisible(product)) return false;
        if (category !== 'all' && product.category !== category) return false;
        if (source !== 'all' && product.sourceType !== source) return false;
        if (token !== 'all' && product.priceToken !== token) return false;
        if (search && ![product.sellerName, ...Object.values(product.name), ...Object.values(product.description)].join(' ').toLowerCase().includes(search)) return false;
        return true;
      }) : [];
      const empty = document.getElementById('store-empty');
      empty.classList.toggle('hidden', products.length > 0);
      if (!products.length) {
        empty.querySelector('h3').textContent = this.manifest.enabled && this.manifest.products.length ? this.t('noFiltered') : this.t('emptyTitle');
      }
      products.forEach((product) => {
        const card = document.createElement('article');
        card.className = 'store-product-card';
        card.dataset.productId = product.id;
        const visual = document.createElement('div');
        visual.className = 'store-product-image-wrap';
        const image = document.createElement('img');
        image.className = 'store-product-image';
        this.setProductImage(image, product);
        const sourceBadge = document.createElement('span');
        sourceBadge.className = `store-source-badge ${product.sourceType}`;
        sourceBadge.textContent = this.t(product.sourceType);
        visual.append(image, sourceBadge);
        if (product.stock === 0) {
          const soldOut = document.createElement('span');
          soldOut.className = 'store-soldout-badge';
          soldOut.textContent = this.t('outOfStock');
          visual.appendChild(soldOut);
        }
        const body = document.createElement('div');
        body.className = 'store-product-body';
        const name = document.createElement('h3');
        name.className = 'store-product-name';
        name.textContent = this.localize(product.name);
        const description = document.createElement('p');
        description.className = 'store-product-description';
        description.textContent = this.localize(product.description);
        const seller = document.createElement('span');
        seller.className = 'store-product-seller';
        seller.textContent = product.sellerName;
        const delivery = document.createElement('span');
        delivery.className = 'store-product-delivery';
        delivery.textContent = product.deliveryEstimate;
        const priceRow = document.createElement('div');
        priceRow.className = 'store-product-price-row';
        const tokenImage = document.createElement('img');
        tokenImage.className = 'store-token-logo';
        tokenImage.src = product.priceToken === 'USDT' ? 'assets/usdt.svg' : 'assets/fta.png';
        tokenImage.alt = '';
        const price = document.createElement('span');
        price.className = 'store-product-price';
        price.textContent = `${product.price} ${product.priceToken}`;
        priceRow.append(tokenImage, price);
        const stock = document.createElement('span');
        stock.className = 'store-product-stock';
        stock.textContent = `${this.t('stock')}: ${product.stock} ${this.t('pieces')}`;
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'store-add-button';
        add.textContent = product.stock ? this.t('add') : this.t('outOfStock');
        add.disabled = product.stock === 0;
        add.addEventListener('click', () => this.addToCart(product.id));
        body.append(name, description, seller, delivery, priceRow, stock, add);
        card.append(visual, body);
        grid.appendChild(card);
      });
    }

    renderCartBadge() {
      const badge = document.getElementById('store-cart-count');
      if (!badge) return;
      const count = this.cart.reduce((sum, entry) => sum + entry.quantity, 0);
      badge.textContent = String(Math.min(count, 99));
      badge.classList.toggle('hidden', count === 0);
    }

    productById(id) { return this.manifest.products.find((product) => product.id === id); }

    addToCart(productId) {
      const product = this.productById(productId);
      if (!product || !this.manifest.enabled || !this.catalog.isVisible(product) || product.stock < 1) {
        this.app.showToast(this.t('invalidCatalog'), true);
        return;
      }
      if (this.cart.length) {
        const first = this.productById(this.cart[0].productId);
        if (!first || this.catalog.groupKey(first) !== this.catalog.groupKey(product)) {
          this.app.showToast(this.t('differentSeller'), true);
          return;
        }
      }
      const existing = this.cart.find((entry) => entry.productId === productId);
      if (existing) {
        if (existing.quantity >= Math.min(product.stock, 99)) {
          this.app.showToast(this.t('stock') + `: ${product.stock}`, true);
          return;
        }
        existing.quantity += 1;
      } else this.cart.push({ productId, quantity: 1 });
      this.saveCart();
      this.renderProducts();
      this.app.showToast(this.t('added'));
    }

    quote() {
      if (!this.manifest.enabled) throw new StoreUiError(this.t('storeClosed'));
      return this.catalog.calculateCart(this.manifest.products, this.cart);
    }

    quoteFingerprint(quote) {
      return JSON.stringify({
        sellerId: quote.sellerId, paymentAddress: quote.paymentAddress, token: quote.token,
        total: quote.totalUnits.toString(),
        items: quote.items.map((item) => [item.product.id, item.quantity, item.unitUnits.toString(), item.feeUnits.toString()])
      });
    }

    openCart() {
      this.app.closeModals();
      this.renderCart();
      document.getElementById('modal-store-cart').classList.add('active');
    }

    renderCart() {
      const list = document.getElementById('store-cart-items');
      if (!list) return;
      list.textContent = '';
      let quote = null;
      let error = '';
      try { quote = this.quote(); } catch (reason) { error = reason.message; }
      const empty = document.getElementById('store-cart-empty');
      empty.textContent = this.cart.length && error ? error : this.t('cartEmpty');
      empty.classList.toggle('hidden', Boolean(quote));
      document.getElementById('store-cart-totals').classList.toggle('hidden', !quote);
      document.getElementById('store-cart-checkout').disabled = !quote || this.paymentInProgress;
      document.getElementById('store-cart-clear').disabled = !this.cart.length || this.paymentInProgress;
      document.getElementById('store-cart-seller').textContent = quote ? `${quote.sellerName} · ${quote.token}` : '';
      if (!quote) return;
      quote.items.forEach((item) => {
        const product = item.product;
        const row = document.createElement('div');
        row.className = 'store-cart-item';
        const image = document.createElement('img');
        this.setProductImage(image, product);
        const copy = document.createElement('div');
        copy.className = 'store-cart-item-copy';
        const name = document.createElement('strong');
        name.textContent = this.localize(product.name);
        const price = document.createElement('span');
        price.textContent = `${product.price} ${product.priceToken}`;
        copy.append(name, price);
        const quantity = document.createElement('div');
        quantity.className = 'store-quantity-control';
        const minus = document.createElement('button');
        minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', '−');
        minus.addEventListener('click', () => this.changeQuantity(product.id, item.quantity - 1));
        const count = document.createElement('span'); count.textContent = String(item.quantity);
        const plus = document.createElement('button');
        plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', '+');
        plus.disabled = item.quantity >= Math.min(product.stock, 99);
        plus.addEventListener('click', () => this.changeQuantity(product.id, item.quantity + 1));
        quantity.append(minus, count, plus);
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'store-cart-remove'; remove.textContent = this.t('remove');
        remove.addEventListener('click', () => this.changeQuantity(product.id, 0));
        row.append(image, copy, quantity, remove);
        list.appendChild(row);
      });
      document.getElementById('store-cart-subtotal').textContent = `${quote.subtotal} ${quote.token}`;
      document.getElementById('store-cart-shipping').textContent = `${quote.shipping} ${quote.token}`;
      document.getElementById('store-cart-total').textContent = `${quote.total} ${quote.token}`;
    }

    changeQuantity(productId, quantity) {
      const product = this.productById(productId);
      if (quantity <= 0) this.cart = this.cart.filter((entry) => entry.productId !== productId);
      else {
        if (!product || quantity > Math.min(product.stock, 99)) return;
        const entry = this.cart.find((candidate) => candidate.productId === productId);
        if (entry) entry.quantity = quantity;
      }
      this.saveCart();
      this.renderCart();
      this.renderProducts();
    }

    clearCart(ask = false) {
      if (ask && this.cart.length && !window.confirm(this.t('emptyCartConfirm'))) return;
      this.cart = [];
      this.saveCart();
      if (document.getElementById('modal-store-cart')?.classList.contains('active')) this.renderCart();
      this.renderProducts();
    }

    async openCheckout() {
      if (this.paymentInProgress) return;
      this.app.setLoader(true);
      try {
        const fresh = await this.refresh({ force: true });
        if (!fresh) throw new StoreUiError(this.t('offline'));
        const quote = this.quote();
        this.app.closeModals();
        this.checkoutQuote = this.quoteFingerprint(quote);
        this.renderCheckoutSummary(quote);
        document.getElementById('modal-store-checkout').classList.add('active');
      } catch (error) {
        this.app.showToast(error.message || this.t('invalidCatalog'), true);
      } finally { this.app.setLoader(false); }
    }

    renderCheckoutSummary(quote) {
      const container = document.getElementById('store-checkout-summary');
      container.textContent = '';
      const seller = document.createElement('div');
      seller.textContent = `${this.t('seller')}: ${quote.sellerName}`;
      const items = document.createElement('div');
      const count = quote.items.reduce((sum, item) => sum + item.quantity, 0);
      items.textContent = `${this.t('products')}: ${count} ${this.t('orderItems')}`;
      const total = document.createElement('strong');
      total.textContent = `${this.t('total')}: ${quote.total} ${quote.token}`;
      const review = document.createElement('small');
      review.textContent = this.t('paymentReview');
      container.append(seller, items, total, review);
    }

    privateText(value, maxLength, multiline = false) {
      let text = String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim();
      if (!multiline) text = text.replace(/\s+/g, ' ');
      return text.slice(0, maxLength).trim();
    }

    readShipping() {
      const shipping = {
        name: this.privateText(document.getElementById('store-shipping-name').value, 80),
        phone: this.privateText(document.getElementById('store-shipping-phone').value, 32),
        country: this.privateText(document.getElementById('store-shipping-country').value, 60),
        city: this.privateText(document.getElementById('store-shipping-city').value, 80),
        address: this.privateText(document.getElementById('store-shipping-address').value, 240, true),
        notes: this.privateText(document.getElementById('store-shipping-notes').value, 300, true)
      };
      if (!shipping.name || !shipping.phone || !shipping.country || !shipping.city || !shipping.address || !document.getElementById('store-checkout-consent').checked) {
        throw new StoreUiError(this.t('shippingMissing'));
      }
      return shipping;
    }

    newOrderRequestId() {
      if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    async orderRequest(action, params = {}) {
      if (!this.account || !this.app.signer || typeof this.app.signer.signMessage !== 'function') {
        throw new StoreUiError(this.t('notReady'));
      }
      const protocol = globalThis.FitiaStoreOrderProtocol;
      if (!protocol) throw new StoreUiError(this.t('orderPreparationFailed'));
      const body = { action, buyer: this.account, timestamp: Date.now(), ...params };
      let signature;
      try {
        const message = protocol.message(action, body);
        signature = await this.app.signer.signMessage(message);
      } catch (_) {
        throw new StoreUiError(this.t('notReady'));
      }
      body.signature = signature;
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 15000) : null;
      let response;
      let data = {};
      try {
        response = await fetch(ORDER_API_URL, {
          method: 'POST',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          cache: 'no-store',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller?.signal
        });
        try { data = await response.json(); } catch (_) { data = {}; }
      } catch (_) {
        const error = new StoreUiError(this.t('orderOffline'));
        error.code = 'ORDER_NETWORK';
        throw error;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
      if (!response.ok) {
        const code = String(data.code || 'ORDER_NETWORK');
        let message = action === 'create' ? this.t('orderPreparationFailed') : this.t('orderOffline');
        if (code === 'ORDER_AUTH') message = this.t('notReady');
        if (code === 'ORDER_STORE_CLOSED') message = this.t('storeClosed');
        if (code === 'ORDER_PAYMENT_FAILED' || code === 'ORDER_PAYMENT_MISMATCH' || code === 'ORDER_TX_USED') message = this.t('paymentFailed');
        const error = new StoreUiError(message);
        error.code = code;
        throw error;
      }
      return data;
    }

    async prepareOrder(quote, shipping) {
      const requestId = this.newOrderRequestId();
      let result;
      try {
        result = await this.orderRequest('create', { requestId, cart: this.cart, delivery: shipping });
      } catch (error) {
        if (error.code === 'ORDER_NETWORK') error.message = this.t('orderPreparationFailed');
        throw error;
      }
      const order = result.order;
      if (!order || order.id !== requestId || order.token !== quote.token ||
          String(order.totalUnits) !== quote.totalUnits.toString() ||
          String(order.paymentAddress || '').toLowerCase() !== quote.paymentAddress.toLowerCase()) {
        throw new StoreUiError(this.t('orderPreparationFailed'));
      }
      return order;
    }

    createOrder(serverOrder, quote, txHash) {
      const order = this.normalizeStoredOrder({
        ...serverOrder,
        txHash,
        status: 'submitted',
        sellerName: quote.sellerName,
        sellerContact: quote.sellerContact,
        paymentAddress: quote.paymentAddress,
        total: quote.total,
        totalUnits: quote.totalUnits.toString(),
        token: quote.token,
        items: serverOrder.items.map((item) => ({
          ...item,
          name: typeof item.name === 'string' ? item.name : this.localize(item.name)
        }))
      });
      if (!order) throw new StoreUiError(this.t('orderOffline'));
      return order;
    }

    persistOrderForAccount(account, order) {
      const normalized = this.normalizeStoredOrder(order);
      if (!normalized || !account) return;
      let existing = [];
      try {
        const parsed = JSON.parse(this.storageGet(`${ORDERS_PREFIX}${account}`) || '[]');
        if (Array.isArray(parsed)) existing = parsed.map((item) => this.normalizeStoredOrder(item)).filter(Boolean);
      } catch (_) { existing = []; }
      const orders = [normalized, ...existing.filter((item) => item.id !== normalized.id)].slice(0, MAX_ORDERS);
      this.storageSet(`${ORDERS_PREFIX}${account}`, JSON.stringify(orders));
      if (this.account === account) this.orders = orders;
    }

    upsertServerOrder(serverOrder) {
      const current = this.orders.find((item) => item.id === serverOrder?.id);
      if (current?.status === 'failed' && !['paid', 'preparing', 'shipped', 'delivered'].includes(serverOrder?.status)) return current;
      const order = this.normalizeStoredOrder({
        ...serverOrder,
        sellerContact: serverOrder.sellerContact || current?.sellerContact || '',
        items: Array.isArray(serverOrder.items) ? serverOrder.items.map((item) => ({
          ...item,
          name: typeof item.name === 'string' ? item.name : this.localize(item.name)
        })) : []
      });
      if (!order) return null;
      order.sellerContact = order.sellerContact || current?.sellerContact || '';
      const index = this.orders.findIndex((item) => item.id === order.id);
      if (index >= 0) this.orders[index] = { ...this.orders[index], ...order };
      else this.orders.unshift(order);
      this.orders = this.orders.slice(0, MAX_ORDERS);
      this.saveOrders();
      if (this.currentOrderId === order.id && document.getElementById('modal-store-receipt')?.classList.contains('active')) this.renderReceipt(order.id);
      if (document.getElementById('modal-store-orders')?.classList.contains('active')) this.renderOrders();
      return order;
    }

    async pay(event) {
      event?.preventDefault();
      if (this.paymentInProgress) return;
      this.paymentInProgress = true;
      const button = document.getElementById('store-pay-button');
      button.disabled = true;
      document.getElementById('store-checkout-error').textContent = '';
      let loaderVisible = false;
      try {
        const shipping = this.readShipping();
        if (!this.checkoutQuote) throw new StoreUiError(this.t('catalogChanged'));
        const paymentAccount = this.account;
        const assertActiveSession = () => {
          if (!paymentAccount || this.account !== paymentAccount || !this.app.signer ||
              !this.app.user || this.app.user.toLowerCase() !== paymentAccount) {
            throw new StoreUiError(this.t('notReady'));
          }
        };
        assertActiveSession();
        const fresh = await this.refresh({ force: true });
        if (!fresh) throw new StoreUiError(this.t('offline'));
        const quote = this.quote();
        if (this.quoteFingerprint(quote) !== this.checkoutQuote) {
          this.app.closeModals();
          this.openCart();
          throw new StoreUiError(this.t('catalogChanged'));
        }
        const to = ethers.getAddress(quote.paymentAddress);
        const blocked = [ethers.ZeroAddress, CONFIG.USDT, CONFIG.FTA, CONFIG.CORE, CONFIG.MINE].map((address) => address.toLowerCase());
        if (blocked.includes(to.toLowerCase())) throw new StoreUiError(this.t('contractBlocked'));
        const contract = quote.token === 'USDT' ? this.app.usdtToken : this.app.ftaToken;
        const actualDecimals = quote.token === 'USDT' ? this.app.usdtDecimals : this.app.ftaDecimals;
        if (!contract || actualDecimals !== quote.decimals) throw new StoreUiError(this.t('decimalsBlocked'));
        const balance = BigInt(await contract.balanceOf(this.app.user));
        assertActiveSession();
        if (balance < quote.totalUnits) throw new StoreUiError(this.app.t('errInsufficientFunds'));
        if (!(await this.app.ensurePolGas())) return;
        assertActiveSession();
        const serverOrder = await this.prepareOrder(quote, shipping);
        assertActiveSession();
        const verified = await this.app.requestPinVerification(`FITIA STORE · ${quote.total} ${quote.token}`);
        if (!verified) return;
        assertActiveSession();
        if (verified.secret) {
          verified.secret.privateKey = '';
          verified.secret.mnemonic = '';
        }
        this.app.setLoader(true);
        loaderVisible = true;
        const tx = await contract.transfer(to, quote.totalUnits);
        if (!tx || !/^0x[a-fA-F0-9]{64}$/.test(tx.hash || '')) throw new Error('STORE_TRANSACTION_HASH');
        const order = this.createOrder(serverOrder, quote, tx.hash.toLowerCase());
        this.persistOrderForAccount(paymentAccount, order);
        if (this.account !== paymentAccount) {
          this.app.showToast(`${this.t('paymentSent')} ${tx.hash}`, false, 'pending');
          return;
        }
        this.clearCart(false);
        this.app.closeModals();
        this.showReceipt(order.id);
        this.app.showToast(this.t('paymentSent'), false, 'pending');
        void this.trackServerOrder(order.id, tx, paymentAccount);
      } catch (error) {
        const message = error instanceof StoreUiError ? error.message : '';
        if (message) {
          const errorElement = document.getElementById('store-checkout-error');
          if (document.getElementById('modal-store-checkout')?.classList.contains('active')) errorElement.textContent = message;
          else this.app.showToast(message, true);
        } else this.app.showError(error);
      } finally {
        if (loaderVisible) this.app.setLoader(false);
        this.paymentInProgress = false;
        button.disabled = false;
      }
    }

    resumePendingOrders() {
      if (!this.account || !this.app.signer || this.ordersRefreshPromise) return;
      const pending = this.orders.some((order) => UUID_PATTERN.test(order.id) && ['submitted', 'payment_pending'].includes(order.status));
      if (pending) void this.refreshOrders();
    }

    setLocalOrderStatus(orderId, status) {
      const order = this.orders.find((item) => item.id === orderId);
      if (!order) return;
      order.status = status;
      this.saveOrders();
      if (this.currentOrderId === orderId && document.getElementById('modal-store-receipt')?.classList.contains('active')) this.renderReceipt(orderId);
      if (document.getElementById('modal-store-orders')?.classList.contains('active')) this.renderOrders();
    }

    async trackServerOrder(orderId, tx, paymentAccount) {
      const initial = this.orders.find((item) => item.id === orderId);
      if (!initial) return;
      const txHash = initial.txHash;
      let waited = false;
      for (let attempt = 0; attempt < this.orderMaxAttempts; attempt += 1) {
        if (this.account !== paymentAccount) return;
        try {
          const result = await this.orderRequest('attach', { orderId, txHash });
          const order = this.upsertServerOrder(result.order);
          if (order && ['paid', 'preparing', 'shipped', 'delivered'].includes(order.status)) {
            this.app.showToast(this.t('orderSent'));
            FitiaSecurity.Native.vibrate(35);
            try { await this.app.updateData(); } catch (_) { /* Le suivi reste disponible. */ }
            return;
          }
        } catch (error) {
          if (['ORDER_PAYMENT_FAILED', 'ORDER_PAYMENT_MISMATCH', 'ORDER_TX_USED'].includes(error.code)) {
            this.setLocalOrderStatus(orderId, 'failed');
            this.app.showToast(this.t('paymentFailed'), true);
            return;
          }
        }
        if (!waited) {
          waited = true;
          try {
            const receipt = await tx.wait();
            if (Number(receipt?.status ?? -1) === 0) {
              this.setLocalOrderStatus(orderId, 'failed');
              this.app.showToast(this.t('paymentFailed'), true);
              return;
            }
          } catch (error) {
            if (Number(error?.receipt?.status ?? -1) === 0) {
              this.setLocalOrderStatus(orderId, 'failed');
              this.app.showToast(this.t('paymentFailed'), true);
              return;
            }
          }
        }
        if (attempt < this.orderMaxAttempts - 1) await new Promise((resolve) => setTimeout(resolve, this.orderRetryDelayMs));
      }
      const order = this.orders.find((item) => item.id === orderId);
      if (order && !['paid', 'preparing', 'shipped', 'delivered', 'failed'].includes(order.status)) {
        this.setLocalOrderStatus(orderId, 'payment_pending');
      }
      this.app.showToast(this.t('paymentPending'), false, 'pending');
    }

    async refreshOrders() {
      if (!this.account || !this.app.signer || this.ordersRefreshPromise) return this.ordersRefreshPromise;
      this.ordersRefreshPromise = (async () => {
        let failed = false;
        try {
          const result = await this.orderRequest('list');
          if (Array.isArray(result.orders)) result.orders.forEach((order) => this.upsertServerOrder(order));
        } catch (_) {
          failed = true;
        }
        const account = this.account;
        const pending = this.orders.filter((order) => UUID_PATTERN.test(order.id) && ['submitted', 'payment_pending'].includes(order.status)).slice(0, 5);
        for (const order of pending) {
          if (this.account !== account) return;
          try {
            const result = await this.orderRequest('attach', { orderId: order.id, txHash: order.txHash });
            this.upsertServerOrder(result.order);
            failed = false;
          } catch (_) { /* Aucun nouveau transfert ne sera créé lors d’une reprise. */ }
        }
        if (failed) this.app.showToast(this.t('orderOffline'), true);
        this.renderOrders();
      })();
      try { return await this.ordersRefreshPromise; }
      finally { this.ordersRefreshPromise = null; }
    }

    receiptRow(label, value) {
      const row = document.createElement('div');
      row.className = 'store-receipt-row';
      const small = document.createElement('small'); small.textContent = label;
      const span = document.createElement('span'); span.textContent = value;
      row.append(small, span);
      return row;
    }

    showReceipt(orderId) {
      if (!this.orders.some((order) => order.id === orderId)) return;
      this.app.closeModals();
      this.currentOrderId = orderId;
      this.renderReceipt(orderId);
      document.getElementById('modal-store-receipt').classList.add('active');
    }

    renderReceipt(orderId) {
      const order = this.orders.find((item) => item.id === orderId);
      if (!order) return;
      const status = document.getElementById('store-receipt-status');
      const delivered = ['paid', 'preparing', 'shipped', 'delivered'].includes(order.status);
      status.textContent = order.status === 'failed' ? this.t('paymentFailed') : delivered ? this.t('orderSent') : this.t('paymentSent');
      const content = document.getElementById('store-receipt-content');
      content.textContent = '';
      content.append(
        this.receiptRow(this.t('orderRef'), order.orderNumber || order.id),
        this.receiptRow(this.t('seller'), order.sellerName),
        this.receiptRow(this.t('payment'), `${order.total} ${order.token} · ${this.t(order.status)}`),
        this.receiptRow(this.t('transaction'), order.txHash),
        this.receiptRow(this.t('products'), order.items.map((item) => `${item.quantity} × ${item.name}`).join('\n'))
      );
      if (order.carrier || order.trackingNumber) {
        content.appendChild(this.receiptRow(this.t('tracking'), `${order.carrier}\n${order.trackingNumber}`.trim()));
      }
    }

    openOrders() {
      this.app.closeModals();
      this.renderOrders();
      document.getElementById('modal-store-orders').classList.add('active');
      void this.refreshOrders();
    }

    renderOrderTracker(order) {
      const tracker = document.createElement('div');
      tracker.className = 'store-order-tracker';
      const normalizedStatus = order.status === 'confirmed' ? 'paid' : order.status;
      const stages = ['paid', 'preparing', 'shipped', 'delivered'];
      const current = stages.indexOf(normalizedStatus);
      const labels = [this.t('progressPaid'), this.t('progressPreparing'), this.t('progressShipped'), this.t('progressDelivered')];
      stages.forEach((stage, index) => {
        const step = document.createElement('span');
        step.className = `store-order-step${current >= index ? ' done' : ''}${current === index ? ' current' : ''}`;
        step.textContent = labels[index];
        tracker.appendChild(step);
      });
      return tracker;
    }

    renderOrders() {
      const list = document.getElementById('store-orders-list');
      if (!list) return;
      list.textContent = '';
      document.getElementById('store-orders-empty').classList.toggle('hidden', this.orders.length > 0);
      this.orders.forEach((order) => {
        const card = document.createElement('article');
        card.className = 'store-order-card';
        card.dataset.orderId = order.id;
        const head = document.createElement('div');
        head.className = 'store-order-head';
        const id = document.createElement('strong'); id.textContent = order.orderNumber || order.id;
        const status = document.createElement('span');
        status.className = `store-order-status ${order.status}`;
        status.textContent = this.t(order.status);
        head.append(id, status);
        const products = document.createElement('p');
        products.textContent = order.items.map((item) => `${item.quantity} × ${item.name}`).join('\n');
        const total = document.createElement('div');
        total.className = 'store-order-total'; total.textContent = `${order.total} ${order.token}`;
        const seller = document.createElement('p'); seller.textContent = order.sellerName;
        card.append(head, this.renderOrderTracker(order), products, total, seller);
        if (order.carrier || order.trackingNumber) {
          const tracking = document.createElement('div');
          tracking.className = 'store-order-tracking';
          const carrier = document.createElement('strong'); carrier.textContent = order.carrier || this.t('tracking');
          const number = document.createElement('span'); number.textContent = order.trackingNumber;
          tracking.append(carrier, number);
          card.appendChild(tracking);
        }
        const actions = document.createElement('div'); actions.className = 'store-order-actions';
        const details = document.createElement('button'); details.type = 'button'; details.textContent = this.t('trackOrder');
        details.addEventListener('click', () => this.showReceipt(order.id));
        const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = this.t('copyHash');
        copy.addEventListener('click', async () => {
          await FitiaSecurity.Native.copyText(order.txHash);
          this.app.showToast(this.t('copied'));
        });
        actions.append(details, copy);
        card.appendChild(actions);
        list.appendChild(card);
      });
    }
  }

  window.FitiaStoreCenter = FitiaStoreCenter;
  window.FitiaStoreUiError = StoreUiError;
})();
