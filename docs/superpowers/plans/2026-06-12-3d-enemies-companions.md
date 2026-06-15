# 3D Enemies + Companion Cameos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the complete enemy system (patrol, stomp, contact damage, hearts, death→checkpoint respawn) and collectible companion cameos into the Three.js layer, mirroring the 2D game.

**Architecture:** Pure logic module (`enemy3d.ts`) + thin billboard views (`enemyView.ts`, `companionView.ts`) + a shared billboard helper (`billboard.ts`), wired by `main.ts` which owns hearts/invincibility/respawn. The world stitcher stops dropping the companion. Mirrors the existing `physics3d.ts`/`playerView.ts` split.

**Tech Stack:** TypeScript (strict), Three.js, Vitest, Vite. Render-px y-down sim space; `coords.ts` converts at render only.

**Spec:** `docs/superpowers/specs/2026-06-12-3d-enemies-companions-design.md`

**Git note:** This repo is **not yet initialized** (git setup deferred to end of session). The per-task "Checkpoint" steps run the test/build gate instead of committing; all commits get batched once `git init` happens at session-end.

**Key facts pinned from the codebase (do not re-derive):**
- `RENDER_SCALE = 2` (`src/config/game.ts`). `PHYSICS.GRAVITY_DOWN = 900·S`, `PHYSICS.STOMP_BOUNCE_VY = -215·S`, `PHYSICS.INVINCIBILITY_MS = 1500` (`src/config/physics.ts`).
- `PlayerState.y` = body **bottom (feet)**, y-down render px. `bodyRect`, `PhysRect`, `PlayerState`, `createPlayerState`, `touchesRect` are exported from `physics3d.ts`.
- 2D `isStomp` (`GameScene.ts:463`): `player.vy ≥ 60·S` AND `playerBottom ≤ enemyTop + 8·S` AND `|px−ex| < enemyWidth·0.55`.
- Enemy hitboxes in render px (from the 2D entities): dustBunny/spider **50×40**, ant/dustMite **46×26**.
- Enemy render scale: dustBunny/spider `0.04·S`, ant/dustMite `0.03·S`. Companion `0.06·S`.
- Enemy/companion `y` in `LevelData` = feet/bottom (same convention as player spawn + tokens).
- `EnemySpawn = { type: "dustBunny"|"spider"|"ant"|"dustMite", x, y, patrolLeft, patrolRight, speed }`; speed is **not** rescaled by `scaleLevelData` (parity: use as-is).
- Sprite files exist at `assets/sprites/enemies/storybook/{dustbunny_idle,dustbunny_walk,spider_idle,spider_walk,ant,dustmite}.png` and `assets/sprites/companions/storybook/{teddy,dog,cat,horse,flamingo}_idle.png`.
- Diorama z-convention: flat actors ride z **+0.06**; solids end at 0.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/three/billboard.ts` | create | Shared `Frame`, `loadFrame`, `measureBottomMargin` (extracted from `playerView.ts`, + headless guard). |
| `src/three/playerView.ts` | modify | Use the shared helper instead of local copies. |
| `src/three/enemy3d.ts` | create | Pure enemy state + `stepEnemies` (patrol, gravity/ground, stomp-vs-damage classification). |
| `src/three/enemy3d.test.ts` | create | Patrol turnaround, stomp/damage discrimination, ground rest, multi-enemy, defeated-ignored. |
| `src/three/worldStitch.ts` | modify | Preserve the single companion (offset x) instead of dropping it. |
| `src/three/worldStitch.test.ts` | modify | Add companion-preservation test. |
| `src/three/enemyView.ts` | create | `EnemiesView` — one billboard per enemy, walk/idle, flip, hide on defeat. |
| `src/three/companionView.ts` | create | `CompanionView` — idle billboard + gentle bob. |
| `src/three/hud.ts` | modify | Hearts row + `setHearts`; transient `showCaption`. |
| `src/three/main.ts` | modify | Own hearts/invincibility/respawn; drive step → bounce/damage/death; companion collect + heartBonus; debug handle. |

---

## Task 1: Shared billboard helper

**Files:**
- Create: `src/three/billboard.ts`
- Modify: `src/three/playerView.ts`

- [ ] **Step 1: Create `src/three/billboard.ts`**

```ts
import * as THREE from "three";

/** A loaded sprite: the GPU texture plus the decoded image (for sizing/feet scan). */
export interface Frame {
  texture: THREE.Texture;
  image: HTMLImageElement;
}

export function loadFrame(url: string): Promise<Frame> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        resolve({ texture, image: texture.image as HTMLImageElement });
      },
      undefined,
      reject,
    );
  });
}

/**
 * Counts fully transparent rows at the bottom of a sprite so a billboard can
 * plant the visible feet on the physics body's bottom. Port of
 * measureBottomTransparentRows (src/systems/measureSpriteFeet.ts) for plain
 * images. Returns 0 in a canvas-less (headless test) environment.
 */
export function measureBottomMargin(image: HTMLImageElement, alphaThreshold = 16): number {
  const { width, height } = image;
  if (!width || !height) return 0;
  if (typeof document === "undefined") return 0;
  const cv = document.createElement("canvas");
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let y = height - 1; y >= 0; y -= 1) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const alpha = data[rowStart + x * 4 + 3];
      if (alpha !== undefined && alpha > alphaThreshold) {
        return height - 1 - y;
      }
    }
  }
  return 0;
}
```

- [ ] **Step 2: Refactor `playerView.ts` to use the shared helper**

In `src/three/playerView.ts`, **delete** the local `interface Frame { … }`, `function loadFrame(…) { … }`, and `function measureBottomMargin(…) { … }` (lines ~34–81), and add this import near the top (after the `coords` import on line 3):

```ts
import { type Frame, loadFrame, measureBottomMargin } from "./billboard";
```

Leave all other usages (`PlayerView.load`, the constructor's `measureBottomMargin(f.image)`) unchanged — the signatures are identical.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no errors).

- [ ] **Step 4: Verify Eloise still renders (no regression)**

The dev server is running (`preview_start` → "Game Dev Server"). In the preview:
- `preview_eval`: `window.location.href = '/3d.html?world=bedroom'`
- wait ~3s, `preview_resize` 1440×810, `preview_screenshot`.
Expected: billboard Eloise renders with planted feet + ground shadow, as before. `preview_console_logs level:error` → none.

- [ ] **Step 5: Checkpoint (gate)**

Run: `npm test`
Expected: still 366 passing (no behavior change). Note for the eventual commit: "refactor: extract shared billboard helper".

---

## Task 2: Pure enemy engine

**Files:**
- Create: `src/three/enemy3d.ts`
- Test: `src/three/enemy3d.test.ts`

- [ ] **Step 1: Write the failing tests** — `src/three/enemy3d.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { createPlayerState, type PhysRect, type PlayerState } from "./physics3d";
import { createEnemyState, stepEnemies, type EnemyState } from "./enemy3d";
import { RENDER_SCALE } from "../config/game";

const S = RENDER_SCALE;

function enemyAt(over: Partial<EnemyState> = {}): EnemyState {
  return {
    ...createEnemyState({ type: "dustBunny", x: 1000, y: 1000, patrolLeft: 900, patrolRight: 1100, speed: 1000 }),
    ...over,
  };
}

// A wide floor under y=1000 so enemies rest instead of drifting.
const FLOOR: PhysRect[] = [{ x: 0, y: 1000, w: 4000, h: 60 }];

describe("stepEnemies — patrol", () => {
  it("flips direction at the right bound", () => {
    const e = enemyAt({ x: 1099, dir: 1, speed: 1000 });
    stepEnemies([e], createPlayerState(0, 0), 50, FLOOR); // +50px → past 1100
    expect(e.dir).toBe(-1);
  });

  it("flips direction at the left bound", () => {
    const e = enemyAt({ x: 901, dir: -1, speed: 1000 });
    stepEnemies([e], createPlayerState(0, 0), 50, FLOOR); // -50px → past 900
    expect(e.dir).toBe(1);
  });
});

describe("stepEnemies — stomp vs damage", () => {
  it("classifies a falling, aligned, overhead player as a stomp", () => {
    const e = enemyAt({ x: 1000, y: 1000 });
    const player: PlayerState = { ...createPlayerState(1000, 965), vy: 200 * S }; // feet just above enemy top (960)
    const res = stepEnemies([e], player, 16, FLOOR);
    expect(res.stomps).toEqual([0]);
    expect(res.damaged).toBe(false);
    expect(e.defeated).toBe(true);
  });

  it("classifies a side overlap (not falling) as damage", () => {
    const e = enemyAt({ x: 1000, y: 1000 });
    const player: PlayerState = { ...createPlayerState(1008, 1000), vy: 0 }; // same row, beside the enemy
    const res = stepEnemies([e], player, 16, FLOOR);
    expect(res.damaged).toBe(true);
    expect(res.stomps).toEqual([]);
    expect(e.defeated).toBe(false);
  });

  it("a defeated enemy deals no damage and is not re-stomped", () => {
    const e = enemyAt({ x: 1000, y: 1000, defeated: true });
    const player: PlayerState = { ...createPlayerState(1000, 1000), vy: 0 };
    const res = stepEnemies([e], player, 16, FLOOR);
    expect(res.damaged).toBe(false);
    expect(res.stomps).toEqual([]);
  });
});

describe("stepEnemies — gravity + ground rest", () => {
  it("falls onto and rests on the floor", () => {
    const e = enemyAt({ x: 1000, y: 940, vy: 0 }); // start above the floor top (1000)
    for (let i = 0; i < 30; i += 1) stepEnemies([e], createPlayerState(0, 0), 16, FLOOR);
    expect(e.y).toBeCloseTo(1000, 1);
    expect(e.onGround).toBe(true);
  });
});

describe("stepEnemies — multiple enemies", () => {
  it("steps each enemy independently (stomp one, leave the distant one)", () => {
    const stomped = enemyAt({ x: 1000, y: 1000 });
    const distant = enemyAt({ x: 1200, y: 1000, patrolLeft: 1100, patrolRight: 1300 });
    const player: PlayerState = { ...createPlayerState(1000, 965), vy: 200 * S };
    const res = stepEnemies([stomped, distant], player, 16, FLOOR);
    expect(res.stomps).toEqual([0]);
    expect(stomped.defeated).toBe(true);
    expect(distant.defeated).toBe(false); // out of the player's body → untouched
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/three/enemy3d.test.ts`
Expected: FAIL — `Cannot find module './enemy3d'` / `createEnemyState is not a function`.

- [ ] **Step 3: Implement `src/three/enemy3d.ts`**

```ts
import { PHYSICS } from "../config/physics";
import { RENDER_SCALE } from "../config/game";
import type { EnemySpawn } from "../types/level";
import { bodyRect, type PhysRect, type PlayerState } from "./physics3d";

/**
 * Pure enemy logic for the 3D renderer — no Three.js, no DOM. Mirrors the 2D
 * Enemy.tick patrol and GameScene.isStomp / handleEnemyOverlap discrimination.
 * Simulates in render px, y-down (the scaled-LevelData space), same as physics3d.
 */

export type EnemyKind = EnemySpawn["type"];

export interface EnemyState {
  type: EnemyKind;
  /** Body center x, body bottom (feet) y — render px, y-down. */
  x: number;
  y: number;
  vy: number;
  dir: 1 | -1;
  speed: number;
  patrolLeft: number;
  patrolRight: number;
  w: number;
  h: number;
  defeated: boolean;
  onGround: boolean;
}

export interface EnemyStepResult {
  /** Indices of enemies defeated by a stomp this step. */
  stomps: number[];
  /** True if any live enemy dealt contact damage this step. */
  damaged: boolean;
}

/** Body boxes in render px, matching the 2D entity hitboxes. */
const ENEMY_BODY: Record<EnemyKind, { w: number; h: number }> = {
  dustBunny: { w: 50, h: 40 },
  spider: { w: 50, h: 40 },
  ant: { w: 46, h: 26 },
  dustMite: { w: 46, h: 26 },
};

const MAX_DELTA_MS = 50;

export function createEnemyState(spawn: EnemySpawn): EnemyState {
  const body = ENEMY_BODY[spawn.type];
  return {
    type: spawn.type,
    x: spawn.x,
    y: spawn.y,
    vy: 0,
    dir: 1,
    speed: spawn.speed,
    patrolLeft: spawn.patrolLeft,
    patrolRight: spawn.patrolRight,
    w: body.w,
    h: body.h,
    defeated: false,
    onGround: false,
  };
}

export function enemyRect(e: EnemyState): PhysRect {
  return { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h };
}

function overlaps(a: PhysRect, b: PhysRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Mirror of GameScene.isStomp: falling fast, feet at/above enemy top, aligned. */
function isStomp(player: PlayerState, e: EnemyState): boolean {
  if (player.vy < 60 * RENDER_SCALE) return false;
  const enemyTop = e.y - e.h;
  if (player.y > enemyTop + 8 * RENDER_SCALE) return false;
  return Math.abs(player.x - e.x) < e.w * 0.55;
}

/** Advance all enemies one frame (mutates state in place). */
export function stepEnemies(
  enemies: EnemyState[],
  player: PlayerState,
  deltaMs: number,
  solids: readonly PhysRect[],
): EnemyStepResult {
  const dt = Math.min(deltaMs, MAX_DELTA_MS) / 1000;
  const result: EnemyStepResult = { stomps: [], damaged: false };
  const pr = bodyRect(player);

  enemies.forEach((e, i) => {
    if (e.defeated) return;

    // Patrol (mirror Enemy.tick: constant velocity, flip at bounds).
    e.x += e.dir * e.speed * dt;
    if (e.x <= e.patrolLeft) e.dir = 1;
    else if (e.x >= e.patrolRight) e.dir = -1;

    // Gravity + ground rest (trimmed physics3d Y resolution).
    e.vy += PHYSICS.GRAVITY_DOWN * dt;
    e.y += e.vy * dt;
    e.onGround = false;
    let rect = enemyRect(e);
    for (const solid of solids) {
      if (!overlaps(rect, solid)) continue;
      if (e.vy > 0) {
        e.y = solid.y;
        e.vy = 0;
        e.onGround = true;
        rect = enemyRect(e);
      }
    }

    // Player contact → classify stomp vs damage.
    if (overlaps(enemyRect(e), pr)) {
      if (isStomp(player, e)) {
        e.defeated = true;
        result.stomps.push(i);
      } else {
        result.damaged = true;
      }
    }
  });

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/three/enemy3d.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Checkpoint (gate)**

Run: `npm test`
Expected: 366 + new enemy tests passing. Commit note: "feat: pure 3D enemy engine".

---

## Task 3: Preserve the companion in the world stitcher

**Files:**
- Modify: `src/three/worldStitch.ts`
- Modify: `src/three/worldStitch.test.ts`

- [ ] **Step 1: Write the failing test** — append to `src/three/worldStitch.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { stitchLevels } from "./worldStitch";
import type { LevelData } from "../types/level";

function bareLevel(id: string, minX: number, maxX: number, over: Partial<LevelData> = {}): LevelData {
  return {
    id,
    name: id,
    spawn: { x: minX + 1, y: 0 },
    killY: 9999,
    bounds: { minX, maxX, minY: 0, maxY: 180 },
    platforms: [{ x: minX, y: 0, w: maxX - minX, h: 20 }],
    enemies: [],
    tokens: [],
    exit: { x: maxX - 1, y: 0 },
    ...over,
  };
}

describe("stitchLevels — companion", () => {
  it("preserves the single companion, offset into stitched x space", () => {
    const a = bareLevel("a", 0, 320);
    const b = bareLevel("b", 0, 320, { companion: { type: "teddy", x: 40, y: 0 } });
    const { level } = stitchLevels([a, b], "bedroom-world", "Bedroom");
    expect(level.companion).toBeDefined();
    expect(level.companion!.type).toBe("teddy");
    // b is shifted right by a's width (320); companion x 40 → 360.
    expect(level.companion!.x).toBe(360);
  });

  it("omits companion when no level has one", () => {
    const a = bareLevel("a", 0, 320);
    const b = bareLevel("b", 0, 320);
    const { level } = stitchLevels([a, b], "hallway-world", "Hallway");
    expect(level.companion).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/three/worldStitch.test.ts -t companion`
Expected: FAIL — `level.companion` is `undefined` in the first case (currently dropped).

- [ ] **Step 3: Implement companion preservation in `worldStitch.ts`**

(a) Update the docblock bullet (line ~20) from "`companion` is dropped…" to:

```ts
 * - The single `companion` (one per world) is preserved, offset into stitched
 *   x space; the first level that declares one wins.
```

(b) Add a capture variable alongside the other accumulators (after `let offset = 0;`, line ~64):

```ts
  let companion: LevelData["companion"] | undefined;
```

(c) Inside the `for (const level of levels)` loop, after the `breakables` loop (line ~84), add:

```ts
    if (!companion && level.companion) {
      companion = { ...level.companion, x: level.companion.x + shift };
    }
```

(d) In the returned `level: LevelData` object literal, add the companion spread next to `climbWalls`/`breakables` (after line ~111):

```ts
    ...(companion ? { companion } : {}),
```

- [ ] **Step 4: Run to verify it passes (and nothing regressed)**

Run: `npx vitest run src/three/worldStitch.test.ts`
Expected: PASS — the 2 new companion tests plus all 17 existing stitch tests green.

- [ ] **Step 5: Checkpoint (gate)**

Run: `npm test`
Expected: all green. Commit note: "feat: stitcher preserves companion".

---

## Task 4: Enemy billboards view

**Files:**
- Create: `src/three/enemyView.ts`

- [ ] **Step 1: Implement `src/three/enemyView.ts`**

```ts
import * as THREE from "three";
import { RENDER_SCALE } from "../config/game";
import { toWorldLen, toWorldX, toWorldY } from "./coords";
import { type Frame, loadFrame, measureBottomMargin } from "./billboard";
import type { EnemyKind, EnemyState } from "./enemy3d";

import dustBunnyIdleUrl from "../../assets/sprites/enemies/storybook/dustbunny_idle.png?url";
import dustBunnyWalkUrl from "../../assets/sprites/enemies/storybook/dustbunny_walk.png?url";
import spiderIdleUrl from "../../assets/sprites/enemies/storybook/spider_idle.png?url";
import spiderWalkUrl from "../../assets/sprites/enemies/storybook/spider_walk.png?url";
import antUrl from "../../assets/sprites/enemies/storybook/ant.png?url";
import dustMiteUrl from "../../assets/sprites/enemies/storybook/dustmite.png?url";

const ENEMY_SCALE: Record<EnemyKind, number> = {
  dustBunny: 0.04 * RENDER_SCALE,
  spider: 0.04 * RENDER_SCALE,
  ant: 0.03 * RENDER_SCALE,
  dustMite: 0.03 * RENDER_SCALE,
};
const ENEMY_URLS: Record<EnemyKind, { idle: string; walk: string | null }> = {
  dustBunny: { idle: dustBunnyIdleUrl, walk: dustBunnyWalkUrl },
  spider: { idle: spiderIdleUrl, walk: spiderWalkUrl },
  ant: { idle: antUrl, walk: null },
  dustMite: { idle: dustMiteUrl, walk: null },
};
const ENEMY_Z = 0.06;
const WALK_FPS = 8;

interface KindAssets {
  idle: Frame;
  walk: Frame | null;
  planeW: number;
  planeH: number;
  feetOffset: number;
}

interface EnemyMesh {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  kind: EnemyKind;
  walkClockMs: number;
}

/** One billboard per enemy; textures loaded once per kind and shared. */
export class EnemiesView {
  readonly group = new THREE.Group();
  private readonly meshes: EnemyMesh[] = [];

  private constructor(
    private readonly assets: Record<EnemyKind, KindAssets>,
    enemies: readonly EnemyState[],
  ) {
    for (const e of enemies) {
      const a = assets[e.type];
      const material = new THREE.MeshBasicMaterial({
        map: a.idle.texture,
        transparent: true,
        alphaTest: 0.02,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(a.planeW, a.planeH), material);
      mesh.renderOrder = 10;
      this.group.add(mesh);
      this.meshes.push({ mesh, material, kind: e.type, walkClockMs: 0 });
    }
  }

  static async load(enemies: readonly EnemyState[]): Promise<EnemiesView> {
    const kinds: EnemyKind[] = ["dustBunny", "spider", "ant", "dustMite"];
    const entries = await Promise.all(
      kinds.map(async (k): Promise<[EnemyKind, KindAssets]> => {
        const urls = ENEMY_URLS[k];
        const idle = await loadFrame(urls.idle);
        const walk = urls.walk ? await loadFrame(urls.walk) : null;
        const scale = ENEMY_SCALE[k];
        const planeW = toWorldLen(idle.image.width * scale);
        const planeH = toWorldLen(idle.image.height * scale);
        const margin = measureBottomMargin(idle.image);
        const ratio = (idle.image.height - margin) / idle.image.height;
        const feetOffset = planeH * (ratio - 0.5);
        return [k, { idle, walk, planeW, planeH, feetOffset }];
      }),
    );
    const assets = Object.fromEntries(entries) as Record<EnemyKind, KindAssets>;
    return new EnemiesView(assets, enemies);
  }

  /** Sync billboards to the simulation; call once per frame. */
  update(enemies: readonly EnemyState[], deltaMs: number): void {
    enemies.forEach((e, i) => {
      const m = this.meshes[i];
      if (!m) return;
      if (e.defeated) {
        m.mesh.visible = false;
        return;
      }
      const a = this.assets[e.type];
      m.mesh.position.set(toWorldX(e.x), toWorldY(e.y) + a.feetOffset, ENEMY_Z);

      let texture = a.idle.texture;
      if (a.walk) {
        m.walkClockMs += deltaMs;
        const on = Math.floor((m.walkClockMs / 1000) * WALK_FPS) % 2 === 1;
        texture = on ? a.walk.texture : a.idle.texture;
      }
      if (m.material.map !== texture) {
        m.material.map = texture;
        m.material.needsUpdate = true;
      }

      // 2D flips X when travelling RIGHT (setFlipX(vx>0)); mirror that.
      m.mesh.scale.x = e.dir === 1 ? -1 : 1;
    });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (Wired into the scene in Task 7; this step just confirms it compiles.)

- [ ] **Step 3: Checkpoint (gate)**

Run: `npm test`
Expected: 366 + Task-2/3 tests green (no new tests here — view code). Commit note: "feat: enemy billboards view".

---

## Task 5: Companion cameo view

**Files:**
- Create: `src/three/companionView.ts`

- [ ] **Step 1: Implement `src/three/companionView.ts`**

```ts
import * as THREE from "three";
import { RENDER_SCALE } from "../config/game";
import { toWorldLen, toWorldX, toWorldY } from "./coords";
import { loadFrame, measureBottomMargin } from "./billboard";
import type { CompanionType } from "../design/levelSketches";

import teddyUrl from "../../assets/sprites/companions/storybook/teddy_idle.png?url";
import dogUrl from "../../assets/sprites/companions/storybook/dog_idle.png?url";
import catUrl from "../../assets/sprites/companions/storybook/cat_idle.png?url";
import horseUrl from "../../assets/sprites/companions/storybook/horse_idle.png?url";
import flamingoUrl from "../../assets/sprites/companions/storybook/flamingo_idle.png?url";

const URLS: Record<CompanionType, string> = {
  teddy: teddyUrl,
  dog: dogUrl,
  cat: catUrl,
  horse: horseUrl,
  flamingo: flamingoUrl,
};
const SCALE = 0.06 * RENDER_SCALE;
const COMPANION_Z = 0.06;

/** A single idle companion billboard that gently bobs until collected. */
export class CompanionView {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly baseY: number;

  private constructor(
    planeW: number,
    planeH: number,
    feetOffset: number,
    texture: THREE.Texture,
    x: number,
    y: number,
  ) {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), material);
    this.mesh.renderOrder = 9;
    this.baseY = toWorldY(y) + feetOffset;
    this.mesh.position.set(toWorldX(x), this.baseY, COMPANION_Z);
    this.group.add(this.mesh);
  }

  static async load(type: CompanionType, x: number, y: number): Promise<CompanionView> {
    const frame = await loadFrame(URLS[type]);
    const planeW = toWorldLen(frame.image.width * SCALE);
    const planeH = toWorldLen(frame.image.height * SCALE);
    const margin = measureBottomMargin(frame.image);
    const ratio = (frame.image.height - margin) / frame.image.height;
    const feetOffset = planeH * (ratio - 0.5);
    return new CompanionView(planeW, planeH, feetOffset, frame.texture, x, y);
  }

  /** Gentle idle bob; call per frame while uncollected. */
  update(elapsedMs: number): void {
    this.mesh.position.y = this.baseY + Math.sin(elapsedMs / 420) * 0.08;
  }

  /** Settle to rest (caller stops calling update once met). */
  setCollected(): void {
    this.mesh.position.y = this.baseY;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Checkpoint (gate)**

Run: `npm test`
Expected: green. Commit note: "feat: companion cameo view".

---

## Task 6: Hearts + caption HUD

**Files:**
- Modify: `src/three/hud.ts`

- [ ] **Step 1: Add hearts + caption DOM fields and methods**

(a) Add two private fields to the `Hud` class (after `private progressLabel: HTMLDivElement;`, line ~8):

```ts
  private heartsLabel: HTMLDivElement;
  private caption: HTMLDivElement;
  private captionTimer = 0;
```

(b) In the constructor, after the `progressLabel` block is appended (after line ~62), insert:

```ts
    // Hearts row (top-right).
    this.heartsLabel = document.createElement("div");
    this.heartsLabel.style.cssText = [
      "position:absolute",
      "top:18px",
      "right:22px",
      "padding:10px 16px",
      "background:rgba(255, 250, 240, 0.85)",
      "border:2px solid #b8804a",
      "border-radius:18px",
      "font-size:22px",
      "letter-spacing:2px",
      "box-shadow:0 3px 10px rgba(107, 74, 47, 0.25)",
    ].join(";");
    this.heartsLabel.textContent = "❤️❤️❤️";
    this.root.appendChild(this.heartsLabel);

    // Transient caption ("You met Teddy!").
    this.caption = document.createElement("div");
    this.caption.style.cssText = [
      "position:absolute",
      "top:22%",
      "left:50%",
      "transform:translateX(-50%)",
      "padding:12px 28px",
      "background:rgba(107, 74, 47, 0.9)",
      "color:#fff4e0",
      "border-radius:18px",
      "font-size:24px",
      "font-weight:800",
      "opacity:0",
      "transition:opacity 0.3s ease",
    ].join(";");
    this.root.appendChild(this.caption);
```

(c) Add two methods (before the closing brace of the class, after `hideWin()`):

```ts
  setHearts(current: number, max: number): void {
    const safe = Math.max(0, current);
    this.heartsLabel.textContent = "❤️".repeat(safe) + "🤍".repeat(Math.max(0, max - safe));
  }

  showCaption(text: string, ms = 2200): void {
    this.caption.textContent = text;
    this.caption.style.opacity = "1";
    if (this.captionTimer) window.clearTimeout(this.captionTimer);
    this.captionTimer = window.setTimeout(() => {
      this.caption.style.opacity = "0";
    }, ms);
  }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Checkpoint (gate)**

Run: `npm test`
Expected: green. Commit note: "feat: hearts + caption HUD".

---

## Task 7: Wire enemies + companion into the game loop

**Files:**
- Modify: `src/three/main.ts`

- [ ] **Step 1: Add imports**

After the existing `import { Hud } from "./hud";` (line ~18), add:

```ts
import { PHYSICS } from "../config/physics";
import { COMPANIONS } from "../config/companions";
import { createEnemyState, stepEnemies, type EnemyState } from "./enemy3d";
import { EnemiesView } from "./enemyView";
import { CompanionView } from "./companionView";
```

Also extend the `physics3d` import to include `createPlayerState` (already imported) — no change needed; confirm `touchesRect` is in that import block (it is).

- [ ] **Step 2: Build enemy + companion state and views**

After `scene.add(playerView.group);` (line ~109), insert:

```ts
  // ── Enemies + companion cameo ─────────────────────────────────────────────
  let enemies: EnemyState[] = level.enemies.map(createEnemyState);
  const enemiesView = await EnemiesView.load(enemies);
  scene.add(enemiesView.group);

  const companionSpawn = level.companion ?? null;
  const companionView = companionSpawn
    ? await CompanionView.load(companionSpawn.type, companionSpawn.x, companionSpawn.y)
    : null;
  if (companionView) scene.add(companionView.group);
  let companionMet = false;
```

- [ ] **Step 3: Add hearts/invincibility state**

After `let segmentIndex = -1;` (line ~115), insert:

```ts
  let hearts = 3;
  let maxHearts = 3;
  let invincibleMs = 0;
```

And set the initial HUD hearts after `hud.setTokens(0, level.tokens.length);` (line ~130):

```ts
  hud.setHearts(hearts, maxHearts);
```

- [ ] **Step 4: Reset enemies/hearts/companion in `resetLevel`**

Inside `resetLevel()` (line ~132), before `input.setEnabled(true);`, insert:

```ts
    enemies = level.enemies.map(createEnemyState);
    hearts = 3;
    maxHearts = 3;
    invincibleMs = 0;
    companionMet = false;
    hud.setHearts(hearts, maxHearts);
    playerView.group.visible = true;
```

- [ ] **Step 5: Add the enemy/companion update functions**

After `checkKillPlane()` (line ~203), insert these two functions:

```ts
  function companionPickupBox(c: { x: number; y: number }) {
    const pad = 10 * RENDER_SCALE;
    const h = 20 * RENDER_SCALE;
    return { x: c.x - pad, y: c.y - h, w: pad * 2, h };
  }

  function updateEnemies(dtMs: number): void {
    const ev = stepEnemies(enemies, player, dtMs, build.solids);
    if (ev.stomps.length > 0) {
      player.vy = PHYSICS.STOMP_BOUNCE_VY;
    }
    if (ev.damaged && invincibleMs <= 0) {
      hearts -= 1;
      invincibleMs = PHYSICS.INVINCIBILITY_MS;
      hud.setHearts(hearts, maxHearts);
      if (hearts <= 0) {
        const cp = segmentAt(segments, player.x).spawn;
        player = createPlayerState(cp.x, cp.y);
        hearts = maxHearts;
        invincibleMs = 0;
        hud.setHearts(hearts, maxHearts);
      }
    }
    if (invincibleMs > 0) invincibleMs -= dtMs;
  }

  function checkCompanion(): void {
    if (!companionSpawn || companionMet) return;
    if (touchesRect(player, companionPickupBox(companionSpawn))) {
      companionMet = true;
      const bonus = COMPANIONS[companionSpawn.type].heartBonus ?? 0;
      maxHearts += bonus;
      hearts = Math.min(hearts + bonus, maxHearts);
      hud.setHearts(hearts, maxHearts);
      const name = companionSpawn.type[0]!.toUpperCase() + companionSpawn.type.slice(1);
      hud.showCaption(`You met ${name}!`);
      companionView?.setCollected();
    }
  }
```

- [ ] **Step 6: Call them in the loop + sync views + invincibility blink**

In `frame()`, inside the `if (!won) { … }` block, after `checkKillPlane();` (line ~283), add:

```ts
      updateEnemies(dtMs);
      checkCompanion();
```

After `playerView.update(player, dtMs, build.solids);` (line ~287), add:

```ts
    enemiesView.update(enemies, dtMs);
    if (companionView && !companionMet) companionView.update(elapsed);
    // Invincibility blink — flash the player billboard while invulnerable.
    playerView.group.visible = invincibleMs <= 0 || Math.floor(elapsed / 100) % 2 === 0;
```

- [ ] **Step 7: Extend the debug handle**

In the `__weezy3d` object (line ~223), add these properties (after `getCollected`):

```ts
    getHearts: () => ({ hearts, maxHearts }),
    enemyStates: () => enemies.map((e) => ({ ...e })),
    companionMet: () => companionMet,
    companionAt: () => (companionSpawn ? { ...companionSpawn } : null),
```

- [ ] **Step 8: Typecheck + full gate**

Run: `npm run build`
Expected: tsc clean + all tests green + 3-page Vite build succeeds.

- [ ] **Step 9: Verify in-browser (the deliverable)**

Dev server running. In the preview, drive via `__weezy3d`:

1. **Load + render:** `preview_eval` `window.location.href='/3d.html?world=bedroom'`; wait 3s; `preview_resize` 1440×810; `preview_screenshot`. Expect dust bunnies visible on the floor, 3 hearts top-right, Teddy billboard somewhere in the run. `preview_console_logs level:error` → none.
2. **Stomp:** `preview_eval` — teleport just above a known enemy and drop:
   `(()=>{const w=window.__weezy3d;const e=w.enemyStates()[0];w.teleport(e.x, e.y-120);w.setSimInput({});return e;})()`
   then poll `w.enemyStates()[0].defeated` → becomes `true`; `w.getPlayer().vy` goes negative (bounce) right after contact.
3. **Damage:** teleport beside an enemy at the same y and walk into it:
   `w.teleport(e.x-40, e.y); w.setSimInput({right:true})` → `w.getHearts().hearts` drops by 1; screenshot shows one 🤍.
4. **Death→respawn:** repeat damage until `hearts` hits 0 → `getPlayer()` jumps to a segment checkpoint and `getHearts().hearts` is back to `maxHearts`.
5. **Meet companion:** `w.teleport(<companion x>, <companion y>)` (read from level: `w.scene` or just walk Eloise there) → `w.companionMet()` true, hearts shows +1 (Teddy), caption "You met Teddy!".

Capture a `preview_screenshot` of a stomp and of the hearts HUD as the deliverable.

- [ ] **Step 10: Checkpoint (gate) + docs**

Run: `npm run build`
Expected: green. Commit note: "feat: wire 3D enemies + companion cameo". Update `PROGRESS.md`, `CLAUDE.md` status line, and playbook §1/§5.1 in the same session (playbook working agreement). Mark playbook §5.1 done; note powers (§5.4) still gate the gated worlds.

---

## Self-Review

(Run after writing — see writing-plans skill.) Filled inline during authoring:
- **Spec coverage:** enemy engine (Task 2), enemyView (4), hearts/death (6+7), companion preserve (3), companionView (5), heart-bonus cameo (7), z-convention +0.06 (4/5), render-px purity (2), worldStitch test + enemy test (2/3), build gate (7). All spec sections mapped.
- **Placeholder scan:** no TBD/TODO; every code step has full code; commands have expected output.
- **Type consistency:** `EnemyState`/`EnemyKind`/`createEnemyState`/`stepEnemies`/`EnemyStepResult` consistent across Tasks 2/4/7; `EnemiesView.load/update`, `CompanionView.load/update/setCollected`, `Hud.setHearts/showCaption` names match their call sites; `companionSpawn` used consistently in Task 7.
