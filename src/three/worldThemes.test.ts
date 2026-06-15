import { describe, expect, it } from "vitest";
import { RENDER_SCALE } from "../config/game";
import { LEVEL_CATALOG } from "../levels/levelCatalog";
import { parseLevelData, scaleLevelData } from "../types/level";
import { themeForArea, WORLD_THEMES } from "./worldThemes";

describe("world themes", () => {
  it("registers the bedroom theme with the shipped fog values", () => {
    const theme = WORLD_THEMES.bedroom;
    expect(theme).toBeDefined();
    expect(theme!.fogNear).toBe(14);
    expect(theme!.fogFar).toBe(36);
  });

  it("registers the hallway theme", () => {
    const theme = WORLD_THEMES.hallway;
    expect(theme).toBeDefined();
    expect(theme!.fogColor).toBe(0xc5cfd8);
  });

  it("registers the kitchen theme", () => {
    const theme = WORLD_THEMES.kitchen;
    expect(theme).toBeDefined();
    expect(theme!.fogColor).toBe(0xfff8f0);
  });

  it("registers the familyRoom theme (camelCase areaId)", () => {
    const theme = WORLD_THEMES.familyRoom;
    expect(theme).toBeDefined();
    expect(theme!.fogColor).toBe(0xf0d8b0);
  });

  it("registers the backyard theme with a sky background override", () => {
    const theme = WORLD_THEMES.backyard;
    expect(theme).toBeDefined();
    expect(theme!.background).toBe(0xa8d8f0);
  });

  it("every catalog area has its own theme — no fallback in shipping worlds", () => {
    for (const area of new Set(LEVEL_CATALOG.map((e) => e.areaId))) {
      expect(WORLD_THEMES[area], `missing theme for ${area}`).toBeDefined();
    }
  });

  it("falls back to bedroom for unknown areas", () => {
    expect(themeForArea("not-a-world")).toBe(WORLD_THEMES.bedroom);
  });

  // The camera sits ~10.5 units off the gameplay plane; fog must start
  // behind it or the play layer itself fogs out (why Bedroom shipped 14/36,
  // not the scenery library's 8/30). Every registered theme obeys this.
  it("every registered theme keeps fogNear behind the gameplay plane", () => {
    for (const [area, theme] of Object.entries(WORLD_THEMES)) {
      expect(theme.fogNear, `${area} fogNear`).toBeGreaterThanOrEqual(12);
    }
  });

  it("all 25 catalog levels parse and scale for the 3D loader", () => {
    expect(LEVEL_CATALOG.length).toBe(25);
    for (const entry of LEVEL_CATALOG) {
      const scaled = scaleLevelData(parseLevelData(entry.raw), RENDER_SCALE);
      expect(scaled.platforms.length, entry.backgroundKey).toBeGreaterThan(0);
      expect(scaled.bounds.maxX).toBeGreaterThan(scaled.bounds.minX);
    }
  });
});
