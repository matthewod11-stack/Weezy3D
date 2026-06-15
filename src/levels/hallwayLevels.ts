import { HALLWAY_AREA } from "../design/levelSketches";
import { encodeAreaLevels } from "./encodeFromSketch";
import type { LevelData } from "../types/level";

/**
 * Hallway levels — auto-generated from the sketches in
 * `src/design/levelSketches.ts` (HALLWAY_AREA) via `encodeFromSketch.ts`.
 * Each slot's B → A → A → C variants chain into one continuous level.
 *
 * Gate: double-jump (earned from Teddy in the Bedroom). Mandatory at slots 4–5.
 * Companion earned here: Dog (grants dash, which gates the Kitchen).
 */
const SEGMENT_ORDER = ["B", "A", "A", "C"];

export const HALLWAY_LEVELS = encodeAreaLevels(HALLWAY_AREA, SEGMENT_ORDER) as LevelData[];
