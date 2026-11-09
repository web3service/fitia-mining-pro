'use strict';
// Explicitly injected storage only, no default config, API or production wiring.
class SupabaseExchangeSimulationRepository {
  constructor(storage) {
    if (!storage || typeof storage.request !== 'function') throw new TypeError('Storage required');
    this.storage = storage;
  }
  async getRate() {
    const rows = await this.storage.request('GET', 'farm_exchange_draft?id=eq.1&select=rate_units,version,enabled&limit=1');
    const row = rows?.[0];
    return row ? { rateUnits: String(row.rate_units), version: Number(row.version), enabled: row.enabled } : null;
  }
  async createQuote(q) {
    return this.storage.request('POST', 'rpc/farm_exchange_create_quote_draft', {
      p_quote_id: q.quoteId, p_wallet: q.wallet, p_direction: q.direction, p_coins: q.coins,
      p_amount_units: q.amountUnits, p_expected_version: q.rateVersion,
      p_issued_at_ms: q.issuedAt, p_expires_at_ms: q.expiresAt
    });
  }
  async getQuote(quoteId) {
    if (typeof quoteId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(quoteId)) return null;
    return this.storage.request('POST', 'rpc/farm_exchange_sim_get_quote', { p_quote_id: quoteId });
  }
  async getReceipt(txHash, logIndex) {
    if (typeof txHash !== 'string' || !/^0x[0-9a-f]{64}$/.test(txHash) || !Number.isSafeInteger(logIndex) || logIndex < 0 || logIndex > 2147483647) return null;
    const rows = await this.storage.request('GET', `farm_exchange_receipt_draft?tx_hash=eq.${txHash}&log_index=eq.${logIndex}&select=*&limit=1`);
    return rows?.[0] || null;
  }
  async recordSimulatedRefund(source, payout) {
    return this.storage.request('POST', 'rpc/farm_exchange_sim_record_refund', {
      p_source_tx_hash: source.txHash, p_source_log_index: source.logIndex,
      p_payout_tx_hash: payout.txHash, p_payout_log_index: payout.logIndex,
      p_payout_block_number: payout.blockNumber, p_payout_block_hash: payout.blockHash,
      p_payout_block_time_ms: payout.blockTimeMs
    });
  }
  async recordReceipt(quoteId, evidence) {
    return this.storage.request('POST', 'rpc/farm_exchange_record_receipt_draft', {
      p_quote_id: quoteId, p_tx_hash: evidence.txHash, p_log_index: evidence.logIndex,
      p_block_number: evidence.blockNumber, p_block_hash: evidence.blockHash, p_block_time_ms: evidence.blockTimeMs
    });
  }
  async simulateWithdrawal(quoteId, wallet) {
    return this.storage.request('POST', 'rpc/farm_exchange_sim_withdraw', { p_quote_id: quoteId, p_wallet: wallet });
  }
}
module.exports = Object.freeze({ SupabaseExchangeSimulationRepository });
