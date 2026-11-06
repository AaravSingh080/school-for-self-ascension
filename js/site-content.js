/* =========================================================
   School for Self Ascension — homepage content overlay
   ---------------------------------------------------------
   Puts whatever Manjula has saved in the content admin over the wording that
   is written into index.html.

   The one rule that makes this safe to hand to someone non-technical:

       NOTHING SAVED MEANS NOTHING CHANGES.

   Every field is optional. An empty box is not an empty heading on the
   website; it is the original wording, still sitting in index.html where it
   always was. So clearing a field by accident, or a database that cannot be
   reached, or a half-finished edit, all land in the same safe place: the site
   people already know.

   That is why this file only ever WRITES INTO existing elements. It never
   creates a section, never removes one, and never touches the hero headline or
   the manifesto — those two carry one-shot scroll animations that capture
   their words at load, and rewriting them afterwards would break the effect
   rather than the text.
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* Only write when there is something to write. A blank value means "leave
     the page alone", which is the whole safety story above. */
  const has = v => typeof v === 'string' ? v.trim() !== '' : (v != null && v !== '');

  function setText(sel, value) {
    if (!has(value)) return;
    const el = $(sel);
    if (el) el.textContent = String(value).trim();
  }

  function setAttr(sel, attr, value) {
    if (!has(value)) return;
    const el = $(sel);
    if (el) el.setAttribute(attr, String(value).trim());
  }

  /* A heading that the scroll engine splits into animated words. Replacing its
     text clears the split markup; __fx.rescan() puts it back. */
  function setSplitHeading(sel, value) {
    if (!has(value)) return;
    const el = $(sel);
    if (!el) return;
    el.textContent = String(value).trim();
  }

  /* ---------------------------------------------------------
     The quotation band
     --------------------------------------------------------- */
  function applyQuote(q) {
    if (!q) return;
    setSplitHeading('.band blockquote', q.text);
    if (has(q.attrib)) {
      let el = $('.band-attrib');
      if (!el) {
        const copy = $('.band-copy');
        if (!copy) return;
        el = document.createElement('p');
        el.className = 'band-attrib';
        copy.appendChild(el);
      }
      el.textContent = String(q.attrib).trim();
    }
    setAttr('#bandImg', 'src', q.image);
  }

  /* ---------------------------------------------------------
     The four healing paths
     Matched by position, not by id: the cards are fixed furniture on the page
     and the admin edits them in place. A saved entry with no title simply
     leaves that card as it was.
     --------------------------------------------------------- */
  function applyHealing(list) {
    if (!Array.isArray(list) || !list.length) return;
    const cards = $$('.stack-card');
    list.forEach((item, i) => {
      const card = cards[i];
      if (!card || !item) return;
      if (has(item.title)) { const h = $('h3', card); if (h) h.textContent = String(item.title).trim(); }
      if (has(item.text))  { const p = $('p', card);  if (p) p.textContent = String(item.text).trim(); }
      if (has(item.linkLabel)) {
        const a = $('.link-arrow', card);
        if (a) a.innerHTML = esc(String(item.linkLabel).trim()) + ' <span aria-hidden="true">→</span>';
      }
    });
  }

  /* ---------------------------------------------------------
     About the teacher
     --------------------------------------------------------- */
  function applyAbout(a) {
    if (!a) return;
    setText('.journey-intro .creds', a.creds);
    setText('.journey-intro .lead', a.lead);
    setText('.journey-intro .muted', a.muted);
  }

  /* ---------------------------------------------------------
     Apothecary: the three process steps, and the product collection
     --------------------------------------------------------- */
  function applyApothecary(ap) {
    if (!ap) return;

    if (Array.isArray(ap.steps)) {
      const steps = $$('.apo-step');
      ap.steps.forEach((s, i) => {
        const el = steps[i];
        if (!el || !s) return;
        if (has(s.title)) { const h = $('h3', el); if (h) h.textContent = String(s.title).trim(); }
        if (has(s.text))  { const p = $('p', el);  if (p) p.textContent = String(s.text).trim(); }
      });
    }

    /* The collection is the one list she can genuinely add to and reorder, so
       it is rebuilt rather than patched in place. Only when she has actually
       saved products - otherwise the hardcoded cards stay exactly as they are. */
    const products = (ap.products || []).filter(p => p && p.published !== false && has(p.title));
    if (products.length) {
      const grid = $('.col-grid');
      if (grid) {
        grid.innerHTML = products
          .slice()
          .sort((x, y) => (Number(x.order) || 0) - (Number(y.order) || 0))
          .map(p => `
            <a class="col-card reveal tilt" href="#contact" data-interest="${esc(p.title)}">
              <div class="col-media">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.imageAlt || p.title)}" loading="lazy">` : ''}</div>
              <h4>${esc(p.title)}</h4><p>${esc(p.text || '')}</p>
            </a>`).join('');
      }
    }
  }

  /* ---------------------------------------------------------
     The film
     She pastes a link. A YouTube or Vimeo link becomes an embed; anything else
     is treated as a video file. Nothing pasted leaves the built-in video in
     place, which is why a blank box is always a safe answer.
     --------------------------------------------------------- */
  function youtubeId(url) {
    const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : '';
  }
  function vimeoId(url) {
    const m = String(url).match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
    return m ? m[1] : '';
  }

  function applyFilm(f) {
    if (!f) return;
    const section = $('#film');
    if (!section) return;

    setSplitHeading('#film h2', f.heading);

    if (f.published === false) { section.hidden = true; return; }
    section.hidden = false;

    setAttr('#filmVideo', 'poster', f.poster);
    if (!has(f.url)) return;

    const url = String(f.url).trim();
    const yt = youtubeId(url), vm = vimeoId(url);
    const frame = $('#filmFrame');
    if (!frame) return;

    if (yt || vm) {
      /* An embed replaces the custom player, so the play button goes with it:
         YouTube and Vimeo bring their own, and two play buttons on one video
         is worse than none. */
      const src = yt
        ? 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(yt) + '?rel=0'
        : 'https://player.vimeo.com/video/' + encodeURIComponent(vm);
      frame.innerHTML = `<iframe class="film-embed" src="${esc(src)}" title="Film"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>`;
      return;
    }

    /* Not a service we recognise: treat it as a video file and let the page's
       own player handle it. Only http(s) - a javascript: or data: URL has no
       business in a src. */
    let safe = '';
    try {
      const parsed = new URL(url, location.href);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') safe = url;
    } catch (e) { safe = ''; }
    if (!safe) return;

    const video = $('#filmVideo');
    if (video) {
      const source = $('source', video) || video.appendChild(document.createElement('source'));
      source.setAttribute('src', safe);
      source.setAttribute('type', /\.webm($|\?)/i.test(safe) ? 'video/webm' : 'video/mp4');
      video.load();
    }
  }

  /* Contact details are deliberately NOT editable here, and the reason is
     worth writing down. The phone number and email are named 28 times across
     seven files, 20 of them on terms.html, privacy.html and refunds.html.
     This script only runs on the front page, so an editable field would change
     the homepage and leave the policy pages quoting the old number. A site
     that contradicts itself about how to reach it is worse than one that needs
     a developer for a change that happens once every few years - and the pages
     it would contradict itself on first are the legal ones. */

  /* ---------------------------------------------------------
     Run
     --------------------------------------------------------- */
  async function run() {
    if (!window.SSA) return;
    try {
      await window.SSA.ready;
      const c = await window.SSA.content.get();
      if (!c || !Object.keys(c).length) return;      /* nothing saved: page as written */

      setText('#heroSub', c.hero && c.hero.sub);
      applyQuote(c.quote);
      applyHealing(c.healing);
      applyAbout(c.about);
      applyApothecary(c.apothecary);
      applyFilm(c.film);

      /* Headings were re-texted and the collection may have changed height, so
         the scroll engine has to measure again and re-split the new words. */
      if (window.__fx && window.__fx.rescan) {
        window.__fx.rescan();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => window.__fx.rescan());
        addEventListener('load', () => window.__fx.rescan(), { once: true });
      }
    } catch (e) {
      /* A page that reads as it was written is a perfectly good outcome. */
      console.warn('[SSA] Showing the built-in wording:', e && e.message);
    }
  }

  run();
})();
