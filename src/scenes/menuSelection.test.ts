import { describe, it, expect } from "vitest";
import { clientYToGameY, optionAtPointer } from "./menuSelection";

// Two options 44px apart (the spacing MenuScene uses at RENDER_SCALE 2), with a
// 28px selection threshold (14 * RENDER_SCALE).
const YS = [200, 244];
const THRESHOLD = 28;

describe("optionAtPointer", () => {
  it("selects the option clicked directly on its row", () => {
    expect(optionAtPointer(200, YS, THRESHOLD)).toBe(0);
    expect(optionAtPointer(244, YS, THRESHOLD)).toBe(1);
  });

  it("selects the nearer option for a click between rows", () => {
    expect(optionAtPointer(212, YS, THRESHOLD)).toBe(0); // closer to 200
    expect(optionAtPointer(236, YS, THRESHOLD)).toBe(1); // closer to 244
  });

  it("returns -1 for a click far from any option (title / empty space)", () => {
    expect(optionAtPointer(100, YS, THRESHOLD)).toBe(-1); // up near the title
    expect(optionAtPointer(400, YS, THRESHOLD)).toBe(-1); // below the menu
  });

  it("handles a single-option menu (no Continue yet)", () => {
    expect(optionAtPointer(200, [200], THRESHOLD)).toBe(0);
    expect(optionAtPointer(300, [200], THRESHOLD)).toBe(-1);
  });

  it("returns -1 for an empty option list", () => {
    expect(optionAtPointer(200, [], THRESHOLD)).toBe(-1);
  });
});

describe("clientYToGameY", () => {
  it("maps a click on a 2x-scaled canvas back to game space", () => {
    // canvas rect: top=90, height=720; game height=360 (2x). Click at clientY=552.
    // → (552 - 90) * (360 / 720) = 231 (the New Game row), NOT the raw 462 that
    // Phaser's stale pointer.y would report.
    expect(clientYToGameY(552, 90, 720, 360)).toBeCloseTo(231);
  });

  it("is identity when the canvas is displayed 1:1", () => {
    expect(clientYToGameY(200, 0, 360, 360)).toBe(200);
  });

  it("handles a 3x scale", () => {
    // height 1080 (3x), top 0, click at 693 → 693 * (360/1080) = 231
    expect(clientYToGameY(693, 0, 1080, 360)).toBeCloseTo(231);
  });

  it("returns NaN for a degenerate (zero-height) rect", () => {
    expect(Number.isNaN(clientYToGameY(100, 0, 0, 360))).toBe(true);
  });
});
