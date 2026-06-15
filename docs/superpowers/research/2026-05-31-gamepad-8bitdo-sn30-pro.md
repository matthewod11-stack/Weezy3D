# Gamepad Support Research — 8BitDo SN30 Pro × Princess Eloise (Phaser web game)

**Date:** 2026-05-31
**Purpose:** Brief for a future planning session that will design controller button mapping. Research only — no code changes.
**Game:** "Princess Eloise — Bedroom World", HD-2D pixel platformer for kids 4–8. Phaser 3.80, TypeScript (strict), Vite 6. Target: Web (itch.io HTML5), desktop + tablet.
**Controller:** 8BitDo SN30 Pro **Wireless** (the compact SNES-styled pad WITH two analog sticks + L3/R3 — not the larger "Pro+" / "Pro 2").

> **Verification note.** Mode combos, layout, the standard mapping, and Phaser API names below are sourced from the docs cited inline. The single most important claim to confirm on the physical pad before finalizing the mapping is **which physical button reports as Gamepad index 0 in X-input mode** (see §2 and §6). Anything I could not fully verify against a primary source is tagged **unverified — confirm against the physical controller.**

---

## 1. Physical layout

The SN30 Pro is shaped like a SNES pad with two symmetrical analog sticks squeezed into the lower middle; **the sticks click for L3/R3**. (This distinguishes it from the original stick-less SN30, and matches the SN30 Pro+/Pro 2 stick set minus the grips.) ([iMore controller comparison](https://www.imore.com/gaming/best-8bitdo-controller-gaming), [Best Buy Q&A — sticks click L3/R3](https://www.bestbuy.com/site/questions/8bitdo-sn30-pro-usb-gamepad-sn-edition-gray/6434343/question/39d35bde-acf5-3cbc-8c30-d211a0ecf585), [Vocal Media overview](https://vocal.media/gamers/8bitdo-s-sn30-and-fc30-pro-controller-overview))

Controls present:

- **D-pad** — central-left, single cross.
- **Face buttons A / B / X / Y** — right cluster, in **Nintendo/SNES physical placement** (see callout below).
- **Shoulders:** L1 / R1 (bumpers, top) and L2 / R2 (triggers, below the bumpers — the pad uses a two-level shoulder placement). ([8BitDo SN30 Pro layout — shop/support pages](https://support.8bitdo.com/faq/sn30-pro.html))
- **Select** and **Start** — center.
- **Home** button — center (doubles as a Screenshot/STAR-style key in some modes). ([gamepad-cheatsheet, SN30 Pro+ — STAR=Turbo in D/X-input, Screenshot in Switch](http://denilson.sa.nom.br/gamepad-cheatsheet/8BitDo_SN30_Pro_Plus.html))
- **Pair button** — on the top edge; hold 3 s to enter pairing. ([SparkFun pairing guide](https://learn.sparkfun.com/tutorials/getting-started-with-the-8bitdo-bluetooth-gamepads/sn30-pro-hardware-pairing))
- **Two analog sticks** with **L3 / R3** click.

### ⚠️ Nintendo vs Xbox face-button placement (load-bearing for index mapping)

8BitDo uses **Nintendo physical placement** by default: **top = X, left = Y, right = A, bottom = B**. This is *swapped* relative to Xbox, where bottom = A and right = B. So the physical button labeled **A** (right) is NOT the same position as an Xbox A (bottom). ([cemu-project/Cemu #327 — face-button layout discussion](https://github.com/cemu-project/Cemu/issues/327))

The practical consequence: in **X-input mode** the controller reports itself as an Xbox pad, so the **physical bottom button (labeled B on the shell) reports as Gamepad API index 0 = the "standard" A** that Phaser exposes as `pad.A`. The printed letters on the pad will therefore not match `pad.A/B/X/Y` — design the mapping by **physical position**, not by printed letter. ([cemu-project/Cemu #327](https://github.com/cemu-project/Cemu/issues/327), [Steam Link discussion on 8BitDo X-input remap](https://steamcommunity.com/app/353380/discussions/0/6051221329352350699/))

---

## 2. Bluetooth input modes (critical)

The SN30 Pro selects an input mode by the **button held while powering on**. Each mode changes how the OS/browser enumerates the device and therefore which index a physical button reports. ([Manuals+ SN30 Pro / SF30 Pro](https://manuals.plus/8bitdo/8bitdo-sn30-pro-sf30-pro-user-manual), [8BitDo support manual](https://support.8bitdo.com/Manual/sn30-pro/), [manua.ls SN30 Pro](https://www.manua.ls/8bitdo/sn30-pro/manual))

| Mode | Power-on combo | Intended platform | LEDs |
|---|---|---|---|
| **X-input** | **Start + X** | Windows / Xbox-style | LEDs 1 & 2 blink |
| **D-input** | **Start + B** | Android / generic DirectInput | LED 1 blinks (varies) |
| **macOS** | **Start + A** | macOS | LEDs 1, 2 & 3 blink |
| **Switch** | **Start + Y** | Nintendo Switch | LED 4 region |

After choosing a mode, **hold Pair 3 s**; the LED runs back-and-forth while pairing, then settles solid when connected. ([SparkFun](https://learn.sparkfun.com/tutorials/getting-started-with-the-8bitdo-bluetooth-gamepads/sn30-pro-hardware-pairing)) You can also short-cycle modes by holding Start ~3 s, which rotates X-input → D-input → macOS → Switch. ([manua.ls](https://www.manua.ls/8bitdo/sn30-pro/manual))

> The exact LED-per-mode patterns vary slightly across firmware revisions — **unverified — confirm against the physical controller.** The power-on combos themselves are consistent across the manual sources above and the SN30 Pro+ cheatsheet.

### Recommended mode for a desktop browser: **X-input**

X-input is the safest choice for the Gamepad API. In X-input the pad enumerates as an Xbox 360-style controller, which browsers map to the **W3C "standard" layout** (`Gamepad.mapping === "standard"`), giving stable, well-documented button indices. ([MDN — Gamepad.mapping](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/mapping), [JSGuides — prefer standard, fall back for DirectInput](https://jsguides.dev/guides/javascript-gamepad-api/))

- **D-input** often enumerates as a generic device with `mapping === ""` (empty) and a non-standard, vendor-specific index order — avoid for a kid game where the mapping must "just work."
- **macOS mode** is meant for macOS apps; in a browser it can still land non-standard. On a Mac, **Chrome with the pad in X-input mode** is the most reliable combo and is what I'd target for development.

> **#1 gotcha:** the *same physical button reports a different index in different modes.* Build/test the mapping in **one fixed mode (X-input)** and tell players which mode to use, or detect `mapping !== "standard"` and show a "switch your controller to X-input (Start+X)" hint.

---

## 3. Browser Gamepad API basics

- **Discovery:** Listen for the `gamepadconnected` event on `window`. If the pad was already connected at page load, **the event does not fire until the user presses a button or moves an axis** — a deliberate anti-fingerprinting / privacy gate (explicit in Firefox; same practical behavior across browsers). ([MDN — Using the Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API))
- **Reading state:** `navigator.getGamepads()` returns a **snapshot array** (first slot is often `null`). You must **re-call it and read the current object by index every frame** — do not cache a Gamepad object from the connect event. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API), [MDN — getGamepads()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getGamepads))
- **Disconnect:** `gamepaddisconnected` fires when a pad the page had data from goes away. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API))
- **Buttons/axes shape:** each `buttons[i]` has `.pressed` (bool) and `.value` (0–1, analog for triggers); `axes[]` are floats −1..1. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API))
- **Bluetooth reconnection:** MDN does not document BT-specific reconnect behavior. In practice a BT pad that sleeps/reconnects fires a fresh `gamepadconnected` (often at a new index), and again **stays invisible until the next button press.** Treat reconnection as "re-discover by index on the next input." **unverified by a primary spec source — confirm behavior on the physical pad.**

### Standard mapping — button indices (W3C "Standard Gamepad")

Source: [W3C Gamepad spec — Standard Gamepad mapping](https://w3c.github.io/gamepad/), corroborated by [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API).

| Index | Standard meaning | Xbox label | Phaser accessor |
|---|---|---|---|
| 0 | bottom face | A | `pad.A` |
| 1 | right face | B | `pad.B` |
| 2 | left face | X | `pad.X` |
| 3 | top face | Y | `pad.Y` |
| 4 | left shoulder | LB | `pad.L1` |
| 5 | right shoulder | RB | `pad.R1` |
| 6 | left trigger (analog) | LT | `pad.L2` |
| 7 | right trigger (analog) | RT | `pad.R2` |
| 8 | center-left | View/Back/Select | `pad.getButtonValue(8)` |
| 9 | center-right | Menu/Start | `pad.getButtonValue(9)` |
| 10 | left stick click | L3 | `pad.getButtonValue(10)` |
| 11 | right stick click | R3 | `pad.getButtonValue(11)` |
| 12 | D-pad up | — | `pad.up` |
| 13 | D-pad down | — | `pad.down` |
| 14 | D-pad left | — | `pad.left` |
| 15 | D-pad right | — | `pad.right` |
| 16 | center (Home) | Guide | `pad.getButtonValue(16)` |

**Axes (standard):** `axes[0]` left-stick X (−left/+right), `axes[1]` left-stick Y (−up/+down), `axes[2]` right-stick X, `axes[3]` right-stick Y; all −1..1. ([W3C spec](https://w3c.github.io/gamepad/))

> Reminder from §1: in X-input the **physical B (bottom) → index 0 → `pad.A`**. Map by position, verify with a live index readout. **unverified — confirm against the physical controller.**

---

## 4. Phaser 3.80 gamepad integration

Verified against the official Phaser input skill/reference docs via Context7 ([/phaserjs/phaser](https://github.com/phaserjs/phaser/blob/master/skills/input-keyboard-mouse-touch/SKILL.md)).

- **Must enable in game config** — the gamepad plugin is off by default:
  ```ts
  const config: Phaser.Types.Core.GameConfig = {
    input: { gamepad: true },
    // ...rest of config
  };
  ```
- **Plugin:** `this.input.gamepad` (a `Phaser.Input.Gamepad.GamepadPlugin`); the first pad is `this.input.gamepad.pad1` (also `pad2`…`pad4`), each a `Phaser.Input.Gamepad.Gamepad`.
- **Events** (plugin-level fire for any pad):
  ```ts
  this.input.gamepad.on('connected',    (pad) => {/* ... */});
  this.input.gamepad.on('disconnected', (pad) => {/* ... */});
  this.input.gamepad.on('down', (pad, button, value) => {/* button.index */});
  this.input.gamepad.on('up',   (pad, button, value) => {/* ... */});
  ```
  Per-pad: `pad.on('down', (index, value, button) => {...})`.
- **Convenience accessors:** `pad.A/B/X/Y` (bool, Xbox naming = standard index 0–3), `pad.up/down/left/right` (D-pad bool), `pad.L1/L2/R1/R2` (float 0–1), `pad.leftStick`/`pad.rightStick` (Vector2, −1..1). Raw: `pad.isButtonDown(i)`, `pad.getButtonValue(i)`, `pad.getAxisValue(i)`.
- **Deadzone:** `pad.setAxisThreshold(0.1)` ignores stick values below the threshold (prevents resting-stick drift). Apply it on connect.
- **Polling:** read `pad` state in the scene's `update()` each frame (don't cache across frames); use events for discrete presses (jump). The Phaser plugin internally polls `navigator.getGamepads()`, so the "press a button to appear" gate from §3 still applies — `pad1` is `undefined` until the first input.

### Code sketch — enable + read move/jump

```ts
// game config
input: { gamepad: true }

// in a GameScene
create() {
  this.input.gamepad?.once('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
    pad.setAxisThreshold(0.15);            // deadzone — stop resting drift
  });

  // discrete press = jump (also handles double-jump via existing keyboard logic path)
  this.input.gamepad?.on('down', (pad, button) => {
    if (button.index === 0) this.tryJump();        // standard A = jump
    else if (button.index === 1) this.usePower();  // standard B = context power
  });
}

update() {
  const pad = this.input.gamepad?.pad1;
  if (!pad) return;                                  // not yet pressed → invisible

  // Horizontal move: left stick OR D-pad (both, for free)
  const stickX = pad.leftStick.x;                    // already deadzoned
  if (pad.left  || stickX < -0.5) this.player.moveLeft();
  else if (pad.right || stickX > 0.5) this.player.moveRight();
  else this.player.stopHorizontal();

  // Wall-climb: Up held (mirrors keyboard Up/W) — D-pad up OR stick up
  this.player.setClimbHeld(pad.up || pad.leftStick.y < -0.5);

  // Glide is "hold the power button while falling" → poll B held, let the
  // single power dispatcher resolve Dash/Glide/Charge by context (see §5)
  this.player.setPowerHeld(pad.B);
}
```

---

## 5. Recommended mapping for THIS game

Design goals: **tiny, forgiving, no combos, no per-power buttons** — same scheme as the keyboard. Map the game's five verbs to the two largest, easiest face buttons + a directional Up, plus Start for pause. Use **X-input mode** so indices are standard.

| Game verb (keyboard) | Controller input | Rationale |
|---|---|---|
| **Move** (←/→, A-D) | **Left stick X** + **D-pad ←/→** (both live) | Kids grab whichever; horizontal only, so stick Y is ignored for movement. |
| **Jump / Double-Jump** (Space) | **Standard A** (index 0 — the **bottom** face button) `pad.A` | Bottom face button = universal "jump." Second mid-air press = double-jump, exactly like the keyboard. |
| **Power button** (context-sensitive: Dash press / Glide hold / Charge smash) (X) | **Standard B** (index 1 — the **right** face button) `pad.B` | One button next to jump. Single dispatcher resolves Dash/Glide/Charge by context — `down` = Dash/Charge tap, *held while falling* = Glide. |
| **Wall-Climb** (Up/W held) | **Up held** — **D-pad up** OR **left-stick up** | Mirrors the deliberate keyboard choice ("up to go up"); keeps it off the power button. |
| **Pause** (Esc) | **Start** (index 9) | Conventional pause; out of the way so a 4-yo won't hit it by accident. |

Deliberately **unused** for core actions: triggers (L2/R2), shoulders (L1/R1), right stick, Select, Home, L3/R3. Little kids can't reliably modulate triggers and shouldn't need a second stick. Leave shoulders unbound (or, later, an optional mirror of jump on R1 for left-handed comfort — a planning decision, not a requirement).

### Button → index table for the chosen mode (X-input / standard)

| Physical button (shell label) | Position | Std index | Phaser | Bound to |
|---|---|---|---|---|
| **B** (Nintendo label) | bottom | **0** | `pad.A` | **Jump / Double-Jump** |
| **A** (Nintendo label) | right | **1** | `pad.B` | **Power button** |
| Y | left | 2 | `pad.X` | (unused) |
| X | top | 3 | `pad.Y` | (unused) |
| D-pad ↑ | — | 12 | `pad.up` | **Climb (held)** |
| D-pad ←/→ | — | 14 / 15 | `pad.left` / `pad.right` | **Move** |
| Start | center | 9 | `getButtonValue(9)` | **Pause** |
| Left stick | — | axes 0/1 | `pad.leftStick` | **Move (X)** + Climb (up) |

> The "shell label vs index" swap in rows 1–2 is the crux: the button **printed B** is your **Jump** because in X-input it reports as index 0 / `pad.A`. **Verify on the physical pad with a live index readout before locking the mapping.**

---

## 6. Practical gotchas + kid UX

- **"Press a button to connect" prompt.** Because the pad is invisible until first input (§3), show a friendly, non-blocking hint ("Press any button on your controller to play with it!") rather than assuming a connected pad. Don't gate the game on it.
- **Keyboard AND gamepad simultaneously, non-modal.** Never force a choice. Read both every frame and OR them together (a parent on keys, kid on pad). The sketch in §4 already does this for movement. Echo the same for jump/power so neither input path is "the" input.
- **Mode mismatch is the top support issue.** If `pad.pad1` connects but `pad1.pad.mapping !== "standard"` (D-input/macOS landed non-standard), the indices will be wrong. Detect it and surface a one-line, kid-parent-readable hint: *"Turn the controller on with Start + X."* Better than silently broken buttons.
- **Deadzones.** Call `setAxisThreshold(0.12–0.18)` on connect so a resting stick doesn't make Eloise creep. Use a generous move threshold (`|x| > 0.5`) so a wobbly little hand still registers a clear left/right.
- **No triggers/sticks for core verbs.** Already honored — every core action is a big face button or a D-pad/stick direction. Triggers are analog and hard for small kids; keep them out of the critical path.
- **Tablet / itch.io.** On touch tablets there's usually no gamepad; the existing touch controls remain primary. A BT pad *can* pair to an iPad/Android tablet, but enumeration in the mobile browser is inconsistent — treat gamepad as a **desktop enhancement**, keep touch + keyboard as the baseline. ([itch.io HTML5 export is a plain web page — same Gamepad API rules apply])
- **Reconnection.** After BT sleep, re-discover on next press; don't show an error if `pad1` momentarily goes `undefined`.
- **Double-jump timing.** Jump is a discrete `down` event (index 0), so a fast double-tap naturally produces two events — wire it into the existing `tryJump()` so the air-jump unlock logic is reused, not duplicated.

---

## Open questions for the planning session

1. **Confirm physical→index mapping on the real pad.** Power on in X-input (Start+X), open a gamepad tester ([controllertest.io](https://controllertest.io/gamepad-mapping-test/)), and confirm the **bottom** button = index 0 and `mapping === "standard"`. Lock the table in §5 against reality.
2. **Which mode do we tell players to use, and do we enforce it?** Recommend X-input. Decide whether to detect non-standard mapping and prompt, or just document it in the itch.io page.
3. **Power button: tap vs hold semantics on the pad.** Confirm the single dispatcher can read both `down` (Dash/Charge) and *held-while-falling* (Glide) cleanly off one button (`pad.B`) without a combo.
4. **Optional left-handed/comfort mirror?** e.g., R1 also = jump. Tiny add, or scope creep? Planning call.
5. **Tablet stance.** Confirm gamepad is desktop-only enhancement and touch stays primary on itch.io tablet play.
6. **Where does gamepad input live in the code?** A small `GamepadController` adapter feeding the same intent flags the keyboard sets (move/jump/power/climb/pause) keeps it DRY and non-modal — confirm this is the intended seam vs reading pad state directly in `GameScene`.
7. **Visual button prompts.** If we show on-screen prompts, do we draw Xbox-style (matches standard indices) or Nintendo-style (matches the shell)? They disagree — pick one and be consistent.

---

### Sources

- MDN — [Using the Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API), [Gamepad.mapping](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/mapping), [Navigator.getGamepads()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getGamepads)
- W3C — [Gamepad spec (Standard Gamepad mapping & axes)](https://w3c.github.io/gamepad/)
- Phaser docs (via Context7 `/phaserjs/phaser`) — [input keyboard/mouse/touch/gamepad SKILL + REFERENCE](https://github.com/phaserjs/phaser/blob/master/skills/input-keyboard-mouse-touch/SKILL.md)
- 8BitDo manuals — [official SN30 Pro manual](https://support.8bitdo.com/Manual/sn30-pro/), [Manuals+ SN30 Pro/SF30 Pro](https://manuals.plus/8bitdo/8bitdo-sn30-pro-sf30-pro-user-manual), [manua.ls SN30 Pro](https://www.manua.ls/8bitdo/sn30-pro/manual), [SparkFun pairing guide](https://learn.sparkfun.com/tutorials/getting-started-with-the-8bitdo-bluetooth-gamepads/sn30-pro-hardware-pairing)
- Layout / sticks — [iMore 8BitDo comparison](https://www.imore.com/gaming/best-8bitdo-controller-gaming), [Best Buy L3/R3 Q&A](https://www.bestbuy.com/site/questions/8bitdo-sn30-pro-usb-gamepad-sn-edition-gray/6434343/question/39d35bde-acf5-3cbc-8c30-d211a0ecf585), [gamepad-cheatsheet SN30 Pro+](http://denilson.sa.nom.br/gamepad-cheatsheet/8BitDo_SN30_Pro_Plus.html)
- Nintendo-vs-Xbox / X-input remap — [cemu-project/Cemu #327](https://github.com/cemu-project/Cemu/issues/327), [Steam Link discussion](https://steamcommunity.com/app/353380/discussions/0/6051221329352350699/), [JSGuides Gamepad API guide](https://jsguides.dev/guides/javascript-gamepad-api/)
- Tester for verification — [controllertest.io](https://controllertest.io/gamepad-mapping-test/)
