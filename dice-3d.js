/* FITIA DICE — scène 3D locale, sans ressource distante. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const FACE_VALUES = [1, 6, 2, 5, 3, 4];
  const PIPS = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
  };

  function fallback(container) {
    container.textContent = '';
    container.classList.add('dice-3d-fallback');
    const image = document.createElement('img');
    image.src = 'assets/dice.svg'; image.alt = ''; image.width = 150; image.height = 150;
    image.setAttribute('aria-hidden', 'true'); container.appendChild(image);
    return {
      available: false,
      setActive() {}, startWaiting() {}, resize() {}, dispose() {},
      animateResult() { return Promise.resolve(); }, cancelAnimation() {}
    };
  }

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y); context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius); context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height); context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius); context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  function create(container) {
    if (!container || !globalThis.THREE) return fallback(container);
    try {
      const THREE = globalThis.THREE;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      if (THREE.ACESFilmicToneMapping) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; }
      renderer.domElement.setAttribute('aria-hidden', 'true');
      container.textContent = ''; container.classList.remove('dice-3d-fallback'); container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
      camera.position.set(0, 3.25, 6.5); camera.lookAt(0, 0.35, 0);
      scene.add(new THREE.HemisphereLight(0xb9d8ff, 0x18101f, 1.5));
      const keyLight = new THREE.DirectionalLight(0xffe4b0, 3.2);
      keyLight.position.set(-3.5, 6, 4); keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024); keyLight.shadow.camera.near = 0.5; keyLight.shadow.camera.far = 18;
      keyLight.shadow.camera.left = -4; keyLight.shadow.camera.right = 4; keyLight.shadow.camera.top = 4; keyLight.shadow.camera.bottom = -4;
      scene.add(keyLight);
      const rimLight = new THREE.PointLight(0x7c5cff, 18, 12, 2); rimLight.position.set(3, 2, -2); scene.add(rimLight);
      const goldLight = new THREE.PointLight(0xffb82e, 12, 10, 2); goldLight.position.set(-3, 1, 2); scene.add(goldLight);

      const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy?.() || 1);
      const materials = FACE_VALUES.map((value) => {
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
        const context = canvas.getContext('2d');
        const background = context.createLinearGradient(0, 0, 256, 256);
        background.addColorStop(0, '#ffffff'); background.addColorStop(0.52, '#f3f0e8'); background.addColorStop(1, '#c9c5ba');
        roundedRect(context, 4, 4, 248, 248, 30); context.fillStyle = background; context.fill();
        context.lineWidth = 7; context.strokeStyle = '#e0b73e'; context.stroke();
        roundedRect(context, 15, 15, 226, 226, 23); context.lineWidth = 2; context.strokeStyle = 'rgba(255,255,255,.85)'; context.stroke();
        PIPS[value].forEach(([x, y]) => {
          const px = 128 + x * 62; const py = 128 + y * 62;
          const pip = context.createRadialGradient(px - 6, py - 7, 2, px, py, 23);
          pip.addColorStop(0, '#4c556a'); pip.addColorStop(0.42, '#182238'); pip.addColorStop(1, '#070d18');
          context.beginPath(); context.arc(px, py, 21, 0, TAU); context.fillStyle = pip; context.fill();
          context.lineWidth = 2; context.strokeStyle = 'rgba(240,185,11,.32)'; context.stroke();
        });
        const texture = new THREE.CanvasTexture(canvas);
        if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = maxAnisotropy;
        return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.34, metalness: 0.08 });
      });
      const geometry = new THREE.BoxGeometry(1.75, 1.75, 1.75, 3, 3, 3);
      const die = new THREE.Mesh(geometry, materials); die.castShadow = true; die.receiveShadow = true;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), new THREE.LineBasicMaterial({ color: 0xf7cc5e, transparent: true, opacity: 0.3 }));
      edges.scale.setScalar(1.003); die.add(edges);
      const diceGroup = new THREE.Group(); diceGroup.add(die); diceGroup.position.y = 0.82; scene.add(diceGroup);

      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(1.62, 1.85, 0.2, 64),
        new THREE.MeshStandardMaterial({ color: 0x121d32, metalness: 0.72, roughness: 0.28 })
      );
      platform.position.y = -0.22; platform.castShadow = true; platform.receiveShadow = true; scene.add(platform);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.69, 0.035, 12, 72), new THREE.MeshStandardMaterial({ color: 0xe8ae28, metalness: 0.86, roughness: 0.22, emissive: 0x4a2600, emissiveIntensity: 0.4 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = -0.1; scene.add(ring);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.36 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.34; floor.receiveShadow = true; scene.add(floor);

      const particlePositions = new Float32Array(36 * 3);
      for (let index = 0; index < 36; index += 1) {
        const angle = index * 2.39996; const radius = 2.2 + (index % 5) * 0.22;
        particlePositions[index * 3] = Math.cos(angle) * radius;
        particlePositions[index * 3 + 1] = 0.25 + (index % 7) * 0.27;
        particlePositions[index * 3 + 2] = Math.sin(angle) * radius;
      }
      const particleGeometry = new THREE.BufferGeometry(); particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0xf5c64f, size: 0.035, transparent: true, opacity: 0.58, depthWrite: false }));
      scene.add(particles);

      const orientations = {
        1: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
        2: new THREE.Quaternion(),
        3: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
        4: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
        5: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)),
        6: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2))
      };
      const displayRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.38);
      const targetFor = (roll) => displayRotation.clone().multiply(orientations[roll] || orientations[2]);
      diceGroup.quaternion.copy(targetFor(2));

      let active = false; let waiting = false; let frame = 0; let previous = performance.now();
      let animation = null; let animationResolve = null; let resizeObserver = null;
      const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const render = () => renderer.render(scene, camera);
      const resize = () => {
        const bounds = container.getBoundingClientRect();
        if (bounds.width < 2 || bounds.height < 2) return;
        renderer.setSize(Math.round(bounds.width), Math.round(bounds.height), false);
        camera.aspect = bounds.width / bounds.height; camera.updateProjectionMatrix(); render();
      };
      const cancelAnimation = () => {
        waiting = false; animation = null;
        const resolve = animationResolve; animationResolve = null; if (resolve) resolve();
      };
      const tick = (time) => {
        if (!active) return;
        const delta = Math.min(0.05, Math.max(0, (time - previous) / 1000)); previous = time;
        particles.rotation.y += delta * 0.08;
        ring.rotation.z += delta * 0.12;
        if (waiting && !animation) {
          diceGroup.rotation.x += delta * 3.4; diceGroup.rotation.y += delta * 4.7; diceGroup.rotation.z += delta * 2.1;
        }
        if (animation) {
          const progress = Math.min(1, (time - animation.startedAt) / animation.duration);
          if (progress < 0.66) {
            const local = progress / 0.66; const eased = local * local * (3 - 2 * local);
            diceGroup.rotation.set(
              animation.startEuler.x + TAU * 4 * eased,
              animation.startEuler.y + TAU * 5 * eased,
              animation.startEuler.z + TAU * 3 * eased
            );
          } else {
            if (!animation.settleQuaternion) animation.settleQuaternion = diceGroup.quaternion.clone();
            const local = (progress - 0.66) / 0.34; const eased = 1 - Math.pow(1 - local, 3);
            diceGroup.quaternion.slerpQuaternions(animation.settleQuaternion, animation.target, eased);
          }
          diceGroup.position.y = 0.82 + Math.sin(progress * Math.PI) * 1.15;
          if (progress >= 1) {
            diceGroup.quaternion.copy(animation.target); diceGroup.position.y = 0.82;
            animation = null; const resolve = animationResolve; animationResolve = null; if (resolve) resolve();
          }
        } else if (!waiting) {
          diceGroup.position.y = 0.82 + Math.sin(time * 0.0014) * 0.025;
        }
        render(); frame = requestAnimationFrame(tick);
      };
      const setActive = (value) => {
        active = Boolean(value);
        if (!active) { cancelAnimation(); cancelAnimationFrame(frame); frame = 0; return; }
        resize(); previous = performance.now(); if (!frame) frame = requestAnimationFrame(tick);
      };
      const startWaiting = () => {
        cancelAnimation(); if (reducedMotion()) return;
        waiting = true;
      };
      const animateResult = (roll) => {
        cancelAnimation(); const target = targetFor(roll);
        if (!active || reducedMotion()) { diceGroup.quaternion.copy(target); render(); return Promise.resolve(); }
        animation = {
          startedAt: performance.now(), duration: 1900, target,
          startEuler: { x: diceGroup.rotation.x, y: diceGroup.rotation.y, z: diceGroup.rotation.z }, settleQuaternion: null
        };
        return new Promise((resolve) => { animationResolve = resolve; });
      };
      if (globalThis.ResizeObserver) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); }
      return {
        available: true, setActive, startWaiting, animateResult, cancelAnimation, resize,
        dispose() {
          setActive(false); resizeObserver?.disconnect();
          scene.traverse((object) => {
            object.geometry?.dispose?.();
            const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
            list.forEach((material) => { material.map?.dispose?.(); material.dispose?.(); });
          });
          renderer.dispose(); renderer.domElement.remove();
        }
      };
    } catch (_) { return fallback(container); }
  }

  globalThis.FitiaDice3D = { create };
})();
