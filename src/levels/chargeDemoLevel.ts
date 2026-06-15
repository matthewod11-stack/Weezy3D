import type { LevelData } from "../types/level";

const FLOOR_Y = 168;

// Hand-authored Charge proof/demo level (P5, final traversal power). Two same-
// height floors with a 20px seam, and a 200px-tall breakable barricade filling
// the seam — taller than the double-jump apex (~161), so it's honestly
// unjumpable; the player MUST smash it. The exit sits on the far floor, past the
// spawn floor's right edge, so the spawn floor can't trivially satisfy the
// exit-zone check — only the far floor (across the smashed barricade) reaches it.
// Solvable ONLY with charge (even though the Backyard player already has
// double-jump + dash + wall-climb; none of those clear a barricade). NOT in
// LEVEL_CATALOG — a charge gate can't appear before the Backyard.
//
// Doubles as the focused dev sandbox via window.eloiseLoadDemo("charge").
export const CHARGE_DEMO_LEVEL: LevelData = {
  id: "charge-demo",
  name: "Charge Demo",
  spawn: { x: 24, y: FLOOR_Y },
  killY: 280,
  bounds: { minX: 0, maxX: 380, minY: -60, maxY: 260 },
  platforms: [
    { x: 0, y: FLOOR_Y, w: 160, h: 32, color: "#cdb9a6" },   // spawn floor (reaches the seam)
    { x: 180, y: FLOOR_Y, w: 180, h: 32, color: "#d4a574" },  // far floor (across the barricade)
  ],
  breakables: [{ x: 158, y: FLOOR_Y - 200, w: 24, h: 200 }],  // x 158-182, fills the seam 160..180, 200 tall
  enemies: [],
  tokens: [],
  exit: { x: 250, y: FLOOR_Y - 52 + 4, w: 40, h: 52 },        // on the far floor, past spawn floor's right (160)
};
