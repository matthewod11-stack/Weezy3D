import type Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./game";

/**
 * Snap canvas CSS size to whole integer multiples of the game resolution.
 * Avoids fractional FIT upscale blur while leaving Phaser's backing store alone.
 */
export function applyIntegerScale(game: Phaser.Game): void {
  const canvas = game.canvas;
  const parent = game.scale.parent as HTMLElement | null;
  if (!canvas || !parent) {
    return;
  }

  const maxW = parent.clientWidth;
  const maxH = parent.clientHeight;
  if (maxW <= 0 || maxH <= 0) {
    return;
  }

  const scale = Math.max(
    1,
    Math.floor(Math.min(maxW / GAME_WIDTH, maxH / GAME_HEIGHT)),
  );
  const cssW = GAME_WIDTH * scale;
  const cssH = GAME_HEIGHT * scale;

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.style.margin = "auto";
  canvas.style.display = "block";
}
