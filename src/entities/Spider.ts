import { RENDER_SCALE } from "../config/game";
import type { EnemySpawn } from "../types/level";
import { Enemy } from "./Enemy";
import { SPIDER_IDLE, SPIDER_WALK } from "../config/textures";
import { computeFeetOriginY } from "../systems/measureSpriteFeet";

type SpiderPose = "idle" | "walk";

const POSE_TEXTURE: Record<SpiderPose, string> = {
  idle: SPIDER_IDLE,
  walk: SPIDER_WALK,
};

export class Spider extends Enemy {
  private currentPose: SpiderPose = "idle";

  constructor(scene: Phaser.Scene, spawn: EnemySpawn) {
    super(scene, spawn.x, spawn.y, SPIDER_IDLE, undefined, spawn);
    const feetOriginY = computeFeetOriginY(scene, [SPIDER_IDLE, SPIDER_WALK]);
    this.setOrigin(0.5, feetOriginY);
    this.setScale(0.04 * RENDER_SCALE);

    // Body sized in WORLD units (Phaser multiplies setSize/setOffset by scaleX
    // at runtime, so pre-divide). Mirrors DustBunny; tune to spider proportions
    // at playtest if the hitbox reads off.
    const BODY_W = 50;
    const BODY_H = 40;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(BODY_W / this.scaleX, BODY_H / this.scaleY);
    const offsetX = (this.originX * this.displayWidth - BODY_W / 2) / this.scaleX;
    const offsetY = (this.originY * this.displayHeight - BODY_H - 10) / this.scaleY;
    body.setOffset(offsetX, offsetY);
    body.setBounce(0.2);
  }

  setPose(pose: SpiderPose): void {
    if (pose === this.currentPose) return;
    this.currentPose = pose;
    this.setTexture(POSE_TEXTURE[pose]);
  }

  tick(delta: number): void {
    super.tick(delta);
    if (this.defeated) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (Math.abs(body.velocity.x) > 1) {
      this.setPose("walk");
    } else {
      this.setPose("idle");
    }
    this.setFlipX(body.velocity.x > 0);
  }
}
