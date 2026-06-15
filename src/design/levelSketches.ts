/**
 * Bedroom area — level sketches organized by *slot*. Each slot holds 1-N
 * variant *options* drawn from established platformer level-design patterns
 * (GMTK breakdowns, Kishōtenketsu, Dan Taylor's "Ten Principles", Anthropy's
 * "Game Design Vocabulary", Yoshi's Island / Mario 1-1 / Celeste analysis).
 *
 * Pattern legend (cited in `source` per option):
 *   1. Friendly Runway   — empty floor at level start
 *   2. Gentle Staircase  — ascending 1-up, 1-across platforms
 *   3. Token Breadcrumb  — coins trace the jump arc
 *   4. Safe Stomp Intro  — first enemy on flat with runway both sides
 *   5. Risk-Reward Branch — visible low (safe) vs. high (rewarding) routes
 *   6. Foreshadow / Pay-off — show idea safely, recombine later
 *   7. Kishōtenketsu spine — intro / develop / twist / conclude (whole-level)
 *   8. 3-Square Trust Gap — first real pit, well inside jump envelope (3 cells = 96px, vs max ~120px)
 *   9. Hidden Token       — visible from below, requires small extra effort
 *  10. Backtrack Token    — see on way past, requires going back
 *  11. Rest Beat          — flat empty stretch after intensity peak
 *  12. False Summit       — looks like end, more level after
 *  13. Stomp Patroller Gate — bunny on 4-wide raised platform, no pit below
 *  14. Companion Beacon   — Teddy on distinctive platform near level end
 *  15. Victory Coda       — flat coda + token row before exit
 *
 * Coordinate units: sketch grid squares = 32 design-px ≈ Eloise body height.
 */

export type SketchPlatform = {
  x: number;
  y: number;
  w: number;
  /** Marks this platform as the far side of a DASH gap. Reachability grants the
   *  crossing only when dash is unlocked and the gap is flat/downhill and within
   *  the dash lunge. Author the launch surface and this platform > double-jump
   *  flat reach apart (so only dash reaches it). */
  requires?: "dash";
};

export type SketchZone = {
  x: number;
  y: number;
  kind: "token" | "enemy" | "companion";
  label?: string;
  /** Carryover: for `kind:"enemy"` zones, spawn this enemy type instead of the
   *  area's `primaryEnemy`. Lets a level mix returning foes (e.g. a Hallway
   *  spider in the Family Room) with the area's own enemy. Ignored for other
   *  kinds. `"trex"` is rejected by the encoder (the boss is a set-piece). */
  enemyType?: EnemyType;
};

export type SketchPit = {
  /** Left edge of pit in grid units (a break in the floor). */
  x: number;
  /** Width of pit in grid units. Player must jump over. */
  w: number;
};

export type SketchClimbWall = {
  /** Left grid column of the climbable wall (usually a counter's near edge). */
  x: number;
  /** Base height in grids (0 = floor). */
  y: number;
  /** Height in grids. Use counterHeightGrids + 1 so the span covers the floor
   *  top AND the counter top (reachability connects surfaces that both touch it). */
  h: number;
  /** Width in grids; defaults to 1 (a thin face). */
  w?: number;
};

export type SketchBreakable = {
  /** Left grid column of the barricade. */
  x: number;
  /** Base height in grids (0 = rooted at the floor). */
  y: number;
  /** Width in grids. */
  w: number;
  /** Height in grids. Author ≥ 6 (above the ~5-grid double-jump apex) so the
   *  barricade is honestly unjumpable and must be smashed with charge. */
  h: number;
};

export type LevelOption = {
  variant: string;
  source: string;
  note?: string;
  approxSeconds: number;
  widthGrids: number;
  heightGrids: number;
  spawn: { x: number; y: number };
  exit: { x: number; y: number };
  platforms: SketchPlatform[];
  zones: SketchZone[];
  /** Floor gaps. Slots 1-3 are pit-free per kids' design research. */
  pits?: SketchPit[];
  /** Vertical climbable faces (wall-climb element). Counters in the Kitchen. */
  climbWalls?: SketchClimbWall[];
  /** Solid charge barricades (the Backyard hedge/fence gate). Each blocks the
   *  doorway between the surfaces it sits between until charge clears it. */
  breakables?: SketchBreakable[];
};

export type LevelSlot = {
  id: number;
  name: string;
  intent: string;
  options: LevelOption[];
};

// ─────────────────────────────────────────────────────────────────────────
// Game-wide structure: 6 areas, 5 companions, 4 enemy types, 1 boss.
// ─────────────────────────────────────────────────────────────────────────

export type EnemyType = "dust_bunny" | "spider" | "ant" | "dust_mite" | "trex";
export type CompanionType = "teddy" | "dog" | "cat" | "horse" | "flamingo";

export const ENEMY_LABELS: Record<EnemyType, string> = {
  dust_bunny: "dust bunny",
  spider: "spider",
  ant: "ant",
  dust_mite: "dust mite",
  trex: "T-Rex",
};

export const COMPANION_LABELS: Record<CompanionType, string> = {
  teddy: "Teddy",
  dog: "Dog",
  cat: "Cat",
  horse: "Horse",
  flamingo: "Flamingo",
};

/** Per-companion fill colors so multi-companion views read at a glance. */
export const COMPANION_COLORS: Record<CompanionType, string> = {
  teddy: "#ff8fa3", // pink (Eloise's first friend — original color)
  dog: "#f5f0e1",   // cream (Dalmatian body white)
  cat: "#f8f8f8",   // soft white (with pink bow accent in art)
  horse: "#a87144", // saddle brown
  flamingo: "#ff5a8c", // hot pink
};

export type Area = {
  id: number;
  name: string;
  /** Matches the asset directory name (e.g., "World1_Bedroom"). */
  worldKey: string;
  intent: string;
  /** Companion picked up in this area. Null for boss arena. */
  companion: CompanionType | null;
  /** New enemy introduced this area. */
  primaryEnemy: EnemyType;
  /** Enemies from prior areas that return as obstacles. */
  carryOverEnemies: EnemyType[];
  /** True if this is the T-Rex arena (single set-piece, not 5-slot structure). */
  isBoss?: boolean;
  slots: LevelSlot[];
};

export const BEDROOM_SLOTS: LevelSlot[] = [
  // ─────────────────────────────────────────────────────────────────────
  // SLOT 1 — Tutorial
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Bookshelf Lower",
    intent: "Tutorial. Walking + first easy jumps. No enemies, no pits.",
    options: [
      {
        variant: "A",
        source: "Mario 1-1 / GMTK: Runway → Staircase → Breadcrumb → Coda",
        note: "Research-recommended. Pure tutorial — every pattern stays inside the easy envelope.",
        approxSeconds: 28,
        widthGrids: 22,
        heightGrids: 4,
        spawn: { x: 1, y: 0 },
        exit: { x: 21, y: 0 },
        platforms: [
          { x: 8, y: 1, w: 2 },
          { x: 11, y: 2, w: 2 },
          { x: 14, y: 3, w: 2 },
        ],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 6, y: 1, kind: "token" },
          { x: 7, y: 2, kind: "token" },
          { x: 15, y: 4, kind: "token" },
          { x: 18, y: 0, kind: "token" },
          { x: 19, y: 0, kind: "token" },
        ],
      },
      {
        variant: "B",
        source: "Pattern 1 + 15 only — extreme gentle",
        note: "For very-young first play. One trivial hop, mostly walking with token rewards.",
        approxSeconds: 22,
        widthGrids: 18,
        heightGrids: 3,
        spawn: { x: 1, y: 0 },
        exit: { x: 17, y: 0 },
        platforms: [{ x: 8, y: 1, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 0, kind: "token" },
          { x: 9, y: 2, kind: "token" },
          { x: 13, y: 0, kind: "token" },
          { x: 15, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Patterns 1 + 2 + 11 + 15 — climb-and-descend with rest beat",
        note: "Slightly longer with a peak plateau and descending staircase. For 6-8 yo confidence.",
        approxSeconds: 35,
        widthGrids: 26,
        heightGrids: 5,
        spawn: { x: 1, y: 0 },
        exit: { x: 25, y: 0 },
        platforms: [
          { x: 5, y: 1, w: 2 },
          { x: 8, y: 2, w: 2 },
          { x: 11, y: 3, w: 2 },
          { x: 14, y: 3, w: 3 },
          { x: 19, y: 2, w: 2 },
          { x: 22, y: 1, w: 2 },
        ],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 2, kind: "token" },
          { x: 12, y: 4, kind: "token" },
          { x: 15, y: 5, kind: "token" },
          { x: 20, y: 3, kind: "token" },
          { x: 23, y: 0, kind: "token" },
          { x: 24, y: 0, kind: "token" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // SLOT 2 — First Friend (introduce dust bunny)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 2,
    name: "Bookshelf Climb",
    intent: "Introduce dust bunny stomping. Wide runway, no pits.",
    options: [
      {
        variant: "A",
        source: "Mario 1-1 first Goomba: Runway → Safe Stomp → Rest → Staircase → Coda",
        note: "Research-recommended. Bunny appears on flat with empty space both sides — kid has time to read it.",
        approxSeconds: 50,
        widthGrids: 26,
        heightGrids: 4,
        spawn: { x: 1, y: 0 },
        exit: { x: 25, y: 0 },
        platforms: [
          { x: 15, y: 1, w: 2 },
          { x: 18, y: 2, w: 2 },
          { x: 21, y: 3, w: 2 },
        ],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 9, y: 0, kind: "enemy", label: "first stomp" },
          { x: 12, y: 0, kind: "token" },
          { x: 16, y: 2, kind: "token" },
          { x: 19, y: 3, kind: "token" },
          { x: 22, y: 4, kind: "token" },
          { x: 24, y: 0, kind: "token" },
        ],
      },
      {
        variant: "B",
        source: "Pattern 4 × 2 — Stomp Gauntlet (mostly flat)",
        note: "Two dust bunnies on the floor with runway between. For kids who like enemies more than climbing.",
        approxSeconds: 45,
        widthGrids: 24,
        heightGrids: 3,
        spawn: { x: 1, y: 0 },
        exit: { x: 23, y: 0 },
        platforms: [
          { x: 11, y: 1, w: 3 },
          { x: 17, y: 1, w: 3 },
        ],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 8, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 12, y: 2, kind: "token" },
          { x: 15, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 18, y: 2, kind: "token" },
          { x: 21, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Patterns 2 + 13 — Climb past patrol (vertical-heavy)",
        note: "Bunny patrols the floor as Eloise climbs above. Optional stomp on descent.",
        approxSeconds: 55,
        widthGrids: 24,
        heightGrids: 5,
        spawn: { x: 1, y: 0 },
        exit: { x: 23, y: 0 },
        platforms: [
          { x: 4, y: 1, w: 2 },
          { x: 7, y: 2, w: 2 },
          { x: 10, y: 3, w: 2 },
          { x: 13, y: 4, w: 4 },
          { x: 18, y: 2, w: 2 },
          { x: 20, y: 1, w: 2 },
        ],
        zones: [
          { x: 5, y: 2, kind: "token" },
          { x: 8, y: 3, kind: "token" },
          { x: 11, y: 4, kind: "token" },
          { x: 14, y: 5, kind: "token" },
          { x: 16, y: 0, kind: "enemy", label: "patrol" },
          { x: 22, y: 0, kind: "token" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // SLOT 3 — Branching paths (no pits yet)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 3,
    name: "Crib Crossing",
    intent: "Introduce player agency: visible low (safe) and high (rewarding) routes.",
    options: [
      {
        variant: "A",
        source: "Dan Taylor 'Risk = Reward' + Pattern 9 (Hidden Token)",
        note: "Research-recommended. Low path has 1 token + 2 enemies. High path has 3 tokens + 1 hidden.",
        approxSeconds: 65,
        widthGrids: 26,
        heightGrids: 5,
        spawn: { x: 1, y: 0 },
        exit: { x: 25, y: 0 },
        platforms: [
          { x: 4, y: 1, w: 2 },
          { x: 6, y: 3, w: 2 },
          { x: 9, y: 4, w: 8 },
          { x: 18, y: 3, w: 2 },
          { x: 21, y: 1, w: 2 },
        ],
        zones: [
          { x: 12, y: 0, kind: "token", label: "low" },
          { x: 10, y: 5, kind: "token", label: "high" },
          { x: 13, y: 5, kind: "token", label: "high" },
          { x: 16, y: 5, kind: "token", label: "hidden" },
          { x: 8, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 17, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 24, y: 0, kind: "token" },
        ],
      },
      {
        variant: "B",
        source: "Pattern 5 simplified — Hill vs. valley",
        note: "Gentler branching. Mid-height hill with 2 tokens; low has 1 enemy. Easier choice to read.",
        approxSeconds: 50,
        widthGrids: 22,
        heightGrids: 3,
        spawn: { x: 1, y: 0 },
        exit: { x: 21, y: 0 },
        platforms: [
          { x: 4, y: 1, w: 2 },
          { x: 6, y: 2, w: 8 },
          { x: 14, y: 1, w: 2 },
        ],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 8, y: 3, kind: "token", label: "high" },
          { x: 11, y: 3, kind: "token", label: "high" },
          { x: 12, y: 0, kind: "token", label: "low" },
          { x: 13, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 19, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 5 expanded — Three-route variety",
        note: "Floor / mid / high routes with connectors. More replayability, more visual complexity.",
        approxSeconds: 75,
        widthGrids: 28,
        heightGrids: 6,
        spawn: { x: 1, y: 0 },
        exit: { x: 27, y: 0 },
        platforms: [
          { x: 4, y: 1, w: 1 },
          { x: 6, y: 2, w: 10 },
          { x: 16, y: 1, w: 1 },
          { x: 3, y: 4, w: 2 },
          { x: 8, y: 5, w: 6 },
          { x: 17, y: 4, w: 2 },
          { x: 20, y: 2, w: 2 },
        ],
        zones: [
          { x: 10, y: 0, kind: "token", label: "low" },
          { x: 10, y: 3, kind: "token", label: "mid" },
          { x: 13, y: 3, kind: "token", label: "mid" },
          { x: 9, y: 6, kind: "token", label: "high" },
          { x: 12, y: 6, kind: "token", label: "high" },
          { x: 8, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 15, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 25, y: 0, kind: "token" },
          { x: 26, y: 0, kind: "token" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // SLOT 4 — First real pit (Kishōtenketsu spine)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 4,
    name: "Eloise Corner",
    intent: "First pit (the 3-square Trust Gap). Foreshadow + Stomp Patroller Gate.",
    options: [
      {
        variant: "A",
        source: "GMTK Kishōtenketsu + Anthropy 'rhyming' (Foreshadow → Trust Gap → Payoff)",
        note: "Research-recommended. Setup platform shape early (no enemy) — same shape returns later WITH bunny.",
        approxSeconds: 75,
        widthGrids: 28,
        heightGrids: 4,
        spawn: { x: 1, y: 0 },
        exit: { x: 27, y: 0 },
        platforms: [
          { x: 6, y: 1, w: 4 },
          { x: 18, y: 1, w: 4 },
        ],
        pits: [{ x: 12, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 7, y: 2, kind: "token", label: "setup" },
          { x: 13, y: 1, kind: "token", label: "breadcrumb" },
          { x: 19, y: 2, kind: "token", label: "payoff" },
          { x: 20, y: 1, kind: "enemy", label: "patrol" },
          { x: 25, y: 0, kind: "token" },
          { x: 26, y: 0, kind: "token" },
        ],
      },
      {
        variant: "B",
        source: "Pattern 8 × 3 — Pit gauntlet",
        note: "Pits ARE the hazard. No enemies. Safe perches between. Pure jump confidence.",
        approxSeconds: 55,
        widthGrids: 24,
        heightGrids: 3,
        spawn: { x: 1, y: 0 },
        exit: { x: 23, y: 0 },
        platforms: [{ x: 11, y: 2, w: 2 }],
        pits: [
          { x: 5, w: 3 },
          { x: 15, w: 3 },
          { x: 19, w: 2 },
        ],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 1, kind: "token", label: "breadcrumb" },
          { x: 12, y: 3, kind: "token" },
          { x: 16, y: 1, kind: "token", label: "breadcrumb" },
          { x: 21, y: 0, kind: "token" },
          { x: 22, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Patterns 2 + 8 — Vertical climb with single trust gap",
        note: "Climbing-focused. One pit punctuates the descent. Bunny on far side of pit.",
        approxSeconds: 65,
        widthGrids: 24,
        heightGrids: 5,
        spawn: { x: 1, y: 0 },
        exit: { x: 23, y: 0 },
        platforms: [
          { x: 4, y: 1, w: 2 },
          { x: 7, y: 2, w: 2 },
          { x: 10, y: 3, w: 2 },
          { x: 13, y: 4, w: 3 },
        ],
        pits: [{ x: 18, w: 3 }],
        zones: [
          { x: 5, y: 2, kind: "token" },
          { x: 8, y: 3, kind: "token" },
          { x: 11, y: 4, kind: "token" },
          { x: 14, y: 5, kind: "token" },
          { x: 19, y: 1, kind: "token", label: "breadcrumb" },
          { x: 16, y: 0, kind: "enemy", label: "across pit" },
          { x: 22, y: 0, kind: "token" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // SLOT 5 — Finale (Teddy)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    name: "Eloise's Corner (Finale)",
    intent: "Climax. Combine prior beats; earn Teddy.",
    options: [
      {
        variant: "A",
        source: "Full Kishōtenketsu + False Summit + Backtrack + Companion Beacon",
        note: "Research-recommended. ~30 grids. Backtrack token = visible on way past, climb back to grab.",
        approxSeconds: 100,
        widthGrids: 32,
        heightGrids: 6,
        spawn: { x: 1, y: 0 },
        exit: { x: 31, y: 0 },
        platforms: [
          { x: 4, y: 1, w: 2 },
          { x: 11, y: 1, w: 2 },
          { x: 14, y: 2, w: 2 },
          { x: 17, y: 3, w: 2 },
          { x: 19, y: 4, w: 3 },
          { x: 24, y: 1, w: 3 },
          { x: 9, y: 4, w: 2 },
          { x: 27, y: 1, w: 4 },
        ],
        pits: [
          { x: 7, w: 3 },
          { x: 22, w: 3 },
        ],
        zones: [
          { x: 5, y: 2, kind: "token" },
          { x: 9, y: 5, kind: "token", label: "backtrack" },
          { x: 12, y: 2, kind: "token", label: "breadcrumb" },
          { x: 20, y: 5, kind: "token", label: "false summit" },
          { x: 21, y: 5, kind: "token", label: "false summit" },
          { x: 14, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 25, y: 2, kind: "token" },
          { x: 28, y: 2, kind: "token", label: "halo" },
          { x: 30, y: 2, kind: "token", label: "halo" },
          { x: 25, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 29, y: 2, kind: "companion", label: "Teddy" },
        ],
      },
      {
        variant: "B",
        source: "Patterns 11 + 14 — Long victory lap",
        note: "Chill, exploration-flavored finale. Less peak intensity, more length and tokens.",
        approxSeconds: 90,
        widthGrids: 30,
        heightGrids: 5,
        spawn: { x: 1, y: 0 },
        exit: { x: 29, y: 0 },
        platforms: [
          { x: 5, y: 1, w: 2 },
          { x: 8, y: 2, w: 2 },
          { x: 11, y: 3, w: 4 },
          { x: 17, y: 2, w: 3 },
          { x: 21, y: 1, w: 2 },
          { x: 25, y: 1, w: 3 },
        ],
        pits: [{ x: 16, w: 1 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 2, kind: "token" },
          { x: 9, y: 3, kind: "token" },
          { x: 12, y: 4, kind: "token" },
          { x: 13, y: 4, kind: "token" },
          { x: 18, y: 3, kind: "token" },
          { x: 22, y: 2, kind: "token" },
          { x: 26, y: 2, kind: "token", label: "halo" },
          { x: 27, y: 2, kind: "token", label: "halo" },
          { x: 14, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 22, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 26, y: 1, kind: "companion", label: "Teddy" },
        ],
      },
      {
        variant: "C",
        source: "Patterns 2 + 8 + 14 — Bookend reprise (echoes level 1)",
        note: "Opening section recalls slot 1 staircase; builds to bigger climb + pit + Teddy. Narrative full-circle.",
        approxSeconds: 95,
        widthGrids: 30,
        heightGrids: 6,
        spawn: { x: 1, y: 0 },
        exit: { x: 29, y: 0 },
        platforms: [
          { x: 4, y: 1, w: 2 },
          { x: 7, y: 2, w: 2 },
          { x: 10, y: 3, w: 2 },
          { x: 13, y: 4, w: 3 },
          { x: 20, y: 3, w: 2 },
          { x: 22, y: 2, w: 2 },
          { x: 25, y: 1, w: 4 },
        ],
        pits: [{ x: 17, w: 3 }],
        zones: [
          { x: 5, y: 2, kind: "token", label: "reprise" },
          { x: 8, y: 3, kind: "token", label: "reprise" },
          { x: 11, y: 4, kind: "token" },
          { x: 14, y: 5, kind: "token" },
          { x: 18, y: 4, kind: "token", label: "breadcrumb" },
          { x: 21, y: 4, kind: "token" },
          { x: 23, y: 3, kind: "token" },
          { x: 26, y: 2, kind: "token", label: "halo" },
          { x: 28, y: 2, kind: "token", label: "halo" },
          { x: 15, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 22, y: 0, kind: "enemy", label: "dust bunny" },
          { x: 27, y: 1, kind: "companion", label: "Teddy" },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Area definitions. All five playable areas (Bedroom → Backyard) are now fully
// authored with 15 variants each; the Playhouse is the boss arena (single
// inline set-piece slot). The old `stubSlots` scaffolding was retired once the
// Backyard was authored — it has no remaining consumers.
// ─────────────────────────────────────────────────────────────────────────

export const BEDROOM_AREA: Area = {
  id: 1,
  name: "Bedroom",
  worldKey: "World1_Bedroom",
  intent: "Tutorial area. Walking, jumping, first enemies. Earn Teddy.",
  companion: "teddy",
  primaryEnemy: "dust_bunny",
  carryOverEnemies: [],
  slots: BEDROOM_SLOTS,
};

export const HALLWAY_SLOTS: LevelSlot[] = [
  {
    id: 1,
    name: "Hallway Runway",
    intent: "Re-establish the room. Walking + reintroduce the double-jump as an optional reward.",
    options: [
      {
        variant: "B",
        source: "Pattern 1 + 15 — extreme gentle warmup",
        note: "Mostly walking with token rewards. One trivial hop.",
        approxSeconds: 22, widthGrids: 18, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 17, y: 0 },
        platforms: [{ x: 8, y: 1, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 6, y: 0, kind: "token" },
          { x: 9, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
          { x: 15, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 1 + 2 + 9 (Hidden Token) — double-jump reward shelf",
        note: "Base path is flat. A token shelf at y=4 is reachable ONLY by double-jumping off the y=1 platform (optional).",
        approxSeconds: 30, widthGrids: 22, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [
          { x: 7, y: 1, w: 2 },
          { x: 13, y: 1, w: 2 },
        ],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 8, y: 4, kind: "token", label: "double-jump reward" },
          { x: 14, y: 4, kind: "token", label: "double-jump reward" },
          { x: 18, y: 0, kind: "token" }, { x: 19, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 2 + 11 — staircase + rest beat",
        note: "Gentle ascending staircase then a flat coda.",
        approxSeconds: 28, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [
          { x: 5, y: 1, w: 2 }, { x: 8, y: 2, w: 2 }, { x: 11, y: 3, w: 3 },
        ],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 6, y: 2, kind: "token" },
          { x: 12, y: 4, kind: "token" }, { x: 17, y: 0, kind: "token" },
        ],
      },
    ],
  },
  {
    id: 2, name: "First Spider",
    intent: "Introduce spider stomping. Wide runway, no pits.",
    options: [
      {
        variant: "B",
        source: "Pattern 4 — single safe stomp",
        note: "One spider on flat floor, runway both sides. Reads clearly.",
        approxSeconds: 24, widthGrids: 20, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 12, y: 1, w: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 9, y: 0, kind: "enemy", label: "first spider" },
          { x: 13, y: 2, kind: "token" },
          { x: 16, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 4 + 9 — stomp + double-jump token perch",
        note: "Spider on the floor; a token perch at y=4 above it is double-jump-only (optional).",
        approxSeconds: 34, widthGrids: 24, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 23, y: 0 },
        platforms: [
          { x: 10, y: 1, w: 2 }, { x: 16, y: 1, w: 2 },
        ],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 8, y: 0, kind: "enemy", label: "spider" },
          { x: 11, y: 4, kind: "token", label: "double-jump perch" },
          { x: 14, y: 0, kind: "enemy", label: "spider" },
          { x: 20, y: 0, kind: "token" }, { x: 21, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 13 — climb past a patrolling spider",
        note: "Spider patrols the floor while Eloise climbs a staircase above.",
        approxSeconds: 36, widthGrids: 22, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [
          { x: 4, y: 1, w: 2 }, { x: 7, y: 2, w: 2 }, { x: 10, y: 3, w: 3 }, { x: 16, y: 1, w: 2 },
        ],
        zones: [
          { x: 5, y: 2, kind: "token" }, { x: 8, y: 3, kind: "token" }, { x: 11, y: 4, kind: "token" },
          { x: 14, y: 0, kind: "enemy", label: "patrol" },
          { x: 19, y: 0, kind: "token" },
        ],
      },
    ],
  },
  {
    id: 3, name: "Branching",
    intent: "Low (safe) and high (double-jump-gated, rewarding) routes.",
    options: [
      {
        variant: "B",
        source: "Pattern 5 simplified — hill vs valley",
        note: "Low floor route safe; a mid hill (y=2) holds extra tokens, reached by one base jump.",
        approxSeconds: 30, widthGrids: 22, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [{ x: 6, y: 1, w: 2 }, { x: 9, y: 2, w: 6 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 11, y: 3, kind: "token", label: "high" }, { x: 12, y: 3, kind: "token", label: "high" },
          { x: 13, y: 0, kind: "enemy", label: "spider" },
          { x: 18, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Dan Taylor 'Risk = Reward' — high route is double-jump-only",
        note: "Low route: floor, 1 token, 1 spider. High route: a y=4 ledge reachable ONLY by double-jump, carrying 3 tokens.",
        approxSeconds: 40, widthGrids: 26, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 25, y: 0 },
        platforms: [
          { x: 6, y: 1, w: 2 },
          { x: 9, y: 4, w: 6 },
          { x: 18, y: 1, w: 2 },
        ],
        zones: [
          { x: 12, y: 0, kind: "token", label: "low" },
          { x: 10, y: 5, kind: "token", label: "high" }, { x: 12, y: 5, kind: "token", label: "high" },
          { x: 14, y: 5, kind: "token", label: "high" },
          { x: 8, y: 0, kind: "enemy", label: "spider" },
          { x: 23, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 5 expanded — three routes",
        note: "Floor / mid / high. High requires double-jump. More replayability.",
        approxSeconds: 44, widthGrids: 28, heightGrids: 6,
        spawn: { x: 1, y: 0 }, exit: { x: 27, y: 0 },
        platforms: [
          { x: 6, y: 2, w: 8 }, { x: 16, y: 1, w: 1 },
          { x: 8, y: 5, w: 6 }, { x: 20, y: 2, w: 2 },
        ],
        zones: [
          { x: 10, y: 0, kind: "token", label: "low" },
          { x: 9, y: 3, kind: "token", label: "mid" }, { x: 12, y: 3, kind: "token", label: "mid" },
          { x: 9, y: 6, kind: "token", label: "high" }, { x: 12, y: 6, kind: "token", label: "high" },
          { x: 8, y: 0, kind: "enemy", label: "spider" }, { x: 15, y: 0, kind: "enemy", label: "spider" },
          { x: 25, y: 0, kind: "token" },
        ],
      },
    ],
  },
  {
    id: 4, name: "Trust Gap",
    intent: "First MANDATORY double-jump — a lethal gap over a pit. Spiders return.",
    options: [
      {
        variant: "B",
        source: "Pattern 11 — rest beat warmup (no gate)",
        note: "Flat breather before the gauntlet. No mandatory double-jump here.",
        approxSeconds: 18, widthGrids: 14, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 13, y: 0 },
        platforms: [{ x: 6, y: 1, w: 2 }],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 7, y: 2, kind: "token" }, { x: 11, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 8 — MANDATORY double-jump gap over a lethal pit",
        note: "Floor breaks at x=5 for w=5 (a ~5-grid gap > base flat reach 3.8, < double reach 6.6). The ONLY crossing is a double-jump; falling in respawns. Spider waits past the gap.",
        approxSeconds: 34, widthGrids: 18, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 17, y: 0 },
        platforms: [],
        pits: [{ x: 5, w: 5 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 7, y: 1, kind: "token", label: "over-gap breadcrumb" },
          { x: 12, y: 0, kind: "enemy", label: "spider past gap" },
          { x: 15, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 8 + 12 — false summit + a second mandatory gap",
        note: "A platform that looks like the end, then one more double-jump gap to the real exit.",
        approxSeconds: 36, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 4, y: 2, w: 3 }],
        pits: [{ x: 12, w: 5 }],
        zones: [
          { x: 5, y: 3, kind: "token", label: "false summit" },
          { x: 9, y: 0, kind: "token" },
          { x: 14, y: 1, kind: "token", label: "over-gap breadcrumb" },
          { x: 18, y: 0, kind: "token" },
        ],
      },
    ],
  },
  {
    id: 5, name: "Find Dog",
    intent: "Climax. Mandatory double-jump to the finale; earn Dog on the final approach.",
    options: [
      {
        variant: "B",
        source: "Pattern 11 — calm approach",
        note: "Gentle lead-in before the climactic gap.",
        approxSeconds: 22, widthGrids: 16, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 15, y: 0 },
        platforms: [{ x: 6, y: 1, w: 2 }, { x: 10, y: 1, w: 2 }],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 7, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 8 + 13 — mandatory gap then a spider gate",
        note: "A double-jump gap (pit x=6 w=5), then a spider on a raised platform before the run-out.",
        approxSeconds: 38, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 13, y: 1, w: 3 }],
        pits: [{ x: 6, w: 5 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 8, y: 1, kind: "token", label: "over-gap breadcrumb" },
          { x: 14, y: 1, kind: "enemy", label: "spider gate" },
          { x: 17, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 8 + 14 (Companion Beacon) + 15 (Victory Coda)",
        note: "Final mandatory gap, then a victory coda with a halo of tokens, and Dog on the floor right before the exit (unavoidable).",
        approxSeconds: 42, widthGrids: 24, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 23, y: 0 },
        platforms: [{ x: 5, y: 1, w: 2 }],
        pits: [{ x: 9, w: 5 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 2, kind: "token" },
          { x: 11, y: 1, kind: "token", label: "over-gap breadcrumb" },
          { x: 18, y: 0, kind: "token", label: "halo" }, { x: 19, y: 0, kind: "token", label: "halo" },
          { x: 21, y: 0, kind: "companion", label: "Dog" },
        ],
      },
    ],
  },
];

export const HALLWAY_AREA: Area = {
  id: 2,
  name: "Hallway",
  worldKey: "World2_Hallway",
  intent: "Long carpeted corridor. Spiders in the corners. Find Dog.",
  companion: "dog",
  primaryEnemy: "spider",
  carryOverEnemies: ["dust_bunny"],
  slots: HALLWAY_SLOTS,
};

// ─────────────────────────────────────────────────────────────────────────
// KITCHEN — the vertical area. Two load-bearing gates:
//   • wall-climb (Cat, met at the start of the area) — climb the counters.
//   • dash (Dog, from the Hallway) — leap counter-to-counter over the
//     sink / stove pits.
// The level EXIT lives in the C variant (B → A → A → C chaining keeps only
// C's exit). B/A variants are gentle continuous-floor lead-ins; ant trails
// + token breadcrumbs + low optional counters. NO pits in slots 1–3; slot 4's
// first lethal pit is the sink, slot 5's the stove. Climb-only counters sit at
// sketch y≥6 (top ≈ 206px > double-jump apex 161.5px → honestly unjumpable);
// each carries a climbWall {x:left edge, y:0, h:counterY+1}. Mandatory dash
// gaps launch + land at EQUAL elevated height (dash gains no altitude), facing
// edges >6.6 grid apart (double-jump can't) and ≤10 grid (within the lunge),
// landing platform tagged requires:"dash", with a pit below so a miss is lethal
// AND blocks the floor route.
// ─────────────────────────────────────────────────────────────────────────
export const KITCHEN_SLOTS: LevelSlot[] = [
  // ───────────────────────────────────────────────────────────────────────
  // SLOT 1 — Tutorial: floor → first climb. Meet Cat. No pits.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Crumb Floor",
    intent: "Establish the kitchen. Walking + the first counter climb. No enemies, no pits.",
    options: [
      {
        variant: "B",
        source: "Pattern 1 + 15 — extreme gentle warmup",
        note: "Mostly walking, crumb tokens on the floor. One trivial counter hop.",
        approxSeconds: 22, widthGrids: 18, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 17, y: 0 },
        platforms: [{ x: 8, y: 1, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 6, y: 0, kind: "token" },
          { x: 9, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
          { x: 15, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 1 + 2 + 9 — low counter steps + a climb-reward shelf",
        note: "Base path is flat with an ant trail. A low climbWall counter (y=2) is an optional climb to a token shelf — eases the player into climbing before the gate.",
        approxSeconds: 30, widthGrids: 22, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [
          { x: 9, y: 2, w: 3 },
        ],
        climbWalls: [{ x: 9, y: 0, h: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 6, y: 0, kind: "enemy", label: "ant trail" },
          { x: 10, y: 3, kind: "token", label: "climb reward" },
          { x: 11, y: 3, kind: "token", label: "climb reward" },
          { x: 18, y: 0, kind: "token" }, { x: 19, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 2 + 14 — climb to Cat, climb-only exit (Kitchen signature)",
        note: "Cat on the floor at the counter base — meeting her (climbing) is mandatory to exit.",
        approxSeconds: 26, widthGrids: 22, heightGrids: 9,
        spawn: { x: 1, y: 0 }, exit: { x: 20, y: 6 },
        platforms: [{ x: 16, y: 6, w: 5 }],
        climbWalls: [{ x: 16, y: 0, h: 7 }],
        zones: [
          { x: 4, y: 0, kind: "enemy", label: "ant" },
          { x: 7, y: 0, kind: "enemy", label: "ant guard" },
          { x: 15, y: 0, kind: "companion", label: "Cat" },
        ],
        pits: [{ x: 17, w: 5 }],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 2 — Introduce ant stomping. Taller climb-only exit. No pits on lead-in.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 2,
    name: "Counter Climb",
    intent: "Introduce ant stomping. A taller climb-only counter to the exit.",
    options: [
      {
        variant: "B",
        source: "Pattern 4 — single safe stomp",
        note: "One ant on flat floor, runway both sides. Reads clearly.",
        approxSeconds: 24, widthGrids: 20, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 12, y: 1, w: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 9, y: 0, kind: "enemy", label: "first ant" },
          { x: 13, y: 2, kind: "token" },
          { x: 16, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 4 + 2 — stomp then a low climb",
        note: "Ant on the floor; a low counter (y=2) with a token cap eases climbing practice. No pits.",
        approxSeconds: 32, widthGrids: 22, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [{ x: 14, y: 2, w: 3 }],
        climbWalls: [{ x: 14, y: 0, h: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 8, y: 0, kind: "enemy", label: "ant" },
          { x: 15, y: 3, kind: "token", label: "climb reward" },
          { x: 19, y: 0, kind: "token" }, { x: 20, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 2 + 12 — taller climb-only counter to the exit",
        note: "A taller counter (y=7, top ≈ 238px ≫ double-jump apex 161). Exit perched on it over a pit — only wall-climb reaches it.",
        approxSeconds: 28, widthGrids: 22, heightGrids: 10,
        spawn: { x: 1, y: 0 }, exit: { x: 20, y: 7 },
        platforms: [{ x: 16, y: 7, w: 5 }],
        climbWalls: [{ x: 16, y: 0, h: 8 }],
        zones: [
          { x: 4, y: 0, kind: "enemy", label: "ant" },
          { x: 9, y: 0, kind: "enemy", label: "ant guard" },
          { x: 16, y: 8, kind: "token", label: "summit" },
        ],
        pits: [{ x: 17, w: 5 }],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 3 — Branching: climb-only exit PLUS an optional dash branch to bonus.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 3,
    name: "Cabinet Branch",
    intent: "Climb-only exit; an OPTIONAL dash branch to bonus tokens the base path can skip.",
    options: [
      {
        variant: "B",
        source: "Pattern 5 simplified — hill vs valley",
        note: "Low floor route safe; a mid counter (y=2) holds extra tokens, reached by one base jump.",
        approxSeconds: 30, widthGrids: 22, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [{ x: 6, y: 1, w: 2 }, { x: 9, y: 2, w: 6 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 11, y: 3, kind: "token", label: "high" }, { x: 12, y: 3, kind: "token", label: "high" },
          { x: 13, y: 0, kind: "enemy", label: "ant" },
          { x: 18, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 5 + 9 — low route + a double-jump token perch",
        note: "Flat ant trail with a token perch at y=4 above the floor (double-jump-only, optional).",
        approxSeconds: 34, widthGrids: 24, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 23, y: 0 },
        platforms: [{ x: 10, y: 1, w: 2 }, { x: 16, y: 1, w: 2 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 8, y: 0, kind: "enemy", label: "ant" },
          { x: 11, y: 4, kind: "token", label: "double-jump perch" },
          { x: 14, y: 0, kind: "enemy", label: "ant" },
          { x: 20, y: 0, kind: "token" }, { x: 21, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 2 + 5 — climb-only exit + an OPTIONAL dash bonus branch",
        note: "Climb-only counter holds the exit (wall-climb mandatory; exit over a pit, counter at y=6 unjumpable). A separate dash-only bonus pocket on the LEFT (counter-to-counter over a safe floored gap) dead-ends at bonus tokens — far from the exit so no double-jump bridges it.",
        approxSeconds: 32, widthGrids: 28, heightGrids: 9,
        spawn: { x: 1, y: 0 }, exit: { x: 26, y: 6 },
        platforms: [
          // Dash bonus pocket (left): launch counter → dash-only landing → dead-end.
          // y=3 so the player can comfortably double-jump up to start the branch.
          { x: 4, y: 3, w: 2 },
          { x: 13, y: 3, w: 2, requires: "dash" },
          // Climb-only exit counter (far right, over a pit).
          { x: 22, y: 6, w: 5 },
        ],
        climbWalls: [{ x: 22, y: 0, h: 7 }],
        zones: [
          { x: 3, y: 0, kind: "enemy", label: "ant" },
          { x: 13, y: 4, kind: "token", label: "dash bonus" },
          { x: 14, y: 4, kind: "token", label: "dash bonus" },
          { x: 19, y: 0, kind: "enemy", label: "ant guard" },
        ],
        pits: [{ x: 23, w: 5 }],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 4 — First lethal pit (the sink). Mandatory dash counter-to-counter.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 4,
    name: "Over the Sink",
    intent: "First lethal pit: the sink. Counter-to-counter dash is the only crossing.",
    options: [
      {
        variant: "B",
        source: "Pattern 11 — rest beat warmup (no gate)",
        note: "Flat breather with an ant before the gauntlet. No mandatory dash here.",
        approxSeconds: 20, widthGrids: 16, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 15, y: 0 },
        platforms: [{ x: 7, y: 1, w: 2 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 0, kind: "enemy", label: "ant" },
          { x: 8, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 2 + 11 — staircase rest beat",
        note: "Gentle ascending counters then a flat coda. Climb-friendly, no pits.",
        approxSeconds: 28, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 5, y: 1, w: 2 }, { x: 8, y: 2, w: 2 }, { x: 11, y: 3, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 2, kind: "token" }, { x: 12, y: 4, kind: "token" },
          { x: 15, y: 0, kind: "enemy", label: "ant" },
          { x: 17, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 5 + 8 — counter-to-counter dash over the sink",
        note: "Sink pit. Dash is the only crossing (224px gap > double-jump 212). Counters at y=3 so they're a comfortable double-jump up from the floor before the dash.",
        approxSeconds: 24, widthGrids: 20, heightGrids: 6,
        spawn: { x: 1, y: 0 }, exit: { x: 17, y: 0 },
        platforms: [
          { x: 4, y: 3, w: 2 },
          { x: 13, y: 3, w: 2, requires: "dash" },
        ],
        zones: [
          { x: 2, y: 0, kind: "enemy", label: "ant" },
          { x: 9, y: 4, kind: "token", label: "over-sink breadcrumb" },
        ],
        pits: [{ x: 6, w: 8 }],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 5 — Finale: stove dash → climb to Cat's exit shelf (combo).
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 5,
    name: "The Stove (Finale)",
    intent: "Climax. Dash over the stove, then climb a tall shelf to the elevated exit — both powers on the critical path.",
    options: [
      {
        variant: "B",
        source: "Pattern 11 — calm approach",
        note: "Gentle lead-in with an ant before the climactic combo.",
        approxSeconds: 22, widthGrids: 16, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 15, y: 0 },
        platforms: [{ x: 6, y: 1, w: 2 }, { x: 10, y: 1, w: 2 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 8, y: 0, kind: "enemy", label: "ant" },
          { x: 7, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 2 + 11 + 9 — staircase + an OPTIONAL climb pocket (Kitchen signature)",
        note: "Ascending counters and a token cap, then a low OPTIONAL climbWall counter (y=2, the Kitchen signature element) with a token on top — floor continues past it, no pit. Differentiates this A from slot 4's staircase.",
        approxSeconds: 28, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 5, y: 1, w: 2 }, { x: 8, y: 2, w: 2 }, { x: 14, y: 2, w: 2 }],
        climbWalls: [{ x: 14, y: 0, h: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 2, kind: "token" }, { x: 9, y: 3, kind: "token" },
          { x: 14, y: 3, kind: "token", label: "climb pocket" },
          { x: 16, y: 0, kind: "enemy", label: "ant" },
          { x: 18, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 8 + 12 + 15 — stove gap, false summit, victory coda",
        note: "Both powers on the critical path: dash over the stove (y=3 counters, comfortable double-jump up from the floor), then climb the tall shelf to the elevated exit. Victory coda: a token arc over the exit shelf, plus an over-stove breadcrumb on the dash.",
        approxSeconds: 30, widthGrids: 22, heightGrids: 11,
        spawn: { x: 1, y: 0 }, exit: { x: 20, y: 9 },
        platforms: [
          { x: 4, y: 3, w: 2 },
          { x: 13, y: 3, w: 2, requires: "dash" },
          { x: 17, y: 9, w: 4 },
        ],
        climbWalls: [{ x: 17, y: 0, h: 10 }],
        zones: [
          { x: 2, y: 0, kind: "enemy", label: "ant" },
          { x: 9, y: 5, kind: "token", label: "over-stove breadcrumb" },
          { x: 18, y: 10, kind: "token", label: "summit token" },
          { x: 19, y: 10, kind: "token", label: "summit token" },
          { x: 20, y: 10, kind: "token", label: "summit token" },
        ],
        pits: [{ x: 6, w: 8 }, { x: 18, w: 4 }],
      },
    ],
  },
];

export const KITCHEN_AREA: Area = {
  id: 3,
  name: "Kitchen",
  worldKey: "World3_Kitchen",
  intent: "Cabinets, counters, crumbs on the floor. Find Cat. Ants march in lines.",
  companion: "cat",
  primaryEnemy: "ant",
  carryOverEnemies: ["dust_bunny", "spider"],
  slots: KITCHEN_SLOTS,
};

// ─────────────────────────────────────────────────────────────────────────
// FAMILY ROOM — the enemy-forward, climb-light area. The player arrives with
// the full traversal kit (double-jump + dash + wall-climb) but the AREA leans
// on dense, varied encounters rather than new traversal puzzles:
//   • ONE load-bearing gate — wall-climb, used exactly once: slot 5's finale
//     couch-back climb (also where Horse is met). Slots 1–4 have NO mandatory
//     climb (any climbWall there is an OPTIONAL detour to a bonus token).
//   • Enemy-forward — ~3–5 stomps/level, with carryover VARIETY introduced one
//     returning foe at a time via per-zone `enemyType`: a dust_bunny in slot 2,
//     then spider + ant in slot 3, a mix in slot 4. Untagged enemy zones are
//     the area's primary (dust mites).
//   • Forgiveness curve — NO lethal pits in slots 1–3; the first lethal pit is
//     slot 4 (~5-grid = 160px gap: > base flat reach 121px, < double-jump 212px,
//     so double-jump clears it and dash stays optional). Climax is slot 5.
// B → A → A → C chaining keeps only C's exit; B/A are gentle continuous-floor
// lead-ins that hand off into the next segment. The climb-only finale shelf sits
// at sketch y=8 (top ≈ 270px > double-jump apex 161.5px → honestly unjumpable),
// with a climbWall on its near edge and a pit beneath the exit so the climbed-to
// shelf is the ONLY surface satisfying the exit. Horse grants charge, but charge
// is NOT usable in this area (a forward reward) — she's just placed in slot 5's C.
// ─────────────────────────────────────────────────────────────────────────
export const FAMILY_ROOM_SLOTS: LevelSlot[] = [
  // ───────────────────────────────────────────────────────────────────────
  // SLOT 1 — Welcome to the rug. Walking + 1–2 dust mites. No climb, no pits.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Welcome to the Rug",
    intent: "Establish the family room. Walking + meet the dust mites. No mandatory climb, no pits.",
    options: [
      {
        variant: "B",
        source: "Pattern 1 + 15 — extreme gentle warmup",
        note: "Mostly walking with a token trail. One trivial cushion hop.",
        approxSeconds: 22, widthGrids: 18, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 17, y: 0 },
        platforms: [{ x: 8, y: 1, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 6, y: 0, kind: "token" },
          { x: 9, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
          { x: 15, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 4 + 3 — first safe dust-mite stomp + breadcrumb",
        note: "One dust mite on flat floor, runway both sides. Token breadcrumb traces the way.",
        approxSeconds: 28, widthGrids: 22, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [{ x: 12, y: 1, w: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 9, y: 0, kind: "enemy", label: "first dust mite" },
          { x: 13, y: 2, kind: "token" },
          { x: 17, y: 0, kind: "token" }, { x: 19, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 2 + 11 — gentle staircase + a flat rest-beat coda",
        note: "A small cushion staircase then a flat run-out to the exit (on the floor — no climb).",
        approxSeconds: 26, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 5, y: 1, w: 2 }, { x: 8, y: 2, w: 2 }, { x: 11, y: 3, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 6, y: 2, kind: "token" }, { x: 12, y: 4, kind: "token" },
          { x: 15, y: 0, kind: "enemy", label: "dust mite" },
          { x: 17, y: 0, kind: "token" },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 2 — Critter mix. Dust mites + the first returning foe (a dust bunny).
  //          An OPTIONAL low climb to a bonus token. No pits.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 2,
    name: "Critter Mix",
    intent: "Denser stomps + the first carryover foe (a dust bunny). One OPTIONAL low climb. No pits.",
    options: [
      {
        variant: "B",
        source: "Pattern 4 + 11 — two spaced safe stomps",
        note: "A dust mite, a rest beat, then a returning dust bunny. Both on flat floor with runway.",
        approxSeconds: 26, widthGrids: 20, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 11, y: 1, w: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 7, y: 0, kind: "enemy", label: "dust mite" },
          { x: 12, y: 2, kind: "token" },
          { x: 15, y: 0, kind: "enemy", enemyType: "dust_bunny", label: "returning dust bunny" },
          { x: 18, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 4 + 9 (Hidden Token) — stomp pair + a double-jump perch",
        note: "Dust mite + dust bunny on the floor; a y=4 token perch above is double-jump-only (optional).",
        approxSeconds: 32, widthGrids: 24, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 23, y: 0 },
        platforms: [{ x: 10, y: 1, w: 2 }, { x: 16, y: 1, w: 2 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 8, y: 0, kind: "enemy", label: "dust mite" },
          { x: 11, y: 4, kind: "token", label: "double-jump perch" },
          { x: 14, y: 0, kind: "enemy", enemyType: "dust_bunny", label: "dust bunny" },
          { x: 20, y: 0, kind: "token" }, { x: 21, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 4 + 9 — stomp gate + an OPTIONAL climb to a bonus shelf",
        note: "Floor route is flat past two stomps. A short OPTIONAL climbWall cushion (y=2) caps a bonus token; the floor continues past it (no pit, climb never mandatory).",
        approxSeconds: 30, widthGrids: 22, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [{ x: 13, y: 2, w: 3 }],
        climbWalls: [{ x: 13, y: 0, h: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 7, y: 0, kind: "enemy", label: "dust mite" },
          { x: 10, y: 0, kind: "enemy", enemyType: "dust_bunny", label: "dust bunny" },
          { x: 14, y: 3, kind: "token", label: "optional climb bonus" },
          { x: 18, y: 0, kind: "token" }, { x: 19, y: 0, kind: "token" },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 3 — Toolkit romp. Dust mites + spider + ant (full carryover roster).
  //          A stomp-gate to a token + an OPTIONAL dash bonus. Last safe slot.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 3,
    name: "Toolkit Romp",
    intent: "Full carryover roster — dust mites + spider + ant. A stomp-gate token + an OPTIONAL dash bonus. Last pit-free slot.",
    options: [
      {
        variant: "B",
        source: "Pattern 13 — stomp-patroller gate to a token",
        note: "A spider patrols a raised cushion (no pit below); the token above it rewards a clean stomp. Dust mite on the floor first.",
        approxSeconds: 30, widthGrids: 22, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [{ x: 11, y: 2, w: 4 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 7, y: 0, kind: "enemy", label: "dust mite" },
          { x: 12, y: 2, kind: "enemy", enemyType: "spider", label: "spider patroller" },
          { x: 13, y: 4, kind: "token", label: "stomp-gate reward" },
          { x: 18, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 4 + 13 — three-type stomp run (spider + ant + mite)",
        note: "All three returning/primary foes in one pass: an ant on the floor, a spider on a low cushion, a dust mite at the run-out. Token breadcrumbs between.",
        approxSeconds: 36, widthGrids: 24, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 23, y: 0 },
        platforms: [{ x: 12, y: 1, w: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 7, y: 0, kind: "enemy", enemyType: "ant", label: "ant" },
          { x: 13, y: 1, kind: "enemy", enemyType: "spider", label: "spider on cushion" },
          { x: 13, y: 3, kind: "token" },
          { x: 18, y: 0, kind: "enemy", label: "dust mite" },
          { x: 21, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 5 + 13 — stomp gate + an OPTIONAL dash bonus pocket",
        note: "Floor route past an ant + a spider to the exit on the floor. A separate OPTIONAL dash pocket on a y=3 cushion: a dash-only landing platform (>6.6 grid away over a SAFE floored gap) dead-ends at bonus tokens, far from the exit so no double-jump bridges it. Climb never needed.",
        approxSeconds: 34, widthGrids: 26, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 25, y: 0 },
        platforms: [
          { x: 5, y: 3, w: 2 },
          { x: 14, y: 3, w: 2, requires: "dash" },
        ],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 8, y: 0, kind: "enemy", enemyType: "ant", label: "ant" },
          { x: 14, y: 4, kind: "token", label: "dash bonus" },
          { x: 15, y: 4, kind: "token", label: "dash bonus" },
          { x: 19, y: 0, kind: "enemy", enemyType: "spider", label: "spider gate" },
          { x: 23, y: 0, kind: "token" },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 4 — First fall. A lethal pit (double-jump clears) flanked by a mixed
  //          swarm. Dash stays optional. An OPTIONAL low climb on the lead-in.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 4,
    name: "First Fall",
    intent: "First lethal pit — a ~5-grid gap a double-jump clears (dash optional). A mixed swarm flanks it. One OPTIONAL climb on the lead-in.",
    options: [
      {
        variant: "B",
        source: "Pattern 11 — rest-beat warmup (no gate)",
        note: "Flat breather with a dust mite before the fall. No pit here.",
        approxSeconds: 20, widthGrids: 16, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 15, y: 0 },
        platforms: [{ x: 7, y: 1, w: 2 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 0, kind: "enemy", label: "dust mite" },
          { x: 8, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 2 + 9 — staircase with an OPTIONAL climb pocket",
        note: "Ascending cushions, then a short OPTIONAL climbWall cushion (y=2) caps a token. Floor continues past it; no pit. Climb stays optional.",
        approxSeconds: 28, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 5, y: 1, w: 2 }, { x: 8, y: 2, w: 2 }, { x: 14, y: 2, w: 2 }],
        climbWalls: [{ x: 14, y: 0, h: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 2, kind: "token" }, { x: 9, y: 3, kind: "token" },
          { x: 14, y: 3, kind: "token", label: "optional climb pocket" },
          { x: 17, y: 0, kind: "enemy", label: "dust mite" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 8 + 4 — MANDATORY double-jump gap over a lethal pit, swarm both sides",
        note: "Floor breaks at x=8 for w=5 (160px gap: > base flat 121px, < double-jump 212px — only a double-jump crosses; falling in respawns). A mixed swarm flanks it: an ant before, a dust mite + spider after. Exit on the floor past the swarm.",
        approxSeconds: 34, widthGrids: 22, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [],
        pits: [{ x: 8, w: 5 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 0, kind: "enemy", enemyType: "ant", label: "ant before the fall" },
          { x: 10, y: 1, kind: "token", label: "over-gap breadcrumb" },
          { x: 15, y: 0, kind: "enemy", label: "dust mite past the fall" },
          { x: 18, y: 0, kind: "enemy", enemyType: "spider", label: "spider past the fall" },
          { x: 20, y: 0, kind: "token" },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 5 — Couch summit → meet Horse. The ONE mandatory wall-climb in the
  //          area: a climb-only couch-back to the elevated exit, with Horse at
  //          its base. Lead-ins (B/A) are gentle floor approaches.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 5,
    name: "Couch Summit (Finale)",
    intent: "Climax. Meet Horse at the couch base, then a climb-only couch-back to the elevated exit — wall-climb is the sole route out.",
    options: [
      {
        variant: "B",
        source: "Pattern 11 — calm approach",
        note: "Gentle lead-in with a dust mite before the climactic climb.",
        approxSeconds: 22, widthGrids: 16, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 15, y: 0 },
        platforms: [{ x: 6, y: 1, w: 2 }, { x: 10, y: 1, w: 2 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 8, y: 0, kind: "enemy", label: "dust mite" },
          { x: 7, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 4 + 13 — a final mixed-stomp gauntlet on the floor",
        note: "A returning spider on a low cushion, a dust mite on the floor — last enemies before the summit. All on the floor, no pit, no mandatory climb.",
        approxSeconds: 30, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 9, y: 2, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 0, kind: "enemy", label: "dust mite" },
          { x: 10, y: 2, kind: "enemy", enemyType: "spider", label: "spider on cushion" },
          { x: 10, y: 4, kind: "token" },
          { x: 14, y: 0, kind: "enemy", label: "dust mite" },
          { x: 17, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 12 + 14 — meet Horse, climb-only couch summit (Family Room finale)",
        note: "Horse on the floor at the couch base — meeting her then climbing is the only way out.",
        approxSeconds: 28,
        widthGrids: 22,
        heightGrids: 10,
        spawn: { x: 1, y: 0 },
        exit: { x: 20, y: 8 },                       // up on the shelf, over the pit
        platforms: [{ x: 17, y: 8, w: 4 }],          // couch-top shelf, -102 (270px up): climb-only
        climbWalls: [{ x: 17, y: 0, h: 9 }],         // floor → shelf face at the shelf's left edge
        zones: [
          { x: 3, y: 0, kind: "enemy" },             // dust mites at the base (primary)
          { x: 6, y: 0, kind: "enemy" },
          { x: 16, y: 0, kind: "companion" },        // Horse at the couch base (comfortably reachable)
        ],
        pits: [{ x: 18, w: 4 }],                      // floor ends at 18 → nothing under the exit but the shelf
      },
    ],
  },
];

export const FAMILY_ROOM_AREA: Area = {
  id: 4,
  name: "Family Room",
  worldKey: "World4_FamilyRoom",
  intent: "Couch fortress, rug archipelago. Dust mites under the cushions. Find Horse.",
  companion: "horse",
  primaryEnemy: "dust_mite",
  carryOverEnemies: ["dust_bunny", "spider", "ant"],
  slots: FAMILY_ROOM_SLOTS,
};

// ─────────────────────────────────────────────────────────────────────────
// BACKYARD — the pre-boss graduation area, and the only DUAL-gate world. The
// player arrives with the full traversal kit (double-jump + dash + wall-climb
// + charge) and meets Flamingo on the opening windowsill (metAtStart), so glide
// is usable from grid 0. The area's shape is DESCENT → SPRAWL: it opens HIGH
// (Eloise spawns on a windowsill, glides out the window into the yard) then runs
// horizontal across the garden, fence line, and up to the treehouse.
//
//   • TWO load-bearing gates, escalating to a combo finale:
//       – GLIDE is mandatory at slot 3 (the pool gap: a raised flower-bed launch
//         over a chasm too wide for a double-jump but cleared by the glide arc)
//         and again at slot 5 (the treehouse → playhouse chasm).
//       – CHARGE is mandatory at slot 4 (a fence panel filling the only seam,
//         geometry from chargeDemoLevel) and again at slot 5 (the final hedge).
//       – Slot 5 needs BOTH on the critical path: charge the hedge → double-jump
//         onto the treehouse → glide the chasm to the playhouse door.
//   • ALL-ENEMY recap via per-zone `enemyType` carryover, one returning foe
//     graduating in at a time: ants (primary) everywhere, a spider in slot 2, a
//     dust_bunny in slot 3, a dust_mite in slot 4, the full mix in slot 5.
//   • Forgiveness curve held to the kids'-game policy: NO lethal pits in slots
//     1–3. Slot 3's mandatory glide gap is NON-LETHAL — a missed glide drops to a
//     shallow "pool" ledge for a safe retry, not a kill plane (the FAR landing
//     stays glide-only; only the consequence of a miss is softened). The first
//     lethal pit is slot 4 (the fence-line kill seam); slot 5 is lethal too.
//
// B → A → A → C chaining keeps only C's exit; B provides the spawn. So each
// slot's gate (the exit-controlling element) lives in its C variant, and the
// windowsill entrance lives in slot 1's B. Glide gaps are tuned to gap ≈ 8 grids
// (256px) from a ~4-grid launch: > the 212px double-jump flat reach so a jump
// undershoots, but inside the glide arc — mirroring glideDemoLevel's proven
// proportion. Charge barricades are h ≥ 7 grids (224px > the 161.5px double-jump
// apex) so they're honestly unjumpable, filling the ONLY seam (subtractive gate).
// ─────────────────────────────────────────────────────────────────────────
export const BACKYARD_SLOTS: LevelSlot[] = [
  // ───────────────────────────────────────────────────────────────────────
  // SLOT 1 — Out the Window. High windowsill spawn → meet Flamingo → glide down
  //          to the yard. Forgiving (full floor under the sill). 1–2 ants.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Out the Window",
    intent: "Establish the backyard. Spawn high on the windowsill, meet Flamingo, glide out the window down to the grass. Walking + the first ants. No pits.",
    options: [
      {
        variant: "B",
        source: "Pattern 1 + 14 — windowsill entrance, meet Flamingo, glide down (Backyard intro)",
        note: "High windowsill spawn (elevatable-spawn infra). Flamingo on the sill → glide out the window down to the grass. Floor runs full width under the sill, so the drop is forgiving.",
        approxSeconds: 14,
        widthGrids: 12,
        heightGrids: 8,
        spawn: { x: 1, y: 7 },                      // up on the windowsill (elevated)
        exit: { x: 11, y: 0 },                      // B's exit is dropped by combineSlot — author as a hand-off
        platforms: [{ x: 0, y: 7, w: 3 }],          // the windowsill (the player spawns here)
        zones: [
          { x: 1, y: 7, kind: "companion" },        // Flamingo on the sill (unavoidable; grants glide)
          { x: 6, y: 0, kind: "enemy" },            // an ant on the grass (primary; no override)
          { x: 9, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 1 + 3 + 4 — friendly grass runway, breadcrumb, first safe ant",
        note: "On the grass now: a flat walk past one ant with a token trail. Pure footing practice after the drop.",
        approxSeconds: 26, widthGrids: 22, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [{ x: 12, y: 1, w: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 9, y: 0, kind: "enemy", label: "first ant" },
          { x: 13, y: 2, kind: "token" },
          { x: 17, y: 0, kind: "token" }, { x: 19, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 2 + 11 + 15 — gentle cushion staircase + a flat victory coda",
        note: "A small garden-step staircase then a flat run-out to the exit on the grass. No gate, no pit — slot 1 stays a tutorial.",
        approxSeconds: 24, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 5, y: 1, w: 2 }, { x: 8, y: 2, w: 2 }, { x: 11, y: 3, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" }, { x: 6, y: 2, kind: "token" }, { x: 12, y: 4, kind: "token" },
          { x: 15, y: 0, kind: "enemy", label: "ant" },
          { x: 17, y: 0, kind: "token" },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 2 — Garden Path. Ants + the first returning foe (a spider). An OPTIONAL
  //          hedge shortcut (a breakable you MAY smash) with a route AROUND it.
  //          No lethal pits.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 2,
    name: "Garden Path",
    intent: "Wind through the garden. Ants + the first carryover foe (a spider). An OPTIONAL low hedge (smash it with charge, or simply hop over it — it's short enough to clear) capping a bonus-token pocket. No pits.",
    options: [
      {
        variant: "B",
        source: "Pattern 4 + 11 — two spaced safe stomps (ant then a returning spider)",
        note: "An ant, a rest beat, then a returning spider — both on flat grass with runway. First carryover foe graduates in.",
        approxSeconds: 26, widthGrids: 20, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 11, y: 1, w: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 7, y: 0, kind: "enemy", label: "ant" },
          { x: 12, y: 2, kind: "token" },
          { x: 15, y: 0, kind: "enemy", enemyType: "spider", label: "returning spider" },
          { x: 18, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 4 + 9 — stomp pair + a double-jump token perch",
        note: "Ant + spider on the grass; a y=4 token perch above is double-jump-only (optional bonus).",
        approxSeconds: 32, widthGrids: 24, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 23, y: 0 },
        platforms: [{ x: 10, y: 1, w: 2 }, { x: 16, y: 1, w: 2 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 8, y: 0, kind: "enemy", label: "ant" },
          { x: 11, y: 4, kind: "token", label: "double-jump perch" },
          { x: 14, y: 0, kind: "enemy", enemyType: "spider", label: "spider" },
          { x: 20, y: 0, kind: "token" }, { x: 21, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 5 + 6 — OPTIONAL hedge shortcut (foreshadows the slot-4 charge gate)",
        note: "An OPTIONAL low hedge breakable (h=3 ≈ 96px, a shrub) sits in the corridor capping a bonus-token shelf: smash it with charge for a clean run-through, OR just hop over it (well within the jump envelope) and continue to the exit. NOT a gate (it's low enough to clear without charge) — it foreshadows the real, unjumpable charge fence in slot 4. No pit.",
        approxSeconds: 30, widthGrids: 24, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 23, y: 0 },
        platforms: [{ x: 10, y: 3, w: 3 }],            // a shrub-top shelf holding bonus tokens
        breakables: [{ x: 11, y: 0, w: 1, h: 3 }],     // OPTIONAL low hedge (h=3, jumpable AND smashable; not a barricade)
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 0, kind: "enemy", enemyType: "spider", label: "spider" },
          { x: 11, y: 4, kind: "token", label: "hedge-top bonus" },
          { x: 12, y: 4, kind: "token", label: "hedge-top bonus" },
          { x: 16, y: 0, kind: "enemy", label: "ant" },
          { x: 21, y: 0, kind: "token" },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 3 — Flower Beds & Pool. The FIRST mandatory glide: a raised flower-bed
  //          launch over a chasm too wide for a double-jump. NON-LETHAL — a miss
  //          drops to a shallow "pool" ledge for a safe retry. Carryover: a
  //          returning dust bunny. No kill pit.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 3,
    name: "Flower Beds & Pool",
    intent: "First MANDATORY glide: launch off a raised flower bed and glide a wide pool gap a double-jump can't clear. Soft pool — a missed glide drops to a shallow ledge for a retry, not a kill plane. Returning dust bunnies + ants.",
    options: [
      {
        variant: "B",
        source: "Pattern 11 + 4 — calm flower-bed warmup",
        note: "A flat stretch with an ant and a returning dust bunny, easing into the bed before the glide. No pit.",
        approxSeconds: 24, widthGrids: 20, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 11, y: 1, w: 3 }],
        zones: [
          { x: 4, y: 0, kind: "token" },
          { x: 7, y: 0, kind: "enemy", label: "ant" },
          { x: 12, y: 2, kind: "token" },
          { x: 15, y: 0, kind: "enemy", enemyType: "dust_bunny", label: "returning dust bunny" },
          { x: 18, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 2 + 9 — flower-bed steps + a double-jump perch",
        note: "Ascending flower-bed steps with a token cap, a dust bunny on the grass, and a high optional perch. All footing on the floor; no pit.",
        approxSeconds: 30, widthGrids: 22, heightGrids: 5,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [{ x: 6, y: 1, w: 2 }, { x: 9, y: 2, w: 2 }, { x: 14, y: 1, w: 2 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 7, y: 2, kind: "token" }, { x: 10, y: 3, kind: "token" },
          { x: 12, y: 0, kind: "enemy", enemyType: "dust_bunny", label: "dust bunny" },
          { x: 18, y: 0, kind: "token" }, { x: 19, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Pattern 8 + 12 — MANDATORY glide over the soft pool (Backyard glide signature)",
        note: "A raised flower bed (y=4) launches a glide over a wide pool gap (the floor breaks for 12 grids / 384px). NON-LETHAL: a shallow pool ledge inside the gap (a floating platform at floor height, x≈8–11) catches a missed glide for a safe retry back to the launch bed — but from that ledge the far bank is ~8 grids / 256px out, past the 212px double-jump flat reach, so only the flower-bed glide arc clears the span. Exit on the far bank.",
        approxSeconds: 28,
        widthGrids: 26,
        heightGrids: 6,
        spawn: { x: 1, y: 0 },
        exit: { x: 24, y: 0 },
        platforms: [
          { x: 4, y: 4, w: 3 },                      // flower-bed launch (128px up; double-jump-reachable from grass)
          { x: 8, y: 0, w: 3 },                      // shallow pool ledge: a soft catch for a missed glide (retry), at floor height
        ],
        zones: [
          { x: 3, y: 0, kind: "enemy", enemyType: "dust_bunny", label: "dust bunny at the bank" },
          { x: 5, y: 5, kind: "token", label: "launch-bed token" },
          { x: 13, y: 1, kind: "token", label: "pool breadcrumb (over the gap)" },
          { x: 22, y: 0, kind: "enemy", label: "ant on the far bank" },
        ],
        // Pool gap: floor breaks 7→19 (12 wide). The shallow pool ledge (a floating
        // platform at y=0, x 8–11) catches a missed glide so the player isn't
        // killed — they hop back to the launch bed and retry. The far bank resumes
        // at 19, ~8 grids past the ledge (256px) — out of double-jump reach from
        // the ledge — so the ONLY way to the far bank is the flower-bed glide.
        pits: [{ x: 7, w: 12 }],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 4 — The Fence Line. The FIRST mandatory charge: a fence panel fills the
  //          only seam (geometry from chargeDemoLevel). The FIRST lethal pit.
  //          Mixed swarm (dust mite carryover + ants).
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 4,
    name: "The Fence Line",
    intent: "First MANDATORY charge: a fence panel fills the only seam — smash it, then hop the gap. The first lethal pit. A mixed swarm (returning dust mites + ants) flanks the approach.",
    options: [
      {
        variant: "B",
        source: "Pattern 11 — rest-beat warmup (no gate)",
        note: "A flat breather with a dust mite before the fence. No pit, no charge here.",
        approxSeconds: 20, widthGrids: 16, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 15, y: 0 },
        platforms: [{ x: 7, y: 1, w: 2 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 0, kind: "enemy", enemyType: "dust_mite", label: "returning dust mite" },
          { x: 8, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 2 + 11 — staircase rest beat",
        note: "A gentle ascending step set then a flat coda. An ant at the run-out. Climb-friendly, no pits, no gate.",
        approxSeconds: 28, widthGrids: 20, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 19, y: 0 },
        platforms: [{ x: 5, y: 1, w: 2 }, { x: 8, y: 2, w: 2 }, { x: 11, y: 3, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 2, kind: "token" }, { x: 12, y: 4, kind: "token" },
          { x: 15, y: 0, kind: "enemy", label: "ant" },
          { x: 17, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Charge gate — smash the fence panel (Backyard slot-4 finale segment)",
        note: "A breakable fence fills a lethal seam; smash with charge, then hop the gap. First MANDATORY charge + first lethal pit. Geometry from chargeDemoLevel.",
        approxSeconds: 22,
        widthGrids: 22,
        heightGrids: 8,
        spawn: { x: 1, y: 0 },
        exit: { x: 18, y: 0 },                       // far floor, past the seam (spawn floor ends at x=10)
        platforms: [],
        zones: [
          { x: 3, y: 0, kind: "enemy", enemyType: "dust_mite", label: "dust mite on the approach" },
          { x: 6, y: 0, kind: "enemy", enemyType: "ant", label: "ant" },
          { x: 20, y: 0, kind: "token" },                         // reward past the fence
        ],
        pits: [{ x: 10, w: 2 }],                      // lethal seam (kill plane below) — floor 0→10, 12→22
        breakables: [{ x: 10, y: 0, w: 2, h: 7 }],    // fence panel filling the seam, 224px (unjumpable)
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  // SLOT 5 — Treehouse → Playhouse (Finale). The DUAL-gate combo: charge the
  //          final hedge → double-jump onto the treehouse → glide the chasm to
  //          the elevated playhouse door. Climax enemy mix (all four). Lethal.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: 5,
    name: "Treehouse → Playhouse (Finale)",
    intent: "Climax. Charge through the last hedge, double-jump onto the treehouse, then glide the chasm to the elevated playhouse door. Both gates on the critical path. Full enemy mix. Lethal.",
    options: [
      {
        variant: "B",
        source: "Pattern 11 — calm approach",
        note: "A gentle lead-in with an ant before the climactic combo. No gate, no pit.",
        approxSeconds: 22, widthGrids: 16, heightGrids: 3,
        spawn: { x: 1, y: 0 }, exit: { x: 15, y: 0 },
        platforms: [{ x: 6, y: 1, w: 2 }, { x: 10, y: 1, w: 2 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 8, y: 0, kind: "enemy", label: "ant" },
          { x: 7, y: 2, kind: "token" }, { x: 13, y: 0, kind: "token" },
        ],
      },
      {
        variant: "A",
        source: "Pattern 4 + 13 — a final mixed-stomp gauntlet (all four foes)",
        note: "The full roster in one pass: an ant on the floor, a returning spider on a low bush, a dust bunny and a dust mite at the run-out. The recap-everything beat before the finale. All on the floor, no pit.",
        approxSeconds: 32, widthGrids: 22, heightGrids: 4,
        spawn: { x: 1, y: 0 }, exit: { x: 21, y: 0 },
        platforms: [{ x: 9, y: 2, w: 3 }],
        zones: [
          { x: 3, y: 0, kind: "token" },
          { x: 6, y: 0, kind: "enemy", label: "ant" },
          { x: 10, y: 2, kind: "enemy", enemyType: "spider", label: "spider on the bush" },
          { x: 10, y: 4, kind: "token" },
          { x: 14, y: 0, kind: "enemy", enemyType: "dust_bunny", label: "dust bunny" },
          { x: 17, y: 0, kind: "enemy", enemyType: "dust_mite", label: "dust mite" },
          { x: 19, y: 0, kind: "token" },
        ],
      },
      {
        variant: "C",
        source: "Combo finale — charge the hedge, glide off the treehouse to the playhouse (Backyard finale)",
        note: "Smash the hedge (charge) → double-jump onto the treehouse → glide the chasm to the elevated playhouse door. The chasm is 8 grids (256px > the 212px double-jump flat reach) so only the glide arc reaches the playhouse landing — both gates land on the critical path.",
        approxSeconds: 30,
        widthGrids: 26,
        heightGrids: 8,
        spawn: { x: 1, y: 0 },
        exit: { x: 23, y: 1 },                        // playhouse door, elevated on the far landing
        platforms: [
          { x: 11, y: 4, w: 3 },                      // treehouse launch (128px up; double-jump-reachable)
          { x: 22, y: 1, w: 4 },                      // far landing under the playhouse door
        ],
        zones: [
          { x: 3, y: 0, kind: "enemy", enemyType: "spider", label: "spider" },
          { x: 5, y: 0, kind: "enemy", enemyType: "ant", label: "ant" },
          { x: 12, y: 5, kind: "token", label: "over-treehouse coda" },
        ],
        // Hedge seam (charge) at x=8, then the glide chasm. Floor: 0→8, 10→14
        // (treehouse footing), then the chasm 14→22, far landing platform at 22.
        pits: [{ x: 8, w: 2 }, { x: 14, w: 8 }],      // hedge seam (charge) + glide chasm (8 wide → glide-only)
        breakables: [{ x: 8, y: 0, w: 2, h: 7 }],     // the final hedge (charge)
      },
    ],
  },
];

export const BACKYARD_AREA: Area = {
  id: 5,
  name: "Backyard",
  worldKey: "World5_Backyard",
  intent: "Pre-boss graduation, outdoors. Glide out the window into the yard; charge through hedges. All four enemies recap. Find Flamingo.",
  companion: "flamingo",
  primaryEnemy: "ant",
  carryOverEnemies: ["spider", "dust_bunny", "dust_mite"],
  slots: BACKYARD_SLOTS,
};

export const DOLLHOUSE_AREA: Area = {
  id: 6,
  name: "Playhouse",
  worldKey: "World6_Playhouse",
  intent: "Outdoor playhouse — the T-Rex boss arena, reached from the backyard. Single set-piece encounter, no level progression.",
  companion: null,
  primaryEnemy: "trex",
  carryOverEnemies: [],
  isBoss: true,
  slots: [
    {
      id: 1,
      name: "T-Rex Boss Arena",
      intent:
        "Single-screen boss fight. Phases: roar (intro), patrol (stomp), charge (dodge). Game-complete reward.",
      options: [],
    },
  ],
};

export const ALL_AREAS: Area[] = [
  BEDROOM_AREA,
  HALLWAY_AREA,
  KITCHEN_AREA,
  FAMILY_ROOM_AREA,
  BACKYARD_AREA,
  DOLLHOUSE_AREA,
];
