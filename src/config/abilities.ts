export type AbilityId = "doubleJump" | "dash" | "wallClimb" | "charge" | "glide";

export interface AbilityDef {
  label: string;
  family: "envelope" | "traversal";
  order: number;              // gating order; 0 = earned first
  control: "jump" | "power";  // doubleJump on jump button; the rest on the power button
  priority?: number;          // power-button context-resolution tiebreaker (higher wins)
  activation?: "hold" | "press"; // "hold" = held active, "press" = single-trigger; omit if not yet wired
  envelope?: { extraJumps?: number; glideFallSpeed?: number };
  // Traversal family. dashSpeed (design-px/s) × dashDurationMs gives the lunge
  // distance; climbSpeed (design-px/s) is the wall ascent rate; chargeReach
  // (design-px) is how far ahead a breakable registers as smashable. Player
  // scales by RENDER_SCALE; reachability derives the dash distance in
  // design-space. One source of truth. TDD-pinned; tune for feel.
  traversal?: { dashSpeed?: number; dashDurationMs?: number; climbSpeed?: number; chargeReach?: number };
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  doubleJump: { label: "Double Jump", family: "envelope",   order: 0, control: "jump",  envelope: { extraJumps: 1 } },
  dash:       { label: "Dash",        family: "traversal",  order: 1, control: "power", priority: 1, activation: "press", traversal: { dashSpeed: 800, dashDurationMs: 400 } },
  wallClimb:  { label: "Wall-Climb",  family: "traversal",  order: 2, control: "power", priority: 4, activation: "hold", traversal: { climbSpeed: 130 } },
  charge:     { label: "Charge",      family: "traversal",  order: 3, control: "power", priority: 2, activation: "press", traversal: { chargeReach: 14 } },
  // Glide: parachute clamp — design-px/s descent speed (un-scaled; Player scales
  // by RENDER_SCALE, reachability uses design-space directly). TDD-pinned; tune for feel.
  glide:      { label: "Glide",       family: "envelope",   order: 4, control: "power", priority: 3, activation: "hold", envelope: { glideFallSpeed: 90 } },
};
