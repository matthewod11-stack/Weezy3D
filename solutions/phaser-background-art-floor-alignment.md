# Phaser Level Background — Art-Floor Alignment

> **Category:** runtime-error / rendering
> **Created:** 2026-05-24
> **Keywords:** phaser, background, scale, cover, contain, platformer, hidpi

## Symptoms

- Level backgrounds showed only a blurry wood-grain or carpet strip instead of the full illustrated scene (bookshelves, toys).
- Tan or slate filler blocks appeared at level edges during area transitions.
- Spawn point sat outside the visible art when using centered `contain` scaling.
- Pit falls caused infinite respawn loops (separate but fixed same session).

## Root Cause

Story art is a tall illustration with the **playable floor line** at ~84% of source height (`BACKGROUND_ART_FLOOR`), not at the image bottom. Common Phaser patterns failed:

1. **`Math.max(sx, sy)` cover** — cropped to the bottom band (floor texture only).
2. **Centered contain** — kept full art but left spawn in letterbox filler.
3. **Bottom origin at world `maxY`** — misaligned when per-level spawn Y differs from design default.

HiDPI blur came from fractional `Scale.FIT` CSS upscale and manual `renderer.resize()` (breaks WebGL).

## Solution

### Display sharpness (`src/config/display.ts`, `src/config/game.ts`)

- Render at 2× design size (`RENDER_SCALE = 2` → 640×360 canvas).
- Use integer CSS scale only (`applyIntegerScale`); `Phaser.Scale.NONE`.
- `roundPixels: true`; NEAREST on procedural sprites only.

### Background framing (`src/config/backgrounds.ts`, `GameScene.makeLevelBackdrop`)

```typescript
// Scale: height fits viewport; width spans level + edge bleed
const displayH = viewportHeight;
const displayW = levelWidth + BACKGROUND_EDGE_BLEED * 2;

bg.setOrigin(0, BACKGROUND_ART_FLOOR); // e.g. 0.84 — carpet/shelf line in source art
bg.setPosition(minX - bleed, spawn.y); // anchor floor to actual spawn/platform line
bg.setDisplaySize(displayW, displayH);
```

- Left-align art (`minX - bleed`) so spawn always sees illustration.
- Camera: `setFollowOffset(lookAhead, -CAMERA_LOOK_UP)` to show upper shelves.
- Build new backdrop before destroying old one on transitions.
- Fill gaps with `BACKGROUND_FILL_COLOR` (slate), not tan wainscoting.

### Pit respawn (`Player.ts`, `GameScene.ts`)

- Call `body.reset(x, y)` on respawn.
- Pit grace period (~500ms) and death animation lock prevent kill-plane re-trigger.

## Tuning

- Adjust `BACKGROUND_ART_FLOOR` per area if floor line in art differs.
- Very wide levels may show side gaps or slight horizontal stretch — prefer gaps over wrong crop.

## Files

- `src/config/backgrounds.ts` — constants
- `src/scenes/GameScene.ts` — `makeLevelBackdrop()`
- `src/config/display.ts` — integer CSS scale
- `AGENTS.md` — workspace conventions
