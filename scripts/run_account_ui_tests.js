#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require(fs.existsSync('/tmp/test-deps/node_modules/jsdom') ? '/tmp/test-deps/node_modules/jsdom' : 'jsdom');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'android-src/wallet.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const accountSource = fs.readFileSync(path.join(ROOT, 'account.js'), 'utf8');
const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const translationStart = appSource.indexOf('const i18n = {');
const translationEnd = appSource.indexOf('\n};', translationStart) + 3;
const translations = vm.runInNewContext(`${appSource.slice(translationStart, translationEnd)}\ni18n;`);
const address = `0x${'12'.repeat(20)}`;
const session = { accessToken: 'access-token', refreshToken: 'refresh-token', expiresAt: '' };

function result(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function harness() {
  const dom = new JSDOM(html, { url: 'https://app.fitia.pro/wallet.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window;
  const doc = win.document;
  const storage = {
    saved: [], cleared: 0,
    async sealAccountSession(value) { this.saved.push(JSON.stringify(value)); },
    async clearAccountSession() { this.cleared += 1; }
  };
  win.FitiaSecurity = { Native: { copyText: async () => true } };
  const app = {
    language: 'en', user: address, signer: { signMessage: async () => 'signed-message' },
    t(key) { return translations[this.language][key] || key; },
    showToast() {},
    authenticated: 0,
    async onAccountAuthenticated() { this.authenticated += 1; },
    signedOut: 0,
    async onAccountSignedOut() { this.signedOut += 1; this.user = null; this.signer = null; }
  };
  win.eval(accountSource);
  const center = new win.FitiaAccountCenter(app, { storage, fetch: async () => { throw new Error('Unexpected request'); } });
  center.init();
  center.session = { ...session };
  center.user = {
    userId: 'account-1', username: 'Miner_One', email: 'miner@example.com',
    emailVerified: false, walletVerified: false, walletAddress: null, certified: false
  };
  center.render();
  return { dom, win, doc, center, app, storage, close: () => { if (center.refreshTimer) clearTimeout(center.refreshTimer); dom.window.close(); } };
}

function input(win, id, value) {
  const field = win.document.getElementById(id);
  field.value = value;
  field.dispatchEvent(new win.Event('input', { bubbles: true }));
}
function tick() { return new Promise((resolve) => setTimeout(resolve, 0)); }

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const h = harness();
  try { await fn(h); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); }
  finally { await tick(); h.close(); }
}

(async () => {
  console.log('\n👤  TESTS DE L’ESPACE MON COMPTE\n' + '═'.repeat(68));

  await test('Connexion et inscription : premier champ ciblé et secrets effacés au changement d’onglet', async ({ center, win, doc }) => {
    center.session = null; center.user = null; center.render();
    center.setMode('signup');
    assert.strictEqual(doc.activeElement.id, 'account-signup-username');
    input(win, 'account-signup-password', 'Test-password-2026');
    doc.querySelector('[data-account-password-toggle="account-signup-password"]').click();
    assert.strictEqual(doc.getElementById('account-signup-password').type, 'text');
    center.setMode('login');
    assert.strictEqual(doc.activeElement.id, 'account-login-email');
    assert.strictEqual(doc.getElementById('account-signup-password').value, '');
    assert.strictEqual(doc.getElementById('account-signup-password').type, 'password');
  });

  await test('Statuts réels du compte et du wallet, sans badges de vérification inventés', async ({ center, app, doc }) => {
    const badges = doc.getElementById('account-profile-badges');
    assert.ok(badges.textContent.includes('Email unconfirmed'));
    assert.ok(badges.textContent.includes('Wallet not linked'));
    assert.ok(!badges.textContent.includes('Wallet verified'));
    assert.ok(doc.getElementById('account-wallet-explanation').textContent.includes('without a transaction or network fee'));
    assert.strictEqual(doc.getElementById('account-link-wallet').disabled, false);

    app.user = null; app.signer = null; center.render();
    assert.strictEqual(doc.getElementById('account-link-wallet').disabled, true);
    assert.ok(doc.getElementById('account-wallet-explanation').textContent.includes('Unlock'));

    center.user = { ...center.user, emailVerified: true, walletVerified: true, walletAddress: address };
    app.user = address; app.signer = { signMessage: async () => '' }; center.render();
    assert.ok(badges.textContent.includes('Email confirmed'));
    assert.ok(badges.textContent.includes('Wallet verified'));
    assert.ok(!doc.getElementById('account-copy-wallet').classList.contains('hidden'));
    assert.ok(doc.getElementById('account-profile-actions').classList.contains('hidden'));
    assert.strictEqual(doc.getElementById('account-profile-wallet').textContent, address);

    app.user = `0x${'34'.repeat(20)}`; center.render();
    assert.ok(doc.getElementById('account-wallet-explanation').textContent.includes('differs'));
    assert.strictEqual(doc.getElementById('account-link-wallet').disabled, true);
    center.user.username = '<img src=x onerror=alert(1)>'; center.render();
    assert.strictEqual(doc.querySelector('#account-profile-name img'), null, 'Le nom affiché reste du texte');
  });

  await test('Nom d’utilisateur : validation locale, enregistrement utile et retour au bon endroit', async ({ center, win, doc }) => {
    const calls = [];
    center.fetch = async (url, options) => {
      calls.push({ action: url.split('/').pop(), body: JSON.parse(options.body) });
      return result(200, { user: { ...center.user, username: 'Miner_Updated' } });
    };
    assert.strictEqual(doc.getElementById('account-username-submit').disabled, true);
    input(win, 'account-username-input', 'bad!');
    assert.strictEqual(doc.getElementById('account-username-submit').disabled, false);
    await center.updateUsername();
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(doc.getElementById('account-username-input').getAttribute('aria-invalid'), 'true');
    assert.ok(!doc.getElementById('account-username-message').classList.contains('hidden'));
    assert.strictEqual(doc.getElementById('account-username-message').getAttribute('role'), 'alert');

    input(win, 'account-username-input', 'Miner_Updated');
    assert.strictEqual(doc.getElementById('account-username-input').hasAttribute('aria-invalid'), false);
    await center.updateUsername();
    assert.deepStrictEqual(calls, [{ action: 'profile', body: { username: 'Miner_Updated' } }]);
    assert.strictEqual(doc.getElementById('account-profile-name').textContent, 'Miner_Updated');
    assert.strictEqual(doc.getElementById('account-username-message').textContent, 'Username updated.');
    assert.ok(doc.getElementById('account-username-message').classList.contains('account-message-success'));
    assert.strictEqual(doc.getElementById('account-username-submit').disabled, true);
    await center.updateUsername();
    assert.strictEqual(calls.length, 1, 'Une valeur inchangée ne déclenche aucune requête');
  });

  await test('Action en cours : champs protégés, retour accessible et pas de double envoi', async ({ center, win, doc }) => {
    let resolveRequest;
    let calls = 0;
    center.fetch = async () => {
      calls += 1;
      return new Promise((resolve) => { resolveRequest = resolve; });
    };
    input(win, 'account-username-input', 'Miner_Busy');
    const pending = center.updateUsername();
    assert.strictEqual(calls, 1);
    assert.strictEqual(doc.getElementById('account-username-input').disabled, true);
    assert.strictEqual(doc.getElementById('account-username-submit').getAttribute('aria-busy'), 'true');
    assert.strictEqual(doc.getElementById('account-live-status').textContent, 'Working…');
    await center.updateUsername();
    assert.strictEqual(calls, 1);
    resolveRequest(result(200, { user: { ...center.user, username: 'Miner_Busy' } }));
    await pending;
    assert.strictEqual(doc.getElementById('account-username-input').disabled, false);
    assert.strictEqual(doc.getElementById('account-username-submit').getAttribute('aria-busy'), 'false');
    assert.strictEqual(doc.getElementById('account-live-status').textContent, '');
  });

  await test('Email : validation, réauthentification et confirmation sans modifier le wallet', async ({ center, app, win, doc, storage }) => {
    const calls = [];
    center.fetch = async (url, options) => {
      const body = JSON.parse(options.body); calls.push({ action: url.split('/').pop(), body });
      if (body.currentPassword === 'wrong') return result(403, { error: 'Current password incorrect', code: 'ACCOUNT_REAUTH' });
      return result(200, { user: { ...center.user, email: body.email, emailVerified: true }, session });
    };
    input(win, 'account-email-input', 'not-an-email');
    input(win, 'account-email-current-password', 'Secret-password-2026');
    await center.changeEmail();
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(doc.getElementById('account-email-message').textContent, 'Enter a valid email address.');
    input(win, 'account-email-input', 'MINER@example.com');
    await center.changeEmail();
    assert.strictEqual(calls.length, 0);
    assert.ok(doc.getElementById('account-email-message').textContent.includes('different'));
    input(win, 'account-email-input', 'new@example.com');
    input(win, 'account-email-current-password', 'wrong');
    await center.changeEmail();
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(center.user.email, 'miner@example.com');
    assert.strictEqual(doc.getElementById('account-email-current-password').value, '');
    assert.strictEqual(doc.getElementById('account-email-message').textContent, 'Current password incorrect');
    assert.strictEqual(doc.getElementById('account-message').classList.contains('hidden'), true);

    input(win, 'account-email-current-password', 'Secret-password-2026');
    await center.changeEmail();
    assert.strictEqual(center.user.email, 'new@example.com');
    assert.strictEqual(doc.getElementById('account-email-input').value, '');
    assert.strictEqual(doc.getElementById('account-email-current-password').value, '');
    assert.strictEqual(doc.getElementById('account-email-message').textContent, 'Email address updated.');
    assert.strictEqual(app.user, address);
    assert.ok(app.signer);
    assert.strictEqual(app.authenticated, 0);
    assert.ok(storage.saved.every((saved) => !saved.includes('Secret-password-2026')));
  });

  await test('Mot de passe : règles, confirmation, masquage et effacement des champs sensibles', async ({ center, win, doc, storage }) => {
    const calls = [];
    center.fetch = async (url, options) => {
      calls.push({ action: url.split('/').pop(), body: JSON.parse(options.body) });
      return result(200, { user: center.user, session });
    };
    const current = 'Old-password-2026';
    input(win, 'account-password-current', current);
    input(win, 'account-password-new', 'New-password-2027');
    input(win, 'account-password-confirm', 'different');
    await center.changePassword();
    assert.strictEqual(calls.length, 0);
    for (const id of ['account-password-current', 'account-password-new', 'account-password-confirm']) assert.strictEqual(doc.getElementById(id).value, '');
    assert.strictEqual(doc.getElementById('account-password-message').textContent, 'Passwords do not match.');

    input(win, 'account-password-current', current);
    input(win, 'account-password-new', 'weak');
    input(win, 'account-password-confirm', 'weak');
    await center.changePassword();
    assert.strictEqual(calls.length, 0);
    assert.ok(doc.getElementById('account-password-message').textContent.includes('12–128'));

    input(win, 'account-password-current', current);
    input(win, 'account-password-new', current);
    input(win, 'account-password-confirm', current);
    await center.changePassword();
    assert.strictEqual(calls.length, 0);
    assert.ok(doc.getElementById('account-password-message').textContent.includes('different'));

    input(win, 'account-password-current', current);
    input(win, 'account-password-new', 'New-password-2027');
    input(win, 'account-password-confirm', 'New-password-2027');
    const toggle = doc.querySelector('[data-account-password-toggle="account-password-new"]');
    toggle.click();
    assert.strictEqual(doc.getElementById('account-password-new').type, 'text');
    assert.strictEqual(toggle.getAttribute('aria-pressed'), 'true');
    await center.changePassword();
    assert.deepStrictEqual(calls, [{ action: 'password', body: { currentPassword: current, newPassword: 'New-password-2027' } }]);
    for (const id of ['account-password-current', 'account-password-new', 'account-password-confirm']) {
      assert.strictEqual(doc.getElementById(id).value, '');
      assert.strictEqual(doc.getElementById(id).type, 'password');
    }
    assert.strictEqual(toggle.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(doc.getElementById('account-password-message').textContent, 'Password updated.');
    assert.ok(!doc.body.textContent.includes('New-password-2027'));
    assert.ok(storage.saved.every((saved) => !saved.includes(current) && !saved.includes('New-password-2027')));
  });

  await test('Repli et fermeture du compte effacent les mots de passe et annulent les brouillons', async ({ center, win, doc }) => {
    const details = doc.getElementById('account-password-disclosure');
    details.open = true; await tick();
    input(win, 'account-password-current', 'secret');
    doc.querySelector('[data-account-password-toggle="account-password-current"]').click();
    assert.strictEqual(doc.getElementById('account-password-current').type, 'text');
    details.open = false; await tick();
    assert.strictEqual(doc.getElementById('account-password-current').value, '');
    assert.strictEqual(doc.getElementById('account-password-current').type, 'password');

    doc.getElementById('account-email-disclosure').open = true; await tick();
    input(win, 'account-email-current-password', 'secret');
    input(win, 'account-email-input', 'draft@example.com');
    input(win, 'account-username-input', 'Draft_Name');
    center.setLogoutConfirmation(true);
    center.close();
    assert.strictEqual(doc.getElementById('account-email-current-password').value, '');
    assert.strictEqual(doc.getElementById('account-email-input').value, '');
    assert.strictEqual(doc.getElementById('account-username-input').value, 'Miner_One');
    assert.strictEqual(doc.getElementById('account-email-disclosure').open, false);
    assert.strictEqual(doc.getElementById('account-logout').getAttribute('aria-expanded'), 'false');
  });

  await test('Actualisation en cas de panne et protection contre une ancienne réponse de profil', async ({ center, win, doc }) => {
    center.fetch = async () => { throw new Error('offline'); };
    await center.refreshAccount();
    assert.ok(doc.getElementById('account-profile-message').textContent.includes('Could not refresh'));
    assert.strictEqual(doc.getElementById('account-refresh-profile').disabled, false);
    center.fetch = async () => result(200, { user: { ...center.user, emailVerified: true } });
    await center.refreshAccount();
    assert.strictEqual(center.user.emailVerified, true);
    assert.strictEqual(doc.getElementById('account-profile-message').textContent, 'Account refreshed.');

    const oldProfile = { ...center.user };
    let resolveRefresh;
    center.fetch = async (url, options) => {
      if (url.endsWith('/session')) return new Promise((resolve) => { resolveRefresh = resolve; });
      if (url.endsWith('/profile')) return result(200, { user: { ...center.user, username: JSON.parse(options.body).username } });
      throw new Error('Unexpected request');
    };
    const refresh = center.refreshProfile({ quiet: true });
    input(win, 'account-username-input', 'Newer_Name');
    await center.updateUsername();
    resolveRefresh(result(200, { user: oldProfile }));
    await refresh;
    assert.strictEqual(center.user.username, 'Newer_Name', 'Une ancienne actualisation ne remplace pas le profil modifié');
    assert.strictEqual(doc.getElementById('account-profile-name').textContent, 'Newer_Name');
  });

  await test('La signature est abandonnée si le wallet est verrouillé pendant la liaison', async ({ center, app, doc }) => {
    let resolveSignature;
    const actions = [];
    app.signer = { signMessage: async () => new Promise((resolve) => { resolveSignature = resolve; }) };
    center.fetch = async (url) => {
      actions.push(url.split('/').pop());
      return result(200, { challengeId: 'challenge', message: 'Verify wallet ownership' });
    };
    const pending = center.linkWallet();
    await tick();
    assert.deepStrictEqual(actions, ['challenge']);
    app.user = null; app.signer = null;
    resolveSignature('signature');
    await pending;
    assert.deepStrictEqual(actions, ['challenge'], 'La signature ne part pas après le verrouillage');
    assert.ok(doc.getElementById('account-wallet-message').textContent.includes('changed or was locked'));
    assert.strictEqual(center.user.walletVerified, false);
  });

  await test('Une réponse tardive ne restaure pas une session déjà déconnectée', async ({ center, app, win, storage }) => {
    let resolveEmail;
    center.fetch = async () => new Promise((resolve) => { resolveEmail = resolve; });
    input(win, 'account-email-input', 'next@example.com');
    input(win, 'account-email-current-password', 'Secret-password-2026');
    const pending = center.changeEmail();
    const oldUser = { ...center.user, email: 'next@example.com' };
    await center.clearLocalSession();
    resolveEmail(result(200, { user: oldUser, session }));
    await pending;
    assert.strictEqual(center.session, null);
    assert.strictEqual(center.user, null);
    assert.strictEqual(app.signedOut, 1);
    assert.strictEqual(storage.saved.length, 0, 'Aucune session tardive ne doit être persistée');
  });

  await test('Copie de l’adresse : succès uniquement après copie réelle', async ({ center, win, doc }) => {
    center.user = { ...center.user, walletVerified: true, walletAddress: address }; center.render();
    win.FitiaSecurity.Native.copyText = async () => false;
    await center.copyWalletAddress();
    assert.ok(doc.getElementById('account-wallet-message').textContent.includes('Could not copy'));
    assert.strictEqual(doc.getElementById('account-wallet-message').getAttribute('role'), 'alert');
    let copied = '';
    win.FitiaSecurity.Native.copyText = async (text) => { copied = text; return true; };
    await center.copyWalletAddress();
    assert.strictEqual(copied, address);
    assert.strictEqual(doc.getElementById('account-wallet-message').textContent, 'Address copied!');
    assert.ok(doc.getElementById('account-wallet-message').classList.contains('account-message-success'));
  });

  await test('Déconnexion : annulation, confirmation et blocage des doubles clics', async ({ center, app, doc, storage }) => {
    let resolveLogout;
    let calls = 0;
    center.fetch = async (url) => {
      assert.ok(url.endsWith('/logout'));
      calls += 1;
      return new Promise((resolve) => { resolveLogout = resolve; });
    };
    doc.getElementById('account-logout').click();
    assert.strictEqual(doc.getElementById('account-logout').getAttribute('aria-expanded'), 'true');
    assert.strictEqual(doc.activeElement.id, 'account-logout-cancel');
    assert.strictEqual(calls, 0);
    doc.getElementById('account-logout-cancel').click();
    assert.strictEqual(doc.getElementById('account-logout').getAttribute('aria-expanded'), 'false');
    assert.strictEqual(doc.activeElement.id, 'account-logout');
    assert.ok(center.session && app.user);

    doc.getElementById('account-logout').click();
    doc.getElementById('account-logout-confirm').click();
    assert.strictEqual(doc.getElementById('account-logout-confirm').disabled, true);
    doc.getElementById('account-logout-confirm').click();
    assert.strictEqual(calls, 1);
    resolveLogout(result(200, { signedOut: true }));
    await tick(); await tick();
    assert.strictEqual(center.session, null);
    assert.strictEqual(app.user, null);
    assert.strictEqual(app.signer, null);
    assert.strictEqual(app.signedOut, 1);
    assert.strictEqual(storage.cleared, 1);
    assert.ok(!doc.getElementById('account-auth-panel').classList.contains('hidden'));
  });

  await test('Tous les nouveaux libellés du compte existent dans les cinq langues', async ({ doc }) => {
    const keys = new Set([...doc.querySelectorAll('#account-access-screen [data-i18n], #account-access-screen [data-i18n-aria-label], #account-access-screen [data-i18n-title]')]
      .flatMap((element) => ['data-i18n', 'data-i18n-aria-label', 'data-i18n-title'].map((name) => element.getAttribute(name)).filter(Boolean)));
    for (const key of ['accountEmailPending', 'accountWalletPending', 'accountWalletSignatureHelp', 'accountWalletVerifiedHelp',
      'accountWalletDifferent', 'accountWalletChanged', 'accountCurrentPasswordRequired', 'accountEmailInvalid', 'accountEmailSame', 'accountPasswordSame',
      'accountWalletCopyFailed', 'accountSyncFailed', 'accountSyncSuccess', 'accountWorking', 'accountNothingToSave']) keys.add(key);
    for (const language of ['fr', 'en', 'de', 'zh', 'sg']) {
      for (const key of keys) assert.ok(translations[language][key], `${language}.${key} absent`);
    }
  });

  console.log('═'.repeat(68));
  console.log(`📊 ${passed} réussis, ${failed} échoués`);
  if (failed) process.exitCode = 1;
})();
