import { RENDER_SCALE } from "../config/game";
import { DESIGN_FLOOR_Y } from "../config/backgrounds";

/**
 * Single conversion boundary between the 2D simulation space and the 3D
 * world. Physics + level data live in render px (y-down, floor at
 * DESIGN_FLOOR_Y * RENDER_SCALE); Three.js lives in world units (y-up,
 * floor top at y = 0). One sketch grid cell (32 design px) = 1 world unit
 * ≈ one Eloise body height.
 */
export const PX_PER_UNIT = 32 * RENDER_SCALE;
export const FLOOR_RENDER_Y = DESIGN_FLOOR_Y * RENDER_SCALE;

export function toWorldX(px: number): number {
  return px / PX_PER_UNIT;
}

export function toWorldY(py: number): number {
  return (FLOOR_RENDER_Y - py) / PX_PER_UNIT;
}

export function toWorldLen(px: number): number {
  return px / PX_PER_UNIT;
}

/** Convert a y-down px rect (top-left anchored) to its world-space center. */
export function rectCenterWorld(r: { x: number; y: number; w: number; h: number }): {
  cx: number;
  cy: number;
  w: number;
  h: number;
} {
  return {
    cx: toWorldX(r.x + r.w / 2),
    cy: toWorldY(r.y + r.h / 2),
    w: toWorldLen(r.w),
    h: toWorldLen(r.h),
  };
}
