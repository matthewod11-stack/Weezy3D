# Hallway Area (World 2) — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm), pending implementation plan
**Scope:** Phase 7.1, first sub-project — **Hallway only**. Kitchen, Family Room, Living Room, and the Dollhouse boss are each their own later spec.
**Spec lineage:** Builds on the completed power system (`docs/superpowers/specs/2026-05-30-power-system-design.md`, P0–P5). Hallway is the first area to consume the metroidvania gating infrastructure end-to-end.

---

## 1. Goal & Success Criteria

A 5-level Hallway area at **full Bedroom parity**, authored entirely through the
`src/design/levelSketches.ts → encodeFromSketch` pipeline, where **double-jump is
load-bearing** (the area is provably uncompletable without it) and the player earns
**Dog → dash** at the finale.

**Done when:**

- [ ] 15 variants authored (5 slots × A/B/C), chained `B→A→A→C` like Bedroom.
- [ ] `src/levels/hallwayLevels.ts` is sketch-driven (`encodeAreaLevels(HALLWAY_AREA, SEGMENT_ORDER)`), replacing the hand-authored "First Leap" placeholder.
- [ ] Spiders render and behave (stomp-patroller) in-game.
- [ ] Dog is collected at the finale, granting dash + firing `PowerUnlockScene` (already-wired).
- [ ] Reachability lint proves levels 4–5 solvable **with** double-jump and **not without** (`exit-unreachable`).
- [ ] `npm run build` green (tsc + Vitest + reachability lint + texture smoke + vite).
- [ ] `/maps.html` shows Hallway 15/15 drafted.

---

## 2. Gating Model

The gating is **offset by one area**: each area is gated on the *previous* companion's
power and contains the *next* companion. For Hallway:

- The player **arrives holding double-jump** (Teddy, earned at the Bedroom finale). So
  "gated on double-jump" does **not** mean a locked door waiting for a power — it means
  Hallway is the area that **teaches and makes double-jump load-bearing**.
- Hallway contains **Dog**, who grants **dash** — the power that gates the *next* area
  (Kitchen). Dash is not used within Hallway.

`abilitiesForArea("hallway")` = `{doubleJump}`; `gatingPower("hallway")` = `doubleJump`.
The runtime grant (`GameState.collectCompanion`) and the `PowerUnlockScene` dash-reveal
are **already wired** — collecting Dog fires both automatically. No new progression
wiring is required.

### 2.1 The unavoidable-companion invariant (design-enforced, not lint-enforced)

The reachability lint checks Dog is *comfortably reachable* (`companion-stranded`) but
**not** that Dog is *unavoidable*. A reachable-but-skippable Dog would soft-lock Kitchen
(which needs dash). Therefore — exactly as Bedroom does with Teddy — **Dog sits on the
final approach to the exit**, on the floor at the player's body height so the path to the
exit zone passes through the pickup.

> **Future work (out of scope):** a `companion-skippable` lint check that proves the
> companion lies on every spawn→exit path. Until then this is a placement discipline.

---

## 3. Reusable Infrastructure (Phase 0)

None of this is double-jump-specific. The encoder was only ever run on Bedroom and left
two `// expand per area later` TODOs. Generalizing them is a prerequisite for **any**
non-Bedroom area, so it lands once here and Kitchen / Family Room / Living Room reuse it.

### 3.1 Enemy type — Zod schema

`src/types/level.ts` currently locks enemy `type` to `z.literal("dustBunny")`. Widen to:

```ts
type: z.enum(["dustBunny", "spider", "ant", "dustMite"])
```

(All four for forward-compat with later areas; only `spider` is exercised by Hallway.)

### 3.2 Encoder generalization

`src/levels/encodeFromSketch.ts` hardcodes `type: "dustBunny"` (enemies) and
`type: "teddy"` (companion). Replace both with area-derived values:

- **Enemy:** derive from `area.primaryEnemy`. Map the design enum to the runtime string
  (`dust_bunny → "dustBunny"`, `spider → "spider"`, etc.). `encodeSlotToLevelData` needs
  access to the area's `primaryEnemy` (thread it through, or pass the area).
- **Companion:** derive from `area.companion`; `COMPANIONS[area.companion]` already
  carries `idleKey` / `walkKey` / `heartBonus`.

Patrol-bounds derivation (`derivePatrolBounds`) is already enemy-agnostic — no change.

### 3.3 Decision: spiders-only for v1

Hallway v1 uses **only spiders** (the area's `primaryEnemy`). Carryover dust bunnies are
deferred (they would require an optional per-zone `enemyType?` discriminator on the sketch
`enemy` zone). The encoder maps every `kind:"enemy"` zone to `area.primaryEnemy`.

---

## 4. Spider Entity (stomp-patroller reskin)

`DustBunny extends Enemy`, and the `Enemy` base already owns all patrol motion. So Spider
is a **sibling of DustBunny**, not a new hierarchy.

- **New `src/entities/Spider.ts`** extending `Enemy`, mirroring `DustBunny`: spider
  idle/walk textures (`SPIDER_IDLE` / `SPIDER_WALK`, already loaded in `BootScene`), body
  size, and pose-swap on velocity (walk when moving, idle when still, face direction of
  travel). No new behavior — patrol is inherited.
- **`GameScene`:**
  - Widen `private enemies: DustBunny[]` → `Enemy[]`.
  - Add `else if (spawn.type === "spider") { const s = new Spider(this, spawn); … }`
    with the **same** collider (`platformGroup`) + overlap (`player → handleEnemyOverlap`)
    wiring as the dust-bunny branch.
  - Widen the stomp check from `enemy instanceof DustBunny` → `enemy instanceof Enemy`
    (or a shared stompable type). DustBunny and Spider both qualify.

**Assets:** `SPIDER_IDLE/WALK/ATTACK` and `DOG_IDLE/WALK` textures already exist and load
in `BootScene` — **no art work**.

**Deferred:** `SPIDER_ATTACK` "drops from a corner" behavior (the area-intent flavor);
Dog walk-animation (non-Teddy companions render static-idle today — `GameScene` passes
`walkAnim = type === "teddy" ? TEDDY_WALK_ANIM : null`; acceptable for v1).

---

## 5. Content — 5 Slots × A/B/C, Escalating Double-Jump Gate

Keeps the stub skeleton in `levelSketches.ts` (`HALLWAY_AREA.slots`), authored on
`/maps.html`. Each slot chains `B→A→A→C` into one level. The double-jump gate escalates
across the area: optional reward → skill route → **mandatory**.

| Slot | Beat | Double-jump gate | Lethal? |
|------|------|------------------|---------|
| 1 | Tutorial / re-establish the hallway | Token shelf on a high ledge, double-jump-only. Base path trivial. | No (optional) |
| 2 | First spider | Safe stomp/token perch reached by double-jump above a patrolling spider. | No (optional) |
| 3 | Branching | **High route** (more tokens) gated behind double-jump; **low route** always base-jumpable. | No (optional) |
| 4 | Trust Gap | **First mandatory** double-jump — gap over a pit wider than base flat-reach, within double-reach. | **Yes** (respawn) |
| 5 | Find Dog (finale) | **Mandatory** double-jump on the critical path to Dog + exit; Dog on the final approach. | Yes |

Slots 4–5 are where the "not without double-jump" proof **bites**. Slots 1–3 stay
completable on base jump — their gates guard *optional content*, consistent with Bedroom's
"no death-pits until slot 4" forgiveness philosophy for ages 4–8.

### 5.1 Geometry targets (the lint is the source of truth, not these numbers)

Derived from `src/config/physics.ts` (same envelope the lint uses):

- Base flat-jump reach ≈ **121 px** (~3.8 grid) · double-jump flat reach ≈ **212 px** (~6.6 grid)
- Base apex ≈ **81 px** (~2.5 grid) · double-jump apex ≈ **161 px** (~5 grid)

So:

- **Height gate (double-jump-only):** ledge at `y ≈ 3–4` grid — above base apex, within double apex.
- **Pit gate (mandatory, lethal):** pit ~`4–5` grid wide — gap exceeds base flat reach, within double reach.

Author to these, then let `npm run build`'s reachability lint validate exact solvability;
tune widths until levels 4–5 pass *with* double-jump and fail *without*.

---

## 6. Pipeline Switch

`src/levels/hallwayLevels.ts`: replace the hand-authored single "First Leap" `LevelData`
literal with the one-liner mirror of `bedroomLevels.ts`:

```ts
const SEGMENT_ORDER = ["B", "A", "A", "C"];
export const HALLWAY_LEVELS = encodeAreaLevels(HALLWAY_AREA, SEGMENT_ORDER);
```

The "First Leap" double-jump-gate concept (a gap beyond base reach, within double reach)
is absorbed into authored slot 4/5. `src/levels/levelCatalog.ts` already concatenates
`HALLWAY_ENTRIES` after `BEDROOM_ENTRIES`, and `/maps.html` reads `ALL_AREAS` — so
progression and the design surface update automatically once variants are authored.

---

## 7. Reachability Auto-Proof

A new `src/levels/hallway.integration.test.ts`, mirroring the power-demo integration
tests, asserting the metroidvania guarantee as a fact:

- Each Hallway level is solvable **with** `abilitiesForArea("hallway")` = `{doubleJump}`.
- Levels **4 and 5** are **not** solvable with an empty ability set — the lint returns
  `exit-unreachable` (proving double-jump is load-bearing, not decorative).
- Dog is comfortably reachable in slot 5 (no `companion-stranded`).

The build-time reachability lint (`reachability.ts`, already ability-aware via
`abilitiesForArea`) covers per-level solvability on every `npm run build`; this test pins
the *not-without* direction that the lint alone doesn't assert.

---

## 8. Out of Scope (each its own later spec / pass)

- **Kitchen / Family Room / Living Room** — each adds one traversal-gate sketch element
  (`requires:"dash"` edge, `climbWall` zone, `breakable` barricade) + encoder support.
- **Dollhouse** — T-Rex boss arena (single set-piece, not 5-slot structure).
- **Carryover dust bunnies** in Hallway — needs an optional per-zone `enemyType?`.
- **Rich spider behavior** (`SPIDER_ATTACK` descend/attack from corners).
- **Dog walk-animation** — non-Teddy companions render static-idle today.
- **Illustrated Hallway backgrounds** — blueprint mode holds until gameplay is locked
  ("per-section illustrated backgrounds return per area once gameplay is locked").
- **`companion-skippable` lint check** — the unavoidable-companion invariant stays a
  placement discipline for now.

---

## 9. Build Phases (for the implementation plan)

Each phase is build-green before the next, following the established power-system
discipline (edit → targeted Vitest → commit).

- **P0 — Reusable infra.** Enemy schema enum (§3.1); encoder generalization (§3.2);
  `Spider` entity + GameScene wiring (§4). Verify Bedroom + the existing single Hallway
  level still pass before authoring new content.
- **P1 — Author content.** 15 variants on `/maps.html` with the escalation (§5). Iterate
  geometry against the reachability lint.
- **P2 — Pipeline switch.** `hallwayLevels.ts` → sketch-driven (§6). Confirm catalog +
  maps page pick up all 5 levels.
- **P3 — Auto-proof.** `hallway.integration.test.ts` (§7). Final `npm run build` green.

---

## Appendix — Key files

| File | Role in this spec |
|------|-------------------|
| `src/design/levelSketches.ts` | `HALLWAY_AREA` slots authored here (§5) |
| `src/levels/encodeFromSketch.ts` | Generalize enemy/companion type (§3.2) |
| `src/types/level.ts` | Widen enemy-type enum (§3.1) |
| `src/entities/Spider.ts` | **New** — sibling of `DustBunny` (§4) |
| `src/scenes/GameScene.ts` | Spider instantiation + stomp-check widening (§4) |
| `src/levels/hallwayLevels.ts` | Sketch-driven switch (§6) |
| `src/levels/hallway.integration.test.ts` | **New** — auto-proof (§7) |
| `src/config/{areas,companions,abilities,gating}.ts` | Read-only — gating data already correct |
