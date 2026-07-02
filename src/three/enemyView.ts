import * as THREE from "three";
import { RENDER_SCALE } from "../config/game";
import { toWorldLen, toWorldX, toWorldY } from "./coords";
import { type Frame, loadFrame, makeShadowBlob, measureBottomMargin } from "./billboard";
import type { EnemyKind, EnemyState } from "./enemy3d";

import dustBunnyIdleUrl from "../../assets/sprites/enemies/storybook/dustbunny_idle.png?url";
import dustBunnyWalkUrl from "../../assets/sprites/enemies/storybook/dustbunny_walk.png?url";
import dustBunnyAttackUrl from "../../assets/sprites/enemies/storybook/dustbunny_attack.png?url";
import spiderIdleUrl from "../../assets/sprites/enemies/storybook/spider_idle.png?url";
import spiderWalkUrl from "../../assets/sprites/enemies/storybook/spider_walk.png?url";
import spiderAttackUrl from "../../assets/sprites/enemies/storybook/spider_attack.png?url";
import antUrl from "../../assets/sprites/enemies/storybook/ant.png?url";
import dustMiteUrl from "../../assets/sprites/enemies/storybook/dustmite.png?url";

const ENEMY_SCALE: Record<EnemyKind, number> = {
  dustBunny: 0.04 * RENDER_SCALE,
  spider: 0.04 * RENDER_SCALE,
  ant: 0.03 * RENDER_SCALE,
  dustMite: 0.03 * RENDER_SCALE,
};
const ENEMY_URLS: Record<EnemyKind, { idle: string; walk: string | null; attack: string | null }> =
  {
    dustBunny: { idle: dustBunnyIdleUrl, walk: dustBunnyWalkUrl, attack: dustBunnyAttackUrl },
    spider: { idle: spiderIdleUrl, walk: spiderWalkUrl, attack: spiderAttackUrl },
    ant: { idle: antUrl, walk: null, attack: null },
    dustMite: { idle: dustMiteUrl, walk: null, attack: null },
  };
const ENEMY_Z = 0.06;
const SHADOW_Z = -0.3;
const WALK_FPS = 8;
const DEFEAT_MS = 160;
const DEFEAT_SQUASH_Y = 0.15;
const DEFEAT_STRETCH_X = 1.4;
const ATTACK_RANGE_PX = 60;
const WIGGLE_RAD = 0.05;
const WIGGLE_SPEED = 0.004; // rad multiplier per ms

/** Defeat event captured on the frame an enemy's squash begins (render px). */
export interface DefeatEvent {
  x: number;
  y: number;
  kind: string;
}

interface KindAssets {
  idle: Frame;
  walk: Frame | null;
  attack: Frame | null;
  planeW: number;
  planeH: number;
  feetOffset: number;
}

interface EnemyMesh {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  shadow: THREE.Mesh;
  kind: EnemyKind;
  clockMs: number;
  /** null = alive last frame; otherwise ms of squash left (0 = squash done, hidden). */
  defeatMsLeft: number | null;
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
  private readonly defeatEvents: DefeatEvent[] = [];

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
      const shadow = makeShadowBlob(a.planeW * 0.35);
      this.group.add(mesh);
      this.group.add(shadow);
      this.meshes.push({ mesh, material, shadow, kind: e.type, clockMs: 0, defeatMsLeft: null });
    }
  }

  static async load(enemies: readonly EnemyState[]): Promise<EnemiesView> {
    const kinds: EnemyKind[] = ["dustBunny", "spider", "ant", "dustMite"];
    const entries = await Promise.all(
      kinds.map(async (k): Promise<[EnemyKind, KindAssets]> => {
        const urls = ENEMY_URLS[k];
        const idle = await loadFrame(urls.idle);
        const walk = urls.walk ? await loadFrame(urls.walk) : null;
        const attack = urls.attack ? await loadFrame(urls.attack) : null;
        const scale = ENEMY_SCALE[k];
        const planeW = toWorldLen(idle.image.width * scale);
        const planeH = toWorldLen(idle.image.height * scale);
        const margin = measureBottomMargin(idle.image);
        const ratio = (idle.image.height - margin) / idle.image.height;
        const feetOffset = planeH * (ratio - 0.5);
        return [k, { idle, walk, attack, planeW, planeH, feetOffset }];
      }),
    );
    const assets = Object.fromEntries(entries) as Record<EnemyKind, KindAssets>;
    return new EnemiesView(assets, enemies);
  }

  /** Drain defeat events queued since the last call (spawn poof FX here). */
  drainDefeatEvents(): Array<{ x: number; y: number; kind: string }> {
    return this.defeatEvents.splice(0);
  }

  /**
   * Sync billboards to the simulation; call once per frame. `playerX`
   * (render px) enables the attack telegraph for kinds with an attack frame.
   */
  update(enemies: readonly EnemyState[], deltaMs: number, playerX?: number): void {
    enemies.forEach((e, i) => {
      const m = this.meshes[i];
      if (!m) return;
      const a = this.assets[e.type];

      if (e.defeated) {
        m.shadow.visible = false;
        if (m.defeatMsLeft === null) {
          m.defeatMsLeft = DEFEAT_MS;
          this.defeatEvents.push({ x: e.x, y: e.y, kind: e.type });
        } else {
          m.defeatMsLeft = Math.max(0, m.defeatMsLeft - deltaMs);
        }
        if (m.defeatMsLeft <= 0) {
          m.mesh.visible = false;
          return;
        }
        // Squash: feet stay planted, so the center drops with the y-scale.
        const t = 1 - m.defeatMsLeft / DEFEAT_MS;
        const sy = 1 + (DEFEAT_SQUASH_Y - 1) * t;
        const sx = 1 + (DEFEAT_STRETCH_X - 1) * t;
        m.mesh.visible = true;
        m.mesh.rotation.z = 0;
        m.mesh.scale.set((e.dir === 1 ? -1 : 1) * sx, sy, 1);
        m.mesh.position.set(toWorldX(e.x), toWorldY(e.y) + a.feetOffset * sy, ENEMY_Z);
        return;
      }

      // Live path: re-derive ALL visual state from sim state (gotcha 12).
      m.mesh.visible = true;
      m.defeatMsLeft = null;
      m.mesh.scale.y = 1;
      m.clockMs += deltaMs;
      m.mesh.position.set(toWorldX(e.x), toWorldY(e.y) + a.feetOffset, ENEMY_Z);

      m.shadow.visible = true;
      m.shadow.position.set(toWorldX(e.x), toWorldY(e.y) + 0.012, SHADOW_Z);

      const attacking =
        a.attack !== null && playerX !== undefined && Math.abs(e.x - playerX) < ATTACK_RANGE_PX;
      let texture = a.idle.texture;
      if (attacking && a.attack) {
        texture = a.attack.texture;
      } else if (a.walk) {
        const on = Math.floor((m.clockMs / 1000) * WALK_FPS) % 2 === 1;
        texture = on ? a.walk.texture : a.idle.texture;
      }
      if (m.material.map !== texture) {
        m.material.map = texture;
        m.material.needsUpdate = true;
      }

      // Idle life for static kinds: deterministic wiggle, phase seeded by index.
      m.mesh.rotation.z = a.walk ? 0 : Math.sin(m.clockMs * WIGGLE_SPEED + i * 1.7) * WIGGLE_RAD;

      // 2D flips X when travelling RIGHT (setFlipX(vx>0)); mirror that.
      m.mesh.scale.x = e.dir === 1 ? -1 : 1;
    });
  }
}
