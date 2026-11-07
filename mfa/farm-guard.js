'use strict';

const { FarmError } = require('../farm-service');
const { MfaError } = require('./service');

// The DB trigger remains the final authority: this creates a short-lived
// approval bound to exactly one signed FARM withdrawal, not a bearer token.
function createFarmMfaGuard({ repository, mfaService }) {
  if (!repository || typeof repository.findUserByWallet !== 'function' || !mfaService) throw new Error('MFA guard not configured');
  return async ({ wallet, actionId, coins, code }) => {
    try {
      const userId = await repository.findUserByWallet(wallet);
      if (!userId) return;
      const status = await mfaService.status(userId);
      if (!status.enabled) return;
      if (typeof code !== 'string' || !code.trim()) throw new FarmError(403, 'Code Authenticator ou code de récupération requis.', 'FARM_MFA_REQUIRED');
      await mfaService.authorizeWithdrawal(userId, code, { wallet, actionId, coins });
    } catch (error) {
      if (error instanceof FarmError) throw error;
      if (error instanceof MfaError && error.code === 'MFA_INVALID') throw new FarmError(403, 'Code incorrect ou déjà utilisé.', 'FARM_MFA_INVALID');
      if (error instanceof MfaError && error.code === 'MFA_LOCKED') throw new FarmError(429, 'Trop de tentatives. Réessayez plus tard.', 'FARM_MFA_LOCKED');
      // An enabled factor can be disabled during the request; fail closed and
      // allow the caller to retry instead of granting based on stale state.
      throw new FarmError(503, 'Vérification de sécurité indisponible.', 'FARM_MFA_UNAVAILABLE');
    }
  };
}
module.exports = { createFarmMfaGuard };
