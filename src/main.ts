import Phaser from "phaser";
import { applyIntegerScale } from "./config/display";
import { GAME_HEIGHT, GAME_WIDTH } from "./config/game";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { MenuScene } from "./scenes/MenuScene";
import { UIScene } from "./scenes/UIScene";
import { CutsceneScene } from "./scenes/CutsceneScene";
import { powerIntroScript } from "./config/cutscenes";
import type { CompanionType } from "./design/levelSketches";
import { BossScene } from "./scenes/BossScene";
import { GameState } from "./state/GameState";
import type { AbilityId } from "./config/abilities";
import { GLIDE_DEMO_LEVEL } from "./levels/glideDemoLevel";
import { DASH_DEMO_LEVEL } from "./levels/dashDemoLevel";
import { WALL_CLIMB_DEMO_LEVEL } from "./levels/wallClimbDemoLevel";
import { CHARGE_DEMO_LEVEL } from "./levels/chargeDemoLevel";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: 0x5a6670,
  /** Smooth scaling for illustrated BGs. */
  pixelArt: false,
  roundPixels: true,
  render: {
    antialias: true,
    antialiasGL: true,
    powerPreference: "high-performance",
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    /** CSS sizing handled by applyIntegerScale — keeps backing store at GAME_* dimensions. */
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene, MenuScene, GameScene, UIScene, CutsceneScene, BossScene],
};

function focusGameCanvas(): void {
  const canvas = game.canvas;
  if (!canvas) {
    return;
  }
  canvas.setAttribute("tabindex", "0");
  canvas.style.outline = "none";
  canvas.focus();
}

const game = new Phaser.Game(config);

function refreshDisplayScale(): void {
  applyIntegerScale(game);
}

requestAnimationFrame(() => {
  refreshDisplayScale();
  focusGameCanvas();
});

window.addEventListener("resize", () => {
  refreshDisplayScale();
});

/** Dev: replay from level 1 — run `eloiseReset()` in the browser console. */
(window as unknown as { eloiseReset: () => void }).eloiseReset = () => {
  GameState.get().resetWorld();
  window.location.reload();
};

/** Dev: the Phaser game handle, for inspecting scene lifecycle from the console. */
(window as unknown as { eloiseGame: Phaser.Game }).eloiseGame = game;

/** Dev: the GameState singleton, for inspecting run state from the console. */
(window as unknown as { eloiseState: GameState }).eloiseState = GameState.get();

/** Dev: unlock a power immediately — e.g. eloiseGrant("glide"). Reloads. */
(window as unknown as { eloiseGrant: (id: AbilityId) => void }).eloiseGrant = (id) => {
  const s = GameState.get();
  s.unlockedAbilities.add(id);
  s.persist();
  window.location.reload();
};

/** Dev: jump straight into a sandbox level (grants its power first). */
type DemoName = "glide" | "dash" | "wallClimb" | "charge";
const DEMO_LEVELS = { glide: GLIDE_DEMO_LEVEL, dash: DASH_DEMO_LEVEL, wallClimb: WALL_CLIMB_DEMO_LEVEL, charge: CHARGE_DEMO_LEVEL } as const;
const DEMO_GRANTS: Record<DemoName, AbilityId[]> = {
  glide: ["glide"],
  dash: ["doubleJump", "dash"], // dash gate assumes the Kitchen loadout
  wallClimb: ["doubleJump", "dash", "wallClimb"], // wall-climb gate assumes the Family Room loadout
  charge: ["doubleJump", "dash", "wallClimb", "charge"], // charge gate assumes the Backyard loadout
};
(window as unknown as { eloiseLoadDemo: (which: DemoName) => void }).eloiseLoadDemo = (which) => {
  const s = GameState.get();
  for (const id of DEMO_GRANTS[which]) s.unlockedAbilities.add(id);
  s.persist();
  s.beginRun();
  const sm = game.scene;
  sm.stop("GameScene");
  sm.stop("UIScene");
  const gs = sm.getScene("GameScene") as GameScene;
  // create() loads the catalog level first; override it once create completes.
  gs.events.once(Phaser.Scenes.Events.CREATE, () => gs.devLoadLevel(DEMO_LEVELS[which]));
  sm.start("GameScene");
};

/** Dev: preview a power-intro cutscene standalone — e.g. eloiseLoadCutscene("cat").
 *  Types: "teddy" | "dog" | "cat" | "horse" | "flamingo". */
(window as unknown as { eloiseLoadCutscene: (type: CompanionType) => void }).eloiseLoadCutscene = (type) => {
  const sm = game.scene;
  sm.stop("GameScene");
  sm.stop("UIScene");
  sm.stop("MenuScene");
  sm.stop("BossScene");
  sm.start("CutsceneScene", { script: powerIntroScript(type), standalone: true });
};

/** Dev: jump straight into the T-Rex boss arena (grants all powers, refills hearts).
 *  Set eloiseState.tokensCollected = 0 first to test the companion bailout. */
(window as unknown as { eloiseLoadBoss: () => void }).eloiseLoadBoss = () => {
  const s = GameState.get();
  for (const id of ["doubleJump", "dash", "wallClimb", "charge", "glide"] as AbilityId[]) {
    s.unlockedAbilities.add(id);
  }
  if (s.tokensCollected === 0) s.tokensCollected = 25; // give some ammo by default
  s.persist();
  s.beginRun();
  const sm = game.scene;
  sm.stop("GameScene");
  sm.stop("UIScene");
  sm.start("BossScene");
};
