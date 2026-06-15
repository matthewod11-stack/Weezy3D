# 3D Traversal Powers — Design Spec

> **Status:** Approved design (2026-06-15, session 7). Implements playbook §5.4 — the
> last big gap to a fully-playable game in 3D. Companion docs: `weezy3d-playbook.md`
> (§5.4 recipe + conventions/gotchas), `2026-05-30-power-system-design.md` (the
> original 2D power system this ports), `2026-06-12-3d-enemies-companions-design.md`
> (the §5.1 port whose subagent-driven flow + 3D-local-state pattern this mirrors).

## 1. Goal

Port the five traversal powers to the Three.js runtime so the four power-gated worlds
become playable end-to-end. Today only **Bedroom** (gate-free) is fully runnable; the
2D reachability tests prove Hallway 4–5 need double-jump, Kitchen needs wall-climb +
dash, Family Room slot 5 needs wall-climb, and Backyard 3/5 need glide (and charge to
clear barricades). A human player hits an impassable wall mid-world today.

**Done means:** all five powers behave with 2D parity in `src/three/`, each gated world
is provably traversable in-browser, the existing 13 physics-feel tests stay green, and
companion-collect grants a real ability instead of only a heart bonus.

## 2. The substrate is already here (do not rebuild)

This is the cheapest port in the project because three layers already exist:

- **Pure logic** (`src/logic/`, all Phaser-free + unit-tested): `resolveActivePower(ctx,
  unlocked)`, `shouldAirJump(inputs)`, `isOnClimbWall(body, walls)`,
  `facingBreakable(body, facing, breakables, reach)`.
- **Config** (`src/config/`): `ABILITIES` (per-power `control`/`priority`/`activation` +
  tuning constants), `abilitiesForArea(area)`, `companionForArea(area)`,
  `COMPANIONS[type].grants`.
- **Level data** (`src/types/level.ts`): `platforms[].requires:"dash"`, `climbWalls[]`,
  `breakables[]` are already in the Zod schema, and `worldStitch.ts` already offsets all
  three into continuous-world space (pinned by `worldStitch.test.ts`).

The **only** gap is the 3D runtime: it has no power input, no power state in the sim, no
ability set, and `level3d.ts` does not render climb walls or breakables. There is a
localStorage `GameState.unlockedAbilities`, but it is **not** wired into the 3D runtime —
this port keeps abilities **3D-local** (a `Set` per run, seeded per world), exactly as
hearts are 3D-local. GameState persistence across a full chain is a separate future
concern, out of scope here.

## 3. Decisions (locked 2026-06-15)

| Decision | Choice | Rationale |
|---|---|---|
| Scope | All 5 powers in one spec | Dispatcher + config + pure logic already model them as a system; unblocks all 4 worlds. |
| Wall-climb input | **Hold Up** (W/↑ + stick/D-pad up), NOT the power button | 2D parity, already playtested (2D spec §6.1). Power button stays for dash/glide/charge. |
| Build flow | Subagent-driven, sequential | Mirrors the §5.1 enemies port; powers all edit one `stepOnce`, so no parallelism. |
| Ability state | 3D-local `Set<AbilityId>`, seeded by `abilitiesForArea(world)` | Parity with 3D-local hearts; makes every world directly loadable. |
| Keyboard power key | **X** | Free key; arrows+WASD+Space already taken. |
| Gamepad power button | **button 1** | Already reserved in `gamepad.ts` header comment. |

## 4. Architecture (by layer)

### 4.1 Input layer
Extend `FrameInput` (in `physics3d.ts`) with **optional** fields so the existing 13
physics tests and their `FrameInput` literals compile untouched (`undefined` ⇒ `false`):

```ts
export interface FrameInput {
  left: boolean; right: boolean;
  jumpPressed: boolean; jumpReleased: boolean;
  up?: boolean;           // held — wall-climb ascent
  powerPressed?: boolean; // edge — dash / charge trigger
  powerHeld?: boolean;    // held — glide clamp
}
```

- **Keyboard** (`input.ts`): `up` = `ArrowUp || KeyW` (already in `GAME_CODES`, currently
  unread); power = `KeyX` (add to `GAME_CODES`; `powerPressed` from the pressed-edge set,
  `powerHeld` from the held set).
- **Gamepad** (`gamepad.ts`): extend `decodeHat` to return `{left,right,up,down}` (8-way);
  `up` also from left-stick axis 1 < −deadzone. Power = button 1; add `powerDown` to
  `GamepadEdgeState` and derive `powerPressed`/`powerHeld` by diffing like jump.

`main.ts` already OR-merges keyboard+gamepad+simInput per frame — extend that merge object
with `up`/`powerPressed`/`powerHeld` (and the simInput one-shot consume to clear
`powerPressed`).

### 4.2 Sim layer — `stepPlayer` gains an optional power env
```ts
export interface PowerEnv {
  unlocked: Set<AbilityId>;
  climbWalls: PhysRect[];
  breakables: (PhysRect | null)[]; // null = already smashed this run
}
export function stepPlayer(prev, input, deltaMs, solids, env?: PowerEnv): PlayerState
```
`env` is **optional** — the 4-arg form (no powers) keeps the base feel tests green. When
absent, no power code runs.

`PlayerState` gains:
```ts
airJumpsUsed: number;     // reset to 0 on landing / onGround
dashMsRemaining: number;  // >0 while the dash velocity-override window is active
justSmashed: number;      // one-frame: index of breakable smashed this frame, or -1
justAirJumped?: boolean;  // one-frame view/sfx hook (optional)
justDashed?: boolean;     // one-frame view/sfx hook (optional)
```
All one-frame flags follow the existing `justJumped`/`justLanded` accumulate-across-
substeps rule (gotcha #3).

### 4.3 Breakable smash model (the subtle part)
Breakables live **only** in `env.breakables`, never in the static `build.solids`.
`stepPlayer` composes the live (non-null) breakables into its collision set internally so
they block like solids. A collision against a breakable is resolved normally **unless** a
smash condition holds, in which case the breakable is nulled locally (so it stops blocking
for the rest of that frame) and its index is reported via `justSmashed`:

- **Charge smash:** `resolveActivePower` returns `charge` (grounded + `facingBreakable`)
  **and** `powerPressed` — tap to smash a flush barricade.
- **Dash smash:** `dashMsRemaining > 0` and the body reaches a breakable in its path —
  "dash into it to plow through" (CLAUDE.md / 2D parity).

Keeping breakables out of `build.solids` means the static geometry stays clean and the
caller never mutates it — it only hides the mesh when `justSmashed >= 0`.

### 4.4 Per-power behavior
Inserted into the existing `stepOnce` order (coyote/buffer → jump → variable-cut →
horizontal → gravity → integrate/collide), each gated on `unlocked.has(id)`. Constants
come from `ABILITIES`, scaled by `RENDER_SCALE`.

| Power | Gate / trigger | Effect | Pure logic | Constant |
|---|---|---|---|---|
| **Double-jump** | `unlocked.has("doubleJump")`, jump-press, airborne, ground-jump didn't fire, `airJumpsUsed < 1` | `vy = JUMP_VELOCITY`; `airJumpsUsed++`; `justAirJumped` | `shouldAirJump` | `envelope.extraJumps` (1) |
| **Dash** | dispatcher → `dash` (the "otherwise"), `powerPressed`, not already dashing | `dashMsRemaining = dashDurationMs`; while active override `vx = facing·dashSpeed` (overrides horizontal control); `justDashed` | `resolveActivePower` | `dashSpeed` 800, `dashDurationMs` 400 |
| **Glide** | dispatcher → `glide` (airborne + descending, prio 3), `powerHeld` | clamp `vy ≤ glideFallSpeed` (only while falling) | dispatcher | `glideFallSpeed` 90 |
| **Charge** | dispatcher → `charge` (grounded + facingBreakable, prio 2), `powerPressed` | smash the faced breakable → `justSmashed` | `facingBreakable` + dispatcher | `chargeReach` 14 |
| **Wall-climb** | `unlocked.has("wallClimb")`, `input.up`, `isOnClimbWall` | `vy = −climbSpeed`; skip gravity this frame; horizontal still works (to step off) | `isOnClimbWall` | `climbSpeed` 130 |

Dash/glide/charge share one button resolved by `resolveActivePower` so context picks the
right one (charge when flush at a barricade > glide while falling > dash otherwise).
Wall-climb is independent on Up.

`PowerContext` built each frame from sim state:
`{ airborne: !onGround, descending: vy > 0, onClimbableWall: isOnClimbWall(body, env.climbWalls), facingBreakable: facingBreakable(body, facing, env.breakables, reach) >= 0 }`.

### 4.5 Integration — `main.ts` + `level3d.ts`
- **Seed abilities:** `const unlocked = abilitiesForArea(world.areaId)` at load.
- **Runtime breakables:** `let breakables = (level.breakables ?? []).map(b => ({...b}))`
  (mutable, null-able), passed in `env`.
- **Step call:** `stepPlayer(player, frameInput, dtMs, build.solids, { unlocked, climbWalls: level.climbWalls ?? [], breakables })`.
- **Smash → hide mesh:** after the step, if `player.justSmashed >= 0`, set
  `breakables[idx] = null` and hide `build.breakables[idx].mesh`.
- **Companion grant:** in `checkCompanion`, add
  `unlocked.add(COMPANIONS[companionSpawn.type].grants)` alongside the existing
  heartBonus/caption (idempotent — a no-op if already seeded via `abilitiesForArea`).
- **`level3d.buildLevel` renders traversal elements** (it renders none today): climb walls
  as a subtle climbable panel/ladder (z-convention: solid back to 0, or a thin billboard
  ride +0.05); breakables as a solid-looking barricade box (back to 0). Both exposed on
  `LevelBuild` (`climbWalls: Mesh[]`, `breakables: {mesh}[]`) so a smashed one can hide.
- **Reset symmetry (gotcha #12):** `resetLevel` re-seeds `unlocked`, rebuilds the
  `breakables` runtime array, and **re-shows every breakable mesh** (`visible = true`).
- **Debug handle:** add `unlockedAbilities: () => [...unlocked]` and
  `grantAbility: (id) => unlocked.add(id)` for browser verification.

## 5. Testing & verification

- **Existing 13 base feel tests stay byte-identical and green** — the optional `env`
  param + optional `FrameInput` fields make this possible. This is the prime directive
  (playbook §6): if they pass, the 3D jump feel = the 2D feel.
- **New `physics3d` integration tests, one cluster per power:**
  - double-jump: fires a 2nd jump mid-air only with the ability + within count; resets on
    landing; does nothing without the ability.
  - dash: `vx` overridden to ≈`facing·dashSpeed` for ~`dashDurationMs`; travels ≈ speed×dur;
    press-not-hold (one dash per press); nothing without the ability.
  - glide: descent clamped to `glideFallSpeed` while held + descending + ability; no effect
    rising, not held, or without ability.
  - wall-climb: `vy = −climbSpeed` while on wall + up held + ability; falls otherwise; no
    effect without ability or off the wall.
  - charge: `justSmashed` reports the faced index when grounded + facing + press + ability;
    dash-into-breakable smashes; a nulled breakable no longer blocks.
- **Pure-logic tests** for `airJump`/`climbDetect`/`breakableDetect`/`powerDispatch` already
  exist — extend only if a port reveals a gap.
- **Browser proof per gated world** (`__weezy3d.setSimInput` + `grantAbility`, real-key
  feel left to the human per playbook §6): drive through Hallway 4–5 (double-jump), Kitchen
  (dash + climb), Family Room slot 5 (climb), Backyard (charge + glide).
- **Reachability lint is untouched** — it is design-side and already proves solvability;
  this port only makes the powers exist at runtime.
- **Full gate:** `npm run build` (tsc + Vitest + 2-page Vite build) green.

## 6. Build plan (subagent-driven, sequential)

Each task: fresh implementer + spec-compliance review + quality review, TDD, findings
fixed and re-verified — the §5.1 cadence. Powers all edit `stepOnce`, so **sequential**.

- **T0 — Foundation:** `FrameInput` optional fields; `input.ts` (X + Up) and `gamepad.ts`
  (button 1 + 8-way hat/stick up) power/up; `stepPlayer` optional `env` param + `PlayerState`
  power fields; `PowerEnv`/`PowerContext` wiring. **No power behavior yet** — scaffolding +
  the existing 13 tests still green.
- **T1 — Double-jump** (jump-button, `shouldAirJump`).
- **T2 — Dash** (power-press window, dispatcher).
- **T3 — Wall-climb** (Up-hold, `isOnClimbWall`).
- **T4 — Charge** (smash via `facingBreakable`; breakable composition + null-on-smash).
- **T5 — Glide** (power-held vy clamp, dispatcher).
- **T6 — Integration:** `main.ts` seed/grant/reset/smash-hide + debug handle; `level3d.ts`
  climb-wall + breakable rendering with reset-symmetric show paths.
- **T7 — Verify:** per-world browser run-throughs + `npm run build` gate; update PROGRESS.md,
  CLAUDE.md status, and the playbook (§1 + §5.4 → ✅).

## 7. Acceptance criteria

- [ ] All 5 powers behave with 2D parity in `src/three/`; the one power button is
      context-correct (charge > glide > dash) and wall-climb is on Up.
- [ ] `?world=hallway|kitchen|familyRoom|backyard` is traversable end-to-end (browser-proven).
- [ ] Companion-collect grants the real ability (not only a heart bonus); direct-load seeds
      the expected abilities via `abilitiesForArea`.
- [ ] The existing 13 physics-feel tests are unchanged and green; new per-power tests pass.
- [ ] Smashed breakables disappear and stop blocking; `resetLevel` restores them (gotcha #12).
- [ ] `npm run build` green (tsc + Vitest + 2-page build).

## 8. Out of scope

- Wiring `GameState` persistence into the 3D runtime (abilities stay 3D-local per run).
- Player power animation polish (dash streak / glide parachute / climb pose) — best-effort
  reuse of existing poses; dedicated art is a follow-up.
- Boss + cutscene 3D ports (logic kept in `src/logic/`, separate future work).
