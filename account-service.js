'use strict';

const crypto = require('crypto');
const { ethers } = require('./vendor/ethers.umd.min.js');

const PROFILE_SELECT = 'user_id,username,email,email_verified_at,wallet_address,wallet_verified_at,certified,certified_at,created_at,updated_at';
const DEFAULT_POLYGON_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://polygon.drpc.org',
  'https://1rpc.io/matic',
  'https://polygon-rpc.com'
];
const MINE_ADDRESS = '0xBd9FA9801eDA247b28B3BB9dDBf1CF52cA563Bc6';
const MINE_ABI = [
  'function myMachines(address u) view returns (tuple(uint256 tid, uint256 exp)[])',
  'function myBattery(address u, uint256 t) view returns (uint256)',
  'function bCount() view returns (uint256)',
  'function myInfo(address u) view returns (uint256 mc, uint256 ap, uint256 lc)'
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class AccountError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeUuid(value, field = 'identifiant') {
  const id = String(value || '').toLowerCase();
  if (!UUID_PATTERN.test(id)) throw new AccountError(400, `Le ${field} est invalide.`, 'ACCOUNT_VALIDATION');
  return id;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || /[\u0000-\u001f\u007f]/.test(email)) {
    throw new AccountError(400, 'Saisissez une adresse email valide.', 'ACCOUNT_EMAIL');
  }
  return email;
}

function normalizePassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new AccountError(400, 'Le mot de passe doit contenir entre 12 et 128 caractères, sans caractères de contrôle.', 'ACCOUNT_PASSWORD');
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value) || /^(password|motdepasse|qwerty|letmein)/i.test(value)) {
    throw new AccountError(400, 'Choisissez un mot de passe unique avec des lettres et des chiffres.', 'ACCOUNT_PASSWORD');
  }
  return value;
}

function normalizeCurrentPassword(value) {
  if (typeof value !== 'string' || !value.length || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new AccountError(400, 'Saisissez votre mot de passe actuel.', 'ACCOUNT_REAUTH');
  }
  return value;
}

function normalizeUsername(value) {
  const username = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_]{2,23}$/.test(username)) {
    throw new AccountError(400, 'Le nom d’utilisateur doit contenir 3 à 24 lettres, chiffres ou tirets bas.', 'ACCOUNT_USERNAME');
  }
  return username;
}

function normalizeWallet(value) {
  try { return ethers.getAddress(String(value || '')).toLowerCase(); }
  catch (_) { throw new AccountError(400, 'Adresse Polygon invalide.', 'ACCOUNT_WALLET'); }
}

function normalizeSignature(value) {
  const signature = String(value || '');
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new AccountError(400, 'Signature du wallet invalide.', 'ACCOUNT_SIGNATURE');
  return signature;
}

function emailVerifiedAt(authUser) {
  const value = authUser?.email_confirmed_at || authUser?.confirmed_at || null;
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function authUserId(authUser) {
  try { return normalizeUuid(authUser?.id, 'compte'); }
  catch (_) { throw new AccountError(401, 'Session de compte invalide.', 'ACCOUNT_AUTH'); }
}

function profileFromRow(row) {
  if (!row) return null;
  return {
    userId: String(row.user_id).toLowerCase(),
    username: String(row.username),
    email: String(row.email),
    emailVerified: Boolean(row.email_verified_at),
    emailVerifiedAt: row.email_verified_at || null,
    walletAddress: row.wallet_address || null,
    walletVerified: Boolean(row.wallet_address && row.wallet_verified_at),
    certified: row.certified === true,
    certifiedAt: row.certified_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null
  };
}

function buildLinkMessage({ id, userId, walletAddress, expiresAt }) {
  const checksum = ethers.getAddress(walletAddress);
  return [
    'FITIA PRO — Wallet ownership verification',
    '',
    `Account: ${String(userId).toLowerCase()}`,
    `Wallet: ${checksum}`,
    `Challenge: ${String(id).toLowerCase()}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    'Network: Polygon (137)',
    '',
    'Signing proves control of this public wallet address only.',
    'It does not authorize a transaction, a payment or access to wallet keys.'
  ].join('\n');
}

function generatedUsername(authUser) {
  const metadataName = authUser?.user_metadata?.username;
  const source = String(metadataName || String(authUser?.email || 'miner').split('@')[0]);
  const cleaned = source.replace(/[^A-Za-z0-9_]/g, '').replace(/^[^A-Za-z0-9]+/, '').slice(0, 17);
  const base = cleaned.length >= 3 ? cleaned : `miner${cleaned}`.slice(0, 17);
  return `${base}_${authUserId(authUser).replace(/-/g, '').slice(0, 6)}`.slice(0, 24);
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (_) {
    throw new AccountError(503, 'Le service de compte est temporairement indisponible.', 'ACCOUNT_UNAVAILABLE');
  } finally {
    clearTimeout(timer);
  }
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch (_) { return {}; }
}

class SupabaseAuthClient {
  constructor(options = {}) {
    this.url = String(options.url || '').replace(/\/+$/, '');
    this.serviceRoleKey = String(options.serviceRoleKey || '');
    this.fetch = options.fetch || global.fetch;
    if (!/^https:\/\//i.test(this.url) || !this.serviceRoleKey || typeof this.fetch !== 'function') {
      throw new AccountError(503, 'Le service de compte n’est pas configuré.', 'ACCOUNT_CONFIG');
    }
  }

  async request(path, options = {}) {
    const headers = {
      Accept: 'application/json',
      apikey: this.serviceRoleKey,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
    };
    const response = await fetchWithTimeout(this.fetch, `${this.url}/auth/v1/${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store'
    });
    const data = await parseResponse(response);
    if (!response.ok) {
      const error = new AccountError(response.status, 'Supabase Auth a refusé la requête.', 'SUPABASE_AUTH');
      error.supabaseStatus = response.status;
      throw error;
    }
    return data;
  }

  async signUp(email, password, username) {
    try {
      return await this.request('signup', { method: 'POST', body: { email, password, data: { username } } });
    } catch (error) {
      if (error.code === 'ACCOUNT_UNAVAILABLE') throw error;
      if (error.supabaseStatus === 429) throw new AccountError(429, 'Trop de tentatives. Réessayez plus tard.', 'ACCOUNT_RATE_LIMIT');
      if (error.supabaseStatus >= 500) throw new AccountError(503, 'Inscription temporairement indisponible.', 'ACCOUNT_UNAVAILABLE');
      throw new AccountError(400, 'Impossible de créer ce compte. Vérifiez les informations ou connectez-vous.', 'ACCOUNT_SIGNUP');
    }
  }

  async signIn(email, password) {
    try {
      return await this.request('token?grant_type=password', { method: 'POST', body: { email, password } });
    } catch (error) {
      if (error.code === 'ACCOUNT_UNAVAILABLE') throw error;
      if (error.supabaseStatus === 429) throw new AccountError(429, 'Trop de tentatives. Réessayez plus tard.', 'ACCOUNT_RATE_LIMIT');
      if (error.supabaseStatus >= 500) throw new AccountError(503, 'Connexion temporairement indisponible.', 'ACCOUNT_UNAVAILABLE');
      throw new AccountError(401, 'Email ou mot de passe incorrect.', 'ACCOUNT_LOGIN');
    }
  }

  async updateEmail(userId, email) {
    try {
      // La mise à jour administrateur confirme le nouvel email sans déclencher
      // le parcours de confirmation par courrier.
      return await this.request(`admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT', accessToken: this.serviceRoleKey, body: { email, email_confirm: true }
      });
    } catch (error) {
      if (error.code === 'ACCOUNT_UNAVAILABLE') throw error;
      if (error.supabaseStatus === 429) throw new AccountError(429, 'Trop de tentatives. Réessayez plus tard.', 'ACCOUNT_RATE_LIMIT');
      if (error.supabaseStatus >= 500) throw new AccountError(503, 'Modification email temporairement indisponible.', 'ACCOUNT_UNAVAILABLE');
      throw new AccountError(400, 'Impossible de modifier cet email. Vérifiez la nouvelle adresse.', 'ACCOUNT_EMAIL_UPDATE');
    }
  }

  async updatePassword(userId, password) {
    try {
      return await this.request(`admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT', accessToken: this.serviceRoleKey, body: { password }
      });
    } catch (error) {
      if (error.code === 'ACCOUNT_UNAVAILABLE') throw error;
      if (error.supabaseStatus === 429) throw new AccountError(429, 'Trop de tentatives. Réessayez plus tard.', 'ACCOUNT_RATE_LIMIT');
      if (error.supabaseStatus >= 500) throw new AccountError(503, 'Modification du mot de passe temporairement indisponible.', 'ACCOUNT_UNAVAILABLE');
      throw new AccountError(400, 'Impossible de modifier le mot de passe avec ces informations.', 'ACCOUNT_PASSWORD_UPDATE');
    }
  }

  async refresh(refreshToken) {
    try {
      return await this.request('token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } });
    } catch (error) {
      if (error.code === 'ACCOUNT_UNAVAILABLE') throw error;
      if (error.supabaseStatus >= 500) throw new AccountError(503, 'Renouvellement de session temporairement indisponible.', 'ACCOUNT_UNAVAILABLE');
      throw new AccountError(401, 'La session a expiré. Connectez-vous à nouveau.', 'ACCOUNT_SESSION_EXPIRED');
    }
  }

  async getUser(accessToken) {
    try {
      return await this.request('user', { accessToken });
    } catch (error) {
      if (error.code === 'ACCOUNT_UNAVAILABLE') throw error;
      if (error.supabaseStatus >= 500) throw new AccountError(503, 'Vérification de session temporairement indisponible.', 'ACCOUNT_UNAVAILABLE');
      throw new AccountError(401, 'La session est invalide ou a expiré.', 'ACCOUNT_AUTH');
    }
  }

  async logout(accessToken) {
    try { await this.request('logout', { method: 'POST', accessToken, body: {} }); }
    catch (error) {
      if (error.code === 'ACCOUNT_UNAVAILABLE') throw error;
      if (error.supabaseStatus >= 500) throw new AccountError(503, 'Déconnexion temporairement indisponible.', 'ACCOUNT_UNAVAILABLE');
    }
  }
}

class SupabaseAccountRepository {
  constructor(options = {}) {
    this.url = String(options.url || '').replace(/\/+$/, '');
    this.serviceRoleKey = String(options.serviceRoleKey || '');
    this.fetch = options.fetch || global.fetch;
    if (!/^https:\/\//i.test(this.url) || !this.serviceRoleKey || typeof this.fetch !== 'function') {
      throw new AccountError(503, 'Le stockage des comptes n’est pas configuré.', 'ACCOUNT_CONFIG');
    }
  }

  async request(path, options = {}) {
    const response = await fetchWithTimeout(this.fetch, `${this.url}/rest/v1/${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.prefer ? { Prefer: options.prefer } : {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store'
    });
    const data = await parseResponse(response);
    if (!response.ok) {
      const error = new AccountError(response.status, 'Le stockage des comptes a refusé la requête.', 'SUPABASE_REST');
      error.supabaseStatus = response.status;
      error.supabaseMessage = String(data?.message || data?.hint || data?.details || '').slice(0, 160);
      throw error;
    }
    return data;
  }

  async findProfile(userId) {
    const rows = await this.request(`app_user_profiles?select=${PROFILE_SELECT}&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  async createProfile(profile) {
    try {
      const rows = await this.request('app_user_profiles', {
        method: 'POST', body: profile, prefer: 'return=representation'
      });
      return Array.isArray(rows) ? rows[0] : rows;
    } catch (error) {
      if (error.supabaseStatus === 409) throw new AccountError(409, 'Ce nom d’utilisateur ou ce wallet est déjà utilisé.', 'ACCOUNT_CONFLICT');
      throw error;
    }
  }

  async updateAuthProfile(userId, email, verifiedAt) {
    await this.request(`app_user_profiles?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH', body: { email, email_verified_at: verifiedAt, updated_at: new Date().toISOString() }, prefer: 'return=minimal'
    });
  }

  async updateUsername(userId, username) {
    try {
      const rows = await this.request(`app_user_profiles?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH', body: { username, updated_at: new Date().toISOString() }, prefer: 'return=representation'
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new AccountError(404, 'Compte introuvable.', 'ACCOUNT_NOT_FOUND');
      return row;
    } catch (error) {
      if (error.supabaseStatus === 409) throw new AccountError(409, 'Ce nom d’utilisateur est déjà utilisé.', 'ACCOUNT_CONFLICT');
      throw error;
    }
  }

  async createChallenge(challenge) {
    const rows = await this.request('app_wallet_link_challenges', {
      method: 'POST', body: challenge, prefer: 'return=representation'
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async getChallenge(id, userId, walletAddress) {
    const rows = await this.request(`app_wallet_link_challenges?select=*&id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&wallet_address=eq.${encodeURIComponent(walletAddress)}&limit=1`);
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  async linkWallet(id, userId, walletAddress) {
    try {
      const result = await this.request('rpc/app_user_link_wallet', {
        method: 'POST', body: { p_challenge_id: id, p_user_id: userId, p_wallet_address: walletAddress }
      });
      return Array.isArray(result) ? result[0] : result;
    } catch (error) {
      const reason = error.supabaseMessage || '';
      if (reason.includes('WALLET_ALREADY_LINKED') || error.supabaseStatus === 409) {
        throw new AccountError(409, 'Ce wallet est déjà lié à un compte.', 'ACCOUNT_WALLET_LINKED');
      }
      if (reason.includes('CHALLENGE_UNAVAILABLE')) throw new AccountError(410, 'Le défi a expiré ou a déjà été utilisé.', 'ACCOUNT_CHALLENGE_USED');
      if (reason.includes('PROFILE_NOT_FOUND')) throw new AccountError(404, 'Compte introuvable.', 'ACCOUNT_NOT_FOUND');
      throw error;
    }
  }

  async listProfiles(search = '') {
    let path = `app_user_profiles?select=${PROFILE_SELECT}&order=created_at.desc&limit=100`;
    if (search) {
      const pattern = search.replace(/[^A-Za-z0-9_@.-]/g, '').slice(0, 64);
      if (pattern) {
        const filter = `(username.ilike.*${pattern}*,email.ilike.*${pattern}*,wallet_address.ilike.*${pattern}*)`;
        path += `&or=${encodeURIComponent(filter)}`;
      }
    }
    const rows = await this.request(path);
    return Array.isArray(rows) ? rows : [];
  }

  async setCertified(userId, certified, actor) {
    try {
      const result = await this.request('rpc/app_user_set_certified', {
        method: 'POST', body: { p_user_id: userId, p_certified: certified, p_actor: actor }
      });
      return Array.isArray(result) ? result[0] : result;
    } catch (error) {
      if (String(error.supabaseMessage || '').includes('PROFILE_NOT_FOUND')) throw new AccountError(404, 'Compte introuvable.', 'ACCOUNT_NOT_FOUND');
      throw error;
    }
  }

  async listCertificationEvents(userId) {
    const rows = await this.request(`app_user_certification_events?select=id,user_id,certified,actor,created_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=20`);
    return Array.isArray(rows) ? rows : [];
  }
}

class MemoryAccountRepository {
  constructor() {
    this.profiles = new Map();
    this.challenges = new Map();
    this.certificationEvents = [];
  }

  async findProfile(userId) { return clone(this.profiles.get(userId) || null); }

  async createProfile(profile) {
    const username = profile.username.toLowerCase();
    if ([...this.profiles.values()].some((row) => row.username.toLowerCase() === username)) {
      throw new AccountError(409, 'Ce nom d’utilisateur est déjà utilisé.', 'ACCOUNT_CONFLICT');
    }
    const row = clone(profile);
    this.profiles.set(row.user_id, row);
    return clone(row);
  }

  async updateAuthProfile(userId, email, verifiedAt) {
    const row = this.profiles.get(userId);
    if (row) Object.assign(row, { email, email_verified_at: verifiedAt, updated_at: new Date().toISOString() });
  }

  async updateUsername(userId, username) {
    const row = this.profiles.get(userId);
    if (!row) throw new AccountError(404, 'Compte introuvable.', 'ACCOUNT_NOT_FOUND');
    if ([...this.profiles.values()].some((profile) => profile.user_id !== userId && profile.username.toLowerCase() === username.toLowerCase())) {
      throw new AccountError(409, 'Ce nom d’utilisateur est déjà utilisé.', 'ACCOUNT_CONFLICT');
    }
    Object.assign(row, { username, updated_at: new Date().toISOString() });
    return clone(row);
  }

  async createChallenge(challenge) {
    const row = clone(challenge); this.challenges.set(row.id, row); return clone(row);
  }

  async getChallenge(id, userId, walletAddress) {
    const row = this.challenges.get(id);
    return row && row.user_id === userId && row.wallet_address === walletAddress ? clone(row) : null;
  }

  async linkWallet(id, userId, walletAddress) {
    const challenge = this.challenges.get(id);
    if (!challenge || challenge.user_id !== userId || challenge.wallet_address !== walletAddress || challenge.used_at || Date.parse(challenge.expires_at) <= Date.now()) {
      throw new AccountError(410, 'Le défi a expiré ou a déjà été utilisé.', 'ACCOUNT_CHALLENGE_USED');
    }
    const profile = this.profiles.get(userId);
    if (!profile) throw new AccountError(404, 'Compte introuvable.', 'ACCOUNT_NOT_FOUND');
    if ((profile.wallet_address && profile.wallet_address !== walletAddress)
      || [...this.profiles.values()].some((row) => row.user_id !== userId && row.wallet_address === walletAddress)) {
      throw new AccountError(409, 'Ce wallet est déjà lié à un compte.', 'ACCOUNT_WALLET_LINKED');
    }
    challenge.used_at = new Date().toISOString();
    profile.wallet_address = walletAddress;
    profile.wallet_verified_at = profile.wallet_verified_at || challenge.used_at;
    profile.updated_at = challenge.used_at;
    return clone(profile);
  }

  async listProfiles(search = '') {
    const needle = search.toLowerCase();
    return clone([...this.profiles.values()].filter((row) => !needle || [row.username, row.email, row.wallet_address || ''].some((value) => value.toLowerCase().includes(needle))).slice(0, 100));
  }

  async setCertified(userId, certified, actor) {
    const row = this.profiles.get(userId);
    if (!row) throw new AccountError(404, 'Compte introuvable.', 'ACCOUNT_NOT_FOUND');
    row.certified = certified;
    row.certified_at = certified ? new Date().toISOString() : null;
    row.updated_at = new Date().toISOString();
    this.certificationEvents.push({ id: crypto.randomUUID(), user_id: userId, certified, actor, created_at: row.updated_at });
    return clone(row);
  }

  async listCertificationEvents(userId) {
    return clone(this.certificationEvents.filter((row) => row.user_id === userId).reverse().slice(0, 20));
  }
}

class PolygonAccountReader {
  constructor(options = {}) {
    this.mineAddress = options.mineAddress || MINE_ADDRESS;
    this.rpcUrls = Array.isArray(options.rpcUrls) && options.rpcUrls.length ? options.rpcUrls : DEFAULT_POLYGON_RPCS;
    this.providerFactory = options.providerFactory || ((url) => {
      const network = ethers.Network.from({ name: 'matic', chainId: 137 });
      return new ethers.JsonRpcProvider(url, network, { staticNetwork: network, batchMaxCount: 1 });
    });
    this.contract = options.contract || null;
    this.now = options.now || (() => Date.now());
  }

  async readWithContract(contract, address) {
    const [machineRows, batteryTypeCountRaw, info] = await Promise.all([
      contract.myMachines(address), contract.bCount(), contract.myInfo(address)
    ]);
    const batteryTypeCount = Number(batteryTypeCountRaw);
    if (!Number.isSafeInteger(batteryTypeCount) || batteryTypeCount < 0 || batteryTypeCount > 32) throw new Error('INVALID_BATTERY_TYPES');
    const batteryRows = await Promise.all(Array.from({ length: batteryTypeCount }, (_, type) => contract.myBattery(address, type)));
    const nowSeconds = Math.floor(this.now() / 1000);
    const machines = (Array.isArray(machineRows) ? machineRows : []).map((machine) => {
      const type = Number(machine.tid ?? machine[0]);
      const expires = Number(machine.exp ?? machine[1]);
      if (!Number.isSafeInteger(type) || type < 0 || !Number.isSafeInteger(expires) || expires < 0) throw new Error('INVALID_MACHINE');
      return {
        type,
        expiresAt: expires > 0 ? new Date(expires * 1000).toISOString() : null,
        active: expires > nowSeconds
      };
    });
    const batteries = batteryRows.map((quantity, type) => {
      const value = BigInt(quantity || 0);
      return { type, quantity: value.toString() };
    }).filter((item) => item.quantity !== '0');
    const activePower = BigInt(info?.ap ?? info?.[1] ?? 0);
    const lastClaim = Number(info?.lc ?? info?.[2] ?? 0);
    const activeMachineCount = machines.filter((machine) => machine.active).length;
    return {
      walletAddress: address.toLowerCase(),
      source: 'polygon',
      chainId: 137,
      machineCount: machines.length,
      activeMachineCount,
      batteryCount: batteries.reduce((sum, item) => sum + BigInt(item.quantity), 0n).toString(),
      miningActive: activeMachineCount > 0 && activePower > 0n,
      activePower: activePower.toString(),
      lastClaimAt: Number.isSafeInteger(lastClaim) && lastClaim > 0 ? new Date(lastClaim * 1000).toISOString() : null,
      machines,
      batteries,
      serverTime: new Date(this.now()).toISOString()
    };
  }

  async read(walletAddress) {
    const address = ethers.getAddress(walletAddress);
    if (this.contract) {
      try { return await this.readWithContract(this.contract, address); }
      catch (_) { throw new AccountError(503, 'Lecture des actifs Polygon temporairement indisponible.', 'POLYGON_UNAVAILABLE'); }
    }
    for (const rpcUrl of this.rpcUrls) {
      let provider = null;
      let timeout = null;
      try {
        provider = this.providerFactory(rpcUrl);
        const contract = new ethers.Contract(this.mineAddress, MINE_ABI, provider);
        return await Promise.race([
          this.readWithContract(contract, address),
          new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('POLYGON_TIMEOUT')), 12000); })
        ]);
      } catch (_) {
        // Essayer le nœud public suivant sans exposer de détail RPC à l’admin.
      } finally {
        if (timeout) clearTimeout(timeout);
        if (provider && typeof provider.destroy === 'function') provider.destroy();
      }
    }
    throw new AccountError(503, 'Lecture des actifs Polygon temporairement indisponible.', 'POLYGON_UNAVAILABLE');
  }
}

class AccountService {
  constructor(options = {}) {
    if (!options.auth || !options.repository) throw new Error('AccountService dependencies are required');
    this.auth = options.auth;
    this.repository = options.repository;
    this.polygon = options.polygon || new PolygonAccountReader(options.polygonOptions);
    this.now = options.now || (() => Date.now());
    this.randomUUID = options.randomUUID || (() => crypto.randomUUID());
  }

  async ensureProfile(authUser, requestedUsername = '') {
    const userId = authUserId(authUser);
    const email = normalizeEmail(authUser.email);
    const verifiedAt = emailVerifiedAt(authUser);
    let row = await this.repository.findProfile(userId);
    if (!row) {
      const username = requestedUsername ? normalizeUsername(requestedUsername) : generatedUsername(authUser);
      const timestamp = new Date(this.now()).toISOString();
      row = await this.repository.createProfile({
        user_id: userId, username, email, email_verified_at: verifiedAt,
        wallet_address: null, wallet_verified_at: null, certified: false, certified_at: null,
        created_at: timestamp, updated_at: timestamp
      });
    } else if (row.email !== email || (row.email_verified_at || null) !== verifiedAt) {
      await this.repository.updateAuthProfile(userId, email, verifiedAt);
      row = { ...row, email, email_verified_at: verifiedAt, updated_at: new Date(this.now()).toISOString() };
    }
    return profileFromRow(row);
  }

  sessionPayload(data, user) {
    const accessToken = String(data.access_token || '');
    const refreshToken = String(data.refresh_token || '');
    const expiresIn = Number(data.expires_in || 3600);
    if (!accessToken || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new AccountError(503, 'Réponse de session invalide.', 'ACCOUNT_UNAVAILABLE');
    }
    return {
      user,
      session: {
        accessToken,
        refreshToken,
        tokenType: 'bearer',
        expiresIn: Math.floor(expiresIn),
        expiresAt: new Date(this.now() + Math.floor(expiresIn) * 1000).toISOString()
      }
    };
  }

  async signUp(params = {}) {
    const email = normalizeEmail(params.email);
    const password = normalizePassword(params.password);
    const username = normalizeUsername(params.username);
    const data = await this.auth.signUp(email, password, username);
    const authUser = data.user || data;
    if (!data.access_token) {
      // Supabase renvoie identities=[] lorsqu'une inscription est répétée pour
      // un email existant. Ne pas modifier ni exposer le profil sans session.
      if (Array.isArray(authUser.identities) && authUser.identities.length === 0) {
        return { pendingConfirmation: true };
      }
      await this.ensureProfile(authUser, username);
      return { pendingConfirmation: true };
    }
    const user = await this.ensureProfile(authUser, username);
    return { pendingConfirmation: false, ...this.sessionPayload(data, user) };
  }

  async signIn(params = {}) {
    const email = normalizeEmail(params.email);
    const password = normalizePassword(params.password);
    const data = await this.auth.signIn(email, password);
    const authUser = data.user || await this.auth.getUser(data.access_token);
    const user = await this.ensureProfile(authUser);
    return this.sessionPayload(data, user);
  }

  async refresh(params = {}) {
    const refreshToken = String(params.refreshToken || '');
    if (!refreshToken || refreshToken.length > 4096 || /[\u0000-\u001f\u007f]/.test(refreshToken)) {
      throw new AccountError(400, 'Jeton de renouvellement invalide.', 'ACCOUNT_SESSION_EXPIRED');
    }
    const data = await this.auth.refresh(refreshToken);
    const authUser = data.user || await this.auth.getUser(data.access_token);
    const user = await this.ensureProfile(authUser);
    return this.sessionPayload(data, user);
  }

  async session(accessToken) {
    const authUser = await this.auth.getUser(accessToken);
    return { user: await this.ensureProfile(authUser) };
  }

  async updateProfile(accessToken, params = {}) {
    const authUser = await this.auth.getUser(accessToken);
    const current = await this.ensureProfile(authUser);
    const username = normalizeUsername(params.username);
    if (username === current.username) return { user: current };
    const row = await this.repository.updateUsername(current.userId, username);
    return { user: profileFromRow(row) };
  }

  async reauthenticate(user, currentPassword) {
    try {
      return await this.auth.signIn(user.email, normalizeCurrentPassword(currentPassword));
    } catch (error) {
      if (error.code === 'ACCOUNT_LOGIN') {
        throw new AccountError(403, 'Mot de passe actuel incorrect.', 'ACCOUNT_REAUTH');
      }
      throw error;
    }
  }

  async changeEmail(accessToken, params = {}) {
    const authUser = await this.auth.getUser(accessToken);
    const current = await this.ensureProfile(authUser);
    const email = normalizeEmail(params.email);
    const currentPassword = normalizeCurrentPassword(params.currentPassword);
    if (email === current.email) throw new AccountError(400, 'Saisissez une nouvelle adresse email.', 'ACCOUNT_EMAIL_SAME');
    const freshSession = await this.reauthenticate(current, currentPassword);
    const updatedAuthUser = await this.auth.updateEmail(current.userId, email);
    const user = await this.ensureProfile(updatedAuthUser);
    return this.sessionPayload(freshSession, user);
  }

  async changePassword(accessToken, params = {}) {
    const authUser = await this.auth.getUser(accessToken);
    const current = await this.ensureProfile(authUser);
    const currentPassword = normalizeCurrentPassword(params.currentPassword);
    const newPassword = normalizePassword(params.newPassword);
    if (newPassword === currentPassword) throw new AccountError(400, 'Le nouveau mot de passe doit être différent.', 'ACCOUNT_PASSWORD_SAME');
    const freshSession = await this.reauthenticate(current, currentPassword);
    await this.auth.updatePassword(current.userId, newPassword);
    return this.sessionPayload(freshSession, current);
  }

  async logout(accessToken) {
    await this.auth.logout(accessToken);
    return { signedOut: true };
  }

  async createLinkChallenge(accessToken, params = {}) {
    const authUser = await this.auth.getUser(accessToken);
    const user = await this.ensureProfile(authUser);
    const walletAddress = normalizeWallet(params.walletAddress);
    if (user.walletAddress && user.walletAddress !== walletAddress) {
      throw new AccountError(409, 'Un autre wallet est déjà lié à ce compte.', 'ACCOUNT_WALLET_LINKED');
    }
    const id = this.randomUUID().toLowerCase();
    normalizeUuid(id, 'défi');
    const expiresAt = new Date(this.now() + 10 * 60 * 1000).toISOString();
    const row = await this.repository.createChallenge({
      id, user_id: user.userId, wallet_address: walletAddress,
      expires_at: expiresAt, used_at: null, created_at: new Date(this.now()).toISOString()
    });
    const challenge = {
      id: row.id, userId: user.userId, walletAddress,
      expiresAt: new Date(row.expires_at).toISOString()
    };
    return { challengeId: challenge.id, walletAddress, expiresAt: challenge.expiresAt, message: buildLinkMessage(challenge) };
  }

  async linkWallet(accessToken, params = {}) {
    const authUser = await this.auth.getUser(accessToken);
    const user = await this.ensureProfile(authUser);
    const id = normalizeUuid(params.challengeId, 'défi');
    const walletAddress = normalizeWallet(params.walletAddress);
    const signature = normalizeSignature(params.signature);
    const challenge = await this.repository.getChallenge(id, user.userId, walletAddress);
    if (!challenge || challenge.used_at || Date.parse(challenge.expires_at) <= this.now()) {
      throw new AccountError(410, 'Le défi de liaison est invalide, expiré ou déjà utilisé.', 'ACCOUNT_CHALLENGE_USED');
    }
    const expectedMessage = buildLinkMessage({ id, userId: user.userId, walletAddress, expiresAt: challenge.expires_at });
    if (String(params.message || '') !== expectedMessage) {
      throw new AccountError(400, 'Le message signé ne correspond pas au défi.', 'ACCOUNT_CHALLENGE_MESSAGE');
    }
    let recovered;
    try { recovered = ethers.verifyMessage(expectedMessage, signature); }
    catch (_) { throw new AccountError(400, 'Signature du wallet invalide.', 'ACCOUNT_SIGNATURE'); }
    if (recovered.toLowerCase() !== walletAddress) {
      throw new AccountError(403, 'La signature ne correspond pas à ce wallet.', 'ACCOUNT_SIGNATURE');
    }
    const row = await this.repository.linkWallet(id, user.userId, walletAddress);
    return { user: profileFromRow(row) };
  }

  async listUsers(search = '') {
    const rows = await this.repository.listProfiles(String(search || '').trim().slice(0, 64));
    return { users: rows.map(profileFromRow), serverTime: new Date(this.now()).toISOString() };
  }

  async getUserDetail(userId) {
    const id = normalizeUuid(userId, 'compte');
    const row = await this.repository.findProfile(id);
    if (!row) throw new AccountError(404, 'Compte introuvable.', 'ACCOUNT_NOT_FOUND');
    const user = profileFromRow(row);
    const [events, assets] = await Promise.all([
      this.repository.listCertificationEvents(id),
      user.walletVerified && user.walletAddress ? this.polygon.read(user.walletAddress) : Promise.resolve(null)
    ]);
    return {
      user,
      assets,
      certificationHistory: events.map((event) => ({
        id: event.id, certified: event.certified === true,
        actor: event.actor, createdAt: event.created_at
      })),
      serverTime: new Date(this.now()).toISOString()
    };
  }

  async setCertified(userId, certified, actor = 'admin') {
    const id = normalizeUuid(userId, 'compte');
    if (typeof certified !== 'boolean') throw new AccountError(400, 'État de certification invalide.', 'ACCOUNT_VALIDATION');
    const safeActor = String(actor || 'admin');
    if (!/^[A-Za-z0-9_.@-]{1,80}$/.test(safeActor)) throw new AccountError(400, 'Auteur invalide.', 'ACCOUNT_VALIDATION');
    const row = await this.repository.setCertified(id, certified, safeActor);
    return { user: profileFromRow(row) };
  }
}

let defaultService = null;
function getDefaultAccountService() {
  if (defaultService) return defaultService;
  const url = process.env.FITIA_SUPABASE_URL || '';
  const serviceRoleKey = process.env.FITIA_SUPABASE_SERVICE_ROLE_KEY || '';
  const rpcUrls = String(process.env.FITIA_POLYGON_RPC_URLS || '').split(',').map((value) => value.trim()).filter((value) => /^https:\/\//i.test(value));
  const options = { url, serviceRoleKey };
  defaultService = new AccountService({
    auth: new SupabaseAuthClient(options),
    repository: new SupabaseAccountRepository(options),
    polygon: new PolygonAccountReader({ rpcUrls: rpcUrls.length ? rpcUrls : DEFAULT_POLYGON_RPCS })
  });
  return defaultService;
}

module.exports = {
  AccountError,
  AccountService,
  MemoryAccountRepository,
  PolygonAccountReader,
  SupabaseAccountRepository,
  SupabaseAuthClient,
  buildLinkMessage,
  getDefaultAccountService,
  normalizeEmail,
  normalizePassword,
  normalizeUsername,
  normalizeWallet,
  profileFromRow
};
