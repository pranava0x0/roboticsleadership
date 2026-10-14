#!/usr/bin/env python3
"""How many taps, swipes and keystrokes does a reader spend to reach each key fact?

Ported from Scorpius's tools/interaction_cost.cjs (same geometry: a swipe moves
75% of the visible band; a closed <details> the target sits in costs a tap to
open; a horizontal scroller costs side-swipes). Every task starts on the page a
reader lands on and follows the path a reader would take, counting each step.

    python3 scripts/interaction-cost.py                    # measure + gate on budgets
    python3 scripts/interaction-cost.py --establish-budgets  # write today's costs as the budget
    python3 scripts/interaction-cost.py --only summit_bio --device mobile

Tasks:   uat/interaction-tasks.json   (what a reader comes for, and the path)
Budgets: uat/interaction-budgets.json (max total per device/task; measured + 15%, min +1)
Output:  uat/interaction-costs.json   (last full run with each step; gitignored)

Exits 1 when a task fails, a target cannot be reached, a page errors, the page
overflows sideways, header items overlap (also swept on every page at 300px),
or a cost goes over budget. CI runs this on every PR.
Needs: pip install -r scripts/requirements-uat.txt && playwright install chromium
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent
UAT = ROOT / "uat"
DEVICES = {"mobile": (375, 812), "tablet": (768, 1024), "desktop": (1280, 800)}
log = logging.getLogger("interaction-cost")
SWIPE = 0.75  # one swipe or wheel flick moves this fraction of the visible band
HEADROOM = 0.15  # budgets sit this far above the measured cost

# Runs in the page. Says what stands between the reader and `sel`: a closed
# disclosure to open, or a vertical/horizontal distance to scroll.
MEASURE = r"""
(sel) => {
  const el = document.querySelector(sel);
  if (!el) return {missing: true};
  const closed = [];
  for (let n = el.parentElement; n; n = n.parentElement) {
    if (n.tagName === 'DETAILS' && !n.open && !(el.tagName === 'SUMMARY' && el.parentElement === n)) closed.unshift(n);
  }
  if (closed.length) {
    document.querySelectorAll('[data-ic-closed]').forEach(x => x.removeAttribute('data-ic-closed'));
    closed[0].setAttribute('data-ic-closed', '1');
    return {closed: true, summary: 'details[data-ic-closed="1"] > summary'};
  }
  const scroller = (axis) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const ov = axis === 'y' ? cs.overflowY : cs.overflowX;
      const big = axis === 'y' ? n.scrollHeight > n.clientHeight + 1 : n.scrollWidth > n.clientWidth + 1;
      if (big && (ov === 'auto' || ov === 'scroll')) return n;
    }
    return null;
  };
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return {invisible: true};
  const vh = window.innerHeight;
  // A fixed ancestor (the detail sheet) never moves with the page: only its own
  // scrollers count. A sticky ancestor (header, jump nav) scrolls with the page
  // until it pins, so it is measured like anything else, just without
  // subtracting the pinned band it belongs to.
  let fixed = false, sticky = false;
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const p = getComputedStyle(n).position;
    if (p === 'fixed') fixed = true;
    if (p === 'sticky') sticky = true;
  }
  // Pinned chrome stacked at the top (site header, then any sticky bar right
  // under it) hides that much of the viewport.
  let top = 0;
  if (!sticky && !fixed) {
    const pinned = [...document.querySelectorAll('body *')].filter(s => {
      const p = getComputedStyle(s).position;
      return (p === 'sticky' || p === 'fixed') && s.offsetHeight > 0 && s.offsetHeight < vh * 0.4;
    }).map(s => s.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    for (const sr of pinned) if (sr.top <= top + 1 && sr.bottom > top && sr.width > window.innerWidth * 0.5) top = sr.bottom;
  }
  const ys = scroller('y');
  let lo = top, hi = vh;
  if (ys) { const b = ys.getBoundingClientRect(); lo = Math.max(lo, b.top); hi = Math.min(hi, b.bottom); }
  if (hi - lo < 120) { lo = top; hi = vh; }
  const span = hi - lo;
  const line = Math.min(r.height, 24);
  let dy = 0;
  if (!fixed || ys) {
    if (r.top < lo) dy = r.top - lo - 8;
    else if (r.top + line > hi) dy = r.top - (lo + span * 0.25);
  }
  const xs = scroller('x');
  let dx = 0, wspan = window.innerWidth;
  if (xs) {
    const b = xs.getBoundingClientRect(); wspan = b.width;
    const lead = Math.min(r.width, 40);
    if (r.left < b.left) dx = r.left - b.left - 8;
    else if (r.left + lead > b.right) dx = r.left + lead - b.right + 8;
  }
  return {dy, span, dx, wspan};
}
"""

SCROLL_BY = r"""
(el, d) => {
  let ys = null, xs = null;
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const c = getComputedStyle(n);
    if (!ys && /(auto|scroll)/.test(c.overflowY) && n.scrollHeight > n.clientHeight + 1) ys = n;
    if (!xs && /(auto|scroll)/.test(c.overflowX) && n.scrollWidth > n.clientWidth + 1) xs = n;
  }
  (ys || window).scrollBy(0, d.dy);
  if (xs) xs.scrollBy(d.dx, 0);
}
"""

# A JS-rendered page reports a short height until its fetch-and-render settles;
# wait for two equal reads before measuring anything (CLAUDE.md, Testing).
SETTLE = r"""
async () => {
  let prev = -1, cur = document.documentElement.scrollHeight, n = 0;
  while (prev !== cur && n < 20) { prev = cur; await new Promise(r => setTimeout(r, 150)); cur = document.documentElement.scrollHeight; n++; }
  return cur;
}
"""


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_server(port: int) -> subprocess.Popen:
    proc = subprocess.Popen(["node", "scripts/serve.js", str(port)], cwd=ROOT,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                return proc
        except OSError:
            time.sleep(0.1)
    proc.kill()
    raise RuntimeError("serve.js did not start on port %d" % port)


def settle(page: Any) -> None:
    page.wait_for_load_state("networkidle")
    page.evaluate(SETTLE)


class Mark:
    n = 0


def reveal(page: Any, selector: str, cost: Dict[str, Any]) -> str:
    """Bring `selector` into view the way a reader would; returns a stable selector for it."""
    loc = page.locator(selector).first
    loc.wait_for(state="attached", timeout=10000)
    Mark.n += 1
    loc.evaluate("(el, id) => el.setAttribute('data-ic-target', id)", str(Mark.n))
    sel = '[data-ic-target="%d"]' % Mark.n
    for _ in range(12):
        m = page.evaluate(MEASURE, sel)
        if m.get("missing") or m.get("invisible"):
            raise RuntimeError("target unavailable: " + selector)
        if m.get("closed"):
            summary = page.locator(m["summary"]).first
            reveal(page, m["summary"], cost)
            summary.click()
            cost["taps"] += 1
            cost["path"].append("open disclosure")
            page.wait_for_timeout(60)
            continue
        if abs(m["dy"]) > 1 or abs(m["dx"]) > 1:
            cost["swipes"] += math.ceil(abs(m["dy"]) / (SWIPE * m["span"]))
            cost["hswipes"] += math.ceil(abs(m["dx"]) / (SWIPE * m["wspan"]))
            page.locator(sel).evaluate(SCROLL_BY, {"dy": m["dy"], "dx": m["dx"]})
            page.wait_for_timeout(40)
            continue
        return sel
    raise RuntimeError("could not reveal " + selector)


# Header items that sit on top of each other. The current page's nav link is
# pinned inline, so a long label ("SCSP Summit") at 320px once printed under
# the "Sections" button; the document never overflowed, so nothing else saw it.
OVERLAP = r"""
() => {
  const vis = (e) => e && e.offsetParent !== null && !e.closest('[hidden]');
  const boxes = [...document.querySelectorAll('.site-header-inner > *, .nav-list > li, .primary-more > summary')]
    .filter(vis).map(e => [e, e.getBoundingClientRect()]);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, ra] = boxes[i], [b, rb] = boxes[j];
    if (a.contains(b) || b.contains(a)) continue;
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 2 && h > 2) return (a.textContent.trim() || a.className).slice(0, 30) + ' / ' + (b.textContent.trim() || b.className).slice(0, 30);
  }
  return null;
}
"""
NARROW = (300, 640)  # the narrowest phone in use plus a split-pane preview


def header_sweep(browser: Any, base: str) -> List[str]:
    """Every page at the narrowest phone width: no overlapping header items, no sideways scroll."""
    problems = []
    for page_file in sorted((ROOT / "docs").glob("*.html")):
        ctx = browser.new_context(viewport={"width": NARROW[0], "height": NARROW[1]}, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        page.goto(base + page_file.name)
        settle(page)
        hit = page.evaluate(OVERLAP)
        if hit:
            problems.append("%dpx/%s: header items overlap (%s)" % (NARROW[0], page_file.name, hit))
        if page.evaluate("document.documentElement.scrollWidth > innerWidth + 1"):
            problems.append("%dpx/%s: page overflows sideways" % (NARROW[0], page_file.name))
        ctx.close()
    return problems


def run_task(page: Any, base: str, task: Dict[str, Any]) -> Dict[str, Any]:
    cost: Dict[str, Any] = {"taps": 0, "swipes": 0, "hswipes": 0, "types": 0, "path": []}
    t0 = time.monotonic()
    page.goto(base + task.get("start", "index.html"))
    settle(page)
    cost["load_ms"] = round((time.monotonic() - t0) * 1000)
    for step in task["steps"]:
        action, selector = step[0], step[1]
        if action == "nav":  # a primary-nav link; it may sit in the "Sections" overflow
            selector = '.primary-nav a[href="%s"]' % selector
            action = "tap"
        sel = reveal(page, selector, cost)
        if action == "tap":
            page.locator(sel).click()
            cost["taps"] += 1
            settle(page)
        elif action == "type":
            page.locator(sel).fill(step[2])
            cost["types"] += 1
            page.wait_for_timeout(250)
            settle(page)
        cost["path"].append("%s %s" % (action, selector))
    cost["total"] = cost["taps"] + cost["swipes"] + cost["hswipes"] + cost["types"]
    cost["elapsed_ms"] = round((time.monotonic() - t0) * 1000)
    return cost


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--establish-budgets", action="store_true")
    ap.add_argument("--only", action="append", help="task name (repeatable)")
    ap.add_argument("--device", action="append", choices=list(DEVICES))
    ap.add_argument("--base", help="measure an already-running site instead of starting serve.js")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    from playwright.sync_api import sync_playwright

    tasks: Dict[str, Any] = json.loads((UAT / "interaction-tasks.json").read_text())["tasks"]
    if args.only:
        unknown = sorted(set(args.only) - set(tasks))
        if unknown:  # a typo would otherwise pass as "0 tasks within budget"
            log.error("unknown task(s): %s (see uat/interaction-tasks.json)", ", ".join(unknown))
            return 2
        tasks = {k: v for k, v in tasks.items() if k in args.only}
    devices = {k: v for k, v in DEVICES.items() if not args.device or k in args.device}
    server = None
    base = args.base
    if not base:
        port = free_port()
        server = start_server(port)
        base = "http://127.0.0.1:%d/" % port
    results: Dict[str, Dict[str, Any]] = {}
    failures: List[str] = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            try:
                for dev, (w, h) in devices.items():
                    results[dev] = {}
                    for name, task in tasks.items():
                        ctx = browser.new_context(viewport={"width": w, "height": h},
                                                  is_mobile=dev == "mobile", has_touch=dev != "desktop")
                        page = ctx.new_page()
                        errors: List[str] = []
                        page.on("pageerror", lambda e: errors.append(str(e)))
                        try:
                            cost = run_task(page, base, task)
                            if page.evaluate("document.documentElement.scrollWidth > innerWidth + 1"):
                                failures.append("%s/%s: page overflows sideways" % (dev, name))
                            hit = page.evaluate(OVERLAP)
                            if hit:
                                failures.append("%s/%s: header items overlap (%s)" % (dev, name, hit))
                        except Exception as e:  # report every task, then fail once at the end
                            cost = {"error": str(e).splitlines()[0], "total": None}
                            failures.append("%s/%s: %s" % (dev, name, cost["error"]))
                        if errors:
                            failures.append("%s/%s: page error: %s" % (dev, name, errors[0]))
                        results[dev][name] = cost
                        log.info("%-8s %-26s %s", dev, name, cost["total"] if cost["total"] is not None else "FAIL")
                        ctx.close()
                if not args.only and not args.device:
                    failures += header_sweep(browser, base)
            finally:
                browser.close()
    finally:
        if server:
            server.terminate()

    totals = {d: {k: c["total"] for k, c in t.items()} for d, t in results.items()}
    if not args.only and not args.device:
        out = {"measured_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "swipe_fraction": SWIPE, "devices": results}
        (UAT / "interaction-costs.json").write_text(json.dumps(out, indent=1) + "\n")
    budget_file = UAT / "interaction-budgets.json"
    if args.establish_budgets:
        if failures:
            log.error("not writing budgets:\n  %s", "\n  ".join(failures))
            return 1
        # Headroom: CI's Linux fonts wrap text differently from a Mac, which moves
        # a target by a swipe or two. A real regression costs far more than this.
        budgets = {d: {k: v + max(1, math.ceil(v * HEADROOM)) for k, v in t.items()} for d, t in totals.items()}
        budget_file.write_text(json.dumps(budgets, indent=1) + "\n")
        log.info("wrote %s", budget_file.relative_to(ROOT))
        return 0
    budgets = json.loads(budget_file.read_text()) if budget_file.exists() else {}
    for dev, t in totals.items():
        for name, total in t.items():
            limit = budgets.get(dev, {}).get(name)
            if limit is None:
                failures.append("%s/%s: no budget (run --establish-budgets)" % (dev, name))
            elif total is not None and total > limit:
                failures.append("%s/%s: %d interactions > budget %d" % (dev, name, total, limit))
    if failures:
        log.error("FAILED:\n  %s", "\n  ".join(failures))
        return 1
    log.info("All %d tasks within budget on %d devices.", len(tasks), len(devices))
    return 0


if __name__ == "__main__":
    sys.exit(main())
