/**
 * Bedroom story art — side-view illustrations aligned with level scroll.
 * Vite resolves these to URLs for Phaser Loader.
 */
import bgBookshelfLower from "../../assets/backgrounds/World1_Bedroom/1-1_bookshelf_lower.png?url";
import bgBookshelfClimb from "../../assets/backgrounds/World1_Bedroom/1-2_bookshelf_climb.png?url";
import bgCribCrossing from "../../assets/backgrounds/World1_Bedroom/1-3_crib_crossing.png?url";
import bgEloiseCorner from "../../assets/backgrounds/World1_Bedroom/1-4_eloise_corner.png?url";
import { RENDER_SCALE } from "./game";

export const LEVEL_BACKGROUND_KEYS = [
  "bg_bedroom_0",
  "bg_bedroom_1",
  "bg_bedroom_2",
  "bg_bedroom_3",
] as const;

export const LEVEL_BACKGROUND_URLS: Record<
  (typeof LEVEL_BACKGROUND_KEYS)[number],
  string
> = {
  bg_bedroom_0: bgBookshelfLower,
  bg_bedroom_1: bgBookshelfClimb,
  bg_bedroom_2: bgCribCrossing,
  bg_bedroom_3: bgEloiseCorner,
};

/** Slight overscan on display size to hide sub-pixel seams at edges. */
export const BACKGROUND_SCALE_BLEED = 1.01;

/** Extra design px past bounds for camera overscroll at level exits. */
export const BACKGROUND_EDGE_BLEED = 120;

/** Fallback fill behind illustrations (matches typical art edge tone, not tan). */
export const BACKGROUND_FILL_COLOR = 0x5a6670;

/** Design pixels of sky/ceiling above the floor line (bounds minY). */
export const LEVEL_HEADROOM = 140;

/**
 * Y in source art (0 = top, 1 = bottom) where carpet meets shelf floor.
 * Anchoring here aligns illustration with platform y=DESIGN_FLOOR_Y.
 */
export const BACKGROUND_ART_FLOOR = 0.84;

/** Design-space y for main floor platform tops across bedroom/hallway levels. */
export const DESIGN_FLOOR_Y = 168;

/** Render-space floor line for background + camera framing. */
export const RENDER_FLOOR_Y = DESIGN_FLOOR_Y * RENDER_SCALE;

/** Camera looks this many px above the follow target (shows shelves, not carpet). */
export const CAMERA_LOOK_UP = 56 * RENDER_SCALE;
