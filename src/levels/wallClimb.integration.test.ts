import { describe, it, expect } from "vitest";
import { checkReachability } from "./reachability";
import { WALL_CLIMB_DEMO_LEVEL } from "./wallClimbDemoLevel";

// Family-Room-faithful proof: that player has double-jump + dash already, so the
// sheer ledge must be unbeatable even WITH those — only wall-climb reaches it.
describe("wall-climb gate is real (P4 auto-proof)", () => {
  it("solvable WITH the Family Room loadout (double-jump + dash + wall-climb)", () => {
    const r = checkReachability(WALL_CLIMB_DEMO_LEVEL, {
      abilities: new Set(["doubleJump", "dash", "wallClimb"]),
    });
    expect(r.ok, r.problems.map((p) => p.message).join(" | ")).toBe(true);
  });

  it("NOT solvable without wall-climb (jump + dash can't scale the wall)", () => {
    const r = checkReachability(WALL_CLIMB_DEMO_LEVEL, {
      abilities: new Set(["doubleJump", "dash"]),
    });
    expect(r.ok).toBe(false);
  });
});
