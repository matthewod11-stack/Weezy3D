import Phaser from "phaser";
import { getLevelEntry, LEVEL_CATALOG } from "../levels/levelCatalog";
import { RENDER_SCALE } from "../config/game";
import { GameState } from "../state/GameState";
import { clientYToGameY, optionAtPointer } from "./menuSelection";
import { GameScene } from "./GameScene";
import { TESTING_GROUND, grantAllImplementedPowers } from "../levels/testingGround";

const S = RENDER_SCALE;

type MenuOption = "continue" | "newGame" | "testGround";

export class MenuScene extends Phaser.Scene {
  private options: MenuOption[] = [];
  private selection = 0;
  private optionLabels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: "MenuScene" });
  }

  create(): void {
    const { width, height } = this.scale;
    const state = GameState.get();
    state.paused = false;

    this.add
      .rectangle(width / 2, height / 2, width, height, 0xf8ead8, 1)
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.28, "Princess Eloise", {
        fontFamily: "monospace",
        fontSize: `${18 * S}px`,
        color: "#ff1493",
        stroke: "#2a1020",
        strokeThickness: 4 * S,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.38, "Bedroom World", {
        fontFamily: "monospace",
        fontSize: `${10 * S}px`,
        color: "#886677",
        stroke: "#fff8f0",
        strokeThickness: 2 * S,
      })
      .setOrigin(0.5);

    this.options = state.hasProgress() ? ["continue", "newGame"] : ["newGame"];
    // Dev-only: Vite statically replaces import.meta.env.DEV with false in the
    // production build, so this row (and its branch in confirmSelection) is
    // tree-shaken out of the itch.io bundle entirely.
    if (import.meta.env.DEV) {
      this.options.push("testGround");
    }
    this.selection = 0;
    this.renderOptions();

    this.add
      .text(width / 2, height - 18 * S, "↑↓ choose · Enter / Space / Click · start", {
        fontFamily: "monospace",
        fontSize: `${8 * S}px`,
        color: "#aa8899",
        stroke: "#fff8f0",
        strokeThickness: 2 * S,
      })
      .setOrigin(0.5, 1);

    const kb = this.input.keyboard;
    kb?.on("keydown-UP", () => {
      this.moveSelection(-1);
    });
    kb?.on("keydown-DOWN", () => {
      this.moveSelection(1);
    });
    kb?.on("keydown-ENTER", () => {
      this.confirmSelection();
    });
    kb?.on("keydown-SPACE", () => {
      this.confirmSelection();
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.game.canvas?.focus();
      // Select the option nearest the click, then confirm IT — not the
      // keyboard-highlighted row. Previously any click confirmed the current
      // selection (default Continue), so clicking "New Game" launched Continue.
      // Compute game-space Y from the raw DOM event: Phaser's pointer.y is
      // unreliable here (Scale.NONE + manual CSS scaling leaves displayScale
      // stale), so a CSS-scaled canvas reported clicks far from the rows.
      const rect = this.game.canvas?.getBoundingClientRect();
      const native = pointer.event as { clientY?: number } | undefined;
      const clickY =
        rect && rect.height > 0 && typeof native?.clientY === "number"
          ? clientYToGameY(native.clientY, rect.top, rect.height, this.scale.height)
          : pointer.y;
      const idx = optionAtPointer(
        clickY,
        this.optionLabels.map((label) => label.y),
        14 * S,
      );
      if (idx >= 0) {
        this.selection = idx;
        this.confirmSelection();
      }
    });

    this.game.canvas?.focus();
  }

  private labelFor(option: MenuOption): string {
    if (option === "continue") {
      const state = GameState.get();
      const entry = getLevelEntry(state.levelIndex);
      const name = entry?.raw.name ?? `Level ${state.levelIndex + 1}`;
      return `Continue — lvl ${state.levelIndex + 1}/${LEVEL_CATALOG.length} · ${name}`;
    }
    if (import.meta.env.DEV && option === "testGround") {
      return "Testing Ground (dev)";
    }
    return "New Game";
  }

  private renderOptions(): void {
    for (const t of this.optionLabels) {
      t.destroy();
    }
    this.optionLabels = [];

    const { width, height } = this.scale;
    const startY = height * 0.52;
    this.options.forEach((option, index) => {
      const selected = index === this.selection;
      const text = this.add
        .text(width / 2, startY + index * 22 * S, this.labelFor(option), {
          fontFamily: "monospace",
          fontSize: `${(selected ? 11 : 10) * S}px`,
          color: selected ? "#ffffff" : "#ccb8c8",
          stroke: "#2a1020",
          strokeThickness: (selected ? 4 : 3) * S,
        })
        .setOrigin(0.5);
      this.optionLabels.push(text);
    });
  }

  private moveSelection(delta: number): void {
    if (this.options.length <= 1) {
      return;
    }
    this.selection = (this.selection + delta + this.options.length) % this.options.length;
    this.renderOptions();
  }

  private confirmSelection(): void {
    const choice = this.options[this.selection];
    const state = GameState.get();
    if (import.meta.env.DEV && choice === "testGround") {
      this.startTestingGround(state);
      return;
    }
    if (choice === "newGame") {
      state.resetWorld();
    }
    // Clear the transient run flags (worldComplete/paused) + refill hearts so
    // GameScene.update() doesn't early-return on re-entry. Continue keeps progress.
    state.beginRun();
    this.scene.start("GameScene");
  }

  /**
   * Dev-only: grant all implemented powers and drop into the off-catalog
   * testing-ground level. GameScene.create() loads the catalog level first;
   * we override it via the CREATE-once hook (same pattern as eloiseLoadDemo).
   */
  private startTestingGround(state: GameState): void {
    // Whole body behind the static DEV flag so production tree-shakes the method's
    // refs (TESTING_GROUND, grantAllImplementedPowers) — and thus the entire
    // testingGround module — out of the itch.io bundle.
    if (!import.meta.env.DEV) return;
    grantAllImplementedPowers(state);
    state.beginRun();
    const gs = this.scene.get("GameScene") as GameScene;
    gs.events.once(Phaser.Scenes.Events.CREATE, () =>
      gs.devLoadLevel(TESTING_GROUND),
    );
    this.scene.start("GameScene");
  }
}
