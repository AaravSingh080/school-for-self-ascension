/* =========================================================
   School for Self Ascension — registration
   ---------------------------------------------------------
   register.html             → choose something to register for
   register.html?a=<id>      → the form for one activity
   register.html?a=<id>&d=<dateId> → with a date preselected

   Two deliberate choices, both from how a static site actually behaves:

   1. The login is asked for LATE — when you press "Hold my place", not when
      you arrive. The form is saved as you type, so signing in never costs you
      what you've written.
   2. It says your place is HELD, never "confirmed". Nothing here can reserve a
      seat or check that money arrived; Manjula does both by hand. Saying so is
      the honest version, and it's how the school already works.
   ========================================================= */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => window.SSA.util.escape(s);
  const money = a => window.SSA.util.money(a);
  const CFG = window.SSA_CONFIG;

  const SECTION_LABEL = { trainings: 'Teacher training', courses: 'Course', journeys: 'Sacred journey' };
  const params = new URLSearchParams(location.search);

  let activity = null, selectedDate = null, chosenMethod = null, created = null;

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg, isErr) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  function waLink(text) {
    const num = (CFG.school && CFG.school.whatsapp) || '';
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  }

  function show(which) {
    ['booting', 'chooser', 'formWrap', 'done', 'notFound'].forEach(id => { $(id).hidden = id !== which; });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* =========================================================
     Boot
     ========================================================= */
  async function boot() {
    await window.SSA.ready;

    if (window.SSA.fellBack) {
      $('demoBar').innerHTML = `
        <div class="demo-bar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
          <span><strong>The booking system is not reachable just now.</strong> Anything you fill in here
          will not reach the school. Please reload in a moment, or message Manjula and she will register
          you herself.</span>
        </div>`;
    } else if (window.SSA.isDemo) {
      $('demoBar').innerHTML = `
        <div class="demo-bar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
          <span><strong>Demo mode.</strong> This is a preview — registrations are saved in this browser only and don't reach the school.
          Nothing you enter here is sent anywhere.</span>
        </div>`;
    }

    window.SSA_Auth.mountHeader($('acctHost'));
    $('waEscape').href = waLink('Hello Manjula, I would like to register for one of your workshops.');

    const id = params.get('a');
    if (!id) return renderChooser();

    activity = await window.SSA.activities.get(id);
    if (!activity || !activity.published) return show('notFound');
    renderForm();
  }

  /* =========================================================
     Chooser
     ========================================================= */
  async function renderChooser() {
    const all = (await window.SSA.activities.published()).filter(a => a.registrationOpen);
    if (!all.length) {
      $('chooserList').innerHTML = `<div class="state panel"><h3>Nothing open just now</h3>
        <p>There's nothing taking registrations at the moment. Message Manjula and she'll tell you what's coming.</p>
        <a class="btn btn-gold" href="${esc(waLink('Hello Manjula, what workshops are coming up?'))}" target="_blank" rel="noopener"><span class="roll"><span>Ask on WhatsApp</span><span>Ask on WhatsApp</span></span></a></div>`;
      return show('chooser');
    }
    const order = ['trainings', 'courses', 'journeys'];
    $('chooserList').innerHTML = order.map(section => {
      const items = all.filter(a => a.section === section);
      if (!items.length) return '';
      return `<p class="rs-kicker" style="margin:26px 0 10px">${esc(SECTION_LABEL[section] || section)}</p>
        <div class="adm-list">` + items.map(a => `
          <a class="adm-item" href="register.html?a=${encodeURIComponent(a.id)}" style="text-decoration:none">
            <div class="adm-thumb">${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy">` : ''}</div>
            <div class="adm-main">
              <h3>${esc(a.fullTitle || a.title)}</h3>
              <div class="adm-sub">
                <span>${a.price == null ? 'Price on request' : money(a.price)}</span>
                ${(a.dates || []).length ? `<span>·</span><span>${a.dates.length} date${a.dates.length === 1 ? '' : 's'}</span>` : ''}
              </div>
            </div>
            <div class="adm-acts"><span class="mini">Register →</span></div>
          </a>`).join('') + `</div>`;
    }).join('');
    show('chooser');
  }

  /* =========================================================
     The form
     ========================================================= */
  function renderSummary() {
    const a = activity;
    const meta = [];
    if (a.accreditation) meta.push(['Accredited', a.accreditation]);
    if (a.location) meta.push(['Where', a.location]);
    if (a.duration) meta.push(['How long', a.duration]);
    if (a.modes && a.modes.length) meta.push(['Format', a.modes.map(m => m === 'in-person' ? 'In person' : 'Online').join(' / ')]);

    $('summary').innerHTML = `
      ${a.image ? `<div class="rs-media"><img src="${esc(a.image)}" alt="${esc(a.imageAlt)}"></div>` : ''}
      <p class="rs-kicker">${esc(SECTION_LABEL[a.section] || '')}</p>
      <h2 class="rs-title">${esc(a.fullTitle || a.title)}</h2>
      ${a.lead ? `<p class="rs-lead">${esc(a.lead)}</p>` : ''}
      <ul class="rs-meta">
        ${meta.map(([k, v]) => `<li><span>${esc(k)}</span>${esc(v)}</li>`).join('')}
        <li><span>Fee</span>${a.price == null
          ? 'On request — Manjula will tell you'
          : `<span class="rs-price">${money(a.price)}</span>`}</li>
      </ul>`;
  }

  function renderDates() {
    const dates = activity.dates || [];
    if (!dates.length) {
      $('fsDates').hidden = true;
      return;
    }
    $('fsDates').hidden = false;
    $('datesNote').textContent = dates.length === 1
      ? 'This one runs on:'
      : 'Which would suit you?';

    const today = new Date().toISOString().slice(0, 10);
    $('dateList').innerHTML = dates.map((d, i) => {
      const past = d.start && d.start < today;
      const modeLabel = d.mode === 'online' ? 'Online' : d.mode === 'in-person' ? 'In person' : '';
      return `
        <label class="pick-opt${past ? ' is-full' : ''}">
          <input type="radio" name="dateId" value="${esc(d.id)}"${past ? ' disabled' : ''}>
          <span class="pick-mark" aria-hidden="true"></span>
          <span class="pick-body">
            <span class="pick-title">${esc(d.label || d.start)}${modeLabel ? `<span class="pick-tag">${esc(modeLabel)}</span>` : ''}</span>
            ${past ? '<span class="pick-sub">This date has passed — ask about the next one</span>'
                   : d.seats ? '<span class="pick-sub">Limited places</span>' : ''}
          </span>
        </label>`;
    }).join('');

    const preset = params.get('d');
    const radios = [...$('dateList').querySelectorAll('input[name=dateId]')];
    const pick = radios.find(r => r.value === preset && !r.disabled) || (radios.filter(r => !r.disabled).length === 1 ? radios.find(r => !r.disabled) : null);
    if (pick) { pick.checked = true; selectedDate = dates.find(d => d.id === pick.value); }
    radios.forEach(r => r.addEventListener('change', () => {
      selectedDate = dates.find(d => d.id === r.value) || null;
      $('dateErr').hidden = true;
      saveDraft();
    }));
  }

  function renderPayMethods() {
    const p = CFG.payments || {};
    const free = activity.price == null || Number(activity.price) === 0;
    const opts = [];

    if (!free && p.upi && p.upi.enabled && p.upi.vpa) {
      opts.push({ id: 'upi-direct', title: 'UPI', sub: 'GPay, PhonePe, Paytm or any UPI app' });
    }
    if (!free && p.card && p.card.enabled && activity.payPageUrl) {
      opts.push({ id: 'razorpay', title: 'Card, netbanking or UPI', sub: 'Pay securely on Razorpay' });
    }
    if (p.offline && p.offline.enabled) {
      opts.push({ id: 'offline', title: free ? 'No payment needed' : (p.offline.label || 'Arrange with Manjula'),
        sub: free ? 'Just hold my place' : (p.offline.note || '') });
    }
    if (!opts.length) opts.push({ id: 'offline', title: 'Arrange with Manjula', sub: 'She will be in touch about payment' });

    $('payMethods').innerHTML = opts.map((o, i) => `
      <label class="pick-opt">
        <input type="radio" name="payMethod" value="${esc(o.id)}"${i === 0 ? ' checked' : ''}>
        <span class="pick-mark" aria-hidden="true"></span>
        <span class="pick-body">
          <span class="pick-title">${esc(o.title)}</span>
          ${o.sub ? `<span class="pick-sub">${esc(o.sub)}</span>` : ''}
        </span>
      </label>`).join('');

    chosenMethod = opts[0].id;
    $('payMethods').querySelectorAll('input[name=payMethod]').forEach(r => {
      r.addEventListener('change', () => { chosenMethod = r.value; renderPayDetail(); saveDraft(); });
    });
    renderPayDetail();
  }

  function renderPayDetail() {
    const host = $('payDetail');
    const p = CFG.payments || {};
    if (chosenMethod === 'upi-direct') {
      host.innerHTML = `<p class="pay-note">After you hold your place we'll show a QR code and a UPI link for
        ${activity.price == null ? 'the fee' : money(activity.price)}, with a reference to quote.</p>`;
    } else if (chosenMethod === 'razorpay') {
      host.innerHTML = `<p class="pay-note">You'll be taken to Razorpay's secure page to pay by card, netbanking or UPI.
        We never see or store your card details.</p>`;
    } else {
      host.innerHTML = `<p class="pay-note">${esc((p.offline && p.offline.note) || 'Manjula will be in touch about payment.')}</p>`;
    }
  }

  function renderTerms() {
    const r = CFG.registration || {};
    $('termsText').innerHTML = `I agree to the <a href="${esc(r.termsUrl)}" target="_blank" rel="noopener">terms &amp; conditions</a>,
      the <a href="${esc(r.privacyUrl)}" target="_blank" rel="noopener">privacy notice</a>
      and the <a href="${esc(r.refundUrl)}" target="_blank" rel="noopener">cancellation &amp; refund policy</a>,
      and I'm happy for the school to contact me about this registration.`;
  }

  function renderForm() {
    document.title = `Register — ${activity.fullTitle || activity.title}`;
    $('pageTitle').innerHTML = `Register for <em>${esc(activity.title)}</em>`;
    $('pageSub').textContent = activity.registrationOpen
      ? 'Fill this in and Manjula will confirm your place personally.'
      : 'Registration for this one is closed at the moment.';
    $('waEscape').href = waLink(`Hello Manjula, I'd like to register for ${activity.fullTitle || activity.title}.`);

    renderSummary();
    renderDates();
    renderPayMethods();
    renderTerms();

    if (!activity.registrationOpen) {
      $('regForm').querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = true; });
      $('formError').textContent = 'Registration is closed for this one just now — message Manjula to hear when it next runs.';
      $('formError').hidden = false;
    }

    prefill();
    wireValidation();
    show('formWrap');
  }

  /* =========================================================
     Draft + prefill — nobody should lose a half-filled form
     ========================================================= */
  const draftKey = () => 'ssa.draft.' + (activity ? activity.id : 'none');
  const FIELDS = ['name', 'certName', 'phone', 'email', 'line1', 'line2', 'city', 'state', 'pin', 'country', 'notes'];

  function saveDraft() {
    if (!activity) return;
    try {
      const f = $('regForm').elements;
      const d = {};
      FIELDS.forEach(k => { if (f[k]) d[k] = f[k].value; });
      d.isWhatsapp = f.isWhatsapp.checked;
      d.dateId = selectedDate ? selectedDate.id : '';
      d.payMethod = chosenMethod;
      localStorage.setItem(draftKey(), JSON.stringify(d));
    } catch (e) { /* private browsing — not worth bothering anyone about */ }
  }

  function clearDraft() { try { localStorage.removeItem(draftKey()); } catch (e) {} }

  function prefill() {
    const f = $('regForm').elements;
    let draft = {};
    try { draft = JSON.parse(localStorage.getItem(draftKey()) || '{}'); } catch (e) {}

    FIELDS.forEach(k => { if (f[k] && draft[k]) f[k].value = draft[k]; });
    if (draft.isWhatsapp === false) f.isWhatsapp.checked = false;

    /* A signed-in visitor shouldn't retype what we already know. */
    const user = window.SSA.auth.user();
    if (user) {
      if (!f.name.value) f.name.value = user.name || '';
      if (!f.email.value) f.email.value = user.email || '';
      if (!f.phone.value) f.phone.value = user.phone || '';
    }
    window.SSA.auth.onChange(u => {
      if (!u) return;
      if (!f.name.value) f.name.value = u.name || '';
      if (!f.email.value) f.email.value = u.email || '';
      if (!f.phone.value) f.phone.value = u.phone || '';
      $('loginHint').textContent = `Signed in as ${u.email}.`;
    });

    if (draft.payMethod) {
      const r = $('payMethods').querySelector(`input[value="${CSS.escape(draft.payMethod)}"]`);
      if (r) { r.checked = true; chosenMethod = draft.payMethod; renderPayDetail(); }
    }
    FIELDS.forEach(k => { if (f[k]) f[k].addEventListener('input', saveDraft); });
    f.isWhatsapp.addEventListener('change', saveDraft);
  }

  /* =========================================================
     Validation — strict on blur, forgiving while typing
     ========================================================= */
  const digits = s => String(s || '').replace(/\D/g, '');

  function phoneProblem(value, country) {
    const d = digits(value);
    if (!d) return 'Please add a phone number.';
    const indian = !country || /^(india|bharat|in)$/i.test(country.trim());
    if (indian) {
      /* Indian mobiles are 10 digits starting 6–9, optionally with 91 or 0. */
      let core = d;
      if (core.length === 12 && core.startsWith('91')) core = core.slice(2);
      else if (core.length === 11 && core.startsWith('0')) core = core.slice(1);
      if (core.length !== 10) return 'An Indian mobile number is 10 digits.';
      if (!/^[6-9]/.test(core)) return 'An Indian mobile number starts with 6, 7, 8 or 9.';
      return '';
    }
    if (d.length < 7 || d.length > 15) return 'That phone number doesn\'t look right.';
    return '';
  }

  function emailProblem(v) {
    const s = String(v || '').trim();
    if (!s) return 'Please add your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return 'That email address doesn\'t look right.';
    return '';
  }

  function pinProblem(v, country) {
    const s = String(v || '').trim();
    const indian = !country || /^(india|bharat|in)$/i.test(country.trim());
    if (!s) return indian ? 'Please add your PIN code.' : '';
    if (indian && !/^\d{6}$/.test(s)) return 'An Indian PIN code is 6 digits.';
    return '';
  }

  function setErr(name, msg) {
    const el = $('regForm').elements[name];
    const box = document.querySelector(`[data-err="${name}"]`);
    if (el) el.classList.toggle('invalid', !!msg);
    if (box) { box.textContent = msg || ''; box.hidden = !msg; }
    return !msg;
  }

  function checkField(name) {
    const f = $('regForm').elements;
    const country = f.country ? f.country.value : 'India';
    switch (name) {
      case 'name': return setErr('name', f.name.value.trim() ? '' : 'Please add your name.');
      case 'phone': return setErr('phone', phoneProblem(f.phone.value, country));
      case 'email': return setErr('email', emailProblem(f.email.value));
      case 'line1': return setErr('line1', f.line1.value.trim() ? '' : 'Please add your address.');
      case 'city': return setErr('city', f.city.value.trim() ? '' : 'Please add your city or town.');
      case 'pin': return setErr('pin', pinProblem(f.pin.value, country));
      default: return true;
    }
  }

  function wireValidation() {
    const f = $('regForm').elements;
    ['name', 'phone', 'email', 'line1', 'city', 'pin'].forEach(n => {
      if (!f[n]) return;
      f[n].addEventListener('blur', () => checkField(n));
      f[n].addEventListener('input', () => { if (f[n].classList.contains('invalid')) checkField(n); });
    });
    const clearConsent = () => {
      $('termsBox').classList.toggle('invalid', !$('rTerms').checked);
      $('ageBox').classList.toggle('invalid', !$('rAge').checked);
      if ($('rTerms').checked && $('rAge').checked) {
        const box = document.querySelector('[data-err="terms"]');
        box.hidden = true;
      }
    };
    $('rTerms').addEventListener('change', clearConsent);
    $('rAge').addEventListener('change', clearConsent);
  }

  /* =========================================================
     Submit — login is asked for here, not before
     ========================================================= */
  /* Guards against a double-click creating two registrations: there is an
     await (the login gate) between pressing the button and disabling it. */
  let submitting = false;

  $('regForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (submitting) return;
    const f = $('regForm').elements;
    const btn = $('submitBtn');
    $('formError').hidden = true;

    let ok = true;
    ['name', 'phone', 'email', 'line1', 'city', 'pin'].forEach(n => { if (!checkField(n)) ok = false; });

    if (!$('fsDates').hidden && (activity.dates || []).length && !selectedDate) {
      $('dateErr').textContent = 'Please choose a date.';
      $('dateErr').hidden = false;
      ok = false;
    }
    const consentErr = document.querySelector('[data-err="terms"]');
    const missing = [];
    if (CFG.registration.requireTerms && !$('rTerms').checked) { $('termsBox').classList.add('invalid'); missing.push('agree to the terms'); }
    if (!$('rAge').checked) { $('ageBox').classList.add('invalid'); missing.push('confirm you are 18 or older'); }
    if (missing.length) {
      consentErr.textContent = 'Please ' + missing.join(' and ') + ' to continue.';
      consentErr.hidden = false;
      ok = false;
    } else {
      consentErr.hidden = true;
    }
    if (!ok) {
      const bad = document.querySelector('.invalid');
      if (bad) { bad.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (bad.focus) bad.focus({ preventScroll: true }); }
      return;
    }

    saveDraft();
    submitting = true;

    /* The late login gate. */
    try {
      await window.SSA_Auth.require({ mode: 'signin' });
    } catch (err) {
      submitting = false;
      $('formError').textContent = 'You\'ll need an account to hold a place — everything you typed has been kept.';
      $('formError').hidden = false;
      return;
    }

    btn.disabled = true;
    btn.querySelectorAll('.roll span').forEach(s => { s.textContent = 'Holding your place…'; });

    try {
      created = await window.SSA.registrations.create({
        activityId: activity.id,
        dateId: selectedDate ? selectedDate.id : '',
        mode: selectedDate ? selectedDate.mode : '',
        name: f.name.value,
        certName: f.certName.value,
        phone: f.phone.value,
        email: f.email.value,
        isWhatsapp: f.isWhatsapp.checked,
        address: {
          line1: f.line1.value, line2: f.line2.value, city: f.city.value,
          state: f.state.value, pin: f.pin.value, country: f.country.value
        },
        notes: f.notes.value,
        marketingOptIn: $('rMarketing').checked,
        confirmedAdult: true,
        paymentMethod: chosenMethod
      });
      clearDraft();
      renderDone();
    } catch (ex) {
      submitting = false;
      /* If we can't tell whether it saved, say so rather than inviting a
         duplicate — a second registration is worse than a moment's doubt. */
      const unsure = /timeout|network|unavailable|reach/i.test(ex.message || '');
      $('formError').innerHTML = unsure
        ? 'We couldn\'t confirm your registration was saved. <strong>Please don\'t send it again</strong> — ' +
          'check <a href="my-registrations.html" style="text-decoration:underline">My registrations</a> first, ' +
          'or message Manjula on WhatsApp.'
        : esc(ex.message || 'Something went wrong. Please try again.');
      $('formError').hidden = false;
      btn.disabled = false;
      btn.querySelectorAll('.roll span').forEach(s => { s.textContent = 'Hold my place'; });
    }
  });

  /* =========================================================
     Confirmation + payment
     ========================================================= */
  function renderDone() {
    const r = created;
    const amount = r.payment.amountExpected;

    $('doneLead').textContent = amount == null
      ? `Thank you, ${r.name.split(' ')[0]}. Manjula will be in touch about the fee and to confirm everything.`
      : `Thank you, ${r.name.split(' ')[0]}. Your place is held while you pay — Manjula confirms every registration herself.`;

    $('doneCard').innerHTML = `
      <div class="done-row"><span>Reference</span><strong class="ref-code">${esc(r.ref)}</strong></div>
      <div class="done-row"><span>For</span>${esc(r.activityTitle)}</div>
      ${r.dateLabel ? `<div class="done-row"><span>Date</span>${esc(r.dateLabel)}</div>` : ''}
      <div class="done-row"><span>Name</span>${esc(r.name)}</div>
      <div class="done-row"><span>Phone</span>${esc(r.phone)}</div>
      <div class="done-row"><span>Email</span>${esc(r.email)}</div>
      <div class="done-row"><span>Fee</span>${amount == null ? 'On request' : money(amount)}</div>
      <div class="done-row"><span>Status</span><span class="pill pill-pending">Held — awaiting confirmation</span></div>`;

    $('doneWa').href = waLink(`Hello Manjula, I've just registered for ${r.activityTitle} (${r.ref}).`);

    /* In demo mode nothing has actually been sent. Saying "your place is held"
       without saying that would be a lie on the one screen people trust most. */
    if (window.SSA.isDemo) {
      $('doneTitle').textContent = 'This is a preview';
      $('doneLead').innerHTML = '<strong>Nothing has been sent.</strong> This is a demonstration of how registering will work — ' +
        'your details were saved in this browser only and the school has not received them. ' +
        'To register for real, message Manjula.';
    }

    renderDonePayment();
    show('done');
  }

  function renderDonePayment() {
    const r = created;
    const host = $('donePay');
    const amount = r.payment.amountExpected;
    const p = CFG.payments || {};

    if (amount == null || Number(amount) === 0 || r.payment.method === 'offline') {
      host.innerHTML = `<div class="panel done-card" style="margin-top:18px">
        <p class="pay-off">${esc((p.offline && p.offline.note) || 'Manjula will be in touch about payment.')}</p></div>`;
      return;
    }

    if (r.payment.method === 'razorpay' && activity.payPageUrl) {
      host.innerHTML = `<div class="panel done-card" style="margin-top:18px">
        <div class="pay-amount"><span>To pay</span><strong>${money(amount)}</strong></div>
        <p class="pay-off">Pay securely on Razorpay's own page — by card, netbanking or UPI.
        Please quote <strong class="ref-code">${esc(r.ref)}</strong> if it asks for a note.</p>
        <a class="btn btn-gold upi-open" id="rzpGo" href="${esc(activity.payPageUrl)}" target="_blank" rel="noopener">
          <span class="roll"><span>Pay ${esc(money(amount))}</span><span>Pay ${esc(money(amount))}</span></span></a>
        <p class="pay-note">We never see or store your card details.</p></div>`;
      const go = $('rzpGo');
      if (go) go.addEventListener('click', () => {
        window.SSA.registrations.markInitiated(r.id, 'razorpay').catch(() => {});
      });
      return;
    }

    /* UPI */
    const vpa = (p.upi && p.upi.vpa) || '';
    const link = window.SSA.util.upiLink({
      vpa, name: (p.upi && p.upi.payeeName) || CFG.school.teacher,
      amount, note: r.ref, ref: r.ref
    });

    host.innerHTML = `<div class="panel done-card" style="margin-top:18px">
      <div class="pay-amount"><span>To pay by UPI</span><strong>${money(amount)}</strong></div>
      ${!vpa ? `<p class="pay-off">Manjula will send you the UPI details — her UPI ID hasn't been added to the site yet.</p>`
      : `<div class="upi-wrap">
          <div class="upi-qr" id="qrBox"><span class="upi-qr-fallback">Preparing QR…</span></div>
          <div>
            <ol class="upi-steps">
              <li>Scan the QR with any UPI app, or tap the button on your phone.</li>
              <li>Check the amount shows <strong>${money(amount)}</strong>.</li>
              <li>Pay, then come back and tell us your reference number.</li>
            </ol>
            <div class="upi-id"><span id="vpaText">${esc(vpa)}</span>
              <button class="upi-copy" type="button" id="copyVpa">Copy UPI ID</button></div>
            <a class="btn btn-gold upi-open" id="upiGo" href="${esc(link)}">
              <span class="roll"><span>Pay with a UPI app</span><span>Pay with a UPI app</span></span></a>
            <p class="pay-note">Quote <strong class="ref-code">${esc(r.ref)}</strong> so Manjula can match your payment.
            On a computer, scan the QR with your phone instead.</p>
          </div>
        </div>
        <div style="margin-top:22px;padding-top:20px;border-top:1px solid var(--line)">
          <div class="f-row">
            <label for="utr">Paid already? Enter your UPI reference number</label>
            <input id="utr" type="text" inputmode="numeric" placeholder="12-digit UPI / UTR number">
            <p class="f-hint">You'll find it in your UPI app's history as "UPI transaction ID" or "UTR".
            This tells Manjula to look for your payment — she confirms it against her bank.</p>
          </div>
          <button class="btn btn-ghost" type="button" id="claimBtn" style="margin-top:12px">I've paid</button>
          <p class="f-hint" id="claimMsg" style="margin-top:10px"></p>
        </div>`}
    </div>`;

    if (!vpa) return;

    drawQR(link);

    $('copyVpa').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(vpa); toast('UPI ID copied.'); }
      catch (e) {
        const sel = window.getSelection(), range = document.createRange();
        range.selectNodeContents($('vpaText')); sel.removeAllRanges(); sel.addRange(range);
        toast('Press Ctrl/Cmd + C to copy.');
      }
    });

    $('upiGo').addEventListener('click', () => {
      window.SSA.registrations.markInitiated(r.id, 'upi-direct').catch(() => {});
    });

    $('claimBtn').addEventListener('click', async () => {
      const utr = $('utr').value.trim();
      if (!utr) { $('utr').classList.add('invalid'); $('claimMsg').textContent = 'Please enter the reference number from your UPI app.'; return; }
      $('utr').classList.remove('invalid');
      try {
        await window.SSA.registrations.claimPayment(r.id, utr);
        $('claimBtn').disabled = true;
        $('claimMsg').innerHTML = '<strong>Thank you.</strong> Manjula will check this against her bank and confirm your place.';
        toast('Noted — thank you.');
      } catch (e) { $('claimMsg').textContent = e.message; }
    });
  }

  /* Vendored QR encoder (MIT, Kazuhiko Arase). Kept local so the UPI ID is
     never sent to a third-party image service. */
  function drawQR(text) {
    const box = $('qrBox');
    try {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) {
      box.innerHTML = '<span class="upi-qr-fallback">Use the UPI ID below, or tap the button on your phone.</span>';
    }
  }

  /* Any failure in boot() used to leave the page sitting on "One moment..."
     for ever - no message, no way out, on the one page where someone is trying
     to give the school money. Land on the existing failure panel instead, with
     the WhatsApp escape showing. */
  boot().catch(e => {
    console.error('[SSA] register page could not start:', e);
    const t = $('notFoundTitle'), b = $('notFoundText'), wa = $('notFoundWa');
    if (t) t.textContent = 'We could not load this just now';
    if (b) b.textContent = (e && /permission|unavailable|network/i.test(e.message || ''))
      ? 'The booking system is not reachable at the moment. Nothing has been sent. Please message Manjula and she will register you herself.'
      : 'Something went wrong loading this page. Nothing has been sent. Please message Manjula and she will register you herself.';
    if (wa) { wa.href = waLink('Hello Manjula, I tried to register on the website but it would not load.'); wa.hidden = false; }
    show('notFound');
  });
})();
