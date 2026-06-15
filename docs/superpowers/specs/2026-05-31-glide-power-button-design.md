# Power System P2 — Glide + One-Button Power Dispatcher — Design Spec

**Date:** 2026-05-31
**Status:** Approved design, ready for implementation plan
**Parent spec:** `docs/superpowers/specs/2026-05-30-power-system-design.md` (§8 Phase P2)
**Builds on:** P0 foundation + P1 double-jump slice (shipped 2026-05-30)

---

## 1. Goal

Deliver the **second envelope power (Glide)** and, with it, the **reusable one-button power-input system** that powers P3–P5. Glide is the first `control:"power"` ability, so P2 is where the power button is born. The double-jump slice (P1) only extended the *jump* button; everything on the power button starts here.

**P2 proves the mechanic + the infrastructure.** Glide's narrative gate moment (Flamingo in the Living Room) is deferred — the Living Room area isn't built yet. P2 is verified by an automated reachability proof + a console-driven dev sandbox you can actually play.

### What "done" means
`npm run build` green (typecheck + tests + reachability double-check + prod build), the auto-proof fixture shows the glide gap is solvable-with-glide and unsolvable-without, and `window.eloiseGrant("glide")` + the dev demo level let you feel glide in the browser.

---

## 2. Decisions locked in brainstorming (2026-05-31)

| Decision | Choice | Rationale |
|---|---|---|
| **Glide feel** | **Parachute float** — clamp descent velocity to a gentle constant while X is held | Most readable for ages 4–8 (predictable, classic Yoshi-flutter). Reach scales **linearly** with drop height → far easier to author gates than √height. **Supersedes** the parent spec's `fallGravityMult: 0.3` reduced-gravity scaffold. |
| **Power key** | **X** | One dedicated, teachable "power" key ("press X for your power"). Tablet build later maps it to an on-screen button. |
| **Verification** | **Auto-proof + dev sandbox** | A reachability test-fixture proves the metroidvania guarantee; a console-granted sandbox level lets the play-feel be tested now (the tape-to-wall loop). |
| **Reveal / Flamingo / companion-follow** | **Out of P2 scope** | `PowerUnlockScene` (P1) is already generic; glide's real gate moment lives in the unbuilt Living Room. P2 = mechanic; Living Room = narrative. |

---

## 3. The Glide Mechanic & The Math Change

### 3.1 Model: parachute clamp (not reduced gravity)

While the player **holds X** and is **airborne and descending**, downward velocity is **clamped** to a gentle constant `glideFallSpeed`. It is a clamp, not an added force — gravity still runs; on any frame where `vy > glideFallSpeed`, `vy` is set back to `glideFallSpeed`. Releasing X (or landing, or rising) ends the clamp; normal `GRAVITY_DOWN` resumes immediately.

This makes descent **constant-speed**, so horizontal reach is **linear in drop height**:
```
reachWhileGliding = horizontalSpeed × (dropHeight / glideFallSpeed)
```

### 3.2 Data change — `ABILITIES.glide.envelope`

```ts
// src/config/abilities.ts — glide row
glide: {
  label: "Glide", family: "envelope", order: 4, control: "power",
  priority: 3, activation: "hold",
  envelope: { glideFallSpeed: <design-px/s, TDD-pinned> },  // was: fallGravityMult: 0.3
}
```
- Remove `fallGravityMult` from the `AbilityDef.envelope` type; add `glideFallSpeed?: number`.
- Add `activation?: "hold" | "press"` to `AbilityDef` (glide = `"hold"`; default/undefined behaves as `"press"`; dash later = `"press"`). See §4.

### 3.3 Reachability change — `jumpEnvelope` + `canReach`

`src/levels/reachability.ts`:
- `JumpEnvelope` gains `glideFallSpeed?: number` (set only when `glide ∈ abilities`).
- `jumpEnvelope()`: drop the `fallGravityMult` branch; when glide is unlocked, set `glideFallSpeed` from `ABILITIES.glide.envelope.glideFallSpeed`. `gravDown` stays at the base value (glide does not change base gravity — it clamps).
- `canReach()`: when `env.glideFallSpeed` is present **and** the target is **below** the launch surface (`d < 0`, a descent), compute the falling phase at constant glide speed:
  ```
  fallTime = fallHeight / env.glideFallSpeed     // instead of √(2·fallHeight / gravDown)
  ```
  Rise-to-apex and horizontal speed are unchanged. When the target is at/above launch height, glide is irrelevant (you can't gain height by gliding) → fall back to the normal arc.

  **Monotonicity guard:** glide must only ever *add* reach. The descent fall-time is `max(arcFallTime, glideFallTime)` is wrong — gliding is the player's *choice* to fall slower, so on a descent the gliding player can reach **at least** as far as the non-gliding arc. Implement as: compute both the normal-arc reach and the glide reach for the descent, take the larger. This guarantees `canReach(env_with_glide) ⊇ canReach(env_base)` — additive opt-in (parent spec §7.1), so backward solvability can't regress.

**Invariant preserved:** glide only ever *adds* reach on descents → additive opt-in → backward solvability holds (parent spec §7.1).

### 3.4 Player runtime

`src/entities/Player.ts`:
- Add `keyPower` (X) in the constructor.
- In `tick`, after the existing gravity integration, build a context and dispatch (§4). If the resolved power is `glide`, its activation is `"hold"`, the key is held, and `vy > glideFallSpeed`: clamp `vy = glideFallSpeed`.
- `glideFallSpeed` is read from `ABILITIES.glide.envelope` and scaled by `RENDER_SCALE` at the Player layer (the design-space value lives in the data table, like every other physics constant).

---

## 4. The One-Button Power Dispatcher (the reusable infrastructure)

Mirrors the P1 `shouldAirJump` pattern: **pure, Phaser-free, unit-tested**, with `Player` supplying runtime context. This is the part P3–P5 extend.

### 4.1 New file `src/entities/powerDispatch.ts`

```ts
export interface PowerContext {
  airborne: boolean;
  descending: boolean;   // vy > 0
  // P3+ extend: onClimbableWall, facingBreakable, ... (added per power, never removed)
}

/** Pure context predicates, keyed by ability. Lives OUTSIDE abilities.ts so the
 *  data table stays Phaser-free and the reachability lint keeps running in Node. */
export const POWER_CONTEXTS: Partial<Record<AbilityId, (ctx: PowerContext) => boolean>> = {
  glide: (ctx) => ctx.airborne && ctx.descending,
  // dash / wallClimb / charge added in P3–P5
};

/** Highest-priority unlocked control:"power" ability whose predicate matches. */
export function resolveActivePower(
  ctx: PowerContext,
  unlocked: Set<AbilityId>,
): AbilityId | null;
```

Resolution: filter to `ABILITIES[id].control === "power"` ∧ `unlocked.has(id)` ∧ `POWER_CONTEXTS[id]?.(ctx)`, pick the max `priority` (higher wins; parent spec §6.1). Returns `null` when nothing matches.

### 4.2 Why predicate is split from data

If `appliesWhen` were a method on the ability object, importing `abilities.ts` would pull in Player/Phaser types and break the Node-only reachability lint. Keeping predicates in `powerDispatch.ts` keeps `abilities.ts` pure data and the dispatcher unit-testable with zero browser — exactly how `airJump.test.ts` works.

### 4.3 Player wiring

Each frame Player builds `{ airborne: !onGround, descending: vy > 0 }`, calls `resolveActivePower`, and acts on the result by the ability's `activation`:
- `"hold"` (glide): apply while `keyPower.isDown`.
- `"press"` (future dash): edge-trigger via `JustDown(keyPower)` (cache the read, à la the double-jump fix — `JustDown` is destructive).

For P2 only the `"hold"`/glide path is implemented; the `"press"` branch is structured but unexercised until P3.

---

## 5. Verification

### 5.1 Auto-proof — the metroidvania guarantee (Vitest fixture)

A hand-built fixture level with a wide **descent** drop-gap, asserted in a test (e.g. `reachability.integration.test.ts` or a new `glide.integration.test.ts`):
```
checkReachability(glideFixture, { abilities: new Set(["glide"]) }).ok === true   // solvable WITH glide
checkReachability(glideFixture, { abilities: new Set() }).ok === false            // NOT without
```
This is a **test fixture, not a `LEVEL_CATALOG` entry** — so it sidesteps the Zod ordering rule and the catalog double-check, both of which forbid a glide-gate before the Living Room.

### 5.2 Dev sandbox — the play-feel loop

- `window.eloiseGrant(abilityId)` in `main.ts`: adds the ability to `unlockedAbilities`, persists, reloads (mirrors existing `eloiseReset`). Dev-only handle.
- `window.eloiseLoadDemo("glide")`: loads a hand-authored glide demo level (a high ledge → wide gap → far landing) **not** in `LEVEL_CATALOG`, so the build double-check never sees it. Loadable from the console for the tape-to-wall feel test.
- Reuse the existing `window.eloiseGame` / `eloiseState` handles (added during the replay-freeze fix) for inspection.

### 5.3 Build gate

`npm run build` stays green: glide envelope unit tests pin `glideFallSpeed` reach math; the auto-proof runs in the suite; the existing catalog double-check is unaffected (no catalog level requires glide yet).

---

## 6. Scope Boundary

**In P2:**
- Parachute-clamp glide mechanic (data + reachability + Player).
- The one-button power dispatcher (`powerDispatch.ts` + `resolveActivePower` + Player `keyPower`).
- `activation` field on `AbilityDef`.
- Auto-proof fixture + dev sandbox (`eloiseGrant`, `eloiseLoadDemo`).
- A minimal glide visual cue (reuse jump pose; optional slow-descent sparkle).

**NOT in P2 (deferred, with where they land):**
- Living Room level content / the real glide gate → Living Room area build.
- Flamingo texture-loading + `Companion.computeFeetOriginY` non-Teddy fix → first non-Teddy companion phase (parent spec, P3 prep note).
- Power-unlock reveal wiring for glide → Living Room (the `PowerUnlockScene` is already generic).
- Traversal powers (dash/wall-climb/charge) and their predicates → P3–P5.
- On-screen tablet power button → Touch Controls track.

---

## 7. Files Touched (anticipated)

| File | Change |
|---|---|
| `src/config/abilities.ts` | `glide.envelope` → `glideFallSpeed`; add `activation` field; drop `fallGravityMult` from type |
| `src/config/abilities.test.ts` | update glide-row expectations |
| `src/levels/reachability.ts` | `JumpEnvelope.glideFallSpeed`; `jumpEnvelope` glide branch; `canReach` constant-speed descent |
| `src/levels/reachability.test.ts` | pin glide reach math |
| `src/entities/powerDispatch.ts` | **new** — `PowerContext`, `POWER_CONTEXTS`, `resolveActivePower` |
| `src/entities/powerDispatch.test.ts` | **new** — dispatch resolution + glide predicate |
| `src/entities/Player.ts` | `keyPower` (X); context build; glide clamp |
| `src/levels/<glide fixture/demo>.ts` | **new** — auto-proof fixture + dev demo level |
| `<a glide integration test>` | solvable-with / unsolvable-without glide |
| `src/main.ts` | `window.eloiseGrant`, `window.eloiseLoadDemo` dev handles |

---

## 8. Invariants Carried Forward (from parent spec §7)

1. **Powers are additive opt-in** — glide only adds descent reach; never alters base movement.
2. **Powers are data** — no per-power engine branches; Player dispatches via `resolveActivePower`; predicates are pure functions.
3. **Controls stay tiny** — glide goes on the single power button (X); no new per-power binding.
4. **Reachability is the guarantee** — the auto-proof makes "needs glide" a passing/failing test, not an opinion.
