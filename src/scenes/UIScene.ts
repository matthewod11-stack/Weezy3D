import Phaser from "phaser";
import { HEART_EMPTY_TEXTURE, HEART_FULL_TEXTURE } from "./BootScene";
import { getLevelEntry, LEVEL_CATALOG } from "../levels/levelCatalog";
import { RENDER_SCALE } from "../config/game";
import { GameState } from "../state/GameState";

const S = RENDER_SCALE;

const PAUSE_OPTIONS = ["Resume", "Main Menu"] as const;
type PauseOption = (typeof PAUSE_OPTIONS)[number];

export class UIScene extends Phaser.Scene {
  private statsText!: Phaser.GameObjects.Text;
  private winBanner!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Rectangle;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseHint!: Phaser.GameObjects.Text;
  private pauseOptionTexts: Phaser.GameObjects.Text[] = [];
  private pauseSelection = 0;
  private heartIcons: Phaser.GameObjects.Image[] = [];

  constructor() {
    super({ key: "UIScene" });
  }

  create(): void {
    const { width, height } = this.scale;

    this.statsText = this.add
      .text(8 * S, 22 * S, "", {
        fontFamily: "monospace",
        fontSize: `${10 * S}px`,
        color: "#ffe4f0",
        stroke: "#2a1020",
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.winBanner = this.add
      .text(width / 2, height / 2 - 20 * S, "", {
        fontFamily: "monospace",
        fontSize: `${14 * S}px`,
        color: "#fff8dc",
        stroke: "#1a1a00",
        strokeThickness: 4 * S,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001)
      .setVisible(false);

    this.pauseOverlay = this.add
      .rectangle(width / 2, height / 2, width, height, 0x1a1018, 0.55)
      .setScrollFactor(0)
      .setDepth(1002)
      .setVisible(false);

    this.pauseTitle = this.add
      .text(width / 2, height / 2 - 36 * S, "PAUSED", {
        fontFamily: "monospace",
        fontSize: `${14 * S}px`,
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4 * S,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1003)
      .setVisible(false);

    this.pauseHint = this.add
      .text(width / 2, height / 2 + 42 * S, "↑↓ choose · Enter confirm · ESC resume", {
        fontFamily: "monospace",
        fontSize: `${8 * S}px`,
        color: "#ddd0d8",
        stroke: "#1a1018",
        strokeThickness: 2 * S,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1003)
      .setVisible(false);

    this.add
      .text(
        width / 2,
        height - 14 * S,
        "Click game · Arrows/WASD · Space jump · ESC menu",
        {
          fontFamily: "monospace",
          fontSize: `${8 * S}px`,
          color: "#ccb8c8",
          stroke: "#1a1018",
          strokeThickness: 2 * S,
        },
      )
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(999);

    const kb = this.input.keyboard;
    kb?.on("keydown-UP", () => {
      if (GameState.get().paused) {
        this.movePauseSelection(-1);
      }
    });
    kb?.on("keydown-DOWN", () => {
      if (GameState.get().paused) {
        this.movePauseSelection(1);
      }
    });
    kb?.on("keydown-ENTER", () => {
      if (GameState.get().paused) {
        this.confirmPauseSelection();
      }
    });

    const gameScene = this.scene.get("GameScene");
    gameScene.events.on("hud-update", () => {
      this.refreshHud();
    });
    gameScene.events.on("world-complete", () => {
      this.showWin();
    });
    gameScene.events.on("pause-changed", () => {
      this.refreshPause();
    });

    this.refreshHud();
    this.refreshPause();

    // UIScene binds listeners onto GameScene's (persistent) emitter; drop them on
    // shutdown so they don't stack each time the HUD is relaunched on a new run.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const gs = this.scene.get("GameScene");
      gs.events.off("hud-update");
      gs.events.off("world-complete");
      gs.events.off("pause-changed");
    });
  }

  private refreshHearts(): void {
    for (const h of this.heartIcons) {
      h.destroy();
    }
    this.heartIcons = [];
    const state = GameState.get();
    let x = 10 * S;
    for (let i = 0; i < state.maxHearts; i += 1) {
      const filled = i < state.hearts;
      const img = this.add
        .image(x, 10 * S, filled ? HEART_FULL_TEXTURE : HEART_EMPTY_TEXTURE)
        .setScrollFactor(0)
        .setDepth(1000)
        .setScale(0.85 * S);
      this.heartIcons.push(img);
      x += 14 * S;
    }
  }

  private refreshHud(): void {
    const state = GameState.get();
    this.refreshHearts();
    const teddy = state.hasAbility("doubleJump") ? " · Teddy" : "";
    const entry = getLevelEntry(state.levelIndex);
    const levelLabel = entry?.raw.name ?? `Level ${state.levelIndex + 1}`;
    this.statsText.setText(
      `picks: ${state.tokensCollected}    lvl ${state.levelIndex + 1}/${LEVEL_CATALOG.length} · ${levelLabel}${teddy}`,
    );

    if (state.worldComplete) {
      this.showWin();
    }
  }

  private refreshPause(): void {
    const state = GameState.get();
    const visible = state.paused;
    if (visible) {
      this.pauseSelection = 0;
    }
    this.pauseOverlay.setVisible(visible);
    this.pauseTitle.setVisible(visible);
    this.pauseHint.setVisible(visible);
    this.renderPauseOptions();
  }

  private renderPauseOptions(): void {
    for (const t of this.pauseOptionTexts) {
      t.destroy();
    }
    this.pauseOptionTexts = [];

    if (!GameState.get().paused) {
      return;
    }

    const { width, height } = this.scale;
    PAUSE_OPTIONS.forEach((option, index) => {
      const selected = index === this.pauseSelection;
      const prefix = selected ? "▶ " : "  ";
      const text = this.add
        .text(width / 2, height / 2 - 6 * S + index * 22 * S, `${prefix}${option}`, {
          fontFamily: "monospace",
          fontSize: `${(selected ? 11 : 10) * S}px`,
          color: selected ? "#ffffff" : "#ccb8c8",
          stroke: "#000000",
          strokeThickness: (selected ? 4 : 3) * S,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1003);
      this.pauseOptionTexts.push(text);
    });
  }

  private movePauseSelection(delta: number): void {
    this.pauseSelection =
      (this.pauseSelection + delta + PAUSE_OPTIONS.length) % PAUSE_OPTIONS.length;
    this.renderPauseOptions();
  }

  private confirmPauseSelection(): void {
    const choice: PauseOption = PAUSE_OPTIONS[this.pauseSelection];
    if (choice === "Resume") {
      this.scene.get("GameScene").events.emit("request-resume");
      return;
    }
    this.returnToMainMenu();
  }

  private returnToMainMenu(): void {
    const state = GameState.get();
    state.paused = false;
    this.scene.stop("GameScene");
    this.scene.start("MenuScene");
    this.scene.stop();
  }

  private showWin(): void {
    const state = GameState.get();
    if (!state.worldComplete) {
      return;
    }
    this.winBanner.setText("Journey clear!\nESC → Main Menu");
    this.winBanner.setVisible(true);
  }
}
