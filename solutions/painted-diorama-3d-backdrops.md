# Painted-Art Backdrops in a 3D Diorama (Three.js)

> **Category:** rendering / art-direction
> **Created:** 2026-07-02
> **Keywords:** three.js, backdrop, wallpaper, texture, seams, tiling, bloom, terrain, painted, storybook
> **Related:** [`phaser-background-art-floor-alignment.md`](phaser-background-art-floor-alignment.md) — the 2D-era version of the exact same problem class (art-floor-line alignment), for the Phaser renderer

## Symptoms

- Feedback was diagnostic, not vague — worth reproducing verbatim because it maps directly onto the fixes:
  - "the brown floor, the wallpaper, just very blah" → engine can't fix an art problem.
  - "really clear seams between background images" → hard-edged planes butted together.
  - "double bed in a row" → mirror-tiling a furniture *composition* (not a pattern) clones the composition.
  - "this light is too bright" → bloom threshold catching more than intended highlights.
  - "gaps in the floor are really ugly and don't make sense" → pits showed raw page background.
  - "some are floating over the gap" → dressing placed by fixed fraction/cadence without floor awareness.
  - "it feels like a bunch of images put next to each other" (after all of the above were fixed) → the terrain — the thing the player's feet are actually on — was still flat placeholder boxes. Backgrounds were never the ceiling.

## Root Cause

Painting the *background* of a 3D scene is necessary but not sufficient. A storybook-quality diorama needs the painted treatment on the **terrain** too — the surfaces the camera and the player interact with most. Reference footage (this session: Mario Wonder screenshots) is the fastest way to see this: Wonder's skies are simple gradients: the beauty is entirely in the patterned, rounded, plush-lipped ground blocks.

Five distinct sub-problems, each with a narrow fix:

1. **Seams** — two adjacent unlit `PlaneGeometry` textures with a hard edge between them read as "images taped together," no matter how good each image is individually.
2. **Cloned furniture from mirror-tiling** — `MirroredRepeatWrapping` is correct for a *non-directional pattern* (wallpaper) and wrong for a *composition* (a painted room with a bed in it) — mirroring the composition literally duplicates the furniture.
3. **Bloom overreach** — `UnrealBloomPass` with too low a threshold or too high a strength blooms anything near-white (a lamp shade, a dress) into a blown-out fireball.
4. **Pit gaps to nowhere** — a level's kill-plane pits are usually just... absence. In a 2D game that's an off-screen respawn; in a 3D diorama the camera can see straight through the gap to the page background/void, which reads as broken.
5. **Floating dressing** — cadence/fraction-based prop placement (a good pattern for *density*) doesn't know where the floor actually is; it happily drops a lamp or a crate over a pit.

## Solution

### 1. Continuous wallpaper + once-per-cadence vignettes (kills seams + cloning)

Two-layer backdrop, not N independent planes:

```typescript
// Layer 1: ONE continuous plane across the whole world, tileable pattern only
const wallpaper = new THREE.Mesh(
  new THREE.PlaneGeometry(worldWidth, TILE_H),
  new THREE.MeshBasicMaterial({ map: wallpaperTex, color: TINT, fog: false }),
);
wallpaperTex.wrapS = wallpaperTex.wrapT = THREE.MirroredRepeatWrapping; // OK: pattern, not composition

// Layer 2: vignette "stations" on a cadence, cycling through paintings —
// never the SAME painting repeated adjacently, never mirrored.
for (let x = minX; x <= maxX; x += STEP) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    map: paintings[index % paintings.length],
    alphaMap: horizontalFadeGradient, // 1 in the middle, 0 at both edges
    transparent: true,
    depthWrite: false, // blends cleanly over the wallpaper layer
    fog: false,
  }));
  mesh.position.set(x, y, VIGNETTE_Z); // just in front of the wallpaper plane
}
```

- The `alphaMap` is a tiny (256×2) canvas gradient: black → white → white → black, generated once and shared across every vignette material. This is what makes a painting fade *into* the wallpaper instead of stopping at a hard edge.
- Tint the wallpaper (`color: 0xf0cfda` etc.) — an unlit raw swatch reads washed-out next to a fully-painted vignette, and its bright whites are exactly what a bloom pass catches as kaleidoscope blotches (see #3).

### 2. Dark under-floor plane (kills the pit-gap void)

```typescript
// Inside the floor mesh's z-range, so the floor occludes it everywhere
// EXCEPT where there's an actual gap.
const underFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(worldWidth, DEPTH),
  new THREE.MeshBasicMaterial({ map: verticalGradientTex /* warm shadow → deep dark */ }),
);
underFloor.position.set(worldCenterX, -DEPTH / 2, FLOOR_Z_INSIDE_RANGE);
```

A pit now reads as "a hole I could fall into," not "the renderer broke."

### 3. Pit-aware dressing (kills floating props)

Pass real floor ranges into the set builder instead of letting cadence loops assume solid ground:

```typescript
const floorRanges = level.platforms
  .filter(p => p.h >= FLOOR_THICKNESS_TELL)
  .map(p => [toWorldX(p.x), toWorldX(p.x + p.w)]);

const onFloor = (x, margin = 1) =>
  floorRanges.some(([a, b]) => x >= a + margin && x <= b - margin);

cadenceSpots(...).filter(x => onFloor(x, marginForThisPropSize)).forEach(...)
```

Wide single-item landmarks (a nightstand + rug) need the *widest* floor segment, not just any segment — snap to it rather than jittering blind.

### 4. Bloom threshold discipline

`UnrealBloomPass(resolution, strength, radius, threshold)` — raise `threshold` toward 1.0 and drop `strength` until only deliberate light sources (fairy lights, a glow disc, an exit-door halo) cross it. A dress or a carpet should never bloom. Verified numbers this session: `0.22 / 0.4 / 0.92` (down from an initial `0.35 / 0.5 / 0.85` that fireballed a lamp).

### 5. The terrain is the art (the real lesson)

Once 1–4 are fixed, a painted diorama can *still* feel like "pictures next to each other" if the platforms Eloise stands on are flat single-color boxes. The fix that actually closed the gap: give gameplay geometry the same painted treatment as the backdrop —

```typescript
// Quilted body (pattern only on the diorama-visible z faces — box UV mapping
// crushes a tiled pattern on the depth-spanning side/top/bottom faces).
const body = new THREE.Mesh(boxGeometry, [
  sideMat, sideMat, sideMat, sideMat, // ±x, ±y: solid color, no pattern
  quiltMat, quiltMat,                  // ±z: the patterned faces
]);

// Emissive-map lift so the pattern stays saturated even in shadow — the
// same trick that makes Mario Wonder's terrain read "flat-bright" instead
// of physically-shadowed-dark.
new THREE.MeshLambertMaterial({
  map: patternTex,
  emissive: 0xffffff,
  emissiveMap: patternTex,
  emissiveIntensity: 0.3–0.45,
});
```

Plus a rounded "plush lip" (a slab + two end cylinders, flush with the physics top) — the 3D equivalent of Wonder's grass-capped dirt blocks.

## Diagnostic heuristic (reusable beyond this project)

When a game "feels blah" and the user asks about switching engines/frameworks: compare their reference images to the current output **object-by-object**, not vibe-to-vibe. If every gap traces to color/pattern/shape choices that the current engine can already render (nothing in the reference requires Lumen/Nanite/raytracing), the ceiling is art direction, not the engine. State that diagnosis explicitly before writing any code — it changes what "done" looks like.

## Files

- `src/three/paintedBackdrop.ts` — continuous wallpaper + vignette-cadence backdrop
- `src/three/level3d.ts` — `buildUnderFloor`, `buildPlushPlatform`, `quiltTexture`, `plushTexture`
- `src/three/bedroomSet.ts` — `floors`-aware cadence dressing (`onFloor` helper)
- `src/three/main.ts` — `UnrealBloomPass` tuning, `floorRanges` derivation from `level.platforms`
- `docs/3d-transition/weezy3d-playbook.md` §5.7 — the per-world replication cookbook
