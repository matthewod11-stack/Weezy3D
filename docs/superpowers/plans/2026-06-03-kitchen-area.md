# Kitchen Area (World 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 5-level Kitchen area (World 3) — a vertical journey where **climbing** (Cat, met early) is load-bearing for the ascent and **dash** (Dog, from Hallway) is load-bearing for the horizontal leaps + stove, authored through the existing sketch→encode pipeline.

**Architecture:** Mirror the Hallway build. Phase 0 adds reusable infra (an `Ant` stomp-patroller, two new sketch-vocab elements — `requires:"dash"` + `climbWalls` — an elevatable exit, and the `metAtStart` gating evolution that puts wall-climb in the Kitchen's ability set). Phase 1 authors 15 variants on `/maps.html`, tuned against the build-time reachability lint. Phase 2 switches `kitchenLevels.ts` to be sketch-driven and wires the catalog. Phase 3 pins the two-gate metroidvania guarantee with an integration test and adds the climb tutorial prompt.

**Tech Stack:** Phaser 3.80, TypeScript (strict), Vite 6, Zod, Vitest. The dash edge, climb edge, `PlatformSchema.requires`, and `ClimbWallSchema` already exist in the engine — this plan only adds *authoring reach* and one gating change. No new game logic.

**Spec:** `docs/superpowers/specs/2026-06-03-kitchen-area-design.md`

---

## File Structure

**Phase 0 — Reusable infra (deterministic):**
- Create: `src/entities/Ant.ts` — stomp-patroller reskin (single texture), sibling of `Spider`.
- Modify: `src/config/textures.ts` — register `ant` + `cat` in `ENTITY_TEXTURE_KEYS`.
- Modify: `src/scenes/GameScene.ts` — `ant` spawn branch + explicit `else` guard for unhandled enemy types.
- Modify: `src/design/levelSketches.ts` — `SketchPlatform.requires?`, new `SketchClimbWall` type, `LevelOption.climbWalls?`.
- Modify: `src/design/combineSlot.ts` — preserve `requires` on platforms; chain `climbWalls`.
- Modify: `src/levels/encodeFromSketch.ts` — pass `requires` through; emit `climbWalls`; honor `combined.exit.y` (elevatable exit).
- Modify: `src/config/companions.ts` — `CompanionDef.metAtStart?`; `cat.metAtStart = true`.
- Modify: `src/config/gating.ts` — `abilitiesForArea` adds the area's own companion's grant when `metAtStart`.
- Modify: `src/config/gating.test.ts` — Kitchen set now includes `wallClimb`.
- Create: `src/levels/encodeFromSketch.elements.test.ts` — unit tests for the three encoder additions.
- Create: `src/config/gating.metAtStart.test.ts` — unit tests for the gating change.

**Phase 1 — Content (iterative authoring):**
- Modify: `src/design/levelSketches.ts` — new `KITCHEN_SLOTS` const (5 slots × A/B/C); point `KITCHEN_AREA.slots` at it (replacing `stubSlots`).

**Phase 2 — Pipeline switch:**
- Create: `src/levels/kitchenLevels.ts` — `encodeAreaLevels(KITCHEN_AREA, SEGMENT_ORDER)`.
- Modify: `src/levels/levelCatalog.ts` — `KITCHEN_ENTRIES` concatenated after `HALLWAY_ENTRIES`.

**Phase 3 — Proof + polish:**
- Create: `src/levels/kitchen.integration.test.ts` — two-gate auto-proof.
- Modify: `src/scenes/GameScene.ts` — "Press ↑ to climb!" prompt at the first climb wall.

---

# PHASE 0 — Reusable Infrastructure

## Task 1: Ant entity + texture registration

**Files:**
- Create: `src/entities/Ant.ts`
- Modify: `src/config/textures.ts:57-64` (the `ENTITY_TEXTURE_KEYS` object)

`Ant` mirrors `Spider` but uses the **single** `ANT` texture (no idle/walk pose-swap — only one sprite exists). The `EnemySpawnSchema` enum already includes `"ant"`, so no schema change.

- [ ] **Step 1: Create `src/entities/Ant.ts`**

```typescript
import { RENDER_SCALE } from "../config/game";
import type { EnemySpawn } from "../types/level";
import { Enemy } from "./Enemy";
import { ANT } from "../config/textures";
import { computeFeetOriginY } from "../systems/measureSpriteFeet";

/**
 * Ant — Kitchen's primary enemy. A stomp-patroller, sibling of DustBunny/Spider
 * under the Enemy base (which owns all patrol motion). Only one ant texture
 * exists (no idle/walk split), so there is no pose-swap — just flip with travel
 * direction. Place several in a line for the "ant trail" flavor (pure placement).
 */
export class Ant extends Enemy {
  constructor(scene: Phaser.Scene, spawn: EnemySpawn) {
    super(scene, spawn.x, spawn.y, ANT, undefined, spawn);
    const feetOriginY = computeFeetOriginY(scene, [ANT]);
    this.setOrigin(0.5, feetOriginY);
    this.setScale(0.03 * RENDER_SCALE); // ants are small; tune at playtest

    // Body sized in WORLD units (Phaser multiplies setSize/setOffset by scaleX
    // at runtime, so pre-divide). Mirrors Spider; tune to ant proportions.
    const BODY_W = 46;
    const BODY_H = 26;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(BODY_W / this.scaleX, BODY_H / this.scaleY);
    const offsetX = (this.originX * this.displayWidth - BODY_W / 2) / this.scaleX;
    const offsetY = (this.originY * this.displayHeight - BODY_H - 10) / this.scaleY;
    body.setOffset(offsetX, offsetY);
    body.setBounce(0.2);
  }

  tick(delta: number): void {
    super.tick(delta);
    if (this.defeated) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setFlipX(body.velocity.x > 0);
  }
}
```

- [ ] **Step 2: Register `ant` + `cat` in `ENTITY_TEXTURE_KEYS`**

In `src/config/textures.ts`, replace the `ENTITY_TEXTURE_KEYS` object (currently lines 57-64) with:

```typescript
export const ENTITY_TEXTURE_KEYS: Record<string, readonly string[]> = {
  // Enemies
  dustBunny: [DUSTBUNNY_IDLE, DUSTBUNNY_WALK, DUSTBUNNY_ATTACK],
  spider: [SPIDER_IDLE, SPIDER_WALK, SPIDER_ATTACK],
  ant: [ANT],
  // Companions
  teddy: [TEDDY_IDLE, TEDDY_WALK],
  dog: [DOG_IDLE, DOG_WALK],
  cat: [CAT_IDLE, CAT_WALK],
};
```

(`ANT`, `CAT_IDLE`, `CAT_WALK` are already declared/imported in this file — confirmed at lines 24-25, 40.)

- [ ] **Step 3: Verify typecheck + texture smoke test pass**

Run: `npm run typecheck && npx vitest run src/levels/levelTextures.test.ts src/levels/levelCatalog.smoke.test.ts`
Expected: typecheck clean; smoke tests PASS (no Kitchen levels in the catalog yet, so this confirms no regression).

- [ ] **Step 4: Commit**

```bash
git add src/entities/Ant.ts src/config/textures.ts
git commit -m "feat(kitchen): Ant entity (stomp-patroller reskin) + register ant/cat textures"
```

---

## Task 2: GameScene ant spawn branch + explicit else guard

**Files:**
- Modify: `src/scenes/GameScene.ts` (import block; enemy spawn loop at lines 297-304)

This also pays down the debt flagged after Hallway: an unhandled enemy type currently `continue`s **silently**. Make the gap loud.

- [ ] **Step 1: Import `Ant`**

Add to the entity imports near the top of `src/scenes/GameScene.ts` (alongside the existing `import { Spider } from "../entities/Spider";`):

```typescript
import { Ant } from "../entities/Ant";
```

- [ ] **Step 2: Add the `ant` branch + `else` guard**

In `src/scenes/GameScene.ts`, replace this block (lines 297-304):

```typescript
    for (const spawn of data.enemies) {
      let enemy: Enemy | null = null;
      if (spawn.type === "dustBunny") {
        enemy = new DustBunny(this, spawn);
      } else if (spawn.type === "spider") {
        enemy = new Spider(this, spawn);
      }
      if (!enemy) continue;
```

with:

```typescript
    for (const spawn of data.enemies) {
      let enemy: Enemy | null = null;
      if (spawn.type === "dustBunny") {
        enemy = new DustBunny(this, spawn);
      } else if (spawn.type === "spider") {
        enemy = new Spider(this, spawn);
      } else if (spawn.type === "ant") {
        enemy = new Ant(this, spawn);
      } else {
        // Explicit guard: an unhandled enemy type (e.g. dustMite before the
        // Family Room wires it) would otherwise vanish silently. Make it loud.
        console.warn(`[GameScene] Unhandled enemy type "${spawn.type}" — not spawned.`);
      }
      if (!enemy) continue;
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: clean (no type errors — `Ant` extends `Enemy`, assignable to the `enemy` variable).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat(kitchen): GameScene ant spawn branch + loud else guard for unhandled enemy types"
```

---

## Task 3: `requires:"dash"` sketch passthrough (TDD)

**Files:**
- Modify: `src/design/levelSketches.ts` (`SketchPlatform` type, ~line 28)
- Modify: `src/design/combineSlot.ts` (platform push, ~line 86)
- Modify: `src/levels/encodeFromSketch.ts` (platforms local type line 79; floating-platforms loop lines 105-113)
- Test: `src/levels/encodeFromSketch.elements.test.ts` (new)

The dash *edge* already exists in `reachability.ts` and `PlatformSchema.requires` already exists in `LevelData`. This task only lets a **sketch** platform carry the tag and flows it through `combineSlot` → encoder.

- [ ] **Step 1: Write the failing test**

Create `src/levels/encodeFromSketch.elements.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encodeSlotToLevelData } from "./encodeFromSketch";
import { parseLevelData } from "../types/level";
import { DESIGN_FLOOR_Y } from "../config/backgrounds";
import type { LevelSlot, LevelOption } from "../design/levelSketches";

const GRID = 32;
const EXIT_H = 52;

/** A one-option slot for exercising encoder element passthrough. */
function slotWith(opt: Partial<LevelOption>): LevelSlot {
  const base: LevelOption = {
    variant: "A",
    source: "test",
    approxSeconds: 10,
    widthGrids: 22,
    heightGrids: 9,
    spawn: { x: 1, y: 0 },
    exit: { x: 21, y: 0 },
    platforms: [],
    zones: [],
    pits: [],
  };
  return { id: 1, name: "T", intent: "t", options: [{ ...base, ...opt }] };
}

describe("encoder — requires:'dash' passthrough", () => {
  it("tags the encoded platform with requires:'dash'", () => {
    const slot = slotWith({ platforms: [{ x: 10, y: 4, w: 3, requires: "dash" }] });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    const dashPlat = level.platforms.find((p) => p.requires === "dash");
    expect(dashPlat, "no platform carried requires:'dash'").toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/levels/encodeFromSketch.elements.test.ts`
Expected: FAIL — `dashPlat` is `undefined` (the tag is dropped today), OR a TS error on `requires` not existing on `SketchPlatform`.

- [ ] **Step 3: Add `requires` to `SketchPlatform`**

In `src/design/levelSketches.ts`, replace the `SketchPlatform` type:

```typescript
export type SketchPlatform = {
  x: number;
  y: number;
  w: number;
  /** Marks this platform as the far side of a DASH gap. Reachability grants the
   *  crossing only when dash is unlocked and the gap is flat/downhill and within
   *  the dash lunge. Author the launch surface and this platform > double-jump
   *  flat reach apart (so only dash reaches it). */
  requires?: "dash";
};
```

- [ ] **Step 4: Preserve `requires` when chaining in `combineSlot`**

In `src/design/combineSlot.ts`, replace the platform-push loop (currently `for (const p of opt.platforms) { platforms.push({ x: p.x + xCursor, y: p.y, w: p.w }); }`):

```typescript
    for (const p of opt.platforms) {
      platforms.push({
        x: p.x + xCursor,
        y: p.y,
        w: p.w,
        ...(p.requires ? { requires: p.requires } : {}),
      });
    }
```

- [ ] **Step 5: Pass `requires` through in the encoder**

In `src/levels/encodeFromSketch.ts`, first widen the `platforms` local type (line 79) to carry the tag:

```typescript
  const platforms: Array<{ x: number; y: number; w: number; h: number; color?: string; requires?: "dash" }> = [];
```

Then replace the floating-platforms loop (lines 105-113):

```typescript
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/levels/encodeFromSketch.elements.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/design/levelSketches.ts src/design/combineSlot.ts src/levels/encodeFromSketch.ts src/levels/encodeFromSketch.elements.test.ts
git commit -m "feat(kitchen): author requires:'dash' on sketch platforms (encoder passthrough)"
```

---

## Task 4: `climbWalls` sketch element (TDD)

**Files:**
- Modify: `src/design/levelSketches.ts` (new `SketchClimbWall` type; `LevelOption.climbWalls?`)
- Modify: `src/design/combineSlot.ts` (import; `CombinedLevel.climbWalls`; chain loop; return)
- Modify: `src/levels/encodeFromSketch.ts` (emit `climbWalls`)
- Test: `src/levels/encodeFromSketch.elements.test.ts` (add a case)

`ClimbWallSchema` already exists in `LevelData` and `GameScene.buildLevel` already renders `data.climbWalls` (lines 268-274). This task makes a climb wall **author-able from a sketch**.

Encoding contract (so the wall connects floor → counter per `surfaceTouchesWall`): sketch `{ x, y, h, w? }` in grid units (y = base height from floor, h = height in grids, w = width in grids, default 1) translates to game coords with the wall's **bottom at the base** (`DESIGN_FLOOR_Y - y*GRID`) and **top h grids above** it. Author `y: 0, h: counterHeightGrids + 1` so the span covers both the floor top and the counter top.

- [ ] **Step 1: Add the failing test case**

Append to `src/levels/encodeFromSketch.elements.test.ts`:

```typescript
describe("encoder — climbWalls element", () => {
  it("emits a game-coord climbWall spanning floor → counter", () => {
    const slot = slotWith({
      platforms: [{ x: 10, y: 6, w: 4 }],   // counter 6 grids up
      climbWalls: [{ x: 10, y: 0, h: 7 }],   // floor → counter face (height 6 + 1)
    });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.climbWalls?.length).toBe(1);
    const w = level.climbWalls![0]!;
    expect(w.x).toBe(10 * GRID);
    expect(w.y).toBe(DESIGN_FLOOR_Y - 7 * GRID);     // top: 7 grids up
    expect(w.y + w.h).toBe(DESIGN_FLOOR_Y);          // bottom: at the floor top
    expect(w.w).toBe(GRID);                          // default width 1 grid
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/levels/encodeFromSketch.elements.test.ts -t climbWalls`
Expected: FAIL — `level.climbWalls` is `undefined`, OR a TS error on `climbWalls` not existing on `LevelOption`.

- [ ] **Step 3: Add the sketch types**

In `src/design/levelSketches.ts`, add a new type after `SketchPit` and add `climbWalls?` to `LevelOption`:

```typescript
export type SketchClimbWall = {
  /** Left grid column of the climbable wall (usually a counter's near edge). */
  x: number;
  /** Base height in grids (0 = floor). */
  y: number;
  /** Height in grids. Use counterHeightGrids + 1 so the span covers the floor
   *  top AND the counter top (reachability connects surfaces that both touch it). */
  h: number;
  /** Width in grids; defaults to 1 (a thin face). */
  w?: number;
};
```

In the `LevelOption` type, add the field after `pits`:

```typescript
  /** Vertical climbable faces (wall-climb element). Counters in the Kitchen. */
  climbWalls?: SketchClimbWall[];
```

- [ ] **Step 4: Chain climbWalls in `combineSlot`**

In `src/design/combineSlot.ts`:

(a) Add `SketchClimbWall` to the type import from `./levelSketches`.

(b) Add to the `CombinedLevel` type (after `pits: SketchPit[];`):

```typescript
  climbWalls: SketchClimbWall[];
```

(c) Declare the accumulator alongside the others (after `const pits: SketchPit[] = [];`):

```typescript
  const climbWalls: SketchClimbWall[] = [];
```

(d) Inside the segment loop, after the `pits` push loop, add:

```typescript
    for (const c of opt.climbWalls ?? []) {
      climbWalls.push({ ...c, x: c.x + xCursor });
    }
```

(e) Add `climbWalls,` to the returned object (after `pits,`).

- [ ] **Step 5: Emit climbWalls in the encoder**

In `src/levels/encodeFromSketch.ts`, after the floating-platforms loop (before the Tokens section), add:

```typescript
  // ── Climb walls (vertical climbable faces; wall-climb element) ────────
  const climbWalls = combined.climbWalls.map((c) => ({
    x: c.x * GRID_PX,
    y: DESIGN_FLOOR_Y - (c.y + c.h) * GRID_PX,
    w: (c.w ?? 1) * GRID_PX,
    h: c.h * GRID_PX,
  }));
```

Then add it to the returned object (after `platforms,`, mirroring the optional `companion` spread):

```typescript
    ...(climbWalls.length ? { climbWalls } : {}),
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/levels/encodeFromSketch.elements.test.ts`
Expected: PASS (both element suites).

- [ ] **Step 7: Commit**

```bash
git add src/design/levelSketches.ts src/design/combineSlot.ts src/levels/encodeFromSketch.ts src/levels/encodeFromSketch.elements.test.ts
git commit -m "feat(kitchen): author climbWalls from sketches (combineSlot chaining + encoder emit)"
```

---

## Task 5: Elevatable exit — honor `combined.exit.y` (TDD)

**Files:**
- Modify: `src/levels/encodeFromSketch.ts` (exit block, lines 154-160)
- Test: `src/levels/encodeFromSketch.elements.test.ts` (add a case)

The encoder hardcodes the exit to floor level, ignoring `combined.exit.y`. Honoring it lets a slot place its exit up on a counter (climb-only) or a high shelf. Backward-compatible: existing sketches use `exit.y: 0`, so their encoded exit is unchanged.

- [ ] **Step 1: Add the failing test case**

Append to `src/levels/encodeFromSketch.elements.test.ts`:

```typescript
describe("encoder — elevatable exit", () => {
  it("floor-level exit (y=0) is unchanged", () => {
    const slot = slotWith({ exit: { x: 21, y: 0 } });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.exit.y).toBe(DESIGN_FLOOR_Y - EXIT_H + 4);
  });
  it("elevated exit (y=6) sits 6 grids up", () => {
    const slot = slotWith({ exit: { x: 21, y: 6 } });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.exit.y).toBe(DESIGN_FLOOR_Y - 6 * GRID - EXIT_H + 4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/levels/encodeFromSketch.elements.test.ts -t "elevated exit"`
Expected: FAIL — elevated case returns the floor-level y (the `y=6` is ignored today).

- [ ] **Step 3: Honor `combined.exit.y` in the encoder**

In `src/levels/encodeFromSketch.ts`, replace the exit block (lines 154-160):

```typescript
  // ── Exit zone (hovers above its surface; y honors sketch height) ──────
  const exit = {
    x: combined.exit.x * GRID_PX,
    y: DESIGN_FLOOR_Y - combined.exit.y * GRID_PX - EXIT_H + 4,
    w: EXIT_W,
    h: EXIT_H,
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/levels/encodeFromSketch.elements.test.ts`
Expected: PASS (all element suites).

- [ ] **Step 5: Verify Bedroom + Hallway are unaffected**

Run: `npx vitest run src/levels/hallway.integration.test.ts src/levels/reachability.integration.test.ts`
Expected: PASS (existing sketches use `exit.y: 0`, so encoded exits are identical).

- [ ] **Step 6: Commit**

```bash
git add src/levels/encodeFromSketch.ts src/levels/encodeFromSketch.elements.test.ts
git commit -m "feat(kitchen): elevatable exit — encoder honors combined.exit.y (backward-compatible)"
```

---

## Task 6: `metAtStart` gating evolution (TDD)

**Files:**
- Modify: `src/config/companions.ts` (`CompanionDef` interface; `cat` entry)
- Modify: `src/config/gating.ts` (`abilitiesForArea`)
- Modify: `src/config/gating.test.ts:8` (Kitchen set now includes `wallClimb`)
- Test: `src/config/gating.metAtStart.test.ts` (new)

Puts wall-climb in the Kitchen's own ability set so climbing is load-bearing *in* the Kitchen. Contained: only `cat` opts in; Bedroom/Hallway and `gatingPower` are untouched.

- [ ] **Step 1: Write the failing test**

Create `src/config/gating.metAtStart.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { abilitiesForArea, gatingPower } from "./gating";

describe("metAtStart — Cat's climbing is available IN the Kitchen", () => {
  it("abilitiesForArea('kitchen') includes wallClimb", () => {
    expect(abilitiesForArea("kitchen").has("wallClimb")).toBe(true);
  });
  it("still includes inherited doubleJump + dash", () => {
    const set = abilitiesForArea("kitchen");
    expect(set.has("doubleJump")).toBe(true);
    expect(set.has("dash")).toBe(true);
  });
  it("Hallway is unchanged (Dog is met at the finale — dash NOT in its own set)", () => {
    const set = abilitiesForArea("hallway");
    expect(set.has("doubleJump")).toBe(true);
    expect(set.has("dash")).toBe(false);
  });
  it("Kitchen's gate is still dash (the previous area's companion grant)", () => {
    expect(gatingPower("kitchen")).toBe("dash");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/gating.metAtStart.test.ts`
Expected: FAIL — `abilitiesForArea('kitchen')` does not yet include `wallClimb`.

- [ ] **Step 3: Add `metAtStart` to `CompanionDef` and set it on `cat`**

In `src/config/companions.ts`, add the field to the interface:

```typescript
export interface CompanionDef {
  area: AreaId;
  grants: AbilityId;
  idleKey: string;
  walkKey: string;
  heartBonus?: number;
  /** Met at the START of its home area (power usable in-area), not the finale.
   *  Evolves the default offset model; opt-in per companion. */
  metAtStart?: boolean;
}
```

And update the `cat` entry:

```typescript
  cat:      { area: "kitchen",    grants: "wallClimb",  idleKey: CAT_IDLE,      walkKey: CAT_WALK, metAtStart: true },
```

- [ ] **Step 4: Add the own-companion grant in `abilitiesForArea`**

In `src/config/gating.ts`, in `abilitiesForArea`, add before `return set;`:

```typescript
  // Companions flagged metAtStart are met early — their power is usable in
  // their OWN home area (not just the next). Default (offset) companions skip this.
  const own = companionForArea(area);
  if (own && COMPANIONS[own].metAtStart) set.add(COMPANIONS[own].grants);
  return set;
```

- [ ] **Step 5: Update the existing gating assertion**

In `src/config/gating.test.ts`, replace line 8:

```typescript
    expect([...abilitiesForArea("kitchen")].sort()).toEqual(["dash", "doubleJump"]);
```

with:

```typescript
    // Cat is metAtStart, so the Kitchen's own set now includes wallClimb.
    expect([...abilitiesForArea("kitchen")].sort()).toEqual(["dash", "doubleJump", "wallClimb"]);
```

(Line 9 — `abilitiesForArea("dollhouse").size === 5` — is unchanged: the boss area has no own companion, and Cat's wallClimb was already counted there via the previous-areas loop.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/config/gating.metAtStart.test.ts src/config/gating.test.ts src/config/companions.test.ts`
Expected: PASS (all three).

- [ ] **Step 7: Commit**

```bash
git add src/config/companions.ts src/config/gating.ts src/config/gating.test.ts src/config/gating.metAtStart.test.ts
git commit -m "feat(kitchen): metAtStart — Cat met early, wallClimb load-bearing in the Kitchen"
```

---

## Task 7: Phase 0 checkpoint — full build green

**Files:** none (verification only)

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: tsc clean; **all Vitest pass** (176 prior + the new element/gating tests); reachability lint over the whole catalog green (no Kitchen levels yet); texture smoke green; vite build ok. Bedroom + Hallway unchanged.

If anything fails, fix before proceeding — Phase 1 authoring assumes a green infra base.

---

# PHASE 1 — Author Kitchen Content (iterative)

## Task 8: Author `KITCHEN_SLOTS` (5 slots × A/B/C)

**Files:**
- Modify: `src/design/levelSketches.ts` (new `KITCHEN_SLOTS`; point `KITCHEN_AREA.slots` at it)

This is the **iterative authoring** phase: draft on `/maps.html`, run `npm run build`, and tune geometry until the reachability lint passes and (after Task 10) the integration proofs hold. The gate that controls each level's **exit** lives in the **C variant** (the last segment of `B→A→A→C`); spawn comes from B. B/A/A are gentler lead-ins to C's gate.

**Geometry targets** (from `physics.ts`; the lint is the source of truth — author, build, tune):
- Base flat reach ≈ 121px (3.8 grid) · double-jump flat reach ≈ 212px (6.6 grid) · dash lunge ≈ 320px (10 grid)
- Base apex ≈ 81px (2.5 grid) · double-jump apex ≈ 161px (5 grid)
- **Climb-only counter:** counter top **> 161px** above floor → author the floating platform at sketch **y ≥ 6** (y=6 → 206px up). Add a `climbWall { x: <counter left edge>, y: 0, h: <counterY + 1> }`.
- **Mandatory dash gap:** launch + landing both elevated **at equal height** (dash gains no altitude), facing edges **> 6.6 grid apart** (so double-jump can't), **≤ ~9 grid** (within the lunge). Landing platform tagged `requires: "dash"`. A pit (sink/stove) under the gap makes a fall lethal.
- **Elevated/over-pit exit:** put the exit `x` over a pit so no floor sits under it — only the climbed-to or dashed-to platform satisfies the exit check.

**Per-slot gate (C variant carries it):**

| Slot | C-variant gate | Proof it pins |
|------|----------------|---------------|
| 1 | Cat on the floor at a counter base → climb-only counter → exit elevated on it over a pit | not without `wallClimb` |
| 2 | Taller climb-only counter to the exit | not without `wallClimb` |
| 3 | Climb-only counter; optional dash branch for tokens | not without `wallClimb` |
| 4 | Counter-to-counter dash over the **sink** pit to the exit | not without `dash` |
| 5 | Dash over the **stove** pit, then climb a tall shelf to the elevated exit | not without `dash` AND not without `wallClimb` |

- [ ] **Step 1: Seed the climb gate — Slot 1, C variant (verified geometry)**

Use this as the literal starting point for `KITCHEN_SLOTS[0]`'s `C` option. The math is worked against `DESIGN_FLOOR_Y=168`, `GRID=32`, `PLATFORM_THICKNESS=14`, `EXIT_H=52`: counter top = `168 - 6*32 - 14 = -38` (206px above floor → climb-only); exit at x=20 over the pit (17–22) so only the counter (x 16–21 → 512–672px) sits under the exit zone (640–680px); the floor ends at x=17 (544px) and never reaches it.

```typescript
{
  variant: "C",
  source: "Pattern 2 + 14 — climb to Cat, climb-only exit (Kitchen signature)",
  note: "Cat on the floor at the counter base — meeting her (climbing) is mandatory to exit.",
  approxSeconds: 26,
  widthGrids: 22,
  heightGrids: 9,
  spawn: { x: 1, y: 0 },
  exit: { x: 20, y: 6 },                       // up on the counter, over the pit
  platforms: [{ x: 16, y: 6, w: 5 }],          // counter top -38 (206px up): climb-only
  climbWalls: [{ x: 16, y: 0, h: 7 }],         // floor → counter face at the counter's left edge
  zones: [
    { x: 4, y: 0, kind: "enemy" },             // ant trail on the floor
    { x: 7, y: 0, kind: "enemy" },
    { x: 15, y: 0, kind: "companion" },        // Cat at the counter base (comfortably reachable)
  ],
  pits: [{ x: 17, w: 5 }],                      // floor ends at 17 → nothing under the exit but the counter
},
```

- [ ] **Step 2: Seed the dash gate — Slot 4, C variant (verified geometry)**

Counter-to-counter over the sink. Launch counter (x 4–6, y=4) and landing counter (x 14–16, y=4, `requires:"dash"`) are at equal height; facing edges 192px → 448px = **256px** apart (> 212, < 320). The sink pit (6–14) makes the floor-to-floor route impossible without dash and a fall lethal. Exit on the floor past the landing.

```typescript
{
  variant: "C",
  source: "Pattern 5 + 8 — counter-to-counter dash over the sink",
  note: "Sink pit. Dash is the only crossing (256px gap > double-jump 212).",
  approxSeconds: 24,
  widthGrids: 20,
  heightGrids: 7,
  spawn: { x: 1, y: 0 },
  exit: { x: 17, y: 0 },
  platforms: [
    { x: 4, y: 4, w: 2 },                       // launch counter (reachable by double-jump/climb)
    { x: 14, y: 4, w: 2, requires: "dash" },    // landing counter — dash-only
  ],
  zones: [{ x: 2, y: 0, kind: "enemy" }],
  pits: [{ x: 6, w: 8 }],                        // the sink: 256px, lethal, un-walkable
},
```

- [ ] **Step 3: Seed the combo gate — Slot 5, C variant (verified geometry)**

Dash over the stove (pit 6–14) to a landing counter, then climb a tall shelf (y=8 → top -102, 270px up → climb-only) to the elevated exit (x=20, over pit 18–22 so only the shelf is under it).

```typescript
{
  variant: "C",
  source: "Pattern 7 + 12 — stove dash → climb to Cat's shelf (combo finale)",
  note: "Both powers on the critical path: dash over the stove, then climb to the exit.",
  approxSeconds: 30,
  widthGrids: 22,
  heightGrids: 10,
  spawn: { x: 1, y: 0 },
  exit: { x: 20, y: 8 },                         // up on the shelf, over the right pit
  platforms: [
    { x: 4, y: 4, w: 2 },                        // launch counter
    { x: 14, y: 4, w: 2, requires: "dash" },     // landing counter — dash over the stove
    { x: 17, y: 8, w: 4 },                        // exit shelf, top -102 (270px up): climb-only
  ],
  climbWalls: [{ x: 17, y: 0, h: 9 }],           // floor(14–18) → shelf face
  zones: [{ x: 2, y: 0, kind: "enemy" }],
  pits: [{ x: 6, w: 8 }, { x: 18, w: 4 }],        // stove (lethal dash gap) + exit pit
},
```

- [ ] **Step 4: Author the remaining variants (B, A, A·2 for each slot; C for slots 2–3)**

Following the patterns above and the `B→A→A→C` escalation (gentle warmup → research-baseline → mastery repeat → gated twist):
- **B/A variants** are the gentle lead-ins on the floor + low counters (ant trails, optional dash spills for tokens, easy climbs). **No lethal pits in slots 1–3** (forgiveness curve). Their `exit` values are dropped by `combineSlot` (only C's exit is the level exit), so author them as continuous floor sections that hand off into the next segment.
- **Slot 2 / Slot 3 C variants** reuse the Slot 1 climb-gate pattern (taller counters; Slot 3 adds an optional `requires:"dash"` branch to bonus tokens that the base path skips).
- Keep each slot's `widthGrids` consistent across its variants enough to chain cleanly. Mirror the structure of `HALLWAY_SLOTS` in the same file for the non-gate scaffolding (token breadcrumbs, rest beats).

Point `KITCHEN_AREA.slots` at the new const — in `src/design/levelSketches.ts` replace:

```typescript
  slots: stubSlots("the kitchen", "Cat", "ant"),
```

with:

```typescript
  slots: KITCHEN_SLOTS,
```

(Declare `export const KITCHEN_SLOTS: LevelSlot[] = [ ... ]` above `KITCHEN_AREA`, with all 5 slots.)

- [ ] **Step 5: Iterate against the lint on `/maps.html` + build**

Run the dev server (`npm run dev`) and open `/maps.html` — confirm Kitchen shows **15/15 drafted** and the gates read visually. Then:

Run: `npm run build`
Expected: the reachability lint passes for all 5 Kitchen levels with `abilitiesForArea("kitchen") = {doubleJump, dash, wallClimb}`. If a level reports `exit-unreachable` or `companion-stranded`, widen/narrow the offending gap or counter height and re-run. **Do not** loosen a gate to pass — the not-without proofs in Task 10 must still fail correctly.

- [ ] **Step 6: Commit**

```bash
git add src/design/levelSketches.ts
git commit -m "feat(kitchen): author 15 Kitchen variants — climb ascent + dash gates (sketch-driven)"
```

---

# PHASE 2 — Pipeline Switch

## Task 9: `kitchenLevels.ts` + catalog wiring

**Files:**
- Create: `src/levels/kitchenLevels.ts`
- Modify: `src/levels/levelCatalog.ts` (import; `KITCHEN_ENTRIES`; `LEVEL_CATALOG`)

- [ ] **Step 1: Create `src/levels/kitchenLevels.ts`**

```typescript
import { KITCHEN_AREA } from "../design/levelSketches";
import { encodeAreaLevels } from "./encodeFromSketch";
import type { LevelData } from "../types/level";

/**
 * Kitchen levels — auto-generated from KITCHEN_AREA sketches via encodeFromSketch.
 * Each slot's B → A → A → C variants chain into one continuous level.
 *
 * Gates: wall-climb (Cat, met early) for the ascent; dash (Dog, from Hallway)
 * for the sink/stove leaps. Companion earned here: Cat (grants wall-climb).
 */
const SEGMENT_ORDER = ["B", "A", "A", "C"];

export const KITCHEN_LEVELS = encodeAreaLevels(KITCHEN_AREA, SEGMENT_ORDER) as LevelData[];
```

- [ ] **Step 2: Wire `KITCHEN_ENTRIES` into the catalog**

In `src/levels/levelCatalog.ts`, add the import after the Hallway import:

```typescript
import { KITCHEN_LEVELS } from "./kitchenLevels";
```

Add the entries block after `HALLWAY_ENTRIES`:

```typescript
const KITCHEN_ENTRIES: LevelCatalogEntry[] = KITCHEN_LEVELS.map((level, index) => ({
  areaId: "kitchen",
  backgroundKey: `${PLACEHOLDER_BG.key}_k_${index}`,
  backgroundUrl: PLACEHOLDER_BG.url,
  raw: level as unknown as LevelData,
}));
```

And extend `LEVEL_CATALOG`:

```typescript
export const LEVEL_CATALOG: LevelCatalogEntry[] = [...BEDROOM_ENTRIES, ...HALLWAY_ENTRIES, ...KITCHEN_ENTRIES];
```

- [ ] **Step 3: Verify the catalog + smoke tests pass**

Run: `npx vitest run src/levels/levelCatalog.smoke.test.ts src/levels/levelTextures.test.ts`
Expected: PASS — every Kitchen level is Zod-valid and references only loaded sprites (`ant` enemy + `cat` companion are registered from Task 1).

- [ ] **Step 4: Commit**

```bash
git add src/levels/kitchenLevels.ts src/levels/levelCatalog.ts
git commit -m "feat(kitchen): sketch-driven kitchenLevels + catalog wiring (5 levels live)"
```

---

# PHASE 3 — Auto-Proof + Polish

## Task 10: `kitchen.integration.test.ts` — two-gate proof

**Files:**
- Test: `src/levels/kitchen.integration.test.ts` (new)

Pins the metroidvania guarantee: solvable with the full Kitchen loadout; the **climb** gate bites (slots 1–3 ascent) and the **dash** gate bites (slots 4–5); slot 5 needs **both**.

- [ ] **Step 1: Write the test**

Create `src/levels/kitchen.integration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encodeAreaLevels } from "./encodeFromSketch";
import { KITCHEN_AREA } from "../design/levelSketches";
import { checkReachability } from "./reachability";
import { abilitiesForArea } from "../config/gating";
import { parseLevelData, type LevelData } from "../types/level";

const SEGMENT_ORDER = ["B", "A", "A", "C"];
const FULL = abilitiesForArea("kitchen"); // { doubleJump, dash, wallClimb }

function kitchenLevels(): LevelData[] {
  return (encodeAreaLevels(KITCHEN_AREA, SEGMENT_ORDER) as unknown[]).map(parseLevelData);
}
const byId = (id: string) => kitchenLevels().find((l) => l.id === id);
const errorsFor = (level: LevelData, abilities: Set<string>) =>
  checkReachability(level, { abilities: abilities as Set<any> }).problems.filter((p) => p.severity === "error");

describe("Kitchen — every authored level is completable with the full loadout", () => {
  const levels = kitchenLevels();
  it("has 5 levels authored", () => {
    expect(levels.length).toBe(5);
  });
  for (const level of levels) {
    it(`${level.id} — solvable WITH {doubleJump, dash, wallClimb}`, () => {
      const errors = errorsFor(level, FULL);
      expect(errors, errors.map((e) => e.message).join(" | ")).toHaveLength(0);
    });
  }
});

describe("Kitchen — the climb gate bites (ascent, slot 1)", () => {
  it("kitchen-1 is NOT solvable without wallClimb", () => {
    const level = byId("kitchen-1");
    expect(level, "kitchen-1 not authored").toBeDefined();
    expect(errorsFor(level!, new Set(["doubleJump", "dash"])).length).toBeGreaterThan(0);
  });
});

describe("Kitchen — the dash gate bites (slots 4 & 5)", () => {
  for (const id of ["kitchen-4", "kitchen-5"]) {
    it(`${id} is NOT solvable without dash`, () => {
      const level = byId(id);
      expect(level, `${id} not authored`).toBeDefined();
      expect(errorsFor(level!, new Set(["doubleJump", "wallClimb"])).length).toBeGreaterThan(0);
    });
  }
});

describe("Kitchen — the combo finale needs BOTH (slot 5)", () => {
  it("kitchen-5 fails without dash (stove blocks) and without climb (exit shelf blocks)", () => {
    const level = byId("kitchen-5");
    expect(level, "kitchen-5 not authored").toBeDefined();
    expect(errorsFor(level!, new Set(["doubleJump", "wallClimb"])).length, "no-dash should block").toBeGreaterThan(0);
    expect(errorsFor(level!, new Set(["doubleJump", "dash"])).length, "no-climb should block").toBeGreaterThan(0);
  });
});

describe("Kitchen — Cat is comfortably reachable (slot 1)", () => {
  it("no companion-stranded with the full loadout", () => {
    const level = byId("kitchen-1");
    expect(level, "kitchen-1 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: FULL });
    expect(r.problems.find((p) => p.kind === "companion-stranded")?.message).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/levels/kitchen.integration.test.ts`
Expected: PASS. If a "NOT solvable without X" assertion fails (i.e., the level IS solvable without the power), the gate is too weak — return to Task 8 and widen the gap / raise the counter so only the gated power crosses it, then re-run. This is the convergence loop between authoring (Task 8) and proof (this task).

- [ ] **Step 3: Commit**

```bash
git add src/levels/kitchen.integration.test.ts
git commit -m "test(kitchen): two-gate auto-proof — climb + dash load-bearing, combo finale"
```

---

## Task 11: "Press ↑ to climb!" tutorial prompt

**Files:**
- Modify: `src/scenes/GameScene.ts` (climb-walls block, lines 268-274)

A lightweight in-level hint at the first climb wall (the interim "meet Cat, learn to climb" moment — the full scripted cutscene is ROADMAP 7.3.5). Reuses the existing `PowerUnlockScene` (already fires on Cat pickup).

- [ ] **Step 1: Add the prompt at the first climb wall**

In `src/scenes/GameScene.ts`, replace the climb-walls loop (lines 268-274):

```typescript
    const climbWalls = data.climbWalls ?? [];
    for (const c of climbWalls) {
      const rect = this.add.rectangle(c.x + c.w / 2, c.y + c.h / 2, c.w, c.h, 0x8fbf8f, 0.3);
      rect.setDepth(10);
      this.climbWallVisuals.push(rect);
    }
    this.player.setClimbWalls(climbWalls);
```

with:

```typescript
    const climbWalls = data.climbWalls ?? [];
    climbWalls.forEach((c, i) => {
      const rect = this.add.rectangle(c.x + c.w / 2, c.y + c.h / 2, c.w, c.h, 0x8fbf8f, 0.3);
      rect.setDepth(10);
      this.climbWallVisuals.push(rect);
      // Tutorial hint at the first climb wall of the level (Kitchen's "learn to
      // climb" interim; full cutscene is ROADMAP 7.3.5). Hint reads "↑" above the wall.
      if (i === 0) {
        const hint = this.add.text(c.x + c.w / 2, c.y - 8, "Press ↑ to climb!", {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#2b2b2b",
          backgroundColor: "#fff6e6",
          padding: { x: 4, y: 2 },
        });
        hint.setOrigin(0.5, 1);
        hint.setDepth(30);
        this.climbWallVisuals.push(hint);
      }
    });
    this.player.setClimbWalls(climbWalls);
```

(The prompt is pushed into `climbWallVisuals`, which `buildLevel` already clears on rebuild at line 516 — no leak.)

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat(kitchen): 'Press ↑ to climb!' prompt at the first climb wall (interim cutscene)"
```

---

## Task 12: Final build + manual-playtest handoff

**Files:** none (verification only)

- [ ] **Step 1: Full build green**

Run: `npm run build`
Expected: tsc clean; **all Vitest pass** (176 prior + element/gating/kitchen tests); reachability lint green over the **whole catalog including the 5 Kitchen levels**; texture smoke green; vite build ok.

- [ ] **Step 2: Runtime smoke (dev preview)**

Run `npm run dev`, open the game. Continue/console-load into the Kitchen. Confirm: ants render + patrol; the climb hint shows; counters are climbable (Up/W); the sink/stove dash gaps cross with the power button; Cat pickup fires `PowerUnlockScene`; `/maps.html` shows Kitchen **15/15 drafted**; no console errors.

- [ ] **Step 3: Note the manual-playtest handoff**

Phaser ignores synthetic input, so *feel* (climb speed, dash-gap widths, ant hitboxes, Cat-before-first-climb ordering in slot 1) is a human handoff — same pattern as every prior area/power. Mechanical correctness is lint- + test-proven. Record any tuning notes in `PROGRESS.md`.

---

## Self-Review (completed)

- **Spec coverage:** §3.1 Ant → Tasks 1–2; §3.2 two sketch elements → Tasks 3–4; elevatable exit (needed for §2.3/§4 climb-only exits) → Task 5; §2.1 metAtStart → Task 6; §4 content → Task 8; §5 pipeline switch → Task 9; §6 auto-proof → Task 10; §7 climb prompt → Task 11; §3.3 texture keys → Task 1. All covered.
- **Placeholder scan:** every code step shows complete code; the only intentionally-iterative step is Task 8 (hand-authored level content), which ships verified seed literals + geometry targets + a convergence loop against Task 10's proofs — the honest structure for lint-tuned content (matches the Hallway build).
- **Type consistency:** `SketchPlatform.requires?: "dash"`, `SketchClimbWall`, `LevelOption.climbWalls?`, `CombinedLevel.climbWalls`, `CompanionDef.metAtStart?` are defined before use; `encodeSlotToLevelData(slot, order, idPrefix, primaryEnemy, companionType)` signature matches every call; level ids `kitchen-1`…`kitchen-5` match the encoder's `${idPrefix}-${slot.id}` with `idPrefix="kitchen"`.
