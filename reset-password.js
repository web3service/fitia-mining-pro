// FITIA PRO — Password reset (Supabase recovery link).
// No secrets on the client. The recovery token is read from the URL fragment,
// kept in memory only, then sent to the backend.
(function () {
  'use strict';

  // Relative sur Vercel/l'app interne ; absolue (API Vercel) si servie sur le miroir statique.
  var API_URL = window.location.hostname === 'fitia-pro.pages.dev'
    ? 'https://fitia-mining-pro.vercel.app/api/account/reset-password'
    : '/api/account/reset-password';
  var TOKEN_PATTERN = /^[A-Za-z0-9._~+\/-]{20,4096}$/;
  var PREFIX_BLACKLIST = /^(password|motdepasse|qwerty|letmein)/i;

  var messages = {
    updating: 'Updating…',
    update: 'Update password',
    invalidToken: 'Invalid or expired link. Request a new one from the app.',
    passwordTooShort: 'Password must be 12 to 128 characters long.',
    passwordWeak: 'Password needs at least one letter and one number, and must not be a common word.',
    passwordMismatch: 'Both passwords must match.',
    rateLimited: 'Too many attempts. Try again in a few minutes.',
    generic: 'Password reset failed. Try again or request a new link.'
  };
  function t(key) { return messages[key] || key; }

  function parseRecoveryParams() {
    try {
      var raw = String(window.location.hash || '').replace(/^#/, '');
      var params = new URLSearchParams(raw);
      return {
        accessToken: params.get('access_token') || '',
        type: String(params.get('type') || '').toLowerCase(),
        hasToken: params.has('access_token')
      };
    } catch (_) {
      return { accessToken: '', type: '', hasToken: false };
    }
  }

  function wipeFragment() {
    try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch (_) { /* no-op */ }
  }

  function validPassword(value) {
    return typeof value === 'string' && value.length >= 12 && value.length <= 128
      && /[A-Za-z]/.test(value) && /\d/.test(value) && !PREFIX_BLACKLIST.test(value)
      && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function show(id) {
    ['reset-form-view', 'reset-invalid-view', 'reset-success-view'].forEach(function (viewId) {
      var el = document.getElementById(viewId);
      if (el) el.hidden = viewId !== id;
    });
  }

  function setStatus(element, message, isOk) {
    element.textContent = message || '';
    element.classList.toggle('reset-ok', Boolean(isOk));
  }

  var params = parseRecoveryParams();
  // The token must never remain visible in the URL or in the history.
  wipeFragment();

  var form = document.getElementById('reset-form');
  var statusEl = document.getElementById('reset-status');
  var submitEl = document.getElementById('reset-submit');
  var token = params.type === 'recovery' && TOKEN_PATTERN.test(params.accessToken) ? params.accessToken : null;

  if (!token) {
    show('reset-invalid-view');
    return;
  }
  show('reset-form-view');

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var password = document.getElementById('new-password').value;
    var confirmation = document.getElementById('confirm-password').value;

    if (password.length < 12 || password.length > 128) { setStatus(statusEl, t('passwordTooShort'), false); return; }
    if (!validPassword(password)) { setStatus(statusEl, t('passwordWeak'), false); return; }
    if (password !== confirmation) { setStatus(statusEl, t('passwordMismatch'), false); return; }

    submitEl.disabled = true;
    submitEl.textContent = t('updating');
    setStatus(statusEl, '', false);

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ accessToken: token, password: password }),
      cache: 'no-store'
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) { return { status: response.status, data: data || {} }; });
    }).then(function (result) {
      if (result.status === 200 && result.data.ok) {
        token = null;
        show('reset-success-view');
        return;
      }
      if (result.status === 401) {
        token = null;
        show('reset-invalid-view');
        return;
      }
      if (result.status === 429) { setStatus(statusEl, t('rateLimited'), false); }
      else if (result.status === 400 && result.data && result.data.error) { setStatus(statusEl, String(result.data.error), false); }
      else { setStatus(statusEl, t('generic'), false); }
      submitEl.disabled = false;
      submitEl.textContent = t('update');
    }).catch(function () {
      setStatus(statusEl, t('generic'), false);
      submitEl.disabled = false;
      submitEl.textContent = t('update');
    });
  });
})();
