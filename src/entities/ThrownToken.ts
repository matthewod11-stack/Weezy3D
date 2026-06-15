import Phaser from "phaser";
import { RENDER_SCALE } from "../config/game";
import { TOKEN_TEXTURE } from "./Token";
import { aimVelocity } from "./aimVelocity";

/** A token Eloise hurls at the boss. Auto-aimed, gravity-free straight shot.
 *  Despawns when it hits the boss (scene overlap) or leaves the arena bounds. */
export class ThrownToken extends Phaser.Physics.Arcade.Sprite {
  /** World px / second. Fast enough that window-timing stays forgiving. */
  static readonly SPEED = 520 * RENDER_SCALE;

  constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number) {
    super(scene, x, y, TOKEN_TEXTURE);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(0.8 * RENDER_SCALE);
    this.setDepth(160);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    const { vx, vy } = aimVelocity(x, y, targetX, targetY, ThrownToken.SPEED);
    body.setVelocity(vx, vy);
    scene.tweens.add({ targets: this, angle: 360, duration: 500, repeat: -1 });
  }

  /** True once the token has flown outside the given screen bounds. */
  isOffscreen(width: number, height: number): boolean {
    return this.x < -40 || this.x > width + 40 || this.y < -40 || this.y > height + 40;
  }
}
