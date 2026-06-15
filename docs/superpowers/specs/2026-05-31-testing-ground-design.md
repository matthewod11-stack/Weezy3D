# Testing Ground — Design Spec

**Date:** 2026-05-31
**Status:** Approved design, ready for implementation plan
**Related:** builds on the dev-sandbox infra from `docs/superpowers/specs/2026-05-31-glide-power-button-design.md` (`devLoadLevel`, `eloiseLoadDemo`)

---

## 1. Goal

A **dev-only, selectable "Testing Ground"** — one wide level laid out as a left-to-right obstacle course of labelled stations, each isolating one traversal mechanic, with all implemented powers granted on entry. It lets physics/powers be feel-tested in one place without building (or playing through) the real game levels.

**Problem it solves:** powers and the levels that need them are coupled (a glide gate can't legitimately appear before the Living Room), so a freshly-built power has no in-game home to test in until its area exists. The glide build exposed this — glide was only testable via an undiscoverable console command. The Testing Ground makes every implemented power feel-testable from the menu, decoupling *proving a mechanic* from *building content*.

---

## 2. Decisions locked in brainstorming (2026-05-31)

| Decision | Choice | Rationale |
|---|---|---|
| **Contents** | Power obstacle course — labelled stations, one per mechanic | Walk station-to-station, test each power's signature obstacle in one place. |
| **Access** | Dev-only menu row, gated on `import.meta.env.DEV` | Discoverable for the developer; tree-shaken out of the itch.io production build entirely (not just hidden). |
| **Power ON/OFF** | All powers granted; "off" = don't press the input | Powers are opt-in inputs (hold X = glide, 2× Space = double-jump). Not pressing IS the off state — zero extra toggle UI. |
| **Unbuilt powers** | Build stations as powers ship | Start with only working stations (double-jump, glide). P3–P5 each add their station when their mechanic lands. The course always reflects what's real — no dead/misleading stations. |
| **Traversability** | Add a reachability test | The level is off-catalog (skips the build double-check), so an explicit `checkReachability(..., {all powers}).ok` test gives it the same dead-end guarantee at build time. |

---

## 3. The Course

One continuous `LevelData`, authored left-to-right. Stations present **today** (only the implemented powers):

| Station | Tests | Geometry | Source of shape |
|---|---|---|---|
| **0 — Warmup** | walk, single jump, basic arcs | flat ground + 2–3 small platforms at varied gap/height | new, within base envelope |
| **1 — Double-Jump gap** | air-jump (hold-nothing baseline fails, 2× Space clears) | flat gap ~130 design-px (wider than base ~122, within double ~212) | the Hallway-gate geometry (`hallwayLevels.ts`) |
| **2 — Glide drop** | glide (hold X to clear; don't-hold fails) | high ledge → wide gap → far-low landing | the glide-demo geometry (`glideDemoLevel.ts`) |

The exit sits past the last station (cosmetic — completing it just ends the run; there's no "next" off-catalog level, so leaving is via Esc → Main Menu).

**Powers ON/OFF for comparison:** all powers granted on entry; to feel a gap "without glide" simply don't hold X, "without double-jump" don't press Space twice. No toggle keys, no HUD readout.

**Future stations** (added with their power, NOT in this build): Dash run (P3), Wall-Climb wall (P4), Charge breakable (P5). Each power's implementation plan gains a final task: "add your station to `testingGround.ts` + extend the all-powers helper + the reachability test."

---

## 4. Architecture & Files

| File | Change | Responsibility |
|---|---|---|
| `src/levels/testingGround.ts` | **create** | `TESTING_GROUND: LevelData` (the course) + `grantAllImplementedPowers(state)` helper |
| `src/levels/testingGround.test.ts` | **create** | reachability assertion: solvable with all implemented powers |
| `src/scenes/MenuScene.ts` | modify | dev-only `"testGround"` option + `confirmSelection` branch |

**No new GameScene code** — `devLoadLevel(raw)` / `buildLevel(data)` already exist (glide sandbox).

### 4.1 `testingGround.ts`

```ts
export const TESTING_GROUND: LevelData = { /* string id, killY, bounds, station platforms, exit */ };

// THE single source of truth for "powers that actually work today". Adding P3
// dash means appending one entry here — the menu grant and the reachability test
// both derive from this list, so they can never drift.
export const IMPLEMENTED_POWERS: AbilityId[] = ["doubleJump", "glide"];
// P3+ append "dash" / "wallClimb" / "charge" as they ship.

export function grantAllImplementedPowers(state: GameState): void {
  for (const id of IMPLEMENTED_POWERS) state.unlockedAbilities.add(id);
}
```

Authored directly in the real `LevelData` schema (string `id`, `killY`, `bounds`, platforms with `color`). NOT added to `LEVEL_CATALOG`. Station 1 reuses the Hallway-gate gap shape; Station 2 reuses the glide-demo shape — both already lint-proven.

### 4.2 MenuScene wiring

- Extend `type MenuOption = "continue" | "newGame" | "testGround"`.
- In `create()`, after building the base options: `if (import.meta.env.DEV) this.options.push("testGround");`
- `labelFor("testGround")` → `"Testing Ground (dev)"`.
- In `confirmSelection`, branch on `"testGround"`: `grantAllImplementedPowers(state)` → `state.beginRun()` → start GameScene → on `Phaser.Scenes.Events.CREATE` once, `gs.devLoadLevel(TESTING_GROUND)` (the same hook `eloiseLoadDemo` uses). New Game / Continue branches unchanged.

`import.meta.env.DEV` is statically replaced by `false` in production builds, so the row + its branch tree-shake out of the shipped bundle.

### 4.3 `testingGround.test.ts`

```ts
expect(
  checkReachability(TESTING_GROUND, { abilities: new Set(IMPLEMENTED_POWERS) }).ok,
).toBe(true);
```

Guarantees the hand-authored course has no impassable gap given the powers it grants — the same protection the catalog gets, opt-in for this off-catalog level. The test consumes `IMPLEMENTED_POWERS` directly (the same const the menu grant derives from), so the "with all powers" set the test solves against can never drift from what the menu actually grants.

---

## 5. Scope Boundary

**In:** the course (warmup + double-jump + glide stations), the dev-only menu row, the reachability test, the all-powers/implemented-powers single-source roster.

**Out (deferred / explicitly not built):**
- Dash / Wall-Climb / Charge stations → added with each power (P3–P5).
- Any live power-toggle UI or unlock on/off keys.
- Any production-facing UI change (the row is dev-only).
- HUD level-name correctness in the sandbox (shows a catalog index label — cosmetic, same as the glide sandbox).
- Touch/tablet access to the testing ground.

---

## 6. Invariants

1. **Dev-only.** The menu row and its code path must not appear in a production (`vite build`) bundle — gated on `import.meta.env.DEV`.
2. **Off-catalog.** `TESTING_GROUND` is never added to `LEVEL_CATALOG` (it would otherwise face the ordering `.refine` + catalog double-check, which it isn't meant to satisfy).
3. **One roster source of truth.** "All implemented powers" is defined once and consumed by both the grant-on-entry path and the reachability test — so a new power is added in exactly one place.
4. **Traversability guaranteed.** A test asserts the course is solvable with the granted powers; a dead-end fails the build, not the playtest.
5. **Stations reflect reality.** Only stations for implemented powers exist; no inert/misleading geometry for unbuilt powers.
