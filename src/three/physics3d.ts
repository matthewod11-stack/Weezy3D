import { PHYSICS } from "../config/physics";
import { RENDER_SCALE } from "../config/game";
import { ABILITIES, type AbilityId } from "../config/abilities";
import { shouldAirJump } from "../logic/airJump";
import { resolveActivePower, type PowerContext } from "../logic/powerDispatch";
import { isOnClimbWall } from "../logic/climbDetect";
import { facingBreakable } from "../logic/breakableDetect";

/**
 * Pure platformer physics for the 3D renderer — no Phaser, no Three.js.
 *
 * Simulates in the same coordinate space as scaled LevelData (render px,
 * y-down, y = feet/bottom of body). The renderer converts to Three.js world
 * units at the display boundary only. Reuses the tuned PHYSICS constants from
 * the 2D game verbatim, so jump arcs match the reachability lint's envelope.
 *
 * Same pure-logic-behind-a-thin-shell pattern as bossFight.ts / airJump.ts.
 */

export interface PhysRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameInput {
  left: boolean;
  right: boolean;
  /** Edge: jump key went down this frame. */
  jumpPressed: boolean;
  /** Edge: jump key went up this frame. */
  jumpReleased: boolean;
  /** Held — wall-climb ascent (W / ArrowUp / stick-up). */
  up?: boolean;
  /** Edge — dash / charge trigger (X / gamepad button 1). */
  powerPressed?: boolean;
  /** Held — glide clamp. */
  powerHeld?: boolean;
}

export interface PlayerState {
  /** Feet anchor: x = body center, y = body bottom (render px, y-down). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  coyoteMs: number;
  bufferMs: number;
  facing: 1 | -1;
  /** True only on the frame the player transitions air -> ground. */
  justLanded: boolean;
  /** True only on the frame a jump fired. */
  justJumped: boolean;
  /** Extra mid-air jumps used since leaving the ground (double-jump). */
  airJumpsUsed: number;
  /** Remaining dash velocity-override window in ms (>0 while dashing). */
  dashMsRemaining: number;
  /** One-frame: index of the breakable smashed this frame, or -1. */
  justSmashed: number;
  /** One-frame view/sfx hooks. */
  justAirJumped: boolean;
  justDashed: boolean;
}

/** Runtime power context for stepPlayer. Optional — absent => no powers run.
 *  `breakables` is mutated in place: a smashed entry is nulled (the caller's
 *  destructible world state). `unlocked` gates every power. */
export interface PowerEnv {
  unlocked: Set<AbilityId>;
  climbWalls: readonly PhysRect[];
  breakables: (PhysRect | null)[];
}

const NO_POWERS: PowerEnv = { unlocked: new Set(), climbWalls: [], breakables: [] };

/** Same body box as the 2D Player (10×22 design px, scaled). */
export const BODY_W = 10 * RENDER_SCALE;
export const BODY_H = 22 * RENDER_SCALE;

/** Scale a design-px constant to render-px. */
function scaled(n: number | undefined): number {
  return (n ?? 0) * RENDER_SCALE;
}

/** Cap per-call delta so a backgrounded tab doesn't tunnel through geometry. */
const MAX_DELTA_MS = 50;
/** Internal fixed-ish substep for stable collision at any frame rate. */
const SUBSTEP_MS = 1000 / 60;

export function createPlayerState(x: number, y: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    onGround: false,
    coyoteMs: 0,
    bufferMs: 0,
    facing: 1,
    justLanded: false,
    justJumped: false,
    airJumpsUsed: 0,
    dashMsRemaining: 0,
    justSmashed: -1,
    justAirJumped: false,
    justDashed: false,
  };
}

export function bodyRect(s: { x: number; y: number }): PhysRect {
  return { x: s.x - BODY_W / 2, y: s.y - BODY_H, w: BODY_W, h: BODY_H };
}

function overlaps(a: PhysRect, b: PhysRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Standing check: feet within 1px above a solid top, horizontally overlapping. */
function probeGround(s: PlayerState, solids: readonly PhysRect[]): boolean {
  const probe: PhysRect = { x: s.x - BODY_W / 2, y: s.y, w: BODY_W, h: 1.5 };
  return solids.some((r) => overlaps(probe, r));
}

/**
 * Advance the player one frame. Returns a new state (input state untouched).
 * Mirrors the order of operations in the 2D Player.tick: coyote/buffer →
 * jump → variable cut → horizontal → asymmetric gravity → integrate+collide.
 */
export function stepPlayer(
  prev: PlayerState,
  input: FrameInput,
  deltaMs: number,
  solids: readonly PhysRect[],
  env: PowerEnv = NO_POWERS,
): PlayerState {
  const total = Math.min(deltaMs, MAX_DELTA_MS);
  const steps = Math.max(1, Math.round(total / SUBSTEP_MS));
  const stepMs = total / steps;

  let s: PlayerState = {
    ...prev,
    justLanded: false,
    justJumped: false,
    justAirJumped: false,
    justDashed: false,
    justSmashed: -1,
  };
  let landed = false;
  let jumped = false;
  let airJumped = false;
  let dashed = false;
  let smashed = -1;
  for (let i = 0; i < steps; i += 1) {
    const sub = i === 0 ? input : { ...input, ...edgeless() };
    s = stepOnce(s, sub, stepMs, solids, env);
    landed ||= s.justLanded;
    jumped ||= s.justJumped;
    airJumped ||= s.justAirJumped;
    dashed ||= s.justDashed;
    if (smashed < 0 && s.justSmashed >= 0) smashed = s.justSmashed;
  }
  return {
    ...s,
    justLanded: landed,
    justJumped: jumped,
    justAirJumped: airJumped,
    justDashed: dashed,
    justSmashed: smashed,
  };
}

function edgeless(): Pick<FrameInput, "jumpPressed" | "jumpReleased" | "powerPressed"> {
  return { jumpPressed: false, jumpReleased: false, powerPressed: false };
}

function stepOnce(
  prev: PlayerState,
  input: FrameInput,
  deltaMs: number,
  solids: readonly PhysRect[],
  env: PowerEnv,
): PlayerState {
  const dt = deltaMs / 1000;
  const s: PlayerState = { ...prev };

  s.justAirJumped = false;
  s.justDashed = false;
  s.justSmashed = -1;

  const wasOnGround = s.onGround;

  if (s.onGround) {
    s.coyoteMs = PHYSICS.COYOTE_MS;
  } else {
    s.coyoteMs = Math.max(0, s.coyoteMs - deltaMs);
  }

  if (input.left) s.facing = -1;
  else if (input.right) s.facing = 1;

  if (input.jumpPressed) {
    s.bufferMs = PHYSICS.BUFFER_MS;
  } else {
    s.bufferMs = Math.max(0, s.bufferMs - deltaMs);
  }

  const wantJump = s.bufferMs > 0 && (s.onGround || s.coyoteMs > 0);
  if (wantJump) {
    s.vy = PHYSICS.JUMP_VELOCITY;
    s.bufferMs = 0;
    s.coyoteMs = 0;
    s.onGround = false;
    s.justJumped = true;
  }

  // Double-jump: a mid-air jump when the ground jump didn't fire this frame.
  if (
    shouldAirJump({
      jumpPressed: input.jumpPressed,
      groundJumpFired: s.justJumped,
      onGround: s.onGround,
      hasDoubleJump: env.unlocked.has("doubleJump"),
      airJumpsUsed: s.airJumpsUsed,
      maxAirJumps: ABILITIES.doubleJump.envelope?.extraJumps ?? 1,
    })
  ) {
    s.vy = PHYSICS.JUMP_VELOCITY;
    s.airJumpsUsed += 1;
    s.justJumped = true;
    s.justAirJumped = true;
  }

  if (input.jumpReleased && s.vy < 0) {
    s.vy *= PHYSICS.VARIABLE_CUT;
  }

  // Resolve the one context power button (dash / glide / charge). Reused by later powers.
  const ctx: PowerContext = {
    airborne: !s.onGround,
    descending: s.vy > 0,
    onClimbableWall: isOnClimbWall(bodyRect(s), env.climbWalls),
    facingBreakable: facingBreakable(bodyRect(s), s.facing, env.breakables, scaled(ABILITIES.charge.traversal?.chargeReach)) >= 0,
  };
  const active = resolveActivePower(ctx, env.unlocked);

  // Dash: start on the press edge when dash is the active power and not already dashing.
  if (active === "dash" && input.powerPressed && s.dashMsRemaining <= 0) {
    s.dashMsRemaining = ABILITIES.dash.traversal?.dashDurationMs ?? 0;
    s.justDashed = true;
  }
  if (s.dashMsRemaining > 0) s.dashMsRemaining -= deltaMs;

  let targetVx = 0;
  if (input.left) targetVx -= PHYSICS.SPEED;
  if (input.right) targetVx += PHYSICS.SPEED;
  if (s.justDashed || s.dashMsRemaining > 0) {
    s.vx = s.facing * scaled(ABILITIES.dash.traversal?.dashSpeed);
  } else if (s.onGround) {
    s.vx = targetVx;
  } else {
    s.vx = s.vx + (targetVx * PHYSICS.AIR_SPEED_MULT - s.vx) * PHYSICS.AIR_BLEND;
  }

  // Asymmetric gravity: floaty rise near apex, heavy fall.
  let g: number;
  if (s.vy < 0) {
    g = Math.abs(s.vy) < PHYSICS.APEX_VY_THRESHOLD ? PHYSICS.GRAVITY_APEX : PHYSICS.GRAVITY_UP;
  } else {
    g = PHYSICS.GRAVITY_DOWN;
  }
  s.vy += g * dt;

  // ── Integrate + collide, axis-separated ────────────────────────────────
  // X
  s.x += s.vx * dt;
  let rect = bodyRect(s);
  for (const solid of solids) {
    if (!overlaps(rect, solid)) continue;
    if (s.vx > 0) {
      s.x = solid.x - BODY_W / 2;
    } else if (s.vx < 0) {
      s.x = solid.x + solid.w + BODY_W / 2;
    }
    s.vx = 0;
    rect = bodyRect(s);
  }

  // Y
  s.y += s.vy * dt;
  rect = bodyRect(s);
  s.onGround = false;
  for (const solid of solids) {
    if (!overlaps(rect, solid)) continue;
    if (s.vy > 0) {
      // Landing on top.
      s.y = solid.y;
      s.vy = 0;
      s.onGround = true;
    } else if (s.vy < 0) {
      // Head bump on the underside.
      s.y = solid.y + solid.h + BODY_H;
      s.vy = 0;
    }
    rect = bodyRect(s);
  }

  // Resting contact (vy was 0 after a previous landing — no overlap to resolve).
  if (!s.onGround && s.vy >= 0 && probeGround(s, solids)) {
    s.onGround = true;
    s.vy = 0;
  }

  s.justLanded = s.onGround && !wasOnGround;
  // Y-collision sets s.onGround for the frame (incl. touchdown); the air-jump is
  // gated on !onGround, so resetting only here covers landing + resting frames.
  if (s.onGround) s.airJumpsUsed = 0;

  return s;
}

/** Circle-vs-body overlap, for token pickups. */
export function touchesCircle(s: PlayerState, cx: number, cy: number, radius: number): boolean {
  const r = bodyRect(s);
  const nearestX = Math.max(r.x, Math.min(cx, r.x + r.w));
  const nearestY = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

/** Rect-vs-body overlap, for the exit zone. */
export function touchesRect(s: PlayerState, zone: PhysRect): boolean {
  return overlaps(bodyRect(s), zone);
}
