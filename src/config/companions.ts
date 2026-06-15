import type { CompanionType } from "../design/levelSketches";
import type { AreaId } from "./areas";
import type { AbilityId } from "./abilities";
import {
  TEDDY_IDLE, TEDDY_WALK, DOG_IDLE, DOG_WALK, CAT_IDLE, CAT_WALK,
  HORSE_IDLE, HORSE_WALK, FLAMINGO_IDLE, FLAMINGO_WALK,
} from "./textures";

export interface CompanionDef {
  area: AreaId;
  grants: AbilityId;
  idleKey: string;
  walkKey: string;
  heartBonus?: number;
  /** Met at the START of its home area (power usable in-area), not the finale.
   *  Evolves the default offset model; opt-in per companion. */
  metAtStart?: boolean;
}

export const COMPANIONS: Record<CompanionType, CompanionDef> = {
  teddy:    { area: "bedroom",    grants: "doubleJump", idleKey: TEDDY_IDLE,    walkKey: TEDDY_WALK,    heartBonus: 1 },
  dog:      { area: "hallway",    grants: "dash",       idleKey: DOG_IDLE,      walkKey: DOG_WALK },
  cat:      { area: "kitchen",    grants: "wallClimb",  idleKey: CAT_IDLE,      walkKey: CAT_WALK, metAtStart: true },
  horse:    { area: "familyRoom", grants: "charge",     idleKey: HORSE_IDLE,    walkKey: HORSE_WALK },
  flamingo: { area: "backyard",   grants: "glide",      idleKey: FLAMINGO_IDLE, walkKey: FLAMINGO_WALK, metAtStart: true },
};
