import type { LevelData } from "../types/level";
import type { AbilityId } from "../config/abilities";
import type { GameState } from "../state/GameState";

const FLOOR_Y = 168;

/**
 * THE single source of truth for "powers that actually work today". Both the
 * menu (what to grant on entry) and the reachability test (what to solve with)
 * derive from this list — so they can never drift. When P3 dash ships, append
 * "dash" here and add its station to TESTING_GROUND below.
 */
export const IMPLEMENTED_POWERS: AbilityId[] = ["doubleJump", "glide", "dash", "wallClimb", "charge"];

/** Unlock every implemented power on the given state (used on entry). */
export function grantAllImplementedPowers(state: GameState): void {
  for (const id of IMPLEMENTED_POWERS) state.unlockedAbilities.add(id);
}

/**
 * Dev-only obstacle course. Stations left→right, each isolating one mechanic.
 * Authored in design-px; devLoadLevel scales by RENDER_SCALE at runtime.
 * NOT in LEVEL_CATALOG (it intentionally skips the ordering refine + catalog
 * double-check). A reachability test (testingGround.test.ts) guarantees it's
 * traversable with IMPLEMENTED_POWERS, since it dodges the build double-check.
 *
 * Stations today (only implemented powers — add dash/climb/charge with P3–P5):
 *   0 Warmup        — walk + single jump (gentle steps within base envelope)
 *   1 Double-Jump   — a 130-px flat gap (wider than base ~122, within double ~212)
 *   2 Glide drop    — high ledge → wide low gap; clear by holding X (glide)
 *   3 Dash gap      — flat 260-px gap (beyond double ~212, within dash ~320);
 *                     run to the edge and tap X to lunge across (ground dash)
 *   4 Climb wall    — base floor → a 190-px climbable wall → high ledge;
 *                     touch the wall and HOLD Up (or W) to climb (release to fall)
 *   5 Smash         — drop from the climb ledge → run-up floor → a tall breakable
 *                     barricade → exit floor; face the barricade and TAP X to smash
 */
export const TESTING_GROUND: LevelData = {
  id: "testing-ground",
  name: "Testing Ground",
  spawn: { x: 20, y: FLOOR_Y },
  killY: 280,
  bounds: { minX: 0, maxX: 2340, minY: -130, maxY: 260 },
  platforms: [
    // Station 0 — Warmup
    { x: 0, y: FLOOR_Y, w: 140, h: 32, color: "#cdb9a6" }, // start ground
    { x: 150, y: FLOOR_Y - 28, w: 40, h: 14, color: "#e8c9a0" }, // gentle step (28 up)
    // Station 1 — Double-Jump gap (130-px flat gap)
    { x: 210, y: FLOOR_Y, w: 110, h: 32, color: "#d4a574" }, // left
    { x: 450, y: FLOOR_Y, w: 110, h: 32, color: "#d4a574" }, // right (gap 320→450 = 130)
    // Station 2 — Glide drop (up to a high ledge, then float across a wide low gap)
    { x: 590, y: FLOOR_Y - 88, w: 70, h: 14, color: "#e8c9a0" }, // high ledge (y=80; 88 up, double-jump)
    { x: 820, y: FLOOR_Y + 32, w: 120, h: 32, color: "#c9b08f" }, // far low landing (gap 660→820 = 160, drop 120)
    // Station 3 — Dash gap (ground dash across a flat 260-px gap)
    { x: 980, y: FLOOR_Y + 32, w: 140, h: 32, color: "#cdb9a6" }, // run-up (gap 940→980 = 40, easy hop)
    { x: 1380, y: FLOOR_Y + 32, w: 140, h: 32, color: "#d4a574", requires: "dash" }, // landing (gap 1120→1380 = 260)
    // Station 4 — Climb wall (base → wall → high ledge)
    { x: 1560, y: FLOOR_Y + 32, w: 180, h: 32, color: "#cdb9a6" }, // base floor (gap 1520→1560 = 40, easy hop)
    { x: 1750, y: FLOOR_Y + 32 - 190, w: 130, h: 14, color: "#e8c9a0" }, // high ledge (190 up from base; top y=10)
    // Station 5 — Smash (drop from the climb ledge → run-up → barricade → exit floor)
    { x: 1920, y: FLOOR_Y - 68, w: 160, h: 32, color: "#cdb9a6" }, // run-up floor (top y=100; drop 90 + gap 40 from the ledge)
    { x: 2100, y: FLOOR_Y - 68, w: 180, h: 32, color: "#d4a574" }, // exit floor (top y=100; seam 2080→2100 = 20)
  ],
  climbWalls: [
    { x: 1720, y: FLOOR_Y + 32 - 200, w: 30, h: 200 }, // x 1720-1750, spans ledge-top(10)..base-top(200)
  ],
  breakables: [
    { x: 2078, y: FLOOR_Y - 68 - 200, w: 24, h: 200 }, // fills the seam 2080→2100; top y=-132, 200 tall
  ],
  enemies: [],
  tokens: [],
  exit: { x: 2180, y: FLOOR_Y - 68 - 52 + 4, w: 40, h: 52 }, // on the exit floor (top y=100), past run-up's right (2080)
};
