// components/game/CharacterModel.tsx
"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CharacterAppearance } from "@/store/characterAppearance";
import { useFrame } from "@react-three/fiber";

const FEMALE_MODEL_URL = "/models/character.glb";
const MALE_MODEL_URL = "/models/character_male.glb";

useGLTF.preload(FEMALE_MODEL_URL);
useGLTF.preload(MALE_MODEL_URL);

export type CharacterAction = "idle" | "walk" | "sit" | "lay" | "work" | "shower" | "dance";

type CharacterModelProps = {
  appearance: CharacterAppearance;
  targetHeight?: number;
  action?: CharacterAction;
  /** Backwards compatible: used only when `action` is not passed. */
  isWalking?: boolean;
  targetRotation?: number; // radians
  /** Accepted for compatibility; no longer logs anything. */
  debug?: boolean;
};

/**
 * TUNING
 * SIGN.thigh / SIGN.calf: flip (1 <-> -1) if the sit pose bends the wrong way.
 * SIGN.arm: flip if arms swing WITH the same-side leg while walking.
 * ARM_FORWARD: flip (-1 <-> 1) if arms go BACKWARD when working / showering.
 */
const SIGN = { thigh: 1, calf: -1, arm: 1 };
const ARM_FORWARD = -1;

/** How far the T-pose arms are brought down: 0 = T-pose, 1 = hanging straight. */
const ARM_DOWN = 0.85;
/** Whole-body drop when sitting, as a fraction of targetHeight. */
const SIT_DROP = 0.25;
/** Lift when lying so the back rests on the surface, fraction of targetHeight. */
const LAY_LIFT = 0.08;

/** Arm raise (radians) for each pose. 0 = hanging, ~1.25 = reaching forward, ~2.4 = hands above head. */
const REACH = { sit: 0.5, work: 1.25, shower: 2.4 };

const LEG_BONES = {
  thighL: "CC_Base_L_Thigh_04",
  calfL: "CC_Base_L_Calf_05",
  thighR: "CC_Base_R_Thigh_019",
  calfR: "CC_Base_R_Calf_020",
} as const;
type LegKey = keyof typeof LEG_BONES;

const ARM_BONES = {
  armL: { upper: "CC_Base_L_Upperarm_050", fore: "CC_Base_L_Forearm_051" },
  armR: { upper: "CC_Base_R_Upperarm_078", fore: "CC_Base_R_Forearm_079" },
} as const;
type ArmKey = keyof typeof ARM_BONES;

type ArmRig = {
  bone: THREE.Object3D;
  rest: THREE.Quaternion; // local rotation after the arm was lowered
  parentQ: THREE.Quaternion;
  parentQInv: THREE.Quaternion;
};

const AXIS_X = new THREE.Vector3(1, 0, 0);

const FEMALE_MAP: Record<string, keyof CharacterAppearance | "fixed-dark" | null> = {
  Object_7: null, Object_9: null, Object_11: "skin", Object_13: null,
  Object_15: "hair", Object_17: "skin", Object_19: "trousers",
  Object_21: "fixed-dark", Object_23: "shirt",
};

const MALE_MAP: Record<string, keyof CharacterAppearance | "fixed-dark" | null> = {
  Object_7: "skin", Object_9: "skin", Object_10: "skin", Object_11: "skin",
  Object_12: "skin", Object_13: "skin", Object_14: "skin",
  Object_16: null, Object_17: null, Object_19: null, Object_20: null,
  Object_21: null, Object_22: null, Object_24: "shirt",
  Object_26: "trousers", Object_27: "trousers",
  Object_29: "fixed-dark", Object_30: "fixed-dark", Object_31: "fixed-dark", Object_32: "fixed-dark",
  Object_34: "hair", Object_35: "hair",
};

export default function CharacterModel({
  appearance,
  targetHeight = 60,
  action,
  isWalking = false,
  targetRotation = 0,
}: CharacterModelProps) {
  const modelUrl = appearance.gender === "Man" ? MALE_MODEL_URL : FEMALE_MODEL_URL;
  const { scene } = useGLTF(modelUrl);
  const poseRef = useRef<THREE.Group>(null);

  const currentAction: CharacterAction = action ?? (isWalking ? "walk" : "idle");

  const prepared = useMemo(() => {
    if (!scene) return null;
    const clone = cloneSkeleton(scene);
    const isFemale = appearance.gender === "Woman";

    clone.updateMatrixWorld(true);
    const preBox = new THREE.Box3().setFromObject(clone);
    const preSize = new THREE.Vector3();
    preBox.getSize(preSize);
    if (preSize.y > 0.01) {
      const normalizer = 2 / preSize.y;
      clone.scale.multiplyScalar(normalizer);
      clone.updateMatrixWorld(true);
    }

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.visible = true;
      child.frustumCulled = false;
      child.castShadow = true;
      child.receiveShadow = true;

      const part = isFemale ? FEMALE_MAP[child.name] : MALE_MAP[child.name];
      if (part === null || part === undefined) return;

      const color =
        part === "fixed-dark"
          ? new THREE.Color("#24272b")
          : new THREE.Color(appearance[part] as string);
      const old = child.material as THREE.MeshStandardMaterial | undefined;
      const stripTexture = part === "hair" || part === "trousers" || part === "shirt";

      const freshMat = new THREE.MeshStandardMaterial({
        color,
        map: stripTexture ? null : old?.map ?? null,
        normalMap: old?.normalMap ?? null,
        roughness: part === "hair" ? 0.9 : part === "shirt" ? 0.8 : old?.roughness ?? 0.75,
        metalness: old?.metalness ?? 0.05,
        side: THREE.FrontSide,
      });
      old?.dispose();
      child.material = freshMat;
    });

    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    let scale = 1, yOffset = 0;
    if (size.y > 0.01) {
      scale = targetHeight / size.y;
      yOffset = -box.min.y * scale;
    } else {
      scale = targetHeight / 2;
    }

    // ── Leg bones (rotated around local X) ──
    clone.updateMatrixWorld(true);
    const legs: Partial<Record<LegKey, THREE.Object3D>> = {};
    const legRest: Partial<Record<LegKey, THREE.Quaternion>> = {};
    (Object.keys(LEG_BONES) as LegKey[]).forEach((key) => {
      const bone = clone.getObjectByName(LEG_BONES[key]);
      if (bone) {
        legs[key] = bone;
        legRest[key] = bone.quaternion.clone();
      }
    });

    // ── Arms: bring them down from the T-pose, independent of bone axes ──
    const arms: Partial<Record<ArmKey, ArmRig>> = {};
    (Object.keys(ARM_BONES) as ArmKey[]).forEach((key) => {
      const upper = clone.getObjectByName(ARM_BONES[key].upper);
      const fore = clone.getObjectByName(ARM_BONES[key].fore);
      if (!upper || !fore || !upper.parent) return;

      const p0 = new THREE.Vector3();
      const p1 = new THREE.Vector3();
      upper.getWorldPosition(p0);
      fore.getWorldPosition(p1);
      const dir = p1.sub(p0).normalize();

      const full = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(0, -1, 0));
      const delta = new THREE.Quaternion().slerp(full, ARM_DOWN);

      const parentQ = new THREE.Quaternion();
      upper.parent.getWorldQuaternion(parentQ);
      const parentQInv = parentQ.clone().invert();

      // local' = parent^-1 * delta * parent * local
      upper.quaternion.premultiply(parentQ).premultiply(delta).premultiply(parentQInv);

      arms[key] = { bone: upper, rest: upper.quaternion.clone(), parentQ, parentQInv };
    });

    return { clone, scale, yOffset, legs, legRest, arms };
  }, [scene, targetHeight, appearance.gender, appearance.skin, appearance.hair, appearance.shirt, appearance.trousers]);

  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpE = useMemo(() => new THREE.Euler(), []);
  const targetQ = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state, delta) => {
    const g = poseRef.current;
    if (!g || !prepared) return;

    const k = 1 - Math.exp(-delta * 10); // smooth damping
    const t = state.clock.elapsedTime;

    // 1) Whole-body transform
    let targetRotX = 0;
    let targetY = 0;
    let targetZ = 0;
    if (currentAction === "lay") {
      targetRotX = -Math.PI / 2;          // on back, face up, head toward -Z
      targetY = targetHeight * LAY_LIFT;
      targetZ = targetHeight * 0.5;       // pivot is at the feet, so centre the body on the spot
    } else if (currentAction === "sit") {
      targetY = -targetHeight * SIT_DROP;
    } else if (currentAction === "walk") {
      targetY = Math.abs(Math.sin(t * 10)) * targetHeight * 0.015;
    }
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetRotX, k);
    g.position.y = THREE.MathUtils.lerp(g.position.y, targetY, k);
    g.position.z = THREE.MathUtils.lerp(g.position.z, targetZ, k);

    // 2) Per-action leg and arm angles
    const a: Record<LegKey, number> = { thighL: 0, thighR: 0, calfL: 0, calfR: 0 };
    let armAngleL = 0;
    let armAngleR = 0;

    if (currentAction === "sit") {
      a.thighL = a.thighR = 1.5 * SIGN.thigh;
      a.calfL = a.calfR = 1.5 * SIGN.calf;
      armAngleL = armAngleR = ARM_FORWARD * REACH.sit; // hands resting toward the lap
    } else if (currentAction === "dance") {
      // ✅ BOT DANCE LOGIC: Bobbing and arm swinging
      const beat = Math.sin(t * 8); // Fast 8Hz beat
      const sway = Math.cos(t * 4);
      
      a.thighL = beat * 0.2;
      a.thighR = -beat * 0.2;
      
      armAngleL = ARM_FORWARD * 1.8 + beat * 0.5; // Arms up
      armAngleR = ARM_FORWARD * 1.8 - beat * 0.5;
      
      targetY = Math.abs(beat) * targetHeight * 0.05; // Bob up and down
      g.rotation.z = sway * 0.05; // Slight body sway
    } else if (currentAction === "walk") {
      const swing = Math.sin(t * 8);
      a.thighL = swing * 0.6 * SIGN.thigh;
      a.thighR = -swing * 0.6 * SIGN.thigh;
      a.calfL = Math.max(0, -swing) * 0.8 * SIGN.calf;
      a.calfR = Math.max(0, swing) * 0.8 * SIGN.calf;
      armAngleL = swing * 0.5 * SIGN.arm;
      armAngleR = -swing * 0.5 * SIGN.arm;
    } else if (currentAction === "work") {
      // Hands out in front, small alternating motion like working on something
      const s = Math.sin(t * 5);
      armAngleL = ARM_FORWARD * REACH.work + s * 0.12;
      armAngleR = ARM_FORWARD * REACH.work - s * 0.12;
    } else if (currentAction === "shower") {
      // Hands raised to the head, scrubbing
      const s = Math.sin(t * 7);
      armAngleL = ARM_FORWARD * REACH.shower + s * 0.18;
      armAngleR = ARM_FORWARD * REACH.shower - s * 0.18;
    }

    (Object.keys(a) as LegKey[]).forEach((key) => {
      const bone = prepared.legs[key];
      const base = prepared.legRest[key];
      if (!bone || !base) return;
      tmpE.set(a[key], 0, 0);
      tmpQ.setFromEuler(tmpE);
      targetQ.copy(base).multiply(tmpQ);
      bone.quaternion.slerp(targetQ, k);
    });

    // 3) Arms: rotate around the model's side axis (works whatever the bone axes are)
    const armAngles: Record<ArmKey, number> = { armL: armAngleL, armR: armAngleR };
    (Object.keys(armAngles) as ArmKey[]).forEach((key) => {
      const rig = prepared.arms[key];
      if (!rig) return;
      tmpQ.setFromAxisAngle(AXIS_X, armAngles[key]);
      targetQ
        .copy(rig.rest)
        .premultiply(rig.parentQ)
        .premultiply(tmpQ)
        .premultiply(rig.parentQInv);
      rig.bone.quaternion.slerp(targetQ, k);
    });
  });

  if (!prepared) return null;

  return (
    <group rotation={[0, targetRotation, 0]}>
      <group ref={poseRef}>
        <group scale={prepared.scale} position={[0, prepared.yOffset, 0]}>
          <primitive object={prepared.clone} />
        </group>
      </group>
    </group>
  );
}