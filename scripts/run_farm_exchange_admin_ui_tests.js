#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const { JSDOM } = require(fs.existsSync('/tmp/test-deps/node_modules/jsdom') ? '/tmp/test-deps/node_modules/jsdom' : 'jsdom');
const html = fs.readFileSync('admin/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://admin.test/' });
const w = dom.window; w.setInterval = () => 0; w.confirm = () => true;
w.eval(fs.readFileSync('admin/farm-admin.js', 'utf8'));
let current = { rateUnits: '100000000', version: 1, enabled: false, updatedAt: null }, submitted = [];
const api = async (url, opts = {}) => {
  if (url.endsWith('/farm-withdrawals')) return { withdrawals: [] };
  if (url.endsWith('/farm-exchange-draft')) {
    if (opts.method === 'PATCH') { submitted.push(opts.body); current = { ...current, rateUnits: opts.body.rateUnits, version: current.version + 1 }; }
    return { draft: { ...current } };
  }
  throw Error('Unexpected request');
};
const byId = id => w.document.getElementById(id);
const admin = w.FitiaFarmAdmin.create({ byId, api, setLoading() {}, setConnection() {}, showToast() {}, formatDate() {}, makeButton() {} });
function waitFor(condition) { return new Promise((resolve, reject) => { const start = Date.now(); function check() { if (condition()) resolve(); else if (Date.now() - start > 3000) reject(new Error('timeout')); else setTimeout(check, 5); } check(); }); }
(async () => {
  admin.bindEvents(); await admin.load();
  assert.strictEqual(byId('farm-rate-draft').classList.contains('hidden'), false);
  assert.ok(byId('farm-rate-draft').textContent.includes('brouillon non actif'));
  const input = byId('farm-rate-draft-input'); assert.strictEqual(input.value, '1');
  input.value = '0,5'; byId('farm-rate-draft-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => submitted.length === 1 && byId('farm-rate-draft-status').textContent.includes('enregistré'));
  assert.strictEqual(submitted[0].rateUnits, '50000000'); assert.strictEqual(submitted[0].expectedVersion, 1);
  assert.strictEqual(input.value, '0.5');
  input.value = '0'; byId('farm-rate-draft-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.strictEqual(submitted.length, 1); assert.ok(byId('farm-rate-draft-status').textContent.includes('limites'));
  w.confirm = () => false; input.value = '2'; byId('farm-rate-draft-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.strictEqual(submitted.length, 1); admin.reset(); assert.ok(byId('farm-rate-draft').classList.contains('hidden'));
  console.log('Interface admin : brouillon désactivé, conversion décimale, limites et confirmation OK');
  dom.window.close();
})().catch(e => { console.error(e); dom.window.close(); process.exitCode = 1; });
