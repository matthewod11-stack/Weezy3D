/**
 * Rolling floor-top silhouette profile — the visual-only "Wonder ground
 * rolls" ingredient of the painted-diorama recipe (playbook §5.7).
 *
 * Pure math, no THREE, no DOM: given a floor platform's width it returns
 * sampled mound heights (world units, y-up, 0 = the physics floor top).
 * The mesh built from it sits BEHIND the shadow blob's z, so physics and
 * feet-planting are untouched — these are hummocks rolling behind the
 * walk line, not collision geometry.
 *
 * Shape rules the test pins:
 *  - deterministic per (width, seed) — seeded LCG, never Math.random
 *  - heights stay within [0, MAX_MOUND_HEIGHT] (no under-floor dips)
 *  - both ends taper to 0 so the ridge meets the plush lip flush
 *  - two incommensurate wavelengths so wide floors don't metronome
 */

export const MOUND_SAMPLE_STEP = 0.9;
export const MAX_MOUND_HEIGHT = 0.34;
/** Ends taper to zero across this many world units. */
const EDGE_TAPER = 2.2;

/** Same LCG family as the set dressing (deterministic renders). */
function lcg(seed: number): () => number {
  let s = (Math.floor(Math.abs(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * Sampled mound heights across a floor of `width` world units, one sample
 * every MOUND_SAMPLE_STEP (first sample at x=0, last at x=width).
 */
export function rollingHeights(width: number, seed: number): number[] {
  const rand = lcg(seed);
  const phase1 = rand() * Math.PI * 2;
  const phase2 = rand() * Math.PI * 2;
  const wave1 = 6.5 + rand() * 3.0; // ~6.5–9.5 units
  const wave2 = 3.1 + rand() * 1.6; // ~3.1–4.7 units
  const count = Math.max(2, Math.round(width / MOUND_SAMPLE_STEP) + 1);
  const heights: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = (i / (count - 1)) * width;
    const roll =
      0.62 * Math.sin((Math.PI * 2 * x) / wave1 + phase1) +
      0.38 * Math.sin((Math.PI * 2 * x) / wave2 + phase2);
    // Clamp the troughs to 0: separated soft hummocks with flat gaps read
    // plusher than a continuous wave (and can never dip below the floor).
    const mound = Math.max(0, roll) * MAX_MOUND_HEIGHT;
    const taper = Math.min(1, x / EDGE_TAPER, (width - x) / EDGE_TAPER);
    heights.push(mound * Math.max(0, taper));
  }
  return heights;
}
