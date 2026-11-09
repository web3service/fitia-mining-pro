'use strict';
const assert = require('assert');
const fs = require('fs');
const s = fs.readFileSync('supabase/migrations/20261108070000_farm_exchange_withdrawal_simulation.sql', 'utf8').toLowerCase();
for (const p of ['farm_exchange_sim_accounts', 'farm_exchange_sim_withdrawals', 'status = \'simulated\'', 'for share', 'for update', 'clock_timestamp()', 'farm_sim_expired', 'farm_sim_rate_changed', 'farm_sim_balance', 'enable row level security', 'from public, anon, authenticated, service_role', 'security definer set search_path = public']) assert.ok(s.includes(p), p);
assert.ok(!/\b(update|insert into|delete from)\s+public\.farm_accounts\b/.test(s));
assert.ok(!/\b(update|insert into|delete from)\s+public\.farm_withdrawals\b/.test(s));
console.log('Retrait simulé : débit et taux verrouillés sans accès aux comptes réels (contrôle statique)');
