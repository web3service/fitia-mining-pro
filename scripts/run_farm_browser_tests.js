#!/usr/bin/env node
'use strict';
// Optional real-browser smoke test for the isolated local preview only.
// npm install; start node scripts/preview-farm.js; set FARM_CHROMIUM_PATH to a compatible browser.
const { chromium } = require('playwright-core');
const target = new URL(process.env.FARM_PREVIEW_URL || 'http://127.0.0.1:4173/');
if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(target.hostname)) throw new Error('This test must only target an isolated local preview.');
if (!process.env.FARM_CHROMIUM_PATH) throw new Error('Set FARM_CHROMIUM_PATH to a Chromium executable.');
const assert=require('assert');
(async()=>{const b=await chromium.launch({executablePath:process.env.FARM_CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],env:process.env});try{
const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(target.href,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForFunction(()=>window.App?.farmCenter?.state && document.querySelector('canvas.farm-webgl-canvas'),null,{timeout:60000});
assert.ok((await p.locator('.preview-banner').textContent()).includes('ARGENT FICTIF'));
assert.equal(await p.evaluate(()=>!!(document.querySelector('canvas.farm-webgl-canvas').getContext('webgl2'))),true);assert.equal(await p.locator('#farm-withdrawals-empty').textContent(),'Aucun retrait.');
assert.equal(await p.locator('#farm-missions .pf-mission').count(),10);assert.equal(await p.locator('#farm-coin-balance').textContent(),'2,000');
await p.locator('.preview-guide summary').click();await p.locator('[data-preview-action="layout"]').click();await p.getByRole('button',{name:'DÉPLACER UN BÂTIMENT'}).click();
await p.locator('.farm-move-selector').getByRole('button',{name:'Moulin',exact:true}).click(); const old=await p.evaluate(()=>window.App.farmCenter.state.buildingPositions.mill.z);
await p.getByRole('button',{name:'Reculer'}).click(); await p.waitForFunction(old=>!window.App.farmCenter.operation && window.App.farmCenter.state.buildingPositions.mill.z===old-.25,old,{timeout:30000});
await p.getByRole('button',{name:'VOIR LA FERME'}).click(); await p.reload({waitUntil:'domcontentloaded'}); await p.waitForFunction(old=>window.App?.farmCenter?.state?.buildingPositions?.mill?.z===old-.25,old,{timeout:30000});
await p.locator('.preview-guide summary').click();await p.locator('[data-preview-action="market"]').click();const rows=p.locator('.farm-market-row');assert.ok(await rows.count()>=2);await rows.nth(0).locator('.farm-market-select').check();await rows.nth(1).locator('.farm-market-select').check(); const coins=await p.evaluate(()=>window.App.farmCenter.state.coins);
await p.getByRole('button',{name:'VENDRE LA SÉLECTION'}).click();await p.waitForFunction(coins=>!window.App.farmCenter.operation&&window.App.farmCenter.state.coins>coins,coins,{timeout:30000});assert.equal(await p.evaluate(()=>window.App.farmCenter.state.marketSales[0].items.length),2);
await p.locator('[data-preview-action="layout"]').click();await p.getByRole('button',{name:'COULEURS DES BÂTIMENTS'}).click();const group=p.locator('.farm-style-group').filter({hasText:'Moulin'});await group.getByRole('button',{name:'Vert'}).click();await p.waitForFunction(()=>!window.App.farmCenter.operation&&window.App.farmCenter.state.buildingStyle.mill===1,null,{timeout:30000});
await p.setViewportSize({ width: 320, height: 720 });
assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal page overflow at 320px');
await p.locator('#farm-dialog-close').count().then(async n => { if (n) await p.locator('#farm-dialog-close').click(); else await p.evaluate(() => window.App.farmCenter.closeDialog()); });
assert.deepEqual(errors,[]);console.log('Navigateur mobile simulé : WebGL SwiftShader, mise en page FR, 10 missions, déplacement sauvegardé, vente groupée et couleurs OK');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
