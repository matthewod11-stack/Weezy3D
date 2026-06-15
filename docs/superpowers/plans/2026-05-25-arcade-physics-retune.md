# Arcade Physics Retune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tune physics for a more arcadey feel (bigger jumps, slightly faster movement), update three documentation surfaces that reference the old jump envelope, and retune five pit-bearing bedroom variants whose old 2-cell pits would otherwise read as trivial.

**Architecture:** Three changes flow downstream from each other and ship as a single atomic commit. Physics constants change in `src/config/physics.ts`. Three doc surfaces (`levelSketches.ts` header, `blueprint.ts` header, `CLAUDE.md`) get updated envelope references. Five level variants in `src/design/levelSketches.ts` get pit-width bumps. The encoder (`encodeFromSketch.ts`) is untouched — it absorbs pit-width changes automatically.

**Tech Stack:** Phaser 3.80, TypeScript 5.7 (strict), Vite 6. No test framework — verification is typecheck, build, visual inspection of the `/maps.html` design surface, and manual playtest of bedroom levels.

**Reference spec:** [docs/superpowers/specs/2026-05-25-arcade-physics-retune-design.md](../specs/2026-05-25-arcade-physics-retune-design.md)

---

## Task 1: Initialize git repository (precondition)

**Why first:** The spec's rollback strategy is "single atomic commit, easy `git revert` if playtest feels worse." That requires a git repo. PROGRESS.md has flagged "init git" in two prior session-ends; doing it as part of this work makes the rollback path real instead of theoretical.

**Files:**
- Modify: `.gitignore` (verify only; already present)

- [ ] **Step 1: Verify not already a git repo**

Run: `[ -d .git ] && echo "already a repo" || echo "not yet a repo"`
Expected: `not yet a repo`

If output is `already a repo`, skip the rest of Task 1.

- [ ] **Step 2: Verify .gitignore content is sensible before initial commit**

Run: `cat .gitignore`
Expected output:
```
node_modules/
dist/
.DS_Store
*.local
.superpowers/
```

If different, do not modify — surface the discrepancy to the user before continuing.

- [ ] **Step 3: Initialize repo and stage everything**

```bash
git init
git add .
```

- [ ] **Step 4: Verify what's staged (sanity check — should be ~50-100 source files, no node_modules/dist)**

Run: `git status --short | wc -l`
Expected: a number under 200 (project has ~30 src files, plus docs, plus assets).

Run: `git status --short | grep -E "node_modules|dist/" | head -5`
Expected: empty output (nothing under those dirs should be staged).

If either check fails, stop and surface to the user.

- [ ] **Step 5: Create the baseline commit**

```bash
git commit -m "$(cat <<'EOF'
chore: baseline commit — project state before arcade physics retune

Initialize git repository. Captures three sessions of work:
- Storybook character art (Eloise + companions + enemies + boss)
- Blueprint mode + level sketch architecture
- Bedroom area fully encoded into 5 playable levels

Next commit: arcade physics retune per
docs/superpowers/specs/2026-05-25-arcade-physics-retune-design.md
EOF
)"
```

- [ ] **Step 6: Verify commit landed**

Run: `git log --oneline -1`
Expected: single line showing the new commit SHA + "chore: baseline commit..."

---

## Task 2: Update physics constants

**Files:**
- Modify: `src/config/physics.ts:6-19`

**What changes:** Three of the ten constants. `SPEED` from 100 → 125 (+25%), `JUMP_VELOCITY` from -260 → -310 (+19%), `STOMP_BOUNCE_VY` from -180 → -215 (+19%). Gravity constants stay as-is — the arc shape is preserved; only the magnitude scales.

- [ ] **Step 1: Re-read the current file to confirm starting state**

Run: `cat src/config/physics.ts`
Expected: matches what's shown in the spec's "Physics Constants" table (Current column).

If the constants have already drifted (e.g., someone changed `SPEED` to 110 mid-session), stop and surface to the user — the diffs below assume the documented starting values.

- [ ] **Step 2: Apply the three constant changes**

Edit `src/config/physics.ts`. Replace:

```typescript
export const PHYSICS = {
  SPEED: 100 * S,
  AIR_SPEED_MULT: 0.85,
  AIR_BLEND: 0.15,
  JUMP_VELOCITY: -260 * S,
  GRAVITY_UP: 600 * S,
  GRAVITY_APEX: 400 * S,
  GRAVITY_DOWN: 900 * S,
  /** When rising and |vy| below this, use apex gravity for hangtime. */
  APEX_VY_THRESHOLD: 40 * S,
  COYOTE_MS: 100,
  BUFFER_MS: 100,
  /** Release jump while rising: multiply upward vy by this (plan: halve). */
  VARIABLE_CUT: 0.5,
  STOMP_BOUNCE_VY: -180 * S,
  INVINCIBILITY_MS: 1500,
} as const;
```

With:

```typescript
export const PHYSICS = {
  SPEED: 125 * S,
  AIR_SPEED_MULT: 0.85,
  AIR_BLEND: 0.15,
  JUMP_VELOCITY: -310 * S,
  GRAVITY_UP: 600 * S,
  GRAVITY_APEX: 400 * S,
  GRAVITY_DOWN: 900 * S,
  /** When rising and |vy| below this, use apex gravity for hangtime. */
  APEX_VY_THRESHOLD: 40 * S,
  COYOTE_MS: 100,
  BUFFER_MS: 100,
  /** Release jump while rising: multiply upward vy by this (plan: halve). */
  VARIABLE_CUT: 0.5,
  STOMP_BOUNCE_VY: -215 * S,
  INVINCIBILITY_MS: 1500,
} as const;
```

- [ ] **Step 3: Run typecheck to confirm no compile errors**

Run: `npm run typecheck`
Expected: exit code 0, no output (or only warnings).

If errors appear, the constant values are scalars used in many places — the most likely cause is a typo (e.g., `12.5` instead of `125`). Read the error, fix in place, re-run.

---

## Task 3a: Update pattern legend in levelSketches.ts

**Files:**
- Modify: `src/design/levelSketches.ts:1-26` (the header docstring)

**What changes:** Pattern #8 in the legend renames from "2-Square Trust Gap" to "3-Square Trust Gap" with an updated parenthetical. No other pattern is size-dependent — all others are layout-shape patterns that survive physics changes unchanged.

- [ ] **Step 1: Apply the pattern legend edit**

Edit `src/design/levelSketches.ts`. Replace:

```
 *   8. 2-Square Trust Gap — first real pit, well inside jump envelope
```

With:

```
 *   8. 3-Square Trust Gap — first real pit, well inside jump envelope (3 cells = 96px, vs max ~120px)
```

- [ ] **Step 2: Run typecheck (catches any accidental syntax break in the docstring)**

Run: `npm run typecheck`
Expected: exit code 0, no errors.

---

## Task 3b: Update blueprint.ts header comment

**Files:**
- Modify: `src/config/blueprint.ts:1-13` (the JSDoc header)

**What changes:** Three numbers update in the envelope comment block, and the meta-rhythm line gets a precision adjustment.

- [ ] **Step 1: Apply the envelope numbers edit**

Edit `src/config/blueprint.ts`. Replace:

```
 *   - Max horizontal jump ≈ 75 design-px (~2.3 minor squares)
 *   - Max vertical apex   ≈ 55 design-px (~1.7 minor squares)
 *   - Eloise body height  ≈ 30 design-px (~1 minor square)
```

With:

```
 *   - Max horizontal jump ≈ 120 design-px (~3.75 minor squares)
 *   - Max vertical apex   ≈ 80 design-px  (~2.5 minor squares)
 *   - Eloise body height  ≈ 30 design-px  (~1 minor square)
```

- [ ] **Step 2: Apply the meta-rhythm line edit**

In the same file, replace:

```
 * One minor square = "is this within an Eloise body?" reference.
 * One major group (4 minor) = ~1.7 jumps — useful as a meta-rhythm marker
 * when laying out level chunks.
```

With:

```
 * One minor square = "is this within an Eloise body?" reference.
 * One major group (4 minor) = ~1.05 max-jumps — useful as a "just past max
 * jump reach" reference when laying out level chunks.
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

---

## Task 3c: Update CLAUDE.md Physics line

**Files:**
- Modify: `CLAUDE.md` (the "Physics:" bullet under "## Game Conventions")

**What changes:** The single line describing physics constants in the project-context doc gets updated envelope numbers and now spells out the gravity triple for at-a-glance reference.

- [ ] **Step 1: Apply the Physics line edit**

Edit `CLAUDE.md`. Replace:

```markdown
- **Physics:** Tuned constants in `src/config/physics.ts` — asymmetric gravity, coyote time (100ms), variable jump, max horizontal jump ≈ 75 design-px / max apex ≈ 55 design-px
```

With:

```markdown
- **Physics:** Tuned constants in `src/config/physics.ts` — asymmetric gravity (600 up / 400 apex / 900 down), coyote time (100ms), variable jump, max horizontal jump ≈ 120 design-px / max apex ≈ 80 design-px (~3.75 / ~2.5 grid cells)
```

- [ ] **Step 2: Verify the edit lives in the right section**

Run: `grep -n "Physics:" CLAUDE.md`
Expected: a single line number from inside the "## Game Conventions" section.

---

## Task 4: Retune bedroom pit widths

**Files:**
- Modify: `src/design/levelSketches.ts` (5 specific `pits:` arrays — see line numbers in spec)

**What changes:** Five of six pit-bearing variants get pit-width bumps. Slot 5 Variant B is intentionally left alone (it's the "chill victory lap" finale with a deliberately easy 1-cell pit).

Each edit is the exact contents of a `pits: [...]` line. The surrounding platforms, zones, spawn, exit, and dimensions stay unchanged.

- [ ] **Step 1: Edit Slot 4 Variant A pit (around line 392)**

Replace:

```typescript
        pits: [{ x: 12, w: 2 }],
```

With:

```typescript
        pits: [{ x: 12, w: 3 }],
```

- [ ] **Step 2: Edit Slot 4 Variant B pits (around lines 413-417)**

Replace:

```typescript
        pits: [
          { x: 5, w: 2 },
          { x: 15, w: 2 },
          { x: 19, w: 1 },
        ],
```

With:

```typescript
        pits: [
          { x: 5, w: 3 },
          { x: 15, w: 3 },
          { x: 19, w: 2 },
        ],
```

- [ ] **Step 3: Edit Slot 4 Variant C pit (around line 442)**

Replace:

```typescript
        pits: [{ x: 18, w: 2 }],
```

With:

```typescript
        pits: [{ x: 18, w: 3 }],
```

Note: there are multiple `pits: [{ x: 18, w: 2 }],` candidates in the file (different slots/variants may share that literal). Use the line-number anchor (~442) or surrounding context (the variant with `widthGrids: 24, heightGrids: 5`, platforms including `{ x: 13, y: 4, w: 3 }`) to disambiguate.

- [ ] **Step 4: Edit Slot 5 Variant A pits (around lines 483-486)**

Replace:

```typescript
        pits: [
          { x: 7, w: 3 },
          { x: 22, w: 2 },
        ],
```

With:

```typescript
        pits: [
          { x: 7, w: 3 },
          { x: 22, w: 3 },
        ],
```

- [ ] **Step 5: Skip Slot 5 Variant B (intentionally unchanged)**

Verify by reading: the variant around lines 506-533 should still have `pits: [{ x: 16, w: 1 }],`. No edit. Skip to next step.

Run: `grep -n "pits: \[{ x: 16, w: 1 }\]" src/design/levelSketches.ts`
Expected: a single line number around 518.

- [ ] **Step 6: Edit Slot 5 Variant C pit (around line 552)**

Replace:

```typescript
        pits: [{ x: 17, w: 2 }],
```

With:

```typescript
        pits: [{ x: 17, w: 3 }],
```

- [ ] **Step 7: Run typecheck to catch syntax errors**

Run: `npm run typecheck`
Expected: exit code 0, no output.

If errors, the most likely cause is a missing comma or bracket from one of the multi-line edits. Read the error line, fix in place.

- [ ] **Step 8: Verify pit-width changes via grep (pit-formatted entries only)**

Pits use `{ x: N, w: N }` shape; platforms use `{ x: N, y: N, w: N }` (has a `y:` field). The grep below isolates pit-shaped entries.

Run: `grep -nE '\{ x: [0-9]+, w: [0-9]+ \}' src/design/levelSketches.ts`
Expected: ~8 matches across the file (slot 4A pit, slot 4B's 3 pits, slot 4C pit, slot 5A's 2 pits, slot 5B's 1 pit, slot 5C pit). Visually inspect each line — every `w:` should be 3 except slot 5B's `{ x: 16, w: 1 }`.

Run: `grep -nE '\{ x: [0-9]+, w: 2 \}' src/design/levelSketches.ts`
Expected: 0 matches. If any appear, those are pit edits that didn't land — go back and fix.

---

## Task 5: Visual + build verification

- [ ] **Step 1: Final typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: exit code 0, "✓ built in Xs" message, `dist/` populated.

- [ ] **Step 3: Start dev server (background) and confirm it serves**

Run dev server in background. The Princess Eloise project has a `.claude/launch.json` registered for `preview_start`, so this is the canonical path:

Use `preview_start` (Claude Preview MCP) to launch the dev server registered in `.claude/launch.json`.

Expected: server starts, returns a preview URL (typically `http://localhost:5173/`).

If `preview_start` is unavailable, fall back to: `npm run dev` in a background terminal, then navigate to `http://localhost:5173/`.

- [ ] **Step 4: Visual check of /maps.html**

Navigate to `<preview-url>/maps.html`. Visually scan the bedroom area's slots 4 and 5.

Expected: each of the 5 edited variants shows its new pit width (slot 4A pit visibly 3-wide where it was 2; slot 4B has three pits at 3/3/2 widths; slot 4C pit 3-wide; slot 5A's right pit 3-wide; slot 5C pit 3-wide). Slot 5B's pit remains 1-wide.

If any variant shows the wrong width, return to Task 4 and re-check the edit for that variant.

- [ ] **Step 5: Playtest Level 1 — confirm physics feel**

Navigate to `<preview-url>/` (root, not /maps.html). Click to focus canvas, start a new game, enter Level 1.

Verify by feel:
- Jump apex is visibly bigger than memory of prior playtest (~50% more vertical headroom on a full jump)
- Walking speed is snappier (covers ground faster) but doesn't feel sprint-y
- Coyote time still forgiving (run off edge, jump still triggers)
- Arc shape feels familiar (floaty up, snappy down) — not mushy

If any of these feels off, do NOT proceed to commit. Note which constant feels wrong and surface to user. Likely small-number tweaks: e.g., if speed feels too fast, try `SPEED: 120` in physics.ts.

- [ ] **Step 6: Playtest Level 4 — confirm pit gating**

Reach Level 4 by playing through Levels 1-3 (or by selecting it via the menu if level-select is available). If progress from a prior session has already passed Level 4, `eloiseReset()` in the browser console clears `localStorage` so you start from Level 1 and replay. Walk through Level 4, jumping every pit.

Verify by feel:
- Each pit in slots 4A, 4B (×3), 4C registers as a real gap — you have to deliberately jump, not just hop
- No pit is unjumpable (3 cells = 96px, max jump ~120px, so margin exists)

If a pit is unjumpable, the physics constants need re-tuning (more apex or more horizontal speed) — surface to user.

- [ ] **Step 7: Playtest Level 5 — confirm 5B-vs-5A/5C contrast**

Enter Level 5. The level chains B → A → A → C variants in order.

Verify by feel:
- The 1-wide pit (Slot 5B section, early in the level) reads as the relaxed "victory walk" beat
- The 3-wide pits later in the level (Slot 5A and 5C sections) read as more deliberate jumps
- Teddy at the end is reachable

If Teddy isn't reachable, check Slot 5A's widened pit didn't shift the companion position — re-read the spec's "Knock-on effects verified" section.

- [ ] **Step 8: Stop dev server**

Use `preview_stop` to clean up. (If `npm run dev` was used directly, kill the background process.)

---

## Task 6: Atomic commit

**Why one commit:** Per spec design decision — rollback simplicity. If post-shipping playtest reveals the new feel is worse, a single `git revert` reverses everything.

- [ ] **Step 1: Review what's staged**

Run: `git status`
Expected output includes these modified files:
- `src/config/physics.ts`
- `src/config/blueprint.ts`
- `src/design/levelSketches.ts`
- `CLAUDE.md`

Plus new files (the spec and plan docs created earlier in the session):
- `docs/superpowers/specs/2026-05-25-arcade-physics-retune-design.md`
- `docs/superpowers/plans/2026-05-25-arcade-physics-retune.md`

If anything else is modified or new, inspect with `git diff <file>` before staging. Surface unexpected changes to the user.

- [ ] **Step 2: Stage the 4 source files + 2 docs**

```bash
git add src/config/physics.ts \
        src/config/blueprint.ts \
        src/design/levelSketches.ts \
        CLAUDE.md \
        docs/superpowers/specs/2026-05-25-arcade-physics-retune-design.md \
        docs/superpowers/plans/2026-05-25-arcade-physics-retune.md
```

- [ ] **Step 3: Verify exactly those 6 files are staged**

Run: `git diff --cached --name-only`
Expected: exactly 6 lines, matching the files above.

- [ ] **Step 4: Create the commit**

```bash
git commit -m "$(cat <<'EOF'
feat: arcade physics retune

Bump jump apex +50% (to ~2.5 Eloise body heights) and movement speed
+25% for a more arcadey feel. Update three doc surfaces that quote the
old jump envelope. Widen 5 pit-bearing bedroom variants whose old
2-cell pits would now read as trivial; intentionally leave Slot 5B's
1-cell pit (the chill victory lap variant) alone.

Three constants change in physics.ts:
- SPEED:           100 → 125
- JUMP_VELOCITY:  -260 → -310
- STOMP_BOUNCE_VY:-180 → -215

Gravity constants unchanged — arc shape preserved, only magnitude
scales up. New envelope: max horizontal jump ~120px (~3.75 cells),
max apex ~80px (~2.5 cells).

Spec: docs/superpowers/specs/2026-05-25-arcade-physics-retune-design.md
Plan: docs/superpowers/plans/2026-05-25-arcade-physics-retune.md
EOF
)"
```

- [ ] **Step 5: Verify the commit**

Run: `git log --oneline -2`
Expected: two lines — the new "feat: arcade physics retune" commit on top, the earlier "chore: baseline commit..." below.

Run: `git show --stat HEAD`
Expected: 6 files changed, with line counts (physics.ts will show small line changes, levelSketches.ts will show more from the pit edits + pattern legend, etc.).

---

## Done

After Task 6:

- Physics + docs + bedroom pits are all on `main` as a single atomic commit
- Rollback path: `git revert HEAD` (one operation)
- Future tuning: edit `src/config/physics.ts` in place; constants are scalars

The spec's acceptance criteria are all met if:
- [x] All 3 changing physics constants in the table match new values; the 7 unchanged are unchanged
- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] `/maps.html` shows new pit widths visually correct in slots 4 and 5
- [x] Playtest of Level 1 confirms bigger-jump + faster-move feel
- [x] Playtest of Level 4 confirms pits read as real gaps (not trivial hops)
- [x] Playtest of Level 5 confirms 5B-vs-5A-and-5C contrast (chill vs tense)
- [x] All three doc surfaces (levelSketches.ts header, blueprint.ts header, CLAUDE.md) updated to new envelope numbers
