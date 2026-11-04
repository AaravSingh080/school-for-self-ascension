# Registration system — setup

The site now has logins, an admin panel, registrations and UPI payment.
It ships in **demo mode**, which works immediately and needs no accounts.

---

## What demo mode is

Everything runs, but data is saved in the visitor's own browser only. Nothing is
shared between devices and nothing reaches Manjula. Every page says so on screen.

Use it to show Manjula the whole flow and get her approval. **Do not leave the
site in demo mode once people might actually try to register** — they'd fill in
the form, see "your place is held", and nobody would ever hear about it.

---

## Going live — about 15 minutes

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Name it `school-for-self-ascension`. Google Analytics can be **off**.
3. **Build → Authentication → Get started → Email/Password → Enable → Save**.
4. **Build → Firestore Database → Create database → Production mode**.
   Location **asia-south1 (Mumbai)**. ⚠️ *This can never be changed later.*
5. **Project settings** (gear icon) → **Your apps** → the **`</>`** web icon →
   nickname `website` → **Register app**.
6. Copy the `firebaseConfig = { ... }` block it shows you.

### 2. Put the config in the site
Open `js/config.js` and:
- paste the values into the `firebase: { ... }` block;
- change `mode: 'demo'` to `mode: 'firebase'`.

These values are *meant* to be public — they're an address, not a password.
What protects the data is step 4.

### 3. Create Manjula's account
Open the live site, click **Sign in → Create an account**, and sign up with the
address in `admins` in `js/config.js` (currently `archangelg9@gmail.com`).

Then open **`admin.html`** (or **School sign-in** at the bottom of the website).
A brand-new database is empty, so the activities tab will offer
**“Add the starting activities”** — press it once and the ten activities already
written for the site are put in, ready to edit. It is safe to press twice.

### 4. Lock the database — do not skip this
1. In Firebase: **Authentication → Users**, copy the **User UID** for that account.
2. Open `firestore.rules`, replace `REPLACE_WITH_MANJULA_UID` with that UID.
3. In Firebase: **Firestore Database → Rules**, paste the whole file, **Publish**.

Until this is done the database is open. Every line of JavaScript on the site is
public and editable by any visitor, so these rules are the only real protection —
the `admins` list in `js/config.js` just decides what the screen shows.

### 5. Add the UPI ID
In `js/config.js`, set `payments.upi.vpa` to Manjula's UPI ID
(e.g. `manjula@okhdfcbank`). Leave it blank and the UPI option is hidden.

---

## How payment works, honestly

There is **no payment gateway**. The site shows a QR code and a UPI link with the
amount locked and a reference like `SSA-ANG26-KV7Q`. The visitor pays in their own
UPI app and types their reference number back in.

That marks the registration **"says they've paid"** — never "paid". Manjula checks
her bank, then presses **Confirm paid** in the admin panel. Only she can do that;
a visitor cannot mark themselves paid even by editing the page (verified by test).

This is deliberate. A static site has no server to receive a payment confirmation,
so "paid" can only ever be something a human has seen.

### Adding card payments later
Card payments need a Razorpay account (business KYC, PAN, bank account) and the
policy pages that are now live on this site. Then create a **Payment Page** in the
Razorpay dashboard and paste its URL into the activity's `payPageUrl`, and set
`payments.card.enabled: true`.

**Do not** integrate Razorpay Standard Checkout from this site. It requires an
`order_id` that can only be created with the secret key, and Razorpay's docs state
that payments made without one are automatically refunded — the money would be lost.

---

## Changing an activity later

Two ways, and they do different things.

**In the admin panel** — the normal way. Whatever you change there is yours and
the site will never overwrite it.

**In `js/seed-content.js`** — for the built-in copy, e.g. next year's dates.
Edit the activity *and* raise `version:` at the top of the file by one. On the
next visit each browser will:

- refresh activities **nobody has edited in the admin panel** — this is how new
  dates reach someone who has been to the site before;
- add activities that are genuinely new;
- leave anything edited in the admin panel exactly as it is;
- keep anything deleted deleted.

If you forget to raise `version:`, nothing happens — that is the usual reason a
change “doesn't show up”.

---

## Files

| File | What it is |
|---|---|
| `js/config.js` | **The only file you normally edit.** Mode, Firebase, admins, UPI. |
| `firestore.rules` | Paste into Firebase. The real security. |
| `js/seed-content.js` | The starting activities, and the fallback if the database is unreachable. |
| `js/store.js` | Data layer. Demo and Firebase behind one API. |
| `js/auth-ui.js` | Sign-in dialog. |
| `js/register.js` / `register.html` | The registration form. |
| `js/admin.js` / `admin.html` | Admin panel. |
| `js/my-registrations.js` | A visitor's own registrations. |
| `js/site-activities.js` | Renders activities onto the homepage. |
| `js/vendor/qrcode.js` | QR encoder (MIT, Kazuhiko Arase), kept local so the UPI ID goes to no one. |
| `terms.html`, `privacy.html`, `refunds.html` | Required before any payment gateway will approve an account. |

**When you change a `.js` or `.css` file, bump its `?v=` number** in every HTML
file that loads it, or browsers will keep serving the old one.

---

## Still to do

- **The video** → `assets/video/film.mp4`.
- **Get the legal pages checked.** They were written to be honest and readable,
  not by a lawyer. The refund tiers for journeys in particular should match what
  the tour operator actually refunds, or Manjula absorbs the difference herself.
- **Ask Razorpay before building on them** whether they will onboard this business
  category. Several providers restrict spiritual services. Describe it as
  *education and training workshops*, which is what it is.
- **A custom domain** (~₹1,000/year) would help: payment providers look at a
  `github.io` address and a personal Gmail unfavourably at underwriting.

## One operational warning

The most likely privacy incident here is not the website — it's adding workshop
registrants to a **WhatsApp group**, which shows every participant's phone number
to every other participant. Use a Broadcast list or a Channel, or BCC email.
