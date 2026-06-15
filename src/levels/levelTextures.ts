/**
 * Boot/texture smoke check (audit Seam 4: level data ↔ loaded assets).
 *
 * A level that references an entity `type` whose textures aren't loaded crashes
 * at runtime, not at build. These pure helpers let a test catch that the moment
 * a new type is authored without its art being wired into BootScene.
 */

import { ENTITY_TEXTURE_KEYS } from "../config/textures";

/** The subset of a level that references textured entities. */
export interface TexturedLevel {
  enemies: Array<{ type: string }>;
  companion?: { type: string };
}

/** Distinct entity types (enemies + companion) referenced by a level. */
export function entityTypesInLevel(level: TexturedLevel): string[] {
  const types = new Set<string>();
  for (const e of level.enemies) types.add(e.type);
  if (level.companion) types.add(level.companion.type);
  return [...types];
}

/**
 * Texture keys a level needs that are NOT in `loadedKeys`, plus any entity type
 * with no entry in ENTITY_TEXTURE_KEYS. Empty array = the level is safe to boot.
 */
export function missingTextureKeys(level: TexturedLevel, loadedKeys: readonly string[]): string[] {
  const loaded = new Set(loadedKeys);
  const missing: string[] = [];
  for (const type of entityTypesInLevel(level)) {
    const keys = ENTITY_TEXTURE_KEYS[type];
    if (!keys) {
      missing.push(`type "${type}" has no entry in ENTITY_TEXTURE_KEYS`);
      continue;
    }
    for (const key of keys) {
      if (!loaded.has(key)) missing.push(`type "${type}" needs texture "${key}" which is not loaded`);
    }
  }
  return missing;
}
