import Phaser from "phaser";
import { PLANK_TEXTURE } from "./BootScene";
import { CAMERA_LOOK_AHEAD, RENDER_SCALE } from "../config/game";
import { CAMERA_LOOK_UP } from "../config/backgrounds";
import { PLATFORM_TINT } from "../config/platforms";
import { Companion } from "../entities/Companion";
import { COMPANIONS } from "../config/companions";
import { TEDDY_WALK_ANIM } from "../config/textures";
import { DustBunny } from "../entities/DustBunny";
import { Spider } from "../entities/Spider";
import { Ant } from "../entities/Ant";
import { DustMite } from "../entities/DustMite";
import { Enemy } from "../entities/Enemy";
import { Player } from "../entities/Player";
import { Token } from "../entities/Token";
import { getLevelEntry } from "../levels/levelCatalog";
import { GameState } from "../state/GameState";
import { buildBlueprintGrid } from "../systems/BlueprintGrid";
import { parseLevelData, scaleLevelData, type LevelData } from "../types/level";
import type { CompanionType } from "../design/levelSketches";
import { powerIntroScript } from "../config/cutscenes";

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private uiLaunched = false;
  private levelBackdrop: Phaser.GameObjects.GameObject[] = [];
  private platformGroup!: Phaser.Physics.Arcade.StaticGroup;
  private enemies: Enemy[] = [];
  private tokens: Token[] = [];
  private exitZone?: Phaser.GameObjects.Rectangle;
  private climbWallVisuals: Phaser.GameObjects.GameObject[] = [];
  private breakableGroup!: Phaser.Physics.Arcade.StaticGroup;
  /** Indexed by data.breakables order; null once smashed. */
  private breakableTiles: (Phaser.GameObjects.GameObject | null)[] = [];
  private companion: Companion | null = null;
  private levelData!: LevelData;
  private colliders: Phaser.Physics.Arcade.Collider[] = [];
  private overlaps: Phaser.Physics.Arcade.Collider[] = [];
  private exitCooldown = false;
  private pitRespawnLock = false;

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    // Phaser recycles the scene instance across stop()/start() — instance fields
    // persist. Tear down per-run state on shutdown so a replayed run rebuilds.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);

    this.physics.world.gravity.y = 0;
    this.platformGroup = this.physics.add.staticGroup();
    this.breakableGroup = this.physics.add.staticGroup();

    const kb = this.input.keyboard;
    if (kb) {
      kb.enabled = true;
      kb.addCapture([
        Phaser.Input.Keyboard.KeyCodes.W,
        Phaser.Input.Keyboard.KeyCodes.A,
        Phaser.Input.Keyboard.KeyCodes.S,
        Phaser.Input.Keyboard.KeyCodes.D,
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.X,
      ]);
    }

    this.input.on("pointerdown", () => {
      this.game.canvas?.focus();
    });

    this.input.keyboard?.on("keydown-ESC", () => {
      this.togglePause();
    });

    this.events.on("request-resume", () => {
      if (GameState.get().paused) {
        this.togglePause();
      }
    });

    this.events.on("player-died", () => {
      this.onPlayerDied();
    });

    this.events.on("player-landed", (pos: { x: number; y: number }) => {
      this.spawnLandingDust(pos.x, pos.y);
    });

    this.events.on("companion-collected", (info: { type: CompanionType }) => {
      this.physics.world.pause();
      // Halt update() so Player.tick stops reading input, AND disable keyboard on
      // BOTH gameplay scenes so neither ESC (GameScene = pause) nor the hidden
      // pause-menu nav (UIScene, gated on GameState.paused) can fire under the
      // cutscene. GameScene + UIScene stay active behind the launched CutsceneScene.
      GameState.get().paused = true;
      const uiKb = this.scene.get("UIScene").input.keyboard;
      if (this.input.keyboard) this.input.keyboard.enabled = false;
      if (uiKb) uiKb.enabled = false;
      const cutscene = this.scene.get("CutsceneScene");
      cutscene.events.once("cutscene-complete", () => {
        this.scene.stop("CutsceneScene");
        GameState.get().paused = false;
        if (this.input.keyboard) this.input.keyboard.enabled = true;
        if (uiKb) uiKb.enabled = true;
        this.physics.world.resume();
        this.game.canvas?.focus();
      });
      this.scene.launch("CutsceneScene", { script: powerIntroScript(info.type) });
    });

    this.beginLevel(GameState.get().levelIndex);

    if (!this.uiLaunched) {
      this.uiLaunched = true;
      this.scene.launch("UIScene");
    }
  }

  /**
   * Per-run teardown, paired with create() via the SHUTDOWN event.
   *
   * Phaser's scene shutdown ALREADY destroys every GameObject on the
   * display/update lists and every physics group — do NOT re-destroy them here
   * (doing so touches groups mid-teardown → "reading 'size'" crash). What Phaser
   * does NOT do on stop() is null your instance *references* or remove custom
   * listeners on scene.events. So a recycled instance would otherwise inherit:
   *   - a stale `player` ref to a destroyed sprite → loadLevel's `if (!player)`
   *     stays falsy, calls respawnAt on a dead object → Eloise frozen;
   *   - `uiLaunched === true` → HUD never relaunches;
   *   - duplicate `this.events.on(...)` handlers stacking each run.
   * Reset exactly those things so the next create() rebuilds from a clean slate.
   */
  private teardown(): void {
    this.events.off("request-resume");
    this.events.off("player-died");
    this.events.off("player-landed");
    this.events.off("companion-collected");

    // Drop references to objects Phaser is destroying; don't destroy them again.
    this.player = undefined as unknown as Player;
    this.companion = null;
    this.exitZone = undefined;
    this.enemies = [];
    this.tokens = [];
    this.colliders = [];
    this.overlaps = [];
    this.levelBackdrop = [];
    this.climbWallVisuals = [];
    this.breakableTiles = [];

    this.uiLaunched = false;
    this.exitCooldown = false;
    this.pitRespawnLock = false;
  }

  update(_time: number, delta: number): void {
    const state = GameState.get();
    if (state.paused || state.worldComplete || !this.player || !this.levelData) {
      return;
    }

    this.player.tick(delta);

    for (const e of this.enemies) {
      e.tick(delta);
    }

    this.companion?.pushPlayerPosition(this.player.x, this.player.y);

    if (
      !this.pitRespawnLock &&
      !this.player.isDying() &&
      !this.player.isInPitGrace() &&
      this.player.y > this.levelData.killY
    ) {
      this.handlePitFall();
    }

    const vx = this.player.body.velocity.x;
    const look = vx === 0 ? 0 : Math.sign(vx) * CAMERA_LOOK_AHEAD;
    this.cameras.main.setFollowOffset(look, -CAMERA_LOOK_UP);

    this.checkCompanionPickup();
    this.preloadUpcomingLevel();
  }

  private togglePause(): void {
    const state = GameState.get();
    state.paused = !state.paused;
    if (state.paused) {
      this.physics.world.pause();
    } else {
      this.physics.world.resume();
    }
    this.events.emit("pause-changed");
  }

  private onPlayerDied(): void {
    const state = GameState.get();
    this.player.beginDeathAnimation();
    this.tweens.add({
      targets: this.player,
      angle: 720,
      scaleX: 0,
      scaleY: 0,
      duration: 800,
      ease: "Cubic.easeIn",
      onComplete: () => {
        this.player.endDeathAnimation();
        this.player.respawnAt(state.respawnX, state.respawnY);
        this.companion?.resetHistoryNear(state.respawnX, state.respawnY);
      },
    });
  }

  private handlePitFall(): void {
    const state = GameState.get();
    this.pitRespawnLock = true;
    const lift = 4 * RENDER_SCALE;
    this.player.respawnFromPit(state.respawnX, state.respawnY - lift);
    this.companion?.resetHistoryNear(state.respawnX, state.respawnY - lift);
    this.time.delayedCall(100, () => {
      this.pitRespawnLock = false;
    });
  }

  private loadLevel(index: number): void {
    const entry = getLevelEntry(index);
    if (!entry) {
      return;
    }
    const data = scaleLevelData(parseLevelData(entry.raw), RENDER_SCALE);
    const state = GameState.get();
    state.levelIndex = index;
    state.persist();
    this.buildLevel(data);
  }

  /** Build all scene geometry/entities/camera for a level's data. */
  private buildLevel(data: LevelData): void {
    this.levelData = data;
    const state = GameState.get();
    state.respawnX = data.spawn.x;
    state.respawnY = data.spawn.y;

    const nextBackdrop = this.makeLevelBackdrop(data.bounds);
    for (const obj of this.levelBackdrop) {
      obj.destroy();
    }
    this.clearLevelEntities();
    this.levelBackdrop = nextBackdrop;

    const platformTint = Phaser.Display.Color.HexStringToColor(PLATFORM_TINT).color;
    for (const p of data.platforms) {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const tile = this.add.tileSprite(cx, cy, p.w, p.h, PLANK_TEXTURE);
      tile.setOrigin(0.5, 0.5);
      tile.setTint(platformTint);
      this.physics.add.existing(tile, true);
      this.platformGroup.add(tile);
    }

    if (!this.player) {
      this.player = new Player(this, data.spawn.x, data.spawn.y);
    } else {
      this.player.respawnAt(data.spawn.x, data.spawn.y);
    }

    // Climb walls (P4): non-solid climbable zones. Draw a translucent visual so
    // the wall reads, and hand the rects to the Player for overlap detection
    // (no physics body — climbing is velocity-driven, not collision-driven).
    const climbWalls = data.climbWalls ?? [];
    climbWalls.forEach((c, i) => {
      const rect = this.add.rectangle(c.x + c.w / 2, c.y + c.h / 2, c.w, c.h, 0x8fbf8f, 0.3);
      rect.setDepth(10);
      this.climbWallVisuals.push(rect);
      // Tutorial hint at the first climb wall of the level (Kitchen's "learn to
      // climb" interim; full cutscene is ROADMAP 7.3.5). Hint reads above the wall.
      if (i === 0) {
        const hint = this.add.text(c.x + c.w / 2, c.y - 8, "Press ↑ to climb!", {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#2b2b2b",
          backgroundColor: "#fff6e6",
          padding: { x: 4, y: 2 },
        });
        hint.setOrigin(0.5, 1);
        hint.setDepth(30);
        this.climbWallVisuals.push(hint);
      }
    });
    this.player.setClimbWalls(climbWalls);

    // Breakables (P5): SOLID barricades the player smashes with charge. A
    // collider stops un-charged Eloise; on charge the Player calls back to
    // destroy the specific tile (index-aligned with data.breakables). A warm
    // terracotta tint reads as "stacked blocks" — tune for feel.
    const breakables = data.breakables ?? [];
    const breakableTint = 0xc1714f;
    this.breakableTiles = breakables.map((b) => {
      const tile = this.add.tileSprite(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, PLANK_TEXTURE);
      tile.setOrigin(0.5, 0.5);
      tile.setTint(breakableTint);
      tile.setDepth(20);
      this.physics.add.existing(tile, true);
      this.breakableGroup.add(tile);
      return tile;
    });
    this.player.setBreakables(breakables);
    this.player.setBreakBreakable((i) => this.breakBreakableAt(i));
    this.colliders.push(this.physics.add.collider(this.player, this.breakableGroup));

    this.colliders.push(this.physics.add.collider(this.player, this.platformGroup));

    for (const spawn of data.enemies) {
      let enemy: Enemy | null = null;
      if (spawn.type === "dustBunny") {
        enemy = new DustBunny(this, spawn);
      } else if (spawn.type === "spider") {
        enemy = new Spider(this, spawn);
      } else if (spawn.type === "ant") {
        enemy = new Ant(this, spawn);
      } else if (spawn.type === "dustMite") {
        enemy = new DustMite(this, spawn);
      } else {
        // Explicit guard: an unhandled enemy type would otherwise vanish
        // silently. Make it loud. (Only reachable by a genuinely-new type.)
        console.warn(`[GameScene] Unhandled enemy type "${spawn.type}" — not spawned.`);
      }
      if (!enemy) continue;
      this.enemies.push(enemy);
      this.colliders.push(this.physics.add.collider(enemy, this.platformGroup));
      const e = enemy;
      this.overlaps.push(
        this.physics.add.overlap(this.player, e, () => {
          this.handleEnemyOverlap(e);
        }),
      );
    }

    for (const t of data.tokens) {
      const token = new Token(this, t.x, t.y);
      this.tokens.push(token);
      this.overlaps.push(
        this.physics.add.overlap(this.player, token, () => {
          if (token.isCollected()) return;
          token.collect();
          state.tokensCollected += 1;
          state.persist();
          this.events.emit("hud-update");
        }),
      );
    }

    const ex = data.exit;
    const ecx = ex.x + ex.w / 2;
    const ecy = ex.y + ex.h / 2;
    this.exitZone = this.add.rectangle(ecx, ecy, ex.w, ex.h, 0xffc966, 0.35);
    this.physics.add.existing(this.exitZone, true);
    this.overlaps.push(
      this.physics.add.overlap(this.player, this.exitZone, () => {
        this.handleExit();
      }),
    );

    if (data.companion) {
      const def = COMPANIONS[data.companion.type];
      const walkAnim = data.companion.type === "teddy" ? TEDDY_WALK_ANIM : null;
      this.companion = new Companion(
        this, data.companion.x, data.companion.y,
        data.companion.type, def.idleKey, walkAnim,
      );
      this.companion.configurePickup(data.companion.x, data.companion.y);
      this.companion.resetHistoryNear(data.spawn.x, data.spawn.y);
    } else {
      this.companion = null;
    }

    const b = data.bounds;
    const bw = b.maxX - b.minX;
    const bh = b.maxY - b.minY;
    this.cameras.main.setBounds(b.minX, b.minY, bw, bh);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);
    // Zoom out — see ~2x more of the level at once. Combined-level widths
    // (88-124 grids) are too wide to navigate comfortably at zoom=1.
    this.cameras.main.setZoom(0.5);

    this.exitCooldown = false;
    this.events.emit("hud-update");
  }

  /** Dev only: load a raw level that isn't in LEVEL_CATALOG (sandbox). */
  devLoadLevel(raw: LevelData): void {
    this.buildLevel(scaleLevelData(parseLevelData(raw), RENDER_SCALE));
  }

  private beginLevel(index: number): void {
    if (!getLevelEntry(index)) {
      return;
    }
    this.loadLevel(index);
  }

  private preloadUpcomingLevel(): void {
    // No-op while the game runs in blueprint mode (no background images to preload).
    // Per-section background preloading will return once illustrated backdrops are wired back in.
  }

  /**
   * Blueprint dev background — world-space grid for level-design iteration.
   * Per-section illustrated backgrounds will return once gameplay is locked.
   */
  private makeLevelBackdrop(
    b: LevelData["bounds"],
  ): Phaser.GameObjects.GameObject[] {
    return buildBlueprintGrid(this, b);
  }

  private spawnLandingDust(x: number, y: number): void {
    for (let i = 0; i < 6; i += 1) {
      const d = this.add.rectangle(
        x + Phaser.Math.Between(-8 * RENDER_SCALE, 8 * RENDER_SCALE),
        y,
        2 * RENDER_SCALE,
        2 * RENDER_SCALE,
        0xbbbbbb,
        0.85,
      );
      d.setDepth(20);
      this.tweens.add({
        targets: d,
        y: y - Phaser.Math.Between(6 * RENDER_SCALE, 14 * RENDER_SCALE),
        alpha: 0,
        duration: 380,
        ease: "Cubic.easeOut",
        onComplete: () => {
          d.destroy();
        },
      });
    }
  }

  private handleEnemyOverlap(enemy: Enemy): void {
    if (enemy.isDefeated()) {
      return;
    }
    if (this.isStomp(this.player, enemy)) {
      enemy.defeat();
      this.player.stompBounce();
      this.cameras.main.shake(180, 0.012);
    } else if (!this.player.isInvincible()) {
      this.player.applyDamage();
    }
  }

  private isStomp(player: Player, enemy: Enemy): boolean {
    const pb = player.body as Phaser.Physics.Arcade.Body;
    const eb = enemy.body as Phaser.Physics.Arcade.Body;
    if (pb.velocity.y < 60 * RENDER_SCALE) {
      return false;
    }
    if (pb.bottom > eb.top + 8 * RENDER_SCALE) {
      return false;
    }
    return Math.abs(pb.center.x - eb.center.x) < eb.width * 0.55;
  }

  private checkCompanionPickup(): void {
    if (!this.companion || this.companion.isCollected()) {
      return;
    }
    const r = this.companion.getPickupBounds();
    const px = this.player.x;
    const py = this.player.y - 10 * RENDER_SCALE;
    if (
      px >= r.x &&
      px <= r.x + r.w &&
      py >= r.y &&
      py <= r.y + r.h
    ) {
      this.companion.collect();
    }
  }

  private handleExit(): void {
    if (this.exitCooldown) {
      return;
    }
    this.exitCooldown = true;
    const state = GameState.get();
    const next = state.levelIndex + 1;
    const nextEntry = getLevelEntry(next);
    if (!nextEntry) {
      // The last platformer level (Backyard finale) leads into the boss arena —
      // not straight to worldComplete. Beating the boss sets worldComplete.
      this.scene.stop("UIScene");
      this.scene.start("BossScene");
      return;
    }

    this.loadLevel(next);
    this.exitCooldown = false;
  }

  /** Smash the i-th breakable: destroy its body + visual (idempotent). Called by
   *  the Player on charge, during update() — safe (same phase tokens destroy in). */
  private breakBreakableAt(i: number): void {
    const tile = this.breakableTiles[i];
    if (!tile) return;
    tile.destroy(); // removes the static body from the group + the game object
    this.breakableTiles[i] = null;
  }

  private clearLevelEntities(): void {
    for (const c of this.colliders) {
      c.destroy();
    }
    this.colliders = [];
    for (const o of this.overlaps) {
      o.destroy();
    }
    this.overlaps = [];

    this.platformGroup.clear(true, true);

    for (const e of this.enemies) {
      e.destroy();
    }
    this.enemies = [];

    for (const t of this.tokens) {
      t.destroy();
    }
    this.tokens = [];

    this.exitZone?.destroy();

    for (const v of this.climbWallVisuals) {
      v.destroy();
    }
    this.climbWallVisuals = [];

    this.breakableGroup.clear(true, true);
    this.breakableTiles = [];

    if (this.companion) {
      this.companion.destroy();
      this.companion = null;
    }
  }
}
