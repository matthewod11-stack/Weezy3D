import { KITCHEN_AREA } from "../design/levelSketches";
import { encodeAreaLevels } from "./encodeFromSketch";
import type { LevelData } from "../types/level";

/**
 * Kitchen levels — auto-generated from KITCHEN_AREA sketches via encodeFromSketch.
 * Each slot's B → A → A → C variants chain into one continuous level.
 *
 * Gates: wall-climb (Cat, met early) for the ascent; dash (Dog, from Hallway)
 * for the sink/stove leaps. Companion earned here: Cat (grants wall-climb).
 */
const SEGMENT_ORDER = ["B", "A", "A", "C"];

export const KITCHEN_LEVELS = encodeAreaLevels(KITCHEN_AREA, SEGMENT_ORDER) as LevelData[];
