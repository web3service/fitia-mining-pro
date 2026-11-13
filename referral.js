// Page de repli du lien de parrainage — aucun secret, aucun tracking.
// Le code est lu depuis /parrainage/<code> et validé avant usage.
(function () {
  'use strict';
  var match = window.location.pathname.match(/^\/parrainage\/([^\/?#]+)\/?$/i);
  var raw = match ? decodeURIComponent(match[1]) : '';
  var valid = /^(FITIA-[0-9]{1,78}|0x[0-9a-f]{40})$/i.test(raw) ? raw : '';
  var codeEl = document.getElementById('referral-code');
  var openBtn = document.getElementById('open-app');
  var help = document.getElementById('referral-fallback-help');
  if (valid) {
    codeEl.textContent = valid;
    openBtn.href = 'fitiapro://parrainage/' + encodeURIComponent(valid);
    openBtn.classList.remove('referral-disabled');
    openBtn.removeAttribute('aria-disabled');
  } else {
    codeEl.textContent = '—';
    openBtn.classList.add('referral-disabled');
    openBtn.setAttribute('aria-disabled', 'true');
    openBtn.removeAttribute('href');
    if (help) help.textContent = 'Lien incomplet ou invalide. Ouvrez le lien complet reçu, ou installez l’application et saisissez le code dans Paramètres : Programme de parrainage.';
  }
})();
