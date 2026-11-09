'use strict';
const assert = require('assert');
const ethers = require('../vendor/ethers.umd.min.js');
const config = require('../farm-config');
const { inspectDeposit } = require('../farm-exchange-receipt');
const from = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', to = config.TREASURY_ADDRESS;
const tx = `0x${'11'.repeat(32)}`, bh = `0x${'22'.repeat(32)}`;
const log = { index: 7, address: config.FTA_CONTRACT, topics: [ethers.id('Transfer(address,address,uint256)'), ethers.zeroPadValue(from, 32), ethers.zeroPadValue(to, 32)], data: ethers.toBeHex(100000000, 32), removed: false };
const receipt = { hash: tx, blockHash: bh, blockNumber: 100, status: 1, logs: [log] };
const block = { hash: bh, number: 100, timestamp: 1700000000 };
function provider(overrides = {}) { return { getNetwork: async () => ({ chainId: 137n }), getTransactionReceipt: async () => receipt, getBlock: async () => block, getBlockNumber: async () => 227, ...overrides }; }
const expectation = { from, to, amountUnits: '100000000' };
(async () => {
  const verify = (p, idx = 7, exp = expectation) => inspectDeposit(p, tx, idx, exp);
  const ok = await verify(provider()); assert.strictEqual(ok.status, 'confirmed'); assert.strictEqual(ok.logIndex, 7); assert.strictEqual(ok.blockTimeMs, 1700000000000);
  assert.strictEqual((await verify(provider({ getBlockNumber: async () => 226 }))).status, 'pending');
  assert.strictEqual((await verify(provider({ getTransactionReceipt: async () => null }))).status, 'pending');
  const rejected = async (p, code, idx = 7) => assert.rejects(verify(p, idx), e => e.code === code);
  await rejected(provider({ getNetwork: async () => ({ chainId: 1n }) }), 'RECEIPT_NETWORK');
  await rejected(provider({ getTransactionReceipt: async () => ({ ...receipt, status: 0 }) }), 'RECEIPT_FAILED');
  await rejected(provider({ getBlock: async () => ({ ...block, hash: `0x${'33'.repeat(32)}` }) }), 'RECEIPT_REORG');
  await rejected(provider(), 'RECEIPT_LOG', 8);
  await rejected(provider({ getTransactionReceipt: async () => ({ ...receipt, logs: [log, log] }) }), 'RECEIPT_LOG');
  for (const change of [{ address: from }, { data: ethers.toBeHex(999, 32) }, { removed: true }, { topics: [log.topics[0], log.topics[2], log.topics[1]] }])
    await rejected(provider({ getTransactionReceipt: async () => ({ ...receipt, logs: [{ ...log, ...change }] }) }), 'RECEIPT_MISMATCH');
  await assert.rejects(inspectDeposit(provider(), tx, 7, expectation, 1), e => e.code === 'RECEIPT_PARAMS');
  console.log('Polygon simulé : réseau, événement unique, montants, confirmations et réorganisation vérifiés');
})().catch(e => { console.error(e); process.exitCode = 1; });
