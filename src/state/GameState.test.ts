import { describe, it, expect, beforeEach } from "vitest";
import { GameState } from "./GameState";

describe("GameState abilities", () => {
  beforeEach(() => GameState.get().resetWorld());

  it("starts with no abilities", () => {
    expect(GameState.get().hasAbility("doubleJump")).toBe(false);
  });
  it("collecting Teddy unlocks double jump and grants +1 max heart", () => {
    const s = GameState.get();
    s.collectCompanion("teddy");
    expect(s.hasAbility("doubleJump")).toBe(true);
    expect(s.maxHearts).toBe(4);
  });
  it("collecting a companion is idempotent", () => {
    const s = GameState.get();
    s.collectCompanion("teddy");
    s.collectCompanion("teddy");
    expect(s.maxHearts).toBe(4);
  });
  it("resetWorld clears abilities and hearts", () => {
    const s = GameState.get();
    s.collectCompanion("teddy");
    s.resetWorld();
    expect(s.hasAbility("doubleJump")).toBe(false);
    expect(s.maxHearts).toBe(3);
  });
});

describe("GameState beginRun", () => {
  beforeEach(() => GameState.get().resetWorld());

  it("clears the transient run flags that freeze GameScene.update", () => {
    const s = GameState.get();
    // State left behind after winning + pausing.
    s.worldComplete = true;
    s.paused = true;
    s.beginRun();
    expect(s.worldComplete).toBe(false);
    expect(s.paused).toBe(false);
  });

  it("refills hearts to max so a fresh run starts full", () => {
    const s = GameState.get();
    s.collectCompanion("teddy"); // maxHearts -> 4
    s.hearts = 1;
    s.beginRun();
    expect(s.hearts).toBe(s.maxHearts);
    expect(s.hearts).toBe(4);
  });

  it("preserves progress so Continue keeps level + tokens + abilities", () => {
    const s = GameState.get();
    s.collectCompanion("teddy");
    s.levelIndex = 2;
    s.tokensCollected = 7;
    s.worldComplete = true; // e.g. Continue after finishing
    s.beginRun();
    expect(s.levelIndex).toBe(2);
    expect(s.tokensCollected).toBe(7);
    expect(s.hasAbility("doubleJump")).toBe(true);
  });
});
