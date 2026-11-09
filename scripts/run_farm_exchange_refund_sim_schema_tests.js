'use strict';
const assert = require('assert');
const fs = require('fs');
const s = fs.readFileSync('supabase/migrations/20261108090000_farm_exchange_refund_simulation.sql', 'utf8').toLowerCase();
for (const x of ["status = 'simulated_only'", 'primary key (source_tx_hash, source_log_index)', 'unique (payout_tx_hash, payout_log_index)', 'foreign key (source_tx_hash, source_log_index)', 'pg_advisory_xact_lock', 'for update', 'farm_sim_refund_conflict', 'farm_sim_refund_event', 'farm_sim_receipt_event_used', 'before insert', 'enable row level security', 'from public, anon, authenticated, service_role']) assert.ok(s.includes(x), x);
assert.ok(!/\b(update|insert into|delete from)\s+public\.farm_(accounts|withdrawals)\b/.test(s));
console.log('Remboursement simulé : unicité des reçus et permissions préparées (contrôle statique)');
