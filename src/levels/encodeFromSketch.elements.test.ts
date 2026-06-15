import { describe, it, expect } from "vitest";
import { encodeSlotToLevelData } from "./encodeFromSketch";
import { parseLevelData } from "../types/level";
import { DESIGN_FLOOR_Y } from "../config/backgrounds";
import type { LevelSlot, LevelOption, SketchZone } from "../design/levelSketches";

const GRID = 32;
const EXIT_H = 52;

/** A one-option slot for exercising encoder element passthrough. */
function slotWith(opt: Partial<LevelOption>): LevelSlot {
  const base: LevelOption = {
    variant: "A",
    source: "test",
    approxSeconds: 10,
    widthGrids: 22,
    heightGrids: 9,
    spawn: { x: 1, y: 0 },
    exit: { x: 21, y: 0 },
    platforms: [],
    zones: [],
    pits: [],
  };
  return { id: 1, name: "T", intent: "t", options: [{ ...base, ...opt }] };
}

describe("encoder — requires:'dash' passthrough", () => {
  it("tags the encoded platform with requires:'dash'", () => {
    const slot = slotWith({ platforms: [{ x: 10, y: 4, w: 3, requires: "dash" }] });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    const dashPlat = level.platforms.find((p) => p.requires === "dash");
    expect(dashPlat, "no platform carried requires:'dash'").toBeDefined();
  });
});

describe("encoder — climbWalls element", () => {
  it("emits a game-coord climbWall spanning floor → counter", () => {
    const slot = slotWith({
      platforms: [{ x: 10, y: 6, w: 4 }],   // counter 6 grids up
      climbWalls: [{ x: 10, y: 0, h: 7 }],   // floor → counter face (height 6 + 1)
    });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.climbWalls?.length).toBe(1);
    const w = level.climbWalls![0]!;
    expect(w.x).toBe(10 * GRID);
    expect(w.y).toBe(DESIGN_FLOOR_Y - 7 * GRID);     // top: 7 grids up
    expect(w.y + w.h).toBe(DESIGN_FLOOR_Y);          // bottom: at the floor top
    expect(w.w).toBe(GRID);                          // default width 1 grid
  });
});

describe("encoder — elevatable exit", () => {
  it("floor-level exit (y=0) is unchanged", () => {
    const slot = slotWith({ exit: { x: 21, y: 0 } });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.exit.y).toBe(DESIGN_FLOOR_Y - EXIT_H + 4);
  });
  it("elevated exit (y=6) sits 6 grids up", () => {
    const slot = slotWith({ exit: { x: 21, y: 6 } });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.exit.y).toBe(DESIGN_FLOOR_Y - 6 * GRID - EXIT_H + 4);
  });
});

describe("encoder — enemyType carryover override", () => {
  it("a zone with enemyType overrides the area primaryEnemy", () => {
    const slot = slotWith({ zones: [{ x: 5, y: 0, kind: "enemy", enemyType: "spider" }] });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "dust_mite", "horse"));
    expect(level.enemies[0]!.type).toBe("spider");
  });
  it("a zone WITHOUT enemyType falls back to primaryEnemy", () => {
    const slot = slotWith({ zones: [{ x: 5, y: 0, kind: "enemy" }] });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "dust_mite", "horse"));
    expect(level.enemies[0]!.type).toBe("dustMite");
  });
  it("a dust_bunny override maps to the runtime camelCase type", () => {
    const slot = slotWith({ zones: [{ x: 5, y: 0, kind: "enemy", enemyType: "dust_bunny" }] });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "dust_mite", "horse"));
    expect(level.enemies[0]!.type).toBe("dustBunny");
  });
  it("enemyType 'trex' throws (boss is not a patroller)", () => {
    const slot = slotWith({ zones: [{ x: 5, y: 0, kind: "enemy", enemyType: "trex" }] });
    expect(() => encodeSlotToLevelData(slot, ["A"], "test", "dust_mite", "horse")).toThrow("T-Rex is a set-piece boss");
  });
  it("enemyType on a token zone is ignored (no enemy spawned)", () => {
    const slot = slotWith({ zones: [{ x: 5, y: 0, kind: "token", enemyType: "spider" } as SketchZone] });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "dust_mite", "horse"));
    expect(level.enemies).toHaveLength(0);
    expect(level.tokens).toHaveLength(1);
  });
});

describe("encoder — breakables element", () => {
  it("emits a game-coord breakable rooted at the floor", () => {
    const slot = slotWith({ breakables: [{ x: 10, y: 0, w: 2, h: 7 }] });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.breakables?.length).toBe(1);
    const b = level.breakables![0]!;
    expect(b.x).toBe(10 * GRID);
    expect(b.y).toBe(DESIGN_FLOOR_Y - 7 * GRID);   // top: 7 grids up
    expect(b.y + b.h).toBe(DESIGN_FLOOR_Y);         // bottom: at the floor top
    expect(b.w).toBe(2 * GRID);
  });
  it("a sketch without breakables emits no breakables key", () => {
    const slot = slotWith({});
    const raw = encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat") as { breakables?: unknown };
    expect(raw.breakables).toBeUndefined();
  });
});

describe("encoder — elevatable spawn", () => {
  it("floor spawn (y=0) sits at the floor", () => {
    const slot = slotWith({ spawn: { x: 1, y: 0 } });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.spawn.y).toBe(DESIGN_FLOOR_Y);
  });
  it("elevated spawn (y=7) sits 7 grids up (the windowsill)", () => {
    const slot = slotWith({ spawn: { x: 1, y: 7 } });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.spawn.y).toBe(DESIGN_FLOOR_Y - 7 * GRID);
  });
});
