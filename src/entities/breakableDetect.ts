import type { Rect } from "./climbDetect";

/**
 * Pure runtime detection for "is the player facing a smashable breakable, in
 * reach?". Phaser-free (mirrors climbDetect.ts) so it's unit-testable; the
 * Player feeds it its body AABB, its facing direction, the level's (scaled)
 * breakable rects (with broken ones nulled), and the scaled chargeReach.
 *
 * Returns the INDEX of the first live breakable directly ahead within reach and
 * vertically overlapping the body, or -1. The index lets the Player destroy that
 * specific breakable; nulling broken entries keeps indices stable across smashes.
 */
export function facingBreakable(
  body: Rect,
  facing: -1 | 1,
  breakables: ReadonlyArray<Rect | null>,
  reach: number,
): number {
  for (let i = 0; i < breakables.length; i++) {
    const b = breakables[i];
    if (!b) continue;
    const vOverlap = body.y < b.y + b.h && body.y + body.h > b.y;
    if (!vOverlap) continue;
    // Forward distance from the body's leading edge to the breakable's near face.
    // ~0 when flush against it (the collider holds her there); a small negative
    // tolerance lets a just-overlapping barricade still register.
    const dx = facing === 1 ? b.x - (body.x + body.w) : body.x - (b.x + b.w);
    if (dx >= -2 && dx <= reach) return i;
  }
  return -1;
}
