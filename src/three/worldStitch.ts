import type { LevelCatalogEntry } from "../levels/levelCatalog";
import type { LevelData, PlatformDef } from "../types/level";
import type { AreaId } from "../config/areas";

/**
 * World stitcher — turns a world's N catalog levels into ONE continuous
 * LevelData ("true continuous worlds", 2026-06-10 playtest decision).
 *
 * Pure data transform, same pattern as physics3d: no Three.js, no DOM.
 * Works in whatever px space the inputs are in (design or render) since it
 * only offsets x values. The 2D game and the sketch pipeline are untouched —
 * this is a load-time view over the same source of truth.
 *
 * Semantics:
 * - Level i is shifted right by the cumulative width of levels 0..i-1.
 * - Intermediate exit doors are dropped; only the last level's exit remains.
 * - Flush same-row floor rects are coalesced across seams so there is no
 *   physics seam to snag on.
 * - Each input level becomes a `WorldSegment` whose (offset) spawn is the
 *   pit-death checkpoint for that stretch of the world.
 * - The single `companion` (one per world) is preserved, offset into stitched
 *   x space; the first level that declares one wins.
 */

export interface WorldSegment {
  id: string;
  name: string;
  /** Inclusive start of this segment in stitched x space. */
  startX: number;
  /** Exclusive end — equals the next segment's startX. */
  endX: number;
  /** Respawn checkpoint (the segment's original spawn, offset). */
  spawn: { x: number; y: number };
}

export interface StitchedWorld {
  level: LevelData;
  segments: WorldSegment[];
}

export interface WorldEntry {
  areaId: AreaId;
  entries: LevelCatalogEntry[];
  /** Index of this world's first level in the flat LEVEL_CATALOG. */
  firstIndex: number;
}

const SEAM_EPSILON = 0.01;

export function stitchLevels(
  levels: LevelData[],
  worldId: string,
  worldName: string,
): StitchedWorld {
  if (levels.length === 0) {
    throw new Error("stitchLevels: need at least one level");
  }

  const segments: WorldSegment[] = [];
  const platforms: LevelData["platforms"] = [];
  const tokens: LevelData["tokens"] = [];
  const enemies: LevelData["enemies"] = [];
  const climbWalls: NonNullable<LevelData["climbWalls"]> = [];
  const breakables: NonNullable<LevelData["breakables"]> = [];
  let offset = 0;
  let companion: LevelData["companion"] | undefined;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let killY = Number.NEGATIVE_INFINITY;

  for (const level of levels) {
    const shift = offset - level.bounds.minX;
    const width = level.bounds.maxX - level.bounds.minX;

    for (const p of level.platforms) platforms.push({ ...p, x: p.x + shift });
    for (const t of level.tokens) tokens.push({ x: t.x + shift, y: t.y });
    for (const e of level.enemies) {
      enemies.push({
        ...e,
        x: e.x + shift,
        patrolLeft: e.patrolLeft + shift,
        patrolRight: e.patrolRight + shift,
      });
    }
    for (const c of level.climbWalls ?? []) climbWalls.push({ ...c, x: c.x + shift });
    for (const b of level.breakables ?? []) breakables.push({ ...b, x: b.x + shift });

    if (!companion && level.companion) {
      companion = { ...level.companion, x: level.companion.x + shift };
    } else if (companion && level.companion) {
      console.warn(
        `worldStitch: duplicate companion in level "${level.id}" — first wins, this one ignored.`,
      );
    }

    segments.push({
      id: level.id,
      name: level.name,
      startX: offset,
      endX: offset + width,
      spawn: { x: level.spawn.x + shift, y: level.spawn.y },
    });

    minY = Math.min(minY, level.bounds.minY);
    maxY = Math.max(maxY, level.bounds.maxY);
    killY = Math.max(killY, level.killY);
    offset += width;
  }

  const last = levels[levels.length - 1]!;
  const lastShift = segments[segments.length - 1]!.startX - last.bounds.minX;

  const level: LevelData = {
    id: worldId,
    name: worldName,
    spawn: { ...segments[0]!.spawn },
    killY,
    bounds: { minX: 0, maxX: offset, minY, maxY },
    platforms: coalesceFlushRows(platforms),
    ...(climbWalls.length ? { climbWalls } : {}),
    ...(breakables.length ? { breakables } : {}),
    ...(companion ? { companion } : {}),
    enemies,
    tokens,
    exit: { ...last.exit, x: last.exit.x + lastShift },
  };

  return { level, segments };
}

/**
 * Merge platforms that sit in the same row (same y, same h, same `requires`
 * gate) and touch edge-to-edge. Eliminates the floor seam where one level's
 * trailing floor meets the next level's leading floor.
 */
function coalesceFlushRows(platforms: LevelData["platforms"]): LevelData["platforms"] {
  const rows = new Map<string, PlatformDef[]>();
  for (const p of platforms) {
    const key = `${p.y}:${p.h}:${p.requires ?? ""}`;
    const row = rows.get(key);
    if (row) row.push(p);
    else rows.set(key, [p]);
  }

  const merged: PlatformDef[] = [];
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    let current = { ...row[0]! };
    for (const next of row.slice(1)) {
      if (next.x - (current.x + current.w) <= SEAM_EPSILON) {
        current.w = next.x + next.w - current.x;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
  }

  merged.sort((a, b) => a.x - b.x || a.y - b.y);
  return merged;
}

/** First segment whose end lies beyond x; clamps to the last segment. */
export function segmentAt(segments: WorldSegment[], x: number): WorldSegment {
  for (const seg of segments) {
    if (x < seg.endX) return seg;
  }
  return segments[segments.length - 1]!;
}

/** Group the flat 25-level catalog into contiguous per-area worlds. */
export function groupCatalogByArea(catalog: LevelCatalogEntry[]): WorldEntry[] {
  const worlds: WorldEntry[] = [];
  catalog.forEach((entry, index) => {
    const current = worlds[worlds.length - 1];
    if (!current || current.areaId !== entry.areaId) {
      worlds.push({ areaId: entry.areaId, entries: [entry], firstIndex: index });
    } else {
      current.entries.push(entry);
    }
  });
  return worlds;
}
