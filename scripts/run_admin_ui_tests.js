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
const script = fs.readFileSync(path.join(ROOT, 'admin/admin.js'), 'utf8');
let manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'announcements.json'), 'utf8'));
let revision = 'revision-initiale';
const writes = [];
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
  window.eval(script);
  await waitFor(() => !window.document.getElementById('admin-view').classList.contains('hidden'), 'connexion');
  await waitFor(() => window.document.querySelectorAll('#announcements-list .announcement-row').length === 4, 'liste initiale');
  assert.strictEqual(window.document.getElementById('stat-total').textContent, '4');

  window.document.querySelector('[data-new-event]').click();
  assert.ok(!window.document.getElementById('editor-modal').classList.contains('hidden'));
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
  assert.strictEqual(manifest.announcements.length, 5);
  assert.strictEqual(manifest.announcements[4].startsAt, '2030-01-01T10:00:00.000Z');
  const newRow = window.document.querySelector('[data-announcement-id^="event-"]');
  assert.ok(newRow.textContent.includes('<img src=x data-injected>'));
  assert.strictEqual(newRow.querySelector('[data-injected]'), null);
  assert.strictEqual(newRow.querySelector('script'), null);
  assert.notStrictEqual(window.__xss, true);

  const enabled = window.document.getElementById('manifest-enabled');
  enabled.checked = false;
  enabled.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => writes.length === 2, 'désactivation');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin désactivation');
  assert.strictEqual(manifest.enabled, false);

  const deleteButton = window.document.querySelector('[data-announcement-id^="event-"] .button-danger');
  deleteButton.click();
  await waitFor(() => writes.length === 3, 'suppression');
  await waitFor(() => window.document.getElementById('loading-overlay').classList.contains('hidden'), 'fin suppression');
  assert.strictEqual(manifest.announcements.length, 4);
  console.log('  ✅ UI admin : connexion, liste, création, dates, désactivation, suppression et blocage XSS validés');
  window.close();
})().catch((error) => {
  console.error(error);
  window.close();
  process.exit(1);
});
