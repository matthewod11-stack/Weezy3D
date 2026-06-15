import { GameState } from "../state/GameState";
import { RENDER_SCALE } from "../config/game";
import { TEDDY_IDLE, TEDDY_WALK, TEDDY_WALK_ANIM } from "../config/textures";
import { computeFeetOriginY } from "../systems/measureSpriteFeet";
import type { CompanionType } from "../design/levelSketches";
import { COMPANIONS } from "../config/companions";

export type PathPoint = { x: number; y: number };

/**
 * Companion follows player path with delay using a ring buffer of positions.
 * Constructor takes optional texture + walk-anim keys so we can host all 5
 * companions through this single class (Teddy / Dog / Horse / Cat / Flamingo).
 *
 * The walk anim plays whenever the companion is moving (after collection); when
 * stationary, it falls back to the idle texture.
 */
export class Companion extends Phaser.GameObjects.Sprite {
  private readonly history: PathPoint[] = [];
  private readonly delayFrames = 18;
  private collected = false;
  private waitX = 0;
  private waitY = 0;
  private prevX = 0;
  private readonly idleKey: string;
  private readonly walkAnimKey: string | null;
  private readonly companionType: CompanionType;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    companionType: CompanionType = "teddy",
    idleKey: string = TEDDY_IDLE,
    walkAnimKey: string | null = TEDDY_WALK_ANIM,
  ) {
    super(scene, x, y, idleKey);
    this.companionType = companionType;
    this.idleKey = idleKey;
    this.walkAnimKey = walkAnimKey;
    scene.add.existing(this);
    // Origin Y < 1 plants visible feet on world-y across all companion frames.
    // For Teddy we know both idle + walk textures; future companions reuse this pattern.
    const feetOriginY = computeFeetOriginY(scene, [idleKey, TEDDY_WALK]);
    this.setOrigin(0.5, feetOriginY);
    // Storybook PNGs are ~848×1264; scale down to match procedural-era footprint.
    this.setScale(0.06 * RENDER_SCALE);
    this.setDepth(6);
    this.waitX = x;
    this.waitY = y;
    this.prevX = x;
  }

  configurePickup(x: number, y: number): void {
    const state = GameState.get();
    this.waitX = x;
    this.waitY = y;
    this.collected = state.hasAbility(COMPANIONS[this.companionType].grants);
    this.history.length = 0;
    this.setVisible(true);
    if (this.collected) {
      this.setAlpha(1);
    } else {
      this.setPosition(x, y);
    }
    this.prevX = this.x;
    this.anims.stop();
    this.setTexture(this.idleKey);
  }

  getPickupBounds(): { x: number; y: number; w: number; h: number } {
    const pad = 10 * RENDER_SCALE;
    const h = 20 * RENDER_SCALE;
    return { x: this.waitX - pad, y: this.waitY - h, w: pad * 2, h };
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;
    GameState.get().collectCompanion(this.companionType);
    this.scene.events.emit("hud-update");
    this.scene.events.emit("companion-collected", { type: this.companionType });
  }

  isCollected(): boolean {
    return this.collected;
  }

  pushPlayerPosition(x: number, y: number): void {
    this.history.push({ x, y });
    if (this.history.length > 256) {
      this.history.shift();
    }
    if (!this.collected) {
      this.setPosition(this.waitX, this.waitY);
      return;
    }
    const idx = Math.max(0, this.history.length - 1 - this.delayFrames);
    const p = this.history[idx]!;
    const targetX = p.x - 14 * RENDER_SCALE;
    const targetY = p.y;
    const dx = targetX - this.prevX;
    this.setPosition(targetX, targetY);

    // Flip + animate based on motion since last frame.
    if (dx < -0.1) {
      this.setFlipX(false); // sprite faces right; mirrored for leftward motion
    } else if (dx > 0.1) {
      this.setFlipX(false);
    }
    // Note: companion sprites face RIGHT (same as Eloise's walk-right baseline).
    // When she moves left we don't currently flip them — keeps the gentle
    // "trailing behind" look. Adjust later if needed per playtest.

    if (Math.abs(dx) > 0.3 && this.walkAnimKey) {
      this.play(this.walkAnimKey, true);
    } else {
      this.anims.stop();
      this.setTexture(this.idleKey);
    }

    this.prevX = targetX;
  }

  resetHistoryNear(x: number, y: number): void {
    this.history.length = 0;
    for (let i = 0; i < this.delayFrames + 1; i += 1) {
      this.history.push({ x, y });
    }
    if (this.collected) {
      this.setPosition(x - 14 * RENDER_SCALE, y);
    }
    this.prevX = this.x;
  }
}
