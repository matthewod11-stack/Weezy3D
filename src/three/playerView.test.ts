import { describe, expect, it } from "vitest";
import {
  CLIMB_LEAN_RAD,
  DASH_EASE_MS,
  DASH_LEAN_RAD,
  DASH_SCALE,
  FLIP_MIN_SCALE,
  GLIDE_SCALE,
  GLIDE_SWAY_HZ,
  GLIDE_SWAY_RAD,
  IDENTITY_POSE,
  INVINCIBLE_MIN_OPACITY,
  SQUASH_AIR_JUMP,
  SQUASH_JUMP,
  SQUASH_LAND,
  easeOutCubic,
  flipScaleX,
  invincibilityVisual,
  squashScaleAt,
  statePose,
  statePoseKind,
  stepSquashTween,
} from "./playerView";

const NO_FLAGS = { justLanded: false, justJumped: false, justAirJumped: false };

describe("easeOutCubic", () => {
  it("hits the endpoints and clamps outside [0,1]", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-2)).toBe(0);
    expect(easeOutCubic(3)).toBe(1);
  });

  it("is ease-OUT: front-loaded progress", () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("stepSquashTween", () => {
  it("spawns the landing squash from justLanded", () => {
    const t = stepSquashTween(null, { ...NO_FLAGS, justLanded: true }, 16);
    expect(t).toMatchObject({ fromX: SQUASH_LAND.x, fromY: SQUASH_LAND.y, durationMs: SQUASH_LAND.durationMs });
    expect(t!.remainingMs).toBe(SQUASH_LAND.durationMs);
  });

  it("spawns jump and air-jump stretches from their flags", () => {
    expect(stepSquashTween(null, { ...NO_FLAGS, justJumped: true }, 16)!.fromY).toBe(SQUASH_JUMP.y);
    expect(stepSquashTween(null, { ...NO_FLAGS, justAirJumped: true }, 16)!.fromY).toBe(SQUASH_AIR_JUMP.y);
  });

  it("air-jump wins when the sim raises justJumped alongside it", () => {
    const t = stepSquashTween(null, { ...NO_FLAGS, justJumped: true, justAirJumped: true }, 16);
    expect(t!.fromX).toBe(SQUASH_AIR_JUMP.x);
  });

  it("a new flag interrupts/replaces a running tween", () => {
    const running = stepSquashTween(null, { ...NO_FLAGS, justJumped: true }, 16)!;
    const replaced = stepSquashTween(running, { ...NO_FLAGS, justLanded: true }, 16)!;
    expect(replaced.fromX).toBe(SQUASH_LAND.x);
    expect(replaced.remainingMs).toBe(SQUASH_LAND.durationMs);
  });

  it("counts down by dtMs and expires to null", () => {
    let t = stepSquashTween(null, { ...NO_FLAGS, justLanded: true }, 16);
    t = stepSquashTween(t, NO_FLAGS, 100);
    expect(t!.remainingMs).toBe(SQUASH_LAND.durationMs - 100);
    t = stepSquashTween(t, NO_FLAGS, 100);
    expect(t).toBeNull();
    expect(stepSquashTween(null, NO_FLAGS, 16)).toBeNull();
  });
});

describe("squashScaleAt", () => {
  it("is identity with no tween", () => {
    expect(squashScaleAt(null)).toEqual({ x: 1, y: 1 });
  });

  it("starts at the from-scale and eases back to (1,1)", () => {
    const start = { fromX: 1.18, fromY: 0.82, remainingMs: 130, durationMs: 130 };
    expect(squashScaleAt(start)).toEqual({ x: 1.18, y: 0.82 });
    const end = squashScaleAt({ ...start, remainingMs: 0 });
    expect(end.x).toBeCloseTo(1);
    expect(end.y).toBeCloseTo(1);
    const mid = squashScaleAt({ ...start, remainingMs: 65 });
    expect(mid.x).toBeGreaterThan(1);
    expect(mid.x).toBeLessThan(1.18);
    expect(mid.y).toBeGreaterThan(0.82);
    expect(mid.y).toBeLessThan(1);
  });
});

describe("flipScaleX", () => {
  it("starts at the old facing full-size and ends at the new", () => {
    expect(flipScaleX(0, 1, -1)).toBe(1);
    expect(flipScaleX(1, 1, -1)).toBe(-1);
    expect(flipScaleX(0, -1, 1)).toBe(-1);
    expect(flipScaleX(1, -1, 1)).toBe(1);
  });

  it("dips |scale.x| to the mid-flip minimum", () => {
    const justBefore = flipScaleX(0.4999, 1, -1);
    const justAfter = flipScaleX(0.5, 1, -1);
    expect(Math.abs(justBefore)).toBeCloseTo(FLIP_MIN_SCALE, 2);
    expect(Math.abs(justAfter)).toBeCloseTo(FLIP_MIN_SCALE, 2);
    // sign hands over at the midpoint
    expect(Math.sign(justBefore)).toBe(1);
    expect(Math.sign(justAfter)).toBe(-1);
  });
});

describe("statePoseKind priority (dash > glide > climb > idle > none)", () => {
  const base = {
    dashMsRemaining: 0,
    gliding: false,
    climbing: false,
    onGround: true,
    vxAbs: 0,
    walkThreshold: 10,
  };

  it("dash beats everything", () => {
    expect(statePoseKind({ ...base, dashMsRemaining: 100, gliding: true, climbing: true })).toBe("dash");
  });

  it("glide beats climb", () => {
    expect(statePoseKind({ ...base, gliding: true, climbing: true })).toBe("glide");
  });

  it("climb beats idle", () => {
    expect(statePoseKind({ ...base, climbing: true })).toBe("climb");
  });

  it("idle only when grounded and slow; walking/airborne are none", () => {
    expect(statePoseKind(base)).toBe("idle");
    expect(statePoseKind({ ...base, vxAbs: 50 })).toBe("none");
    expect(statePoseKind({ ...base, onGround: false })).toBe("none");
  });
});

describe("statePose", () => {
  const ctx = { facing: 1 as const, dashMsRemaining: 0, clockMs: 0, tweenActive: false };

  it("dash: full lean/stretch while the window is long, easing out at the end", () => {
    const full = statePose("dash", { ...ctx, dashMsRemaining: DASH_EASE_MS + 100 });
    expect(full.scaleX).toBeCloseTo(DASH_SCALE.x);
    expect(full.scaleY).toBeCloseTo(DASH_SCALE.y);
    expect(full.rotZ).toBeCloseTo(-DASH_LEAN_RAD); // −facing·0.15
    const half = statePose("dash", { ...ctx, dashMsRemaining: DASH_EASE_MS / 2 });
    expect(half.rotZ).toBeCloseTo(-DASH_LEAN_RAD / 2);
    expect(half.scaleX).toBeCloseTo(1 + (DASH_SCALE.x - 1) / 2);
  });

  it("dash lean follows facing", () => {
    const left = statePose("dash", { ...ctx, facing: -1, dashMsRemaining: 999 });
    expect(left.rotZ).toBeCloseTo(DASH_LEAN_RAD);
  });

  it("glide: fixed scale + deterministic sway bounded to ±GLIDE_SWAY_RAD", () => {
    const quarter = 1000 / GLIDE_SWAY_HZ / 4; // sway peak
    const p = statePose("glide", { ...ctx, clockMs: quarter });
    expect(p.scaleX).toBe(GLIDE_SCALE.x);
    expect(p.scaleY).toBe(GLIDE_SCALE.y);
    expect(p.rotZ).toBeCloseTo(GLIDE_SWAY_RAD);
    expect(statePose("glide", { ...ctx, clockMs: 0 }).rotZ).toBeCloseTo(0);
    // same clock, same pose — deterministic
    expect(statePose("glide", { ...ctx, clockMs: 123 })).toEqual(statePose("glide", { ...ctx, clockMs: 123 }));
  });

  it("climb: leans INTO the wall (rotZ = facing·lean) with a tiny bob", () => {
    expect(statePose("climb", ctx).rotZ).toBeCloseTo(CLIMB_LEAN_RAD);
    expect(statePose("climb", { ...ctx, facing: -1 }).rotZ).toBeCloseTo(-CLIMB_LEAN_RAD);
    expect(statePose("climb", { ...ctx, clockMs: 125 }).bobY).not.toBe(0);
  });

  it("idle breathing oscillates y with slight x compensation", () => {
    const quarter = 1000 / 0.9 / 4;
    const p = statePose("idle", { ...ctx, clockMs: quarter });
    expect(p.scaleY).toBeCloseTo(1.015, 3);
    expect(p.scaleX).toBeLessThan(1);
  });

  it("idle breathing yields to an active event tween", () => {
    expect(statePose("idle", { ...ctx, clockMs: 300, tweenActive: true })).toEqual(IDENTITY_POSE);
  });

  it("none is identity", () => {
    expect(statePose("none", ctx)).toEqual(IDENTITY_POSE);
  });
});

describe("invincibilityVisual", () => {
  it("inactive restores fully — every call, regardless of elapsed", () => {
    expect(invincibilityVisual(false, 0)).toEqual({ opacity: 1, tint: 0xffffff });
    expect(invincibilityVisual(false, 987)).toEqual({ opacity: 1, tint: 0xffffff });
  });

  it("pulses opacity within [0.45, 1] at ~8Hz", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let ms = 0; ms <= 250; ms += 5) {
      const { opacity } = invincibilityVisual(true, ms);
      min = Math.min(min, opacity);
      max = Math.max(max, opacity);
      expect(opacity).toBeGreaterThanOrEqual(INVINCIBLE_MIN_OPACITY - 1e-9);
      expect(opacity).toBeLessThanOrEqual(1 + 1e-9);
    }
    // one 8Hz period is 125ms — the sweep must reach both extremes
    expect(min).toBeCloseTo(INVINCIBLE_MIN_OPACITY, 1);
    expect(max).toBeCloseTo(1, 1);
  });

  it("tints toward 0xff9999 at the start and fades back to white by 200ms", () => {
    expect(invincibilityVisual(true, 0).tint).toBe(0xff9999);
    expect(invincibilityVisual(true, 100).tint).toBe(0xffcccc);
    expect(invincibilityVisual(true, 200).tint).toBe(0xffffff);
    expect(invincibilityVisual(true, 500).tint).toBe(0xffffff);
  });
});
