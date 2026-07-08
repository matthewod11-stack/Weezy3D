# Princess Eloise — Bedroom World

Pixel platformer for kids (4–8). Eloise journeys from bedroom through six connected areas, collecting companions and tokens, culminating in a T-Rex boss fight.

> **2026-06-15 — the 2D Phaser game was extracted to a separate repo.** This repo is now **Weezy3D**: the Three.js testbed (`/3d.html`) is the game. The deleted shells (`src/scenes/`, the Phaser entity classes, render systems, `index.html`, `src/main.ts`) live in the standalone 2D repo. The reusable **Phaser-free logic** the 2D game pioneered was kept and relocated to **`src/logic/`** (`airJump`, `powerDispatch`, `bossFight`, `cutscene`, `menuSelection`, `aimVelocity`, `breakable/climbDetect`) — traversal powers were ported to 3D via this logic in session 7 (§5.4 ✅); boss/cutscenes remain future work. The level-design pipeline (`design/ → encodeFromSketch → levelCatalog`) and `maps.html` are shared and untouched.

## Tech Stack

- **Runtime:** Three.js (3D testbed) — Phaser removed 2026-06-15
- **Language:** TypeScript (strict)
- **Build:** Vite 6 (two entries: `3d.html`, `maps.html`)
- **Input:** keyboard + gamepad (`src/three/gamepad.ts`; 8BitDo SN30 Pro mapped)
- **Validation:** Zod (level JSON schema)
- **Target:** Web (itch.io HTML5), desktop + tablet

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server + HMR (usually http://localhost:5173) |
| `npm run build` | Typecheck + **tests (Vitest)** + production build — fails on a soft-lock |
| `npm test` | Run the Vitest suite (`vitest run`) |
| `npm run preview` | Serve `dist/` |
| `npm run typecheck` | `tsc --noEmit` only |

**Level safety net (added 2026-05-30):** `src/levels/reachability.ts` is a build-time **reachability lint** — it derives the jump envelope from `src/config/physics.ts` and verifies every level is completable; `npm run build` fails on a soft-lock. A boot/texture smoke test (`src/levels/levelTextures.ts`) asserts every level is Zod-valid + references only loaded sprites. The **power system** (metroidvania ability-gating) is **COMPLETE — P0–P5 BUILT** (2026-05-30 → 2026-06-02): powers-as-data (`src/config/{areas,abilities,companions,gating}.ts`), `GameState.unlockedAbilities`, an ability-aware `jumpEnvelope` + reachability double-check, and the **one-button context power dispatcher** (`src/entities/powerDispatch.ts`). All **five** powers ship: **Double-Jump** (Teddy, envelope), **Glide** (Flamingo, parachute-clamp envelope), **Dash** (Dog, horizontal `requires:"dash"` platform edge), **Wall-Climb** (Cat, vertical `climbWall` zone edge — climbs on **Up/W**, not the power button; see spec §6.1 playtest note), and **Charge** (Horse, a solid `breakable` barricade — tap X to smash when flush, or **dash into it** to plow through; gates the Backyard). Each traversal power = a tagged level element + a conditional reachability edge + a dispatcher predicate, auto-proven solvable-with / not-without its gating power. Charge is the mirror-image: its edge is *subtractive* — a barricade BLOCKS a seam until charge clears it (a filter, not an additive OR) — and it's the first power to mutate level geometry at runtime (a destroyed solid body). A dev-only **Testing Ground** (main menu, gated on `import.meta.env.DEV`) benches all five. Spec: `docs/superpowers/specs/2026-05-30-power-system-design.md`; per-phase plans in `docs/superpowers/plans/`.

## URLs (when dev server is running)

| URL | What it shows |
|-----|---------------|
| `http://localhost:5173/3d.html` | **The game.** (Was a "testbed"; now the only runtime — the 2D `/` entry was removed 2026-06-15.) Add `?world=bedroom\|hallway\|kitchen\|familyRoom\|backyard`. |
| `http://localhost:5173/maps.html` | **Level design surface.** All 6 areas, every drafted variant, segment-boundary markers, totals. Edit `src/design/levelSketches.ts`; this page hot-reloads. |
| `http://localhost:5173/3d.html` (detail) | **Weezy3D (from 2026-06-10, session 3).** **All 5 worlds as CONTINUOUS Three.js runs** via `?world=bedroom\|hallway\|kitchen\|familyRoom\|backyard` — each world's 5 catalog levels stitched into ONE run at load time (`src/three/worldStitch.ts`, pure + 17 tests): intermediate doors dropped, floor seams coalesced, former boundaries = pit-death checkpoints + "Bedroom · 2/5" HUD progress; "Next world →" chains. `?level=0..24` = back-compat alias (containing world, spawned at that segment). Per-world set dressing via `worldThemes.ts` — backgrounds DONE for all 4 non-boss worlds; **ENEMIES + COMPANION CAMEOS LIVE IN 3D (2026-06-12, session 5)** — all 4 enemy types as patrol billboards with 2D-parity stomp/damage (`src/three/enemy3d.ts`, pure + 9 tests), ❤️ hearts HUD + 1500ms invincibility blink + death→checkpoint respawn, companion preserved through the stitcher and collectible (heartBonus parity: Teddy +1 max heart, caption); **ALL 5 TRAVERSAL POWERS PORTED (2026-06-15, session 7) — §5.4 ✅ — all 5 non-boss worlds playable end-to-end** (double-jump, dash, wall-climb on Up/stick, charge, glide via power button X/button-1; abilities 3D-local via `abilitiesForArea`; companion-collect grants real abilities). Same `LevelData` + `PHYSICS` constants, billboard storybook Eloise. Code in `src/three/` (no Phaser imports). Debug handle: `window.__weezy3d` (incl. `segments`, `jumpToSegment(i)`, `snapCamera()`, `scene`). **Backgrounds pass 2 (candy re-theme): REVERTED 2026-06-12** — user verdict: not worth effort + lag; restored to the session-2/3 procedural look from a pre-candy Time Machine snapshot; archive at `../Weezy3D-candy-backgrounds-archive-2026-06-12.tgz`; the session-4 frame-rate investigation is moot (chop was candy-tied), `pixelRatio` lever noted in PROGRESS.md if it ever returns. **Start any 3D session by reading `docs/3d-transition/weezy3d-playbook.md`** — current state (§5.6 = pass-2 learnings + perf budget), the z=0 diorama convention, paid-for gotchas, verification recipes, next-port order. |

## Folder Structure

```
src/
  three/        THE GAME (Three.js, no Phaser). main.ts, physics3d.ts,
                input.ts, gamepad.ts, worldStitch.ts, enemy3d.ts, level3d.ts,
                playerView/enemyView/companionView, hud.ts, *Set.ts themes,
                fx.ts (juice particle pool), paintedBackdrop.ts (?look=painted)
  logic/        Phaser-free reusable logic (kept from the 2D game): airJump,
                powerDispatch, bossFight, cutscene, menuSelection, aimVelocity,
                breakableDetect, climbDetect — substrate for 3D feature ports
  levels/       bedroomLevels.ts … backyardLevels.ts (auto-generated),
                encodeFromSketch.ts (converter), levelCatalog.ts,
                reachability.ts (build-time lint), *DemoLevel.ts, testingGround.ts
  design/       levelSketches.ts (source of truth), combineSlot.ts,
                sketchRenderer.ts, mapsPage.ts (→ maps.html)
  config/       physics.ts, game.ts, companions.ts, abilities.ts, gating.ts,
                areas.ts, cutscenes.ts, textures.ts, backgrounds.ts
  state/        GameState.ts (singleton)
  types/        level.ts (Zod schemas)
3d.html         The game entry (Vite multi-page)
maps.html       Level-design entry (Vite multi-page)
ROADMAP.md      V1 roadmap (Phases 0–7 + Touch/Art tracks)
```

(The 2D Phaser game — `src/scenes/`, the Phaser entity classes, `src/systems/{BlueprintGrid,LevelBackgroundLoader,measureSpriteFeet}`, `index.html`, `src/main.ts` — was removed 2026-06-15 and lives in a separate repo.)

## ⭐ Level Design Workflow

**Single source of truth: `src/design/levelSketches.ts`.** All level data — platforms, tokens, enemies, pits, companion placement — is authored here in coarse grid coordinates (1 grid = 32 design-px ≈ one Eloise body height). The playable game data in `src/levels/bedroomLevels.ts` is auto-generated from it on every reload.

### To tweak a level:

1. Open `src/design/levelSketches.ts`. Find the slot you want to change (e.g., `BEDROOM_SLOTS[2]` for Level 3).
2. Each slot has 3 variants (`A`, `B`, `C`). Edit the platforms/zones/pits of any variant.
3. Save. Vite hot-reloads both the game (with new level data) and `/maps.html` (with the new sketches).
4. Verify the change visually at `/maps.html`; playtest in the game at `/3d.html`.

### Layout of a slot:

```ts
{
  id: 1,
  name: "Bookshelf Lower",
  intent: "Tutorial. Walking + first easy jumps. No enemies, no pits.",
  options: [
    {
      variant: "A",
      source: "Mario 1-1 / GMTK: Runway → Staircase → Breadcrumb → Coda",
      note: "Research-recommended.",
      widthGrids: 22, heightGrids: 4,
      spawn: { x: 1, y: 0 },        // grid coords; y=0 floor, +y up
      exit:  { x: 21, y: 0 },
      platforms: [{ x: 8, y: 1, w: 2 }, ...],
      zones:    [{ x: 4, y: 0, kind: "token" }, ...],
      pits:     [{ x: 12, w: 2 }],  // optional; slots 1-3 are pit-free
    },
    // variants B, C ...
  ],
}
```

### Variant ordering: B → A → A → C

Each level chains four segments in order **B → A·1 → A·2 → C** (gentle warmup → research-baseline pattern → mastery repeat → twist). This is set in `src/design/mapsPage.ts` (`SEGMENT_ORDER` const) and `src/levels/bedroomLevels.ts` (same const). Change in both places to reorder globally.

### Source-of-truth chain

```
src/design/levelSketches.ts  ──►  combineSlot()  ──►  CombinedLevel  ──►  encodeFromSketch()  ──►  LevelData (game-ready)
       (authored)              (chains variants)       (sketch coords)       (translates to game coords)        (Zod-validated)
```

Edit the source file → both surfaces (game + maps page) update on next refresh.

### 15-pattern legend (cited in each variant's `source` field)

Researched patterns from GMTK breakdowns, Kishōtenketsu, Dan Taylor's "Ten Principles", Anthropy's "Game Design Vocabulary":

1. Friendly Runway · 2. Gentle Staircase · 3. Token Breadcrumb · 4. Safe Stomp Intro · 5. Risk-Reward Branch · 6. Foreshadow/Pay-off · 7. Kishōtenketsu spine · 8. 2-Square Trust Gap · 9. Hidden Token · 10. Backtrack Token · 11. Rest Beat · 12. False Summit · 13. Stomp Patroller Gate · 14. Companion Beacon · 15. Victory Coda

Full descriptions in the file header of `src/design/levelSketches.ts`.

## Game Conventions

- **The game is `src/three/`** (Three.js, no Phaser). Per-run state (tokens, hearts, won) lives in `src/three/main.ts`; `src/state/GameState.ts` is a kept Phaser-free progress singleton (localStorage) not yet wired into the 3D runtime.
- **Physics:** shared constants in `src/config/physics.ts` — asymmetric gravity (600 up / 400 apex / 900 down), coyote time (100ms), variable jump, max horizontal jump ≈ 120 design-px / max apex ≈ 80 design-px (~3.75 / ~2.5 grid cells). The pure 3D sim (`src/three/physics3d.ts`) reuses them verbatim, so jump arcs match the reachability lint envelope.
- **Camera:** side-scrolling diorama on the z=0 plane (`src/three/main.ts`), look-ahead ported from the 2D feel.
- **Sprites:** billboarded storybook PNGs (`playerView`/`enemyView`/`companionView` in `src/three/`); feet-planting handled in `src/three/billboard.ts`.
- **Levels:** authored via the level-design workflow above, Zod-validated at load, stitched into continuous per-world runs by `src/three/worldStitch.ts`.
- **Controls:** keyboard (← → / A-D move, Space jump, **X** power/dash/charge/glide, **W/↑** wall-climb) + **gamepad** (`src/three/gamepad.ts`; 8BitDo SN30 Pro mapped — D-pad/stick move, button 0 jumps, **button 1** power, **stick/D-pad up** wall-climb). HUD has Reset + "Next world →" buttons; click the canvas to focus.
- **Debug:** `window.__weezy3d` — `getPlayer()`, `segments`, `jumpToSegment(i)`, `reset()`, `gamepad()`/`gamepadConnected()`, `scene`, `unlockedAbilities()`, `grantAbility(id)`.

## Current Status

### The 3D game (`/3d.html`)

All **5 non-boss worlds play as continuous Three.js runs** — `worldStitch` chains each world's 5 catalog levels into one run; former level boundaries become pit-death checkpoints + a "Bedroom · 2/5" HUD. **Enemies + companion cameos are live in 3D** (`enemy3d`/`enemyView`/`companionView`) with 2D-parity stomp/damage, hearts HUD, invincibility blink, and death→checkpoint respawn. **Keyboard + gamepad** input both work.

**All five traversal powers are live in 3D** (§5.4 ✅, 2026-06-15 session 7) — **all 5 non-boss worlds are now playable end-to-end**:
- **Double-jump** — Space / gamepad button 0 (air); gated on `doubleJump`; re-arms on landing.
- **Dash** — **X** / gamepad **button 1** (press); `dashSpeed` 800 × `dashDurationMs` 400ms lunge.
- **Wall-climb** — **W/↑** / gamepad **stick or D-pad up** (held); 2D parity (NOT the power button); ascends `climbWall` zones at `climbSpeed` 130, gravity off while climbing.
- **Charge** — **X** / gamepad **button 1** (press at flush barricade or dash-into-it); smashes `breakable` barricades; `chargeReach` 14.
- **Glide** — **X** / gamepad **button 1** (held while airborne + descending); clamps fall to `glideFallSpeed` 90.

Abilities are **3D-local** (seeded per run by `abilitiesForArea(world.areaId)`) — NOT `GameState`. Companion-collect grants real abilities (`unlocked.add(COMPANIONS[type].grants)`) alongside `heartBonus`. New debug handles: `__weezy3d.unlockedAbilities()`, `grantAbility(id)`. 416 Vitest tests + tsc clean + browser-verified. Spec: `docs/superpowers/specs/2026-06-15-3d-powers-design.md`.

**Visual immersion pass 1 (2026-07-01, session 8 — branch `feat/visual-immersion-l1`):** global juice layer (`src/three/fx.ts` particle pool, player squash-and-stretch + dash/glide/climb poses, enemy stomp squash+poof, companion follow, camera shake/FOV-kick/win-dolly/pit-follow, death fades, CSS vignette, token pop + door halo) + **Bedroom set rework** (cadence dressing, breathing hero lamp, light shafts, dust motes, crib/toy-chest/teddy landmarks) as the World-1 proof point. Perf-budget compliant (6 lights, casters 270→106, 2 Points fields). **Replicate to worlds 2–5 via playbook §5.7 cookbook after user approval.** Plan: `docs/superpowers/plans/2026-07-01-visual-immersion-level1.md`.

**Painted-diorama art direction (2026-07-02, same branch, `?look=painted`):** after user verdict that the procedural look was "blah, not majestic," diagnosed as art direction (not an engine ceiling — Three.js can render this). Two playtest rounds shipped: (1) painted backdrop planes per segment + continuous edge-fading wallpaper (`src/three/paintedBackdrop.ts`), pit-aware dressing, bloom retune, dark under-floor for pit gaps (commit 79c3245); (2) after the user shared Mario Wonder references — diagnosis: Wonder's beauty is in the *terrain*, not the background — Wonder-style **quilted-blanket platforms with a plush carpet lip** replaced flat placeholder boxes (`WorldSurfaces.plush`, `buildPlushPlatform` in `level3d.ts`, commit 9df97fb). 464 tests, tsc clean. **Awaiting user verdict on the quilt terrain** before deciding: make painted the default, or extend the recipe (parallax cutout props, ambient butterflies) further before rolling to other worlds.

### Level design (authored — feeds the 3D game)

All 6 worlds are authored via the sketch→encode pipeline (`design/levelSketches.ts` → `levelCatalog`), **B-A-A-C** ordering, 5 slots × A/B/C each, proven solvable by the reachability lint + per-world integration tests (`src/levels/*.integration.test.ts`). This design is the durable source of truth; the 3D game renders it.

| World | Companion → power | Primary enemy | Gate / signature beat |
|---|---|---|---|
| 1 Bedroom | Teddy → double-jump | dust bunny | tutorial; **gate-free** |
| 2 Hallway | Dog → dash | spider | double-jump (slots 4–5) |
| 3 Kitchen | Cat → wall-climb (`metAtStart`) | ant | vertical climb; wall-climb **+** dash; slot-5 combo |
| 4 Family Room | Horse → charge | dust mite | wall-climb once (slot 5); enemy-carryover system |
| 5 Backyard | Flamingo → glide (`metAtStart`) | ant (+ all 4 recap) | charge (smash barricades) **+** glide; windowsill spawn |
| 6 Playhouse | T-Rex boss | T-Rex | the climax (see below) |

Traversal vocab in the sketches: `requires:"dash"` platforms, `climbWalls`, `breakable` barricades, elevatable spawn/exit (`spawn.y`/`exit.y`), per-zone `enemyType` carryover.

### Boss + cutscenes (logic kept, 3D shells pending)

The **T-Rex boss** (`src/logic/bossFight.ts` — pure state machine: telegraph → stomp/charge → recovery window where Eloise throws her lifetime tokens; 3 hits to tame; finite ammo with companion bailout) and the **cutscene engine** (`src/logic/cutscene.ts` + `src/config/cutscenes.ts` power-intro scripts) survive as **tested, Phaser-free logic**. Their 2D Phaser scene shells were removed with the 2D game, so **neither is currently playable** — porting them to 3D scenes is future work, with the logic ready to reuse.

See `ROADMAP.md` and `PROGRESS.md` for history.
