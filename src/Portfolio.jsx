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
    id: 'pondera',
    title: 'Pondera',
    tag: 'Architecture Engine',
    description:
      'Spatial computation platform for real-time architectural visualization. Custom scene graph, instanced geometry pipeline, and scroll-synced camera choreography across 40k+ structural nodes.',
  },
  {
    id: 'buongesto',
    title: 'Buongesto',
    tag: 'WebGL Crowdfunding',
    description:
      'Crowdfunding infrastructure rendering 100k+ interactive blocks at 60fps. React + Three.js layout engine with unified scroll, physics, and GPU batching for high-density node synchronization.',
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
  const cursorRef = useRef(null);
  const cursorRingRef = useRef(null);
  const scrollProgressRef = useRef(0);
  const footerProgressRef = useRef(0);
  const lightweightCanvasRef = useRef(false);

  useGSAP(
    () => {
      const html = document.documentElement;
      html.classList.add('lenis', 'lenis-smooth');

      const lenis = new Lenis({
        duration: 1.15,
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

      const interactive = domRef.current?.querySelectorAll('a, button, .project-row');
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
      if (!footer) return;

      const footerProgressTrigger = ScrollTrigger.create({
        trigger: footer,
        start: 'top 92%',
        end: 'top 18%',
        scrub: 0.45,
        onUpdate: (self) => {
          footerProgressRef.current = self.progress;
        },
      });

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

      const onResize = () => {
        ScrollTrigger.refresh();
      };

      window.addEventListener('resize', onResize);

      return () => {
        footerProgressTrigger.kill();
        footerProgressRef.current = 0;
        window.removeEventListener('resize', onResize);
        mm.revert();
      };
    },
    { scope: footerRef },
  );

  return (
    <div ref={appRef} className="app">
      <div className="canvas-layer fixed inset-0 -z-10 pointer-events-none" aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0, 6], fov: 42 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true }}
        >
          <BackgroundScene
            scrollProgressRef={scrollProgressRef}
            footerProgressRef={footerProgressRef}
            lightweightModeRef={lightweightCanvasRef}
          />
        </Canvas>
      </div>

      <div ref={domRef} className="dom-layer">
        <div ref={cursorRef} className="cursor" aria-hidden="true" />
        <div ref={cursorRingRef} className="cursor-ring" aria-hidden="true" />

        <header
          ref={heroRef}
          className="hero relative flex min-h-screen w-full flex-col items-start justify-center overflow-clip px-6 md:px-20"
        >
          <p className="hero__eyebrow text-xs uppercase tracking-widest text-neutral-500 mb-4">
            FLAVIO DONNINI — WEB ENGINEER
          </p>

          <h1
            className="heading-hero max-w-[90%] text-5xl font-bold leading-[0.9] tracking-tighter md:max-w-[70%] md:text-[8rem]"
            aria-label={HERO_LINES.join(' ')}
          >
            {HERO_LINES.map((line) => (
              <span key={line} className="hero__line-mask">
                <span className="hero__line">{line}</span>
              </span>
            ))}
          </h1>
        </header>

        <div className="shell">
          <main className="work">
            <div className="work__index">
              <span className="label">Selected case studies</span>
              <span className="label">01 — 02</span>
            </div>

            {PROJECTS.map((project, index) => (
              <article key={project.id} className="project-row" data-project={project.id}>
                <div className="project-row__meta">
                  <span className="label">0{index + 1}</span>
                  <span className="label">{project.tag}</span>
                </div>

                <h2 className="heading-section project-row__title">{project.title}</h2>

                <p className="body-sm project-row__copy">{project.description}</p>

                <div className="project-row__frame" data-hover-reveal={project.id}>
                  <span className="label project-row__frame-label">
                    [{project.id}.webgl — hover reveal]
                  </span>
                </div>
              </article>
            ))}
          </main>
        </div>

        <footer
          ref={footerRef}
          className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-white px-6 py-20 font-sans text-black md:px-10 md:py-32"
        >
          <div className="flex w-full flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-16">
            <div className="flex w-full flex-col items-start gap-8 md:w-[60%] md:gap-10">
              <h2 className="footer__headline text-5xl font-bold uppercase leading-[0.9] tracking-normal md:text-6xl lg:text-8xl">
                HOW ABOUT WE DO A THING OR TWO, TO+GETHER
              </h2>
              <a
                href="mailto:hello@donniniflavio.com"
                className="footer__cta border border-black px-8 py-4 text-sm uppercase transition-colors hover:bg-black hover:text-white rounded-full"
              >
                GET IN TOUCH -&gt;
              </a>
            </div>

            <div className="mt-16 grid w-full grid-cols-2 gap-x-6 gap-y-10 md:mt-0 md:w-[40%] md:grid-cols-4">
              {FOOTER_NAV.map((column) => (
                <div key={column.title} className="flex flex-col gap-4">
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
                          className="transition-opacity hover:opacity-50"
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

          <div className="mt-20 flex w-full flex-col items-start gap-10 md:mt-32 md:flex-row md:items-end md:justify-between md:gap-8">
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

            <h1 className="footer__logo w-full text-left text-[12vw] font-bold uppercase leading-none tracking-tighter md:text-right">
              FLAVIO DONNINI.
            </h1>
          </div>
        </footer>
      </div>
    </div>
  );
}
