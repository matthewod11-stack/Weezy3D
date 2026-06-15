# 3D Enemies + Companion Cameos — Design

> **Date:** 2026-06-12 · **Status:** approved, pre-plan
> **Playbook recipe:** `docs/3d-transition/weezy3d-playbook.md` §5.1 (enemies). This spec extends it with companion cameos.
> **Scope owner decision:** "Enemies, complete + companion cameos"; cameo effect = "heart bonus only (parity)".

## Goal

Make the 3D worlds actually playable as games, not just walkable dioramas. Port the **complete enemy system** (the biggest missing gameplay system) into the Three.js layer, and add **companion cameos** — collectible companion billboards that mirror 2D data without the (not-yet-ported) traversal powers.

Concrete win: **Bedroom 2–5 become fully playable in 3D** (they already encode dust bunnies; enemies were the only missing system), enemies appear across all worlds, and meeting Teddy grants his +1 heart.

## Context

**Current 3D state (post candy-revert, 2026-06-12):**
- All 5 worlds run as continuous stitched runs (`worldStitch.ts`, 17 tests); same `LevelData` + `PHYSICS` constants as 2D; billboard Eloise (`playerView.ts`); pure physics (`physics3d.ts`, 13 tests).
- **No enemies, no hearts, no companions in 3D.** `level3d.ts` has only a z-convention comment about future enemies. `worldStitch.ts` explicitly **drops** the companion (line ~20).
- Power-gated segments are impassable in 3D until the §5.4 powers port. **This spec does not change that** — bedroom (gate-free) becomes fully playable; gated worlds still hit the power wall mid-run.

**2D systems being mirrored (sources of truth):**
- `src/entities/Enemy.ts` — patrol: `vel = dir × speed`, flip at `patrolLeft/patrolRight`.
- `src/scenes/GameScene.ts` `handleEnemyOverlap` / `isStomp` — stomp = player falling + feet above enemy top ⇒ `defeat()` + `stompBounce()`; else (not invincible) ⇒ `applyDamage()`.
- `src/config/physics.ts` — `STOMP_BOUNCE_VY = -215·S`, `INVINCIBILITY_MS = 1500`.
- `src/types/level.ts` — `EnemySpawn { type: "dustBunny"|"spider"|"ant"|"dustMite", x, y, patrolLeft, patrolRight, speed=40 }`; `companion { type: "teddy"|"dog"|"cat"|"horse"|"flamingo", x, y }` (optional, one per level).
- `src/config/companions.ts` — `COMPANIONS[type] = { area, grants, idleKey, walkKey, heartBonus?, metAtStart? }`. Only **teddy** has `heartBonus: 1`.
- `src/state/GameState.ts` — 2D hearts (`hearts=3`, `maxHearts=3`, `+= heartBonus`). **The 3D layer will NOT use GameState** — it tracks its own hearts to stay Phaser-free.

## Architecture

Mirror the codebase's proven split: **pure logic module + thin view + tests** (the `physics3d`/`playerView` pattern). Rejected alternative: a single combined `enemies3d.ts` (patrol+view+hearts) — fewer files, but breaks the purity/testability discipline that made every prior port fast.

### Components

| File | Kind | Responsibility |
|---|---|---|
| `src/three/enemy3d.ts` | **pure**, render-px | Enemy state + `stepEnemies()`: patrol, gravity/ground rest, stomp-vs-damage classification. Returns events; owns no rendering, no hearts. |
| `src/three/enemy3d.test.ts` | tests | Patrol turnaround, stomp-vs-damage discrimination, invincibility gate, multi-enemy step. Pins enemy feel to 2D parity. |
| `src/three/enemyView.ts` | thin view | Billboard plane per enemy (sprite map by type), foot-plant, 2-frame walk where frames exist, flip on dir, hide on defeat. |
| `src/three/companionView.ts` | thin view | One idle companion billboard at its spawn, gentle bob. |
| `src/three/worldStitch.ts` | **pure** (edit) | Preserve the single companion across stitched segments (offset x), instead of dropping it. New test. |
| `src/three/hud.ts` | DOM (edit) | 3-heart row; brief "You met {Name}!" caption. |
| `src/three/main.ts` | loop (edit) | Own hearts/invincibility/respawn; drive `stepEnemies` → apply bounce/damage → `enemyView.sync` → companion overlap → `hud`. |
| `src/three/level3d.ts` | no change expected | Enemies/companions are flat actors wired by `main.ts` (exactly as tokens/exit already are); `level3d` stays mesh-only. Touch only if extracting a shared billboard-factory helper proves worthwhile. |

### Enemy state + step (pure)

```
EnemyState { type, x, y, vx, vy, dir, patrolLeft, patrolRight, speed, w, h, defeated }
stepEnemies(enemies, player, dtMs) -> { stomps: number[] /*indices defeated this step*/, damaged: boolean }
```
- AABB `w, h` come from a per-type constant (mirroring the 2D body sizes), set when constructing `EnemyState` from an `EnemySpawn`.
- Patrol + gravity + ground rest in render-px y-down space (same space as `physics3d`).
- Per live enemy, classify overlap with player AABB exactly like `isStomp`: player `vy > 0` (falling) and player feet above enemy top band ⇒ stomp (mark defeated, set `result.stomps`); else AABB overlap ⇒ `result.damaged = true`.
- The caller (main) decides what stomp/damage *do* — `stepEnemies` only classifies. Invincibility is enforced by the caller passing player state / ignoring `damaged` while invincible (tested both ways).

## Data flow (main loop, per frame)

1. `physics3d.stepPlayer(...)` (unchanged).
2. `const ev = stepEnemies(enemies, player, dt)`.
3. For each `ev.stomps`: hide that enemy (view), set `player.vy = STOMP_BOUNCE_VY`.
4. If `ev.damaged && now >= invincibleUntil`: `hearts -= 1`, `invincibleUntil = now + INVINCIBILITY_MS`. If `hearts <= 0`: respawn at current segment checkpoint + `hearts = maxHearts` (reuse existing pit-respawn path).
5. `enemyView.sync(enemies)` — positions, facing, walk frame, visibility, invincibility blink on player.
6. Companion overlap (token-like): if not yet met and AABB overlaps ⇒ mark met, `maxHearts += def.heartBonus ?? 0`, `hearts = min(hearts+bonus, maxHearts)`, `hud` caption, hide/settle the billboard.
7. `hud.update(hearts, maxHearts, collected, companionCaption)`.

## Conventions honored
- **z = 0 glass pane (§2):** enemy + companion billboards are flat actors at **+0.06**; never centered boxes.
- **Simulate in render-px, convert only at render:** all enemy/hearts logic in render px; `coords.ts` is the only bridge.
- **Don't fork the design:** enemy/companion data comes from `LevelData` (sketch→encode→stitch). No hand-authored geometry.
- **Purity:** pure modules (`enemy3d`, `worldStitch`) carry tests; views are thin.

## Companion cameo — behavior (heart-bonus parity)
- Billboard at spawn (idle frame + bob). Collect on overlap.
- On collect: mark met, apply `heartBonus` only (Teddy +1 max heart; others none), brief "You met {Name}!" caption.
- **No traversal power, no follow-trail, no scripted cutscene.** §5.4 powers port later swaps the collect hook from "heart-only" to "grant the real ability".

## Scope boundaries
**In:** 4 enemy types, every world; patrol + stomp-defeat + contact damage + 3-heart HUD + invincibility + death→checkpoint-respawn; companion billboard + collect + heartBonus.
**Out (deferred):** traversal powers (§5.4, keeps power-gated segments impassable); companion follow-trail; scripted cutscene; enemy death particles (just hide); knockback; sound.

## Testing & verification
- New `enemy3d.test.ts`; new `worldStitch` companion-preservation test.
- Keep green: 13 `physics3d` tests, 17 `worldStitch` tests, full suite (currently 366), `npm run build` gate.
- In-browser via `__weezy3d`: stomp a dust bunny (it hides, player bounces ~`STOMP_BOUNCE_VY`); take a contact hit (a heart drops, blink for 1.5s); drain to 0 → respawn at checkpoint with full hearts; meet Teddy → +1 heart + caption. Screenshots are the deliverable for the visual pieces.

## Open / deferred
- **§5.4 powers** (double-jump/dash/wall-climb/charge/glide) — the next coupled port; unblocks gated segments and turns cameos into real grants.
- Enemy death polish (puff/particles), companion follow-trail, sound — polish backlog (§5.5).
