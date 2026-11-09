'use strict';
const Exchange = require('./farm-exchange');
const { FarmError, SupabaseFarmRepository } = require('./farm-service');

// An administrative draft has no effect on real deposits or withdrawals.
function createExchangeDraftService(repository) {
  if (!repository || typeof repository.read !== 'function' || typeof repository.stage !== 'function') throw new Error('Exchange draft repository required.');
  function validateRevision(version) {
    if (!Number.isSafeInteger(version) || version < 1 || version > Number.MAX_SAFE_INTEGER - 1) throw new FarmError(400, 'Version de taux invalide.', 'FARM_EXCHANGE_PARAMS');
  }
  async function get() {
    const data = await repository.read();
    if (!data || data.enabled !== false || !Number.isSafeInteger(data.version) || data.version < 1) throw new FarmError(503, 'Brouillon de taux indisponible.', 'FARM_EXCHANGE_STORAGE');
    try { Exchange.validateRateUnits(data.rateUnits); }
    catch (_) { throw new FarmError(503, 'Brouillon de taux invalide.', 'FARM_EXCHANGE_STORAGE'); }
    return { rateUnits: data.rateUnits, version: data.version, enabled: false, updatedAt: data.updatedAt || null };
  }
  async function stage(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FarmError(400, 'Taux invalide.', 'FARM_EXCHANGE_PARAMS');
    try { Exchange.validateRateUnits(input.rateUnits); } catch (_) { throw new FarmError(400, 'Taux invalide.', 'FARM_EXCHANGE_PARAMS'); }
    validateRevision(input.expectedVersion);
    await repository.stage(input.rateUnits, input.expectedVersion);
    return get();
  }
  return Object.freeze({ get, stage });
}
class MemoryExchangeDraftRepository {
  constructor() { this.data = { rateUnits: '100000000', version: 1, enabled: false, updatedAt: null }; this.history = []; }
  async read() { return { ...this.data }; }
  async stage(rateUnits, expectedVersion) {
    if (this.data.version !== expectedVersion) throw new FarmError(409, 'Le brouillon a changé. Rechargez.', 'FARM_EXCHANGE_REVISION');
    if (this.data.rateUnits === rateUnits) throw new FarmError(409, 'Le taux est inchangé.', 'FARM_EXCHANGE_UNCHANGED');
    const before = this.data.rateUnits;
    this.data = { rateUnits, version: expectedVersion + 1, enabled: false, updatedAt: new Date().toISOString() };
    this.history.push({ oldRateUnits: before, newRateUnits: rateUnits, version: this.data.version });
  }
}
class SupabaseExchangeDraftRepository {
  constructor(repository = new SupabaseFarmRepository()) { this.repository = repository; }
  async read() {
    const rows = await this.repository.request('GET', 'farm_exchange_draft?id=eq.1&select=rate_units,version,enabled,updated_at&limit=1');
    const row = rows?.[0];
    return row ? { rateUnits: String(row.rate_units), version: Number(row.version), enabled: row.enabled, updatedAt: row.updated_at } : null;
  }
  async stage(rateUnits, version) {
    await this.repository.request('POST', 'rpc/farm_exchange_stage_rate', { p_rate_units: rateUnits, p_expected_version: version });
  }
}
let defaultDraft;
function getDefaultExchangeDraftService() {
  if (!defaultDraft) defaultDraft = createExchangeDraftService(new SupabaseExchangeDraftRepository());
  return defaultDraft;
}
module.exports = { createExchangeDraftService, MemoryExchangeDraftRepository, SupabaseExchangeDraftRepository, getDefaultExchangeDraftService };
