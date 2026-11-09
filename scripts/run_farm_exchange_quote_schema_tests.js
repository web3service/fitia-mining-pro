'use strict';
const assert = require('assert');
const fs = require('fs');
const s = fs.readFileSync('supabase/migrations/20261108050000_farm_exchange_quote_draft.sql', 'utf8').toLowerCase();
for (const part of ['enable row level security', 'from public, anon, authenticated, service_role', 'grant select', 'pg_advisory_xact_lock', 'for share', 'farm_quote_id_conflict', 'farm_quote_rate_changed', 'farm_quote_amount', 'coins::numeric * rate_units::numeric = amount_units * 100', 'security definer set search_path = public']) assert.ok(s.includes(part), part);
assert.ok(!/\b(update|insert into|delete from)\s+public\.farm_accounts\b/.test(s));
assert.ok(!/\b(update|insert into|delete from)\s+public\.farm_withdrawals\b/.test(s));
console.log('Registre de devis isolé : contraintes et permissions présentes (contrôle statique)');
