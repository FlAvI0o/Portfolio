const SECTIONS = [
  {
    title: 'Overview',
    body: [
      'This privacy policy explains how Flavio Donnini ("I", "me") handles information when you visit donniniflavio.com (the "Site"). The Site is a portfolio showcasing my work as a web engineer. I keep data collection to a minimum.',
    ],
  },
  {
    title: 'Information I collect',
    body: [
      'The Site does not use contact forms, account registration, or newsletter sign-ups. If you email me directly, I receive whatever information you choose to include in your message (such as your name, email address, and message content).',
      'Like most websites, the hosting provider may automatically process technical data in server logs — for example IP address, browser type, referring URL, and timestamps. I do not use this data to identify visitors individually.',
    ],
  },
  {
    title: 'Cookies & analytics',
    body: [
      'The Site does not set marketing or tracking cookies. If analytics or performance tooling is added in the future, this policy will be updated before those tools go live.',
      'Your browser may store strictly necessary data (such as cache) to load pages and assets efficiently.',
    ],
  },
  {
    title: 'How I use information',
    body: [
      'Email correspondence is used only to respond to your inquiry and maintain a record of our communication if needed.',
      'Technical log data, when available, is used solely to keep the Site secure, diagnose errors, and understand aggregate traffic patterns.',
    ],
  },
  {
    title: 'Legal basis (GDPR)',
    body: [
      'If you are in the European Economic Area or UK, I process personal data on the basis of legitimate interest (operating and securing the Site, responding to inquiries) and, where applicable, your consent when you contact me voluntarily.',
      'You may request access, correction, deletion, restriction, or portability of your personal data, and object to processing where applicable. You also have the right to lodge a complaint with your local data protection authority.',
    ],
  },
  {
    title: 'Data retention',
    body: [
      'Emails are retained only as long as needed to handle your request and any follow-up, unless a longer period is required by law.',
      'Server logs are retained according to the hosting provider\'s default retention schedule.',
    ],
  },
  {
    title: 'Third parties',
    body: [
      'The Site may load fonts from Google Fonts. Google may process connection data according to its own privacy policy.',
      'External links (for example GitHub, LinkedIn, or X) are governed by the respective third-party privacy policies once you leave the Site.',
    ],
  },
  {
    title: 'Security',
    body: [
      'I take reasonable technical and organizational measures to protect information handled through the Site and email. No method of transmission over the internet is completely secure.',
    ],
  },
  {
    title: 'Changes',
    body: [
      'I may update this policy from time to time. The "Last updated" date below reflects the latest revision. Continued use of the Site after changes constitutes acceptance of the updated policy.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'For privacy-related questions or to exercise your rights, contact me at hello@donniniflavio.com.',
    ],
  },
];

export default function Privacy() {
  return (
    <div className="app w-full overflow-x-clip">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ backgroundColor: '#f5f5f5', zIndex: -1 }}
        aria-hidden="true"
      />

      <div className="dom-layer w-full overflow-x-clip">
        <header className="border-b-[3px] border-black px-[clamp(1.5rem,4vw,4rem)] py-[clamp(3rem,8vw,6rem)]">
          <p className="mb-4 text-xs uppercase tracking-widest text-neutral-500">
            ADMIN — FLAVIO DONNINI
          </p>
          <h1 className="heading-section max-w-full">Privacy Policy</h1>
          <a
            href="/"
            className="mt-10 inline-flex rounded-full border border-black px-[clamp(1.25rem,3vw,2rem)] py-[clamp(0.75rem,2vw,1rem)] text-xs uppercase tracking-wide transition-colors hover:bg-black hover:text-white"
          >
            ← Back to portfolio
          </a>
        </header>

        <main className="shell py-[clamp(3rem,8vw,6rem)]">
          <div className="mb-10 flex flex-col gap-2 border-b-[3px] border-black pb-6 md:flex-row md:items-end md:justify-between">
            <span className="label">Legal</span>
            <span className="label">Last updated — July 2026</span>
          </div>

          <div className="flex flex-col gap-8">
            {SECTIONS.map((section) => (
              <section
                key={section.title}
                className="flex flex-col gap-4 rounded-3xl border border-neutral-300 bg-white/70 p-6 shadow-2xl backdrop-blur-xl md:p-10"
              >
                <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-bold uppercase leading-none tracking-tight">
                  {section.title}
                </h2>
                <div className="flex flex-col gap-4">
                  {section.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="max-w-3xl text-base font-medium leading-relaxed text-neutral-800 md:text-lg"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>

        <footer className="border-t-[3px] border-black px-[clamp(1.5rem,4vw,4rem)] py-[clamp(2rem,5vw,4rem)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <p className="max-w-xs text-xs uppercase tracking-widest text-neutral-500">
              Questions about your data? Email hello@donniniflavio.com
            </p>
            <p className="text-[clamp(2rem,8vw,6rem)] font-bold uppercase leading-none tracking-[0.02em]">
              Flavio Donnini.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
