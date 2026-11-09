'use strict';
// Prepared administration service. Not connected to the administration API.
const { validateRateUnits } = require('./farm-exchange');
class LiveRateError extends Error { constructor(code) { super('Réglage du taux indisponible ou invalide.'); this.code = code; this.status = code === 'LIVE_RATE_PARAMS' ? 400 : 503; } }
function createLiveRateService(repository) {
  if (!repository || typeof repository.get !== 'function' || typeof repository.set !== 'function') throw new TypeError('Live rate storage required');
  function validate(record) {
    if (!record || !Number.isSafeInteger(record.version) || record.version < 1 || typeof record.enabled !== 'boolean') throw new LiveRateError('LIVE_RATE_STORAGE');
    try { validateRateUnits(record.rateUnits); } catch (_) { throw new LiveRateError('LIVE_RATE_STORAGE'); }
    return record;
  }
  return Object.freeze({
    async get() { return validate(await repository.get()); },
    async set(input) {
      if (!input || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 || input.expectedVersion >= Number.MAX_SAFE_INTEGER) throw new LiveRateError('LIVE_RATE_PARAMS');
      try { validateRateUnits(input.rateUnits); } catch (_) { throw new LiveRateError('LIVE_RATE_PARAMS'); }
      // Return RPC's own snapshot rather than a separate read that can race.
      return validate(await repository.set(input.rateUnits,input.expectedVersion));
    }
  });
}
class SupabaseLiveRateRepository {
  constructor(storage) { if (!storage || typeof storage.request !== 'function') throw new TypeError('Storage required'); this.storage=storage; }
  async get() {
    const rows=await this.storage.request('GET','farm_live_exchange_rate?id=eq.1&select=rate_units,version,enabled&limit=1'); const row=rows?.[0];
    return row ? {rateUnits:String(row.rate_units),version:Number(row.version),enabled:row.enabled} : null;
  }
  set(rateUnits,expectedVersion) { return this.storage.request('POST','rpc/farm_live_set_rate',{p_rate_units:rateUnits,p_expected_version:expectedVersion}); }
}
module.exports=Object.freeze({createLiveRateService,SupabaseLiveRateRepository,LiveRateError});
