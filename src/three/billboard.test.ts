import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { makeShadowBlob } from "./billboard";

describe("makeShadowBlob", () => {
  it("builds a flat, translucent ground blob matching the player-shadow recipe", () => {
    const blob = makeShadowBlob(0.32);
    expect(blob.geometry).toBeInstanceOf(THREE.CircleGeometry);
    expect(blob.rotation.x).toBeCloseTo(-Math.PI / 2);
    expect(blob.scale.y).toBeCloseTo(0.78);
    expect(blob.renderOrder).toBe(5);
    const mat = blob.material as THREE.MeshBasicMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeCloseTo(0.32);
    expect(mat.depthWrite).toBe(false);
  });

  it("scales the disc by the requested radius", () => {
    const small = makeShadowBlob(0.1);
    const big = makeShadowBlob(0.5);
    const r = (m: THREE.Mesh) => (m.geometry as THREE.CircleGeometry).parameters.radius;
    expect(r(small)).toBeCloseTo(0.1);
    expect(r(big)).toBeCloseTo(0.5);
  });
});
