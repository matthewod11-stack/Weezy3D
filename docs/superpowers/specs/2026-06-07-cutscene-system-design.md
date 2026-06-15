# Scripted Cutscene System (power intros + intro/ending engine) — Design

**Date:** 2026-06-07
**Status:** Approved (brainstorm), pending implementation plan
**Scope:** ROADMAP **7.3.5** — the **reusable cutscene engine + all 5 power-intro cutscenes**. Replaces the interim `PowerUnlockScene` modal that fires on companion pickup. The 7.4 intro and 7.5 ending are **separate specs** that reuse this engine (it leaves a deliberate seam for them, §4.4).
**Spec lineage:** Builds on the completed power system (`docs/superpowers/specs/2026-05-30-power-system-design.md`, P0–P5) and the companion/ability config (`src/config/companions.ts`, `src/config/abilities.ts`). Follows the **pure-logic-behind-a-thin-Phaser-shell** pattern proven by `airJump.ts` / `powerDispatch.ts` / `reachability.ts` / `bossFight.ts` (`docs/superpowers/specs/2026-06-04-trex-boss-design.md` §4). Supersedes the lightweight interim shipped by Kitchen (`2026-06-03-kitchen-area-design.md` §7).

---

## 1. Goal & Success Criteria

When Eloise meets a companion, a short **scripted cutscene** introduces the power that companion grants — the companion bounces in, **demonstrates its signature move on a little stage**, and the power is named. This replaces the current static `PowerUnlockScene` reveal with a richer, *show-don't-tell* moment that teaches a **non-reading 4-year-old** what the new power does, while remaining a **reusable engine** that the intro (7.4) and ending (7.5) will render their storybook pages with.

**Identity:** *the demo is the teacher.* The audience is 4–8 and often pre-literate, so a looping visual of the move — not caption text — does the teaching. Captions are for parents and older kids. The tone is the established warm storybook one.

**Done when:**

- [ ] A pure, Phaser-free **`cutscene` timeline-controller module** sequences beats by duration and handles skip/complete — unit-tested like `bossFight.ts`.
- [ ] A thin **`CutsceneScene`** renders the current beat: a framed card over the dimmed game, the companion + caption + a **looping live mini-demo** on a small stage + a power-name pop, plus skip UI.
- [ ] **`powerIntroScript(type)`** (data-driven, in `src/config/cutscenes.ts`) builds a valid `CutsceneScript` for **all 5** companions from `COMPANIONS` + `ABILITIES` + `COMPANION_LABELS`.
- [ ] All 5 power intros are wired on companion pickup, replacing the `PowerUnlockScene` modal with **identical pause/resume choreography**; `PowerUnlockScene.ts` is deleted and `CutsceneScene` is registered in `main.ts`.
- [ ] Each intro is **< 10s** and **skippable**: beats auto-advance (hybrid pacing — §6); a **tap hurries** to the next beat; a **`skip ▸` button bails** the whole thing.
- [ ] The companion performs its signature move via **scripted tweens** of the existing idle sprite (no new art): `doubleHop` · `dash` · `climb` · `charge` · `glide` (§4.5).
- [ ] `npm run build` green: tsc + Vitest (incl. the new `cutscene` + `cutscenes` unit tests) + the existing reachability lint over the 25 platformer levels (unchanged) + texture smoke + vite.
- [ ] Runtime smoke: each of the 5 intros renders the additive card, auto-advances, tap-ahead and skip work, gameplay resumes on complete, no console errors.

**Explicitly NOT in this task** (§11): the 7.4 intro and 7.5 ending *content*; voiceover/narration; real per-power demo art; retiring the in-level button prompts.

---

## 2. Design decisions (the brainstorm)

- **Visual direction = "card + live mini-demo"** (Direction C of three). A modal framed card dims the game; inside the frame a small **live diorama** loops where the companion really performs the move. Chosen over (A) a static card with motion arrows — because a looping demo genuinely *shows* a non-reader the mechanic — and over (B) an in-world cinematic where the companion performs the move on the real level — because (B) couples cutscenes to every level's geometry and the real physics engine, the riskiest option. The card is fully **decoupled from level geometry**, so it cannot break the reachability lint or depend on companion placement.
- **Pacing = hybrid auto-play.** Beats carry durations and auto-advance (hands-off for the youngest); a tap hurries to the next beat; a corner `skip ▸` bails the whole cutscene. Meets the *"< 10s, skippable"* criterion without leaving a 4-year-old stuck or mashing.
- **Engine implementation = pure sequencer + tween-rendered beats** (Approach 1 of three). The deterministic timeline is a pure module (testable); the demo is **scripted tweens** of existing sprites — chosen over a nested mini-physics world (heavyweight, nondeterministic, untestable) and over pre-baked demo spritesheets (art we don't have).
- **Scope = engine + all 5 power intros.** Intro/ending are separate specs reusing the engine; the in-level button prompts stay (they teach the *specific button*, the cutscene teaches the *concept*).
- **The companion is the demo actor.** It performs its own signature move ("I'm giving you my power"), reusing the companion idle sprite we already load.

---

## 3. Architecture — `CutsceneScene` + a pure `cutscene` timeline

Three units + scripts-as-data, mirroring the boss build:

| File | Role | Tested? |
|---|---|---|
| `src/systems/cutscene.ts` | **Pure timeline controller** — Phaser-free. Sequences `CutsceneBeat[]` by duration; `advance`/`skipBeat`/`skipAll`/`currentBeat`/`done`. | ✅ unit (`cutscene.test.ts`) |
| `src/scenes/CutsceneScene.ts` | **Thin Phaser shell** — renders the current beat (framed card, captions, demo tweens, skip UI); emits `cutscene-complete`. | 🔍 in-browser smoke |
| `src/config/cutscenes.ts` | **Scripts as data** — `powerIntroScript(type)` + the `CompanionType → DemoMotion` map. | ✅ unit (`cutscenes.test.ts`) |

The verification story matches `bossFight`: a real-time, input-driven sequence can't be reachability-lint-proven, so the **deterministic core** (which beat are we on; did we just transition; are we done) is isolated into a pure module and unit-tested, while the Phaser rendering (sprites, tweens, layout) is in-browser smoke-tested.

---

## 4. The engine in detail

### 4.1 Data model — the beat vocabulary

```ts
// src/systems/cutscene.ts (pure, Phaser-free)

export type DemoMotion = "doubleHop" | "dash" | "climb" | "charge" | "glide";

export type CutsceneBeat =
  | { kind: "enter";   actor: string; sprite: string; entrance: "bounceIn" | "fadeIn"; durationMs: number }
  | { kind: "caption"; text: string; durationMs: number }                              // "Teddy joined you!"
  | { kind: "demo";    actor: string; motion: DemoMotion; durationMs: number }   // demo loops for durationMs
  | { kind: "title";   text: string; durationMs: number }                              // big "DOUBLE JUMP!" pop
  | { kind: "hold";    durationMs: number };

export interface CutsceneScript {
  id: string;
  beats: CutsceneBeat[];
  backdrop: "dimGame";   // power intros dim the game; intro/ending will add their own backdrops (§4.4)
}
```

### 4.2 The pure timeline controller (the testable core)

```ts
export interface CutsceneState { beatIndex: number; elapsedMs: number; done: boolean; }

export function initCutscene(): CutsceneState;                                  // { 0, 0, false }
export function advanceCutscene(s: CutsceneState, script: CutsceneScript, dtMs: number):
  { state: CutsceneState; transitioned: boolean };   // transitioned=true when a new beat is entered OR the script completes
export function skipBeat(s: CutsceneState, script: CutsceneScript):
  { state: CutsceneState; transitioned: boolean };   // tap-ahead → jump to next beat (or done from the last)
export function skipAll(s: CutsceneState, script: CutsceneScript): CutsceneState; // global skip → done:true
export function currentBeat(s: CutsceneState, script: CutsceneScript): CutsceneBeat | null; // null when done
```

**Semantics:**
- `advanceCutscene` accumulates `elapsedMs`; when it reaches the current beat's `durationMs` it carries the remainder into the next beat (so a large `dtMs` can cross multiple short beats deterministically) and reports `transitioned: true`. Past the last beat, `done: true`, `currentBeat → null`.
- The controller tracks **only** beat index, in-beat elapsed time, and done-ness. It never computes pixel positions — the scene owns all rendering.

### 4.3 The rendering model — **additive, staggered card** (this is what makes it Direction C)

Rendered elements **persist** across beats — a beat triggers each element's *entrance*; it does **not** wipe the card. So the card *builds up*: the companion bounces in → the caption fades in → the demo starts looping on the mini-stage → the power-name pops → everything **holds**. By the `hold` beat, the whole Direction-C card is on screen at once. The `CutsceneScene` reconciles on each `transitioned` tick: it reads `currentBeat` and creates/animates the corresponding Phaser object, leaving prior objects in place.

### 4.4 The reuse seam (for 7.4 / 7.5 — designed, not built)

Sequential page-swaps (storybook pages) are deliberately **not** in v1. When the intro (7.4) and ending (7.5) specs land, they extend the engine by adding new beat kinds (e.g. `page` / `clear` / `fade`) and their renderers in `CutsceneScene` — **the pure controller is untouched** (it already sequences any `CutsceneBeat[]` by duration). The `backdrop` field on `CutsceneScript` is the hook for their full-screen backdrops vs the power-intro `dimGame`.

### 4.5 The demo tweens (`DemoMotion` → motion)

The **companion** (its existing `idleKey` sprite) performs its signature move on the card's mini-stage, looping for the `demo` beat's `durationMs`. Motion is **scripted Phaser tweens** (paths authored as small per-motion data, executed by the scene — not unit-tested, like BossScene's tweens):

| Motion | What plays on the stage |
|---|---|
| `doubleHop` | two upward arcs (a hop, then a second hop near the apex) |
| `dash` | a quick horizontal streak across the stage |
| `climb` | a vertical crawl up a small wall prop |
| `charge` | a horizontal run into a prop that shatters |
| `glide` | a leap followed by a slow, floaty parachute descent |

A light squash/stretch on the static sprite sells the motion. No new art.

---

## 5. The 5 power-intro scripts (one builder, data-driven)

`powerIntroScript(type: CompanionType): CutsceneScript` emits the same 5-beat shape for every power, filled from config:

```
enter(companion, "bounceIn", 600)
caption(`${COMPANION_LABELS[type]} joined you!`, 400)     // "Teddy joined you!"
demo(companion, MOTION[type], 3000)                      // the looping mini-demo (loops for the duration)
title(`${ABILITIES[COMPANIONS[type].grants].label.toUpperCase()}!`, 1500)   // "DOUBLE JUMP!"
hold(1500)                                                // ≈ 7.0s total  ✓ (< 10s)
```

| Companion | `grants` | `DemoMotion` | Title |
|---|---|---|---|
| `teddy` | doubleJump | `doubleHop` | DOUBLE JUMP! |
| `dog` | dash | `dash` | DASH! |
| `cat` | wallClimb | `climb` | WALL CLIMB! |
| `horse` | charge | `charge` | CHARGE! |
| `flamingo` | glide | `glide` | GLIDE! |

The `CompanionType → DemoMotion` map lives in `cutscenes.ts` and is **compile-time exhaustive** (a typed `Record<CompanionType, DemoMotion>`, no `default` fallthrough) — adding a companion without a motion is a type error.

---

## 6. Pacing & skip (the hybrid)

- Beats auto-advance after `durationMs` (the controller, ticked from `CutsceneScene.update(_, dt)`).
- **Tap anywhere = hurry** → `skipBeat` (jump to the next beat early). (`keydown` + `pointerdown`.)
- **`skip ▸` corner button = bail** → `skipAll` → complete immediately. (A small always-visible affordance, distinct from the tap-to-hurry surface so the two don't fight.)
- Gameplay physics stays **paused** for the whole cutscene (the existing `companion-collected` choreography); on `cutscene-complete` the scene is stopped and physics resumes.

---

## 7. Integration (drop-in at the existing hook)

`GameScene`'s `companion-collected` handler (currently `GameScene.ts:93`) swaps the modal for the cutscene — *identical* pause/resume shape:

```ts
this.events.on("companion-collected", (info: { type: CompanionType }) => {
  this.physics.world.pause();
  const cs = this.scene.get("CutsceneScene");
  cs.events.once("cutscene-complete", () => {
    this.scene.stop("CutsceneScene");
    this.physics.world.resume();
  });
  this.scene.launch("CutsceneScene", { script: powerIntroScript(info.type) });
});
```

- `PowerUnlockScene.ts` is **deleted**; its registration removed from `main.ts`; `CutsceneScene` registered in its place.
- The reveal text reuses `COMPANION_LABELS` (caption) and `ABILITIES[...].label` (title), so the wording does not regress.
- The in-level button prompts (`GameScene.ts:278` "Press ↑ to climb!"; `BossScene.ts:130` "Press X to throw!") are **untouched**.

---

## 8. Phaser scene-lifecycle discipline

Per the project's scene-lifecycle gotchas (instances are recycled; pair `create()` with SHUTDOWN teardown) and the boss-build lesson (`noUnusedLocals` flags **write-only private fields**, so a scene must be authored in one pass, not incrementally across tasks):

- `CutsceneScene` registers a `SHUTDOWN` handler that kills any running tweens/timers and clears its element references, so a second cutscene (the next companion) starts clean.
- `CutsceneScene` is authored as **one complete file** in a single task — not stubbed and grown across commits.
- The pure `cutscene.ts` controller holds no module-level mutable state; all state is in the caller-owned `CutsceneState` (the scene owns its instance).

---

## 9. Verification — the deterministic substitute

| Test | Asserts |
|---|---|
| `src/systems/cutscene.test.ts` | `initCutscene` defaults; `advanceCutscene` accrues `elapsedMs` and transitions **exactly** at a beat's `durationMs` boundary (and not a tick early); a large `dtMs` crosses multiple beats with the remainder carried; a 5-beat script walks `beatIndex` 0→4→`done`; `skipBeat` advances one beat (and completes from the last); `skipAll` → `done:true`; `currentBeat` → `null` when done. |
| `src/config/cutscenes.test.ts` | `powerIntroScript(type)` returns a valid script for **all 5** `CompanionType`s; each script's beats **sum ≤ 10 000ms** (the acceptance criterion, wired into a test); the `demo` beat's `motion` matches `MOTION[type]`; the `title` contains `ABILITIES[grants].label`. |

- **Build gate:** `npm run build` — tsc (strict; exhaustive `Record` enforced) + Vitest + the unchanged reachability lint over the 25 platformer levels + texture smoke + vite. (The cutscene system adds no catalog levels and touches no level data, so the lint surface is unchanged.)
- **Runtime smoke** (dev preview, like BossScene): trigger each of the 5 intros (play to each companion, or a dev helper); confirm the additive card builds up, auto-advances under ~7s, tap-ahead skips a beat, `skip ▸` bails, and gameplay resumes with the power now usable. Phaser ignores synthetic input, so *feel* (timing/charm) is a human handoff — mechanical correctness is unit-tested.

---

## 10. New / changed files (anticipated — finalized in the plan)

| File | Change |
|---|---|
| `src/systems/cutscene.ts` | **New** — pure timeline controller + types (§4.1, §4.2). |
| `src/systems/cutscene.test.ts` | **New** — controller unit tests (§9). |
| `src/config/cutscenes.ts` | **New** — `powerIntroScript` + `MOTION` map (§5). |
| `src/config/cutscenes.test.ts` | **New** — script unit tests (§9). |
| `src/scenes/CutsceneScene.ts` | **New** — the thin rendering shell (§4.3, §4.5, §6, §8). |
| `src/scenes/PowerUnlockScene.ts` | **Deleted** — superseded. |
| `src/scenes/GameScene.ts` | Swap the `companion-collected` handler to launch `CutsceneScene` (§7). |
| `src/main.ts` | Unregister `PowerUnlockScene`, register `CutsceneScene`. |

---

## 11. Out of scope / non-goals (YAGNI)

- **7.4 intro / 7.5 ending content** — separate specs; this engine leaves the `page`/`clear`/`fade` seam (§4.4).
- **Voiceover / narration** — the visual demo is the teacher. *Optional, only if cheap:* a single friendly sfx on the title pop reusing existing audio — no new audio pipeline.
- **Real per-power demo art** — we tween the existing idle sprites (§4.5).
- **Retiring the in-level button prompts** — "Press ↑ to climb!" / boss "Press X to throw!" stay (they teach the specific button).
- **Eloise-mimics-the-move** — companion-only demo for v1.
- **A `companion-ordering` lint** (proving a cutscene can't fire before its companion is reachable) — placement discipline + the reachability lint already guarantee companions are reachable.

---

## 12. Build phases (for the implementation plan)

Each phase is build-green before the next, following the established discipline (edit → targeted Vitest → commit). TDD on the pure units.

- **P0 — Pure controller.** `src/systems/cutscene.ts` (types + `init`/`advance`/`skipBeat`/`skipAll`/`currentBeat`) with `cutscene.test.ts` first (§4.2, §9). No Phaser.
- **P1 — Scripts.** `src/config/cutscenes.ts` (`MOTION` record + `powerIntroScript`) with `cutscenes.test.ts` (all 5 valid, ≤10s, motion/label match) (§5, §9).
- **P2 — Scene shell.** `src/scenes/CutsceneScene.ts` authored in one pass: additive card, the 5 demo tweens, captions, title pop, skip UI, SHUTDOWN teardown, `cutscene-complete` emit (§4.3, §4.5, §6, §8). tsc green.
- **P3 — Integration.** Swap `GameScene`'s handler (§7); delete `PowerUnlockScene`; register `CutsceneScene` in `main.ts`. Final `npm run build` green + runtime smoke of all 5 intros.

---

## Appendix — Key files (current state)

| File | Role in this spec |
|---|---|
| `src/scenes/PowerUnlockScene.ts` | The interim modal being replaced/deleted (companion sprite + caption + "press any key"). |
| `src/scenes/GameScene.ts` | `companion-collected` hook (`:93`) + pause/resume choreography; in-level climb prompt (`:278`). |
| `src/scenes/BossScene.ts` | The pure-module-behind-thin-shell precedent; its `bossFight` timing pattern mirrors `cutscene.ts`. |
| `src/systems/bossFight.ts` | The pure-controller pattern this follows. |
| `src/config/companions.ts` | `COMPANIONS[type]` → `{ area, grants, idleKey, ... }`; source of the demo sprite + granted ability. |
| `src/config/abilities.ts` | `ABILITIES[grants].label` → the power-name title text. |
| `src/design/levelSketches.ts` | `CompanionType` + `COMPANION_LABELS` → the caption name. |
| `src/main.ts` | Scene registry — unregister `PowerUnlockScene`, register `CutsceneScene`. |
| `ROADMAP.md` | 7.3.5 item (marked done by the implementation plan). |
