import { describe, it, expect } from "vitest";
import { parseLevelData } from "./level";

const base = {
  id: "t",
  name: "T",
  spawn: { x: 0, y: 0 },
  killY: 300,
  bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
  exit: { x: 80, y: 0, w: 40, h: 52 },
};

describe("PlatformSchema.requires", () => {
  it("accepts a platform tagged with a known ability", () => {
    const data = parseLevelData({
      ...base,
      platforms: [{ x: 0, y: 50, w: 40, h: 10, requires: "dash" }],
    });
    expect(data.platforms[0]!.requires).toBe("dash");
  });

  it("defaults requires to undefined when omitted", () => {
    const data = parseLevelData({ ...base, platforms: [{ x: 0, y: 50, w: 40, h: 10 }] });
    expect(data.platforms[0]!.requires).toBeUndefined();
  });

  it("rejects an unknown requires value", () => {
    expect(() =>
      parseLevelData({
        ...base,
        platforms: [{ x: 0, y: 50, w: 40, h: 10, requires: "teleport" }],
      }),
    ).toThrow();
  });
});

describe("LevelData.climbWalls", () => {
  it("accepts a climb wall and is undefined when omitted (optional feature)", () => {
    const withWall = parseLevelData({
      ...base,
      platforms: [{ x: 0, y: 50, w: 40, h: 10 }],
      climbWalls: [{ x: 20, y: 0, w: 8, h: 60 }],
    });
    expect(withWall.climbWalls).toHaveLength(1);
    expect(withWall.climbWalls![0]).toMatchObject({ x: 20, y: 0, w: 8, h: 60 });

    const without = parseLevelData({ ...base, platforms: [{ x: 0, y: 50, w: 40, h: 10 }] });
    expect(without.climbWalls).toBeUndefined();
  });
});

describe("LevelData.breakables", () => {
  it("accepts a breakable and is undefined when omitted (optional feature)", () => {
    const withB = parseLevelData({
      ...base,
      platforms: [{ x: 0, y: 50, w: 40, h: 10 }],
      breakables: [{ x: 38, y: 0, w: 6, h: 60 }],
    });
    expect(withB.breakables).toHaveLength(1);
    expect(withB.breakables![0]).toMatchObject({ x: 38, y: 0, w: 6, h: 60 });

    const without = parseLevelData({ ...base, platforms: [{ x: 0, y: 50, w: 40, h: 10 }] });
    expect(without.breakables).toBeUndefined();
  });
});

const baseLevel = {
  id: "t", name: "t",
  spawn: { x: 10, y: 10 }, killY: 240,
  bounds: { minX: 0, maxX: 100, minY: -100, maxY: 200 },
  platforms: [{ x: 0, y: 168, w: 100, h: 32 }],
  exit: { x: 90, y: 120, w: 40, h: 52 },
};

describe("enemy type schema", () => {
  it("accepts a spider enemy", () => {
    const data = parseLevelData({
      ...baseLevel,
      enemies: [{ type: "spider", x: 50, y: 168, patrolLeft: 40, patrolRight: 60, speed: 45 }],
    });
    expect(data.enemies[0]!.type).toBe("spider");
  });

  it("still accepts a dustBunny enemy", () => {
    const data = parseLevelData({
      ...baseLevel,
      enemies: [{ type: "dustBunny", x: 50, y: 168, patrolLeft: 40, patrolRight: 60, speed: 45 }],
    });
    expect(data.enemies[0]!.type).toBe("dustBunny");
  });
});
