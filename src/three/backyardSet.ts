import * as THREE from "three";
import type { WorldSurfaces } from "./level3d";
import type { WorldSet } from "./worldThemes";

/**
 * World 5 — Backyard set dressing, from the scene anchor prompt in
 * docs/art-direction/scenery-prompt-library.md:
 *
 *   saturated green · sky blue · warm brown · flower pink; grass blades
 *   tower like trees, a sun-bleached playset looms mid-ground, hedgerows
 *   form the background walls. Bright midday sun, crisp shadows — the
 *   only outdoor area and the most open, bright scene in the game.
 *
 * The outdoor rig is the structural departure: NO wallpaper wall — a
 * hedgerow ~4.5 tall with real sky (scene.background) above it, and a
 * HemisphereLight replacing the indoor ambient.
 *
 * Same z-layers as the indoor sets: backdrop -8, landmarks -5,
 * clutter -2.6, gameplay 0, foreground +1.9. Procedural, seeded LCG.
 */

export const BACKYARD = {
  fogColor: 0xd8f0d0,
  fogNear: 15,
  fogFar: 60,
  sky: 0xa8d8f0,
  grass: 0x6ab04c,
  blade: 0x7ec85e,
  bladeDark: 0x559440,
  hedge: 0x5c8a4a,
  hedgeLight: 0x73a85e,
  woodSun: 0xc9a878,
  woodPale: 0xdbc096,
  sand: 0xe8d8a8,
  flowerPink: 0xe88aa8,
  flowerYellow: 0xf0d060,
  truckRed: 0xc94f3a,
} as const;

const BACKDROP_Z = -8;
const LANDMARK_Z = -5;
const CLUTTER_Z = -2.6;
const FOREGROUND_Z = 1.9;

/** Deterministic LCG so the yard dresses identically on every load. */
function makeRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Grass floor — green base with vertical blade strokes. */
function grassTexture(base: string): THREE.Texture {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rand = makeRand(19);
  for (let i = 0; i < 650; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const light = rand() > 0.45;
    ctx.fillStyle = light ? "rgba(190, 235, 150, 0.16)" : "rgba(40, 90, 30, 0.14)";
    ctx.fillRect(x, y, 1.2, 4.2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

/**
 * Hedgerow backdrop — two jittered rows of overlapping leafy spheres.
 * Short enough (~4.5) that the sky background shows above it.
 */
function buildHedgerow(minX: number, maxX: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  for (let x = minX - 6; x < maxX + 8; x += 1.25) {
    for (const [zOff, scale, colorPick] of [
      [0, 1.0, BACKYARD.hedge],
      [1.1, 0.85, BACKYARD.hedgeLight],
    ] as const) {
      const r = (0.75 + rand() * 0.4) * scale;
      const blob = new THREE.Mesh(
        new THREE.SphereGeometry(r, 12, 9),
        new THREE.MeshLambertMaterial({ color: colorPick }),
      );
      blob.position.set(
        x + (rand() - 0.5) * 0.7,
        0.9 + rand() * 2.1 * scale,
        BACKDROP_Z + zOff,
      );
      group.add(blob);
    }
  }
  return group;
}

/** Flower clusters at the hedge base. */
function buildFlowers(x: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const count = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i += 1) {
    const color = rand() > 0.5 ? BACKYARD.flowerPink : BACKYARD.flowerYellow;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16 + rand() * 0.1, 10, 8),
      new THREE.MeshLambertMaterial({ color }),
    );
    const fx = x + (i - count / 2) * 0.5 + (rand() - 0.5) * 0.3;
    const fy = 0.5 + rand() * 0.5;
    head.position.set(fx, fy, BACKDROP_Z + 1.9);
    group.add(head);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, fy, 6),
      new THREE.MeshLambertMaterial({ color: BACKYARD.bladeDark }),
    );
    stem.position.set(fx, fy / 2, BACKDROP_Z + 1.9);
    group.add(stem);
  }
  return group;
}

/** The sun-bleached playset: A-frame swing set with two swings. */
function buildPlayset(x: number): THREE.Group {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: BACKYARD.woodSun });
  const h = 6.5;
  const spread = 1.6;

  for (const dx of [-3.2, 3.2]) {
    for (const dz of [-spread / 2, spread / 2]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, h, 10), poleMat);
      pole.position.set(x + dx + dz * 0.5, h / 2, LANDMARK_Z + dz);
      pole.rotation.z = dz > 0 ? 0.1 : -0.1;
      pole.castShadow = true;
      group.add(pole);
    }
  }

  const crossbar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 7.2, 10),
    poleMat,
  );
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(x, h - 0.2, LANDMARK_Z);
  crossbar.castShadow = true;
  group.add(crossbar);

  for (const dx of [-1.4, 1.2]) {
    for (const rope of [-0.45, 0.45]) {
      const line = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 3.4, 6),
        new THREE.MeshLambertMaterial({ color: 0xb0a890 }),
      );
      line.position.set(x + dx + rope, h - 0.2 - 1.7, LANDMARK_Z);
      group.add(line);
    }
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: BACKYARD.woodPale }),
    );
    seat.position.set(x + dx, h - 0.2 - 3.4, LANDMARK_Z);
    seat.castShadow = true;
    group.add(seat);
  }

  return group;
}

/** Sandbox corner — wood frame + sand fill. */
function buildSandbox(x: number): THREE.Group {
  const group = new THREE.Group();
  const w = 4.2;
  const frameMat = new THREE.MeshLambertMaterial({ color: BACKYARD.woodSun });
  for (const [dx, dz, len, rot] of [
    [0, -1.0, w, 0],
    [0, 1.0, w, 0],
    [-w / 2, 0, 2.0, Math.PI / 2],
    [w / 2, 0, 2.0, Math.PI / 2],
  ] as const) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.22), frameMat);
    plank.position.set(x + dx, 0.25, LANDMARK_Z + dz);
    plank.rotation.y = rot;
    plank.castShadow = true;
    group.add(plank);
  }
  const sandFill = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.2, 0.3, 1.9),
    new THREE.MeshLambertMaterial({ color: BACKYARD.sand }),
  );
  sandFill.position.set(x, 0.15, LANDMARK_Z);
  group.add(sandFill);
  // A toy shovel stuck in the sand.
  const shovelHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8),
    new THREE.MeshLambertMaterial({ color: BACKYARD.truckRed }),
  );
  shovelHandle.position.set(x + 0.9, 0.7, LANDMARK_Z);
  shovelHandle.rotation.z = 0.3;
  group.add(shovelHandle);
  return group;
}

/** A cluster of giant grass blades — thin tilted cones. */
function buildGrassClump(
  x: number,
  z: number,
  rand: () => number,
  heightScale = 1,
): THREE.Group {
  const group = new THREE.Group();
  const blades = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < blades; i += 1) {
    const h = (2.2 + rand() * 1.8) * heightScale;
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, h, 6),
      new THREE.MeshLambertMaterial({
        color: rand() > 0.4 ? BACKYARD.blade : BACKYARD.bladeDark,
      }),
    );
    blade.position.set(x + (i - blades / 2) * 0.28 + (rand() - 0.5) * 0.2, h / 2, z);
    blade.rotation.z = (rand() - 0.5) * 0.3;
    blade.castShadow = true;
    group.add(blade);
  }
  return group;
}

/** Toy truck — cab + bed + four wheels. */
function buildTruck(x: number): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: BACKYARD.truckRed });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.8), bodyMat);
  bed.position.set(x, 0.65, CLUTTER_Z);
  bed.castShadow = true;
  group.add(bed);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.76), bodyMat);
  cab.position.set(x - 0.75, 1.1, CLUTTER_Z);
  cab.castShadow = true;
  group.add(cab);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x33363a });
  for (const dx of [-0.7, 0.6]) {
    for (const dz of [-0.42, 0.42]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 14), wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x + dx, 0.26, CLUTTER_Z + dz);
      group.add(wheel);
    }
  }
  return group;
}

/** Dress the backyard across the level's world-space x range. */
export function buildBackyardSet(minX: number, maxX: number): WorldSet {
  const rand = makeRand(20260613);
  const group = new THREE.Group();
  const width = maxX - minX;

  // Backdrop: hedgerow with sky above (no wall — the outdoor payoff).
  group.add(buildHedgerow(minX, maxX, rand));
  for (let i = 0; i < Math.max(3, Math.floor(width / 12)); i += 1) {
    group.add(buildFlowers(minX + 3 + rand() * (width - 6), rand));
  }

  // Landmarks.
  group.add(buildSandbox(minX + width * 0.12));
  group.add(buildPlayset(minX + width * 0.55));
  for (const fx of [0.3, 0.72, 0.92]) {
    group.add(buildGrassClump(minX + width * fx, LANDMARK_Z + 1.5, rand, 1.4));
  }

  // Clutter.
  group.add(buildTruck(minX + width * 0.4));
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.26, 0.55, 14),
    new THREE.MeshLambertMaterial({ color: BACKYARD.flowerYellow }),
  );
  bucket.position.set(minX + width * 0.66, 0.28, CLUTTER_Z + 0.4);
  bucket.castShadow = true;
  group.add(bucket);
  for (let i = 0; i < Math.max(3, Math.floor(width / 18)); i += 1) {
    group.add(buildGrassClump(minX + 2 + rand() * (width - 4), CLUTTER_Z, rand, 0.8));
  }

  // Foreground: sparse tall blades — the diorama looks THROUGH the grass.
  for (let x = minX + 3; x < maxX - 2; x += 8 + rand() * 4) {
    const h = 1.2 + rand() * 0.7;
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, h, 6),
      new THREE.MeshLambertMaterial({
        color: rand() > 0.5 ? BACKYARD.blade : BACKYARD.bladeDark,
      }),
    );
    blade.position.set(x, h / 2, FOREGROUND_Z);
    blade.rotation.z = (rand() - 0.5) * 0.25;
    group.add(blade);
  }

  // ── Outdoor lighting rig (the structural departure) ────────────────────
  // HemisphereLight replaces the indoor ambient: sky blue from above,
  // grass-bounce green from below.
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6a9a4a, 0.7);
  group.add(hemi);

  // Bright midday sun — crisp shadows, steepest key in the game.
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0004;
  const sunTarget = new THREE.Object3D();
  group.add(sunTarget);
  sun.target = sunTarget;
  group.add(sun);

  return { group, sun, sunTarget, sunOffset: { x: 4, y: 14, z: 7 } };
}

export const backyardSurfaces: WorldSurfaces = {
  floorBase: "#6ab04c",
  floorTexture: grassTexture,
  platformColor: 0xc9a878,
  lipColor: 0x8a6a48,
};
