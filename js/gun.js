/* gun.js — the game's pistol model (verbatim from the main game) + its solved two-handed stance numbers. */
import * as THREE from "three";

export function buildPistol3D() {
  const g = new THREE.Group();
  const matBody   = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.45, metalness: 0.75 });
  const matGrip   = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.85, metalness: 0.10 });
  const matBarrel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.30, metalness: 0.92 });
  const matAccent = new THREE.MeshStandardMaterial({ color: 0xccaa44, roughness: 0.50, metalness: 0.60 });

  /* Grip below the slide, at the fist */
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.095, 0.048), matGrip);
  grip.position.set(0, -0.045, -0.010);
  grip.rotation.x = 0.18;
  g.add(grip);

  /* Slide above grip */
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.032, 0.155), matBody);
  slide.position.set(0, 0.025, 0.035);
  g.add(slide);

  /* Barrel extension */
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.040, 8), matBarrel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.028, 0.135);
  g.add(barrel);

  /* Trigger guard */
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 4, 8, Math.PI), matBarrel);
  guard.rotation.z = Math.PI;
  guard.position.set(0, -0.010, 0.020);
  g.add(guard);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.020, 0.005), matBarrel);
  trigger.position.set(0, -0.008, 0.018);
  g.add(trigger);

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.008), matAccent);
  frontSight.position.set(0, 0.045, 0.100);
  g.add(frontSight);

  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.008, 0.008), matAccent);
  rearSight.position.set(0, 0.045, -0.035);
  g.add(rearSight);

  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.015, 0.015), matAccent);
  hammer.position.set(0, 0.038, -0.045);
  g.add(hammer);

  g.userData.muzzleLocal = new THREE.Vector3(0, 0.028, 0.155);
  return g;
}

/* ── Sniper: real bolt-action dimensions ───────────────────────
   Total length 1.13m (stock back -0.34 → muzzle +0.79). */

/* Solved joint numbers from the main game's gun-stances.js (pistol, pitch 0).
   0-2 R shoulder xyz · 3 R elbow.x · 4 R wrist.x · 5-7 L shoulder xyz · 8 L elbow.x · 9 L wrist.x
   10 spine.x · 11 spine.y · 12 hips.y · 13-15 head xyz */
export const POSE = {
  carry: [0.007, -0.102, 0.203, -1.813, 0.213, -0.365, -0.328, -0.509, -1.089, -0.026, 0.02, 0.11, 0, -0.02, -0.11, -0.419],     /* low "ready" carry while walking */
  aim:   [-1.919, 0.298, -0.003, -0.521, 0.784, -1.913, 0.019, -0.496, -0.097, 0.025, 0.108, 0.451, -0.369, -0.123, -0.099, 0.451],     /* aimed, two-handed */
};
export const LEGS_AIM = { lh: -0.24, lk: 0.26, rh: 0.13, rk: 0.36 };
