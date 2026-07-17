/**
 * Director bus — the narrative beat system.
 *
 * Every important moment on the page (the three statement bridges, the two
 * pinned morph moments and the finale) registers a "beat": a normalized
 * scroll progress p ∈ [0, 1] over its own runway. Both layers read the same
 * beat:
 *
 *   - The DOM (Portfolio.jsx) uncovers the statement from the center of the
 *     negative space the world just opened, and drives the release parallax.
 *   - The WebGL scene (BackgroundScene.jsx) derives calm / compression /
 *     energy from it and leans the camera in.
 *
 * The grammar every beat follows:
 *
 *   anticipation → compression → (settle) → reveal → hold → release
 *
 * The settle gap is deliberate: after the world has receded and before the
 * type exists there is a short stretch of pure negative space — the reveal
 * is *earned* by the silence that precedes it, never triggered by a scroll
 * percentage the viewer can perceive. Causality, not choreography.
 */

import { phase01, smoothstep } from './cubeMorph.js';

// Phase ranges over a beat's normalized progress p ∈ [0, 1].
export const BEAT_PHASES = {
  /** World motion decays; nothing new appears yet. */
  anticipation: [0, 0.2],
  /** Cluster recedes and dims; negative space opens at frame center. */
  compression: [0.2, 0.36],
  // [0.36 → 0.42] — the settle: pure negative space, nothing animates.
  /** The statement is uncovered out of the space the world cleared. */
  reveal: [0.42, 0.62],
  /** Near-total stillness. The silence IS the beat. */
  hold: [0.62, 0.8],
  /** The world overshoots back to life; the text is left behind. */
  release: [0.8, 1],
};

export const RELEASE_START = BEAT_PHASES.release[0];

// Default calm envelope for a bridge beat: rises through anticipation and
// compression, full through the settle + reveal + hold, falls through release.
export const BRIDGE_BEAT = {
  calmIn: [0.04, BEAT_PHASES.compression[1]],
  calmOut: [RELEASE_START, 0.97],
  releaseAt: RELEASE_START,
  compressionScale: 1,
};

/**
 * Calm ∈ [0, 1] for a beat: smoothstep up over `inRange`, back down over
 * `outRange`. Zero outside the beat entirely.
 */
export function calmFromRanges(p, inRange, outRange) {
  if (p <= 0 || p >= 1) return 0;
  return smoothstep(phase01(p, inRange)) * (1 - smoothstep(phase01(p, outRange)));
}

/**
 * Eased wipe ∈ [0, 1] for the statement at beat progress p. The statement is
 * uncovered center-outward — out of the negative space the cluster opened —
 * so its appearance reads as a consequence of the world's motion.
 */
export function statementWipe(p) {
  return smoothstep(phase01(p, BEAT_PHASES.reveal));
}

/**
 * Release parallax ∈ [0, 1]: how far the statement has been "left behind"
 * by the camera. Drives translate/scale, never opacity — the text does not
 * disappear, the world moves past it.
 */
export function beatExit(p) {
  return smoothstep(phase01(p, BEAT_PHASES.release));
}
