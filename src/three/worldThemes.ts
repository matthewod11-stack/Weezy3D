import type * as THREE from "three";
import { BACKYARD, backyardSurfaces, buildBackyardSet } from "./backyardSet";
import { BEDROOM, buildBedroomSet } from "./bedroomSet";
import { buildHallwaySet, HALLWAY, hallwaySurfaces } from "./hallwaySet";
import { buildFamilyRoomSet, FAMILY_ROOM, familyRoomSurfaces } from "./familyRoomSet";
import { buildKitchenSet, KITCHEN, kitchenSurfaces } from "./kitchenSet";
import { DEFAULT_SURFACES, type WorldSurfaces } from "./level3d";

/**
 * Per-world theme registry — keyed by LevelCatalogEntry.areaId. Maps each
 * world to its fog, set builder, and gameplay-surface skin. Unknown areas
 * fall back to bedroom so a world without a set yet still loads and plays.
 */

export interface WorldSet {
  group: THREE.Group;
  /** Shadow-casting key light — main loop re-targets it to follow the player. */
  sun: THREE.DirectionalLight;
  sunTarget: THREE.Object3D;
  /** Key-light offset from the player (world units). Bedroom's lamp angle is (7, 11, 8). */
  sunOffset: { x: number; y: number; z: number };
  /** Optional per-frame hook: fireplace flicker, stove breathing, etc. */
  update?(dtMs: number, elapsedMs: number): void;
}

export interface WorldTheme {
  fogColor: number;
  fogNear: number;
  fogFar: number;
  /** Scene background; defaults to fogColor. Backyard overrides with sky blue. */
  background?: number;
  buildSet(minX: number, maxX: number): WorldSet;
  surfaces: WorldSurfaces;
}

const BEDROOM_SUN_OFFSET = { x: 7, y: 11, z: 8 };

export const WORLD_THEMES: Record<string, WorldTheme> = {
  bedroom: {
    fogColor: BEDROOM.fogColor,
    fogNear: BEDROOM.fogNear,
    fogFar: BEDROOM.fogFar,
    buildSet: (minX, maxX) => ({ ...buildBedroomSet(minX, maxX), sunOffset: BEDROOM_SUN_OFFSET }),
    surfaces: DEFAULT_SURFACES,
  },
  hallway: {
    fogColor: HALLWAY.fogColor,
    fogNear: HALLWAY.fogNear,
    fogFar: HALLWAY.fogFar,
    buildSet: buildHallwaySet,
    surfaces: hallwaySurfaces,
  },
  kitchen: {
    fogColor: KITCHEN.fogColor,
    fogNear: KITCHEN.fogNear,
    fogFar: KITCHEN.fogFar,
    buildSet: buildKitchenSet,
    surfaces: kitchenSurfaces,
  },
  familyRoom: {
    fogColor: FAMILY_ROOM.fogColor,
    fogNear: FAMILY_ROOM.fogNear,
    fogFar: FAMILY_ROOM.fogFar,
    buildSet: buildFamilyRoomSet,
    surfaces: familyRoomSurfaces,
  },
  backyard: {
    fogColor: BACKYARD.fogColor,
    fogNear: BACKYARD.fogNear,
    fogFar: BACKYARD.fogFar,
    background: BACKYARD.sky,
    buildSet: buildBackyardSet,
    surfaces: backyardSurfaces,
  },
};

export function themeForArea(areaId: string): WorldTheme {
  return WORLD_THEMES[areaId] ?? WORLD_THEMES.bedroom!;
}
