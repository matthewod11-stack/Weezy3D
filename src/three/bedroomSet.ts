import * as THREE from "three";

/**
 * World 1 — Bedroom set dressing, from the scene anchor prompt in
 * docs/art-direction/scenery-prompt-library.md:
 *
 *   dusty rose · cream · muted sage · warm amber lamplight; wallpaper far
 *   plane (fog-softened), wooden bookshelf landmarks mid-ground, toy
 *   clutter near-ground; warm lamp glow from the right, cool window light
 *   from the left.
 *
 * Everything is procedural low-poly geometry in the locked palette — no
 * image assets. Layered by z: wallpaper -8, shelves -5, toys -2.5,
 * gameplay 0, foreground crumbs +1.8.
 */

export const BEDROOM = {
  fogColor: 0xf5e8d0,
  fogNear: 14,
  fogFar: 36,
  wallpaperBase: "#e9c6ca",
  wallpaperDot: "#f6ead8",
  cream: 0xf5e8d0,
  woodDark: 0xb8804a,
  woodMid: 0xcf9a60,
  sage: 0xa8bca0,
  butter: 0xf0d890,
  rose: 0xd8a0a8,
  teal: 0x7aa8a0,
} as const;

const WALL_Z = -8;
const SHELF_Z = -5;
const TOY_Z = -2.6;
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

function wallpaperTexture(): THREE.Texture {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = BEDROOM.wallpaperBase;
  ctx.fillRect(0, 0, size, size);
  // Offset polka-dot grid — classic nursery wallpaper.
  ctx.fillStyle = BEDROOM.wallpaperDot;
  const step = 64;
  for (let row = 0; row < size / step + 1; row += 1) {
    for (let col = 0; col < size / step + 1; col += 1) {
      const x = col * step + (row % 2 === 0 ? 0 : step / 2);
      const y = row * step;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildWallpaper(minX: number, maxX: number): THREE.Group {
  const group = new THREE.Group();
  const width = maxX - minX + 40;

  const tex = wallpaperTexture();
  tex.repeat.set(width / 4, WALL_HEIGHT / 4);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(width, WALL_HEIGHT),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  wall.position.set((minX + maxX) / 2, WALL_HEIGHT / 2 - 0.2, WALL_Z);
  wall.receiveShadow = true;
  group.add(wall);

  // Baseboard trim.
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.55, 0.18),
    new THREE.MeshLambertMaterial({ color: 0xf2e4cd }),
  );
  base.position.set((minX + maxX) / 2, 0.27, WALL_Z + 0.12);
  group.add(base);

  return group;
}

/** Cool daylight window on the wallpaper — the left-side light source. */
function buildWindow(x: number): THREE.Group {
  const group = new THREE.Group();
  const w = 3.1;
  const h = 3.8;
  const cy = 5.6;

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: 0xdcecf5 }),
  );
  glow.position.set(x, cy, WALL_Z + 0.05);
  group.add(glow);

  const frameMat = new THREE.MeshLambertMaterial({ color: 0xf6efe2 });
  const frameThickness = 0.16;
  const horizontals = [cy - h / 2, cy, cy + h / 2];
  for (const y of horizontals) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, frameThickness, 0.1), frameMat);
    bar.position.set(x, y, WALL_Z + 0.1);
    group.add(bar);
  }
  for (const dx of [-w / 2, 0, w / 2]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, h + 0.2, 0.1), frameMat);
    bar.position.set(x + dx, cy, WALL_Z + 0.1);
    group.add(bar);
  }

  // Soft cool pool of light cast into the room from the window.
  const light = new THREE.PointLight(0xcfe2f0, 4, 12, 1.4);
  light.position.set(x, cy, WALL_Z + 2.5);
  group.add(light);

  return group;
}

/** Mid-background bookshelf landmark with palette-colored book rows. */
function buildBookshelf(x: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const w = 4.4;
  const h = 6.2;
  const d = 1.1;
  const frameMat = new THREE.MeshLambertMaterial({ color: BEDROOM.woodDark });
  const shelfMat = new THREE.MeshLambertMaterial({ color: BEDROOM.woodMid });
  const bookColors = [BEDROOM.sage, BEDROOM.butter, BEDROOM.rose, BEDROOM.teal, 0xc9b6e4];

  const sideGeo = new THREE.BoxGeometry(0.22, h, d);
  const left = new THREE.Mesh(sideGeo, frameMat);
  left.position.set(x - w / 2, h / 2, SHELF_Z);
  const right = new THREE.Mesh(sideGeo, frameMat);
  right.position.set(x + w / 2, h / 2, SHELF_Z);
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.12),
    new THREE.MeshLambertMaterial({ color: 0xa06f3e }),
  );
  back.position.set(x, h / 2, SHELF_Z - d / 2);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.22, d), frameMat);
  top.position.set(x, h, SHELF_Z);
  group.add(left, right, back, top);

  const shelfYs = [1.5, 3.1, 4.7];
  for (const sy of shelfYs) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), shelfMat);
    board.position.set(x, sy, SHELF_Z);
    group.add(board);

    // A row of books: thin tilted boxes in palette colors.
    let bx = x - w / 2 + 0.4;
    while (bx < x + w / 2 - 0.45) {
      const bw = 0.18 + rand() * 0.14;
      const bh = 0.72 + rand() * 0.42;
      const color = bookColors[Math.floor(rand() * bookColors.length)]!;
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, 0.62),
        new THREE.MeshLambertMaterial({ color }),
      );
      const lean = rand() < 0.16 ? (rand() - 0.5) * 0.22 : 0;
      book.position.set(bx + bw / 2, sy + 0.08 + bh / 2, SHELF_Z);
      book.rotation.z = lean;
      group.add(book);
      bx += bw + 0.05 + (rand() < 0.12 ? 0.3 : 0);
    }
  }

  // Ground books stacked beside the shelf.
  const stack = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.5, 0.7),
    new THREE.MeshLambertMaterial({ color: BEDROOM.teal }),
  );
  stack.position.set(x + w / 2 + 0.8, 0.25, SHELF_Z + 0.4);
  stack.rotation.y = 0.3;
  group.add(stack);

  return group;
}

/** Alphabet block: soft-colored cube with a cream face inset. */
function buildBlock(x: number, size: number, color: number, rotY: number, z = TOY_Z): THREE.Group {
  const group = new THREE.Group();
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshLambertMaterial({ color }),
  );
  cube.position.set(x, size / 2, z);
  cube.rotation.y = rotY;
  cube.castShadow = true;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 0.62, size * 0.62),
    new THREE.MeshLambertMaterial({ color: BEDROOM.cream }),
  );
  face.position.set(0, 0, size / 2 + 0.004);
  cube.add(face);
  group.add(cube);
  return group;
}

function buildBall(x: number, rand: () => number): THREE.Mesh {
  const r = 0.5 + rand() * 0.18;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 18),
    new THREE.MeshLambertMaterial({ color: BEDROOM.rose }),
  );
  ball.position.set(x, r, TOY_Z + 0.5);
  ball.castShadow = true;
  return ball;
}

/** Fat crayons lying in the near foreground — frame the diorama. */
function buildCrayon(x: number, color: number, rotZ: number): THREE.Mesh {
  const crayon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 1.0, 12),
    new THREE.MeshLambertMaterial({ color }),
  );
  crayon.rotation.z = Math.PI / 2 + rotZ;
  crayon.rotation.y = 0.4;
  crayon.position.set(x, 0.115, FOREGROUND_Z);
  return crayon;
}

export interface BedroomSet {
  group: THREE.Group;
  /** Shadow-casting key light — main loop re-targets it to follow the player. */
  sun: THREE.DirectionalLight;
  sunTarget: THREE.Object3D;
}

/** Dress the room across the level's world-space x range. */
export function buildBedroomSet(minX: number, maxX: number): BedroomSet {
  const rand = makeRand(20260609);
  const group = new THREE.Group();
  const width = maxX - minX;

  group.add(buildWallpaper(minX, maxX));

  // Windows at the level's first and last thirds.
  group.add(buildWindow(minX + width * 0.18));
  if (width > 36) {
    group.add(buildWindow(minX + width * 0.72));
  }

  // Bookshelf landmarks between the windows.
  group.add(buildBookshelf(minX + width * 0.42, rand));
  if (width > 48) {
    group.add(buildBookshelf(minX + width * 0.9, rand));
  }

  // Toy clutter along the floor, deterministic scatter.
  const blockColors = [BEDROOM.sage, BEDROOM.butter, BEDROOM.rose, BEDROOM.teal];
  for (let i = 0; i < Math.max(4, Math.floor(width / 11)); i += 1) {
    const x = minX + 3 + rand() * (width - 6);
    const size = 0.55 + rand() * 0.35;
    const color = blockColors[i % blockColors.length]!;
    group.add(buildBlock(x, size, color, rand() * 1.2));
    if (rand() < 0.4) {
      group.add(buildBlock(x + 0.5, size * 0.7, blockColors[(i + 2) % 4]!, rand() * 1.2));
    }
  }
  group.add(buildBall(minX + width * 0.3, rand));
  group.add(buildBall(minX + width * 0.62, rand));

  // Foreground crumbs — sparse, low, never blocking the play line for long.
  group.add(buildCrayon(minX + width * 0.24, BEDROOM.teal, 0.1));
  group.add(buildCrayon(minX + width * 0.55, 0xe07a5f, -0.06));
  group.add(buildCrayon(minX + width * 0.83, BEDROOM.sage, 0.18));

  // ── Lighting rig (scenery library atmosphere knobs, Bedroom column) ────
  const ambient = new THREE.AmbientLight(0xfff1e0, 0.55);
  group.add(ambient);

  // Warm key (the "lamp glow from the right") — casts the platform shadows.
  const sun = new THREE.DirectionalLight(0xffd9a8, 1.15);
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

  // Cool fill from the window side.
  const fill = new THREE.DirectionalLight(0xa9c4dd, 0.32);
  fill.position.set(minX + width * 0.15, 8, 5);
  group.add(fill);

  // Warm lamp pools along the room (off-screen lamps).
  const lampXs = width > 40 ? [minX + width * 0.55, maxX - 4] : [maxX - 4];
  for (const lx of lampXs) {
    const lamp = new THREE.PointLight(0xffb066, 5, 13, 1.5);
    lamp.position.set(lx, 4.2, 1.5);
    group.add(lamp);
  }

  return { group, sun, sunTarget };
}
