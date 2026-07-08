import { BEDROOM_AREA } from "../design/levelSketches";
import { encodeAreaLevels } from "./encodeFromSketch";

/**
 * Bedroom levels — auto-generated from the sketches in
 * `src/design/levelSketches.ts` via the encoder in `encodeFromSketch.ts`.
 *
 * Each slot's B → C variants are chained into one continuous level (2026-07-08
 * playtest: the original B-A-A-C chain ran 125 tokens across the stitched
 * world and felt too long; dropping the practice-repeat "A" beat keeps the
 * warmup + twist pacing while halving length — token density within B and C
 * is untouched, so this doesn't thin the spread, it just runs less of it).
 * Edit the sketches and the page hot-reloads with new coordinates.
 */

const SEGMENT_ORDER = ["B", "C"];

export const BEDROOM_LEVELS = encodeAreaLevels(BEDROOM_AREA, SEGMENT_ORDER);
