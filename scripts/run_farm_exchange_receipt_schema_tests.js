'use strict';
const assert = require('assert');
const fs = require('fs');
const s = fs.readFileSync('supabase/migrations/20261108060000_farm_exchange_receipt_draft.sql', 'utf8').toLowerCase();
for (const part of ['primary key (tx_hash, log_index)', 'where status = \'eligible\'', 'pg_advisory_xact_lock', 'for update', 'farm_receipt_conflict', 'refund_required', 'before_issue', 'duplicate_payment', 'enable row level security', 'from public, anon, authenticated, service_role', 'security definer set search_path = public']) assert.ok(s.includes(part), part);
assert.ok(!/\b(update|insert into|delete from)\s+public\.farm_accounts\b/.test(s));
assert.ok(!/\b(update|insert into|delete from)\s+public\.farm_withdrawals\b/.test(s));
console.log('Registre de reçus isolé : anti-rejeu et rapprochement préparés (contrôle statique)');
