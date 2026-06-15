import * as THREE from "three";
import { RENDER_SCALE } from "../config/game";
import { toWorldLen, toWorldX, toWorldY } from "./coords";
import { type Frame, loadFrame, measureBottomMargin } from "./billboard";
import type { PhysRect, PlayerState } from "./physics3d";

import eloiseIdleUrl from "../../assets/sprites/player/storybook/eloise_idle.png?url";
import eloiseJumpUrl from "../../assets/sprites/player/storybook/eloise_jump.png?url";
import eloiseWalk0Url from "../../assets/sprites/player/storybook/eloise_walk_0.png?url";
import eloiseWalk1Url from "../../assets/sprites/player/storybook/eloise_walk_1.png?url";
import eloiseWalk2Url from "../../assets/sprites/player/storybook/eloise_walk_2.png?url";
import eloiseWalk3Url from "../../assets/sprites/player/storybook/eloise_walk_3.png?url";
import eloiseWalk4Url from "../../assets/sprites/player/storybook/eloise_walk_4.png?url";
import eloiseWalk5Url from "../../assets/sprites/player/storybook/eloise_walk_5.png?url";

/** Same on-screen size as the 2D game: storybook PNGs scaled by 0.06×S. */
const AVATAR_SCALE = 0.06 * RENDER_SCALE;
const WALK_FPS = 10;
const WALK_VX_THRESHOLD = 8 * RENDER_SCALE;
/** Diorama convention: solids' front faces sit at z = 0 (see level3d.ts);
 *  the billboard floats just in front so platforms never occlude her. */
const PLAYER_Z = 0.06;
/** The blob sits back on the surface so it doesn't overhang platform fronts. */
const SHADOW_Z = -0.3;

const WALK_URLS = [
  eloiseWalk0Url,
  eloiseWalk1Url,
  eloiseWalk2Url,
  eloiseWalk3Url,
  eloiseWalk4Url,
  eloiseWalk5Url,
];

/**
 * Eloise as a camera-facing storybook billboard (HD-2D, Option A from the
 * transition guide) + a soft ground-cast shadow blob that doubles as the
 * landing-point affordance for kids.
 */
export class PlayerView {
  readonly group: THREE.Group;
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly shadow: THREE.Mesh;

  private readonly idle: Frame;
  private readonly jump: Frame;
  private readonly walk: Frame[];

  /** World-unit plane size + feet anchor offset, from the idle frame. */
  private readonly planeW: number;
  private readonly planeH: number;
  private readonly feetOffset: number;

  private walkClockMs = 0;
  private currentTexture: THREE.Texture | null = null;

  private constructor(idle: Frame, jump: Frame, walk: Frame[]) {
    this.idle = idle;
    this.jump = jump;
    this.walk = walk;

    const imgW = idle.image.width;
    const imgH = idle.image.height;
    // Source px → render px (AVATAR_SCALE) → world units.
    this.planeW = toWorldLen(imgW * AVATAR_SCALE);
    this.planeH = toWorldLen(imgH * AVATAR_SCALE);

    // Feet origin across all frames — most-trimmed frame wins (see
    // computeFeetOriginY): others may press slightly into the floor, which
    // reads better than floating.
    let minRatio = 1;
    for (const f of [idle, jump, ...walk]) {
      const margin = measureBottomMargin(f.image);
      const ratio = (f.image.height - margin) / f.image.height;
      if (ratio < minRatio) minRatio = ratio;
    }
    // Plane center sits feetOffset above the physics feet position.
    this.feetOffset = this.planeH * (minRatio - 0.5);

    this.material = new THREE.MeshBasicMaterial({
      map: idle.texture,
      transparent: true,
      alphaTest: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.planeW, this.planeH), this.material);
    this.mesh.renderOrder = 10;
    this.currentTexture = idle.texture;

    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x4a3728,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.set(1, 0.78, 1);
    this.shadow.renderOrder = 5;

    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.group.add(this.shadow);
  }

  static async load(): Promise<PlayerView> {
    const [idle, jump, ...walk] = await Promise.all([
      loadFrame(eloiseIdleUrl),
      loadFrame(eloiseJumpUrl),
      ...WALK_URLS.map(loadFrame),
    ]);
    return new PlayerView(idle, jump, walk);
  }

  /**
   * Sync the billboard with the simulation. `solids` lets the shadow blob
   * ground-cast: it sits on the highest surface below the player's feet.
   */
  update(state: PlayerState, deltaMs: number, solids: readonly PhysRect[]): void {
    const wx = toWorldX(state.x);
    const feetY = toWorldY(state.y);

    this.mesh.position.set(wx, feetY + this.feetOffset, PLAYER_Z);

    // Frame selection — same rules as the 2D updateAvatarFrame.
    let texture: THREE.Texture;
    if (!state.onGround) {
      texture = this.jump.texture;
      this.walkClockMs = 0;
    } else if (Math.abs(state.vx) > WALK_VX_THRESHOLD) {
      this.walkClockMs += deltaMs;
      const idx = Math.floor((this.walkClockMs / 1000) * WALK_FPS) % this.walk.length;
      texture = this.walk[idx]!.texture;
    } else {
      texture = this.idle.texture;
      this.walkClockMs = 0;
    }
    if (texture !== this.currentTexture) {
      this.material.map = texture;
      this.material.needsUpdate = true;
      this.currentTexture = texture;
    }

    // Facing: mirror the plane. flip via negative x-scale.
    this.mesh.scale.x = state.facing === -1 ? -1 : 1;

    // Ground-cast shadow: highest solid top at/below the feet.
    const groundPxY = this.groundBelow(state, solids);
    const heightAbove = toWorldY(state.y) - toWorldY(groundPxY);
    const fade = Math.max(0.35, 1 - heightAbove / 3.2);
    this.shadow.position.set(wx, toWorldY(groundPxY) + 0.012, SHADOW_Z);
    this.shadow.scale.set(fade, fade * 0.78, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.32 * fade;
  }

  /** Highest platform top at or below the player's feet, in px (y-down). */
  private groundBelow(state: PlayerState, solids: readonly PhysRect[]): number {
    let best = Number.POSITIVE_INFINITY;
    for (const r of solids) {
      const overlapsX = state.x + 1 > r.x && state.x - 1 < r.x + r.w;
      if (!overlapsX) continue;
      if (r.y >= state.y - 0.5 && r.y < best) {
        best = r.y;
      }
    }
    return Number.isFinite(best) ? best : state.y + 400;
  }
}
