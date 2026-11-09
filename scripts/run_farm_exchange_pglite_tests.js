#!/usr/bin/env node
'use strict';
// Local in-memory PostgreSQL-compatible integration test. No network, publication or real funds.
const assert = require('assert');
const fs = require('fs');
const ethers = require('../vendor/ethers.umd.min.js');
const { PGlite } = require('@electric-sql/pglite');
const Config = require('../farm-config');
const Protocol = require('../farm-exchange-protocol');
const { SupabaseExchangeSimulationRepository } = require('../farm-exchange-simulation-repository');
const { createQuoteSimulation } = require('../farm-exchange-quote-simulation');
const { createWithdrawalSimulation } = require('../farm-exchange-withdrawal-simulation');
const { createDepositSimulation } = require('../farm-exchange-deposit-simulation');
const { createRefundReviewSimulation } = require('../farm-exchange-refund-review-simulation');
const migrations = [
  '20261108040000_farm_exchange_draft.sql', '20261108050000_farm_exchange_quote_draft.sql',
  '20261108060000_farm_exchange_receipt_draft.sql', '20261108070000_farm_exchange_withdrawal_simulation.sql',
  '20261108080000_farm_exchange_sim_quote_read.sql', '20261108090000_farm_exchange_refund_simulation.sql'
];
(async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    for (const file of migrations) await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
    const calls = {
      farm_exchange_create_quote_draft: ['p_quote_id', 'p_wallet', 'p_direction', 'p_coins', 'p_amount_units', 'p_expected_version', 'p_issued_at_ms', 'p_expires_at_ms'],
      farm_exchange_sim_get_quote: ['p_quote_id'], farm_exchange_sim_withdraw: ['p_quote_id', 'p_wallet'],
      farm_exchange_record_receipt_draft: ['p_quote_id', 'p_tx_hash', 'p_log_index', 'p_block_number', 'p_block_hash', 'p_block_time_ms'],
      farm_exchange_sim_record_refund: ['p_source_tx_hash', 'p_source_log_index', 'p_payout_tx_hash', 'p_payout_log_index', 'p_payout_block_number', 'p_payout_block_hash', 'p_payout_block_time_ms']
    };
    const storage = { async request(method, path, body) {
      if (method === 'GET' && path.startsWith('farm_exchange_draft?')) return (await db.query('select rate_units,version,enabled from public.farm_exchange_draft where id=1')).rows;
      if (method === 'GET' && path.startsWith('farm_exchange_receipt_draft?')) {
        const url = new URL(`https://isolated.invalid/${path}`);
        return (await db.query('select * from public.farm_exchange_receipt_draft where tx_hash=$1 and log_index=$2', [url.searchParams.get('tx_hash').slice(3), Number(url.searchParams.get('log_index').slice(3))])).rows;
      }
      const fn = path.startsWith('rpc/') && path.slice(4); const fields = calls[fn];
      if (method !== 'POST' || !fields) throw Error('Unexpected storage path');
      const result = await db.query(`select public.${fn}(${fields.map((_, i) => `$${i + 1}`).join(',')}) as result`, fields.map(key => body[key]));
      return result.rows[0].result;
    } };
    const repo = new SupabaseExchangeSimulationRepository(storage), wallet = ethers.Wallet.createRandom(), address = wallet.address.toLowerCase();
    const now = Date.now(), issue = createQuoteSimulation(repo, { now: () => now });
    await db.query('insert into public.farm_exchange_sim_accounts(wallet,coins) values($1,2000)', [address]);
    const first = await issue.issue({ wallet: address, direction: 'withdraw', coins: '1000' });
    const stale = await issue.issue({ wallet: address, direction: 'withdraw', coins: '1000' });
    const signed = await wallet.signMessage(Protocol.message(first)); const staleSig = await wallet.signMessage(Protocol.message(stale));
    const withdraw = createWithdrawalSimulation(repo);
    const paid = await withdraw.withdraw(first.quoteId, signed); assert.strictEqual(paid.status, 'simulated'); assert.strictEqual(paid.amount_units, '1000000000');
    await db.query('select public.farm_exchange_stage_rate($1,$2)', ['50000000', 1]);
    const replay = await withdraw.withdraw(first.quoteId, signed); assert.strictEqual(replay.amount_units, '1000000000');
    await assert.rejects(withdraw.withdraw(stale.quoteId, staleSig), /FARM_SIM_RATE_CHANGED/);
    assert.strictEqual(Number((await db.query('select coins from public.farm_exchange_sim_accounts where wallet=$1', [address])).rows[0].coins), 1000);
    const deposit = await issue.issue({ wallet: address, direction: 'deposit', coins: '100' }); const depositSig = await wallet.signMessage(Protocol.message(deposit));
    const sourceTx = `0x${'11'.repeat(32)}`, payoutTx = `0x${'22'.repeat(32)}`, hash = `0x${'33'.repeat(32)}`;
    // Payment arrives after quote expiration; separate confirmed return is simulated.
    const lateSeconds = Math.ceil(deposit.expiresAt / 1000) + 1;
    const transfer = (from, to, index) => ({ index, address: Config.FTA_CONTRACT, topics: [ethers.id('Transfer(address,address,uint256)'), ethers.zeroPadValue(from, 32), ethers.zeroPadValue(to, 32)], data: ethers.toBeHex(BigInt(deposit.amountUnits), 32) });
    const provider = { getNetwork: async () => ({ chainId: 137n }), getTransactionReceipt: async tx => ({ hash: tx, blockNumber: 100, blockHash: hash, status: 1, logs: [tx === sourceTx ? transfer(address, Config.TREASURY_ADDRESS, 1) : transfer(Config.TREASURY_ADDRESS, address, 2)] }), getBlock: async () => ({ number: 100, hash, timestamp: lateSeconds }), getBlockNumber: async () => 227 };
    const observe = createDepositSimulation(repo, provider); const receipt = await observe.observe(deposit.quoteId, depositSig, sourceTx, 1);
    assert.strictEqual(receipt.status, 'refund_required'); assert.strictEqual(receipt.reason, 'late');
    const review = createRefundReviewSimulation(repo, provider); const result = await review.review(sourceTx, 1, { txHash: payoutTx, logIndex: 2 });
    assert.strictEqual(result.status, 'simulated_only');
    assert.strictEqual((await review.review(sourceTx, 1, { txHash: payoutTx, logIndex: 2 })).status, 'simulated_only');
    await assert.rejects(db.query('insert into public.farm_exchange_receipt_draft(tx_hash,log_index,quote_id,block_number,block_hash,block_time_ms,status,reason) values($1,2,$2,100,$3,$4,\'refund_required\',\'late\')', [payoutTx, deposit.quoteId, hash, lateSeconds * 1000]), /FARM_SIM_RECEIPT_EVENT_USED/);
    assert.strictEqual(Number((await db.query('select coins from public.farm_exchange_sim_accounts where wallet=$1', [address])).rows[0].coins), 1000);
    console.log('SQL intégral en mémoire : devis, retrait, changement de taux, dépôt tardif et remboursement simulé OK');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
