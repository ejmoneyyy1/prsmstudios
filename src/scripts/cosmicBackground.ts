import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';

const IS_MOBILE =
  window.matchMedia('(pointer: coarse)').matches ||
  window.matchMedia('(max-width: 1024px)').matches;

const IS_SAFARI =
  /Safari/i.test(navigator.userAgent) &&
  !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(navigator.userAgent);

// 6 large prisms — vx/vy are per-frame auto-rotation in radians (dramatically faster than before).
// Positions deliberately balanced: 3 on the left, 3 on the right.
// z=0 prisms appear largest (closest). z=-4 prisms sit deep for layering.
const PRISMS = [
  { x: -3.0, y:  0.4, z:  0.0, s: 2.20, rx: 0.00, ry: 0.00, vx: 0.0022, vy: 0.0031 }, // far left, front
  { x:  2.8, y:  0.8, z: -0.5, s: 2.00, rx: 0.40, ry: 0.80, vx: 0.0014, vy: 0.0025 }, // far right, near-front
  { x: -1.6, y: -1.0, z: -2.0, s: 1.80, rx: 1.20, ry: 0.30, vx: 0.0028, vy: 0.0018 }, // left-mid, mid-depth
  { x:  1.4, y: -1.2, z: -2.5, s: 2.00, rx: 2.10, ry: 1.50, vx: 0.0016, vy: 0.0036 }, // right-mid, mid-depth
  { x: -2.8, y:  1.4, z: -3.5, s: 1.90, rx: 0.70, ry: 2.20, vx: 0.0032, vy: 0.0014 }, // far left, deep
  { x:  3.0, y: -0.3, z: -4.0, s: 2.10, rx: 1.80, ry: 0.60, vx: 0.0019, vy: 0.0024 }, // far right, deep
] as const;

// Full spectrum shard tints — each shard is randomly assigned one.
const SHARD_COLORS = [
  0x22d3ee, // cyan
  0xd946ef, // magenta
  0xfbbf24, // gold
  0x34d399, // emerald
  0xf87171, // red
  0xa78bfa, // violet
  0xfafafa, // white
] as const;

const SHARD_COUNT = IS_MOBILE ? 28 : 110;

function initCosmicBackground() {
  const mount = document.querySelector<HTMLElement>('[data-prism-bg]');
  const canvas = mount?.querySelector<HTMLCanvasElement>('[data-prism-canvas]');
  if (!mount || !canvas) return;
  if (mount.dataset.prsmBgInit === 'true') return;
  mount.dataset.prsmBgInit = 'true';

  // ── Renderer ───────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !IS_MOBILE,
    alpha: true,
    premultipliedAlpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1 : 1.5));
  renderer.setClearColor(0x000000, 0);
  // Transmission at 0.5 on both — cheaper refraction RT with still-vivid dispersion.
  renderer.transmissionResolutionScale = IS_MOBILE ? 0.35 : 0.5;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ── Scene + Camera ─────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 6.0);

  // ── Post-processing (desktop only) ─────────────────────────────────────────
  const useComposer = !IS_MOBILE && !IS_SAFARI;
  let composer: EffectComposer | null = null;
  let rgbPass: ShaderPass | null = null;
  if (useComposer) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    rgbPass = new ShaderPass(RGBShiftShader);
    rgbPass.uniforms.amount.value = 0.0008;
    composer.addPass(rgbPass);
  }

  // ── Lights ─────────────────────────────────────────────────────────────────
  // Strong white key — source of "white light entering the prism"
  const keyLight = new THREE.DirectionalLight('#ffffff', 3.8);
  keyLight.position.set(2.2, 3, 5);
  scene.add(keyLight);

  // Back fill
  const backLight = new THREE.PointLight('#ffffff', 1.8, 22);
  backLight.position.set(0, 0.2, -4);
  scene.add(backLight);

  // Spectral point lights — give the scene rainbow bias visible through transmission
  const specLights: [string, [number, number, number]][] = [
    ['#ff3366', [-3.0,  1.5, 2.0]],  // red
    ['#ffaa00', [ 3.2,  0.8, 2.5]],  // amber
    ['#22d3ee', [-1.0, -1.8, 3.0]],  // cyan
    ['#a855f7', [ 1.5,  2.2, 2.0]],  // violet
  ];
  for (const [hex, pos] of specLights) {
    const l = new THREE.PointLight(hex, IS_MOBILE ? 1.2 : 2.0, 18);
    l.position.set(...pos);
    scene.add(l);
  }

  // ── Full-spectrum diffusion planes — the visible rainbow cast behind prisms ─
  const makePlane = (hex: string, op: number, x: number, y: number, z: number, rz = 0) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 5),
      new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: IS_SAFARI ? op * 1.4 : op,
        side: THREE.DoubleSide,
      })
    );
    mesh.position.set(x, y, z);
    mesh.rotation.z = rz;
    scene.add(mesh);
    return mesh;
  };

  // 4 planes — the four corners of the visible spectrum. High enough opacity to
  // cast visible color through the prism glass without muddying the scene.
  const planes = [
    makePlane('#22d3ee', 0.22, -3.5,  0.4, -2.5,  0.08), // cyan  — left
    makePlane('#d946ef', 0.20,  3.2,  0.2, -2.8, -0.06), // magenta — right
    makePlane('#ff2255', 0.18, -1.5, -0.4, -3.5,  0.12), // red   — center-left
    makePlane('#facc15', 0.18,  1.6, -0.2, -3.2, -0.08), // gold  — center-right
  ];

  // ── 6 Prisms — shared geometry, shared material ─────────────────────────────
  const prismGeo = new THREE.CylinderGeometry(1.05, 1.05, 2.4, 3, 1, false);
  prismGeo.rotateY(Math.PI / 2);
  const prismMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fafafa'),
    transmission: 1,
    thickness: 2.4,
    roughness: 0,
    metalness: 0,
    ior: 1.52,                               // higher IOR = stronger refraction / more rainbow
    dispersion: IS_MOBILE ? 0 : 0.08,        // 2.3× prev value — vivid spectral split
    clearcoat: IS_MOBILE ? 0 : 1,
    clearcoatRoughness: 0,
    opacity: 0.96,
    transparent: true,
    envMapIntensity: 1.0,
  });

  const prismMeshes = PRISMS.map(cfg => {
    const mesh = new THREE.Mesh(prismGeo, prismMat);
    mesh.position.set(cfg.x, cfg.y, cfg.z);
    mesh.scale.setScalar(cfg.s);
    mesh.rotation.set(cfg.rx, cfg.ry, 0);
    scene.add(mesh);
    return mesh;
  });

  const velX = new Float32Array(6);
  const velY = new Float32Array(6);

  // ── Glass Shards — spectral tints, additive blending, iridescent pulse ────
  // Three size tiers: large feature shards, medium fillers, small sparkles.
  // Each shard has a base opacity and a pulse phase for iridescent twinkling.
  const SHARD_SIZES: [number, number][] = [
    [0.28, 0.90], // large  — clearly visible, catches the eye
    [0.16, 0.55], // medium — density layer
    [0.07, 0.22], // small  — fine sparkle
  ];

  type Shard = {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    vx: number; vy: number; rotV: number;
    baseOpacity: number;
    pulseFreq: number;
    pulsePhase: number;
  };
  const shards: Shard[] = [];
  const shardGeos = SHARD_SIZES.map(([w, h]) => new THREE.PlaneGeometry(w, h));

  for (let i = 0; i < SHARD_COUNT; i++) {
    const color = SHARD_COLORS[i % SHARD_COLORS.length];

    // Distribute across tiers: ~20% large, ~45% medium, ~35% small
    const tier = i % 20 < 4 ? 0 : i % 20 < 13 ? 1 : 2;
    const geo = shardGeos[tier];

    const baseOpacity = IS_MOBILE
      ? 0.12
      : tier === 0 ? 0.42 : tier === 1 ? 0.30 : 0.18;

    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: baseOpacity,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 7.5,
      (Math.random() - 0.5) * 4.8,
      -Math.random() * 3.5 - 0.1
    );
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    scene.add(mesh);
    shards.push({
      mesh, mat,
      vx:         (Math.random() - 0.5) * 0.0014,
      vy:         (Math.random() - 0.5) * 0.0010,
      rotV:       (Math.random() - 0.5) * 0.0032,
      baseOpacity,
      pulseFreq:  0.3 + Math.random() * 0.9,   // 0.3–1.2 Hz — each shard blinks at own rate
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  // ── Input state ────────────────────────────────────────────────────────────
  const pointer     = { x: 0, y: 0 };
  const pointerLerp = { x: 0, y: 0 };
  let speed = 0;
  let px = 0, py = 0;
  let scrollTarget = 0, scrollIntensity = 0;
  let running = true;

  window.addEventListener('mousemove', (e: MouseEvent) => {
    const nx = (e.clientX / window.innerWidth)  * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    speed = Math.min(1, Math.hypot(nx - px, ny - py) * 3.2);
    pointer.x = nx; pointer.y = ny;
    px = nx; py = ny;
  }, { passive: true });

  // Touch support — shards react on mobile too
  window.addEventListener('touchmove', (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    pointer.x = (t.clientX / window.innerWidth)  * 2 - 1;
    pointer.y = (t.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  window.addEventListener('prsm:scroll-intensity', (e: Event) => {
    const ce = e as CustomEvent<{ intensity?: number }>;
    scrollTarget = Math.max(0, Math.min(1, ce.detail?.intensity ?? 0));
  });

  document.addEventListener('visibilitychange', () => {
    running = document.visibilityState === 'visible';
  });

  // ── RAF loop ───────────────────────────────────────────────────────────────
  const timer = new THREE.Timer();
  timer.connect(document);
  let signaled = false;

  // Throttle heavy transmission renders: only render on every frame when moving,
  // drop to every 2nd frame when idle. This halves GPU cost during static views.
  let frameCount = 0;
  let idleFrames = 0;

  const render = () => {
    requestAnimationFrame(render);
    if (!running) return;

    frameCount++;
    const moving = speed > 0.02 || scrollIntensity > 0.05;
    if (!moving) {
      idleFrames++;
      // Skip every other frame when idle (30fps effective)
      if (idleFrames % 2 === 0) return;
    } else {
      idleFrames = 0;
    }

    timer.update();
    const t = timer.getElapsed();

    pointerLerp.x += (pointer.x - pointerLerp.x) * 0.09;
    pointerLerp.y += (pointer.y - pointerLerp.y) * 0.09;
    scrollIntensity += (scrollTarget - scrollIntensity) * 0.06;

    // ── 6 Prisms — independent spring physics ──────────────────────────────
    PRISMS.forEach((cfg, i) => {
      const mesh = prismMeshes[i];
      const depth = 1 / (1 + Math.abs(cfg.z) * 0.30);
      const tRX = -0.08 - pointerLerp.y * 0.22 * depth;
      const tRY =          pointerLerp.x * 0.35 * depth;

      // Stronger spring (0.82 damping, 0.016 stiffness — up from 0.86/0.012)
      velX[i] = velX[i] * 0.82 + (tRX - mesh.rotation.x) * 0.016;
      velY[i] = velY[i] * 0.82 + (tRY - mesh.rotation.y) * 0.016;
      mesh.rotation.x += velX[i] + cfg.vx;
      mesh.rotation.y += velY[i] + cfg.vy;

      // Larger float — more alive feeling (0.18 amplitude, was 0.05)
      mesh.position.y = cfg.y + Math.sin(t * 0.38 + i * 1.4) * 0.18;
      mesh.position.x = cfg.x + Math.sin(t * 0.22 + i * 0.7) * 0.08;
      mesh.position.z = cfg.z - scrollIntensity * (0.35 + i * 0.10);
    });

    // Spectrum planes orbit slightly with prism 0 rotation
    const r0y = prismMeshes[0].rotation.y;
    planes.forEach((p, i) => {
      p.rotation.z = r0y * (0.08 + i * 0.025);
      p.position.x += (Math.sin(t * 0.12 + i) * 0.001);
    });

    // ── Glass Shards ───────────────────────────────────────────────────────
    const hW = Math.tan((38 / 2) * (Math.PI / 180)) * camera.position.z * camera.aspect;
    const hH = Math.tan((38 / 2) * (Math.PI / 180)) * camera.position.z;
    const mwx = pointer.x * hW;
    const mwy = -pointer.y * hH;

    for (const s of shards) {
      s.mesh.position.x += s.vx;
      s.mesh.position.y += s.vy;
      s.mesh.rotation.z += s.rotV;

      if (s.mesh.position.x >  4.5) s.mesh.position.x = -4.5;
      if (s.mesh.position.x < -4.5) s.mesh.position.x =  4.5;
      if (s.mesh.position.y >  3.0) s.mesh.position.y = -3.0;
      if (s.mesh.position.y < -3.0) s.mesh.position.y =  3.0;

      // Iridescent pulse — each shard breathes at its own frequency
      const pulse = 0.5 + 0.5 * Math.sin(t * s.pulseFreq + s.pulsePhase);
      s.mat.opacity = s.baseOpacity * (0.55 + 0.45 * pulse);

      // Strong mouse repulsion — shards scatter like light refracted
      const dx = s.mesh.position.x - mwx;
      const dy = s.mesh.position.y - mwy;
      const dist = Math.hypot(dx, dy);
      const R = 1.8;
      if (dist < R && dist > 0.001) {
        const f = (1 - dist / R) * 0.048;
        s.mesh.position.x += (dx / dist) * f;
        s.mesh.position.y += (dy / dist) * f;
        s.mesh.rotation.z += f * 12;
        // Burst opacity on repel — flash of scattered light
        s.mat.opacity = Math.min(s.baseOpacity * 1.8, 0.95);
      }

      if (scrollIntensity > 0.04) {
        s.mesh.rotation.z += scrollIntensity * 0.014 * (Math.random() < 0.5 ? 1 : -1);
        s.mesh.position.y += scrollIntensity * 0.005 * (Math.random() < 0.5 ? 1 : -1);
      }
    }

    // ── Render ─────────────────────────────────────────────────────────────
    if (composer && rgbPass) {
      const rotMag = Math.hypot(prismMeshes[0].rotation.x, prismMeshes[0].rotation.y);
      const target = 0.0006 + rotMag * 0.001 + speed * 0.0004 + scrollIntensity * 0.0014;
      rgbPass.uniforms.amount.value += (target - rgbPass.uniforms.amount.value) * 0.12;
      prismMat.dispersion = Math.max(0, 0.04 + rotMag * 0.055 + scrollIntensity * 0.022);
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    speed *= 0.88;

    if (!signaled) {
      signaled = true;
      window.dispatchEvent(new CustomEvent('prsm:prism-ready'));
    }
  };
  requestAnimationFrame(render);

  // ── Resize ─────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1 : 1.5));
    renderer.setSize(w, h);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    window.dispatchEvent(new CustomEvent('prsm:prism-ready'));
  }, { passive: true });

  // ── Cleanup ────────────────────────────────────────────────────────────────
  window.addEventListener('beforeunload', () => {
    prismGeo.dispose();
    prismMat.dispose();
    for (const g of shardGeos) g.dispose();
    for (const s of shards) s.mat.dispose();
    composer?.dispose();
    renderer.dispose();
    timer.dispose();
  }, { once: true });
}

initCosmicBackground();
