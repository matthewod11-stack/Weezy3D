# Weezy3D Playbook — State, Conventions, and Learnings

> **What this is:** The working playbook for the 3D port, written after the first build session (2026-06-09, Fable 5). Read this first in any new session — it captures what exists, the conventions that must hold, the gotchas already paid for, and the recipes for the next ports. Companion docs: `2d-to-3d-guide.md` (the original strategy, still accurate) and `../art-direction/scenery-prompt-library.md` (per-world visual specs).
>
> **Repo context (updated 2026-06-15):** Weezy3D began as an untracked copy of Weezy2, but it's now **git-tracked and the canonical home for the 3D game** — the user works exclusively here. The **2D Phaser game was removed** (commit 44e098c); the Three.js game in `src/three/` is the whole game now. Reusable Phaser-free logic was kept in `src/logic/` (airJump, powerDispatch, bossFight, cutscene, menuSelection, aim/breakable/climb helpers). The 2D game lives in a separate repo.

---

## 1. Current State (updated 2026-06-15, session 7)

**All 5 worlds are playable as CONTINUOUS runs** at `http://localhost:5173/3d.html?world=bedroom|hallway|kitchen|familyRoom|backyard` (or a 0-based index; default bedroom). Session 3 (2026-06-10) stitched each world's 5 catalog levels into ONE LevelData at load time — `src/three/worldStitch.ts`, a pure unit-tested transform (17 tests): platforms/tokens/zones offset by cumulative width, intermediate exit doors dropped (only the world-end door wins), flush floor seams coalesced into single solids, former level boundaries kept as **pit-death checkpoints** + the HUD's "Bedroom · 2 / 5" progress label. Bedroom = 33,152 render px, 125 tokens, one run. `?level=n` (0..24) survives as a back-compat alias: loads the containing world spawned at that segment. Win card says "World Complete!" and chains "Next world →". Driven by the 2026-06-10 playtest meta-finding ("separate levels in the same room don't feel like progression"). Dev server: `npm run dev`, or `preview_start` → "Game Dev Server".

**All 5 traversal powers are live in 3D (§5.4 ✅, 2026-06-15 session 7)** — double-jump, dash, wall-climb (Up/stick), charge, glide. All 5 non-boss worlds are now playable end-to-end. Abilities are seeded 3D-local per run via `abilitiesForArea(world.areaId)`; companion-collect grants real abilities. The former per-world gate blocking (hallway needing double-jump, kitchen needing wall-climb + dash, etc.) is resolved.

Session 2 (2026-06-09 evening) added the **world theme registry** (`worldThemes.ts`: fog + set builder + gameplay-surface skin per `areaId`, bedroom fallback) and four new world sets — Hallway (cool/liminal, end-window light), Kitchen (stove hero light, breathing via `update` hook), Family Room (fireplace flicker — first animated light), Backyard (outdoor rig: HemisphereLight, real-sky background override, hedgerow instead of a wall). Spec: `docs/superpowers/specs/2026-06-09-3d-world-backgrounds-design.md`.

Session 5 (2026-06-12) **shipped enemies + companion cameos (§5.1 ✅)**: all 4 enemy types patrol/stomp/damage with 2D-parity semantics (`enemy3d.ts` pure + 9 tests, `enemyView.ts` billboards), ❤️ hearts HUD + invincibility blink + death→checkpoint respawn, companion preserved through the stitcher + collectible for its `heartBonus` (Teddy +1; caption "You met Teddy!"). **Bedroom became FULLY playable as a game in 3D** (23 dust bunnies + Teddy). Spec: `docs/superpowers/specs/2026-06-12-3d-enemies-companions-design.md`. (Same session: the pass-2 candy re-theme was reverted in full — see §5.6.)

Session 7 (2026-06-15) **shipped all 5 traversal powers (§5.4 ✅)**: double-jump, dash, wall-climb, charge, glide — all live in `physics3d.ts` via an optional `PowerEnv` + extended `FrameInput`. `level3d.ts` now renders climb walls + breakables. Abilities 3D-local via `abilitiesForArea`. All 5 non-boss worlds playable end-to-end. Spec: `docs/superpowers/specs/2026-06-15-3d-powers-design.md`.

- Walk (←→/A-D), jump (Space), **+ gamepad** (`src/three/gamepad.ts`; 8BitDo SN30 Pro mapped — see §3 gotcha 14 + the file table), 24 collectible star tokens, glowing exit door → win card → replay.
- Same `LevelData` and same `PHYSICS` constants the 2D game used — now the shared source of truth here.
- Full gate green: `npm run build` = tsc + **416 Vitest tests** + 2-page Vite build (`/maps.html`, `/3d.html`). (The 2D `/` entry was removed 2026-06-15.)
- Verified in-browser by driving the sim (`__weezy3d.setSimInput`): jump apex **74 design px** (2D envelope ~80), full run → exit at x≈5562 → win → replay reset. Zero console errors.
- **Weezy3D is the game now** (2D Phaser removed 2026-06-15) — not a parallel layer. The kept Phaser-free logic moved to `src/logic/`.

### The 3D layer (`src/three/`, no Phaser imports anywhere)

| File | Role | Notes |
|---|---|---|
| `physics3d.ts` | Pure AABB platformer physics | The `bossFight.ts` pattern: pure logic, unit-tested. Simulates in **render px, y-down** — the exact space of scaled `LevelData`. Ports asymmetric gravity / coyote / buffer / variable-cut / air-blend from `PHYSICS` verbatim. |
| `physics3d.test.ts` | 13 tests pinning the feel | Jump apex 70–92 design px, coyote window, buffered jump, walls/ceilings/landing, substep flag accumulation. **If these pass, the 3D jump feel = the 2D jump feel.** |
| `coords.ts` | The ONLY 2D↔3D conversion boundary | 1 world unit = 1 sketch grid (64 render px). Floor top = world y 0. One y-flip lives here and nowhere else. |
| `input.ts` | Keyboard → `FrameInput` | Edge accumulation between rAF ticks; **repeat keydowns never establish held state** (see Gotchas). |
| `gamepad.ts` | Gamepad → `FrameInput` | Pure `readGamepadFrame()` + thin `GamepadInput` shell (15 tests). Standard pads use D-pad buttons 14/15; **non-standard pads (8BitDo SN30 Pro, `mapping:""`) decode the D-pad from the HID hat on axis 9**. Stick = axis 0, jump = button 0. OR-merged with the keyboard in `main.ts`. |
| `playerView.ts` | Eloise as storybook billboard | HD-2D Option A. Ports the `computeFeetOriginY` bottom-alpha scan so feet plant on platforms. Walk 10fps / jump pose / mirror-flip. Ground-cast shadow blob (analytic, doubles as landing affordance). |
| `level3d.ts` | `LevelData` → meshes | Floor = deep carpet-textured boxes; shelves = wood boxes + lip; tokens = spinning extruded stars; exit = glowing door + breathing PointLight. **Owns the z-depth convention (§2).** |
| `bedroomSet.ts` | World 1 set dressing | All procedural, palette-locked, deterministic (seeded LCG — no `Math.random`). Wallpaper/windows/bookshelves/toys/crayons + the full lighting rig. |
| `hud.ts` | DOM overlay | Token counter, controls hint, win card (+ "Next level →" when one exists). No framework. |
| `main.ts` | Boot + game loop | `?level=n` select over `LEVEL_CATALOG`, theme wiring, camera follow w/ ported look-ahead, pickups, exit, kill plane, resize, `__weezy3d` debug handle. |
| `worldThemes.ts` | areaId → theme registry | `WorldTheme` = fog/background + `buildSet(minX,maxX): WorldSet` + `WorldSurfaces` (floor texture, platform/lip colors). `WorldSet` carries `sunOffset` (per-world key angle) and optional `update(dt, elapsed)` (animated lights). Unknown area → bedroom fallback. Coverage + fogNear≥12 rule pinned in `worldThemes.test.ts`. |
| `hallwaySet.ts` | World 2 set | Cool/liminal: stripe wall, framed photos, bench, shoe-rack canyons, runner on the floor, bright end-window + cool key from the right. Plank floor. |
| `kitchenSet.ts` | World 3 set | Subway tile, counter runs w/ chrome edges, fridge, **the stove** (hero PointLight, breathes via `update`). Hard overhead key, low ambient. Terracotta tile floor. |
| `familyRoomSet.ts` | World 4 set | Sofa mountain, entertainment center, **fireplace** (ember+core panes, flicker via `update` — two incommensurate sines), fire-glow pools. Thick carpet floor. |
| `backyardSet.ts` | World 5 set | The outdoor rig: hedgerow (no wall) + sky `background` override, HemisphereLight replaces ambient, sun 1.4, playset/sandbox/grass clumps, foreground blades. Grass floor. |

---

## 2. Conventions (these must hold for every future element)

### The diorama "glass pane": z = 0 is the front face
**The one bug a playtester caught in session 1** was Eloise rendering behind platforms. The fix is a convention, not a patch:

- **All solid gameplay geometry extends BACKWARD from z = 0.** Shelf boxes span −1.7→0. The exit door frame is pulled back to end at 0. A box centered on z=0 WILL occlude the player.
- **Flat actors float just in front:** player billboard at **+0.06**, tokens at **+0.15**, shadow blob at **−0.3** (tucked back so it never overhangs a platform's front edge).
- Future elements — enemies, climb walls, breakables, companions — follow the same rule: solids end at 0, billboards ride +0.05..0.2.
- Depth cheat-sheet (world z): wallpaper −8 · bookshelves −5 · toy clutter −2.6 · **gameplay 0** · foreground crumbs +1.9 · camera +10.5.

### Coordinates: simulate in 2D space, convert only at render
- Physics, level data, pickups, kill plane — all in **render px, y-down** (floor at 336). This means `LevelData` feeds the sim with zero translation and the 2D constants stay meaningful.
- `coords.ts` is the single bridge: `toWorldX/Y/Len`, `rectCenterWorld`. If you're converting coordinates anywhere else, stop and use it.
- 1 world unit = 1 sketch grid = one Eloise body height. Fog/camera/lighting numbers in the scenery library are in these units and Just Work.

### Purity discipline (inherited from Weezy2, keep it)
- Game logic = pure modules with tests (`physics3d.ts`). Rendering = thin shells that read sim state (`playerView`, `level3d`). This pattern (now in `src/logic/{bossFight,cutscene,powerDispatch,…}` + `src/levels/reachability`) is why ports go fast — and why removing the 2D Phaser game was clean (the logic had no Phaser to drag along).
- Procedural dressing uses a **seeded LCG**, never `Math.random` — renders are reproducible, screenshots comparable across sessions.

### Don't fork the design
- Level data comes from the sketch → encode pipeline (`LEVEL_CATALOG` / `BEDROOM_LEVELS[n]`). Edit levels in `src/design/levelSketches.ts` like always — the 3D game (and `maps.html`) consume the result. Never hand-author level geometry in the 3D layer.

---

## 3. Gotchas already paid for (don't re-derive these)

1. **`node_modules/.bin` was entirely broken** — regular files instead of symlinks (artifact of file-copying the repo from Weezy2). Symptom: `Cannot find module '…/dist/cli.js'` from any CLI. Fix: `rm -rf node_modules && npm install`. Already done; remember if the repo gets re-copied.
2. **The IDE preview browser has a stuck-key artifact**: it emits `ArrowRight` keydowns with `repeat:true` and *no initial press*, which made Eloise self-walk. `input.ts` now ignores repeats for held-state. If a character ever "walks on its own," check for this class of input before suspecting physics.
3. **Physics substeps ate one-frame flags.** `justJumped`/`justLanded` were overwritten by later substeps within one `stepPlayer` call; they now accumulate (OR) across substeps. The test "reports justLanded exactly once" pins it.
4. **Camera-lerp screenshots lie.** After a `teleport()`, the camera eases for ~1–1.5s; a screenshot taken too early shows the wrong part of the level with no player and looks like a catastrophic bug. Always settle-poll (player x stable >1.5s) before screenshotting.
5. **You may be sharing controls with a live player.** During verification the user was actively playing while the agent teleported her around. If state changes you didn't cause (token count moving, position drift), check whether the human is playing before debugging. Prefer `setSimInput` bursts + immediate release to long holds.
6. **The post-edit TS hook races multi-edit batches** — it typechecks after *each* edit, so "unused variable" errors mid-batch are expected noise. Confirm with a final `npx tsc --noEmit` instead of reacting to the first hook error.
7. **Exit can be jumped over.** The door zone is ~1.6 grids tall; jump-spamming through it can clear it, run off the level end, and kill-plane respawn. Inherited from the 2D data (same zone), low priority, but don't "discover" it as a new bug.
8. **A hidden preview tab pauses `requestAnimationFrame`** — the sim freezes (teleports apply, but nothing steps; "the player won't walk" is NOT a physics bug). Each `preview_screenshot` forces one frame (≤50ms sim). Workarounds that ship in the debug handle: `snapCamera()` (skip the camera ease — kills the gotcha-#4 settle wait), teleport-*into*-the-exit-zone for win-path checks (one forced frame triggers it).
9. **Screenshot JPEGs cannot resolve small lighting changes** (±30% intensity on dark albedo reads identical). Don't loop on screenshots — query `__weezy3d.scene` numerically: `scene.traverse(o => …)` for light intensities and material colors. This also *proved* the flicker hook runs (fire intensity ≠ base mid-frame).
10. **The 2D encoder stamps blueprint-placeholder colors (`#d4a574`/`#e8c9a0`) on EVERY platform in EVERY world** — they are not art direction. `level3d.ts` deliberately ignores `p.color`; the theme's `WorldSurfaces` owns the 3D look (bedroom's defaults equal the placeholders, so World 1 is unchanged).
11. **Coplanar glow panes z-fight.** A `MeshBasicMaterial` pane placed exactly on another mesh's front face renders as stripe garbage (kitchen oven window, frame face at +0.81). Offset glow panes ~0.05+ clear of the surface behind them.
12. **Every hide path needs a symmetric show path across level reset.** `resetLevel` rebuilds STATE (enemies, hearts) but views persist — a mesh hidden on defeat stays hidden forever unless the live path re-asserts `visible = true`. Caught in review as invisible-but-damaging enemies after "Play again"; same class applies to any future toggled visual (one-frame flags, blink states, settled bobs). Pattern: views re-derive ALL visual state from sim state every frame, never latch it.
13. **`@types/node` poisons DOM timer typings.** With it in devDeps (leftover from the deleted gen-texture script), `ReturnType<typeof window.setTimeout>` resolves to Node's `Timeout`, which doesn't accept the browser's `number`. Use an explicit `number | null` for DOM timer ids (see `hud.ts` captionTimer).
14. **Gamepad input can't be auto-verified through the preview.** `navigator.getGamepads()` only returns a pad to a **focused** tab (and only after its first button press), and gotcha #8 (hidden tab freezes rAF) means even `setSimInput` reads as frozen when backgrounded — so an automated "press → did the player move" check fails when the tab isn't focused. **Verify controllers on real hardware, tab focused.** Unit-test the pure mapper for logic; `window.__weezy3d.gamepad()`/`gamepadConnected()` expose live pad state for an in-browser mapping tester. The 8BitDo SN30 Pro over BT on macOS reports `mapping:""` (non-standard) — its D-pad is the HID hat on **axis 9** (UP=−1, RIGHT=−0.429, DOWN=0.143, LEFT=0.714, neutral≈3.286); `gamepad.ts` decodes it.

---

## 4. Verification recipes (how to prove changes without hands on keys)

The debug handle on `window.__weezy3d` (in `main.ts`):

```js
__weezy3d.getPlayer()        // {x, y, vx, vy, onGround, facing, ...} — render px
__weezy3d.getCollected()     // token count
__weezy3d.hasWon()
__weezy3d.teleport(x, y)     // render px; remember floor y = 336
__weezy3d.setSimInput({right:true, jumpPressed:true})  // OR-merged with keyboard; null to release
__weezy3d.reset()
__weezy3d.snapCamera()       // skip the camera ease — screenshot immediately (kills gotcha #4)
__weezy3d.scene              // live THREE scene — traverse for numeric light/material checks (gotcha #9)
__weezy3d.worldIndex / .areaId / .bounds   // which world + theme loaded, stitched extents (render px)
__weezy3d.segments           // continuous-world segments: {id, startX, endX, spawn} per former level
__weezy3d.currentSegment()   // id of the segment the player is in
__weezy3d.jumpToSegment(i)   // teleport to segment i's checkpoint spawn (0-based)
```

Standard checks (all done via `preview_eval` against the running dev server):
- **Jump feel:** settle on ground → `setSimInput({jumpPressed:true})` → poll min y for ~1.1s → apex = `(336 − minY)/2` design px. Expect ~70–80.
- **End-to-end:** `setSimInput({right:true})` from spawn → poll until `hasWon()` (≈25s; the level is ~5,600 px). No jumps needed on Level 1's floor route.
- **Occlusion/visual:** teleport → settle-poll → `preview_screenshot`. Compare against the palette and the z-convention.
- Unit level: `npx vitest run src/three/physics3d.test.ts`. Full gate: `npm run build`.

---

## 5. Next-port recipes (in recommended order)

### 5.1 Enemies → ✅ DONE + companion cameos (2026-06-12 session 5)
Shipped exactly on this recipe via subagent-driven development (7 tasks, two-stage review each). What exists now:
1. **Pure logic:** `src/three/enemy3d.ts` (+9 tests) — `createEnemyState`/`stepEnemies`; patrol + gravity/ground-rest + stomp-vs-damage classification mirroring `GameScene.isStomp` verbatim (vy≥60·S, 8·S top band, 0.55·w alignment). Caller owns invincibility + what stomp/damage *do*.
2. **Views:** `enemyView.ts` (per-kind shared textures, 8fps walk, flip-on-dir, hide-on-defeat **with symmetric visible-restore** — see gotcha 12) + `companionView.ts` (bob + `setCollected`/`setUncollected` lifecycle) over the shared `billboard.ts` helpers (extracted from playerView; constructor takes injected Frames, only `load()` does I/O — node tests can't run the real loader).
3. **Hearts** live in `main.ts` (3D-local, NOT GameState) + `hud.setHearts`/`showCaption`; death → segment-checkpoint respawn + refill; pit death does NOT cost hearts (2D parity) and zeroes invincibility.
4. **Companion** preserved through `worldStitch.ts` (offset x, first-wins + duplicate warn) → cameo collect applies `heartBonus` only (Teddy +1). The §5.4 powers port later swaps the collect hook to grant real abilities.
5. Debug handle: `getHearts()`, `enemyStates()`, `companionMet()`, `companionAt()`. Defensive: pit-spanning patrol bands retire enemies at `killY + 400`.

### 5.2 Level chaining + select — ✅ SUPERSEDED by continuous worlds (2026-06-10 session 3)
Per-level chaining shipped in session 2, then the 2026-06-10 playtest verdict replaced it: worlds now stitch into single continuous runs (`worldStitch.ts`), `?world=` selects, "Next world →" chains, `?level=n` is a segment-targeting alias. Future ports (enemies §5.1, powers §5.4) consume the STITCHED level — they get continuity for free as long as they operate on `LevelData` + offsets, which the stitcher already handles for enemies/climbWalls/breakables.

### 5.3 Remaining worlds' set dressing — ✅ DONE for all 4 catalog worlds (2026-06-09 session 2)
Hallway, Kitchen, Family Room, Backyard shipped (see the §1 file table). Still open under this heading: **per-level hero-object variation** within a world (sets are per-world, `buildSet(minX,maxX)` only — mid-ground dressing can span pit columns; acceptable under fog but a variation seam would fix both), and the **Playhouse arena backdrop** (build it WITH the boss port so it dresses the real BossScene). Knobs-table note: treat the fog/intensity rows as *starting points* — fogNear must stay ≥12 (behind the 10.5-unit gameplay plane; pinned by test), and shipped intensities ran ~25–35% above the table rows (same as bedroom's precedent).

### 5.4 Powers — ✅ DONE (2026-06-15, session 7)

All five powers are live in `src/three/physics3d.ts`. Spec: `docs/superpowers/specs/2026-06-15-3d-powers-design.md`. Key as-built notes:

- **`FrameInput` gained OPTIONAL `up`/`powerPressed`/`powerHeld`** and `stepPlayer` gained an OPTIONAL `env: PowerEnv = { unlocked: Set<AbilityId>, climbWalls, breakables }`. Optionality kept the original 13 feel-tests byte-identical — no regressions by construction.
- **Breakables live ONLY in `env.breakables`**, never in static `build.solids`. `stepPlayer` composes them into collision internally and nulls a smashed one in place, reporting `player.justSmashed` (index). The caller (`main.ts`) hides that mesh. `resetLevel` re-shows all breakable meshes (gotcha 12 symmetry).
- **Abilities are 3D-local** — seeded per run by `abilitiesForArea(world.areaId)`, NOT `GameState`. `?world=kitchen` starts with double-jump+dash+wall-climb. Companion-collect calls `unlocked.add(COMPANIONS[type].grants)` (idempotent) alongside `heartBonus`.
- **Input mapping:** keyboard power = **X**, up = W/↑; gamepad power = **button 1**, up = stick/D-pad up. Jump stays on Space / button 0. Wall-climb is Up, not the power button (2D parity).
- **`level3d.ts`** now renders climb walls (vine-green `MeshLambertMaterial`, z < 0 behind the gameplay plane) and breakables (crate-brown, solid, casts shadow); both exposed on `LevelBuild`.
- **Type cleanup:** `WorldEntry.areaId`/`LevelCatalogEntry.areaId` widened from `string` to `AreaId`.
- **New debug handles:** `__weezy3d.unlockedAbilities()`, `grantAbility(id)`.
- **+24 tests** (416 total from 392). Browser-verified: double-jump apex 78→155 px; dash 640px lunge; wall-climb vy −260; charge smash backyard barricade (3→2), `reset()` restored all 3; glide clamped to 180 px/s.
- **Feel note for human playtest:** releasing Up mid-wall-climb leaves residual climb velocity (−260 vy), giving a small upward hop (~40% of a jump) before gravity reasserts. Possibly a nice mantle-over-the-lip boost. The human decides — do not silently tune it.

### 5.5 Polish backlog (do after enemies, not before)
- Depth-of-field (EffectComposer + BokehPass) for the macro-photo blur; subtle bloom for lamp/exit.
- Dust motes drifting in the window light pools; token sparkle burst on pickup.
- Token collect "pop" tween + count-up animation; landing dust puff (the 2D `player-landed` event equivalent).
- Camera: consider a touch more downward angle + lower fog far for cozier framing (current: fov 42, dist 10.5, fog 14→36).
- Sound (the 2D game has none either — shared backlog).

---

## 5.6 Pass-2 texture learnings (2026-06-11, candy re-theme — read before texturing a world)

**Status: ⛔ REVERTED in full (2026-06-12, session 5).** User verdict after playtest: the candy textures weren't worth the effort or the lag — a regression vs. the session-2/3 procedural look. Restored byte-faithful from the Jun-11 13:37 Time Machine local snapshot (`mount_apfs -o ro -s` — the repo has no git); candy modules/textures deleted; archive at `../Weezy3D-candy-backgrounds-archive-2026-06-12.tgz`. The frame-chop investigation closed as candy-tied; if chop ever returns on the procedural scenes, the first lever is `renderer.setPixelRatio` (2 → 1.5 ≈ 44% fewer shaded pixels). The learnings below stay — they're paid-for knowledge for any future texture pass.

Pipeline: `scripts/gen-texture.mjs` (Gemini image API, key auto-read from `~/.zshrc`; the nanobanana MCP env was also fixed). Spec: `docs/superpowers/specs/2026-06-11-3d-backgrounds-pass2-candy-design.md`. Per-world loop: generate → wire → screenshot → iterate → gate → record here.

1. **Reference images carry the style.** Attach the user's inspiration JPEG(s) (`docs/reference-art/`: `Bedroom.jpg`, `Kitchen.jpg`, `Living ROom.jpg`) to every call; describe only the *subject* in the prompt. 3 of 4 bedroom textures were first-shot keepers.
2. **Object-face textures must demand full-bleed**: "fills 100% of the frame edge to edge, NO background, NO floor, like a texture swatch." Without it the model paints the object *in a scene* and the background becomes a flat slab on the mesh.
3. **MirroredRepeatWrapping makes any output tile seamlessly** (`loadCandyTexture` default). The kaleidoscope mirroring reads as intentional damask. Wallpaper tile size: **5 world units** is right; 8 was so large the pattern competed with the play layer.
4. **Hero placement: use segment-spawn fractions.** Checkpoint spawns (`__weezy3d.segments[i].spawn`) are the only data-guaranteed open flat floor. Arbitrary fractions hit a platform (0.62) and a pit (0.57); bedroom's chest lives at segment-3's 0.563.
5. Sizes/aspect: 1:1 @1024 ample for wallpaper/porthole-view/faces; 16:9 for rugs. JPEG ~100-300KB each.
6. Sparkle motes (`buildSparkles`): default scale 0.55 reads right; remember gotcha #8 — a hidden tab freezes the `update` hook, so verify drift numerically across a forced frame, not by eval-twice.
7. **Dress on a cadence, not at fractions** (user feedback, bedroom round 2). Stitched worlds are ~500 units wide; fixed-fraction landmarks (pass-1 style) leave whole screens of bare wallpaper. Use `cadenceSpots(start, end, step, seed, {floors, margin})` — wall items (portholes) unconstrained at step ~38 (one per screen); floor furniture pit-aware via `DressingContext.floorRanges` (main.ts derives it from `build.solids`; floor tell h≥55px). Margins: shelf 3, chest 2.5, rug 6, ball/crayon 1. Filter furniture spots within ~4.5 units of a porthole x so windows stay visible.
8. **Preview-panel viewport can collapse to 2px wide** (collapsed IDE panel) — screenshots come back as slivers and the renderer inits tiny. Fix: `preview_resize` with explicit width/height (1440×810), not the desktop preset ("native" = the collapsed size).
9. **Perf budget for cadence dressing** (user-reported chop, 2026-06-11; fixed same day). The frame cost is lights × pixels + draw calls + shadow casters — NOT texture file size (JPEGs decode once at load). Hard rules: **(a) repeated landmarks carry NO lights** — 13 porthole PointLights → 16 total = unplayable; budget ≤ ~6 lights/world (ambient + sun + fill + 2-3 lamps). buildPorthole is light-free by design + pinned by test. **(b) Particle fields = ONE THREE.Points** with vertex-color twinkle (additive blending, dim=faded), never N Sprites (N draw calls) — pinned by test. **(c) Tiny clutter (blocks, crayons, books) never casts shadows; huge far planes (wallpaper) never receive them.** Diagnose with the scene-census eval (count lights/meshes/sprites/casters via `__weezy3d.scene.traverse`) before guessing.

## 5.7 Visual-immersion cookbook (2026-07-01, session 8 — bedroom = the proof; apply per world after user approval)

Pass 1 shipped on World 1 (`feat/visual-immersion-l1`). The juice layer (fx pool, player/enemy/companion animation, camera events, HUD polish, token pop, door halo) is **global — already live in all 5 worlds.** What each remaining world needs is only its SET recipe, cloned from `bedroomSet.ts`:

1. **Cadence dressing** (never fixed fractions): seeded interval loops over [minX, maxX] — wall item every ~55–65 units (alternate two species so it doesn't metronome), mid-ground landmark every ~35–45 rotating 3–4 builders from the world's scenery-library hero list, clutter every ~9–14, foreground (+1.9) crumb every ~25–30. Jitter everything off the LCG.
2. **One visible hero light** with a breathing/flicker `update` hook (bedroom lamp, kitchen stove ✓, family-room fireplace ✓ — hallway needs an end-window glow treatment, backyard a sun-dapple equivalent). REPURPOSE existing lights; budget ≤6/world *including the exit-door glow* (bedroom census: exactly 6).
3. **Light-shaft planes instead of light sources** at windows: slanted PlaneGeometry, MeshBasic, additive, opacity ~0.10, `depthWrite:false`, `fog:false` — zero lights.
4. **ONE dust-mote/ambient THREE.Points** per world (≤200 verts, seeded, drifting via `update`; kitchen = heat shimmer above the stove, backyard = pollen).
5. **Compliance sweep while in the file:** strip `castShadow` from anything small (per-mesh rule ~<1.5 units), wallpaper/far planes `receiveShadow=false`. (Hallway/kitchen/familyRoom/backyard sets still violate this — cheapest perf win available.)
6. **World-specific `WorldSurfaces`** if the floor still reads generic.
7. **Verify numerically** (`__weezy3d`): light count ≤6, casters delta, `fxLive()` after a jump-land = landing-dust count, `shake()` fires, screenshot tour via `jumpToSegment(i)` + `snapCamera()`.

**Painted-diorama experiment (2026-07-02, same branch — `?look=painted`, bedroom only, awaiting user verdict).** After the user's "blah" verdict on the procedural look, the Eloise recipe (painted art in 3D space) was applied to the room itself: 5 NanoBanana-pro backdrop paintings style-locked to `docs/reference-art/Bedroom.jpg` (one per segment, `assets/backdrops3d/bedroom/`, ~180KB JPEGs), hung as fog-free MeshBasic planes at wallpaper depth with mirrored-repeat tiling (`paintedBackdrop.ts`); the procedural wall layer + mid-ground landmarks sit out (painted furniture in front of a painting reads as cardboard); floor/platform/clutter palettes shift candy; a gentle UnrealBloomPass (0.35/0.5/0.85) makes the fairy lights and Eloise's rim glow. Generation prompt pattern that worked first-shot: reference image attached + "flat side-on orthographic wall view, carpet floor line at exactly 15% from bottom, edges seamlessly continuable, NO characters, NO text, slightly soft/hazy background-art finish" + `use_image_history` for cross-segment consistency. **If approved:** per-world = 5 paintings + a `BACKDROP_URLS` entry + the set's `paintedWall` opt — the old 2D-era `assets/backgrounds/` pixel-art paintings are style-mismatched, do NOT reuse them. Bloom is the one real frame cost — first lever to pull if the user reports chop.

Paid-for notes from pass 1: `PCFSoftShadowMap` is **deprecated in three r184** (falls back + warns per frame) — soft edges come from `set.sun.shadow.radius = 4` in main.ts; token/star meshes must NOT cast (125 casters saved); the vignette is a CSS overlay in `hud.ts`, not a post pass; the fx pool parks dead slots at y=-9999 AND black (additive-invisible). Queued behind user approval: painted far-plane backgrounds experiment (24 orphaned 1024px paintings on disk), NanoBanana batch for dash/glide/climb/hurt/celebrate Eloise frames (anchor pipeline intact), WebAudio synth blips, diegetic win beat (door swings open), in-page world hand-off fade.

## 6. Working agreements for future sessions

- **Verify in-browser before claiming done** — the preview tools + `__weezy3d` make every claim checkable. Screenshots are the deliverable for visual work.
- **Tests gate the feel.** Any physics change must keep the 13 envelope tests green; new movement mechanics get the same treatment (pure module + tests first).
- **Document as you land** — PROGRESS.md session entry + CLAUDE.md status line + this playbook's §1/§3 updated in the same session as the change. This doc is the handoff: if it's stale, the next session pays.
- **The human plays; the agent proves.** Feel-tuning (camera, fog, light intensity, walk anim speed) is a human-at-keyboard call — surface the knob locations, don't silently re-tune them.

*Updated 2026-06-15 (session 7: **traversal powers shipped — §5.4 ✅** — all 5 powers in `physics3d.ts`, optional `PowerEnv`/`FrameInput`, breakables-out-of-solids smash model, `abilitiesForArea` 3D-local seeding, X/button-1/Up mapping, climb-wall + breakable mesh rendering in `level3d.ts`, new debug handles `unlockedAbilities`/`grantAbility`, 416 tests, all 5 worlds playable end-to-end). Previously 2026-06-15 (session 6: gamepad support + 2D Phaser removed). Keep §1 and §3 current; append recipes as systems land.*
