import { describe, it, expect } from "vitest";
import { encodeAreaLevels } from "./encodeFromSketch";
import { FAMILY_ROOM_AREA } from "../design/levelSketches";
import { checkReachability } from "./reachability";
import { abilitiesForArea } from "../config/gating";
import { parseLevelData, type LevelData } from "../types/level";

const SEGMENT_ORDER = ["B", "A", "A", "C"];
const FULL = abilitiesForArea("familyRoom"); // { doubleJump, dash, wallClimb }

function familyRoomLevels(): LevelData[] {
  return (encodeAreaLevels(FAMILY_ROOM_AREA, SEGMENT_ORDER) as unknown[]).map(parseLevelData);
}
const byId = (id: string) => familyRoomLevels().find((l) => l.id === id);
const errorsFor = (level: LevelData, abilities: Set<string>) =>
  checkReachability(level, { abilities: abilities as Set<any> }).problems.filter((p) => p.severity === "error");

describe("Family Room — every authored level is completable with the full loadout", () => {
  const levels = familyRoomLevels();
  it("has 5 levels authored", () => {
    expect(levels.length).toBe(5);
  });
  it("the Family Room loadout is exactly {doubleJump, dash, wallClimb}", () => {
    expect(new Set(FULL)).toEqual(new Set(["doubleJump", "dash", "wallClimb"]));
  });
  for (const level of levels) {
    it(`${level.id} — solvable WITH {doubleJump, dash, wallClimb}`, () => {
      const errors = errorsFor(level, FULL);
      expect(errors, errors.map((e) => e.message).join(" | ")).toHaveLength(0);
    });
  }
});

describe("Family Room — climb is light (slots 1-4 do NOT require wallClimb)", () => {
  for (const id of ["family-room-1", "family-room-2", "family-room-3", "family-room-4"]) {
    it(`${id} is solvable WITHOUT wallClimb (climbs there are optional)`, () => {
      const level = byId(id);
      expect(level, `${id} not authored`).toBeDefined();
      const errors = errorsFor(level!, new Set(["doubleJump", "dash"]));
      expect(errors, errors.map((e) => e.message).join(" | ")).toHaveLength(0);
    });
  }
});

describe("Family Room — the climb gate bites (finale, slot 5)", () => {
  it("family-room-5 is NOT solvable without wallClimb", () => {
    const level = byId("family-room-5");
    expect(level, "family-room-5 not authored").toBeDefined();
    expect(errorsFor(level!, new Set(["doubleJump", "dash"])).length).toBeGreaterThan(0);
  });
});

describe("Family Room — Horse is comfortably reachable (slot 5)", () => {
  it("no companion-stranded with the full loadout", () => {
    const level = byId("family-room-5");
    expect(level, "family-room-5 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: FULL });
    expect(r.problems.find((p) => p.kind === "companion-stranded")?.message).toBeUndefined();
  });
});

describe("Family Room — carryover produces mixed enemy types", () => {
  it("more than one distinct enemy type appears across the area", () => {
    const types = new Set<string>();
    for (const level of familyRoomLevels()) {
      for (const e of level.enemies) types.add(e.type);
    }
    expect(types.size, `enemy types seen: ${[...types].join(", ")}`).toBeGreaterThan(1);
    expect(types.has("dustMite"), "primary dust mite missing").toBe(true);
  });
});
