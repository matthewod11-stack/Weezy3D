# Wall-Climb Power (P4 — second traversal power) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Wall-Climb — a hold-X ladder ascent up a tagged `climbWall` zone — as the second traversal power, gating the Family Room. It reuses the P3 spine (a conditional reachability edge + the power-button dispatcher) but is the first power whose mechanic is *context-sensitive*, so it's also the first to touch `GameScene` (build the wall zones, hand them to the Player).

**Architecture:** Powers stay data (`ABILITIES`). Wall-climb is the P3 dash edge rotated 90°: dash was a *horizontal* edge to a tagged platform (equal/lower); wall-climb is a *vertical* edge connecting any two surfaces that both touch the same `climbWall` zone, available only when `wallClimb` is unlocked. The mechanic is "hold X while overlapping a climb wall → ascend at a constant speed, gravity suspended" (mirrors Glide's hold). The Player learns "am I on a wall?" from a pure `isOnClimbWall(body, walls)` helper fed by wall rects the scene builds from the level data. On the power button, wall-climb has the **highest** priority (4 > glide 3 > charge 2 > dash 1), so when she's on a wall it wins over glide/dash.

**Tech Stack:** Phaser 3.80, TypeScript (strict), Vite 6, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-05-30-power-system-design.md` (§5.2 `climbWall` element + edge, §6.1 dispatcher "touching a climbable wall", §8 P4 row). Builds on the P3 dash machinery (`docs/superpowers/plans/2026-05-31-dash-power.md`).

**Locked design decisions (confirmed with the user 2026-05-31):**
- **Mechanic:** hold X to climb (ladder) — touch a climbable wall, hold the power button → ascend at a steady `climbSpeed` with gravity off; release → normal gravity. Keeps the controls tiny (spec invariant #6).
- **`climbWall` is a new element kind** (a non-solid climbable rectangle `{x,y,w,h}`), per spec §4.4 — not a platform tag (dash reused the platform tag; wall-climb needs a vertical zone the Player overlaps).
- **Reachability:** a `climbWall` connects any two surfaces that both *touch* it (horizontal overlap, inclusive of edges + `topY` within the wall's vertical span), only when `wallClimb` is unlocked. Additive + wall-gated → backward solvability preserved.
- **Gate geometry constraint:** the exit sits on the high ledge, positioned **beyond the spawn floor's horizontal extent**, and the ledge is **higher than the double-jump apex (~161px)** — both required so the gate is genuinely unsolvable without climbing (see the insight in §Task 4/8).
- **Wall-climb gates the Family Room** (not the Kitchen — `gatingPower(familyRoom) === "wallClimb"`). The Family Room isn't built, so the gate is proven by a standalone demo + a Testing Ground station, exactly like dash.

---

## File Structure

| File | Responsibility | New? |
|---|---|---|
| `src/config/abilities.ts` | `wallClimb` row: `activation:"hold"` + `traversal.climbSpeed`; add `climbSpeed?` to the `traversal` type | modify |
| `src/config/abilities.test.ts` | wall-climb row expectations | modify |
| `src/types/level.ts` | `ClimbWallSchema` + `LevelData.climbWalls`; scale them in `scaleLevelData` | modify |
| `src/types/level.test.ts` | parse accepts/defaults `climbWalls` | modify |
| `src/entities/climbDetect.ts` | pure `isOnClimbWall(body, walls)` AABB overlap | **create** |
| `src/entities/climbDetect.test.ts` | overlap true/false cases | **create** |
| `src/levels/reachability.ts` | `climbConnects` + `surfaceTouchesWall`; thread `climbWalls`+`wallClimbActive` through the BFS | modify |
| `src/levels/reachability.test.ts` | pin the climb edge (wall-gated, additive, sheer-ledge gate) | modify |
| `src/entities/powerDispatch.ts` | `PowerContext.onClimbableWall`; `wallClimb` predicate | modify |
| `src/entities/powerDispatch.test.ts` | update fixtures; wall-climb resolution tests | modify |
| `src/entities/Player.ts` | climb-wall field + setter; `onClimbableWall` in context; climb branch in the power block | modify |
| `src/scenes/GameScene.ts` | build climb-wall visuals, hand rects to the Player, clean up | modify |
| `src/levels/wallClimbDemoLevel.ts` | hand-authored climb-gate proof + focused sandbox | **create** |
| `src/levels/wallClimb.integration.test.ts` | auto-proof: solvable WITH wall-climb / NOT without | **create** |
| `src/levels/reachability.integration.test.ts` | extend the ordering guard to `climbWalls` | modify |
| `src/levels/testingGround.ts` | append `"wallClimb"` to `IMPLEMENTED_POWERS` + add the climb station | modify |
| `src/levels/testingGround.test.ts` | assert wall-climb is in the roster | modify |
| `src/main.ts` | `eloiseLoadDemo("…\|wallClimb")` | modify |

---

## Task 1: ABILITIES.wallClimb — `activation` + `climbSpeed`

**Files:**
- Modify: `src/config/abilities.ts`
- Modify: `src/config/abilities.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/config/abilities.test.ts`, add after the dash test's closing `});`:

```ts
  it("marks wall-climb as a hold-activated traversal power with a climb speed", () => {
    expect(ABILITIES.wallClimb.family).toBe("traversal");
    expect(ABILITIES.wallClimb.control).toBe("power");
    expect(ABILITIES.wallClimb.activation).toBe("hold");
    expect(ABILITIES.wallClimb.traversal?.climbSpeed).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/config/abilities.test.ts`
Expected: FAIL — `wallClimb.activation` undefined; `traversal.climbSpeed` doesn't exist on the type or row.

- [ ] **Step 3: Add `climbSpeed` to the type + the wall-climb data**

In `src/config/abilities.ts`, extend the `traversal` field type (the comment + line added in P3) to include `climbSpeed`:

```ts
  // Traversal family. dashSpeed (design-px/s) × dashDurationMs gives the lunge
  // distance; climbSpeed (design-px/s) is the wall ascent rate. Player scales by
  // RENDER_SCALE; reachability derives the dash distance in design-space. One
  // source of truth. TDD-pinned; tune for feel.
  traversal?: { dashSpeed?: number; dashDurationMs?: number; climbSpeed?: number };
```

Then update the `wallClimb` row:

```ts
  wallClimb:  { label: "Wall-Climb",  family: "traversal",  order: 2, control: "power", priority: 4, activation: "hold", traversal: { climbSpeed: 130 } },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/config/abilities.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/abilities.ts src/config/abilities.test.ts
git commit -m "feat(abilities): wall-climb is a hold power with a climb speed

wallClimb gets activation:hold + traversal.climbSpeed=130 design-px/s. Extends
the traversal sub-type (shared with dash). One source of truth for the Player
ascent rate.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Schema — the `climbWall` element

**Files:**
- Modify: `src/types/level.ts`
- Modify: `src/types/level.test.ts`

A `climbWall` is a non-solid climbable rectangle `{x,y,w,h}` (top-left origin, like a platform). No `requires` field — a climbWall *is* a wall-climb element by definition; the ordering invariant is enforced by the catalog guard (Task 9).

- [ ] **Step 1: Add the schema + field (impl first, to keep tsc green for the test)**

In `src/types/level.ts`, add a `ClimbWallSchema` after `PlatformSchema` (before `EnemySpawnSchema`):

```ts
export const ClimbWallSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});
```

Add `climbWalls` to `LevelDataSchema` (after the `platforms` line):

```ts
  platforms: z.array(PlatformSchema).min(1),
  climbWalls: z.array(ClimbWallSchema).default([]),
```

Add the inferred type export (after `PlatformDef`):

```ts
export type ClimbWallDef = z.infer<typeof ClimbWallSchema>;
```

And scale them in `scaleLevelData` (add to the returned object, after `platforms:`):

```ts
    climbWalls: data.climbWalls.map((c) => ({ x: m(c.x), y: m(c.y), w: m(c.w), h: m(c.h) })),
```

- [ ] **Step 2: Add the test**

In `src/types/level.test.ts`, add a new `describe` after the `requires` one:

```ts
describe("LevelData.climbWalls", () => {
  it("accepts a climb wall and defaults to [] when omitted", () => {
    const withWall = parseLevelData({
      ...base,
      platforms: [{ x: 0, y: 50, w: 40, h: 10 }],
      climbWalls: [{ x: 20, y: 0, w: 8, h: 60 }],
    });
    expect(withWall.climbWalls).toHaveLength(1);
    expect(withWall.climbWalls[0]).toMatchObject({ x: 20, y: 0, w: 8, h: 60 });

    const without = parseLevelData({ ...base, platforms: [{ x: 0, y: 50, w: 40, h: 10 }] });
    expect(without.climbWalls).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify pass**

Run: `npx vitest run src/types/level.test.ts`
Expected: PASS (the `requires` tests + the new climbWalls test).

- [ ] **Step 4: Commit**

```bash
git add src/types/level.ts src/types/level.test.ts
git commit -m "feat(schema): climbWall element + LevelData.climbWalls

A non-solid climbable rectangle (x,y,w,h), defaulting to []. scaleLevelData
scales it. The second traversal element kind (spec §4.4), after dash's tag.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Pure climb-wall detection helper

**Files:**
- Create: `src/entities/climbDetect.ts`
- Create: `src/entities/climbDetect.test.ts`

A pure AABB-overlap helper (mirrors the airJump/powerDispatch pure-helper pattern) so the Player's "am I on a wall?" check is unit-testable and Phaser-free.

- [ ] **Step 1: Write the failing test**

Create `src/entities/climbDetect.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isOnClimbWall, type Rect } from "./climbDetect";

const wall: Rect = { x: 100, y: 0, w: 20, h: 200 };

describe("isOnClimbWall", () => {
  it("is false when there are no walls", () => {
    expect(isOnClimbWall({ x: 100, y: 50, w: 10, h: 22 }, [])).toBe(false);
  });

  it("is true when the body overlaps a wall", () => {
    expect(isOnClimbWall({ x: 95, y: 50, w: 10, h: 22 }, [wall])).toBe(true);
  });

  it("is false when the body is horizontally clear of every wall", () => {
    expect(isOnClimbWall({ x: 200, y: 50, w: 10, h: 22 }, [wall])).toBe(false);
  });

  it("is false when the body is above/below the wall span", () => {
    expect(isOnClimbWall({ x: 100, y: 250, w: 10, h: 22 }, [wall])).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/entities/climbDetect.test.ts`
Expected: FAIL — module `./climbDetect` does not exist.

- [ ] **Step 3: Implement**

Create `src/entities/climbDetect.ts`:

```ts
/**
 * Pure runtime detection for "is the player currently on a climbable wall?".
 * Phaser-free (mirrors airJump.ts / powerDispatch.ts) so it's unit-testable; the
 * Player feeds it its body AABB + the level's (scaled) climb-wall rects.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** True if `body` overlaps any wall rect (axis-aligned bounding-box test). */
export function isOnClimbWall(body: Rect, walls: Rect[]): boolean {
  return walls.some(
    (w) =>
      body.x < w.x + w.w &&
      body.x + body.w > w.x &&
      body.y < w.y + w.h &&
      body.y + body.h > w.y,
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/entities/climbDetect.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/climbDetect.ts src/entities/climbDetect.test.ts
git commit -m "feat(powers): pure isOnClimbWall(body, walls) helper

AABB overlap test (Phaser-free, like airJump/powerDispatch) so the Player's
wall-detection is unit-testable. Fed the body AABB + scaled climb-wall rects.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Reachability — the conditional climb edge

**Files:**
- Modify: `src/levels/reachability.ts` (`ReachabilityLevel` ~156-163; add `climbConnects`/`surfaceTouchesWall`; `reachableSurfaceSet` signature + loop; `checkReachability` plumbing)
- Modify: `src/levels/reachability.test.ts`

The climb edge connects any two surfaces that both touch the same wall (horizontal overlap inclusive of edges, `topY` within the wall's vertical span), when wall-climb is active. It ignores the jump `margin` (climbing is binary, not a jump). Additive + wall-gated → no existing level changes.

- [ ] **Step 1: Write the failing tests**

In `src/levels/reachability.test.ts`, add `climbConnects` to the import list (line 2-9) so it reads:

```ts
import {
  jumpEnvelope,
  canReach,
  climbConnects,
  surfacesFromLevel,
  checkReachability,
  type Surface,
  type ReachabilityLevel,
} from "./reachability";
```

Then add this `describe` after the `dash edge` block:

```ts
describe("climb edge (traversal: wall-gated, additive)", () => {
  const FLOORY = 168;
  // Floor reaches the wall's left edge; ledge sits past the wall's right edge,
  // 210px up (beyond double-jump apex ~161). Wall spans floor-top..above-ledge.
  const floorS: Surface = { left: 0, right: 180, topY: FLOORY };
  const ledgeS: Surface = { left: 190, right: 320, topY: FLOORY - 210 };
  const wall = { x: 160, y: FLOORY - 220, w: 30, h: 220 }; // x 160-190, y -52..168

  it("connects two surfaces that both touch the same wall", () => {
    expect(climbConnects(floorS, ledgeS, [wall])).toBe(true);
  });

  it("does not connect when there is no shared wall", () => {
    expect(climbConnects(floorS, ledgeS, [])).toBe(false);
    expect(climbConnects(floorS, ledgeS, [{ x: 600, y: 0, w: 20, h: 200 }])).toBe(false);
  });

  it("a sheer ledge is jump-unreachable but climb-reachable (only with wallClimb)", () => {
    const level: ReachabilityLevel = {
      spawn: { x: 16, y: FLOORY },
      platforms: [
        { x: 0, y: FLOORY, w: 180, h: 32 },
        { x: 190, y: FLOORY - 210, w: 130, h: 14 },
      ],
      climbWalls: [{ x: 160, y: FLOORY - 220, w: 30, h: 220 }],
      // Exit BEYOND the floor's right edge (180) so the floor doesn't trivially
      // satisfy the exit-zone check — only the high ledge can reach it.
      exit: { x: 250, y: FLOORY - 210 - 52 + 4, w: 40, h: 52 },
      tokens: [],
    };
    expect(checkReachability(level, { abilities: new Set(["doubleJump"]) }).ok).toBe(false);
    expect(checkReachability(level, { abilities: new Set(["doubleJump", "wallClimb"]) }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/reachability.test.ts`
Expected: FAIL — `climbConnects` not exported; climb edge not modelled (the sheer-ledge "with wallClimb" case returns false).

- [ ] **Step 3: Add `climbWalls` to `ReachabilityLevel`**

In `src/levels/reachability.ts`, add to `ReachabilityLevel` (after the `platforms` line):

```ts
  platforms: Array<{ x: number; y: number; w: number; h: number; requires?: AbilityId }>;
  climbWalls?: Array<{ x: number; y: number; w: number; h: number }>;
```

- [ ] **Step 4: Add the climb-connectivity helpers**

In `src/levels/reachability.ts`, add after `canReach` (after its closing brace, ~line 127):

```ts
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
```

- [ ] **Step 5: Thread climb edges through the BFS**

In `src/levels/reachability.ts`, change `reachableSurfaceSet`'s signature + inner edge test. Replace its signature line and the `canReach` line inside the loop:

```ts
function reachableSurfaceSet(
  surfaces: Surface[],
  spawn: { x: number; y: number },
  env: JumpEnvelope,
  margin: number,
  climbWalls: WallRect[],
  wallClimbActive: boolean,
): Set<number> {
```

and inside the `surfaces.forEach((to, j) => {` loop, replace the condition:

```ts
        if (
          !reached.has(j) &&
          (canReach(from, to, env, margin) ||
            (wallClimbActive && climbConnects(from, to, climbWalls)))
        ) {
          reached.add(j);
          changed = true;
        }
```

- [ ] **Step 6: Pass the climb data from `checkReachability`**

In `src/levels/reachability.ts`, in `checkReachability`, after `const env = jumpEnvelope(...)` (line 235), add:

```ts
  const climbWalls = level.climbWalls ?? [];
  const wallClimbActive = (opts.abilities ?? new Set()).has("wallClimb");
```

Then update BOTH `reachableSurfaceSet(...)` calls (the exit-margin one ~line 240 and the content-margin one ~line 266) to pass the two new args:

```ts
  const reachedExit = reachableSurfaceSet(surfaces, level.spawn, env, exitMargin, climbWalls, wallClimbActive);
```
```ts
  const reachedContent = reachableSurfaceSet(surfaces, level.spawn, env, contentMargin, climbWalls, wallClimbActive);
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run src/levels/reachability.test.ts`
Expected: PASS (all prior + the 3 climb tests). If the sheer-ledge "with wallClimb" case fails, check the wall spans both surfaces' `topY` (here -52..168 covers ledge top -42 and floor top 168) and that floor/ledge horizontally touch the wall column (inclusive). If the "without" case unexpectedly passes, the exit overlaps the floor's x — push the exit/ledge further right.

- [ ] **Step 8: Commit**

```bash
git add src/levels/reachability.ts src/levels/reachability.test.ts
git commit -m "feat(reachability): conditional climb edge (wall-gated, additive)

climbConnects(a,b,walls): two surfaces touching the same climbWall are connected
when wallClimb is active. Threaded through the BFS alongside canReach. Wall-gated
+ additive → backward solvability preserved. Sheer-ledge gate proven.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Dispatcher — `wallClimb` predicate + `onClimbableWall`

**Files:**
- Modify: `src/entities/powerDispatch.ts`
- Modify: `src/entities/powerDispatch.test.ts`

`PowerContext` gains `onClimbableWall` (required — the Player must always supply it). Wall-climb's predicate is `(ctx) => ctx.onClimbableWall`; at priority 4 it outranks glide/dash, so on a wall it wins.

- [ ] **Step 1: Update the tests**

In `src/entities/powerDispatch.test.ts`, update the three fixtures (lines 5-7) to include the new field, and add an on-wall fixture:

```ts
const falling: PowerContext = { airborne: true, descending: true, onClimbableWall: false };
const rising: PowerContext = { airborne: true, descending: false, onClimbableWall: false };
const grounded: PowerContext = { airborne: false, descending: false, onClimbableWall: false };
const onWall: PowerContext = { airborne: true, descending: true, onClimbableWall: true };
```

Then add wall-climb tests before the final closing `});`:

```ts
  it("resolves wall-climb when on a climbable wall", () => {
    expect(resolveActivePower(onWall, new Set<AbilityId>(["wallClimb"]))).toBe("wallClimb");
  });

  it("does not resolve wall-climb off a wall", () => {
    expect(resolveActivePower(falling, new Set<AbilityId>(["wallClimb"]))).toBe(null);
  });

  it("wall-climb outranks glide and dash when on a wall (priority 4)", () => {
    const all = new Set<AbilityId>(["glide", "dash", "wallClimb"]);
    expect(resolveActivePower(onWall, all)).toBe("wallClimb");
  });

  it("falls back to glide/dash off the wall when wall-climb is unlocked", () => {
    const all = new Set<AbilityId>(["glide", "dash", "wallClimb"]);
    expect(resolveActivePower(falling, all)).toBe("glide"); // descending, not on wall
    expect(resolveActivePower(grounded, all)).toBe("dash");  // grounded, not on wall
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/entities/powerDispatch.test.ts`
Expected: FAIL — `onClimbableWall` not on `PowerContext` (tsc/runtime), and wall-climb has no predicate.

- [ ] **Step 3: Add the field + predicate**

In `src/entities/powerDispatch.ts`, add the field to `PowerContext` (after `descending`):

```ts
export interface PowerContext {
  /** Not standing on ground. */
  airborne: boolean;
  /** Moving downward (vy > 0). */
  descending: boolean;
  /** Overlapping a climbable wall zone. */
  onClimbableWall: boolean;
  // Later powers extend with facingBreakable / ... (add, never remove).
}
```

And add the predicate to `POWER_CONTEXTS` (before `dash`, so the data reads high-priority-first — order is cosmetic, the resolver uses `priority`):

```ts
export const POWER_CONTEXTS: Partial<Record<AbilityId, (ctx: PowerContext) => boolean>> = {
  wallClimb: (ctx) => ctx.onClimbableWall,
  glide: (ctx) => ctx.airborne && ctx.descending,
  dash: () => true,
  // charge predicate arrives in P5.
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/entities/powerDispatch.test.ts`
Expected: PASS (all prior dash/glide tests + 4 new wall-climb tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/powerDispatch.ts src/entities/powerDispatch.test.ts
git commit -m "feat(powers): wall-climb dispatch predicate + onClimbableWall context

PowerContext.onClimbableWall (required); wallClimb fires when on a wall and, at
priority 4, outranks glide/dash there. Off the wall it falls back to glide/dash.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Player — the climb mechanic

**Files:**
- Modify: `src/entities/Player.ts` (imports; field + setter; the power block 184-ish)

No unit test — Phaser input/physics (same as dash/glide). Decision logic is covered by Tasks 3+5; verified in Task 12.

- [ ] **Step 1: Add the import**

In `src/entities/Player.ts`, after the `resolveActivePower` import (line 12), add:

```ts
import { isOnClimbWall, type Rect } from "./climbDetect";
```

- [ ] **Step 2: Add the climb-walls field + setter**

In `src/entities/Player.ts`, after the `facing` field (added in P3), add:

```ts
  /** Climbable wall rects (scaled), set by GameScene per level. */
  private climbWalls: Rect[] = [];
```

And add a public setter (place it next to `respawnAt`, e.g. after the constructor's closing brace or near the other public methods):

```ts
  /** GameScene hands the level's (scaled) climb-wall rects here each build. */
  setClimbWalls(walls: Rect[]): void {
    this.climbWalls = walls;
  }
```

- [ ] **Step 3: Add the climb branch to the power block**

In `src/entities/Player.ts`, replace the power-block context build + the dash/glide branches (the block starting `const integratedVy = body.velocity.y;` through the glide `else if`) so it computes `onClimbableWall` and adds a wall-climb branch between dash and glide:

```ts
    this.dashCooldownMs = Math.max(0, this.dashCooldownMs - delta);
    const integratedVy = body.velocity.y;
    const onClimbableWall = isOnClimbWall(
      { x: body.x, y: body.y, w: body.width, h: body.height },
      this.climbWalls,
    );
    const activePower = resolveActivePower(
      { airborne: !onGround, descending: integratedVy > 0, onClimbableWall },
      GameState.get().unlockedAbilities,
    );
    const powerPressed = Phaser.Input.Keyboard.JustDown(this.keyPower);

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

    if (this.dashMsLeft > 0) {
      this.dashMsLeft -= delta;
      const dashSpeed = (ABILITIES.dash.traversal?.dashSpeed ?? 0) * RENDER_SCALE;
      body.setVelocityX(this.dashDir * dashSpeed);
      body.setVelocityY(0);
    } else if (activePower === "wallClimb" && this.keyPower.isDown) {
      // Ladder climb: ascend at a steady speed while held, gravity suspended.
      const climbSpeed = (ABILITIES.wallClimb.traversal?.climbSpeed ?? 0) * RENDER_SCALE;
      body.setVelocityY(-climbSpeed);
    } else if (activePower === "glide" && this.keyPower.isDown) {
      const glideFallSpeed =
        (ABILITIES.glide.envelope?.glideFallSpeed ?? Infinity) * RENDER_SCALE;
      if (integratedVy > glideFallSpeed) {
        body.setVelocityY(glideFallSpeed);
      }
    }
```

- [ ] **Step 4: Verify typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/entities/Player.ts
git commit -m "feat(player): wall-climb ladder ascent (hold X on a wall)

Player computes onClimbableWall via isOnClimbWall(body, climbWalls) and, when the
dispatcher resolves wallClimb and X is held, ascends at climbSpeed with gravity
suspended. GameScene supplies the wall rects via setClimbWalls.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: GameScene — build climb-wall zones + visuals + cleanup

**Files:**
- Modify: `src/scenes/GameScene.ts` (field ~26; `buildLevel` after the player block ~255; `clearLevelEntities` ~462; `teardown` ~136)

Climb walls are non-solid (no physics body — climbing is velocity-driven). The scene draws a translucent visual so the player can see where to climb, and hands the (scaled) rects to the Player.

- [ ] **Step 1: Add the visuals field**

In `src/scenes/GameScene.ts`, after `private exitZone?: ...` (line 26), add:

```ts
  private climbWallVisuals: Phaser.GameObjects.GameObject[] = [];
```

- [ ] **Step 2: Build the zones + visuals in `buildLevel`**

In `src/scenes/GameScene.ts`, in `buildLevel`, right after the player create/respawn `if/else` block (lines 251-255) and before the player↔platform collider push (line 257), insert:

```ts
    // Climb walls (P4): non-solid climbable zones. Draw a translucent visual so
    // the wall reads, and hand the rects to the Player for overlap detection
    // (no physics body — climbing is velocity-driven, not collision-driven).
    for (const c of data.climbWalls) {
      const rect = this.add.rectangle(c.x + c.w / 2, c.y + c.h / 2, c.w, c.h, 0x8fbf8f, 0.3);
      rect.setDepth(10);
      this.climbWallVisuals.push(rect);
    }
    this.player.setClimbWalls(data.climbWalls);
```

- [ ] **Step 3: Clean up the visuals in `clearLevelEntities`**

In `src/scenes/GameScene.ts`, in `clearLevelEntities`, after the `this.exitZone?.destroy();` line, add:

```ts
    for (const v of this.climbWallVisuals) {
      v.destroy();
    }
    this.climbWallVisuals = [];
```

- [ ] **Step 4: Null the reference in `teardown`**

In `src/scenes/GameScene.ts`, in `teardown`, alongside the other array resets (after `this.levelBackdrop = [];`), add:

```ts
    this.climbWallVisuals = [];
```

- [ ] **Step 5: Verify typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (scene changes aren't unit-tested but must compile + not break existing tests).

- [ ] **Step 6: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat(scene): build climb-wall zones + visuals; hand rects to Player

buildLevel draws a translucent rect per climbWall (non-solid) and calls
player.setClimbWalls; clearLevelEntities + teardown dispose/reset them. First
power whose mechanic needs runtime level geometry.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Wall-climb demo level + auto-proof

**Files:**
- Create: `src/levels/wallClimbDemoLevel.ts`
- Create: `src/levels/wallClimb.integration.test.ts`

- [ ] **Step 1: Write the failing auto-proof test**

Create `src/levels/wallClimb.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkReachability } from "./reachability";
import { WALL_CLIMB_DEMO_LEVEL } from "./wallClimbDemoLevel";

// Family-Room-faithful proof: that player has double-jump + dash already, so the
// sheer ledge must be unbeatable even WITH those — only wall-climb reaches it.
describe("wall-climb gate is real (P4 auto-proof)", () => {
  it("solvable WITH the Family Room loadout (double-jump + dash + wall-climb)", () => {
    const r = checkReachability(WALL_CLIMB_DEMO_LEVEL, {
      abilities: new Set(["doubleJump", "dash", "wallClimb"]),
    });
    expect(r.ok, r.problems.map((p) => p.message).join(" | ")).toBe(true);
  });

  it("NOT solvable without wall-climb (jump + dash can't scale the wall)", () => {
    const r = checkReachability(WALL_CLIMB_DEMO_LEVEL, {
      abilities: new Set(["doubleJump", "dash"]),
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/wallClimb.integration.test.ts`
Expected: FAIL — module `./wallClimbDemoLevel` does not exist.

- [ ] **Step 3: Create the demo level**

Create `src/levels/wallClimbDemoLevel.ts`:

```ts
import type { LevelData } from "../types/level";

const FLOOR_Y = 168;

// Hand-authored Wall-Climb proof/demo level (P4). A floor, a climbable wall
// rising 210px to a high ledge (above the double-jump apex ~161, so unjumpable),
// and the exit on that ledge. The exit sits past the floor's right edge so the
// floor can't trivially "be under" the exit zone — only the high ledge reaches
// it. Solvable ONLY with wall-climb (even though the Family Room player already
// has double-jump + dash; dash is horizontal/equal-or-lower, so it can't scale
// the wall). NOT in LEVEL_CATALOG — wall-climb can't gate before the Family Room.
//
// Doubles as the focused dev sandbox via window.eloiseLoadDemo("wallClimb").
export const WALL_CLIMB_DEMO_LEVEL: LevelData = {
  id: "wall-climb-demo",
  name: "Wall-Climb Demo",
  spawn: { x: 24, y: FLOOR_Y },
  killY: 280,
  bounds: { minX: 0, maxX: 380, minY: -120, maxY: 260 },
  platforms: [
    { x: 0, y: FLOOR_Y, w: 180, h: 32, color: "#cdb9a6" },        // floor (reaches the wall)
    { x: 190, y: FLOOR_Y - 210, w: 140, h: 14, color: "#d4a574" }, // high ledge (210 up)
  ],
  climbWalls: [{ x: 160, y: FLOOR_Y - 220, w: 30, h: 220 }],       // x 160-190, spans -52..168
  enemies: [],
  tokens: [],
  exit: { x: 250, y: FLOOR_Y - 210 - 52 + 4, w: 40, h: 52 },       // on the ledge, past floor's right (180)
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/levels/wallClimb.integration.test.ts`
Expected: PASS (2 tests). If "without" passes, the floor is reaching the exit — push the ledge+exit further right (raise their `x`) so the floor's right edge is clear of the exit; keep the wall touching both floor and ledge.

- [ ] **Step 5: Commit**

```bash
git add src/levels/wallClimbDemoLevel.ts src/levels/wallClimb.integration.test.ts
git commit -m "test(wall-climb): auto-proof — demo solvable WITH wall-climb, not without

A 210px sheer climb to a ledge whose exit sits past the floor's reach. Proven
unbeatable with the Family Room loadout minus wall-climb (jump+dash can't scale
it). Not in LEVEL_CATALOG. Doubles as the focused sandbox.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Ordering guard — `climbWalls` imply wall-climb

**Files:**
- Modify: `src/levels/reachability.integration.test.ts`

Extend the P3 ordering guard: a level with any `climbWall` must have `wallClimb ∈ abilitiesForArea(area)` — you can't place a climbable wall in an area before Cat grants the power. Green today (no catalog level has walls); load-bearing once the Family Room is authored.

- [ ] **Step 1: Extend the guard**

In `src/levels/reachability.integration.test.ts`, inside the existing `describe("no level requires a power earned in its own or a later area (ordering)", ...)` loop, add a second assertion inside the `it(...)` body (after the `requires` `expect`):

```ts
      const climbOffenders =
        entry.raw.climbWalls.length > 0 && !allowed.has("wallClimb")
          ? entry.raw.climbWalls.length
          : 0;
      expect(climbOffenders, `${entry.raw.id} has climbWalls but no wallClimb in its area`).toBe(0);
```

- [ ] **Step 2: Run to verify pass**

Run: `npx vitest run src/levels/reachability.integration.test.ts`
Expected: PASS — no catalog level has `climbWalls` yet, so `climbOffenders` is 0 for every level.

- [ ] **Step 3: Commit**

```bash
git add src/levels/reachability.integration.test.ts
git commit -m "test(reachability): ordering guard covers climbWalls

A level with a climbWall must have wallClimb in its area's abilities (spec
invariant #2). Green today; load-bearing once the Family Room is authored.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Testing Ground — the wall-climb station

**Files:**
- Modify: `src/levels/testingGround.ts`
- Modify: `src/levels/testingGround.test.ts`

Add `"wallClimb"` to the roster and a Station 4 after the dash gap: a base floor → a 190px climbable wall → a high ledge with the exit.

- [ ] **Step 1: Update the roster test**

In `src/levels/testingGround.test.ts`, add after the dash assertion:

```ts
    expect(IMPLEMENTED_POWERS).toContain("wallClimb");
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/testingGround.test.ts`
Expected: FAIL — roster lacks `"wallClimb"`.

- [ ] **Step 3: Add wall-climb to the roster + the station**

In `src/levels/testingGround.ts`, update `IMPLEMENTED_POWERS`:

```ts
export const IMPLEMENTED_POWERS: AbilityId[] = ["doubleJump", "glide", "dash", "wallClimb"];
```

Add the station to the comment block (after the dash line):

```ts
 *   4 Climb wall    — base floor → a 190-px climbable wall → high ledge (exit);
 *                     touch the wall and HOLD X to climb up (release to step off)
```

Then extend `TESTING_GROUND` — bump `bounds` (`maxX` and `minY` for the high ledge), add the climb station after the dash landing, add a `climbWalls` array, and move the exit to the high ledge:

```ts
  spawn: { x: 20, y: FLOOR_Y },
  killY: 280,
  bounds: { minX: 0, maxX: 1940, minY: -80, maxY: 260 },
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
    { x: 1750, y: FLOOR_Y + 32 - 190, w: 130, h: 14, color: "#e8c9a0" }, // high ledge (190 up from base)
  ],
  climbWalls: [
    { x: 1720, y: FLOOR_Y + 32 - 200, w: 30, h: 200 }, // x 1720-1750, spans ledge-top..base-top
  ],
  enemies: [],
  tokens: [],
  exit: { x: 1810, y: FLOOR_Y + 32 - 190 - 52 + 4, w: 40, h: 52 },
};
```

> Base top = `FLOOR_Y + 32 = 200`; ledge top = `200 - 190 = 10`; wall spans `y` `[10, 200]` (`y=0` would be cleaner but the wall just needs to cover both surfaces' tops — base 200 and ledge 10 — so `y = 0, h = 200` also works; the values above span exactly base→ledge). Exit `x=1810` is past the base floor's right edge (1740), so the base can't trivially reach it.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/levels/testingGround.test.ts`
Expected: PASS (3 tests). The traversability test now reaches the high ledge via the climb edge (wallClimb ∈ roster). If the ledge/exit reports unreachable, confirm the base floor + ledge both touch the wall column (1720-1750) and the wall's vertical span covers both tops (10 and 200).

- [ ] **Step 5: Commit**

```bash
git add src/levels/testingGround.ts src/levels/testingGround.test.ts
git commit -m "feat(dev): Testing Ground climb station + wall-climb in the roster

Appends 'wallClimb' to IMPLEMENTED_POWERS and adds Station 4 — base → 190px
climbable wall → high ledge (exit). Traversability test proves it's clearable
with the roster; the climb edge proves it needs wall-climb.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Dev sandbox — `eloiseLoadDemo("wallClimb")`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add the import + wire the demo**

In `src/main.ts`, after the `DASH_DEMO_LEVEL` import, add:

```ts
import { WALL_CLIMB_DEMO_LEVEL } from "./levels/wallClimbDemoLevel";
```

Then extend the demo tables + the `DemoName` type:

```ts
type DemoName = "glide" | "dash" | "wallClimb";
const DEMO_LEVELS = { glide: GLIDE_DEMO_LEVEL, dash: DASH_DEMO_LEVEL, wallClimb: WALL_CLIMB_DEMO_LEVEL } as const;
const DEMO_GRANTS: Record<DemoName, AbilityId[]> = {
  glide: ["glide"],
  dash: ["doubleJump", "dash"], // dash gate assumes the Kitchen loadout
  wallClimb: ["doubleJump", "dash", "wallClimb"], // wall-climb gate assumes the Family Room loadout
};
```

(The `eloiseLoadDemo` body is unchanged — it already reads both tables.)

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(dev): eloiseLoadDemo('wallClimb') sandbox

Adds the wall-climb demo to the table-driven loader; grants the Family Room
loadout (double-jump + dash + wall-climb).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Build gate + runtime verification + PROGRESS

**Files:** `PROGRESS.md` (everything else is verification only)

- [ ] **Step 1: Full build gate**

Run: `npm run build`
Expected: `tsc` clean, all Vitest tests pass (105 from P3 + ~16 new), `vite build` succeeds.

- [ ] **Step 2: Confirm the tree-shake invariant still holds**

Run: `grep -ro "Testing Ground" dist/assets/*.js | wc -l` → expect `0`. (Editing `testingGround.ts` must not leak the DEV-gated menu path into prod.)

- [ ] **Step 3: Start the preview + drive the wall-climb sandbox**

Use `preview_start` (config `Game Dev Server`). Confirm boot, then:

```js
window.eloiseLoadDemo("wallClimb")
```

After ~300ms:

```js
JSON.stringify({
  active: window.eloiseGame.scene.getScenes(true).map(s => s.scene.key),
  hasWallClimb: window.eloiseState.hasAbility("wallClimb"),
  level: window.eloiseGame.scene.getScene("GameScene").levelData?.name,
  climbWalls: window.eloiseGame.scene.getScene("GameScene").levelData?.climbWalls?.length,
})
```

Expected: GameScene active, `hasWallClimb: true`, level `"Wall-Climb Demo"`, `climbWalls: 1`.

- [ ] **Step 4: Confirm the geometry renders**

`preview_screenshot`: verify Eloise on the floor, the translucent green climb-wall rising to the high ledge, the exit on the ledge. `preview_console_logs` (level `error`) empty.

- [ ] **Step 5: Manual playtest (the one thing automation can't do)**

Hand off. Two surfaces:
1. **Focused:** console `eloiseLoadDemo("wallClimb")` → walk to the wall base, **hold X** to climb, step off at the top onto the ledge → exit.
2. **Integrated:** menu → "Testing Ground (dev)" → clear all 5 stations; at the climb wall, touch it and hold X.

Tune if needed: `ABILITIES.wallClimb.traversal.climbSpeed`; **and if mantling onto the ledge feels tight** (she tops out beside the ledge and must step right), nudge the ledge's left edge toward the wall or widen the wall in `wallClimbDemoLevel.ts` + `testingGround.ts` — re-run `npx vitest run src/levels/wallClimb.integration.test.ts src/levels/testingGround.test.ts` after any geometry change to confirm the gate + traversability still hold.

- [ ] **Step 6: Update PROGRESS.md**

Prepend a session entry (newest-first): wall-climb (hold-X ladder ascent) + the climb edge + the first GameScene-touching power shipped; auto-proof + Testing Ground station; build green; manual feel-test outcome + any tuning.

- [ ] **Step 7: Final commit**

```bash
git add PROGRESS.md
git commit -m "docs(progress): P4 wall-climb — shipped, build green

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist (completed by plan author)

- **Spec coverage:** §5.2 (a) `climbWall` element kind → T2; (b) conditional edge in BFS → T4 (`climbConnects`, wall-gated, additive); (c) player mechanic (`control:"power"` predicate + `"hold"`) → T5 (predicate) + T6 (climb). §5.3 double-check (solvable-with/not-without) → T8, with the Family-Room loadout. §6.1 "touching a climbable wall" + priority 4 → T5. §7 invariant #1 additive (untagged levels unaffected; climb edge only ADDs) → T4 + test; #2 ordering → T9; #5 powers-are-data (predicate outside the table) → T5; #6 controls stay tiny (still just X) → T6. §8 P4 deliverable + "gates Family Room (demo until area built)" → T8/T10. ✓
- **Placeholders:** none — `climbSpeed: 130`, the 210/190px climbs, and all station coords are concrete, with TDD escape hatches in T4 s7, T8 s4, T10 s4, and a mantling-feel tuning note in T12 s5. ✓
- **Type consistency:** `climbSpeed` (design-px/s) on `ABILITIES.wallClimb.traversal`, read by Player (`×RENDER_SCALE`). `Rect {x,y,w,h}` shared by `climbDetect` + Player field. `ClimbWallDef`/`LevelData.climbWalls`/`ReachabilityLevel.climbWalls`/`climbConnects` walls all `{x,y,w,h}`. `PowerContext.onClimbableWall` added once (T5), supplied by Player (T6) + all test fixtures (T5). `isOnClimbWall` / `climbConnects` / `setClimbWalls` names consistent across tasks. ✓
- **Gate correctness:** the exit is placed beyond the spawn floor's horizontal extent in the demo (T8) and the Testing Ground (T10) so the lenient exit-zone check can't pass via the floor; the ledge is >double-jump apex so jump+dash genuinely fail. Verified against the `checkReachability` exit logic. ✓
- **Backward solvability:** climb edge is wall-gated (`climbConnects` only fires on shared walls) and additive (an extra OR in the BFS), and `climbWalls` defaults to `[]`, so every existing level's graph is unchanged. ✓
- **Deviation noted:** spec §6.1 implies the Player needs `onClimbableWall`; the spec didn't say where wall geometry lives at runtime. This plan adds a `climbWall` element + a scene-built non-solid zone + the pure `isOnClimbWall` helper — the first power to touch `GameScene`, which the spec's "the engine reads `unlockedAbilities` and dispatches" model accommodates (the dispatch stays data-driven; only the context source is new).
```
