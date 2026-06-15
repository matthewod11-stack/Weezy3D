/**
 * The T-Rex boss fight — a PURE, Phaser-free state machine (mirrors airJump.ts /
 * powerDispatch.ts / reachability.ts so it's deterministically unit-testable; the
 * boss can't be reachability-lint-proven because it's real-time). BossScene feeds
 * it elapsed-time deltas and "did a token hit the boss this frame", and reacts to
 * the events/flags it returns. No RNG: attacks alternate (predictable = learnable).
 */

export type BossPhase = "intro" | "telegraph" | "attack" | "recovery" | "won";
export type AttackKind = "stomp" | "charge";

export interface BossFightConfig {
  maxHp: number;
  introMs: number;
  telegraphMs: number;
  attackMs: number;
  recoveryMs: number;
  /** Shaved off telegraph + recovery per landed hit (escalation). */
  escalationMs: number;
  minTelegraphMs: number;
  minRecoveryMs: number;
  /** Tokens companions toss when ammo hits zero. */
  bailoutGrant: number;
}

export const DEFAULT_BOSS_CONFIG: BossFightConfig = {
  maxHp: 3,
  introMs: 1500,
  telegraphMs: 1300,
  attackMs: 1400,
  recoveryMs: 2400,
  escalationMs: 150,
  minTelegraphMs: 1000,
  minRecoveryMs: 2000,
  bailoutGrant: 5,
};

export interface BossFightState {
  phase: BossPhase;
  hp: number;
  hitsLanded: number;
  /** How many attacks have STARTED (drives stomp/charge alternation). */
  attacksStarted: number;
  currentAttack: AttackKind | null;
  phaseElapsedMs: number;
}

export interface BossStepResult {
  state: BossFightState;
  startedTelegraph: boolean;
  startedAttack: AttackKind | null;
  enteredRecovery: boolean;
  hitRegistered: boolean;
  won: boolean;
}

export function initialBossState(config: BossFightConfig): BossFightState {
  return {
    phase: "intro",
    hp: config.maxHp,
    hitsLanded: 0,
    attacksStarted: 0,
    currentAttack: null,
    phaseElapsedMs: 0,
  };
}

export function telegraphDurationMs(hitsLanded: number, config: BossFightConfig): number {
  return Math.max(config.minTelegraphMs, config.telegraphMs - hitsLanded * config.escalationMs);
}

export function recoveryDurationMs(hitsLanded: number, config: BossFightConfig): number {
  return Math.max(config.minRecoveryMs, config.recoveryMs - hitsLanded * config.escalationMs);
}

/** Advance one frame. Pure: returns a fresh state + the events this frame produced. */
export function stepBossFight(
  prev: BossFightState,
  deltaMs: number,
  throwLanded: boolean,
  config: BossFightConfig,
): BossStepResult {
  // `state` is a fresh copy (prev is never touched); it is then mutated in place below.
  const state: BossFightState = { ...prev, phaseElapsedMs: prev.phaseElapsedMs + deltaMs };
  const result: BossStepResult = {
    state,
    startedTelegraph: false,
    startedAttack: null,
    enteredRecovery: false,
    hitRegistered: false,
    won: false,
  };

  const toPhase = (phase: BossPhase): void => {
    state.phase = phase;
    state.phaseElapsedMs = 0;
  };

  switch (prev.phase) {
    case "intro":
      if (state.phaseElapsedMs >= config.introMs) {
        toPhase("telegraph");
        result.startedTelegraph = true;
      }
      break;

    case "telegraph":
      // Uses the pre-increment hits count by design: a landing hit shortens the NEXT
      // recovery, not the telegraph already in progress. Do not "fix" to post-increment.
      if (state.phaseElapsedMs >= telegraphDurationMs(state.hitsLanded, config)) {
        const kind: AttackKind = state.attacksStarted % 2 === 0 ? "stomp" : "charge";
        state.attacksStarted += 1;
        state.currentAttack = kind;
        toPhase("attack");
        result.startedAttack = kind;
      }
      break;

    case "attack":
      if (state.phaseElapsedMs >= config.attackMs) {
        state.currentAttack = null;
        toPhase("recovery");
        result.enteredRecovery = true;
      }
      break;

    case "recovery":
      if (throwLanded && state.hp > 0) {
        state.hp -= 1;
        state.hitsLanded += 1;
        result.hitRegistered = true;
        if (state.hp <= 0) {
          toPhase("won");
          result.won = true;
        } else {
          toPhase("telegraph");
          result.startedTelegraph = true;
        }
      } else if (state.phaseElapsedMs >= recoveryDurationMs(state.hitsLanded, config)) {
        toPhase("telegraph");
        result.startedTelegraph = true;
      }
      break;

    case "won":
      break;
  }

  return result;
}

/**
 * Resolve one throw against the ammo pool. A throw always spends one token; if the
 * pool is empty the collected companions toss a handful first (bailout), so the
 * fight can never soft-lock — including arriving at the arena with zero picks.
 */
export function resolveThrow(
  ammo: number,
  bailoutGrant: number,
): { ammoAfter: number; bailedOut: boolean } {
  if (ammo <= 0) {
    return { ammoAfter: bailoutGrant - 1, bailedOut: true };
  }
  return { ammoAfter: ammo - 1, bailedOut: false };
}
