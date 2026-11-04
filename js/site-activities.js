/* =========================================================
   School for Self Ascension — homepage activities
   ---------------------------------------------------------
   Renders the trainings gallery and the sacred journeys from whatever Manjula
   has in the admin panel, then tells the scroll engine to re-measure.

   Three rules this file follows, in order of importance:

   1. NEVER LEAVE THE PAGE WORSE THAN IT FOUND IT. The hardcoded sections in
      index.html are the fallback. If the data can't be loaded, or comes back
      empty, or anything throws, we leave the existing markup exactly as it is
      and the site looks like it always did.
   2. TEXT ONLY. Everything Manjula types is escaped and inserted as text.
      No description can ever introduce markup or script into the page.
   3. RE-MEASURE AFTER RENDERING. The pinned gallery's scroll length is derived
      from the width of the card track, so changing the cards without calling
      __fx.rescan() would leave the pin running on stale numbers.
   ========================================================= */
(() => {
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const MODE_LABEL = { 'in-person': 'In person', online: 'Online' };

  /* Plain text, not markup: every caller runs it through esc(), and a
     pre-escaped '&amp;' would then be escaped a second time and show up on the
     page as the entity itself. */
  function modeLine(a) {
    const m = (a.modes || []).map(x => MODE_LABEL[x] || x).filter(Boolean);
    return m.length ? m.join(' & ') : '';
  }

  function money(v) {
    if (v == null || v === '') return '';
    const sym = (window.SSA_CONFIG && window.SSA_CONFIG.payments && window.SSA_CONFIG.payments.currencySymbol) || '₹';
    return sym + Number(v).toLocaleString('en-IN');
  }

  /* ---------------- trainings + courses ---------------- */
  function trainingCard(a, i) {
    const kicker = a.kicker || 'Teacher training';
    const detail = `
      ${modeLine(a) ? `<p class="dlg-kicker">${esc(modeLine(a))}</p>` : ''}
      <h3>${esc(a.fullTitle || a.title)}</h3>
      ${a.lead ? `<p class="dlg-lead">${esc(a.lead)}</p>` : ''}
      ${(a.body || []).map(p => `<p>${esc(p)}</p>`).join('')}
      ${a.listTitle ? `<p class="dlg-list-title">${esc(a.listTitle)}</p>` : ''}
      ${(a.list || []).length ? `<ul class="dlg-list">${a.list.map(li => `<li>${esc(li)}</li>`).join('')}</ul>` : ''}
      ${a.note ? `<p class="dlg-note">${esc(a.note)}</p>` : ''}
      ${a.price != null || (a.dates || []).length ? `<p class="dlg-list-title" style="margin-top:24px">Dates &amp; fee</p>
        <ul class="dlg-list">
          ${(a.dates || []).map(d => `<li>${esc(d.label)}${d.mode ? ' · ' + esc(MODE_LABEL[d.mode] || d.mode) : ''}</li>`).join('')}
          ${a.price != null ? `<li>${esc(money(a.price))}</li>` : ''}
        </ul>` : ''}`;

    return `
      <article class="tr-card" data-title="${esc(a.fullTitle || a.title)}" data-id="${esc(a.id)}">
        <div class="tr-media">${a.image ? `<img src="${esc(a.image)}" alt="${esc(a.imageAlt)}" loading="lazy">` : ''}</div>
        <div class="tr-body">
          <p class="tr-kicker"><span>${esc(modeLine(a) || kicker)}</span><span>${String(i + 1).padStart(2, '0')}</span></p>
          <h3>${esc(a.title)}</h3>
          <p>${esc(a.cardText)}</p>
          <button class="tr-more" type="button">Programme details <span aria-hidden="true">+</span></button>
        </div>
        <div class="tr-detail" hidden>${detail}</div>
      </article>`;
  }

  /* ---------------- sacred journeys ---------------- */
  function journeyBlock(a, i) {
    const when = (a.dates || [])[0];
    const word = (a.location || a.title || '').split(/[,—-]/)[0].trim();
    return `
      <article class="jr${i % 2 ? ' jr-flip' : ''}">
        <div class="jr-media">
          <span class="jr-word" aria-hidden="true">${esc(word)}</span>
          <div class="jr-portal">${a.image ? `<img src="${esc(a.image)}" alt="${esc(a.imageAlt)}" loading="lazy">` : ''}</div>
        </div>
        <div class="jr-text reveal">
          <p class="jr-when">
            ${when && when.label ? `<span>${esc(when.label)}</span>` : ''}
            ${a.duration ? `<span>${esc(a.duration)}</span>` : (a.location ? `<span>${esc(a.location)}</span>` : '')}
          </p>
          <h3>${esc(a.title)}</h3>
          ${a.subtitle ? `<p class="jr-sub">${esc(a.subtitle)}</p>` : ''}
          ${a.lead ? `<p class="jr-lead">${esc(a.lead)}</p>` : ''}
          ${(a.list || []).length ? `<ul class="jr-list">${a.list.map(li => `<li>${esc(li)}</li>`).join('')}</ul>` : ''}
          ${a.quote ? `<p class="jr-quote">${esc(a.quote)}</p>` : ''}
          <a class="btn btn-ghost" href="register.html?a=${encodeURIComponent(a.id)}">
            ${a.registrationOpen ? 'Register for this journey' : 'Ask about the next journey'}</a>
        </div>
      </article>`;
  }

  /* ---------------- register buttons on the cards ---------------- */
  function addRegisterLinks(list) {
    const byId = new Map((list || []).map(a => [a.id, a]));
    document.querySelectorAll('.tr-card').forEach(card => {
      const id = card.dataset.id;
      if (!id) return;
      const detail = card.querySelector('.tr-detail');
      if (!detail || detail.querySelector('[data-reg-link]')) return;
      const a = byId.get(id);
      detail.insertAdjacentHTML('beforeend',
        `<p data-reg-link hidden data-href="register.html?a=${encodeURIComponent(id)}"` +
        `${a && a.registrationOpen === false ? ' data-closed' : ''}></p>`);
    });
  }

  async function run() {
    if (!window.SSA) return;
    try {
      await window.SSA.ready;
      const all = await window.SSA.activities.published();
      if (!all || !all.length) return;             // keep the hardcoded fallback

      /* Trainings first, then courses — otherwise a course with order 10 lands
         in the middle of the trainings, since each section numbers from 10. */
      const rank = { trainings: 0, courses: 1 };
      const trainings = all
        .filter(a => (a.section === 'trainings' || a.section === 'courses') && a.showInGallery !== false)
        .sort((x, y) => (rank[x.section] - rank[y.section]) || (x.order - y.order) || x.title.localeCompare(y.title));
      const journeys = all.filter(a => a.section === 'journeys');

      const track = document.getElementById('trTrack');
      if (track && trainings.length) {
        track.innerHTML = trainings.map(trainingCard).join('');
        const total = document.getElementById('trTotal');
        if (total) total.textContent = String(trainings.length).padStart(2, '0');
      }

      const journeysWrap = document.querySelector('#journeys .wrap');
      if (journeysWrap && journeys.length) {
        journeysWrap.querySelectorAll('.jr').forEach(el => el.remove());
        journeysWrap.insertAdjacentHTML('beforeend', journeys.map(journeyBlock).join(''));
      }

      addRegisterLinks(all);

      /* The gallery's scroll runway is computed from the track width, so this
         has to happen after the cards are in the DOM. Images are still loading
         at this point, so measure again once they settle. */
      if (window.__fx && window.__fx.rescan) {
        window.__fx.rescan();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => window.__fx.rescan());
        addEventListener('load', () => window.__fx.rescan(), { once: true });
      }
    } catch (e) {
      /* Leave the page exactly as the HTML had it. A broken database must
         never mean a broken homepage. */
      console.warn('[SSA] Showing the built-in activities, could not load the saved ones:', e && e.message);
    }
  }

  run();
})();
