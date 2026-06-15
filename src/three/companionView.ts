import * as THREE from "three";
import { RENDER_SCALE } from "../config/game";
import { toWorldLen, toWorldX, toWorldY } from "./coords";
import { loadFrame, measureBottomMargin } from "./billboard";
import type { CompanionType } from "../design/levelSketches";

import teddyUrl from "../../assets/sprites/companions/storybook/teddy_idle.png?url";
import dogUrl from "../../assets/sprites/companions/storybook/dog_idle.png?url";
import catUrl from "../../assets/sprites/companions/storybook/cat_idle.png?url";
import horseUrl from "../../assets/sprites/companions/storybook/horse_idle.png?url";
import flamingoUrl from "../../assets/sprites/companions/storybook/flamingo_idle.png?url";

const URLS: Record<CompanionType, string> = {
  teddy: teddyUrl,
  dog: dogUrl,
  cat: catUrl,
  horse: horseUrl,
  flamingo: flamingoUrl,
};
const SCALE = 0.06 * RENDER_SCALE;
const COMPANION_Z = 0.06;

/**
 * A single idle companion billboard that gently bobs until collected.
 * Lifecycle: update(elapsed) drives the bob while uncollected; setCollected()
 * settles it to rest; setUncollected() restores the bob (level replay).
 */
export class CompanionView {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly baseY: number;
  private collected = false;

  private constructor(
    planeW: number,
    planeH: number,
    feetOffset: number,
    texture: THREE.Texture,
    x: number,
    y: number,
  ) {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), material);
    this.mesh.renderOrder = 9;
    this.baseY = toWorldY(y) + feetOffset;
    this.mesh.position.set(toWorldX(x), this.baseY, COMPANION_Z);
    this.group.add(this.mesh);
  }

  static async load(type: CompanionType, x: number, y: number): Promise<CompanionView> {
    const frame = await loadFrame(URLS[type]);
    const planeW = toWorldLen(frame.image.width * SCALE);
    const planeH = toWorldLen(frame.image.height * SCALE);
    const margin = measureBottomMargin(frame.image);
    const ratio = (frame.image.height - margin) / frame.image.height;
    const feetOffset = planeH * (ratio - 0.5);
    return new CompanionView(planeW, planeH, feetOffset, frame.texture, x, y);
  }

  /** Gentle idle bob; call per frame (no-op once collected). */
  update(elapsedMs: number): void {
    if (this.collected) return;
    this.mesh.position.y = this.baseY + Math.sin(elapsedMs / 420) * 0.08;
  }

  /** Settle to rest beside the met player. */
  setCollected(): void {
    this.collected = true;
    this.mesh.position.y = this.baseY;
  }

  /** Restore the waiting bob (level replay). */
  setUncollected(): void {
    this.collected = false;
  }
}
