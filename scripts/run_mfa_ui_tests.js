#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const FitiaMfaClient = require('../mfa-client');
const html = fs.readFileSync('android-src/wallet.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const dom = new JSDOM(html, { url: 'https://app.fitia.pro', pretendToBeVisual: true });
const doc = dom.window.document;
const codes = Array.from({ length: 10 }, (_, i) => `AAAAAAAA-BBBBBBBB-CCCCCCCC-${i.toString(16).toUpperCase().padStart(8, '0')}`);
let enabled = false; let disabled = false;
const wallet = '0x' + 'a'.repeat(40);
const account = {
  isAuthenticated: () => true, sessionGeneration: 1, user: { walletAddress: wallet, walletVerified: true },
  async request(action, options) {
    if (action === 'mfa-status') { if (disabled) { const e = new Error('Not available'); e.status = 404; throw e; } return { enabled }; }
    if (action === 'mfa-begin') { assert.strictEqual(options.body.currentPassword, 'password'); return { secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/FITIA?secret=JBSWY3DPEHPK3PXP' }; }
    if (action === 'mfa-confirm') { assert.strictEqual(options.body.code, '123456'); enabled = true; return { recoveryCodes: codes }; }
    if (action === 'mfa-verify') { assert.strictEqual(options.body.wallet, wallet); assert.strictEqual(options.body.code, codes[1]); return { verified: true }; }
    if (action === 'mfa-disable') { assert.strictEqual(options.body.code, codes[0]); enabled = false; return { enabled: false }; }
    throw new Error('Unexpected action');
  }
};
const qr = () => ({ addData(text) { assert.ok(text.startsWith('otpauth://')); }, make() {}, createDataURL() { return 'data:image/gif;base64,R0lGODlh'; } });
(async () => {
  const client = new FitiaMfaClient(account, { document: doc, qr }); client.init();
  await client.refresh(); assert.strictEqual(doc.getElementById('mfa-settings').hidden, false);
  doc.getElementById('mfa-password').value = 'password'; await client.start();
  assert.strictEqual(doc.getElementById('mfa-password').value, '');
  assert.strictEqual(doc.getElementById('mfa-secret').textContent, 'JBSWY3DPEHPK3PXP');
  assert.ok(doc.querySelector('#mfa-qr img').src.startsWith('data:image/'));
  doc.getElementById('mfa-code').value = '123456'; await client.confirm();
  assert.strictEqual(doc.getElementById('mfa-secret').textContent, '');
  assert.strictEqual(doc.getElementById('mfa-qr').children.length, 0);
  assert.strictEqual(doc.getElementById('mfa-recovery').hidden, false);
  assert.strictEqual(client.canLeaveSetup(), false);
  assert.ok(doc.getElementById('mfa-recovery-codes').textContent.includes(codes[0]));
  client.recoveryDone(); assert.strictEqual(client.canLeaveSetup(), true);
  const operation = client.operation(wallet, '100 FTA', 'wallet'); await new Promise((r) => setTimeout(r, 0));
  assert.ok(doc.getElementById('modal-mfa-operation').classList.contains('active'));
  doc.getElementById('mfa-operation-code').value = codes[1]; await client.submitCode();
  assert.strictEqual((await operation).required, true);
  assert.strictEqual(doc.getElementById('mfa-operation-code').value, '');
  const cancelled = client.operation(wallet, '1000 coins', 'farm'); await new Promise((r) => setTimeout(r, 0));
  client.cancelCode(); assert.strictEqual(await cancelled, null);
  const farm = client.operation(wallet, '1000 coins', 'farm'); await new Promise((r) => setTimeout(r, 0));
  doc.getElementById('mfa-operation-code').value = codes[2]; await client.submitCode();
  assert.strictEqual((await farm).code, codes[2]);
  assert.strictEqual(doc.getElementById('mfa-recovery-codes').textContent, '');
  doc.getElementById('mfa-disable-password').value = 'password'; doc.getElementById('mfa-disable-code').value = codes[0];
  await client.disable(); assert.strictEqual(enabled, false);
  assert.strictEqual(doc.getElementById('mfa-disable-code').value, '');
  disabled = true; await client.refresh(); assert.strictEqual(doc.getElementById('mfa-settings').hidden, true);
  console.log('MFA UI tests passed: setup, local QR, recovery display, disabling and unavailable service.');
  dom.window.close();
})().catch((error) => { console.error(error); process.exitCode = 1; dom.window.close(); });
