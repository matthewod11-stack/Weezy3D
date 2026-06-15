import Phaser from "phaser";

/**
 * Returns the number of *fully transparent* rows at the bottom of a texture
 * (in unscaled source pixels). Used to push origin-bottom sprites visually
 * down by the empty margin so their feet plant on the physics body bottom.
 *
 * Works on the texture's first frame — for our storybook PNGs each idle pose
 * is a separate texture key, so first-frame is the only frame.
 */
export function measureBottomTransparentRows(
  scene: Phaser.Scene,
  textureKey: string,
  alphaThreshold = 16,
): number {
  if (!scene.textures.exists(textureKey)) {
    return 0;
  }
  const source = scene.textures.get(textureKey).getSourceImage();
  if (!source) {
    return 0;
  }
  const width = (source as HTMLImageElement | HTMLCanvasElement).width;
  const height = (source as HTMLImageElement | HTMLCanvasElement).height;
  if (!width || !height) {
    return 0;
  }

  const cv = document.createElement("canvas");
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return 0;
  }
  ctx.drawImage(source as CanvasImageSource, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;

  for (let y = height - 1; y >= 0; y -= 1) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const alpha = data[rowStart + x * 4 + 3];
      if (alpha !== undefined && alpha > alphaThreshold) {
        return height - 1 - y;
      }
    }
  }
  return 0;
}

/**
 * Computes the Y origin (0..1) that lands a sprite's *visible feet* on its
 * world-space y. For multi-frame characters, pass every texture key — the
 * function picks the origin that prevents the most-trimmed frame from
 * floating. Other frames may press slightly into the floor, which reads
 * far better than floating above it.
 *
 * Math: a frame with transparent margin M and height H has its visible-feet
 * row at y_source = H - M. After origin oy, source y_source is rendered at
 * sprite.y + (H - M - oy * H). For no floating across all frames, pick the
 * smallest (H - M) / H — the most-margin frame — as oy.
 */
export function computeFeetOriginY(
  scene: Phaser.Scene,
  textureKeys: readonly string[],
): number {
  let minRatio = 1;
  for (const key of textureKeys) {
    if (!scene.textures.exists(key)) {
      continue;
    }
    const source = scene.textures.get(key).getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement
      | undefined;
    const height = source?.height ?? 0;
    if (!height) {
      continue;
    }
    const margin = measureBottomTransparentRows(scene, key);
    const ratio = (height - margin) / height;
    if (ratio < minRatio) {
      minRatio = ratio;
    }
  }
  return minRatio;
}
