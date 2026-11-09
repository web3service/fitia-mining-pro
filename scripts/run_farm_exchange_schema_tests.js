#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const text = fs.readFileSync('supabase/migrations/20261108040000_farm_exchange_draft.sql', 'utf8');
assert.match(text, /check\s*\(enabled\s*=\s*false\)/i);
assert.match(text, /for update/i);
assert.match(text, /prior\.version\s*<>\s*p_expected_version/i);
assert.match(text, /insert into public\.farm_exchange_draft_history/i);
assert.match(text, /revoke all on function public\.farm_exchange_stage_rate\(bigint, bigint\) from public, anon, authenticated/i);
assert.match(text, /grant execute on function public\.farm_exchange_stage_rate\(bigint, bigint\) to service_role/i);
assert.match(text, /enable row level security/i);
console.log('Taux : brouillon désactivé, historique, verrou et droits présents (tests statiques)');
