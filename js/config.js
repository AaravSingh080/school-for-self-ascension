/* =========================================================
   School for Self Ascension — configuration
   ---------------------------------------------------------
   The only file you edit to take the registration system live.
   Everything here is safe to publish: no passwords, no secret keys.
   ========================================================= */
window.SSA_CONFIG = {

  /* ---------------------------------------------------------
     1. WHERE THE DATA LIVES
     'demo'     — saves into this browser only. Nothing leaves the device,
                  nothing is shared between people. A banner says so on screen.
                  Perfect for showing the client. NOT a live system.
     'firebase' — real logins and a shared database. Fill in `firebase` below.
     --------------------------------------------------------- */
  mode: 'firebase',

  /* Paste the firebaseConfig block from the Firebase console here, then
     change mode above to 'firebase'. These values are public by design —
     what protects the data is the security rules, not this config. */
  firebase: {
    apiKey: 'AIzaSyDvoqBPUa_re_GQ3dQ-h3Rms7-gGLIZpj4',
    authDomain: 'school-for-self-ascension.firebaseapp.com',
    projectId: 'school-for-self-ascension',
    storageBucket: 'school-for-self-ascension.firebasestorage.app',
    messagingSenderId: '67986288192',
    appId: '1:67986288192:web:894c0ae368039cd59eb9a5',
    measurementId: 'G-8FN4GS6CGG',

    /* Which Firestore database inside the project. Firestore's own default is
       literally named '(default)', with the brackets. The console's create
       wizard pre-fills the Database ID box with the word 'default', and
       accepting that makes a separate, NAMED database called 'default' - which
       the SDK will not find unless it is told, giving a bare NOT_FOUND.
       This project has one called 'default'. Leave this blank for a project
       whose database really is '(default)'. */
    databaseId: 'default'
  },

  /* ---------------------------------------------------------
     2. WHO CAN REACH THE ADMIN PAGE
     Email addresses listed here see the admin panel.
     NOTE: in 'firebase' mode this list only decides what the screen SHOWS.
     The real lock is in the Firestore security rules — a visitor who edits
     this file in their own browser still cannot write anything.
     --------------------------------------------------------- */
  admins: ['archangelg9@gmail.com'],

  /* ---------------------------------------------------------
     3. THE SCHOOL
     --------------------------------------------------------- */
  school: {
    name: 'School for Self Ascension',
    teacher: 'Manjula Singh',
    phone: '+91 99620 36811',
    whatsapp: '919962036811',
    email: 'archangelg9@gmail.com',
    city: 'Chennai, India'
  },

  /* ---------------------------------------------------------
     4. PAYMENT
     UPI works with nothing but Manjula's UPI ID — no signup, no KYC.
     The visitor pays in their own UPI app and types the reference number
     back in; Manjula confirms it in the admin panel against her bank app.

     Card payments stay OFF until a payment gateway account exists. We never
     build a card-number box on this site — cards go through the provider's
     own secure page.
     --------------------------------------------------------- */
  payments: {
    currency: 'INR',
    currencySymbol: '₹',

    upi: {
      enabled: true,
      vpa: '',                         // e.g. 'manjula@okhdfcbank'. Blank hides UPI
      payeeName: 'Manjula Singh'
    },

    card: {
      enabled: false,                  // turn on once a gateway account is live
      provider: 'razorpay',
      note: 'Card payments are being set up. Please use UPI for now.'
    },

    /* Shown when no online method is available, or when someone picks
       "arrange payment with Manjula". */
    offline: {
      enabled: true,
      label: 'Payment to be done after registration',
      note: 'Hold your place now. We will be in touch about the fee and how to pay.'
    }
  },

  /* ---------------------------------------------------------
     5. REGISTRATION FORM
     --------------------------------------------------------- */
  registration: {
    requireLogin: true,                // compulsory login before registering
    collectAddress: true,
    requireTerms: true,
    termsUrl: 'terms.html',
    privacyUrl: 'privacy.html',
    refundUrl: 'refunds.html',
    /* Message shown on the confirmation screen. */
    confirmationNote: 'Every registration is read personally, and we will be in touch.'
  }
};
