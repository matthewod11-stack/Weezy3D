/**
 * Reachability lint — the Seam 2 guardrail (physics ↔ level geometry).
 *
 * Pure, Phaser-free, operates in DESIGN-px space (the un-scaled space levels
 * are authored in). The jump envelope is derived from src/config/physics.ts so
 * that retuning the physics automatically moves the envelope these checks use.
 */

import { PHYSICS } from "../config/physics";
import { RENDER_SCALE } from "../config/game";
import { ABILITIES, type AbilityId } from "../config/abilities";

export interface JumpEnvelope {
  /** Max height (design-px) the player rises on a full jump. */
  maxApex: number;
  /** Max horizontal distance (design-px) of a full-speed flat jump. */
  maxFlatGap: number;
  /** Full ground launch speed (design-px/s). */
  speed: number;
  /** Time (s) from launch to apex. */
  tUp: number;
  /** Falling-band gravity (design-px/s²). */
  gravDown: number;
  /** Constant glide descent speed (design-px/s); present only when glide is unlocked. */
  glideFallSpeed?: number;
  /** Flat horizontal dash distance (design-px); present only when dash is unlocked. */
  dashDistance?: number;
}

/** A walkable platform top, in DESIGN-px. `topY` is the surface y (smaller = higher). */
export interface Surface {
  left: number;
  right: number;
  topY: number;
  /** Traversal gate carried from the platform: the special edge that reaches
   *  THIS surface (e.g. a dash gap) is available only when `requires` is unlocked. */
  requires?: AbilityId;
}

/**
 * Physics constants re-expressed in DESIGN-px space. Every PHYSICS value is
 * authored as `literal × RENDER_SCALE`, so dividing by RENDER_SCALE recovers
 * the design-space figure the levels are authored in. Velocities and
 * accelerations both scale by RENDER_SCALE; time is unaffected.
 */
function designPhysics() {
  const S = RENDER_SCALE;
  return {
    speed: PHYSICS.SPEED / S,
    airMult: PHYSICS.AIR_SPEED_MULT,
    jumpV: Math.abs(PHYSICS.JUMP_VELOCITY) / S,
    gravUp: PHYSICS.GRAVITY_UP / S,
    gravApex: PHYSICS.GRAVITY_APEX / S,
    gravDown: PHYSICS.GRAVITY_DOWN / S,
    apexThreshold: PHYSICS.APEX_VY_THRESHOLD / S,
  };
}

export function jumpEnvelope(abilities: Set<AbilityId> = new Set()): JumpEnvelope {
  const P = designPhysics();
  const v0 = P.jumpV;
  const vt = P.apexThreshold;

  const baseApex = (v0 * v0 - vt * vt) / (2 * P.gravUp) + (vt * vt) / (2 * P.gravApex);
  const baseTUp = (v0 - vt) / P.gravUp + vt / P.gravApex;

  // Double jump: each extra jump adds a full rise + apex.
  const jumps = 1 + (abilities.has("doubleJump") ? (ABILITIES.doubleJump.envelope?.extraJumps ?? 0) : 0);
  const maxApex = baseApex * jumps;
  const tUp = baseTUp * jumps;

  // Glide (Phase 2): a parachute CLAMP, not changed gravity — base gravDown is
  // unchanged. When unlocked, expose glideFallSpeed so canReach can model the
  // gentle constant-speed descent. Value is design-px/s (un-scaled), TDD-pinned.
  const gravDown = P.gravDown;
  const glideFallSpeed = abilities.has("glide")
    ? ABILITIES.glide.envelope?.glideFallSpeed
    : undefined;

  // Dash (Phase 3, traversal): a flat gravity-suspended lunge. Distance is
  // derived from the SAME two constants the Player uses (dashSpeed × duration),
  // in design-space. Present only when dash is unlocked. TDD-pinned.
  const dash = abilities.has("dash") ? ABILITIES.dash.traversal : undefined;
  const dashDistance =
    dash?.dashSpeed !== undefined && dash?.dashDurationMs !== undefined
      ? dash.dashSpeed * (dash.dashDurationMs / 1000)
      : undefined;

  const tDown = Math.sqrt((2 * maxApex) / gravDown);
  const maxFlatGap = P.speed * (tUp + tDown);

  return { maxApex, maxFlatGap, speed: P.speed, tUp, gravDown, glideFallSpeed, dashDistance };
}

/**
 * Can the player jump from surface `from` onto surface `to`?
 *
 * Models a single jump launched from the edge of `from` nearest `to` at full
 * speed. `margin` (0–1) shrinks the usable envelope to demand a comfort buffer
 * — 1 = exact physical limit, lower = more forgiving level design required.
 */
export function canReach(
  from: Surface,
  to: Surface,
  env: JumpEnvelope,
  margin = 1,
): boolean {
  const d = from.topY - to.topY; // + = `to` is higher than `from`

  // Can't rise above the apex. The margin shrinks the usable climb height.
  if (d > env.maxApex * margin) return false;

  // Horizontal empty space between the nearest edges (0 if they overlap).
  let gap: number;
  if (to.left > from.right) gap = to.left - from.right; // `to` is to the right
  else if (from.left > to.right) gap = from.left - to.right; // `to` is to the left
  else gap = 0;
  if (gap <= 0) return true; // overlapping column; climb already cleared above

  // Dash edge (traversal): if `to` is a dash-tagged platform at equal-or-lower
  // height and dash is unlocked, the player crosses the gap with a flat
  // gravity-suspended lunge up to dashDistance. Additive (only ADDS a way to
  // reach a tagged platform) and tag-gated (untagged gaps get no dash edge), so
  // it can never reduce the reachability of any existing level. Horizontal only:
  // d <= 0 means `to` is the same height or lower (dash gains no altitude).
  if (
    to.requires === "dash" &&
    env.dashDistance !== undefined &&
    d <= 0 &&
    gap <= env.dashDistance * margin
  ) {
    return true;
  }

  // Farthest horizontal distance the arc travels while still arriving at
  // `to.topY`. Flight = rise to apex + fall from apex down to height `d` above
  // launch (d negative when `to` is lower → longer fall → more reach).
  const fallHeight = env.maxApex - d;
  const arcFallTime = Math.sqrt((2 * fallHeight) / env.gravDown);

  // Glide (parachute clamp): on a descent the player MAY hold glide to fall at a
  // gentle constant speed, lengthening airtime → more horizontal reach. It's an
  // opt-in choice, so reachable fall time is the BETTER of arc vs glide. The
  // Math.max is load-bearing: it guarantees glide NEVER reduces reach vs the base
  // arc, which preserves backward solvability of earlier levels. Do not simplify
  // to just glideFallTime.
  let fallTime = arcFallTime;
  if (env.glideFallSpeed !== undefined && fallHeight > 0) {
    const glideFallTime = fallHeight / env.glideFallSpeed;
    fallTime = Math.max(arcFallTime, glideFallTime);
  }

  const flightTime = env.tUp + fallTime;
  const reach = env.speed * flightTime;
  return gap <= reach * margin;
}

type WallRect = { x: number; y: number; w: number; h: number };

/** A surface "touches" a wall if it horizontally overlaps the wall column
 *  (inclusive of edges — a floor ending at the wall, or a ledge starting at it,
 *  both count) and its top sits within the wall's vertical span. */
function surfaceTouchesWall(s: Surface, w: WallRect): boolean {
  const hOverlap = s.left <= w.x + w.w && s.right >= w.x;
  const vWithin = s.topY >= w.y && s.topY <= w.y + w.h;
  return hOverlap && vWithin;
}

/** Two surfaces are climb-connected if they both touch the same wall — the
 *  player ascends/descends the wall between them. Wall-gated (only the powered
 *  player gets the edge) and additive (it only ever ADDS connectivity). */
export function climbConnects(a: Surface, b: Surface, walls: WallRect[]): boolean {
  return walls.some((w) => surfaceTouchesWall(a, w) && surfaceTouchesWall(b, w));
}

/** The horizontal gap column between two surfaces' facing edges, or null when
 *  they overlap in X (not a doorway). Symmetric in (from, to). */
function doorwayGap(from: Surface, to: Surface): { left: number; right: number } | null {
  if (to.left >= from.right) return { left: from.right, right: to.left };      // `to` on the right
  if (from.left >= to.right) return { left: to.right, right: from.left };      // `to` on the left
  return null;                                                                  // overlapping columns
}

/** True if a breakable sits in the doorway between two surfaces. Vertical extent
 *  is NOT checked — a breakable in a doorway is a full barricade by construction;
 *  the level must make it taller than the jump apex so it's honestly unjumpable. */
function breakableInDoorway(from: Surface, to: Surface, b: WallRect): boolean {
  const gap = doorwayGap(from, to);
  if (!gap) return false;
  return b.x < gap.right && b.x + b.w > gap.left;
}

/** A breakable BLOCKS the edge between two surfaces until charge clears it. The
 *  inverse of dash/climb: those ADD an edge when their power is present; charge
 *  REMOVES the block when present. Backward solvability is preserved because
 *  charge only ever UN-blocks (monotonic), and breakables default to []. */
export function breakableBlocks(
  from: Surface,
  to: Surface,
  breakables: WallRect[],
  chargeActive: boolean,
): boolean {
  if (chargeActive) return false;
  return breakables.some((b) => breakableInDoorway(from, to, b));
}

// ─────────────────────────────────────────────────────────────────────────
// Whole-level reachability
// ─────────────────────────────────────────────────────────────────────────

/**
 * Two-tier forgiveness policy (chosen for a game aimed at ages 4–8):
 *
 *  • EXIT margin — completability. A level is a soft-lock only if the exit is
 *    unreachable even at the physical limit. Keep this at 1.0: never ship an
 *    unfinishable level, but don't cry wolf over a hard-but-possible jump.
 *  • CONTENT margin — comfort. Tokens, the companion, and optional platforms
 *    must clear with a buffer, so collecting never demands a frame-perfect input.
 *
 * These are the tuning knobs. Widen the gap between them for a gentler game.
 */
export const DEFAULT_EXIT_MARGIN = 1.0;
export const DEFAULT_CONTENT_MARGIN = 0.85;

export interface ReachabilityOptions {
  /** Forgiveness for the spawn→exit path (completability). Default 1.0. */
  exitMargin?: number;
  /** Forgiveness for tokens / companion / optional platforms. Default 0.85. */
  contentMargin?: number;
  /** Abilities the player has in this area. Consumed in Phase 1 (jumpEnvelope becomes ability-aware). */
  abilities?: Set<AbilityId>;
}

/** The subset of LevelData the lint needs. LevelData satisfies this structurally. */
export interface ReachabilityLevel {
  spawn: { x: number; y: number };
  platforms: Array<{ x: number; y: number; w: number; h: number; requires?: AbilityId }>;
  climbWalls?: Array<{ x: number; y: number; w: number; h: number }>;
  breakables?: Array<{ x: number; y: number; w: number; h: number }>;
  exit: { x: number; y: number; w: number; h: number };
  tokens: Array<{ x: number; y: number }>;
  companion?: { x: number; y: number };
}

export interface ReachabilityProblem {
  severity: "error" | "warn";
  kind:
    | "exit-unreachable"
    | "platform-unreachable"
    | "token-stranded"
    | "companion-stranded"
    | "no-spawn-surface";
  message: string;
}

export interface ReachabilityResult {
  /** True when there are no error-severity problems (the level is completable). */
  ok: boolean;
  problems: ReachabilityProblem[];
}

/** Walkable surface (platform top) for each platform in the level. */
export function surfacesFromLevel(level: ReachabilityLevel): Surface[] {
  return level.platforms.map((p) => ({ left: p.x, right: p.x + p.w, topY: p.y, requires: p.requires }));
}

/** Indices of every surface reachable from the spawn by a chain of jumps. */
function reachableSurfaceSet(
  surfaces: Surface[],
  spawn: { x: number; y: number },
  env: JumpEnvelope,
  margin: number,
  climbWalls: WallRect[],
  wallClimbActive: boolean,
  breakables: WallRect[],
  chargeActive: boolean,
): Set<number> {
  // Spawn surface = the platform under spawn.x whose top is nearest spawn.y.
  let startIdx = -1;
  let best = Infinity;
  surfaces.forEach((s, i) => {
    if (spawn.x >= s.left && spawn.x <= s.right) {
      const dy = Math.abs(s.topY - spawn.y);
      if (dy < best) {
        best = dy;
        startIdx = i;
      }
    }
  });

  const reached = new Set<number>();
  if (startIdx < 0) return reached;
  reached.add(startIdx);

  let changed = true;
  while (changed) {
    changed = false;
    for (const i of [...reached]) {
      const from = surfaces[i]!;
      surfaces.forEach((to, j) => {
        if (
          !reached.has(j) &&
          (canReach(from, to, env, margin) ||
            (wallClimbActive && climbConnects(from, to, climbWalls))) &&
          !breakableBlocks(from, to, breakables, chargeActive)
        ) {
          reached.add(j);
          changed = true;
        }
      });
    }
  }
  return reached;
}

const round = (n: number) => Math.round(n);

export function checkReachability(
  level: ReachabilityLevel,
  opts: ReachabilityOptions = {},
): ReachabilityResult {
  const exitMargin = opts.exitMargin ?? DEFAULT_EXIT_MARGIN;
  const contentMargin = opts.contentMargin ?? DEFAULT_CONTENT_MARGIN;
  const env = jumpEnvelope(opts.abilities ?? new Set());
  const surfaces = surfacesFromLevel(level);
  const climbWalls = level.climbWalls ?? [];
  const wallClimbActive = (opts.abilities ?? new Set()).has("wallClimb");
  const breakables = level.breakables ?? [];
  const chargeActive = (opts.abilities ?? new Set()).has("charge");
  const problems: ReachabilityProblem[] = [];

  // The completion graph uses the generous EXIT margin (physically possible).
  const reachedExit = reachableSurfaceSet(surfaces, level.spawn, env, exitMargin, climbWalls, wallClimbActive, breakables, chargeActive);
  if (reachedExit.size === 0) {
    problems.push({
      severity: "error",
      kind: "no-spawn-surface",
      message: `Spawn at x=${round(level.spawn.x)} is not standing on any platform.`,
    });
    return { ok: false, problems };
  }
  const exitSurfaces = [...reachedExit].map((i) => surfaces[i]!);

  // ── Exit (hard error): is it reachable at all? ───────────────────────────
  const exit = level.exit;
  const exitReachable = exitSurfaces.some(
    (s) => s.right >= exit.x && s.left <= exit.x + exit.w && s.topY >= exit.y,
  );
  if (!exitReachable) {
    const frontier = Math.max(...exitSurfaces.map((s) => s.right));
    problems.push({
      severity: "error",
      kind: "exit-unreachable",
      message: `Exit at x=${round(exit.x)} is unreachable — no jumpable path past x≈${round(frontier)} reaches it.`,
    });
  }

  // ── Content (warnings) judged at the comfier CONTENT margin. ─────────────
  const reachedContent = reachableSurfaceSet(surfaces, level.spawn, env, contentMargin, climbWalls, wallClimbActive, breakables, chargeActive);
  const contentSurfaces = [...reachedContent].map((i) => surfaces[i]!);
  const canReachPoint = (x: number, y: number) =>
    contentSurfaces.some((s) =>
      canReach(s, { left: x - 2, right: x + 2, topY: y }, env, contentMargin),
    );

  // Authored platforms that aren't comfortably reachable.
  surfaces.forEach((s, i) => {
    if (reachedContent.has(i)) return;
    const why = reachedExit.has(i)
      ? "reachable only by a frame-perfect jump"
      : "unreachable by any jump";
    problems.push({
      severity: "warn",
      kind: "platform-unreachable",
      message: `Platform [x=${round(s.left)}–${round(s.right)}, top y=${round(s.topY)}] is ${why}.`,
    });
  });

  // Tokens + companion.
  for (const t of level.tokens) {
    if (!canReachPoint(t.x, t.y)) {
      problems.push({
        severity: "warn",
        kind: "token-stranded",
        message: `Token at (x=${round(t.x)}, y=${round(t.y)}) is outside the comfortable jump envelope.`,
      });
    }
  }
  if (level.companion && !canReachPoint(level.companion.x, level.companion.y)) {
    problems.push({
      severity: "warn",
      kind: "companion-stranded",
      message: `Companion at (x=${round(level.companion.x)}, y=${round(level.companion.y)}) isn't comfortably reachable.`,
    });
  }

  return { ok: !problems.some((p) => p.severity === "error"), problems };
}
