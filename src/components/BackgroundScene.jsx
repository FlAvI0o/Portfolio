import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';

const DESKTOP_COUNT = 800;
const MOBILE_COUNT = 100;
const LINE_COLOR = '#111111';
const HERO_ACCENT_COLOR = '#ffffff';
const CANVAS_BG_BLEND = 0.42;
const PROFILE_SCREEN_HEIGHT_FRACTION = 0.36;
const PROFILE_SCREEN_HEIGHT_FRACTION_MOBILE = 0.32;

const _heroColorBase = new THREE.Color(LINE_COLOR);
const _heroColorAccent = new THREE.Color(HERO_ACCENT_COLOR);
const _heroWorldPos = new THREE.Vector3();

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

function resolveProfilePhase(progress) {
  let cubeGrowT = 0;
  let photoFadeT = 0;

  if (progress <= 0 || progress >= 1) {
    return { cubeGrowT, photoFadeT, active: false };
  }

  if (progress < 0.25) {
    const enterP = progress / 0.25;
    cubeGrowT = clamp01(enterP / 0.72);
    photoFadeT = clamp01(enterP);
  } else if (progress > 0.75) {
    const exitP = (1 - progress) / 0.25;
    photoFadeT = clamp01(exitP);
    cubeGrowT = clamp01((exitP - 0.38) / 0.62);
  } else {
    cubeGrowT = 1;
    photoFadeT = 1;
  }

  return {
    cubeGrowT,
    photoFadeT,
    active: cubeGrowT > 0.001 || photoFadeT > 0.001,
  };
}

function resolveMaxProfileHeroScale(camera, heroObject, isLightweight) {
  heroObject.getWorldPosition(_heroWorldPos);
  const dist = camera.position.distanceTo(_heroWorldPos);
  const fovRad = (camera.fov * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * dist;
  const screenFraction = isLightweight
    ? PROFILE_SCREEN_HEIGHT_FRACTION_MOBILE
    : PROFILE_SCREEN_HEIGHT_FRACTION;
  const maxPhotoWorldHeight = visibleHeight * screenFraction;
  const scaleFromViewport = maxPhotoWorldHeight / PROFILE_PLANE_HEIGHT;
  const hardCap = isLightweight ? 1.28 : 1.48;

  return THREE.MathUtils.clamp(scaleFromViewport, 0.5, hardCap);
}

// Parsed once at module load — avoids per-frame/render allocation inside useFrame
const power4Out = gsap.parseEase('power4.out');

const PROFILE_PLANE_HEIGHT = 1.4;
const PROFILE_IMAGE_ASPECT = 4896 / 6528;
const PROFILE_PLANE_WIDTH = PROFILE_PLANE_HEIGHT * PROFILE_IMAGE_ASPECT;

function buildProfilePlaneGeometry(width = PROFILE_PLANE_WIDTH, height = PROFILE_PLANE_HEIGHT) {
  return new THREE.PlaneGeometry(width, height);
}

function buildProfileWireGeometry(width = PROFILE_PLANE_WIDTH, height = PROFILE_PLANE_HEIGHT) {
  const plane = new THREE.PlaneGeometry(width, height);
  const edges = new THREE.EdgesGeometry(plane);
  plane.dispose();
  return edges;
}

function buildShadowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.18)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function BackgroundScene({
  scrollProgressRef,
  footerProgressRef,
  profileProgressRef,
  lightweightModeRef,
}) {
  const groupRef = useRef(null);
  const instancedMeshRef = useRef(null);
  const heroRef = useRef(null);
  const profileGroupRef = useRef(null);
  const profileShadowRef = useRef(null);
  const profileWireRef = useRef(null);
  const smoothFooterRef = useRef(0);
  const [instanceCount, setInstanceCount] = useState(() => resolveInstanceCount(lightweightModeRef));

  const unitEdges = useMemo(() => buildUnitEdgeGeometry(), []);
  const profilePlaneGeometry = useMemo(() => buildProfilePlaneGeometry(), []);
  const profileWireGeometry = useMemo(() => buildProfileWireGeometry(), []);
  const profileShadowTexture = useMemo(() => buildShadowTexture(), []);
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
  const profileShadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: profileShadowTexture,
        toneMapped: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      }),
    [profileShadowTexture],
  );
  const profileWireMaterial = useMemo(
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

  useFrame((state, delta) => {
    const group = groupRef.current;
    const hero = heroRef.current;
    if (!group || !hero || !scrollProgressRef) return;

    const { camera } = state;
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

    let cubeGrowT = 0;
    let photoFadeT = 0;
    let profileActive = false;

    if (profileProgressRef) {
      const p = profileProgressRef.current;
      const phase = resolveProfilePhase(p);
      cubeGrowT = phase.cubeGrowT;
      photoFadeT = phase.photoFadeT;
      profileActive = phase.active;
    }

    const cubeEased = power4Out(cubeGrowT);
    const photoEased = power4Out(photoFadeT);

    const clusterRotBlend = 0.12 + preFooter * 0.88;
    group.rotation.y = t * Math.PI * 0.38 * clusterRotBlend;
    group.rotation.x = (t * 0.2 - 0.06) * (0.18 + preFooter * 0.82);
    group.position.y = t * 0.52 - 0.18 - footerEased * 0.42;
    group.position.x = (t - 0.5) * 0.32 * (0.25 + preFooter * 0.75);
    group.position.z = t * -2 - footerEased * 3.2;
    clusterMaterial.opacity = (1 - easeOutCubic(footerReveal) * 0.92) * CANVAS_BG_BLEND;

    const rotationDamp = preFooter * preFooter * (1 - cubeEased);
    hero.rotation.x = t * Math.PI * 1.5 * rotationDamp + footerEased * 0.38;
    hero.rotation.y = t * Math.PI * 2 * rotationDamp + footerEased * 0.24;
    hero.rotation.z = footerEased * 0.06;

    hero.position.x = footerEased * 0.04;
    hero.position.y = t * -1 + footerEased * 0.62;
    hero.position.z = -footerEased * 2.1;

    const heroBase = 0.5;
    const heroPeak = isLightweight ? 8.5 : 13.5;
    const maxProfileHeroScale = resolveMaxProfileHeroScale(camera, hero, isLightweight);
    const profileScaleAdd = cubeEased * (maxProfileHeroScale - heroBase);

    const footerProgress = footerReveal;
    const footerScaleT =
      cubeEased < 0.01 && footerProgress > 0.6 ? (footerProgress - 0.6) / 0.4 : 0;
    const footerScaleAdd = (heroPeak - heroBase) * Math.pow(footerScaleT, 2.2);

    const heroScale = THREE.MathUtils.clamp(
      heroBase + profileScaleAdd + footerScaleAdd,
      heroBase,
      cubeEased > 0.001 ? maxProfileHeroScale + footerScaleAdd : heroPeak,
    );
    hero.scale.setScalar(heroScale);

    const heroOpacityBase = (0.72 + preFooter * 0.28) * CANVAS_BG_BLEND;
    const heroOpacityProfile = isLightweight ? 0.88 : 0.96;
    heroMaterial.opacity = THREE.MathUtils.lerp(heroOpacityBase, heroOpacityProfile, cubeEased);
    heroMaterial.color.lerpColors(_heroColorBase, _heroColorAccent, cubeEased);

    const profileGroup = profileGroupRef.current;
    const profileShadow = profileShadowRef.current;
    const profileWire = profileWireRef.current;

    if (profileGroup && profileShadow && profileWire) {
      const shadowBoost = 1.04 + photoEased * 0.03;
      const shadowOpacity = photoEased * (isLightweight ? 0.12 : 0.18);

      profileShadow.scale.set(shadowBoost, shadowBoost, 1);
      profileWire.scale.setScalar(1);
      profileShadowMaterial.opacity = shadowOpacity;
      profileWireMaterial.opacity = photoEased * 0.92;
      profileWireMaterial.color.lerpColors(_heroColorBase, _heroColorAccent, cubeEased);

      profileGroup.visible = profileActive;
      hero.updateMatrixWorld();
      _b.set((t - 0.5) * 0.12, t * -0.35, 0.501);
      hero.localToWorld(_b);
      profileGroup.position.copy(_b);
      profileGroup.quaternion.copy(hero.quaternion);
      profileGroup.scale.copy(hero.scale);
      profileGroup.rotation.z -= 0.02;
    }
  });

  return (
    <>
      {/* Il muro fuso ad alte prestazioni — renderOrder basso, sempre dietro al profilo */}
      <group ref={groupRef}>
        <lineSegments
          ref={instancedMeshRef}
          material={clusterMaterial}
          renderOrder={0}
          frustumCulled={false}
        >
          <bufferGeometry />
        </lineSegments>
      </group>

      <lineSegments
        ref={heroRef}
        geometry={unitEdges}
        material={heroMaterial}
        renderOrder={50}
        frustumCulled={false}
      />

      <group ref={profileGroupRef} visible={false} renderOrder={100}>
        <mesh
          ref={profileShadowRef}
          geometry={profilePlaneGeometry}
          material={profileShadowMaterial}
          position={[0.06, -0.14, -0.04]}
          renderOrder={100}
          frustumCulled={false}
        />
        <lineSegments
          ref={profileWireRef}
          geometry={profileWireGeometry}
          material={profileWireMaterial}
          renderOrder={102}
          frustumCulled={false}
        />
      </group>
    </>
  );
}