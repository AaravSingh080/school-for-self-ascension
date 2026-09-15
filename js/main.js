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
  const heroFaders = [$('.hero-eyebrow'), $('#heroSub'), $('#heroCue')];
  const marquee = $('#marquee');
  const fillEl = $('#fill');
  const healing = $('#healing');
  const cards = $$('.stack-card');
  const band = $('#band');
  const bandImg = $('#bandImg');
  const rail = $('#rail');
  const railFill = $('#railFill');
  const railItems = $$('.rail-item');
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
    M.docLen = Math.max(1, document.documentElement.scrollHeight - M.vh);

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
    M.heroTop = hero.offsetTop;
    M.heroLen = Math.max(1, hero.offsetHeight - M.pinH);

    // Marquee loop width (content repeated 3×)
    M.mqThird = marquee.scrollWidth / 3;

    spySections.forEach((s, i) => { M['spy' + i] = s ? s.offsetTop : 0; });
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

  /* ---------- split text: headline mask reveal ---------- */
  $$('.split').forEach(el => {
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
  $$('.split, .reveal').forEach(el => {
    if (el.classList.contains('reveal')) {
      const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
      el.style.transitionDelay = (sibs.indexOf(el) % 3) * 0.08 + 's';
    }
    RM ? el.classList.add('in') : io.observe(el);
  });

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

    /* ---- manifesto word fill ---- */
    {
      const r = fillEl.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0 || litCount < 0) {
        const p = RM ? 1 : clamp01((vh * 0.8 - r.top) / (r.height + vh * 0.25));
        const n = Math.round(p * fillWords.length);
        if (n !== litCount) {
          litCount = n;
          fillWords.forEach((w, i) => w.classList.toggle('lit', i < n));
        }
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
        railItems.forEach(it => it.classList.toggle('hit', RM || it.getBoundingClientRect().top < vh * 0.62));
      }
    }

    /* ---- workshop image wipe ---- */
    {
      const r = wipe.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        const e = RM ? 1 : easeOut(clamp01((vh * 0.92 - r.top) / (vh * 0.6)));
        wipe.style.clipPath = `inset(0 ${(1 - e) * 100}% 0 0 round 24px)`;
        wipeImg.style.transform = `scale(${lerp(1.25, 1, e)})`;
      }
    }

    /* ---- apothecary: images change with scroll ---- */
    {
      const ar = apo.getBoundingClientRect();
      if (ar.top < vh && ar.bottom > 0) {
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
        const active = Math.round(t);
        apoSteps.forEach((s, i) => s.classList.toggle('active', i === active));
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
    update(scrollY, dt);
    requestAnimationFrame(loop);
  }

  addEventListener('resize', () => { measure(); update(scrollY, 0); }, { passive: true });
  addEventListener('load', measure);
  measure();
  update(scrollY, 0);
  requestAnimationFrame(loop);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  window.__fx = { update, measure, M };

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
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
    document.body.classList.toggle('locked', open);
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* =========================================================
     Enquiry links pre-fill the form
     ========================================================= */
  const interest = $('#interest');
  $$('[data-interest]').forEach(a => a.addEventListener('click', () => {
    const v = a.dataset.interest;
    const opt = [...interest.options].find(o => o.text === v);
    if (opt) interest.value = opt.value;
  }));

  const form = $('#form');
  const note = $('#formNote');
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
    // TODO: connect to the client's email / WhatsApp / form service
    const name = form.elements.name.value.trim().split(' ')[0];
    note.textContent = `Thank you, ${name} — Manjula will be in touch soon.`;
    form.reset();
  });

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
