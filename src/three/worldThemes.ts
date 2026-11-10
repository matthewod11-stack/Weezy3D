import type * as THREE from "three";
import { BACKYARD, backyardSurfaces, buildBackyardSet } from "./backyardSet";
import { BEDROOM, bedroomSurfaces, buildBedroomSet } from "./bedroomSet";
import { buildHallwaySet, HALLWAY, hallwaySurfaces } from "./hallwaySet";
import { buildFamilyRoomSet, FAMILY_ROOM, familyRoomSurfaces } from "./familyRoomSet";
import { buildKitchenSet, KITCHEN, kitchenSurfaces } from "./kitchenSet";
import type { WorldSurfaces } from "./level3d";

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
  /** Color revealed beyond the edges of painted backdrop art. */
  paintedBackground?: number;
  /** Plush color used only on the broad walkable ground in painted mode. */
  paintedFloorBase?: string;
  /** Painted-mode broad ground treatment. */
  paintedFloorStyle?: "plush" | "wood";
  /** Plush color for elevated painted-mode platform tops. */
  paintedPlatformTopBase?: string;
  buildSet(minX: number, maxX: number): WorldSet;
  surfaces: WorldSurfaces;
}

export const WORLD_THEMES: Record<string, WorldTheme> = {
  bedroom: {
    fogColor: BEDROOM.fogColor,
    fogNear: BEDROOM.fogNear,
    fogFar: BEDROOM.fogFar,
    paintedBackground: 0xf2c3d6,
    paintedFloorBase: "#d2aa76",
    paintedFloorStyle: "wood",
    paintedPlatformTopBase: "#7fb8d4",
    buildSet: buildBedroomSet,
    surfaces: bedroomSurfaces,
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
