/* Optional transaction authentication; never stores the seed or recovery codes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FitiaMfaClient = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class FitiaMfaClient {
    constructor(account, options = {}) {
      this.account = account;
      this.document = options.document || document;
      this.qr = options.qr || (typeof qrcode !== 'undefined' ? qrcode : null);
      this.busy = false;
      this.generation = 0;
      this.pendingOperation = null;
    }
    el(id) { return this.document.getElementById(id); }
    translate(lang) {
      const fr = {
        'mfa-password-label': 'Mot de passe du compte', 'mfa-start': 'Configurer Authenticator',
        'mfa-setup-help': 'Scannez ce QR code avec Google Authenticator, ou saisissez la clé manuellement.',
        'mfa-code-label': 'Code à six chiffres', 'mfa-confirm': 'Activer',
        'mfa-recovery-help': 'Enregistrez ces codes dans un endroit sûr. Chaque code ne fonctionne qu’une fois. Ils ne seront plus affichés.',
        'mfa-recovery-done': 'J’ai enregistré mes codes', 'mfa-active-help': 'Protection activée.',
        'mfa-disable-password-label': 'Mot de passe du compte', 'mfa-disable-code-label': 'Code Authenticator ou de récupération',
        'mfa-disable': 'Désactiver la protection', 'mfa-operation-title': 'Confirmer l’opération',
        'mfa-operation-code-label': 'Code Authenticator ou de récupération', 'mfa-operation-submit': 'Confirmer'
      };
      const en = {
        'mfa-password-label': 'Account password', 'mfa-start': 'Set up Authenticator',
        'mfa-setup-help': 'Scan this code with Google Authenticator, or enter the setup key manually.',
        'mfa-code-label': 'Six-digit code', 'mfa-confirm': 'Activate',
        'mfa-recovery-help': 'Save these recovery codes in a safe place. Each code works once. They will not be shown again.',
        'mfa-recovery-done': 'I have saved my codes', 'mfa-active-help': 'Protection is active.',
        'mfa-disable-password-label': 'Account password', 'mfa-disable-code-label': 'Authenticator or recovery code',
        'mfa-disable': 'Disable protection', 'mfa-operation-title': 'Confirm operation',
        'mfa-operation-code-label': 'Authenticator or recovery code', 'mfa-operation-submit': 'Confirm'
      };
      Object.entries(lang === 'fr' ? fr : en).forEach(([id, text]) => { const node = this.el(id); if (node) node.textContent = text; });
    }
    async refresh() {
      this.translate(this.account.app?.currentLang);
      const section = this.el('mfa-settings');
      if (!section) return;
      if (!this.account.isAuthenticated()) { this.close(); section.hidden = true; return; }
      const generation = this.generation;
      try {
        const result = await this.account.request('mfa-status');
        if (generation !== this.generation || !this.account.isAuthenticated()) return;
        if (typeof result.enabled !== 'boolean') throw new Error('Invalid status');
        section.hidden = false;
        this.showStatus(result.enabled);
      } catch (_) {
        // Unavailable or not deployed: never offer a fake activation.
        if (generation === this.generation) { this.close(); section.hidden = true; }
      }
    }
    showStatus(enabled) {
      this.el('mfa-enabled').hidden = !enabled;
      this.el('mfa-disabled').hidden = enabled;
      this.el('mfa-enrollment').hidden = true;
      this.el('mfa-recovery').hidden = true;
      this.el('mfa-message').textContent = '';
    }
    init() {
      const handlers = [
        ['mfa-start', () => this.start()], ['mfa-confirm', () => this.confirm()],
        ['mfa-disable', () => this.disable()], ['mfa-recovery-done', () => this.recoveryDone()]
      ];
      handlers.forEach(([id, fn]) => this.el(id)?.addEventListener('click', () => fn().catch(() => {})));
      this.el('mfa-operation-cancel')?.addEventListener('click', () => this.cancelCode());
      this.el('mfa-operation-submit')?.addEventListener('click', () => this.submitCode().catch(() => {}));
    }
    clearSecrets() {
      ['mfa-password', 'mfa-code', 'mfa-disable-password', 'mfa-disable-code'].forEach((id) => { const node = this.el(id); if (node) node.value = ''; });
      ['mfa-secret', 'mfa-recovery-codes', 'mfa-qr'].forEach((id) => { const node = this.el(id); if (node) node.replaceChildren(); });
    }
    close() {
      this.cancelCode();
      this.generation++;
      this.clearSecrets();
      ['mfa-enrollment', 'mfa-recovery'].forEach((id) => { const node = this.el(id); if (node) node.hidden = true; });
      const message = this.el('mfa-message'); if (message) message.textContent = '';
    }
    async run(operation) {
      if (this.busy) return;
      this.busy = true;
      const generation = this.generation;
      try { await operation(generation); }
      catch (error) { if (generation === this.generation) this.el('mfa-message').textContent = error.message || 'Security service unavailable.'; }
      finally { this.busy = false; }
    }
    async start() {
      return this.run(async (generation) => {
        const input = this.el('mfa-password'); const password = input.value; input.value = '';
        const result = await this.account.request('mfa-begin', { body: { currentPassword: password } });
        if (generation !== this.generation) return;
        if (!/^[A-Z2-7]{16,128}$/.test(result.secret || '') || typeof result.uri !== 'string' || !result.uri.startsWith('otpauth://totp/')) throw new Error('Invalid setup response');
        this.el('mfa-message').textContent = '';
        this.el('mfa-secret').textContent = result.secret;
        const qr = this.el('mfa-qr'); qr.replaceChildren();
        if (this.qr) {
          const maker = this.qr(0, 'M'); maker.addData(result.uri); maker.make();
          const image = this.document.createElement('img'); image.alt = 'Authenticator QR code';
          image.src = maker.createDataURL(4, 4); qr.appendChild(image);
        }
        this.el('mfa-disabled').hidden = true;
        this.el('mfa-enrollment').hidden = false;
      });
    }
    async confirm() {
      return this.run(async (generation) => {
        const input = this.el('mfa-code'); const code = input.value.trim(); input.value = '';
        const result = await this.account.request('mfa-confirm', { body: { code } });
        if (generation !== this.generation) return;
        if (!Array.isArray(result.recoveryCodes) || result.recoveryCodes.length !== 10 || !result.recoveryCodes.every((item) => /^[0-9A-F]{8}(?:-[0-9A-F]{8}){3}$/.test(item))) throw new Error('Invalid recovery codes');
        this.clearSecrets();
        this.el('mfa-message').textContent = '';
        this.el('mfa-enrollment').hidden = true;
        this.el('mfa-recovery-codes').textContent = result.recoveryCodes.join('\n');
        this.el('mfa-recovery').hidden = false;
      });
    }
    // Mode 'farm' returns a code for the signed FARM request; mode 'wallet'
    // consumes it through the account API immediately before local signing.
    async operation(wallet, summary, mode) {
      if (!['farm', 'wallet'].includes(mode) || !this.account.isAuthenticated() || !/^0x[0-9a-f]{40}$/.test(String(wallet || '').toLowerCase())) throw new Error('Account or wallet unavailable');
      const generation = this.generation;
      const session = this.account.sessionGeneration;
      const status = await this.account.request('mfa-status');
      if (generation !== this.generation || session !== this.account.sessionGeneration || !this.account.isAuthenticated()) throw new Error('Account session changed');
      if (typeof status.enabled !== 'boolean') throw new Error('Security status unavailable');
      if (!status.enabled) return { required: false };
      if (String(this.account.user?.walletAddress || '').toLowerCase() !== wallet.toLowerCase() || !this.account.user?.walletVerified) throw new Error('Open the wallet associated with this account.');
      if (this.pendingOperation) throw new Error('A confirmation is already open');
      this.el('mfa-operation-summary').textContent = summary;
      this.el('mfa-operation-error').textContent = '';
      this.el('mfa-operation-code').value = '';
      globalThis.FitiaSecurity?.Native?.setScreenSecure(true);
      this.el('modal-mfa-operation').classList.add('active');
      this.el('mfa-operation-code').focus();
      return new Promise((resolve, reject) => { this.pendingOperation = { resolve, reject, wallet: wallet.toLowerCase(), mode, generation, session, submitting: false }; });
    }
    finishCode(result, error) {
      const pending = this.pendingOperation;
      this.pendingOperation = null;
      const input = this.el('mfa-operation-code'); if (input) input.value = '';
      this.el('modal-mfa-operation')?.classList.remove('active');
      if (pending && this.el('account-access-screen')?.classList.contains('hidden')
        && !this.document.querySelector('#modal-pin-confirm.active, #modal-secret-reveal.active')) {
        globalThis.FitiaSecurity?.Native?.setScreenSecure(false);
      }
      if (pending) { if (error) pending.reject(error); else pending.resolve(result); }
    }
    cancelCode() { this.finishCode(null); }
    async submitCode() {
      const pending = this.pendingOperation;
      if (!pending || pending.submitting) return;
      const input = this.el('mfa-operation-code'); const code = input.value.trim(); input.value = '';
      if (!code) { this.el('mfa-operation-error').textContent = 'Enter a code.'; return; }
      pending.submitting = true;
      try {
        if (pending.mode === 'wallet') await this.account.request('mfa-verify', { body: { wallet: pending.wallet, code }, retry: false });
        if (this.pendingOperation !== pending) return;
        if (pending.generation !== this.generation || pending.session !== this.account.sessionGeneration || !this.account.isAuthenticated()) throw new Error('Account session changed');
        this.finishCode({ required: true, ...(pending.mode === 'farm' ? { code } : {}) });
      } catch (error) {
        if (this.pendingOperation === pending) this.el('mfa-operation-error').textContent = error.message || 'Security service unavailable.';
      } finally { pending.submitting = false; }
    }
    canLeaveSetup() { return !this.busy && (this.el('mfa-recovery')?.hidden !== false); }
    recoveryDone() { this.clearSecrets(); this.showStatus(true); }
    async disable() {
      return this.run(async (generation) => {
        const passwordInput = this.el('mfa-disable-password'); const codeInput = this.el('mfa-disable-code');
        const password = passwordInput.value; const code = codeInput.value.trim(); passwordInput.value = ''; codeInput.value = '';
        await this.account.request('mfa-disable', { body: { currentPassword: password, code } });
        if (generation !== this.generation) return;
        this.clearSecrets(); this.showStatus(false);
      });
    }
  }
  return FitiaMfaClient;
});
