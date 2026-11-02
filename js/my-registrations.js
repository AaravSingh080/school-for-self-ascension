/* =========================================================
   School for Self Ascension — a visitor's own registrations
   ---------------------------------------------------------
   Shows only what belongs to the signed-in person. In the live system that
   is enforced by firestore.rules, not by this file.
   ========================================================= */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => window.SSA.util.escape(s);
  const money = a => window.SSA.util.money(a);
  const CFG = window.SSA_CONFIG;

  const PAY_LABEL = {
    unpaid: 'Not paid yet', initiated: 'Payment started', claimed: 'Waiting to be checked',
    paid: 'Paid', failed: 'Payment failed', expired: 'Expired', cancelled: 'Cancelled',
    refunded: 'Refunded', waived: 'No fee due'
  };
  const PAY_PILL = {
    unpaid: 'pill-unpaid', initiated: 'pill-claimed', claimed: 'pill-claimed', paid: 'pill-paid',
    waived: 'pill-free', refunded: 'pill-cancelled', failed: 'pill-cancelled',
    expired: 'pill-cancelled', cancelled: 'pill-cancelled'
  };
  const STATUS_LABEL = { pending: 'Held — awaiting confirmation', confirmed: 'Confirmed', cancelled: 'Cancelled' };

  let toastTimer;
  function toast(msg, isErr) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  const waLink = text => `https://wa.me/${(CFG.school && CFG.school.whatsapp) || ''}?text=${encodeURIComponent(text)}`;

  function fmtDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function boot() {
    await window.SSA.ready;
    if (window.SSA.isDemo) {
      $('demoBar').innerHTML = `
        <div class="demo-bar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
          <span><strong>Demo mode.</strong> These are saved in this browser only and haven't reached the school.</span>
        </div>`;
    }
    window.SSA_Auth.mountHeader($('acctHost'));
    $('gateSignInBtn').addEventListener('click', () => window.SSA_Auth.open('signin'));
    window.SSA.auth.onChange(gate);
  }

  function gate(user) {
    $('booting').hidden = true;
    $('gateSignIn').hidden = !!user;
    $('listWrap').hidden = !user;
    if (user) load(user);
  }

  async function load(user) {
    let regs = [];
    try { regs = await window.SSA.registrations.mine(); }
    catch (e) { toast(e.message, true); return; }

    $('empty').hidden = !!regs.length;
    $('listSub').textContent = regs.length
      ? `Everything you've registered for, ${(user.name || user.email).split(/[\s@]/)[0]}.`
      : '';

    $('list').innerHTML = regs.map(r => {
      const p = r.payment || {};
      const st = p.state || 'unpaid';
      const owes = ['unpaid', 'initiated'].includes(st) && p.amountExpected != null && Number(p.amountExpected) > 0;
      const canCancel = r.status !== 'cancelled' && st !== 'paid';
      return `
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-head" style="margin-bottom:14px">
          <h2 style="font-size:clamp(1.3rem,2.2vw,1.8rem)">${esc(r.activityTitle)}</h2>
          <span class="pill pill-${esc(r.status)}">${esc(STATUS_LABEL[r.status] || r.status)}</span>
        </div>
        <div class="done-row"><span>Reference</span><strong class="ref-code">${esc(r.ref || '')}</strong></div>
        ${r.dateLabel ? `<div class="done-row"><span>Date</span>${esc(r.dateLabel)}${r.mode ? ' · ' + esc(r.mode) : ''}</div>` : ''}
        <div class="done-row"><span>Fee</span>${p.amountExpected == null ? 'On request' : money(p.amountExpected)}</div>
        <div class="done-row"><span>Payment</span><span class="pill ${PAY_PILL[st] || 'pill-unpaid'}">${esc(PAY_LABEL[st] || st)}</span></div>
        <div class="done-row"><span>Registered</span>${fmtDate(r.createdAt)}</div>
        ${st === 'claimed' ? `<p class="pay-note" style="margin-top:14px">You told us you've paid${p.utr ? ' (reference ' + esc(p.utr) + ')' : ''}.
          Manjula is checking it against her bank and will confirm your place.</p>` : ''}
        ${st === 'paid' ? `<p class="pay-note" style="margin-top:14px">Payment received — your place is confirmed. See you there.</p>` : ''}
        <div class="done-actions" style="justify-content:flex-start;margin-top:20px">
          ${owes ? `<a class="btn btn-gold" href="register.html?a=${encodeURIComponent(r.activityId)}"><span class="roll"><span>Pay now</span><span>Pay now</span></span></a>` : ''}
          <a class="btn btn-ghost" href="${esc(waLink(`Hello Manjula, about my registration ${r.ref} for ${r.activityTitle}.`))}" target="_blank" rel="noopener">Message Manjula</a>
          ${canCancel ? `<button class="mini" type="button" data-cancel="${esc(r.id)}">Cancel this registration</button>` : ''}
        </div>
      </div>`;
    }).join('');

    $('list').querySelectorAll('[data-cancel]').forEach(b => {
      b.addEventListener('click', () => cancel(b.dataset.cancel, regs));
    });
  }

  async function cancel(id, regs) {
    const r = regs.find(x => x.id === id);
    if (!r) return;
    if (!confirm(`Cancel your registration for ${r.activityTitle}?\n\nReference ${r.ref}\n\n` +
      `Anything owed under the refund policy will be arranged with Manjula directly.`)) return;
    try {
      await window.SSA.registrations.update(id, { status: 'cancelled' });
      toast('Registration cancelled.');
      load(window.SSA.auth.user());
    } catch (e) { toast(e.message, true); }
  }

  boot();
})();
