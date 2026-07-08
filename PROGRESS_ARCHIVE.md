# Progress Archive — Princess Eloise's Big Adventure

## Session: 2026-06-04 (Phase 7.1 — Backyard / World 5; BUILT — 4/5 areas)

**Goal met:** The **Backyard** (World 5) is fully built — 5 levels at Bedroom/Hallway/Kitchen/Family-Room parity, authored through the sketch→encode pipeline, as the **only outdoor area** and the **pre-boss graduation**. Executed **subagent-driven** (per-task implementer + spec/quality review, controller-verified on disk after every commit) from the committed plan `docs/superpowers/plans/2026-06-03-backyard-area.md` (7 tasks: P0 infra → P1 content → P2 pipeline → P3 proof). Spec: `docs/superpowers/specs/2026-06-03-backyard-area-design.md`.

### Completed (commits c2c70d1 → fb3a966, on main)
- **`breakable` sketch vocab + elevatable spawn** (`c2c70d1`, TDD): the missing sketch→combined→encoder authoring path for `breakable` barricades (an exact mirror of `climbWalls`) + a one-line elevatable spawn (`spawn.y` honored, mirror of the elevatable exit). `BreakableSchema`/`LevelData.breakables` already existed + scaled; `types/level.ts` untouched. Every existing area encodes byte-identical (the `?? []` / `- 0` paths).
- **Living Room → Backyard rename** (`7760847`): `livingRoom`→`backyard` AreaId at the **same index 4** (order-based gating chain identical — `gatingPower("backyard")`=charge); Flamingo `area:"backyard"` + **`metAtStart:true`** (→ `abilitiesForArea("backyard")` gains glide); registered the `flamingo` texture in `ENTITY_TEXTURE_KEYS` (was loaded by BootScene but unmapped); `LIVING_ROOM_AREA`→`BACKYARD_AREA` (primary `ant`, carryover spider/dust_bunny/dust_mite); Dollhouse copy re-themed → outdoor **Playhouse** (name/intent only). Grep-clean of all `livingRoom`/`Living Room` refs.
- **15 variants authored** (`ab0b9cf`): 5 slots × A/B/C, B→A→A→C, **descent→sprawl, dual gate**. Convergence-tuned against the reachability lint — caught that the slot-5 seed glide chasm (gap 6/192px) was *not* load-bearing (double-jump clears 192px) and **widened both glide chasms to 8 grids/256px**. Forgiveness curve held (window drop + slot-3 pool non-lethal via a soft catch ledge; first lethal pit slot 4). Carryover graduates one returning foe per slot (spider@2, dust_bunny@3, dust_mite@4, all-four@5). Two minor doc-string inaccuracies (slot-2 "walk around"→"hop over"; slot-3 gap number) fixed in the amend.
- **Pipeline switch** (`7cbbc46`): `backyardLevels.ts` sketch-driven (mirror of `familyRoomLevels.ts`); `BACKYARD_ENTRIES` concatenated into `LEVEL_CATALOG` (20→**25**). Wiring it in makes the build-time reachability lint auto-cover the 5 Backyard levels.
- **Auto-proof** (`fb3a966`): `backyard.integration.test.ts` pins solvable-WITH the full loadout; **not-without charge @ slots 4 & 5**; **not-without glide @ slots 3 & 5**; Flamingo reachable @ slot 1; carryover yields >1 enemy type incl ant; loadout is exactly `{doubleJump,dash,wallClimb,charge,glide}`.

### Verification
`npm run build` green: **294 tests** (256 at session start → +38), tsc clean, reachability lint over all **25** catalog levels (incl. the 5 Backyard), texture smoke green, vite ok. Controller independently re-ran the solvable-with/not-without reachability checks via an ephemeral test (now removed) before trusting the content implementer. **Runtime smoke** (dev preview): backyard-1 spawns Eloise *high* on the windowsill with Flamingo (elevatable spawn ✓); backyard-5 renders the charge-tinted hedge `breakable` (scaled 128×448) + all four enemy types (ant×4/spider×3/dustbunny×2/dustmite×2) + treehouse/landing; backyard-3 renders the pool + a returning dust bunny; HUD shows 25 levels; **no console errors**.

### Carried-forward (minor, non-blocking)
- **Manual playtest pending** — Phaser ignores synthetic input, so *feel* is a human handoff: the window glide-in, the slot-3 pool-gap timing + the catch-ledge retry, the slot-4 fence smash + pit fairness, the slot-5 combo finale, and the carryover-density pacing. Mechanical correctness is lint+test-proven; rendering is screenshot-confirmed.
- **HUD companion label** — the HUD's `· Teddy` is a hardcoded *double-jump* indicator (`hasAbility("doubleJump")`), not the area companion, so it reads "Teddy" in the Backyard too. Pre-existing/inherited, out of scope; fold into the 7.3.5 HUD/cutscene pass if it bugs you.
- **Glide-in prompt** — the "Hold to glide!" sill prompt was not separately verified rendering (PowerUnlockScene fires on Flamingo pickup as for Dog/Cat/Horse); confirm during the manual playtest. Full scripted cutscene → ROADMAP 7.3.5.

### Next Session Should
1. **Manual-playtest the Backyard** (the one thing automation can't do): menu → Continue, or console `eloiseState.levelIndex = 20` (then start GameScene) for levels 21–25. Confirm the window glide-in, the pool catch-ledge retry, the fence smash, the combo finale, and carryover pacing.
2. **Phase 7.1 finale — Dollhouse boss (World 6 / Playhouse)** (ROADMAP 7.2/7.3): T-Rex boss sprite + arena + fight. Its own spec → plan → build cycle. Glide is its entry gate (already wired). This is the **last area** — completes the 6-world arc.
3. Then the cross-cutting passes: scripted cutscene system (7.3.5), intro (7.4), ending (7.5), full playtest + polish (7.6).

---

## Session: 2026-06-03 (Phase 7.1 — Backyard / World 5; DESIGN + PLAN ONLY, not built)

**Outcome:** Re-scoped World 5 from "Living Room" to an **outdoor Backyard** and produced a committed spec + implementation plan. **No source code changed — design/planning only**; execution paused at the user's request.

### Why the re-theme
"Living Room" and the "Family Room" (World 4, just shipped) are the *same room* to a 4–8 year old, and 5 of 6 areas were interior. The Backyard is the **only outdoor area** (max visual contrast before the Dollhouse finale), and the existing companion/power assignment was already pointing there: a **lawn flamingo** is the iconic backyard object, and **glide** reads far better over open sky. The re-theme is cheap — gating is order-based (rename can't break the charge gate), backgrounds are dormant (no World-5 art to discard), and Flamingo's sprites already exist.

### Design decisions (spec `docs/superpowers/specs/2026-06-03-backyard-area-design.md`, committed `a4f36b5`)
- **Signature beat:** meet **Flamingo at a high windowsill** (`metAtStart`, 2nd use after Cat) → earn **glide** → *sail out the window down into the yard* (a diegetic interior→exterior transition).
- **Shape:** descent → sprawl, **dual gate** — **charge** (carried from Horse) is the headline hard gate (smash hedges/fence panels; load-bearing slots 4 & 5); **glide** becomes load-bearing **in-level for the first time** (kiddie-pool gap slot 3 + treehouse finale slot 5). Combo finale = charge through the last hedge, then glide to the playhouse.
- **Enemies:** primary **ant** + all-four recap via the already-shipped carryover system.
- **Connectivity:** Dollhouse re-themed to an **outdoor playhouse** so Worlds 5→6 flow outdoors.
- **Forgiveness preserved:** the window drop and the slot-3 pool are *non-lethal* (a pool miss splashes to a safe ledge); a glide gap is a *reachability* gate, not a kill plane, so glide is load-bearing AND "first lethal pit = slot 4" holds.

### Build scope (plan `docs/superpowers/plans/2026-06-03-backyard-area.md`, committed `aa2c582`)
7 tasks, P0→P3, TDD + subagent-driven. The **only new engine work** is two small authoring mirrors: `breakable` in the sketch vocab (climbWalls-style passthrough) + **elevatable spawn** (the encoder currently drops `spawn.y` — a one-line `exit.y` mirror for the high windowsill). Everything load-bearing already ships: GameScene builds+smashes breakables, `checkReachability` reads `level.breakables` + derives `chargeActive`, glide is modeled (`Math.max(arcFallTime, glideFallTime)`), carryover + all four enemy branches + `metAtStart` exist. Charge gate seeded deterministically from `chargeDemoLevel`; glide gaps tuned against the Task 6 proof.

### Verification
None run beyond session-start baseline (256 tests green, tsc clean) — no source changed. Spec self-review + plan self-review (spec coverage / placeholder / type consistency) both passed inline.

### Next Session Should
1. **Execute the Backyard plan** (`docs/superpowers/plans/2026-06-03-backyard-area.md`) — start at **Task 1** (breakable sketch vocab + elevatable spawn, TDD). Subagent-driven recommended; verify HEAD on disk after each task (subagent phantom-SHA caution).
2. After build: mark ROADMAP 7.1 Backyard `[x]` (4/5 areas), update `CLAUDE.md` Current Status, manual-playtest the window glide-in / pool gap / fence smash / combo finale.
3. Remaining after Backyard: **Dollhouse boss** (7.2/7.3) — its own spec. (The "Living Room" slot is retired — folded into the Backyard.)

---

## Session: 2026-06-03 (Phase 7.1 — Family Room / World 4; carryover system + 3rd area)

**Goal met:** The **Family Room** (World 4) is fully built — 5 levels at Bedroom/Hallway/Kitchen parity, authored through the sketch→encode pipeline, as an **enemy-forward, climb-light** area. The player arrives with the full toolkit (double-jump + dash + wall-climb); wall-climb is the **sole** gate, used **once** — slot 5's couch-back climb, which also gates the **Horse** pickup. First area to **mix enemy types in one level** via a new per-zone carryover override. Executed **subagent-driven** from `docs/superpowers/plans/2026-06-03-family-room-area.md` (8 tasks: P0 infra → P1 content → P2 pipeline → P3 proof). Spec: `docs/superpowers/specs/2026-06-03-family-room-area-design.md`.

### Completed (commits 6aa6e3a → 9b010a7, on main)
- **DustMite entity** (`6aa6e3a`): a single-texture stomp-patroller, sibling of Ant (art already on disk). Registered `dustMite` + `horse` in `ENTITY_TEXTURE_KEYS` (the `DUSTMITE` constant + BootScene load already existed — only the map entries were missing).
- **GameScene `dustMite` branch** (`f42c10a`): fills the warn-`else` hole the Kitchen left; all four stomp-patroller branches now live, so carryover levels render every type.
- **Carryover system** (`e3a927e`): a per-zone `enemyType?` override on the sketch enemy zone → `ENEMY_RUNTIME_TYPE[z.enemyType ?? primaryEnemy]` (backward-compatible fallback) + a `trex` guard, preserved through `combineSlot`. The deferred-twice (Hallway/Kitchen) carryover, finally built — front-loads the Living Room's "recap all four" infra. Bedroom/Hallway/Kitchen encode byte-identically (no `enemyType` anywhere in them).
- **Content** (`f786733`): 15 variants (5 slots × A/B/C), B→A→A→C. Single load-bearing finale climb (slot 5), carryover variety ramping dust mite → +dust bunny → +spider/ant, forgiveness curve intact (first lethal pit slot 4, double-jump-clearable). Horse at the couch base, unavoidable on the way to the only climb.
- **Pipeline + proof** (`77a7ead`, `9b010a7`): `familyRoomLevels.ts` sketch-driven + catalog wiring (catalog now 20). `familyRoom.integration.test.ts` pins all 5 solvable with the full loadout, slot 5 not-without-climb, **slots 1–4 solvable without climb** (the climb-light invariant — added per the final review), Horse reachable, carryover yields mixed types.

### Verification
`npm run build` green: **256 tests** (216 at session start → +40), tsc clean, reachability lint over all 20 catalog levels, vite ok. Subagent-driven: per-task implementer + (for the substantive tasks) two-stage spec→quality review; final holistic Opus review = **Ship it**. **Runtime smoke** (dev preview): family-room-3 renders dust mite + carryover spider; family-room-5 finale renders Horse + the climb-only couch-back + exit shelf + `Press ↑ to climb!` prompt; `DustMite`×6 + `Spider`×2 instantiate; no console errors.

### Carried-forward (minor, non-blocking)
- **Manual playtest pending** — Phaser ignores synthetic input, so *feel* is a human handoff: dust-mite hitboxes, the finale climb, slot-4 pit fairness, the carryover-density pacing. Mechanical correctness is lint+test-proven; rendering is screenshot-confirmed.
- **Climb prompt repeats** — the Kitchen's per-first-climbWall `Press ↑ to climb!` fires at the Family Room finale too (inherited behavior, not author-able away yet). Fold into the 7.3.5 cutscene work.
- Slot 3's optional `requires:"dash"` bonus pocket framing + slot 4's pit fairness (5% margin) — flagged by the content implementer for the feel pass.

### Next Session Should
1. **Manual playtest the Family Room** (the one thing automation can't do): menu → Continue, or set `levelIndex` 15–19 (console; `eloiseState.levelIndex = 19` then start GameScene). Confirm the carryover variety, the finale climb, and slot-4 pit fairness.
2. **Phase 7.1 continues — Living Room (World 5)**, gated on **charge** (Horse), companion **Flamingo → glide**, primary enemy **recap all four** (reuse the carryover system shipped this session). Needs **`breakable` added to the sketch vocab** (same passthrough pattern as climbWalls/enemyType). Its own spec → plan → build cycle.
3. Then Dollhouse boss (7.2/7.3).

---

## Session: 2026-06-03 (Phase 7.1 — Kitchen / World 3; first TWO-gate area + gating-model evolution)

**Goal met:** The **Kitchen** (World 3) is fully built — 5 levels at Bedroom/Hallway parity, authored through the sketch→encode pipeline, as a **vertical journey** (floor → climb counters → dash over the stove). First area with **two** load-bearing gates — **wall-climb** for the ascent, **dash** for the sink/stove leaps — and a slot-5 **combo finale** needing both. Executed **subagent-driven** from `docs/superpowers/plans/2026-06-03-kitchen-area.md` (12 tasks: P0 infra → P1 content → P2 switch → P3 proof). Spec: `docs/superpowers/specs/2026-06-03-kitchen-area-design.md`.

### Shipped (commits 7ce5792 → 48c2ad9, on main)
- **Gating-model evolution (`metAtStart`)** (`26eed1c`): `CompanionDef.metAtStart` opt-in; Cat is **met early** so wall-climb is in the Kitchen's OWN ability set (`abilitiesForArea("kitchen") = {doubleJump, dash, wallClimb}`). Contained — Bedroom/Hallway and the `gatingPower` chain untouched; future areas can opt in. The more standard "meet friend → learn power → use it now" feel; lets *climbing* (not double-jump) be the verb for getting onto a counter.
- **Ant enemy** (`7ce5792`, `e680733`): a stomp-patroller sibling of `Spider`/`DustBunny` (single `ANT` texture, no pose-swap). GameScene gains an `ant` branch **and a loud `else` guard** — pays down the Hallway-flagged silent-skip debt for unhandled enemy types.
- **Two new sketch-vocab elements** (`3fba141` requires:"dash", `876f00c` climbWalls) + **elevatable exit** (`8113ef1`): both traversal edges already existed in the engine; this added the *authoring* reach (sketch → encoder passthrough). The encoder now honors `combined.exit.y` so an exit can sit on a climbed-to counter (backward-compatible — existing y:0 sketches unchanged).
- **Content** (`0d50ed4`, polish `eb2faca`): 15 variants (5 slots × A/B/C), B→A→A→C. Climb-only counters (sketch y≥6, above the ~161px double-jump apex) gate slots 1–3's elevated exits (over a pit so the floor doesn't satisfy the exit); counter-to-counter dash over the **sink** (slot 4) and **stove** + climb-to-shelf (slot 5 combo). Forgiveness curve holds (first lethal = slot 4 sink). Cat unavoidable in slot 1 (climb-only exit enforces the pickup). Victory-coda tokens + an over-stove breadcrumb on the finale.
- **Pipeline + proof** (`bb4f6dd`, `4ecae0f`): `kitchenLevels.ts` sketch-driven + catalog wiring (5 levels live; catalog now 15). `kitchen.integration.test.ts` pins the two-gate guarantee — kitchen-1/2/3 NOT solvable without wall-climb, 4/5 NOT without dash, 5 needs BOTH, Cat reachable.
- **Climb prompt** (`48c2ad9`): `Press ↑ to climb!` at the first climb wall — interim mechanic intro; full **scripted cutscene system → ROADMAP 7.3.5** (filed this session; no git remote, so tracked in ROADMAP, convert to an issue when a remote exists).

### Verification
`npm run build` green: **216 tests** (176 at session start → 184 after P0 infra → 216; the +32 from P0 = the 11 integration cases + the catalog-iterating suites now exercising 5 new levels), tsc clean, reachability lint over all 15 catalog levels, vite ok. **Independent controller re-check** of the gate bite-table confirms every gate load-bearing with **0 FULL-loadout warnings**. **Runtime smoke** (dev preview): kitchen-1 "Crumb Floor" loads from the menu (`lvl 11/15`), Eloise + companion + tokens + counter render at spawn, the green `climbWall` visual + `Press ↑ to climb!` prompt render in the C-segment, **no console errors**. Subagent-driven: per-task implementer + two-stage (spec then quality) review; final holistic review = **Ship it**.

### Carried-forward (minor, non-blocking)
- **Manual playtest pending** — Phaser ignores synthetic input, so *feel* is a human handoff: ant stomp, climbing the counters, the sink/stove dash gaps, the dash→climb combo finale. Mechanical correctness is lint+test-proven; rendering is screenshot-confirmed.
- **Slot 4-C dash gap = 224px** vs double-jump's ~212px — the area's tightest gate (5% margin). Bites correctly, but flagged for the feel pass (may want ~250px to read unambiguously, like the other gaps).
- **Climb prompt repeats per-kitchen-level** (every level has a climbWall) — an ability-based guard would be wrong (the player has wall-climb from kitchen-1 via metAtStart); a true show-once needs persistent state. Fold into the 7.3.5 cutscene work.
- **`breakable` not yet sketch-author-able** — the Living Room (charge gate) will need it added to the sketch vocab, same passthrough pattern as climbWalls.

### Next Session Should
1. **Manual playtest the Kitchen** (the one thing automation can't do): menu → Continue, or set `levelIndex` 10–14 (console). Confirm the climb feel, the dash gaps, and the combo finale; tune slot 4-C's gap if it reads ambiguous.
2. **Phase 7.1 continues — Family Room (World 4)**, gated on **wall-climb** (climbWalls — now author-able, **no new element**), companion **Horse → charge**, primary enemy **dust mite**. Add the GameScene `dustMite` branch (the `else` guard now warns). Its own spec → plan → build cycle.
3. Then Living Room (`breakable` gate — add to the sketch vocab; Flamingo→glide), Dollhouse boss (7.2/7.3).

### Addendum — charge dash-smash (same session, post-Kitchen playtest)
Playtest feedback on the **charge** power: the flush-tap smash (X within 14px of a barricade) felt finicky. Added **dash-smash** (`Player.ts`) — a dash that reaches a breakable plows through it, gated on `unlockedAbilities.has("charge")` so it never bypasses the metroidvania gate (and breakables only exist in charge-gated areas anyway). Flush-tap retained; net feel: **X always gets you through the barricade**. No reachability-lint change — the lint only requires charge to be *present*, not the input method. tsc clean, 216 tests green, sandbox loads clean; user-confirmed feel ("solid"). Charge-only — zero effect on the Kitchen or earlier areas.

---

## Session: 2026-06-02 (Phase 7.1 — Hallway / World 2; first gated area authored)

**Goal met:** The **Hallway** (World 2) is fully built — 5 levels at Bedroom parity, authored through the sketch→encode pipeline, where **double-jump is a provably load-bearing gate** and the player earns **Dog → dash** at the finale. First of the 5 remaining areas (7.1). Executed subagent-driven from `docs/superpowers/plans/2026-06-02-hallway-area.md` (13 tasks, P0 infra → P1 content → P2 switch → P3 runtime verify). Spec: `docs/superpowers/specs/2026-06-02-hallway-area-design.md`.

### Shipped (commits 83f2711 → b571a69, on main)
- **Reusable encoder infra** (every later area reuses it): enemy Zod schema `z.literal("dustBunny")` → `z.enum([dustBunny,spider,ant,dustMite])` (`83f2711`); `encodeFromSketch` now derives enemy type from `area.primaryEnemy` (via `ENEMY_RUNTIME_TYPE` snake→camel map) and companion from `area.companion` instead of hardcoded `dustBunny`/`teddy` (`4958a3d`, hardened `c32d444` — self-enforcing `trex` guard + null-companion test).
- **Spider enemy** (`34ac177`, `c2aeb49`): a stomp-patroller **sibling of `DustBunny`** under the `Enemy` base (spider textures, no new behavior). GameScene widened to `enemies: Enemy[]`, a `spider` instantiation branch, and stomp guard `instanceof DustBunny` → `enemy.isDefeated()`. `SPIDER_ATTACK` descend behavior + carryover dust bunnies deferred (spiders-only v1).
- **Per-area gate proof** (`43c82e9`): `reachability.integration.test.ts` describe #2 refined per-level → **per-area** ("≥1 level in a gated area is unsolvable without its gating power") so the escalation (optional gates in slots 1–3) doesn't break the build.
- **Content** (`08fb952`→`57ed4e5`): `HALLWAY_SLOTS` 5 slots × A/B/C with an **escalating double-jump gate** — optional height/route gates in slots 1–3 (base-jump-completable), first **mandatory** lethal pit at slot 4, climax gap + **Dog on the unavoidable final approach** (x=21, exit x=23) at slot 5. Pit gaps ~160px (between base 121.7 / double 212.4). `hallway.integration.test.ts` pins: all 5 solvable WITH double-jump, slots 4&5 NOT without, Dog reachable.
- **Pipeline switch** (`b571a69`): `hallwayLevels.ts` → `encodeAreaLevels(HALLWAY_AREA, SEGMENT_ORDER)`. Registered spider/dog in `ENTITY_TEXTURE_KEYS` (smoke test caught the gap — a real prerequisite the plan missed).

### Verification
`npm run build` green: **176 tests** (was 147 at session start, +29), tsc clean, reachability lint over the whole catalog, vite build ok. Runtime (dev preview): catalog has 10 levels (menu "lvl 6/10 · Hallway Runway"); hallway-2 built **6 Spider entities** (`sb_spider_idle`, all visible), Eloise + tokens + platforms render, **no console errors**; maps page shows Hallway **5/5 drafted**. Two-stage subagent review on the encoder (spec ✅ + quality approved + 3 polish fixes); final holistic feature review = **Ship it** (no Critical/Important).

### Carried-forward (minor, non-blocking)
- **Hallway interactive playtest pending** — Phaser ignores synthetic input, so stomping a spider, crossing the slot-4/5 gate, and Dog pickup → dash-reveal feel are a human handoff (same pattern as all 5 powers). Mechanical correctness is lint-proven; visual rendering is screenshot-confirmed.
- **GameScene enemy-type silent-skip:** the loop only branches `dustBunny`/`spider`; an unhandled `ant`/`dustMite` would `continue` and vanish. Safe now (Hallway = spiders only) and backstopped by the texture smoke test (build fails for any type missing `ENTITY_TEXTURE_KEYS`). **Add an explicit `else` guard when authoring Kitchen.**
- **Dog walk-animation** is null (non-Teddy companions render static-idle) — acceptable v1.

### Next Session Should
1. **Manual playtest Hallway** (menu → Continue, or load via console). Confirm spider stomp feel, the slot-4/5 double-jump gate, and Dog→dash unlock reveal; tune pit widths / spider hitbox if needed.
2. **Phase 7.1 continues — Kitchen (World 3)**, gated on **dash** (Dog), companion **Cat → wall-climb**, primary enemy **ant**. First area needing a NEW sketch-vocab element (`requires:"dash"` edge — see the power spec). Its own spec → plan → build cycle. Add the GameScene `ant` instantiation branch (+ the silent-skip `else` guard) there.
3. Then Family Room (wall-climb gate / `climbWall`), Living Room (charge gate / `breakable`), Dollhouse boss (7.2/7.3).

---

## Session: 2026-06-02 (Power System P5 — Charge; ALL 5 POWERS COMPLETE)

**Goal met:** Charge — an **instant tap-smash** (tap X grounded + facing a `breakable` barricade → it shatters, walk through) — is built, build-green, and runtime-verified in the dev sandbox. This is the **fifth and final** power: the metroidvania power system is now complete (P0–P5). Executed **inline** (executing-plans) from `docs/superpowers/plans/2026-06-02-charge-power.md` (12 tasks). User-confirmed feel: instant tap-smash (no charge-up / no momentum) — simplest, consistent with dash/climb, no unrecoverable states for ages 4–8.

### Shipped (commits f7c7bb3 → fe4e32c)
- **Charge = instant tap-smash** (`fddda0c`): grounded + a breakable in `chargeReach` (14 design-px) ahead + tap X → destroy that breakable. `ABILITIES.charge` gains `activation:"press"` + `traversal.chargeReach` (`f7c7bb3`). Dispatcher priority 2 (wallClimb 4 > glide 3 > **charge 2** > dash 1) so at a barricade X smashes rather than dashing.
- **`breakable` — the 3rd (last) traversal element kind** (`b070710`): a **solid** rectangle `{x,y,w,h}`, `.optional()` like `climbWalls`. Unlike the non-solid climbWall, breakables are solid bodies (a Player↔breakableGroup collider stops un-charged Eloise).
- **The mirror-image edge** (`665b84e`): `breakableBlocks(from,to,breakables,chargeActive)` — a breakable in the *doorway* (horizontal gap column) between two surfaces **BLOCKS** the edge until charge clears it. The inverse of dash/climb: those *add* an edge (`|| canReach`); charge *removes* one (`&& !breakableBlocks`). **Monotonic** (charge only ever un-blocks) + `breakables` default `[]` → backward solvability preserved by construction. Pinned by the barricaded-gap proof.
- **Pure detection** (`32bd2d4`): `facingBreakable(body, facing, breakables, reach)` → index of the live breakable ahead (or -1). Index-based + null-skipping so a smashed barricade leaves the others' indices stable. Phaser-free like climbDetect.
- **Dispatcher + Player** (`fddda0c`): `PowerContext.facingBreakable` (required); the Player computes it and, on a charge press, nulls the rect + calls the GameScene break callback. **Tasks 5+6 committed together** — a required PowerContext field + the Player that supplies it are one atomic type contract (neither compiles alone), same as P4.
- **GameScene — first runtime geometry MUTATION** (`f1152a0`): `buildLevel` builds each breakable as a SOLID static body + terracotta visual (index-aligned with `data.breakables`); `breakBreakableAt(i)` destroys the tile on charge. Dash/climb were momentary velocity effects; charge permanently removes a body.
- **Auto-proof** (`2e0acde`): `chargeDemoLevel.ts` proven **solvable WITH the Living Room loadout (double-jump+dash+wall-climb+charge) / NOT without charge** — none of jump/dash/climb clear a 200px barricade. Exit sits past the spawn floor's reach so only the far floor (across the smash) satisfies the exit-zone check.
- **Ordering guard** (`4d4c277`): a level with any `breakable` must have charge in its area (spec invariant #2). Green today; load-bearing once the Living Room is authored.
- **Testing Ground Station 5** (`ce5bacd`): drop from the climb ledge → run-up floor → 200px barricade → exit floor; `"charge"` appended to `IMPLEMENTED_POWERS`. All 5 stations now bench all 5 powers.
- **Dev sandbox** (`fe4e32c`): `eloiseLoadDemo("charge")` (grants the Living Room loadout).

### Verification
`npm run build` green: **147 tests** (was 128 at session start, +19), tsc clean, vite build ok. Tree-shake invariant holds: "Testing Ground" = **0** in `dist/`; "Charge Demo" = 1 (ships via the console handle). Runtime (dev preview): `eloiseLoadDemo("charge")` built the demo (GameScene active, `hasCharge` true, `breakables: 1`), the **terracotta barricade** renders tall (unjumpable) between the spawn floor and the far floor's exit, 4 hearts, **no console errors**.

### Process note
Same inline, per-task discipline as P3/P4 (edit → targeted vitest → commit). The per-edit tsc hook fired between paired edits frequently (transient "declared but never read" / missing-field / arg-count mid-edit) — all cleared by the pair's later edit. One real fix mid-build: the reachability "does not block" test used a poorly-chosen far surface whose doorway gap still spanned the barricade (so blocking was *correct*) — fixed the fixture, not the code. The Station 5 geometry (climb-ledge drop → barricade → exit) passed the traversability test first try.

### Carried-forward (minor, non-blocking)
- **Charge manual playtest pending** — Phaser ignores synthetic input, so the smash feel (tap-X registers flush against the barricade; `chargeReach` tuning) is a human handoff. Focused: console `eloiseLoadDemo("charge")`; integrated: menu → "Testing Ground (dev)" → Station 5.
- **Wall-climb animations** — flagged during the 2026-06-02 playtest ("feels good, might need climbing animations eventually"); spawned as a separate task. Charge could likewise want a smash/impact animation eventually (currently just a squash-stretch + the block vanishing).
- **Dev-handle cosmetics (pre-existing, same as dash/glide/climb):** the `eloiseLoadDemo` *console* handle leaves MenuScene/BootScene running (text bleeds through) and the HUD shows a stale catalog level label. The "Testing Ground (dev)" menu path is clean.
- `tick()`'s power block (charge + dash + wall-climb + glide) is now sizeable — a clear candidate to extract into `private applyPowers(...)`.

### Next Session Should
1. **Manual playtest charge** (the one thing automation can't do): menu → "Testing Ground (dev)" → Station 5; face the barricade and tap X to smash. Confirm the smash registers flush + feels good; tune `ABILITIES.charge.traversal.chargeReach` or the `breakableTint` if needed.
2. **The power system is COMPLETE** — next major arcs (own specs): authoring the real gated areas (Hallway → Dollhouse level content), the power-unlock **breakaway reveal screen** wiring at each gate (`PowerUnlockScene` exists), the T-Rex boss, and the **gamepad mapping** session (8BitDo SN30 Pro — brief at `docs/superpowers/research/2026-05-31-gamepad-8bitdo-sn30-pro.md`).
3. Consider extracting `tick()`'s power block into `applyPowers(...)` now that all 5 powers are in.

---

## Session: 2026-05-31 (session close — P3 Dash + P4 Wall-Climb shipped; gamepad groundwork)

Long session: shipped **two full power phases** end-to-end (plan → TDD inline build → auto-proof → Testing Ground station → runtime-verify), a post-playtest control fix, and pre-research for an incoming controller. Detailed per-phase write-ups are the two **P3 / P4 entries below** — this is the close summary.

### Completed
- **P3 — Dash** (10 tasks, `9ce91e8`→`0bd4567`): horizontal `requires:"dash"` platform edge, gravity-suspended lunge, the dispatcher's first `"press"` power. Birthed the traversal-tag machinery (the `requires` field, conditional `canReach` edge, ordering guard).
- **P4 — Wall-Climb** (12 tasks, `a52ee6f`→`2df0a7c`): vertical `climbWall` zone edge, hold-to-climb ladder, the **first GameScene-touching power** (runtime wall zones + `isOnClimbWall`). `.optional()` (not `.default([])`) chosen for `climbWalls`.
- **Wall-climb control fix** (`6cfa582`): moved climb **X → Up/W** after playtest — X's dash fallback (a lunge) flung the player off the wall in an unrecoverable loop. Logged as a deliberate spec §6.1 exception to "one power button."
- **Gamepad groundwork:** 8BitDo SN30 Pro arriving ~early June 2026; research brief generated (`docs/superpowers/research/2026-05-31-gamepad-8bitdo-sn30-pro.md`) + project-memory note. Button mapping is its own future session.
- Committed the P3/P4 plan docs (were untracked).

### Verification
Build green throughout; **tests 91 → 128** (+37), tsc clean, production tree-shake invariant intact (Testing Ground absent from `dist/`).

### Issues Encountered
- Per-edit tsc hook fires between paired edits (transient "declared but never read" / arg-count) — always clears on the pair's later edit; impl-before-test ordering keeps it quiet. Not a real problem.
- No `decisions.md` exists — the build-time choices this session (`.optional()` climbWalls, climb-on-Up) live in these PROGRESS entries; consider `/office-hours` if a formal decisions log is wanted before P5.

### Next Session Should
1. **Manual playtest wall-climb on Up/W** (Phaser ignores synthetic input): menu → "Testing Ground (dev)" → at the climb wall hold Up/W. Confirm climb + the mantle-onto-ledge feel; tune `climbSpeed` / wall geometry if fiddly.
2. **P5 — Charge** (the last power; gates Living Room): a `breakable` *barrier* that blocks an edge **until** charge removes it — inverts the dash/climb "enable an edge" pattern into "clear a blocker." Write its plan first; final task adds a charge station + "charge" to `IMPLEMENTED_POWERS`. Completes all 5 powers.
3. **Gamepad mapping session** — read the brief + project memory; pair the SN30 Pro in X-input mode and map move / jump / power-button / Up-climb / pause. Verify button indices on the physical pad (map by position, not printed letter).

---

## Session: 2026-05-31 (Power System P4 — Wall-Climb, first scene-touching power)

**Goal met:** Wall-Climb — a hold-Up ladder ascent up a `climbWall` zone — is built, build-green, and runtime-verified in the dev sandbox. (Climb input was refined from X → **Up/W** after playtest — see the control note below.) It reuses the P3 dash spine (conditional reachability edge + power-button dispatcher) **rotated 90°** (vertical edge instead of horizontal), and is the **first power whose mechanic is context-sensitive**, so it's the first to touch `GameScene` (build the wall zones at runtime, hand them to the Player). Executed **inline** (executing-plans) from `docs/superpowers/plans/2026-05-31-wall-climb-power.md` (12 tasks). User-confirmed feel: hold-X-to-climb (ladder), gravity off while held.

### Shipped (commits a52ee6f → c7ac48d)
- **Wall-Climb = hold-Up ladder** (`da2c01a`, input refined post-playtest): while overlapping a climbable wall and holding **Up / W**, Eloise ascends at a steady `climbSpeed` (130 design-px/s) with gravity suspended; release → normal gravity → step off at the top. `ABILITIES.wallClimb` gains `activation:"hold"` + `traversal.climbSpeed` (`a52ee6f`).
  - **Control refinement (post-playtest):** originally on the power button (X) like Glide, but X's fallback is Dash — a gravity-suspended *lunge* — so a stray X near the wall dashed the player *off* it in an unrecoverable loop ("hitting X just dashed over and over"). Moved climb to **Up/W**: directional, intuitive ("up to go up"), no displacement side-effect. Wall-Climb stays a `control:"power"` ability in the dispatcher (priority 4) so being on a wall still **suppresses X** (no accidental dash-off); only the trigger key changed. Recorded as a deliberate exception to spec invariant #6 in the spec §6.1.
- **`climbWall` — the 2nd traversal element kind** (`0d15df0`): a non-solid climbable rectangle `{x,y,w,h}`. Made `LevelData.climbWalls` **`.optional()` not `.default([])`** — deliberate deviation from the plan: `.default([])` forces the field into the *inferred-required* output type (every hand-authored literal would need `climbWalls:[]`, and the cast catalog levels would be `undefined` at runtime → the ordering guard's `.length` would crash). Optional + `?? []` guards is the right fit for a rare per-level feature.
- **Conditional climb edge** (`44e5ec0`): `climbConnects(a,b,walls)` — two surfaces that both *touch* the same wall (horizontal overlap inclusive of edges + `topY` within the wall's vertical span) are connected when wallClimb is active. Threaded through the BFS as an extra `OR` alongside `canReach`. **Wall-gated + additive** → backward solvability preserved by construction. Pinned by the sheer-ledge proof (210px up, unjumpable, climb-reachable).
- **Pure detection** (`00ec582`): `isOnClimbWall(body, walls)` AABB-overlap helper (Phaser-free, like airJump/powerDispatch) so the Player's "am I on a wall?" is unit-testable.
- **Dispatcher + Player** (`da2c01a`): `PowerContext.onClimbableWall` (required); `wallClimb` predicate at priority 4 outranks glide/dash on a wall, falls back off it. **Tasks 5+6 were committed together** — adding a *required* PowerContext field and the Player that supplies it is one atomic type contract (neither compiles alone); committing either side solo would be a knowingly-red `tsc`.
- **GameScene** (`7ad0e58`): `buildLevel` draws a translucent green rect per `climbWall` (non-solid — no physics body; climbing is velocity-driven) and calls `player.setClimbWalls`; `clearLevelEntities` + `teardown` dispose/reset them. First power to need runtime level geometry.
- **Auto-proof** (`fdafa67`): `wallClimbDemoLevel.ts` proven **solvable WITH the Family Room loadout (double-jump+dash+wall-climb) / NOT without wall-climb** — jump+dash can't scale a sheer wall. Key geometry constraint baked in: the exit sits **past the floor's right edge** so the floor can't trivially satisfy the lenient exit-zone check (only the high ledge reaches it).
- **Ordering guard** (`b4561c7`): a level with any `climbWall` must have wallClimb in its area (spec invariant #2). Green today; load-bearing once the Family Room is authored.
- **Testing Ground Station 4** (`52732c2`): base → 190px climbable wall → high ledge (exit); `"wallClimb"` added to `IMPLEMENTED_POWERS`.
- **Dev sandbox** (`c7ac48d`): `eloiseLoadDemo("wallClimb")` (grants the Family Room loadout).

### Verification
`npm run build` green: **128 tests** (was 105 at session start), tsc clean, vite build ok. Tree-shake invariant holds: "Testing Ground" = **0** in `dist/` (DEV-gated menu path eliminated); "Wall-Climb Demo" = 1 ships via the console handle like the other demos. Runtime (dev preview): `eloiseLoadDemo("wallClimb")` built the demo (GameScene+UIScene active, `hasWallClimb`+`hasDash` true, `climbWalls: 1`), the **green climb-wall visual** renders rising from the floor to the high ledge with Eloise at the base, 4 hearts, **no console errors**.

### Process note
Same inline, per-task discipline as P3 (edit → targeted vitest → commit). The per-edit tsc hook fired between paired edits frequently (transient "declared but never read" / arg-count / missing-field mid-edit) — all cleared by the pair's later edit; ordering impl-before-test where a symbol is referenced keeps it quiet. One real decision surfaced mid-build: `.default([])` vs `.optional()` for `climbWalls` (chose optional — see above).

### Carried-forward (minor, non-blocking)
- **Mantling feel (the #1 playtest tuning item):** at the top of a climb she tops out *beside* the ledge and must step right onto it (the wall sits at the ledge's edge, not under it, to avoid being blocked from below by the solid ledge). If it's fiddly in playtest, widen the wall or nudge the ledge's left edge toward the wall — the auto-proof + station tests re-validate after any geometry change.
- **Dev-handle cosmetics (pre-existing, same as dash/glide):** the `eloiseLoadDemo` *console* handle leaves MenuScene running (text bleeds through) and the HUD shows a catalog level label. The "Testing Ground (dev)" menu path is clean.
- `tick()`'s power block (dash + wall-climb + glide) is now sizeable — a clear candidate to extract into `private applyPowers(...)` when P5 charge lands.

### Next Session Should
1. **Manual playtest wall-climb** (Phaser ignores synthetic input): menu → "Testing Ground (dev)" → clear all 5 stations; at the climb wall, touch it and **hold Up (or W)** to climb, step off at the top. Or focused: console `eloiseLoadDemo("wallClimb")`. Confirm the climb feel + the mantle-onto-ledge; tune `climbSpeed` / wall geometry if needed.
2. **Then P5 — Charge** (the LAST traversal power; gates the Living Room): a `breakable` element + a `requires:"charge"` edge that's *blocked until* charge removes it (the inverse of dash/climb — a barrier, not an enabler), + the charge mechanic on the dispatcher (priority 2). The `requires`/element/dispatcher machinery from P3–P4 is the base; the new wrinkle is a *removable blocker*. Write its plan first; final task adds a charge station + appends "charge" to `IMPLEMENTED_POWERS`. That completes all 5 powers.
3. **Fold into P5 (first non-Teddy companion):** `Companion.computeFeetOriginY` hardcodes `TEDDY_WALK`; `textures.ts ENTITY_TEXTURE_KEYS` lacks dog/cat/horse/flamingo. Both pre-existing.

---

## Session: 2026-05-31 (Power System P3 — Dash, first traversal power)

**Goal met:** Dash — a gravity-suspended horizontal lunge — is built, build-green, and runtime-verified in the dev sandbox. P3 is the first *traversal* power, so it also births the machinery the remaining traversal powers (wall-climb, charge) reuse: the `requires` level tag, the conditional reachability edge, and the dispatcher's first `"press"` activation. Executed **inline** (executing-plans) from `docs/superpowers/plans/2026-05-31-dash-power.md` (10 tasks). User-confirmed feel decisions: clean lunge (gravity off during dash) + generous/zoomy.

### Shipped (commits 9ce91e8 → 4667fc0)
- **Dash = gravity-suspended lunge**, not a momentum burst (user decision). On a power-button press resolving to dash, `Player` runs a fixed-window horizontal burst (`vx = ±dashSpeed`, `vy = 0`) for `dashDurationMs`, then a recovery cooldown so it can't be chained into free flight. `dashSpeed = 800` design-px/s × `dashDurationMs = 400` → **~320 design-px** reach (~10 grids). Tracks `facing` from horizontal input. Dash state resets on death + pit respawn.
- **Powers-are-data, derived envelope:** `ABILITIES.dash.traversal = { dashSpeed, dashDurationMs }` is the single source — `Player` scales speed by RENDER_SCALE; `reachability` derives `dashDistance = dashSpeed × duration/1000` in design-space. Can't drift (mirrors `glideFallSpeed`).
- **The first tagged element** (`9ce91e8`/`950088e`): `PlatformSchema.requires` (optional `AbilityIdSchema` enum). The spec put this "in P0" but envelope powers (P0–P2) never needed a tag — dash is the first power that gates on explicit geometry, so the field is born here.
- **Conditional dash edge** (`f926037`): `canReach` grants a flat horizontal crossing up to `dashDistance` to a `requires:"dash"` platform at **equal-or-lower** height, **only when dash ∈ abilities**. Two guards make it safe: **tag-gated** (untagged gaps get no dash edge) + **additive** (an extra `return true`, never removes an edge) → backward solvability of every existing level is preserved by construction. 5 unit tests pin it (incl. the Kitchen-loadout case: double-jump alone can't clear it, double-jump+dash can).
- **Dispatcher** (`0fa7e91`): dash predicate is `() => true` at the lowest priority — the "otherwise" fallback (spec §6.1). So glide (priority 3) still wins while airborne+descending; dash takes grounded/rising presses. 6 new dispatch tests.
- **Auto-proof** (`efc8e4c`): `dashDemoLevel.ts` (flat 260px gap → `requires:dash` landing, NOT in `LEVEL_CATALOG`) proven **solvable WITH the Kitchen loadout / NOT without dash** by `dash.integration.test.ts` — the metroidvania guarantee as a test. Gap sized right first try (260 > double-jump ~212, < dash ~320).
- **Ordering guard** (`c9ce0fe`): a catalog build-gate test asserts every catalog platform's `requires` is earned in an *earlier* area (spec invariant #2). Green today (no tagged catalog level); load-bearing once the Kitchen is authored. Implemented as a test, not a Zod `.refine`, because `LevelData` carries no `areaId`.
- **Testing Ground Station 3** (`205831e`): a flat 260px ground-dash gap appended after the glide drop; `"dash"` added to `IMPLEMENTED_POWERS`. The traversability test proves the station is clearable with the roster.
- **Dev sandbox + cleanup** (`4667fc0`): `eloiseLoadDemo` is now table-driven over `glide`/`dash` (dash grants the Kitchen loadout). Also removed the duplicate `eloiseGame`/`eloiseState` block in `main.ts` (the carried-forward cleanup from the glide recovery).

### Verification
`npm run build` green: **105 tests** (was 91 at session start), tsc clean, vite build ok. Production tree-shake invariant re-confirmed: "Testing Ground" = **0** occurrences in `dist/` (DEV-gated menu path still eliminated), "New Game" = 1; "Dash Demo" = 1 ships like "Glide Demo" via the unconditional `eloiseLoadDemo` console handle (not a regression). Runtime (dev preview): `eloiseLoadDemo("dash")` built the Dash Demo (GameScene+UIScene active, `hasDash`+`hasDoubleJump` true, bounds.maxX 960, 2 platforms), Eloise rendered on the start platform with the far `requires:dash` landing + exit across the gap, 4 hearts (Teddy bonus), **no console errors**.

### Process note
Ran **inline** rather than subagent-driven — the right call given the logged subagent phantom-SHA / parallel-cascade hazard and that all 10 tasks were mechanical and built directly on the P2 glide patterns read end-to-end first. The per-edit tsc hook fired between paired edits a few times (transient "declared but never read" / "property does not exist" mid-edit), always cleared by the second edit of the pair — ordering impl-before-test where a field is referenced avoids it. Every task: edit → targeted vitest (green) → commit.

### Carried-forward (minor, non-blocking)
- **Dev-handle cosmetics (pre-existing, same as glide):** the `eloiseLoadDemo("dash")` *console* handle starts GameScene without stopping MenuScene, so the menu text bleeds through; and the HUD shows a catalog level label ("Hallway — First Leap"), not "Dash Demo". The **primary** path — the "Testing Ground (dev)" menu option — goes through `confirmSelection` and is clean. Worth a shared `stop("MenuScene")` + a real sandbox HUD label someday.
- The reachability dash test could add a fixture where `to` is exactly at `from` height vs slightly higher to pin the `d <= 0` boundary harder (currently covered by the "no dash UP" case).
- `tick()` keeps growing; the power block (dash + glide) is now a clear candidate to extract into `private applyPowers(onGround)` when P4 wall-climb lands.

### Next Session Should
1. **Manual playtest dash** (the one thing automation can't do — Phaser ignores synthetic input): main menu → "Testing Ground (dev)" → clear all 4 stations; at the dash gap **run to the edge and tap X** to lunge across. Or focused: console `eloiseLoadDemo("dash")`. Confirm the lunge clears the 260px gap, a 2nd dash is briefly blocked (cooldown), and the feel is right — tune `ABILITIES.dash.traversal` (dashSpeed/dashDurationMs) + `DASH_RECOVER_MS` if needed; the auto-proof + station tests re-validate after any change.
2. **Then P4 — Wall-Climb** (gates the Family Room): a `climbWall` element + a `requires:"wallClimb"` edge that connects a lower surface to a higher one regardless of jump arc, + the climb state on the dispatcher (priority 4). Write its `docs/superpowers/plans/` plan first; final task adds a wall-climb station to the Testing Ground + appends "wallClimb" to `IMPLEMENTED_POWERS`. The `requires`/conditional-edge machinery from P3 is the reusable base.
3. **Fold into P4 (first non-Teddy companion):** `Companion.computeFeetOriginY` hardcodes `TEDDY_WALK`; `textures.ts ENTITY_TEXTURE_KEYS` lacks dog/cat/horse/flamingo. Both pre-existing.

---

## Session: 2026-05-31 (Testing Ground — dev power sandbox)

**Goal met:** a dev-only, menu-selectable **Testing Ground** — an off-catalog obstacle course for feel-testing physics/powers without building real levels. Motivated by the glide build: glide gates the (unbuilt) Living Room, so it was only testable via an undiscoverable console command. Executed inline from `docs/superpowers/plans/2026-05-31-testing-ground.md` (3 tasks).

### Shipped (commits e0853de → 0bb295c)
- **`src/levels/testingGround.ts`** (`e0853de`): `TESTING_GROUND` — a 6-platform left→right course of stations: Warmup (walk/jump) → Double-Jump gap (130px, fails base ~122 / clears double ~212) → Glide drop (high ledge → 160px gap / 120px drop, clears only by holding X). Authored in the real `LevelData` schema; **NOT in `LEVEL_CATALOG`**. Plus `IMPLEMENTED_POWERS` (`["doubleJump","glide"]`) — THE single roster both the menu grant and the reachability test derive from, so they can't drift; and `grantAllImplementedPowers(state)`.
- **Reachability guarantee** (`e0853de`): `testingGround.test.ts` asserts the course is fully traversable with `IMPLEMENTED_POWERS` — the same dead-end protection the catalog gets, opt-in for this off-catalog level (it skips the build double-check). Geometry passed first try.
- **Dev-only menu row** (`5a5bca0`): "Testing Ground (dev)" appears on the main menu, gated on `import.meta.env.DEV`. Selecting it grants all implemented powers and loads the course via `GameScene.devLoadLevel` + the `events.once(CREATE)` override (the `eloiseLoadDemo` pattern). New stations get added to `testingGround.ts` + `IMPLEMENTED_POWERS` as P3–P5 powers ship.
- **Production tree-shake fix** (`0bb295c`): the build-gate grep caught the dev row **leaking into the production bundle** (2 occurrences). Root cause: only the `options.push` was DEV-gated; `labelFor`'s string, `confirmSelection`'s branch, and `startTestingGround`'s body (→ its `TESTING_GROUND` ref) weren't, so Rollup couldn't prove them dead. Fixed by guarding every dev path with `import.meta.env.DEV` → Vite statically eliminates them. **Verified: "Testing Ground" now 0 occurrences in `dist/` (was 2); "New Game" still 1.**

### Verification
`npm run build` green: **91 tests** (was 88), tsc clean, vite build ok. Runtime (dev preview): menu shows "New Game" + "Testing Ground (dev)"; driving the real `confirmSelection` on the dev row loaded `TESTING_GROUND` (`bounds.maxX 1920`, 6 platforms — not a catalog level), granted double-jump + glide, player live at spawn, HUD up, no console errors. Production bundle confirmed free of the dev strings.

### Process note
Ran **inline** (executing-plans) rather than subagent-driven — right call for a small 3-task plan built on patterns verified firsthand; no subagent-coordination overhead. The production tree-shake bug is a good example of the build gate earning its place: the feature *worked* (row never renders in prod because the push is gated), but the spec's stricter "absent from bundle" invariant only held after the follow-up fix the grep forced.

### Carried-forward (minor, non-blocking)
- `src/main.ts` has the `eloiseGame`/`eloiseState` dev handles defined **twice** (leftover from the glide Task 5/6 recovery) — harmless re-assignment, worth a cleanup.
- Testing Ground HUD shows a catalog level-name label (cosmetic, same as the glide sandbox — the loaded geometry is correct).

### Next Session Should
1. **Manual playtest the Testing Ground** (the only thing automation can't do — Phaser ignores synthetic input): `npm run dev` → menu → "Testing Ground (dev)" → walk right; clear the double-jump gap (2× Space) and the glide drop (hold X). Confirm each station feels right; tune `glideFallSpeed` if needed.
2. **Then P3 — Dash** (first *traversal* power: reachability-edge contract + `requires:"dash"` element + the dispatcher's first `"press"` activation). Its plan's final task: add a Dash station to the Testing Ground + append "dash" to `IMPLEMENTED_POWERS`. Write the plan first.
3. **Fold into P3 (first non-Teddy companion):** `Companion.computeFeetOriginY` hardcodes `TEDDY_WALK`; `textures.ts ENTITY_TEXTURE_KEYS` lacks dog/cat/horse/flamingo. Both pre-existing.

---

## Session: 2026-05-31 (Power System P2 — Glide + power dispatcher)

**Goal met:** Glide (the 2nd envelope power) and the reusable one-button power-input system it rides on are built, build-green, and runtime-verified in a dev sandbox. Executed subagent-driven from `docs/superpowers/plans/2026-05-31-glide-power-button.md` (7 tasks).

### Shipped (commits 15fb026 → 0030db6)
- **Glide = parachute clamp**, not reduced gravity (design decision, supersedes the old `fallGravityMult` scaffold). Held-X clamps descent to a gentle constant `glideFallSpeed` (90 design-px/s) → reach is *linear* in drop height (easy gate design for ages 4–8).
  - `ABILITIES.glide.envelope.glideFallSpeed` + new `activation: "hold"` field (`15fb026`).
  - Reachability models it as constant-speed descent with a **monotonicity guard** — `fallTime = max(arcFallTime, glideFallTime)` so glide *only ever extends* reach → backward solvability of earlier levels can't regress (`e5aefcc`).
- **One-button power dispatcher** (`src/entities/powerDispatch.ts`, `d76f4d1`): pure, Phaser-free `resolveActivePower(ctx, unlocked)` returning the highest-priority unlocked `control:"power"` ability whose context predicate matches. Predicates live OUTSIDE the `ABILITIES` data table so the Node reachability lint still imports it. Mirrors the P1 `shouldAirJump` pattern; 6 unit tests. This is the infra P3–P5 (dash/wall-climb/charge) reuse.
- **Player wiring** (`b249842`): `keyPower` (X); after gravity integration, builds `{airborne, descending}`, dispatches, and clamps `vy` to `glideFallSpeed*RENDER_SCALE` while X held. One-directional (only reduces downward speed). X added to GameScene's keyboard capture list.
- **Auto-proof + dev sandbox** (`0030db6`): `glideDemoLevel.ts` (high ledge → far-low landing) proven **solvable WITH glide / NOT without** by `glide.integration.test.ts` — the metroidvania guarantee, as a test. Demo deliberately NOT in `LEVEL_CATALOG` (a glide-gate can't appear before the Living Room). `GameScene.loadLevel` split into catalog-lookup + reusable `buildLevel(data)` + `devLoadLevel(raw)`; `main.ts` exposes `eloiseGrant(id)` and `eloiseLoadDemo("glide")` (+ restored `eloiseGame`/`eloiseState` console handles).

### Verification
`npm run build` green: **88 tests** (was 72 at session start), tsc clean, vite build ok. Runtime: `eloiseLoadDemo("glide")` in the preview builds the demo level, Eloise renders on the start ledge (spawn 48,96), HUD shows, `hasAbility("glide")===true`, no console errors. The sandbox load also re-exercises the menu→game stop/start path, re-confirming the replay-freeze fix.

### Process notes (subagent-driven execution)
- Tasks 1–4 ran cleanly via implementer + 2-stage review (spec then quality), each spec-✅ + quality-Approved.
- **Subagents repeatedly reported phantom commit SHAs** (e.g. `c6f8b9e`, `60db5d8`) that didn't exist; reviewers' "don't trust the report — verify HEAD" discipline caught every one. Tasks 5–6's subagent work didn't persist (lost to a parallel-dispatch cascade cancel), so I implemented 5+6 **inline** and verified on disk. Lesson logged: dispatch implementer → wait for the *real* commit → then reviewers; never parallel-dispatch all three; never bake an unverified SHA into a reviewer prompt.

### Carried-forward (minor, non-blocking)
- The reachability monotonicity test doesn't exercise the `max()` *arc-wins* branch (at `glideFallSpeed=90` glide always dominates). Guard is correct; just under-tested. Worth a fixture where the arc wins if glide tuning changes.
- `tick()` is growing; when P3 dash lands, extract a `private applyPowers(onGround)` (the dispatcher is already the pure seam).

### Next Session Should
1. **Manual playtest the glide feel** (the only thing automation can't check — Phaser ignores synthetic input): in the browser console run `eloiseLoadDemo("glide")`, then **hold X while falling** off the high ledge. Confirm she descends gently while held, falls normally on release, and clears the gap that's impossible without it. Tune `ABILITIES.glide.envelope.glideFallSpeed` (lower = floatier) — the auto-proof re-validates the gate after any change.
2. **Then P3 — Dash** (first *traversal* power; needs the §5.2 reachability-edge contract + a `requires:"dash"` element + the dispatcher's first `"press"` activation). Write its `docs/superpowers/plans/` plan first.
3. **Fold into P3 (first non-Teddy companion):** `Companion.computeFeetOriginY` hardcodes `TEDDY_WALK`; `textures.ts ENTITY_TEXTURE_KEYS` lacks dog/cat/horse/flamingo. Both pre-existing.

---

## Session: 2026-05-31 (replay-freeze fix)

**Goal met:** the menu↔game **replay freeze + missing-HUD** bugs (handed off last session) are fixed and verified at runtime. Token-hitbox fix from prior session confirmed by user playtest (grazed/backtrack coins collect).

### Root cause (two causes, one symptom — why prior single-hypothesis attempts missed it)
Phaser recycles the **scene instance** across `stop()`/`start()`, resetting only scene *status* — instance fields, listeners, and object refs all survive. On the 2nd entry:
1. **Stale `GameState.worldComplete` / `paused`** → `GameScene.update()` early-returned at its guard → Eloise frozen. (The prior session's rejected "physics.world.isPaused" hypothesis was looking at the wrong pause flag — it's the `GameState.paused` *field* + `worldComplete` that gate `update`.)
2. **Stale destroyed `player` reference** → `loadLevel`'s `if (!this.player)` was falsy, so it called `respawnAt()` on a dead sprite instead of `new Player()`. And `uiLaunched` staying `true` skipped the HUD relaunch → no HUD.

### Completed
- **`GameState.beginRun()`** (new) — clears transient run flags (`worldComplete`, `paused`) + refills hearts, *without* touching saved progress. New Game calls `resetWorld()` then `beginRun()`; Continue calls `beginRun()` alone (so level/tokens/abilities survive). 3 unit tests added. `MenuScene.confirmSelection` now routes through it.
- **`GameScene` `SHUTDOWN → teardown()`** — explicit per-run teardown paired with `create()`: removes the 4 custom `this.events.on(...)` listeners, clears level entities + backdrop, destroys + **nulls `this.player`** (forces fresh build), resets `uiLaunched`/`exitCooldown`/`pitRespawnLock`. This is the idiomatic Phaser fix (pair setup with teardown).
- **`UIScene` `SHUTDOWN`** — removes the 3 cross-scene listeners it binds onto `GameScene.events` (`hud-update`/`world-complete`/`pause-changed`) so they don't stack each HUD relaunch.
- **Dev globals** in `main.ts`: `window.eloiseGame` (Phaser.Game) + `window.eloiseState` (GameState singleton), mirroring the existing `eloiseReset`. Added for runtime scene-lifecycle introspection — kept because this project keeps hitting lifecycle bugs and these make them debuggable from the console.

### Verification (runtime — the part Vitest can't reach)
Drove the full scene lifecycle via `preview_eval` across **3 menu↔game cycles** (New Game → win → menu → **Continue** → menu → New Game). Every assertion passed: after re-entry GameScene+UIScene active, **`worldComplete` cleared**, **fresh active player** (`!== prev instance`, has body), **HUD relaunched**, **`player-died` listener count stayed 1** (no stacking), `updateWouldRun: true`. Live probe: Eloise on-screen at L1 spawn, HUD `"picks: 0  lvl 1/5"`, no console errors. `npm run build` green (75 tests, was 72).

### Next Session Should
1. **Quick human playtest** to confirm the *feel* (synthetic input can't be tested — the one gap): finish/leave a game → Main Menu → New Game *and* Continue; confirm Eloise moves + HUD shows. Programmatic proof is solid, but a 30s real playthrough closes the loop.
2. **Resume the power roadmap — Phase 2 (Glide + one-button power dispatcher).** Write its `docs/superpowers/plans/` plan first; the `jumpEnvelope` glide branch is already scaffolded.
3. **Fold into the FIRST non-Teddy companion phase (P3 Dash/Dog):** (a) `Companion.ts` `computeFeetOriginY` hardcodes `TEDDY_WALK`; (b) `textures.ts` `ENTITY_TEXTURE_KEYS` lacks `dog/cat/horse/flamingo` (boot smoke test silently stops covering companions). Both pre-existing.

---

## Session: 2026-05-31 (playtest feedback)

**Goal met:** the double-jump slice is playable end-to-end and "feels really solid" (user playtest). Two follow-up bugs surfaced; one fixed, one diagnosed-not-fixed and handed off below.

### Completed
- **Menu "New Game" / click bug — FIXED (`492fbf6`, supersedes `6fc2b6f`).** Root cause was NOT the menu logic: the game runs `Scale.NONE` and CSS-scales the canvas via `applyIntegerScale` without notifying Phaser, so `pointer.y` came back in CSS pixels on an enlarged canvas while option rows are at game-space y → clicks matched nothing. Fix computes game-space Y from the raw DOM event + canvas rect (`clientYToGameY` in `src/scenes/menuSelection.ts`, unit-tested 1x/2x/3x), bypassing Phaser's stale transform. User confirmed clicking works.
- **Token pickup hitbox — FIXED (this commit).** `Token` did `setScale(RENDER_SCALE)` with no body sizing, so the pickup hitbox was the raw 8px frame → grazed coins missed. Sized a generous 22px world-px body centered on the coin, using the same pre-divide pattern as the DustBunny hitbox fix (`521319e`). Verify on next playtest.

### UNRESOLVED — hand-off for fresh context: replay freeze
**Symptom:** after finishing/leaving a game → Main Menu → New Game, the game *enters* (GameScene runs) but is **frozen** — Eloise can't move — and the HUD is gone. Reproduces via the pause menu's "Main Menu" too (same `UIScene.returnToMainMenu` path), so it is NOT win-specific.

**Evidence gathered (so the next session doesn't re-walk these):**
- `GameScene.create` DOES run on the 2nd entry (verified by log) — it's a frozen game, not a bounce back to the menu (an earlier mis-read; the menu re-creates only via HMR reloads polluting the console).
- **`physics.world.isPaused === false`** on the 2nd entry → the "ESC paused the world and `returnToMainMenu` never resumed it" hypothesis is **REJECTED** (a `physics.world.resume()` on entry did nothing; reverted).
- No console errors.
- Menu input is fine: `keydown` reaches the menu, `confirmSelection` and `moveSelection` both fire, `canvasFocused === true`, no other scenes running (`getScenes(true)` empty). So the freeze is on the **GameScene** side, not the menu.
- `uiLaunched` is a persistent instance flag → `true` on the 2nd entry → `GameScene.create` skips `this.scene.launch("UIScene")` → **no HUD on replay** (confirmed separate bug, same root: scene-restart lifecycle).
- Ruled out: duplicate keyboard listeners (`KeyboardPlugin.shutdown` calls `removeAllListeners`); canvas focus; scene overlap.

**Leading hypotheses for next session (untested):**
1. `GameScene.update` early-returns on the 2nd entry — check `GameState.paused` (the flag, distinct from `physics.world.isPaused`), `worldComplete`, `!player`, `!levelData`. If any is stuck/null after the restart, `update` returns before `player.tick` → frozen.
2. Keyboard input not reaching `Player` after the transition (input-plugin/key state on a reused scene instance), even though the *menu* received keys.
3. Stale GameScene instance state across `scene.start` restarts (accumulated `this.events.on(...)` handlers from each `create`; `uiLaunched`; cross-scene listeners `UIScene` adds to `GameScene.events` that aren't removed on `UIScene` shutdown).

**User's steer:** "this should just be a menu, we're overthinking it." Likely the right move is a clean rebuild of the menu↔game scene lifecycle — full, explicit teardown + setup on every transition (stop GameScene+UIScene and reset the relevant flags/state on menu entry; (re)launch UIScene and reset per-run state on game entry) — and simplify `MenuScene` to a plain click menu (drop the selection-index + keyboard-nav machinery; `clientYToGameY` already makes click selection robust).

### Next Session Should
1. **Fix the replay freeze** — start from hypothesis #1 (instrument `GameScene.update`'s early-return conditions on the 2nd entry). Then rebuild the scene-restart lifecycle cleanly per the user's steer, restoring the HUD (`uiLaunched`) in the same pass.
2. **Verify the token hitbox fix** in a real playthrough (grazed coins should now collect).
3. **Then resume the power roadmap** — Phase 2 (Glide + one-button power dispatcher); P3 (Dash/Dog) carries the two pre-existing non-Teddy companion prerequisites noted in the 2026-05-30 entry.

---

## Session: 2026-05-30 17:55

### Completed
- **Power system Phase 0 + Phase 1 (double-jump slice) — built end-to-end, subagent-driven.** Executed `docs/superpowers/plans/2026-05-30-power-system-foundation-and-double-jump.md` task-by-task (14 commits, `0724822`…`1ec6a47`). Each task TDD'd + reviewed; tests **35 → 63 (+28)**, `npm run build` green, app boots clean.
- **Phase 0 foundation:** `src/config/areas.ts` · `abilities.ts` · `companions.ts` · `gating.ts` — powers-as-data tables; area→ability gating is DERIVED from area order (no hand-configured gates). `GameState.unlockedAbilities: Set<AbilityId>` replaces `teddyCollected` (+ old-save migration). Area-driven reachability double-check harness.
- **Phase 1 double-jump:** `jumpEnvelope(abilities)` (double-jump doubles reach); pure `shouldAirJump` predicate (`src/entities/airJump.ts`) + Player wiring; `Companion` carries its type + emits `companion-collected`; `PowerUnlockScene` reveal; gate-moment wiring; **Hallway gate level** (`hallway-1`).
- **Gate proven by the lint, not opinion:** `hallway-1 — solvable WITH doubleJump` ✓ AND `NOT solvable without doubleJump` ✓ (both assertions in `reachability.integration.test.ts`). Lock = a 130px flat gap (> base reach 121.7, < double reach 212.4) fitted to the real `physics.ts` envelope.

### Decisions / deviations from plan (for cause)
- **Extracted `airJump.ts` (pure `shouldAirJump`) — deviation from the plan's inline code.** The plan's air-jump called Phaser's `JustDown` a SECOND time; `JustDown` is destructive (verified in phaser source: `JustDown.js:24-26`), so the cached call at `Player.tick` already consumed it → double-jump would've silently never fired. Fix reuses cached `jumpPressed` + `groundJumpFired: wantJump` guard, and extracts a unit-tested predicate (the plan claimed "no clean seam" — there was one; the reachability lint never runs the Phaser Player, so this branch otherwise had zero coverage).
- **Made `GameState.load()` private** (capstone-review hardening — closes a maxHearts double-count footgun; load is constructor-only).
- **Combined Tasks 1.7+1.8 into one commit** — 1.8 adds no new code; the double-check from Task 0.6 auto-covers any `areaId:"hallway"` level.

### Issues Encountered
- **Capstone review caught a cross-task composition bug** (`1ec6a47`): the power-reveal paused `physics.world` but not `update()`, so the dismiss keypress buffered a stray jump that fired on resume. Fixed by also setting `state.paused` during the reveal. Per-task reviews couldn't see it — it lived between Task 1.2's input-buffering and Task 1.6's pause-only-physics.
- **Two subagents stalled mid-edit** (truncated reports) when the `post-edit-check.sh` hook fired between the two edits of a 2-edit change (transient TS error). Resumed each + verified actual repo state rather than trusting reports — which also caught Task 1.1 having left `checkReachability` un-wired to `opts.abilities` while the build was still green (a latent trap for Task 1.8).

### Next Session Should
1. **Manual playtest the slice** — the ONLY verification that can't be automated (Phaser ignores synthetic input): `eloiseReset()` in console → play Bedroom → collect Teddy → reveal screen → Hallway → clear the gate with a double-jump. Confirm it *feels* right; tune the air-hop `JUMP_VELOCITY` if floaty (plan OQ1).
2. **Then Phase 2 — Glide + the one-button power dispatcher.** Write its `docs/superpowers/plans/` plan first; Glide is the first `control:"power"` ability and the `jumpEnvelope` glide branch is already scaffolded.
3. **Prerequisites to fold into the FIRST non-Teddy companion phase (P3 Dash/Dog):** (a) `Companion.ts:44` `computeFeetOriginY` hardcodes `TEDDY_WALK` → non-Teddy sprites mis-plant their feet; (b) `textures.ts` `ENTITY_TEXTURE_KEYS` lacks `dog/cat/horse/flamingo` → the boot smoke test silently stops covering companions. Both are pre-existing (not this slice's regressions) and only bite when a non-Teddy companion level ships.

---

## Session: 2026-05-30 10:16

### Completed
- **Whole-project audit (multi-agent).** Diagnosed the recurring "fix one pillar, break another" pain as implicit cross-pillar contracts (magic numbers, not validated data). Verdict: **keep & extend, do not restart** — the level pipeline already proves the cure. Named four seams + the "Weezy workflow" (WIP = one seam at a time; physics frozen during content slices; never two pillars per commit). Captured in project memory.
- **Safety net shipped (`e8b8745`) — Seams 2 & 4 closed, test-first (35 tests):**
  - `src/levels/reachability.ts` — jump envelope **derived from `physics.ts`**; two-tier forgiveness margin (exit 1.0 / content 0.85); `checkReachability` flags unreachable exits (error) + stranded platforms/tokens (warn).
  - `src/levels/levelTextures.ts` + catalog smoke test — every level Zod-valid (catalog wasn't being parsed before!) + references only loaded textures; seeded `ENTITY_TEXTURE_KEYS`.
  - Added Vitest; wired `vitest run` into `npm run build` — a soft-lock now fails the build.
  - **Located worklist on real bedroom levels** (no soft-locks): bed-3 & bed-4 each 1 frame-perfect platform; bed-5 2 unreachable platforms (+ stranded tokens). Content fixes for a later pass.
- **Power system designed end-to-end (`2d6e9a9` + refine).** Spec: `docs/superpowers/specs/2026-05-30-power-system-design.md`. Metroidvania ability-gating — 5 companions each grant a power gating the NEXT area (Teddy→Double Jump … Flamingo→Glide; Bedroom = tutorial). Powers are DATA; one context-sensitive power button (+ double-jump on jump); breakaway reveal screen; the reachability **double-check** proves each area solvable-WITH / unsolvable-WITHOUT its gating power.
- **Implementation plan written.** `docs/superpowers/plans/2026-05-30-power-system-foundation-and-double-jump.md` — bite-sized TDD for Phase 0 (foundation) + Phase 1 (double-jump slice); P2–P5 as forward contracts.

### In Progress
- **Power system: NOT started** — spec + plan only. Next session picks up Phase 0, Task 0.1.

### Issues Encountered
- The reachability lint immediately surfaced the user's known "not all platforms accessible" issue, now located to exact coordinates (worklist above). Deliberately not fixed (levels pillar — separate commit).

### Next Session Should
1. **Execute the power-system plan** — `docs/superpowers/plans/2026-05-30-power-system-foundation-and-double-jump.md`, Phase 0 Task 0.1 onward (subagent-driven recommended). `npm run build` is the gate after each task.
2. **(Optional) Fix the located content worklist** — the 4 platforms + stranded tokens in bed-3/4/5 (own commit, levels pillar).
3. Hold the workflow discipline: one seam per change, `physics.ts` frozen during content slices, never two pillars in one commit.

---

## Session: 2026-05-25 13:11

### Completed
- **Blueprint mode replaces backgrounds during level design.** Pulled PNG backgrounds out of active rendering (still on disk, dormant). New world-space grid (32 design-px / minor lines, 128-px / major) renders behind gameplay. Files: `src/config/blueprint.ts`, `src/systems/BlueprintGrid.ts`. Surgically swapped `GameScene.makeLevelBackdrop` to use it; dropped the async `LevelBackgroundLoader` call chain (3 sites).
- **Character feet-on-floor fix** — diagnosed transparent PNG bottom margin from rembg pipeline. New helper `src/systems/measureSpriteFeet.ts` scans texture alpha for the lowest opaque row, computes Phaser `setOrigin(0.5, <ratio>)` to plant visible feet on the entity's world-space y. Applied uniformly to Player (all idle/jump/walk frames), Companion, DustBunny — auto-corrects for any future NanoBanana re-roll.
- **Level sketches are now the single source of truth for level design.** Built `src/design/levelSketches.ts` (declarative slot/variant data), `src/design/combineSlot.ts` (chains variants A→B→C→D into one continuous level with offset coordinates), `src/design/sketchRenderer.ts` (SVG renderer), `src/design/mapsPage.ts` (entry point). New top-level `maps.html` served by Vite at `/maps.html` shows the design surface; edits to `levelSketches.ts` hot-reload it.
- **Research-driven 15-variant Bedroom design.** Spawned a subagent to synthesize platformer level-design patterns (GMTK Mario 1-1 breakdown, Kishōtenketsu, Dan Taylor's "Ten Principles", Anthropy's "Game Design Vocabulary"). Got 15 named patterns. Built 3 variants per slot (A = research baseline, B = gentler, C = harder/stylistic), each citing its source pattern.
- **B-A-A-C segment chaining locked in as the global ordering.** Every level is now `B → A·1 → A·2 → C` (gentle warmup → baseline → mastery-repeat → twist). Combined widths: L1: 88g/~113s · L2: 100g/~200s · L3: 102g/~255s · L4: 104g/~270s · L5: 124g/~385s. Total ~20.4 min, 125 tokens, 23 enemies + Teddy. Cross-variant companion dedup keeps only the rightmost Teddy.
- **6-area data scaffold.** `BEDROOM_AREA` is fully drafted; `HALLWAY_AREA` (Dog + spider), `KITCHEN_AREA` (Cat + ant), `FAMILY_ROOM_AREA` (Horse + dust mite), `LIVING_ROOM_AREA` (Flamingo + recap all), `DOLLHOUSE_AREA` (T-Rex boss) are stubbed with intent text but no drafted variants. Maps page shows all 6 with status badges (5/26 drafted).
- **Bedroom encoded into playable LevelData.** New `src/levels/encodeFromSketch.ts` converts sketch grid coords (y=0=floor, +y up) → game design-px coords (y=DESIGN_FLOOR_Y, +y down). Auto-handles pit-broken floor segments + derives enemy patrol bounds from platform/pit topology. `src/levels/bedroomLevels.ts` is now 5 lines that auto-generate from `BEDROOM_AREA`. `src/levels/levelCatalog.ts` simplified (5 bedroom entries, placeholder bg since loader is no-op).
- **Camera zoom-out 2x + wrong-facing bug fix** (from live playtest). `cameras.main.setZoom(0.5)` shows 2x more level. Wrong-facing bug: `playSquashStretch` was encoding direction via negative scaleX which double-mirrored with `flipX` after mid-air direction changes. Stripped the sign — `flipX` alone owns direction now.

### Workflow change worth remembering
- **All level design now happens in `src/design/levelSketches.ts`.** Edit a variant's platforms/zones/pits and the game auto-regenerates the playable level on next reload. No more hand-tuning coordinates in `bedroomLevels.ts` — that file just calls `encodeAreaLevels(BEDROOM_AREA, ['B','A','A','C'])`. The maps page (`/maps.html`) is the visualization. CLAUDE.md updated to document this.

### In Progress
- **Hallway / Kitchen / Family Room / Living Room variants** — slot structure scaffolded with intent text and companion+enemy assignments; zero drafted variants. Same B-A-A-C approach + `encodeAreaLevels` will work once content is filled in.
- **Dollhouse boss arena** — slot stub exists, needs different design pattern (not 5-slot, single set-piece).
- **5 dormant bedroom/hallway PNGs still ship in prod build** (~7.7MB dead weight). Easy follow-up: remove `?url` imports in `backgrounds.ts` + `levelCatalog.ts` once we're sure illustrated backgrounds won't reuse them.

### Issues Encountered
- **TypeScript closure-narrowing in `combineSlot`'s forEach** — `lastValidOpt` couldn't narrow inside the callback even though synchronous; refactored to `for (let i…)` loop where TS narrowing works.
- **Companion dedup needed cross-variant logic.** B-A-A-C with slot 5 has Teddy defined in *both* variant A AND variant C. Intra-variant dedup (keep last A occurrence's companion) wasn't enough — final filter keeps only the rightmost companion across the entire combined level.
- **Phaser ignores `preview_click` synthetic events.** Programmatic menu navigation impossible; relied on user to click in their actual browser. Could be sidestepped by exposing `window.game` for direct scene-start eval, but not needed.
- **Screenshot tool glitches at tall scroll positions** on the maps page (multi-area layout is ~3000+ px tall). Used `document.body.style.zoom = 0.5` CSS hack to compress the page enough to capture in one viewport.

### Next Session Should
1. **Playtest in browser** — confirm camera zoom feels right (zoom=0.5 might be too far; could try 0.6 or 0.75) and the facing bug fix actually works end-to-end. Walk Eloise across all 5 bedroom levels — make sure jumps clear, enemies fight back at the right distance, exit triggers properly, Teddy is pickupable in level 5.
2. **Draft Hallway variants** — same 15-variant pattern as Bedroom but themed around carpet/corridor with Spider as new enemy + Dog as companion. Use `BEDROOM_SLOTS` as the structural template; just adapt enemy labels and platform shapes. Maps page will auto-render once data is in.
3. **Procedural variation** — user flagged interest in randomized / right-to-left / vertical levels. Could add per-slot flags like `direction: "rtl"` or `procedural: true` that the encoder respects. Stretch goal — only after Hallway is drafted.
4. **Init git.** Repo is still uninitialized despite three sessions' worth of substantial work. Worth doing before drafting more areas — easier to track per-area progress.
5. **(Deferred) Dollhouse boss arena design** — different pattern from 5-slot collection levels. Probably needs its own research pass for boss-fight design principles.

---

## Session: 2026-05-25 19:30

### Completed
- **Storybook character art for the full V1 cast (29 sprites, ~32 NanoBanana generations)** — replaces all procedurally drawn pink-rectangle characters. Painterly watercolor style anchored on Eloise.
  - Eloise: idle + 6-frame walk cycle + jump
  - Companions × 2 poses each: Teddy, Dog (Dalmatian), Horse, Cat (white + pink bow), Flamingo
  - Enemies: Dust Bunny (idle / walk / attack), Spider (idle / walk / attack), Ant, Dust Mite
  - Boss: T-Rex (idle / walk / roar)
- **NanoBanana asset pipeline established** — single-anchor-image style reference keeps cast cohesive across generations; `eloise-anchor.png` is the locked reference
- **Background-removal script:** `scripts/remove-bg.py` using `rembg` (U²-Net). Replaces an earlier failed chroma-key approach. Strips JPEG-as-PNG checkerboard backgrounds and produces real RGBA PNG with semantic foreground extraction (handles white-on-white correctly)
- **Code wiring (game-side):**
  - `src/config/textures.ts` — texture keys for all 24 character sprites, namespaced
  - `src/scenes/BootScene.ts` — `preload()` loads PNGs; `LINEAR` filter for storybook sprites; defines `ELOISE_WALK_ANIM` (6-frame) and `TEDDY_WALK_ANIM` (2-frame alternation)
  - `src/entities/Player.ts` — Eloise switches between idle / walk anim / jump based on grounded + velocity; old `eloiseFrameKey` procedural path removed
  - `src/entities/Companion.ts` — generalized to accept any texture key + walk anim; plays walk anim when following motion, idle when stationary
  - `src/entities/DustBunny.ts` — 3-pose state machine (idle / walk / attack) tied to patrol velocity; flips horizontally with direction
- **Docs/spec/plan written:**
  - `docs/superpowers/specs/2026-05-24-storybook-character-art-design.md`
  - `docs/superpowers/plans/2026-05-24-storybook-character-art.md`
- **.claude/launch.json** created — registers `npm run dev` for IDE preview integration
- **Build + manual playtest verified** — typecheck clean, production build succeeds, Eloise + Teddy + Dust Bunny render in-game with the new art

### In Progress
- 8 of 11 character sprites are generated and ready on disk but not yet wired to entities (Dog / Horse / Cat / Flamingo companions, Spider / Ant / Dust Mite enemies, T-Rex boss). Sprites are namespaced under `assets/sprites/{player,companions,enemies,bosses}/storybook/` for future wiring.

### Issues Encountered
- **Major detour:** NanoBanana's `gemini_generate_image` returns JPEG bytes regardless of `.png` extension or prompt language asking for transparent background — the "transparent" background is rendered as opaque checkerboard pixels baked into a JPEG. Verified via `file` on output. Both Pro and Flash models behave identically.
- **Failed first fix:** Wrote a 250-line chroma-key script (`remove-checker.py`, deleted) that tried to detect checker colors and BFS-flood-fill from borders. Worked for most characters but completely fails on white-on-white subjects (Dalmatian, white cat) because the foreground white matches the checker white. Multiple algorithm iterations (loose thresholds, context cleanup, interior-pocket detection) couldn't solve the white-on-white problem.
- **Working fix:** Installed `rembg` (U²-Net semantic foreground extraction, the industry-standard tool for this exact problem). One-line per image. Works on every character regardless of palette. Critical detail: must reset alpha to 255 before feeding rembg, otherwise prior chroma-key holes confuse the model into deleting more of the foreground.
- **Tone correction mid-Phase:** First Dust Bunny generated as too menacing (glowing red eyes, bared teeth) for a 3-year-old audience. Re-rolled with "grumpy/pouty" direction and applied that tone across all enemies and the T-Rex boss. Bowser-lite vs scary.
- **Companion orientation:** First Teddy was generated front-facing; companions follow Eloise from behind so they need side-profile facing right (same direction she walks). Re-rolled.
- **Scope creep accepted (with user consent):** Companions upgraded mid-phase from single-pose to 2-pose (idle + walk) so they have motion while following.

### Next Session Should
1. **Tune character scale in-game.** Eloise + Teddy at `0.06 * RENDER_SCALE`, Dust Bunny at `0.04 * RENDER_SCALE` — these are guesses. May need adjustment by eye.
2. **Wire the 8 remaining characters** (Dog / Horse / Cat / Flamingo / Spider / Ant / Dust Mite / T-Rex) — sprites exist on disk; each needs an entity class instance or Companion subclass and a level spawn. Probably its own spec.
3. **Address known gameplay issues raised by user during playtest:**
   - Jump physics tuning
   - Not all platforms are accessible — review platform placement across the 5 bedroom levels
4. **Eventual background redo** to match storybook style (deferred per the "characters now, backgrounds later" decision made at session start)
5. **Initialize git** — repo still uninitialized

---

## Session: 2026-05-24 18:12

### Completed
- **Display sharpness:** 2× internal render (`RENDER_SCALE`), integer CSS scaling (`applyIntegerScale`), NEAREST filters on procedural sprites
- **Menu + pause:** `MenuScene` title/continue; ESC pause menu in `UIScene`
- **Bedroom content:** Four bedroom levels + hallway stub in catalog; platforms/tokens/enemies aligned to art landmarks
- **Area transitions:** Lazy `LevelBackgroundLoader`, preload near exits, bedroom → hallway flow
- **Pit respawn fix:** `body.reset()`, pit grace period, death animation no longer fights kill plane
- **Platforms:** Light blue uniform tint (`PLATFORM_TINT`) + updated plank texture
- **Background framing (latest):** Viewport-height scaling, `BACKGROUND_ART_FLOOR` anchor aligned to platform floor, left-aligned art, camera look-up offset — full bookshelf illustration visible at spawn (verified in browser)
- **Level scale-up:** Wider levels, `LEVEL_HEADROOM`, upper shelf routes
- **Docs:** `AGENTS.md` updated with display/background conventions

### In Progress
- **Background polish:** Per-level `BACKGROUND_ART_FLOOR` tuning may be needed; horizontal stretch vs uniform scale tradeoff on very wide levels
- **Phase 6 playtest:** Bedroom iteration (jump gaps, soft-lock check, token/companion flow)
- **Git:** Repository still not initialized

### Issues Encountered
- HiDPI: manual canvas/`renderer.resize()` broke WebGL — reverted; use integer CSS scale only
- Background iterations: cover scale cropped to floor grain; centered contain left spawn in filler; bottom-anchored stretch still showed carpet until art-floor + viewport-height fix
- Pit fall loop: physics body not synced on respawn

### Next Session Should
1. Playtest all 5 levels end-to-end; tune `BACKGROUND_ART_FLOOR` / `CAMERA_LOOK_UP` per area if needed
2. Initialize git and commit current stable state
3. ROADMAP: finish Phase 6.5 bedroom playtest; expand hallway beyond stub; touch controls (Phase T) if targeting tablet

---

## 2026-05-24 — Session Start Bootstrap

First tracked session. Project docs bootstrapped (`CLAUDE.md`, `PROGRESS.md`).

**State at session start:**
- Phases 0–5 core tasks complete per ROADMAP.md
- Typecheck and production build passing
- No git repository initialized
- Next unchecked roadmap items: 0.8 (HiDPI), 2.6 (area transitions), 2.7 (level streaming), 5.4 (enhanced animations), Phase 6 bedroom content

**Next Session Should:**
- Pick up Phase 2.6 (area transitions) or Phase 6.1 (bedroom level design) depending on priority
- Consider initializing git for version control
