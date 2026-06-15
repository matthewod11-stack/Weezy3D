import { describe, it, expect } from "vitest";
import { encodeAreaLevels } from "./encodeFromSketch";
import type { Area } from "../design/levelSketches";
import { parseLevelData } from "../types/level";

// Minimal one-slot area fixture: a spider on the floor + a Dog companion.
const FIXTURE: Area = {
  id: 99, name: "Fixture", worldKey: "Fixture",
  intent: "test", companion: "dog", primaryEnemy: "spider", carryOverEnemies: [],
  slots: [
    {
      id: 1, name: "s", intent: "s",
      options: [
        {
          variant: "A", source: "test", approxSeconds: 10,
          widthGrids: 12, heightGrids: 3,
          spawn: { x: 1, y: 0 }, exit: { x: 11, y: 0 },
          platforms: [],
          zones: [
            { x: 5, y: 0, kind: "enemy" },
            { x: 9, y: 0, kind: "companion", label: "Dog" },
          ],
        },
      ],
    },
  ],
};

// Companion-less area fixture: no companion zone + null companion.
const NO_COMPANION_FIXTURE: Area = {
  id: 98, name: "NoCompanion", worldKey: "NoCompanion",
  intent: "test", companion: null, primaryEnemy: "spider", carryOverEnemies: [],
  slots: [
    {
      id: 1, name: "s", intent: "s",
      options: [
        {
          variant: "A", source: "test", approxSeconds: 10,
          widthGrids: 12, heightGrids: 3,
          spawn: { x: 1, y: 0 }, exit: { x: 11, y: 0 },
          platforms: [],
          zones: [{ x: 5, y: 0, kind: "enemy" }],
        },
      ],
    },
  ],
};

describe("encoder derives enemy + companion type from the area", () => {
  it("emits a spider enemy and a dog companion", () => {
    const [level] = encodeAreaLevels(FIXTURE, ["A"]) as unknown[];
    const data = parseLevelData(level);
    expect(data.enemies[0]!.type).toBe("spider");
    expect(data.companion?.type).toBe("dog");
  });

  it("emits no companion when the area's companion is null", () => {
    const [level] = encodeAreaLevels(NO_COMPANION_FIXTURE, ["A"]) as unknown[];
    const data = parseLevelData(level);
    expect(data.companion).toBeUndefined();
  });
});
