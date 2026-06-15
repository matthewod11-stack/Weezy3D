# Power System — Foundation + Double-Jump Slice (Implementation Plan)

> ✅ **STATUS: COMPLETED 2026-05-30** — all 14 tasks shipped subagent-driven (commits `0724822`…`56af0aa`, plus capstone-review fix `1ec6a47`). Tests 35→63, `npm run build` green. The Hallway gate (`hallway-1`) is proven to require double-jump by the reachability double-check. Full write-up in PROGRESS.md (2026-05-30 17:55). Next: manual playtest, then a Phase 2 (Glide) plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data-driven power-system foundation (all 5 powers as data) and the first complete vertical slice — Teddy → Double Jump — with the reachability double-check proving the Hallway genuinely requires the power.

**Architecture:** Powers are rows in data tables (`ABILITIES`, `COMPANIONS`); the engine reads `GameState.unlockedAbilities: Set<AbilityId>` and never branches per-power. Area→ability gating is *derived* from area order, with a Zod ordering invariant. The existing reachability lint gains `jumpEnvelope(abilities)` and a build-time double-check: every area solvable *with* its powers, and the gate genuinely *requires* the gating power.

**Tech Stack:** TypeScript (strict), Phaser 3.80, Vitest, Zod. Tests run with `npx vitest run <file>`; full gate is `npm run build`.

**Scope:** This plan = **Phase 0 (Foundation)** + **Phase 1 (Double-Jump slice)**, the complete first vertical slice. Phases 2–5 (Glide + power-button, then the three traversal powers) are captured as forward contracts in §"Future Phases" and in the spec (`docs/superpowers/specs/2026-05-30-power-system-design.md` §8); each becomes its own plan when its slice begins — writing detailed tasks for the not-yet-validated traversal mechanics now would be planning speculation.

**Reference:** spec at `docs/superpowers/specs/2026-05-30-power-system-design.md`.

---

## File Structure

**Create:**
- `src/config/areas.ts` — `AreaId` + ordered `AREA_ORDER` + `areaIndex()`.
- `src/config/abilities.ts` — `AbilityId` + `ABILITIES` table.
- `src/config/companions.ts` — `COMPANIONS` table (reuses `CompanionType` from `levelSketches`).
- `src/config/gating.ts` — derived `abilitiesForArea()` / `gatingPower()` / `companionForArea()`.
- `src/scenes/PowerUnlockScene.ts` — the breakaway reveal screen.
- Test files alongside each (`*.test.ts`).

**Modify:**
- `src/state/GameState.ts` — replace `teddyCollected` with `unlockedAbilities: Set<AbilityId>`.
- `src/levels/reachability.ts` — `jumpEnvelope(abilities)`, `abilities` in `ReachabilityOptions`.
- `src/levels/reachability.integration.test.ts` — drive the double-check per area.
- `src/entities/Player.ts` — second jump on the jump button when `doubleJump` unlocked.
- `src/entities/Companion.ts` — carry `companionType`; `collect()` unlocks via `collectCompanion` + emits an event.
- `src/scenes/GameScene.ts` — generalize companion spawn; wire the gate-moment reveal.
- `src/levels/levelCatalog.ts` + a Hallway level — add the Hallway gate level (areaId `"hallway"`).
- The Phaser game-config scene array (where `MenuScene`/`GameScene` are registered) — add `PowerUnlockScene`.

---

# Phase 0 — Foundation

## Task 0.1: Area order

**Files:**
- Create: `src/config/areas.ts`
- Test: `src/config/areas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/config/areas.test.ts
import { describe, it, expect } from "vitest";
import { AREA_ORDER, areaIndex } from "./areas";

describe("area order", () => {
  it("lists the six areas in play order", () => {
    expect(AREA_ORDER).toEqual([
      "bedroom", "hallway", "kitchen", "familyRoom", "livingRoom", "dollhouse",
    ]);
  });
  it("areaIndex returns position, -1 for unknown", () => {
    expect(areaIndex("hallway")).toBe(1);
    expect(areaIndex("dollhouse")).toBe(5);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/config/areas.test.ts`
Expected: FAIL — `Cannot find module './areas'`.

- [ ] **Step 3: Implement**

```ts
// src/config/areas.ts
export type AreaId =
  | "bedroom" | "hallway" | "kitchen" | "familyRoom" | "livingRoom" | "dollhouse";

export const AREA_ORDER: AreaId[] = [
  "bedroom", "hallway", "kitchen", "familyRoom", "livingRoom", "dollhouse",
];

export function areaIndex(area: AreaId): number {
  return AREA_ORDER.indexOf(area);
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npx vitest run src/config/areas.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/areas.ts src/config/areas.test.ts
git commit -m "feat(powers): area order config"
```

---

## Task 0.2: Ability registry

**Files:**
- Create: `src/config/abilities.ts`
- Test: `src/config/abilities.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/config/abilities.test.ts
import { describe, it, expect } from "vitest";
import { ABILITIES, type AbilityId } from "./abilities";

const ALL: AbilityId[] = ["doubleJump", "dash", "wallClimb", "charge", "glide"];

describe("ABILITIES", () => {
  it("has a row per ability with a unique 0-4 order", () => {
    const orders = ALL.map((id) => ABILITIES[id].order).sort();
    expect(orders).toEqual([0, 1, 2, 3, 4]);
  });
  it("binds double-jump to the jump button, the rest to the power button", () => {
    expect(ABILITIES.doubleJump.control).toBe("jump");
    for (const id of ALL.filter((i) => i !== "doubleJump")) {
      expect(ABILITIES[id].control).toBe("power");
    }
  });
  it("marks double-jump and glide as envelope powers with envelope data", () => {
    expect(ABILITIES.doubleJump.family).toBe("envelope");
    expect(ABILITIES.doubleJump.envelope?.extraJumps).toBe(1);
    expect(ABILITIES.glide.family).toBe("envelope");
    expect(ABILITIES.glide.envelope?.fallGravityMult).toBeGreaterThan(0);
    expect(ABILITIES.dash.family).toBe("traversal");
  });
});
```

- [ ] **Step 2: Run — FAIL** (`Cannot find module './abilities'`).

Run: `npx vitest run src/config/abilities.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/config/abilities.ts
export type AbilityId = "doubleJump" | "dash" | "wallClimb" | "charge" | "glide";

export interface AbilityDef {
  label: string;
  family: "envelope" | "traversal";
  order: number;              // gating order; 0 = earned first
  control: "jump" | "power";  // doubleJump on jump button; the rest on the power button
  priority?: number;          // power-button context-resolution tiebreaker (higher wins)
  envelope?: { extraJumps?: number; fallGravityMult?: number };
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  doubleJump: { label: "Double Jump", family: "envelope", order: 0, control: "jump", envelope: { extraJumps: 1 } },
  dash:       { label: "Dash",        family: "traversal", order: 1, control: "power", priority: 1 },
  wallClimb:  { label: "Wall-Climb",  family: "traversal", order: 2, control: "power", priority: 4 },
  charge:     { label: "Charge",      family: "traversal", order: 3, control: "power", priority: 2 },
  glide:      { label: "Glide",       family: "envelope",  order: 4, control: "power", priority: 3, envelope: { fallGravityMult: 0.3 } },
};
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/config/abilities.ts src/config/abilities.test.ts
git commit -m "feat(powers): ABILITIES data table"
```

---

## Task 0.3: Companion registry

**Files:**
- Create: `src/config/companions.ts`
- Test: `src/config/companions.test.ts`

Reuses `CompanionType` already exported from `src/design/levelSketches.ts` (`"teddy" | "dog" | "cat" | "horse" | "flamingo"`). Texture keys come from `src/config/textures.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/config/companions.test.ts
import { describe, it, expect } from "vitest";
import { COMPANIONS } from "./companions";
import { ABILITIES } from "./abilities";
import { AREA_ORDER, areaIndex } from "./areas";
import { STORYBOOK_KEYS } from "./textures";
import type { CompanionType } from "../design/levelSketches";

const ALL: CompanionType[] = ["teddy", "dog", "cat", "horse", "flamingo"];

describe("COMPANIONS", () => {
  it("maps each of the 5 companions to a distinct area in play order", () => {
    const areas = ALL.map((c) => COMPANIONS[c].area);
    expect(new Set(areas).size).toBe(5);
    // companion of area i grants the ability whose order == i
    for (const c of ALL) {
      expect(ABILITIES[COMPANIONS[c].grants].order).toBe(areaIndex(COMPANIONS[c].area));
    }
  });
  it("teddy lives in the bedroom, grants double jump, +1 heart", () => {
    expect(COMPANIONS.teddy.area).toBe("bedroom");
    expect(COMPANIONS.teddy.grants).toBe("doubleJump");
    expect(COMPANIONS.teddy.heartBonus).toBe(1);
  });
  it("every companion's textures are loaded", () => {
    for (const c of ALL) {
      expect(STORYBOOK_KEYS).toContain(COMPANIONS[c].idleKey);
      expect(STORYBOOK_KEYS).toContain(COMPANIONS[c].walkKey);
    }
  });
  it("covers the first 5 areas (dollhouse is the boss, no companion)", () => {
    const covered = new Set(ALL.map((c) => COMPANIONS[c].area));
    expect(covered).toEqual(new Set(AREA_ORDER.slice(0, 5)));
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/config/companions.ts
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
}

export const COMPANIONS: Record<CompanionType, CompanionDef> = {
  teddy:    { area: "bedroom",    grants: "doubleJump", idleKey: TEDDY_IDLE,    walkKey: TEDDY_WALK,    heartBonus: 1 },
  dog:      { area: "hallway",    grants: "dash",       idleKey: DOG_IDLE,      walkKey: DOG_WALK },
  cat:      { area: "kitchen",    grants: "wallClimb",  idleKey: CAT_IDLE,      walkKey: CAT_WALK },
  horse:    { area: "familyRoom", grants: "charge",     idleKey: HORSE_IDLE,    walkKey: HORSE_WALK },
  flamingo: { area: "livingRoom", grants: "glide",      idleKey: FLAMINGO_IDLE, walkKey: FLAMINGO_WALK },
};
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/config/companions.ts src/config/companions.test.ts
git commit -m "feat(powers): COMPANIONS data table (subsumes companion texture map)"
```

---

## Task 0.4: Derived gating

**Files:**
- Create: `src/config/gating.ts`
- Test: `src/config/gating.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/config/gating.test.ts
import { describe, it, expect } from "vitest";
import { abilitiesForArea, gatingPower } from "./gating";

describe("derived gating", () => {
  it("abilitiesForArea = grants of all EARLIER areas' companions", () => {
    expect([...abilitiesForArea("bedroom")]).toEqual([]);
    expect([...abilitiesForArea("hallway")]).toEqual(["doubleJump"]);
    expect([...abilitiesForArea("kitchen")].sort()).toEqual(["dash", "doubleJump"]);
    expect(abilitiesForArea("dollhouse").size).toBe(5);
  });
  it("gatingPower = the previous area's companion's grant; null for bedroom", () => {
    expect(gatingPower("bedroom")).toBeNull();
    expect(gatingPower("hallway")).toBe("doubleJump");
    expect(gatingPower("kitchen")).toBe("dash");
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/config/gating.ts
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
  return set;
}

/** The single power this area is gated on (previous area's companion's grant). */
export function gatingPower(area: AreaId): AbilityId | null {
  const idx = areaIndex(area);
  if (idx <= 0) return null;
  const c = companionForArea(AREA_ORDER[idx - 1]!);
  return c ? COMPANIONS[c].grants : null;
}
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/config/gating.ts src/config/gating.test.ts
git commit -m "feat(powers): derived area gating (abilitiesForArea, gatingPower)"
```

---

## Task 0.5: GameState — unlockedAbilities

**Files:**
- Modify: `src/state/GameState.ts`
- Modify: `src/entities/Companion.ts` (the two `teddyCollected`/`collectTeddy` call sites)
- Test: `src/state/GameState.test.ts`

> Note: Vitest's default env is node, where `localStorage` is undefined. `GameState.load()`/`persist()` already wrap access in `try/catch`, so the singleton works in tests (persistence simply no-ops). Tests call `GameState.get().resetWorld()` first to isolate state.

- [ ] **Step 1: Write the failing test**

```ts
// src/state/GameState.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { GameState } from "./GameState";

describe("GameState abilities", () => {
  beforeEach(() => GameState.get().resetWorld());

  it("starts with no abilities", () => {
    expect(GameState.get().hasAbility("doubleJump")).toBe(false);
  });
  it("collecting Teddy unlocks double jump and grants +1 max heart", () => {
    const s = GameState.get();
    s.collectCompanion("teddy");
    expect(s.hasAbility("doubleJump")).toBe(true);
    expect(s.maxHearts).toBe(4);
  });
  it("collecting a companion is idempotent", () => {
    const s = GameState.get();
    s.collectCompanion("teddy");
    s.collectCompanion("teddy");
    expect(s.maxHearts).toBe(4);
  });
  it("resetWorld clears abilities and hearts", () => {
    const s = GameState.get();
    s.collectCompanion("teddy");
    s.resetWorld();
    expect(s.hasAbility("doubleJump")).toBe(false);
    expect(s.maxHearts).toBe(3);
  });
});
```

- [ ] **Step 2: Run — FAIL** (`hasAbility`/`collectCompanion` don't exist).

Run: `npx vitest run src/state/GameState.test.ts`

- [ ] **Step 3: Implement — rewrite `GameState.ts`**

Replace the `teddyCollected` field, `collectTeddy()`, `PersistedState`, `persist()`, `load()`, `resetWorld()`, and `hasProgress()` as follows (keep everything else):

```ts
import type { AbilityId } from "../config/abilities";
import type { CompanionType } from "../design/levelSketches";
import { COMPANIONS } from "../config/companions";

const STORAGE_KEY = "eloise-bedroom-world-v1";

export type PersistedState = {
  levelIndex: number;
  tokensThisRun: number;
  unlockedAbilities: AbilityId[];
};

// ...inside the class, replace `teddyCollected = false;` with:
unlockedAbilities: Set<AbilityId> = new Set();

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

resetWorld(): void {
  this.levelIndex = 0;
  this.hearts = 3;
  this.maxHearts = 3;
  this.tokensCollected = 0;
  this.unlockedAbilities = new Set();
  this.worldComplete = false;
  this.persist();
}

persist(): void {
  try {
    const data: PersistedState = {
      levelIndex: this.levelIndex,
      tokensThisRun: this.tokensCollected,
      unlockedAbilities: [...this.unlockedAbilities].sort(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

load(): void {
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
  } catch { /* ignore */ }
}
```

Then fix the two call sites in `src/entities/Companion.ts`:
- `configurePickup()` line ~53: replace `this.collected = state.teddyCollected;` with `this.collected = state.hasAbility("doubleJump");` *(temporary — generalized in Task 1.4)*.
- `collect()` line ~75: replace `GameState.get().collectTeddy();` with `GameState.get().collectCompanion("teddy");` *(generalized in Task 1.4)*.

- [ ] **Step 4: Run — verify GameState tests pass AND nothing else broke**

Run: `npx vitest run src/state/GameState.test.ts` → PASS.
Run: `npx tsc --noEmit` → 0 errors (catches any remaining `teddyCollected` reference).

- [ ] **Step 5: Commit**

```bash
git add src/state/GameState.ts src/state/GameState.test.ts src/entities/Companion.ts
git commit -m "feat(powers): GameState.unlockedAbilities replaces teddyCollected"
```

---

## Task 0.6: Thread `abilities` into the reachability double-check

**Files:**
- Modify: `src/levels/reachability.ts` (add `abilities?` to `ReachabilityOptions` — TYPE ONLY for now)
- Modify: `src/levels/levelCatalog.ts` (expose `areaId` already present on entries — confirm it's typed)
- Modify: `src/levels/reachability.integration.test.ts` (drive per-area)
- Test: same integration file

> `LevelCatalogEntry` already has `areaId: string`. The double-check uses it. In P0 there are no powers in play (bedroom → `abilitiesForArea` is empty), so the envelope is unchanged; this task proves the *harness* before P1 makes it ability-aware.

- [ ] **Step 1: Add the option (type only)** — in `ReachabilityOptions` add:

```ts
import type { AbilityId } from "../config/abilities";
// ...
export interface ReachabilityOptions {
  exitMargin?: number;
  contentMargin?: number;
  abilities?: Set<AbilityId>; // consumed in Phase 1 (jumpEnvelope becomes ability-aware)
}
```

Run `npx tsc --noEmit` → 0 errors.

- [ ] **Step 2: Write the failing double-check test**

Replace the body of `reachability.integration.test.ts` with the area-driven double-check:

```ts
import { describe, it, expect } from "vitest";
import { LEVEL_CATALOG } from "./levelCatalog";
import { checkReachability } from "./reachability";
import { abilitiesForArea, gatingPower } from "../config/gating";
import type { AreaId } from "../config/areas";

describe("every level is completable with its area's powers", () => {
  for (const entry of LEVEL_CATALOG) {
    const data = entry.raw;
    const area = entry.areaId as AreaId;
    it(`${data.id} — solvable WITH ${[...abilitiesForArea(area)].join("+") || "no powers"}`, () => {
      const result = checkReachability(data, { abilities: abilitiesForArea(area) });
      const errors = result.problems.filter((p) => p.severity === "error");
      expect(errors, errors.map((e) => e.message).join(" | ")).toHaveLength(0);
    });
  }
});

describe("each area's gate genuinely requires its gating power", () => {
  for (const entry of LEVEL_CATALOG) {
    const area = entry.areaId as AreaId;
    const gp = gatingPower(area);
    if (!gp) continue; // bedroom: no gate power
    it(`${entry.raw.id} — NOT solvable without ${gp}`, () => {
      const without = new Set([...abilitiesForArea(area)]);
      without.delete(gp);
      const r = checkReachability(entry.raw, { abilities: without });
      const errors = r.problems.filter((p) => p.severity === "error");
      // A real gate level is unsolvable without its power. (See Task 1.7 — the
      // Hallway gate makes this assertion meaningful; bedroom has no gate.)
      expect(errors.length).toBeGreaterThan(0);
    });
  }
});
```

- [ ] **Step 3: Run — verify the FIRST describe passes (bedroom, empty abilities = today's behavior)**

Run: `npx vitest run src/levels/reachability.integration.test.ts`
Expected: the "solvable WITH" block PASSES for all bedroom levels. The "gate requires power" block has **no cases yet** (bedroom's `gatingPower` is null → `continue`), so it contributes 0 tests. ✅

- [ ] **Step 4: Commit**

```bash
git add src/levels/reachability.ts src/levels/reachability.integration.test.ts
git commit -m "feat(powers): area-driven reachability double-check harness"
```

- [ ] **Step 5: Foundation gate — full build**

Run: `npm run build`
Expected: `tsc` clean, all tests pass, vite build succeeds. **Phase 0 complete.**

---

# Phase 1 — Double-Jump Vertical Slice

## Task 1.1: Ability-aware jump envelope (double jump)

**Files:**
- Modify: `src/levels/reachability.ts`
- Test: `src/levels/reachability.test.ts` (add a describe block)

- [ ] **Step 1: Write the failing test**

```ts
// add to src/levels/reachability.test.ts
import { jumpEnvelope } from "./reachability"; // already imported

describe("jumpEnvelope is ability-aware", () => {
  it("double jump roughly doubles apex and extends the flat gap", () => {
    const base = jumpEnvelope();
    const dbl = jumpEnvelope(new Set(["doubleJump"]));
    expect(dbl.maxApex).toBeGreaterThan(base.maxApex * 1.8);
    expect(dbl.maxApex).toBeLessThan(base.maxApex * 2.2);
    expect(dbl.maxFlatGap).toBeGreaterThan(base.maxFlatGap * 1.5);
  });
  it("no abilities returns the base envelope unchanged", () => {
    const a = jumpEnvelope();
    const b = jumpEnvelope(new Set());
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run — FAIL** (`jumpEnvelope` takes no args / double-jump not handled).

Run: `npx vitest run src/levels/reachability.test.ts`
Expected: FAIL — `Expected > ... Received 80.75` (base apex; double-jump not applied) and/or a type error on the argument. If tsc errors on the arg first, that's still RED for the feature.

- [ ] **Step 3: Implement** — make `jumpEnvelope` ability-aware:

```ts
// src/levels/reachability.ts — replace the jumpEnvelope signature + body
import { ABILITIES, type AbilityId } from "../config/abilities";

export function jumpEnvelope(abilities: Set<AbilityId> = new Set()): JumpEnvelope {
  const P = designPhysics();
  const v0 = P.jumpV;
  const vt = P.apexThreshold;

  const baseApex = (v0 * v0 - vt * vt) / (2 * P.gravUp) + (vt * vt) / (2 * P.gravApex);
  const baseTUp = (v0 - vt) / P.gravUp + vt / P.gravApex;

  // Double jump: each extra jump adds a full rise + apex.
  const jumps = 1 + (abilities.has("doubleJump") ? (ABILITIES.doubleJump.envelope?.extraJumps ?? 0) : 0);
  const maxApex = baseApex * jumps;
  const tUp = baseTUp * jumps;

  // Glide (Phase 2): reduced fall gravity lengthens the descent.
  const gravDown = P.gravDown * (abilities.has("glide") ? (ABILITIES.glide.envelope?.fallGravityMult ?? 1) : 1);

  const tDown = Math.sqrt((2 * maxApex) / gravDown);
  const maxFlatGap = P.speed * (tUp + tDown);

  return { maxApex, maxFlatGap, speed: P.speed, tUp, gravDown };
}
```

Then make `checkReachability` pass the abilities through — change its `const env = jumpEnvelope();` to:

```ts
const env = jumpEnvelope(opts.abilities ?? new Set());
```

- [ ] **Step 4: Run — verify the new + ALL existing reachability tests pass**

Run: `npx vitest run src/levels/reachability.test.ts` → PASS (incl. the original base-envelope tests, since empty set = base).

- [ ] **Step 5: Commit**

```bash
git add src/levels/reachability.ts src/levels/reachability.test.ts
git commit -m "feat(powers): jumpEnvelope(abilities) — double jump doubles reach"
```

---

## Task 1.2: Player second jump

**Files:**
- Modify: `src/entities/Player.ts`

> Phaser input + physics make this branch hard to unit-test in isolation; its correctness is proven by the Task 1.8 double-check (the Hallway gate is solvable WITH double jump) plus manual playtest. This is an intentional "no clean seam" — noted in the commit.

- [ ] **Step 1: Add an air-jump counter field** (near the other private fields, ~line 28):

```ts
  private airJumpsUsed = 0;
```

- [ ] **Step 2: Reset it on the ground** — inside `tick`, in the `if (onGround) { ... }` block (~line 95) add:

```ts
    if (onGround) {
      this.coyoteMs = PHYSICS.COYOTE_MS;
      this.airJumpsUsed = 0;
    } else {
```

- [ ] **Step 3: Add the air-jump branch** — after the existing ground-jump block (after line 128, the `if (wantJump) { ... }` block), insert:

```ts
    // Air (double) jump: a second press while airborne, if Teddy's power is unlocked.
    const airJump =
      Phaser.Input.Keyboard.JustDown(this.keyJump) &&
      !onGround &&
      this.coyoteMs <= 0 &&
      GameState.get().hasAbility("doubleJump") &&
      this.airJumpsUsed < (this.scene.registry.get("extraJumps") ?? 1);
    if (airJump) {
      this.body.setVelocityY(PHYSICS.JUMP_VELOCITY);
      this.airJumpsUsed += 1;
      this.bufferMs = 0;
      this.playSquashStretch(0.85, 1.12, 80);
    }
```

> Simpler alternative if you don't want a registry lookup: replace the `?? 1` clause with the literal `1` (single extra jump). Keep it literal for P1 — `ABILITIES.doubleJump.envelope.extraJumps` is the source of truth, wire the registry later if a power ever grants triple-jump.

Use the literal form for now:

```ts
      this.airJumpsUsed < 1;
```

- [ ] **Step 4: Verify build + manual check**

Run: `npm run build` → green.
Manual: `npm run dev`, `eloiseReset()` in console, reach the Bedroom's Teddy, collect her, then confirm a second Space press in mid-air gives a second hop. (Full gate validation is Task 1.8.)

- [ ] **Step 5: Commit**

```bash
git add src/entities/Player.ts
git commit -m "feat(powers): double-jump on the jump button when unlocked (no clean unit seam; verified by Task 1.8 double-check + playtest)"
```

---

## Task 1.3: Companion carries its type + unlock event

**Files:**
- Modify: `src/entities/Companion.ts`

- [ ] **Step 1: Add a `companionType` constructor param**

Change the constructor signature to accept the type and store it:

```ts
import type { CompanionType } from "../design/levelSketches";
import { COMPANIONS } from "../config/companions";
// ...
  private readonly companionType: CompanionType;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    companionType: CompanionType = "teddy",
    idleKey: string = TEDDY_IDLE,
    walkAnimKey: string | null = TEDDY_WALK_ANIM,
  ) {
    super(scene, x, y, idleKey);
    this.companionType = companionType;
    // ...rest unchanged...
  }
```

- [ ] **Step 2: Generalize `collect()` + `configurePickup()`**

```ts
  collect(): void {
    if (this.collected) return;
    this.collected = true;
    GameState.get().collectCompanion(this.companionType);
    this.scene.events.emit("hud-update");
    this.scene.events.emit("companion-collected", { type: this.companionType });
  }
```

In `configurePickup()`, replace `this.collected = state.hasAbility("doubleJump");` with:

```ts
    this.collected = state.hasAbility(COMPANIONS[this.companionType].grants);
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/entities/Companion.ts
git commit -m "feat(powers): Companion carries type; collect() unlocks + emits companion-collected"
```

---

## Task 1.4: Generalize companion spawn in GameScene

**Files:**
- Modify: `src/scenes/GameScene.ts` (the companion block at lines 234-240)

> The level schema currently restricts `companion.type` to `z.literal("teddy")`. Widening it to all `CompanionType`s is part of the foundation; do it in `src/types/level.ts` as part of this task.

- [ ] **Step 1: Widen the companion schema** — in `src/types/level.ts`, change the companion object's `type: z.literal("teddy")` to:

```ts
  type: z.enum(["teddy", "dog", "cat", "horse", "flamingo"]),
```

- [ ] **Step 2: Generalize the GameScene companion spawn** — replace lines ~234-240:

```ts
    if (data.companion) {
      const def = COMPANIONS[data.companion.type];
      const walkAnim = data.companion.type === "teddy" ? TEDDY_WALK_ANIM : null;
      this.companion = new Companion(
        this, data.companion.x, data.companion.y,
        data.companion.type, def.idleKey, walkAnim,
      );
      this.companion.configurePickup(data.companion.x, data.companion.y);
      this.companion.resetHistoryNear(data.spawn.x, data.spawn.y);
    } else {
      this.companion = null;
    }
```

Add the imports at the top of `GameScene.ts`: `import { COMPANIONS } from "../config/companions";` and `import { TEDDY_WALK_ANIM } from "../config/textures";`.

> Only Teddy currently has a walk-anim defined in BootScene; other companions fall back to their idle texture (walkAnim `null`). Each companion's walk anim gets added when its area is built.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → 0 errors. `npm run build` → green (the smoke test confirms companion textures via COMPANIONS).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts src/types/level.ts
git commit -m "feat(powers): GameScene spawns any companion via COMPANIONS table"
```

---

## Task 1.5: PowerUnlockScene (breakaway reveal)

**Files:**
- Create: `src/scenes/PowerUnlockScene.ts`
- Modify: the Phaser game config scene array (find where `MenuScene`, `GameScene`, `UIScene` are registered — likely `src/main.ts`)

> Modeled on `MenuScene` (a full-screen overlay scene with text + input-to-dismiss). It receives `{ type: CompanionType }` via `scene.launch` data.

- [ ] **Step 1: Create the scene**

```ts
// src/scenes/PowerUnlockScene.ts
import Phaser from "phaser";
import { RENDER_SCALE } from "../config/game";
import { COMPANIONS } from "../config/companions";
import { ABILITIES } from "../config/abilities";
import { COMPANION_LABELS, type CompanionType } from "../design/levelSketches";

const S = RENDER_SCALE;

export class PowerUnlockScene extends Phaser.Scene {
  constructor() {
    super({ key: "PowerUnlockScene" });
  }

  create(data: { type: CompanionType }): void {
    const { width, height } = this.scale;
    const def = COMPANIONS[data.type];
    const ability = ABILITIES[def.grants];

    this.add.rectangle(width / 2, height / 2, width, height, 0x2a1020, 0.82).setOrigin(0.5);

    // Companion sprite, big and centered.
    const friend = this.add.sprite(width / 2, height * 0.42, def.idleKey).setOrigin(0.5);
    friend.setScale((0.16 * S) / 1); // larger than in-game; tune to taste
    this.tweens.add({ targets: friend, y: height * 0.40, yoyo: true, repeat: -1, duration: 700, ease: "Sine.easeInOut" });

    this.add.text(width / 2, height * 0.62, `${COMPANION_LABELS[data.type]} joined you!`, {
      fontFamily: "monospace", fontSize: `${12 * S}px`, color: "#ffffff",
      stroke: "#2a1020", strokeThickness: 4 * S,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.72, `New power: ${ability.label.toUpperCase()}!`, {
      fontFamily: "monospace", fontSize: `${14 * S}px`, color: "#ff1493",
      stroke: "#fff8f0", strokeThickness: 3 * S,
    }).setOrigin(0.5);

    this.add.text(width / 2, height - 16 * S, "press any key", {
      fontFamily: "monospace", fontSize: `${8 * S}px`, color: "#ccb8c8",
    }).setOrigin(0.5, 1);

    const dismiss = () => this.events.emit("power-unlock-dismissed");
    this.input.keyboard?.once("keydown", dismiss);
    this.input.once("pointerdown", dismiss);
  }
}
```

- [ ] **Step 2: Register the scene** — add `PowerUnlockScene` to the Phaser config's `scene: [...]` array (alongside `MenuScene`/`GameScene`/`UIScene`). Find it: `grep -rn "GameScene" src/main.ts src/*.ts`.

- [ ] **Step 3: Verify build**

Run: `npm run build` → green.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/PowerUnlockScene.ts src/main.ts
git commit -m "feat(powers): PowerUnlockScene breakaway reveal screen"
```

---

## Task 1.6: Wire the gate moment in GameScene

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Listen for the unlock + show the reveal** — in `GameScene.create()`, alongside the other `this.events.on(...)` handlers (~line 69), add:

```ts
    this.events.on("companion-collected", (info: { type: CompanionType }) => {
      this.physics.world.pause();
      const reveal = this.scene.get("PowerUnlockScene");
      reveal.events.once("power-unlock-dismissed", () => {
        this.scene.stop("PowerUnlockScene");
        this.physics.world.resume();
        this.game.canvas?.focus();
      });
      this.scene.launch("PowerUnlockScene", { type: info.type });
    });
```

Add `import type { CompanionType } from "../design/levelSketches";` at the top.

- [ ] **Step 2: Verify build + manual gate test**

Run: `npm run build` → green.
Manual: `npm run dev`, `eloiseReset()`, play to Teddy, collect → the reveal screen appears, dismiss → Teddy follows. Then double-jump works.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat(powers): gate moment — collecting a companion shows the reveal screen"
```

---

## Task 1.7: Author the Hallway gate level (the real lock)

**Files:**
- Create or replace: `src/levels/hallwayLevels.ts` (the existing stub is in the wrong coord space — replace it)
- Modify: `src/levels/levelCatalog.ts` (add a `hallway` entry with `areaId: "hallway"`)

> Goal: one Hallway level whose exit is reachable **with** double jump (apex ~161px) but **not** without (base apex ~81px). Concretely: a gap or a ledge that needs the bigger envelope. Author it with the existing `encodeFromSketch` pipeline so it's Zod-valid and the lint sees it.

- [ ] **Step 1: Define a minimal Hallway gate sketch + encode it.** Create `hallwayLevels.ts` exporting one `LevelData`-shaped level (via `encodeSlotToLevelData` or a hand-built sketch). The defining feature: a floating platform whose top is **~120px above the floor** (between base apex 81 and double-jump apex 161) holding the exit — reachable only with double jump. Include Teddy? No — Teddy is in the Bedroom; the Hallway has the **Dog** companion at its end (grants Dash, P3). For P1, the Hallway gate just needs the double-jump-required geometry + an exit; the Dog companion can be added in P3. Set `companion: undefined` for now.

Minimal hand-built example (design-px; floor at `DESIGN_FLOOR_Y = 168`):

```ts
// src/levels/hallwayLevels.ts
import type { LevelData } from "../types/level";

const FLOOR_Y = 168;

// A ledge 120px above the floor — past base apex (~81px), within double-jump apex (~161px).
export const HALLWAY_LEVELS: LevelData[] = [
  {
    id: "hallway-1",
    name: "Hallway — First Leap",
    spawn: { x: 24, y: FLOOR_Y },
    killY: 240,
    bounds: { minX: 0, maxX: 320, minY: -160, maxY: 200 },
    platforms: [
      { x: 0, y: FLOOR_Y, w: 120, h: 32, color: "#d4a574" },     // start floor
      { x: 150, y: FLOOR_Y - 120, w: 90, h: 14, color: "#e8c9a0" }, // high ledge (needs double jump)
      { x: 250, y: FLOOR_Y, w: 70, h: 32, color: "#d4a574" },     // landing floor
    ],
    enemies: [],
    tokens: [],
    exit: { x: 285, y: FLOOR_Y - 52 + 4, w: 40, h: 52 },
  },
];
```

> The high ledge bridges start-floor → landing-floor: at base apex (~81px) the ledge top (120px up) is unreachable, splitting the level; with double jump (~161px) it's reachable. Tune the `120` if Task 1.8's two assertions don't both hold — that tuning IS the design conversation, now mechanized.

- [ ] **Step 2: Add the Hallway entry to the catalog** — in `levelCatalog.ts`:

```ts
import { HALLWAY_LEVELS } from "./hallwayLevels";
// ...
const HALLWAY_ENTRIES: LevelCatalogEntry[] = HALLWAY_LEVELS.map((level, index) => ({
  areaId: "hallway",
  backgroundKey: `bg_blueprint_h_${index}`,
  backgroundUrl: PLACEHOLDER_BG.url,
  raw: level as unknown as LevelData,
}));

export const LEVEL_CATALOG: LevelCatalogEntry[] = [...BEDROOM_ENTRIES, ...HALLWAY_ENTRIES];
```

- [ ] **Step 3: Verify the catalog still boots**

Run: `npx vitest run src/levels/levelCatalog.smoke.test.ts` → PASS (Zod-valid, textures fine).

- [ ] **Step 4: Commit**

```bash
git add src/levels/hallwayLevels.ts src/levels/levelCatalog.ts
git commit -m "feat(powers): Hallway gate level — exit needs double jump"
```

---

## Task 1.8: Prove the gate is real (the payoff)

**Files:**
- Modify: `src/levels/reachability.integration.test.ts` (already drives the double-check from Task 0.6)

- [ ] **Step 1: Run the existing area-driven double-check against the new Hallway**

Run: `npx vitest run src/levels/reachability.integration.test.ts`

Expected, automatically (no new test code — Task 0.6's loops now cover `hallway-1`):
- "solvable WITH doubleJump" → **PASS** for `hallway-1` (double-jump envelope reaches the ledge).
- "NOT solvable without doubleJump" → **PASS** for `hallway-1` (base envelope can't reach the 120px ledge → exit unreachable → error present).

- [ ] **Step 2: If either assertion fails, tune the ledge height in `hallwayLevels.ts`**

- Ledge reachable without double jump (≤ ~81px up) → raise it (toward 120-140).
- Ledge unreachable even WITH double jump (> ~161px up) → lower it.
Re-run until both hold. This is the lock-and-key fitting, mechanized.

- [ ] **Step 3: Full slice gate**

Run: `npm run build`
Expected: `tsc` clean, all tests pass (including both double-check directions for the Hallway), vite build succeeds.

- [ ] **Step 4: Manual playtest the whole slice**

`npm run dev`, `eloiseReset()`: play Bedroom → collect Teddy → reveal screen → Teddy follows → Hallway → clear the gate with a double jump. Confirm it *feels* right (OQ1: if the double jump feels too floaty/weak, adjust `JUMP_VELOCITY` use in the air-jump or revisit constants — but re-run `npm run build` so the envelope tests + double-check re-validate every level).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(powers): Phase 1 complete — double-jump slice, Hallway gate proven real"
```

**Phase 1 complete: the first power, end-to-end, with a build-time proof that the Hallway needs it.**

---

# Future Phases (own plans when their slice begins)

These are captured as contracts in the spec (`2026-05-30-power-system-design.md` §5.2, §8). Each becomes its own `docs/superpowers/plans/` file when started — detailing their not-yet-validated mechanics now would be planning speculation. The foundation above makes each one additive: a data row + a Player mechanic + (for traversal) a reachability edge-type. **Every phase ends with `npm run build` green, which re-runs the double-check over all levels — a fresh session knows instantly if it broke anything.**

- **P2 — Glide + the power button.** Envelope power #2 (`jumpEnvelope` glide branch already scaffolded in Task 1.1). Build the **one-button power input + `resolveActivePower(state, abilities)` dispatch** (spec §6.1) — Glide is the first `control:"power"` ability (hold while airborne & descending). Add a glide gate gap; double-check proves it.
- **P3 — Dash** (traversal). New `requires:"dash"` gap edge in reachability (spec §5.2); dash burst on the power dispatcher; gates the Kitchen. Write `2026-XX-XX-power-dash.md` sub-spec + plan.
- **P4 — Wall-Climb** (traversal). `climbWall` element + conditional edge; climb state; gates the Family Room.
- **P5 — Charge + breakable terrain** (traversal). `breakable` element + edge-blocker; charge mechanic; gates the Living Room.

---

## Self-Review Notes (author)

- **Spec coverage:** §4 data model → Tasks 0.1-0.5; §4.3 gating → 0.4; §4.4 schema widening → 1.4 step 1 (full `requires` + Zod ordering `.refine` for traversal elements arrives with P3, the first traversal power — noted, not a P1 gap); §5.1 envelope → 1.1; §5.3 double-check → 0.6 + 1.8; §6.1 power button → P2 (correct, first power-button ability is Glide); §6.2 reveal → 1.5; §6.3 gate flow → 1.6; §7 invariants → enforced by tests in 0.4/0.6/1.8.
- **Deferred deliberately:** the Zod `.refine` ordering invariant (§4.4) and `requires` field land with P3 (first traversal power to use them) — P1's double-jump gating is geometric, needs no tags. Flagged so it isn't mistaken for an omission.
- **Type consistency:** `AbilityId`, `CompanionType` (reused from `levelSketches`), `AreaId`, `COMPANIONS`, `ABILITIES`, `abilitiesForArea`, `gatingPower`, `collectCompanion`, `hasAbility`, `jumpEnvelope(abilities)`, `companion-collected`/`power-unlock-dismissed` events — consistent across tasks.
