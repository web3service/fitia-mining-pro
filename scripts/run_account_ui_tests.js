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
    assert.ok(!badges.textContent.includes('Wallet linked'));
    assert.ok(doc.getElementById('account-wallet-explanation').textContent.includes('without a transaction or network fee'));
    assert.strictEqual(doc.getElementById('account-link-wallet').disabled, false);

    app.user = null; app.signer = null; center.render();
    assert.strictEqual(doc.getElementById('account-link-wallet').disabled, true);
    assert.ok(doc.getElementById('account-wallet-explanation').textContent.includes('Unlock'));

    center.user = { ...center.user, emailVerified: true, walletVerified: true, walletAddress: address };
    app.user = address; app.signer = { signMessage: async () => '' }; center.render();
    assert.ok(badges.textContent.includes('Email confirmed'));
    assert.ok(badges.textContent.includes('Wallet linked'));
    assert.ok(!doc.getElementById('account-copy-wallet').classList.contains('hidden'));
    assert.ok(doc.getElementById('account-profile-actions').classList.contains('hidden'));
    assert.strictEqual(doc.getElementById('account-profile-wallet').textContent, address);
    const openLinked = doc.getElementById('account-open-linked-wallet');
    assert.ok(!openLinked.classList.contains('hidden'));
    let opened = 0; app.openLinkedWalletFromAccount = () => { opened += 1; };
    openLinked.click(); assert.strictEqual(opened, 1);
    assert.ok(doc.getElementById('account-current-wallet-box').classList.contains('hidden'));

    app.user = `0x${'34'.repeat(20)}`; center.render();
    assert.ok(doc.getElementById('account-wallet-explanation').textContent.includes('differs'));
    assert.ok(doc.getElementById('account-wallet-explanation').classList.contains('account-wallet-warning'));
    assert.strictEqual(doc.getElementById('account-current-wallet').textContent, app.user);
    assert.ok(!doc.getElementById('account-current-wallet-box').classList.contains('hidden'));
    assert.ok(openLinked.classList.contains('hidden'));
    app.user = address; center.render();
    assert.ok(doc.getElementById('account-current-wallet-box').classList.contains('hidden'));
    assert.ok(!openLinked.classList.contains('hidden'));
    app.user = `0x${'34'.repeat(20)}`; center.render();
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

  await test('Une signature wallet ne peut pas être transmise après changement de compte', async ({ center, app }) => {
    let resolveSignature; const actions = [];
    app.signer = { signMessage: async () => new Promise((resolve) => { resolveSignature = resolve; }) };
    center.fetch = async (url) => { actions.push(url.split('/').pop()); return result(200, { challengeId: 'challenge', message: 'Verify wallet ownership' }); };
    const pending = center.linkWallet();
    await tick();
    await center.acceptSession({ user: { userId: 'account-2', username: 'Other_User', email: 'other@example.com' },
      session: { ...session, accessToken: 'new-access', refreshToken: 'new-refresh' } }, { notifyApp: false });
    resolveSignature('signature');
    await pending;
    assert.deepStrictEqual(actions, ['challenge']);
    assert.strictEqual(center.user.userId, 'account-2');
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

  await test('Une réponse 401 tardive ne rejoue pas une action sur un autre compte', async ({ center }) => {
    let resolveOld; const calls = [];
    center.fetch = async (url, options) => {
      calls.push({ url, authorization: options.headers.Authorization });
      return new Promise((resolve) => { resolveOld = resolve; });
    };
    const pending = center.request('profile', { body: { username: 'Sensitive_Change' } });
    await center.clearLocalSession();
    await center.acceptSession({ user: { userId: 'account-2', username: 'Other_User', email: 'other@example.com' },
      session: { ...session, accessToken: 'new-access', refreshToken: 'new-refresh' } }, { notifyApp: false });
    resolveOld(result(401, { error: 'expired' }));
    await assert.rejects(pending, (error) => error.code === 'ACCOUNT_SESSION_CHANGED');
    assert.strictEqual(calls.length, 1, 'Aucune opération rejouée sur le nouveau compte');
    assert.strictEqual(center.user.userId, 'account-2');
  });

  await test('Une ancienne réponse de modification ne remplace pas une nouvelle session', async ({ center }) => {
    let resolveOld;
    center.fetch = async () => new Promise((resolve) => { resolveOld = resolve; });
    const pending = center.request('email', { body: { email: 'old-change@example.com' } });
    await center.clearLocalSession();
    await center.acceptSession({ user: { userId: 'account-2', username: 'Other_User', email: 'other@example.com' },
      session: { ...session, accessToken: 'new-access', refreshToken: 'new-refresh' } }, { notifyApp: false });
    resolveOld(result(200, { user: { userId: 'account-1' }, session }));
    await assert.rejects(pending, (error) => error.code === 'ACCOUNT_SESSION_CHANGED');
    assert.strictEqual(center.user.userId, 'account-2');
  });

  await test('Un ancien renouvellement refusé ne déconnecte pas une nouvelle session', async ({ center }) => {
    let resolveRefresh;
    center.fetch = async () => new Promise((resolve) => { resolveRefresh = resolve; });
    const pending = center.refreshSession();
    await center.clearLocalSession();
    await center.acceptSession({ user: { userId: 'account-2', username: 'Other_User', email: 'other@example.com' },
      session: { ...session, accessToken: 'new-access', refreshToken: 'new-refresh' } }, { notifyApp: false });
    resolveRefresh(result(401, { error: 'expired' }));
    await assert.rejects(pending, (error) => error.status === 401);
    assert.strictEqual(center.user.userId, 'account-2');
    assert.strictEqual(center.session.accessToken, 'new-access');
  });

  await test('Une rotation de jeton du même compte permet la reprise', async ({ center }) => {
    const calls = [];
    center.fetch = async (url, options) => {
      calls.push({ action: url.split('/').pop(), auth: options.headers.Authorization });
      if (url.endsWith('/profile') && calls.length === 1) return result(401, { error: 'expired' });
      if (url.endsWith('/refresh')) return result(200, { user: center.user, session: { ...session, accessToken: 'rotated', refreshToken: 'rotated-refresh' } });
      return result(200, { user: center.user });
    };
    await center.request('profile', { body: { username: 'Miner_One' } });
    assert.deepStrictEqual(calls.map((call) => call.action), ['profile', 'refresh', 'profile']);
    assert.strictEqual(calls[2].auth, 'Bearer rotated');
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

  await test('Suppression de compte : repli annulable, mot de passe requis, session effacée', async ({ center, app, doc, storage, win }) => {
    let calls = 0;
    center.fetch = async (url, options = {}) => {
      calls += 1;
      assert.ok(url.endsWith('/delete'));
      const body = JSON.parse(options.body || '{}');
      assert.strictEqual(body.currentPassword, 'A-correct-passphrase-2026');
      return result(200, { deleted: true });
    };
    // Ouverture / fermeture sans mot de passe → aucun appel réseau
    doc.getElementById('account-delete').click();
    assert.strictEqual(doc.getElementById('account-delete').getAttribute('aria-expanded'), 'true');
    assert.strictEqual(doc.activeElement.id, 'account-delete-cancel');
    doc.getElementById('account-delete-confirm').click();
    await tick();
    assert.strictEqual(calls, 0);
    assert.strictEqual(doc.getElementById('account-delete-current-password').getAttribute('aria-invalid'), 'true');
    doc.getElementById('account-delete-cancel').click();
    assert.strictEqual(doc.getElementById('account-delete').getAttribute('aria-expanded'), 'false');
    assert.ok(center.session && app.user);
    // Mot de passe correct → suppression serveur + effacement local
    doc.getElementById('account-delete').click();
    input(win, 'account-delete-current-password', 'A-correct-passphrase-2026');
    doc.getElementById('account-delete-confirm').click();
    await tick(); await tick();
    assert.strictEqual(calls, 1);
    assert.strictEqual(center.session, null);
    assert.strictEqual(storage.cleared, 1);
    assert.strictEqual(app.signedOut, 1);
    assert.strictEqual(app.user, null);
    assert.ok(!doc.getElementById('account-auth-panel').classList.contains('hidden'));
  });

  await test('Suppression refusée par le serveur : compte conservé, message affiché, champ effacé', async ({ center, app, doc, storage, win }) => {
    center.fetch = async () => result(403, { error: 'Mot de passe actuel incorrect.', code: 'ACCOUNT_REAUTH' });
    doc.getElementById('account-delete').click();
    input(win, 'account-delete-current-password', 'Wrong-passphrase-2026');
    doc.getElementById('account-delete-confirm').click();
    await tick(); await tick();
    assert.ok(center.session, 'Session conservée après refus serveur');
    assert.strictEqual(storage.cleared, 0);
    assert.strictEqual(app.signedOut, 0);
    const message = doc.getElementById('account-delete-message');
    assert.strictEqual(message.classList.contains('hidden'), false);
    assert.ok(message.textContent.length > 0);
    assert.strictEqual(doc.getElementById('account-delete-current-password').value, '', 'Le mot de passe est effacé après la tentative');
  });

  await test('Pays avec drapeau : sélection obligatoire et profil lisible', async ({ center, win, doc }) => {
    const select = doc.getElementById('account-signup-country');
    assert.ok(select.options.length > 240);
    assert.ok([...select.options].find((option) => option.value === 'CI').textContent.includes('🇨🇮'));
    center.session = null; center.user = null;
    input(win, 'account-signup-username', 'Miner_One');
    await center.signUp();
    assert.strictEqual(doc.activeElement.id, 'account-signup-country');
    center.session = { ...session };
    center.user = { userId: 'account-1', username: 'Miner_One', email: 'miner@example.com', country: 'CI' };
    center.render();
    assert.ok(doc.getElementById('account-profile-country').textContent.includes('🇨🇮'));
    center.app.language = 'fr'; center.render();
    assert.ok(doc.querySelector('#account-signup-country option[value="FR"]').textContent.includes('France'));
  });

  await test('Photo locale isolée par compte, supprimable et protection des réponses tardives', async ({ center, win, doc }) => {
    let requestId;
    win.FitiaNative = { chooseProfilePhoto(id) { requestId = id; } };
    center.choosePhoto();
    win.dispatchEvent(new win.CustomEvent('fitia-profile-photo', { detail: { id: requestId, data: 'data:image/jpeg;base64,YWJj' } }));
    assert.strictEqual(win.localStorage.getItem('fitia_profile_photo_v1:account-1'), 'data:image/jpeg;base64,YWJj');
    assert.ok(doc.querySelector('#account-profile-avatar img'));
    center.user = { ...center.user, userId: 'account-2' }; center.render();
    assert.ok(!doc.querySelector('#account-profile-avatar img'));
    center.choosePhoto(); const stale = requestId;
    center.session = { ...session, accessToken: 'different-session' };
    win.dispatchEvent(new win.CustomEvent('fitia-profile-photo', { detail: { id: stale, data: 'data:image/jpeg;base64,YWJj' } }));
    assert.strictEqual(win.localStorage.getItem('fitia_profile_photo_v1:account-2'), null);
    center.user = { ...center.user, userId: 'account-1' }; center.render(); center.removePhoto();
    assert.strictEqual(win.localStorage.getItem('fitia_profile_photo_v1:account-1'), null);
    assert.ok(!doc.querySelector('#account-profile-avatar img'));
  });

  await test('Photo Android : échantillonnage initialisé et retour sûr en cas d’erreur ou d’annulation', async ({ center, win, doc }) => {
    const native = fs.readFileSync(path.join(ROOT, 'android-src/java/com/fitia/miningpro/MainActivity.java'), 'utf8');
    assert.match(native, /BitmapFactory\.Options options = new BitmapFactory\.Options\(\);[\s\S]*?options\.inSampleSize = 1;\s*while \(Math\.max\(bounds\.outWidth, bounds\.outHeight\) \/ options\.inSampleSize/);
    let requestId;
    win.FitiaNative = { chooseProfilePhoto(id) { requestId = id; } };
    center.choosePhoto();
    win.dispatchEvent(new win.CustomEvent('fitia-profile-photo', { detail: { id: requestId, data: 'error' } }));
    assert.ok(!doc.getElementById('account-profile-message').classList.contains('hidden'));
    assert.strictEqual(win.localStorage.getItem('fitia_profile_photo_v1:account-1'), null);
    center.choosePhoto();
    win.dispatchEvent(new win.CustomEvent('fitia-profile-photo', { detail: { id: requestId, data: '' } }));
    center.choosePhoto();
    win.dispatchEvent(new win.CustomEvent('fitia-profile-photo', { detail: { id: requestId, data: 'data:image/jpeg;base64,YWJj' } }));
    assert.ok(doc.querySelector('#account-profile-avatar img'));
  });

  await test('Compte : texte de déconnexion simplifié et bouton Authenticator lisible', async ({ win, doc }) => {
    assert.strictEqual(doc.querySelector('[data-i18n="accountPhotoLocal"]'), null);
    assert.strictEqual(translations.fr.accountLogout, 'Déconnecter le compte');
    const style = doc.createElement('style');
    style.textContent = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    doc.head.appendChild(style);
    const button = win.getComputedStyle(doc.getElementById('mfa-start'));
    assert.strictEqual(button.minHeight, '48px');
    assert.strictEqual(button.fontSize, '0.875rem');
  });

  await test('Compte : les avatars 3D prédéfinis ne sont plus proposés côté compte', async ({ doc }) => {
    assert.strictEqual(doc.querySelectorAll('#account-avatar-presets').length, 0);
    assert.strictEqual(doc.querySelectorAll('[data-account-avatar]').length, 0);
    assert.ok(!doc.body.innerHTML.includes('man-3d-'));
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
