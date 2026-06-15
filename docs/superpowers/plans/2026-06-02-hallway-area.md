# Hallway Area (World 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Hallway area (World 2) — 5 levels at Bedroom parity, authored through the sketch→encode pipeline, where double-jump is a provably load-bearing gate and the player earns Dog → dash.

**Architecture:** Phase P0 generalizes the reusable encoder/schema/enemy infra (every later area reuses it) and refines the gate-proof test from per-level to per-area. Phase P1 authors the 15 sketch variants with an escalating double-jump gate, verified by a sketch-encoded reachability test. Phase P2 atomically switches `hallwayLevels.ts` to sketch-driven. Phase P3 does final runtime verification. Build stays green at every commit.

**Tech Stack:** Phaser 3.80, TypeScript (strict), Vite 6, Zod (level schema), Vitest. Level data flows `levelSketches.ts → combineSlot → encodeFromSketch → LevelData (Zod-validated) → reachability lint`.

**Spec:** `docs/superpowers/specs/2026-06-02-hallway-area-design.md`

---

## File Structure

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `src/types/level.ts` | Modify (line 49) | Widen enemy `type` literal → enum |
| `src/entities/Spider.ts` | **Create** | Spider enemy (sibling of `DustBunny` under `Enemy`) |
| `src/scenes/GameScene.ts` | Modify (~24, ~296, ~413) | Spider instantiation + widen enemies array + stomp check |
| `src/levels/encodeFromSketch.ts` | Modify | Derive enemy/companion type from the area, not hardcoded |
| `src/levels/encodeFromSketch.test.ts` | **Create** | Unit-test the encoder generalization |
| `src/levels/reachability.integration.test.ts` | Modify (describe #2) | Gate proof: per-level → per-area |
| `src/design/levelSketches.ts` | Modify (`HALLWAY_AREA`) | Author the 15 Hallway variants |
| `src/levels/hallway.integration.test.ts` | **Create** | Hallway auto-proof + authoring feedback harness |
| `src/levels/hallwayLevels.ts` | Modify | Switch hand-authored literal → `encodeAreaLevels(...)` |

**Green-build sequencing note:** the hand-authored `hallwayLevels.ts` "First Leap" level stays in the catalog through all of P0 and P1. It is fully double-jump-gated, so it satisfies the per-area gate proof (P0 Task 5) on its own. P1 authors content but does **not** put it in the catalog — content is verified through `hallway.integration.test.ts`, which encodes `HALLWAY_AREA` directly. Only P2 (after all 5 slots exist, so the per-area proof is satisfied by slots 4–5) switches the catalog over. This is why authoring precedes the pipeline switch.

---

# PHASE P0 — Reusable Infrastructure

## Task 1: Widen the enemy-type Zod schema

**Files:**
- Modify: `src/types/level.ts:48-55`
- Test: `src/types/level.test.ts` (**create**)

- [ ] **Step 1: Write the failing test**

Create `src/types/level.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseLevelData } from "./level";

const baseLevel = {
  id: "t", name: "t",
  spawn: { x: 10, y: 10 }, killY: 240,
  bounds: { minX: 0, maxX: 100, minY: -100, maxY: 200 },
  platforms: [{ x: 0, y: 168, w: 100, h: 32 }],
  exit: { x: 90, y: 120, w: 40, h: 52 },
};

describe("enemy type schema", () => {
  it("accepts a spider enemy", () => {
    const data = parseLevelData({
      ...baseLevel,
      enemies: [{ type: "spider", x: 50, y: 168, patrolLeft: 40, patrolRight: 60, speed: 45 }],
    });
    expect(data.enemies[0]!.type).toBe("spider");
  });

  it("still accepts a dustBunny enemy", () => {
    const data = parseLevelData({
      ...baseLevel,
      enemies: [{ type: "dustBunny", x: 50, y: 168, patrolLeft: 40, patrolRight: 60, speed: 45 }],
    });
    expect(data.enemies[0]!.type).toBe("dustBunny");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/types/level.test.ts`
Expected: FAIL — the spider case throws a ZodError (`Invalid literal value, expected "dustBunny"`).

- [ ] **Step 3: Widen the schema**

In `src/types/level.ts`, change line 49 inside `EnemySpawnSchema`:

```ts
export const EnemySpawnSchema = z.object({
  type: z.enum(["dustBunny", "spider", "ant", "dustMite"]),
  x: z.number(),
  y: z.number(),
  patrolLeft: z.number(),
  patrolRight: z.number(),
  speed: z.number().positive().default(40),
});
```

(All four runtime-stompable enemies for forward-compat; only `spider` is exercised by Hallway. `trex` is the boss — never an `EnemySpawn`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/types/level.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/types/level.ts src/types/level.test.ts
git commit -m "feat(level): widen enemy type schema to enum (spider/ant/dustMite)"
```

---

## Task 2: Create the Spider entity

**Files:**
- Create: `src/entities/Spider.ts`

Phaser sprite entities are not vitest-unit-tested in this codebase (they're verified at runtime); follow that convention. `Spider` mirrors `DustBunny` (`src/entities/DustBunny.ts`) exactly, swapping textures.

- [ ] **Step 1: Create the entity**

Create `src/entities/Spider.ts`:

```ts
import { RENDER_SCALE } from "../config/game";
import type { EnemySpawn } from "../types/level";
import { Enemy } from "./Enemy";
import { SPIDER_IDLE, SPIDER_WALK } from "../config/textures";
import { computeFeetOriginY } from "../systems/measureSpriteFeet";

type SpiderPose = "idle" | "walk";

const POSE_TEXTURE: Record<SpiderPose, string> = {
  idle: SPIDER_IDLE,
  walk: SPIDER_WALK,
};

export class Spider extends Enemy {
  private currentPose: SpiderPose = "idle";

  constructor(scene: Phaser.Scene, spawn: EnemySpawn) {
    super(scene, spawn.x, spawn.y, SPIDER_IDLE, undefined, spawn);
    const feetOriginY = computeFeetOriginY(scene, [SPIDER_IDLE, SPIDER_WALK]);
    this.setOrigin(0.5, feetOriginY);
    this.setScale(0.04 * RENDER_SCALE);

    // Body sized in WORLD units (Phaser multiplies setSize/setOffset by scaleX
    // at runtime, so pre-divide). Mirrors DustBunny; tune to spider proportions
    // at playtest if the hitbox reads off.
    const BODY_W = 50;
    const BODY_H = 40;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(BODY_W / this.scaleX, BODY_H / this.scaleY);
    const offsetX = (this.originX * this.displayWidth - BODY_W / 2) / this.scaleX;
    const offsetY = (this.originY * this.displayHeight - BODY_H - 10) / this.scaleY;
    body.setOffset(offsetX, offsetY);
    body.setBounce(0.2);
  }

  setPose(pose: SpiderPose): void {
    if (pose === this.currentPose) return;
    this.currentPose = pose;
    this.setTexture(POSE_TEXTURE[pose]);
  }

  tick(delta: number): void {
    super.tick(delta);
    if (this.defeated) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (Math.abs(body.velocity.x) > 1) {
      this.setPose("walk");
    } else {
      this.setPose("idle");
    }
    this.setFlipX(body.velocity.x > 0);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: clean (no errors). `defeated` is `protected` on `Enemy`, accessible in the subclass.

- [ ] **Step 3: Commit**

```bash
git add src/entities/Spider.ts
git commit -m "feat(entity): Spider — stomp-patroller sibling of DustBunny"
```

---

## Task 3: Wire Spider into GameScene

**Files:**
- Modify: `src/scenes/GameScene.ts` (field ~24, instantiation ~296-307, stomp ~413)

- [ ] **Step 1: Add the Spider import**

In `src/scenes/GameScene.ts`, below the existing `import { DustBunny } from "../entities/DustBunny";` line, add:

```ts
import { Spider } from "../entities/Spider";
```

- [ ] **Step 2: Widen the enemies field type**

Change the field declaration (currently `private enemies: DustBunny[] = [];`):

```ts
  private enemies: Enemy[] = [];
```

(`Enemy` is already imported.)

- [ ] **Step 3: Replace the enemy instantiation block**

Replace the `for (const spawn of data.enemies) { ... }` block (currently lines ~296-307) with:

```ts
    for (const spawn of data.enemies) {
      let enemy: Enemy | null = null;
      if (spawn.type === "dustBunny") {
        enemy = new DustBunny(this, spawn);
      } else if (spawn.type === "spider") {
        enemy = new Spider(this, spawn);
      }
      if (!enemy) continue;
      this.enemies.push(enemy);
      this.colliders.push(this.physics.add.collider(enemy, this.platformGroup));
      const e = enemy;
      this.overlaps.push(
        this.physics.add.overlap(this.player, e, () => {
          this.handleEnemyOverlap(e);
        }),
      );
    }
```

- [ ] **Step 4: Widen the stomp guard**

In `handleEnemyOverlap` (line ~413), change the guard so spiders are stompable too:

```ts
  private handleEnemyOverlap(enemy: Enemy): void {
    if (enemy.isDefeated()) {
      return;
    }
```

(The previous `!(enemy instanceof DustBunny)` excluded spiders. The handler only calls `enemy.defeat()` / `enemy.isDefeated()` — both on the `Enemy` base — and `isStomp` uses `enemy.body`, so no type-narrowing is needed.)

- [ ] **Step 5: Verify it compiles**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat(scene): instantiate + stomp Spider enemies in GameScene"
```

---

## Task 4: Generalize the encoder (enemy + companion type)

**Files:**
- Modify: `src/levels/encodeFromSketch.ts`
- Test: `src/levels/encodeFromSketch.test.ts` (**create**)

- [ ] **Step 1: Write the failing test**

Create `src/levels/encodeFromSketch.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { encodeAreaLevels } from "./encodeFromSketch";
import type { Area } from "../design/levelSketches";
import { parseLevelData } from "../types/level";

// Minimal one-slot area fixture: a spider on the floor + a Dog companion.
const FIXTURE: Area = {
  id: 99, name: "Fixture", worldKey: "Fixture",
  intent: "test", companion: "dog", primaryEnemy: "spider", carryOverEnemies: [],
  slots: [
    {
      id: 1, name: "s", intent: "s",
      options: [
        {
          variant: "A", source: "test", approxSeconds: 10,
          widthGrids: 12, heightGrids: 3,
          spawn: { x: 1, y: 0 }, exit: { x: 11, y: 0 },
          platforms: [],
          zones: [
            { x: 5, y: 0, kind: "enemy" },
            { x: 9, y: 0, kind: "companion", label: "Dog" },
          ],
        },
      ],
    },
  ],
};

describe("encoder derives enemy + companion type from the area", () => {
  it("emits a spider enemy and a dog companion", () => {
    const [level] = encodeAreaLevels(FIXTURE, ["A"]) as unknown[];
    const data = parseLevelData(level);
    expect(data.enemies[0]!.type).toBe("spider");
    expect(data.companion?.type).toBe("dog");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/levels/encodeFromSketch.test.ts`
Expected: FAIL — encoder emits `type: "dustBunny"` and `type: "teddy"` (hardcoded), so the spider assertion fails.

- [ ] **Step 3: Generalize the encoder**

In `src/levels/encodeFromSketch.ts`:

(a) Add imports at the top (after the existing imports):

```ts
import type { Area, EnemyType, CompanionType } from "../design/levelSketches";
```

(Replace the existing `import type { Area, LevelSlot } from "../design/levelSketches";` line — keep `LevelSlot`, add `EnemyType` and `CompanionType`:)

```ts
import { combineSlot } from "../design/combineSlot";
import type { Area, LevelSlot, EnemyType, CompanionType } from "../design/levelSketches";
import { DESIGN_FLOOR_Y } from "../config/backgrounds";
```

(b) Add the design→runtime enemy-type map below the existing constants (after `COMPANION_Y_OFFSET`):

```ts
/** Maps the design EnemyType (snake_case) to the runtime LevelData enemy type
 *  (camelCase). `trex` is the boss — never encoded through the slot pipeline;
 *  it maps to dustBunny only to keep the record total. */
const ENEMY_RUNTIME_TYPE: Record<EnemyType, "dustBunny" | "spider" | "ant" | "dustMite"> = {
  dust_bunny: "dustBunny",
  spider: "spider",
  ant: "ant",
  dust_mite: "dustMite",
  trex: "dustBunny",
};
```

(c) Change `encodeSlotToLevelData`'s signature to receive the enemy + companion type:

```ts
export function encodeSlotToLevelData(
  slot: SketchSlotForEncoding,
  order: string[],
  idPrefix: string,
  primaryEnemy: EnemyType,
  companionType: CompanionType | null,
): unknown {
```

(d) In the enemy `.map`, replace `type: "dustBunny" as const,` with:

```ts
      type: ENEMY_RUNTIME_TYPE[primaryEnemy],
```

(e) Replace the companion block (currently hardcodes `type: "teddy"`):

```ts
  const companionZone = combined.zones.find((z) => z.kind === "companion");
  const companion = companionZone && companionType
    ? {
        type: companionType,
        x: companionZone.x * GRID_PX + GRID_PX / 2,
        y: DESIGN_FLOOR_Y - companionZone.y * GRID_PX - COMPANION_Y_OFFSET,
      }
    : undefined;
```

(f) Update `encodeAreaLevels` to pass the area's values through:

```ts
export function encodeAreaLevels(area: Area, order: string[]): unknown[] {
  const idPrefix = area.name.toLowerCase().replace(/\s+/g, "-");
  return area.slots
    .filter((s) => s.options.length > 0)
    .map((slot) => encodeSlotToLevelData(slot, order, idPrefix, area.primaryEnemy, area.companion));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/levels/encodeFromSketch.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify Bedroom didn't regress**

Run: `npx vitest run` and `npm run typecheck`
Expected: all green. (Bedroom passes `primaryEnemy: "dust_bunny"` → `"dustBunny"` and `companion: "teddy"` → `"teddy"`, identical to the old hardcoded output.)

- [ ] **Step 6: Commit**

```bash
git add src/levels/encodeFromSketch.ts src/levels/encodeFromSketch.test.ts
git commit -m "feat(encode): derive enemy + companion type from the area (un-hardcode bedroom)"
```

---

## Task 5: Refine the gate proof — per-level → per-area

**Files:**
- Modify: `src/levels/reachability.integration.test.ts` (describe block #2, lines ~20-42)

**Why:** the current describe #2 asserts *every* gated level is unsolvable without its power. Our escalation design (spec §5) makes Hallway slots 1–3 base-jump-completable, so per-level would fail once they enter the catalog. The correct metroidvania invariant is per-area: *at least one* level in a gated area is unsolvable without the gating power.

- [ ] **Step 1: Replace describe block #2**

Replace the entire `describe("each area's gate genuinely requires its gating power", ...)` block with:

```ts
describe("each gated area genuinely requires its gating power (per-area)", () => {
  const gatedAreas = [...new Set(LEVEL_CATALOG.map((e) => e.areaId as AreaId))]
    .filter((area) => gatingPower(area) !== null);

  if (gatedAreas.length === 0) {
    it.todo("no gated areas in catalog yet");
  }

  for (const area of gatedAreas) {
    const gp = gatingPower(area)!;
    const entries = LEVEL_CATALOG.filter((e) => (e.areaId as AreaId) === area);
    it(`${area} — at least one level is NOT solvable without ${gp}`, () => {
      const without = new Set([...abilitiesForArea(area)]);
      without.delete(gp);
      const someLevelGated = entries.some((entry) => {
        const r = checkReachability(entry.raw, { abilities: without });
        return r.problems.filter((p) => p.severity === "error").length > 0;
      });
      expect(
        someLevelGated,
        `no level in ${area} requires ${gp} — the gate is decorative`,
      ).toBe(true);
    });
  }
});
```

- [ ] **Step 2: Run the suite — confirm still green**

Run: `npx vitest run src/levels/reachability.integration.test.ts`
Expected: PASS. The catalog still has only the hand-authored `hallway-1` "First Leap", which IS unsolvable without double-jump, so the hallway area satisfies the per-area assertion.

- [ ] **Step 3: Commit**

```bash
git add src/levels/reachability.integration.test.ts
git commit -m "test(reachability): gate proof is per-area, not per-level (escalation-friendly)"
```

- [ ] **Step 4: P0 gate — full build**

Run: `npm run build`
Expected: green (tsc + all Vitest + reachability lint + texture smoke + vite). P0 complete.

---

# PHASE P1 — Author Hallway Content

Authoring is iterative level design verified by the reachability lint. Each slot task: edit `HALLWAY_AREA`'s slot in `levelSketches.ts`, run the Hallway test for the lint verdict, eyeball `/maps.html`, tune, commit. The drafts below are concrete starting points; **the lint is the final arbiter** — adjust grid coords until it's green.

**Geometry reference (spec §5.1):** base flat-jump ≈ 3.8 grid, double-jump flat ≈ 6.6 grid; base apex ≈ 2.5 grid, double apex ≈ 5 grid. Height gate → ledge at `y` 3–4 (above base apex). Pit gate → width 4–5 (beyond base flat reach, within double).

## Task 6: Create the Hallway authoring + auto-proof harness

**Files:**
- Create: `src/levels/hallway.integration.test.ts`

This test encodes `HALLWAY_AREA` directly (not via the catalog), so it gives lint feedback on each slot as it's authored — before the pipeline switch. It starts with only the "solvable WITH double-jump" check (green: it grows one passing case per authored slot). The "NOT solvable without" gate pins are **added later**, in Tasks 10 and 11, exactly when slots 4 and 5 land — so every commit stays green.

- [ ] **Step 1: Create the test (solvable-WITH check only)**

Create `src/levels/hallway.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { encodeAreaLevels } from "./encodeFromSketch";
import { HALLWAY_AREA } from "../design/levelSketches";
import { checkReachability } from "./reachability";
import { abilitiesForArea } from "../config/gating";
import { parseLevelData, type LevelData } from "../types/level";

export const SEGMENT_ORDER = ["B", "A", "A", "C"];
const HALLWAY = abilitiesForArea("hallway"); // { doubleJump }

export function hallwayLevels(): LevelData[] {
  return (encodeAreaLevels(HALLWAY_AREA, SEGMENT_ORDER) as unknown[]).map(parseLevelData);
}

describe("Hallway — every authored level is completable with double-jump", () => {
  const levels = hallwayLevels();
  // Guard so the suite isn't empty before any slot is authored.
  it("has at least the levels authored so far", () => {
    expect(levels.length).toBeGreaterThanOrEqual(0);
  });
  for (const level of levels) {
    it(`${level.id} — solvable WITH double-jump`, () => {
      const r = checkReachability(level, { abilities: HALLWAY });
      const errors = r.problems.filter((p) => p.severity === "error");
      expect(errors, errors.map((e) => e.message).join(" | ")).toHaveLength(0);
    });
  }
});
```

- [ ] **Step 2: Run it — expect green (vacuous)**

Run: `npx vitest run src/levels/hallway.integration.test.ts`
Expected: PASS — slots are empty stubs so `hallwayLevels()` returns `[]`; only the guard test runs and passes. The per-slot cases appear as slots are authored.

- [ ] **Step 3: Commit (together with slot 1)**

This harness is committed alongside Task 7's slot 1 (see Task 7, Step 5) so the first per-slot case (`hallway-1`) lands green in the same commit. Do not commit Task 6 alone.

---

## Task 7: Author Slot 1 — Tutorial (optional height gate)

**Files:**
- Modify: `src/design/levelSketches.ts` — `HALLWAY_AREA.slots[0]`

- [ ] **Step 1: Replace the slot-1 stub with authored variants**

In `levelSketches.ts`, `HALLWAY_AREA` is built from `stubSlots(...)`. Replace the `stubSlots(...)` call with an explicit `slots` array. For Task 7, author slot 1; keep slots 2–5 as their stub objects for now (empty `options`). Change:

```ts
export const HALLWAY_AREA: Area = {
  id: 2,
  name: "Hallway",
  worldKey: "World2_Hallway",
  intent: "Long carpeted corridor. Spiders in the corners. Find Dog.",
  companion: "dog",
  primaryEnemy: "spider",
  carryOverEnemies: ["dust_bunny"],
  slots: HALLWAY_SLOTS,
};
```

…and define `HALLWAY_SLOTS` above it (mirroring `BEDROOM_SLOTS`). Start with slot 1 authored and slots 2–5 as empty-option stubs:

```ts
export const HALLWAY_SLOTS: LevelSlot[] = [
  {
    id: 1,
    name: "Hallway Runway",
    intent: "Re-establish the room. Walking + reintroduce the double-jump as an optional reward.",
    options: [
      {
        variant: "B",
        source: "Pattern 1 + 15 — extreme gentle warmup",
        note: "Mostly walking with token rewards. One trivial hop.",
        approxSeconds: 22, widthGrids: 18, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 17, y: 0 },
        platforms: [{ x: 8, y: 1, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 6, y: 0, kind: "token" },
          { x: 9, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
          { x: 15, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 1 + 2 + 9 (Hidden Token) — double-jump reward shelf",
        note: "Base path is flat. A token shelf at y=4 is reachable ONLY by double-jumping off the y=1 platform (optional).",
        approxSeconds: 30, widthGrids: 22, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [
          { x: 7, y: 1, w: 2 },
          { x: 13, y: 1, w: 2 },
        ],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 8, y: 4, kind: "token", label: "double-jump reward" },
          { x: 14, y: 4, kind: "token", label: "double-jump reward" },
          { x: 18, y: 0, kind: "token" }, { x: 19, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 2 + 11 — staircase + rest beat",
        note: "Gentle ascending staircase then a flat coda.",
        approxSeconds: 28, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [
          { x: 5, y: 1, w: 2 }, { x: 8, y: 2, w: 2 }, { x: 11, y: 3, w: 3 },
        ],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 6, y: 2, kind: "token" },
          { x: 12, y: 4, kind: "token" }, { x: 17, y: 0, kind: "token" },
        ],
      },
    ],
  },
  {
    id: 2, name: "First Spider",
    intent: "Introduce spider stomping. Wide runway, no pits.",
    options: [],
  },
  {
    id: 3, name: "Branching",
    intent: "Low (safe) and high (double-jump-gated, rewarding) routes.",
    options: [],
  },
  {
    id: 4, name: "Trust Gap",
    intent: "First MANDATORY double-jump — a lethal gap over a pit. Spiders return.",
    options: [],
  },
  {
    id: 5, name: "Find Dog",
    intent: "Climax. Mandatory double-jump to the finale; earn Dog on the final approach.",
    options: [],
  },
];
```

- [ ] **Step 2: Run the Hallway test — slot 1 should be solvable**

Run: `npx vitest run src/levels/hallway.integration.test.ts`
Expected: `hallway-1 — solvable WITH double-jump` PASSES. The `hallway-4`/`hallway-5`/Dog pins still FAIL (not authored). That's expected mid-P1.

- [ ] **Step 3: Eyeball the maps page**

Run `npm run dev` if not running. Open `http://localhost:5173/maps.html`. Confirm the Hallway slot 1 row renders its B/A/C segments and the double-jump reward shelf sits visibly above the reachable platforms.

- [ ] **Step 4: Verify the level was not made accidentally unsolvable or trivially impossible**

Confirm `hallway-1`'s "solvable WITH double-jump" is green (Step 2). The y=4 reward shelves are *optional* — `checkReachability` flags unreachable *content* only as a warning (`contentMargin`), not an error, so they won't fail the build. (If you want them provably reachable-with-double-jump, the test already asserts no `error`-severity problems; content warnings are acceptable here.)

- [ ] **Step 5: Commit (test harness + slot 1 together)**

```bash
git add src/levels/hallway.integration.test.ts src/design/levelSketches.ts
git commit -m "feat(hallway): slot 1 (tutorial runway) + reachability harness"
```

---

## Task 8: Author Slot 2 — First Spider

**Files:**
- Modify: `src/design/levelSketches.ts` — `HALLWAY_SLOTS[1].options`

- [ ] **Step 1: Author the three variants**

Replace `HALLWAY_SLOTS[1]` (`id: 2`) `options: []` with:

```ts
    options: [
      {
        variant: "B",
        source: "Pattern 4 — single safe stomp",
        note: "One spider on flat floor, runway both sides. Reads clearly.",
        approxSeconds: 24, widthGrids: 20, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 12, y: 1, w: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 9, y: 0, kind: "enemy", label: "first spider" },
          { x: 13, y: 2, kind: "token" },
          { x: 16, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 4 + 9 — stomp + double-jump token perch",
        note: "Spider on the floor; a token perch at y=4 above it is double-jump-only (optional).",
        approxSeconds: 34, widthGrids: 24, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 23, y: 0 },
        platforms: [
          { x: 10, y: 1, w: 2 }, { x: 16, y: 1, w: 2 },
        ],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 8, y: 0, kind: "enemy", label: "spider" },
          { x: 11, y: 4, kind: "token", label: "double-jump perch" },
          { x: 14, y: 0, kind: "enemy", label: "spider" },
          { x: 20, y: 0, kind: "token" }, { x: 21, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 13 — climb past a patrolling spider",
        note: "Spider patrols the floor while Eloise climbs a staircase above.",
        approxSeconds: 36, widthGrids: 22, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [
          { x: 4, y: 1, w: 2 }, { x: 7, y: 2, w: 2 }, { x: 10, y: 3, w: 3 }, { x: 16, y: 1, w: 2 },
        ],
        zones: [
          { x: 5, y: 2, kind: "token" }, { x: 8, y: 3, kind: "token" }, { x: 11, y: 4, kind: "token" },
          { x: 14, y: 0, kind: "enemy", label: "patrol" },
          { x: 19, y: 0, kind: "token" },
        ],
      },
    ],
```

- [ ] **Step 2: Run the Hallway test**

Run: `npx vitest run src/levels/hallway.integration.test.ts`
Expected: `hallway-1` and `hallway-2` both "solvable WITH double-jump" PASS.

- [ ] **Step 3: Eyeball + commit**

Check `/maps.html` slot 2. Then:

```bash
git add src/design/levelSketches.ts
git commit -m "feat(hallway): slot 2 (first spider) — spiders on flat runways"
```

---

## Task 9: Author Slot 3 — Branching (high route double-jump-gated)

**Files:**
- Modify: `src/design/levelSketches.ts` — `HALLWAY_SLOTS[2].options`

The high route is the rewarding one; it's reachable only by double-jump. The low route (floor) is always base-jumpable, so the level stays solvable without double-jump (an *optional* gate — that's correct for slot 3).

- [ ] **Step 1: Author the three variants**

Replace `HALLWAY_SLOTS[2]` (`id: 3`) `options: []` with:

```ts
    options: [
      {
        variant: "B",
        source: "Pattern 5 simplified — hill vs valley",
        note: "Low floor route safe; a mid hill (y=2) holds extra tokens, reached by one base jump.",
        approxSeconds: 30, widthGrids: 22, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [{ x: 6, y: 1, w: 2 }, { x: 9, y: 2, w: 6 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 11, y: 3, kind: "token", label: "high" }, { x: 12, y: 3, kind: "token", label: "high" },
          { x: 13, y: 0, kind: "enemy", label: "spider" },
          { x: 18, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Dan Taylor 'Risk = Reward' — high route is double-jump-only",
        note: "Low route: floor, 1 token, 1 spider. High route: a y=4 ledge reachable ONLY by double-jump, carrying 3 tokens.",
        approxSeconds: 40, widthGrids: 26, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 25, y: 0 },
        platforms: [
          { x: 6, y: 1, w: 2 },
          { x: 9, y: 4, w: 6 },
          { x: 18, y: 1, w: 2 },
        ],
        zones: [
          { x: 12, y: 0, kind: "token", label: "low" },
          { x: 10, y: 5, kind: "token", label: "high" }, { x: 12, y: 5, kind: "token", label: "high" },
          { x: 14, y: 5, kind: "token", label: "high" },
          { x: 8, y: 0, kind: "enemy", label: "spider" },
          { x: 23, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 5 expanded — three routes",
        note: "Floor / mid / high. High requires double-jump. More replayability.",
        approxSeconds: 44, widthGrids: 28, heightGrids: 6,
        spawn: { x: 1, y: 0 }, exit: { x: 27, y: 0 },
        platforms: [
          { x: 6, y: 2, w: 8 }, { x: 16, y: 1, w: 1 },
          { x: 8, y: 5, w: 6 }, { x: 20, y: 2, w: 2 },
        ],
        zones: [
          { x: 10, y: 0, kind: "token", label: "low" },
          { x: 9, y: 3, kind: "token", label: "mid" }, { x: 12, y: 3, kind: "token", label: "mid" },
          { x: 9, y: 6, kind: "token", label: "high" }, { x: 12, y: 6, kind: "token", label: "high" },
          { x: 8, y: 0, kind: "enemy", label: "spider" }, { x: 15, y: 0, kind: "enemy", label: "spider" },
          { x: 25, y: 0, kind: "token" },
        ],
      },
    ],
```

- [ ] **Step 2: Run the Hallway test**

Run: `npx vitest run src/levels/hallway.integration.test.ts`
Expected: `hallway-1/2/3` all "solvable WITH double-jump" PASS. (Slot 3 is still solvable *without* double-jump via the low route — correct; the gate here is optional.)

- [ ] **Step 3: Eyeball + commit**

Check `/maps.html` slot 3 — confirm the high ledge (y=4/5) sits above base-jump reach. Then:

```bash
git add src/design/levelSketches.ts
git commit -m "feat(hallway): slot 3 (branching) — high route gated on double-jump"
```

---

## Task 10: Author Slot 4 — Trust Gap (first MANDATORY double-jump)

**Files:**
- Modify: `src/design/levelSketches.ts` — `HALLWAY_SLOTS[3].options`

This is where double-jump becomes load-bearing. The mandatory beat lives in variants **A** and **C** (the chain is B→A→A→C, so A is laid twice and C ends the level — every path to the exit crosses an A-or-C mandatory gap). Variant B is a gentle warmup that does **not** require double-jump (it precedes the gates).

**Critical:** the pit must make the inner-edge gap **wider than base flat reach (~3.8 grid ≈ 121px)** but **within double reach (~6.6 grid ≈ 212px)**. A pit `w: 5` with platforms flush to its edges gives a ~5-grid gap. Tune against the lint.

- [ ] **Step 1: Author the three variants**

Replace `HALLWAY_SLOTS[3]` (`id: 4`) `options: []` with:

```ts
    options: [
      {
        variant: "B",
        source: "Pattern 11 — rest beat warmup (no gate)",
        note: "Flat breather before the gauntlet. No mandatory double-jump here.",
        approxSeconds: 18, widthGrids: 14, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 13, y: 0 },
        platforms: [{ x: 6, y: 1, w: 2 }],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 7, y: 2, kind: "token" }, { x: 11, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 8 — MANDATORY double-jump gap over a lethal pit",
        note: "Floor breaks at x=5 for w=5 (a ~5-grid gap > base flat reach 3.8, < double reach 6.6). The ONLY crossing is a double-jump; falling in respawns. Spider waits past the gap.",
        approxSeconds: 34, widthGrids: 18, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 17, y: 0 },
        platforms: [],
        pits: [{ x: 5, w: 5 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 7, y: 1, kind: "token", label: "over-gap breadcrumb" },
          { x: 12, y: 0, kind: "enemy", label: "spider past gap" },
          { x: 15, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 8 + 12 — false summit + a second mandatory gap",
        note: "A platform that looks like the end, then one more double-jump gap to the real exit.",
        approxSeconds: 36, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 4, y: 2, w: 3 }],
        pits: [{ x: 12, w: 5 }],
        zones: [
          { x: 5, y: 3, kind: "token", label: "false summit" },
          { x: 9, y: 0, kind: "token" },
          { x: 14, y: 1, kind: "token", label: "over-gap breadcrumb" },
          { x: 18, y: 0, kind: "token" },
        ],
      },
    ],
```

- [ ] **Step 2: Add the gate pin to the Hallway test**

Now that slot 4 is the first mandatory gate, append a second describe block to `src/levels/hallway.integration.test.ts` (after the existing describe):

```ts
describe("Hallway — the gate bites (slot 4)", () => {
  const byId = (id: string) => hallwayLevels().find((l) => l.id === id);

  it("hallway-4 is NOT solvable without double-jump", () => {
    const level = byId("hallway-4");
    expect(level, "hallway-4 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: new Set([]) });
    const errors = r.problems.filter((p) => p.severity === "error");
    expect(errors.length, "expected an exit-unreachable error").toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run the Hallway test — both directions green**

Run: `npx vitest run src/levels/hallway.integration.test.ts`
Expected: `hallway-1..4 — solvable WITH double-jump` PASS **and** `hallway-4 is NOT solvable without double-jump` PASSES (the pit gap is uncrossable with the base jump → `exit-unreachable`). If "NOT solvable without" fails (level crossable without double-jump), the pit is too narrow — widen `w` to 5 or 6 and re-run. If "solvable WITH" fails, the gap exceeds double reach — narrow it.

- [ ] **Step 4: Eyeball + commit**

Check `/maps.html` slot 4 — the pit should read as a clear lethal gap with safe floor either side. Then:

```bash
git add src/design/levelSketches.ts src/levels/hallway.integration.test.ts
git commit -m "feat(hallway): slot 4 (trust gap) — first mandatory double-jump over a lethal pit"
```

---

## Task 11: Author Slot 5 — Find Dog (finale, mandatory gate + companion on the path)

**Files:**
- Modify: `src/design/levelSketches.ts` — `HALLWAY_SLOTS[4].options`

The finale combines a mandatory double-jump (so the area's gate bites at the climax) with **Dog placed on the final approach to the exit** (the unavoidable-companion invariant, spec §2.1). Dog sits on the floor at `y: 0` immediately before the exit so the walk to the exit passes through the pickup.

- [ ] **Step 1: Author the three variants**

Replace `HALLWAY_SLOTS[4]` (`id: 5`) `options: []` with:

```ts
    options: [
      {
        variant: "B",
        source: "Pattern 11 — calm approach",
        note: "Gentle lead-in before the climactic gap.",
        approxSeconds: 22, widthGrids: 16, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 15, y: 0 },
        platforms: [{ x: 6, y: 1, w: 2 }, { x: 10, y: 1, w: 2 }],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 7, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 8 + 13 — mandatory gap then a spider gate",
        note: "A double-jump gap (pit x=6 w=5), then a spider on a raised platform before the run-out.",
        approxSeconds: 38, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 13, y: 1, w: 3 }],
        pits: [{ x: 6, w: 5 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 8, y: 1, kind: "token", label: "over-gap breadcrumb" },
          { x: 14, y: 1, kind: "enemy", label: "spider gate" },
          { x: 17, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 8 + 14 (Companion Beacon) + 15 (Victory Coda)",
        note: "Final mandatory gap, then a victory coda with a halo of tokens, and Dog on the floor right before the exit (unavoidable).",
        approxSeconds: 42, widthGrids: 24, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 23, y: 0 },
        platforms: [{ x: 5, y: 1, w: 2 }],
        pits: [{ x: 9, w: 5 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 2, kind: "token" },
          { x: 11, y: 1, kind: "token", label: "over-gap breadcrumb" },
          { x: 18, y: 0, kind: "token", label: "halo" }, { x: 19, y: 0, kind: "token", label: "halo" },
          { x: 21, y: 0, kind: "companion", label: "Dog" },
        ],
      },
    ],
```

(Dog at x=21, exit at x=23: the player must walk the final corridor through x=21 to reach the exit — unavoidable.)

- [ ] **Step 2: Add the finale + Dog pins to the Hallway test**

Append a third describe block to `src/levels/hallway.integration.test.ts`:

```ts
describe("Hallway — finale gate + companion (slot 5)", () => {
  const byId = (id: string) => hallwayLevels().find((l) => l.id === id);

  it("hallway-5 is NOT solvable without double-jump", () => {
    const level = byId("hallway-5");
    expect(level, "hallway-5 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: new Set([]) });
    const errors = r.problems.filter((p) => p.severity === "error");
    expect(errors.length, "expected an exit-unreachable error").toBeGreaterThan(0);
  });

  it("Dog is comfortably reachable in hallway-5", () => {
    const level = byId("hallway-5");
    expect(level, "hallway-5 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: abilitiesForArea("hallway") });
    const stranded = r.problems.find((p) => p.kind === "companion-stranded");
    expect(stranded, stranded?.message).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the Hallway test — all pins green**

Run: `npx vitest run src/levels/hallway.integration.test.ts`
Expected: ALL green — `hallway-1..5` solvable WITH double-jump; `hallway-4` and `hallway-5` NOT solvable without; Dog reachable in `hallway-5`. If the Dog-reachability assert fails (`companion-stranded`), Dog landed past the exit-reachable frontier or too high — move it onto a clearly reachable floor tile before the exit. If `hallway-5 NOT solvable without` fails, the C-variant pit is too narrow — widen it.

- [ ] **Step 4: Eyeball + commit**

Check `/maps.html` slot 5 — confirm Dog sits on the final floor stretch between the last gap and the exit. Then:

```bash
git add src/design/levelSketches.ts src/levels/hallway.integration.test.ts
git commit -m "feat(hallway): slot 5 (finale) — mandatory gap + Dog on the final approach"
```

---

# PHASE P2 — Pipeline Switch

## Task 12: Make hallwayLevels.ts sketch-driven

**Files:**
- Modify: `src/levels/hallwayLevels.ts`

- [ ] **Step 1: Replace the hand-authored literal**

Replace the entire contents of `src/levels/hallwayLevels.ts` with the Bedroom-style one-liner:

```ts
import { HALLWAY_AREA } from "../design/levelSketches";
import { encodeAreaLevels } from "./encodeFromSketch";
import type { LevelData } from "../types/level";

/**
 * Hallway levels — auto-generated from the sketches in
 * `src/design/levelSketches.ts` (HALLWAY_AREA) via `encodeFromSketch.ts`.
 * Each slot's B → A → A → C variants chain into one continuous level.
 *
 * Gate: double-jump (earned from Teddy in the Bedroom). Mandatory at slots 4–5.
 * Companion earned here: Dog (grants dash, which gates the Kitchen).
 */
const SEGMENT_ORDER = ["B", "A", "A", "C"];

export const HALLWAY_LEVELS = encodeAreaLevels(HALLWAY_AREA, SEGMENT_ORDER) as LevelData[];
```

- [ ] **Step 2: Run the full Vitest suite**

Run: `npx vitest run`
Expected: ALL green. The catalog now has 5 Hallway levels. The generic `reachability.integration.test.ts` covers them ("solvable WITH double-jump" per level; per-area gate proof satisfied by slots 4–5). The ordering test passes trivially (no `requires`/climbWalls/breakables in Hallway).

- [ ] **Step 3: Verify the catalog smoke test + textures**

Run: `npx vitest run src/levels/levelCatalog.smoke.test.ts src/levels/levelTextures.test.ts`
Expected: green — all 5 Hallway levels are Zod-valid and reference only loaded sprites (spider + dog textures load in BootScene).

- [ ] **Step 4: Full build gate**

Run: `npm run build`
Expected: green (tsc + Vitest + reachability lint + texture smoke + vite). The build-time lint now validates all 5 Hallway levels with `abilitiesForArea("hallway")`.

- [ ] **Step 5: Verify the maps page**

With `npm run dev` running, open `http://localhost:5173/maps.html`. Expected: Hallway shows **15/15 drafted** (5 slots × 3 variants), no longer "0/5".

- [ ] **Step 6: Commit**

```bash
git add src/levels/hallwayLevels.ts
git commit -m "feat(hallway): switch to sketch-driven levels (encodeAreaLevels)"
```

---

# PHASE P3 — Runtime Verification

## Task 13: Play through Hallway in the browser

**Files:** none (verification only).

- [ ] **Step 1: Boot the game**

Ensure `npm run dev` is running. Use the preview tools (`preview_start` if needed) to load `http://localhost:5173/`.

- [ ] **Step 2: Reach the Hallway**

In the browser console, grant the Bedroom completion + double-jump and jump to the first Hallway level. Use the existing dev handle pattern; if a direct level-jump handle exists use it, otherwise: `eloiseReset()` then play Bedroom to completion, OR set `GameState` unlocked abilities to include `doubleJump` and advance the catalog index to the first hallway entry (index 5). Confirm via console that `GameState.get().hasAbility("doubleJump")` is `true`.

- [ ] **Step 3: Verify spiders render and stomp**

In Hallway level 2, confirm a spider sprite renders (not a dust bunny), patrols, and is defeated by a stomp (jump on it → it disappears, Eloise bounces). Confirm side-contact damages Eloise (heart lost). Use `preview_screenshot` to capture a spider on screen.

- [ ] **Step 4: Verify the double-jump gate**

In Hallway level 4, confirm the lethal pit cannot be crossed with a single jump (fall → respawn) and IS crossable with a double-jump. Confirm no console errors (`preview_console_logs`).

- [ ] **Step 5: Verify Dog collection fires the dash unlock**

In Hallway level 5, walk through Dog on the final approach. Confirm: the `PowerUnlockScene` reveal fires (dash), `GameState.get().hasAbility("dash")` becomes `true`, and a heart bonus is NOT granted (Dog has no `heartBonus` in `COMPANIONS`). Capture a `preview_screenshot` of the unlock reveal.

- [ ] **Step 6: Final build + report**

Run: `npm run build`
Expected: green. Report the final test count and confirm Hallway is playable Bedroom→Hallway with the gate and companion working. Update `PROGRESS.md` and `ROADMAP.md` (`7.1` — Hallway sub-task) per the session-end protocol.

---

## Self-Review

**Spec coverage:**
- §1 success criteria → Tasks 7–13 (15 variants, sketch-driven, spiders, Dog, lint proof, build green, maps 15/15). ✓
- §2 gating model + §2.1 unavoidable-companion → Task 11 (Dog at x=21 before exit x=23). ✓
- §3.1 schema enum → Task 1. §3.2 encoder generalization → Task 4. §3.3 spiders-only → Tasks 4/8 (every enemy zone → `primaryEnemy`). ✓
- §4 Spider entity + GameScene wiring → Tasks 2, 3. ✓
- §5 escalating gate (table) → Tasks 7 (optional) → 9 (optional high route) → 10 (first mandatory) → 11 (climax). ✓
- §6 pipeline switch → Task 12. ✓
- §7 reachability auto-proof → Task 6 (solvable-WITH harness) + gate pins added green in Tasks 10/11 + per-area refinement Task 5 + Task 12 (catalog coverage). ✓
- §8 out-of-scope respected (no carryover, no rich spider, no Dog walk-anim, no backgrounds). ✓
- §9 build phases P0–P3 → task grouping. ✓

**Placeholder scan:** No "TBD/handle edge cases/similar to" placeholders. Content drafts are concrete coordinate arrays with the lint as the tuning gate (explicitly called out, not a hand-wave). ✓

**Type consistency:** `ENEMY_RUNTIME_TYPE` (Task 4) maps the `EnemyType` enum (`dust_bunny`…) to the widened `EnemySpawnSchema` enum (`dustBunny`…) from Task 1 — names match. `CompanionType` strings (`dog`) already equal the companion schema enum — no map needed. `checkReachability(level, { abilities })` → `{ ok, problems: [{ message, kind, severity }] }` used consistently in Tasks 5, 6. `Spider extends Enemy`; `enemies: Enemy[]`; `handleEnemyOverlap(enemy: Enemy)` — consistent. `encodeAreaLevels(area, order)` / `encodeSlotToLevelData(slot, order, idPrefix, primaryEnemy, companionType)` signatures match between Task 4 definition and Task 6/12 callers. ✓
