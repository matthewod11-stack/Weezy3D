import { RENDER_SCALE } from "../config/game";
import type { EnemySpawn } from "../types/level";
import { Enemy } from "./Enemy";
import { DUSTMITE } from "../config/textures";
import { computeFeetOriginY } from "../systems/measureSpriteFeet";

/**
 * DustMite — Family Room's primary enemy. A stomp-patroller, sibling of
 * Ant/Spider/DustBunny under the Enemy base (which owns all patrol motion).
 * Only one dust-mite texture exists (no idle/walk split), so there is no
 * pose-swap — just flip with travel direction. "Under the cushions" flavor is
 * pure placement (clusters on rugs/couches). Mirrors Ant.ts.
 */
export class DustMite extends Enemy {
  constructor(scene: Phaser.Scene, spawn: EnemySpawn) {
    super(scene, spawn.x, spawn.y, DUSTMITE, undefined, spawn);
    const feetOriginY = computeFeetOriginY(scene, [DUSTMITE]);
    this.setOrigin(0.5, feetOriginY);
    this.setScale(0.03 * RENDER_SCALE); // dust mites are small; tune at playtest

    // Body sized in WORLD units (Phaser multiplies setSize/setOffset by scaleX
    // at runtime, so pre-divide). Mirrors Ant; tune to dust-mite proportions.
    const BODY_W = 46;
    const BODY_H = 26;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(BODY_W / this.scaleX, BODY_H / this.scaleY);
    const offsetX = (this.originX * this.displayWidth - BODY_W / 2) / this.scaleX;
    const offsetY = (this.originY * this.displayHeight - BODY_H - 10) / this.scaleY;
    body.setOffset(offsetX, offsetY);
    body.setBounce(0.2);
  }

  tick(delta: number): void {
    super.tick(delta);
    if (this.defeated) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setFlipX(body.velocity.x > 0);
  }
}
