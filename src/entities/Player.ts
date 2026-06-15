import {
  ELOISE_IDLE,
  ELOISE_JUMP,
  ELOISE_WALK_ANIM,
  ELOISE_WALK_FRAMES,
} from "../config/textures";
import { RENDER_SCALE } from "../config/game";
import { PHYSICS } from "../config/physics";
import { GameState } from "../state/GameState";
import { computeFeetOriginY } from "../systems/measureSpriteFeet";
import { shouldAirJump } from "./airJump";
import { resolveActivePower } from "./powerDispatch";
import { isOnClimbWall, type Rect } from "./climbDetect";
import { facingBreakable } from "./breakableDetect";
import { ABILITIES } from "../config/abilities";

/** Storybook PNGs are ~848×1264; scale down hard to fit the design grid. */
const AVATAR_SCALE = 0.06 * RENDER_SCALE;
const BODY_W = 10 * RENDER_SCALE;
const BODY_H = 22 * RENDER_SCALE;
const SHADOW_W = 14 * RENDER_SCALE;
const SHADOW_H = 4 * RENDER_SCALE;

/** Cooldown after a dash ends, so it can't be spam-chained into free flight. */
const DASH_RECOVER_MS = 250;

export class Player extends Phaser.GameObjects.Container {
  readonly avatar: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private coyoteMs = 0;
  private bufferMs = 0;
  private airJumpsUsed = 0;
  private invincibleMs = 0;
  private wasOnGround = false;
  private squashTween: Phaser.Tweens.Tween | null = null;
  /** Ignore kill plane briefly after a pit respawn. */
  private pitGraceMs = 0;
  private dying = false;
  /** When false, the X context-power block is skipped (boss arena: X = throw). */
  private powersEnabled = true;
  /** Dash (P3): >0 = mid-lunge (ms remaining); cooldown blocks re-trigger. */
  private dashMsLeft = 0;
  private dashCooldownMs = 0;
  private dashDir: 1 | -1 = 1;
  /** Last horizontal facing (drives dash direction); defaults right. */
  private facing: 1 | -1 = 1;
  /** Climbable wall rects (scaled), set by GameScene per level. */
  private climbWalls: Rect[] = [];
  /** Breakable rects (scaled), set by GameScene per level. Broken ones become
   *  null in place so facingBreakable's indices stay stable. */
  private breakables: (Rect | null)[] = [];
  /** GameScene callback: destroy the i-th breakable's body + visual on smash. */
  private onBreakBreakable?: (index: number) => void;

  private keyLeft: Phaser.Input.Keyboard.Key;
  private keyRight: Phaser.Input.Keyboard.Key;
  private keyA: Phaser.Input.Keyboard.Key;
  private keyD: Phaser.Input.Keyboard.Key;
  private keyJump: Phaser.Input.Keyboard.Key;
  private keyPower: Phaser.Input.Keyboard.Key;
  private keyUp: Phaser.Input.Keyboard.Key;
  private keyW: Phaser.Input.Keyboard.Key;

  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    const kb = scene.input.keyboard!;
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyJump = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyPower = kb.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    // Wall-climb ascends on Up/W (directional, intuitive) — NOT the power button,
    // because dash (X's fallback) is a lunge that flings you off the wall.
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);

    this.avatar = new Phaser.GameObjects.Sprite(scene, 0, 0, ELOISE_IDLE);
    if (!scene.textures.exists(ELOISE_IDLE)) {
      console.error("[Player] Missing Eloise texture:", ELOISE_IDLE);
    }
    // Origin Y < 1 compensates for bottom-transparent PNG margins so visible
    // feet plant on body bottom across idle / walk / jump frames.
    const feetOriginY = computeFeetOriginY(scene, [
      ELOISE_IDLE,
      ELOISE_JUMP,
      ...ELOISE_WALK_FRAMES,
    ]);
    this.avatar.setOrigin(0.5, feetOriginY);
    this.avatar.setScale(AVATAR_SCALE);
    this.shadow = new Phaser.GameObjects.Ellipse(
      scene,
      0,
      0,
      SHADOW_W,
      SHADOW_H,
      0x4a3728,
      0.35,
    );

    this.add(this.shadow);
    this.add(this.avatar);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(false);
    body.setSize(BODY_W, BODY_H);
    body.setOffset(-BODY_W / 2, -BODY_H);

    this.setDepth(150);
  }

  tick(delta: number): void {
    if (this.dying) {
      return;
    }

    const dt = delta / 1000;
    const body = this.body;
    const onGround = body.blocked.down || body.touching.down;

    if (onGround) {
      this.coyoteMs = PHYSICS.COYOTE_MS;
      this.airJumpsUsed = 0;
    } else {
      this.coyoteMs = Math.max(0, this.coyoteMs - delta);
    }

    this.invincibleMs = Math.max(0, this.invincibleMs - delta);
    this.pitGraceMs = Math.max(0, this.pitGraceMs - delta);

    if (this.invincibleMs > 0) {
      const blink = Math.floor(this.scene.time.now / 100) % 2 === 0;
      this.avatar.setAlpha(blink ? 0.45 : 1);
    } else {
      this.avatar.setAlpha(1);
    }

    const left = this.keyLeft.isDown || this.keyA.isDown;
    const right = this.keyRight.isDown || this.keyD.isDown;
    if (left) this.facing = -1;
    else if (right) this.facing = 1;
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.keyJump);
    const jumpReleased = Phaser.Input.Keyboard.JustUp(this.keyJump);

    if (jumpPressed) {
      this.bufferMs = PHYSICS.BUFFER_MS;
    } else {
      this.bufferMs = Math.max(0, this.bufferMs - delta);
    }

    const wantJump = this.bufferMs > 0 && (onGround || this.coyoteMs > 0);
    if (wantJump) {
      body.setVelocityY(PHYSICS.JUMP_VELOCITY);
      this.bufferMs = 0;
      this.coyoteMs = 0;
      this.playSquashStretch(0.85, 1.12, 80);
    }

    // Air (double) jump: a second press while airborne, once Teddy's power is unlocked.
    // Reuses the cached `jumpPressed` (Phaser's JustDown is destructive and was already
    // consumed above) and skips the frame a coyote/ground jump just fired (groundJumpFired).
    if (
      shouldAirJump({
        jumpPressed,
        groundJumpFired: wantJump,
        onGround,
        hasDoubleJump: GameState.get().hasAbility("doubleJump"),
        airJumpsUsed: this.airJumpsUsed,
      })
    ) {
      body.setVelocityY(PHYSICS.JUMP_VELOCITY);
      this.airJumpsUsed += 1;
      this.bufferMs = 0;
      this.playSquashStretch(0.85, 1.12, 80);
    }

    if (jumpReleased && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y * PHYSICS.VARIABLE_CUT);
    }

    let targetVx = 0;
    if (left) targetVx -= PHYSICS.SPEED;
    if (right) targetVx += PHYSICS.SPEED;

    if (onGround) {
      body.setVelocityX(targetVx);
    } else {
      const cur = body.velocity.x;
      const blended =
        cur + (targetVx * PHYSICS.AIR_SPEED_MULT - cur) * PHYSICS.AIR_BLEND;
      body.setVelocityX(blended);
    }

    const vy = body.velocity.y;
    let g: number;
    if (vy < 0) {
      g =
        Math.abs(vy) < PHYSICS.APEX_VY_THRESHOLD
          ? PHYSICS.GRAVITY_APEX
          : PHYSICS.GRAVITY_UP;
    } else {
      g = PHYSICS.GRAVITY_DOWN;
    }
    body.setVelocityY(vy + g * dt);

    // ── Power button (X) ──────────────────────────────────────────────────
    // Resolve the active power from context (pure dispatcher), then apply it.
    // Dash (press) = a gravity-suspended horizontal lunge that overrides
    // velocity for its window. Glide (hold) clamps descent. Read velocity AFTER
    // gravity integration so glide clamps the integrated value.
    // Skipped entirely in the boss arena (powersEnabled=false) so X means "throw".
    if (this.powersEnabled) {
    this.dashCooldownMs = Math.max(0, this.dashCooldownMs - delta);
    const integratedVy = body.velocity.y;
    const bodyRect = { x: body.x, y: body.y, w: body.width, h: body.height };
    const onClimbableWall = isOnClimbWall(bodyRect, this.climbWalls);
    const chargeReach = (ABILITIES.charge.traversal?.chargeReach ?? 0) * RENDER_SCALE;
    const facedBreakableIdx = facingBreakable(bodyRect, this.facing, this.breakables, chargeReach);
    const activePower = resolveActivePower(
      {
        airborne: !onGround,
        descending: integratedVy > 0,
        onClimbableWall,
        facingBreakable: facedBreakableIdx >= 0,
      },
      GameState.get().unlockedAbilities,
    );
    const powerPressed = Phaser.Input.Keyboard.JustDown(this.keyPower);

    // Charge (press): a grounded smash that destroys the breakable in front. The
    // dispatcher resolves charge over dash at a barricade (priority 2 > 1), so
    // this fires instead of a dash. Null the smashed rect so it's no longer
    // detected; the scene callback destroys its body + visual.
    if (powerPressed && activePower === "charge" && facedBreakableIdx >= 0) {
      this.onBreakBreakable?.(facedBreakableIdx);
      this.breakables[facedBreakableIdx] = null;
      this.playSquashStretch(1.12, 0.85, 90);
    }

    // Dash-smash: a dash that reaches a breakable plows through it (charge-gated).
    // facingBreakable's forward lookahead fires ~one dash-frame before the solid
    // collider would stop her, so the lunge carries through with no stutter.
    // Gated on charge so it never bypasses the gate — the forgiving counterpart to
    // the flush tap above (dash at the barricade instead of standing flush on it).
    if (
      this.dashMsLeft > 0 &&
      facedBreakableIdx >= 0 &&
      GameState.get().unlockedAbilities.has("charge")
    ) {
      this.onBreakBreakable?.(facedBreakableIdx);
      this.breakables[facedBreakableIdx] = null;
      this.playSquashStretch(1.12, 0.85, 90);
    }

    // Start a dash: fresh press, dash is the resolved power, not already dashing
    // or recovering. Lunge in the current facing direction.
    if (
      powerPressed &&
      activePower === "dash" &&
      this.dashMsLeft <= 0 &&
      this.dashCooldownMs <= 0
    ) {
      this.dashMsLeft = ABILITIES.dash.traversal?.dashDurationMs ?? 0;
      this.dashCooldownMs = this.dashMsLeft + DASH_RECOVER_MS;
      this.dashDir = this.facing;
      this.playSquashStretch(1, 0.9, 80);
    }

    if (this.dashMsLeft > 0) {
      // Gravity-suspended straight lunge: override both axes for the window.
      this.dashMsLeft -= delta;
      const dashSpeed = (ABILITIES.dash.traversal?.dashSpeed ?? 0) * RENDER_SCALE;
      body.setVelocityX(this.dashDir * dashSpeed);
      body.setVelocityY(0);
    } else if (activePower === "wallClimb" && (this.keyUp.isDown || this.keyW.isDown)) {
      // Ladder climb: hold Up/W to ascend at a steady speed, gravity suspended.
      // Resolving wallClimb here (priority 4) also makes X inert on the wall, so a
      // stray power-button press can't dash you off it. Release Up → gravity.
      const climbSpeed = (ABILITIES.wallClimb.traversal?.climbSpeed ?? 0) * RENDER_SCALE;
      body.setVelocityY(-climbSpeed);
    } else if (activePower === "glide" && this.keyPower.isDown) {
      const glideFallSpeed =
        (ABILITIES.glide.envelope?.glideFallSpeed ?? Infinity) * RENDER_SCALE;
      if (integratedVy > glideFallSpeed) {
        body.setVelocityY(glideFallSpeed);
      }
    }
    } // end if (this.powersEnabled)

    const heightAboveGround = onGround
      ? 0
      : Math.min(120 * RENDER_SCALE, Math.max(0, -vy * 0.15 + 20 * RENDER_SCALE));
    const shadowScale = Phaser.Math.Clamp(
      1 - heightAboveGround / (90 * RENDER_SCALE),
      0.35,
      1,
    );
    this.shadow.setScale(shadowScale, shadowScale * 0.9);

    if (onGround && !this.wasOnGround) {
      this.playSquashStretch(1.08, 0.82, 90);
      this.scene.events.emit("player-landed", { x: this.x, y: this.y });
    }

    this.updateAvatarFrame(onGround, body.velocity.x);

    this.wasOnGround = onGround;
  }

  /** Storybook anim: jump pose mid-air, walk anim when grounded+moving, idle otherwise. */
  private updateAvatarFrame(onGround: boolean, vx: number): void {
    if (!onGround) {
      this.avatar.anims.stop();
      this.avatar.setTexture(ELOISE_JUMP);
    } else if (Math.abs(vx) > 8 * RENDER_SCALE) {
      this.avatar.play(ELOISE_WALK_ANIM, true);
    } else {
      this.avatar.anims.stop();
      this.avatar.setTexture(ELOISE_IDLE);
    }

    if (vx < -6 * RENDER_SCALE) {
      this.avatar.setFlipX(true);
    } else if (vx > 6 * RENDER_SCALE) {
      this.avatar.setFlipX(false);
    }
  }

  isInvincible(): boolean {
    return this.invincibleMs > 0;
  }

  isInPitGrace(): boolean {
    return this.pitGraceMs > 0;
  }

  isDying(): boolean {
    return this.dying;
  }

  /** GameScene hands the level's (scaled) climb-wall rects here each build. */
  setClimbWalls(walls: Rect[]): void {
    this.climbWalls = walls;
  }

  /** GameScene hands the level's (scaled) breakable rects here each build. */
  setBreakables(rects: Rect[]): void {
    this.breakables = [...rects];
  }

  /** GameScene wires the smash callback (destroys the body + visual by index). */
  setBreakBreakable(cb: (index: number) => void): void {
    this.onBreakBreakable = cb;
  }

  /** BossScene disables the X context-powers so X can mean "throw" in the arena. */
  setPowersEnabled(enabled: boolean): void {
    this.powersEnabled = enabled;
  }

  beginDeathAnimation(): void {
    this.dying = true;
    this.body.setVelocity(0, 0);
  }

  endDeathAnimation(): void {
    this.dying = false;
  }

  applyDamage(): void {
    const state = GameState.get();
    if (this.invincibleMs > 0) return;
    state.hearts -= 1;
    this.invincibleMs = PHYSICS.INVINCIBILITY_MS;
    this.scene.events.emit("hud-update");
    if (state.hearts <= 0) {
      this.scene.events.emit("player-died");
    }
  }

  respawnAt(x: number, y: number): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.avatar);
    this.setAngle(0);
    this.setScale(1);
    this.setPosition(x, y);
    this.body.reset(x, y);
    this.body.setVelocity(0, 0);
    this.avatar.setFlipX(false);
    this.avatar.setScale(AVATAR_SCALE);
    this.invincibleMs = 0;
    this.pitGraceMs = 0;
    this.dying = false;
    this.dashMsLeft = 0;
    this.dashCooldownMs = 0;
    const state = GameState.get();
    state.hearts = state.maxHearts;
    this.scene.events.emit("hud-update");
  }

  /** Pit fall — snap to spawn without resetting hearts. */
  respawnFromPit(x: number, y: number): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.avatar);
    this.setAngle(0);
    this.setScale(1);
    this.setPosition(x, y);
    this.body.reset(x, y);
    this.body.setVelocity(0, 0);
    this.avatar.setFlipX(false);
    this.avatar.setScale(AVATAR_SCALE);
    this.pitGraceMs = 500;
    this.invincibleMs = Math.max(this.invincibleMs, 400);
    this.dashMsLeft = 0;
    this.dashCooldownMs = 0;
  }

  stompBounce(): void {
    this.body.setVelocityY(PHYSICS.STOMP_BOUNCE_VY);
  }

  private playSquashStretch(_sx: number, sy: number, duration: number): void {
    if (this.squashTween) {
      this.squashTween.stop();
    }
    const base = AVATAR_SCALE;
    // scaleX stays positive; flipX alone owns horizontal facing direction.
    // Encoding direction in scaleX double-mirrored against flipX when the
    // player changed direction mid-air and landed before flipX caught up.
    this.avatar.scaleY = base * sy;
    this.avatar.scaleX = base;
    this.squashTween = this.scene.tweens.add({
      targets: this.avatar,
      scaleY: base,
      scaleX: base,
      duration,
      ease: "Sine.easeOut",
    });
  }
}
