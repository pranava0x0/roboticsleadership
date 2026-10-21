#!/usr/bin/env python3
"""Deterministic change detection for the scheduled robotics refresh.

Fetches every source the refresh watches (RSS/Atom feeds, Hacker News, Federal
Register), drops anything already tracked or already shown, and prints a compact
list of what is new. The model reads only that list. Stdlib only.

Exit codes
  0  no changes: every source was read and nothing is new
  1  something to do: new items, a source broken for several runs, or the
     X list is due (the script cannot read X; see X_EVERY_DAYS)
  2  nothing new in the sources that were read, but some sources were NOT read.
     This is "unverified", never "no changes".
  3  the script itself failed

State lives outside the repo (default ~/.claude/scheduled-tasks/robotics-refresh/
refresh-state.json) so it survives worktrees and unmerged PRs. A check never marks
items as seen; `--ack` does, after the model has processed them, so a failed run
re-reports the same items next time.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Set, Tuple

log = logging.getLogger("refresh_check")

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "docs" / "data"
DROPPED_GLOB = "data/research/refresh-*-dropped.json"
DEFAULT_STATE = Path.home() / ".claude" / "scheduled-tasks" / "robotics-refresh" / "refresh-state.json"

USER_AGENT = "robotics-tracker/1.0 refresh-check (+https://github.com/pranava0x0/roboticsleadership)"
TIMEOUT_S = 20
RETRIES = 2
HOST_GAP_S = 1.5  # minimum gap between requests to one host
MIN_AGE_DAYS = 2  # window floor; also the whole window on a cold start (no backlog flood)
MAX_AGE_DAYS = 14  # window ceiling after a long gap
SEEN_KEEP_DAYS = 60
X_EVERY_DAYS = 7  # the X list needs a browser; force a model run this often
BROKEN_AFTER_RUNS = 3  # unread this many runs in a row -> hand to the model once
MAX_PER_SOURCE = 12
TITLE_CHARS = 100

# Feeds beyond sources.json's enabled RSS entries. filtered=True: broad feed, keep
# only items whose title/summary match ROBOT_RE.
EXTRA_FEEDS = [
    {"id": "humanoids-daily", "url": "https://www.humanoidsdaily.com/feed.xml", "publication": "Humanoids Daily", "filtered": False},
    {"id": "technode", "url": "https://technode.com/feed/", "publication": "TechNode", "filtered": True},
    {"id": "producthunt-robots", "url": "https://www.producthunt.com/feed?category=robots", "publication": "Product Hunt", "filtered": True},
]
HN_QUERIES = ["robot", "robotics", "humanoid"]  # same terms the news scraper uses
FR_QUERIES = [("federal-register", "robotics"), ("federal-register", "robot")]

# The HN scraper over-matches on `human*`; this is the check the curator applies by hand.
ROBOT_RE = re.compile(r"\b(robot\w*|humanoid\w*|embodied|physical ai|exoskeleton\w*|cobot\w*)\b", re.I)
HEADLINE_WORDS = frozenset("this that with from have over into about after before their there which while where "
                           "robot robots robotics humanoid humanoids raises raise million billion series".split())
BARE_AMP = re.compile(rb"&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#[0-9]+|#x[0-9a-fA-F]+);)")
TRACKING_PARAMS = re.compile(r"^(utm_|fbclid$|gclid$|ref$|ref_src$)", re.I)

Fetcher = Callable[[str], bytes]


@dataclass(frozen=True)
class Item:
    source: str
    url: str  # canonical
    title: str
    date: str  # YYYY-MM-DD, "" if unknown


@dataclass
class SourceResult:
    id: str
    items: List[Item]
    error: Optional[str] = None  # set => unread


def canon_url(url: str) -> str:
    """Normalize so the same story under utm/www/trailing-slash variants dedupes."""
    p = urllib.parse.urlsplit(url.strip())
    host = p.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    q = [(k, v) for k, v in urllib.parse.parse_qsl(p.query) if not TRACKING_PARAMS.match(k)]
    path = p.path.rstrip("/") or ""
    return urllib.parse.urlunsplit((p.scheme.lower(), host, path, urllib.parse.urlencode(q), ""))


class HttpFetcher:
    """urllib fetch with retry, backoff, and a per-host gap (network ethics)."""

    def __init__(self) -> None:
        self._last: Dict[str, float] = {}

    def __call__(self, url: str) -> bytes:
        host = urllib.parse.urlsplit(url).netloc
        last_err: Optional[Exception] = None
        for attempt in range(RETRIES + 1):
            wait = HOST_GAP_S - (time.monotonic() - self._last.get(host, -1e9))
            if wait > 0:
                time.sleep(wait)
            self._last[host] = time.monotonic()
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "identity"})
            try:
                with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
                    return r.read()
            except urllib.error.HTTPError as e:
                last_err = e
                if e.code == 429:
                    time.sleep(10 * (2 ** attempt))
                elif e.code < 500:
                    break  # 4xx other than 429 will not fix itself
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last_err = e
            time.sleep(2 * (attempt + 1))
        raise RuntimeError(describe_error(last_err))


def describe_error(e: Optional[Exception]) -> str:
    if isinstance(e, urllib.error.HTTPError):
        return f"HTTP {e.code}"
    return f"{type(e).__name__}: {e}" if e else "unknown error"


def to_date(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        return ""
    try:
        return parsedate_to_datetime(raw).astimezone(timezone.utc).date().isoformat()
    except (TypeError, ValueError):
        pass
    m = re.match(r"(\d{4}-\d{2}-\d{2})", raw)
    return m.group(1) if m else ""


def _text(el: Optional[ET.Element]) -> str:
    return (el.text or "").strip() if el is not None else ""


def parse_feed(source: str, body: bytes) -> List[Tuple[Item, str]]:
    """RSS 2.0 or Atom -> [(Item, summary)]. Raises ValueError on a body that is not a feed."""
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        try:  # humanoidsdaily ships bare '&' ("FM&M"); escape those and retry once
            root = ET.fromstring(BARE_AMP.sub(b"&amp;", body))
        except ET.ParseError as e:
            raise ValueError(f"not parseable XML ({e})")
    out: List[Tuple[Item, str]] = []
    for it in root.iter("item"):
        link = _text(it.find("link")) or _text(it.find("guid"))
        out.append((Item(source, canon_url(link), _clean(_text(it.find("title"))), to_date(_text(it.find("pubDate")))),
                    _clean(_text(it.find("description")))))
    for ent in root.iter("{http://www.w3.org/2005/Atom}entry"):
        ns = "{http://www.w3.org/2005/Atom}"
        link_el = ent.find(ns + "link")
        link = link_el.get("href", "") if link_el is not None else ""
        out.append((Item(source, canon_url(link), _clean(_text(ent.find(ns + "title"))),
                         to_date(_text(ent.find(ns + "published")) or _text(ent.find(ns + "updated")))),
                    _clean(_text(ent.find(ns + "summary")) or _text(ent.find(ns + "content")))))
    if not out and root.tag not in ("rss", "{http://www.w3.org/2005/Atom}feed"):
        raise ValueError(f"unexpected root <{root.tag}>")
    return [(i, s) for i, s in out if i.url]


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", s)).strip()


def read_feed(src: dict, fetch: Fetcher) -> SourceResult:
    try:
        parsed = parse_feed(src["id"], fetch(src["url"]))
    except (RuntimeError, ValueError) as e:
        return SourceResult(src["id"], [], str(e))
    items = [i for i, summ in parsed if not src.get("filtered") or ROBOT_RE.search(f"{i.title} {summ}")]
    return SourceResult(src["id"], items)


def read_hn(fetch: Fetcher, now: datetime, days: int) -> SourceResult:
    cutoff = int((now - timedelta(days=days)).timestamp())
    items: List[Item] = []
    for q in HN_QUERIES:
        url = ("https://hn.algolia.com/api/v1/search_by_date?query=%s&tags=story"
               "&numericFilters=created_at_i%%3E%d&hitsPerPage=30" % (urllib.parse.quote(q), cutoff))
        try:
            hits = json.loads(fetch(url))["hits"]
        except (RuntimeError, ValueError, KeyError) as e:
            return SourceResult("hacker-news", [], f"query '{q}': {e}")
        for h in hits:
            title = h.get("title") or ""
            if h.get("url") and ROBOT_RE.search(title):  # no-URL items are Ask/Show HN text posts
                items.append(Item("hacker-news", canon_url(h["url"]), title, to_date(h.get("created_at", ""))))
    return SourceResult("hacker-news", items)


def read_federal_register(fetch: Fetcher, now: datetime, days: int) -> SourceResult:
    since = (now - timedelta(days=days)).date().isoformat()
    items: List[Item] = []
    for _, term in FR_QUERIES:
        url = ("https://www.federalregister.gov/api/v1/documents.json?conditions[term]=%s"
               "&conditions[publication_date][gte]=%s&order=newest&per_page=20" % (term, since))
        try:
            doc = json.loads(fetch(url))
            results = doc["results"] if doc.get("count") else []  # zero hits => no "results" key
        except (RuntimeError, ValueError, KeyError) as e:
            return SourceResult("federal-register", [], f"term '{term}': {e}")
        for d in results:
            if d.get("html_url"):
                items.append(Item("federal-register", canon_url(d["html_url"]),
                                  f"[{d.get('type', '?')}] {d.get('title', '')}", to_date(d.get("publication_date", ""))))
    return SourceResult("federal-register", items)


def configured_feeds() -> List[dict]:
    """sources.json's enabled RSS (single source of truth with the scrapers) + EXTRA_FEEDS."""
    cfg = json.loads((DATA_DIR / "sources.json").read_text())
    feeds = [{"id": s["id"], "url": s["url"], "filtered": False}
             for s in cfg["news"] if s.get("type") == "rss" and s.get("enabled")]
    return feeds + EXTRA_FEEDS


def tracked_urls(root: Path) -> Set[str]:
    """URLs already in the site's data or already triaged (kept or dropped) in earlier runs."""
    urls: Set[str] = set()

    def add(u: object) -> None:
        if isinstance(u, str) and u.startswith("http"):
            urls.add(canon_url(u))

    for name in ("news.json", "policies.json", "companies.json"):
        path = root / "docs" / "data" / name
        if not path.exists():
            continue
        for rec in json.loads(path.read_text()):
            add(rec.get("source_url"))
            for s in rec.get("sources") or []:
                add(s.get("url") if isinstance(s, dict) else s)
    for path in sorted(root.glob(DROPPED_GLOB)):
        try:
            walk_strings(json.loads(path.read_text()), add)
        except ValueError:
            log.warning("unreadable dropped log %s", path)
    return urls


def walk_strings(node: object, visit: Callable[[str], None]) -> None:
    """Dropped logs changed shape run to run (list, {dropped:[..]}, {candidates:[..]}); take every string."""
    if isinstance(node, str):
        visit(node)
    elif isinstance(node, dict):
        for v in node.values():
            walk_strings(v, visit)
    elif isinstance(node, list):
        for v in node:
            walk_strings(v, visit)


def name_tokens(text: str) -> Set[str]:
    """Capitalised words (company/product names) of 3+ letters, minus common headline words."""
    return {w.lower() for w in re.findall(r"\b[A-Z][A-Za-z0-9]{2,}\b", text)} - HEADLINE_WORDS


def recent_news_index(root: Path, now: datetime) -> List[Tuple[str, Set[str]]]:
    """(id, name tokens) of news.json records from the last 21 days, for 'probably tracked' hints."""
    path = root / "docs" / "data" / "news.json"
    if not path.exists():
        return []
    since = (now - timedelta(days=21)).date().isoformat()
    return [(r["id"], name_tokens(r.get("title", ""))) for r in json.loads(path.read_text())
            if r.get("date", "") >= since and r.get("id")]


def tracked_hint(item: Item, index: List[Tuple[str, Set[str]]]) -> Optional[str]:
    """A recent record sharing 2+ name tokens probably covers the same story. A hint, never a filter."""
    toks = name_tokens(item.title)
    for rid, rtoks in index:
        if len(toks & rtoks) >= 2:
            return rid
    return None


# ---- state -------------------------------------------------------------------------

def load_state(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text())
    return {"version": 1, "seen": {}, "pending": [], "unread_streak": {}, "x_checked": None,
            "last_checked": None, "last_ack": None}


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=1, sort_keys=True))
    tmp.replace(path)


# ---- the check -----------------------------------------------------------------------

@dataclass
class Report:
    checked: int
    total: int
    new: List[Item]
    unread: List[Tuple[str, str]]
    broken: List[Tuple[str, int, str]]
    x_due: Optional[str]
    exit_code: int
    hints: Optional[Dict[str, str]] = None  # item url -> news.json id it probably duplicates


def window_days(state: dict, now: datetime, override: Optional[int]) -> int:
    """Look back to the last processed run (+2 days slack); 2 days on a cold start."""
    if override:
        return override
    anchor = state.get("last_ack") or state.get("last_checked")
    if not anchor:
        return MIN_AGE_DAYS
    gap = (now - datetime.fromisoformat(anchor)).days
    return max(MIN_AGE_DAYS, min(MAX_AGE_DAYS, gap + 2))


def run_check(state: dict, fetch: Fetcher, tracked: Set[str], now: datetime, days: Optional[int] = None,
              x_every: int = X_EVERY_DAYS, index: Optional[List[Tuple[str, Set[str]]]] = None) -> Report:
    age = window_days(state, now, days)
    results = [read_feed(f, fetch) for f in configured_feeds()]
    results.append(read_hn(fetch, now, age))
    results.append(read_federal_register(fetch, now, max(age, 3)))

    oldest = (now - timedelta(days=age)).date().isoformat()
    seen = state["seen"]
    new: List[Item] = []
    keys: Set[str] = set()
    for r in results:
        for it in r.items:
            if it.url in tracked or it.url in seen or it.url in keys:
                continue
            if it.date and it.date < oldest:
                continue
            keys.add(it.url)
            new.append(it)
    new.sort(key=lambda i: (i.date, i.source), reverse=True)

    streak = state.setdefault("unread_streak", {})
    unread = [(r.id, r.error) for r in results if r.error]
    for r in results:
        if r.error:
            streak[r.id] = streak.get(r.id, 0) + 1
        else:
            streak.pop(r.id, None)
    broken = [(sid, streak[sid], err) for sid, err in unread if streak[sid] >= BROKEN_AFTER_RUNS]

    x_due = None
    last_x = state.get("x_checked")
    if not last_x:
        x_due = "never checked"
    else:
        age_d = (now.date() - datetime.fromisoformat(last_x).date()).days
        if age_d >= x_every:
            x_due = f"last checked {age_d} days ago"

    state["pending"] = [i.url for i in new]
    state["last_checked"] = now.isoformat(timespec="seconds")

    if new or broken or x_due:
        code = 1
    elif unread:
        code = 2
    else:
        code = 0
    hints = {i.url: h for i in new if (h := tracked_hint(i, index or []))}
    return Report(len(results) - len(unread), len(results), new, unread, broken, x_due, code, hints)


def render(rep: Report) -> str:
    out: List[str] = []
    n = f"{rep.checked}/{rep.total} sources read"
    if rep.exit_code == 0:
        return f"no changes ({n}; X list not due)"
    if not rep.new and not rep.broken and not rep.x_due:
        out.append(f"nothing new in the {rep.checked} sources read, but {len(rep.unread)} NOT read -- UNVERIFIED ({n})")
    else:
        out.append(f"{len(rep.new)} new, {n}")
    per: Dict[str, int] = {}
    for it in rep.new:
        per[it.source] = per.get(it.source, 0) + 1
        if per[it.source] > MAX_PER_SOURCE:
            continue
        t = it.title if len(it.title) <= TITLE_CHARS else it.title[:TITLE_CHARS - 1] + "…"
        hint = f" | maybe dup of {rep.hints[it.url]}" if rep.hints and it.url in rep.hints else ""
        out.append(f"[{it.source}] {it.date or '????-??-??'} | {t} | {it.url}{hint}")
    for src, count in per.items():
        if count > MAX_PER_SOURCE:
            out.append(f"[{src}] +{count - MAX_PER_SOURCE} older not shown (cap {MAX_PER_SOURCE}/source)")
    for sid, err in rep.unread:
        out.append(f"UNREAD {sid}: {err}")
    for sid, runs, err in rep.broken:
        out.append(f"BROKEN {sid}: unread {runs} runs in a row ({err}); investigate once, then fix or disable")
    if rep.x_due:
        out.append(f"X-LIST due ({rep.x_due}); script cannot read it -- run the browser step")
    return "\n".join(out)


def ack(state: dict, now: datetime, x_checked: bool) -> int:
    today = now.date().isoformat()
    n = len(state.get("pending", []))
    for u in state.get("pending", []):
        state["seen"].setdefault(u, today)
    state["pending"] = []
    state["last_ack"] = now.isoformat(timespec="seconds")
    if x_checked:
        state["x_checked"] = today
    keep = (now - timedelta(days=SEEN_KEEP_DAYS)).date().isoformat()
    state["seen"] = {u: d for u, d in state["seen"].items() if d >= keep}
    return n


def main(argv: Optional[Iterable[str]] = None, fetch: Optional[Fetcher] = None,
         now: Optional[datetime] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--state", type=Path, default=Path(os.environ.get("ROBOTICS_REFRESH_STATE", DEFAULT_STATE)))
    ap.add_argument("--ack", action="store_true", help="mark the last check's items as seen (run after the model processed them)")
    ap.add_argument("--x-checked", action="store_true", help="with --ack: the X list was harvested this run")
    ap.add_argument("--days", type=int, default=None, help="fixed look-back window (default: since the last run)")
    ap.add_argument("--x-every-days", type=int, default=X_EVERY_DAYS)
    ap.add_argument("--root", type=Path, default=ROOT)
    args = ap.parse_args(list(argv) if argv is not None else None)
    logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stderr)
    now = now or datetime.now(timezone.utc)

    try:
        state = load_state(args.state)
        if args.ack:
            n = ack(state, now, args.x_checked)
            save_state(args.state, state)
            print(f"acked {n} items" + ("; X list marked checked" if args.x_checked else ""))
            return 0
        rep = run_check(state, fetch or HttpFetcher(), tracked_urls(args.root), now, args.days, args.x_every_days,
                        recent_news_index(args.root, now))
        save_state(args.state, state)
        print(render(rep))
        return rep.exit_code
    except Exception:
        log.exception("refresh_check failed")
        return 3


if __name__ == "__main__":
    sys.exit(main())
