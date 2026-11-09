#!/usr/bin/env node
'use strict';
const assert = require('assert');
const http = require('http');
const { createAdminServer } = require('../admin-server');
const { createAdminHandler } = require('../api/admin');
const { createLiveRateService } = require('../farm-live-rate');
const { FarmError } = require('../farm-service');
const PASSWORD = 'test-password-not-real-123';
process.env.FITIA_ADMIN_PASSWORD = PASSWORD;
process.env.FITIA_GITHUB_TOKEN = 'test-github-not-real-123456';
delete process.env.FITIA_FARM_LIVE_RATE_ADMIN;
const repo = { data: { rateUnits:'100000000',version:1,enabled:false }, history:[],
  async get() { return {...this.data}; },
  async set(rateUnits,version) { if (this.data.version !== version) throw new FarmError(409,'Version périmée','LIVE_RATE_REVISION'); this.history.push(rateUnits); this.data={rateUnits,version:version+1,enabled:false}; return {...this.data}; }
}; const service = createLiveRateService(repo);
const local = createAdminServer({ password: PASSWORD, localMode: true, liveRateEnabled: true, liveRateService: service });
const enabled = createAdminHandler({ liveRateEnabled: true, liveRateService: service });
const disabled = createAdminHandler({ liveRateService: service });
function server(handler) { return http.createServer((req, res) => { req.query = { action: new URL(req.url, 'http://localhost').pathname.split('/').pop() }; return handler(req, res); }); }
const vercel = server(enabled), off = server(disabled);
async function listen(s) { await new Promise(resolve => s.listen(0, '127.0.0.1', resolve)); return `http://127.0.0.1:${s.address().port}/api/admin/`; }
async function request(base, route, method = 'GET', body, cookie, csrf) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json'; if (cookie) headers.Cookie = cookie; if (csrf) headers['X-CSRF-Token'] = csrf;
  const res = await fetch(base + route, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
(async () => {
  try {
    const [a, b, c] = await Promise.all([listen(local), listen(vercel), listen(off)]);
    for (const base of [a, b]) {
      assert.strictEqual((await request(base, 'farm-live-rate')).status, 401);
      const login = await request(base, 'login', 'POST', { password: PASSWORD }); assert.strictEqual(login.status, 200);
      const cookie = login.cookie, csrf = login.data.csrfToken;
      let r = await request(base, 'farm-live-rate', 'GET', null, cookie); assert.strictEqual(r.status, 200); assert.strictEqual(r.data.rate.enabled, false);
      const version = r.data.rate.version;
      r = await request(base, 'farm-live-rate', 'PATCH', { rateUnits: '40000000', expectedVersion: version }, cookie);
      assert.strictEqual(r.status, 403); assert.strictEqual((await service.get()).version, version);
      const target = base === a ? '50000000' : '60000000';
      r = await request(base, 'farm-live-rate', 'PATCH', { rateUnits: target, expectedVersion: version }, cookie, csrf);
      assert.strictEqual(r.status, 200); assert.strictEqual(r.data.rate.rateUnits, target); assert.strictEqual(r.data.rate.enabled, false);
      r = await request(base, 'farm-live-rate', 'PATCH', { rateUnits: '70000000', expectedVersion: version }, cookie, csrf);
      assert.strictEqual(r.status, 409);
    }
    const login = await request(c, 'login', 'POST', { password: PASSWORD });
    const blocked = await request(c, 'farm-live-rate', 'GET', null, login.cookie);
    assert.strictEqual(blocked.status, 404); assert.strictEqual(repo.history.length, 2);
    console.log('Administration du taux réel préparé : session, CSRF, révisions, route locale et Vercel, désactivation par défaut OK');
  } finally { await Promise.all([local, vercel, off].map(s => new Promise(resolve => s.close(resolve)))); }
})().catch(error => { console.error(error); process.exitCode = 1; });
