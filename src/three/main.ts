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
import { animateExit, animateTokens, buildLevel } from "./level3d";
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
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.background ?? theme.fogColor);
  scene.fog = new THREE.Fog(theme.fogColor, theme.fogNear, theme.fogFar);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    120,
  );

  // ── World ───────────────────────────────────────────────────────────────
  const build = buildLevel(level, theme.surfaces);
  scene.add(build.group);

  const worldMinX = toWorldX(level.bounds.minX);
  const worldMaxX = toWorldX(level.bounds.maxX);
  const set = theme.buildSet(worldMinX, worldMaxX);
  scene.add(set.group);

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
      token.mesh.visible = true;
      token.mesh.scale.setScalar(1);
    }
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
  const camDist = 10.5;
  let camX = toWorldX(startSpawn.x);
  let camY = 2.8;

  function updateCamera(dtMs: number): void {
    const target = toWorldX(player.x) + lookAheadUnits * player.facing * 0.6;
    const halfView = Math.tan(((camera.fov / 2) * Math.PI) / 180) * camDist * camera.aspect;
    const clamped = Math.min(worldMaxX - halfView * 0.92, Math.max(worldMinX + halfView * 0.92, target));
    const ease = 1 - Math.exp(-dtMs / 220);
    camX += (clamped - camX) * ease;

    const targetY = 2.8 + Math.max(0, toWorldY(player.y)) * 0.35;
    camY += (targetY - camY) * ease * 0.8;

    camera.position.set(camX, camY, camDist);
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
        token.mesh.visible = false;
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
      if (hearts <= 0) {
        const cp = segmentAt(segments, player.x).spawn;
        player = createPlayerState(cp.x, cp.y);
        hearts = maxHearts;
        invincibleMs = 0;
        hud.setHearts(hearts, maxHearts);
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
        if (br) br.mesh.visible = false;
      }
      collectTokens();
      checkExit();
      checkKillPlane();
      updateEnemies(dtMs);
      checkCompanion();
      updateProgress();
    }

    playerView.update(player, dtMs, build.solids);
    enemiesView.update(enemies, dtMs);
    companionView?.update(elapsed);
    // Invincibility blink — flash the player billboard while invulnerable.
    // Force-visible once won: invincibleMs freezes while the sim is paused.
    playerView.group.visible = won || invincibleMs <= 0 || Math.floor(elapsed / 100) % 2 === 0;
    animateTokens(build.tokens, elapsed);
    animateExit(build, elapsed);
    set.update?.(dtMs, elapsed);
    updateCamera(dtMs);

    renderer.render(scene, camera);
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
