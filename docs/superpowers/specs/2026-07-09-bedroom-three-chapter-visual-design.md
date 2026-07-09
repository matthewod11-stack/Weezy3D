# Bedroom Three-Chapter Reactive Storybook Design

**Date:** 2026-07-09

**Status:** Draft for written-spec review; composition, seam, reaction, and production directions approved in the visual companion

**Parent goal:** Lock Bedroom as the production visual/immersion benchmark, turn the result into the world-building cookbook, then apply that cookbook to the shortened remaining worlds.

## Goal

Rebuild the Bedroom's background presentation as one seamless left-to-right room with **three newly generated panoramic chapters** spanning the existing **five gameplay segments**. Preserve the level's current length, physics, controls, checkpoints, enemies, routes, and token layouts. Add restrained reactive storybook motion and a temporary sound layer so the world notices Eloise, grows in wonder, and celebrates Teddy without becoming visually noisy.

The Bedroom becomes the proof point for a repeatable production recipe. It is not complete when the files merely load: it is complete only after seam inspection, full-browser playtesting, scene/performance checks, regression tests, a green production build, cookbook updates, and the user's final feel verdict.

## Approved concept studies

These 3:2 images are **composition keyframes**, not runtime crops and not old backdrops forced into a new layout:

1. [Play Area](assets/bedroom-three-chapter/chapter-1-play-area-v2.png) — segments 1–2
2. [Through Crib](assets/bedroom-three-chapter/chapter-2-through-crib.png) — segment 3
3. [Bookshelf Window Finale](assets/bedroom-three-chapter/chapter-3-bookshelf-window.png) — segments 4–5

The Play Area keyframe contains a small activity table. The table is **not** part of the production Bedroom; reserve that motif for a future level. The final Play Area panorama replaces that visual weight with the shared floor lamp and keeps a clear central traversal lane.

## Locked product decisions

1. **Reactive Storybook, not Traversal Theater.** Background life supports the platforming; the room does not transform into a ride or scripted camera sequence.
2. **Wonder Escalation.** Color, light, motion, and musical energy rise from soft morning play to lavender crib magic to the golden window/Teddy finale.
3. **Three visual chapters, five gameplay beats.** Image boundaries and gameplay checkpoints are separate structures.
4. **Generate three new panoramas.** Do not reuse, mirror, cycle, or stretch the existing five Bedroom compositions.
5. **Two shared bridge anchors.** A warm floor lamp bridges Play Area → Crib; a tall fairy-lit plant bridges Crib → Finale.
6. **One quiet wake-up plus one signature flourish per gameplay segment.** After firing, a segment settles into a slightly livelier idle; it never loops at full intensity.
7. **Same level length.** The stitched Bedroom remains 250 world units with five checkpoints.
8. **Private-family placeholder audio is allowed.** SuperEloise's Mario-derived recordings may be used as temporary cues for this family-only game, but they stay isolated behind an adapter and retain a replace-later provenance note.

## World and panorama contract

The stitched Bedroom is 250 world units. Its current five segment widths are 44, 48, 50, 48, and 60 units.

| Visual chapter | Gameplay coverage | Narrative coverage | Runtime source extent | Runtime texture |
|---|---:|---|---:|---:|
| Play Area | Segments 1–2 | 0–92 | 0–98 | 3136×512 |
| Through Crib | Segment 3 | 92–142 | 86–148 | 1984×512 |
| Bookshelf Window Finale | Segments 4–5 | 142–250 | 136–250 | 3648×512 |

Each seam therefore has a 12-unit shared band:

- Lamp overlap: x=86–98, centered on the chapter boundary at x=92.
- Plant overlap: x=136–148, centered on the chapter boundary at x=142.

The complete bridge object is generated in both neighboring source strips. The conceptual chapter cut passes through its center, but runtime does not butt two literal half-objects together. Instead, complementary alpha ramps crossfade matching wallpaper, carpet, light, and silhouette across the full overlap.

### Camera and room-line lock

All source generations share one immutable room brief:

- Strict orthographic side view; no visible side walls and no deep floor perspective.
- Carpet-to-wall line fixed at 85% of image height (15% carpet below it).
- Identical furniture scale, camera height, wallpaper scale, floor texture scale, and neutral exposure.
- Continuous butterfly/botanical wallpaper family and pink carpet across all chapters.
- Traversal lane stays calm behind platforms, pits, tokens, enemies, Eloise, and Teddy.
- Furniture remains background architecture, never a false standable surface.
- Light direction transitions gradually from morning blush to lavender-gold to warm finale; it cannot flip direction at a seam.

## Panorama generation and bake pipeline

### 1. Generate at master density

Use 64 source pixels per world unit at 1024px room height. Expected master strips:

- Plate 1: 6272×1024
- Plate 2: 3968×1024
- Plate 3: 7296×1024

Build each strip left-to-right from overlapping generation frames. Every new frame receives the accepted boundary crop from the previous frame plus the immutable room brief. Within a chapter, use 15–20% frame overlap. At a chapter seam, both neighboring prompts receive the same accepted lamp or plant anchor reference.

### 2. Reject generation defects at source

Regenerate or outpaint again when any of the following appears:

- Floor line, wallpaper scale, furniture scale, or exposure jumps.
- Perspective floor, visible room corner, or camera-angle drift.
- Duplicated crib, bed, bookshelf, window, lamp, plant, or large toy cluster.
- Bridge-object silhouette, pot/base, shade, or light direction disagrees across the overlap.
- Activity table returns to the production Play Area.
- A furniture edge or high-contrast decoration hides a pit, platform lip, token row, enemy, companion, or exit.

Do not use runtime blur, heavy feathering, or extra furniture to conceal a failed source seam.

### 3. Bake runtime textures

Downsample approved master strips to 32 pixels per world unit and encode as high-quality progressive JPEGs. At the game's 640×360 render size, this preserves one source pixel per rendered background pixel at ordinary framing without carrying oversized textures.

The three runtime textures total approximately 4.49 million pixels, or about 18 MB decoded as RGBA before the existing wallpaper fallback. This is below the current five-vignette pixel count and each texture remains below an 8192px maximum dimension.

## Runtime backdrop architecture

### Chapter manifest

Replace Bedroom's fixed 34-unit backdrop cadence with a typed chapter manifest. Each entry declares:

- chapter id and texture URL;
- first and last gameplay segment indices;
- left/right overlap in world units;
- art floor fraction;
- optional bridge id;
- alpha-ramp direction.

Placement derives from `WorldSegment.startX` and `WorldSegment.endX`. The manifest groups segments 1–2, 3, and 4–5, then adds the approved six-unit overscan on either side of internal boundaries. No chapter uses a hard-coded absolute width independent of the stitched level.

### Rendering layers

1. **Continuous fallback wallpaper** at the deepest z layer covers camera overscroll, unloaded textures, and subpixel alpha edges.
2. **Three chapter planes** sit in front of the wallpaper and map one texture across their exact world extents.
3. **Complementary seam alpha maps** blend the two neighboring chapter planes only in their 12-unit overlap.
4. **Reactive overlays** sit in front of the paintings but behind gameplay. These lightweight toy, lamp, mobile, plant, book, and window elements own animation; the panoramas own composition.

The existing five-vignette imports and the `STEP = 34` cycling loop are retired for Bedroom. Other worlds keep their current renderer until they enter the cookbook rollout.

### Seam behavior

- Crossfade weights must sum to approximately 1.0 throughout an overlap.
- The blend is linear or gently smooth-stepped; it cannot create a brightness dip in the middle.
- A bridge object's reactive overlay uses one runtime instance centered at the seam, not one instance per chapter.
- Checkpoint respawn can land inside a chapter but never inside an undefined art region.
- Camera overscroll at world start and exit always exposes intentional art or fallback wallpaper, never transparent black.

## Five-beat Reactive Storybook contract

Every beat has four states: `dormant`, `nearby`, `fired`, and `settled`. Proximity may move a beat from dormant to nearby. A signature trigger fires at most once per complete Bedroom run. Checkpoint respawns retain fired/settled room memory; an explicit full level reset returns all beats to dormant.

| Segment | Existing gameplay lesson | Quiet nearby behavior | Signature trigger | Signature flourish | Settled behavior |
|---|---|---|---|---|---|
| 1 | First movement and jump | Tiny block/toy anticipation; butterflies stir | First executed jump | Blocks bob and two or three butterflies lift from the wallpaper | A few butterflies continue a slow local drift |
| 2 | First dust-bunny encounters | Toy eyes/parts subtly orient toward Eloise | First successful stomp | Toys hop, train wheels turn briefly, and the seam lamp warms | Lamp retains a low warm glow |
| 3 | Low/high route choice through crib | Mobile barely turns; crib lights breathe | Eloise crosses the crib midpoint | Mobile makes one starry orbit and crib rails shimmer left-to-right | Mobile continues at a very slow rotation |
| 4 | First real pit confidence | Plant lights twinkle near the base | Eloise clears the first pit from left to right | Fairy lights race up the plant and nearby books glow in sequence | Sparse lights remain active in upper leaves/books |
| 5 | Finale and Teddy | Window particles gather; door glow breathes | Teddy is collected | Round window blooms, books answer, door brightens, and sparkles sweep toward the exit | Finale remains luminous through the exit win state |

Triggers use existing simulation facts and explicit crossing logic, not animation timing guesses. A buffered jump that never executes does not fire segment 1. A fall into the segment-4 pit does not fire the successful-clear flourish.

## Audio contract

### Placeholder source

The local reference repo is `/Users/homebase/Documents/SuperEloise/upstream-super-mario-python`. Its `sfx/` folder supplies temporary OGG/WAV recordings and `classes/Sound.py` supplies the cue model. The assets are for the private family build, not evidence of an open-content license.

Copy or import them into one clearly named placeholder asset directory and document the source. All game code references semantic cue ids through an audio adapter; no gameplay system imports a SuperEloise filename directly.

### Semantic cue map

| Game event | Temporary recording | Playback rule |
|---|---|---|
| Standard jump | `small_jump.ogg` | Once on `justJumped`; modest volume |
| Dust-bunny stomp | `stomp.ogg` | Once on confirmed enemy defeat |
| Token pickup | `coin.ogg` | Short overlap allowed; small deterministic pitch variation prevents fatigue |
| Hard impact/smash | `bump.ogg` or `brick-bump.ogg` | Only for a confirmed impact event |
| Pit reset | `death.wav` | Trim or attenuate if it reads too harsh for young players |
| Reactive magic rise | `powerup_appears.ogg` | Lamp/plant/crib one-shot; never on proximity idle |
| Teddy collected | `powerup.ogg` | Duck music briefly beneath the reward |
| Exit transition | `pipe.ogg` | Optional; use only if it supports the door rather than reading literally as a pipe |
| Bedroom music | `main_theme.ogg` | Low-volume loop after user gesture; reference placeholder only |

Music and SFX use separate gain buses with a master mute. AudioContext initialization occurs only after the first pointer, keyboard, or gamepad interaction. A failed decode or blocked AudioContext leaves the game fully playable and logs one actionable warning rather than throwing or retrying every frame.

The final sound identity remains toybox/storybook: felt mallets, music box, glockenspiel, soft spring, plush thump, and warm chime. Placeholder file replacement must not require gameplay-code edits.

## Existing Level 1 defect closure

The production pass also closes the verified defects already named by the parent goal:

- Full art coverage at the opening and exit.
- Pit cavities and far edges remain visually legible against the panoramas.
- Bright background elements do not clip or bloom over Eloise and tokens.
- Edge-on tokens retain readable star silhouettes from ordinary camera angles.
- Shared bridge objects do not become false platforms or collision objects.
- Bedroom lights stay at or below the existing six-light budget.
- Decorative clutter does not regain unnecessary shadow casting.

## Failure handling

- **Texture load failure:** keep fallback wallpaper visible, hide only the failed chapter plane, and issue one warning naming the chapter URL.
- **Invalid manifest coverage:** fail a pure validation test and refuse the Bedroom chapter renderer in development; production falls back to wallpaper rather than rendering gaps.
- **Seam mismatch discovered in browser:** reject and regenerate the art source. Do not add a stronger alpha blur as a code workaround.
- **Audio load/decode failure:** disable only that semantic cue; visuals and controls continue.
- **Autoplay blocked:** remain silent until the next valid user gesture; do not queue a burst of stale sounds.
- **Performance regression:** first reduce reactive overlay count and particle density. Do not reduce platform readability or reintroduce repeated vignette cadence.

## Verification and acceptance gates

### Automated tests

- Chapter grouping derives exactly 1–2 / 3 / 4–5 from `WorldSegment` data.
- Coverage begins at world x=0, ends at x=250, and has no uncovered interval.
- Both internal overlaps are exactly 12 world units and alpha weights remain continuous.
- Bedroom loads three unique chapter URLs; no image cycling or adjacent duplicate chapter id is possible.
- Reactive beats fire once per full run, survive checkpoint respawn, and reset on explicit level reset.
- Jump, stomp, midpoint, successful-pit-clear, and Teddy triggers reject their false-positive cases.
- Audio adapter maps semantic cues, respects mute/gain, and fails silently on unavailable buffers.

### Browser visual checks

Capture representative screenshots at:

1. opening spawn;
2. middle of segment 1;
3. before, inside, and after the lamp overlap;
4. crib low and high routes;
5. before, inside, and after the plant overlap;
6. segment-4 pits;
7. Teddy before/after collection;
8. exit overscroll and win framing.

The normal-speed run must reveal no floor-line jump, lighting flash, doubled bridge object, repeated landmark, transparent gap, or false platform read.

### Runtime and build checks

- Zero uncaught console errors and no repeated asset warnings.
- Three chapter meshes plus the continuous wallpaper; no hidden cadence copies.
- Bedroom lights ≤6 and shadow-caster budget does not regress.
- Scene census and representative frame-time sampling remain within the current Bedroom envelope.
- `npm run build` passes TypeScript, the complete Vitest suite, and Vite production build.
- Final human feel-playtest approves composition, seam invisibility, reaction restraint, audio balance, pit readability, and finale payoff.

## Cookbook output

After the Bedroom passes, update the visual-immersion cookbook and project progress docs with:

- the three-chapter/five-beat separation;
- master/runtime pixels-per-unit recipe;
- overlap and bridge-anchor generation method;
- prompt invariants and rejected prompt patterns;
- semantic reaction state machine and trigger selection rules;
- audio adapter and placeholder-replacement workflow;
- scene/performance budgets;
- screenshot stations and browser-verification commands;
- failure fallbacks and tuning knobs.

Only then shorten and transform Hallway, Kitchen, Family Room, and Backyard one world at a time. Each world keeps a distinct identity and must pass the same technical and human-verdict gates.

## Explicitly out of scope

- Changing Bedroom length, physics, controls, checkpoints, enemies, token layouts, or route design.
- Reusing the old five backdrop compositions in the three new panoramas.
- Repeating a bed, crib, bookshelf, window, lamp, plant, or activity-table motif to fill space.
- The activity table in Bedroom production; save it for a future level.
- Traversal Theater, camera rides, room transformations, or moving collision architecture.
- Shipping the same placeholder audio as a declared final/original soundtrack if the project's distribution scope changes.
- Transforming worlds 2–5 before Bedroom and its cookbook pass the approval gates.

## Implementation sequence after written-spec approval

1. Generate/outpaint the three master panorama strips with their shared lamp and plant bands.
2. Present full-width seam proofs and obtain the user's visual verdict.
3. Bake runtime textures and add chapter-manifest validation tests.
4. Replace the Bedroom cadence backdrop renderer with the three chapter planes and complementary overlaps.
5. Add the five-beat reactive state machine and overlays.
6. Add the isolated semantic audio adapter and SuperEloise placeholders.
7. Close the opening, pit, highlight, token, and exit defects.
8. Run automated, browser, screenshot, scene-census, performance, audio, and build gates.
9. Obtain the final human feel verdict and freeze the Bedroom cookbook.
10. Continue the parent goal through shortened worlds 2–5.
