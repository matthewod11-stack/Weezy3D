# Testing Ground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only, menu-selectable "Testing Ground" level — a left-to-right obstacle course of stations (warmup + double-jump gap + glide drop) with all implemented powers granted on entry — for feel-testing physics without building real levels.

**Architecture:** A new off-catalog `LevelData` (`TESTING_GROUND`) plus a single-source `IMPLEMENTED_POWERS` roster. A dev-only menu row (gated on `import.meta.env.DEV`, tree-shaken from production) grants those powers and loads the level via the existing `GameScene.devLoadLevel` + `events.once(CREATE)` override pattern (same as `eloiseLoadDemo`). An opt-in reachability test guarantees the hand-authored course has no dead-end.

**Tech Stack:** Phaser 3.80, TypeScript (strict), Vite 6 (`import.meta.env.DEV`), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-31-testing-ground-design.md`

---

## File Structure

| File | Responsibility | New? |
|---|---|---|
| `src/levels/testingGround.ts` | `TESTING_GROUND` level + `IMPLEMENTED_POWERS` roster + `grantAllImplementedPowers` helper | **create** |
| `src/levels/testingGround.test.ts` | roster sanity + reachability-with-all-powers + helper-grants-all | **create** |
| `src/scenes/MenuScene.ts` | dev-only `"testGround"` option + its `confirmSelection` branch | modify |

No GameScene change — `devLoadLevel(raw: LevelData)` (public, GameScene.ts:325) already exists.

---

## Task 1: The testing-ground level + roster + reachability guarantee

**Files:**
- Create: `src/levels/testingGround.ts`
- Create: `src/levels/testingGround.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/levels/testingGround.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkReachability } from "./reachability";
import {
  TESTING_GROUND,
  IMPLEMENTED_POWERS,
  grantAllImplementedPowers,
} from "./testingGround";
import { GameState } from "../state/GameState";

describe("testing ground", () => {
  it("lists the powers that are actually implemented today", () => {
    expect(IMPLEMENTED_POWERS).toContain("doubleJump");
    expect(IMPLEMENTED_POWERS).toContain("glide");
  });

  it("is fully traversable with all implemented powers (no dead-end)", () => {
    const result = checkReachability(TESTING_GROUND, {
      abilities: new Set(IMPLEMENTED_POWERS),
    });
    expect(result.ok, result.problems.map((p) => p.message).join(" | ")).toBe(true);
  });

  it("grantAllImplementedPowers unlocks every power in the roster", () => {
    const s = GameState.get();
    s.resetWorld();
    grantAllImplementedPowers(s);
    for (const id of IMPLEMENTED_POWERS) {
      expect(s.hasAbility(id)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/testingGround.test.ts`
Expected: FAIL — module `./testingGround` does not exist.

- [ ] **Step 3: Create the level + roster + helper**

Create `src/levels/testingGround.ts`. The level is authored in DESIGN-px (un-scaled), matching the real `LevelData` schema (string `id`, `killY`, `bounds`, platforms with `color`) — exactly like `glideDemoLevel.ts`. NOT added to `LEVEL_CATALOG`.

```ts
import type { LevelData } from "../types/level";
import type { AbilityId } from "../config/abilities";
import type { GameState } from "../state/GameState";

const FLOOR_Y = 168;

/**
 * THE single source of truth for "powers that actually work today". Both the
 * menu (what to grant on entry) and the reachability test (what to solve with)
 * derive from this list — so they can never drift. When P3 dash ships, append
 * "dash" here and add its station to TESTING_GROUND below.
 */
export const IMPLEMENTED_POWERS: AbilityId[] = ["doubleJump", "glide"];

/** Unlock every implemented power on the given state (used on entry). */
export function grantAllImplementedPowers(state: GameState): void {
  for (const id of IMPLEMENTED_POWERS) state.unlockedAbilities.add(id);
}

/**
 * Dev-only obstacle course. Stations left→right, each isolating one mechanic.
 * Authored in design-px; devLoadLevel scales by RENDER_SCALE at runtime.
 * NOT in LEVEL_CATALOG (it intentionally skips the ordering refine + catalog
 * double-check). A reachability test (testingGround.test.ts) guarantees it's
 * traversable with IMPLEMENTED_POWERS, since it dodges the build double-check.
 *
 * Stations today (only implemented powers — add dash/climb/charge with P3–P5):
 *   0 Warmup        — walk + single jump (gentle steps within base envelope)
 *   1 Double-Jump   — a 130-px flat gap (wider than base ~122, within double ~212)
 *   2 Glide drop    — high ledge → wide low gap; clear by holding X (glide)
 */
export const TESTING_GROUND: LevelData = {
  id: "testing-ground",
  name: "Testing Ground",
  spawn: { x: 20, y: FLOOR_Y },
  killY: 280,
  bounds: { minX: 0, maxX: 960, minY: -20, maxY: 260 },
  platforms: [
    // Station 0 — Warmup
    { x: 0, y: FLOOR_Y, w: 140, h: 32, color: "#cdb9a6" }, // start ground
    { x: 150, y: FLOOR_Y - 28, w: 40, h: 14, color: "#e8c9a0" }, // gentle step (28 up)
    // Station 1 — Double-Jump gap (130-px flat gap)
    { x: 210, y: FLOOR_Y, w: 110, h: 32, color: "#d4a574" }, // left
    { x: 450, y: FLOOR_Y, w: 110, h: 32, color: "#d4a574" }, // right (gap 320→450 = 130)
    // Station 2 — Glide drop (up to a high ledge, then float across a wide low gap)
    { x: 590, y: FLOOR_Y - 88, w: 70, h: 14, color: "#e8c9a0" }, // high ledge (y=80; 88 up, double-jump)
    { x: 820, y: FLOOR_Y + 32, w: 120, h: 32, color: "#c9b08f" }, // far low landing (gap 660→820 = 160, drop 120)
  ],
  enemies: [],
  tokens: [],
  exit: { x: 860, y: FLOOR_Y + 32 - 52 + 4, w: 40, h: 52 },
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/levels/testingGround.test.ts`
Expected: PASS (3 tests).

If the "fully traversable" test FAILS, the failure message lists the unreachable element (e.g. `exit-unreachable` or `platform-unreachable`). Adjust ONLY the offending platform's geometry to bring it within the all-powers envelope — do NOT change the test or relax margins. Likely culprits and fixes:
- Station-1 right platform unreachable → the 130-px gap is too wide even for double jump (shouldn't be; double flat ≈212). If so, narrow it (move `x: 450` left toward `430`).
- High ledge unreachable → 88-px rise exceeds double apex; lower it (raise `y` toward `FLOOR_Y - 70`).
- Landing/exit unreachable → glide descent reach short; reduce the gap (move `x: 820` left) or raise the landing.
Re-run until green. Note any final coords you changed.

- [ ] **Step 5: Verify nothing else broke**

Run: `npx tsc --noEmit` → expect clean (exit 0).
Run: `npx vitest run` → expect the full suite passes (was 88; now 91).

- [ ] **Step 6: Commit**

```bash
git add src/levels/testingGround.ts src/levels/testingGround.test.ts
git commit -m "feat(dev): testing-ground level + IMPLEMENTED_POWERS roster

Off-catalog obstacle course (warmup + double-jump gap + glide drop) for feel-
testing physics. IMPLEMENTED_POWERS is the single roster the menu grant and the
reachability test both derive from. A reachability test guarantees the hand-
authored course is traversable with all powers (it skips the catalog double-check).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Dev-only "Testing Ground" menu option

**Files:**
- Modify: `src/scenes/MenuScene.ts`

No unit test — `MenuScene` drives Phaser scene/input, which the node test env can't exercise (consistent with the rest of the scene; the pure menu helpers live in the already-tested `menuSelection.ts`). Verified at runtime in Task 3. The level + roster logic it depends on is already covered by Task 1.

- [ ] **Step 1: Add imports + extend the option union**

In `src/scenes/MenuScene.ts`, add to the imports (after line 5, the `menuSelection` import):

```ts
import { GameScene } from "./GameScene";
import { TESTING_GROUND, grantAllImplementedPowers } from "../levels/testingGround";
```

Change the option type (line 9) from:

```ts
type MenuOption = "continue" | "newGame";
```

to:

```ts
type MenuOption = "continue" | "newGame" | "testGround";
```

- [ ] **Step 2: Append the dev-only option in `create()`**

In `src/scenes/MenuScene.ts`, the line that builds the options (line 49) currently reads:

```ts
    this.options = state.hasProgress() ? ["continue", "newGame"] : ["newGame"];
```

Add the dev-only row immediately after it:

```ts
    this.options = state.hasProgress() ? ["continue", "newGame"] : ["newGame"];
    // Dev-only: Vite statically replaces import.meta.env.DEV with false in the
    // production build, so this row (and its branch in confirmSelection) is
    // tree-shaken out of the itch.io bundle entirely.
    if (import.meta.env.DEV) {
      this.options.push("testGround");
    }
```

- [ ] **Step 3: Add the label**

In `src/scenes/MenuScene.ts`, `labelFor` (lines 105-113) currently ends `return "New Game";`. Replace the whole method body so it handles the new option:

```ts
  private labelFor(option: MenuOption): string {
    if (option === "continue") {
      const state = GameState.get();
      const entry = getLevelEntry(state.levelIndex);
      const name = entry?.raw.name ?? `Level ${state.levelIndex + 1}`;
      return `Continue — lvl ${state.levelIndex + 1}/${LEVEL_CATALOG.length} · ${name}`;
    }
    if (option === "testGround") {
      return "Testing Ground (dev)";
    }
    return "New Game";
  }
```

- [ ] **Step 4: Branch in `confirmSelection` + add the loader**

In `src/scenes/MenuScene.ts`, replace `confirmSelection` (lines 146-156) with:

```ts
  private confirmSelection(): void {
    const choice = this.options[this.selection];
    const state = GameState.get();
    if (choice === "testGround") {
      this.startTestingGround(state);
      return;
    }
    if (choice === "newGame") {
      state.resetWorld();
    }
    // Clear the transient run flags (worldComplete/paused) + refill hearts so
    // GameScene.update() doesn't early-return on re-entry. Continue keeps progress.
    state.beginRun();
    this.scene.start("GameScene");
  }

  /**
   * Dev-only: grant all implemented powers and drop into the off-catalog
   * testing-ground level. GameScene.create() loads the catalog level first;
   * we override it via the CREATE-once hook (same pattern as eloiseLoadDemo).
   */
  private startTestingGround(state: GameState): void {
    grantAllImplementedPowers(state);
    state.beginRun();
    const gs = this.scene.get("GameScene") as GameScene;
    gs.events.once(Phaser.Scenes.Events.CREATE, () =>
      gs.devLoadLevel(TESTING_GROUND),
    );
    this.scene.start("GameScene");
  }
```

- [ ] **Step 5: Verify typecheck + suite**

Run: `npx tsc --noEmit` → expect clean (exit 0).
Run: `npx vitest run` → expect 91 pass (no new tests; must not break existing).

- [ ] **Step 6: Commit**

```bash
git add src/scenes/MenuScene.ts
git commit -m "feat(dev): dev-only Testing Ground menu option

Adds a 'Testing Ground (dev)' row (import.meta.env.DEV-gated, tree-shaken from
production) that grants all implemented powers and loads the off-catalog course
via GameScene.devLoadLevel + the CREATE-once override (eloiseLoadDemo pattern).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Build gate + runtime verification

**Files:** none (verification only)

- [ ] **Step 1: Full build gate**

Run: `npm run build`
Expected: `tsc` clean, all Vitest tests pass (91), `vite build` succeeds.

- [ ] **Step 2: Confirm the option is dev-only (production check)**

Run: `grep -c "Testing Ground" dist/assets/*.js` after the build.
Expected: `0` — `import.meta.env.DEV` is `false` in the production bundle, so the row + branch are tree-shaken out. (If non-zero, the dev gate isn't working — investigate before proceeding.)

- [ ] **Step 3: Start the preview server**

Use `preview_start` with config name `Game Dev Server` (from `.claude/launch.json`). The dev server has `import.meta.env.DEV === true`, so the row appears.

- [ ] **Step 4: Confirm the menu row appears and selecting it loads the course**

Reload the preview (`preview_eval`: `window.location.reload()`), wait ~2s for boot, then drive the menu via `preview_eval`. The simplest reliable check is to invoke the same path the click takes — start GameScene through the menu by simulating selection is hard (Phaser input), so instead verify the wiring loaded the level by checking the menu options include the dev row, then confirm the level loads through the runtime:

```js
// 1) the dev option is present on the menu
JSON.stringify({
  // MenuScene is private-heavy; assert via the scene's option labels on screen
  menuTexts: window.eloiseGame.scene.getScene("MenuScene").children?.list
    ?.filter(o => o.type === "Text").map(o => o.text) ?? [],
})
```

Expected: the returned `menuTexts` array includes `"Testing Ground (dev)"`.

- [ ] **Step 5: Confirm the course loads + is traversable shape**

Drive the load directly (mirrors what the menu branch does), then inspect:

```js
(() => {
  const sm = window.eloiseGame.scene;
  const st = window.eloiseState;
  st.unlockedAbilities.add("doubleJump"); st.unlockedAbilities.add("glide");
  st.beginRun();
  const gs = sm.getScene("GameScene");
  return JSON.stringify({ ready: typeof gs.devLoadLevel });
})()
```

Then use the menu's actual path if possible, OR confirm via screenshot after a console `eloiseLoadDemo`-style load. Capture `preview_screenshot` and confirm the course renders: start ground at left with Eloise, the double-jump gap, and the high ledge → low landing at right. Check `preview_console_logs` (level `error`) is empty.

- [ ] **Step 6: Manual playtest handoff**

Hand off to the user: in `npm run dev`, the main menu now shows **"Testing Ground (dev)"**. Selecting it grants double-jump + glide and drops Eloise at the warmup. Walk right: (Station 1) clear the wide gap with a double-jump (2× Space), (Station 2) climb to the high ledge then **hold X** to glide across to the landing. Confirm each station is clearable and feels right.

- [ ] **Step 7: Update PROGRESS.md**

Add a session entry: dev-only Testing Ground shipped — menu-selectable off-catalog course (warmup + double-jump + glide stations), all implemented powers granted, traversability test-guaranteed, tree-shaken from production. Note the manual-playtest outcome.

- [ ] **Step 8: Final commit**

```bash
git add PROGRESS.md
git commit -m "docs(progress): dev-only Testing Ground — shipped, build green

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist (completed by plan author)

- **Spec coverage:** §3 course (warmup/double-jump/glide stations) → T1 `TESTING_GROUND`; §4.1 roster+helper → T1 `IMPLEMENTED_POWERS`/`grantAllImplementedPowers`; §4.2 menu wiring → T2; §4.3 reachability test → T1; §6 invariants — dev-only (T2 + T3 step 2), off-catalog (T1, never added to catalog), one roster source (T1 const consumed by both), traversability (T1 test), stations-reflect-reality (only implemented stations authored). ✓
- **Placeholders:** none — full level coords given; T1 step 4 gives concrete adjustment guidance if a gap mis-tunes (not a placeholder — the authored coords are computed to pass). ✓
- **Type consistency:** `IMPLEMENTED_POWERS: AbilityId[]`, `grantAllImplementedPowers(state: GameState)`, `TESTING_GROUND: LevelData`, `devLoadLevel(raw: LevelData)` (existing), `MenuOption` union extended consistently across T2 steps; `events.once(Phaser.Scenes.Events.CREATE, ...)` matches the verified `eloiseLoadDemo` pattern. ✓
- **Off-catalog safety:** `TESTING_GROUND` never added to `LEVEL_CATALOG`; reachability test passes it un-scaled (design-px), matching `checkReachability`'s space. ✓
