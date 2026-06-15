import type { LevelData } from "../types/level";

const FLOOR_Y = 168;

// Hand-authored Glide proof/demo level (P2). A high start ledge (y=48), then a
// wide gap down to a far + much-lower landing floor. The drop makes the base
// jump arc reach a bit further, but the gap is still too wide for it; only the
// glide parachute (gentle constant descent → long airtime) stretches reach far
// enough to clear it. So it is solvable ONLY with glide.
//
// Dual purpose: (1) the auto-proof fixture for the metroidvania guarantee
// (solvable-with-glide / not-without), and (2) the dev sandbox level loaded via
// window.eloiseLoadDemo("glide"). Deliberately NOT in LEVEL_CATALOG — a glide
// gate can't appear before the Backyard (Zod ordering + the catalog
// double-check both forbid it).
export const GLIDE_DEMO_LEVEL: LevelData = {
  id: "glide-demo",
  name: "Glide Demo",
  spawn: { x: 24, y: FLOOR_Y - 120 },
  killY: 300,
  bounds: { minX: 0, maxX: 420, minY: -40, maxY: 260 },
  platforms: [
    { x: 0, y: FLOOR_Y - 120, w: 64, h: 14, color: "#e8c9a0" }, // high start ledge (y=48)
    { x: 314, y: FLOOR_Y + 40, w: 106, h: 32, color: "#d4a574" }, // far + much-lower landing
  ],
  enemies: [],
  tokens: [],
  exit: { x: 360, y: FLOOR_Y + 40 - 52 + 4, w: 40, h: 52 },
};
