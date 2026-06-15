# Storybook Character Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 24 storybook-illustrated character sprites via NanoBanana MCP and wire Eloise / Teddy / Dust Bunny into the game. Remaining 8 sprites stored for future wiring.

**Architecture:** Sequential NanoBanana generation pipeline anchored on a single Eloise reference image; sibling `assets/sprites/<category>/storybook/` folders for parallel A/B against existing procedural art; Phaser code switched from procedural `Graphics`-drawn textures to PNG-loaded textures via `BootScene.preload()`.

**Tech Stack:** Phaser 3.80, TypeScript (strict), Vite 6, NanoBanana MCP (Gemini 3 Pro Image), manual image review (no automated visual testing).

**Source spec:** `docs/superpowers/specs/2026-05-24-storybook-character-art-design.md`

**Conventions specific to this plan:**
- This project is not a git repository. Where a normal plan would say "commit," do nothing — but stop at each user-review checkpoint and wait for explicit approval before continuing.
- NanoBanana session ID: `eloise-art-2026-05-24`. Use the same `conversation_id` on every MCP call so the model's session-level history is consistent.
- Project root: `/Users/mattod/Projects/Weezy2`. All `output_path` values in this plan are absolute.
- "User review checkpoint" steps mean: stop, present the generated images via SendUserFile, wait for explicit approve / re-roll instructions.

---

## Phase 1: Setup

### Task 1: Create storybook asset folders

**Files:**
- Create: `assets/sprites/player/storybook/` (directory)
- Create: `assets/sprites/companions/storybook/` (directory)
- Create: `assets/sprites/enemies/storybook/` (directory)
- Create: `assets/sprites/bosses/storybook/` (directory)
- Create: `assets/sprites/_anchors/` (directory — holds the Eloise reference image used across generations)

- [ ] **Step 1: Create directories**

```bash
mkdir -p /Users/mattod/Projects/Weezy2/assets/sprites/player/storybook \
         /Users/mattod/Projects/Weezy2/assets/sprites/companions/storybook \
         /Users/mattod/Projects/Weezy2/assets/sprites/enemies/storybook \
         /Users/mattod/Projects/Weezy2/assets/sprites/bosses/storybook \
         /Users/mattod/Projects/Weezy2/assets/sprites/_anchors
```

- [ ] **Step 2: Verify**

```bash
ls -la /Users/mattod/Projects/Weezy2/assets/sprites/
```

Expected: directories `player/`, `companions/`, `enemies/`, `bosses/`, `_anchors/`, plus existing `tiles/`, `ui/`, `collectibles/`, `_backup/`.

---

### Task 2: Configure NanoBanana session

- [ ] **Step 1: Set model to Pro (highest quality for the anchor)**

Call `mcp__nanobanana-mcp__set_model` with:
```json
{ "model": "pro", "conversation_id": "eloise-art-2026-05-24" }
```

- [ ] **Step 2: Set default aspect ratio to 2:3 (portrait, fits full-body characters)**

Call `mcp__nanobanana-mcp__set_aspect_ratio` with:
```json
{ "aspect_ratio": "2:3", "conversation_id": "eloise-art-2026-05-24" }
```

Expected response from both: success confirmation. No image yet.

---

## Phase 2: Eloise Anchor (interactive, max 4 attempts)

### Task 3: Generate Eloise anchor — first attempt

**Files:**
- Create: `assets/sprites/_anchors/eloise-anchor-v1.png`

- [ ] **Step 1: Generate**

Call `mcp__nanobanana-mcp__gemini_generate_image` with:
```json
{
  "conversation_id": "eloise-art-2026-05-24",
  "aspect_ratio": "2:3",
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor-v1.png",
  "prompt": "A storybook illustration of a 3-year-old princess named Eloise standing in a neutral idle pose, facing slightly to the side. She has short curly blonde hair, big bright blue eyes, rosy cheeks, and a warm friendly expression. She wears a light blue princess dress with soft puffy short sleeves and a slightly flared skirt, and a small silver crown. On her feet are sparkly silver glass slippers. Painterly storybook art style — soft watercolor textures, gentle outlines, warm lighting, like a children's picture-book illustration. Full body, centered, transparent background. No shadow. Cohesive palette: light blue, blonde, silver, soft pink."
}
```

- [ ] **Step 2: Send the result to the user via SendUserFile for review**

Use SendUserFile with `status: "normal"` and a short caption like "Eloise anchor v1 — does she match the description?"

- [ ] **Step 3: User review checkpoint**

Wait for one of:
- "Approve" / "Looks good" → proceed to Task 5
- Specific re-roll guidance (e.g., "make the dress lighter blue, hair curlier") → proceed to Task 4

---

### Task 4: Re-roll Eloise anchor (repeat up to 3 times)

**Files:**
- Create: `assets/sprites/_anchors/eloise-anchor-v2.png` (then v3, v4 if needed)

- [ ] **Step 1: Apply user's feedback as an edit on the previous anchor**

Call `mcp__nanobanana-mcp__gemini_edit_image` with:
```json
{
  "conversation_id": "eloise-art-2026-05-24",
  "image_path": "last",
  "aspect_ratio": "2:3",
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor-v<N>.png",
  "edit_prompt": "<user's specific feedback verbatim, e.g. 'Make the dress a lighter, softer blue and curl the hair more tightly. Keep everything else identical.'>"
}
```

Replace `<N>` with the next version number (v2, v3, v4).

- [ ] **Step 2: SendUserFile + checkpoint**

Same pattern as Task 3 Step 2-3. If after the 4th attempt nothing is right, stop and ask the user whether to abandon, switch to a more detailed prompt, or change style direction. Do NOT keep re-rolling silently past v4.

---

### Task 5: Lock the approved anchor

**Files:**
- Create: `assets/sprites/_anchors/eloise-anchor.png` (final, approved copy)
- Create: `assets/sprites/player/storybook/eloise_idle.png` (the same image — Eloise's idle pose IS the anchor)

- [ ] **Step 1: Copy the approved version to the canonical anchor name**

```bash
cp /Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor-v<APPROVED>.png \
   /Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor.png
```

Replace `<APPROVED>` with the version number the user approved (v1, v2, v3, or v4).

- [ ] **Step 2: Copy it as Eloise's idle frame**

```bash
cp /Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor.png \
   /Users/mattod/Projects/Weezy2/assets/sprites/player/storybook/eloise_idle.png
```

- [ ] **Step 3: Verify**

```bash
ls -la /Users/mattod/Projects/Weezy2/assets/sprites/_anchors/ \
       /Users/mattod/Projects/Weezy2/assets/sprites/player/storybook/
```

Expected: `eloise-anchor.png` in `_anchors/` and `eloise_idle.png` in `player/storybook/`.

---

## Phase 3: Eloise walk cycle + jump

### Task 6: Generate Eloise walk cycle (6 frames)

**Files:**
- Create: `assets/sprites/player/storybook/eloise_walk_0.png` through `eloise_walk_5.png`

- [ ] **Step 1: Generate 6 frames sequentially, each referencing the anchor**

For each `i` in 0..5, call `mcp__nanobanana-mcp__gemini_generate_image`:
```json
{
  "conversation_id": "eloise-art-2026-05-24",
  "aspect_ratio": "2:3",
  "reference_images": ["/Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor.png"],
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/player/storybook/eloise_walk_<i>.png",
  "prompt": "The exact same princess Eloise character from the reference image — same face, same hair, same dress, same colors, same painterly storybook style — now in walk cycle frame <i+1> of 6. Frame description: <FRAME_DESC>. Full body, side view facing right, transparent background, no shadow."
}
```

Use these `<FRAME_DESC>` values:
- Frame 0: "both feet on ground, weight on back foot, front leg lifting slightly — contact pose"
- Frame 1: "front foot just planting, back leg pushing off, slight forward lean — recoil pose"
- Frame 2: "weight fully on front foot, back leg lifted behind, body upright — passing pose"
- Frame 3: "back leg swinging forward, front leg pushing off the ground, slight upward bounce — high point"
- Frame 4: "back leg now reaching forward as new front foot, original front leg now back, mirror of frame 1 — recoil"
- Frame 5: "mirror of frame 0 — both feet near ground, opposite stride from frame 0"

- [ ] **Step 2: SendUserFile with all 6 frames**

Send all 6 frames as a batch with `status: "normal"` and caption "Eloise walk cycle — any frames need re-rolling?"

- [ ] **Step 3: User review checkpoint**

Wait for approve or specific re-roll instructions (e.g., "frame 3 looks weird, redo it"). If re-rolls needed, re-call generation for only the named frames with the same arguments. Hard cap: 3 re-rolls per frame.

---

### Task 7: Generate Eloise jump pose

**Files:**
- Create: `assets/sprites/player/storybook/eloise_jump.png`

- [ ] **Step 1: Generate**

Call `mcp__nanobanana-mcp__gemini_generate_image`:
```json
{
  "conversation_id": "eloise-art-2026-05-24",
  "aspect_ratio": "2:3",
  "reference_images": ["/Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor.png"],
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/player/storybook/eloise_jump.png",
  "prompt": "The exact same princess Eloise character from the reference image — same face, same hair, same dress, same colors, same painterly storybook style — now mid-jump: both legs tucked slightly, arms out for balance, an excited joyful expression, hair lifting. Full body, side view facing right, transparent background, no shadow."
}
```

- [ ] **Step 2: SendUserFile + review checkpoint**

Same review pattern as before. Re-roll if needed (max 3 attempts).

---

## Phase 4: Companions

### Task 8: Generate all 5 companions

**Files:**
- Create: `assets/sprites/companions/storybook/teddy.png`
- Create: `assets/sprites/companions/storybook/dog.png`
- Create: `assets/sprites/companions/storybook/horse.png`
- Create: `assets/sprites/companions/storybook/cat.png`
- Create: `assets/sprites/companions/storybook/flamingo.png`

- [ ] **Step 1: Generate Teddy**

Call `mcp__nanobanana-mcp__gemini_generate_image`:
```json
{
  "conversation_id": "eloise-art-2026-05-24",
  "aspect_ratio": "2:3",
  "reference_images": ["/Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor.png"],
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/companions/storybook/teddy.png",
  "prompt": "A mustard-brown teddy bear standing on two feet, with classic stuffed-toy proportions (big round head, short stubby arms and legs, soft cuddly body), a friendly smiling face with stitched details, and a small black nose. Same painterly storybook art style as the reference image — soft watercolor textures, gentle outlines, warm lighting. Full body, centered, transparent background, no shadow."
}
```

- [ ] **Step 2: Generate Dog (Dalmatian)**

Call same tool, different prompt + output_path:
```json
{
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/companions/storybook/dog.png",
  "prompt": "A friendly Dalmatian dog in side profile, white fur with distinctive black spots, floppy ears, tongue out, smiling expression, tail up. Same painterly storybook art style as the reference image — soft watercolor textures, gentle outlines. Full body, centered, transparent background, no shadow."
}
```
(Keep `conversation_id`, `aspect_ratio`, `reference_images` as in Step 1.)

- [ ] **Step 3: Generate Horse**

```json
{
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/companions/storybook/horse.png",
  "prompt": "A friendly storybook pony in side profile, light brown body with darker brown mane and tail, large kind eyes, gentle smile. Same painterly storybook art style as the reference image — soft watercolor textures, gentle outlines, warm lighting. Full body, centered, transparent background, no shadow."
}
```

- [ ] **Step 4: Generate Cat**

```json
{
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/companions/storybook/cat.png",
  "prompt": "A fluffy white cat sitting upright, with a soft pink bow tied around its neck, large green eyes, gentle smile, fluffy tail curled around its feet. Same painterly storybook art style as the reference image — soft watercolor textures, gentle outlines. Full body, centered, transparent background, no shadow."
}
```

- [ ] **Step 5: Generate Flamingo**

```json
{
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/companions/storybook/flamingo.png",
  "prompt": "A classic pink flamingo standing on one long leg, S-curved neck, beak slightly open in a friendly smile, soft pink feathers, large dark eye with eyelashes. Same painterly storybook art style as the reference image — soft watercolor textures, gentle outlines. Full body, centered, transparent background, no shadow."
}
```

- [ ] **Step 6: SendUserFile with all 5 companions**

Send the 5 PNGs as one message with `status: "normal"` and caption "Companion lineup — any that need re-rolling?"

- [ ] **Step 7: User review checkpoint**

Wait for approve or specific re-roll names. Re-roll cap: 2 attempts per companion.

---

## Phase 5: 3-pose enemies + boss

### Task 9: Generate Dust Bunny (3 poses)

**Files:**
- Create: `assets/sprites/enemies/storybook/dustbunny_idle.png`, `dustbunny_walk.png`, `dustbunny_attack.png`

- [ ] **Step 1: Generate idle pose**

```json
{
  "conversation_id": "eloise-art-2026-05-24",
  "aspect_ratio": "1:1",
  "reference_images": ["/Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor.png"],
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/enemies/storybook/dustbunny_idle.png",
  "prompt": "A menacing-but-cartoonish little gray bunny enemy (looks like a real bunny, not a dust ball), with angry expression, scowling eyebrows, slightly bared buck teeth, beady red eyes, twitchy whiskers. Bowser-lite vibe — clearly the bad guy but still cute enough for young kids. Same painterly storybook art style as the reference image. Standing pose, side view facing right, transparent background, no shadow."
}
```

- [ ] **Step 2: Generate walk pose**

Same args, change `output_path` to `dustbunny_walk.png` and prompt to:
```
"The same gray menacing bunny from idle — now in mid-hop, both back legs pushed up off the ground, ears flapping back, angry expression maintained. Same painterly storybook art style. Side view facing right, transparent background, no shadow."
```

Add the idle image you just generated as an additional reference:
```json
"reference_images": [
  "/Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor.png",
  "/Users/mattod/Projects/Weezy2/assets/sprites/enemies/storybook/dustbunny_idle.png"
]
```

- [ ] **Step 3: Generate attack pose**

Same args including the idle reference, change to `dustbunny_attack.png` and prompt:
```
"The same gray menacing bunny — now lunging forward in attack pose, mouth open showing buck teeth, front paws extended, ears flat back, eyes wide with rage. Same painterly storybook art style. Side view facing right, transparent background, no shadow."
```

- [ ] **Step 4: SendUserFile + review checkpoint (3 frames)**

---

### Task 10: Generate Spider (3 poses)

**Files:**
- Create: `assets/sprites/enemies/storybook/spider_idle.png`, `spider_walk.png`, `spider_attack.png`

- [ ] **Step 1: Generate idle pose**

```json
{
  "conversation_id": "eloise-art-2026-05-24",
  "aspect_ratio": "1:1",
  "reference_images": ["/Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor.png"],
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/enemies/storybook/spider_idle.png",
  "prompt": "A menacing-but-cartoonish dark purple spider with eight legs, eight glowing yellow eyes arranged in clusters, fanged mouth in a sneer, slightly goofy proportions (oversized round body, spindly legs). Bowser-lite vibe — clearly the bad guy but cartoonish. Same painterly storybook art style as the reference image. Standing pose viewed from front-three-quarters, transparent background, no shadow."
}
```

- [ ] **Step 2: Generate walk pose**

Same args plus idle reference, change to `spider_walk.png`:
```
"The same dark purple spider — now mid-scuttle, 4 legs lifted off the ground in scampering motion, body slightly lowered. Same painterly storybook art style. Front-three-quarters view, transparent background, no shadow."
```

- [ ] **Step 3: Generate attack pose**

```
"The same dark purple spider — rearing up on its back legs, front legs raised threateningly, fangs bared, all eight eyes wide with menace. Same painterly storybook art style. Front view, transparent background, no shadow."
```

- [ ] **Step 4: SendUserFile + review checkpoint**

---

### Task 11: Generate T-Rex boss (3 poses)

**Files:**
- Create: `assets/sprites/bosses/storybook/trex_idle.png`, `trex_walk.png`, `trex_roar.png`

- [ ] **Step 1: Generate idle pose**

```json
{
  "conversation_id": "eloise-art-2026-05-24",
  "aspect_ratio": "3:2",
  "reference_images": ["/Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor.png"],
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/bosses/storybook/trex_idle.png",
  "prompt": "A big menacing-but-cartoonish bright green T-Rex boss enemy, Bowser-lite vibe — clearly the main villain but kid-friendly. Large head with sharp teeth, small comical T-Rex arms, thick muscular tail, big stomping feet, glowing red eyes, slight smirk. Same painterly storybook art style as the reference image. Standing pose, side view facing left, transparent background, no shadow."
}
```

Note: aspect_ratio is `3:2` here (T-Rex is wider than tall in side profile).

- [ ] **Step 2: Generate walk pose**

Same args plus idle reference, change to `trex_walk.png`:
```
"The same green T-Rex — now mid-stride stomping forward, one massive leg lifted, the other planted, tail counterbalancing, head tilted slightly down. Same painterly storybook art style. Side view facing left, transparent background, no shadow."
```

- [ ] **Step 3: Generate roar pose**

```
"The same green T-Rex — now roaring with mouth wide open showing teeth, head tilted back, arms thrown forward, eyes furious. Same painterly storybook art style. Side view facing left, transparent background, no shadow."
```

- [ ] **Step 4: SendUserFile + review checkpoint**

---

## Phase 6: Single-pose enemies

### Task 12: Generate Ant + Dust Mite

**Files:**
- Create: `assets/sprites/enemies/storybook/ant.png`, `dustmite.png`

- [ ] **Step 1: Generate Ant**

```json
{
  "conversation_id": "eloise-art-2026-05-24",
  "aspect_ratio": "3:2",
  "reference_images": ["/Users/mattod/Projects/Weezy2/assets/sprites/_anchors/eloise-anchor.png"],
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/enemies/storybook/ant.png",
  "prompt": "A menacing-but-cartoonish red-orange ant, Bowser-lite vibe, with angry expression, sharp mandibles, oversized head, three body segments, six legs scuttling, antennae bent back. Clearly a bad guy but cartoonish. Same painterly storybook art style as the reference image. Side view facing right, transparent background, no shadow."
}
```

- [ ] **Step 2: Generate Dust Mite**

```json
{
  "aspect_ratio": "1:1",
  "output_path": "/Users/mattod/Projects/Weezy2/assets/sprites/enemies/storybook/dustmite.png",
  "prompt": "A menacing-but-cartoonish fuzzy ball-shaped dust mite enemy, mostly spherical body covered in soft gray fuzz, with tiny stubby legs poking out, two angry glowing eyes, scowling expression. Bowser-lite vibe — clearly bad but cartoonish. Same painterly storybook art style as the reference image. Front-three-quarters view, transparent background, no shadow."
}
```
(Keep `conversation_id` and `reference_images` from Step 1.)

- [ ] **Step 3: SendUserFile + review checkpoint**

---

## Phase 7: Code integration

### Task 13: Add storybook texture-key constants

**Files:**
- Modify: `src/config/textures.ts`

- [ ] **Step 1: Replace the file with the new constants**

Write to `src/config/textures.ts`:

```typescript
/** Texture keys for storybook-illustrated character sprites loaded as PNGs in BootScene. */

export const STORYBOOK_PREFIX = "sb_";

// Eloise — 8 frames total (idle + 6 walk + jump)
export const ELOISE_IDLE = `${STORYBOOK_PREFIX}eloise_idle`;
export const ELOISE_JUMP = `${STORYBOOK_PREFIX}eloise_jump`;
export const ELOISE_WALK_FRAMES = [0, 1, 2, 3, 4, 5].map(
  (i) => `${STORYBOOK_PREFIX}eloise_walk_${i}`,
);
export const ELOISE_WALK_ANIM = "anim_eloise_walk";

// Companions
export const TEDDY = `${STORYBOOK_PREFIX}teddy`;
export const DOG = `${STORYBOOK_PREFIX}dog`;
export const HORSE = `${STORYBOOK_PREFIX}horse`;
export const CAT = `${STORYBOOK_PREFIX}cat`;
export const FLAMINGO = `${STORYBOOK_PREFIX}flamingo`;

// Enemies — 3-pose
export const DUSTBUNNY_IDLE = `${STORYBOOK_PREFIX}dustbunny_idle`;
export const DUSTBUNNY_WALK = `${STORYBOOK_PREFIX}dustbunny_walk`;
export const DUSTBUNNY_ATTACK = `${STORYBOOK_PREFIX}dustbunny_attack`;
export const SPIDER_IDLE = `${STORYBOOK_PREFIX}spider_idle`;
export const SPIDER_WALK = `${STORYBOOK_PREFIX}spider_walk`;
export const SPIDER_ATTACK = `${STORYBOOK_PREFIX}spider_attack`;

// Enemies — single-pose
export const ANT = `${STORYBOOK_PREFIX}ant`;
export const DUSTMITE = `${STORYBOOK_PREFIX}dustmite`;

// Boss
export const TREX_IDLE = `${STORYBOOK_PREFIX}trex_idle`;
export const TREX_WALK = `${STORYBOOK_PREFIX}trex_walk`;
export const TREX_ROAR = `${STORYBOOK_PREFIX}trex_roar`;

/** All storybook texture keys — used to skip nearest-neighbor filtering. */
export const STORYBOOK_KEYS = [
  ELOISE_IDLE,
  ELOISE_JUMP,
  ...ELOISE_WALK_FRAMES,
  TEDDY,
  DOG,
  HORSE,
  CAT,
  FLAMINGO,
  DUSTBUNNY_IDLE,
  DUSTBUNNY_WALK,
  DUSTBUNNY_ATTACK,
  SPIDER_IDLE,
  SPIDER_WALK,
  SPIDER_ATTACK,
  ANT,
  DUSTMITE,
  TREX_IDLE,
  TREX_WALK,
  TREX_ROAR,
];
```

This intentionally removes the legacy `ELOISE_FRAME_PREFIX` and `eloiseFrameKey()` helpers — they're replaced by the new constants. The compiler will surface any code that still references the old names; Task 15 handles those.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/mattod/Projects/Weezy2 && npm run typecheck
```

Expected: ONE error category — `src/scenes/BootScene.ts` and `src/entities/Player.ts` reference the removed `eloiseFrameKey` import. That's expected and fixed in subsequent tasks. Other files should not error.

---

### Task 14: Update BootScene to preload PNGs

**Files:**
- Modify: `src/scenes/BootScene.ts`

- [ ] **Step 1: Replace the file**

Write to `src/scenes/BootScene.ts`:

```typescript
import Phaser from "phaser";
import {
  ELOISE_IDLE,
  ELOISE_JUMP,
  ELOISE_WALK_FRAMES,
  ELOISE_WALK_ANIM,
  TEDDY,
  DOG,
  HORSE,
  CAT,
  FLAMINGO,
  DUSTBUNNY_IDLE,
  DUSTBUNNY_WALK,
  DUSTBUNNY_ATTACK,
  SPIDER_IDLE,
  SPIDER_WALK,
  SPIDER_ATTACK,
  ANT,
  DUSTMITE,
  TREX_IDLE,
  TREX_WALK,
  TREX_ROAR,
  STORYBOOK_KEYS,
} from "../config/textures";
import { TOKEN_TEXTURE } from "../entities/Token";

export const PLANK_TEXTURE = "tex_plank";
export const HEART_FULL_TEXTURE = "tex_heart_full";
export const HEART_EMPTY_TEXTURE = "tex_heart_empty";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Eloise
    this.load.image(ELOISE_IDLE, "assets/sprites/player/storybook/eloise_idle.png");
    this.load.image(ELOISE_JUMP, "assets/sprites/player/storybook/eloise_jump.png");
    for (let i = 0; i < ELOISE_WALK_FRAMES.length; i += 1) {
      this.load.image(
        ELOISE_WALK_FRAMES[i]!,
        `assets/sprites/player/storybook/eloise_walk_${i}.png`,
      );
    }

    // Companions
    this.load.image(TEDDY, "assets/sprites/companions/storybook/teddy.png");
    this.load.image(DOG, "assets/sprites/companions/storybook/dog.png");
    this.load.image(HORSE, "assets/sprites/companions/storybook/horse.png");
    this.load.image(CAT, "assets/sprites/companions/storybook/cat.png");
    this.load.image(FLAMINGO, "assets/sprites/companions/storybook/flamingo.png");

    // Enemies
    this.load.image(DUSTBUNNY_IDLE, "assets/sprites/enemies/storybook/dustbunny_idle.png");
    this.load.image(DUSTBUNNY_WALK, "assets/sprites/enemies/storybook/dustbunny_walk.png");
    this.load.image(DUSTBUNNY_ATTACK, "assets/sprites/enemies/storybook/dustbunny_attack.png");
    this.load.image(SPIDER_IDLE, "assets/sprites/enemies/storybook/spider_idle.png");
    this.load.image(SPIDER_WALK, "assets/sprites/enemies/storybook/spider_walk.png");
    this.load.image(SPIDER_ATTACK, "assets/sprites/enemies/storybook/spider_attack.png");
    this.load.image(ANT, "assets/sprites/enemies/storybook/ant.png");
    this.load.image(DUSTMITE, "assets/sprites/enemies/storybook/dustmite.png");

    // Boss
    this.load.image(TREX_IDLE, "assets/sprites/bosses/storybook/trex_idle.png");
    this.load.image(TREX_WALK, "assets/sprites/bosses/storybook/trex_walk.png");
    this.load.image(TREX_ROAR, "assets/sprites/bosses/storybook/trex_roar.png");
  }

  create(): void {
    this.createPlankTexture();
    this.createHeartTextures();
    this.createTokenTexture();
    this.createEloiseWalkAnimation();
    this.applyCrispFilters();
    this.scene.start("MenuScene");
  }

  /** Builds Eloise's 6-frame walk anim. Other characters use single-frame switching. */
  private createEloiseWalkAnimation(): void {
    this.anims.create({
      key: ELOISE_WALK_ANIM,
      frames: ELOISE_WALK_FRAMES.map((key) => ({ key })),
      frameRate: 10,
      repeat: -1,
    });
  }

  /**
   * Nearest-neighbor filtering for procedural pixel textures (planks, hearts, token).
   * Storybook PNGs use the default LINEAR filter for smooth scaling.
   */
  private applyCrispFilters(): void {
    const pixelKeys = [PLANK_TEXTURE, HEART_FULL_TEXTURE, HEART_EMPTY_TEXTURE, TOKEN_TEXTURE];
    for (const key of pixelKeys) {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    for (const key of STORYBOOK_KEYS) {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
  }

  /** Light blue planks — pops against beige bedroom art. */
  private createPlankTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xb8e8ff);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x9dd4f5);
    g.fillRect(0, 4, 16, 2);
    g.fillRect(0, 10, 16, 1);
    g.fillStyle(0xdaf4ff);
    g.fillRect(0, 0, 16, 1);
    g.fillStyle(0x7ec0e8);
    g.fillRect(15, 0, 1, 16);
    g.fillRect(0, 15, 16, 1);
    g.generateTexture(PLANK_TEXTURE, 16, 16);
    g.destroy();
  }

  private createHeartTextures(): void {
    const full = this.make.graphics({ x: 0, y: 0 });
    full.fillStyle(0xff4f6d);
    full.fillRect(2, 4, 4, 4);
    full.fillRect(6, 2, 4, 6);
    full.fillRect(10, 4, 4, 4);
    full.fillRect(4, 8, 8, 4);
    full.fillRect(6, 10, 4, 2);
    full.generateTexture(HEART_FULL_TEXTURE, 16, 16);
    full.destroy();

    const empty = this.make.graphics({ x: 0, y: 0 });
    empty.lineStyle(1, 0xff4f6d, 1);
    empty.strokeRect(2, 4, 4, 4);
    empty.strokeRect(6, 2, 4, 6);
    empty.strokeRect(10, 4, 4, 4);
    empty.strokeRect(4, 8, 8, 4);
    empty.generateTexture(HEART_EMPTY_TEXTURE, 16, 16);
    empty.destroy();
  }

  private createTokenTexture(): void {
    const token = this.make.graphics({ x: 0, y: 0 });
    token.fillStyle(0xffcc33);
    token.fillRect(1, 1, 6, 6);
    token.fillStyle(0xffee99);
    token.fillRect(2, 2, 4, 4);
    token.fillStyle(0xffa500);
    token.fillRect(3, 0, 2, 8);
    token.fillRect(0, 3, 8, 2);
    token.fillStyle(0xffffff);
    token.fillRect(3, 3, 2, 2);
    token.generateTexture(TOKEN_TEXTURE, 8, 8);
    token.destroy();
  }
}
```

This removes the procedural `createDustBunnyTexture`, `createTeddyTexture`, `createEloiseFrameTexture`, and `drawEloiseReadable` methods. They are replaced by `preload()` PNG loads.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/mattod/Projects/Weezy2 && npm run typecheck
```

Expected: remaining errors are in `src/entities/Player.ts`, `src/entities/Companion.ts`, and `src/entities/DustBunny.ts` — those still import removed symbols (`eloiseFrameKey`, `TEDDY_TEXTURE`, `DUST_BUNNY_TEXTURE`). Tasks 15-17 fix them.

---

### Task 15: Update Player to use the new sprites + animation

**Files:**
- Modify: `src/entities/Player.ts`

- [ ] **Step 1: Read the current file to understand what changes**

```bash
cat /Users/mattod/Projects/Weezy2/src/entities/Player.ts
```

- [ ] **Step 2: Replace `eloiseFrameKey` usage with the new texture keys**

Find every import of `eloiseFrameKey` (currently from `../config/textures`) and replace with imports of `ELOISE_IDLE`, `ELOISE_JUMP`, and `ELOISE_WALK_FRAMES`.

Find every call to `this.setTexture(eloiseFrameKey(N))` and replace with:
- For idle/standing: `this.setTexture(ELOISE_IDLE); this.anims.stop()`
- For walking: `this.play(ELOISE_WALK_ANIM, true)` (import `ELOISE_WALK_ANIM` from `../config/textures`)
- For jumping/airborne: `this.anims.stop(); this.setTexture(ELOISE_JUMP)`

The exact placements depend on the file's current state-machine. Read the file and adjust state-transition logic so:
- On `idle` (velocity ≈ 0, grounded): use ELOISE_IDLE
- On `walk` (|velocity.x| > 0, grounded): play `eloise_walk` anim
- On `jump`/`fall` (not grounded): use ELOISE_JUMP

The Player constructor's initial `setTexture` call should use `ELOISE_IDLE`.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/mattod/Projects/Weezy2 && npm run typecheck
```

Expected: no errors from `Player.ts`. Companion and DustBunny still error — fixed in next tasks.

---

### Task 16: Generalize Companion to accept a texture key

**Files:**
- Modify: `src/entities/Companion.ts`

- [ ] **Step 1: Replace the file**

Write to `src/entities/Companion.ts`:

```typescript
import { GameState } from "../state/GameState";
import { RENDER_SCALE } from "../config/game";
import { TEDDY } from "../config/textures";

/** Default companion texture (Bedroom — Teddy). Re-exported for backwards-compat with BootScene. */
export const TEDDY_TEXTURE = TEDDY;

export type PathPoint = { x: number; y: number };

/** Companion follows player path with delay using a ring buffer of positions. */
export class Companion extends Phaser.GameObjects.Sprite {
  private readonly history: PathPoint[] = [];
  private readonly delayFrames = 18;
  private collected = false;
  private waitX = 0;
  private waitY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string = TEDDY) {
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setScale(RENDER_SCALE);
    this.setDepth(6);
    this.waitX = x;
    this.waitY = y;
  }

  configurePickup(x: number, y: number): void {
    const state = GameState.get();
    this.waitX = x;
    this.waitY = y;
    this.collected = state.teddyCollected;
    this.history.length = 0;
    this.setVisible(true);
    if (this.collected) {
      this.setAlpha(1);
    } else {
      this.setPosition(x, y);
    }
  }

  getPickupBounds(): { x: number; y: number; w: number; h: number } {
    const pad = 10 * RENDER_SCALE;
    const h = 20 * RENDER_SCALE;
    return { x: this.waitX - pad, y: this.waitY - h, w: pad * 2, h };
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;
    GameState.get().collectTeddy();
    this.scene.events.emit("hud-update");
  }

  isCollected(): boolean {
    return this.collected;
  }

  pushPlayerPosition(x: number, y: number): void {
    this.history.push({ x, y });
    if (this.history.length > 256) {
      this.history.shift();
    }
    if (!this.collected) {
      this.setPosition(this.waitX, this.waitY);
      return;
    }
    const idx = Math.max(0, this.history.length - 1 - this.delayFrames);
    const p = this.history[idx]!;
    this.setPosition(p.x - 14 * RENDER_SCALE, p.y);
  }

  resetHistoryNear(x: number, y: number): void {
    this.history.length = 0;
    for (let i = 0; i < this.delayFrames + 1; i += 1) {
      this.history.push({ x, y });
    }
    if (this.collected) {
      this.setPosition(x - 14 * RENDER_SCALE, y);
    }
  }
}
```

The third constructor argument is now an optional `textureKey` (defaults to TEDDY). The re-exported `TEDDY_TEXTURE = TEDDY` keeps `BootScene.ts`'s old import contract — though BootScene no longer imports it after Task 14, so this is purely for any other file that still might. Safe to remove later if confirmed unused.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/mattod/Projects/Weezy2 && npm run typecheck
```

Expected: no errors from `Companion.ts`. DustBunny still errors — fixed next.

---

### Task 17: Wire DustBunny to the 3-pose state machine

**Files:**
- Modify: `src/entities/DustBunny.ts`

- [ ] **Step 1: Read the current file**

```bash
cat /Users/mattod/Projects/Weezy2/src/entities/DustBunny.ts
```

- [ ] **Step 2: Replace the file**

Write to `src/entities/DustBunny.ts`:

```typescript
import Phaser from "phaser";
import type { EnemySpawn } from "../types/level";
import { Enemy } from "./Enemy";
import {
  DUSTBUNNY_IDLE,
  DUSTBUNNY_WALK,
  DUSTBUNNY_ATTACK,
} from "../config/textures";

/** Re-exported for any external callers. */
export const DUST_BUNNY_TEXTURE = DUSTBUNNY_IDLE;

type DustBunnyPose = "idle" | "walk" | "attack";

export class DustBunny extends Enemy {
  private currentPose: DustBunnyPose = "idle";

  constructor(scene: Phaser.Scene, spawn: EnemySpawn) {
    super(scene, spawn, DUSTBUNNY_IDLE);
    this.setPose("idle");
  }

  /** Switch displayed texture based on current behavior state. */
  setPose(pose: DustBunnyPose): void {
    if (pose === this.currentPose) return;
    this.currentPose = pose;
    const key =
      pose === "idle"
        ? DUSTBUNNY_IDLE
        : pose === "walk"
          ? DUSTBUNNY_WALK
          : DUSTBUNNY_ATTACK;
    this.setTexture(key);
  }

  // Existing isDefeated, patrol, etc. methods stay — adjust as needed per the
  // current file. If the file already has an `update()` method, add pose
  // selection logic to it: when moving, setPose("walk"); when stationary,
  // setPose("idle"); when attacking, setPose("attack").
}
```

Important: the Enemy base class constructor signature must accept a texture key. Check `src/entities/Enemy.ts` — if it currently hardcodes the texture, modify it to accept one as a 3rd argument.

- [ ] **Step 3: Check + adjust Enemy base class if needed**

```bash
cat /Users/mattod/Projects/Weezy2/src/entities/Enemy.ts
```

If the constructor does not accept a texture key, modify it to:

```typescript
constructor(scene: Phaser.Scene, spawn: EnemySpawn, textureKey: string) {
  super(scene, spawn.x, spawn.y, textureKey);
  // ... existing body
}
```

(Adjust to match existing signature shape — call `super(scene.physics.world, scene, x, y, textureKey)` if Phaser.Physics.Arcade.Sprite, etc.)

- [ ] **Step 4: Typecheck**

```bash
cd /Users/mattod/Projects/Weezy2 && npm run typecheck
```

Expected: clean (zero errors).

- [ ] **Step 5: Preserve existing DustBunny behavior**

Compare the rewritten `DustBunny.ts` against the original by reading both. Ensure every property and method the original had is preserved (patrol speed, defeat-on-stomp, etc.). The new code adds `setPose()` and removes the old single-texture line — nothing else should be lost.

---

### Task 18: Build + verify

- [ ] **Step 1: Run the full build**

```bash
cd /Users/mattod/Projects/Weezy2 && npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 2: Start dev server**

```bash
cd /Users/mattod/Projects/Weezy2 && npm run dev
```

Expected: Vite reports server at http://localhost:5173 (or another port if 5173 is busy).

- [ ] **Step 3: Manual playtest checklist**

Open http://localhost:5173 in a browser, click the canvas to focus, then verify:

- [ ] Eloise's idle pose renders as the storybook PNG (not the chunky procedural pink rectangle)
- [ ] Pressing arrow keys / A-D plays the walk cycle smoothly (all 6 frames visible, no jitter)
- [ ] Pressing space switches Eloise to the jump pose mid-air, returns to idle/walk on landing
- [ ] Teddy renders as the storybook PNG in the bedroom level
- [ ] Dust Bunny renders as the storybook idle pose; when it patrols, switches to walk pose
- [ ] No missing-texture purple/black squares anywhere
- [ ] Collision boxes still work — Eloise can stomp Dust Bunny

Report any failures back; do not proceed to cleanup until all check.

---

### Task 19: Cleanup — remove obsolete procedural texture exports

**Files:**
- Modify: `src/entities/DustBunny.ts` (remove backwards-compat `DUST_BUNNY_TEXTURE` re-export if unused)
- Modify: `src/entities/Companion.ts` (remove `TEDDY_TEXTURE` re-export if unused)

- [ ] **Step 1: Check whether the re-exports are still referenced**

```bash
cd /Users/mattod/Projects/Weezy2 && grep -rn "DUST_BUNNY_TEXTURE\|TEDDY_TEXTURE" src/
```

If the only references are the export lines themselves (no consumers), delete those export lines from both files. If anything still imports them, leave them in place.

- [ ] **Step 2: Final typecheck + build**

```bash
cd /Users/mattod/Projects/Weezy2 && npm run typecheck && npm run build
```

Expected: clean.

---

## Out-of-scope reminders (do NOT do in this plan)

- Do not wire Dog / Horse / Cat / Flamingo into actual gameplay — their sprites are generated and present in `assets/`, but their entity classes are deferred to a future spec.
- Do not wire Spider, Ant, Dust Mite, or T-Rex into gameplay — sprites only.
- Do not regenerate backgrounds.
- Do not pack a texture atlas.
