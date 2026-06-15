import type { LevelData } from "../types/level";

const FLOOR_Y = 168;

// Hand-authored Dash proof/demo level (P3, first traversal power). A flat start
// platform, then a 260px gap — wider than the double-jump flat gap (~210) but
// inside the dash lunge (~320) — to a landing platform tagged requires:"dash".
// The tag is what makes the gap a *dash* edge: the reachability lint grants the
// crossing only when dash is unlocked, so the level is solvable ONLY with dash
// (even though the Kitchen player already has double-jump).
//
// Dual purpose: (1) the auto-proof fixture for the metroidvania guarantee
// (solvable-with-dash / not-without), and (2) a focused dev sandbox loaded via
// window.eloiseLoadDemo("dash") — focused because, unlike the Testing Ground, it
// has no glide to outrank dash in mid-air. Deliberately NOT in LEVEL_CATALOG: a
// dash gate can't appear before the Kitchen.
export const DASH_DEMO_LEVEL: LevelData = {
  id: "dash-demo",
  name: "Dash Demo",
  spawn: { x: 24, y: FLOOR_Y },
  killY: 280,
  bounds: { minX: 0, maxX: 480, minY: -40, maxY: 260 },
  platforms: [
    { x: 0, y: FLOOR_Y, w: 140, h: 32, color: "#cdb9a6" }, // start run-up
    { x: 400, y: FLOOR_Y, w: 120, h: 32, color: "#d4a574", requires: "dash" }, // gap 140→400 = 260
  ],
  enemies: [],
  tokens: [],
  exit: { x: 440, y: FLOOR_Y - 52 + 4, w: 40, h: 52 },
};
