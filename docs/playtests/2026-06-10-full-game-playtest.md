# 3D Full Playtest — 2026-06-10

**Tester:** Matt (human at keyboard) · **Build:** 349 tests green, typecheck clean
**Scope:** All 5 worlds as continuous runs (`/3d.html?world=bedroom|hallway|kitchen|familyRoom|backyard`), built mid-session from the META finding below.
Traversal + tokens only — enemies/companions/powers/boss not yet ported (playbook §5.1/§5.4).
**Known wall:** power-gated segments (hallway 4+, kitchen climb, familyRoom 5, backyard 3+) are impassable until powers port; bedroom is gate-free end-to-end.
**Maps to:** Playbook "next session could" #1 — feel-playtest all worlds by hand

## Notes (raw, as reported)

<!-- Notes land here as Matt reports them, tagged by world/level when known -->

## META — World structure / progression feel

- **"I thought bedroom would be 1 continuous level (0–4) as opposed to separate ones. Same goes for every other world. 'Finishing' then showing up right back in the same world again doesn't feel like progression."**
  - Expectation: one continuous traversal per world; reality: 5 discrete catalog levels with a modal win card between each.
  - Compounding factors: identical set dressing across all 5 levels of a world (per-level hero variation is a known §5.3 gap), win card is debug-flow not diegetic, no "level 2 of 5" / world-progress signaling.
  - **Decision (in-session): build true continuous worlds** — load-time stitch of each world's 5 LevelData into one run; intermediate doors removed; segment checkpoints; win card only at world end.
  - **Time-to-complete correction:** authored estimates over-index — all of bedroom together is ~4 min or less at real play speed. Short worlds make continuous viable for the 4–8 audience.

## Per-World

### Bedroom (levels 0–4) — warm lamp rig, bookshelves
-

### Hallway (levels 5–9) — cool/liminal, end-window light
-

### Kitchen (levels 10–14) — stove hero light, subway tile
-

### Family Room (levels 15–19) — fireplace flicker, sofa mountain
-

### Backyard (levels 20–24) — outdoor rig, hedgerow, sky
-

## Cross-Cutting (physics feel, camera follow, fog density, HUD, win-card flow)
-

## Verdicts
<!-- Filled at session end: ship / fix-now / backlog per finding -->
