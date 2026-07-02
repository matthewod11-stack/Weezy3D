import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { RENDER_SCALE } from "../config/game";
import { LEVEL_CATALOG } from "../levels/levelCatalog";
import { parseLevelData, scaleLevelData } from "../types/level";
import { themeForArea, WORLD_THEMES } from "./worldThemes";

describe("world themes", () => {
  it("registers the bedroom theme with the shipped fog values", () => {
    const theme = WORLD_THEMES.bedroom;
    expect(theme).toBeDefined();
    expect(theme!.fogNear).toBe(14);
    expect(theme!.fogFar).toBe(36);
  });

  it("registers the hallway theme", () => {
    const theme = WORLD_THEMES.hallway;
    expect(theme).toBeDefined();
    expect(theme!.fogColor).toBe(0xc5cfd8);
  });

  it("registers the kitchen theme", () => {
    const theme = WORLD_THEMES.kitchen;
    expect(theme).toBeDefined();
    expect(theme!.fogColor).toBe(0xfff8f0);
  });

  it("registers the familyRoom theme (camelCase areaId)", () => {
    const theme = WORLD_THEMES.familyRoom;
    expect(theme).toBeDefined();
    expect(theme!.fogColor).toBe(0xf0d8b0);
  });

  it("registers the backyard theme with a sky background override", () => {
    const theme = WORLD_THEMES.backyard;
    expect(theme).toBeDefined();
    expect(theme!.background).toBe(0xa8d8f0);
  });

  it("every catalog area has its own theme — no fallback in shipping worlds", () => {
    for (const area of new Set(LEVEL_CATALOG.map((e) => e.areaId))) {
      expect(WORLD_THEMES[area], `missing theme for ${area}`).toBeDefined();
    }
  });

  it("falls back to bedroom for unknown areas", () => {
    expect(themeForArea("not-a-world")).toBe(WORLD_THEMES.bedroom);
  });

  // The camera sits ~10.5 units off the gameplay plane; fog must start
  // behind it or the play layer itself fogs out (why Bedroom shipped 14/36,
  // not the scenery library's 8/30). Every registered theme obeys this.
  it("every registered theme keeps fogNear behind the gameplay plane", () => {
    for (const [area, theme] of Object.entries(WORLD_THEMES)) {
      expect(theme.fogNear, `${area} fogNear`).toBeGreaterThanOrEqual(12);
    }
  });

  it("bedroom has its own gameplay surfaces (warm cream/dusty-rose carpet)", () => {
    expect(WORLD_THEMES.bedroom!.surfaces.floorBase).toBe("#d8ae96");
  });

  // ── Bedroom set perf-budget locks (playbook §5.6.9 — law) ──────────────
  // Built at stitched-world scale (~450 units) so cadence dressing is fully
  // exercised. Set builders are node-safe (canvas textures degrade).

  const bedroomSet = WORLD_THEMES.bedroom!.buildSet(0, 450);

  it("bedroom set stays within the ≤6 light budget", () => {
    const lights: THREE.Light[] = [];
    bedroomSet.group.traverse((o) => {
      if ((o as THREE.Light).isLight) lights.push(o as THREE.Light);
    });
    expect(lights.length).toBeLessThanOrEqual(6);
    // Exactly one shadow-casting key light.
    expect(lights.filter((l) => l.castShadow).length).toBe(1);
  });

  it("bedroom set has exactly ONE Points field for dust motes (≤200 verts)", () => {
    const fields: THREE.Points[] = [];
    bedroomSet.group.traverse((o) => {
      if ((o as THREE.Points).isPoints) fields.push(o as THREE.Points);
    });
    expect(fields.length).toBe(1);
    const count = fields[0]!.geometry.getAttribute("position").count;
    expect(count).toBeLessThanOrEqual(200);
    expect(fields[0]!.castShadow).toBe(false);
  });

  it("bedroom set: no tiny clutter casts shadows; the wallpaper receives none", () => {
    const size = new THREE.Vector3();
    bedroomSet.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.castShadow) {
        // Every caster must be a big silhouette: ≥1.5 units in some dimension.
        mesh.geometry.computeBoundingBox();
        mesh.geometry.boundingBox!.getSize(size).multiply(mesh.scale);
        expect(
          Math.max(size.x, size.y, size.z),
          `caster ${mesh.geometry.type} is tiny clutter`,
        ).toBeGreaterThanOrEqual(1.5);
      }
      // The far wallpaper plane never receives shadows.
      if (mesh.geometry.type === "PlaneGeometry" && mesh.position.z <= -7.9) {
        const width = new THREE.Vector3();
        mesh.geometry.computeBoundingBox();
        mesh.geometry.boundingBox!.getSize(width);
        if (width.x > 100) expect(mesh.receiveShadow).toBe(false);
      }
    });
  });

  it("bedroom set's update hook animates the lamp deterministically", () => {
    expect(bedroomSet.update).toBeDefined();
    const lamps: THREE.PointLight[] = [];
    bedroomSet.group.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight) lamps.push(o as THREE.PointLight);
    });
    const warmLamp = lamps.find((l) => l.color.getHex() === 0xffb066)!;
    expect(warmLamp).toBeDefined();
    bedroomSet.update!(16, 400);
    const a = warmLamp.intensity;
    bedroomSet.update!(16, 1300);
    const b = warmLamp.intensity;
    expect(a).not.toBe(b);
    // Breathing stays within ±12% of base.
    for (const t of [0, 250, 700, 1900, 4300, 9100]) {
      bedroomSet.update!(16, t);
      expect(Math.abs(warmLamp.intensity - 5) / 5).toBeLessThanOrEqual(0.12);
    }
    // Same elapsed → same state (deterministic, no Date.now/random).
    bedroomSet.update!(16, 400);
    expect(warmLamp.intensity).toBe(a);
  });

  it("all 25 catalog levels parse and scale for the 3D loader", () => {
    expect(LEVEL_CATALOG.length).toBe(25);
    for (const entry of LEVEL_CATALOG) {
      const scaled = scaleLevelData(parseLevelData(entry.raw), RENDER_SCALE);
      expect(scaled.platforms.length, entry.backgroundKey).toBeGreaterThan(0);
      expect(scaled.bounds.maxX).toBeGreaterThan(scaled.bounds.minX);
    }
  });
});
