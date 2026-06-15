# Backyard Area (World 5) — Design

**Date:** 2026-06-03
**Status:** Approved (brainstorm), pending implementation plan
**Scope:** Phase 7.1, fourth sub-project — **Backyard only** (renames the scaffolded "Living Room"). The Dollhouse boss is its own later spec.
**Spec lineage:** Builds on the completed power system (`docs/superpowers/specs/2026-05-30-power-system-design.md`, P0–P5) and the glide power-button work (`2026-05-31-glide-power-button-design.md`). Follows the **Hallway** / **Kitchen** / **Family Room** area templates. Backyard is the **only outdoor area**, the **pre-boss graduation**, and the first area to make **glide load-bearing in-level** — reusing the carryover system the Family Room shipped and adding just two small authoring plumbing mirrors.

---

## 1. Goal & Success Criteria

A 5-level **Backyard** at full Bedroom/Hallway/Kitchen/Family-Room parity, authored through the
`src/design/levelSketches.ts → encodeFromSketch` pipeline. Identity: **the world opens up.** Eloise
meets **Flamingo** at a back windowsill, earns **glide**, and *sails out the window down into the
yard* — the interior→exterior transition told by the geometry itself. From there a **descending
entrance** gives way to a horizontal **sprawl**: the only outdoor area, maximal visual contrast
before the intimate playhouse finale, and the graduation that recaps every enemy and exercises both
late-game powers. Theme: *grass, sky, a garden path, flower beds, a kiddie pool, a treehouse, and a
playhouse door.*

- **Entry gate:** **charge**, carried in from the Family Room (Horse). The headline hard gate —
  smash through hedge rows / a fence panel / a woodpile.
- **In-area power (NEW role):** **glide**, earned at the windowsill on the **`metAtStart`** model
  (like Cat/wall-climb in the Kitchen). Glide is usable from slot 1 and becomes **load-bearing**
  inside this area — the first time glide gates a real level, not just the Testing Ground.
- **Reward:** the same **Flamingo → glide**, which also gates the **next** area (Dollhouse). So
  glide is both an in-area showcase *and* the World-6 gating power — consistent with the order-based
  chain.
- **Primary enemy:** **ant** (outdoor-native ground critter; a one-line change from the scaffold's
  `dust_bunny`), with **carryover** bringing back spiders, dust bunnies, and dust mites — the
  "recap all four" graduation, driven by the per-zone `enemyType` override the Family Room shipped.

**Done when:**

- [ ] `livingRoom` AreaId renamed to `backyard` across config + tests; `LIVING_ROOM_AREA` →
      `BACKYARD_AREA`; `worldKey` `World5_LivingRoom` → `World5_Backyard`.
- [ ] **Flamingo gets `metAtStart: true`** → `abilitiesForArea("backyard")` =
      `{doubleJump, dash, wallClimb, charge, glide}` (full toolkit).
- [ ] `breakable` is **sketch-author-able** (new sketch type + `combineSlot` passthrough + encoder
      emission), mirroring `climbWalls`.
- [ ] **Elevatable spawn:** the encoder honors `combined.spawn.y` (one-line mirror of the
      elevatable exit), so the windowsill can sit high.
- [ ] 15 variants authored (5 slots × A/B/C), chained `B→A→A→C`.
- [ ] `src/levels/backyardLevels.ts` is sketch-driven (`encodeAreaLevels(BACKYARD_AREA, SEGMENT_ORDER)`),
      replacing the `stubSlots` placeholder; catalog now **25**.
- [ ] **Charge load-bearing:** ≥1 level (slots 4 & 5) unsolvable without charge (a breakable
      barricades the only seam).
- [ ] **Glide load-bearing:** slot 3 (the kiddie-pool gap) and slot 5 (the treehouse leap)
      unsolvable without glide.
- [ ] **Flamingo** met in slot 1 (unavoidable) and grants glide on pickup (`PowerUnlockScene`).
- [ ] `npm run build` green (tsc + Vitest + reachability lint over 25 levels + texture smoke + vite).
- [ ] `/maps.html` shows Backyard 15/15 drafted.
- [ ] Dollhouse re-themed to an **outdoor playhouse** (name/intent only; boss build is its own spec).

---

## 2. Gating Model — charge gate + `metAtStart` glide

The order-based chain in `gating.ts` already produces the right answers after the rename — no
re-wiring of the gating *logic*, only the AreaId string:

- `gatingPower("backyard")` = previous-area (Family Room) companion (Horse) grant = **charge**. The
  player arrives holding charge.
- `abilitiesForArea("backyard")` = grants of all strictly-previous companions
  `{doubleJump, dash, wallClimb, charge}` **plus** glide, because **Flamingo is flagged
  `metAtStart`** (its grant is added for its own home area). Full toolkit while playing the Backyard.
- `gatingPower("dollhouse")` = Backyard companion (Flamingo) grant = **glide**. Glide stays the
  next-area gate too — an in-area showcase that is *also* the boss's entry power. Both hold
  simultaneously; nothing about `metAtStart` changes the next-area gate.

This is the **second** use of the `metAtStart` evolution (Cat was the first). It is the natural fit:
the companion you meet *here* teaches a power you use *here*. Contained and opt-in — the default
offset companions (Teddy/Dog/Horse) are untouched.

### 2.1 The unavoidable-companion invariant (design-enforced)

Flamingo sits at the **windowsill**, on the only path off the high spawn (slot 1). The player cannot
descend into the yard without passing the windowsill — so Flamingo is met, and glide earned, before
any glide is needed. The lint asserts the slot-1 exit is reachable, which transitively forces the
windowsill pickup (the same technique the Kitchen used to make Cat unavoidable).

### 2.2 The window entrance is *forgiving*; the first mandatory glide is the pool

To protect the youngest players (the project's forgiveness curve: no lethal hazard until ~slot 4),
the **windowsill drop is a gentle glide tutorial** — soft grass below, so a missed glide is
non-lethal; glide just makes the descent graceful. The first **load-bearing** glide is the **slot-3
kiddie-pool gap** (telegraphed, mid-area, after practice). Glide is provably required there and at
the slot-5 treehouse, not at the very first screen.

---

## 3. Infrastructure (Phase 0) — two small plumbing mirrors + the rename

No new entity (all four stomp-patrollers are live), no new gating model, no new runtime LevelData
field (`breakables` already exists and is scaled in `types/level.ts`). The work is two authoring
mirrors and the area rename.

### 3.1 `breakable` sketch vocab (the larger mirror — mirror of `climbWalls`)

`BreakableSchema` and `LevelData.breakables` already exist (`types/level.ts:41,88`) and
`withMeasure` already scales them (`:136`); only the **sketch → combined → encoder** path is
missing. Mirror the `climbWalls` plumbing exactly:

- **`SketchBreakable` type** in `levelSketches.ts` (sibling of `SketchClimbWall`): grid-space
  `{ x: number; y: number; w: number; h: number }` (x,y = lower-left in grid coords, +y up; w,h in
  grid cells). Add `breakables?: SketchBreakable[]` to the variant `Option`.
- **`combineSlot.ts`:** add `breakables: SketchBreakable[]` to `CombinedLevel` (mirror the
  `climbWalls` field at `:36`); collect with the x-cursor offset in the segment loop (mirror
  `:110–111`); include in the returned object (mirror `:156`).
- **`encodeFromSketch.ts`:** map combined breakables to design-space LevelData breakables — mirror
  the `climbWalls` map (`:119`) but convert grid → design-space top-left the way the exit does
  (`:173–174`): `x = b.x * GRID_PX`, `w = b.w * GRID_PX`, `h = b.h * GRID_PX`,
  `y = DESIGN_FLOOR_Y - (b.y + b.h) * GRID_PX`. Emit `...(breakables.length ? { breakables } : {})`
  (mirror `:186`). A barricade authored `{ x, y:0, w:1, h:6 }` becomes a ~floor-rooted 192px wall
  filling the seam — the shape `chargeDemoLevel.ts` hand-writes today.
- **Round-trip test** (`encodeFromSketch.elements.test.ts` sibling): a sketch with a `breakable`
  encodes to a `LevelData.breakables` entry at the expected design coords; a sketch without one emits
  no `breakables` key (so every existing area encodes byte-identically).

### 3.2 Elevatable spawn (the one-line mirror)

`encodeFromSketch.ts:67` hardcodes `spawn.y = DESIGN_FLOOR_Y`, dropping `combined.spawn.y`. Change to
`y: DESIGN_FLOOR_Y - combined.spawn.y * GRID_PX` (mirror the elevatable exit at `:174`). Backward-
compatible: every existing sketch spawns at `y:0` → `DESIGN_FLOOR_Y` unchanged. This lets slot 1's
windowsill spawn high (e.g. `spawn: { x: 1, y: 7 }`).

### 3.3 The Living-Room → Backyard rename (config + cosmetic)

- `src/config/areas.ts` + `areas.test.ts`: `"livingRoom"` → `"backyard"` in `AreaId` and
  `AREA_ORDER` (position unchanged — index 4 — so the gating chain is identical).
- `src/config/companions.ts`: `flamingo.area` `"livingRoom"` → `"backyard"`, **add `metAtStart: true`**.
- `src/config/companions.test.ts` if it asserts the area string.
- `src/design/levelSketches.ts`: `LIVING_ROOM_AREA` → `BACKYARD_AREA`, `name: "Backyard"`,
  `worldKey: "World5_Backyard"`, `primaryEnemy: "ant"`, `carryOverEnemies: ["spider","dust_bunny","dust_mite"]`,
  refreshed `intent`; update `ALL_AREAS`. Re-theme `DOLLHOUSE_AREA` copy to the outdoor playhouse
  (name/intent only).
- `src/main.ts:99`: the comment "charge gate assumes the Living Room loadout" → "Backyard loadout".
- Grep `livingRoom` / `Living Room` / `World5_LivingRoom` after the rename; tsc + the area tests are
  the safety net (no World-5 art exists, so no asset path changes).

### 3.4 No new enemy work

All four stomp-patroller GameScene branches (dustBunny/spider/ant/dustMite) are live, and the
carryover override (`enemyType ?? primaryEnemy`) shipped with the Family Room. A Backyard level
mixing ants + spiders + dust bunnies + dust mites Just Works.

---

## 4. Content — 5 Slots × A/B/C, Descent → Sprawl, Dual-Gate

Replaces the `stubSlots` skeleton in `BACKYARD_AREA.slots`, authored on `/maps.html`. Each slot
chains `B→A→A→C` into one level. The area opens high (window) and descends, then runs horizontal;
**charge** and **glide** escalate independently, both proven load-bearing, forgiveness curve intact.

| Slot | Beat | Charge (smash) | Glide | Enemies (recap via carryover) | Lethal? |
|------|------|----------------|-------|-------------------------------|---------|
| **1 — Out the Window** | windowsill → meet Flamingo → glide down to grass | — | **tutorial** (forgiving drop) | 1–2 **ants** | No |
| **2 — Garden Path** | optional hedge shortcut | optional drop off a low ledge | ants + a returning **spider** | No |
| **3 — Flower Beds & Pool** | optional | **MANDATORY** — launch off a flower bed, glide the kiddie-pool gap | ants + spider + **dust bunny** | No — soft pool (a miss splashes to a safe ledge, retry) |
| **4 — The Fence Line** | **MANDATORY** — smash the fence panel | recurring drops | mixed swarm + **dust mite** flanks a **lethal pit** | **Yes** (soft) |
| **5 — Treehouse → Playhouse** | **MANDATORY** — final hedge wall | **MANDATORY** — glide off the treehouse to the playhouse door | climax mix (all four) | Yes |

- **Two load-bearing gates:** charge at slots 4 & 5 (a breakable barricades the only seam), glide at
  slots 3 & 5 (a gap only the glide arc clears). Slots 1–2 gates are optional (tutorial/shortcut).
- **Combo finale (slot 5):** charge through the last hedge → reach the treehouse → **glide** across
  to the playhouse door (the World-6 exit). Mirrors the Kitchen's dash+climb combo, with charge+glide.
- **Carryover discipline:** introduce one returning type at a time (spider in slot 2, dust bunny in
  slot 3, dust mite in slot 4) so the "recap all four" reads as a gentle graduation, not a spike.
- **Forgiveness curve holds:** windowsill drop non-lethal; first hazard is the soft slot-3 pool;
  first *lethal* pit is slot 4; the climax is slot 5.

### 4.1 Hazards = themed pits + the breakable barricade

The **slot-3 pool gap is a reachability gate, not a kill plane** — without glide the far flower-bed
is unreachable (the lint proof), but a miss is **non-lethal**: Eloise splashes into the shallow
kiddie pool and climbs back to a safe near-side ledge to retry. This is what keeps glide load-bearing
at slot 3 while preserving "first *lethal* hazard = slot 4." The **slot-4 pit and finale gaps** are
**pits with a kill plane** (the existing respawn system — Hallway gaps, Kitchen sink/stove). The
charge barricades are **breakables** (§3.1) filling a doorway seam (`breakableBlocks` removes the
edge until charge clears it). Theming (hedge / fence / woodpile / pool) is captured here for when
illustrated backgrounds return — no new hazard code.

### 4.2 Geometry targets (the lint is the source of truth)

From `src/config/physics.ts` (the same envelope the lint uses):

- Base flat reach ≈ **121 px** · double-jump flat reach ≈ **212 px** · dash lunge ≈ **320 px**
- Base apex ≈ **81 px** · double-jump apex ≈ **161 px**
- Glide descent ≈ **90 px/s** (a parachute clamp): on a fall of height `H`, glide air-time is
  `H/90`, vs the much faster gravity arc — so glide buys air-*time*, which `canReach` converts to
  air-*distance* during the descent.

So:

- **Glide gap (load-bearing, slots 3 & 5):** a **launch platform raised `H` above the landing**
  with a horizontal gap `D` tuned so the base gravity arc **undershoots** `D` but the glide arc
  **clears** it. Two-variable (depends on `H` and `D`) — author from the **launch height first**
  (e.g. flower bed/treehouse ~3–4 grids up), widen `D` past the base arc, confirm the glide arc
  reaches. Template: `glideDemoLevel.ts` + `glide.integration.test.ts` already prove a glide-only gap.
- **Charge barricade (load-bearing, slots 4 & 5):** a `breakable` filling the **only** doorway
  between two surfaces (mirror `chargeDemoLevel.ts`'s 200px seam-filler). `breakableBlocks` makes the
  edge impassable without charge; the alternative route must not exist (subtractive gate).
- **Lethal pit (slot 4):** a gap the player **can** clear with double-jump (so dash/glide stay
  optional there), with a kill plane below.

Author to these, then let `npm run build`'s reachability lint validate exact solvability; tune until
the §6 proofs hold. (Glide both *adds* reach on descents and a breakable *subtracts* an edge — the
lint models both, so it is the arbiter, not these numbers.)

---

## 5. Pipeline Switch

`src/levels/backyardLevels.ts`: replace the `stubSlots` placeholder with the one-liner mirror of the
other areas:

```ts
const SEGMENT_ORDER = ["B", "A", "A", "C"];
export const BACKYARD_LEVELS = encodeAreaLevels(BACKYARD_AREA, SEGMENT_ORDER) as LevelData[];
```

Add `BACKYARD_ENTRIES` to `src/levels/levelCatalog.ts`, concatenated after `FAMILY_ROOM_ENTRIES`
(catalog 20 → **25**). `/maps.html` reads `ALL_AREAS` — the design surface updates automatically once
variants are authored. (If `backyardLevels.ts` doesn't yet exist as a stub, create it mirroring
`familyRoomLevels.ts`.)

---

## 6. Reachability Auto-Proof — `src/levels/backyard.integration.test.ts`

Mirrors `familyRoom.integration.test.ts`, asserting the metroidvania guarantee as fact:

- **Solvable-with:** every Backyard level solvable with `abilitiesForArea("backyard")` =
  `{doubleJump, dash, wallClimb, charge, glide}`.
- **Charge load-bearing:** slots 4 & 5 **not** solvable without `charge` (the breakable barricade
  returns `exit-unreachable` — `breakableBlocks` keeps the edge blocked).
- **Glide load-bearing:** slots 3 & 5 **not** solvable without `glide` (the pool / treehouse gap
  exceeds the base arc — `canReach` undershoots without the `Math.max` glide air-time).
- **Flamingo reachable** in slot 1 (no `companion-stranded`) — and unavoidable (the windowsill is on
  the only path off the high spawn).
- **Carryover sanity:** mixed-enemy Backyard levels still encode + validate (enemies are not lint
  collision blockers; this documents that all four types coexist).
- **Breakable round-trip** (may live in the encoder test, §3.1): a sketch breakable survives to
  `LevelData.breakables`.

The build-time lint (`reachability.ts`, ability-aware via `abilitiesForArea`, glide- and
breakable-aware) covers per-level solvability on every build; this test pins the *not-without*
direction. The **per-area** describe ("≥1 level in a gated area is unsolvable without its gating
power") is satisfied by the charge gate at slots 4–5, so the optional gates in slots 1–2 don't break
the build. (Glide is not the area's *gating* power — charge is — but the test pins glide
load-bearing anyway, since it is the area's headline new in-level mechanic.)

---

## 7. The "Glide Out the Window" Moment

Reuse existing tech for v1. `PowerUnlockScene` (the breakaway reveal) fires automatically on
companion pickup — it shows for Flamingo exactly as for Dog/Cat/Horse. The windowsill reuses the
Kitchen's lightweight in-level prompt pattern: **"Hold [power] to glide!"** at the sill, so the
player knows to hold the power button on the way down. The full **scripted cutscene** of Eloise
sailing out the window — and the per-power intros generally — remains roadmapped at **7.3.5** (this
area is its strongest motivating case; note it in the roadmap entry).

---

## 8. Out of Scope (each its own later spec / pass)

- **Dollhouse boss (World 6)** — its own spec; this spec only re-themes its *copy* to an outdoor
  playhouse so Worlds 5→6 flow outdoors. Glide is its gating power (already wired by the chain).
- **Full glide / window cutscene** — the scripted-sequence engine is roadmapped 7.3.5; v1 uses
  `PowerUnlockScene` + the sill prompt (§7).
- **Illustrated Backyard backgrounds** (grass/sky/treehouse art) — blueprint mode holds until
  gameplay is locked; the spec captures theming for when art returns.
- **New enemy types or richer behavior** — all four stay stomp-patroller reskins; "recap" is variety
  via carryover placement, not new mechanics.
- **Outdoor-specific hazards** (water physics in the pool, wind/updrafts for glide) — the pool is a
  themed kill-plane pit, not a swim mechanic; glide is the existing constant-clamp, no updrafts.
- **Spawn-side companion/prompt art** beyond the existing Flamingo sprites (already on disk).

---

## 9. Build Phases (for the implementation plan)

Each phase build-green before the next (edit → targeted Vitest → commit). Subagent-driven (per-task
implementer + spec-then-quality review), per the established discipline.

- **P0 — Infra + rename.** (a) `breakable` sketch vocab: `SketchBreakable` + `Option.breakables` +
  `combineSlot` passthrough + encoder emission + round-trip test (§3.1). (b) Elevatable spawn one-liner
  (§3.2). (c) Living-Room → Backyard rename + Flamingo `metAtStart` + primary `ant` (§3.3). Verify
  Bedroom/Hallway/Kitchen/Family-Room still encode byte-identically and all tests stay green.
- **P1 — Author content.** 15 variants on `/maps.html` realizing the descent→sprawl, dual-gate
  journey (§4): forgiving window glide-in, escalating charge (optional → mandatory slots 4–5) and
  glide (tutorial → mandatory slots 3 & 5), carryover variety, combo finale. Iterate geometry against
  the lint until the §6 proofs hold.
- **P2 — Pipeline switch.** `backyardLevels.ts` → sketch-driven (§5); concat `BACKYARD_ENTRIES`
  (catalog 25). Confirm `/maps.html` shows Backyard 15/15.
- **P3 — Auto-proof.** `backyard.integration.test.ts` (§6). Final `npm run build` green; runtime
  smoke (dev preview): a Backyard level loads from the menu, the windowsill + Flamingo + "Hold to
  glide!" prompt render, a breakable barricade and a glide gap render, mixed enemy types render, no
  console errors.

---

## Appendix — Key files

| File | Role in this spec |
|------|-------------------|
| `src/design/levelSketches.ts` | `SketchBreakable` + `Option.breakables` (§3.1); `BACKYARD_AREA` rename + slots authored here (§3.3, §4) |
| `src/design/combineSlot.ts` | `breakables` on `CombinedLevel` + x-offset passthrough (§3.1) |
| `src/levels/encodeFromSketch.ts` | Emit `breakables` (grid→design) (§3.1); honor `combined.spawn.y` (§3.2) |
| `src/config/areas.ts` + `areas.test.ts` | `livingRoom` → `backyard` AreaId (§3.3) |
| `src/config/companions.ts` + `companions.test.ts` | Flamingo `area: "backyard"`, **`metAtStart: true`** (§3.3) |
| `src/levels/backyardLevels.ts` | Sketch-driven switch (§5) — create/rename from the Living-Room stub |
| `src/levels/levelCatalog.ts` | Concat `BACKYARD_ENTRIES` (catalog 25) (§5) |
| `src/levels/backyard.integration.test.ts` | **New** — charge + glide gate + Flamingo auto-proof (§6) |
| `src/levels/encodeFromSketch.elements.test.ts` | Breakable round-trip + spawn.y elevation test (§3.1–3.2) |
| `src/main.ts` | Backyard-loadout comment (§3.3) |
| `types/level.ts` | (reference only — `BreakableSchema` already exists, no change) |
