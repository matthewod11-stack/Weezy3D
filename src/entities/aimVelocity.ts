/** Pure auto-aim: a velocity of magnitude `speed` pointing from (fromX,fromY) to
 *  (toX,toY). Degenerate (coincident points) → straight right. Phaser-free, tested. */
export function aimVelocity(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  speed: number,
): { vx: number; vy: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    return { vx: speed, vy: 0 };
  }
  return { vx: (dx / len) * speed, vy: (dy / len) * speed };
}
