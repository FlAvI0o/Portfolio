/**
 * Intake collapse — extends the director motion language.
 *
 * One scalar `t ∈ [0, 1]` is shared by DOM and WebGL:
 *   0 = browsing the portfolio
 *   1 = fully inside the project intake workspace
 *
 * Collapse (~1.2–1.8s) and restore are the only motion budgets.
 * No gimmicks — calm, compress, settle. Same grammar as bridge beats.
 */

import { clamp01, smoothstep } from './cubeMorph.js';

/** Target duration for open / close (seconds). */
export const INTAKE_DURATION = 1.5;

/** Soft gate after a small-budget selection — never a hard reject. */
export const BUDGET_SOFT_GATE = 'under-2k';

export const TIMELINE_OPTIONS = [
  { value: 'asap', label: 'ASAP', hint: 'Ready to start soon' },
  { value: '1-3-months', label: '1–3 months', hint: 'A considered timeline' },
  { value: 'exploring', label: 'Just exploring', hint: 'No rush yet' },
];

export const BUDGET_OPTIONS = [
  { value: 'under-2k', label: '< €2k', hint: 'Smaller engagements' },
  { value: '2k-5k', label: '€2k–5k', hint: 'Focused build' },
  { value: '5k-plus', label: '€5k+', hint: 'Larger engagement' },
];

/**
 * How hard the world compresses at full intake (mirrors bridge compressionScale).
 * Stronger than any scroll beat — this is the finale.
 */
export const INTAKE_COMPRESSION_SCALE = 1.15;

/** Camera settle at full intake — felt, not theatrical. */
export const INTAKE_CAMERA_DOLLY = 0.55;
export const INTAKE_CAMERA_FOV_TIGHTEN = 2.4;

/** Cluster convergence toward frame center at full intake. */
export const INTAKE_CLUSTER_SCALE = 0.42;
export const INTAKE_CLUSTER_PULL_Z = 1.8;

/**
 * Ease used for both open and close — physically connected, never linear snap.
 */
export function intakeEase(t) {
  return smoothstep(clamp01(t));
}

/**
 * How present the DOM portfolio layer is (1 = full browse, 0 = collapsed away).
 * Holds readable slightly longer than the world compresses, so content and
 * geometry leave together rather than racing.
 */
export function portfolioPresence(t) {
  return 1 - smoothstep(clamp01(t / 0.85));
}

/**
 * How present the intake workspace shell is.
 * Arrives after the world has begun compressing — earned, not stacked.
 */
export function intakePresence(t) {
  return smoothstep(clamp01((t - 0.28) / 0.55));
}

/**
 * Success-state world reconstruct: after submit, the cluster gently returns
 * behind the confirmation copy. `r ∈ [0, 1]` from the success timeline.
 * Maps onto a residual calm (never fully back to browse motion).
 */
export function reconstructCalm(r) {
  return 1 - smoothstep(clamp01(r)) * 0.55;
}

export function reconstructCompression(r) {
  return INTAKE_COMPRESSION_SCALE * (1 - smoothstep(clamp01(r)) * 0.7);
}
