#!/usr/bin/env node
'use strict';
// La suite couvre l’économie complète (moulin, puits, soins, engrais, reproduction, missions) : activation explicite.
// Le défaut de production reste désactivé ; voir scripts/run_farm_economy_gate_tests.js.
process.env.FITIA_FARM_UNVALIDATED_ECONOMY = 'true';
// Local, isolated demo server. No credentials or real financial operations.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ethers = require('../vendor/ethers.umd.min.js');
const { MemoryFarmRepository, createFarmService, defaultState } = require('../farm-service');
const { createFarmHandler } = require('../api/farm');
const ROOT = path.resolve(__dirname, '..');
const repository = new MemoryFarmRepository();
const service = createFarmService({ repository, paymentVerifier: async () => ({ confirmed: true }) });
const farmHandler = createFarmHandler({ farmService: service });
const files = new Map([
  ['/', 'scripts/farm-preview.html'], ['/preview-client.js', 'scripts/farm-preview-client.js'],
  ...['style.css', 'farm-config.js', 'farm-protocol.js', 'farm-3d.js', 'farm.js', 'game-experience-farm.js'].map(name => [`/${name}`, name]),
  ['/vendor/ethers.umd.min.js', 'vendor/ethers.umd.min.js'], ['/vendor/three.min.js', 'vendor/three.min.js']
]);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
function json(res, status, value) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); }
function seed(wallet) {
  if (repository.accounts.has(wallet)) return;
  const now = Date.now(); const state = defaultState(wallet, now);
  state.coins = 2000; state.feed = 8; state.land = { owned: true, level: 1, purchasedAt: now };
  state.animals = [
    { id: crypto.randomUUID(), species: 'chicken', acquiredAt: now, produceAt: now - 1000 },
    { id: crypto.randomUUID(), species: 'sheep', acquiredAt: now, produceAt: 0 },
    { id: crypto.randomUUID(), species: 'cow', acquiredAt: now, produceAt: 0 },
    { id: crypto.randomUUID(), species: 'goat', acquiredAt: now, produceAt: 0 },
    { id: crypto.randomUUID(), species: 'goat', acquiredAt: now, produceAt: 0 },
    { id: crypto.randomUUID(), species: 'duck', acquiredAt: now, produceAt: 0 }
  ];
  state.crops = [
    { id: crypto.randomUUID(), species: 'wheat', plot: 0, plantedAt: now - 1800000, readyAt: now - 1000 },
    { id: crypto.randomUUID(), species: 'carrot', plot: 2, plantedAt: now - 3600000, readyAt: now - 1000 },
    { id: crypto.randomUUID(), species: 'tomato', plot: 4, plantedAt: now - 3600000, readyAt: now - 1000 },
    { id: crypto.randomUUID(), species: 'maize', plot: 3, plantedAt: now, readyAt: now + 1800000 }
  ];
  state.inventory.wheat = 4; state.inventory.maize = 2; state.inventory.eggs = 2;
  repository.accounts.set(wallet, { state, revision: 1 });
}
async function readBody(req) {
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 32768) throw new Error('too large'); }
  const data = JSON.parse(raw); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid'); return data;
}
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://preview.invalid').pathname;
    if (req.method === 'POST' && (['/preview/init', '/preview/farm', '/preview/ready', '/preview/reset'].includes(pathname))) {
      const body = await readBody(req);
      if (pathname !== '/preview/farm') {
        if (!ethers.isAddress(body.wallet)) return json(res, 400, { error: 'Invalid demo wallet' });
        const wallet = body.wallet.toLowerCase();
        if (pathname === '/preview/reset') {
          repository.accounts.delete(wallet);
          for (const [id, action] of repository.actions) if (action.wallet === wallet) repository.actions.delete(id);
          for (const [id, withdrawal] of repository.withdrawals) if (withdrawal.wallet === wallet) repository.withdrawals.delete(id);
          for (const [hash, owner] of repository.transactions) if (owner === wallet) repository.transactions.delete(hash);
          seed(wallet);
          if (body.starter === true) {
            const record = repository.accounts.get(wallet);
            const state = defaultState(wallet, Date.now()); state.coins = 2000;
            record.state = state;
          }
          return json(res, 200, { ok: true });
        }
        if (pathname === '/preview/ready') {
          const record = repository.accounts.get(wallet);
          if (!record) return json(res, 404, { error: 'No demo farm.' });
          const now = Date.now();
          record.state.crops.forEach(crop => { crop.readyAt = now - 1; });
          record.state.animals.forEach(animal => { if (animal.produceAt) animal.produceAt = now - 1; if (animal.maturesAt > now) animal.maturesAt = now - 1; });
          record.revision += 1; return json(res, 200, { ok: true });
        }
        seed(wallet); return json(res, 200, { ok: true });
      }
      if (!['state', 'action', 'deposit', 'withdraw', 'resolve'].includes(body.action)) return json(res, 403, { error: 'Unsupported preview action.' });
      req.body = body; return farmHandler(req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Not allowed' });
    let relative = files.get(pathname);
    if (!relative && /^\/assets\/[a-zA-Z0-9_./-]+$/.test(pathname) && !pathname.includes('..')) relative = pathname.slice(1);
    if (!relative) return json(res, 404, { error: 'Not found' });
    const target = path.resolve(ROOT, relative);
    if (!target.startsWith(ROOT + path.sep)) return json(res, 403, { error: 'Forbidden' });
    const data = await fs.promises.readFile(target);
    res.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) { if (!res.headersSent) json(res, 400, { error: 'Preview request failed.' }); else res.end(); }
});
server.listen(Number(process.env.PORT || 4173), '0.0.0.0', () => console.log('Aperçu FITIA FARM disponible sur le port ' + (process.env.PORT || 4173)));
