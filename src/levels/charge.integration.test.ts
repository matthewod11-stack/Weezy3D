import { describe, it, expect } from "vitest";
import { checkReachability } from "./reachability";
import { CHARGE_DEMO_LEVEL } from "./chargeDemoLevel";

// Backyard-faithful proof: that player has double-jump + dash + wall-climb
// already, so the barricade must be unbeatable even WITH those — only charge
// (smashing it) opens the path.
describe("charge gate is real (P5 auto-proof)", () => {
  it("solvable WITH the Backyard loadout (double-jump + dash + wall-climb + charge)", () => {
    const r = checkReachability(CHARGE_DEMO_LEVEL, {
      abilities: new Set(["doubleJump", "dash", "wallClimb", "charge"]),
    });
    expect(r.ok, r.problems.map((p) => p.message).join(" | ")).toBe(true);
  });

  it("NOT solvable without charge (the barricade blocks the only path)", () => {
    const r = checkReachability(CHARGE_DEMO_LEVEL, {
      abilities: new Set(["doubleJump", "dash", "wallClimb"]),
    });
    expect(r.ok).toBe(false);
  });
});
