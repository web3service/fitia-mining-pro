#!/usr/bin/env node
'use strict';
// Real HTTP preview server with isolated in-memory data; never contacts Polygon.
const assert = require('assert');
const crypto = require('crypto');
const net = require('net');
const { spawn } = require('child_process');
const ethers = require('../vendor/ethers.umd.min.js');
const Protocol = require('../farm-protocol');
const Config = require('../farm-config');
const fs = require('fs');
const { JSDOM } = require(fs.existsSync('/tmp/test-deps/node_modules/jsdom') ? '/tmp/test-deps/node_modules/jsdom' : 'jsdom');
async function availablePort() {
  const socket = net.createServer(); await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve)); return port;
}
(async () => {
  const port = await availablePort(); const root = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['scripts/preview-farm.js'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Preview did not start')), 10000);
      child.stdout.on('data', data => { if (String(data).includes('disponible')) { clearTimeout(timer); resolve(); } });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview exited ${code}`)); });
    });
    const post = async (path, body) => {
      const response = await fetch(root + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json(); assert.ok(response.ok, `${path} ${response.status}: ${JSON.stringify(data)}`); return data;
    };
    const wallet = ethers.Wallet.createRandom(); const address = wallet.address;
    const sign = async (action, params = {}) => {
      const body = { action, buyer: address, timestamp: Date.now(), ...params }; body.signature = await wallet.signMessage(Protocol.message(action, body)); return body;
    };
    await post('/preview/init', { wallet: address });
    let state = (await post('/preview/farm', await sign('state'))).state;
    assert.strictEqual(state.coins, 2000); assert.strictEqual(state.animals.filter(a => a.species === 'goat').length, 2);
    assert.ok(state.animals.some(a => a.species === 'duck')); const growing = state.crops.find(c => c.species === 'maize'); assert.ok(growing.readyAt > Date.now());
    const id = crypto.randomUUID(); const fertilize = await sign('action', { actionId: id, type: 'fertilize_crop', params: { cropId: growing.id } });
    state = (await post('/preview/farm', fertilize)).state; assert.strictEqual(state.coins, 1996); assert.strictEqual(state.crops.find(c => c.id === growing.id).readyAt, growing.readyAt - 180000);
    state = (await post('/preview/farm', fertilize)).state; assert.strictEqual(state.coins, 1996);
    const goats = state.animals.filter(a => a.species === 'goat').map(a => a.id); const birth = crypto.randomUUID();
    state = (await post('/preview/farm', await sign('action', { actionId: birth, type: 'breed_animal', params: { parentIds: goats } }))).state;
    assert.strictEqual(state.coins, 1996 - Math.ceil(Config.ANIMALS.goat.price * Config.BREED_PRICE_PERCENT / 100)); assert.ok(state.animals.find(a => a.id === birth).maturesAt > Date.now());
    await post('/preview/ready', { wallet: address }); state = (await post('/preview/farm', await sign('state'))).state;
    assert.ok(state.animals.find(a => a.id === birth).maturesAt <= Date.now()); assert.ok(state.crops.every(c => c.readyAt <= Date.now()));
    const txHash = '0x' + crypto.randomBytes(32).toString('hex');
    const deposit = await sign('deposit', { actionId: crypto.randomUUID(), txHash, amountUnits: ethers.parseUnits('10', 8).toString() });
    const before = state.coins; state = (await post('/preview/farm', deposit)).state; assert.strictEqual(state.coins, before + 1000);
    await post('/preview/reset', { wallet: address, starter: true }); state = (await post('/preview/farm', await sign('state'))).state;
    assert.strictEqual(state.coins, 2000); assert.strictEqual(state.animals.length, 0); assert.strictEqual(state.land, null);
    for (const path of ['/', '/farm.js', '/farm-3d.js', '/assets/farm/goat.svg', '/assets/farm/duck.svg']) assert.strictEqual((await fetch(root + path)).status, 200, path);
    // Browser scripts and clicks are exercised in jsdom with a stub 3D renderer.
    const markup = fs.readFileSync('scripts/farm-preview.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const dom = new JSDOM(markup, { url: root + '/', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window; Object.defineProperty(w, 'crypto', { value: crypto.webcrypto });
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
    w.fetch = (url, options) => fetch(new URL(url, root), options); w.confirm = () => true;
    try {
      for (const file of ['vendor/ethers.umd.min.js', 'farm-config.js', 'farm-protocol.js']) w.eval(fs.readFileSync(file, 'utf8'));
      w.FitiaFarm3D = { create() { return { setState() {}, setActive() {}, focus() {}, zoom() {}, rotate() {}, dispose() {} }; } };
      for (const file of ['farm.js', 'game-experience-farm.js', 'scripts/farm-preview-client.js']) w.eval(fs.readFileSync(file, 'utf8'));
      const until = async (test) => { for (let i = 0; i < 200; i++) { if (test()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Preview UI timeout'); };
      await until(() => w.App.farmCenter.state && w.App.farmCenter.scene);
      assert.strictEqual(w.App.currentLang, 'fr'); assert.strictEqual(w.App.farmCenter.state.animals.length, 6);
      w.document.querySelector('[data-preview-action="fertilize"]').click();
      assert.strictEqual(w.document.getElementById('farm-dialog-title').textContent, 'Engrais');
      const beforeCoins = w.App.farmCenter.state.coins; w.document.querySelector('#farm-dialog-actions button').click();
      await until(() => !w.App.farmCenter.operation && w.App.farmCenter.state.coins === beforeCoins - 4);
      w.document.querySelector('[data-preview-action="breed"]').click();
      assert.strictEqual(w.document.getElementById('farm-dialog-title').textContent, 'Reproduction');
      w.document.querySelector('#farm-dialog-actions button').click(); await until(() => !w.App.farmCenter.operation && w.App.farmCenter.state.animals.length === 7);
      assert.ok(w.App.farmCenter.state.animals.some(a => a.maturesAt > Date.now()));
      w.document.getElementById('preview-ready').click(); await until(() => w.App.farmCenter.state.animals.every(a => !(a.maturesAt > Date.now())));
      console.log('Aperçu UI simulé : raccourcis français, engrais, reproduction et accélération OK');
    } finally { w.App?.farmCenter?.scene?.dispose(); w.close(); }
    console.log('Aperçu HTTP : initialisation, animaux, engrais, reproduction, accélération, conversion fictive et réinitialisation OK');
  } finally { child.kill('SIGTERM'); }
})().catch(error => { console.error(error); process.exitCode = 1; });
