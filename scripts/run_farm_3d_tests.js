#!/usr/bin/env node
'use strict';
// Real Three.js geometry/raycasting with a stub renderer: no GPU or phone involved.
const assert = require('assert');
const fs = require('fs');
const { JSDOM } = require(fs.existsSync('/tmp/test-deps/node_modules/jsdom') ? '/tmp/test-deps/node_modules/jsdom' : 'jsdom');
const dom = new JSDOM('<div id="farm"></div>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
const canvasContext = { fillRect() {}, set fillStyle(v) {}, set globalAlpha(v) {} };
w.HTMLCanvasElement.prototype.getContext = () => canvasContext;
w.eval(fs.readFileSync('vendor/three.min.js', 'utf8'));
w.eval(fs.readFileSync('farm-config.js', 'utf8'));
let rendered;
w.THREE.WebGLRenderer = class {
  constructor() { this.domElement = w.document.createElement('canvas'); this.shadowMap = {}; this.capabilities = { getMaxAnisotropy: () => 1 }; }
  setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  render(scene, camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); rendered = { scene, camera }; }
};
let frame;
w.requestAnimationFrame = fn => { frame = fn; return 1; }; w.cancelAnimationFrame = () => {};
w.eval(fs.readFileSync('farm-3d.js', 'utf8'));
const container = w.document.getElementById('farm'); Object.defineProperties(container, { clientWidth: { value: 800, configurable: true }, clientHeight: { value: 600, configurable: true } });
const selections = []; const farm = w.FitiaFarm3D.create(container, { onSelect: x => selections.push(x) });
const canvas = container.querySelector('canvas'); canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
farm.setState({ animals: [], crops: [], farmProgress: {} }); frame(w.performance.now());
const scene = rendered.scene, camera = rendered.camera;
assert.ok(camera.isOrthographicCamera, 'projection orthographique');
let direction = camera.position.clone().sub(new w.THREE.Vector3(0, 0.7, 0)).normalize();
assert.ok(Math.abs(direction.x - direction.y) < 1e-8 && Math.abs(direction.y - direction.z) < 1e-8, 'axes isométriques égaux');
console.log('  ✅ Projection orthographique isométrique');
const flowers = scene.getObjectByName('farm-reward-flowers'); const lanterns = scene.getObjectByName('farm-reward-lanterns');
assert.strictEqual(flowers.visible, false); assert.strictEqual(lanterns.visible, false);
farm.setState({ animals: [], crops: [], farmProgress: { planted: 10 } });
assert.strictEqual(flowers.visible, true); assert.strictEqual(lanterns.visible, false);
farm.setState({ animals: [], crops: [], farmProgress: { planted: 20 } });
assert.strictEqual(flowers.visible, true); assert.strictEqual(lanterns.visible, true);
farm.setState({ animals: [], crops: [], farmProgress: {} });
assert.strictEqual(flowers.visible, false); assert.strictEqual(lanterns.visible, false);
console.log('  ✅ Récompenses décoratives et changement de compte');
const targets = {};
scene.traverse(o => { if (o.userData?.kind === 'plot' || o.userData?.kind === 'building') targets[`${o.userData.kind}:${o.userData.id}`] = o; });
const pick = (x, y) => {
  for (const type of ['pointerdown', 'pointerup']) {
    const event = new w.MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { value: 1 }); canvas.dispatchEvent(event);
  }
  return selections.at(-1);
};
// Sample actual projected mesh positions; no fake ray hits. Some geometry can
// be obscured by a nearer selectable object, so try multiple child surfaces.
for (const key of ['building:well', 'building:care', 'building:mill', 'building:tractor', 'building:silo', 'building:barn', 'plot:0', 'plot:1', 'plot:2', 'plot:3', 'plot:4', 'plot:5']) {
  const target = targets[key]; assert.ok(target, `missing ${key}`);
  const meshes = []; target.traverse(o => { if (o.isMesh) meshes.push(o); }); let found = false;
  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox(); const box = mesh.geometry.boundingBox;
    for (const a of [0.2, 0.5, 0.8]) for (const b of [0.2, 0.5, 0.8]) {
      const p = new w.THREE.Vector3(box.min.x + (box.max.x - box.min.x) * a, box.min.y + (box.max.y - box.min.y) * b, (box.min.z + box.max.z) / 2);
      mesh.localToWorld(p); p.project(camera);
      const x = (p.x + 1) * 400, y = (1 - p.y) * 300;
      if (x < 0 || x > 800 || y < 0 || y > 600) continue;
      const before = selections.length; const result = pick(x, y);
      if (selections.length > before && `${result.kind}:${result.id}` === key) found = true;
      if (found) break;
    }
    if (found) break;
  }
  assert.ok(found, `not selectable at overview: ${key}`);
  console.log(`  ✅ ${key}`);
}
farm.setState({ animals: [
  { id: 'duck-test', species: 'duck', produceAt: 0 }, { id: 'goat-test', species: 'goat', produceAt: 0 }
], crops: [], farmProgress: {} });
frame(w.performance.now());
for (const id of ['duck-test', 'goat-test']) {
  let target; scene.traverse(o => { if (o.userData?.kind === 'animal' && o.userData.id === id) target = o; });
  assert.ok(target, `missing animal ${id}`); assert.strictEqual(target.userData.species, id.split('-')[0]);
  let found = false; const meshes = []; target.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox(); const box = mesh.geometry.boundingBox;
    for (const a of [0.2, 0.5, 0.8]) for (const b of [0.2, 0.5, 0.8]) {
      const p = new w.THREE.Vector3(box.min.x + (box.max.x - box.min.x) * a, box.min.y + (box.max.y - box.min.y) * b, (box.min.z + box.max.z) / 2);
      mesh.localToWorld(p); p.project(camera); const before = selections.length; const result = pick((p.x + 1) * 400, (1 - p.y) * 300);
      if (selections.length > before && result.kind === 'animal' && result.id === id) found = true;
      if (found) break;
    }
    if (found) break;
  }
  assert.ok(found, `animal not selectable: ${id}`); console.log(`  ✅ ${id}`);
}
// Portrait viewport keeps the farm's horizontal coverage and zoom remains functional.
Object.defineProperty(container, 'clientWidth', { value: 360, configurable: true });
Object.defineProperty(container, 'clientHeight', { value: 640, configurable: true });
w.dispatchEvent(new w.Event('resize')); frame(w.performance.now());
assert.ok(Math.abs((camera.right - camera.left) / (camera.top - camera.bottom) - 360 / 640) < 1e-9);
assert.ok(camera.right - camera.left > 22, 'ferme visible en portrait');
const wide = camera.right - camera.left; farm.zoom(0.5);
for (let i = 0; i < 100; i++) frame(w.performance.now());
assert.ok(camera.right - camera.left < wide * 0.55, 'zoom orthographique');
farm.rotate(1); for (let i = 0; i < 220; i++) frame(w.performance.now());
direction = camera.position.clone().sub(new w.THREE.Vector3(0, 0.7, 0)).normalize();
assert.ok(Math.abs(direction.y - 1 / Math.sqrt(3)) < 1e-7);
assert.ok(Math.abs(Math.abs(direction.x) - Math.abs(direction.z)) < 1e-7, 'rotation par quart de tour isométrique');
console.log('  ✅ Portrait, zoom et rotation isométrique');
farm.dispose(); dom.window.close(); console.log('3D raycasting OK (renderer stub, no device test)');
