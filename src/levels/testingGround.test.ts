import { describe, it, expect } from "vitest";
import { checkReachability } from "./reachability";
import {
  TESTING_GROUND,
  IMPLEMENTED_POWERS,
  grantAllImplementedPowers,
} from "./testingGround";
import { GameState } from "../state/GameState";

describe("testing ground", () => {
  it("lists the powers that are actually implemented today", () => {
    expect(IMPLEMENTED_POWERS).toContain("doubleJump");
    expect(IMPLEMENTED_POWERS).toContain("glide");
    expect(IMPLEMENTED_POWERS).toContain("dash");
    expect(IMPLEMENTED_POWERS).toContain("wallClimb");
    expect(IMPLEMENTED_POWERS).toContain("charge");
  });

  it("is fully traversable with all implemented powers (no dead-end)", () => {
    const result = checkReachability(TESTING_GROUND, {
      abilities: new Set(IMPLEMENTED_POWERS),
    });
    expect(result.ok, result.problems.map((p) => p.message).join(" | ")).toBe(true);
  });

  it("grantAllImplementedPowers unlocks every power in the roster", () => {
    const s = GameState.get();
    s.resetWorld();
    grantAllImplementedPowers(s);
    for (const id of IMPLEMENTED_POWERS) {
      expect(s.hasAbility(id)).toBe(true);
    }
  });
});
