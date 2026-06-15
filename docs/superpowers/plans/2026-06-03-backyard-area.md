# Backyard Area (World 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 5-level **Backyard** (World 5) — the only outdoor area and the pre-boss graduation. Eloise meets **Flamingo** at a high windowsill (`metAtStart`), earns **glide**, and sails out into the yard. **Charge** (held from Horse) is the entry gate (smash hedges/fence panels); **glide** becomes load-bearing in-level for the first time (the kiddie-pool gap + the treehouse finale). All four enemies recap via the already-shipped carryover system.

**Architecture:** Mirror the Family Room build — most infra already ships. Phase 0 adds the only two new authoring plumbing mirrors: `breakable` in the sketch vocab (a `climbWalls`-style passthrough) and **elevatable spawn** (a one-line `exit.y` mirror so the windowsill sits high), plus the `livingRoom`→`backyard` rename + Flamingo `metAtStart`. Phase 1 authors 15 variants on `/maps.html`, tuned against the build-time reachability lint, with the charge gate seeded deterministically and the glide gaps tuned. Phase 2 switches `backyardLevels.ts` to sketch-driven and wires the catalog (25 levels). Phase 3 pins both gates + Flamingo with an integration test.

**Tech Stack:** Phaser 3.80, TypeScript (strict), Vite 6, Zod, Vitest. **No new runtime/game logic:** `BreakableSchema` + `LevelData.breakables` already exist and are scaled; GameScene already builds + smashes breakables from `data.breakables`; `checkReachability` already reads `level.breakables` and derives `chargeActive` from the abilities set; glide is already modeled (`Math.max(arcFallTime, glideFallTime)`); the carryover `enemyType` override + all four enemy GameScene branches already ship; `metAtStart` already exists (Cat). The only gaps are the **sketch→encoder authoring path** for `breakable` and **spawn.y** elevation.

**Spec:** `docs/superpowers/specs/2026-06-03-backyard-area-design.md`

---

## File Structure

**Phase 0 — Infra + rename (deterministic):**
- Modify: `src/design/levelSketches.ts` — `SketchBreakable` type + `LevelOption.breakables?`; `LIVING_ROOM_AREA`→`BACKYARD_AREA` (+ `ALL_AREAS`, Dollhouse re-theme).
- Modify: `src/design/combineSlot.ts` — preserve `breakables` when chaining segments.
- Modify: `src/levels/encodeFromSketch.ts` — emit `breakables` (grid→design); honor `combined.spawn.y`.
- Modify: `src/levels/encodeFromSketch.elements.test.ts` — breakable round-trip + elevatable-spawn tests.
- Modify: `src/config/areas.ts` + `areas.test.ts` — `livingRoom`→`backyard` AreaId.
- Modify: `src/config/companions.ts` — Flamingo `area:"backyard"` + `metAtStart:true`.
- Modify: `src/config/textures.ts` — register `flamingo` in `ENTITY_TEXTURE_KEYS`.
- Modify: `src/main.ts` + demo/test comments — `Living Room`→`Backyard` strings.

**Phase 1 — Content (iterative authoring):**
- Modify: `src/design/levelSketches.ts` — new `BACKYARD_SLOTS` const (5 slots × A/B/C); point `BACKYARD_AREA.slots` at it.

**Phase 2 — Pipeline switch:**
- Create: `src/levels/backyardLevels.ts` — `encodeAreaLevels(BACKYARD_AREA, SEGMENT_ORDER)`.
- Modify: `src/levels/levelCatalog.ts` — `BACKYARD_ENTRIES` concatenated after `FAMILY_ROOM_ENTRIES`.

**Phase 3 — Proof:**
- Create: `src/levels/backyard.integration.test.ts` — charge + glide gate + Flamingo auto-proof.

---

# PHASE 0 — Infrastructure

## Task 1: `breakable` sketch vocab + elevatable spawn (TDD)

**Files:**
- Modify: `src/design/levelSketches.ts` (`SketchBreakable` type after `SketchClimbWall` ~line 67; `LevelOption.breakables?` after `climbWalls` ~line 83)
- Modify: `src/design/combineSlot.ts` (import; `CombinedLevel`; collect loop; return)
- Modify: `src/levels/encodeFromSketch.ts` (`spawn.y` line 67; breakables map after the climbWalls map ~line 124; output ~line 186)
- Test: `src/levels/encodeFromSketch.elements.test.ts` (append two `describe` blocks)

`BreakableSchema` and `LevelData.breakables` already exist (`types/level.ts:41,88`) and `scaleLevelData` already scales them (`:136`). This adds the missing **sketch → combined → encoder** path (mirror of `climbWalls`) plus the one-line **spawn.y** elevation (mirror of the elevatable exit).

- [ ] **Step 1: Write the failing tests**

Append to `src/levels/encodeFromSketch.elements.test.ts`:

```typescript
describe("encoder — breakables element", () => {
  it("emits a game-coord breakable rooted at the floor", () => {
    const slot = slotWith({ breakables: [{ x: 10, y: 0, w: 2, h: 7 }] });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.breakables?.length).toBe(1);
    const b = level.breakables![0]!;
    expect(b.x).toBe(10 * GRID);
    expect(b.y).toBe(DESIGN_FLOOR_Y - 7 * GRID);   // top: 7 grids up
    expect(b.y + b.h).toBe(DESIGN_FLOOR_Y);         // bottom: at the floor top
    expect(b.w).toBe(2 * GRID);
  });
  it("a sketch without breakables emits no breakables key", () => {
    const slot = slotWith({});
    const raw = encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat") as { breakables?: unknown };
    expect(raw.breakables).toBeUndefined();
  });
});

describe("encoder — elevatable spawn", () => {
  it("floor spawn (y=0) sits at the floor", () => {
    const slot = slotWith({ spawn: { x: 1, y: 0 } });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.spawn.y).toBe(DESIGN_FLOOR_Y);
  });
  it("elevated spawn (y=7) sits 7 grids up (the windowsill)", () => {
    const slot = slotWith({ spawn: { x: 1, y: 7 } });
    const level = parseLevelData(encodeSlotToLevelData(slot, ["A"], "test", "ant", "cat"));
    expect(level.spawn.y).toBe(DESIGN_FLOOR_Y - 7 * GRID);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/levels/encodeFromSketch.elements.test.ts -t "breakables element|elevatable spawn"`
Expected: FAIL — a TS error on `breakables` not existing on `LevelOption`, and the spawn test returning `DESIGN_FLOOR_Y` regardless of `spawn.y`.

- [ ] **Step 3: Add `SketchBreakable` + `LevelOption.breakables?`**

In `src/design/levelSketches.ts`, insert the `SketchBreakable` type immediately after the `SketchClimbWall` type (after line 67, before `LevelOption`):

```typescript
export type SketchBreakable = {
  /** Left grid column of the barricade. */
  x: number;
  /** Base height in grids (0 = rooted at the floor). */
  y: number;
  /** Width in grids. */
  w: number;
  /** Height in grids. Author ≥ 6 (above the ~5-grid double-jump apex) so the
   *  barricade is honestly unjumpable and must be smashed with charge. */
  h: number;
};
```

Then add `breakables` to `LevelOption`, immediately after the `climbWalls?` line (line 83):

```typescript
  /** Solid charge barricades (the Backyard hedge/fence gate). Each blocks the
   *  doorway between the surfaces it sits between until charge clears it. */
  breakables?: SketchBreakable[];
```

- [ ] **Step 4: Preserve `breakables` through `combineSlot`**

In `src/design/combineSlot.ts`:

(a) Add `SketchBreakable` to the type import (lines 1-8) — insert after `SketchClimbWall,`:

```typescript
  SketchBreakable,
```

(b) Add the field to `CombinedLevel`, immediately after `climbWalls: SketchClimbWall[];` (line 36):

```typescript
  breakables: SketchBreakable[];
```

(c) Declare the accumulator, immediately after `const climbWalls: SketchClimbWall[] = [];` (line 56):

```typescript
  const breakables: SketchBreakable[] = [];
```

(d) Collect with the x-cursor offset, immediately after the `climbWalls` collect loop (after line 112):

```typescript
    for (const b of opt.breakables ?? []) {
      breakables.push({ ...b, x: b.x + xCursor });
    }
```

(e) Include it in the returned object, immediately after `climbWalls,` (line 156):

```typescript
    breakables,
```

- [ ] **Step 5: Honor `spawn.y` + emit `breakables` in the encoder**

In `src/levels/encodeFromSketch.ts`:

(a) Replace the spawn block (lines 64-68):

```typescript
  // ── Spawn ────────────────────────────────────────────────────────────
  const spawn = {
    x: combined.spawn.x * GRID_PX + GRID_PX / 2,
    y: DESIGN_FLOOR_Y - combined.spawn.y * GRID_PX,
  };
```

(b) Add the breakables map immediately after the `climbWalls` map block (after line 124, before the Tokens section):

```typescript
  // ── Breakables (solid charge barricades; grid → design top-left) ──────
  const breakables = combined.breakables.map((b) => ({
    x: b.x * GRID_PX,
    y: DESIGN_FLOOR_Y - (b.y + b.h) * GRID_PX,
    w: b.w * GRID_PX,
    h: b.h * GRID_PX,
  }));
```

(c) Emit it in the returned object, immediately after the `climbWalls` line (line 186):

```typescript
    ...(breakables.length ? { breakables } : {}),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/levels/encodeFromSketch.elements.test.ts`
Expected: PASS — all element suites (the new breakable + elevatable-spawn blocks plus the pre-existing requires/climbWalls/exit/carryover suites).

- [ ] **Step 7: Verify every existing area is byte-identical**

Run: `npx vitest run src/levels/hallway.integration.test.ts src/levels/kitchen.integration.test.ts src/levels/familyRoom.integration.test.ts src/levels/reachability.integration.test.ts`
Expected: PASS — no existing sketch declares `breakables` or a non-zero `spawn.y`, so the `?? []` / `- 0` paths reproduce old behavior exactly.

- [ ] **Step 8: Commit**

```bash
git add src/design/levelSketches.ts src/design/combineSlot.ts src/levels/encodeFromSketch.ts src/levels/encodeFromSketch.elements.test.ts
git commit -m "feat(backyard): breakable sketch vocab + elevatable spawn (climbWalls/exit.y mirrors)"
```

---

## Task 2: Living Room → Backyard rename + Flamingo metAtStart + flamingo texture

**Files:**
- Modify: `src/config/areas.ts:2,5`; `src/config/areas.test.ts`
- Modify: `src/config/companions.ts:25`
- Modify: `src/config/textures.ts` (`ENTITY_TEXTURE_KEYS`)
- Modify: `src/design/levelSketches.ts` (`LIVING_ROOM_AREA`→`BACKYARD_AREA`; `ALL_AREAS`; `DOLLHOUSE_AREA` copy)
- Modify: `src/main.ts:99` + comment-only refs in `glideDemoLevel.ts`, `chargeDemoLevel.ts`, `familyRoomLevels.ts`, `charge.integration.test.ts`

The AreaId index is unchanged (still position 4), so the order-based gating chain is identical — `gatingPower("backyard")` still resolves to charge, and `abilitiesForArea("backyard")` gains glide via Flamingo's `metAtStart`. The `flamingo` texture-registration gap (it's loaded by BootScene but missing from `ENTITY_TEXTURE_KEYS`) must be filled now, or the catalog smoke test fails in Task 5 once a Backyard level references the Flamingo companion.

- [ ] **Step 1: Rename the AreaId**

In `src/config/areas.ts`, replace line 2:

```typescript
  | "bedroom" | "hallway" | "kitchen" | "familyRoom" | "backyard" | "dollhouse";
```

and line 5 (inside `AREA_ORDER`):

```typescript
  "bedroom", "hallway", "kitchen", "familyRoom", "backyard", "dollhouse",
```

In `src/config/areas.test.ts`, replace the expectation array:

```typescript
      "bedroom", "hallway", "kitchen", "familyRoom", "backyard", "dollhouse",
```

- [ ] **Step 2: Point Flamingo at the backyard + meet-at-start**

In `src/config/companions.ts`, replace line 25:

```typescript
  flamingo: { area: "backyard",   grants: "glide",      idleKey: FLAMINGO_IDLE, walkKey: FLAMINGO_WALK, metAtStart: true },
```

- [ ] **Step 3: Register the Flamingo companion textures**

In `src/config/textures.ts`, add the `flamingo` entry to `ENTITY_TEXTURE_KEYS`, immediately after the `horse` line:

```typescript
  flamingo: [FLAMINGO_IDLE, FLAMINGO_WALK],
```

(`FLAMINGO_IDLE`/`FLAMINGO_WALK` are already declared in this file at lines 27-28 and loaded by `BootScene` — only the `ENTITY_TEXTURE_KEYS` map entry is missing.)

- [ ] **Step 4: Rename the area scaffold**

In `src/design/levelSketches.ts`, replace the `LIVING_ROOM_AREA` block:

```typescript
export const BACKYARD_AREA: Area = {
  id: 5,
  name: "Backyard",
  worldKey: "World5_Backyard",
  intent: "Pre-boss graduation, outdoors. Glide out the window into the yard; charge through hedges. All four enemies recap. Find Flamingo.",
  companion: "flamingo",
  primaryEnemy: "ant",
  carryOverEnemies: ["spider", "dust_bunny", "dust_mite"],
  slots: stubSlots("the backyard", "Flamingo", "any-enemy recap"),
};
```

In `ALL_AREAS`, replace `  LIVING_ROOM_AREA,` with:

```typescript
  BACKYARD_AREA,
```

Re-theme the `DOLLHOUSE_AREA` copy (name/intent only; the boss build is its own spec) — replace its `name`, `worldKey`, and `intent`:

```typescript
  name: "Playhouse",
  worldKey: "World6_Playhouse",
  intent: "Outdoor playhouse — the T-Rex boss arena, reached from the backyard. Single set-piece encounter, no level progression.",
```

(Leave the `dollhouse` AreaId in `areas.ts` unchanged — the boss spec owns any AreaId rename. This step only updates display copy.)

- [ ] **Step 5: Update the remaining `Living Room` string references**

In `src/main.ts:99`, update the comment:

```typescript
  charge: ["doubleJump", "dash", "wallClimb", "charge"], // charge gate assumes the Backyard loadout
```

Update these comment/label-only references (cosmetic, but the area no longer exists by that name):
- `src/levels/glideDemoLevel.ts:14` — `a glide gate can't appear before the Living Room` → `…before the Backyard`.
- `src/levels/chargeDemoLevel.ts:13` — `a charge gate can't appear before the Living Room` → `…before the Backyard`.
- `src/levels/familyRoomLevels.ts:11` — `charge — used in the Living Room, not here` → `…used in the Backyard, not here`.
- `src/levels/charge.integration.test.ts` — the `it("solvable WITH the Living Room loadout …")` description → `…WITH the Backyard loadout …`.

- [ ] **Step 6: Verify typecheck + config tests + grep clean**

Run: `npm run typecheck && npx vitest run src/config/areas.test.ts src/config/companions.test.ts && grep -rniE "livingRoom|living room|World5_LivingRoom" src/ || echo "GREP CLEAN"`
Expected: typecheck clean; `areas.test.ts` + `companions.test.ts` PASS (companions test is dynamic over `AREA_ORDER.slice(0,5)`, so the rename flows through; `metAtStart` is untested there); the grep prints `GREP CLEAN` (no stale `livingRoom`/`Living Room` references remain).

- [ ] **Step 7: Commit**

```bash
git add src/config/areas.ts src/config/areas.test.ts src/config/companions.ts src/config/textures.ts src/design/levelSketches.ts src/main.ts src/levels/glideDemoLevel.ts src/levels/chargeDemoLevel.ts src/levels/familyRoomLevels.ts src/levels/charge.integration.test.ts
git commit -m "feat(backyard): rename livingRoom→backyard, Flamingo metAtStart, register flamingo texture, retheme Dollhouse→Playhouse"
```

---

## Task 3: Phase 0 checkpoint — full build green

**Files:** none (verification only)

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: tsc clean; **all Vitest pass** (256 prior + the new breakable/spawn element tests); reachability lint over the whole catalog green (no Backyard levels yet — still 20); texture smoke green; vite build ok. Bedroom/Hallway/Kitchen/Family-Room unchanged. `/maps.html` shows Backyard with stub slots (0/N drafted).

If anything fails, fix before Phase 1 — content authoring assumes a green infra base.

---

# PHASE 1 — Author Backyard Content (iterative)

## Task 4: Author `BACKYARD_SLOTS` (5 slots × A/B/C)

**Files:**
- Modify: `src/design/levelSketches.ts` (new `BACKYARD_SLOTS`; point `BACKYARD_AREA.slots` at it)

The **iterative authoring** phase: draft on `/maps.html`, run `npm run build`, tune geometry until the reachability lint passes and (after Task 6) the proofs hold. The area is **descent→sprawl** with a **dual gate** — **charge** (smash a hedge/fence; load-bearing at slots 4 & 5) and **glide** (earned at the slot-1 windowsill via `metAtStart`; load-bearing at slots 3 & 5). Spawn comes from each level's **B** segment; the exit-controlling gate lives in the **C** segment (last of `B→A→A→C`).

**Geometry constants** (from `physics.ts`; `DESIGN_FLOOR_Y=168`, `GRID=32`, `PLATFORM_THICKNESS=14`; the lint is the source of truth — author, build, tune):
- Base flat reach ≈ 121px · double-jump flat reach ≈ 212px · dash lunge ≈ 320px
- Base apex ≈ 81px · double-jump apex ≈ 161px (≈ 5 grids)
- Glide descent ≈ 90px/s — a fall of height `H` lasts `H/90`, far longer than the gravity arc, so glide buys air-*time* → air-*distance* on descents.

**Per-slot intent (descent → sprawl, dual gate):**

| Slot | Beat | Charge | Glide | Enemies (carryover via `enemyType`) | Lethal? |
|------|------|--------|-------|-------------------------------------|---------|
| 1 | Out the Window | — | tutorial (forgiving drop) | 1–2 ants (primary) | No |
| 2 | Garden Path | optional hedge shortcut | optional drop | ants + `enemyType:"spider"` | No |
| 3 | Flower Beds & Pool | optional | **MANDATORY** pool gap | ants + spider + `enemyType:"dust_bunny"` | No (soft pool — splash, retry) |
| 4 | The Fence Line | **MANDATORY** fence panel | recurring | mixed + `enemyType:"dust_mite"` | **Yes** (kill pit) |
| 5 | Treehouse → Playhouse | **MANDATORY** final hedge | **MANDATORY** treehouse glide | climax mix (all four) | Yes |

- [ ] **Step 1: Seed Slot 1, B variant — the window entrance (elevatable spawn + Flamingo)**

Literal starting point for `BACKYARD_SLOTS[0]`'s `B` option (B is first → provides the level spawn). The windowsill is a floating platform at grid y=7 (~224px up); the player spawns on it beside Flamingo, then drops to the grass floor (which spans the full width — no pit beneath). The drop is forgiving (no kill plane between sill and floor); glide is optional flavor here.

```typescript
{
  variant: "B",
  source: "Pattern 1 + 14 — windowsill entrance, meet Flamingo, glide down (Backyard intro)",
  note: "High windowsill spawn (elevatable-spawn infra). Flamingo on the sill → glide out the window down to the grass. Floor runs full width under the sill, so the drop is forgiving.",
  approxSeconds: 14,
  widthGrids: 12,
  heightGrids: 8,
  spawn: { x: 1, y: 7 },                      // up on the windowsill (elevated)
  exit: { x: 11, y: 0 },                      // B's exit is dropped by combineSlot — author as a hand-off
  platforms: [{ x: 0, y: 7, w: 3 }],          // the windowsill (the player spawns here)
  zones: [
    { x: 1, y: 7, kind: "companion" },        // Flamingo on the sill (unavoidable; grants glide)
    { x: 6, y: 0, kind: "enemy" },            // an ant on the grass (primary; no override)
    { x: 9, y: 0, kind: "token" },
  ],
},
```

- [ ] **Step 2: Seed Slot 4, C variant — the charge gate (deterministic, from `chargeDemoLevel`)**

Literal starting point for `BACKYARD_SLOTS[3]`'s `C` option (C is last → provides the level exit). A `breakable` fence fills a 2-grid seam pit; it's 7 grids tall (224px > double-jump apex 161px) so it's honestly unjumpable, and `breakableInDoorway` blocks the floor-A→floor-B edge until charge clears it. Post-smash, the 64px gap is a **kill pit** (the slot's first lethal hazard), base-jumpable (121px > 64px). The exit sits on floor-B past the seam, so the spawn floor can't satisfy it.

```typescript
{
  variant: "C",
  source: "Charge gate — smash the fence panel (Backyard slot-4 finale segment)",
  note: "A breakable fence fills a lethal seam; smash with charge, then hop the gap. First MANDATORY charge + first lethal pit. Geometry from chargeDemoLevel.",
  approxSeconds: 22,
  widthGrids: 22,
  heightGrids: 8,
  spawn: { x: 1, y: 0 },
  exit: { x: 18, y: 0 },                       // far floor, past the seam (spawn floor ends at x=10)
  platforms: [],
  zones: [
    { x: 3, y: 0, kind: "enemy", enemyType: "dust_mite" },  // mixed swarm on the approach
    { x: 6, y: 0, kind: "enemy", enemyType: "ant" },
    { x: 20, y: 0, kind: "token" },                         // reward past the fence
  ],
  pits: [{ x: 10, w: 2 }],                      // lethal seam (kill plane below) — floor 0→10, 12→22
  breakables: [{ x: 10, y: 0, w: 2, h: 7 }],    // fence panel filling the seam, 224px (unjumpable)
},
```

- [ ] **Step 3: Seed Slot 5, C variant — the combo finale (charge half exact; glide gap tuned)**

Literal starting point for `BACKYARD_SLOTS[4]`'s `C` option. Charge through a hedge (exact, as Step 2), then double-jump onto a treehouse and **glide** across a wide chasm (the "pool") to the elevated playhouse door (elevatable exit). The charge half is deterministic; **the glide chasm width (`pits` second entry) must be tuned** against Task 6's "not without glide" proof — start from the `glideDemoLevel` proportion (high launch + wide gap + lower landing = glide-only) and widen/narrow until backyard-5 is solvable WITH glide and not without.

```typescript
{
  variant: "C",
  source: "Combo finale — charge the hedge, glide off the treehouse to the playhouse (Backyard finale)",
  note: "Smash the hedge (charge) → double-jump onto the treehouse → glide the chasm to the elevated playhouse door. TUNE the second pit (the glide chasm) against the slot-5 glide proof.",
  approxSeconds: 30,
  widthGrids: 24,
  heightGrids: 8,
  spawn: { x: 1, y: 0 },
  exit: { x: 21, y: 1 },                        // playhouse door, elevated on the far landing
  platforms: [
    { x: 11, y: 4, w: 3 },                      // treehouse launch (128px up; double-jump-reachable)
    { x: 20, y: 1, w: 4 },                      // far landing under the playhouse door
  ],
  zones: [
    { x: 3, y: 0, kind: "enemy", enemyType: "spider" },
    { x: 5, y: 0, kind: "enemy", enemyType: "ant" },
    { x: 12, y: 5, kind: "token" },             // over the treehouse (victory coda)
  ],
  pits: [{ x: 8, w: 2 }, { x: 14, w: 6 }],      // hedge seam (charge) + glide chasm (tune width)
  breakables: [{ x: 8, y: 0, w: 2, h: 7 }],     // the hedge (charge)
},
```

- [ ] **Step 4: Author the remaining variants (B/A/A for each slot; A/C for slots 1–3; A/B for slots 4–5)**

Following `B→A→A→C` (gentle warmup → research-baseline → mastery repeat → twist) and the per-slot table. Mirror the non-gate scaffolding of `HALLWAY_SLOTS` / `KITCHEN_SLOTS` / `FAMILY_ROOM_SLOTS` in the same file (gentle floor lead-ins, ant stomps, token breadcrumbs). Specifics:
- **No lethal pits in slots 1–3** (forgiveness curve). Their B/A `exit` values are dropped by `combineSlot` — author them as continuous grass sections handing off rightward.
- **Carryover variety** (the "recap all four"): tag enemy zones with `enemyType` — `"spider"` in slot 2, `"dust_bunny"` in slot 3, `"dust_mite"` in slot 4, and a mixed set in slot 5. Untagged zones stay ants (primary). One returning type at a time so it reads as a gentle graduation.
- **Slot 3, C variant — the mandatory glide gap (the kiddie pool):** a launch flower-bed platform (~y=3–4) and a far landing across a wide pit, tuned so the base arc undershoots but glide clears (start from the `glideDemoLevel` proportion: launch ~3.75 grids up, gap wide; narrow until glide-only). Critically, make a miss **non-lethal** — land the under-pit on a low ledge / shallow water (a `platform` at y=0–1 inside the gap) so falling short drops to a safe retry, NOT a kill plane. This keeps glide load-bearing (far landing unreachable without glide) while preserving "first lethal = slot 4." Verify against Task 6's "backyard-3 not solvable without glide".
- **Slots 1–3 C variants** otherwise end on the grass (or a low optional climb/glide for a bonus token) — **no mandatory charge** there (keep charge singular to slots 4–5).
- **Slot 2 optional hedge:** a `breakable` the player *may* smash for a shortcut, but with a base-path route around it (so it's optional, not a gate — the per-area proof only needs slots 4–5).

Point `BACKYARD_AREA.slots` at the new const — in `src/design/levelSketches.ts` replace:

```typescript
  slots: stubSlots("the backyard", "Flamingo", "any-enemy recap"),
```

with:

```typescript
  slots: BACKYARD_SLOTS,
```

(Declare `export const BACKYARD_SLOTS: LevelSlot[] = [ ... ]` above `BACKYARD_AREA`, with all 5 slots.)

- [ ] **Step 5: Iterate against the lint on `/maps.html` + build**

Run `npm run dev`, open `/maps.html` — confirm Backyard shows **15/15 drafted**, the windowsill/treehouse read visually, hedges and the pool render, and carryover critters appear. Then:

Run: `npm run build`
Expected: the reachability lint passes for all 5 Backyard levels with `abilitiesForArea("backyard") = {doubleJump, dash, wallClimb, charge, glide}`. If a level reports `exit-unreachable` or `companion-stranded`, adjust the offending gap/shelf and re-run. **Do not** loosen the slot-4 fence or the slot-3/5 glide gaps to pass — Task 6's not-without proofs must still fail correctly.

- [ ] **Step 6: Commit**

```bash
git add src/design/levelSketches.ts
git commit -m "feat(backyard): author 15 variants — descent→sprawl, charge+glide dual gate, all-enemy recap"
```

---

# PHASE 2 — Pipeline Switch

## Task 5: `backyardLevels.ts` + catalog wiring

**Files:**
- Create: `src/levels/backyardLevels.ts`
- Modify: `src/levels/levelCatalog.ts` (import; `BACKYARD_ENTRIES`; `LEVEL_CATALOG`)

- [ ] **Step 1: Create `src/levels/backyardLevels.ts`**

```typescript
import { BACKYARD_AREA } from "../design/levelSketches";
import { encodeAreaLevels } from "./encodeFromSketch";
import type { LevelData } from "../types/level";

/**
 * Backyard levels — auto-generated from BACKYARD_AREA sketches via
 * encodeFromSketch. Each slot's B → A → A → C variants chain into one level.
 *
 * Gate: charge (Horse, from the Family Room) for the hedge/fence barricades.
 * In-area power: glide (Flamingo, metAtStart) — the windowsill entrance, the
 * kiddie-pool gap, and the treehouse finale. Enemy-forward via carryover
 * (ants + returning spiders/dust bunnies/dust mites).
 */
const SEGMENT_ORDER = ["B", "A", "A", "C"];

export const BACKYARD_LEVELS = encodeAreaLevels(BACKYARD_AREA, SEGMENT_ORDER) as LevelData[];
```

- [ ] **Step 2: Wire `BACKYARD_ENTRIES` into the catalog**

In `src/levels/levelCatalog.ts`, add the import after the Family Room import (line 5):

```typescript
import { BACKYARD_LEVELS } from "./backyardLevels";
```

Add the entries block after `FAMILY_ROOM_ENTRIES` (after line 47):

```typescript
const BACKYARD_ENTRIES: LevelCatalogEntry[] = BACKYARD_LEVELS.map((level, index) => ({
  areaId: "backyard",
  backgroundKey: `${PLACEHOLDER_BG.key}_b_${index}`,
  backgroundUrl: PLACEHOLDER_BG.url,
  raw: level as unknown as LevelData,
}));
```

And extend `LEVEL_CATALOG` (line 49):

```typescript
export const LEVEL_CATALOG: LevelCatalogEntry[] = [...BEDROOM_ENTRIES, ...HALLWAY_ENTRIES, ...KITCHEN_ENTRIES, ...FAMILY_ROOM_ENTRIES, ...BACKYARD_ENTRIES];
```

- [ ] **Step 3: Verify the catalog + smoke tests pass**

Run: `npx vitest run src/levels/levelCatalog.smoke.test.ts src/levels/levelTextures.test.ts`
Expected: PASS — every Backyard level is Zod-valid and references only loaded sprites (ant/spider/dustBunny/dustMite enemies + the `flamingo` companion are all registered; `breakables` are valid per `BreakableSchema`; catalog now 25 levels).

- [ ] **Step 4: Commit**

```bash
git add src/levels/backyardLevels.ts src/levels/levelCatalog.ts
git commit -m "feat(backyard): sketch-driven backyardLevels + catalog wiring (5 levels live, catalog 25)"
```

---

# PHASE 3 — Auto-Proof

## Task 6: `backyard.integration.test.ts` — charge + glide gate + Flamingo proof

**Files:**
- Test: `src/levels/backyard.integration.test.ts` (new)

Pins the metroidvania guarantee: solvable with the full loadout; **charge** bites at slots 4 & 5; **glide** bites at slots 3 & 5; **Flamingo** is reachable (slot 1); and **carryover** produces mixed enemy types. Mirrors `familyRoom.integration.test.ts`. Level ids are `backyard-1` … `backyard-5` (area name "Backyard" → lowercased).

- [ ] **Step 1: Write the test**

Create `src/levels/backyard.integration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encodeAreaLevels } from "./encodeFromSketch";
import { BACKYARD_AREA } from "../design/levelSketches";
import { checkReachability } from "./reachability";
import { abilitiesForArea } from "../config/gating";
import { parseLevelData, type LevelData } from "../types/level";

const SEGMENT_ORDER = ["B", "A", "A", "C"];
const FULL = abilitiesForArea("backyard"); // { doubleJump, dash, wallClimb, charge, glide }
const NO_CHARGE = new Set(["doubleJump", "dash", "wallClimb", "glide"]);
const NO_GLIDE = new Set(["doubleJump", "dash", "wallClimb", "charge"]);

function backyardLevels(): LevelData[] {
  return (encodeAreaLevels(BACKYARD_AREA, SEGMENT_ORDER) as unknown[]).map(parseLevelData);
}
const byId = (id: string) => backyardLevels().find((l) => l.id === id);
const errorsFor = (level: LevelData, abilities: Set<string>) =>
  checkReachability(level, { abilities: abilities as Set<any> }).problems.filter((p) => p.severity === "error");

describe("Backyard — every authored level is completable with the full loadout", () => {
  const levels = backyardLevels();
  it("has 5 levels authored", () => {
    expect(levels.length).toBe(5);
  });
  for (const level of levels) {
    it(`${level.id} — solvable WITH {doubleJump, dash, wallClimb, charge, glide}`, () => {
      const errors = errorsFor(level, FULL);
      expect(errors, errors.map((e) => e.message).join(" | ")).toHaveLength(0);
    });
  }
});

describe("Backyard — the charge gate bites (slots 4 & 5)", () => {
  for (const id of ["backyard-4", "backyard-5"]) {
    it(`${id} is NOT solvable without charge`, () => {
      const level = byId(id);
      expect(level, `${id} not authored`).toBeDefined();
      expect(errorsFor(level!, NO_CHARGE).length).toBeGreaterThan(0);
    });
  }
});

describe("Backyard — the glide gate bites (slots 3 & 5)", () => {
  for (const id of ["backyard-3", "backyard-5"]) {
    it(`${id} is NOT solvable without glide`, () => {
      const level = byId(id);
      expect(level, `${id} not authored`).toBeDefined();
      expect(errorsFor(level!, NO_GLIDE).length).toBeGreaterThan(0);
    });
  }
});

describe("Backyard — Flamingo is comfortably reachable (slot 1)", () => {
  it("no companion-stranded with the full loadout", () => {
    const level = byId("backyard-1");
    expect(level, "backyard-1 not authored").toBeDefined();
    const r = checkReachability(level!, { abilities: FULL });
    expect(r.problems.find((p) => p.kind === "companion-stranded")?.message).toBeUndefined();
  });
});

describe("Backyard — carryover recaps all four enemy types", () => {
  it("more than one distinct enemy type appears across the area", () => {
    const types = new Set<string>();
    for (const level of backyardLevels()) {
      for (const e of level.enemies) types.add(e.type);
    }
    expect(types.size, `enemy types seen: ${[...types].join(", ")}`).toBeGreaterThan(1);
    expect(types.has("ant"), "primary ant missing").toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/levels/backyard.integration.test.ts`
Expected: PASS. If "NOT solvable without charge/glide" fails (the level IS solvable without the power), the gate is too weak — return to Task 4 and tighten the offending fence (charge) or widen the glide chasm/pool gap, then re-run. If the carryover assertion fails, add `enemyType` overrides to slots 2–5.

- [ ] **Step 3: Commit**

```bash
git add src/levels/backyard.integration.test.ts
git commit -m "test(backyard): charge + glide dual-gate + Flamingo + carryover auto-proof"
```

---

## Task 7: Final build + manual-playtest handoff

**Files:** none (verification only)

- [ ] **Step 1: Full build green**

Run: `npm run build`
Expected: tsc clean; **all Vitest pass** (256 prior + breakable/spawn element tests + the new integration suite); reachability lint green over the **whole catalog including the 5 Backyard levels** (25 total); texture smoke green; vite build ok.

- [ ] **Step 2: Runtime smoke (dev preview)**

Run `npm run dev`, open the game. Continue/console-load into the Backyard (levels 21–25, 0-indexed 20–24; `eloiseState.levelIndex = 20` then start GameScene). Confirm: the windowsill spawns high with Flamingo; `PowerUnlockScene` fires on the Flamingo pickup (grants glide) + the "Hold to glide!" prompt shows (if authored); a hedge/fence breakable renders and smashes with charge; the pool/treehouse glide gaps render; mixed enemy types render across slots; `/maps.html` shows Backyard **15/15 drafted**; no console errors.

- [ ] **Step 3: Note the manual-playtest handoff**

Phaser ignores synthetic input, so *feel* (the window glide-in, the pool-gap timing, the fence smash, the combo finale, carryover density) is a human handoff — same as every prior area. Mechanical correctness is lint- + test-proven; rendering is screenshot-confirmed. Record tuning notes in `PROGRESS.md`, and update `ROADMAP.md` 7.1 (Backyard `[x]`, 4/5 areas) + the `## Current Status` block in `CLAUDE.md`.

---

## Self-Review (completed)

- **Spec coverage:** §3.1 `breakable` vocab → Task 1 (steps 3–5); §3.2 elevatable spawn → Task 1 (step 5a); §3.3 rename + Flamingo `metAtStart` + primary ant + Dollhouse re-theme + flamingo texture → Task 2; §4 content (descent→sprawl, dual gate, forgiveness curve, carryover) → Task 4; §5 pipeline switch → Task 5; §6 auto-proof (solvable-with, not-without charge @4/5, not-without glide @3/5, Flamingo reachable, carryover) → Task 6; §7 "glide out the window" (PowerUnlockScene already wired; prompt reuse) → Task 4 authoring + Task 7 smoke; §2 gating (order-based, unchanged) → confirmed via `FULL = abilitiesForArea("backyard")` (Task 6). All covered.
- **Placeholder scan:** every code step shows complete code; the only intentionally-iterative step is Task 4 (hand-authored content), which ships verified seed literals for the deterministic gates (slot-1 window, slot-4 charge from `chargeDemoLevel`) + the combo finale, geometry targets, carryover placement, and a convergence loop against Task 6's proof — the honest structure for lint-tuned content (matches the Hallway/Kitchen/Family-Room builds). The glide gaps (slots 3 & 5) are explicitly marked "tune against the proof," referencing the verified `glideDemoLevel` proportion.
- **Type consistency:** `SketchBreakable {x,y,w,h}` defined (Task 1 step 3), preserved in `combineSlot` (step 4), emitted by the encoder (step 5b), and validated by the pre-existing `BreakableSchema`; `LevelOption.breakables?` matches the `slotWith({ breakables })` test usage; `encodeSlotToLevelData(slot, order, idPrefix, primaryEnemy, companionType)` signature matches every call; runtime enemy `type` values (`"ant"`, `"spider"`, `"dustBunny"`, `"dustMite"`) match the `EnemySpawn` Zod enum; `abilitiesForArea("backyard")` = `{doubleJump, dash, wallClimb, charge, glide}` (Flamingo `metAtStart` adds glide; confirmed against `gating.ts`); level ids `backyard-1`…`backyard-5` match `${idPrefix}-${slot.id}` with `idPrefix="backyard"`; catalog `areaId:"backyard"` matches the renamed `AreaId`.
