import { BACKYARD_AREA } from "../design/levelSketches";
import { encodeAreaLevels } from "./encodeFromSketch";
import type { LevelData } from "../types/level";

/**
 * Backyard levels — auto-generated from BACKYARD_AREA sketches via
 * encodeFromSketch. Each slot's B → A → A → C variants chain into one level.
 *
 * Gate: charge (Horse, from the Family Room) for the hedge/fence barricades.
 * In-area power: glide (Flamingo, metAtStart) — the windowsill entrance, the
 * kiddie-pool gap, and the treehouse finale. Enemy-forward via carryover
 * (ants + returning spiders/dust bunnies/dust mites).
 */
const SEGMENT_ORDER = ["B", "A", "A", "C"];

export const BACKYARD_LEVELS = encodeAreaLevels(BACKYARD_AREA, SEGMENT_ORDER) as LevelData[];
