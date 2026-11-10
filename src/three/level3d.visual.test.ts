import * as THREE from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { RENDER_SCALE } from "../config/game";
import { LEVEL_CATALOG } from "../levels/levelCatalog";
import { parseLevelData, scaleLevelData } from "../types/level";
import { buildLevel, DEFAULT_SURFACES } from "./level3d";

beforeAll(() => {
  const gradient = { addColorStop: () => undefined };
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: () => undefined,
    beginPath: () => undefined,
    ellipse: () => undefined,
    fill: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    arc: () => undefined,
    save: () => undefined,
    translate: () => undefined,
    closePath: () => undefined,
    restore: () => undefined,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => context,
      }),
    },
  });
});

const bedroom = scaleLevelData(parseLevelData(LEVEL_CATALOG[0]!.raw), RENDER_SCALE);
const paintedSurfaces = { ...DEFAULT_SURFACES, plush: true };

describe("painted plush terrain", () => {
  it("does not add a decorative rolling ridge above the walkable floor", () => {
    const build = buildLevel(bedroom, paintedSurfaces);
    const decorativeExtrusions: THREE.Mesh[] = [];
    const worldPosition = new THREE.Vector3();
    build.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.getWorldPosition(worldPosition);
      if (
        mesh.isMesh &&
        mesh.geometry.type === "ExtrudeGeometry" &&
        Math.abs(worldPosition.z + 1.6) < 0.001
      ) {
        decorativeExtrusions.push(mesh);
      }
    });

    expect(decorativeExtrusions).toHaveLength(0);
  });

  it("leaves floor gaps open so the painted backdrop carpet remains visible", () => {
    const build = buildLevel(bedroom, paintedSurfaces);
    const underFloorPlanes: THREE.Mesh[] = [];
    build.group.traverse((object) => {
      const mesh = object as THREE.Mesh<THREE.PlaneGeometry>;
      if (
        mesh.isMesh &&
        mesh.geometry.type === "PlaneGeometry" &&
        mesh.geometry.parameters.height === 12
      ) {
        underFloorPlanes.push(mesh);
      }
    });

    expect(underFloorPlanes).toHaveLength(0);
  });

  it("uses wood on the ground and configured plush color on elevated platforms", () => {
    const build = buildLevel(bedroom, {
      ...paintedSurfaces,
      floorBase: "#d2aa76",
      floorTopStyle: "wood",
      platformTopBase: "#7fb8d4",
    });
    const textureNames: string[] = [];
    build.group.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (!material || Array.isArray(material)) return;
      const map = (material as THREE.MeshLambertMaterial).map;
      if (map) textureNames.push(map.name);
    });

    expect(textureNames).toContain("wood-floor:#d2aa76");
    expect(textureNames).toContain("plush:#7fb8d4");
    expect(textureNames).not.toContain("plush:#fbe0eb");
  });
});
