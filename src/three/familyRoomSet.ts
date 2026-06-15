import * as THREE from "three";
import type { WorldSurfaces } from "./level3d";
import type { WorldSet } from "./worldThemes";

/**
 * World 4 — Family Room set dressing, from the scene anchor prompt in
 * docs/art-direction/scenery-prompt-library.md:
 *
 *   warm amber · burgundy · cream · fireplace orange; a plush sofa as a
 *   mountain range, a fireplace glowing amber in the far background that
 *   flickers across the whole scene, an entertainment center of monolithic
 *   slabs. Epic and cozy.
 *
 * First world with an ANIMATED light: the fireplace flickers via the
 * WorldSet.update hook — two incommensurate sines, fully deterministic.
 *
 * Same skeleton as bedroomSet: backdrop -8, landmarks -5, clutter -2.6,
 * gameplay 0, foreground +1.9. Procedural, palette-locked, seeded LCG.
 */

export const FAMILY_ROOM = {
  fogColor: 0xf0d8b0,
  fogNear: 14,
  fogFar: 36,
  wall: "#e8d4b0",
  wallShade: "#dfc9a2",
  burgundy: 0x8a4a52,
  sofa: 0xa86070,
  cushion: 0xc07a82,
  cream: 0xf5e8d0,
  woodDark: 0x6a4a32,
  brick: "#9a5a48",
  brickGrout: "#7e483a",
  fire: 0xff8a48,
  tvDark: 0x2a2e34,
} as const;

const WALL_Z = -8;
const LANDMARK_Z = -5;
const CLUTTER_Z = -2.6;
const FOREGROUND_Z = 1.9;
const WALL_HEIGHT = 13;

/** Deterministic LCG so the room dresses identically on every load. */
function makeRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Soft two-tone wall — quieter than wallpaper, lets the fire glow play. */
function wallTexture(): THREE.Texture {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = FAMILY_ROOM.wall;
  ctx.fillRect(0, 0, size, size);
  // Wide, faint horizontal wainscot band.
  ctx.fillStyle = FAMILY_ROOM.wallShade;
  ctx.fillRect(0, size * 0.72, size, size * 0.28);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Brick courses for the fireplace surround. */
function brickTexture(): THREE.Texture {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = FAMILY_ROOM.brickGrout;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = FAMILY_ROOM.brick;
  const bw = 30;
  const bh = 13;
  for (let row = 0; row < size / (bh + 2) + 1; row += 1) {
    const off = row % 2 === 0 ? 0 : -(bw + 2) / 2;
    for (let col = -1; col < size / (bw + 2) + 1; col += 1) {
      ctx.fillRect(off + col * (bw + 2) + 1, row * (bh + 2) + 1, bw, bh);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Extra-plush carpet — denser weave and fatter tufts than the bedroom's. */
function thickCarpetTexture(base: string): THREE.Texture {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rand = makeRand(17);
  for (let i = 0; i < 2800; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const light = rand() > 0.5;
    ctx.fillStyle = light ? "rgba(255, 238, 214, 0.12)" : "rgba(96, 62, 40, 0.10)";
    ctx.fillRect(x, y, 2.4, 2.4);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

function buildWall(minX: number, maxX: number): THREE.Group {
  const group = new THREE.Group();
  const width = maxX - minX + 40;

  const tex = wallTexture();
  tex.repeat.set(width / 10, 1);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(width, WALL_HEIGHT),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  wall.position.set((minX + maxX) / 2, WALL_HEIGHT / 2 - 0.2, WALL_Z);
  wall.receiveShadow = true;
  group.add(wall);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.55, 0.18),
    new THREE.MeshLambertMaterial({ color: FAMILY_ROOM.cream }),
  );
  base.position.set((minX + maxX) / 2, 0.27, WALL_Z + 0.12);
  group.add(base);

  return group;
}

/** Big framed landscape + drapes — the far-wall dressing. */
function buildWallArt(x: number): THREE.Group {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 1.4, 0.08),
    new THREE.MeshLambertMaterial({ color: FAMILY_ROOM.woodDark }),
  );
  frame.position.set(x, 6.2, WALL_Z + 0.1);
  const canvasPane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.1),
    new THREE.MeshLambertMaterial({ color: 0xc9b6a0 }),
  );
  canvasPane.position.set(x, 6.2, WALL_Z + 0.16);
  group.add(frame, canvasPane);
  return group;
}

function buildCurtain(x: number, lean: number): THREE.Mesh {
  const curtain = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 7.2, 0.3),
    new THREE.MeshLambertMaterial({ color: FAMILY_ROOM.burgundy }),
  );
  curtain.position.set(x, 4.4, WALL_Z + 0.25);
  curtain.rotation.z = lean;
  return curtain;
}

/** The sofa mountain — seat, back, arm cylinders, jittered cushions. */
function buildSofa(x: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const w = 7.5;
  const seatMat = new THREE.MeshLambertMaterial({ color: FAMILY_ROOM.sofa });
  const cushionMat = new THREE.MeshLambertMaterial({ color: FAMILY_ROOM.cushion });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, 2.0), seatMat);
  seat.position.set(x, 0.8, LANDMARK_Z);
  seat.castShadow = true;
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, 0.7), seatMat);
  back.position.set(x, 2.6, LANDMARK_Z - 0.65);
  back.castShadow = true;
  group.add(back);

  for (const dx of [-w / 2 + 0.45, w / 2 - 0.45]) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 2.0, 16),
      seatMat,
    );
    arm.rotation.x = Math.PI / 2;
    arm.position.set(x + dx, 2.0, LANDMARK_Z);
    arm.castShadow = true;
    group.add(arm);
  }

  const cushions = 3;
  for (let i = 0; i < cushions; i += 1) {
    const cw = (w - 1.6) / cushions;
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(cw - 0.15, 0.7, 1.8), cushionMat);
    cushion.position.set(
      x - (w - 1.6) / 2 + (i + 0.5) * cw,
      1.95 + (rand() - 0.5) * 0.16,
      LANDMARK_Z + 0.1,
    );
    cushion.rotation.z = (rand() - 0.5) * 0.05;
    cushion.castShadow = true;
    group.add(cushion);
  }

  return group;
}

/**
 * The fireplace — brick surround, dark hearth, glow pane, mantle.
 * Returns the flicker light for the set's update hook.
 */
function buildFireplace(x: number): { group: THREE.Group; fire: THREE.PointLight } {
  const group = new THREE.Group();
  const w = 4.6;
  const h = 5.0;

  const tex = brickTexture();
  tex.repeat.set(2.2, 2.4);
  const surround = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 1.2),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  surround.position.set(x, h / 2, LANDMARK_Z);
  surround.castShadow = true;
  group.add(surround);

  // Hearth opening: dark inset + glowing fire pane (clear of the brick face).
  const opening = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.2),
    new THREE.MeshBasicMaterial({ color: 0x1c1410 }),
  );
  opening.position.set(x, 1.45, LANDMARK_Z + 0.62);
  group.add(opening);
  // Fire = deep ember base + smaller bright core; a single flat pane reads
  // as a painted square, two stacked tones read as flame.
  const ember = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.95),
    new THREE.MeshBasicMaterial({ color: 0xd95a20 }),
  );
  ember.position.set(x, 0.95, LANDMARK_Z + 0.7);
  group.add(ember);
  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 0.55),
    new THREE.MeshBasicMaterial({ color: 0xffc06a }),
  );
  core.position.set(x, 0.85, LANDMARK_Z + 0.74);
  group.add(core);

  // Mantle shelf + a candle pair.
  const mantle = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.7, 0.28, 1.5),
    new THREE.MeshLambertMaterial({ color: FAMILY_ROOM.woodDark }),
  );
  mantle.position.set(x, h + 0.14, LANDMARK_Z);
  mantle.castShadow = true;
  group.add(mantle);
  for (const dx of [-1.4, 1.5]) {
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.6 + (dx > 0 ? 0.25 : 0), 10),
      new THREE.MeshLambertMaterial({ color: FAMILY_ROOM.cream }),
    );
    candle.position.set(x + dx, h + 0.28 + 0.3, LANDMARK_Z);
    group.add(candle);
  }

  const fire = new THREE.PointLight(FAMILY_ROOM.fire, 6, 14, 1.5);
  fire.position.set(x, 1.6, LANDMARK_Z + 1.4);
  group.add(fire);

  return { group, fire };
}

/** Entertainment center — dark shelving, glossy TV slab, game cases. */
function buildEntertainmentCenter(x: number): THREE.Group {
  const group = new THREE.Group();
  const w = 5.0;
  const h = 4.5;
  const frameMat = new THREE.MeshLambertMaterial({ color: FAMILY_ROOM.woodDark });

  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), frameMat);
  back.position.set(x, h / 2, LANDMARK_Z - 0.5);
  group.add(back);
  for (const dx of [-w / 2, w / 2]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, 1.1), frameMat);
    side.position.set(x + dx, h / 2, LANDMARK_Z);
    group.add(side);
  }
  for (const sy of [0.1, 2.0, h]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 1.1), frameMat);
    board.position.set(x, sy, LANDMARK_Z);
    group.add(board);
  }

  // The TV — glossy dark slab on the middle shelf.
  const tv = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.9, 0.18),
    new THREE.MeshPhongMaterial({ color: FAMILY_ROOM.tvDark, shininess: 80 }),
  );
  tv.position.set(x - 0.2, 3.15, LANDMARK_Z + 0.1);
  group.add(tv);

  // Game cases leaning on the lower shelf.
  for (let i = 0; i < 3; i += 1) {
    const gameCase = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.95, 0.7),
      new THREE.MeshLambertMaterial({
        color: [FAMILY_ROOM.cushion, 0x5a7a8a, 0x7a8a5a][i]!,
      }),
    );
    gameCase.position.set(x + 1.2 + i * 0.16, 0.66, LANDMARK_Z + 0.15);
    gameCase.rotation.z = i === 2 ? -0.18 : 0;
    group.add(gameCase);
  }

  return group;
}

/** Dress the family room across the level's world-space x range. */
export function buildFamilyRoomSet(minX: number, maxX: number): WorldSet {
  const rand = makeRand(20260612);
  const group = new THREE.Group();
  const width = maxX - minX;

  group.add(buildWall(minX, maxX));
  group.add(buildWallArt(minX + width * 0.3));
  group.add(buildCurtain(minX + width * 0.08, 0.03));
  group.add(buildCurtain(minX + width * 0.86, -0.04));

  // Landmarks: sofa early-mid, fireplace at ~70%, entertainment center late.
  group.add(buildSofa(minX + width * 0.3, rand));
  const fireplace = buildFireplace(minX + width * 0.7);
  group.add(fireplace.group);
  group.add(buildEntertainmentCenter(minX + width * 0.9));
  if (width > 56) {
    group.add(buildSofa(minX + width * 0.55, rand));
  }

  // Floor clutter: remote, mug, stacked cases.
  const remote = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.16, 0.3),
    new THREE.MeshLambertMaterial({ color: FAMILY_ROOM.tvDark }),
  );
  remote.position.set(minX + width * 0.42, 0.08, CLUTTER_Z + 0.3);
  remote.rotation.y = 0.5;
  remote.castShadow = true;
  group.add(remote);
  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.18, 0.42, 14),
    new THREE.MeshLambertMaterial({ color: FAMILY_ROOM.cream }),
  );
  mug.position.set(minX + width * 0.62, 0.21, CLUTTER_Z + 0.5);
  mug.castShadow = true;
  group.add(mug);
  for (let i = 0; i < 2; i += 1) {
    const stackedCase = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.1, 0.5),
      new THREE.MeshLambertMaterial({ color: i === 0 ? 0x5a7a8a : FAMILY_ROOM.cushion }),
    );
    stackedCase.position.set(minX + width * 0.78 + i * 0.06, 0.05 + i * 0.11, CLUTTER_Z);
    stackedCase.rotation.y = i * 0.25;
    group.add(stackedCase);
  }

  // Foreground crumbs: a throw pillow corner + a fat crayon.
  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.5, 0.8),
    new THREE.MeshLambertMaterial({ color: FAMILY_ROOM.burgundy }),
  );
  pillow.position.set(minX + width * 0.2, 0.25, FOREGROUND_Z);
  pillow.rotation.y = 0.4;
  pillow.rotation.z = 0.06;
  group.add(pillow);
  const crayon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 1.0, 12),
    new THREE.MeshLambertMaterial({ color: 0x7aa8a0 }),
  );
  crayon.rotation.z = Math.PI / 2 + 0.12;
  crayon.rotation.y = 0.4;
  crayon.position.set(minX + width * 0.58, 0.115, FOREGROUND_Z);
  group.add(crayon);

  // ── Lighting rig (scenery library knobs, Family Room column) ───────────
  // Knobs-row values (0.7/0.5) read murky in practice; scaled up the same
  // way bedroom shipped (1.15 vs its 0.8 row). Still the dimmest indoor world.
  const ambient = new THREE.AmbientLight(0xffe8c8, 0.58);
  group.add(ambient);

  // Fire-warm key.
  const sun = new THREE.DirectionalLight(0xffc890, 0.95);
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

  // Cool violet counter-fill — makes the fire read warmer by contrast.
  const fill = new THREE.DirectionalLight(0xc9b6e4, 0.15);
  fill.position.set(minX + width * 0.15, 8, 5);
  group.add(fill);

  // Warm fire-glow pools along the room (the bedroom lamp-pool pattern) —
  // the fireplace "illuminates the whole scene" per the scenery library.
  for (const lx of [minX + width * 0.28, minX + width * 0.88]) {
    const pool = new THREE.PointLight(0xffa860, 4.5, 12, 1.5);
    pool.position.set(lx, 4, 1.5);
    group.add(pool);
  }

  return {
    group,
    sun,
    sunTarget,
    sunOffset: { x: 6, y: 10, z: 8 },
    update: (_dtMs, elapsedMs) => {
      // Two incommensurate sines ≈ organic flicker, fully deterministic.
      const t = elapsedMs / 1000;
      fireplace.fire.intensity = 6 + Math.sin(t * 7.3) * 0.9 + Math.sin(t * 13.7) * 0.5;
    },
  };
}

export const familyRoomSurfaces: WorldSurfaces = {
  floorBase: "#b89070",
  floorTexture: thickCarpetTexture,
  platformColor: 0xd4a878,
  lipColor: 0x9a7040,
};
