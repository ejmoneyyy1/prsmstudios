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

declare global {
  interface Window {
    __lenis?: {
      on: (eventName: string, cb: (...args: any[]) => void) => void;
      raf: (time: number) => void;
      __scrollTriggerBound?: boolean;
    };
    __prsmResizeBound?: boolean;
    __prsmPrismReadyBound?: boolean;
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
    __prsmEngineStarted?: boolean;
  }
}

function cleanupGsap() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.globalTimeline.clear();
}

function initLenis() {
  if (typeof window === 'undefined') return;
  if (window.__lenis) return;

  const wrapperEl = document.getElementById('lenis-wrapper') as HTMLElement | null;
  const contentEl = document.getElementById('lenis-content') as HTMLElement | null;

  // Native scroll on tablets, half-width windows, touch, and phones — Lenis + h-screen overflow
  // traps the scrollport and feels laggy/unresponsive on touch & narrow viewports.
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const narrowViewport = window.matchMedia('(max-width: 1024px)').matches;
  if (prefersReducedMotion || coarsePointer || narrowViewport) return;

  // Don't let Lenis block the site (e.g. if chunks time out).
  import('lenis')
    .then((mod) => {
      const Lenis = mod.default;
      window.__lenis = new Lenis({
        wrapper: wrapperEl ?? undefined,
        content: contentEl ?? undefined,
        duration: 0.85,
        smoothWheel: true,
        smoothTouch: false,
        lerp: 0.12,
        smooth: 1.15,
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

function initSpitzerReveal() {
  const revealTargets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-reveal="chars"], [data-reveal="lines"], [data-spitzer-reveal]')
  );
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!revealTargets.length) return;

  /** SplitText + paused gsap.from — play handler stored for ScrollTrigger + above-the-fold fallback. */
  const runRevealByEl = new WeakMap<HTMLElement, () => void>();

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

        const isHeroHeadline = el.hasAttribute('data-reveal-hero');

        if (mode === 'lines') {
          if (isHeroHeadline) {
            /* Display hero: lines emerge from below (SplitText / “SplitType”-style rig) */
            return gsap.from(targets, {
              yPercent: 100,
              duration: 1.1,
              ease: 'power4.out',
              stagger: 0.1,
              paused: true,
            });
          }
          return gsap.from(targets, {
            yPercent: 105,
            duration: 0.9,
            ease: 'power4.out',
            stagger: 0.04,
            paused: true,
          });
        }

        if (isHeroHeadline) {
          return gsap.from(targets, {
            yPercent: 100,
            rotation: 5,
            transformOrigin: '50% 100%',
            duration: 1.05,
            ease: 'power4.out',
            stagger: 0.01,
            paused: true,
          });
        }

        return gsap.from(targets, {
          yPercent: -120,
          scale: 1.2,
          duration: 1,
          ease: 'power4.out',
          stagger: 0.01,
          paused: true,
        });
      },
    } as any);

    const runReveal = () => {
      if (el.dataset.revealPlayed === 'true') return;
      const anySplit = split as any;
      // SplitText 3.x stores the onSplit tween on `_data.anim`, not `.animation`.
      const animation = anySplit?._data?.anim as { play: (t?: number) => unknown } | undefined;
      if (animation?.play) {
        el.dataset.revealPlayed = 'true';
        animation.play(0);
      } else {
        // Never leave copy invisible if the tween failed to attach.
        el.dataset.revealPlayed = 'true';
        gsap.set(el, { opacity: 1 });
        gsap.set(el.querySelectorAll('.split-char, .split-line'), { clearProps: 'all' });
      }
    };
    runRevealByEl.set(el, runReveal);

    // `top 85%` = when the trigger's top crosses 85% down the viewport. Above-the-fold blocks
    // (hero headline, etc.) start *above* that line and never cross it when scrolling down, so
    // the paused animation never played — text looked "missing". Fallback below fixes that.
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: runReveal,
    });
  });

  const playVisibleReveals = () => {
    revealTargets.forEach((el) => {
      if (isReducedMotion) return;
      if (el.dataset.revealPlayed === 'true') return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const intersectsViewport = rect.top < vh && rect.bottom > 0;
      if (!intersectsViewport) return;
      runRevealByEl.get(el)?.();
    });
  };

  ScrollTrigger.addEventListener('refresh', playVisibleReveals);
  ScrollTrigger.refresh();

  requestAnimationFrame(() => {
    playVisibleReveals();
    // Fonts / late layout can shift rects after first frame — catch stragglers once more.
    requestAnimationFrame(playVisibleReveals);
  });

  window.addEventListener('load', () => {
    ScrollTrigger.refresh();
    playVisibleReveals();
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

/** Hero mission subhead — weighted line reveal (ScrollTrigger + expo.out). */
function initHeroMissionReveal() {
  const el = document.querySelector<HTMLElement>('[data-hero-mission]');
  if (!el) return;

  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReducedMotion) return;

  const split = SplitText.create(el, {
    type: 'lines',
    autoSplit: true,
    mask: 'lines',
    linesClass: 'split-line',
    onSplit: (self: any) => {
      const lines = self.lines;
      if (!lines?.length) return undefined;
      return gsap.from(lines, {
        yPercent: 110,
        duration: 1.5,
        ease: 'expo.out',
        stagger: 0.1,
        paused: true,
      });
    },
  } as any);

  const run = () => {
    if (el.dataset.heroMissionPlayed === 'true') return;
    const anim = (split as any)?._data?.anim as { play: (t?: number) => unknown } | undefined;
    if (anim?.play) {
      el.dataset.heroMissionPlayed = 'true';
      anim.play(0);
    } else {
      el.dataset.heroMissionPlayed = 'true';
      gsap.set(el, { opacity: 1 });
      gsap.set(el.querySelectorAll('.split-line'), { clearProps: 'all' });
    }
  };

  ScrollTrigger.create({
    trigger: el,
    start: 'top 88%',
    once: true,
    onEnter: run,
  });

  ScrollTrigger.refresh();
  requestAnimationFrame(() => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) run();
  });

  window.addEventListener('load', () => {
    ScrollTrigger.refresh();
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) run();
  });
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
  const grainLayer = document.querySelector<HTMLElement>('.grain-agency');
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
        ease: 'power4.out',
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
        ease: 'power4.out',
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

  // Bind a single global mousemove handler so re-inits don't stack.
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

  const buttons = Array.from(
    document.querySelectorAll<HTMLElement>('[data-magnetic], .presence-audit-btn')
  );
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

/** Soft blurred cursor — GSAP ticker lerp 0.1 (elite production). */
function initEliteCursor() {
  if (typeof document === 'undefined') return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  if (prefersReducedMotion || coarsePointer) return;

  const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fineHover) return;

  const el = document.createElement('div');
  el.className = 'prsm-elite-cursor';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  document.documentElement.classList.add('prsm-elite-cursor-root');

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let cx = mouseX;
  let cy = mouseY;
  let visible = false;

  const LERP = 0.1;

  const onMove = (e: MouseEvent) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!visible) {
      visible = true;
      gsap.to(el, { opacity: 1, duration: 0.2, overwrite: true });
    }
  };

  const onLeave = () => {
    gsap.to(el, { opacity: 0, duration: 0.35, overwrite: true });
    visible = false;
  };

  const tick = () => {
    cx += (mouseX - cx) * LERP;
    cy += (mouseY - cy) * LERP;
    gsap.set(el, { x: cx, y: cy, xPercent: -50, yPercent: -50 });
  };

  gsap.ticker.add(tick);
  window.addEventListener('mousemove', onMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave, { passive: true });

  disposeEliteCursor = () => {
    gsap.ticker.remove(tick);
    window.removeEventListener('mousemove', onMove);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    gsap.killTweensOf(el);
    el.remove();
    document.documentElement.classList.remove('prsm-elite-cursor-root');
    disposeEliteCursor = undefined;
  };
}

/** Glass vault — double-tap (&lt;300ms) or dblclick → fullscreen crystal + dark blur backdrop. */
function initGlassVaultFullscreen() {
  const card = document.querySelector<HTMLElement>('[data-prism-glass-vault]');
  if (!card) return;

  const refreshAfterLayout = () => {
    window.dispatchEvent(new Event('resize'));
    ScrollTrigger.refresh();
  };

  let isOpen = false;
  let placeholder: HTMLDivElement | null = null;
  let overlay: HTMLDivElement | null = null;
  let closeHint: HTMLButtonElement | null = null;
  let savedRect: DOMRect | null = null;
  let onKeyDown: ((e: KeyboardEvent) => void) | null = null;

  const closeModal = () => {
    if (!isOpen || !placeholder || !savedRect || !overlay || !closeHint) return;

    const ph = placeholder;
    const ov = overlay;
    const hint = closeHint;
    const rect = savedRect;

    gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        ph.parentNode?.insertBefore(card, ph);
        ph.remove();
        ov.remove();
        hint.remove();
        gsap.set(card, { clearProps: 'all' });
        document.body.style.overflow = '';
        placeholder = null;
        overlay = null;
        closeHint = null;
        savedRect = null;
        isOpen = false;
        if (onKeyDown) {
          window.removeEventListener('keydown', onKeyDown);
          onKeyDown = null;
        }
        refreshAfterLayout();
      },
    })
      .to(hint, { opacity: 0, duration: 0.2 }, 0)
      .to(
        card,
        {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: '1.5rem',
          duration: 0.55,
        },
        0
      )
      .to(ov, { opacity: 0, duration: 0.4 }, 0);
  };

  const openModal = () => {
    if (isOpen) return;
    const r = card.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;

    savedRect = r;
    isOpen = true;

    placeholder = document.createElement('div');
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.width = `${r.width}px`;
    placeholder.style.height = `${r.height}px`;
    placeholder.style.flexShrink = '0';
    card.parentNode?.insertBefore(placeholder, card);

    overlay = document.createElement('div');
    overlay.className = 'prism-vault-overlay prism-vault-overlay--crystal';
    gsap.set(overlay, { opacity: 0 });

    closeHint = document.createElement('button');
    closeHint.type = 'button';
    closeHint.className = 'prism-vault-close-hint';
    closeHint.textContent = 'Esc · Close';
    closeHint.setAttribute('aria-label', 'Close glass vault');

    document.body.appendChild(overlay);
    document.body.appendChild(card);
    document.body.appendChild(closeHint);
    gsap.set(closeHint, { opacity: 0 });

    const targetW = window.innerWidth;
    const targetH = window.innerHeight;

    gsap.set(card, {
      position: 'fixed',
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      zIndex: 220,
      margin: 0,
      maxWidth: 'none',
      borderRadius: '1.5rem',
    });

    document.body.style.overflow = 'hidden';

    onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKeyDown);

    gsap
      .timeline({ onComplete: () => refreshAfterLayout() })
      .to(overlay, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0)
      .to(
        card,
        {
          left: 0,
          top: 0,
          width: targetW,
          height: targetH,
          borderRadius: 0,
          duration: 0.7,
          ease: 'power3.inOut',
        },
        0
      )
      .to(closeHint, { opacity: 1, duration: 0.35, ease: 'power2.out' }, 0.12);

    const onOverlayClick = (e: MouseEvent) => {
      if (e.target === overlay) closeModal();
    };
    overlay.addEventListener('click', onOverlayClick);
    closeHint.addEventListener('click', () => closeModal());
  };

  let lastTap = 0;
  card.addEventListener(
    'touchend',
    (e) => {
      if (isOpen) return;
      const now = Date.now();
      if (lastTap > 0 && now - lastTap < 300) {
        e.preventDefault();
        openModal();
        lastTap = 0;
      } else {
        lastTap = now;
      }
    },
    { passive: false }
  );

  card.addEventListener('dblclick', (e) => {
    if (isOpen) return;
    e.preventDefault();
    openModal();
  });
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

/**
 * Brand velocity chart: GSAP “drawSVG” behavior via stroke-dashoffset (Club DrawSVG not required).
 * Syncs glow stroke + reveals axis labels with scroll scrub.
 */
function initTechStack() {
  const section = document.querySelector<HTMLElement>('[data-tech-stack]');
  if (window.__prsmTechStackPingTimer) {
    window.clearInterval(window.__prsmTechStackPingTimer);
    window.__prsmTechStackPingTimer = undefined;
  }
  if (!section) return;

  const line = section.querySelector<SVGPathElement>('[data-velocity-line]');
  const glow = section.querySelector<SVGPathElement>('[data-velocity-glow]');
  const cap = section.querySelector<SVGCircleElement>('[data-velocity-cap]');
  const capCore = section.querySelector<SVGCircleElement>('[data-velocity-cap-core]');
  if (!line || !glow) return;

  const labelMaskAuthority = section.querySelector<HTMLElement>('[data-velocity-label-mask="authority"]');
  const labelMaskConversion = section.querySelector<HTMLElement>('[data-velocity-label-mask="conversion"]');

  const len = line.getTotalLength();
  const applyDash = (path: SVGPathElement) => {
    const l = path.getTotalLength();
    path.style.strokeDasharray = String(l);
    path.style.strokeDashoffset = String(l);
  };
  applyDash(line);
  applyDash(glow);

  gsap.set([line, glow], { strokeDashoffset: len });
  gsap.set([cap, capCore], { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' });
  if (labelMaskAuthority) gsap.set(labelMaskAuthority, { opacity: 0, y: 8 });
  if (labelMaskConversion) gsap.set(labelMaskConversion, { opacity: 0, y: 8 });

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    line.style.strokeDashoffset = '0';
    glow.style.strokeDashoffset = '0';
    gsap.set([cap, capCore], { opacity: 1, scale: 1 });
    if (labelMaskAuthority) gsap.set(labelMaskAuthority, { opacity: 1, y: 0 });
    if (labelMaskConversion) gsap.set(labelMaskConversion, { opacity: 1, y: 0 });
    return;
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top 85%',
    end: 'bottom 20%',
    scrub: 0.65,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      const p = self.progress;
      const offset = len * (1 - p);
      line.style.strokeDashoffset = String(offset);
      glow.style.strokeDashoffset = String(offset);
      if (labelMaskAuthority) {
        gsap.set(labelMaskAuthority, { opacity: Math.min(1, p * 3), y: 8 * (1 - Math.min(1, p * 3)) });
      }
      if (labelMaskConversion) {
        const t = Math.max(0, (p - 0.35) / 0.65);
        gsap.set(labelMaskConversion, { opacity: Math.min(1, t * 2.2), y: 8 * (1 - Math.min(1, t * 2.2)) });
      }
      const capVis = Math.max(0, (p - 0.72) / 0.28);
      gsap.set(cap, { opacity: capVis * 0.45, scale: 0.7 + capVis * 0.35 });
      gsap.set(capCore, { opacity: capVis, scale: 0.75 + capVis * 0.25 });
    },
  });
}

/** City Pulse index showcase: device rises into frame, feature triad staggers in from the right. */
function initCityPulseShowcase() {
  const section = document.querySelector<HTMLElement>('[data-city-pulse-showcase]');
  if (!section) return;

  const device = section.querySelector<HTMLElement>('[data-showcase-device]');
  const triad = section.querySelectorAll<HTMLElement>('[data-showcase-triad-item]');
  const stores = section.querySelector<HTMLElement>('[data-showcase-stores]');

  if (!device || !triad.length || !stores) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    gsap.set([device, ...Array.from(triad), stores], { clearProps: 'transform,opacity' });
    return;
  }

  gsap.set(device, { y: 100, opacity: 0, force3D: true });
  gsap.set(triad, { x: 56, opacity: 0, force3D: true });
  gsap.set(stores, { opacity: 0, y: 18, force3D: true });

  gsap
    .timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 78%',
        once: true,
      },
    })
    .to(device, {
      y: 0,
      opacity: 1,
      duration: 0.95,
      ease: 'power3.out',
    })
    .to(
      triad,
      {
        x: 0,
        opacity: 1,
        duration: 0.72,
        stagger: 0.12,
        ease: 'power3.out',
      },
      '-=0.58'
    )
    .to(
      stores,
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
      },
      '-=0.38'
    );
}

/** /audit — single-page intake + Cal iframe (portal reveal + loader + local session sync). */
function initAuditPortal() {
  const root = document.querySelector<HTMLElement>('[data-audit-page]');
  if (!root) return;

  const portal = root.querySelector<HTMLElement>('[data-audit-portal]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (portal) {
    if (prefersReducedMotion) {
      gsap.set(portal, { clearProps: 'transform,filter,opacity' });
    } else {
      gsap.fromTo(
        portal,
        { scale: 0.96, filter: 'blur(10px)', opacity: 0.9 },
        {
          scale: 1,
          filter: 'blur(0px)',
          opacity: 1,
          duration: 0.9,
          ease: 'power3.out',
          delay: 0.08,
        },
      );
    }
  }

  const iframe = root.querySelector<HTMLIFrameElement>('[data-audit-cal-iframe]');
  const loader = root.querySelector<HTMLElement>('[data-audit-cal-loader]');

  const showCalLoader = () => {
    if (!loader) return;
    loader.style.display = 'flex';
    gsap.set(loader, { opacity: 1 });
  };

  const hideCalLoader = () => {
    if (!loader) return;
    gsap.to(loader, {
      opacity: 0,
      duration: 0.45,
      ease: 'power2.out',
      onComplete: () => {
        loader.style.display = 'none';
      },
    });
  };

  const swapCalEmbed = (url: string) => {
    if (!iframe || !url) return;
    if (iframe.src === url) return;
    showCalLoader();
    const onLoad = () => {
      hideCalLoader();
      iframe.removeEventListener('load', onLoad);
    };
    iframe.addEventListener('load', onLoad);
    iframe.src = url;
    window.setTimeout(() => {
      if (loader && loader.style.display !== 'none') hideCalLoader();
    }, 9000);
  };

  if (iframe && loader) {
    iframe.addEventListener('load', () => hideCalLoader(), { once: true });
    window.setTimeout(() => {
      if (loader.style.display !== 'none') hideCalLoader();
    }, 9000);

    root.querySelectorAll<HTMLInputElement>('input[name="cal_duration"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        const url = radio.getAttribute('data-cal-url');
        if (url) swapCalEmbed(url);
      });
    });
  }

  const persist = () => {
    const url = root.querySelector<HTMLInputElement>('[data-audit-field="url"]')?.value ?? '';
    const pain = root.querySelector<HTMLTextAreaElement>('[data-audit-field="pain"]')?.value ?? '';
    const goals = root.querySelector<HTMLTextAreaElement>('[data-audit-field="goals"]')?.value ?? '';
    try {
      sessionStorage.setItem('prsm:audit:url', url);
      sessionStorage.setItem('prsm:audit:pain', pain);
      sessionStorage.setItem('prsm:audit:goals', goals);
    } catch {
      /* ignore */
    }
  };

  root.querySelector('#audit-intake-form')?.addEventListener('submit', (e) => e.preventDefault());

  root.querySelectorAll('input, textarea').forEach((el) => {
    el.addEventListener('change', persist);
    el.addEventListener('blur', persist);
  });
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
  initHeroMissionReveal();
  initCityPulseFlip();
  initCaseViewMagnetic();
  initHeroRefraction();
  initBentoGridHover();
  initScrollBoundScaling();
  initCasesHoverReveal();
  initCasesScrollIntensity();
  initMagneticButtons();
  initGlassVaultFullscreen();
  initEliteCursor();
  initCityPulse();
  initTechStack();
  initCityPulseShowcase();
  initAuditPortal();

  // Ensure ScrollTrigger measurements are correct after images load.
  // This prevents pinning offsets when images shift layout.
  void waitForImagesLoaded().then(() => {
    ScrollTrigger.refresh();
  });
}

if (typeof window !== 'undefined') {
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

    console.log('PRSM Studio: Engine Initialized');
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}

