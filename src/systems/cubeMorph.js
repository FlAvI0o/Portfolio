/**
 * Cube → DOM-card morph system.
 *
 * A single wireframe cube in the WebGL scene can "become" any glass card in
 * the DOM. The cube never draws its own card: it flies to the live
 * getBoundingClientRect() of a real DOM element, stretches to its exact size,
 * flattens into a slab, rounds its corners to the element's border-radius and
 * crossfades into the element itself. The DOM side reveals the card (blur,
 * border, then content) on the same normalized timeline, so the switch from
 * WebGL to DOM has no identifiable seam.
 *
 * Both `BackgroundScene` (WebGL) and `Portfolio` (DOM) import the phase
 * ranges below — that shared timeline is what keeps the two layers in sync.
 */

// Phase ranges over the normalized morph progress m ∈ [0, 1]. Ordering is
// deliberate: the cube reaches the exact rect (flight = 1 at 0.62) and its
// corner radius is ~90% correct before the DOM card starts to appear at 0.62,
// so the crossfade only ever blends two nearly identical silhouettes.
export const MORPH_PHASES = {
  /** Cube travels, stretches to the card rect and settles face-on. */
  flight: [0, 0.62],
  /** Front-face silhouette outline fades in (still a perfect square). */
  outlineIn: [0.34, 0.46],
  /** Corners round from 0 to the card's border-radius. */
  round: [0.34, 0.7],
  /** Depth collapses: cube → thin slab → plane. */
  flatten: [0.42, 0.8],
  /** The 12 box edges fade out, leaving only the rounded outline. Ends just
      after reveal starts so no sharp square corner ghosts through the card. */
  wireFade: [0.46, 0.66],
  /** Outline ink relaxes to the DOM card border color. */
  borderColor: [0.5, 0.85],
  /** DOM card (glass fill + blur + border) fades in over the outline. */
  reveal: [0.62, 0.94],
  /** Card content (children) fades in, slightly after the shell. */
  content: [0.74, 1],
  /** WebGL outline dissolves under the now-visible DOM border. */
  outlineFade: [0.88, 1],
};

export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function phase01(value, range) {
  return clamp01((value - range[0]) / (range[1] - range[0]));
}

export function smoothstep(t) {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/**
 * Maps raw ScrollTrigger progress p ∈ [0, 1] to morph progress m ∈ [0, 1].
 * `enterRange` is where the morph builds up; an optional `exitRange` plays it
 * back in reverse (card returns to being a cube) as the section leaves.
 * Between the two ranges the morph holds at 1 (fully handed off to the DOM).
 */
export function resolveMorphProgress(progress, enterRange, exitRange) {
  if (exitRange && progress >= exitRange[0]) {
    return 1 - phase01(progress, exitRange);
  }
  return phase01(progress, enterRange);
}

/** DOM card shell opacity (glass fill, blur, border) for a given m. */
export function cardRevealAlpha(m) {
  return smoothstep(phase01(m, MORPH_PHASES.reveal));
}

/** DOM card content opacity (children) for a given m. */
export function contentRevealAlpha(m) {
  return smoothstep(phase01(m, MORPH_PHASES.content));
}

/**
 * Projects a DOM element's viewport rect onto the WebGL plane z = 0.
 *
 * The camera sits at (0, 0, cameraZ) looking down -z with no rotation, and the
 * canvas covers the viewport exactly, so world-units-per-CSS-pixel is uniform:
 * wpp = (2 · tan(fov/2) · cameraZ) / viewportHeight. The morph parks the
 * cube's front face on z = 0, which is why the rect is measured there.
 */
export function measureWorldRect(el, radiusPx, camera, viewportWidth, viewportHeight, out) {
  const domRect = el.getBoundingClientRect();
  const fovRad = (camera.fov * Math.PI) / 180;
  const wpp = (2 * Math.tan(fovRad / 2) * camera.position.z) / viewportHeight;

  out.x = (domRect.left + domRect.width / 2 - viewportWidth / 2) * wpp;
  out.y = (viewportHeight / 2 - (domRect.top + domRect.height / 2)) * wpp;
  out.width = domRect.width * wpp;
  out.height = domRect.height * wpp;
  out.radius = radiusPx * wpp;
  return out;
}

export const OUTLINE_CORNER_SEGMENTS = 12;
export const OUTLINE_POINT_COUNT = (OUTLINE_CORNER_SEGMENTS + 1) * 4;

const _cornerStartAngle = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

/**
 * Rewrites a preallocated LineLoop position attribute as a rounded rectangle
 * centered on the local origin. With radius 0 it is exactly the cube's front
 * face square, so the outline can appear over the wireframe with no visible
 * change, then grow its corner radius toward the DOM card's border-radius.
 */
export function writeRoundedRect(positionAttribute, width, height, radius) {
  const halfW = width / 2;
  const halfH = height / 2;
  const r = Math.min(radius, halfW, halfH);
  const cx = [halfW - r, -halfW + r, -halfW + r, halfW - r];
  const cy = [halfH - r, halfH - r, -halfH + r, -halfH + r];
  const array = positionAttribute.array;
  let write = 0;

  for (let corner = 0; corner < 4; corner += 1) {
    for (let s = 0; s <= OUTLINE_CORNER_SEGMENTS; s += 1) {
      const angle = _cornerStartAngle[corner] + (s / OUTLINE_CORNER_SEGMENTS) * (Math.PI / 2);
      array[write++] = cx[corner] + Math.cos(angle) * r;
      array[write++] = cy[corner] + Math.sin(angle) * r;
      array[write++] = 0;
    }
  }

  positionAttribute.needsUpdate = true;
}
