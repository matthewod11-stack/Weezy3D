import { describe, it, expect } from "vitest";
import { isOnClimbWall, type Rect } from "./climbDetect";

const wall: Rect = { x: 100, y: 0, w: 20, h: 200 };

describe("isOnClimbWall", () => {
  it("is false when there are no walls", () => {
    expect(isOnClimbWall({ x: 100, y: 50, w: 10, h: 22 }, [])).toBe(false);
  });

  it("is true when the body overlaps a wall", () => {
    expect(isOnClimbWall({ x: 95, y: 50, w: 10, h: 22 }, [wall])).toBe(true);
  });

  it("is false when the body is horizontally clear of every wall", () => {
    expect(isOnClimbWall({ x: 200, y: 50, w: 10, h: 22 }, [wall])).toBe(false);
  });

  it("is false when the body is above/below the wall span", () => {
    expect(isOnClimbWall({ x: 100, y: 250, w: 10, h: 22 }, [wall])).toBe(false);
  });
});
