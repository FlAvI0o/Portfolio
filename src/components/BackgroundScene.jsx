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
  smoothstep,
  writeRoundedRect,
} from '../systems/cubeMorph.js';

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
const SCROLL_DAMPING = 5;

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
}) {
  const groupRef = useRef(null);
  const clusterLinesRef = useRef(null);
  const heroRef = useRef(null);
  const morphOutlineRef = useRef(null);
  const smoothFooterRef = useRef(0);
  const smoothScrollRef = useRef(0);

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

    // Raw scroll progress arrives in discrete per-tick steps, which reads as
    // an instant, mechanical follow when it drives rotation/position
    // directly. Damping it — same technique as the footer reveal below —
    // gives the cluster and hero base motion continuity and weight without
    // changing where either ends up.
    smoothScrollRef.current = THREE.MathUtils.damp(
      smoothScrollRef.current,
      scrollProgressRef.current,
      SCROLL_DAMPING,
      delta,
    );
    const scrollT = smoothScrollRef.current;

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

    // ── Cluster: recedes on scroll/footer and compresses slightly while a
    // cube is being "selected" out of it.
    const clusterRotBlend = 0.12 + preFooter * 0.88;
    group.rotation.y = scrollT * Math.PI * 0.38 * clusterRotBlend;
    group.rotation.x = (scrollT * 0.2 - 0.06) * (0.18 + preFooter * 0.82);
    group.position.y = scrollT * 0.52 - 0.18 - footerEased * 0.42;
    group.position.x = (scrollT - 0.5) * 0.32 * (0.25 + preFooter * 0.75);
    group.position.z = scrollT * -2 - footerEased * 3.2;
    group.scale.setScalar(1 - flightT * 0.08);
    clusterMaterial.opacity = (1 - easeOutCubic(footerReveal) * 0.92) * CANVAS_BG_BLEND;

    // ── Hero cube, free-flight base transform (scroll + footer driven).
    const freeRotation = 1 - flightT;
    const baseRotX = (scrollT * Math.PI * 1.5 * preFooter * preFooter + footerEased * 0.38) * freeRotation;
    const baseRotY = (scrollT * Math.PI * 2 * preFooter * preFooter + footerEased * 0.24) * freeRotation;
    const baseRotZ = footerEased * 0.06 * freeRotation;
    hero.rotation.set(baseRotX, baseRotY, baseRotZ);

    const basePosX = footerEased * 0.04;
    const basePosY = scrollT * -1 + footerEased * 0.62;
    const basePosZ = -footerEased * 1.2;
    const baseScale = 0.5;

    const baseOpacity = (0.72 + preFooter * 0.28) * CANVAS_BG_BLEND;

    if (m <= 0.0001) {
      hero.position.set(basePosX, basePosY, basePosZ);
      hero.scale.setScalar(baseScale);
      heroMaterial.opacity = baseOpacity;
      heroMaterial.color.copy(_lineColorBase);
      outline.visible = false;
      return;
    }

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
      THREE.MathUtils.lerp(baseOpacity, 0.95, brightT) * (1 - wireFadeT);
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
