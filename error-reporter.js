// ═══════════════════════════════════════════════════════════════════
//  FITIA — error-reporter (item 8, opt-in)
//  Envoie window.onerror / unhandledrejection vers /api/errors/ingest.
//  Désactivé par défaut. Activation explicite via :
//    localStorage.setItem('fitia.errorReporting', 'on')
//  ou window.FITIA_ERROR_REPORTING = true avant le chargement.
//  - Aucune donnée personnelle (pas de cookies, pas de localStorage applicatif).
//  - 10 rapports max par session, URL sans query string, jamais d'exception.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__fitiaErrorReporter) return;

  var optedIn = false;
  try {
    optedIn = window.FITIA_ERROR_REPORTING === true
      || window.localStorage.getItem('fitia.errorReporting') === 'on';
  } catch (_) { /* localStorage indisponible : pas d'envoi */ }
  if (!optedIn) {
    window.__fitiaErrorReporter = { enabled: false, reported: 0 };
    return;
  }

  var endpoint = '/api/errors/ingest';
  var release = window.FITIA_RELEASE || null;
  var platform = /FITIA|wv|Android/i.test(navigator.userAgent || '') ? 'android-apk' : 'web';
  var budget = 10;
  var seen = new Set();

  function strip(value, max) {
    var text = String(value == null ? '' : value);
    text = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]');
    text = text.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt]');
    text = text.replace(/\b0x[0-9a-fA-F]{40}\b/g, '[address]');
    return text.length > max ? text.slice(0, max - 1) : text;
  }

  function currentUrl() {
    try {
      var loc = window.location;
      return loc.origin + loc.pathname;
    } catch (_) {
      return 'unknown';
    }
  }

  function send(payload) {
    if (budget <= 0) return;
    var key = payload.message.slice(0, 120);
    if (seen.has(key)) return;
    seen.add(key);
    budget -= 1;
    var body = JSON.stringify({
      message: payload.message,
      stack: payload.stack || null,
      url: currentUrl(),
      release: release,
      platform: platform
    });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
        return;
      }
    } catch (_) { /* fallback fetch */ }
    try {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        credentials: 'omit'
      }).catch(function () { /* silencieux */ });
    } catch (_) { /* silencieux */ }
  }

  window.addEventListener('error', function (event) {
    try {
      send({
        message: strip(event && event.message ? event.message : 'Unknown error', 500),
        stack: event && event.error && event.error.stack ? strip(event.error.stack, 2000) : null
      });
    } catch (_) { /* ne jamais casser l'app */ }
  });

  window.addEventListener('unhandledrejection', function (event) {
    try {
      var reason = event && event.reason;
      var message = reason && reason.message ? reason.message : String(reason || 'Unhandled rejection');
      var stack = reason && reason.stack ? reason.stack : null;
      send({ message: strip(message, 500), stack: stack ? strip(stack, 2000) : null });
    } catch (_) { /* silencieux */ }
  });

  window.__fitiaErrorReporter = { enabled: true, get reported() { return 10 - budget; } };
})();
