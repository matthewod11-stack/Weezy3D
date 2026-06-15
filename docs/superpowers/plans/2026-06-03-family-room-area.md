# Family Room Area (World 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 5-level Family Room area (World 4) — an **enemy-forward, climb-light** area where **wall-climb** (held since the Kitchen) is gated exactly once (the finale, doubling as the **Horse** pickup), the player earns **Horse → charge** (offset reward), and the first **mixed-enemy** levels are driven by a new per-zone `enemyType` carryover override.

**Architecture:** Mirror the Hallway/Kitchen builds, but smaller — most infra already ships. Phase 0 adds the only two new pieces: a `DustMite` stomp-patroller entity (single texture, art already on disk) and the **carryover system** (an optional `enemyType` on the sketch enemy zone, preserved through `combineSlot`, resolved in the encoder with a `?? primaryEnemy` fallback + a `trex` guard). Phase 1 authors 15 variants on `/maps.html`, tuned against the build-time reachability lint, with a single load-bearing finale climb and carryover variety in the middle slots. Phase 2 switches `familyRoomLevels.ts` to sketch-driven and wires the catalog. Phase 3 pins the climb gate + Horse reachability + carryover with an integration test.

**Tech Stack:** Phaser 3.80, TypeScript (strict), Vite 6, Zod, Vitest. No new gating model, no new traversal-vocab element, no new game logic — `climbWalls`, `requires:"dash"`, the elevatable exit, the `EnemySpawn` enum (`dustMite` already present), the `DUSTMITE` texture constant, and the BootScene `dustmite.png` load all already exist.

**Spec:** `docs/superpowers/specs/2026-06-03-family-room-area-design.md`

---

## File Structure

**Phase 0 — Infra (deterministic):**
- Create: `src/entities/DustMite.ts` — stomp-patroller reskin (single texture), sibling of `Ant`.
- Modify: `src/config/textures.ts` — register `dustMite` + `horse` in `ENTITY_TEXTURE_KEYS` (constants + BootScene loads already exist).
- Modify: `src/scenes/GameScene.ts` — `dustMite` spawn branch before the existing `else` guard.
- Modify: `src/design/levelSketches.ts` — `SketchZone.enemyType?` (carryover override).
- Modify: `src/design/combineSlot.ts` — preserve `enemyType` when chaining zones.
- Modify: `src/levels/encodeFromSketch.ts` — resolve enemy `type` from `z.enemyType ?? primaryEnemy`; guard `trex`.
- Modify: `src/levels/encodeFromSketch.elements.test.ts` — carryover override / fallback / trex-guard tests.

**Phase 1 — Content (iterative authoring):**
- Modify: `src/design/levelSketches.ts` — new `FAMILY_ROOM_SLOTS` const (5 slots × A/B/C); point `FAMILY_ROOM_AREA.slots` at it (replacing `stubSlots`).

**Phase 2 — Pipeline switch:**
- Create: `src/levels/familyRoomLevels.ts` — `encodeAreaLevels(FAMILY_ROOM_AREA, SEGMENT_ORDER)`.
- Modify: `src/levels/levelCatalog.ts` — `FAMILY_ROOM_ENTRIES` concatenated after `KITCHEN_ENTRIES`.

**Phase 3 — Proof:**
- Create: `src/levels/familyRoom.integration.test.ts` — climb-gate + Horse + carryover auto-proof.

---

# PHASE 0 — Infrastructure

## Task 1: DustMite entity + register dustMite/horse textures

**Files:**
- Create: `src/entities/DustMite.ts`
- Modify: `src/config/textures.ts:57-66` (the `ENTITY_TEXTURE_KEYS` object)

`DustMite` mirrors `Ant` (`src/entities/Ant.ts`) exactly — both are single-texture stomp-patrollers. The `EnemySpawnSchema` enum already includes `"dustMite"`, the `DUSTMITE` constant already exists in `textures.ts:41`, and `BootScene:73` already loads `dustmite.png`. The only registration gap is `ENTITY_TEXTURE_KEYS` (and `horse`, the companion, is also missing there — the texture smoke test would fail once a Family Room level references it).

- [ ] **Step 1: Create `src/entities/DustMite.ts`**

```typescript
import { RENDER_SCALE } from "../config/game";
import type { EnemySpawn } from "../types/level";
import { Enemy } from "./Enemy";
import { DUSTMITE } from "../config/textures";
import { computeFeetOriginY } from "../systems/measureSpriteFeet";

/**
 * DustMite — Family Room's primary enemy. A stomp-patroller, sibling of
 * Ant/Spider/DustBunny under the Enemy base (which owns all patrol motion).
 * Only one dust-mite texture exists (no idle/walk split), so there is no
 * pose-swap — just flip with travel direction. "Under the cushions" flavor is
 * pure placement (clusters on rugs/couches). Mirrors Ant.ts.
 */
export class DustMite extends Enemy {
  constructor(scene: Phaser.Scene, spawn: EnemySpawn) {
    super(scene, spawn.x, spawn.y, DUSTMITE, undefined, spawn);
    const feetOriginY = computeFeetOriginY(scene, [DUSTMITE]);
    this.setOrigin(0.5, feetOriginY);
    this.setScale(0.03 * RENDER_SCALE); // dust mites are small; tune at playtest

    // Body sized in WORLD units (Phaser multiplies setSize/setOffset by scaleX
    // at runtime, so pre-divide). Mirrors Ant; tune to dust-mite proportions.
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

- [ ] **Step 2: Register `dustMite` + `horse` in `ENTITY_TEXTURE_KEYS`**

In `src/config/textures.ts`, replace the `ENTITY_TEXTURE_KEYS` object (currently lines 57-66) with:

```typescript
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
};
```

(`DUSTMITE`, `HORSE_IDLE`, `HORSE_WALK` are already declared in this file — confirmed at lines 41, 21-22 — and all three are already in `STORYBOOK_KEYS` and loaded by `BootScene`.)

- [ ] **Step 3: Verify typecheck + texture smoke tests pass**

Run: `npm run typecheck && npx vitest run src/levels/levelTextures.test.ts src/levels/levelCatalog.smoke.test.ts`
Expected: typecheck clean; smoke tests PASS (no Family Room levels in the catalog yet — this confirms no regression from the new map entries).

- [ ] **Step 4: Commit**

```bash
git add src/entities/DustMite.ts src/config/textures.ts
git commit -m "feat(family-room): DustMite entity (stomp-patroller reskin) + register dustMite/horse textures"
```

---

## Task 2: GameScene dustMite spawn branch

**Files:**
- Modify: `src/scenes/GameScene.ts` (import block; enemy spawn loop at lines 312-324)

Fills the hole the Kitchen build left: the `else` guard currently `console.warn`s for `dustMite`. Add the real branch before it. With all four runtime branches live, a single level mixing every enemy type (carryover) renders correctly.

- [ ] **Step 1: Import `DustMite`**

Add to the entity imports near the top of `src/scenes/GameScene.ts` (alongside the existing `import { Ant } from "../entities/Ant";`):

```typescript
import { DustMite } from "../entities/DustMite";
```

- [ ] **Step 2: Add the `dustMite` branch**

In `src/scenes/GameScene.ts`, replace this block (lines 312-324):

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
      } else if (spawn.type === "dustMite") {
        enemy = new DustMite(this, spawn);
      } else {
        // Explicit guard: an unhandled enemy type would otherwise vanish
        // silently. Make it loud. (Only reachable by a genuinely-new type.)
        console.warn(`[GameScene] Unhandled enemy type "${spawn.type}" — not spawned.`);
      }
      if (!enemy) continue;
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: clean (`DustMite` extends `Enemy`, assignable to the `enemy` variable).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat(family-room): GameScene dustMite spawn branch (fills the Kitchen else-guard hole)"
```

---

## Task 3: Carryover — per-zone `enemyType` override (TDD)

**Files:**
- Modify: `src/design/levelSketches.ts` (`SketchZone` type, ~lines 38-43)
- Modify: `src/design/combineSlot.ts` (zone-push loop, lines 98-105)
- Modify: `src/levels/encodeFromSketch.ts` (enemies map, lines 132-151)
- Test: `src/levels/encodeFromSketch.elements.test.ts` (add a `describe` block)

The encoder currently maps **every** enemy zone to `area.primaryEnemy` (`encodeFromSketch.ts:144`). This adds an optional per-zone override that falls back to the primary — so every existing sketch (Bedroom/Hallway/Kitchen) encodes byte-identically. A `trex` override is rejected (the boss is a set-piece, not a patroller; without a guard `ENEMY_RUNTIME_TYPE` would silently coerce it to `dustBunny`).

- [ ] **Step 1: Write the failing tests**

Append to `src/levels/encodeFromSketch.elements.test.ts`:

```typescript
describe("encoder — enemyType carryover override", () => {
  it("a zone with enemyType overrides the area primaryEnemy", () => {
    const slot = slotWith({ zones: [{ x: 5, y: 0, kind: "enemy", enemyType: "spider" }] });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "dust_mite", "horse"));
    expect(level.enemies[0]!.type).toBe("spider");
  });
  it("a zone WITHOUT enemyType falls back to primaryEnemy", () => {
    const slot = slotWith({ zones: [{ x: 5, y: 0, kind: "enemy" }] });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "dust_mite", "horse"));
    expect(level.enemies[0]!.type).toBe("dustMite");
  });
  it("a dust_bunny override maps to the runtime camelCase type", () => {
    const slot = slotWith({ zones: [{ x: 5, y: 0, kind: "enemy", enemyType: "dust_bunny" }] });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "dust_mite", "horse"));
    expect(level.enemies[0]!.type).toBe("dustBunny");
  });
  it("enemyType 'trex' throws (boss is not a patroller)", () => {
    const slot = slotWith({ zones: [{ x: 5, y: 0, kind: "enemy", enemyType: "trex" }] });
    expect(() => encodeSlotToLevelData(slot, ["A"], "test", "dust_mite", "horse")).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/levels/encodeFromSketch.elements.test.ts -t carryover`
Expected: FAIL — a TS error on `enemyType` not existing on `SketchZone`, and/or the override case returning `dustMite` instead of `spider`.

- [ ] **Step 3: Add `enemyType` to `SketchZone`**

In `src/design/levelSketches.ts`, replace the `SketchZone` type (lines 38-43):

```typescript
export type SketchZone = {
  x: number;
  y: number;
  kind: "token" | "enemy" | "companion";
  label?: string;
  /** Carryover: for `kind:"enemy"` zones, spawn this enemy type instead of the
   *  area's `primaryEnemy`. Lets a level mix returning foes (e.g. a Hallway
   *  spider in the Family Room) with the area's own enemy. Ignored for other
   *  kinds. `"trex"` is rejected by the encoder (the boss is a set-piece). */
  enemyType?: EnemyType;
};
```

(`EnemyType` is declared later in this same file at line 92 — `type` aliases hoist, so the forward reference is fine in TypeScript.)

- [ ] **Step 4: Preserve `enemyType` when chaining zones in `combineSlot`**

In `src/design/combineSlot.ts`, replace the zone-push loop (lines 98-105):

```typescript
    for (const z of opt.zones) {
      zones.push({
        x: z.x + xCursor,
        y: z.y,
        kind: z.kind,
        label: z.label,
        ...(z.enemyType ? { enemyType: z.enemyType } : {}),
      });
    }
```

- [ ] **Step 5: Resolve the enemy type in the encoder + guard `trex`**

In `src/levels/encodeFromSketch.ts`, replace the enemies map (lines 132-151):

```typescript
  // ── Enemies ──────────────────────────────────────────────────────────
  const enemyZones = combined.zones.filter((z) => z.kind === "enemy");
  const enemies = enemyZones.map((z) => {
    // Carryover: a per-zone enemyType overrides the area primary; default falls
    // back to primaryEnemy so existing sketches are unchanged.
    const resolvedType = z.enemyType ?? primaryEnemy;
    if (resolvedType === "trex") {
      throw new Error(
        "enemy zone enemyType 'trex' is invalid — the T-Rex is a set-piece boss, not a patroller",
      );
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/levels/encodeFromSketch.elements.test.ts`
Expected: PASS (all element suites — the carryover block plus the pre-existing requires/climbWalls/exit suites).

- [ ] **Step 7: Verify existing areas are byte-identical (no enemyType anywhere yet)**

Run: `npx vitest run src/levels/hallway.integration.test.ts src/levels/kitchen.integration.test.ts src/levels/reachability.integration.test.ts`
Expected: PASS — no Bedroom/Hallway/Kitchen enemy zone carries `enemyType`, so the `?? primaryEnemy` fallback reproduces the old behavior exactly.

- [ ] **Step 8: Commit**

```bash
git add src/design/levelSketches.ts src/design/combineSlot.ts src/levels/encodeFromSketch.ts src/levels/encodeFromSketch.elements.test.ts
git commit -m "feat(family-room): per-zone enemyType carryover override (encoder fallback + trex guard)"
```

---

## Task 4: Phase 0 checkpoint — full build green

**Files:** none (verification only)

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: tsc clean; **all Vitest pass** (216 prior + the new carryover element tests); reachability lint over the whole catalog green (no Family Room levels yet); texture smoke green; vite build ok. Bedroom + Hallway + Kitchen unchanged.

If anything fails, fix before proceeding — Phase 1 authoring assumes a green infra base.

---

# PHASE 1 — Author Family Room Content (iterative)

## Task 5: Author `FAMILY_ROOM_SLOTS` (5 slots × A/B/C)

**Files:**
- Modify: `src/design/levelSketches.ts` (new `FAMILY_ROOM_SLOTS`; point `FAMILY_ROOM_AREA.slots` at it)

This is the **iterative authoring** phase: draft on `/maps.html`, run `npm run build`, and tune geometry until the reachability lint passes and (after Task 7) the proofs hold. The area is **enemy-forward** (dense + mixed encounters via carryover) and **climb-light** (a single load-bearing climb — slot 5's finale couch-back, which also gates the Horse pickup). The gate that controls each level's **exit** lives in the **C variant** (last segment of `B→A→A→C`); spawn comes from B.

**Geometry targets** (from `physics.ts`; the lint is the source of truth — author, build, tune):
- Base flat reach ≈ 121px (3.8 grid) · double-jump flat reach ≈ 212px (6.6 grid) · dash lunge ≈ 320px (10 grid)
- Base apex ≈ 81px (2.5 grid) · double-jump apex ≈ 161px (5 grid)
- **Climb-only shelf (finale, load-bearing):** shelf top **> 161px** above floor → author the floating platform at sketch **y ≥ 6** (y=8 → 270px up). Add a `climbWall { x: <shelf left edge>, y: 0, h: <shelfY + 1> }` and put the exit `x` over a pit so no floor sits under it (only the climbed-to shelf satisfies the exit check).
- **Lethal pit (slot 4):** clearable with **double-jump** (a baseline ability by World 4 — dash stays optional), so width **> base 121px** and **< double-jump 212px** → ~5 grid (160px), with the kill plane below.
- **Optional dash gaps (slots 2–4, bonus tokens only):** **> 212px** and within the lunge (~240–290px), flat/downhill; the base path never needs them.

**Per-slot intent (enemy-forward, climb-light):**

| Slot | Beat | Enemies (carryover via `enemyType`) | Climb | Lethal? |
|------|------|--------------------------------------|-------|---------|
| 1 | Welcome to the rug | 1–2 dust mites (primary; no override) | — | No |
| 2 | Critter mix | dust mites + one `enemyType:"dust_bunny"` | optional low climb (bonus token) | No |
| 3 | Toolkit romp | dust mites + `enemyType:"spider"` + `enemyType:"ant"`; a stomp-gate to a token | optional climb (bonus token) | No (last safe) |
| 4 | First fall | mixed swarm flanking a lethal pit (double-jump clears) | optional | **Yes** |
| 5 | Couch summit → meet Horse | climax encounter at the base | **MANDATORY** climb-only couch-back to the shelf where Horse + exit sit | Yes |

- [ ] **Step 1: Seed the climb gate — Slot 5, C variant (verified geometry)**

Use this as the literal starting point for `FAMILY_ROOM_SLOTS[4]`'s `C` option. The math is worked against `DESIGN_FLOOR_Y=168`, `GRID=32`, `PLATFORM_THICKNESS=14`, `EXIT_H=52`: shelf top = `168 - 8*32 - 14 = -102` (270px above floor → climb-only); the climbWall at x=17 (the shelf's left edge) stands on the floor (floor runs 0→18, pit starts at 18) and spans up past the shelf top; the exit at x=20 sits over the pit (18–22) so only the shelf (x 17–21 → 544–672px) is under the exit zone (640–680px) — the floor (ends at 576px) never reaches it. Horse sits at the couch base (x=16, floor), unavoidable on the way to the only climb.

```typescript
{
  variant: "C",
  source: "Pattern 12 + 14 — meet Horse, climb-only couch summit (Family Room finale)",
  note: "Horse on the floor at the couch base — meeting her then climbing is the only way out.",
  approxSeconds: 28,
  widthGrids: 22,
  heightGrids: 10,
  spawn: { x: 1, y: 0 },
  exit: { x: 20, y: 8 },                       // up on the shelf, over the pit
  platforms: [{ x: 17, y: 8, w: 4 }],          // couch-top shelf, -102 (270px up): climb-only
  climbWalls: [{ x: 17, y: 0, h: 9 }],         // floor → shelf face at the shelf's left edge
  zones: [
    { x: 3, y: 0, kind: "enemy" },             // dust mites at the base (primary)
    { x: 6, y: 0, kind: "enemy" },
    { x: 16, y: 0, kind: "companion" },        // Horse at the couch base (comfortably reachable)
  ],
  pits: [{ x: 18, w: 4 }],                      // floor ends at 18 → nothing under the exit but the shelf
},
```

- [ ] **Step 2: Author the remaining variants (B, A, A·2 for each slot; C for slots 1–4)**

Following the `B→A→A→C` escalation (gentle warmup → research-baseline → mastery repeat → twist) and the per-slot table above:
- **B/A variants** are gentle floor lead-ins (dust-mite stomps, token breadcrumbs, optional low climbs / dash spills for bonus tokens). **No lethal pits in slots 1–3** (forgiveness curve). Their `exit` values are dropped by `combineSlot` (only C's exit is the level exit), so author them as continuous floor sections that hand off into the next segment. Mirror the non-gate scaffolding of `HALLWAY_SLOTS` / `KITCHEN_SLOTS` in the same file.
- **Carryover variety** (the area's identity): tag enemy zones with `enemyType` to bring back old foes — `enemyType:"dust_bunny"` in slot 2, then `enemyType:"spider"` and `enemyType:"ant"` in slot 3, and a mixed set in slot 4. Untagged enemy zones stay dust mites. Introduce one returning type at a time so it reads as a gentle recap, not a spike.
- **Slot 4 C variant:** a lethal pit (~5 grid / 160px, double-jump-clearable) with a mixed swarm on the approach; exit on the floor past the pit. Dash optional.
- **Slots 1–3 C variants:** end on the floor (or a low optional climb for a bonus token) — **no mandatory climb** (keep the gate singular to slot 5). The optional climbs use a short `climbWall` to a token platform the base path skips.

Point `FAMILY_ROOM_AREA.slots` at the new const — in `src/design/levelSketches.ts` replace:

```typescript
  slots: stubSlots("the family room", "Horse", "dust mite"),
```

with:

```typescript
  slots: FAMILY_ROOM_SLOTS,
```

(Declare `export const FAMILY_ROOM_SLOTS: LevelSlot[] = [ ... ]` above `FAMILY_ROOM_AREA`, with all 5 slots.)

- [ ] **Step 3: Iterate against the lint on `/maps.html` + build**

Run the dev server (`npm run dev`) and open `/maps.html` — confirm Family Room shows **15/15 drafted**, the finale climb reads visually, and the carryover critters appear in the middle slots. Then:

Run: `npm run build`
Expected: the reachability lint passes for all 5 Family Room levels with `abilitiesForArea("familyRoom") = {doubleJump, dash, wallClimb}`. If a level reports `exit-unreachable` or `companion-stranded`, widen/narrow the offending gap or shelf height and re-run. **Do not** loosen slot 5's climb gate to pass — the not-without proof in Task 7 must still fail correctly.

- [ ] **Step 4: Commit**

```bash
git add src/design/levelSketches.ts
git commit -m "feat(family-room): author 15 variants — enemy-forward, climb-light, single finale climb gate"
```

---

# PHASE 2 — Pipeline Switch

## Task 6: `familyRoomLevels.ts` + catalog wiring

**Files:**
- Create: `src/levels/familyRoomLevels.ts`
- Modify: `src/levels/levelCatalog.ts` (import; `FAMILY_ROOM_ENTRIES`; `LEVEL_CATALOG`)

- [ ] **Step 1: Create `src/levels/familyRoomLevels.ts`**

```typescript
import { FAMILY_ROOM_AREA } from "../design/levelSketches";
import { encodeAreaLevels } from "./encodeFromSketch";
import type { LevelData } from "../types/level";

/**
 * Family Room levels — auto-generated from FAMILY_ROOM_AREA sketches via
 * encodeFromSketch. Each slot's B → A → A → C variants chain into one level.
 *
 * Gate: wall-climb (Cat, from the Kitchen) for the single finale couch-back,
 * which also gates the Horse pickup. Companion earned here: Horse (grants
 * charge — used in the Living Room, not here). Enemy-forward via carryover
 * (dust mites + returning dust bunnies/spiders/ants).
 */
const SEGMENT_ORDER = ["B", "A", "A", "C"];

export const FAMILY_ROOM_LEVELS = encodeAreaLevels(FAMILY_ROOM_AREA, SEGMENT_ORDER) as LevelData[];
```

- [ ] **Step 2: Wire `FAMILY_ROOM_ENTRIES` into the catalog**

In `src/levels/levelCatalog.ts`, add the import after the Kitchen import (line 4):

```typescript
import { FAMILY_ROOM_LEVELS } from "./familyRoomLevels";
```

Add the entries block after `KITCHEN_ENTRIES` (after line 39):

```typescript
const FAMILY_ROOM_ENTRIES: LevelCatalogEntry[] = FAMILY_ROOM_LEVELS.map((level, index) => ({
  areaId: "familyRoom",
  backgroundKey: `${PLACEHOLDER_BG.key}_f_${index}`,
  backgroundUrl: PLACEHOLDER_BG.url,
  raw: level as unknown as LevelData,
}));
```

And extend `LEVEL_CATALOG` (line 41):

```typescript
export const LEVEL_CATALOG: LevelCatalogEntry[] = [...BEDROOM_ENTRIES, ...HALLWAY_ENTRIES, ...KITCHEN_ENTRIES, ...FAMILY_ROOM_ENTRIES];
```

- [ ] **Step 3: Verify the catalog + smoke tests pass**

Run: `npx vitest run src/levels/levelCatalog.smoke.test.ts src/levels/levelTextures.test.ts`
Expected: PASS — every Family Room level is Zod-valid and references only loaded sprites (`dustMite` + carryover enemies + `horse` companion are all registered from Task 1; catalog now 20 levels).

- [ ] **Step 4: Commit**

```bash
git add src/levels/familyRoomLevels.ts src/levels/levelCatalog.ts
git commit -m "feat(family-room): sketch-driven familyRoomLevels + catalog wiring (5 levels live)"
```

---

# PHASE 3 — Auto-Proof

## Task 7: `familyRoom.integration.test.ts` — climb gate + Horse + carryover proof

**Files:**
- Test: `src/levels/familyRoom.integration.test.ts` (new)

Pins the metroidvania guarantee: solvable with the full loadout; the **climb** gate bites at the finale (slot 5); **Horse** is reachable; and **carryover** actually produces mixed enemy types in the encoded data (proving the `enemyType` override flows end-to-end). Mirrors `kitchen.integration.test.ts`. **Note the level ids:** `encodeAreaLevels` derives the id prefix from the area name, so the ids are `family-room-1` … `family-room-5` (hyphenated).

- [ ] **Step 1: Write the test**

Create `src/levels/familyRoom.integration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encodeAreaLevels } from "./encodeFromSketch";
import { FAMILY_ROOM_AREA } from "../design/levelSketches";
import { checkReachability } from "./reachability";
import { abilitiesForArea } from "../config/gating";
import { parseLevelData, type LevelData } from "../types/level";

const SEGMENT_ORDER = ["B", "A", "A", "C"];
const FULL = abilitiesForArea("familyRoom"); // { doubleJump, dash, wallClimb }

function familyRoomLevels(): LevelData[] {
  return (encodeAreaLevels(FAMILY_ROOM_AREA, SEGMENT_ORDER) as unknown[]).map(parseLevelData);
}
const byId = (id: string) => familyRoomLevels().find((l) => l.id === id);
const errorsFor = (level: LevelData, abilities: Set<string>) =>
  checkReachability(level, { abilities: abilities as Set<any> }).problems.filter((p) => p.severity === "error");

describe("Family Room — every authored level is completable with the full loadout", () => {
  const levels = familyRoomLevels();
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

describe("Family Room — the climb gate bites (finale, slot 5)", () => {
  it("family-room-5 is NOT solvable without wallClimb", () => {
    const level = byId("family-room-5");
    expect(level, "family-room-5 not authored").toBeDefined();
    expect(errorsFor(level!, new Set(["doubleJump", "dash"])).length).toBeGreaterThan(0);
  });
});

describe("Family Room — Horse is comfortably reachable (slot 5)", () => {
  it("no companion-stranded with the full loadout", () => {
    const level = byId("family-room-5");
    expect(level, "family-room-5 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: FULL });
    expect(r.problems.find((p) => p.kind === "companion-stranded")?.message).toBeUndefined();
  });
});

describe("Family Room — carryover produces mixed enemy types", () => {
  it("more than one distinct enemy type appears across the area", () => {
    const types = new Set<string>();
    for (const level of familyRoomLevels()) {
      for (const e of level.enemies) types.add(e.type);
    }
    expect(types.size, `enemy types seen: ${[...types].join(", ")}`).toBeGreaterThan(1);
    expect(types.has("dustMite"), "primary dust mite missing").toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/levels/familyRoom.integration.test.ts`
Expected: PASS. If "NOT solvable without wallClimb" fails (the finale IS solvable without climbing), the gate is too weak — return to Task 5 and raise the shelf / ensure no non-climb route reaches it, then re-run. If the carryover assertion fails, an `enemyType` override is missing from the authored content (Task 5) — add returning-foe zones to slots 2–4.

- [ ] **Step 3: Commit**

```bash
git add src/levels/familyRoom.integration.test.ts
git commit -m "test(family-room): climb-gate + Horse + carryover auto-proof"
```

---

## Task 8: Final build + manual-playtest handoff

**Files:** none (verification only)

- [ ] **Step 1: Full build green**

Run: `npm run build`
Expected: tsc clean; **all Vitest pass** (216 prior + carryover element tests + the new integration suite); reachability lint green over the **whole catalog including the 5 Family Room levels** (20 total); texture smoke green; vite build ok.

- [ ] **Step 2: Runtime smoke (dev preview)**

Run `npm run dev`, open the game. Continue/console-load into the Family Room (levels 16–20, 0-indexed 15–19). Confirm: dust mites render + patrol; at least one carryover type (dust bunny / spider / ant) renders in slots 2–4; the finale couch-back is climbable (Up/W); Horse pickup fires `PowerUnlockScene` (grants charge); `/maps.html` shows Family Room **15/15 drafted**; no console errors.

- [ ] **Step 3: Note the manual-playtest handoff**

Phaser ignores synthetic input, so *feel* (dust-mite hitboxes, climb speed at the finale, the enemy-density pacing, Horse-before-the-climb ordering in slot 5) is a human handoff — same pattern as every prior area. Mechanical correctness is lint- + test-proven. Record any tuning notes in `PROGRESS.md`.

---

## Self-Review (completed)

- **Spec coverage:** §3.1 carryover → Task 3; §3.2 DustMite entity + GameScene branch + texture registration → Tasks 1–2; §4 content (5 slots, enemy-forward, climb-light, single finale gate) → Task 5; §5 pipeline switch → Task 6; §6 auto-proof (solvable-with, not-without climb, Horse reachable, carryover) → Task 7; §7 "meet Horse" (PowerUnlockScene already wired — no code) → covered by Task 8 smoke; §2 gating (no change) → confirmed in `FULL = abilitiesForArea("familyRoom")` (Task 7). All covered. (No in-level climb prompt task — the spec §7 says it's optional since the player has climbed since the Kitchen; not authored.)
- **Placeholder scan:** every code step shows complete code; the only intentionally-iterative step is Task 5 (hand-authored content), which ships a verified seed literal for the load-bearing finale (slot 5 C) + geometry targets + carryover placement guidance + a convergence loop against Task 7's proof — the honest structure for lint-tuned content (matches the Hallway/Kitchen builds).
- **Type consistency:** `SketchZone.enemyType?: EnemyType` defined before use (Task 3 step 3) and preserved through `combineSlot` (step 4) and resolved in the encoder (step 5); `encodeSlotToLevelData(slot, order, idPrefix, primaryEnemy, companionType)` signature matches every call; runtime enemy `type` values (`"dustMite"`, `"spider"`, `"dustBunny"`) match the `EnemySpawn` Zod enum; `abilitiesForArea("familyRoom")` returns `{doubleJump, dash, wallClimb}` (confirmed against `gating.ts` — Horse lacks `metAtStart`); level ids `family-room-1`…`family-room-5` match the encoder's `${idPrefix}-${slot.id}` with `idPrefix="family-room"` (area name "Family Room" → lowercased + spaces-to-hyphens).
```