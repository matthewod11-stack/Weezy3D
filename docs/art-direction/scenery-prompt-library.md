# Princess Eloise — 3D Scenery Prompt Library

> Generated from analysis of Weezy2 art direction docs, Fable's Three.js worldbuilding approach (June 2026), and the existing storybook character art spec.
>
> **Context:** The tweet that inspired this project showed Fable generating rich 3D browser environments from "literally just a few lines of prompt" using custom Three.js running in the browser. This library applies that same technique to Princess Eloise's world.

---

## How to Use This Library

Every prompt in this library follows the same structure:

```
[Biome/setting] + [mood/atmosphere] + [key visual anchors] + [style/palette] + [technical spec]
```

The **Technical Spec Block** (defined below) is appended to every scenery generation prompt. It encodes Eloise's camera geometry and Three.js requirements.

---

## The Technical Spec Block

Append this to every world-specific prompt:

> *Side-scrolling 3D platformer environment built in Three.js, running in the browser. Scene is viewed from a fixed side-on perspective camera (orthographic or slight perspective, approximately 45-60mm equivalent). The navigable play space is roughly 3:1 wide (horizontal scrolling). Ground/floor plane at y=0. Geometry should emphasize depth layers: a far background layer (soft, slightly blurred by depth-of-field), a mid-ground layer with most of the gameplay architecture, and a near-ground layer with floor details + foreground dressing. Lighting via THREE.DirectionalLight (warm) + THREE.AmbientLight (fill). Use fog (THREE.Fog or FogExp2) for depth. Palette must be cohesive. Output as a Three.js scene setup with geometry, materials, lighting, and fog — minimal code, maximal visual result.*

---

## The Master Style Anchor Prompt

**Generate this first.** Save the result as the reference for all subsequent prompts.

> A side-scrolling 3D platformer environment in Three.js: a cozy child's bedroom seen from the perspective of a tiny creature. Ordinary bedroom furniture (bookshelf, crib, toy chest) looms at platformer-level scale. Soft painterly lighting — warm lamp glow from off-screen right, cool ambient from a window off-screen left. Storybook atmosphere: the visual mood of "Princess and the Frog" or "Over the Garden Wall" background art, but rendered as real 3D geometry with soft materials. Rich depth: blurry pastel wallpaper far plane, mid-ground wooden shelf surfaces and toy objects, crisp near-ground carpet floor. Warm palette — dusty rose, cream, muted teal, buttery yellow. No characters. THREE.Fog for atmosphere. [Append Technical Spec Block]

**This image/scene is the style lock. Every subsequent generation references it.**

---

## World-by-World Prompt Library

### World 1 — Bedroom
**Palette:** Dusty rose · cream · muted sage · warm amber lamplight  
**Mood:** Cozy, safe, wondrous — the familiar made vast

**Scene anchor prompt:**
> A 3D side-scrolling platformer bedroom environment seen from ant-scale. A towering wooden bookshelf dominates the mid-ground — its shelves are the primary platforms. Stuffed animals and board books perched on shelves like landmark objects. Warm lamp glow from the right. Soft wallpaper pattern in the far background (slightly blurred by fog). Carpet floor with soft texture. Dusty rose, cream, sage green palette. Storybook warmth. [Technical Spec Block]

**Per-level hero objects (swap into "mid-ground layer"):**
- **1-1 Bookshelf Lower** — lower three shelves, books and toy clutter, ground-level entry
- **1-2 Bookshelf Climb** — upper shelves opening up, teddy bears as landmark silhouettes
- **1-3 Crib Crossing** — white wooden crib bars as vertical obstacles, mobile hanging overhead
- **1-4 Eloise's Corner** — small desk, scattered crayons, personal toys visible in background

---

### World 2 — Hallway
**Palette:** Slate blue · warm wood · grey carpet · cool window light from end  
**Mood:** Slightly liminal, narrow, a little dramatic — the world outside the bedroom

**Scene anchor prompt:**
> A 3D hallway environment from floor level — hardwood or tile, a carpeted runner down the center. A wooden bench overhead casts a long shadow. A shoe rack on the right looms like canyon walls. Cool blue-grey ambient light from a window at the far end creates a vanishing-point depth cue. Warm wood tones on the bench and baseboard trim. Slightly narrow and mysterious. [Technical Spec Block]

**Per-level hero objects:**
- **2-1 Under the Bench** — bench underside as a ceiling, shoes as obstacles
- **2-2 Shoe Canyon** — towering shoe rack on both sides, dramatic silhouette
- **2-3 Floor Sprint** — long open run, checkered tile, speed feeling
- **2-4 Entry Shelf Climb** — tall entryway shelf unit, bags and hooks as landmarks

---

### World 3 — Kitchen
**Palette:** Cream · chrome silver · warm orange (stove glow) · terracotta tile  
**Mood:** Adventurous and slightly dangerous — the stove is a volcano

**Scene anchor prompt:**
> A 3D kitchen environment from the perspective of something very small. Countertop edges are the primary vertical cliff faces — gleaming chrome and white laminate. A gas stove glows deep orange-red in the mid-background like a distant volcano. Terracotta or white subway tile floor. Overhead light creates hard downward shadows on the counters. Cream and chrome palette with the warm orange stove as the only saturated accent. [Technical Spec Block]

**Per-level hero objects:**
- **3-1 Counter Start** — floor-to-counter base, cabinet faces as wall surface
- **3-2 Stove Hot Zone** — stove glow lighting up the mid-ground, heat shimmer effect if possible
- **3-3 Sink Crossing** — stainless steel sink edge as a gap obstacle, dripping water particle
- **3-4 Fridge Climb** — refrigerator face as a tall wall, handle as a grip point

---

### World 4 — Family Room
**Palette:** Warm amber · burgundy · cream · fireplace orange  
**Mood:** Epic and cozy — the sofa is a mountain range

**Scene anchor prompt:**
> A 3D family room from floor level. A plush sofa dominates the mid-ground — its cushions are the primary platforms, soft-edged and massive. A fireplace glows amber in the far background, illuminating the whole scene with warm flickering light. An entertainment center with shelves on the right holds remote controls and game cases like monolithic slabs. Thick carpet floor. Warm amber, burgundy, cream palette with fireplace as the hero light source. [Technical Spec Block]

**Per-level hero objects:**
- **4-1 Fireplace Passage** — mantle edge platform, fire glow from below
- **4-2 Stuffie Mountain** — pile of stuffed animals as organic platform terrain
- **4-3 Entertainment Center** — shelving unit with geometric platform layout
- **4-4 Wall Unit Climb** — tall built-in unit, vertical traverse up through shelves

---

### World 5 — Backyard *(the only outdoor area)*
**Palette:** Saturated green · sky blue · warm brown · flower pink accents  
**Mood:** Open, sunny, energetic — the most different from all indoor worlds

**Scene anchor prompt:**
> A 3D backyard environment from ground level — grass blades tower overhead like trees, their scale emphasizing the tiny protagonist. A wooden playset/swing set in the mid-ground, massive and sun-bleached. Hedgerows form the background walls. Bright midday sunlight from above with crisp shadows. Saturated green grass, sky blue above, warm brown wood, flower patches in the background layer. The most open and bright scene in the game. [Technical Spec Block]

**Per-level hero objects:**
- **5-1 Play Corner** — sandbox edge and toy trucks as obstacles
- **5-2 Craft Table** — outdoor picnic table, art supplies scattered
- **5-3 Lego Zone / Kiddie Pool** — kiddie pool edge as a gap, water shimmer
- **5-4 Dad's Corner / Treehouse Finale** — treehouse ladder rungs as platforms, elevated canopy

---

### World 6 — Playhouse / Dollhouse *(boss world)*
**Palette:** Lavender · mint green · golden yellow · pastel everything  
**Mood:** Dreamlike and slightly strange — oversaturated, magical, the game's climax

**Scene anchor prompt:**
> A 3D dollhouse interior rendered at platformer scale — miniature furniture feels life-size. Tiny wallpaper patterns with polka dots or gingham. Small wooden floors with painted seams. A rooftop terrace accessible at the top of the scene. Slightly dreamlike and oversaturated compared to all previous worlds — lavender walls, mint trim, golden yellow accents. The lighting is warm and even, almost theatrical. [Technical Spec Block]

**Per-level hero objects:**
- **6-1 Dollhouse Entrance** — front door arch, petite hallway proportions
- **6-2 Second Floor** — staircase as ramp, tiny bedroom furniture
- **6-3 Third Floor** — parlor room, tiny chandelier as overhead landmark
- **6-4 Rooftop Boss** — open roof terrace, chimney pots as obstacles, sky visible above

---

## Boss Arena — T-Rex Fight

This is a special-case scene, not a scrolling level:

> A 3D boss arena inside the playhouse rooftop — a wide, flat stage with low walls on both sides. The T-Rex occupies the right third of the scene. Floor is painted wood with visible seams. Sky visible above. Warm golden light. The arena should feel slightly theatrical — like a stage set. Wide enough for dodge choreography. The T-Rex's side of the arena has slightly warmer, more dramatic orange lighting. [Technical Spec Block, modified: "Fixed-width arena, not scrolling. Camera stays centered."]

---

## Three.js Atmosphere Knobs

For every scene, tune these Three.js parameters after generation. These map directly to the Weezy2 visual DNA:

| Parameter | Bedroom | Hallway | Kitchen | Family Room | Backyard | Playhouse |
|---|---|---|---|---|---|---|
| `THREE.Fog color` | `0xf5e8d0` warm cream | `0xc5cfd8` cool blue | `0xfff8f0` warm white | `0xf0d8b0` amber | `0xd8f0d0` sky green | `0xf0d8ff` lavender |
| `THREE.Fog near/far` | 8 / 30 | 6 / 25 | 10 / 35 | 8 / 30 | 15 / 60 | 6 / 20 |
| `DirectionalLight intensity` | 0.8 (warm) | 0.5 (cool) | 1.0 (overhead hard) | 0.7 (fire-warm) | 1.4 (bright sun) | 0.9 (theatrical) |
| `AmbientLight intensity` | 0.4 | 0.6 | 0.3 | 0.5 | 0.6 | 0.5 |
| Post-process bloom | subtle | none | none | fireplace only | none | moderate |

---

## Quick-Start: The 3-Sentence Test Prompt

When you just want to validate the approach before going per-world:

> *Three.js 3D platformer scene, child's bedroom from ant-scale. Storybook watercolor-inspired materials, warm lamp lighting, Three.Fog for depth, dusty rose and cream palette. Ground at y=0, side-scrolling camera, no characters, deep parallax with three geometry layers.*

This is the minimal viable prompt that establishes all the technical and aesthetic constraints in under 50 words.
