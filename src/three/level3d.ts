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
  /** Collect "pop" tween: counts down from POP_MS; 0 = hidden/idle. */
  popMsRemaining: number;
}

/** Duration of the token collect pop (scale-up + fade, then hide). */
export const TOKEN_POP_MS = 180;

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

/** Deterministic canvas texture helper — seeded LCG, cached per key. */
const texCache = new Map<string, THREE.CanvasTexture>();
function makeCanvasTexture(
  key: string,
  size: number,
  draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void,
): THREE.CanvasTexture {
  const cached = texCache.get(key);
  if (cached) return cached;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  let seed = 41;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  draw(ctx, rand);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  texCache.set(key, tex);
  return tex;
}

/** Crosshatch lattice + leaf speckle — sells "climbable vines", one shared texture. */
function latticeTexture(): THREE.Texture {
  return makeCanvasTexture("lattice", 128, (ctx, rand) => {
    ctx.fillStyle = "#6b8f5a";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "rgba(58, 84, 46, 0.85)";
    ctx.lineWidth = 5;
    for (let d = -128; d <= 256; d += 32) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + 128, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(d + 128, 0);
      ctx.lineTo(d, 128);
      ctx.stroke();
    }
    for (let i = 0; i < 40; i += 1) {
      const x = rand() * 128;
      const y = rand() * 128;
      ctx.fillStyle = rand() > 0.5 ? "rgba(140, 180, 110, 0.55)" : "rgba(90, 120, 70, 0.6)";
      ctx.beginPath();
      ctx.ellipse(x, y, 3.5, 2.2, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Horizontal plank stripes + grain flecks — the smashable crate read. */
function plankTexture(): THREE.Texture {
  return makeCanvasTexture("planks", 128, (ctx, rand) => {
    ctx.fillStyle = "#b07a3c";
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 26) {
      ctx.fillStyle = "rgba(66, 42, 18, 0.55)";
      ctx.fillRect(0, y, 128, 3);
      ctx.fillStyle = `rgba(255, 220, 170, ${0.05 + rand() * 0.06})`;
      ctx.fillRect(0, y + 3, 128, 10);
    }
    ctx.strokeStyle = "rgba(80, 50, 22, 0.35)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 22; i += 1) {
      const x = rand() * 128;
      const y = rand() * 128;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8 + rand() * 18, y + (rand() - 0.5) * 4);
      ctx.stroke();
    }
  });
}

function buildClimbWall(w: { x: number; y: number; w: number; h: number }): THREE.Mesh {
  const geo = new THREE.BoxGeometry(toWorldLen(w.w), toWorldLen(w.h), 0.4);
  const mat = new THREE.MeshLambertMaterial({ map: latticeTexture() });
  const mesh = new THREE.Mesh(geo, mat);
  const c = rectCenterWorld(w);
  // front face at +0.05 (behind player +0.06); box depth 0.4 extends back to -0.35
  mesh.position.set(c.cx, c.cy, CLIMB_Z - 0.2);
  mesh.receiveShadow = true; // thin panel behind the plane — takes shadow, doesn't cast
  return mesh;
}

function buildBreakable(b: { x: number; y: number; w: number; h: number }): THREE.Mesh {
  const geo = new THREE.BoxGeometry(toWorldLen(b.w), toWorldLen(b.h), 1.4);
  const mat = new THREE.MeshLambertMaterial({ map: plankTexture() });
  const mesh = new THREE.Mesh(geo, mat);
  const c = rectCenterWorld(b);
  mesh.position.set(c.cx, c.cy, -0.7); // solid, extends backward from ~0
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** One star geometry shared by every token (they only differ by transform). */
let tokenGeometry: THREE.ExtrudeGeometry | null = null;
function getTokenGeometry(): THREE.ExtrudeGeometry {
  if (!tokenGeometry) {
    tokenGeometry = new THREE.ExtrudeGeometry(starShape(0.26, 0.115), {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    tokenGeometry.center();
  }
  return tokenGeometry;
}

function buildToken(t: { x: number; y: number }, index: number): TokenEntity {
  // Material stays per-token: the collect pop fades opacity individually.
  const mat = new THREE.MeshLambertMaterial({
    color: 0xf6c945,
    emissive: 0x8a6210,
    transparent: true,
  });
  const mesh = new THREE.Mesh(getTokenGeometry(), mat);
  mesh.position.set(toWorldX(t.x), toWorldY(t.y), TOKEN_Z);
  // Tokens are tiny clutter (§5.6 9c): 125 of them casting was a silent
  // shadow-pass tax; the spin/bob + sparkle carry their read instead.
  mesh.castShadow = false;
  return { x: t.x, y: t.y, collected: false, mesh, phase: index * 0.7, popMsRemaining: 0 };
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

  // Fake bloom: one additive radial-gradient sprite behind the door. Delivers
  // the "glowing doorway" halo without an EffectComposer pass (perf budget).
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeCanvasTexture("radial-glow", 64, (ctx) => {
        const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
        g.addColorStop(0, "rgba(255, 224, 160, 0.9)");
        g.addColorStop(0.45, "rgba(255, 200, 120, 0.35)");
        g.addColorStop(1, "rgba(255, 190, 100, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
      }),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(Math.max(w, h) * 2.4);
  halo.position.set(cx, cy, -0.12);
  halo.name = "exit-halo";

  group.add(left, right, top, glowPane, star, glow, halo);
  // Diorama convention: pull the door back so its front face sits at z = 0
  // and Eloise (z > 0) walks in front of the frame, never behind it.
  group.position.z = -0.25;
  return { group, glow };
}

/**
 * Dark "under the floorboards" plane visible through pit gaps — without it a
 * pit shows the raw page background (2026-07-02 playtest: "gaps in the floor
 * are really ugly and don't make sense"). Warm darkness reads as fall-able
 * depth; the kill plane lives well inside it.
 */
function buildUnderFloor(data: LevelData): THREE.Mesh {
  const minX = toWorldX(data.bounds.minX);
  const maxX = toWorldX(data.bounds.maxX);
  const depth = 12; // world units below the floor line
  const cv = document.createElement("canvas");
  cv.width = 2;
  cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#5a4234"); // just under the floor lip — warm shadow
  g.addColorStop(0.35, "#39291f");
  g.addColorStop(1, "#180f0a"); // the deep dark
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, depth),
    new THREE.MeshBasicMaterial({ map: tex, fog: false }),
  );
  // Inside the floor boxes' z-range, so floor occludes it everywhere but pits.
  mesh.position.set((minX + maxX) / 2, -depth / 2, -2.4);
  return mesh;
}

export function buildLevel(data: LevelData, surfaces: WorldSurfaces = DEFAULT_SURFACES): LevelBuild {
  const group = new THREE.Group();
  const solids: PhysRect[] = [];

  group.add(buildUnderFloor(data));

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

/** Per-frame token animation: spin + wave bob, plus the collect pop tween. */
export function animateTokens(tokens: TokenEntity[], elapsedMs: number, dtMs = 0): void {
  const t = elapsedMs / 1000;
  for (const token of tokens) {
    if (token.collected) {
      // Collect pop: scale up + fade out over TOKEN_POP_MS, then hide.
      if (token.popMsRemaining > 0 && token.mesh.visible) {
        token.popMsRemaining = Math.max(0, token.popMsRemaining - dtMs);
        const p = 1 - token.popMsRemaining / TOKEN_POP_MS; // 0 → 1
        token.mesh.scale.setScalar(1 + p * 0.6);
        const mat = (token.mesh as THREE.Mesh).material as THREE.MeshLambertMaterial;
        mat.opacity = 1 - p;
        if (token.popMsRemaining <= 0) {
          token.mesh.visible = false;
          mat.opacity = 1;
        }
      }
      continue;
    }
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
  const halo = build.exitGroup.getObjectByName("exit-halo") as THREE.Sprite | undefined;
  if (halo) {
    const base = halo.userData.baseScale ?? (halo.userData.baseScale = halo.scale.x);
    halo.scale.setScalar(base * (0.92 + pulse * 0.16));
    halo.material.opacity = 0.7 + pulse * 0.3;
  }
}
