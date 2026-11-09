'use strict';
// Preparation only. No API uses this verifier and no balances are changed.
// The provider must be supplied by the server, never by the requesting client.
const ethers = require('./vendor/ethers.umd.min.js');
const Config = require('./farm-config');
const transferTopic = ethers.id('Transfer(address,address,uint256)').toLowerCase();
class ReceiptError extends Error { constructor(code) { super(code); this.code = code; } }
function fail(code) { throw new ReceiptError(code); }
function hash(value) { return typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value); }
function integer(n) { return Number.isSafeInteger(n) && n >= 0; }
async function inspectDeposit(provider, txHash, logIndex, expectation, confirmations = 128) {
  if (!provider || !hash(txHash) || !integer(logIndex) || !expectation || !ethers.isAddress(expectation.from)
      || !ethers.isAddress(expectation.to) || typeof expectation.amountUnits !== 'string'
      || !/^[1-9][0-9]*$/.test(expectation.amountUnits) || expectation.amountUnits.length > 20
      || !Number.isSafeInteger(confirmations) || confirmations < 3) fail('RECEIPT_PARAMS');
  const network = await provider.getNetwork();
  if (BigInt(network.chainId) !== BigInt(Config.CHAIN_ID)) fail('RECEIPT_NETWORK');
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return { status: 'pending' };
  if (!hash(receipt.hash) || receipt.hash.toLowerCase() !== txHash.toLowerCase() || !integer(receipt.blockNumber) || !hash(receipt.blockHash)) fail('RECEIPT_INVALID');
  if (receipt.status !== 1) fail('RECEIPT_FAILED');
  const block = await provider.getBlock(receipt.blockNumber);
  if (!block || !hash(block.hash) || block.hash.toLowerCase() !== receipt.blockHash.toLowerCase()
      || block.number !== receipt.blockNumber || !integer(block.timestamp) || !Number.isSafeInteger(block.timestamp * 1000)) fail('RECEIPT_REORG');
  const latest = await provider.getBlockNumber();
  if (!integer(latest) || latest < receipt.blockNumber) fail('RECEIPT_REORG');
  const logs = Array.isArray(receipt.logs) ? receipt.logs.filter(log => log && log.index === logIndex) : [];
  if (logs.length !== 1) fail('RECEIPT_LOG');
  const log = logs[0];
  const from = ethers.zeroPadValue(expectation.from, 32).toLowerCase();
  const to = ethers.zeroPadValue(expectation.to, 32).toLowerCase();
  if (String(log.address).toLowerCase() !== Config.FTA_CONTRACT.toLowerCase()
      || !Array.isArray(log.topics) || log.topics.length !== 3
      || String(log.topics[0]).toLowerCase() !== transferTopic
      || String(log.topics[1]).toLowerCase() !== from || String(log.topics[2]).toLowerCase() !== to
      || typeof log.data !== 'string' || !/^0x[0-9a-f]{64}$/i.test(log.data)
      || BigInt(log.data) !== BigInt(expectation.amountUnits)
      || log.removed === true) fail('RECEIPT_MISMATCH');
  if (latest - receipt.blockNumber + 1 < confirmations) return { status: 'pending' };
  return Object.freeze({ status: 'confirmed', confirmed: true, txHash: txHash.toLowerCase(), logIndex,
    blockNumber: receipt.blockNumber, blockHash: receipt.blockHash.toLowerCase(), blockTimeMs: block.timestamp * 1000,
    from: expectation.from.toLowerCase(), to: expectation.to.toLowerCase(), amountUnits: expectation.amountUnits });
}
module.exports = Object.freeze({ inspectDeposit, ReceiptError });
