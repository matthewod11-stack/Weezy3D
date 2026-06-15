import { describe, it, expect } from "vitest";
import {
  jumpEnvelope,
  canReach,
  climbConnects,
  breakableBlocks,
  surfacesFromLevel,
  checkReachability,
  type Surface,
  type ReachabilityLevel,
} from "./reachability";

const GRID = 32;
const FLOOR = 168;
/** A floor-height surface spanning [x, x+w]. */
const floor = (x: number, w: number): Surface => ({ left: x, right: x + w, topY: FLOOR });
/** A surface `gridsUp` grids above the floor. */
const ledge = (x: number, w: number, gridsUp: number): Surface => ({
  left: x,
  right: x + w,
  topY: FLOOR - gridsUp * GRID,
});

/**
 * The jump envelope is DERIVED from src/config/physics.ts — it is not a
 * hand-typed constant. These bounds encode the level-design assumption the
 * Bedroom was authored against (CLAUDE.md: "max apex ≈ 80 design-px / ~2.5
 * grids, max horizontal jump ≈ 120 design-px / ~3.75 grids").
 *
 * If you intentionally retune the physics, these will fail — that is the
 * point. Update the bounds AND re-run the reachability lint over every level,
 * because the reachable envelope just moved under your platforms.
 */
describe("jumpEnvelope (Seam 2 guardrail: physics ↔ level geometry)", () => {
  it("derives max apex height ≈ 80 design-px from the real physics constants", () => {
    const env = jumpEnvelope();
    expect(env.maxApex).toBeGreaterThan(79);
    expect(env.maxApex).toBeLessThan(82);
  });

  it("derives max flat-jump gap ≈ 120 design-px (~3.75 grids)", () => {
    const env = jumpEnvelope();
    expect(env.maxFlatGap).toBeGreaterThan(118);
    expect(env.maxFlatGap).toBeLessThan(125);
  });
});

describe("canReach (single-jump connectivity between two surfaces)", () => {
  const env = jumpEnvelope();

  it("clears a 2-grid flat gap", () => {
    expect(canReach(floor(0, 100), floor(164, 140), env)).toBe(true); // 64px gap
  });

  it("rejects a flat gap wider than the physical max (~122px)", () => {
    expect(canReach(floor(0, 100), floor(230, 140), env)).toBe(false); // 130px gap
  });

  it("hops up onto a ledge within apex height across a small gap", () => {
    expect(canReach(floor(0, 100), ledge(132, 68, 2), env)).toBe(true); // 64px up, 32px gap
  });

  it("cannot reach a ledge higher than the apex, even right beside it", () => {
    expect(canReach(floor(0, 100), ledge(110, 60, 3), env)).toBe(false); // 96px up > ~81 apex
  });

  it("can always drop down onto a lower surface it overlaps", () => {
    expect(canReach(floor(0, 100), { left: 60, right: 200, topY: FLOOR + 48 }, env)).toBe(true);
  });

  it("applies the forgiveness margin: a tight gap passes at margin=1 but fails when tightened", () => {
    const tight = floor(210, 90); // 110px gap from floor(0,100)
    expect(canReach(floor(0, 100), tight, env, 1)).toBe(true);
    expect(canReach(floor(0, 100), tight, env, 0.85)).toBe(false);
  });
});

/** A floor-height platform spanning [x, x+w]. */
const plat = (x: number, w: number, topY = FLOOR) => ({ x, y: topY, w, h: 32 });
const exitAt = (x: number) => ({ x, y: FLOOR - 52 + 4, w: 40, h: 52 });

describe("surfacesFromLevel", () => {
  it("returns one walkable surface per platform with left/right/top", () => {
    const level: ReachabilityLevel = {
      spawn: { x: 16, y: FLOOR },
      platforms: [plat(0, 100), { x: 160, y: FLOOR - 64, w: 40, h: 14 }],
      exit: exitAt(280),
      tokens: [],
    };
    expect(surfacesFromLevel(level)).toEqual([
      { left: 0, right: 100, topY: FLOOR },
      { left: 160, right: 200, topY: FLOOR - 64 },
    ]);
  });
});

describe("checkReachability (spawn → exit is a hard error; collectibles warn)", () => {
  it("passes a level whose exit is reachable across a jumpable gap", () => {
    const level: ReachabilityLevel = {
      spawn: { x: 16, y: FLOOR },
      platforms: [plat(0, 100), plat(160, 140)], // 60px gap — easily jumpable
      exit: exitAt(280),
      tokens: [],
    };
    const result = checkReachability(level);
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it("flags an UNREACHABLE exit as an error (the soft-lock case)", () => {
    const level: ReachabilityLevel = {
      spawn: { x: 16, y: FLOOR },
      platforms: [plat(0, 100), plat(260, 140)], // 160px gap — wider than max jump
      exit: exitAt(320),
      tokens: [],
    };
    const result = checkReachability(level);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.severity === "error" && p.kind === "exit-unreachable")).toBe(true);
  });

  it("warns (but does not fail) when a token floats above the jump envelope", () => {
    const level: ReachabilityLevel = {
      spawn: { x: 16, y: FLOOR },
      platforms: [plat(0, 300)], // continuous floor — exit always reachable
      tokens: [{ x: 150, y: FLOOR - 160 }], // 160px up, well above the ~81px apex
      exit: exitAt(280),
    };
    const result = checkReachability(level);
    expect(result.ok).toBe(true); // still completable
    expect(result.problems.some((p) => p.severity === "warn" && p.kind === "token-stranded")).toBe(true);
  });
});

describe("two-tier margins: completability is strict, content is comfy", () => {
  // floor(0,100) → plat(215,120) is a 115px gap: crossable at margin 1.0 (~122px
  // physical max) but NOT at the 0.85 content margin (~103px).
  it("does NOT soft-lock when the exit needs a pixel-perfect-but-possible jump", () => {
    const level: ReachabilityLevel = {
      spawn: { x: 16, y: FLOOR },
      platforms: [plat(0, 100), plat(215, 120)],
      exit: exitAt(300),
      tokens: [],
    };
    const result = checkReachability(level); // defaults: exit 1.0, content 0.85
    expect(result.ok).toBe(true);
    expect(result.problems.some((p) => p.kind === "exit-unreachable")).toBe(false);
  });

  it("still warns that the same too-tight platform isn't comfortably reachable", () => {
    const level: ReachabilityLevel = {
      spawn: { x: 16, y: FLOOR },
      platforms: [plat(0, 100), plat(215, 120)],
      exit: exitAt(300),
      tokens: [],
    };
    const result = checkReachability(level);
    expect(result.problems.some((p) => p.kind === "platform-unreachable")).toBe(true);
  });
});

describe("platform-reachability warnings ('not all platforms accessible')", () => {
  it("warns about an authored platform no jump can land on", () => {
    const level: ReachabilityLevel = {
      spawn: { x: 16, y: FLOOR },
      platforms: [plat(0, 300), { x: 150, y: FLOOR - 160, w: 40, h: 14 }], // ledge 160px up
      exit: exitAt(280),
      tokens: [],
    };
    const result = checkReachability(level);
    expect(result.ok).toBe(true); // floor path completes the level
    expect(result.problems.some((p) => p.kind === "platform-unreachable")).toBe(true);
  });
});

describe("glide envelope", () => {
  it("base envelope exposes no glideFallSpeed", () => {
    expect(jumpEnvelope().glideFallSpeed).toBeUndefined();
  });

  it("glide adds glideFallSpeed but does NOT change base gravity or apex", () => {
    const base = jumpEnvelope();
    const g = jumpEnvelope(new Set(["glide"]));
    expect(g.glideFallSpeed).toBeGreaterThan(0);
    expect(g.gravDown).toBe(base.gravDown); // clamp, not changed gravity
    expect(g.maxApex).toBe(base.maxApex);   // glide can't raise apex
  });

  it("glide extends reach on a big descent the base arc cannot clear", () => {
    const from: Surface = { left: 0, right: 64, topY: 60 };
    const farLow: Surface = { left: 314, right: 394, topY: 220 }; // 250px gap, 160px drop
    expect(canReach(from, farLow, jumpEnvelope())).toBe(false);
    expect(canReach(from, farLow, jumpEnvelope(new Set(["glide"])))).toBe(true);
  });

  it("glide never reduces reach vs base (monotonicity)", () => {
    const from: Surface = { left: 0, right: 40, topY: 100 };
    const near: Surface = { left: 80, right: 120, topY: 100 }; // base already clears this
    expect(canReach(from, near, jumpEnvelope())).toBe(true);
    expect(canReach(from, near, jumpEnvelope(new Set(["glide"])))).toBe(true);
  });
});

describe("dash edge (traversal: tag-gated, additive)", () => {
  // A flat 260px gap: wider than double-jump (~210) but inside dash (~320).
  const from: Surface = { left: 0, right: 60, topY: 168 };
  const dashGap = (requires?: "dash"): Surface => ({
    left: 320,
    right: 440,
    topY: 168,
    requires,
  });

  it("base envelope exposes no dashDistance; dash unlocks it", () => {
    expect(jumpEnvelope().dashDistance).toBeUndefined();
    expect(jumpEnvelope(new Set(["dash"])).dashDistance).toBeGreaterThan(0);
  });

  it("a dash-tagged gap is unreachable without dash, reachable with it", () => {
    expect(canReach(from, dashGap("dash"), jumpEnvelope())).toBe(false);
    expect(canReach(from, dashGap("dash"), jumpEnvelope(new Set(["dash"])))).toBe(true);
  });

  it("dash does NOT cross an UNtagged gap of the same width (tag-gated)", () => {
    // Same 260px gap but no requires tag → dash gives no edge → still unreachable.
    expect(canReach(from, dashGap(undefined), jumpEnvelope(new Set(["dash"])))).toBe(false);
  });

  it("the Kitchen loadout (double-jump + dash) clears it; double-jump alone cannot", () => {
    expect(canReach(from, dashGap("dash"), jumpEnvelope(new Set(["doubleJump"])))).toBe(false);
    expect(canReach(from, dashGap("dash"), jumpEnvelope(new Set(["doubleJump", "dash"])))).toBe(true);
  });

  it("dash does not let you cross UP to a higher tagged ledge (horizontal only)", () => {
    const highTagged: Surface = { left: 320, right: 440, topY: 168 - 96, requires: "dash" }; // 96px up
    expect(canReach(from, highTagged, jumpEnvelope(new Set(["dash"])))).toBe(false);
  });
});

describe("climb edge (traversal: wall-gated, additive)", () => {
  const FLOORY = 168;
  // Floor reaches the wall's left edge; ledge sits past the wall's right edge,
  // 210px up (beyond double-jump apex ~161). Wall spans floor-top..above-ledge.
  const floorS: Surface = { left: 0, right: 180, topY: FLOORY };
  const ledgeS: Surface = { left: 190, right: 320, topY: FLOORY - 210 };
  const wall = { x: 160, y: FLOORY - 220, w: 30, h: 220 }; // x 160-190, y -52..168

  it("connects two surfaces that both touch the same wall", () => {
    expect(climbConnects(floorS, ledgeS, [wall])).toBe(true);
  });

  it("does not connect when there is no shared wall", () => {
    expect(climbConnects(floorS, ledgeS, [])).toBe(false);
    expect(climbConnects(floorS, ledgeS, [{ x: 600, y: 0, w: 20, h: 200 }])).toBe(false);
  });

  it("a sheer ledge is jump-unreachable but climb-reachable (only with wallClimb)", () => {
    const level: ReachabilityLevel = {
      spawn: { x: 16, y: FLOORY },
      platforms: [
        { x: 0, y: FLOORY, w: 180, h: 32 },
        { x: 190, y: FLOORY - 210, w: 130, h: 14 },
      ],
      climbWalls: [{ x: 160, y: FLOORY - 220, w: 30, h: 220 }],
      // Exit BEYOND the floor's right edge (180) so the floor doesn't trivially
      // satisfy the exit-zone check — only the high ledge can reach it.
      exit: { x: 250, y: FLOORY - 210 - 52 + 4, w: 40, h: 52 },
      tokens: [],
    };
    expect(checkReachability(level, { abilities: new Set(["doubleJump"]) }).ok).toBe(false);
    expect(checkReachability(level, { abilities: new Set(["doubleJump", "wallClimb"]) }).ok).toBe(true);
  });
});

describe("breakable edge (traversal: charge-gated, monotonic, BLOCKS until cleared)", () => {
  const FLOORY = 168;
  // Two same-height floors with a 20px seam. A barricade fills the seam.
  const leftS: Surface = { left: 0, right: 160, topY: FLOORY };
  const rightS: Surface = { left: 180, right: 360, topY: FLOORY };
  const barricade = { x: 158, y: FLOORY - 200, w: 24, h: 200 }; // spans the seam 160..180

  it("blocks the doorway edge when charge is absent", () => {
    expect(breakableBlocks(leftS, rightS, [barricade], false)).toBe(true);
  });

  it("does NOT block once charge clears it", () => {
    expect(breakableBlocks(leftS, rightS, [barricade], true)).toBe(false);
  });

  it("is symmetric (blocks regardless of edge direction)", () => {
    expect(breakableBlocks(rightS, leftS, [barricade], false)).toBe(true);
  });

  it("does not block an edge whose doorway it doesn't sit in", () => {
    // Two surfaces both to the RIGHT of the barricade (x 158-182): their gap
    // column [360,400] excludes it, so the edge between them is never blocked.
    const midS: Surface = { left: 200, right: 360, topY: FLOORY };
    const farS: Surface = { left: 400, right: 540, topY: FLOORY };
    expect(breakableBlocks(midS, farS, [barricade], false)).toBe(false);
  });

  it("a barricaded gap is crossable ONLY with charge", () => {
    const level: ReachabilityLevel = {
      spawn: { x: 24, y: FLOORY },
      platforms: [
        { x: 0, y: FLOORY, w: 160, h: 32 },
        { x: 180, y: FLOORY, w: 180, h: 32 },
      ],
      breakables: [{ x: 158, y: FLOORY - 200, w: 24, h: 200 }],
      // Exit BEYOND the spawn floor's right edge (160) so only the far floor
      // (across the smashed barricade) can satisfy the exit-zone check.
      exit: { x: 250, y: FLOORY - 52 + 4, w: 40, h: 52 },
      tokens: [],
    };
    expect(checkReachability(level, { abilities: new Set(["doubleJump"]) }).ok).toBe(false);
    expect(checkReachability(level, { abilities: new Set(["doubleJump", "charge"]) }).ok).toBe(true);
  });
});

describe("jumpEnvelope is ability-aware", () => {
  it("double jump roughly doubles apex and extends the flat gap", () => {
    const base = jumpEnvelope();
    const dbl = jumpEnvelope(new Set(["doubleJump"]));
    expect(dbl.maxApex).toBeGreaterThan(base.maxApex * 1.8);
    expect(dbl.maxApex).toBeLessThan(base.maxApex * 2.2);
    expect(dbl.maxFlatGap).toBeGreaterThan(base.maxFlatGap * 1.5);
  });
  it("no abilities returns the base envelope unchanged", () => {
    const a = jumpEnvelope();
    const b = jumpEnvelope(new Set());
    expect(a).toEqual(b);
  });
});
