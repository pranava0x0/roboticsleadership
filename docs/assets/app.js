/* ============================================================
   app.js — shared utilities for the Robotics Tracker static site
   No framework. ES modules where supported; plain script otherwise.
   ============================================================ */

(function (global) {
  'use strict';

  // ---------- Data fetching with in-memory cache ----------
  const cache = {};
  async function loadData(name) {
    if (cache[name]) return cache[name];
    const url = `data/${name}.json`;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const json = await res.json();
      cache[name] = json;
      return json;
    } catch (err) {
      console.error(`Failed to load ${url}:`, err);
      throw err;
    }
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

  // ---------- Theme picker (4-up; see DESIGN.md § 15) ----------
  const THEMES = [
    { id: 'caves',         name: 'Caves of Steel',  tag: 'Earth' },
    { id: 'naked-sun',     name: 'The Naked Sun',   tag: 'Solaria' },
    { id: 'dawn',          name: 'Robots of Dawn',  tag: 'Aurora' },
    { id: 'robot-dreams',  name: 'Robot Dreams',    tag: 'Cosmic' },
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
        a.setAttribute('aria-current', 'page');
        const more = a.closest('.primary-more');
        if (more) more.dataset.current = 'true';
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
    if (panel) panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }

  // ---------- Header "Updated <date>" populator ----------
  async function loadHeaderUpdated() {
    const el = document.querySelector('.header-updated-date');
    if (!el) return;
    try {
      const sources = await loadData('sources');
      const date = sources?._meta?.last_updated;
      if (date) el.textContent = formatDate(date);
    } catch (e) { /* leave the dash placeholder */ }
  }

  // ---------- Collapsible Section (details) State Persistence ----------
  function initCollapsibleSections() {
    const detailsElems = document.querySelectorAll('details.collapsible-section[id]');
    detailsElems.forEach((details) => {
      const id = details.id;
      const pageName = location.pathname.split('/').pop() || 'index.html';
      const pageKey = `details-state-${pageName}-${id}`;
      
      // Restore state
      const savedState = localStorage.getItem(pageKey);
      if (savedState !== null) {
        details.open = savedState === 'open';
      } else {
        // Default behavior if not set:
        // On mobile/tablet, keep them closed by default except the first one on the page.
        // On desktop, keep them open (respect HTML default).
        const isMobileOrTablet = window.innerWidth < 1024;
        if (isMobileOrTablet) {
          const allCollapsibleOnPage = Array.from(document.querySelectorAll('details.collapsible-section[id]'));
          const firstCollapsible = allCollapsibleOnPage[0];
          details.open = (details === firstCollapsible);
        } else {
          details.open = details.hasAttribute('open');
        }
      }

      // Auto-expand if the URL has a hash pointing to an element inside this details
      const checkAndExpandHash = () => {
        if (location.hash && location.hash.length > 1) {
          const hashId = decodeURIComponent(location.hash.slice(1));
          try {
            if (details.querySelector(`#${CSS.escape(hashId)}`)) {
              details.open = true;
            }
          } catch (e) {
            // invalid selector
          }
        }
      };

      checkAndExpandHash();
      window.addEventListener('hashchange', checkAndExpandHash);

      // Listen to toggle events
      details.addEventListener('toggle', () => {
        localStorage.setItem(pageKey, details.open ? 'open' : 'closed');
      });
    });
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
      `).join('') + `<span><span class="dot" style="background:none;border:1px dashed var(--border-strong);"></span>Dashed = projected</span>`;
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
  function paint(el, html) {
    if (!el) return;
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
    return `Method: ${meta.method || ''}. Captured as of ${formatDate(meta.captured_at || meta.last_updated)}. "Edge" calls are editorial judgments on sourced data, not scores.`;
  }

  // ---------- News (news.html, index.html) ----------
  const NEWS_PAGE_SIZE = 20;

  // The site's one definition of "latest N stories". news.html pages through the
  // full sorted list; index.html and the bake step take the head of it.
  function latestNews(news, count) {
    return sortBy(news || [], (n) => n.date, 'desc').slice(0, count);
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

  // ---------- Boot sequence ----------
  function init() {
    initThemePicker();
    highlightActiveNav();
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
    // Pure page renderers — shared by the inline page scripts and the
    // deploy-time bake step (scripts/render-static.js). Keep them DOM-free.
    NEWS_PAGE_SIZE,
    latestNews,
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
    renderThemeCards,
    renderTopCompanies,
  };
})(window);
