'use strict';
const assert = require('assert');
const crypto = require('crypto');
const ethers = require('../vendor/ethers.umd.min.js');
const Config = require('../farm-config');
const { SupabaseExchangeSimulationRepository } = require('../farm-exchange-simulation-repository');
const { createRefundReviewSimulation } = require('../farm-exchange-refund-review-simulation');
(async () => {
  const wallet = ethers.Wallet.createRandom().address.toLowerCase(), sourceTx = `0x${'11'.repeat(32)}`, payoutTx = `0x${'22'.repeat(32)}`, hash = `0x${'33'.repeat(32)}`;
  const q = { quoteId: crypto.randomUUID(), wallet, direction: 'deposit', coins: '100', amountUnits: '100000000', rateUnits: '100000000', rateVersion: 1, issuedAt: 1699999000000, expiresAt: 1699999999000 };
  const source = { quote_id: q.quoteId, status: 'refund_required', reason: 'late', tx_hash: sourceTx, log_index: 1, block_number: 100, block_hash: hash, block_time_ms: 1700000000000 };
  const transfer = (from, to, index) => ({ index, address: Config.FTA_CONTRACT, topics: [ethers.id('Transfer(address,address,uint256)'), ethers.zeroPadValue(from, 32), ethers.zeroPadValue(to, 32)], data: ethers.toBeHex(100000000, 32) });
  let latest = 227, recorded = [];
  const provider = { getNetwork: async () => ({ chainId: 137n }), getTransactionReceipt: async tx => ({ hash: tx, blockNumber: 100, blockHash: hash, status: 1, logs: [tx === sourceTx ? transfer(wallet, Config.TREASURY_ADDRESS, 1) : transfer(Config.TREASURY_ADDRESS, wallet, 2)] }), getBlock: async () => ({ number: 100, hash, timestamp: 1700000000 }), getBlockNumber: async () => latest };
  const repo = new SupabaseExchangeSimulationRepository({ request: async (method, path, body) => {
    if (method === 'GET' && path.startsWith('farm_exchange_receipt_draft?')) return [source];
    if (path === 'rpc/farm_exchange_sim_get_quote') return q;
    if (path === 'rpc/farm_exchange_sim_record_refund') { recorded.push(body); return { status: 'simulated_only' }; }
    throw Error('Unexpected request');
  } });
  const review = createRefundReviewSimulation(repo, provider);
  assert.strictEqual((await review.review(sourceTx, 1, { txHash: payoutTx, logIndex: 2 })).status, 'simulated_only');
  assert.deepStrictEqual(recorded[0], { p_source_tx_hash: sourceTx, p_source_log_index: 1, p_payout_tx_hash: payoutTx, p_payout_log_index: 2, p_payout_block_number: 100, p_payout_block_hash: hash, p_payout_block_time_ms: 1700000000000 });
  latest = 226; assert.strictEqual((await review.review(sourceTx, 1, { txHash: payoutTx, logIndex: 2 })).status, 'pending_source'); assert.strictEqual(recorded.length, 1);
  await assert.rejects(review.review('invalid', 1, { txHash: payoutTx, logIndex: 2 }), e => e.code === 'SIM_REFUND_SOURCE');
  console.log('Remboursement simulé : preuves vérifiées avant enregistrement isolé, sans envoi réel');
})().catch(e => { console.error(e); process.exitCode = 1; });
