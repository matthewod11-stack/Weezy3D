import type { CombinedLevel } from "./combineSlot";
import type { LevelOption } from "./levelSketches";

/** Escape special chars before embedding author-edited strings into SVG/HTML. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const GRID_PX = 24;
const COMBINED_GRID_PX = 16;
const PADDING = 16;
const FLOOR_BAND_PX = 8;
const PLATFORM_THICKNESS_PX = 10;

const COLORS = {
  bg: "#4a5560",
  minorLine: "#6c7a85",
  majorLine: "#9ab0c0",
  floor: "#ffc966",
  platform: "#7ec0e8",
  platformStroke: "#5fa4d0",
  token: "#ffcc33",
  tokenStroke: "#ff9933",
  enemy: "#ff6b6b",
  companion: "#ff8fa3",
  spawn: "#4ade80",
  exit: "#ff9933",
  label: "#d8dde2",
} as const;

/**
 * Renders a level sketch as a self-contained SVG string. Y axis is inverted
 * from the game (sketch.y positive = upward in the level), which the renderer
 * handles by flipping at draw time.
 */
export function renderSketchSvg(sketch: LevelOption): string {
  const widthPx = sketch.widthGrids * GRID_PX + PADDING * 2;
  const heightPx = (sketch.heightGrids + 2) * GRID_PX + PADDING * 2;
  const floorY = heightPx - PADDING - GRID_PX;

  const els: string[] = [];

  // --- Background fill ---
  els.push(`<rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="${COLORS.bg}" rx="8" />`);

  // --- Grid lines ---
  for (let gx = 0; gx <= sketch.widthGrids; gx += 1) {
    const x = PADDING + gx * GRID_PX;
    const isMajor = gx % 4 === 0;
    els.push(
      `<line x1="${x}" y1="${PADDING}" x2="${x}" y2="${floorY + FLOOR_BAND_PX}" stroke="${isMajor ? COLORS.majorLine : COLORS.minorLine}" stroke-width="1" opacity="${isMajor ? 0.55 : 0.3}" />`,
    );
  }
  for (let gy = 0; gy <= sketch.heightGrids + 1; gy += 1) {
    const y = floorY - gy * GRID_PX;
    if (y < PADDING) break;
    const isMajor = gy % 4 === 0;
    els.push(
      `<line x1="${PADDING}" y1="${y}" x2="${widthPx - PADDING}" y2="${y}" stroke="${isMajor ? COLORS.majorLine : COLORS.minorLine}" stroke-width="1" opacity="${isMajor ? 0.55 : 0.3}" />`,
    );
  }

  // --- Floor band (broken into segments where pits exist) ---
  const pits = sketch.pits ?? [];
  const sortedPits = pits.slice().sort((a, b) => a.x - b.x);
  let cursor = 0;
  const segments: { x: number; w: number }[] = [];
  for (const p of sortedPits) {
    if (p.x > cursor) segments.push({ x: cursor, w: p.x - cursor });
    cursor = p.x + p.w;
  }
  if (cursor < sketch.widthGrids) {
    segments.push({ x: cursor, w: sketch.widthGrids - cursor });
  }
  for (const seg of segments) {
    const segX = PADDING + seg.x * GRID_PX;
    const segW = seg.w * GRID_PX;
    els.push(
      `<rect x="${segX}" y="${floorY}" width="${segW}" height="${FLOOR_BAND_PX}" fill="${COLORS.floor}" opacity="0.85" />`,
    );
  }
  // Pit shading — darker rectangle below the floor line so the gap reads as a fall.
  for (const p of sortedPits) {
    const pitX = PADDING + p.x * GRID_PX;
    const pitW = p.w * GRID_PX;
    els.push(
      `<rect x="${pitX}" y="${floorY}" width="${pitW}" height="${FLOOR_BAND_PX + GRID_PX / 2}" fill="#1a2026" opacity="0.65" />`,
    );
    // Hashed pattern to make it unmistakable
    for (let dx = 4; dx < pitW; dx += 8) {
      els.push(
        `<line x1="${pitX + dx}" y1="${floorY + 2}" x2="${pitX + dx - 4}" y2="${floorY + FLOOR_BAND_PX + GRID_PX / 2 - 2}" stroke="#3a4550" stroke-width="1" opacity="0.6" />`,
      );
    }
  }

  // --- Platforms ---
  for (const p of sketch.platforms) {
    const px = PADDING + p.x * GRID_PX;
    const py = floorY - p.y * GRID_PX - PLATFORM_THICKNESS_PX;
    const pw = p.w * GRID_PX;
    els.push(
      `<rect x="${px}" y="${py}" width="${pw}" height="${PLATFORM_THICKNESS_PX}" fill="${COLORS.platform}" stroke="${COLORS.platformStroke}" stroke-width="1" rx="2" />`,
    );
  }

  // --- Zones (tokens, enemies, companion) ---
  for (const z of sketch.zones) {
    const cx = PADDING + z.x * GRID_PX + GRID_PX / 2;
    const cy = floorY - z.y * GRID_PX - GRID_PX / 2;
    if (z.kind === "token") {
      els.push(
        `<circle cx="${cx}" cy="${cy}" r="5" fill="${COLORS.token}" stroke="${COLORS.tokenStroke}" stroke-width="1.5" />`,
      );
    } else if (z.kind === "enemy") {
      els.push(
        `<polygon points="${cx - 7},${cy + 6} ${cx + 7},${cy + 6} ${cx},${cy - 8}" fill="${COLORS.enemy}" stroke="#aa3030" stroke-width="1" />`,
      );
      if (z.label) {
        els.push(
          `<text x="${cx}" y="${cy + 20}" font-size="9" fill="${COLORS.label}" text-anchor="middle" font-family="ui-monospace, monospace">${escapeXml(z.label)}</text>`,
        );
      }
    } else if (z.kind === "companion") {
      els.push(
        `<circle cx="${cx}" cy="${cy}" r="8" fill="${COLORS.companion}" stroke="#ffffff" stroke-width="1.5" />`,
      );
      els.push(
        `<text x="${cx}" y="${cy + 22}" font-size="10" fill="${COLORS.label}" text-anchor="middle" font-weight="600" font-family="ui-monospace, monospace">${escapeXml(z.label ?? "companion")}</text>`,
      );
    }
  }

  // --- Spawn marker (green flag) ---
  {
    const sx = PADDING + sketch.spawn.x * GRID_PX + GRID_PX / 2;
    const sy = floorY - sketch.spawn.y * GRID_PX;
    els.push(`<line x1="${sx}" y1="${sy}" x2="${sx}" y2="${sy - 22}" stroke="${COLORS.spawn}" stroke-width="2" />`);
    els.push(
      `<polygon points="${sx},${sy - 22} ${sx},${sy - 10} ${sx + 14},${sy - 16}" fill="${COLORS.spawn}" />`,
    );
    els.push(
      `<text x="${sx}" y="${sy + 14}" font-size="9" fill="${COLORS.spawn}" text-anchor="middle" font-family="ui-monospace, monospace">start</text>`,
    );
  }

  // --- Exit marker (orange flag) ---
  {
    const ex = PADDING + sketch.exit.x * GRID_PX + GRID_PX / 2;
    const ey = floorY - sketch.exit.y * GRID_PX;
    els.push(`<line x1="${ex}" y1="${ey}" x2="${ex}" y2="${ey - 22}" stroke="${COLORS.exit}" stroke-width="2" />`);
    els.push(
      `<polygon points="${ex},${ey - 22} ${ex},${ey - 10} ${ex - 14},${ey - 16}" fill="${COLORS.exit}" />`,
    );
    els.push(
      `<text x="${ex}" y="${ey + 14}" font-size="9" fill="${COLORS.exit}" text-anchor="middle" font-family="ui-monospace, monospace">exit</text>`,
    );
  }

  return `<svg viewBox="0 0 ${widthPx} ${heightPx}" width="100%" preserveAspectRatio="xMinYMid meet" style="max-width: ${widthPx}px; display: block;">${els.join("")}</svg>`;
}

/**
 * Renders a CombinedLevel — same visual language as renderSketchSvg, but
 * smaller grid units (combined levels are 60-90 grids wide) plus vertical
 * dashed boundary markers between segments with the segment label above.
 */
export function renderCombinedSvg(combined: CombinedLevel): string {
  const gridPx = COMBINED_GRID_PX;
  const widthPx = combined.widthGrids * gridPx + PADDING * 2;
  const heightPx = (combined.heightGrids + 2) * gridPx + PADDING * 2 + 18;
  const floorY = heightPx - PADDING - gridPx;

  const els: string[] = [];

  els.push(
    `<rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="${COLORS.bg}" rx="8" />`,
  );

  // Background grid lines.
  for (let gx = 0; gx <= combined.widthGrids; gx += 1) {
    const x = PADDING + gx * gridPx;
    const isMajor = gx % 4 === 0;
    els.push(
      `<line x1="${x}" y1="${PADDING + 18}" x2="${x}" y2="${floorY + FLOOR_BAND_PX}" stroke="${isMajor ? COLORS.majorLine : COLORS.minorLine}" stroke-width="1" opacity="${isMajor ? 0.5 : 0.25}" />`,
    );
  }
  for (let gy = 0; gy <= combined.heightGrids + 1; gy += 1) {
    const y = floorY - gy * gridPx;
    if (y < PADDING + 18) break;
    const isMajor = gy % 4 === 0;
    els.push(
      `<line x1="${PADDING}" y1="${y}" x2="${widthPx - PADDING}" y2="${y}" stroke="${isMajor ? COLORS.majorLine : COLORS.minorLine}" stroke-width="1" opacity="${isMajor ? 0.5 : 0.25}" />`,
    );
  }

  // Floor band with pit gaps.
  const sortedPits = combined.pits.slice().sort((a, b) => a.x - b.x);
  let cursor = 0;
  const segs: { x: number; w: number }[] = [];
  for (const p of sortedPits) {
    if (p.x > cursor) segs.push({ x: cursor, w: p.x - cursor });
    cursor = p.x + p.w;
  }
  if (cursor < combined.widthGrids) {
    segs.push({ x: cursor, w: combined.widthGrids - cursor });
  }
  for (const seg of segs) {
    els.push(
      `<rect x="${PADDING + seg.x * gridPx}" y="${floorY}" width="${seg.w * gridPx}" height="${FLOOR_BAND_PX}" fill="${COLORS.floor}" opacity="0.85" />`,
    );
  }
  for (const p of sortedPits) {
    const pitX = PADDING + p.x * gridPx;
    const pitW = p.w * gridPx;
    els.push(
      `<rect x="${pitX}" y="${floorY}" width="${pitW}" height="${FLOOR_BAND_PX + gridPx / 2}" fill="#1a2026" opacity="0.65" />`,
    );
    for (let dx = 3; dx < pitW; dx += 6) {
      els.push(
        `<line x1="${pitX + dx}" y1="${floorY + 2}" x2="${pitX + dx - 3}" y2="${floorY + FLOOR_BAND_PX + gridPx / 2 - 2}" stroke="#3a4550" stroke-width="1" opacity="0.6" />`,
      );
    }
  }

  // Platforms.
  for (const p of combined.platforms) {
    const px = PADDING + p.x * gridPx;
    const py = floorY - p.y * gridPx - PLATFORM_THICKNESS_PX * (gridPx / 24);
    const pw = p.w * gridPx;
    els.push(
      `<rect x="${px}" y="${py}" width="${pw}" height="${PLATFORM_THICKNESS_PX * (gridPx / 24)}" fill="${COLORS.platform}" stroke="${COLORS.platformStroke}" stroke-width="1" rx="1.5" />`,
    );
  }

  // Zones.
  for (const z of combined.zones) {
    const cx = PADDING + z.x * gridPx + gridPx / 2;
    const cy = floorY - z.y * gridPx - gridPx / 2;
    if (z.kind === "token") {
      els.push(
        `<circle cx="${cx}" cy="${cy}" r="${gridPx * 0.18}" fill="${COLORS.token}" stroke="${COLORS.tokenStroke}" stroke-width="1" />`,
      );
    } else if (z.kind === "enemy") {
      const s = gridPx * 0.3;
      els.push(
        `<polygon points="${cx - s},${cy + s * 0.7} ${cx + s},${cy + s * 0.7} ${cx},${cy - s}" fill="${COLORS.enemy}" stroke="#aa3030" stroke-width="1" />`,
      );
    } else if (z.kind === "companion") {
      els.push(
        `<circle cx="${cx}" cy="${cy}" r="${gridPx * 0.35}" fill="${COLORS.companion}" stroke="#ffffff" stroke-width="1.5" />`,
      );
      els.push(
        `<text x="${cx}" y="${cy + gridPx * 0.8}" font-size="9" fill="${COLORS.label}" text-anchor="middle" font-weight="600" font-family="ui-monospace, monospace">Teddy</text>`,
      );
    }
  }

  // Spawn (only at the very start of the combined level).
  {
    const sx = PADDING + combined.spawn.x * gridPx + gridPx / 2;
    const sy = floorY - combined.spawn.y * gridPx;
    els.push(`<line x1="${sx}" y1="${sy}" x2="${sx}" y2="${sy - 20}" stroke="${COLORS.spawn}" stroke-width="2" />`);
    els.push(
      `<polygon points="${sx},${sy - 20} ${sx},${sy - 10} ${sx + 12},${sy - 15}" fill="${COLORS.spawn}" />`,
    );
    els.push(
      `<text x="${sx}" y="${sy + 14}" font-size="9" fill="${COLORS.spawn}" text-anchor="middle" font-family="ui-monospace, monospace">start</text>`,
    );
  }

  // Exit (only at the very end of the combined level).
  {
    const ex = PADDING + combined.exit.x * gridPx + gridPx / 2;
    const ey = floorY - combined.exit.y * gridPx;
    els.push(`<line x1="${ex}" y1="${ey}" x2="${ex}" y2="${ey - 20}" stroke="${COLORS.exit}" stroke-width="2" />`);
    els.push(
      `<polygon points="${ex},${ey - 20} ${ex},${ey - 10} ${ex - 12},${ey - 15}" fill="${COLORS.exit}" />`,
    );
    els.push(
      `<text x="${ex}" y="${ey + 14}" font-size="9" fill="${COLORS.exit}" text-anchor="middle" font-family="ui-monospace, monospace">finish</text>`,
    );
  }

  // Segment boundary markers (dashed vertical lines + label band above).
  for (const seg of combined.segments) {
    if (seg.startX === 0) continue; // No boundary at the very start
    const bx = PADDING + seg.startX * gridPx;
    els.push(
      `<line x1="${bx}" y1="${PADDING + 18}" x2="${bx}" y2="${floorY + FLOOR_BAND_PX}" stroke="${COLORS.label}" stroke-width="1" stroke-dasharray="4 3" opacity="0.45" />`,
    );
  }
  // Segment labels along the top band.
  for (const seg of combined.segments) {
    const centerX = PADDING + (seg.startX + seg.widthGrids / 2) * gridPx;
    els.push(
      `<text x="${centerX}" y="14" font-size="11" fill="${COLORS.label}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="600">${escapeXml(seg.variant)} · ${seg.widthGrids}g · ~${seg.approxSeconds}s</text>`,
    );
  }

  return `<svg viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}" style="display: block; min-width: ${widthPx}px;">${els.join("")}</svg>`;
}
