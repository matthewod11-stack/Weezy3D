import * as THREE from "three";
import { toWorldX } from "./coords";
import type { WorldSegment } from "./worldStitch";

import seg1 from "../../assets/backdrops3d/bedroom/seg1_bookshelf.jpg?url";
import seg2 from "../../assets/backdrops3d/bedroom/seg2_climb.jpg?url";
import seg3 from "../../assets/backdrops3d/bedroom/seg3_crib.jpg?url";
import seg4 from "../../assets/backdrops3d/bedroom/seg4_artcorner.jpg?url";
import seg5 from "../../assets/backdrops3d/bedroom/seg5_bed.jpg?url";
import wallpaperTile from "../../assets/backdrops3d/bedroom/wallpaper_tile.jpg?url";

/**
 * Painted-diorama backdrop (`?look=painted`), two layers:
 *
 *  1. A CONTINUOUS wallpaper plane across the whole world — the tileable
 *     butterfly swatch, mirror-repeated (fine for a non-directional pattern;
 *     playtest verdict: mirroring furniture compositions clones the bed).
 *  2. One VIGNETTE plane per segment — the segment's painting shown exactly
 *     ONCE at natural size, alpha-fading into the wallpaper at its left and
 *     right edges so there are no hard seams anywhere.
 *
 * Perf shape: 6 planes, 6 decode-once JPEGs, zero lights, all unlit.
 */

const BACKDROP_URLS: Record<string, string[]> = {
  bedroom: [seg1, seg2, seg3, seg4, seg5],
};
const WALLPAPER_URLS: Record<string, string> = {
  bedroom: wallpaperTile,
};

export function hasPaintedBackdrop(areaId: string): boolean {
  return areaId in BACKDROP_URLS;
}

/** Wallpaper sits deepest; vignettes float just in front of it. */
const WALLPAPER_Z = -8.2;
const VIGNETTE_Z = -7.8;
/** Painting height in world units; width follows the 1376x768 aspect. */
const TILE_H = 16;
const TILE_W = TILE_H * (1376 / 768);
/** Fraction of the painting below the room's floor line (art brief: 15%). */
const ART_FLOOR = 0.15;
/** Wallpaper pattern tile size in world units. */
const WALLPAPER_TILE = 9;
/** Horizontal fraction of each vignette that fades out per side. */
const EDGE_FADE = 0.18;

/** Horizontal 1→0 edge-fade alpha map, shared by every vignette. */
let fadeAlphaMap: THREE.CanvasTexture | null = null;
function getFadeAlphaMap(): THREE.CanvasTexture {
  if (fadeAlphaMap) return fadeAlphaMap;
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 2;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, "black");
  g.addColorStop(EDGE_FADE, "white");
  g.addColorStop(1 - EDGE_FADE, "white");
  g.addColorStop(1, "black");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 2);
  fadeAlphaMap = new THREE.CanvasTexture(cv);
  return fadeAlphaMap;
}

export function buildPaintedBackdrop(areaId: string, segments: WorldSegment[]): THREE.Group {
  const group = new THREE.Group();
  const urls = BACKDROP_URLS[areaId];
  if (!urls || segments.length === 0) return group;
  const loader = new THREE.TextureLoader();

  // ── Layer 1: continuous wallpaper across the world ─────────────────────
  const minX = toWorldX(segments[0]!.startX);
  const maxX = toWorldX(segments[segments.length - 1]!.endX);
  const worldW = maxX - minX;
  const wp = loader.load(WALLPAPER_URLS[areaId]!);
  wp.colorSpace = THREE.SRGBColorSpace;
  wp.wrapS = THREE.MirroredRepeatWrapping;
  wp.wrapT = THREE.MirroredRepeatWrapping;
  wp.repeat.set(worldW / WALLPAPER_TILE, TILE_H / WALLPAPER_TILE);
  const wallpaper = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, TILE_H),
    // Tint multiply: the raw swatch's white butterflies read washed-out next
    // to the vignettes AND catch the bloom threshold as kaleidoscope blotches.
    new THREE.MeshBasicMaterial({ map: wp, color: 0xf0cfda, fog: false }),
  );
  wallpaper.position.set(minX + worldW / 2, TILE_H / 2 - TILE_H * ART_FLOOR, WALLPAPER_Z);
  group.add(wallpaper);

  // ── Layer 2: vignette "stations" on a ~34-unit cadence, cycling through
  // the paintings in order (no two identical neighbors — the playtest's
  // "double bed in a row" came from mirror-tiling one composition). Each
  // fades into the wallpaper at its edges, so there are no seams either. ──
  const textures = urls.map((u) => {
    const tex = loader.load(u);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });
  const STEP = 34;
  let index = 0;
  for (let x = minX + TILE_W / 2 + 2; x <= maxX - TILE_W / 2 - 2; x += STEP) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_W, TILE_H),
      new THREE.MeshBasicMaterial({
        map: textures[index % textures.length]!,
        alphaMap: getFadeAlphaMap(),
        transparent: true,
        depthWrite: false, // blends over the wallpaper, no depth artifacts
        fog: false,
      }),
    );
    mesh.position.set(x, TILE_H / 2 - TILE_H * ART_FLOOR, VIGNETTE_Z);
    group.add(mesh);
    index += 1;
  }
  return group;
}
