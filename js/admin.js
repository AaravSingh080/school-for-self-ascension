/* =========================================================
   School for Self Ascension — admin panel
   ---------------------------------------------------------
   Two jobs:
     1. Edit what appears on the website.
     2. Reconcile registrations — the screen where Manjula matches money that
        actually arrived in her bank against who says they've paid.

   Everything rendered here is escaped. Descriptions are plain text by design:
   no HTML is ever interpreted, so a pasted <script> shows as characters.
   ========================================================= */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => window.SSA.util.escape(s);
  const money = a => window.SSA.util.money(a);

  /* Pictures already in the repo. A browser can't list a folder, so new
     uploads need adding here (or typed in — the select allows a custom value). */
  const IMAGES = [
    'assets/img/tr-angels.webp', 'assets/img/tr-unicorns.webp', 'assets/img/tr-dragons.webp',
    'assets/img/tr-atlantis.webp', 'assets/img/tr-lemuria.webp', 'assets/img/tr-ascension.webp',
    'assets/img/tr-violet-flame.webp', 'assets/img/jr-egypt.webp', 'assets/img/jr-babaji-cave.webp',
    'assets/img/workshop-circle.webp', 'assets/img/singing-bowls.webp', 'assets/img/crystals-light.webp',
    'assets/img/angel-feather.webp', 'assets/img/healing-hands.webp', 'assets/img/lotus-pond.webp',
    'assets/img/hero-sky.webp', 'assets/img/botanicals.webp', 'assets/img/stirring-soap.webp',
    'assets/img/pouring-wax.webp', 'assets/img/diya-glow.webp'
  ];

  const SECTION_LABEL = { trainings: 'Teacher trainings', courses: 'Courses', journeys: 'Sacred journeys' };
  const PAY_LABEL = {
    unpaid: 'Not paid', initiated: 'Started paying', claimed: "Says they've paid",
    paid: 'Paid', failed: 'Failed', expired: 'Expired', cancelled: 'Cancelled',
    refunded: 'Refunded', waived: 'Waived'
  };
  const PAY_PILL = {
    unpaid: 'pill-unpaid', initiated: 'pill-claimed', claimed: 'pill-claimed', paid: 'pill-paid',
    refunded: 'pill-cancelled', waived: 'pill-free', failed: 'pill-cancelled',
    expired: 'pill-cancelled', cancelled: 'pill-cancelled'
  };

  let activities = [], registrations = [], editing = null;

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg, isError) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isError);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3600);
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function daysAgo(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const n = Math.floor((Date.now() - d.getTime()) / 86400000);
    return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago';
  }

  /* =========================================================
     Boot
     ========================================================= */
  async function boot() {
    await window.SSA.ready;

    if (window.SSA.isDemo) {
      /* Be straight about what "admin" means here. In demo mode the email check
         is cosmetic — anyone can sign up as the admin address in their own
         browser. It costs nothing, because demo data never leaves that browser.
         Once the site is live it is firestore.rules that decides, and nothing
         in this file can override it. */
      $('demoBar').innerHTML = `
        <div class="demo-bar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
          <span><strong>Demo mode. Not a live system.</strong> Everything here is saved in this browser only:
          nobody else can see it and it won't appear on the real website.
          ${window.SSA.fellBack ? '<strong>The live database could not be reached.</strong> ' : ''}
          This page also isn't protected yet. In demo mode anyone can reach it in their own browser, though they'd
          only ever see their own copy. Real protection comes from <code>firestore.rules</code> when you go live.</span>
        </div>`;
    }

    window.SSA_Auth.mountHeader($('acctHost'));
    window.SSA.auth.onChange(gate);
    $('gateSignInBtn').addEventListener('click', () => window.SSA_Auth.open('signin'));
  }

  function gate(user) {
    $('booting').hidden = true;
    const admin = window.SSA.auth.isAdmin();
    $('gateSignIn').hidden = !!user;
    $('gateDenied').hidden = !user || admin;
    $('adminApp').hidden = !user || !admin;
    if (user && !admin) {
      $('gateDeniedWho').textContent =
        `You're signed in as ${user.email}, which isn't on the admin list. If this should be the school's account, add it to the "admins" list in js/config.js.`;
    }
    if (user && admin) load();
  }

  /* Load the two collections independently. Awaiting them in sequence inside
     one try meant a denied registrations read also threw away the activities
     that had loaded fine - leaving a blank panel, and hiding the very button
     that seeds an empty database. The usual cause is the rules not being
     published, or adminUid() not matching this account, so say so plainly and
     leave it on screen; a toast disappears after three seconds. */
  async function load() {
    const [actRes, regRes] = await Promise.allSettled([
      window.SSA.activities.list(),
      window.SSA.registrations.all()
    ]);

    activities = actRes.status === 'fulfilled' ? actRes.value : [];
    registrations = regRes.status === 'fulfilled' ? regRes.value : [];
    renderActivities();
    renderRegs();

    const waiting = registrations.filter(r => ['claimed', 'initiated'].includes(r.payment && r.payment.state)).length;
    $('regCount').textContent = waiting ? `(${waiting} to check)` : (registrations.length ? `(${registrations.length})` : '');

    const denied = [actRes, regRes].filter(x => x.status === 'rejected');
    renderLoadProblem(denied.map(x => x.reason));

    /* The panel reads a bounded page, so say so rather than quietly showing a
       subset of the registrations and letting her believe it is all of them. */
    const note = $('regTruncated');
    if (note) {
      note.hidden = !registrations.truncated;
      note.textContent = registrations.truncated
        ? `Showing the ${registrations.length} most recent registrations. Older ones are still saved. Use the search box, or download the spreadsheet, to reach them.`
        : '';
    }
  }

  function renderLoadProblem(errors) {
    const host = $('loadProblem');
    if (!host) return;
    if (!errors.length) { host.innerHTML = ''; host.hidden = true; return; }

    const permission = errors.some(e => /permission|insufficient/i.test((e && e.message) || ''));
    const user = window.SSA.auth.user();
    const uid = user && user.uid ? user.uid : '(not signed in)';

    host.hidden = false;
    host.innerHTML = loadProblemMarkup(permission, uid, errors);
  }

  /* Split out so the long explanation stays readable. */
  function loadProblemMarkup(isPermission, uid, errors) {
    if (!isPermission) {
      return `<div class="demo-bar"><span><strong>Could not load everything.</strong>
        ${esc((errors[0] && errors[0].message) || 'The database did not answer.')}
        Check the connection and reload.</span></div>`;
    }
    return `<div class="demo-bar"><span><strong>The database refused this account.</strong>
      That is almost always one of two things.
      <strong>1.</strong> The security rules have not been published yet. Open
      <code>firestore.rules</code>, paste it into Firebase → Firestore Database → Rules, and press Publish.
      <strong>2.</strong> The <code>adminUid()</code> line in those rules does not match this account.
      This account's ID is <code>${esc(uid)}</code>, and it has to be exactly what
      <code>adminUid()</code> returns. Compare it with Firebase → Authentication → Users.</span></div>`;
  }

  /* =========================================================
     Tabs
     ========================================================= */
  function selectTab(which) {
    const acts = which === 'activities';
    $('tabActivities').setAttribute('aria-selected', String(acts));
    $('tabRegs').setAttribute('aria-selected', String(!acts));
    $('paneActivities').hidden = !acts;
    $('paneRegs').hidden = acts;
  }
  $('tabActivities').addEventListener('click', () => selectTab('activities'));
  $('tabRegs').addEventListener('click', () => selectTab('regs'));

  /* =========================================================
     Activities
     ========================================================= */
  function renderActivities() {
    const host = $('actList');
    if (!activities.length) {
      /* On a freshly connected database this is the very first screen, so give
         her the one-press way to fill it rather than ten activities to retype. */
      host.innerHTML = `<div class="state"><h3>Nothing here yet</h3>
        <p>Add your first activity and it will appear on the website, or start from the ones already written for the site.</p>
        <button class="btn btn-gold" type="button" id="seedBtn"><span class="roll"><span>Add the starting activities</span><span>Add the starting activities</span></span></button></div>`;
      $('seedBtn').addEventListener('click', async e => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          const n = await window.SSA.activities.importSeed();
          toast(n ? `Added ${n} ${n === 1 ? 'activity' : 'activities'}. Edit any of them, or hide what isn't running.` : 'They were already there.');
          load();
        } catch (ex) {
          btn.disabled = false;
          toast(ex.message || 'Could not add them.', true);
        }
      });
      return;
    }
    const order = ['trainings', 'courses', 'journeys'];
    host.innerHTML = order.map(section => {
      const items = activities.filter(a => a.section === section);
      if (!items.length) return '';
      return `<p class="rs-kicker" style="margin:18px 0 4px">${esc(SECTION_LABEL[section] || section)}</p>` +
        items.map(a => {
          const regs = registrations.filter(r => r.activityId === a.id).length;
          const dates = (a.dates || []).length;
          return `
          <div class="adm-item${a.published ? '' : ' is-hidden'}">
            <div class="adm-thumb">${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy">` : ''}</div>
            <div class="adm-main">
              <h3>${esc(a.fullTitle || a.title)}</h3>
              <div class="adm-sub">
                ${a.published ? '' : '<span class="pill pill-cancelled">Hidden</span>'}
                ${a.registrationOpen ? '' : '<span class="pill pill-unpaid">Registration closed</span>'}
                <span>${a.price == null ? 'Price on request' : money(a.price)}</span>
                <span>·</span>
                <span>${dates ? dates + (dates === 1 ? ' date' : ' dates') : 'Dates to be decided'}</span>
                <span>·</span>
                <span>${regs} registered</span>
              </div>
            </div>
            <div class="adm-acts">
              <button class="mini" type="button" data-edit="${esc(a.id)}">Edit</button>
              <button class="mini" type="button" data-toggle="${esc(a.id)}">${a.published ? 'Hide' : 'Show'}</button>
              <button class="mini mini-danger" type="button" data-del="${esc(a.id)}">Delete</button>
            </div>
          </div>`;
        }).join('');
    }).join('');

    host.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEditor(b.dataset.edit)));
    host.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => togglePublished(b.dataset.toggle)));
    host.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => removeActivity(b.dataset.del)));
  }

  async function togglePublished(id) {
    const a = activities.find(x => x.id === id);
    if (!a) return;
    try {
      await window.SSA.activities.save(Object.assign({}, a, { published: !a.published }));
      toast(a.published ? 'Taken off the website.' : 'Now showing on the website.');
      load();
    } catch (e) { toast(e.message, true); }
  }

  async function removeActivity(id) {
    const a = activities.find(x => x.id === id);
    if (!a) return;
    const regs = registrations.filter(r => r.activityId === id).length;
    /* Deleting an activity that people have registered for would leave those
       registrations pointing at nothing — someone who paid, with no record of
       what for. Hiding does everything deleting was wanted for. */
    if (regs) {
      alert(`"${a.fullTitle || a.title}" can't be deleted. ${regs} ${regs === 1 ? 'person has' : 'people have'} registered for it.\n\n` +
        `Deleting it would leave their registrations pointing at something that no longer exists.\n\n` +
        `Use "Hide" instead: it comes off the website immediately and keeps every registration intact.`);
      return;
    }
    if (!confirm(`Delete "${a.fullTitle || a.title}"? Nobody has registered for it, so nothing will be lost. This can't be undone.`)) return;
    try {
      await window.SSA.activities.remove(id);
      toast('Deleted.');
      load();
    } catch (e) { toast(e.message, true); }
  }

  /* ---------------- editor ---------------- */
  const dlg = $('editDlg');
  const form = $('editForm');

  function imageOptions(current) {
    const list = IMAGES.includes(current) || !current ? IMAGES : [current].concat(IMAGES);
    return list.map(src => `<option value="${esc(src)}"${src === current ? ' selected' : ''}>${esc(src.replace('assets/img/', ''))}</option>`).join('');
  }

  function dateRow(d) {
    d = d || { id: '', label: '', start: '', end: '', mode: '', seats: null };
    return `
      <div class="date-row" data-date-row>
        <input type="text" data-k="label" placeholder="02 – 11 March 2026" value="${esc(d.label)}" aria-label="How the date reads">
        <input type="date" data-k="start" value="${esc(d.start)}" aria-label="Start date">
        <input type="date" data-k="end" value="${esc(d.end)}" aria-label="End date">
        <select data-k="mode" aria-label="In person or online">
          <option value=""${!d.mode ? ' selected' : ''}>Not set</option>
          <option value="in-person"${d.mode === 'in-person' ? ' selected' : ''}>In person</option>
          <option value="online"${d.mode === 'online' ? ' selected' : ''}>Online</option>
        </select>
        <input type="number" data-k="seats" min="1" step="1" inputmode="numeric" placeholder="Places"
               value="${d.seats == null ? '' : esc(d.seats)}" aria-label="Places on this date">
        <button class="mini mini-danger" type="button" data-rm-date aria-label="Remove this date">✕</button>
        <input type="hidden" data-k="id" value="${esc(d.id)}">
      </div>`;
  }

  function wireDateRows() {
    $('dateRows').querySelectorAll('[data-rm-date]').forEach(b => {
      b.onclick = () => { b.closest('[data-date-row]').remove(); };
    });
  }

  $('addDate').addEventListener('click', () => {
    $('dateRows').insertAdjacentHTML('beforeend', dateRow());
    wireDateRows();
    const rows = $('dateRows').querySelectorAll('[data-date-row]');
    rows[rows.length - 1].querySelector('input').focus();
  });

  function openEditor(id) {
    editing = id ? activities.find(a => a.id === id) : null;
    const a = editing || {};
    $('editTitle').textContent = editing ? 'Edit activity' : 'Add an activity';
    $('editKicker').textContent = editing ? (SECTION_LABEL[a.section] || 'Activity') : 'New';
    $('editError').hidden = true;

    const f = form.elements;
    f.title.value = a.title || '';
    f.fullTitle.value = a.fullTitle || '';
    f.section.value = a.section || 'trainings';
    f.cardText.value = a.cardText || '';
    f.lead.value = a.lead || '';
    f.body.value = (a.body || []).join('\n');
    f.listTitle.value = a.listTitle || '';
    f.list.value = (a.list || []).join('\n');
    f.note.value = a.note || '';
    f.accreditation.value = a.accreditation || '';
    f.imageAlt.value = a.imageAlt || '';
    f.price.value = a.price == null ? '' : a.price;
    f.seats.value = a.seats == null ? '' : a.seats;
    f.order.value = a.order == null ? 100 : a.order;
    f.published.checked = a.published !== false;
    f.registrationOpen.checked = a.registrationOpen !== false;
    $('eImage').innerHTML = imageOptions(a.image || '');

    $('dateRows').innerHTML = (a.dates && a.dates.length ? a.dates : []).map(dateRow).join('');
    wireDateRows();

    dlg.showModal();
    document.documentElement.classList.add('locked');
    setTimeout(() => f.title.focus(), 60);
  }

  function closeEditor() {
    dlg.close();
    document.documentElement.classList.remove('locked');
  }
  $('editClose').addEventListener('click', closeEditor);
  $('editCancel').addEventListener('click', closeEditor);
  dlg.addEventListener('cancel', e => { e.preventDefault(); closeEditor(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) closeEditor(); });
  $('addBtn').addEventListener('click', () => openEditor(null));

  /* The wording people read lives in the database, so a copy change in the
     files reaches nobody until it is pushed here. It shows exactly what would
     change before changing it, because this overwrites text and she may have
     reworded some of it herself. */
  $('refreshTextBtn').addEventListener('click', async () => {
    let diff;
    try { diff = await window.SSA.activities.seedDiff(); }
    catch (e) { return toast(e.message || 'Could not check the wording.', true); }
    if (!diff.length) return toast('The wording already matches.');

    const lines = diff
      .map(d => '\u2022 ' + (d.title || d.id) + '  (' + d.changes.map(c => c.field).join(', ') + ')')
      .join('\n');
    const n = diff.length;
    const ok = confirm(
      'Update the wording on ' + n + ' ' + (n === 1 ? 'activity' : 'activities') +
      ' to match the text built into the site?\n\n' + lines + '\n\n' +
      'Dates, fees, seats, and whether each one is showing or taking registrations are NOT touched.\n\n' +
      'Anything you reworded yourself on these will be replaced.');
    if (!ok) return;

    try {
      const count = await window.SSA.activities.applySeedText(diff.map(d => d.id));
      toast('Wording updated on ' + count + ' ' + (count === 1 ? 'activity' : 'activities') + '.');
      load();
    } catch (e) { toast(e.message || 'Could not update the wording.', true); }
  });

  const lines = v => String(v || '').split('\n').map(s => s.trim()).filter(Boolean);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = form.elements;
    const err = $('editError');
    err.hidden = true;

    if (!f.title.value.trim()) {
      err.textContent = 'Please give it a name.'; err.hidden = false; f.title.focus(); return;
    }

    const dates = [...$('dateRows').querySelectorAll('[data-date-row]')].map(row => {
      const get = k => { const el = row.querySelector(`[data-k="${k}"]`); return el ? el.value.trim() : ''; };
      const label = get('label'), start = get('start');
      if (!label && !start) return null;
      const seats = get('seats');
      return {
        id: get('id') || ('d' + Math.random().toString(36).slice(2, 8)),
        label: label || start, start, end: get('end'), mode: get('mode'),
        seats: seats === '' ? null : Number(seats)
      };
    }).filter(Boolean);

    const next = Object.assign({}, editing || {}, {
      id: editing ? editing.id : '',
      title: f.title.value.trim(),
      fullTitle: f.fullTitle.value.trim() || f.title.value.trim(),
      section: f.section.value,
      cardText: f.cardText.value.trim(),
      lead: f.lead.value.trim(),
      body: lines(f.body.value),
      listTitle: f.listTitle.value.trim(),
      list: lines(f.list.value),
      note: f.note.value.trim(),
      accreditation: f.accreditation.value.trim(),
      image: $('eImage').value,
      imageAlt: f.imageAlt.value.trim(),
      price: f.price.value === '' ? null : Number(f.price.value),
      seats: f.seats.value === '' ? null : Number(f.seats.value),
      order: f.order.value === '' ? 100 : Number(f.order.value),
      published: f.published.checked,
      registrationOpen: f.registrationOpen.checked,
      dates
    });

    try {
      await window.SSA.activities.save(next);
      closeEditor();
      toast(editing ? 'Saved.' : 'Added. It\'s on the website now.');
      load();
    } catch (ex) {
      err.textContent = ex.message || 'Could not save.'; err.hidden = false;
    }
  });

  /* =========================================================
     Registrations
     ========================================================= */
  function matches(r, q, filter) {
    if (filter) {
      const st = (r.payment && r.payment.state) || 'unpaid';
      if (filter === 'pending' && r.status !== 'pending') return false;
      if (filter === 'confirmed' && r.status !== 'confirmed') return false;
      if (filter === 'cancelled' && r.status !== 'cancelled') return false;
      if (filter === 'claimed' && st !== 'claimed') return false;
      if (filter === 'unpaid' && !['unpaid', 'initiated'].includes(st)) return false;
    }
    if (!q) return true;
    const hay = [r.name, r.email, r.phone, r.activityTitle, r.ref, r.dateLabel,
      r.address && r.address.city].join(' ').toLowerCase();
    return hay.includes(q);
  }

  function renderRegs() {
    const q = ($('regSearch').value || '').trim().toLowerCase();
    const filter = $('regFilter').value;
    const rows = registrations.filter(r => matches(r, q, filter));

    $('regEmpty').hidden = !!rows.length;
    $('regTable').hidden = !rows.length;
    if (!rows.length) {
      if (registrations.length) {
        $('regEmpty').querySelector('h3').textContent = 'Nothing matches';
        $('regEmpty').querySelector('p').textContent = 'Try a different search or filter.';
      }
      return;
    }

    $('regBody').innerHTML = rows.map(r => {
      const p = r.payment || {};
      const st = p.state || 'unpaid';
      const amt = p.amountExpected;
      const needsCheck = ['claimed', 'initiated'].includes(st);
      const addr = r.address || {};
      const addrLine = [addr.line1, addr.line2, addr.city, addr.state, addr.pin].filter(Boolean).join(', ');
      return `
      <tr>
        <td class="who">
          <strong>${esc(r.name)}</strong>
          <span>${esc(r.email)}<br>${esc(r.phone)}</span>
          ${addrLine ? `<span title="${esc(addrLine)}"><br>${esc(addrLine.slice(0, 44))}${addrLine.length > 44 ? '…' : ''}</span>` : ''}
        </td>
        <td>
          ${esc(r.activityTitle)}
          <br><span class="ref-code" style="font-size:12px">${esc(r.ref || '')}</span>
        </td>
        <td>${esc(r.dateLabel || 'No date chosen')}${r.mode ? `<br><span style="font-size:12px;color:var(--muted)">${esc(r.mode)}</span>` : ''}</td>
        <td>
          <span class="pill ${PAY_PILL[st] || 'pill-unpaid'}">${esc(PAY_LABEL[st] || st)}</span>
          <br><span style="font-size:12.5px">${amt == null ? 'On request' : money(amt)}</span>
          ${p.utr ? `<br><span style="font-size:12px;color:var(--muted)">UTR ${esc(p.utr)}</span>` : ''}
          ${p.verifiedBy ? `<br><span style="font-size:11.5px;color:var(--muted)">by ${esc(p.verifiedBy)}</span>` : ''}
        </td>
        <td><span class="pill pill-${esc(r.status)}">${esc(r.status)}</span></td>
        <td style="white-space:nowrap">${fmtDate(r.createdAt)}<br><span style="font-size:12px;color:${needsCheck ? '#8A6417' : 'var(--muted)'}">${esc(daysAgo(r.createdAt))}</span></td>
        <td>
          <div class="adm-acts">
            <button class="mini" type="button" data-detail="${esc(r.id)}">Details</button>
            ${st !== 'paid' && st !== 'waived' ? `<button class="mini" type="button" data-paid="${esc(r.id)}">Confirm paid</button>` : ''}
            ${st !== 'paid' ? `<button class="mini" type="button" data-cash="${esc(r.id)}">Cash</button>` : ''}
            ${st !== 'waived' ? `<button class="mini" type="button" data-waive="${esc(r.id)}">Waive</button>` : ''}
            <button class="mini" type="button" data-wa="${esc(r.id)}">WhatsApp</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    $('regBody').querySelectorAll('[data-detail]').forEach(b => b.onclick = () => showDetail(b.dataset.detail));
    $('regBody').querySelectorAll('[data-paid]').forEach(b => b.onclick = () => confirmPaid(b.dataset.paid));
    $('regBody').querySelectorAll('[data-cash]').forEach(b => b.onclick = () => recordCash(b.dataset.cash));
    $('regBody').querySelectorAll('[data-waive]').forEach(b => b.onclick = () => waive(b.dataset.waive));
    $('regBody').querySelectorAll('[data-wa]').forEach(b => b.onclick = () => whatsapp(b.dataset.wa));
  }

  async function confirmPaid(id) {
    const r = registrations.find(x => x.id === id);
    if (!r) return;
    const expected = r.payment && r.payment.amountExpected;
    const msg = `Confirm that money has actually arrived for ${r.name}?\n\n` +
      `${r.activityTitle}\nReference: ${r.ref}\nExpected: ${expected == null ? 'on request' : money(expected)}` +
      `${r.payment && r.payment.utr ? `\nThey gave UTR: ${r.payment.utr}` : ''}\n\n` +
      `Check this against your bank or Razorpay dashboard first. This marks it as really paid.`;
    if (!confirm(msg)) return;
    try {
      await window.SSA.registrations.confirmPaid(id, {});
      toast('Marked as paid and confirmed.');
      load();
    } catch (e) { toast(e.message, true); }
  }

  async function recordCash(id) {
    const r = registrations.find(x => x.id === id);
    if (!r) return;
    const def = r.payment && r.payment.amountExpected != null ? r.payment.amountExpected : '';
    const v = prompt(`How much did ${r.name} pay in cash? (in ₹)`, def);
    if (v === null) return;
    /* People type "15,000" or "₹15000". Number() turns both into NaN, which
       Firestore stores happily and no screen here can then correct. */
    const cleaned = String(v).replace(/[₹,\s]/g, '');
    const amount = cleaned === '' ? null : Number(cleaned);
    if (amount !== null && (!isFinite(amount) || amount < 0)) {
      return toast('Please enter just the number, for example 15000.', true);
    }
    try {
      await window.SSA.registrations.recordCash(id, amount);
      toast('Cash payment recorded.');
      load();
    } catch (e) { toast(e.message, true); }
  }

  async function waive(id) {
    const r = registrations.find(x => x.id === id);
    if (!r) return;
    const note = prompt(`Waive the fee for ${r.name}? Add a short note (optional):`, '');
    if (note === null) return;
    try {
      await window.SSA.registrations.waive(id, note);
      toast('Fee waived.');
      load();
    } catch (e) { toast(e.message, true); }
  }

  function whatsapp(id) {
    const r = registrations.find(x => x.id === id);
    if (!r) return;
    const phone = String(r.phone || '').replace(/\D/g, '');
    if (!phone) { toast('No phone number on this registration.', true); return; }
    const num = phone.length === 10 ? '91' + phone : phone;
    const text = `Hello ${r.name.split(' ')[0]}, this is Manjula from the School for Self Ascension about your registration for ${r.activityTitle} (${r.ref}).`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  /* ---------------- full detail, including the consent evidence ----------------
     If anyone ever queries a charge or asks to be removed, the answer is in
     here: exactly what they agreed to, when, and which version of the terms. */
  function showDetail(id) {
    const r = registrations.find(x => x.id === id);
    if (!r) return;
    const p = r.payment || {}, a = r.address || {};
    const row = (k, v) => v ? `<div class="done-row"><span>${esc(k)}</span>${v}</div>` : '';
    $('detailBody').innerHTML = `
      <p class="dlg-kicker">${esc(r.ref || 'Registration')}</p>
      <h3 id="detailTitle">${esc(r.name)}</h3>
      ${row('For', esc(r.activityTitle))}
      ${row('Date', esc(r.dateLabel))}
      ${row('Format', esc(r.mode))}
      ${row('Certificate name', esc(r.certName))}
      ${row('Phone', esc(r.phone) + (r.isWhatsapp ? ' <span class="pill pill-free">WhatsApp</span>' : ''))}
      ${row('Email', esc(r.email))}
      ${row('Address', esc([a.line1, a.line2, a.city, a.state, a.pin, a.country].filter(Boolean).join(', ')))}
      ${row('They wrote', esc(r.notes))}
      ${row('Fee', p.amountExpected == null ? 'On request' : money(p.amountExpected))}
      ${row('Received', p.amountReceived == null ? 'Nothing yet' : money(p.amountReceived))}
      ${row('Payment', esc(PAY_LABEL[p.state] || p.state) + (p.method ? ' · ' + esc(p.method) : ''))}
      ${row('UTR / payment id', esc(p.utr || p.providerPaymentId))}
      ${row('Registered', fmtDate(r.createdAt) + ' (' + esc(daysAgo(r.createdAt)) + ')')}
      ${r.enteredByAdmin ? row('Entered by', esc(r.enteredBy) + ', booked off the website') : ''}
      <div class="panel" style="margin-top:20px;background:var(--cream)">
        <p class="dlg-kicker">Consent record</p>
        ${row('Agreed', r.termsAccepted ? (r.consentMode === 'verbal' ? 'Yes, given verbally, entered by the school' : 'Yes, ticked the box on the website') : 'No record')}
        ${row('When', fmtDate(r.termsAcceptedAt))}
        ${row('Terms version', esc(r.termsVersion))}
        ${row('Confirmed 18+', r.confirmedAdult ? 'Yes' : 'Not recorded')}
        ${row('Marketing', r.marketingOptIn ? 'Opted in, may be contacted about future workshops' : 'Not opted in, do not send marketing')}
      </div>
      ${Array.isArray(p.history) && p.history.length ? `<div style="margin-top:18px">
        <p class="dlg-kicker">What happened</p>
        <ul class="dlg-list">${p.history.map(h => `<li>${esc(PAY_LABEL[(h && h.state) || ''] || (h && h.state) || 'Unknown')} · ${fmtDate(h && h.at)} · ${esc((h && h.by) || 'unknown')}</li>`).join('')}</ul></div>` : ''}`;
    $('detailDlg').showModal();
    document.documentElement.classList.add('locked');
  }

  function closeDetail() { $('detailDlg').close(); document.documentElement.classList.remove('locked'); }
  $('detailClose').addEventListener('click', closeDetail);
  $('detailDlg').addEventListener('cancel', e => { e.preventDefault(); closeDetail(); });
  $('detailDlg').addEventListener('click', e => { if (e.target === $('detailDlg')) closeDetail(); });

  /* ---------------- add a registration by hand ----------------
     Most of this school's bookings arrive on WhatsApp. Without this the admin
     screen would only ever show half the picture. */
  $('addRegBtn').addEventListener('click', () => {
    const open = activities.filter(a => a.published);
    if (!open.length) { toast('Add an activity first.', true); return; }
    $('mrActivity').innerHTML = open.map(a => `<option value="${esc(a.id)}">${esc(a.fullTitle || a.title)}</option>`).join('');
    syncManualDates();
    $('manualForm').reset();
    $('mrActivity').value = open[0].id;
    syncManualDates();
    $('manualError').hidden = true;
    fillManualDialCodes();
    $('manualDlg').showModal();
    document.documentElement.classList.add('locked');
    setTimeout(() => $('mrName').focus(), 60);
  });

  function syncManualDates() {
    const a = activities.find(x => x.id === $('mrActivity').value);
    const dates = (a && a.dates) || [];
    $('mrDateRow').hidden = !dates.length;
    $('mrDate').innerHTML = '<option value="">No particular date</option>' +
      dates.map(d => `<option value="${esc(d.id)}">${esc(d.label)}</option>`).join('');
    $('mrFee').textContent = a && a.price != null ? money(a.price) : 'on request';
  }
  $('mrActivity').addEventListener('change', syncManualDates);

  function fillManualDialCodes() {
    const sel = $('mrDialCode');
    if (!sel || sel.dataset.done) return;
    const codes = (window.SSA.util && window.SSA.util.dialCodes) || [{ c: '+91', n: 'India' }];
    sel.innerHTML = codes.map(x =>
      '<option value="' + esc(x.c) + '"' + (x.c === '+91' ? ' selected' : '') + '>' + esc(x.c) + ' ' + esc(x.n) + '</option>'
    ).join('');
    sel.dataset.done = '1';
  }

  function closeManual() { $('manualDlg').close(); document.documentElement.classList.remove('locked'); }
  $('manualClose').addEventListener('click', closeManual);
  $('manualCancel').addEventListener('click', closeManual);
  $('manualDlg').addEventListener('cancel', e => { e.preventDefault(); closeManual(); });

  $('manualForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = $('manualForm').elements;
    const err = $('manualError');
    err.hidden = true;
    if (!f.name.value.trim()) { err.textContent = 'Please enter their name.'; err.hidden = false; return; }
    if (!f.phone.value.trim() && !f.email.value.trim()) {
      err.textContent = 'Please add a phone number or an email so they can be contacted.'; err.hidden = false; return;
    }
    if (!f.consent.checked) { err.textContent = 'Please confirm they agreed to the terms.'; err.hidden = false; return; }
    try {
      await window.SSA.registrations.create({
        enteredByAdmin: true,
        activityId: $('mrActivity').value,
        dateId: $('mrDate').value,
        name: f.name.value,
        phone: f.phone.value.trim() ? (($('mrDialCode').value || '') + ' ' + f.phone.value.replace(/\D+/g, '')).trim() : '',
        email: f.email.value,
        address: { line1: f.line1.value, city: f.city.value, country: 'India' },
        notes: f.notes.value,
        confirmedAdult: f.adult.checked,
        paymentMethod: 'offline'
      });
      closeManual();
      toast('Registration added.');
      load();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });

  $('regSearch').addEventListener('input', renderRegs);
  $('regFilter').addEventListener('change', renderRegs);

  /* ---------------- CSV ---------------- */
  function csvCell(v) {
    const s = String(v == null ? '' : v);
    /* A leading =, +, - or @ makes Excel treat the cell as a formula. */
    const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
  }

  $('csvBtn').addEventListener('click', () => {
    if (!registrations.length) { toast('Nothing to download yet.', true); return; }
    const head = ['Reference', 'Registered on', 'Name', 'Email', 'Phone',
      'Address', 'City', 'State', 'PIN', 'Country',
      'Activity', 'Date', 'Mode', 'Amount', 'Currency',
      'Payment state', 'Method', 'UTR / payment id', 'Amount received', 'Verified by', 'Verified at',
      'Status', 'Notes from them', 'Terms accepted at', 'Terms version', 'Consent given', 'Marketing opt-in', 'Entered by'];
    const rows = registrations.map(r => {
      const p = r.payment || {}, a = r.address || {};
      return [r.ref, r.createdAt, r.name, r.email, r.phone,
        [a.line1, a.line2].filter(Boolean).join(' '), a.city, a.state, a.pin, a.country,
        r.activityTitle, r.dateLabel, r.mode, p.amountExpected, r.currency,
        p.state, p.method, p.utr || p.providerPaymentId, p.amountReceived, p.verifiedBy, p.verifiedAt,
        r.status, r.notes, r.termsAcceptedAt, r.termsVersion,
        r.consentMode === 'verbal' ? 'verbally' : 'ticked on website',
        r.marketingOptIn ? 'yes' : 'no', r.enteredBy || ''].map(csvCell).join(',');
    });
    /* BOM so Excel opens names with accents correctly. */
    const blob = new Blob(['﻿' + [head.map(csvCell).join(','), ...rows].join('\r\n')],
      { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Spreadsheet downloaded.');
  });

  boot();
})();
