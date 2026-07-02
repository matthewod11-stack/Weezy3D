# Visual Immersion — Level 1 (Bedroom) Proof Point

> **Session 2026-07-01 (Fable 5, ultracode).** Deep 7-agent assessment of the game's visuals/animation (116 findings) → this plan. Goal: make the Bedroom world feel like the storybook reference art (`docs/reference-art/Bedroom.jpg`) **without repeating the candy-texture mistake** — immersion comes from geometry density, lighting drama, animation, and event feedback, all inside the paid-for perf budget (≤6 lights/world, ONE THREE.Points per particle field, clutter never casts shadows, seeded LCG only).

## Assessment verdict (condensed)

Full findings: workflow `wf_40b03344-a60`. Three root causes of the current flatness:

1. **Juice hooks emitted, never consumed.** `physics3d.ts` already outputs `justLanded/justJumped/justAirJumped/justDashed`; no view reads them. Dash/glide/climb/double-jump all render as the same static jump sprite. Every discrete event (token, smash, stomp, death, respawn) is an instant `visible=false` or teleport.
2. **Bedroom dressing never rescaled for the stitched world.** Fixed-fraction placement across ~450 units → whole screens of bare polka-dot wallpaper (verified live at segment 4). Cadence dressing was lost in the candy revert (§5.6 #7 keeps the learning). Bedroom is the only world with no animated hero light.
3. **Zero ambient life + wasted perf budget.** 0 particles in the whole game; bedroom/hallway/backyard have no `set.update` hook; 270 shadow casters (tiny clutter violating §5.6 9c) and 8 lights (budget: ~6).

Critic adds: camera vertical follow clamps at floor level (Eloise falls out of frame before pit death), world hand-off is a hard page reload, controls hint never teaches the power button, HUD uses OS emoji.

## Scope: what ships in this proof (Bedroom end-to-end)

### Track 1 — Global substrate (benefits all worlds, proven in bedroom)
- `src/three/fx.ts` (NEW): pooled one-shot particle system — ONE `THREE.Points` (~256 verts, vertex colors, additive, no shadows), `spawnBurst(x, y, opts)` + `update(dt)`. Seeded LCG. Unit-tested pure core.
- Renderer: `PCFSoftShadowMap` (one-liner), storybook vignette as zero-GPU CSS radial-gradient overlay.
- Camera: event channel (decaying micro-shake on smash/damage, small FOV kick while dashing, win dolly-in), **vertical follow into pits** fix.
- Death/respawn: HUD fade-through overlay (dusk for pit, soft red for hearts) instead of instant teleport.

### Track 2 — Character & animation (transform-based; no new art required)
- `physics3d.ts`: **additive-only** `climbing`/`gliding` booleans on `PlayerState` (already computed internally, currently discarded). All existing feel tests stay byte-green; +2 flag tests.
- `playerView.ts`: squash-and-stretch tween machine consuming the hooks — land squash (1.18, 0.82 → 1,1 ~130ms), jump stretch, sharper double-jump pulse; dash tilt (−facing·0.15 rad + 1.2,0.9 stretch); glide gentle sway + slowed fall pose; climb lean-in with frozen walk clock; idle breathing (±1.5% scale.y sine) ; turn-around flip tween (~80ms through the sign); hurt = sprite-only opacity/tint pulse (shadow blob stays steady).
- `enemyView.ts`: stomp defeat = ~160ms pancake squash + poof (fx burst) instead of instant hide; static enemies (ant/dustMite) get seeded micro-wiggle; wire existing `*_attack.png` frames as proximity telegraphs.
- `billboard.ts`: extract `makeShadowBlob()`; enemies + companions get shadow blobs (fixes floating).
- `companionView.ts`: collected companion trails behind Eloise (lerp toward `player.x − facing·0.9`, walk-frame alternation) — Teddy follows you through the bedroom.
- Token collect: pop tween (scale 1→1.6 + fade ~180ms) + sparkle burst + HUD count pulse (closes §5.5 backlog).

### Track 3 — Bedroom set rework (`bedroomSet.ts`)
- **Interval (cadence) dressing** re-implemented procedurally per §5.6 #7: window/wall-art every ~55–65 units, mid-ground landmark every ~35–45 from a rotation, pit-aware floor furniture, foreground crumb species (crayons/marbles/jacks/domino) every ~25–30 at z=+1.9, all seeded.
- **Hero landmark builders** from the scenery library: crib (bars + slowly-rotating mobile via new `update` hook), toy chest, teddy silhouette — per-segment variation so each fifth of the world reads distinct.
- **Visible hero lamp** (nightstand + shade geometry + inner glow disc) *repurposing* the existing off-screen lamp PointLight — bedroom's answer to the stove/fireplace, with breathing glow via `update`.
- **Window treatment:** slanted additive light-shaft planes (zero lights), curtains, and ONE drifting dust-mote `THREE.Points` field in the light pools.
- **Budget compliance:** consolidate to ≤6 lights; strip `castShadow` from clutter and `receiveShadow` from the far wall; bedroom-specific floor tint + rag rug accent.
- Exit door: additive glow sprite (bloom-without-bloom).

### Explicitly OUT of this proof (queued for approval after)
- Painted far-plane backgrounds (24 orphaned 1024px paintings on disk) — cheap to hang, but adjacent to the reverted candy direction; **user judges** on a flagged experiment before it ships.
- New Eloise sprite frames (dash/glide/climb/hurt/celebrate) via the intact NanoBanana anchor pipeline — phase 2; transforms fake these states first.
- Audio (WebAudio synth blips) — huge feel win, out of visual scope tonight.
- DoF/bloom EffectComposer pass (perf-risky; vignette + glow sprites approximate it), in-page world hand-off transition, HUD art pass, other 4 worlds' cadence dressing (the cookbook covers them).

## Acceptance criteria
1. `npm run build` green (tsc + full Vitest suite; physics feel tests unchanged).
2. Browser-verified at 1440×810: screenshots at ≥3 bedroom segments show no bare screens; every segment has a landmark.
3. Scene census: lights ≤ 6, shadow casters cut ≥50% (from 270), ≥1 THREE.Points active, 60fps steady (no candy-style chop).
4. Numeric probes: landing squash scale dip observed, particle burst on token collect, camera shake on damage.
5. Cookbook section appended to the playbook so worlds 2–5 replicate the recipe after user approval.

## Execution
Parallel subagents with disjoint file ownership (fx.ts / physics3d.ts / playerView.ts / enemy+companion+billboard / bedroomSet.ts), then integration wiring in `main.ts`/`hud.ts`/`level3d.ts` + browser verification inline. Branch: `feat/visual-immersion-l1`.
