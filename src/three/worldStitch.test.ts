import { describe, expect, it } from "vitest";
import { LEVEL_CATALOG } from "../levels/levelCatalog";
import { parseLevelData, type LevelData } from "../types/level";
import { groupCatalogByArea, segmentAt, stitchLevels } from "./worldStitch";

/**
 * The world stitcher turns a world's N catalog levels into ONE continuous
 * LevelData (the "true continuous worlds" decision from the 2026-06-10
 * playtest): platforms/tokens/zones offset by cumulative width, intermediate
 * exit doors dropped, flush floor seams coalesced, per-segment spawn points
 * kept as pit-death checkpoints.
 *
 * All fixture coords are design px (grid = 32, floor top y = 168).
 */

const FLOOR_Y = 168;
const FLOOR_H = 32;

function makeLevel(overrides: Partial<LevelData> & { id: string }): LevelData {
  return {
    name: overrides.id,
    spawn: { x: 48, y: FLOOR_Y },
    killY: 240,
    bounds: { minX: 0, maxX: 704, minY: -160, maxY: 200 },
    platforms: [{ x: 0, y: FLOOR_Y, w: 704, h: FLOOR_H, color: "#d4a574" }],
    enemies: [],
    tokens: [],
    exit: { x: 640, y: FLOOR_Y - 52 + 4, w: 40, h: 52 },
    ...overrides,
  };
}

const levelA = makeLevel({
  id: "world-1",
  platforms: [
    { x: 0, y: FLOOR_Y, w: 704, h: FLOOR_H, color: "#d4a574" },
    { x: 256, y: 122, w: 64, h: 14, color: "#e8c9a0" },
  ],
  tokens: [{ x: 144, y: 120 }],
  enemies: [
    { type: "dustBunny", x: 300, y: FLOOR_Y, patrolLeft: 236, patrolRight: 364, speed: 45 },
  ],
});

const levelB = makeLevel({
  id: "world-2",
  spawn: { x: 16, y: 136 }, // elevated spawn — must survive as the checkpoint
  bounds: { minX: 0, maxX: 512, minY: -128, maxY: 200 },
  platforms: [{ x: 0, y: FLOOR_Y, w: 512, h: FLOOR_H, color: "#d4a574" }],
  tokens: [{ x: 80, y: 120 }],
  climbWalls: [{ x: 96, y: 40, w: 32, h: 96 }],
  breakables: [{ x: 200, y: 104, w: 32, h: 64 }],
  exit: { x: 448, y: 120, w: 40, h: 52 },
});

describe("stitchLevels", () => {
  const stitched = stitchLevels([levelA, levelB], "test-world", "Test World");

  it("offsets the second level's content by the first level's width", () => {
    expect(stitched.level.tokens).toEqual([
      { x: 144, y: 120 },
      { x: 704 + 80, y: 120 },
    ]);
    expect(stitched.level.climbWalls).toEqual([{ x: 704 + 96, y: 40, w: 32, h: 96 }]);
    expect(stitched.level.breakables).toEqual([{ x: 704 + 200, y: 104, w: 32, h: 64 }]);
  });

  it("keeps only the final exit, offset into world space", () => {
    expect(stitched.level.exit).toEqual({ x: 704 + 448, y: 120, w: 40, h: 52 });
    // No platform/zone remnant of level A's exit exists — only data carried
    // is platforms/tokens/walls, so just assert the single exit.
  });

  it("coalesces flush floor rects across the seam into one solid", () => {
    const floors = stitched.level.platforms.filter((p) => p.h === FLOOR_H);
    expect(floors).toHaveLength(1);
    expect(floors[0]).toMatchObject({ x: 0, y: FLOOR_Y, w: 704 + 512 });
    // The shelf is untouched.
    const shelves = stitched.level.platforms.filter((p) => p.h === 14);
    expect(shelves).toEqual([{ x: 256, y: 122, w: 64, h: 14, color: "#e8c9a0" }]);
  });

  it("does NOT coalesce floors across a trailing pit", () => {
    const pitEnd = makeLevel({
      id: "pit-end",
      platforms: [{ x: 0, y: FLOOR_Y, w: 600, h: FLOOR_H, color: "#d4a574" }], // pit 600..704
    });
    const result = stitchLevels([pitEnd, levelB], "w", "W");
    const floors = result.level.platforms.filter((p) => p.h === FLOOR_H);
    expect(floors).toHaveLength(2);
    expect(floors.map((f) => f.x).sort((a, b) => a - b)).toEqual([0, 704]);
  });

  it("merges bounds and takes the deepest killY", () => {
    expect(stitched.level.bounds).toEqual({ minX: 0, maxX: 704 + 512, minY: -160, maxY: 200 });
    expect(stitched.level.killY).toBe(240);
    expect(stitched.level.spawn).toEqual({ x: 48, y: FLOOR_Y });
    expect(stitched.level.id).toBe("test-world");
    expect(stitched.level.name).toBe("Test World");
  });

  it("offsets enemy patrol ranges with the enemy", () => {
    const second = stitchLevels([levelB, levelA], "w", "W");
    const enemy = second.level.enemies[0]!;
    expect(enemy.x).toBe(512 + 300);
    expect(enemy.patrolLeft).toBe(512 + 236);
    expect(enemy.patrolRight).toBe(512 + 364);
  });

  it("records one segment per input level with offset checkpoint spawns", () => {
    expect(stitched.segments).toEqual([
      { id: "world-1", name: "world-1", startX: 0, endX: 704, spawn: { x: 48, y: FLOOR_Y } },
      { id: "world-2", name: "world-2", startX: 704, endX: 1216, spawn: { x: 704 + 16, y: 136 } },
    ]);
  });

  it("rejects an empty level list", () => {
    expect(() => stitchLevels([], "w", "W")).toThrow();
  });
});

describe("segmentAt", () => {
  const { segments } = stitchLevels([levelA, levelB], "w", "W");

  it("finds the segment containing an x position", () => {
    expect(segmentAt(segments, 100).id).toBe("world-1");
    expect(segmentAt(segments, 900).id).toBe("world-2");
  });

  it("clamps positions outside the world to the nearest segment", () => {
    expect(segmentAt(segments, -50).id).toBe("world-1");
    expect(segmentAt(segments, 99999).id).toBe("world-2");
  });

  it("treats the boundary as the start of the next segment", () => {
    expect(segmentAt(segments, 704).id).toBe("world-2");
  });
});

describe("groupCatalogByArea", () => {
  const worlds = groupCatalogByArea(LEVEL_CATALOG);

  it("groups the 25-level catalog into the 5 worlds in catalog order", () => {
    expect(worlds.map((w) => w.areaId)).toEqual([
      "bedroom",
      "hallway",
      "kitchen",
      "familyRoom",
      "backyard",
    ]);
    expect(worlds.map((w) => w.entries.length)).toEqual([5, 5, 5, 5, 5]);
    expect(worlds.map((w) => w.firstIndex)).toEqual([0, 5, 10, 15, 20]);
  });
});

describe("stitchLevels — companion", () => {
  /** Minimal valid level with explicit x bounds and optional overrides. */
  function bareLevel(
    id: string,
    minX: number,
    maxX: number,
    over: Omit<Partial<LevelData>, "bounds"> = {},
  ): LevelData {
    return makeLevel({
      id,
      bounds: { minX, maxX, minY: 0, maxY: 180 },
      spawn: { x: minX + 1, y: FLOOR_Y },
      platforms: [{ x: minX, y: FLOOR_Y, w: maxX - minX, h: FLOOR_H, color: "#d4a574" }],
      exit: { x: maxX - 1, y: FLOOR_Y, w: 40, h: 52 },
      killY: 9999,
      ...over,
    });
  }

  it("preserves the single companion, offset into stitched x space", () => {
    const a = bareLevel("a", 0, 320);
    const b = bareLevel("b", 0, 320, { companion: { type: "teddy", x: 40, y: 0 } });
    const { level } = stitchLevels([a, b], "bedroom-world", "Bedroom");
    expect(level.companion).toBeDefined();
    expect(level.companion!.type).toBe("teddy");
    // b is shifted right by a's width (320); companion x 40 → 360.
    expect(level.companion!.x).toBe(360);
  });

  it("omits companion when no level has one", () => {
    const a = bareLevel("a", 0, 320);
    const b = bareLevel("b", 0, 320);
    const { level } = stitchLevels([a, b], "hallway-world", "Hallway");
    expect(level.companion).toBeUndefined();
  });
});

describe("stitching the real bedroom world", () => {
  const bedroom = groupCatalogByArea(LEVEL_CATALOG)[0]!;
  const parsed = bedroom.entries.map((e) => parseLevelData(e.raw));
  const stitched = stitchLevels(parsed, "bedroom-world", "Bedroom");

  it("produces schema-valid LevelData", () => {
    expect(() => parseLevelData(stitched.level)).not.toThrow();
  });

  it("sums width and tokens across all five levels", () => {
    const widthSum = parsed.reduce((s, l) => s + (l.bounds.maxX - l.bounds.minX), 0);
    const tokenSum = parsed.reduce((s, l) => s + l.tokens.length, 0);
    expect(stitched.level.bounds.maxX).toBe(widthSum);
    expect(stitched.level.tokens).toHaveLength(tokenSum);
    expect(stitched.segments).toHaveLength(5);
  });

  it("places every platform and token inside the stitched bounds", () => {
    for (const p of stitched.level.platforms) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(stitched.level.bounds.maxX);
    }
    for (const t of stitched.level.tokens) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThanOrEqual(stitched.level.bounds.maxX);
    }
  });

  it("puts the single exit inside the final segment", () => {
    const lastSeg = stitched.segments[stitched.segments.length - 1]!;
    expect(stitched.level.exit.x).toBeGreaterThanOrEqual(lastSeg.startX);
    expect(stitched.level.exit.x).toBeLessThanOrEqual(lastSeg.endX);
  });

  it("keeps the world spawn identical to level 1's spawn", () => {
    expect(stitched.level.spawn).toEqual(parsed[0]!.spawn);
  });
});
