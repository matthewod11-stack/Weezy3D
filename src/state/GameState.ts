import type { AbilityId } from "../config/abilities";
import type { CompanionType } from "../design/levelSketches";
import { COMPANIONS } from "../config/companions";

const STORAGE_KEY = "eloise-bedroom-world-v1";

export type PersistedState = {
  levelIndex: number;
  tokensThisRun: number;
  unlockedAbilities: AbilityId[];
};

export class GameState {
  private static instance: GameState | null = null;

  static get(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  /** Current level index in LEVEL_CATALOG. */
  levelIndex = 0;

  /** Hearts: current / max (max increases when companions are collected). */
  hearts = 3;
  maxHearts = 3;

  /** Tokens collected this session (resets on full world restart if desired). */
  tokensCollected = 0;

  unlockedAbilities: Set<AbilityId> = new Set();
  worldComplete = false;

  /** Level spawn for respawn after death. */
  respawnX = 32;
  respawnY = 100;

  paused = false;

  hasAbility(id: AbilityId): boolean {
    return this.unlockedAbilities.has(id);
  }

  collectCompanion(type: CompanionType): void {
    const def = COMPANIONS[type];
    if (this.unlockedAbilities.has(def.grants)) return;
    this.unlockedAbilities.add(def.grants);
    if (def.heartBonus) {
      this.maxHearts += def.heartBonus;
      if (this.hearts < this.maxHearts) this.hearts = this.maxHearts;
    }
    this.persist();
  }

  hasProgress(): boolean {
    return (
      this.levelIndex > 0 ||
      this.tokensCollected > 0 ||
      this.unlockedAbilities.size > 0 ||
      this.worldComplete
    );
  }

  private constructor() {
    this.load();
  }

  resetWorld(): void {
    this.levelIndex = 0;
    this.hearts = 3;
    this.maxHearts = 3;
    this.tokensCollected = 0;
    this.unlockedAbilities = new Set();
    this.worldComplete = false;
    this.persist();
  }

  /**
   * Start a playable run from the menu without touching saved progress.
   * Clears the transient flags (`worldComplete`, `paused`) that would otherwise
   * make GameScene.update() early-return on re-entry, and refills hearts.
   * New Game calls resetWorld() first; Continue calls this alone so level,
   * tokens, and abilities survive.
   */
  beginRun(): void {
    this.worldComplete = false;
    this.paused = false;
    this.hearts = this.maxHearts;
  }

  persist(): void {
    try {
      const data: PersistedState = {
        levelIndex: this.levelIndex,
        tokensThisRun: this.tokensCollected,
        unlockedAbilities: [...this.unlockedAbilities].sort(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedState> & { teddyCollected?: boolean };
      if (typeof parsed.levelIndex === "number") this.levelIndex = parsed.levelIndex;
      if (typeof parsed.tokensThisRun === "number") this.tokensCollected = parsed.tokensThisRun;
      if (Array.isArray(parsed.unlockedAbilities)) {
        this.unlockedAbilities = new Set(parsed.unlockedAbilities);
      } else if (parsed.teddyCollected) {
        this.unlockedAbilities = new Set(["doubleJump"]); // migrate old saves
      }
      // recompute heart bonus from unlocked abilities
      for (const c of Object.keys(COMPANIONS) as CompanionType[]) {
        if (this.unlockedAbilities.has(COMPANIONS[c].grants) && COMPANIONS[c].heartBonus) {
          this.maxHearts += COMPANIONS[c].heartBonus!;
        }
      }
      this.hearts = Math.min(this.hearts, this.maxHearts);
    } catch {
      /* ignore */
    }
  }
}
