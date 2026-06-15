import type { CompanionType } from "../design/levelSketches";
import type { AreaId } from "./areas";
import type { AbilityId } from "./abilities";
import { AREA_ORDER, areaIndex } from "./areas";
import { COMPANIONS } from "./companions";

/** The companion whose home is this area (null for the boss area). */
export function companionForArea(area: AreaId): CompanionType | null {
  const found = (Object.keys(COMPANIONS) as CompanionType[]).find(
    (c) => COMPANIONS[c].area === area,
  );
  return found ?? null;
}

/** Abilities the player is EXPECTED to have while playing `area`. */
export function abilitiesForArea(area: AreaId): Set<AbilityId> {
  const idx = areaIndex(area);
  const set = new Set<AbilityId>();
  for (let i = 0; i < idx; i += 1) {
    const c = companionForArea(AREA_ORDER[i]!);
    if (c) set.add(COMPANIONS[c].grants);
  }
  // Companions flagged metAtStart are met early — their power is usable in
  // their OWN home area (not just the next). Default (offset) companions skip this.
  const own = companionForArea(area);
  if (own && COMPANIONS[own].metAtStart) set.add(COMPANIONS[own].grants);
  return set;
}

/** The single power this area is gated on (previous area's companion's grant). */
export function gatingPower(area: AreaId): AbilityId | null {
  const idx = areaIndex(area);
  if (idx <= 0) return null;
  const c = companionForArea(AREA_ORDER[idx - 1]!);
  return c ? COMPANIONS[c].grants : null;
}
