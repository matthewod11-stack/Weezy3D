import { describe, it, expect } from "vitest";
import { COMPANIONS } from "./companions";
import { ABILITIES } from "./abilities";
import type { AbilityId } from "./abilities";
import { AREA_ORDER, areaIndex } from "./areas";
import { STORYBOOK_KEYS } from "./textures";
import type { CompanionType } from "../design/levelSketches";

const ALL: CompanionType[] = ["teddy", "dog", "cat", "horse", "flamingo"];

describe("COMPANIONS", () => {
  it("maps each of the 5 companions to a distinct area in play order", () => {
    const areas = ALL.map((c) => COMPANIONS[c].area);
    expect(new Set(areas).size).toBe(5);
    // companion of area i grants the ability whose order == i
    for (const c of ALL) {
      const grants: AbilityId = COMPANIONS[c].grants;
      expect(ABILITIES[grants].order).toBe(areaIndex(COMPANIONS[c].area));
    }
  });
  it("teddy lives in the bedroom, grants double jump, +1 heart", () => {
    expect(COMPANIONS.teddy.area).toBe("bedroom");
    expect(COMPANIONS.teddy.grants).toBe("doubleJump");
    expect(COMPANIONS.teddy.heartBonus).toBe(1);
  });
  it("every companion's textures are loaded", () => {
    for (const c of ALL) {
      expect(STORYBOOK_KEYS).toContain(COMPANIONS[c].idleKey);
      expect(STORYBOOK_KEYS).toContain(COMPANIONS[c].walkKey);
    }
  });
  it("covers the first 5 areas (dollhouse is the boss, no companion)", () => {
    const covered = new Set(ALL.map((c) => COMPANIONS[c].area));
    expect(covered).toEqual(new Set(AREA_ORDER.slice(0, 5)));
  });
});
