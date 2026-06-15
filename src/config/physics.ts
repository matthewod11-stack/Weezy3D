import { RENDER_SCALE } from "./game";

const S = RENDER_SCALE;

export const PHYSICS = {
  SPEED: 125 * S,
  AIR_SPEED_MULT: 0.85,
  AIR_BLEND: 0.15,
  JUMP_VELOCITY: -310 * S,
  GRAVITY_UP: 600 * S,
  GRAVITY_APEX: 400 * S,
  GRAVITY_DOWN: 900 * S,
  /** When rising and |vy| below this, use apex gravity for hangtime. */
  APEX_VY_THRESHOLD: 40 * S,
  COYOTE_MS: 100,
  BUFFER_MS: 100,
  /** Release jump while rising: multiply upward vy by this (plan: halve). */
  VARIABLE_CUT: 0.5,
  STOMP_BOUNCE_VY: -215 * S,
  INVINCIBILITY_MS: 1500,
} as const;
