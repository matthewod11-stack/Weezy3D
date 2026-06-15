import { describe, it, expect } from "vitest";
import { abilitiesForArea, gatingPower } from "./gating";

describe("metAtStart — Cat's climbing is available IN the Kitchen", () => {
  it("abilitiesForArea('kitchen') includes wallClimb", () => {
    expect(abilitiesForArea("kitchen").has("wallClimb")).toBe(true);
  });
  it("still includes inherited doubleJump + dash", () => {
    const set = abilitiesForArea("kitchen");
    expect(set.has("doubleJump")).toBe(true);
    expect(set.has("dash")).toBe(true);
  });
  it("Hallway is unchanged (Dog is met at the finale — dash NOT in its own set)", () => {
    const set = abilitiesForArea("hallway");
    expect(set.has("doubleJump")).toBe(true);
    expect(set.has("dash")).toBe(false);
  });
  it("Kitchen's gate is still dash (the previous area's companion grant)", () => {
    expect(gatingPower("kitchen")).toBe("dash");
  });
});
