/* FITIA PRO — compte applicatif Supabase, séparé du coffre non-custodial. */
(function (root, factory) {
  const AccountCenter = factory();
  if (typeof module === 'object' && module.exports) module.exports = AccountCenter;
  else root.FitiaAccountCenter = AccountCenter;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DEFAULT_API_URL = 'https://fitia-mining-pro.vercel.app/api/account';
  const PASSWORD_FIELDS = [
    'account-login-password', 'account-signup-password', 'account-signup-confirm',
    'account-email-current-password', 'account-password-current',
    'account-password-new', 'account-password-confirm'
  ];
  const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_]{2,23}$/;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

  // Ces contrôles reflètent les règles du service, qui reste l'autorité finale.
  function validEmail(value) {
    return value.length <= 254 && EMAIL_PATTERN.test(value) && !CONTROL_CHARACTERS.test(value);
  }

  function validNewPassword(value) {
    return typeof value === 'string' && value.length >= 12 && value.length <= 128
      && !CONTROL_CHARACTERS.test(value) && /[A-Za-z]/.test(value) && /\d/.test(value)
      && !/^(password|motdepasse|qwerty|letmein)/i.test(value);
  }

  function validCurrentPassword(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 128
      && !CONTROL_CHARACTERS.test(value);
  }

  class FitiaAccountCenter {
    constructor(app, options = {}) {
      this.app = app;
      this.apiUrl = String(options.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
      this.fetch = options.fetch || ((...args) => globalThis.fetch(...args));
      this.storage = options.storage || (typeof FitiaSecurity !== 'undefined' ? FitiaSecurity.Vault : null);
      this.session = null;
      this.user = null;
      this.mode = 'login';
      this.busy = false;
      this.confirmation = '';
      this.message = '';
      this.messageIsError = false;
      this.messageScope = 'global';
      this.logoutConfirmationOpen = false;
      this.refreshTimer = null;
      this.refreshPromise = null;
      this.profilePromise = null;
      this.profileRevision = 0;
      this.profileInputKey = '';
      this.initialized = false;
      this.canRetry = false;
    }

    t(key, fallback) {
      const value = this.app && typeof this.app.t === 'function' ? this.app.t(key) : key;
      return value && value !== key ? value : fallback;
    }

    byId(id) { return document.getElementById(id); }

    init() {
      if (this.initialized) return;
      this.initialized = true;
      this.byId('account-login-form')?.addEventListener('submit', (event) => {
        event.preventDefault(); this.signIn().catch(() => {});
      });
      this.byId('account-signup-form')?.addEventListener('submit', (event) => {
        event.preventDefault(); this.signUp().catch(() => {});
      });
      this.byId('account-username-form')?.addEventListener('submit', (event) => {
        event.preventDefault(); this.updateUsername().catch(() => {});
      });
      this.byId('account-email-form')?.addEventListener('submit', (event) => {
        event.preventDefault(); this.changeEmail().catch(() => {});
      });
      this.byId('account-password-form')?.addEventListener('submit', (event) => {
        event.preventDefault(); this.changePassword().catch(() => {});
      });
      this.byId('account-copy-wallet')?.addEventListener('click', () => this.copyWalletAddress().catch(() => {}));
      this.byId('account-show-login')?.addEventListener('click', () => this.setMode('login'));
      this.byId('account-show-signup')?.addEventListener('click', () => this.setMode('signup'));
      this.byId('account-link-wallet')?.addEventListener('click', () => this.linkWallet().catch(() => {}));
      this.byId('account-refresh-profile')?.addEventListener('click', () => this.refreshAccount().catch(() => {}));
      this.byId('account-logout')?.addEventListener('click', () => this.setLogoutConfirmation(!this.logoutConfirmationOpen));
      this.byId('account-logout-cancel')?.addEventListener('click', () => this.setLogoutConfirmation(false, true));
      this.byId('account-logout-confirm')?.addEventListener('click', () => this.logout().catch(() => {}));
      this.byId('account-retry')?.addEventListener('click', () => this.retryRestore().catch(() => {}));
      document.querySelectorAll('[data-account-password-toggle]').forEach((button) => {
        button.addEventListener('click', () => this.togglePassword(button.getAttribute('data-account-password-toggle')));
      });
      const inputs = {
        global: ['account-login-email', 'account-login-password', 'account-signup-username', 'account-signup-email', 'account-signup-password', 'account-signup-confirm'],
        username: ['account-username-input'],
        email: ['account-email-input', 'account-email-current-password'],
        password: ['account-password-current', 'account-password-new', 'account-password-confirm']
      };
      Object.entries(inputs).forEach(([scope, ids]) => ids.forEach((id) => {
        this.byId(id)?.addEventListener('input', (event) => {
          event.currentTarget.removeAttribute('aria-invalid');
          this.clearMessage(scope);
          this.render();
        });
      }));
      [
        ['account-email-disclosure', ['account-email-current-password']],
        ['account-password-disclosure', ['account-password-current', 'account-password-new', 'account-password-confirm']]
      ].forEach(([id, fields]) => {
        const disclosure = this.byId(id);
        disclosure?.addEventListener('toggle', () => {
          if (!disclosure.open) this.clearPasswords(fields);
        });
      });
      this.render();
    }

    isAuthenticated() {
      const userId = this.user?.userId || this.user?.id;
      return typeof this.session?.accessToken === 'string' && this.session.accessToken.length > 0
        && typeof userId === 'string' && userId.length > 0;
    }

    open(options = {}) {
      this.render();
      if (options.refresh !== false && this.session && !this.profilePromise) {
        this.refreshProfile({ quiet: true }).catch(() => {
          if (this.isAuthenticated()) this.showMessage(this.t('accountSyncFailed', 'Could not refresh your account.'), true, 'profile');
        });
      }
    }

    setMode(mode) {
      this.mode = mode === 'signup' ? 'signup' : 'login';
      this.clearPasswords(['account-login-password', 'account-signup-password', 'account-signup-confirm']);
      ['account-login-email', 'account-signup-username', 'account-signup-email'].forEach((id) => this.byId(id)?.removeAttribute('aria-invalid'));
      this.clearMessage(); this.confirmation = '';
      this.render();
      this.byId(this.mode === 'signup' ? 'account-signup-username' : 'account-login-email')?.focus();
    }

    clearMessage(scope = null) {
      if (scope && this.messageScope !== scope) return;
      this.message = ''; this.messageIsError = false; this.messageScope = 'global';
    }

    showMessage(message, isError = true, scope = 'global') {
      this.message = String(message || '');
      this.messageIsError = isError;
      this.messageScope = scope;
      this.render();
    }

    invalidField(id, message, scope = 'global') {
      const input = this.byId(id);
      input?.setAttribute('aria-invalid', 'true');
      this.showMessage(message, true, scope);
      input?.focus();
    }

    setBusy(busy, action = '') {
      this.busy = busy;
      ['account-login-submit', 'account-signup-submit', 'account-show-login', 'account-show-signup',
        'account-username-submit', 'account-email-submit', 'account-password-submit', 'account-copy-wallet',
        'account-link-wallet', 'account-refresh-profile', 'account-logout', 'account-logout-confirm',
        'account-logout-cancel', 'account-retry'].forEach((id) => {
        const element = this.byId(id);
        if (!element) return;
        element.disabled = busy;
        element.classList.toggle('account-button-busy', busy && action === id);
        element.setAttribute('aria-busy', String(busy && action === id));
      });
      document.querySelectorAll('#account-access-screen .account-form input').forEach((input) => { input.disabled = busy; });
      this.render();
    }

    setLogoutConfirmation(open, returnFocus = false) {
      if (this.busy) return;
      this.logoutConfirmationOpen = Boolean(open);
      this.render();
      if (open) this.byId('account-logout-cancel')?.focus();
      else if (returnFocus) this.byId('account-logout')?.focus();
    }

    renderPasswordToggles() {
      document.querySelectorAll('[data-account-password-toggle]').forEach((button) => {
        const id = button.getAttribute('data-account-password-toggle');
        const input = this.byId(id);
        if (!input) return;
        const visible = input.type === 'text';
        const action = visible ? this.t('accountHidePassword', 'Hide') : this.t('accountShowPassword', 'Show');
        const label = document.querySelector(`label[for="${id}"]`)?.textContent || '';
        button.textContent = action;
        button.setAttribute('aria-pressed', String(visible));
        button.setAttribute('aria-label', label ? `${action} : ${label}` : action);
        button.disabled = this.busy;
      });
    }

    togglePassword(id) {
      if (this.busy) return;
      const input = this.byId(id);
      if (!input || !PASSWORD_FIELDS.includes(id)) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      this.renderPasswordToggles();
    }

    maskPasswords(ids = PASSWORD_FIELDS) {
      ids.forEach((id) => {
        const input = this.byId(id);
        if (input) input.type = 'password';
      });
      this.renderPasswordToggles();
    }

    clearPasswords(ids = PASSWORD_FIELDS) {
      ids.forEach((id) => {
        const input = this.byId(id);
        if (input) { input.value = ''; input.removeAttribute('aria-invalid'); }
      });
      this.maskPasswords(ids);
    }

    close() {
      this.clearPasswords();
      ['account-email-disclosure', 'account-password-disclosure'].forEach((id) => {
        const disclosure = this.byId(id); if (disclosure) disclosure.open = false;
      });
      ['account-username-input', 'account-email-input'].forEach((id) => {
        const input = this.byId(id);
        if (input) { input.value = id === 'account-username-input' ? (this.user?.username || '') : ''; input.removeAttribute('aria-invalid'); }
      });
      this.profileInputKey = '';
      this.logoutConfirmationOpen = false;
      this.clearMessage();
      this.render();
    }

    async request(action, options = {}) {
      const auth = options.auth !== false;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const headers = { Accept: 'application/json' };
        if (options.body !== undefined) headers['Content-Type'] = 'application/json';
        if (auth && this.session?.accessToken) headers.Authorization = `Bearer ${this.session.accessToken}`;
        const response = await this.fetch(`${this.apiUrl}/${action}`, {
          method: options.method || (options.body === undefined ? 'GET' : 'POST'),
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          cache: 'no-store',
          signal: controller.signal
        });
        let data = {};
        try { data = await response.json(); } catch (_) { /* Réponse vide ou invalide. */ }
        if (response.status === 401 && auth && options.retry !== false && this.session?.refreshToken) {
          await this.refreshSession();
          return this.request(action, { ...options, retry: false });
        }
        if (!response.ok) {
          const error = new Error(data.error || this.t('accountServiceError', 'Account service unavailable.'));
          error.code = data.code || 'ACCOUNT_ERROR'; error.status = response.status;
          throw error;
        }
        return data;
      } catch (error) {
        if (error && error.status) throw error;
        const unavailable = new Error(this.t('accountServiceError', 'Account service unavailable. Check your connection and try again.'));
        unavailable.code = 'ACCOUNT_UNAVAILABLE'; unavailable.status = 503;
        throw unavailable;
      } finally { clearTimeout(timeout); }
    }

    async acceptSession(result, options = {}) {
      const accessToken = result?.session?.accessToken;
      const refreshToken = result?.session?.refreshToken;
      const userId = result?.user?.userId || result?.user?.id;
      if (typeof accessToken !== 'string' || !accessToken || typeof refreshToken !== 'string' || !refreshToken
        || typeof userId !== 'string' || !userId) throw new Error('Invalid account session response');
      this.profileRevision += 1;
      this.session = {
        accessToken,
        refreshToken,
        tokenType: 'bearer',
        expiresAt: String(result.session.expiresAt || '')
      };
      this.user = result.user;
      this.confirmation = ''; this.clearMessage();
      if (this.storage) {
        try { await this.storage.sealAccountSession(this.session); }
        catch (_) { /* La session reste utilisable en mémoire si le stockage est indisponible. */ }
      }
      this.canRetry = false;
      this.scheduleRefresh();
      this.render();
      if (options.notifyApp !== false) await this.app.onAccountAuthenticated?.();
    }

    scheduleRefresh() {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
      const expiresAt = Date.parse(this.session?.expiresAt || '');
      if (!Number.isFinite(expiresAt)) return;
      const delay = Math.max(5000, Math.min(2147480000, expiresAt - Date.now() - 60000));
      this.refreshTimer = setTimeout(() => {
        this.refreshSession().catch((error) => {
          if (error.status !== 401 && this.session) {
            this.refreshTimer = setTimeout(() => this.refreshSession().catch(() => {}), 60000);
          }
        });
      }, delay);
    }

    async refreshSession() {
      if (this.refreshPromise) return this.refreshPromise;
      const refreshToken = this.session?.refreshToken;
      if (!refreshToken) throw new Error('No account session');
      this.refreshPromise = (async () => {
        try {
          const result = await this.request('refresh', { auth: false, body: { refreshToken }, retry: false });
          if (this.session?.refreshToken !== refreshToken) {
            const changed = new Error(this.t('accountServiceError', 'Account session changed.'));
            changed.code = 'ACCOUNT_SESSION_CHANGED'; changed.status = 409;
            throw changed;
          }
          await this.acceptSession(result, { notifyApp: false });
          return result;
        } catch (error) {
          if (error.status === 401) await this.clearLocalSession();
          throw error;
        } finally { this.refreshPromise = null; }
      })();
      return this.refreshPromise;
    }

    async restore() {
      this.canRetry = false;
      this.setBusy(true);
      try {
        if (!this.storage) { this.render(); return false; }
        const stored = await this.storage.readAccountSession();
        if (!stored) { this.session = null; this.user = null; this.render(); return false; }
        this.session = stored;
        this.scheduleRefresh();
        try {
          await this.refreshProfile({ quiet: true });
          this.canRetry = false;
          this.render();
          return this.isAuthenticated();
        } catch (error) {
          if (this.session) {
            this.canRetry = true;
            this.showMessage(error.message || this.t('accountServiceError', 'Account service unavailable.'));
          }
          this.render();
          return false;
        }
      } catch (error) {
        this.session = null; this.user = null; this.canRetry = true;
        this.showMessage(error.message || this.t('accountServiceError', 'Account service unavailable.'));
        return false;
      } finally { this.setBusy(false); }
    }

    async retryRestore() {
      if (this.busy) return;
      this.setBusy(true);
      try {
        const restored = await this.restore();
        if (restored) await this.app.onAccountAuthenticated?.();
      } catch (error) { this.showMessage(error.message); }
      finally { this.setBusy(false); }
    }

    async refreshProfile(options = {}) {
      if (this.profilePromise) return this.profilePromise;
      const accessToken = this.session?.accessToken;
      if (!accessToken) return null;
      // Une actualisation antérieure ne doit pas écraser un profil modifié entre-temps.
      const revision = this.profileRevision;
      this.profilePromise = (async () => {
        try {
          const result = await this.request('session');
          if (this.session?.accessToken !== accessToken || this.profileRevision !== revision) return null;
          this.user = result.user;
          this.canRetry = false;
          this.clearMessage('profile');
          this.render();
          return result;
        } catch (error) {
          if (this.session?.accessToken !== accessToken || this.profileRevision !== revision) return null;
          if (error.status === 401) await this.clearLocalSession();
          else if (!options.quiet) this.showMessage(error.message);
          throw error;
        } finally { this.profilePromise = null; }
      })();
      return this.profilePromise;
    }

    async refreshAccount() {
      if (this.busy || !this.session) return;
      this.clearMessage('profile');
      this.setBusy(true, 'account-refresh-profile');
      try {
        await this.refreshProfile({ quiet: true });
        if (this.isAuthenticated()) this.showMessage(this.t('accountSyncSuccess', 'Account refreshed.'), false, 'profile');
      } catch (error) {
        if (this.isAuthenticated()) this.showMessage(this.t('accountSyncFailed', 'Could not refresh your account.'), true, 'profile');
        else this.showMessage(error.message || this.t('accountServiceError', 'Account service unavailable.'));
      } finally { this.setBusy(false); }
    }

    async signIn() {
      if (this.busy) return;
      const email = this.byId('account-login-email').value.trim();
      const password = this.byId('account-login-password').value;
      if (!validEmail(email)) {
        this.clearPasswords(['account-login-password']);
        this.invalidField('account-login-email', this.t('accountEmailInvalid', 'Enter a valid email address.'));
        return;
      }
      if (!validCurrentPassword(password)) {
        this.clearPasswords(['account-login-password']);
        this.invalidField('account-login-password', this.t('accountCurrentPasswordRequired', 'Enter your password.'));
        return;
      }
      this.clearMessage();
      this.setBusy(true, 'account-login-submit');
      try {
        const result = await this.request('login', { auth: false, body: { email, password } });
        await this.acceptSession(result);
        this.app.showToast?.(this.t('accountSignedIn', 'Account connected.'));
      } catch (error) { this.showMessage(error.message); }
      finally {
        this.clearPasswords(['account-login-password']);
        this.setBusy(false);
      }
    }

    async signUp() {
      if (this.busy) return;
      const username = this.byId('account-signup-username').value.trim();
      const email = this.byId('account-signup-email').value.trim();
      const password = this.byId('account-signup-password').value;
      const confirmation = this.byId('account-signup-confirm').value;
      if (!USERNAME_PATTERN.test(username)) {
        this.invalidField('account-signup-username', this.t('accountUsernameHelp', 'Choose a valid username.'));
        return;
      }
      if (!validEmail(email)) {
        this.invalidField('account-signup-email', this.t('accountEmailInvalid', 'Enter a valid email address.'));
        return;
      }
      if (!validNewPassword(password)) {
        this.clearPasswords(['account-signup-password', 'account-signup-confirm']);
        this.invalidField('account-signup-password', this.t('accountPasswordHelp', 'Choose a valid password.'));
        return;
      }
      if (password !== confirmation) {
        this.clearPasswords(['account-signup-password', 'account-signup-confirm']);
        this.invalidField('account-signup-confirm', this.t('accountPasswordMismatch', 'Passwords do not match.'));
        this.byId('account-signup-password')?.focus();
        return;
      }
      this.clearMessage();
      this.setBusy(true, 'account-signup-submit');
      try {
        const result = await this.request('signup', { auth: false, body: { email, password, username } });
        if (result.pendingConfirmation) {
          this.user = null; this.session = null;
          this.mode = 'login';
          this.byId('account-login-email').value = email;
          this.confirmation = this.t('accountConfirmEmail', 'Check your inbox to confirm your email, then sign in.');
          this.clearMessage();
          this.render();
        } else {
          await this.acceptSession(result);
          this.app.showToast?.(this.t('accountCreated', 'Account created.'));
        }
      } catch (error) { this.showMessage(error.message); }
      finally {
        this.clearPasswords(['account-signup-password', 'account-signup-confirm']);
        this.setBusy(false);
      }
    }

    async updateUsername() {
      if (this.busy || !this.session) return;
      const username = this.byId('account-username-input').value.trim();
      if (!USERNAME_PATTERN.test(username)) {
        this.invalidField('account-username-input', this.t('accountUsernameHelp', 'Choose a valid username.'), 'username');
        return;
      }
      if (username === this.user?.username) {
        this.showMessage(this.t('accountNothingToSave', 'There are no changes to save.'), false, 'username');
        return;
      }
      this.clearMessage();
      this.setBusy(true, 'account-username-submit');
      try {
        const result = await this.request('profile', { body: { username } });
        if (!this.session) return;
        this.profileRevision += 1;
        this.user = result.user;
        this.showMessage(this.t('accountProfileUpdated', 'Username updated.'), false, 'username');
        this.app.showToast?.(this.t('accountProfileUpdated', 'Username updated.'));
      } catch (error) { this.showMessage(error.message, true, 'username'); }
      finally { this.setBusy(false); }
    }

    async changeEmail() {
      if (this.busy || !this.session) return;
      const email = this.byId('account-email-input').value.trim();
      const currentPassword = this.byId('account-email-current-password').value;
      if (!validEmail(email)) {
        this.invalidField('account-email-input', this.t('accountEmailInvalid', 'Enter a valid email address.'), 'email');
        return;
      }
      if (email.toLowerCase() === String(this.user?.email || '').toLowerCase()) {
        this.invalidField('account-email-input', this.t('accountEmailSame', 'Enter a different email address.'), 'email');
        return;
      }
      if (!validCurrentPassword(currentPassword)) {
        this.clearPasswords(['account-email-current-password']);
        this.invalidField('account-email-current-password', this.t('accountCurrentPasswordRequired', 'Enter your current password.'), 'email');
        return;
      }
      this.clearMessage();
      this.setBusy(true, 'account-email-submit');
      try {
        const result = await this.request('email', { body: { email, currentPassword } });
        if (!this.session) return;
        await this.acceptSession(result, { notifyApp: false });
        this.byId('account-email-input').value = '';
        this.showMessage(this.t('accountEmailUpdated', 'Email address updated.'), false, 'email');
        this.app.showToast?.(this.t('accountEmailUpdated', 'Email address updated.'));
      } catch (error) { this.showMessage(error.message, true, 'email'); }
      finally {
        this.clearPasswords(['account-email-current-password']);
        this.setBusy(false);
      }
    }

    async changePassword() {
      if (this.busy || !this.session) return;
      const fields = ['account-password-current', 'account-password-new', 'account-password-confirm'];
      const currentPassword = this.byId('account-password-current').value;
      const newPassword = this.byId('account-password-new').value;
      const confirmation = this.byId('account-password-confirm').value;
      if (!validCurrentPassword(currentPassword)) {
        this.clearPasswords(['account-password-current']);
        this.invalidField('account-password-current', this.t('accountCurrentPasswordRequired', 'Enter your current password.'), 'password');
        return;
      }
      if (newPassword !== confirmation) {
        this.clearPasswords(fields);
        this.invalidField('account-password-confirm', this.t('accountPasswordMismatch', 'Passwords do not match.'), 'password');
        this.byId('account-password-current')?.focus();
        return;
      }
      if (!validNewPassword(newPassword)) {
        this.clearPasswords(fields);
        this.invalidField('account-password-new', this.t('accountPasswordHelp', 'Choose a valid password.'), 'password');
        this.byId('account-password-current')?.focus();
        return;
      }
      if (newPassword === currentPassword) {
        this.clearPasswords(fields);
        this.invalidField('account-password-new', this.t('accountPasswordSame', 'Choose a different password.'), 'password');
        this.byId('account-password-current')?.focus();
        return;
      }
      this.clearMessage();
      this.setBusy(true, 'account-password-submit');
      try {
        const result = await this.request('password', { body: { currentPassword, newPassword } });
        if (!this.session) return;
        await this.acceptSession(result, { notifyApp: false });
        this.showMessage(this.t('accountPasswordUpdated', 'Password updated.'), false, 'password');
        this.app.showToast?.(this.t('accountPasswordUpdated', 'Password updated.'));
      } catch (error) { this.showMessage(error.message, true, 'password'); }
      finally {
        this.clearPasswords(fields);
        this.setBusy(false);
      }
    }

    async copyWalletAddress() {
      const address = String(this.user?.walletAddress || '');
      if (!this.user?.walletVerified || !/^0x[0-9a-fA-F]{40}$/.test(address)) return;
      try {
        if (!await FitiaSecurity.Native.copyText(address)) throw new Error('COPY_FAILED');
        this.showMessage(this.t('addrCopied', 'Address copied!'), false, 'wallet');
        this.app.showToast?.(this.t('addrCopied', 'Address copied!'));
      } catch (_) {
        this.showMessage(this.t('accountWalletCopyFailed', 'Could not copy the address.'), true, 'wallet');
      }
    }

    async linkWallet() {
      if (this.busy || !this.session) return;
      const walletAddress = String(this.app.user || '');
      if (!this.app.signer || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
        this.showMessage(this.t('accountUnlockWallet', 'Unlock your wallet to link it.'), true, 'wallet');
        return;
      }
      const signer = this.app.signer;
      const walletUnchanged = () => Boolean(this.session && this.app.signer === signer
        && String(this.app.user || '').toLowerCase() === walletAddress.toLowerCase());
      const changedError = () => new Error(this.t('accountWalletChanged', 'The wallet changed or was locked. Unlock it and try again.'));
      this.clearMessage();
      this.setBusy(true, 'account-link-wallet');
      try {
        const challenge = await this.request('challenge', { body: { walletAddress } });
        if (!walletUnchanged()) throw changedError();
        const signature = await signer.signMessage(challenge.message);
        if (!walletUnchanged()) throw changedError();
        const result = await this.request('link', {
          body: { challengeId: challenge.challengeId, walletAddress, message: challenge.message, signature }
        });
        if (!this.session) return;
        this.profileRevision += 1;
        this.user = result.user;
        this.showMessage(this.t('accountWalletLinked', 'Wallet verified by signature.'), false, 'wallet');
        this.app.showToast?.(this.t('accountWalletLinked', 'Wallet verified by signature.'));
      } catch (error) {
        if (this.isAuthenticated()) this.showMessage(error.message, true, 'wallet');
        else this.clearMessage();
      } finally { this.setBusy(false); }
    }

    async clearLocalSession() {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
      const hadSession = Boolean(this.session || this.user);
      this.profileRevision += 1;
      this.session = null; this.user = null; this.confirmation = '';
      this.canRetry = false;
      ['account-login-email', 'account-signup-username', 'account-signup-email'].forEach((id) => {
        const input = this.byId(id); if (input) { input.value = ''; input.removeAttribute('aria-invalid'); }
      });
      this.close();
      if (hadSession) await this.app.onAccountSignedOut?.();
      if (this.storage) {
        try { await this.storage.clearAccountSession(); } catch (_) { /* Effacement local de secours. */ }
      }
    }

    async logout() {
      if (this.busy) return;
      this.setBusy(true, 'account-logout-confirm');
      try {
        if (this.session?.accessToken) {
          try { await this.request('logout', { body: {}, retry: false }); } catch (_) { /* Le jeton local est effacé dans tous les cas. */ }
        }
        await this.clearLocalSession();
        this.mode = 'login'; this.clearMessage();
        this.render();
      } finally { this.setBusy(false); }
    }

    renderBadge(container, label, kind) {
      const item = document.createElement('span');
      item.className = `account-status-badge account-status-${kind}`;
      item.textContent = label;
      container.appendChild(item);
    }

    render() {
      const auth = this.byId('account-auth-panel');
      if (!auth) return;
      const connected = this.isAuthenticated();
      auth.classList.toggle('hidden', connected);
      this.byId('account-profile-panel')?.classList.toggle('hidden', !connected);
      this.byId('account-access-screen')?.classList.toggle('account-required', !connected);
      this.byId('account-access-intro')?.classList.toggle('hidden', connected);
      this.byId('account-access-close')?.classList.toggle('hidden', !connected);
      this.byId('account-retry')?.classList.toggle('hidden', connected || !this.canRetry);
      this.byId('account-login-form')?.classList.toggle('hidden', this.mode !== 'login');
      this.byId('account-signup-form')?.classList.toggle('hidden', this.mode !== 'signup');
      this.byId('account-show-login')?.classList.toggle('active', this.mode === 'login');
      this.byId('account-show-signup')?.classList.toggle('active', this.mode === 'signup');
      this.byId('account-show-login')?.setAttribute('aria-selected', String(this.mode === 'login'));
      this.byId('account-show-signup')?.setAttribute('aria-selected', String(this.mode === 'signup'));
      this.renderPasswordToggles();
      const live = this.byId('account-live-status');
      if (live) live.textContent = this.busy ? this.t('accountWorking', 'Working…') : '';
      const messageIds = {
        global: 'account-message', profile: 'account-profile-message', username: 'account-username-message',
        email: 'account-email-message', password: 'account-password-message', wallet: 'account-wallet-message'
      };
      Object.entries(messageIds).forEach(([scope, id]) => {
        const element = this.byId(id);
        if (!element) return;
        const visible = Boolean(this.message) && this.messageScope === scope;
        element.textContent = visible ? this.message : '';
        element.classList.toggle('account-message-success', visible && !this.messageIsError);
        element.classList.toggle('hidden', !visible);
        element.setAttribute('role', visible && this.messageIsError ? 'alert' : 'status');
      });
      const confirmation = this.byId('account-confirmation');
      if (confirmation) { confirmation.textContent = this.confirmation; confirmation.classList.toggle('hidden', !this.confirmation); }
      this.byId('account-logout-confirmation')?.classList.toggle('hidden', !connected || !this.logoutConfirmationOpen);
      this.byId('account-logout')?.setAttribute('aria-expanded', String(connected && this.logoutConfirmationOpen));
      if (!connected) return;

      this.byId('account-profile-name').textContent = this.user.username;
      this.byId('account-profile-email').textContent = this.user.email;
      this.byId('account-profile-avatar').textContent = String(this.user.username || 'F').charAt(0).toUpperCase();
      const profileInputKey = `${this.user.userId || this.user.id}:${this.user.username}`;
      if (this.profileInputKey !== profileInputKey) {
        this.profileInputKey = profileInputKey;
        this.byId('account-username-input').value = this.user.username;
      }
      const usernameInput = this.byId('account-username-input');
      const usernameSubmit = this.byId('account-username-submit');
      if (usernameInput && usernameSubmit) usernameSubmit.disabled = this.busy || usernameInput.value.trim() === this.user.username;

      const badges = this.byId('account-profile-badges'); badges.textContent = '';
      this.renderBadge(badges, this.user.emailVerified
        ? this.t('accountEmailVerified', 'Email confirmed')
        : this.t('accountEmailPending', 'Email unconfirmed'), this.user.emailVerified ? 'email' : 'pending');
      const linkedAddress = String(this.user.walletAddress || '');
      const walletVerified = Boolean(this.user.walletVerified && /^0x[0-9a-fA-F]{40}$/.test(linkedAddress));
      this.renderBadge(badges, walletVerified
        ? this.t('accountWalletVerified', 'Wallet verified')
        : this.t('accountWalletPending', 'Wallet not linked'), walletVerified ? 'wallet' : 'pending');
      if (this.user.certified) this.renderBadge(badges, this.t('accountAdminCertified', 'Certified by admin'), 'admin');

      const currentWallet = String(this.app.user || '').toLowerCase();
      const linkedWallet = linkedAddress.toLowerCase();
      const sameWallet = Boolean(walletVerified && linkedWallet === currentWallet);
      const hasUnlockedWallet = Boolean(this.app.signer && /^0x[0-9a-fA-F]{40}$/.test(currentWallet));
      const walletText = this.byId('account-profile-wallet');
      walletText.textContent = walletVerified ? linkedAddress : this.t('accountNoLinkedWallet', 'No wallet linked to this account.');
      this.byId('account-copy-wallet')?.classList.toggle('hidden', !walletVerified);
      const explanation = this.byId('account-wallet-explanation');
      if (explanation) {
        explanation.textContent = walletVerified && currentWallet && !sameWallet
          ? this.t('accountWalletDifferent', 'The open wallet differs from the wallet linked to this account.')
          : walletVerified
            ? this.t('accountWalletVerifiedHelp', 'This wallet is linked and verified by signature.')
            : hasUnlockedWallet
              ? this.t('accountWalletSignatureHelp', 'A signature verifies your wallet without a transaction or network fee.')
              : this.t('accountUnlockWallet', 'Unlock your wallet to link it.');
      }
      const linkButton = this.byId('account-link-wallet');
      this.byId('account-profile-actions')?.classList.toggle('hidden', walletVerified);
      if (linkButton) {
        linkButton.disabled = this.busy || !hasUnlockedWallet || walletVerified;
        linkButton.textContent = this.t('accountLinkWallet', 'Verify this wallet by signature');
        linkButton.classList.toggle('hidden', walletVerified);
      }
    }
  }

  return FitiaAccountCenter;
});
