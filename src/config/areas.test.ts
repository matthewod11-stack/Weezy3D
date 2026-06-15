import { describe, it, expect } from "vitest";
import { AREA_ORDER, areaIndex } from "./areas";

describe("area order", () => {
  it("lists the six areas in play order", () => {
    expect(AREA_ORDER).toEqual([
      "bedroom", "hallway", "kitchen", "familyRoom", "backyard", "dollhouse",
    ]);
  });
  it("areaIndex returns position, -1 for unknown", () => {
    expect(areaIndex("hallway")).toBe(1);
    expect(areaIndex("dollhouse")).toBe(5);
  });
});
