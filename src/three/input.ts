import type { FrameInput } from "./physics3d";

/**
 * Keyboard → FrameInput, replacing Phaser's CursorKeys. Edge flags
 * (pressed/released) accumulate between frames and are consumed by
 * readFrame() exactly once, so a tap between two rAF ticks is never lost.
 */
export class KeyboardInput {
  private held = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  private enabled = true;

  private static readonly GAME_CODES = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "KeyA",
    "KeyD",
    "KeyW",
    "KeyS",
    "Space",
  ]);

  attach(target: Window = window): void {
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    // A backgrounded tab never receives keyups — clear stuck keys.
    target.addEventListener("blur", this.clearAll);
  }

  detach(target: Window = window): void {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    target.removeEventListener("blur", this.clearAll);
  }

  /** Win/lose overlays freeze gameplay input without detaching listeners. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clearAll();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!KeyboardInput.GAME_CODES.has(e.code)) return;
    e.preventDefault();
    if (!this.enabled) return;
    // Repeats never (re)establish held state — only a real initial keydown
    // does. Guards against host environments with a stuck key that emits
    // repeat events with no matching initial press (seen in embedded
    // preview browsers); for real users the initial press already set held.
    if (e.repeat) return;
    if (!this.held.has(e.code)) {
      this.pressed.add(e.code);
    }
    this.held.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!KeyboardInput.GAME_CODES.has(e.code)) return;
    e.preventDefault();
    if (!this.enabled) return;
    if (this.held.has(e.code)) {
      this.released.add(e.code);
    }
    this.held.delete(e.code);
  };

  private clearAll = (): void => {
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
  };

  /** Snapshot the frame's input and consume the edge flags. */
  readFrame(): FrameInput {
    const input: FrameInput = {
      left: this.held.has("ArrowLeft") || this.held.has("KeyA"),
      right: this.held.has("ArrowRight") || this.held.has("KeyD"),
      jumpPressed: this.pressed.has("Space"),
      jumpReleased: this.released.has("Space"),
    };
    this.pressed.clear();
    this.released.clear();
    return input;
  }
}
