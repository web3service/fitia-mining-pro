// ═══════════════════════════════════════════════════════════════════
//  FITIA — siwe-client (item 7, EIP-4361 Sign-In with Ethereum)
//  Module d'aide pour initier un flux SIWE côté navigateur/WebView :
//    1. FitiaSiwe.requestNonce()          : { nonce, nonceToken }
//    2. FitiaSiwe.buildMessage(...)       : message EIP-4361 à signer
//    3. signer.signMessage(message)       : signature person_sign
//    4. FitiaSiwe.verify({...})           : { address, chainId, ... }
//  La signature elle-même reste entre les mains du Wallet intégré
//  (app.signer), jamais de clés privées brutes ici.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.FitiaSiwe) return;

  var API_ORIGIN = 'https://fitia-mining-pro.vercel.app';
  var NONCE_URL = API_ORIGIN + '/api/siwe/nonce';
  var VERIFY_URL = API_ORIGIN + '/api/siwe/verify';
  var SIWE_VERSION = '1';

  function postJson(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      credentials: 'same-origin'
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) {
          var error = new Error((data && data.error) || ('HTTP ' + response.status));
          error.code = data && data.code;
          error.status = response.status;
          throw error;
        }
        return data;
      });
    });
  }

  function requestNonce() {
    return postJson(NONCE_URL, {});
  }

  function checksumAddress(address) {
    // ethers est déjà chargé pour le wallet ; réutilisé si présent.
    if (window.ethers && typeof window.ethers.getAddress === 'function') {
      return window.ethers.getAddress(address);
    }
    return String(address || '');
  }

  function buildMessage(options) {
    var domain = String(options.domain || window.location.hostname || 'app.fitia.pro');
    var chainId = Number(options.chainId || 137);
    var statement = String(options.statement || 'Sign in with your Ethereum account to FITIA PRO.');
    var issuedAt = options.issuedAt ? new Date(options.issuedAt) : new Date();
    var address = checksumAddress(options.address);
    var uri = options.uri || (window.location.origin + window.location.pathname);
    var lines = [
      domain + ' wants you to sign in with your Ethereum account:',
      address,
      '',
      statement,
      '',
      'URI: ' + uri,
      'Version: ' + SIWE_VERSION,
      'Chain ID: ' + chainId,
      'Nonce: ' + options.nonce,
      'Issued At: ' + issuedAt.toISOString()
    ];
    if (options.expirationTime) {
      lines.push('Expiration Time: ' + new Date(options.expirationTime).toISOString());
    }
    return lines.join('\n');
  }

  function verify(payload) {
    return postJson(VERIFY_URL, {
      message: payload.message,
      signature: payload.signature,
      nonceToken: payload.nonceToken,
      chainId: payload.chainId
    });
  }

  // Flux complet : nonce : signature : vérification.
  // sign(message) doit renvoyer la signature person_sign (ex. app.signer.signMessage).
  async function loginWithWallet(params, sign) {
    var first = await requestNonce();
    var message = buildMessage({
      domain: params.domain,
      address: params.address,
      chainId: params.chainId,
      statement: params.statement,
      nonce: first.nonce,
      issuedAt: new Date()
    });
    var signature = await sign(message);
    return verify({ message: message, signature: signature, nonceToken: first.nonceToken, chainId: params.chainId });
  }

  window.FitiaSiwe = {
    requestNonce: requestNonce,
    buildMessage: buildMessage,
    verify: verify,
    loginWithWallet: loginWithWallet
  };
})();
