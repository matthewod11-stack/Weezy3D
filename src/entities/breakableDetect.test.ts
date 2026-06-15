import { describe, it, expect } from "vitest";
import { facingBreakable } from "./breakableDetect";
import type { Rect } from "./climbDetect";

const body: Rect = { x: 100, y: 50, w: 10, h: 22 }; // right edge 110, spans y 50..72
const ahead: Rect = { x: 116, y: 0, w: 12, h: 100 }; // 6px ahead (dx=6), vertically overlaps

describe("facingBreakable", () => {
  it("is -1 when there are no breakables", () => {
    expect(facingBreakable(body, 1, [], 14)).toBe(-1);
  });

  it("detects a breakable just ahead in the facing direction", () => {
    expect(facingBreakable(body, 1, [ahead], 14)).toBe(0);
  });

  it("ignores a breakable behind you", () => {
    expect(facingBreakable(body, -1, [ahead], 14)).toBe(-1);
  });

  it("ignores a breakable out of reach", () => {
    expect(facingBreakable(body, 1, [{ x: 200, y: 0, w: 12, h: 100 }], 14)).toBe(-1);
  });

  it("ignores a breakable that doesn't vertically overlap the body", () => {
    expect(facingBreakable(body, 1, [{ x: 116, y: 200, w: 12, h: 20 }], 14)).toBe(-1);
  });

  it("skips already-broken (null) entries and returns the live index", () => {
    expect(facingBreakable(body, 1, [null, ahead], 14)).toBe(1);
  });
});
