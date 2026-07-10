#!/usr/bin/env python3
"""Generate the OG/Twitter share card (docs/assets/share-card.png, 1200x630).

One static branded card shared by every page (see improvement-plan.md P0).
Palette is the Caves of Steel theme from DESIGN.md section 15.3; the headline
is the site thesis. Re-run after changing the thesis copy:

    python3 scripts/make-share-card.py
"""

import logging
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

W, H = 1200, 630
BG = "#121212"        # carbon matte black
SURFACE = "#1a1a1a"   # bay-level gray
ACCENT = "#FFC700"    # sodium yellow
TEXT = "#F5F5F5"      # stark off-white
MUTED = "#B0B0B0"

SERIF_BOLD = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
SANS_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

EYEBROW = "ROBOTICS LEADERSHIP TRACKER"
HEADLINE = [
    ("America has the AI.", TEXT),
    ("China has the scale.", TEXT),
    ("Robotics decides who gets both.", ACCENT),
]
FOOTER = "Live scoreboard · every record cited to a primary source"
URL = "pranava0x0.github.io/roboticsleadership"

OUT = Path(__file__).resolve().parent.parent / "docs" / "assets" / "share-card.png"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Left accent rule — echoes the site's BLUF component
    d.rectangle([64, 150, 70, 468], fill=ACCENT)

    # Eyebrow, letterspaced by hand
    eyebrow_font = font(SANS_BOLD, 26)
    x = 104
    for ch in EYEBROW:
        d.text((x, 160), ch, font=eyebrow_font, fill=ACCENT)
        x += d.textlength(ch, font=eyebrow_font) + 4

    # Headline — shrink until the longest line fits inside the right margin
    size = 68
    head_font = font(SERIF_BOLD, size)
    max_w = W - 100 - 72
    while size > 40 and max(d.textlength(t, font=head_font) for t, _ in HEADLINE) > max_w:
        size -= 2
        head_font = font(SERIF_BOLD, size)
    y = 222
    for line, color in HEADLINE:
        d.text((100, y), line, font=head_font, fill=color)
        y += int(size * 1.24)

    # Footer strip
    d.rectangle([0, H - 78, W, H], fill=SURFACE)
    foot_font = font(SANS, 24)
    d.text((64, H - 78 + 24), FOOTER, font=foot_font, fill=MUTED)
    url_font = font(SANS_BOLD, 24)
    url_w = d.textlength(URL, font=url_font)
    d.text((W - 64 - url_w, H - 78 + 24), URL, font=url_font, fill=TEXT)

    img.save(OUT, optimize=True)
    log.info("wrote %s (%d bytes)", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
