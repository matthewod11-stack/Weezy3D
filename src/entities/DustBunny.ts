import { RENDER_SCALE } from "../config/game";
import type { EnemySpawn } from "../types/level";
import { Enemy } from "./Enemy";
import {
  DUSTBUNNY_IDLE,
  DUSTBUNNY_WALK,
  DUSTBUNNY_ATTACK,
} from "../config/textures";
import { computeFeetOriginY } from "../systems/measureSpriteFeet";

type DustBunnyPose = "idle" | "walk" | "attack";

const POSE_TEXTURE: Record<DustBunnyPose, string> = {
  idle: DUSTBUNNY_IDLE,
  walk: DUSTBUNNY_WALK,
  attack: DUSTBUNNY_ATTACK,
};

export class DustBunny extends Enemy {
  private currentPose: DustBunnyPose = "idle";

  constructor(scene: Phaser.Scene, spawn: EnemySpawn) {
    super(scene, spawn.x, spawn.y, DUSTBUNNY_IDLE, undefined, spawn);
    // Origin Y < 1 plants visible feet on world-y across idle / walk / attack frames.
    const feetOriginY = computeFeetOriginY(scene, [
      DUSTBUNNY_IDLE,
      DUSTBUNNY_WALK,
      DUSTBUNNY_ATTACK,
    ]);
    this.setOrigin(0.5, feetOriginY);
    this.setScale(0.04 * RENDER_SCALE);

    // Body sized in WORLD units. Phaser's setSize/setOffset values get multiplied
    // by sprite.scaleX at runtime, so pre-divide. Prior setCircle on a 0.08-scale
    // sprite produced a 2.24-world-px hitbox on a 82-world-px visible bunny.
    const BODY_W = 50;
    const BODY_H = 40;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(BODY_W / this.scaleX, BODY_H / this.scaleY);
    const offsetX = (this.originX * this.displayWidth - BODY_W / 2) / this.scaleX;
    const offsetY = (this.originY * this.displayHeight - BODY_H - 10) / this.scaleY;
    body.setOffset(offsetX, offsetY);
    body.setBounce(0.2);
  }

  /** Swap texture for the current behavior state. */
  setPose(pose: DustBunnyPose): void {
    if (pose === this.currentPose) return;
    this.currentPose = pose;
    this.setTexture(POSE_TEXTURE[pose]);
  }

  tick(delta: number): void {
    super.tick(delta);
    if (this.defeated) return;
    // Patrol uses constant velocity, so motion = walking pose. Falls back to
    // idle if velocity is zero (shouldn't normally happen mid-patrol but
    // covers edge cases like world-bounds collisions).
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (Math.abs(body.velocity.x) > 1) {
      this.setPose("walk");
    } else {
      this.setPose("idle");
    }
    // Face the direction of travel.
    this.setFlipX(body.velocity.x > 0);
  }
}
