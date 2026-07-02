import * as THREE from "three";
import { toWorldLen, toWorldX } from "./coords";
import type { WorldSegment } from "./worldStitch";

import seg1 from "../../assets/backdrops3d/bedroom/seg1_bookshelf.jpg?url";
import seg2 from "../../assets/backdrops3d/bedroom/seg2_climb.jpg?url";
import seg3 from "../../assets/backdrops3d/bedroom/seg3_crib.jpg?url";
import seg4 from "../../assets/backdrops3d/bedroom/seg4_artcorner.jpg?url";
import seg5 from "../../assets/backdrops3d/bedroom/seg5_bed.jpg?url";

/**
 * Painted-diorama backdrop (the `?look=painted` experiment): one big painted
 * plane per stitched segment, hung at the wallpaper depth. The paintings are
 * NanoBanana generations style-locked to docs/reference-art/Bedroom.jpg —
 * the "Eloise recipe" (painted art in 3D space) applied to the room itself.
 *
 * Perf shape: 5 planes, 5 JPEG textures (~180KB each, decoded once), zero
 * lights, MeshBasicMaterial (unlit — the paintings carry their own light).
 * MirroredRepeatWrapping tiles each painting ~3-4x across its segment
 * (§5.6 #3: kaleidoscope mirroring reads as intentional).
 */

const BACKDROP_URLS: Record<string, string[]> = {
  bedroom: [seg1, seg2, seg3, seg4, seg5],
};

export function hasPaintedBackdrop(areaId: string): boolean {
  return areaId in BACKDROP_URLS;
}

/** Backdrop plane sits just in front of the (hidden) wallpaper depth. */
const BACKDROP_Z = -7.9;
/** Painting height in world units; width follows the 1376x768 aspect. */
const TILE_H = 16;
const TILE_W = TILE_H * (1376 / 768);
/** Fraction of the painting below the room's floor line (art brief: 15%). */
const ART_FLOOR = 0.15;

export function buildPaintedBackdrop(areaId: string, segments: WorldSegment[]): THREE.Group {
  const group = new THREE.Group();
  const urls = BACKDROP_URLS[areaId];
  if (!urls) return group;

  const loader = new THREE.TextureLoader();
  segments.forEach((seg, i) => {
    const url = urls[i % urls.length]!;
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.MirroredRepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;

    const x0 = toWorldX(seg.startX);
    const w = toWorldLen(seg.endX - seg.startX);
    tex.repeat.set(w / TILE_W, 1);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, TILE_H),
      // Unlit + fog-free: the paintings are pre-lit and pre-hazed; scene fog
      // at this depth would wash them back to beige.
      new THREE.MeshBasicMaterial({ map: tex, fog: false }),
    );
    // Anchor the painting's floor line (ART_FLOOR up from its bottom) at y=0.
    mesh.position.set(x0 + w / 2, TILE_H / 2 - TILE_H * ART_FLOOR, BACKDROP_Z);
    group.add(mesh);
  });
  return group;
}
