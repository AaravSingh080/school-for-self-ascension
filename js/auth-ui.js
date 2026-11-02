/* =========================================================
   School for Self Ascension — sign in / create account
   ---------------------------------------------------------
   One dialog, shared by every page that needs a signed-in visitor.

     await SSA_Auth.require()   → resolves with the user, opening the dialog
                                  first if they aren't signed in. Rejects only
                                  if they close it without signing in.
     SSA_Auth.open('signup')    → open it directly
     SSA_Auth.mountHeader(el)   → render the "Sign in / Hello, name" control

   Built on the same <dialog> pattern as the programme details on the main
   page, so it looks and behaves like the rest of the site.
   ========================================================= */
(() => {
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  let dlg = null, pending = null, lastFocus = null;

  const MARKUP = `
    <form class="auth-form" id="authForm" novalidate>
      <button class="dlg-close" id="authClose" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>

      <p class="dlg-kicker" id="authKicker">Sign in</p>
      <h3 id="authTitle">Welcome back</h3>
      <p class="auth-lead" id="authLead">Sign in to register for a workshop.</p>

      <div class="auth-demo" id="authDemo" hidden>
        <strong>Demo mode.</strong> This account is saved in this browser only —
        it won't work on another device, and nobody else can see it.
      </div>

      <label class="auth-field" id="authNameField">
        <span>Your name</span>
        <input name="name" type="text" autocomplete="name" autocapitalize="words">
      </label>

      <label class="auth-field">
        <span>Email</span>
        <input name="email" type="email" autocomplete="email" inputmode="email" required>
      </label>

      <label class="auth-field" id="authPhoneField">
        <span>Phone <small>(optional)</small></span>
        <input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+91 ">
      </label>

      <label class="auth-field">
        <span>Password</span>
        <span class="auth-pw">
          <input name="password" type="password" autocomplete="current-password" required minlength="6">
          <button type="button" class="auth-peek" id="authPeek" aria-label="Show password">Show</button>
        </span>
        <small class="auth-hint" id="authPwHint" hidden>At least 6 characters.</small>
      </label>

      <p class="auth-error" id="authError" role="alert" hidden></p>

      <button class="btn btn-gold auth-submit" type="submit" id="authSubmit">
        <span class="roll"><span>Sign in</span><span>Sign in</span></span>
      </button>

      <p class="auth-switch">
        <span id="authSwitchText">New here?</span>
        <button type="button" class="auth-link" id="authSwitch">Create an account</button>
      </p>
      <p class="auth-switch auth-forgot" id="authForgotRow">
        <button type="button" class="auth-link" id="authForgot">Forgotten your password?</button>
      </p>
    </form>`;

  function build() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'dlg auth-dlg';
    dlg.id = 'authDlg';
    dlg.setAttribute('aria-labelledby', 'authTitle');
    dlg.innerHTML = MARKUP;
    document.body.appendChild(dlg);

    const $ = id => dlg.querySelector('#' + id);
    const form = $('authForm');
    const err = $('authError');
    let mode = 'signin';

    const setError = msg => {
      err.textContent = msg || '';
      err.hidden = !msg;
      if (msg) err.scrollIntoView({ block: 'nearest' });
    };

    function setMode(next) {
      mode = next;
      const signup = next === 'signup';
      $('authKicker').textContent = signup ? 'Create an account' : 'Sign in';
      $('authTitle').textContent = signup ? 'Create your account' : 'Welcome back';
      $('authLead').textContent = signup
        ? 'A free account keeps your registrations together in one place.'
        : 'Sign in to register for a workshop.';
      $('authNameField').hidden = !signup;
      $('authPhoneField').hidden = !signup;
      $('authPwHint').hidden = !signup;
      $('authForgotRow').hidden = signup || window.SSA.isDemo;
      form.elements.name.required = signup;
      form.elements.password.setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
      $('authSwitchText').textContent = signup ? 'Already have an account?' : 'New here?';
      $('authSwitch').textContent = signup ? 'Sign in instead' : 'Create an account';
      $('authSubmit').querySelectorAll('.roll span').forEach(s => { s.textContent = signup ? 'Create account' : 'Sign in'; });
      setError('');
    }

    $('authSwitch').addEventListener('click', () => setMode(mode === 'signup' ? 'signin' : 'signup'));

    $('authPeek').addEventListener('click', () => {
      const i = form.elements.password;
      const show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      $('authPeek').textContent = show ? 'Hide' : 'Show';
      $('authPeek').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      i.focus();
    });

    $('authForgot').addEventListener('click', async () => {
      const email = form.elements.email.value.trim();
      if (!email) { setError('Enter your email address above, then tap this again.'); form.elements.email.focus(); return; }
      try {
        await window.SSA.auth.resetPassword(email);
        setError('');
        $('authLead').textContent = 'Check your email — we\'ve sent a link to set a new password.';
      } catch (e) { setError(e.message); }
    });

    $('authClose').addEventListener('click', () => close(false));
    dlg.addEventListener('click', e => { if (e.target === dlg) close(false); });
    dlg.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(false); } });
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(false); });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('authSubmit');
      const f = form.elements;
      setError('');

      if (mode === 'signup' && !f.name.value.trim()) { setError('Please enter your name.'); f.name.focus(); return; }
      if (!f.email.value.trim()) { setError('Please enter your email address.'); f.email.focus(); return; }
      if (!f.password.value || f.password.value.length < 6) {
        setError('Please enter a password of at least 6 characters.'); f.password.focus(); return;
      }

      btn.disabled = true;
      btn.querySelectorAll('.roll span').forEach(s => { s.textContent = mode === 'signup' ? 'Creating…' : 'Signing in…'; });
      try {
        const user = mode === 'signup'
          ? await window.SSA.auth.signUp({ name: f.name.value, email: f.email.value, password: f.password.value, phone: f.phone.value })
          : await window.SSA.auth.signIn({ email: f.email.value, password: f.password.value });
        form.reset();
        close(true, user);
      } catch (ex) {
        setError(ex.message || 'Something went wrong. Please try again.');
        btn.disabled = false;
        btn.querySelectorAll('.roll span').forEach(s => { s.textContent = mode === 'signup' ? 'Create account' : 'Sign in'; });
      }
    });

    dlg.__setMode = setMode;
    return dlg;
  }

  function close(success, user) {
    if (!dlg || !dlg.open) return;
    dlg.close();
    document.documentElement.classList.remove('locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    const p = pending; pending = null;
    if (!p) return;
    success ? p.resolve(user) : p.reject(new Error('CANCELLED'));
  }

  function open(mode) {
    build();
    dlg.querySelector('#authDemo').hidden = !window.SSA.isDemo;
    dlg.__setMode(mode === 'signup' ? 'signup' : 'signin');
    lastFocus = document.activeElement;
    dlg.showModal();
    document.documentElement.classList.add('locked');
    const first = dlg.querySelector('input:not([hidden])');
    const nameField = dlg.querySelector('#authNameField');
    const focusTarget = (mode === 'signup' && !nameField.hidden) ? dlg.querySelector('[name=name]') : dlg.querySelector('[name=email]');
    setTimeout(() => (focusTarget || first).focus(), 60);
  }

  window.SSA_Auth = {
    open,
    close: () => close(false),

    /* Resolves with the signed-in user, opening the dialog if needed. */
    async require(opts) {
      await window.SSA.ready;
      const existing = window.SSA.auth.user();
      if (existing) return existing;
      open((opts && opts.mode) || 'signin');
      return new Promise((resolve, reject) => { pending = { resolve, reject }; });
    },

    /* Header control: "Sign in" when logged out, name + menu when logged in. */
    mountHeader(host) {
      if (!host) return;
      const render = user => {
        if (!user) {
          host.innerHTML = '<button type="button" class="acct-btn" id="acctSignIn">Sign in</button>';
          host.querySelector('#acctSignIn').addEventListener('click', () => open('signin'));
          return;
        }
        const first = esc((user.name || user.email).split(/[\s@]/)[0]);
        const admin = window.SSA.auth.isAdmin();
        host.innerHTML = `
          <div class="acct">
            <button type="button" class="acct-btn" id="acctBtn" aria-expanded="false" aria-haspopup="true">
              <span class="acct-dot" aria-hidden="true">${esc(first.charAt(0).toUpperCase())}</span>
              <span class="acct-name">${first}</span>
            </button>
            <div class="acct-menu" id="acctMenu" hidden>
              <p class="acct-email">${esc(user.email)}</p>
              <a href="my-registrations.html">My registrations</a>
              ${admin ? '<a href="admin.html">Admin panel</a>' : ''}
              <button type="button" id="acctOut">Sign out</button>
            </div>
          </div>`;
        const btn = host.querySelector('#acctBtn');
        const menu = host.querySelector('#acctMenu');
        const setOpen = o => { menu.hidden = !o; btn.setAttribute('aria-expanded', String(o)); };
        btn.addEventListener('click', e => { e.stopPropagation(); setOpen(menu.hidden); });
        document.addEventListener('click', () => setOpen(false));
        menu.addEventListener('click', e => e.stopPropagation());
        document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
        host.querySelector('#acctOut').addEventListener('click', async () => {
          await window.SSA.auth.signOut();
          setOpen(false);
        });
      };
      window.SSA.ready.then(() => window.SSA.auth.onChange(render));
    }
  };
})();
