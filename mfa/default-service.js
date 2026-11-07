'use strict';
const { MfaService } = require('./service');
const { SupabaseMfaRepository } = require('./supabase-repository');
const { MfaAccountController } = require('./account-controller');
const { getDefaultAccountService } = require('../account-service');

let instance;
function enabled() { return process.env.FITIA_MFA_ENABLED === 'true'; }
function getDefaultMfa() {
  if (instance) return instance;
  const encoded = String(process.env.FITIA_MFA_ENCRYPTION_KEY || '');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error('MFA encryption key not configured');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) throw new Error('MFA encryption key invalid');
  const repository = new SupabaseMfaRepository({ url: process.env.FITIA_SUPABASE_URL, serviceRoleKey: process.env.FITIA_SUPABASE_SERVICE_ROLE_KEY });
  const service = new MfaService({ repository, key });
  const controller = new MfaAccountController({ accountService: getDefaultAccountService(), mfaService: service });
  instance = { repository, service, controller };
  return instance;
}
module.exports = { enabled, getDefaultMfa };
