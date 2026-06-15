import { BEDROOM_AREA } from "../design/levelSketches";
import { encodeAreaLevels } from "./encodeFromSketch";

/**
 * Bedroom levels — auto-generated from the sketches in
 * `src/design/levelSketches.ts` via the encoder in `encodeFromSketch.ts`.
 *
 * Each slot's B → A → A → C variants are chained into one continuous level.
 * Edit the sketches and the page hot-reloads with new coordinates.
 */

const SEGMENT_ORDER = ["B", "A", "A", "C"];

export const BEDROOM_LEVELS = encodeAreaLevels(BEDROOM_AREA, SEGMENT_ORDER);
