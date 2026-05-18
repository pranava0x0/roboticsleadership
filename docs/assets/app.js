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

  async function loadAll() {
    const [companies, policies, news, themes, sources] = await Promise.all([
      loadData('companies'),
      loadData('policies'),
      loadData('news'),
      loadData('themes'),
      loadData('sources'),
    ]);
    return { companies, policies, news, themes, sources };
  }

  // ---------- Formatters ----------
  function formatUSD(n, opts = {}) {
    if (n == null || isNaN(n)) return opts.fallback ?? '—';
    const abs = Math.abs(n);
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toLocaleString('en-US')}`;
  }

  function formatNumber(n, opts = {}) {
    if (n == null || isNaN(n)) return opts.fallback ?? '—';
    return n.toLocaleString('en-US');
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

  // ---------- Theme toggle ----------
  function initThemeToggle() {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', initial);

    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    function refresh() {
      const cur = document.documentElement.getAttribute('data-theme');
      btn.setAttribute('aria-label', `Switch to ${cur === 'dark' ? 'light' : 'dark'} theme`);
      btn.textContent = cur === 'dark' ? '☀' : '☾';
    }
    refresh();
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      refresh();
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

  // ---------- Boot sequence ----------
  function init() {
    initThemeToggle();
    highlightActiveNav();
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
    readQuery,
    writeQuery,
    sortBy,
    textIncludes,
    openDetail,
    closeDetail,
  };
})(window);
