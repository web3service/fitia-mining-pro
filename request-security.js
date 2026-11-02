'use strict';

// Les en-têtes de proxy ne sont utilisés que sur Vercel ou lorsque l'exploitant
// a explicitement déclaré un proxy de confiance. La table reste bornée pour
// qu'une série d'adresses différentes ne puisse pas épuiser la mémoire.
const MAX_LOGIN_TRACKERS = 2048;

function firstHeaderValue(value) {
  const text = Array.isArray(value) ? value[0] : value;
  if (typeof text !== 'string') return '';
  const first = text.split(',')[0].trim();
  if (!first || first.length > 160 || /[\u0000-\u001f\u007f]/.test(first)) return '';
  return first;
}

function getClientKey(req, trustProxy = false) {
  const headers = req && req.headers ? req.headers : {};
  if (trustProxy) {
    for (const name of ['x-vercel-forwarded-for', 'x-forwarded-for', 'x-real-ip']) {
      const value = firstHeaderValue(headers[name]);
      if (value) return value;
    }
  }
  const socketAddress = req && req.socket && typeof req.socket.remoteAddress === 'string'
    ? req.socket.remoteAddress.trim()
    : '';
  return socketAddress ? socketAddress.slice(0, 160) : 'unknown';
}

function getLoginFailure(records, key, now) {
  const record = records.get(key);
  if (!record) return null;
  if (!Number.isFinite(record.resetAt) || record.resetAt <= now) {
    records.delete(key);
    return null;
  }
  return record;
}

function recordLoginFailure(records, key, now, windowMs) {
  const previous = getLoginFailure(records, key, now);
  const next = previous
    ? { count: previous.count + 1, resetAt: previous.resetAt }
    : { count: 1, resetAt: now + windowMs };
  records.delete(key);

  if (records.size >= MAX_LOGIN_TRACKERS) {
    for (const [storedKey, record] of records) {
      if (!record || !Number.isFinite(record.resetAt) || record.resetAt <= now) records.delete(storedKey);
    }
    while (records.size >= MAX_LOGIN_TRACKERS) {
      const oldest = records.keys().next();
      if (oldest.done) break;
      records.delete(oldest.value);
    }
  }
  records.set(key, next);
  return next;
}

module.exports = {
  MAX_LOGIN_TRACKERS,
  getClientKey,
  getLoginFailure,
  recordLoginFailure
};
