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
} from "./physics3d";
import { PHYSICS } from "../config/physics";
import { RENDER_SCALE } from "../config/game";

const FLOOR_Y = 336; // DESIGN_FLOOR_Y(168) * RENDER_SCALE
const FLOOR: PhysRect = { x: -2000, y: FLOOR_Y, w: 6000, h: 64 };
const STEP = 1000 / 60;

const idle: FrameInput = { left: false, right: false, jumpPressed: false, jumpReleased: false };

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
