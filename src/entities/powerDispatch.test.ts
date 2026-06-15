import { describe, it, expect } from "vitest";
import { resolveActivePower, type PowerContext } from "./powerDispatch";
import type { AbilityId } from "../config/abilities";

const falling: PowerContext = { airborne: true, descending: true, onClimbableWall: false, facingBreakable: false };
const rising: PowerContext = { airborne: true, descending: false, onClimbableWall: false, facingBreakable: false };
const grounded: PowerContext = { airborne: false, descending: false, onClimbableWall: false, facingBreakable: false };
const onWall: PowerContext = { airborne: true, descending: true, onClimbableWall: true, facingBreakable: false };
const atBarricade: PowerContext = { airborne: false, descending: false, onClimbableWall: false, facingBreakable: true };

describe("resolveActivePower", () => {
  it("returns null when nothing is unlocked", () => {
    expect(resolveActivePower(falling, new Set())).toBe(null);
  });

  it("resolves glide when airborne and descending", () => {
    expect(resolveActivePower(falling, new Set<AbilityId>(["glide"]))).toBe("glide");
  });

  it("does not resolve glide while rising", () => {
    expect(resolveActivePower(rising, new Set<AbilityId>(["glide"]))).toBe(null);
  });

  it("does not resolve glide on the ground", () => {
    expect(resolveActivePower(grounded, new Set<AbilityId>(["glide"]))).toBe(null);
  });

  it("ignores doubleJump (it lives on the jump button, not the power button)", () => {
    expect(resolveActivePower(falling, new Set<AbilityId>(["doubleJump"]))).toBe(null);
  });

  it("resolves dash on the ground (the otherwise fallback)", () => {
    expect(resolveActivePower(grounded, new Set<AbilityId>(["dash"]))).toBe("dash");
  });

  it("resolves dash while airborne and rising", () => {
    expect(resolveActivePower(rising, new Set<AbilityId>(["dash"]))).toBe("dash");
  });

  it("resolves dash while airborne and descending when glide is NOT unlocked", () => {
    expect(resolveActivePower(falling, new Set<AbilityId>(["dash"]))).toBe("dash");
  });

  it("glide outranks dash when both unlocked and airborne+descending", () => {
    expect(resolveActivePower(falling, new Set<AbilityId>(["glide", "dash"]))).toBe("glide");
  });

  it("dash wins over glide when rising (glide's context does not match)", () => {
    expect(resolveActivePower(rising, new Set<AbilityId>(["glide", "dash"]))).toBe("dash");
  });

  it("dash wins on the ground even when glide is unlocked", () => {
    expect(resolveActivePower(grounded, new Set<AbilityId>(["glide", "dash"]))).toBe("dash");
  });

  it("resolves wall-climb when on a climbable wall", () => {
    expect(resolveActivePower(onWall, new Set<AbilityId>(["wallClimb"]))).toBe("wallClimb");
  });

  it("does not resolve wall-climb off a wall", () => {
    expect(resolveActivePower(falling, new Set<AbilityId>(["wallClimb"]))).toBe(null);
  });

  it("wall-climb outranks glide and dash when on a wall (priority 4)", () => {
    const all = new Set<AbilityId>(["glide", "dash", "wallClimb"]);
    expect(resolveActivePower(onWall, all)).toBe("wallClimb");
  });

  it("falls back to glide/dash off the wall when wall-climb is unlocked", () => {
    const all = new Set<AbilityId>(["glide", "dash", "wallClimb"]);
    expect(resolveActivePower(falling, all)).toBe("glide"); // descending, not on wall
    expect(resolveActivePower(grounded, all)).toBe("dash");  // grounded, not on wall
  });

  it("resolves charge when grounded and facing a breakable", () => {
    expect(resolveActivePower(atBarricade, new Set<AbilityId>(["charge"]))).toBe("charge");
  });

  it("does not resolve charge while airborne (even facing a breakable)", () => {
    const airborneAtWall: PowerContext = { airborne: true, descending: true, onClimbableWall: false, facingBreakable: true };
    expect(resolveActivePower(airborneAtWall, new Set<AbilityId>(["charge"]))).toBe(null);
  });

  it("charge outranks dash at a barricade (priority 2 > 1)", () => {
    const all = new Set<AbilityId>(["dash", "charge"]);
    expect(resolveActivePower(atBarricade, all)).toBe("charge");
  });

  it("falls back to dash on the ground when not facing a breakable", () => {
    const all = new Set<AbilityId>(["dash", "charge"]);
    expect(resolveActivePower(grounded, all)).toBe("dash");
  });
});
