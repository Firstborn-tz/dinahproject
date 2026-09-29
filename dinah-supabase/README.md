# Dinah Stationaries — Production Build (Supabase + Vercel)

Developed by Progr_Willy — this build by Claude.

This is a full architecture change from the earlier Express/JSON-file
prototype: the backend is now **Supabase** (Postgres + Auth + Row Level
Security + Edge Functions), and the frontend is a static site built for
**Vercel**. No Node server to run or keep alive — Supabase and Vercel both
host it for you on free tiers.

## Code layout — one file per page

`frontend/js/` is now real ES modules (native browser `import`/`export`,
still zero build step — Vercel just serves the files as-is):

```
js/
  state.js            shared app state (who's logged in, selected branch, cart...)
  supabase-client.js  the Supabase client (sessionStorage-based sessions)
  icons.js            every SVG icon
  theme.js            light/dark mode
  ui.js               toasts, confirm/prompt dialogs, tables, formatting, dropdowns
  auth.js             login, forgot/reset password, logout
  landing.js          the public site
  layout.js           sidebar, topbar, router — one entry per page file below
  main.js             entry point loaded by index.html
  pages/
    manager/          dashboard.js, branches.js, users.js, products.js,
                       requests.js, inventory.js, resources.js, returns.js,
                       cash-collection.js, reports.js, audit.js, settings.js
    cashier/          dashboard.js, pos.js, resources.js, requests.js, daily-closing.js
    shared/           services.js, sales.js, profile.js  (used by both roles)
```
Each page file only imports what it needs and attaches its own `onclick`
handlers to `window` at the bottom — open any one file and everything about
that page is right there.

## This round's fixes

- **"invalid input syntax for type uuid: undefined"** — root-caused: several
  pages queried by branch before a branch existed or was selected (a fresh
  install starts with zero branches). Every branch-scoped page now calls a
  shared `resolveBranchId()` guard first and shows a friendly message
  ("Create a branch first") instead of firing a broken query.
- **Mobile top bars and the dashboard chart** — the public nav, app topbar,
  and "Sales by Branch" chart are now properly responsive: the topbar
  collapses to icon-only on phones, the chart scrolls horizontally instead
  of squashing, and touch targets are back to 44px+.
- **Faster loads everywhere** — the landing page's four data requests
  (settings/products/services/branches) now fire in parallel instead of one
  after another; the entire authenticated app (sidebar + every admin/cashier
  page) now only downloads *after* someone logs in, so a visitor just
  browsing the landing page loads a much smaller page; fonts get an extra
  `preconnect`; `js/main.js` is preloaded.
- **The centered loading animation you specified** — shown full-page on
  first load (`#page-loader`), and reused (smaller) inside any panel/table
  while its data is fetching.
- **Password reset links now actually work** — see step 1.6 above; this
  needed both a required one-time Supabase dashboard setting and a code fix
  (the app was letting the temporary recovery session log the user straight
  into the dashboard instead of showing the "set a new password" form;
  expired/used links now show a clear message instead of doing nothing).
- **Admins can reset a Cashier's password directly** — new **Reset
  Password** button on the Users page (Admin sets it and shares it with
  them directly) alongside **Email Reset Link** (sends the normal
  self-service email instead).
- **Branches now require a Google Maps link**, and the landing page has a
  new **Our Branches** section listing each one with a "View on Map"
  button. Existing branches (if any) show "Missing" until edited.



- **Light/dark theme** — a toggle button (sun/moon icon) in the public nav
  and the app topbar. Follows your OS preference automatically until you
  pick one explicitly, then remembers your choice (`localStorage`). Sidebar
  and top bar stay the same dark navy in both themes by design; content
  areas (cards, panels, tables, modals, forms) switch.
- **Dropdown user menu** — the topbar now shows your avatar initials, name,
  and role behind a proper dropdown (My Profile / Logout), animated open and
  closed, closes on outside click or Escape. The branch selector and other
  `<select>` elements got a matching custom-arrow, theme-aware redesign.
- **Sessions now end when you close the browser.** Previously, logging in
  persisted forever (`localStorage`), so re-opening the site later dropped
  you straight back into the dashboard. The auth token now lives in
  `sessionStorage` instead — closing the browser/tab clears it, so opening
  the site again always asks you to log in. Reloading the page or
  navigating around *during* a visit keeps you logged in as normal.
- **Faster loads** — a `preconnect` hint opens the connection to Supabase
  before the rest of the page finishes parsing; Vercel cache headers
  (`vercel.json`) keep `index.html` always-fresh while briefly caching
  `style.css`/`app.js` for repeat visits; the POS search box is debounced;
  data fetches that don't depend on each other run in parallel
  (`Promise.all`) rather than one-after-another.
- **`robots.txt`** added so search engines can index your public landing page.


---

## How it's built (read this before you touch anything)

- **Every table** in the database has Row Level Security turned on with
  **zero policies** — meaning the raw tables are completely unreachable from
  the browser, on purpose.
- **All reads** go through database **views** (e.g. `branch_inventory_view`,
  `sales_view`). Each view manually filters rows (by branch) and columns
  (e.g. hides `buying_price` from cashiers) — this is the standard, documented
  Supabase pattern for column-level security, since RLS alone is row-level only.
- **All writes** go through database **functions** (e.g. `create_sale`,
  `void_sale`, `adjust_stock`) called via `supabase.rpc(...)`. Every function
  checks who's calling and rejects anything they shouldn't be able to do —
  this is where all the business rules live (branch isolation, stock
  validation, atomic multi-table updates, audit logging).
- **One exception:** creating a login (an "Admin" or "Cashier" account) has
  to go through Supabase's Admin API, which requires a secret key that must
  never reach the browser. That one piece lives in a small **Edge Function**
  (`supabase/functions/create-user`) instead of in SQL.

Everything is in `supabase/migrations/0001_init.sql` — one file, meant to be
run once in the Supabase SQL Editor. It's complex, hand-written SQL; I've
checked it carefully for balanced syntax, but I can't run a live Postgres
instance from here to execute it end-to-end. **If any specific line throws
an error when you run it, paste that exact error back to me and I'll fix
that statement** — much easier than debugging blind.

---

## Part 1 — Set up Supabase

### 1.1 Create the project
1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New Project**.
2. Pick a name, a strong database password (save it somewhere), and a region
   close to your customers.
3. Wait ~2 minutes for provisioning.

### 1.2 Run the schema
1. In your project, open **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_init.sql` from this project, copy its
   entire contents, paste into the editor, and click **Run**.
3. You should see "Success. No rows returned." Check **Table Editor** on the
   left — you should see `branches`, `profiles`, `products`, `sales`, etc.
4. Run `supabase/migrations/0002_branch_map_link.sql` the same way (new
   query, paste, Run). This adds the required Google Maps link per branch
   and the public branch listing used on the landing page.

### 1.3 Get your API keys
1. **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** and the **anon / public** key (NOT the
   `service_role` key — that one never goes in the frontend).
3. Open `frontend/index.html`, find this block near the top, and fill in
   your real values:
   ```html
   <script>
     window.SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
     window.SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
   </script>
   ```

### 1.4 Deploy the create-user Edge Function
This needs the Supabase CLI (one-time install):
```bash
npm install -g supabase
supabase login
cd dinah-supabase
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy create-user
supabase functions deploy admin-reset-password
```
(Find `YOUR-PROJECT-REF` in your project URL, or under Project Settings.)
No extra environment variables needed — `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are automatically available inside every Edge
Function. The second function is what lets an Admin reset a Cashier's
password directly from the **Users** page.

### 1.5 Bootstrap your first Admin account
Normal user creation happens through the app (a Manager creates other users
from the **Users** page) — but that means the *very first* Admin has to be
created manually, once:

1. Supabase Dashboard → **Authentication** → **Users** → **Add user**.
2. Enter your real email and a password. **Check "Auto Confirm User"** so
   you don't need to click an email confirmation link.
3. Click the new user, and copy their **User UID**.
4. Go to **SQL Editor** → new query → run (replacing the UUID and name):
   ```sql
   insert into public.profiles (id, full_name, role, active)
   values ('PASTE-THE-USER-UID-HERE', 'Your Full Name', 'MANAGER', true);
   ```
5. That's it — you can now log in on the site with that email/password as
   an Admin, and create every other user (Admins and Cashiers) from the
   **Users** page from now on.

### 1.6 Make password-reset links actually work (required)
The reset email is sent correctly, but Supabase will silently refuse to
complete the login if the link's destination isn't on its allow-list — this
is almost always why a reset link "doesn't work." Fix it once:

1. Supabase Dashboard → **Authentication** → **URL Configuration**.
2. Set **Site URL** to your real deployed frontend, e.g.
   `https://your-project.vercel.app` (or your custom domain once you have one).
3. Under **Redirect URLs**, add the same URL, ideally as a wildcard so it
   still works after preview deploys: `https://your-project.vercel.app/**`.
4. Save. Test the whole flow end to end: Login screen → Forgot Password →
   check the email → click the link → you should land back on the site with
   a "Set a New Password" form open automatically, not the dashboard.

If you ever see the reset link land you on the dashboard instead of the
reset form, or show an "invalid or expired" toast, it's one of: this step
wasn't done, the link is genuinely more than an hour old, or it was already
used once (each link works only one time).

### 1.7 Email delivery for password reset (Brevo)
Supabase sends password-reset (and login-related) emails out of the box
using its own limited email service. To send them through **Brevo**
instead — for both password reset and future auth emails:

1. Supabase Dashboard → **Authentication** → **Settings** → **SMTP Settings** → toggle **Enable Custom SMTP** on.
2. Fill in:
   ```
   Sender email:    (an email address you've verified as a sender in Brevo)
   Sender name:     Dinah Stationaries
   Host:            smtp-relay.brevo.com
   Port:            587
   Username:        (your Brevo SMTP "Login" value — see below)
   Password:        (your Brevo SMTP key)
   ```
3. **Where to find the Username + Password together:** Brevo Dashboard →
   click your profile icon (top right) → **SMTP & API** → **SMTP** tab. Both
   the **Login** (username) and the **SMTP key** (password) are shown on
   that same page — copy the Login value from there; it's usually a string
   ending in `@smtp-brevo.com`, not your regular Brevo account email.
4. Click **Save**.

**Important — this credential is a secret, not a public value.** It goes
*only* into that Supabase dashboard field above. It must never be pasted
into `index.html`, `app.js`, any file in this repo, or anywhere that ends up
on GitHub or in your browser's source — unlike the Supabase anon key (which
is safe to expose, and is already in `index.html`), an SMTP password lets
someone send email *as your account* if it leaks. If you've shared this key
anywhere it could be seen by others (a chat log, a screenshot, a public
repo), the safe move is to regenerate it in Brevo afterward — it costs
nothing and takes 10 seconds (same SMTP & API page → regenerate key).

---

## Part 2 — Deploy the frontend to Vercel

1. Push this project to GitHub (same as before):
   ```bash
   git init
   git add .
   git commit -m "Dinah Stationaries - Supabase production build"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/dinah-stationaries.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project** → import your repo.
3. Configure:
   - **Framework Preset:** Other
   - **Root Directory:** `frontend`
   - **Build Command:** leave empty
   - **Output Directory:** leave as default
4. Click **Deploy**. You'll get a URL like `https://dinah-stationaries.vercel.app`.
5. Open it and test: landing page loads, login works with your bootstrapped
   Admin account, dashboard loads.

**Note:** `frontend/index.html` already has your real Supabase project URL
and anon key filled in — there's nothing left to edit before deploying, and
no Vercel environment variables to set. The anon key is safe to have
visible in your site's source; it can only do what your RLS/views/functions
allow it to do.

### Custom domain (optional)
Vercel project → **Settings → Domains → Add** → follow the CNAME
instructions at your DNS provider → free SSL is issued automatically. See
the earlier `DOMAIN_DEPLOYMENT.md` guide for the general pattern (same idea,
just Vercel instead of Netlify).

---

## Adding your own photos

The landing page ships with three placeholder "photo slots" (in the
**Inside Dinah Stationaries** section) styled to look intentional, not
broken — but real photos of your actual shop will convert far better than
any stock photo. To swap one in:

1. Open `frontend/index.html`, find the `<!-- PHOTO SLOT ... -->` comments.
2. Replace the whole `<div class="photo-slot">...</div>` with:
   ```html
   <img class="photo-slot" src="YOUR-IMAGE-URL" alt="Description of the photo" />
   ```
3. **Where to get a URL:**
   - **Best option:** upload your own shop photo to
     [postimages.org](https://postimages.org) (free, no account needed) or
     any image host, and use the direct link it gives you.
   - **No shop photo yet:** [unsplash.com](https://unsplash.com) and
     [pexels.com](https://pexels.com) are both free for commercial use, no
     attribution required — search "stationery", "office supplies", or
     "notebook desk", open a photo you like, right-click → Copy Image
     Address, and use that as your `src`.
4. Commit and push — Vercel redeploys automatically.

I didn't hardcode any stock photo URLs into the page myself: I can't verify
a specific web image's license from here, and putting an unlicensed photo
into your live commercial site is a real risk I'd rather you avoid than
inherit from me.

---

## What's genuinely different from the earlier Express version
- **No server to keep running** — Supabase and Vercel are both always-on
  managed services on their free tiers (subject to their own free-tier
  limits — check current Supabase/Vercel pricing pages for specifics).
- **Real atomic transactions** — every Postgres function runs as one
  transaction; a sale either fully commits (stock decremented, sale
  recorded, totals updated) or fully rolls back, with no partial-write edge
  cases possible.
- **Real concurrency safety** — stock rows are row-locked (`for update`)
  during a sale, so two cashiers can't oversell the same last item in a race.
- **Email login** instead of username — Supabase Auth's native method,
  which is also what makes the built-in password-reset flow work with no
  custom email code needed.

## What's still worth building next
- **Offline-first PWA** — this version still assumes an internet connection;
  offline support (Dexie/IndexedDB + a sync queue against the same RPC
  functions) is the natural next step, same as noted for the earlier build.
- **Purchase-unit ↔ base-unit conversion**, **printable receipts**, richer
  **charts**, and **automated tests** — all still open, same as before.
- **Multiple Admins editing the same settings/users concurrently** works
  correctly (Postgres handles it), but there's no UI-level "someone else
  just changed this" notice — acceptable for a small business, worth adding
  if you grow to a larger team.

## Testing checklist before you rely on this for real sales
- [ ] Ran the full migration with no errors
- [ ] Deployed the `create-user` Edge Function
- [ ] Bootstrapped your first Admin and logged in successfully
- [ ] Created a branch, a cashier, a product, assigned stock
- [ ] Logged in as that cashier, completed a POS sale, confirmed stock decreased
- [ ] Confirmed the cashier cannot see buying price/profit anywhere in the UI
- [ ] Tried "Forgot Password" and received (or previewed) the reset email
- [ ] Manager → Settings has your real business details, not placeholders
- [ ] Custom domain (if used) shows a valid HTTPS padlock
