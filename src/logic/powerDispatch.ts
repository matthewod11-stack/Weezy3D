/**
 * The one context-sensitive power button. Pure + Phaser-free (mirrors airJump.ts)
 * so it's unit-testable and so importing it never drags Phaser into the Node-only
 * reachability lint. Player supplies the runtime context each frame.
 *
 * Predicates live HERE, not on the ABILITIES data rows, deliberately: keeping the
 * data table pure is what lets reachability.ts import abilities.ts under Node.
 */
import { ABILITIES, type AbilityId } from "../config/abilities";

export interface PowerContext {
  /** Not standing on ground. */
  airborne: boolean;
  /** Moving downward (vy > 0). */
  descending: boolean;
  /** Overlapping a climbable wall zone. */
  onClimbableWall: boolean;
  /** A smashable breakable is directly ahead within charge reach. */
  facingBreakable: boolean;
  // Add fields, never remove.
}

/** Context predicate per control:"power" ability. Missing entry = never fires. */
export const POWER_CONTEXTS: Partial<Record<AbilityId, (ctx: PowerContext) => boolean>> = {
  wallClimb: (ctx) => ctx.onClimbableWall,
  glide: (ctx) => ctx.airborne && ctx.descending,
  charge: (ctx) => !ctx.airborne && ctx.facingBreakable,
  // Dash is the "otherwise" power (spec §6.1): always contextually valid, lowest
  // priority — so the dispatcher returns dash only when no higher-priority power
  // (wall-climb on a wall, glide while descending, charge at a barricade) claims it.
  dash: () => true,
};

/**
 * The highest-priority unlocked control:"power" ability whose context predicate
 * matches right now, or null. Higher `priority` wins (parent spec §6.1).
 */
export function resolveActivePower(
  ctx: PowerContext,
  unlocked: Set<AbilityId>,
): AbilityId | null {
  let best: AbilityId | null = null;
  let bestPriority = -Infinity;
  for (const id of Object.keys(ABILITIES) as AbilityId[]) {
    const def = ABILITIES[id];
    if (def.control !== "power" || !unlocked.has(id)) continue;
    const predicate = POWER_CONTEXTS[id];
    if (!predicate || !predicate(ctx)) continue;
    const p = def.priority ?? 0;
    if (p > bestPriority) {
      bestPriority = p;
      best = id;
    }
  }
  return best;
}
