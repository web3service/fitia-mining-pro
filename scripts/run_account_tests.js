#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { ethers } = require('../vendor/ethers.umd.min.js');
const {
  AccountError, AccountService, MemoryAccountRepository, PolygonAccountReader,
  SupabaseAuthClient, SupabaseAccountRepository, normalizePassword
} = require('../account-service');
const { createAccountHandler } = require('../api/account');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ${error.stack || error}`); }
}
async function rejects(promise, code) {
  await assert.rejects(promise, (error) => error && error.code === code);
}

class FakeAuth {
  constructor() { this.users = new Map(); this.access = new Map(); this.refreshTokens = new Map(); this.counter = 0; }
  issue(user) {
    this.counter += 1;
    const accessToken = `access-${this.counter}-${'a'.repeat(24)}`;
    const refreshToken = `refresh-${this.counter}-${'b'.repeat(24)}`;
    this.access.set(accessToken, user.id); this.refreshTokens.set(refreshToken, user.id);
    return { access_token: accessToken, refresh_token: refreshToken, expires_in: 3600, user: this.publicUser(user) };
  }
  publicUser(user) { return { id: user.id, email: user.email, email_confirmed_at: user.emailConfirmedAt, user_metadata: { username: user.username } }; }
  async signUp(email, password, username) {
    if ([...this.users.values()].some((user) => user.email === email)) throw new AccountError(400, 'Exists', 'ACCOUNT_SIGNUP');
    const user = { id: require('crypto').randomUUID(), email, password, username, emailConfirmedAt: null };
    this.users.set(user.id, user); return this.issue(user);
  }
  async signIn(email, password) {
    const user = [...this.users.values()].find((candidate) => candidate.email === email);
    if (!user || user.password !== password) throw new AccountError(401, 'Invalid', 'ACCOUNT_LOGIN');
    return this.issue(user);
  }
  async getUser(accessToken) {
    const id = this.access.get(accessToken); const user = this.users.get(id);
    if (!user) throw new AccountError(401, 'Invalid', 'ACCOUNT_AUTH');
    return this.publicUser(user);
  }
  async refresh(refreshToken) {
    const id = this.refreshTokens.get(refreshToken); const user = this.users.get(id);
    if (!user) throw new AccountError(401, 'Expired', 'ACCOUNT_SESSION_EXPIRED');
    this.refreshTokens.delete(refreshToken); return this.issue(user);
  }
  async logout(accessToken) { this.access.delete(accessToken); }
}

function createService(auth = new FakeAuth(), repository = new MemoryAccountRepository(), polygon) {
  const service = new AccountService({ auth, repository, polygon: polygon || { read: async () => null } });
  return { service, auth, repository };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}
function close(server) { return new Promise((resolve) => server.close(resolve)); }

(async () => {
  console.log('\n🔐 TESTS DES COMPTES FITIA PRO\n' + '═'.repeat(68));
  await test('Validation email, username et mot de passe sans persistance du secret', async () => {
    assert.throws(() => normalizePassword('short1A'), (error) => error.code === 'ACCOUNT_PASSWORD');
    assert.throws(() => normalizePassword('password12345'), (error) => error.code === 'ACCOUNT_PASSWORD');
    assert.strictEqual(normalizePassword('A-correct-passphrase-2026'), 'A-correct-passphrase-2026');
    const { service, repository } = createService();
    await rejects(service.signUp({ email: 'invalid', password: 'A-correct-passphrase-2026', username: 'Miner_01' }), 'ACCOUNT_EMAIL');
    await rejects(service.signUp({ email: 'miner@example.com', password: 'A-correct-passphrase-2026', username: '<script>' }), 'ACCOUNT_USERNAME');
    const result = await service.signUp({ email: 'MINER@example.com', password: 'A-correct-passphrase-2026', username: 'Miner_01' });
    assert.strictEqual(result.user.email, 'miner@example.com');
    assert.strictEqual(result.user.username, 'Miner_01');
    assert.strictEqual(result.user.walletVerified, false);
    assert.strictEqual(result.user.certified, false);
    assert.ok(!JSON.stringify([...repository.profiles.values()]).includes('A-correct-passphrase-2026'));
  });

  await test('Confirmation email sans fuite ni altération d’un profil existant', async () => {
    const existingId = require('crypto').randomUUID();
    const verifiedAt = '2026-11-05T12:00:00.000Z';
    const repository = new MemoryAccountRepository();
    await repository.createProfile({
      user_id: existingId, username: 'Existing_User', email: 'existing@example.com',
      email_verified_at: verifiedAt, wallet_address: null, wallet_verified_at: null,
      certified: true, certified_at: verifiedAt, created_at: verifiedAt, updated_at: verifiedAt
    });
    const auth = {
      signUp: async () => ({
        user: { id: existingId, email: 'existing@example.com', email_confirmed_at: null, identities: [] }
      })
    };
    const { service } = createService(auth, repository);
    const repeated = await service.signUp({
      email: 'existing@example.com', password: 'A-correct-passphrase-2026', username: 'Changed_Name'
    });
    assert.deepStrictEqual(repeated, { pendingConfirmation: true });
    const existing = await repository.findProfile(existingId);
    assert.strictEqual(existing.username, 'Existing_User');
    assert.strictEqual(existing.email_verified_at, verifiedAt);
    assert.strictEqual(existing.certified, true);

    const pendingId = require('crypto').randomUUID();
    auth.signUp = async () => ({
      user: {
        id: pendingId, email: 'pending@example.com', email_confirmed_at: null,
        user_metadata: { username: 'Pending_User' }, identities: [{ id: 'email-identity' }]
      }
    });
    const pending = await service.signUp({
      email: 'pending@example.com', password: 'A-correct-passphrase-2026', username: 'Pending_User'
    });
    assert.deepStrictEqual(pending, { pendingConfirmation: true });
    assert.ok(!Object.hasOwn(pending, 'user'), 'Aucun profil ou badge n’est exposé avant la session');
    assert.strictEqual((await repository.findProfile(pendingId)).username, 'Pending_User');
  });

  await test('Sessions Auth vérifiées côté serveur et renouvellement à jeton rotatif', async () => {
    const { service, auth } = createService();
    const signed = await service.signUp({ email: 'session@example.com', password: 'A-correct-passphrase-2026', username: 'Session_User' });
    const accessToken = signed.session.accessToken;
    assert.strictEqual((await service.session(accessToken)).user.username, 'Session_User');
    await rejects(service.session('not-a-token'), 'ACCOUNT_AUTH');
    const refreshed = await service.refresh({ refreshToken: signed.session.refreshToken });
    assert.notStrictEqual(refreshed.session.accessToken, accessToken);
    await rejects(service.refresh({ refreshToken: signed.session.refreshToken }), 'ACCOUNT_SESSION_EXPIRED');
    const user = [...auth.users.values()][0]; user.emailConfirmedAt = new Date().toISOString();
    assert.strictEqual((await service.session(refreshed.session.accessToken)).user.emailVerified, true);
    await service.logout(refreshed.session.accessToken);
    await rejects(service.session(refreshed.session.accessToken), 'ACCOUNT_AUTH');
  });

  await test('Liaison wallet par signature exacte, à usage unique et sans transaction', async () => {
    const { service, repository } = createService();
    const signed = await service.signUp({ email: 'wallet@example.com', password: 'A-correct-passphrase-2026', username: 'Wallet_User' });
    const token = signed.session.accessToken;
    const wallet = ethers.Wallet.createRandom();
    const challenge = await service.createLinkChallenge(token, { walletAddress: wallet.address });
    assert.ok(challenge.message.includes('does not authorize a transaction'));
    assert.ok(challenge.message.includes(wallet.address));
    const signature = await wallet.signMessage(challenge.message);
    const linked = await service.linkWallet(token, {
      challengeId: challenge.challengeId, walletAddress: wallet.address, message: challenge.message, signature
    });
    assert.strictEqual(linked.user.walletVerified, true);
    assert.strictEqual(linked.user.walletAddress, wallet.address.toLowerCase());
    assert.strictEqual(linked.user.emailVerified, false);
    assert.strictEqual(linked.user.certified, false);
    await rejects(service.linkWallet(token, {
      challengeId: challenge.challengeId, walletAddress: wallet.address, message: challenge.message, signature
    }), 'ACCOUNT_CHALLENGE_USED');
    const other = ethers.Wallet.createRandom();
    const second = await service.createLinkChallenge(token, { walletAddress: wallet.address });
    const wrongSignature = await other.signMessage(second.message);
    await rejects(service.linkWallet(token, {
      challengeId: second.challengeId, walletAddress: wallet.address, message: second.message, signature: wrongSignature
    }), 'ACCOUNT_SIGNATURE');
    const third = await service.createLinkChallenge(token, { walletAddress: wallet.address });
    const thirdSignature = await wallet.signMessage(third.message);
    await rejects(service.linkWallet(token, {
      challengeId: third.challengeId, walletAddress: wallet.address, message: `${third.message}\nUnauthorized transaction`, signature: thirdSignature
    }), 'ACCOUNT_CHALLENGE_MESSAGE');
    repository.challenges.get(third.challengeId).expires_at = new Date(Date.now() - 1000).toISOString();
    await rejects(service.linkWallet(token, {
      challengeId: third.challengeId, walletAddress: wallet.address, message: third.message, signature: thirdSignature
    }), 'ACCOUNT_CHALLENGE_USED');
    assert.ok([...repository.challenges.values()].every((row) => !('signature' in row) && !('privateKey' in row)));
  });

  await test('Un wallet ne peut pas être revendiqué par deux comptes', async () => {
    const auth = new FakeAuth(); const repository = new MemoryAccountRepository();
    const { service } = createService(auth, repository);
    const wallet = ethers.Wallet.createRandom();
    const first = await service.signUp({ email: 'first@example.com', password: 'A-correct-passphrase-2026', username: 'First_User' });
    const challenge = await service.createLinkChallenge(first.session.accessToken, { walletAddress: wallet.address });
    await service.linkWallet(first.session.accessToken, { challengeId: challenge.challengeId, walletAddress: wallet.address, message: challenge.message, signature: await wallet.signMessage(challenge.message) });
    const second = await service.signUp({ email: 'second@example.com', password: 'A-correct-passphrase-2026', username: 'Second_User' });
    const otherChallenge = await service.createLinkChallenge(second.session.accessToken, { walletAddress: wallet.address });
    await rejects(service.linkWallet(second.session.accessToken, {
      challengeId: otherChallenge.challengeId, walletAddress: wallet.address,
      message: otherChallenge.message, signature: await wallet.signMessage(otherChallenge.message)
    }), 'ACCOUNT_WALLET_LINKED');
  });

  await test('Badges indépendants et journal des attributions/retraits admin', async () => {
    const { service } = createService();
    const signed = await service.signUp({ email: 'badges@example.com', password: 'A-correct-passphrase-2026', username: 'Badge_User' });
    const userId = signed.user.userId;
    let detail = await service.getUserDetail(userId);
    assert.strictEqual(detail.user.certified, false);
    assert.strictEqual(detail.user.emailVerified, false);
    assert.strictEqual(detail.user.walletVerified, false);
    await service.setCertified(userId, true, 'admin');
    detail = await service.getUserDetail(userId);
    assert.strictEqual(detail.user.certified, true);
    assert.strictEqual(detail.user.walletVerified, false);
    await service.setCertified(userId, false, 'admin');
    detail = await service.getUserDetail(userId);
    assert.strictEqual(detail.user.certified, false);
    assert.deepStrictEqual(detail.certificationHistory.map((event) => event.certified), [false, true]);
  });

  await test('Machines, batteries et minage actif proviennent des lectures du contrat', async () => {
    const now = Date.parse('2026-11-05T12:00:00.000Z');
    const nowSeconds = Math.floor(now / 1000);
    const contract = {
      myMachines: async () => [{ tid: 2n, exp: BigInt(nowSeconds + 3600) }, { tid: 1n, exp: BigInt(nowSeconds - 20) }],
      bCount: async () => 3n,
      myBattery: async (_address, type) => type === 0 ? 2n : type === 2 ? 1n : 0n,
      myInfo: async () => [2n, 75n, BigInt(nowSeconds - 120)]
    };
    const reader = new PolygonAccountReader({ contract, now: () => now });
    const assets = await reader.read(ethers.Wallet.createRandom().address);
    assert.strictEqual(assets.source, 'polygon');
    assert.strictEqual(assets.machineCount, 2);
    assert.strictEqual(assets.activeMachineCount, 1);
    assert.strictEqual(assets.batteryCount, '3');
    assert.strictEqual(assets.activePower, '75');
    assert.strictEqual(assets.miningActive, true);
    assert.deepStrictEqual(assets.batteries, [{ type: 0, quantity: '2' }, { type: 2, quantity: '1' }]);
    contract.myInfo = async () => [2n, 0n, 0n];
    assert.strictEqual((await reader.read(ethers.Wallet.createRandom().address)).miningActive, false);
  });

  await test('Migration: RLS privé, fonctions atomiques et aucune colonne de secret wallet', async () => {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261105150000_app_user_accounts.sql'), 'utf8');
    assert.ok(sql.includes('alter table public.app_user_profiles enable row level security'));
    assert.ok(sql.includes('alter table public.app_wallet_link_challenges enable row level security'));
    assert.ok(sql.includes('revoke all on public.app_user_profiles from public, anon, authenticated'));
    assert.ok(sql.includes('grant execute on function public.app_user_link_wallet(uuid, uuid, text) to service_role'));
    assert.ok(sql.includes('app_user_certification_events'));
    assert.ok(!/create policy/i.test(sql), 'Aucune lecture publique des profils ou défis');
    const profileDefinition = sql.split('create table if not exists public.app_user_profiles (')[1].split(');')[0];
    assert.ok(!/password|private_key|mnemonic|recovery_phrase|session_token|refresh_token/i.test(profileDefinition));
  });

  await test('Transport Supabase: secrets uniquement vers Auth et recherche PostgREST encodée', async () => {
    const calls = [];
    const fetchMock = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('/auth/v1/token')) {
        return new Response(JSON.stringify({ access_token: 'access-token', refresh_token: 'refresh-token', expires_in: 3600 }), { status: 200 });
      }
      if (String(url).includes('/auth/v1/user')) return new Response(JSON.stringify({ id: require('crypto').randomUUID(), email: 'auth@example.com' }), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    };
    const auth = new SupabaseAuthClient({ url: 'https://project.supabase.co', serviceRoleKey: 'service-secret', fetch: fetchMock });
    const authResult = await auth.signIn('auth@example.com', 'A-correct-passphrase-2026');
    assert.strictEqual(authResult.access_token, 'access-token');
    const authCall = calls[0];
    assert.strictEqual(authCall.options.headers.apikey, 'service-secret');
    assert.strictEqual(authCall.options.headers.Authorization, undefined);
    assert.ok(authCall.options.body.includes('A-correct-passphrase-2026'));
    const repository = new SupabaseAccountRepository({ url: 'https://project.supabase.co', serviceRoleKey: 'service-secret', fetch: fetchMock });
    await repository.listProfiles('miner@example.com');
    const searchCall = calls[calls.length - 1];
    assert.ok(searchCall.url.includes('/rest/v1/app_user_profiles?'));
    assert.ok(searchCall.url.includes('&or='));
    assert.strictEqual(searchCall.options.headers.Authorization, 'Bearer service-secret');
    assert.ok(!searchCall.options.body || !searchCall.options.body.includes('password'));
  });

  await test('API: Bearer obligatoire, CORS restreint et endpoints sans fuite de session', async () => {
    const { service } = createService();
    const server = http.createServer(createAccountHandler({ accountService: service, trustProxy: true }));
    const base = await listen(server);
    try {
      let response = await fetch(`${base}/api/account/session`);
      assert.strictEqual(response.status, 401);
      response = await fetch(`${base}/api/account/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
        body: JSON.stringify({ email: 'cors@example.com', password: 'A-correct-passphrase-2026', username: 'Cors_User' })
      });
      assert.strictEqual(response.status, 403);
      response = await fetch(`${base}/api/account/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://app.fitia.pro' },
        body: JSON.stringify({ email: 'api@example.com', password: 'A-correct-passphrase-2026', username: 'Api_User' })
      });
      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.headers.get('access-control-allow-origin'), 'https://app.fitia.pro');
      const payload = await response.json();
      assert.ok(payload.session.accessToken);
      assert.ok(!JSON.stringify(payload).includes('A-correct-passphrase-2026'));
      response = await fetch(`${base}/api/account/session`, { headers: { Authorization: `Bearer ${payload.session.accessToken}` } });
      assert.strictEqual(response.status, 200);
      assert.strictEqual((await response.json()).user.username, 'Api_User');
      response = await fetch(`${base}/api/account/challenge`, { method: 'GET', headers: { Authorization: `Bearer ${payload.session.accessToken}` } });
      assert.strictEqual(response.status, 405);
    } finally { await close(server); }
  });

  await test('API: limitation des échecs de connexion par client', async () => {
    const { service, auth } = createService();
    const signed = await service.signUp({ email: 'rate@example.com', password: 'A-correct-passphrase-2026', username: 'Rate_User' });
    assert.ok(signed.session.accessToken);
    const server = http.createServer(createAccountHandler({ accountService: service, trustProxy: true }));
    const base = await listen(server);
    try {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const response = await fetch(`${base}/api/account/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.44' },
          body: JSON.stringify({ email: 'rate@example.com', password: 'Wrong-passphrase-2026' })
        });
        assert.strictEqual(response.status, attempt === 5 ? 429 : 401);
        const body = await response.json();
        assert.ok(!JSON.stringify(body).includes('Wrong-passphrase-2026'));
      }
    } finally { await close(server); }
    assert.strictEqual(auth.users.size, 1);
  });

  console.log('═'.repeat(68));
  console.log(`📊 ${passed} réussis, ${failed} échoués`);
  if (failed) process.exit(1);
})().catch((error) => { console.error(error); process.exit(1); });
