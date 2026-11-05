#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require(fs.existsSync('/tmp/test-deps/node_modules/jsdom') ? '/tmp/test-deps/node_modules/jsdom' : 'jsdom');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'android-src/wallet.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const dom = new JSDOM(html, { url: 'https://app.fitia.pro/wallet.html', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom; Object.defineProperty(window, 'crypto', { value: crypto.webcrypto, configurable: true });
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
for (const file of ['vendor/ethers.umd.min.js', 'farm-config.js', 'farm-protocol.js', 'arcade-config.js', 'arcade.js', 'game-experience-crash.js']) {
  window.eval(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}
const Config = window.FitiaArcadeConfig;
let passed = 0; let failed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log(`  ✅ ${name}`); }
  catch (error) { failed += 1; console.error(`  ❌ ${name}\n     ↳ ${error.stack || error}`); }
}
async function waitFor(condition, label) {
  for (let index = 0; index < 200; index += 1) { if (condition()) return; await new Promise((resolve) => setTimeout(resolve, 10)); }
  throw new Error(`Délai dépassé : ${label}`);
}
const account = `0x${'11'.repeat(20)}`;
const other = `0x${'22'.repeat(20)}`;
const roundId = crypto.randomUUID();
const scene = { setActive() {}, resize() {}, reset() {}, setRound(value) { this.round = value; }, cancelAnimation() {}, startWaiting() {} };
const app = { nav() {}, showToast() {} };
let clockMs = Date.now();
const farm = {
  state: null, aviator: null, serverOffset: 0,
  serverNow() { return clockMs; },
  applyView(data) { this.state = data.state; this.aviator = data.aviator || null; },
  async request() { throw new Error('Unexpected request'); }
};
const crash = new window.FitiaCrash(app, farm); app.fitaCrash = crash;
crash.init(); window.setupGameCrash(app); crash.setAccount(account); crash.scene = scene; crash.active = true; crash.scheduleSync = () => {};
function ownRound(shared, bets) {
  return {
    version: 2, id: shared.id, status: shared.status, bets,
    stake: bets.reduce((sum, bet) => sum + bet.stake, 0), coins: bets.reduce((sum, bet) => sum + (bet.coins || 0), 0),
    clientSeed: shared.clientSeed, seedHash: shared.seedHash, createdAt: shared.createdAt, startsAt: shared.startsAt,
    crashBps: shared.status === 'crashed' ? shared.crashBps : undefined,
    serverSeed: shared.status === 'crashed' ? shared.serverSeed : undefined,
    randomValue: shared.status === 'crashed' ? shared.randomValue : undefined,
    completedAt: shared.status === 'crashed' ? shared.completedAt : null, lastAction: null
  };
}
function setRound(shared, ownBets, ownHistory = [], globalHistory = []) {
  farm.aviator = { version: 3, round: shared, history: globalHistory };
  farm.state = {
    version: 1, wallet: account, coins: 1000, land: { owned: true }, animals: [{ id: crypto.randomUUID() }], crops: [],
    crash: { totalRounds: ownHistory.length + (ownBets.length ? 1 : 0), totalStaked: 150, totalWonCoins: 0, active: ownRound(shared, ownBets), recentRounds: ownHistory }
  };
  crash.render();
}
const createdAt = new Date(clockMs).toISOString();
const startsAt = new Date(Date.parse(createdAt) + Config.CRASH_AVIATOR_BETTING_MS).toISOString();
const shared = {
  version: 3, id: roundId, status: 'betting', playerCount: 2, stake: 300, coins: 0,
  clientSeed: 'aviator-global-v3', seedHash: 'ab'.repeat(32), createdAt, startsAt,
  bets: [
    { id: 'a', wallet: '0x1111…1111', mine: true, slot: 1, stake: 100, status: 'active', cashoutBps: null, cashoutKind: null, coins: 0 },
    { id: 'b', wallet: '0x2222…2222', mine: false, slot: 1, stake: 200, status: 'active', cashoutBps: null, cashoutKind: null, coins: 0 }
  ]
};
const ownBet = { slot: 1, actionId: crypto.randomUUID(), stake: 100, autoTargetBps: null, status: 'active', cashoutBps: null, cashoutKind: null, coins: 0, placedAt: createdAt, settledAt: null, settlementActionId: null };

(async () => {
  console.log('\n🎮 TESTS UI AVIATOR MULTIJOUEUR\n' + '═'.repeat(72));
  await test('Salle live réelle : deux participants, montants et adresses masquées', async () => {
    setRound(shared, [ownBet]);
    assert.strictEqual(window.document.querySelectorAll('#crash-live-bets-body tr').length, 2);
    assert.strictEqual(window.document.querySelectorAll('#crash-live-bets-body tr.mine').length, 1);
    assert.strictEqual(window.document.getElementById('crash-live-player-count').textContent, '2');
    assert.strictEqual(window.document.getElementById('crash-live-bet-count').textContent, '2');
    assert.strictEqual(window.document.getElementById('crash-live-total-stake').textContent, '300 coins');
    const text = window.document.getElementById('crash-live-bets-body').textContent;
    assert.ok(text.includes('0x2222…2222')); assert.ok(!text.includes(other));
    assert.ok(window.document.querySelector('.flight-live-panel[aria-label="Players"]'));
  });

  await test('Interface épurée : aucun badge technique, décompte de 5 s et avion à hélice local', async () => {
    setRound(shared, [ownBet]);
    const view = window.document.getElementById('view-crash');
    const forbidden = ['AVIATOR CONTROLS', 'ADD BET', 'MULTIPLAYER ROOM', 'LIVE · SERVER', 'REAL HISTORY', 'YOUR ACTIVITY', 'FAIRNESS', 'SHA-256', 'SERVER FLIGHT', 'MULTIPLIER', 'IN FLIGHT', 'NEXT FLIGHT', 'ROOM', 'YOUR CASHOUTS'];
    const assertClean = () => {
      const text = view.textContent.replace(/\s+/g, ' ').toUpperCase();
      forbidden.forEach((label) => assert.ok(!text.includes(label), `${label} doit rester absent`));
    };
    assertClean();
    assert.strictEqual(Config.CRASH_AVIATOR_BETTING_MS, 5000);
    assert.strictEqual(window.document.getElementById('crash-multiplier-caption').textContent, '5s');
    assert.strictEqual(window.document.getElementById('crash-add-bet').textContent.trim(), '+');
    assert.ok(window.document.querySelector('.flight-plane svg[data-aircraft="red-propeller"]'));
    assert.ok(window.document.querySelector('.flight-plane .flight-propeller'));
    clockMs += 1000; crash.render();
    assert.strictEqual(window.document.getElementById('crash-multiplier-caption').textContent, '4s');
    setRound({ ...shared, status: 'flying' }, [ownBet]); assertClean();
    assert.strictEqual(window.document.getElementById('crash-multiplier-caption').textContent, '');
    assert.strictEqual(window.document.getElementById('crash-bet-state-1').textContent, 'BET PLACED');
    clockMs -= 1000; setRound(shared, [ownBet]);
  });

  await test('Historique mondial séparé de votre activité et crash figé au point serveur', async () => {
    const ownHistory = [{ version: 2, id: crypto.randomUUID(), status: 'crashed', crashBps: 250, stake: 50, coins: 0, bets: [{ slot: 1, status: 'lost' }] }];
    const globalHistory = [ownHistory[0], { version: 3, id: crypto.randomUUID(), status: 'crashed', crashBps: 900, stake: 500, coins: 0, betCount: 3 }];
    const crashed = {
      ...shared, status: 'crashed', crashBps: 175, serverSeed: 'cd'.repeat(32), randomValue: 123, completedAt: startsAt,
      bets: shared.bets.map((bet) => ({ ...bet, status: 'lost', cashoutBps: null, coins: 0 }))
    };
    setRound(crashed, [{ ...ownBet, status: 'lost', settledAt: startsAt, settlementActionId: crypto.randomUUID() }], ownHistory, globalHistory);
    assert.strictEqual(window.document.querySelectorAll('#crash-recent-multipliers .crash-recent-chip').length, 2);
    assert.strictEqual(window.document.querySelectorAll('#crash-history-list tr').length, 1);
    assert.strictEqual(window.document.getElementById('crash-stage').dataset.state, 'crashed');
    assert.strictEqual(window.document.getElementById('crash-multiplier').textContent, '1.75×');
    assert.strictEqual(window.document.querySelectorAll('#crash-live-bets-body tr.lost').length, 2);
  });

  await test('Présentation : le vol terminé ne repart pas et conserve son multiplicateur de crash', async () => {
    const originalFrame = window.requestAnimationFrame; const originalCancel = window.cancelAnimationFrame;
    window.requestAnimationFrame = () => 1; window.cancelAnimationFrame = () => {};
    try {
      const presentation = window.createGameCrashPresentation(window.document.getElementById('crash-3d-container'), { clock: () => Date.now() });
      presentation.setActive(true);
      presentation.setRound({ ...shared, status: 'flying' });
      const crashed = { ...shared, status: 'crashed', crashBps: 175, completedAt: startsAt };
      presentation.setRound(crashed);
      const visual = window.document.getElementById('crash-3d-container');
      assert.ok(visual.classList.contains('crashed')); assert.ok(!visual.classList.contains('settled'));
      presentation.setRound(crashed);
      assert.ok(!visual.classList.contains('settled'));
      assert.strictEqual(window.document.getElementById('crash-multiplier').textContent, '1.75×');
      presentation.dispose();
    } finally { window.requestAnimationFrame = originalFrame; window.cancelAnimationFrame = originalCancel; }
  });

  await test('Auto Bet rejoint la manche commune puis la suivante sans créer de vol privé', async () => {
    const requests = [];
    farm.request = async (action, body) => {
      requests.push({ action, body });
      const bet = { ...ownBet, actionId: body.actionId, stake: body.params.stake, autoTargetBps: body.params.autoTargetBps };
      const publicBet = { id: String(requests.length), wallet: '0x1111…1111', mine: true, slot: 1, stake: bet.stake, status: 'active', cashoutBps: null, cashoutKind: null, coins: 0 };
      const current = { ...farm.aviator.round, playerCount: 1, stake: bet.stake, bets: [publicBet] };
      return {
        state: { ...farm.state, crash: { ...farm.state.crash, active: ownRound(current, [bet]) } },
        aviator: { ...farm.aviator, round: current },
        crashAction: { id: body.actionId, type: body.type, roundId: body.params.roundId, events: [], crash: false, createdAt }
      };
    };
    const fresh = { ...shared, playerCount: 0, stake: 0, bets: [] }; setRound(fresh, []);
    crash.setAutoBet(1, true); crash.maybeScheduleAuto();
    await waitFor(() => requests.length === 1 && !crash.operation, 'premier Auto Bet');
    assert.strictEqual(requests[0].body.type, 'crash_bet'); assert.strictEqual(requests[0].body.params.roundId, roundId);
    const next = { ...fresh, id: crypto.randomUUID() }; setRound(next, []); crash.maybeScheduleAuto();
    await waitFor(() => requests.length === 2 && !crash.operation, 'Auto Bet de la manche suivante');
    assert.strictEqual(requests[1].body.type, 'crash_bet'); assert.strictEqual(requests[1].body.params.roundId, next.id);
    crash.setAutoBet(1, false); assert.strictEqual(requests.length, 2);
  });

  await test('Salle vide : aucun nom, aucune mise et aucun historique fictif', async () => {
    crash.setAutoBet(1, false);
    const empty = { ...shared, id: crypto.randomUUID(), playerCount: 0, stake: 0, bets: [] };
    setRound(empty, [], [], []);
    assert.strictEqual(window.document.querySelectorAll('#crash-live-bets-body tr').length, 0);
    assert.strictEqual(window.document.getElementById('crash-live-player-count').textContent, '0');
    assert.strictEqual(window.document.getElementById('crash-live-total-stake').textContent, '0 coins');
    assert.strictEqual(window.document.getElementById('crash-live-bets-empty').textContent, 'No bets in this round yet.');
    assert.strictEqual(window.document.querySelectorAll('#crash-recent-multipliers .crash-recent-chip').length, 0);
  });
  crash.exit();
})().then(() => {
  console.log('═'.repeat(72)); console.log(`🎮 RÉSULTAT UI MULTIJOUEUR : ${passed} réussis, ${failed} échoués\n`);
  window.close(); process.exitCode = failed ? 1 : 0;
});
