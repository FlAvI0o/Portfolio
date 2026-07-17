import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import {
  MORPH_PHASES,
  OUTLINE_POINT_COUNT,
  clamp01,
  measureWorldRect,
  phase01,
  resolveMorphProgress,
  restPresenceForRect,
  smoothstep,
  writeRoundedRect,
} from '../systems/cubeMorph.js';
import { calmFromRanges } from '../systems/director.js';

const DESKTOP_COUNT = 800;
const MOBILE_COUNT = 100;
const MOBILE_QUERY = '(max-width: 767px)';
const LINE_COLOR = '#111111';
const CARD_BORDER_COLOR = '#d4d4d4'; // Tailwind neutral-300 — the DOM glass card border
const CANVAS_BG_BLEND = 0.42;

// How flat the "cube" is at full handoff (a hairline slab, never zero so the
// wireframe keeps a silhouette until it dissolves into the DOM card).
const MORPH_END_DEPTH = 0.015;

// Damping factor for the scroll progress fed into the cluster/hero base
// transforms — turns per-tick scroll steps into continuous, weighted motion
// instead of an instant 1:1 follow (mirrors the footer reveal's own damping).
// Deliberately low: when the visitor stops scrolling, the world visibly
// keeps resolving toward its target for ~1.5s — the page never "stops",
// the world settles.
const SCROLL_DAMPING = 3.5;

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const HUB_Y_BASE = -1.6;

const _lineColorBase = new THREE.Color(LINE_COLOR);
const _cardBorderColor = new THREE.Color(CARD_BORDER_COLOR);

const _instanceProxy = new THREE.Object3D();
const _edgeStart = new THREE.Vector3();
const _edgeEnd = new THREE.Vector3();
const _outlineOffset = new THREE.Vector3();
const _worldRect = { x: 0, y: 0, width: 0, height: 0, radius: 0 };
const _hubCoords = { x: 0, y: 0, z: 0 };

// How hard calm quiets the world (0.92 → 8% residual motion at full calm:
// near-total stillness, so the post-release energy reads as a genuine event)
// and how long a release impulse rings (exponential decay, ~1.7s tail).
const CALM_MOTION_CUT = 0.92;
const ENERGY_DECAY = 1.0;

// How quickly the idle hero cube's presence chases its target (fade in as a
// morph target approaches, fade out once nothing is near) — damped like
// everything else here so it never pops. USAGE_PRESENCE_M is the tiny sliver
// of morph progress (m) over which presence is forced to 1 regardless of
// where the rect-based fade happened to land, guaranteeing the handoff into
// an active morph is always seamless.
const REST_PRESENCE_DAMP = 4.5;
const USAGE_PRESENCE_M = 0.05;

// Camera rest pose (must match the <Canvas camera={...}> props) and the
// director's lean: a dolly-in of 0.3 world units + 1.5° of FOV tightening at
// full calm — the frame leans in with the viewer's attention. Deliberately
// under the threshold of conscious perception: felt, not noticed.
const CAMERA_Z = 6;
const CAMERA_FOV = 42;
const CAMERA_DOLLY = 0.3;
const CAMERA_FOV_TIGHTEN = 1.5;

// ── Continuous world / camera language ──────────────────────────────────
//
// Everything below exists for one reason: pinning must never read as
// "stopping". The scroll can stop; the world can't. Two independent motion
// sources layer on top of the scroll-driven transforms above:
//
//   1. Ambient breathing — low-frequency sine drift keyed to elapsed time
//      (state.clock.elapsedTime), not scroll. It runs identically whether
//      the visitor is scrolling, mid-pin, or their finger has simply
//      stopped. Calm dampens it (a hold should still feel quieter than a
//      transition) but only ever by half — never to zero — because a
//      fully silent world is exactly the "it stopped" the calm system was
//      designed to *approach*, not to actually reach.
//   2. Camera language — a slow, monotonic forward journey tied to overall
//      scroll progress (so the camera is always a little further "into"
//      the world by the time you reach the footer than it was at the
//      hero — travel, not oscillation) plus a per-beat lean that
//      alternates between a small forward push and a gentle reframe
//      (FOV breath) as each successive beat becomes dominant. Both lean
//      components are damped toward their target, so a beat handoff eases
//      rather than snaps.
//
// Camera motion is deliberately restricted to position.z and .fov only —
// never .x, .y or any rotation — because measureWorldRect() below re-derives
// the DOM↔world mapping from exactly those two live camera values every
// frame. Moving the camera in x/y (or rotating it) would silently break the
// cube-to-DOM-card handoff's precision; z/fov are the only axes the morph
// system was built to tolerate moving.
const AMBIENT_CALM_FLOOR = 0.5; // ambient amplitude never drops below this fraction of full, even at calm = 1
const AMBIENT_CLUSTER_ROT_Y = 0.03;
const AMBIENT_CLUSTER_ROT_X = 0.015;
const AMBIENT_CLUSTER_POS_Y = 0.045;
const AMBIENT_CLUSTER_POS_X = 0.035;
const AMBIENT_CLUSTER_OPACITY = 0.05;
const AMBIENT_HERO_ROT_X = 0.05;
const AMBIENT_HERO_ROT_Y = 0.06;
const AMBIENT_CAMERA_Z = 0.012;

const JOURNEY_Z_MAX = 0.4; // total forward creep across the entire page, scroll-tied, never resets
const BEAT_LEAN_PUSH = 0.09; // extra dolly-in for "push" beats (even index)
const BEAT_LEAN_FOV = 0.6; // extra FOV pull for "reframe" beats (odd index)
const BEAT_LEAN_DAMP = 2.6; // how quickly a lean crossfades in as its beat becomes dominant

function hash(seed) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

// Writes into the shared _hubCoords scratch object to avoid per-call allocations.
function resolveHubCoords(id, radiusSeed, angleSeed, heightSeed) {
  const band = id % 5;
  const angle = id * GOLDEN * 2.1 + angleSeed * 0.55;
  let radius;
  let y;

  if (band === 0) {
    radius = Math.pow(radiusSeed, 2.6) * 0.48;
    y = (heightSeed - 0.5) * 1.4 + HUB_Y_BASE;
  } else if (band <= 2) {
    radius = 1.1 + radiusSeed * 0.85 + (band - 1) * 0.52;
    y = (heightSeed - 0.5) * 3.8 + Math.sin(angle * 2) * 0.45 + HUB_Y_BASE;
  } else {
    radius = 2.05 + radiusSeed * 1.15;
    y = (heightSeed - 0.5) * 5.2 + Math.cos(angle * 1.5) * 0.9 + HUB_Y_BASE;
  }

  _hubCoords.x = Math.cos(angle) * radius;
  _hubCoords.y = y;
  _hubCoords.z = Math.sin(angle) * radius;
  return _hubCoords;
}

function setInstanceTransform(index) {
  const isHub = index % 8 === 0; // ~12.5% nodi hub ingombranti

  const radiusSeed = hash(index);
  const angleSeed = hash(index + 1);
  const heightSeed = hash(index + 2);
  const snapSeed = hash(index + 3);
  const spinSeed = hash(index + 4);
  const tiltSeed = hash(index + 5);

  if (isHub) {
    const hub = resolveHubCoords(Math.floor(index / 8), radiusSeed, angleSeed, heightSeed);
    _instanceProxy.position.set(hub.x, hub.y, hub.z);

    const snap = snapSeed > 0.7 ? Math.PI * 0.5 : 0;
    _instanceProxy.rotation.set(snap, spinSeed * Math.PI * 2, hash(index + 6) * 0.35);
    _instanceProxy.scale.setScalar(0.82 + radiusSeed * 0.38);
    return;
  }

  const parentIndex = index - (index % 8);
  const orbitSlot = index % 8;
  const parent = resolveHubCoords(
    Math.floor(parentIndex / 8),
    hash(parentIndex),
    hash(parentIndex + 1),
    hash(parentIndex + 2),
  );

  const orbitRadius = 0.08 + radiusSeed * 0.32 + orbitSlot * 0.018;
  const orbitAngle = orbitSlot * GOLDEN * 3 + angleSeed * Math.PI * 2;
  const orbitY = (heightSeed - 0.5) * 0.42 * (1 + orbitSlot * 0.08);

  _instanceProxy.position.set(
    parent.x + Math.cos(orbitAngle) * orbitRadius,
    parent.y + orbitY,
    parent.z + Math.sin(orbitAngle) * orbitRadius,
  );

  const snap = snapSeed > 0.78 ? Math.PI * 0.5 : 0;
  _instanceProxy.rotation.set(snap, spinSeed * Math.PI * 2, tiltSeed * 0.25);
  _instanceProxy.scale.setScalar(0.035 + radiusSeed * 0.075);
}

function buildUnitEdgeGeometry() {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(box);
  box.dispose();
  return edges;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

// Parsed once at module load — avoids per-frame allocation inside useFrame
const flightEase = gsap.parseEase('power2.inOut');

// Highest rect-based presence wins, same "any one target can call for it"
// logic as resolveActiveMorph below — the cube only needs to be present for
// whichever target is closest, not the sum of all of them.
function resolveRestPresence(targets, viewportHeight) {
  let presence = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    if (!target.el) continue;
    const rect = target.el.getBoundingClientRect();
    const p = restPresenceForRect(rect.top, rect.bottom, viewportHeight);
    if (p > presence) presence = p;
  }

  return presence;
}

// Highest morph progress wins: targets are laid out sequentially on the page,
// so at any scroll position at most one of them is meaningfully active.
function resolveActiveMorph(targets) {
  let best = null;
  let bestM = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    if (!target.el) continue;
    const m = resolveMorphProgress(
      target.progressRef.current,
      target.enterRange,
      target.exitRange,
    );
    if (m > bestM) {
      bestM = m;
      best = target;
    }
  }

  return best ? { target: best, m: bestM } : null;
}

export default function BackgroundScene({
  scrollProgressRef,
  footerProgressRef,
  morphTargetsRef,
  beatsRef,
}) {
  const groupRef = useRef(null);
  const clusterLinesRef = useRef(null);
  const heroRef = useRef(null);
  const morphOutlineRef = useRef(null);
  const smoothFooterRef = useRef(0);
  const smoothScrollRef = useRef(0);
  // Director state: damped calm/compression (inertia — fast scrolling can't
  // pop the world) and the post-reveal energy impulse. The raw impulse fires
  // instantly (0 → 1) at a release crossing; everything consumes the damped
  // copy so the world *surges* back to life instead of stepping.
  const smoothCalmRef = useRef(0);
  const smoothCompressionRef = useRef(0);
  const energyRef = useRef(0);
  const smoothEnergyRef = useRef(0);
  // How present the idle hero cube is — 0 when at rest with nothing nearby,
  // 1 once a morph target is about to need it (see resolveRestPresence).
  const restPresenceRef = useRef(0);
  // Camera language: damped toward whichever beat is currently dominant so
  // a handoff between two beats' lean patterns eases rather than snaps.
  const leanPushRef = useRef(0);
  const leanReframeRef = useRef(0);

  const isLightweight = useMediaQuery(MOBILE_QUERY);
  const instanceCount = isLightweight ? MOBILE_COUNT : DESKTOP_COUNT;

  const unitEdges = useMemo(() => buildUnitEdgeGeometry(), []);
  const outlineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(OUTLINE_POINT_COUNT * 3), 3),
    );
    return geometry;
  }, []);
  const clusterMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: LINE_COLOR,
        toneMapped: false,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    [],
  );
  const heroMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: LINE_COLOR,
        toneMapped: false,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    [],
  );
  const outlineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: LINE_COLOR,
        toneMapped: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );

  // Deterministic GPU lifecycle: dispose everything this component owns on unmount.
  // (dispose() is idempotent, so R3F's own unmount disposal is harmless.)
  useEffect(
    () => () => {
      unitEdges.dispose();
      outlineGeometry.dispose();
      clusterMaterial.dispose();
      heroMaterial.dispose();
      outlineMaterial.dispose();
    },
    [unitEdges, outlineGeometry, clusterMaterial, heroMaterial, outlineMaterial],
  );

  // Costruzione del "Muro" (Statico, alte performance)
  useLayoutEffect(() => {
    const lines = clusterLinesRef.current;
    if (!lines) return;

    const source = unitEdges.attributes.position;
    const pairCount = source.count;
    const merged = new Float32Array(instanceCount * pairCount * 3);
    let write = 0;

    for (let i = 0; i < instanceCount; i += 1) {
      setInstanceTransform(i);
      _instanceProxy.updateMatrix();

      for (let v = 0; v < pairCount; v += 2) {
        _edgeStart.fromBufferAttribute(source, v).applyMatrix4(_instanceProxy.matrix);
        _edgeEnd.fromBufferAttribute(source, v + 1).applyMatrix4(_instanceProxy.matrix);

        merged[write++] = _edgeStart.x;
        merged[write++] = _edgeStart.y;
        merged[write++] = _edgeStart.z;
        merged[write++] = _edgeEnd.x;
        merged[write++] = _edgeEnd.y;
        merged[write++] = _edgeEnd.z;
      }
    }

    // Release the previous GPU buffer before swapping the attribute, otherwise
    // the renderer keeps the stale VBO alive (leak on breakpoint changes).
    if (lines.geometry.getAttribute('position')) {
      lines.geometry.dispose();
    }

    lines.geometry.setAttribute('position', new THREE.BufferAttribute(merged, 3));
    lines.geometry.computeBoundingSphere();
  }, [instanceCount, unitEdges]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const hero = heroRef.current;
    const outline = morphOutlineRef.current;
    if (!group || !hero || !outline) return;

    const { camera, size } = state;

    // ── Director bus: resolve every registered beat into three scalars.
    // calm quiets the world before/during a reveal, compression opens the
    // negative space the typography will occupy, energy is the impulse that
    // snaps the world back to life after each release. Crossing a beat's
    // releaseAt fires the impulse exactly once per pass. Alongside that, we
    // track which single beat is currently the *most* calm (dominantOrder) —
    // each beat carries its own `order` (its true temporal position along
    // the page, assigned in Portfolio.jsx — not array index, since bridges
    // and moments are registered in separate passes), which picks which
    // camera-lean pattern is active (see below).
    let calmTarget = 0;
    let compressionTarget = 0;
    let dominantCalm = 0;
    let dominantOrder = -1;

    const beats = beatsRef.current;
    for (let i = 0; i < beats.length; i += 1) {
      const beat = beats[i];
      const p = beat.progressRef.current;

      const c = calmFromRanges(p, beat.calmIn, beat.calmOut);
      if (c > calmTarget) calmTarget = c;
      if (c > dominantCalm) {
        dominantCalm = c;
        dominantOrder = beat.order ?? i;
      }

      // Compression trails calm (c²): the world quiets first, then recedes.
      const comp = c * c * beat.compressionScale;
      if (comp > compressionTarget) compressionTarget = comp;

      const last = beat.lastP ?? 0;
      if (last < beat.releaseAt && p >= beat.releaseAt) {
        energyRef.current = 1;
      }
      beat.lastP = p;
    }

    smoothCalmRef.current = THREE.MathUtils.damp(
      smoothCalmRef.current,
      calmTarget,
      3.2,
      delta,
    );
    smoothCompressionRef.current = THREE.MathUtils.damp(
      smoothCompressionRef.current,
      compressionTarget,
      3.2,
      delta,
    );
    energyRef.current *= Math.exp(-delta * ENERGY_DECAY);
    // Fast attack (the surge), slow decay (the ring-out): the smoothed copy
    // chases the raw impulse quickly on the way up and follows its
    // exponential tail on the way down.
    smoothEnergyRef.current = THREE.MathUtils.damp(
      smoothEnergyRef.current,
      energyRef.current,
      energyRef.current > smoothEnergyRef.current ? 9 : 30,
      delta,
    );

    const calm = smoothCalmRef.current;
    const compress = smoothCompressionRef.current;
    const energy = smoothEnergyRef.current;
    // One multiplier for every ambient amplitude: silence before the reveal,
    // overshoot after it. Contrast is the message.
    const motionScale = (1 - CALM_MOTION_CUT * calm) * (1 + energy * 0.9);
    // Ambient amplitude never bottoms out — a hold is quieter than a
    // transition, never silent. This is what keeps the world breathing
    // through the stillest part of a pin.
    const ambientAmp = AMBIENT_CALM_FLOOR + (1 - AMBIENT_CALM_FLOOR) * (1 - calm);
    const breathe = state.clock.elapsedTime;

    // Raw scroll progress arrives in discrete per-tick steps, which reads as
    // an instant, mechanical follow when it drives rotation/position
    // directly. Damping it — same technique as the footer reveal below —
    // gives the cluster and hero base motion continuity and weight without
    // changing where either ends up. Calm additionally slows the follow
    // itself (the world takes longer to respond — quieter), energy speeds it
    // back up.
    smoothScrollRef.current = THREE.MathUtils.damp(
      smoothScrollRef.current,
      scrollProgressRef.current,
      SCROLL_DAMPING * (0.35 + 0.65 * (1 - calm)) * (1 + energy * 0.6),
      delta,
    );
    const scrollT = smoothScrollRef.current;

    // ── Camera language. Three independent, additive sources — a scroll
    // stopping can only ever freeze the first of them:
    //
    //   dolly     — calm-driven lean-in, as before: settles fully during a
    //               hold, so the camera is genuinely still exactly when the
    //               world is (contrast is what makes energy's release read).
    //   journey   — a slow, monotonic push tied to overall page progress:
    //               never resets, never pauses, so the visitor is always a
    //               little further "into" the world than the last beat —
    //               travelling, not oscillating in place.
    //   lean      — which of two subtle gestures (a small extra push, or a
    //               gentle FOV reframe) alternates in as each beat becomes
    //               dominant, damped so the handoff between beats eases
    //               rather than snaps. Both damped refs relax to 0 the
    //               instant no beat is dominant, so idle scroll between
    //               beats never carries a stale lean.
    //
    // Only .position.z and .fov are ever touched — see the constants above
    // for why.
    const journeyPush = scrollT * JOURNEY_Z_MAX;
    const pushTarget =
      dominantOrder >= 0 && dominantOrder % 2 === 0 ? dominantCalm * BEAT_LEAN_PUSH : 0;
    const reframeTarget =
      dominantOrder >= 0 && dominantOrder % 2 === 1 ? dominantCalm * BEAT_LEAN_FOV : 0;

    leanPushRef.current = THREE.MathUtils.damp(leanPushRef.current, pushTarget, BEAT_LEAN_DAMP, delta);
    leanReframeRef.current = THREE.MathUtils.damp(
      leanReframeRef.current,
      reframeTarget,
      BEAT_LEAN_DAMP,
      delta,
    );

    // A whisper of continuous motion even at a dead stop — never cut by
    // calm, only ever by half, so the frame is never truly motionless.
    const ambientCameraZ = Math.sin(breathe * 0.12) * AMBIENT_CAMERA_Z * ambientAmp;

    camera.position.z =
      CAMERA_Z -
      calm * CAMERA_DOLLY +
      energy * 0.12 -
      journeyPush -
      leanPushRef.current +
      ambientCameraZ;
    camera.fov = CAMERA_FOV - calm * CAMERA_FOV_TIGHTEN - leanReframeRef.current;
    camera.updateProjectionMatrix();

    smoothFooterRef.current = THREE.MathUtils.damp(
      smoothFooterRef.current,
      footerProgressRef.current,
      6,
      delta,
    );

    const footerReveal = smoothFooterRef.current;
    const footerEased = easeInOutCubic(footerReveal);
    const preFooter = 1 - footerReveal;

    const morph = resolveActiveMorph(morphTargetsRef.current);
    const m = morph ? morph.m : 0;
    const flightT = flightEase(phase01(m, MORPH_PHASES.flight));

    // ── Idle presence: the hero cube fades out while at rest and fades back
    // in shortly before the next morph target arrives (rect-based, see
    // resolveRestPresence). Once a morph is actually underway (m past a tiny
    // sliver), presence is forced to 1 so the fade-in can never lag behind
    // and pop right as the flight begins.
    const restPresenceTarget = resolveRestPresence(morphTargetsRef.current, size.height);
    restPresenceRef.current = THREE.MathUtils.damp(
      restPresenceRef.current,
      restPresenceTarget,
      REST_PRESENCE_DAMP,
      delta,
    );
    const usagePresence = smoothstep(clamp01(m / USAGE_PRESENCE_M));
    const presence = Math.max(restPresenceRef.current, usagePresence);

    // ── Cluster: recedes on scroll/footer; the director's calm scales every
    // ambient amplitude down toward stillness before a reveal, compression
    // pulls the whole formation back and dims it — negative space opens at
    // the center of the frame where the typography is about to exist — and
    // the post-reveal energy impulse briefly overshoots everything back in.
    //
    // The ambientRot/Pos terms are the "background keeps breathing" half of
    // the continuous-world requirement: driven by elapsed time rather than
    // scroll, so they never stop even if the scrollbar does — only calm's
    // half-amplitude floor (ambientAmp) quiets them, never silences them.
    const ambientRotY = Math.sin(breathe * 0.11) * AMBIENT_CLUSTER_ROT_Y * ambientAmp;
    const ambientRotX = Math.cos(breathe * 0.083) * AMBIENT_CLUSTER_ROT_X * ambientAmp;
    const ambientPosY = Math.sin(breathe * 0.065 + 1.7) * AMBIENT_CLUSTER_POS_Y * ambientAmp;
    const ambientPosX = Math.cos(breathe * 0.072) * AMBIENT_CLUSTER_POS_X * ambientAmp;

    const clusterRotBlend = 0.12 + preFooter * 0.88;
    group.rotation.y = scrollT * Math.PI * 0.38 * clusterRotBlend * motionScale + ambientRotY;
    group.rotation.x =
      (scrollT * 0.2 - 0.06) * (0.18 + preFooter * 0.82) * motionScale + ambientRotX;
    group.position.y =
      scrollT * 0.52 * motionScale - 0.18 - footerEased * 0.42 + compress * 0.3 + ambientPosY;
    group.position.x =
      (scrollT - 0.5) * 0.32 * (0.25 + preFooter * 0.75) * motionScale + ambientPosX;
    group.position.z = scrollT * -2 - footerEased * 3.2 - compress * 2.6 + energy * 0.5;
    group.scale.setScalar((1 - flightT * 0.08) * (1 - compress * 0.1));
    clusterMaterial.opacity =
      (1 - easeOutCubic(footerReveal) * 0.92) *
      CANVAS_BG_BLEND *
      (1 - compress * 0.65) *
      (1 + energy * 0.25) *
      // "Lighting continues changing" — a faint, ever-present opacity
      // breath standing in for illumination shifts in an unlit wireframe
      // scene; same ambient floor as the rest of this layer.
      (1 + Math.sin(breathe * 0.09 + 2.1) * AMBIENT_CLUSTER_OPACITY * ambientAmp);

    // ── Hero cube, free-flight base transform (scroll + footer driven).
    // Calm slows its tumble too — by the time a reveal begins the cube is
    // nearly composed, ready to act. The ambientHero terms are "the cube
    // continues drifting" even if scroll input stops entirely — always
    // present while the cube is free, and automatically silenced by
    // freeRotation as it commits to a morph (no wobble right as it docks
    // into a DOM rect).
    const freeRotation = 1 - flightT;
    const heroCalm = 1 - 0.7 * calm;
    const ambientHeroX = Math.sin(breathe * 0.14 + 0.5) * AMBIENT_HERO_ROT_X * ambientAmp;
    const ambientHeroY = Math.cos(breathe * 0.1) * AMBIENT_HERO_ROT_Y * ambientAmp;
    const baseRotX =
      (scrollT * Math.PI * 1.5 * preFooter * preFooter * heroCalm + footerEased * 0.38 + ambientHeroX) *
      freeRotation;
    const baseRotY =
      (scrollT * Math.PI * 2 * preFooter * preFooter * heroCalm + footerEased * 0.24 + ambientHeroY) *
      freeRotation;
    const baseRotZ = footerEased * 0.06 * freeRotation;

    const basePosX = footerEased * 0.04;
    const basePosY = scrollT * -1 + footerEased * 0.62;
    const basePosZ = -footerEased * 1.2;
    const baseScale = 0.5;

    const baseOpacity = (0.72 + preFooter * 0.28) * CANVAS_BG_BLEND;

    if (m <= 0.0001) {
      hero.rotation.set(baseRotX, baseRotY, baseRotZ);
      hero.position.set(basePosX, basePosY, basePosZ);
      hero.scale.setScalar(baseScale);
      heroMaterial.opacity = baseOpacity * presence;
      heroMaterial.color.copy(_lineColorBase);
      outline.visible = false;
      return;
    }

    hero.rotation.set(baseRotX, baseRotY, baseRotZ);

    // ── Morph: the cube flies to the live DOM rect of the active glass card.
    const { target } = morph;
    measureWorldRect(target.el, target.radiusPx, camera, size.width, size.height, _worldRect);

    const flattenT = smoothstep(phase01(m, MORPH_PHASES.flatten));
    const roundT = smoothstep(phase01(m, MORPH_PHASES.round));
    const wireFadeT = smoothstep(phase01(m, MORPH_PHASES.wireFade));
    const outlineInT = smoothstep(phase01(m, MORPH_PHASES.outlineIn));
    const outlineFadeT = smoothstep(phase01(m, MORPH_PHASES.outlineFade));
    const borderColorT = smoothstep(phase01(m, MORPH_PHASES.borderColor));
    const brightT = smoothstep(clamp01(m / 0.25));

    // Depth collapses from a true cube (min face side) to a hairline slab.
    const faceMin = Math.min(_worldRect.width, _worldRect.height);
    const depth = THREE.MathUtils.lerp(faceMin, MORPH_END_DEPTH, flattenT);

    // The front face must land exactly on the z = 0 measurement plane.
    hero.position.set(
      THREE.MathUtils.lerp(basePosX, _worldRect.x, flightT),
      THREE.MathUtils.lerp(basePosY, _worldRect.y, flightT),
      THREE.MathUtils.lerp(basePosZ, -depth / 2, flightT),
    );
    hero.scale.set(
      THREE.MathUtils.lerp(baseScale, _worldRect.width, flightT),
      THREE.MathUtils.lerp(baseScale, _worldRect.height, flightT),
      THREE.MathUtils.lerp(baseScale, depth, flightT),
    );

    // The selected cube brightens out of the background, then its box edges
    // dissolve while the rounded outline (and the DOM card) take over.
    heroMaterial.opacity =
      THREE.MathUtils.lerp(baseOpacity, 0.95, brightT) * (1 - wireFadeT) * presence;
    heroMaterial.color.copy(_lineColorBase);

    // ── Rounded outline: tracks the cube's live front face, radius grows from
    // a perfect square (radius 0) to the DOM card's exact border-radius.
    const outlineAlpha = outlineInT * (1 - outlineFadeT);
    outline.visible = outlineAlpha > 0.001;

    if (outline.visible) {
      writeRoundedRect(
        outlineGeometry.getAttribute('position'),
        hero.scale.x,
        hero.scale.y,
        _worldRect.radius * roundT,
      );
      outlineGeometry.computeBoundingSphere();
      // Front-face anchor: local (0, 0, depth/2) carried through the cube's
      // residual rotation, so the outline stays glued to the face mid-flight.
      _outlineOffset.set(0, 0, hero.scale.z / 2 + 0.002).applyEuler(hero.rotation);
      outline.position.copy(hero.position).add(_outlineOffset);
      outline.rotation.copy(hero.rotation);
      outlineMaterial.opacity = outlineAlpha * 0.95;
      outlineMaterial.color.lerpColors(_lineColorBase, _cardBorderColor, borderColorT);
    }
  });

  return (
    <>
      {/* Il muro fuso ad alte prestazioni — renderOrder basso, sempre dietro */}
      <group ref={groupRef}>
        <lineSegments
          ref={clusterLinesRef}
          material={clusterMaterial}
          renderOrder={0}
          frustumCulled={false}
        >
          <bufferGeometry />
        </lineSegments>
      </group>

      {/* Il cubo eroe: lo stesso oggetto che diventa ogni glass card DOM */}
      <lineSegments
        ref={heroRef}
        geometry={unitEdges}
        material={heroMaterial}
        renderOrder={50}
        frustumCulled={false}
      />

      {/* Sagoma arrotondata della faccia frontale: il ponte tra wireframe e
          bordo DOM — mai un riempimento, mai una card disegnata in WebGL. */}
      <lineLoop
        ref={morphOutlineRef}
        geometry={outlineGeometry}
        material={outlineMaterial}
        visible={false}
        renderOrder={60}
        frustumCulled={false}
      />
    </>
  );
}
