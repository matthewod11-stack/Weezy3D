# Storybook Character Art — Design Spec

**Date:** 2026-05-24
**Project:** Princess Eloise (Weezy2)
**Status:** Approved by user, ready for implementation plan

## Goal

Replace all procedurally-drawn character art in `src/scenes/BootScene.ts` with NanoBanana-generated storybook illustrations. Cover the full V1 cast: Eloise (player), 5 companions, 4 enemies, and the T-Rex boss.

The current procedural art (Eloise drawn with `fillRect` calls in TypeScript, ~48×72) looks rough and does not match the polished cottage-core pixel-art backgrounds. The user has approved a bigger overhaul: characters first in a new storybook-illustrated style, with backgrounds queued for a future redo.

## Style Direction

**Storybook illustrated** — painterly with soft watercolor textures, gentle outlines, warm picture-book lighting. Reference points: Princess and the Frog, Gris, classic children's picture-book illustration.

**Why this style:** Matches the princess subject matter, reads instantly at any size for the 4-8 audience (Eloise herself is ~3), is NanoBanana's strongest mode, and is more forgiving for cross-character consistency than pixel art.

**Trade-off acknowledged:** The existing backgrounds are cottage-core pixel art. Until backgrounds are also redone (future spec), characters will visually contrast with the world. This is an accepted intermediate state.

## Generation Pipeline

Sequential, with Eloise as the locked style anchor.

1. **Phase A — Eloise style lock** (2-4 attempts): Generate Eloise idle pose with the anchor prompt below. Iterate until she's right. Save the chosen image as `eloise-anchor.png`.
2. **Phase B — Eloise walk cycle** (6 frames): Pass `eloise-anchor.png` to NanoBanana as a style reference, request "the same character" in each of 6 walk-cycle poses plus idle and jump. Re-roll any frames that drift from the anchor.
3. **Phase C — Companions** (5 characters × ~1.5 generations each): For each companion, pass Eloise's anchor as a style reference and prompt for the companion. Single pose, transparent background.
4. **Phase D — 3-pose enemies** (T-Rex, Spider, Dust Bunny): Pass Eloise's anchor; generate idle / walk / attack poses per character.
5. **Phase E — Single-pose enemies** (Ant, Dust Mite): Same as Phase C.

**Key technique:** Every generation after Eloise's anchor includes that anchor image as a style reference. This is the mechanism that keeps the cast cohesive.

**Hard ceiling:** 60 total generations for the session. If quality is consistently bad, stop and reassess prompts rather than looping indefinitely.

## Character Roster

| # | Character | Role | Animation Tier | Description |
|---|---|---|---|---|
| 1 | Eloise | Player | 6-frame walk cycle + idle + jump (8 frames total) | Little girl ~3yo, short curly blonde hair, blue eyes, light blue princess dress with soft puffy short sleeves, silver/glass slippers, small silver crown |
| 2 | Teddy | Companion (Bedroom) | Single pose | Mustard-brown teddy bear, classic stuffed-toy proportions, friendly face |
| 3 | Dog | Companion (Hallway) | Single pose | Dalmatian (white with black spots), floppy ears, smiling |
| 4 | Horse | Companion (Kitchen) | Single pose | Light brown body, dark brown mane and tail, friendly expression |
| 5 | Cat | Companion (Family Room) | Single pose | White cat with pink bow on collar, soft fluffy fur |
| 6 | Flamingo | Companion (Living Room) | Single pose | Classic pink flamingo, long legs, S-curved neck |
| 7 | Dust Bunny | Enemy | 3 poses (idle / walk / attack) | A little bunny (not a dust ball), menacing-but-cartoonish, Bowser-lite |
| 8 | Ant | Enemy | Single pose | Menacing-but-cartoonish, angry-looking ant |
| 9 | Dust Mite | Enemy | Single pose | Ball-shaped, menacing-but-cartoonish, fuzzy |
| 10 | Spider | Enemy | 3 poses (idle / walk / attack) | Menacing-but-cartoonish, classic 8-legged spider |
| 11 | T-Rex | Boss (Dollhouse) | 3 poses (idle / walk / roar) | Green, big, Bowser-lite — clearly the bad guy but still kid-friendly |

**Frame counts:** Eloise 8 + companions 5 + dust bunny 3 + spider 3 + t-rex 3 + ant 1 + dust mite 1 = **24 unique frames**, plus ~6-16 iteration re-rolls = **~30-40 total generations**.

## Eloise Anchor Prompt

This is the literal prompt sent to NanoBanana in Phase A. It will be iterated.

> A storybook illustration of a 3-year-old princess named Eloise standing in a neutral idle pose, facing slightly to the side. She has short curly blonde hair, big bright blue eyes, rosy cheeks, and a warm friendly expression. She wears a light blue princess dress with soft puffy short sleeves and a slightly flared skirt, and a small silver crown. On her feet are sparkly silver/glass slippers. Painterly storybook art style — soft watercolor textures, gentle outlines, warm lighting, like a children's picture-book illustration. Full body, centered, transparent background. No shadow. Cohesive palette: light blue, blonde, silver, soft pink. 1024×1024.

**Iteration criteria — the anchor is "right" when:**
- Proportions read as toddler (large head, short limbs), not teen
- The light-blue dress is unambiguously light blue (not white, not navy, not turquoise)
- Hair is short and curly, not long or straight
- The image has a transparent background (no painted backdrop)
- The face is warm and friendly, not stoic or cute-to-the-point-of-creepy

## Output Format and Storage

| Aspect | Spec |
|---|---|
| Source generation size | 1024×1024 PNG, transparent background |
| In-game frame size | 64×96 px (33% larger than the current 48×72 procedural Eloise) |
| File format | Individual PNGs per frame |
| Naming convention | `eloise_idle.png`, `eloise_walk_0.png` … `eloise_walk_5.png`, `eloise_jump.png`; companions and enemies use `<name>_<pose>.png` (e.g., `teddy.png`, `dustbunny_idle.png`) |
| Location | New sibling folders under `assets/sprites/`: `player/storybook/`, `companions/storybook/`, `enemies/storybook/`, `bosses/storybook/` |

**Why individual files (not a spritesheet strip):** NanoBanana outputs one image per call. Assembling into a strip would cost a build step and lock frame dimensions early. Phaser handles per-image animation frames natively. Atlas packing is deferred to Phase 5 polish per ROADMAP.

**Why a sibling `/storybook/` folder (not overwriting existing assets):** Enables in-game validation, A/B comparison against the procedural baseline, and instant rollback if anything looks wrong. After approval, a future cleanup pass can flatten the folder structure and remove the procedural code paths.

## Code Integration Plan

### Files to modify

| File | Change |
|---|---|
| `src/scenes/BootScene.ts` | Add a `preload()` method that calls `this.load.image(...)` for every new sprite key. Delete the procedural `createEloiseFrameTexture` / `createTeddyTexture` / `createDustBunnyTexture` methods after PNG path is validated. |
| `src/scenes/BootScene.ts` (filtering) | Storybook PNGs use Phaser's default `LINEAR` filter, not `NEAREST`. Update `applyCrispFilters` to skip the storybook texture keys (keep `NEAREST` for the remaining procedural textures like planks and hearts). |
| `src/config/textures.ts` | Add texture-key constants for all 24 new sprite keys, namespaced by character. |
| `src/entities/Player.ts` | Define a Phaser `Animation` for Eloise's 6-frame walk cycle. Switch existing `setTexture` calls (currently using `eloiseFrameKey(n)`) to the new animation system. |
| `src/entities/Companion.ts` | Generalize the constructor to accept a texture key, so a single class can host all 5 companion types as the game grows. Today only Teddy exists; this widens the seam for the others without rewriting the class later. |
| `src/entities/DustBunny.ts` | Wire a 3-pose state machine (idle / walking / attacking) backed by the three new textures. Reusable pattern for Spider and T-Rex when those enemies are added per ROADMAP Phase 3.3. |

### Files NOT changed

- Levels JSON / `bedroomLevels.ts` — character spawns still reference logical names like `"teddy"`, `"dust_bunny"`; entity classes resolve those to texture keys.
- Physics, game loop, HUD, level loader — this is a visual swap only.

### Verification

1. `npm run typecheck` clean after each file change.
2. `npm run build` succeeds.
3. `npm run dev` — Eloise renders, walk cycle plays smoothly, no T-poses or missing-texture pink/black squares.
4. Manual playtest: walk → jump → land cycle reads naturally at 2× render scale; collision boxes still match visual.
5. Side-by-side A/B against procedural baseline: rename current `BootScene` to `BootSceneLegacy` temporarily, keep a feature flag to swap between them during validation. Remove the legacy path once approved.

## Out of Scope (deferred to future specs)

- Atlas packing (ROADMAP Phase 5 polish)
- Storybook background regeneration (deferred per the C-option choice — characters now, backgrounds later)
- Touch controls / mobile (ROADMAP Touch track)
- Additional enemy classes beyond Dust Bunny (Ant, Spider, Dust Mite, T-Rex) — sprites are generated as part of this spec, but the Enemy subclasses for Spider, Ant, Dust Mite, and T-Rex are tracked under ROADMAP 3.3 and the boss phase. This spec produces the art; subsequent specs wire them into gameplay.

## Acceptance Criteria

- 24 storybook PNG frames present in `assets/sprites/{player,companions,enemies,bosses}/storybook/` with transparent backgrounds, matching the anchor style.
- Eloise renders in-game via the new sprites; walk cycle, idle, and jump animations play correctly.
- Teddy companion renders via the new sprite.
- Dust Bunny enemy renders via the new sprites and switches poses based on state.
- The remaining 8 character sprites are generated, stored, and ready for wiring in subsequent specs.
- `npm run build` passes; `npm run typecheck` is clean.
- Procedural draw methods for Eloise, Teddy, and Dust Bunny in `BootScene.ts` are removed (after validation).
