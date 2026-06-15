# Scripted Cutscene System (power intros) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable scripted-cutscene engine and wire all 5 power-intro cutscenes (companion bounces in → demonstrates its move on a little stage → power is named), replacing the static `PowerUnlockScene` modal on companion pickup.

**Architecture:** A pure, Phaser-free timeline controller (`src/systems/cutscene.ts`) sequences a `CutsceneBeat[]` by duration and handles skip/complete — unit-tested like `bossFight.ts`. A thin `CutsceneScene` renders the current beat as an **additive card** (elements persist across beats, so the card builds up to mockup-C). Scripts are data (`src/config/cutscenes.ts`), built from `COMPANIONS` + `ABILITIES` + `COMPANION_LABELS`. The intro (7.4) and ending (7.5) reuse the engine via a designed seam (new beat kinds; controller untouched).

**Tech Stack:** TypeScript (strict), Phaser 3.80, Vitest. Spec: `docs/superpowers/specs/2026-06-07-cutscene-system-design.md`.

---

## File structure

| File | Responsibility |
|---|---|
| `src/systems/cutscene.ts` | **New** — pure timeline controller: `CutsceneBeat`/`CutsceneScript`/`DemoMotion` types + `initCutscene`/`advanceCutscene`/`skipBeat`/`skipAll`/`currentBeat`. No Phaser. |
| `src/systems/cutscene.test.ts` | **New** — unit tests for the controller. |
| `src/config/cutscenes.ts` | **New** — `POWER_INTRO_MOTION` map + `powerIntroScript(type)`. |
| `src/config/cutscenes.test.ts` | **New** — unit tests for the scripts. |
| `src/scenes/CutsceneScene.ts` | **New** — thin Phaser shell: additive card, demo tweens, skip UI, `cutscene-complete`. Authored in ONE pass (a recycled-scene + `noUnusedLocals` discipline — see spec §8). |
| `src/scenes/PowerUnlockScene.ts` | **Deleted** — superseded. |
| `src/scenes/GameScene.ts` | Swap the `companion-collected` handler to launch `CutsceneScene`. |
| `src/main.ts` | Unregister `PowerUnlockScene`, register `CutsceneScene`, add `eloiseLoadCutscene` dev helper. |
| `ROADMAP.md` / `CLAUDE.md` | Mark 7.3.5 done; update Current Status. |

**Commands:** `npm test` runs the whole Vitest suite (`vitest run`). A single file: `npx vitest run <path>`. The full gate is `npm run build` (`tsc --noEmit && vitest run && vite build` — includes the reachability lint + texture smoke). Baseline at plan start: **311 passing**.

---

## Task 1: Pure timeline controller (TDD)

**Files:**
- Create: `src/systems/cutscene.ts`
- Test: `src/systems/cutscene.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/systems/cutscene.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  initCutscene,
  advanceCutscene,
  skipBeat,
  skipAll,
  currentBeat,
  type CutsceneScript,
} from "./cutscene";

const SCRIPT: CutsceneScript = {
  id: "test",
  backdrop: "dimGame",
  beats: [
    { kind: "caption", text: "a", durationMs: 100 },
    { kind: "caption", text: "b", durationMs: 100 },
    { kind: "caption", text: "c", durationMs: 100 },
  ],
};

describe("cutscene timeline controller", () => {
  it("starts at beat 0, not done", () => {
    const s = initCutscene();
    expect(s).toEqual({ beatIndex: 0, elapsedMs: 0, done: false });
    expect(currentBeat(s, SCRIPT)).toEqual(SCRIPT.beats[0]);
  });

  it("does not transition before the beat's duration", () => {
    const { state, transitioned } = advanceCutscene(initCutscene(), SCRIPT, 99);
    expect(transitioned).toBe(false);
    expect(state.beatIndex).toBe(0);
    expect(state.elapsedMs).toBe(99);
  });

  it("transitions exactly at the duration boundary", () => {
    const { state, transitioned } = advanceCutscene(initCutscene(), SCRIPT, 100);
    expect(transitioned).toBe(true);
    expect(state.beatIndex).toBe(1);
    expect(state.elapsedMs).toBe(0);
  });

  it("carries remainder across multiple beats in one large step", () => {
    const { state, transitioned } = advanceCutscene(initCutscene(), SCRIPT, 250);
    expect(transitioned).toBe(true);
    expect(state.beatIndex).toBe(2);
    expect(state.elapsedMs).toBe(50);
    expect(state.done).toBe(false);
  });

  it("completes (done + null beat) past the last beat", () => {
    const { state, transitioned } = advanceCutscene(initCutscene(), SCRIPT, 1000);
    expect(transitioned).toBe(true);
    expect(state.done).toBe(true);
    expect(currentBeat(state, SCRIPT)).toBeNull();
  });

  it("advancing a done cutscene is a no-op", () => {
    const done = skipAll(initCutscene(), SCRIPT);
    const { state, transitioned } = advanceCutscene(done, SCRIPT, 100);
    expect(transitioned).toBe(false);
    expect(state.done).toBe(true);
  });

  it("skipBeat jumps to the next beat", () => {
    const { state, transitioned } = skipBeat(initCutscene(), SCRIPT);
    expect(transitioned).toBe(true);
    expect(state.beatIndex).toBe(1);
    expect(state.elapsedMs).toBe(0);
  });

  it("skipBeat from the last beat completes", () => {
    const last = { beatIndex: 2, elapsedMs: 0, done: false };
    const { state } = skipBeat(last, SCRIPT);
    expect(state.done).toBe(true);
    expect(currentBeat(state, SCRIPT)).toBeNull();
  });

  it("skipAll completes immediately", () => {
    const s = skipAll(initCutscene(), SCRIPT);
    expect(s.done).toBe(true);
    expect(currentBeat(s, SCRIPT)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/systems/cutscene.test.ts`
Expected: FAIL — `Failed to resolve import "./cutscene"` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/systems/cutscene.ts`:

```ts
/**
 * The cutscene timeline — a PURE, Phaser-free controller (mirrors bossFight.ts /
 * airJump.ts so it's deterministically unit-testable; a real-time, input-driven
 * sequence can't be reachability-lint-proven). CutsceneScene feeds it elapsed-time
 * deltas + skip events and renders the beat it reports. It tracks ONLY which beat
 * we're on, the in-beat elapsed time, and done-ness — never pixel positions.
 */

export type DemoMotion = "doubleHop" | "dash" | "climb" | "charge" | "glide";

export type CutsceneBeat =
  | { kind: "enter"; actor: string; sprite: string; entrance: "bounceIn" | "fadeIn"; durationMs: number }
  | { kind: "caption"; text: string; durationMs: number }
  | { kind: "demo"; actor: string; motion: DemoMotion; loops: number; durationMs: number }
  | { kind: "title"; text: string; durationMs: number }
  | { kind: "hold"; durationMs: number };

export interface CutsceneScript {
  id: string;
  beats: CutsceneBeat[];
  /** Power intros dim the game; the 7.4/7.5 specs will add their own backdrops. */
  backdrop: "dimGame";
}

export interface CutsceneState {
  beatIndex: number;
  elapsedMs: number;
  done: boolean;
}

export function initCutscene(): CutsceneState {
  return { beatIndex: 0, elapsedMs: 0, done: false };
}

export function currentBeat(state: CutsceneState, script: CutsceneScript): CutsceneBeat | null {
  if (state.done || state.beatIndex >= script.beats.length) return null;
  return script.beats[state.beatIndex];
}

/**
 * Advance by `dtMs`. Pure: returns a fresh state + whether a beat boundary was
 * crossed (entering a new beat OR completing). A large dtMs deterministically
 * crosses multiple short beats, carrying the remainder into the next.
 */
export function advanceCutscene(
  state: CutsceneState,
  script: CutsceneScript,
  dtMs: number,
): { state: CutsceneState; transitioned: boolean } {
  if (state.done) return { state, transitioned: false };

  let beatIndex = state.beatIndex;
  let elapsedMs = state.elapsedMs + dtMs;
  let done = false;
  let transitioned = false;

  while (beatIndex < script.beats.length) {
    const dur = script.beats[beatIndex].durationMs;
    if (elapsedMs >= dur) {
      elapsedMs -= dur;
      beatIndex += 1;
      transitioned = true;
      if (beatIndex >= script.beats.length) {
        done = true;
        elapsedMs = 0;
        break;
      }
    } else {
      break;
    }
  }

  return { state: { beatIndex, elapsedMs, done }, transitioned };
}

/** Tap-ahead: jump to the start of the next beat (or complete from the last). */
export function skipBeat(
  state: CutsceneState,
  script: CutsceneScript,
): { state: CutsceneState; transitioned: boolean } {
  if (state.done) return { state, transitioned: false };
  const beatIndex = state.beatIndex + 1;
  if (beatIndex >= script.beats.length) {
    return { state: { beatIndex: script.beats.length, elapsedMs: 0, done: true }, transitioned: true };
  }
  return { state: { beatIndex, elapsedMs: 0, done: false }, transitioned: true };
}

/** Global skip: end the cutscene now. */
export function skipAll(_state: CutsceneState, script: CutsceneScript): CutsceneState {
  return { beatIndex: script.beats.length, elapsedMs: 0, done: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/systems/cutscene.test.ts`
Expected: PASS — 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/systems/cutscene.ts src/systems/cutscene.test.ts
git commit -m "feat(cutscene): pure timeline controller (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Power-intro scripts (TDD)

**Files:**
- Create: `src/config/cutscenes.ts`
- Test: `src/config/cutscenes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/config/cutscenes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { powerIntroScript, POWER_INTRO_MOTION } from "./cutscenes";
import { COMPANIONS } from "./companions";
import { ABILITIES } from "./abilities";
import { COMPANION_LABELS, type CompanionType } from "../design/levelSketches";

const TYPES: CompanionType[] = ["teddy", "dog", "cat", "horse", "flamingo"];

describe("powerIntroScript", () => {
  it("builds a valid script for all five companions", () => {
    for (const type of TYPES) {
      const script = powerIntroScript(type);
      expect(script.id).toBe(`power-intro-${type}`);
      expect(script.backdrop).toBe("dimGame");
      expect(script.beats.length).toBeGreaterThan(0);
    }
  });

  it("each intro is under 10 seconds (the acceptance criterion)", () => {
    for (const type of TYPES) {
      const total = powerIntroScript(type).beats.reduce((sum, b) => sum + b.durationMs, 0);
      expect(total).toBeLessThanOrEqual(10000);
    }
  });

  it("the demo beat's motion matches the companion's mapped motion", () => {
    for (const type of TYPES) {
      const demo = powerIntroScript(type).beats.find((b) => b.kind === "demo");
      expect(demo?.kind).toBe("demo");
      if (demo?.kind === "demo") {
        expect(demo.motion).toBe(POWER_INTRO_MOTION[type]);
      }
    }
  });

  it("the title names the granted ability; the caption names the companion", () => {
    for (const type of TYPES) {
      const beats = powerIntroScript(type).beats;
      const label = ABILITIES[COMPANIONS[type].grants].label.toUpperCase();
      const title = beats.find((b) => b.kind === "title");
      const caption = beats.find((b) => b.kind === "caption");
      expect(title?.kind).toBe("title");
      if (title?.kind === "title") expect(title.text).toContain(label);
      expect(caption?.kind).toBe("caption");
      if (caption?.kind === "caption") expect(caption.text).toContain(COMPANION_LABELS[type]);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/config/cutscenes.test.ts`
Expected: FAIL — `Failed to resolve import "./cutscenes"`.

- [ ] **Step 3: Write the implementation**

Create `src/config/cutscenes.ts`:

```ts
import type { CompanionType } from "../design/levelSketches";
import { COMPANION_LABELS } from "../design/levelSketches";
import { COMPANIONS } from "./companions";
import { ABILITIES } from "./abilities";
import type { CutsceneScript, DemoMotion } from "../systems/cutscene";

/**
 * Each companion's signature move, shown as a looping mini-demo. Compile-time
 * exhaustive (no `default`): adding a CompanionType without a motion is a type error.
 */
export const POWER_INTRO_MOTION: Record<CompanionType, DemoMotion> = {
  teddy: "doubleHop",
  dog: "dash",
  cat: "climb",
  horse: "charge",
  flamingo: "glide",
};

/**
 * Build a power-intro cutscene for a companion. Five additive beats (~7.0s total):
 * the companion bounces in → caption → looping demo → power-name pop → hold.
 */
export function powerIntroScript(type: CompanionType): CutsceneScript {
  const def = COMPANIONS[type];
  const ability = ABILITIES[def.grants];
  return {
    id: `power-intro-${type}`,
    backdrop: "dimGame",
    beats: [
      { kind: "enter", actor: "companion", sprite: def.idleKey, entrance: "bounceIn", durationMs: 600 },
      { kind: "caption", text: `${COMPANION_LABELS[type]} joined you!`, durationMs: 400 },
      { kind: "demo", actor: "companion", motion: POWER_INTRO_MOTION[type], loops: 2, durationMs: 3000 },
      { kind: "title", text: `${ability.label.toUpperCase()}!`, durationMs: 1500 },
      { kind: "hold", durationMs: 1500 },
    ],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/config/cutscenes.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config/cutscenes.ts src/config/cutscenes.test.ts
git commit -m "feat(cutscene): data-driven power-intro scripts for all 5 companions (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The `CutsceneScene` rendering shell (one pass)

No unit test — a Phaser scene is smoke-tested in-browser (like `BossScene`). Per spec §8 it is authored as **one complete file** in a single task (incremental scene-building fails `noUnusedLocals` on write-only fields — the lesson from the boss build).

**Files:**
- Create: `src/scenes/CutsceneScene.ts`

- [ ] **Step 1: Write the complete scene file**

Create `src/scenes/CutsceneScene.ts`:

```ts
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
    // Any key hurries to the next beat. (ESC intentionally NOT bound: GameScene is
    // still active behind the cutscene and owns ESC = pause; a tap is enough.)
    this.input.keyboard?.on("keydown", () => this.onTap());
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
        this.addCompanion(beat.sprite);
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
    }
  }

  private addCompanion(spriteKey: string): void {
    if (this.companion) this.companion.destroy();
    const c = this.add.sprite(this.stageX, this.stageY, spriteKey).setOrigin(0.5, 1).setDepth(20);
    c.setScale(0.0001); // bounce in from nothing
    this.tweens.add({ targets: c, scale: 0.09 * S, duration: 420, ease: "Back.easeOut" });
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS — no errors (in particular no `noUnusedLocals`/`noUnusedParameters` errors; every private field is read in a method, and unused callback params are underscore-prefixed).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/CutsceneScene.ts
git commit -m "feat(cutscene): CutsceneScene shell — additive card + demo tweens + skip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Integration — swap the hook, register, delete the old modal

**Files:**
- Modify: `src/scenes/GameScene.ts` (imports + the `companion-collected` handler, lines ~20 and ~93-106)
- Modify: `src/main.ts` (import, scene array line 45, dev helper)
- Delete: `src/scenes/PowerUnlockScene.ts`

- [ ] **Step 1: Add the import to `GameScene.ts`**

In `src/scenes/GameScene.ts`, immediately after the existing line:

```ts
import type { CompanionType } from "../design/levelSketches";
```

add:

```ts
import { powerIntroScript } from "../config/cutscenes";
```

- [ ] **Step 2: Swap the `companion-collected` handler in `GameScene.ts`**

Replace this exact block (currently lines ~93-106):

```ts
    this.events.on("companion-collected", (info: { type: CompanionType }) => {
      this.physics.world.pause();
      // Also halt update() so Player.tick stops reading input — otherwise the
      // key that dismisses the reveal buffers a jump that fires on resume.
      GameState.get().paused = true;
      const reveal = this.scene.get("PowerUnlockScene");
      reveal.events.once("power-unlock-dismissed", () => {
        this.scene.stop("PowerUnlockScene");
        GameState.get().paused = false;
        this.physics.world.resume();
        this.game.canvas?.focus();
      });
      this.scene.launch("PowerUnlockScene", { type: info.type });
    });
```

with:

```ts
    this.events.on("companion-collected", (info: { type: CompanionType }) => {
      this.physics.world.pause();
      // Also halt update() so Player.tick stops reading input — otherwise a key
      // pressed during the cutscene buffers a jump that fires on resume.
      GameState.get().paused = true;
      const cutscene = this.scene.get("CutsceneScene");
      cutscene.events.once("cutscene-complete", () => {
        this.scene.stop("CutsceneScene");
        GameState.get().paused = false;
        this.physics.world.resume();
        this.game.canvas?.focus();
      });
      this.scene.launch("CutsceneScene", { script: powerIntroScript(info.type) });
    });
```

- [ ] **Step 3: Update `main.ts` — import, registry, dev helper**

In `src/main.ts`, replace the import line:

```ts
import { PowerUnlockScene } from "./scenes/PowerUnlockScene";
```

with:

```ts
import { CutsceneScene } from "./scenes/CutsceneScene";
import { powerIntroScript } from "./config/cutscenes";
import type { CompanionType } from "./design/levelSketches";
```

Replace the scene array (line 45):

```ts
  scene: [BootScene, MenuScene, GameScene, UIScene, PowerUnlockScene, BossScene],
```

with:

```ts
  scene: [BootScene, MenuScene, GameScene, UIScene, CutsceneScene, BossScene],
```

Then add this dev helper just before the `eloiseLoadBoss` helper (near the bottom):

```ts
/** Dev: preview a power-intro cutscene standalone — e.g. eloiseLoadCutscene("cat").
 *  Types: "teddy" | "dog" | "cat" | "horse" | "flamingo". */
(window as unknown as { eloiseLoadCutscene: (type: CompanionType) => void }).eloiseLoadCutscene = (type) => {
  const sm = game.scene;
  sm.stop("GameScene");
  sm.stop("UIScene");
  sm.stop("MenuScene");
  sm.start("CutsceneScene", { script: powerIntroScript(type), standalone: true });
};
```

- [ ] **Step 4: Delete the superseded scene**

```bash
git rm src/scenes/PowerUnlockScene.ts
```

- [ ] **Step 5: Verify no dangling references**

Run: `grep -rn "PowerUnlockScene\|power-unlock-dismissed" src`
Expected: no output (every reference removed).

- [ ] **Step 6: Full build gate**

Run: `npm run build`
Expected: PASS — tsc clean, **all tests pass** (311 baseline + 13 new = **324**), reachability lint over the 25 catalog levels unchanged, texture smoke green, vite build ok.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/GameScene.ts src/main.ts
git commit -m "feat(cutscene): wire 5 power intros on pickup; delete PowerUnlockScene

Swap GameScene's companion-collected hook to launch CutsceneScene (identical
pause/resume choreography). Register CutsceneScene in main.ts, add
eloiseLoadCutscene dev helper. PowerUnlockScene deleted (superseded).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: Runtime smoke (in-browser, the human-handoff part)**

Start the dev server (`preview_start` "Game Dev Server", or `npm run dev`). In the browser console, for each of `"teddy"`, `"dog"`, `"cat"`, `"horse"`, `"flamingo"`:

```js
eloiseLoadCutscene("teddy")
```

Confirm for each: the dim + framed card render; the companion bounces in; the caption fades in; the demo loops on the stage with the right motion; the power-name pops; it auto-completes (~7s) back to the menu; a tap hurries; the `skip ▸` button bails; **no console errors**. Then do a real pickup (play to a companion or `eloiseGrant` + reach one) and confirm gameplay **resumes** with the power usable after the cutscene.

---

## Task 5: Docs — mark 7.3.5 done

**Files:**
- Modify: `ROADMAP.md` (the 7.3.5 line ~475)
- Modify: `CLAUDE.md` (Current Status)

- [ ] **Step 1: Check off ROADMAP 7.3.5**

In `ROADMAP.md`, change:

```markdown
- [ ] **7.3.5 — Scripted cutscene system (power intros + intro/ending engine)** — *requested 2026-06-03*
```

to:

```markdown
- [x] **7.3.5 — Scripted cutscene system (power intros + intro/ending engine)** — *requested 2026-06-03; engine + all 5 power intros BUILT 2026-06-07. Pure `cutscene.ts` timeline controller + thin `CutsceneScene` (additive card, looping demo tweens, hybrid auto-play + tap-ahead + skip) + data-driven `powerIntroScript`. Replaces the PowerUnlockScene modal. Intro 7.4 / ending 7.5 reuse the engine via the page/clear/fade seam. Spec/plan in `docs/superpowers/`.*
```

- [ ] **Step 2: Update `CLAUDE.md` Current Status**

In `CLAUDE.md`, in the Playhouse/boss "Remaining boss-adjacent work" sentence, change `the scripted cutscene system (7.3.5),` so it reads `the scripted cutscene system (7.3.5 — DONE 2026-06-07),`. Add a one-line status entry after the Playhouse paragraph:

```markdown
**Cutscene system (7.3.5):** BUILT (2026-06-07). Reusable scripted-sequence engine — a pure `src/systems/cutscene.ts` timeline controller (Phaser-free, unit-tested) behind a thin `src/scenes/CutsceneScene.ts` (additive card that builds up; companion bounces in → caption → looping demo tween → power-name pop → hold; hybrid auto-play with tap-ahead + a `skip ▸` bail). Scripts are data (`src/config/cutscenes.ts`, `powerIntroScript`). All 5 power intros (Teddy→double-jump, Dog→dash, Cat→wall-climb, Horse→charge, Flamingo→glide) fire on companion pickup, replacing the deleted `PowerUnlockScene` modal — identical pause/resume choreography at GameScene's `companion-collected` hook. The 7.4 intro / 7.5 ending reuse the engine via a designed `page`/`clear`/`fade` beat-kind seam. Dev helper `eloiseLoadCutscene(type)`. Spec/plan in `docs/superpowers/`.
```

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md CLAUDE.md
git commit -m "docs(cutscene): 7.3.5 done — ROADMAP check-off + CLAUDE Current Status

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage** (each spec requirement → task):
- Pure timeline controller (spec §4.2) → Task 1. ✓
- Beat vocabulary / `CutsceneScript` (§4.1) → Task 1. ✓
- `powerIntroScript` for all 5, exhaustive motion map, ≤10s (§5) → Task 2. ✓
- `CutsceneScene` additive card + demo tweens + skip UI + SHUTDOWN teardown (§4.3/§4.5/§6/§8) → Task 3. ✓
- Drop-in at `companion-collected`, identical pause/resume, delete PowerUnlockScene, register CutsceneScene (§7) → Task 4. ✓
- Testing: `cutscene.test.ts` + `cutscenes.test.ts`; build gate; runtime smoke (§9) → Tasks 1, 2, 4. ✓
- Reuse seam for 7.4/7.5 (§4.4) → encoded in the `backdrop` field + the beat-kind switch (open to new kinds); no task needed now. ✓
- Out-of-scope items (§11: VO, 7.4/7.5 content, real art, retiring prompts, Eloise-mimic) → correctly absent. ✓

**Placeholder scan:** none — every step has complete code and exact commands.

**Type consistency:** `CutsceneState`/`CutsceneScript`/`CutsceneBeat`/`DemoMotion` and `initCutscene`/`advanceCutscene`/`skipBeat`/`skipAll`/`currentBeat` are defined in Task 1 and used identically in Tasks 2–3. `powerIntroScript`/`POWER_INTRO_MOTION` defined in Task 2, imported in Tasks 3-data and 4. The `{ script, standalone? }` scene-data shape matches between `CutsceneScene` (Task 3) and both call sites (Task 4: `{ script }` from GameScene, `{ script, standalone: true }` from the dev helper). `cutscene-complete` event name matches between `finish()` (Task 3) and GameScene's listener (Task 4). `0.09 * S` companion scale and the `stageX/stageY/stageHalfW` reads are internally consistent.
