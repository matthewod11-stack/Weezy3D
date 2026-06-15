# Family Room Area (World 4) — Design

**Date:** 2026-06-03
**Status:** Approved (brainstorm), pending implementation plan
**Scope:** Phase 7.1, third sub-project — **Family Room only**. Living Room and the Dollhouse boss are each their own later spec.
**Spec lineage:** Builds on the completed power system (`docs/superpowers/specs/2026-05-30-power-system-design.md`, P0–P5) and follows the **Hallway** (`2026-06-02-hallway-area-design.md`) and **Kitchen** (`2026-06-03-kitchen-area-design.md`) area templates. Family Room is the first area to **mix enemy types in one level** (the carryover system the prior two areas deferred) and the first to be built almost entirely from **already-shipped infrastructure** — no new gating model, no new traversal-vocab element.

---

## 1. Goal & Success Criteria

A 5-level Family Room at **full Bedroom/Hallway/Kitchen parity**, authored through the
`src/design/levelSketches.ts → encodeFromSketch` pipeline. The area's identity is
**enemy-forward, climb-light**: it is the first "you have a full toolkit now" area, where the
player exercises the whole kit (double-jump, dash, wall-climb) against **denser, varied** enemy
encounters rather than learning a new traversal gimmick. Theme: *couch fortress, rug archipelago —
dust mites under the cushions.*

- **Gate:** **wall-climb**, held since the Kitchen (Cat). Gated **once** — the finale — so it is
  a genuine lock without replaying Kitchen's continuous vertical ascent.
- **Reward:** **Horse → charge**, met at the finale on the standard **offset** model (charge is not
  usable in the Family Room; it unlocks the Living Room). Mirrors Hallway's Dog → dash.
- **Primary enemy:** **dust mite** — a stomp-patroller reskin (sibling of Ant/Spider/DustBunny).
- **Carryover (NEW):** dust bunnies, spiders, and ants return as variety, mixed into single levels.

**Done when:**

- [ ] 15 variants authored (5 slots × A/B/C), chained `B→A→A→C` like Bedroom/Hallway/Kitchen.
- [ ] `src/levels/familyRoomLevels.ts` is sketch-driven (`encodeAreaLevels(FAMILY_ROOM_AREA, SEGMENT_ORDER)`), replacing the `stubSlots` placeholder.
- [ ] Dust mites render and behave (stomp-patroller) in-game.
- [ ] **Carryover works:** a single level can spawn dust mites **and** returning dust bunnies / spiders / ants, driven by a per-zone `enemyType` override that falls back to the area's `primaryEnemy`.
- [ ] **Horse** met at the finale; grants charge on pickup (offset), fires `PowerUnlockScene` (already-wired), and is **unavoidable** (gated behind the only mandatory climb).
- [ ] Reachability lint proves the finale solvable **with** wall-climb and **not without**.
- [ ] `npm run build` green (tsc + Vitest + reachability lint + texture smoke + vite).
- [ ] `/maps.html` shows Family Room 15/15 drafted.

---

## 2. Gating Model — unchanged (standard offset)

No gating-model change. Horse omits `metAtStart`, so it stays a **finale** companion and charge is
used in the **next** area, exactly like Teddy and Dog. The `metAtStart` evolution introduced for
Cat (Kitchen) is contained to Cat.

The existing `gating.ts` chain already produces the right answers — confirmed, no re-wiring:

- `gatingPower("familyRoom")` = previous-area (Kitchen) companion (Cat) grant = **wall-climb**. The
  player arrives holding climbing (learned early, in the Kitchen).
- `abilitiesForArea("familyRoom")` = `{doubleJump, dash, wallClimb}` (Cat's home, kitchen, is a
  strictly-previous area; Horse is *not* added because it lacks `metAtStart`).

### 2.1 The unavoidable-companion invariant (design-enforced)

The finale's elevated shelf — holding **both Horse and the exit** — is reachable **only** by a
climb-only couch-back (taller than the double-jump apex). So the player *cannot finish slot 5
without meeting Horse*. The single load-bearing climb doubles as the companion gate — the same
technique the Kitchen used for Cat (the lint asserts exit-reachability, which transitively forces
the climb and the pickup).

---

## 3. Infrastructure (Phase 0)

Smaller than Kitchen. The encoder is already area-generalized; `climbWalls`, `requires:"dash"`, and
the elevatable exit are already author-able (Kitchen added them). The new work is the **carryover
system** and the **dust-mite entity**.

### 3.1 Carryover system (the one real new capability)

Front-loads exactly the infra the Living Room ("recap all four enemy types") will mandate. The
encoder currently maps **every** `kind:"enemy"` zone to `area.primaryEnemy`
(`encodeFromSketch.ts:144`). Add an optional per-zone override:

- **`SketchZone` gains `enemyType?: EnemyType`** (`src/design/levelSketches.ts`). Only meaningful
  when `kind === "enemy"`; the design `EnemyType` is the snake_case union
  (`"dust_bunny" | "spider" | "ant" | "dust_mite" | "trex"`).
- **Encoder line 144** becomes `type: ENEMY_RUNTIME_TYPE[z.enemyType ?? primaryEnemy]`. When a zone
  omits `enemyType`, it falls back to the area primary — so **every existing sketch
  (Bedroom/Hallway/Kitchen) encodes byte-identically**. Backward-compatible by construction.
- **Guard:** reject `enemyType: "trex"` with a clear throw (the boss is a set-piece, not a
  patroller; `ENEMY_RUNTIME_TYPE` only maps it to `dustBunny` for `Record` exhaustiveness). Encoded
  output with a `trex` enemy would also fail the `EnemySpawn` Zod enum downstream — fail early and loud.
- **Test** (`encodeFromSketch.elements.test.ts` or a sibling): a zone with `enemyType: "spider"`
  encodes to runtime `spider`; a zone without `enemyType` encodes to the area primary; a
  `enemyType: "trex"` zone throws.

No GameScene change is needed *for the carryover wiring itself* — all four runtime branches already
exist (`dustBunny`/`spider`/`ant`), and `dustMite` is added in §3.2. Once `dustMite` is live, a
single level mixing all four types Just Works (each `EnemySpawn` flows through the existing
type-switch).

### 3.2 Dust-mite entity (stomp-patroller reskin)

Exactly the Ant pattern. `DustMite extends Enemy`, a **sibling of `DustBunny`/`Spider`/`Ant`**; the
`Enemy` base owns all patrol motion — no new behavior.

- **New `src/entities/DustMite.ts`** mirroring `Ant.ts`: a single texture (no idle/walk split, so no
  pose-swap — just flip with travel direction), `computeFeetOriginY` origin, body size + scale tuned
  to dust-mite proportions (tune at playtest).
- **Art already exists on disk:** `assets/sprites/enemies/storybook/dustmite.png` (confirmed; from
  the storybook art session). No generation needed.
- **Texture registration:** add `DUST_MITE` to `src/config/textures.ts` (`${STORYBOOK_PREFIX}dustmite`),
  to the `ENTITY_TEXTURE_KEYS` map as `dustMite: [DUST_MITE]`, and to the bulk-export list; load it
  in `BootScene` (`this.load.image(DUST_MITE, "assets/sprites/enemies/storybook/dustmite.png")`).
  The texture smoke test fails the build if any of these is missed (it caught spider/dog in Hallway,
  ant/cat in Kitchen).
- **`GameScene`:** add `else if (spawn.type === "dustMite") { enemy = new DustMite(this, spawn); }`
  before the existing `else` guard, with the **same** collider (`platformGroup`) + overlap
  (`player → handleEnemyOverlap`) wiring as the other branches. The stomp check is already
  `instanceof Enemy` — DustMite qualifies free. The `console.warn` else stays as the future-proof
  guard (now only reachable by a genuinely-unhandled type).

### 3.3 Enemy-forward placement (no new code)

"Enemy-forward" is **density + variety via placement**, not new mechanics:

- More enemy zones per level than Hallway/Kitchen (~3–5 stomp encounters vs ~1–3).
- Carryover variety: tag some zones `enemyType: "dust_bunny" | "spider" | "ant"` to bring back old
  foes alongside the dust-mite primary.
- Lean on the existing patterns: Safe Stomp Intro (4), Stomp Patroller Gate (13), Risk-Reward
  Branch (5). All four enemy types are mechanically identical stomp-patrollers — variety is cosmetic
  (different cute critters), which is the point for ages 4–8.

---

## 4. Content — 5 Slots × A/B/C, Enemy-Forward / Climb-Light

Replaces the `stubSlots` skeleton in `FAMILY_ROOM_AREA.slots` (`levelSketches.ts`), authored on
`/maps.html`. Each slot chains `B→A→A→C` into one level. **Climbing is gated exactly once** (the
finale); enemy encounters escalate in density and variety across the area.

| Slot | Beat | Enemies (enemy-forward + carryover) | Climb | Lethal? |
|------|------|--------------------------------------|-------|---------|
| **1** | Welcome to the rug | 1–2 **dust mites**, gentle safe-stomp intro | — | No |
| **2** | Critter mix | dust mites + a returning **dust bunny** (carryover debut) | Optional low-ottoman climb for a bonus token | No |
| **3** | Toolkit romp | denser mix: dust mites + **spider** + **ant**; a stomp-patroller gate to a token | Optional climb to a high token | No (last safe) |
| **4** | First fall | mixed swarm flanking a **lethal pit** (cleared by double-jump or optional dash) | Optional | **Yes** (soft) |
| **5** | Couch summit → **meet Horse** | climax encounter at the base | **MANDATORY climb-only** couch-back to the elevated shelf where **Horse + exit** sit | Yes |

- **Single load-bearing climb** = slot 5's couch-back. It is the *only* mandatory climb in the area
  (keeping it "climb-light") and it doubles as the Horse gate (§2.1). Slots 1–3 climbs are optional
  (bonus tokens); slot 4 climb is optional.
- **Whole-toolkit feel:** double-jump for medium hops, dash for **optional** rug-gap bonus tokens
  (slots 2–4), wall-climb for the finale + optional verticals. No power besides wall-climb is
  load-bearing — Family Room is a "use everything you have" romp, not a single-gimmick level.
- **Forgiveness curve holds:** no lethal hazard until slot 4; the first lethal is a soft themed pit;
  the climax is slot 5. Falling off an optional climb is non-lethal (land on the floor/rug, try again).
- **Carryover discipline:** introduce one returning type at a time (dust bunny in slot 2, then
  spider + ant in slot 3) so the variety reads as a gentle recap, not a difficulty spike.

### 4.1 Hazards = themed pits (mechanically); art deferred

Slot 4's pit and any finale gaps are **pits with a kill plane** using the existing respawn system —
the same mechanism as Hallway's gaps and Kitchen's sink/stove. Theming ("gap behind the couch",
"under the rug") is captured here for when illustrated backgrounds return. No new hazard code.

### 4.2 Geometry targets (the lint is the source of truth, not these numbers)

Derived from `src/config/physics.ts` (same envelope the lint uses):

- Base flat reach ≈ **121 px** · double-jump flat reach ≈ **212 px** · dash lunge ≈ **320 px**
- Base apex ≈ **81 px** · double-jump apex ≈ **161 px**

So:

- **Climb-only couch-back (load-bearing, slot 5):** shelf top **> 161 px** above the launch
  floor/rug (above double-jump apex), reached by a `climbWall` on the couch face. Author the shelf so
  no double-jump or dash route reaches it (dash gains no altitude — `reachability.ts` grants it only
  to equal-or-lower targets).
- **Optional dash gaps (slots 2–4):** **> 212 px** (double-jump can't clear) and within the dash
  lunge — target ~240–290 px, **flat or downhill** — guarding *optional* tokens. The base path is
  always completable without the dash gap.
- **Lethal pit (slot 4):** a gap the player **can** clear with double-jump (so dash stays optional),
  with a kill plane below. Width tuned against the lint.

Author to these, then let `npm run build`'s reachability lint validate exact solvability; tune until
the §6 proofs hold.

---

## 5. Pipeline Switch

`src/levels/familyRoomLevels.ts`: replace the `stubSlots` placeholder with the one-liner mirror of
`bedroomLevels.ts` / `hallwayLevels.ts` / `kitchenLevels.ts`:

```ts
const SEGMENT_ORDER = ["B", "A", "A", "C"];
export const FAMILY_ROOM_LEVELS = encodeAreaLevels(FAMILY_ROOM_AREA, SEGMENT_ORDER) as LevelData[];
```

Confirm `FAMILY_ROOM_ENTRIES` is concatenated into `src/levels/levelCatalog.ts` after
`KITCHEN_ENTRIES` (add it if not). `/maps.html` reads `ALL_AREAS` — the design surface updates
automatically once variants are authored.

---

## 6. Reachability Auto-Proof

A new `src/levels/familyRoom.integration.test.ts`, mirroring `kitchen.integration.test.ts`,
asserting the metroidvania guarantee as fact:

- Every Family Room level solvable **with** `abilitiesForArea("familyRoom")` = `{doubleJump, dash, wallClimb}`.
- **Climb load-bearing:** slot 5 is **not** solvable without `wallClimb` (the climb-only couch-back
  returns `exit-unreachable`).
- **Horse** comfortably reachable (no `companion-stranded`) — and, by transitivity of the climb-only
  exit, unavoidable.
- (Sanity) carryover does not affect solvability — enemies are not collision blockers for the lint;
  this test documents that the mixed-enemy levels still encode + validate.

The build-time lint (`reachability.ts`, ability-aware via `abilitiesForArea`) covers per-level
solvability on every `npm run build`; this test pins the *not-without* direction the lint alone
doesn't assert. **Per-area** describe (from the Hallway refinement): "≥1 level in a gated area is
unsolvable without its gating power" — slot 5 satisfies it, so optional climbs in slots 1–3 don't
break the build.

---

## 7. The "Meet Horse" Moment

Reuse existing tech. `PowerUnlockScene` (the breakaway reveal) already fires automatically on
companion pickup (`GameScene.ts`) — it shows for Horse exactly as it does for Dog/Cat. No in-level
climb prompt is strictly needed (the player has climbed since the Kitchen and saw "Press ↑ to climb!"
there), but the finale couch-back may reuse the same lightweight prompt for clarity. The full
**scripted cutscene system** (per-power intros + intro/ending engine) remains roadmapped at **7.3.5**.

---

## 8. Out of Scope (each its own later spec / pass)

- **Living Room / Dollhouse** — each is its own spec. Living Room reuses this area's carryover system
  for its "recap all four" and adds the `breakable` barricade sketch element (charge gate).
- **Charge teaser in the Family Room** — charge is a forward reward (offset model); no breakables here.
- **Rich dust-mite / carryover behavior** — all enemies stay stomp-patroller reskins for v1.
- **Per-zone enemy *facing* / patrol-width override** — the existing auto-derive heuristic is reused;
  carryover adds only the *type* discriminator.
- **Dust-mite walk-pose** — single texture, like Ant (no idle/walk split).
- **Illustrated Family Room backgrounds** + couch/rug hazard **art** — blueprint mode holds until
  gameplay is locked.
- **Scripted cutscene tech** (§7) — roadmapped 7.3.5.

---

## 9. Build Phases (for the implementation plan)

Each phase is build-green before the next, following the established discipline
(edit → targeted Vitest → commit). Subagent-driven (per-task implementer + spec-then-quality review).

- **P0 — Infra.** Carryover: `enemyType` on `SketchZone` + encoder `?? primaryEnemy` passthrough +
  `trex` guard + encoder test (§3.1). `DustMite` entity + GameScene branch + texture registration +
  BootScene load (§3.2). Verify Bedroom + Hallway + Kitchen still pass byte-identically (no enemy
  zone in them carries `enemyType`).
- **P1 — Author content.** 15 variants on `/maps.html` realizing the enemy-forward / climb-light
  journey (§4): single load-bearing finale climb, escalating enemy density + carryover variety.
  Iterate geometry against the reachability lint until the §6 proofs hold.
- **P2 — Pipeline switch.** `familyRoomLevels.ts` → sketch-driven (§5). Confirm catalog + maps page
  pick up all 5 Family Room levels (catalog now 20).
- **P3 — Auto-proof.** `familyRoom.integration.test.ts` (§6). Final `npm run build` green; runtime
  smoke (dev preview): a Family Room level loads from the menu, dust mites + ≥1 carryover type render,
  the finale climb wall + Horse render, no console errors.

---

## Appendix — Key files

| File | Role in this spec |
|------|-------------------|
| `src/design/levelSketches.ts` | `enemyType?` on `SketchZone` (§3.1); `FAMILY_ROOM_AREA` slots authored here (§4); intent text already good |
| `src/levels/encodeFromSketch.ts` | `ENEMY_RUNTIME_TYPE[z.enemyType ?? primaryEnemy]` + `trex` guard (§3.1) |
| `src/entities/DustMite.ts` | **New** — sibling of `Ant`/`Spider`/`DustBunny` (§3.2) |
| `src/scenes/GameScene.ts` | `dustMite` branch before the existing `else` guard (§3.2) |
| `src/scenes/BootScene.ts` | Load `dustmite.png` (§3.2) |
| `src/config/textures.ts` | `DUST_MITE` constant + `ENTITY_TEXTURE_KEYS.dustMite` + export (§3.2) |
| `src/levels/familyRoomLevels.ts` | Sketch-driven switch (§5) |
| `src/levels/levelCatalog.ts` | Concat `FAMILY_ROOM_ENTRIES` (§5) |
| `src/levels/familyRoom.integration.test.ts` | **New** — climb-gate + Horse auto-proof (§6) |
| `src/levels/encodeFromSketch.elements.test.ts` | Carryover override + fallback + trex-guard test (§3.1) |
