# Glide + One-Button Power Dispatcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Glide power (a parachute-clamp descent) and the reusable one-button power-input dispatcher it rides on, proven by an automated reachability fixture and a playable dev sandbox.

**Architecture:** Powers stay data (`ABILITIES` table). The power button (X) resolves to a power via a pure, Phaser-free `resolveActivePower` dispatcher (predicates live outside the data table so the Node reachability lint keeps running) — mirroring the P1 `shouldAirJump` pattern. Glide is modelled as a velocity *clamp* (constant gentle descent) in both `Player.tick` and the reachability `canReach` math, where descent reach = `max(arc, glide)` so glide is strictly additive.

**Tech Stack:** Phaser 3.80, TypeScript (strict), Vite 6, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-05-31-glide-power-button-design.md`

---

## File Structure

| File | Responsibility | New? |
|---|---|---|
| `src/config/abilities.ts` | Glide envelope → `glideFallSpeed`; `activation` field | modify |
| `src/config/abilities.test.ts` | Glide-row expectations | modify |
| `src/levels/reachability.ts` | `JumpEnvelope.glideFallSpeed`; glide branch in `jumpEnvelope` + `canReach` | modify |
| `src/levels/reachability.test.ts` | Pin glide reach behaviour | modify |
| `src/entities/powerDispatch.ts` | `PowerContext`, `POWER_CONTEXTS`, `resolveActivePower` | **create** |
| `src/entities/powerDispatch.test.ts` | Dispatch resolution + glide predicate | **create** |
| `src/entities/Player.ts` | `keyPower` (X), context build, glide clamp | modify |
| `src/levels/glideDemoLevel.ts` | Hand-authored glide proof/demo level (not in catalog) | **create** |
| `src/levels/glide.integration.test.ts` | Auto-proof: solvable-with / not-without glide | **create** |
| `src/scenes/GameScene.ts` | Extract `buildLevel`; add dev `devLoadLevel` | modify |
| `src/main.ts` | `eloiseGrant`, `eloiseLoadDemo` dev handles | modify |

---

## Task 1: Glide data — `glideFallSpeed` + `activation` field

**Files:**
- Modify: `src/config/abilities.ts`
- Modify: `src/config/abilities.test.ts:17-23`

- [ ] **Step 1: Update the failing test first**

In `src/config/abilities.test.ts`, the existing test `"marks double-jump and glide as envelope powers with envelope data"` (lines 17-23) asserts `ABILITIES.glide.envelope?.fallGravityMult` on line 21. Change that one line from:

```ts
    expect(ABILITIES.glide.envelope?.fallGravityMult).toBeGreaterThan(0);
```

to:

```ts
    expect(ABILITIES.glide.envelope?.glideFallSpeed).toBeGreaterThan(0);
```

Then add a new test immediately after that test's closing `});` (after line 23):

```ts
  it("marks glide as a hold-activated power on the power button", () => {
    expect(ABILITIES.glide.activation).toBe("hold");
    expect(ABILITIES.glide.control).toBe("power");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/config/abilities.test.ts`
Expected: FAIL — `glideFallSpeed` is undefined (the data row still has `fallGravityMult`), and `activation` doesn't exist on the glide row.

- [ ] **Step 3: Update the data + type**

In `src/config/abilities.ts`, change the `AbilityDef` interface and the `glide` row. Replace lines 3-18 with:

```ts
export interface AbilityDef {
  label: string;
  family: "envelope" | "traversal";
  order: number;              // gating order; 0 = earned first
  control: "jump" | "power";  // doubleJump on jump button; the rest on the power button
  priority?: number;          // power-button context-resolution tiebreaker (higher wins)
  activation?: "hold" | "press"; // how the power button triggers it (glide = hold)
  envelope?: { extraJumps?: number; glideFallSpeed?: number };
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  doubleJump: { label: "Double Jump", family: "envelope",   order: 0, control: "jump",  envelope: { extraJumps: 1 } },
  dash:       { label: "Dash",        family: "traversal",  order: 1, control: "power", priority: 1, activation: "press" },
  wallClimb:  { label: "Wall-Climb",  family: "traversal",  order: 2, control: "power", priority: 4 },
  charge:     { label: "Charge",      family: "traversal",  order: 3, control: "power", priority: 2 },
  // Glide: parachute clamp — design-px/s descent speed (un-scaled; Player scales
  // by RENDER_SCALE, reachability uses design-space directly). TDD-pinned; tune for feel.
  glide:      { label: "Glide",       family: "envelope",   order: 4, control: "power", priority: 3, activation: "hold", envelope: { glideFallSpeed: 90 } },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/config/abilities.test.ts`
Expected: PASS (all of abilities.test.ts).

- [ ] **Step 5: Commit**

```bash
git add src/config/abilities.ts src/config/abilities.test.ts
git commit -m "feat(abilities): glide envelope is glideFallSpeed (parachute clamp) + activation field

Replaces the reduced-gravity scaffold (fallGravityMult) with a design-px/s
descent-clamp speed, per the P2 spec. Adds AbilityDef.activation (glide=hold).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Reachability — glide descent math (`glideFallSpeed` + `canReach`)

**Files:**
- Modify: `src/levels/reachability.ts:13-24` (interface), `52-72` (`jumpEnvelope`), `99-106` (`canReach` tail)
- Modify: `src/levels/reachability.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/levels/reachability.test.ts`, add this `describe` block after the existing `describe("canReach", ...)` block (after line 54):

```ts
describe("glide envelope", () => {
  it("base envelope exposes no glideFallSpeed", () => {
    expect(jumpEnvelope().glideFallSpeed).toBeUndefined();
  });

  it("glide adds glideFallSpeed but does NOT change base gravity or apex", () => {
    const base = jumpEnvelope();
    const g = jumpEnvelope(new Set(["glide"]));
    expect(g.glideFallSpeed).toBeGreaterThan(0);
    expect(g.gravDown).toBe(base.gravDown); // clamp, not changed gravity
    expect(g.maxApex).toBe(base.maxApex);   // glide can't raise apex
  });

  it("glide extends reach on a big descent the base arc cannot clear", () => {
    const from: Surface = { left: 0, right: 64, topY: 60 };
    const farLow: Surface = { left: 314, right: 394, topY: 220 }; // 250px gap, 160px drop
    expect(canReach(from, farLow, jumpEnvelope())).toBe(false);
    expect(canReach(from, farLow, jumpEnvelope(new Set(["glide"])))).toBe(true);
  });

  it("glide never reduces reach vs base (monotonicity)", () => {
    const from: Surface = { left: 0, right: 40, topY: 100 };
    const near: Surface = { left: 80, right: 120, topY: 100 }; // base already clears this
    expect(canReach(from, near, jumpEnvelope())).toBe(true);
    expect(canReach(from, near, jumpEnvelope(new Set(["glide"])))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/reachability.test.ts`
Expected: FAIL — `glideFallSpeed` not on `JumpEnvelope`; glide descent not modelled (the big-descent test's glide case returns false).

- [ ] **Step 3: Add `glideFallSpeed` to the interface**

In `src/levels/reachability.ts`, add a field to `JumpEnvelope` (after line 23, the `gravDown` doc + field):

```ts
  /** Falling-band gravity (design-px/s²). */
  gravDown: number;
  /** Constant glide descent speed (design-px/s); present only when glide is unlocked. */
  glideFallSpeed?: number;
}
```

- [ ] **Step 4: Update `jumpEnvelope`'s glide branch**

In `src/levels/reachability.ts`, replace the glide line + return (current lines 65-71) with:

```ts
  // Glide (Phase 2): a parachute CLAMP, not changed gravity — base gravDown is
  // unchanged. When unlocked, expose glideFallSpeed so canReach can model the
  // gentle constant-speed descent. Value is design-px/s (un-scaled), TDD-pinned.
  const gravDown = P.gravDown;
  const glideFallSpeed = abilities.has("glide")
    ? ABILITIES.glide.envelope?.glideFallSpeed
    : undefined;

  const tDown = Math.sqrt((2 * maxApex) / gravDown);
  const maxFlatGap = P.speed * (tUp + tDown);

  return { maxApex, maxFlatGap, speed: P.speed, tUp, gravDown, glideFallSpeed };
```

- [ ] **Step 5: Update `canReach` descent math**

In `src/levels/reachability.ts`, replace the flight-time tail of `canReach` (current lines 99-105, from the `// Farthest horizontal distance` comment through `return gap <= reach * margin;`) with:

```ts
  // Farthest horizontal distance the arc travels while still arriving at
  // `to.topY`. Flight = rise to apex + fall from apex down to height `d` above
  // launch (d negative when `to` is lower → longer fall → more reach).
  const fallHeight = env.maxApex - d;
  const arcFallTime = Math.sqrt((2 * fallHeight) / env.gravDown);

  // Glide (parachute clamp): on a descent the player MAY hold glide to fall at a
  // gentle constant speed, lengthening airtime → more horizontal reach. It's an
  // opt-in choice, so reachable fall time is the BETTER of arc vs glide
  // (monotonicity: glide never reduces reach). Only helps when there's a fall.
  let fallTime = arcFallTime;
  if (env.glideFallSpeed !== undefined && fallHeight > 0) {
    const glideFallTime = fallHeight / env.glideFallSpeed;
    fallTime = Math.max(arcFallTime, glideFallTime);
  }

  const flightTime = env.tUp + fallTime;
  const reach = env.speed * flightTime;
  return gap <= reach * margin;
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run src/levels/reachability.test.ts`
Expected: PASS (all reachability tests, including the existing base + double-jump ones).

- [ ] **Step 7: Commit**

```bash
git add src/levels/reachability.ts src/levels/reachability.test.ts
git commit -m "feat(reachability): model glide as constant-speed descent (additive)

JumpEnvelope.glideFallSpeed; canReach uses max(arc, glide) fall time on a
descent so glide only ever extends reach (backward solvability preserved).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The one-button power dispatcher (pure, reusable)

**Files:**
- Create: `src/entities/powerDispatch.ts`
- Create: `src/entities/powerDispatch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/entities/powerDispatch.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveActivePower, type PowerContext } from "./powerDispatch";
import type { AbilityId } from "../config/abilities";

const falling: PowerContext = { airborne: true, descending: true };
const rising: PowerContext = { airborne: true, descending: false };
const grounded: PowerContext = { airborne: false, descending: false };

describe("resolveActivePower", () => {
  it("returns null when nothing is unlocked", () => {
    expect(resolveActivePower(falling, new Set())).toBe(null);
  });

  it("resolves glide when airborne and descending", () => {
    expect(resolveActivePower(falling, new Set<AbilityId>(["glide"]))).toBe("glide");
  });

  it("does not resolve glide while rising", () => {
    expect(resolveActivePower(rising, new Set<AbilityId>(["glide"]))).toBe(null);
  });

  it("does not resolve glide on the ground", () => {
    expect(resolveActivePower(grounded, new Set<AbilityId>(["glide"]))).toBe(null);
  });

  it("ignores doubleJump (it lives on the jump button, not the power button)", () => {
    expect(resolveActivePower(falling, new Set<AbilityId>(["doubleJump"]))).toBe(null);
  });

  it("ignores an unlocked power with no context predicate yet (dash, pre-P3)", () => {
    expect(resolveActivePower(falling, new Set<AbilityId>(["dash"]))).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/entities/powerDispatch.test.ts`
Expected: FAIL — module `./powerDispatch` does not exist.

- [ ] **Step 3: Implement the dispatcher**

Create `src/entities/powerDispatch.ts`:

```ts
/**
 * The one context-sensitive power button. Pure + Phaser-free (mirrors airJump.ts)
 * so it's unit-testable and so importing it never drags Phaser into the Node-only
 * reachability lint. Player supplies the runtime context each frame.
 *
 * Predicates live HERE, not on the ABILITIES data rows, deliberately: keeping the
 * data table pure is what lets reachability.ts import abilities.ts under Node.
 */
import { ABILITIES, type AbilityId } from "../config/abilities";

export interface PowerContext {
  /** Not standing on ground. */
  airborne: boolean;
  /** Moving downward (vy > 0). */
  descending: boolean;
  // P3+ extend with onClimbableWall / facingBreakable / ... (add, never remove).
}

/** Context predicate per control:"power" ability. Missing entry = never fires. */
export const POWER_CONTEXTS: Partial<Record<AbilityId, (ctx: PowerContext) => boolean>> = {
  glide: (ctx) => ctx.airborne && ctx.descending,
  // dash / wallClimb / charge predicates arrive in P3–P5.
};

/**
 * The highest-priority unlocked control:"power" ability whose context predicate
 * matches right now, or null. Higher `priority` wins (parent spec §6.1).
 */
export function resolveActivePower(
  ctx: PowerContext,
  unlocked: Set<AbilityId>,
): AbilityId | null {
  let best: AbilityId | null = null;
  let bestPriority = -Infinity;
  for (const id of Object.keys(ABILITIES) as AbilityId[]) {
    const def = ABILITIES[id];
    if (def.control !== "power" || !unlocked.has(id)) continue;
    const predicate = POWER_CONTEXTS[id];
    if (!predicate || !predicate(ctx)) continue;
    const p = def.priority ?? 0;
    if (p > bestPriority) {
      bestPriority = p;
      best = id;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/entities/powerDispatch.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/powerDispatch.ts src/entities/powerDispatch.test.ts
git commit -m "feat(powers): pure one-button power dispatcher (resolveActivePower)

Phaser-free context-predicate resolver (mirrors airJump.ts). Glide is the only
predicate for now; P3–P5 add dash/wall-climb/charge. Predicates kept out of the
ABILITIES data table so the Node reachability lint still runs.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Player wiring — power key (X) + glide clamp

**Files:**
- Modify: `src/entities/Player.ts` (imports; field decl ~line 37; constructor ~line 49; `tick` after gravity ~line 178)

No unit test — `Player` drives Phaser input/physics, which the node test env can't exercise (same as the P1 double-jump Player wiring). The decision logic is already covered by Task 3; this task is verified in Task 6 (dev sandbox) + Task 7 (build).

- [ ] **Step 1: Add the import**

In `src/entities/Player.ts`, after the `shouldAirJump` import (line 11), add:

```ts
import { resolveActivePower } from "./powerDispatch";
import { ABILITIES } from "../config/abilities";
```

- [ ] **Step 2: Declare the key field**

In `src/entities/Player.ts`, after `private keyJump: Phaser.Input.Keyboard.Key;` (line 37), add:

```ts
  private keyPower: Phaser.Input.Keyboard.Key;
```

- [ ] **Step 3: Bind X in the constructor**

In `src/entities/Player.ts`, after `this.keyJump = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);` (line 49), add:

```ts
    this.keyPower = kb.addKey(Phaser.Input.Keyboard.KeyCodes.X);
```

- [ ] **Step 4: Apply the glide clamp after gravity integration**

In `src/entities/Player.ts`, immediately after the gravity line `body.setVelocityY(vy + g * dt);` (line 178), insert:

```ts

    // Power button (X). Resolve the active power from context, then apply its
    // effect. Glide = clamp downward speed to a gentle constant while held.
    // Read velocity AFTER gravity so we clamp the integrated value.
    const integratedVy = body.velocity.y;
    const activePower = resolveActivePower(
      { airborne: !onGround, descending: integratedVy > 0 },
      GameState.get().unlockedAbilities,
    );
    if (activePower === "glide" && this.keyPower.isDown) {
      const glideFallSpeed =
        (ABILITIES.glide.envelope?.glideFallSpeed ?? Infinity) * RENDER_SCALE;
      if (integratedVy > glideFallSpeed) {
        body.setVelocityY(glideFallSpeed);
      }
    }
```

- [ ] **Step 5: Add `X` to the keyboard capture list (prevents page scroll/focus loss)**

In `src/scenes/GameScene.ts`, in the `kb.addCapture([...])` array in `create()` (the list ending `...KeyCodes.DOWN,` around line 58), add `X`:

```ts
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.X,
```

- [ ] **Step 6: Verify typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (75 + the new dispatcher/glide tests).

- [ ] **Step 7: Commit**

```bash
git add src/entities/Player.ts src/scenes/GameScene.ts
git commit -m "feat(player): power button (X) + glide clamp

Player builds {airborne, descending} each frame, calls resolveActivePower, and
clamps downward velocity to glideFallSpeed*RENDER_SCALE while X is held. X added
to the keyboard capture list.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Glide demo level + auto-proof (the metroidvania guarantee)

**Files:**
- Create: `src/levels/glideDemoLevel.ts`
- Create: `src/levels/glide.integration.test.ts`

- [ ] **Step 1: Write the failing auto-proof test**

Create `src/levels/glide.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkReachability } from "./reachability";
import { GLIDE_DEMO_LEVEL } from "./glideDemoLevel";

describe("glide gate is real (P2 auto-proof)", () => {
  it("the glide demo is solvable WITH glide", () => {
    const result = checkReachability(GLIDE_DEMO_LEVEL, { abilities: new Set(["glide"]) });
    expect(result.ok).toBe(true);
  });

  it("the glide demo is NOT solvable without glide (the gate requires it)", () => {
    const result = checkReachability(GLIDE_DEMO_LEVEL, { abilities: new Set() });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/glide.integration.test.ts`
Expected: FAIL — module `./glideDemoLevel` does not exist.

- [ ] **Step 3: Create the demo level**

Create `src/levels/glideDemoLevel.ts`. **Note the schema** (from `src/types/level.ts`): `id` is a **string**, and `killY` + `bounds` are required. There is **no `areaId`** field on `LevelData` (areaId lives on the catalog entry, which this level deliberately is not). Mirror the real `hallwayLevels.ts` shape:

```ts
import type { LevelData } from "../types/level";

const FLOOR_Y = 168;

// Hand-authored Glide proof/demo level (P2). A high start ledge (y=48), then a
// wide gap down to a far + much-lower landing floor. The drop makes the base
// jump arc reach a bit further, but the gap is still too wide for it; only the
// glide parachute (gentle constant descent → long airtime) stretches reach far
// enough to clear it. So it is solvable ONLY with glide.
//
// Dual purpose: (1) the auto-proof fixture for the metroidvania guarantee
// (solvable-with-glide / not-without), and (2) the dev sandbox level loaded via
// window.eloiseLoadDemo("glide"). Deliberately NOT in LEVEL_CATALOG — a glide
// gate can't appear before the Living Room (Zod ordering + the catalog
// double-check both forbid it).
export const GLIDE_DEMO_LEVEL: LevelData = {
  id: "glide-demo",
  name: "Glide Demo",
  spawn: { x: 24, y: FLOOR_Y - 120 },
  killY: 300,
  bounds: { minX: 0, maxX: 420, minY: -40, maxY: 260 },
  platforms: [
    { x: 0, y: FLOOR_Y - 120, w: 64, h: 14, color: "#e8c9a0" },  // high start ledge (y=48)
    { x: 314, y: FLOOR_Y + 40, w: 106, h: 32, color: "#d4a574" }, // far + much-lower landing
  ],
  enemies: [],
  tokens: [],
  exit: { x: 360, y: FLOOR_Y + 40 - 52 + 4, w: 40, h: 52 },
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/levels/glide.integration.test.ts`
Expected: PASS (2 tests). If the "without glide" case unexpectedly passes (gap reachable by base arc), widen the gap: move the landing platform right (increase its `x`) until the no-glide case fails, keeping the with-glide case passing.

- [ ] **Step 5: Commit**

```bash
git add src/levels/glideDemoLevel.ts src/levels/glide.integration.test.ts
git commit -m "test(glide): auto-proof — demo level solvable WITH glide, not without

Hand-authored high-ledge→far-low-landing level (250px gap). Proves the glide
gate is real via checkReachability. Not in LEVEL_CATALOG (glide can't gate
before the Living Room). Doubles as the dev sandbox level.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Dev sandbox — `eloiseGrant` + `eloiseLoadDemo`

**Files:**
- Modify: `src/scenes/GameScene.ts` (extract `buildLevel`, add `devLoadLevel`)
- Modify: `src/main.ts` (dev handles)

No automated test — dev-only tooling, verified by use in Task 7.

- [ ] **Step 1: Extract `buildLevel` from `loadLevel` in GameScene**

In `src/scenes/GameScene.ts`, the current `loadLevel(index)` parses+scales the catalog entry then builds the scene inline. Split it so the build half is reusable. Replace the head of `loadLevel` (from its signature through the `state.persist();` that follows the respawn assignments) so it reads:

```ts
  private loadLevel(index: number): void {
    const entry = getLevelEntry(index);
    if (!entry) {
      return;
    }
    const data = scaleLevelData(parseLevelData(entry.raw), RENDER_SCALE);
    const state = GameState.get();
    state.levelIndex = index;
    state.persist();
    this.buildLevel(data);
  }

  /** Build all scene geometry/entities/camera for a level's data. */
  private buildLevel(data: LevelData): void {
    this.levelData = data;
    const state = GameState.get();
    state.respawnX = data.spawn.x;
    state.respawnY = data.spawn.y;
```

Everything from the backdrop construction (`const nextBackdrop = this.makeLevelBackdrop(...)`) down through the final `this.events.emit("hud-update");` stays exactly as-is — it now lives inside `buildLevel`. (Net effect: only the `state.levelIndex`/`persist` lines move up into `loadLevel`; the rest of the old body becomes `buildLevel`.)

- [ ] **Step 2: Add the dev loader to GameScene**

In `src/scenes/GameScene.ts`, add a public method next to `loadLevel` (after `buildLevel`):

```ts
  /** Dev only: load a raw level that isn't in LEVEL_CATALOG (sandbox). */
  devLoadLevel(raw: LevelData): void {
    this.buildLevel(scaleLevelData(parseLevelData(raw), RENDER_SCALE));
  }
```

- [ ] **Step 3: Verify the refactor didn't break anything**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (the refactor is behaviour-preserving).

- [ ] **Step 4: Add the dev handles to main.ts**

In `src/main.ts`, after the existing `eloiseState` handle block (end of file), add:

```ts

/** Dev: unlock a power immediately — e.g. eloiseGrant("glide"). Reloads. */
(window as unknown as { eloiseGrant: (id: AbilityId) => void }).eloiseGrant = (id) => {
  const s = GameState.get();
  s.unlockedAbilities.add(id);
  s.persist();
  window.location.reload();
};

/** Dev: jump straight into a sandbox level (grants its power first). */
(window as unknown as { eloiseLoadDemo: (which: "glide") => void }).eloiseLoadDemo = (which) => {
  const s = GameState.get();
  if (which === "glide") s.unlockedAbilities.add("glide");
  s.persist();
  s.beginRun();
  const sm = game.scene;
  sm.stop("GameScene");
  sm.stop("UIScene");
  const gs = sm.getScene("GameScene") as GameScene;
  // create() loads the catalog level first; override it once create completes.
  gs.events.once(Phaser.Scenes.Events.CREATE, () => gs.devLoadLevel(GLIDE_DEMO_LEVEL));
  sm.start("GameScene");
};
```

- [ ] **Step 5: Add the imports main.ts needs**

In `src/main.ts`, add to the imports at the top:

```ts
import type { AbilityId } from "./config/abilities";
import { GLIDE_DEMO_LEVEL } from "./levels/glideDemoLevel";
```

(`GameScene`, `GameState`, `Phaser`, and `game` are already in scope.)

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean (exit 0).

- [ ] **Step 7: Commit**

```bash
git add src/scenes/GameScene.ts src/main.ts
git commit -m "feat(dev): eloiseGrant + eloiseLoadDemo sandbox; extract GameScene.buildLevel

Splits loadLevel into catalog-lookup + buildLevel(data); devLoadLevel loads a
raw non-catalog level. main.ts exposes eloiseGrant(id) and eloiseLoadDemo('glide')
for the tape-to-wall glide feel-test.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Build gate + runtime verification

**Files:** none (verification only)

- [ ] **Step 1: Full build gate**

Run: `npm run build`
Expected: `tsc` clean, all Vitest tests pass (75 baseline + ~12 new across abilities/reachability/dispatch/glide), `vite build` succeeds.

- [ ] **Step 2: Start the preview server**

Use `preview_start` with config name `Game Dev Server` (from `.claude/launch.json`).

- [ ] **Step 3: Drive the glide sandbox via preview_eval**

In the preview, run:

```js
window.eloiseLoadDemo("glide")
```

Then after ~300ms, assert the scene is live and glide is unlocked:

```js
JSON.stringify({
  active: window.eloiseGame.scene.getScenes(true).map(s => s.scene.key),
  hasGlide: window.eloiseState.hasAbility("glide"),
  level: window.eloiseGame.scene.getScene("GameScene").levelData?.name,
})
```

Expected: GameScene active, `hasGlide: true`, level `"Glide Demo"`.

- [ ] **Step 4: Confirm the demo geometry renders**

Synthetic key input isn't seen by Phaser, so the *clamp under a held key* can only be confirmed by the manual playtest in Step 5. Here, just confirm the sandbox loaded and rendered: capture a `preview_screenshot` and verify Eloise stands on the high start ledge with the far, much-lower landing platform visible across the gap. Check `preview_console_logs` (level `error`) is empty.

- [ ] **Step 5: Manual playtest (the one thing automation can't do)**

Hand off to the user: in the browser console run `eloiseLoadDemo("glide")`, then **hold X while falling** off the high ledge toward the far landing. Confirm: (a) Eloise descends gently while X is held, (b) releasing X resumes a normal fall, (c) holding X lets her clear the gap that's impossible without it. Tune `ABILITIES.glide.envelope.glideFallSpeed` (lower = floatier) if the feel is off — the integration test will re-validate the gate stays solvable-with / not-without after any change.

- [ ] **Step 6: Update PROGRESS.md**

Add a session entry summarizing: glide (parachute clamp) + the one-button power dispatcher shipped; auto-proof + dev sandbox; build green; manual feel-test outcome.

- [ ] **Step 7: Final commit**

```bash
git add PROGRESS.md
git commit -m "docs(progress): P2 glide + power dispatcher — shipped, build green

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist (completed by plan author)

- **Spec coverage:** §3.1 parachute clamp → T1+T2+T4; §3.2 data → T1; §3.3 reachability + monotonicity guard → T2; §4 dispatcher → T3; §4.3 Player wiring → T4; §5.1 auto-proof → T5; §5.2 dev sandbox → T6; §5.3 build gate → T7; §6 scope (no Living Room / Flamingo / traversal) → respected, none added. ✓
- **Placeholders:** none — `glideFallSpeed: 90` is a concrete starting value with a TDD range guard (T5 step 4 says how to widen the gap if needed). ✓
- **Type consistency:** `glideFallSpeed` (design-px/s) consistent across abilities.ts / JumpEnvelope / Player (×RENDER_SCALE) / canReach (design space); `resolveActivePower(ctx, unlocked)` + `PowerContext {airborne, descending}` identical in T3 and T4; `buildLevel`/`devLoadLevel` names consistent T6. ✓
- **Ordering rule:** demo level kept out of LEVEL_CATALOG (T5) so the Zod ordering `.refine` + catalog double-check never see a pre-Living-Room glide gate. ✓
