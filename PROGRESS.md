# Progress — Princess Eloise's Big Adventure

---

## Session: 2026-07-08 19:20 (Weezy3D session 9 — PAINTED APPROVED → DEFAULT; recipe deepened; props tried-and-cut)

**The quilt terrain passed playtest ("it looks and feels great — it's a pass"), closing the two-round painted-diorama loop.** Two decisions followed immediately: deepen Bedroom with the remaining recipe ingredients BEFORE rolling to worlds 2–5, and make painted the DEFAULT look. All shipped this session, including one full ingredient that was built, playtested, rejected, and replaced within the hour.

### Completed
- **Painted is the default look** (`main.ts`) — `?look=classic` is the procedural opt-out; worlds without backdrop art fall back automatically (`hasPaintedBackdrop` = the rollout switch).
- **Rolling floor-top silhouettes** — `rollingProfile.ts` (pure, 7 tests): seeded two-wave clamped-sine hummocks, ends tapered; `buildRollingRidge` in `level3d.ts` extrudes them in plush at z [−1.6, −0.5] — BEHIND the shadow blob (−0.3), so physics/feet-planting untouched.
- **Fluttering wallpaper butterflies** — `butterflyPath.ts` (pure, 6 tests): incommensurate-sine wander + flap-with-glide envelope; flock view in `paintedBackdrop.ts` (~5–9 two-wing butterflies at z −6.9, ONE shared canvas wing texture), ticked off the main loop's `elapsed`. Drift verified numerically across forced frames.
- **Parallax cutout props: TRIED AND REJECTED (user verdict)** — the third named ingredient shipped fully (6 NanoBanana furniture/toy cutouts style-locked to `Bedroom.jpg`, rembg u2netp pipeline, two-depth pit-aware builder), survived one scale iteration ("she's shrunk — furniture must be giant, toys bigger"), then was cut on the second look: *"the 3D blocks etc are more alive than these flat images — if anything those should be beautified."* Code + assets fully removed same session.
- **Beautified 3D toys in painted mode instead** (`bedroomSet.ts`) — lettered alphabet-block faces (cached canvas textures, "E" for Eloise in rotation, echoing the painted D/A/K blocks), candy beach-ball gore stripes, candy marbles/crayons/jacks in the foreground crumbs — all with the quilt's emissiveMap lift.
- **Docs:** playbook §5.7 records approval + the rejected-ingredient lesson (+ superseded-note on the round-2 parallax pointer); CLAUDE.md status updated; project memory saved (`project-painted-diorama-approved`).

### Issues Encountered
- None blocking. Pre-commit review (2-axis subagent) found one doc-rot line in the playbook — fixed inline before commit.

### Verification
`npm run build` green: **477 tests** (464 at session start → +13: 7 rollingProfile + 6 butterflyPath), tsc clean. Browser-verified at 1440×810: painted boots by default with zero console errors; scene census 6 lights (at budget), 87 casters, 2 Points fields, 0 leftover prop planes; butterflies drift + flap numerically; screenshot tour segs 1/2/4.

### Paid-for lessons (playbook §5.7 has the full record)
- **Flat billboards near the play plane lose to real lit geometry.** The painted-art-in-3D recipe works for Eloise + far planes, NOT mid-depth static objects next to actual meshes.
- **Scale fiction: Eloise is SHRUNK** — furniture must tower (~8×), toys are her peers, never trinkets.
- The cutout generation pipeline itself works first-shot (reference-lock + "single object, plain background" + rembg) — keep it pointed at far planes / paintings / UI.

### Next Session Should
1. **Roll the painted recipe to worlds 2–5** (playbook §5.7): per world = 5 backdrop paintings + a tileable wallpaper swatch + `BACKDROP_URLS`/`WALLPAPER_URLS` entries + the set's `paintedWall` opt + candy-palette pass over that set's 3D clutter. Kitchen/Living Room reference art already at `docs/reference-art/`.
2. **WebAudio sound blips** — the game is silent; biggest remaining immersion gap.
3. Still queued: NanoBanana pose batch (dash/glide/climb/hurt Eloise frames), diegetic win beat, in-page world hand-off fade.

---

## Session: 2026-07-02 (Weezy3D session 8 cont'd — Wonder-style plush terrain, commit 9df97fb)

**User shared Mario Wonder side-scroller references after the round-2 painted-diorama playtest** ("this is an improvement… what my mind's eye wants to see is closer to this"). Diagnosis of the reference shots: Wonder's backgrounds are actually simple (soft gradient sky, hazy shapes) — the beauty is in the **terrain**. Our gameplay platforms had stayed flat placeholder boxes through both the procedural pass (session 8) and the painted-diorama pass (round 1 + round 2) — decorated around, painted behind, never made beautiful themselves.

### What shipped

- **`WorldSurfaces.plush` flag + `buildPlushPlatform`** (`level3d.ts`) — Wonder-style terrain: a quilted-blanket body (diamond-stitch + hearts canvas texture, `quiltTexture()`, per-mesh repeat tied to platform width) topped with a plush pale-pink carpet lip (`plushTexture()`) with rounded cylinder ends and a slight x-overhang, echoing Wonder's grass-lipped dirt blocks. Lip top stays flush with the physics top — Eloise stands ON the plush, collision untouched.
- **Emissive-map lift** on both quilt and plush materials — Wonder's terrain reads flat-bright and saturated even in shadow; this is the same trick, applied via `emissiveMap` mirroring `map` at ~0.3–0.45 intensity.
- **Per-face materials** on the platform box — quilt pattern only on the z-front/back faces (the diorama-visible ones); side/top/bottom faces get a solid soft-pink `sideMat`, because box UV mapping crushes a tiled pattern on the depth-spanning faces (visible in pit cross-sections).
- Enabled only in painted mode (`main.ts` surfaces override); default procedural look untouched.

**Gate:** 464 tests, tsc clean, `npm run build` green. Browser-verified: terrain now reads cohesive with the backdrop paintings at every segment; pit walls show soft pink over the dark under-floor gradient instead of raw box color.

### Where this leaves the painted-diorama experiment

Two playtest rounds now folded in:
1. **Round 1** (seams, cloned bed, blown-out lamp, ugly floor gaps, floating clutter) → fixed in commit 79c3245 (continuous tinted wallpaper + edge-fading vignette cadence, bloom retune, `buildUnderFloor`, pit-aware dressing).
2. **Round 2** (Mario Wonder reference: "still missing polish… feels like a bunch of images put next to each other") → **terrain is the missing ingredient**, not more background art. Quilt/plush platforms shipped this session.

### Next Session Should

1. **Get the user's verdict on quilt terrain** before doing anything else — it's the biggest structural bet of the painted-diorama arc.
2. If it lands: the playbook's named next ingredients are (a) a parallax cutout-prop layer between wallpaper and play plane (painted furniture via the `remove-bg.py` pipeline, at 2–3 depths) — this is the "it's a place, not a picture" piece Wonder gets from its rolling background hills — (b) a few wallpaper butterflies that actually flutter (ambient life), (c) gentle procedural bumps on floor-top silhouettes (Wonder's ground rolls; ours is still rectangles, visual-only, physics untouched).
3. Once painted-diorama is approved as the direction, decide: make `?look=painted` the default, or keep it a flag while the recipe rolls to Hallway/Kitchen/FamilyRoom/Backyard per playbook §5.7.
4. Still queued from session 8: WebAudio sound blips (the game is silent — likely the next-biggest immersion gap after terrain/parallax), NanoBanana pose batch for dash/glide/climb/hurt Eloise frames.

---

## Session: 2026-07-01 (Weezy3D session 8 — VISUAL IMMERSION PASS 1, ultracode; L1 proof ✅)

**Deep 7-agent visual/animation assessment (116 findings) → plan → the whole juice-and-dressing layer landed on branch `feat/visual-immersion-l1`** (commit 3b8a527). Bedroom is the proof point; the character/camera/FX work is global. Full plan + assessment digest: `docs/superpowers/plans/2026-07-01-visual-immersion-level1.md`; per-world replication recipe: playbook **§5.7 cookbook**.

### What shipped

- **`src/three/fx.ts` (new)** — pooled one-shot particle system (ONE THREE.Points, 256 verts, seeded, deterministic). Wired: landing dust, double-jump ring, dash kick, token sparkle, charge-smash debris + camera shake, enemy stomp poofs, companion celebration.
- **Player animation** (`playerView.ts`) — squash-and-stretch consuming the sim's previously-ignored `justLanded/justJumped/justAirJumped` flags; dash tilt, glide sway, climb lean (new additive `climbing`/`gliding` PlayerState flags — feel tests unchanged), idle breathing, turn-flip tween, sprite-only hurt pulse (shadow blob no longer blinks).
- **Enemies/companions** — stomp = 160ms pancake + poof (was instant vanish); shadow blobs under everyone; dustbunny/spider attack-frame proximity telegraphs; ant/dustMite micro-wiggle; **collected companion now trails Eloise** with walk frames.
- **Bedroom set rework** — cadence dressing (windows+curtains+additive light shafts, crib+rotating mobile / toy chest / teddy landmark rotation, foreground crumbs), visible breathing **hero lamp** + rag rug, ONE dust-mote Points field, bedroom-specific floor. Lights 7→5 (6 with door glow — at budget), set casters 53→19.
- **Camera & presentation** — micro-shake channel, dash FOV kick, win dolly-in, follows Eloise down into pits (critic finding: kids lost sight of her); death/respawn fades; CSS vignette; token-count pulse; controls hint teaches X-power/climb; token collect pop; exit-door glow halo; lattice/plank skins on climb walls/breakables.
- **Perf discipline** — tokens no longer cast shadows (125 casters saved); world census: casters 270→106, `PCFSoftShadowMap` deprecation dodged via `sun.shadow.radius`.

**Gate:** 464 tests green (432→464), tsc clean, build passes, browser-verified (segment screenshot tour + numeric probes). **Next (needs user approval):** apply the §5.7 cookbook to Hallway/Kitchen/FamilyRoom/Backyard; queued experiments: NanoBanana pose batch (dash/glide/climb/hurt), WebAudio blips, diegetic win beat.

**Addendum (2026-07-02): PAINTED DIORAMA at `?look=painted`.** User verdict on the procedural look: "blah, not majestic" + asked whether to switch engines (Unreal). Diagnosis: art direction, not engine — Three.js isn't the ceiling being hit. Shipped the painted-diorama experiment (commit 9ff9903): 5 fresh NanoBanana backdrop paintings style-locked to the reference art hung as per-segment planes, procedural wall/landmarks sit out, candy palette, UnrealBloomPass glow. A/B: `/3d.html?world=bedroom` (procedural) vs `/3d.html?world=bedroom&look=painted`. Recipe + prompt pattern in playbook §5.7. **Superseded by two playtest rounds — see the 2026-07-02 session entry above** for the seam/bloom/floor-gap fixes (79c3245) and the Wonder-style plush terrain (9df97fb) that followed.

---

## Session: 2026-06-15 (Weezy3D session 7 — 3D TRAVERSAL POWERS; §5.4 ✅)

**All five traversal powers ported to the Three.js runtime via subagent-driven TDD** — each power went through spec + code-quality review. Every power-gated world (Hallway, Kitchen, Family Room, Backyard) is now playable end-to-end in 3D. Previously only Bedroom (gate-free) was.

### What shipped

**Five powers, all in `src/three/physics3d.ts`** (the pure sim, reusing `src/logic/` + `src/config/`):

- **Double-jump** — Space/button-0 in air; `shouldAirJump`; gated on `doubleJump`; one air-jump per flight, re-arms on landing. Apex measured 78→155 design-px (`airJumpsUsed` 1 confirmed).
- **Dash** — power button (press); velocity-override window (`dashSpeed` 800 × `dashDurationMs` 400ms via `resolveActivePower`); browser proof: 640px lunge (= 800 × 0.4 × 2 scale-factor) confirmed.
- **Wall-climb** — **Hold Up** (W/↑ / stick or D-pad up), NOT the power button (2D parity); ascends a `climbWall` zone at `climbSpeed` 130, gravity suspended while climbing; vy −260 confirmed ascending.
- **Charge** — power button (press) at a flush barricade OR dash-into-it; smashes a `breakable`; `chargeReach` 14; breakable mesh hidden by caller on `player.justSmashed`; `reset()` restores all breakable meshes (gotcha 12 symmetry). Browser proof: backyard barricades 3→2 on smash, reset restored all 3.
- **Glide** — power button (held); clamps descent to `glideFallSpeed` 90 while airborne + descending, via the dispatcher (priority 3 > dash 1); browser proof: long fall clamped to 180 px/s.

**Input mapping:** keyboard power = **X**, up = W/↑; gamepad power = **button 1**, up = stick/D-pad up (8-way hat decode extended). Jump/double-jump stay on Space / button 0.

### As-built design highlights

- `FrameInput` gained OPTIONAL `up`/`powerPressed`/`powerHeld`; `stepPlayer` gained an OPTIONAL `env: PowerEnv = { unlocked: Set<AbilityId>, climbWalls, breakables }`. Optionality kept the original 13 feel-tests byte-identical ("feel preserved" guaranteed by the type system).
- **Breakables live ONLY in `env.breakables`** (never in static `build.solids`) — `stepPlayer` composes them into collision internally and nulls a smashed one in place, reporting `player.justSmashed` (index). The caller hides that mesh.
- **Abilities are 3D-local** (a `Set` seeded per run by `abilitiesForArea(world.areaId)`), exactly as hearts are 3D-local — NOT the `GameState` singleton. So `?world=kitchen` starts with double-jump+dash+wall-climb. Companion-collect now also `unlocked.add(COMPANIONS[type].grants)` (idempotent), alongside the existing heart bonus. Unlock-seeding confirmed per world: hallway `[doubleJump]`, kitchen `[doubleJump,dash,wallClimb]`, backyard all 5.
- **`level3d.ts`** now renders climb walls (vine-green `MeshLambertMaterial`, behind the gameplay plane at z < 0) and breakables (crate-brown, solid, casts shadow); both exposed on `LevelBuild`; `resetLevel` re-shows all breakable meshes.
- **Type cleanup:** `WorldEntry.areaId`/`LevelCatalogEntry.areaId` widened from `string` to `AreaId` (removed casts).
- New debug handles: `__weezy3d.unlockedAbilities()`, `grantAbility(id)`.

### Spec + plan

Spec: `docs/superpowers/specs/2026-06-15-3d-powers-design.md` · Plan: `docs/superpowers/plans/2026-06-15-3d-powers.md`. 14 commits on branch `feat/3d-powers`.

### Verification

`npm run build` green: tsc + **416 Vitest tests** (was 392; +24 power tests) + 2-page Vite build. The original 13 physics feel-tests are byte-identical (optionality design).

In-browser (preview against the live dev server, driven via `__weezy3d`): double-jump apex 78→155 design-px; dash 640px lunge; wall-climb vy −260 ascending; charge smashed backyard barricade (3→2), `reset()` restored all 3; glide clamped fall to 180 px/s. Unlock-seeding confirmed per world. Zero console errors.

### Feel note for human playtest (not a bug)

Releasing Up mid-wall-climb leaves the player with residual climb velocity (−260), giving a small upward "hop" off the wall (~40% of a jump) before gravity reasserts. Arguably a nice mantle-over-the-lip boost; flagged for the human to judge/tune. **Do not silently change it** — the human plays, the agent proves (playbook §6).

### Next Session Should

1. **Human playtest all 5 powers on real hardware** (including gamepad — button 1 = power, stick/D-pad up = climb): double-jump cadence, dash timing, wall-climb feel + the "hop off" note above, charge smash-vs-dash-plow, glide descent. Bedroom is gate-free; use `?world=hallway` through `?world=backyard` to exercise each gate in context.
2. Optional: port the boss + cutscenes to 3D scenes — pure logic is ready in `src/logic/` (`bossFight.ts`, `cutscene.ts`, `cutscenes.ts` config).
3. Optional: wire `GameState` persistence across worlds (currently 3D-local per run; `src/state/GameState.ts` is kept but not wired into the 3D runtime).

---

## Session: 2026-06-15 (Weezy3D session 6 — GAMEPAD support + 2D Phaser game REMOVED)

**Two arcs, both landed on `main` and verified green.** (1) Added gamepad input to the 3D game and mapped the user's 8BitDo SN30 Pro on real hardware. (2) Extracted the 2D Phaser game out of this repo — Weezy3D is now the Three.js 3D game, full stop — and refreshed all the docs for a clean slate.

### Part 1 — Gamepad support (commit `822dc20`)
- `src/three/gamepad.ts` — pure `readGamepadFrame()` + thin `GamepadInput` shell (same pure-logic/shell pattern as physics3d/enemy3d), **15 TDD'd tests**. OR-merged with the keyboard each frame in `main.ts`; enable/disable lifecycle mirrored; connect toast; live `__weezy3d.gamepad()`/`gamepadConnected()` introspection.
- **SN30 Pro is non-standard** (`mapping:""`, 10 axes/16 buttons). Live-calibrated the real indices: **left stick = axis 0**, **D-pad = HID hat on axis 9** (UP=−1, RIGHT=−0.429, DOWN=0.143, LEFT=0.714, neutral≈3.286 — decoded by `decodeHat`), **jump = button 0 (green A)**. Mapper branches on `gamepad.mapping` so standard pads (D-pad buttons 14/15) also work.
- Verified on the user's real controller: D-pad, stick, and jump all confirmed. (Paid-for gotcha: gamepad input only reaches a focused tab, and a hidden preview tab freezes rAF — auto-verification fails when backgrounded; playbook gotcha 14.)

### Part 2 — 2D Phaser game removed (commit `44e098c`, −3,301 lines)
- **Kept the Phaser-free reusable logic**, relocated to **`src/logic/`** (git renames, history preserved): `airJump`, `powerDispatch`, `bossFight`, `cutscene`, `menuSelection`, `aimVelocity`, `breakable/climbDetect` — the substrate for porting powers/boss/cutscenes to 3D.
- **Deleted the 2D shells:** `index.html`, `src/main.ts`, `src/scenes/*`, the Phaser entity classes, `src/systems/{BlueprintGrid,LevelBackgroundLoader,measureSpriteFeet}`, `config/{display,blueprint,platforms}`; dropped the `main` vite entry + the `phaser` dependency.
- The compiler was the arbiter (entity classes coupled via the ambient `Phaser` global, ungreppable) — delete → `tsc`/`vitest`/`vite build` → green. Executed on a `chore/remove-2d-game` branch, verified, merged ff to main.

### Part 3 — Clean-slate doc refresh
- `package.json` name → **`weezy3d`** (+ lockfile). `CLAUDE.md` rewritten (Tech Stack = Three.js, URLs, folder structure, Game Conventions, Current Status table). `weezy3d-playbook.md` updated (repo context, build gate 392/2-page, file-table gamepad row, gotcha 14, §5.4 powers re-pathed to `src/logic/`, footer). `ROADMAP.md` banner = historical 2D; live 3D roadmap is playbook §5.

**Verification:** `tsc` clean · **392 Vitest tests pass** · `vite build` green (maps + three bundles, no phaser) · 3D boots clean with zero console errors. `src/` is now `config/ design/ levels/ logic/ state/ three/ types/`.

### Next Session Should
- **Port the power system to 3D (playbook §5.4)** — the next big milestone. The pure logic is ready in `src/logic/` (`powerDispatch`, `airJump`, `climbDetect`, `breakableDetect`) + `config/{abilities,gating,areas}`; extend `physics3d.ts`/`FrameInput` per power, test like the 13, then swap the companion-collect hook from heart-bonus to real ability grants. This unblocks Hallway/Kitchen/Family Room/Backyard past their gated seams.
- Decide each power's gamepad button (jump = A/button 0 today; wall-climb is Up in 2D).
- Optional later: port boss + cutscenes to 3D scenes (logic kept in `src/logic/`).

---

## Session: 2026-06-12 morning (Weezy3D session 5 — candy revert + ENEMIES & COMPANIONS in 3D)

**Two arcs.** (1) **Reverted the entire session-4 candy re-theme** — user verdict after playtest: not worth the effort + the lag; a regression vs. session 2/3. (2) **Ported the complete enemy system + companion cameos into the 3D layer** (playbook §5.1, the biggest gap to "playable game in 3D") via subagent-driven development — 7 tasks, each with spec-compliance + code-quality review.

### Part 1 — Candy revert (closed)
- **Restored from the Jun-11 13:37 Time Machine local snapshot** (pre-candy, byte-faithful — `mount_apfs -o ro -s` on the APFS snapshot; no git in this repo): `bedroomSet.ts`, `main.ts`, `worldThemes.ts`. **Deleted:** `candySet.ts`(+test), `textureSlots.ts`(+test), `textureManifest.ts`, `scripts/gen-texture.mjs`, `assets/textures3d/`. Suite 377 → 366 (the 11 candy tests left with their modules).
- **Whole candy effort archived** at `../Weezy3D-candy-backgrounds-archive-2026-06-12.tgz` (15 files, 2.5 MB) — recoverable.
- User confirmed in-play: "feels and looks great (as it was)." The open session-4 frame-rate investigation is **moot** (the user-felt chop was tied to the candy scene; obs 1034 had fingered the big textures). `pixelRatio 2` (4.67M px/frame on retina) remains a known cheap lever (`setPixelRatio(1.5)`) **if** chop ever returns — deliberately not applied to a healthy scene.
- Leftover: `@types/node` devDep (was for the deleted gen-texture script) — kept; it also shapes `setTimeout` typings (see hud.ts captionTimer note below).

### Part 2 — Enemies + companion cameos in 3D (playbook §5.1 — DONE)
Spec: `docs/superpowers/specs/2026-06-12-3d-enemies-companions-design.md` · Plan: `docs/superpowers/plans/2026-06-12-3d-enemies-companions.md` (7 tasks, subagent-driven: fresh implementer per task + spec reviewer + quality reviewer; review findings fixed + re-verified).

**What shipped (all worlds, 2D-parity semantics):**
- `src/three/billboard.ts` — shared `Frame`/`loadFrame`/`measureBottomMargin` (extracted from playerView; headless guard for node tests).
- `src/three/enemy3d.ts` (+9 tests) — pure engine mirroring 2D verbatim: patrol (`Enemy.tick`), stomp-vs-damage (`GameScene.isStomp`: vy≥60·S falling gate, 8·S top band, 0.55·w alignment), per-type hitboxes (bunny/spider 50×40, ant/mite 46×26), gravity + ground rest. Boundary tests pin `>=` patrol-flip + the 60·S threshold edge.
- `src/three/worldStitch.ts` — now **preserves the companion** (offset x, first-wins + duplicate warn) instead of dropping it (+2 tests).
- `src/three/enemyView.ts` — billboards: per-kind shared textures, 8fps 2-frame walk, flip-on-dir, hide-on-defeat **with symmetric visible-restore** (review-caught Critical: stomped enemies stayed invisible-but-damaging after "Play again").
- `src/three/companionView.ts` — idle billboard + sine bob; `setCollected()`/`setUncollected()` lifecycle (replay-safe by design).
- `src/three/hud.ts` — ❤️/🤍 hearts row (top-right), transient caption ("You met Teddy!"); `captionTimer: number | null` (the `@types/node` devDep makes `ReturnType<typeof window.setTimeout>` resolve to Node's `Timeout` — explicit `number` sidesteps it).
- `src/three/main.ts` — full wiring: 3D-local hearts (3/3) + 1500ms invincibility + 100ms blink, stomp → `STOMP_BOUNCE_VY` (replace-object idiom), death → segment-checkpoint respawn + refill, companion pickup → heartBonus (Teddy +1 max) + caption, resetLevel restores everything (enemies/hearts/companion bob/visibility). Review-caught fixes: win-screen blink freeze (blink now short-circuits on `won`), pit-death stale invincibility (`checkKillPlane` zeroes it), pit-spanning patrol bands retire at `killY + 400`.
- Debug handle additions: `getHearts()`, `enemyStates()`, `companionMet()`, `companionAt()`.

**Verification:** 377 tests + tsc + production build green. In-browser (forced-frame driving, tab hidden): 23 bedroom dust bunnies live; **stomp** → defeated + vy −266 bounce, no heart loss; **damage** → exactly 1 heart per hit (invincibility gates), blink caught on camera; **Teddy** at the stitched finale (x≈32,992) → met, caption, hearts 2→3 max 3→4. Zero console errors. Screenshots in transcript.

### Next Session Should
1. **Hands-on playtest** (human feel-check): stomp feel, the death→respawn composite (primitives verified; the 0-hearts path needs a live run — needs ~2 more hits than forced-frame driving affordably simulates), companion moment, enemy density across worlds 2–5.
2. **Git init** — user explicitly deferred to end of THIS session; if missed, top priority next session (the candy revert was only possible via a Time Machine fluke).
3. Then per playbook order: powers port (§5.4 — unblocks gated segments in hallway/kitchen/familyRoom/backyard) or polish backlog (§5.5).

---

## Session: 2026-06-11 afternoon (Weezy3D session 4 — backgrounds pass 2: candy re-theme, bedroom pilot + density + perf round 1)

**Goal:** Re-theme all five 3D worlds toward the user's 3 cartoony/fantastical inspiration JPEGs (`docs/reference-art/`: `Bedroom.jpg`, `Kitchen.jpg`, `Living ROom.jpg`) via AI-generated textures on the existing procedural geometry — sequential, world-by-world, learning per world. **Bedroom (pilot) shipped; hallway→backyard pending; a perf investigation is open.** Spec: `docs/superpowers/specs/2026-06-11-3d-backgrounds-pass2-candy-design.md`; plan: `docs/superpowers/plans/2026-06-11-3d-backgrounds-pass2-candy.md`; learnings: playbook §5.6.

### Completed
- **Texture pipeline:** `scripts/gen-texture.mjs` (Gemini image API direct, key from env/`~/.zshrc`, inspiration JPEGs as style refs per call) + fixed nanobanana-mcp's missing `GOOGLE_AI_API_KEY` env in `~/.claude.json` (now connects). `@types/node` added as devDep.
- **Shared candy builders** (`src/three/candySet.ts`, unit-tested): `buildPorthole` (emissive hills view, **no light by design** — perf), `buildHeroAppliance` (face texture on +z box face, front ≤ z=0), `buildSparkles` (**single THREE.Points**, vertex-color twinkle), `loadCandyTexture` (sRGB + MirroredRepeat), `cadenceSpots` + `floorRangesFromSolids` (pit-aware landmark placement).
- **Bedroom re-themed:** generated wallpaper / porthole-view / toy-chest face / shag rug (`assets/textures3d/bedroom/`), wired into `bedroomSet.ts`; saturated palette bump; sparkle motes via `update` hook.
- **Density fix (user feedback "just wallpaper"):** fixed-fraction landmarks → cadence dressing (portholes ~38u, shelves ~64u, chests ~140u, rugs ~90u, balls/crayons cadenced) with `DressingContext.floorRanges` threaded from `main.ts` (`WorldTheme.buildSet` gained optional 3rd param) so furniture never floats over pits.
- **Perf round 1 (user-reported chop):** scene census showed 19 lights (13 porthole PointLights!), 74 sprite draw calls, 315 shadow casters. Cut to 6 lights / 1 Points draw / 221 casters (clutter out of shadow pass, wallpaper no longer receives). Both constraints pinned by tests. **User still reports chop — NOT closed.**
- Manifest smoke test (`textureSlots.ts` + test): every expected texture file must exist on disk. Suite 340 → **377 tests**, all green; `npm run build` passes.

### In Progress
- **Perf debugging (next session's first task)** — user didn't feel a big improvement after round 1. Round-1 fixes were principled but the dominant bottleneck is unproven.
- Hallway / Kitchen / Family Room / Backyard candy re-themes (process per world is scripted in the plan; bedroom learnings in playbook §5.6).

### Issues Encountered
- First hero-face generation painted the chest *in a scene* → pink-slab artifact on the mesh (fix: demand full-bleed "100% of frame, no background"; playbook §5.6 #2).
- Arbitrary landmark fractions hit a platform (0.62) then a pit (0.57) → segment-spawn anchoring + pit-aware cadence.
- Preview-panel viewport collapsed to 2px → sliver screenshots (fix: explicit `preview_resize 1440×810`; gotcha noted).
- jsdom-free vitest hit `document` in the sparkle-sprite factory → headless guard returns a bare `THREE.Texture`.

### Next Session Should
1. **Profile before touching anything** (rules/debugging.md: measure, don't guess). In the user's *visible* browser tab: expose `renderer` on `__weezy3d` (one line in main.ts), read `renderer.info.render.calls/triangles` after a frame, and log rAF deltas for ~5s while running. Ranked hypotheses: (a) **pixelRatio 2 fill-rate** on the big retina display — try `setPixelRatio(1)` live as a 10-second A/B; (b) **per-frame shadow-map re-render** (sun follows player; try `shadowMap.autoUpdate=false` + update every N frames, or mapSize 2048→1024); (c) visible-set draw calls (frustum culling already prunes most of the 671 meshes — verify actual `calls` number before merging/instancing books); (d) baseline check — stash the pass-2 dressing to test whether chop predates this session.
2. If draw calls prove dominant: `InstancedMesh` for books/blocks (biggest mesh families).
3. Then resume the world loop: Hallway (lavender/mint stars, sunset portholes, grandfather-clock friend) → Kitchen → Family Room (night) → Backyard, using playbook §5.6 + perf budget #9.

---

## Session: 2026-06-09 evening (Weezy3D session 2 — all 25 levels in 3D: level select + world theme registry + 4 world sets)

**Goal met:** **Every catalog level (25, across 5 worlds) loads and plays in the 3D diorama with its own world's set dressing** at `/3d.html?level=n` (bedroom 0–4 · hallway 5–9 · kitchen 10–14 · familyRoom 15–19 · backyard 20–24; win card chains "Next level →"). Built as the user-chosen **pure inline loop** — seam first, then one world per iteration, each verified in-browser before the next. Characters (enemies/companions) deliberately deferred to the next pass (playbook §5.1). Spec: `docs/superpowers/specs/2026-06-09-3d-world-backgrounds-design.md`; plan: `docs/superpowers/plans/2026-06-09-3d-world-backgrounds.md`.

### What shipped
- **The seam:** `worldThemes.ts` registry (`areaId` → fog/background + `buildSet` + `WorldSurfaces`; bedroom fallback), `?level=n` select + clamping in `main.ts`, `WorldSurfaces` param threaded through `level3d.ts` (bedroom defaults), `WorldSet.sunOffset` (per-world key-light angle — main.ts's hardcoded `(+7,11,8)` would have forced bedroom's lamp angle on every world), optional `WorldSet.update(dt, elapsed)` hook for animated lights, "Next level →" on the win card.
- **Four world sets** mirroring the `bedroomSet.ts` skeleton (backdrop −8 / landmarks −5 / clutter −2.6 / foreground +1.9, seeded LCG, no assets): **Hallway** (stripe wall, bench, shoe-rack canyons, floor runner, bright end-window, cool key), **Kitchen** (subway tile, counter runs w/ chrome edge, fridge, stove hero PointLight breathing via `update`), **Family Room** (sofa mountain, entertainment center, fireplace w/ ember+core panes and deterministic two-sine flicker, fire-glow pools), **Backyard** (the outdoor rig: hedgerow + real-sky `background` override, HemisphereLight, sun 1.4, playset/sandbox/grass clumps, foreground blades you look *through*).
- **Verification upgrades** baked into the debug handle: `snapCamera()` (kills the camera-settle wait), `scene` (numeric light/material checks), `levelIndex`/`areaId`/`bounds`.

### Verification (all green, browser-proven)
- `npm run build`: tsc clean + **349 tests** (340 + 9 new `worldThemes.test.ts`: per-world registration, full catalog coverage, bedroom fallback, fogNear≥12 rule, 25-level parse/scale smoke) + 3-page Vite build.
- Per world: screenshots at spawn/mid/exit on the first + widest levels; z-convention spot-checks (Eloise in front of racks/stove/fireplace); zero console errors. Bedroom Level 1 regression-checked pixel-identical at `?level=0`. Win-card chaining clicked through 0→1 live.

### Issues encountered (now playbook gotchas 8–11)
- **Hidden preview tab pauses rAF** — sim freezes; screenshots force single frames. Led to `snapCamera()` + teleport-into-exit verification patterns.
- **Screenshot JPEGs can't resolve small lighting changes** — two "identical" family-room shots across real code changes; resolved by querying `__weezy3d.scene` numerically (which also proved the flicker hook live: fire intensity 6.156 ≠ base 6.0 mid-frame).
- **The encoder stamps bedroom blueprint-placeholder colors on every platform in every world** — `level3d.ts` now ignores `p.color`; themes own the 3D look (the spec's "p.color wins" rule was based on a wrong assumption; discovered when the backyard floor rendered brown).
- **Coplanar glow panes z-fight** (kitchen oven window stripe garbage at exactly +0.81) — glow panes now offset ~0.07 clear.

### Next session could
1. **Feel-playtest all four new worlds by hand** — fog/light knobs are per-world consts at the top of each `<world>Set.ts`.
2. Port enemies (§5.1 — billboards + patrol physics; biggest remaining gap to "playable game in 3D").
3. Per-level hero-object variation within worlds + the Playhouse arena backdrop with the boss port (§5.3 leftovers).

---

## Session: 2026-06-09 (Weezy3D — first playable level in 3D; Three.js renderer port, Bedroom Level 1)

**Goal met:** **Bedroom Level 1 is playable in 3D** at `http://localhost:5173/3d.html` — a side-scrolling Three.js diorama (the "scrolling diorama / HD-2D" pattern from `docs/3d-transition/2d-to-3d-guide.md`) over the **same level data and the same physics constants** as the 2D game. Storybook-billboard Eloise walks, jumps, collects star tokens, and reaches a glowing exit door inside a fully lit, fogged, procedurally-dressed 3D bedroom (per `docs/art-direction/scenery-prompt-library.md` World 1). The 2D game is untouched — `/3d.html` is a third Vite entry beside `/` and `/maps.html`.

### Architecture (what carried, what's new)
- **Carried verbatim:** `PHYSICS` constants, `LevelData` + Zod parsing + `scaleLevelData`, `BEDROOM_LEVELS[0]` (sketch→encode pipeline output). Zero changes to existing files except `vite.config.ts` (multipage build inputs).
- **New `src/three/` (renderer-parallel, no Phaser imports):**
  - `physics3d.ts` — pure AABB platformer physics (the bossFight/reachability pure-logic pattern), simulating in render-px y-down space; ports asymmetric gravity (600/400/900), coyote 100ms, buffer 100ms, variable cut 0.5, air-blend horizontal. **13 unit tests** pin the arc to the 2D envelope (apex 70–92 design px), coyote/buffer windows, wall/ceiling/landing resolution.
  - `coords.ts` — the single 2D↔3D conversion boundary: 1 world unit = 1 sketch grid (64 render px), floor top at world y=0.
  - `input.ts` — keyboard → FrameInput with edge accumulation; **repeat keydowns never establish held state** (guards against host/preview browsers with a stuck key emitting repeat-only events — observed live in the IDE preview).
  - `playerView.ts` — Eloise as camera-facing billboard plane (Option A / HD-2D from the guide) using the 8 storybook PNGs; ports `computeFeetOriginY`'s bottom-alpha scan so feet plant on platforms; walk anim 10fps, jump pose airborne, mirror-flip facing; **ground-cast shadow blob** (analytic raycast to highest solid below).
  - `level3d.ts` — LevelData → meshes: floor segments as deep carpet-textured boxes, shelves as wooden boxes + trim lip, tokens as spinning/bobbing extruded gold stars, exit as a glowing storybook door (frame + emissive pane + breathing PointLight + spinning star).
  - `bedroomSet.ts` — World 1 set dressing, all procedural in the locked palette (dusty rose/cream/sage/butter/wood): polka-dot wallpaper far plane, cool windows w/ light pools, bookshelf landmarks with palette book rows, alphabet blocks/balls/foreground crayons (deterministic LCG scatter), warm key light (casts real platform shadows, follows player), cool window fill, lamp pools, cream fog `0xf5e8d0`.
  - `hud.ts` (DOM token counter / controls hint / win card + replay), `main.ts` (boot, camera follow with ported look-ahead, pickups, exit, kill-plane, debug handle `__weezy3d` incl. `setSimInput` for browser-driven verification).

### Verification (all green, browser-proven)
- `npm run build` passes: tsc clean + **340 tests** (327 + 13 new) + vite multipage build.
- Driven in-browser via `__weezy3d.setSimInput`: walk (vx=250 render px/s), **jump apex 74 design px from floor** (envelope match), token pickups count up, **full run → exit at x≈5562 → win card → Play again resets** — zero console errors.
- Screenshots confirmed: billboard Eloise with planted feet, platform shadows on carpet, bookshelf/wallpaper/window depth layers, glowing door light pool.

### Issues encountered
- **`node_modules/.bin` shims were all broken** (regular files instead of symlinks — artifact of this repo being a cp-copy of Weezy2). `rm -rf node_modules && npm install` fixed.
- **Phantom held ArrowRight from the preview browser** (repeat-only keydown stream, no initial press) made Eloise self-walk. Fixed in `input.ts` (repeats can't establish held state) — also a real-world robustness win.
- `justJumped`/`justLanded` were erased by physics substepping — flags now accumulate across substeps (caught by the new tests).

### Next session could
1. **Feel-playtest** the 3D level by hand (camera height/distance, fog density, light intensities are all tuneable knobs in `bedroomSet.ts`/`main.ts`).
2. Port enemies (dust bunnies as billboards + patrol physics) → levels 2–5 of Bedroom playable.
3. Level select / next-level chaining (`BEDROOM_LEVELS[1..4]` already encode; only enemy port blocks them).
4. Depth-of-field pass (EffectComposer + BokehPass) for the macro-photography blur the guide calls out; dust-mote particles in the lamp light.

---

## Session: 2026-06-07 (Phase 7.3.5 — Scripted Cutscene System; BUILT — engine + all 5 power intros)

**Goal met:** The **scripted cutscene system** (ROADMAP 7.3.5) is built — a reusable engine + all 5 power-intro cutscenes, replacing the static `PowerUnlockScene` modal. When Eloise meets a companion, a card dims the game, the companion bounces in and demonstrates its signature move on a little stage (looping tween), and the power is named — hybrid auto-play (beats auto-advance; tap hurries; `skip ▸` bails). Designed so ROADMAP 7.4 (intro) / 7.5 (ending) reuse the engine. Flow: brainstorm (visual companion, Direction C chosen) → spec → plan → subagent-driven execution (per-task implementer + two-stage spec/quality review, controller-verified on disk) → runtime smoke → final holistic review (SHIP IT). Spec: `docs/superpowers/specs/2026-06-07-cutscene-system-design.md`; plan: `docs/superpowers/plans/2026-06-07-cutscene-system.md`.

### Design decisions (the brainstorm)
- **Direction C — "card + live mini-demo"**: a modal framed card with a looping diorama where the companion really performs the move (over A: static motion arrows; B: in-world cinematic — rejected for coupling cutscenes to level geometry + physics). Fully decoupled from level geometry.
- **Hybrid auto-play pacing**: beats auto-advance by duration; a tap hurries to the next beat; a `skip ▸` button bails — meets "<10s, skippable" for non-readers.
- **Approach 1 — pure sequencer + tween-rendered beats**: a Phaser-free timeline controller (the bossFight pattern, unit-testable) + scripted demo tweens of the existing idle sprites (over a mini-physics sandbox or pre-baked spritesheets).
- **Scope**: engine + 5 power intros; 7.4/7.5 are separate specs reusing the engine via a `page`/`clear`/`fade` beat-kind seam; in-level button prompts kept.

### Completed (commits f728cd8 → 1d8fe6f, on main)
- **`src/systems/cutscene.ts` pure timeline controller** (TDD, 10 tests): `CutsceneBeat`/`CutsceneScript`/`DemoMotion` types + `init`/`advance`/`skipBeat`/`skipAll`/`currentBeat`; transitions exactly at duration boundaries, carries remainder across beats, done past the last beat. Phaser-free.
- **`src/config/cutscenes.ts` scripts** (TDD, 6 tests): `powerIntroScript(type)` builds the 5-beat shape (enter→caption→demo→title→hold, ~7s, ≤10s asserted) from `COMPANIONS`+`ABILITIES`+`COMPANION_LABELS`; exhaustive `POWER_INTRO_MOTION: Record<CompanionType, DemoMotion>`.
- **`src/scenes/CutsceneScene.ts`** (one-pass author): thin shell — additive card (elements persist across beats → builds up), companion bounce/fade entrance, 5 demo tweens (doubleHop/dash/climb/charge/glide), caption + title pop, `skip ▸` UI, SHUTDOWN teardown, `cutscene-complete` emit, `standalone` dev path, exhaustiveness `never`-guards on both render switches.
- **Integration**: `GameScene` `companion-collected` hook now launches `CutsceneScene` (identical pause/resume) and disables BOTH GameScene + UIScene keyboards during it; registered in `main.ts`; `eloiseLoadCutscene(type)` dev helper; `PowerUnlockScene.ts` deleted.
- **Docs**: ROADMAP 7.3.5 → `[x]`; CLAUDE.md Current Status entry; spec synced (dropped vestigial `loops`).

### Verification
`npm run build` green: **327 tests** (311 at session start → +16: 10 controller + 6 scripts), tsc clean, reachability lint over the 25 catalog levels unchanged, texture smoke, vite ok. **Runtime-smoked** (dev preview): all 5 intros render the card + correct companion sprite; full auto-advance→complete→standalone-return cycle (teddy); `skip ▸` bails; **zero console errors**. Final holistic review: **SHIP IT** (no Critical/Important).

### Issues Encountered (two real bugs caught in code review, both fixed)
- **ESC punched through the pause gate** — `GameScene` `keydown-ESC→togglePause` isn't gated on `paused`, so ESC during the cutscene resumed gameplay under the card. Fixed: cutscene ignores ESC + GameScene keyboard disabled during it.
- **UIScene's hidden pause-menu was navigable during the cutscene** — UIScene's UP/DOWN/ENTER are gated only on `GameState.paused` (true during the cutscene), so a blind DOWN+ENTER hit `returnToMainMenu()` and orphaned the cutscene on the menu. Fixed: disable UIScene's keyboard too. Saved as project memory `project_modal_scene_pause_keyboard_gotcha` (7.4/7.5 overlays will hit it).
- A code-review "infinite-loop on zero-duration beat" finding was a **false positive** (the loop's `beatIndex` advances every iteration) — vetted, not applied.

### Next Session Should
1. **Human feel-playtest the cutscenes** (the one thing automation can't do): `eloiseLoadCutscene("teddy"|"dog"|"cat"|"horse"|"flamingo")` or play to a companion. Tune the **companion sprite scale** (`0.09 * S` reads big for Teddy/Flamingo — head clips the card top — and small for Dog; varies per source PNG) and the **demo tween choreography/timing**.
2. **ROADMAP 7.4 (intro)** then **7.5 (ending)** — author content for the cutscene engine via the `page`/`clear`/`fade` beat-kind seam (each its own short spec). The ending already has all 5 companions on screen + `worldComplete` from the boss.
3. The real **tamed T-Rex sprite (7.2)** art pass, then **7.6 full playtest** → V1 to itch.io.

