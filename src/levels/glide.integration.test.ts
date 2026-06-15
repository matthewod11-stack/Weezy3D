import { describe, it, expect } from "vitest";
import { checkReachability } from "./reachability";
import { GLIDE_DEMO_LEVEL } from "./glideDemoLevel";

describe("glide gate is real (P2 auto-proof)", () => {
  it("the glide demo is solvable WITH glide", () => {
    const result = checkReachability(GLIDE_DEMO_LEVEL, { abilities: new Set(["glide"]) });
    expect(result.ok).toBe(true);
  });

  it("the glide demo is NOT solvable without glide (the gate requires it)", () => {
    const result = checkReachability(GLIDE_DEMO_LEVEL, { abilities: new Set() });
    expect(result.ok).toBe(false);
  });
});
