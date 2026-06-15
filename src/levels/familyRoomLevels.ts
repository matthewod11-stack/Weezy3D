import { FAMILY_ROOM_AREA } from "../design/levelSketches";
import { encodeAreaLevels } from "./encodeFromSketch";
import type { LevelData } from "../types/level";

/**
 * Family Room levels — auto-generated from FAMILY_ROOM_AREA sketches via
 * encodeFromSketch. Each slot's B → A → A → C variants chain into one level.
 *
 * Gate: wall-climb (Cat, from the Kitchen) for the single finale couch-back,
 * which also gates the Horse pickup. Companion earned here: Horse (grants
 * charge — used in the Backyard, not here). Enemy-forward via carryover
 * (dust mites + returning dust bunnies/spiders/ants).
 */
const SEGMENT_ORDER = ["B", "A", "A", "C"];

export const FAMILY_ROOM_LEVELS = encodeAreaLevels(FAMILY_ROOM_AREA, SEGMENT_ORDER) as LevelData[];
