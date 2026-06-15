import type { CompanionType } from "../design/levelSketches";
import { COMPANION_LABELS } from "../design/levelSketches";
import { COMPANIONS } from "./companions";
import { ABILITIES } from "./abilities";
import type { CutsceneScript, DemoMotion } from "../systems/cutscene";

/**
 * Each companion's signature move, shown as a looping mini-demo. Compile-time
 * exhaustive (no `default`): adding a CompanionType without a motion is a type error.
 */
export const POWER_INTRO_MOTION: Record<CompanionType, DemoMotion> = {
  teddy: "doubleHop",
  dog: "dash",
  cat: "climb",
  horse: "charge",
  flamingo: "glide",
};

/**
 * Build a power-intro cutscene for a companion. Five additive beats (~7.0s total):
 * the companion bounces in → caption → looping demo → power-name pop → hold.
 */
export function powerIntroScript(type: CompanionType): CutsceneScript {
  const def = COMPANIONS[type];
  const ability = ABILITIES[def.grants];
  return {
    id: `power-intro-${type}`,
    backdrop: "dimGame",
    beats: [
      { kind: "enter", actor: "companion", sprite: def.idleKey, entrance: "bounceIn", durationMs: 600 },
      { kind: "caption", text: `${COMPANION_LABELS[type]} joined you!`, durationMs: 400 },
      { kind: "demo", actor: "companion", motion: POWER_INTRO_MOTION[type], durationMs: 3000 },
      { kind: "title", text: `${ability.label.toUpperCase()}!`, durationMs: 1500 },
      { kind: "hold", durationMs: 1500 },
    ],
  };
}
