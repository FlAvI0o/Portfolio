import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import BackgroundScene from './components/BackgroundScene.jsx';
import { CornerButton } from './components/CornerButton';
import IntakeExperience from './components/IntakeExperience.jsx';
import { useMediaQuery } from './hooks/useMediaQuery.js';
import {
  cardRevealAlpha,
  contentRevealAlpha,
  phase01,
  resolveMorphProgress,
  smoothstep,
} from './systems/cubeMorph.js';
import { BRIDGE_BEAT, beatExit, statementWipe } from './systems/director.js';
import {
  INTAKE_DURATION,
  intakeEase,
  intakePresence,
  portfolioPresence,
} from './systems/intake.js';
import { createScrollResistance } from './systems/resistance.js';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Single source of truth for every gsap.matchMedia() breakpoint in this page.
const MQ_DESKTOP = '(min-width: 768px)';
const MQ_MOBILE = '(max-width: 767px)';
const MQ_REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// Weight — nothing should react instantly to the scrollbar. Lenis already
// smooths the raw wheel/touch input; these `scrub` numbers add a second,
// independent layer of lag on top of that smoothed position, so every
// staged reveal, statement wipe and morph value eases into place with its
// own small trail instead of following scroll pixel-for-pixel. Used in
// place of `scrub: true` everywhere a tween's *value* (not a pin's
// position, which always stays scroll-exact) is being driven.
const SCRUB_WEIGHT = 0.6;
const SCRUB_WEIGHT_HEAVY = 0.85;

// Pin lengths (in extra viewports) for the pinned scenes — shared between
// the reveal choreography and the director beats so the two can never drift
// apart. Weight ≠ duration: a scene earns its length with the HOLD, never
// with anticipation. Every scene reveals quickly (everything the visitor
// needs is on screen by roughly the pin's midpoint) and then stays — the
// remaining distance exists to appreciate the work, not to unlock it. The
// hold is never a stop, though: the world keeps breathing underneath it
// (see BackgroundScene's ambient layer) — only the scroll-tied choreography
// settles, never the world itself.
//
// Motion hierarchy: the flagship owns the longest scene on the page; the
// second project gets a much lighter pin that exists only to guarantee its
// description can never be scrolled past unread — minimal ceremony.
const PROFILE_PIN_VIEWPORTS = 1.9;
const FLAGSHIP_PIN_VIEWPORTS = 2.4;
const PROJECT2_PIN_VIEWPORTS = 1.4;

const HERO_LINES = [
  'HIGH-PERFORMANCE',
  'WEB ENGINEERING',
  'FOR FINTECH',
  '& AI PRODUCTS.',
];

const FOOTER_NAV = [
  {
    title: 'SITEMAP',
    links: [
      { label: 'HOME', href: '#' },
      { label: 'ABOUT', href: '#about' },
      { label: 'WORK', href: '#work' },
    ],
  },
  {
    title: 'CONNECT',
    links: [
      { label: 'GITHUB', href: 'https://github.com/FlAvI0o' },
      { label: 'LINKEDIN', href: 'https://www.linkedin.com/in/flavio-donnini-2b13a73a8/' },
      { label: 'X', href: 'https://x.com/_slowdon' },
    ],
  },
  {
    title: 'LOCATION',
    links: [{ label: 'CASTIGLIONE DEL LAGO', href: '#' }],
  },
  {
    title: 'ADMIN',
    links: [
      { label: 'PRIVACY', href: '/privacy' },
    ],
  },
];

const PROJECTS = [
  {
    id: 'buongesto',
    title: 'Buongesto',
    tagline: 'Interactive WebGL Experience',
    video: '/buongesto-horizontal.mp4',
    description:
      'Crowdfunding infrastructure rendering 100k+ interactive blocks at 60fps. React + Three.js layout engine with unified scroll, physics, and GPU batching for high-density node synchronization.',
  },
  {
    id: 'deckforge',
    title: 'Deckforge',
    tagline: 'Real-Time Spatial Computation',
    video: '/deckforge-horizontal.mp4',
    description:
      'Custom scene graph, instanced geometry pipeline, and scroll-synced camera choreography.',
  },
];

// The three statements — pacing devices, not content. Each is an *empty*
// scroll runway in the page flow hosting a director beat (see
// src/systems/director.js); the visible statement lives on the fixed layer
// BEHIND the WebGL canvas and is uncovered out of the negative space the
// world opens for it. No numbers, no identity, no slogans: three short
// sentences, each placed where anticipation is needed — never competing
// with the projects they separate.
//
// The story is proof-first: the visitor sees the work before they meet the
// person. Only once both projects have landed does the page turn inward.
//
//   'Not just code.'      hero → the flagship        (curiosity → proof)
//   'Selected work.'      flagship → project 02       (proof, continuing)
//   'Built to solve.'     project 02 → the person      (proof → why)
const BRIDGES = {
  code: { text: 'Not just code.' },
  work: { text: 'Selected work.' },
  solve: { text: 'Built to solve.' },
};

function BridgeRunway({ id, text }) {
  return (
    <div
      // Short by design — a beat, not a chapter: long enough for the
      // director grammar (anticipation → compression → reveal → hold →
      // release) to read clearly, never long enough for three plain words
      // to feel like they're occupying real estate the projects should own.
      className="bridge relative flex min-h-[100dvh] w-full items-center justify-center md:min-h-[115dvh]"
      data-bridge={id}
    >
      {/* Real copy for screen readers; the visible twin on the statement
          layer is aria-hidden and purely visual. */}
      <p className="sr-only">{text}</p>

      {/* Static fallback, shown only under prefers-reduced-motion (the fixed
          statement layer is display:none there — see index.css). */}
      <p className="bridge__static statement-type text-center" aria-hidden="true">
        {text}
      </p>
    </div>
  );
}

// The statement layer: one fixed, full-viewport overlay stacked BETWEEN the
// white reveal background (z -15) and the WebGL canvas (z -10), so the
// wireframe world literally draws over the letters — the text exists inside
// the world, not above it. All statements overlap at viewport center; only
// the active beat's statement is visible (fully clipped otherwise).
function StatementLayer() {
  return (
    <div
      className="statement-layer fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: -12 }}
      aria-hidden="true"
    >
      {Object.entries(BRIDGES).map(([key, bridge]) => (
        <div
          key={key}
          className="statement absolute inset-0 flex flex-col items-center justify-center px-[clamp(1.5rem,4vw,4rem)] text-center"
          data-statement={key}
        >
          <span className="statement__line statement-type">{bridge.text}</span>
        </div>
      ))}
    </div>
  );
}

// The project itself is the interface — the video is never gated behind
// scroll: it is simply present and already playing the moment its section
// arrives, at its own intended aspect ratio (w-auto/h-auto + max-w/max-h
// let it shrink to fit without ever cropping a frame). Only the identity
// label and the explanation are staged (see addProjectReveal below) —
// uncovered early while the video keeps the frame, in the order a product
// launch earns attention: watch, learn what it is, learn why it matters —
// and then given a long hold to simply be watched.
//
// The explanation lives in a glass panel attached to the video's left edge
// (shared w-fit column ties the two together): a designed annotation of the
// footage, readable over the wireframe world — not a floating content box.
function ProjectReveal({ project, reducedMotion }) {
  return (
    <article className="project flex w-full flex-col items-center" data-project={project.id}>
      {/* w-fit: this column shrink-wraps to the video's rendered box, so
          both the label overlay and the annotation panel below align with
          the video's real edges — the panel is attached, never floating. */}
      <div className="flex w-fit max-w-full flex-col items-start">
        <div className="relative max-w-full overflow-hidden rounded-xl md:rounded-2xl">
          <video
            src={project.video}
            aria-label={`${project.title} — project preview`}
            controls={reducedMotion}
            loop
            muted
            playsInline
            preload="metadata"
            // Playback itself is driven by the lead-time IntersectionObserver
            // below (not the autoplay attribute) — it is already rolling
            // well before the section reaches the viewport, without forcing
            // every project video to buffer from the moment the page loads.
            className="project__video block h-auto max-h-[36svh] w-auto max-w-full md:max-h-[48svh]"
          />

          {/* Bottom-left identity label — the "title" moment, deliberately
              small: named after the video has already held the frame, never
              competing with it. */}
          <div className="project__label pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-[clamp(1rem,3vw,2rem)] py-[clamp(0.85rem,2.4vw,1.5rem)]">
            <span className="project__eyebrow text-white/85">{project.eyebrow}</span>
            <span className="text-[clamp(1.3rem,2.8vw,2.1rem)] font-bold uppercase leading-none tracking-tight text-white">
              {project.title}
            </span>
            {project.tagline && (
              <span className="text-[clamp(0.8rem,1.5vw,1rem)] font-medium normal-case tracking-normal text-white/75">
                {project.tagline}
              </span>
            )}
          </div>
        </div>

        {/* Glass annotation panel — same material language as the profile
            and footer cards. Readability over novelty: solid enough glass
            that the wireframe world never fights the copy. */}
        <div className="project__desc mt-4 max-w-3xl rounded-2xl border border-neutral-300 bg-white/75 px-[clamp(1.25rem,2.5vw,2rem)] py-[clamp(1rem,2vw,1.5rem)] shadow-xl backdrop-blur-xl md:mt-5">
          <p className="max-h-[22svh] overflow-y-auto overscroll-contain text-base font-medium leading-relaxed text-neutral-800 break-words md:text-lg">
            {project.description}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function Portfolio() {
  const appRef = useRef(null);
  const heroRef = useRef(null);
  const footerRef = useRef(null);
  const footerBgRef = useRef(null); // Sfondo bianco esplosivo dietro il footer
  const scrollProgressRef = useRef(0);
  const footerProgressRef = useRef(0);
  const profileTriggerRef = useRef(null);
  const profileImgRef = useRef(null);
  // Wraps the flagship project — the section that gets pinned for the
  // portfolio's longest, most deliberate scroll scene (see addProjectReveal
  // in the "Morph targets" effect below).
  const project1TriggerRef = useRef(null);
  // Wraps project 2 — a much lighter pin whose only job is guaranteeing the
  // explanation can never be scrolled past unread.
  const project2TriggerRef = useRef(null);
  // Registry read by the WebGL scene each frame: every glass card the hero
  // cube can morph into (see src/systems/cubeMorph.js). Projects are
  // deliberately not on this list — no card, no cube hand-off there.
  const morphTargetsRef = useRef([]);
  // Director bus (see src/systems/director.js): every narrative beat —
  // statement bridges, the two moments and the finale — the WebGL scene
  // reads per frame to derive calm / compression / energy and the camera lean.
  const beatsRef = useRef([]);
  // Intake collapse progress shared with BackgroundScene (0 browse → 1 workspace).
  const intakeProgressRef = useRef(0);
  const reconstructProgressRef = useRef(0);
  const lenisRef = useRef(null);
  const domLayerRef = useRef(null);
  const intakeShellRef = useRef(null);
  const intakeTweenRef = useRef(null);
  const savedScrollYRef = useRef(0);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeMounted, setIntakeMounted] = useState(false);
  const intakeOpenRef = useRef(false);
  intakeOpenRef.current = intakeOpen;

  const prefersReducedMotion = useMediaQuery(MQ_REDUCED_MOTION);
  const reducedMotionRef = useRef(prefersReducedMotion);
  reducedMotionRef.current = prefersReducedMotion;

  const applyIntakeVisuals = (t) => {
    const dom = domLayerRef.current;
    const shell = intakeShellRef.current;
    const presence = portfolioPresence(t);
    const intakeAlpha = intakePresence(t);

    if (dom) {
      gsap.set(dom, {
        autoAlpha: Math.max(presence, 0.001),
        scale: 1 - intakeEase(t) * 0.04,
        y: intakeEase(t) * -28,
        filter: t > 0.02 ? `blur(${intakeEase(t) * 10}px)` : 'none',
        pointerEvents: t > 0.55 ? 'none' : 'auto',
      });
    }
    if (shell) {
      gsap.set(shell, {
        autoAlpha: intakeAlpha,
        pointerEvents: intakeAlpha > 0.4 ? 'auto' : 'none',
      });
    }
  };

  const openIntake = () => {
    if (intakeOpenRef.current || intakeTweenRef.current) return;

    savedScrollYRef.current = window.scrollY;
    setIntakeMounted(true);
    setIntakeOpen(true);
    document.documentElement.classList.add('intake-active');
    lenisRef.current?.stop();

    const reduce = reducedMotionRef.current;
    const state = { t: intakeProgressRef.current };
    const duration = reduce ? 0.01 : INTAKE_DURATION;

    intakeTweenRef.current?.kill();
    intakeTweenRef.current = gsap.to(state, {
      t: 1,
      duration,
      ease: reduce ? 'none' : 'power2.inOut',
      onUpdate: () => {
        intakeProgressRef.current = state.t;
        applyIntakeVisuals(state.t);
      },
      onComplete: () => {
        intakeProgressRef.current = 1;
        applyIntakeVisuals(1);
        intakeTweenRef.current = null;
      },
    });
  };

  const closeIntake = () => {
    if (intakeProgressRef.current < 0.01 && !intakeOpenRef.current) return;
    if (intakeTweenRef.current) return;

    reconstructProgressRef.current = 0;
    setIntakeOpen(false);

    const reduce = reducedMotionRef.current;
    const state = { t: intakeProgressRef.current };
    const duration = reduce ? 0.01 : INTAKE_DURATION * 0.9;

    intakeTweenRef.current = gsap.to(state, {
      t: 0,
      duration,
      ease: reduce ? 'none' : 'power2.inOut',
      onUpdate: () => {
        intakeProgressRef.current = state.t;
        applyIntakeVisuals(state.t);
      },
      onComplete: () => {
        intakeProgressRef.current = 0;
        applyIntakeVisuals(0);
        intakeTweenRef.current = null;
        setIntakeMounted(false);
        document.documentElement.classList.remove('intake-active');
        lenisRef.current?.start();
        window.scrollTo(0, savedScrollYRef.current);
        ScrollTrigger.refresh();
      },
    });
  };

  // The profile photo is very high resolution and stays at opacity 0 until the
  // scroll trigger reveals it, so the browser would defer its decode until that
  // first paint — a long synchronous main-thread stall. Decoding it right after
  // mount (asynchronously, off the critical path) makes the reveal free.
  useEffect(() => {
    profileImgRef.current?.decode?.().catch(() => {
      // Decode can reject (e.g. navigation away mid-decode); paint-time decode
      // remains the fallback.
    });
  }, []);

  // Belt-and-suspenders re-measure: web fonts finishing their swap after the
  // mount-time ScrollTrigger.refresh() (see the morph-targets effect) shift
  // text metrics — and therefore section heights — without firing any of the
  // events ScrollTrigger already listens for. Left uncorrected, every
  // scroll-position-dependent trigger (the footer's white reveal included)
  // silently drifts off the real, final layout. Cheap and idempotent, so it
  // is safe to call again even if nothing actually shifted.
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    document.fonts?.ready?.then(refresh).catch(() => {});
    return () => window.removeEventListener('load', refresh);
  }, []);

  // Project videos: engaged with lead time, not from mount. `preload`
  // stays light (metadata only) so nothing streams while the visitor is
  // still in the hero, but a generous rootMargin starts real playback well
  // before each project reaches the viewport — the same "arrive already in
  // motion" lead-time idea the idle hero cube uses (see
  // restPresenceForRect in src/systems/cubeMorph.js) — so the video is
  // already rolling, not just visible, the moment it's seen. Paused again
  // once truly out of view to hand the bandwidth back.
  useEffect(() => {
    const app = appRef.current;
    if (!app || prefersReducedMotion) return;

    const videos = Array.from(app.querySelectorAll('.project__video'));
    if (videos.length === 0) return;

    const observer = new IntersectionObserver(
      (observed) => {
        observed.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting) {
            video.play().catch(() => {
              // Autoplay can still be refused in odd embedding contexts;
              // the visible <video controls> reduced-motion path already
              // covers users who need an explicit play affordance.
            });
          } else {
            video.pause();
          }
        });
      },
      { rootMargin: '50% 0px' },
    );

    videos.forEach((video) => observer.observe(video));

    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  // Lenis + ScrollTrigger wiring and the global scroll progress feed for the canvas.
  useGSAP(
    () => {
      const html = document.documentElement;
      html.classList.add('lenis', 'lenis-smooth');

      // Perceived inertia (see src/systems/resistance.js): inside the
      // important scenes, physical scroll input is quietly scaled down so
      // the projects feel like they have weight. Hierarchy: flagship
      // heaviest, project 2 medium, profile barely, footer none.
      const resistance = createScrollResistance([
        { getEl: () => project1TriggerRef.current, multiplier: 0.55 },
        { getEl: () => project2TriggerRef.current, multiplier: 0.72 },
        { getEl: () => profileTriggerRef.current, multiplier: 0.88 },
      ]);

      const lenis = new Lenis({
        duration: 2.2,
        easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
        smoothWheel: true,
        virtualScroll: resistance.virtualScroll,
      });
      lenisRef.current = lenis;

      // Lenis scrolls the window natively, so ScrollTrigger needs no scrollerProxy —
      // keeping them in sync only requires the update hook + shared ticker.
      lenis.on('scroll', ScrollTrigger.update);

      const onTick = (time, deltaTime) => {
        resistance.update(deltaTime / 1000);
        lenis.raf(time * 1000);
      };

      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);

      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          scrollProgressRef.current = self.progress;
        },
      });

      return () => {
        gsap.ticker.remove(onTick);
        gsap.ticker.lagSmoothing(500, 33);
        lenis.destroy();
        lenisRef.current = null;
        html.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling');
        scrollProgressRef.current = 0;
      };
    },
    { scope: appRef },
  );

  // Morph targets + scroll choreography.
  //
  // Not every section deserves the same scroll time: this effect is where
  // the portfolio's attention hierarchy actually gets built, on top of the
  // same cube ↔ DOM-card morph used everywhere (see src/systems/cubeMorph.js).
  //
  // The story is proof-first — work, then the person behind it — so the
  // page's own DOM order now is: Hero → Project 1 (flagship) → Project 2
  // (selected) → Profile → Footer. This effect creates its ScrollTriggers in
  // that same order for one concrete reason (see below), not for style.
  //
  //   Hero       — no entry here: natural scroll, no pin, fast intro.
  //   Projects   — NOT morph targets: no card, no cube hand-off. The
  //                flagship still gets a dedicated pin — see
  //                addProjectReveal below — so the video is guaranteed real
  //                dwell time, but nothing in it is a glass card animating
  //                into existence; the video is simply present and already
  //                playing, only the identity label and copy are staged.
  //   Profile    — the closing MOMENT, the identity reveal now placed after
  //                both projects. Pinned ~1.9 viewports: cube → portrait
  //                morph first, then the text arrives in staged beats while
  //                still pinned. The visitor already knows the work; this
  //                is the "why".
  //   Footer     — continuous, unpinned, lighter. Same morph, no stage.
  //   Bridges    — not morph targets at all: director beats (a later
  //                effect) that the WebGL world itself performs; the
  //                statements live on the layer behind the canvas.
  //
  // Each pinned section still uses exactly two ScrollTriggers on the same
  // element: one pinned (drives the enter, and the hold if any), one natural
  // (drives the exit once the section later scrolls away unpinned). Both
  // read live off each other's `.progress` so the morph value is always
  // correct regardless of which one last fired — no shared mutable state to
  // get out of sync.
  //
  // Deliberately runs before every other scroll-trigger-creating effect in
  // this component (hero excepted — it has no post-pin dependents): pinning
  // inserts a pin-spacer that pushes everything after it further down the
  // page, so any trigger whose element comes after a pin (the statement
  // bridges, the moment beats, the footer's own animations, and now the
  // Profile pin itself, which sits after the Project 1 pin in the DOM) must
  // be created only once the earlier pins already exist — otherwise it
  // caches its position against the shorter, pre-pin page and never
  // correctly re-measures later, even across an explicit
  // ScrollTrigger.refresh(). Concretely: the "Built to solve." statement
  // would start wiping in while still deep inside the flagship's pin instead
  // of after it. This is also why the target-creation calls below run in
  // DOM order (Project 1 → Project 2 → Profile → Footer), not grouped by
  // breakpoint.
  useGSAP(
    () => {
      const app = appRef.current;
      if (!app) return;

      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: MQ_DESKTOP,
          isMobile: MQ_MOBILE,
          reduceMotion: MQ_REDUCED_MOTION,
        },
        (media) => {
          const { isDesktop, reduceMotion } = media.conditions;
          const entries = [];

          const collectShellAndContent = (card, companionSelector) => {
            const companion = companionSelector ? app.querySelector(companionSelector) : null;
            return {
              shellEls: companion ? [card, companion] : [card],
              contentEls: Array.from(card.children),
            };
          };

          // Continuous, unpinned target — used for Footer always, and as
          // the reduced-pin mobile fallback for Profile.
          const addContinuousTarget = (config) => {
            const card = app.querySelector(config.cardSelector);
            if (!card) return;

            const { shellEls, contentEls } = collectShellAndContent(
              card,
              config.companionSelector,
            );

            if (reduceMotion) {
              gsap.set([...shellEls, ...contentEls], { opacity: 1 });
              return;
            }

            gsap.set(shellEls, { opacity: 0 });

            const entry = {
              id: config.id,
              el: card,
              progressRef: { current: 0 },
              enterRange: config.enterRange,
              exitRange: config.exitRange,
              radiusPx: parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0,
            };

            const sync = (self) => {
              entry.progressRef.current = self.progress;
              const m = resolveMorphProgress(self.progress, config.enterRange, config.exitRange);
              gsap.set(shellEls, { opacity: cardRevealAlpha(m) });
              gsap.set(contentEls, { opacity: contentRevealAlpha(m) });
            };

            ScrollTrigger.create({
              trigger: config.trigger ?? card,
              start: config.start,
              end: config.end,
              scrub: SCRUB_WEIGHT,
              onUpdate: sync,
              // Restores the correct state after resize or a mid-page reload,
              // where onUpdate alone would leave stale opacities.
              onRefresh: sync,
            });

            entries.push(entry);
          };

          // Pinned target: `pinSectionEl` is held fixed in the viewport for
          // `pinViewports` of extra scroll — that pinned window IS the enter
          // transition (and, if `enterFraction` < 1, a static hold after it
          // finishes). The exit plays later, unpinned, over `exitStart` →
          // `exitEnd` of the same element's natural scroll-away.
          //
          // `stagedReveals` is what turns a pinned morph into a *moment*:
          // each { selector, range, y } gets its own sub-window of the pinned
          // scroll (range is over the raw pin progress, placed after
          // `enterFraction` so the cube finishes becoming the card first).
          // Nothing in a core moment fades in: each element is *uncovered* by
          // a left→right clip-path wipe (same grammar as the statement
          // bridges), with only a small settle in y for weight. Staged
          // elements are excluded from the generic content fade and inherit
          // the morph's own exit (contentRevealAlpha(m)) on the way out.
          const addPinnedTarget = ({
            id,
            cardSelector,
            companionSelector,
            pinSectionEl,
            pinViewports,
            enterFraction,
            exitStart,
            exitEnd,
            stagedReveals,
          }) => {
            const card = app.querySelector(cardSelector);
            if (!card || !pinSectionEl) return;

            const { shellEls, contentEls } = collectShellAndContent(card, companionSelector);

            const staged = (stagedReveals ?? []).flatMap(
              ({ selector, range, y = 48, fromScale = 1 }) =>
                Array.from(app.querySelectorAll(selector)).map((el) => ({
                  el,
                  range,
                  y,
                  fromScale,
                })),
            );
            const stagedSet = new Set(staged.map((s) => s.el));
            const morphContentEls = contentEls.filter((el) => !stagedSet.has(el));

            if (reduceMotion) {
              gsap.set(
                [...shellEls, ...contentEls, ...staged.map((s) => s.el)],
                { opacity: 1, clipPath: 'none', clearProps: 'transform' },
              );
              return;
            }

            gsap.set(shellEls, { opacity: 0 });
            staged.forEach((s) =>
              gsap.set(s.el, {
                clipPath: 'inset(0% 100% 0% 0%)',
                opacity: 1,
                y: s.y,
                scale: s.fromScale,
              }),
            );

            const entry = {
              id,
              el: card,
              progressRef: { current: 0 },
              // Both ScrollTriggers below resolve the morph value themselves
              // and write it straight to progressRef — enterRange [0, 1] is
              // an identity pass-through so downstream reads (WebGL) don't
              // need to know this target is special.
              enterRange: [0, 1],
              exitRange: null,
              radiusPx: parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0,
            };

            let enterTrigger;
            let exitTrigger;

            const recompute = () => {
              const enterRaw = enterTrigger ? enterTrigger.progress : 0;
              const exitProgress = exitTrigger ? exitTrigger.progress : 0;
              const enterM = phase01(enterRaw, [0, enterFraction]);
              const m = enterM < 1 ? enterM : 1 - exitProgress;

              entry.progressRef.current = m;
              gsap.set(shellEls, { opacity: cardRevealAlpha(m) });
              gsap.set(morphContentEls, { opacity: contentRevealAlpha(m) });

              // Staged elements: wiped open along their own slice of the pin
              // on the way in (clip-path, no fade), tied to the morph's
              // content fade on the way out only — the card is returning to
              // being a cube then, so the fade reads as part of the reversal
              // (enterRaw is already 1 by that point, so t holds at 1).
              const stagedExitAlpha = contentRevealAlpha(m);
              for (let i = 0; i < staged.length; i += 1) {
                const s = staged[i];
                const t = smoothstep(phase01(enterRaw, s.range));
                gsap.set(s.el, {
                  clipPath: `inset(0% ${(1 - t) * 100}% 0% 0%)`,
                  opacity: stagedExitAlpha,
                  y: (1 - t) * s.y,
                  scale: s.fromScale + (1 - s.fromScale) * t,
                });
              }
            };

            enterTrigger = ScrollTrigger.create({
              trigger: pinSectionEl,
              start: 'top top',
              // Function-based so a resize (address bar, DevTools, etc.)
              // re-measures the same *number* of viewports, not a stale px value.
              end: () => `+=${window.innerHeight * pinViewports}`,
              pin: true,
              pinSpacing: true,
              // Lenis carries momentum into the pin point, so without this the
              // engage can read as a small stutter — anticipatePin smooths it
              // out, which matters most here since "premium" is the whole point.
              anticipatePin: 1,
              scrub: SCRUB_WEIGHT,
              onUpdate: recompute,
              onRefresh: recompute,
            });

            exitTrigger = ScrollTrigger.create({
              trigger: pinSectionEl,
              start: exitStart,
              end: exitEnd,
              scrub: SCRUB_WEIGHT,
              onUpdate: recompute,
              onRefresh: recompute,
            });

            entries.push(entry);
          };

          // Project reveal — video-first, no card, no morph registration.
          // Unlike the targets above, the video is never gated behind an
          // opacity ramp: it is simply present and already playing the
          // moment its section arrives. Only the identity label and the
          // description are staged — uncovered gradually, on their own
          // slice of scroll, while the video keeps the whole frame. On
          // desktop the flagship additionally gets a dedicated pin (via
          // `pinViewports`) purely to guarantee dwell time: nothing here
          // assembles during it, the hold itself is the point.
          const addProjectReveal = ({ sectionEl, pinViewports, stagedReveals }) => {
            if (!sectionEl) return;

            const staged = stagedReveals.flatMap(({ selector, range, y = 20 }) =>
              Array.from(app.querySelectorAll(selector)).map((el) => ({ el, range, y })),
            );
            if (staged.length === 0) return;

            if (reduceMotion) {
              gsap.set(staged.map((s) => s.el), {
                opacity: 1,
                clipPath: 'none',
                clearProps: 'transform',
              });
              return;
            }

            staged.forEach((s) =>
              gsap.set(s.el, { clipPath: 'inset(0% 100% 0% 0%)', opacity: 1, y: s.y }),
            );

            const write = (rawProgress) => {
              for (let i = 0; i < staged.length; i += 1) {
                const s = staged[i];
                const t = smoothstep(phase01(rawProgress, s.range));
                gsap.set(s.el, {
                  clipPath: `inset(0% ${(1 - t) * 100}% 0% 0%)`,
                  y: (1 - t) * s.y,
                });
              }
            };

            if (pinViewports) {
              ScrollTrigger.create({
                trigger: sectionEl,
                start: 'top top',
                end: () => `+=${window.innerHeight * pinViewports}`,
                pin: true,
                pinSpacing: true,
                anticipatePin: 1,
                scrub: SCRUB_WEIGHT,
                onUpdate: (self) => write(self.progress),
                onRefresh: (self) => write(self.progress),
              });
            } else {
              ScrollTrigger.create({
                trigger: sectionEl,
                start: 'top 80%',
                end: 'bottom 25%',
                scrub: SCRUB_WEIGHT,
                onUpdate: (self) => write(self.progress),
                onRefresh: (self) => write(self.progress),
              });
            }
          };

          // MOMENT — The Flagship. The opening proof and the longest scene
          // in the portfolio. Reveal quickly, stay longer, leave gracefully:
          // a brief arrival (video alone — just long enough to create
          // curiosity), then the title, then the glass explanation — all of
          // it on screen by roughly the pin's midpoint. Everything after
          // that is HOLD: the longest part of the scene, nothing left to
          // unlock, time to simply watch. The visitor never waits for
          // information; the remaining distance exists to appreciate it.
          if (isDesktop) {
            addProjectReveal({
              sectionEl: project1TriggerRef.current,
              pinViewports: FLAGSHIP_PIN_VIEWPORTS,
              stagedReveals: [
                {
                  selector: '[data-project="buongesto"] .project__label',
                  range: [0.22, 0.32],
                  y: 18,
                },
                // A real settle between title and explanation — one focal
                // point at a time; the gap is wide enough that the scrub
                // lag can never blur the two reveals into one event.
                {
                  selector: '[data-project="buongesto"] .project__desc',
                  range: [0.44, 0.56],
                  y: 14,
                },
              ],
            });
          } else {
            // Mobile: pinning fights address-bar resize and touch scroll
            // expectations, so the flagship falls back to a continuous pass
            // — with reveals early enough in the pass that everything is
            // readable well before the section is centered, and nothing
            // can be scrolled past unseen.
            addProjectReveal({
              sectionEl: project1TriggerRef.current,
              stagedReveals: [
                // Starts once the preceding statement has released — one
                // focal point at a time — but still completes while the
                // video is only approaching center: early payoff, and the
                // rest of the pass is spent with the full scene.
                {
                  selector: '[data-project="buongesto"] .project__label',
                  range: [0.3, 0.44],
                  y: 18,
                },
                {
                  selector: '[data-project="buongesto"] .project__desc',
                  range: [0.48, 0.62],
                  y: 14,
                },
              ],
            });
          }

          // Project 2 — Selected Work. Two stars, not five: same
          // video-first grammar, but compressed — a much shorter pin whose
          // only job is guaranteeing the explanation is read, reveals even
          // earlier, minimal ceremony. Proof continuing, not competing.
          if (isDesktop) {
            addProjectReveal({
              sectionEl: project2TriggerRef.current,
              pinViewports: PROJECT2_PIN_VIEWPORTS,
              stagedReveals: [
                {
                  selector: '[data-project="deckforge"] .project__label',
                  range: [0.16, 0.28],
                  y: 18,
                },
                // The settle between title and panel is proportionally wider
                // here than on the flagship: the pin is short, so a narrow
                // gap would blur through the scrub lag into one event.
                {
                  selector: '[data-project="deckforge"] .project__desc',
                  range: [0.4, 0.52],
                  y: 14,
                },
              ],
            });
          } else {
            addProjectReveal({
              sectionEl: project2TriggerRef.current,
              stagedReveals: [
                {
                  selector: '[data-project="deckforge"] .project__label',
                  range: [0.3, 0.44],
                  y: 18,
                },
                {
                  selector: '[data-project="deckforge"] .project__desc',
                  range: [0.48, 0.62],
                  y: 14,
                },
              ],
            });
          }

          // MOMENT — The Person. The closing beat, now that the work has
          // already spoken. Two stages inside one pin: the cube becomes the
          // portrait (first ~55% of the pin), and only then do the words
          // arrive — card, then title, then copy — each rising on its own
          // slice of scroll, calmer and slower than either project moment
          // (see the gentler compressionScale on this beat below).
          if (isDesktop) {
            addPinnedTarget({
              id: 'profile',
              cardSelector: '.profile-photo-dom',
              pinSectionEl: profileTriggerRef.current,
              pinViewports: PROFILE_PIN_VIEWPORTS,
              enterFraction: 0.5,
              // The card's actual fade-to-invisible only spans the first
              // ~38% of this range (cardRevealAlpha only reacts to morph
              // m ∈ [0.62, 0.94]), so it must fully resolve before the
              // footer's own reveal begins — otherwise the white reveal
              // wipes in while the profile card is still visibly fading out
              // behind it.
              exitStart: 'bottom 75%',
              exitEnd: 'bottom 25%',
              // Early payoff here too: the words are fully on screen by
              // ~78% of the pin, leaving a real hold — the visitor spends
              // the tail of the scene with the person, not waiting for the
              // last line to unlock.
              stagedReveals: [
                { selector: '.profile-text-dom', range: [0.52, 0.66], y: 26 },
                { selector: '.profile-text-dom h2', range: [0.56, 0.7], y: 16 },
                { selector: '.profile-text-dom p', range: [0.62, 0.78], y: 12 },
              ],
            });
          } else {
            // Mobile: pinning fights address-bar resize and touch scroll
            // expectations, so the profile falls back to a continuous
            // treatment — present, not staged.
            addContinuousTarget({
              id: 'profile',
              cardSelector: '.profile-photo-dom',
              companionSelector: '.profile-text-dom',
              trigger: profileTriggerRef.current,
              start: 'top 35%',
              end: 'bottom 70%',
              enterRange: [0, 0.46],
              exitRange: [0.66, 1],
            });
          }

          // Footer: never pinned, reveal only — scroll ends with it fully
          // visible, so there is no exit, the cube's final state IS the card.
          addContinuousTarget({
            id: 'footer-ai',
            cardSelector: '.footer-ai-card',
            trigger: footerRef.current,
            start: 'top bottom',
            end: 'top top',
            enterRange: [0.28, 1],
            exitRange: null,
          });

          morphTargetsRef.current = entries;

          // Mount refresh: this is only for internal consistency among the
          // targets just created above (e.g. border-radius reads happening
          // before layout fully settles) — it runs before any later effect
          // (hero excepted) creates its own triggers, so those measure
          // correctly against the pins on their first pass and never need
          // fixing up.
          ScrollTrigger.refresh();

          return () => {
            morphTargetsRef.current = [];
          };
        },
      );

      return () => {
        mm.revert();
      };
    },
    { scope: appRef },
  );

  // Hero entrance animation (one-shot, not scroll-driven).
  useGSAP(
    () => {
      const hero = heroRef.current;
      if (!hero) return;

      const lines = hero.querySelectorAll('.hero__line');
      const eyebrow = hero.querySelector('.hero__eyebrow');
      const cue = hero.querySelector('.hero__cue');
      const cueInner = hero.querySelector('.hero__cue-inner');
      const cueLine = hero.querySelector('.hero__cue-line');

      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: MQ_DESKTOP,
          isMobile: MQ_MOBILE,
          reduceMotion: MQ_REDUCED_MOTION,
        },
        (media) => {
          const { isDesktop, reduceMotion } = media.conditions;

          if (reduceMotion) {
            gsap.set([lines, eyebrow, cueInner], {
              y: 0,
              opacity: 1,
              clearProps: 'transform',
            });
            return;
          }

          const lineY = isDesktop ? 120 : 100;
          const lineDuration = isDesktop ? 1.15 : 0.95;
          const lineStagger = isDesktop ? 0.09 : 0.07;

          gsap.set(lines, { y: lineY, opacity: 0 });
          gsap.set(eyebrow, { y: 24, opacity: 0 });
          gsap.set(cueInner, { y: 12, opacity: 0 });

          gsap
            .timeline({ delay: 0.12 })
            .to(lines, {
              y: 0,
              opacity: 1,
              duration: lineDuration,
              stagger: lineStagger,
              ease: 'power4.out',
            })
            .to(
              eyebrow,
              { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' },
              0,
            )
            // The cue arrives last, once the headline has landed — a quiet
            // invitation rather than another element competing for attention.
            .to(
              cueInner,
              { y: 0, opacity: 1, duration: 0.9, ease: 'power2.out' },
              0.95,
            );

          // Idle breathing on the cue line — slow, weighted, never mechanical.
          gsap.fromTo(
            cueLine,
            { scaleY: 0.3, transformOrigin: 'top center' },
            {
              scaleY: 1,
              duration: 1.5,
              ease: 'power2.inOut',
              repeat: -1,
              yoyo: true,
              delay: 1.4,
            },
          );

          // Cinematic exit: as the hero scrolls away, each headline line is
          // swallowed by its own mask at a slightly different rate (yPercent
          // composes with the entrance's y px, so the two never fight), and
          // the cue dissolves the instant intent to scroll is expressed.
          // Anticipation for Bridge 01 starts here, not at the bridge.
          gsap
            .timeline({
              scrollTrigger: {
                trigger: hero,
                start: 'top top',
                end: 'bottom top',
                scrub: SCRUB_WEIGHT,
              },
            })
            .to(
              lines,
              {
                yPercent: (i) => -(16 + i * 10),
                duration: 1,
                ease: 'power1.in',
              },
              0,
            )
            .to(cue, { autoAlpha: 0, duration: 0.22, ease: 'power1.out' }, 0);
        },
      );

      return () => {
        mm.revert();
      };
    },
    { scope: heroRef },
  );

  // Footer: pinned-height sync, white background reveal and entrance timeline.
  useGSAP(
    () => {
      const footer = footerRef.current;
      const footerBg = footerBgRef.current;
      if (!footer || !footerBg) return;

      // A floor, not a fixed size: the footer must always be at least one
      // viewport tall (so the full-bleed reveal below never looks like it's
      // opening onto a half-empty screen), but it must be free to grow past
      // that when its own content — headline, CTA, nav grid, AI card,
      // wordmark — needs more room, otherwise that content gets clipped.
      const syncFooterHeight = () => {
        footer.style.minHeight = `${window.innerHeight}px`;
      };

      syncFooterHeight();
      // Re-measure right before every ScrollTrigger refresh (including its own
      // debounced resize handling) instead of thrashing on raw resize events.
      ScrollTrigger.addEventListener('refreshInit', syncFooterHeight);

      // Espansione CSS 2D dello sfondo bianco, sincronizzata con il progresso 3D
      // (un solo trigger alimenta sia il tween che il canvas).
      gsap.fromTo(
        footerBg,
        { clipPath: 'inset(50%)' }, // Punto microscopico al centro dello schermo
        {
          clipPath: 'inset(0%)', // Si apre rivelando lo schermo intero
          ease: 'power2.inOut', // Matematicamente simile all'easeInOutCubic del WebGL
          scrollTrigger: {
            // Anchored to the footer's own entry into view, not to the tail
            // of the previous section — the reveal only starts once the
            // footer is genuinely emerging from the bottom of the viewport.
            trigger: footer,
            start: 'top 80%',
            end: 'top 20%',
            scrub: 1,
            onUpdate: (self) => {
              footerProgressRef.current = self.progress;
            },
          },
        },
      );

      const headline = footer.querySelector('.footer__headline');
      const cta = footer.querySelector('.footer__cta');
      const logo = footer.querySelector('.footer__logo');

      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: MQ_DESKTOP,
          isMobile: MQ_MOBILE,
          reduceMotion: MQ_REDUCED_MOTION,
        },
        (media) => {
          const { isDesktop, isMobile, reduceMotion } = media.conditions;

          if (reduceMotion) {
            gsap.set([headline, cta, logo], {
              y: 0,
              opacity: 1,
              scale: 1,
              clearProps: 'transform',
            });
            return;
          }

          if (isMobile) {
            gsap.set([headline, cta, logo], { y: 20, opacity: 0 });

            gsap.to([headline, cta, logo], {
              y: 0,
              opacity: 1,
              duration: 0.65,
              stagger: 0.06,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: footer,
                start: 'top 92%',
                toggleActions: 'play none none reverse',
              },
            });
            return;
          }

          if (isDesktop) {
            // The footer is the quietest moment on the page — one star of
            // the motion hierarchy. The white reveal (the clip-path opening
            // behind everything) IS the event; the content itself just
            // rises gently into place as one gesture. No scale ceremony,
            // no per-element choreography: by this point the site has said
            // everything, and stillness closes it better than motion.
            gsap.set([headline, cta, logo], { y: 28, opacity: 0 });

            gsap.to([headline, cta, logo], {
              y: 0,
              opacity: 1,
              duration: 0.9,
              stagger: 0.08,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: footer,
                start: 'top 85%',
                toggleActions: 'play none none reverse',
              },
            });
          }
        },
      );

      return () => {
        ScrollTrigger.removeEventListener('refreshInit', syncFooterHeight);
        mm.revert();
        footerProgressRef.current = 0;
        footer.style.minHeight = '';
      };
    },
    { scope: appRef },
  );

  // Director beats — the narrative bus both layers read.
  //
  // Bridges: each empty runway drives one beat. The DOM side (here) writes
  // the statement wipe — clip-path only, uncovered center-outward from the
  // negative space the world just opened, never faded or slid — and the
  // release parallax (the world moves past the text; the text never
  // "disappears"). The WebGL side reads the same progress ref to calm and
  // compress the cluster and to lean the camera in. One number drives both
  // layers, so cause and effect can never desync.
  //
  // Moments: the profile, flagship and footer register silent beats with no
  // DOM writes at all — they exist purely so the world falls quiet during
  // the approach (anticipation), stays quiet through the morph, and fires an
  // energy impulse when the moment has been fully experienced (release).
  useGSAP(
    () => {
      const app = appRef.current;
      if (!app) return;

      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: MQ_DESKTOP,
          isMobile: MQ_MOBILE,
          reduceMotion: MQ_REDUCED_MOTION,
        },
        (media) => {
          const { isDesktop, reduceMotion } = media.conditions;

          // Reduced motion: no beats, no fixed layer (hidden via CSS); the
          // static statement copies in the runways are shown instead.
          if (reduceMotion) return;

          const beats = [];

          // Temporal order along the page — NOT creation order — is what the
          // WebGL camera language (see BackgroundScene) alternates its lean
          // pattern by, so consecutive *beats-as-actually-experienced* never
          // repeat the same subtle gesture: bridge-code(0) → moment-flagship
          // (1) → bridge-work(2) → moment-deckforge(3) → bridge-solve(4) →
          // moment-profile(5) → moment-footer(6).
          const BEAT_ORDER = { code: 0, work: 2, solve: 4 };

          app.querySelectorAll('.bridge').forEach((runway) => {
            const key = runway.dataset.bridge;
            const statement = app.querySelector(`.statement[data-statement="${key}"]`);
            if (!statement) return;

            const lineEl = statement.querySelector('.statement__line');

            gsap.set(lineEl, { clipPath: 'inset(0% 50% 0% 50%)' });
            gsap.set(statement, { visibility: 'hidden', yPercent: 0, scale: 1 });

            const entry = {
              id: `bridge-${key}`,
              kind: 'bridge',
              order: BEAT_ORDER[key],
              progressRef: { current: 0 },
              ...BRIDGE_BEAT,
            };

            const write = (self) => {
              const p = self.progress;
              entry.progressRef.current = p;

              // Uncovered center-outward — out of the exact negative space
              // the cluster cleared during compression. The statement is a
              // consequence of the world's motion, not an arrival.
              const side = (1 - statementWipe(p)) * 50;
              gsap.set(lineEl, { clipPath: `inset(0% ${side}% 0% ${side}%)` });

              // Release: the statement rejoins the world's flow — it moves up
              // and away like page content (yPercent of the full-viewport
              // statement ≈ viewport units), fully off-screen by p = 1, so
              // the visibility latch below never cuts anything visible.
              // Translate + scale only; the text is never faded out.
              const exit = beatExit(p);
              gsap.set(statement, {
                visibility: p > 0.001 && p < 0.999 ? 'visible' : 'hidden',
                yPercent: -exit * 72,
                scale: 1 - exit * 0.05,
              });
            };

            ScrollTrigger.create({
              trigger: runway,
              start: 'top 85%',
              end: 'bottom 15%',
              // Heaviest lag on the page — the statement is typography, and
              // typography should feel like it has the most inertia of
              // anything the visitor sees.
              scrub: SCRUB_WEIGHT_HEAVY,
              onUpdate: write,
              onRefresh: write,
            });

            beats.push(entry);
          });

          // Moment beats: silence on approach, release impulse at the end.
          // On desktop the beat spans approach + the entire pinned window
          // (1 viewport of approach + `pinViewports` of pin), so calm holds
          // through the whole morph and releases just before the unpin.
          const addMomentBeat = (id, el, pinViewports, order, compressionScale = 0.45) => {
            if (!el) return;

            const entry = {
              id,
              kind: 'moment',
              order,
              progressRef: { current: 0 },
              compressionScale,
            };

            let end;
            if (isDesktop) {
              const total = 1 + pinViewports;
              entry.calmIn = [0.05, Math.min(0.9 / total, 0.5)];
              entry.calmOut = [0.92, 1];
              entry.releaseAt = 0.92;
              end = () => `+=${window.innerHeight * total}`;
            } else {
              // No pin on mobile: the beat rides the section's natural pass.
              entry.calmIn = [0.05, 0.35];
              entry.calmOut = [0.6, 0.9];
              entry.releaseAt = 0.6;
              end = 'bottom center';
            }

            const write = (self) => {
              entry.progressRef.current = self.progress;
            };

            ScrollTrigger.create({
              trigger: el,
              start: 'top bottom',
              end,
              scrub: true,
              onUpdate: write,
              onRefresh: write,
            });

            beats.push(entry);
          };

          // DOM order matters here too (see the morph-targets effect above).
          // Motion hierarchy in the compressionScale values: the flagship's
          // beat recedes the world hardest (it owns the page's motion
          // budget), project 2 noticeably less (support, not competition),
          // and the profile gentlest of all — reflective, never as dramatic
          // as the work it follows.
          addMomentBeat('moment-flagship', project1TriggerRef.current, FLAGSHIP_PIN_VIEWPORTS, 1);
          addMomentBeat('moment-deckforge', project2TriggerRef.current, PROJECT2_PIN_VIEWPORTS, 3, 0.35);
          addMomentBeat('moment-profile', profileTriggerRef.current, PROFILE_PIN_VIEWPORTS, 5, 0.3);

          // Trust — the finale inherits the same grammar: the world settles
          // as the white reveal approaches, then releases once the page has
          // fully opened. No DOM writes; the footer's own choreography (the
          // clip-path reveal, the AI-card morph) is the visible half.
          const footerEl = footerRef.current;
          if (footerEl) {
            const entry = {
              id: 'moment-footer',
              kind: 'moment',
              order: 6,
              progressRef: { current: 0 },
              compressionScale: 0.25,
              calmIn: [0.08, 0.5],
              calmOut: [0.82, 1],
              releaseAt: 0.82,
            };
            const write = (self) => {
              entry.progressRef.current = self.progress;
            };
            ScrollTrigger.create({
              trigger: footerEl,
              start: 'top bottom',
              end: 'top top',
              scrub: true,
              onUpdate: write,
              onRefresh: write,
            });
            beats.push(entry);
          }

          beatsRef.current = beats;

          return () => {
            beatsRef.current = [];
          };
        },
      );

      return () => {
        mm.revert();
      };
    },
    { scope: appRef },
  );

  return (
    <div ref={appRef} className="app w-full overflow-x-clip">
      {/* LAYER BACKGROUNDS 
        Questi div fissi rimpiazzano il background del Canvas. 
        Ci permettono di usare il clip-path CSS mantenendo l'effetto tridimensionale profondo.
      */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ backgroundColor: '#f5f5f5', zIndex: -20 }} aria-hidden="true" />
      <div 
        ref={footerBgRef} 
        className="fixed inset-0 pointer-events-none overflow-hidden" 
        style={{ backgroundColor: '#ffffff', zIndex: -15, clipPath: 'inset(50%)' }} 
        aria-hidden="true" 
      />

      {/* Statement layer sits BETWEEN the backgrounds and the canvas: the
          wireframe world draws over the letters — text inside the world. */}
      <StatementLayer />

      <div className="canvas-layer fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -10 }} aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0, 6], fov: 42 }}
          dpr={[1, 1.5]} // Cap DPR on Super Retina — fewer pixels, stable frame rate
          gl={{ antialias: true, alpha: true }}
        >
          <BackgroundScene
            scrollProgressRef={scrollProgressRef}
            footerProgressRef={footerProgressRef}
            morphTargetsRef={morphTargetsRef}
            beatsRef={beatsRef}
            intakeProgressRef={intakeProgressRef}
            reconstructProgressRef={reconstructProgressRef}
          />
        </Canvas>
      </div>

      <div ref={domLayerRef} className="dom-layer w-full overflow-x-clip">
        <header
          ref={heroRef}
          className="hero relative flex min-h-screen w-full max-w-full flex-col items-start justify-center overflow-clip px-[clamp(1.5rem,4vw,4rem)]"
        >
          <div className="w-full relative z-10 flex flex-col justify-center bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.85)_0%,_rgba(255,255,255,0)_70%)] md:bg-none">
            <p className="hero__eyebrow mb-[clamp(0.75rem,2vw,1.25rem)] text-xs uppercase tracking-widest text-neutral-500">
              FLAVIO DONNINI — WEB ENGINEER
            </p>

            <h1
              className="heading-hero w-full max-w-full text-[clamp(3rem,11vw,12rem)] font-bold leading-[0.9] tracking-[0.02em]"
              aria-label={HERO_LINES.join(' ')}
            >
              {HERO_LINES.map((line) => (
                <span key={line} className="hero__line-mask">
                  <span className="hero__line">{line}</span>
                </span>
              ))}
            </h1>
          </div>

          {/* Scroll cue: outer node owns the scroll-out fade, inner node owns
              the entrance — no property collisions between the two tweens. */}
          <div
            className="hero__cue absolute bottom-[clamp(1.5rem,4vh,3rem)] left-1/2 -translate-x-1/2"
            aria-hidden="true"
          >
            <div className="hero__cue-inner flex flex-col items-center gap-3">
              <span className="label">SCROLL</span>
              <span className="hero__cue-line block h-12 w-px bg-neutral-400" />
            </div>
          </div>
        </header>

        {/* Curiosity → proof: the first thing a founder should see after the
            hero is the work itself, not the person behind it. */}
        <BridgeRunway id="code" text={BRIDGES.code.text} />

        <div className="shell">
          <section
            id="work"
            ref={project1TriggerRef}
            // h-screen (not min-h-screen) + overflow-hidden: this section is
            // pinned at top:0 for its scroll scene, so it must never render
            // taller than one viewport — the video's own max-h caps plus the
            // description's overflow safety valve (see ProjectReveal) are
            // what keep the whole assembly inside that budget. Project 2
            // below isn't pinned, so it keeps min-h-screen — natural
            // overflow there is harmless.
            className="work h-screen overflow-hidden flex items-center justify-center w-full py-8 md:py-12"
          >
            <ProjectReveal project={PROJECTS[0]} reducedMotion={prefersReducedMotion} />
          </section>
        </div>

        {/* Proof, continuing: deceleration into the second project. */}
        <BridgeRunway id="work" text={BRIDGES.work.text} />

        <div className="shell">
          <section
            ref={project2TriggerRef}
            // Same one-viewport budget as the flagship: this section is also
            // pinned (much more briefly) on desktop, so it must never render
            // taller than the viewport it is held in.
            className="work h-screen overflow-hidden flex items-center justify-center w-full py-8 md:py-12"
          >
            <ProjectReveal project={PROJECTS[1]} reducedMotion={prefersReducedMotion} />
          </section>
        </div>

        {/* Proof → why: the visitor already knows the work is good. Now they
            learn who built it and why — the profile is the explanation, not
            the introduction. */}
        <BridgeRunway id="solve" text={BRIDGES.solve.text} />

        <section
          id="about"
          ref={profileTriggerRef}
          className="relative flex min-h-[120dvh] w-full items-center px-[clamp(2rem,6vw,6rem)] select-none md:min-h-screen"
        >
          <div className="flex w-full flex-col gap-12 md:flex-row md:items-center md:gap-[clamp(2rem,5vw,4rem)]">
            <div className="flex w-full justify-center md:w-[40%] md:justify-start">
              <div className="profile-photo-dom opacity-0 relative z-10 flex w-full max-w-[450px] flex-col items-center justify-center rounded-3xl border border-neutral-300 bg-white/70 p-4 shadow-2xl backdrop-blur-xl">
                <img
                  ref={profileImgRef}
                  src="/foto1.webp"
                  alt="Flavio Donnini"
                  width={4896}
                  height={6528}
                  decoding="async"
                  className="h-auto w-full rounded-2xl object-cover grayscale"
                />
              </div>
            </div>

            <div className="profile-text-dom opacity-0 w-full md:w-[60%] flex flex-col justify-center p-8 md:p-12 bg-white/70 backdrop-blur-xl border border-neutral-300 rounded-3xl shadow-2xl relative z-10">
              <h2 className="mb-8 text-[clamp(3rem,6vw,6rem)] font-bold uppercase leading-none tracking-tight text-black break-words">
                DIGITAL ENGINEERING.
              </h2>
              <p className="max-w-2xl text-xl font-medium leading-relaxed text-neutral-800 md:text-2xl">
                I build high-performance web architectures and interactive canvases.
              </p>
            </div>
          </div>
        </section>

        {/* Why → trust: no statement here — the white reveal itself is the
            transition. This runway only gives the world room to settle
            before the page opens (the footer's silent beat above). */}
        <div className="relative min-h-[100dvh] w-full" aria-hidden="true" />

        {/* FOOTER SENZA BG-WHITE 
          Ora è trasparente. Lo sfondo bianco che vediamo è il div animato dietro il Canvas.
        */}
        <footer
          ref={footerRef}
          className="relative flex min-h-[100dvh] max-h-[100dvh] w-full max-w-full shrink-0 flex-col justify-between overflow-hidden px-[clamp(1.5rem,4vw,4rem)] py-[clamp(1.5rem,3.5vh,3.5rem)] font-sans text-black"
        >
          {/* Strict 12-column grid on desktop: headline owns cols 1–7, the nav
            owns cols 8–12. Both start on the same row so their top edges are
            hard-locked to one another — nothing floats. */}
          <div className="flex w-full flex-col gap-[clamp(2rem,5vw,4rem)] xl:grid xl:grid-cols-12 xl:items-start xl:gap-x-[clamp(1rem,3vw,2rem)] xl:gap-y-0">
            <div className="flex w-full flex-col items-start gap-[clamp(1.5rem,3vw,2.5rem)] xl:col-span-7">
              {/* Big and bold, but one step below the wordmark: the name at
                the bottom stays the single anchor of the page. The min(vw,vh)
                cap keeps it from overflowing short screens. */}
              <h2 className="footer__headline w-full max-w-[13ch] text-[clamp(2.5rem,min(6vw,10vh),6rem)] font-bold uppercase leading-[0.92] tracking-[0.01em]">
                HOW ABOUT WE DO A THING OR TWO.
              </h2>
              <CornerButton className="footer__cta" onClick={openIntake}>
                Get in touch
              </CornerButton>
            </div>

            <div className="grid w-full min-w-0 grid-cols-1 gap-x-[clamp(1rem,3vw,2rem)] gap-y-[clamp(1.5rem,4vw,2.5rem)] md:grid-cols-2 xl:col-span-5 xl:mt-0 xl:grid-cols-4">
              {FOOTER_NAV.map((column) => (
                <div key={column.title} className="flex min-w-0 flex-col gap-4">
                  <span className="text-xs uppercase tracking-widest text-neutral-400">
                    {column.title}
                  </span>
                  <nav aria-label={column.title} className="flex flex-col gap-2 text-xs uppercase tracking-wide">
                    {column.links.map((link) => {
                      const isExternal = link.href.startsWith('http');

                      return (
                        <a
                          key={link.label}
                          href={link.href}
                          {...(isExternal
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {})}
                          className="break-words transition-opacity hover:opacity-50"
                        >
                          {link.label}
                        </a>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-[clamp(1.5rem,4vh,4rem)] flex w-full flex-col items-start gap-[clamp(1.5rem,4vw,2.5rem)] xl:flex-row xl:items-end xl:justify-between">
            {/* AI interaction card — a morph destination: the hero cube lands
              here and becomes this card at the end of the page. */}
            <div className="footer-ai-card shrink-0 rounded-3xl border border-neutral-300 bg-white/70 p-6 shadow-2xl backdrop-blur-xl">
              <p className="max-w-xs text-xs uppercase tracking-widest text-neutral-500">
                ASK AI FOR A SUMMARY OF FLAVIO DONNINI.
              </p>
              <div className="mt-4 flex gap-2" aria-hidden="true">
                {[0, 1, 2, 3].map((icon) => (
                  <div key={icon} className="size-8 border border-black bg-neutral-100" />
                ))}
              </div>
            </div>

            {/* The anchor of the whole page: bigger than everything else,
              free to wrap onto two right-aligned lines on desktop. The vh cap
              keeps the two-line block inside a single viewport. */}
            <p className="footer__logo w-full min-w-0 max-w-full text-left text-[clamp(2.75rem,min(13.5vw,18vh),15rem)] font-bold uppercase leading-[0.9] tracking-[0.01em] xl:text-right">
              FLAVIO DONNINI.
            </p>
          </div>
        </footer>
      </div>

      {/* Project intake — application state, not a modal/page. The WebGL
          scene stays mounted and participates via intakeProgressRef. */}
      <div
        ref={intakeShellRef}
        className="intake-shell"
        aria-hidden={!intakeOpen}
      >
        {intakeMounted ? (
          <IntakeExperience
            active={intakeOpen}
            reducedMotion={prefersReducedMotion}
            onClose={closeIntake}
            reconstructProgressRef={reconstructProgressRef}
          />
        ) : null}
      </div>
    </div>
  );
}
