#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { createExchangeDraftService, MemoryExchangeDraftRepository, SupabaseExchangeDraftRepository } = require('../farm-exchange-draft');
(async () => {
  const repo = new MemoryExchangeDraftRepository(); const service = createExchangeDraftService(repo);
  assert.deepStrictEqual(await service.get(), { rateUnits: '100000000', version: 1, enabled: false, updatedAt: null });
  await assert.rejects(service.stage({ rateUnits: '0', expectedVersion: 1 }), e => e.code === 'FARM_EXCHANGE_PARAMS');
  await assert.rejects(service.stage({ rateUnits: '5', expectedVersion: '1' }), e => e.code === 'FARM_EXCHANGE_PARAMS');
  let next = await service.stage({ rateUnits: '50000000', expectedVersion: 1 });
  assert.strictEqual(next.rateUnits, '50000000'); assert.strictEqual(next.enabled, false); assert.strictEqual(next.version, 2);
  await assert.rejects(service.stage({ rateUnits: '100000000', expectedVersion: 1 }), e => e.code === 'FARM_EXCHANGE_REVISION');
  await assert.rejects(service.stage({ rateUnits: '50000000', expectedVersion: 2 }), e => e.code === 'FARM_EXCHANGE_UNCHANGED');
  const results = await Promise.allSettled([service.stage({ rateUnits: '40000000', expectedVersion: 2 }), service.stage({ rateUnits: '30000000', expectedVersion: 2 })]);
  assert.strictEqual(results.filter(x => x.status === 'fulfilled').length, 1); assert.strictEqual(repo.history.length, 2);
  repo.data.enabled = true; await assert.rejects(service.get(), e => e.code === 'FARM_EXCHANGE_STORAGE');
  const calls = []; const http = new SupabaseExchangeDraftRepository({ async request(method, path, body) {
    calls.push({ method, path, body }); return method === 'GET' ? [{ rate_units: 100000000, version: 1, enabled: false }] : null;
  } });
  assert.strictEqual((await http.read()).rateUnits, '100000000'); await http.stage('50000000', 1);
  assert.deepStrictEqual(calls[1].body, { p_rate_units: '50000000', p_expected_version: 1 });
  console.log('Brouillon de taux : validation, historique, concurrence et RPC OK ; aucun taux actif');
})().catch(e => { console.error(e); process.exitCode = 1; });
