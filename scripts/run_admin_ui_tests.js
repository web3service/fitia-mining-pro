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
const storeCatalogScript = fs.readFileSync(path.join(ROOT, 'store-catalog.js'), 'utf8');
const storeAdminScript = fs.readFileSync(path.join(ROOT, 'admin/store-admin.js'), 'utf8');
const ordersAdminScript = fs.readFileSync(path.join(ROOT, 'admin/orders-admin.js'), 'utf8');
const farmAdminScript = fs.readFileSync(path.join(ROOT, 'admin/farm-admin.js'), 'utf8');
const gameVisibilityConfigScript = fs.readFileSync(path.join(ROOT, 'game-visibility-config.js'), 'utf8');
const gamesAdminScript = fs.readFileSync(path.join(ROOT, 'admin/games-admin.js'), 'utf8');
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
let gameManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'game-visibility.json'), 'utf8'));
let gameRevision = 'revision-games-initiale';
const gameWrites = [];
let storeManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'store-products.json'), 'utf8'));
// Le scénario CRUD part d’un catalogue vide en mémoire et ne touche pas au catalogue éditorial réel.
storeManifest = { ...storeManifest, enabled: false, products: [] };
let storeRevision = 'revision-store-initiale';
const storeWrites = [];
const orderUpdates = [];
let orders = [{
  id: '7b0f7399-ca7a-4b6f-a4f1-9f4266f0f21c', orderNumber: 'FITS-ADMIN-0001',
  buyerAddress: '0x9999999999999999999999999999999999999999',
  sellerName: 'FITIA Seller', sellerContact: '@fitia-seller', paymentAddress: '0x1111111111111111111111111111111111111111',
  txHash: `0x${'ab'.repeat(32)}`, status: 'paid', token: 'USDT', total: '26', totalUnits: '26000000',
  items: [{ productId: 'product-phone', name: { fr: 'Téléphone FITIA' }, quantity: 2, price: '12.5' }],
  delivery: { name: '<img src=x data-order-xss> Client privé', phone: '+49 000 111', country: 'Germany', city: 'Frankfurt', address: '1 Private Street', notes: '<script>window.__orderXss=true</script>' },
  carrier: '', trackingNumber: '', createdAt: '2026-10-28T10:00:00.000Z', updatedAt: '2026-10-28T10:00:00.000Z', paidAt: '2026-10-28T10:00:00.000Z'
}];
let farmWithdrawals = [{
  id: '0eb65a4e-2d33-4cbe-a834-f2f76d9b98f0', wallet: '0x9999999999999999999999999999999999999999',
  coins: 500, ftaUnits: '500000000', status: 'pending', createdAt: '2026-10-28T10:00:00.000Z', paidAt: null, payoutTxHash: null
}];
const farmUpdates = [];
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
  if (url === '/api/admin/game-visibility' && (!options.method || options.method === 'GET')) {
    return response({ manifest: gameManifest, revision: gameRevision, mode: 'local', project: null, branch: null, serverTime: new Date().toISOString() });
  }
  if (url === '/api/admin/game-visibility' && options.method === 'PUT') {
    const body = JSON.parse(options.body);
    assert.strictEqual(body.revision, gameRevision);
    gameManifest = body.manifest;
    gameRevision = `revision-games-${gameWrites.length + 1}`;
    gameWrites.push(body);
    return response({ manifest: gameManifest, revision: gameRevision, mode: 'local', project: null, branch: null, serverTime: new Date().toISOString() });
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
  if (url === '/api/admin/store-orders' && (!options.method || options.method === 'GET')) {
    return response({ orders: JSON.parse(JSON.stringify(orders)), serverTime: new Date().toISOString() });
  }
  if (url === '/api/admin/store-orders' && options.method === 'PATCH') {
    assert.ok(options.headers['X-CSRF-Token']);
    const body = JSON.parse(options.body);
    orderUpdates.push(body);
    orders = orders.map((order) => order.id === body.orderId ? { ...order, status: body.status, carrier: body.carrier, trackingNumber: body.trackingNumber, updatedAt: new Date().toISOString() } : order);
    return response({ order: JSON.parse(JSON.stringify(orders.find((order) => order.id === body.orderId))) });
  }
  if (url === '/api/admin/farm-withdrawals' && (!options.method || options.method === 'GET')) {
    return response({ withdrawals: JSON.parse(JSON.stringify(farmWithdrawals)), serverTime: new Date().toISOString() });
  }
  if (url === '/api/admin/farm-withdrawals' && options.method === 'PATCH') {
    assert.ok(options.headers['X-CSRF-Token']);
    const body = JSON.parse(options.body); farmUpdates.push(body);
    farmWithdrawals = farmWithdrawals.map((item) => item.id === body.id ? { ...item, status: 'paid', payoutTxHash: body.txHash, paidAt: new Date().toISOString() } : item);
    return response({ pending: false, withdrawal: JSON.parse(JSON.stringify(farmWithdrawals.find((item) => item.id === body.id))) });
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
  window.eval(storeCatalogScript);
  window.eval(gameVisibilityConfigScript);
  window.eval(gamesAdminScript);
  window.eval(storeAdminScript);
  window.eval(ordersAdminScript);
  window.eval(farmAdminScript);
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

  window.document.querySelector('[data-section="games"]').click();
  assert.strictEqual(window.document.getElementById('page-title').textContent, 'Visibilité des jeux');
  assert.strictEqual(window.document.getElementById('section-games').classList.contains('hidden'), false);
  assert.strictEqual(window.document.querySelectorAll('[data-game-visibility-toggle]').length, 5);
  assert.strictEqual(window.document.querySelectorAll('#game-visibility-list .game-visibility-logo img').length, 5);
  assert.strictEqual(window.document.getElementById('game-visible-count').textContent, '5 / 5 visibles');
  let gameToggle = window.document.querySelector('[data-game-visibility-toggle="dice"]');
  gameToggle.checked = false;
  gameToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => gameWrites.length === 1, 'masquage Dice');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin masquage Dice');
  assert.deepStrictEqual(gameManifest.hiddenGames, ['dice']);
  assert.ok(window.document.querySelector('[data-game-visibility="dice"]').classList.contains('is-hidden'));
  assert.strictEqual(window.document.getElementById('game-visible-count').textContent, '4 / 5 visibles');
  gameToggle = window.document.querySelector('[data-game-visibility-toggle="crash"]');
  gameToggle.checked = false;
  gameToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => gameWrites.length === 2, 'masquage Crash indépendant');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin masquage Crash');
  assert.deepStrictEqual(gameManifest.hiddenGames, ['dice', 'crash']);
  gameToggle = window.document.querySelector('[data-game-visibility-toggle="dice"]');
  gameToggle.checked = true;
  gameToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => gameWrites.length === 3, 'réaffichage Dice');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin réaffichage Dice');
  assert.deepStrictEqual(gameManifest.hiddenGames, ['crash']);
  gameToggle = window.document.querySelector('[data-game-visibility-toggle="crash"]');
  gameToggle.checked = true;
  gameToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => gameWrites.length === 4, 'réaffichage Crash');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin réaffichage Crash');
  assert.deepStrictEqual(gameManifest.hiddenGames, []);
  assert.strictEqual(window.document.getElementById('game-visible-count').textContent, '5 / 5 visibles');

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
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin suppression produit STORE');
  assert.strictEqual(storeManifest.products.length, 0);

  const countrySelect = window.document.getElementById('store-delivery-country');
  assert.strictEqual(countrySelect.options.length, 250, 'Tous les codes ISO pays sont disponibles, avec le choix vide');
  countrySelect.value = 'FR';
  countrySelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.getElementById('store-add-country').click();
  await waitFor(() => storeWrites.length === 4, 'ajout du pays France');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin ajout du pays France');
  assert.deepStrictEqual(storeManifest.shippingCountries, ['FR']);
  assert.ok(window.document.querySelector('[data-country-code="FR"]').textContent.includes('France'));
  assert.strictEqual(window.document.querySelector('[data-country-code="FR"] img').getAttribute('src'), '/assets/flags/fr.svg');
  countrySelect.value = 'DE';
  countrySelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.getElementById('store-add-country').click();
  await waitFor(() => storeWrites.length === 5, 'ajout du pays Allemagne');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin ajout du pays Allemagne');
  assert.deepStrictEqual(storeManifest.shippingCountries, ['FR', 'DE']);
  assert.strictEqual(window.document.querySelectorAll('#store-country-list .store-country-chip').length, 2);
  window.document.querySelector('[data-country-code="FR"] .store-country-remove').click();
  await waitFor(() => storeWrites.length === 6, 'retrait du pays France');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin retrait du pays France');
  assert.deepStrictEqual(storeManifest.shippingCountries, ['DE']);
  assert.strictEqual(window.document.querySelectorAll('#store-country-list .store-country-chip').length, 1);

  manifest.announcements[0].title.fr = 'Annonce rechargée malgré la panne';
  failPromotions = true;
  window.document.getElementById('refresh-button').click();
  await waitFor(() => !window.document.getElementById('promotions-list-error').classList.contains('hidden'), 'panne indépendante des décorations');
  assert.ok(window.document.querySelector('#announcements-list .announcement-row').textContent.includes('Annonce rechargée malgré la panne'));
  assert.strictEqual(window.document.getElementById('promotions-list-error').textContent, 'Canal décorations indisponible');

  window.document.querySelector('[data-section="orders"]').click();
  await waitFor(() => window.document.querySelectorAll('#orders-list .seller-order-card').length === 1, 'chargement commandes privées');
  assert.strictEqual(window.document.getElementById('page-title').textContent, 'Commandes clients');
  const orderCard = window.document.querySelector('#orders-list .seller-order-card');
  assert.ok(orderCard.textContent.includes('<img src=x data-order-xss> Client privé'));
  assert.strictEqual(orderCard.querySelector('[data-order-xss]'), null);
  assert.strictEqual(orderCard.querySelector('script'), null);
  assert.notStrictEqual(window.__orderXss, true);
  orderCard.querySelector('[data-order-status]').value = 'shipped';
  orderCard.querySelector('[data-order-carrier]').value = 'DHL';
  orderCard.querySelector('[data-order-tracking]').value = 'TRACK-ADMIN-123';
  orderCard.querySelector('[data-order-save]').click();
  await waitFor(() => orderUpdates.length === 1, 'mise à jour du suivi vendeur');
  assert.strictEqual(orderUpdates[0].status, 'shipped');
  assert.strictEqual(orderUpdates[0].trackingNumber, 'TRACK-ADMIN-123');
  await waitFor(() => window.document.getElementById('orders-stat-shipped').textContent === '1', 'statut expédié affiché');
  assert.ok(window.document.querySelector('#orders-list .seller-order-card').textContent.includes('Expédiée'));
  assert.ok(adminCss.includes('.seller-order-controls'));

  window.document.querySelector('[data-section="farm"]').click();
  await waitFor(() => window.document.querySelectorAll('#farm-withdrawals-list .farm-withdrawal-card').length === 1, 'chargement retraits FARM');
  assert.strictEqual(window.document.getElementById('page-title').textContent, 'Retraits FITIA FARM');
  const farmCard = window.document.querySelector('#farm-withdrawals-list .farm-withdrawal-card');
  assert.ok(farmCard.textContent.includes('5 FTA'));
  farmCard.querySelector('[data-farm-payout-tx]').value = `0x${'cd'.repeat(32)}`;
  farmCard.querySelector('[data-farm-pay]').click();
  await waitFor(() => farmUpdates.length === 1, 'clôture retrait FARM');
  assert.strictEqual(farmUpdates[0].txHash, `0x${'cd'.repeat(32)}`);
  await waitFor(() => window.document.getElementById('farm-stat-paid').textContent === '1', 'retrait payé affiché');
  assert.ok(window.document.querySelector('#farm-withdrawals-list .farm-withdrawal-card').textContent.includes('Payé · vérifié'));
  assert.ok(adminCss.includes('.farm-withdrawal-controls'));
  console.log('  ✅ UI admin : annonces, décorations, visibilité des jeux, STORE, commandes et retraits FARM — CRUD, suivi privé, mobile et blocage XSS validés');
  window.close();
})().catch((error) => {
  console.error(error);
  window.close();
  process.exit(1);
});
