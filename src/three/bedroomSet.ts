import * as THREE from "three";
import type { WorldSurfaces } from "./level3d";
import type { WorldSet } from "./worldThemes";

/**
 * World 1 — Bedroom set dressing, from the scene anchor prompt in
 * docs/art-direction/scenery-prompt-library.md:
 *
 *   dusty rose · cream · muted sage · warm amber lamplight; wallpaper far
 *   plane (fog-softened), bookshelf/crib/toy-chest landmarks mid-ground,
 *   toy clutter near-ground; warm lamp glow from the right, cool window
 *   light from the left.
 *
 * Everything is procedural low-poly geometry in the locked palette — no
 * image assets. Layered by z: wallpaper -8, landmarks -5, toys -2.6,
 * gameplay 0, foreground crumbs +1.9.
 *
 * Dressing is CADENCE-based (playbook §5.6.7): the stitched world is
 * ~450+ units wide, so every layer places items on a seeded interval with
 * jitter instead of fixed fractions — no bare screens, no metronome grid.
 *
 * PERF BUDGET (playbook §5.6.9 — law):
 *   · ≤ 6 lights total (currently 5: ambient, key dir, cool fill dir,
 *     hero-lamp point, one window point). Repeated landmarks carry NO lights.
 *   · Exactly ONE THREE.Points for dust motes (≤200 verts, additive).
 *   · Tiny clutter never casts shadows; the wallpaper never receives them.
 *   · Seeded LCG only — deterministic renders.
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
  cribWhite: 0xf7f0e2,
  teddyBrown: 0x9c7a5e,
  teddyMuzzle: 0xc9ab8a,
  shaftCool: 0xdcecf5,
} as const;

const WALL_Z = -8;
const LANDMARK_Z = -5;
const TOY_Z = -2.6;
const FOREGROUND_Z = 1.9;
const WALL_HEIGHT = 13;

/** Hero-lamp base intensity — the update hook breathes ±12% around it. */
const LAMP_INTENSITY = 5;
const MOTE_COUNT = 180;

/** Deterministic LCG so the room dresses identically on every load. */
function makeRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * Interval placement with seeded jitter — one spot every stepMin..stepMax
 * units so long stitched worlds never metronome and never run bare.
 */
function cadenceSpots(
  start: number,
  end: number,
  stepMin: number,
  stepMax: number,
  rand: () => number,
): number[] {
  const spots: number[] = [];
  let x = start + (stepMin + rand() * (stepMax - stepMin)) * 0.5;
  while (x < end) {
    spots.push(x);
    x += stepMin + rand() * (stepMax - stepMin);
  }
  return spots;
}

/**
 * Canvas-texture helper that degrades to an untextured THREE.Texture when
 * no DOM exists (node vitest builds the set for the light-budget test).
 */
function makeCanvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d");
  if (!ctx) return new THREE.Texture();
  draw(ctx);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function wallpaperTexture(): THREE.Texture {
  return makeCanvasTexture(256, (ctx) => {
    ctx.fillStyle = BEDROOM.wallpaperBase;
    ctx.fillRect(0, 0, 256, 256);
    // Offset polka-dot grid — classic nursery wallpaper.
    ctx.fillStyle = BEDROOM.wallpaperDot;
    const step = 64;
    for (let row = 0; row < 256 / step + 1; row += 1) {
      for (let col = 0; col < 256 / step + 1; col += 1) {
        const x = col * step + (row % 2 === 0 ? 0 : step / 2);
        const y = row * step;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Bedroom carpet — the level3d weave, tinted warm cream/dusty-rose. */
function bedroomCarpetTexture(base: string): THREE.Texture {
  const tex = makeCanvasTexture(128, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    const rand = makeRand(7);
    for (let i = 0; i < 1400; i += 1) {
      const x = rand() * 128;
      const y = rand() * 128;
      const light = rand() > 0.5;
      // Speckle leans rose/cream rather than the default tan.
      ctx.fillStyle = light ? "rgba(255, 240, 230, 0.10)" : "rgba(120, 72, 62, 0.08)";
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  });
  tex.repeat.set(6, 6);
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
  wall.receiveShadow = false; // huge far plane — never receives (perf §5.6.9c)
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

/** Cool daylight window on the wallpaper. Carries NO light (perf budget). */
function buildWindow(x: number): THREE.Group {
  const group = new THREE.Group();
  const w = 3.1;
  const h = 3.8;
  const cy = 5.6;

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: BEDROOM.shaftCool }),
  );
  glow.position.set(x, cy, WALL_Z + 0.05);
  group.add(glow);

  const frameMat = new THREE.MeshLambertMaterial({ color: 0xf6efe2 });
  const frameThickness = 0.16;
  for (const y of [cy - h / 2, cy, cy + h / 2]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, frameThickness, 0.1), frameMat);
    bar.position.set(x, y, WALL_Z + 0.1);
    group.add(bar);
  }
  for (const dx of [-w / 2, 0, w / 2]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, h + 0.2, 0.1), frameMat);
    bar.position.set(x + dx, cy, WALL_Z + 0.1);
    group.add(bar);
  }

  return group;
}

/** Butter/sage curtain pair leaning beside a window. */
function buildCurtains(x: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const colors = [BEDROOM.butter, BEDROOM.sage];
  [-1, 1].forEach((side, i) => {
    const curtain = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 4.9, 0.28),
      new THREE.MeshLambertMaterial({ color: colors[i]! }),
    );
    curtain.position.set(x + side * 2.15, 5.5, WALL_Z + 0.22);
    curtain.rotation.z = side * (0.02 + rand() * 0.035);
    group.add(curtain);
  });
  return group;
}

/**
 * Slanted light shaft from a window sill toward the floor — cool, additive,
 * fog-exempt, LIGHT-FREE (the glow is painted, not simulated).
 */
function buildLightShaft(x: number, rand: () => number): THREE.Mesh {
  const shaft = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 7.0),
    new THREE.MeshBasicMaterial({
      color: BEDROOM.shaftCool,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    }),
  );
  // Leans from the sill (high, at the wall) down-and-right into the room.
  shaft.position.set(x + 1.1, 2.3, -5.0);
  shaft.rotation.x = -0.52;
  shaft.rotation.z = -0.16 - rand() * 0.05;
  return shaft;
}

function starShape(outer: number, inner: number, points = 5): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return shape;
}

function moonShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 1, 1.22, 5.06, false);
  shape.absarc(0.45, 0, 0.946, -1.687, 1.687, true);
  return shape;
}

/** Cream star/moon cutout decal on the wallpaper — breaks window metronome. */
function buildWallDecal(x: number, rand: () => number): THREE.Mesh {
  const isStar = rand() < 0.55;
  const geo = new THREE.ShapeGeometry(isStar ? starShape(0.8, 0.36) : moonShape());
  const decal = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ color: BEDROOM.wallpaperDot }),
  );
  decal.position.set(x, 4.8 + rand() * 2.4, WALL_Z + 0.06);
  decal.rotation.z = (rand() - 0.5) * 0.5;
  const s = 0.8 + rand() * 0.35;
  decal.scale.set(s, s, 1);
  return decal;
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
  left.position.set(x - w / 2, h / 2, LANDMARK_Z);
  const right = new THREE.Mesh(sideGeo, frameMat);
  right.position.set(x + w / 2, h / 2, LANDMARK_Z);
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.12),
    new THREE.MeshLambertMaterial({ color: 0xa06f3e }),
  );
  back.position.set(x, h / 2, LANDMARK_Z - d / 2);
  back.castShadow = true; // big silhouette — allowed to cast
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.22, d), frameMat);
  top.position.set(x, h, LANDMARK_Z);
  group.add(left, right, back, top);

  for (const sy of [1.5, 3.1, 4.7]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), shelfMat);
    board.position.set(x, sy, LANDMARK_Z);
    group.add(board);

    // A row of books: thin tilted boxes in palette colors (no shadows — tiny).
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
      book.position.set(bx + bw / 2, sy + 0.08 + bh / 2, LANDMARK_Z);
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
  stack.position.set(x + w / 2 + 0.8, 0.25, LANDMARK_Z + 0.4);
  stack.rotation.y = 0.3;
  group.add(stack);

  return group;
}

/**
 * White/cream crib with vertical bars + a 2-arm hanging mobile. The mobile
 * pivot is returned so the set's update hook can rotate it (deterministic,
 * elapsed-driven). NO lights.
 */
function buildCrib(x: number, rand: () => number): { group: THREE.Group; mobile: THREE.Group } {
  const group = new THREE.Group();
  const w = 3.8;
  const h = 2.7;
  const d = 1.5;
  const mat = new THREE.MeshLambertMaterial({ color: BEDROOM.cribWhite });

  // End panels — the big silhouettes; these may cast.
  for (const dx of [-w / 2, w / 2]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, d), mat);
    panel.position.set(x + dx, h / 2, LANDMARK_Z);
    panel.castShadow = true;
    group.add(panel);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, h + 0.5, 10), mat);
    post.position.set(x + dx, (h + 0.5) / 2, LANDMARK_Z + d / 2);
    group.add(post);
  }

  // Front rails + vertical bars (tiny — no shadows).
  for (const ry of [0.55, h - 0.15]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.14, 0.14), mat);
    rail.position.set(x, ry, LANDMARK_Z + d / 2);
    group.add(rail);
  }
  const bars = 7;
  for (let i = 1; i <= bars; i += 1) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h - 0.85, 8), mat);
    bar.position.set(x - w / 2 + (i * w) / (bars + 1), (0.55 + h - 0.15) / 2, LANDMARK_Z + d / 2);
    group.add(bar);
  }

  // Mattress hint peeking over the rail.
  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.4, 0.5, d - 0.2),
    new THREE.MeshLambertMaterial({ color: BEDROOM.cream }),
  );
  mattress.position.set(x, 0.75, LANDMARK_Z);
  mattress.castShadow = true;
  group.add(mattress);

  // Mobile: curved support arm up from one corner, then a slow-spinning
  // 2-arm pivot with hanging star + moon charms.
  const armMat = new THREE.MeshLambertMaterial({ color: BEDROOM.woodMid });
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), armMat);
  riser.position.set(x - w / 2, h + 0.75, LANDMARK_Z);
  group.add(riser);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.3, 8), armMat);
  boom.rotation.z = Math.PI / 2 - 0.35;
  boom.position.set(x - w / 2 + 0.6, h + 1.45, LANDMARK_Z);
  group.add(boom);

  const mobile = new THREE.Group();
  mobile.position.set(x - w / 2 + 1.2, h + 1.55, LANDMARK_Z);
  const charmColors = [BEDROOM.butter, BEDROOM.rose];
  [0, Math.PI / 2].forEach((angle, i) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.05), armMat);
    arm.rotation.y = angle;
    mobile.add(arm);
    for (const end of [-0.7, 0.7]) {
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), armMat);
      string.position.set(Math.cos(angle) * end, -0.2, -Math.sin(angle) * end);
      mobile.add(string);
      const charm = new THREE.Mesh(
        new THREE.ShapeGeometry(i === 0 ? starShape(0.16, 0.075) : moonShape()),
        new THREE.MeshLambertMaterial({ color: charmColors[i]!, side: THREE.DoubleSide }),
      );
      if (i === 1) charm.scale.set(0.16, 0.16, 1);
      charm.position.set(Math.cos(angle) * end, -0.5 + rand() * 0.08, -Math.sin(angle) * end);
      mobile.add(charm);
    }
  });
  group.add(mobile);

  return { group, mobile };
}

/** Warm-wood toy chest with a slightly open lid and a sage accent band. */
function buildToyChest(x: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const w = 2.9;
  const h = 1.6;
  const d = 1.5;
  const woodMat = new THREE.MeshLambertMaterial({ color: BEDROOM.woodMid });

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
  body.position.set(x, h / 2, LANDMARK_Z);
  body.castShadow = true;
  group.add(body);

  // Sage accent band across the front.
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.04, 0.28, 0.05),
    new THREE.MeshLambertMaterial({ color: BEDROOM.sage }),
  );
  band.position.set(x, h * 0.55, LANDMARK_Z + d / 2 + 0.02);
  group.add(band);

  // Lid, hinged at the back, propped slightly open.
  const lid = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.18, d + 0.1), woodMat);
  lid.geometry.translate(0, 0.09, (d + 0.1) / 2); // pivot at the back edge
  lid.position.set(x, h, LANDMARK_Z - d / 2);
  lid.rotation.x = -0.38 - rand() * 0.1;
  lid.castShadow = true;
  group.add(lid);

  return group;
}

/** A lovable dusty-brown teddy silhouette — spheres only, storybook soft. */
function buildTeddy(x: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const brown = new THREE.MeshLambertMaterial({ color: BEDROOM.teddyBrown });
  const lean = (rand() - 0.5) * 0.25;

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 16), brown);
  body.position.set(x, 0.9, LANDMARK_Z);
  body.scale.set(1, 1.05, 0.9);
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), brown);
  head.position.set(x + lean * 0.4, 2.05, LANDMARK_Z);
  head.rotation.z = lean;
  group.add(head);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), brown);
    ear.position.set(x + side * 0.48 + lean * 0.4, 2.55, LANDMARK_Z);
    group.add(ear);
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), brown);
    arm.scale.set(1.25, 0.8, 0.8);
    arm.position.set(x + side * 0.95, 1.0, LANDMARK_Z + 0.15);
    group.add(arm);
  }

  const muzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 12, 10),
    new THREE.MeshLambertMaterial({ color: BEDROOM.teddyMuzzle }),
  );
  muzzle.scale.set(1, 0.75, 0.7);
  muzzle.position.set(x + lean * 0.4, 1.92, LANDMARK_Z + 0.52);
  group.add(muzzle);

  return group;
}

/** Alphabet block: soft-colored cube with a cream face inset. NO shadow. */
function buildBlock(x: number, size: number, color: number, rotY: number, z = TOY_Z): THREE.Group {
  const group = new THREE.Group();
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshLambertMaterial({ color }),
  );
  cube.position.set(x, size / 2, z);
  cube.rotation.y = rotY;
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
  const colors = [BEDROOM.rose, BEDROOM.teal, BEDROOM.butter];
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(r, 20, 14),
    new THREE.MeshLambertMaterial({ color: colors[Math.floor(rand() * colors.length)]! }),
  );
  ball.position.set(x, r, TOY_Z + 0.5);
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

/** A loose cluster of glassy little marbles. */
function buildMarbles(x: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const colors = [BEDROOM.teal, BEDROOM.rose, BEDROOM.sage];
  const n = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i += 1) {
    const r = 0.09 + rand() * 0.05;
    const marble = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 8),
      new THREE.MeshLambertMaterial({ color: colors[i % colors.length]! }),
    );
    marble.position.set(x + (rand() - 0.5) * 0.8, r, FOREGROUND_Z + (rand() - 0.5) * 0.4);
    group.add(marble);
  }
  return group;
}

/** Three crossed jack rods. */
function buildJacks(x: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xb9bec6 });
  const rots: Array<[number, number]> = [
    [0, rand() * Math.PI],
    [Math.PI / 3, rand() * Math.PI],
    [-Math.PI / 3, rand() * Math.PI],
  ];
  for (const [rz, ry] of rots) {
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.055, 0.055), mat);
    rod.rotation.set(0, ry, rz);
    rod.position.set(x, 0.12, FOREGROUND_Z);
    group.add(rod);
  }
  return group;
}

/** A domino run — a few standing, one toppled. */
function buildDominoes(x: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: BEDROOM.cream });
  const n = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i += 1) {
    const domino = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 0.28), mat);
    const fallen = i === n - 1;
    if (fallen) {
      domino.rotation.z = -Math.PI / 2 + 0.06;
      domino.position.set(x + i * 0.34 + 0.2, 0.06, FOREGROUND_Z);
    } else {
      domino.rotation.y = (rand() - 0.5) * 0.3;
      domino.position.set(x + i * 0.34, 0.26, FOREGROUND_Z);
    }
    group.add(domino);
  }
  return group;
}

/**
 * The hero lamp: nightstand + wood lamp + butter cone shade + inner glow
 * disc. Hosts the room's ONE warm point light (repurposed lamp pool), which
 * the update hook breathes ±12%.
 */
function buildNightstandLamp(x: number): { group: THREE.Group; light: THREE.PointLight } {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: BEDROOM.woodDark });

  const stand = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.55, 1.3), woodMat);
  stand.position.set(x, 0.775, TOY_Z);
  stand.castShadow = true;
  group.add(stand);
  const standTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.14, 1.5),
    new THREE.MeshLambertMaterial({ color: BEDROOM.woodMid }),
  );
  standTop.position.set(x, 1.62, TOY_Z);
  group.add(standTop);
  // Drawer face + knob.
  const drawer = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.7),
    new THREE.MeshLambertMaterial({ color: BEDROOM.woodMid }),
  );
  drawer.position.set(x, 0.95, TOY_Z + 0.66);
  group.add(drawer);

  // Lamp: wood cylinder base + stem + butter cone shade.
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.22, 14), woodMat);
  base.position.set(x, 1.8, TOY_Z);
  group.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.85, 10), woodMat);
  stem.position.set(x, 2.3, TOY_Z);
  group.add(stem);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.62, 0.8, 16, 1, true),
    new THREE.MeshLambertMaterial({ color: BEDROOM.butter, side: THREE.DoubleSide }),
  );
  shade.position.set(x, 3.05, TOY_Z);
  group.add(shade);
  // Inner glow disc — painted warmth, offset clear of the shade (gotcha 11).
  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe0a8 }),
  );
  glowDisc.position.set(x, 2.72, TOY_Z + 0.66);
  group.add(glowDisc);

  // THE lamp light — the old off-screen lamp-pool PointLight, moved inside
  // visible geometry. The update hook breathes it.
  const light = new THREE.PointLight(0xffb066, LAMP_INTENSITY, 13, 1.5);
  light.position.set(x, 2.9, TOY_Z + 0.8);
  group.add(light);

  return { group, light };
}

/** Soft oval rag rug under the hero lamp — the one accent that receives shadow. */
function buildRagRug(x: number): THREE.Mesh {
  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 0.05, 24),
    new THREE.MeshLambertMaterial({ color: BEDROOM.rose }),
  );
  rug.scale.set(1, 1, 0.55);
  rug.position.set(x, 0.026, -1.7);
  rug.receiveShadow = true;
  return rug;
}

interface MoteField {
  points: THREE.Points;
  base: Float32Array;
  phase: Float32Array;
  speed: Float32Array;
}

/**
 * Dust motes: ONE THREE.Points, seeded positions loosely clustered in the
 * window/lamp light pools, faint warm-white vertex colors, additive,
 * never shadow-casting. Drift is driven by the update hook.
 */
function buildDustMotes(clusterXs: number[], rand: () => number): MoteField {
  const base = new Float32Array(MOTE_COUNT * 3);
  const colors = new Float32Array(MOTE_COUNT * 3);
  const phase = new Float32Array(MOTE_COUNT);
  const speed = new Float32Array(MOTE_COUNT);

  for (let i = 0; i < MOTE_COUNT; i += 1) {
    const cx = clusterXs[Math.floor(rand() * clusterXs.length)] ?? 0;
    base[i * 3] = cx + (rand() - 0.5) * 7;
    base[i * 3 + 1] = 0.6 + rand() * 6.2;
    base[i * 3 + 2] = -4.5 + rand() * 4.5;
    const b = 0.35 + rand() * 0.5; // faint warm white
    colors[i * 3] = b;
    colors[i * 3 + 1] = b * 0.95;
    colors[i * 3 + 2] = b * 0.82;
    phase[i] = rand() * Math.PI * 2;
    speed[i] = 0.08 + rand() * 0.14;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  points.castShadow = false;

  return { points, base, phase, speed };
}

/** Sinusoidal drift + slow rise with wrap — deterministic in elapsed t. */
function driftMotes(field: MoteField, t: number): void {
  const attr = field.points.geometry.getAttribute("position") as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < MOTE_COUNT; i += 1) {
    const j = i * 3;
    arr[j] = field.base[j]! + Math.sin(t * 0.22 + field.phase[i]!) * 0.7;
    arr[j + 1] = 0.4 + ((field.base[j + 1]! + t * field.speed[i]!) % 6.6);
    arr[j + 2] = field.base[j + 2]! + Math.sin(t * 0.16 + field.phase[i]! * 1.7) * 0.4;
  }
  attr.needsUpdate = true;
}

/** Dress the room across the level's world-space x range. */
export function buildBedroomSet(
  minX: number,
  maxX: number,
  opts: { paintedWall?: boolean; floors?: Array<[number, number]> } = {},
): WorldSet {
  const rand = makeRand(20260609);
  const group = new THREE.Group();
  const width = maxX - minX;

  // Pit-aware dressing (§5.6 #7, relearned in the 2026-07-02 playtest:
  // clutter floated over floor gaps). `floors` = world-unit x-ranges of real
  // floor; items keep `margin` units clear of every edge. No ranges given →
  // everything passes (tests, dev slices).
  const floors = opts.floors ?? null;
  const onFloor = (x: number, margin = 1): boolean =>
    !floors || floors.some(([a, b]) => x >= a + margin && x <= b - margin);

  // Painted-diorama mode (`?look=painted`): the wall layer — wallpaper,
  // windows, curtains, decals, shafts — is replaced by painted backdrop
  // planes (paintedBackdrop.ts). Everything in FRONT of the wall (landmarks,
  // clutter, lamp, motes, lights) stays: 3D depth over painted far plane.
  // The cadence rand() calls still run so mid/clutter placement is identical
  // in both looks (A/B compares the wall treatment, not a reshuffle).
  const paintedWall = opts.paintedWall === true;
  if (!paintedWall) group.add(buildWallpaper(minX, maxX));

  // ── Wall layer: window / decal alternation on a ~28–32 cadence, so a
  // window lands every ~55–65 units without metronoming. ─────────────────
  const windowXs: number[] = [];
  cadenceSpots(minX + 8, maxX - 6, 27, 33, rand).forEach((x, i) => {
    if (i % 2 === 0) {
      windowXs.push(x);
      if (!paintedWall) {
        group.add(buildWindow(x));
        group.add(buildCurtains(x, rand));
        group.add(buildLightShaft(x, rand));
      } else {
        buildCurtains(x, rand); // burn the same rand() draws (determinism)
      }
    } else if (!paintedWall) {
      group.add(buildWallDecal(x, rand));
    } else {
      buildWallDecal(x, rand); // burn rand() draws
    }
  });
  if (windowXs.length === 0) {
    // Degenerate tiny range (tests, dev slices): guarantee one window.
    const x = (minX + maxX) / 2;
    windowXs.push(x);
    if (!paintedWall) {
      group.add(buildWindow(x));
      group.add(buildLightShaft(x, rand));
    }
  }

  // ── Mid-ground landmarks every ~35–45 units, rotating through builders.
  // Painted mode: the backdrop paintings carry the furniture — procedural
  // landmarks in front of painted shelves read as cardboard props, so they
  // sit out (rand draws still burned for placement determinism). ──────────
  const mobiles: THREE.Group[] = [];
  cadenceSpots(minX + 14, maxX - 10, 35, 45, rand)
    .filter((x) => onFloor(x, 2))
    .forEach((x, i) => {
    switch (i % 4) {
      case 0: {
        const shelf = buildBookshelf(x, rand);
        if (!paintedWall) group.add(shelf);
        break;
      }
      case 1: {
        const crib = buildCrib(x, rand);
        if (!paintedWall) {
          mobiles.push(crib.mobile);
          group.add(crib.group);
        }
        break;
      }
      case 2: {
        const chest = buildToyChest(x, rand);
        if (!paintedWall) group.add(chest);
        break;
      }
      default: {
        const teddy = buildTeddy(x, rand);
        if (!paintedWall) group.add(teddy);
      }
    }
  });

  // ── Toy clutter every ~9–14 units — denser, varied, shadow-free. ───────
  // Painted mode trades the muted nursery palette for candy pastels so the
  // 3D floor toys sit in the same color world as the backdrop paintings.
  const blockColors = paintedWall
    ? [0xf7a8c9, 0x9fd0f5, 0xaee8c0, 0xffdf91]
    : [BEDROOM.sage, BEDROOM.butter, BEDROOM.rose, BEDROOM.teal];
  cadenceSpots(minX + 3, maxX - 3, 9, 14, rand)
    .filter((x) => onFloor(x, 1.2))
    .forEach((x, i) => {
    if (rand() < 0.3) {
      group.add(buildBall(x, rand));
      return;
    }
    const size = 0.55 + rand() * 0.35;
    group.add(buildBlock(x, size, blockColors[i % blockColors.length]!, rand() * 1.2));
    if (rand() < 0.4) {
      group.add(buildBlock(x + 0.55, size * 0.7, blockColors[(i + 2) % 4]!, rand() * 1.2));
    }
  });

  // ── Foreground crumbs every ~25–30 units, rotating small items. ────────
  const crayonColors = [BEDROOM.teal, 0xe07a5f, BEDROOM.sage, BEDROOM.butter];
  cadenceSpots(minX + 5, maxX - 4, 25, 30, rand)
    .filter((x) => onFloor(x, 1.2))
    .forEach((x, i) => {
    switch (i % 4) {
      case 0:
        group.add(buildCrayon(x, crayonColors[Math.floor(rand() * crayonColors.length)]!, (rand() - 0.5) * 0.3));
        break;
      case 1:
        group.add(buildMarbles(x, rand));
        break;
      case 2:
        group.add(buildJacks(x, rand));
        break;
      default:
        group.add(buildDominoes(x, rand));
    }
  });

  // ── The hero lamp — once, near the middle of the world, with its rug.
  // Snapped onto a real floor range wide enough for nightstand + rug. ─────
  let lampX = minX + width * 0.5 + (rand() - 0.5) * 6;
  if (floors && floors.length > 0) {
    const pool = floors.filter(([a, b]) => b - a >= 14);
    const candidates = pool.length > 0 ? pool : floors;
    let best = lampX;
    let bestDist = Infinity;
    for (const [a, b] of candidates) {
      const clamped = Math.min(Math.max(lampX, a + 6), b - 3);
      const d = Math.abs(clamped - lampX);
      if (d < bestDist) {
        bestDist = d;
        best = clamped;
      }
    }
    lampX = best;
  }
  const lamp = buildNightstandLamp(lampX);
  group.add(lamp.group);
  group.add(buildRagRug(lampX - 2.6));

  // ── Dust motes: ONE Points field in the window/lamp light pools. ───────
  const motes = buildDustMotes([...windowXs, lampX], rand);
  group.add(motes.points);

  // ── Lighting rig — 5 lights total (budget ≤ 6, playbook §5.6.9a) ───────
  // 1. Warm ambient.
  const ambient = new THREE.AmbientLight(0xfff1e0, 0.55);
  group.add(ambient);

  // 2. Warm key (the "lamp glow from the right") — casts the platform shadows.
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

  // 3. Cool fill from the window side — absorbs the old per-window points
  //    (windows are now light-free; their glow is painted shafts).
  const fill = new THREE.DirectionalLight(0xa9c4dd, 0.38);
  fill.position.set(minX + width * 0.15, 8, 5);
  group.add(fill);

  // 4. The hero-lamp warm point (inside buildNightstandLamp, breathing).
  // 5. One cool point at the most prominent window (the first — spawn-side).
  const windowLight = new THREE.PointLight(0xcfe2f0, 4, 12, 1.4);
  windowLight.position.set(windowXs[0]!, 5.6, WALL_Z + 2.5);
  group.add(windowLight);

  return {
    group,
    sun,
    sunTarget,
    sunOffset: { x: 7, y: 11, z: 8 },
    update: (_dtMs, elapsedMs) => {
      const t = elapsedMs / 1000;
      // Hero lamp breathes — two incommensurate sines, ±12% max, subtle.
      lamp.light.intensity = LAMP_INTENSITY * (1 + 0.07 * Math.sin(t * 0.9) + 0.05 * Math.sin(t * 2.3));
      // Crib mobiles spin slowly — elapsed-driven, deterministic.
      for (const mobile of mobiles) {
        mobile.rotation.y = t * 0.35;
      }
      // Dust motes drift.
      driftMotes(motes, t);
    },
  };
}

/** Bedroom gameplay-surface skin — carpet tinted warm cream/dusty-rose. */
export const bedroomSurfaces: WorldSurfaces = {
  floorBase: "#d8ae96",
  floorTexture: bedroomCarpetTexture,
  platformColor: 0xe8c9a0,
  lipColor: 0xb8804a,
};
