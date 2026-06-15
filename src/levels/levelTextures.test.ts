import { describe, it, expect } from "vitest";
import { entityTypesInLevel, missingTextureKeys, type TexturedLevel } from "./levelTextures";
import { ENTITY_TEXTURE_KEYS } from "../config/textures";

const dustBunnyKeys = ENTITY_TEXTURE_KEYS.dustBunny!;
const teddyKeys = ENTITY_TEXTURE_KEYS.teddy!;
const allKeys = [...dustBunnyKeys, ...teddyKeys];

describe("entityTypesInLevel", () => {
  it("collects distinct enemy + companion types", () => {
    const level: TexturedLevel = {
      enemies: [{ type: "dustBunny" }, { type: "dustBunny" }],
      companion: { type: "teddy" },
    };
    expect(entityTypesInLevel(level).sort()).toEqual(["dustBunny", "teddy"]);
  });

  it("handles a level with no companion", () => {
    expect(entityTypesInLevel({ enemies: [{ type: "dustBunny" }] })).toEqual(["dustBunny"]);
  });
});

describe("missingTextureKeys (Seam 4: every referenced type must be loaded)", () => {
  it("returns nothing when all referenced types' textures are loaded", () => {
    const level: TexturedLevel = { enemies: [{ type: "dustBunny" }], companion: { type: "teddy" } };
    expect(missingTextureKeys(level, allKeys)).toEqual([]);
  });

  it("flags an entity type that has no texture mapping at all", () => {
    const level: TexturedLevel = { enemies: [{ type: "ghost" }] };
    const missing = missingTextureKeys(level, allKeys);
    expect(missing.some((m) => m.includes("ghost"))).toBe(true);
  });

  it("flags a mapped type whose texture isn't in the loaded set", () => {
    const level: TexturedLevel = { enemies: [{ type: "dustBunny" }] };
    const loadedMinusOne = dustBunnyKeys.slice(1); // drop one required key
    const missing = missingTextureKeys(level, loadedMinusOne);
    expect(missing.some((m) => m.includes(dustBunnyKeys[0]!))).toBe(true);
  });
});
