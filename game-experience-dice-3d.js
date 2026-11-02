'use strict';

// Optional WebGL rendering for the local game; the CSS cube remains a fallback.
window.createGameRealisticDie = function createGameRealisticDie(container) {
  const THREE = window.THREE;
  if (!THREE || !container) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (THREE.ACESFilmicToneMapping) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; }
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
    camera.position.set(0, 0, 6.6); camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xe9eaff, 0x55516e, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-3, 5, 6); scene.add(key);
    const fill = new THREE.DirectionalLight(0xc5bbff, 0.75); fill.position.set(4, 1, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0x8e85eb, 0.75); rim.position.set(2, -3, -4); scene.add(rim);

    // A subdivided box projected onto a rounded cube, with continuous normals.
    const geometry = new THREE.BoxGeometry(2, 2, 2, 16, 16, 16);
    const position = geometry.attributes.position; const normal = geometry.attributes.normal;
    const radius = 0.16; const inner = 1 - radius;
    const clamp = THREE.MathUtils.clamp;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const cx = clamp(x, -inner, inner), cy = clamp(y, -inner, inner), cz = clamp(z, -inner, inner);
      let nx = x - cx, ny = y - cy, nz = z - cz;
      const length = Math.hypot(nx, ny, nz) || 1; nx /= length; ny /= length; nz /= length;
      position.setXYZ(i, cx + nx * radius, cy + ny * radius, cz + nz * radius);
      normal.setXYZ(i, nx, ny, nz);
    }
    position.needsUpdate = true; normal.needsUpdate = true;
    geometry.computeBoundingSphere();

    const pips = { 1:[[0,0]], 2:[[-1,-1],[1,1]], 3:[[-1,-1],[0,0],[1,1]], 4:[[-1,-1],[1,-1],[-1,1],[1,1]], 5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]], 6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]] };
    const materialFor = (value) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#eeeef5'; ctx.fillRect(0, 0, 512, 512);
      for (const [x, y] of pips[value]) {
        const px = 256 + x * 118, py = 256 + y * 118;
        // A fine rim, dark inset and offset highlight suggest engraved pips.
        ctx.beginPath(); ctx.arc(px, py + 2, 34, 0, Math.PI * 2); ctx.fillStyle = '#c6c4d1'; ctx.fill();
        const pit = ctx.createRadialGradient(px - 9, py - 10, 2, px, py, 29);
        pit.addColorStop(0, '#555366'); pit.addColorStop(.45, '#30313e'); pit.addColorStop(1, '#171926');
        ctx.beginPath(); ctx.arc(px, py, 28, 0, Math.PI * 2); ctx.fillStyle = pit; ctx.fill();
        ctx.beginPath(); ctx.ellipse(px - 7, py - 8, 7, 3, -.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fill();
      }
      const texture = new THREE.CanvasTexture(canvas);
      if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return new THREE.MeshStandardMaterial({ map: texture, roughness: .3, metalness: .02 });
    };
    // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z.
    const die = new THREE.Mesh(geometry, [2,5,3,4,1,6].map(materialFor));
    const tilt = new THREE.Group(); tilt.rotation.set(.30, -.39, 0); tilt.add(die); scene.add(tilt);
    const target = {
      1: [0,0], 2: [0,-Math.PI/2], 3: [Math.PI/2,0],
      4: [-Math.PI/2,0], 5: [0,Math.PI/2], 6: [0,Math.PI]
    };
    const quaternionFor = (value) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...target[value], 0));
    let active = false, waiting = false, frame = 0, animation = null, resolveAnimation = null, available = true;
    const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const render = () => { if (active) renderer.render(scene, camera); };
    const resize = () => {
      const bounds = container.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      renderer.setSize(Math.round(bounds.width), Math.round(bounds.height), false);
      camera.aspect = bounds.width / bounds.height; camera.updateProjectionMatrix(); render();
    };
    const finish = () => {
      if (frame) cancelAnimationFrame(frame); frame = 0; waiting = false;
      if (animation) { die.quaternion.copy(animation.target); die.position.y = 0; }
      animation = null; const done = resolveAnimation; resolveAnimation = null; render(); if (done) done();
    };
    const tick = (now) => {
      frame = 0;
      if (!active) { finish(); return; }
      if (animation) {
        const t = Math.min(1, (now - animation.start) / animation.duration);
        if (t < .62) {
          const progress = t / .62; const eased = 1 - Math.pow(1 - progress, 2);
          die.rotation.set(animation.euler.x + Math.PI * 4 * eased, animation.euler.y + Math.PI * 6 * eased, animation.euler.z + Math.PI * 2 * eased);
        } else {
          if (!animation.settle) animation.settle = die.quaternion.clone();
          const progress = (t - .62) / .38; const eased = 1 - Math.pow(1 - progress, 3);
          die.quaternion.slerpQuaternions(animation.settle, animation.target, eased);
        }
        die.position.y = .14 * Math.sin(t * Math.PI);
        if (t >= 1) { finish(); return; }
      } else if (waiting) {
        die.rotation.x += .035; die.rotation.y += .055;
      }
      render();
      if (animation || waiting) frame = requestAnimationFrame(tick);
    };
    const schedule = () => { if (active && !frame) frame = requestAnimationFrame(tick); };
    const setActive = (value) => { active = Boolean(value); if (!active) finish(); else { resize(); render(); } };
    const startWaiting = () => { finish(); if (!reduced()) { waiting = true; schedule(); } };
    const animateResult = (value) => {
      waiting = false;
      const orientation = quaternionFor(value);
      if (!active || reduced()) { die.quaternion.copy(orientation); die.position.y = 0; render(); return Promise.resolve(); }
      animation = { start: performance.now(), duration: 1000, target: orientation, euler: { x: die.rotation.x, y: die.rotation.y, z: die.rotation.z }, settle: null };
      return new Promise((resolve) => { resolveAnimation = resolve; schedule(); });
    };
    const reset = () => { finish(); die.quaternion.copy(quaternionFor(1)); die.position.y = 0; render(); };
    const observer = window.ResizeObserver ? new ResizeObserver(() => { if (active) resize(); }) : null;
    observer?.observe(container);
    const onContextLost = (event) => { event.preventDefault(); available = false; active = false; finish(); observer?.disconnect(); container.parentElement.classList.remove('webgl-ready'); };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    return { get available() { return available; }, setActive, startWaiting, animateResult, cancelAnimation: finish, reset, resize };
  } catch (_) {
    if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
    return null;
  }
};
