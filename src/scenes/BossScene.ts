import Phaser from "phaser";
import { PLANK_TEXTURE, HEART_EMPTY_TEXTURE, HEART_FULL_TEXTURE } from "./BootScene";
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from "../config/game";
import { PLATFORM_TINT } from "../config/platforms";
import { Player } from "../entities/Player";
import { COMPANIONS } from "../config/companions";
import { TREX_IDLE, TREX_ROAR, TREX_WALK } from "../config/textures";
import { GameState } from "../state/GameState";
import {
  DEFAULT_BOSS_CONFIG,
  initialBossState,
  resolveThrow,
  stepBossFight,
  type BossFightState,
} from "../systems/bossFight";
import { ThrownToken } from "../entities/ThrownToken";

const S = RENDER_SCALE;
const GROUND_Y = GAME_HEIGHT - 28 * S; // top of the floor
const TREX_SCALE = 0.16 * S; // ~2.6× Eloise; tune for feel
const THROW_COOLDOWN_MS = 280; // stops a held key from machine-gunning treasures
const CHARGE_STOP_X = 90 * S; // T-Rex charge landing X (just behind player spawn)

/**
 * The T-Rex boss arena (World 6 / Playhouse) — the game's climax and the payoff
 * for every token collected: the lifetime `picks` count is the ammo Eloise throws.
 * Dodge the telegraphed stomp/charge, throw during the recovery window; 3 hits tame
 * the T-Rex. Thin Phaser shell over the pure `bossFight` state machine.
 */
export class BossScene extends Phaser.Scene {
  private player!: Player;
  private trex!: Phaser.GameObjects.Sprite;
  private fight!: BossFightState;
  private hearts: Phaser.GameObjects.Image[] = [];
  private hpPips: Phaser.GameObjects.Arc[] = [];
  private ammoText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private throwKey!: Phaser.Input.Keyboard.Key;
  private thrown: ThrownToken[] = [];
  private throwCooldownMs = 0;
  private throwLandedThisFrame = false;
  private ended = false;
  private dizzyTween: Phaser.Tweens.Tween | null = null;
  private shockwave: Phaser.GameObjects.Rectangle | null = null;
  private charging = false;
  private trexHomeX = 0;

  constructor() {
    super({ key: "BossScene" });
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.ended = false;
    this.throwCooldownMs = 0;
    this.thrown = [];
    this.charging = false;
    this.shockwave = null;
    this.throwLandedThisFrame = false;

    this.physics.world.gravity.y = 0;
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(0x8fc6e8); // open-sky outdoor playhouse

    // Ground — one wide static platform spanning the screen.
    const ground = this.add.tileSprite(
      GAME_WIDTH / 2, GROUND_Y + 20 * S, GAME_WIDTH, 40 * S, PLANK_TEXTURE,
    );
    ground.setTint(Phaser.Display.Color.HexStringToColor(PLATFORM_TINT).color);
    this.physics.add.existing(ground, true);

    // Player on the left, powers suppressed (X = throw here).
    this.player = new Player(this, 120 * S, GROUND_Y - 4 * S);
    this.player.setPowersEnabled(false);
    this.physics.add.collider(this.player, ground);

    // The T-Rex on the right (set-piece; not a level enemy).
    this.trex = this.add.sprite(GAME_WIDTH - 140 * S, GROUND_Y, TREX_IDLE);
    this.trex.setOrigin(0.5, 1);
    this.trex.setScale(TREX_SCALE);
    this.trex.setDepth(50);
    this.trexHomeX = this.trex.x;

    // The five companions cheering on the sidelines (decoration + ending seed).
    const types = Object.keys(COMPANIONS) as (keyof typeof COMPANIONS)[];
    types.forEach((t, i) => {
      const img = this.add.image(40 * S + i * 26 * S, GROUND_Y - 2 * S, COMPANIONS[t].idleKey);
      img.setOrigin(0.5, 1);
      img.setScale(0.05 * S);
      img.setDepth(40);
    });

    this.fight = initialBossState(DEFAULT_BOSS_CONFIG);

    this.throwKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.input.keyboard?.on("keydown-ESC", () => {
      this.scene.start("MenuScene");
    });
    this.events.on("player-died", () => this.resetFight());

    this.buildHud();
  }

  private buildHud(): void {
    const state = GameState.get();
    // Hearts (top-left).
    let hx = 10 * S;
    for (let i = 0; i < state.maxHearts; i += 1) {
      const img = this.add
        .image(hx, 12 * S, i < state.hearts ? HEART_FULL_TEXTURE : HEART_EMPTY_TEXTURE)
        .setScrollFactor(0).setDepth(1000).setScale(0.85 * S);
      this.hearts.push(img);
      hx += 14 * S;
    }
    // Ammo readout (top-left, under hearts).
    this.ammoText = this.add
      .text(10 * S, 26 * S, "", {
        fontFamily: "monospace", fontSize: `${10 * S}px`,
        color: "#fff4d6", stroke: "#2a1020", strokeThickness: 3,
      })
      .setScrollFactor(0).setDepth(1000);
    // Boss-HP pips (top-right) — fill → empty as it takes hits.
    for (let i = 0; i < DEFAULT_BOSS_CONFIG.maxHp; i += 1) {
      const pip = this.add
        .circle(GAME_WIDTH - (16 + i * 16) * S, 14 * S, 5 * S, 0xff6b9d)
        .setScrollFactor(0).setDepth(1000);
      this.hpPips.push(pip);
    }
    // Throw prompt (centered; interim mechanic intro — full cutscene is ROADMAP 7.3.5).
    this.promptText = this.add
      .text(GAME_WIDTH / 2, 40 * S, "Press X to throw your treasures!", {
        fontFamily: "sans-serif", fontSize: `${11 * S}px`,
        color: "#2b2b2b", backgroundColor: "#fff6e6", padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    // Win banner (hidden until won).
    this.banner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "", {
        fontFamily: "monospace", fontSize: `${14 * S}px`,
        color: "#fff8dc", stroke: "#1a1a00", strokeThickness: 4 * S, align: "center",
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    this.banner.setVisible(false);
    this.refreshHud();
  }

  private refreshHud(): void {
    const state = GameState.get();
    this.hearts.forEach((img, i) => {
      img.setTexture(i < state.hearts ? HEART_FULL_TEXTURE : HEART_EMPTY_TEXTURE);
    });
    this.ammoText.setText(`treasures: ${state.tokensCollected}`);
    this.hpPips.forEach((pip, i) => {
      pip.setFillStyle(i < this.fight.hp ? 0xff6b9d : 0x553344);
    });
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    this.player.tick(delta);
    this.throwCooldownMs = Math.max(0, this.throwCooldownMs - delta);

    // Attack contact → damage (the player dodges by jumping / moving aside).
    if (!this.player.isInvincible()) {
      if (this.shockwave && this.playerHitBy(this.shockwave.x, this.shockwave.y, 9 * S, 6 * S)) {
        this.player.applyDamage();
      } else if (this.charging && this.playerHitBy(this.trex.x, GROUND_Y - 14 * S, 16 * S, 16 * S)) {
        this.player.applyDamage();
      }
    }

    // Throw on X (auto-aimed at the T-Rex). Spends a treasure; bails out at zero.
    if (Phaser.Input.Keyboard.JustDown(this.throwKey) && this.throwCooldownMs <= 0) {
      this.throwToken();
      this.throwCooldownMs = THROW_COOLDOWN_MS;
    }
    // Advance thrown tokens: flag a boss hit, despawn off-screen.
    for (const tok of this.thrown) {
      if (!tok.active) continue;
      if (this.tokenHitsTrex(tok)) {
        this.throwLandedThisFrame = true;
        this.spawnPuff(tok.x, tok.y);
        tok.destroy();
      } else if (tok.isOffscreen(GAME_WIDTH, GAME_HEIGHT)) {
        tok.destroy();
      }
    }
    this.thrown = this.thrown.filter((t) => t.active);

    // Advance the fight machine with this frame's hit (if any).
    const r = stepBossFight(this.fight, delta, this.throwLandedThisFrame, DEFAULT_BOSS_CONFIG);
    this.fight = r.state;
    this.throwLandedThisFrame = false;
    if (r.startedTelegraph) this.onTelegraph();
    if (r.startedAttack) this.onAttack(r.startedAttack);
    if (r.enteredRecovery) this.onRecovery();
    if (r.hitRegistered) this.cameras.main.shake(160, 0.008);
    if (r.won) this.onWin();

    this.refreshHud();
  }

  private onTelegraph(): void {
    this.stopDizzy();
    this.trex.setTexture(TREX_ROAR);
    this.cameras.main.shake(250, 0.006);
    this.promptText.setVisible(false);
  }

  private onAttack(kind: "stomp" | "charge"): void {
    if (kind === "stomp") {
      this.trex.setTexture(TREX_IDLE);
      this.spawnShockwave();
    } else {
      this.trex.setTexture(TREX_WALK);
      this.startCharge();
    }
  }

  private onRecovery(): void {
    this.trex.setTexture(TREX_IDLE);
    // Dizzy "hit me now" wobble (effect-stub for the missing dizzy sprite).
    this.stopDizzy();
    this.dizzyTween = this.tweens.add({
      targets: this.trex, angle: { from: -6, to: 6 },
      duration: 220, yoyo: true, repeat: -1, ease: "Sine.inOut",
    });
  }

  private stopDizzy(): void {
    if (this.dizzyTween) { this.dizzyTween.stop(); this.dizzyTween = null; }
    this.trex.setAngle(0);
  }

  private spawnShockwave(): void {
    // A low band that sweeps from the T-Rex toward Eloise along the ground.
    const w = 18 * S;
    const wave = this.add.rectangle(this.trex.x, GROUND_Y - 6 * S, w, 12 * S, 0xffe28a, 0.85);
    wave.setDepth(45);
    this.shockwave = wave;
    this.tweens.add({
      targets: wave, x: -w, duration: 1100, ease: "Linear",
      onComplete: () => {
        if (this.shockwave === wave) this.shockwave = null;
        wave.destroy();
      },
    });
  }

  private startCharge(): void {
    this.charging = true;
    this.trex.setFlipX(true); // face left, toward Eloise
    this.tweens.add({
      targets: this.trex, x: CHARGE_STOP_X, duration: 700, ease: "Quad.easeIn",
      yoyo: true, hold: 120,
      onComplete: () => {
        this.charging = false;
        this.trex.setFlipX(false);
        this.trex.x = this.trexHomeX;
      },
    });
  }

  /** AABB overlap between the player body and a world-space rect (center + half-extents). */
  private playerHitBy(cx: number, cy: number, halfW: number, halfH: number): boolean {
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    return (
      b.right > cx - halfW && b.left < cx + halfW &&
      b.bottom > cy - halfH && b.top < cy + halfH
    );
  }

  private throwToken(): void {
    const state = GameState.get();
    const { ammoAfter, bailedOut } = resolveThrow(state.tokensCollected, DEFAULT_BOSS_CONFIG.bailoutGrant);
    state.tokensCollected = ammoAfter;
    state.persist();
    if (bailedOut) this.playBailout();
    const tok = new ThrownToken(
      this, this.player.x, this.player.y - 14 * S, this.trex.x, GROUND_Y - 16 * S,
    );
    this.thrown.push(tok);
    this.refreshHud();
  }

  private tokenHitsTrex(tok: ThrownToken): boolean {
    const cx = this.trex.x;
    const cy = GROUND_Y - 16 * S;
    const halfW = 18 * S;
    const halfH = 20 * S;
    return tok.x > cx - halfW && tok.x < cx + halfW && tok.y > cy - halfH && tok.y < cy + halfH;
  }

  private spawnPuff(x: number, y: number): void {
    const puff = this.add.circle(x, y, 6 * S, 0xfff1b8, 0.9).setDepth(170);
    this.tweens.add({
      targets: puff, scale: 2, alpha: 0, duration: 260,
      onComplete: () => puff.destroy(),
    });
  }

  private playBailout(): void {
    // Companions toss you a handful — a quick "friends have your back" beat.
    const t = this.add
      .text(GAME_WIDTH / 2, 56 * S, "Your friends toss you more!", {
        fontFamily: "sans-serif", fontSize: `${10 * S}px`,
        color: "#2b2b2b", backgroundColor: "#ffe6f0", padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 500, onComplete: () => t.destroy() });
  }

  private onWin(): void {
    this.ended = true;
    this.stopDizzy();
    // Tamed effect-stub (real "tamed" sprite is a later polish task): happy tint,
    // floating hearts, a gentle settle.
    this.trex.setTexture(TREX_IDLE);
    this.trex.setTint(0xa8f0c0);
    for (let i = 0; i < 6; i += 1) {
      const heart = this.add.text(
        this.trex.x + Phaser.Math.Between(-30 * S, 30 * S), GROUND_Y - 40 * S, "💚",
        { fontSize: `${10 * S}px` },
      ).setDepth(200);
      this.tweens.add({
        targets: heart, y: heart.y - 40 * S, alpha: 0,
        duration: 1400, delay: i * 120, onComplete: () => heart.destroy(),
      });
    }
    const state = GameState.get();
    state.worldComplete = true;
    state.persist();
    this.banner.setText("You tamed the T-Rex!\nYou're friends now 💚\nESC → Main Menu");
    this.banner.setVisible(true);
    this.refreshHud();
  }

  private resetFight(): void {
    // Forgiveness: a wipe restarts the ENCOUNTER, never the world. Refill hearts,
    // reset the boss, reposition Eloise. Ammo is whatever's left (bailout covers 0).
    this.player.respawnAt(120 * S, GROUND_Y - 4 * S); // respawnAt refills hearts
    this.fight = initialBossState(DEFAULT_BOSS_CONFIG);
    this.stopDizzy();
    // Kill any in-flight charge/recovery tween so a death mid-charge doesn't slide
    // the T-Rex across the reset intro before settling at its home X.
    this.tweens.killTweensOf(this.trex);
    if (this.shockwave) { this.shockwave.destroy(); this.shockwave = null; }
    this.charging = false;
    this.trex.setFlipX(false);
    this.trex.x = this.trexHomeX;
    this.trex.setTexture(TREX_IDLE);
    this.refreshHud();
  }

  private teardown(): void {
    this.stopDizzy();
    this.events.off("player-died");
    this.input.keyboard?.off("keydown-ESC");
    if (this.shockwave) { this.shockwave.destroy(); this.shockwave = null; }
    this.charging = false;
    this.player = undefined as unknown as Player;
    this.hearts = [];
    this.hpPips = [];
    this.thrown = [];
    this.ended = false;
  }
}
