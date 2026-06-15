import { describe, it, expect } from "vitest";
import { shouldAirJump, type AirJumpInputs } from "./airJump";

const base: AirJumpInputs = {
  jumpPressed: true,
  groundJumpFired: false,
  onGround: false,
  hasDoubleJump: true,
  airJumpsUsed: 0,
};

describe("shouldAirJump", () => {
  it("fires on a mid-air press when double jump is unlocked and unused", () => {
    expect(shouldAirJump(base)).toBe(true);
  });
  it("does not fire without a fresh press", () => {
    expect(shouldAirJump({ ...base, jumpPressed: false })).toBe(false);
  });
  it("does not fire on the same frame the ground/coyote jump fired", () => {
    expect(shouldAirJump({ ...base, groundJumpFired: true })).toBe(false);
  });
  it("does not fire while on the ground", () => {
    expect(shouldAirJump({ ...base, onGround: true })).toBe(false);
  });
  it("does not fire without the double-jump power", () => {
    expect(shouldAirJump({ ...base, hasDoubleJump: false })).toBe(false);
  });
  it("allows only one extra jump by default", () => {
    expect(shouldAirJump({ ...base, airJumpsUsed: 1 })).toBe(false);
  });
  it("respects a higher maxAirJumps", () => {
    expect(shouldAirJump({ ...base, airJumpsUsed: 1, maxAirJumps: 2 })).toBe(true);
  });
});
