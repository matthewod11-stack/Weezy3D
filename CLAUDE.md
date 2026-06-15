# Princess Eloise — Bedroom World

Pixel platformer for kids (4–8). Eloise journeys from bedroom through six connected areas, collecting companions and tokens, culminating in a T-Rex boss fight.

> **2026-06-15 — the 2D Phaser game was extracted to a separate repo.** This repo is now **Weezy3D**: the Three.js testbed (`/3d.html`) is the game. The deleted shells (`src/scenes/`, the Phaser entity classes, render systems, `index.html`, `src/main.ts`) live in the standalone 2D repo. The reusable **Phaser-free logic** the 2D game pioneered was kept and relocated to **`src/logic/`** (`airJump`, `powerDispatch`, `bossFight`, `cutscene`, `menuSelection`, `aimVelocity`, `breakable/climbDetect`) — substrate for porting powers/boss/cutscenes to 3D (playbook §5.4). The level-design pipeline (`design/ → encodeFromSketch → levelCatalog`) and `maps.html` are shared and untouched.

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
| `http://localhost:5173/3d.html` (detail) | **Weezy3D (from 2026-06-10, session 3).** **All 5 worlds as CONTINUOUS Three.js runs** via `?world=bedroom\|hallway\|kitchen\|familyRoom\|backyard` — each world's 5 catalog levels stitched into ONE run at load time (`src/three/worldStitch.ts`, pure + 17 tests): intermediate doors dropped, floor seams coalesced, former boundaries = pit-death checkpoints + "Bedroom · 2/5" HUD progress; "Next world →" chains. `?level=0..24` = back-compat alias (containing world, spawned at that segment). Per-world set dressing via `worldThemes.ts` — backgrounds DONE for all 4 non-boss worlds; **ENEMIES + COMPANION CAMEOS LIVE IN 3D (2026-06-12, session 5)** — all 4 enemy types as patrol billboards with 2D-parity stomp/damage (`src/three/enemy3d.ts`, pure + 9 tests), ❤️ hearts HUD + 1500ms invincibility blink + death→checkpoint respawn, companion preserved through the stitcher and collectible (heartBonus parity: Teddy +1 max heart, caption); **traversal powers still unported — power-gated segments impassable in 3D until §5.4 (bedroom is gate-free and now FULLY playable)**. Same `LevelData` + `PHYSICS` constants, billboard storybook Eloise. Code in `src/three/` (no Phaser imports). Debug handle: `window.__weezy3d` (incl. `segments`, `jumpToSegment(i)`, `snapCamera()`, `scene`). **Backgrounds pass 2 (candy re-theme): REVERTED 2026-06-12** — user verdict: not worth effort + lag; restored to the session-2/3 procedural look from a pre-candy Time Machine snapshot; archive at `../Weezy3D-candy-backgrounds-archive-2026-06-12.tgz`; the session-4 frame-rate investigation is moot (chop was candy-tied), `pixelRatio` lever noted in PROGRESS.md if it ever returns. **Start any 3D session by reading `docs/3d-transition/weezy3d-playbook.md`** — current state (§5.6 = pass-2 learnings + perf budget), the z=0 diorama convention, paid-for gotchas, verification recipes, next-port order. |

## Folder Structure

```
src/
  three/        THE GAME (Three.js, no Phaser). main.ts, physics3d.ts,
                input.ts, gamepad.ts, worldStitch.ts, enemy3d.ts, level3d.ts,
                playerView/enemyView/companionView, hud.ts, *Set.ts themes
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

- **State management:** Game state lives in `src/state/GameState.ts`, not in Phaser scenes
- **Physics:** Tuned constants in `src/config/physics.ts` — asymmetric gravity (600 up / 400 apex / 900 down), coyote time (100ms), variable jump, max horizontal jump ≈ 120 design-px / max apex ≈ 80 design-px (~3.75 / ~2.5 grid cells)
- **Camera:** `setZoom(0.5)` in `GameScene` shows 2x more level than default — tunable in `GameScene.loadLevel`
- **Levels:** Auto-generated via the level-design workflow above. Zod-validated at load time.
- **Sprite alignment:** Storybook PNGs have transparent bottom margin from rembg pipeline. Player/Companion/DustBunny use `computeFeetOriginY` from `src/systems/measureSpriteFeet.ts` so visible feet plant on the entity's world-space y.
- **Blueprint mode:** Backgrounds are dormant (PNG imports preserved but unused). World-space gridlines render via `BlueprintGrid.ts` for level design. Per-section illustrated backgrounds will return per area once gameplay is locked.
- **Progress:** Persisted to `localStorage`; reset via `eloiseReset()` in browser console
- **Controls:** Arrow keys / A-D to move, Space to jump, Esc to pause — click canvas to focus

## Current Status

**Bedroom (World 1):** Fully encoded into playable levels via the sketch → encode pipeline. 5 levels, B-A-A-C ordering, ~20.4 min of play, 125 tokens, 23 enemies + Teddy. Sketches are draftable in `levelSketches.ts`.

**Hallway (World 2):** Fully authored (2026-06-02) via the sketch → encode pipeline. 5 levels, B-A-A-C ordering, 5 slots × A/B/C, `5/5 drafted` on the maps page. Gated on **double-jump** (mandatory at slots 4–5, proven by the reachability lint); introduces **spiders** (a stomp-patroller `Spider` entity, sibling of `DustBunny`); earns **Dog → dash** on the finale's final approach. Spec/plan in `docs/superpowers/`. First of the 5 remaining areas (ROADMAP 7.1).

**Kitchen (World 3):** Fully authored (2026-06-03) via the sketch → encode pipeline. 5 levels, B-A-A-C ordering, 5 slots × A/B/C, `5/5 drafted`. A **vertical journey** (floor → climb counters → dash over the stove) and the first area with **two** load-bearing gates: **wall-climb** for the ascent and **dash** for the sink/stove leaps; slot 5 is a **combo finale** needing both (proven by `kitchen.integration.test.ts`). Cat is **met early** — a new `CompanionDef.metAtStart` flag puts wall-climb in the Kitchen's own ability set (`abilitiesForArea("kitchen")`), an opt-in evolution of the offset model that's contained to Cat (Bedroom/Hallway + the `gatingPower` chain untouched). Introduces the **Ant** stomp-patroller (+ a loud `else` guard for unhandled enemy types) and **two** new sketch-vocab elements — `requires:"dash"` platforms and `climbWalls` — plus an **elevatable exit** (encoder honors `combined.exit.y`). Earns **Cat → wall-climb**. `Press ↑ to climb!` is the interim mechanic intro (full scripted cutscene → ROADMAP 7.3.5). Spec/plan in `docs/superpowers/`.

**Family Room (World 4):** Fully authored (2026-06-03) via the sketch → encode pipeline. 5 levels, B-A-A-C ordering, 5 slots × A/B/C, `5/5 drafted`. **Enemy-forward, climb-light** — the player arrives with the full toolkit (double-jump + dash + wall-climb) and the area is gated on **wall-climb exactly once**: slot 5's couch-back climb, which also gates the **Horse** pickup (standard offset model — Horse grants **charge**, used in the Backyard, *not* here; no `metAtStart`). Introduces the **DustMite** stomp-patroller (single texture, sibling of Ant; art was already on disk) and the **carryover system** — a per-zone `enemyType?` override on enemy zones (`?? primaryEnemy` fallback + `trex` guard, preserved through `combineSlot`) that lets one level mix returning foes (dust bunnies/spiders/ants) with the primary. That front-loads the infra the Backyard's "recap all four" mandates. Proven by `familyRoom.integration.test.ts`: all 5 solvable with the full loadout; slot 5 **not** solvable without wall-climb; slots 1–4 solvable **without** it (the climb-light invariant, pinned); Horse reachable; carryover yields mixed types. **No new gating model, no new traversal vocab.** Earns **Horse → charge**.

**Backyard (World 5):** Fully authored (2026-06-04) via the sketch → encode pipeline. 5 levels, B-A-A-C ordering, 5 slots × A/B/C, `5/5 drafted`. The **only outdoor area** and the **pre-boss graduation** (re-themed from the scaffolded "Living Room"). **Dual gate:** **charge** (carried in from Horse) smashes hedge/fence `breakable` barricades — load-bearing at slots 4 & 5 — and **glide** becomes load-bearing **in-level for the first time** (the slot-3 kiddie-pool gap + the slot-5 treehouse finale; before this it was only exercised in the Testing Ground). Signature beat: **meet Flamingo at a high windowsill** (`metAtStart`, the 2nd use after Cat → `abilitiesForArea("backyard")` gains glide) → *glide out the window down into the yard* (the **elevatable spawn**, `spawn.y` honored). All four enemies recap via the carryover system (ant primary + spider/dust_bunny/dust_mite). Forgiveness curve holds: the window drop + slot-3 pool are non-lethal (a soft catch ledge), first lethal pit is slot 4. Proven by `backyard.integration.test.ts` (solvable-with full loadout; not-without charge @4/5; not-without glide @3/5; Flamingo reachable @1; carryover mixed). **Only two new authoring mirrors:** `breakable` sketch vocab (climbWalls-style passthrough) + elevatable spawn (`exit.y` mirror); GameScene already built+smashed breakables and `checkReachability` already modeled glide+breakables. Runtime-smoked (windowsill spawn, Flamingo, charge-tinted hedge, all-four carryover, no console errors). Spec/plan in `docs/superpowers/`.

**Playhouse (World 6 — T-Rex boss):** BUILT (2026-06-04) — the game's **climax and the payoff for every token collected**. A behavioral **set-piece**, NOT a sketch→encode level: a dedicated **`BossScene`** (`src/scenes/BossScene.ts`) over a pure, Phaser-free **`bossFight` state machine** (`src/systems/bossFight.ts`) — the same pure-logic-behind-a-thin-shell pattern as `airJump`/`powerDispatch`/`reachability`, unit-tested (13 cases) since a real-time fight can't be reachability-lint-proven. **Loop:** the T-Rex telegraphs (`roar` + camera shake, ≥1.2s) → a **stomp** (ground shockwave; jump over) or **charge** (`walk` across; step aside), alternating → a **recovery** window (≥2.0s) where Eloise throws her lifetime `tokensCollected` at it (auto-aimed on **X**; `Player.setPowersEnabled(false)` frees X from the dash/glide dispatcher in the arena). **Hits only count in recovery**; 3 → tamed/befriended → `GameState.worldComplete` → game complete. **Ammo is strictly finite** (depletes per throw, no retrieval) with a **companion bailout at zero** (`resolveThrow`) — all five companions stand on the sidelines (also seeds the 7.5 ending); **0 hearts resets the fight** (refill + reset boss), never bumps back a level. **Glide is the entry gate only** (no in-fight role). **Sprites effect-stubbed:** ships with the 3 on-disk states (`idle`/`roar`/`walk`); dizzy = stars-wobble, tamed = tint+floating-hearts — a real "tamed" sprite is a ROADMAP 7.2 art follow-up, NOT a blocker. `GameScene.handleExit` routes the **Backyard finale → BossScene** (`scene.stop("UIScene") + scene.start("BossScene")`); BossScene draws its own HUD (`treasures:` = ammo, hearts, 3 boss-HP pips) rather than reusing UIScene. Dev helper `eloiseLoadBoss()`. Runtime-smoked (arena renders, full telegraph→attack→recovery→hit→win cycle, throw spends a treasure, Backyard-finale routing, no console errors). Spec/plan in `docs/superpowers/`. **This completes the 6-world arc.** Remaining boss-adjacent work: the real tamed sprite (7.2), the scripted cutscene system (7.3.5 — DONE 2026-06-07), intro (7.4), ending (7.5), full playtest (7.6).

**Cutscene system (7.3.5):** BUILT (2026-06-07). Reusable scripted-sequence engine — a pure `src/systems/cutscene.ts` timeline controller (Phaser-free, unit-tested) behind a thin `src/scenes/CutsceneScene.ts` (additive card that builds up: companion bounces in → caption → looping demo tween → power-name pop → hold; hybrid auto-play with tap-ahead + a `skip ▸` bail). Scripts are data (`src/config/cutscenes.ts`, `powerIntroScript`). All 5 power intros (Teddy→double-jump, Dog→dash, Cat→wall-climb, Horse→charge, Flamingo→glide) fire on companion pickup, replacing the deleted `PowerUnlockScene` modal — identical pause/resume choreography at GameScene's `companion-collected` hook (which also disables the GameScene + UIScene keyboards so input can't leak under the cutscene). The 7.4 intro / 7.5 ending reuse the engine via a designed `page`/`clear`/`fade` beat-kind seam. Dev helper `eloiseLoadCutscene(type)`. Spec/plan in `docs/superpowers/`.

**Companions assigned:** Bedroom→Teddy, Hallway→Dog, Kitchen→Cat, Family Room→Horse, Backyard→Flamingo, Dollhouse→T-Rex boss.

**Primary enemy per area:** Bedroom→dust bunny, Hallway→spider, Kitchen→ant, Family Room→dust mite, Backyard→ant (+ recap all four via carryover), Dollhouse→T-Rex.

See `ROADMAP.md` and `PROGRESS.md` for full task history.
