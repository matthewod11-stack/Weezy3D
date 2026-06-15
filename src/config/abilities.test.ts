import { describe, it, expect } from "vitest";
import { ABILITIES, type AbilityId } from "./abilities";

const ALL: AbilityId[] = ["doubleJump", "dash", "wallClimb", "charge", "glide"];

describe("ABILITIES", () => {
  it("has a row per ability with a unique 0-4 order", () => {
    const orders = ALL.map((id) => ABILITIES[id].order).sort();
    expect(orders).toEqual([0, 1, 2, 3, 4]);
  });
  it("binds double-jump to the jump button, the rest to the power button", () => {
    expect(ABILITIES.doubleJump.control).toBe("jump");
    for (const id of ALL.filter((i) => i !== "doubleJump")) {
      expect(ABILITIES[id].control).toBe("power");
    }
  });
  it("marks double-jump and glide as envelope powers with envelope data", () => {
    expect(ABILITIES.doubleJump.family).toBe("envelope");
    expect(ABILITIES.doubleJump.envelope?.extraJumps).toBe(1);
    expect(ABILITIES.glide.family).toBe("envelope");
    expect(ABILITIES.glide.envelope?.glideFallSpeed).toBeGreaterThan(0);
    expect(ABILITIES.dash.family).toBe("traversal");
  });
  it("marks glide as a hold-activated power on the power button", () => {
    expect(ABILITIES.glide.activation).toBe("hold");
    expect(ABILITIES.glide.control).toBe("power");
  });
  it("marks dash as a press-activated traversal power with derived burst constants", () => {
    expect(ABILITIES.dash.family).toBe("traversal");
    expect(ABILITIES.dash.control).toBe("power");
    expect(ABILITIES.dash.activation).toBe("press");
    expect(ABILITIES.dash.traversal?.dashSpeed).toBeGreaterThan(0);
    expect(ABILITIES.dash.traversal?.dashDurationMs).toBeGreaterThan(0);
  });
  it("marks wall-climb as a hold-activated traversal power with a climb speed", () => {
    expect(ABILITIES.wallClimb.family).toBe("traversal");
    expect(ABILITIES.wallClimb.control).toBe("power");
    expect(ABILITIES.wallClimb.activation).toBe("hold");
    expect(ABILITIES.wallClimb.traversal?.climbSpeed).toBeGreaterThan(0);
  });
  it("marks charge as a press-activated traversal power with a forward reach", () => {
    expect(ABILITIES.charge.family).toBe("traversal");
    expect(ABILITIES.charge.control).toBe("power");
    expect(ABILITIES.charge.activation).toBe("press");
    expect(ABILITIES.charge.traversal?.chargeReach).toBeGreaterThan(0);
  });
});
