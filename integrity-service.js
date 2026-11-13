// ═══════════════════════════════════════════════════════════════════
//  Play Integrity (item 4) — vérification serveur des jetons d'intégrité.
//  Contexte : l'APK FITIA est distribué hors Play Store ; le verdict
//  appRecognitionVerdict y vaudra UNRECOGNIZED_VERSION en fonctionnement
//  normal. La politique par défaut exige donc uniquement un appareil
//  reconnu sain (MEETS_DEVICE_INTEGRITY ou MEETS_STRONG_INTEGRITY).
//  Refuser optionnellement sur appRecognitionVerdict (INTEGRITY_REQUIRE_PLAY_RECOGNIZED=1).
// ═══════════════════════════════════════════════════════════════════
'use strict';

const crypto = require('crypto');
const GoogleOAuth = require('./lib/google-oauth');
const HmacTokens = require('./lib/hmac-tokens');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PLAY_SCOPE = 'https://www.googleapis.com/auth/playintegrity';
const DEFAULT_MIN_VERDICTS = ['MEETS_DEVICE_INTEGRITY', 'MEETS_STRONG_INTEGRITY'];
const MAX_TOKEN_BYTES = 16 * 1024;

function fromEnv(env = process.env, overrides = {}) {
  const credentials = GoogleOAuth.parseServiceAccount(env.INTEGRITY_SERVICE_ACCOUNT_JSON);
  const packageName = String(env.INTEGRITY_PACKAGE_NAME || 'com.fitia.miningpro');
  const minDeviceVerdicts = String(env.INTEGRITY_MIN_DEVICE_VERDICTS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const secrets = HmacTokens.parseSecrets(env.FITIA_SESSION_SECRETS);
  return {
    credentials,
    packageName,
    minDeviceVerdicts: minDeviceVerdicts.length ? minDeviceVerdicts : DEFAULT_MIN_VERDICTS,
    requirePlayRecognized: env.INTEGRITY_REQUIRE_PLAY_RECOGNIZED === '1',
    expectedCertSha256: env.INTEGRITY_APP_CERT_SHA256 ? String(env.INTEGRITY_APP_CERT_SHA256).replace(/[^A-Za-z0-9+/=]/g, '') : null,
    secrets,
    fetchImpl: overrides.fetchImpl,
    now: overrides.now
  };
}

class IntegrityService {
  constructor(options = {}) {
    this.credentials = options.credentials || null;
    this.packageName = String(options.packageName || 'com.fitia.miningpro');
    this.minDeviceVerdicts = Array.isArray(options.minDeviceVerdicts) && options.minDeviceVerdicts.length
      ? options.minDeviceVerdicts
      : DEFAULT_MIN_VERDICTS;
    this.requirePlayRecognized = options.requirePlayRecognized === true;
    this.expectedCertSha256 = options.expectedCertSha256 || null;
    this.secrets = Array.isArray(options.secrets) ? options.secrets : [];
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.nowFn = typeof options.nowFn === 'function' ? options.nowFn : () => Date.now();
  }

  isConfigured() {
    return Boolean(this.credentials) && this.secrets.length > 0;
  }

  challenge() {
    if (this.secrets.length === 0) {
      const error = new Error('FITIA_SESSION_SECRETS non configuré.');
      error.code = 'INTEGRITY_NOT_CONFIGURED';
      throw error;
    }
    const now = this.nowFn();
    const nonce = crypto.randomBytes(24).toString('base64url');
    const challengeToken = HmacTokens.sign({ typ: 'integrity-challenge', nonce }, this.secrets, { ttlMs: CHALLENGE_TTL_MS, now });
    return { nonce, challengeToken, expiresIn: Math.floor(CHALLENGE_TTL_MS / 1000) };
  }

  // Décode un jeton d'intégrité Play via l'API Google (decodeIntegrityToken).
  async verify({ integrityToken, challengeToken } = {}) {
    const now = this.nowFn();
    if (!this.isConfigured()) {
      const error = new Error('Play Integrity non configuré (INTEGRITY_SERVICE_ACCOUNT_JSON / FITIA_SESSION_SECRETS).');
      error.code = 'INTEGRITY_NOT_CONFIGURED';
      throw error;
    }
    if (typeof integrityToken !== 'string' || integrityToken.length < 32 || integrityToken.length > MAX_TOKEN_BYTES) {
      const error = new Error('Jeton d’intégrité invalide.');
      error.code = 'INTEGRITY_TOKEN';
      throw error;
    }
    let challenge;
    try {
      challenge = HmacTokens.verify(challengeToken, this.secrets, { now });
    } catch (error) {
      error.code = error.code || 'INTEGRITY_CHALLENGE';
      throw error;
    }
    if (challenge.typ !== 'integrity-challenge' || typeof challenge.nonce !== 'string') {
      const error = new Error('Challenge d’intégrité invalide.');
      error.code = 'INTEGRITY_CHALLENGE';
      throw error;
    }

    const accessToken = await GoogleOAuth.getAccessToken({
      credentials: this.credentials,
      scope: PLAY_SCOPE,
      fetchImpl: this.fetchImpl,
      now
    });

    const decodeUrl = `https://playintegrity.googleapis.com/v1/${encodeURIComponent(this.packageName)}:decodeIntegrityToken`;
    const response = await this.fetchImpl(decodeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ integrity_token: integrityToken })
    });
    const text = await response.text();
    let decoded;
    try {
      decoded = JSON.parse(text);
    } catch (_) {
      decoded = null;
    }
    if (!response.ok || !decoded || !decoded.tokenPayloadExternal) {
      const error = new Error(`Vérification Play Integrity échouée (${response.status}).`);
      error.code = 'INTEGRITY_DECODE_FAILED';
      error.status = response.status;
      throw error;
    }
    const payload = decoded.tokenPayloadExternal;

    // 1) Nonce : la réponse Google embarque le nonce demandé (base64url/hex).
    const rawNonce = payload.requestDetails && payload.requestDetails.nonce;
    const nonceMatch = typeof rawNonce === 'string'
      && (rawNonce === challenge.nonce
        || rawNonce === Buffer.from(challenge.nonce, 'utf8').toString('base64')
        || rawNonce === Buffer.from(challenge.nonce, 'utf8').toString('base64url'));
    if (!nonceMatch) {
      const error = new Error('Le nonce du jeton ne correspond pas.');
      error.code = 'INTEGRITY_NONCE_MISMATCH';
      throw error;
    }
    // Si Google renvoie le packageName, il doit correspondre.
    if (payload.requestDetails && payload.requestDetails.packageName
        && payload.requestDetails.packageName !== this.packageName) {
      const error = new Error('Package de l’application inattendu.');
      error.code = 'INTEGRITY_PACKAGE';
      throw error;
    }

    // 2) Appareil : exigence minimale configurée.
    const deviceVerdict = payload.deviceIntegrity && payload.deviceIntegrity.deviceRecognitionVerdict
      ? String(payload.deviceIntegrity.deviceRecognitionVerdict)
      : '';
    if (!this.minDeviceVerdicts.includes(deviceVerdict)) {
      const error = new Error('Appareil non reconnu comme sain.');
      error.code = 'INTEGRITY_DEVICE';
      error.deviceVerdict = deviceVerdict || 'NONE';
      throw error;
    }

    // 3) Reconnaissance d'application : optionnelle (APK sideload hors Play).
    const appVerdict = payload.appIntegrity && payload.appIntegrity.appRecognitionVerdict
      ? String(payload.appIntegrity.appRecognitionVerdict)
      : 'UNKNOWN';
    if (this.requirePlayRecognized && appVerdict !== 'PLAY_RECOGNIZED') {
      const error = new Error('Version de l’application non reconnue par Google Play.');
      error.code = 'INTEGRITY_APP_RECOGNITION';
      error.appVerdict = appVerdict;
      throw error;
    }

    // 4) Certificat de l'APK : optionnel (INTEGRITY_APP_CERT_SHA256, base64).
    if (this.expectedCertSha256) {
      const cert = payload.appIntegrity && payload.appIntegrity.certificateSha256;
      const certMatch = typeof cert === 'string' && cert.replace(/[^A-Za-z0-9+/=]/g, '') === this.expectedCertSha256;
      if (!certMatch) {
        const error = new Error('Certificat de l’APK inattendu.');
        error.code = 'INTEGRITY_CERTIFICATE';
        throw error;
      }
    }

    return {
      ok: true,
      deviceVerdict,
      appVerdict,
      licensingVerdict: payload.accountDetails && payload.accountDetails.appLicensingVerdict
        ? String(payload.accountDetails.appLicensingVerdict)
        : 'UNKNOWN'
    };
  }
}

module.exports = {
  IntegrityService,
  fromEnv,
  DEFAULT_MIN_VERDICTS,
  CHALLENGE_TTL_MS
};
