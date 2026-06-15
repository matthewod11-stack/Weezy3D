import * as THREE from "three";
import type { WorldSurfaces } from "./level3d";
import type { WorldSet } from "./worldThemes";

/**
 * World 2 — Hallway set dressing, from the scene anchor prompt in
 * docs/art-direction/scenery-prompt-library.md:
 *
 *   slate blue · warm wood · grey carpet · cool window light from the end;
 *   slightly liminal and narrow — a bench looms overhead, a shoe rack rises
 *   like canyon walls, and a cool blue-grey window at the far end gives the
 *   vanishing-point depth cue.
 *
 * Same skeleton as bedroomSet: backdrop -8, landmarks -5, clutter -2.6,
 * gameplay 0, foreground +1.9. Procedural, palette-locked, seeded LCG.
 */

export const HALLWAY = {
  fogColor: 0xc5cfd8,
  fogNear: 12,
  fogFar: 31,
  wall: "#d8dde4",
  wallStripe: "#cdd4dd",
  woodWarm: 0xb8884f,
  woodDark: 0x8a6238,
  runner: 0xa04848,
  slate: 0x8fa3b8,
  shoeNavy: 0x4a5a78,
  shoeRed: 0xb05555,
  cream: 0xf2ede2,
} as const;

const WALL_Z = -8;
const LANDMARK_Z = -5;
const CLUTTER_Z = -2.6;
const FOREGROUND_Z = 1.9;
const WALL_HEIGHT = 13;

/** Deterministic LCG so the hallway dresses identically on every load. */
function makeRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Subtle vertical-stripe wallpaper — cooler and quieter than the bedroom dots. */
function stripeTexture(): THREE.Texture {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = HALLWAY.wall;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = HALLWAY.wallStripe;
  for (let x = 0; x < size; x += 48) {
    ctx.fillRect(x, 0, 20, size);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Hardwood planks for the gameplay floor. */
function plankTexture(base: string): THREE.Texture {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rand = makeRand(11);
  // Plank seams.
  ctx.fillStyle = "rgba(80, 52, 30, 0.35)";
  for (let x = 0; x < size; x += 32) {
    ctx.fillRect(x, 0, 1.5, size);
  }
  // Grain flecks.
  for (let i = 0; i < 500; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const light = rand() > 0.5;
    ctx.fillStyle = light ? "rgba(255, 235, 205, 0.08)" : "rgba(70, 45, 25, 0.10)";
    ctx.fillRect(x, y, 1.2, 3.5);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function buildWall(minX: number, maxX: number): THREE.Group {
  const group = new THREE.Group();
  const width = maxX - minX + 40;

  const tex = stripeTexture();
  tex.repeat.set(width / 5, WALL_HEIGHT / 5);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(width, WALL_HEIGHT),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  wall.position.set((minX + maxX) / 2, WALL_HEIGHT / 2 - 0.2, WALL_Z);
  wall.receiveShadow = true;
  group.add(wall);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.55, 0.18),
    new THREE.MeshLambertMaterial({ color: HALLWAY.cream }),
  );
  base.position.set((minX + maxX) / 2, 0.27, WALL_Z + 0.12);
  group.add(base);

  return group;
}

/** Framed family photo on the wall — cream mat, slate pane. */
function buildPhoto(x: number, y: number, w: number, h: number): THREE.Group {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.06),
    new THREE.MeshLambertMaterial({ color: HALLWAY.cream }),
  );
  frame.position.set(x, y, WALL_Z + 0.1);
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.74, h * 0.74),
    new THREE.MeshLambertMaterial({ color: HALLWAY.slate }),
  );
  pane.position.set(x, y, WALL_Z + 0.14);
  group.add(frame, pane);
  return group;
}

/**
 * The signature: a cool bright window past the level end — the light at the
 * end of the hallway that everything silhouettes against.
 */
function buildEndWindow(maxX: number): THREE.Group {
  const group = new THREE.Group();
  const x = maxX + 6;
  const cy = 4.5;

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 5.0),
    new THREE.MeshBasicMaterial({ color: 0xe8f2fa }),
  );
  glow.position.set(x, cy, -4);
  glow.rotation.y = -0.35; // angled toward the camera so it reads as "ahead"
  group.add(glow);

  const frameMat = new THREE.MeshLambertMaterial({ color: HALLWAY.cream });
  for (const dy of [-2.5, 0, 2.5]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 0.1), frameMat);
    bar.position.set(x, cy + dy, -3.95);
    bar.rotation.y = -0.35;
    group.add(bar);
  }

  const light = new THREE.PointLight(0xd8ecfa, 7, 18, 1.3);
  light.position.set(maxX + 4, cy, -2);
  group.add(light);

  return group;
}

/** Wooden bench — seat looming overhead at toy scale. */
function buildBench(x: number): THREE.Group {
  const group = new THREE.Group();
  const seatMat = new THREE.MeshLambertMaterial({ color: HALLWAY.woodWarm });
  const legMat = new THREE.MeshLambertMaterial({ color: HALLWAY.woodDark });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.35, 1.2), seatMat);
  seat.position.set(x, 2.6, LANDMARK_Z);
  seat.castShadow = true;
  group.add(seat);

  for (const dx of [-2.2, 2.2]) {
    for (const dz of [-0.4, 0.4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), legMat);
      leg.position.set(x + dx, 1.3, LANDMARK_Z + dz);
      group.add(leg);
    }
  }

  return group;
}

/** Towering shoe rack — canyon wall of little shoes. */
function buildShoeRack(x: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const w = 3.6;
  const h = 5.4;
  const d = 1.0;
  const frameMat = new THREE.MeshLambertMaterial({ color: HALLWAY.woodDark });
  const shelfMat = new THREE.MeshLambertMaterial({ color: HALLWAY.woodWarm });
  const shoeColors = [HALLWAY.shoeNavy, HALLWAY.shoeRed, HALLWAY.cream, HALLWAY.slate];

  const sideGeo = new THREE.BoxGeometry(0.2, h, d);
  const left = new THREE.Mesh(sideGeo, frameMat);
  left.position.set(x - w / 2, h / 2, LANDMARK_Z);
  const right = new THREE.Mesh(sideGeo, frameMat);
  right.position.set(x + w / 2, h / 2, LANDMARK_Z);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.2, d), frameMat);
  top.position.set(x, h, LANDMARK_Z);
  group.add(left, right, top);

  for (const sy of [1.3, 2.7, 4.1]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), shelfMat);
    board.position.set(x, sy, LANDMARK_Z);
    group.add(board);

    // Pairs of little shoes along the shelf.
    let sx = x - w / 2 + 0.5;
    while (sx < x + w / 2 - 0.6) {
      const color = shoeColors[Math.floor(rand() * shoeColors.length)]!;
      for (const off of [0, 0.34]) {
        const shoe = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.26, 0.62),
          new THREE.MeshLambertMaterial({ color }),
        );
        shoe.position.set(sx + off, sy + 0.07 + 0.13, LANDMARK_Z + (rand() - 0.5) * 0.15);
        shoe.rotation.y = (rand() - 0.5) * 0.3;
        group.add(shoe);
      }
      sx += 0.95 + rand() * 0.3;
    }
  }

  return group;
}

/** Coat hooks with one hanging bag — quiet vertical landmark. */
function buildCoatHooks(x: number): THREE.Group {
  const group = new THREE.Group();
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.2, 0.16),
    new THREE.MeshLambertMaterial({ color: HALLWAY.woodWarm }),
  );
  rail.position.set(x, 6.4, WALL_Z + 0.2);
  group.add(rail);

  for (const dx of [-0.9, 0, 0.9]) {
    const peg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8),
      new THREE.MeshLambertMaterial({ color: HALLWAY.woodDark }),
    );
    peg.rotation.x = Math.PI / 2;
    peg.position.set(x + dx, 6.25, WALL_Z + 0.35);
    group.add(peg);
  }

  const bag = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.25, 0.3),
    new THREE.MeshLambertMaterial({ color: HALLWAY.slate }),
  );
  bag.position.set(x - 0.9, 5.5, WALL_Z + 0.4);
  bag.rotation.z = 0.04;
  group.add(bag);

  return group;
}

/** A stray pair of shoes on the hallway floor. */
function buildFloorShoes(x: number, color: number, rotY: number): THREE.Group {
  const group = new THREE.Group();
  for (const [dx, dz] of [
    [0, 0],
    [0.42, 0.18],
  ] as const) {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.3, 0.78),
      new THREE.MeshLambertMaterial({ color }),
    );
    shoe.position.set(x + dx, 0.15, CLUTTER_Z + dz);
    shoe.rotation.y = rotY + dx * 0.8;
    shoe.castShadow = true;
    group.add(shoe);
  }
  return group;
}

/** Dress the hallway across the level's world-space x range. */
export function buildHallwaySet(minX: number, maxX: number): WorldSet {
  const rand = makeRand(20260610);
  const group = new THREE.Group();
  const width = maxX - minX;

  group.add(buildWall(minX, maxX));
  group.add(buildEndWindow(maxX));

  // Photos in a loose row down the hall.
  const photoCount = Math.max(3, Math.floor(width / 16));
  for (let i = 0; i < photoCount; i += 1) {
    const px = minX + 4 + (i + rand() * 0.4) * (width / photoCount);
    group.add(buildPhoto(px, 5.4 + rand() * 1.2, 0.9 + rand() * 0.3, 1.1 + rand() * 0.3));
  }

  // Landmarks: bench early, shoe rack mid, coat hooks late.
  group.add(buildBench(minX + width * 0.22));
  group.add(buildShoeRack(minX + width * 0.55, rand));
  if (width > 48) {
    group.add(buildShoeRack(minX + width * 0.95, rand));
  }
  group.add(buildCoatHooks(minX + width * 0.78));

  // Floor clutter — stray shoes, a sock ball.
  group.add(buildFloorShoes(minX + width * 0.35, HALLWAY.shoeRed, 0.4));
  group.add(buildFloorShoes(minX + width * 0.68, HALLWAY.shoeNavy, -0.7));
  const sock = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 18, 14),
    new THREE.MeshLambertMaterial({ color: HALLWAY.cream }),
  );
  sock.position.set(minX + width * 0.48, 0.28, CLUTTER_Z + 0.4);
  sock.castShadow = true;
  group.add(sock);

  // The carpet runner lies ON the hallway floor, mid-depth — it reads as
  // floor covering, not a foreground band (the floor box top spans z -7..+2.8).
  const runner = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.85, 0.05, 1.6),
    new THREE.MeshLambertMaterial({ color: HALLWAY.runner }),
  );
  runner.position.set(minX + width / 2, 0.025, -1.0);
  runner.receiveShadow = true;
  group.add(runner);

  // Foreground crumb: a dropped mitten.
  const mitten = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.62),
    new THREE.MeshLambertMaterial({ color: HALLWAY.shoeRed }),
  );
  mitten.position.set(minX + width * 0.3, 0.09, FOREGROUND_Z + 0.3);
  mitten.rotation.y = 0.5;
  group.add(mitten);

  // ── Lighting rig (scenery library atmosphere knobs, Hallway column) ────
  const ambient = new THREE.AmbientLight(0xdce6f0, 0.6);
  group.add(ambient);

  // Cool key from the window end (the right) — casts the long shadows.
  const sun = new THREE.DirectionalLight(0xeaf2fa, 0.55);
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

  // Faint warm fill from the rooms behind (left).
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.15);
  fill.position.set(minX + width * 0.1, 7, 5);
  group.add(fill);

  return { group, sun, sunTarget, sunOffset: { x: 6, y: 10, z: 8 } };
}

export const hallwaySurfaces: WorldSurfaces = {
  floorBase: "#c9a06a",
  floorTexture: plankTexture,
  platformColor: 0xcfa86a,
  lipColor: 0x8a6238,
};
