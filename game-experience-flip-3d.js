'use strict';

// Optional WebGL presentation. The signed result is supplied by the existing controller;
// rendering never chooses a side. A CSS coin remains available without WebGL.
window.createGameRealisticCoin = function createGameRealisticCoin(container) {
  const THREE = window.THREE;
  if (!THREE || !container) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0, 0);
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (THREE.ACESFilmicToneMapping) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; }
    renderer.domElement.setAttribute('aria-hidden', 'true'); container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, .1, 40); camera.position.set(0, 0, 5.9);
    scene.add(new THREE.HemisphereLight(0xfff2d4, 0x52401f, 1.45));
    const key = new THREE.DirectionalLight(0xfff0cb, 2.2); key.position.set(-4, 4, 6); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffd992, .8); fill.position.set(4, -2, 4); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd083, .9); rim.position.set(2, 2, -5); scene.add(rim);

    const faceMaterial = (letter) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d');
      const base = ctx.createRadialGradient(170, 120, 12, 256, 256, 340);
      base.addColorStop(0, '#fff1b0'); base.addColorStop(.38, '#edc76e'); base.addColorStop(.75, '#c59345'); base.addColorStop(1, '#a16a2d');
      ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
      const ring = (radius, width, color) => { ctx.beginPath(); ctx.arc(256, 256, radius, 0, Math.PI * 2); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke(); };
      ring(242, 14, '#f9e2a2'); ring(224, 8, '#986222'); ring(214, 4, '#fff2c5'); ring(190, 3, '#9d6b31');
      ctx.beginPath(); for (let i=0; i<16; i++) { const angle = -Math.PI/2 + i*Math.PI/8, r = i%2 ? 133 : 153; const x = 256 + Math.cos(angle)*r, y = 256 + Math.sin(angle)*r; if (!i) ctx.moveTo(x,y); else ctx.lineTo(x,y); } ctx.closePath();
      ctx.fillStyle = '#e8c176'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#a37435'; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 184px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,244,196,.65)'; ctx.fillText(letter, 260, 260);
      ctx.fillStyle = '#79501e'; ctx.fillText(letter, 256, 255);
      for (const [x,y] of [[256,58],[256,454],[58,256],[454,256]]) { ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle='#fff3c4';ctx.fill(); }
      const texture = new THREE.CanvasTexture(canvas); if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
      // Cylinder cap UVs are rotated relative to the screen-facing side.
      texture.center.set(.5, .5); texture.rotation = Math.PI / 2;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return new THREE.MeshStandardMaterial({ map: texture, metalness: .15, roughness: .3 });
    };
    const edgeCanvas = document.createElement('canvas'); edgeCanvas.width = 512; edgeCanvas.height = 64;
    const edgeCtx = edgeCanvas.getContext('2d'); edgeCtx.fillStyle = '#9d682c'; edgeCtx.fillRect(0, 0, 512, 64);
    for (let x=0; x<512; x+=7) { edgeCtx.fillStyle = '#e6bd70'; edgeCtx.fillRect(x, 0, 2, 64); edgeCtx.fillStyle = '#755023'; edgeCtx.fillRect(x+3, 0, 2, 64); }
    const edgeTexture = new THREE.CanvasTexture(edgeCanvas); if (THREE.SRGBColorSpace) edgeTexture.colorSpace = THREE.SRGBColorSpace;
    const edge = new THREE.MeshStandardMaterial({ map: edgeTexture, metalness: .25, roughness: .32 });
    const geometry = new THREE.CylinderGeometry(1.17, 1.17, .16, 96, 1);
    // Cylinder groups are edge, +Y, -Y. +Y is the front (Pile).
    const mesh = new THREE.Mesh(geometry, [edge, faceMaterial('P'), faceMaterial('F')]);
    mesh.rotation.x = Math.PI / 2;
    const coin = new THREE.Group(); coin.add(mesh);
    const tilt = new THREE.Group(); tilt.rotation.set(.12, -.25, 0); tilt.add(coin); scene.add(tilt);
    let active = false, waiting = false, frame = 0, animation = null, resolveAnimation = null, available = true;
    const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const render = () => { if (active) renderer.render(scene, camera); };
    const resize = () => { const bounds = container.getBoundingClientRect(); if (!bounds.width || !bounds.height) return; renderer.setSize(Math.round(bounds.width), Math.round(bounds.height), false); camera.aspect = bounds.width / bounds.height; camera.updateProjectionMatrix(); render(); };
    const finish = () => { if (frame) cancelAnimationFrame(frame); frame = 0; waiting = false; if (animation) { coin.rotation.y = animation.target; coin.position.y = 0; } animation = null; const done = resolveAnimation; resolveAnimation = null; render(); if (done) done(); };
    const tick = (time) => {
      frame = 0; if (!active) { finish(); return; }
      if (animation) {
        const t = Math.min(1, (time - animation.start) / animation.duration);
        const eased = 1 - Math.pow(1 - t, 3);
        coin.rotation.y = animation.from + (animation.to - animation.from) * eased;
        coin.position.y = .12 * Math.sin(t * Math.PI);
        if (t >= 1) { finish(); return; }
      } else if (waiting) coin.rotation.y += .08;
      render(); if (animation || waiting) frame = requestAnimationFrame(tick);
    };
    const schedule = () => { if (active && !frame) frame = requestAnimationFrame(tick); };
    const setActive = (value) => { active = Boolean(value); if (!active) finish(); else { resize(); render(); } };
    const startWaiting = () => { finish(); if (!reduced()) { waiting = true; schedule(); } };
    const animateResult = (side) => {
      waiting = false; const target = side === 'heads' ? 0 : Math.PI;
      if (!active || reduced()) { coin.rotation.y = target; coin.position.y = 0; render(); return Promise.resolve(); }
      const from = coin.rotation.y; const to = target + Math.ceil((from - target) / (2 * Math.PI)) * 2 * Math.PI + 6 * Math.PI;
      animation = { start: performance.now(), duration: 1000, from, to, target };
      return new Promise((resolve) => { resolveAnimation = resolve; schedule(); });
    };
    const reset = () => { finish(); coin.rotation.y = 0; coin.position.y = 0; render(); };
    const observer = window.ResizeObserver ? new ResizeObserver(() => { if (active) resize(); }) : null; observer?.observe(container);
    renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); available = false; active = false; finish(); observer?.disconnect(); container.parentElement.classList.remove('webgl-ready'); });
    return { get available() { return available; }, setActive, resize, startWaiting, animateResult, cancelAnimation: finish, reset };
  } catch (_) {
    if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
    return null;
  }
};
