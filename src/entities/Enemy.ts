import type { EnemySpawn } from "../types/level";

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  protected patrolLeft: number;
  protected patrolRight: number;
  protected moveSpeed: number;
  protected direction = 1;
  protected defeated = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    frame: string | number | undefined,
    spawn: EnemySpawn,
  ) {
    super(scene, x, y, texture, frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(5);

    this.patrolLeft = spawn.patrolLeft;
    this.patrolRight = spawn.patrolRight;
    this.moveSpeed = spawn.speed;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setImmovable(true);
  }

  isDefeated(): boolean {
    return this.defeated;
  }

  defeat(): void {
    if (this.defeated) return;
    this.defeated = true;
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      body.checkCollision.none = true;
    }
    this.setActive(false);
    this.setVisible(false);
  }

  tick(_delta: number): void {
    if (this.defeated) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(this.direction * this.moveSpeed);
    if (this.x <= this.patrolLeft) {
      this.direction = 1;
    } else if (this.x >= this.patrolRight) {
      this.direction = -1;
    }
  }
}
