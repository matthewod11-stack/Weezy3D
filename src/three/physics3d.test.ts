import { describe, expect, it } from "vitest";
import {
  BODY_H,
  BODY_W,
  createPlayerState,
  stepPlayer,
  touchesCircle,
  touchesRect,
  type FrameInput,
  type PhysRect,
  type PlayerState,
  type PowerEnv,
} from "./physics3d";
import { PHYSICS } from "../config/physics";
import { RENDER_SCALE } from "../config/game";
import { ABILITIES, type AbilityId } from "../config/abilities";

const FLOOR_Y = 336; // DESIGN_FLOOR_Y(168) * RENDER_SCALE
const FLOOR: PhysRect = { x: -2000, y: FLOOR_Y, w: 6000, h: 64 };
const STEP = 1000 / 60;

const idle: FrameInput = { left: false, right: false, jumpPressed: false, jumpReleased: false };
const NO_POWERS_ENV: PowerEnv = { unlocked: new Set<AbilityId>(), climbWalls: [], breakables: [] };

function frames(
  s: PlayerState,
  n: number,
  input: Partial<FrameInput>,
  solids: PhysRect[],
): PlayerState {
  let cur = s;
  for (let i = 0; i < n; i += 1) {
    cur = stepPlayer(cur, { ...idle, ...input }, STEP, solids);
  }
  return cur;
}

function frames3(s: PlayerState, n: number, input: Partial<FrameInput>, solids: PhysRect[], env: PowerEnv): PlayerState {
  let cur = s;
  for (let i = 0; i < n; i += 1) cur = stepPlayer(cur, { ...idle, ...input }, STEP, solids, env);
  return cur;
}

describe("stepPlayer — wall-climb", () => {
  const CLIMB_VY = ABILITIES.wallClimb.traversal!.climbSpeed! * RENDER_SCALE;
  function climbEnv(): PowerEnv {
    return {
      unlocked: new Set<AbilityId>(["wallClimb"]),
      climbWalls: [{ x: -50, y: FLOOR_Y - 400, w: 100, h: 400 }],
      breakables: [],
    };
  }

  it("ascends at climbSpeed while up is held on a wall", () => {
    let s = settleOnFloor();
    const env = climbEnv();
    const y0 = s.y;
    s = stepPlayer(s, { ...idle, up: true }, STEP, [FLOOR], env);
    expect(s.vy).toBeCloseTo(-CLIMB_VY, 0);
    s = frames3(s, 10, { up: true }, [FLOOR], env);
    expect(s.y).toBeLessThan(y0);
  });

  it("does not climb without the ability", () => {
    let s = settleOnFloor();
    const env = { ...climbEnv(), unlocked: new Set<AbilityId>() };
    s = stepPlayer(s, { ...idle, up: true }, STEP, [FLOOR], env);
    expect(s.vy).toBeGreaterThanOrEqual(0);
  });

  it("does not climb when not overlapping a climbWall", () => {
    let s = settleOnFloor();
    const env: PowerEnv = { unlocked: new Set<AbilityId>(["wallClimb"]), climbWalls: [{ x: 9000, y: 0, w: 10, h: 10 }], breakables: [] };
    s = stepPlayer(s, { ...idle, up: true }, STEP, [FLOOR], env);
    expect(s.onGround).toBe(true);
  });

  it("resumes falling gravity when up is released mid-climb", () => {
    let s = settleOnFloor();
    s = frames3(s, 5, { up: true }, [FLOOR], climbEnv());      // ascend
    const vyClimb = s.vy;                                      // pinned at -climbSpeed
    s = stepPlayer(s, { ...idle }, STEP, [FLOOR], climbEnv()); // release up
    expect(s.vy).toBeGreaterThan(vyClimb);                     // gravity resumed (vy rising toward fall)
    s = frames3(s, 40, {}, [FLOOR], climbEnv());
    expect(s.onGround).toBe(true);                             // coasted up, then fell back to floor
  });
});

function settleOnFloor(): PlayerState {
  let s = createPlayerState(0, FLOOR_Y - 2);
  s = frames(s, 5, {}, [FLOOR]);
  expect(s.onGround).toBe(true);
  return s;
}

describe("stepPlayer — ground + landing", () => {
  it("falls under gravity and lands on a platform top", () => {
    let s = createPlayerState(0, FLOOR_Y - 120);
    s = frames(s, 90, {}, [FLOOR]);
    expect(s.onGround).toBe(true);
    expect(s.y).toBe(FLOOR_Y);
    expect(s.vy).toBe(0);
  });

  it("reports justLanded exactly once on touchdown", () => {
    let s = createPlayerState(0, FLOOR_Y - 60);
    let landings = 0;
    for (let i = 0; i < 60; i += 1) {
      s = stepPlayer(s, idle, STEP, [FLOOR]);
      if (s.justLanded) landings += 1;
    }
    expect(landings).toBe(1);
    expect(s.onGround).toBe(true);
  });

  it("stays grounded while resting (no jitter)", () => {
    let s = settleOnFloor();
    for (let i = 0; i < 30; i += 1) {
      s = stepPlayer(s, idle, STEP, [FLOOR]);
      expect(s.onGround).toBe(true);
      expect(s.y).toBeCloseTo(FLOOR_Y, 5);
    }
  });
});

describe("stepPlayer — jump arc (must match the 2D envelope)", () => {
  it("full jump apex is ~80 design px (the reachability envelope's max apex)", () => {
    let s = settleOnFloor();
    s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [FLOOR]);
    expect(s.justJumped).toBe(true);
    let minY = s.y;
    for (let i = 0; i < 120 && !(s.onGround && i > 5); i += 1) {
      s = stepPlayer(s, idle, STEP, [FLOOR]);
      minY = Math.min(minY, s.y);
    }
    const apexDesignPx = (FLOOR_Y - minY) / RENDER_SCALE;
    // 2D docs: max apex ≈ 80 design px (~2.5 grid cells). Allow integration slack.
    expect(apexDesignPx).toBeGreaterThan(70);
    expect(apexDesignPx).toBeLessThan(92);
  });

  it("released-early jump is meaningfully shorter (variable cut)", () => {
    const fullJump = (() => {
      let s = settleOnFloor();
      s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [FLOOR]);
      let minY = s.y;
      for (let i = 0; i < 120; i += 1) {
        s = stepPlayer(s, idle, STEP, [FLOOR]);
        minY = Math.min(minY, s.y);
      }
      return FLOOR_Y - minY;
    })();

    const tappedJump = (() => {
      let s = settleOnFloor();
      s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [FLOOR]);
      s = stepPlayer(s, { ...idle, jumpReleased: true }, STEP, [FLOOR]);
      let minY = s.y;
      for (let i = 0; i < 120; i += 1) {
        s = stepPlayer(s, idle, STEP, [FLOOR]);
        minY = Math.min(minY, s.y);
      }
      return FLOOR_Y - minY;
    })();

    expect(tappedJump).toBeLessThan(fullJump * 0.6);
  });

  it("clears a 2-grid-high platform from the floor", () => {
    // Platform top 2 grids (128 render px) up, left edge far enough ahead
    // that the rising arc clears the side face before crossing it.
    const platformTop = FLOOR_Y - 2 * 32 * RENDER_SCALE;
    const platform: PhysRect = { x: 100, y: platformTop, w: 400, h: 28 };
    let s = settleOnFloor();
    s = stepPlayer(s, { ...idle, jumpPressed: true, right: true }, STEP, [FLOOR, platform]);
    for (let i = 0; i < 180; i += 1) {
      s = stepPlayer(s, { ...idle, right: true }, STEP, [FLOOR, platform]);
      if (s.onGround && s.y === platformTop) break;
    }
    expect(s.y).toBe(platformTop);
    expect(s.onGround).toBe(true);
  });
});

describe("stepPlayer — coyote time and jump buffer", () => {
  it("allows a jump shortly after walking off a ledge", () => {
    const ledge: PhysRect = { x: -200, y: FLOOR_Y, w: 200 + BODY_W / 2, h: 32 };
    let s = settleOnFloor();
    // Walk right off the ledge edge.
    while (s.onGround) {
      s = stepPlayer(s, { ...idle, right: true }, STEP, [ledge]);
    }
    // Within the coyote window (~3 frames in):
    s = frames(s, 2, {}, [ledge]);
    s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [ledge]);
    expect(s.justJumped).toBe(true);
  });

  it("rejects a jump after the coyote window expires", () => {
    const ledge: PhysRect = { x: -200, y: FLOOR_Y, w: 200 + BODY_W / 2, h: 32 };
    let s = settleOnFloor();
    while (s.onGround) {
      s = stepPlayer(s, { ...idle, right: true }, STEP, [ledge]);
    }
    s = frames(s, Math.ceil(PHYSICS.COYOTE_MS / STEP) + 2, {}, [ledge]);
    s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [ledge]);
    expect(s.justJumped).toBe(false);
  });

  it("buffers a jump pressed just before landing", () => {
    // Fall from height, then press jump once within ~60px of the floor —
    // at fall speed that's well inside the 100ms buffer window.
    let s = createPlayerState(0, FLOOR_Y - 200);
    while (s.y < FLOOR_Y - 60) {
      s = stepPlayer(s, idle, STEP, [FLOOR]);
    }
    s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [FLOOR]);
    let jumped = s.justJumped;
    for (let i = 0; i < 30 && !jumped; i += 1) {
      s = stepPlayer(s, idle, STEP, [FLOOR]);
      jumped = s.justJumped;
    }
    expect(jumped).toBe(true);
  });
});

describe("stepPlayer — walls and ceilings", () => {
  it("stops at a wall when walking into it", () => {
    const wall: PhysRect = { x: 100, y: FLOOR_Y - 200, w: 40, h: 200 };
    let s = settleOnFloor();
    s = frames(s, 120, { right: true }, [FLOOR, wall]);
    expect(s.x).toBeCloseTo(100 - BODY_W / 2, 3);
  });

  it("zeroes upward velocity on a head bump and clamps to the underside", () => {
    const ceiling: PhysRect = { x: -100, y: FLOOR_Y - BODY_H - 30, w: 200, h: 14 };
    const undersideY = ceiling.y + ceiling.h + BODY_H; // feet y when head touches
    let s = settleOnFloor();
    s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [FLOOR, ceiling]);
    let bumped = false;
    for (let i = 0; i < 30 && !bumped; i += 1) {
      s = stepPlayer(s, idle, STEP, [FLOOR, ceiling]);
      // Bump = airborne, upward motion killed, feet clamped to underside height.
      if (!s.onGround && s.vy >= 0 && Math.abs(s.y - undersideY) < 0.5) {
        bumped = true;
      }
    }
    expect(bumped).toBe(true);
  });
});

describe("overlap helpers", () => {
  it("touchesCircle detects a token at the body center", () => {
    const s = settleOnFloor();
    expect(touchesCircle(s, s.x, s.y - BODY_H / 2, 10)).toBe(true);
    expect(touchesCircle(s, s.x + 200, s.y, 10)).toBe(false);
  });

  it("touchesRect detects the exit zone", () => {
    const s = settleOnFloor();
    expect(touchesRect(s, { x: s.x - 10, y: s.y - 20, w: 40, h: 40 })).toBe(true);
    expect(touchesRect(s, { x: s.x + 500, y: s.y - 20, w: 40, h: 40 })).toBe(false);
  });
});

describe("stepPlayer — power foundation (no behavior yet)", () => {
  it("ignores powers when no env is passed (base feel preserved)", () => {
    let s = settleOnFloor();
    s = stepPlayer(s, { ...idle, up: true, powerPressed: true, powerHeld: true }, STEP, [FLOOR]);
    expect(s.onGround).toBe(true);
    expect(s.vy).toBe(0);
  });

  it("createPlayerState initializes power fields", () => {
    const s = createPlayerState(0, 0);
    expect(s.airJumpsUsed).toBe(0);
    expect(s.dashMsRemaining).toBe(0);
    expect(s.justSmashed).toBe(-1);
    expect(s.justAirJumped).toBe(false);
    expect(s.justDashed).toBe(false);
  });
});

describe("stepPlayer — double-jump", () => {
  const dj: PowerEnv = { unlocked: new Set<AbilityId>(["doubleJump"]), climbWalls: [], breakables: [] };

  // returns state mid-fall (vy>0) so a follow-up jumpPressed fires as an air jump
  function jumpThenDescend(env: PowerEnv): PlayerState {
    let s = settleOnFloor();
    s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [FLOOR], env);
    for (let i = 0; i < 60 && s.vy <= 0; i += 1) s = stepPlayer(s, idle, STEP, [FLOOR], env);
    return s;
  }

  it("fires a second jump in the air with the ability", () => {
    let s = jumpThenDescend(dj);
    expect(s.vy).toBeGreaterThan(0);
    s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [FLOOR], dj);
    expect(s.justAirJumped).toBe(true);
    expect(s.vy).toBeLessThan(0);
    expect(s.airJumpsUsed).toBe(1);
  });

  it("allows only one air jump until landing", () => {
    let s = jumpThenDescend(dj);
    s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [FLOOR], dj);
    for (let i = 0; i < 60 && s.vy <= 0; i += 1) s = stepPlayer(s, idle, STEP, [FLOOR], dj);
    const before = s.vy;
    s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [FLOOR], dj);
    expect(s.justAirJumped).toBe(false);
    expect(s.vy).toBeGreaterThanOrEqual(before - 1);
  });

  it("does nothing without the ability", () => {
    let s = jumpThenDescend(NO_POWERS_ENV);
    s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [FLOOR], NO_POWERS_ENV);
    expect(s.justAirJumped).toBe(false);
    expect(s.vy).toBeGreaterThan(0);
  });

  it("resets the air-jump count after landing", () => {
    let s = jumpThenDescend(dj);
    s = stepPlayer(s, { ...idle, jumpPressed: true }, STEP, [FLOOR], dj);
    for (let i = 0; i < 120 && !s.onGround; i += 1) s = stepPlayer(s, idle, STEP, [FLOOR], dj);
    expect(s.onGround).toBe(true);
    expect(s.airJumpsUsed).toBe(0);
  });
});

describe("stepPlayer — charge + breakables", () => {
  function breakableAhead(): (PhysRect | null)[] {
    return [{ x: BODY_W / 2 + 1, y: FLOOR_Y - BODY_H, w: 20, h: BODY_H }];
  }

  it("smashes the faced breakable on power-press (grounded), reporting its index", () => {
    let s = settleOnFloor();
    s = { ...s, facing: 1 };
    const breakables = breakableAhead();
    const env: PowerEnv = { unlocked: new Set<AbilityId>(["charge"]), climbWalls: [], breakables };
    s = stepPlayer(s, { ...idle, powerPressed: true }, STEP, [FLOOR], env);
    expect(s.justSmashed).toBe(0);
    expect(env.breakables[0]).toBeNull();
  });

  it("a live breakable blocks horizontal movement; a smashed one does not", () => {
    let s = settleOnFloor();
    s = { ...s, facing: 1 };
    const env: PowerEnv = { unlocked: new Set<AbilityId>(["charge"]), climbWalls: [], breakables: breakableAhead() };
    let blocked = frames3(s, 30, { right: true }, [FLOOR], env);
    expect(env.breakables[0]).not.toBeNull();
    expect(blocked.x).toBeLessThan(20);
    let smashed = stepPlayer({ ...s, facing: 1 }, { ...idle, powerPressed: true }, STEP, [FLOOR], env);
    smashed = frames3(smashed, 30, { right: true }, [FLOOR], env);
    expect(smashed.x).toBeGreaterThan(40);
  });

  it("dashing into a breakable smashes it (plow through)", () => {
    let s = settleOnFloor();
    s = { ...s, facing: 1 };
    const env: PowerEnv = {
      unlocked: new Set<AbilityId>(["dash"]),
      climbWalls: [],
      breakables: [{ x: 60, y: FLOOR_Y - BODY_H, w: 20, h: BODY_H }],
    };
    s = stepPlayer(s, { ...idle, powerPressed: true }, STEP, [FLOOR], env);
    s = frames3(s, 10, {}, [FLOOR], env);
    expect(env.breakables[0]).toBeNull();
  });

  it("dash-plow smashes a breakable on the trigger frame (tight placement)", () => {
    let s = settleOnFloor();
    s = { ...s, facing: 1 };
    // Near face ~30px ahead of the body's leading edge: beyond the old |vx|*dt
    // trigger-frame reach (pre-dash vx=0 → 20px), within the dashSpeed-based reach (~47px).
    const env: PowerEnv = {
      unlocked: new Set<AbilityId>(["dash"]),
      climbWalls: [],
      breakables: [{ x: BODY_W / 2 + 30, y: FLOOR_Y - BODY_H, w: 20, h: BODY_H }],
    };
    s = stepPlayer(s, { ...idle, powerPressed: true }, STEP, [FLOOR], env);
    expect(env.breakables[0]).toBeNull(); // smashed on the dash's first frame
  });

  it("does nothing without charge or dash", () => {
    let s = settleOnFloor();
    s = { ...s, facing: 1 };
    const env: PowerEnv = { unlocked: new Set<AbilityId>(), climbWalls: [], breakables: breakableAhead() };
    s = stepPlayer(s, { ...idle, powerPressed: true }, STEP, [FLOOR], env);
    expect(s.justSmashed).toBe(-1);
    expect(env.breakables[0]).not.toBeNull();
  });
});

describe("stepPlayer — glide", () => {
  const GLIDE_VY = ABILITIES.glide.envelope!.glideFallSpeed! * RENDER_SCALE;
  const glideEnv: PowerEnv = { unlocked: new Set<AbilityId>(["glide"]), climbWalls: [], breakables: [] };

  function falling(env: PowerEnv): PlayerState {
    let s = createPlayerState(0, FLOOR_Y - 600); // high up, no floor under => keeps falling
    s = frames3(s, 30, {}, [], env);             // accelerate downward
    expect(s.vy).toBeGreaterThan(GLIDE_VY);      // faster than the clamp before gliding
    return s;
  }

  it("clamps descent to glideFallSpeed while power is held and descending", () => {
    let s = falling(glideEnv);
    s = frames3(s, 10, { powerHeld: true }, [], glideEnv);
    // +1 absorbs fp rounding through RENDER_SCALE; the clamp fires post-integration each substep
    expect(s.vy).toBeLessThanOrEqual(GLIDE_VY + 1);
    expect(s.vy).toBeGreaterThan(0);
  });

  it("does not clamp without the ability", () => {
    let s = falling(NO_POWERS_ENV);
    const before = s.vy;
    s = frames3(s, 10, { powerHeld: true }, [], NO_POWERS_ENV);
    expect(s.vy).toBeGreaterThan(before); // kept accelerating
  });

  it("does not clamp while rising", () => {
    let s = settleOnFloor();
    s = stepPlayer(s, { ...idle, jumpPressed: true, powerHeld: true }, STEP, [FLOOR], glideEnv);
    expect(s.vy).toBeLessThan(0); // still launching upward, glide didn't pin it
  });
});

describe("stepPlayer — dash", () => {
  const dashEnv: PowerEnv = { unlocked: new Set<AbilityId>(["dash"]), climbWalls: [], breakables: [] };
  const DASH_VX = ABILITIES.dash.traversal!.dashSpeed! * RENDER_SCALE;

  it("overrides horizontal velocity for the dash window when facing right", () => {
    let s = settleOnFloor();
    s = { ...s, facing: 1 };
    s = stepPlayer(s, { ...idle, powerPressed: true }, STEP, [FLOOR], dashEnv);
    expect(s.justDashed).toBe(true);
    expect(s.vx).toBeCloseTo(DASH_VX, 0);
    expect(s.dashMsRemaining).toBeGreaterThan(0);
  });

  it("covers roughly speed×duration over the window", () => {
    let s = settleOnFloor();
    s = { ...s, facing: 1 };
    const x0 = s.x;
    s = stepPlayer(s, { ...idle, powerPressed: true }, STEP, [FLOOR], dashEnv);
    const durMs = ABILITIES.dash.traversal!.dashDurationMs ?? 0;
    for (let i = 0; i < Math.ceil(durMs / STEP); i += 1) s = stepPlayer(s, idle, STEP, [FLOOR], dashEnv);
    const expected = DASH_VX * (durMs / 1000);
    // 30% slack: the final substep may apply walk speed after the window closes
    expect(s.x - x0).toBeGreaterThan(expected * 0.7);
  });

  it("does nothing without the ability", () => {
    let s = settleOnFloor();
    s = stepPlayer(s, { ...idle, powerPressed: true }, STEP, [FLOOR], NO_POWERS_ENV);
    expect(s.justDashed).toBe(false);
    expect(s.dashMsRemaining).toBe(0);
  });

  it("is press-not-hold: holding the button does not re-dash mid-window", () => {
    let s = settleOnFloor();
    s = { ...s, facing: 1 };
    s = stepPlayer(s, { ...idle, powerPressed: true }, STEP, [FLOOR], dashEnv);
    const remainAfter1 = s.dashMsRemaining;
    s = stepPlayer(s, { ...idle, powerPressed: true }, STEP, [FLOOR], dashEnv);
    expect(s.dashMsRemaining).toBeLessThan(remainAfter1);
  });
});

describe("stepPlayer — multi-power interactions (all unlocked)", () => {
  const ALL: PowerEnv = {
    unlocked: new Set<AbilityId>(["doubleJump", "dash", "wallClimb", "charge", "glide"]),
    climbWalls: [],
    breakables: [],
  };
  const DASH_VX = ABILITIES.dash.traversal!.dashSpeed! * RENDER_SCALE;
  const GLIDE_VY = ABILITIES.glide.envelope!.glideFallSpeed! * RENDER_SCALE;

  it("dash (horizontal) and glide (vertical clamp) compose on orthogonal axes", () => {
    // Start a ground dash facing right, then walk off into the air still in the
    // dash window while holding power so glide clamps the fall. vx stays dash,
    // vy clamps to glide — neither cancels the other.
    const env = { ...ALL };
    // A short floor so the dash carries the player off the edge into the air.
    const ledge: PhysRect = { x: -200, y: FLOOR_Y, w: 260, h: 64 };
    let s = createPlayerState(0, FLOOR_Y - 2);
    s = frames3(s, 5, {}, [ledge], env); // settle
    s = { ...s, facing: 1 };
    s = stepPlayer(s, { ...idle, powerPressed: true }, STEP, [ledge], env); // dash starts
    // advance with power held; once airborne + descending, glide should clamp vy
    let sawAirborneClamp = false;
    for (let i = 0; i < 40; i++) {
      s = stepPlayer(s, { ...idle, powerHeld: true }, STEP, [ledge], env);
      if (!s.onGround && s.vy > 0) {
        expect(s.vy).toBeLessThanOrEqual(GLIDE_VY + 1); // glide clamps the fall
        if (s.dashMsRemaining > 0) {
          expect(Math.abs(s.vx)).toBeCloseTo(DASH_VX, 0); // dash still overrides vx
          sawAirborneClamp = true;
        }
      }
    }
    expect(sawAirborneClamp).toBe(true); // we actually observed both at once
  });

  it("dispatcher picks charge over dash when grounded + flush at a breakable", () => {
    const breakables: (PhysRect | null)[] = [{ x: BODY_W / 2 + 1, y: FLOOR_Y - BODY_H, w: 20, h: BODY_H }];
    const env: PowerEnv = { ...ALL, breakables };
    let s = settleOnFloor();
    s = { ...s, facing: 1 };
    s = stepPlayer(s, { ...idle, powerPressed: true }, STEP, [FLOOR], env);
    expect(s.justSmashed).toBe(0);     // charge fired
    expect(s.justDashed).toBe(false);  // dash did NOT (charge has priority 2 > dash 1)
    expect(env.breakables[0]).toBeNull();
  });

  it("dispatcher picks glide over dash when airborne + descending", () => {
    const env = { ...ALL };
    let s = createPlayerState(0, FLOOR_Y - 600); // high up, no floor → falling
    s = frames3(s, 30, {}, [], env);             // accelerate downward past the clamp
    expect(s.vy).toBeGreaterThan(GLIDE_VY);
    s = stepPlayer(s, { ...idle, powerHeld: true }, STEP, [], env);
    expect(s.justDashed).toBe(false);            // dash never started (glide prio 3 > dash 1)
    s = frames3(s, 8, { powerHeld: true }, [], env);
    expect(s.vy).toBeLessThanOrEqual(GLIDE_VY + 1); // glide clamped instead
    expect(s.dashMsRemaining).toBe(0);
  });
});

describe("stepPlayer — climbing/gliding state flags (for animation poses)", () => {
  it("climbing is true while ascending a climbWall and false after leaving the climb", () => {
    const env: PowerEnv = {
      unlocked: new Set<AbilityId>(["wallClimb"]),
      climbWalls: [{ x: -50, y: FLOOR_Y - 400, w: 100, h: 400 }],
      breakables: [],
    };
    let s = settleOnFloor();
    expect(s.climbing).toBe(false);               // grounded, no up held
    s = stepPlayer(s, { ...idle, up: true }, STEP, [FLOOR], env);
    expect(s.climbing).toBe(true);                // climb movement applied this step
    s = frames3(s, 10, { up: true }, [FLOOR], env);
    expect(s.climbing).toBe(true);                // continuous while the climb holds
    s = stepPlayer(s, idle, STEP, [FLOOR], env);  // release up → leaves the climb
    expect(s.climbing).toBe(false);
  });

  it("climbing stays false when not overlapping a climbWall", () => {
    const env: PowerEnv = {
      unlocked: new Set<AbilityId>(["wallClimb"]),
      climbWalls: [{ x: 9000, y: 0, w: 10, h: 10 }],
      breakables: [],
    };
    let s = settleOnFloor();
    s = frames3(s, 5, { up: true }, [FLOOR], env);
    expect(s.climbing).toBe(false);
  });

  it("gliding is true while the clamp is active and false on release", () => {
    const env: PowerEnv = { unlocked: new Set<AbilityId>(["glide"]), climbWalls: [], breakables: [] };
    let s = createPlayerState(0, FLOOR_Y - 600);  // high up, no floor → falling
    s = frames3(s, 30, {}, [], env);              // free-fall, power not held
    expect(s.vy).toBeGreaterThan(0);
    expect(s.gliding).toBe(false);
    s = stepPlayer(s, { ...idle, powerHeld: true }, STEP, [], env);
    expect(s.gliding).toBe(true);                 // clamp active this step
    s = frames3(s, 10, { powerHeld: true }, [], env);
    expect(s.gliding).toBe(true);                 // continuous while held + descending
    s = stepPlayer(s, idle, STEP, [], env);       // release power → clamp off
    expect(s.gliding).toBe(false);
  });

  it("gliding is false once landed even with the power still held", () => {
    const env: PowerEnv = { unlocked: new Set<AbilityId>(["glide"]), climbWalls: [], breakables: [] };
    let s = createPlayerState(0, FLOOR_Y - 300);
    let sawGlide = false;
    for (let i = 0; i < 200 && !s.onGround; i += 1) {
      s = stepPlayer(s, { ...idle, powerHeld: true }, STEP, [FLOOR], env);
      if (s.gliding) sawGlide = true;
    }
    expect(sawGlide).toBe(true);                  // glided on the way down
    expect(s.onGround).toBe(true);
    s = stepPlayer(s, { ...idle, powerHeld: true }, STEP, [FLOOR], env);
    expect(s.gliding).toBe(false);                // grounded → clamp no longer active
  });
});
