import * as THREE from "three";

/**
 * Pooled one-shot particle bursts — landing dust, token sparkles, enemy
 * poofs, smash debris. ONE THREE.Points for the whole pool (§5.6 perf rule:
 * particle fields = one Points, never N sprites). Additive blending means
 * black = invisible, so dead slots are both parked off-screen AND faded to
 * black — either alone would hide them; both is robust against blending or
 * culling changes.
 *
 * All coordinates are WORLD UNITS (caller converts from render px via
 * coords.ts). Particles ride the diorama front at z ≈ +0.2.
 */

export interface BurstOpts {
  count?: number;
  color?: number;
  /** Optional second hex; particles lerp between color and color2. */
  color2?: number;
  /** Initial radial speed, world units/sec. */
  speed?: number;
  upBias?: number;
  /** World units/sec² downward (world y-up, so this decreases vy). */
  gravity?: number;
  lifeMs?: number;
  size?: number;
  /** Initial position jitter radius. */
  spread?: number;
}

export interface FxPool {
  readonly points: THREE.Points;
  spawnBurst(x: number, y: number, opts?: BurstOpts): void;
  update(dtMs: number): void;
  reset(): void;
  liveCount(): number;
}

const FX_Z = 0.2;
const PARK_Y = -9999;

const DEFAULTS = {
  count: 10,
  color: 0xffffff,
  speed: 2.2,
  upBias: 0.8,
  gravity: 4.5,
  lifeMs: 500,
  size: 0.09,
  spread: 0.15,
} as const;

/** Deterministic LCG (same Park-Miller pattern as bedroomSet.ts) — no Math.random. */
function makeRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function createFxPool(opts?: { capacity?: number; seed?: number }): FxPool {
  const capacity = opts?.capacity ?? 256;
  const rand = makeRand(opts?.seed ?? 1);

  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  // Per-slot sim state kept in plain arrays alongside the attributes.
  const velX = new Float32Array(capacity);
  const velY = new Float32Array(capacity);
  const ageMs = new Float32Array(capacity);
  const lifeMs = new Float32Array(capacity);
  const gravity = new Float32Array(capacity);
  const baseColor = new Float32Array(capacity * 3);
  const alive = new Uint8Array(capacity);
  const spawnSeq = new Float64Array(capacity);
  let seq = 0;
  let live = 0;

  for (let i = 0; i < capacity; i += 1) positions[i * 3 + 1] = PARK_Y;

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const colAttr = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("color", colAttr);

  const material = new THREE.PointsMaterial({
    size: DEFAULTS.size,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  // Parked slots at y=-9999 would inflate the bounding sphere anyway; skip culling.
  points.frustumCulled = false;

  function kill(i: number): void {
    alive[i] = 0;
    live -= 1;
    positions[i * 3] = 0;
    positions[i * 3 + 1] = PARK_Y;
    positions[i * 3 + 2] = FX_Z;
    colors[i * 3] = 0;
    colors[i * 3 + 1] = 0;
    colors[i * 3 + 2] = 0;
  }

  /** Free slot if one exists, else the oldest live slot (recycled). */
  function claimSlot(): number {
    if (live < capacity) {
      for (let i = 0; i < capacity; i += 1) {
        if (!alive[i]) return i;
      }
    }
    let oldest = 0;
    for (let i = 1; i < capacity; i += 1) {
      if (spawnSeq[i] < spawnSeq[oldest]) oldest = i;
    }
    kill(oldest);
    return oldest;
  }

  function spawnBurst(x: number, y: number, o?: BurstOpts): void {
    const count = Math.min(o?.count ?? DEFAULTS.count, capacity);
    const speed = o?.speed ?? DEFAULTS.speed;
    const upBias = o?.upBias ?? DEFAULTS.upBias;
    const grav = o?.gravity ?? DEFAULTS.gravity;
    const life = o?.lifeMs ?? DEFAULTS.lifeMs;
    const spread = o?.spread ?? DEFAULTS.spread;
    const c1 = new THREE.Color(o?.color ?? DEFAULTS.color);
    const c2 = o?.color2 !== undefined ? new THREE.Color(o.color2) : null;
    // One material for the whole pool → point size is pool-wide (last burst wins).
    if (o?.size !== undefined) material.size = o.size;

    for (let n = 0; n < count; n += 1) {
      const i = claimSlot();
      const angle = rand() * Math.PI * 2;
      const spd = speed * (0.5 + rand() * 0.5);
      alive[i] = 1;
      live += 1;
      seq += 1;
      spawnSeq[i] = seq;
      ageMs[i] = 0;
      lifeMs[i] = life;
      gravity[i] = grav;
      velX[i] = Math.cos(angle) * spd;
      velY[i] = Math.sin(angle) * spd + upBias;
      positions[i * 3] = x + (rand() * 2 - 1) * spread;
      positions[i * 3 + 1] = y + (rand() * 2 - 1) * spread;
      positions[i * 3 + 2] = FX_Z;
      const t = c2 ? rand() : 0;
      baseColor[i * 3] = c2 ? c1.r + (c2.r - c1.r) * t : c1.r;
      baseColor[i * 3 + 1] = c2 ? c1.g + (c2.g - c1.g) * t : c1.g;
      baseColor[i * 3 + 2] = c2 ? c1.b + (c2.b - c1.b) * t : c1.b;
      colors[i * 3] = baseColor[i * 3];
      colors[i * 3 + 1] = baseColor[i * 3 + 1];
      colors[i * 3 + 2] = baseColor[i * 3 + 2];
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  function update(dtMs: number): void {
    if (live === 0) return;
    const dt = dtMs / 1000;
    for (let i = 0; i < capacity; i += 1) {
      if (!alive[i]) continue;
      ageMs[i] += dtMs;
      if (ageMs[i] >= lifeMs[i]) {
        kill(i);
        continue;
      }
      velY[i] -= gravity[i] * dt;
      positions[i * 3] += velX[i] * dt;
      positions[i * 3 + 1] += velY[i] * dt;
      // Linear fade to black = alpha under additive blending.
      const fade = 1 - ageMs[i] / lifeMs[i];
      colors[i * 3] = baseColor[i * 3] * fade;
      colors[i * 3 + 1] = baseColor[i * 3 + 1] * fade;
      colors[i * 3 + 2] = baseColor[i * 3 + 2] * fade;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  function reset(): void {
    for (let i = 0; i < capacity; i += 1) {
      if (alive[i]) kill(i);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  return { points, spawnBurst, update, reset, liveCount: () => live };
}
