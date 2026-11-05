/* FITIA PRO — compte applicatif Supabase, séparé du coffre non-custodial. */
(function (root, factory) {
  const AccountCenter = factory();
  if (typeof module === 'object' && module.exports) module.exports = AccountCenter;
  else root.FitiaAccountCenter = AccountCenter;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DEFAULT_API_URL = 'https://fitia-mining-pro.vercel.app/api/account';

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
      this.refreshTimer = null;
      this.refreshPromise = null;
      this.profilePromise = null;
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
      this.byId('account-logout')?.addEventListener('click', () => this.logout().catch(() => {}));
      this.byId('account-retry')?.addEventListener('click', () => this.retryRestore().catch(() => {}));
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
        this.refreshProfile({ quiet: true }).catch(() => {});
      }
    }

    setMode(mode) {
      this.mode = mode === 'signup' ? 'signup' : 'login';
      this.message = ''; this.messageIsError = false; this.confirmation = '';
      this.render();
      this.byId(this.mode === 'signup' ? 'account-signup-email' : 'account-login-email')?.focus();
    }

    showMessage(message, isError = true) {
      this.message = String(message || '');
      this.messageIsError = isError;
      this.render();
    }

    setBusy(busy) {
      this.busy = busy;
      ['account-login-submit', 'account-signup-submit', 'account-username-submit', 'account-email-submit', 'account-password-submit', 'account-copy-wallet', 'account-link-wallet', 'account-logout', 'account-retry'].forEach((id) => {
        const element = this.byId(id); if (element) element.disabled = busy;
      });
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
      this.session = {
        accessToken,
        refreshToken,
        tokenType: 'bearer',
        expiresAt: String(result.session.expiresAt || '')
      };
      this.user = result.user;
      this.confirmation = ''; this.message = ''; this.messageIsError = false;
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
      this.profilePromise = (async () => {
        try {
          const result = await this.request('session');
          if (this.session?.accessToken !== accessToken) return null;
          this.user = result.user;
          this.canRetry = false;
          this.message = ''; this.messageIsError = false;
          this.render();
          return result;
        } catch (error) {
          if (this.session?.accessToken !== accessToken) return null;
          if (error.status === 401) await this.clearLocalSession();
          else if (!options.quiet) this.showMessage(error.message);
          throw error;
        } finally { this.profilePromise = null; }
      })();
      return this.profilePromise;
    }

    async signIn() {
      if (this.busy) return;
      const email = this.byId('account-login-email').value.trim();
      const password = this.byId('account-login-password').value;
      this.setBusy(true);
      try {
        const result = await this.request('login', { auth: false, body: { email, password } });
        await this.acceptSession(result);
        this.app.showToast?.(this.t('accountSignedIn', 'Account connected.'));
      } catch (error) { this.showMessage(error.message); }
      finally {
        this.byId('account-login-password').value = '';
        this.setBusy(false);
      }
    }

    async signUp() {
      if (this.busy) return;
      const username = this.byId('account-signup-username').value.trim();
      const email = this.byId('account-signup-email').value.trim();
      const password = this.byId('account-signup-password').value;
      const confirmation = this.byId('account-signup-confirm').value;
      if (password !== confirmation) {
        this.showMessage(this.t('accountPasswordMismatch', 'Passwords do not match.'));
        this.byId('account-signup-password').value = ''; this.byId('account-signup-confirm').value = '';
        return;
      }
      this.setBusy(true);
      try {
        const result = await this.request('signup', { auth: false, body: { email, password, username } });
        if (result.pendingConfirmation) {
          this.user = null; this.session = null;
          this.mode = 'login';
          this.byId('account-login-email').value = email;
          this.confirmation = this.t('accountConfirmEmail', 'Check your inbox to confirm your email, then sign in.');
          this.message = ''; this.messageIsError = false;
          this.render();
        } else {
          await this.acceptSession(result);
          this.app.showToast?.(this.t('accountCreated', 'Account created.'));
        }
      } catch (error) { this.showMessage(error.message); }
      finally {
        this.byId('account-signup-password').value = '';
        this.byId('account-signup-confirm').value = '';
        this.setBusy(false);
      }
    }

    async updateUsername() {
      if (this.busy || !this.session) return;
      const username = this.byId('account-username-input').value.trim();
      this.setBusy(true);
      try {
        const result = await this.request('profile', { body: { username } });
        this.user = result.user;
        this.message = ''; this.messageIsError = false;
        this.app.showToast?.(this.t('accountProfileUpdated', 'Username updated.'));
      } catch (error) { this.showMessage(error.message); }
      finally { this.setBusy(false); }
    }

    async changeEmail() {
      if (this.busy || !this.session) return;
      const email = this.byId('account-email-input').value.trim();
      const currentPassword = this.byId('account-email-current-password').value;
      this.setBusy(true);
      try {
        const result = await this.request('email', { body: { email, currentPassword } });
        await this.acceptSession(result, { notifyApp: false });
        this.app.showToast?.(this.t('accountEmailUpdated', 'Email address updated.'));
      } catch (error) { this.showMessage(error.message); }
      finally {
        this.byId('account-email-current-password').value = '';
        this.setBusy(false);
      }
    }

    async changePassword() {
      if (this.busy || !this.session) return;
      const currentPassword = this.byId('account-password-current').value;
      const newPassword = this.byId('account-password-new').value;
      const confirmation = this.byId('account-password-confirm').value;
      if (newPassword !== confirmation) {
        this.showMessage(this.t('accountPasswordMismatch', 'Passwords do not match.'));
        this.byId('account-password-current').value = '';
        this.byId('account-password-new').value = '';
        this.byId('account-password-confirm').value = '';
        return;
      }
      this.setBusy(true);
      try {
        const result = await this.request('password', { body: { currentPassword, newPassword } });
        await this.acceptSession(result, { notifyApp: false });
        this.app.showToast?.(this.t('accountPasswordUpdated', 'Password updated.'));
      } catch (error) { this.showMessage(error.message); }
      finally {
        this.byId('account-password-current').value = '';
        this.byId('account-password-new').value = '';
        this.byId('account-password-confirm').value = '';
        this.setBusy(false);
      }
    }

    async copyWalletAddress() {
      const address = String(this.user?.walletAddress || '');
      if (!this.user?.walletVerified || !/^0x[0-9a-fA-F]{40}$/.test(address)) return;
      await FitiaSecurity.Native.copyText(address);
      this.app.showToast?.(this.t('addrCopied', 'Address copied!'));
    }

    async linkWallet() {
      if (this.busy || !this.session) return;
      const walletAddress = String(this.app.user || '');
      if (!this.app.signer || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
        this.showMessage(this.t('accountUnlockWallet', 'Unlock your wallet to link it.'));
        return;
      }
      this.setBusy(true);
      try {
        const challenge = await this.request('challenge', { body: { walletAddress } });
        if (String(this.app.user || '').toLowerCase() !== walletAddress.toLowerCase()) throw new Error('Wallet changed during account linking');
        const signature = await this.app.signer.signMessage(challenge.message);
        const result = await this.request('link', {
          body: { challengeId: challenge.challengeId, walletAddress, message: challenge.message, signature }
        });
        this.user = result.user;
        this.message = ''; this.messageIsError = false;
        this.app.showToast?.(this.t('accountWalletLinked', 'Wallet verified by signature.'));
      } catch (error) { this.showMessage(error.message); }
      finally { this.setBusy(false); }
    }

    async clearLocalSession() {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
      const hadSession = Boolean(this.session || this.user);
      this.session = null; this.user = null; this.confirmation = '';
      this.canRetry = false;
      this.profileInputKey = '';
      ['account-email-current-password', 'account-password-current', 'account-password-new', 'account-password-confirm'].forEach((id) => {
        const input = this.byId(id); if (input) input.value = '';
      });
      this.render();
      if (hadSession) await this.app.onAccountSignedOut?.();
      if (this.storage) {
        try { await this.storage.clearAccountSession(); } catch (_) { /* Effacement local de secours. */ }
      }
    }

    async logout() {
      if (this.busy) return;
      this.setBusy(true);
      try {
        if (this.session?.accessToken) {
          try { await this.request('logout', { body: {}, retry: false }); } catch (_) { /* Le jeton local est effacé dans tous les cas. */ }
        }
        await this.clearLocalSession();
        this.mode = 'login'; this.message = ''; this.messageIsError = false;
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
      const message = this.byId('account-message');
      if (message) {
        message.textContent = this.message;
        message.classList.toggle('account-message-success', !this.messageIsError);
        message.classList.toggle('hidden', !this.message);
      }
      const confirmation = this.byId('account-confirmation');
      if (confirmation) { confirmation.textContent = this.confirmation; confirmation.classList.toggle('hidden', !this.confirmation); }
      if (!connected) return;

      this.byId('account-profile-name').textContent = this.user.username;
      this.byId('account-profile-email').textContent = this.user.email;
      this.byId('account-profile-avatar').textContent = String(this.user.username || 'F').charAt(0).toUpperCase();
      const profileInputKey = `${this.user.userId || this.user.id}:${this.user.username}:${this.user.email}`;
      if (this.profileInputKey !== profileInputKey) {
        this.profileInputKey = profileInputKey;
        this.byId('account-username-input').value = this.user.username;
        this.byId('account-email-input').value = this.user.email;
      }
      const badges = this.byId('account-profile-badges'); badges.textContent = '';
      if (this.user.emailVerified) this.renderBadge(badges, this.t('accountEmailVerified', 'Email confirmed'), 'email');
      if (this.user.walletVerified) this.renderBadge(badges, this.t('accountWalletVerified', 'Wallet verified'), 'wallet');
      if (this.user.certified) this.renderBadge(badges, this.t('accountAdminCertified', 'Certified by admin'), 'admin');
      if (!badges.children.length) this.renderBadge(badges, this.t('accountNoBadge', 'No verification badge yet'), 'none');
      const currentWallet = String(this.app.user || '').toLowerCase();
      const linkedWallet = String(this.user.walletAddress || '').toLowerCase();
      const sameWallet = Boolean(linkedWallet && linkedWallet === currentWallet);
      const walletText = this.byId('account-profile-wallet');
      walletText.textContent = this.user.walletVerified
        ? this.user.walletAddress
        : this.t('accountNoLinkedWallet', 'No wallet linked to this account.');
      const copyButton = this.byId('account-copy-wallet');
      copyButton?.classList.toggle('hidden', !this.user.walletVerified || !this.user.walletAddress);
      const linkButton = this.byId('account-link-wallet');
      linkButton.disabled = this.busy || !this.app.signer || (this.user.walletVerified && !sameWallet) || sameWallet;
      linkButton.textContent = sameWallet
        ? this.t('accountWalletVerified', 'Wallet verified')
        : this.t('accountLinkWallet', 'Verify this wallet by signature');
      linkButton.classList.toggle('hidden', sameWallet);
    }
  }

  return FitiaAccountCenter;
});
