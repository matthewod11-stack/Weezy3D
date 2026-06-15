/**
 * Which menu option a click should select, or -1 if the click landed outside
 * the option rows (e.g. on the title or empty space — those should NOT start
 * the game). Maps a pointer's Y to the nearest option label within `threshold`.
 *
 * Extracted from MenuScene so the click→option mapping is unit-testable without
 * a Phaser runtime. The bug it fixes: the menu used to confirm the
 * keyboard-highlighted option on ANY click, so clicking "New Game" (while
 * "Continue" was highlighted) launched Continue at the saved level instead.
 */
/**
 * Map a native pointer's `clientY` into the game's vertical coordinate space,
 * straight from the canvas rect — independent of Phaser's pointer transform.
 *
 * Why bypass Phaser: the game runs in `Scale.NONE` and CSS-scales the canvas
 * manually (`applyIntegerScale`) without notifying the ScaleManager, so Phaser's
 * `displayScale` (and therefore `pointer.y`) is stale whenever the canvas is
 * enlarged — clicks then resolve far from where they landed. Computing from the
 * DOM rect is correct at any scale. Returns NaN for a degenerate rect.
 */
export function clientYToGameY(
  clientY: number,
  rectTop: number,
  rectHeight: number,
  gameHeight: number,
): number {
  if (rectHeight <= 0) {
    return Number.NaN;
  }
  return (clientY - rectTop) * (gameHeight / rectHeight);
}

export function optionAtPointer(
  pointerY: number,
  optionYs: number[],
  threshold: number,
): number {
  let nearest = -1;
  let bestDist = Infinity;
  optionYs.forEach((y, index) => {
    const d = Math.abs(y - pointerY);
    if (d < bestDist) {
      bestDist = d;
      nearest = index;
    }
  });
  return nearest >= 0 && bestDist <= threshold ? nearest : -1;
}
