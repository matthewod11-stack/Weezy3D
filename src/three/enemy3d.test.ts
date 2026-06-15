import { describe, expect, it } from "vitest";
import { createPlayerState, type PhysRect, type PlayerState } from "./physics3d";
import { createEnemyState, stepEnemies, type EnemyState } from "./enemy3d";
import { RENDER_SCALE } from "../config/game";

const S = RENDER_SCALE;

function enemyAt(over: Partial<EnemyState> = {}): EnemyState {
  return {
    ...createEnemyState({ type: "dustBunny", x: 1000, y: 1000, patrolLeft: 900, patrolRight: 1100, speed: 1000 }),
    ...over,
  };
}

// A wide floor under y=1000 so enemies rest instead of drifting.
const FLOOR: PhysRect[] = [{ x: 0, y: 1000, w: 4000, h: 60 }];

describe("stepEnemies — patrol", () => {
  it("flips direction at the right bound", () => {
    const e = enemyAt({ x: 1099, dir: 1, speed: 1000 });
    stepEnemies([e], createPlayerState(0, 0), 50, FLOOR); // +50px → past 1100
    expect(e.dir).toBe(-1);
  });

  it("flips direction at the left bound", () => {
    const e = enemyAt({ x: 901, dir: -1, speed: 1000 });
    stepEnemies([e], createPlayerState(0, 0), 50, FLOOR); // -50px → past 900
    expect(e.dir).toBe(1);
  });

  it("flips when exactly AT the right bound (inclusive >=, not >)", () => {
    // speed 0 holds x precisely at patrolRight through the step, so this only
    // passes with `>=` — a future `>` regression would leave dir at 1.
    const e = enemyAt({ x: 1100, dir: 1, speed: 0 });
    stepEnemies([e], createPlayerState(0, 0), 16, FLOOR);
    expect(e.dir).toBe(-1);
  });
});

describe("stepEnemies — stomp vs damage", () => {
  it("classifies a falling, aligned, overhead player as a stomp", () => {
    const e = enemyAt({ x: 1000, y: 1000 });
    const player: PlayerState = { ...createPlayerState(1000, 965), vy: 200 * S }; // feet just above enemy top (960)
    const res = stepEnemies([e], player, 16, FLOOR);
    expect(res.stomps).toEqual([0]);
    expect(res.damaged).toBe(false);
    expect(e.defeated).toBe(true);
  });

  it("classifies a side overlap (not falling) as damage", () => {
    const e = enemyAt({ x: 1000, y: 1000 });
    const player: PlayerState = { ...createPlayerState(1008, 1000), vy: 0 }; // same row, beside the enemy
    const res = stepEnemies([e], player, 16, FLOOR);
    expect(res.damaged).toBe(true);
    expect(res.stomps).toEqual([]);
    expect(e.defeated).toBe(false);
  });

  it("classifies an overhead overlap falling just BELOW the velocity gate as damage", () => {
    // Same geometry as the stomp case, but vy one px/s under 60·S — pins the
    // falling-speed threshold: not falling fast enough → damage, not a stomp.
    const e = enemyAt({ x: 1000, y: 1000 });
    const player: PlayerState = { ...createPlayerState(1000, 965), vy: 60 * S - 1 };
    const res = stepEnemies([e], player, 16, FLOOR);
    expect(res.damaged).toBe(true);
    expect(res.stomps).toEqual([]);
    expect(e.defeated).toBe(false);
  });

  it("a defeated enemy deals no damage and is not re-stomped", () => {
    const e = enemyAt({ x: 1000, y: 1000, defeated: true });
    const player: PlayerState = { ...createPlayerState(1000, 1000), vy: 0 };
    const res = stepEnemies([e], player, 16, FLOOR);
    expect(res.damaged).toBe(false);
    expect(res.stomps).toEqual([]);
  });
});

describe("stepEnemies — gravity + ground rest", () => {
  it("falls onto and rests on the floor", () => {
    const e = enemyAt({ x: 1000, y: 940, vy: 0 }); // start above the floor top (1000)
    for (let i = 0; i < 30; i += 1) stepEnemies([e], createPlayerState(0, 0), 16, FLOOR);
    expect(e.y).toBeCloseTo(1000, 1);
    expect(e.onGround).toBe(true);
  });
});

describe("stepEnemies — multiple enemies", () => {
  it("steps each enemy independently (stomp one, leave the distant one)", () => {
    const stomped = enemyAt({ x: 1000, y: 1000 });
    const distant = enemyAt({ x: 1200, y: 1000, patrolLeft: 1100, patrolRight: 1300 });
    const player: PlayerState = { ...createPlayerState(1000, 965), vy: 200 * S };
    const res = stepEnemies([stomped, distant], player, 16, FLOOR);
    expect(res.stomps).toEqual([0]);
    expect(stomped.defeated).toBe(true);
    expect(distant.defeated).toBe(false); // out of the player's body → untouched
  });
});
