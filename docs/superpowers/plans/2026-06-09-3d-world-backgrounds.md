# Weezy3D World Backgrounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **THIS PROJECT HAS NO GIT** (Weezy3D is an intentionally untracked testbed). Every "commit" step is replaced by the build gate: `npx tsc --noEmit` per task, `npm run build` at each task's end. Do not `git init`.
>
> **Execution mode (user-chosen):** pure inline loop, one world per task, fully verified in-browser before the next. NOT parallel subagents.
>
> **Read first:** `docs/3d-transition/weezy3d-playbook.md` (§2 conventions, §3 gotchas, §4 verification recipes) and `docs/art-direction/scenery-prompt-library.md`. Spec: `docs/superpowers/specs/2026-06-09-3d-world-backgrounds-design.md`.

**Goal:** Every one of the 25 catalog levels loads in the 3D diorama via `?level=n` with its own world's procedural set dressing, fog, and floor/platform surfaces.

**Architecture:** A `WorldTheme` registry (`worldThemes.ts`) maps catalog `areaId` → fog + set builder + surface materials, with bedroom as fallback. `level3d.ts` gains an optional `WorldSurfaces` param (bedroom defaults). `main.ts` reads `?level=`, wires the theme, and calls an optional per-frame `set.update()` hook (fireplace flicker, stove breathing). Four new set files mirror the `bedroomSet.ts` skeleton.

**Tech Stack:** Three.js 0.1xx (already installed), TypeScript strict, Vitest, Vite multi-page. No new dependencies, no image assets — all procedural canvas textures + primitives, seeded LCG only.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/three/level3d.ts` | Modify | `WorldSurfaces` interface + `DEFAULT_SURFACES` (today's carpet/wood); thread through platform/floor/lip builders |
| `src/three/worldThemes.ts` | Create | `WorldSet`/`WorldTheme` interfaces, `WORLD_THEMES` registry, `themeForArea` fallback |
| `src/three/worldThemes.test.ts` | Create | Registry coverage, fog-near rule, fallback, 25-level parse/scale smoke |
| `src/three/main.ts` | Modify | `?level=n` select, theme wiring, `set.update?.()`, `set.sunOffset`, debug handle additions, next-level nav |
| `src/three/hud.ts` | Modify | Optional "Next level →" button on the win card |
| `src/three/hallwaySet.ts` | Create | World 2 set + surfaces (Task 4) |
| `src/three/kitchenSet.ts` | Create | World 3 set + surfaces (Task 5) |
| `src/three/familyRoomSet.ts` | Create | World 4 set + surfaces (Task 6) |
| `src/three/backyardSet.ts` | Create | World 5 set + surfaces (Task 7) |
| playbook / PROGRESS.md / CLAUDE.md | Modify | Doc sweep (Task 8) |

**Catalog index map (for `?level=n`):** bedroom 0–4 · hallway 5–9 · kitchen 10–14 · familyRoom 15–19 · backyard 20–24. `areaId` strings are exactly: `bedroom`, `hallway`, `kitchen`, `familyRoom` (camelCase!), `backyard`.

**Known hook noise:** the post-edit TS hook typechecks after *each* edit — mid-batch "unused variable" errors are expected; trust the final `npx tsc --noEmit` (playbook gotcha #6).

---

### Task 1: `WorldSurfaces` seam in level3d.ts

**Files:**
- Modify: `src/three/level3d.ts`

- [ ] **Step 1: Add the interface + defaults and thread the param**

In `src/three/level3d.ts`, add after the `TOKEN_Z` export (~line 44):

```ts
/** Per-world skin for the gameplay geometry. Level-authored p.color always wins. */
export interface WorldSurfaces {
  /** Floor texture base when the platform has no authored color. */
  floorBase: string;
  floorTexture(baseColor: string): THREE.Texture;
  platformColor: number;
  lipColor: number;
}

export const DEFAULT_SURFACES: WorldSurfaces = {
  floorBase: "#d4a574",
  floorTexture: carpetTexture,
  platformColor: 0xe8c9a0,
  lipColor: 0xb8804a,
};
```

Change `buildPlatformMesh` (line 90) to:

```ts
function buildPlatformMesh(
  p: LevelData["platforms"][number],
  isFloor: boolean,
  surfaces: WorldSurfaces,
): THREE.Mesh {
  const { cx, cy, w, h } = rectCenterWorld(p);
  const depth = isFloor ? FLOOR_DEPTH : SHELF_DEPTH;
  const zCenter = isFloor ? FLOOR_Z_CENTER : SHELF_Z_CENTER;

  const material = isFloor
    ? new THREE.MeshLambertMaterial({ map: surfaces.floorTexture(p.color ?? surfaces.floorBase) })
    : new THREE.MeshLambertMaterial({ color: new THREE.Color(p.color ?? surfaces.platformColor) });
  // … rest unchanged
```

Note: `new THREE.Color(p.color ?? surfaces.platformColor)` accepts both the string override and the numeric default — same behavior as today for bedroom.

Change `buildShelfLip` (line 108) to take `(p, surfaces: WorldSurfaces)` and use `color: surfaces.lipColor`.

Change `buildLevel` (line 181) signature to:

```ts
export function buildLevel(data: LevelData, surfaces: WorldSurfaces = DEFAULT_SURFACES): LevelBuild {
```

…and pass `surfaces` to `buildPlatformMesh(p, isFloor, surfaces)` and `buildShelfLip(p, surfaces)`.

- [ ] **Step 2: Gate**

Run: `npx tsc --noEmit` → clean. Run: `npx vitest run` → all 340 pass (no test touches level3d directly; this proves no import breakage).

---

### Task 2: `worldThemes.ts` registry (TDD)

**Files:**
- Create: `src/three/worldThemes.test.ts`
- Create: `src/three/worldThemes.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { RENDER_SCALE } from "../config/game";
import { LEVEL_CATALOG } from "../levels/levelCatalog";
import { parseLevelData, scaleLevelData } from "../types/level";
import { themeForArea, WORLD_THEMES } from "./worldThemes";

describe("world themes", () => {
  it("registers the bedroom theme with the shipped fog values", () => {
    const theme = WORLD_THEMES.bedroom;
    expect(theme).toBeDefined();
    expect(theme!.fogNear).toBe(14);
    expect(theme!.fogFar).toBe(36);
  });

  it("falls back to bedroom for unknown areas", () => {
    expect(themeForArea("not-a-world")).toBe(WORLD_THEMES.bedroom);
  });

  // The camera sits ~10.5 units off the gameplay plane; fog must start
  // behind it or the play layer itself fogs out (why Bedroom shipped 14/36,
  // not the library's 8/30). Every registered theme obeys this.
  it("every registered theme keeps fogNear behind the gameplay plane", () => {
    for (const [area, theme] of Object.entries(WORLD_THEMES)) {
      expect(theme.fogNear, `${area} fogNear`).toBeGreaterThanOrEqual(12);
    }
  });

  it("all 25 catalog levels parse and scale for the 3D loader", () => {
    expect(LEVEL_CATALOG.length).toBe(25);
    for (const entry of LEVEL_CATALOG) {
      const scaled = scaleLevelData(parseLevelData(entry.raw), RENDER_SCALE);
      expect(scaled.platforms.length, entry.backgroundKey).toBeGreaterThan(0);
      expect(scaled.bounds.maxX).toBeGreaterThan(scaled.bounds.minX);
    }
  });
});
```

(Full per-area coverage — "every catalog areaId has its own entry, no fallback" — is deliberately added in Task 7 once all four worlds exist; each world task adds its own entry-exists test first.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/three/worldThemes.test.ts` → FAIL: cannot resolve `./worldThemes`.

- [ ] **Step 3: Implement the registry**

Create `src/three/worldThemes.ts`:

```ts
import type * as THREE from "three";
import { BEDROOM, buildBedroomSet } from "./bedroomSet";
import { DEFAULT_SURFACES, type WorldSurfaces } from "./level3d";

/**
 * Per-world theme registry — keyed by LevelCatalogEntry.areaId. Maps each
 * world to its fog, set builder, and gameplay-surface skin. Unknown areas
 * fall back to bedroom so a world without a set yet still loads and plays.
 */

export interface WorldSet {
  group: THREE.Group;
  /** Shadow-casting key light — main loop re-targets it to follow the player. */
  sun: THREE.DirectionalLight;
  sunTarget: THREE.Object3D;
  /** Key-light offset from the player (world units). Bedroom's lamp angle is (7, 11, 8). */
  sunOffset: { x: number; y: number; z: number };
  /** Optional per-frame hook: fireplace flicker, stove breathing, etc. */
  update?(dtMs: number, elapsedMs: number): void;
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

const BEDROOM_SUN_OFFSET = { x: 7, y: 11, z: 8 };

export const WORLD_THEMES: Record<string, WorldTheme> = {
  bedroom: {
    fogColor: BEDROOM.fogColor,
    fogNear: BEDROOM.fogNear,
    fogFar: BEDROOM.fogFar,
    buildSet: (minX, maxX) => ({ ...buildBedroomSet(minX, maxX), sunOffset: BEDROOM_SUN_OFFSET }),
    surfaces: DEFAULT_SURFACES,
  },
};

export function themeForArea(areaId: string): WorldTheme {
  return WORLD_THEMES[areaId] ?? WORLD_THEMES.bedroom!;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/three/worldThemes.test.ts` → 4 pass. Then `npx tsc --noEmit` → clean.

---

### Task 3: Level select + theme wiring + next-level button

**Files:**
- Modify: `src/three/main.ts`
- Modify: `src/three/hud.ts`

- [ ] **Step 1: hud.ts — optional next button**

Change the constructor (line 12) to `constructor(private onReplay: () => void, private onNext: (() => void) | null = null)`.

In `showWin` after the replay `button` is created (line 105), add:

```ts
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:14px;justify-content:center";
    row.appendChild(button);
    if (this.onNext) {
      const next = document.createElement("button");
      next.textContent = "Next level →";
      next.style.cssText = button.style.cssText + ";background:#6b8f5a";
      next.addEventListener("click", () => this.onNext!());
      row.appendChild(next);
    }
    card.append(title, stars, row);
```

(Replace the existing `card.append(title, stars, button)` line.)

- [ ] **Step 2: main.ts — level select + theme**

Replace the imports of `BEDROOM_LEVELS`/`bedroomSet` (lines 4, 15) with:

```ts
import { getLevelEntry, getNextLevelEntry, LEVEL_CATALOG } from "../levels/levelCatalog";
import { themeForArea } from "./worldThemes";
```

Replace line 28 (`const level = scaleLevelData(...BEDROOM_LEVELS[0]...)`) with:

```ts
  const params = new URLSearchParams(window.location.search);
  const requested = Number.parseInt(params.get("level") ?? "0", 10);
  const levelIndex = Math.min(
    Math.max(Number.isNaN(requested) ? 0 : requested, 0),
    LEVEL_CATALOG.length - 1,
  );
  const entry = getLevelEntry(levelIndex)!;
  const theme = themeForArea(entry.areaId);
  const level = scaleLevelData(parseLevelData(entry.raw), RENDER_SCALE);
```

Replace the fog/background lines (42–43) with:

```ts
  scene.background = new THREE.Color(theme.background ?? theme.fogColor);
  scene.fog = new THREE.Fog(theme.fogColor, theme.fogNear, theme.fogFar);
```

Replace `buildLevel(level)` (line 53) with `buildLevel(level, theme.surfaces)` and `buildBedroomSet(worldMinX, worldMaxX)` (line 58) with `theme.buildSet(worldMinX, worldMaxX)`.

In `updateCamera` (line 109), replace the hardcoded sun offset with:

```ts
    set.sun.position.set(
      toWorldX(player.x) + set.sunOffset.x,
      set.sunOffset.y,
      set.sunOffset.z,
    );
```

HUD construction (line 72) becomes:

```ts
  const hasNext = getNextLevelEntry(levelIndex) !== undefined;
  const hud = new Hud(
    () => resetLevel(),
    hasNext ? () => { window.location.search = `?level=${levelIndex + 1}`; } : null,
  );
```

In `frame()`, after `animateExit(build, elapsed)` (line 196), add: `set.update?.(dtMs, elapsed);`

In the `__weezy3d` debug handle, add:

```ts
    levelIndex,
    areaId: entry.areaId,
    bounds: { ...level.bounds },
```

- [ ] **Step 3: Gates**

`npx tsc --noEmit` → clean. `npx vitest run` → 344 pass. `npm run build` → green (3 pages).

- [ ] **Step 4: In-browser verification (preview tools)**

1. `preview_start` "Game Dev Server" if not running; open `/3d.html`.
2. Default load: `preview_eval` → `({li: __weezy3d.levelIndex, area: __weezy3d.areaId})` → `{li: 0, area: "bedroom"}`. Screenshot — must match the known Bedroom 1 look (regression check).
3. Navigate `/3d.html?level=7` (Hallway slot 3): expect bedroom-dressed hallway geometry (fallback working), `areaId: "hallway"`. No console errors.
4. Navigate `/3d.html?level=99`: clamps to 24. `?level=-3`: clamps to 0.
5. Win-card check on `?level=0`: `__weezy3d.teleport(<exit x from bounds.maxX - 80>, 200)` → walk right → win card shows BOTH "Play again" and "Next level →"; clicking next lands on `?level=1`.

---

### Task 4: Hallway set (world 2 — cool/liminal, vanishing-point light)

**Files:**
- Create: `src/three/hallwaySet.ts`
- Modify: `src/three/worldThemes.ts` (register)
- Modify: `src/three/worldThemes.test.ts` (entry test first)

- [ ] **Step 1: Failing registry test**

Add to `worldThemes.test.ts`:

```ts
  it("registers the hallway theme", () => {
    const theme = WORLD_THEMES.hallway;
    expect(theme).toBeDefined();
    expect(theme!.fogColor).toBe(0xc5cfd8);
  });
```

Run: `npx vitest run src/three/worldThemes.test.ts` → new test FAILS (undefined).

- [ ] **Step 2: Create `hallwaySet.ts`**

Mirror the `bedroomSet.ts` skeleton exactly (same `makeRand` LCG, same export shape + `sunOffset`, same z-layers: backdrop −8, landmarks −5, clutter −2.6, foreground +1.9; solids would end at 0 but hallway has none). Palette + atmosphere (library knobs row + the +6/+6 fog delta):

```ts
export const HALLWAY = {
  fogColor: 0xc5cfd8,
  fogNear: 12,
  fogFar: 31,
  wall: 0xd8dde4,        // cool grey-blue
  wallStripe: 0xcdd4dd,
  woodWarm: 0xb8884f,    // bench / trim warmth against the cool field
  woodDark: 0x8a6238,
  runner: 0xa04848,      // warm red carpet runner
  slate: 0x8fa3b8,
  shoeNavy: 0x4a5a78,
  shoeRed: 0xb05555,
  cream: 0xf2ede2,
} as const;
```

Build, in skeleton order:
1. **Backdrop (z −8):** wall plane with subtle vertical stripe canvas texture (stripes every 48px, `wall`/`wallStripe`); white baseboard box; 3–4 framed family photos (0.9×1.1 cream-mat boxes with `slate` inner pane, hung at y 4.5–6, spaced by LCG).
2. **The vanishing-point end window (the signature):** at `maxX + 6`, a tall bright glow plane (2.6×5.0, `MeshBasicMaterial` 0xe8f2fa) + `PointLight(0xd8ecfa, 7, 18, 1.3)` at `(maxX + 4, 4.5, -4)` — the cool light "at the end of the hallway" that everything silhouettes against.
3. **Mid landmarks (z −5):** a bench (seat box 5.0×0.35×1.2 at y 2.6, four 0.18² legs, `woodWarm`); a towering shoe rack (frame 3.6 wide × 5.4 tall, 3 shelf boards, rows of paired rounded shoe boxes 0.55×0.3 in `shoeNavy`/`shoeRed`/`cream`, LCG-jittered); wall coat hooks with one hanging bag silhouette (flattened box, `slate`).
4. **Clutter (z −2.6):** 2–3 stray shoes (paired boxes), a sock ball (0.28 sphere, `cream`).
5. **Foreground (z +1.9):** the runner's edge — a long thin `runner`-colored strip (h 0.06) + one stray mitten box.
6. **Lighting rig:** ambient `0xdce6f0` @ 0.6 (knobs row); key `sun` = `DirectionalLight(0xeaf2fa, 0.55)` with the same shadow-camera block as bedroom, `sunOffset: { x: -6, y: 10, z: 8 }` (key from the window end — flip if the window lands at minX-side better in-browser); warm fill `DirectionalLight(0xffd9a8, 0.15)`. No lamp pools — the hallway is lit by the end window.

Export `buildHallwaySet(minX, maxX): WorldSet` and:

```ts
export const hallwaySurfaces: WorldSurfaces = {
  floorBase: "#c9a06a",
  floorTexture: plankTexture,   // canvas: base + dark seam lines every 32px + grain speckle (LCG)
  platformColor: 0xcfa86a,
  lipColor: 0x8a6238,
};
```

- [ ] **Step 3: Register**

In `worldThemes.ts`:

```ts
import { buildHallwaySet, HALLWAY, hallwaySurfaces } from "./hallwaySet";
// in WORLD_THEMES:
  hallway: {
    fogColor: HALLWAY.fogColor,
    fogNear: HALLWAY.fogNear,
    fogFar: HALLWAY.fogFar,
    buildSet: buildHallwaySet,
    surfaces: hallwaySurfaces,
  },
```

- [ ] **Step 4: Gates**

`npx vitest run src/three/worldThemes.test.ts` → all pass (incl. fog-near rule on the new entry). `npx tsc --noEmit` → clean.

- [ ] **Step 5: In-browser verification + screenshots**

1. Load `/3d.html?level=5` (Hallway 1). Confirm `areaId: "hallway"` via `preview_eval`.
2. Settle-poll (playbook gotcha #4): two `preview_eval` reads of `__weezy3d.getPlayer().x` 1.5s apart — equal ⇒ settled.
3. Screenshots at spawn, mid (`__weezy3d.teleport((__weezy3d.bounds.minX + __weezy3d.bounds.maxX)/2, 200)`, settle, shoot), and exit (`teleport(__weezy3d.bounds.maxX - 100, 200)`).
4. **Z-occlusion check:** teleport onto a platform edge; Eloise must render in front (playbook §2).
5. Repeat spawn shot on the widest hallway level (`?level=9`, the finale) — set must dress the longer range without gaps.
6. Fix composition issues found; re-shoot. `npm run build` → green.
7. Send the user the gallery (`SendUserFile`, 3–4 shots) with the tuning knobs listed (fog near/far, key intensity, window light intensity + their line numbers).

---

### Task 5: Kitchen set (world 3 — chrome + the orange stove hero light)

**Files:**
- Create: `src/three/kitchenSet.ts`
- Modify: `src/three/worldThemes.ts`, `src/three/worldThemes.test.ts`

- [ ] **Step 1: Failing registry test** — same pattern as Task 4: `WORLD_THEMES.kitchen` defined, `fogColor === 0xfff8f0`. Run → FAIL.

- [ ] **Step 2: Create `kitchenSet.ts`** (bedroomSet skeleton; same LCG/z-layers)

```ts
export const KITCHEN = {
  fogColor: 0xfff8f0,
  fogNear: 16,
  fogFar: 41,
  cream: 0xf6f1e6,
  tile: 0xeae4d6,        // subway-tile wall
  grout: 0xd8d2c2,
  cabinet: 0xe8e2d4,
  chrome: 0xc8ccd0,
  chromeDark: 0xa8aeb6,
  terracotta: 0xc9886a,
  stoveBody: 0x3a3e44,
  stoveGlow: 0xff6a3c,   // THE hero accent — the only saturated color
  citrus: 0xf0a830,
} as const;
```

1. **Backdrop (z −8):** subway-tile canvas texture wall (offset 64×28px bricks, `tile` on `grout` lines); a row of upper cabinets (boxes 3.2×2.2 with thin door-seam insets + small `chromeDark` knob spheres) along the top third.
2. **Mid landmarks (z −5):** lower cabinet/counter runs (cabinet boxes 4.5 tall topped by a `cream` counter slab with a `chrome` front-edge strip); **the stove** at ~62% of level width — `stoveBody` box 5.0×4.6, dark cooktop slab, oven-window glow plane (`MeshBasicMaterial` `stoveGlow`, 2.2×1.4), a stockpot (cylinder, `chromeDark`) on top, and `stovePoint = PointLight(0xff7a40, 5, 14, 1.6)` at the oven window; a tall fridge slab (`chrome`, 2.8×7.5) near the far end.
3. **Clutter (z −2.6):** a dropped wooden spoon (thin cylinder + sphere bowl), 2 citrus spheres (`citrus`, 0.35r), an oven mitt (flattened rounded box, `terracotta`).
4. **Foreground (z +1.9):** a fallen fork (3 thin boxes) and a pea (0.12 sphere, sage green 0xa8bca0).
5. **Lighting rig:** ambient `0xfff4e4` @ 0.3 (knobs row — deliberately dark so the overhead key dominates); key `DirectionalLight(0xffffff, 1.0)` with `sunOffset: { x: 2, y: 14, z: 6 }` (steep = the hard downward counter shadows from the library prompt); cool chrome fill `DirectionalLight(0xdce8f0, 0.2)`.
6. **`update` hook (stove breathing):** `stovePoint.intensity = 5 + Math.sin(elapsedMs / 1000 * 1.8) * 0.8;` — deterministic, no random.

Surfaces: `floorBase: "#c9886a"`, `floorTexture: tileTexture` (canvas: 64px grout grid + per-tile tone variation via LCG), `platformColor: 0xe8e2d4` (laminate), `lipColor: 0xc0c6cc` (chrome edge).

- [ ] **Step 3: Register** kitchen in `WORLD_THEMES` (same shape as hallway).

- [ ] **Step 4: Gates** — `npx vitest run src/three/worldThemes.test.ts` all pass; `npx tsc --noEmit` clean.

- [ ] **Step 5: In-browser verification** — same recipe as Task 4 on `?level=10` (Kitchen 1) and `?level=14` (combo finale; also the widest + has `requires:"dash"` platforms and climb walls — confirm they render as normal platforms with kitchen surfaces, reachability not required). Extra check: stove glow visibly pulses (two screenshots 1s apart, intensity differs). Verify `update` hook runs without frame errors in `preview_console_logs`. `npm run build`. Send gallery + knobs.

---

### Task 6: Family Room set (world 4 — fireplace flicker, the first animated light)

**Files:**
- Create: `src/three/familyRoomSet.ts`
- Modify: `src/three/worldThemes.ts`, `src/three/worldThemes.test.ts`

- [ ] **Step 1: Failing registry test** — `WORLD_THEMES.familyRoom` (camelCase — the spec's pinned trap), `fogColor === 0xf0d8b0`. Run → FAIL.

- [ ] **Step 2: Create `familyRoomSet.ts`**

```ts
export const FAMILY_ROOM = {
  fogColor: 0xf0d8b0,
  fogNear: 14,
  fogFar: 36,
  wall: 0xe8d4b0,
  burgundy: 0x8a4a52,
  sofa: 0x9a5560,
  cushion: 0xb06a72,
  cream: 0xf5e8d0,
  woodDark: 0x6a4a32,
  brick: 0x9a5a48,
  fire: 0xff8a48,
  tvDark: 0x2a2e34,
} as const;
```

1. **Backdrop (z −8):** warm wall + one big framed landscape picture (1.8×1.2) + two curtain panel slabs (`burgundy`, 1.2×7, gentle z-rotation ±0.04).
2. **Mid landmarks (z −5):** the sofa mass (~30% width: seat box, back box, two arm cylinders r0.9, three cushion boxes with 0.08 y-jitter, `sofa`/`cushion`); **the fireplace** at ~70% — `brick` surround (canvas brick texture: offset 48×20px courses), dark opening, inner glow plane (`fire`), `woodDark` mantle shelf, and `firePoint = PointLight(0xff8a48, 6, 14, 1.5)` in the opening; entertainment center (`woodDark` shelving 5×4.5 with a `tvDark` glossy slab and 3 game-case thin boxes).
3. **Clutter (z −2.6):** remote (0.7×0.18×0.3 `tvDark` box), stacked game cases, a mug (small cylinder, `cream`).
4. **Foreground (z +1.9):** a throw-pillow corner (rounded box, `burgundy`) and one crayon (reuse the bedroom crayon shape inline — copy the 6-line builder, don't import across sets).
5. **Lighting rig:** ambient `0xffe8c8` @ 0.5; key `DirectionalLight(0xffc890, 0.7)`, `sunOffset: { x: 6, y: 10, z: 8 }`; fill `DirectionalLight(0xc9b6e4, 0.15)` (cool violet — makes the fire glow read warmer by contrast).
6. **`update` hook (the flicker — this task's new technique):**

```ts
update(_dtMs: number, elapsedMs: number): void {
  const t = elapsedMs / 1000;
  // Two incommensurate sines ≈ organic flicker, fully deterministic.
  firePoint.intensity = 6 + Math.sin(t * 7.3) * 0.9 + Math.sin(t * 13.7) * 0.5;
},
```

Surfaces: `floorBase: "#b89070"`, `floorTexture: thickCarpetTexture` (bedroom's speckle pattern at 2× density + larger 2.4px tufts — re-implement locally with the LCG), `platformColor: 0xd4a878`, `lipColor: 0x9a7040`.

- [ ] **Step 3–4: Register + gates** — same pattern; vitest + tsc clean.

- [ ] **Step 5: In-browser verification** — recipe on `?level=15` and `?level=19` (the couch-back climb finale — its `climbWalls` render with family-room surfaces). Flicker check: three screenshots ~0.7s apart; fireplace brightness must visibly differ. `npm run build`. Send gallery + knobs (flicker amplitude/speed line numbers included — feel-tuning is the user's call).

---

### Task 7: Backyard set (world 5 — outdoor rig: sky, hemisphere light, sun)

**Files:**
- Create: `src/three/backyardSet.ts`
- Modify: `src/three/worldThemes.ts`, `src/three/worldThemes.test.ts`

- [ ] **Step 1: Failing registry test** — `WORLD_THEMES.backyard` defined, `background === 0xa8d8f0` (the one theme where background ≠ fogColor). Plus the full-coverage lock, now that all worlds exist:

```ts
  it("every catalog area has its own theme — no fallback in shipping worlds", () => {
    for (const area of new Set(LEVEL_CATALOG.map((e) => e.areaId))) {
      expect(WORLD_THEMES[area], `missing theme for ${area}`).toBeDefined();
    }
  });
```

Run → both FAIL.

- [ ] **Step 2: Create `backyardSet.ts`**

```ts
export const BACKYARD = {
  fogColor: 0xd8f0d0,
  fogNear: 15,            // library row is already past the gameplay plane
  fogFar: 60,
  sky: 0xa8d8f0,          // scene background override
  grass: 0x6ab04c,
  blade: 0x7ec85e,
  hedge: 0x4a7a3a,
  hedgeLight: 0x5e9448,
  woodSun: 0xc9a878,      // sun-bleached playset
  sand: 0xe8d8a8,
  flowerPink: 0xe88aa8,
  flowerYellow: 0xf0d060,
  truckRed: 0xc94f3a,
} as const;
```

1. **Backdrop (z −8) — NOT a wall:** a hedgerow ~4.5 tall (two LCG-jittered rows of overlapping `hedge`/`hedgeLight` spheres r0.9–1.4) with sky visible above it (the scene `background` does the work — no 13-unit wallpaper plane; this is the biggest 2D→3D payoff per the playbook); flower clusters (3–5 small spheres, `flowerPink`/`flowerYellow`) at the hedge base every ~12 units.
2. **Mid landmarks (z −5):** the playset (~55%: two A-frame pole pairs (cylinders, `woodSun`), crossbar, two swings — thin seat boxes hung on 0.04 cylinders); a sandbox corner near minX (`woodSun` frame + `sand` fill slab); 3–4 giant grass-blade clusters (4–6 thin cones h 2.5–4, `blade`, slight tilts).
3. **Clutter (z −2.6):** toy truck (`truckRed` cab+bed boxes, 4 dark cylinder wheels), a bucket (cone-frustum cylinder, `flowerYellow`).
4. **Foreground (z +1.9) — the framing beat:** sparse tall grass blades (cones h 1.2–1.8, `blade`) every ~9 units, LCG-placed — the diorama looks *through* grass.
5. **Lighting rig (the new technique):** `HemisphereLight(0xbfe3ff, 0x6a9a4a, 0.7)` REPLACES the indoor ambient; key sun `DirectionalLight(0xfff2d0, 1.4)` (knobs row), `sunOffset: { x: 4, y: 14, z: 7 }`, same shadow block but `shadow.camera.far = 60`; no fill, no lamp pools. **Fallback (spec risk):** if tone-mapping blows out or shadows fight the hemisphere, drop it for `AmbientLight(0xcfe8ff, 0.65)` + sun, and note it in the playbook polish backlog.

Surfaces: `floorBase: "#6ab04c"`, `floorTexture: grassTexture` (canvas: `grass` base + ~600 vertical 1×4px blade strokes in `blade`/darker green via LCG), `platformColor: 0xc9a878`, `lipColor: 0x8a6a48`.

- [ ] **Step 3–4: Register (with `background: BACKYARD.sky`) + gates** — all worldThemes tests pass including full coverage; `npx tsc --noEmit` clean.

- [ ] **Step 5: In-browser verification** — recipe on `?level=20` (the windowsill spawn — `spawn.y` is elevated; settle-poll matters extra here) and `?level=24` (treehouse finale, widest). Specific checks: sky visible above the hedge line; `breakable` barricades render with backyard surfaces; foreground grass never occludes Eloise for more than a blade's width at walk speed (teleport-walk a 200px strip and screenshot). `npm run build` → green, **full suite**. Send gallery + knobs.

---

### Task 8: Docs sweep (same session — the playbook is the handoff)

**Files:**
- Modify: `docs/3d-transition/weezy3d-playbook.md`
- Modify: `PROGRESS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Playbook** — §1: rewrite the "Bedroom Level 1 is playable" opener to "all 25 catalog levels playable via `?level=n`, 5 worlds dressed"; add `worldThemes.ts` + the four set files to the file table; §5.2/§5.3: mark done, leaving the per-level hero-object variation + Playhouse arena as the remaining §5.3 items; §3: append any new gotchas paid for during Tasks 4–7 (there will be at least one).
- [ ] **Step 2: PROGRESS.md** — session entry: scope, the world→`?level=` index map, screenshot locations, knobs deliberately left for user tuning.
- [ ] **Step 3: CLAUDE.md** — update the `/3d.html` row: "Bedroom Level 1" → "all 5 worlds, 25 levels (`?level=0..24`), per-world set dressing; backgrounds done, characters pending".
- [ ] **Step 4: Final full gate** — `npm run build` → green. Final screenshot pass: one establishing shot per world (5 total incl. bedroom) sent to the user as the completion gallery.

---

## Self-Review Notes (done at write time)

- **Spec coverage:** seam (Tasks 1–3), four worlds (4–7), tests (2 + per-task), fog rule (test in Task 2), `p.color` precedence (Task 1), `background` override (Task 7), camelCase trap (Task 6 + coverage test), docs (8), non-goals untouched (no enemy/power/Playhouse tasks). Win-card chaining (Task 3). ✓
- **Type consistency:** `WorldSurfaces` defined once in level3d.ts (Task 1), imported by worldThemes (Task 2) and each set file (4–7). `WorldSet.sunOffset` introduced in Task 2, consumed in Task 3's `updateCamera`, provided by every `buildXxxSet`. `themeForArea` name used consistently. ✓
- **No git:** all commit steps replaced by tsc/vitest/`npm run build` gates. ✓
