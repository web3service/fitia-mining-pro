#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { MfaService } = require('../mfa/service');
const { SupabaseMfaRepository } = require('../mfa/supabase-repository');
const { hotp } = require('../mfa/totp');
const { readFileSync } = require('fs');
const user = '7b0f7399-ca7a-4b6f-a4f1-9f4266f0f21c';
const data = new Map();
let casCalls = 0;
async function fetcher(url, options) {
  assert.strictEqual(options.headers.Authorization, 'Bearer test-service-key');
  assert.strictEqual(options.headers.apikey, 'test-service-key');
  if (url.includes('/rpc/')) {
    casCalls++;
    const p = JSON.parse(options.body);
    const row = data.get(p.p_user_id);
    const valid = row ? row.revision === p.p_expected_revision : p.p_expected_revision === -1 && p.p_record !== null;
    if (valid) {
      data.set(p.p_user_id, { revision: row ? row.revision + 1 : 1, record: structuredClone(p.p_record) });
    }
    return { ok: true, json: async () => valid };
  }
  const id = new URL(url).searchParams.get('user_id').slice(3);
  const row = data.get(id);
  return { ok: true, json: async () => row ? [structuredClone(row)] : [] };
}
(async () => {
  const repo = new SupabaseMfaRepository({ url: 'https://db.example.test', serviceRoleKey: 'test-service-key', fetch: fetcher });
  let now = 1800000000000;
  const service = new MfaService({ repository: repo, key: crypto.randomBytes(32), now: () => now });
  const { secret } = await service.beginEnrollment(user);
  const { recoveryCodes } = await service.confirmEnrollment(user, hotp(secret, Math.floor(now / 30000)));
  now += 30000;
  const simultaneous = await Promise.allSettled(Array.from({ length: 5 }, () => service.consumeCode(user, hotp(secret, Math.floor(now / 30000)))));
  assert.strictEqual(simultaneous.filter((result) => result.status === 'fulfilled').length, 1);
  assert.ok(casCalls >= 5, 'Conflicts are retried rather than accepted');
  const recover = await Promise.allSettled([service.consumeCode(user, recoveryCodes[0]), service.consumeCode(user, recoveryCodes[0])]);
  assert.strictEqual(recover.filter((result) => result.status === 'fulfilled').length, 1);
  await service.disable(user, recoveryCodes[1]);
  const tombstoneRevision = data.get(user).revision;
  assert.strictEqual(data.get(user).record, null);
  await service.beginEnrollment(user);
  assert.ok(data.get(user).revision > tombstoneRevision, 'Revision must not repeat after disable');
  const sql = readFileSync('supabase/migrations/20261107040000_mfa_preparation.sql', 'utf8');
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on function[^;]+from public, anon, authenticated/i);
  console.log('MFA repository tests passed: shared CAS, concurrent replay and recovery.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
