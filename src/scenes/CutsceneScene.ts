import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from "../config/game";
import {
  initCutscene,
  advanceCutscene,
  skipBeat,
  skipAll,
  currentBeat,
  type CutsceneState,
  type CutsceneScript,
  type CutsceneBeat,
  type DemoMotion,
} from "../systems/cutscene";

const S = RENDER_SCALE;

interface CutsceneSceneData {
  script: CutsceneScript;
  /** Dev/standalone launch (no GameScene behind): return to the menu on complete. */
  standalone?: boolean;
}

/**
 * Renders a CutsceneScript over the dimmed game — the thin Phaser shell over the
 * pure `cutscene` timeline controller (mirrors BossScene over bossFight). Additive
 * card: elements persist across beats, so the card builds up (mockup C). Used for
 * the 5 power intros; 7.4/7.5 will reuse it via new beat kinds.
 */
export class CutsceneScene extends Phaser.Scene {
  private script!: CutsceneScript;
  private cs!: CutsceneState;
  private standalone = false;
  private ended = false;

  // Persistent card geometry (set in buildCard, read in the demo tweens).
  private stageX = 0;
  private stageY = 0; // demo "floor": where the companion stands
  private stageHalfW = 0;

  // Additive elements (created as their beats are entered).
  private companion: Phaser.GameObjects.Sprite | null = null;
  private caption: Phaser.GameObjects.Text | null = null;
  private title: Phaser.GameObjects.Text | null = null;
  private demoTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super({ key: "CutsceneScene" });
  }

  create(data: CutsceneSceneData): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.script = data.script;
    this.standalone = data.standalone ?? false;
    this.cs = initCutscene();
    this.ended = false;
    this.companion = null;
    this.caption = null;
    this.title = null;
    this.demoTween = null;

    this.buildCard();
    this.bindInput();

    // Render the first beat now (entering beat 0 isn't reported as a transition).
    const first = currentBeat(this.cs, this.script);
    if (first) this.enterBeat(first);
  }

  private buildCard(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Dim the game; interactive → tap anywhere hurries to the next beat.
    this.add
      .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x2a1020, 0.82)
      .setDepth(0)
      .setInteractive()
      .on("pointerdown", () => this.onTap());

    // Card frame.
    const cardW = GAME_WIDTH * 0.74;
    const cardH = GAME_HEIGHT * 0.66;
    const card = this.add.rectangle(cx, cy, cardW, cardH, 0xfff8f0).setDepth(10);
    card.setStrokeStyle(3 * S, 0xff1493);

    // Demo stage (the little diorama).
    const stageW = cardW * 0.6;
    const stageH = cardH * 0.42;
    this.add.rectangle(cx, cy, stageW, stageH, 0xe9f6ff).setDepth(12).setStrokeStyle(2 * S, 0xbfe3ff);
    this.add.rectangle(cx, cy + stageH / 2 - 3 * S, stageW, 6 * S, 0xc8a96b).setDepth(13); // ground

    this.stageX = cx;
    this.stageY = cy + stageH / 2 - 6 * S;
    this.stageHalfW = stageW / 2 - 10 * S;

    // Skip button (corner) — bails the whole cutscene. Topmost; stops the tap.
    const skip = this.add
      .text(GAME_WIDTH - 8 * S, GAME_HEIGHT - 8 * S, "skip ▸", {
        fontFamily: "monospace", fontSize: `${9 * S}px`,
        color: "#ffffff", backgroundColor: "rgba(0,0,0,0.45)",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(1, 1)
      .setDepth(1000)
      .setInteractive();
    skip.on(
      "pointerdown",
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.onSkipAll();
      },
    );
  }

  private bindInput(): void {
    // Any key EXCEPT Escape hurries to the next beat. ESC belongs to GameScene
    // (pause); it's also neutralized at the wiring layer while a cutscene runs.
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.code === "Escape") return;
      this.onTap();
    });
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    const { state, transitioned } = advanceCutscene(this.cs, this.script, delta);
    this.cs = state;
    if (transitioned) this.onTransition();
  }

  private onTap(): void {
    if (this.ended) return;
    const { state, transitioned } = skipBeat(this.cs, this.script);
    this.cs = state;
    if (transitioned) this.onTransition();
  }

  private onSkipAll(): void {
    if (this.ended) return;
    this.cs = skipAll(this.cs, this.script);
    this.finish();
  }

  private onTransition(): void {
    if (this.cs.done) {
      this.finish();
      return;
    }
    const beat = currentBeat(this.cs, this.script);
    if (beat) this.enterBeat(beat);
  }

  /** Render one beat's entrance. Elements persist (additive card). */
  private enterBeat(beat: CutsceneBeat): void {
    switch (beat.kind) {
      case "enter":
        this.addCompanion(beat.sprite, beat.entrance);
        break;
      case "caption":
        this.addCaption(beat.text);
        break;
      case "demo":
        this.playDemo(beat.motion);
        break;
      case "title":
        this.addTitle(beat.text);
        break;
      case "hold":
        break;
      default: {
        // Exhaustiveness guard: a new beat kind (e.g. the 7.4/7.5 page/clear/fade
        // reuse seam) must add a renderer here — fail the build, never silently no-op.
        const _never: never = beat;
        throw new Error(`CutsceneScene.enterBeat: unhandled beat ${String(_never)}`);
      }
    }
  }

  private addCompanion(spriteKey: string, entrance: "bounceIn" | "fadeIn"): void {
    if (this.companion) this.companion.destroy();
    const c = this.add.sprite(this.stageX, this.stageY, spriteKey).setOrigin(0.5, 1).setDepth(20);
    if (entrance === "fadeIn") {
      c.setScale(0.09 * S).setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 300 });
    } else {
      c.setScale(0.0001); // bounce in from nothing
      this.tweens.add({ targets: c, scale: 0.09 * S, duration: 420, ease: "Back.easeOut" });
    }
    this.companion = c;
  }

  private addCaption(text: string): void {
    if (this.caption) this.caption.destroy();
    const t = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.27, text, {
        fontFamily: "monospace", fontSize: `${12 * S}px`,
        color: "#2a1020", stroke: "#fff8f0", strokeThickness: 3, align: "center",
      })
      .setOrigin(0.5).setDepth(25).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 250 });
    this.caption = t;
  }

  private addTitle(text: string): void {
    if (this.title) this.title.destroy();
    const t = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.72, text, {
        fontFamily: "monospace", fontSize: `${16 * S}px`,
        color: "#ff1493", stroke: "#fff8f0", strokeThickness: 4,
      })
      .setOrigin(0.5).setDepth(25).setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 360, ease: "Back.easeOut" });
    this.title = t;
  }

  /** The looping mini-demo: scripted tweens of the companion sprite on the stage. */
  private playDemo(motion: DemoMotion): void {
    const c = this.companion;
    if (!c) return;
    if (this.demoTween) { this.demoTween.stop(); this.demoTween = null; }
    const homeX = this.stageX;
    const homeY = this.stageY;
    const reach = this.stageHalfW;

    switch (motion) {
      case "doubleHop":
        c.setPosition(homeX, homeY);
        this.demoTween = this.tweens.add({
          targets: c, y: homeY - 26 * S, duration: 300, yoyo: true, repeat: -1, ease: "Quad.easeOut",
        });
        break;
      case "dash":
        c.setPosition(homeX - reach, homeY);
        this.demoTween = this.tweens.add({
          targets: c, x: homeX + reach, duration: 360, yoyo: true, repeat: -1, ease: "Quad.easeInOut",
        });
        break;
      case "climb":
        c.setPosition(homeX + reach * 0.6, homeY);
        this.demoTween = this.tweens.add({
          targets: c, y: homeY - 44 * S, duration: 700, repeat: -1, ease: "Sine.easeInOut",
        });
        break;
      case "charge":
        c.setPosition(homeX - reach, homeY);
        c.setFlipX(false);
        this.demoTween = this.tweens.add({
          targets: c, x: homeX + reach, duration: 480, repeat: -1, ease: "Quad.easeIn",
        });
        break;
      case "glide":
        c.setPosition(homeX - reach * 0.5, homeY - 40 * S);
        this.demoTween = this.tweens.add({
          targets: c, x: homeX + reach * 0.5, y: homeY, duration: 1000, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
        });
        break;
      default: {
        // Exhaustiveness guard: a new DemoMotion must add a tween here.
        const _never: never = motion;
        throw new Error(`CutsceneScene.playDemo: unhandled motion ${String(_never)}`);
      }
    }
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    if (this.demoTween) { this.demoTween.stop(); this.demoTween = null; }
    this.events.emit("cutscene-complete");
    if (this.standalone) this.scene.start("MenuScene");
  }

  private teardown(): void {
    if (this.demoTween) { this.demoTween.stop(); this.demoTween = null; }
    this.input.keyboard?.off("keydown");
    this.companion = null;
    this.caption = null;
    this.title = null;
    this.ended = false;
  }
}
