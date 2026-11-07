'use strict';

// Not exposed as an HTTP endpoint yet. It must not be enabled before all
// transaction paths enforce MFA, including old FARM clients.
const { AccountError } = require('../account-service');
const { MfaError } = require('./service');

const errors = {
  MFA_ALREADY_ENABLED: [409, 'La protection est déjà activée.'],
  MFA_NOT_ENABLED: [409, 'La protection n’est pas activée.'],
  MFA_ENROLLMENT_EXPIRED: [410, 'La configuration a expiré. Recommencez.'],
  MFA_INVALID: [403, 'Code incorrect ou déjà utilisé.'],
  MFA_LOCKED: [429, 'Trop de tentatives. Réessayez plus tard.']
};
class MfaAccountController {
  constructor({ accountService, mfaService }) {
    if (!accountService || !mfaService) throw new Error('Account and MFA services required');
    this.account = accountService;
    this.mfa = mfaService;
  }
  async user(token) {
    const user = await this.account.auth.getUser(token);
    const profile = await this.account.ensureProfile(user);
    if (!profile || !profile.userId) throw new AccountError(401, 'Session invalide.', 'ACCOUNT_AUTH');
    return profile;
  }
  async wrap(fn) {
    try { return await fn(); }
    catch (error) {
      const mapped = error instanceof MfaError && errors[error.code];
      if (mapped) throw new AccountError(mapped[0], mapped[1], error.code);
      throw error;
    }
  }
  async status(token) {
    const user = await this.user(token);
    return this.wrap(() => this.mfa.status(user.userId));
  }
  async begin(token, password) {
    const user = await this.user(token);
    if (!user.walletAddress || !user.walletVerified) throw new AccountError(409, 'Associez d’abord votre wallet au compte.', 'MFA_WALLET_REQUIRED');
    await this.account.reauthenticate(user, password);
    return this.wrap(async () => {
      const { secret } = await this.mfa.beginEnrollment(user.userId);
      // Do not include an email address or other PII in the otpauth label.
      const label = encodeURIComponent(`FITIA PRO:${user.userId}`);
      const uri = `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=FITIA%20PRO&algorithm=SHA1&digits=6&period=30`;
      return { secret, uri };
    });
  }
  async confirm(token, code) {
    const user = await this.user(token);
    if (!user.walletAddress || !user.walletVerified) throw new AccountError(409, 'Associez d’abord votre wallet au compte.', 'MFA_WALLET_REQUIRED');
    return this.wrap(() => this.mfa.confirmEnrollment(user.userId, code));
  }
  async verifyOperation(token, wallet, code) {
    const user = await this.user(token);
    if (!user.walletVerified || typeof wallet !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(wallet)
      || user.walletAddress !== wallet.toLowerCase()) throw new AccountError(403, 'Ce wallet n’est pas associé à ce compte.', 'MFA_WALLET_MISMATCH');
    return this.wrap(async () => { await this.mfa.consumeCode(user.userId, code); return { verified: true }; });
  }
  async disable(token, password, code) {
    const user = await this.user(token);
    await this.account.reauthenticate(user, password);
    return this.wrap(async () => { await this.mfa.disable(user.userId, code); return { enabled: false }; });
  }
}
module.exports = { MfaAccountController };
