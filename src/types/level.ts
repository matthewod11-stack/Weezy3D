import { z } from "zod";

export const Vec2Schema = z.object({
  x: z.number(),
  y: z.number(),
});

/** Must stay in sync with AbilityId in src/config/abilities.ts. */
export const AbilityIdSchema = z.enum([
  "doubleJump",
  "dash",
  "wallClimb",
  "charge",
  "glide",
]);

export const PlatformSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  color: z.string().optional(),
  /** Traversal-power gate: reaching this platform may use the named ability's
   *  special edge (e.g. a dash across a too-wide gap). Validated for backward
   *  dependencies by the catalog ordering test, not here. */
  requires: AbilityIdSchema.optional(),
});

/** A non-solid climbable zone (wall-climb element). The player ascends it while
 *  holding the power button; reachability connects surfaces that both touch it. */
export const ClimbWallSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

/** A solid barricade the player smashes with charge. Blocks the edge between the
 *  surfaces it sits between (reachability) until charge clears it; GameScene
 *  builds it as a solid body and destroys it on smash. */
export const BreakableSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

export const EnemySpawnSchema = z.object({
  type: z.enum(["dustBunny", "spider", "ant", "dustMite"]),
  x: z.number(),
  y: z.number(),
  patrolLeft: z.number(),
  patrolRight: z.number(),
  speed: z.number().positive().default(40),
});

export const TokenSpawnSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const ExitSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

export const LevelDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  spawn: Vec2Schema,
  /** Y coordinate below which player respawns at spawn. */
  killY: z.number(),
  /** Camera / world bounds: minX, maxX (width derived from maxX - minX or explicit). */
  bounds: z.object({
    minX: z.number(),
    maxX: z.number(),
    minY: z.number(),
    maxY: z.number(),
  }),
  platforms: z.array(PlatformSchema).min(1),
  // Optional (most levels have none) — kept out of the inferred-required set so
  // hand-authored level literals needn't all carry an empty array. Consumers
  // guard with `?? []`.
  climbWalls: z.array(ClimbWallSchema).optional(),
  // Optional like climbWalls — most levels have none; consumers guard with `?? []`.
  breakables: z.array(BreakableSchema).optional(),
  enemies: z.array(EnemySpawnSchema).default([]),
  tokens: z.array(TokenSpawnSchema).default([]),
  exit: ExitSchema,
  companion: z
    .object({
      type: z.enum(["teddy", "dog", "cat", "horse", "flamingo"]),
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

export type LevelData = z.infer<typeof LevelDataSchema>;
export type PlatformDef = z.infer<typeof PlatformSchema>;
export type ClimbWallDef = z.infer<typeof ClimbWallSchema>;
export type BreakableDef = z.infer<typeof BreakableSchema>;
export type EnemySpawn = z.infer<typeof EnemySpawnSchema>;
export type TokenSpawn = z.infer<typeof TokenSpawnSchema>;

export function parseLevelData(raw: unknown): LevelData {
  return LevelDataSchema.parse(raw);
}

/** Scale authored level coords (320×180 space) to render resolution. */
export function scaleLevelData(data: LevelData, factor: number): LevelData {
  if (factor === 1) {
    return data;
  }
  const m = (n: number) => n * factor;
  return {
    ...data,
    spawn: { x: m(data.spawn.x), y: m(data.spawn.y) },
    killY: m(data.killY),
    bounds: {
      minX: m(data.bounds.minX),
      maxX: m(data.bounds.maxX),
      minY: m(data.bounds.minY),
      maxY: m(data.bounds.maxY),
    },
    platforms: data.platforms.map((p) => ({
      ...p,
      x: m(p.x),
      y: m(p.y),
      w: m(p.w),
      h: m(p.h),
    })),
    climbWalls: data.climbWalls?.map((c) => ({ x: m(c.x), y: m(c.y), w: m(c.w), h: m(c.h) })),
    breakables: data.breakables?.map((b) => ({ x: m(b.x), y: m(b.y), w: m(b.w), h: m(b.h) })),
    enemies: data.enemies.map((e) => ({
      ...e,
      x: m(e.x),
      y: m(e.y),
      patrolLeft: m(e.patrolLeft),
      patrolRight: m(e.patrolRight),
      speed: e.speed * factor,
    })),
    tokens: data.tokens.map((t) => ({ x: m(t.x), y: m(t.y) })),
    exit: {
      x: m(data.exit.x),
      y: m(data.exit.y),
      w: m(data.exit.w),
      h: m(data.exit.h),
    },
    companion: data.companion
      ? {
          ...data.companion,
          x: m(data.companion.x),
          y: m(data.companion.y),
        }
      : undefined,
  };
}
