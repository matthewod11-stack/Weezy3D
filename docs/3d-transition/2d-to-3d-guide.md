# Weezy3D — 2D to 3D Transition Guide

> **What this is:** A practical guide for evolving Princess Eloise from a Phaser 3 2D pixel platformer into a 3D browser game inspired by Fable's Three.js worldbuilding demo (June 9, 2026). The 2D codebase (Weezy2) is the foundation — this doc explains what carries forward, what changes, and what the actual migration path looks like.

---

## The Core Bet

The Fable demo proved one thing: **you can generate rich 3D world geometry from a few lines of prompt, running entirely in the browser via Three.js**. No Unity, no Unreal, no native runtime. That's the same stack we already have (Vite + browser), and it means the renderer can be swapped without rebuilding the entire game.

The 2D Weezy2 design is mature: 6 worlds, 30 levels, a working power system, boss fight, cutscene engine, and reachability lint. The **game design doesn't change**. The bet is that swapping the renderer from Phaser 2D → Three.js 3D with a side-scrolling camera makes the world feel dramatically more alive — like stepping into Eloise's room rather than looking at a drawing of it.

---

## What Carries Forward (The Good News)

This is the most important section. Most of the work you've already done is renderer-agnostic:

### ✅ Carries forward unchanged
- **All level data** — `src/design/levelSketches.ts` is grid-coordinate geometry. Same coordinates, now interpreted as 3D positions (x, y) → (x, 0, y-as-depth). The reachability lint still works — it doesn't know what renderer is downstream.
- **GameState.ts** — pure TypeScript singleton, zero Phaser dependency. Ports verbatim.
- **Physics config** (`src/config/physics.ts`) — all the tuned constants (gravity, coyote time, jump buffer) port to a custom physics loop or a library like Rapier. Jump feel is preserved.
- **Power system** (`src/config/abilities.ts`, `gating.ts`, `companions.ts`) — pure data tables. No Phaser import. Carries exactly.
- **All 5 traversal powers** (double-jump, dash, wall-climb, charge, glide) — the *mechanics* are defined in `powerDispatch.ts` as data-driven logic. The visual expression (animations, particles) is where 3D shines vs 2D.
- **Boss fight state machine** (`src/systems/bossFight.ts`) — pure logic, Phaser-free by design. Ports directly.
- **Cutscene engine** (`src/systems/cutscene.ts`) — timeline controller with no renderer dependency. Needs a new thin shell (`CutsceneScene` → Three.js equivalent) but the logic is identical.
- **Level validation + Zod schemas** — all of `src/types/level.ts` carries.
- **All storybook character art** (the 24 PNG sprites) — these become Three.js `Sprite` objects (camera-facing billboards) or can be replaced with real 3D meshes. Either works.

### ⚠️ Needs adaptation
- **Phaser Scenes** (`BootScene`, `GameScene`, `UIScene`, `MenuScene`, `BossScene`, `CutsceneScene`) — these are the renderer layer. Each becomes a Three.js equivalent. Most logic inside them (entity management, collision, input) is salvageable; the Phaser API calls are what change.
- **Enemy entities** (`DustBunny`, `Spider`, `Ant`, `DustMite`) — the state machines and patrol logic carry; the Phaser physics body calls (`setVelocityX`, `setBounce`, etc.) need to become custom or Rapier calls.
- **Background loading** (`LevelBackgroundLoader`, `backgrounds.ts`) — the PNG backgrounds are replaced by Three.js geometry. This is the biggest visual win.
- **Input system** — Phaser's `CursorKeys` → native `keydown`/`keyup` event listeners or a library. Trivial, but needs to be done.

### ❌ Doesn't port (Phaser-specific)
- `scene.physics.add.*` calls
- `scene.add.existing()` / Phaser GameObject hierarchy
- `this.cameras.main.*`
- Phaser tweens (replace with GSAP or custom lerp)
- `scene.time.addEvent` (replace with `requestAnimationFrame` loop)
- The `postFX.addTiltShift()` depth-of-field shader — Three.js has better equivalents anyway (EffectComposer + BokehPass or a custom depth-of-field pass)

---

## The Architecture Decision: Side-Scrolling 3D

The core camera pattern that makes this work is called **scrolling diorama** (also "2.5D"). The camera is positioned far to one side, looking across the scene with a shallow perspective or orthographic projection. The player moves in 3D but primarily along the X axis (with Z-axis depth for the parallax layers).

```
Camera
  |
  |  ← far background layer (Z = -20)
  |  ← gameplay layer (Z = 0)  ← player moves here
  |  ← foreground detail layer (Z = +5)
  |
  ↓
```

This is exactly what Fable was demoing. It gives you:
- **Free depth-of-field** — the camera naturally blurs the far layer
- **Parallax** — layers move at different rates as the player scrolls
- **Full 3D lighting** — directional light, shadows, fog all work for free
- **Generated geometry** — AI-prompted Three.js scenes drop straight in as backgrounds

The player character and enemies can remain as **camera-facing billboard sprites** (Three.js `Sprite` with the storybook PNGs) for the initial port, then be swapped to real 3D meshes later as a polish pass.

---

## Suggested Migration Path

### Phase 0 — Scaffold the 3D shell (1-2 days)
Replace `index.html` + Phaser setup with a bare Three.js scene. Goal: render a colored box that you can move left/right with arrow keys. The side-scrolling camera must be working. Fog + ambient light in place.

**Stack choices:**
- **Three.js** (r160+) — the renderer, already validated by Fable
- **Rapier.js** (WASM physics) — replaces Phaser Arcade physics. Fast, accurate, browser-native. Alternatively: keep a simple custom AABB physics loop like the original Godot prototype had (you already trust the tuned constants)
- **GSAP** — replaces Phaser tweens for UI animations, cutscenes
- Keep **Vite 6 + TypeScript** — nothing changes

**Files to create:**
```
src/
  renderer/
    scene.ts        ← Three.js scene, camera, renderer setup
    scroll.ts       ← camera follow + level scroll logic
    layers.ts       ← z-depth layer management (far/mid/near)
  physics/
    loop.ts         ← custom AABB or Rapier wrapper
    player.ts       ← Player physics entity (port of src/entities/Player.ts)
```

### Phase 1 — Port the player (3-5 days)
Wire `src/config/physics.ts` constants into the new physics loop. Billboard sprite for Eloise (reuse `assets/sprites/player/storybook/`). Goal: Eloise moves and jumps with the exact same feel as Weezy2. The reachability lint validates this — if the same level geometry is solvable, the jump arc is correct.

**The asymmetric gravity pattern** from Weezy2 translates directly:
```ts
// Same constants, different integration
if (isRising) gravity = GRAVITY_UP;       // 600
else if (nearApex) gravity = GRAVITY_APEX; // 400
else gravity = GRAVITY_DOWN;              // 900
```

### Phase 2 — Bedroom in 3D (1 week)
Generate the Bedroom scene geometry using the prompts in `docs/art-direction/scenery-prompt-library.md`. Start with the master style anchor. Load the geometry as a Three.js scene file (GLTF or generated code). Wire the existing `BEDROOM_SLOTS` level data to place platforms on top of the generated geometry.

This is the first moment the game *looks* 3D. Take your time here — getting the camera angle, fog, and lighting right at this stage sets the standard for every subsequent world.

### Phase 3 — Wire the full game
Port the remaining systems in order:
1. Enemies (billboard sprites + custom patrol physics)
2. Tokens (simple billboard + collect detection)
3. Companions (billboard + follow buffer — already a pure-TS system)
4. Power system (already pure TS — just wire the new physics calls)
5. Boss fight (pure TS state machine — just needs a new Three.js scene shell)
6. Cutscene engine (same — new shell only)
7. Remaining 5 worlds' geometry

---

## The Biggest Visual Wins of Going 3D

In priority order — these are the moments that will make the game feel like a different experience:

**1. Dynamic lighting from within the world**
The stove in the Kitchen glowing orange-red and actually casting light on Eloise and the nearby platforms. The fireplace in the Family Room illuminating the room from below. In 2D, this is a static PNG. In Three.js, it's a `PointLight` with color `0xff6622` placed at the stove position — free, automatic, gorgeous.

**2. Fog-based depth**
`THREE.Fog` placed in each world creates the HD-2D "macro photography" depth effect that Phaser's `postFX.addTiltShift()` was approximating. In 3D it's a property of the actual geometry depth, not a post-process approximation. Far objects fade into the world's ambient color naturally.

**3. Platform shadows**
When Eloise jumps over a platform, the platform shadow falls on the floor below it. The existing jump shadow in Weezy2 is manually computed and drawn as a scaled ellipse. In Three.js with `castShadow: true` on the DirectionalLight, this happens automatically and is geometrically correct.

**4. Parallax for free**
In Weezy2, parallax would require multiple background layers scrolling at different rates — manual work. In 3D, the camera perspective projection naturally makes far-back geometry appear to move slower than near geometry. Set Z=-20 for the wallpaper far layer, Z=0 for platforms, Z=5 for near foreground clutter — parallax done.

**5. The backyard's open sky**
World 5 is the only outdoor level. In 3D, the sky is a real hemisphere (THREE.HemisphereLight + skybox or procedural sky). Sunlight comes from a real directional angle. Grass geometry can have a wind shader. This is where the gap between 2D and 3D is most dramatic for a kids' game.

---

## What the Fable Prompt Pattern Teaches Us

From the tweet analysis: Fable generated its 3D world with "literally just a few lines of prompt" and custom Three.js. The key insight is that **the prompt generates the scene setup code**, not a static image. You're prompting for:

```js
// What you get from a good scene prompt:
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf5e8d0, 8, 30);
const shelf = new THREE.Mesh(
  new THREE.BoxGeometry(8, 0.3, 1.5),
  new THREE.MeshLambertMaterial({ color: 0xb8804a })
);
// ... lighting, more geometry, materials
```

This means your iteration loop is: **write prompt → get Three.js code → paste into Vite → see it in browser → tweak**. No waiting for image renders. No texture baking. The geometry is live and editable.

The prompts in `docs/art-direction/scenery-prompt-library.md` are written to get you code, not images. Phrase them as "Generate a Three.js scene..." rather than "Create an illustration of..."

---

## A Note on the Storybook Art Style in 3D

The character art spec (`docs/superpowers/specs/2026-05-24-storybook-character-art-design.md`) describes a painterly watercolor style. In 3D, you have two options:

**Option A: Billboard sprites (fast, consistent)**
Keep all the storybook PNGs as `THREE.Sprite` objects. Characters remain 2D images floating in a 3D world. This is the HD-2D approach — characters look like illustrations, world looks 3D. Think *Paper Mario*, *Octopath Traveler*. The storybook illustration style actually *reads better* this way because it creates a deliberate contrast between the drawn characters and the geometric world.

**Option B: Low-poly 3D meshes (expensive, but all-the-way)**
Replace each character with a simple low-poly mesh in the storybook palette. No texture baking needed — just Lambert/Toon materials with the correct colors. This is more work but achieves full 3D consistency.

**Recommendation: Ship Option A first.** The billboard approach preserves all 24 character frames you already have, lets you validate the 3D world before committing to 3D character work, and actually looks intentional given the storybook style. Option B becomes a v2 enhancement.

---

## Open Questions to Decide Before You Start

1. **Physics library:** Custom AABB (preserving exact Weezy2 feel) vs Rapier (more powerful, slightly more setup)? The tuned constants in `physics.ts` are battle-tested — a custom loop that reads them directly is the lowest-risk option for the initial port.

2. **Scene authoring:** Prompt-generated Three.js code (Fable approach) vs. a Three.js scene editor (like Spline.design)? The prompt approach is faster to iterate; Spline gives you a visual editor. Both export to Three.js.

3. **Geometry scope for v1:** Full 3D geometry for all 6 worlds upfront, or Bedroom only to validate the approach first? Strongly recommend Bedroom first — it's the game's tutorial world and you know every centimeter of it from Weezy2.

4. **T-Rex boss in 3D:** The boss fight state machine is pure TS and will port in an afternoon. The visual is the question — billboard sprite (reuse existing `trex_idle/roar/walk.png`) or a real 3D mesh? Billboard is fine for v1.

---

## Files to Look At First

When you pick this up, start here:

```
docs/art-direction/scenery-prompt-library.md   ← start with the master anchor prompt
src/config/physics.ts                          ← the jump feel you're preserving
src/design/levelSketches.ts                    ← level geometry that carries forward
src/state/GameState.ts                         ← pure TS, ports verbatim
src/systems/bossFight.ts                       ← pure TS, ports verbatim
src/systems/cutscene.ts                        ← pure TS, ports verbatim
src/config/abilities.ts                        ← power data, ports verbatim
```

Good luck. The 2D foundation is excellent — this is a renderer swap on top of a mature game design, which is the best possible position to be in.
