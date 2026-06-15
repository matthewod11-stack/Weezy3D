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
      expect(script.beats.length).toBe(5);
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

  it("maps each companion to its correct signature motion", () => {
    expect(POWER_INTRO_MOTION).toEqual({
      teddy: "doubleHop",
      dog: "dash",
      cat: "climb",
      horse: "charge",
      flamingo: "glide",
    });
  });

  it("has the fixed 5-beat shape in order", () => {
    const kinds = powerIntroScript("teddy").beats.map((b) => b.kind);
    expect(kinds).toEqual(["enter", "caption", "demo", "title", "hold"]);
  });
});
