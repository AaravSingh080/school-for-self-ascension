/* =========================================================
   School for Self Ascension — website content editor
   ---------------------------------------------------------
   Edits the words and pictures on the front page. Workshops and registrations
   live in admin.html; this is the other half.

   Two decisions worth knowing:

   1. EMPTY MEANS "LEAVE IT ALONE". Nothing here is required. A blank box is
      not a blank heading on the website — js/site-content.js simply does not
      touch that element, and the wording written into index.html shows
      instead. So "Put the original back" is just clearing the boxes, and
      there is no way to end up with an empty front page.

   2. THE GREY PLACEHOLDER TEXT IS READ FROM THE REAL PAGE. This file fetches
      index.html and pulls the current wording out of it, rather than keeping
      its own copy. A second copy would drift the first time someone edited the
      HTML, and then the editor would be quietly lying about what the site
      says.
   ========================================================= */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => window.SSA.util.escape(s);

  /* Pictures already in the repository. Uploading is not possible on the free
     plan, so this is the whole palette; adding to it needs a developer. */
  const IMAGES = [
    'assets/img/hero-sky.webp', 'assets/img/lotus-pond.webp', 'assets/img/diya-glow.webp',
    'assets/img/angel-feather.webp', 'assets/img/healing-hands.webp', 'assets/img/crystals-light.webp',
    'assets/img/singing-bowls.webp', 'assets/img/workshop-circle.webp', 'assets/img/botanicals.webp',
    'assets/img/stirring-soap.webp', 'assets/img/pouring-wax.webp',
    'assets/img/tr-angels.webp', 'assets/img/tr-unicorns.webp', 'assets/img/tr-dragons.webp',
    'assets/img/tr-atlantis.webp', 'assets/img/tr-lemuria.webp', 'assets/img/tr-ascension.webp',
    'assets/img/tr-violet-flame.webp', 'assets/img/jr-egypt.webp', 'assets/img/jr-babaji-cave.webp'
  ];

  let content = {};        /* what is saved */
  let original = {};       /* what index.html says, for the placeholders */
  let dirty = false;
  let toastTimer;

  function toast(msg, isError) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isError);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3600);
  }

  function markDirty() {
    dirty = true;
    $('cStatus').textContent = 'Not saved yet.';
    $('cStatus').classList.add('is-dirty');
  }

  function markClean(msg) {
    dirty = false;
    $('cStatus').textContent = msg || 'Everything is saved.';
    $('cStatus').classList.remove('is-dirty');
  }

  /* ---------------------------------------------------------
     Read the current wording out of the real index.html
     --------------------------------------------------------- */
  async function loadOriginal() {
    try {
      const html = await fetch('index.html', { cache: 'no-store' }).then(r => r.text());
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const txt = sel => { const el = doc.querySelector(sel); return el ? el.textContent.trim().replace(/\s+/g, ' ') : ''; };

      original = {
        heroSub: txt('#heroSub'),
        quoteText: txt('.band blockquote'),
        quoteAttrib: txt('.band-attrib'),
        quoteImage: (doc.querySelector('#bandImg') || {}).getAttribute
          ? doc.querySelector('#bandImg').getAttribute('src') : '',
        aboutCreds: txt('.journey-intro .creds'),
        aboutLead: txt('.journey-intro .lead'),
        aboutMuted: txt('.journey-intro .muted'),
        filmHeading: txt('#film h2'),
        filmPoster: doc.querySelector('#filmVideo') ? doc.querySelector('#filmVideo').getAttribute('poster') : '',
        healing: $$('.stack-card', doc).map(c => ({
          title: (c.querySelector('h3') || {}).textContent || '',
          text: (c.querySelector('p') || {}).textContent || '',
          linkLabel: ((c.querySelector('.link-arrow') || {}).textContent || '').replace(/→/g, '').trim()
        })),
        steps: $$('.apo-step', doc).map(s => ({
          title: (s.querySelector('h3') || {}).textContent || '',
          text: (s.querySelector('p') || {}).textContent || ''
        })),
        products: $$('.col-card', doc).map(c => ({
          title: (c.querySelector('h4') || {}).textContent || '',
          text: (c.querySelector('p') || {}).textContent || '',
          image: (c.querySelector('img') || {}).getAttribute ? c.querySelector('img').getAttribute('src') : ''
        }))
      };
      Object.keys(original).forEach(k => {
        if (typeof original[k] === 'string') original[k] = original[k].trim().replace(/\s+/g, ' ');
      });
    } catch (e) {
      /* Placeholders are a convenience, not a requirement. */
      console.warn('[SSA] Could not read the current wording from index.html:', e && e.message);
      original = { healing: [], steps: [], products: [] };
    }
  }

  /* ---------------------------------------------------------
     Picture chooser
     --------------------------------------------------------- */
  let pickTarget = null;

  function pickerButton(host, value, fallback) {
    const shown = value || fallback || '';
    host.innerHTML = `
      <button class="cm-pick-btn" type="button">
        ${shown ? `<img src="${esc(shown)}" alt="">` : '<span class="cm-pick-none">No picture</span>'}
        <span class="cm-pick-label">${shown ? esc(shown.replace('assets/img/', '')) : 'Choose'}${!value && shown ? ' (current)' : ''}</span>
      </button>
      ${value ? '<button class="mini" type="button" data-clear>Use the original</button>' : ''}`;
    host.querySelector('.cm-pick-btn').addEventListener('click', () => openPicker(host));
    const clear = host.querySelector('[data-clear]');
    if (clear) clear.addEventListener('click', () => { setByPath(host.dataset.field, ''); markDirty(); render(); });
  }

  function openPicker(host) {
    pickTarget = host;
    $('pickGrid').innerHTML = IMAGES.map(src => `
      <button class="cm-tile" type="button" data-src="${esc(src)}">
        <img src="${esc(src)}" alt="" loading="lazy">
        <span>${esc(src.replace('assets/img/', '').replace('.webp', ''))}</span>
      </button>`).join('');
    $$('#pickGrid .cm-tile').forEach(b => b.addEventListener('click', () => {
      setByPath(pickTarget.dataset.field, b.dataset.src);
      markDirty();
      $('pickDlg').close();
      render();
    }));
    $('pickDlg').showModal();
    document.documentElement.classList.add('locked');
  }

  function closePicker() { $('pickDlg').close(); document.documentElement.classList.remove('locked'); }
  $('pickClose').addEventListener('click', closePicker);
  $('pickDlg').addEventListener('cancel', e => { e.preventDefault(); closePicker(); });
  $('pickDlg').addEventListener('click', e => { if (e.target === $('pickDlg')) closePicker(); });

  /* ---------------------------------------------------------
     Reading and writing nested values by path, e.g. "quote.image"
     --------------------------------------------------------- */
  function getByPath(path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), content);
  }
  function setByPath(path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    let o = content;
    parts.forEach(k => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (value === '' || value == null) delete o[last]; else o[last] = value;
  }

  /* A text box bound to a path.

     Under it goes the wording the website currently has, in grey, with a link
     that clears the box. That line does more work than it looks: it means an
     empty box is never a mystery. She can read what emptying it restores
     before she empties it, so the safest move on the page - clear it and the
     original comes back - is the one the page keeps advertising. */
  function bind(id, path, original) {
    const el = $(id);
    if (!el) return;
    el.value = getByPath(path) || '';
    el.placeholder = original || '';
    el.addEventListener('input', () => {
      setByPath(path, el.value.trim());
      markDirty();
      if (el.__drawOrigin) el.__drawOrigin();
    });

    if (!original) return;
    let line = el.parentElement.querySelector('[data-origin]');
    if (!line) {
      line = document.createElement('p');
      line.className = 'cm-origin';
      line.setAttribute('data-origin', '');
      el.parentElement.appendChild(line);
    }
    const draw = () => {
      const typed = (el.value || '').trim();
      line.innerHTML = '<span>The website says:</span> <em>' + esc(original) + '</em>' +
        (typed ? ' <button class="cm-undo" type="button">Use these words</button>' : '');
      const undo = line.querySelector('.cm-undo');
      if (undo) undo.addEventListener('click', () => {
        el.value = '';
        setByPath(path, '');
        markDirty();
        draw();
      });
    };
    el.__drawOrigin = draw;
    draw();
  }

  /* ---------------------------------------------------------
     Repeating blocks
     --------------------------------------------------------- */
  function renderHealing() {
    const host = $('cHealing');
    const saved = content.healing || [];
    const base = original.healing || [];
    const n = Math.max(base.length, saved.length, 4);
    host.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const s = saved[i] || {};
      const b = base[i] || {};
      const row = document.createElement('div');
      row.className = 'cm-item';
      row.innerHTML = `
        <p class="cm-item-n">Card ${i + 1}</p>
        <div class="f-row"><label>Title</label><input data-h="${i}" data-k="title" type="text" maxlength="80"></div>
        <div class="f-row" style="margin-top:12px"><label>Description</label><textarea data-h="${i}" data-k="text" rows="3" maxlength="600"></textarea></div>
        <div class="f-row" style="margin-top:12px"><label>Link text</label><input data-h="${i}" data-k="linkLabel" type="text" maxlength="80"></div>`;
      host.appendChild(row);
      ['title', 'text', 'linkLabel'].forEach(k => {
        const el = row.querySelector(`[data-k="${k}"]`);
        el.value = s[k] || '';
        el.placeholder = b[k] || '';
        el.addEventListener('input', () => {
          content.healing = content.healing || [];
          while (content.healing.length <= i) content.healing.push({});
          const v = el.value.trim();
          if (v) content.healing[i][k] = v; else delete content.healing[i][k];
          markDirty();
        });
      });
    }
  }

  function renderSteps() {
    const host = $('cSteps');
    const saved = (content.apothecary && content.apothecary.steps) || [];
    const base = original.steps || [];
    const n = Math.max(base.length, saved.length, 3);
    host.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const s = saved[i] || {}, b = base[i] || {};
      const row = document.createElement('div');
      row.className = 'cm-item';
      row.innerHTML = `
        <p class="cm-item-n">Step ${i + 1}</p>
        <div class="f-grid two">
          <div class="f-row"><label>Title</label><input data-s="${i}" data-k="title" type="text" maxlength="60"></div>
          <div class="f-row"><label>Description</label><textarea data-s="${i}" data-k="text" rows="2" maxlength="400"></textarea></div>
        </div>`;
      host.appendChild(row);
      ['title', 'text'].forEach(k => {
        const el = row.querySelector(`[data-k="${k}"]`);
        el.value = s[k] || '';
        el.placeholder = b[k] || '';
        el.addEventListener('input', () => {
          content.apothecary = content.apothecary || {};
          content.apothecary.steps = content.apothecary.steps || [];
          while (content.apothecary.steps.length <= i) content.apothecary.steps.push({});
          const v = el.value.trim();
          if (v) content.apothecary.steps[i][k] = v; else delete content.apothecary.steps[i][k];
          markDirty();
        });
      });
    }
  }

  function products() {
    content.apothecary = content.apothecary || {};
    if (!Array.isArray(content.apothecary.products)) content.apothecary.products = [];
    return content.apothecary.products;
  }

  function renderProducts() {
    const host = $('cProducts');
    const list = products();

    if (!list.length) {
      host.innerHTML = `<div class="state" style="padding:24px">
        <p>The website is showing the ${(original.products || []).length} products written into it.
        Add one here and this list takes over completely, so add all of them, not just the new one.</p>
        <button class="mini" type="button" id="cCopyProducts">Start from the ones already on the site</button>
      </div>`;
      const copy = $('cCopyProducts');
      if (copy) copy.addEventListener('click', () => {
        (original.products || []).forEach((p, i) => products().push({
          id: 'p' + Date.now() + i, title: p.title, text: p.text, image: p.image,
          published: true, order: (i + 1) * 10
        }));
        markDirty(); render();
      });
      return;
    }

    host.innerHTML = '';
    list.slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)).forEach((p, idx, arr) => {
      const row = document.createElement('div');
      row.className = 'cm-item' + (p.published === false ? ' is-hidden' : '');
      row.innerHTML = `
        <div class="cm-prod">
          <div class="cm-pick" data-prod-img="${esc(p.id)}"></div>
          <div class="cm-prod-main">
            <div class="f-row"><label>Name</label><input data-p="${esc(p.id)}" data-k="title" type="text" maxlength="80"></div>
            <div class="f-row" style="margin-top:12px"><label>One line about it</label><input data-p="${esc(p.id)}" data-k="text" type="text" maxlength="200"></div>
          </div>
          <div class="cm-prod-acts">
            <button class="mini" type="button" data-move="up" data-id="${esc(p.id)}" ${idx === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
            <button class="mini" type="button" data-move="down" data-id="${esc(p.id)}" ${idx === arr.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
            <button class="mini" type="button" data-toggle="${esc(p.id)}">${p.published === false ? 'Show' : 'Hide'}</button>
            <button class="mini mini-danger" type="button" data-del="${esc(p.id)}">Remove</button>
          </div>
        </div>`;
      host.appendChild(row);

      pickerButtonForProduct(row.querySelector('[data-prod-img]'), p);

      ['title', 'text'].forEach(k => {
        const el = row.querySelector(`[data-k="${k}"]`);
        el.value = p[k] || '';
        el.addEventListener('input', () => { p[k] = el.value.trim(); markDirty(); });
      });
    });

    $$('[data-move]', host).forEach(b => b.addEventListener('click', () => {
      const list2 = products().slice().sort((a, b2) => (Number(a.order) || 0) - (Number(b2.order) || 0));
      const i = list2.findIndex(x => x.id === b.dataset.id);
      const j = b.dataset.move === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= list2.length) return;
      const a = list2[i].order, c = list2[j].order;
      list2[i].order = c; list2[j].order = a;
      markDirty(); render();
    }));
    $$('[data-toggle]', host).forEach(b => b.addEventListener('click', () => {
      const p = products().find(x => x.id === b.dataset.toggle);
      if (p) { p.published = p.published === false; markDirty(); render(); }
    }));
    $$('[data-del]', host).forEach(b => b.addEventListener('click', () => {
      const p = products().find(x => x.id === b.dataset.del);
      if (!p) return;
      if (!confirm(`Remove "${p.title || 'this product'}" from the website?`)) return;
      content.apothecary.products = products().filter(x => x.id !== b.dataset.del);
      markDirty(); render();
    }));
  }

  function pickerButtonForProduct(host, p) {
    host.innerHTML = `
      <button class="cm-pick-btn" type="button">
        ${p.image ? `<img src="${esc(p.image)}" alt="">` : '<span class="cm-pick-none">No picture</span>'}
      </button>`;
    host.querySelector('button').addEventListener('click', () => {
      $('pickGrid').innerHTML = IMAGES.map(src => `
        <button class="cm-tile" type="button" data-src="${esc(src)}">
          <img src="${esc(src)}" alt="" loading="lazy">
          <span>${esc(src.replace('assets/img/', '').replace('.webp', ''))}</span>
        </button>`).join('');
      $$('#pickGrid .cm-tile').forEach(b => b.addEventListener('click', () => {
        p.image = b.dataset.src; markDirty(); $('pickDlg').close(); render();
      }));
      $('pickDlg').showModal();
      document.documentElement.classList.add('locked');
    });
  }

  $('cAddProduct').addEventListener('click', () => {
    const list = products();
    const max = list.reduce((m, p) => Math.max(m, Number(p.order) || 0), 0);
    list.push({ id: 'p' + Date.now(), title: '', text: '', image: '', published: true, order: max + 10 });
    markDirty(); render();
    const inputs = $$('#cProducts input[data-k="title"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  /* ---------------------------------------------------------
     The film link: say what will happen before it happens
     --------------------------------------------------------- */
  function describeFilm() {
    const url = ($('cFilmUrl').value || '').trim();
    const err = document.querySelector('[data-err="film"]');
    const what = $('cFilmWhat');
    err.hidden = true;

    if (!url) {
      what.textContent = 'Empty: the video already on the site keeps playing.';
      return;
    }
    if (/(?:youtube\.com|youtu\.be)/i.test(url)) {
      const ok = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.test(url);
      what.textContent = ok ? 'A YouTube film. It will play on the front page.' : '';
      if (!ok) { err.textContent = 'That looks like a YouTube address but no video id in it.'; err.hidden = false; }
      return;
    }
    if (/vimeo\.com/i.test(url)) {
      const ok = /vimeo\.com\/(?:video\/)?(\d{6,})/.test(url);
      what.textContent = ok ? 'A Vimeo film. It will play on the front page.' : '';
      if (!ok) { err.textContent = 'That looks like a Vimeo address but no video number in it.'; err.hidden = false; }
      return;
    }
    let scheme = '';
    try { scheme = new URL(url, location.href).protocol; } catch (e) { scheme = ''; }
    if (scheme !== 'https:' && scheme !== 'http:') {
      err.textContent = 'That is not a web address. Paste a link beginning https://';
      err.hidden = false;
      what.textContent = '';
      return;
    }
    what.textContent = 'A video file. It will be played by the page itself.';
  }

  /* ---------------------------------------------------------
     Render everything from `content`
     --------------------------------------------------------- */
  function render() {
    bind('cHeroSub', 'hero.sub', original.heroSub);
    bind('cQuoteText', 'quote.text', original.quoteText);
    bind('cQuoteAttrib', 'quote.attrib', original.quoteAttrib);
    bind('cAboutCreds', 'about.creds', original.aboutCreds);
    bind('cAboutLead', 'about.lead', original.aboutLead);
    bind('cAboutMuted', 'about.muted', original.aboutMuted);
    bind('cFilmUrl', 'film.url', '');
    bind('cFilmHeading', 'film.heading', original.filmHeading);

    const cfg = (window.SSA_CONFIG && window.SSA_CONFIG.school) || {};
    const show = $('cContactShow');
    if (show) {
      show.innerHTML = `
        <p><strong>Phone / WhatsApp</strong><span>${esc(cfg.phone || '')}</span></p>
        <p><strong>Email</strong><span>${esc(cfg.email || '')}</span></p>
        <p><strong>Where</strong><span>${esc(cfg.city || '')}</span></p>`;
    }

    pickerButton($('cQuoteImage'), getByPath('quote.image'), original.quoteImage);
    pickerButton($('cFilmPoster'), getByPath('film.poster'), original.filmPoster);

    const pub = $('cFilmPublished');
    pub.checked = !(content.film && content.film.published === false);

    renderHealing();
    renderSteps();
    renderProducts();
    describeFilm();
  }

  $('cFilmUrl').addEventListener('input', describeFilm);
  $('cFilmPublished').addEventListener('change', () => {
    content.film = content.film || {};
    if ($('cFilmPublished').checked) delete content.film.published;
    else content.film.published = false;
    markDirty();
  });

  /* "Put the original back" is simply forgetting what was saved for that
     section. The website then reads what index.html says, which is where the
     wording came from in the first place. */
  $$('[data-reset]').forEach(b => b.addEventListener('click', () => {
    const sec = b.dataset.reset;
    const label = b.closest('.cm-sec').querySelector('h2').textContent.trim();
    if (!confirm(`Put the original wording back for "${label}"?\n\nAnything you have typed in this section is forgotten, and the website shows what it said before.`)) return;
    delete content[sec];
    markDirty();
    render();
    toast('Original wording restored. Press Save to make it live.');
  }));

  /* ---------------------------------------------------------
     Save
     --------------------------------------------------------- */
  function tidy(obj) {
    /* Firestore rejects undefined, and an empty object is just noise in a
       document every visitor downloads. */
    const out = {};
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) { if (v.length) out[k] = v.map(x => (x && typeof x === 'object') ? tidy(x) : x); return; }
      if (typeof v === 'object') { const t = tidy(v); if (Object.keys(t).length) out[k] = t; return; }
      out[k] = v;
    });
    return out;
  }

  $('cSave').addEventListener('click', async () => {
    const btn = $('cSave');
    const bad = $$('.f-err:not([hidden])');
    if (bad.length) return toast('Please fix the highlighted box first.', true);

    btn.disabled = true;
    try {
      const payload = tidy(content);
      await window.SSA.content.save(payload);
      content = payload;
      markClean('Saved. The website is showing it now.');
      toast('Saved.');
      render();
    } catch (e) {
      toast(e.message || 'Could not save.', true);
    } finally {
      btn.disabled = false;
    }
  });

  addEventListener('beforeunload', e => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function gate(user) {
    $('booting').hidden = true;
    const admin = window.SSA.auth.isAdmin();
    $('gateSignIn').hidden = !!user;
    $('gateDenied').hidden = !user || admin;
    $('contentApp').hidden = !user || !admin;
    if (user && !admin) {
      $('gateDeniedWho').textContent =
        `You're signed in as ${user.email}, which isn't the school's account.`;
    }
    if (user && admin) load();
  }

  async function load() {
    try {
      content = (await window.SSA.content.get()) || {};
      delete content.updatedAt;
    } catch (e) {
      content = {};
      const host = $('loadProblem');
      if (host) {
        host.hidden = false;
        host.innerHTML = `<div class="demo-bar"><span><strong>Could not read the saved wording.</strong>
          ${esc(e.message || '')} The website is unaffected and is showing what it always said.</span></div>`;
      }
    }
    render();
    markClean('Nothing changed yet.');
  }

  async function boot() {
    await window.SSA.ready;

    if (window.SSA.isDemo) {
      $('demoBar').innerHTML = `
        <div class="demo-bar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
          <span><strong>Demo mode.</strong> Anything saved here stays in this browser and does not
          reach the website.</span>
        </div>`;
    }

    await loadOriginal();
    window.SSA_Auth.mountHeader($('acctHost'));
    window.SSA.auth.onChange(gate);
    $('gateSignInBtn').addEventListener('click', () => window.SSA_Auth.open('signin'));
  }

  boot();
})();
