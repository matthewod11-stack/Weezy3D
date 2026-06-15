import Phaser from "phaser";
import {
  BLUEPRINT_DEPTH_FILL,
  BLUEPRINT_DEPTH_FLOOR,
  BLUEPRINT_DEPTH_GRID,
  BLUEPRINT_FILL,
  FLOOR_LINE_ALPHA,
  FLOOR_LINE_COLOR,
  FLOOR_LINE_WIDTH,
  FLOOR_LINE_Y_RENDER,
  GRID_MAJOR_ALPHA,
  GRID_MAJOR_COLOR,
  GRID_MAJOR_STEP,
  GRID_MAJOR_WIDTH,
  GRID_MINOR_ALPHA,
  GRID_MINOR_COLOR,
  GRID_MINOR_STEP,
  GRID_MINOR_WIDTH,
} from "../config/blueprint";
import { RENDER_SCALE } from "../config/game";

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * World-space blueprint grid. Lines tile to design-px steps so platforms
 * always align to gridlines — built for level-design iteration, not polish.
 * Returns the objects so the caller can manage their lifecycle.
 */
export function buildBlueprintGrid(
  scene: Phaser.Scene,
  bounds: Bounds,
): Phaser.GameObjects.GameObject[] {
  const minorStep = GRID_MINOR_STEP * RENDER_SCALE;
  const majorStep = GRID_MAJOR_STEP * RENDER_SCALE;

  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;

  const fill = scene.add.rectangle(
    bounds.minX + bw / 2,
    bounds.minY + bh / 2,
    bw,
    bh,
    BLUEPRINT_FILL,
  );
  fill.setDepth(BLUEPRINT_DEPTH_FILL);

  const grid = scene.add.graphics();
  grid.setDepth(BLUEPRINT_DEPTH_GRID);

  const firstMinorX = Math.ceil(bounds.minX / minorStep) * minorStep;
  const firstMinorY = Math.ceil(bounds.minY / minorStep) * minorStep;

  grid.lineStyle(GRID_MINOR_WIDTH, GRID_MINOR_COLOR, GRID_MINOR_ALPHA);
  for (let x = firstMinorX; x <= bounds.maxX; x += minorStep) {
    grid.beginPath();
    grid.moveTo(x, bounds.minY);
    grid.lineTo(x, bounds.maxY);
    grid.strokePath();
  }
  for (let y = firstMinorY; y <= bounds.maxY; y += minorStep) {
    grid.beginPath();
    grid.moveTo(bounds.minX, y);
    grid.lineTo(bounds.maxX, y);
    grid.strokePath();
  }

  grid.lineStyle(GRID_MAJOR_WIDTH, GRID_MAJOR_COLOR, GRID_MAJOR_ALPHA);
  const firstMajorX = Math.ceil(bounds.minX / majorStep) * majorStep;
  const firstMajorY = Math.ceil(bounds.minY / majorStep) * majorStep;
  for (let x = firstMajorX; x <= bounds.maxX; x += majorStep) {
    grid.beginPath();
    grid.moveTo(x, bounds.minY);
    grid.lineTo(x, bounds.maxY);
    grid.strokePath();
  }
  for (let y = firstMajorY; y <= bounds.maxY; y += majorStep) {
    grid.beginPath();
    grid.moveTo(bounds.minX, y);
    grid.lineTo(bounds.maxX, y);
    grid.strokePath();
  }

  const floor = scene.add.graphics();
  floor.setDepth(BLUEPRINT_DEPTH_FLOOR);
  floor.lineStyle(FLOOR_LINE_WIDTH, FLOOR_LINE_COLOR, FLOOR_LINE_ALPHA);
  floor.beginPath();
  floor.moveTo(bounds.minX, FLOOR_LINE_Y_RENDER);
  floor.lineTo(bounds.maxX, FLOOR_LINE_Y_RENDER);
  floor.strokePath();

  return [fill, grid, floor];
}
