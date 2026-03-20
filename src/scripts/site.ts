import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Flip from 'gsap/Flip';
import SplitText from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, Flip, SplitText);
gsap.defaults({ overwrite: 'auto' });

const isSafariBrowser = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isSafariEngine = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
  return isSafariEngine;
})();

let prismLiftedEl: HTMLElement | null = null;
let prismLiftPlaceholder: Comment | null = null;

declare global {
  interface Window {
    __lenis?: {
      on: (eventName: string, cb: (...args: any[]) => void) => void;
      raf: (time: number) => void;
      __scrollTriggerBound?: boolean;
    };
    __prsmResizeBound?: boolean;
    __prsmPrismReadyBound?: boolean;
    __prsmSplashDone?: boolean;
    __prsmCasesHoverState?: {
      isCursorMode: boolean;
      setOuterX: (x: number) => void;
      setOuterY: (y: number) => void;
      lastX: number;
      lastY: number;
    };
    __prsmCasesHoverMoveBound?: boolean;
    __prsmFlipGhost?: HTMLElement | null;
    __prsmTechStackPingTimer?: number;
    __prsmSplashFailSafeDone?: boolean;
    __prsmEngineStarted?: boolean;
  }
}

function cleanupGsap() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.globalTimeline.clear();
}

function disableNativeViewTransitionsForSafari() {
  if (!isSafariBrowser) return;
  (document as any).startViewTransition = undefined;
}

function liftPrismCanvasBeforeSwap() {
  const prismMount = document.querySelector<HTMLElement>('[data-prism-bg]');
  if (!prismMount || prismLiftedEl) return;
  const parent = prismMount.parentNode;
  if (!parent) return;

  prismLiftPlaceholder = document.createComment('prsm-prism-placeholder');
  parent.insertBefore(prismLiftPlaceholder, prismMount);
  document.body.appendChild(prismMount);
  prismLiftedEl = prismMount;
}

function restorePrismCanvasAfterSwap() {
  if (!prismLiftedEl || !prismLiftPlaceholder) return;
  const parent = prismLiftPlaceholder.parentNode;
  if (!parent) return;
  parent.insertBefore(prismLiftedEl, prismLiftPlaceholder);
  prismLiftPlaceholder.remove();
  prismLiftedEl = null;
  prismLiftPlaceholder = null;
}

function initLenis() {
  if (typeof window === 'undefined') return;
  if (window.__lenis) return;

  const wrapperEl = document.getElementById('lenis-wrapper') as HTMLElement | null;
  const contentEl = document.getElementById('lenis-content') as HTMLElement | null;

  // Mobile optimization:
  // Lenis can cause viewport clipping / odd scroll behavior on iOS & small screens.
  // Prefer native scrolling on coarse-pointer devices and <=768px widths.
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const smallScreen = window.matchMedia('(max-width: 768px)').matches;
  if (prefersReducedMotion || coarsePointer || smallScreen) return;

  // Don't let Lenis block the site (e.g. if chunks time out).
  import('lenis')
    .then((mod) => {
      const Lenis = mod.default;
      window.__lenis = new Lenis({
        wrapper: wrapperEl ?? undefined,
        content: contentEl ?? undefined,
        duration: 1.15,
        smoothWheel: true,
        smoothTouch: false,
        lerp: 0.08,
        smooth: 1.5,
      } as any);

      const raf = (time: number) => {
        window.__lenis?.raf(time);
        requestAnimationFrame(raf);
      };

      requestAnimationFrame(raf);

      // If `bindLenisToScrollTrigger()` ran earlier, ensure we bind now that Lenis exists.
      bindLenisToScrollTrigger();
    })
    .catch(() => {
      // Fail open: the rest of the page should still work.
    });
}

function initSplashLoader() {
  const splash = document.querySelector<HTMLElement>('[data-splash]');
  const counter = document.querySelector<HTMLElement>('[data-splash-counter]');
  const splashScreen = document.querySelector<HTMLElement>('[data-splash-screen]');

  if (!splash) return;

  // If splash has already run once, remove any fresh markup immediately.
  if (window.__prsmSplashDone) {
    splash.remove();
    return;
  }

  // If expected nodes are missing, fail open.
  if (!counter || !splashScreen) {
    splash.remove();
    window.__prsmSplashDone = true;
    return;
  }

  function closeSplash(node: HTMLElement) {
    gsap.to(counter, { opacity: 0, duration: 0.4, ease: 'power2.out' });
    gsap.to(splashScreen, {
      clipPath: 'inset(100% 0 0 0)',
      duration: 1,
      ease: 'expo.inOut',
    });
    gsap.to(node, {
      opacity: 0,
      duration: 0.3,
      delay: 0.85,
      onComplete: () => {
        node.remove();
        window.__prsmSplashDone = true;
      },
    });
  }

  const progress = { value: 0 };
  const tween = gsap.to(progress, {
    value: 100,
    duration: 1.4,
    ease: 'steps(14)',
    onUpdate: () => {
      counter.textContent = String(Math.round(progress.value));
    },
    onComplete: () => {
      counter.textContent = '100';
      closeSplash(splash);
    },
  });

  // Hard fail-safe: never allow the loader to block the app.
  const hardTimeout = window.setTimeout(() => {
    tween.kill();
    counter.textContent = '100';
    closeSplash(splash);
  }, 2800);

  splash.addEventListener(
    'transitionend',
    () => window.clearTimeout(hardTimeout),
    { once: true }
  );
}

function initSpitzerReveal() {
  const revealTargets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-reveal="chars"], [data-reveal="lines"], [data-spitzer-reveal]')
  );
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!revealTargets.length) return;

  revealTargets.forEach((el) => {
    if (el.dataset.splitReady === 'true') return;
    el.dataset.splitReady = 'true';
    const mode = el.dataset.reveal === 'lines' ? 'lines' : 'chars';

    if (isReducedMotion) {
      return;
    }

    const split = SplitText.create(el, {
      type: mode === 'lines' ? 'lines' : 'chars',
      autoSplit: mode === 'lines',
      mask: mode === 'lines' ? 'lines' : 'chars',
      linesClass: 'split-line',
      charsClass: 'split-char',
      onSplit: (self: any) => {
        const targets = mode === 'lines' ? self.lines : self.chars;
        if (!targets?.length) return undefined;

        if (mode === 'lines') {
          return gsap.from(targets, {
            yPercent: 105,
            duration: 0.9,
            ease: 'expo.out',
            stagger: 0.04,
            paused: true,
          });
        }

        return gsap.from(targets, {
          yPercent: -120,
          scale: 1.2,
          duration: 1,
          ease: 'expo.out',
          stagger: 0.01,
          paused: true,
        });
      },
    } as any);

    const runReveal = () => {
      const anySplit = split as any;
      const animation = anySplit?.animation;
      if (animation?.play) {
        animation.play(0);
      }
    };

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: runReveal,
    });
  });

  if (isSafariBrowser) {
    gsap.set('.split-line', {
      overflowX: 'visible',
      overflowY: 'clip',
      paddingBottom: '6px',
      marginBottom: '-6px',
    });
  }
}

function initCityPulseFlip() {
  const cityPulseLink = document.querySelector<HTMLElement>('[data-case-item][data-case-id="city-pulse"]');
  const cityPulseThumb = cityPulseLink?.querySelector<HTMLElement>('[data-case-thumb="city-pulse"]');
  const cityPulseHero = document.querySelector<HTMLElement>('[data-case-hero="city-pulse"]');

  if (cityPulseLink && cityPulseThumb && cityPulseLink.dataset.flipBound !== 'true') {
    cityPulseLink.dataset.flipBound = 'true';
    cityPulseLink.addEventListener('click', () => {
      const ghost = cityPulseThumb.cloneNode(true) as HTMLElement;
      ghost.className = cityPulseThumb.className;
      const rect = cityPulseThumb.getBoundingClientRect();
      gsap.set(ghost, {
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: 400,
        borderRadius: 16,
        pointerEvents: 'none',
      });
      document.body.appendChild(ghost);
      window.__prsmFlipGhost = ghost;
      sessionStorage.setItem('prsm:city-pulse-flip', '1');
    });
  }

  const hasPendingFlip = sessionStorage.getItem('prsm:city-pulse-flip') === '1';
  const ghost = window.__prsmFlipGhost;
  if (!hasPendingFlip || !ghost || !cityPulseHero) return;

  sessionStorage.removeItem('prsm:city-pulse-flip');
  const grainLayer = document.querySelector<HTMLElement>('.grain-layer');
  const baseGrainOpacity = grainLayer
    ? Number.parseFloat(window.getComputedStyle(grainLayer).opacity || '1')
    : 1;

  const titleTargets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-city-overlap="title"]')
  );
  const metaTargets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-city-overlap="meta"]')
  );
  const bodyTargets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-city-overlap="body"]')
  );

  const animateTitle = () => {
    titleTargets.forEach((el) => {
      if (el.dataset.overlapPlayed === 'true') return;
      el.dataset.overlapPlayed = 'true';
      const split = SplitText.create(el, {
        type: 'chars',
        mask: 'chars',
        charsClass: 'split-char',
      } as any);
      const chars = (split as any).chars;
      if (!chars?.length) return;
      gsap.from(chars, {
        yPercent: -120,
        scale: 1.2,
        stagger: 0.01,
        duration: 1.2,
        ease: 'expo.out',
      });
    });
  };

  const animateMeta = () => {
    metaTargets.forEach((el) => {
      if (el.dataset.overlapPlayed === 'true') return;
      el.dataset.overlapPlayed = 'true';
      const split = SplitText.create(el, {
        type: 'lines',
        autoSplit: true,
        mask: 'lines',
        linesClass: 'split-line',
      } as any);
      const lines = (split as any).lines;
      if (!lines?.length) return;
      gsap.from(lines, {
        yPercent: 105,
        stagger: 0.03,
        duration: 0.8,
        ease: 'power4.out',
      });
    });
  };

  const animateBody = () => {
    bodyTargets.forEach((el) => {
      if (el.dataset.overlapPlayed === 'true') return;
      el.dataset.overlapPlayed = 'true';
      const split = SplitText.create(el, {
        type: 'lines',
        autoSplit: true,
        mask: 'lines',
        linesClass: 'split-line',
      } as any);
      const lines = (split as any).lines;
      if (!lines?.length) return;
      gsap.from(lines, {
        yPercent: 105,
        stagger: 0.04,
        duration: 0.9,
        ease: 'expo.out',
      });
    });
  };

  const state = Flip.getState(ghost);
  cityPulseHero.appendChild(ghost);
  gsap.set(ghost, { width: '100%', height: '100%', left: 0, top: 0, position: 'absolute' });
  if (grainLayer) gsap.to(grainLayer, { opacity: baseGrainOpacity + 0.02, duration: 0.2 });
  gsap.delayedCall(0.4, animateTitle);
  gsap.delayedCall(0.52, animateMeta);
  gsap.delayedCall(0.65, animateBody);
  const heroImage = cityPulseHero.querySelector<HTMLElement>('img');
  if (heroImage) {
    gsap.delayedCall(1.0, () => {
      gsap.fromTo(
        heroImage,
        { filter: 'blur(2px)' },
        { filter: 'blur(0px)', duration: 0.1, ease: 'power2.out' }
      );
    });
  }

  Flip.from(state, {
    absolute: true,
    duration: 1.2,
    ease: 'expo.inOut',
    nested: true,
    prune: true,
    onComplete: () => {
      ghost.remove();
      if (grainLayer) gsap.to(grainLayer, { opacity: baseGrainOpacity, duration: 0.28 });
      window.__prsmFlipGhost = null;
    },
  });
}

function initCaseViewMagnetic() {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-case-item]'));
  if (!cards.length) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (prefersReducedMotion || !fineHover) return;

  cards.forEach((card) => {
    if (card.dataset.viewMagneticInit === 'true') return;
    card.dataset.viewMagneticInit = 'true';
    const view = card.querySelector<HTMLElement>('[data-case-view]');
    if (!view) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId = 0;
    const lerpX = 0.3;
    const lerpY = 0.15;

    const animate = () => {
      currentX += (targetX - currentX) * lerpX;
      currentY += (targetY - currentY) * lerpY;
      gsap.set(view, { x: currentX, y: currentY });
      const closeEnough = Math.abs(targetX - currentX) < 0.1 && Math.abs(targetY - currentY) < 0.1;
      if (!closeEnough) {
        rafId = requestAnimationFrame(animate);
      } else {
        rafId = 0;
      }
    };

    card.addEventListener('mousemove', (event) => {
      const rect = card.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      targetX = nx * 8;
      targetY = ny * 6;
      if (!rafId) rafId = requestAnimationFrame(animate);
    });

    card.addEventListener('mouseleave', () => {
      targetX = 0;
      targetY = 0;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      gsap.to(view, {
        x: 0,
        y: 0,
        duration: 0.82,
        ease: 'elastic.out(1.15, 0.42)',
      });
    });
  });
}

function initHeroRefraction() {
  const hero = document.querySelector<HTMLElement>('[data-hero-section]');
  const beam = document.querySelector<HTMLElement>('[data-prsm-beam-in]');
  const fanC = document.querySelector<HTMLElement>('[data-prsm-fan="c"]');
  const fanM = document.querySelector<HTMLElement>('[data-prsm-fan="m"]');
  const fanG = document.querySelector<HTMLElement>('[data-prsm-fan="g"]');
  const fanW = document.querySelector<HTMLElement>('[data-prsm-fan="w"]');

  if (!hero || !beam || !fanC || !fanM || !fanG || !fanW) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const interactive = !prefersReducedMotion && fineHover;

  const baseRot = {
    c: -19,
    m: -4,
    g: 7,
    w: 16,
  };
  const baseOpacity = {
    c: 0.65,
    m: 0.5,
    g: 0.5,
    w: 0.35,
  };
  const fanFinalWidth = {
    c: '44%',
    m: '42%',
    g: '42%',
    w: '40%',
  };

  // Setup transform origins so rotation "fans" look correct.
  gsap.set([fanC, fanM, fanG, fanW], { transformOrigin: 'left center' });
  gsap.set(beam, { rotate: 0, opacity: 0.35 });
  gsap.set(fanC, { rotate: baseRot.c, opacity: baseOpacity.c });
  gsap.set(fanM, { rotate: baseRot.m, opacity: baseOpacity.m });
  gsap.set(fanG, { rotate: baseRot.g, opacity: baseOpacity.g });
  gsap.set(fanW, { rotate: baseRot.w, opacity: baseOpacity.w });

  // Initial "Spitzer" reveal so the lines exist before we start mouse-driven refraction.
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.fromTo(beam, { width: 0, opacity: 0 }, { width: '50%', opacity: 0.9, duration: 0.75 }).to(
    beam,
    { opacity: 0.35, duration: 0.35 },
    '-=0.2'
  );
  tl.fromTo(fanC, { width: 0, opacity: 0 }, { width: fanFinalWidth.c, rotate: baseRot.c, opacity: baseOpacity.c, duration: 0.75 }, '-=0.35');
  tl.fromTo(fanM, { width: 0, opacity: 0 }, { width: fanFinalWidth.m, rotate: baseRot.m, opacity: baseOpacity.m, duration: 0.75 }, '-=0.65');
  tl.fromTo(fanG, { width: 0, opacity: 0 }, { width: fanFinalWidth.g, rotate: baseRot.g, opacity: baseOpacity.g, duration: 0.75 }, '-=0.65');
  tl.fromTo(fanW, { width: 0, opacity: 0 }, { width: fanFinalWidth.w, rotate: baseRot.w, opacity: baseOpacity.w, duration: 0.75 }, '-=0.65');

  let scrollMul = 1;
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => {
      // As the hero scrolls away, reduce the overall intensity a bit.
      scrollMul = gsap.utils.interpolate(1, 0.65, self.progress);
    },
  });

  if (!interactive) return;

  let heroRect = hero.getBoundingClientRect();
  const updateHeroRect = () => {
    heroRect = hero.getBoundingClientRect();
  };
  const ro = new ResizeObserver(updateHeroRect);
  ro.observe(hero);

  const setBeamOpacity = gsap.quickSetter(beam, 'opacity');
  const setFanOpacityC = gsap.quickSetter(fanC, 'opacity');
  const setFanOpacityM = gsap.quickSetter(fanM, 'opacity');
  const setFanOpacityG = gsap.quickSetter(fanG, 'opacity');
  const setFanOpacityW = gsap.quickSetter(fanW, 'opacity');

  const setFanRotateC = gsap.quickSetter(fanC, 'rotate');
  const setFanRotateM = gsap.quickSetter(fanM, 'rotate');
  const setFanRotateG = gsap.quickSetter(fanG, 'rotate');
  const setFanRotateW = gsap.quickSetter(fanW, 'rotate');

  let rafPending = false;
  let lastX = heroRect.left + heroRect.width / 2;
  let lastY = heroRect.top + heroRect.height / 2;

  const onMove = (e: MouseEvent) => {
    lastX = e.clientX;
    lastY = e.clientY;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const cx = heroRect.left + heroRect.width / 2;
      const cy = heroRect.top + heroRect.height / 2;

      const nx = (lastX - cx) / (heroRect.width / 2);
      const ny = (lastY - cy) / (heroRect.height / 2);

      const r = Math.min(1, Math.hypot(nx, ny) / 1.25); // 0 center -> 1 away
      const centerStrength = 1 - r;
      const spectrumStrength = r;

      // Converge into a single beam at center: spectrum lines collapse toward rotate:0 and fade.
      setFanRotateC(baseRot.c * spectrumStrength);
      setFanRotateM(baseRot.m * spectrumStrength);
      setFanRotateG(baseRot.g * spectrumStrength);
      setFanRotateW(baseRot.w * spectrumStrength);

      setFanOpacityC(gsap.utils.interpolate(0.05, baseOpacity.c, spectrumStrength) * scrollMul);
      setFanOpacityM(gsap.utils.interpolate(0.05, baseOpacity.m, spectrumStrength) * scrollMul);
      setFanOpacityG(gsap.utils.interpolate(0.05, baseOpacity.g, spectrumStrength) * scrollMul);
      setFanOpacityW(gsap.utils.interpolate(0.03, baseOpacity.w, spectrumStrength) * scrollMul);

      // Beam grows dominant at center.
      setBeamOpacity(gsap.utils.interpolate(0.2, 0.95, centerStrength) * scrollMul);
    });
  };

  window.addEventListener('mousemove', onMove, { passive: true });
}

function bindRefreshHandlers() {
  if (!window.__prsmResizeBound) {
    window.addEventListener('resize', () => ScrollTrigger.refresh());
    window.__prsmResizeBound = true;
  }

  if (!window.__prsmPrismReadyBound) {
    window.addEventListener('prsm:prism-ready', () => ScrollTrigger.refresh());
    window.__prsmPrismReadyBound = true;
  }
}

function waitForImagesLoaded(timeoutMs = 4000) {
  const images = Array.from(document.images);
  if (!images.length) return Promise.resolve();

  const pending = images.filter((img) => !img.complete);
  if (!pending.length) return Promise.resolve();

  const loadPromises = pending.map(
    (img) =>
      new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      })
  );

  return Promise.race([
    Promise.all(loadPromises).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(() => resolve(), timeoutMs)),
  ]);
}

function initBentoGridHover() {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-bento-card]'));
  cards.forEach((card) => {
    if (card.dataset.bentoHoverInit === 'true') return;
    card.dataset.bentoHoverInit = 'true';

    const media = card.querySelector<HTMLElement>('[data-bento-media]');
    if (!media) return;

    gsap.set(media, { scale: 1 });

    card.addEventListener('mouseenter', () => {
      gsap.to(media, { scale: 1.08, duration: 0.65, ease: 'power4.out' });
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(media, { scale: 1, duration: 0.65, ease: 'power4.out' });
    });
  });
}

function initScrollBoundScaling() {
  const featuredImages = Array.from(document.querySelectorAll<HTMLElement>('[data-featured-image]'));
  featuredImages.forEach((el) => {
    // Start slightly smaller and grow as the user scrolls.
    gsap.set(el, { scale: 0.95 });

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      end: 'top 25%',
      scrub: true,
      pinSpacing: true,
      onUpdate: (self) => {
        const p = self.progress; // 0 -> 1
        const scale = gsap.utils.mapRange(0, 1, 0.95, 1.05, p);
        gsap.set(el, { scale });
      },
    });
  });
}

function initCasesHoverReveal() {
  const items = Array.from(document.querySelectorAll<HTMLElement>('[data-case-item]'));
  if (!items.length) return;

  const outer = document.querySelector<HTMLElement>('[data-case-hover-outer]');
  const imgEl = document.querySelector<HTMLImageElement>('[data-case-hover-img-el]');
  if (!outer || !imgEl) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isCursorMode = fineHover && !prefersReducedMotion;

  gsap.set(outer, { opacity: 0 });

  const setOuterX = gsap.quickSetter(outer, 'x', 'px');
  const setOuterY = gsap.quickSetter(outer, 'y', 'px');

  // Bind a single global mousemove handler, so re-inits during `astro:after-swap` don't stack.
  if (isCursorMode && !window.__prsmCasesHoverMoveBound) {
    window.addEventListener(
      'mousemove',
      (e) => {
        const st = window.__prsmCasesHoverState;
        if (!st?.isCursorMode) return;
        st.lastX = e.clientX;
        st.lastY = e.clientY;
        st.setOuterX(e.clientX);
        st.setOuterY(e.clientY);
      },
      { passive: true }
    );
    window.__prsmCasesHoverMoveBound = true;
  }

  window.__prsmCasesHoverState = {
    isCursorMode,
    setOuterX,
    setOuterY,
    lastX: window.innerWidth / 2,
    lastY: window.innerHeight / 2,
  };

  const hide = () => {
    gsap.to(outer, { opacity: 0, duration: 0.22, ease: 'power2.out', overwrite: true });
  };

  const show = (src?: string) => {
    const hoverSrc = src ?? '';
    if (!hoverSrc) return;
    imgEl.src = hoverSrc;

    if (!isCursorMode) {
      gsap.set(outer, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    } else {
      const st = window.__prsmCasesHoverState;
      if (st) {
        st.setOuterX(st.lastX);
        st.setOuterY(st.lastY);
      }
    }

    gsap.to(outer, { opacity: 1, duration: 0.35, ease: 'power2.out', overwrite: true });
  };

  items.forEach((item) => {
    if (item.dataset.caseHoverInit === 'true') return;
    item.dataset.caseHoverInit = 'true';

    const onEnter = () => show(item.dataset.caseHoverImg);
    const onLeave = () => hide();

    item.addEventListener('mouseenter', onEnter);
    item.addEventListener('mouseleave', onLeave);
    item.addEventListener('focus', onEnter);
    item.addEventListener('blur', onLeave);
  });
}

function initCasesScrollIntensity() {
  const targets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-case-title], [data-case-item]')
  );
  if (!targets.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    window.dispatchEvent(new CustomEvent('prsm:scroll-intensity', { detail: { intensity: 0 } }));
    return;
  }

  const dispatch = (intensity: number) => {
    window.dispatchEvent(
      new CustomEvent('prsm:scroll-intensity', {
        detail: { intensity: Math.max(0, Math.min(1, intensity)) },
      })
    );
  };

  targets.forEach((el) => {
    if (el.dataset.caseIntensityInit === 'true') return;
    el.dataset.caseIntensityInit = 'true';

    ScrollTrigger.create({
      trigger: el,
      start: 'top center',
      end: 'bottom center',
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress ?? 0;
        // 0 at edges, 1 at the middle of the trigger's travel.
        const intensity = Math.sin(Math.PI * p);
        dispatch(intensity);
      },
    });
  });
}

function initMagneticButtons() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fineHover) return;

  const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-magnetic]'));
  if (!buttons.length) return;

  const centerOf = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      w: r.width,
      h: r.height,
    };
  };

  const states = buttons.map((btn) => ({
    el: btn,
    ...centerOf(btn),
    tx: 0,
    ty: 0,
  }));

  let raf = 0;
  let lastEvent: MouseEvent | null = null;

  const reset = (st: typeof states[number]) => {
    gsap.to(st.el, { x: 0, y: 0, duration: 0.35, ease: 'power2.out', overwrite: true });
  };

  const onMove = (e: MouseEvent) => {
    lastEvent = e;
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      const ev = lastEvent;
      if (!ev) return;

      states.forEach((st) => {
        const { cx, cy } = st;
        const dx = ev.clientX - cx;
        const dy = ev.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > 50) {
          reset(st);
          return;
        }

        const strength = 1 - dist / 50; // 0..1
        const tx = (dx / st.w) * 16 * strength;
        const ty = (dy / st.h) * 12 * strength;
        gsap.to(st.el, { x: tx, y: ty, duration: 0.25, ease: 'power3.out', overwrite: true });
      });
    });
  };

  const onResize = () => {
    states.forEach((st) => {
      const c = centerOf(st.el);
      st.cx = c.cx;
      st.cy = c.cy;
      st.w = c.w;
      st.h = c.h;
    });
  };

  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  onResize();
}

function initCityPulse() {
  const section = document.querySelector<HTMLElement>('[data-city-pulse]');
  const path = section?.querySelector<SVGPathElement>('[data-heartbeat-path]');

  if (!section || !path) return;

  // Compute stroke length once so GSAP can "draw" it by updating dashoffset.
  const len = path.getTotalLength();
  (path as any).__strokeLen = len;
  gsap.set(path, {
    strokeDasharray: len,
    strokeDashoffset: len,
  });

  ScrollTrigger.create({
    trigger: section,
    start: 'top 30%',
    end: 'bottom top',
    scrub: true,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      const p = self.progress; // 0 -> 1
      const offset = len * (1 - p);
      gsap.set(path, { strokeDashoffset: offset });
    },
  });
}

function initTechStack() {
  const section = document.querySelector<HTMLElement>('[data-tech-stack]');
  if (window.__prsmTechStackPingTimer) {
    window.clearInterval(window.__prsmTechStackPingTimer);
    window.__prsmTechStackPingTimer = undefined;
  }
  if (!section) return;

  const svg = section.querySelector<SVGSVGElement>('[data-tech-stack-svg]');
  const paths = Array.from(section.querySelectorAll<SVGPathElement>('[data-stack-path]'));
  const ping = section.querySelector<SVGCircleElement>('[data-stack-ping]');
  if (!svg || !paths.length || !ping) return;

  const nodeGlow = new Map(
    Array.from(section.querySelectorAll<SVGElement>('[data-stack-glow]')).map((el) => [
      el.getAttribute('data-stack-glow') ?? '',
      el,
    ])
  );
  const labelMasks = new Map(
    Array.from(section.querySelectorAll<HTMLElement>('[data-stack-label-mask]')).map((el) => [
      el.dataset.stackLabelMask ?? '',
      el,
    ])
  );
  const labels = new Map(
    Array.from(section.querySelectorAll<HTMLElement>('[data-stack-label]')).map((el) => [
      el.dataset.stackLabel ?? '',
      el,
    ])
  );

  paths.forEach((path) => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    path.style.stroke = 'rgba(255,255,255,0.2)';
  });

  gsap.set(ping, { opacity: 0 });
  labelMasks.forEach((mask) => gsap.set(mask, { opacity: 0 }));

  const pulseNode = (nodeId: string) => {
    const glow = nodeGlow.get(nodeId);
    const labelMask = labelMasks.get(nodeId);
    const labelEl = labels.get(nodeId);
    if (glow) {
      gsap.fromTo(
        glow,
        { opacity: 0, scale: 1 },
        { opacity: 1, scale: 1.05, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.out' }
      );
    }
    if (!labelMask || !labelEl) return;
    if (labelMask.dataset.awsLabelShown === 'true') return;
    labelMask.dataset.awsLabelShown = 'true';
    gsap.to(labelMask, { opacity: 1, duration: 0.2, ease: 'power2.out', overwrite: true });

    const split = SplitText.create(labelEl, {
      type: 'chars',
      charsClass: 'split-char',
    } as any);
    const chars = (split as any).chars as HTMLElement[] | undefined;
    if (!chars?.length) return;

    gsap.from(chars, {
      yPercent: -120,
      scale: 1.2,
      opacity: 1,
      duration: 1.0,
      ease: 'expo.out',
      stagger: 0.01,
      overwrite: 'auto',
    });
  };

  const drawTimeline = gsap.timeline({
    paused: true,
    defaults: { ease: 'power3.out' },
  });

  paths.forEach((path, index) => {
    const nodeId = path.dataset.to ?? '';
    drawTimeline
      .to(path, { strokeDashoffset: 0, duration: 0.55 }, index === 0 ? 0 : '>-0.05')
      .to(path, { stroke: 'rgba(255,255,255,1)', duration: 0.15 }, '<')
      .add(() => pulseNode(nodeId), '>-0.03')
      .to(path, { stroke: 'rgba(255,255,255,0.2)', duration: 0.35 }, '>');
  });

  ScrollTrigger.create({
    trigger: section,
    start: 'top 80%',
    once: true,
    onEnter: () => drawTimeline.play(0),
  });

  const movePingAlongPath = (path: SVGPathElement, duration = 0.7) =>
    gsap.to({ p: 0 }, {
      p: 1,
      duration,
      ease: 'none',
      onStart: () => {
        gsap.to(path, { stroke: 'rgba(255,255,255,1)', duration: 0.15 });
        gsap.set(ping, { opacity: 1 });
      },
      onUpdate: function () {
        const point = path.getPointAtLength(path.getTotalLength() * (this.targets()[0] as any).p);
        ping.setAttribute('cx', `${point.x}`);
        ping.setAttribute('cy', `${point.y}`);
      },
      onComplete: () => {
        gsap.to(path, { stroke: 'rgba(255,255,255,0.2)', duration: 0.3 });
      },
    });

  const runPing = () => {
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(ping, { opacity: 0, duration: 0.25, ease: 'power1.out' });
      },
    });

    paths.forEach((path, idx) => {
      const nodeId = path.dataset.to ?? '';
      tl.add(movePingAlongPath(path), idx === 0 ? 0 : '>');
      tl.to(
        ping,
        { scale: 1.9, opacity: 0, duration: 0.22, ease: 'power2.out' },
        '>-0.08'
      );
      tl.set(ping, { scale: 1, opacity: 1 });
      tl.add(() => pulseNode(nodeId), '<');
    });
  };

  window.setTimeout(runPing, 1300);
  window.__prsmTechStackPingTimer = window.setInterval(runPing, 3000);
}

function bindLenisToScrollTrigger() {
  const lenis = window.__lenis;
  if (!lenis || lenis.__scrollTriggerBound) return;

  const wrapperEl = document.getElementById('lenis-wrapper') as HTMLElement | null;
  if (!wrapperEl) {
    // Fail open: preserve existing behavior if wrapper isn't present.
    lenis.on('scroll', () => ScrollTrigger.update());
    lenis.__scrollTriggerBound = true;
    return;
  }

  // Make ScrollTrigger drive off the Lenis scroller container.
  const getScrollTop = () => {
    const anyLenis = lenis as any;
    return anyLenis.scroll ?? anyLenis.scrollTop ?? 0;
  };

  const setScrollTop = (value: number) => {
    const anyLenis = lenis as any;
    if (typeof anyLenis.scrollTo === 'function') {
      anyLenis.scrollTo(value, { immediate: true });
    } else if (typeof anyLenis.scrollTo === 'function') {
      anyLenis.scrollTo(value);
    }
  };

  ScrollTrigger.scrollerProxy(wrapperEl, {
    scrollTop(value?: number) {
      if (typeof value === 'number') setScrollTop(value);
      return getScrollTop();
    },
    getBoundingClientRect() {
      return wrapperEl.getBoundingClientRect();
    },
    // Lenis uses transforms on the content; this tells ScrollTrigger how to compute pins.
    pinType: wrapperEl.style.transform ? 'transform' : 'fixed',
  });

  ScrollTrigger.defaults({ scroller: wrapperEl });

  lenis.on('scroll', () => {
    ScrollTrigger.update();
  });

  lenis.__scrollTriggerBound = true;
  ScrollTrigger.refresh();
}

function initAll() {
  initLenis();
  bindLenisToScrollTrigger();
  bindRefreshHandlers();
  initSpitzerReveal();
  initCityPulseFlip();
  initCaseViewMagnetic();
  initHeroRefraction();
  initBentoGridHover();
  initScrollBoundScaling();
  initCasesHoverReveal();
  initCasesScrollIntensity();
  initMagneticButtons();
  initSplashLoader();
  initCityPulse();
  initTechStack();

  // Ensure ScrollTrigger measurements are correct after images load.
  // This prevents pinning offsets when images shift layout.
  void waitForImagesLoaded().then(() => {
    ScrollTrigger.refresh();
  });
}

if (typeof window !== 'undefined') {
  disableNativeViewTransitionsForSafari();

  const start = () => {
    if (window.__prsmEngineStarted) return;
    window.__prsmEngineStarted = true;
    cleanupGsap();
    initAll();

    // Fail-safe: never start in a faded-out state.
    const smooth = document.getElementById('smooth-content');
    if (smooth) gsap.set(smooth, { opacity: 1 });
    window.setTimeout(() => {
      const node = document.getElementById('smooth-content');
      if (node) gsap.set(node, { opacity: 1 });
    }, 800);

    // Loader fail-safe: if JS stalls and the splash never completes,
    // forcibly reveal content after a short grace period.
    const runLoaderFailSafe = () => {
      if (window.__prsmSplashFailSafeDone) return;
      // If splash completed normally, do nothing.
      if (window.__prsmSplashDone) return;

      const splash = document.querySelector<HTMLElement>('[data-splash]');
      const smoothNode = document.getElementById('smooth-content');

      if (smoothNode) gsap.to(smoothNode, { opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: true });
      if (splash) {
        gsap.set(splash, { opacity: 0, pointerEvents: 'none', overwrite: true });
        splash.remove();
      }
      window.__prsmSplashFailSafeDone = true;
      console.log('PRSM Studio: Loader fail-safe applied');
    };

    window.addEventListener('load', runLoaderFailSafe, { once: true });
    window.setTimeout(runLoaderFailSafe, 5000);

    console.log('PRSM Studio: Engine Initialized');
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Astro route/view-transition lifecycle: ensure GSAP is initialized on navigation too.
  document.addEventListener('astro:page-load', start);

  document.addEventListener('astro:before-swap', () => {
    liftPrismCanvasBeforeSwap();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const smooth = document.getElementById('smooth-content');
    if (!smooth) return;

    gsap.to(smooth, {
      opacity: 0,
      duration: 0.22,
      ease: 'power2.in',
      overwrite: true,
    });
  });

  document.addEventListener('astro:after-swap', () => {
    restorePrismCanvasAfterSwap();
    disableNativeViewTransitionsForSafari();
    cleanupGsap();
    initAll();
    ScrollTrigger.refresh();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smooth = document.getElementById('smooth-content');
    if (!smooth) return;

    gsap.set(smooth, { opacity: 0 });

    // Fail-safe: ensure we never get stuck at opacity:0.
    // Reduced-motion users should still see the content.
    if (prefersReducedMotion) {
      gsap.set(smooth, { opacity: 1 });
      return;
    }

    gsap.to(smooth, {
      opacity: 1,
      duration: 0.35,
      ease: 'power2.out',
      overwrite: true,
    });
    window.setTimeout(() => {
      const node = document.getElementById('smooth-content');
      if (node) gsap.set(node, { opacity: 1 });
    }, 900);
  });
}

