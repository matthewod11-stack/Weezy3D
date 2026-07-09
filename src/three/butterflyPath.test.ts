import { describe, expect, it } from "vitest";
import { butterflyPose, WANDER_X, WANDER_Y } from "./butterflyPath";

describe("butterflyPose", () => {
  it("is deterministic for the same time + seed", () => {
    expect(butterflyPose(1234, 7)).toEqual(butterflyPose(1234, 7));
  });

  it("gives each seed its own flight (no synchronized swarm)", () => {
    const a = butterflyPose(2000, 1);
    const b = butterflyPose(2000, 2);
    expect(a.dx === b.dx && a.dy === b.dy).toBe(false);
  });

  it("stays inside the wander box at all times", () => {
    for (let t = 0; t <= 60_000; t += 137) {
      const pose = butterflyPose(t, 11);
      expect(Math.abs(pose.dx)).toBeLessThanOrEqual(WANDER_X);
      expect(Math.abs(pose.dy)).toBeLessThanOrEqual(WANDER_Y);
    }
  });

  it("keeps wing openness in [0, 1] and actually flaps", () => {
    let min = 1;
    let max = 0;
    for (let t = 0; t <= 4000; t += 16) {
      const { wing } = butterflyPose(t, 3);
      expect(wing).toBeGreaterThanOrEqual(0);
      expect(wing).toBeLessThanOrEqual(1);
      min = Math.min(min, wing);
      max = Math.max(max, wing);
    }
    expect(max - min).toBeGreaterThan(0.5); // real flaps, not a shiver
  });

  it("drifts over time (ambient life, not a pinned decal)", () => {
    const a = butterflyPose(0, 5);
    const b = butterflyPose(8000, 5);
    expect(Math.hypot(a.dx - b.dx, a.dy - b.dy)).toBeGreaterThan(0.3);
  });

  it("faces along its horizontal drift", () => {
    const pose = butterflyPose(500, 9);
    expect([-1, 1]).toContain(pose.facing);
  });
});
