'use strict';

// Shared optimistic concurrency: every state change commits against the exact
// revision it was calculated from. Retries recompute the whole decision, so
// concurrent verification of a TOTP/recovery code cannot both succeed.
class SupabaseMfaRepository {
  constructor({ url, serviceRoleKey, fetch: fetcher = global.fetch }) {
    this.url = String(url || '').replace(/\/+$/, '');
    this.key = String(serviceRoleKey || '');
    this.fetch = fetcher;
    if (!/^https:\/\//i.test(this.url) || !this.key || typeof this.fetch !== 'function') throw new Error('MFA repository not configured');
  }
  async request(path, options = {}) {
    const headers = { apikey: this.key, Accept: 'application/json' };
    if (!this.key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${this.key}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await this.fetch(`${this.url}/rest/v1/${path}`, {
      method: options.method || 'GET', headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store', signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('MFA repository unavailable');
    return response.json();
  }
  async findUserByWallet(wallet) {
    if (typeof wallet !== 'string' || !/^0x[0-9a-f]{40}$/.test(wallet)) throw new Error('Invalid wallet');
    const rows = await this.request(`app_user_profiles?select=user_id,wallet_verified_at&wallet_address=eq.${encodeURIComponent(wallet)}&limit=2`);
    if (!Array.isArray(rows) || rows.length > 1) throw new Error('Invalid wallet association');
    if (!rows.length) return null;
    if (!rows[0].wallet_verified_at || typeof rows[0].user_id !== 'string') throw new Error('Invalid wallet association');
    return rows[0].user_id;
  }
  async transact(id, fn) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const rows = await this.request(`app_mfa_factors?select=revision,record&user_id=eq.${encodeURIComponent(id)}&limit=1`);
      if (!Array.isArray(rows) || rows.length > 1) throw new Error('Invalid MFA repository response');
      const row = rows[0];
      if (row && (!Number.isSafeInteger(row.revision) || row.revision < 1 || (row.record !== null && (typeof row.record !== 'object' || Array.isArray(row.record))))) throw new Error('Invalid MFA record');
      const oldRecord = row ? row.record : null;
      const result = await fn(oldRecord === null ? null : structuredClone(oldRecord));
      if (result.record === undefined || JSON.stringify(result.record) === JSON.stringify(oldRecord)) return { value: result.value, error: result.error };
      const success = await this.request('rpc/app_mfa_compare_and_swap', {
        method: 'POST', body: { p_user_id: id, p_expected_revision: row ? row.revision : -1, p_record: result.record }
      });
      if (success === true) return { value: result.value, error: result.error };
      if (success !== false) throw new Error('Invalid MFA commit response');
    }
    throw new Error('MFA repository contention');
  }
}
module.exports = { SupabaseMfaRepository };
