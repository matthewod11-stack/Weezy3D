import { describe, it, expect } from "vitest";
import {
  DEFAULT_BOSS_CONFIG,
  initialBossState,
  stepBossFight,
  telegraphDurationMs,
  recoveryDurationMs,
  resolveThrow,
  type BossFightConfig,
} from "./bossFight";

const cfg: BossFightConfig = DEFAULT_BOSS_CONFIG;

/** Advance the fight by `ms`, never registering a hit. Returns the final state. */
function idle(ms: number, state = initialBossState(cfg)) {
  let s = state;
  let left = ms;
  const tick = 16;
  while (left > 0) {
    s = stepBossFight(s, Math.min(tick, left), false, cfg).state;
    left -= tick;
  }
  return s;
}

describe("bossFight state machine", () => {
  it("starts in intro with full HP", () => {
    const s = initialBossState(cfg);
    expect(s.phase).toBe("intro");
    expect(s.hp).toBe(cfg.maxHp);
    expect(s.hitsLanded).toBe(0);
  });

  it("leaves intro into telegraph after introMs", () => {
    expect(idle(cfg.introMs - 50).phase).toBe("intro");
    expect(idle(cfg.introMs + 50).phase).toBe("telegraph");
  });

  it("telegraph lasts at least telegraphMs, then attacks with stomp first", () => {
    const afterIntro = idle(cfg.introMs + 50);
    expect(afterIntro.phase).toBe("telegraph");
    const stillTelegraph = idle(cfg.telegraphMs - 50, afterIntro);
    expect(stillTelegraph.phase).toBe("telegraph");
    const attacking = idle(cfg.telegraphMs + 50, afterIntro);
    expect(attacking.phase).toBe("attack");
    expect(attacking.currentAttack).toBe("stomp");
  });

  it("the second attack is a charge (alternation)", () => {
    let s = idle(cfg.introMs + cfg.telegraphMs + cfg.attackMs + cfg.recoveryMs + cfg.telegraphMs + 100);
    expect(s.phase).toBe("attack");
    expect(s.currentAttack).toBe("charge");
  });

  it("a throw outside recovery does NOT register a hit", () => {
    const telegraph = idle(cfg.introMs + 50);
    const r = stepBossFight(telegraph, 16, true, cfg);
    expect(r.hitRegistered).toBe(false);
    expect(r.state.hp).toBe(cfg.maxHp);
  });

  it("a throw during recovery registers a hit and returns to telegraph", () => {
    const recovery = idle(cfg.introMs + cfg.telegraphMs + cfg.attackMs + 50);
    expect(recovery.phase).toBe("recovery");
    const r = stepBossFight(recovery, 16, true, cfg);
    expect(r.hitRegistered).toBe(true);
    expect(r.state.hp).toBe(cfg.maxHp - 1);
    expect(r.state.hitsLanded).toBe(1);
    expect(r.state.phase).toBe("telegraph");
  });

  it("three recovery-window hits win the fight", () => {
    let s = initialBossState(cfg);
    for (let hit = 0; hit < cfg.maxHp; hit += 1) {
      let guard = 0;
      while (s.phase !== "recovery" && s.phase !== "won" && guard < 10000) {
        s = stepBossFight(s, 16, false, cfg).state;
        guard += 1;
      }
      if (s.phase === "recovery") {
        s = stepBossFight(s, 16, true, cfg).state;
      }
    }
    expect(s.phase).toBe("won");
    expect(s.hp).toBe(0);
  });

  it("missed recovery window returns to telegraph without a hit", () => {
    const recovery = idle(cfg.introMs + cfg.telegraphMs + cfg.attackMs + 50);
    const missed = idle(cfg.recoveryMs + 50, recovery);
    expect(missed.phase).toBe("telegraph");
    expect(missed.hp).toBe(cfg.maxHp);
  });

  it("telegraph and recovery durations never drop below their floors", () => {
    const many = 99;
    expect(telegraphDurationMs(many, cfg)).toBe(cfg.minTelegraphMs);
    expect(recoveryDurationMs(many, cfg)).toBe(cfg.minRecoveryMs);
    expect(cfg.minTelegraphMs).toBeGreaterThanOrEqual(1000);
    expect(cfg.minRecoveryMs).toBeGreaterThanOrEqual(2000);
  });

  describe("resolveThrow (ammo + companion bailout)", () => {
    it("spends one token when ammo is available", () => {
      expect(resolveThrow(5, cfg.bailoutGrant)).toEqual({ ammoAfter: 4, bailedOut: false });
    });
    it("spends the last token without bailing out", () => {
      expect(resolveThrow(1, cfg.bailoutGrant)).toEqual({ ammoAfter: 0, bailedOut: false });
    });
    it("bails out when ammo is empty (grant then spend one)", () => {
      expect(resolveThrow(0, cfg.bailoutGrant)).toEqual({ ammoAfter: cfg.bailoutGrant - 1, bailedOut: true });
    });
    it("bails out if arriving already negative (defensive)", () => {
      expect(resolveThrow(-3, cfg.bailoutGrant)).toEqual({ ammoAfter: cfg.bailoutGrant - 1, bailedOut: true });
    });
  });
});
