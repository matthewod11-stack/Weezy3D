import type { FrameInput } from "./physics3d";

/**
 * Gamepad → FrameInput for the 3D testbed, the controller sibling of
 * KeyboardInput. Standard-layout (8BitDo SN30 Pro and friends): D-pad / left
 * stick move, bottom face button jumps. Same pure-logic-behind-a-thin-shell
 * pattern as physics3d / enemy3d: readGamepadFrame() is pure and unit-tested;
 * GamepadInput is the thin poll-navigator wrapper.
 *
 * The Gamepad API is poll-based (no events for held buttons), so jump's
 * pressed/released edges are derived by diffing this frame's button state
 * against the previous frame's — mirroring KeyboardInput's edge flags.
 *
 * Mapping (W3C "standard" button indices):
 *   0  bottom face (A / cross / 8BitDo "B")  → JUMP
 *   1  right face  (B / circle / 8BitDo "A") → reserved for POWER once
 *                                              traversal powers port to 3D
 *                                              (playbook §5.4)
 *   14 D-pad left   15 D-pad right
 *   axis 0 = left stick X (-1 left … +1 right)
 */

const BTN_JUMP = 0;
const BTN_DPAD_LEFT = 14;
const BTN_DPAD_RIGHT = 15;
const AXIS_LX = 0;
/** Generous stick deadzone — kids' thumbs + Bluetooth drift. */
const STICK_DEADZONE = 0.35;

/**
 * Non-standard pads (mapping:"") expose the D-pad as a single HID "hat" axis
 * rather than buttons 14/15. Measured on an 8BitDo SN30 Pro over Bluetooth on
 * macOS (axis 9): UP=-1, RIGHT=-0.429, DOWN=0.143, LEFT=0.714, neutral≈3.286
 * — the canonical 8-way encoding, evenly spaced -1..1 from UP clockwise.
 */
const AXIS_HAT = 9;

/** Decode a HID 8-way hat value into horizontal direction booleans. */
function decodeHat(v: number): { left: boolean; right: boolean } {
  // Released: out-of-band neutral (~1.29 / 3.29) OR an uninitialized 0 reading
  // (which the formula below would otherwise round to "down").
  if (v > 1.05 || v < -1.05 || Math.abs(v) < 0.05) return { left: false, right: false };
  // Nearest of 8 positions, clockwise from UP: 0=U 1=UR 2=R 3=DR 4=D 5=DL 6=L 7=UL.
  const idx = Math.round(((v + 1) / 2) * 7) % 8;
  return {
    right: idx === 1 || idx === 2 || idx === 3,
    left: idx === 5 || idx === 6 || idx === 7,
  };
}

/** Structural subset of the browser Gamepad we actually read. */
export interface GamepadSnapshot {
  id: string;
  mapping: string;
  buttons: ReadonlyArray<{ pressed: boolean }>;
  axes: ReadonlyArray<number>;
}

/** Cross-frame state for edge detection (jump press/release). */
export interface GamepadEdgeState {
  jumpDown: boolean;
}

const NEUTRAL: FrameInput = {
  left: false,
  right: false,
  jumpPressed: false,
  jumpReleased: false,
};

function held(snapshot: GamepadSnapshot, index: number): boolean {
  return snapshot.buttons[index]?.pressed ?? false;
}

/**
 * Pure mapper: a gamepad snapshot (or null when disconnected) + the prior
 * frame's edge state → this frame's FrameInput and the next edge state.
 * No mutation; the caller threads `next` back in on the following frame.
 */
export function readGamepadFrame(
  snapshot: GamepadSnapshot | null,
  prev: GamepadEdgeState,
): { input: FrameInput; next: GamepadEdgeState } {
  // Disconnected: neutral input, and clear held jump so a reconnect-while-held
  // fires a fresh press rather than a phantom release.
  if (!snapshot) {
    return { input: { ...NEUTRAL }, next: { jumpDown: false } };
  }

  const x = snapshot.axes[AXIS_LX] ?? 0;
  // D-pad: standard pads use buttons 14/15; non-standard pads (8BitDo over BT)
  // route it through the hat axis. Either way it ORs with the analog stick.
  const dpad =
    snapshot.mapping === "standard"
      ? { left: held(snapshot, BTN_DPAD_LEFT), right: held(snapshot, BTN_DPAD_RIGHT) }
      : decodeHat(snapshot.axes[AXIS_HAT] ?? 0);
  const left = dpad.left || x < -STICK_DEADZONE;
  const right = dpad.right || x > STICK_DEADZONE;

  const jumpDown = held(snapshot, BTN_JUMP);
  const jumpPressed = jumpDown && !prev.jumpDown;
  const jumpReleased = !jumpDown && prev.jumpDown;

  return {
    input: { left, right, jumpPressed, jumpReleased },
    next: { jumpDown },
  };
}

type GetGamepads = () => ReadonlyArray<GamepadSnapshot | null>;

const browserGamepads: GetGamepads = () =>
  typeof navigator !== "undefined" && navigator.getGamepads
    ? (navigator.getGamepads() as ReadonlyArray<GamepadSnapshot | null>)
    : [];

/**
 * Thin shell over the pure mapper: polls the first connected gamepad each
 * frame and produces a FrameInput, OR-merged with the keyboard by the caller.
 */
export class GamepadInput {
  private prev: GamepadEdgeState = { jumpDown: false };
  private enabled = true;

  constructor(private readonly getGamepads: GetGamepads = browserGamepads) {}

  /** Win/lose overlays freeze input without losing the listener. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.prev = { jumpDown: false };
  }

  /** First connected pad, or null. (Multiple pads → player one.) */
  private active(): GamepadSnapshot | null {
    for (const g of this.getGamepads()) if (g) return g;
    return null;
  }

  /** True when at least one gamepad is connected. */
  connected(): boolean {
    return this.active() !== null;
  }

  readFrame(): FrameInput {
    if (!this.enabled) {
      this.prev = { jumpDown: false };
      return { ...NEUTRAL };
    }
    const { input, next } = readGamepadFrame(this.active(), this.prev);
    this.prev = next;
    return input;
  }

  /**
   * Live introspection for the in-browser mapping tester — lets a real
   * SN30 Pro reveal its actual button/axis indices when its Bluetooth pairing
   * mode reports a non-"standard" layout.
   */
  snapshot(): { id: string; mapping: string; buttons: boolean[]; axes: number[] } | null {
    const g = this.active();
    if (!g) return null;
    return {
      id: g.id,
      mapping: g.mapping,
      buttons: g.buttons.map((b) => b.pressed),
      axes: [...g.axes],
    };
  }
}
