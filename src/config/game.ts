/** Level data is authored at this size; scaled up for rendering. */
export const DESIGN_WIDTH = 320;
export const DESIGN_HEIGHT = 180;

/** Internal render multiplier — 2× canvas pixels for sharp FIT scaling on Retina/desktop. */
export const RENDER_SCALE = 2;

export const GAME_WIDTH = DESIGN_WIDTH * RENDER_SCALE;
export const GAME_HEIGHT = DESIGN_HEIGHT * RENDER_SCALE;

export const DEBUG_PHYSICS = false;

/** Look-ahead camera offset in pixels (movement direction). */
export const CAMERA_LOOK_AHEAD = 48 * RENDER_SCALE;
