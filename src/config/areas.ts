export type AreaId =
  | "bedroom" | "hallway" | "kitchen" | "familyRoom" | "backyard" | "dollhouse";

export const AREA_ORDER: AreaId[] = [
  "bedroom", "hallway", "kitchen", "familyRoom", "backyard", "dollhouse",
];

export function areaIndex(area: AreaId): number {
  return AREA_ORDER.indexOf(area);
}
