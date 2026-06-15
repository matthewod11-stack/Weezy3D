import * as THREE from "three";
import type { LevelData } from "../types/level";
import { rectCenterWorld, toWorldLen, toWorldX, toWorldY } from "./coords";
import type { PhysRect } from "./physics3d";

/**
 * Builds the gameplay geometry for a level from the same LevelData the 2D
 * game consumes (already scaled to render px). Platforms become wooden
 * shelf boxes, tokens become spinning gold stars, the exit becomes a
 * glowing storybook door.
 */

export interface TokenEntity {
  /** Pickup position in render px (matches LevelData). */
  x: number;
  y: number;
  collected: boolean;
  mesh: THREE.Object3D;
  /** Phase offset so a row of tokens bobs as a wave, not in lockstep. */
  phase: number;
}

export interface LevelBuild {
  group: THREE.Group;
  solids: PhysRect[];
  tokens: TokenEntity[];
  exitZone: PhysRect;
  exitGroup: THREE.Group;
  exitGlow: THREE.PointLight;
  /** Vine/lattice climb zones (purely decorative — sim reads level.climbWalls). */
  climbWalls: THREE.Mesh[];
  /** Smashable barricades — main.ts hides .mesh when the sim reports a smash. */
  breakables: { mesh: THREE.Mesh }[];
}

/**
 * Depth convention (the diorama "glass pane"): z = 0 is the FRONT FACE of
 * all solid gameplay geometry — boxes extend backward from it. Flat actors
 * (player billboard, tokens) float just in front (+z) so they are never
 * occluded by the front half of a platform. Future elements (climb walls,
 * breakables, enemies) must follow the same rule.
 */
const SHELF_DEPTH = 1.7;
const SHELF_Z_CENTER = -SHELF_DEPTH / 2; // front face flush at z = 0
const FLOOR_DEPTH = 10;
const FLOOR_Z_CENTER = -2.2; // floor extends back under the set dressing
/** Tokens hover just in front of the platform faces. */
export const TOKEN_Z = 0.15;

/** Per-world skin for the gameplay geometry. Level-authored p.color always wins. */
export interface WorldSurfaces {
  /** Floor texture base when the platform has no authored color. */
  floorBase: string;
  floorTexture(baseColor: string): THREE.Texture;
  platformColor: number;
  lipColor: number;
}

/** Bedroom look — the original carpet/wood materials, kept as the default. */
export const DEFAULT_SURFACES: WorldSurfaces = {
  floorBase: "#d4a574",
  floorTexture: carpetTexture,
  platformColor: 0xe8c9a0,
  lipColor: 0xb8804a,
};

function starShape(outer: number, inner: number, points = 5): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/** Subtle carpet weave so the floor reads soft instead of flat-shaded. */
function carpetTexture(base: string): THREE.Texture {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Deterministic speckle (no Math.random — keeps renders reproducible).
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 1400; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const light = rand() > 0.5;
    ctx.fillStyle = light ? "rgba(255, 240, 220, 0.10)" : "rgba(90, 60, 40, 0.08)";
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function buildPlatformMesh(
  p: LevelData["platforms"][number],
  isFloor: boolean,
  surfaces: WorldSurfaces,
): THREE.Mesh {
  const { cx, cy, w, h } = rectCenterWorld(p);
  const depth = isFloor ? FLOOR_DEPTH : SHELF_DEPTH;
  const zCenter = isFloor ? FLOOR_Z_CENTER : SHELF_Z_CENTER;

  // The 2D encoder stamps blueprint-placeholder colors (#d4a574/#e8c9a0)
  // on every platform in every world — they are NOT art direction, so the
  // theme's surfaces own the 3D look. (Bedroom's defaults equal the
  // placeholders, so World 1 renders identically either way.)
  const material = isFloor
    ? new THREE.MeshLambertMaterial({ map: surfaces.floorTexture(surfaces.floorBase) })
    : new THREE.MeshLambertMaterial({ color: surfaces.platformColor });

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), material);
  mesh.position.set(cx, cy, zCenter);
  mesh.receiveShadow = true;
  mesh.castShadow = !isFloor;
  return mesh;
}

/** Thin warm trim under shelf front edges — sells the "wooden shelf" read. */
function buildShelfLip(p: LevelData["platforms"][number], surfaces: WorldSurfaces): THREE.Mesh {
  const { cx, cy, w, h } = rectCenterWorld(p);
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.06, SHELF_DEPTH),
    new THREE.MeshLambertMaterial({ color: surfaces.lipColor }),
  );
  lip.position.set(cx, cy - h / 2 - 0.03, SHELF_Z_CENTER);
  return lip;
}

/**
 * Climb walls and breakables follow the diorama z-convention: solid geometry
 * extends BACKWARD from z ≈ 0, so the player billboard (z = +0.06) is never
 * occluded by their front half.
 */
const CLIMB_Z = 0.05;
function buildClimbWall(w: { x: number; y: number; w: number; h: number }): THREE.Mesh {
  const geo = new THREE.BoxGeometry(toWorldLen(w.w), toWorldLen(w.h), 0.4);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b8f5a, roughness: 0.9 }); // vine/lattice green
  const mesh = new THREE.Mesh(geo, mat);
  const c = rectCenterWorld(w);
  mesh.position.set(c.cx, c.cy, CLIMB_Z - 0.2); // back behind the gameplay plane
  return mesh;
}

function buildBreakable(b: { x: number; y: number; w: number; h: number }): THREE.Mesh {
  const geo = new THREE.BoxGeometry(toWorldLen(b.w), toWorldLen(b.h), 1.4);
  const mat = new THREE.MeshStandardMaterial({ color: 0xb07a3c, roughness: 0.8 }); // crate/barricade
  const mesh = new THREE.Mesh(geo, mat);
  const c = rectCenterWorld(b);
  mesh.position.set(c.cx, c.cy, -0.7); // solid, extends backward from ~0
  mesh.castShadow = true;
  return mesh;
}

function buildToken(t: { x: number; y: number }, index: number): TokenEntity {
  const geo = new THREE.ExtrudeGeometry(starShape(0.26, 0.115), {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  geo.center();
  const mat = new THREE.MeshLambertMaterial({
    color: 0xf6c945,
    emissive: 0x8a6210,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(toWorldX(t.x), toWorldY(t.y), TOKEN_Z);
  mesh.castShadow = true;
  return { x: t.x, y: t.y, collected: false, mesh, phase: index * 0.7 };
}

/** A glowing storybook door — the level exit. */
function buildExit(exit: LevelData["exit"]): { group: THREE.Group; glow: THREE.PointLight } {
  const { cx, cy, w, h } = rectCenterWorld(exit);
  const group = new THREE.Group();

  const frameMat = new THREE.MeshLambertMaterial({ color: 0xb8804a });
  const postW = w * 0.18;

  const left = new THREE.Mesh(new THREE.BoxGeometry(postW, h, 0.5), frameMat);
  left.position.set(cx - w / 2 + postW / 2, cy, 0);
  const right = left.clone();
  right.position.x = cx + w / 2 - postW / 2;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, postW, 0.5), frameMat);
  top.position.set(cx, cy + h / 2 - postW / 2, 0);

  const glowPane = new THREE.Mesh(
    new THREE.PlaneGeometry(w - postW * 2, h - postW),
    new THREE.MeshBasicMaterial({
      color: 0xffd98a,
      transparent: true,
      opacity: 0.92,
    }),
  );
  glowPane.position.set(cx, cy - postW / 2, -0.08);
  glowPane.name = "exit-glow-pane";

  const star = new THREE.Mesh(
    new THREE.ExtrudeGeometry(starShape(0.18, 0.08), { depth: 0.06, bevelEnabled: false }),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
  );
  star.geometry.center();
  star.position.set(cx, cy + h / 2 + 0.32, 0);
  star.name = "exit-star";

  const glow = new THREE.PointLight(0xffc46a, 7, 7, 1.6);
  glow.position.set(cx, cy, 1.2);

  group.add(left, right, top, glowPane, star, glow);
  // Diorama convention: pull the door back so its front face sits at z = 0
  // and Eloise (z > 0) walks in front of the frame, never behind it.
  group.position.z = -0.25;
  return { group, glow };
}

export function buildLevel(data: LevelData, surfaces: WorldSurfaces = DEFAULT_SURFACES): LevelBuild {
  const group = new THREE.Group();
  const solids: PhysRect[] = [];

  for (const p of data.platforms) {
    // Floor segments are authored with the (thicker) FLOOR_THICKNESS; shelves
    // are thin. The color is also distinct, but thickness is the robust tell.
    const isFloor = p.h >= 28 * 2 - 1;
    group.add(buildPlatformMesh(p, isFloor, surfaces));
    if (!isFloor) group.add(buildShelfLip(p, surfaces));
    solids.push({ x: p.x, y: p.y, w: p.w, h: p.h });
  }

  const tokens = data.tokens.map((t, i) => {
    const token = buildToken(t, i);
    group.add(token.mesh);
    return token;
  });

  const climbWalls = (data.climbWalls ?? []).map((w) => {
    const m = buildClimbWall(w);
    group.add(m);
    return m;
  });
  const breakables = (data.breakables ?? []).map((b) => {
    const m = buildBreakable(b);
    group.add(m);
    return { mesh: m };
  });

  const { group: exitGroup, glow: exitGlow } = buildExit(data.exit);
  group.add(exitGroup);

  return {
    group,
    solids,
    tokens,
    exitZone: { x: data.exit.x, y: data.exit.y, w: data.exit.w, h: data.exit.h },
    exitGroup,
    exitGlow,
    climbWalls,
    breakables,
  };
}

/** Per-frame token animation: spin + wave bob; pop handled by the collector. */
export function animateTokens(tokens: TokenEntity[], elapsedMs: number): void {
  const t = elapsedMs / 1000;
  for (const token of tokens) {
    if (token.collected) continue;
    token.mesh.rotation.y = t * 2.2 + token.phase;
    token.mesh.position.y = toWorldY(token.y) + Math.sin(t * 2.4 + token.phase) * 0.07;
  }
}

/** Exit "breathing" glow. */
export function animateExit(build: LevelBuild, elapsedMs: number): void {
  const t = elapsedMs / 1000;
  const pulse = 0.5 + Math.sin(t * 2.0) * 0.5;
  build.exitGlow.intensity = 5.5 + pulse * 3.5;
  const star = build.exitGroup.getObjectByName("exit-star");
  if (star) {
    star.rotation.y = t * 1.4;
  }
  const pane = build.exitGroup.getObjectByName("exit-glow-pane") as THREE.Mesh | undefined;
  if (pane) {
    (pane.material as THREE.MeshBasicMaterial).opacity = 0.78 + pulse * 0.18;
  }
}
