'use strict';

// Tests only. Process-local locking cannot protect a distributed deployment.
class MemoryMfaRepository {
  constructor() { this.records = new Map(); this.queues = new Map(); }
  async transact(id, fn) {
    const previous = this.queues.get(id) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => gate);
    this.queues.set(id, tail);
    await previous;
    try {
      const current = this.records.has(id) ? structuredClone(this.records.get(id)) : null;
      const result = await fn(current);
      if (result.record === null) this.records.delete(id);
      else if (result.record !== undefined) this.records.set(id, structuredClone(result.record));
      return { value: result.value, error: result.error };
    } finally {
      release();
      if (this.queues.get(id) === tail) this.queues.delete(id);
    }
  }
}
module.exports = { MemoryMfaRepository };
