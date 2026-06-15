import { describe, it, expect } from "vitest";
import { LEVEL_CATALOG } from "./levelCatalog";
import { checkReachability } from "./reachability";
import { abilitiesForArea, gatingPower } from "../config/gating";
import type { AreaId } from "../config/areas";
import type { AbilityId } from "../config/abilities";

describe("every level is completable with its area's powers", () => {
  for (const entry of LEVEL_CATALOG) {
    const data = entry.raw;
    const area = entry.areaId as AreaId;
    it(`${data.id} — solvable WITH ${[...abilitiesForArea(area)].join("+") || "no powers"}`, () => {
      const result = checkReachability(data, { abilities: abilitiesForArea(area) });
      const errors = result.problems.filter((p) => p.severity === "error");
      expect(errors, errors.map((e) => e.message).join(" | ")).toHaveLength(0);
    });
  }
});

describe("each gated area genuinely requires its gating power (per-area)", () => {
  const gatedAreas = [...new Set(LEVEL_CATALOG.map((e) => e.areaId as AreaId))]
    .filter((area) => gatingPower(area) !== null);

  if (gatedAreas.length === 0) {
    it.todo("no gated areas in catalog yet");
  }

  for (const area of gatedAreas) {
    const gp = gatingPower(area)!;
    const entries = LEVEL_CATALOG.filter((e) => (e.areaId as AreaId) === area);
    it(`${area} — at least one level is NOT solvable without ${gp}`, () => {
      const without = new Set([...abilitiesForArea(area)]);
      without.delete(gp);
      const someLevelGated = entries.some((entry) => {
        const r = checkReachability(entry.raw, { abilities: without });
        return r.problems.filter((p) => p.severity === "error").length > 0;
      });
      expect(
        someLevelGated,
        `no level in ${area} requires ${gp} — the gate is decorative`,
      ).toBe(true);
    });
  }
});

describe("no level requires a power earned in its own or a later area (ordering)", () => {
  for (const entry of LEVEL_CATALOG) {
    const area = entry.areaId as AreaId;
    const allowed = abilitiesForArea(area);
    it(`${entry.raw.id} — every requires:<ability> is earned earlier`, () => {
      const offenders = entry.raw.platforms
        .map((p) => p.requires)
        .filter((r): r is AbilityId => r !== undefined && !allowed.has(r));
      expect(offenders, `disallowed on ${entry.raw.id}: ${offenders.join(", ")}`).toHaveLength(0);

      // A climbWall implies wallClimb (you can't place a climbable wall before
      // Cat grants the power). climbWalls is optional → guard the access.
      const hasClimbWalls = (entry.raw.climbWalls?.length ?? 0) > 0;
      const climbOffenders = hasClimbWalls && !allowed.has("wallClimb") ? 1 : 0;
      expect(climbOffenders, `${entry.raw.id} has climbWalls but no wallClimb in its area`).toBe(0);

      // A breakable implies charge (you can't place a barricade before Horse
      // grants the power). breakables is optional → guard the access.
      const hasBreakables = (entry.raw.breakables?.length ?? 0) > 0;
      const breakOffenders = hasBreakables && !allowed.has("charge") ? 1 : 0;
      expect(breakOffenders, `${entry.raw.id} has breakables but no charge in its area`).toBe(0);
    });
  }
});
