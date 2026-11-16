// X list harvest, text and DOM first (REFRESH.md Step 3b). Paste the whole file
// into claude-in-chrome `javascript_tool` on an x.com list or search page, once;
// then loop: `computer` key "Page_Down" x3, wait ~1.2s, `__xh.collect()`.
// Keys return no screenshot; a `computer` scroll returns one every time.
//
//   __xh.collect()     read every <article> in the DOM into a Map; returns counts only
//   __xh.dump(i)       kept posts from index i, compact, under ~900 chars per call
//   __xh.plan([n,...]) for the posts you picked from the text: images to view,
//                      videos worth a look (no argument: every kept post)
//
// Cheap pass first: text, quoted text, link cards, image alt text and the
// engagement counts all come from the DOM, so no screenshot is spent on reading.
// Images are viewed only for kept posts whose alt text says nothing; videos are
// skipped unless engagement is very high (VIDEO_BAR). A skipped video's post is
// still kept: its text, quote, card and any alt text are exported regardless. Output never contains
// "=", "&" or "?" (javascript_tool rejects those as query-string data), and
// image URLs shrink to their media id; rebuild them as
// https://pbs.twimg.com/media/<id>.jpg
// Tested by scripts/x-harvest.test.js.
(function (g) {
  const KEEP = /\b(robot\w*|humanoid|physical ai|embodied|vla\b|world model|actuator|gripper|dexter\w*|cobot|autonom\w*|drone|lidar|exoskeleton|unitree|figure|optimus|agility|apptronik|1x\b|agibot|ubtech|boston dynamics|skild|physical intelligence|series [a-f]|raises?|raised|funding|valuation|ipo|acqui\w+|revenue|earnings|guidance|orders|tariff|section 232|export control|entity list|subsid\w+|factory|deploy\w*|shipment|units)\b/i;
  const VIDEO_BAR = { views: 100000, likes: 1000, reposts: 200 };

  function parseCount(s) {
    const m = String(s || '').replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
    if (!m) return 0;
    const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
    return Math.round(parseFloat(m[1]) * mult);
  }

  // "12 replies, 34 reposts, 1,204 likes, 8 bookmarks, 45678 views"
  function parseEngagement(label) {
    const out = { replies: 0, reposts: 0, likes: 0, bookmarks: 0, views: 0 };
    // Not split on ",": the counts carry thousands separators ("1,204 likes").
    for (const m of String(label || '').matchAll(/(\d[\d.,]*[KMB]?)\s+(repl|repost|retweet|like|bookmark|view)/gi)) {
      const k = { repl: 'replies', repost: 'reposts', retweet: 'reposts', like: 'likes', bookmark: 'bookmarks', view: 'views' }[m[2].toLowerCase()];
      out[k] = parseCount(m[1]);
    }
    return out;
  }

  const ALT_EMPTY = /^(image|photo|)$/i;
  function mediaPlan(item) {
    const e = item.eng || {};
    const video = !item.video ? 'none'
      : (e.views >= VIDEO_BAR.views || e.likes >= VIDEO_BAR.likes || e.reposts >= VIDEO_BAR.reposts) ? 'review' : 'skip';
    const imgs = item.images || [];
    const images = !imgs.length ? 'none' : imgs.every((i) => !ALT_EMPTY.test((i.alt || '').trim())) ? 'alt' : 'view';
    return { images, video };
  }

  // Every alt the post carries, images and video alike, minus X's "Image"/"Photo"
  // defaults. Kept and printed even when the media itself is never opened.
  function altText(item) {
    return [...(item.images || []).map((i) => i.alt), item.videoAlt || ''].map((a) => (a || '').trim()).filter((a) => a && !ALT_EMPTY.test(a)).join(' / ');
  }

  function keep(item) {
    return KEEP.test([item.text, item.quote, item.card, altText(item)].join(' '));
  }

  // Strip what javascript_tool refuses or truncates on.
  function clean(s, n) {
    return String(s || '').replace(/[^\x20-\x7E]/g, ' ').replace(/=/g, '%3D').replace(/&/g, '%26').replace(/\?/g, '%3F')
      .replace(/\s+/g, ' ').trim().slice(0, n);
  }

  function mediaId(src) {
    const m = String(src || '').match(/\/media\/([\w-]+)/);
    return m ? m[1] : '';
  }

  function readArticle(a) {
    const time = a.querySelector('time[datetime]');
    const link = time && time.closest('a[href*="/status/"]');
    if (!link) return null;
    const texts = [...a.querySelectorAll('[data-testid="tweetText"]')].map((t) => t.innerText);
    const group = a.querySelector('[role="group"][aria-label]');
    const card = a.querySelector('[data-testid="card.wrapper"]');
    const cardLink = card && card.querySelector('a[href]');
    return {
      url: link.getAttribute('href').split('?')[0],
      t: time.getAttribute('datetime').slice(0, 16),
      repost: !!a.querySelector('[data-testid="socialContext"]'),
      text: texts[0] || '',
      quote: texts.slice(1).join(' | '),
      card: card ? `${card.innerText} ${cardLink ? cardLink.getAttribute('href') : ''}` : '',
      // A video's poster frame is also an <img> in tweetPhoto, but not under /media/.
      images: [...a.querySelectorAll('[data-testid="tweetPhoto"] img')].map((i) => ({ id: mediaId(i.src), alt: i.alt || '' })).filter((i) => i.id),
      video: !!a.querySelector('[data-testid="videoPlayer"], [data-testid="videoComponent"], video'),
      // A skipped video still leaves its description: the poster's alt or the player's label.
      videoAlt: (() => {
        const v = a.querySelector('[data-testid="videoPlayer"], [data-testid="videoComponent"]');
        const poster = v && v.querySelector('img[alt], video[aria-label]');
        return (poster && (poster.getAttribute('alt') || poster.getAttribute('aria-label'))) || (v && v.getAttribute('aria-label')) || '';
      })(),
      eng: parseEngagement(group && group.getAttribute('aria-label')),
    };
  }

  const seen = g.__xh ? g.__xh.seen : new Map();

  function collect(doc) {
    let added = 0;
    for (const a of (doc || g.document).querySelectorAll('article')) {
      const item = readArticle(a);
      if (!item || seen.has(item.url)) continue;
      item.keep = keep(item);
      item.plan = mediaPlan(item);
      seen.set(item.url, item);
      added++;
    }
    const all = [...seen.values()];
    const times = all.map((i) => i.t).sort();
    return `seen ${all.length} (+${added}), kept ${all.filter((i) => i.keep).length}, oldest ${times[0] || '-'}`;
  }

  function kept() {
    return [...seen.values()].filter((i) => i.keep).sort((a, b) => (a.t < b.t ? 1 : -1));
  }

  function line(i, n) {
    const e = i.eng;
    const media = [i.images.length ? `img:${i.plan.images}:${i.images.map((m) => m.id).join('+')}` : '', i.video ? `vid:${i.plan.video}` : ''].filter(Boolean).join(' ');
    return [String(n), i.t, i.url, `${e.likes}L/${e.reposts}R/${e.views}V`, media, clean(i.text, 220), i.quote ? `Q: ${clean(i.quote, 100)}` : '', i.card ? `C: ${clean(i.card, 90)}` : '',
      altText(i) ? `ALT: ${clean(altText(i), 120)}` : ''].filter(Boolean).join(' | ');
  }

  function dump(from, budget) {
    const list = kept();
    const max = budget || 900;   // javascript_tool truncates near 1,000 chars
    let out = '';
    let i = from || 0;
    for (; i < list.length; i++) {
      const l = line(list[i], i) + '\n';
      if (out && out.length + l.length > max) break;
      out += l;
    }
    return out + (i < list.length ? `NEXT ${i} of ${list.length}` : `END ${list.length}`);
  }

  function plan(picks) {
    const all = kept();
    const list = all.map((x, n) => [x, n]).filter(([, n]) => !picks || picks.includes(n)).map(([x]) => x);
    const idx = (x) => all.indexOf(x);
    const view = list.map((x) => [x, idx(x)]).filter(([x]) => x.plan.images === 'view').map(([x, n]) => `${n}:${x.images.map((m) => m.id).join('+')}`);
    const vids = list.map((x) => [x, idx(x)]).filter(([x]) => x.plan.video === 'review').map(([x, n]) => `${n}:${x.url}`);
    const skipped = list.filter((x) => x.plan.video === 'skip').length;
    return `view images ${view.length}: ${view.join(' ')}\nreview videos ${vids.length}: ${vids.join(' ')}\nvideos skipped (low engagement) ${skipped}`;
  }

  g.__xh = { seen, collect, dump, plan, kept, parseCount, parseEngagement, mediaPlan, keep, altText, clean, mediaId, readArticle, VIDEO_BAR };
  return 'x-harvest ready';
})(globalThis);
