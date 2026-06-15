# Charge Power (P5 — third & final traversal power) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Charge — an **instant tap-smash** (tap X while grounded and facing a `breakable` barricade → it shatters, walk through) — as the third and final traversal power, gating the Living Room. Completing it ships **all five powers** (double-jump, dash, wall-climb, charge, glide).

**Architecture:** Charge is the **mirror-image** of dash/wall-climb. Dash and climb *add* a conditional edge to the reachability graph (`canReach || climbConnects`) — additive, so backward-solvability is automatic. Charge has to *remove* an edge that would otherwise exist: a `breakable` barricade blocks a normally-walkable seam between two surfaces **until** charge clears it. That's a filter (`&& !breakableBlocks`), not an OR. It stays monotonic (and preserves backward-solvability) because charge can *only ever un-block* (more powers never block more) and `breakables` defaults to `[]`. Charge is also the **first power to mutate level geometry at runtime**: dash/climb are momentary velocity effects, but smashing a barricade permanently destroys a *solid* physics body. So breakables are solid (a Player↔breakableGroup collider stops un-charged Eloise), unlike the climb wall's non-solid zone. On the power button, charge has priority 2 (wallClimb 4 > glide 3 > **charge 2** > dash 1), so grounded-facing-a-barricade fires charge, not the dash fallback.

**Tech Stack:** Phaser 3.80, TypeScript (strict), Vite 6, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-05-30-power-system-design.md` (§5.2 `breakable` element + edge, §6.1 dispatcher "grounded, facing a breakable", §8 P5 row). Builds on the P3 dash machinery (`requires`-style tagging, the dispatcher) and the P4 wall-climb machinery (`docs/superpowers/plans/2026-05-31-wall-climb-power.md` — the element-kind + scene-geometry + pure-detection pattern this plan reuses for breakables).

**Locked design decisions (confirmed with the user 2026-06-02):**
- **Mechanic:** instant tap-smash. Grounded + facing a breakable within reach + tap X → destroy that breakable, walk through. No charge-up state, no momentum requirement (keeps the controls tiny, spec invariant #6; matches the wall-climb playtest lesson — simple, no unrecoverable states for ages 4–8).
- **`breakable` is a new element kind** — a **solid** rectangle `{x,y,w,h}` (spec §4.4), unlike the non-solid `climbWall`. A Player↔breakableGroup collider blocks un-charged Eloise; charge destroys the body.
- **Reachability:** a `breakable` in the *doorway* (horizontal gap column) between two surfaces **blocks** the edge between them unless charge is active. Subtractive but monotonic + element-gated → backward solvability preserved by construction.
- **Gate geometry constraint:** the barricade must be **taller than the double-jump apex (~161px)** so it's honestly unjumpable (the model blocks the seam unconditionally; the level must make that physically true), and the exit must sit **beyond the spawn floor's horizontal extent** so the lenient exit-zone check can't pass via the spawn floor — only the far floor (across the smashed barricade) reaches it.
- **Charge gates the Living Room** (`gatingPower(livingRoom) === "charge"`). The Living Room isn't built, so the gate is proven by a standalone demo + a Testing Ground station, exactly like dash and wall-climb.

---

## File Structure

| File | Responsibility | New? |
|---|---|---|
| `src/config/abilities.ts` | `charge` row: `activation:"press"` + `traversal.chargeReach`; add `chargeReach?` to the `traversal` type | modify |
| `src/config/abilities.test.ts` | charge row expectations | modify |
| `src/types/level.ts` | `BreakableSchema` + `LevelData.breakables` (`.optional()`); scale them in `scaleLevelData` | modify |
| `src/types/level.test.ts` | parse accepts breakables / defaults to undefined when omitted | modify |
| `src/entities/breakableDetect.ts` | pure `facingBreakable(body, facing, breakables, reach)` → index or -1 | **create** |
| `src/entities/breakableDetect.test.ts` | faced / behind / out-of-reach / vertical-miss / skip-null cases | **create** |
| `src/levels/reachability.ts` | `breakableInDoorway` + `breakableBlocks`; thread `breakables`+`chargeActive` through the BFS | modify |
| `src/levels/reachability.test.ts` | pin the breakable block edge (charge-gated, monotonic, barricade gate) | modify |
| `src/entities/powerDispatch.ts` | `PowerContext.facingBreakable`; `charge` predicate | modify |
| `src/entities/powerDispatch.test.ts` | update fixtures; charge resolution tests | modify |
| `src/entities/Player.ts` | breakable rects + setters; `facingBreakable` in context; charge smash branch | modify |
| `src/scenes/GameScene.ts` | solid breakable group + visuals + the break method; hand rects/callback to Player; cleanup | modify |
| `src/levels/chargeDemoLevel.ts` | hand-authored charge-gate proof + focused sandbox | **create** |
| `src/levels/charge.integration.test.ts` | auto-proof: solvable WITH charge / NOT without | **create** |
| `src/levels/reachability.integration.test.ts` | extend the ordering guard to `breakables` | modify |
| `src/levels/testingGround.ts` | append `"charge"` to `IMPLEMENTED_POWERS` + add Station 5 (barricade) | modify |
| `src/levels/testingGround.test.ts` | assert charge is in the roster | modify |
| `src/main.ts` | `eloiseLoadDemo("…\|charge")` | modify |
| `PROGRESS.md`, `CLAUDE.md` | session entry + power-system status (all 5 done) | modify |

---

## Task 1: ABILITIES.charge — `activation` + `chargeReach`

**Files:**
- Modify: `src/config/abilities.ts`
- Modify: `src/config/abilities.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/config/abilities.test.ts`, add after the wall-climb test's closing `});`:

```ts
  it("marks charge as a press-activated traversal power with a forward reach", () => {
    expect(ABILITIES.charge.family).toBe("traversal");
    expect(ABILITIES.charge.control).toBe("power");
    expect(ABILITIES.charge.activation).toBe("press");
    expect(ABILITIES.charge.traversal?.chargeReach).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/config/abilities.test.ts`
Expected: FAIL — `charge.activation` undefined; `traversal.chargeReach` doesn't exist on the type or row.

- [ ] **Step 3: Add `chargeReach` to the type + the charge data**

In `src/config/abilities.ts`, extend the `traversal` field type to include `chargeReach`:

```ts
  // Traversal family. dashSpeed (design-px/s) × dashDurationMs gives the lunge
  // distance; climbSpeed (design-px/s) is the wall ascent rate; chargeReach
  // (design-px) is how far ahead a breakable registers as smashable. Player
  // scales by RENDER_SCALE; reachability derives the dash distance in
  // design-space. One source of truth. TDD-pinned; tune for feel.
  traversal?: { dashSpeed?: number; dashDurationMs?: number; climbSpeed?: number; chargeReach?: number };
```

Then update the `charge` row (currently `{ label: "Charge", family: "traversal", order: 3, control: "power", priority: 2 }`):

```ts
  charge:     { label: "Charge",      family: "traversal",  order: 3, control: "power", priority: 2, activation: "press", traversal: { chargeReach: 14 } },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/config/abilities.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/abilities.ts src/config/abilities.test.ts
git commit -m "feat(abilities): charge is a press power with a forward reach

charge gets activation:press + traversal.chargeReach=14 design-px (how far ahead
a breakable registers as smashable). Extends the traversal sub-type (shared with
dash/wall-climb). One source of truth for the Player's smash range.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Schema — the `breakable` element

**Files:**
- Modify: `src/types/level.ts`
- Modify: `src/types/level.test.ts`

A `breakable` is a **solid** rectangle `{x,y,w,h}` (top-left origin, like a platform). No `requires` field — a breakable *is* a charge element by definition; the ordering invariant is enforced by the catalog guard (Task 9). Made `.optional()` (not `.default([])`), matching `climbWalls` — a rare per-level feature shouldn't force every hand-authored literal to carry an empty array; consumers guard with `?? []`.

- [ ] **Step 1: Add the schema + field (impl first, to keep tsc green for the test)**

In `src/types/level.ts`, add a `BreakableSchema` right after `ClimbWallSchema` (before `EnemySpawnSchema`):

```ts
/** A solid barricade the player smashes with charge. Blocks the edge between the
 *  surfaces it sits between (reachability) until charge clears it; GameScene
 *  builds it as a solid body and destroys it on smash. */
export const BreakableSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});
```

Add `breakables` to `LevelDataSchema` (right after the `climbWalls` line):

```ts
  climbWalls: z.array(ClimbWallSchema).optional(),
  // Optional like climbWalls — most levels have none; consumers guard with `?? []`.
  breakables: z.array(BreakableSchema).optional(),
```

Add the inferred type export (after `ClimbWallDef`):

```ts
export type BreakableDef = z.infer<typeof BreakableSchema>;
```

And scale them in `scaleLevelData` (add right after the `climbWalls:` line):

```ts
    climbWalls: data.climbWalls?.map((c) => ({ x: m(c.x), y: m(c.y), w: m(c.w), h: m(c.h) })),
    breakables: data.breakables?.map((b) => ({ x: m(b.x), y: m(b.y), w: m(b.w), h: m(b.h) })),
```

- [ ] **Step 2: Add the test**

In `src/types/level.test.ts`, add a new `describe` after the `climbWalls` one:

```ts
describe("LevelData.breakables", () => {
  it("accepts a breakable and is undefined when omitted", () => {
    const withB = parseLevelData({
      ...base,
      platforms: [{ x: 0, y: 50, w: 40, h: 10 }],
      breakables: [{ x: 38, y: 0, w: 6, h: 60 }],
    });
    expect(withB.breakables).toHaveLength(1);
    expect(withB.breakables?.[0]).toMatchObject({ x: 38, y: 0, w: 6, h: 60 });

    const without = parseLevelData({ ...base, platforms: [{ x: 0, y: 50, w: 40, h: 10 }] });
    expect(without.breakables).toBeUndefined();
  });
});
```

> Note: `breakables` is `.optional()`, so the omitted case is `undefined` (not `[]`) — this matches the `climbWalls` test's contract. If `level.test.ts`'s existing `climbWalls` test asserts `.toEqual([])`, re-check it: the current schema makes `climbWalls` optional too, so confirm against the real file before copying the assertion shape.

- [ ] **Step 3: Run to verify pass**

Run: `npx vitest run src/types/level.test.ts`
Expected: PASS (existing tests + the new breakables test).

- [ ] **Step 4: Commit**

```bash
git add src/types/level.ts src/types/level.test.ts
git commit -m "feat(schema): breakable element + LevelData.breakables

A solid smashable barricade (x,y,w,h), optional like climbWalls. scaleLevelData
scales it. The third (and last) traversal element kind (spec §4.4), after dash's
tag and the climbWall.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Pure breakable-detection helper

**Files:**
- Create: `src/entities/breakableDetect.ts`
- Create: `src/entities/breakableDetect.test.ts`

A pure helper (mirrors `climbDetect.ts`) so the Player's "am I facing a smashable barricade?" check is unit-testable and Phaser-free. Returns the **index** of the faced breakable (so the Player can destroy that specific one), or -1. Direction-aware + within `reach`; skips already-broken (`null`) entries so indices stay stable after a smash.

- [ ] **Step 1: Write the failing test**

Create `src/entities/breakableDetect.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { facingBreakable } from "./breakableDetect";
import type { Rect } from "./climbDetect";

const body: Rect = { x: 100, y: 50, w: 10, h: 22 }; // right edge 110, spans y 50..72
const ahead: Rect = { x: 116, y: 0, w: 12, h: 100 }; // 6px ahead (dx=6), vertically overlaps

describe("facingBreakable", () => {
  it("is -1 when there are no breakables", () => {
    expect(facingBreakable(body, 1, [], 14)).toBe(-1);
  });

  it("detects a breakable just ahead in the facing direction", () => {
    expect(facingBreakable(body, 1, [ahead], 14)).toBe(0);
  });

  it("ignores a breakable behind you", () => {
    expect(facingBreakable(body, -1, [ahead], 14)).toBe(-1);
  });

  it("ignores a breakable out of reach", () => {
    expect(facingBreakable(body, 1, [{ x: 200, y: 0, w: 12, h: 100 }], 14)).toBe(-1);
  });

  it("ignores a breakable that doesn't vertically overlap the body", () => {
    expect(facingBreakable(body, 1, [{ x: 116, y: 200, w: 12, h: 20 }], 14)).toBe(-1);
  });

  it("skips already-broken (null) entries and returns the live index", () => {
    expect(facingBreakable(body, 1, [null, ahead], 14)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/entities/breakableDetect.test.ts`
Expected: FAIL — module `./breakableDetect` does not exist.

- [ ] **Step 3: Implement**

Create `src/entities/breakableDetect.ts`:

```ts
import type { Rect } from "./climbDetect";

/**
 * Pure runtime detection for "is the player facing a smashable breakable, in
 * reach?". Phaser-free (mirrors climbDetect.ts) so it's unit-testable; the
 * Player feeds it its body AABB, its facing direction, the level's (scaled)
 * breakable rects (with broken ones nulled), and the scaled chargeReach.
 *
 * Returns the INDEX of the first live breakable directly ahead within reach and
 * vertically overlapping the body, or -1. The index lets the Player destroy that
 * specific breakable; nulling broken entries keeps indices stable across smashes.
 */
export function facingBreakable(
  body: Rect,
  facing: -1 | 1,
  breakables: ReadonlyArray<Rect | null>,
  reach: number,
): number {
  for (let i = 0; i < breakables.length; i++) {
    const b = breakables[i];
    if (!b) continue;
    const vOverlap = body.y < b.y + b.h && body.y + body.h > b.y;
    if (!vOverlap) continue;
    // Forward distance from the body's leading edge to the breakable's near face.
    // ~0 when flush against it (the collider holds her there); a small negative
    // tolerance lets a just-overlapping barricade still register.
    const dx = facing === 1 ? b.x - (body.x + body.w) : body.x - (b.x + b.w);
    if (dx >= -2 && dx <= reach) return i;
  }
  return -1;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/entities/breakableDetect.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/breakableDetect.ts src/entities/breakableDetect.test.ts
git commit -m "feat(powers): pure facingBreakable(body, facing, breakables, reach) helper

Returns the index of the live breakable directly ahead within reach (or -1),
Phaser-free like climbDetect. Index-based + null-skipping so a smashed barricade
leaves the others' indices stable. Fed the body AABB + scaled breakable rects.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Reachability — the breakable blocking edge

**Files:**
- Modify: `src/levels/reachability.ts` (`ReachabilityLevel`; add `breakableInDoorway`/`breakableBlocks`; `reachableSurfaceSet` signature + edge test; `checkReachability` plumbing)
- Modify: `src/levels/reachability.test.ts`

A breakable in the *doorway* (the horizontal gap column between two surfaces) **blocks** the edge between them unless charge is active. This is the inverse of dash/climb's additive edge — a filter on the BFS edge condition. Monotonic (charge only un-blocks) + element-gated (`breakables` defaults to `[]`) → no existing level changes; only the without-charge fake-gate check is affected.

- [ ] **Step 1: Write the failing tests**

In `src/levels/reachability.test.ts`, add `breakableBlocks` to the import list so it reads (add the one name to the existing import block):

```ts
import {
  jumpEnvelope,
  canReach,
  climbConnects,
  breakableBlocks,
  surfacesFromLevel,
  checkReachability,
  type Surface,
  type ReachabilityLevel,
} from "./reachability";
```

Then add this `describe` after the `climb edge` block:

```ts
describe("breakable edge (traversal: charge-gated, monotonic, BLOCKS until cleared)", () => {
  const FLOORY = 168;
  // Two same-height floors with a 20px seam. A barricade fills the seam.
  const leftS: Surface = { left: 0, right: 160, topY: FLOORY };
  const rightS: Surface = { left: 180, right: 360, topY: FLOORY };
  const barricade = { x: 158, y: FLOORY - 200, w: 24, h: 200 }; // spans the seam 160..180

  it("blocks the doorway edge when charge is absent", () => {
    expect(breakableBlocks(leftS, rightS, [barricade], false)).toBe(true);
  });

  it("does NOT block once charge clears it", () => {
    expect(breakableBlocks(leftS, rightS, [barricade], true)).toBe(false);
  });

  it("is symmetric (blocks regardless of edge direction)", () => {
    expect(breakableBlocks(rightS, leftS, [barricade], false)).toBe(true);
  });

  it("does not block an edge whose doorway it doesn't sit in", () => {
    const farS: Surface = { left: 500, right: 640, topY: FLOORY };
    expect(breakableBlocks(leftS, farS, [barricade], false)).toBe(false);
  });

  it("a barricaded gap is crossable ONLY with charge", () => {
    const level: ReachabilityLevel = {
      spawn: { x: 24, y: FLOORY },
      platforms: [
        { x: 0, y: FLOORY, w: 160, h: 32 },
        { x: 180, y: FLOORY, w: 180, h: 32 },
      ],
      breakables: [{ x: 158, y: FLOORY - 200, w: 24, h: 200 }],
      // Exit BEYOND the spawn floor's right edge (160) so only the far floor
      // (across the smashed barricade) can satisfy the exit-zone check.
      exit: { x: 250, y: FLOORY - 52 + 4, w: 40, h: 52 },
      tokens: [],
    };
    expect(checkReachability(level, { abilities: new Set(["doubleJump"]) }).ok).toBe(false);
    expect(checkReachability(level, { abilities: new Set(["doubleJump", "charge"]) }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/reachability.test.ts`
Expected: FAIL — `breakableBlocks` not exported; the barricade case's "without charge" returns `ok: true` (the seam isn't blocked yet).

- [ ] **Step 3: Add `breakables` to `ReachabilityLevel`**

In `src/levels/reachability.ts`, add to `ReachabilityLevel` (right after the `climbWalls?` line):

```ts
  climbWalls?: Array<{ x: number; y: number; w: number; h: number }>;
  breakables?: Array<{ x: number; y: number; w: number; h: number }>;
```

- [ ] **Step 4: Add the breakable-blocking helpers**

In `src/levels/reachability.ts`, add right after `climbConnects` (after its closing brace, ~line 174):

```ts
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
```

> `WallRect` (`{x,y,w,h}`) is already declared above `surfaceTouchesWall` (Task-4-of-P4 added it) — reuse it; do not redeclare.

- [ ] **Step 5: Thread the breakable filter through the BFS**

In `src/levels/reachability.ts`, extend `reachableSurfaceSet`'s signature (add the two new params after `wallClimbActive`):

```ts
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
```

and inside the `surfaces.forEach((to, j) => {` loop, replace the edge condition so the breakable filter ANDs onto the (jump OR climb) edge:

```ts
        if (
          !reached.has(j) &&
          (canReach(from, to, env, margin) ||
            (wallClimbActive && climbConnects(from, to, climbWalls))) &&
          !breakableBlocks(from, to, breakables, chargeActive)
        ) {
          reached.add(j);
          changed = true;
        }
```

- [ ] **Step 6: Pass the breakable data from `checkReachability`**

In `src/levels/reachability.ts`, in `checkReachability`, right after the `climbWalls`/`wallClimbActive` lines, add:

```ts
  const climbWalls = level.climbWalls ?? [];
  const wallClimbActive = (opts.abilities ?? new Set()).has("wallClimb");
  const breakables = level.breakables ?? [];
  const chargeActive = (opts.abilities ?? new Set()).has("charge");
```

Then update BOTH `reachableSurfaceSet(...)` calls (the exit-margin one and the content-margin one) to pass the two new args at the end:

```ts
  const reachedExit = reachableSurfaceSet(surfaces, level.spawn, env, exitMargin, climbWalls, wallClimbActive, breakables, chargeActive);
```
```ts
  const reachedContent = reachableSurfaceSet(surfaces, level.spawn, env, contentMargin, climbWalls, wallClimbActive, breakables, chargeActive);
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run src/levels/reachability.test.ts`
Expected: PASS (all prior + the 5 breakable tests). If the barricade "with charge" case fails, confirm `canReach(leftS, rightS)` is true on its own (same height, 20px gap → yes) and that `breakableBlocks` returns false when chargeActive. If the "without charge" case unexpectedly passes, confirm the barricade's x-span overlaps the seam `[160,180]` (`b.x=158 < 180 && b.x+b.w=182 > 160`) and the exit (x=250) is past the spawn floor's right edge (160).

- [ ] **Step 8: Commit**

```bash
git add src/levels/reachability.ts src/levels/reachability.test.ts
git commit -m "feat(reachability): conditional breakable edge (charge-gated, monotonic)

breakableBlocks(from,to,breakables,chargeActive): a breakable in the doorway
between two surfaces blocks the edge until charge clears it. ANDed onto the
(jump OR climb) edge in the BFS as a filter (the inverse of dash/climb's OR).
Monotonic (charge only un-blocks) + breakables default [] → backward solvability
preserved. Barricaded-gap gate proven.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Dispatcher — `charge` predicate + `facingBreakable`

**Files:**
- Modify: `src/entities/powerDispatch.ts`
- Modify: `src/entities/powerDispatch.test.ts`

`PowerContext` gains `facingBreakable` (required — the Player must always supply it). Charge's predicate is `(ctx) => !ctx.airborne && ctx.facingBreakable` (grounded + a breakable in smash range ahead); at priority 2 it outranks dash (1), so on the ground facing a barricade it smashes rather than dashing.

- [ ] **Step 1: Update the tests**

In `src/entities/powerDispatch.test.ts`, update the existing fixtures to include the new field, and add a grounded-facing-breakable fixture:

```ts
const falling: PowerContext = { airborne: true, descending: true, onClimbableWall: false, facingBreakable: false };
const rising: PowerContext = { airborne: true, descending: false, onClimbableWall: false, facingBreakable: false };
const grounded: PowerContext = { airborne: false, descending: false, onClimbableWall: false, facingBreakable: false };
const onWall: PowerContext = { airborne: true, descending: true, onClimbableWall: true, facingBreakable: false };
const atBarricade: PowerContext = { airborne: false, descending: false, onClimbableWall: false, facingBreakable: true };
```

> Check the real fixture shapes first — the P4 `onWall` fixture exists; only add `facingBreakable: false` to each existing one. If a fixture is declared inline inside a test rather than at module scope, update it there.

Then add charge tests before the final closing `});`:

```ts
  it("resolves charge when grounded and facing a breakable", () => {
    expect(resolveActivePower(atBarricade, new Set<AbilityId>(["charge"]))).toBe("charge");
  });

  it("does not resolve charge while airborne (even facing a breakable)", () => {
    const airborneAtWall: PowerContext = { airborne: true, descending: true, onClimbableWall: false, facingBreakable: true };
    expect(resolveActivePower(airborneAtWall, new Set<AbilityId>(["charge"]))).toBe(null);
  });

  it("charge outranks dash at a barricade (priority 2 > 1)", () => {
    const all = new Set<AbilityId>(["dash", "charge"]);
    expect(resolveActivePower(atBarricade, all)).toBe("charge");
  });

  it("falls back to dash on the ground when not facing a breakable", () => {
    const all = new Set<AbilityId>(["dash", "charge"]);
    expect(resolveActivePower(grounded, all)).toBe("dash");
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/entities/powerDispatch.test.ts`
Expected: FAIL — `facingBreakable` not on `PowerContext` (tsc/runtime), and charge has no predicate.

- [ ] **Step 3: Add the field + predicate**

In `src/entities/powerDispatch.ts`, add the field to `PowerContext` (after `onClimbableWall`):

```ts
export interface PowerContext {
  /** Not standing on ground. */
  airborne: boolean;
  /** Moving downward (vy > 0). */
  descending: boolean;
  /** Overlapping a climbable wall zone. */
  onClimbableWall: boolean;
  /** A smashable breakable is directly ahead within charge reach. */
  facingBreakable: boolean;
  // Add fields, never remove.
}
```

And add the predicate to `POWER_CONTEXTS` (insert before `dash`, after `glide` — order is cosmetic; the resolver uses `priority`):

```ts
export const POWER_CONTEXTS: Partial<Record<AbilityId, (ctx: PowerContext) => boolean>> = {
  wallClimb: (ctx) => ctx.onClimbableWall,
  glide: (ctx) => ctx.airborne && ctx.descending,
  charge: (ctx) => !ctx.airborne && ctx.facingBreakable,
  // Dash is the "otherwise" power (spec §6.1): always contextually valid, lowest
  // priority — so the dispatcher returns dash only when no higher-priority power
  // (wall-climb on a wall, glide while descending, charge at a barricade) claims it.
  dash: () => true,
};
```

(Delete the now-obsolete `// charge predicate arrives in P5.` comment.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/entities/powerDispatch.test.ts`
Expected: PASS (all prior dash/glide/wall-climb tests + 4 new charge tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/powerDispatch.ts src/entities/powerDispatch.test.ts
git commit -m "feat(powers): charge dispatch predicate + facingBreakable context

PowerContext.facingBreakable (required); charge fires when grounded and facing a
breakable and, at priority 2, outranks the dash fallback there. Airborne or not
facing a barricade, dash wins.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Player — the charge smash mechanic

**Files:**
- Modify: `src/entities/Player.ts` (imports; fields + setters; the power block)

No unit test — Phaser input/physics (same as dash/glide/climb). Decision logic is covered by Tasks 3+5; verified live in Task 12. Charge is the first power whose effect is a **callback into the scene** (destroy a body), so the Player holds a break callback the scene wires up.

- [ ] **Step 1: Add the import**

In `src/entities/Player.ts`, after the `isOnClimbWall` import (line 13), add:

```ts
import { facingBreakable } from "./breakableDetect";
```

- [ ] **Step 2: Add the breakable fields + setters**

In `src/entities/Player.ts`, after the `climbWalls` field (line 45), add:

```ts
  /** Breakable rects (scaled), set by GameScene per level. Broken ones become
   *  null in place so facingBreakable's indices stay stable. */
  private breakables: (Rect | null)[] = [];
  /** GameScene callback: destroy the i-th breakable's body + visual on smash. */
  private onBreakBreakable?: (index: number) => void;
```

And add the setters next to `setClimbWalls` (after its closing brace, ~line 309):

```ts
  /** GameScene hands the level's (scaled) breakable rects here each build. */
  setBreakables(rects: Rect[]): void {
    this.breakables = [...rects];
  }

  /** GameScene wires the smash callback (destroys the body + visual by index). */
  setBreakBreakable(cb: (index: number) => void): void {
    this.onBreakBreakable = cb;
  }
```

- [ ] **Step 3: Add the charge branch to the power block**

In `src/entities/Player.ts`, the power block builds `onClimbableWall`, then `activePower`, then `powerPressed`, then the dash-start `if`. Replace that region (from the `const onClimbableWall = ...` assignment through the dash-start `if` block) so it also computes `facingBreakable` and adds the charge smash *before* the dash-start (charge and dash are mutually exclusive via the dispatcher, but order it first for clarity):

```ts
    this.dashCooldownMs = Math.max(0, this.dashCooldownMs - delta);
    const integratedVy = body.velocity.y;
    const bodyRect = { x: body.x, y: body.y, w: body.width, h: body.height };
    const onClimbableWall = isOnClimbWall(bodyRect, this.climbWalls);
    const chargeReach = (ABILITIES.charge.traversal?.chargeReach ?? 0) * RENDER_SCALE;
    const facedBreakableIdx = facingBreakable(bodyRect, this.facing, this.breakables, chargeReach);
    const activePower = resolveActivePower(
      {
        airborne: !onGround,
        descending: integratedVy > 0,
        onClimbableWall,
        facingBreakable: facedBreakableIdx >= 0,
      },
      GameState.get().unlockedAbilities,
    );
    const powerPressed = Phaser.Input.Keyboard.JustDown(this.keyPower);

    // Charge (press): a grounded smash that destroys the breakable in front.
    // The dispatcher resolves charge over dash at a barricade (priority 2 > 1),
    // so this fires instead of a dash. Null the smashed rect so it's no longer
    // detected; the scene callback destroys its body + visual.
    if (powerPressed && activePower === "charge" && facedBreakableIdx >= 0) {
      this.onBreakBreakable?.(facedBreakableIdx);
      this.breakables[facedBreakableIdx] = null;
      this.playSquashStretch(1.12, 0.85, 90);
    }

    // Start a dash: fresh press, dash is the resolved power, not already dashing
    // or recovering. Lunge in the current facing direction.
    if (
      powerPressed &&
      activePower === "dash" &&
      this.dashMsLeft <= 0 &&
      this.dashCooldownMs <= 0
    ) {
      this.dashMsLeft = ABILITIES.dash.traversal?.dashDurationMs ?? 0;
      this.dashCooldownMs = this.dashMsLeft + DASH_RECOVER_MS;
      this.dashDir = this.facing;
      this.playSquashStretch(1, 0.9, 80);
    }
```

> The dash-apply block (`if (this.dashMsLeft > 0) { … } else if (activePower === "wallClimb" …) …`) is unchanged — leave it as-is below this region.

- [ ] **Step 4: Verify typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/entities/Player.ts
git commit -m "feat(player): charge smash (tap X grounded, facing a breakable)

Player computes facingBreakable(body, facing, breakables, chargeReach) and, when
the dispatcher resolves charge on a fresh X press, destroys that breakable: nulls
its rect and calls the GameScene break callback. Instant tap-smash, no charge-up.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: GameScene — solid breakable bodies + visuals + the break method + cleanup

**Files:**
- Modify: `src/scenes/GameScene.ts` (fields ~27; create() ~45; `buildLevel` after the climb-wall block ~268; a new `breakBreakableAt` method; `clearLevelEntities` ~480; `teardown` ~138)

Breakables are **solid** (a static physics group + a Player↔group collider blocks un-charged Eloise) — unlike the non-solid climb walls. The scene keeps a parallel `breakableTiles` array (indexed identically to `data.breakables`) so the Player's index-based smash callback can destroy the right body+visual. Destroying happens in the Player's `tick()` (the update phase), the same safe place tokens destroy in their overlap callback.

- [ ] **Step 1: Add the fields**

In `src/scenes/GameScene.ts`, after `private climbWallVisuals: ... = [];` (line 27), add:

```ts
  private breakableGroup!: Phaser.Physics.Arcade.StaticGroup;
  /** Indexed by data.breakables order; null once smashed. */
  private breakableTiles: (Phaser.GameObjects.GameObject | null)[] = [];
```

- [ ] **Step 2: Create the group in create()**

In `src/scenes/GameScene.ts`, in `create()`, right after `this.platformGroup = this.physics.add.staticGroup();` (line 45), add:

```ts
    this.breakableGroup = this.physics.add.staticGroup();
```

- [ ] **Step 3: Build the solid breakables + visuals + collider + Player wiring in `buildLevel`**

In `src/scenes/GameScene.ts`, in `buildLevel`, right after the climb-wall block (`this.player.setClimbWalls(climbWalls);`, line 268) and before the player↔platform collider push (line 270), insert:

```ts
    // Breakables (P5): SOLID barricades the player smashes with charge. A
    // collider stops un-charged Eloise; on charge the Player calls back to
    // destroy the specific tile (index-aligned with data.breakables). A warm
    // terracotta tint reads as "stacked blocks" — tune for feel.
    const breakables = data.breakables ?? [];
    const breakableTint = 0xc1714f;
    this.breakableTiles = breakables.map((b) => {
      const tile = this.add.tileSprite(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, PLANK_TEXTURE);
      tile.setOrigin(0.5, 0.5);
      tile.setTint(breakableTint);
      tile.setDepth(20);
      this.physics.add.existing(tile, true);
      this.breakableGroup.add(tile);
      return tile;
    });
    this.player.setBreakables(breakables);
    this.player.setBreakBreakable((i) => this.breakBreakableAt(i));
    this.colliders.push(this.physics.add.collider(this.player, this.breakableGroup));
```

> `PLANK_TEXTURE` is already imported (platforms use it). If the symbol name differs in the file, use whatever the platform-tile build at line 246 uses.

- [ ] **Step 4: Add the `breakBreakableAt` method**

In `src/scenes/GameScene.ts`, add a private method (place it near `buildLevel`/`clearLevelEntities`, e.g. right before `clearLevelEntities`):

```ts
  /** Smash the i-th breakable: destroy its body + visual (idempotent). Called by
   *  the Player on charge, during update() — safe (same phase tokens destroy in). */
  private breakBreakableAt(i: number): void {
    const tile = this.breakableTiles[i];
    if (!tile) return;
    tile.destroy(); // removes the static body from the group + the game object
    this.breakableTiles[i] = null;
  }
```

- [ ] **Step 5: Clean up in `clearLevelEntities`**

In `src/scenes/GameScene.ts`, in `clearLevelEntities`, right after the climb-wall cleanup (`this.climbWallVisuals = [];`, line 480), add:

```ts
    this.breakableGroup.clear(true, true);
    this.breakableTiles = [];
```

- [ ] **Step 6: Null the reference in `teardown`**

In `src/scenes/GameScene.ts`, in `teardown`, alongside the climb-wall reset (`this.climbWallVisuals = [];`, line 138), add:

```ts
    this.breakableTiles = [];
```

> Do NOT call `this.breakableGroup.clear(...)` in `teardown` — like `platformGroup`, Phaser tears the group down on SHUTDOWN; touching it mid-teardown risks the "reading 'size'" crash the teardown comment warns about. Just null the parallel array.

- [ ] **Step 7: Verify typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (scene changes aren't unit-tested but must compile + not break existing tests).

- [ ] **Step 8: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat(scene): solid breakable barricades + smash-on-charge

buildLevel builds each breakable as a SOLID static body (Player↔breakableGroup
collider blocks un-charged Eloise) + a terracotta visual, index-aligned with
data.breakables; wires player.setBreakables + setBreakBreakable. breakBreakableAt
destroys the tile on charge. clearLevelEntities + teardown dispose/reset. First
power to mutate level geometry at runtime.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Charge demo level + auto-proof

**Files:**
- Create: `src/levels/chargeDemoLevel.ts`
- Create: `src/levels/charge.integration.test.ts`

- [ ] **Step 1: Write the failing auto-proof test**

Create `src/levels/charge.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkReachability } from "./reachability";
import { CHARGE_DEMO_LEVEL } from "./chargeDemoLevel";

// Living-Room-faithful proof: that player has double-jump + dash + wall-climb
// already, so the barricade must be unbeatable even WITH those — only charge
// (smashing it) opens the path.
describe("charge gate is real (P5 auto-proof)", () => {
  it("solvable WITH the Living Room loadout (double-jump + dash + wall-climb + charge)", () => {
    const r = checkReachability(CHARGE_DEMO_LEVEL, {
      abilities: new Set(["doubleJump", "dash", "wallClimb", "charge"]),
    });
    expect(r.ok, r.problems.map((p) => p.message).join(" | ")).toBe(true);
  });

  it("NOT solvable without charge (the barricade blocks the only path)", () => {
    const r = checkReachability(CHARGE_DEMO_LEVEL, {
      abilities: new Set(["doubleJump", "dash", "wallClimb"]),
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/charge.integration.test.ts`
Expected: FAIL — module `./chargeDemoLevel` does not exist.

- [ ] **Step 3: Create the demo level**

Create `src/levels/chargeDemoLevel.ts`:

```ts
import type { LevelData } from "../types/level";

const FLOOR_Y = 168;

// Hand-authored Charge proof/demo level (P5, final traversal power). Two same-
// height floors with a 20px seam, and a 200px-tall breakable barricade filling
// the seam — taller than the double-jump apex (~161), so it's honestly
// unjumpable; the player MUST smash it. The exit sits on the far floor, past the
// spawn floor's right edge, so the spawn floor can't trivially satisfy the
// exit-zone check — only the far floor (across the smashed barricade) reaches it.
// Solvable ONLY with charge (even though the Living Room player already has
// double-jump + dash + wall-climb; none of those clear a barricade). NOT in
// LEVEL_CATALOG — a charge gate can't appear before the Living Room.
//
// Doubles as the focused dev sandbox via window.eloiseLoadDemo("charge").
export const CHARGE_DEMO_LEVEL: LevelData = {
  id: "charge-demo",
  name: "Charge Demo",
  spawn: { x: 24, y: FLOOR_Y },
  killY: 280,
  bounds: { minX: 0, maxX: 380, minY: -60, maxY: 260 },
  platforms: [
    { x: 0, y: FLOOR_Y, w: 160, h: 32, color: "#cdb9a6" },   // spawn floor (reaches the seam)
    { x: 180, y: FLOOR_Y, w: 180, h: 32, color: "#d4a574" },  // far floor (across the barricade)
  ],
  breakables: [{ x: 158, y: FLOOR_Y - 200, w: 24, h: 200 }],  // x 158-182, fills the seam 160..180, 200 tall
  enemies: [],
  tokens: [],
  exit: { x: 250, y: FLOOR_Y - 52 + 4, w: 40, h: 52 },        // on the far floor, past spawn floor's right (160)
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/levels/charge.integration.test.ts`
Expected: PASS (2 tests). If "without charge" passes, the spawn floor is reaching the exit — push the exit further right (raise its `x` past 160) or confirm the barricade x-span covers the seam. If "with charge" fails, confirm `canReach` connects the two same-height floors across the 20px gap (it should) and that charge ∈ abilities flips `breakableBlocks` off.

- [ ] **Step 5: Commit**

```bash
git add src/levels/chargeDemoLevel.ts src/levels/charge.integration.test.ts
git commit -m "test(charge): auto-proof — demo solvable WITH charge, not without

A 200px barricade fills the only seam to the exit floor; proven unbeatable with
the Living Room loadout minus charge (jump/dash/climb don't clear a barricade).
Not in LEVEL_CATALOG. Doubles as the focused sandbox.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Ordering guard — `breakables` imply charge

**Files:**
- Modify: `src/levels/reachability.integration.test.ts`

Extend the ordering guard: a level with any `breakable` must have `charge ∈ abilitiesForArea(area)` — you can't place a barricade in an area before Horse grants charge. Green today (no catalog level has breakables); load-bearing once the Living Room is authored.

- [ ] **Step 1: Extend the guard**

In `src/levels/reachability.integration.test.ts`, inside the existing `describe("no level requires a power earned in its own or a later area (ordering)", ...)` loop's `it(...)` body, add after the `climbOffenders` assertion:

```ts
      // A breakable implies charge (you can't place a barricade before Horse
      // grants the power). breakables is optional → guard the access.
      const hasBreakables = (entry.raw.breakables?.length ?? 0) > 0;
      const breakOffenders = hasBreakables && !allowed.has("charge") ? 1 : 0;
      expect(breakOffenders, `${entry.raw.id} has breakables but no charge in its area`).toBe(0);
```

- [ ] **Step 2: Run to verify pass**

Run: `npx vitest run src/levels/reachability.integration.test.ts`
Expected: PASS — no catalog level has `breakables` yet, so `breakOffenders` is 0 for every level.

- [ ] **Step 3: Commit**

```bash
git add src/levels/reachability.integration.test.ts
git commit -m "test(reachability): ordering guard covers breakables

A level with a breakable must have charge in its area's abilities (spec invariant
#2). Green today; load-bearing once the Living Room is authored.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Testing Ground — Station 5 (barricade) + charge in the roster

**Files:**
- Modify: `src/levels/testingGround.ts`
- Modify: `src/levels/testingGround.test.ts`

Add `"charge"` to the roster and a Station 5 after the climb ledge: drop from the high climb ledge onto a run-up floor → a breakable barricade → the exit floor. The exit moves from the climb ledge (Station 4) to the end of Station 5.

- [ ] **Step 1: Update the roster test**

In `src/levels/testingGround.test.ts`, add after the wall-climb assertion:

```ts
    expect(IMPLEMENTED_POWERS).toContain("charge");
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/testingGround.test.ts`
Expected: FAIL — roster lacks `"charge"`.

- [ ] **Step 3: Add charge to the roster + the station**

In `src/levels/testingGround.ts`, update `IMPLEMENTED_POWERS`:

```ts
export const IMPLEMENTED_POWERS: AbilityId[] = ["doubleJump", "glide", "dash", "wallClimb", "charge"];
```

Add the station to the comment block (after the climb line):

```ts
 *   5 Smash         — drop from the climb ledge → run-up floor → a tall breakable
 *                     barricade → exit floor; face the barricade and TAP X to smash
```

Then extend `TESTING_GROUND` — bump `bounds` (`maxX` for Station 5, `minY` for the barricade top), add the Station 5 platforms after the climb ledge, add a `breakables` array, and move the exit to Station 5's far floor:

```ts
  spawn: { x: 20, y: FLOOR_Y },
  killY: 280,
  bounds: { minX: 0, maxX: 2340, minY: -130, maxY: 260 },
  platforms: [
    // Station 0 — Warmup
    { x: 0, y: FLOOR_Y, w: 140, h: 32, color: "#cdb9a6" }, // start ground
    { x: 150, y: FLOOR_Y - 28, w: 40, h: 14, color: "#e8c9a0" }, // gentle step (28 up)
    // Station 1 — Double-Jump gap (130-px flat gap)
    { x: 210, y: FLOOR_Y, w: 110, h: 32, color: "#d4a574" }, // left
    { x: 450, y: FLOOR_Y, w: 110, h: 32, color: "#d4a574" }, // right (gap 320→450 = 130)
    // Station 2 — Glide drop (up to a high ledge, then float across a wide low gap)
    { x: 590, y: FLOOR_Y - 88, w: 70, h: 14, color: "#e8c9a0" }, // high ledge (y=80; 88 up, double-jump)
    { x: 820, y: FLOOR_Y + 32, w: 120, h: 32, color: "#c9b08f" }, // far low landing (gap 660→820 = 160, drop 120)
    // Station 3 — Dash gap (ground dash across a flat 260-px gap)
    { x: 980, y: FLOOR_Y + 32, w: 140, h: 32, color: "#cdb9a6" }, // run-up (gap 940→980 = 40, easy hop)
    { x: 1380, y: FLOOR_Y + 32, w: 140, h: 32, color: "#d4a574", requires: "dash" }, // landing (gap 1120→1380 = 260)
    // Station 4 — Climb wall (base → wall → high ledge)
    { x: 1560, y: FLOOR_Y + 32, w: 180, h: 32, color: "#cdb9a6" }, // base floor (gap 1520→1560 = 40, easy hop)
    { x: 1750, y: FLOOR_Y + 32 - 190, w: 130, h: 14, color: "#e8c9a0" }, // high ledge (190 up from base; top y=10)
    // Station 5 — Smash (drop from the climb ledge → run-up → barricade → exit floor)
    { x: 1920, y: FLOOR_Y - 68, w: 160, h: 32, color: "#cdb9a6" }, // run-up floor (top y=100; drop 90 + gap 40 from the ledge)
    { x: 2100, y: FLOOR_Y - 68, w: 180, h: 32, color: "#d4a574" }, // exit floor (top y=100; seam 2080→2100 = 20)
  ],
  climbWalls: [
    { x: 1720, y: FLOOR_Y + 32 - 200, w: 30, h: 200 }, // x 1720-1750, spans ledge-top(10)..base-top(200)
  ],
  breakables: [
    { x: 2078, y: FLOOR_Y - 68 - 200, w: 24, h: 200 }, // fills the seam 2080→2100; top y=-132, 200 tall
  ],
  enemies: [],
  tokens: [],
  exit: { x: 2180, y: FLOOR_Y - 68 - 52 + 4, w: 40, h: 52 }, // on the exit floor (top y=100), past run-up's right (2080)
};
```

> **Geometry notes.** `FLOOR_Y = 168`. The climb ledge top is `FLOOR_Y + 32 - 190 = 10`. Station 5's two floors sit at top `FLOOR_Y - 68 = 100` (a 90px drop from the ledge, with a 1880→1920 = 40px gap — an easy hop-down). The barricade `x[2078,2102]` fills the 2080→2100 seam and rises 200px (top `100 - 200 = -100`, hence `minY = -130`). The exit at `x=2180` is past the run-up floor's right edge (2080), so the run-up floor can't satisfy the exit-zone check via the seam being open.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/levels/testingGround.test.ts`
Expected: PASS (3 tests). The traversability test now: climbs to the ledge, hops down to the run-up floor, **charge clears the barricade** (charge ∈ roster) → exit floor → exit. If the run-up floor reports unreachable from the climb ledge, lower it / narrow the 40px gap (the climb ledge is high; the drop must be within the fall envelope — it is, but the test is the safety net). If the exit floor is unreachable, confirm charge is in `IMPLEMENTED_POWERS` and the barricade x-span covers the 2080→2100 seam.

- [ ] **Step 5: Commit**

```bash
git add src/levels/testingGround.ts src/levels/testingGround.test.ts
git commit -m "feat(dev): Testing Ground smash station + charge in the roster

Appends 'charge' to IMPLEMENTED_POWERS and adds Station 5 — drop from the climb
ledge → run-up → a 200px breakable barricade → exit floor. Traversability test
proves it's clearable with the full roster; the breakable edge proves it needs
charge. All 5 stations now bench all 5 powers.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Dev sandbox — `eloiseLoadDemo("charge")`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add the import + wire the demo**

In `src/main.ts`, after the `WALL_CLIMB_DEMO_LEVEL` import (line 13), add:

```ts
import { CHARGE_DEMO_LEVEL } from "./levels/chargeDemoLevel";
```

Then extend the `DemoName` type + both demo tables:

```ts
type DemoName = "glide" | "dash" | "wallClimb" | "charge";
const DEMO_LEVELS = { glide: GLIDE_DEMO_LEVEL, dash: DASH_DEMO_LEVEL, wallClimb: WALL_CLIMB_DEMO_LEVEL, charge: CHARGE_DEMO_LEVEL } as const;
const DEMO_GRANTS: Record<DemoName, AbilityId[]> = {
  glide: ["glide"],
  dash: ["doubleJump", "dash"], // dash gate assumes the Kitchen loadout
  wallClimb: ["doubleJump", "dash", "wallClimb"], // wall-climb gate assumes the Family Room loadout
  charge: ["doubleJump", "dash", "wallClimb", "charge"], // charge gate assumes the Living Room loadout
};
```

(The `eloiseLoadDemo` body is unchanged — it already reads both tables.)

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(dev): eloiseLoadDemo('charge') sandbox

Adds the charge demo to the table-driven loader; grants the Living Room loadout
(double-jump + dash + wall-climb + charge).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Build gate + runtime verification + docs (all 5 powers complete)

**Files:** `PROGRESS.md`, `CLAUDE.md` (everything else is verification only)

- [ ] **Step 1: Full build gate**

Run: `npm run build`
Expected: `tsc` clean, all Vitest tests pass (128 at session start + ~17 new ≈ 145), `vite build` succeeds (reachability double-check + texture smoke test pass).

- [ ] **Step 2: Confirm the tree-shake invariant still holds**

Run: `grep -ro "Testing Ground" dist/assets/*.js | wc -l` → expect `0`. (Editing `testingGround.ts` must not leak the DEV-gated menu path into prod.) Optionally also `grep -ro "Charge Demo" dist/assets/*.js | wc -l` → expect `1` (ships via the console handle like the other demos).

- [ ] **Step 3: Start the preview + drive the charge sandbox**

Use `preview_start` (config `Game Dev Server`). Confirm boot, then:

```js
window.eloiseLoadDemo("charge")
```

After ~300ms:

```js
JSON.stringify({
  active: window.eloiseGame.scene.getScenes(true).map(s => s.scene.key),
  hasCharge: window.eloiseState.hasAbility("charge"),
  level: window.eloiseGame.scene.getScene("GameScene").levelData?.name,
  breakables: window.eloiseGame.scene.getScene("GameScene").levelData?.breakables?.length,
})
```

Expected: GameScene active, `hasCharge: true`, level `"Charge Demo"`, `breakables: 1`.

- [ ] **Step 4: Confirm the geometry renders**

`preview_screenshot`: verify Eloise on the spawn floor, the terracotta barricade filling the seam, the exit on the far floor. `preview_console_logs` (level `error`) empty.

- [ ] **Step 5: Manual playtest (the one thing automation can't do)**

Hand off. Two surfaces:
1. **Focused:** console `eloiseLoadDemo("charge")` → walk right into the barricade, **tap X** to smash it, walk through to the exit.
2. **Integrated:** menu → "Testing Ground (dev)" → clear all 5 stations; at Station 5, face the barricade and tap X.

Tune if needed: `ABILITIES.charge.traversal.chargeReach` (if the smash doesn't register flush against the barricade, raise it a touch); the barricade visual/tint in `GameScene` (`breakableTint`). Re-run `npx vitest run src/levels/charge.integration.test.ts src/levels/testingGround.test.ts` after any geometry change to confirm the gate + traversability still hold.

- [ ] **Step 6: Update PROGRESS.md**

Prepend a session entry (newest-first): charge (instant tap-smash) + the breakable blocking edge (the first *subtractive* power) + the first GameScene-mutating power shipped; auto-proof + Testing Ground Station 5; build green; manual feel-test outcome + any tuning. Note **all 5 powers are now complete** — the metroidvania power system is done.

- [ ] **Step 7: Update CLAUDE.md power-system status**

In `CLAUDE.md`, update the "Current Status" / power-system paragraph: P0–P5 BUILT; the set of five traversal/envelope powers (Double-Jump, Glide, Dash, Wall-Climb, **Charge**) is complete; the "Only P5 — Charge … remains" sentence is removed/replaced with "All five powers ship." Keep the edit surgical (one paragraph).

- [ ] **Step 8: Final commit**

```bash
git add PROGRESS.md CLAUDE.md
git commit -m "docs(progress): P5 charge — shipped; all 5 powers complete

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist (completed by plan author)

- **Spec coverage:** §5.2 (a) `breakable` element kind → T2; (b) conditional edge in BFS → T4 (`breakableBlocks`, charge-gated, monotonic, the inverse filter); (c) player mechanic (`control:"power"` predicate + `"press"`) → T5 (predicate) + T6 (smash). §5.3 double-check (solvable-with/not-without) → T8, with the Living Room loadout. §6.1 "grounded, facing a breakable" + priority 2 → T5. §7 invariant #1 additive/monotonic (untagged levels unaffected; charge only un-blocks) → T4 + tests; #2 ordering → T9; #5 powers-are-data (predicate outside the table) → T5; #6 controls stay tiny (still just X, a press) → T6. §8 P5 deliverable + "gates Living Room (demo until area built)" → T8/T10. ✓
- **Placeholders:** none — `chargeReach: 14`, the 200px barricade, the 20px seam, and all Station 5 coords are concrete, with TDD escape hatches in T4 s7, T8 s4, T10 s4, and a smash-feel tuning note in T12 s5. ✓
- **Type consistency:** `chargeReach` (design-px) on `ABILITIES.charge.traversal`, read by Player (`×RENDER_SCALE`). `Rect {x,y,w,h}` (from `climbDetect`) shared by `breakableDetect` + the Player field. `BreakableDef`/`LevelData.breakables`/`ReachabilityLevel.breakables`/`breakableBlocks` rects all `{x,y,w,h}` (reuse `WallRect` in reachability). `PowerContext.facingBreakable` added once (T5), supplied by Player (T6) + all test fixtures (T5). `facingBreakable` (index-returning) / `breakableBlocks` / `setBreakables` / `setBreakBreakable` / `breakBreakableAt` names consistent across tasks. ✓
- **Gate correctness:** the exit is placed beyond the spawn-floor's horizontal extent in the demo (T8) and the Testing Ground (T10) so the lenient exit-zone check can't pass via the spawn floor; the barricade is 200px (>double-jump apex ~161) so jump/dash/climb genuinely fail. Verified against the `checkReachability` exit logic. ✓
- **Backward solvability:** the breakable filter is monotonic (charge ONLY un-blocks — `breakableBlocks` returns false when chargeActive) and element-gated (`breakables` defaults to `[]`, so every existing level's graph is unchanged), so having more powers never reduces any level's solvability. The double-check's expected-loadout (`abilitiesForArea(livingRoom)` includes charge) clears the barricade. ✓
- **Deviation noted:** Charge is the first *subtractive* edge (a filter `&& !breakableBlocks`, vs dash/climb's additive `|| edge`) and the first power to *mutate runtime geometry* (a destroyed solid body, vs momentary velocity effects). The spec's "powers are data" model holds — the dispatch stays data-driven; the new surface is (a) a solid scene body + (b) a Player→scene break callback. The barricade-height-must-exceed-apex constraint is a modeling assumption (`breakableInDoorway` ignores vertical extent), documented in the demo + Station 5 + the helper comment.
