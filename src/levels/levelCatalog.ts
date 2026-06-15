import bgBookshelfLower from "../../assets/backgrounds/World1_Bedroom/1-1_bookshelf_lower.png?url";
import { BEDROOM_LEVELS } from "./bedroomLevels";
import { HALLWAY_LEVELS } from "./hallwayLevels";
import { KITCHEN_LEVELS } from "./kitchenLevels";
import { FAMILY_ROOM_LEVELS } from "./familyRoomLevels";
import { BACKYARD_LEVELS } from "./backyardLevels";
import type { LevelData } from "../types/level";

export type LevelCatalogEntry = {
  areaId: string;
  /** Placeholder while in blueprint mode — backgrounds aren't loaded by GameScene. */
  backgroundKey: string;
  backgroundUrl: string;
  raw: LevelData;
};

/** In blueprint mode every level uses the same placeholder background ref;
 * the loader treats it as a no-op. Per-section illustrated backgrounds return
 * once gameplay is locked. */
const PLACEHOLDER_BG = { key: "bg_blueprint", url: bgBookshelfLower };

const BEDROOM_ENTRIES: LevelCatalogEntry[] = BEDROOM_LEVELS.map((level, index) => ({
  areaId: "bedroom",
  backgroundKey: `${PLACEHOLDER_BG.key}_${index}`,
  backgroundUrl: PLACEHOLDER_BG.url,
  raw: level as unknown as LevelData,
}));

const HALLWAY_ENTRIES: LevelCatalogEntry[] = HALLWAY_LEVELS.map((level, index) => ({
  areaId: "hallway",
  backgroundKey: `${PLACEHOLDER_BG.key}_h_${index}`,
  backgroundUrl: PLACEHOLDER_BG.url,
  raw: level as unknown as LevelData,
}));

const KITCHEN_ENTRIES: LevelCatalogEntry[] = KITCHEN_LEVELS.map((level, index) => ({
  areaId: "kitchen",
  backgroundKey: `${PLACEHOLDER_BG.key}_k_${index}`,
  backgroundUrl: PLACEHOLDER_BG.url,
  raw: level as unknown as LevelData,
}));

const FAMILY_ROOM_ENTRIES: LevelCatalogEntry[] = FAMILY_ROOM_LEVELS.map((level, index) => ({
  areaId: "familyRoom",
  backgroundKey: `${PLACEHOLDER_BG.key}_f_${index}`,
  backgroundUrl: PLACEHOLDER_BG.url,
  raw: level as unknown as LevelData,
}));

const BACKYARD_ENTRIES: LevelCatalogEntry[] = BACKYARD_LEVELS.map((level, index) => ({
  areaId: "backyard",
  backgroundKey: `${PLACEHOLDER_BG.key}_b_${index}`,
  backgroundUrl: PLACEHOLDER_BG.url,
  raw: level as unknown as LevelData,
}));

export const LEVEL_CATALOG: LevelCatalogEntry[] = [...BEDROOM_ENTRIES, ...HALLWAY_ENTRIES, ...KITCHEN_ENTRIES, ...FAMILY_ROOM_ENTRIES, ...BACKYARD_ENTRIES];

export function getLevelEntry(index: number): LevelCatalogEntry | undefined {
  return LEVEL_CATALOG[index];
}

export function getNextLevelEntry(index: number): LevelCatalogEntry | undefined {
  return LEVEL_CATALOG[index + 1];
}
