import { combineSlot } from "../design/combineSlot";
import type { Area, LevelSlot, EnemyType, CompanionType } from "../design/levelSketches";
import { DESIGN_FLOOR_Y } from "../config/backgrounds";

/**
 * Converts sketch grid coords (y=0 floor, +y up) into game LevelData
 * (y=DESIGN_FLOOR_Y floor, +y down). Single source of truth for level data
 * lives in `src/design/levelSketches.ts`; this file just translates.
 *
 * Sketch units are 32 design-px grid squares ≈ one Eloise body height.
 */

const GRID_PX = 32;
const PLATFORM_THICKNESS = 14;
const FLOOR_THICKNESS = 32;
const KILL_Y = 240;
const EXIT_W = 40;
const EXIT_H = 52;

/** Empirical anchor offsets that match the existing entity-rendering origins. */
const TOKEN_Y_OFFSET = 16; // tokens float mid-grid-cell
const COMPANION_Y_OFFSET = 22; // slightly higher so feet sit on the platform top

/** Maps the design EnemyType (snake_case) to the runtime LevelData enemy type
 *  (camelCase). The boss area's slot has empty `options`, so it's filtered out
 *  before encoding ever runs — `trex` is never a real lookup here. The `trex`
 *  key exists only to satisfy `Record<EnemyType, ...>` exhaustiveness; two
 *  guards ensure it's never hit: `"trex"` on `primaryEnemy` is caught by the
 *  function-entry guard, and `"trex"` on a per-zone `enemyType` override is
 *  caught inside the enemies `.map`. */
const ENEMY_RUNTIME_TYPE: Record<EnemyType, "dustBunny" | "spider" | "ant" | "dustMite"> = {
  dust_bunny: "dustBunny",
  spider: "spider",
  ant: "ant",
  dust_mite: "dustMite",
  trex: "dustBunny",
};

interface SketchSlotForEncoding {
  id: number;
  name: string;
  intent: string;
  options: LevelSlot["options"];
}

/**
 * Encodes one slot's combined level into a game-format LevelData object.
 * Pass the slot directly; the function chains its variants per `order` and
 * translates the resulting CombinedLevel into design-pixel coords.
 */
export function encodeSlotToLevelData(
  slot: SketchSlotForEncoding,
  order: string[],
  idPrefix: string,
  primaryEnemy: EnemyType,
  companionType: CompanionType | null,
): unknown {
  if (primaryEnemy === "trex") {
    throw new Error("T-Rex is a set-piece boss — not encodable via the slot pipeline");
  }

  const combined = combineSlot(slot, order);

  // ── Spawn ────────────────────────────────────────────────────────────
  const spawn = {
    x: combined.spawn.x * GRID_PX + GRID_PX / 2,
    y: DESIGN_FLOOR_Y - combined.spawn.y * GRID_PX,
  };

  // ── Bounds ───────────────────────────────────────────────────────────
  // Vertical room: one extra grid above the tallest platform plus a small buffer.
  const minY = -(combined.heightGrids + 1) * GRID_PX - 16;
  const bounds = {
    minX: 0,
    maxX: combined.widthGrids * GRID_PX,
    minY,
    maxY: 200,
  };

  // ── Floor segments (broken by pits) ──────────────────────────────────
  const platforms: Array<{ x: number; y: number; w: number; h: number; color?: string; requires?: "dash" }> = [];
  const sortedPits = combined.pits.slice().sort((a, b) => a.x - b.x);
  let floorCursor = 0;
  for (const pit of sortedPits) {
    if (pit.x > floorCursor) {
      platforms.push({
        x: floorCursor * GRID_PX,
        y: DESIGN_FLOOR_Y,
        w: (pit.x - floorCursor) * GRID_PX,
        h: FLOOR_THICKNESS,
        color: "#d4a574",
      });
    }
    floorCursor = pit.x + pit.w;
  }
  if (floorCursor < combined.widthGrids) {
    platforms.push({
      x: floorCursor * GRID_PX,
      y: DESIGN_FLOOR_Y,
      w: (combined.widthGrids - floorCursor) * GRID_PX,
      h: FLOOR_THICKNESS,
      color: "#d4a574",
    });
  }

  // ── Floating platforms ───────────────────────────────────────────────
  for (const p of combined.platforms) {
    platforms.push({
      x: p.x * GRID_PX,
      y: DESIGN_FLOOR_Y - p.y * GRID_PX - PLATFORM_THICKNESS,
      w: p.w * GRID_PX,
      h: PLATFORM_THICKNESS,
      color: "#e8c9a0",
      ...(p.requires ? { requires: p.requires } : {}),
    });
  }

  // ── Climb walls (vertical climbable faces; wall-climb element) ────────
  const climbWalls = combined.climbWalls.map((c) => ({
    x: c.x * GRID_PX,
    y: DESIGN_FLOOR_Y - (c.y + c.h) * GRID_PX,
    w: (c.w ?? 1) * GRID_PX,
    h: c.h * GRID_PX,
  }));

  // ── Breakables (solid charge barricades; grid → design top-left) ──────
  const breakables = combined.breakables.map((b) => ({
    x: b.x * GRID_PX,
    y: DESIGN_FLOOR_Y - (b.y + b.h) * GRID_PX,
    w: b.w * GRID_PX,
    h: b.h * GRID_PX,
  }));

  // ── Tokens ───────────────────────────────────────────────────────────
  const tokens = combined.zones
    .filter((z) => z.kind === "token")
    .map((z) => ({
      x: z.x * GRID_PX + GRID_PX / 2,
      y: DESIGN_FLOOR_Y - z.y * GRID_PX - TOKEN_Y_OFFSET,
    }));

  // ── Enemies ──────────────────────────────────────────────────────────
  const enemyZones = combined.zones.filter((z) => z.kind === "enemy");
  const enemies = enemyZones.map((z) => {
    // Per-zone enemyType overrides the area's primary enemy; falls back to it.
    const resolvedType = z.enemyType ?? primaryEnemy;
    if (resolvedType === "trex") {
      throw new Error("T-Rex is a set-piece boss — not placeable as a patrol enemy zone");
    }

    const enemyX = z.x * GRID_PX + GRID_PX / 2;
    // Standing surface y: floor if z.y === 0, else platform top at z.y.
    const standingY = z.y === 0 ? DESIGN_FLOOR_Y : DESIGN_FLOOR_Y - z.y * GRID_PX;

    // Auto-detect patrol bounds. If the enemy is on a platform, bound to it.
    // If on the floor, give 2-grid radius and clamp to nearest pit / level edge.
    const patrolBounds = derivePatrolBounds(z.x, z.y, combined.platforms, sortedPits, combined.widthGrids);

    return {
      type: ENEMY_RUNTIME_TYPE[resolvedType],
      x: enemyX,
      y: standingY,
      patrolLeft: patrolBounds.left * GRID_PX,
      patrolRight: patrolBounds.right * GRID_PX,
      speed: 45,
    };
  });

  // ── Companion ────────────────────────────────────────────────────────
  const companionZone = combined.zones.find((z) => z.kind === "companion");
  const companion = companionZone && companionType
    ? {
        type: companionType,
        x: companionZone.x * GRID_PX + GRID_PX / 2,
        y: DESIGN_FLOOR_Y - companionZone.y * GRID_PX - COMPANION_Y_OFFSET,
      }
    : undefined;

  // ── Exit zone (hovers above its surface; y honors sketch height) ──────
  const exit = {
    x: combined.exit.x * GRID_PX,
    y: DESIGN_FLOOR_Y - combined.exit.y * GRID_PX - EXIT_H + 4,
    w: EXIT_W,
    h: EXIT_H,
  };

  return {
    id: `${idPrefix}-${slot.id}`,
    name: slot.name,
    spawn,
    killY: KILL_Y,
    bounds,
    platforms,
    ...(climbWalls.length ? { climbWalls } : {}),
    ...(breakables.length ? { breakables } : {}),
    enemies,
    tokens,
    exit,
    ...(companion ? { companion } : {}),
  };
}

/** Encode every slot in an area to game-format LevelData. */
export function encodeAreaLevels(area: Area, order: string[]): unknown[] {
  const idPrefix = area.name.toLowerCase().replace(/\s+/g, "-");
  return area.slots
    .filter((s) => s.options.length > 0)
    .map((slot) => encodeSlotToLevelData(slot, order, idPrefix, area.primaryEnemy, area.companion));
}

/**
 * Patrol-bounds heuristic in sketch-grid coords. If the enemy sits on a
 * platform, bound to that platform's edges (minus a small margin so the
 * enemy turns around before falling off). Otherwise it's on the floor:
 * default 2-grid radius, clamped by nearest pit and level edges.
 */
function derivePatrolBounds(
  enemyX: number,
  enemyY: number,
  platforms: { x: number; y: number; w: number }[],
  pits: { x: number; w: number }[],
  levelWidth: number,
): { left: number; right: number } {
  if (enemyY > 0) {
    // On a platform — find which one and bound to it.
    const platform = platforms.find(
      (p) => p.y === enemyY && p.x <= enemyX && p.x + p.w >= enemyX,
    );
    if (platform) {
      return { left: platform.x + 0.25, right: platform.x + platform.w - 0.25 };
    }
    // Couldn't find a matching platform (likely a level-design oversight) —
    // fall back to small radius around the enemy x.
    return { left: enemyX - 1, right: enemyX + 1 };
  }

  // On the floor. Default 2-grid radius, clamped by pits + level edges.
  let left = Math.max(0.5, enemyX - 2);
  let right = Math.min(levelWidth - 0.5, enemyX + 2);

  for (const pit of pits) {
    const pitLeft = pit.x;
    const pitRight = pit.x + pit.w;
    // If pit is to the LEFT of enemy and overlaps with patrol-left, push patrol-left to pit's right edge.
    if (pitRight <= enemyX && pitRight > left) {
      left = pitRight + 0.25;
    }
    // If pit is to the RIGHT of enemy and overlaps with patrol-right, pull patrol-right to pit's left edge.
    if (pitLeft >= enemyX && pitLeft < right) {
      right = pitLeft - 0.25;
    }
  }

  return { left, right };
}
