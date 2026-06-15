import * as THREE from "three";

/** A loaded sprite: the GPU texture plus the decoded image (for sizing/feet scan). */
export interface Frame {
  texture: THREE.Texture;
  image: HTMLImageElement;
}

export function loadFrame(url: string): Promise<Frame> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        resolve({ texture, image: texture.image as HTMLImageElement });
      },
      undefined,
      reject,
    );
  });
}

/**
 * Counts fully transparent rows at the bottom of a sprite so a billboard can
 * plant the visible feet on the physics body's bottom. Adapted from
 * measureBottomTransparentRows (src/systems/measureSpriteFeet.ts) for plain
 * images. Returns 0 in a canvas-less (headless test) environment.
 */
export function measureBottomMargin(image: HTMLImageElement, alphaThreshold = 16): number {
  const { width, height } = image;
  if (!width || !height) return 0;
  if (typeof document === "undefined") return 0;
  const cv = document.createElement("canvas");
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(image, 0, 0);
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
