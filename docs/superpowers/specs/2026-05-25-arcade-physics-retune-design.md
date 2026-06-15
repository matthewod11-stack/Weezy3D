# Arcade Physics Retune — Design Spec

**Date:** 2026-05-25
**Project:** Princess Eloise (Weezy2)
**Status:** Approved by user, ready for implementation plan

## Goal

Make the game feel more arcadey: bigger jumps, slightly faster movement. Preserve the existing asymmetric-gravity arc shape — just scale the magnitudes. Then absorb the cascading effects on level design before art-binding begins.

Three coupled changes:

1. **Physics constants** in `src/config/physics.ts` — bump `JUMP_VELOCITY`, raise `SPEED`, scale `STOMP_BOUNCE_VY` proportionally. Gravity stays as-is so the arc shape doesn't change, only its magnitude does.
2. **Pattern envelope docs** — update the three surfaces that quote the old jump envelope so the team-of-one's mental model stays correct.
3. **Bedroom retune** — widen the 5 pit-bearing variants where the old 2-cell "trust gap" pattern would now read as trivial. One variant (Slot 5B, the chill victory lap) is intentionally left alone.

This work happens **before** backgrounds are redone so level dimensions are locked before art binds to them.

## Why now

The user playtested the existing physics, found them passable but not exciting, and explicitly flagged this work as a prerequisite to backgrounds: *"this adjusts scale of platforms. better to work through this now before we do backgrounds."* Doing physics + level retune now means art assets only need to fit one geometry, not two.

## Design Decisions

### Jump apex: +50% (target ~2.5 Eloise body heights)

Picked over +18% (too mild to feel different) and +80% (too dramatic, would require widening level vertical bounds and reworking platform stacks). Lands the max-jump apex at ~80 design-px = 2.5 grid cells, comfortably within existing `bounds.minY` headroom of every bedroom variant.

### Move speed: +25% (100 → 125 design-px/s)

Picked over +15% (subtle bump only) and +50% (sprint territory, would require substantial bedroom rework). Max horizontal jump lands at ~120 design-px = **~3.75 grid cells** (just under one major-grid group), close enough to use major-grid lines as a "near-max-jump" sketching reference.

### Cascade scope: physics + pattern envelope + bedroom retune

Picked over physics-only (defers thinking; revisit-cost from cold context later is higher than doing it now) and physics + pattern docs only (would let Slot 4 and 5 pits read as trivial hops; bedroom is the area kids spend most time in for area-1).

## Physics Constants

**File:** `src/config/physics.ts`

| Constant | Current | New | Delta | Why |
|---|---|---|---|---|
| `SPEED` | 100 | **125** | +25% | Snappier walk feel without becoming sprint-y |
| `JUMP_VELOCITY` | -260 | **-310** | +19% | Apex grows from ~57px to ~81px (= 2.5 body heights) |
| `GRAVITY_UP` | 600 | 600 | 0 | Unchanged — preserves current arc shape, only the magnitude scales |
| `GRAVITY_APEX` | 400 | 400 | 0 | Unchanged — hangtime mechanic stays identical |
| `GRAVITY_DOWN` | 900 | 900 | 0 | Unchanged — fall snap stays the same so it doesn't feel mushy |
| `APEX_VY_THRESHOLD` | 40 | 40 | 0 | Unchanged |
| `VARIABLE_CUT` | 0.5 | 0.5 | 0 | Unchanged |
| `STOMP_BOUNCE_VY` | -180 | **-215** | +19% | Scales with `JUMP_VELOCITY` so stomp chains keep relative power |
| `COYOTE_MS` / `BUFFER_MS` | 100 / 100 | 100 / 100 | 0 | Kid-friendly forgiveness preserved |
| `AIR_SPEED_MULT` | 0.85 | 0.85 | 0 | Air-control feel is fine |

**Three constants actually change:** `SPEED`, `JUMP_VELOCITY`, `STOMP_BOUNCE_VY`. The arc shape (the gravity ratios that give the current Mario-school "floaty up, snappy down" feel) is preserved as-is — only the magnitude scales up.

**Resulting envelopes (computed with the two-phase apex-zone integration):**

- Max horizontal jump: ~120 design-px = **~3.75 grid cells** (was ~82px / ~2.6 cells)
- Max vertical apex: ~81 design-px = **~2.5 grid cells** (was ~57px / ~1.8 cells)
- Eloise body height: ~30 design-px = ~1 grid cell (unchanged — grid stays at 32px)

Note: the existing `blueprint.ts` comment says "max horizontal ~75 px" — that's a conservative approximation of current physics (real max is ~82 px). The new envelope is calculated the same way; if it reads as ~120 px in the comment it matches the same approximation style.

## Pattern Envelope Doc Updates

Three surfaces reference the old envelope; all need updating so future level-design sessions don't operate on stale numbers.

### 1. `src/design/levelSketches.ts` header — pattern legend

Rename pattern #8 from "2-Square Trust Gap" to **"3-Square Trust Gap"** and update description:

> 8. 3-Square Trust Gap — First real pit, well inside jump envelope (3 cells = 96px, vs max ~120px).

No other pattern is size-dependent (the rest are layout-shape patterns: Staircase, Breadcrumb, Patroller Gate, Companion Beacon, etc.) — leave the other 14 unchanged.

### 2. `src/config/blueprint.ts` header comment

Replace the envelope block with:

```
- Max horizontal jump ≈ 120 design-px (~3.75 minor squares)
- Max vertical apex   ≈ 80 design-px  (~2.5 minor squares)
- Eloise body height  ≈ 30 design-px  (~1 minor square)
```

And update the meta-rhythm line:

> One major group (4 minor) = ~1.05 max-jumps of distance — useful as a "this is just past max jump" reference when laying out level chunks.

(Old line said "~1.7 jumps". Major-grid lines now mark *just past* max-jump reach, which is still a useful sketching reference — "if I want a jump to be reachable, keep it inside a major group.")

### 3. `CLAUDE.md` — "Physics" line under Game Conventions

Replace:

> Physics: Tuned constants in `src/config/physics.ts` — asymmetric gravity, coyote time (100ms), variable jump, max horizontal jump ≈ 75 design-px / max apex ≈ 55 design-px

With:

> Physics: Tuned constants in `src/config/physics.ts` — asymmetric gravity (600 up / 400 apex / 900 down), coyote time (100ms), variable jump, max horizontal jump ≈ 120 design-px / max apex ≈ 80 design-px (~3.75 / ~2.5 grid cells)

## Bedroom Retune

**File:** `src/design/levelSketches.ts`, the `BEDROOM_SLOTS` array.

Six variants have pits. Five get pit-width edits; one is intentionally untouched.

| Slot | Variant | Current pits | New pits | Reason |
|---|---|---|---|---|
| 4 | A | `[{x:12, w:2}]` | `[{x:12, w:3}]` | "First real pit" — keep it real |
| 4 | B | `[{x:5,w:2}, {x:15,w:2}, {x:19,w:1}]` | `[{x:5,w:3}, {x:15,w:3}, {x:19,w:2}]` | "Pit gauntlet" loses identity if all pits are trivial hops |
| 4 | C | `[{x:18, w:2}]` | `[{x:18, w:3}]` | "Single trust gap" — same logic as 4A |
| 5 | A | `[{x:7,w:3}, {x:22,w:2}]` | `[{x:7,w:3}, {x:22,w:3}]` | First pit already 3-wide; second pit needs the bump |
| 5 | B | `[{x:16, w:1}]` | **unchanged** | "Chill victory lap" variant — 1-wide pit is intentionally easy |
| 5 | C | `[{x:17, w:2}]` | `[{x:17, w:3}]` | Bookend reprise — pit punctuates the climb, needs to register |

**Knock-on effects verified:**

- **Slot 5A widening:** new pit ends at x=25, where enemy `{x:25, y:0}` sits. The encoder's `derivePatrolBounds` will clamp patrol-left to x=25.25 — enemy stays put on a thin floor strip beside the pit, which is the intended "land near a stomp" beat.
- **Level widths:** unchanged — all pits widen into existing floor, not past level edges.
- **Companion/exit positions:** unaffected.
- **Slot 4C exit (x=23) vs new pit (x=18-21):** leaves 2 cells of floor between pit and exit. Reads as the intended rest beat before the door.

**Explicitly NOT changing:**

- Vertical platform layouts (still well-spaced; new max apex of 2.5 cells still doesn't trivialize the y=4/y=5/y=6 climbs that span 3+ cells)
- Token positions (high-route rewards still feel rewarding; backtrack tokens still require routing)
- Enemy positions (patrol-bound logic absorbs pit edits automatically)
- B-A-A-C ordering, level widths, or pattern citations

## Verification

No test suite for this project. Verification is mechanical gates + manual playtest.

### Mechanical gates

1. `npm run typecheck` — clean
2. `npm run build` — clean
3. `http://localhost:5173/maps.html` — new pit widths render correctly in all 5 bedroom levels; visually scan slots 4 and 5

### Playtest checks

| Check | What to verify | Where |
|---|---|---|
| Jump arc | Bigger apex visible; reads as "more arcadey" not "spongier" | Level 1 |
| Move speed | Snappier without feeling sprint-y; coyote time still forgiving at edges | Level 1 |
| Bedroom 1-3 (pit-free) | Still playable; staircase reads as comfortable not trivial | Levels 1, 2, 3 |
| Bedroom 4 (first-pit) | Each variant's pit registers as a real gap requiring a deliberate jump | Level 4 (load-bearing playtest) |
| Bedroom 5 (finale) | 3-cell pits feel earned after 4; Slot 5B's 1-wide pit reads as the victory-walk beat | Level 5 |
| Stomp chains | Stomp-bounce launches Eloise meaningfully higher than ground-jump | Any slot with enemies |

### Out of scope

- No regression test added (no test infrastructure exists; building it for one tuning pass is performative)
- No telemetry (kid testers are the metric; this is vibes-based)
- Camera zoom (separate concern; last session confirmed 0.5 feels right)

### Rollback path

Single commit captures physics + docs + bedroom pits. If post-playtest verdict is "worse than before," `git revert` (once the repo is initialized) or manual diff-reverse is one operation. Constants are scalars in one file — easy to tweak in place during playtest if numbers feel slightly off (e.g., +25% speed might want to land at 120 instead of 125).

## Files Touched (summary)

| File | Change |
|---|---|
| `src/config/physics.ts` | 3 constants updated (SPEED, JUMP_VELOCITY, STOMP_BOUNCE_VY) |
| `src/design/levelSketches.ts` | Pattern #8 description in header; pit widths in 5 variants |
| `src/config/blueprint.ts` | Header comment block (envelope numbers + meta-rhythm line) |
| `CLAUDE.md` | Physics line under Game Conventions |
| `PROGRESS.md` | New session entry at top (post-implementation) |

Five files total. Single atomic commit.

## Acceptance Criteria

- [ ] All 3 changing physics constants in the table match the new values; the 7 unchanged constants are verified unchanged
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Maps page at `/maps.html` shows new pit widths visually correct in slots 4 and 5
- [ ] Playtest of Level 1 confirms bigger-jump + faster-move feel
- [ ] Playtest of Level 4 confirms pits read as real gaps (not trivial hops)
- [ ] Playtest of Level 5 confirms 5B-vs-5A-and-5C contrast (chill vs tense)
- [ ] All three doc surfaces (levelSketches.ts header, blueprint.ts header, CLAUDE.md) updated to new envelope numbers
