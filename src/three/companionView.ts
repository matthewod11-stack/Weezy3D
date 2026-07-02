import * as THREE from "three";
import { RENDER_SCALE } from "../config/game";
import { toWorldLen, toWorldX, toWorldY } from "./coords";
import { type Frame, loadFrame, makeShadowBlob, measureBottomMargin } from "./billboard";
import type { CompanionType } from "../design/levelSketches";

import teddyUrl from "../../assets/sprites/companions/storybook/teddy_idle.png?url";
import teddyWalkUrl from "../../assets/sprites/companions/storybook/teddy_walk.png?url";
import dogUrl from "../../assets/sprites/companions/storybook/dog_idle.png?url";
import dogWalkUrl from "../../assets/sprites/companions/storybook/dog_walk.png?url";
import catUrl from "../../assets/sprites/companions/storybook/cat_idle.png?url";
import catWalkUrl from "../../assets/sprites/companions/storybook/cat_walk.png?url";
import horseUrl from "../../assets/sprites/companions/storybook/horse_idle.png?url";
import horseWalkUrl from "../../assets/sprites/companions/storybook/horse_walk.png?url";
import flamingoUrl from "../../assets/sprites/companions/storybook/flamingo_idle.png?url";
import flamingoWalkUrl from "../../assets/sprites/companions/storybook/flamingo_walk.png?url";

const URLS: Record<CompanionType, { idle: string; walk: string }> = {
  teddy: { idle: teddyUrl, walk: teddyWalkUrl },
  dog: { idle: dogUrl, walk: dogWalkUrl },
  cat: { idle: catUrl, walk: catWalkUrl },
  horse: { idle: horseUrl, walk: horseWalkUrl },
  flamingo: { idle: flamingoUrl, walk: flamingoWalkUrl },
};
const SCALE = 0.06 * RENDER_SCALE;
const COMPANION_Z = 0.06;
const SHADOW_Z = -0.3;
const FOLLOW_GAP_PX = 58;
const FOLLOW_RATE = 3; // per second (soft exponential ease)
const Y_FOLLOW_RATE = 6; // per second — tighter so it doesn't sink into floors
const WALK_FPS = 4;
const MOVE_EPSILON_PX_PER_SEC = 10;

/**
 * A single companion billboard. Bobs gently at its spawn until collected;
 * once collected, followUpdate() trails Eloise a step behind. Lifecycle:
 * update(elapsed) drives the bob while uncollected; setCollected() settles
 * it; setUncollected() returns it to spawn and clears follow state (level
 * replay — gotcha 12: every hide/move path has a symmetric restore).
 */
export class CompanionView {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly shadow: THREE.Mesh;
  private readonly feetOffset: number;
  private readonly spawnX: number;
  private readonly spawnY: number;
  private collected = false;
  /** Follow position in render px (feet), lerped toward the trail target. */
  private curX: number;
  private curY: number;
  private facing: 1 | -1 = 1;
  private clockMs = 0;

  private constructor(
    planeW: number,
    planeH: number,
    feetOffset: number,
    private readonly idle: Frame,
    private readonly walk: Frame | null,
    x: number,
    y: number,
  ) {
    this.material = new THREE.MeshBasicMaterial({
      map: idle.texture,
      transparent: true,
      alphaTest: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), this.material);
    this.mesh.renderOrder = 9;
    this.feetOffset = feetOffset;
    this.spawnX = x;
    this.spawnY = y;
    this.curX = x;
    this.curY = y;
    this.mesh.position.set(toWorldX(x), toWorldY(y) + feetOffset, COMPANION_Z);
    this.group.add(this.mesh);

    this.shadow = makeShadowBlob(planeW * 0.35);
    this.shadow.position.set(toWorldX(x), toWorldY(y) + 0.012, SHADOW_Z);
    this.group.add(this.shadow);
  }

  static async load(type: CompanionType, x: number, y: number): Promise<CompanionView> {
    const urls = URLS[type];
    const idle = await loadFrame(urls.idle);
    const walk = await loadFrame(urls.walk).catch(() => null);
    const planeW = toWorldLen(idle.image.width * SCALE);
    const planeH = toWorldLen(idle.image.height * SCALE);
    const margin = measureBottomMargin(idle.image);
    const ratio = (idle.image.height - margin) / idle.image.height;
    const feetOffset = planeH * (ratio - 0.5);
    return new CompanionView(planeW, planeH, feetOffset, idle, walk, x, y);
  }

  /** Gentle idle bob at spawn; call per frame (no-op once collected). */
  update(elapsedMs: number): void {
    if (this.collected) return;
    this.mesh.position.y = toWorldY(this.spawnY) + this.feetOffset + Math.sin(elapsedMs / 420) * 0.08;
  }

  /**
   * Trail Eloise once collected: soft-ease toward a spot a step behind her
   * (render px in, converted at the mesh). No-op while uncollected.
   */
  followUpdate(player: { x: number; y: number; facing: number }, dtMs: number): void {
    if (!this.collected) return;
    this.clockMs += dtMs;
    const dt = dtMs / 1000;

    const targetX = player.x - player.facing * FOLLOW_GAP_PX;
    const kx = 1 - Math.exp(-FOLLOW_RATE * dt);
    const ky = 1 - Math.exp(-Y_FOLLOW_RATE * dt);
    const dx = (targetX - this.curX) * kx;
    this.curX += dx;
    this.curY += (player.y - this.curY) * ky;

    const speed = dtMs > 0 ? Math.abs(dx) / dt : 0;
    const moving = speed > MOVE_EPSILON_PX_PER_SEC;
    if (moving) this.facing = dx >= 0 ? 1 : -1;

    let texture = this.idle.texture;
    if (moving && this.walk) {
      const on = Math.floor((this.clockMs / 1000) * WALK_FPS) % 2 === 1;
      texture = on ? this.walk.texture : this.idle.texture;
    }
    if (this.material.map !== texture) {
      this.material.map = texture;
      this.material.needsUpdate = true;
    }

    const bob = Math.sin(this.clockMs / 420) * 0.06;
    this.mesh.position.set(
      toWorldX(this.curX),
      toWorldY(this.curY) + this.feetOffset + bob,
      COMPANION_Z,
    );
    this.mesh.scale.x = this.facing === -1 ? -1 : 1;
    this.shadow.position.set(toWorldX(this.curX), toWorldY(this.curY) + 0.012, SHADOW_Z);
  }

  /** Settle to rest beside the met player; followUpdate() takes over. */
  setCollected(): void {
    this.collected = true;
    this.mesh.position.y = toWorldY(this.spawnY) + this.feetOffset;
  }

  /** Restore the waiting bob at spawn and clear follow state (level replay). */
  setUncollected(): void {
    this.collected = false;
    this.curX = this.spawnX;
    this.curY = this.spawnY;
    this.facing = 1;
    this.clockMs = 0;
    this.mesh.scale.x = 1;
    this.mesh.position.set(toWorldX(this.spawnX), toWorldY(this.spawnY) + this.feetOffset, COMPANION_Z);
    this.shadow.position.set(toWorldX(this.spawnX), toWorldY(this.spawnY) + 0.012, SHADOW_Z);
    if (this.material.map !== this.idle.texture) {
      this.material.map = this.idle.texture;
      this.material.needsUpdate = true;
    }
  }
}
