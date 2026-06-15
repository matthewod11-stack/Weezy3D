/**
 * Pure decision for the air (double) jump, extracted from Player.tick so the
 * branch has a unit-testable seam — Phaser input/physics can't be exercised in
 * the node test env, but this decision is just booleans + a counter.
 */
export interface AirJumpInputs {
  /** Raw Space JustDown this frame (already consumed once in tick — pass the cached value). */
  jumpPressed: boolean;
  /** Whether the ground/coyote jump already fired this frame. */
  groundJumpFired: boolean;
  onGround: boolean;
  /** GameState.hasAbility("doubleJump"). */
  hasDoubleJump: boolean;
  /** Extra mid-air jumps used since leaving the ground. */
  airJumpsUsed: number;
  /** Max extra jumps (ABILITIES.doubleJump.envelope.extraJumps). Default 1. */
  maxAirJumps?: number;
}

export function shouldAirJump(i: AirJumpInputs): boolean {
  return (
    i.jumpPressed &&
    !i.groundJumpFired &&
    !i.onGround &&
    i.hasDoubleJump &&
    i.airJumpsUsed < (i.maxAirJumps ?? 1)
  );
}
