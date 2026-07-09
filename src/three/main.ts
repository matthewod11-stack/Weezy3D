import * as THREE from "three";
import { RENDER_SCALE, CAMERA_LOOK_AHEAD } from "../config/game";
import { parseLevelData, scaleLevelData } from "../types/level";
import { LEVEL_CATALOG } from "../levels/levelCatalog";
import { groupCatalogByArea, segmentAt, stitchLevels } from "./worldStitch";
import { toWorldLen, toWorldX, toWorldY } from "./coords";
import { KeyboardInput } from "./input";
import { GamepadInput } from "./gamepad";
import {
  createPlayerState,
  stepPlayer,
  touchesCircle,
  touchesRect,
  type PlayerState,
  type PhysRect,
} from "./physics3d";
import { abilitiesForArea } from "../config/gating";
import type { AbilityId } from "../config/abilities";
import { animateExit, animateTokens, buildLevel, TOKEN_POP_MS } from "./level3d";
import { createFxPool } from "./fx";
import {
  buildButterflies,
  buildPaintedBackdrop,
  hasPaintedBackdrop,
  type ButterflyField,
} from "./paintedBackdrop";
import { buildBedroomSet } from "./bedroomSet";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { themeForArea } from "./worldThemes";
import { PlayerView } from "./playerView";
import { Hud } from "./hud";
import { PHYSICS } from "../config/physics";
import { COMPANIONS } from "../config/companions";
import { createEnemyState, stepEnemies, type EnemyState } from "./enemy3d";
import { EnemiesView } from "./enemyView";
import { CompanionView } from "./companionView";

/**
 * Weezy3D entry — one CONTINUOUS world rendered as a side-scrolling Three.js
 * diorama, selected via ?world=bedroom|hallway|kitchen|familyRoom|backyard
 * (or a 0-based index). Each world's 5 catalog levels are stitched into a
 * single run at load time (worldStitch.ts); former level boundaries survive
 * only as pit-death checkpoints and HUD progress. ?level=n (0..24) is kept
 * as a back-compat alias: it loads the containing world, spawned at that
 * level's segment. Same level data, same physics constants as the 2D game.
 */

const TOKEN_PICKUP_RADIUS = 12 * RENDER_SCALE;

const WORLD_LABELS: Record<string, string> = {
  bedroom: "Bedroom",
  hallway: "Hallway",
  kitchen: "Kitchen",
  familyRoom: "Family Room",
  backyard: "Backyard",
};

async function boot(): Promise<void> {
  // ── World select: ?world= primary, ?level= back-compat ─────────────────
  const params = new URLSearchParams(window.location.search);
  const worlds = groupCatalogByArea(LEVEL_CATALOG);
  let worldIndex = 0;
  let startSegment = 0;
  const worldParam = params.get("world");
  const levelParam = params.get("level");
  if (worldParam !== null) {
    const byId = worlds.findIndex((w) => w.areaId === worldParam);
    const byIndex = Number.parseInt(worldParam, 10);
    worldIndex =
      byId >= 0
        ? byId
        : Math.min(Math.max(Number.isNaN(byIndex) ? 0 : byIndex, 0), worlds.length - 1);
  } else if (levelParam !== null) {
    const requested = Number.parseInt(levelParam, 10);
    const levelIndex = Math.min(
      Math.max(Number.isNaN(requested) ? 0 : requested, 0),
      LEVEL_CATALOG.length - 1,
    );
    worldIndex = worlds.findIndex(
      (w) => levelIndex >= w.firstIndex && levelIndex < w.firstIndex + w.entries.length,
    );
    startSegment = levelIndex - worlds[worldIndex]!.firstIndex;
  }
  const world = worlds[worldIndex]!;
  const worldLabel = WORLD_LABELS[world.areaId] ?? world.areaId;
  const theme = themeForArea(world.areaId);
  // Painted diorama is the DEFAULT look (approved 2026-07-08) wherever the
  // world has backdrop art: painted planes replace the procedural wall layer,
  // floor goes pink to match the art, and a gentle bloom pass frames the glow.
  // `?look=classic` restores the procedural look; worlds without paintings
  // (everything but bedroom so far) stay procedural automatically.
  const painted = params.get("look") !== "classic" && hasPaintedBackdrop(world.areaId);

  // ── Level data: same source + scaling as 2D, then stitched continuous ──
  const scaledLevels = world.entries.map((e) =>
    scaleLevelData(parseLevelData(e.raw), RENDER_SCALE),
  );
  const { level, segments } = stitchLevels(scaledLevels, `${world.areaId}-world`, worldLabel);
  const startSpawn = segments[startSegment]?.spawn ?? level.spawn;

  // ── Renderer / scene ────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap is deprecated in three r184 (falls back + warns every
  // frame); soft storybook edges come from sun.shadow.radius below instead.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (painted) {
    // Rosy palette + fog pushed out so the mid-ground keeps its saturation
    // against the (fog-free) painted backdrop. fogNear stays ≥ 12.
    scene.background = new THREE.Color(0xf6dfe8);
    scene.fog = new THREE.Fog(0xf6dfe8, theme.fogNear + 6, theme.fogFar + 10);
  } else {
    scene.background = new THREE.Color(theme.background ?? theme.fogColor);
    scene.fog = new THREE.Fog(theme.fogColor, theme.fogNear, theme.fogFar);
  }

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    120,
  );

  // Painted mode: gentle bloom so fairy lights / lamp / exit door actually
  // glow. Threshold 0.85 keeps the pass off the mid-tones (and the cost low).
  let composer: EffectComposer | null = null;
  if (painted) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Tuned down from 0.35/0.5/0.85 after playtest: the lamp bloomed into a
    // fireball and Eloise's white dress caught the pass. Only true highlights
    // (fairy lights, glow disc, exit halo) should clear the threshold now.
    composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.22,
        0.4,
        0.92,
      ),
    );
  }

  // ── World ───────────────────────────────────────────────────────────────
  // Painted mode: pink shag floor to match the backdrop paintings.
  const surfaces = painted
    ? {
        ...theme.surfaces,
        floorBase: "#f2c3d6", // pink shag to match the backdrop paintings
        platformColor: 0xf0cf9a, // honey wood — harmonizes with painted shelves
        lipColor: 0xc08f4e,
        plush: true, // Wonder-style quilt terrain — the platform is the art
      }
    : theme.surfaces;
  const build = buildLevel(level, surfaces);
  scene.add(build.group);
  let butterflies: ButterflyField | null = null;
  if (painted) {
    scene.add(buildPaintedBackdrop(world.areaId, segments));
    butterflies = buildButterflies(toWorldX(level.bounds.minX), toWorldX(level.bounds.maxX));
    scene.add(butterflies.group);
  }

  // Shared one-shot particle pool (landing dust, token sparkle, smash debris,
  // stomp poofs) — ONE THREE.Points for the whole world per the perf budget.
  const fx = createFxPool();
  scene.add(fx.points);

  const worldMinX = toWorldX(level.bounds.minX);
  const worldMaxX = toWorldX(level.bounds.maxX);
  // World-unit x-ranges of real floor (thickness tell matches level3d's) —
  // dressing must not float over pits (2026-07-02 playtest finding).
  const floorRanges: Array<[number, number]> = level.platforms
    .filter((p) => p.h >= 55)
    .map((p) => [toWorldX(p.x), toWorldX(p.x + p.w)]);
  const set =
    world.areaId === "bedroom"
      ? buildBedroomSet(worldMinX, worldMaxX, { paintedWall: painted, floors: floorRanges })
      : theme.buildSet(worldMinX, worldMaxX);
  scene.add(set.group);
  // Soft storybook shadow edges (the r184-sanctioned lever — see renderer note).
  set.sun.shadow.radius = 4;

  const playerView = await PlayerView.load();
  scene.add(playerView.group);

  // ── Enemies + companion cameo ─────────────────────────────────────────────
  let enemies: EnemyState[] = level.enemies.map(createEnemyState);
  const enemiesView = await EnemiesView.load(enemies);
  scene.add(enemiesView.group);

  const companionSpawn = level.companion ?? null;
  const companionView = companionSpawn
    ? await CompanionView.load(companionSpawn.type, companionSpawn.x, companionSpawn.y)
    : null;
  if (companionView) scene.add(companionView.group);
  let companionMet = false;

  // ── Simulation state ────────────────────────────────────────────────────
  let player: PlayerState = createPlayerState(startSpawn.x, startSpawn.y);
  let collected = 0;
  let won = false;
  let segmentIndex = -1; // forces the first HUD progress update

  let hearts = 3;
  let maxHearts = 3;
  let invincibleMs = 0;

  // ── Powers (3D-local, like hearts — NOT the GameState singleton) ──────────
  // Seeded from the area's expected loadout; checkCompanion() grants the home
  // companion's power on pickup. breakables is the destructible world state the
  // sim mutates (nulled on smash) — kept 1:1 with build.breakables by order.
  let unlocked: Set<AbilityId> = abilitiesForArea(world.areaId);
  const freshBreakables = (): (PhysRect | null)[] =>
    (level.breakables ?? []).map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  let breakables: (PhysRect | null)[] = freshBreakables();

  const input = new KeyboardInput();
  input.attach();
  // Controller sibling of the keyboard — OR-merged each frame (see frame()).
  // Standard layout: D-pad / left stick move, bottom face button jumps.
  const gamepad = new GamepadInput();

  const nextWorld = worlds[worldIndex + 1];
  const hud = new Hud(
    () => resetLevel(),
    nextWorld
      ? () => {
          window.location.search = `?world=${nextWorld.areaId}`;
        }
      : null,
    { winTitle: "World Complete!", nextLabel: "Next world →" },
  );
  hud.setTokens(0, level.tokens.length);
  hud.setHearts(hearts, maxHearts);

  function resetLevel(): void {
    player = createPlayerState(startSpawn.x, startSpawn.y);
    collected = 0;
    won = false;
    segmentIndex = -1;
    for (const token of build.tokens) {
      token.collected = false;
      token.popMsRemaining = 0;
      token.mesh.visible = true;
      token.mesh.scale.setScalar(1);
      (((token.mesh as THREE.Mesh).material) as THREE.MeshLambertMaterial).opacity = 1;
    }
    fx.reset();
    hud.setTokens(0, level.tokens.length);
    enemies = level.enemies.map(createEnemyState);
    hearts = 3;
    maxHearts = 3;
    invincibleMs = 0;
    companionMet = false;
    companionView?.setUncollected();
    hud.setHearts(hearts, maxHearts);
    // Power state: re-seed the loadout, rebuild the destructible world, and
    // re-show every breakable mesh (gotcha #12 — symmetric show path for the
    // smash's hide, else a "Play again" leaves rebuilt barricades invisible).
    unlocked = abilitiesForArea(world.areaId);
    breakables = freshBreakables();
    for (const br of build.breakables) br.mesh.visible = true;
    playerView.group.visible = true;
    input.setEnabled(true);
    gamepad.setEnabled(true);
  }

  // ── Camera follow (ported look-ahead feel) ──────────────────────────────
  const lookAheadUnits = toWorldLen(CAMERA_LOOK_AHEAD);
  let camDist = 10.5; // eases toward 8.5 on win — a storybook push-in
  let camX = toWorldX(startSpawn.x);
  let camY = 2.8;
  // Event channel: decaying micro-shake (smash, damage) + dash FOV kick.
  // Never touches camX/camY, so the follow ease is untouched. Deterministic
  // (sine-driven, clocked by dtMs) per the no-Math.random rule.
  let shakeMs = 0;
  let shakeAmp = 0;
  let shakeClock = 0;
  function triggerShake(amp: number, ms: number): void {
    shakeAmp = Math.max(shakeAmp, amp);
    shakeMs = Math.max(shakeMs, ms);
  }

  function updateCamera(dtMs: number): void {
    const target = toWorldX(player.x) + lookAheadUnits * player.facing * 0.6;
    const halfView = Math.tan(((camera.fov / 2) * Math.PI) / 180) * camDist * camera.aspect;
    const clamped = Math.min(worldMaxX - halfView * 0.92, Math.max(worldMinX + halfView * 0.92, target));
    const ease = 1 - Math.exp(-dtMs / 220);
    camX += (clamped - camX) * ease;

    // Follow Eloise DOWN into pits (a child loses the character otherwise);
    // -7 keeps the frame from chasing her past the kill plane.
    const targetY = 2.8 + Math.max(-7, toWorldY(player.y)) * 0.35;
    camY += (targetY - camY) * ease * 0.8;

    // Dash FOV kick: a whisper of speed-feel, snaps back when the dash ends.
    const targetFov = player.dashMsRemaining > 0 ? 44.5 : 42;
    if (Math.abs(camera.fov - targetFov) > 0.02) {
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-dtMs / 90));
      camera.updateProjectionMatrix();
    }
    // Win push-in.
    const targetDist = won ? 8.5 : 10.5;
    camDist += (targetDist - camDist) * (1 - Math.exp(-dtMs / 450));

    camera.position.set(camX, camY, camDist);
    if (shakeMs > 0) {
      shakeMs -= dtMs;
      shakeClock += dtMs;
      const falloff = Math.max(0, shakeMs) / 180;
      camera.position.x += Math.sin(shakeClock * 0.09) * shakeAmp * falloff;
      camera.position.y += Math.cos(shakeClock * 0.117) * shakeAmp * falloff * 0.7;
      if (shakeMs <= 0) shakeAmp = 0;
    }
    camera.lookAt(camX, camY * 0.62 + 0.9, 0);

    // Keep the shadow camera centered on the action.
    set.sunTarget.position.set(toWorldX(player.x), 0, 0);
    set.sun.position.set(
      toWorldX(player.x) + set.sunOffset.x,
      set.sunOffset.y,
      set.sunOffset.z,
    );
  }

  // ── Pickups / exit / kill plane ─────────────────────────────────────────
  function collectTokens(): void {
    for (const token of build.tokens) {
      if (token.collected) continue;
      if (touchesCircle(player, token.x, token.y, TOKEN_PICKUP_RADIUS)) {
        token.collected = true;
        token.popMsRemaining = TOKEN_POP_MS; // pop tween runs in animateTokens
        fx.spawnBurst(toWorldX(token.x), toWorldY(token.y), {
          count: 12,
          color: 0xf6c945,
          color2: 0xfff2c0,
          speed: 1.6,
          upBias: 1.2,
          gravity: 2.5,
          lifeMs: 450,
          size: 0.08,
        });
        collected += 1;
        hud.setTokens(collected, level.tokens.length);
      }
    }
  }

  function checkExit(): void {
    if (won) return;
    if (touchesRect(player, build.exitZone)) {
      won = true;
      input.setEnabled(false);
      gamepad.setEnabled(false);
      hud.showWin(collected);
    }
  }

  function checkKillPlane(): void {
    if (player.y > level.killY) {
      // Continuous-world checkpoint: respawn at the start of the segment
      // (former catalog level) the player died in, not the world start.
      const checkpoint = segmentAt(segments, player.x).spawn;
      player = createPlayerState(checkpoint.x, checkpoint.y);
      invincibleMs = 0; // pit respawn clears damage grace (matches hearts-death path)
      hud.flashFade("#2c1c10", 520); // dusk fade — softens the teleport cut
    }
  }

  function companionPickupBox(c: { x: number; y: number }) {
    const pad = 10 * RENDER_SCALE;
    const h = 20 * RENDER_SCALE;
    return { x: c.x - pad, y: c.y - h, w: pad * 2, h };
  }

  function updateEnemies(dtMs: number): void {
    const ev = stepEnemies(enemies, player, dtMs, build.solids);
    // Defensive: an enemy whose patrol band spans a pit falls forever —
    // retire it once it's clearly below the kill plane (review finding).
    for (const e of enemies) {
      if (!e.defeated && e.y > level.killY + 400) e.defeated = true;
    }
    if (ev.stomps.length > 0) {
      player = { ...player, vy: PHYSICS.STOMP_BOUNCE_VY };
    }
    if (ev.damaged && invincibleMs <= 0) {
      hearts -= 1;
      invincibleMs = PHYSICS.INVINCIBILITY_MS;
      hud.setHearts(hearts, maxHearts);
      triggerShake(0.06, 120);
      if (hearts <= 0) {
        const cp = segmentAt(segments, player.x).spawn;
        player = createPlayerState(cp.x, cp.y);
        hearts = maxHearts;
        invincibleMs = 0;
        hud.setHearts(hearts, maxHearts);
        hud.flashFade("rgba(150, 45, 45, 0.9)", 560);
      }
    }
    if (invincibleMs > 0) invincibleMs -= dtMs;
  }

  function checkCompanion(): void {
    if (!companionSpawn || companionMet) return;
    if (touchesRect(player, companionPickupBox(companionSpawn))) {
      companionMet = true;
      unlocked.add(COMPANIONS[companionSpawn.type].grants);
      const bonus = COMPANIONS[companionSpawn.type].heartBonus ?? 0;
      maxHearts += bonus;
      hearts = Math.min(hearts + bonus, maxHearts);
      hud.setHearts(hearts, maxHearts);
      const name = companionSpawn.type[0]!.toUpperCase() + companionSpawn.type.slice(1);
      hud.showCaption(`You met ${name}!`);
      companionView?.setCollected();
      fx.spawnBurst(toWorldX(companionSpawn.x), toWorldY(companionSpawn.y), {
        count: 14,
        color: 0xff9bb0,
        color2: 0xfff2c0,
        speed: 1.8,
        upBias: 1.4,
        gravity: 2.0,
        lifeMs: 550,
        size: 0.1,
      });
    }
  }

  /** Keep the HUD's "Bedroom · 2 / 5" progress in sync with the player. */
  function updateProgress(): void {
    const index = segments.indexOf(segmentAt(segments, player.x));
    if (index !== segmentIndex) {
      segmentIndex = index;
      hud.setProgress(`${worldLabel} · ${index + 1} / ${segments.length}`);
    }
  }

  // ── Resize ──────────────────────────────────────────────────────────────
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer?.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Debug handle (drives browser-based verification) ────────────────────
  let simInput: Partial<ReturnType<KeyboardInput["readFrame"]>> | null = null;
  (window as unknown as Record<string, unknown>).__weezy3d = {
    getPlayer: () => ({ ...player }),
    getCollected: () => collected,
    getHearts: () => ({ hearts, maxHearts }),
    enemyStates: () => enemies.map((e) => ({ ...e })),
    companionMet: () => companionMet,
    companionAt: () => (companionSpawn ? { ...companionSpawn } : null),
    hasWon: () => won,
    /** Live gamepad introspection — drives the in-browser mapping tester.
     *  Returns null until a pad is connected AND a button has been pressed
     *  (browsers withhold getGamepads() until first interaction). */
    gamepad: () => gamepad.snapshot(),
    gamepadConnected: () => gamepad.connected(),
    teleport: (x: number, y: number) => {
      player = { ...player, x, y, vx: 0, vy: 0 };
    },
    /** Test override: merges OR-wise with the keyboard each frame. */
    setSimInput: (value: typeof simInput) => {
      simInput = value;
    },
    /** Skip the camera ease — verification screenshots without the settle wait. */
    snapCamera: () => {
      camX = toWorldX(player.x);
      camY = 2.8 + Math.max(0, toWorldY(player.y)) * 0.35;
    },
    reset: resetLevel,
    /** The live scene graph — lets verification scripts query lights/materials numerically. */
    scene,
    levelId: level.id,
    worldIndex,
    areaId: world.areaId,
    bounds: { ...level.bounds },
    tokenCount: level.tokens.length,
    /** Continuous-world introspection: segment boundaries + checkpoints. */
    segments: segments.map((s) => ({ ...s, spawn: { ...s.spawn } })),
    currentSegment: () => segmentAt(segments, player.x).id,
    /** Teleport to a segment's checkpoint spawn (0-based). */
    jumpToSegment: (i: number) => {
      const seg = segments[Math.min(Math.max(i, 0), segments.length - 1)]!;
      player = createPlayerState(seg.spawn.x, seg.spawn.y);
    },
    /** Power introspection / grant — drives in-browser power verification. */
    unlockedAbilities: () => [...unlocked],
    grantAbility: (id: AbilityId) => unlocked.add(id),
    /** Live particle count — drives fx verification + the scene census. */
    fxLive: () => fx.liveCount(),
    /** Manually kick the camera shake — verification without taking damage. */
    shake: (amp = 0.12, ms = 180) => triggerShake(amp, ms),
  };

  // ── Main loop ───────────────────────────────────────────────────────────
  let last = performance.now();
  let elapsed = 0;
  let padToastShown = false;

  function frame(now: number): void {
    const dtMs = Math.min(50, now - last);
    last = now;
    elapsed += dtMs;

    // Browsers only expose a pad after its first button press, so this fires
    // the moment the player actually starts using the controller.
    if (!padToastShown && gamepad.connected()) {
      padToastShown = true;
      hud.showCaption("🎮 Controller connected!");
    }

    // Keyboard + gamepad merge OR-wise: either device can drive any action,
    // and each owns its own jump press/release edges this frame.
    const keys = input.readFrame();
    const pad = gamepad.readFrame();
    const keysOrPad = {
      left: keys.left || pad.left,
      right: keys.right || pad.right,
      jumpPressed: keys.jumpPressed || pad.jumpPressed,
      jumpReleased: keys.jumpReleased || pad.jumpReleased,
      up: keys.up || pad.up,
      powerPressed: keys.powerPressed || pad.powerPressed,
      powerHeld: keys.powerHeld || pad.powerHeld,
    };
    const frameInput = simInput
      ? {
          left: keysOrPad.left || !!simInput.left,
          right: keysOrPad.right || !!simInput.right,
          jumpPressed: keysOrPad.jumpPressed || !!simInput.jumpPressed,
          jumpReleased: keysOrPad.jumpReleased || !!simInput.jumpReleased,
          up: keysOrPad.up || !!simInput.up,
          powerPressed: keysOrPad.powerPressed || !!simInput.powerPressed,
          powerHeld: keysOrPad.powerHeld || !!simInput.powerHeld,
        }
      : keysOrPad;
    if (simInput) {
      // Edge flags are one-shot — consume them after a frame (jump + power).
      simInput = { ...simInput, jumpPressed: false, jumpReleased: false, powerPressed: false };
    }
    if (!won) {
      player = stepPlayer(player, frameInput, dtMs, build.solids, {
        unlocked,
        climbWalls: level.climbWalls ?? [],
        breakables,
      });
      if (player.justSmashed >= 0) {
        // The sim already nulled breakables[justSmashed]; hide its mesh so the
        // barricade visually disappears. resetLevel re-shows all (gotcha #12).
        const br = build.breakables[player.justSmashed];
        if (br) {
          br.mesh.visible = false;
          fx.spawnBurst(br.mesh.position.x, br.mesh.position.y, {
            count: 18,
            color: 0xb07a3c,
            color2: 0x6e4a20,
            speed: 3.2,
            upBias: 1.6,
            gravity: 7,
            lifeMs: 650,
            size: 0.11,
          });
          triggerShake(0.12, 180);
        }
      }
      // Movement juice — consume the sim's one-frame flags at Eloise's feet.
      if (player.justLanded) {
        fx.spawnBurst(toWorldX(player.x), toWorldY(player.y), {
          count: 7,
          color: 0xcbb59a,
          speed: 1.1,
          upBias: 0.35,
          gravity: 2.2,
          lifeMs: 380,
          size: 0.07,
          spread: 0.24,
        });
      }
      if (player.justAirJumped) {
        fx.spawnBurst(toWorldX(player.x), toWorldY(player.y), {
          count: 10,
          color: 0xfff2c0,
          color2: 0x9fd8ff,
          speed: 2.0,
          upBias: 0.1,
          gravity: 1.2,
          lifeMs: 320,
          size: 0.08,
        });
      }
      if (player.justDashed) {
        fx.spawnBurst(toWorldX(player.x) - player.facing * 0.3, toWorldY(player.y) + 0.4, {
          count: 8,
          color: 0xffffff,
          speed: 1.4,
          upBias: 0.3,
          gravity: 0.8,
          lifeMs: 260,
          size: 0.07,
        });
      }
      collectTokens();
      checkExit();
      checkKillPlane();
      updateEnemies(dtMs);
      checkCompanion();
      updateProgress();
    }

    playerView.update(player, dtMs, build.solids);
    enemiesView.update(enemies, dtMs, player.x);
    // Defeated enemies poof — the view runs the squash, we spawn the dust.
    for (const d of enemiesView.drainDefeatEvents()) {
      fx.spawnBurst(toWorldX(d.x), toWorldY(d.y), {
        count: 10,
        color: 0xdccbb8,
        speed: 1.8,
        upBias: 0.8,
        gravity: 2.0,
        lifeMs: 420,
        size: 0.09,
      });
    }
    companionView?.update(elapsed);
    if (companionMet && companionView) {
      companionView.followUpdate({ x: player.x, y: player.y, facing: player.facing }, dtMs);
    }
    // Invincibility — sprite-only opacity pulse + hurt tint (the old whole-group
    // blink flickered the shadow blob too). Won forces the normal look.
    playerView.setInvincible(
      !won && invincibleMs > 0,
      PHYSICS.INVINCIBILITY_MS - Math.max(0, invincibleMs),
    );
    animateTokens(build.tokens, elapsed, dtMs);
    animateExit(build, elapsed);
    fx.update(dtMs);
    set.update?.(dtMs, elapsed);
    butterflies?.update(elapsed);
    updateCamera(dtMs);

    if (composer) composer.render();
    else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error("[weezy3d] boot failed:", err);
  const msg = document.createElement("pre");
  msg.textContent = `Boot failed: ${String(err)}`;
  msg.style.cssText = "color:#a33;padding:24px;font-size:16px";
  document.body.appendChild(msg);
});
