/**
 * Blueprint mode — gameplay-first dev background.
 *
 * Replaces the bedroom illustrations while levels are being designed. Numbers
 * are tuned to the physics in `physics.ts`:
 *   - Max horizontal jump ≈ 120 design-px (~3.75 minor squares)
 *   - Max vertical apex   ≈ 80 design-px  (~2.5 minor squares)
 *   - Eloise body height  ≈ 30 design-px  (~1 minor square)
 *
 * One minor square = "is this within an Eloise body?" reference.
 * One major group (4 minor) = ~1.05 max-jumps — useful as a "just past max
 * jump reach" reference when laying out level chunks.
 */

import { DESIGN_FLOOR_Y } from "./backgrounds";
import { RENDER_SCALE } from "./game";

/** Toggle if we ever ship a "play mode" without grid. Stays on for now. */
export const BLUEPRINT_ENABLED = true;

/** Grid step in design-px (multiply by RENDER_SCALE at draw time). */
export const GRID_MINOR_STEP = 32;
export const GRID_MAJOR_EVERY = 4;
export const GRID_MAJOR_STEP = GRID_MINOR_STEP * GRID_MAJOR_EVERY;

/** Fill behind the grid — matches game canvas color for seamless edges. */
export const BLUEPRINT_FILL = 0x4a5560;

/** Line styling — slate-on-slate, low contrast so gameplay reads first. */
export const GRID_MINOR_COLOR = 0x6c7a85;
export const GRID_MINOR_ALPHA = 0.3;
export const GRID_MINOR_WIDTH = 1;

export const GRID_MAJOR_COLOR = 0x9ab0c0;
export const GRID_MAJOR_ALPHA = 0.55;
export const GRID_MAJOR_WIDTH = 1;

/** Floor reference line — warm tone so the ground plane pops at a glance. */
export const FLOOR_LINE_COLOR = 0xffc966;
export const FLOOR_LINE_ALPHA = 0.55;
export const FLOOR_LINE_WIDTH = 2;

/** Y in design-space where the main floor sits (re-exported for readability). */
export const FLOOR_LINE_Y_DESIGN = DESIGN_FLOOR_Y;
export const FLOOR_LINE_Y_RENDER = DESIGN_FLOOR_Y * RENDER_SCALE;

/** Depth slot — sits between the level fill and any gameplay entities. */
export const BLUEPRINT_DEPTH_FILL = -270;
export const BLUEPRINT_DEPTH_GRID = -260;
export const BLUEPRINT_DEPTH_FLOOR = -255;
