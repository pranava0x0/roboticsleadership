#!/usr/bin/env python3
"""Offline tests for refresh_check.py (no network: a fake fetcher serves fixtures)."""
import contextlib
import io
import json
import re
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import refresh_check as rc  # noqa: E402

NOW = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)


def rss(*items):
    body = "".join(
        f"<item><title>{t}</title><link>{u}</link><pubDate>{d}</pubDate><description>{s}</description></item>"
        for t, u, d, s in items)
    return f"<rss version='2.0'><channel>{body}</channel></rss>".encode()


def story(title="Acme raises $10M for robot arms", url="https://example.com/acme", day="Tue, 20 Oct 2026 10:00:00 GMT", summ=""):
    return (title, url, day, summ)


class FakeWeb:
    """Serves RSS for every feed URL, HN/FR JSON, and can fail chosen hosts."""

    def __init__(self, feed_items=None, hn_hits=None, fr_results=None, fail=()):
        self.feed_items = feed_items if feed_items is not None else {}
        self.hn_hits = hn_hits or []
        self.fr_results = fr_results or []
        self.fail = set(fail)
        self.calls = []

    def __call__(self, url):
        self.calls.append(url)
        for f in self.fail:
            if f in url:
                raise RuntimeError("HTTP 403")
        if "hn.algolia.com" in url:
            return json.dumps({"hits": self.hn_hits}).encode()
        if "federalregister.gov" in url:
            return json.dumps({"results": self.fr_results}).encode()
        for key, items in self.feed_items.items():
            if key in url:
                return rss(*items)
        return rss()  # feed with no items


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "docs" / "data").mkdir(parents=True)
        (self.root / "data" / "research").mkdir(parents=True)
        self.state_path = self.root / "state.json"
        self.write_data(news=[])

    def write_data(self, news):
        for name, val in (("news.json", news), ("policies.json", []), ("companies.json", [])):
            (self.root / "docs" / "data" / name).write_text(json.dumps(val))

    def run_main(self, web, *extra, now=NOW):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            code = rc.main(["--state", str(self.state_path), "--root", str(self.root), *extra], fetch=web, now=now)
        return code, out.getvalue()

    def mark_x_checked(self):
        state = rc.load_state(self.state_path)
        state["x_checked"] = "2026-10-20"
        rc.save_state(self.state_path, state)


class TestChangeDetection(Base):
    def test_no_changes_exits_0_and_counts_sources(self):
        self.mark_x_checked()
        code, out = self.run_main(FakeWeb())
        self.assertEqual(code, 0)
        n = len(rc.configured_feeds()) + 2
        self.assertEqual(out.strip(), f"no changes ({n}/{n} sources read; X list not due)")

    def test_new_item_is_reported_then_acked_away(self):
        self.mark_x_checked()
        web = FakeWeb(feed_items={"therobotreport": [story()]})
        code, out = self.run_main(web)
        self.assertEqual(code, 1)
        self.assertIn("1 new", out)
        self.assertIn("https://example.com/acme", out)
        # not acked yet: a second check reports it again (a failed model run loses nothing)
        self.assertEqual(self.run_main(web)[0], 1)
        self.assertIn("acked 1 items", self.run_main(web, "--ack")[1])
        code, out = self.run_main(web)
        self.assertEqual(code, 0, out)

    def test_already_tracked_in_news_json_or_dropped_log_is_skipped(self):
        self.mark_x_checked()
        self.write_data(news=[{"source_url": "https://www.example.com/acme/?utm_source=x"}])
        (self.root / "data" / "research" / "refresh-2026-10-20-dropped.json").write_text(
            json.dumps([{"source_url": "https://example.com/dropped"}]))
        web = FakeWeb(feed_items={"therobotreport": [story(), story(url="https://example.com/dropped")]})
        self.assertEqual(self.run_main(web)[0], 0)

    def test_dropped_logs_of_any_shape_are_read(self):
        self.mark_x_checked()
        (self.root / "data" / "research" / "refresh-2026-10-18-dropped.json").write_text(
            json.dumps({"run": "x", "kept": [], "dropped": [{"source_url": "https://example.com/acme"}]}))
        (self.root / "data" / "research" / "refresh-2026-10-15-dropped.json").write_text(
            json.dumps({"candidates": [{"url": "https://example.com/other"}]}))
        web = FakeWeb(feed_items={"therobotreport": [story(), story(url="https://example.com/other")]})
        self.assertEqual(self.run_main(web)[0], 0)

    def test_same_story_in_two_feeds_listed_once(self):
        self.mark_x_checked()
        web = FakeWeb(feed_items={"therobotreport": [story()], "techcrunch": [story()]})
        _, out = self.run_main(web)
        self.assertEqual(out.count("https://example.com/acme"), 1)

    def test_broad_feeds_are_keyword_filtered_and_hn_noise_dropped(self):
        self.mark_x_checked()
        web = FakeWeb(
            feed_items={"technode": [story("Chip maker posts earnings", "https://e.com/chip"),
                                     story("Unitree files for IPO", "https://e.com/humanoid", summ="humanoid maker")]},
            hn_hits=[{"title": "Human resources software", "url": "https://e.com/hr", "created_at": "2026-10-20T10:00:00Z"},
                     {"title": "Open-source humanoid robot", "url": "https://e.com/hn", "created_at": "2026-10-20T10:00:00Z"},
                     {"title": "Ask HN: robot vacuum?", "url": None, "created_at": "2026-10-20T10:00:00Z"}])
        _, out = self.run_main(web)
        self.assertIn("https://e.com/humanoid", out)
        self.assertIn("https://e.com/hn", out)
        for noise in ("e.com/chip", "e.com/hr"):
            self.assertNotIn(noise, out)
        self.assertEqual(out.splitlines()[0].split(" new")[0], "2")

    def test_cold_start_window_is_short_then_stays_short_after_ack(self):
        self.mark_x_checked()
        old = story(url="https://e.com/old", day="Fri, 16 Oct 2026 10:00:00 GMT")  # 5 days old
        web = FakeWeb(feed_items={"therobotreport": [old, story()]})
        code, out = self.run_main(web)
        self.assertEqual(code, 1)
        self.assertNotIn("e.com/old", out)
        self.run_main(web, "--ack")
        code, out = self.run_main(web)  # the 5-day-old story must not surface now
        self.assertEqual(code, 0, out)

    def test_window_widens_after_a_gap_so_missed_days_are_caught(self):
        self.mark_x_checked()
        web = FakeWeb(feed_items={"therobotreport": [story(url="https://e.com/old", day="Fri, 16 Oct 2026 10:00:00 GMT")]})
        state = rc.load_state(self.state_path)
        state["last_ack"] = "2026-10-14T12:00:00+00:00"  # last processed 7 days ago
        rc.save_state(self.state_path, state)
        self.assertIn("e.com/old", self.run_main(web)[1])

    def test_probably_tracked_hint_names_the_news_record(self):
        self.mark_x_checked()
        self.write_data(news=[{"id": "2026-10-20-eka", "date": "2026-10-20", "title": "Eka Robotics raises $150M Series A for Force Sensing",
                               "source_url": "https://example.com/primary"}])
        web = FakeWeb(feed_items={"humanoidsdaily": [story("Eka Robotics Raises $150 Million for Force Sensing", "https://h.com/eka")]})
        _, out = self.run_main(web)
        self.assertIn("maybe dup of 2026-10-20-eka", out)

    def test_cap_per_source_and_capped_items_are_not_acked(self):
        self.mark_x_checked()
        many = [story(url=f"https://e.com/{i}", title=f"Robot story {i}", day=f"Tue, 20 Oct 2026 {10 + i % 10}:00:00 GMT")
                for i in range(rc.MAX_PER_SOURCE + 5)]
        web = FakeWeb(feed_items={"therobotreport": many})
        _, out = self.run_main(web)
        self.assertIn("+5 older not shown", out)
        self.assertEqual(out.count("[the-robot-report]") - 1, rc.MAX_PER_SOURCE)
        self.assertIn(f"acked {rc.MAX_PER_SOURCE} items", self.run_main(web, "--ack")[1])
        _, out = self.run_main(web)  # the 5 hidden ones surface now
        self.assertIn("5 new", out)
        self.assertEqual(out.count("[the-robot-report]"), 5)

    def test_held_items_survive_a_busier_next_day_and_the_short_window(self):
        self.mark_x_checked()
        n = rc.MAX_PER_SOURCE
        day1 = [story(url=f"https://e.com/a{i}", title=f"Robot a{i}") for i in range(n + 3)]
        self.run_main(FakeWeb(feed_items={"therobotreport": day1}))
        self.run_main(FakeWeb(), "--ack")  # 3 held
        later = datetime(2026, 10, 25, 12, 0, tzinfo=timezone.utc)  # past the 2-day window for day-1 dates
        day2 = [story(url=f"https://e.com/b{i}", title=f"Robot b{i}", day="Sat, 24 Oct 2026 10:00:00 GMT") for i in range(n + 3)]
        _, out = self.run_main(FakeWeb(feed_items={"therobotreport": day2}), now=later)
        self.assertEqual(sum(1 for i in range(n + 3) if f"https://e.com/a{i}" in re.split(r"[\s|]+", out)), 3)  # held first, not starved
        self.run_main(FakeWeb(feed_items={"therobotreport": day2}), "--ack", now=later)
        state = rc.load_state(self.state_path)
        self.assertTrue(all(u.startswith("https://e.com/") for u in state["held"]))
        self.assertFalse(any(f"e.com/a{i}" in state["held"] for i in range(n + 3)))

    def test_held_items_expire(self):
        self.mark_x_checked()
        state = rc.load_state(self.state_path)
        state["held"] = {"https://e.com/stale": ["the-robot-report", "Robot stale", "2026-09-01", "2026-09-01"]}
        rc.save_state(self.state_path, state)
        self.assertEqual(self.run_main(FakeWeb())[0], 0)
        self.assertEqual(rc.load_state(self.state_path)["held"], {})

class TestUnreadHandling(Base):
    def test_fetch_failure_is_unread_never_no_changes(self):
        self.mark_x_checked()
        code, out = self.run_main(FakeWeb(fail=["therobotreport"]))
        self.assertEqual(code, 2)
        self.assertIn("UNREAD the-robot-report: HTTP 403", out)
        self.assertNotIn("no changes", out)
        n = len(rc.configured_feeds()) + 2
        self.assertIn(f"{n - 1}/{n} sources read", out)

    def test_garbage_body_is_unread(self):
        self.mark_x_checked()
        web = FakeWeb()

        def fetch(url):
            return b"<html>Just a moment...</html>" if "ieee" in url else web(url)
        code, out = self.run_main(fetch)
        self.assertEqual(code, 2)
        self.assertIn("UNREAD ieee-spectrum-robotics", out)

    def test_hn_failure_on_one_query_marks_the_source_unread(self):
        self.mark_x_checked()
        code, out = self.run_main(FakeWeb(fail=["hn.algolia.com"]))
        self.assertEqual(code, 2)
        self.assertIn("UNREAD hacker-news", out)

    def test_new_items_still_reported_alongside_unread(self):
        self.mark_x_checked()
        code, out = self.run_main(FakeWeb(feed_items={"techcrunch": [story()]}, fail=["therobotreport"]))
        self.assertEqual(code, 1)
        self.assertIn("UNREAD the-robot-report", out)
        self.assertIn("example.com/acme", out)

    def test_source_broken_for_three_runs_escalates(self):
        self.mark_x_checked()
        web = FakeWeb(fail=["therobotreport"])
        codes = [self.run_main(web)[0] for _ in range(rc.BROKEN_AFTER_RUNS)]
        self.assertEqual(codes, [2, 2, 1])
        self.assertIn("BROKEN the-robot-report", self.run_main(web)[1])

    def test_recovery_resets_streak(self):
        self.mark_x_checked()
        self.run_main(FakeWeb(fail=["therobotreport"]))
        self.run_main(FakeWeb())
        self.assertEqual(rc.load_state(self.state_path)["unread_streak"], {})


class TestXList(Base):
    def test_never_checked_x_forces_a_run(self):
        code, out = self.run_main(FakeWeb())
        self.assertEqual(code, 1)
        self.assertIn("X-LIST due (never checked)", out)

    def test_ack_with_x_checked_clears_it_until_due_again(self):
        self.run_main(FakeWeb())
        self.run_main(FakeWeb(), "--ack", "--x-checked")
        self.assertEqual(self.run_main(FakeWeb())[0], 0)
        later = datetime(2026, 10, 28, 12, 0, tzinfo=timezone.utc)
        code, out = self.run_main(FakeWeb(), now=later)
        self.assertEqual(code, 1)
        self.assertIn("last checked 7 days ago", out)


class TestHelpers(unittest.TestCase):
    def test_canon_url(self):
        self.assertEqual(rc.canon_url("HTTPS://www.Example.com/a/?utm_source=x&id=3#frag"), "https://example.com/a?id=3")

    def test_atom_feed(self):
        atom = (b"<feed xmlns='http://www.w3.org/2005/Atom'><entry><title>Robot</title>"
                b"<link href='https://e.com/1'/><published>2026-10-20T00:00:00Z</published></entry></feed>")
        (item, _), = rc.parse_feed("x", atom)
        self.assertEqual((item.url, item.date), ("https://e.com/1", "2026-10-20"))

    def test_bare_ampersand_feed_is_repaired(self):
        body = b"<rss version='2.0'><channel><item><title>Robot</title><link>https://e.com/1</link><category>FM&M</category></item></channel></rss>"
        self.assertEqual(len(rc.parse_feed("x", body)), 1)

    def test_federal_register_zero_hits_has_no_results_key(self):
        def fetch(url):
            return b'{"description":"x","count":0}'
        res = rc.read_federal_register(fetch, NOW, 3)
        self.assertEqual((res.items, res.error), ([], None))

    def test_empty_rss_is_valid_not_an_error(self):
        self.assertEqual(rc.parse_feed("x", b"<rss version='2.0'><channel/></rss>"), [])

    def test_script_error_exits_3(self):
        with tempfile.TemporaryDirectory() as d:
            bad = Path(d) / "state.json"
            bad.write_text("{not json")
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(rc.main(["--state", str(bad)], fetch=FakeWeb(), now=NOW), 3)


if __name__ == "__main__":
    unittest.main()
