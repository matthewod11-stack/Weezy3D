## Learned User Preferences

- Test inside Cursor via `npm run dev` and the built-in browser preview; avoid stacks that require an external editor.
- Old `assets/` and ROADMAP are direction only — do not copy assets wholesale or replicate the abandoned project.
- Mario-style jump feel is a priority; keep tuned physics in `src/config/physics.ts` (asymmetric gravity, coyote time, jump buffer, variable jump).

## Learned Workspace Facts

- Princess Eloise: Phaser 3.80 + TypeScript (strict) + Vite 6; Zod-validated levels; web target (itch.io HTML5).
- Logical design is 320×180; game renders at **640×360** (`RENDER_SCALE = 2` in `src/config/game.ts`). Level coords are authored at design size and scaled via `scaleLevelData()` at load.
- Display uses **integer CSS scaling** (`applyIntegerScale` in `src/config/display.ts`) — 1×, 2×, etc. with letterboxing. Do not use `Phaser.Scale.FIT` (fractional upscale blurs) or manually resize the WebGL backing store.
- Procedural sprites use `FilterMode.NEAREST` in BootScene; illustrated backgrounds stay linear (`pixelArt: false`).
- Game state lives in `src/state/GameState.ts` (singleton outside scenes); reset progress with `eloiseReset()` in the browser console.
- Physics entities must call `scene.add.existing(this)` before `scene.physics.add.existing(this)` or they will not render.
- Player uses ~0.5×`RENDER_SCALE` on 48×72 frames with origin `(0.5, 1)` (~24×36 px in design space).
- HiDPI: integer CSS scale only; never call `renderer.resize()` outside ScaleManager.
- Level backgrounds: lazy-loaded via `levelCatalog.ts` / `LevelBackgroundLoader`; map with `BACKGROUND_ART_FLOOR` + viewport-height `setDisplaySize` in `GameScene.makeLevelBackdrop`; tune in `src/config/backgrounds.ts`.
- Platforms use uniform light blue tint: `src/config/platforms.ts` (`PLATFORM_TINT`).
- Cursor embedded preview needs canvas `tabindex`, pointerdown focus, and keyboard capture so controls work.
