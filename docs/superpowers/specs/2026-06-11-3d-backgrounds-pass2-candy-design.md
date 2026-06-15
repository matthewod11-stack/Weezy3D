# 3D Backgrounds Pass 2 — Candy-Fantastical Texture Pass

**Date:** 2026-06-11 · **Status:** Approved design
**Inspiration:** 3 user-generated concept JPEGs in repo root — `Bedroom.jpg`, `Kitchen.jpg`, `Living ROom.jpg`. Cartoony / fantastical / saturated; stimulus for design, not pixel targets.

## Goal

Re-theme all five 3D worlds' set dressing from the pass-1 "storybook muted" palette toward the inspiration images' candy-fantastical energy, using AI-generated textures applied to existing procedural geometry. Worlds are done **sequentially, one at a time, recording learnings** before moving on.

## Decisions (locked with user 2026-06-11)

1. **Approach: generated textures on geometry** — not backdrop murals, not procedural-only. Nano banana (Gemini image) output becomes texture maps on the existing meshes.
2. **Background wild, platforms grounded** — walls, windows, rugs, furniture dressing go full candy. Gameplay platforms/floor keep procedural surfaces (modest saturation bump allowed), crisp edges, front lips. A 4–8yo must always read what's standable.
3. **Recurring motifs across all worlds:**
   - **Porthole windows → fantasy hills**: round frames + emissive panes textured with a generated rolling-hills-and-clouds view. Family Room gets the night version (purple sky, stars).
   - **Magic sparkles & glow orbs**: procedural emissive sprites, seeded-LCG placement, drift via the theme `update()` hook.
   - **Anthropomorphic hero appliance**: one per world with a face — toy chest (bedroom), grandfather clock (hallway), teal fridge (kitchen), TV (family room), playhouse (backyard).
   - Toy cameos (red car etc.): explicitly **not** adopted as a cross-world motif.
4. **World order:** bedroom → hallway → kitchen → familyRoom → backyard. Bedroom is the pilot (gate-free, direct inspiration image). Hallway/backyard extrapolate the style with the 3 JPEGs as reference images.

## Pipeline

- `scripts/gen-texture.mjs` — calls the Gemini image API directly (`gemini-3-pro-image-preview`, same model the nanobanana MCP wraps; `GOOGLE_AI_API_KEY` from the user's shell env). Accepts: prompt, output path, optional reference image paths (the inspiration JPEGs ride along as style anchors on every call).
- Output: `assets/textures3d/<world>/<surface>.jpg|png`, imported as Vite asset URLs in each `src/three/<world>Set.ts`, loaded with `THREE.TextureLoader`.
- Generation is offline/one-time; runtime stays deterministic (no API calls in the game).
- Side fix: add `GOOGLE_AI_API_KEY` to the nanobanana-mcp `env` block in `~/.claude.json` so the MCP connects in future sessions.

## Texture targets per world

| Surface | Mesh | Material notes |
|---|---|---|
| Wallpaper | far wall plane (z≈−8) | `MirroredRepeatWrapping` both axes → any output tiles seam-free across ~500-unit worlds. Lit material; fog applies. |
| Porthole view | circle pane inside round frame geometry | **Emissive (`MeshBasicMaterial`)** so the outside world reads bright, like the inspirations. Frame is procedural geometry. |
| Hero appliance face | front face of a box, mid-depth (z≈−2.5..−5) | Generated front-on portrait of the appliance-with-a-face. Solid ends ≤ 0 per z-convention. |
| Rug strips | thin plane at mid-depth floor layer | Shag/rainbow look. Never standable. |
| Furniture accents | cabinet/shelf faces in dressing | Patchwork/candy fronts. Optional per world. |
| Platforms / floor | unchanged meshes | **No generated textures.** Procedural colors only; saturation bump ≤ modest. |

## Procedural additions

- Sparkle/orb system: small emissive sprites (canvas radial-gradient texture, no gen), seeded LCG positions through mid-depth volume, slow drift + twinkle in `update(dt, elapsed)` — same mechanism as fireplace flicker/stove breathing.
- Palette saturation pass on existing set colors where the textures alone don't carry it.

## Constraints (must hold)

- Diorama z-convention: solids end at z=0; flat actors float +0.05..0.2 (playbook §2).
- `fogNear ≥ 12` (pinned by `worldThemes.test.ts`).
- No `Math.random` in set code — seeded LCG only.
- Glow panes offset ≥0.05 from the surface behind (gotcha #11, z-fighting).
- The 2D game untouched; no Phaser imports in `src/three/`.

## Testing & verification

- New smoke test: a texture manifest per world — required files exist and import (mirrors the 2D `levelTextures.ts` pattern).
- `npm run build` (tsc + 340+ Vitest + 3-page build) gates each world before moving to the next.
- Visual verification per world: dev server → `?world=<id>` → `snapCamera()` → `preview_screenshot` at 2–3 representative segments → compare against inspiration. Numeric checks via `__weezy3d.scene` traversal for light/material values (gotcha #9).

## Process per world (the sequential loop)

1. Generate texture set (script, with reference JPEGs).
2. Wire into `<world>Set.ts` (+ porthole/hero-appliance/sparkle builders where missing — shared helpers extracted once bedroom proves them).
3. Screenshot vs inspiration; iterate prompts/wiring (expect 1–3 rounds).
4. Run build gate.
5. Append learnings to `docs/3d-transition/weezy3d-playbook.md` (prompt phrasing that worked, texture sizes, material settings).
6. Next world.

## Out of scope

- Characters/enemies port (§5.1), powers in 3D (§5.4), Playhouse boss arena backdrop (built with the boss port), depth-of-field/bloom post-processing (§5.5), any 2D-game changes.
