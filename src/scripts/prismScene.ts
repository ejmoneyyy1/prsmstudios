import * as THREE from 'three';

const isSafariBrowser =
  /Safari/i.test(navigator.userAgent) &&
  !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(navigator.userAgent);

function initPrismScenes() {
  const wraps = Array.from(document.querySelectorAll<HTMLElement>('[data-prism-wrap]'));
  if (!wraps.length) return;

  wraps.forEach((wrap) => {
    if (wrap.dataset.prsmSceneInit === 'true') return;
    wrap.dataset.prsmSceneInit = 'true';

    const canvas = wrap.querySelector<HTMLCanvasElement>('[data-prism-canvas]');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    // Linear workflow: explicit sRGB output + linear tone mapping syncs GPU gamma across WebKit/Blink.
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, wrap.clientWidth / wrap.clientHeight, 0.1, 100);
    camera.position.set(0, 0.25, 5.6);

    const prismGeo = new THREE.CylinderGeometry(0.95, 0.95, 2.2, 3, 1, false);
    prismGeo.rotateY(Math.PI / 2);
    const prismMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f6f8ff'),
      roughness: 0.05,
      metalness: 0,
      transmission: 1,
      thickness: 2,
      ior: 1.38,
      transparent: true,
      opacity: 0.95,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    });

    const prism = new THREE.Mesh(prismGeo, prismMat);
    prism.rotation.x = -0.24;
    prism.rotation.z = 0.12;
    scene.add(prism);

    const key = new THREE.DirectionalLight('#ffffff', isSafariBrowser ? 2.9 : 2.4);
    key.position.set(3, 2.5, 4);
    scene.add(key);

    const rim = new THREE.PointLight('#7dd3fc', 1.1, 20);
    rim.position.set(-2.4, 1.8, -2.5);
    scene.add(rim);

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

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      renderer.setSize(w, h);
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
    const clock = new THREE.Clock();
    const tick = () => {
      if (running) {
        const t = clock.getElapsedTime();
        prism.rotation.x += (target.x - prism.rotation.x) * 0.06;
        prism.rotation.y += (target.y - prism.rotation.y) * 0.06;
        prism.rotation.z = 0.12 + Math.sin(t * 0.55) * 0.025;

        c.rotation.z = prism.rotation.y * 0.34;
        m.rotation.z = prism.rotation.y * 0.22;
        y.rotation.z = prism.rotation.y * 0.14;

        renderer.render(scene, camera);

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
        io.disconnect();
        ro.disconnect();
        renderer.dispose();
        prismGeo.dispose();
        prismMat.dispose();
        gradientGeo.dispose();
      },
      { once: true }
    );
  });
}

initPrismScenes();

