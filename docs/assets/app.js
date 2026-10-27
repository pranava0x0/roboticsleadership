/* ============================================================
   app.js — shared utilities for the Robotics Tracker static site
   No framework. ES modules where supported; plain script otherwise.
   ============================================================ */

(function (global) {
  'use strict';

  // ---------- Data fetching with in-memory cache ----------
  // Caches the in-flight promise, not just the resolved value — two callers
  // racing for the same dataset (e.g. loadAll() + loadHeaderUpdated() both
  // wanting sources.json) must collapse to a single fetch, not one each.
  const cache = {};
  function loadData(name) {
    if (cache[name]) return cache[name];
    const url = `data/${name}.json`;
    const promise = fetch(url, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.json();
      })
      .catch((err) => {
        console.error(`Failed to load ${url}:`, err);
        delete cache[name]; // let a later call retry instead of re-throwing forever
        throw err;
      });
    cache[name] = promise;
    return promise;
  }

  // The four core record datasets. sources.json and agencies.json were fetched
  // here too, but neither caller ever destructured them. agencies.json (11KB)
  // is now only fetched by policies.html, the one page that renders it.
  // sources.json is still loaded — loadHeaderUpdated needs its _meta
  // .last_updated for the header date — but dropping it here means one fetch
  // per page instead of two: loadData caches the resolved value rather than the
  // in-flight promise, so two concurrent callers both miss and both fetch.
  // Anything needing these should call loadData directly rather than widen this.
  async function loadAll() {
    const [companies, policies, news, themes] = await Promise.all([
      loadData('companies'),
      loadData('policies'),
      loadData('news'),
      loadData('themes'),
    ]);
    return { companies, policies, news, themes };
  }

  function formatUSD(n, opts = {}) {
    if (n == null || n === '') return opts.fallback ?? '—';
    const str = String(n).trim();
    const num = Number(str.replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) {
      return str;
    }
    const prefixMatch = str.match(/^([<>=≥≤$]+)/);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    const suffixMatch = str.match(/([%+\s]+)$/);
    const suffix = suffixMatch ? suffixMatch[1] : '';
    const abs = Math.abs(num);
    let formattedNum;
    if (abs >= 1e9) formattedNum = `${(num / 1e9).toFixed(num % 1e9 === 0 ? 0 : 1)}B`;
    else if (abs >= 1e6) formattedNum = `${(num / 1e6).toFixed(num % 1e6 === 0 ? 0 : 1)}M`;
    else if (abs >= 1e3) formattedNum = `${(num / 1e3).toFixed(0)}K`;
    else formattedNum = num.toLocaleString('en-US');
    const hasDollar = prefix.includes('$') || str.includes('$');
    const dollarSign = hasDollar ? '' : '$';
    const cleanPrefix = prefix.replace(/\$/g, '');
    return `${cleanPrefix}${dollarSign}${formattedNum}${suffix}`;
  }

  function formatNumber(n, opts = {}) {
    if (n == null || n === '') return opts.fallback ?? '—';
    const num = Number(n);
    if (isNaN(num)) {
      return String(n);
    }
    return num.toLocaleString('en-US');
  }

  function formatDate(s, opts = {}) {
    if (!s) return opts.fallback ?? '—';
    // Accept YYYY, YYYY-MM, YYYY-MM-DD; render appropriately
    const parts = String(s).split('-');
    if (parts.length === 1) return parts[0];
    const [y, m, d] = parts;
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mm = monthNames[parseInt(m, 10) - 1] ?? m;
    if (parts.length === 2) return `${mm} ${y}`;
    return `${mm} ${parseInt(d, 10)}, ${y}`;
  }

  function relativeDate(s) {
    if (!s) return '';
    const parts = String(s).split('-');
    const y = parseInt(parts[0], 10);
    const m = parts[1] ? parseInt(parts[1], 10) - 1 : 0;
    const d = parts[2] ? parseInt(parts[2], 10) : 1;
    const then = new Date(y, m, d);
    const now = new Date();
    const ms = now - then;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (Number.isNaN(days)) return '';
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} mo ago`;
    const years = Math.floor(days / 365);
    return `${years} yr ago`;
  }

  // ---------- Pretty names / fallbacks ----------
  function prettyHQ(hq) {
    if (!hq) return '—';
    const parts = [];
    if (hq.city) parts.push(hq.city);
    if (hq.state && hq.state !== 'N/A') parts.push(hq.state);
    if (hq.country && hq.country !== 'USA') parts.push(hq.country);
    return parts.join(', ') || '—';
  }

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Safe class-name slug. Lowercases and strips everything except [a-z0-9-]
  // so untrusted/scraped strings (category, direction, …) can never break out
  // of a class="…" attribute. Replaces the old `.replace(/\s+/g,'')` pattern,
  // which left quotes/angle-brackets intact → stored-XSS sink.
  function slug(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9-]+/g, '');
  }

  // Only allow http(s) or site-relative/anchor URLs as hrefs built from data.
  // escapeHTML alone stops attribute breakout but NOT a `javascript:`/`data:`
  // scheme in a scraped source_url — this rejects those to '#'. Defense in
  // depth: our committed JSON is trusted, but a bad scrape shouldn't ship a
  // clickable script link. Pair with escapeHTML at the sink.
  function safeURL(u) {
    if (u == null) return '#';
    const s = String(u).trim();
    if (/^https?:\/\//i.test(s)) return s;   // absolute http(s)
    if (/^(\/|\.\/|#)/.test(s)) return s;    // site-relative or in-page anchor
    return '#';                              // reject javascript:, data:, vbscript:, …
  }

  // ---------- Source / archive helpers ----------
  // sources[] entries are either strings (legacy) or { url, archive_url } objects.
  function sourceURL(s) { return typeof s === 'string' ? s : (s && s.url) || ''; }
  function sourceArchive(s) { return typeof s === 'string' ? null : (s && s.archive_url) || null; }
  function archiveLink(archiveUrl, label) {
    if (!archiveUrl) return '';
    return `<a class="archive-link" href="${escapeHTML(safeURL(archiveUrl))}" target="_blank" rel="noopener" title="Wayback Machine snapshot">${escapeHTML(label || 'archived')} ↗</a>`;
  }

  // ---------- Theme picker (see DESIGN.md § 15) ----------
  const THEMES = [
    { id: 'caves',         name: 'Caves of Steel',  tag: 'Earth' },
    { id: 'naked-sun',     name: 'The Naked Sun',   tag: 'Solaria' },
    { id: 'dawn',          name: 'Robots of Dawn',  tag: 'Aurora' },
    { id: 'robot-dreams',  name: 'Robot Dreams',    tag: 'Subconscious' },
    { id: 'foundation',    name: 'Foundation',      tag: 'Trantor' },
  ];
  const THEME_IDS = new Set(THEMES.map((t) => t.id));
  const LEGACY = { light: 'naked-sun', dark: 'caves' }; // migrate old values

  function resolveInitialTheme() {
    const stored = localStorage.getItem('theme');
    if (stored) {
      if (THEME_IDS.has(stored)) return stored;
      if (LEGACY[stored]) {
        localStorage.setItem('theme', LEGACY[stored]); // persist migration
        return LEGACY[stored];
      }
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'caves' : 'dawn';
  }

  function applyTheme(id) {
    if (!THEME_IDS.has(id)) return;
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem('theme', id);
  }

  function initThemePicker() {
    const initial = resolveInitialTheme();
    document.documentElement.setAttribute('data-theme', initial);

    const root = document.getElementById('theme-picker');
    if (!root) return;
    const current = root.querySelector('.theme-picker-current');
    const radios = root.querySelectorAll('input[type="radio"][name="theme"]');

    function refresh(id) {
      const t = THEMES.find((x) => x.id === id);
      if (current && t) current.textContent = t.name;
      radios.forEach((r) => { r.checked = r.value === id; });
    }
    refresh(initial);

    radios.forEach((r) => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        applyTheme(r.value);
        refresh(r.value);
        // Close the disclosure after selection
        root.open = false;
      });
    });

    // Close on Escape or outside click while open
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.open) { root.open = false; root.querySelector('summary').focus(); }
    });
    document.addEventListener('click', (e) => {
      if (!root.open) return;
      if (!root.contains(e.target)) root.open = false;
    });
  }

  // ---------- Active nav highlighting ----------
  function highlightActiveNav() {
    const path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav.primary-nav a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (
        href === path ||
        (path === 'index.html' && (href === 'index.html' || href === '.' || href === '/'))
      ) {
        // No `data-current` on the dropdown any more: initResponsiveNav never
        // moves the current page's link into it, so that state was unreachable.
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  // ---------- Priority+ primary nav ----------
  // Every section link ships once, inline, in .nav-list — no duplicate DOM tree
  // and no fixed "these three live under More" split. This measures the strip
  // against the width the header actually leaves it and *moves* the trailing
  // <li>s into the "Sections" dropdown until it fits, moving them back out as
  // the window widens. Node moves, not clones: aria-current, listeners and
  // focus order all survive, and there is exactly one <a> per section on the
  // page for a crawler to find.
  //
  // Two things this deliberately does NOT do:
  //   - it never moves the current page's link, so you can always see where you
  //     are even when everything else has collapsed into the menu;
  //   - it never runs before highlightActiveNav(), which is what marks that
  //     link. init() owns the order.
  // With JS off, nothing is hidden: styles.css leaves the strip horizontally
  // scrollable and .nav-managed (added here) is what switches overflow to the
  // dropdown.
  function initResponsiveNav() {
    const nav = document.getElementById('primary-nav');
    if (!nav) return;
    const list = nav.querySelector('.nav-list');
    const more = nav.querySelector('.primary-more');
    const overflow = nav.querySelector('.nav-overflow');
    if (!list || !more || !overflow) {
      // Falls back to the scroll strip (styles.css keeps the nav overflow-x:auto
      // until .nav-managed lands). Reachable, but with no scrollbar and no fade
      // it reads as "some sections are missing" — so say so rather than let a
      // page that forgot .nav-overflow look merely odd.
      console.warn('primary-nav: missing .nav-list / .primary-more / .nav-overflow — falling back to the scroll strip');
      return;
    }
    nav.classList.add('nav-managed');

    // The authored order, captured once. Restoring by draining `overflow` back
    // onto the tail of `list` looked right and was wrong: the collapse loop
    // skips the current page's <li>, so on any page whose link is not first,
    // that survivor is stranded mid-list and the parked items return *behind*
    // it — permanently reordering the nav, and changing which links survive the
    // next collapse. index.html hid the bug completely (its link is index 0, so
    // appending happens to reproduce the order), which is why sweeping widths on
    // one page missed it. Sweep pages, not just widths.
    const authored = Array.from(list.children);

    let scheduled = false;

    function layout() {
      scheduled = false;
      // Rebuild the strip from the authored array before measuring — offsetWidth
      // is only meaningful for an <li> actually laid out in it.
      authored.forEach((li) => list.appendChild(li));
      more.hidden = true;
      more.open = false;

      const avail = nav.clientWidth;
      // A zero/absent width is a measurement we cannot act on: it would park 8
      // of 9 links in the dropdown and look exactly like a deliberate narrow
      // layout. It happens for real — an unpainted or display:none ancestor
      // reports 0 (see the CLAUDE.md note on pre-paint reads). Abort and wait
      // for the next ResizeObserver tick rather than acting on nonsense.
      if (!avail) return;

      // scrollWidth, not the sum of offsetWidths: both .nav-list and the nav
      // itself set `gap: 2px`, and a sum of item widths silently under-counts
      // by (n-1) gaps — ~18px across nine links, enough to declare a fit that
      // overflows. Third bug in this file from measuring flex the naive way.
      let used = list.scrollWidth;
      if (used <= avail) return;

      more.hidden = false;                 // unhide first: offsetWidth of a
      const gap = parseFloat(getComputedStyle(nav).columnGap) || 0;
      const reserve = more.offsetWidth + gap;   // [hidden] element reads 0.
      const items = Array.from(list.children);
      for (let i = items.length - 1; i >= 0 && used + reserve > avail; i--) {
        if (items[i].querySelector('[aria-current="page"]')) continue;
        overflow.insertBefore(items[i], overflow.firstChild);
        // Re-read rather than subtracting a cached width: scrollWidth accounts
        // for the gap that disappeared with the item. At most 9 reflows, once
        // per resize settle — cheaper than being wrong by a gap per item.
        used = list.scrollWidth;
      }
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(layout);
    }

    schedule();
    // Web fonts land after first paint and change every label's width, so the
    // first measurement is against fallback metrics and has to be redone.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule, (err) => {
        // Not fatal — the strip stays sized against fallback metrics — but it
        // must not surface as a bare unhandled rejection.
        console.warn('primary-nav: font loading failed, layout kept fallback metrics', err);
      });
    }
    // Observe the header row, not <body>: its width tracks the viewport but its
    // own size can't be changed by moving nav items, so this can't feed itself.
    const box = nav.closest('.site-header-inner') || nav;
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(box);
    else window.addEventListener('resize', schedule);

    document.addEventListener('click', (e) => {
      if (more.open && !more.contains(e.target)) more.open = false;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && more.open) {
        more.open = false;
        const s = more.querySelector('summary');
        if (s) s.focus();
      }
    });
  }

  // ---------- URL state (filters persist in querystring) ----------
  function readQuery() {
    const out = {};
    const p = new URLSearchParams(location.search);
    for (const [k, v] of p.entries()) out[k] = v;
    return out;
  }
  function writeQuery(updates) {
    const p = new URLSearchParams(location.search);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === '' || v == null) p.delete(k);
      else p.set(k, v);
    });
    const qs = p.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    history.replaceState(null, '', url);
  }

  // ---------- Sort + filter helpers ----------
  function sortBy(arr, key, direction) {
    const dir = direction === 'desc' ? -1 : 1;
    return [...arr].sort((a, b) => {
      const av = key(a);
      const bv = key(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function textIncludes(haystack, needle) {
    if (!needle) return true;
    return String(haystack || '').toLowerCase().includes(needle.toLowerCase());
  }

  // ---------- Detail panel (shared bottom-sheet / side-panel) ----------
  let detailOpener = null;
  function openDetail(html) {
    let panel = document.getElementById('detail-panel');
    let backdrop = document.getElementById('detail-backdrop');
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'detail-panel';
      panel.className = 'detail-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', 'detail-title');
      panel.setAttribute('tabindex', '-1');
      document.body.appendChild(panel);

      backdrop = document.createElement('div');
      backdrop.id = 'detail-backdrop';
      backdrop.className = 'detail-backdrop';
      backdrop.addEventListener('click', closeDetail);
      document.body.appendChild(backdrop);

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDetail();
      });
    }
    // Remember the opener so focus returns there, and make the page behind
    // the sheet inert so Tab stays inside it (aria-modal alone doesn't).
    if (!panel.classList.contains('open')) detailOpener = document.activeElement;
    document.querySelectorAll('body > header, body > main, body > footer')
      .forEach((el) => { el.inert = true; });
    panel.innerHTML = html;
    panel.classList.add('open');
    backdrop.classList.add('open');
    requestAnimationFrame(() => panel.focus());
    // Wire close button if present
    const close = panel.querySelector('[data-detail-close]');
    if (close) close.addEventListener('click', closeDetail);
  }

  function closeDetail() {
    const panel = document.getElementById('detail-panel');
    const backdrop = document.getElementById('detail-backdrop');
    if (!panel || !panel.classList.contains('open')) return;
    panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.querySelectorAll('body > header, body > main, body > footer')
      .forEach((el) => { el.inert = false; });
    if (detailOpener && detailOpener.isConnected) detailOpener.focus();
    detailOpener = null;
  }

  // ---------- "Updated <date>" (front-page kicker, page footers) ----------
  async function loadHeaderUpdated() {
    const els = document.querySelectorAll('.updated-date');
    if (!els.length) return;
    try {
      const sources = await loadData('sources');
      const date = sources?._meta?.last_updated;
      if (date) els.forEach((el) => { el.textContent = formatDate(date); });
    } catch (e) { /* leave the dash placeholder */ }
  }

  // ---------- Collapsible Section (details) State Persistence ----------
  // Two parts, split so this survives client-side re-renders (china/news/index
  // re-paint their section containers after the bake, discarding any listeners
  // and resetting `open` — see issues.md 2026-07-16):
  //   1. applyCollapsibleState(): idempotent; sets each section's open state from
  //      localStorage → hash → default. Safe to call again after every re-render.
  //   2. a single delegated `toggle` listener on `document` (capture phase, since
  //      `toggle` does not bubble) that persists user toggles regardless of which
  //      nodes currently exist.
  // Default when a section has no saved state: respect its authored `open` attribute.
  // "Collapse by default to cut scroll" is expressed in the markup, not here — author
  // `open` only on the sections that should start open (china's renderer opens just the
  // first; policies opens only the two filter-driven tables). Keeping it in the markup
  // means no-JS/crawler and baked views get the same short default as JS readers, and
  // this stays a pure restore/persist layer that never force-opens an authored-closed
  // section (which regressed energy's below-the-fold shortlist — Codex review, PR #126).
  function pageDetailsKey(id) {
    const pageName = location.pathname.split('/').pop() || 'index.html';
    return `details-state-${pageName}-${id}`;
  }

  function applyCollapsibleState() {
    const all = Array.from(document.querySelectorAll('details.collapsible-section[id]'));
    const hashId = (location.hash && location.hash.length > 1)
      ? decodeURIComponent(location.hash.slice(1)) : null;
    all.forEach((details) => {
      const saved = localStorage.getItem(pageDetailsKey(details.id));
      if (saved !== null) {
        details.open = saved === 'open';
      } else {
        details.open = details.hasAttribute('open');
      }
      // A hash pointing inside a section always wins, so deep links land expanded.
      if (hashId) {
        try {
          if (details.id === hashId || details.querySelector(`#${CSS.escape(hashId)}`)) {
            details.open = true;
          }
        } catch (e) { /* invalid selector */ }
      }
    });
  }

  let collapsibleBound = false;
  function initCollapsibleSections() {
    if (!collapsibleBound) {
      collapsibleBound = true;
      // Delegated + capture: one listener that outlives any container re-render.
      document.addEventListener('toggle', (e) => {
        const d = e.target;
        // data-auto-opened marks a section a filter opened for the reader, which is not a choice to keep.
        if (d && d.matches && d.matches('details.collapsible-section[id]') && !d.dataset.autoOpened) {
          localStorage.setItem(pageDetailsKey(d.id), d.open ? 'open' : 'closed');
        }
      }, true);
      window.addEventListener('hashchange', applyCollapsibleState);
    }
    applyCollapsibleState();
  }

  function sentimentPillClass(sentiment) {
    if (sentiment === 'Positive') return 'positive';
    if (sentiment === 'Negative') return 'negative';
    if (sentiment === 'Mixed') return 'mixed';
    return 'outline';
  }

  function renderNewsCard(n, companies, policies, opts = {}) {
    const catSlug = slug(n.category);
    const sentimentPill = n.sentiment
      ? `<span class="pill ${sentimentPillClass(n.sentiment)}">${escapeHTML(n.sentiment)}</span>`
      : '';
    const companyPills = (n.companies || []).map(id => {
      const c = companies.find(x => x.id === id);
      const name = c ? c.name : id;
      return `<a class="pill outline" href="companies.html?focus=${encodeURIComponent(id)}">${escapeHTML(name)}</a>`;
    }).join('');
    const policyPills = (n.policies || []).map(id => {
      const p = policies.find(x => x.id === id);
      const name = p ? (p.bill_number || p.title.slice(0, 40)) : id;
      return `<a class="pill outline" href="policies.html?focus=${encodeURIComponent(id)}">${escapeHTML(name)}</a>`;
    }).join('');

    const conf = n.confidence && n.confidence !== 'High'
      ? `<span class="pill mixed">${escapeHTML(n.confidence)} confidence</span>`
      : '';

    const titleLink = opts.linkToFeed
      ? `news.html#${encodeURIComponent(n.id)}`
      : escapeHTML(safeURL(n.source_url));
    const titleTarget = opts.linkToFeed ? '' : ' target="_blank" rel="noopener"';

    // Feeds without an abstract (Hacker News, mostly) set summary = title, so
    // 54% of cards would print their own headline twice. Show nothing rather
    // than echo it — an empty line reads as missing, a repeated one as broken.
    const summaryText = (n.summary || '').trim();
    const summaryBlock = summaryText && summaryText !== (n.title || '').trim()
      ? `<p class="summary">${escapeHTML(summaryText)}</p>`
      : '';

    return `
      <article class="feed-card" id="${escapeHTML(n.id)}">
        <div class="top-row">
          <span class="pill cat-${catSlug}">${escapeHTML(n.category)}</span>
          ${sentimentPill}
          ${conf}
          <span class="row-end">
            <span>${escapeHTML(n.source)}</span>
            <span class="sep"></span>
            <span class="tnum">${escapeHTML(formatDate(n.date))}</span>
            <span class="faint">· ${escapeHTML(relativeDate(n.date))}</span>
          </span>
        </div>
        <h3><a href="${titleLink}"${titleTarget}>${escapeHTML(n.title)}</a></h3>
        ${summaryBlock}
        <div class="footer-row">
          ${companyPills}${policyPills}
          <span class="row-end">
            <a href="${escapeHTML(safeURL(n.source_url))}" target="_blank" rel="noopener">Read original →</a>
            ${archiveLink(n.archive_url)}
          </span>
        </div>
      </article>
    `;
  }

  // ---------- Source-link chips ----------
  function urlHostname(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url || ''; }
  }
  // sources[] entries are strings or { url, label } objects; renders hostname-labeled links.
  function srcLinks(sources) {
    return (sources || []).map((s) => {
      const url = typeof s === 'string' ? s : (s && s.url) || '';
      const label = (typeof s === 'object' && s && s.label) || urlHostname(url);
      return `<a href="${escapeHTML(safeURL(url))}" target="_blank" rel="noopener" title="${escapeHTML(url)}">${escapeHTML(label)}</a>`;
    }).join(' ');
  }

  // ---------- Production-trend line chart (the thesis chart) ----------
  // US vs China vs rest-of-world industrial robot installations over time.
  // Shared by index.html, china.html, and supply-chain.html so the site's core
  // evidence renders identically wherever the argument needs it.
  // Moved verbatim from supply-chain.html. Every interpolated string passes
  // through escapeHTML before landing in innerHTML — same audited pattern as
  // renderNewsCard above; rows come from our own committed supply_chain.json,
  // never runtime user input.
  // rows: supply_chain.json → production_trend. els: { svg, legend, source } elements.
  function renderProductionTrend(rows, els) {
    const svg = els.svg;
    if (!svg || rows.length < 2) return;
    const W = 560, H = 280, padL = 50, padR = 14, padT = 14, padB = 28;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const maxV = Math.max(...rows.flatMap(r => [r.us_units, r.china_units, r.row_units]));
    const x = (i) => padL + (innerW * i) / (rows.length - 1);
    const y = (v) => padT + innerH - (v / maxV) * innerH;
    const firstProjected = rows.findIndex(r => r.projected);

    const SERIES = [
      { key: 'china_units', color: 'var(--status-negative)', label: 'China' },
      { key: 'us_units', color: 'var(--cat-supplychain)', label: 'United States' },
      { key: 'row_units', color: 'var(--status-neutral)', label: 'Rest of world' },
    ];

    let grid = '';
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const val = (maxV / ticks) * i;
      const yy = y(val);
      grid += `<line class="grid-line" x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"></line>
               <text class="axis-label" x="${padL - 6}" y="${yy + 3}" text-anchor="end">${formatNumber(Math.round(val))}</text>`;
    }
    const xLabels = rows.map((r, i) => `<text class="axis-label" x="${x(i)}" y="${H - 8}" text-anchor="middle">${escapeHTML(r.year)}</text>`).join('');

    // Vertical marker at the historical/projected boundary
    let marker = '';
    if (firstProjected > 0) {
      const mx = (x(firstProjected - 1) + x(firstProjected)) / 2;
      marker = `<line x1="${mx}" y1="${padT}" x2="${mx}" y2="${padT + innerH}" stroke="var(--border-strong)" stroke-dasharray="2 3" stroke-width="1"></line>`;
    }

    const lines = SERIES.map(s => {
      // Split into a solid (historical) segment and a dashed (projected) segment so the
      // dash pattern only applies where projected:true — a single path can't mix dash styles.
      const histEnd = firstProjected === -1 ? rows.length - 1 : firstProjected - 1;
      const histPts = rows.slice(0, histEnd + 1).map((r, i) => `${x(i)},${y(r[s.key])}`).join(' ');
      // Slice from max(histEnd, 0) — histEnd is -1 when the *first* row is projected
      // (whole series projected), and rows.slice(-1) would wrongly mean "last element only".
      const projStart = Math.max(histEnd, 0);
      const projPts = firstProjected === -1 ? '' : rows.slice(projStart).map((r, i) => `${x(projStart + i)},${y(r[s.key])}`).join(' ');
      const dots = rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r[s.key])}" r="2.5" fill="${s.color}"></circle>`).join('');
      return `
        <polyline points="${histPts}" fill="none" stroke="${s.color}" stroke-width="2"></polyline>
        ${projPts ? `<polyline points="${projPts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-dasharray="5 4"></polyline>` : ''}
        ${dots}
      `;
    }).join('');

    svg.innerHTML = grid + marker + lines + xLabels;

    if (els.legend) {
      els.legend.innerHTML = SERIES.map(s => `
        <span><span class="dot" style="background:${s.color}"></span>${escapeHTML(s.label)}</span>
      `).join('') + (firstProjected >= 0 ? `<span><span class="dot" style="background:none;border:1px dashed var(--border-strong);"></span>Dashed = projected</span>` : '');
    }

    if (els.source) {
      const allSources = [...new Map(rows.flatMap(r => r.sources || []).map(u => [u, u])).values()];
      els.source.innerHTML = `Sources: ${srcLinks(allSources)}`;
    }
  }

  /* ============================================================
     Page renderers — pure: data in → HTML string out, no DOM.

     These used to live in each page's inline <script>, which meant only a
     browser could produce the site's content. The deploy-time bake step
     (scripts/render-static.js) now runs these same functions in Node against
     the same committed JSON and injects the result into the shipped HTML, so
     crawlers and no-JS readers get the content; the client then re-renders
     into the same containers exactly as before.

     The contract that makes that work: **never touch the DOM in here**. No
     document, no window, no location — arguments in, string out. A DOM
     reference doesn't fail locally (the browser has one), it fails at deploy
     inside the bake's Node sandbox, which pages.yml only runs after merge.
     ============================================================ */

  // The single sink where a renderer's string becomes DOM. The renderers own
  // escaping (every interpolated field goes through escapeHTML, every data-built
  // href through safeURL); this owns the insertion. Centralised so the escaping
  // contract has one place to audit instead of one per call site, and built on
  // replaceChildren + insertAdjacentHTML to match the idiom already used for the
  // news feed. Strings reaching here come from our own committed JSON.
  // Note the silent-failure hazard this warn exists for: a container's id and
  // its bake slot name are different strings, so renaming the container is
  // caught by nothing — bake() still fills the slot, this no-ops, and the page
  // shows permanently non-hydrating deploy-time HTML that looks entirely
  // correct. A console line is the only signal available.
  function paint(el, html) {
    if (!el) {
      console.warn('paint: no target element — a container id and its bake slot may have drifted');
      return;
    }
    el.replaceChildren();
    el.insertAdjacentHTML('beforeend', html);
  }

  // ---------- US vs China (china.html) ----------
  function chinaTally(uc) {
    const metrics = (uc.sections || []).flatMap((s) => s.metrics || []);
    const tally = { us: 0, china: 0, even: 0 };
    metrics.forEach((m) => { tally[m.edge] = (tally[m.edge] || 0) + 1; });
    return { total: metrics.length, us: tally.us, china: tally.china, even: tally.even };
  }

  function renderChinaBluf(uc) {
    const b = uc.bluf || {};
    return `<strong>${escapeHTML(b.headline)}</strong> ${escapeHTML(b.body)}` +
      `<span style="display:block;font-size:11.5px;margin-top:8px;color:var(--text-faint);">Sources: ${srcLinks(b.sources)}</span>`;
  }

  function renderChinaScoreline(uc) {
    const t = chinaTally(uc);
    return `<span>Across <strong>${t.total} metrics</strong>:</span>` +
      `<span><strong>${t.china}</strong> favor China</span>` +
      `<span><strong>${t.us}</strong> favor the US</span>` +
      `<span><strong>${t.even}</strong> contested</span>`;
  }

  // Widths come from the same counts the scoreline labels above — never color-only.
  function renderChinaScoreBar(uc) {
    const t = chinaTally(uc);
    return [['cn', t.china, 'favor China'], ['even', t.even, 'contested'], ['us', t.us, 'favor the US']]
      .map(([cls, n, label]) => {
        const pct = t.total ? (n / t.total) * 100 : 0;
        return `<span class="seg ${cls}" style="width:${pct}%" title="${escapeHTML(`${n} ${label}`)}"></span>`;
      }).join('');
  }

  function renderChinaSections(uc) {
    return (uc.sections || []).map((sec, i) => `
      <details class="collapsible-section" id="sec-${escapeHTML(sec.id)}" ${i === 0 ? 'open' : ''}>
        <summary>
          <h2 class="section-title">${escapeHTML(sec.title)}</h2>
        </summary>
        <div class="table-wrap">
          <table class="vs-table">
            <thead><tr><th>Metric</th><th>United States</th><th>China</th></tr></thead>
            <tbody>
              ${(sec.metrics || []).map((m) => `
                <tr>
                  <td class="vs-metric">${escapeHTML(m.metric)}
                    <div class="vs-srcs">${srcLinks(m.sources)}</div>
                    ${m.note ? `<div class="vs-note">${escapeHTML(m.note)}</div>` : ''}
                  </td>
                  <td class="vs-cell us-cell ${m.edge === 'us' ? 'win' : ''}">${escapeHTML(m.us)}</td>
                  <td class="vs-cell cn-cell ${m.edge === 'china' ? 'win' : ''}">${escapeHTML(m.china)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>
    `).join('');
  }

  function renderUnitreeRows(uc) {
    const rows = (uc.unitree_case && uc.unitree_case.rows) || [];
    return rows.map((r) => `
      <tr>
        <td class="vs-metric">${escapeHTML(r.dimension)}<div class="vs-srcs">${srcLinks(r.sources)}</div></td>
        <td class="vs-cell cn-cell">${escapeHTML(r.unitree)}</td>
        <td class="vs-cell us-cell">${escapeHTML(r.us_oems)}</td>
      </tr>
    `).join('');
  }

  // Plain text, not HTML: the client assigns it with textContent, the bake step
  // escapes it. Returning a string keeps both callers honest about which it is.
  function chinaMethodNote(uc) {
    const meta = uc._meta || {};
    return `Method: ${meta.method || ''}. Captured as of ${formatDate(meta.captured_at || meta.last_updated)}. "Edge" calls are editorial judgments, not scores.`;
  }

  // ---------- News (news.html, index.html) ----------
  const NEWS_PAGE_SIZE = 20;

  // The site's one definition of "latest N stories". news.html pages through the
  // full sorted list; index.html and the bake step take the head of it.
  function latestNews(news, count) {
    return sortBy(news || [], (n) => n.date, 'desc').slice(0, count);
  }

  // The front page needs ten stories and a total, not the ~1,000-record archive.
  // The deploy bake derives data/news-recent.json (gitignored, never committed) from
  // news.json with this function; loadNewsRecent() falls back to building the same
  // payload client-side, so local dev and a failed bake still work.
  const NEWS_RECENT_COUNT = 60;
  function newsRecentPayload(news) {
    return { total: (news || []).length, records: latestNews(news, NEWS_RECENT_COUNT) };
  }
  async function loadNewsRecent() {
    try {
      return await loadData('news-recent');
    } catch (err) {
      return newsRecentPayload(await loadData('news'));
    }
  }

  function newsResultCount(total, page, size) {
    if (total <= size) return `${total} ${total === 1 ? 'story' : 'stories'}`;
    const start = Math.min((page - 1) * size + 1, total);
    const end = Math.min(page * size, total);
    return `${start}–${end} of ${total} stories`;
  }

  // ---------- Dashboard (index.html) ----------
  function truncate(s, n) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1).replace(/[\s.,;:]+$/, '') + '…' : s;
  }

  // Every KPI links to the view it was counted from — a staffer who reads
  // "35 unicorns" should be one click from the list. The filters are
  // single-valued, so a couple of these can't be reproduced exactly as a URL
  // ("Signed OR In effect" has none); those link to the nearest expressible
  // view, which lands within a row or two rather than on a set several times
  // larger. Exact-ness per card, measured against the current data:
  //   Tracked funding    -> companies sorted by funding (no count implied)
  //   Unicorns        35 -> top 35 by valuation ARE the unicorns: exact
  //   Install gap        -> the scoreboard itself
  //   Active deployments -> companies.html; no deployment filter exists, so
  //                         this is a plain "go see the companies" link
  //   Congress         3 -> 5 federal bills (3 of them pre-enactment)
  //   Executive       24 -> 23 "In effect"; misses 1 lone "Signed" record
  // sc (supply_chain) may be null — the install-gap card is dropped, not faked.
  function computeKPIs(companies, policies, sc) {
    const thisYear = new Date().getFullYear();
    const ytdFunding = companies.reduce((sum, c) => sum + (c.funding_rounds || [])
      .filter((r) => r.date && r.date.startsWith(String(thisYear)) && r.amount_usd)
      .reduce((s, r) => s + r.amount_usd, 0), 0);

    const unicornCount = companies.filter((c) => (c.latest_valuation_usd || 0) >= 1e9).length;
    const activeDeployments = companies.reduce((sum, c) =>
      sum + (c.deployments || []).filter((d) => d.status === 'active').length, 0);

    const inProgress = ['Introduced', 'Committee', 'Passed House', 'Passed Senate'];
    const inEffect = ['Signed', 'In effect'];
    const congressInProgress = policies.filter((p) =>
      p.level === 'Federal' && p.type === 'Bill' && inProgress.includes(p.status)).length;
    const executiveInEffect = policies.filter((p) =>
      p.level === 'Federal' && p.type !== 'Bill' && inEffect.includes(p.status)).length;

    const kpis = [
      { label: `Tracked funding · ${thisYear}`, value: formatUSD(ytdFunding), sub: `${companies.length} companies tracked`, href: 'companies.html?sort=funding-desc' },
      { label: 'Unicorns', value: String(unicornCount), sub: 'companies ≥ $1B valuation', href: 'companies.html?sort=valuation-desc' },
      { label: 'Active deployments', value: String(activeDeployments), sub: 'production / commercial', href: 'companies.html' },
      { label: 'Congress · in progress', value: String(congressInProgress), sub: 'bills, pre-enactment', href: 'policies.html?level=Federal&type=Bill' },
      { label: 'Executive · in effect', value: String(executiveInEffect), sub: 'agency rules, programs', href: `policies.html?level=Federal&status=${encodeURIComponent('In effect')}` },
    ];

    // The China-gap KPI — the strip should reflect the thesis, not just the
    // US supply side. Ratio from the latest historical production-trend row.
    const trendRows = (sc && sc.production_trend) || [];
    const lastActual = [...trendRows].reverse().find((r) => !r.projected && r.china_units && r.us_units);
    if (lastActual) {
      const ratio = Math.round(lastActual.china_units / lastActual.us_units);
      kpis.splice(2, 0, { label: 'Install gap', value: `${ratio}×`, sub: `China vs US robot installs · ${lastActual.year}`, href: 'china.html' });
    }
    return kpis;
  }

  // The cols-6 modifier depends on how many KPIs there are, so it can't live in
  // static markup: a 6-card strip would otherwise ship into a 5-column grid for
  // every no-JS reader. Split so the client can set class and cards separately
  // while the bake step composes both into one element — same source, no drift.
  function kpiStripClass(kpis) {
    return `kpi-strip${kpis.length === 6 ? ' cols-6' : ''}`;
  }

  function renderKPICards(kpis) {
    return kpis.map((k) => `
      <a class="kpi-card" href="${escapeHTML(k.href)}">
        <span class="kpi-label">${escapeHTML(k.label)}</span>
        <span class="kpi-value tnum">${escapeHTML(k.value)}</span>
        <span class="kpi-sub">${escapeHTML(k.sub)}</span>
      </a>
    `).join('');
  }

  function renderKPIStrip(kpis) {
    return `<div id="kpi-strip" class="${kpiStripClass(kpis)}">${renderKPICards(kpis)}</div>`;
  }

  /* ---------- Front page furniture (index.html) ----------
     The dashboard used to print one undifferentiated "Recent activity" list of
     five identical cards. A front page instead ranks: one lead, a few stories
     under it, then briefs down the rail. The split happens once, here, over a
     single sorted pass — that is what guarantees no story appears in two
     positions on the same page. Everything downstream just formats a slice. */
  function frontPageStories(news, opts = {}) {
    const topN = opts.topN ?? 3;
    const briefN = opts.briefN ?? 7;
    const rows = latestNews(news, 1 + topN + briefN);
    return {
      lead: rows[0] || null,
      top: rows.slice(1, 1 + topN),
      briefs: rows.slice(1 + topN),
    };
  }

  // The kicker doubles as a filter link, the way a section label on a news site
  // does. news.html reads ?category= (see its f-category select), so this lands
  // on the filtered feed rather than a dead label.
  function storyKicker(n) {
    return `<a class="pill cat-${slug(n.category)}" href="news.html?category=${encodeURIComponent(n.category)}">${escapeHTML(n.category)}</a>`;
  }

  function storyByline(n) {
    return `<span>${escapeHTML(n.source)}</span><span class="sep"></span>` +
      `<span class="tnum">${escapeHTML(formatDate(n.date))}</span>` +
      `<span class="faint">· ${escapeHTML(relativeDate(n.date))}</span>`;
  }

  // Feeds without an abstract set summary = title (see renderNewsCard), so a
  // deck has to be suppressed in exactly the same case or the lead prints its
  // own headline twice at 17px.
  function storyDeck(n, max) {
    const s = (n.summary || '').trim();
    if (!s || s === (n.title || '').trim()) return '';
    return truncate(s, max);
  }

  // Empty corpus renders a visible notice, not ''. An empty string is a legal
  // bake slot fill, so a front page with no lead would otherwise deploy as two
  // section headings over nothing — and pages.yml runs validate + bake but never
  // npm test, so the assertion that catches this never runs on the deploy path.
  function renderLeadStory(lead, companies, policies) {
    if (!lead) {
      return '<article class="lead-story"><p class="lead-deck">No stories available — the news dataset is empty or failed to load.</p></article>';
    }
    const deck = storyDeck(lead, 340);
    const pills = [
      ...(lead.companies || []).map((id) => {
        const c = (companies || []).find((x) => x.id === id);
        return `<a class="pill outline" href="companies.html?focus=${encodeURIComponent(id)}">${escapeHTML(c ? c.name : id)}</a>`;
      }),
      ...(lead.policies || []).map((id) => {
        const p = (policies || []).find((x) => x.id === id);
        return `<a class="pill outline" href="policies.html?focus=${encodeURIComponent(id)}">${escapeHTML(p ? (p.bill_number || truncate(p.title, 40)) : id)}</a>`;
      }),
    ].join('');
    return `
      <article class="lead-story">
        <div class="lead-kicker">${storyKicker(lead)}<span class="lead-flag">Latest</span></div>
        <h2 class="lead-title"><a href="news.html#${encodeURIComponent(lead.id)}">${escapeHTML(lead.title)}</a></h2>
        ${deck ? `<p class="lead-deck">${escapeHTML(deck)}</p>` : ''}
        <div class="lead-byline">${storyByline(lead)}</div>
        <div class="lead-tags">${pills}<a class="lead-original" href="${escapeHTML(safeURL(lead.source_url))}" target="_blank" rel="noopener">Read original →</a></div>
      </article>
    `;
  }

  function renderTopStories(rows, companies) {
    return (rows || []).map((n) => {
      const deck = storyDeck(n, 150);
      const co = (n.companies || [])[0];
      const c = co ? (companies || []).find((x) => x.id === co) : null;
      return `
        <article class="story-card">
          <div class="story-kicker">${storyKicker(n)}${c ? `<span class="story-co">${escapeHTML(c.name)}</span>` : ''}</div>
          <h3 class="story-title"><a href="news.html#${encodeURIComponent(n.id)}">${escapeHTML(n.title)}</a></h3>
          ${deck ? `<p class="story-deck">${escapeHTML(deck)}</p>` : ''}
          <div class="story-byline">${storyByline(n)}</div>
        </article>
      `;
    }).join('');
  }

  // The rail. Ends with its own "all stories" row so the total is rendered from
  // the data rather than typed into the markup and left to rot.
  function renderNewsBriefs(rows, total) {
    const items = (rows || []).map((n) => `
      <li class="brief">
        <a class="brief-link" href="news.html#${encodeURIComponent(n.id)}">
          <span class="brief-cat cat-${slug(n.category)}">${escapeHTML(n.category)}</span>
          <span class="brief-title">${escapeHTML(n.title)}</span>
        </a>
        <span class="brief-meta tnum">${escapeHTML(formatDate(n.date))}</span>
      </li>
    `).join('');
    return items + `<li class="brief brief-all"><a href="news.html">All ${formatNumber(total)} stories →</a></li>`;
  }

  function renderThemeCards(themes) {
    return (themes || []).slice(0, 6).map((t) => `
      <a class="card card-hoverable" href="themes.html#${encodeURIComponent(t.id)}" style="color:inherit;border-bottom:none;">
        <div class="row" style="gap:6px;">
          <span class="pill dir-${slug(t.direction)}">${escapeHTML(t.direction)}</span>
          ${t.government_intervention_ready ? '<span class="pill outline">Policy-ready</span>' : ''}
        </div>
        <h3 class="card-title">${escapeHTML(t.name)}</h3>
        <p class="card-sub">${escapeHTML(truncate(t.narrative, 180))}</p>
        <div class="card-meta">
          <span>${(t.related_companies || []).length} cos</span>
          <span class="sep"></span>
          <span>${(t.related_policies || []).length} policies</span>
        </div>
      </a>
    `).join('');
  }

  function renderTopCompanies(companies) {
    const top = sortBy(companies || [], (c) => c.latest_valuation_usd || 0, 'desc').slice(0, 6);
    return top.map((c) => `
      <a class="card card-hoverable" href="companies.html?focus=${encodeURIComponent(c.id)}" style="color:inherit;border-bottom:none;">
        <div class="row" style="gap:6px;">
          ${(c.tags || []).slice(0, 2).map((t) => `<span class="pill outline">${escapeHTML(t)}</span>`).join('')}
        </div>
        <h3 class="card-title">${escapeHTML(c.name)}</h3>
        <div class="card-sub">${escapeHTML(prettyHQ(c.hq))} · ${escapeHTML(c.primary_use_case)}</div>
        <dl class="kv" style="grid-template-columns:auto 1fr;gap:2px 12px;">
          <dt>Valuation</dt><dd class="tnum">${formatUSD(c.latest_valuation_usd, { fallback: 'Not disclosed' })}</dd>
          <dt>Total raised</dt><dd class="tnum">${formatUSD(c.total_funding_usd, { fallback: '—' })}</dd>
        </dl>
      </a>
    `).join('');
  }

  // ---------- SCSP robotics commission report (data/scsp-robotics-commission-2026.json) ----------
  // Every claim carries a printed page and a PDF page; links open the PDF at the PDF page.
  function reportCite(report, item, label) {
    const href = safeURL(`${report.pdf_url}#page=${item.pdf_page}`);
    const text = label || (item.pages ? `pp. ${item.pages}` : `p. ${item.page}`);
    return `<a class="report-cite tnum" href="${escapeHTML(href)}" target="_blank" rel="noopener">${escapeHTML(text)}</a>`;
  }

  // A short note on another page: chosen findings and figures, each with its page link.
  // opts: { findings: [n], figures: [key-figure id], theme: theme id }
  function renderCommissionNote(report, opts) {
    const findings = (opts.findings || []).map((n) => report.findings.find((f) => f.n === n)).filter(Boolean);
    const figures = (opts.figures || []).map((id) => report.key_figures.find((k) => k.id === id)).filter(Boolean);
    const more = `scsp-summit.html${opts.theme ? `?theme=${encodeURIComponent(opts.theme)}` : ''}#report`;
    return `
      <p class="muted" style="margin:0 0 10px;font-size:13px;">From the ${escapeHTML(report.publisher.replace(/ \(.*/, ''))}'s robotics commission, <a href="${escapeHTML(safeURL(report.page_url))}" target="_blank" rel="noopener">preliminary report</a>, ${escapeHTML(formatDate(report.released))}. Page links open the PDF.</p>
      <ul class="commission-findings">${findings.map((f) => `
        <li><strong>${escapeHTML(f.title)}.</strong> ${escapeHTML(f.summary)} ${reportCite(report, f)}</li>`).join('')}
      </ul>
      ${figures.length ? `<dl class="commission-figs">${figures.map((k) => `
        <div><dt>${escapeHTML(k.label)}</dt><dd><span class="tnum">${escapeHTML(k.value)}</span> ${reportCite(report, k)}</dd></div>`).join('')}
      </dl>` : ''}
      <p style="margin:10px 0 0;font-size:13.5px;"><a href="${more}">All of the report's findings on this →</a></p>`;
  }

  // Page glue: the note sits in a collapsed <details>, so the report is fetched
  // only when a reader opens it. A failed load says so instead of leaving "Loading…".
  function mountCommissionNote(selector, opts) {
    const el = document.querySelector(selector);
    if (!el) { console.warn(`mountCommissionNote: no ${selector}`); return; }
    const box = el.closest('details');
    const load = () => loadData('scsp-robotics-commission-2026')
      .then((report) => paint(el, renderCommissionNote(report, opts)))
      .catch((err) => {
        console.error('Commission report failed to load:', err);
        paint(el, '<p class="muted-cell">Could not load the commission report. Close and reopen this section to try again.</p>');
        if (box) box.addEventListener('toggle', onToggle); // loadData clears its cache on failure, so a reopen retries
      });
    const onToggle = () => { if (box.open) { box.removeEventListener('toggle', onToggle); load(); } };
    if (!box || box.open) { load(); return; }
    box.addEventListener('toggle', onToggle);
  }

  // ---------- In-page sub-tabs (rd.html; reusable) ----------
  // Markup contract, written so the page works with JS off:
  //   <nav class="subtab-list" data-subtabs aria-label="…">
  //     <a href="#panel-x" data-subtab="x">X</a> …
  //   </nav>
  //   <section class="subtab-panel" id="panel-x">…</section> …
  // Without JS the links are an in-page jump list and every panel is visible.
  // With JS they become an ARIA tablist: one panel shown, roving tabindex,
  // ←/→/Home/End move between tabs (automatic activation), and the open tab
  // is written to ?<param>= so it deep-links.
  //
  // RT.writeQuery strips the #fragment, so the hash is read ONCE here, before
  // the first writeQuery. A hash naming a panel opens it; a hash naming an
  // element inside a panel opens that panel and scrolls the element into view.
  function initSubTabs(nav, opts = {}) {
    if (typeof nav === 'string') nav = document.querySelector(nav);
    if (!nav) return null;
    const param = opts.param || 'tab';
    const tabs = [...nav.querySelectorAll('[data-subtab]')];
    const panels = tabs.map((t) => document.getElementById((t.getAttribute('href') || '').slice(1)));
    if (!tabs.length || panels.some((p) => !p)) {
      console.warn('initSubTabs: a tab points at a missing panel');
      return null;
    }
    const ids = tabs.map((t) => t.dataset.subtab);
    const initialHash = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';

    nav.setAttribute('role', 'tablist');
    tabs.forEach((t, i) => {
      if (!t.id) t.id = `tab-${ids[i]}`;
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-controls', panels[i].id);
      panels[i].setAttribute('role', 'tabpanel');
      panels[i].setAttribute('aria-labelledby', t.id);
      panels[i].tabIndex = 0;
    });
    nav.classList.add('subtabs-ready');

    function select(i, { focus = false, write = true } = {}) {
      tabs.forEach((t, j) => {
        const on = j === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      // Keep the selected tab in view inside the strip (it scrolls sideways
      // at 375px) without scrolling the page itself.
      const dx = tabs[i].getBoundingClientRect().left - nav.getBoundingClientRect().left;
      if (dx < 0 || dx + tabs[i].offsetWidth > nav.clientWidth) nav.scrollLeft += dx - 8;
      if (focus) tabs[i].focus();
      if (write) writeQuery({ [param]: i === 0 ? '' : ids[i] });
      if (opts.onChange) opts.onChange(ids[i]);
    }

    tabs.forEach((t, i) => t.addEventListener('click', (e) => { e.preventDefault(); select(i); }));
    nav.addEventListener('keydown', (e) => {
      const cur = tabs.indexOf(document.activeElement);
      if (cur < 0) return;
      const next = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next == null) return;
      e.preventDefault();
      select((next + tabs.length) % tabs.length, { focus: true });
    });

    let start = Math.max(0, ids.indexOf(readQuery()[param]));
    let scrollTarget = null;
    if (initialHash) {
      const el = document.getElementById(initialHash);
      const owner = el ? panels.findIndex((p) => p === el || p.contains(el)) : -1;
      if (owner >= 0) { start = owner; if (el !== panels[owner]) scrollTarget = el; }
    }
    select(start, { write: !!initialHash });
    // Wait for web fonts: they reflow the tall tables, and a scroll taken
    // before that lands hundreds of pixels short of the row.
    if (scrollTarget) {
      const go = () => scrollTarget.scrollIntoView();
      go();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(go));
    }
    return { select: (id) => { const i = ids.indexOf(id); if (i >= 0) select(i); } };
  }

  // ---------- R&D page renderers (rd.html) ----------
  // Pure: rd.json in, HTML string out. Shared with the bake step.
  const RD_WEIGHTS = { open: 'Open', 'open-licensed': 'Open (restricted license)', 'partly open': 'Partly open', closed: 'Closed', api: 'API only', unknown: 'Unknown' };
  const RD_EVALUATOR = {
    'third-party': ['Third-party', 'positive'],
    'self-submitted': ['Self-submitted entries', 'warning'],
    'vendor-run': ['Vendor-run', 'negative'],
    authors: ['Authors\' own runs', ''],
    organizer: ['Organizer results', ''],
    none: ['No leaderboard', 'outline'],
  };
  const RD_COUNTRY_ORDER = ['US', 'China', 'Other', 'Unverified'];
  const RD_COUNTRY_HEAD = { US: 'United States', China: 'China', Other: 'Elsewhere', Unverified: 'Country unverified' };

  function rdText(v, fallback = 'Not disclosed') {
    return v == null || v === '' ? `<span class="muted-cell">${escapeHTML(fallback)}</span>` : escapeHTML(v);
  }
  function rdCountry(rec) {
    if (!rec || !rec.country) return '<span class="muted-cell">—</span>';
    const cls = { US: 'rd-us', China: 'rd-cn' }[rec.country] || 'outline';
    return `<span class="pill ${cls}">${escapeHTML(rec.country_label || rec.country)}</span>`;
  }
  function rdFlags(rec) {
    const out = [];
    if (rec.vendor_reported) out.push('<span class="pill warning rd-flag">Vendor-reported</span>');
    if (rec.status === 'snippet-only') out.push('<span class="pill outline rd-flag">Snippet-only</span>');
    return out.join(' ');
  }
  function rdSources(rec) {
    const srcs = rec.sources || [];
    const dates = [...new Set(srcs.map((s) => s.captured_at).filter(Boolean))];
    const read = dates.length ? `<span class="rd-read">read ${escapeHTML(dates.map((d) => formatDate(d)).join(', '))}</span>` : '';
    return `<span class="rd-src">${srcLinks(srcs)}</span> ${read}`;
  }
  function rdByCountry(list) {
    const groups = {};
    list.forEach((r) => { (groups[r.country] = groups[r.country] || []).push(r); });
    return RD_COUNTRY_ORDER.filter((c) => groups[c]).map((c) => [c, groups[c]]);
  }
  function rdSortDate(list, key) {
    return [...list].sort((a, b) => String(b[key] || '').localeCompare(String(a[key] || '')));
  }

  function rdCounts(list) {
    const n = { US: 0, China: 0, rest: 0 };
    list.forEach((r) => { if (r.country === 'US') n.US++; else if (r.country === 'China') n.China++; else n.rest++; });
    return n;
  }
  function renderRdSummary(rd) {
    const s = rd.sections;
    const rows = [
      ['Foundation models', s.models],
      ['World models', s.world_models],
      ['Benchmarks (by maintainer)', s.benchmarks],
      ['Datasets', s.areas.datasets],
    ].map(([label, list]) => {
      const n = rdCounts(list);
      return `<tr><td>${escapeHTML(label)}</td><td class="num">${n.US}</td><td class="num">${n.China}</td><td class="num">${n.rest}</td><td class="num">${list.length}</td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="data-table rd-table rd-summary-table">
      <caption class="rd-caption">Entries tracked on this page, by country. A count of what is listed here, not a measure of who leads.</caption>
      <thead><tr><th scope="col">Section</th><th scope="col" class="num">US</th><th scope="col" class="num">China</th><th scope="col" class="num">Other</th><th scope="col" class="num">Total</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  function renderRdModels(rd) {
    const models = rd.sections.models;
    const body = rdByCountry(models).map(([c, list]) => {
      const head = `<tr class="rd-group"><th scope="rowgroup" colspan="6">${escapeHTML(RD_COUNTRY_HEAD[c])} <span class="rd-count">${list.length}</span></th></tr>`;
      const rows = rdSortDate(list, 'released').map((m) => {
        const results = (m.results || []).map((r) => `<li><span class="rd-bench-name">${escapeHTML(r.benchmark)}:</span> <strong>${escapeHTML(r.value)}</strong>${r.vendor_reported ? ' <span class="pill warning rd-flag">Vendor-reported</span>' : ''}${r.setting ? `<span class="secondary-line">${escapeHTML(r.setting)}</span>` : ''}</li>`).join('');
        return `<tr id="${escapeHTML(m.id)}">
          <td><strong>${escapeHTML(m.name)}</strong><span class="secondary-line">${escapeHTML(m.class)}${m.params ? ` · ${escapeHTML(m.params)}` : ''}</span></td>
          <td>${escapeHTML(m.developer)}<span class="secondary-line">${rdCountry(m)}</span></td>
          <td class="tnum">${rdText(m.released)}</td>
          <td>${escapeHTML(RD_WEIGHTS[m.weights] || 'Unknown')}</td>
          <td class="rd-claims"><p>${escapeHTML(m.summary)}</p>${results ? `<ul class="rd-results">${results}</ul>` : '<p class="muted-cell">No published scores.</p>'}${m.caveat ? `<p class="rd-caveat">${escapeHTML(m.caveat)}</p>` : ''}</td>
          <td class="rd-srccell">${rdFlags(m)} ${rdSources(m)}</td>
        </tr>`;
      }).join('');
      return head + rows;
    }).join('');
    return `<div class="table-wrap"><table class="data-table rd-table" id="rd-models-table">
      <thead><tr><th scope="col">Model</th><th scope="col">Developer</th><th scope="col">Released</th><th scope="col">Weights</th><th scope="col">What it claims</th><th scope="col">Source</th></tr></thead>
      <tbody>${body}</tbody></table></div>`;
  }

  function renderRdWorldModels(rd) {
    const wm = rd.sections.world_models;
    const groups = [
      ['policy', 'Pretrain or drive the robot', 'The model learns physics from video and is used to train the robot\'s policy or to choose its actions directly.'],
      ['simulator', 'Simulate and evaluate', 'The model generates worlds, data or test scenarios; the robot\'s policy is trained or scored inside it.'],
      ['both', 'Both roles', 'Released for synthetic data and evaluation as well as policy pretraining.'],
    ];
    return groups.map(([role, title, blurb]) => {
      const list = rdSortDate(wm.filter((w) => w.role === role), 'released');
      if (!list.length) return '';
      const n = rdCounts(list);
      const rows = list.map((w) => `<tr id="${escapeHTML(w.id)}">
          <td><strong>${escapeHTML(w.name)}</strong><span class="secondary-line">${escapeHTML(w.type || '')}</span></td>
          <td>${escapeHTML(w.developer)}<span class="secondary-line">${rdCountry(w)}</span></td>
          <td class="tnum">${rdText(w.released)}</td>
          <td>${escapeHTML(RD_WEIGHTS[w.weights] || 'Unknown')}</td>
          <td class="rd-claims"><p>${escapeHTML(w.summary)}</p>${w.caveat ? `<p class="rd-caveat">${escapeHTML(w.caveat)}</p>` : ''}</td>
          <td class="rd-srccell">${rdFlags(w)} ${rdSources(w)}</td>
        </tr>`).join('');
      return `<section class="rd-group-block" id="wm-${escapeHTML(role)}">
        <h3 class="rd-h3">${escapeHTML(title)} <span class="rd-count">${list.length}: ${n.US} US · ${n.China} China · ${n.rest} elsewhere</span></h3>
        <p class="muted rd-blurb">${escapeHTML(blurb)}</p>
        <div class="table-wrap"><table class="data-table rd-table">
          <thead><tr><th scope="col">Model</th><th scope="col">Developer</th><th scope="col">Released</th><th scope="col">Weights</th><th scope="col">What it claims</th><th scope="col">Source</th></tr></thead>
          <tbody>${rows}</tbody></table></div></section>`;
    }).join('');
  }

  function renderRdBenchmarks(rd) {
    return rd.sections.benchmarks.map((b) => {
      const [evLabel, evCls] = RD_EVALUATOR[b.evaluator] || [b.evaluator, 'outline'];
      const leaders = (b.leaders || []).length
        ? `<div class="table-wrap"><table class="data-table rd-table rd-leaders">
            <thead><tr><th scope="col">Model</th><th scope="col">Developer</th><th scope="col">Country</th><th scope="col">Score</th><th scope="col" class="col-tight">As of</th></tr></thead>
            <tbody>${b.leaders.map((l) => `<tr><td>${escapeHTML(l.model)}</td><td>${rdText(l.developer)}</td><td>${rdCountry(l)}</td><td><strong>${escapeHTML(l.value)}</strong>${l.vendor_reported ? ' <span class="pill warning rd-flag">Vendor-reported</span>' : ''}</td><td class="tnum col-tight">${escapeHTML(formatDate(l.as_of))}</td></tr>`).join('')}</tbody>
          </table></div>`
        : '<p class="muted-cell">No ranked results shown.</p>';
      return `<article class="rd-bench" id="${escapeHTML(b.id)}">
        <header class="rd-bench-head">
          <h3 class="rd-h3">${escapeHTML(b.name)}</h3>
          <div class="rd-bench-meta"><span class="pill outline">${escapeHTML(b.kind || '')}</span> <span class="pill ${evCls}">${escapeHTML(evLabel)}</span> <span class="rd-asof">as of ${escapeHTML(formatDate(b.as_of))}</span></div>
          <p class="rd-bench-by">${escapeHTML(b.maintainer)} · ${rdCountry(b)}</p>
        </header>
        <p class="rd-bench-measures">${escapeHTML(b.measures)}</p>
        <p class="rd-bench-metric"><span class="rd-label">Metric:</span> ${escapeHTML(b.metric)}</p>
        ${leaders}
        <p class="rd-caveat">${escapeHTML(b.caveat)}</p>
        <p class="rd-bench-src">${rdFlags(b)} ${rdSources(b)}</p>
      </article>`;
    }).join('');
  }

  function renderRdAreas(rd) {
    const { areas, datasets, compute } = rd.sections.areas;
    const areaHTML = areas.map((a, i) => `<details class="rd-area" id="${escapeHTML(a.id)}"${i === 0 ? ' open' : ''}>
        <summary><span class="rd-area-name">${escapeHTML(a.name)}</span> <span class="rd-count">${a.items.length}</span></summary>
        <ul class="rd-items">${a.items.map((it) => `<li id="${escapeHTML(it.id)}">
          <p class="rd-item-head"><strong>${escapeHTML(it.actor)}</strong> ${rdCountry(it)} <span class="rd-asof">${escapeHTML(formatDate(it.date))}</span></p>
          <p>${escapeHTML(it.evidence)}</p>
          <p class="rd-item-src">${rdFlags(it)} ${rdSources(it)}</p></li>`).join('')}</ul>
      </details>`).join('');
    const dsRows = datasets.map((d) => `<tr id="${escapeHTML(d.id)}">
        <td><strong>${escapeHTML(d.name)}</strong><span class="secondary-line">${escapeHTML(d.maintainer)}</span></td>
        <td>${rdCountry(d)}</td>
        <td class="tnum">${rdText(d.released)}</td>
        <td>${escapeHTML(d.size)}</td>
        <td class="num">${d.human_video_hours == null ? '<span class="muted-cell">—</span>' : formatNumber(d.human_video_hours)}</td>
        <td>${rdText(d.license)}</td>
        <td class="rd-srccell">${rdFlags(d)} ${rdSources(d)}</td></tr>`).join('');
    const cpRows = rdSortDate(compute, 'date').map((c) => `<tr id="${escapeHTML(c.id)}">
        <td><strong>${escapeHTML(c.name)}</strong><span class="secondary-line">${escapeHTML(c.vendor)}</span></td>
        <td>${rdCountry(c)}</td>
        <td>${escapeHTML(c.spec)}</td>
        <td>${rdText(c.used_by, '—')}</td>
        <td class="tnum">${escapeHTML(formatDate(c.date))}</td>
        <td class="rd-srccell">${rdFlags(c)} ${rdSources(c)}</td></tr>`).join('');
    return `<div class="rd-areas">${areaHTML}</div>
      <h3 class="rd-h3" id="rd-datasets">Datasets</h3>
      <div class="table-wrap"><table class="data-table rd-table">
        <thead><tr><th scope="col">Dataset</th><th scope="col">Country</th><th scope="col">Released</th><th scope="col">Size</th><th scope="col" class="num">Human video (h)</th><th scope="col">License</th><th scope="col">Source</th></tr></thead>
        <tbody>${dsRows}</tbody></table></div>
      <h3 class="rd-h3" id="rd-compute">Compute</h3>
      <div class="table-wrap"><table class="data-table rd-table">
        <thead><tr><th scope="col">Chip or platform</th><th scope="col">Country</th><th scope="col">Spec</th><th scope="col">Used by</th><th scope="col">Date</th><th scope="col">Source</th></tr></thead>
        <tbody>${cpRows}</tbody></table></div>`;
  }

  function renderRdComponents(rd) {
    const { prices, bom_shares: shares, facts } = rd.sections.components;
    const priceRows = prices.map((p) => `<tr id="${escapeHTML(p.id)}"><td><strong>${escapeHTML(p.source_org)}</strong></td><td>${escapeHTML(p.scope)}</td><td>${escapeHTML(p.value)}</td><td class="tnum">${escapeHTML(formatDate(p.as_of))}</td><td class="rd-srccell">${rdFlags(p)} ${rdSources(p)}</td></tr>`).join('');
    const bom = shares.map((b) => `<article class="rd-bom" id="${escapeHTML(b.id)}">
        <h4>${escapeHTML(b.source_org)}</h4>
        <p class="rd-bom-basis">${escapeHTML(b.basis)} · ${escapeHTML(formatDate(b.as_of))}</p>
        <dl class="rd-bom-list">${b.shares.map((s) => `<div><dt>${escapeHTML(s.part)}</dt><dd>${escapeHTML(s.value)}</dd></div>`).join('')}</dl>
        <p class="rd-caveat">${escapeHTML(b.note)}</p>
        <p class="rd-item-src">${rdFlags(b)} ${rdSources(b)}</p>
      </article>`).join('');
    const groups = [];
    facts.forEach((f) => {
      const g = groups.find((x) => x[0] === f.group);
      if (g) g[1].push(f); else groups.push([f.group, [f]]);
    });
    const factRows = groups.map(([g, list]) => `<tr class="rd-group"><th scope="rowgroup" colspan="5">${escapeHTML(g)} <span class="rd-count">${list.length}</span></th></tr>` +
      list.map((f) => `<tr id="${escapeHTML(f.id)}">
        <td>${escapeHTML(f.claim)}</td>
        <td><strong>${rdText(f.value)}</strong></td>
        <td>${rdText(f.scope, '—')}</td>
        <td>${rdCountry(f)}</td>
        <td class="rd-srccell">${rdFlags(f)} ${rdSources(f)}</td></tr>`).join('')).join('');
    return `<h3 class="rd-h3" id="rd-prices">What a humanoid costs to build</h3>
      <div class="table-wrap"><table class="data-table rd-table">
        <thead><tr><th scope="col">Estimate by</th><th scope="col">Scope</th><th scope="col">Estimate</th><th scope="col">Date</th><th scope="col">Source</th></tr></thead>
        <tbody>${priceRows}</tbody></table></div>
      <h3 class="rd-h3" id="rd-bom">Where the money goes: three estimates side by side</h3>
      <p class="muted rd-blurb">Each firm splits the bill of materials into different categories and measures a different robot or year, so the shares are shown as published and not combined.</p>
      <div class="rd-bom-grid">${bom}</div>
      <h3 class="rd-h3" id="rd-facts">Component facts</h3>
      <div class="table-wrap"><table class="data-table rd-table" id="rd-facts-table">
        <thead><tr><th scope="col">Claim</th><th scope="col">Value</th><th scope="col">Robot or scope</th><th scope="col">Country</th><th scope="col">Source</th></tr></thead>
        <tbody>${factRows}</tbody></table></div>`;
  }

  function renderRdMethod(rd) {
    const m = rd.method || {};
    return `<dl class="rd-method-list">
        <div><dt><span class="pill warning rd-flag">Vendor-reported</span></dt><dd>${escapeHTML(m.vendor_reported)}</dd></div>
        <div><dt><span class="pill outline rd-flag">Snippet-only</span></dt><dd>${escapeHTML(m.snippet_only)}</dd></div>
        <div><dt>As of</dt><dd>${escapeHTML(m.as_of)}</dd></div>
      </dl>
      <p class="muted">Entries come from a research sweep read on ${escapeHTML(formatDate(rd.updated))}. Missing values show as "Not disclosed". Country columns describe where a lab or company is based; they are not a score.</p>`;
  }

  // ---------- Boot sequence ----------
  function init() {
    initThemePicker();
    highlightActiveNav();   // must precede initResponsiveNav — it marks the
    initResponsiveNav();    // link the overflow layout is required to keep inline
    loadHeaderUpdated();
    initCollapsibleSections();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ---------- Export ----------
  global.RT = {
    loadData,
    loadAll,
    formatUSD,
    formatNumber,
    formatDate,
    relativeDate,
    prettyHQ,
    escapeHTML,
    slug,
    safeURL,
    sourceURL,
    sourceArchive,
    archiveLink,
    readQuery,
    writeQuery,
    sortBy,
    textIncludes,
    openDetail,
    closeDetail,
    renderNewsCard,
    srcLinks,
    renderProductionTrend,
    truncate,
    paint,
    initCollapsibleSections,
    applyCollapsibleState,
    // Pure page renderers — shared by the inline page scripts and the
    // deploy-time bake step (scripts/render-static.js). Keep them DOM-free.
    NEWS_PAGE_SIZE,
    NEWS_RECENT_COUNT,
    latestNews,
    newsRecentPayload,
    loadNewsRecent,
    newsResultCount,
    chinaTally,
    renderChinaBluf,
    renderChinaScoreline,
    renderChinaScoreBar,
    renderChinaSections,
    renderUnitreeRows,
    chinaMethodNote,
    computeKPIs,
    kpiStripClass,
    renderKPICards,
    renderKPIStrip,
    frontPageStories,
    renderLeadStory,
    renderTopStories,
    renderNewsBriefs,
    renderThemeCards,
    renderTopCompanies,
    reportCite,
    renderCommissionNote,
    mountCommissionNote,
    initSubTabs,
    renderRdSummary,
    renderRdModels,
    renderRdWorldModels,
    renderRdBenchmarks,
    renderRdAreas,
    renderRdComponents,
    renderRdMethod,
  };
})(window);
