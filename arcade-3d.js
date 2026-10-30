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
      const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 80); camera.position.set(0, 0.3, 8.8); camera.lookAt(0, 0.25, 0); camera.__scene = scene;
      addLights(scene, 0x8b52ff);
      const coolRim = new THREE.PointLight(0x527cff, 18, 15, 2); coolRim.position.set(-3, 1, 3); scene.add(coolRim);

      const baseline = -1.45; const start = new THREE.Vector3(-2.75, baseline, 0.25);
      const control = new THREE.Vector3(-0.85, -1.12, 0.25); const end = new THREE.Vector3(2.25, 1.65, 0.25);
      const curve = new THREE.QuadraticBezierCurve3(start, control, end); const maxPoints = 81;

      const gridPoints = [];
      for (let x = -3.25; x <= 3.26; x += 0.65) gridPoints.push(new THREE.Vector3(x, baseline, -0.9), new THREE.Vector3(x, 2.75, -0.9));
      for (let y = baseline; y <= 2.76; y += 0.55) gridPoints.push(new THREE.Vector3(-3.25, y, -0.9), new THREE.Vector3(3.25, y, -0.9));
      const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPoints), new THREE.LineBasicMaterial({ color: 0x7277b5, transparent: true, opacity: 0.13, depthWrite: false })); scene.add(grid);
      const baseLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3.3, baseline, -0.2), new THREE.Vector3(3.3, baseline, -0.2)]), new THREE.LineBasicMaterial({ color: 0xa98aff, transparent: true, opacity: 0.28 })); scene.add(baseLine);

      const starPositions = new Float32Array(120 * 3);
      for (let index = 0; index < 120; index += 1) {
        starPositions[index * 3] = Math.sin(index * 12.37) * 5.4;
        starPositions[index * 3 + 1] = (index % 20) * 0.31 - 1.4;
        starPositions[index * 3 + 2] = -1.5 - (index % 7) * 0.38;
      }
      const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xdde5ff, size: 0.035, transparent: true, opacity: 0.78, depthWrite: false })); scene.add(stars);
      const dust = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xa968ff, size: 0.085, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false })); dust.rotation.z = 0.7; scene.add(dust);

      const pathPositions = new Float32Array(maxPoints * 3); const areaPositions = new Float32Array(maxPoints * 2 * 3);
      const areaIndices = new Uint16Array((maxPoints - 1) * 6);
      for (let index = 0; index < maxPoints - 1; index += 1) {
        const offset = index * 6; const top = index * 2;
        areaIndices.set([top, top + 1, top + 2, top + 1, top + 3, top + 2], offset);
      }
      const pathGeometry = new THREE.BufferGeometry(); pathGeometry.setAttribute('position', new THREE.BufferAttribute(pathPositions, 3).setUsage(THREE.DynamicDrawUsage)); pathGeometry.setDrawRange(0, 1);
      const areaGeometry = new THREE.BufferGeometry(); areaGeometry.setAttribute('position', new THREE.BufferAttribute(areaPositions, 3).setUsage(THREE.DynamicDrawUsage)); areaGeometry.setIndex(new THREE.BufferAttribute(areaIndices, 1)); areaGeometry.setDrawRange(0, 0);
      const area = new THREE.Mesh(areaGeometry, new THREE.MeshBasicMaterial({ color: 0x9b55ff, transparent: true, opacity: 0.19, side: THREE.DoubleSide, depthWrite: false })); scene.add(area);
      const glowLine = new THREE.Line(pathGeometry, new THREE.LineBasicMaterial({ color: 0xb56cff, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false })); glowLine.position.z = 0.015; scene.add(glowLine);
      const flightLine = new THREE.Line(pathGeometry, new THREE.LineBasicMaterial({ color: 0xff9a69, transparent: true, opacity: 0.98, depthWrite: false })); flightLine.position.z = 0.035; scene.add(flightLine);

      const rocket = new THREE.Group();
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xe9edf8, metalness: 0.78, roughness: 0.22 });
      const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x20283a, metalness: 0.9, roughness: 0.2 });
      const coralMaterial = new THREE.MeshStandardMaterial({ color: 0xff635f, metalness: 0.48, roughness: 0.24, emissive: 0x4a0c18, emissiveIntensity: 0.28 });
      const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xf4b95f, metalness: 0.85, roughness: 0.18 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.295, 1.38, 48), bodyMaterial); body.castShadow = true; rocket.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.237, 0.65, 48), coralMaterial); nose.position.y = 1.01; nose.castShadow = true; rocket.add(nose);
      for (const y of [-0.42, 0.69]) { const band = new THREE.Mesh(new THREE.TorusGeometry(y < 0 ? 0.285 : 0.245, 0.022, 10, 48), goldMaterial); band.rotation.x = Math.PI / 2; band.position.y = y; rocket.add(band); }
      const windowRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 12, 40), darkMaterial); windowRing.position.set(0, 0.28, 0.265); rocket.add(windowRing);
      const windowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.145, 32, 20), new THREE.MeshStandardMaterial({ color: 0x74d9ff, emissive: 0x164b88, emissiveIntensity: 1.15, metalness: 0.55, roughness: 0.1 })); windowMesh.scale.z = 0.28; windowMesh.position.set(0, 0.28, 0.275); rocket.add(windowMesh);
      const finShape = new THREE.Shape(); finShape.moveTo(0, 0.35); finShape.lineTo(0.48, -0.28); finShape.lineTo(0.15, -0.36); finShape.lineTo(0, -0.15); finShape.closePath();
      const finGeometry = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2 });
      for (const side of [-1, 1]) { const fin = new THREE.Mesh(finGeometry, coralMaterial); fin.scale.x = side; fin.position.set(side * 0.19, -0.52, -0.06); fin.castShadow = true; rocket.add(fin); }
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.245, 0.3, 40), darkMaterial); nozzle.position.y = -0.83; rocket.add(nozzle);
      const nozzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.025, 10, 40), goldMaterial); nozzleRing.rotation.x = Math.PI / 2; nozzleRing.position.y = -0.98; rocket.add(nozzleRing);
      const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.23, 1.15, 32), new THREE.MeshBasicMaterial({ color: 0xff713e, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false })); flameOuter.position.y = -1.52; flameOuter.rotation.z = Math.PI; rocket.add(flameOuter);
      const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.78, 24), new THREE.MeshBasicMaterial({ color: 0xfff1a6, transparent: true, opacity: 0.94, blending: THREE.AdditiveBlending, depthWrite: false })); flameInner.position.y = -1.32; flameInner.rotation.z = Math.PI; rocket.add(flameInner);
      const engineLight = new THREE.PointLight(0xff7b43, 6, 4, 2); engineLight.position.y = -1.12; rocket.add(engineLight);
      const sparkGeometry = new THREE.SphereGeometry(0.025, 8, 6); const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffb15d, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
      const sparks = []; for (let index = 0; index < 14; index += 1) { const spark = new THREE.Mesh(sparkGeometry, sparkMaterial); rocket.add(spark); sparks.push(spark); }
      rocket.scale.setScalar(0.72); scene.add(rocket);

      const explosion = new THREE.Group(); const explosionMaterial = new THREE.MeshBasicMaterial({ color: 0xff657d, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      const particleGeometry = new THREE.SphereGeometry(0.04, 8, 6); const explosionParticles = [];
      for (let index = 0; index < 30; index += 1) { const particle = new THREE.Mesh(particleGeometry, explosionMaterial); const angle = index * 2.39996; particle.userData.direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), (index % 5 - 2) * 0.18); explosion.add(particle); explosionParticles.push(particle); }
      const blastRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 48), explosionMaterial); explosion.add(blastRing); explosion.visible = false; scene.add(explosion);
      const winBurst = new THREE.Group(); const winMaterial = new THREE.MeshBasicMaterial({ color: 0x79f2c1, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }); const winParticles = [];
      for (let index = 0; index < 22; index += 1) { const particle = new THREE.Mesh(particleGeometry, winMaterial); const angle = index * 2.39996; particle.userData.direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), (index % 3 - 1) * 0.22); winBurst.add(particle); winParticles.push(particle); }
      winBurst.visible = false; scene.add(winBurst);
      const flash = new THREE.PointLight(0xff637d, 0, 7, 2); scene.add(flash);

      let active = false; let waiting = false; let frame = 0; let previous = performance.now(); let animation = null; let resolveAnimation = null; let observer = null; let travel = 0;
      const render = () => renderer.render(scene, camera);
      const resize = () => {
        const bounds = container.getBoundingClientRect(); if (bounds.width < 2 || bounds.height < 2) return;
        renderer.setSize(Math.round(bounds.width), Math.round(bounds.height), false); camera.aspect = bounds.width / bounds.height;
        camera.position.z = camera.aspect < 1.25 ? 10.3 : 8.8; camera.updateProjectionMatrix(); render();
      };
      const updateFlight = (progress) => {
        const count = Math.max(1, Math.min(maxPoints, Math.ceil(progress * (maxPoints - 1)) + 1));
        for (let index = 0; index < count; index += 1) {
          const point = curve.getPoint(count === 1 ? 0 : progress * index / (count - 1));
          pathPositions[index * 3] = point.x; pathPositions[index * 3 + 1] = point.y; pathPositions[index * 3 + 2] = point.z;
          const areaOffset = index * 6; areaPositions[areaOffset] = point.x; areaPositions[areaOffset + 1] = point.y; areaPositions[areaOffset + 2] = point.z - 0.08;
          areaPositions[areaOffset + 3] = point.x; areaPositions[areaOffset + 4] = baseline; areaPositions[areaOffset + 5] = point.z - 0.08;
        }
        pathGeometry.attributes.position.needsUpdate = true; pathGeometry.setDrawRange(0, count);
        areaGeometry.attributes.position.needsUpdate = true; areaGeometry.setDrawRange(0, Math.max(0, count - 1) * 6);
      };
      const positionRocket = (progress, time = 0) => {
        rocket.position.copy(curve.getPoint(progress)); if (waiting && !animation) rocket.position.y += Math.sin(time * 0.004) * 0.045;
        const tangent = curve.getTangent(Math.max(0.001, Math.min(0.999, progress))); rocket.rotation.z = Math.max(-1.15, Math.min(-0.35, Math.atan2(tangent.y, tangent.x) - Math.PI / 2));
      };
      const cancelAnimation = () => { waiting = false; animation = null; const resolve = resolveAnimation; resolveAnimation = null; if (resolve) resolve(); };
      const reset = () => {
        cancelAnimation(); travel = 0; updateFlight(0); positionRocket(0); rocket.visible = true; explosion.visible = false; winBurst.visible = false; flash.intensity = 0;
        explosionMaterial.opacity = 0.9; winMaterial.opacity = 0.85; camera.position.x = 0; camera.position.y = 0.3; camera.lookAt(0, 0.25, 0); options.onMultiplier?.(1); render();
      };
      const tick = (time) => {
        if (!active) return; const delta = Math.min(0.05, Math.max(0, (time - previous) / 1000)); previous = time;
        stars.rotation.z += delta * 0.008; dust.rotation.z -= delta * 0.005;
        flameOuter.scale.y = 0.92 + Math.sin(time * 0.026) * 0.14; flameInner.scale.y = 0.9 + Math.sin(time * 0.033 + 1) * 0.12;
        engineLight.intensity = 5.5 + Math.sin(time * 0.025) * 1.1;
        sparks.forEach((spark, index) => { const phase = (time * 0.0018 + index / sparks.length) % 1; spark.position.set(Math.sin(index * 4.7) * (0.06 + phase * 0.15), -1.04 - phase * 1.15, Math.cos(index * 3.1) * 0.09); spark.scale.setScalar(Math.max(0.05, 1 - phase)); });
        if (waiting && !animation) { travel = 0; updateFlight(0); positionRocket(0, time); rocket.visible = true; }
        if (animation) {
          const progress = Math.min(1, (time - animation.startedAt) / animation.duration); const eased = Math.pow(progress, 1.55);
          travel = eased * animation.endProgress; updateFlight(travel); positionRocket(travel); options.onMultiplier?.((100 + (animation.endBps - 100) * eased) / 100);
          camera.position.x = rocket.position.x * 0.025; camera.position.y = 0.3 + Math.max(0, rocket.position.y) * 0.025; camera.lookAt(0, 0.25, 0);
          if (!animation.won && progress > 0.78) {
            const blast = (progress - 0.78) / 0.22; explosion.visible = true; explosion.position.copy(rocket.position); flash.position.copy(rocket.position); flash.intensity = 14 * (1 - blast);
            explosionParticles.forEach((particle) => particle.position.copy(particle.userData.direction).multiplyScalar(0.2 + blast * 1.15));
            blastRing.scale.setScalar(0.4 + blast * 3.2); explosionMaterial.opacity = 0.9 * (1 - blast); rocket.visible = blast < 0.32;
          }
          if (animation.won && progress > 0.8) {
            const burst = (progress - 0.8) / 0.2; winBurst.visible = true; winBurst.position.copy(rocket.position);
            winParticles.forEach((particle) => particle.position.copy(particle.userData.direction).multiplyScalar(0.15 + burst * 0.9)); winMaterial.opacity = 0.85 * (1 - burst * 0.55);
          }
          if (progress >= 1) {
            options.onMultiplier?.(animation.endBps / 100); animation = null; flash.intensity = 0; const resolve = resolveAnimation; resolveAnimation = null; if (resolve) resolve();
          }
        }
        render(); frame = requestAnimationFrame(tick);
      };
      const setActive = (value) => { active = Boolean(value); if (!active) { cancelAnimation(); cancelAnimationFrame(frame); frame = 0; return; } resize(); previous = performance.now(); if (!frame) frame = requestAnimationFrame(tick); };
      const animateResult = (result) => {
        reset(); const won = result.won; const endBps = won ? result.targetBps : result.crashBps;
        const endProgress = won ? 1 : Math.max(0, Math.min(0.96, (result.crashBps - 100) / Math.max(1, result.targetBps - 100)));
        if (!active || reducedMotion()) {
          travel = endProgress; updateFlight(travel); positionRocket(travel); options.onMultiplier?.(endBps / 100);
          if (!won) { explosion.visible = true; explosion.position.copy(rocket.position); explosionMaterial.opacity = 0.45; rocket.visible = false; }
          render(); return Promise.resolve();
        }
        animation = { won, endBps, endProgress, startedAt: performance.now(), duration: 2450 }; return new Promise((resolve) => { resolveAnimation = resolve; });
      };
      reset(); if (globalThis.ResizeObserver) { observer = new ResizeObserver(resize); observer.observe(container); }
      return { available: true, setActive, reset, startWaiting() { reset(); waiting = !reducedMotion(); }, animateResult, cancelAnimation, resize, dispose() { setActive(false); disposeScene(scene, renderer, observer); } };
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
