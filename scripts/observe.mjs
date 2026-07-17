/**
 * Observation harness for the scroll experience.
 *
 * Scrolls the real site with wheel events (so Lenis + ScrollTrigger behave
 * exactly as they do for a visitor) and captures screenshots along the way.
 *
 * Usage:
 *   node scripts/observe.mjs sweep desktop   — slow scroll-through, screenshot every ~half viewport
 *   node scripts/observe.mjs sweep mobile
 *   node scripts/observe.mjs fast desktop    — blast to the bottom, then verify nothing skippable was skipped
 *   node scripts/observe.mjs probe desktop 3500  — park at a scroll offset and take a single settled shot
 */
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.OBSERVE_URL ?? 'http://localhost:5176/';
const mode = process.argv[2] ?? 'sweep';
const device = process.argv[3] ?? 'desktop';
const extraArg = process.argv[4];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const viewport = VIEWPORTS[device];
if (!viewport) {
  console.error(`Unknown device "${device}"`);
  process.exit(1);
}

const outDir = path.join('shots', `${mode}-${device}`);

async function launch() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    hasTouch: device === 'mobile',
    isMobile: device === 'mobile',
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  // Let the hero entrance + fonts + ScrollTrigger refresh settle.
  await page.waitForTimeout(2500);
  return { browser, page };
}

const scrollY = (page) => page.evaluate(() => window.scrollY);
const maxScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

async function sweep() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const { browser, page } = await launch();

  const max = await maxScroll(page);
  console.log(`page height: ${max}px of scroll`);

  let shot = 0;
  let nextCapture = 0;
  const captureEvery = viewport.height * 0.45;
  let stalled = 0;
  let lastY = -1;

  await page.screenshot({ path: path.join(outDir, `000-y0.png`) });
  shot += 1;
  nextCapture = captureEvery;

  for (let i = 0; i < 2000; i += 1) {
    await page.mouse.wheel(0, 160);
    await page.waitForTimeout(70);
    const y = await scrollY(page);

    if (y >= nextCapture) {
      // Give Lenis + scrubbed tweens a moment to settle at this position so
      // the shot shows the "resting" composition, not mid-lag values.
      await page.waitForTimeout(450);
      const settled = await scrollY(page);
      await page.screenshot({
        path: path.join(outDir, `${String(shot).padStart(3, '0')}-y${Math.round(settled)}.png`),
      });
      shot += 1;
      nextCapture = settled + captureEvery;
    }

    if (Math.abs(y - lastY) < 1) {
      stalled += 1;
      if (stalled > 12 && y >= max - 4) break;
    } else {
      stalled = 0;
    }
    lastY = y;
  }

  // Final settled bottom shot.
  await page.waitForTimeout(1200);
  const yEnd = await scrollY(page);
  await page.screenshot({ path: path.join(outDir, `${String(shot).padStart(3, '0')}-y${Math.round(yEnd)}-end.png`) });
  console.log(`captured ${shot + 1} screenshots into ${outDir}`);
  await browser.close();
}

async function fast() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const { browser, page } = await launch();

  // Blast to the bottom as fast as a human flicking their wheel plausibly can.
  for (let i = 0; i < 120; i += 1) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(3000);
  const y = await scrollY(page);
  const max = await maxScroll(page);
  console.log(`after blast: y=${Math.round(y)} / ${max}`);

  // The hard requirement: every project label + description must be fully
  // revealed (clip fully open) even though the visitor never slowed down.
  const report = await page.evaluate(() => {
    const read = (el) => {
      const cs = getComputedStyle(el);
      return { clipPath: cs.clipPath, opacity: cs.opacity };
    };
    return Array.from(document.querySelectorAll('.project')).map((proj) => ({
      id: proj.dataset.project,
      label: read(proj.querySelector('.project__label')),
      desc: read(proj.querySelector('.project__desc')),
    }));
  });

  let failed = false;
  for (const proj of report) {
    for (const [part, state] of [['label', proj.label], ['desc', proj.desc]]) {
      const open =
        state.clipPath === 'none' ||
        /^inset\(0(px|%)?(\s+0(px|%)?){0,3}\)$/.test(state.clipPath);
      const visible = parseFloat(state.opacity) > 0.9;
      const ok = open && visible;
      if (!ok) failed = true;
      console.log(
        `${proj.id}.${part}: ${ok ? 'OK' : 'SKIPPED'} (clip=${state.clipPath}, opacity=${state.opacity})`,
      );
    }
  }
  await page.screenshot({ path: path.join(outDir, 'after-blast.png') });
  await browser.close();
  if (failed) {
    console.error('FAST-SCROLL TEST FAILED: information was skippable');
    process.exit(1);
  }
  console.log('fast-scroll test passed');
}

async function probe() {
  mkdirSync(outDir, { recursive: true });
  const { browser, page } = await launch();
  const targetY = Number(extraArg ?? 0);

  // Wheel toward the target in medium steps, then settle.
  for (let i = 0; i < 1000; i += 1) {
    const y = await scrollY(page);
    if (y >= targetY - 8) break;
    await page.mouse.wheel(0, Math.min(400, Math.max(80, targetY - y)));
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(1800);
  const y = await scrollY(page);
  const file = path.join(outDir, `probe-y${Math.round(y)}.png`);
  await page.screenshot({ path: file });
  console.log(`probe shot at y=${Math.round(y)} → ${file}`);
  await browser.close();
}

const runners = { sweep, fast, probe };
const run = runners[mode];
if (!run) {
  console.error(`Unknown mode "${mode}"`);
  process.exit(1);
}
await run();
