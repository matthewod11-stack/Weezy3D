import Phaser from "phaser";
import {
  ELOISE_IDLE,
  ELOISE_JUMP,
  ELOISE_WALK_FRAMES,
  ELOISE_WALK_ANIM,
  TEDDY_IDLE,
  TEDDY_WALK,
  TEDDY_WALK_ANIM,
  DOG_IDLE,
  DOG_WALK,
  HORSE_IDLE,
  HORSE_WALK,
  CAT_IDLE,
  CAT_WALK,
  FLAMINGO_IDLE,
  FLAMINGO_WALK,
  DUSTBUNNY_IDLE,
  DUSTBUNNY_WALK,
  DUSTBUNNY_ATTACK,
  SPIDER_IDLE,
  SPIDER_WALK,
  SPIDER_ATTACK,
  ANT,
  DUSTMITE,
  TREX_IDLE,
  TREX_WALK,
  TREX_ROAR,
  STORYBOOK_KEYS,
} from "../config/textures";
import { TOKEN_TEXTURE } from "../entities/Token";

export const PLANK_TEXTURE = "tex_plank";
export const HEART_FULL_TEXTURE = "tex_heart_full";
export const HEART_EMPTY_TEXTURE = "tex_heart_empty";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Eloise
    this.load.image(ELOISE_IDLE, "assets/sprites/player/storybook/eloise_idle.png");
    this.load.image(ELOISE_JUMP, "assets/sprites/player/storybook/eloise_jump.png");
    for (let i = 0; i < ELOISE_WALK_FRAMES.length; i += 1) {
      this.load.image(
        ELOISE_WALK_FRAMES[i]!,
        `assets/sprites/player/storybook/eloise_walk_${i}.png`,
      );
    }

    // Companions
    this.load.image(TEDDY_IDLE, "assets/sprites/companions/storybook/teddy_idle.png");
    this.load.image(TEDDY_WALK, "assets/sprites/companions/storybook/teddy_walk.png");
    this.load.image(DOG_IDLE, "assets/sprites/companions/storybook/dog_idle.png");
    this.load.image(DOG_WALK, "assets/sprites/companions/storybook/dog_walk.png");
    this.load.image(HORSE_IDLE, "assets/sprites/companions/storybook/horse_idle.png");
    this.load.image(HORSE_WALK, "assets/sprites/companions/storybook/horse_walk.png");
    this.load.image(CAT_IDLE, "assets/sprites/companions/storybook/cat_idle.png");
    this.load.image(CAT_WALK, "assets/sprites/companions/storybook/cat_walk.png");
    this.load.image(FLAMINGO_IDLE, "assets/sprites/companions/storybook/flamingo_idle.png");
    this.load.image(FLAMINGO_WALK, "assets/sprites/companions/storybook/flamingo_walk.png");

    // Enemies
    this.load.image(DUSTBUNNY_IDLE, "assets/sprites/enemies/storybook/dustbunny_idle.png");
    this.load.image(DUSTBUNNY_WALK, "assets/sprites/enemies/storybook/dustbunny_walk.png");
    this.load.image(DUSTBUNNY_ATTACK, "assets/sprites/enemies/storybook/dustbunny_attack.png");
    this.load.image(SPIDER_IDLE, "assets/sprites/enemies/storybook/spider_idle.png");
    this.load.image(SPIDER_WALK, "assets/sprites/enemies/storybook/spider_walk.png");
    this.load.image(SPIDER_ATTACK, "assets/sprites/enemies/storybook/spider_attack.png");
    this.load.image(ANT, "assets/sprites/enemies/storybook/ant.png");
    this.load.image(DUSTMITE, "assets/sprites/enemies/storybook/dustmite.png");

    // Boss
    this.load.image(TREX_IDLE, "assets/sprites/bosses/storybook/trex_idle.png");
    this.load.image(TREX_WALK, "assets/sprites/bosses/storybook/trex_walk.png");
    this.load.image(TREX_ROAR, "assets/sprites/bosses/storybook/trex_roar.png");
  }

  create(): void {
    this.createPlankTexture();
    this.createHeartTextures();
    this.createTokenTexture();
    this.createEloiseWalkAnimation();
    this.createTeddyWalkAnimation();
    this.applyCrispFilters();
    this.scene.start("MenuScene");
  }

  /** Builds Eloise's 6-frame walk anim. */
  private createEloiseWalkAnimation(): void {
    this.anims.create({
      key: ELOISE_WALK_ANIM,
      frames: ELOISE_WALK_FRAMES.map((key) => ({ key })),
      frameRate: 10,
      repeat: -1,
    });
  }

  /** Builds Teddy's 2-frame idle↔walk alternation for following motion. */
  private createTeddyWalkAnimation(): void {
    this.anims.create({
      key: TEDDY_WALK_ANIM,
      frames: [{ key: TEDDY_IDLE }, { key: TEDDY_WALK }],
      frameRate: 6,
      repeat: -1,
    });
  }

  /**
   * Nearest-neighbor filtering for procedural pixel textures (planks, hearts, token).
   * Storybook PNGs use the default LINEAR filter for smooth scaling.
   */
  private applyCrispFilters(): void {
    const pixelKeys = [PLANK_TEXTURE, HEART_FULL_TEXTURE, HEART_EMPTY_TEXTURE, TOKEN_TEXTURE];
    for (const key of pixelKeys) {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    for (const key of STORYBOOK_KEYS) {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
  }

  /** Light blue planks — pops against beige bedroom art. */
  private createPlankTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xb8e8ff);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x9dd4f5);
    g.fillRect(0, 4, 16, 2);
    g.fillRect(0, 10, 16, 1);
    g.fillStyle(0xdaf4ff);
    g.fillRect(0, 0, 16, 1);
    g.fillStyle(0x7ec0e8);
    g.fillRect(15, 0, 1, 16);
    g.fillRect(0, 15, 16, 1);
    g.generateTexture(PLANK_TEXTURE, 16, 16);
    g.destroy();
  }

  private createHeartTextures(): void {
    const full = this.make.graphics({ x: 0, y: 0 });
    full.fillStyle(0xff4f6d);
    full.fillRect(2, 4, 4, 4);
    full.fillRect(6, 2, 4, 6);
    full.fillRect(10, 4, 4, 4);
    full.fillRect(4, 8, 8, 4);
    full.fillRect(6, 10, 4, 2);
    full.generateTexture(HEART_FULL_TEXTURE, 16, 16);
    full.destroy();

    const empty = this.make.graphics({ x: 0, y: 0 });
    empty.lineStyle(1, 0xff4f6d, 1);
    empty.strokeRect(2, 4, 4, 4);
    empty.strokeRect(6, 2, 4, 6);
    empty.strokeRect(10, 4, 4, 4);
    empty.strokeRect(4, 8, 8, 4);
    empty.generateTexture(HEART_EMPTY_TEXTURE, 16, 16);
    empty.destroy();
  }

  private createTokenTexture(): void {
    const token = this.make.graphics({ x: 0, y: 0 });
    token.fillStyle(0xffcc33);
    token.fillRect(1, 1, 6, 6);
    token.fillStyle(0xffee99);
    token.fillRect(2, 2, 4, 4);
    token.fillStyle(0xffa500);
    token.fillRect(3, 0, 2, 8);
    token.fillRect(0, 3, 8, 2);
    token.fillStyle(0xffffff);
    token.fillRect(3, 3, 2, 2);
    token.generateTexture(TOKEN_TEXTURE, 8, 8);
    token.destroy();
  }
}
