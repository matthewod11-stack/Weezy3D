# Weezy3D World Backgrounds — Design Spec

**Date:** 2026-06-09
**Status:** Approved (brainstorm session 2, same day as the first 3D port)
**Depends on:** `docs/3d-transition/weezy3d-playbook.md` (conventions, gotchas, recipes §5.2/§5.3), `docs/art-direction/scenery-prompt-library.md` (per-world visual specs + atmosphere knobs)

## Goal

Every playable catalog level renders in the 3D diorama with its own world's set dressing, in the style proven by Bedroom Level 1. Four new world sets (Hallway, Kitchen, Family Room, Backyard) plus the level-select seam that makes them viewable. Built as a **pure inline loop** — one world per iteration, fully verified in-browser before the next — chosen over parallel subagents for aesthetic consistency and compounding learning.

## Non-Goals (explicit)

- **Characters:** no enemies, companions, or NPC ports. Follow-up pass (playbook §5.1).
- **Playhouse / boss arena:** World 6 has no scrolling levels and no 3D BossScene yet; its backdrop is built when the boss ports.
- **Per-level hero variation within a world:** sets are per-world (like `bedroomSet`), adapting to level width via `minX/maxX`. The library's per-level hero objects ("Shoe Canyon", "Sink Crossing") are a future variation hook.
- **Post-processing polish:** DoF, bloom, particles stay in the §5.5 backlog. Family Room's "bloom: fireplace only" knob is approximated with an animated PointLight, not a bloom pass.
- **Powers:** levels gated on double-jump/dash/etc. (Hallway 4–5 onward) may not be *completable* in 3D yet. That's fine — backgrounds are the deliverable; full traversal arrives with the powers port (§5.4).

## Current State (what this builds on)

- `src/three/main.ts` hardcodes `BEDROOM_LEVELS[0]` (line 28) and `buildBedroomSet` + `BEDROOM` fog (lines 42–58).
- `src/three/level3d.ts` hardcodes bedroom surfaces: carpet floor texture (`carpetTexture`, line 61), wood shelf color + lip (lines 95–116).
- `src/levels/levelCatalog.ts` already exports `LEVEL_CATALOG` (25 entries, `areaId` ∈ `bedroom | hallway | kitchen | familyRoom | backyard`), `getLevelEntry(index)`, `getNextLevelEntry(index)`.
- `bedroomSet.ts` (~320 lines) is the structural template: palette const block → wallpaper plane → mid-ground landmarks → floor clutter → foreground crumbs → lighting rig (ambient + shadow-casting key + cool fill + warm point pools). Seeded LCG, no image assets, z-layers per the playbook §2 glass-pane convention.

## Architecture

### A. World theme registry — `src/three/worldThemes.ts` (new)

```ts
export interface WorldSet {
  group: THREE.Group;
  sun: THREE.DirectionalLight;       // main loop re-targets to follow player
  sunTarget: THREE.Object3D;
  /** Optional per-frame hook: fireplace flicker, stove breathing, etc. */
  update?(dtMs: number, elapsedMs: number): void;
}

export interface WorldSurfaces {
  floorTexture(baseColor: string): THREE.Texture;  // replaces carpetTexture
  platformColor: number;                           // shelf/box face color
  lipColor: number;                                // front-edge trim
}

export interface WorldTheme {
  fogColor: number;
  fogNear: number;
  fogFar: number;
  /** Scene background; defaults to fogColor. Backyard overrides with sky blue. */
  background?: number;
  buildSet(minX: number, maxX: number): WorldSet;
  surfaces: WorldSurfaces;
}

export const WORLD_THEMES: Record<string, WorldTheme>; // keyed by areaId
export function themeForArea(areaId: string): WorldTheme; // falls back to bedroom
```

- Bedroom's entry wraps the existing `buildBedroomSet` + `BEDROOM` constants + current carpet/wood surfaces — **zero visual change to Level 1**.
- Scene background color = fog color (current behavior, kept).
- Fallback to the bedroom theme keeps the loop safe mid-build (a world without a set yet still loads and plays).

### B. Level select — `src/three/main.ts` (edit)

- `?level=n` query param (`URLSearchParams`), clamped to `0..LEVEL_CATALOG.length-1`, default `0`. Boot loads `getLevelEntry(n).raw` through the existing `parseLevelData` + `scaleLevelData` path.
- Theme lookup via `themeForArea(entry.areaId)` drives fog, background, set builder, and the `surfaces` passed to `buildLevel`.
- Main loop calls `set.update?.(dtMs, elapsed)` alongside `animateTokens`/`animateExit`.
- Win card gains **"Next level →"** when `getNextLevelEntry(n)` exists — navigates to `?level=n+1`. (Simple `location.search` navigation; full state reset for free.)
- `__weezy3d` debug handle gains `levelIndex` and `areaId` so verification scripts can assert which level/theme loaded.

### C. Surface theming — `src/three/level3d.ts` (edit)

`buildLevel(data: LevelData, surfaces?: WorldSurfaces)` — when omitted, behaves exactly as today (bedroom carpet/wood defaults). `buildPlatformMesh` and `buildShelfLip` take their texture/colors from the param, but level-authored `p.color` overrides keep highest precedence (today's `p.color ?? default` pattern, with the theme supplying the default). No geometry or physics changes; `solids` untouched.

### D. Four world sets — `src/three/{hallway,kitchen,familyRoom,backyard}Set.ts` (new)

Each mirrors the `bedroomSet.ts` skeleton verbatim. Palettes, moods, and hero objects from the scenery prompt library; light intensities from its atmosphere-knobs table.

| World | Surfaces | Backdrop + landmarks | Lighting signature | New technique |
|---|---|---|---|---|
| **Hallway** | hardwood planks + carpet runner strip | wall w/ baseboard + framed photos; bench, towering shoe rack; bright end-window | cool slate-blue ambient, dir 0.5; vanishing-point window glow | cool palette + depth cue |
| **Kitchen** | terracotta tile | cabinet faces + counter overhangs, chrome accents; **stove glowing orange-red mid-background** | warm white fog; hard overhead dir 1.0, ambient 0.3; saturated stove PointLight (the library's hero light) | hero accent light |
| **Family Room** | thick carpet (denser weave than bedroom) | sofa mass + cushions, entertainment center slabs; **fireplace** | amber fog; dir 0.7 fire-warm; fireplace PointLight with seeded-noise flicker via `update` | animated light |
| **Backyard** | grass (blade-speckle texture) | hedgerow walls, wooden playset, towering grass blades, flower patches | sky-blue background; **HemisphereLight** (sky/ground) + bright sun dir 1.4, crisp shadows | outdoor rig |

**Fog values:** the knobs table gives per-world near/far in world units, but the camera sits ~10.5 units off the gameplay plane — Bedroom shipped at 14/36 vs the table's 8/30 for exactly this reason. **Rule: fogNear must sit behind the gameplay plane.** Starting point = table value + the bedroom delta (+6/+6), e.g. Hallway 12/31; tune in-browser per world. Backyard's 15/60 is already past the plane — start it as-is.

**Conventions every set must hold (playbook §2):** solids end at z=0; dressing layers at wallpaper −8 / landmarks −5 / clutter −2.6 / foreground +1.9; seeded LCG (`makeRand`) — no `Math.random`; palette-locked, no image assets; exactly one shadow-casting DirectionalLight per set (the `sun`).

## Process: the inline loop

Iteration order — **Hallway → Kitchen → Family Room → Backyard** — is game order *and* ascending lighting difficulty, so each world's technique feeds the next. Seam ships first as iteration 0.

Each iteration:
1. Write/extend the world's `<world>Set.ts` + registry entry.
2. `npx tsc --noEmit` + `npx vitest run` (typecheck noise mid-batch from the post-edit hook is expected; trust the final run — playbook gotcha #6).
3. Load the world's **first** and **widest** levels via `?level=`; settle-poll (player x stable; gotcha #4) before any screenshot.
4. Screenshot spawn / mid / exit; fix composition (occlusion vs z-convention, scale, light spill).
5. `npm run build` (full gate) — then send the user the world's screenshot gallery. Non-blocking: continue to the next world; the user can redirect between iterations.

Feel-tuning (fog, intensities, camera) is the user's call — surface the knob locations, don't silently re-tune (playbook §6).

## Testing

- **New `src/three/worldThemes.test.ts`:** (a) every `areaId` in `LEVEL_CATALOG` resolves to a theme; (b) all 25 catalog levels survive `parseLevelData` + `scaleLevelData` (the 3D twin of the 2D `levelTextures` smoke test); (c) `themeForArea` falls back to bedroom for unknown ids.
- **Existing 13 physics tests stay green** — no physics or coords code is touched.
- **Set builders get no unit tests by design:** their output is visual and has no meaningful seam without a renderer (jsdom lacks usable 2D canvas for `CanvasTexture` paths). The screenshot pass is their verification. This is a documented architecture note, not an omission (per `rules/testing.md` "When Regression Tests Have No Seam").

## Acceptance Criteria

1. `?level=n` loads any of the 25 catalog levels; default (no param) is bit-identical Bedroom Level 1.
2. Each of the 4 new worlds renders its own set + surfaces + fog, obeying the z-convention (player never occluded — verified by teleport + screenshot at platform edges).
3. Win card chains to the next level when one exists.
4. `npm run build` green: tsc + full Vitest suite (340 + new theme tests) + 3-page Vite build.
5. Screenshot gallery delivered per world; playbook §1/§5.3, PROGRESS.md, CLAUDE.md status updated.

## Risks / Open Edges

- **Power-gated levels** (Hallway 4+, Kitchen, Family Room 5, Backyard) can be *entered and viewed* but not finished without the powers port. Verification uses teleport, not full runs, for those.
- **Backyard's HemisphereLight** is the biggest departure from the indoor rig; if shadows or tone-mapping fight it, fall back to a strong sky-colored ambient + sun and note it for the polish pass.
- **`familyRoom` camelCase** in `areaId` (not `family_room`) — registry keys must match the catalog exactly; the coverage test pins this.
