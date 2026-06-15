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

  it("skipBeat on a done cutscene is a no-op", () => {
    const done = skipAll(initCutscene(), SCRIPT);
    const { state, transitioned } = skipBeat(done, SCRIPT);
    expect(transitioned).toBe(false);
    expect(state.done).toBe(true);
  });
});
