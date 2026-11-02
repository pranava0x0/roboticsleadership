#!/usr/bin/env python3
"""Render policies.html's Potential tab from the research file.

Every item is a proposal someone else made (a report, testimony, a bill, an
official), quoted from its source. The site adds none of its own, so the list
is generated from the research file and nothing is hand-written into the slot.

  python3 scripts/build-potential.py           # check: exit 1 if the slot is stale
  python3 scripts/build-potential.py --write   # regenerate the slot
"""
from __future__ import annotations

import html
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data/research/potential-policies-2026-11-02/proposals.jsonl"
PAGE = ROOT / "docs/policies.html"
START, END = "<!--potential:start-->", "<!--potential:end-->"
CAPTURED = "2026-11-02"

AREAS = [
    ("national-strategy", "National strategy"),
    ("coordination", "Coordination in government"),
    ("supply-chain-trade", "Supply chain and trade"),
    ("safety-security", "Security and safety"),
    ("tax-financing", "Tax and financing"),
    ("demonstrations-procurement", "Federal buying and demonstrations"),
    ("research-data", "Research and data"),
    ("standards-testing", "Standards and testing"),
    ("workforce", "Workforce"),
]

# Kept out of the list, with the reason:
#   unverified: the quote was not read on the source page.
#   a reported deliberation is not a proposal (Commerce robotics EO, via Robotics 24/7).
#   already adopted or issued: EO 14363 (Genesis Mission); the Treasury rule is
#   tracked on the Federal tab as a proposed rule.
EXCLUDE_VENUE_PREFIXES = ("Robotics 24/7:", "Executive Order, Launching the Genesis Mission", "Treasury proposed outbound")


def esc(s: str) -> str:
    return html.escape(s or "", quote=True)


def keep(r: dict) -> bool:
    return bool(r.get("verified")) and not r["venue"].startswith(EXCLUDE_VENUE_PREFIXES)


def render(rows: list[dict]) -> str:
    by = defaultdict(list)
    for r in rows:
        by[r["area"]].append(r)
    out = [
        f'{START}',
        '      <p>Proposals that reports, think tanks, trade groups, witnesses, members of Congress and officials have made and no government has adopted. '
        f'Each is quoted from its source; this site adds none of its own. {len(rows)} proposals, captured {CAPTURED}.</p>',
    ]
    for i, (key, label) in enumerate(a for a in AREAS if by.get(a[0])):
        items = sorted(by[key], key=lambda r: r["date"], reverse=True)
        out.append(f'      <details class="collapsible-section" id="potential-{key}"{" open" if i == 0 else ""}>')
        out.append(f'        <summary><h2 class="section-title">{esc(label)}</h2><p class="muted">{len(items)} proposals</p></summary>')
        out.append('        <ul class="potential-list">')
        for r in items:
            page = f', p. {r["page"]}' if r.get("page") else ""
            out.append(
                f'          <li><strong>{esc(r["proposal"].rstrip("."))}.</strong> '
                f'<span class="potential-who">{esc(r["proposer"])}, {esc(r["venue"])}, {esc(r["date"])}{page}.</span> '
                f'<q>{esc(r["quote"])}</q> '
                f'<a href="{esc(r["url"])}" target="_blank" rel="noopener">Source</a></li>'
            )
        out.append('        </ul>')
        out.append('      </details>')
    out.append(f'      {END}')
    return "\n".join(out)


def main() -> None:
    rows = [r for r in (json.loads(l) for l in SRC.read_text().splitlines() if l.strip()) if keep(r)]
    unknown = {r["area"] for r in rows} - {k for k, _ in AREAS}
    if unknown:
        sys.exit(f"build-potential: unknown area(s) {sorted(unknown)}")
    page = PAGE.read_text()
    s, e = page.index(START), page.index(END) + len(END)
    nxt = page[:s] + render(rows) + page[e:]
    if nxt == page:
        print(f"build-potential: {len(rows)} proposals current.")
    elif "--write" in sys.argv:
        PAGE.write_text(nxt)
        print(f"build-potential: wrote {len(rows)} proposals.")
    else:
        sys.exit("build-potential: Potential tab is stale. Run: python3 scripts/build-potential.py --write")


if __name__ == "__main__":
    main()
