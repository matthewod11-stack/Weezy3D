/**
 * Pure runtime detection for "is the player currently on a climbable wall?".
 * Phaser-free (mirrors airJump.ts / powerDispatch.ts) so it's unit-testable; the
 * Player feeds it its body AABB + the level's (scaled) climb-wall rects.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** True if `body` overlaps any wall rect (axis-aligned bounding-box test). */
export function isOnClimbWall(body: Rect, walls: readonly Rect[]): boolean {
  return walls.some(
    (w) =>
      body.x < w.x + w.w &&
      body.x + body.w > w.x &&
      body.y < w.y + w.h &&
      body.y + body.h > w.y,
  );
}
