// Scroll-depth probe. Paste into the browser (or the Claude preview javascript tool) on any page
// served from docs/ (node scripts/serve.js 8765). It loads every page in a hidden same-origin
// iframe, waits until scrollHeight stops changing (a JS-rendered page under-reports if read early),
// and reports screens = page height / viewport height, plus mobile overflow and dead links.
//
//   await window.__uat(1280, 800)   // desktop
//   await window.__uat(375, 812)    // phone
//
// Budget: no page above 10 screens on desktop or 15 on a phone, except where a page's own
// backlog entry says otherwise. Append results to data/metrics/uat-scroll.jsonl.
window.__uat = async (W, H) => {
  const pages = ['index', 'news', 'companies', 'policies', 'supply-chain', 'china', 'states', 'themes', 'energy', 'physical-ai-action-plan'];
  const out = [];
  for (const p of pages) {
    const f = document.createElement('iframe');
    f.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;border:0;opacity:0;pointer-events:none`;
    document.body.appendChild(f);
    const errs = [];
    await new Promise((res) => { f.onload = res; f.src = p + '.html'; });
    try { f.contentWindow.addEventListener('error', (e) => errs.push(String(e.message))); } catch (e) { /* cross-origin */ }
    let prev = -1, cur = 0, n = 0;
    while (prev !== cur && n < 14) { prev = cur; await new Promise((r) => setTimeout(r, 700)); cur = f.contentDocument.documentElement.scrollHeight; n++; }
    const d = f.contentDocument;
    const det = [...d.querySelectorAll('details')];
    out.push({
      p, sh: cur, screens: +(cur / H).toFixed(1), det: det.length, open: det.filter((x) => x.open).length,
      dead: [...d.querySelectorAll('a')].filter((x) => x.getAttribute('href') === '#').length,
      img0: [...d.images].filter((i) => i.complete && i.naturalWidth === 0).length,
      ovx: d.documentElement.scrollWidth > W + 1, links: d.querySelectorAll('a[href]').length,
      rows: d.querySelectorAll('tbody tr').length, errs,
    });
    f.remove();
  }
  return out;
};
