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
  | { kind: "demo"; actor: string; motion: DemoMotion; durationMs: number }
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
