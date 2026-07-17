/**
 * Perceived inertia — the scroll resistance system.
 *
 * Important scenes should feel like they have weight: while the visitor is
 * inside one, each physical wheel/touch delta moves the page a little less
 * than it would elsewhere. Never a lock, never a snap — the multiplier is
 * damped continuously toward the active zone's target, so the transition in
 * and out of resistance is below the threshold of conscious perception. The
 * visitor should never notice the mechanic, only that the flagship "holds"
 * them slightly.
 *
 * Motion hierarchy (mirrors the rest of the direction): strongest on the
 * flagship, medium on project 2, very light on the profile, none anywhere
 * else — the footer scrolls at full speed.
 *
 * Wiring: Lenis exposes a `virtualScroll` option — a callback invoked with
 * every raw input event ({ deltaX, deltaY, event }) before it is applied.
 * Mutating deltaY there scales wheel and touch input alike, which is the
 * whole implementation: no scroll hijacking, no synthetic positions.
 */

// Exponential damping rate for the multiplier itself. Low on purpose: the
// resistance eases in over ~1s as a zone is entered, so there is never a
// perceptible "gear change" mid-scroll.
const MULTIPLIER_DAMP = 2.5;

export function createScrollResistance(zones) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 1;

  return {
    /**
     * Lenis `virtualScroll` callback: scales every raw input delta by the
     * damped multiplier. Returning true lets Lenis proceed as normal.
     */
    virtualScroll(data) {
      data.deltaY *= current;
      return true;
    },

    /**
     * Called once per animation frame (from the same gsap ticker that
     * drives Lenis). Resolves which zone currently owns the viewport
     * center and eases the multiplier toward its target.
     */
    update(deltaSeconds) {
      let target = 1;

      if (!reduceMotion.matches) {
        const centerY = window.innerHeight / 2;
        for (let i = 0; i < zones.length; i += 1) {
          const zone = zones[i];
          const el = zone.getEl();
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.top <= centerY && rect.bottom >= centerY) {
            // Zones never overlap in practice (sequential sections), but if
            // they ever did, the heaviest one wins.
            if (zone.multiplier < target) target = zone.multiplier;
          }
        }
      }

      current += (target - current) * Math.min(1, MULTIPLIER_DAMP * deltaSeconds);
    },
  };
}
