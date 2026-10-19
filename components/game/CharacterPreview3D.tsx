// components/game/CharacterPreview3D.tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CharacterAppearance } from "@/store/characterAppearance";
import CharacterModel from "@/components/game/CharacterModel";

type CharacterPreview3DProps = {
  appearance: CharacterAppearance;
  height?: number;
};

export default function CharacterPreview3D({
  appearance,
  height = 300,
}: CharacterPreview3DProps) {
  return (
    <div
      style={{ width: "100%", height }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#eaf4e8] to-[#d8e5d5]"
    >
      <Canvas
        camera={{ position: [0, 70, 120], fov: 35, near: 1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight
          position={[50, 100, 50]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-50, 60, -30]} intensity={0.6} />

        <group position={[0, -27, 0]}>
          {/* Key forces a full re-mount when appearance changes,
              ensuring the material updates immediately */}
          <CharacterModel
            key={`${appearance.skin}-${appearance.hairstyle}-${appearance.shirt}`}
            appearance={appearance}
            targetHeight={70}
          />
        </group>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableRotate
          autoRotate
          autoRotateSpeed={1.2}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.8}
          target={[0, 12, 0]}
        />
      </Canvas>

      <span className="pointer-events-none absolute left-3 top-2 rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#216342]">
        Drag to rotate
      </span>
    </div>
  );
}