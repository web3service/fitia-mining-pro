// ═══════════════════════════════════════════════════════════════════
//  EIP-4361 — Sign-In with Ethereum (SIWE) : build / parse / verify.
//  No new dependency: verification uses the vendored ethers build.
//  The message is the authentication payload; the nonce proves freshness.
// ═══════════════════════════════════════════════════════════════════
'use strict';

const path = require('path');
const ethers = require(path.join(__dirname, 'vendor', 'ethers.umd.min.js'));

const EIP4361_VERSION = '1';
const MAX_MESSAGE_BYTES = 4096;

const NONCE_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

function assertAddress(address) {
  try {
    return ethers.getAddress(String(address || ''));
  } catch (_) {
    const error = new Error('Adresse Ethereum invalide.');
    error.code = 'SIWE_ADDRESS';
    throw error;
  }
}

function buildSiweMessage(options = {}) {
  const domain = String(options.domain || '');
  const statement = options.statement === undefined
    ? 'Sign in with your Ethereum account to FITIA PRO.'
    : String(options.statement);
  if (!DOMAIN_PATTERN.test(domain)) {
    const error = new Error('Domaine de signature invalide.');
    error.code = 'SIWE_DOMAIN';
    throw error;
  }
  if (statement.length > 256 || /[\r\n]/.test(statement)) {
    const error = new Error('Statement invalide.');
    error.code = 'SIWE_STATEMENT';
    throw error;
  }
  const address = assertAddress(options.address);
  const chainId = Number(options.chainId);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    const error = new Error('Chain ID invalide.');
    error.code = 'SIWE_CHAIN';
    throw error;
  }
  const nonce = String(options.nonce || '');
  if (!NONCE_PATTERN.test(nonce)) {
    const error = new Error('Nonce de signature invalide.');
    error.code = 'SIWE_NONCE';
    throw error;
  }
  const uri = String(options.uri || `https://${domain}`);
  if (!/^https:\/\/[^\s]+$/.test(uri)) {
    const error = new Error('URI de signature invalide.');
    error.code = 'SIWE_URI';
    throw error;
  }
  const version = String(options.version || EIP4361_VERSION);
  const issuedAt = options.issuedAt ? new Date(options.issuedAt) : new Date();
  if (Number.isNaN(issuedAt.getTime())) {
    const error = new Error('issuedAt invalide.');
    error.code = 'SIWE_TIME';
    throw error;
  }
  const lines = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    statement,
    '',
    `URI: ${uri}`,
    `Version: ${version}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`
  ];
  if (options.expirationTime) {
    const exp = new Date(options.expirationTime);
    if (Number.isNaN(exp.getTime())) {
      const error = new Error('expirationTime invalide.');
      error.code = 'SIWE_TIME';
      throw error;
    }
    lines.push(`Expiration Time: ${exp.toISOString()}`);
  }
  if (options.notBefore) {
    const nbf = new Date(options.notBefore);
    if (Number.isNaN(nbf.getTime())) {
      const error = new Error('notBefore invalide.');
      error.code = 'SIWE_TIME';
      throw error;
    }
    lines.push(`Not Before: ${nbf.toISOString()}`);
  }
  return lines.join('\n');
}

const MESSAGE_RE = new RegExp(
  '^(?<domain>[^\\n]+) wants you to sign in with your Ethereum account:\\n' +
  '(?<address>0x[0-9a-fA-F]{40})\\n\\n' +
  '(?<statement>[^\\n]*)\\n\\n' +
  'URI: (?<uri>[^\\n]+)\\n' +
  'Version: (?<version>[^\\n]+)\\n' +
  'Chain ID: (?<chainId>[0-9]{1,10})\\n' +
  'Nonce: (?<nonce>[A-Za-z0-9_-]{8,128})\\n' +
  'Issued At: (?<issuedAt>[^\\n]+)' +
  '(?:\\nExpiration Time: (?<expirationTime>[^\\n]+))?' +
  '(?:\\nNot Before: (?<notBefore>[^\\n]+))?$'
);

function parseSiweMessage(message) {
  const text = String(message || '');
  if (Buffer.byteLength(text, 'utf8') > MAX_MESSAGE_BYTES) {
    const error = new Error('Message SIWE trop volumineux.');
    error.code = 'SIWE_SIZE';
    throw error;
  }
  const match = MESSAGE_RE.exec(text);
  if (!match || !match.groups) {
    const error = new Error('Message SIWE invalide.');
    error.code = 'SIWE_PARSE';
    throw error;
  }
  const g = match.groups;
  let address;
  try {
    address = ethers.getAddress(g.address);
  } catch (_) {
    const error = new Error('Adresse du message invalide.');
    error.code = 'SIWE_ADDRESS';
    throw error;
  }
  const chainId = Number(g.chainId);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    const error = new Error('Chain ID du message invalide.');
    error.code = 'SIWE_CHAIN';
    throw error;
  }
  const parsed = {
    domain: g.domain,
    address,
    statement: g.statement || '',
    uri: g.uri,
    version: g.version,
    chainId,
    nonce: g.nonce,
    issuedAt: g.issuedAt
  };
  if (g.expirationTime) parsed.expirationTime = g.expirationTime;
  if (g.notBefore) parsed.notBefore = g.notBefore;
  return parsed;
}

// Vérifie la signature EIP-191 (personal_sign) et les contraintes de temps.
// expected : { domain?, chainId?, allowedDomains?, now? }
function verifySiweMessage(options = {}) {
  const parsed = parseSiweMessage(options.message);
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();

  if (options.domain && parsed.domain !== options.domain) {
    const error = new Error('Domaine de signature inattendu.');
    error.code = 'SIWE_DOMAIN';
    throw error;
  }
  if (Array.isArray(options.allowedDomains) && options.allowedDomains.length > 0
      && !options.allowedDomains.includes(parsed.domain)) {
    const error = new Error('Domaine de signature non autorisé.');
    error.code = 'SIWE_DOMAIN';
    throw error;
  }
  if (options.chainId && parsed.chainId !== Number(options.chainId)) {
    const error = new Error('Chain ID de signature inattendu.');
    error.code = 'SIWE_CHAIN';
    throw error;
  }
  const issuedAtMs = Date.parse(parsed.issuedAt);
  if (Number.isNaN(issuedAtMs)) {
    const error = new Error('issuedAt du message invalide.');
    error.code = 'SIWE_TIME';
    throw error;
  }
  // Fenêtre de tolérance : un message daté de plus de 10 min dans le futur
  // ou émis il y a plus de 30 minutes est rejeté.
  if (issuedAtMs - now > 10 * 60 * 1000 || now - issuedAtMs > 30 * 60 * 1000) {
    const error = new Error('Message SIWE hors fenêtre de validité.');
    error.code = 'SIWE_TIME';
    throw error;
  }
  if (parsed.expirationTime) {
    const expMs = Date.parse(parsed.expirationTime);
    if (Number.isNaN(expMs) || expMs <= now) {
      const error = new Error('Message SIWE expiré.');
      error.code = 'SIWE_TIME';
      throw error;
    }
  }
  if (parsed.notBefore) {
    const nbfMs = Date.parse(parsed.notBefore);
    if (Number.isNaN(nbfMs) || nbfMs > now) {
      const error = new Error('Message SIWE pas encore valide.');
      error.code = 'SIWE_TIME';
      throw error;
    }
  }

  let recovered;
  try {
    recovered = ethers.verifyMessage(String(options.message), String(options.signature || ''));
  } catch (_) {
    const error = new Error('Signature SIWE invalide.');
    error.code = 'SIWE_SIGNATURE';
    throw error;
  }
  if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
    const error = new Error('La signature ne correspond pas à l’adresse.');
    error.code = 'SIWE_SIGNATURE';
    throw error;
  }
  return {
    address: parsed.address,
    chainId: parsed.chainId,
    domain: parsed.domain,
    nonce: parsed.nonce,
    statement: parsed.statement,
    uri: parsed.uri,
    expirationTime: parsed.expirationTime || null
  };
}

function generateNonce(bytes = 24) {
  return require('crypto').randomBytes(bytes).toString('base64url').replace(/=+$/, '');
}

module.exports = {
  EIP4361_VERSION,
  buildSiweMessage,
  parseSiweMessage,
  verifySiweMessage,
  generateNonce
};
