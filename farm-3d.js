/* FITIA FARM — véritable scène Three.js locale, animale, végétale et tactile. */
(() => {
  'use strict';
  const THREE = globalThis.THREE;

  function create(container, options = {}) {
    if (!THREE) throw new Error('Three.js local est requis.');
    if (!container) throw new Error('Conteneur 3D manquant.');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9bc8dc);
    scene.fog = new THREE.FogExp2(0xa8cbd2, 0.018);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'farm-webgl-canvas';
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D farm. Drag to orbit, pinch or scroll to zoom, tap an animal or crop to select it.');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    container.appendChild(renderer.domElement);

    const world = new THREE.Group(); scene.add(world);
    const animalsGroup = new THREE.Group(); const cropsGroup = new THREE.Group();
    world.add(animalsGroup, cropsGroup);
    const geometries = {
      sphere: new THREE.SphereGeometry(1, 20, 14),
      sphereFine: new THREE.SphereGeometry(1, 28, 20),
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 14),
      cone: new THREE.ConeGeometry(1, 1, 14),
      torus: new THREE.TorusGeometry(1, 0.055, 8, 40)
    };
    const materials = {};
    const material = (key, color, roughness = 0.78, metalness = 0) => {
      if (!materials[key]) materials[key] = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      return materials[key];
    };
    const M = {
      grass: material('grass', 0x557d35, 0.97), soil: material('soil', 0x604329, 1),
      darkSoil: material('darkSoil', 0x39291e, 1), wood: material('wood', 0x765032, 0.91),
      woodDark: material('woodDark', 0x3c2c23, 0.94), barn: material('barn', 0x813b32, 0.84),
      roof: material('roof', 0x353b3c, 0.62, 0.12), white: material('white', 0xf1eee2, 0.8),
      black: material('black', 0x242526, 0.8), pink: material('pink', 0xd9958f, 0.86),
      brown: material('brown', 0x855233, 0.92), tan: material('tan', 0xb59a72, 0.9),
      orange: material('orange', 0xd76d20, 0.86), red: material('red', 0xb62f2a, 0.75),
      yellow: material('yellow', 0xe0ae3f, 0.83), leaf: material('leaf', 0x3f762d, 0.94),
      leafLight: material('leafLight', 0x6b9638, 0.94), stone: material('stone', 0x8b8c7c, 1),
      water: material('water', 0x3d8eaa, 0.18, 0.15), metal: material('metal', 0x7d8786, 0.38, 0.65),
      eye: material('eye', 0x090b09, 0.28), hoof: material('hoof', 0x302a27, 0.93)
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

    const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x526134, 2.15); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d0, 3.1);
    sun.position.set(-12, 20, 10); sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536); sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18; sun.shadow.camera.near = 1; sun.shadow.camera.far = 55;
    sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.035; scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb8d9ff, 0.45); fill.position.set(12, 8, -10); scene.add(fill);

    // Sol texturé procéduralement : aucune ressource réseau n'est nécessaire dans l'APK.
    function noiseTexture(base, fleck, size = 128) {
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
      let seed = 9173;
      const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      for (let i = 0; i < 1900; i += 1) {
        ctx.globalAlpha = 0.08 + random() * 0.2; ctx.fillStyle = fleck;
        const radius = 0.3 + random() * 1.4; ctx.fillRect(random() * size, random() * size, radius, radius * 2.1);
      }
      ctx.globalAlpha = 1;
      const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return texture;
    }
    const grassTexture = noiseTexture('#668c43', '#c3d477'); grassTexture.repeat.set(18, 18);
    const soilTexture = noiseTexture('#69503a', '#281c13'); soilTexture.repeat.set(5, 4);
    const lawnMaterial = new THREE.MeshStandardMaterial({ map: grassTexture, color: 0xb7c9a0, roughness: 0.98 });
    const fieldMaterial = new THREE.MeshStandardMaterial({ map: soilTexture, color: 0xa78a6a, roughness: 1 });
    materials.lawn = lawnMaterial; materials.field = fieldMaterial;
    box(world, lawnMaterial, [0, -0.46, 0], [80, 0.7, 80]);
    box(world, M.soil, [0, -0.1, 0], [18.5, 0.55, 13.5]);
    box(world, lawnMaterial, [0, 0.19, 0], [18.2, 0.12, 13.2]);

    // Six vraies parcelles labourées avec rangées et bordures en bois.
    const plotPositions = [];
    for (let i = 0; i < 6; i += 1) {
      const x = -5.4 + (i % 2) * 3.25; const z = -2.4 + Math.floor(i / 2) * 2.55;
      plotPositions.push([x, 0.32, z]);
      box(world, fieldMaterial, [x, 0.3, z], [2.75, 0.18, 1.95]);
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
    const barn = new THREE.Group(); barn.position.set(3.8, 0.25, -4.45); world.add(barn);
    box(barn, M.barn, [0, 1.45, 0], [4.3, 2.9, 2.8]);
    box(barn, M.roof, [-1.12, 3.35, 0], [2.75, 0.18, 3.35], [0, 0, 0.58]);
    box(barn, M.roof, [1.12, 3.35, 0], [2.75, 0.18, 3.35], [0, 0, -0.58]);
    box(barn, M.white, [0, 1.25, 1.43], [1.65, 2.45, 0.09]);
    box(barn, M.woodDark, [0, 1.22, 1.5], [1.4, 2.25, 0.08]);
    box(barn, M.white, [0, 1.22, 1.56], [0.11, 2.28, 0.08]);
    box(barn, M.white, [0, 1.22, 1.57], [1.45, 0.1, 0.08], [0, 0, 0.9]);
    box(barn, M.white, [0, 1.22, 1.57], [1.45, 0.1, 0.08], [0, 0, -0.9]);
    for (const x of [-2.05, 2.05]) box(barn, M.white, [x, 1.5, 1.44], [0.13, 2.95, 0.12]);
    for (const x of [-2.8, -2.25]) {
      cylinder(world, M.yellow, [x, 0.65, -4.2], [0.58, 1.05, 0.58], [Math.PI / 2, 0, 0]);
      for (const dz of [-0.33, 0.33]) mesh(geometries.torus, M.woodDark, world, [x, 0.65, -4.2 + dz], [0.58, 0.58, 0.58], [0, 0, 0]);
    }

    // Moulin animé et silo métallique.
    const windmill = new THREE.Group(); windmill.position.set(-6.7, 0.25, -4.65); world.add(windmill);
    mesh(new THREE.CylinderGeometry(0.42, 0.78, 4.4, 10), M.stone, windmill, [0, 2.2, 0]);
    cone(windmill, M.roof, [0, 4.7, 0], [0.82, 1.05, 0.82]);
    const rotor = new THREE.Group(); rotor.position.set(0, 3.65, 0.62); windmill.add(rotor);
    cylinder(rotor, M.metal, [0, 0, 0], [0.19, 0.32, 0.19], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i += 1) {
      const blade = new THREE.Group(); blade.rotation.z = i * Math.PI / 2; rotor.add(blade);
      box(blade, M.woodDark, [0, 1.25, 0], [0.12, 2.5, 0.1]);
      box(blade, M.white, [0.28, 1.55, 0], [0.48, 1.45, 0.07], [0, 0, -0.12]);
    }
    cylinder(world, M.metal, [7.1, 1.65, -4.6], [0.9, 2.9, 0.9]);
    cone(world, M.roof, [7.1, 3.55, -4.6], [1.02, 0.85, 1.02]);

    function tree(x, z, scale = 1) {
      const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); world.add(group);
      cylinder(group, M.woodDark, [0, 1.25, 0], [0.24, 2.5, 0.24]);
      ball(group, M.leaf, [0, 3.1, 0], [1.25, 1.4, 1.2]);
      ball(group, M.leafLight, [-0.75, 2.85, 0.15], [0.9, 1, 0.85]);
      ball(group, M.leaf, [0.75, 2.75, -0.15], [0.95, 1.05, 0.9]);
      ball(group, M.leafLight, [0.15, 3.8, 0], [0.85, 0.9, 0.8]);
    }
    [[-10, -5, 1.1], [-10.5, 3, 0.9], [10, -3, 1], [10.5, 4.5, 1.2], [-1, -8, 0.85], [7, 8, 0.9]].forEach((v) => tree(...v));
    // Chemin de pierres et abreuvoir.
    for (let i = 0; i < 9; i += 1) cylinder(world, M.stone, [-0.2 + Math.sin(i) * 0.22, 0.3, 6.1 - i * 0.65], [0.42, 0.09, 0.32]);
    box(world, M.woodDark, [6.6, 0.65, 4.1], [1.7, 0.65, 0.85]);
    box(world, M.water, [6.6, 1, 4.1], [1.45, 0.06, 0.62]);

    const clouds = [];
    const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f5ed, transparent: true, opacity: 0.72, roughness: 1, depthWrite: false });
    materials.cloud = cloudMaterial;
    for (let i = 0; i < 4; i += 1) {
      const cloud = new THREE.Group(); cloud.position.set(-18 + i * 12, 12 + i % 2, -14 - i * 3); scene.add(cloud);
      ball(cloud, cloudMaterial, [0, 0, 0], [2.4, 0.75, 1]); ball(cloud, cloudMaterial, [1.8, 0.15, 0], [1.7, 0.65, 0.85]);
      ball(cloud, cloudMaterial, [-1.7, -0.1, 0], [1.5, 0.55, 0.8]); clouds.push(cloud);
    }

    function animalRoot(kind, id, species, position, phase) {
      const root = new THREE.Group(); root.position.set(position[0], 0.32, position[1]);
      root.rotation.y = (phase % 5) * 0.55 - 0.8;
      root.userData = { kind, id, species, phase, head: null, tail: null, legs: [], body: null, data: null };
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

    let currentState = null; let stateSignature = ''; let selected = null;
    const selectionRing = mesh(geometries.torus, selectMaterial, world, [0, 0.48, 0], [1.25, 1.25, 1.25], [Math.PI / 2, 0, 0]);
    selectionRing.visible = false; selectionRing.castShadow = false;
    function clearGroup(group) { while (group.children.length) group.remove(group.children[group.children.length - 1]); }
    function setState(state) {
      currentState = state;
      const signature = JSON.stringify({ animals: (state?.animals || []).map((a) => [a.id, a.species]), crops: (state?.crops || []).map((c) => [c.id, c.species]) });
      if (signature === stateSignature) {
        animalsGroup.children.forEach((root) => { root.userData.data = state.animals.find((a) => a.id === root.userData.id); });
        cropsGroup.children.forEach((root) => { root.userData.data = state.crops.find((c) => c.id === root.userData.id); });
        return;
      }
      stateSignature = signature; clearGroup(animalsGroup); clearGroup(cropsGroup); selected = null; selectionRing.visible = false;
      (state?.animals || []).forEach((animal, index) => {
        const col = index % 3; const row = Math.floor(index / 3);
        const position = [2.35 + col * 1.85, -0.65 + row * 1.55];
        if (animal.species === 'cow') createCow(animal.id, position, index + 1);
        else if (animal.species === 'sheep') createSheep(animal.id, position, index + 1);
        else createChicken(animal.id, position, index + 1);
      });
      animalsGroup.children.forEach((root) => { root.userData.data = state.animals.find((a) => a.id === root.userData.id); });
      (state?.crops || []).slice(0, 6).forEach((crop, index) => createCrop(crop, plotPositions[index]));
      if (typeof options.onStateRendered === 'function') options.onStateRendered();
    }

    // Orbite tactile et souris, avec inertie douce et zoom par pincement.
    const orbit = { theta: 0.68, phi: 0.92, radius: 23, target: new THREE.Vector3(0, 0.5, 0) };
    const goal = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius, target: orbit.target.clone() };
    const pointers = new Map(); let pinchDistance = 0; let moved = 0; let downAt = 0;
    const raycaster = new THREE.Raycaster(); const pointerNdc = new THREE.Vector2();
    function clampOrbit() { goal.phi = Math.max(0.32, Math.min(1.35, goal.phi)); goal.radius = Math.max(7, Math.min(34, goal.radius)); }
    function updateCamera() {
      orbit.theta += (goal.theta - orbit.theta) * 0.095; orbit.phi += (goal.phi - orbit.phi) * 0.095;
      orbit.radius += (goal.radius - orbit.radius) * 0.095; orbit.target.lerp(goal.target, 0.095);
      const sinPhi = Math.sin(orbit.phi);
      camera.position.set(
        orbit.target.x + orbit.radius * sinPhi * Math.sin(orbit.theta),
        orbit.target.y + orbit.radius * Math.cos(orbit.phi),
        orbit.target.z + orbit.radius * sinPhi * Math.cos(orbit.theta)
      );
      camera.lookAt(orbit.target);
    }
    function pointerDistance() {
      const values = Array.from(pointers.values()); if (values.length < 2) return 0;
      return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    }
    function onPointerDown(event) {
      renderer.domElement.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
      moved = 0; downAt = performance.now(); if (pointers.size === 2) pinchDistance = pointerDistance();
    }
    function onPointerMove(event) {
      const previous = pointers.get(event.pointerId); if (!previous) return;
      const dx = event.clientX - previous.x; const dy = event.clientY - previous.y;
      pointers.set(event.pointerId, { ...previous, x: event.clientX, y: event.clientY }); moved += Math.abs(dx) + Math.abs(dy);
      if (pointers.size === 1) { goal.theta -= dx * 0.006; goal.phi += dy * 0.0045; }
      else if (pointers.size >= 2) { const distance = pointerDistance(); if (pinchDistance && distance) goal.radius *= pinchDistance / distance; pinchDistance = distance; }
      clampOrbit();
    }
    function selectAt(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects([animalsGroup, cropsGroup], true);
      let root = null;
      for (const hit of hits) { let candidate = hit.object; while (candidate && !candidate.userData.kind) candidate = candidate.parent; if (candidate?.userData.kind) { root = candidate; break; } }
      selected = root;
      if (root) {
        selectionRing.visible = true; selectionRing.position.set(root.position.x, 0.52, root.position.z);
        if (typeof options.onSelect === 'function') options.onSelect({ kind: root.userData.kind, id: root.userData.id, species: root.userData.species });
      } else selectionRing.visible = false;
    }
    function onPointerUp(event) {
      const point = pointers.get(event.pointerId); pointers.delete(event.pointerId); pinchDistance = pointerDistance();
      if (point && pointers.size === 0 && moved < 9 && performance.now() - downAt < 500) selectAt(event);
    }
    function onWheel(event) { event.preventDefault(); goal.radius *= Math.exp(event.deltaY * 0.001); clampOrbit(); }
    function onKey(event) {
      if (event.key === 'ArrowLeft') goal.theta += 0.12; else if (event.key === 'ArrowRight') goal.theta -= 0.12;
      else if (event.key === 'ArrowUp') goal.phi -= 0.08; else if (event.key === 'ArrowDown') goal.phi += 0.08;
      else if (event.key === '+' || event.key === '=') goal.radius *= 0.88; else if (event.key === '-') goal.radius *= 1.12;
      else if (event.key === 'Home') focus('overview'); else return;
      event.preventDefault(); clampOrbit();
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('keydown', onKey);

    function focus(view = 'overview') {
      if (view === 'crops') { goal.target.set(-3.6, 0.4, 0.25); goal.radius = 12; goal.theta = 0.5; goal.phi = 0.88; }
      else if (view === 'animals') { goal.target.set(4.3, 0.6, 1.25); goal.radius = 11.5; goal.theta = 0.75; goal.phi = 0.92; }
      else if (view === 'barn') { goal.target.set(3.8, 1.4, -4.2); goal.radius = 10; goal.theta = 0.25; goal.phi = 1.02; }
      else { goal.target.set(0, 0.5, 0); goal.radius = 23; goal.theta = 0.68; goal.phi = 0.92; }
      clampOrbit();
    }
    function zoom(factor) { goal.radius *= factor; clampOrbit(); }
    function rotate(direction) { goal.theta += direction * 0.28; }

    let width = 0; let height = 0; let active = true; let requestedActive = true; let frame = 0; let lastTime = performance.now();
    function resize() {
      width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
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
        animalsGroup.children.forEach((root) => {
          const data = root.userData; const phase = seconds * 1.6 + data.phase;
          root.position.y = 0.32 + Math.sin(phase) * 0.018;
          if (data.body) {
            if (!Number.isFinite(data.body.userData.farmBaseScaleY)) data.body.userData.farmBaseScaleY = data.body.scale.y;
            data.body.scale.y = data.body.userData.farmBaseScaleY * (1 + Math.sin(phase * 0.7) * 0.015);
          }
          if (data.head) { data.head.rotation.x = Math.sin(phase * 0.65) * 0.08 + (data.species === 'chicken' ? Math.max(0, Math.sin(phase * 0.42)) * 0.32 : 0); data.head.rotation.y = Math.sin(phase * 0.35) * 0.14; }
          if (data.tail) data.tail.rotation.z = Math.sin(phase * 1.8) * 0.35;
          data.legs.forEach((leg, index) => { leg.rotation.x = Math.sin(phase + index * Math.PI) * 0.025; });
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
      if (selectionRing.visible) selectionRing.rotation.z = seconds * 0.5;
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
      renderer.domElement.removeEventListener('pointerup', onPointerUp); renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel); renderer.domElement.removeEventListener('keydown', onKey);
      Object.values(geometries).forEach((geometry) => geometry.dispose()); Object.values(materials).forEach((mat) => mat.dispose());
      selectMaterial.dispose(); readyMaterial.dispose(); workingMaterial.dispose(); grassTexture.dispose(); soilTexture.dispose();
      renderer.dispose(); renderer.domElement.remove();
    }
    return Object.freeze({ setState, setActive, focus, zoom, rotate, dispose, renderOnce: () => renderer.render(scene, camera), get canvas() { return renderer.domElement; } });
  }
  globalThis.FitiaFarm3D = { create };
})();
