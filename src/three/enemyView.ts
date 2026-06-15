import * as THREE from "three";
import { RENDER_SCALE } from "../config/game";
import { toWorldLen, toWorldX, toWorldY } from "./coords";
import { type Frame, loadFrame, measureBottomMargin } from "./billboard";
import type { EnemyKind, EnemyState } from "./enemy3d";

import dustBunnyIdleUrl from "../../assets/sprites/enemies/storybook/dustbunny_idle.png?url";
import dustBunnyWalkUrl from "../../assets/sprites/enemies/storybook/dustbunny_walk.png?url";
import spiderIdleUrl from "../../assets/sprites/enemies/storybook/spider_idle.png?url";
import spiderWalkUrl from "../../assets/sprites/enemies/storybook/spider_walk.png?url";
import antUrl from "../../assets/sprites/enemies/storybook/ant.png?url";
import dustMiteUrl from "../../assets/sprites/enemies/storybook/dustmite.png?url";

const ENEMY_SCALE: Record<EnemyKind, number> = {
  dustBunny: 0.04 * RENDER_SCALE,
  spider: 0.04 * RENDER_SCALE,
  ant: 0.03 * RENDER_SCALE,
  dustMite: 0.03 * RENDER_SCALE,
};
const ENEMY_URLS: Record<EnemyKind, { idle: string; walk: string | null }> = {
  dustBunny: { idle: dustBunnyIdleUrl, walk: dustBunnyWalkUrl },
  spider: { idle: spiderIdleUrl, walk: spiderWalkUrl },
  ant: { idle: antUrl, walk: null },
  dustMite: { idle: dustMiteUrl, walk: null },
};
const ENEMY_Z = 0.06;
const WALK_FPS = 8;

interface KindAssets {
  idle: Frame;
  walk: Frame | null;
  planeW: number;
  planeH: number;
  feetOffset: number;
}

interface EnemyMesh {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  kind: EnemyKind;
  walkClockMs: number;
}

/**
 * One billboard per enemy; textures loaded once per kind and shared.
 *
 * Positional contract: meshes are built once from the constructor-time enemies
 * array, and update() pairs enemies[i] ↔ meshes[i]. Callers must pass the same
 * length/order array every frame (level reset rebuilds states in place-order,
 * which preserves this).
 */
export class EnemiesView {
  readonly group = new THREE.Group();
  private readonly meshes: EnemyMesh[] = [];

  private constructor(
    private readonly assets: Record<EnemyKind, KindAssets>,
    enemies: readonly EnemyState[],
  ) {
    for (const e of enemies) {
      const a = assets[e.type];
      const material = new THREE.MeshBasicMaterial({
        map: a.idle.texture,
        transparent: true,
        alphaTest: 0.02,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(a.planeW, a.planeH), material);
      mesh.renderOrder = 10;
      this.group.add(mesh);
      this.meshes.push({ mesh, material, kind: e.type, walkClockMs: 0 });
    }
  }

  static async load(enemies: readonly EnemyState[]): Promise<EnemiesView> {
    const kinds: EnemyKind[] = ["dustBunny", "spider", "ant", "dustMite"];
    const entries = await Promise.all(
      kinds.map(async (k): Promise<[EnemyKind, KindAssets]> => {
        const urls = ENEMY_URLS[k];
        const idle = await loadFrame(urls.idle);
        const walk = urls.walk ? await loadFrame(urls.walk) : null;
        const scale = ENEMY_SCALE[k];
        const planeW = toWorldLen(idle.image.width * scale);
        const planeH = toWorldLen(idle.image.height * scale);
        const margin = measureBottomMargin(idle.image);
        const ratio = (idle.image.height - margin) / idle.image.height;
        const feetOffset = planeH * (ratio - 0.5);
        return [k, { idle, walk, planeW, planeH, feetOffset }];
      }),
    );
    const assets = Object.fromEntries(entries) as Record<EnemyKind, KindAssets>;
    return new EnemiesView(assets, enemies);
  }

  /** Sync billboards to the simulation; call once per frame. */
  update(enemies: readonly EnemyState[], deltaMs: number): void {
    enemies.forEach((e, i) => {
      const m = this.meshes[i];
      if (!m) return;
      if (e.defeated) {
        m.mesh.visible = false;
        m.walkClockMs = 0;
        return;
      }
      m.mesh.visible = true; // restore on the live path (idempotent; replay rebuilds enemies fresh)
      const a = this.assets[e.type];
      m.mesh.position.set(toWorldX(e.x), toWorldY(e.y) + a.feetOffset, ENEMY_Z);

      let texture = a.idle.texture;
      if (a.walk) {
        m.walkClockMs += deltaMs;
        const on = Math.floor((m.walkClockMs / 1000) * WALK_FPS) % 2 === 1;
        texture = on ? a.walk.texture : a.idle.texture;
      }
      if (m.material.map !== texture) {
        m.material.map = texture;
        m.material.needsUpdate = true;
      }

      // 2D flips X when travelling RIGHT (setFlipX(vx>0)); mirror that.
      m.mesh.scale.x = e.dir === 1 ? -1 : 1;
    });
  }
}
