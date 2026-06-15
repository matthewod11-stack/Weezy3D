import type {
  LevelOption,
  LevelSlot,
  SketchBreakable,
  SketchClimbWall,
  SketchPit,
  SketchPlatform,
  SketchZone,
} from "./levelSketches";

/** A segment within a chained level — keeps source/variant info for the maps view. */
export type CombinedSegment = {
  variant: string;
  source: string;
  /** Left edge of this segment within the combined level (grid units). */
  startX: number;
  widthGrids: number;
  approxSeconds: number;
};

/** A whole level composed by chaining a slot's options end-to-end. */
export type CombinedLevel = {
  slotId: number;
  slotName: string;
  intent: string;
  segments: CombinedSegment[];
  approxSeconds: number;
  widthGrids: number;
  heightGrids: number;
  /** Overall level spawn — taken from segment A. */
  spawn: { x: number; y: number };
  /** Overall level exit — segment C's exit offset to combined coords. */
  exit: { x: number; y: number };
  platforms: SketchPlatform[];
  zones: SketchZone[];
  pits: SketchPit[];
  climbWalls: SketchClimbWall[];
  breakables: SketchBreakable[];
};

/**
 * Chains a slot's options into one continuous level following the given
 * variant order (default: as declared in the slot). Intermediate exits/spawns
 * are dropped — only the first segment's spawn and last segment's exit are kept.
 *
 * Repeating a variant is allowed (e.g., B-A-A-C): the segment is laid down
 * twice with its coordinates re-offset. Companions are de-duplicated so a
 * repeated variant doesn't accidentally spawn two Teddies — only the LAST
 * occurrence's companion zones are retained.
 */
export function combineSlot(slot: LevelSlot, order?: string[]): CombinedLevel {
  const variantSequence = order ?? slot.options.map((o) => o.variant);

  const segments: CombinedSegment[] = [];
  const platforms: SketchPlatform[] = [];
  const zones: SketchZone[] = [];
  const pits: SketchPit[] = [];
  const climbWalls: SketchClimbWall[] = [];
  const breakables: SketchBreakable[] = [];

  let xCursor = 0;
  let maxHeight = 0;
  let totalSeconds = 0;

  // Pre-scan: total occurrences of each variant. If >1, label segments with suffix.
  const totalOccurrences = new Map<string, number>();
  for (const v of variantSequence) {
    totalOccurrences.set(v, (totalOccurrences.get(v) ?? 0) + 1);
  }
  const occurrenceCounter = new Map<string, number>();

  let lastValidOpt: LevelOption | undefined;
  let lastValidOffset = 0;

  for (let i = 0; i < variantSequence.length; i += 1) {
    const v = variantSequence[i] as string;
    const opt = slot.options.find((o) => o.variant === v);
    if (!opt) continue;

    const occIdx = (occurrenceCounter.get(v) ?? 0) + 1;
    occurrenceCounter.set(v, occIdx);
    const total = totalOccurrences.get(v) ?? 1;
    const segLabel = total > 1 ? `${v}·${occIdx}` : v;

    segments.push({
      variant: segLabel,
      source: opt.source,
      startX: xCursor,
      widthGrids: opt.widthGrids,
      approxSeconds: opt.approxSeconds,
    });

    for (const p of opt.platforms) {
      platforms.push({
        x: p.x + xCursor,
        y: p.y,
        w: p.w,
        ...(p.requires ? { requires: p.requires } : {}),
      });
    }
    for (const z of opt.zones) {
      zones.push({
        x: z.x + xCursor,
        y: z.y,
        kind: z.kind,
        label: z.label,
        ...(z.enemyType ? { enemyType: z.enemyType } : {}),
      });
    }
    for (const pit of opt.pits ?? []) {
      pits.push({ x: pit.x + xCursor, w: pit.w });
    }
    for (const c of opt.climbWalls ?? []) {
      climbWalls.push({ ...c, x: c.x + xCursor });
    }
    for (const b of opt.breakables ?? []) {
      breakables.push({ ...b, x: b.x + xCursor });
    }
    maxHeight = Math.max(maxHeight, opt.heightGrids);
    totalSeconds += opt.approxSeconds;
    lastValidOpt = opt;
    lastValidOffset = xCursor;
    xCursor += opt.widthGrids;
  }

  // Keep only the rightmost companion. Variants A and C of slot 5 both define
  // a Teddy pickup; chaining them would spawn two without this filter.
  const companions = zones.filter((z) => z.kind === "companion");
  if (companions.length > 1) {
    let rightmost = companions[0]!;
    for (const c of companions) {
      if (c.x > rightmost.x) rightmost = c;
    }
    const nonCompanions = zones.filter((z) => z.kind !== "companion");
    zones.length = 0;
    zones.push(...nonCompanions, rightmost);
  }

  const firstVariant = variantSequence[0];
  const firstOpt = firstVariant
    ? slot.options.find((o) => o.variant === firstVariant)
    : undefined;
  const fallbackSpawn = firstOpt?.spawn ?? { x: 1, y: 0 };

  const exit = lastValidOpt
    ? { x: lastValidOpt.exit.x + lastValidOffset, y: lastValidOpt.exit.y }
    : { x: xCursor - 1, y: 0 };

  return {
    slotId: slot.id,
    slotName: slot.name,
    intent: slot.intent,
    segments,
    widthGrids: xCursor,
    heightGrids: maxHeight,
    approxSeconds: totalSeconds,
    spawn: fallbackSpawn,
    exit,
    platforms,
    zones,
    pits,
    climbWalls,
    breakables,
  };
}
