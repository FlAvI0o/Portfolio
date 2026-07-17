/**
 * Verifies perceived inertia: identical wheel input must move the page
 * noticeably less inside the flagship scene than in a neutral zone, and the
 * footer must scroll at full speed.
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.OBSERVE_URL ?? 'http://localhost:5176/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const scrollY = () => page.evaluate(() => window.scrollY);

// Feed identical input at the current position and report how far the page
// actually travelled once Lenis settles.
async function measure(label) {
  // Let the damped multiplier converge on the current zone first.
  await page.waitForTimeout(1500);
  const before = await scrollY();
  for (let i = 0; i < 10; i += 1) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(2000);
  const after = await scrollY();
  console.log(`${label}: 1000px of wheel input -> ${Math.round(after - before)}px travelled`);
}

async function jumpTo(y) {
  // Wheel coarsely to the neighborhood (real input so zones engage naturally).
  for (let i = 0; i < 600; i += 1) {
    const current = await scrollY();
    if (current >= y - 20) break;
    await page.mouse.wheel(0, Math.min(600, y - current));
    await page.waitForTimeout(25);
  }
}

// Hero (neutral zone).
await measure('hero (neutral)');

// Flagship pin: section top hits top of viewport around y≈1800 (after hero
// 900 + bridge ~1035). Park mid-pin.
await jumpTo(2600);
await measure('flagship (0.55 expected)');

// Footer approach (neutral again).
await jumpTo(11800);
await measure('footer (full speed)');

await browser.close();
