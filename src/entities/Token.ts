import { RENDER_SCALE } from "../config/game";

export const TOKEN_TEXTURE = "tex_token";

export class Token extends Phaser.Physics.Arcade.Sprite {
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TOKEN_TEXTURE);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(RENDER_SCALE);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    // Forgiving pickup hitbox, authored in WORLD px and centered on the coin.
    // Phaser multiplies setSize/setOffset by sprite.scaleX at runtime, so
    // pre-divide (same lesson as DustBunny). The visible coin is 8*RENDER_SCALE
    // world px; the default body was the raw 8px frame, so grazed coins missed.
    const PICKUP = 22; // world px — a touch larger than the coin, kid-friendly
    body.setSize(PICKUP / this.scaleX, PICKUP / this.scaleY);
    body.setOffset(
      (this.originX * this.displayWidth - PICKUP / 2) / this.scaleX,
      (this.originY * this.displayHeight - PICKUP / 2) / this.scaleY,
    );

    this.setDepth(4);

    scene.tweens.add({
      targets: this,
      y: y - 4 * RENDER_SCALE,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    scene.tweens.add({
      targets: this,
      angle: 360,
      duration: 1200,
      repeat: -1,
    });
  }

  isCollected(): boolean {
    return this.collected;
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      body.checkCollision.none = true;
    }
    this.setVisible(false);
    this.setActive(false);
  }
}
