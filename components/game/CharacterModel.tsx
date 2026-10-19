// components/game/CharacterModel.tsx
"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CharacterAppearance } from "@/store/characterAppearance";

const FEMALE_MODEL_URL = "/models/character.glb";
const MALE_MODEL_URL = "/models/character_male.glb";

useGLTF.preload(FEMALE_MODEL_URL);
useGLTF.preload(MALE_MODEL_URL);

type CharacterModelProps = {
  appearance: CharacterAppearance;
  targetHeight?: number;
};

// =====================================================================
// EXACT MESH MAPS — confirmed from console output
// =====================================================================

const FEMALE_MAP: Record<string, keyof CharacterAppearance | "fixed-dark" | null> = {
  Object_7: null,          // Eyes
  Object_9: null,          // Eyes
  Object_11: "skin",       // Head + neck
  Object_13: null,         // Teeth
  Object_15: "hair",       // Hair
  Object_17: "skin",       // Arms + legs
  Object_19: "trousers",   // Shorts
  Object_21: "fixed-dark", // Shoes
  Object_23: "shirt",      // Shirt
};

// MALE model — mapped by order from the glTF inspector + runtime names from console
const MALE_MAP: Record<string, keyof CharacterAppearance | "fixed-dark" | null> = {
  // Head + face (7 parts) — all skin
  Object_7: "skin",
  Object_9: "skin",
  Object_10: "skin",
  Object_11: "skin",
  Object_12: "skin",
  Object_13: "skin",
  Object_14: "skin",
  // Teeth (leave original)
  Object_16: null,
  Object_17: null,
  // Eyes (leave original)
  Object_19: null,
  Object_20: null,
  Object_21: null,
  Object_22: null,
  // SHIRT
  Object_24: "shirt",
  // PANTS (2 parts)
  Object_26: "trousers",
  Object_27: "trousers",
  // SHOES (4 parts) — fixed dark
  Object_29: "fixed-dark",
  Object_30: "fixed-dark",
  Object_31: "fixed-dark",
  Object_32: "fixed-dark",
  // HAIR (2 parts)
  Object_34: "hair",
  Object_35: "hair",
};

// =====================================================================

export default function CharacterModel({
  appearance,
  targetHeight = 60,
}: CharacterModelProps) {
  const modelUrl =
    appearance.gender === "Man" ? MALE_MODEL_URL : FEMALE_MODEL_URL;
  const { scene } = useGLTF(modelUrl);

  const prepared = useMemo(() => {
    if (!scene) return null;

    const clone = cloneSkeleton(scene);
    const isFemale = appearance.gender === "Woman";

    clone.updateMatrixWorld(true);

    // Normalize both models to ~2 units so scaling is consistent
    const preBox = new THREE.Box3().setFromObject(clone);
    const preSize = new THREE.Vector3();
    preBox.getSize(preSize);

    if (preSize.y > 0.01) {
      const normalizeTo = 2;
      const normalizer = normalizeTo / preSize.y;
      clone.scale.multiplyScalar(normalizer);
      clone.updateMatrixWorld(true);
    }

    // Apply colors
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      child.visible = true;
      child.frustumCulled = false;
      child.castShadow = true;
      child.receiveShadow = true;

      const part = isFemale ? FEMALE_MAP[child.name] : MALE_MAP[child.name];

      // Log so we can verify
      console.log(
        `[${isFemale ? "FEMALE" : "MALE"} MESH] "${child.name}" → ${part ?? "skipped"}`
      );

      if (part === null || part === undefined) return;

      const color =
        part === "fixed-dark"
          ? new THREE.Color("#24272b")
          : new THREE.Color(appearance[part] as string);

      const old = child.material as THREE.MeshStandardMaterial | undefined;

      // Strip base-color textures for parts we recolor
      const stripTexture =
        part === "hair" || part === "trousers" || part === "shirt";

      const freshMat = new THREE.MeshStandardMaterial({
        color,
        map: stripTexture ? null : old?.map ?? null,
        normalMap: old?.normalMap ?? null,
        roughness:
          part === "hair"
            ? 0.9
            : part === "shirt"
            ? 0.8
            : old?.roughness ?? 0.75,
        metalness: old?.metalness ?? 0.05,
        side: THREE.FrontSide,
      });

      old?.dispose();
      child.material = freshMat;
    });

    // Final scale
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);

    let scale = 1;
    let yOffset = 0;

    if (size.y > 0.01) {
      scale = targetHeight / size.y;
      yOffset = -box.min.y * scale;
    } else {
      scale = targetHeight / 2;
    }

    return { clone, scale, yOffset };
  }, [
    scene,
    targetHeight,
    appearance.gender,
    appearance.skin,
    appearance.hair,
    appearance.shirt,
    appearance.trousers,
  ]);

  if (!prepared) return null;

  return (
    <group scale={prepared.scale} position={[0, prepared.yOffset, 0]}>
      <primitive object={prepared.clone} />
    </group>
  );
}