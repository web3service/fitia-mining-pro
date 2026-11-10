/* FITIA FARM — véritable scène Three.js locale, animale, végétale et tactile. */
(() => {
  'use strict';
  const THREE = globalThis.THREE;

  function create(container, options = {}) {
    if (!THREE) throw new Error('Three.js local est requis.');
    if (!container) throw new Error('Conteneur 3D manquant.');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x263c5a);
    scene.fog = new THREE.FogExp2(0xe8d6ac, 0.0115);
    const camera = new THREE.OrthographicCamera(-12, 12, 12, -12, 0.1, 220);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'farm-webgl-canvas';
    renderer.domElement.setAttribute('aria-label', 'Ferme 3D isométrique. Glisser pour tourner, pincer pour zoomer, toucher un élément pour le sélectionner.');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    container.appendChild(renderer.domElement);

    // ─── Ciel dégradé + environnement IBL (chaud côté soleil) ────────────
    // Dôme en dégradé vertical : zénith bleu vers la brume dorée à l'horizon.
    function skyCanvas(width, height) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#263c5a');
      gradient.addColorStop(0.26, '#3d5a7c');
      gradient.addColorStop(0.46, '#667e93');
      gradient.addColorStop(0.62, '#978f7d');
      gradient.addColorStop(0.74, '#bcab7d');
      gradient.addColorStop(0.85, '#dcc183');
      gradient.addColorStop(0.93, '#f2d48d');
      gradient.addColorStop(1, '#e0a95f');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
      return canvas;
    }
    const skyTexture = new THREE.CanvasTexture(skyCanvas(32, 512));
    skyTexture.colorSpace = THREE.SRGBColorSpace;
    const skyGeometry = new THREE.SphereGeometry(160, 24, 14);
    const skyMaterial = new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false, fog: false });
    const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
    skyDome.name = 'farm-sky-dome';
    scene.add(skyDome);

    // Éclairage image (IBL) : même dégradé + halo soleil, converti via PMREM.
    const envCanvasEl = skyCanvas(512, 256);
    const envCtx = envCanvasEl.getContext('2d');
    const sunU = (Math.atan2(-13.5, -10.5) / (Math.PI * 2) + 0.5) * 512;
    const sunGlow = envCtx.createRadialGradient(sunU, 168, 4, sunU, 168, 118);
    sunGlow.addColorStop(0, 'rgba(255,232,170,0.95)');
    sunGlow.addColorStop(0.35, 'rgba(255,206,120,0.55)');
    sunGlow.addColorStop(1, 'rgba(255,206,120,0)');
    envCtx.fillStyle = sunGlow;
    envCtx.fillRect(0, 0, 512, 256);
    const envEquirect = new THREE.CanvasTexture(envCanvasEl);
    envEquirect.mapping = THREE.EquirectangularReflectionMapping;
    envEquirect.colorSpace = THREE.SRGBColorSpace;
    // IBL optionnel : en cas d'échec PMREM (GPU exotique), la scène reste fonctionnelle.
    let environment = null;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      environment = pmrem.fromEquirectangular(envEquirect).texture;
      pmrem.dispose();
    } catch (error) {
      environment = null;
    }
    if (environment) scene.environment = environment;
    envEquirect.dispose();

    // Soleil : disque lumineux + halo additif orienté vers le centre.
    function radialGlowCanvas() {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const glow = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
      glow.addColorStop(0, 'rgba(255,246,214,1)');
      glow.addColorStop(0.18, 'rgba(255,232,160,0.9)');
      glow.addColorStop(0.45, 'rgba(255,205,110,0.35)');
      glow.addColorStop(1, 'rgba(255,205,110,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128);
      return canvas;
    }
    const glowTexture = new THREE.CanvasTexture(radialGlowCanvas());
    glowTexture.colorSpace = THREE.SRGBColorSpace;
    const sunDirection = new THREE.Vector3(-13.5, 8.5, -10.5).normalize();
    const sunGlowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(72, 72),
      new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0.95 })
    );
    sunGlowPlane.position.copy(sunDirection).multiplyScalar(132);
    sunGlowPlane.lookAt(0, 8, 0);
    sunGlowPlane.name = 'farm-sun-glow';
    scene.add(sunGlowPlane);
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 26),
      new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false })
    );
    sunDisc.position.copy(sunDirection).multiplyScalar(126);
    sunDisc.lookAt(0, 8, 0);
    sunDisc.name = 'farm-sun-disc';
    scene.add(sunDisc);

    const world = new THREE.Group(); scene.add(world);
    const animalsGroup = new THREE.Group(); const cropsGroup = new THREE.Group();
    world.add(animalsGroup, cropsGroup);
    const geometries = {
      islandTop: new THREE.CylinderGeometry(15.5, 14.9, 0.42, 48),
      islandBottom: new THREE.CylinderGeometry(14.9, 12.6, 0.5, 48),
      sphere: new THREE.SphereGeometry(1, 20, 14),
      sphereFine: new THREE.SphereGeometry(1, 28, 20),
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 14),
      cone: new THREE.ConeGeometry(1, 1, 14),
      torus: new THREE.TorusGeometry(1, 0.055, 8, 40)
    };
    const materials = {};
    const material = (key, color, roughness = 0.78, metalness = 0, envMapIntensity = 0.45) => {
      if (!materials[key]) materials[key] = new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity });
      return materials[key];
    };
    const M = {
      grass: material('grass', 0x4f7431, 0.97, 0, 0.22), soil: material('soil', 0x5f3f28, 1, 0, 0.15),
      darkSoil: material('darkSoil', 0x33231a, 1, 0, 0.1), wood: material('wood', 0x86603b, 0.88, 0, 0.35),
      woodDark: material('woodDark', 0x38291f, 0.93, 0, 0.25), barn: material('barn', 0x8a4034, 0.82, 0, 0.4),
      roof: material('roof', 0x2e3439, 0.55, 0.28, 0.75), white: material('white', 0xf1eee2, 0.72, 0, 0.4),
      black: material('black', 0x242526, 0.7, 0, 0.35), pink: material('pink', 0xd9958f, 0.86, 0, 0.25),
      brown: material('brown', 0x855233, 0.92, 0, 0.2), tan: material('tan', 0xb59a72, 0.9, 0, 0.2),
      orange: material('orange', 0xd76d20, 0.84, 0, 0.25), red: material('red', 0xb62f2a, 0.72, 0, 0.3),
      yellow: material('yellow', 0xe0ae3f, 0.83, 0, 0.3), leaf: material('leaf', 0x3d6b2b, 0.94, 0, 0.18),
      leafLight: material('leafLight', 0x5f8a34, 0.94, 0, 0.18), stone: material('stone', 0x8b8c7c, 1, 0, 0.28),
      water: material('water', 0x2e6a84, 0.12, 0.15, 1.15), metal: material('metal', 0x8a9291, 0.32, 0.78, 1.2),
      path: material('path', 0xc7a66d, 1, 0, 0.2), plaster: material('plaster', 0xf0d9aa, 0.9, 0, 0.32),
      blueRoof: material('blueRoof', 0x3a5c70, 0.6, 0.18, 0.7), tractor: material('tractor', 0x477c3b, 0.62, 0.1, 0.5),
      flowerPink: material('flowerPink', 0xe98c9d, 0.85, 0, 0.25), flowerWhite: material('flowerWhite', 0xfff2d4, 0.9, 0, 0.25),
      eye: material('eye', 0x090b09, 0.25, 0, 0.6), hoof: material('hoof', 0x2c2723, 0.9, 0, 0.2)
    };
    const selectMaterial = new THREE.MeshStandardMaterial({ color: 0xf4c95d, emissive: 0x6b4700, emissiveIntensity: 0.65, roughness: 0.5 });
    const readyMaterial = new THREE.MeshStandardMaterial({ color: 0x9be15d, emissive: 0x244d0c, emissiveIntensity: 0.75, roughness: 0.55 });
    const workingMaterial = new THREE.MeshStandardMaterial({ color: 0xf2b84b, emissive: 0x513000, emissiveIntensity: 0.55, roughness: 0.55 });

    function mesh(geometry, mat, parent, position, scale, rotation) {
      const item = new THREE.Mesh(geometry, mat);
      if (position) item.position.set(...position);
      if (scale) item.scale.set(...scale);
      if (rotation) item.rotation.set(...rotation);
      item.castShadow = true; item.receiveShadow = true;
      parent.add(item); return item;
    }
    function box(parent, mat, position, scale, rotation) { return mesh(geometries.box, mat, parent, position, scale, rotation); }
    function ball(parent, mat, position, scale, fine = false) { return mesh(fine ? geometries.sphereFine : geometries.sphere, mat, parent, position, scale); }
    function cylinder(parent, mat, position, scale, rotation) { return mesh(geometries.cylinder, mat, parent, position, scale, rotation); }
    function cone(parent, mat, position, scale, rotation) { return mesh(geometries.cone, mat, parent, position, scale, rotation); }

    const hemi = new THREE.HemisphereLight(0xf3e2c4, 0x4a3f28, 1.35); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd9a3, 3.35);
    sun.position.set(-13.5, 8.5, -10.5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15; sun.shadow.camera.near = 1; sun.shadow.camera.far = 55;
    sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.04; scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fb8d4, 0.35); fill.position.set(14, 9, 12); scene.add(fill);

    // Sol texturé procéduralement : aucune ressource réseau n'est nécessaire dans l'APK.
    function noiseTexture(base, fleck, size = 128, fleck2 = null) {
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
      let seed = 9173;
      const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      const flecks = fleck2 ? [fleck, fleck2] : [fleck];
      for (let i = 0; i < 2400; i += 1) {
        ctx.globalAlpha = 0.08 + random() * 0.2; ctx.fillStyle = flecks[i % flecks.length];
        const radius = 0.3 + random() * 1.5; ctx.fillRect(random() * size, random() * size, radius, radius * 2.1);
      }
      ctx.globalAlpha = 1;
      const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return texture;
    }
    // Terre labourée stratifiée : bandes horizontales, mottes et cailloux.
    function stratifiedSoilTexture(size = 256) {
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#6b4630'; ctx.fillRect(0, 0, size, size);
      let seed = 7717;
      const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      const strata = ['#77543a', '#5a3a27', '#82603f', '#664631', '#715036'];
      let y = 0; let index = 0;
      while (y < size) {
        const band = 6 + random() * 14;
        ctx.globalAlpha = 0.55 + random() * 0.3;
        ctx.fillStyle = strata[index % strata.length];
        ctx.fillRect(0, y, size, band);
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#2e2015';
        ctx.fillRect(0, y + band - 1.4, size, 1.4);
        y += band; index += 1;
      }
      for (let i = 0; i < 950; i += 1) {
        ctx.globalAlpha = 0.12 + random() * 0.22;
        ctx.fillStyle = random() > 0.42 ? '#9a7a52' : '#3f2a1c';
        const r = 0.5 + random() * 1.7;
        ctx.fillRect(random() * size, random() * size, r, r * (0.7 + random() * 0.9));
      }
      ctx.globalAlpha = 1;
      const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return texture;
    }
    const grassTexture = noiseTexture('#5a7034', '#b9cd6d', 128, '#3a5423'); grassTexture.repeat.set(18, 18);
    const soilTexture = stratifiedSoilTexture(256); soilTexture.repeat.set(5, 4);
    const pathTexture = noiseTexture('#c2a26e', '#8e704b', 128, '#e2c98f'); pathTexture.repeat.set(3, 3);
    const lawnMaterial = new THREE.MeshStandardMaterial({ map: grassTexture, color: 0x9faf68, roughness: 0.98, envMapIntensity: 0.22 });
    const fieldMaterial = new THREE.MeshStandardMaterial({ map: soilTexture, color: 0x8f6b4d, roughness: 1, envMapIntensity: 0.16 });
    const pathMaterial = new THREE.MeshStandardMaterial({ map: pathTexture, color: 0xd4b87f, roughness: 1, envMapIntensity: 0.22 });
    materials.lawn = lawnMaterial; materials.field = fieldMaterial; materials.pathTextured = pathMaterial;

    // ─── Assets PBR embarqués (Niveau 2) : chargement local, repli procédural ───
    const pbrTextures = [];
    const textureLoader = new THREE.TextureLoader();
    // Le ciel embarqué remplace le dégradé procédural dès son chargement (IBL régénérée).
    function applySkyTexture(tex) {
      pbrTextures.push(tex);
      tex.colorSpace = THREE.SRGBColorSpace;
      skyMaterial.map = tex; skyMaterial.needsUpdate = true;
      try {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        const pmrem = new THREE.PMREMGenerator(renderer);
        const newEnv = pmrem.fromEquirectangular(tex).texture;
        pmrem.dispose();
        if (environment) environment.dispose();
        environment = newEnv; scene.environment = environment;
        tex.mapping = THREE.UVMapping;
      } catch (error) { /* IBL dégradé conservée */ }
    }
    textureLoader.load('assets/farm3d/sky.jpg', applySkyTexture, undefined, () => {});
    function upgradeToPbr(materialRef, mapUrl, normalUrl, repeatX, repeatY) {
      textureLoader.load(mapUrl, (tex) => {
        pbrTextures.push(tex);
        tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        tex.repeat.set(repeatX, repeatY);
        materialRef.map = tex; materialRef.needsUpdate = true;
      }, undefined, () => {});
      if (normalUrl) textureLoader.load(normalUrl, (tex) => {
        pbrTextures.push(tex);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
        materialRef.normalMap = tex; materialRef.normalScale.set(0.85, 0.85); materialRef.needsUpdate = true;
      }, undefined, () => {});
    }
    upgradeToPbr(lawnMaterial, 'assets/farm3d/grass-albedo.jpg', 'assets/farm3d/grass-normal.jpg', 10, 10);
    upgradeToPbr(fieldMaterial, 'assets/farm3d/soil-albedo.jpg', 'assets/farm3d/soil-normal.jpg', 3, 3);
    upgradeToPbr(pathMaterial, 'assets/farm3d/path-albedo.jpg', 'assets/farm3d/path-normal.jpg', 3, 3);
    upgradeToPbr(materials.wood, 'assets/farm3d/wood-albedo.jpg', 'assets/farm3d/wood-normal.jpg', 1, 1);
    upgradeToPbr(materials.roof, 'assets/farm3d/roof-albedo.jpg', 'assets/farm3d/roof-normal.jpg', 1.5, 1.5);
    upgradeToPbr(materials.metal, 'assets/farm3d/metal-albedo.jpg', 'assets/farm3d/metal-normal.jpg', 1, 1);
    textureLoader.load('assets/farm3d/water-normal.jpg', (tex) => {
      pbrTextures.push(tex);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(5, 5);
      materials.water.normalMap = tex; materials.water.normalScale.set(0.7, 0.7);
      materials.water.roughness = 0.1; materials.water.needsUpdate = true;
    }, undefined, () => {});
    const islandTop = mesh(geometries.islandTop, lawnMaterial, world, [0, -0.32, 0]); islandTop.castShadow = false;
    const islandBottom = mesh(geometries.islandBottom, M.soil, world, [0, -0.78, 0]); islandBottom.castShadow = false;
    box(world, M.soil, [0, -0.1, -1.65], [22.5, 0.55, 16.8]);
    box(world, lawnMaterial, [0, 0.19, -1.65], [22.2, 0.12, 16.5]);

    // Six vraies parcelles labourées avec rangées et bordures en bois.
    const plotPositions = []; const plotMeshes = [];
    for (let i = 0; i < 6; i += 1) {
      const x = -5.4 + (i % 2) * 3.25; const z = -2.4 + Math.floor(i / 2) * 2.55;
      plotPositions.push([x, 0.32, z]);
      const plotMesh = box(world, fieldMaterial, [x, 0.3, z], [2.75, 0.18, 1.95]);
      plotMesh.userData = { kind: 'plot', id: i }; plotMeshes.push(plotMesh);
      for (let row = -1; row <= 1; row += 1) box(world, M.darkSoil, [x + row * 0.7, 0.405, z], [0.14, 0.05, 1.65]);
      box(world, M.wood, [x - 1.44, 0.42, z], [0.12, 0.25, 2.15]);
      box(world, M.wood, [x + 1.44, 0.42, z], [0.12, 0.25, 2.15]);
      box(world, M.wood, [x, 0.42, z - 1.04], [2.95, 0.25, 0.12]);
      box(world, M.wood, [x, 0.42, z + 1.04], [2.95, 0.25, 0.12]);
    }

    function fenceLine(start, count, step, alongX = true) {
      for (let i = 0; i < count; i += 1) {
        const x = start[0] + (alongX ? i * step : 0); const z = start[2] + (alongX ? 0 : i * step);
        box(world, M.woodDark, [x, 0.85, z], [0.16, 1.45, 0.16]);
        cone(world, M.woodDark, [x, 1.64, z], [0.14, 0.25, 0.14]);
      }
      const length = (count - 1) * step;
      const center = [start[0] + (alongX ? length / 2 : 0), 0, start[2] + (alongX ? 0 : length / 2)];
      for (const y of [0.65, 1.2]) box(world, M.wood, [center[0], y, center[2]], alongX ? [length, 0.12, 0.12] : [0.12, 0.12, length]);
    }
    fenceLine([1.2, 0, -1.8], 5, 1.65, true);
    fenceLine([1.2, 0, 5.25], 5, 1.65, true);
    fenceLine([7.8, 0, -1.8], 5, 1.76, false);

    // Grange avec toit à deux pans, portes, croisillons et bottes de paille.
    const barn = new THREE.Group(); barn.position.set(3.8, 0.25, -5.2); barn.userData = { kind: 'building', id: 'barn' }; world.add(barn);
    box(barn, M.barn, [0, 1.45, 0], [4.3, 2.9, 2.8]);
    const gableShape = new THREE.Shape(); gableShape.moveTo(-2.15, 0); gableShape.lineTo(0, 1.55); gableShape.lineTo(2.15, 0); gableShape.closePath();
    geometries.gable = new THREE.ShapeGeometry(gableShape);
    mesh(geometries.gable, M.barn, barn, [0, 2.85, 1.405]);
    mesh(geometries.gable, M.barn, barn, [0, 2.85, -1.405], null, [0, Math.PI, 0]);
    box(barn, M.roof, [-1.12, 3.35, 0], [2.75, 0.18, 3.35], [0, 0, 0.58]);
    box(barn, M.roof, [1.12, 3.35, 0], [2.75, 0.18, 3.35], [0, 0, -0.58]);
    for (let tile = -2; tile <= 2; tile += 1) {
      box(barn, M.metal, [-1.12, 3.44, tile * 0.62], [2.65, 0.025, 0.035], [0, 0, 0.58]);
      box(barn, M.metal, [1.12, 3.44, tile * 0.62], [2.65, 0.025, 0.035], [0, 0, -0.58]);
    }
    box(barn, M.white, [0, 1.25, 1.43], [1.65, 2.45, 0.09]);
    box(barn, M.woodDark, [0, 1.22, 1.5], [1.4, 2.25, 0.08]);
    box(barn, M.white, [0, 1.22, 1.56], [0.11, 2.28, 0.08]);
    box(barn, M.white, [0, 1.22, 1.57], [1.45, 0.1, 0.08], [0, 0, 0.9]);
    box(barn, M.white, [0, 1.22, 1.57], [1.45, 0.1, 0.08], [0, 0, -0.9]);
    for (const x of [-2.05, 2.05]) box(barn, M.white, [x, 1.5, 1.44], [0.13, 2.95, 0.12]);
    const hayGroup = new THREE.Group(); hayGroup.name = 'farm-hay'; world.add(hayGroup);
    for (const x of [-5.25, -4.65]) {
      cylinder(hayGroup, M.yellow, [x, 0.65, -7.5], [0.58, 1.05, 0.58], [Math.PI / 2, 0, 0]);
      for (const dz of [-0.33, 0.33]) mesh(geometries.torus, M.woodDark, hayGroup, [x, 0.65, -7.5 + dz], [0.58, 0.58, 0.58], [0, 0, 0]);
    }

    // Maison de ferme, cheminées et fumée douce.
    const smokePuffs = [];
    const house = new THREE.Group(); house.position.set(-0.35, 0.25, -4.85); house.userData = { kind: 'building', id: 'care' }; world.add(house);
    box(house, M.plaster, [0, 1.05, 0], [2.55, 2.1, 2.1]);
    mesh(geometries.gable, M.plaster, house, [0, 2.05, 1.055], [0.58, 0.67, 1]);
    box(house, M.blueRoof, [-0.66, 2.45, 0], [1.6, 0.14, 2.55], [0, 0, 0.58]);
    box(house, M.blueRoof, [0.66, 2.45, 0], [1.6, 0.14, 2.55], [0, 0, -0.58]);
    box(house, M.woodDark, [0, 0.78, 1.08], [0.58, 1.5, 0.09]);
    for (const x of [-0.82, 0.82]) {
      box(house, M.white, [x, 1.25, 1.09], [0.58, 0.66, 0.08]);
      box(house, M.blueRoof, [x, 1.25, 1.14], [0.44, 0.52, 0.05]);
      box(house, M.white, [x, 1.25, 1.18], [0.04, 0.54, 0.03]);
      box(house, M.white, [x, 1.25, 1.18], [0.46, 0.04, 0.03]);
    }
    box(house, M.barn, [0.68, 3.1, -0.25], [0.38, 1.2, 0.42]);
    box(house, M.white, [0.68, 3.73, -0.25], [0.48, 0.12, 0.52]);
    const smokeMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f2df, transparent: true, opacity: 0.42, roughness: 1, depthWrite: false, envMapIntensity: 0 });
    materials.smoke = smokeMaterial;
    for (let i = 0; i < 4; i += 1) {
      const puff = ball(house, smokeMaterial, [0.68, 3.95 + i * 0.36, -0.25], [0.18 + i * 0.05, 0.15 + i * 0.04, 0.18 + i * 0.05]);
      puff.castShadow = false; puff.userData.smokeIndex = i; smokePuffs.push(puff);
    }

    // Petit tracteur utilitaire près de la grange.
    const tractor = new THREE.Group(); tractor.position.set(9.25, 0.48, -1.5); tractor.rotation.y = -0.35; tractor.userData = { kind: 'building', id: 'tractor' }; world.add(tractor);
    box(tractor, M.tractor, [0, 0.62, 0.2], [1.25, 0.62, 1.55]);
    box(tractor, M.tractor, [0, 1.25, -0.32], [1.05, 1.05, 0.85]);
    box(tractor, M.blueRoof, [0, 1.85, -0.32], [1.3, 0.12, 1.05]);
    box(tractor, M.water, [0, 1.37, 0.13], [0.78, 0.54, 0.04]);
    cylinder(tractor, M.metal, [0.42, 1.22, 0.7], [0.07, 1.15, 0.07]);
    for (const x of [-0.72, 0.72]) for (const z of [-0.52, 0.72]) {
      const rear = z < 0; cylinder(tractor, M.black, [x, rear ? 0.48 : 0.35, z], [rear ? 0.48 : 0.35, 0.24, rear ? 0.48 : 0.35], [0, 0, Math.PI / 2]);
      cylinder(tractor, M.metal, [x * 1.02, rear ? 0.48 : 0.35, z], [rear ? 0.22 : 0.16, 0.26, rear ? 0.22 : 0.16], [0, 0, Math.PI / 2]);
    }
    const tractorBeacon = ball(tractor, M.yellow, [0, 2.02, -0.35], [0.1, 0.12, 0.1]);

    // Puits d'entretien, sélectionnable depuis la scène.
    const well = new THREE.Group(); well.position.set(-8.25, 0.25, 0.5); well.userData = { kind: 'building', id: 'well' }; world.add(well);
    cylinder(well, M.stone, [0, 0.43, 0], [0.78, 0.85, 0.78]);
    cylinder(well, M.water, [0, 0.88, 0], [0.6, 0.04, 0.6]);
    for (const x of [-0.72, 0.72]) box(well, M.woodDark, [x, 1.32, 0], [0.13, 2.2, 0.13]);
    box(well, M.roof, [0, 2.4, 0], [1.75, 0.16, 1.55]);
    box(well, M.wood, [0, 1.75, 0], [1.4, 0.12, 0.12]);

    // Moulin animé et silo métallique.
    const windmill = new THREE.Group(); windmill.position.set(-6.75, 0.25, -4.75); windmill.userData = { kind: 'building', id: 'mill' }; world.add(windmill);
    mesh(new THREE.CylinderGeometry(0.42, 0.78, 4.4, 10), M.stone, windmill, [0, 2.2, 0]);
    cone(windmill, M.roof, [0, 4.7, 0], [0.82, 1.05, 0.82]);
    const rotor = new THREE.Group(); rotor.position.set(0, 3.65, 0.62); windmill.add(rotor);
    cylinder(rotor, M.metal, [0, 0, 0], [0.19, 0.32, 0.19], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i += 1) {
      const blade = new THREE.Group(); blade.rotation.z = i * Math.PI / 2; rotor.add(blade);
      box(blade, M.woodDark, [0, 1.25, 0], [0.12, 2.5, 0.1]);
      box(blade, M.white, [0.28, 1.55, 0], [0.48, 1.45, 0.07], [0, 0, -0.12]);
    }
    const silo = new THREE.Group(); silo.position.set(7.25, 0, -4.5); silo.userData = { kind: 'building', id: 'silo' }; world.add(silo);
    cylinder(silo, M.metal, [0, 1.65, 0], [0.9, 2.9, 0.9]);
    cone(silo, M.roof, [0, 3.55, 0], [1.02, 0.85, 1.02]);
    for (const y of [0.75, 1.55, 2.35]) mesh(geometries.torus, M.white, silo, [0, y, 0], [0.91, 0.91, 0.91], [Math.PI / 2, 0, 0]);

    // Separate paints prevent one building's customization from changing the rest of the scene.
    const buildingPaint = {};
    for (const [key, group, source] of [['barn', barn, M.barn], ['care', house, M.plaster], ['mill', windmill, M.stone], ['well', well, M.stone], ['silo', silo, M.metal], ['tractor', tractor, M.tractor]]) {
      const paint = source.clone(); buildingPaint[key] = paint; materials[`paint_${key}`] = paint;
      group.traverse(item => { if (item.isMesh && item.material === source) item.material = paint; });
    }

    function tree(x, z, scale = 1) {
      const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); world.add(group);
      cylinder(group, M.woodDark, [0, 1.25, 0], [0.24, 2.5, 0.24]);
      cylinder(group, M.woodDark, [-0.32, 2.05, 0], [0.1, 1.1, 0.1], [0, 0, -0.65]);
      cylinder(group, M.woodDark, [0.34, 2.1, -0.08], [0.09, 1, 0.09], [0.25, 0, 0.7]);
      ball(group, M.leaf, [0, 3.1, 0], [1.25, 1.4, 1.2]);
      ball(group, M.leafLight, [-0.75, 2.85, 0.15], [0.9, 1, 0.85]);
      ball(group, M.leaf, [0.75, 2.75, -0.15], [0.95, 1.05, 0.9]);
      ball(group, M.leafLight, [0.15, 3.8, 0], [0.85, 0.9, 0.8]);
      if (scale > 0.95) for (const p of [[-0.65, 2.75, 0.75], [0.65, 3.1, 0.7], [0.1, 3.65, 0.65]]) ball(group, M.red, p, [0.11, 0.11, 0.11]);
    }
    [[-10, -5, 1.1], [-10.5, 3, 0.9], [13, -3, 1], [13, 4.5, 1.2], [-10, -9.5, 0.85], [7, 8, 0.9]].forEach((v) => tree(...v));
    // Chemin de terre, mare, fleurs et relief au fond de la scène.
    for (let i = 0; i < 17; i += 1) {
      const z = 6.5 - i * 0.58; const x = -0.25 + Math.sin(i * 0.38) * 0.28;
      cylinder(world, pathMaterial, [x, 0.31, z], [0.76, 0.07, 0.66], [0, Math.sin(i) * 0.12, 0]);
    }
    for (let i = 0; i < 7; i += 1) cylinder(world, pathMaterial, [0.45 + i * 0.53, 0.32, -1.55 - i * 0.24], [0.68, 0.07, 0.58]);
    cylinder(world, M.stone, [-8.25, 0.27, 4.7], [1.75, 0.11, 1.2]);
    cylinder(world, M.water, [-8.25, 0.34, 4.7], [1.52, 0.07, 1.02]);
    for (let i = 0; i < 12; i += 1) {
      const angle = i / 12 * Math.PI * 2;
      ball(world, M.stone, [-8.25 + Math.cos(angle) * 1.65, 0.43, 4.7 + Math.sin(angle) * 1.12], [0.24, 0.18, 0.22]);
    }
    function flower(x, z, index) {
      cylinder(world, M.leaf, [x, 0.52, z], [0.025, 0.42, 0.025]);
      ball(world, index % 2 ? M.flowerPink : M.flowerWhite, [x, 0.77, z], [0.1, 0.08, 0.1]);
      ball(world, M.yellow, [x, 0.81, z], [0.035, 0.035, 0.035]);
    }
    [[-1.8, -5.7], [-1.4, -5.9], [1.1, -5.8], [1.45, -5.55], [-1.3, 5.8], [-1.6, 5.45], [1.1, 5.9], [1.35, 5.5], [-9.7, 1.2], [9.4, 1.4], [-8.9, -6.8], [8.8, -6.5]].forEach((p, index) => flower(p[0], p[1], index));
    // Ligne d'arbres en retrait de l'îlot : silhouettes discrètes, jamais dominantes.
    const farLeafMaterial = material('farLeaf', 0x33462c, 1, 0, 0.05);
    const farTrunkMaterial = material('farTrunk', 0x2e241c, 1, 0, 0.05);
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2 + ((i * 37) % 13) * 0.02;
      const radius = 10.6 + (i % 3) * 1.1;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius - 3.5;
      if (tz > 6) continue;
      const s = 1.15 + ((i * 53) % 11) / 10 * 0.8;
      const trunk = cylinder(world, farTrunkMaterial, [tx, s * 0.55, tz], [s * 0.16, s * 1.1, s * 0.16]);
      const crown = ball(world, farLeafMaterial, [tx, s * 1.35, tz], [s * 0.75, s * 0.95, s * 0.75]);
      trunk.castShadow = false; crown.castShadow = false;
    }
    box(world, M.woodDark, [6.6, 0.65, 4.1], [1.7, 0.65, 0.85]);
    box(world, M.water, [6.6, 1, 4.1], [1.45, 0.06, 0.62]);

    const clouds = [];
    const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f2e4, transparent: true, opacity: 0.6, roughness: 1, depthWrite: false, envMapIntensity: 0 });
    materials.cloud = cloudMaterial;
    for (let i = 0; i < 4; i += 1) {
      const cloud = new THREE.Group(); cloud.position.set(-18 + i * 12, 14.5 + i % 3, -15 - i * 3.5); scene.add(cloud);
      const pufA = ball(cloud, cloudMaterial, [0, 0, 0], [2.4, 0.75, 1]); pufA.castShadow = false;
      const pufB = ball(cloud, cloudMaterial, [1.8, 0.15, 0], [1.7, 0.65, 0.85]); pufB.castShadow = false;
      const pufC = ball(cloud, cloudMaterial, [-1.7, -0.1, 0], [1.5, 0.55, 0.8]); pufC.castShadow = false;
      clouds.push(cloud);
    }

    function animalRoot(kind, id, species, position, phase) {
      const root = new THREE.Group(); root.position.set(position[0], 0.32, position[1]);
      root.rotation.y = (phase % 5) * 0.55 - 0.8;
      root.userData = { kind, id, species, phase, homeX: position[0], homeZ: position[1], baseRotation: root.rotation.y, head: null, tail: null, legs: [], body: null, data: null };
      const halo = mesh(geometries.torus, workingMaterial, root, [0, 0.07, 0], [1.15, 1.15, 1.15], [Math.PI / 2, 0, 0]);
      halo.visible = false; halo.castShadow = false; root.userData.halo = halo;
      animalsGroup.add(root); return root;
    }
    function createChicken(id, position, phase) {
      const root = animalRoot('animal', id, 'chicken', position, phase);
      const body = ball(root, M.white, [0, 0.78, 0], [0.48, 0.58, 0.62], true); root.userData.body = body;
      ball(root, M.brown, [-0.4, 0.82, -0.03], [0.13, 0.4, 0.43]); ball(root, M.brown, [0.4, 0.82, -0.03], [0.13, 0.4, 0.43]);
      const head = new THREE.Group(); head.position.set(0, 1.18, 0.35); root.add(head); root.userData.head = head;
      ball(head, M.white, [0, 0.15, 0], [0.32, 0.36, 0.32], true);
      cone(head, M.orange, [0, 0.12, 0.38], [0.13, 0.36, 0.13], [Math.PI / 2, 0, 0]);
      for (const x of [-0.2, 0.2]) ball(head, M.eye, [x, 0.25, 0.22], [0.045, 0.055, 0.045]);
      for (let i = 0; i < 3; i += 1) ball(head, M.red, [0, 0.48, -0.13 + i * 0.13], [0.09, 0.13, 0.09]);
      ball(head, M.red, [0, -0.08, 0.25], [0.09, 0.16, 0.08]);
      for (const x of [-0.2, 0.2]) {
        const leg = cylinder(root, M.orange, [x, 0.28, 0.08], [0.045, 0.48, 0.045]); root.userData.legs.push(leg);
        box(root, M.orange, [x, 0.06, 0.18], [0.2, 0.05, 0.3]);
      }
      for (let i = -1; i <= 1; i += 1) cone(root, M.brown, [i * 0.17, 1.03 + Math.abs(i) * 0.06, -0.55], [0.15, 0.65, 0.15], [-0.85, 0, i * 0.18]);
      root.scale.setScalar(0.82); return root;
    }
    function createCow(id, position, phase) {
      const root = animalRoot('animal', id, 'cow', position, phase);
      const body = ball(root, M.white, [0, 1.15, 0], [0.82, 0.68, 1.15], true); root.userData.body = body;
      for (const patch of [[-0.67, 1.28, 0.25, 0.25], [0.65, 1.02, -0.35, 0.3], [-0.35, 1.7, -0.2, 0.27]]) {
        ball(root, M.black, [patch[0], patch[1], patch[2]], [0.18, patch[3], patch[3] * 1.25]);
      }
      const head = new THREE.Group(); head.position.set(0, 1.42, 1.05); root.add(head); root.userData.head = head;
      ball(head, M.white, [0, 0.05, 0.15], [0.48, 0.52, 0.55], true);
      ball(head, M.pink, [0, -0.16, 0.56], [0.42, 0.25, 0.3]);
      for (const x of [-0.3, 0.3]) {
        ball(head, M.eye, [x, 0.2, 0.48], [0.055, 0.065, 0.04]);
        cone(head, M.tan, [x * 1.25, 0.5, 0.05], [0.09, 0.45, 0.09], [0, 0, x > 0 ? -0.65 : 0.65]);
        ball(head, M.white, [x * 1.6, 0.18, 0.05], [0.28, 0.11, 0.17]);
        ball(head, M.black, [x * 0.55, -0.15, 0.81], [0.045, 0.04, 0.025]);
      }
      for (const x of [-0.55, 0.55]) for (const z of [-0.72, 0.72]) {
        const leg = cylinder(root, M.white, [x, 0.52, z], [0.14, 0.9, 0.14]); root.userData.legs.push(leg);
        cylinder(root, M.hoof, [x, 0.09, z + 0.03], [0.16, 0.2, 0.18]);
      }
      ball(root, M.pink, [0, 0.65, -0.25], [0.35, 0.22, 0.35]);
      const tail = new THREE.Group(); tail.position.set(0, 1.45, -1.05); root.add(tail); root.userData.tail = tail;
      cylinder(tail, M.white, [0, -0.45, -0.05], [0.045, 0.95, 0.045], [0.15, 0, 0]); ball(tail, M.black, [0, -0.96, -0.12], [0.12, 0.22, 0.12]);
      root.scale.setScalar(0.78); return root;
    }
    function createSheep(id, position, phase) {
      const root = animalRoot('animal', id, 'sheep', position, phase);
      const body = ball(root, M.tan, [0, 1.02, 0], [0.68, 0.6, 0.92]); root.userData.body = body;
      const wool = material('wool', 0xe5e1d2, 1);
      const puffs = [[0, 1.15, 0], [-0.45, 1.15, 0.15], [0.45, 1.15, 0.15], [0, 1.5, 0], [-0.35, 1.4, -0.45], [0.35, 1.4, -0.45], [-0.35, 1.35, 0.5], [0.35, 1.35, 0.5], [0, 1.1, -0.7], [0, 1.12, 0.7]];
      puffs.forEach((p, index) => ball(root, wool, p, [0.5, 0.45, 0.52], index === 0));
      const head = new THREE.Group(); head.position.set(0, 1.25, 0.9); root.add(head); root.userData.head = head;
      ball(head, M.black, [0, 0, 0.18], [0.34, 0.43, 0.43], true);
      for (const x of [-0.25, 0.25]) {
        ball(head, M.eye, [x, 0.12, 0.46], [0.045, 0.055, 0.035]);
        ball(head, M.black, [x * 1.45, 0.2, 0.05], [0.25, 0.08, 0.15]);
      }
      for (const x of [-0.42, 0.42]) for (const z of [-0.55, 0.55]) {
        const leg = cylinder(root, M.black, [x, 0.43, z], [0.095, 0.72, 0.095]); root.userData.legs.push(leg);
        cylinder(root, M.hoof, [x, 0.08, z], [0.11, 0.17, 0.13]);
      }
      root.scale.setScalar(0.83); return root;
    }

    function createGoat(id, position, phase) {
      const root = animalRoot('animal', id, 'goat', position, phase);
      root.userData.body = ball(root, M.tan, [0, 1.02, 0], [0.58, 0.53, 0.85]);
      const head = new THREE.Group(); head.position.set(0, 1.35, 0.8); root.add(head); root.userData.head = head;
      ball(head, M.tan, [0, 0, 0.1], [0.32, 0.42, 0.42]);
      ball(head, M.white, [0, -0.2, 0.4], [0.25, 0.2, 0.25]);
      cone(head, M.white, [0, -0.5, 0.3], [0.12, 0.4, 0.12], [0, 0, Math.PI]);
      for (const x of [-0.28, 0.28]) {
        ball(head, M.eye, [x, 0.1, 0.38], [0.04, 0.05, 0.04]);
        cone(head, M.woodDark, [x, 0.48, -0.03], [0.09, 0.45, 0.09], [0, 0, x > 0 ? -0.25 : 0.25]);
        ball(head, M.tan, [x * 1.5, 0.05, 0], [0.25, 0.08, 0.13]);
      }
      for (const x of [-0.38, 0.38]) for (const z of [-0.55, 0.55]) {
        const leg = cylinder(root, M.tan, [x, 0.43, z], [0.085, 0.78, 0.085]); root.userData.legs.push(leg);
        cylinder(root, M.hoof, [x, 0.08, z], [0.1, 0.17, 0.12]);
      }
      root.scale.setScalar(0.82); return root;
    }
    function createDuck(id, position, phase) {
      const root = animalRoot('animal', id, 'duck', position, phase);
      root.userData.body = ball(root, M.white, [0, 0.68, 0], [0.47, 0.4, 0.7]);
      ball(root, M.tan, [-0.4, 0.73, -0.12], [0.12, 0.25, 0.4]);
      ball(root, M.tan, [0.4, 0.73, -0.12], [0.12, 0.25, 0.4]);
      const head = new THREE.Group(); head.position.set(0, 1.05, 0.42); root.add(head); root.userData.head = head;
      ball(head, M.white, [0, 0.1, 0], [0.27, 0.29, 0.28]);
      box(head, M.orange, [0, 0.02, 0.34], [0.25, 0.08, 0.35]);
      for (const x of [-0.18, 0.18]) ball(head, M.eye, [x, 0.18, 0.18], [0.04, 0.05, 0.04]);
      for (const x of [-0.2, 0.2]) {
        const leg = cylinder(root, M.orange, [x, 0.25, 0], [0.04, 0.35, 0.04]); root.userData.legs.push(leg);
        box(root, M.orange, [x, 0.07, 0.1], [0.22, 0.05, 0.25]);
      }
      root.scale.setScalar(0.82); return root;
    }

    function createCrop(crop, position) {
      const root = new THREE.Group(); root.position.set(...position); root.userData = { kind: 'crop', id: crop.id, species: crop.species, data: crop, phase: Math.random() * 6 };
      const halo = mesh(geometries.torus, readyMaterial, root, [0, 0.12, 0], [1.05, 1.05, 1.05], [Math.PI / 2, 0, 0]);
      halo.visible = false; halo.castShadow = false; root.userData.halo = halo;
      const plants = new THREE.Group(); root.add(plants); root.userData.plants = plants;
      for (let i = 0; i < 9; i += 1) {
        const x = -0.78 + (i % 3) * 0.78; const z = -0.58 + Math.floor(i / 3) * 0.58;
        if (crop.species === 'wheat') {
          const height = 0.65 + (i % 3) * 0.07;
          cylinder(plants, M.leafLight, [x, height / 2, z], [0.026, height, 0.026]);
          cone(plants, M.yellow, [x, height + 0.13, z], [0.085, 0.34, 0.085]);
          for (const side of [-1, 1]) box(plants, M.leaf, [x + side * 0.09, height * 0.55, z], [0.18, 0.025, 0.07], [0, 0, side * 0.5]);
        } else if (crop.species === 'maize') {
          cylinder(plants, M.leaf, [x, 0.55, z], [0.045, 1.1, 0.045]);
          ball(plants, M.yellow, [x + 0.1, 0.62, z], [0.12, 0.24, 0.11]);
          for (const side of [-1, 1]) box(plants, M.leafLight, [x + side * 0.16, 0.53, z], [0.32, 0.035, 0.09], [0, 0, side * 0.38]);
        } else if (crop.species === 'tomato') {
          cylinder(plants, M.leaf, [x, 0.42, z], [0.045, 0.84, 0.045]);
          for (const side of [-1, 1]) {
            box(plants, M.leafLight, [x + side * 0.13, 0.57, z], [0.24, 0.035, 0.12], [0, 0, side * 0.25]);
            ball(plants, M.red, [x + side * 0.12, 0.34, z + 0.05], [0.13, 0.12, 0.13]);
          }
        } else {
          cone(plants, M.orange, [x, 0.16, z], [0.11, 0.36, 0.11], [0, 0, Math.PI]);
          for (let leaf = 0; leaf < 4; leaf += 1) {
            const angle = leaf * Math.PI / 2;
            const item = cone(plants, leaf % 2 ? M.leafLight : M.leaf, [x + Math.cos(angle) * 0.08, 0.43, z + Math.sin(angle) * 0.08], [0.065, 0.48, 0.065]);
            item.rotation.z = Math.cos(angle) * 0.32; item.rotation.x = Math.sin(angle) * 0.32;
          }
        }
      }
      cropsGroup.add(root); return root;
    }

    // Purely visual level rewards. They are never selectable or tradable.
    const rewardFlowers = new THREE.Group(); rewardFlowers.name = 'farm-reward-flowers'; world.add(rewardFlowers);
    for (let i = 0; i < 9; i += 1) {
      const x = -2.5 + i * 0.42;
      cylinder(rewardFlowers, M.leaf, [x, 0.48, 6.1], [0.035, 0.35, 0.035]);
      ball(rewardFlowers, i % 2 ? M.flowerPink : M.flowerWhite, [x, 0.69, 6.1], [0.13, 0.12, 0.13]);
    }
    const rewardLanterns = new THREE.Group(); rewardLanterns.name = 'farm-reward-lanterns'; world.add(rewardLanterns);
    for (const x of [-1.6, 1.6]) {
      cylinder(rewardLanterns, M.woodDark, [x, 0.9, 6.25], [0.08, 1.2, 0.08]);
      box(rewardLanterns, M.water, [x, 1.55, 6.25], [0.32, 0.42, 0.32]);
      box(rewardLanterns, M.roof, [x, 1.8, 6.25], [0.42, 0.08, 0.42]);
    }
    rewardFlowers.visible = false; rewardLanterns.visible = false;
    let currentState = null; let stateSignature = ''; let selected = null;
    const selectionRing = mesh(geometries.torus, selectMaterial, world, [0, 0.48, 0], [1.25, 1.25, 1.25], [Math.PI / 2, 0, 0]);
    selectionRing.visible = false; selectionRing.castShadow = false;
    function clearGroup(group) { while (group.children.length) group.remove(group.children[group.children.length - 1]); }
    function setState(state) {
      currentState = state;
      const config = globalThis.FitiaFarmConfig;
      const positions = config.normalizedBuildingPositions(state?.buildingPositions, state?.farmLayout);
      barn.position.set(positions.barn.x, 0.25, positions.barn.z);
      house.position.set(positions.care.x, 0.25, positions.care.z);
      windmill.position.set(positions.mill.x, 0.25, positions.mill.z);
      well.position.set(positions.well.x, 0.25, positions.well.z);
      silo.position.set(positions.silo.x, 0, positions.silo.z);
      tractor.position.set(positions.tractor.x, 0.48, positions.tractor.z);
      const styles = globalThis.FitiaFarmConfig.BUILDING_STYLES;
      for (const [key, paint] of Object.entries(buildingPaint)) {
        const index = state?.buildingStyle?.[key];
        paint.color.setHex(styles[key][Number.isInteger(index) && index >= 0 && index < styles[key].length ? index : 0]);
      }
      const level = globalThis.FitiaFarmConfig.progressLevel(state?.farmProgress);
      rewardFlowers.visible = level >= 2; rewardLanterns.visible = level >= 3;
      const signature = JSON.stringify({ animals: (state?.animals || []).map((a) => [a.id, a.species]), crops: (state?.crops || []).map((c) => [c.id, c.species, c.plot]) });
      if (signature === stateSignature) {
        animalsGroup.children.forEach((root) => { root.userData.data = state.animals.find((a) => a.id === root.userData.id); });
        cropsGroup.children.forEach((root) => { root.userData.data = state.crops.find((c) => c.id === root.userData.id); });
        return;
      }
      stateSignature = signature; clearGroup(animalsGroup); clearGroup(cropsGroup); selected = null; selectionRing.visible = false;
      (state?.animals || []).forEach((animal, index) => {
        const col = index % 3; const row = Math.floor(index / 3);
        const position = [2.35 + col * 1.85, -0.65 + row * 1.55];
        if (animal.species === 'goat') createGoat(animal.id, position, index + 1);
        else if (animal.species === 'duck') createDuck(animal.id, position, index + 1);
        else if (animal.species === 'cow') createCow(animal.id, position, index + 1);
        else if (animal.species === 'sheep') createSheep(animal.id, position, index + 1);
        else createChicken(animal.id, position, index + 1);
      });
      animalsGroup.children.forEach((root) => { root.userData.data = state.animals.find((a) => a.id === root.userData.id); });
      (state?.crops || []).slice(0, 6).forEach((crop, index) => createCrop(crop, plotPositions[Number.isInteger(crop.plot) && crop.plot >= 0 && crop.plot < plotPositions.length ? crop.plot : index]));
      if (typeof options.onStateRendered === 'function') options.onStateRendered();
    }

    // Orthographic isometric projection: 45° azimuth and 35.264° elevation.
    // The user may rotate between quarter-turns; pitch stays isometric.
    const ISO_THETA = Math.PI / 4; const ISO_PHI = Math.acos(1 / Math.sqrt(3));
    let width = 1; let height = 1;
    const orbit = { theta: ISO_THETA, phi: ISO_PHI, radius: 30, target: new THREE.Vector3(0, 0.7, 0) };
    const goal = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius, target: orbit.target.clone() };
    const pointers = new Map(); let pinchDistance = 0; let moved = 0; let downAt = 0; let wasMultiTouch = false;
    const raycaster = new THREE.Raycaster(); const pointerNdc = new THREE.Vector2();
    function clampOrbit() { goal.phi = ISO_PHI; goal.radius = Math.max(7, Math.min(34, goal.radius)); }
    function updateCamera() {
      orbit.theta += (goal.theta - orbit.theta) * 0.095; orbit.phi += (goal.phi - orbit.phi) * 0.095;
      orbit.radius += (goal.radius - orbit.radius) * 0.095; orbit.target.lerp(goal.target, 0.095);
      const sinPhi = Math.sin(orbit.phi); const distance = 40;
      camera.position.set(
        orbit.target.x + distance * sinPhi * Math.sin(orbit.theta),
        orbit.target.y + distance * Math.cos(orbit.phi),
        orbit.target.z + distance * sinPhi * Math.cos(orbit.theta)
      );
      camera.lookAt(orbit.target);
      const aspect = Math.max(0.01, width / height);
      // Keep the same minimum horizontal coverage on narrow phone screens.
      const halfHeight = orbit.radius * Math.tan(21 * Math.PI / 180) * Math.max(1, 1 / aspect);
      camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
      camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
    }
    function pointerDistance() {
      const values = Array.from(pointers.values()); if (values.length < 2) return 0;
      return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    }
    function onPointerDown(event) {
      renderer.domElement.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
      if (pointers.size === 1) { moved = 0; downAt = performance.now(); wasMultiTouch = false; }
      if (pointers.size >= 2) { wasMultiTouch = true; pinchDistance = pointerDistance(); }
    }
    function onPointerMove(event) {
      const previous = pointers.get(event.pointerId); if (!previous) return;
      const dx = event.clientX - previous.x; const dy = event.clientY - previous.y;
      pointers.set(event.pointerId, { ...previous, x: event.clientX, y: event.clientY }); moved += Math.abs(dx) + Math.abs(dy);
      if (pointers.size === 1) { goal.theta -= dx * 0.006; }
      else if (pointers.size >= 2) { const distance = pointerDistance(); if (pinchDistance && distance) goal.radius *= pinchDistance / distance; pinchDistance = distance; }
      clampOrbit();
    }
    function selectAt(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects([animalsGroup, cropsGroup, ...plotMeshes, barn, windmill, tractor, silo, well, house], true);
      let root = null;
      for (const hit of hits) { let candidate = hit.object; while (candidate && !candidate.userData.kind) candidate = candidate.parent; if (candidate?.userData.kind) { root = candidate; break; } }
      selected = root;
      if (root) {
        if (root.userData.kind === 'plot') {
          const crop = (currentState?.crops || []).find((item, index) => (Number.isInteger(item.plot) ? item.plot : index) === root.userData.id);
          if (crop) root = cropsGroup.children.find((item) => item.userData.id === crop.id) || root;
        }
        selected = root;
        selectionRing.visible = true; selectionRing.position.set(root.position.x, 0.52, root.position.z);
        if (typeof options.onSelect === 'function') options.onSelect({ kind: root.userData.kind, id: root.userData.id, species: root.userData.species });
      } else selectionRing.visible = false;
    }
    function onPointerUp(event) {
      const point = pointers.get(event.pointerId); pointers.delete(event.pointerId); pinchDistance = pointerDistance();
      if (point && pointers.size === 0 && !wasMultiTouch && moved < 9 && performance.now() - downAt < 500) selectAt(event);
      else if (pointers.size === 0) goal.theta = ISO_THETA + Math.round((goal.theta - ISO_THETA) / (Math.PI / 2)) * (Math.PI / 2);
    }
    function onPointerCancel(event) { pointers.delete(event.pointerId); pinchDistance = pointerDistance(); wasMultiTouch = true; }
    function onWheel(event) { event.preventDefault(); goal.radius *= Math.exp(event.deltaY * 0.001); clampOrbit(); }
    function onKey(event) {
      if (event.key === 'ArrowLeft') goal.theta += Math.PI / 2; else if (event.key === 'ArrowRight') goal.theta -= Math.PI / 2;
      else if (event.key === 'ArrowUp') goal.radius *= 0.88; else if (event.key === 'ArrowDown') goal.radius *= 1.12;
      else if (event.key === '+' || event.key === '=') goal.radius *= 0.88; else if (event.key === '-') goal.radius *= 1.12;
      else if (event.key === 'Home') focus('overview'); else return;
      event.preventDefault(); clampOrbit();
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('keydown', onKey);

    function focus(view = 'overview') {
      if (view === 'crops') { goal.target.set(-3.6, 0.4, 0.25); goal.radius = 12; goal.theta = ISO_THETA; goal.phi = ISO_PHI; }
      else if (view === 'animals') { goal.target.set(4.3, 0.6, 1.25); goal.radius = 11.5; goal.theta = ISO_THETA; goal.phi = ISO_PHI; }
      else if (view === 'barn') { goal.target.set(3.8, 1.4, -4.2); goal.radius = 10; goal.theta = ISO_THETA; goal.phi = ISO_PHI; }
      else { goal.target.set(0, 0.7, 0); goal.radius = 30; goal.theta = ISO_THETA; goal.phi = ISO_PHI; }
      clampOrbit();
    }
    function zoom(factor) { goal.radius *= factor; clampOrbit(); }
    function rotate(direction) { goal.theta += direction * Math.PI / 2; }

    let active = true; let requestedActive = true; let frame = 0; let lastTime = performance.now();
    function resize() {
      width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false); updateCamera();
    }
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    if (resizeObserver) resizeObserver.observe(container); else globalThis.addEventListener('resize', resize);
    resize(); updateCamera();
    function animate(time) {
      if (!active) return;
      frame = requestAnimationFrame(animate);
      const delta = Math.min(0.05, Math.max(0, (time - lastTime) / 1000)); lastTime = time;
      const seconds = time / 1000; const now = Date.now(); const reduced = options.reducedMotion?.() === true;
      updateCamera();
      if (!reduced) {
        rotor.rotation.z -= delta * 0.55;
        clouds.forEach((cloud, index) => { cloud.position.x += delta * (0.16 + index * 0.025); if (cloud.position.x > 26) cloud.position.x = -26; });
        smokePuffs.forEach((puff, index) => {
          const progress = (seconds * 0.16 + index * 0.24) % 1;
          puff.position.y = 3.85 + progress * 1.65;
          puff.position.x = 0.68 + Math.sin(seconds * 0.45 + index) * 0.13;
          puff.position.z = -0.25 + progress * 0.18;
        });
        tractorBeacon.visible = Math.sin(seconds * 3.2) > -0.25;
        animalsGroup.children.forEach((root) => {
          const data = root.userData; const phase = seconds * 1.6 + data.phase;
          root.position.x = data.homeX + Math.sin(seconds * 0.27 + data.phase) * 0.2;
          root.position.z = data.homeZ + Math.cos(seconds * 0.23 + data.phase) * 0.17;
          root.position.y = 0.32 + Math.sin(phase) * 0.018;
          root.rotation.y = data.baseRotation + Math.sin(seconds * 0.19 + data.phase) * 0.28;
          if (data.body) {
            if (!Number.isFinite(data.body.userData.farmBaseScaleY)) data.body.userData.farmBaseScaleY = data.body.scale.y;
            data.body.scale.y = data.body.userData.farmBaseScaleY * (1 + Math.sin(phase * 0.7) * 0.015);
          }
          if (data.head) { data.head.rotation.x = Math.sin(phase * 0.65) * 0.08 + (data.species === 'chicken' ? Math.max(0, Math.sin(phase * 0.42)) * 0.32 : 0); data.head.rotation.y = Math.sin(phase * 0.35) * 0.14; }
          if (data.tail) data.tail.rotation.z = Math.sin(phase * 1.8) * 0.35;
          data.legs.forEach((leg, index) => { leg.rotation.x = Math.sin(phase + index * Math.PI) * 0.075; });
        });
        cropsGroup.children.forEach((root) => { root.userData.plants.rotation.z = Math.sin(seconds * 1.25 + root.userData.phase) * 0.025; });
      }
      animalsGroup.children.forEach((root) => {
        const produceAt = Number(root.userData.data?.produceAt || 0); const halo = root.userData.halo;
        halo.visible = produceAt > 0; halo.material = produceAt && produceAt <= now ? readyMaterial : workingMaterial;
        halo.rotation.z = seconds * 0.45;
      });
      cropsGroup.children.forEach((root) => {
        const crop = root.userData.data; if (!crop) return;
        const duration = Math.max(1, crop.readyAt - crop.plantedAt); const progress = Math.max(0.08, Math.min(1, (now - crop.plantedAt) / duration));
        root.userData.plants.scale.set(0.55 + progress * 0.45, 0.12 + progress * 0.88, 0.55 + progress * 0.45);
        root.userData.halo.visible = now >= crop.readyAt; root.userData.halo.rotation.z = -seconds * 0.35;
      });
      if (selectionRing.visible) {
        if (selected) selectionRing.position.set(selected.position.x, 0.52, selected.position.z);
        selectionRing.rotation.z = seconds * 0.5;
      }
      renderer.render(scene, camera);
    }
    function syncActive() {
      const next = requestedActive && !document.hidden && container.isConnected;
      if (active === next) return; active = next;
      if (active) { lastTime = performance.now(); frame = requestAnimationFrame(animate); }
      else { cancelAnimationFrame(frame); frame = 0; }
    }
    function setActive(value) { requestedActive = Boolean(value); syncActive(); }
    function onVisibility() { syncActive(); }
    document.addEventListener('visibilitychange', onVisibility);
    frame = requestAnimationFrame(animate);
    function dispose() {
      requestedActive = false; active = false; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility);
      if (resizeObserver) resizeObserver.disconnect(); else globalThis.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown); renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp); renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('wheel', onWheel); renderer.domElement.removeEventListener('keydown', onKey);
      Object.values(geometries).forEach((geometry) => geometry.dispose()); Object.values(materials).forEach((mat) => mat.dispose());
      selectMaterial.dispose(); readyMaterial.dispose(); workingMaterial.dispose(); grassTexture.dispose(); soilTexture.dispose(); pathTexture.dispose();
      skyGeometry.dispose(); skyMaterial.dispose(); skyTexture.dispose();
      sunGlowPlane.geometry.dispose(); sunGlowPlane.material.map.dispose(); sunGlowPlane.material.dispose();
      sunDisc.geometry.dispose(); sunDisc.material.dispose();
      pbrTextures.forEach((tex) => tex.dispose());
      cloudMaterial.dispose(); if (environment) environment.dispose();
      renderer.dispose(); renderer.domElement.remove();
    }
    return Object.freeze({ setState, setActive, focus, zoom, rotate, dispose, renderOnce: () => renderer.render(scene, camera), get canvas() { return renderer.domElement; } });
  }
  globalThis.FitiaFarm3D = { create };
})();
