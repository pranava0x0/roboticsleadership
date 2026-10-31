#!/usr/bin/env python3
"""Measure what an agent loads at startup in a project, and plan moving old seeds out.

Claude Code loads CLAUDE.md and follows its `@path` imports; Codex reads the root
AGENTS.md up to project_doc_max_bytes (32 KiB by default). Both are re-read on every
request, and by every subagent. The Sep 21-Oct 21 2026 audit
(reports/token-audit-2026-10-21.md) found two projects loading 169 KB and 274 KB,
about 50M weighted tokens a month between them, mostly old whole-file seeds of this
repo with project rules mixed in.

    instruction_budget.py [PROJECT ...]          # default: every folder in ~/Projects
    instruction_budget.py --migrate PROJECT      # plan only: which lines are project rules
    instruction_budget.py --migrate PROJECT --apply

Report: one line per project, then a count. Exit 0 when every project is within
BUDGET, 1 when any is over, 2 when nothing was examined (an empty run is not a pass).

--migrate classifies the lines of the project's CLAUDE.md and AGENTS.md. A line is
base text when it appears, whitespace-normalized, in any doc this repo ships
(seed-manifest.txt, LEDGER.md included, since old rules moved there). Everything
else is a project rule. Fenced code blocks move as one unit, short lines follow
the line before them, and a heading stays when anything under it stays. With
--apply the originals are copied to .cbp/legacy/ first, the project rules become
AGENTS.md (no markers yet) and CLAUDE.md becomes `@AGENTS.md`; run
`seed.sh --cbp PROJECT` afterwards to add the core block. Matching is exact, so
base text that was edited in the project is kept as a project rule: the plan errs
toward keeping too much, never toward losing a rule.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Iterable, List, Optional, Set, Tuple

ROOT = Path(__file__).resolve().parent.parent
PROJECTS = Path.home() / "Projects"
BUDGET = 20 * 1024
CODEX_CAP = 32 * 1024
SHORT = 20          # lines shorter than this carry no evidence of their own
# Claude Code accepts an import anywhere outside a code span or fence, with "\ " for
# a space in the path. Not after a word character, so mail@example.com is no import.
IMPORT = re.compile(r"(?<![\w@/])@((?:[^\s`\\]|\\ )+)")
CODE_SPAN = re.compile(r"`[^`\n]*`")
HEADING = re.compile(r"^(#{1,6})\s")
FENCE = re.compile(r"^\s*(```|~~~)")


def loaded(claude_md: Path, seen: Optional[Set[Path]] = None) -> List[Path]:
    """CLAUDE.md and every file it imports, recursively, each once."""
    seen = set() if seen is None else seen
    f = claude_md.resolve()
    if f in seen or not f.is_file():
        return []
    seen.add(f)
    out = [f]
    in_fence = False
    for line in f.read_text(encoding="utf-8", errors="replace").splitlines():
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for m in IMPORT.finditer(CODE_SPAN.sub("", line)):
            raw = m.group(1).replace("\\ ", " ")
            for cand in (raw, raw.rstrip(".,;:!?)]}\"'")):   # "See @README." ends a sentence
                q = Path(cand).expanduser()
                q = q if q.is_absolute() else f.parent / q
                if q.is_file():
                    out += loaded(q, seen)
                    break
    return out


def measure(project: Path) -> Tuple[int, int, int]:
    """(bytes Claude Code loads, files, bytes Codex loads)."""
    files = loaded(project / "CLAUDE.md")
    claude = sum(p.stat().st_size for p in files)
    return claude, len(files), codex_load(project)


SKIP_DIRS = {".git", "node_modules", ".venv", "venv", ".cbp", "dist", "build", "__pycache__"}


def codex_load(project: Path) -> int:
    """The largest chain Codex reads: every AGENTS.md from the project root down to the
    deepest folder a session can start in, summed and capped at project_doc_max_bytes."""
    worst = 0
    for here, dirs, files in os.walk(project):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        if "AGENTS.md" not in files:
            continue
        chain, d = 0, Path(here)
        while True:
            f = d / "AGENTS.md"
            if f.is_file():
                chain += f.stat().st_size
            if d == project or d.parent == d:
                break
            d = d.parent
        worst = max(worst, chain)
    return min(worst, CODEX_CAP)


def report(projects: Iterable[Path], budget: int = BUDGET) -> int:
    rows = []
    for p in projects:
        if not p.is_dir():
            continue
        claude, n, codex = measure(p)
        if claude or codex:
            rows.append((claude, n, codex, p))
    if not rows:
        print("instruction_budget: examined 0 projects with a CLAUDE.md or AGENTS.md; "
              "refusing to pass on nothing", file=sys.stderr)
        return 2
    rows.sort(key=lambda r: -r[0])
    over = 0
    for claude, n, codex, p in rows:
        flag = "OVER" if max(claude, codex) > budget else "ok"
        over += flag == "OVER"
        print(f"{flag:4}  claude {claude / 1024:6.1f} KB in {n} file(s), ~{claude / 2.97 / 1000:.0f}K tokens"
              f"  codex {codex / 1024:5.1f} KB  {p.name}")
    print(f"instruction_budget: {len(rows)} projects examined, {over} over {budget // 1024} KB")
    return 1 if over else 0


# ---------------------------------------------------------------- migration

def norm(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip())


def base_lines(root: Path = ROOT) -> Set[str]:
    names = [n.strip() for n in (root / "seed-manifest.txt").read_text().splitlines()
             if n.strip() and not n.startswith("#")]
    out: Set[str] = set()
    for n in names:
        p = root / n
        if p.is_file():
            out.update(norm(l) for l in p.read_text(encoding="utf-8", errors="replace").splitlines())
    out.discard("")
    return out


def blocks(lines: List[str]) -> List[List[str]]:
    """Group lines so a fenced code block is one unit."""
    out: List[List[str]] = []
    fence: Optional[List[str]] = None
    for line in lines:
        if fence is not None:
            fence.append(line)
            if FENCE.match(line):
                out.append(fence)
                fence = None
        elif FENCE.match(line):
            fence = [line]
        else:
            out.append([line])
    if fence is not None:
        out.append(fence)
    return out


def classify(text: str, base: Set[str]) -> List[Tuple[str, bool]]:
    """(line, keep) for every line of text."""
    units = blocks(text.splitlines())
    keep_unit: List[Optional[bool]] = []
    for u in units:
        if len(u) > 1:                                   # fenced block: base only if every line is
            keep_unit.append(any(norm(l) and norm(l) not in base for l in u))
        else:
            n = norm(u[0])
            if not n or HEADING.match(u[0]) or len(n) < SHORT:
                keep_unit.append(None)                   # decided by context below
            else:
                keep_unit.append(n not in base)
    # A short line follows the evidence before it in its own section; with none
    # (a section of short lines, like "## Commands" / "- Use pnpm."), it stays.
    last: Optional[bool] = None
    for i, k in enumerate(keep_unit):
        head = len(units[i]) == 1 and HEADING.match(units[i][0])
        if head:
            last = None
        elif k is None and norm(units[i][0]):
            keep_unit[i] = True if last is None else last
        elif k is not None:
            last = k
    # A heading stays when anything in its section (up to the next heading of the
    # same or a higher level) stays.
    for i, u in enumerate(units):
        m = HEADING.match(u[0]) if len(u) == 1 else None
        if not m:
            continue
        level = len(m.group(1))
        kept = False
        for j in range(i + 1, len(units)):
            mj = HEADING.match(units[j][0]) if len(units[j]) == 1 else None
            if mj and len(mj.group(1)) <= level:
                break
            if keep_unit[j] and not mj:
                kept = True
                break
        keep_unit[i] = kept
    out: List[Tuple[str, bool]] = []
    for u, k in zip(units, keep_unit):
        for line in u:
            out.append((line, bool(k) if norm(line) else False))
    return out


def project_rules(project: Path, base: Set[str]) -> Tuple[str, int, int]:
    """(kept text, bytes kept, bytes before) from CLAUDE.md then AGENTS.md, deduplicated."""
    kept: List[str] = []
    seen: Set[str] = set()
    before = 0
    for name in ("CLAUDE.md", "AGENTS.md"):
        f = project / name
        if not f.is_file():
            continue
        text = f.read_text(encoding="utf-8", errors="replace")
        before += len(text.encode())
        for line, keep in classify(text, base):
            n = norm(line)
            if n in ("@AGENTS.md", "@CLAUDE.md"):
                continue
            if keep and (n not in seen or HEADING.match(line) is None and len(n) < SHORT):
                kept.append(line)
                seen.add(n)
            elif not n and kept and kept[-1].strip():
                kept.append("")
    text = "\n".join(kept).strip() + "\n" if kept else ""
    return text, len(text.encode()), before


def migrate(project: Path, apply: bool, root: Path = ROOT) -> int:
    if not (project / "CLAUDE.md").is_file() and not (project / "AGENTS.md").is_file():
        print(f"instruction_budget: {project} has no CLAUDE.md or AGENTS.md; nothing to migrate", file=sys.stderr)
        return 2
    if "<!-- cbp:base-start -->" in (project / "AGENTS.md").read_text(errors="replace") \
            if (project / "AGENTS.md").is_file() else False:
        print(f"instruction_budget: {project.name} already uses the .cbp layout; run .cbp/seed.sh --update")
        return 0
    text, after, before = project_rules(project, base_lines(root))
    print(f"plan  {project.name}: {before / 1024:.1f} KB in CLAUDE.md + AGENTS.md -> "
          f"{after / 1024:.1f} KB of project rules kept ({after / max(before, 1):.0%}); "
          f"the core block adds ~{(root / 'AGENTS.md').stat().st_size / 1024:.0f} KB")
    if after > BUDGET:
        print(f"note  project rules alone are {after / 1024:.0f} KB, over {BUDGET // 1024} KB: move "
              "rarely-needed sections into docs/ and link them from AGENTS.md")
    if not apply:
        print("plan only; rerun with --apply to write (originals are copied to .cbp/legacy/ first)")
        return 0
    legacy = project / ".cbp" / "legacy"
    if legacy.exists():
        # A second --apply before seed.sh --cbp would back up the already-migrated files
        # over the originals; the originals are the point of the backup.
        print(f"instruction_budget: {legacy} already holds a backup; restore or move it before "
              "migrating again", file=sys.stderr)
        return 2
    legacy.mkdir(parents=True)
    for name in ("CLAUDE.md", "AGENTS.md"):
        if (project / name).is_file():
            shutil.copy2(project / name, legacy / name)
    (project / "AGENTS.md").write_text(
        "# Project rules\n\nRules for this project only. They win over the core block on conflict.\n\n" + text,
        encoding="utf-8")
    (project / "CLAUDE.md").write_text("@AGENTS.md\n", encoding="utf-8")
    print(f"wrote AGENTS.md (project rules) and CLAUDE.md (@AGENTS.md); originals in {legacy}")
    print(f"next: {root / 'seed.sh'} --cbp '{project}'  # adds the core block above the project rules")
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("projects", nargs="*", type=Path)
    ap.add_argument("--migrate", type=Path, metavar="PROJECT")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--budget-kb", type=int, default=BUDGET // 1024)
    a = ap.parse_args(argv)
    if a.migrate:
        return migrate(a.migrate.expanduser().resolve(), a.apply)
    if a.apply:
        ap.error("--apply only goes with --migrate")
    targets = [p.expanduser() for p in a.projects] or (
        sorted(p for p in PROJECTS.iterdir() if p.is_dir() and not p.name.startswith(".")) if PROJECTS.is_dir() else [])
    return report(targets, a.budget_kb * 1024)


if __name__ == "__main__":
    sys.exit(main())
