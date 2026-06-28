import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const BLOCK_COUNT = 18;

function BuongestoBlock({ position, scale }) {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#0a0a0a" roughness={0.35} metalness={0.15} />
    </mesh>
  );
}

export default function BackgroundScene({ scrollProgressRef, lightweightModeRef }) {
  const groupRef = useRef(null);

  const blocks = useMemo(
    () =>
      Array.from({ length: BLOCK_COUNT }, (_, index) => {
        const angle = (index / BLOCK_COUNT) * Math.PI * 2;
        const radius = 2.4 + (index % 3) * 0.6;
        return {
          id: index,
          position: [
            Math.cos(angle) * radius,
            (index % 5) * 0.35 - 0.8,
            Math.sin(angle) * radius - 1.5,
          ],
          scale: 0.35 + (index % 4) * 0.12,
        };
      }),
    [],
  );

  useFrame(() => {
    const group = groupRef.current;
    if (!group || !scrollProgressRef) return;

    if (lightweightModeRef?.current) return;

    const progress = scrollProgressRef.current;
    group.rotation.y = progress * Math.PI * 0.85;
    group.rotation.x = progress * 0.45;
    const scale = 1 + progress * 0.55;
    group.scale.set(scale, scale, scale);
  });

  return (
    <>
      <color attach="background" args={['#f5f5f5']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 2]} intensity={1.1} />
      <group ref={groupRef}>
        {blocks.map((block) => (
          <BuongestoBlock
            key={block.id}
            position={block.position}
            scale={block.scale}
          />
        ))}
      </group>
    </>
  );
}
