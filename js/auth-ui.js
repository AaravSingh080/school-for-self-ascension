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

  /* =========================================================
     Sign-in throttle
     ---------------------------------------------------------
     Be clear about what this is and is not. Firebase Auth applies its own
     anti-abuse on the server, and that is the protection that actually counts:
     a scripted attacker calls Google's endpoint directly and never loads this
     file. What a client-side throttle genuinely buys you is the case that
     happens far more often than a scripted attack - somebody at a shared
     laptop, or a guessing passer-by, working through the form by hand - and it
     stops this site hammering the Auth API on their behalf.

     Keyed per email so one person's lockout never blocks another on a shared
     device, and the counter is deliberately in localStorage: clearing it is
     trivial for anyone determined, which is exactly why the server-side limits
     remain the real answer.
     ========================================================= */
  const LOCK_KEY = 'ssa.signin.attempts';
  const FREE_TRIES = 4;            /* typos happen; don't punish the first few */
  const FIRST_LOCK_MS = 30 * 1000;
  const MAX_LOCK_MS = 15 * 60 * 1000;

  const lockStore = {
    read() {
      try { return JSON.parse(localStorage.getItem(LOCK_KEY)) || {}; }
      catch (e) { return {}; }     /* private browsing, blocked storage */
    },
    write(v) {
      try { localStorage.setItem(LOCK_KEY, JSON.stringify(v)); } catch (e) {}
    }
  };

  const lockKeyFor = email => String(email || '').trim().toLowerCase();

  /* Milliseconds still to wait for this email, or 0. */
  function lockedFor(email) {
    const rec = lockStore.read()[lockKeyFor(email)];
    if (!rec || !rec.until) return 0;
    return Math.max(0, rec.until - Date.now());
  }

  function noteFailure(email) {
    const key = lockKeyFor(email);
    if (!key) return;
    const all = lockStore.read();
    const rec = all[key] || { fails: 0, until: 0 };
    rec.fails += 1;
    if (rec.fails > FREE_TRIES) {
      /* Double the wait each time past the free tries, up to the ceiling. */
      const step = Math.min(rec.fails - FREE_TRIES - 1, 10);
      rec.until = Date.now() + Math.min(FIRST_LOCK_MS * Math.pow(2, step), MAX_LOCK_MS);
    }
    all[key] = rec;
    lockStore.write(all);
  }

  function clearFailures(email) {
    const all = lockStore.read();
    delete all[lockKeyFor(email)];
    lockStore.write(all);
  }

  function waitWording(ms) {
    const secs = Math.ceil(ms / 1000);
    if (secs < 60) return secs + (secs === 1 ? ' second' : ' seconds');
    const mins = Math.ceil(secs / 60);
    return mins + (mins === 1 ? ' minute' : ' minutes');
  }

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

    let lastReset = 0;
    $('authForgot').addEventListener('click', async () => {
      const email = form.elements.email.value.trim();
      if (!email) { setError('Enter your email address above, then tap this again.'); form.elements.email.focus(); return; }
      /* Each press sends mail to whatever address is typed, which need not be
         the presser's own. A cooldown keeps the button from being a nuisance. */
      if (Date.now() - lastReset < 60000) {
        setError('A reset email has just been sent. Please check your inbox, including spam, before asking for another.');
        return;
      }
      lastReset = Date.now();
      try {
        await window.SSA.auth.resetPassword(email);
        setError('');
        /* Deliberately not "we found your account": that would confirm to a
           stranger whether an address is registered with the school. */
        $('authLead').textContent = 'If there is an account for that address, a link to set a new password is on its way. Check your inbox, including spam.';
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

      /* Only sign-in is throttled. Throttling sign-up would lock someone out of
         creating the account they do not yet have - a worse problem - and
         repeated sign-ups are already bounded by Firebase's own quota. */
      if (mode === 'signin') {
        const wait = lockedFor(f.email.value);
        if (wait > 0) {
          setError('Too many attempts for this email. Please wait ' + waitWording(wait) +
            ', or use the forgotten-password link below.');
          return;
        }
      }

      btn.disabled = true;
      btn.querySelectorAll('.roll span').forEach(s => { s.textContent = mode === 'signup' ? 'Creating…' : 'Signing in…'; });
      try {
        const user = mode === 'signup'
          ? await window.SSA.auth.signUp({ name: f.name.value, email: f.email.value, password: f.password.value, phone: f.phone.value })
          : await window.SSA.auth.signIn({ email: f.email.value, password: f.password.value });
        clearFailures(f.email.value);
        form.reset();
        close(true, user);
      } catch (ex) {
        /* A wrong password counts towards the lockout; being offline does not,
           or a bad connection would lock someone out of their own account. */
        const wrongCredentials = /password|credential|user-not-found|match/i.test(ex.message || '');
        if (mode === 'signin' && wrongCredentials) noteFailure(f.email.value);
        /* Don't leave what they typed sitting in the page - visible in plain
           text if they had pressed Show, and still there for whoever walks up
           next if they give up and wander off. */
        f.password.value = '';
        f.password.type = 'password';
        $('authPeek').textContent = 'Show';
        const wait = mode === 'signin' ? lockedFor(f.email.value) : 0;
        setError(wait > 0
          ? 'That email and password do not match, and there have now been several attempts. Please wait ' +
            waitWording(wait) + ', or use the forgotten-password link below.'
          : (ex.message || 'Something went wrong. Please try again.'));
        btn.disabled = false;
        btn.querySelectorAll('.roll span').forEach(s => { s.textContent = mode === 'signup' ? 'Create account' : 'Sign in'; });
      }
    });

    dlg.__setMode = setMode;
    return dlg;
  }

  function close(success, user) {
    if (!dlg || !dlg.open) return;
    /* Never leave a password behind in a closed dialog. */
    try {
      const pw = dlg.querySelector('[name=password]');
      if (pw) { pw.value = ''; pw.type = 'password'; }
      const peek = dlg.querySelector('#authPeek');
      if (peek) peek.textContent = 'Show';
    } catch (e) {}
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
