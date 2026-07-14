import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import BackgroundScene from './components/BackgroundScene.jsx';
import { BrandButton } from './components/BrandButton';
import { useMediaQuery } from './hooks/useMediaQuery.js';
import {
  cardRevealAlpha,
  contentRevealAlpha,
  resolveMorphProgress,
} from './systems/cubeMorph.js';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Single source of truth for every gsap.matchMedia() breakpoint in this page.
const MQ_DESKTOP = '(min-width: 768px)';
const MQ_MOBILE = '(max-width: 767px)';
const MQ_REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const MQ_NO_MOTION_PREFERENCE = '(prefers-reduced-motion: no-preference)';

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
    video: '/buongesto-horizontal.mp4',
    description:
      'Crowdfunding infrastructure rendering 100k+ interactive blocks at 60fps. React + Three.js layout engine with unified scroll, physics, and GPU batching for high-density node synchronization.',
  },
  {
    id: 'deckforge',
    title: 'Deckforge',
    video: '/deckforge-horizontal.mp4',
    description:
      'Spatial computation platform for real-time architectural visualization. Custom scene graph, instanced geometry pipeline, and scroll-synced camera choreography across 40k+ structural nodes.',
  },
];

function ProjectCard({ project, reducedMotion }) {
  return (
    <article
      className="flex flex-col gap-6 p-6 md:p-12 bg-white/70 backdrop-blur-xl border border-neutral-300 rounded-3xl relative z-10 w-full mb-24 shadow-2xl"
      data-project={project.id}
    >
      <h2 className="text-[clamp(3rem,6vw,5rem)] font-bold leading-none uppercase tracking-tight break-words">
        {project.title}
      </h2>

      <p className="text-lg md:text-xl font-medium max-w-3xl text-neutral-800 leading-relaxed break-words">
        {project.description}
      </p>

      <div className="w-full h-auto mt-4 overflow-hidden rounded-xl border border-neutral-200 shadow-lg">
        <video
          src={project.video}
          aria-label={`${project.title} — project preview`}
          autoPlay={!reducedMotion}
          controls={reducedMotion}
          loop
          muted
          playsInline
          preload={reducedMotion ? 'metadata' : 'none'}
          className="w-full h-auto object-cover"
        />
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
  // Registry read by the WebGL scene each frame: every glass card that the
  // hero cube can morph into (see src/systems/cubeMorph.js).
  const morphTargetsRef = useRef([]);

  const prefersReducedMotion = useMediaQuery(MQ_REDUCED_MOTION);

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

  // Lenis + ScrollTrigger wiring and the global scroll progress feed for the canvas.
  useGSAP(
    () => {
      const html = document.documentElement;
      html.classList.add('lenis', 'lenis-smooth');

      const lenis = new Lenis({
        duration: 2.2,
        easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
        smoothWheel: true,
      });

      // Lenis scrolls the window natively, so ScrollTrigger needs no scrollerProxy —
      // keeping them in sync only requires the update hook + shared ticker.
      lenis.on('scroll', ScrollTrigger.update);

      const onTick = (time) => {
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
        html.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling');
        scrollProgressRef.current = 0;
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
            gsap.set([lines, eyebrow], { y: 0, opacity: 1, clearProps: 'transform' });
            return;
          }

          const lineY = isDesktop ? 120 : 100;
          const lineDuration = isDesktop ? 1.15 : 0.95;
          const lineStagger = isDesktop ? 0.09 : 0.07;

          gsap.set(lines, { y: lineY, opacity: 0 });
          gsap.set(eyebrow, { y: 24, opacity: 0 });

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
            );
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

      const syncFooterHeight = () => {
        const height = `${window.innerHeight}px`;
        footer.style.height = height;
        footer.style.minHeight = height;
        footer.style.maxHeight = height;
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
            trigger: footer,
            start: 'top bottom',
            end: 'top top',
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
            gsap.set(headline, { y: 80, opacity: 0 });
            gsap.set(cta, { y: 48, opacity: 0 });
            gsap.set(logo, {
              scale: 0.82,
              opacity: 0,
              transformOrigin: 'right center',
            });

            gsap
              .timeline({
                scrollTrigger: {
                  trigger: footer,
                  start: 'top 85%',
                  toggleActions: 'play none none reverse',
                },
              })
              .to(headline, {
                y: 0,
                opacity: 1,
                duration: 1.05,
                ease: 'power4.out',
              })
              .to(
                cta,
                { y: 0, opacity: 1, duration: 0.85, ease: 'power3.out' },
                '-=0.55',
              )
              .to(
                logo,
                { scale: 1, opacity: 1, duration: 1.25, ease: 'power4.out' },
                '-=0.65',
              );
          }
        },
      );

      // Single mount refresh, after the footer height is locked in. Runs last of
      // the mount effects, so every trigger re-measures against final layout.
      ScrollTrigger.refresh();

      return () => {
        ScrollTrigger.removeEventListener('refreshInit', syncFooterHeight);
        mm.revert();
        footerProgressRef.current = 0;
        footer.style.height = '';
        footer.style.minHeight = '';
        footer.style.maxHeight = '';
      };
    },
    { scope: appRef },
  );

  // Morph targets: each glass card registers a ScrollTrigger whose progress
  // feeds both layers of the same timeline — the WebGL cube (flight, corner
  // rounding, wireframe dissolve) and the DOM card reveal (glass shell first,
  // content just after). Adding a future card is one more entry here.
  useGSAP(
    () => {
      const app = appRef.current;
      if (!app) return;

      const targetConfigs = [
        {
          id: 'profile',
          cardSelector: '.profile-photo-dom',
          // Revealed on the same curve as the card, without being a cube target.
          companionSelector: '.profile-text-dom',
          trigger: profileTriggerRef.current,
          start: 'top 35%',
          end: 'bottom 70%',
          enterRange: [0, 0.34],
          exitRange: [0.72, 1],
        },
        // Project ranges are staggered on purpose: the delayed enter and the
        // early-finishing exit guarantee the previous card has fully released
        // the cube before the next one claims it — even on very tall
        // viewports where consecutive triggers overlap in scroll space.
        {
          id: 'project-buongesto',
          cardSelector: '[data-project="buongesto"]',
          start: 'top 80%',
          end: 'bottom 25%',
          enterRange: [0.14, 0.38],
          exitRange: [0.78, 0.95],
        },
        {
          id: 'project-deckforge',
          cardSelector: '[data-project="deckforge"]',
          start: 'top 80%',
          end: 'bottom 25%',
          enterRange: [0.14, 0.38],
          exitRange: [0.78, 0.95],
        },
        {
          id: 'footer-ai',
          cardSelector: '.footer-ai-card',
          trigger: footerRef.current,
          start: 'top bottom',
          end: 'top top',
          // Scroll ends with the footer fully revealed, so there is no exit:
          // the cube's final state IS the AI card.
          enterRange: [0.42, 1],
          exitRange: null,
        },
      ];

      const mm = gsap.matchMedia();

      mm.add(
        {
          reduceMotion: MQ_REDUCED_MOTION,
          noPreference: MQ_NO_MOTION_PREFERENCE,
        },
        (media) => {
          const { reduceMotion } = media.conditions;
          const entries = [];

          for (const config of targetConfigs) {
            const card = app.querySelector(config.cardSelector);
            if (!card) continue;

            const companion = config.companionSelector
              ? app.querySelector(config.companionSelector)
              : null;
            const shellEls = companion ? [card, companion] : [card];
            const contentEls = Array.from(card.children);

            if (reduceMotion) {
              gsap.set([...shellEls, ...contentEls], { opacity: 1 });
              continue;
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

            const syncDomToProgress = (self) => {
              entry.progressRef.current = self.progress;

              const m = resolveMorphProgress(
                self.progress,
                config.enterRange,
                config.exitRange,
              );
              gsap.set(shellEls, { opacity: cardRevealAlpha(m) });
              gsap.set(contentEls, { opacity: contentRevealAlpha(m) });
            };

            ScrollTrigger.create({
              trigger: config.trigger ?? card,
              start: config.start,
              end: config.end,
              scrub: true,
              onUpdate: syncDomToProgress,
              // Restores the correct state after resize or a mid-page reload,
              // where onUpdate alone would leave stale opacities.
              onRefresh: syncDomToProgress,
            });

            entries.push(entry);
          }

          morphTargetsRef.current = entries;

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
          />
        </Canvas>
      </div>

      <div className="dom-layer w-full overflow-x-clip">
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
        </header>

        <section
          id="about"
          ref={profileTriggerRef}
          className="relative flex min-h-[120dvh] w-full items-center px-[clamp(2rem,6vw,6rem)] select-none"
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
                I build high-performance web architectures and interactive canvases. No cold
                outreach. Purely premium inbound positioning for ambitious founders.
              </p>
            </div>
          </div>
        </section>

        <div className="shell">
          <section id="work" className="work">
            <div className="work__index">
              <span className="label">Selected case studies</span>
              <span className="label">01 — 02</span>
            </div>

            <ProjectCard project={PROJECTS[0]} reducedMotion={prefersReducedMotion} />
          </section>
        </div>

        <div className="shell">
          <section className="work">
            <ProjectCard project={PROJECTS[1]} reducedMotion={prefersReducedMotion} />
          </section>
        </div>

        {/* Spacer di scroll per la transizione del cluster 3D — nessun contenuto */}
        <div className="transition-cube relative min-h-[100dvh] w-full" aria-hidden="true" />

        {/* FOOTER SENZA BG-WHITE 
          Ora è trasparente. Lo sfondo bianco che vediamo è il div animato dietro il Canvas.
        */}
        <footer
          ref={footerRef}
          className="relative flex h-[100dvh] min-h-0 max-h-[100dvh] w-full max-w-full shrink-0 flex-col justify-between overflow-hidden px-[clamp(1.5rem,4vw,4rem)] py-[clamp(2rem,5vw,4rem)] font-sans text-black"
        >
          <div className="flex w-full flex-col gap-[clamp(2rem,5vw,4rem)] xl:flex-row xl:items-start xl:justify-between">
            <div className="flex w-full flex-col items-start gap-[clamp(1.5rem,3vw,2.5rem)] xl:w-[58%] xl:shrink-0">
              <h2 className="footer__headline w-full max-w-full text-[clamp(2.5rem,7vw,7rem)] font-bold uppercase leading-[0.9] tracking-[0.02em]">
                HOW ABOUT WE DO A THING OR TWO. TOGETHER
              </h2>
              <BrandButton
                className="footer__cta"
                onClick={() => {
                  window.location.href = 'mailto:flaviodonnini07@gmail.com';
                }}
              >
                Get in touch
              </BrandButton>
            </div>

            <div className="grid w-full min-w-0 grid-cols-1 gap-x-[clamp(1rem,3vw,2rem)] gap-y-[clamp(1.5rem,4vw,2.5rem)] md:grid-cols-2 xl:mt-0 xl:w-[38%] xl:grid-cols-4">
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

          <div className="mt-[clamp(3rem,8vw,8rem)] flex w-full flex-col items-start gap-[clamp(1.5rem,4vw,2.5rem)] xl:flex-row xl:items-end xl:justify-between">
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

            {/* 10.5vw (instead of the clipped 14vw nowrap) keeps the wordmark on a
              single unclipped line across desktop widths; small screens may wrap. */}
            <p className="footer__logo w-full min-w-0 max-w-full text-left text-[clamp(2.75rem,10.5vw,13rem)] font-bold uppercase leading-none tracking-[0.02em] xl:text-right">
              FLAVIO DONNINI.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
