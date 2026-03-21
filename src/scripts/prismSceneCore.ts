import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

const isSafariBrowser =
  /Safari/i.test(navigator.userAgent) &&
  !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(navigator.userAgent);

/** Scroll velocity (px) smoothed per frame — drives RGB shift + rotation.y spin */
let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
let scrollVelSmooth = 0;
/** Impulse applied to prism.rotation.y from scroll direction / speed */
let scrollYawBoost = 0;
let scrollListenerAttached = false;

function attachGlobalScrollVelocity() {
  if (typeof window === 'undefined' || scrollListenerAttached) return;
  scrollListenerAttached = true;
  lastScrollY = window.scrollY;
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      const dy = Math.abs(y - lastScrollY);
      const dir = Math.sign(y - lastScrollY);
      lastScrollY = y;
      scrollVelSmooth = Math.max(scrollVelSmooth, dy);
      scrollYawBoost += dir * Math.min(dy, 52) * 0.0004;
      scrollYawBoost = THREE.MathUtils.clamp(scrollYawBoost, -0.055, 0.055);
    },
    { passive: true }
  );
}

function initPrismScenes() {
  attachGlobalScrollVelocity();
  const wraps = Array.from(document.querySelectorAll<HTMLElement>('[data-prism-wrap]'));
  if (!wraps.length) return;

  wraps.forEach((wrap) => {
    if (wrap.dataset.prsmSceneInit === 'true') return;
    wrap.dataset.prsmSceneInit = 'true';

    const canvas = wrap.querySelector<HTMLCanvasElement>('[data-prism-canvas]');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      precision: 'highp',
    } as THREE.WebGLRendererParameters);
    /** Device pixel ratio — active on init + resize so prism edges stay sharp vs large type. */
    const getPrismPixelRatio = () => Math.min(window.devicePixelRatio || 1, 2.5);
    renderer.setPixelRatio(getPrismPixelRatio());
    renderer.setClearColor(0x000000, 0);
    // Full-resolution transmission RT (Safari: sharper refraction than downscaled pass).
    renderer.transmissionResolutionScale = 1;
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    /**
     * Linear color / gamma parity (Safari WebGL can read “grainy” if output space is wrong).
     * sRGB output + linear tone map + exposure lifts glass against WebKit’s darker compositor.
     */
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = isSafariBrowser ? 1.1 : 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, wrap.clientWidth / wrap.clientHeight, 0.1, 100);
    camera.position.set(0, 0.25, 5.6);

    const isVaultPreview = wrap.dataset.prismPreview === 'vault';

    const prismGeo = new THREE.CylinderGeometry(0.95, 0.95, 2.2, 3, 1, false);
    prismGeo.rotateY(Math.PI / 2);
    // Elite glass: transmission + thickness + dispersion (chromatic separation in physical shader)
    const prismMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      wireframe: false,
      flatShading: false,
      transmission: 1,
      thickness: 2,
      dispersion: 0.04,
      roughness: 0,
      metalness: 0.1,
      ior: 1.45,
      transparent: true,
      opacity: 1,
      clearcoat: 0,
    });

    const composer = new EffectComposer(renderer);
    const pr = getPrismPixelRatio();
    composer.setPixelRatio(pr);
    composer.setSize(wrap.clientWidth, wrap.clientHeight);
    composer.addPass(new RenderPass(scene, camera));
    const rgbPass = new ShaderPass(RGBShiftShader);
    /** Post chromatic fringe — baseline matches elite spec; scroll adds intensity */
    const ABERRATION_BASE = 0.04;
    rgbPass.uniforms.amount.value = ABERRATION_BASE;
    rgbPass.uniforms.angle.value = 0;
    composer.addPass(rgbPass);

    const prism = new THREE.Mesh(prismGeo, prismMat);
    prism.rotation.x = -0.24;
    prism.rotation.z = 0.12;
    scene.add(prism);

    const key = new THREE.DirectionalLight('#ffffff', isSafariBrowser ? 2.4 : 2.0);
    key.position.set(3, 2.5, 4);
    scene.add(key);

    // Studio softbox: large-area rect light for edge-rich speculars on transmission.
    const softbox = new THREE.RectAreaLight(0xffffff, 5, 3.8, 2.2);
    softbox.position.set(0, 2.4, 4.2);
    softbox.lookAt(0, 0.2, 0);
    scene.add(softbox);

    // Extra high-angle light for sharp, glassy edge highlights.
    const edgeLight = new THREE.DirectionalLight('#ffffff', 3.5);
    edgeLight.position.set(5, 10, 5);
    scene.add(edgeLight);

    const rim = new THREE.PointLight('#7dd3fc', 1.1, 20);
    rim.position.set(-2.4, 1.8, -2.5);
    scene.add(rim);

    let glint: THREE.PointLight | null = null;
    if (isVaultPreview) {
      glint = new THREE.PointLight(0xffffff, 2.8, 32, 1.5);
      glint.position.set(2.2, 1.4, 3.4);
      scene.add(glint);
    }

    const backWhite = new THREE.PointLight('#ffffff', 2.2, 30);
    backWhite.position.set(0, 0, -5);
    scene.add(backWhite);

    // RGB refraction-like sheets behind the prism
    const gradientGeo = new THREE.PlaneGeometry(7.5, 3.3);
    const c = new THREE.Mesh(
      gradientGeo,
      new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        transparent: true,
        opacity: isSafariBrowser ? 0.168 : 0.14,
      })
    );
    const m = new THREE.Mesh(
      gradientGeo,
      new THREE.MeshBasicMaterial({
        color: '#d946ef',
        transparent: true,
        opacity: isSafariBrowser ? 0.144 : 0.12,
      })
    );
    const y = new THREE.Mesh(
      gradientGeo,
      new THREE.MeshBasicMaterial({
        color: '#facc15',
        transparent: true,
        opacity: isSafariBrowser ? 0.12 : 0.1,
      })
    );
    c.position.set(-0.95, -0.2, -2.8);
    m.position.set(0.4, -0.08, -2.95);
    y.position.set(1.2, 0.08, -3.1);
    scene.add(c, m, y);

    const target = { x: prism.rotation.x, y: prism.rotation.y };
    const onMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      target.y = nx * 0.55;
      target.x = -0.24 + ny * 0.24;
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    const onGlintPointer = (e: PointerEvent) => {
      if (!glint) return;
      const rect = wrap.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        return;
      }
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const tx = nx * 3.4 + 0.6;
      const ty = ny * 2.2 + 0.9;
      const tz = 3.0 + Math.abs(nx) * 0.8;
      glint.position.x += (tx - glint.position.x) * 0.18;
      glint.position.y += (ty - glint.position.y) * 0.18;
      glint.position.z += (tz - glint.position.z) * 0.14;
    };
    if (isVaultPreview) {
      wrap.addEventListener('pointermove', onGlintPointer, { passive: true });
    }

    const resize = () => {
      const innerW: number = window.innerWidth;
      const innerH: number = window.innerHeight;
      const w: number = wrap.clientWidth || innerW;
      const h: number = wrap.clientHeight || innerH;
      const dpr = getPrismPixelRatio();
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h);
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let running = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );
    io.observe(wrap);

    let loadedSignaled = false;
    const timer = new THREE.Timer();
    timer.connect(document);
    const tick = () => {
      if (running) {
        timer.update();
        const t = timer.getElapsed();
        scrollVelSmooth *= 0.9;
        scrollYawBoost *= 0.91;
        const scrollNorm = Math.min(1, scrollVelSmooth / 32);
        const follow = 0.06 + scrollNorm * 0.14;

        prism.rotation.x += (target.x - prism.rotation.x) * follow;
        prism.rotation.y += (target.y - prism.rotation.y) * follow;
        prism.rotation.y += scrollYawBoost;

        if (isVaultPreview) {
          prism.rotation.z = 0.12 + t * 0.055;
        } else {
          prism.rotation.z = 0.12 + Math.sin(t * 0.55) * 0.025;
        }

        c.rotation.z = prism.rotation.y * 0.34;
        m.rotation.z = prism.rotation.y * 0.22;
        y.rotation.z = prism.rotation.y * 0.14;

        const rotMag = Math.hypot(prism.rotation.x + 0.24, prism.rotation.y);
        const scrollBoost = scrollNorm * scrollNorm * 0.028;
        const rotBoost = Math.min(0.004, rotMag * 0.01);
        rgbPass.uniforms.amount.value = ABERRATION_BASE + scrollBoost + rotBoost;
        rgbPass.uniforms.angle.value = prism.rotation.y * 0.55 + Math.sin(t * 0.65) * 0.08;

        composer.render();

        if (!loadedSignaled) {
          loadedSignaled = true;
          window.dispatchEvent(new CustomEvent('prsm:prism-ready'));
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    window.addEventListener(
      'beforeunload',
      () => {
        window.removeEventListener('mousemove', onMove);
        if (isVaultPreview) wrap.removeEventListener('pointermove', onGlintPointer);
        io.disconnect();
        ro.disconnect();
        composer.dispose();
        renderer.dispose();
        prismGeo.dispose();
        prismMat.dispose();
        gradientGeo.dispose();
        timer.dispose();
      },
      { once: true }
    );
  });
}

initPrismScenes();
