# Kitchen Area (World 3) — Design

**Date:** 2026-06-03
**Status:** Approved (brainstorm), pending implementation plan
**Scope:** Phase 7.1, second sub-project — **Kitchen only**. Family Room, Living Room, and the Dollhouse boss are each their own later spec.
**Spec lineage:** Builds on the completed power system (`docs/superpowers/specs/2026-05-30-power-system-design.md`, P0–P5) and follows the **Hallway** area template (`docs/superpowers/specs/2026-06-02-hallway-area-design.md`). Kitchen is the first area to make **two** powers load-bearing and the first to **evolve the gating model** (companion met early, power used in-area).

---

## 1. Goal & Success Criteria

A 5-level Kitchen area at **full Bedroom/Hallway parity**, authored through the
`src/design/levelSketches.ts → encodeFromSketch` pipeline, structured as a **vertical
journey** — floor → ascend to the counters → leap counter-to-counter → dash over the
hot stove. The area makes **two** powers load-bearing:

- **Wall-climb** (the ascent) — earned in-area from **Cat, met early**, and the only way
  up the tall counters.
- **Dash** (the horizontal leaps + stove) — the Hallway reward (Dog), made load-bearing
  here, exactly as the Hallway spec foretold ("Kitchen adds the `requires:"dash"` edge").

**Done when:**

- [ ] 15 variants authored (5 slots × A/B/C), chained `B→A→A→C` like Bedroom/Hallway.
- [ ] `src/levels/kitchenLevels.ts` is sketch-driven (`encodeAreaLevels(KITCHEN_AREA, SEGMENT_ORDER)`), replacing the `stubSlots` placeholder.
- [ ] Ants render and behave (stomp-patroller) in-game; ant-trail placement on the floor.
- [ ] Cat is met **early** (slot 1), grants wall-climb on pickup, fires `PowerUnlockScene` (already-wired), and is **unavoidable** (the first tall counter is climb-only and gates the slot-1 exit).
- [ ] Two new sketch-vocab elements author-able: `requires:"dash"` platform tag **and** `climbWalls`.
- [ ] Reachability lint proves the ascent levels solvable **with** wall-climb and **not without**, and slots 4–5 solvable **with** dash and **not without**.
- [ ] `npm run build` green (tsc + Vitest + reachability lint + texture smoke + vite).
- [ ] `/maps.html` shows Kitchen 15/15 drafted.

---

## 2. Gating Model — the localized evolution

The shipped model is **offset**: a companion is met at an area's **finale**, and its power
is used in the **next** area (`abilitiesForArea` loops over *strictly previous* areas;
`gating.ts`). Bedroom→Teddy→double-jump-in-Hallway; Hallway→Dog→dash-in-Kitchen.

Kitchen **evolves** this for Cat: Cat is met **early** and wall-climb is used **in the
Kitchen**. This is the more standard metroidvania feel (meet friend → learn power → use it
now) and it lets climbing — not double-jump — be the verb for "get up onto a counter,"
which is more intuitive for ages 4–8 ("point ↑").

### 2.1 What changes (contained)

- **`CompanionDef` gains `metAtStart?: boolean`** (`src/config/companions.ts`). `cat`
  sets `metAtStart: true`. Teddy/Dog/Horse/Flamingo omit it → unchanged (offset preserved).
- **`abilitiesForArea(area)`** (`src/config/gating.ts`): after the existing previous-areas
  loop, add the area's **own** companion's grant **iff** `metAtStart`:

  ```ts
  const own = companionForArea(area);
  if (own && COMPANIONS[own].metAtStart) set.add(COMPANIONS[own].grants);
  ```

  So `abilitiesForArea("kitchen")` = `{doubleJump, dash, wallClimb}`.

### 2.2 What does NOT change

- **Bedroom and Hallway are untouched** — Teddy and Dog stay finale companions; their
  powers are still used in the next area. The evolution applies only where `metAtStart` is set.
- **`gatingPower` chain is preserved.** `gatingPower("kitchen")` = previous area (Hallway)
  companion (Dog) grant = **dash** — Kitchen is still entered holding dash. `gatingPower("familyRoom")`
  = Kitchen companion (Cat) grant = **wall-climb** — the player still arrives in the Family
  Room holding climbing (now learned earlier, in the Kitchen). No re-wiring.
- **`abilitiesForArea("familyRoom")`** already included wall-climb (Cat's home, kitchen, is
  a strictly-previous area). Adding Cat to the *kitchen's* own set does not double-count
  anything downstream.

### 2.3 The unavoidable-companion invariant (design-enforced)

Because the **first tall counter is climb-only** (taller than the double-jump apex) and
gates the **slot-1 exit**, the player *cannot finish slot 1 without meeting Cat* (Cat sits
at the counter's base). The gate enforces the pickup — stronger than Hallway's "Dog on the
final approach" placement discipline, which the lint can't assert.

> **Authoring discipline (lint can't see it):** `abilitiesForArea("kitchen")` reports
> wall-climb for the *whole* area, including the floor stretch of slot 1 *before* Cat. The
> lint therefore can't prove "Cat is met before the first climb" — so author slot 1's flow
> as floor (meet ants) → **meet Cat** → first climb. Same class of discipline as the
> `companion-skippable` gap noted for Hallway. A future `companion-ordering` lint is out of scope.

---

## 3. Reusable Infrastructure (Phase 0)

The encoder was already generalized for Hallway (enemy/companion derive from the area). The
new infra here is the **Ant entity**, **two new sketch elements**, and the **`metAtStart`
gating change** (§2.1). All of it is reused by later areas.

### 3.1 Ant entity (stomp-patroller reskin)

Exactly the Spider pattern. `Ant extends Enemy`, a **sibling of `DustBunny`/`Spider`**; the
`Enemy` base owns all patrol motion — no new behavior.

- **New `src/entities/Ant.ts`** mirroring `Spider.ts`: ant idle/walk textures (already
  generated + loaded in `BootScene` from the storybook art session), body size, pose-swap
  on velocity, face direction of travel.
- **`GameScene`:** add `else if (spawn.type === "ant") { … }` with the **same** collider
  (`platformGroup`) + overlap (`player → handleEnemyOverlap`) wiring as the dust-bunny /
  spider branches. The stomp check is already `instanceof Enemy` — Ant qualifies free.
- **Add the explicit `else` guard** for unhandled enemy types (the debt flagged in
  `PROGRESS.md` after Hallway: an unhandled `dustMite` would silently `continue` and vanish).
  Throw or `console.warn` so the gap is loud, not silent.
- **Ant-trail flavor** = placement only: several ants in a marching line on the floor.
  No new code.

### 3.2 Two new sketch-vocab elements (the authoring gap)

Both the **dash edge** and the **climb edge** already exist end-to-end in the engine
(`reachability.ts` edges + `LevelData` fields + `GameScene` rendering + hand-authored
`dashDemoLevel.ts` / `wallClimbDemoLevel.ts`). Neither is yet **author-able from a sketch**
(`encodeFromSketch.ts` has zero references to `requires` or `climbWalls`). This is pure
authoring/plumbing — **no new game logic**.

- **`requires?: "dash"` on the sketch platform type** → passthrough to the encoded
  platform's `requires` field. Tags a wide flat/downhill gap as a dash crossing.
- **`climbWalls` on the sketch** (mirroring the `pits`/`zones` arrays) → passthrough to
  the encoded `climbWalls` field. A `climbWall` is a vertical wall (a counter face) connecting
  a low surface (floor) to a high surface (counter top).
- Both translate sketch grid coords → game coords like every other element (the encoder's
  existing grid→game-coord scaling).

### 3.3 Texture-key registration

Register **ant** (+ **cat** companion) in `ENTITY_TEXTURE_KEYS`. The texture smoke test
fails the build if missed (it caught spider/dog in Hallway).

### 3.4 Decision: ants-only for v1 (carryover deferred)

`KITCHEN_AREA.carryOverEnemies = ["dust_bunny", "spider"]` exists as data but is **not yet
consumed** — the encoder maps every `kind:"enemy"` zone to `area.primaryEnemy`. Kitchen v1
is **ants-only**, exactly as Hallway shipped spiders-only. Carryover stays deferred (needs
an optional per-zone `enemyType?` discriminator on the sketch `enemy` zone).

---

## 4. Content — 5 Slots × A/B/C, the Vertical Journey

Keeps the stub skeleton in `levelSketches.ts` (`KITCHEN_AREA.slots`), authored on
`/maps.html`. Each slot chains `B→A→A→C` into one level. The two gates escalate across the
area: climbing is mandatory from slot 1 (the ascent); dash is optional in 1–3, **mandatory**
in 4–5.

| Slot | Beat | Ascent (climb — load-bearing) | Horizontal (dash) | Lethal? |
|------|------|-------------------------------|-------------------|---------|
| **1** | Meet the Ants → **meet Cat** | Floor (ant trail) → **meet Cat** at the base of the first counter → climb-only exit (gentle, short counter just above double-jump apex). | Optional spill-dash for a token | No |
| **2** | The Ascent | Taller counters; climbing is the only way up. | Optional floor-spill dash (bonus tokens) | No |
| **3** | Counter Tops | Climb + traverse the counter level. | Optional downhill dash to a side shelf | No (last safe level) |
| **4** | Counter Leap | (on the counters) | **MANDATORY dash** over the **sink** — counter-to-counter, gap > double-jump reach. Fall in = splash respawn. | **Yes** (soft) |
| **5** | Stove Climax | **CLIMB** the final wall up to the exit shelf. | **MANDATORY dash** over the **hot stove**. | Yes |

- **Climbing owns the vertical, dash owns the horizontal** — the two powers are split by
  axis, which teaches the difference between them through geometry alone. Counters are tall
  (taller than a small child can jump), so "climbing is mandatory" is self-justifying.
- **Cat in slot 1**, unavoidable via the climb-only exit (§2.3).
- **Combo finale (slot 5):** dash over the stove **then** climb to the exit shelf — the
  first time the Kitchen's two signature powers chain on the critical path.
- **Double-jump** keeps its medium-hop utility but is **not** load-bearing here (it was, in
  Hallway). Kitchen is the first "you have a real toolkit" area.
- **Forgiveness curve holds:** no lethal hazard until slot 4; the first lethal (sink) is a
  *soft* themed hazard (water splash); the scarier stove is the finale. Falling off a counter
  while climbing is non-lethal (land on the floor, climb again).

### 4.1 Hazards = themed pits (mechanically); art deferred

Sink (slot 4) and stove (slot 5) are **pits with a kill plane** using the existing
respawn system — the same mechanism as Hallway's lethal gaps. The "water splash" / "hot"
theming is captured here for when illustrated backgrounds return (blueprint mode holds until
gameplay locks). No new hazard code.

### 4.2 Geometry targets (the lint is the source of truth, not these numbers)

Derived from `src/config/physics.ts` (same envelope the lint uses):

- Base flat reach ≈ **121 px** · double-jump flat reach ≈ **212 px** · dash lunge ≈ **320 px**
- Base apex ≈ **81 px** · double-jump apex ≈ **161 px**

So:

- **Climb-only counter (load-bearing):** counter top **> 161 px** above the launch floor
  (above double-jump apex), reached by a `climbWall` on its face. Start short in slot 1
  (~170–200 px), taller later.
- **Mandatory dash gap (slots 4–5):** **> 212 px** (double-jump can't clear) and within the
  dash lunge — target **~240–290 px**, **flat or downhill** (the dash edge gains no altitude:
  `reachability.ts` grants it only when the target is equal-or-lower height).
- **Optional dash gap (slots 1–3):** similar widths guarding *optional* tokens; the base
  path is always completable without the dash gap.

Author to these, then let `npm run build`'s reachability lint validate exact solvability;
tune until the proofs in §6 hold.

---

## 5. Pipeline Switch

`src/levels/kitchenLevels.ts`: replace the `stubSlots` placeholder with the one-liner mirror
of `bedroomLevels.ts` / `hallwayLevels.ts`:

```ts
const SEGMENT_ORDER = ["B", "A", "A", "C"];
export const KITCHEN_LEVELS = encodeAreaLevels(KITCHEN_AREA, SEGMENT_ORDER);
```

Confirm `KITCHEN_ENTRIES` is concatenated into `src/levels/levelCatalog.ts` after
`HALLWAY_ENTRIES` (add it if not). `/maps.html` reads `ALL_AREAS` — the design surface
updates automatically once variants are authored.

---

## 6. Reachability Auto-Proof

A new `src/levels/kitchen.integration.test.ts`, mirroring `hallway.integration.test.ts`,
asserting the **two-gate** metroidvania guarantee as fact:

- Every Kitchen level solvable **with** `abilitiesForArea("kitchen")` = `{doubleJump, dash, wallClimb}`.
- **Climb load-bearing:** the ascent levels (≥1 of slots 1–3) are **not** solvable without
  `wallClimb` — the climb-only counters return `exit-unreachable`.
- **Dash load-bearing:** slots **4 and 5** are **not** solvable without `dash` (`exit-unreachable`).
- **Combo (slot 5):** not solvable with `{wallClimb}` minus dash (the stove blocks) **and**
  not solvable with `{dash}` minus wall-climb (the final exit climb blocks) → both required.
- **Cat** comfortably reachable in slot 1 (no `companion-stranded`).

The build-time lint (`reachability.ts`, ability-aware via `abilitiesForArea`) covers per-level
solvability on every `npm run build`; this test pins the *not-without* directions the lint
alone doesn't assert.

---

## 7. The "Meet Cat" Moment & Future Cutscene Tech

**This area:** reuse existing tech. `PowerUnlockScene` (the breakaway reveal) already fires
automatically on companion pickup (`GameScene.ts:103`) — it shows for Cat exactly as it does
for Dog's dash. Add a small in-level tutorial prompt at the first counter (**"Press ↑ to
climb!"**). Near-zero new tech; ships with the area.

**Future (tracked, out of scope here):** a proper **scripted cutscene system** to introduce
**each** power (companion appears, demonstrates the mechanic, camera beat). The user wants
this built out for every power. No GitHub remote exists on this repo, so it is tracked as a
dedicated **ROADMAP.md future-work item** (convert to a GitHub issue if/when a remote is
added). It overlaps with the roadmapped **7.4 intro / 7.5 ending** scripted-sequence engine
and should likely share it. Its own spec when scheduled.

---

## 8. Out of Scope (each its own later spec / pass)

- **Family Room / Living Room** — each adds one traversal-gate sketch element
  (`climbWall` *mastery*, `breakable` barricade) + content.
- **Dollhouse** — T-Rex boss arena (single set-piece).
- **Scripted cutscene tech** (§7) — tracked in ROADMAP.md.
- **Carryover enemies** (dust bunny / spider) in Kitchen — needs an optional per-zone `enemyType?`.
- **Rich ant behavior** (climbing counters, carrying crumbs) — reskin patrol only for v1.
- **Cat walk-animation** — non-Teddy companions render static-idle today.
- **Illustrated Kitchen backgrounds** + sink/stove hazard **art** — blueprint mode holds
  until gameplay is locked.
- **`companion-ordering` lint** (prove Cat is met before the first climb) — placement
  discipline for now (§2.3).

---

## 9. Build Phases (for the implementation plan)

Each phase is build-green before the next, following the established discipline
(edit → targeted Vitest → commit).

- **P0 — Infra.** `Ant` entity + GameScene branch + explicit `else` guard (§3.1); the two
  sketch elements `requires:"dash"` + `climbWalls` + encoder passthrough (§3.2); `metAtStart`
  + `abilitiesForArea` change (§2.1); texture-key registration (§3.3). Verify Bedroom +
  Hallway still pass.
- **P1 — Author content.** 15 variants on `/maps.html` realizing the vertical journey (§4).
  Iterate geometry against the reachability lint until the §6 proofs hold.
- **P2 — Pipeline switch.** `kitchenLevels.ts` → sketch-driven (§5). Confirm catalog + maps
  page pick up all 5 Kitchen levels.
- **P3 — Auto-proof.** `kitchen.integration.test.ts` (§6). Add the "Press ↑ to climb!" prompt
  (§7). Final `npm run build` green.

---

## Appendix — Key files

| File | Role in this spec |
|------|-------------------|
| `src/design/levelSketches.ts` | `KITCHEN_AREA` slots authored here (§4); intent text already good |
| `src/levels/encodeFromSketch.ts` | Add `requires` + `climbWalls` passthrough (§3.2) |
| `src/config/companions.ts` | Add `metAtStart` to `CompanionDef`; `cat.metAtStart = true` (§2.1) |
| `src/config/gating.ts` | `abilitiesForArea` includes own companion when `metAtStart` (§2.1) |
| `src/entities/Ant.ts` | **New** — sibling of `Spider`/`DustBunny` (§3.1) |
| `src/scenes/GameScene.ts` | Ant branch + explicit `else` guard; PowerUnlockScene already wired (§3.1, §7) |
| `src/levels/kitchenLevels.ts` | Sketch-driven switch (§5) |
| `src/levels/kitchen.integration.test.ts` | **New** — two-gate auto-proof (§6) |
| `src/config/textures.ts` | Ant/Cat keys in `ENTITY_TEXTURE_KEYS` (§3.3) |
| `ROADMAP.md` | Scripted-cutscene future-work item (§7) |
