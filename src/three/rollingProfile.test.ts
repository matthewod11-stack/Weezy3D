import { describe, expect, it } from "vitest";
import { MAX_MOUND_HEIGHT, MOUND_SAMPLE_STEP, rollingHeights } from "./rollingProfile";

describe("rollingHeights", () => {
  it("is deterministic for the same width + seed", () => {
    expect(rollingHeights(80, 42)).toEqual(rollingHeights(80, 42));
  });

  it("varies with the seed (floors must not metronome)", () => {
    expect(rollingHeights(80, 1)).not.toEqual(rollingHeights(80, 2));
  });

  it("never dips below the physics floor top nor above the cap", () => {
    for (const seed of [1, 7, 99, 12345]) {
      for (const h of rollingHeights(120, seed)) {
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(MAX_MOUND_HEIGHT);
      }
    }
  });

  it("tapers both ends to zero so the ridge meets the lip flush", () => {
    const heights = rollingHeights(60, 5);
    expect(heights[0]).toBe(0);
    expect(heights[heights.length - 1]).toBe(0);
  });

  it("actually rolls on a wide floor (non-degenerate)", () => {
    const heights = rollingHeights(100, 3);
    expect(Math.max(...heights)).toBeGreaterThan(MAX_MOUND_HEIGHT * 0.5);
  });

  it("samples at the documented step density", () => {
    const width = 45;
    expect(rollingHeights(width, 1)).toHaveLength(Math.round(width / MOUND_SAMPLE_STEP) + 1);
  });

  it("handles narrow floors without blowing up", () => {
    const heights = rollingHeights(1.5, 9);
    expect(heights.length).toBeGreaterThanOrEqual(2);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(0);
  });
});
