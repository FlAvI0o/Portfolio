import React from 'react';

export default function Portfolio() {
  return (
    <div className="bg-[#fff] text-[#000] min-h-screen font-sans selection:bg-black selection:text-white antialiased">
      
      {/* HEADER / HERO */}
      <header className="px-6 pt-24 pb-32 md:px-12 md:pt-36 md:pb-48 max-w-2xl">
        <h1 className="text-sm uppercase tracking-wider font-mono mb-8 text-neutral-500">
          Flavio Donnini &mdash; Portfolio
        </h1>
        <p className="text-3xl md:text-4xl font-normal tracking-tight leading-tight mb-12">
          High-end web engineering and interactive motion design. Building high-performance, cinematic digital products for fintech and AI systems.
        </p>
        <a 
          href="mailto:your-email@flaviodonnini.com" 
          className="inline-block text-sm font-mono uppercase tracking-wider border-b-2 border-black pb-1 hover:text-neutral-500 hover:border-neutral-500 transition-colors"
        >
          Available for contract &mdash; Contact
        </a>
      </header>

      {/* WORK SECTION */}
      <main className="px-6 md:px-12 space-y-48 md:space-y-64 pb-48">
        
        {/* PROJECT 1: BUONGESTO */}
        <section className="group">
          <div className="max-w-screen-2xl mx-auto">
            {/* Media Container: Replace background with 60fps WebM or WebGL Canvas */}
            <div className="w-full aspect-video bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden mb-8">
              <span className="font-mono text-xs text-neutral-400">[buongesto.com raw video / webgl canvas]</span>
            </div>
            
            <div className="max-w-2xl">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-xl font-medium tracking-tight">Buongesto</h2>
                <a 
                  href="https://buongesto.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="font-mono text-xs uppercase tracking-wider text-neutral-500 hover:text-black underline"
                >
                  Live Site &nearr;
                </a>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                A WebGL-powered crowdfunding platform built for high-density rendering. Developed core layout engines to display and synchronize 100k+ independent interactive nodes inside a unified React and Three.js infrastructure.
              </p>
            </div>
          </div>
        </section>

        {/* PROJECT 2: DECKFORGE */}
        <section className="group">
          <div className="max-w-screen-2xl mx-auto">
            {/* Media Container */}
            <div className="w-full aspect-video bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden mb-8">
              <span className="font-mono text-xs text-neutral-400">[deckforge.co raw video / webgl canvas]</span>
            </div>
            
            <div className="max-w-2xl">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-xl font-medium tracking-tight">Deckforge</h2>
                <a 
                  href="https://deckforge.co" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="font-mono text-xs uppercase tracking-wider text-neutral-500 hover:text-black underline"
                >
                  Live Site &nearr;
                </a>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                B2B infrastructure and identity systems optimized for fast growth startups. Engineered a robust backend framework integrated with Stripe billing and optimized motion patterns for rapid data ingestion displays.
              </p>
            </div>
          </div>
        </section>

        {/* CURRICULUM / CAPABILITIES */}
        <section className="max-w-2xl pt-16 border-t border-neutral-200">
          <h2 className="text-sm uppercase tracking-wider font-mono mb-12 text-neutral-500">
            Capabilities & Experience
          </h2>
          
          <div className="space-y-12">
            <div>
              <h3 className="font-medium mb-2">Core Technical Stack</h3>
              <p className="text-neutral-600 font-mono text-sm leading-relaxed">
                TypeScript, React, Three.js, WebGL, Node.js, Go, Tailwind CSS, Next.js.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2">Specializations</h3>
              <p className="text-neutral-600 leading-relaxed">
                Interactive motion architecture, client-side grid optimization for massive datasets, secure network configurations, and rapid prototyping of functional UI systems.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-4">Selected Engagements</h3>
              <ul className="space-y-4 font-mono text-sm text-neutral-600">
                <li className="flex justify-between items-baseline border-b border-dashed border-neutral-200 pb-2">
                  <span>Independent Web Engineer</span>
                  <span>2024 &mdash; Present</span>
                </li>
                <li className="flex justify-between items-baseline border-b border-dashed border-neutral-200 pb-2">
                  <span>Core Developer, Buongesto</span>
                  <span>2026</span>
                </li>
                <li className="flex justify-between items-baseline border-b border-dashed border-neutral-200 pb-2">
                  <span>Founder, Deckforge</span>
                  <span>2026</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="px-6 py-12 md:px-12 border-t border-neutral-100 max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 font-mono text-xs text-neutral-400">
        <div>&copy; {new Date().getFullYear()} Flavio Donnini. All rights reserved.</div>
        <div>
          <a href="mailto:your-email@flaviodonnini.com" className="hover:text-black transition-colors">Email</a>
          <span className="mx-2">&middot;</span>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-black transition-colors">GitHub</a>
        </div>
      </footer>

    </div>
  );
}