#!/usr/bin/env python3
"""
Remove backgrounds from character sprites using rembg (U²-Net).

This replaces the old chroma-key approach (remove-checker.py), which only
worked when the background was a known color palette. rembg uses a model
trained for foreground/background segmentation — it handles white-on-white
characters (like the Dalmatian and white cat) by semantic understanding,
not color matching.

Each generated image needs the JPEG-as-PNG output from NanoBanana stripped
of its fake checkerboard background and saved as a real RGBA PNG.

Usage:
  python3 remove-bg.py <path-to-image> [<path-to-image> ...]
  python3 remove-bg.py --dir <directory>

The output overwrites the input file (in-place).
"""

import sys
import os

from rembg import remove, new_session
from PIL import Image


# u2netp is the lightweight variant — ~5MB model, ~1s per image, plenty good
# for stylized illustration with clean foreground/background separation.
# Switch to "u2net" (~170MB) if quality is insufficient on edges.
MODEL_NAME = "u2netp"


def process(path: str, session) -> None:
    """
    Reset the input's alpha channel to 255 before running rembg. This recovers
    the original JPEG content for files that have already been through an
    earlier (broken) chroma-key pass — without it, alpha=0 holes inside the
    character cause rembg to misclassify the surrounding pixels as background.
    """
    import io
    import numpy as np

    src = Image.open(path).convert("RGBA")
    arr = np.array(src)
    arr[:, :, 3] = 255  # erase prior alpha so rembg sees the full visual
    reset_img = Image.fromarray(arr)

    buf = io.BytesIO()
    reset_img.save(buf, format="PNG")
    output_bytes = remove(buf.getvalue(), session=session)

    out = Image.open(io.BytesIO(output_bytes)).convert("RGBA")
    out.save(path, "PNG")
    out_arr = np.array(out)
    pct = 100.0 * (out_arr[:, :, 3] == 0).sum() / (out_arr.shape[0] * out_arr.shape[1])
    print(f"  {path} — {pct:.1f}% transparent")


def main():
    paths = []
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--dir":
            i += 1
            d = args[i]
            for root, _, files in os.walk(d):
                for f in files:
                    if f.lower().endswith(".png"):
                        paths.append(os.path.join(root, f))
        else:
            paths.append(a)
        i += 1
    if not paths:
        print("Usage: remove-bg.py <file> [<file> ...] | --dir <dir>")
        sys.exit(1)
    print(f"Loading model '{MODEL_NAME}'...")
    session = new_session(MODEL_NAME)
    print(f"Processing {len(paths)} file(s)...")
    for p in paths:
        try:
            process(p, session)
        except Exception as e:
            print(f"  ERROR {p}: {e}")
    print("Done.")


if __name__ == "__main__":
    main()
