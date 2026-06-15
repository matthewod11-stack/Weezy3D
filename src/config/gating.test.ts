import { describe, it, expect } from "vitest";
import { abilitiesForArea, gatingPower } from "./gating";

describe("derived gating", () => {
  it("abilitiesForArea = grants of all EARLIER areas' companions", () => {
    expect([...abilitiesForArea("bedroom")]).toEqual([]);
    expect([...abilitiesForArea("hallway")]).toEqual(["doubleJump"]);
    // Cat is metAtStart, so the Kitchen's own set now includes wallClimb.
    expect([...abilitiesForArea("kitchen")].sort()).toEqual(["dash", "doubleJump", "wallClimb"]);
    expect(abilitiesForArea("dollhouse").size).toBe(5);
  });
  it("gatingPower = the previous area's companion's grant; null for bedroom", () => {
    expect(gatingPower("bedroom")).toBeNull();
    expect(gatingPower("hallway")).toBe("doubleJump");
    expect(gatingPower("kitchen")).toBe("dash");
  });
});
