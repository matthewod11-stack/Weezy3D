# Power System — Design Spec

**Date:** 2026-05-30
**Status:** Approved design, ready for implementation plan
**Seam:** #3 from the 2026-05-30 audit (ability ↔ level solvability) — the spine of the whole game.

---

## 1. Goal

Princess Eloise is shrunk inside her house. She journeys through six areas, meeting an animal friend in each who grants her a **new traversal power**, on the way to becoming big again (a boss fight with the T-Rex). The core loop:

> **You can't complete an area without the power — but that's okay, because you get the power.**

This is light metroidvania ability-gating tuned for ages 4–8. The design makes that promise **mechanically enforced**, not just intended: a build-time check proves every area is completable *with* its expected powers and genuinely *requires* the power it gates on.

### Locked design decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Power timing** | End of area → gates the **next** area | Matches existing structure (companion already placed in each area's last level). Bedroom is a power-free tutorial. |
| **"Getting big"** | **Story only** — powers are distinct animal abilities | Clearest for young kids; each power feels like a different friend. She becomes big in the ending after the T-Rex. |
| **Controls** | **One context-sensitive power button** (+ double-jump on the jump button) | No per-power buttons or combos — the scheme must stay tiny for a 4–8 year-old no matter how many powers are unlocked. See §6.1. |
| **Power feedback** | A **breakaway reveal screen** on each unlock | Celebrate the new friend + power; readable for little kids. See §6.2. |
| **Power persistence** | Cumulative & permanent; never removed | Standard metroidvania. Constrains powers to be *additive opt-in abilities* (see §7). |
| **Heart bonus** | **Keep** Teddy's +1 max-heart on collect | Companions feel rewarding beyond their power; generalized as `heartBonus`. |
| **Plan scope** | Full roster, **two depths** | Foundation + envelope powers detailed; traversal powers as contracts that expand into sub-specs when built. |

---

## 2. The Gating Spine

The player keeps every power. Each area is built around the newest one. The companion met in area *N* grants the power that gates area *N+1*.

| Area | Arrives with | Friend met here | Leaves with | Opens |
|------|-------------|-----------------|-------------|-------|
| **Bedroom** | walk + jump *(tutorial)* | 🧸 Teddy | **Double Jump** | → Hallway |
| **Hallway** | Double Jump | 🐶 Dog | **Dash** | → Kitchen |
| **Kitchen** | + Dash | 🐱 Cat | **Wall-Climb** | → Family Room |
| **Family Room** | + Wall-Climb | 🐴 Horse | **Charge** | → Living Room |
| **Living Room** | + Charge | 🦩 Flamingo | **Glide** | → Dollhouse |
| **Dollhouse** | all 5 powers | 🦖 T-Rex *(boss)* | — *win → big again* | — |

Eloise's **base moveset** (walk + single jump) is always available. The Bedroom uses only the base moveset — its levels are already validated completable by the reachability lint at the base envelope.

---

## 3. The Five Powers

Five distinct traversal "verbs" — no two overlap in the kind of obstacle they open.

| Power | Friend | Verb / axis | Signature obstacle (in the area it gates) | Family |
|-------|--------|-------------|-------------------------------------------|--------|
| **Double Jump** | 🧸 Teddy | go **higher** (second jump) | Hallway: high shelves, wide gaps | **envelope** |
| **Dash** | 🐶 Dog | go **fast / break through** | Kitchen: long slippery runs, crumb-walls | traversal |
| **Wall-Climb** | 🐱 Cat | go **up walls** | Family Room: scale couch, curtains, shelves | traversal |
| **Charge** | 🐴 Horse | **smash** big things | Living Room: heavy cushions, block barricades | traversal |
| **Glide** | 🦩 Flamingo | **float across** from height | Dollhouse: drift between floors to the boss | **envelope** |

### Two mechanical families (this drives the build order)

- **Envelope powers** (Double Jump, Glide) reshape the *jump arc*. They plug natively into the existing `jumpEnvelope()` and reachability lint — validated for free.
- **Traversal powers** (Dash, Wall-Climb, Charge) add *new edge types / blockers* to the level graph. They need a small reachability extension + new level-element types + a new player mechanic each.

Build order follows family: envelope powers first (cheap, native), traversal powers each in their own slice later.

---

## 4. Architecture — Powers Are Data, Not Code Branches

**Design rule:** a power is a row in a table; the engine reads a `Set` of what's unlocked. Adding a power touches *data*, never engine `if`-branches. (This kills the "six bespoke booleans + six branches" trap the audit identified in attempts 1–6.)

### 4.1 Ability + companion registries  `[DETAILED]`

```ts
// src/config/abilities.ts
export type AbilityId = "doubleJump" | "dash" | "wallClimb" | "charge" | "glide";

export const ABILITIES: Record<AbilityId, {
  label: string;                 // "Double Jump" (reveal screen / UI)
  family: "envelope" | "traversal";
  order: number;                 // gating order; 0 = earned first (doubleJump)
  control: "jump" | "power";     // doubleJump → "jump"; the rest → the power button
  priority?: number;             // power-button context resolution tiebreaker (§6.1)
  envelope?: {                   // envelope family only
    extraJumps?: number;         // doubleJump: 1
    fallGravityMult?: number;    // glide: ~0.3 (slower descent)
  };
}>;
```

```ts
// src/config/companions.ts  (also the COMPANIONS half of the audit's entity registry)
export type CompanionType = "teddy" | "dog" | "cat" | "horse" | "flamingo";

export const COMPANIONS: Record<CompanionType, {
  area: AreaId;                  // where you meet them
  grants: AbilityId;
  idleKey: string; walkKey: string;   // textures — single source of truth
  heartBonus?: number;           // Teddy: +1 max heart (kept)
}>;
```

`COMPANIONS` subsumes the companion half of `ENTITY_TEXTURE_KEYS` (started in the safety-net work). The boot/texture smoke test extends to validate companion textures through this table.

### 4.2 GameState change  `[DETAILED]`

Replace the single `teddyCollected: boolean` (+ `collectTeddy()`) with an ability set:

```ts
unlockedAbilities: Set<AbilityId>;          // persisted to localStorage as string[]
hasAbility(id: AbilityId): boolean;
collectCompanion(type: CompanionType): void; // unlocks COMPANIONS[type].grants + applies heartBonus
```

- **Persistence:** serialize the Set to a sorted `string[]`; rehydrate on load.
- **Migration (low priority, dev only):** an old save with `teddyCollected: true` → `unlockedAbilities: ["doubleJump"]`. `eloiseReset()` already exists as the escape hatch, so migration is optional.

### 4.3 Derived gating — never hand-authored  `[DETAILED]`

```ts
// abilities the player is EXPECTED to have while playing an area =
// the grants of every companion in an EARLIER area.
function abilitiesForArea(area: AreaId): Set<AbilityId>;

// the specific power an area is gated on = the grant of the PREVIOUS area's companion.
function gatingPower(area: AreaId): AbilityId | null;  // null for Bedroom (tutorial)
```

No level ever declares its own power set; it's derived from area order. (`AreaId` is the existing ordered area identifier — bedroom, hallway, kitchen, familyRoom, livingRoom, dollhouse.)

### 4.4 Level schema + the ordering invariant  `[DETAILED]`

Envelope-power gating is **emergent from geometry** (a gap too wide for base jump but within the double-jump envelope) — no tags needed. Traversal-power gating needs **explicit tagged elements**:

```ts
// authored in levelSketches.ts, carried through encodeFromSketch, validated in types/level.ts
requires?: AbilityId            // on a pit/gap or a traversal element
// new traversal element kinds (added when each traversal power is built):
//   { kind: "climbWall", ... }   requires wallClimb
//   { kind: "breakable", ... }   requires charge
//   a pit tagged requires: "dash"
```

**Zod `.refine` (the invariant that can't break):** any element with `requires: A` is valid only if `A ∈ abilitiesForArea(thisLevelsArea)`. A level may only depend on a power earned in an **earlier** area. This makes it *structurally impossible* to gate the Hallway with Cat's wall-climb, or to orphan a Bedroom pit by adding Flamingo's glide — the build fails with the offending element.

---

## 5. Reachability Integration — Where the Promise Becomes a Guarantee

Extends the lint shipped 2026-05-30 (`src/levels/reachability.ts`).

### 5.1 Ability-aware envelope  `[DETAILED for envelope powers]`

```ts
jumpEnvelope(abilities: Set<AbilityId>): JumpEnvelope
```

- **Base** (no abilities): today's envelope — apex ≈ 80.8px, flat gap ≈ 121.7px.
- **Double Jump** (`extraJumps: 1`): a second arc can launch mid-flight. Model: reachable if the target is within the base envelope **or** within a base envelope launched from the first arc's apex region → roughly **2× apex (~161px)** and an extended flat gap (~190–210px). Exact constants **TDD-pinned**, exactly as the base envelope was.
- **Glide** (`fallGravityMult: ~0.3`): the *descent* uses reduced gravity → longer airtime → much longer horizontal reach **from a height** (does not raise apex). `jumpEnvelope` recomputes the fall phase with the multiplier. Exact constants TDD-pinned.

### 5.2 Traversal edges  `[CONTRACT — expand per power]`

Traversal powers become **conditional edges/blockers** in the reachability graph, keyed by ability:

- **Dash** → a pit/gap tagged `requires: "dash"` is an edge available only when `dash ∈ abilities` (extended horizontal crossing). A light barrier may also be dash-clearable.
- **Wall-Climb** → a `climbWall` element connects a lower surface to a higher one regardless of jump arc, available only when `wallClimb ∈ abilities`.
- **Charge** → a `breakable` element blocks an edge until `charge ∈ abilities` removes it.

**The contract each traversal power's sub-spec must satisfy:** (a) a level-element kind + its `requires` ability, (b) a conditional-edge rule in the reachability BFS (use the edge only if the ability is active), (c) the player mechanic (its `control:"power"` context predicate + activation, §6.1) + art. (a) and (b) are defined here; the *internal mechanic + rendering* is the sub-spec's job.

### 5.3 The double-check — the metroidvania guarantee  `[DETAILED]`

For every level, at build time (Vitest, wired into `npm run build`):

```
abilities = abilitiesForArea(level.area)
solvableWith    = checkReachability(level, { abilities }).ok
                                          → MUST be true   (no soft-lock for a properly-powered player)

gp = gatingPower(level.area)
if gp != null:
  solvableWithout = checkReachability(level, { abilities: abilities − gp }).ok
                                          → if the AREA is fully solvable without gp, WARN "fake gate:
                                            this area doesn't actually require <gp>"
```

The second check is the game premise made testable: **"solvable with Double Jump, not solvable without it"** proves the Hallway genuinely needs the power Teddy gave you. The lock and the key are verified to fit, every build.

**Backward solvability** (old areas stay beatable as you gain powers) is *automatic* because abilities are additive opt-in — having more powers never makes an earlier level less solvable. This is why §1 constrains powers to never alter base movement (see §7).

---

## 6. Controls, Feedback & The Gate Moment

### 6.1 One context-sensitive power button  `[DETAILED]`

Hard constraint (from the player — a 4–8 year-old): **no per-power buttons, no combos.** The scheme stays tiny no matter how many powers are unlocked:

- **Move** — arrows / A-D
- **Jump** — Space. A second press mid-air is **Double Jump** (only if unlocked). Double Jump lives on the jump button because "jump again" is the most intuitive mapping for a kid.
- **Power** — ONE button (e.g. Shift / X). It resolves to whichever unlocked power fits the current context. Hold to sustain (glide).
- **Pause** — Esc.

> **Playtest refinement (2026-05-31, P4):** Wall-Climb moved off the power button onto **Up / W**. Reason: the power button's fallback is Dash, a gravity-suspended *lunge*; pressing X near a wall before being perfectly aligned dashed the player *off* the wall, an unrecoverable loop that made climbing untestable. "Hold Up to climb" is the universal ladder mapping and has no displacement side-effect. This is a deliberate, narrow exception to "no per-power buttons" — Up is a *directional* key (reused, not a new action button), and only for the one power where directional input is the natural verb. Wall-Climb stays a `control:"power"` ability in the data + dispatcher (priority 4) so that *being on a wall still suppresses X* (no accidental dash-off); only its trigger key changed. Dash/Glide/Charge remain on the power button.

**Context resolution** (`resolveActivePower(playerState, unlockedAbilities) → AbilityId | null`): each `control:"power"` ability declares a context predicate + priority. On press/hold, the dispatcher fires the highest-priority unlocked ability whose predicate matches:

| Power | Fires when… |
|-------|-------------|
| Wall-Climb | touching a climbable wall |
| Glide | airborne & descending (held) |
| Charge | grounded, facing a breakable |
| Dash | otherwise (grounded/airborne burst) |

Contexts are near-mutually-exclusive in practice (on a wall vs falling vs facing a breakable); priority is the tiebreaker. The engine never branches on "which power" — each ability owns its `appliesWhen` + `activate`, so the dispatcher stays data-driven. **The power-button input system is built at P2** (Glide is the first `control:"power"` ability); double-jump (P1) only extends the jump input.

### 6.2 The power-unlock reveal ("breakaway screen")  `[DETAILED]`

When a companion is collected at an area's gate, the game cuts to a **breakaway celebration screen**: the companion sprite front-and-center, the power named ("Teddy taught you to DOUBLE JUMP!"), a kid-readable beat (big art, a sparkle, maybe a quick demo). Any input dismisses it → continue into the next area. Implemented as a lightweight scene or UIScene overlay (`PowerUnlockScene`). **Resolves OQ2.**

### 6.3 The gate moment (end-of-area flow)  `[DETAILED]`

Each area's **final level is the gate.** Completing it runs one sequence:

1. Level-complete trigger fires (existing exit logic).
2. `collectCompanion(type)` → unlock the power (+ `heartBonus` if any).
3. **Breakaway reveal screen** (§6.2).
4. The companion now **follows Eloise** (existing Companion follow behavior) into the next area.
5. Load the next area's first level.

**Resolves OQ3:** "the gate" is the area's final level, and the double-check (§5.3) holds the **whole area** to "must require the gating power."

---

## 7. Invariants & Constraints

1. **Powers are additive opt-in.** A power adds an ability; it never changes base walk/jump. (Guarantees backward solvability and keeps the double-check valid.)
2. **No backward dependencies.** A level may only require a power from an earlier area (Zod-enforced).
3. **Every level solvable-with its expected abilities** (hard error, build-gated).
4. **Each area's gate is real** (warn if the area is solvable without the gating power).
5. **Powers are data.** No per-power engine branches; the engine reads `unlockedAbilities` and dispatches via `appliesWhen`/`activate`.
6. **Controls stay tiny.** One context-sensitive power button + double-jump on jump. Never add a per-power binding.
7. **Textures via the registry.** Companion art flows through `COMPANIONS`; the smoke test validates it.

---

## 8. Phasing (Master Plan Outline)

Each phase has a verification gate: **`npm run build` green (typecheck + tests + reachability double-check) before the next phase.** A fresh session picks up the next unchecked phase; the lint tells it instantly whether the previous work still holds.

| Phase | Depth | Deliverable | Done when |
|-------|-------|-------------|-----------|
| **P0 — Foundation** | DETAILED | `AbilityId`, `ABILITIES`, `COMPANIONS` tables; `GameState.unlockedAbilities` + persistence + `heartBonus`; `abilitiesForArea`/`gatingPower`; schema `requires` + Zod ordering `.refine`; `jumpEnvelope(abilities)` signature + base; the double-check harness | Tables exist, GameState migrated, double-check runs over the Bedroom (no powers) and passes; all tests green |
| **P1 — Double Jump slice** | DETAILED | Double-jump envelope math (TDD-pinned); Player second-jump on the jump button; `collectCompanion("teddy")`; the **gate moment** flow (§6.3) + **breakaway reveal screen** (§6.2) + companion follows; **one Hallway gate level** solvable-with / unsolvable-without double jump | First vertical slice: build green, double-check proves the Hallway gate is real, reveal screen shows, playtested |
| **P2 — Glide + power button** | DETAILED | Glide envelope math (reduced fall gravity, TDD-pinned); the **one-button power input + `resolveActivePower` dispatch** (Glide is the first `control:"power"` ability); a glide gate gap (standalone demo level is fine — its real area isn't built yet) | Build green + double-check; power-button infra proven; envelope power #2 generalizes the pattern |
| **P3 — Dash** | CONTRACT → sub-spec | Traversal: `dash` edge + `requires:"dash"` element; dash burst (plugs into the §6.1 dispatcher); gates Kitchen | Sub-spec written, contract (§5.2) satisfied, build green |
| **P4 — Wall-Climb** | CONTRACT → sub-spec | Traversal: `climbWall` element + edge; climb state (dispatcher); gates Family Room | Sub-spec written, contract satisfied, build green |
| **P5 — Charge + breakable terrain** | CONTRACT → sub-spec | Traversal: `breakable` element + edge; charge (dispatcher); gates Living Room | Sub-spec written, contract satisfied, build green |

**Build order ≠ game order — deliberate.** Game order is doubleJump → dash → wallClimb → charge → glide. *Build* order does both **envelope** powers first (P1 doubleJump, P2 glide) because they share one cheap mechanism and de-risk the system before any new-mechanic work, then **traversal** powers in game order (P3 dash → P4 climb → P5 charge). Approved 2026-05-30.

**Out of scope** (own future specs): companion/enemy `makeScaledBody` refactor (Seam 1), the `/maps.html` power overlay, the unrelated areas' full level content, the T-Rex boss fight.

---

## 9. Testing Strategy

- **TDD throughout** (the safety-net work established the pattern): envelope math pinned with unit tests; the double-check is itself a test over `LEVEL_CATALOG`.
- **Build gate:** `npm run build` = `tsc && vitest run && vite build`. A soft-lock, a fake gate, a backward dependency, or a missing companion texture fails the build.
- **Cross-session safety:** because the double-check is automated, a fresh session (or new model) verifies the whole power system's integrity with one command — the plan says *what* to do, the lint says *whether it worked*.

---

## 10. Open Questions

- **OQ1 — Double-jump constants:** exact apex/gap multipliers to TDD-pin in P1 (model in §5.1; numbers come from the implementation, like the base envelope).
- **OQ2 — Unlock feedback:** ✅ RESOLVED — breakaway reveal screen (§6.2).
- **OQ3 — Gate designation:** ✅ RESOLVED — the area's final level is the gate; the whole area must require the gating power (§6.3, §5.3).
- **OQ4 — Heart bonus:** ✅ RESOLVED — kept, generalized as `COMPANIONS[].heartBonus` (Teddy +1).
