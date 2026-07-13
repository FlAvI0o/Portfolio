import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import BackgroundScene from './components/BackgroundScene.jsx';
import './index.css';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

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
      { label: 'CV', href: '#cv' },
    ],
  },
  {
    title: 'CONNECT',
    links: [
      { label: 'GITHUB', href: 'https://github.com' },
      { label: 'LINKEDIN', href: 'https://linkedin.com' },
      { label: 'INSTAGRAM', href: 'https://instagram.com' },
    ],
  },
  {
    title: 'LOCATION',
    links: [{ label: 'CASTIGLIONE DEL LAGO', href: '#' }],
  },
  {
    title: 'ADMIN',
    links: [
      { label: 'PRIVACY', href: '#privacy' },
      { label: 'CAREERS', href: '#careers' },
    ],
  },
];

const PROJECTS = [
  {
    id: 'buongesto',
    title: 'Buongesto',
    tag: 'WebGL Crowdfunding',
    description:
      'Crowdfunding infrastructure rendering 100k+ interactive blocks at 60fps. React + Three.js layout engine with unified scroll, physics, and GPU batching for high-density node synchronization.',
  },
  {
    id: 'deckforge',
    title: 'Deckforge',
    tag: 'Architecture Engine',
    description:
      'Spatial computation platform for real-time architectural visualization. Custom scene graph, instanced geometry pipeline, and scroll-synced camera choreography across 40k+ structural nodes.',
  },
];

function splitHeroLines(container) {
  return container.querySelectorAll('.hero__line');
}

export default function Portfolio() {
  const appRef = useRef(null);
  const domRef = useRef(null);
  const heroRef = useRef(null);
  const footerRef = useRef(null);
  const footerBgRef = useRef(null); // Nuovo riferimento per lo sfondo bianco esplosivo
  const cursorRef = useRef(null);
  const cursorRingRef = useRef(null);
  const scrollProgressRef = useRef(0);
  const footerProgressRef = useRef(0);
  const profileProgressRef = useRef(0);
  const profileTriggerRef = useRef(null);
  const lightweightCanvasRef = useRef(false);

  useGSAP(
    () => {
      const html = document.documentElement;
      html.classList.add('lenis', 'lenis-smooth');

      const lenis = new Lenis({
        duration: 2.2,
        easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
        smoothWheel: true,
      });

      lenis.on('scroll', ScrollTrigger.update);

      const onTick = (time) => {
        lenis.raf(time * 1000);
      };

      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);

      ScrollTrigger.scrollerProxy(document.documentElement, {
        scrollTop(value) {
          if (arguments.length) {
            lenis.scrollTo(value, { immediate: true });
          }
          return lenis.scroll;
        },
        getBoundingClientRect() {
          return {
            top: 0,
            left: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };
        },
      });

      const progressTrigger = ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          scrollProgressRef.current = self.progress;
        },
      });

      const profileProgressTrigger = ScrollTrigger.create({
        trigger: profileTriggerRef.current,
        start: 'top 35%',
        end: 'bottom 65%',
        scrub: true,
        onUpdate: (self) => {
          profileProgressRef.current = self.progress;
        },
      });

      const onResize = () => {
        ScrollTrigger.refresh();
      };

      const canvasMm = gsap.matchMedia();

      canvasMm.add(
        {
          isDesktop: '(min-width: 768px)',
          isMobile: '(max-width: 767px)',
        },
        (media) => {
          lightweightCanvasRef.current = media.conditions.isMobile;
        },
      );

      window.addEventListener('resize', onResize);
      ScrollTrigger.refresh();

      return () => {
        window.removeEventListener('resize', onResize);
        canvasMm.revert();
        gsap.ticker.remove(onTick);
        progressTrigger.kill();
        profileProgressTrigger.kill();
        profileProgressRef.current = 0;
        lenis.destroy();
        html.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling');
        ScrollTrigger.scrollerProxy(document.documentElement, {});
      };
    },
    { scope: appRef },
  );

  useGSAP(
    (context, contextSafe) => {
      const cursor = cursorRef.current;
      const ring = cursorRingRef.current;
      if (!cursor || !ring) return;

      gsap.set([cursor, ring], { xPercent: -50, yPercent: -50 });

      const onMove = contextSafe((event) => {
        gsap.to(cursor, {
          x: event.clientX,
          y: event.clientY,
          duration: 0.18,
          ease: 'power3.out',
        });
        gsap.to(ring, {
          x: event.clientX,
          y: event.clientY,
          duration: 0.45,
          ease: 'power3.out',
        });
      });

      const onEnter = contextSafe(() => {
        gsap.to(ring, { scale: 1.65, opacity: 0.35, duration: 0.3, ease: 'power2.out' });
      });

      const onLeave = contextSafe(() => {
        gsap.to(ring, { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' });
      });

      window.addEventListener('pointermove', onMove);

      const interactive = domRef.current?.querySelectorAll('a, button, article[data-project]');
      interactive?.forEach((el) => {
        el.addEventListener('pointerenter', onEnter);
        el.addEventListener('pointerleave', onLeave);
      });

      return () => {
        window.removeEventListener('pointermove', onMove);
        interactive?.forEach((el) => {
          el.removeEventListener('pointerenter', onEnter);
          el.removeEventListener('pointerleave', onLeave);
        });
      };
    },
    { scope: domRef },
  );

  useGSAP(
    () => {
      const hero = heroRef.current;
      if (!hero) return;

      const lines = splitHeroLines(hero);
      const eyebrow = hero.querySelector('.hero__eyebrow');
      const cta = hero.querySelector('.hero__cta');

      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: '(min-width: 768px)',
          isMobile: '(max-width: 767px)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (media) => {
          const { isDesktop, reduceMotion } = media.conditions;

          if (reduceMotion) {
            gsap.set([lines, eyebrow, cta], { y: 0, opacity: 1, clearProps: 'transform' });
            return;
          }

          const lineY = isDesktop ? 120 : 100;
          const lineDuration = isDesktop ? 1.15 : 0.95;
          const lineStagger = isDesktop ? 0.09 : 0.07;

          gsap.set(lines, { y: lineY, opacity: 0 });
          gsap.set([eyebrow, cta], { y: 24, opacity: 0 });

          const tl = gsap.timeline({ delay: 0.12 });

          tl.to(lines, {
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
            .to(
              cta,
              { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' },
              '-=0.45',
            );
        },
      );

      const onResize = () => {
        ScrollTrigger.refresh();
      };

      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('resize', onResize);
        mm.revert();
      };
    },
    { scope: heroRef },
  );

  useGSAP(
    () => {
      const footer = footerRef.current;
      const footerBg = footerBgRef.current;
      if (!footer) return;

      const syncFooterHeight = () => {
        const height = `${window.innerHeight}px`;
        footer.style.height = height;
        footer.style.minHeight = height;
        footer.style.maxHeight = height;
      };

      syncFooterHeight();

      // Sincronizziamo il trigger del progresso 3D...
      const footerProgressTrigger = ScrollTrigger.create({
        trigger: footer,
        start: 'top bottom',
        end: 'top top',
        scrub: 1,
        onUpdate: (self) => {
          footerProgressRef.current = self.progress;
        },
      });

      // ...con l'espansione CSS 2D dello sfondo bianco
      if (footerBg) {
        gsap.fromTo(
          footerBg,
          { clipPath: 'inset(50%)' }, // Inizia come un punto microscopico al centro dello schermo
          {
            clipPath: 'inset(0%)', // Si apre rivelando lo schermo intero
            ease: 'power2.inOut', // Matematicamente simile all'easeInOutCubic del WebGL
            scrollTrigger: {
              trigger: footer,
              start: 'top bottom',
              end: 'top top',
              scrub: 1,
            },
          }
        );
      }

      const headline = footer.querySelector('.footer__headline');
      const cta = footer.querySelector('.footer__cta');
      const logo = footer.querySelector('.footer__logo');

      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: '(min-width: 768px)',
          isMobile: '(max-width: 767px)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
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

            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: footer,
                start: 'top 85%',
                toggleActions: 'play none none reverse',
              },
            });

            tl.to(headline, {
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

      ScrollTrigger.refresh();

      const onResize = () => {
        syncFooterHeight();
        ScrollTrigger.refresh();
      };

      window.addEventListener('resize', onResize);

      return () => {
        footerProgressTrigger.kill();
        footerProgressRef.current = 0;
        window.removeEventListener('resize', onResize);
        footer.style.height = '';
        footer.style.minHeight = '';
        footer.style.maxHeight = '';
        mm.revert();
      };
    },
    { scope: appRef },
  );

  useGSAP(
    () => {
      const profile = profileTriggerRef.current;
      if (!profile) return;

      const profilePhoto = profile.querySelector('.profile-photo-dom');
      const profileText = profile.querySelector('.profile-text-dom');
      if (!profilePhoto || !profileText) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set([profilePhoto, profileText], { opacity: 1 });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const profileRevealTrigger = ScrollTrigger.create({
          trigger: profile,
          start: 'top 35%',
          end: 'bottom 65%',
          scrub: true,
          onUpdate: (self) => {
            const progress = self.progress;
            let opacity = 0;

            if (progress > 0 && progress < 1) {
              if (progress < 0.25) {
                opacity = progress / 0.25;
              } else if (progress > 0.75) {
                opacity = (1 - progress) / 0.25;
              } else {
                opacity = 1;
              }
            }

            gsap.set([profilePhoto, profileText], { opacity });
          },
        });

        return () => {
          profileRevealTrigger.kill();
        };
      });

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
            profileProgressRef={profileProgressRef}
            lightweightModeRef={lightweightCanvasRef}
          />
        </Canvas>
      </div>

      <div ref={domRef} className="dom-layer w-full overflow-x-clip">
        <div ref={cursorRef} className="cursor" aria-hidden="true" />
        <div ref={cursorRingRef} className="cursor-ring" aria-hidden="true" />

        <header
          ref={heroRef}
          className="hero relative flex min-h-screen w-full max-w-full flex-col items-start justify-center overflow-clip px-[clamp(1.5rem,4vw,4rem)]"
        >
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
        </header>

        <section
          ref={profileTriggerRef}
          className="relative flex min-h-[120dvh] w-full items-center px-[clamp(2rem,6vw,6rem)] select-none"
        >
          <div className="flex w-full flex-col gap-12 md:flex-row md:items-center md:gap-[clamp(2rem,5vw,4rem)]">
            <div className="flex w-full justify-center md:w-[40%] md:justify-start">
              <div className="profile-photo-dom opacity-0 relative z-10 flex w-full max-w-[450px] flex-col items-center justify-center rounded-3xl border border-neutral-300 bg-white/70 p-4 shadow-2xl backdrop-blur-xl">
                <img
                  src="/foto1.webp"
                  alt="Flavio Donnini"
                  className="h-auto w-full rounded-2xl object-cover grayscale"
                />
              </div>
            </div>

            <div className="profile-text-dom opacity-0 w-full md:w-[60%] flex flex-col justify-center p-8 md:p-12 bg-white/70 backdrop-blur-xl border border-neutral-300 rounded-3xl shadow-2xl relative z-10">
              <h2 className="mb-8 text-[clamp(3rem,6vw,6rem)] font-bold uppercase leading-none tracking-tight text-black">
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

            <article
              className="flex flex-col gap-6 p-6 md:p-12 bg-white/70 backdrop-blur-xl border border-neutral-300 rounded-3xl relative z-10 w-full mb-24 shadow-2xl"
              data-project={PROJECTS[0].id}
            >
              <h2 className="text-[clamp(3rem,6vw,5rem)] font-bold leading-none uppercase tracking-tight">
                {PROJECTS[0].title}
              </h2>

              <p className="text-lg md:text-xl font-medium max-w-3xl text-neutral-800 leading-relaxed">
                {PROJECTS[0].description}
              </p>

              <div className="w-full h-auto mt-4 overflow-hidden rounded-xl border border-neutral-200 shadow-lg">
                <video
                  src="/buongesto-horizontal.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="none"
                  controls={false}
                  className="w-full h-auto object-cover"
                />
              </div>
            </article>
          </section>
        </div>

        <div className="shell">
          <section className="work">
            <article
              className="flex flex-col gap-6 p-6 md:p-12 bg-white/70 backdrop-blur-xl border border-neutral-300 rounded-3xl relative z-10 w-full mb-24 shadow-2xl"
              data-project={PROJECTS[1].id}
            >
              <h2 className="text-[clamp(3rem,6vw,5rem)] font-bold leading-none uppercase tracking-tight">
                {PROJECTS[1].title}
              </h2>

              <p className="text-lg md:text-xl font-medium max-w-3xl text-neutral-800 leading-relaxed">
                {PROJECTS[1].description}
              </p>

              <div className="w-full h-auto mt-4 overflow-hidden rounded-xl border border-neutral-200 shadow-lg">
                <video
                  src="/deckforge-horizontal.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="none"
                  controls={false}
                  className="w-full h-auto object-cover"
                />
              </div>
            </article>
          </section>
        </div>

        <section
          className="transition-cube relative min-h-[100dvh] w-full"
          aria-label="3D cluster transition"
        />

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
                HOW ABOUT WE DO A THING OR TWO, TO+GETHER
              </h2>
              <a
                href="mailto:hello@donniniflavio.com"
                className="footer__cta rounded-full border border-black px-[clamp(1.25rem,3vw,2rem)] py-[clamp(0.75rem,2vw,1rem)] text-sm uppercase transition-colors hover:bg-black hover:text-white"
              >
                GET IN TOUCH -&gt;
              </a>
            </div>

            <div className="grid w-full min-w-0 grid-cols-1 gap-x-[clamp(1rem,3vw,2rem)] gap-y-[clamp(1.5rem,4vw,2.5rem)] md:grid-cols-2 xl:mt-0 xl:w-[38%] xl:grid-cols-4">
              {FOOTER_NAV.map((column) => (
                <div key={column.title} className="flex min-w-0 flex-col gap-4">
                  <span className="text-xs uppercase tracking-widest text-neutral-400">
                    {column.title}
                  </span>
                  <nav className="flex flex-col gap-2 text-xs uppercase tracking-wide">
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
            <div className="shrink-0">
              <p className="max-w-xs text-xs uppercase tracking-widest text-neutral-500">
                ASK AI FOR A SUMMARY OF FLAVIO DONNINI.
              </p>
              <div className="mt-4 flex gap-2" aria-hidden="true">
                {[0, 1, 2, 3].map((icon) => (
                  <div key={icon} className="size-8 border border-black bg-neutral-100" />
                ))}
              </div>
            </div>

            <h1 className="footer__logo w-full min-w-0 max-w-full text-left text-[clamp(3rem,12vw,14rem)] font-bold uppercase leading-none tracking-[0.02em] xl:text-right">
              FLAVIO DONNINI.
            </h1>
          </div>
        </footer>
      </div>
    </div>
  );
}