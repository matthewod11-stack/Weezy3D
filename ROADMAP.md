# Princess Eloise's Big Adventure — V1 Roadmap (Web)

> **V1 Goal:** Eloise can play through a complete journey from bedroom to T-Rex boss, collecting 5 companions, in a seamless HD-2D pixel art experience
> **Tech Stack:** Phaser 3, TypeScript, Vite
> **Target User:** Kids (4-8) playing on desktop or tablet
> **Target Platform:** Web (itch.io HTML5)
> **Created:** 2026-01-24
> **Execution Mode:** SEQUENTIAL (core systems must exist before content)

---

## Strategic Constraints

Decisions made during scoping:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **World Structure** | 1 seamless journey, 6 connected areas | Single room felt too short; continuous journey is more immersive |
| **Visual Style** | HD-2D (pixel art + shaders) | Distinctive look, leverages Phaser's capabilities |
| **First Milestone** | Bedroom area playable | Prove core loop before building full journey |
| **Assist Mode** | Deferred to V1.5 | Base difficulty tuned for kids; add presets later |
| **Physics Verification** | Play-feel testing | Trust tuned constants, iterate by playing |
| **Mobile** | Touch controls from start | Required for target audience |

---

## Design Change: Journey Structure

**Old (6 separate worlds):**
```
World Select → World 1 (4 levels) → World 2 (4 levels) → ... → World 6 → Boss
```

**New (1 continuous journey):**
```
Intro → Bedroom → Hallway → Kitchen → Family Room → Backyard → Playhouse → Boss → Outro
         ↓         ↓          ↓           ↓            ↓           ↓
       Teddy      Dog        Cat        Horse       Flamingo     T-Rex
```

- **No world select screen** — Journey progresses linearly
- **Seamless area transitions** — Walk through doorways, no loading screens
- **Checkpoints** — Auto-save at area transitions and mid-area
- **Companions** — One per area (except Dollhouse which has boss)

---

## Phase Overview

| Phase | Focus | Tasks | Milestone |
|-------|-------|-------|-----------|
| 0 | Foundation | 8 | `npm run dev` shows Phaser canvas |
| 1 | Core Movement | 7 | Eloise jumps: 80-90px height, 0.35s rise |
| 2 | Level System | 7 | JSON loads, transitions < 100ms, no hitches |
| 3 | Entities | 8 | Enemies, companions, tokens work |
| 4 | Game Loop | 6 | Health, checkpoints, save/load |
| 5 | HD-2D Polish | 7 | Shaders < 2ms GPU, cutscene system ready |
| 6 | Bedroom Area | 5 | First area: 2-4 min, no soft-locks |
| 7 | Full Journey | 6 | Full game: 15-25 min playtime |
| T | Touch Controls | 4 | Parallel track — mobile input |

**Total: ~58 tasks**

---

## Phase 0: Foundation

**Goal:** Establish project infrastructure. Phaser runs, assets load, types compile.

### Tasks

- [x] **0.1 — Project scaffolding**
  - Scope: Vite + Phaser 3 + TypeScript setup
  - Acceptance: `npm run dev` opens browser with Phaser canvas
  - Verification: Manual — see "Phaser" text on screen

- [x] **0.2 — Asset pipeline setup**
  - Scope: Configure Vite to serve assets folder, set up texture atlas build (TexturePacker or free alternative)
  - Acceptance: Can load a sprite and display it
  - Verification: Eloise sprite visible on canvas
  - Note (Gemini): Use texture atlases, not individual PNGs
  - Note: Using direct spritesheets for now; atlas build deferred to Phase 5 optimization

- [x] **0.3 — Core type definitions**
  - Scope: `src/types/` — LevelData, Platform, Enemy, Companion, Token, GameState interfaces
  - Acceptance: All types compile, match WEB_MIGRATION_SPEC.md
  - Verification: `tsc --noEmit` passes

- [x] **0.4 — Physics constants**
  - Scope: `src/config/physics.ts` — All tuned values from Godot
  - Acceptance: Constants match spec exactly
  - Verification: Code review

- [x] **0.5 — Game state manager**
  - Scope: Singleton outside Phaser scenes for health, companions, tokens, checkpoint
  - Acceptance: State persists across scene transitions
  - Verification: Console.log state before/after scene change
  - Note (Gemini/Codex): Don't store state in Phaser scenes

- [x] **0.6 — Scene structure**
  - Scope: BootScene (loading), GameScene (gameplay), basic scene flow
  - Acceptance: Can transition Boot → Game
  - Verification: Manual

- [x] **0.7 — Fixed timestep setup**
  - Scope: Configure Phaser for consistent physics regardless of frame rate
  - Acceptance: Physics feels same at 30fps and 60fps
  - Verification: Throttle to 30fps, compare jump height
  - Note (Codex): Critical for feel parity

- [x] **0.8 — Device pixel ratio handling** *(partial)*
  - Scope: Crisp rendering on Retina/HiDPI screens
  - Acceptance: Not blurry on iPhone
  - Verification: Test on phone or retina display
  - Note: `RENDER_SCALE=2` + integer CSS scaling in `display.ts`; avoid manual canvas resize

### Deliverables
- [x] `npm run dev` shows styled canvas
- [x] Eloise sprite loads and displays
- [x] All types compile

### Pause Point 0A
**Review:** Verify foundation is solid. Test on phone browser.

---

## Phase 1: Core Movement

**Goal:** Eloise moves and jumps with the exact feel from Godot prototype.

### Tasks

- [x] **1.1 — Player sprite and animations**
  - Scope: Load spritesheet, configure 6-frame animations (idle, walk, jump, fall)
  - Acceptance: Animations play correctly based on state
  - Verification: Visual check

- [x] **1.2 — Basic movement (ground)**
  - Scope: Left/right movement at SPEED=100, instant direction change on ground
  - Acceptance: Eloise walks left/right
  - Verification: Manual play

- [x] **1.3 — Asymmetric gravity jump**
  - Scope: Implement custom gravity (UP=600, APEX=400, DOWN=900) with apex detection
  - Acceptance: Jump height = 80-90px, rise time = ~0.35s, fall time = ~0.25s
  - Verification: Add debug overlay showing jump metrics; values must match targets
  - Note: This is THE critical task

- [x] **1.4 — Variable jump + coyote time + buffer**
  - Scope: Early release = half velocity, 100ms coyote, 100ms buffer
  - Acceptance: Short hops possible, forgiving timing
  - Verification: Walk off edge, jump late — should work
  - Resource: See `platformer-physics` skill for implementation pattern

- [x] **1.5 — Air control**
  - Scope: Lerped movement in air (0.15 blend, 0.85 speed multiplier)
  - Acceptance: Can steer mid-jump but has momentum
  - Verification: Manual play

- [x] **1.6 — Squash & stretch**
  - Scope: Stretch on jump (0.8×1.25), squash on land (1.3×0.7), lerp return
  - Acceptance: Visible deformation on jump/land
  - Verification: Visual check
  - Resource: See `platformer-physics` skill for Phaser tween pattern

- [x] **1.7 — Jump shadow**
  - Scope: Shadow at ground level, scales based on height
  - Acceptance: Shadow visible, shrinks when high
  - Verification: Visual check

### Deliverables
- [x] Eloise moves and jumps with correct feel
- [x] Squash/stretch and shadow working

### Pause Point 1A
**Review:** CRITICAL — Verify jump metrics: height 80-90px, rise ~0.35s, fall ~0.25s. If values match but feel is off, iterate before proceeding.

---

## Phase 2: Level System

**Goal:** Can load level data from JSON and render playable environment.

### Tasks

- [x] **2.1 — Level JSON schema**
  - Scope: Define and validate level data format with Zod or similar
  - Acceptance: Invalid JSON throws clear error
  - Verification: Pass invalid JSON, see error
  - Note (Codex): Runtime validation prevents AI-generated bugs

- [x] **2.2 — Background rendering**
  - Scope: Load and display level background image
  - Acceptance: Background shows at correct position
  - Verification: Visual check

- [x] **2.3 — Platform collision**
  - Scope: Create static bodies from JSON platform data
  - Acceptance: Eloise stands on platforms, can't walk through them
  - Verification: Manual play
  - Resource: stackabuse.com/phaser-3-and-tiled-building-a-platformer/ for Tiled workflow

- [x] **2.4 — Level boundaries**
  - Scope: Invisible walls at level edges, fall detection
  - Acceptance: Can't walk off sides, falling triggers respawn
  - Verification: Walk to edges, fall off bottom

- [x] **2.5 — Camera system**
  - Scope: Follow player with bounds, look-ahead in movement direction
  - Acceptance: Look-ahead offset = 40-60px in movement direction; camera stays within level bounds
  - Verification: Debug overlay showing camera offset; test at level edges
  - Note (Gemini): Look-ahead critical for mobile
  - Note: Added dynamic zoom on high jumps for bouncy platforms

- [x] **2.6 — Area transitions**
  - Scope: Trigger zones that load next area seamlessly
  - Acceptance: Walk to door → appear in next area; transition < 100ms
  - Verification: Create test transition between two areas; measure with devtools
  - Note: Lazy background preload near exits; bedroom → hallway stub live

- [x] **2.7 — Level streaming & memory management** *(partial)*
  - Scope: Preload next area when approaching transition; unload previous area after leaving
  - Acceptance: No hitch > 16ms during transition; memory stays under 150MB
  - Verification: Chrome DevTools performance/memory profiling during area traversal
  - Note: `LevelBackgroundLoader` load/unload; verify hitch on device

### Deliverables
- [x] Can load JSON level and play in it
- [x] Camera follows correctly
- [ ] Transitions work with no perceptible hitch — preload helps; verify on device

### Pause Point 2A
**Review:** Create a test level JSON, verify it loads correctly.

---

## Phase 3: Entities

**Goal:** Enemies, companions, and tokens are functional.

### Tasks

- [x] **3.1 — Enemy base class**
  - Scope: Shared behavior: patrol, collision detection, defeat-on-stomp
  - Acceptance: Base enemy can be extended
  - Verification: Code review
  - Resource: ourcade/sidescrolling-platformer-template-phaser3 uses StateMachine pattern

- [x] **3.2 — Dust Bunny enemy**
  - Scope: Bounces/rolls, patrol movement, defeat behavior
  - Acceptance: Bounces around, can be stomped
  - Verification: Manual play

- [x] **3.3 — Additional enemies (Ant, Dust Mite, Spider)**
  - Scope: Unique behaviors per spec
  - Acceptance: All 4 enemy types work
  - Verification: Place one of each in test level

- [x] **3.4 — Enemy collision with player**
  - Scope: Top = defeat enemy + bounce, side/bottom = damage player
  - Acceptance: Correct behavior both ways
  - Verification: Get hit, stomp enemy
  - Note (Codex): Make hitboxes forgiving for kids

- [x] **3.5 — Token collectible**
  - Scope: Area2D with hover animation, collect on touch, update state
  - Acceptance: Tokens float, disappear when touched, count increases
  - Verification: Collect tokens, check counter

- [x] **3.6 — Companion following system**
  - Scope: Position history buffer, companion traces player path with delay
  - Acceptance: Companion follows behind smoothly
  - Verification: Walk around, companion follows

- [x] **3.7 — Companion collection moment**
  - Scope: Brief celebration when found (freeze, banner, jingle)
  - Acceptance: Finding companion feels special
  - Verification: Trigger collection, verify moment plays

- [x] **3.8 — Companion passive bonuses**
  - Scope: Apply bonus when collected (health, speed, jump, etc.)
  - Acceptance: Bonuses active and visible in state
  - Verification: Collect Teddy → max health increases

### Deliverables
- [x] All 4 enemy types functional
- [x] Tokens collectible
- [x] Companions follow and grant bonuses

### Pause Point 3A
**Review:** Play a level with enemies, tokens, and a companion. Fun?

---

## Phase 4: Game Loop

**Goal:** Health, damage, death, checkpoints, save/load all work.

### Tasks

- [x] **4.1 — Health system**
  - Scope: 3 hearts, damage reduces, heal adds, max from companions
  - Acceptance: Can take damage and heal
  - Verification: Get hit, heal, check hearts

- [x] **4.2 — Hearts UI**
  - Scope: Display hearts, animate on change (pop on heal, wobble on hit)
  - Acceptance: Hearts visible and reactive
  - Verification: Visual check
  - Note (Codex): Animate for feedback

- [x] **4.3 — Invincibility frames**
  - Scope: 1.5s invincibility after damage, blink effect
  - Acceptance: Can't be damaged while blinking
  - Verification: Get hit twice quickly — second should miss

- [x] **4.4 — Death and respawn**
  - Scope: 0 hearts = respawn at checkpoint with full health
  - Acceptance: Dying respawns correctly
  - Verification: Die intentionally
  - Note: Added spin+shrink death animation (800ms)

- [x] **4.5 — Checkpoint system**
  - Scope: Auto-save at area transitions and mid-area markers
  - Acceptance: Respawn at last checkpoint
  - Verification: Pass checkpoint, die, verify respawn location

- [x] **4.6 — Save/load (localStorage)**
  - Scope: Persist checkpoint, companions collected, tokens
  - Acceptance: Refresh browser → resume from checkpoint
  - Verification: Play, refresh, verify state restored
  - Note (Codex): Handle localStorage disabled gracefully

### Deliverables
- [x] Full death/respawn loop working
- [x] Progress saves and loads

### Pause Point 4A
**Review:** Core game loop complete. Play through test content end-to-end.

---

## Phase 5: HD-2D Polish

**Goal:** Elevate visual quality with shaders, effects, and camera polish.

### HD-2D Requirements (Review)
| Element | Minimum for V1 | Performance Budget |
|---------|----------------|-------------------|
| Depth-of-field | Single-pass blur on BG layer | < 2ms GPU time |
| Particles | CPU-based, max 20 active | < 1ms per frame |
| Sub-pixel movement | Phaser default | No additional cost |
| **Fallback mode** | Disable shader if < 30fps | Auto-detect on startup |

### Tasks

- [x] **5.1 — Depth-of-field shader**
  - Scope: Tilt-shift blur on background layer; intensity based on player Y
  - Acceptance: Blur radius 2-4px on BG, 0 on player/platforms; GPU time < 2ms
  - Verification: Chrome DevTools GPU profiling; visual check
  - Note (Gemini): "Macro photography" vibe
  - Resource: Phaser 3.60+ has built-in `camera.postFX.addTiltShift(0.9, 2.0, 0.4)` — no custom shader needed

- [x] **5.1b — Performance fallback mode**
  - Scope: Detect < 30fps on startup; disable shader; show "lite mode" indicator
  - Acceptance: Game runs at 60fps on 2018 iPad; graceful degradation on older devices
  - Verification: Test on low-end device or throttled CPU
  - Note (Review): Required for mobile reach

- [x] **5.2 — Landing particles**
  - Scope: Dust puff on landing (6 particles, soft gray, 0.4s)
  - Acceptance: Particles visible on land
  - Verification: Visual check

- [x] **5.3 — Screen shake**
  - Scope: Shake on enemy bounce (intensity 2.0, 0.15s)
  - Acceptance: Screen shakes when stomping enemies
  - Verification: Stomp enemy

- [ ] **5.4 — Enhanced animations**
  - Scope: Smooth animation blending, sub-pixel positioning
  - Acceptance: Movement feels fluid, not choppy
  - Verification: Feel test
  - Note: Current animations working well; may be minimal changes needed

- [x] **5.5 — Audio integration**
  - Scope: Jump, land, bounce, collect sounds + music
  - Acceptance: Sounds play at correct moments; audio unlocks on first tap/click
  - Verification: Test with sound; verify unlock works on iOS Safari
  - Note (Codex): Handle web audio unlock on first interaction

- [x] **5.6 — Cutscene/overlay system**
  - Scope: Reusable system for intro, companion moments, and ending; supports image + text + skip
  - Acceptance: Can display sequence of screens with fade transitions; skip button works
  - Verification: Create test cutscene with 3 screens
  - Note (Review): Required foundation for companion moments (Phase 3.7) and story sequences (Phase 7)

### Deliverables
- [x] Game looks and sounds polished (shader, particles, audio, screen shake)
- [x] Cutscene system ready for content

### Pause Point 5A
**Review:** Visual quality check. Shader GPU time < 2ms? Fallback mode working?

---

## Phase 6: Bedroom Area (First Milestone)

**Goal:** Complete first area as proof of full loop.

### Tasks

- [x] **6.1 — Bedroom level design (JSON)** *(4 levels)*
  - Scope: AI-generate level data for bedroom area
  - Acceptance: 8-12 platforms, 3-5 enemies, 5 tokens, 1 companion; all reachable
  - Verification: Schema validation passes; manual walkthrough confirms all tokens reachable

- [WIP] **6.2 — Bedroom background integration**
  - Scope: Use existing bedroom background assets
  - Acceptance: Platforms align with visual landmarks (books, toys); no floating platforms
  - Verification: Screenshot comparison of collision boxes vs background
  - Note: Art-floor anchor in `backgrounds.ts`; verify all 4 bedroom BGs

- [x] **6.3 — Teddy Bear companion placement**
  - Scope: Place and configure Teddy collection moment
  - Acceptance: Teddy visible, collectible, triggers cutscene system
  - Verification: Collect Teddy; verify +1 heart bonus applied

- [WIP] **6.4 — Bedroom → Hallway transition**
  - Scope: Door/exit that leads to hallway area (stub)
  - Acceptance: Transition triggers; hitch < 16ms; next area preloaded
  - Verification: DevTools performance check during transition

- [ ] **6.5 — Bedroom playtest and iteration**
  - Scope: Play, find issues, fix
  - Acceptance: Completable in 2-4 minutes; no soft-locks; no unfair deaths
  - Verification: 3 full playthroughs without getting stuck

### Deliverables
- [ ] Bedroom area complete and playable
- [ ] All 5 tokens collectible
- [ ] Teddy companion collected and following

### Pause Point 6A
**Review:** MILESTONE — First area playable. Target: complete in 2-4 min, no deaths from bad design.

---

## Phase 7: Full Journey + Boss

**Goal:** Complete all 6 areas and T-Rex boss fight.

### Tasks

- [x] **7.1 — Remaining 5 areas (Hallway → Dollhouse)** — *5/5 done (Hallway 2026-06-02, Kitchen + Family Room 2026-06-03, Backyard + Playhouse boss 2026-06-04)*
  - Scope: Level design, backgrounds, companions for each area
  - Acceptance: Each area: 8-12 platforms, 3-5 enemies, 5 tokens, 1 companion; 2-4 min completion
  - Verification: Full playthrough with timer; all 25 tokens collectible; all 5 companions found
  - [x] **Hallway** — 5 slots × A/B/C sketch-authored, double-jump gate (mandatory at slots 4–5, proven by reachability lint), spiders (stomp-patroller), Dog→dash on the final approach. Spec/plan in `docs/superpowers/`.
  - [x] **Kitchen** — 5 slots × A/B/C sketch-authored, TWO gates (wall-climb ascent + dash sink/stove, combo finale), proven by `kitchen.integration.test.ts`. Ant (stomp-patroller), Cat→wall-climb met early (`metAtStart`). New sketch elements: `requires:"dash"` + `climbWalls` + elevatable exit. Spec/plan in `docs/superpowers/`.
  - [x] **Family Room** — 5 slots × A/B/C sketch-authored, **enemy-forward / climb-light**: a single load-bearing finale climb (slot 5's couch-back) that also gates the Horse pickup, proven by `familyRoom.integration.test.ts` (incl. slots 1–4 solvable *without* climb — the climb-light invariant). Introduces the **DustMite** stomp-patroller + the **carryover system** (per-zone `enemyType` override) bringing back dust bunnies/spiders/ants. Earns **Horse → charge**. Spec/plan in `docs/superpowers/`.
  - [x] **Backyard** (World 5; re-themed from "Living Room") — 5 slots × A/B/C sketch-authored, **only outdoor area / pre-boss graduation**. **Dual gate:** **charge** (carried from Horse) smashes hedge/fence `breakable` barricades (load-bearing slots 4 & 5), and **glide** becomes load-bearing **in-level for the first time** (kiddie-pool gap slot 3 + treehouse finale slot 5). **Flamingo met at a high windowsill** (`metAtStart`, 2nd use after Cat) → earn glide → drop into the yard (elevatable spawn). All four enemies recap via the carryover system. Proven by `backyard.integration.test.ts`. Two new authoring mirrors only: `breakable` sketch vocab + elevatable spawn. Spec/plan in `docs/superpowers/`.
  - [x] Dollhouse → **Playhouse** (boss — token-ammo throw/dodge fight; `BossScene` + pure `bossFight` state machine; 3 hits in the recovery window tame the T-Rex → game complete; 2026-06-04. See 7.3.)

- [ ] **7.2 — T-Rex boss sprite** — *PARTIAL (2026-06-04): the fight ships with the 3 on-disk states (`idle`/`roar`/`walk`); the **dizzy** (recovery) and **tamed** (win) states are effect-stubbed (stars-wobble / tint+hearts). Remaining: generate a real "tamed" (and optional "dizzy") sprite in the storybook style — a focused art follow-up, NOT a blocker for the fight.*
  - Scope: Generate boss spritesheet (idle, stomp, swipe, tired, tamed)
  - Acceptance: 5 animation states, consistent style with other sprites
  - Verification: Visual check against style bible

- [x] **7.3 — Boss arena and fight** — *2026-06-04. `BossScene` + pure `bossFight` state machine (telegraph→attack→recovery→…). Two attacks (stomp shockwave / charge), telegraph ≥1.2s + recovery ≥2.0s floors, mild per-hit escalation. Eloise throws her lifetime-collected tokens (auto-aimed on X) — hits only count in the recovery window; 3 → tamed → `worldComplete`. Strictly-finite ammo with a companion bailout at zero; 0-hearts resets the fight (never leaves to a level). Glide is the entry gate only. Pure machine unit-tested (13 cases); arena runtime-smoked.*
  - Scope: Stomp/swipe/pause pattern, 3 hits to win
  - Acceptance: Telegraph > 1s before attack; safe window > 2s; beatable in 2-3 attempts
  - Verification: Beat boss 3 times; time the windows

- [x] **7.3.5 — Scripted cutscene system (power intros + intro/ending engine)** — *requested 2026-06-03; engine + all 5 power intros BUILT 2026-06-07. Pure `cutscene.ts` timeline controller + thin `CutsceneScene` (additive card, looping demo tweens, hybrid auto-play + tap-ahead + skip) + data-driven `powerIntroScript`. Replaces the PowerUnlockScene modal. Intro 7.4 / ending 7.5 reuse the engine via the page/clear/fade seam. Spec/plan in `docs/superpowers/`.*
  - Scope: A reusable scripted-sequence engine — companion entrance, mechanic demo, camera beat, dialogue/prompt, skippable. Introduces **each** power when its companion is met (Teddy→double-jump, Dog→dash, Cat→wall-climb, Horse→charge, Flamingo→glide), and is the same "cutscene system" 7.4/7.5 reference.
  - Context: Kitchen (World 3) ships the lightweight **interim** — reuse `PowerUnlockScene` + an in-level "Press ↑ to climb!" prompt (`docs/superpowers/specs/2026-06-03-kitchen-area-design.md` §7). This task replaces that interim with real per-power cutscenes.
  - Acceptance: each power has a short (<10s), skippable intro cutscene; the same engine renders 7.4 intro + 7.5 ending.
  - Verification: trigger each power-intro cutscene; confirm skippable + camera/demo beat.
  - Tracking note: no GitHub remote on this repo — tracked here; convert to a GitHub issue if a remote is added.

- [ ] **7.4 — Intro sequence**
  - Scope: 3-5 screens using cutscene system
  - Acceptance: Establishes shrinking premise; skippable; < 30s if not skipped
  - Verification: Time the intro; test skip button

- [ ] **7.5 — Ending sequence**
  - Scope: T-Rex befriended, return to normal, companions remembered
  - Acceptance: Uses cutscene system; shows all collected companions; < 45s
  - Verification: Time the ending; verify companion images appear

- [ ] **7.6 — Full playtest and polish**
  - Scope: Complete playthrough, fix issues, tune difficulty
  - Acceptance: Total playtime 15-25 min; < 10 deaths for first-time player; no soft-locks
  - Verification: Fresh playtest by someone who hasn't seen the game

### Deliverables
- [ ] Complete game playable start to finish
- [ ] Total playtime: 15-25 minutes
- [ ] All 30 tokens, 5 companions, 1 boss

### Final Milestone
**V1 COMPLETE** — Ship to itch.io

---

## Touch Controls (Parallel Track)

Can be developed alongside other phases after Phase 1.

- [ ] **T.1 — Virtual joystick**
  - Scope: Left side, floating or fixed option
  - Acceptance: Can move with touch
  - Resource: `src/lib/joy.js` (bobboteck/JoyStick) — downloaded and ready

- [ ] **T.2 — Jump button**
  - Scope: Right side, responsive to tap
  - Acceptance: Can jump with touch

- [ ] **T.3 — Auto-detect input**
  - Scope: Show touch controls only when touch detected, hide on keyboard
  - Acceptance: No configuration needed
  - Note (Gemini): "Magic" input detection

- [ ] **T.4 — Prevent browser gestures**
  - Scope: Disable scroll, back swipe, etc. during gameplay
  - Acceptance: Touches only control game
  - Note (Codex): Critical for iOS Safari

---

## Art Revision (Parallel Track)

> **Note:** Original sprites were designed for retro/pixel-art constraints (GameBoy/SNES style). Web platform allows higher resolution and more detail. Consider revising before Phase 6 content work.

- [ ] **A.1 — Define new sprite resolution**
  - Current: 320×544 per frame (6-frame strips)
  - Consider: Higher detail, smoother lines, richer shading
  - Decision needed: Keep pixel-art style at higher res, or shift to painted/vector look?

- [ ] **A.2 — Regenerate Eloise spritesheet**
  - Must maintain: pink dress, crown, joyful personality
  - Reference: `docs/STYLE_BIBLE.md`

- [ ] **A.3 — Regenerate companion sprites** (5 total)
- [ ] **A.4 — Regenerate enemy sprites** (4 types)
- [ ] **A.5 — Update STYLE_BIBLE.md** with new art direction

---

## Out of Scope (V1)

Explicit list to prevent scope creep:

| Feature | Reason |
|---------|--------|
| Assist Mode | Tune base difficulty; add presets in V1.5 |
| World Select Screen | Journey is linear now |
| Multiple save slots | Single playthrough focus |
| Normal maps / dynamic lighting | HD-2D scope reduced to shaders only |
| Companion scrapbook/gallery | Nice-to-have, not core |
| Level validation bot | Manual playtesting sufficient for 6 areas |
| Achievement system | V2 feature |
| Procedural clutter | Nice-to-have |
| Social sharing/snapshots | V2 feature |

---

## Risks & Watch Items

| Risk | Mitigation | Phase |
|------|------------|-------|
| Jump feel doesn't match Godot | Fixed timestep + exact constants + iteration time | 1 |
| AI-generated levels unplayable | Manual review and edit of each level | 6, 7 |
| Touch controls feel bad | Test early on real devices | T track |
| localStorage unavailable | Graceful fallback, clear error message | 4 |
| Large asset size, slow load | Lazy load per area, texture atlases | 0, 2 |
| HD-2D shaders hurt performance | Test on low-end devices, provide "lite" fallback | 5 |

---

## Review Feedback Incorporated

### From Gemini Review:
- [x] Texture atlases instead of individual PNGs (Phase 0)
- [x] Look-ahead camera (Phase 2)
- [x] Depth-of-field shader (Phase 5)
- [x] Auto-detect input method (Touch Track)
- [x] State management outside Phaser scenes (Phase 0)
- [ ] ~~Normal maps~~ — Descoped, using shaders only
- [ ] ~~Generative clutter~~ — Descoped

### From Codex Review:
- [x] Fixed timestep for consistent physics (Phase 0)
- [x] Level JSON validation with Zod (Phase 2)
- [x] Hearts animation (Phase 4)
- [x] Web audio unlock handling (Phase 5)
- [x] localStorage fallback (Phase 4)
- [x] Browser gesture prevention (Touch Track)
- [ ] ~~Assist mode~~ — Deferred to V1.5
- [ ] ~~Level validation bot~~ — Manual testing sufficient

---

*Roadmap version 2.0 — Web Migration*
*Last updated: 2026-01-24*
