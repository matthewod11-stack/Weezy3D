import { describe, it, expect } from "vitest";
import { aimVelocity } from "./aimVelocity";

describe("aimVelocity", () => {
  it("points straight right at the given speed", () => {
    const v = aimVelocity(0, 0, 10, 0, 100);
    expect(v.vx).toBeCloseTo(100);
    expect(v.vy).toBeCloseTo(0);
  });
  it("points straight up at the given speed", () => {
    const v = aimVelocity(0, 0, 0, -10, 100);
    expect(v.vx).toBeCloseTo(0);
    expect(v.vy).toBeCloseTo(-100);
  });
  it("keeps the resultant magnitude equal to speed on a diagonal", () => {
    const v = aimVelocity(0, 0, 3, 4, 50); // 3-4-5 triangle
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(50);
    expect(v.vx).toBeCloseTo(30);
    expect(v.vy).toBeCloseTo(40);
  });
  it("falls back to straight-right when thrower and target coincide", () => {
    const v = aimVelocity(7, 7, 7, 7, 80);
    expect(v.vx).toBeCloseTo(80);
    expect(v.vy).toBeCloseTo(0);
  });
});
