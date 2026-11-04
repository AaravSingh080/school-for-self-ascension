/* =========================================================
   School for Self Ascension — data layer
   ---------------------------------------------------------
   One API, two drivers:

     demo      localStorage. Everything works instantly, nothing is shared
               between devices or people. For showing the client.
     firebase  Firebase Auth + Cloud Firestore. Real accounts, one shared
               database, authorisation enforced by security rules on
               Google's servers where a visitor cannot forge it.

   Pages only ever talk to window.SSA — they never know which driver is
   running, so switching backends is a config change, not a rewrite.
   ========================================================= */
(() => {
  'use strict';

  const CFG = window.SSA_CONFIG || {};
  const SEED = window.SSA_SEED || { activities: [] };

  /* Firebase modular SDK version. Bump both numbers together. */
  const FB = '11.0.2';
  const FB_URL = v => `https://www.gstatic.com/firebasejs/${FB}/firebase-${v}.js`;

  const LS = {
    users: 'ssa.users',
    session: 'ssa.session',
    activities: 'ssa.activities',
    registrations: 'ssa.registrations',
    seeded: 'ssa.seeded',
    deleted: 'ssa.deleted'
  };

  const TERMS_VERSION = '2026-11-01';

  /* How many registrations the admin panel pulls at once. */
  const REG_PAGE = 300;

  /* ---------------------------------------------------------
     PAYMENT STATES
     The public page may only ever move a registration along the first three.
     'paid', 'refunded' and 'waived' are facts about money arriving, and the
     only honest source for those is Manjula checking her own bank or Razorpay
     dashboard — a visitor can type anything into their own browser.
     --------------------------------------------------------- */
  const PAY_STATES = ['unpaid', 'initiated', 'claimed', 'paid', 'failed', 'expired', 'cancelled', 'refunded', 'waived'];
  const VISITOR_MAY_SET = ['initiated', 'claimed', 'cancelled'];
  const ADMIN_ONLY = ['paid', 'refunded', 'waived', 'failed', 'expired'];

  /* Human-sized reference, e.g. SSA-EGY26-KQ4. Ambiguous characters
     (0/O, 1/I/L, 5/S, 8/B, 2/Z) are left out so it survives being read down
     a phone line or typed into a UPI note. */
  const REF_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';
  function makeRef(activity) {
    const letters = String((activity && activity.title) || 'SSA').toUpperCase()
      .replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
    const yr = String(new Date().getFullYear()).slice(2);
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const rand = [...bytes].map(b => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
    return `SSA-${letters}${yr}-${rand}`;
  }

  /* ---------------- helpers ---------------- */
  const now = () => new Date().toISOString();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1e9));
  const clone = o => JSON.parse(JSON.stringify(o));
  const lower = s => String(s || '').trim().toLowerCase();

  function readLS(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : clone(fallback); }
    catch (e) { return clone(fallback); }
  }
  function writeLS(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) {
      console.error('[SSA] Could not save: browser storage is full or blocked.', e);
      throw new Error('STORAGE_UNAVAILABLE');
    }
  }

  /* Demo-mode password handling. This is NOT security — anything stored in a
     browser can be read by whoever owns that browser. It exists so that even a
     throwaway demo never keeps a typed password lying around in clear text. */
  async function hashPassword(password, salt) {
    const data = new TextEncoder().encode(salt + '::' + password);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const isAdminEmail = email => (CFG.admins || []).map(lower).includes(lower(email));

  /* Normalise anything the admin panel or seed hands us into one shape, so the
     renderer never has to guard against a missing field. */
  function normaliseActivity(a) {
    /* Object.assign copies an explicit `undefined` straight over the default
       beneath it, and Firestore rejects `undefined` outright - so an object
       carrying `subtitle: undefined` blows up the write instead of falling
       back to ''. Most seed activities have no subtitle, so this is reached in
       ordinary use. Drop undefined keys first and let the defaults stand. */
    const given = {};
    Object.keys(a || {}).forEach(k => { if (a[k] !== undefined) given[k] = a[k]; });
    a = given;
    const out = Object.assign({
      id: '', section: 'trainings', order: 999, published: true,
      title: '', fullTitle: '', kicker: '', image: '', imageAlt: '',
      cardText: '', modes: [], subtitle: '', location: '', duration: '',
      lead: '', body: [], listTitle: '', list: [], quote: '', note: '',
      accreditation: '', dates: [], price: null, seats: null, showInGallery: true,
      /* A Razorpay Payment Page / Payment Button URL that Manjula creates in her
         own dashboard and pastes in. Razorpay hosts the card form and creates
         the order on its side — the only way to take card money from a static
         site without a server. Blank = card payment not offered for this one. */
      payPageUrl: '',
      registrationOpen: true, createdAt: '', updatedAt: ''
    }, a || {});
    out.id = out.id || uid();
    out.fullTitle = out.fullTitle || out.title;
    out.body = Array.isArray(out.body) ? out.body : (out.body ? [out.body] : []);
    out.list = Array.isArray(out.list) ? out.list : [];
    out.modes = Array.isArray(out.modes) ? out.modes : [];
    out.dates = (Array.isArray(out.dates) ? out.dates : []).map(d => Object.assign(
      { id: uid(), label: '', start: '', end: '', mode: '', seats: null }, d || {}
    ));
    out.order = Number(out.order) || 0;
    return out;
  }

  const bySection = (a, b) => (a.order - b.order) || a.title.localeCompare(b.title);

  /* =========================================================
     DEMO DRIVER — localStorage
     ========================================================= */
  function demoDriver() {
    let listeners = [];
    const emit = () => { const u = currentUser(); listeners.forEach(fn => { try { fn(u); } catch (e) { console.error(e); } }); };

    function currentUser() {
      const s = readLS(LS.session, null);
      if (!s) return null;
      const users = readLS(LS.users, []);
      const u = users.find(x => x.uid === s.uid);
      if (!u) { localStorage.removeItem(LS.session); return null; }
      return { uid: u.uid, email: u.email, name: u.name, phone: u.phone || '' };
    }

    /* The seed is a starting point that can be topped up, not a one-time dump.
       On a version bump: activities Manjula has never edited are refreshed from
       the seed (that is how a new date or a rewritten poster reaches a browser
       that has already been here), genuinely new ones are added, and anything
       she has edited or deleted is left exactly as she left it. Her copy always
       wins over ours — `updatedAt` is only ever set by saveActivity. */
    function seedIfNeeded() {
      if (readLS(LS.seeded, null) === SEED.version) return;
      const seeds = (SEED.activities || []).map(normaliseActivity);
      const existing = readLS(LS.activities, null);

      if (!existing || !existing.length) {
        writeLS(LS.activities, seeds);
      } else {
        const gone = new Set(readLS(LS.deleted, []));
        const byId = new Map(existing.map(a => [a.id, a]));
        seeds.forEach(seed => {
          if (gone.has(seed.id)) return;
          const mine = byId.get(seed.id);
          if (!mine) { byId.set(seed.id, seed); return; }
          if (!mine.updatedAt) byId.set(seed.id, Object.assign({}, seed, { createdAt: mine.createdAt || seed.createdAt }));
        });
        writeLS(LS.activities, Array.from(byId.values()));
      }
      writeLS(LS.seeded, SEED.version);
    }

    return {
      name: 'demo',
      async init() { seedIfNeeded(); },

      /* ---- auth ---- */
      async signUp({ name, email, password, phone }) {
        email = lower(email);
        if (!name || !name.trim()) throw new Error('Please enter your name.');
        if (!email) throw new Error('Please enter your email address.');
        if (!password || password.length < 6) throw new Error('Please choose a password of at least 6 characters.');
        const users = readLS(LS.users, []);
        if (users.some(u => u.email === email)) throw new Error('An account already exists for that email. Try signing in instead.');
        const salt = uid();
        const user = {
          uid: uid(), name: name.trim(), email, phone: phone || '',
          salt, hash: await hashPassword(password, salt), createdAt: now()
        };
        users.push(user);
        writeLS(LS.users, users);
        writeLS(LS.session, { uid: user.uid, at: now() });
        emit();
        return currentUser();
      },

      async signIn({ email, password }) {
        email = lower(email);
        const users = readLS(LS.users, []);
        const u = users.find(x => x.email === email);
        /* Same message whether the email is unknown or the password is wrong,
           so the form can't be used to discover who has an account. */
        const wrong = new Error('That email and password don\'t match. Please try again.');
        if (!u) throw wrong;
        if ((await hashPassword(password, u.salt)) !== u.hash) throw wrong;
        writeLS(LS.session, { uid: u.uid, at: now() });
        emit();
        return currentUser();
      },

      async signOut() { localStorage.removeItem(LS.session); emit(); },

      async resetPassword() {
        throw new Error('Password reset needs the live system. In demo mode, sign up again with a different email.');
      },

      user: currentUser,
      onChange(fn) { listeners.push(fn); fn(currentUser()); return () => { listeners = listeners.filter(f => f !== fn); }; },

      /* ---- activities ---- */
      async listActivities() { seedIfNeeded(); return readLS(LS.activities, []).map(normaliseActivity).sort(bySection); },

      async saveActivity(activity) {
        const all = readLS(LS.activities, []);
        const a = normaliseActivity(activity);
        const i = all.findIndex(x => x.id === a.id);
        a.updatedAt = now();
        if (i >= 0) { a.createdAt = all[i].createdAt || now(); all[i] = a; }
        else { a.createdAt = now(); all.push(a); }
        writeLS(LS.activities, all);
        return a;
      },

      async removeActivity(id) {
        writeLS(LS.activities, readLS(LS.activities, []).filter(a => a.id !== id));
        const gone = readLS(LS.deleted, []);
        if (!gone.includes(id)) { gone.push(id); writeLS(LS.deleted, gone); }
      },

      /* ---- registrations ---- */
      async createRegistration(reg) {
        const all = readLS(LS.registrations, []);
        all.push(reg);
        writeLS(LS.registrations, all);
        return reg;
      },

      async myRegistrations(userId) {
        return readLS(LS.registrations, []).filter(r => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },

      async allRegistrations(max) {
        const cap = Number(max) || REG_PAGE;
        const all = readLS(LS.registrations, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const out = all.slice(0, cap);
        out.truncated = all.length > cap;
        return out;
      },

      async updateRegistration(id, patch) {
        const all = readLS(LS.registrations, []);
        const i = all.findIndex(r => r.id === id);
        if (i < 0) throw new Error('That registration no longer exists.');
        all[i] = Object.assign({}, all[i], patch, { updatedAt: now() });
        writeLS(LS.registrations, all);
        return all[i];
      }
    };
  }

  /* =========================================================
     FIREBASE DRIVER — Auth + Firestore
     ========================================================= */
  function firebaseDriver() {
    let fb = {}, auth = null, db = null, profile = null;
    let listeners = [];

    /* An account created in the Firebase console has no displayName and no
       users/{uid} profile, which is exactly how Manjula's is made during
       go-live. Falling back to the part before the @ keeps the header and the
       audit trail readable instead of blank. */
    const shape = u => u ? {
      uid: u.uid,
      email: u.email,
      name: (profile && profile.name) || u.displayName || String(u.email || '').split('@')[0] || 'Account',
      phone: (profile && profile.phone) || ''
    } : null;
    const emit = () => { const u = shape(auth && auth.currentUser); listeners.forEach(fn => { try { fn(u); } catch (e) { console.error(e); } }); };

    /* Firebase surfaces technical error codes; turn them into something a
       visitor can act on. */
    function friendly(e) {
      const code = (e && e.code) || '';
      const map = {
        'auth/email-already-in-use': 'An account already exists for that email. Try signing in instead.',
        'auth/invalid-email': 'That email address doesn\'t look right.',
        'auth/weak-password': 'Please choose a password of at least 6 characters.',
        'auth/invalid-credential': 'That email and password don\'t match. Please try again.',
        'auth/wrong-password': 'That email and password don\'t match. Please try again.',
        'auth/user-not-found': 'That email and password don\'t match. Please try again.',
        'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
        'auth/network-request-failed': 'Couldn\'t reach the server. Please check your connection.',
        'permission-denied': 'You don\'t have permission to do that.',
        'unavailable': 'Couldn\'t reach the database. Please check your connection and try again.',
        /* What a half-finished Firebase project actually produces. Without
           these the raw SDK string reaches the visitor. */
        'auth/operation-not-allowed': 'Email sign-in is not switched on for this site yet. Please contact the school.',
        'auth/unauthorized-domain': 'This web address is not authorised for sign-in yet. Please contact the school.',
        'auth/invalid-api-key': 'This site has not finished connecting to its database. Please contact the school.',
        'failed-precondition': 'The database is not ready yet. Please contact the school.',
        'not-found': 'That record no longer exists.',
        'resource-exhausted': 'The site is busy just now. Please try again in a few minutes.'
      };
      return new Error(map[code] || (e && e.message) || 'Something went wrong. Please try again.');
    }

    return {
      name: 'firebase',

      async init() {
        const cfg = CFG.firebase || {};
        if (!cfg.apiKey || !cfg.projectId) throw new Error('FIREBASE_NOT_CONFIGURED');
        const [app, authMod, fs] = await Promise.all([
          import(FB_URL('app')), import(FB_URL('auth')), import(FB_URL('firestore'))
        ]);
        fb = { app, authMod, fs };
        const application = app.initializeApp(cfg);
        auth = authMod.getAuth(application);
        /* Firestore's own default database is named '(default)'. A project
           can also hold named databases, and the console's create wizard
           pre-fills its Database ID box with the word 'default' - so accepting
           it yields a database the plain getFirestore(app) will never find.
           cfg.databaseId names it when that has happened. */
        db = cfg.databaseId
          ? fs.getFirestore(application, cfg.databaseId)
          : fs.getFirestore(application);
        await new Promise(resolve => {
          const stop = authMod.onAuthStateChanged(auth, async user => {
            profile = null;
            if (user) {
              try {
                const snap = await fs.getDoc(fs.doc(db, 'users', user.uid));
                if (snap.exists()) profile = snap.data();
              } catch (e) { /* profile is optional */ }
            }
            emit();
            resolve(); stop && stop();
          });
        });
        fb.authMod.onAuthStateChanged(auth, async user => {
          profile = null;
          if (user) {
            try { const s = await fs.getDoc(fs.doc(db, 'users', user.uid)); if (s.exists()) profile = s.data(); } catch (e) {}
          }
          emit();
        });
      },

      /* ---- auth ---- */
      async signUp({ name, email, password, phone }) {
        if (!name || !name.trim()) throw new Error('Please enter your name.');
        try {
          const cred = await fb.authMod.createUserWithEmailAndPassword(auth, lower(email), password);
          await fb.authMod.updateProfile(cred.user, { displayName: name.trim() });
          profile = { name: name.trim(), email: lower(email), phone: phone || '', createdAt: now() };
          await fb.fs.setDoc(fb.fs.doc(db, 'users', cred.user.uid), profile);
          emit();
          return shape(cred.user);
        } catch (e) { throw friendly(e); }
      },

      async signIn({ email, password }) {
        try {
          const cred = await fb.authMod.signInWithEmailAndPassword(auth, lower(email), password);
          try { const s = await fb.fs.getDoc(fb.fs.doc(db, 'users', cred.user.uid)); if (s.exists()) profile = s.data(); } catch (e) {}
          emit();
          return shape(cred.user);
        } catch (e) { throw friendly(e); }
      },

      async signOut() { try { await fb.authMod.signOut(auth); profile = null; emit(); } catch (e) { throw friendly(e); } },

      async resetPassword(email) {
        try { await fb.authMod.sendPasswordResetEmail(auth, lower(email)); }
        catch (e) { throw friendly(e); }
      },

      user() { return shape(auth && auth.currentUser); },
      onChange(fn) { listeners.push(fn); fn(shape(auth && auth.currentUser)); return () => { listeners = listeners.filter(f => f !== fn); }; },

      /* ---- activities ---- */
      async listActivities() {
        try {
          const snap = await fb.fs.getDocs(fb.fs.collection(db, 'activities'));
          const out = [];
          snap.forEach(d => out.push(normaliseActivity(Object.assign({ id: d.id }, d.data()))));
          return out.sort(bySection);
        } catch (e) { throw friendly(e); }
      },

      async saveActivity(activity) {
        try {
          const a = normaliseActivity(activity);
          a.updatedAt = now();
          if (!a.createdAt) a.createdAt = now();
          const data = Object.assign({}, a); delete data.id;
          await fb.fs.setDoc(fb.fs.doc(db, 'activities', a.id), data, { merge: false });
          return a;
        } catch (e) { throw friendly(e); }
      },

      async removeActivity(id) {
        try { await fb.fs.deleteDoc(fb.fs.doc(db, 'activities', id)); }
        catch (e) { throw friendly(e); }
      },

      /* ---- registrations ---- */
      async createRegistration(reg) {
        try {
          const data = Object.assign({}, reg); delete data.id;
          await fb.fs.setDoc(fb.fs.doc(db, 'registrations', reg.id), data);
          return reg;
        } catch (e) { throw friendly(e); }
      },

      async myRegistrations(userId) {
        try {
          const q = fb.fs.query(fb.fs.collection(db, 'registrations'), fb.fs.where('userId', '==', userId));
          const snap = await fb.fs.getDocs(q);
          const out = []; snap.forEach(d => out.push(Object.assign({ id: d.id }, d.data())));
          return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        } catch (e) { throw friendly(e); }
      },

      /* Bounded on purpose. An unlimited getDocs means the admin panel's cost
         and load time grow with every registration ever taken, and one bad
         actor filling the collection would make the panel unopenable - taking
         Manjula's access to the real registrations with it. Newest first,
         because that is what she is looking for; the count comes back too so
         the screen can say when it is not showing everything. */
      async allRegistrations(max) {
        try {
          const cap = Number(max) || REG_PAGE;
          const q = fb.fs.query(
            fb.fs.collection(db, 'registrations'),
            fb.fs.orderBy('createdAt', 'desc'),
            fb.fs.limit(cap + 1)                 /* one extra tells us there are more */
          );
          const snap = await fb.fs.getDocs(q);
          const out = []; snap.forEach(d => out.push(Object.assign({ id: d.id }, d.data())));
          const more = out.length > cap;
          if (more) out.pop();
          out.truncated = more;                  /* read by the admin panel */
          return out;
        } catch (e) { throw friendly(e); }
      },

      async updateRegistration(id, patch) {
        try {
          await fb.fs.updateDoc(fb.fs.doc(db, 'registrations', id), Object.assign({}, patch, { updatedAt: now() }));
          const snap = await fb.fs.getDoc(fb.fs.doc(db, 'registrations', id));
          return Object.assign({ id }, snap.data());
        } catch (e) { throw friendly(e); }
      }
    };
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */
  let driver = null;
  let fellBackToDemo = false;

  const ready = (async () => {
    const wanted = CFG.mode === 'firebase' ? 'firebase' : 'demo';
    if (wanted === 'firebase') {
      try {
        driver = firebaseDriver();
        await driver.init();
      } catch (e) {
        /* Never leave the visitor staring at a broken page because the backend
           isn't set up yet — fall back and say so loudly. */
        console.warn('[SSA] Firebase unavailable, falling back to demo mode:', e && e.message);
        fellBackToDemo = true;
        driver = demoDriver();
        await driver.init();
        /* The fallback keeps the site readable when the database cannot be
           reached. It must not keep accepting accounts, because this is a LIVE
           site: a real person would type their real password into a form that
           then SHA-256s it into localStorage on a possibly shared computer, and
           the account they thought they made would not exist. Refusing is the
           honest answer; the pages already offer WhatsApp instead. */
        const unavailable = () => {
          throw new Error('The booking system is not reachable just now. Nothing has been saved. Please message us and we will register you ourselves.');
        };
        driver.signUp = unavailable;
        driver.signIn = unavailable;
        driver.resetPassword = unavailable;
        driver.createRegistration = unavailable;
      }
    } else {
      driver = demoDriver();
      await driver.init();
    }
    return driver.name;
  })();

  function requireUser() {
    const u = driver.user();
    if (!u) throw new Error('Please sign in first.');
    return u;
  }

  window.SSA = {
    ready,
    get mode() { return driver ? driver.name : CFG.mode; },
    get isDemo() { return !driver || driver.name === 'demo'; },
    get fellBack() { return fellBackToDemo; },
    config: CFG,
    TERMS_VERSION,

    auth: {
      signUp: o => driver.signUp(o),
      signIn: o => driver.signIn(o),
      signOut: () => driver.signOut(),
      resetPassword: e => driver.resetPassword(e),
      user: () => driver && driver.user(),
      onChange: fn => driver.onChange(fn),
      isAdmin() {
        const u = driver && driver.user();
        return !!u && isAdminEmail(u.email);
      }
    },

    activities: {
      list: () => driver.listActivities(),
      async published() { return (await driver.listActivities()).filter(a => a.published); },
      async get(id) { return (await driver.listActivities()).find(a => a.id === id) || null; },
      async bySection(section) { return (await driver.listActivities()).filter(a => a.published && a.section === section); },
      save: a => driver.saveActivity(a),
      remove: id => driver.removeActivity(id),

      /* A live Firestore starts empty, so without this the first thing Manjula
         sees on the real site is a blank admin panel and a website with nothing
         to register for. Adds the built-in activities to whichever store is
         active and skips any id that is already there, so it is safe to press
         twice. Returns how many were added. */
      /* The wording a visitor reads lives in the database, not in the files, so
         editing js/seed-content.js changes nothing on a live site. These two
         close that gap: seedDiff() says what the built-in text would change,
         and applySeedText() applies it.

         Only WORDING is touched. Dates, price, seats, order, image, published
         and registrationOpen are Manjula's operational decisions and are left
         exactly as she set them - rewording a workshop must never quietly
         republish one she had hidden or reopen one she had closed. */
      get TEXT_FIELDS() {
        return ['title', 'fullTitle', 'kicker', 'subtitle', 'cardText', 'lead',
                'body', 'listTitle', 'list', 'quote', 'note', 'accreditation',
                'imageAlt', 'location', 'duration'];
      },

      async seedDiff() {
        const same = (a, b) => JSON.stringify(a == null ? '' : a) === JSON.stringify(b == null ? '' : b);
        const live = await driver.listActivities();
        const byId = new Map(live.map(a => [a.id, a]));
        const out = [];
        (SEED.activities || []).forEach(seed => {
          const mine = byId.get(seed.id);
          if (!mine) return;                       /* not here; importSeed adds those */
          const changes = window.SSA.activities.TEXT_FIELDS
            .filter(k => !same(mine[k], seed[k]))
            .map(k => ({ field: k, from: mine[k], to: seed[k] }));
          if (changes.length) out.push({ id: seed.id, title: mine.title || seed.title, changes });
        });
        return out;
      },

      async applySeedText(ids) {
        const wanted = ids && ids.length ? new Set(ids) : null;
        const live = await driver.listActivities();
        const byId = new Map(live.map(a => [a.id, a]));
        let n = 0;
        for (const seed of (SEED.activities || [])) {
          if (wanted && !wanted.has(seed.id)) continue;
          const mine = byId.get(seed.id);
          if (!mine) continue;
          const next = Object.assign({}, mine);
          window.SSA.activities.TEXT_FIELDS.forEach(k => { next[k] = seed[k]; });
          await driver.saveActivity(next);
          n++;
        }
        return n;
      },

      async importSeed() {
        const have = new Set((await driver.listActivities()).map(a => a.id));
        const fresh = (SEED.activities || []).filter(a => a && a.id && !have.has(a.id));
        for (const a of fresh) await driver.saveActivity(a);
        return fresh.length;
      }
    },

    registrations: {
      /* Builds the record itself so no page can invent its own shape, and so
         the amount is always copied from the activity rather than taken from
         anything the visitor could edit in the page. */
      async create(input) {
        const user = requireUser();
        /* Manjula entering someone who booked over WhatsApp. The record is
           marked so it's never mistaken for something the person did online,
           and so consent is recorded as given verbally rather than by a tick. */
        const byHand = !!input.enteredByAdmin && window.SSA.auth.isAdmin();
        const activity = await window.SSA.activities.get(input.activityId);
        if (!activity) throw new Error('That activity is no longer available.');
        if (!activity.registrationOpen && !byHand) throw new Error('Registration for this one is closed.');

        const date = (activity.dates || []).find(d => d.id === input.dateId) || null;
        const reg = {
          id: uid(),
          userId: user.uid,
          activityId: activity.id,
          activitySection: activity.section,
          activityTitle: activity.fullTitle || activity.title,
          dateId: date ? date.id : '',
          dateLabel: date ? date.label : '',
          mode: input.mode || (date && date.mode) || (activity.modes[0] || ''),

          name: String(input.name || '').trim(),
          /* Certificates are the whole point of a teacher training, and people
             spell their name differently there. */
          certName: String(input.certName || '').trim(),
          email: lower(input.email || user.email),
          phone: String(input.phone || '').trim(),
          isWhatsapp: input.isWhatsapp !== false,
          address: {
            line1: String((input.address && input.address.line1) || '').trim(),
            line2: String((input.address && input.address.line2) || '').trim(),
            city: String((input.address && input.address.city) || '').trim(),
            state: String((input.address && input.address.state) || '').trim(),
            pin: String((input.address && input.address.pin) || '').trim(),
            country: String((input.address && input.address.country) || 'India').trim()
          },
          notes: String(input.notes || '').trim(),

          termsAccepted: true,
          termsAcceptedAt: now(),
          termsVersion: TERMS_VERSION,
          /* 'ticked'  — they ticked the box themselves on the website
             'verbal'  — Manjula entered it and confirms they agreed by phone */
          consentMode: byHand ? 'verbal' : 'ticked',
          /* Kept separate from the terms: consenting to the contract is not
             consenting to marketing, and DPDP treats them as different things. */
          marketingOptIn: !!input.marketingOptIn,
          /* Was 'input.confirmedAdult || byHand', which made every hand-entered
             booking assert "Confirmed 18+: Yes" whether or not anyone had
             confirmed it. The consent record is evidence; it has to say what
             actually happened, and Manjula's form has its own box for this. */
          confirmedAdult: !!input.confirmedAdult,
          enteredByAdmin: byHand,
          enteredBy: byHand ? (user.email || 'admin') : '',

          ref: makeRef(activity),
          currency: (CFG.payments && CFG.payments.currency) || 'INR',
          payment: {
            method: input.paymentMethod || 'offline',   // upi-direct | razorpay | bank | cash | offline
            state: 'unpaid',
            /* Copied from the activity, never from the page — otherwise a
               visitor could edit the amount they owe before submitting. */
            amountExpected: activity.price == null ? null : Number(activity.price),
            amountReceived: null,
            providerPaymentId: '',
            utr: '',                                    // the visitor's UPI reference
            verifiedBy: '',
            verifiedAt: '',
            notes: '',
            history: [{ state: 'unpaid', at: now(), by: 'system' }]
          },

          status: 'pending',        // pending → confirmed → cancelled
          createdAt: now(),
          updatedAt: now()
        };
        return driver.createRegistration(reg);
      },

      mine() { return driver.myRegistrations(requireUser().uid); },
      all() { return driver.allRegistrations(); },
      update: (id, patch) => driver.updateRegistration(id, patch),

      PAY_STATES,

      /* Every payment-state change goes through here so the rule is enforced
         in exactly one place: a visitor can say they have started or claim they
         have paid; only an admin can record that money actually arrived. */
      async setPaymentState(id, state, extra) {
        if (!PAY_STATES.includes(state)) throw new Error('Unknown payment state: ' + state);
        const user = requireUser();
        const admin = window.SSA.auth.isAdmin();
        if (ADMIN_ONLY.includes(state) && !admin) throw new Error('Only the school can record that.');
        if (!admin && !VISITOR_MAY_SET.includes(state)) throw new Error('Only the school can record that.');

        const all = await (admin ? driver.allRegistrations() : driver.myRegistrations(user.uid));
        const reg = all.find(r => r.id === id);
        if (!reg) throw new Error('That registration could not be found.');
        if (!admin && reg.userId !== user.uid) throw new Error('That registration isn\'t yours.');

        const payment = Object.assign({}, reg.payment, extra || {}, { state });
        payment.history = (reg.payment && reg.payment.history ? reg.payment.history.slice() : []);
        payment.history.push({ state, at: now(), by: admin ? (user.email || 'admin') : 'visitor' });
        if (state === 'paid') {
          payment.verifiedBy = user.email || 'admin';
          payment.verifiedAt = now();
          if (payment.amountReceived == null) payment.amountReceived = payment.amountExpected;
        }
        const patch = { payment };
        if (state === 'paid' && reg.status === 'pending') patch.status = 'confirmed';
        return driver.updateRegistration(id, patch);
      },

      /* Visitor was handed off to a payment page. */
      markInitiated(id, method) { return window.SSA.registrations.setPaymentState(id, 'initiated', { method: method || 'upi-direct' }); },

      /* Visitor says they've sent the money and gives their UPI reference.
         This never means "paid" — Manjula confirms against her bank. */
      claimPayment(id, utr) { return window.SSA.registrations.setPaymentState(id, 'claimed', { utr: String(utr || '').trim() }); },

      /* Admin only. */
      confirmPaid(id, opts) { return window.SSA.registrations.setPaymentState(id, 'paid', opts || {}); },
      waive(id, note) { return window.SSA.registrations.setPaymentState(id, 'waived', { notes: String(note || '').trim(), amountReceived: 0 }); },
      recordCash(id, amount) { return window.SSA.registrations.setPaymentState(id, 'paid', { method: 'cash', amountReceived: amount == null ? null : Number(amount) }); }
    },

    util: {
      money(amount, cfg) {
        if (amount == null || amount === '') return '';
        const sym = (cfg || CFG.payments || {}).currencySymbol || '₹';
        return sym + Number(amount).toLocaleString('en-IN');
      },
      /* Builds a upi:// deep link, which opens whichever UPI app the phone has.
         `mam` is set equal to `am` so the amount is locked and can't be edited
         in the payment app. The reference goes in both `tn` (what Manjula sees
         in her bank statement) and `tr` (the machine-readable transaction ref),
         because matching a payment to a registration by hand is the whole job.

         Note: there is no callback and no webhook — nothing here proves a
         payment happened. It only makes paying easy and the reference findable. */
      upiLink({ vpa, name, amount, note, ref }) {
        if (!vpa) return '';
        const p = new URLSearchParams();
        p.set('pa', String(vpa).trim());
        p.set('pn', name || 'Payee');
        p.set('cu', 'INR');
        if (amount != null && amount !== '' && Number(amount) > 0) {
          const amt = Number(amount).toFixed(2);
          p.set('am', amt);
          p.set('mam', amt);
        }
        if (note) p.set('tn', String(note).replace(/[^\w\s.-]/g, ' ').slice(0, 50));
        if (ref) p.set('tr', String(ref).replace(/[^\w-]/g, '').slice(0, 35));
        /* URLSearchParams writes spaces as '+'. Some UPI apps show the payee
           name with literal plus signs, so use %20 instead. */
        return 'upi://pay?' + p.toString().replace(/\+/g, '%20');
      },
      escape(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      },

      /* Dial codes for the phone field, shared so the public form and the
         admin's hand-entry form cannot drift apart. India first because
         almost everyone here is in India; the rest alphabetical, and a browser
         select lets you type a few letters to jump. Not every country on
         earth - the ones a Chennai school plausibly hears from, which is most
         of the diaspora and everywhere the journeys go. */
      dialCodes: [
        { c: '+91',  n: 'India' },
        { c: '+61',  n: 'Australia' },
        { c: '+973', n: 'Bahrain' },
        { c: '+880', n: 'Bangladesh' },
        { c: '+32',  n: 'Belgium' },
        { c: '+55',  n: 'Brazil' },
        { c: '+1',   n: 'Canada' },
        { c: '+86',  n: 'China' },
        { c: '+45',  n: 'Denmark' },
        { c: '+20',  n: 'Egypt' },
        { c: '+358', n: 'Finland' },
        { c: '+33',  n: 'France' },
        { c: '+49',  n: 'Germany' },
        { c: '+30',  n: 'Greece' },
        { c: '+852', n: 'Hong Kong' },
        { c: '+62',  n: 'Indonesia' },
        { c: '+353', n: 'Ireland' },
        { c: '+972', n: 'Israel' },
        { c: '+39',  n: 'Italy' },
        { c: '+81',  n: 'Japan' },
        { c: '+254', n: 'Kenya' },
        { c: '+965', n: 'Kuwait' },
        { c: '+60',  n: 'Malaysia' },
        { c: '+230', n: 'Mauritius' },
        { c: '+52',  n: 'Mexico' },
        { c: '+977', n: 'Nepal' },
        { c: '+31',  n: 'Netherlands' },
        { c: '+64',  n: 'New Zealand' },
        { c: '+47',  n: 'Norway' },
        { c: '+968', n: 'Oman' },
        { c: '+92',  n: 'Pakistan' },
        { c: '+63',  n: 'Philippines' },
        { c: '+351', n: 'Portugal' },
        { c: '+974', n: 'Qatar' },
        { c: '+7',   n: 'Russia' },
        { c: '+966', n: 'Saudi Arabia' },
        { c: '+65',  n: 'Singapore' },
        { c: '+27',  n: 'South Africa' },
        { c: '+82',  n: 'South Korea' },
        { c: '+34',  n: 'Spain' },
        { c: '+94',  n: 'Sri Lanka' },
        { c: '+46',  n: 'Sweden' },
        { c: '+41',  n: 'Switzerland' },
        { c: '+66',  n: 'Thailand' },
        { c: '+90',  n: 'Turkey' },
        { c: '+256', n: 'Uganda' },
        { c: '+971', n: 'United Arab Emirates' },
        { c: '+44',  n: 'United Kingdom' },
        { c: '+1',   n: 'United States' },
        { c: '+84',  n: 'Vietnam' },
        { c: '+260', n: 'Zambia' },
        { c: '+263', n: 'Zimbabwe' }
      ],

      /* escape() is right for text but says nothing about a URL: it leaves
         javascript:alert(1) untouched, because those characters are harmless
         as text. Anything that ends up in an href needs this instead, which
         permits only ordinary web links. Returns '' for anything else, so a
         bad value yields a dead link rather than a running script. */
      safeUrl(u) {
        const raw = String(u == null ? '' : u).trim();
        if (!raw) return '';
        try {
          const parsed = new URL(raw, location.href);
          return (parsed.protocol === 'https:' || parsed.protocol === 'http:') ? raw : '';
        } catch (e) {
          return '';            /* not a URL at all */
        }
      }
    }
  };
})();
