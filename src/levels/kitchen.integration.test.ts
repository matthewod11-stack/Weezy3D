import { describe, it, expect } from "vitest";
import { encodeAreaLevels } from "./encodeFromSketch";
import { KITCHEN_AREA } from "../design/levelSketches";
import { checkReachability } from "./reachability";
import { abilitiesForArea } from "../config/gating";
import { parseLevelData, type LevelData } from "../types/level";

const SEGMENT_ORDER = ["B", "A", "A", "C"];
const FULL = abilitiesForArea("kitchen"); // { doubleJump, dash, wallClimb }

function kitchenLevels(): LevelData[] {
  return (encodeAreaLevels(KITCHEN_AREA, SEGMENT_ORDER) as unknown[]).map(parseLevelData);
}
const byId = (id: string) => kitchenLevels().find((l) => l.id === id);
const errorsFor = (level: LevelData, abilities: Set<string>) =>
  checkReachability(level, { abilities: abilities as Set<any> }).problems.filter((p) => p.severity === "error");

describe("Kitchen — every authored level is completable with the full loadout", () => {
  const levels = kitchenLevels();
  it("has 5 levels authored", () => {
    expect(levels.length).toBe(5);
  });
  for (const level of levels) {
    it(`${level.id} — solvable WITH {doubleJump, dash, wallClimb}`, () => {
      const errors = errorsFor(level, FULL);
      expect(errors, errors.map((e) => e.message).join(" | ")).toHaveLength(0);
    });
  }
});

describe("Kitchen — the climb gate bites (ascent, slot 1)", () => {
  it("kitchen-1 is NOT solvable without wallClimb", () => {
    const level = byId("kitchen-1");
    expect(level, "kitchen-1 not authored").toBeDefined();
    expect(errorsFor(level!, new Set(["doubleJump", "dash"])).length).toBeGreaterThan(0);
  });
});

describe("Kitchen — the dash gate bites (slots 4 & 5)", () => {
  for (const id of ["kitchen-4", "kitchen-5"]) {
    it(`${id} is NOT solvable without dash`, () => {
      const level = byId(id);
      expect(level, `${id} not authored`).toBeDefined();
      expect(errorsFor(level!, new Set(["doubleJump", "wallClimb"])).length).toBeGreaterThan(0);
    });
  }
});

describe("Kitchen — the combo finale needs BOTH (slot 5)", () => {
  it("kitchen-5 fails without dash (stove blocks) and without climb (exit shelf blocks)", () => {
    const level = byId("kitchen-5");
    expect(level, "kitchen-5 not authored").toBeDefined();
    expect(errorsFor(level!, new Set(["doubleJump", "wallClimb"])).length, "no-dash should block").toBeGreaterThan(0);
    expect(errorsFor(level!, new Set(["doubleJump", "dash"])).length, "no-climb should block").toBeGreaterThan(0);
  });
});

describe("Kitchen — Cat is comfortably reachable (slot 1)", () => {
  it("no companion-stranded with the full loadout", () => {
    const level = byId("kitchen-1");
    expect(level, "kitchen-1 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: FULL });
    expect(r.problems.find((p) => p.kind === "companion-stranded")?.message).toBeUndefined();
  });
});
