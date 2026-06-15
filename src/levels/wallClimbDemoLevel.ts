import type { LevelData } from "../types/level";

const FLOOR_Y = 168;

// Hand-authored Wall-Climb proof/demo level (P4). A floor, a climbable wall
// rising 210px to a high ledge (above the double-jump apex ~161, so unjumpable),
// and the exit on that ledge. The exit sits past the floor's right edge so the
// floor can't trivially "be under" the exit zone — only the high ledge reaches
// it. Solvable ONLY with wall-climb (even though the Family Room player already
// has double-jump + dash; dash is horizontal/equal-or-lower, so it can't scale
// the wall). NOT in LEVEL_CATALOG — wall-climb can't gate before the Family Room.
//
// Doubles as the focused dev sandbox via window.eloiseLoadDemo("wallClimb").
export const WALL_CLIMB_DEMO_LEVEL: LevelData = {
  id: "wall-climb-demo",
  name: "Wall-Climb Demo",
  spawn: { x: 24, y: FLOOR_Y },
  killY: 280,
  bounds: { minX: 0, maxX: 380, minY: -120, maxY: 260 },
  platforms: [
    { x: 0, y: FLOOR_Y, w: 180, h: 32, color: "#cdb9a6" },         // floor (reaches the wall)
    { x: 190, y: FLOOR_Y - 210, w: 140, h: 14, color: "#d4a574" },  // high ledge (210 up)
  ],
  climbWalls: [{ x: 160, y: FLOOR_Y - 220, w: 30, h: 220 }],        // x 160-190, spans -52..168
  enemies: [],
  tokens: [],
  exit: { x: 250, y: FLOOR_Y - 210 - 52 + 4, w: 40, h: 52 },        // on the ledge, past floor's right (180)
};
