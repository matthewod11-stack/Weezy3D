# 3D Backgrounds Pass 2 — Candy-Fantastical Texture Pass: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-theme all five 3D worlds with AI-generated textures (Gemini image API, the user's 3 inspiration JPEGs as style refs) applied to procedural geometry — sequentially, one world at a time, recording learnings.

**Architecture:** A one-shot generation script writes texture files into `assets/textures3d/<world>/`; a typed manifest imports them as Vite asset URLs; shared `candySet.ts` builders (porthole window, hero appliance, sparkles) consume injected `THREE.Texture`s so geometry logic stays unit-testable in node. Each world's `<world>Set.ts` is rewired in place. Spec: `docs/superpowers/specs/2026-06-11-3d-backgrounds-pass2-candy-design.md`.

**Tech Stack:** Three.js, Vite asset imports (`?url`), Vitest (node env), Gemini image API (`gemini-3-pro-image-preview` / `gemini-3.1-flash-image-preview`).

**⚠️ Repo conventions:**
- Weezy3D is **intentionally untracked** — there are NO git commit steps. Each task ends with the build gate (`npm run build`) instead.
- Diorama z-convention: solids end at z=0; glow panes offset ≥0.05 from the surface behind (playbook §2, gotcha #11). `fogNear ≥ 12` (pinned by test). No `Math.random` in set code.
- Visual verification uses the dev server + `window.__weezy3d` (`snapCamera()`, `jumpToSegment(i)`) + `preview_screenshot` (playbook §4).
- **User checkpoint after every world** — show screenshots vs inspiration, wait for feedback before the next world. The user is learning/steering each installment.

**File structure:**

| File | Responsibility |
|---|---|
| `scripts/gen-texture.mjs` (create) | CLI: prompt + ref images → Gemini image API → file on disk |
| `assets/textures3d/<world>/*.jpg` (create) | Generated texture assets, one dir per world |
| `src/three/textureSlots.ts` (create) | Pure manifest-of-record: which files each textured world requires (no Vite imports) |
| `src/three/textureSlots.test.ts` (create) | fs-based smoke test: every expected texture file exists |
| `src/three/textureManifest.ts` (create) | Vite `?url` imports → typed `TEXTURES3D` record consumed by set files |
| `src/three/candySet.ts` (create) | Shared builders: `loadCandyTexture`, `buildPorthole`, `buildHeroAppliance`, `sparkleSeeds`/`buildSparkles`/`twinkle` |
| `src/three/candySet.test.ts` (create) | Unit tests for the pure/geometric parts (no DOM needed) |
| `src/three/{bedroom,hallway,kitchen,familyRoom,backyard}Set.ts` (modify) | Rewire each world to generated textures + motifs |
| `src/three/worldThemes.test.ts` (modify) | Update pinned fog colors **only if** a world's fog shifts |
| `docs/3d-transition/weezy3d-playbook.md` (modify) | Per-world learnings + §1/§3 updates |
| `~/.claude.json` (modify, outside repo) | nanobanana-mcp `env` fix |

---

### Task 0: Fix the nanobanana MCP for future sessions

**Files:** Modify `~/.claude.json` (two `nanobanana-mcp` blocks: top-level `mcpServers` and `projects."/Users/homebase".mcpServers`)

- [ ] **Step 1:** Read the key (do not print it): `KEY=$(grep '^export GOOGLE_AI_API_KEY=' ~/.zshrc | cut -d= -f2-)`
- [ ] **Step 2:** Back up, then set `env.GOOGLE_AI_API_KEY` on both blocks with python3 json round-trip:

```bash
cp ~/.claude.json ~/.claude.json.bak-$(date +%s)
KEY=$(grep '^export GOOGLE_AI_API_KEY=' ~/.zshrc | cut -d= -f2-) python3 - <<'EOF'
import json, os
p = os.path.expanduser("~/.claude.json")
cfg = json.load(open(p))
key = os.environ["KEY"].strip().strip('"').strip("'")
def patch(servers):
    nb = servers.get("nanobanana-mcp")
    if nb is not None: nb.setdefault("env", {})["GOOGLE_AI_API_KEY"] = key
patch(cfg.get("mcpServers", {}))
for proj in cfg.get("projects", {}).values():
    patch(proj.get("mcpServers", {}))
json.dump(cfg, open(p, "w"), indent=2)
print("patched")
EOF
```

- [ ] **Step 3:** Verify: `claude mcp list 2>/dev/null | grep nanobanana` → expect `✔ Connected` (new health check spawns with the env). This session's tool list won't gain the MCP — that's fine; the script below covers this session.

### Task 1: `scripts/gen-texture.mjs` — the generation pipeline

**Files:** Create `scripts/gen-texture.mjs`

- [ ] **Step 1:** Write the script (request shape copied from `/Users/homebase/nanobanana-mcp/dist/index.js` — same API the MCP wraps):

```js
#!/usr/bin/env node
/**
 * Generate a texture via the Gemini image API (what nanobanana-mcp wraps).
 * Usage:
 *   node scripts/gen-texture.mjs --prompt "..." --out assets/textures3d/bedroom/wallpaper.jpg \
 *     [--ref Bedroom.jpg]... [--model pro|flash] [--aspect 1:1|16:9]
 * Key: $GOOGLE_AI_API_KEY, falling back to the export line in ~/.zshrc.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { homedir } from "node:os";

const MODELS = { pro: "gemini-3-pro-image-preview", flash: "gemini-3.1-flash-image-preview" };

function arg(name, multi = false) {
  const out = [];
  const argv = process.argv;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === `--${name}`) out.push(argv[i + 1]);
  }
  return multi ? out : out[0];
}

function apiKey() {
  if (process.env.GOOGLE_AI_API_KEY) return process.env.GOOGLE_AI_API_KEY;
  const zshrc = readFileSync(resolve(homedir(), ".zshrc"), "utf8");
  const m = zshrc.match(/^export GOOGLE_AI_API_KEY=["']?([^"'\n]+)/m);
  if (!m) throw new Error("GOOGLE_AI_API_KEY not in env or ~/.zshrc");
  return m[1];
}

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const prompt = arg("prompt");
const out = arg("out");
if (!prompt || !out) {
  console.error("Required: --prompt, --out");
  process.exit(1);
}
const model = MODELS[arg("model") ?? "pro"];
const aspect = arg("aspect") ?? "1:1";
const refs = arg("ref", true);

const parts = [{ text: prompt }];
for (const ref of refs) {
  parts.push({
    inline_data: {
      mime_type: MIME[extname(ref).toLowerCase()] ?? "image/jpeg",
      data: readFileSync(ref).toString("base64"),
    },
  });
}

const body = {
  contents: [{ role: "user", parts }],
  generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: aspect } },
};

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey()}`;
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`API ${res.status}: ${(await res.text()).slice(0, 500)}`);
  process.exit(1);
}
const json = await res.json();
const image = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
if (!image) {
  console.error("No image in response:", JSON.stringify(json).slice(0, 500));
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(image.inlineData.data, "base64"));
console.log(`wrote ${out} (${image.inlineData.mimeType})`);
```

- [ ] **Step 2: Smoke test (real API, flash model for speed):**

```bash
node scripts/gen-texture.mjs --model flash --prompt "A plain bright pink square" --out /tmp/nb-smoke.jpg
file /tmp/nb-smoke.jpg   # expect: JPEG image data (or PNG written with .jpg ext — check mimeType in stdout)
```

Expected: `wrote /tmp/nb-smoke.jpg`. If the API returns PNG mimeType, that's fine — Three.js loads by content, but prefer matching extensions when generating real assets (rename if needed and keep `textureSlots.ts` truthful).

### Task 2: Texture manifest-of-record + smoke test (TDD)

**Files:** Create `src/three/textureSlots.ts`, `src/three/textureSlots.test.ts`

- [ ] **Step 1: Write the failing test:**

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPECTED_TEXTURES, TEXTURES3D_DIR } from "./textureSlots";

describe("textures3d assets", () => {
  it("lists at least the pilot world", () => {
    expect(Object.keys(EXPECTED_TEXTURES)).toContain("bedroom");
  });

  it("every expected texture file exists on disk", () => {
    for (const [world, files] of Object.entries(EXPECTED_TEXTURES)) {
      for (const file of files) {
        const p = join(process.cwd(), TEXTURES3D_DIR, world, file);
        expect(existsSync(p), `${world}/${file} missing at ${p}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/three/textureSlots.test.ts` → FAIL (module doesn't exist).
- [ ] **Step 3: Implement `textureSlots.ts`:**

```ts
/**
 * Manifest-of-record for generated 3D textures (pass-2 candy re-theme).
 * Worlds are appended HERE as they're textured — the smoke test enforces
 * that every listed file actually exists in assets/textures3d/.
 * Spec: docs/superpowers/specs/2026-06-11-3d-backgrounds-pass2-candy-design.md
 */
export const TEXTURES3D_DIR = "assets/textures3d";

export const EXPECTED_TEXTURES: Record<string, string[]> = {
  bedroom: ["wallpaper.jpg", "porthole-view.jpg", "hero-toychest.jpg", "rug.jpg"],
};
```

- [ ] **Step 4:** Run the test again → still FAIL (files don't exist yet). That's correct — Task 4's generation step is what turns it green. Move on.

### Task 3: `candySet.ts` shared builders (TDD on the pure parts)

**Files:** Create `src/three/candySet.ts`, `src/three/candySet.test.ts`

Builders take an injected `THREE.Texture` (not a URL) so they construct in node tests without DOM/network. Only `loadCandyTexture` touches `TextureLoader`, and only set files call it.

- [ ] **Step 1: Write the failing tests:**

```ts
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildHeroAppliance, buildPorthole, sparkleSeeds, twinkle } from "./candySet";

const dummyTex = () => new THREE.Texture();

describe("sparkleSeeds", () => {
  it("is deterministic for a seed and stays inside the bounds + mid-depth band", () => {
    const a = sparkleSeeds(0, 100, 7, 40);
    const b = sparkleSeeds(0, 100, 7, 40);
    expect(a).toEqual(b);
    expect(a).toHaveLength(40);
    for (const s of a) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(100);
      expect(s.y).toBeGreaterThan(0.5);
      expect(s.y).toBeLessThan(11);
      expect(s.z).toBeGreaterThanOrEqual(-6);
      expect(s.z).toBeLessThanOrEqual(-0.5);
    }
  });
});

describe("twinkle", () => {
  it("returns bounded bob and opacity", () => {
    for (let t = 0; t < 8000; t += 137) {
      const { dy, opacity } = twinkle(t, 2.1);
      expect(Math.abs(dy)).toBeLessThanOrEqual(0.45);
      expect(opacity).toBeGreaterThanOrEqual(0.25);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });
});

describe("buildPorthole", () => {
  it("offsets the view pane ≥0.05 in front of the wall (z-fighting rule)", () => {
    const g = buildPorthole({ x: 10, cy: 5.5, radius: 2, view: dummyTex(), wallZ: -8 });
    const pane = g.children.find(
      (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.CircleGeometry,
    ) as THREE.Mesh;
    expect(pane).toBeDefined();
    expect(pane.position.z).toBeGreaterThanOrEqual(-8 + 0.05);
    expect((pane.material as THREE.MeshBasicMaterial).type).toBe("MeshBasicMaterial");
  });
});

describe("buildHeroAppliance", () => {
  it("keeps the solid body fully behind z=0 (diorama convention)", () => {
    const g = buildHeroAppliance({ x: 5, w: 3, h: 4, d: 1.2, z: -2.6, face: dummyTex(), bodyColor: 0x7ad0c8 });
    const box = g.children[0] as THREE.Mesh;
    const frontZ = box.position.z + 1.2 / 2;
    expect(frontZ).toBeLessThanOrEqual(0);
    expect(frontZ).toBeCloseTo(-2.6, 5);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/three/candySet.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement `candySet.ts`:**

```ts
import * as THREE from "three";

/**
 * Shared pass-2 candy builders — porthole windows, hero appliances with
 * faces, sparkle motes. Builders take injected THREE.Texture so geometry
 * stays testable in node; only loadCandyTexture touches the loader.
 */

/** Generated-texture loader: sRGB + mirrored wrap = seam-free tiling of any output. */
export function loadCandyTexture(url: string, opts?: { mirror?: boolean }): THREE.Texture {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (opts?.mirror !== false) {
    tex.wrapS = THREE.MirroredRepeatWrapping;
    tex.wrapT = THREE.MirroredRepeatWrapping;
  }
  return tex;
}

/** Round window onto the fantasy-hills view. Emissive pane so the outside reads bright. */
export function buildPorthole(opts: {
  x: number;
  cy: number;
  radius: number;
  view: THREE.Texture;
  wallZ?: number;
  frameColor?: number;
  lightColor?: number;
}): THREE.Group {
  const wallZ = opts.wallZ ?? -8;
  const g = new THREE.Group();

  const pane = new THREE.Mesh(
    new THREE.CircleGeometry(opts.radius, 48),
    new THREE.MeshBasicMaterial({ map: opts.view }),
  );
  pane.position.set(opts.x, opts.cy, wallZ + 0.06);
  g.add(pane);

  const frame = new THREE.Mesh(
    new THREE.TorusGeometry(opts.radius + 0.1, 0.24, 12, 48),
    new THREE.MeshLambertMaterial({ color: opts.frameColor ?? 0xcf9a60 }),
  );
  frame.position.set(opts.x, opts.cy, wallZ + 0.14);
  g.add(frame);

  const light = new THREE.PointLight(opts.lightColor ?? 0xfff3c8, 4, 12, 1.4);
  light.position.set(opts.x, opts.cy, wallZ + 2.5);
  g.add(light);

  return g;
}

/** Mid-depth furniture friend: box body, generated face texture on the front (+z). */
export function buildHeroAppliance(opts: {
  x: number;
  w: number;
  h: number;
  d: number;
  /** Front face lands exactly at this z (must be ≤ 0). */
  z: number;
  face: THREE.Texture;
  bodyColor: number;
}): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: opts.bodyColor });
  const faceMat = new THREE.MeshLambertMaterial({ map: opts.face });
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z — face goes on +z.
  const box = new THREE.Mesh(new THREE.BoxGeometry(opts.w, opts.h, opts.d), [
    body, body, body, body, faceMat, body,
  ]);
  box.position.set(opts.x, opts.h / 2, opts.z - opts.d / 2);
  box.castShadow = true;
  g.add(box);
  return g;
}

export interface SparkleSeed {
  x: number;
  y: number;
  z: number;
  phase: number;
}

/** Deterministic sparkle positions through the mid-depth air (LCG, no Math.random). */
export function sparkleSeeds(minX: number, maxX: number, seed: number, count: number): SparkleSeed[] {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const seeds: SparkleSeed[] = [];
  for (let i = 0; i < count; i += 1) {
    seeds.push({
      x: minX + rand() * (maxX - minX),
      y: 1 + rand() * 9,
      z: -5.5 + rand() * 5, // -5.5..-0.5: always behind the gameplay plane
      phase: rand() * Math.PI * 2,
    });
  }
  return seeds;
}

/** Bob + opacity twinkle for one sparkle at elapsed ms. Pure. */
export function twinkle(elapsedMs: number, phase: number): { dy: number; opacity: number } {
  const t = elapsedMs / 1000;
  return {
    dy: Math.sin(t * 0.7 + phase) * 0.4,
    opacity: 0.625 + 0.375 * Math.sin(t * 2.3 + phase * 1.7),
  };
}

const sparkleSprite = (() => {
  let cached: THREE.Texture | undefined;
  return () => {
    if (cached) return cached;
    const size = 64;
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext("2d")!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,250,210,1)");
    grad.addColorStop(0.35, "rgba(255,235,150,0.85)");
    grad.addColorStop(1, "rgba(255,235,150,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    cached = new THREE.CanvasTexture(cv);
    return cached;
  };
})();

export interface SparkleField {
  group: THREE.Group;
  update(elapsedMs: number): void;
}

/** Drifting glow motes; call field.update(elapsed) from the theme's update hook. */
export function buildSparkles(
  minX: number,
  maxX: number,
  seed: number,
  opts?: { count?: number; color?: number; scale?: number },
): SparkleField {
  const seeds = sparkleSeeds(minX, maxX, seed, opts?.count ?? Math.max(14, Math.floor((maxX - minX) / 7)));
  const group = new THREE.Group();
  const sprites: THREE.Sprite[] = [];
  for (const sd of seeds) {
    const mat = new THREE.SpriteMaterial({
      map: sparkleSprite(),
      color: opts?.color ?? 0xffe9a8,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const sc = opts?.scale ?? 0.42;
    sprite.scale.set(sc, sc, 1);
    sprite.position.set(sd.x, sd.y, sd.z);
    group.add(sprite);
    sprites.push(sprite);
  }
  return {
    group,
    update(elapsedMs: number) {
      for (let i = 0; i < sprites.length; i += 1) {
        const sd = seeds[i]!;
        const { dy, opacity } = twinkle(elapsedMs, sd.phase);
        sprites[i]!.position.y = sd.y + dy;
        (sprites[i]!.material as THREE.SpriteMaterial).opacity = opacity;
      }
    },
  };
}
```

- [ ] **Step 4:** Run `npx vitest run src/three/candySet.test.ts` → PASS (4 tests). Note `buildSparkles`/`loadCandyTexture`/`sparkleSprite` are NOT unit-tested (DOM/loader) — visual verification covers them.
- [ ] **Step 5:** `npx tsc --noEmit` → clean.

### Task 4: Bedroom — generate the pilot texture set

**Files:** Create `assets/textures3d/bedroom/{wallpaper,porthole-view,hero-toychest,rug}.jpg`

Shared style suffix for ALL generations (append to every prompt):

> *Cartoony fantastical children's 3D-render style, ultra-saturated candy colors, soft glossy rounded shapes, cheerful and magical. Match the rendering style and palette energy of the attached reference image exactly. No text, no watermark, no characters, no people.*

- [ ] **Step 1: Generate the four textures** (ref = the user's `Bedroom.jpg` in `docs/reference-art/`; pro model; iterate prompts if output misses):

```bash
R="Bedroom.jpg"; S="Cartoony fantastical children's 3D-render style, ultra-saturated candy colors, soft glossy rounded shapes, cheerful and magical. Match the rendering style and palette energy of the attached reference image exactly. No text, no watermark, no characters, no people."
node scripts/gen-texture.mjs --ref "$R" --aspect 1:1 --out assets/textures3d/bedroom/wallpaper.jpg \
  --prompt "Flat seamless nursery wallpaper pattern: soft pink base with swirling pastel vines, small hearts and tiny butterflies, like the wallpaper in the reference image. Flat pattern fills the whole frame edge to edge, no border, no perspective, no objects. $S"
node scripts/gen-texture.mjs --ref "$R" --aspect 1:1 --out assets/textures3d/bedroom/porthole-view.jpg \
  --prompt "View through a round window onto rolling bright-green fantasy hills with winding paths, puffy cotton clouds, vivid blue sky, a few floating golden sparkle orbs — exactly like the view outside the round windows in the reference image. The landscape fills the entire frame edge to edge; do NOT draw the window frame itself. $S"
node scripts/gen-texture.mjs --ref "$R" --aspect 1:1 --out assets/textures3d/bedroom/hero-toychest.jpg \
  --prompt "Front-on orthographic view of a friendly wooden toy chest with a cute smiling cartoon face on its front — big happy eyes and a warm smile, candy-colored trim, toys peeking out of the top. The chest front fills the frame, flat front view, plain soft pink background. $S"
node scripts/gen-texture.mjs --ref "$R" --aspect 16:9 --out assets/textures3d/bedroom/rug.jpg \
  --prompt "Fluffy pink shag rug texture seen from directly above, soft thick fibers with a gentle rainbow shimmer, like the rug in the reference image. Texture fills the entire frame edge to edge, no border, top-down view. $S"
```

- [ ] **Step 2:** Eyeball each output (Read the files). Re-prompt any miss — common fixes: add "flat, no perspective" for patterns; "no window frame" for the view; "front-on, not 3/4 view" for faces.
- [ ] **Step 3:** `npx vitest run src/three/textureSlots.test.ts` → now PASS (files exist).

### Task 5: Bedroom — wire, verify, learn (the pilot loop)

**Files:** Create `src/three/textureManifest.ts` · Modify `src/three/bedroomSet.ts`, `src/three/main.ts` (only if update-hook wiring is missing for bedroom)

- [ ] **Step 1: Create the manifest:**

```ts
/**
 * Vite asset-URL manifest for generated textures. Grows world-by-world in
 * lockstep with EXPECTED_TEXTURES in textureSlots.ts.
 */
import bedroomHero from "../../assets/textures3d/bedroom/hero-toychest.jpg?url";
import bedroomView from "../../assets/textures3d/bedroom/porthole-view.jpg?url";
import bedroomRug from "../../assets/textures3d/bedroom/rug.jpg?url";
import bedroomWallpaper from "../../assets/textures3d/bedroom/wallpaper.jpg?url";

export const TEXTURES3D = {
  bedroom: {
    wallpaper: bedroomWallpaper,
    portholeView: bedroomView,
    heroFace: bedroomHero,
    rug: bedroomRug,
  },
} as const;
```

- [ ] **Step 2: Rewire `bedroomSet.ts`:**
  - Import: `import { buildHeroAppliance, buildPorthole, buildSparkles, loadCandyTexture } from "./candySet";` and `import { TEXTURES3D } from "./textureManifest";`
  - In `buildWallpaper`: replace `const tex = wallpaperTexture();` with `const tex = loadCandyTexture(TEXTURES3D.bedroom.wallpaper); tex.repeat.set(width / 8, WALL_HEIGHT / 8);` — delete the now-unused `wallpaperTexture()` function and the `wallpaperBase`/`wallpaperDot` palette entries.
  - Replace both `buildWindow(...)` calls with portholes (delete `buildWindow`):

```ts
const view = loadCandyTexture(TEXTURES3D.bedroom.portholeView, { mirror: false });
group.add(buildPorthole({ x: minX + width * 0.18, cy: 5.6, radius: 2.1, view }));
if (width > 36) {
  group.add(buildPorthole({ x: minX + width * 0.72, cy: 5.6, radius: 2.1, view }));
}
```

  - Add the hero toy chest after the bookshelves: `group.add(buildHeroAppliance({ x: minX + width * 0.62, w: 3.4, h: 2.6, d: 1.2, z: -2.6, face: loadCandyTexture(TEXTURES3D.bedroom.heroFace, { mirror: false }), bodyColor: 0xe88aa0 }));`
  - Add the rug (mid-depth floor strip, never standable):

```ts
const rugTex = loadCandyTexture(TEXTURES3D.bedroom.rug);
rugTex.repeat.set(2, 1);
const rug = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.5), new THREE.MeshLambertMaterial({ map: rugTex }));
rug.rotation.x = -Math.PI / 2;
rug.position.set(minX + width * 0.45, 0.02, -2.2);
rug.receiveShadow = true;
group.add(rug);
```

  - Add sparkles + expose the update hook — change `BedroomSet` interface and return:

```ts
export interface BedroomSet {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  sunTarget: THREE.Object3D;
  update?(dtMs: number, elapsedMs: number): void;
}
// in buildBedroomSet, before return:
const sparkles = buildSparkles(minX, maxX, 20260611, {});
group.add(sparkles.group);
// return:
return { group, sun, sunTarget, update: (_dt, elapsed) => sparkles.update(elapsed) };
```

  - Saturation bump on the palette consts (modest): `sage: 0x93cf9d`, `butter: 0xffd966`, `rose: 0xe88aa0`, `teal: 0x5fc4b8`. Leave `fogColor`/`fogNear`/`fogFar` untouched (test-pinned) unless the screenshots demand it — if changed, update `worldThemes.test.ts` in the same step.
- [ ] **Step 3:** Confirm the update hook flows: `WORLD_THEMES.bedroom.buildSet` spreads `...buildBedroomSet(...)` so `update` rides along; verify `main.ts` already calls `set.update?.(dt, elapsed)` (it does for kitchen/familyRoom — grep `update?.(`; if the call is theme-gated, make it unconditional).
- [ ] **Step 4:** `npx tsc --noEmit` → clean. `npx vitest run` → all green.
- [ ] **Step 5: Visual verify** (playbook §4): dev server up (`preview_start` → "Game Dev Server") → `?world=bedroom` → for segments 0, 2, 4: `__weezy3d.jumpToSegment(i)` + `__weezy3d.snapCamera()` → `preview_screenshot`. Check: wallpaper reads candy not noise; portholes glow with visible hills; toy-chest face legible; platforms still clearly standable; no z-fighting; sparkles visible (and drifting — take 2 screenshots 3s apart, positions differ).
- [ ] **Step 6:** Iterate Steps 1–5 of Task 4/5 on misses (texture repeat density and material brightness are the usual culprits — query `__weezy3d.scene` numerically for material/light values per gotcha #9).
- [ ] **Step 7:** Full gate: `npm run build` → pass.
- [ ] **Step 8: Record learnings** in `docs/3d-transition/weezy3d-playbook.md` (new "Pass-2 texture learnings" section): winning prompt phrasings, repeat densities, material choices, anything that failed. These steer Tasks 6–9.
- [ ] **Step 9: USER CHECKPOINT** — show before/after screenshots vs `Bedroom.jpg`, summarize learnings, get direction before Hallway.

### Task 6: Hallway (extrapolated style — no direct inspiration image)

**Files:** Create `assets/textures3d/hallway/*.jpg` · Modify `src/three/textureSlots.ts`, `src/three/textureManifest.ts`, `src/three/hallwaySet.ts`

- [ ] **Step 1:** Add `hallway: ["wallpaper.jpg", "porthole-view.jpg", "hero-clock.jpg", "runner.jpg"]` to `EXPECTED_TEXTURES` → run textureSlots test → FAIL (files missing).
- [ ] **Step 2: Generate** (refs: all three JPEGs — `--ref Bedroom.jpg --ref Kitchen.jpg --ref "Living ROom.jpg"` — to anchor the family style; apply Task-5 prompt learnings):
  - `wallpaper.jpg` (1:1): "Flat seamless wallpaper pattern: cool lavender-and-mint base with swirling ribbons, small golden stars and moons, gentle and dreamy. Flat pattern, edge to edge, no border, no perspective." + style suffix
  - `porthole-view.jpg` (1:1): "View through a round window onto rolling fantasy hills at golden-hour sunset — peach and pink sky, puffy glowing clouds, floating sparkle orbs. Landscape fills the frame, no window frame." + suffix
  - `hero-clock.jpg` (1:1, aspect 1:1 then crop-free tall box mapping is fine — the box is tall so prefer `--aspect 9:16` if supported, else 1:1): "Front-on view of a tall friendly grandfather clock with a cute smiling cartoon face on the clock dial — happy eyes, warm smile, candy-colored pendulum. Fills frame, flat front view, plain lavender background." + suffix
  - `runner.jpg` (16:9): "Rainbow striped carpet runner texture from directly above, soft plush fibers, playful saturated stripes. Fills the entire frame, no border." + suffix
- [ ] **Step 3: Wire `hallwaySet.ts`** (Read the file first; same pattern as bedroom): wallpaper texture onto the stripe-wall plane's material (mirrored wrap, repeat ≈ width/8 × wallHeight/8); add 1–2 portholes between the framed photos (keep the signature end-window light); texture the existing floor runner with `runner.jpg`; add the clock hero (`buildHeroAppliance`, w≈2.2 h≈6 d≈1.1, z=-5 band); `buildSparkles` with a cool color (`color: 0xcfe2ff`), wire/extend the set's `update` hook.
- [ ] **Step 4:** Tests green (`npx vitest run`), then visual verify at `?world=hallway` segments 0/2/4 (same recipe), iterate.
- [ ] **Step 5:** `npm run build` → pass. Append hallway learnings to the playbook.
- [ ] **Step 6: USER CHECKPOINT** — screenshots + what the extrapolation did; confirm direction holds without a reference image.

### Task 7: Kitchen (ref: `Kitchen.jpg`)

**Files:** Create `assets/textures3d/kitchen/*.jpg` · Modify `textureSlots.ts`, `textureManifest.ts`, `src/three/kitchenSet.ts`

- [ ] **Step 1:** Add `kitchen: ["wallpaper.jpg", "porthole-view.jpg", "hero-fridge.jpg", "cabinets.jpg", "rug.jpg"]` to slots → test FAIL.
- [ ] **Step 2: Generate** (ref `Kitchen.jpg`):
  - `wallpaper.jpg` (1:1): the pink patterned wall from the reference ("flat seamless pattern… like the wall in the reference image").
  - `porthole-view.jpg` (1:1): day hills (reuse the bedroom prompt — same outdoors, continuity).
  - `hero-fridge.jpg` (1:1 or 9:16): "Front-on view of a friendly teal refrigerator with a big happy cartoon face — exactly like the fridge in the reference image. Fills frame, flat front view, plain background." + suffix
  - `cabinets.jpg` (1:1): "Flat front view of candy-colored patchwork kitchen cabinet doors — purple, orange and green panels with rainbow handles and stitched-quilt trim, like the cabinets in the reference image. Edge to edge, no perspective." + suffix
  - `rug.jpg` (16:9): pink shag (reuse bedroom prompt).
- [ ] **Step 3: Wire `kitchenSet.ts`** (Read first): subway-tile wall → wallpaper map; existing fridge box → replace with `buildHeroAppliance` using `hero-fridge.jpg` (preserve its position/footprint); cabinet faces under the counter runs → `cabinets.jpg` map (mirrored wrap); 1–2 portholes; rug strip; warm sparkles concentrated near the stove ("magic cooking" energy — bump count locally by adding a second `buildSparkles(stoveX-6, stoveX+6, seed, { count: 10 })`). **Keep the stove hero light + breathing `update`** — compose: `update(dt, e) { existingBreathe(dt, e); sparkles.update(e); }`.
- [ ] **Step 4:** Tests green → visual verify `?world=kitchen` → iterate → `npm run build`.
- [ ] **Step 5:** Playbook learnings. **USER CHECKPOINT.**

### Task 8: Family Room (ref: `Living ROom.jpg` — NIGHT mode)

**Files:** Create `assets/textures3d/familyRoom/*.jpg` · Modify `textureSlots.ts`, `textureManifest.ts`, `src/three/familyRoomSet.ts`, possibly `worldThemes.test.ts` (fog pin)

- [ ] **Step 1:** Add `familyRoom: ["wallpaper.jpg", "porthole-view-night.jpg", "hero-tv.jpg", "rug.jpg"]` → test FAIL.
- [ ] **Step 2: Generate** (ref `Living ROom.jpg`):
  - `wallpaper.jpg` (1:1): "Flat seamless wall pattern of swirling painted teal-and-purple night-sky doodles with golden stars and moons, like the walls in the reference image."
  - `porthole-view-night.jpg` (1:1): "View through a round window onto a magical NIGHT landscape — deep purple starry sky, glowing clouds, silhouetted rolling hills, fireflies. Fills frame, no window frame." + suffix
  - `hero-tv.jpg` (1:1): "Front-on view of a friendly retro television with a happy cartoon face glowing on its screen, rounded wooden body, rainbow dials. Fills frame, flat front view." + suffix
  - `rug.jpg` (1:1): "Round rainbow spiral rug seen from directly above, soft plush fibers, like the rug in the reference image. The circular rug fills the frame on a plain dark background."
- [ ] **Step 3: Wire `familyRoomSet.ts`** (Read first): wall → night wallpaper; portholes use the NIGHT view + cooler frame light (`lightColor: 0xb8c8ff`); TV hero (can replace/augment the entertainment-center block); round rug = `CircleGeometry(3.2, 48)` rotated flat with the 1:1 rug texture (`mirror: false`); sparkles double as fireflies (`color: 0xd8e8a0`). **Keep the fireplace flicker** — compose update hooks. If night needs a darker fog (`fogColor` shift), update the `familyRoom` pin in `worldThemes.test.ts` in the same edit; `fogNear` stays ≥12.
- [ ] **Step 4:** Tests green → visual verify `?world=familyRoom` → iterate → `npm run build`.
- [ ] **Step 5:** Playbook learnings. **USER CHECKPOINT.**

### Task 9: Backyard (motifs adapted outdoors)

**Files:** Create `assets/textures3d/backyard/*.jpg` · Modify `textureSlots.ts`, `textureManifest.ts`, `src/three/backyardSet.ts`

Porthole inverts outdoors: the fantasy-hills view becomes the actual horizon — a wide backdrop strip behind the hedgerow. Hero = the playhouse. Sparkles = fireflies/pollen.

- [ ] **Step 1:** Add `backyard: ["horizon.jpg", "hero-playhouse.jpg", "hedge.jpg"]` → test FAIL.
- [ ] **Step 2: Generate** (refs: all three JPEGs):
  - `horizon.jpg` (16:9): "Wide panorama of rolling candy-green fantasy hills under a vivid blue sky with puffy cotton clouds and floating golden sparkle orbs — the same magical outdoors seen through the round windows in the reference images. Landscape fills the frame edge to edge."
  - `hero-playhouse.jpg` (1:1): "Front-on view of a small wooden playhouse with a cute smiling cartoon face above its door — round window eyes, door mouth, candy-striped roof. Fills frame, flat front view, plain sky background." + suffix
  - `hedge.jpg` (1:1): "Flat seamless texture of a whimsical candy-colored garden hedge — saturated layered green leaves with tiny pink flowers and golden sparkles. Edge to edge, no perspective." + suffix
- [ ] **Step 3: Wire `backyardSet.ts`** (Read first): add the horizon strip — `PlaneGeometry(width + 40, ~12)` at z≈−9.5 (behind the hedgerow, in front of the sky background), `MeshBasicMaterial` with `horizon.jpg`, mirrored repeat `set(width/40, 1)`, bottom at y≈0; hedgerow meshes get `hedge.jpg` maps; playhouse hero near width*0.55; warm fireflies via sparkles. Keep the HemisphereLight outdoor rig + sky `background` override untouched.
- [ ] **Step 4:** Tests green → visual verify `?world=backyard` → iterate → `npm run build`.
- [ ] **Step 5:** Playbook learnings. **USER CHECKPOINT.**

### Task 10: Closeout

**Files:** Modify `docs/3d-transition/weezy3d-playbook.md` (§1, §3, learnings section finalized), `CLAUDE.md` (3d.html status line), `PROGRESS.md` (session entry)

- [ ] **Step 1:** Full gate one last time: `npm run build` → tsc clean, all Vitest green (expect 340 + ~7 new), 3-page build.
- [ ] **Step 2:** Update playbook §1 (pass-2 textures shipped; file-table rows for `candySet.ts`, `textureManifest.ts`, `textureSlots.ts`, `scripts/gen-texture.mjs`), append any new gotchas to §3.
- [ ] **Step 3:** Update the `3d.html` row in `CLAUDE.md` (backgrounds = pass-2 candy, all 5 worlds) and add the PROGRESS.md session entry.
- [ ] **Step 4:** Final summary to user: per-world before/after screenshots, learnings digest, leftover ideas (e.g., per-level hero variation, §5.5 bloom would make the sparkles pop).

---

## Self-review (done at write time)

- **Spec coverage:** pipeline→T1, MCP fix→T0, manifest/smoke test→T2, shared builders/motifs→T3, platforms-grounded→saturation-only edits (T5 §2), per-world loop+learnings+checkpoints→T5–9, closeout/docs→T10. Night familyRoom→T8. Backyard adaptation→T9 (spec's porthole motif explicitly inverted — flagged in task intro).
- **No-placeholder scan:** Tasks 6–9 say "Read the file first; same pattern as bedroom" for wiring because the bedroom task (T5) carries the complete reference implementation and per-world deltas are listed concretely (which mesh gets which texture, which builders, which update-hook composition). Prompts are full text. Accepted residual: exact line anchors in untouched set files.
- **Type consistency:** `buildPorthole(opts)`, `buildHeroAppliance(opts)`, `sparkleSeeds(minX,maxX,seed,count)`, `SparkleField.update(elapsedMs)`, `TEXTURES3D[world][slot]`, `EXPECTED_TEXTURES[world] = string[]` — used identically across tasks.
- **No git:** zero commit steps; build gates instead (repo intentionally untracked).
