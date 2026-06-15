/** Texture keys for storybook-illustrated character sprites loaded as PNGs in BootScene. */

export const STORYBOOK_PREFIX = "sb_";

// Eloise — 8 frames total (idle + 6 walk + jump)
export const ELOISE_IDLE = `${STORYBOOK_PREFIX}eloise_idle`;
export const ELOISE_JUMP = `${STORYBOOK_PREFIX}eloise_jump`;
export const ELOISE_WALK_FRAMES = [0, 1, 2, 3, 4, 5].map(
  (i) => `${STORYBOOK_PREFIX}eloise_walk_${i}`,
);
export const ELOISE_WALK_ANIM = "anim_eloise_walk";

// Companions — 2 poses each (idle + walk), 2-frame alternating animation
export const TEDDY_IDLE = `${STORYBOOK_PREFIX}teddy_idle`;
export const TEDDY_WALK = `${STORYBOOK_PREFIX}teddy_walk`;
export const TEDDY_WALK_ANIM = "anim_teddy_walk";

export const DOG_IDLE = `${STORYBOOK_PREFIX}dog_idle`;
export const DOG_WALK = `${STORYBOOK_PREFIX}dog_walk`;

export const HORSE_IDLE = `${STORYBOOK_PREFIX}horse_idle`;
export const HORSE_WALK = `${STORYBOOK_PREFIX}horse_walk`;

export const CAT_IDLE = `${STORYBOOK_PREFIX}cat_idle`;
export const CAT_WALK = `${STORYBOOK_PREFIX}cat_walk`;

export const FLAMINGO_IDLE = `${STORYBOOK_PREFIX}flamingo_idle`;
export const FLAMINGO_WALK = `${STORYBOOK_PREFIX}flamingo_walk`;

// Enemies — 3-pose
export const DUSTBUNNY_IDLE = `${STORYBOOK_PREFIX}dustbunny_idle`;
export const DUSTBUNNY_WALK = `${STORYBOOK_PREFIX}dustbunny_walk`;
export const DUSTBUNNY_ATTACK = `${STORYBOOK_PREFIX}dustbunny_attack`;

export const SPIDER_IDLE = `${STORYBOOK_PREFIX}spider_idle`;
export const SPIDER_WALK = `${STORYBOOK_PREFIX}spider_walk`;
export const SPIDER_ATTACK = `${STORYBOOK_PREFIX}spider_attack`;

// Enemies — single-pose
export const ANT = `${STORYBOOK_PREFIX}ant`;
export const DUSTMITE = `${STORYBOOK_PREFIX}dustmite`;

// Boss
export const TREX_IDLE = `${STORYBOOK_PREFIX}trex_idle`;
export const TREX_WALK = `${STORYBOOK_PREFIX}trex_walk`;
export const TREX_ROAR = `${STORYBOOK_PREFIX}trex_roar`;

/**
 * Maps a level-data entity `type` to the texture keys it needs loaded.
 *
 * This is the seed of the future ENEMIES/COMPANIONS data table (audit Seam 1/3)
 * AND the source of truth for the boot/texture smoke test (Seam 4): when a new
 * enemy/companion type is added to the level schema, add it here too — the smoke
 * test then verifies its textures are actually loaded by BootScene. Keep the keys
 * in sync with STORYBOOK_KEYS / BootScene.preload().
 */
export const ENTITY_TEXTURE_KEYS: Record<string, readonly string[]> = {
  // Enemies
  dustBunny: [DUSTBUNNY_IDLE, DUSTBUNNY_WALK, DUSTBUNNY_ATTACK],
  spider: [SPIDER_IDLE, SPIDER_WALK, SPIDER_ATTACK],
  ant: [ANT],
  dustMite: [DUSTMITE],
  // Companions
  teddy: [TEDDY_IDLE, TEDDY_WALK],
  dog: [DOG_IDLE, DOG_WALK],
  cat: [CAT_IDLE, CAT_WALK],
  horse: [HORSE_IDLE, HORSE_WALK],
  flamingo: [FLAMINGO_IDLE, FLAMINGO_WALK],
};

/** All storybook texture keys — used to apply LINEAR filtering (not nearest-neighbor). */
export const STORYBOOK_KEYS = [
  ELOISE_IDLE,
  ELOISE_JUMP,
  ...ELOISE_WALK_FRAMES,
  TEDDY_IDLE,
  TEDDY_WALK,
  DOG_IDLE,
  DOG_WALK,
  HORSE_IDLE,
  HORSE_WALK,
  CAT_IDLE,
  CAT_WALK,
  FLAMINGO_IDLE,
  FLAMINGO_WALK,
  DUSTBUNNY_IDLE,
  DUSTBUNNY_WALK,
  DUSTBUNNY_ATTACK,
  SPIDER_IDLE,
  SPIDER_WALK,
  SPIDER_ATTACK,
  ANT,
  DUSTMITE,
  TREX_IDLE,
  TREX_WALK,
  TREX_ROAR,
];
