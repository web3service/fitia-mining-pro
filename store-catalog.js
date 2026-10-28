/* FITIA STORE — validation publique et calculs exacts du panier.
 * Aucune donnée client, adresse de livraison ou information de commande n'appartient à ce fichier.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FitiaStoreCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LANGUAGES = Object.freeze(['fr', 'en', 'de', 'zh', 'sg']);
  const CATEGORIES = Object.freeze([
    'electronics', 'fashion', 'home', 'beauty', 'sports', 'toys',
    'automotive', 'grocery', 'jewelry', 'office', 'other'
  ]);
  const SOURCE_TYPES = Object.freeze(['own', 'dropshipping']);
  const TOKENS = Object.freeze(['USDT', 'FTA']);
  // Codes ISO 3166-1 alpha-2 : les noms sont localisés par l'appareil et les
  // drapeaux SVG sont embarqués localement, sans dépendre d'un service d'images.
  const COUNTRY_CODES = Object.freeze([
    'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
    'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
    'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
    'DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR',
    'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
    'HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP',
    'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
    'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
    'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
    'QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
    'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ',
    'VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW'
  ]);
  const COUNTRY_CODE_SET = new Set(COUNTRY_CODES);
  const TOKEN_DECIMALS = Object.freeze({ USDT: 6, FTA: 8 });
  const MAX_PRODUCTS = 200;
  const PRODUCT_IMAGE_PATTERN = /^assets\/store\/product-[a-f0-9]{24}\.(?:png|jpg|webp)$/;
  const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  class StoreValidationError extends Error {
    constructor(message, code = 'VALIDATION', status = 400) {
      super(message);
      this.name = 'StoreValidationError';
      this.code = code;
      this.status = status;
    }
  }

  function fail(message, code = 'VALIDATION') {
    throw new StoreValidationError(message, code);
  }

  function cleanText(value, maxLength) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength)
      .trim();
  }

  function countryFlag(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!COUNTRY_CODE_SET.has(normalized)) return '';
    return String.fromCodePoint(...Array.from(normalized, (letter) => 127397 + letter.charCodeAt(0)));
  }

  function countryName(code, language = 'en') {
    const normalized = String(code || '').trim().toUpperCase();
    if (!COUNTRY_CODE_SET.has(normalized)) return '';
    const lang = LANGUAGES.includes(language) ? language : 'en';
    try {
      if (typeof Intl.DisplayNames === 'function') {
        return cleanText(new Intl.DisplayNames([lang, 'en'], { type: 'region' }).of(normalized), 80) || normalized;
      }
    } catch (_) { /* Les anciennes WebView utilisent le code pays en secours. */ }
    return normalized;
  }

  function normalizeShippingCountries(value) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length > COUNTRY_CODES.length) {
      fail('La liste des pays de livraison est invalide.');
    }
    const seen = new Set();
    return value.map((entry) => {
      const code = String(entry || '').trim().toUpperCase();
      if (!COUNTRY_CODE_SET.has(code) || seen.has(code)) {
        fail('Un pays de livraison est invalide ou dupliqué.');
      }
      seen.add(code);
      return code;
    });
  }

  function localized(value, maxLength, label, required = true) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      if (!required && (value === undefined || value === null || value === '')) return {};
      fail(`${label} doit contenir des traductions.`);
    }
    const result = {};
    LANGUAGES.forEach((lang) => {
      const text = cleanText(value[lang], maxLength);
      if (text) result[lang] = text;
    });
    if (required && !result.en && !result.fr) {
      fail(`${label} doit être renseigné au moins en français ou en anglais.`);
    }
    return result;
  }

  function dateValue(value, label) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail(`${label} est invalide.`);
    return new Date(value).toISOString();
  }

  function decimalString(value, decimals, label, allowZero = false) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail(`${label} est invalide.`);
      value = String(value);
    }
    if (typeof value !== 'string') fail(`${label} est invalide.`);
    const clean = value.trim().replace(',', '.');
    const match = clean.match(/^(0|[1-9][0-9]{0,8})(?:\.([0-9]+))?$/);
    if (!match || (match[2] || '').length > decimals) {
      fail(`${label} doit être un montant positif avec ${decimals} décimales maximum.`);
    }
    const normalized = `${match[1]}${match[2] ? `.${match[2].replace(/0+$/, '')}` : ''}`.replace(/\.$/, '');
    if (!allowZero && parseUnits(normalized, decimals) <= 0n) fail(`${label} doit être supérieur à zéro.`);
    if (parseUnits(normalized, decimals) > 1000000000n * (10n ** BigInt(decimals))) {
      fail(`${label} dépasse la limite autorisée.`);
    }
    return normalized;
  }

  function parseUnits(value, decimals) {
    if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18) fail('Précision du jeton invalide.');
    const clean = String(value).trim();
    const match = clean.match(/^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/);
    if (!match || (match[2] || '').length > decimals) fail('Montant décimal invalide.', 'AMOUNT');
    return BigInt(match[1]) * (10n ** BigInt(decimals)) + BigInt(((match[2] || '') + '0'.repeat(decimals)).slice(0, decimals) || 0);
  }

  function formatUnits(value, decimals) {
    let units;
    try { units = BigInt(value); } catch (_) { fail('Montant invalide.', 'AMOUNT'); }
    if (units < 0n || !Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18) fail('Montant invalide.', 'AMOUNT');
    const base = 10n ** BigInt(decimals);
    const whole = (units / base).toString();
    const fraction = (units % base).toString().padStart(decimals, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
  }

  function normalizeProduct(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('Un produit est invalide.');
    const id = cleanText(item.id, 64).toLowerCase();
    const sellerId = cleanText(item.sellerId, 64).toLowerCase();
    const sourceType = cleanText(item.sourceType, 20).toLowerCase();
    const type = item.type === undefined ? 'physical' : cleanText(item.type, 16).toLowerCase();
    const category = cleanText(item.category, 24).toLowerCase();
    const priceToken = cleanText(item.priceToken, 8).toUpperCase();
    const paymentAddress = cleanText(item.paymentAddress, 42);
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(id)) fail('Un identifiant de produit est invalide.');
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(sellerId)) fail('Un identifiant de vendeur est invalide.');
    if (!SOURCE_TYPES.includes(sourceType)) fail('Le type d’approvisionnement est invalide.');
    if (type !== 'physical') fail('Seuls les produits physiques sont acceptés.');
    if (item.digital !== undefined && item.digital !== null) fail('Les produits numériques ne sont pas acceptés.');
    if (!CATEGORIES.includes(category)) fail('La catégorie du produit est invalide.');
    if (!TOKENS.includes(priceToken)) fail('Le jeton de paiement doit être USDT ou FTA.');
    if (!ADDRESS_PATTERN.test(paymentAddress) || paymentAddress.toLowerCase() === ZERO_ADDRESS) {
      fail('L’adresse Polygon du vendeur est invalide.');
    }
    if (typeof item.active !== 'boolean') fail('La visibilité du produit doit être un booléen.');
    if (!Number.isSafeInteger(item.stock) || item.stock < 0 || item.stock > 1000000) {
      fail('Le stock doit être un entier compris entre 0 et 1 000 000.');
    }
    const image = cleanText(item.image, 160);
    if (image && !PRODUCT_IMAGE_PATTERN.test(image)) fail('L’image du produit n’est pas autorisée.');
    const startsAt = dateValue(item.startsAt, 'La date de début');
    const expiresAt = dateValue(item.expiresAt, 'La date de fin');
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      fail('La date de fin doit être postérieure à la date de début.');
    }
    const product = {
      id,
      active: item.active,
      sourceType,
      category,
      name: localized(item.name, 100, 'Le nom du produit'),
      description: localized(item.description, 600, 'La description', false),
      image,
      sellerId,
      sellerName: cleanText(item.sellerName, 80),
      sellerContact: cleanText(item.sellerContact, 160),
      paymentAddress: paymentAddress.toLowerCase(),
      priceToken,
      price: decimalString(item.price, TOKEN_DECIMALS[priceToken], 'Le prix'),
      shippingFee: decimalString(item.shippingFee === undefined ? '0' : item.shippingFee, TOKEN_DECIMALS[priceToken], 'Les frais de livraison', true),
      stock: item.stock,
      deliveryEstimate: cleanText(item.deliveryEstimate, 80)
    };
    if (!product.sellerName) fail('Le nom du vendeur est obligatoire.');
    if (!product.deliveryEstimate) fail('Le délai de livraison est obligatoire.');
    if (startsAt) product.startsAt = startsAt;
    if (expiresAt) product.expiresAt = expiresAt;
    return product;
  }

  function validateManifest(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 ||
        typeof raw.enabled !== 'boolean' || !Array.isArray(raw.products)) {
      fail('Le catalogue FITIA STORE est invalide.');
    }
    if (raw.products.length > MAX_PRODUCTS) fail(`Le maximum est de ${MAX_PRODUCTS} produits.`);
    const ids = new Set();
    const products = raw.products.map((item) => {
      const product = normalizeProduct(item);
      if (ids.has(product.id)) fail(`Le produit ${product.id} est dupliqué.`);
      ids.add(product.id);
      return product;
    });
    return {
      version: 1,
      enabled: raw.enabled,
      products,
      shippingCountries: normalizeShippingCountries(raw.shippingCountries)
    };
  }

  function isVisible(product, now = Date.now()) {
    return Boolean(product && product.active &&
      (!product.startsAt || Date.parse(product.startsAt) <= now) &&
      (!product.expiresAt || Date.parse(product.expiresAt) > now));
  }

  function groupKey(product) {
    return `${product.sellerId}:${product.priceToken}:${product.paymentAddress.toLowerCase()}`;
  }

  function calculateCart(products, cart, now = Date.now()) {
    if (!Array.isArray(products) || !Array.isArray(cart) || !cart.length) fail('Le panier est vide.', 'EMPTY_CART');
    if (cart.length > 50) fail('Le panier contient trop d’articles.', 'CART_LIMIT');
    const byId = new Map(products.map((product) => [product.id, product]));
    const seen = new Set();
    let expectedGroup = '';
    let token = '';
    let decimals = 0;
    let subtotalUnits = 0n;
    let shippingUnits = 0n;
    let seller = null;
    const items = cart.map((entry) => {
      if (!entry || typeof entry !== 'object' || seen.has(entry.productId)) fail('Le panier contient un article invalide ou dupliqué.', 'CART_ITEM');
      seen.add(entry.productId);
      const product = byId.get(entry.productId);
      if (!product || !isVisible(product, now)) fail('Un article n’est plus disponible. Actualisez le catalogue.', 'PRODUCT_UNAVAILABLE');
      if (!Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 99 || entry.quantity > product.stock) {
        fail(`Le stock disponible pour ${product.name.en || product.name.fr || product.id} est insuffisant.`, 'STOCK');
      }
      const key = groupKey(product);
      if (expectedGroup && key !== expectedGroup) {
        fail('Un paiement concerne un seul vendeur, une seule adresse et un seul jeton.', 'MIXED_CART');
      }
      expectedGroup = key;
      token = product.priceToken;
      decimals = TOKEN_DECIMALS[token];
      const unitUnits = parseUnits(product.price, decimals);
      const feeUnits = parseUnits(product.shippingFee, decimals);
      const quantity = BigInt(entry.quantity);
      const lineUnits = unitUnits * quantity;
      subtotalUnits += lineUnits;
      shippingUnits += feeUnits * quantity;
      seller = product;
      return { product, quantity: entry.quantity, unitUnits, feeUnits, lineUnits };
    });
    if (!seller || subtotalUnits <= 0n) fail('Le total du panier est invalide.', 'AMOUNT');
    return {
      sellerId: seller.sellerId,
      sellerName: seller.sellerName,
      sellerContact: seller.sellerContact,
      paymentAddress: seller.paymentAddress,
      token,
      decimals,
      items,
      subtotalUnits,
      shippingUnits,
      totalUnits: subtotalUnits + shippingUnits,
      subtotal: formatUnits(subtotalUnits, decimals),
      shipping: formatUnits(shippingUnits, decimals),
      total: formatUnits(subtotalUnits + shippingUnits, decimals)
    };
  }

  return Object.freeze({
    LANGUAGES, CATEGORIES, SOURCE_TYPES, TOKENS, COUNTRY_CODES, TOKEN_DECIMALS, MAX_PRODUCTS,
    PRODUCT_IMAGE_PATTERN, ZERO_ADDRESS, StoreValidationError,
    cleanText, decimalString, parseUnits, formatUnits, countryFlag, countryName, normalizeShippingCountries,
    normalizeProduct, validateManifest, isVisible, groupKey, calculateCart
  });
});
