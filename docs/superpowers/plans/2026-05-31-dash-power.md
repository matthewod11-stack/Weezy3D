# Dash Power (P3 — first traversal power) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dash — a gravity-suspended horizontal lunge — as the first *traversal* power: it introduces the tagged-element machinery (`requires: "dash"`), a conditional reachability edge, and the dispatcher's first `"press"` activation, proven by an automated solvable-with/not-without fixture and playable in the Testing Ground.

**Architecture:** Powers stay data (`ABILITIES` table). Dash is a *traversal* power, so unlike the envelope powers (double-jump/glide) it is **not** emergent from geometry — it needs an explicit `requires: "dash"` tag on the landing platform and a conditional edge in `canReach` that exists only when dash is unlocked. The physical move is a fixed-distance horizontal burst with gravity suspended for the window (`dashSpeed × dashDurationMs`), so the reachability model is exact: `dashDistance` is *derived* from the same two constants (mirroring how `glideFallSpeed` is shared by Player and lint). On the power button, dash is the lowest-priority `"otherwise"` fallback (predicate `() => true`); the dispatcher's priority ordering means glide still wins when airborne+descending.

**Tech Stack:** Phaser 3.80, TypeScript (strict), Vite 6, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-05-30-power-system-design.md` (§5.2 traversal-edge contract, §6.1 dispatcher, §8 P3 row).

**Locked design decisions (confirmed with the user 2026-05-31):**
- **Motion model:** clean lunge — gravity OFF for the dash window, straight horizontal travel. (Not a momentum burst.)
- **Strength:** generous & zoomy — `dashSpeed = 800` design-px/s × `dashDurationMs = 400` → **dash distance ≈ 320 design-px** (~10 grid cells). Dash gaps authored at **260 design-px** (clearly beyond double-jump's ~210 flat gap, comfortably inside dash's 320).
- **Cooldown:** a short recovery (`DASH_RECOVER_MS = 250`) after each dash so it can't be spam-chained into free flight (which would break the one-dash-per-gap reachability model).
- **Direction:** current facing (last horizontal input; defaults right).
- **Gate location:** like glide (P2), the Kitchen isn't built yet, so the gate is proven by a standalone `dashDemoLevel.ts` (not in `LEVEL_CATALOG`) + a Testing Ground station. Real Kitchen levels come when areas are authored.

---

## File Structure

| File | Responsibility | New? |
|---|---|---|
| `src/config/abilities.ts` | dash `traversal: { dashSpeed, dashDurationMs }` + `traversal` field on `AbilityDef` | modify |
| `src/config/abilities.test.ts` | dash traversal-data expectations | modify |
| `src/types/level.ts` | `PlatformSchema.requires` — optional `AbilityId` enum (the first tagged element) | modify |
| `src/types/level.test.ts` | parse accepts/rejects `requires` | **create** |
| `src/levels/reachability.ts` | `JumpEnvelope.dashDistance`; `Surface.requires`; platform `requires`; `surfacesFromLevel` copies it; `jumpEnvelope` dash branch; `canReach` dash edge | modify |
| `src/levels/reachability.test.ts` | pin dash edge behaviour (additive, tag-gated) | modify |
| `src/entities/powerDispatch.ts` | dash predicate `() => true` (the `"otherwise"` fallback) | modify |
| `src/entities/powerDispatch.test.ts` | replace the pre-P3 dash test with dash-resolution tests | modify |
| `src/entities/Player.ts` | `facing`; dash state; dash burst in the power block; reset on respawn | modify |
| `src/levels/dashDemoLevel.ts` | hand-authored dash-gate proof + focused sandbox level | **create** |
| `src/levels/dash.integration.test.ts` | auto-proof: solvable WITH dash / NOT without | **create** |
| `src/levels/reachability.integration.test.ts` | catalog ordering guard (no backward power dependency) | modify |
| `src/levels/testingGround.ts` | append `"dash"` to `IMPLEMENTED_POWERS` + add the dash station | modify |
| `src/levels/testingGround.test.ts` | assert dash is in the roster | modify |
| `src/main.ts` | `eloiseLoadDemo("glide" \| "dash")`; remove the duplicate dev-handle block | modify |

**Not touched:** `src/scenes/GameScene.ts` — `buildLevel`/`devLoadLevel` already exist and `X` is already in the keyboard capture list (both shipped with glide in P2). `src/config/gating.ts`, `companions.ts`, `areas.ts` — the dash↔dog↔kitchen rows already exist.

---

## Task 1: Dash data — `traversal: { dashSpeed, dashDurationMs }`

**Files:**
- Modify: `src/config/abilities.ts`
- Modify: `src/config/abilities.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/config/abilities.test.ts`, add a new test immediately after the `"marks glide as a hold-activated power on the power button"` test's closing `});` (after line 27):

```ts
  it("marks dash as a press-activated traversal power with derived burst constants", () => {
    expect(ABILITIES.dash.family).toBe("traversal");
    expect(ABILITIES.dash.control).toBe("power");
    expect(ABILITIES.dash.activation).toBe("press");
    expect(ABILITIES.dash.traversal?.dashSpeed).toBeGreaterThan(0);
    expect(ABILITIES.dash.traversal?.dashDurationMs).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/config/abilities.test.ts`
Expected: FAIL — `ABILITIES.dash.traversal` is `undefined` (the field doesn't exist on `AbilityDef` yet).

- [ ] **Step 3: Add the `traversal` field + dash data**

In `src/config/abilities.ts`, add a `traversal` field to `AbilityDef` (after the `envelope?` line, line 10) so the interface reads:

```ts
export interface AbilityDef {
  label: string;
  family: "envelope" | "traversal";
  order: number;              // gating order; 0 = earned first
  control: "jump" | "power";  // doubleJump on jump button; the rest on the power button
  priority?: number;          // power-button context-resolution tiebreaker (higher wins)
  activation?: "hold" | "press"; // "hold" = held active, "press" = single-trigger; omit if not yet wired
  envelope?: { extraJumps?: number; glideFallSpeed?: number };
  // Traversal family. dashSpeed (design-px/s) × dashDurationMs gives the lunge
  // distance; Player scales speed by RENDER_SCALE, reachability derives
  // dashDistance in design-space. One source of truth. TDD-pinned; tune for feel.
  traversal?: { dashSpeed?: number; dashDurationMs?: number };
}
```

Then update the `dash` row (line 15) to carry the constants:

```ts
  dash:       { label: "Dash",        family: "traversal",  order: 1, control: "power", priority: 1, activation: "press", traversal: { dashSpeed: 800, dashDurationMs: 400 } },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/config/abilities.test.ts`
Expected: PASS (all of abilities.test.ts).

- [ ] **Step 5: Commit**

```bash
git add src/config/abilities.ts src/config/abilities.test.ts
git commit -m "feat(abilities): dash traversal constants (dashSpeed/dashDurationMs)

Adds AbilityDef.traversal; the dash row gets dashSpeed=800 design-px/s and
dashDurationMs=400 (~320 design-px lunge). One source of truth for both the
Player burst and the reachability dash edge.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Schema — `requires` on a platform (the first tagged element)

**Files:**
- Modify: `src/types/level.ts:8-14` (`PlatformSchema`)
- Create: `src/types/level.test.ts`

The spec (§4.4) put `requires` "in P0", but envelope powers (P0–P2) never needed a tag, so it was never added. Dash is the first power that needs explicit gating, so the field is born here. `LevelData` has no `areaId` (that lives on the catalog entry), so the **cross-area ordering invariant** is enforced as a build-gate test in Task 7, not a Zod `.refine` — the schema only validates that `requires` is a known ability id.

- [ ] **Step 1: Write the failing test**

Create `src/types/level.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseLevelData } from "./level";

const base = {
  id: "t",
  name: "T",
  spawn: { x: 0, y: 0 },
  killY: 300,
  bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
  exit: { x: 80, y: 0, w: 40, h: 52 },
};

describe("PlatformSchema.requires", () => {
  it("accepts a platform tagged with a known ability", () => {
    const data = parseLevelData({
      ...base,
      platforms: [{ x: 0, y: 50, w: 40, h: 10, requires: "dash" }],
    });
    expect(data.platforms[0]!.requires).toBe("dash");
  });

  it("defaults requires to undefined when omitted", () => {
    const data = parseLevelData({ ...base, platforms: [{ x: 0, y: 50, w: 40, h: 10 }] });
    expect(data.platforms[0]!.requires).toBeUndefined();
  });

  it("rejects an unknown requires value", () => {
    expect(() =>
      parseLevelData({
        ...base,
        platforms: [{ x: 0, y: 50, w: 40, h: 10, requires: "teleport" }],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/types/level.test.ts`
Expected: FAIL — the unknown-value case does NOT throw yet (no `requires` field), and the accept case returns `undefined` instead of `"dash"`.

- [ ] **Step 3: Add the field to `PlatformSchema`**

In `src/types/level.ts`, add an `AbilityId` enum schema and the `requires` field. Insert above `PlatformSchema` (after `Vec2Schema`, line 6):

```ts
/** Must stay in sync with AbilityId in src/config/abilities.ts. */
export const AbilityIdSchema = z.enum([
  "doubleJump",
  "dash",
  "wallClimb",
  "charge",
  "glide",
]);
```

Then add the field inside `PlatformSchema` (after the `color` line, line 13):

```ts
export const PlatformSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  color: z.string().optional(),
  /** Traversal-power gate: reaching this platform may use the named ability's
   *  special edge (e.g. a dash across a too-wide gap). Validated for backward
   *  dependencies by the catalog ordering test, not here. */
  requires: AbilityIdSchema.optional(),
});
```

(`scaleLevelData` already spreads `...p` for platforms, so `requires` passes through unscaled — no change needed there.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/types/level.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/level.ts src/types/level.test.ts
git commit -m "feat(schema): platform.requires — the first traversal gate tag

Adds AbilityIdSchema + optional PlatformSchema.requires. Cross-area ordering is
enforced by the catalog build-gate test (LevelData has no areaId), so the schema
only validates the ability id is known.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Reachability — the conditional dash edge

**Files:**
- Modify: `src/levels/reachability.ts` (`JumpEnvelope` ~13-26, `Surface` ~28-33, `jumpEnvelope` ~54-79, `canReach` ~88-127, `ReachabilityLevel` ~156-163, `surfacesFromLevel` ~182-185)
- Modify: `src/levels/reachability.test.ts`

The dash edge is **additive** (it only ever adds a way to reach a `requires:"dash"` platform) and **tag-gated** (it never affects an untagged gap), so backward solvability of every existing level is preserved by construction.

- [ ] **Step 1: Write the failing tests**

In `src/levels/reachability.test.ts`, add this `describe` block after the existing `describe("glide envelope", ...)` block (after line 200):

```ts
describe("dash edge (traversal: tag-gated, additive)", () => {
  // A flat 260px gap: wider than double-jump (~210) but inside dash (~320).
  const from: Surface = { left: 0, right: 60, topY: 168 };
  const dashGap = (requires?: "dash"): Surface => ({
    left: 320,
    right: 440,
    topY: 168,
    requires,
  });

  it("base envelope exposes no dashDistance; dash unlocks it", () => {
    expect(jumpEnvelope().dashDistance).toBeUndefined();
    expect(jumpEnvelope(new Set(["dash"])).dashDistance).toBeGreaterThan(0);
  });

  it("a dash-tagged gap is unreachable without dash, reachable with it", () => {
    expect(canReach(from, dashGap("dash"), jumpEnvelope())).toBe(false);
    expect(canReach(from, dashGap("dash"), jumpEnvelope(new Set(["dash"])))).toBe(true);
  });

  it("dash does NOT cross an UNtagged gap of the same width (tag-gated)", () => {
    // Same 260px gap but no requires tag → dash gives no edge → still unreachable.
    expect(canReach(from, dashGap(undefined), jumpEnvelope(new Set(["dash"])))).toBe(false);
  });

  it("the Kitchen loadout (double-jump + dash) clears it; double-jump alone cannot", () => {
    expect(canReach(from, dashGap("dash"), jumpEnvelope(new Set(["doubleJump"])))).toBe(false);
    expect(canReach(from, dashGap("dash"), jumpEnvelope(new Set(["doubleJump", "dash"])))).toBe(true);
  });

  it("dash does not let you cross UP to a higher tagged ledge (horizontal only)", () => {
    const highTagged: Surface = { left: 320, right: 440, topY: 168 - 96, requires: "dash" }; // 96px up
    expect(canReach(from, highTagged, jumpEnvelope(new Set(["dash"])))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/reachability.test.ts`
Expected: FAIL — `dashDistance` not on `JumpEnvelope`; `Surface.requires` not a field; the dash-edge cases return the wrong booleans.

- [ ] **Step 3: Add `dashDistance` to `JumpEnvelope` and `requires` to `Surface`**

In `src/levels/reachability.ts`, add a field to `JumpEnvelope` (after the `glideFallSpeed` line, line 25):

```ts
  /** Constant glide descent speed (design-px/s); present only when glide is unlocked. */
  glideFallSpeed?: number;
  /** Flat horizontal dash distance (design-px); present only when dash is unlocked. */
  dashDistance?: number;
}
```

And add `requires` to `Surface` (after `topY`, line 32):

```ts
export interface Surface {
  left: number;
  right: number;
  topY: number;
  /** Traversal gate carried from the platform: the special edge that reaches
   *  THIS surface (e.g. a dash gap) is available only when `requires` is unlocked. */
  requires?: AbilityId;
}
```

- [ ] **Step 4: Compute `dashDistance` in `jumpEnvelope`**

In `src/levels/reachability.ts`, inside `jumpEnvelope`, after the glide block (after line 73, the `glideFallSpeed` const) and before the `tDown` line, add:

```ts
  // Dash (Phase 3, traversal): a flat gravity-suspended lunge. Distance is
  // derived from the SAME two constants the Player uses (dashSpeed × duration),
  // in design-space. Present only when dash is unlocked. TDD-pinned.
  const dash = abilities.has("dash") ? ABILITIES.dash.traversal : undefined;
  const dashDistance =
    dash?.dashSpeed !== undefined && dash?.dashDurationMs !== undefined
      ? dash.dashSpeed * (dash.dashDurationMs / 1000)
      : undefined;
```

Then update the return statement (currently line 78) to include it:

```ts
  return { maxApex, maxFlatGap, speed: P.speed, tUp, gravDown, glideFallSpeed, dashDistance };
```

- [ ] **Step 5: Add the dash edge to `canReach`**

In `src/levels/reachability.ts`, in `canReach`, immediately after the `if (gap <= 0) return true;` line (line 104), insert the dash branch:

```ts
  if (gap <= 0) return true; // overlapping column; climb already cleared above

  // Dash edge (traversal): if `to` is a dash-tagged platform at equal-or-lower
  // height and dash is unlocked, the player crosses the gap with a flat
  // gravity-suspended lunge up to dashDistance. Additive (only ADDS a way to
  // reach a tagged platform) and tag-gated (untagged gaps get no dash edge), so
  // it can never reduce the reachability of any existing level. Horizontal only:
  // d <= 0 means `to` is the same height or lower (dash gains no altitude).
  if (
    to.requires === "dash" &&
    env.dashDistance !== undefined &&
    d <= 0 &&
    gap <= env.dashDistance * margin
  ) {
    return true;
  }
```

- [ ] **Step 6: Carry `requires` through `surfacesFromLevel` + the level type**

In `src/levels/reachability.ts`, update `ReachabilityLevel.platforms` (line 159) to allow the optional tag:

```ts
  platforms: Array<{ x: number; y: number; w: number; h: number; requires?: AbilityId }>;
```

And update `surfacesFromLevel` (line 183-185) to copy it:

```ts
export function surfacesFromLevel(level: ReachabilityLevel): Surface[] {
  return level.platforms.map((p) => ({ left: p.x, right: p.x + p.w, topY: p.y, requires: p.requires }));
}
```

> Note: `surfacesFromLevel`'s existing test (`reachability.test.ts:88-92`) uses `toEqual` on surfaces built from untagged platforms. `requires` will be `undefined` on those, and `toEqual` treats a missing key and an explicit `undefined` value as equal — so that test still passes. If it flags, add `requires: undefined` to its two expected objects.

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run src/levels/reachability.test.ts`
Expected: PASS (all reachability tests — base, double-jump, glide, and the 5 new dash cases). If the dash-tagged-gap "with dash" case fails (320 < 260 shouldn't happen), the gap is mis-sized; if the "double-jump alone" case unexpectedly passes, double-jump reaches further than ~210 — widen the test gap (raise the `dashGap` left from 320) until double-jump fails while dash passes.

- [ ] **Step 8: Commit**

```bash
git add src/levels/reachability.ts src/levels/reachability.test.ts
git commit -m "feat(reachability): conditional dash edge (tag-gated, additive)

JumpEnvelope.dashDistance (derived from dashSpeed×duration); Surface.requires;
canReach grants a flat horizontal crossing up to dashDistance to a requires:dash
platform at equal/lower height, only when dash is unlocked. Untagged gaps get no
dash edge → backward solvability of every existing level is preserved.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Dispatcher — dash is the `"otherwise"` fallback

**Files:**
- Modify: `src/entities/powerDispatch.ts:19-23`
- Modify: `src/entities/powerDispatch.test.ts:30-32`

Dash's context predicate is `() => true` and its priority is the lowest (1) among power abilities, so `resolveActivePower` returns dash only when no higher-priority power's context matches — which is exactly the spec §6.1 table's "Dash fires… otherwise". No new `PowerContext` fields are needed.

- [ ] **Step 1: Update the tests**

In `src/entities/powerDispatch.test.ts`, **replace** the last test (lines 30-32, `"ignores an unlocked power with no context predicate yet (dash, pre-P3)"`) with:

```ts
  it("resolves dash on the ground (the otherwise fallback)", () => {
    expect(resolveActivePower(grounded, new Set<AbilityId>(["dash"]))).toBe("dash");
  });

  it("resolves dash while airborne and rising", () => {
    expect(resolveActivePower(rising, new Set<AbilityId>(["dash"]))).toBe("dash");
  });

  it("resolves dash while airborne and descending when glide is NOT unlocked", () => {
    expect(resolveActivePower(falling, new Set<AbilityId>(["dash"]))).toBe("dash");
  });

  it("glide outranks dash when both unlocked and airborne+descending", () => {
    expect(resolveActivePower(falling, new Set<AbilityId>(["glide", "dash"]))).toBe("glide");
  });

  it("dash wins over glide when rising (glide's context does not match)", () => {
    expect(resolveActivePower(rising, new Set<AbilityId>(["glide", "dash"]))).toBe("dash");
  });

  it("dash wins on the ground even when glide is unlocked", () => {
    expect(resolveActivePower(grounded, new Set<AbilityId>(["glide", "dash"]))).toBe("dash");
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/entities/powerDispatch.test.ts`
Expected: FAIL — dash has no predicate yet, so every new dash case returns `null` instead of `"dash"`.

- [ ] **Step 3: Add the dash predicate**

In `src/entities/powerDispatch.ts`, update `POWER_CONTEXTS` (lines 20-23) to add dash:

```ts
export const POWER_CONTEXTS: Partial<Record<AbilityId, (ctx: PowerContext) => boolean>> = {
  glide: (ctx) => ctx.airborne && ctx.descending,
  // Dash is the "otherwise" power (spec §6.1): always contextually valid, lowest
  // priority — so the dispatcher returns dash only when no higher-priority power
  // (glide while descending; later wall-climb/charge) claims the press first.
  dash: () => true,
  // wallClimb / charge predicates arrive in P4–P5.
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/entities/powerDispatch.test.ts`
Expected: PASS (5 original glide/null tests + 6 new dash tests = 11).

- [ ] **Step 5: Commit**

```bash
git add src/entities/powerDispatch.ts src/entities/powerDispatch.test.ts
git commit -m "feat(powers): dash dispatch predicate (the otherwise fallback)

dash: () => true at the lowest priority — the dispatcher returns dash only when
no higher-priority power's context matches (glide still wins while descending).
Implements spec §6.1 'Dash fires… otherwise'.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Player — facing + the dash burst

**Files:**
- Modify: `src/entities/Player.ts` (module const ~line 20; fields ~line 33; movement/facing ~line 118-119; power block 184-198; respawn resets 281-302)

No unit test — `Player` drives Phaser input/physics the node env can't exercise (same as the glide clamp). The *decision* logic is covered by Task 4; the *edge math* by Task 3; this wiring is verified in Task 9 (sandbox) + Task 10 (build + manual playtest).

- [ ] **Step 1: Add the recovery constant**

In `src/entities/Player.ts`, after the `SHADOW_H` const (line 20), add:

```ts
/** Cooldown after a dash ends, so it can't be spam-chained into free flight. */
const DASH_RECOVER_MS = 250;
```

- [ ] **Step 2: Add the dash + facing state fields**

In `src/entities/Player.ts`, after `private dying = false;` (line 33), add:

```ts
  /** Dash (P3): >0 = mid-lunge (ms remaining); cooldown blocks re-trigger. */
  private dashMsLeft = 0;
  private dashCooldownMs = 0;
  private dashDir: 1 | -1 = 1;
  /** Last horizontal facing (drives dash direction); defaults right. */
  private facing: 1 | -1 = 1;
```

- [ ] **Step 3: Track facing in the movement section**

In `src/entities/Player.ts`, after the `right` const is computed (line 119), add:

```ts
    const left = this.keyLeft.isDown || this.keyA.isDown;
    const right = this.keyRight.isDown || this.keyD.isDown;
    if (left) this.facing = -1;
    else if (right) this.facing = 1;
```

(The first two lines already exist at 118-119 — add only the two `if` lines beneath them.)

- [ ] **Step 4: Replace the power block with dash + glide**

In `src/entities/Player.ts`, **replace** the existing power block (lines 184-198, from the `// Power button (X).` comment through the closing brace of the glide `if`) with:

```ts
    // ── Power button (X) ──────────────────────────────────────────────────
    // Resolve the active power from context (pure dispatcher), then apply it.
    // Dash (press) = a gravity-suspended horizontal lunge that overrides
    // velocity for its window. Glide (hold) clamps descent. Read velocity AFTER
    // gravity integration so glide clamps the integrated value.
    this.dashCooldownMs = Math.max(0, this.dashCooldownMs - delta);
    const integratedVy = body.velocity.y;
    const activePower = resolveActivePower(
      { airborne: !onGround, descending: integratedVy > 0 },
      GameState.get().unlockedAbilities,
    );
    const powerPressed = Phaser.Input.Keyboard.JustDown(this.keyPower);

    // Start a dash: fresh press, dash is the resolved power, not already dashing
    // or recovering. Lunge in the current facing direction.
    if (
      powerPressed &&
      activePower === "dash" &&
      this.dashMsLeft <= 0 &&
      this.dashCooldownMs <= 0
    ) {
      this.dashMsLeft = ABILITIES.dash.traversal?.dashDurationMs ?? 0;
      this.dashCooldownMs = this.dashMsLeft + DASH_RECOVER_MS;
      this.dashDir = this.facing;
      this.playSquashStretch(1, 0.9, 80);
    }

    if (this.dashMsLeft > 0) {
      // Gravity-suspended straight lunge: override both axes for the window.
      this.dashMsLeft -= delta;
      const dashSpeed = (ABILITIES.dash.traversal?.dashSpeed ?? 0) * RENDER_SCALE;
      body.setVelocityX(this.dashDir * dashSpeed);
      body.setVelocityY(0);
    } else if (activePower === "glide" && this.keyPower.isDown) {
      const glideFallSpeed =
        (ABILITIES.glide.envelope?.glideFallSpeed ?? Infinity) * RENDER_SCALE;
      if (integratedVy > glideFallSpeed) {
        body.setVelocityY(glideFallSpeed);
      }
    }
```

- [ ] **Step 5: Reset dash state on both respawn paths**

In `src/entities/Player.ts`, in `respawnAt` (after `this.dying = false;`, line 283) add:

```ts
    this.dashMsLeft = 0;
    this.dashCooldownMs = 0;
```

And in `respawnFromPit` (after `this.invincibleMs = Math.max(this.invincibleMs, 400);`, line 301) add:

```ts
    this.dashMsLeft = 0;
    this.dashCooldownMs = 0;
```

- [ ] **Step 6: Verify typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (the new dash unit/integration tests from Tasks 1-4 + everything prior).

- [ ] **Step 7: Commit**

```bash
git add src/entities/Player.ts
git commit -m "feat(player): dash lunge (X) + facing tracking

Tracks facing from horizontal input; on a power-button press resolving to dash,
runs a DASH_DURATION gravity-suspended horizontal lunge (vx=±dashSpeed, vy=0),
then a recovery cooldown. Glide clamp moved into the same power block (dash takes
the frame when active). Dash state resets on death + pit respawn.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Dash demo level + auto-proof (the metroidvania guarantee)

**Files:**
- Create: `src/levels/dashDemoLevel.ts`
- Create: `src/levels/dash.integration.test.ts`

- [ ] **Step 1: Write the failing auto-proof test**

Create `src/levels/dash.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkReachability } from "./reachability";
import { DASH_DEMO_LEVEL } from "./dashDemoLevel";

// The Kitchen-faithful proof: the player ALREADY has double-jump there, so the
// gate must be unbeatable even WITH double-jump — only dash crosses it.
describe("dash gate is real (P3 auto-proof)", () => {
  it("solvable WITH the Kitchen loadout (double-jump + dash)", () => {
    const r = checkReachability(DASH_DEMO_LEVEL, {
      abilities: new Set(["doubleJump", "dash"]),
    });
    expect(r.ok, r.problems.map((p) => p.message).join(" | ")).toBe(true);
  });

  it("NOT solvable without dash (double-jump alone cannot clear the gap)", () => {
    const r = checkReachability(DASH_DEMO_LEVEL, { abilities: new Set(["doubleJump"]) });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/dash.integration.test.ts`
Expected: FAIL — module `./dashDemoLevel` does not exist.

- [ ] **Step 3: Create the demo level**

Create `src/levels/dashDemoLevel.ts`:

```ts
import type { LevelData } from "../types/level";

const FLOOR_Y = 168;

// Hand-authored Dash proof/demo level (P3, first traversal power). A flat start
// platform, then a 260px gap — wider than the double-jump flat gap (~210) but
// inside the dash lunge (~320) — to a landing platform tagged requires:"dash".
// The tag is what makes the gap a *dash* edge: the reachability lint grants the
// crossing only when dash is unlocked, so the level is solvable ONLY with dash
// (even though the Kitchen player already has double-jump).
//
// Dual purpose: (1) the auto-proof fixture for the metroidvania guarantee
// (solvable-with-dash / not-without), and (2) a focused dev sandbox loaded via
// window.eloiseLoadDemo("dash") — focused because, unlike the Testing Ground, it
// has no glide to outrank dash in mid-air. Deliberately NOT in LEVEL_CATALOG: a
// dash gate can't appear before the Kitchen.
export const DASH_DEMO_LEVEL: LevelData = {
  id: "dash-demo",
  name: "Dash Demo",
  spawn: { x: 24, y: FLOOR_Y },
  killY: 280,
  bounds: { minX: 0, maxX: 480, minY: -40, maxY: 260 },
  platforms: [
    { x: 0, y: FLOOR_Y, w: 140, h: 32, color: "#cdb9a6" }, // start run-up
    { x: 400, y: FLOOR_Y, w: 120, h: 32, color: "#d4a574", requires: "dash" }, // gap 140→400 = 260
  ],
  enemies: [],
  tokens: [],
  exit: { x: 440, y: FLOOR_Y - 52 + 4, w: 40, h: 52 },
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/levels/dash.integration.test.ts`
Expected: PASS (2 tests). If the "without dash" case unexpectedly passes (double-jump reaches 260px), widen the gap: increase the landing platform's `x` (and the exit `x` + `bounds.maxX` to match) until the no-dash case fails while the with-dash case still passes.

- [ ] **Step 5: Commit**

```bash
git add src/levels/dashDemoLevel.ts src/levels/dash.integration.test.ts
git commit -m "test(dash): auto-proof — demo level solvable WITH dash, not without

Flat 260px gap to a requires:dash platform. Proves the gate is real even for the
Kitchen loadout (double-jump + dash) — double-jump alone can't clear it. Not in
LEVEL_CATALOG (dash can't gate before the Kitchen). Doubles as a focused sandbox.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Catalog ordering guard (no backward power dependency)

**Files:**
- Modify: `src/levels/reachability.integration.test.ts`

Spec invariant #2 ("a level may only require a power from an earlier area"). No catalog level uses `requires` yet (the Kitchen is unbuilt), so this test is a *guard for future authoring* — it makes it structurally impossible to ship, say, a Hallway level that requires dash (dash is earned in the Hallway, so it can't gate a Hallway level). It runs against `entry.areaId`, which `LevelData` itself lacks.

- [ ] **Step 1: Write the test**

In `src/levels/reachability.integration.test.ts`, add the import (after line 5):

```ts
import type { AbilityId } from "../config/abilities";
```

Then add this `describe` block at the end of the file (after line 41):

```ts
describe("no level requires a power earned in its own or a later area (ordering)", () => {
  for (const entry of LEVEL_CATALOG) {
    const area = entry.areaId as AreaId;
    const allowed = abilitiesForArea(area);
    it(`${entry.raw.id} — every requires:<ability> is earned earlier`, () => {
      const offenders = entry.raw.platforms
        .map((p) => p.requires)
        .filter((r): r is AbilityId => r !== undefined && !allowed.has(r));
      expect(offenders, `disallowed on ${entry.raw.id}: ${offenders.join(", ")}`).toHaveLength(0);
    });
  }
});
```

- [ ] **Step 2: Run to verify it passes (green by construction today)**

Run: `npx vitest run src/levels/reachability.integration.test.ts`
Expected: PASS — no catalog platform carries a `requires` tag yet, so `offenders` is empty for every level. (The guard becomes load-bearing when Kitchen levels are authored.)

- [ ] **Step 3: Commit**

```bash
git add src/levels/reachability.integration.test.ts
git commit -m "test(reachability): catalog ordering guard — no backward power dependency

Asserts every catalog platform's requires:<ability> is earned in an EARLIER
area (abilitiesForArea). Green today (no tagged catalog levels); load-bearing
once the Kitchen is authored. Implements spec invariant #2 as a build-gate test
(LevelData has no areaId for a Zod .refine).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Testing Ground — the dash station

**Files:**
- Modify: `src/levels/testingGround.ts`
- Modify: `src/levels/testingGround.test.ts`

Add `"dash"` to the roster and a 4th station after the glide drop. The station is a **ground dash**: a flat run-up, a 260px gap, a `requires:"dash"` landing. Authored as a ground dash deliberately — in the Testing Ground the player has glide too, and glide outranks dash in mid-air; on the ground (and rising) dash wins, so the natural play ("run to the edge, press X") resolves to dash cleanly.

- [ ] **Step 1: Update the roster test**

In `src/levels/testingGround.test.ts`, in the first test (`"lists the powers that are actually implemented today"`, lines 11-14), add a dash assertion after the glide one (line 13):

```ts
  it("lists the powers that are actually implemented today", () => {
    expect(IMPLEMENTED_POWERS).toContain("doubleJump");
    expect(IMPLEMENTED_POWERS).toContain("glide");
    expect(IMPLEMENTED_POWERS).toContain("dash");
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/levels/testingGround.test.ts`
Expected: FAIL — `IMPLEMENTED_POWERS` does not yet contain `"dash"`.

- [ ] **Step 3: Add dash to the roster + the station**

In `src/levels/testingGround.ts`, update `IMPLEMENTED_POWERS` (line 13):

```ts
export const IMPLEMENTED_POWERS: AbilityId[] = ["doubleJump", "glide", "dash"];
```

Update the stations comment block (lines 27-31) to add the dash line:

```ts
 *   0 Warmup        — walk + single jump (gentle steps within base envelope)
 *   1 Double-Jump   — a 130-px flat gap (wider than base ~122, within double ~212)
 *   2 Glide drop    — high ledge → wide low gap; clear by holding X (glide)
 *   3 Dash gap      — flat 260-px gap (beyond double ~212, within dash ~320);
 *                     run to the edge and tap X to lunge across (ground dash)
```

Then extend `TESTING_GROUND` (lines 32-52): bump `bounds.maxX`, add the dash run-up + tagged landing after the glide landing, and move the exit to the end:

```ts
export const TESTING_GROUND: LevelData = {
  id: "testing-ground",
  name: "Testing Ground",
  spawn: { x: 20, y: FLOOR_Y },
  killY: 280,
  bounds: { minX: 0, maxX: 1560, minY: -20, maxY: 260 },
  platforms: [
    // Station 0 — Warmup
    { x: 0, y: FLOOR_Y, w: 140, h: 32, color: "#cdb9a6" }, // start ground
    { x: 150, y: FLOOR_Y - 28, w: 40, h: 14, color: "#e8c9a0" }, // gentle step (28 up)
    // Station 1 — Double-Jump gap (130-px flat gap)
    { x: 210, y: FLOOR_Y, w: 110, h: 32, color: "#d4a574" }, // left
    { x: 450, y: FLOOR_Y, w: 110, h: 32, color: "#d4a574" }, // right (gap 320→450 = 130)
    // Station 2 — Glide drop (up to a high ledge, then float across a wide low gap)
    { x: 590, y: FLOOR_Y - 88, w: 70, h: 14, color: "#e8c9a0" }, // high ledge (y=80; 88 up, double-jump)
    { x: 820, y: FLOOR_Y + 32, w: 120, h: 32, color: "#c9b08f" }, // far low landing (gap 660→820 = 160, drop 120)
    // Station 3 — Dash gap (ground dash across a flat 260-px gap)
    { x: 980, y: FLOOR_Y + 32, w: 140, h: 32, color: "#cdb9a6" }, // run-up (gap 940→980 = 40, easy hop)
    { x: 1380, y: FLOOR_Y + 32, w: 140, h: 32, color: "#d4a574", requires: "dash" }, // landing (gap 1120→1380 = 260)
  ],
  enemies: [],
  tokens: [],
  exit: { x: 1440, y: FLOOR_Y + 32 - 52 + 4, w: 40, h: 52 },
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/levels/testingGround.test.ts`
Expected: PASS (3 tests). The traversability test now solves the dash landing via the dash edge (dash ∈ `IMPLEMENTED_POWERS`). If it reports the landing or exit unreachable, the dash run-up→landing gap (260) exceeds `dashDistance × exitMargin` (320 × 1.0) — it shouldn't, but if dash constants were retuned down, narrow the gap (lower the landing `x`).

- [ ] **Step 5: Commit**

```bash
git add src/levels/testingGround.ts src/levels/testingGround.test.ts
git commit -m "feat(dev): Testing Ground dash station + dash in the roster

Appends 'dash' to IMPLEMENTED_POWERS and adds Station 3 — a flat 260px gap to a
requires:dash landing (ground dash). The traversability test proves the station
is clearable with the roster; the reachability edge proves it needs dash.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Dev sandbox — `eloiseLoadDemo("dash")` + dedupe handles

**Files:**
- Modify: `src/main.ts`

No automated test — dev-only tooling, verified by use in Task 10. Also removes the duplicate `eloiseGame`/`eloiseState` block (lines 104-108) flagged in PROGRESS.

- [ ] **Step 1: Add the dash demo import**

In `src/main.ts`, after the `GLIDE_DEMO_LEVEL` import (line 11), add:

```ts
import { DASH_DEMO_LEVEL } from "./levels/dashDemoLevel";
```

- [ ] **Step 2: Extend `eloiseLoadDemo` to accept "dash"**

In `src/main.ts`, replace the `eloiseLoadDemo` block (lines 89-102) with:

```ts
/** Dev: jump straight into a sandbox level (grants its power first). */
type DemoName = "glide" | "dash";
const DEMO_LEVELS = { glide: GLIDE_DEMO_LEVEL, dash: DASH_DEMO_LEVEL } as const;
const DEMO_GRANTS: Record<DemoName, AbilityId[]> = {
  glide: ["glide"],
  dash: ["doubleJump", "dash"], // dash gate assumes the Kitchen loadout
};
(window as unknown as { eloiseLoadDemo: (which: DemoName) => void }).eloiseLoadDemo = (which) => {
  const s = GameState.get();
  for (const id of DEMO_GRANTS[which]) s.unlockedAbilities.add(id);
  s.persist();
  s.beginRun();
  const sm = game.scene;
  sm.stop("GameScene");
  sm.stop("UIScene");
  const gs = sm.getScene("GameScene") as GameScene;
  // create() loads the catalog level first; override it once create completes.
  gs.events.once(Phaser.Scenes.Events.CREATE, () => gs.devLoadLevel(DEMO_LEVELS[which]));
  sm.start("GameScene");
};
```

- [ ] **Step 3: Remove the duplicate dev-handle block**

In `src/main.ts`, delete the duplicate trailing block (the SECOND `eloiseGame` + `eloiseState` definitions, lines 104-108):

```ts
/** Dev: the Phaser game handle, for inspecting scene lifecycle from the console. */
(window as unknown as { eloiseGame: Phaser.Game }).eloiseGame = game;

/** Dev: the GameState singleton, for inspecting run state from the console. */
(window as unknown as { eloiseState: GameState }).eloiseState = GameState.get();
```

(The identical block at lines 75-79 stays — these are exact duplicates from the glide Task 5/6 recovery.)

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean (exit 0).

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat(dev): eloiseLoadDemo('dash') sandbox; dedupe dev handles

eloiseLoadDemo is now table-driven over glide/dash demos; the dash demo grants
the Kitchen loadout (double-jump + dash). Removes the duplicate eloiseGame/
eloiseState block left over from the glide recovery.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Build gate + runtime verification + PROGRESS

**Files:** `PROGRESS.md` (everything else is verification only)

- [ ] **Step 1: Full build gate**

Run: `npm run build`
Expected: `tsc` clean, all Vitest tests pass (91 baseline + new across abilities/level/reachability/dispatch/dash ≈ 105+), `vite build` succeeds, reachability double-check + ordering guard green.

- [ ] **Step 2: Start the preview server**

Use `preview_start` with config name `Game Dev Server` (from `.claude/launch.json`).

- [ ] **Step 3: Drive the dash sandbox via preview_eval**

In the preview, run:

```js
window.eloiseLoadDemo("dash")
```

Then after ~300ms, assert the scene is live and dash is unlocked:

```js
JSON.stringify({
  active: window.eloiseGame.scene.getScenes(true).map(s => s.scene.key),
  hasDash: window.eloiseState.hasAbility("dash"),
  hasDoubleJump: window.eloiseState.hasAbility("doubleJump"),
  level: window.eloiseGame.scene.getScene("GameScene").levelData?.name,
})
```

Expected: GameScene active, `hasDash: true`, `hasDoubleJump: true`, level `"Dash Demo"`.

- [ ] **Step 4: Confirm the demo geometry renders + no errors**

Synthetic key input isn't seen by Phaser, so the lunge-under-a-press can only be confirmed by the manual playtest in Step 5. Here, capture a `preview_screenshot` and verify Eloise stands on the start platform with the far `requires:dash` landing visible across the wide gap. Check `preview_console_logs` (level `error`) is empty.

- [ ] **Step 5: Manual playtest (the one thing automation can't do)**

Hand off to the user. Two surfaces:
1. **Focused:** in the console run `eloiseLoadDemo("dash")`, run right toward the gap, and **tap X near the edge** to lunge across. Confirm: (a) she shoots straight across with no fall during the dash, (b) the dash clears the gap that's impossible by jumping, (c) a second dash is briefly blocked (cooldown).
2. **Integrated:** main menu → "Testing Ground (dev)" → clear all four stations end-to-end (walk/jump → double-jump gap → glide drop → **dash gap**). At the dash station, run to the edge and tap X.

Tune in `ABILITIES.dash.traversal` if the feel is off: `dashSpeed`/`dashDurationMs` (distance = speed × duration/1000) and `DASH_RECOVER_MS` in `Player.ts`. After any constant change, re-run `npx vitest run src/levels/dash.integration.test.ts src/levels/testingGround.test.ts` — the gate auto-proof + station traversability re-validate.

- [ ] **Step 6: Update PROGRESS.md**

Prepend a session entry (newest-first) summarizing: dash (gravity-suspended lunge) + the first traversal-power machinery (`requires` tag, conditional `canReach` edge, ordering guard) shipped; auto-proof + Testing Ground station; the glide-priority interaction noted; build green; manual feel-test outcome. Note the carried-forward items resolved (main.ts dedupe) and any remaining.

- [ ] **Step 7: Final commit**

```bash
git add PROGRESS.md
git commit -m "docs(progress): P3 dash — shipped, build green

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist (completed by plan author)

- **Spec coverage:** §5.2 (a) tagged element → T2 (`requires`); (b) conditional edge in BFS → T3 (`canReach` dash branch, tag-gated, `d<=0`); (c) player mechanic (`control:"power"` predicate + `"press"` activation) → T4 (predicate) + T5 (burst). §5.3 double-check (solvable-with / not-without) → T6 auto-proof with the Kitchen loadout. §6.1 dispatcher "otherwise" + priority → T4. §7 invariant #1 additive (untagged gaps unaffected, `Math` only ADDS an edge) → T3 + its test; invariant #2 no backward dependency → T7. §8 P3 deliverable + "gates Kitchen (demo until area built)" → T6/T8. ✓
- **Placeholders:** none — `dashSpeed: 800` / `dashDurationMs: 400` (→320px) and the 260px gaps are concrete, with TDD escape hatches in T3 step 7, T6 step 4, T8 step 4. ✓
- **Type consistency:** `dashSpeed`/`dashDurationMs` (design-px/s, ms) live on `ABILITIES.dash.traversal`, read by Player (`×RENDER_SCALE` for speed) and `jumpEnvelope` (distance = speed × duration/1000, design-space) — identical names everywhere. `Surface.requires` / `PlatformDef.requires` / `ReachabilityLevel.platforms[].requires` all `AbilityId` (== `AbilityIdSchema` enum, T2). `resolveActivePower(ctx, unlocked)` + `PowerContext {airborne, descending}` unchanged from P2 (dash needs no new context field). `DASH_DEMO_LEVEL` / `eloiseLoadDemo("dash")` names consistent T6/T9. ✓
- **Backward solvability:** the dash edge is tag-gated (`to.requires === "dash"`) and additive (an extra `return true`), so no existing untagged level changes; the `jumpEnvelope` no-abilities path is untouched (`dashDistance` undefined). ✓
- **Ordering rule:** demo level kept out of `LEVEL_CATALOG` (T6) so neither the catalog double-check nor the new ordering guard (T7) ever sees a pre-Kitchen dash gate. The Testing Ground also skips the catalog (it sets its own roster). ✓
- **Deviation noted:** spec §4.4 says "Zod `.refine`" for the ordering invariant, but `LevelData` carries no `areaId` (it's on the catalog entry), so the invariant is a build-gate test (T7) over `(entry.raw, entry.areaId)` instead — same guarantee, correct seam.
