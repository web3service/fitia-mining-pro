#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require(
  fs.existsSync('/tmp/test-deps/node_modules/jsdom')
    ? '/tmp/test-deps/node_modules/jsdom'
    : 'jsdom'
);

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'admin/index.html'), 'utf8');
const adminCss = fs.readFileSync(path.join(ROOT, 'admin/admin.css'), 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'admin/admin.js'), 'utf8');
const effectsScript = fs.readFileSync(path.join(ROOT, 'promotion-effects.js'), 'utf8');
const storeAdminScript = fs.readFileSync(path.join(ROOT, 'admin/store-admin.js'), 'utf8');
let manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'announcements.json'), 'utf8'));
let revision = 'revision-initiale';
const initialAnnouncementCount = manifest.announcements.length;
const writes = [];
let promotionManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'promotions.json'), 'utf8'));
// La visibilité éditoriale réelle varie : ce scénario part d’un état connu sans la modifier dans le dépôt.
promotionManifest.hiddenShopItems = { machine: [], battery: [] };
const initialPromotionCount = promotionManifest.promotions.length;
let promotionRevision = 'revision-promotion-initiale';
const promotionWrites = [];
let failPromotions = false;
let storeManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'store-products.json'), 'utf8'));
let storeRevision = 'revision-store-initiale';
const storeWrites = [];
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
Object.defineProperty(window, 'crypto', { value: crypto.webcrypto });
window.confirm = () => true;

function response(data, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => data };
}

window.fetch = async (url, options = {}) => {
  if (url === '/api/admin/session') {
    return response({ authenticated: true, csrfToken: 'a'.repeat(64), mode: 'local', project: null, branch: null });
  }
  if (url === '/api/admin/announcements' && (!options.method || options.method === 'GET')) {
    return response({ manifest, revision, mode: 'local', project: null, branch: null, serverTime: new Date().toISOString() });
  }
  if (url === '/api/admin/announcements' && options.method === 'PUT') {
    const body = JSON.parse(options.body);
    assert.strictEqual(body.revision, revision);
    manifest = body.manifest;
    revision = `revision-${writes.length + 1}`;
    writes.push(body);
    return response({ manifest, revision, mode: 'local', project: null, branch: null, serverTime: new Date().toISOString() });
  }
  if (url === '/api/admin/promotions' && (!options.method || options.method === 'GET')) {
    if (failPromotions) return response({ error: 'Canal décorations indisponible', code: 'GITHUB_READ' }, 503);
    return response({ manifest: promotionManifest, revision: promotionRevision, mode: 'local', project: null, branch: null, serverTime: new Date().toISOString() });
  }
  if (url === '/api/admin/promotions' && options.method === 'PUT') {
    const body = JSON.parse(options.body);
    assert.strictEqual(body.revision, promotionRevision);
    promotionManifest = body.manifest;
    promotionRevision = `revision-promotion-${promotionWrites.length + 1}`;
    promotionWrites.push(body);
    return response({ manifest: promotionManifest, revision: promotionRevision, mode: 'local', project: null, branch: null, serverTime: new Date().toISOString() });
  }
  if (url === '/api/admin/store-products' && (!options.method || options.method === 'GET')) {
    return response({ manifest: storeManifest, revision: storeRevision, mode: 'local', project: null, branch: null, serverTime: new Date().toISOString() });
  }
  if (url === '/api/admin/store-products' && options.method === 'PUT') {
    const body = JSON.parse(options.body);
    assert.strictEqual(body.revision, storeRevision);
    storeManifest = body.manifest;
    storeRevision = `revision-store-${storeWrites.length + 1}`;
    storeWrites.push(body);
    return response({ manifest: storeManifest, revision: storeRevision, mode: 'local', project: null, branch: null, serverTime: new Date().toISOString() });
  }
  throw new Error(`Requête inattendue ${options.method || 'GET'} ${url}`);
};

async function waitFor(condition, label) {
  for (let index = 0; index < 200; index += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Délai dépassé : ${label}`);
}

(async () => {
  assert.ok(html.includes('viewport-fit=cover'));
  assert.ok(html.indexOf('src="/promotion-effects.js"') < html.indexOf('src="/admin/admin.js"'));
  assert.deepStrictEqual(
    Array.from(window.document.querySelectorAll('#promotion-variant option'), (option) => option.value),
    ['gift', 'bells', 'snow', 'confetti', 'fireworks', 'hearts', 'blossom', 'halloween', 'badge']
  );
  assert.ok(adminCss.includes('@media (max-width: 760px)'));
  assert.ok(adminCss.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'));
  assert.ok(adminCss.includes('height: 100dvh'));
  assert.ok(adminCss.includes('input, select { min-height: 48px; font-size: 16px; }'));
  assert.ok(adminCss.includes('.nav-short-label { display: inline; }'));
  window.eval(effectsScript);
  window.eval(storeAdminScript);
  window.eval(script);
  await waitFor(() => !window.document.getElementById('admin-view').classList.contains('hidden'), 'connexion');
  await waitFor(() => window.document.querySelectorAll('#announcements-list .announcement-row').length === initialAnnouncementCount, 'liste initiale');
  assert.strictEqual(window.document.getElementById('stat-total').textContent, String(initialAnnouncementCount));

  window.document.querySelector('[data-new-event]').click();
  assert.ok(!window.document.getElementById('editor-modal').classList.contains('hidden'));
  const template = window.document.getElementById('item-template');
  template.value = 'maintenance-thanks';
  template.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.strictEqual(window.document.getElementById('item-title-fr').value, 'Merci pour votre patience');
  assert.strictEqual(window.document.getElementById('item-theme').value, 'celebration');
  assert.strictEqual(window.document.getElementById('item-font').value, 'elegant');
  assert.strictEqual(window.document.getElementById('item-avatar-count').textContent, '3/3');
  assert.strictEqual(window.document.querySelectorAll('#preview-avatars img').length, 3);
  assert.ok(window.document.getElementById('preview-slide').classList.contains('announcement-theme-celebration'));
  assert.strictEqual(writes.length, 0, 'Le modèle reste un brouillon et ne publie rien automatiquement');
  const firstPreset = window.document.querySelector('[data-avatar-preset="assets/avatars/team-1.svg"]');
  firstPreset.click();
  assert.strictEqual(window.document.querySelectorAll('#preview-avatars img').length, 2);
  firstPreset.click();
  assert.strictEqual(window.document.querySelectorAll('#preview-avatars img').length, 3);
  const title = '<img src=x data-injected> Événement test';
  const message = '<script>window.__xss = true</script> Message test';
  window.document.getElementById('item-title-fr').value = title;
  window.document.getElementById('item-message-fr').value = message;
  window.document.getElementById('item-starts-at').value = '2030-01-01T10:00';
  window.document.getElementById('item-expires-at').value = '2030-12-31T20:00';
  window.document.getElementById('item-message-fr').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.strictEqual(window.document.getElementById('preview-title').textContent, title);
  window.document.getElementById('announcement-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => writes.length === 1, 'création');
  await waitFor(() => window.document.getElementById('editor-modal').classList.contains('hidden'), 'fermeture éditeur');
  assert.strictEqual(manifest.announcements.length, initialAnnouncementCount + 1);
  assert.strictEqual(manifest.announcements[initialAnnouncementCount].startsAt, '2030-01-01T10:00:00.000Z');
  const createdAnnouncement = manifest.announcements[initialAnnouncementCount];
  const createdAnnouncementId = createdAnnouncement.id;
  assert.strictEqual(createdAnnouncement.theme, 'celebration');
  assert.strictEqual(createdAnnouncement.font, 'elegant');
  assert.strictEqual(createdAnnouncement.avatars.length, 3);
  assert.ok(createdAnnouncement.avatars.every((avatar) => /^assets\/avatars\/team-[123]\.svg$/.test(avatar)));
  const newRow = window.document.querySelector(`[data-announcement-id="${createdAnnouncementId}"]`);
  assert.ok(newRow.textContent.includes('<img src=x data-injected>'));
  assert.strictEqual(newRow.querySelector('[data-injected]'), null);
  assert.strictEqual(newRow.querySelector('script'), null);
  assert.notStrictEqual(window.__xss, true);
  assert.strictEqual(createdAnnouncement.enabled, true);

  newRow.querySelector(`[data-announcement-toggle="${createdAnnouncementId}"]`).click();
  await waitFor(() => writes.length === 2, 'désactivation individuelle');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin désactivation individuelle');
  let disabledRow = window.document.querySelector(`[data-announcement-id="${createdAnnouncementId}"]`);
  assert.strictEqual(manifest.announcements[initialAnnouncementCount].enabled, false);
  assert.strictEqual(manifest.enabled, true, 'Le canal global reste activé');
  assert.ok(disabledRow.classList.contains('is-disabled'));
  assert.ok(disabledRow.textContent.includes('Désactivée'));
  assert.strictEqual(manifest.announcements[initialAnnouncementCount].backgroundImage, createdAnnouncement.backgroundImage);
  assert.deepStrictEqual(manifest.announcements[initialAnnouncementCount].avatars, createdAnnouncement.avatars);
  assert.strictEqual(manifest.announcements[initialAnnouncementCount].startsAt, createdAnnouncement.startsAt);
  disabledRow.querySelector('.button-quiet').click();
  window.document.getElementById('announcement-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => writes.length === 3, 'modification annonce désactivée');
  await waitFor(() => window.document.getElementById('editor-modal').classList.contains('hidden'), 'fermeture modification annonce désactivée');
  assert.strictEqual(manifest.announcements[initialAnnouncementCount].enabled, false, 'La modification ne réactive pas silencieusement');
  disabledRow = window.document.querySelector(`[data-announcement-id="${createdAnnouncementId}"]`);
  disabledRow.querySelector(`[data-announcement-toggle="${createdAnnouncementId}"]`).click();
  await waitFor(() => writes.length === 4, 'réactivation individuelle');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin réactivation individuelle');
  assert.strictEqual(manifest.announcements[initialAnnouncementCount].enabled, true);
  assert.deepStrictEqual(manifest.announcements[initialAnnouncementCount].avatars, createdAnnouncement.avatars);

  const enabled = window.document.getElementById('manifest-enabled');
  enabled.checked = false;
  enabled.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => writes.length === 5, 'désactivation');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin désactivation');
  assert.strictEqual(manifest.enabled, false);

  const deleteButton = window.document.querySelector(`[data-announcement-id="${createdAnnouncementId}"] .button-danger`);
  deleteButton.click();
  await waitFor(() => writes.length === 6, 'suppression');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin suppression');
  assert.strictEqual(manifest.announcements.length, initialAnnouncementCount);

  window.document.querySelector('[data-section="promotions"]').click();
  assert.strictEqual(window.document.getElementById('page-title').textContent, 'Effets & décorations');
  assert.strictEqual(window.document.querySelectorAll('[data-shop-visibility-toggle]').length, 16);
  let visibilityToggle = window.document.querySelector('[data-shop-visibility-toggle="machine:1"]');
  assert.strictEqual(visibilityToggle.checked, true, 'Les produits existants sont visibles par défaut');
  visibilityToggle.checked = false;
  visibilityToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => promotionWrites.length === 1, 'masquage machine');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin masquage machine');
  assert.deepStrictEqual(promotionManifest.hiddenShopItems.machine, [1]);
  assert.strictEqual(promotionManifest.promotions.length, initialPromotionCount);
  visibilityToggle = window.document.querySelector('[data-shop-visibility-toggle="battery:0"]');
  visibilityToggle.checked = false;
  visibilityToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => promotionWrites.length === 2, 'masquage batterie indépendant');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin masquage batterie');
  assert.deepStrictEqual(promotionManifest.hiddenShopItems.battery, [0]);
  assert.deepStrictEqual(promotionManifest.hiddenShopItems.machine, [1]);
  visibilityToggle = window.document.querySelector('[data-shop-visibility-toggle="machine:1"]');
  visibilityToggle.checked = true;
  visibilityToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => promotionWrites.length === 3, 'réactivation machine');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin réactivation machine');
  assert.deepStrictEqual(promotionManifest.hiddenShopItems.machine, []);
  assert.deepStrictEqual(promotionManifest.hiddenShopItems.battery, [0]);
  window.document.querySelector('#section-promotions [data-new-promotion]').click();
  assert.ok(!window.document.getElementById('promotion-editor-modal').classList.contains('hidden'));
  const promotionLabel = '<img src=x data-promotion-xss> NOËL';
  window.document.getElementById('promotion-target-type').value = 'battery';
  window.document.getElementById('promotion-target-position').value = '2';
  window.document.getElementById('promotion-variant').value = 'bells';
  window.document.getElementById('promotion-variant').dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.getElementById('promotion-animated').checked = false;
  window.document.getElementById('promotion-animated').dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.getElementById('promotion-label-fr').value = promotionLabel;
  window.document.getElementById('promotion-label-en').value = 'MERRY CHRISTMAS';
  window.document.getElementById('promotion-starts-at').value = '2030-12-01T08:00';
  window.document.getElementById('promotion-expires-at').value = '2030-12-31T20:00';
  window.document.getElementById('promotion-label-fr').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.strictEqual(window.document.getElementById('promotion-preview-label').textContent, promotionLabel);
  assert.strictEqual(window.document.getElementById('promotion-preview-target').textContent, 'Batterie n°2');
  assert.ok(window.document.querySelector('#promotion-preview-card .promotion-effect-bells svg'));
  assert.ok(window.document.getElementById('promotion-preview-card').classList.contains('promotion-effect-static'));
  assert.strictEqual(window.document.querySelector('#promotion-preview-card .promotion-effect-particles'), null);
  window.document.getElementById('promotion-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => promotionWrites.length === 4, 'création décoration');
  await waitFor(() => window.document.getElementById('promotion-editor-modal').classList.contains('hidden'), 'fermeture éditeur décoration');
  assert.strictEqual(promotionManifest.promotions.length, initialPromotionCount + 1);
  const createdPromotion = promotionManifest.promotions[initialPromotionCount];
  const createdPromotionId = createdPromotion.id;
  assert.strictEqual(createdPromotion.targetType, 'battery');
  assert.strictEqual(createdPromotion.targetId, 1);
  assert.strictEqual(createdPromotion.variant, 'bells');
  assert.strictEqual(createdPromotion.animated, false);
  assert.strictEqual(createdPromotion.startsAt, '2030-12-01T08:00:00.000Z');
  const promotionRow = window.document.querySelector(`[data-promotion-id="${createdPromotionId}"]`);
  assert.ok(promotionRow.textContent.includes(promotionLabel));
  assert.strictEqual(promotionRow.querySelector('[data-promotion-xss]'), null);
  assert.strictEqual(promotionRow.querySelector('script'), null);
  assert.notStrictEqual(window.__xss, true);

  assert.ok(promotionRow.querySelector('.promotion-effect-bells svg'));
  promotionRow.querySelector('.button-quiet').click();
  window.document.getElementById('promotion-target-position').value = '3';
  window.document.getElementById('promotion-variant').value = 'gift';
  window.document.getElementById('promotion-animated').checked = true;
  window.document.getElementById('promotion-variant').dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.ok(window.document.querySelectorAll('#promotion-preview-card .promotion-particle').length > 0);
  window.document.getElementById('promotion-label-fr').value = 'CADEAU DE NOËL';
  window.document.getElementById('promotion-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => promotionWrites.length === 5, 'modification décoration');
  await waitFor(() => window.document.getElementById('promotion-editor-modal').classList.contains('hidden'), 'fermeture modification décoration');
  assert.strictEqual(promotionManifest.promotions[initialPromotionCount].targetId, 2);
  assert.strictEqual(promotionManifest.promotions[initialPromotionCount].variant, 'gift');
  assert.strictEqual(promotionManifest.promotions[initialPromotionCount].animated, true);

  const promotionsEnabled = window.document.getElementById('promotions-enabled');
  promotionsEnabled.checked = false;
  promotionsEnabled.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => promotionWrites.length === 6, 'désactivation décorations');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin désactivation décorations');
  assert.strictEqual(promotionManifest.enabled, false);

  window.document.querySelector(`[data-promotion-id="${createdPromotionId}"] .button-danger`).click();
  await waitFor(() => promotionWrites.length === 7, 'suppression décoration');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin suppression décoration');
  assert.strictEqual(promotionManifest.promotions.length, initialPromotionCount);

  window.document.querySelector('[data-section="store"]').click();
  assert.strictEqual(window.document.getElementById('page-title').textContent, 'FITIA STORE');
  window.document.querySelector('#section-store [data-new-store-product]').click();
  assert.ok(!window.document.getElementById('store-editor-modal').classList.contains('hidden'));
  const storeProductName = '<img src=x data-store-xss> Téléphone test';
  window.document.getElementById('store-name-fr').value = storeProductName;
  window.document.getElementById('store-name-en').value = 'Test phone';
  window.document.getElementById('store-description-fr').value = 'Produit physique dropshipping';
  window.document.getElementById('store-source-type').value = 'dropshipping';
  window.document.getElementById('store-category').value = 'electronics';
  window.document.getElementById('store-seller-id').value = 'seller-test';
  window.document.getElementById('store-seller-name').value = 'Vendeur test';
  window.document.getElementById('store-seller-contact').value = '@seller-test';
  window.document.getElementById('store-payment-address').value = '0x1111111111111111111111111111111111111111';
  window.document.getElementById('store-price-token').value = 'USDT';
  window.document.getElementById('store-price').value = '19.99';
  window.document.getElementById('store-shipping-fee').value = '1.01';
  window.document.getElementById('store-stock').value = '7';
  window.document.getElementById('store-delivery-estimate').value = '3 à 7 jours';
  window.document.getElementById('store-name-fr').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.strictEqual(window.document.getElementById('store-preview-name').textContent, storeProductName);
  window.document.getElementById('store-product-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => storeWrites.length === 1, 'création produit STORE');
  await waitFor(() => window.document.getElementById('store-editor-modal').classList.contains('hidden'), 'fermeture éditeur STORE');
  assert.strictEqual(storeManifest.products.length, 1);
  const createdStoreProduct = storeManifest.products[0];
  assert.strictEqual(createdStoreProduct.sourceType, 'dropshipping');
  assert.strictEqual(createdStoreProduct.price, '19.99');
  assert.strictEqual(createdStoreProduct.shippingFee, '1.01');
  assert.strictEqual(createdStoreProduct.stock, 7);
  const storeRow = window.document.querySelector(`[data-store-product-id="${createdStoreProduct.id}"]`);
  assert.ok(storeRow.textContent.includes(storeProductName));
  assert.strictEqual(storeRow.querySelector('[data-store-xss]'), null);
  assert.strictEqual(storeRow.querySelector('script'), null);
  const storeEnabled = window.document.getElementById('store-enabled');
  storeEnabled.checked = true;
  storeEnabled.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => storeWrites.length === 2, 'activation STORE');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin activation STORE');
  assert.strictEqual(storeManifest.enabled, true);
  window.document.querySelector(`[data-store-product-id="${createdStoreProduct.id}"] .button-danger`).click();
  await waitFor(() => storeWrites.length === 3, 'suppression produit STORE');
  assert.strictEqual(storeManifest.products.length, 0);

  manifest.announcements[0].title.fr = 'Annonce rechargée malgré la panne';
  failPromotions = true;
  window.document.getElementById('refresh-button').click();
  await waitFor(() => !window.document.getElementById('promotions-list-error').classList.contains('hidden'), 'panne indépendante des décorations');
  assert.ok(window.document.querySelector('#announcements-list .announcement-row').textContent.includes('Annonce rechargée malgré la panne'));
  assert.strictEqual(window.document.getElementById('promotions-list-error').textContent, 'Canal décorations indisponible');
  console.log('  ✅ UI admin : annonces, décorations et FITIA STORE — CRUD, aperçu, activation, panne isolée et blocage XSS validés');
  window.close();
})().catch((error) => {
  console.error(error);
  window.close();
  process.exit(1);
});
