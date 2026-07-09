/**
 * Butterfly flight choreography — pure math for the painted-diorama's
 * ambient-life ingredient (playbook §5.7): a handful of the wallpaper's
 * butterflies come alive and flutter at backdrop depth.
 *
 * No THREE, no DOM. The view (paintedBackdrop.ts) owns meshes; this owns
 * where a butterfly is and how its wings sit at a moment in time —
 * deterministic per seed (seeded phases, never Math.random), following the
 * fireplace-flicker pattern: sums of incommensurate sines so the motion
 * never visibly loops.
 */

export interface ButterflyPose {
  /** Wander offset from the anchor point, world units (±WANDER_X / ±WANDER_Y). */
  dx: number;
  dy: number;
  /** Wing openness 0..1 — 0 folded up, 1 spread flat. The view maps this to hinge rotation. */
  wing: number;
  /** Which way she's drifting (−1 left, +1 right) so the view can face her along it. */
  facing: -1 | 1;
}

export const WANDER_X = 2.6;
export const WANDER_Y = 1.3;

/** Deterministic per-seed phase/frequency salts. */
function salt(seed: number, k: number): number {
  const s = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s); // 0..1
}

export function butterflyPose(elapsedMs: number, seed: number): ButterflyPose {
  const t = elapsedMs / 1000;

  // Wander: two incommensurate sines per axis; y rides a touch faster
  // (butterflies bob more than they cruise).
  const px1 = salt(seed, 1) * Math.PI * 2;
  const px2 = salt(seed, 2) * Math.PI * 2;
  const py1 = salt(seed, 3) * Math.PI * 2;
  const py2 = salt(seed, 4) * Math.PI * 2;
  const dx =
    WANDER_X * (0.64 * Math.sin(t * 0.31 + px1) + 0.36 * Math.sin(t * 0.113 + px2));
  const dy =
    WANDER_Y * (0.58 * Math.sin(t * 0.47 + py1) + 0.42 * Math.sin(t * 0.19 + py2));

  // Wing flap: ~5 beats/s, but a slow envelope drops the amplitude to a
  // near-glide every few seconds so they aren't sewing machines.
  const flapPhase = salt(seed, 5) * Math.PI * 2;
  const envelope = 0.55 + 0.45 * Math.sin(t * 0.9 + salt(seed, 6) * Math.PI * 2);
  const wing = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 5 + flapPhase) * envelope;

  // Facing follows the horizontal drift velocity (analytic derivative of dx).
  const vx =
    0.64 * 0.31 * Math.cos(t * 0.31 + px1) + 0.36 * 0.113 * Math.cos(t * 0.113 + px2);
  return { dx, dy, wing: Math.min(1, Math.max(0, wing)), facing: vx < 0 ? -1 : 1 };
}
