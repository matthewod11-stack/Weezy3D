import * as THREE from "three";
import type { WorldSurfaces } from "./level3d";
import type { WorldSet } from "./worldThemes";

/**
 * World 3 — Kitchen set dressing, from the scene anchor prompt in
 * docs/art-direction/scenery-prompt-library.md:
 *
 *   cream · chrome silver · warm orange stove glow · terracotta tile;
 *   countertop cliff faces, gleaming chrome, and a gas stove glowing
 *   deep orange-red in the mid-background like a distant volcano — the
 *   library's hero lighting moment. Hard overhead light, low ambient.
 *
 * Same skeleton as bedroomSet: backdrop -8, landmarks -5, clutter -2.6,
 * gameplay 0, foreground +1.9. Procedural, palette-locked, seeded LCG.
 */

export const KITCHEN = {
  fogColor: 0xfff8f0,
  fogNear: 16,
  fogFar: 41,
  tile: "#eae4d6",
  grout: "#d8d2c2",
  cream: 0xf6f1e6,
  cabinet: 0xe8e2d4,
  cabinetShadow: 0xd6cfbe,
  chrome: 0xc8ccd0,
  chromeDark: 0xa8aeb6,
  terracotta: 0xc9886a,
  stoveBody: 0x3a3e44,
  stoveGlow: 0xff6a3c,
  citrus: 0xf0a830,
  sage: 0xa8bca0,
} as const;

const WALL_Z = -8;
const LANDMARK_Z = -5;
const CLUTTER_Z = -2.6;
const FOREGROUND_Z = 1.9;
const WALL_HEIGHT = 13;

/** Deterministic LCG so the kitchen dresses identically on every load. */
function makeRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Offset subway-tile wall — the classic kitchen backsplash. */
function subwayTexture(): THREE.Texture {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = KITCHEN.grout;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = KITCHEN.tile;
  const tw = 62;
  const th = 27;
  for (let row = 0; row < size / (th + 2) + 1; row += 1) {
    const off = row % 2 === 0 ? 0 : -(tw + 2) / 2;
    for (let col = -1; col < size / (tw + 2) + 1; col += 1) {
      ctx.fillRect(off + col * (tw + 2) + 1, row * (th + 2) + 1, tw, th);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Terracotta floor tiles with grout grid + per-tile tone wobble. */
function tileTexture(base: string): THREE.Texture {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#a8765c";
  ctx.fillRect(0, 0, size, size);
  const rand = makeRand(13);
  const t = 60;
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      ctx.fillStyle = base;
      ctx.globalAlpha = 0.82 + rand() * 0.18;
      ctx.fillRect(col * (t + 4) + 2, row * (t + 4) + 2, t, t);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

function buildWall(minX: number, maxX: number): THREE.Group {
  const group = new THREE.Group();
  const width = maxX - minX + 40;

  const tex = subwayTexture();
  tex.repeat.set(width / 6, WALL_HEIGHT / 6);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(width, WALL_HEIGHT),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  wall.position.set((minX + maxX) / 2, WALL_HEIGHT / 2 - 0.2, WALL_Z);
  wall.receiveShadow = true;
  group.add(wall);

  return group;
}

/** A row of upper cabinets along the top of the backsplash. */
function buildUpperCabinets(x: number, count: number): THREE.Group {
  const group = new THREE.Group();
  const w = 2.9;
  const h = 2.2;
  for (let i = 0; i < count; i += 1) {
    const cx = x + i * (w + 0.12);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.5),
      new THREE.MeshLambertMaterial({ color: KITCHEN.cabinet }),
    );
    door.position.set(cx, 8.6, WALL_Z + 0.4);
    group.add(door);
    // Inset seam panel + knob.
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.78, h * 0.74),
      new THREE.MeshLambertMaterial({ color: KITCHEN.cabinetShadow }),
    );
    panel.position.set(cx, 8.6, WALL_Z + 0.66);
    group.add(panel);
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 8),
      new THREE.MeshLambertMaterial({ color: KITCHEN.chromeDark }),
    );
    knob.position.set(cx + w / 2 - 0.3, 7.75, WALL_Z + 0.7);
    group.add(knob);
  }
  return group;
}

/** Lower cabinet run topped by a counter slab with a chrome edge. */
function buildCounterRun(x: number, w: number): THREE.Group {
  const group = new THREE.Group();
  const h = 4.5;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 1.4),
    new THREE.MeshLambertMaterial({ color: KITCHEN.cabinet }),
  );
  body.position.set(x, h / 2, LANDMARK_Z);
  body.castShadow = true;
  group.add(body);

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.25, 0.22, 1.6),
    new THREE.MeshLambertMaterial({ color: KITCHEN.cream }),
  );
  counter.position.set(x, h + 0.11, LANDMARK_Z);
  counter.castShadow = true;
  group.add(counter);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.25, 0.08, 0.06),
    new THREE.MeshLambertMaterial({ color: KITCHEN.chrome }),
  );
  edge.position.set(x, h + 0.11, LANDMARK_Z + 0.81);
  group.add(edge);

  // Door seams.
  const doors = Math.max(1, Math.round(w / 2.2));
  for (let i = 0; i < doors; i += 1) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry((w / doors) * 0.8, h * 0.7),
      new THREE.MeshLambertMaterial({ color: KITCHEN.cabinetShadow }),
    );
    panel.position.set(x - w / 2 + (i + 0.5) * (w / doors), h / 2, LANDMARK_Z + 0.71);
    group.add(panel);
  }

  return group;
}

/**
 * The hero: the stove, glowing deep orange-red like a distant volcano.
 * Returns the glow light so the set's update hook can make it breathe.
 */
function buildStove(x: number): { group: THREE.Group; glow: THREE.PointLight } {
  const group = new THREE.Group();
  const w = 5.0;
  const h = 4.6;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 1.6),
    new THREE.MeshLambertMaterial({ color: KITCHEN.stoveBody }),
  );
  body.position.set(x, h / 2, LANDMARK_Z);
  body.castShadow = true;
  group.add(body);

  // Cooktop slab + burner rings.
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.2, 0.16, 1.7),
    new THREE.MeshLambertMaterial({ color: 0x2a2e33 }),
  );
  top.position.set(x, h + 0.08, LANDMARK_Z);
  group.add(top);
  for (const dx of [-1.4, 0.2]) {
    const burner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.06, 18),
      new THREE.MeshLambertMaterial({ color: 0x1c1f23 }),
    );
    burner.position.set(x + dx, h + 0.2, LANDMARK_Z + 0.2);
    group.add(burner);
  }

  // Stockpot on the cooktop.
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 1.1, 20),
    new THREE.MeshLambertMaterial({ color: KITCHEN.chromeDark }),
  );
  pot.position.set(x + 1.6, h + 0.75, LANDMARK_Z + 0.1);
  pot.castShadow = true;
  group.add(pot);

  // Oven window — the glow itself (pane sits clear of the frame's front
  // face at +0.81; coplanar placement z-fights into stripe artifacts).
  const windowPane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.4),
    new THREE.MeshBasicMaterial({ color: KITCHEN.stoveGlow }),
  );
  windowPane.position.set(x, 1.9, LANDMARK_Z + 0.88);
  group.add(windowPane);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 1.7, 0.06),
    new THREE.MeshLambertMaterial({ color: 0x2a2e33 }),
  );
  frame.position.set(x, 1.9, LANDMARK_Z + 0.78);
  group.add(frame);

  const glow = new THREE.PointLight(0xff7a40, 5, 14, 1.6);
  glow.position.set(x, 2.0, LANDMARK_Z + 1.6);
  group.add(glow);

  return { group, glow };
}

/** Tall chrome fridge slab. */
function buildFridge(x: number): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 7.5, 1.5),
    new THREE.MeshLambertMaterial({ color: KITCHEN.chrome }),
  );
  body.position.set(x, 3.75, LANDMARK_Z);
  body.castShadow = true;
  group.add(body);
  // Door seam + handles.
  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.05, 1.52),
    new THREE.MeshLambertMaterial({ color: KITCHEN.chromeDark }),
  );
  seam.position.set(x, 4.9, LANDMARK_Z);
  group.add(seam);
  for (const hy of [4.2, 5.5]) {
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.8, 0.12),
      new THREE.MeshLambertMaterial({ color: KITCHEN.chromeDark }),
    );
    handle.position.set(x - 1.1, hy, LANDMARK_Z + 0.82);
    group.add(handle);
  }
  return group;
}

/** Dropped wooden spoon — toy-scale floor clutter. */
function buildSpoon(x: number, rotY: number): THREE.Group {
  const group = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 1.5, 10),
    new THREE.MeshLambertMaterial({ color: 0xb8884f }),
  );
  handle.rotation.z = Math.PI / 2;
  handle.rotation.y = rotY;
  handle.position.set(x, 0.08, CLUTTER_Z);
  group.add(handle);
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 10),
    new THREE.MeshLambertMaterial({ color: 0xb8884f }),
  );
  bowl.scale.set(1, 0.45, 0.8);
  bowl.position.set(x + Math.cos(rotY) * 0.85, 0.1, CLUTTER_Z - Math.sin(rotY) * 0.85);
  group.add(bowl);
  return group;
}

/** Dress the kitchen across the level's world-space x range. */
export function buildKitchenSet(minX: number, maxX: number): WorldSet {
  const rand = makeRand(20260611);
  const group = new THREE.Group();
  const width = maxX - minX;

  group.add(buildWall(minX, maxX));

  // Upper cabinets in two runs.
  group.add(buildUpperCabinets(minX + width * 0.08, 3));
  if (width > 40) {
    group.add(buildUpperCabinets(minX + width * 0.66, 4));
  }

  // Counter runs flanking the stove; fridge near the far end.
  group.add(buildCounterRun(minX + width * 0.18, 7));
  group.add(buildCounterRun(minX + width * 0.45, 5.5));
  const stove = buildStove(minX + width * 0.62);
  group.add(stove.group);
  group.add(buildCounterRun(minX + width * 0.78, 6));
  group.add(buildFridge(minX + width * 0.93));

  // Floor clutter.
  group.add(buildSpoon(minX + width * 0.3, 0.4));
  group.add(buildSpoon(minX + width * 0.72, -0.9));
  const mitt = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.22, 0.55),
    new THREE.MeshLambertMaterial({ color: KITCHEN.terracotta }),
  );
  mitt.position.set(minX + width * 0.52, 0.11, CLUTTER_Z + 0.4);
  mitt.rotation.y = 0.7;
  mitt.castShadow = true;
  group.add(mitt);
  for (let i = 0; i < Math.max(2, Math.floor(width / 30)); i += 1) {
    const citrus = new THREE.Mesh(
      new THREE.SphereGeometry(0.3 + rand() * 0.1, 16, 12),
      new THREE.MeshLambertMaterial({ color: rand() > 0.5 ? KITCHEN.citrus : 0xe8c030 }),
    );
    citrus.position.set(minX + 4 + rand() * (width - 8), 0.32, CLUTTER_Z + rand() * 0.8);
    citrus.castShadow = true;
    group.add(citrus);
  }

  // Foreground crumbs: a fallen fork + a runaway pea.
  const forkMat = new THREE.MeshLambertMaterial({ color: KITCHEN.chromeDark });
  const fork = new THREE.Group();
  const forkHandle = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.1), forkMat);
  fork.add(forkHandle);
  for (const dz of [-0.06, 0, 0.06]) {
    const tine = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.035), forkMat);
    tine.position.set(0.6, 0, dz);
    fork.add(tine);
  }
  fork.position.set(minX + width * 0.4, 0.05, FOREGROUND_Z);
  fork.rotation.y = 0.3;
  group.add(fork);
  const pea = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshLambertMaterial({ color: KITCHEN.sage }),
  );
  pea.position.set(minX + width * 0.67, 0.12, FOREGROUND_Z + 0.2);
  group.add(pea);

  // ── Lighting rig (scenery library atmosphere knobs, Kitchen column) ────
  // Low ambient + hard white overhead key = crisp counter shadows.
  const ambient = new THREE.AmbientLight(0xfff4e4, 0.3);
  group.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 50;
  sun.shadow.bias = -0.0004;
  const sunTarget = new THREE.Object3D();
  group.add(sunTarget);
  sun.target = sunTarget;
  group.add(sun);

  // Cool chrome bounce fill.
  const fill = new THREE.DirectionalLight(0xdce8f0, 0.2);
  fill.position.set(minX + width * 0.2, 6, 6);
  group.add(fill);

  return {
    group,
    sun,
    sunTarget,
    sunOffset: { x: 2, y: 14, z: 6 },
    update: (_dtMs, elapsedMs) => {
      // The stove breathes — slow, deterministic, no random.
      stove.glow.intensity = 5 + Math.sin((elapsedMs / 1000) * 1.8) * 0.8;
    },
  };
}

export const kitchenSurfaces: WorldSurfaces = {
  floorBase: "#c9886a",
  floorTexture: tileTexture,
  platformColor: 0xe8e2d4,
  lipColor: 0xc0c6cc,
};
