import { describe, expect, it } from "vitest";
import {
  readGamepadFrame,
  type GamepadEdgeState,
  type GamepadSnapshot,
} from "./gamepad";

/** Standard-mapping gamepad with the given button indices held + axes set. */
function pad(opts: { down?: number[]; axes?: number[] } = {}): GamepadSnapshot {
  const down = new Set(opts.down ?? []);
  return {
    id: "8BitDo SN30 Pro",
    mapping: "standard",
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.has(i) })),
    axes: opts.axes ?? [0, 0, 0, 0],
  };
}

/**
 * Non-standard 8BitDo SN30 Pro (mapping:"") — D-pad is a HID 8-way hat on
 * axis 9. Real measured values: UP=-1, RIGHT=-0.429, DOWN=0.143, LEFT=0.714,
 * neutral≈3.286. The stick is still axis 0 and jump still button 0.
 */
function padHid(axis9: number, down: number[] = []): GamepadSnapshot {
  const heldSet = new Set(down);
  const axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, axis9];
  return {
    id: "8Bitdo SN30 Pro (Vendor: 2dc8 Product: 6101)",
    mapping: "",
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: heldSet.has(i) })),
    axes,
  };
}

const NO_EDGE: GamepadEdgeState = { jumpDown: false };

describe("readGamepadFrame — movement", () => {
  it("yields neutral input when no gamepad is connected", () => {
    const { input } = readGamepadFrame(null, NO_EDGE);
    expect(input).toEqual({
      left: false,
      right: false,
      jumpPressed: false,
      jumpReleased: false,
    });
  });

  it("maps the D-pad left button (14) to left", () => {
    const { input } = readGamepadFrame(pad({ down: [14] }), NO_EDGE);
    expect(input.left).toBe(true);
    expect(input.right).toBe(false);
  });

  it("maps the D-pad right button (15) to right", () => {
    const { input } = readGamepadFrame(pad({ down: [15] }), NO_EDGE);
    expect(input.right).toBe(true);
    expect(input.left).toBe(false);
  });

  it("maps the left stick X past the deadzone to a direction", () => {
    expect(readGamepadFrame(pad({ axes: [-0.9, 0] }), NO_EDGE).input.left).toBe(true);
    expect(readGamepadFrame(pad({ axes: [0.9, 0] }), NO_EDGE).input.right).toBe(true);
  });

  it("ignores left stick drift inside the deadzone", () => {
    const { input } = readGamepadFrame(pad({ axes: [0.2, 0] }), NO_EDGE);
    expect(input.left).toBe(false);
    expect(input.right).toBe(false);
  });
});

describe("readGamepadFrame — 8BitDo non-standard hat D-pad (axis 9)", () => {
  it("decodes hat RIGHT (-0.429) to right", () => {
    const { input } = readGamepadFrame(padHid(-0.429), NO_EDGE);
    expect(input.right).toBe(true);
    expect(input.left).toBe(false);
  });

  it("decodes hat LEFT (0.714) to left", () => {
    const { input } = readGamepadFrame(padHid(0.714), NO_EDGE);
    expect(input.left).toBe(true);
    expect(input.right).toBe(false);
  });

  it("treats hat UP (-1) and DOWN (0.143) as no horizontal movement", () => {
    expect(readGamepadFrame(padHid(-1), NO_EDGE).input).toMatchObject({ left: false, right: false });
    expect(readGamepadFrame(padHid(0.143), NO_EDGE).input).toMatchObject({ left: false, right: false });
  });

  it("includes the right component of the down-right diagonal (-0.143)", () => {
    expect(readGamepadFrame(padHid(-0.143), NO_EDGE).input.right).toBe(true);
  });

  it("treats the out-of-band neutral value (3.286) as released", () => {
    const { input } = readGamepadFrame(padHid(3.286), NO_EDGE);
    expect(input.left).toBe(false);
    expect(input.right).toBe(false);
  });

  it("treats an uninitialized 0 hat reading as released (no phantom down)", () => {
    const { input } = readGamepadFrame(padHid(0), NO_EDGE);
    expect(input.left).toBe(false);
    expect(input.right).toBe(false);
  });

  it("still reads jump from button 0 on a non-standard pad", () => {
    const { input } = readGamepadFrame(padHid(3.286, [0]), NO_EDGE);
    expect(input.jumpPressed).toBe(true);
  });
});

describe("readGamepadFrame — jump edges (variable-height jump)", () => {
  it("emits jumpPressed exactly once while the bottom face button is held", () => {
    const held = pad({ down: [0] });
    const f1 = readGamepadFrame(held, NO_EDGE);
    expect(f1.input.jumpPressed).toBe(true);

    const f2 = readGamepadFrame(held, f1.next);
    expect(f2.input.jumpPressed).toBe(false); // held, not a fresh press
  });

  it("emits jumpReleased exactly once when the button comes up", () => {
    const held = readGamepadFrame(pad({ down: [0] }), NO_EDGE);
    const released = readGamepadFrame(pad({ down: [] }), held.next);
    expect(released.input.jumpReleased).toBe(true);

    const after = readGamepadFrame(pad({ down: [] }), released.next);
    expect(after.input.jumpReleased).toBe(false);
  });
});

describe("readGamepadFrame — disconnection", () => {
  it("clears held jump state on disconnect without a phantom release", () => {
    const held = readGamepadFrame(pad({ down: [0] }), NO_EDGE);
    const gone = readGamepadFrame(null, held.next);
    expect(gone.input.jumpReleased).toBe(false);
    expect(gone.next.jumpDown).toBe(false); // reconnect-while-held re-fires a fresh press
  });
});
