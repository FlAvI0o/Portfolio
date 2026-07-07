import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const DESKTOP_COUNT = 800;
const MOBILE_COUNT = 100;
const LINE_COLOR = '#111111';

const _dummy = new THREE.Object3D();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

function hash(seed) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function setInstanceTransform(index) {
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const isMassive = index % 8 === 0; // ~12.5% nodi hub ingombranti
  const yBase = -1.6;

  const h0 = hash(index);
  const h1 = hash(index + 1);
  const h2 = hash(index + 2);
  const h3 = hash(index + 3);
  const h4 = hash(index + 4);
  const h5 = hash(index + 5);

  const resolveHubCoords = (id, rh0, rh1, rh2) => {
    const band = id % 5;
    const angle = id * GOLDEN * 2.1 + rh1 * 0.55;
    let r;
    let y;

    if (band === 0) {
      r = Math.pow(rh0, 2.6) * 0.48;
      y = (rh2 - 0.5) * 1.4 + yBase;
    } else if (band <= 2) {
      r = 1.1 + rh0 * 0.85 + (band - 1) * 0.52;
      y = (rh2 - 0.5) * 3.8 + Math.sin(angle * 2) * 0.45 + yBase;
    } else {
      r = 2.05 + rh0 * 1.15;
      y = (rh2 - 0.5) * 5.2 + Math.cos(angle * 1.5) * 0.9 + yBase;
    }

    return {
      x: Math.cos(angle) * r,
      y,
      z: Math.sin(angle) * r,
    };
  };

  if (isMassive) {
    const hub = resolveHubCoords(Math.floor(index / 8), h0, h1, h2);
    _dummy.position.set(hub.x, hub.y, hub.z);

    const snap = h3 > 0.7 ? Math.PI * 0.5 : 0;
    _dummy.rotation.set(snap, h4 * Math.PI * 2, hash(index + 6) * 0.35);
    _dummy.scale.setScalar(0.82 + h0 * 0.38);
    return;
  }

  const parentIdx = index - (index % 8);
  const slot = index % 8;
  const ph0 = hash(parentIdx);
  const ph1 = hash(parentIdx + 1);
  const ph2 = hash(parentIdx + 2);
  const parent = resolveHubCoords(Math.floor(parentIdx / 8), ph0, ph1, ph2);

  const orbitR = 0.08 + h0 * 0.32 + slot * 0.018;
  const orbitPhi = slot * GOLDEN * 3 + h1 * Math.PI * 2;
  const orbitY = (h2 - 0.5) * 0.42 * (1 + slot * 0.08);

  _dummy.position.set(
    parent.x + Math.cos(orbitPhi) * orbitR,
    parent.y + orbitY,
    parent.z + Math.sin(orbitPhi) * orbitR,
  );

  const snap = h3 > 0.78 ? Math.PI * 0.5 : 0;
  _dummy.rotation.set(snap, h4 * Math.PI * 2, h5 * 0.25);
  _dummy.scale.setScalar(0.035 + h0 * 0.075);
}

function buildUnitEdgeGeometry() {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(box);
  box.dispose();
  return edges;
}

function resolveInstanceCount(lightweightModeRef) {
  if (lightweightModeRef?.current) return MOBILE_COUNT;
  return DESKTOP_COUNT;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export default function BackgroundScene({
  scrollProgressRef,
  footerProgressRef,
  lightweightModeRef,
}) {
  const groupRef = useRef(null);
  const instancedMeshRef = useRef(null);
  const heroRef = useRef(null);
  const smoothFooterRef = useRef(0);
  const [instanceCount, setInstanceCount] = useState(() => resolveInstanceCount(lightweightModeRef));

  const unitEdges = useMemo(() => buildUnitEdgeGeometry(), []);
  const clusterMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: LINE_COLOR,
        toneMapped: false,
        transparent: true,
        opacity: 1,
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
      }),
    [],
  );

  useEffect(() => {
    const syncCount = () => {
      setInstanceCount(resolveInstanceCount(lightweightModeRef));
    };

    syncCount();
    window.addEventListener('resize', syncCount);
    return () => window.removeEventListener('resize', syncCount);
  }, [lightweightModeRef]);

  // Costruzione del "Muro" (Statico, alte performance)
  useLayoutEffect(() => {
    const mesh = instancedMeshRef.current;
    if (!mesh) return;

    const source = unitEdges.attributes.position;
    const pairCount = source.count;
    const merged = new Float32Array(instanceCount * pairCount * 3);
    let write = 0;

    for (let i = 0; i < instanceCount; i += 1) {
      setInstanceTransform(i);
      _dummy.updateMatrix();

      for (let v = 0; v < pairCount; v += 2) {
        _a.fromBufferAttribute(source, v).applyMatrix4(_dummy.matrix);
        _b.fromBufferAttribute(source, v + 1).applyMatrix4(_dummy.matrix);

        merged[write++] = _a.x;
        merged[write++] = _a.y;
        merged[write++] = _a.z;
        merged[write++] = _b.x;
        merged[write++] = _b.y;
        merged[write++] = _b.z;
      }
    }

    mesh.geometry.setAttribute('position', new THREE.BufferAttribute(merged, 3));
    mesh.geometry.computeBoundingSphere();
  }, [instanceCount, unitEdges]);

  useEffect(
    () => () => {
      unitEdges.dispose();
      clusterMaterial.dispose();
      heroMaterial.dispose();
      instancedMeshRef.current?.geometry.dispose();
    },
    [unitEdges, clusterMaterial, heroMaterial],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    const hero = heroRef.current;
    if (!group || !hero || !scrollProgressRef) return;

    const t = scrollProgressRef.current;
    const footerTarget = footerProgressRef
      ? footerProgressRef.current
      : smoothstep(0.68, 0.95, t);

    smoothFooterRef.current = THREE.MathUtils.damp(
      smoothFooterRef.current,
      footerTarget,
      6,
      delta,
    );

    const footerReveal = smoothFooterRef.current;
    const footerEased = easeInOutCubic(footerReveal);
    const preFooter = 1 - footerReveal;
    const isLightweight = lightweightModeRef?.current;

    const clusterRotBlend = 0.12 + preFooter * 0.88;
    group.rotation.y = t * Math.PI * 0.38 * clusterRotBlend;
    group.rotation.x = (t * 0.2 - 0.06) * (0.18 + preFooter * 0.82);
    group.position.y = t * 0.52 - 0.18 - footerEased * 0.42;
    group.position.x = (t - 0.5) * 0.32 * (0.25 + preFooter * 0.75);
    group.position.z = t * -2 - footerEased * 3.2;
    clusterMaterial.opacity = 1 - easeOutCubic(footerReveal) * 0.92;

    const rotationDamp = preFooter * preFooter;
    hero.rotation.x = t * Math.PI * 1.5 * rotationDamp + footerEased * 0.38;
    hero.rotation.y = t * Math.PI * 2 * rotationDamp + footerEased * 0.24;
    hero.rotation.z = footerEased * 0.06;

    hero.position.x = footerEased * 0.04;
    hero.position.y = t * -1 + footerEased * 0.62;
    hero.position.z = -footerEased * 2.1;

    const heroBase = 0.5;
    const heroPeak = isLightweight ? 8.5 : 13.5;
    const anticipation = smoothstep(0, 0.18, footerReveal) * (1 - smoothstep(0.22, 0.48, footerReveal));
    const heroScale = heroBase + anticipation * 0.22 + (heroPeak - heroBase) * footerEased;

    hero.scale.setScalar(heroScale);
    heroMaterial.opacity = 0.72 + preFooter * 0.28;
  });

  return (
    <>
      <color attach="background" args={['#f5f5f5']} />
      
      {/* Il muro fuso ad alte prestazioni */}
      <group ref={groupRef}>
        <lineSegments ref={instancedMeshRef} material={clusterMaterial} frustumCulled={false}>
          <bufferGeometry />
        </lineSegments>
      </group>

      <lineSegments ref={heroRef} geometry={unitEdges} material={heroMaterial} />
    </>
  );
}