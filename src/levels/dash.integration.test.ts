import { describe, it, expect } from "vitest";
import { checkReachability } from "./reachability";
import { DASH_DEMO_LEVEL } from "./dashDemoLevel";

// The Kitchen-faithful proof: the player ALREADY has double-jump there, so the
// gate must be unbeatable even WITH double-jump — only dash crosses it.
describe("dash gate is real (P3 auto-proof)", () => {
  it("solvable WITH the Kitchen loadout (double-jump + dash)", () => {
    const r = checkReachability(DASH_DEMO_LEVEL, {
      abilities: new Set(["doubleJump", "dash"]),
    });
    expect(r.ok, r.problems.map((p) => p.message).join(" | ")).toBe(true);
  });

  it("NOT solvable without dash (double-jump alone cannot clear the gap)", () => {
    const r = checkReachability(DASH_DEMO_LEVEL, { abilities: new Set(["doubleJump"]) });
    expect(r.ok).toBe(false);
  });
});
