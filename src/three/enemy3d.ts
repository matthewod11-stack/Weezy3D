import { PHYSICS } from "../config/physics";
import { RENDER_SCALE } from "../config/game";
import type { EnemySpawn } from "../types/level";
import { bodyRect, type PhysRect, type PlayerState } from "./physics3d";

/**
 * Pure enemy logic for the 3D renderer — no Three.js, no DOM. Mirrors the 2D
 * Enemy.tick patrol and GameScene.isStomp / handleEnemyOverlap discrimination.
 * Simulates in render px, y-down (the scaled-LevelData space), same as physics3d.
 */

export type EnemyKind = EnemySpawn["type"];

export interface EnemyState {
  type: EnemyKind;
  /** Body center x, body bottom (feet) y — render px, y-down. */
  x: number;
  y: number;
  vy: number;
  dir: 1 | -1;
  speed: number;
  patrolLeft: number;
  patrolRight: number;
  w: number;
  h: number;
  defeated: boolean;
  onGround: boolean;
}

export interface EnemyStepResult {
  /** Indices of enemies defeated by a stomp this step. */
  stomps: number[];
  /** True if any live enemy dealt contact damage this step. */
  damaged: boolean;
}

/** Body boxes in render px, matching the 2D entity hitboxes. */
const ENEMY_BODY: Record<EnemyKind, { w: number; h: number }> = {
  dustBunny: { w: 50, h: 40 },
  spider: { w: 50, h: 40 },
  ant: { w: 46, h: 26 },
  dustMite: { w: 46, h: 26 },
};

const MAX_DELTA_MS = 50;

export function createEnemyState(spawn: EnemySpawn): EnemyState {
  const body = ENEMY_BODY[spawn.type];
  return {
    type: spawn.type,
    x: spawn.x,
    y: spawn.y,
    vy: 0,
    dir: 1,
    speed: spawn.speed,
    patrolLeft: spawn.patrolLeft,
    patrolRight: spawn.patrolRight,
    w: body.w,
    h: body.h,
    defeated: false,
    onGround: false,
  };
}

export function enemyRect(e: EnemyState): PhysRect {
  return { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h };
}

function overlaps(a: PhysRect, b: PhysRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Mirror of GameScene.isStomp: falling fast, feet at/above enemy top, aligned. */
function isStomp(player: PlayerState, e: EnemyState): boolean {
  if (player.vy < 60 * RENDER_SCALE) return false;
  const enemyTop = e.y - e.h;
  if (player.y > enemyTop + 8 * RENDER_SCALE) return false;
  return Math.abs(player.x - e.x) < e.w * 0.55;
}

/** Advance all enemies one frame (mutates state in place). */
export function stepEnemies(
  enemies: EnemyState[],
  player: PlayerState,
  deltaMs: number,
  solids: readonly PhysRect[],
): EnemyStepResult {
  const dt = Math.min(deltaMs, MAX_DELTA_MS) / 1000;
  const result: EnemyStepResult = { stomps: [], damaged: false };
  const pr = bodyRect(player);

  enemies.forEach((e, i) => {
    if (e.defeated) return;

    // Patrol (mirror Enemy.tick: constant velocity, flip at bounds).
    e.x += e.dir * e.speed * dt;
    if (e.x <= e.patrolLeft) e.dir = 1;
    else if (e.x >= e.patrolRight) e.dir = -1;

    // Gravity + ground rest (trimmed physics3d Y resolution).
    e.vy += PHYSICS.GRAVITY_DOWN * dt;
    e.y += e.vy * dt;
    e.onGround = false;
    let rect = enemyRect(e);
    for (const solid of solids) {
      if (!overlaps(rect, solid)) continue;
      if (e.vy > 0) {
        e.y = solid.y;
        e.vy = 0;
        e.onGround = true;
        rect = enemyRect(e);
      }
    }

    // Player contact → classify stomp vs damage.
    if (overlaps(enemyRect(e), pr)) {
      if (isStomp(player, e)) {
        e.defeated = true;
        result.stomps.push(i);
      } else {
        result.damaged = true;
      }
    }
  });

  return result;
}
