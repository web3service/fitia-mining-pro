/* FITIA ARCADE — scènes 3D locales, sans ressource distante. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function fallback(container, image) {
    if (container) {
      container.textContent = ''; container.classList.add('arcade-3d-fallback');
      const logo = document.createElement('img'); logo.src = image; logo.alt = ''; logo.width = 145; logo.height = 145;
      logo.setAttribute('aria-hidden', 'true'); container.appendChild(logo);
    }
    return {
      available: false, setActive() {}, startWaiting() {}, resize() {}, dispose() {}, setRound() {},
      animateResult() { return Promise.resolve(); }, animateReveal() { return Promise.resolve(); }, animateCashout() { return Promise.resolve(); }, cancelAnimation() {}
    };
  }
  function rendererFor(container) {
    const THREE = globalThis.THREE;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1)); renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (THREE.ACESFilmicToneMapping) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; }
    renderer.domElement.setAttribute('aria-hidden', 'true'); container.textContent = ''; container.classList.remove('arcade-3d-fallback'); container.appendChild(renderer.domElement);
    return renderer;
  }
  function addLights(scene, accent = 0x9b78ed) {
    const THREE = globalThis.THREE;
    scene.add(new THREE.HemisphereLight(0xc8dcff, 0x16101f, 1.55));
    const key = new THREE.DirectionalLight(0xffe7b0, 3.1); key.position.set(-3.5, 6, 4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 0.5; key.shadow.camera.far = 22;
    key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; scene.add(key);
    const rim = new THREE.PointLight(accent, 20, 15, 2); rim.position.set(3, 2.5, -2); scene.add(rim);
    const gold = new THREE.PointLight(0xffb82e, 12, 12, 2); gold.position.set(-3, 1, 2); scene.add(gold);
  }
  function disposeScene(scene, renderer, observer) {
    observer?.disconnect(); scene.traverse((object) => {
      object.geometry?.dispose?.(); const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach((material) => { material.map?.dispose?.(); material.dispose?.(); });
    });
    renderer.dispose(); renderer.domElement.remove();
  }
  function resizeRenderer(container, renderer, camera) {
    const bounds = container.getBoundingClientRect(); if (bounds.width < 2 || bounds.height < 2) return;
    renderer.setSize(Math.round(bounds.width), Math.round(bounds.height), false);
    camera.aspect = bounds.width / bounds.height; camera.updateProjectionMatrix(); renderer.render(camera.__scene, camera);
  }

  function createMines(container, options = {}) {
    if (!container || !globalThis.THREE) return fallback(container, 'assets/mines.svg');
    try {
      const THREE = globalThis.THREE; const renderer = rendererFor(container); const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60); camera.position.set(0, 6.4, 7.3); camera.lookAt(0, 0, 0); camera.__scene = scene;
      addLights(scene, 0x7955c7);
      const board = new THREE.Group(); board.rotation.y = -0.05; scene.add(board);
      const tileGeometry = new THREE.BoxGeometry(0.88, 0.2, 0.88, 2, 1, 2);
      const gemGeometry = new THREE.OctahedronGeometry(0.29, 1); const mineGeometry = new THREE.SphereGeometry(0.27, 24, 18);
      const gemMaterial = new THREE.MeshStandardMaterial({ color: 0x42d9b2, emissive: 0x075d54, emissiveIntensity: 0.8, metalness: 0.25, roughness: 0.18 });
      const mineMaterial = new THREE.MeshStandardMaterial({ color: 0x242c40, emissive: 0x5e101c, emissiveIntensity: 0.35, metalness: 0.72, roughness: 0.26 });
      const tiles = [];
      for (let index = 0; index < 25; index += 1) {
        const group = new THREE.Group(); const row = Math.floor(index / 5); const column = index % 5;
        group.position.set((column - 2) * 1.04, 0, (row - 2) * 1.04);
        const material = new THREE.MeshStandardMaterial({ color: (row + column) % 2 ? 0x2b2b49 : 0x323252, metalness: 0.58, roughness: 0.32 });
        const base = new THREE.Mesh(tileGeometry, material); base.castShadow = true; base.receiveShadow = true; base.userData.minesIndex = index; group.add(base);
        const trim = new THREE.LineSegments(new THREE.EdgesGeometry(tileGeometry), new THREE.LineBasicMaterial({ color: 0xa88ade, transparent: true, opacity: 0.28 })); base.add(trim);
        const gem = new THREE.Mesh(gemGeometry, gemMaterial); gem.position.y = 0.46; gem.visible = false; gem.castShadow = true; group.add(gem);
        const mine = new THREE.Mesh(mineGeometry, mineMaterial); mine.position.y = 0.43; mine.visible = false; mine.castShadow = true; group.add(mine);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 32), new THREE.MeshBasicMaterial({ color: 0xe16370 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.22; ring.visible = false; group.add(ring);
        board.add(group); tiles.push({ group, base, material, gem, mine, ring, safe: false, mined: false });
      }
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.32 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.13; floor.receiveShadow = true; scene.add(floor);
      const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
      const onPointer = (event) => {
        const bounds = renderer.domElement.getBoundingClientRect(); if (!bounds.width || !bounds.height) return;
        pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(tiles.map((tile) => tile.base), false)[0];
        if (hit) options.onSelect?.(hit.object.userData.minesIndex);
      };
      renderer.domElement.addEventListener('click', onPointer);
      let active = false; let waiting = false; let frame = 0; let previous = performance.now(); let animation = null; let resolveAnimation = null; let observer = null; let signature = '';
      const render = () => renderer.render(scene, camera);
      const resize = () => { resizeRenderer(container, renderer, camera); render(); };
      const cancelAnimation = () => { waiting = false; animation = null; const resolve = resolveAnimation; resolveAnimation = null; if (resolve) resolve(); };
      const setRound = (round) => {
        const nextSignature = round ? JSON.stringify([round.id, round.status, round.revealed, round.minePositions || [], round.hitMine]) : 'empty';
        if (nextSignature === signature) return; signature = nextSignature;
        const safe = new Set(round?.revealed || []); const mines = new Set(round && round.status !== 'active' ? round.minePositions || [] : []);
        tiles.forEach((tile, index) => {
          tile.safe = safe.has(index); tile.mined = mines.has(index); tile.gem.visible = tile.safe; tile.mine.visible = tile.mined; tile.ring.visible = tile.mined;
          tile.gem.scale.setScalar(1); tile.mine.scale.setScalar(1); tile.group.position.y = 0;
          tile.material.color.setHex(tile.safe ? 0x174b49 : tile.mined ? 0x4a2334 : (Math.floor(index / 5) + index % 5) % 2 ? 0x2b2b49 : 0x323252);
          tile.material.emissive.setHex(tile.safe ? 0x063c35 : tile.mined ? 0x3b0c16 : 0x000000); tile.material.emissiveIntensity = tile.safe || tile.mined ? 0.55 : 0;
        });
        render();
      };
      const tick = (time) => {
        if (!active) return; const delta = Math.min(0.05, Math.max(0, (time - previous) / 1000)); previous = time;
        board.rotation.y = -0.05 + Math.sin(time * 0.00035) * 0.025;
        tiles.forEach((tile, index) => { if (tile.safe) { tile.gem.rotation.y += delta * 1.25; tile.gem.position.y = 0.46 + Math.sin(time * 0.002 + index) * 0.025; } });
        if (waiting && !animation) tiles.forEach((tile, index) => { if (!tile.safe && !tile.mined) tile.group.position.y = Math.sin(time * 0.004 + index * 0.5) * 0.025; });
        if (animation) {
          const progress = Math.min(1, (time - animation.startedAt) / animation.duration); const eased = 1 - Math.pow(1 - progress, 3);
          if (animation.type === 'reveal') {
            const tile = tiles[animation.index]; const symbol = animation.safe ? tile.gem : tile.mine;
            tile.group.rotation.x = Math.sin(progress * Math.PI) * 0.24; symbol.scale.setScalar(Math.max(0.01, eased)); symbol.rotation.y += delta * 5;
            tile.group.position.y = Math.sin(progress * Math.PI) * 0.35;
          } else {
            tiles.forEach((tile, index) => { if (tile.safe) { tile.gem.position.y = 0.46 + eased * (0.5 + index % 3 * 0.15); tile.gem.rotation.y += delta * 5; } });
          }
          if (progress >= 1) {
            if (animation.type === 'reveal') { const tile = tiles[animation.index]; tile.group.rotation.x = 0; tile.group.position.y = 0; (animation.safe ? tile.gem : tile.mine).scale.setScalar(1); }
            animation = null; const resolve = resolveAnimation; resolveAnimation = null; if (resolve) resolve();
          }
        }
        render(); frame = requestAnimationFrame(tick);
      };
      const setActive = (value) => { active = Boolean(value); if (!active) { cancelAnimation(); cancelAnimationFrame(frame); frame = 0; return; } resize(); previous = performance.now(); if (!frame) frame = requestAnimationFrame(tick); };
      const animateReveal = (index, safe) => {
        cancelAnimation(); const tile = tiles[index]; if (!tile) return Promise.resolve();
        const symbol = safe ? tile.gem : tile.mine; symbol.visible = true; if (!safe) tile.ring.visible = true; symbol.scale.setScalar(0.01);
        if (!active || reducedMotion()) { symbol.scale.setScalar(1); render(); return Promise.resolve(); }
        animation = { type: 'reveal', index, safe, startedAt: performance.now(), duration: 650 };
        return new Promise((resolve) => { resolveAnimation = resolve; });
      };
      const animateCashout = () => {
        cancelAnimation(); if (!active || reducedMotion()) return Promise.resolve();
        animation = { type: 'cashout', startedAt: performance.now(), duration: 850 }; return new Promise((resolve) => { resolveAnimation = resolve; });
      };
      if (globalThis.ResizeObserver) { observer = new ResizeObserver(resize); observer.observe(container); }
      return { available: true, setActive, startWaiting() { cancelAnimation(); waiting = !reducedMotion(); }, animateReveal, animateCashout, cancelAnimation, setRound, resize, dispose() { setActive(false); renderer.domElement.removeEventListener('click', onPointer); disposeScene(scene, renderer, observer); } };
    } catch (_) { return fallback(container, 'assets/mines.svg'); }
  }

  function createCrash(container, options = {}) {
    if (!container || !globalThis.THREE) return fallback(container, 'assets/crash.svg');
    try {
      const THREE = globalThis.THREE; const renderer = rendererFor(container); const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60); camera.position.set(0, 2.3, 8); camera.lookAt(0, 0.8, 0); camera.__scene = scene; addLights(scene, 0x4b79d8);
      const rocket = new THREE.Group();
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xdde8fa, metalness: 0.68, roughness: 0.25 });
      const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xe5ad32, metalness: 0.85, roughness: 0.2, emissive: 0x4a2600, emissiveIntensity: 0.25 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 1.35, 32), bodyMaterial); body.castShadow = true; rocket.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 32), goldMaterial); nose.position.y = 1; nose.castShadow = true; rocket.add(nose);
      const windowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), new THREE.MeshStandardMaterial({ color: 0x56c4e5, emissive: 0x123e6e, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.15 })); windowMesh.scale.z = 0.35; windowMesh.position.set(0, 0.3, 0.29); rocket.add(windowMesh);
      for (const side of [-1, 1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.5), goldMaterial); fin.position.set(side * 0.35, -0.48, 0); fin.rotation.z = side * -0.25; rocket.add(fin); }
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.23, 1.15, 24), new THREE.MeshBasicMaterial({ color: 0xffa43d, transparent: true, opacity: 0.82 })); flame.position.y = -1.22; flame.rotation.z = Math.PI; rocket.add(flame);
      rocket.rotation.z = -0.62; scene.add(rocket);
      const start = new THREE.Vector3(-2.5, -0.9, 0); const control = new THREE.Vector3(-0.3, 0.15, 0); const end = new THREE.Vector3(2.3, 2.6, 0);
      const curve = new THREE.QuadraticBezierCurve3(start, control, end); rocket.position.copy(start);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)), new THREE.LineBasicMaterial({ color: 0x8c74d5, transparent: true, opacity: 0.3 })); scene.add(line);
      const grid = new THREE.GridHelper(14, 20, 0x5b4c8c, 0x293149); grid.position.y = -1.25; grid.material.transparent = true; grid.material.opacity = 0.26; scene.add(grid);
      const starPositions = new Float32Array(70 * 3); for (let index = 0; index < 70; index += 1) { starPositions[index * 3] = Math.sin(index * 12.37) * 5; starPositions[index * 3 + 1] = (index % 14) * 0.38 - 1; starPositions[index * 3 + 2] = -1 - (index % 5) * 0.4; }
      const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3)); const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xf7d675, size: 0.035, transparent: true, opacity: 0.65 })); scene.add(stars);
      const explosion = new THREE.Group(); const explosionMaterial = new THREE.MeshBasicMaterial({ color: 0xff7b62, transparent: true, opacity: 0.85 });
      for (let index = 0; index < 18; index += 1) { const particle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), explosionMaterial); particle.userData.direction = new THREE.Vector3(Math.cos(index * 2.4), Math.sin(index * 2.4), (index % 3 - 1) * 0.4); explosion.add(particle); }
      explosion.visible = false; scene.add(explosion);
      let active = false; let waiting = false; let frame = 0; let previous = performance.now(); let animation = null; let resolveAnimation = null; let observer = null;
      const render = () => renderer.render(scene, camera); const resize = () => { resizeRenderer(container, renderer, camera); render(); };
      const cancelAnimation = () => { waiting = false; animation = null; const resolve = resolveAnimation; resolveAnimation = null; if (resolve) resolve(); };
      const tick = (time) => {
        if (!active) return; const delta = Math.min(0.05, Math.max(0, (time - previous) / 1000)); previous = time; stars.rotation.z += delta * 0.015;
        flame.scale.y = 0.9 + Math.sin(time * 0.025) * 0.13;
        if (waiting && !animation) { rocket.position.copy(start); rocket.position.y += Math.sin(time * 0.004) * 0.07; rocket.visible = true; explosion.visible = false; }
        if (animation) {
          const progress = Math.min(1, (time - animation.startedAt) / animation.duration); const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          const travel = eased * animation.endProgress; rocket.position.copy(curve.getPoint(travel)); options.onMultiplier?.((100 + (animation.endBps - 100) * eased) / 100);
          if (!animation.won && progress > 0.82) {
            const blast = (progress - 0.82) / 0.18; explosion.visible = true; explosion.position.copy(rocket.position); explosion.scale.setScalar(0.3 + blast * 2.2); explosionMaterial.opacity = 0.85 * (1 - blast); rocket.visible = blast < 0.35;
          }
          if (progress >= 1) { animation = null; const resolve = resolveAnimation; resolveAnimation = null; if (resolve) resolve(); }
        }
        render(); frame = requestAnimationFrame(tick);
      };
      const setActive = (value) => { active = Boolean(value); if (!active) { cancelAnimation(); cancelAnimationFrame(frame); frame = 0; return; } resize(); previous = performance.now(); if (!frame) frame = requestAnimationFrame(tick); };
      const animateResult = (result) => {
        cancelAnimation(); rocket.visible = true; rocket.position.copy(start); explosion.visible = false; explosionMaterial.opacity = 0.85; options.onMultiplier?.(1);
        const won = result.won; const endBps = won ? result.targetBps : result.crashBps;
        const endProgress = won ? 1 : Math.max(0, Math.min(0.96, (result.crashBps - 100) / Math.max(1, result.targetBps - 100)));
        if (!active || reducedMotion()) { rocket.position.copy(curve.getPoint(endProgress)); options.onMultiplier?.(endBps / 100); render(); return Promise.resolve(); }
        animation = { won, endBps, endProgress, startedAt: performance.now(), duration: 2100 }; return new Promise((resolve) => { resolveAnimation = resolve; });
      };
      if (globalThis.ResizeObserver) { observer = new ResizeObserver(resize); observer.observe(container); }
      return { available: true, setActive, startWaiting() { cancelAnimation(); options.onMultiplier?.(1); waiting = !reducedMotion(); }, animateResult, cancelAnimation, resize, dispose() { setActive(false); disposeScene(scene, renderer, observer); } };
    } catch (_) { return fallback(container, 'assets/crash.svg'); }
  }

  function coinTexture(side) {
    const THREE = globalThis.THREE; const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512; const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(170, 140, 20, 256, 256, 250);
    if (side === 'heads') { gradient.addColorStop(0, '#fff6bd'); gradient.addColorStop(0.42, '#efbd36'); gradient.addColorStop(1, '#8a5017'); }
    else { gradient.addColorStop(0, '#eee4ff'); gradient.addColorStop(0.42, '#a47bd9'); gradient.addColorStop(1, '#3c275f'); }
    context.fillStyle = gradient; context.fillRect(0, 0, 512, 512); context.strokeStyle = '#fff0a5'; context.lineWidth = 15; context.beginPath(); context.arc(256, 256, 224, 0, TAU); context.stroke();
    context.setLineDash([8, 14]); context.lineWidth = 5; context.beginPath(); context.arc(256, 256, 193, 0, TAU); context.stroke(); context.setLineDash([]);
    context.fillStyle = side === 'heads' ? '#633a17' : '#fff0b5'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = '900 190px Inter, sans-serif'; context.fillText(side === 'heads' ? 'H' : 'T', 256, 238);
    context.font = '800 40px Inter, sans-serif'; context.fillText('FITIA', 256, 372);
    const texture = new THREE.CanvasTexture(canvas); if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }
  function createCoinFlip(container) {
    if (!container || !globalThis.THREE) return fallback(container, 'assets/coin-flip.svg');
    try {
      const THREE = globalThis.THREE; const renderer = rendererFor(container); const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 60); camera.position.set(0, 2.4, 6.4); camera.lookAt(0, 0.4, 0); camera.__scene = scene; addLights(scene, 0x8b61d0);
      const edge = new THREE.MeshStandardMaterial({ color: 0xc88920, metalness: 0.9, roughness: 0.2 });
      const heads = new THREE.MeshStandardMaterial({ map: coinTexture('heads'), metalness: 0.55, roughness: 0.27 });
      const tails = new THREE.MeshStandardMaterial({ map: coinTexture('tails'), metalness: 0.48, roughness: 0.3 });
      const geometry = new THREE.CylinderGeometry(1.35, 1.35, 0.18, 96, 1, false); const coin = new THREE.Mesh(geometry, [edge, heads, tails]); coin.castShadow = true;
      const group = new THREE.Group(); group.add(coin); group.position.y = 0.85; group.rotation.x = Math.PI / 2; scene.add(group);
      const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, 0.18, 64), new THREE.MeshStandardMaterial({ color: 0x151e32, metalness: 0.72, roughness: 0.28 })); platform.position.y = -0.45; platform.receiveShadow = true; scene.add(platform);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.035, 12, 72), goldMaterialForCoin()); ring.rotation.x = Math.PI / 2; ring.position.y = -0.34; scene.add(ring);
      function goldMaterialForCoin() { return new THREE.MeshStandardMaterial({ color: 0xe8ae28, metalness: 0.86, roughness: 0.22, emissive: 0x4a2600, emissiveIntensity: 0.35 }); }
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.34 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.56; floor.receiveShadow = true; scene.add(floor);
      let active = false; let waiting = false; let frame = 0; let previous = performance.now(); let animation = null; let resolveAnimation = null; let observer = null;
      const render = () => renderer.render(scene, camera); const resize = () => { resizeRenderer(container, renderer, camera); render(); };
      const cancelAnimation = () => { waiting = false; animation = null; const resolve = resolveAnimation; resolveAnimation = null; if (resolve) resolve(); };
      const tick = (time) => {
        if (!active) return; const delta = Math.min(0.05, Math.max(0, (time - previous) / 1000)); previous = time; ring.rotation.z += delta * 0.1;
        if (waiting && !animation) { group.rotation.x += delta * 5.2; group.rotation.y += delta * 2.7; group.rotation.z += delta * 1.4; }
        if (animation) {
          const progress = Math.min(1, (time - animation.startedAt) / animation.duration); const eased = 1 - Math.pow(1 - progress, 4);
          group.rotation.x = animation.startX + animation.turns * eased; group.rotation.y = animation.startY + TAU * 2 * eased; group.rotation.z = animation.startZ + Math.sin(progress * Math.PI) * 0.25;
          group.position.y = 0.85 + Math.sin(progress * Math.PI) * 1.25;
          if (progress >= 1) { group.rotation.set(animation.targetX, 0, 0); group.position.y = 0.85; animation = null; const resolve = resolveAnimation; resolveAnimation = null; if (resolve) resolve(); }
        } else if (!waiting) group.position.y = 0.85 + Math.sin(time * 0.0015) * 0.025;
        render(); frame = requestAnimationFrame(tick);
      };
      const setActive = (value) => { active = Boolean(value); if (!active) { cancelAnimation(); cancelAnimationFrame(frame); frame = 0; return; } resize(); previous = performance.now(); if (!frame) frame = requestAnimationFrame(tick); };
      const animateResult = (side) => {
        cancelAnimation(); const targetX = side === 'tails' ? -Math.PI / 2 : Math.PI / 2;
        if (!active || reducedMotion()) { group.rotation.set(targetX, 0, 0); render(); return Promise.resolve(); }
        const startX = group.rotation.x; const targetWithTurns = startX + TAU * 6 + (targetX - ((startX % TAU + TAU) % TAU));
        animation = { startX, startY: group.rotation.y, startZ: group.rotation.z, turns: targetWithTurns - startX, targetX, startedAt: performance.now(), duration: 1900 };
        return new Promise((resolve) => { resolveAnimation = resolve; });
      };
      if (globalThis.ResizeObserver) { observer = new ResizeObserver(resize); observer.observe(container); }
      return { available: true, setActive, startWaiting() { cancelAnimation(); waiting = !reducedMotion(); }, animateResult, cancelAnimation, resize, dispose() { setActive(false); disposeScene(scene, renderer, observer); } };
    } catch (_) { return fallback(container, 'assets/coin-flip.svg'); }
  }

  globalThis.FitiaArcade3D = { createMines, createCrash, createCoinFlip };
})();
