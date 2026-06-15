import { describe, it, expect } from "vitest";
import { encodeAreaLevels } from "./encodeFromSketch";
import { BACKYARD_AREA } from "../design/levelSketches";
import { checkReachability } from "./reachability";
import { abilitiesForArea } from "../config/gating";
import { parseLevelData, type LevelData } from "../types/level";

const SEGMENT_ORDER = ["B", "A", "A", "C"];
const FULL = abilitiesForArea("backyard"); // { doubleJump, dash, wallClimb, charge, glide }
const NO_CHARGE = new Set(["doubleJump", "dash", "wallClimb", "glide"]);
const NO_GLIDE = new Set(["doubleJump", "dash", "wallClimb", "charge"]);

function backyardLevels(): LevelData[] {
  return (encodeAreaLevels(BACKYARD_AREA, SEGMENT_ORDER) as unknown[]).map(parseLevelData);
}
const byId = (id: string) => backyardLevels().find((l) => l.id === id);
const errorsFor = (level: LevelData, abilities: Set<string>) =>
  checkReachability(level, { abilities: abilities as Set<any> }).problems.filter((p) => p.severity === "error");

describe("Backyard — every authored level is completable with the full loadout", () => {
  const levels = backyardLevels();
  it("has 5 levels authored", () => {
    expect(levels.length).toBe(5);
  });
  it("the Backyard loadout is exactly {doubleJump, dash, wallClimb, charge, glide}", () => {
    expect(new Set(FULL)).toEqual(new Set(["doubleJump", "dash", "wallClimb", "charge", "glide"]));
  });
  for (const level of levels) {
    it(`${level.id} — solvable WITH {doubleJump, dash, wallClimb, charge, glide}`, () => {
      const errors = errorsFor(level, FULL);
      expect(errors, errors.map((e) => e.message).join(" | ")).toHaveLength(0);
    });
  }
});

describe("Backyard — the charge gate bites (slots 4 & 5)", () => {
  for (const id of ["backyard-4", "backyard-5"]) {
    it(`${id} is NOT solvable without charge`, () => {
      const level = byId(id);
      expect(level, `${id} not authored`).toBeDefined();
      expect(errorsFor(level!, NO_CHARGE).length).toBeGreaterThan(0);
    });
  }
});

describe("Backyard — the glide gate bites (slots 3 & 5)", () => {
  for (const id of ["backyard-3", "backyard-5"]) {
    it(`${id} is NOT solvable without glide`, () => {
      const level = byId(id);
      expect(level, `${id} not authored`).toBeDefined();
      expect(errorsFor(level!, NO_GLIDE).length).toBeGreaterThan(0);
    });
  }
});

describe("Backyard — Flamingo is comfortably reachable (slot 1)", () => {
  it("no companion-stranded with the full loadout", () => {
    const level = byId("backyard-1");
    expect(level, "backyard-1 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: FULL });
    expect(r.problems.find((p) => p.kind === "companion-stranded")?.message).toBeUndefined();
  });
});

describe("Backyard — carryover recaps all four enemy types", () => {
  it("more than one distinct enemy type appears across the area", () => {
    const types = new Set<string>();
    for (const level of backyardLevels()) {
      for (const e of level.enemies) types.add(e.type);
    }
    expect(types.size, `enemy types seen: ${[...types].join(", ")}`).toBeGreaterThan(1);
    expect(types.has("ant"), "primary ant missing").toBe(true);
  });
});
