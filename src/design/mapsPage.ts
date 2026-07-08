import { combineSlot, type CombinedLevel } from "./combineSlot";
import {
  ALL_AREAS,
  COMPANION_LABELS,
  ENEMY_LABELS,
  type Area,
  type LevelSlot,
} from "./levelSketches";
import { renderCombinedSvg } from "./sketchRenderer";

/** Variant ordering applied to every slot when content exists. */
const SEGMENT_ORDER = ["B", "A", "A", "C"];

/**
 * Per-area override (2026-07-08 playtest: Bedroom's B-A-A-C chain felt too
 * long — see src/levels/bedroomLevels.ts). Keyed by Area.id; areas without an
 * entry keep the default SEGMENT_ORDER. Add an entry here as each remaining
 * world's *Levels.ts file adopts the shorter chain.
 */
const AREA_SEGMENT_ORDER: Record<number, string[]> = {
  1: ["B", "C"], // Bedroom
};

/** Escape author-edited strings before inserting into HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function countZones(combined: CombinedLevel, kind: "token" | "enemy" | "companion"): number {
  return combined.zones.filter((z) => z.kind === kind).length;
}

function renderSegmentBreakdown(combined: CombinedLevel): string {
  return combined.segments
    .map(
      (s) =>
        `<span class="seg-pill"><strong>${escapeHtml(s.variant)}</strong> · ${s.widthGrids}g · ~${s.approxSeconds}s</span>`,
    )
    .join("<span class='seg-arrow'>→</span>");
}

function renderDraftedSlot(combined: CombinedLevel): string {
  const tokens = countZones(combined, "token");
  const enemies = countZones(combined, "enemy");
  const hasCompanion = countZones(combined, "companion") > 0;
  const totalDesignPx = combined.widthGrids * 32;
  return `
    <section class="slot">
      <header class="slot-head">
        <h3>Level ${combined.slotId} — ${escapeHtml(combined.slotName)}</h3>
        <p class="intent">${escapeHtml(combined.intent)}</p>
        <p class="totals">
          <span class="big-meta">${combined.widthGrids} grids</span>
          <span class="big-meta">${totalDesignPx.toLocaleString()} design-px</span>
          <span class="big-meta">~${combined.approxSeconds}s play</span>
          <span class="meta-tag">${tokens} tokens</span>
          <span class="meta-tag">${enemies} enemies</span>
          ${hasCompanion ? '<span class="meta-tag tag-companion">companion</span>' : ""}
        </p>
        <div class="breakdown">${renderSegmentBreakdown(combined)}</div>
      </header>
      <div class="canvas-wrap">${renderCombinedSvg(combined)}</div>
    </section>`;
}

function renderStubSlot(slot: LevelSlot): string {
  return `
    <section class="slot slot-stub">
      <header class="slot-head">
        <h3>Level ${slot.id} — ${escapeHtml(slot.name)}</h3>
        <p class="intent">${escapeHtml(slot.intent)}</p>
        <p class="stub-marker">not yet drafted</p>
      </header>
    </section>`;
}

function renderArea(area: Area): string {
  const companionLabel = area.companion ? COMPANION_LABELS[area.companion] : "—";
  const primaryEnemyLabel = ENEMY_LABELS[area.primaryEnemy];
  const carryOver =
    area.carryOverEnemies.length > 0
      ? area.carryOverEnemies.map((e) => ENEMY_LABELS[e]).join(", ")
      : "none";

  const slotsHtml = area.slots
    .map((slot) => {
      if (slot.options.length === 0) {
        return renderStubSlot(slot);
      }
      const order = AREA_SEGMENT_ORDER[area.id] ?? SEGMENT_ORDER;
      const combined = combineSlot({ id: slot.id, name: slot.name, intent: slot.intent, options: slot.options }, order);
      return renderDraftedSlot(combined);
    })
    .join("");

  const draftedCount = area.slots.filter((s) => s.options.length > 0).length;
  const totalSlots = area.slots.length;
  const status =
    draftedCount === totalSlots
      ? `<span class="status-full">${draftedCount}/${totalSlots} drafted</span>`
      : draftedCount > 0
        ? `<span class="status-partial">${draftedCount}/${totalSlots} drafted</span>`
        : `<span class="status-empty">${draftedCount}/${totalSlots} drafted</span>`;

  const bossBadge = area.isBoss ? '<span class="boss-badge">BOSS</span>' : "";

  return `
    <article class="area${area.isBoss ? " area-boss" : ""}">
      <header class="area-head">
        <h2>World ${area.id} — ${escapeHtml(area.name)} ${bossBadge}</h2>
        <p class="area-intent">${escapeHtml(area.intent)}</p>
        <p class="area-meta">
          <span><strong>Companion:</strong> ${escapeHtml(companionLabel)}</span>
          <span><strong>New enemy:</strong> ${escapeHtml(primaryEnemyLabel)}</span>
          <span><strong>Carry-over enemies:</strong> ${escapeHtml(carryOver)}</span>
          <span>${status}</span>
        </p>
      </header>
      <div class="area-slots">${slotsHtml}</div>
    </article>`;
}

function render(): void {
  const root = document.getElementById("maps-root");
  if (!root) {
    return;
  }
  const totalDrafted = ALL_AREAS.reduce(
    (sum, a) => sum + a.slots.filter((s) => s.options.length > 0).length,
    0,
  );
  const totalSlots = ALL_AREAS.reduce((sum, a) => sum + a.slots.length, 0);
  const totals = document.getElementById("totals");
  if (totals) {
    totals.textContent = `${ALL_AREAS.length} areas · ${totalDrafted}/${totalSlots} levels drafted · 5 companions + 1 boss`;
  }
  root.innerHTML = ALL_AREAS.map(renderArea).join("");
}

render();
