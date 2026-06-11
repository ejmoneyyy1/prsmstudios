import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';

const isSafariBrowser =
  /Safari/i.test(navigator.userAgent) &&
  !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(navigator.userAgent);

/** True on touch / phone / tablet — skip heavy post-processing for smooth 60 fps. */
const isMobileDevice =
  window.matchMedia('(pointer: coarse)').matches ||
  window.matchMedia('(max-width: 1024px)').matches;

function initPrismBackground() {
  const mount = document.querySelector<HTMLElement>('[data-prism-bg]');
  const canvas = mount?.querySelector<HTMLCanvasElement>('[data-prism-canvas]');
  if (!mount || !canvas) return;
  if (mount.dataset.prsmBgInit === 'true') return;
  mount.dataset.prsmBgInit = 'true';

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobileDevice,
    alpha: true,
    premultipliedAlpha: false,
  });
  // Mobile: cap at 1× to avoid GPU overload; desktop: up to 2×.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileDevice ? 1 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.transmissionResolutionScale = isMobileDevice ? 0.5 : 1;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 6.5);

  // Mobile: render directly — skip the RGBShift post-processing pipeline entirely.
  const useComposer = !isMobileDevice;
  const composer = useComposer ? new EffectComposer(renderer) : null;
  const rgbPass = useComposer ? new ShaderPass(RGBShiftShader) : null;
  if (composer && rgbPass) {
    composer.addPass(new RenderPass(scene, camera));
    rgbPass.uniforms.amount.value = 0.0008;
    composer.addPass(rgbPass);
  }

  const prismGeo = new THREE.CylinderGeometry(1.05, 1.05, 2.4, 3, 1, false);
  prismGeo.rotateY(Math.PI / 2);
  const prismMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fafafa'),
    wireframe: false,
    flatShading: false,
    transmission: 1,
    thickness: 2.2,
    roughness: 0,
    metalness: 0,
    ior: 1.4,
    // Dispersion adds chromatic aberration through transmission — skip on mobile (GPU cost).
    dispersion: isMobileDevice ? 0 : 0.035,
    clearcoat: isMobileDevice ? 0 : 1,
    clearcoatRoughness: 0,
    opacity: 0.95,
    transparent: true,
  });
  const prism = new THREE.Mesh(prismGeo, prismMat);
  prism.position.set(0, 0.2, 0);
  scene.add(prism);

  const keyLight = new THREE.DirectionalLight('#ffffff', 2.8);
  keyLight.position.set(2.2, 3, 5);
  scene.add(keyLight);

  const back = new THREE.PointLight('#ffffff', 2.2, 20);
  back.position.set(0, 0.2, -4);
  scene.add(back);

  const cyan = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 3.2),
    new THREE.MeshBasicMaterial({
      color: '#22d3ee',
      transparent: true,
      opacity: isSafariBrowser ? 0.12 : 0.1,
    })
  );
  cyan.position.set(-1, 0.05, -3);
  scene.add(cyan);

  const magenta = new THREE.Mesh(
    new THREE.PlaneGeometry(8.1, 3),
    new THREE.MeshBasicMaterial({
      color: '#d946ef',
      transparent: true,
      opacity: isSafariBrowser ? 0.096 : 0.08,
    })
  );
  magenta.position.set(0.75, 0.1, -3.2);
  scene.add(magenta);

  const gold = new THREE.Mesh(
    new THREE.PlaneGeometry(8.3, 2.9),
    new THREE.MeshBasicMaterial({
      color: '#facc15',
      transparent: true,
      opacity: isSafariBrowser ? 0.084 : 0.07,
    })
  );
  gold.position.set(1.2, -0.1, -3.4);
  scene.add(gold);

  // QuickSetter writes targets at full frame rate; we lerp these into an
  // inertial "heavy" response for the physical prism feel.
  const pointerTarget = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0 };
  const setX = gsap.quickSetter(pointerTarget, 'x');
  const setY = gsap.quickSetter(pointerTarget, 'y');
  let speed = 0;
  let px = 0;
  let py = 0;

  let scrollTargetIntensity = 0;
  let scrollIntensity = 0;

  const onScrollIntensity = (e: Event) => {
    const ce = e as CustomEvent<{ intensity?: number }>;
    const val = ce?.detail?.intensity ?? 0;
    scrollTargetIntensity = Math.max(0, Math.min(1, val));
  };
  window.addEventListener('prsm:scroll-intensity', onScrollIntensity as EventListener);

  const onMove = (e: MouseEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    speed = Math.min(1, Math.hypot(nx - px, ny - py) * 2.8);
    px = nx;
    py = ny;
    setX(nx);
    setY(ny);
  };
  window.addEventListener('mousemove', onMove, { passive: true });

  const targetRot = { x: -0.08, y: 0 };
  // Rotation velocity for a heavy, physical spring response.
  let rotVelX = 0;
  let rotVelY = 0;
  const timer = new THREE.Timer();
  timer.connect(document);
  let running = true;

  const io = new IntersectionObserver(
    ([entry]) => {
      running = entry.isIntersecting && document.visibilityState === 'visible';
    },
    { threshold: 0.01 }
  );
  io.observe(document.body);

  // Pause the RAF loop when the tab is hidden — saves GPU/CPU on background tabs.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      running = false;
    } else {
      running = true;
    }
  });

  let signaled = false;
  const render = () => {
    if (running) {
      timer.update();
      const t = timer.getElapsed();
      // Lerp pointer target into an inertial pointer for heavy response.
      pointer.x += (pointerTarget.x - pointer.x) * 0.08;
      pointer.y += (pointerTarget.y - pointer.y) * 0.08;

      targetRot.x = -0.08 - pointer.y * 0.24;
      targetRot.y = pointer.x * 0.38;
      scrollIntensity += (scrollTargetIntensity - scrollIntensity) * 0.06;

      // Physical spring response (velocity + damping) for the prism feel.
      const stiffness = 0.018;
      const damping = 0.84;
      rotVelX = rotVelX * damping + (targetRot.x - prism.rotation.x) * stiffness;
      rotVelY = rotVelY * damping + (targetRot.y - prism.rotation.y) * stiffness;
      prism.rotation.x += rotVelX;
      prism.rotation.y += rotVelY;

      const rotMag = Math.hypot(prism.rotation.x, prism.rotation.y);
      prism.rotation.z = Math.sin(t * 0.36) * 0.04 + rotMag * 0.12 + scrollIntensity * 0.06;

      cyan.rotation.z = prism.rotation.y * 0.28;
      magenta.rotation.z = prism.rotation.y * 0.2;
      gold.rotation.z = prism.rotation.y * 0.12;

      if (useComposer && composer && rgbPass) {
        // Chromatic aberration response: tie RGB split + dispersion to motion.
        const mouseMag = Math.hypot(pointer.x, pointer.y);
        const aberrationTarget =
          0.00045 +
          rotMag * 0.00085 +
          mouseMag * 0.001 +
          scrollIntensity * 0.0012 +
          speed * 0.00025;
        const safariBoost = isSafariBrowser ? 1.2 : 1;
        rgbPass.uniforms.amount.value +=
          (aberrationTarget * safariBoost - rgbPass.uniforms.amount.value) * 0.12;
        prismMat.dispersion = 0.02 + rotMag * 0.05 + scrollIntensity * 0.02;
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
      speed *= 0.88;

      if (!signaled) {
        signaled = true;
        window.dispatchEvent(new CustomEvent('prsm:prism-ready'));
      }
    }
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);

  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileDevice ? 1 : 2));
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    window.dispatchEvent(new CustomEvent('prsm:prism-ready'));
  };
  window.addEventListener('resize', onResize, { passive: true });

  window.addEventListener(
    'beforeunload',
    () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('prsm:scroll-intensity', onScrollIntensity as EventListener);
      io.disconnect();
      prismGeo.dispose();
      prismMat.dispose();
      renderer.dispose();
      timer.dispose();
    },
    { once: true }
  );
}

initPrismBackground();

