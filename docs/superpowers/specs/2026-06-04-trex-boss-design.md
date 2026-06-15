# T-Rex Boss Fight (World 6 — Playhouse) — Design

**Date:** 2026-06-04
**Status:** Approved (brainstorm), pending implementation plan
**Scope:** Phase 7.1 finale + ROADMAP 7.2 / 7.3 — the **Dollhouse/Playhouse boss only**. The last area; completes the six-world arc. This is a **behavioral set-piece**, not a sketch→encode platformer level.
**Spec lineage:** Builds on the completed power system (`docs/superpowers/specs/2026-05-30-power-system-design.md`, P0–P5), the five shipped areas (Bedroom → Backyard), and the companion/token systems. The Backyard (`2026-06-03-backyard-area-design.md`) is the pre-boss graduation that hands the player into this arena via **glide**.

---

## 1. Goal & Success Criteria

A single-screen **T-Rex boss fight** that serves as the game's climax and the **payoff for every token collected across all six worlds**. Eloise enters the Playhouse arena (gated on glide), and the lifetime `picks` she has hoarded become her **ammo**: she dodges the T-Rex's telegraphed attacks, throws tokens at it during its recovery windows, and after **3 clean hits** the T-Rex is **tamed and befriended** — the game is complete.

**Identity:** *the collection finally matters.* Six worlds of breadcrumb-grabbing converge into one arsenal. The verb shifts from **stomp** (used on every prior enemy) to **throw + dodge** — gentler on little hands, and it lets the boss be big and imposing without Eloise climbing on it. The tone is the established one: **Bowser-lite, befriended not killed.**

**Done when:**

- [ ] A `BossScene` exists and is reached from the **Backyard finale's exit** (the player transitions from the last platformer level straight into the arena).
- [ ] A pure, Phaser-free **`bossFight` state-machine module** drives phase timing, hit counting, ammo spend, the companion bailout, and the win condition — unit-tested like `airJump.ts` / `powerDispatch.ts` / `reachability.ts`.
- [ ] **Throw mechanic:** **X** throws a token, **auto-aimed** at the T-Rex; **Space** still jumps/dodges. Each throw decrements `GameState.tokensCollected` (the HUD `picks:` counter *is* the ammo readout — no new HUD element).
- [ ] **Hits only count in the recovery window** (the T-Rex is winded/dizzy after an attack); tokens thrown at any other time miss/bounce harmlessly.
- [ ] **3 hits → tamed.** On the 3rd hit the T-Rex flops into a befriended pose and the fight ends → `GameState.worldComplete = true` → victory banner.
- [ ] **Two attacks:** **Stomp** (a ground shockwave the player jumps over) + **Charge** (the T-Rex runs across; the player steps aside / hops over). Telegraph (`roar`) **≥ 1.2s**; recovery window **≥ 2.0s** (ROADMAP 7.3 floors: telegraph > 1s, safe window > 2s).
- [ ] **Companion bailout:** if `tokensCollected` reaches 0 before the 3rd hit, the player's collected companions toss a small handful (enough to finish), so the fight can **never** soft-lock.
- [ ] **Forgiveness:** Eloise has her usual 3 hearts; a hit costs a heart + i-frames. At 0 hearts the **fight resets** (boss HP + hearts refill) — she is **never** bumped back to a platformer level. Effectively infinite retries.
- [ ] **Glide is the entry gate only** — it plays no role inside the fight (already wired by the order-based gating chain; no code).
- [ ] **Sprites are effect-stubbed** (see §7): dizzy = stars + wobble; tamed = `idle` + hearts + happy tint. A real "tamed" sprite is a later polish task, not this build.
- [ ] All **five companions** are present on the arena sidelines (for the bailout and to seed the ROADMAP 7.5 ending beat).
- [ ] `npm run build` green: tsc + Vitest (incl. the new `bossFight` unit tests) + the existing reachability lint over the 25 platformer levels (unchanged) + texture smoke + vite.
- [ ] Runtime smoke: arena renders, the T-Rex cycles telegraph→attack→recovery, a thrown token lands in the recovery window, 3 hits → tamed → win banner, no console errors.

---

## 2. Why this is a different kind of build

Every prior area was **declarative data** run through one pipeline (`levelSketches.ts → encodeFromSketch → LevelData`), and its correctness was **lint-proven** by the pure `reachability.ts` module (`npm run build` fails on a soft-lock). The encoder deliberately **rejects** the `trex` enemy type (`levelSketches.ts:46` — "the boss is a set-piece").

A boss is **imperative behavior** — a real-time state machine (telegraph → attack → recover → vulnerable). It cannot be reachability-lint-proven. So the verification story changes from *"is the level geometrically completable?"* to *"do the timing windows hold and can the fight never get stuck?"* — and the design's central move is to make that testable by isolating the behavior into a **pure module** (§4), exactly the pattern the power system used for every traversal predicate.

---

## 3. The Fight

### 3.1 The loop

```
       ┌──────────────────────────────────────────────────────┐
       │                                                       │
       ▼                                                       │
  TELEGRAPH ──▶ ATTACK ──▶ RECOVERY (vulnerable) ──▶ (loop) ───┘
  roar sprite   stomp OR    ~2.0s window:
  + shake       charge      throws COUNT here
  ≥1.2s                     │
                            ├─ 3rd hit ──▶ TAMED ──▶ worldComplete
                            └─ ammo == 0 ──▶ companion bailout
```

- **TELEGRAPH** — the `roar` sprite + a camera shake + a clear wind-up of ≥ 1.2s. Readable "here it comes."
- **ATTACK** — one of two (§3.2), chosen by the state machine.
- **RECOVERY** — the T-Rex is winded/dizzy for ≥ 2.0s. **This is the only window where thrown tokens count.** Tokens thrown outside it visibly bounce off (no progress, no penalty beyond the spent token).
- **Mild escalation:** each landed hit shortens the telegraph and recovery slightly, but never below the ROADMAP 7.3 floors (telegraph ≥ ~1.0s, window ≥ ~2.0s). The fight stays "beatable in 2–3 attempts."

### 3.2 The two attacks (mapped to the 3 sprites we have)

We have exactly three T-Rex sprites on disk: `trex_idle`, `trex_walk`, `trex_roar` (registered in `config/textures.ts`, loaded in `BootScene`). The attack set is designed around them:

- **Stomp** — telegraphed by `roar`; the T-Rex slams down and a **ground shockwave** rolls outward along the floor. The player **jumps** (a normal jump suffices; double-jump/glide also clear it) to avoid it. Getting clipped costs a heart.
- **Charge** — telegraphed by `roar`; the T-Rex **runs across the arena** (`walk` sprite). The player **steps aside or hops over**. *(This is ROADMAP 7.3's "swipe" reinterpreted — a horizontal charge reads far clearer than an arm-swipe with the sprites we have.)*

Two attacks is the right ceiling for a 4–8-year-old. The state machine alternates / randomizes between them (deterministic in tests via an injected picker — never `Math.random()` directly; see the repo's determinism rule).

### 3.3 Input & aiming

- **Space** = jump (dodge), unchanged from the rest of the game.
- **X = throw.** X is the game's one context-action button (`powerDispatch.ts`). On a single-screen arena, dash (its normal "otherwise" binding) is meaningless, so **X is repurposed to "throw" inside `BossScene`** — preserving the established one-action-button feel rather than teaching a brand-new key.
- **Auto-aim:** a throw lobs a token toward the T-Rex's current position automatically. A 4-year-old should not fight the aim — the skill is *timing the throw to the recovery window* and *dodging*, not precision targeting.
- A brief in-arena prompt ("Press X to throw!") teaches the new verb at fight start — the lightweight interim, consistent with the Kitchen's "Press ↑ to climb!" pattern. The full scripted intro is ROADMAP 7.3.5.

### 3.4 Ammo, bailout, and the HUD

- **Ammo = `GameState.tokensCollected`** — the lifetime count, already shown in the HUD as `picks: N` (`UIScene.refreshHud`). No new UI: that counter *is* the ammo gauge.
- Each throw decrements `tokensCollected` by 1 and emits `hud-update`. (Hits and misses both spend the token — there is no retrieval; misses are gone.)
- **Companion bailout:** when `tokensCollected` hits 0 and the fight is not yet won, the collected companions toss a small handful (e.g. enough to land the remaining hits with margin — tune to feel, default ~5). This is a "friends have your back" beat. It can fire more than once, guaranteeing the fight is **never** soft-lockable.
- **Edge case — entering with 0 picks:** a player who collected nothing arrives with 0 ammo. The bailout must therefore be able to fire at the *start* (ammo ≤ 0 at the first throw attempt → bailout), not only mid-fight. Stated explicitly so the implementation handles "already empty on arrival."

### 3.5 Forgiveness / lose handling

- Eloise keeps her 3 hearts (`GameState.hearts` / `maxHearts`); a successful T-Rex hit calls the existing `applyDamage()` (heart − 1 + invincibility window).
- **At 0 hearts the *fight* resets:** boss HP back to 3, hearts refilled, the player repositioned to the arena spawn. She is **never** sent back to a platformer level (contrast with `handlePitFall`/`onPlayerDied` in `GameScene`, which respawn within a level). Effectively infinite retries — matches the game's forgiveness-first ethos and ROADMAP 7.6's "no soft-locks."
- There are **no pits** in the arena (flat ground); the only damage source is the T-Rex's attacks.

### 3.6 Arena

- **Single screen, no scrolling.** Flat ground spanning the view, optionally one **low ledge** for variety/repositioning (kept low so it never gates anything).
- The **five companions** (Teddy, Dog, Cat, Horse, Flamingo) stand on the sidelines cheering — present for the bailout and as the raw material for the ROADMAP 7.5 ending ("companions remembered"). They are non-interactive set dressing here.
- Themed as the outdoor **Playhouse** (the Dollhouse was re-themed outdoor so Worlds 5→6 flow outdoors). Background art stays in blueprint mode like every other area (illustrated backdrops are a later pass).

### 3.7 Win

- The 3rd hit → the T-Rex flops into the tamed pose (effect-stub: `idle` + floating hearts + a warm tint), a short beat, then `GameState.worldComplete = true` + `worldComplete` persisted → the existing `world-complete` event → `UIScene.showWin()`.
- The banner copy becomes boss-flavored (e.g. "You tamed the T-Rex! 💚" / keep "Journey clear!"). The full **ending sequence** (companions parade, return-to-normal) is **ROADMAP 7.5**, built on the 7.3.5 cutscene engine — out of scope here.

---

## 4. Architecture — `BossScene` + a pure `bossFight` state machine

**Chosen approach (of three considered):** a thin **`BossScene`** orchestrates Phaser objects (arena geometry, the reused `Player`, the T-Rex sprite, thrown-token sprites, companions, camera, HUD/pause wiring), while a pure, **Phaser-free `bossFight.ts` module** owns the *behavior*:

- phase enum + transitions (`telegraph → attack → recovery → …`), driven by elapsed-time deltas passed in each frame;
- the active-attack picker (injectable for deterministic tests);
- hit registration (a throw only counts when `phase === recovery`);
- HP (3) and the tamed/win signal;
- ammo accounting + the bailout trigger (ammo ≤ 0 → request N tokens);
- timing floors + escalation math.

`BossScene.update(delta)` advances the module and reacts to the events/flags it returns (spawn shockwave, start charge tween, flash dizzy, decrement ammo, fire bailout, end fight). This is the **same pure-logic-behind-a-thin-Phaser-shell pattern** as `airJump.ts`, `powerDispatch.ts`, `breakableDetect.ts`, `climbDetect.ts`, and `reachability.ts` — and it is what makes the fight deterministically testable (the equivalent of the reachability lint).

**Why not boss-mode-inside-`GameScene`:** `GameScene` is already 553 lines doing one job well (loading platformer levels). A boss state machine + projectiles would tangle two responsibilities and bloat the file. Keeping the boss in its own scene keeps `GameScene` a clean platformer loader.

**Routing (Backyard finale → arena):** the Backyard is the last platformer area (catalog index 24). Today `GameScene.handleExit` sets `worldComplete` when there is no next catalog entry. For the boss, that terminal exit instead **launches `BossScene`**. Exact mechanism (a `boss`-flagged terminal catalog entry vs. a direct `this.scene.start("BossScene")` when the backyard finale is cleared) is an implementation detail to settle in the plan; the spec's requirement is only that **clearing the Backyard finale leads into the arena, and beating the boss sets `worldComplete`.**

**Scene/lifecycle discipline:** `BossScene` follows the project's Phaser scene-lifecycle rule — pair `create()` with a `SHUTDOWN` teardown that nulls instance refs and removes custom `scene.events` listeners (see the recycled-instance gotcha that `GameScene.teardown` documents). The `bossFight` module is re-instantiated fresh per scene start.

**HUD/pause reuse:** `UIScene` currently binds to `GameScene`'s emitter. `BossScene` should emit the same `hud-update` / `pause-changed` / `world-complete` events (or `UIScene` is made boss-aware) so hearts, the `picks:` ammo readout, the pause menu, and the victory banner all work unchanged. Settled in the plan.

---

## 5. New / changed files (anticipated — finalized in the plan)

| File | Change |
|---|---|
| `src/systems/bossFight.ts` (new) | Pure state machine: phases, timings, HP, hit/ammo/bailout/win logic. No Phaser import. |
| `src/systems/bossFight.test.ts` (new) | Unit tests: telegraph ≥1.2s, recovery ≥2.0s, hit-only-in-window, 3 hits→win, ammo spend, bailout at 0 (incl. arriving at 0), escalation floors. |
| `src/scenes/BossScene.ts` (new) | Thin Phaser shell: arena, Player reuse, T-Rex sprite, thrown-token entities, companions, throw input (X), effect-stubs, drives `bossFight`. |
| `src/entities/ThrownToken.ts` (new, or inline) | The lobbed-token projectile (auto-aimed arc, collision with the T-Rex). |
| `src/scenes/GameScene.ts` | Terminal-exit routing: Backyard finale → `BossScene` instead of `worldComplete`. |
| `src/scenes/UIScene.ts` | Boss-aware HUD/banner wiring if needed (ammo readout already exists). |
| `src/config/textures.ts`, `BootScene.ts` | Already register/load `trex_idle/walk/roar` — no change unless a sprite is added later. |
| Scene registration (game config) | Register `BossScene`. |

`src/types/level.ts`, `encodeFromSketch.ts`, `reachability.ts`, and every existing area remain **untouched** — the boss does not flow through the level pipeline.

---

## 6. Verification — the deterministic substitute for the reachability lint

Because the fight is real-time, the guarantee comes from the pure module, not a human playtest:

- **`bossFight` unit tests (the core gate):**
  - telegraph duration ≥ 1.2s and recovery window ≥ 2.0s at every escalation step (floors never breached);
  - a throw registered during `telegraph`/`attack` does **not** reduce HP; a throw during `recovery` **does**;
  - exactly **3** in-window hits → tamed/win;
  - each throw decrements ammo; ammo reaching 0 → bailout grants N (and the fight remains winnable);
  - **arriving with 0 ammo** still resolves (bailout fires on first throw attempt);
  - losing all hearts resets the fight (HP back to 3) without advancing/regressing the level.
- **Build gate unchanged:** `npm run build` still runs the reachability lint over the 25 platformer levels (the boss is not in that set) + texture smoke + tsc + vite.
- **Runtime smoke (human, dev preview):** enter the arena from the Backyard finale (or a dev jump), watch a full telegraph→attack→recovery cycle, land a throw in the window, confirm 3 hits → tamed → "you tamed the T-Rex" banner, confirm the bailout by spending to 0, confirm no console errors.
- **Manual feel playtest (human handoff):** Phaser ignores synthetic input, so the *feel* — telegraph readability, dodge fairness, throw timing, the bailout moment — is a human pass, as with every prior area.

---

## 7. Sprites — effect-stub now, generate later

We have `idle`, `roar`, `walk`. The two **missing** expressive states are stubbed with effects, no new art in this build:

- **Dizzy / recovery (the vulnerable window):** `idle` (or `roar` held) + a small ring of spinning star particles + a wobble/tween. Reads as "stunned, hit me now."
- **Tamed / befriended (the win):** `idle` + floating hearts + a warm happy tint + a gentle settle tween. Reads as "we're friends now."

A real **"tamed" T-Rex sprite** (sitting/smiling, storybook style via the NanoBanana → rembg pipeline, per the `2026-05-24-storybook-character-art` spec and ROADMAP A.5 STYLE_BIBLE) is a **focused polish follow-up**, tracked separately — explicitly **not** a dependency of shipping the fight. This keeps the build about the *one new system* (the throw/dodge state machine).

---

## 8. Out of scope (each its own later spec / pass)

- **Scripted cutscene system (ROADMAP 7.3.5)** — the real per-power intros + the intro/ending engine. The boss ships with the lightweight interim (an in-arena "Press X to throw!" prompt), exactly as the Kitchen shipped "Press ↑ to climb!".
- **Intro sequence (7.4)** and **Ending sequence (7.5)** — the companions parade / return-to-normal. The boss only *seeds* the ending by putting all five companions on screen and setting `worldComplete`.
- **A real "tamed" T-Rex sprite** (and optional "dizzy" pose) — §7 polish follow-up.
- **Illustrated arena background** — stays blueprint-mode like every area; returns in the art pass.
- **Touch controls for throw (Phase T)** — the throw verb will need a touch button when the touch track is built; out of scope here.
- **Audio** (roar SFX, hit/tamed stingers) — general audio pass.

---

## 9. Build phases (for the implementation plan)

A suggested decomposition (the plan will finalize tasks, ordering, and TDD seams):

- **P0 — Pure `bossFight` state machine + tests.** No Phaser. Phases, timings, HP, hit-in-window, ammo/bailout, escalation. This is the gate everything else hangs off, and it's fully testable before any rendering exists.
- **P1 — `BossScene` shell + arena.** Register the scene, build the arena (ground + low ledge + companions), reuse `Player`, wire camera + HUD/pause events + SHUTDOWN teardown.
- **P2 — The T-Rex + attacks.** Sprite, telegraph (roar+shake), stomp (shockwave) + charge, driven by `bossFight`. Effect-stub the dizzy window.
- **P3 — Throw + ammo.** X-to-throw (auto-aim), `ThrownToken` arc + collision, decrement `picks`, in-window hit registration, the "Press X to throw!" prompt.
- **P4 — Win + bailout + forgiveness.** 3 hits → tamed effect-stub → `worldComplete` → banner; companion bailout at 0 (incl. arrive-at-0); 0-hearts fight reset.
- **P5 — Routing + proof.** Backyard finale → `BossScene`; full `npm run build` green; runtime smoke; mark ROADMAP 7.1 complete (5/5) + 7.2 (partial — sprites stubbed) + 7.3.

---

## Appendix — Key files (current state)

- `src/design/levelSketches.ts:1893` — `DOLLHOUSE_AREA` scaffold (`isBoss: true`, `primaryEnemy: "trex"`, empty slot). The arena does **not** need to flow through this; it's a behavioral scene.
- `src/config/textures.ts:43` / `BootScene.ts:75` — `TREX_IDLE/WALK/ROAR` registered + loaded (3 sprites).
- `src/scenes/GameScene.ts:484` — `handleExit` (terminal exit → `worldComplete`; the routing hook).
- `src/scenes/GameScene.ts:130` — `teardown` (the scene-lifecycle pattern `BossScene` must follow).
- `src/scenes/UIScene.ts:163` — `refreshHud` (`picks: N` = the ammo readout) / `:242` `showWin`.
- `src/entities/powerDispatch.ts` — the X context-action button (dash repurposed → throw in-arena).
- `src/state/GameState.ts` — `tokensCollected` (ammo), `hearts`/`maxHearts`, `worldComplete`.
- `src/config/companions.ts` — the five companions present at the arena.
- `src/entities/Player.ts:366` — `applyDamage()` (heart loss + i-frames), reused for boss hits.
