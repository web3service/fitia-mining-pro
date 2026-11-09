'use strict';
const fs = require('fs');
const assert = require('assert');
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec('create table public.farm_accounts(state jsonb); create table public.farm_withdrawals(coins bigint, fta_units text, status text);');
    await db.query('insert into public.farm_accounts values($1::jsonb)', [JSON.stringify({ coins: 530, inventory: { wheat: 1 } })]);
    // This pending withdrawal was recorded at a different rate; never recalculate it.
    await db.exec("insert into public.farm_withdrawals values(1000,'500000000','pending'),(1000,'999999999','paid')");
    const { rows: [row] } = await db.query(fs.readFileSync('scripts/farm-liability-report.sql', 'utf8'));
    assert.strictEqual(row.pending_withdrawal_fta_units, '500000000');
    assert.strictEqual(Number(row.partial_liability_fta), 10.42);
    assert.strictEqual(Number(row.invalid_fta_amounts), 0);
    await db.exec("insert into public.farm_withdrawals values(1000,'bad','pending')");
    const check = await db.query(fs.readFileSync('scripts/farm-liability-report.sql', 'utf8'));
    assert.strictEqual(Number(check.rows[0].invalid_fta_amounts), 1);
    console.log('Rapport SQL réel : montants FTA des retraits enregistrés conservés et anomalies signalées');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
