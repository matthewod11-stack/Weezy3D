import { describe, it, expect } from "vitest";
import type * as THREE from "three";
import { createFxPool } from "./fx";

function positionsOf(points: THREE.Points): Float32Array {
  return points.geometry.getAttribute("position").array as Float32Array;
}

function colorsOf(points: THREE.Points): Float32Array {
  return points.geometry.getAttribute("color").array as Float32Array;
}

/** Indices of live-looking slots (not parked at y=-9999). */
function liveXs(points: THREE.Points): number[] {
  const pos = positionsOf(points);
  const xs: number[] = [];
  for (let i = 0; i < pos.length / 3; i += 1) {
    if (pos[i * 3 + 1] > -1000) xs.push(pos[i * 3]);
  }
  return xs;
}

describe("createFxPool", () => {
  it("spawn claims slots (default count 10)", () => {
    const pool = createFxPool({ seed: 42 });
    expect(pool.liveCount()).toBe(0);
    pool.spawnBurst(0, 0);
    expect(pool.liveCount()).toBe(10);
    pool.spawnBurst(0, 0, { count: 5 });
    expect(pool.liveCount()).toBe(15);
  });

  it("count is clamped to capacity", () => {
    const pool = createFxPool({ capacity: 8, seed: 42 });
    pool.spawnBurst(0, 0, { count: 1000 });
    expect(pool.liveCount()).toBe(8);
  });

  it("configures the single Points object per the perf rules", () => {
    const pool = createFxPool({ seed: 42 });
    const mat = pool.points.material as THREE.PointsMaterial;
    expect(mat.vertexColors).toBe(true);
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.sizeAttenuation).toBe(true);
    expect(pool.points.castShadow).toBe(false);
    expect(pool.points.receiveShadow).toBe(false);
  });

  it("update integrates gravity — y decreases (world y-up)", () => {
    const pool = createFxPool({ seed: 42 });
    pool.spawnBurst(3, 5, { count: 1, speed: 0, upBias: 0, spread: 0, lifeMs: 5000 });
    const pos = positionsOf(pool.points);
    expect(pos[0]).toBe(3);
    expect(pos[1]).toBe(5);
    pool.update(100);
    const y1 = pos[1];
    expect(y1).toBeLessThan(5);
    pool.update(100);
    // Accelerating: the second step drops further than the first.
    expect(y1 - pos[1]).toBeGreaterThan(5 - y1);
    expect(pos[2]).toBeCloseTo(0.2); // diorama front plane
  });

  it("particles die after lifeMs", () => {
    const pool = createFxPool({ seed: 42 });
    pool.spawnBurst(0, 0, { count: 6, lifeMs: 500 });
    pool.update(499);
    expect(pool.liveCount()).toBe(6);
    pool.update(1);
    expect(pool.liveCount()).toBe(0);
    expect(liveXs(pool.points)).toHaveLength(0);
  });

  it("reset kills all live particles", () => {
    const pool = createFxPool({ seed: 42 });
    pool.spawnBurst(0, 0, { count: 12, lifeMs: 60000 });
    pool.update(16);
    pool.reset();
    expect(pool.liveCount()).toBe(0);
    expect(liveXs(pool.points)).toHaveLength(0);
  });

  it("is deterministic — same seed, same calls, identical positions", () => {
    const mk = () => {
      const pool = createFxPool({ seed: 1234 });
      pool.spawnBurst(2, 3, { count: 20, color: 0xffc46a, color2: 0xf6c945 });
      pool.update(50);
      pool.spawnBurst(7, 1);
      pool.update(120);
      return pool;
    };
    const a = mk();
    const b = mk();
    expect(positionsOf(a.points)).toEqual(positionsOf(b.points));
    expect(colorsOf(a.points)).toEqual(colorsOf(b.points));
  });

  it("recycles the oldest particles when over capacity", () => {
    const pool = createFxPool({ capacity: 8, seed: 42 });
    const still = { speed: 0, upBias: 0, gravity: 0, spread: 0, lifeMs: 60000 };
    pool.spawnBurst(0, 0, { count: 4, ...still });
    pool.spawnBurst(10, 0, { count: 4, ...still });
    expect(pool.liveCount()).toBe(8);
    pool.spawnBurst(20, 0, { count: 4, ...still });
    expect(pool.liveCount()).toBe(8);
    const xs = liveXs(pool.points);
    // The x=0 burst (oldest) was evicted; x=10 and x=20 remain.
    expect(xs.filter((x) => Math.abs(x) < 5)).toHaveLength(0);
    expect(xs.filter((x) => Math.abs(x - 10) < 5)).toHaveLength(4);
    expect(xs.filter((x) => Math.abs(x - 20) < 5)).toHaveLength(4);
  });

  it("fades color toward black as age approaches life", () => {
    const pool = createFxPool({ seed: 42 });
    pool.spawnBurst(0, 0, { count: 1, color: 0xffffff, lifeMs: 1000, spread: 0 });
    const col = colorsOf(pool.points);
    expect(col[0]).toBe(1);
    pool.update(500);
    expect(col[0]).toBeCloseTo(0.5, 5);
    expect(col[1]).toBeCloseTo(0.5, 5);
    expect(col[2]).toBeCloseTo(0.5, 5);
    pool.update(400);
    expect(col[0]).toBeCloseTo(0.1, 5);
  });
});
