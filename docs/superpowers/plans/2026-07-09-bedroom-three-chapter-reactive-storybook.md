# Bedroom Three-Chapter Reactive Storybook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved three-panorama Bedroom as the production visual/immersion benchmark, with seamless lamp/plant overlaps, five gameplay-synchronized reactions, private-family placeholder audio, verified readability/performance, and a frozen cookbook.

**Architecture:** Produce panoramas offline from approved keyframes, bake three fixed-density runtime JPEGs, and resolve their placement from `WorldSegment` boundaries through a pure tested layout module. Keep non-deterministic art generation outside runtime; use a lightweight Three.js reactive overlay plus pure state machine for the five beats, and route semantic gameplay cues through an isolated WebAudio adapter. Other worlds retain their current renderers until Bedroom passes every gate.

**Tech Stack:** TypeScript 5.7 strict, Three.js r184, Vite 6, Vitest 4, Python 3 + ephemeral Pillow via `uv`, OpenAI `gpt-image-1.5` through the installed imagegen skill, browser WebAudio, Playwright browser verification.

## Global Constraints

- Preserve the stitched Bedroom's existing 250-world-unit length, five gameplay segments/checkpoints, physics, controls, routes, enemies, tokens, and Teddy placement.
- Visual chapter mapping is exactly segments 1–2 / segment 3 / segments 4–5.
- Runtime chapter extents are exactly 0–98, 86–148, and 136–250 world units, producing two 12-unit overlaps.
- Runtime textures are exactly 3136×512, 1984×512, and 3648×512; source masters are exactly 6272×1024, 3968×1024, and 7296×1024.
- Strict orthographic side-view art, carpet line at 85% image height, consistent furniture/wallpaper scale, and no deep floor perspective.
- The production Bedroom contains no activity table, bed, repeated crib, repeated shelf, repeated window, duplicated lamp, or duplicated plant.
- The bridge objects are one warm floor lamp at x=92 and one fairy-lit plant at x=142; each is inherited pixel-identically through its 12-unit overlap.
- Do not hide failed source art with stronger runtime blur. Reject and regenerate a mismatched seam.
- One quiet proximity wake-up plus one signature flourish per segment; signatures fire once per full run, survive checkpoint respawns, and reset only on explicit level reset.
- Private-family SuperEloise audio is placeholder-only and must be isolated behind semantic cue ids with provenance documented.
- Bedroom lights remain ≤6; reactive clutter casts no shadows; use no `Math.random`; runtime makes no model/API calls.
- Keep the successful quilt terrain, player feel, deterministic simulation, and current 640×360 render target.
- Red → green → refactor for code tasks. Run relevant tests before and after each implementation and the full `npm run build` before completion.
- This plan ends after Bedroom and its cookbook pass. Hallway, Kitchen, Family Room, and Backyard receive separate implementation plans after the Bedroom verdict.

---

## File Map

### Offline panorama production

- Create `scripts/bedroom-panorama/bake.py` — deterministic frame stitching, seam-difference validation, master crop, runtime downsample, and seam-proof output.
- Create `scripts/bedroom-panorama/test_bake.py` — synthetic-image tests for dimensions, overlap blending, and rejection thresholds.
- Create `scripts/bedroom-panorama/README.md` — exact generation commands, immutable camera brief, output contract, and rejection checklist.
- Create `output/bedroom-panorama/` during execution — untracked source frames, masters, and review proofs.
- Create `assets/backdrops3d/bedroom/chapters/play-area.jpg` — approved runtime plate 1.
- Create `assets/backdrops3d/bedroom/chapters/through-crib.jpg` — approved runtime plate 2.
- Create `assets/backdrops3d/bedroom/chapters/bookshelf-window-finale.jpg` — approved runtime plate 3.
- Create `docs/reference-art/bedroom-panorama/lamp-seam-proof.jpg` and `plant-seam-proof.jpg` — committed visual acceptance evidence.

### Runtime panorama placement

- Create `src/three/bedroomChapterLayout.ts` — pure segment-derived chapter placement and alpha evaluation.
- Create `src/three/bedroomChapterLayout.test.ts` — exact coverage/overlap/weight invariants.
- Modify `src/three/paintedBackdrop.ts` — replace fixed-cadence five-vignette cycling with three chapter planes and load-failure fallback.

### Readability and reaction system

- Create `src/three/floorGaps.ts` and `src/three/floorGaps.test.ts` — pure floor-gap derivation used by pit art and the successful-clear trigger.
- Create `src/three/pitPresentation.ts` — non-colliding pit darkness and edge accents.
- Create `src/three/tokenPose.ts` and `src/three/tokenPose.test.ts` — bounded token yaw that never becomes edge-on.
- Modify `src/three/level3d.ts` — consume `tokenPose`.
- Create `src/three/bedroomReactions.ts` and `src/three/bedroomReactions.test.ts` — pure four-state, five-beat reaction machine.
- Create `src/three/bedroomStorybookView.ts` and `src/three/bedroomStorybookView.test.ts` — Three.js overlays for toy, lamp, mobile, plant/books, and finale responses.
- Modify `src/three/paintedBackdrop.ts` — expose butterfly wake/reset energy.
- Modify `src/three/bedroomSet.ts` — suppress the old random hero lamp in painted mode so the x=92 bridge lamp is unique.

### Audio and integration

- Create `assets/audio/placeholders/supereloise/` — copied OGG/WAV placeholder files plus `README.md` provenance/hashes.
- Create `src/three/audio.ts` and `src/three/audio.test.ts` — semantic cue director with injected sink.
- Create `src/three/webAudioSink.ts` — lazy WebAudio decoding, music/SFX buses, mute, and failure isolation.
- Modify `src/three/hud.ts` — accessible mute button and state display.
- Modify `src/three/main.ts` — backdrop, pits, reaction events, storybook view, semantic sound cues, reset semantics, and debug probes.
- Modify `src/three/worldThemes.test.ts` if needed — retain light/fog budgets.

### Verification and cookbook

- Modify `docs/3d-transition/weezy3d-playbook.md` — exact three-chapter production recipe and tuning knobs.
- Modify `PROGRESS.md` — Bedroom benchmark verdict and remaining-world gate.

---

### Task 1: Build the Deterministic Panorama Baker

**Files:**
- Create: `scripts/bedroom-panorama/bake.py`
- Create: `scripts/bedroom-panorama/test_bake.py`
- Create: `scripts/bedroom-panorama/README.md`

**Interfaces:**
- Consumes: ordered 1536×1024 PNG frame paths, `overlap_px`, `master_width`, runtime width, and neighboring plate world extents.
- Produces: `prepare_outpaint(source, inherit_px, image_out, mask_out)`, `stitch_frames(paths: list[Path], overlap_px: int, target_width: int) -> Image.Image`, `seam_mean_error(left, right, overlap_px) -> float`, `bake_runtime(master, runtime_size, output)`, and CLI subcommands `prepare`, `plate`, and `proof`.

- [ ] **Step 1: Write failing synthetic-image tests**

```python
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from PIL import Image

from bake import seam_mean_error, stitch_frames


class PanoramaBakeTests(unittest.TestCase):
    def test_stitch_frames_uses_overlap_and_crops_exact_width(self):
        with TemporaryDirectory() as raw:
            root = Path(raw)
            first = Image.new("RGB", (8, 4), "#ff0000")
            second = Image.new("RGB", (8, 4), "#0000ff")
            # Make the shared two-pixel boundary pixel-identical.
            second.paste(first.crop((6, 0, 8, 4)), (0, 0))
            first.save(root / "01.png")
            second.save(root / "02.png")
            result = stitch_frames([root / "01.png", root / "02.png"], 2, 13)
            self.assertEqual(result.size, (13, 4))

    def test_seam_error_is_zero_for_inherited_boundary(self):
        left = Image.new("RGB", (8, 4), "#e8bfd0")
        right = Image.new("RGB", (8, 4), "#ffffff")
        right.paste(left.crop((6, 0, 8, 4)), (0, 0))
        self.assertEqual(seam_mean_error(left, right, 2), 0.0)

    def test_stitch_rejects_nonmatching_frame_height(self):
        with TemporaryDirectory() as raw:
            root = Path(raw)
            Image.new("RGB", (8, 4)).save(root / "01.png")
            Image.new("RGB", (8, 5)).save(root / "02.png")
            with self.assertRaisesRegex(ValueError, "same height"):
                stitch_frames([root / "01.png", root / "02.png"], 2, 14)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests to verify red**

Run:

```bash
uv run --with pillow python scripts/bedroom-panorama/test_bake.py -v
```

Expected: `ModuleNotFoundError` or import failure because `bake.py` does not exist.

- [ ] **Step 3: Implement exact overlap stitching and validation**

```python
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Sequence

from PIL import Image, ImageChops, ImageStat


def prepare_outpaint(source: Path, inherit_px: int, image_out: Path, mask_out: Path) -> None:
    previous = Image.open(source).convert("RGBA")
    if inherit_px < 1 or inherit_px >= 1536:
        raise ValueError("inherit_px must be between 1 and 1535")
    inherited = previous.crop((previous.width - inherit_px, 0, previous.width, previous.height))
    canvas = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    canvas.paste(inherited.resize((inherit_px, 1024), Image.Resampling.LANCZOS), (0, 0))
    mask = Image.new("RGBA", canvas.size, (255, 255, 255, 0))
    mask.paste(Image.new("RGBA", (inherit_px, 1024), (255, 255, 255, 255)), (0, 0))
    image_out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(image_out)
    mask.save(mask_out)


def seam_mean_error(left: Image.Image, right: Image.Image, overlap_px: int) -> float:
    a = left.convert("RGB").crop((left.width - overlap_px, 0, left.width, left.height))
    b = right.convert("RGB").crop((0, 0, overlap_px, right.height))
    if a.size != b.size:
        raise ValueError("seam crops must have the same size")
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3.0


def stitch_frames(paths: Sequence[Path], overlap_px: int, target_width: int) -> Image.Image:
    frames = [Image.open(path).convert("RGB") for path in paths]
    if not frames:
        raise ValueError("at least one frame is required")
    if any(frame.height != frames[0].height for frame in frames):
        raise ValueError("all frames must have the same height")
    step = frames[0].width - overlap_px
    natural_width = frames[0].width + step * (len(frames) - 1)
    if target_width > natural_width:
        raise ValueError("target width exceeds stitched coverage")
    canvas = Image.new("RGB", (natural_width, frames[0].height))
    canvas.paste(frames[0], (0, 0))
    for index, frame in enumerate(frames[1:], start=1):
        if seam_mean_error(frames[index - 1], frame, overlap_px) > 18.0:
            raise ValueError(f"frame seam {index} exceeds mean error threshold")
        x = index * step
        ramp = Image.linear_gradient("L").rotate(90).resize((overlap_px, frame.height))
        canvas.paste(frame.crop((0, 0, overlap_px, frame.height)), (x, 0), ramp)
        canvas.paste(frame.crop((overlap_px, 0, frame.width, frame.height)), (x + overlap_px, 0))
    return canvas.crop((0, 0, target_width, canvas.height))


def bake_runtime(master: Image.Image, width: int, height: int, output: Path) -> None:
    runtime = master.resize((width, height), Image.Resampling.LANCZOS)
    output.parent.mkdir(parents=True, exist_ok=True)
    runtime.save(output, "JPEG", quality=91, optimize=True, progressive=True, subsampling=0)
```

Add an `argparse` `prepare` command accepting `--source`, `--inherit-px`, `--image-out`, and `--mask-out`. Add a `plate` command accepting `--frames`, `--overlap-px`, `--master-width`, `--master-out`, `--runtime-width`, `--runtime-height 512`, and `--runtime-out`. Add a `proof` command that aligns two baked plates by `--left-start`, `--right-start`, and `--pixels-per-unit 32`, composites them with complementary linear ramps over the shared interval, and writes a 1536×512 review crop centered on the seam.

- [ ] **Step 4: Run the baker tests green**

Run:

```bash
uv run --with pillow python scripts/bedroom-panorama/test_bake.py -v
```

Expected: 3 tests pass.

- [ ] **Step 5: Document the immutable generation contract**

Write `scripts/bedroom-panorama/README.md` with these exact values:

```markdown
# Bedroom Panorama Production

Generate with `gpt-image-1.5`, `1536x1024`, `quality=high`, `input_fidelity=high`.
Internal frame overlap: 307px (20%). Cross-chapter inherited overlap: 768px (12 world units at 64px/unit).

| Plate | Frames | Master | Runtime | World extent |
|---|---:|---:|---:|---:|
| play-area | 5 | 6272x1024 | 3136x512 | 0-98 |
| through-crib | 3 | 3968x1024 | 1984x512 | 86-148 |
| bookshelf-window-finale | 6 | 7296x1024 | 3648x512 | 136-250 |

Room lock: strict side-on orthographic camera; carpet line at 85%; continuous pink botanical/butterfly wallpaper; identical furniture scale; no perspective floor; no visible side wall; no text.

Reject: floor-line drift, exposure jump, repeated crib/bed/bookshelf/window, activity table, missing bridge silhouette, hidden pits/platforms, or seam mean error above 18.
```

- [ ] **Step 6: Commit the production tool**

```bash
git add scripts/bedroom-panorama
git commit -m "tooling: add bedroom panorama baker"
```

---

### Task 2: Generate, Bake, and Approve the Three Panoramas

**Files:**
- Read: `docs/superpowers/specs/assets/bedroom-three-chapter/chapter-1-play-area-v2.png`
- Read: `docs/superpowers/specs/assets/bedroom-three-chapter/chapter-2-through-crib.png`
- Read: `docs/superpowers/specs/assets/bedroom-three-chapter/chapter-3-bookshelf-window.png`
- Create: `output/bedroom-panorama/play-area/frame-01.png` through `frame-05.png`
- Create: `output/bedroom-panorama/through-crib/frame-01.png` through `frame-03.png`
- Create: `output/bedroom-panorama/bookshelf-window-finale/frame-01.png` through `frame-06.png`
- Create: `assets/backdrops3d/bedroom/chapters/play-area.jpg`
- Create: `assets/backdrops3d/bedroom/chapters/through-crib.jpg`
- Create: `assets/backdrops3d/bedroom/chapters/bookshelf-window-finale.jpg`
- Create: `docs/reference-art/bedroom-panorama/lamp-seam-proof.jpg`
- Create: `docs/reference-art/bedroom-panorama/plant-seam-proof.jpg`

**Interfaces:**
- Consumes: approved keyframes and the Task 1 bake CLI.
- Produces: three user-approved runtime JPEGs at the exact dimensions consumed by `paintedBackdrop.ts`.

- [ ] **Step 1: Establish the base prompt used in every generation/edit**

Use this text verbatim before each plate-specific instruction:

```text
Production game-background panorama for Princess Eloise, a joyful storybook 3D side-scrolling platformer for young children. Strict side-on orthographic room elevation, camera perfectly perpendicular to the wall, no visible side walls, no corner perspective, no deep floor plane. The wall fills the upper 85 percent and a narrow pink carpet strip fills the lower 15 percent. Preserve one continuous small-scale pink botanical and butterfly wallpaper, identical carpet weave, identical camera height, identical furniture scale, gentle clay-and-felt storybook rendering, rounded toy forms, soft global illumination, no text, no characters, no UI. Keep the horizontal gameplay lane calm and readable. Do not include a bed or activity table. Do not repeat any large landmark.
```

- [ ] **Step 2: Regenerate Plate 1 as five inherited frames**

Plate-specific direction:

```text
Play Area chapter, gentle morning blush. Sparse low toy clusters near the floor edges: blocks, stacking rings, a small toy train, and one red toy car. Maintain generous quiet negative space through the center for platforming. No crib, bookshelf, magical window, bed, easel, desk, or activity table. In the final frame, introduce one warm nursery floor lamp centered inside the final 768 pixels; show its complete shade, stem, base, carpet contact shadow, and warm light falloff. Nothing else large may enter that final overlap.
```

Generate frame 1 as a new composition using the approved keyframe only as style/composition reference. For frames 2–5, create a 1536×1024 RGBA canvas containing the previous frame's last 307 pixels on the left and transparency elsewhere, pass that canvas as the edit image/mask, and require the inherited pixels to remain unchanged. Use the installed imagegen CLI:

```bash
uv run --with openai python /Users/homebase/.codex/skills/imagegen/scripts/image_gen.py edit --image docs/superpowers/specs/assets/bedroom-three-chapter/chapter-1-play-area-v2.png --prompt-file output/bedroom-panorama/play-area/frame-01-prompt.txt --size 1536x1024 --quality high --input-fidelity high --out output/bedroom-panorama/play-area/frame-01.png
```

Prepare and generate each continuation individually so the previous frame can be inspected before generating the next:

```bash
uv run --with pillow python scripts/bedroom-panorama/bake.py prepare --source output/bedroom-panorama/play-area/frame-01.png --inherit-px 307 --image-out output/bedroom-panorama/play-area/frame-02-canvas.png --mask-out output/bedroom-panorama/play-area/frame-02-mask.png

uv run --with openai python /Users/homebase/.codex/skills/imagegen/scripts/image_gen.py edit --image output/bedroom-panorama/play-area/frame-02-canvas.png --image docs/superpowers/specs/assets/bedroom-three-chapter/chapter-1-play-area-v2.png --mask output/bedroom-panorama/play-area/frame-02-mask.png --prompt-file output/bedroom-panorama/play-area/frame-02-prompt.txt --size 1536x1024 --quality high --input-fidelity high --out output/bedroom-panorama/play-area/frame-02.png
```

Repeat the `prepare` then `edit` pair sequentially for frames 3, 4, and 5, changing both source/output frame numbers. Frame 5's prompt must place the lamp at local x≈972px so its center lands at master x=5888 (world x=92).

- [ ] **Step 3: Bake and inspect Plate 1**

```bash
uv run --with pillow python scripts/bedroom-panorama/bake.py plate --frames output/bedroom-panorama/play-area/frame-01.png output/bedroom-panorama/play-area/frame-02.png output/bedroom-panorama/play-area/frame-03.png output/bedroom-panorama/play-area/frame-04.png output/bedroom-panorama/play-area/frame-05.png --overlap-px 307 --master-width 6272 --master-out output/bedroom-panorama/play-area/master.png --runtime-width 3136 --runtime-height 512 --runtime-out assets/backdrops3d/bedroom/chapters/play-area.jpg
```

Expected: exact 6272×1024 master, exact 3136×512 runtime JPEG, no activity table, and one complete lamp centered at x=92.

- [ ] **Step 4: Regenerate Plate 2 from Plate 1's inherited lamp band**

Plate-specific direction:

```text
Through-Crib chapter, lavender-gold magic rising. Preserve the inherited 768-pixel lamp band at the left exactly. One giant white crib is the single central architectural landmark, seen straight-on, with a moon-and-stars mobile, soft lavender bedding, and delicate fairy lights. Keep both the low floor route and high route visually readable. No bed, bookshelf, round fantasy window, desk, activity table, or second crib. In the final 768 pixels, introduce one tall fairy-lit potted plant with its complete pot, stems, leaves, carpet contact shadow, and warm-cool light falloff; nothing else large enters that overlap.
```

Build frame 1 with the exact last 768 pixels of Plate 1's master at its left, then outpaint right:

```bash
uv run --with pillow python scripts/bedroom-panorama/bake.py prepare --source output/bedroom-panorama/play-area/master.png --inherit-px 768 --image-out output/bedroom-panorama/through-crib/frame-01-canvas.png --mask-out output/bedroom-panorama/through-crib/frame-01-mask.png

uv run --with openai python /Users/homebase/.codex/skills/imagegen/scripts/image_gen.py edit --image output/bedroom-panorama/through-crib/frame-01-canvas.png --image docs/superpowers/specs/assets/bedroom-three-chapter/chapter-2-through-crib.png --mask output/bedroom-panorama/through-crib/frame-01-mask.png --prompt-file output/bedroom-panorama/through-crib/frame-01-prompt.txt --size 1536x1024 --quality high --input-fidelity high --out output/bedroom-panorama/through-crib/frame-01.png
```

Generate frames 2–3 with the same 307px internal-inheritance command pair used for Plate 1. Frame 3's prompt places the plant at local x≈1126px so its center lands at master x=3584 (world x=142).

- [ ] **Step 5: Bake and inspect Plate 2**

```bash
uv run --with pillow python scripts/bedroom-panorama/bake.py plate --frames output/bedroom-panorama/through-crib/frame-01.png output/bedroom-panorama/through-crib/frame-02.png output/bedroom-panorama/through-crib/frame-03.png --overlap-px 307 --master-width 3968 --master-out output/bedroom-panorama/through-crib/master.png --runtime-width 1984 --runtime-height 512 --runtime-out assets/backdrops3d/bedroom/chapters/through-crib.jpg
```

Expected: exact 3968×1024 master, exact 1984×512 runtime JPEG, pixel-identical lamp band, one crib, and one complete plant centered at x=142.

- [ ] **Step 6: Regenerate Plate 3 from Plate 2's inherited plant band**

Plate-specific direction:

```text
Bookshelf Window finale, warm golden wonder. Preserve the inherited 768-pixel fairy-lit plant band at the left exactly. Include one magical round window showing a dreamy moon, rainbow, and tiny distant castle; one tall bookshelf; and one warm glowing exit door at the far right. Increase saturation and luminous particles gradually toward the exit while keeping platform silhouettes readable. No bed, crib, second bookshelf, second window, activity table, or duplicated plant.
```

Build frame 1 with the exact last 768 pixels of Plate 2's master at its left:

```bash
uv run --with pillow python scripts/bedroom-panorama/bake.py prepare --source output/bedroom-panorama/through-crib/master.png --inherit-px 768 --image-out output/bedroom-panorama/bookshelf-window-finale/frame-01-canvas.png --mask-out output/bedroom-panorama/bookshelf-window-finale/frame-01-mask.png

uv run --with openai python /Users/homebase/.codex/skills/imagegen/scripts/image_gen.py edit --image output/bedroom-panorama/bookshelf-window-finale/frame-01-canvas.png --image docs/superpowers/specs/assets/bedroom-three-chapter/chapter-3-bookshelf-window.png --mask output/bedroom-panorama/bookshelf-window-finale/frame-01-mask.png --prompt-file output/bedroom-panorama/bookshelf-window-finale/frame-01-prompt.txt --size 1536x1024 --quality high --input-fidelity high --out output/bedroom-panorama/bookshelf-window-finale/frame-01.png
```

Generate frames 2–6 with 307px inherited internal overlaps.

- [ ] **Step 7: Bake Plate 3 and both seam proofs**

```bash
uv run --with pillow python scripts/bedroom-panorama/bake.py plate --frames output/bedroom-panorama/bookshelf-window-finale/frame-01.png output/bedroom-panorama/bookshelf-window-finale/frame-02.png output/bedroom-panorama/bookshelf-window-finale/frame-03.png output/bedroom-panorama/bookshelf-window-finale/frame-04.png output/bedroom-panorama/bookshelf-window-finale/frame-05.png output/bedroom-panorama/bookshelf-window-finale/frame-06.png --overlap-px 307 --master-width 7296 --master-out output/bedroom-panorama/bookshelf-window-finale/master.png --runtime-width 3648 --runtime-height 512 --runtime-out assets/backdrops3d/bedroom/chapters/bookshelf-window-finale.jpg

uv run --with pillow python scripts/bedroom-panorama/bake.py proof --left assets/backdrops3d/bedroom/chapters/play-area.jpg --left-start 0 --right assets/backdrops3d/bedroom/chapters/through-crib.jpg --right-start 86 --pixels-per-unit 32 --seam 92 --out docs/reference-art/bedroom-panorama/lamp-seam-proof.jpg

uv run --with pillow python scripts/bedroom-panorama/bake.py proof --left assets/backdrops3d/bedroom/chapters/through-crib.jpg --left-start 86 --right assets/backdrops3d/bedroom/chapters/bookshelf-window-finale.jpg --right-start 136 --pixels-per-unit 32 --seam 142 --out docs/reference-art/bedroom-panorama/plant-seam-proof.jpg
```

- [ ] **Step 8: Stop for the required visual verdict**

Present the three full-width runtime plates and both seam proofs. Do not implement the runtime renderer until the user confirms:

- the lamp and plant read as one object each;
- no camera/floor/exposure jump exists;
- the activity table is absent;
- the room escalates Play Area → Crib → Window Finale;
- pits/platform lanes remain calm enough for gameplay.

- [ ] **Step 9: Commit only approved production art**

```bash
git add assets/backdrops3d/bedroom/chapters docs/reference-art/bedroom-panorama
git commit -m "art: add bedroom chapter panoramas"
```

Do not add `output/bedroom-panorama/`.

---

### Task 3: Resolve Chapter Placement from World Segments

**Files:**
- Create: `src/three/bedroomChapterLayout.ts`
- Create: `src/three/bedroomChapterLayout.test.ts`

**Interfaces:**
- Consumes: `WorldSegment[]` in render-pixel coordinates and `toWorldX`.
- Produces: `resolveBedroomChapters(segments): BedroomChapterPlacement[]` and `chapterAlphaAt(placement, worldX): number`.

- [ ] **Step 1: Write failing layout tests**

```ts
import { describe, expect, it } from "vitest";
import { chapterAlphaAt, resolveBedroomChapters } from "./bedroomChapterLayout";
import type { WorldSegment } from "./worldStitch";

const widths = [44, 48, 50, 48, 60];
const segments: WorldSegment[] = widths.map((width, index) => {
  const startUnits = widths.slice(0, index).reduce((sum, value) => sum + value, 0);
  return {
    id: `bedroom-${index}`,
    name: `Segment ${index + 1}`,
    startX: startUnits * 64,
    endX: (startUnits + width) * 64,
    spawn: { x: startUnits * 64 + 64, y: 336 },
  };
});

describe("resolveBedroomChapters", () => {
  it("maps five segments to the three approved extents", () => {
    expect(resolveBedroomChapters(segments).map(({ id, startX, endX }) => ({ id, startX, endX }))).toEqual([
      { id: "play-area", startX: 0, endX: 98 },
      { id: "through-crib", startX: 86, endX: 148 },
      { id: "bookshelf-window-finale", startX: 136, endX: 250 },
    ]);
  });

  it("keeps complementary alpha weights across both overlaps", () => {
    const [play, crib, finale] = resolveBedroomChapters(segments);
    for (const x of [86, 89, 92, 95, 98]) {
      expect(chapterAlphaAt(play!, x) + chapterAlphaAt(crib!, x)).toBeCloseTo(1, 6);
    }
    for (const x of [136, 139, 142, 145, 148]) {
      expect(chapterAlphaAt(crib!, x) + chapterAlphaAt(finale!, x)).toBeCloseTo(1, 6);
    }
  });

  it("rejects anything other than five ordered segments", () => {
    expect(() => resolveBedroomChapters(segments.slice(0, 4))).toThrow(/five segments/);
  });
});
```

- [ ] **Step 2: Run red**

Run:

```bash
npx vitest run src/three/bedroomChapterLayout.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure placement contract**

```ts
import { toWorldX } from "./coords";
import type { WorldSegment } from "./worldStitch";

export type BedroomChapterId = "play-area" | "through-crib" | "bookshelf-window-finale";

export interface BedroomChapterPlacement {
  id: BedroomChapterId;
  startX: number;
  endX: number;
  fadeIn: readonly [number, number] | null;
  fadeOut: readonly [number, number] | null;
}

const HALF_OVERLAP = 6;

export function resolveBedroomChapters(segments: readonly WorldSegment[]): BedroomChapterPlacement[] {
  if (segments.length !== 5) throw new Error("Bedroom panorama layout requires five segments");
  const boundary1 = toWorldX(segments[1]!.endX);
  const boundary2 = toWorldX(segments[2]!.endX);
  const worldEnd = toWorldX(segments[4]!.endX);
  return [
    { id: "play-area", startX: 0, endX: boundary1 + HALF_OVERLAP, fadeIn: null, fadeOut: [boundary1 - HALF_OVERLAP, boundary1 + HALF_OVERLAP] },
    { id: "through-crib", startX: boundary1 - HALF_OVERLAP, endX: boundary2 + HALF_OVERLAP, fadeIn: [boundary1 - HALF_OVERLAP, boundary1 + HALF_OVERLAP], fadeOut: [boundary2 - HALF_OVERLAP, boundary2 + HALF_OVERLAP] },
    { id: "bookshelf-window-finale", startX: boundary2 - HALF_OVERLAP, endX: worldEnd, fadeIn: [boundary2 - HALF_OVERLAP, boundary2 + HALF_OVERLAP], fadeOut: null },
  ];
}

function ramp(x: number, [start, end]: readonly [number, number]): number {
  return Math.min(1, Math.max(0, (x - start) / (end - start)));
}

export function chapterAlphaAt(chapter: BedroomChapterPlacement, worldX: number): number {
  if (worldX < chapter.startX || worldX > chapter.endX) return 0;
  const fadeIn = chapter.fadeIn ? ramp(worldX, chapter.fadeIn) : 1;
  const fadeOut = chapter.fadeOut ? 1 - ramp(worldX, chapter.fadeOut) : 1;
  return Math.min(fadeIn, fadeOut);
}
```

- [ ] **Step 4: Run green and commit**

```bash
npx vitest run src/three/bedroomChapterLayout.test.ts
git add src/three/bedroomChapterLayout.ts src/three/bedroomChapterLayout.test.ts
git commit -m "feat: derive bedroom panorama layout from segments"
```

Expected: 3 tests pass.

---

### Task 4: Replace Fixed-Cadence Vignettes with Three Chapter Planes

**Files:**
- Modify: `src/three/paintedBackdrop.ts`
- Read: `src/three/bedroomChapterLayout.ts`
- Test: `src/three/bedroomChapterLayout.test.ts`

**Interfaces:**
- Consumes: Task 2 JPEG URLs and Task 3 `BedroomChapterPlacement[]`.
- Produces: a `THREE.Group` containing one continuous wallpaper mesh and exactly three named chapter meshes.

- [ ] **Step 1: Add a renderer-shape assertion to the layout test**

Add a test that asserts the chapter ids are unique and their union covers sample points 0 through 250 without zero total alpha. This fails if a chapter is omitted or duplicated.

```ts
it("covers the complete world without a transparent sample", () => {
  const chapters = resolveBedroomChapters(segments);
  expect(new Set(chapters.map((chapter) => chapter.id)).size).toBe(3);
  for (let x = 0; x <= 250; x += 0.5) {
    const total = chapters.reduce((sum, chapter) => sum + chapterAlphaAt(chapter, x), 0);
    expect(total).toBeGreaterThan(0.999);
  }
});
```

- [ ] **Step 2: Run the targeted test**

```bash
npx vitest run src/three/bedroomChapterLayout.test.ts
```

Expected: 4 tests pass before renderer work.

- [ ] **Step 3: Replace the five old imports and `STEP = 34` loop**

In `paintedBackdrop.ts`, import the three approved JPEGs and the layout functions:

```ts
import playAreaUrl from "../../assets/backdrops3d/bedroom/chapters/play-area.jpg?url";
import cribUrl from "../../assets/backdrops3d/bedroom/chapters/through-crib.jpg?url";
import finaleUrl from "../../assets/backdrops3d/bedroom/chapters/bookshelf-window-finale.jpg?url";
import {
  chapterAlphaAt,
  resolveBedroomChapters,
  type BedroomChapterId,
  type BedroomChapterPlacement,
} from "./bedroomChapterLayout";

const BEDROOM_CHAPTER_URLS: Record<BedroomChapterId, string> = {
  "play-area": playAreaUrl,
  "through-crib": cribUrl,
  "bookshelf-window-finale": finaleUrl,
};
```

Build the wallpaper first. Resolve chapters inside `try/catch`; on error, warn once and return the wallpaper-only group. For each chapter, create a `PlaneGeometry(chapter.endX - chapter.startX, TILE_H)`, name it `bedroom-panorama:<id>`, and create a 512×2 alpha canvas sampled through `chapterAlphaAt`. Load with `TextureLoader.load(url, onLoad, undefined, onError)`; keep the mesh hidden until `onLoad`, and on error leave it hidden and warn once with the chapter id.

- [ ] **Step 4: Remove obsolete cadence behavior**

Delete the five vignette imports, `BACKDROP_URLS` array, `TILE_W`, `EDGE_FADE`, shared edge-fade map, `STEP`, and cycling loop. Keep the continuous wallpaper and butterfly system.

- [ ] **Step 5: Verify TypeScript, tests, and asset build**

```bash
npm run typecheck
npx vitest run src/three/bedroomChapterLayout.test.ts src/three/worldStitch.test.ts
npm run build
```

Expected: typecheck passes, targeted tests pass, full build has zero failures, and Vite emits all three chapter JPEGs.

- [ ] **Step 6: Commit**

```bash
git add src/three/paintedBackdrop.ts
git commit -m "feat: render three bedroom panorama chapters"
```

---

### Task 5: Lock Pit Presentation and Token Readability

**Files:**
- Create: `src/three/floorGaps.ts`
- Create: `src/three/floorGaps.test.ts`
- Create: `src/three/pitPresentation.ts`
- Create: `src/three/tokenPose.ts`
- Create: `src/three/tokenPose.test.ts`
- Modify: `src/three/level3d.ts`
- Modify: `src/three/main.ts`

**Interfaces:**
- Consumes: coalesced floor ranges and token animation time/phase.
- Produces: `findFloorGaps`, `firstGapInRange`, `buildPitPresentation`, and `tokenPose`.

- [ ] **Step 1: Write floor-gap and token-pose tests**

```ts
import { describe, expect, it } from "vitest";
import { findFloorGaps, firstGapInRange } from "./floorGaps";

describe("floor gaps", () => {
  const floors: Array<[number, number]> = [[0, 5], [8, 15], [19, 25]];
  it("returns only internal gaps", () => {
    expect(findFloorGaps(floors, 0, 25)).toEqual([{ startX: 5, endX: 8 }, { startX: 15, endX: 19 }]);
  });
  it("finds the first pit inside a segment", () => {
    expect(firstGapInRange(findFloorGaps(floors, 0, 25), 10, 25)).toEqual({ startX: 15, endX: 19 });
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { tokenPose } from "./tokenPose";

describe("tokenPose", () => {
  it("never turns a star edge-on", () => {
    for (let ms = 0; ms <= 10_000; ms += 17) {
      expect(Math.abs(tokenPose(ms, 0.7).yaw)).toBeLessThanOrEqual(0.56);
    }
  });
  it("keeps the existing small bob envelope", () => {
    for (let ms = 0; ms <= 10_000; ms += 17) {
      expect(Math.abs(tokenPose(ms, 1.4).bob)).toBeLessThanOrEqual(0.071);
    }
  });
});
```

- [ ] **Step 2: Run red**

```bash
npx vitest run src/three/floorGaps.test.ts src/three/tokenPose.test.ts
```

Expected: both modules missing.

- [ ] **Step 3: Implement the pure helpers**

```ts
export interface FloorGap { startX: number; endX: number }

export function findFloorGaps(
  ranges: readonly (readonly [number, number])[],
  minX: number,
  maxX: number,
): FloorGap[] {
  const ordered = [...ranges].sort((a, b) => a[0] - b[0]);
  const gaps: FloorGap[] = [];
  let cursor = minX;
  for (const [start, end] of ordered) {
    if (start > cursor + 0.01) gaps.push({ startX: cursor, endX: start });
    cursor = Math.max(cursor, end);
  }
  if (cursor < maxX - 0.01) gaps.push({ startX: cursor, endX: maxX });
  return gaps.filter((gap) => gap.startX > minX + 0.01 && gap.endX < maxX - 0.01);
}

export function firstGapInRange(gaps: readonly FloorGap[], startX: number, endX: number): FloorGap | null {
  return gaps.find((gap) => gap.startX >= startX && gap.endX <= endX) ?? null;
}
```

```ts
export function tokenPose(elapsedMs: number, phase: number): { yaw: number; bob: number } {
  const t = elapsedMs / 1000;
  return {
    yaw: Math.sin(t * 2.2 + phase) * 0.55,
    bob: Math.sin(t * 2.4 + phase) * 0.07,
  };
}
```

- [ ] **Step 4: Add non-colliding pit art and wire token pose**

`buildPitPresentation(gaps)` returns a group with one dark dusty-plum plane below each gap and two narrow rose-gold edge strips at its left/right lip. Use `MeshBasicMaterial`, `depthWrite=false`, `castShadow=false`, `receiveShadow=false`, and z=-0.45. Do not add solids or lights. In `level3d.ts`, replace unbounded `rotation.y = t * 2.2 + phase` with `tokenPose(elapsedMs, phase).yaw` and use its bob value.

In `main.ts`, derive `pitGapsWorld = findFloorGaps(floorRanges, worldMinX, worldMaxX)` after the existing pit-aware `floorRanges` calculation and add `buildPitPresentation(pitGapsWorld)` to the scene. Tighten painted-mode bloom to `strength=0.18`, `radius=0.32`, `threshold=0.94`; the browser task may reduce strength further, but it may not lower the threshold below 0.94.

- [ ] **Step 5: Run green and build**

```bash
npx vitest run src/three/floorGaps.test.ts src/three/tokenPose.test.ts
npm run build
```

Expected: 4 new tests pass; full build has zero failures.

- [ ] **Step 6: Commit**

```bash
git add src/three/floorGaps.ts src/three/floorGaps.test.ts src/three/pitPresentation.ts src/three/tokenPose.ts src/three/tokenPose.test.ts src/three/level3d.ts src/three/main.ts
git commit -m "fix: improve bedroom pits and token readability"
```

---

### Task 6: Implement the Pure Five-Beat Reaction Machine

**Files:**
- Create: `src/three/bedroomReactions.ts`
- Create: `src/three/bedroomReactions.test.ts`

**Interfaces:**
- Consumes: current segment, previous/current x, simulation flags, stomp count, pit respawn, Teddy pickup, dt, and derived crib/pit thresholds.
- Produces: `createBedroomReactionState`, `stepBedroomReactions`, `resetBedroomReactions`, and one-shot `fired` events.

- [ ] **Step 1: Write failing behavior tests**

Cover these exact cases:

```ts
import { describe, expect, it } from "vitest";
import {
  createBedroomReactionState,
  resetBedroomReactions,
  stepBedroomReactions,
  type BedroomReactionInput,
} from "./bedroomReactions";

const base: BedroomReactionInput = {
  segmentIndex: 0,
  previousX: 0,
  playerX: 10,
  justJumped: false,
  stompCount: 0,
  pitRespawn: false,
  teddyCollected: false,
  cribMidpointX: 100,
  firstPitEndX: 200,
  dtMs: 16,
};

describe("Bedroom reactions", () => {
  it("fires segment 1 only on an executed jump, not a buffered press", () => {
    const nearby = stepBedroomReactions(createBedroomReactionState(), base);
    expect(nearby.fired).toEqual([]);
    const fired = stepBedroomReactions(nearby.state, { ...base, justJumped: true });
    expect(fired.fired).toEqual(["room-notices"]);
  });

  it("fires segment 2 only on a confirmed stomp", () => {
    const nearby = stepBedroomReactions(createBedroomReactionState(), { ...base, segmentIndex: 1 });
    expect(nearby.fired).toEqual([]);
    const fired = stepBedroomReactions(nearby.state, { ...base, segmentIndex: 1, stompCount: 1 });
    expect(fired.fired).toEqual(["play-joins"]);
  });

  it("fires segment 3 only when crossing the crib midpoint left-to-right", () => {
    const fired = stepBedroomReactions(createBedroomReactionState(), {
      ...base,
      segmentIndex: 2,
      previousX: 99,
      playerX: 101,
    });
    expect(fired.fired).toEqual(["magic-awakens"]);
  });

  it("fires segment 4 on successful first-pit crossing but not pit respawn", () => {
    const failed = stepBedroomReactions(createBedroomReactionState(), {
      ...base,
      segmentIndex: 3,
      previousX: 199,
      playerX: 201,
      pitRespawn: true,
    });
    expect(failed.fired).toEqual([]);
    const cleared = stepBedroomReactions(createBedroomReactionState(), {
      ...base,
      segmentIndex: 3,
      previousX: 199,
      playerX: 201,
    });
    expect(cleared.fired).toEqual(["wonder-climbs"]);
  });

  it("fires segment 5 only when Teddy is newly collected", () => {
    const fired = stepBedroomReactions(createBedroomReactionState(), {
      ...base,
      segmentIndex: 4,
      teddyCollected: true,
    });
    expect(fired.fired).toEqual(["room-celebrates"]);
  });

  it("does not fire a signature twice after checkpoint movement", () => {
    const first = stepBedroomReactions(createBedroomReactionState(), { ...base, justJumped: true });
    const second = stepBedroomReactions(first.state, { ...base, justJumped: true });
    expect(second.fired).toEqual([]);
  });

  it("full reset returns every beat to dormant", () => {
    const fired = stepBedroomReactions(createBedroomReactionState(), { ...base, justJumped: true });
    expect(Object.values(resetBedroomReactions(fired.state).phases)).toEqual([
      "dormant", "dormant", "dormant", "dormant", "dormant",
    ]);
  });
});
```

Use `SIGNATURE_MS = 1200`; after 1200ms a fired beat becomes `settled`.

- [ ] **Step 2: Run red**

```bash
npx vitest run src/three/bedroomReactions.test.ts
```

Expected: missing module.

- [ ] **Step 3: Implement the serializable state machine**

```ts
export type BedroomBeatId = "room-notices" | "play-joins" | "magic-awakens" | "wonder-climbs" | "room-celebrates";
export type BedroomBeatPhase = "dormant" | "nearby" | "fired" | "settled";

export interface BedroomReactionState {
  phases: Record<BedroomBeatId, BedroomBeatPhase>;
  remainingMs: Record<BedroomBeatId, number>;
}

export interface BedroomReactionInput {
  segmentIndex: number;
  previousX: number;
  playerX: number;
  justJumped: boolean;
  stompCount: number;
  pitRespawn: boolean;
  teddyCollected: boolean;
  cribMidpointX: number;
  firstPitEndX: number;
  dtMs: number;
}

export interface BedroomReactionStep {
  state: BedroomReactionState;
  fired: BedroomBeatId[];
}

const BEATS: ReadonlyArray<{ id: BedroomBeatId; segmentIndex: number }> = [
  { id: "room-notices", segmentIndex: 0 },
  { id: "play-joins", segmentIndex: 1 },
  { id: "magic-awakens", segmentIndex: 2 },
  { id: "wonder-climbs", segmentIndex: 3 },
  { id: "room-celebrates", segmentIndex: 4 },
];

const SIGNATURE_MS = 1200;

export function createBedroomReactionState(): BedroomReactionState {
  return {
    phases: Object.fromEntries(BEATS.map(({ id }) => [id, "dormant"])) as BedroomReactionState["phases"],
    remainingMs: Object.fromEntries(BEATS.map(({ id }) => [id, 0])) as BedroomReactionState["remainingMs"],
  };
}

export function resetBedroomReactions(_state?: BedroomReactionState): BedroomReactionState {
  return createBedroomReactionState();
}

function triggerFor(id: BedroomBeatId, input: BedroomReactionInput): boolean {
  switch (id) {
    case "room-notices": return input.segmentIndex === 0 && input.justJumped;
    case "play-joins": return input.segmentIndex === 1 && input.stompCount > 0;
    case "magic-awakens": return input.segmentIndex === 2 && input.previousX < input.cribMidpointX && input.playerX >= input.cribMidpointX;
    case "wonder-climbs": return input.segmentIndex === 3 && !input.pitRespawn && input.previousX < input.firstPitEndX && input.playerX >= input.firstPitEndX;
    case "room-celebrates": return input.segmentIndex === 4 && input.teddyCollected;
  }
}

export function stepBedroomReactions(
  previous: BedroomReactionState,
  input: BedroomReactionInput,
): BedroomReactionStep {
  const phases = { ...previous.phases };
  const remainingMs = { ...previous.remainingMs };
  const fired: BedroomBeatId[] = [];
  for (const beat of BEATS) {
    if (phases[beat.id] === "dormant" && input.segmentIndex === beat.segmentIndex) {
      phases[beat.id] = "nearby";
    }
    if ((phases[beat.id] === "dormant" || phases[beat.id] === "nearby") && triggerFor(beat.id, input)) {
      phases[beat.id] = "fired";
      remainingMs[beat.id] = SIGNATURE_MS;
      fired.push(beat.id);
    } else if (phases[beat.id] === "fired") {
      remainingMs[beat.id] = Math.max(0, remainingMs[beat.id] - input.dtMs);
      if (remainingMs[beat.id] === 0) phases[beat.id] = "settled";
    }
  }
  return { state: { phases, remainingMs }, fired };
}
```

- [ ] **Step 4: Run green and commit**

```bash
npx vitest run src/three/bedroomReactions.test.ts
git add src/three/bedroomReactions.ts src/three/bedroomReactions.test.ts
git commit -m "feat: add bedroom reaction state machine"
```

Expected: 7 tests pass.

---

### Task 7: Build the Reactive Storybook Overlay

**Files:**
- Create: `src/three/bedroomStorybookView.ts`
- Create: `src/three/bedroomStorybookView.test.ts`
- Modify: `src/three/bedroomSet.ts`
- Modify: `src/three/paintedBackdrop.ts`

**Interfaces:**
- Consumes: chapter boundaries x=92/x=142, segment centers, reaction phases/events, and elapsed time.
- Produces: `buildBedroomStorybookView(layout): BedroomStorybookView` with `group`, `trigger(id)`, `sync(phases)`, `update(dtMs, elapsedMs)`, `reset()`, and `snapshot()`.

- [ ] **Step 1: Write the view contract tests**

```ts
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildBedroomStorybookView } from "./bedroomStorybookView";

describe("BedroomStorybookView", () => {
  it("builds one lamp and one plant at the approved seams", () => {
    const view = buildBedroomStorybookView({ lampX: 92, plantX: 142, cribX: 117, finaleX: 220 });
    expect(view.group.getObjectByName("storybook-lamp")?.position.x).toBe(92);
    expect(view.group.getObjectByName("storybook-plant")?.position.x).toBe(142);
  });

  it("adds at most one PointLight and no shadow-casting reactive object", () => {
    const view = buildBedroomStorybookView({ lampX: 92, plantX: 142, cribX: 117, finaleX: 220 });
    let points = 0;
    view.group.traverse((object) => {
      if (object instanceof THREE.PointLight) points += 1;
      expect(object.castShadow).toBe(false);
    });
    expect(points).toBeLessThanOrEqual(1);
  });

  it("trigger changes energy and reset restores dormant values", () => {
    const view = buildBedroomStorybookView({ lampX: 92, plantX: 142, cribX: 117, finaleX: 220 });
    view.trigger("wonder-climbs");
    view.update(100, 100);
    expect(view.snapshot().energies["wonder-climbs"]).toBeGreaterThan(0);
    view.reset();
    expect(view.snapshot().energies["wonder-climbs"]).toBe(0);
  });
});
```

- [ ] **Step 2: Run red**

```bash
npx vitest run src/three/bedroomStorybookView.test.ts
```

Expected: module missing.

- [ ] **Step 3: Build five focused overlay groups**

Implement one class with deterministic energy envelopes. Each `trigger` sets energy to 1.0; `update` eases toward a settled floor of 0.18 over 1200ms. Construct:

- `room-notices`: three small block meshes near segment 1 whose y/rotation pulse; reuse butterfly field wake for the lift.
- `play-joins`: lamp silhouette/glow at x=92 with the overlay's only `PointLight`; toy-wheel cylinders rotate briefly.
- `magic-awakens`: four emissive star meshes orbit at x=117 and six thin rail shimmer strips sweep once.
- `wonder-climbs`: plant at x=142 with eight emissive bulbs that light bottom-to-top, then five book-spine glows.
- `room-celebrates`: round window glow and door halo at x=220 plus a sparkle sweep using the existing shared FX pool, not a second `THREE.Points` field.

Use named groups/materials so `snapshot()` can return energies and material intensities without renderer access. Use only sine/easing from elapsed time; no random calls.

- [ ] **Step 4: Make the bridge lamp unique**

In `bedroomSet.ts`, when `paintedWall === true`, do not add the old randomly placed `buildNightstandLamp` or its rug/PointLight. Keep the classic look unchanged. Include the seam lamp x=92 in the dust-mote anchor list so the existing one-Points-field budget still holds.

- [ ] **Step 5: Add butterfly wake/reset**

Extend `ButterflyField` with `wake(amount = 1)` and `reset()`. Store a scalar wake energy, decay it toward 0.18, and multiply the existing `butterflyPose` displacement/wing speed by `1 + energy * 1.8`. Do not add butterflies or textures.

- [ ] **Step 6: Run tests and verify budgets**

```bash
npx vitest run src/three/bedroomStorybookView.test.ts src/three/butterflyPath.test.ts src/three/worldThemes.test.ts
npm run typecheck
```

Expected: 3 new view tests pass, existing butterfly/theme tests pass, typecheck passes.

- [ ] **Step 7: Commit**

```bash
git add src/three/bedroomStorybookView.ts src/three/bedroomStorybookView.test.ts src/three/bedroomSet.ts src/three/paintedBackdrop.ts
git commit -m "feat: add bedroom reactive storybook overlays"
```

---

### Task 8: Add Semantic Placeholder Audio

**Files:**
- Create: `assets/audio/placeholders/supereloise/README.md`
- Create binary copies: `small_jump.ogg`, `stomp.ogg`, `coin.ogg`, `bump.ogg`, `brick-bump.ogg`, `death.wav`, `powerup_appears.ogg`, `powerup.ogg`, `pipe.ogg`, `main_theme.ogg`
- Create: `src/three/audio.ts`
- Create: `src/three/audio.test.ts`
- Create: `src/three/webAudioSink.ts`

**Interfaces:**
- Consumes: semantic `AudioCue` ids and imported Vite asset URLs.
- Produces: `BedroomAudioDirector`, `AudioSink`, and `createWebAudioSink(urls)`.

- [ ] **Step 1: Copy the approved family-use placeholders and record provenance**

```bash
mkdir -p assets/audio/placeholders/supereloise
cp /Users/homebase/Documents/SuperEloise/upstream-super-mario-python/sfx/small_jump.ogg /Users/homebase/Documents/SuperEloise/upstream-super-mario-python/sfx/stomp.ogg /Users/homebase/Documents/SuperEloise/upstream-super-mario-python/sfx/coin.ogg /Users/homebase/Documents/SuperEloise/upstream-super-mario-python/sfx/bump.ogg /Users/homebase/Documents/SuperEloise/upstream-super-mario-python/sfx/brick-bump.ogg /Users/homebase/Documents/SuperEloise/upstream-super-mario-python/sfx/death.wav /Users/homebase/Documents/SuperEloise/upstream-super-mario-python/sfx/powerup_appears.ogg /Users/homebase/Documents/SuperEloise/upstream-super-mario-python/sfx/powerup.ogg /Users/homebase/Documents/SuperEloise/upstream-super-mario-python/sfx/pipe.ogg /Users/homebase/Documents/SuperEloise/upstream-super-mario-python/sfx/main_theme.ogg assets/audio/placeholders/supereloise/
```

The README must state the local source path, upstream URL, personal-family placeholder scope, replace-before-public-distribution note, and these SHA-256 values:

```text
8b22f0244134d546df2fc18485d3555a438c43fb7fc6ddc30f12ce9669d078a0  small_jump.ogg
28d29d6c63c9f8ffec9605cb7560491e3e95092812d7628b4e3181687e0906f5  stomp.ogg
378a8a188e45421a4592a57fd29e68e6ec0a64b236ed8e9abf46cbf3314f5c6c  coin.ogg
6341b88f0f3e5a34d46fa5dc8fc5f6f1ceee5a9adaab6ca9240969da4f231e4a  bump.ogg
7b4fa0f6e0fc1729d1aea6e6f06fe5f907b62f5e9187fa8338a7ba869a047643  brick-bump.ogg
9934dbf26c48c4219d3770c5eedd5f1fc1a1e616c98d0413fae0ba9d4533f005  death.wav
defb39e9c061fe533d7099cd35e837d5503cb45d2ed3d0cafb44afa980a78cc4  powerup_appears.ogg
e6e09fde8c2b156fdf2283757bcb456a14d21afa98a2538db50a0b1eb21849df  powerup.ogg
058c1c59fd463f94d879fa87aab43ac3094772dc63f08052ccbd4864c36f66ac  pipe.ogg
157aa0668599958e6d41a0f74b93908debb77407f01069ec79cb998cddc36a6d  main_theme.ogg
```

- [ ] **Step 2: Write failing director tests with a fake sink**

```ts
import { describe, expect, it } from "vitest";
import { BedroomAudioDirector, type AudioCue, type AudioSink } from "./audio";

class FakeSink implements AudioSink {
  calls: string[] = [];
  unlock = async () => { this.calls.push("unlock"); };
  play = (cue: AudioCue) => { this.calls.push(`play:${cue}`); };
  startMusic = () => { this.calls.push("music"); };
  setMuted = (muted: boolean) => { this.calls.push(`mute:${muted}`); };
}

it("unlocks and starts music once", async () => {
  const sink = new FakeSink();
  const audio = new BedroomAudioDirector(sink);
  await audio.unlock();
  await audio.unlock();
  expect(sink.calls).toEqual(["unlock", "music"]);
});

it("routes semantic gameplay cues", () => {
  const sink = new FakeSink();
  const audio = new BedroomAudioDirector(sink);
  audio.play("jump");
  audio.play("token");
  expect(sink.calls).toEqual(["play:jump", "play:token"]);
});

it("mute state is idempotent", () => {
  const sink = new FakeSink();
  const audio = new BedroomAudioDirector(sink);
  audio.setMuted(true);
  audio.setMuted(true);
  expect(sink.calls).toEqual(["mute:true"]);
});
```

- [ ] **Step 3: Run red**

```bash
npx vitest run src/three/audio.test.ts
```

Expected: module missing.

- [ ] **Step 4: Implement semantic cue ids and director**

```ts
export type AudioCue = "jump" | "stomp" | "token" | "impact" | "pit-reset" | "magic-rise" | "teddy" | "exit";

export interface AudioSink {
  unlock(): Promise<void>;
  play(cue: AudioCue): void;
  startMusic(): void;
  setMuted(muted: boolean): void;
}

export class BedroomAudioDirector {
  private unlocked = false;
  private muted = false;
  constructor(private readonly sink: AudioSink) {}

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    await this.sink.unlock();
    this.unlocked = true;
    this.sink.startMusic();
  }

  play(cue: AudioCue): void { this.sink.play(cue); }

  setMuted(muted: boolean): void {
    if (muted === this.muted) return;
    this.muted = muted;
    this.sink.setMuted(muted);
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted(): boolean { return this.muted; }
}
```

- [ ] **Step 5: Implement the WebAudio sink**

Import every placeholder with `?url`. Lazily fetch/decode buffers on `unlock()`. Create one master gain, one music gain at 0.14, and one SFX gain at 0.24. `play()` creates a fresh `AudioBufferSourceNode`; token pickups cycle deterministic playback rates `[0.97, 1.0, 1.03]`. Pit reset uses gain 0.12 and stops after 1.25 seconds. Teddy ducks the music bus to 0.07 for 900ms, then restores 0.14. Catch fetch/decode/play failures per cue, warn once per cue, and never reject the frame loop. `startMusic()` loops `main_theme.ogg` only after successful unlock.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run src/three/audio.test.ts
npm run typecheck
git add assets/audio/placeholders/supereloise src/three/audio.ts src/three/audio.test.ts src/three/webAudioSink.ts
git commit -m "feat: add placeholder bedroom audio"
```

Expected: 3 director tests pass; typecheck passes.

---

### Task 9: Wire Reactions, Audio, Reset Semantics, and Debug Probes

**Files:**
- Modify: `src/three/main.ts`
- Modify: `src/three/hud.ts`
- Test: `src/three/bedroomReactions.test.ts`
- Test: `src/three/audio.test.ts`

**Interfaces:**
- Consumes: all pure/view/audio interfaces from Tasks 5–8.
- Produces: live Bedroom reactions and audio; `__weezy3d.reactions()`, `__weezy3d.audio()`, and existing browser-test controls.

- [ ] **Step 1: Refactor event helpers to return explicit edges**

Change the existing helpers without changing their current side effects:

- `collectTokens(): number` initializes `pickups = 0`, increments it inside the existing successful pickup branch, and returns it after the loop.
- `checkExit(): boolean` returns `false` when already won or not touching the exit, performs the existing win side effects on the contact edge, then returns `true`.
- `checkKillPlane(): boolean` returns `false` above the kill plane, performs the existing checkpoint respawn below it, then returns `true`.
- `updateEnemies(dtMs): EnemyStepResult` retains the current stomp/damage/hearts logic and returns the exact `ev` produced by `stepEnemies`.
- `checkCompanion(): boolean` returns `false` before contact or after collection, performs the existing Teddy side effects on the contact edge, then returns `true`.

Collect the results in one typed object so later wiring cannot confuse level state with event edges:

```ts
interface BedroomFrameEvents {
  tokenPickups: number;
  exitReached: boolean;
  pitRespawn: boolean;
  enemies: EnemyStepResult;
  teddyCollected: boolean;
}

const frameEvents: BedroomFrameEvents = {
  tokenPickups: collectTokens(),
  exitReached: checkExit(),
  pitRespawn: checkKillPlane(),
  enemies: updateEnemies(dtMs),
  teddyCollected: checkCompanion(),
};
```

Do not infer events by comparing HUD text or mesh visibility.

- [ ] **Step 2: Derive reaction thresholds once at boot**

Use render-pixel coordinates for the state machine:

```ts
const cribMidpointX = (segments[2]!.startX + segments[2]!.endX) / 2;
const floorRangesPx = level.platforms
  .filter((platform) => platform.h >= 55)
  .map((platform) => [platform.x, platform.x + platform.w] as const);
const floorGapsPx = findFloorGaps(floorRangesPx, level.bounds.minX, level.bounds.maxX);
const firstSegment4Pit = firstGapInRange(floorGapsPx, segments[3]!.startX, segments[3]!.endX);
if (!firstSegment4Pit) throw new Error("Bedroom segment 4 must contain its authored confidence pit");
```

- [ ] **Step 3: Instantiate the storybook view and audio only for Bedroom painted mode**

Resolve chapters, create `BedroomStorybookView` with lamp 92, plant 142, crib center, and finale center, add its group to the scene, and initialize reaction state. Create the semantic audio director using `createWebAudioSink`. Other worlds receive `null` for both and keep their current behavior.

- [ ] **Step 4: Drive one reaction step per simulation frame**

Capture `previousX` before `stepPlayer`. After explicit gameplay event helpers run, call:

```ts
const reactionStep = stepBedroomReactions(reactionState, {
  segmentIndex: segments.indexOf(segmentAt(segments, player.x)),
  previousX,
  playerX: player.x,
  justJumped: player.justJumped,
  stompCount: enemyEvents.stomps.length,
  pitRespawn,
  teddyCollected,
  cribMidpointX,
  firstPitEndX: firstSegment4Pit.endX,
  dtMs,
});
reactionState = reactionStep.state;
storybook?.sync(reactionState.phases);
for (const beat of reactionStep.fired) {
  storybook?.trigger(beat);
  if (beat === "room-notices") butterflies?.wake();
  if (beat === "magic-awakens" || beat === "wonder-climbs") audio?.play("magic-rise");
}
```

Route `jump`, `token`, `stomp`, `pit-reset`, `teddy`, and `exit` from their explicit event edges.

- [ ] **Step 5: Preserve checkpoint memory and reset only on full replay**

Do not reset reaction state inside `checkKillPlane` or hearts respawn. In `resetLevel()`, call `resetBedroomReactions`, `storybook.reset()`, and `butterflies.reset()`. Music continues across replay; one-shot cues do not queue.

- [ ] **Step 6: Add user-gesture unlock and mute UI**

Add a HUD sound button with `pointer-events:auto`, `aria-label`, and text `Sound: On/Off`. Extend Hud options with `onMuteChange?: (muted: boolean) => void`. Register one-time `pointerdown` and `keydown` listeners that call `audio.unlock()`; when gamepad first connects after a button press, call it again safely. A failed unlock remains silent and retryable on the next gesture.

- [ ] **Step 7: Expose debug probes**

Add:

```ts
reactions: () => ({ phases: { ...reactionState.phases }, ...storybook?.snapshot() }),
audio: () => ({ muted: audio?.isMuted() ?? true }),
```

Keep all existing `__weezy3d` probes intact.

- [ ] **Step 8: Run targeted and full verification**

```bash
npx vitest run src/three/bedroomReactions.test.ts src/three/bedroomStorybookView.test.ts src/three/audio.test.ts src/three/floorGaps.test.ts src/three/tokenPose.test.ts
npm run build
```

Expected: all targeted tests pass and production build has zero failures.

- [ ] **Step 9: Commit**

```bash
git add src/three/main.ts src/three/hud.ts
git commit -m "feat: wire bedroom reactions and audio"
```

---

### Task 10: Full Browser Playtest, Performance Gate, and Cookbook Freeze

**Files:**
- Modify: `src/three/main.ts` only for evidence-backed tuning found in this task
- Modify: `docs/3d-transition/weezy3d-playbook.md`
- Modify: `PROGRESS.md`
- Create screenshots under: `output/bedroom-benchmark/` (do not commit raw run captures unless selected as documented baselines)

**Interfaces:**
- Consumes: finished Bedroom build and `__weezy3d` probes.
- Produces: verified benchmark, cookbook recipe, progress record, and final user verdict.

- [ ] **Step 1: Start a fixed-port dev server**

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

Expected: Vite serves `http://127.0.0.1:4173/` without compile errors.

- [ ] **Step 2: Run an automated continuous-play smoke**

```bash
node /Users/homebase/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url "http://127.0.0.1:4173/?world=bedroom" --actions-json '{"steps":[{"buttons":["right"],"frames":90},{"buttons":["right","space"],"frames":12},{"buttons":["right"],"frames":120}]}' --iterations 5 --pause-ms 250 --screenshot-dir output/bedroom-benchmark/smoke
```

Expected: five screenshots, no `errors-*.json`, player advances, and game remains responsive.

- [ ] **Step 3: Capture all required visual stations**

Using the browser and `__weezy3d.teleport(x, y); __weezy3d.snapCamera()`, capture:

- opening spawn;
- segment 1 center;
- x=86, 92, 98 lamp seam;
- crib low/high routes;
- x=136, 142, 148 plant seam;
- before/after first segment-4 pit;
- Teddy before/after collection;
- exit overscroll and win framing.

Expected: no art gap, floor jump, exposure flash, doubled bridge object, repeated landmark, false platform read, clipped highlight, or edge-on token.

- [ ] **Step 4: Verify every reaction and checkpoint rule numerically**

Use `__weezy3d.setSimInput`, `jumpToSegment`, and `reactions()` to prove:

- first executed jump fires beat 1 once;
- first stomp fires beat 2 once;
- crib midpoint fires beat 3 once;
- failed pit attempt does not fire beat 4, successful crossing does;
- Teddy fires beat 5;
- checkpoint respawn preserves settled beats;
- `reset()` returns all beats to dormant.

- [ ] **Step 5: Verify audio behavior**

With sound on and off, verify jump, token, stomp, pit reset, magic rise, Teddy, exit, and looping music. Confirm first interaction unlocks audio, mute survives repeated clicks without duplicate music, and missing/blocked audio produces at most one warning per cue.

- [ ] **Step 6: Run the scene and performance census**

Traverse `__weezy3d.scene` and record:

- exactly three meshes named `bedroom-panorama:*` plus one wallpaper;
- total lights ≤6;
- one shared FX `THREE.Points` field and no added reaction particle field;
- reactive objects have `castShadow=false`;
- no cadence copies of old vignettes;
- representative frame pacing remains steady at normal play.

If performance regresses, reduce reactive overlay mesh/particle count before changing texture resolution, gameplay readability, or physics.

- [ ] **Step 7: Run the final production gate**

```bash
npm run build
git diff --check
```

Expected: TypeScript passes, all Vitest tests pass, Vite production build succeeds, and no whitespace errors exist.

- [ ] **Step 8: Update the cookbook and progress record**

Add exact final values to `docs/3d-transition/weezy3d-playbook.md`: generation prompts, frame inheritance, bake sizes, world extents, alpha math, bridge rules, state-machine rules, audio buses/cue mapping, light/shadow budgets, rejected approaches, browser stations, and tuning knobs. Update `PROGRESS.md` with test count, build result, scene census, screenshot paths, and the explicit gate that other worlds remain pending until the user's Bedroom verdict.

- [ ] **Step 9: Obtain the final human feel verdict**

Have the user play the complete Bedroom at ordinary speed and explicitly judge:

- panorama composition and seam invisibility;
- pit/platform/token readability;
- reaction restraint and escalation;
- audio balance and fatigue;
- Teddy/window finale payoff;
- whether this is the cookbook benchmark for future worlds.

Do not mark the Bedroom proof complete without this verdict.

- [ ] **Step 10: Commit the verified benchmark documentation**

```bash
git add docs/3d-transition/weezy3d-playbook.md PROGRESS.md
git commit -m "docs: freeze bedroom visual benchmark cookbook"
```

After this commit, create separate shortening/transformation plans for Hallway, Kitchen, Family Room, and Backyard in that order.
