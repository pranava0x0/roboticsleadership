#!/usr/bin/env python3
"""Generate the OG/Twitter share card (docs/assets/share-card.png, 1200x630).

One static branded card shared by every page (see improvement-plan.md P0).
Palette is the Caves of Steel theme from DESIGN.md section 15.3; the headline
is the site thesis. The generated PNG is committed, so this only needs to run
again when the thesis copy changes:

    pip install -r scripts/requirements.txt   # Pillow
    python3 scripts/make-share-card.py

Fonts resolve from a candidate list (macOS Supplemental, then Linux DejaVu)
and the script halts with a clear error if none exist.
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

FONT_CANDIDATES: dict[str, list[str]] = {
    "serif_bold": [
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    ],
    "sans": [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ],
    "sans_bold": [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ],
}


def resolve_font(kind: str) -> str:
    for candidate in FONT_CANDIDATES[kind]:
        if Path(candidate).exists():
            return candidate
    raise SystemExit(
        f"make-share-card: no '{kind}' font found; tried {FONT_CANDIDATES[kind]}. "
        "Install a serif/sans TTF and add its path to FONT_CANDIDATES."
    )


SERIF_BOLD = resolve_font("serif_bold")
SANS = resolve_font("sans")
SANS_BOLD = resolve_font("sans_bold")

EYEBROW = "ROBOTICS LEADERSHIP TRACKER"
# The card states the frame, not a verdict. "Robotics decides who gets both"
# was a prediction written as fact, and the footer's "every record cited to a
# primary source" was simply false (~16% of company sources and ~13% of news
# URLs are secondary press). Both are the site's most-shared copy, so they were
# the most-repeated versions of claims the site can't support. See
# improvement-plan.md § The thesis, which this must stay in sync with.
# Headline changed 2026-08-14: "America has the AI. China has the scale.
# Robotics is where they meet." read too declarative for a strap line —
# swapped for the shorter, non-comparative framing (owner call).
HEADLINE = [
    ("Where AI meets", TEXT),
    ("the physical world.", ACCENT),
]
FOOTER = "Tracked and cited · primary sources preferred"
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

    # Footer strip — the footer is left-aligned and the URL right-aligned in a
    # fixed-width bar, so a footer that outgrows the gap silently prints *over*
    # the URL. That is exactly what happened when this copy was rewritten, and
    # nothing caught it but a human looking at the PNG. Shrink to fit the way
    # the headline above already does, and halt rather than ship an overlap.
    d.rectangle([0, H - 78, W, H], fill=SURFACE)
    url_font = font(SANS_BOLD, 24)
    url_w = d.textlength(URL, font=url_font)
    foot_max = W - 64 - 64 - url_w - 24  # margins + a 24px gutter before the URL

    foot_size = 24
    foot_font = font(SANS, foot_size)
    while foot_size > 14 and d.textlength(FOOTER, font=foot_font) > foot_max:
        foot_size -= 1
        foot_font = font(SANS, foot_size)
    if d.textlength(FOOTER, font=foot_font) > foot_max:
        raise SystemExit(
            f"make-share-card: FOOTER ({FOOTER!r}) does not fit beside the URL "
            f"even at {foot_size}px — shorten it."
        )

    # Anchor both to the strip's vertical middle so they stay aligned to each
    # other even when the footer has been shrunk to a different size.
    strip_mid = H - 78 + 39
    d.text((64, strip_mid), FOOTER, font=foot_font, fill=MUTED, anchor="lm")
    d.text((W - 64, strip_mid), URL, font=url_font, fill=TEXT, anchor="rm")

    img.save(OUT, optimize=True)
    log.info("wrote %s (%d bytes)", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
