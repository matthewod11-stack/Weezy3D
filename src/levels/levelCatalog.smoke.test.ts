import { describe, it, expect } from "vitest";
import { LEVEL_CATALOG } from "./levelCatalog";
import { parseLevelData } from "../types/level";
import { missingTextureKeys } from "./levelTextures";
import { STORYBOOK_KEYS } from "../config/textures";

/**
 * Boot smoke test (audit Seam 4: level data ↔ engine/assets). Catches the
 * "shipped a level the game can't load" class — schema drift or an entity type
 * whose art was never wired into BootScene — at build time instead of on a
 * black screen during playtest.
 */
describe("every catalog level boots cleanly", () => {
  for (const entry of LEVEL_CATALOG) {
    const data = entry.raw;

    it(`${data.id} — passes Zod validation`, () => {
      expect(() => parseLevelData(data)).not.toThrow();
    });

    it(`${data.id} — references only loaded textures`, () => {
      const missing = missingTextureKeys(data, STORYBOOK_KEYS);
      expect(missing, missing.join(" | ")).toEqual([]);
    });
  }
});
