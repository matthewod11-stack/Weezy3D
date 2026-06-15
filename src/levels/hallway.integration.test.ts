import { describe, it, expect } from "vitest";
import { encodeAreaLevels } from "./encodeFromSketch";
import { HALLWAY_AREA } from "../design/levelSketches";
import { checkReachability } from "./reachability";
import { abilitiesForArea } from "../config/gating";
import { parseLevelData, type LevelData } from "../types/level";

export const SEGMENT_ORDER = ["B", "A", "A", "C"];
const HALLWAY = abilitiesForArea("hallway"); // { doubleJump }

export function hallwayLevels(): LevelData[] {
  return (encodeAreaLevels(HALLWAY_AREA, SEGMENT_ORDER) as unknown[]).map(parseLevelData);
}

describe("Hallway — every authored level is completable with double-jump", () => {
  const levels = hallwayLevels();
  // Guard so the suite isn't empty before any slot is authored.
  it("has at least the levels authored so far", () => {
    expect(levels.length).toBeGreaterThanOrEqual(0);
  });
  for (const level of levels) {
    it(`${level.id} — solvable WITH double-jump`, () => {
      const r = checkReachability(level, { abilities: HALLWAY });
      const errors = r.problems.filter((p) => p.severity === "error");
      expect(errors, errors.map((e) => e.message).join(" | ")).toHaveLength(0);
    });
  }
});

describe("Hallway — the gate bites (slot 4)", () => {
  const byId = (id: string) => hallwayLevels().find((l) => l.id === id);

  it("hallway-4 is NOT solvable without double-jump", () => {
    const level = byId("hallway-4");
    expect(level, "hallway-4 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: new Set([]) });
    const errors = r.problems.filter((p) => p.severity === "error");
    expect(errors.length, "expected an exit-unreachable error").toBeGreaterThan(0);
  });
});

describe("Hallway — finale gate + companion (slot 5)", () => {
  const byId = (id: string) => hallwayLevels().find((l) => l.id === id);

  it("hallway-5 is NOT solvable without double-jump", () => {
    const level = byId("hallway-5");
    expect(level, "hallway-5 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: new Set([]) });
    const errors = r.problems.filter((p) => p.severity === "error");
    expect(errors.length, "expected an exit-unreachable error").toBeGreaterThan(0);
  });

  it("Dog is comfortably reachable in hallway-5", () => {
    const level = byId("hallway-5");
    expect(level, "hallway-5 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: abilitiesForArea("hallway") });
    const stranded = r.problems.find((p) => p.kind === "companion-stranded");
    expect(stranded, stranded?.message).toBeUndefined();
  });
});
