/* =========================================================
   School for Self Ascension — scroll engine (vanilla, no libraries)
   One rAF loop owns every scroll-driven effect.
   ========================================================= */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- elements ---------- */
  const hdr = $('#hdr');
  const progress = $('#progress');
  const hero = $('#hero');
  const heroPin = $('.hero-pin');
  const heroFrame = $('#heroFrame');
  const heroImg = $('#heroImg');
  const heroCaption = $('#heroCaption');
  const heroWordL = $('.hw-l');
  const heroWordR = $('.hw-r');
  const heroFaders = [$('#heroSub'), $('#heroCue')].filter(Boolean);
  const marquee = $('#marquee');
  const fillEl = $('#fill');
  const healing = $('#healing');
  const cards = $$('.stack-card');
  const band = $('#band');
  const bandImg = $('#bandImg');
  const rail = $('#rail');
  const railFill = $('#railFill');
  const railItems = $$('.rail-item');
  const trainings = $('#trainings');
  const trPinEl = $('.tr-pin');
  const trTrack = $('#trTrack');
  /* Re-queried by rescan() when the activities are re-rendered from the
     admin's data, so these never point at cards that have been replaced. */
  let trCards = $$('.tr-card');
  let trImgs = trCards.map(c => $('.tr-media img', c));
  const trBar = $('#trBar');
  const trCount = $('#trCount');
  const trHint = $('.tr-hint');
  let jrs = $$('.jr').map(el => ({ el, portal: $('.jr-portal', el), img: $('.jr-portal img', el), word: $('.jr-word', el) }));
  const wipe = $('#wipe');
  const wipeImg = $('#wipe img');
  const apo = $('#apo');
  const apoFrame = $('#apoFrame');
  const apoImgs = $$('.apo-img');
  const apoSteps = $$('.apo-step');
  const apoCount = $('#apoCount');
  const apoBar = $('#apoBar');
  const filmSeat = $('.film-seat');
  const filmFrame = $('#filmFrame');
  const contact = $('#contact');
  const contactImg = $('#contactImg');
  const foot = $('#foot');
  const wordmark = $('#wordmark');
  const spyLinks = $$('[data-spy]');
  const spySections = spyLinks.map(a => document.getElementById(a.dataset.spy));

  /* ---------- measurements ---------- */
  const M = {};
  function measure() {
    M.vw = document.documentElement.clientWidth;
    M.vh = innerHeight;
    M.pinH = heroPin.clientHeight || M.vh;
    M.small = M.vw < 900;
    M.mobile = M.vw < 860;
    M.hdr = M.mobile ? 64 : 76;

    // Hero arch geometry (in pin-stage pixels)
    hero.classList.toggle('is-small', M.small);
    const H = M.pinH;
    let w, h, x, y;
    if (!M.small) {
      w = Math.max(240, Math.min(M.vw * 0.26, 420));
      h = Math.min(H * 0.64, w * 1.5);
      x = (M.vw - w) / 2;
      y = (H - h) / 2 + H * 0.04;
    } else {
      const titleB = heroWordR.offsetTop + heroWordR.offsetHeight + 24;
      w = Math.min(M.vw * 0.72, 380);
      h = Math.max(160, Math.min(H - titleB - H * 0.1, w * 1.55));
      x = (M.vw - w) / 2;
      y = titleB + Math.max(0, (H - titleB - h - H * 0.06) / 2);
    }
    Object.assign(M, { aw: w, ah: h, ax: x, ay: y });
    hero.style.setProperty('--aw', w + 'px');
    if (RM) hero.style.height = M.pinH + 'px';   // no pinned runway without motion
    M.heroTop = hero.offsetTop;
    M.heroLen = Math.max(1, hero.offsetHeight - M.pinH);

    // Marquee loop width (content repeated 3×)
    M.mqThird = marquee.scrollWidth / 3;

    // Teacher trainings: pinned horizontal pan on desktop, native swipe on phones / reduced motion
    M.trPin = !!trainings && !M.mobile && !RM;
    if (trainings) {
      trainings.classList.toggle('is-pinned', M.trPin);
      trainings.style.height = '';
      if (M.trPin) {
        M.trOver = Math.max(0, trTrack.scrollWidth - M.vw);
        trainings.style.height = (trPinEl.offsetHeight + M.trOver) + 'px';
      } else {
        M.trOver = 0;
        trTrack.style.transform = '';
        trCards.forEach(c => { c.style.transform = ''; });
      }
      trHint.innerHTML = (M.trPin ? 'Scroll' : 'Swipe') + ' to explore <b>→</b>';
    }

    spySections.forEach((s, i) => { M['spy' + i] = s ? s.offsetTop : 0; });
    M.docLen = Math.max(1, document.documentElement.scrollHeight - M.vh);
  }

  /* ---------- split text: word fill ---------- */
  const fillWords = [];
  (function split(node, acc) {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(tk => {
          if (!tk) return;
          if (/^\s+$/.test(tk)) { frag.appendChild(document.createTextNode(' ')); return; }
          const s = document.createElement('span');
          s.className = 'fw' + (acc ? ' acc' : '');
          s.textContent = tk;
          fillWords.push(s);
          frag.appendChild(s);
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1) {
        split(n, acc || n.tagName === 'EM');
      }
    });
  })(fillEl, false);
  let litCount = -1;

  /* ---------- split text: headline mask reveal ----------
     Safe to call again after new content is rendered: anything already split
     contains a .swm mask and is skipped. */
  function splitHeadlines() {
  $$('.split').forEach(el => {
    if (el.querySelector('.swm')) return;
    const parts = [];
    el.childNodes.forEach(n => {
      if (n.nodeType === 3) {
        n.textContent.split(/\s+/).filter(Boolean).forEach(t => parts.push({ t }));
      } else if (n.nodeType === 1) {
        // keep inline elements (em) but split them word-by-word so long phrases can wrap
        n.textContent.split(/\s+/).filter(Boolean).forEach(t => parts.push({ t, tag: n.tagName.toLowerCase() }));
      }
    });
    el.textContent = '';
    parts.forEach((pt, i) => {
      const mask = document.createElement('span');
      mask.className = 'swm';
      const inner = document.createElement('span');
      inner.className = 'sw';
      inner.style.transitionDelay = (i * 0.06) + 's';
      if (pt.tag) {
        const e = document.createElement(pt.tag);
        e.textContent = pt.t;
        inner.appendChild(e);
      } else {
        inner.textContent = pt.t;
      }
      mask.appendChild(inner);
      el.appendChild(mask);
      if (i < parts.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });
  }
  splitHeadlines();

  /* ---------- marquee: repeat content 3× ---------- */
  marquee.innerHTML = marquee.innerHTML.repeat(3);

  /* ---------- footer wordmark letters ---------- */
  wordmark.innerHTML = [...wordmark.textContent].map(c => `<span>${c}</span>`).join('');

  /* ---------- triggered reveals ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.25, rootMargin: '0px 0px -5% 0px' });

  /* Re-running this is harmless: observing the same element twice is a no-op,
     and anything already revealed carries .in and is skipped. */
  function observeReveals() {
    $$('.split, .reveal').forEach(el => {
      if (el.classList.contains('in')) return;
      if (el.classList.contains('reveal')) {
        const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
        el.style.transitionDelay = (sibs.indexOf(el) % 3) * 0.08 + 's';
      }
      RM ? el.classList.add('in') : io.observe(el);
    });
  }
  observeReveals();

  /* =========================================================
     Per-frame update
     ========================================================= */
  let lastY = scrollY;
  let vel = 0, skew = 0, mqX = 0;
  let hdrHidden = false;

  function update(sy, dt) {
    const vh = M.vh;
    const d = sy - lastY;

    /* progress + header */
    progress.style.transform = `scaleX(${clamp01(sy / M.docLen)})`;
    hdr.classList.toggle('scrolled', sy > 10);
    if (!document.body.classList.contains('menu-open')) {
      if (d > 6 && sy > vh * 1.2 && !hdrHidden) { hdrHidden = true; hdr.classList.add('hide'); }
      else if ((d < -6 || sy < vh) && hdrHidden) { hdrHidden = false; hdr.classList.remove('hide'); }
    }

    /* ---- HERO: arch → full bleed ---- */
    if (sy < M.heroTop + M.heroLen + vh) {
      const p = RM ? 1 : clamp01((sy - M.heroTop) / M.heroLen);
      const z = clamp01((p - 0.05) / 0.7);
      const e = easeInOut(z);
      const { vw, aw, ah, ax, ay, pinH } = M;
      const t = lerp(ay, 0, e);
      const l = lerp(ax, 0, e);
      const r = lerp(vw - ax - aw, 0, e);
      const b = lerp(pinH - ay - ah, 0, e);
      const rad = lerp(aw / 2, 0, e);
      const rb = lerp(16, 0, e);
      heroFrame.style.clipPath = `inset(${t}px ${r}px ${b}px ${l}px round ${rad}px ${rad}px ${rb}px ${rb}px)`;
      heroImg.style.transform = `scale(${lerp(1.35, 1, e) + 0.06 * clamp01((p - 0.8) / 0.2)})`;

      const fade = clamp01(z / 0.45);
      if (!M.small) {
        heroWordL.style.transform = `translate(${-fade * vw * 0.16}px, -50%)`;
        heroWordR.style.transform = `translate(${fade * vw * 0.16}px, -50%)`;
      } else {
        heroWordL.style.transform = heroWordR.style.transform = `translateY(${-fade * 50}px)`;
      }
      heroWordL.style.opacity = heroWordR.style.opacity = 1 - fade;
      const f2 = 1 - clamp01(p / 0.14);
      heroFaders.forEach(el => { el.style.opacity = f2; });

      const c = clamp01((p - 0.72) / 0.16);
      heroCaption.style.opacity = c;
      heroCaption.style.transform = `translateY(${(1 - c) * 30}px)`;
      heroFrame.style.setProperty('--shade', c.toFixed(3));
    }

    /* ---- marquee (velocity) ---- */
    vel = lerp(vel, Math.max(-60, Math.min(60, d)), 0.2);
    if (!RM && M.mqThird) {
      skew = lerp(skew, Math.max(-10, Math.min(10, vel * 0.35)), 0.12);
      mqX -= dt * 50 + Math.abs(vel) * 0.35;
      if (-mqX > M.mqThird) mqX += M.mqThird;
      marquee.style.transform = `translate3d(${mqX}px,0,0) skewX(${skew}deg)`;
    }

    /* ---- manifesto word fill ----
       Class states with CSS transitions are kept in sync even off-screen;
       otherwise a stale state fades visibly when the section scrolls back in. */
    {
      const r = fillEl.getBoundingClientRect();
      const p = RM ? 1 : clamp01((vh * 0.8 - r.top) / (r.height + vh * 0.25));
      const n = Math.round(p * fillWords.length);
      if (n !== litCount) {
        litCount = n;
        fillWords.forEach((w, i) => w.classList.toggle('lit', i < n));
      }
    }

    /* ---- stacked cards ---- */
    {
      const hr = healing.getBoundingClientRect();
      if (hr.top < vh && hr.bottom > 0) {
        cards.forEach((card, i) => {
          const img = card.querySelector('img');
          const cr = card.getBoundingClientRect();
          const en = RM ? 1 : easeOut(clamp01((vh - cr.top) / (vh * 0.85)));
          img.style.transform = `scale(${lerp(1.2, 1, en)})`;
          if (i === cards.length - 1 || RM) return;
          const nt = cards[i + 1].getBoundingClientRect().top;
          const stickyTop = M.hdr + (M.mobile ? 10 + i * 12 : 16 + i * 18);
          const cover = clamp01(1 - (nt - stickyTop) / (vh * 0.75));
          card.style.transform = `scale(${1 - cover * 0.06})`;
          card.style.setProperty('--veil', (cover * 0.3).toFixed(3));
        });
      }
    }

    /* ---- lotus band parallax ---- */
    {
      const r = band.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        const p = clamp01((vh - r.top) / (vh + r.height));
        bandImg.style.transform = RM ? 'none' : `translate3d(0, ${lerp(-9, 9, p)}%, 0) scale(${lerp(1.12, 1, p)})`;
      }
    }

    /* ---- journey rail draw ---- */
    {
      const r = rail.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        const p = RM ? 1 : clamp01((vh * 0.6 - r.top) / r.height);
        railFill.style.transform = `scaleY(${p})`;
      }
      railItems.forEach(it => it.classList.toggle('hit', RM || it.getBoundingClientRect().top < vh * 0.62));
    }

    /* ---- teacher trainings: vertical scroll pans the row ---- */
    if (trainings) {
      const r = trainings.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        let p;
        if (M.trPin) {
          p = clamp01(-r.top / (M.trOver || 1));
          trTrack.style.transform = `translate3d(${(-p * M.trOver).toFixed(1)}px,0,0)`;
        } else {
          const max = trTrack.scrollWidth - trTrack.clientWidth;
          p = max > 0 ? clamp01(trTrack.scrollLeft / max) : 0;
        }
        const half = M.vw / 2;
        trCards.forEach((card, i) => {
          const cr = card.getBoundingClientRect();
          const c = Math.max(-1.2, Math.min(1.2, (cr.left + cr.width / 2 - half) / half));
          if (!RM) trImgs[i].style.transform = `translate3d(${(c * -7).toFixed(2)}%,0,0) scale(1.18)`;
          if (M.trPin) card.style.transform = `translateY(${(Math.abs(c) * 16).toFixed(1)}px) scale(${(1 - Math.abs(c) * 0.03).toFixed(4)})`;
        });
        trBar.style.transform = `scaleX(${p})`;
        trCount.textContent = String(1 + Math.round(p * (trCards.length - 1))).padStart(2, '0');
      }
    }

    /* ---- sound course image wipe ---- */
    {
      const r = wipe.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        const e = RM ? 1 : easeOut(clamp01((vh * 0.92 - r.top) / (vh * 0.6)));
        wipe.style.clipPath = `inset(0 ${(1 - e) * 100}% 0 0 round 24px)`;
        wipeImg.style.transform = `scale(${lerp(1.25, 1, e)})`;
      }
    }

    /* ---- sacred journeys: portal opens, image drifts ---- */
    jrs.forEach(j => {
      const r = j.el.getBoundingClientRect();
      if (r.top > vh || r.bottom < 0) return;
      const pr = j.portal.getBoundingClientRect();
      const e = RM ? 1 : easeOut(clamp01((vh * 0.95 - pr.top) / (vh * 0.75)));
      const rad = lerp(pr.height * 0.4, 24, e);
      j.portal.style.clipPath = `inset(${lerp(10, 0, e).toFixed(2)}% ${lerp(18, 0, e).toFixed(2)}% round ${rad.toFixed(1)}px)`;
      if (RM) return;
      const p = clamp01((vh - r.top) / (vh + r.height));
      j.img.style.transform = `translate3d(0, ${lerp(-5, 5, p).toFixed(2)}%, 0) scale(${lerp(1.3, 1.06, e).toFixed(4)})`;
      j.word.style.transform = `translate3d(${lerp(14, -14, p).toFixed(2)}%, 0, 0)`;
    });

    /* ---- apothecary: images change with scroll ---- */
    {
      const line = M.mobile ? vh * 0.72 : vh * 0.5;
      const centers = apoSteps.map(s => { const r = s.getBoundingClientRect(); return r.top + r.height / 2; });
      const n = centers.length;
      let t;
      if (line <= centers[0]) t = 0;
      else if (line >= centers[n - 1]) t = n - 1;
      else {
        let i = 0;
        while (i < n - 2 && line > centers[i + 1]) i++;
        t = i + (line - centers[i]) / (centers[i + 1] - centers[i]);
      }
      if (RM) t = Math.round(t);
      const active = Math.round(t);
      apoSteps.forEach((s, i) => s.classList.toggle('active', i === active));
      const ar = apo.getBoundingClientRect();
      if (ar.top < vh && ar.bottom > 0) {
        const fr = apoFrame.getBoundingClientRect();
        const ent = RM ? 1 : easeOut(clamp01((vh - fr.top) / vh));
        apoImgs.forEach((img, i) => {
          if (i === 0) {
            img.style.transform = `scale(${lerp(1.15, 1, ent) + clamp01(t) * 0.04})`;
            return;
          }
          const local = clamp01(t - (i - 1));
          const rev = easeInOut(clamp01((local - 0.15) / 0.7));
          img.style.clipPath = `inset(${(1 - rev) * 100}% 0 0 0)`;
          img.style.transform = `scale(${lerp(1.18, 1, rev) + clamp01(t - i) * 0.04})`;
        });
        apoCount.textContent = String(active + 1).padStart(2, '0');
        apoBar.style.transform = `scaleX(${t / (n - 1)})`;
      }
    }

    /* ---- film frame grows ---- */
    {
      const r = filmSeat.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        const e = RM ? 1 : easeOut(clamp01((vh - r.top) / (vh * 0.9)));
        filmFrame.style.transform = `scale(${lerp(0.78, 1, e)})`;
      }
    }

    /* ---- contact background parallax ---- */
    {
      const r = contact.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        const p = clamp01((vh - r.top) / (vh + r.height));
        contactImg.style.transform = RM ? 'none' : `translate3d(0, ${lerp(-8, 8, p)}%, 0)`;
      }
    }

    /* ---- footer wordmark rise ---- */
    {
      const r = foot.getBoundingClientRect();
      if (r.top < vh) {
        const p = RM ? 1 : clamp01((vh - r.top) / r.height);
        wordmark.style.transform = `translateY(${(1 - p) * 40}%)`;
        wordmark.style.opacity = 0.2 + p * 0.8;
      }
    }

    /* ---- scrollspy ---- */
    let cur = -1;
    spySections.forEach((s, i) => { if (s && sy + vh * 0.4 >= M['spy' + i]) cur = i; });
    if (cur >= 0 && sy > M['spy' + cur] + spySections[cur].offsetHeight - vh * 0.4) cur = -1;
    spyLinks.forEach((a, i) => a.classList.toggle('active', i === cur));

    lastY = sy;
  }

  /* ---------- loop ---------- */
  let prev = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    /* One bad frame must never kill the loop and leave the page frozen
       mid-animation. Log it once and keep going. */
    try { update(scrollY, dt); }
    catch (e) {
      if (!loop.warned) { loop.warned = true; console.error('[SSA] scroll update failed:', e); }
    }
    requestAnimationFrame(loop);
  }

  let lastW = innerWidth, lastH = innerHeight;
  addEventListener('resize', () => {
    // On phones the address bar showing/hiding fires resize mid-scroll; only
    // re-measure for real changes (rotation, keyboard, window resize).
    const dw = innerWidth !== lastW, dh = Math.abs(innerHeight - lastH) > 160;
    if (M.mobile && !dw && !dh) return;
    lastW = innerWidth; lastH = innerHeight;
    measure(); update(scrollY, 0);
  }, { passive: true });
  addEventListener('load', measure);
  measure();
  update(scrollY, 0);
  requestAnimationFrame(loop);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* Called after the activity sections are re-rendered from the admin's data.
     Re-points every cached element reference at the new DOM, re-runs the
     headline/word splitting and reveal observers for anything new, and
     re-measures the pinned gallery's scroll runway — which depends on the
     track's width and so must be recomputed whenever the cards change. */
  function rescan() {
    trCards = $$('.tr-card');
    trImgs = trCards.map(c => $('.tr-media img', c));
    jrs = $$('.jr').map(el => ({ el, portal: $('.jr-portal', el), img: $('.jr-portal img', el), word: $('.jr-word', el) }));
    splitHeadlines();
    observeReveals();
    measure();
    update(scrollY, 0);
  }

  window.__fx = { update, measure, M, rescan };

  /* =========================================================
     Intro curtain
     ========================================================= */
  const curtain = $('#curtain');
  if (RM) {
    curtain.remove();
  } else {
    const lift = () => {
      curtain.classList.add('up');
      setTimeout(() => curtain.remove(), 1200);
    };
    Promise.race([
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => new Promise(r => setTimeout(r, 700))),
      new Promise(r => setTimeout(r, 1600))
    ]).then(lift);
  }

  /* =========================================================
     Mobile menu
     ========================================================= */
  const burger = $('#burger');
  const nav = $('#nav');
  const setMenu = open => {
    if (nav.classList.contains('open') === open) return;   // no-op (e.g. Esc while a dialog is open)
    if (open) { hdr.classList.remove('hide'); hdrHidden = false; }
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
    document.documentElement.classList.toggle('locked', open);
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  $('#year').textContent = new Date().getFullYear();

  /* =========================================================
     Contact: WhatsApp / email hand-off
     ========================================================= */
  const WA_NUMBER = '919962036811';
  const EMAIL = 'archangelg9@gmail.com';
  const waLink = msg => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  $$('.wa-link[data-wa]').forEach(a => { a.href = waLink(a.dataset.wa); });

  const interest = $('#interest');
  const setInterest = v => {
    const opt = [...interest.options].find(o => o.text === v);
    if (opt) interest.value = opt.value;
  };
  $$('[data-interest]').forEach(a => a.addEventListener('click', () => setInterest(a.dataset.interest)));

  const form = $('#form');
  const note = $('#formNote');
  const setNote = (before, linkText, href) => {
    note.textContent = before;
    const a = document.createElement('a');
    a.href = href;
    a.textContent = linkText;
    if (href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; }
    note.append(a, '.');
  };
  form.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    ['name', 'contact'].forEach(k => {
      const f = form.elements[k];
      const bad = !f.value.trim();
      f.classList.toggle('invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { note.textContent = 'Please add your name and a way to reach you.'; return; }

    const f = form.elements;
    const topic = f.interest.value;
    const msg = f.message.value.trim();
    const text = `Hello Manjula, my name is ${f.name.value.trim()}.\nI'm interested in: ${topic}.` +
      (msg ? `\n\n${msg}` : '') + `\n\nYou can reach me at: ${f.contact.value.trim()}`;

    if (e.submitter && e.submitter.value === 'email') {
      location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Enquiry: ' + topic)}&body=${encodeURIComponent(text)}`;
      setNote('Your email app should open with the message ready. If it doesn\'t, write to ', EMAIL, `mailto:${EMAIL}`);
    } else {
      window.open(waLink(text), '_blank', 'noopener');
      setNote('WhatsApp should open with your message ready to send. If it doesn\'t, message ', '+91 99620 36811', waLink(text));
    }
  });

  /* =========================================================
     Teacher training details dialog
     ========================================================= */
  const dlg = $('#dlg');
  if (dlg) {
    const dlgBody = $('#dlgBody');
    const dlgImg = $('#dlgImg');
    const dlgWa = $('#dlgWa');
    const dlgReg = $('#dlgReg');
    let dlgTitle = '', lastFocus = null;
    const openProgramme = card => {
      if (typeof dlg.showModal !== 'function') { setInterest(card.dataset.title); location.hash = '#contact'; return; }
      lastFocus = document.activeElement;
      dlgTitle = card.dataset.title;
      dlgBody.innerHTML = $('.tr-detail', card).innerHTML;
      const h = $('h3', dlgBody);
      if (h) h.id = 'dlgTitle';
      /* site-activities.js leaves a hidden marker in each card carrying that
         activity's registration link. Promote it to the primary action, and
         fall back to the WhatsApp button when a training isn't taking names. */
      const marker = $('[data-reg-link]', dlgBody);
      const regHref = marker ? marker.dataset.href : '';
      if (marker) marker.remove();
      if (dlgReg) {
        const closed = marker ? marker.hasAttribute('data-closed') : false;
        dlgReg.hidden = !regHref;
        if (regHref) dlgReg.href = regHref;
        dlgReg.textContent = closed ? 'Ask about the next one' : 'Register for this training';
        dlgWa.classList.toggle('btn-gold', !regHref);
        dlgWa.classList.toggle('btn-ghost', !!regHref);
      }
      const img = $('img', card);
      dlgImg.src = img.currentSrc || img.src;
      dlgWa.href = waLink(`Hello Manjula, I'd like to know more about the ${dlgTitle}.`);
      $('.dlg-inner', dlg).scrollTop = 0;
      dlg.showModal();
      document.documentElement.classList.add('locked');
    };
    dlg.addEventListener('close', () => {
      document.documentElement.classList.remove('locked');
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    });
    $('#dlgClose').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); dlg.close(); } });
    $('#dlgForm').addEventListener('click', e => {
      e.preventDefault();
      setInterest(dlgTitle);
      lastFocus = null;
      dlg.close();
      $('#contact').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
      form.elements.name.focus({ preventScroll: true });
    });
    /* Delegated, so cards rendered later from the admin's data open their
       details without needing new listeners wired to them. */
    const track = $('#trTrack');
    if (track) track.addEventListener('click', e => {
      const card = e.target.closest('.tr-card');
      if (card && track.contains(card)) openProgramme(card);
    });
  }

  /* =========================================================
     Film
     ========================================================= */
  const video = $('#filmVideo');
  const playBtn = $('#filmPlay');
  const playLabel = $('#filmLabel');
  let videoMissing = false;
  const source = video.querySelector('source');
  if (source) source.addEventListener('error', () => { videoMissing = true; playLabel.textContent = 'Film coming soon'; });
  playBtn.addEventListener('click', () => {
    if (videoMissing) return;
    video.play().then(() => {
      filmFrame.classList.add('playing');
      video.controls = true;
    }).catch(() => { playLabel.textContent = 'Film coming soon'; });
  });
  video.addEventListener('ended', () => { filmFrame.classList.remove('playing'); video.controls = false; });

  /* =========================================================
     Micro-interactions (precise pointers only)
     ========================================================= */
  if (FINE && !RM) {
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transition = 'transform .15s';
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .6s cubic-bezier(.34,1.56,.64,1), background .35s, color .35s';
        el.style.transform = '';
      });
    });

    $$('.tilt').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }
})();
