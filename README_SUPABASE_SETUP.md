# Supabase Setup — MediEdu / Anti-Hunchback

This guide wires the app to a real Supabase backend so cross-device sync
(plus parent↔student realtime) works. Until `.env` is configured the app
runs in **local-only mode**: all data stays in `localStorage` (scoped per
user), Supabase Auth is bypassed, and the cross-device realtime channels
no-op. Both modes are fully supported.

> **You (the developer / project owner) must perform the steps below
> yourself.** The repo intentionally does NOT ship `.env` — credentials
> were stripped in commit `5d80671` to keep the public repo safe. Do not
> paste real Supabase keys into chat, commits, or screenshots.

---

## 1. Copy `.env.example` → `.env`

```bash
cp .env.example .env
```

Open `.env` and replace the placeholders:

```dotenv
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Both values are in your Supabase project dashboard:
**Project Settings → API → Project URL** and **Project API keys → anon public**.

`.env` is in `.gitignore` and will never be committed.

## 2. Apply the database schema

Open the Supabase dashboard → **SQL Editor** → **New query**, paste the
entire contents of `supabase_schema.sql` from this repo, and click
**Run**. The script is idempotent (drops existing tables/policies before
recreating) so it is safe to re-run.

It will create:

| Table | Purpose |
|---|---|
| `profiles` | Public mirror of `auth.users` (name, role, link codes) |
| `calibration` | Per-user posture baseline (eye distance, neck offset, EAR) |
| `settings` | Per-user thresholds (screen distance, neck tilt, blink rate, ...) |
| `user_stats` | Gamification state (XP, level, streak, coins, equipped items) |
| `sessions` | Study session history (duration, health score, posture %) |
| `notifications` | Parent notifications (camera off, fatigue, etc.) |

A `handle_new_user()` trigger automatically inserts a `profiles` row
whenever someone signs up, copying `user_metadata.role` /
`user_metadata.linkedCode` into the public table so the parent↔student
link flow works without a second round-trip.

Row Level Security is enabled on every table — a user can only read /
write their own rows (filtered by `auth.uid() = user_id`).

## 3. Restart the dev server

```bash
npm run dev
```

Vite reads `VITE_SUPABASE_*` at startup; an already-running dev server
will not pick up new env vars without a restart.

## 4. Verify the wiring

1. **Sign up** a new student account with a real email.
2. Open Supabase dashboard → **Table Editor** → you should see:
   - a row in `profiles` with the new user's `id`, `name`, `role='student'`,
     and a 6-digit `linked_code`.
   - a row in `user_stats` for the same `user_id` with `xp=0`, `level=1`.
3. **Sign out**, then sign up a **second** student account.
   - The new account should NOT see any sessions or stats from the first.
   - This is the user-scoped storage isolation: `oliver_user_stats:<id>`
     and `oliver_study_sessions:<id>` in localStorage, plus RLS in
     Supabase. (Without this, "tài khoản mới thấy data cũ" was the bug.)
4. Sign in as the **first** account on a different browser/machine.
   - On login, `syncFromSupabase()` runs and pulls `calibration`,
     `settings`, `user_stats`, `sessions` from Supabase into the
     user-scoped localStorage keys. Verify the devtools console logs
     `[sync] result: true | user: <uuid>`.
5. Run a study session on machine 1 → on machine 2, switch tabs or
   re-focus the window → the data should refresh from Supabase.

## 5. Production (Vercel)

In your Vercel project settings → **Environment Variables**, add the
same two keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Redeploy.
The `.env` file is not used in Vercel — only the project settings.

---

## How local-only mode differs

When `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing (or
`.env` doesn't exist), `src/services/supabase.ts` exports
`supabase = null` and `isSupabaseConfigured = false`. Effects:

- `supabase.auth.signUp` / `signInWithPassword` are skipped — the app
  uses the local `oliver_users` list (encrypted in localStorage) for
  auth. Usernames are accepted; with Supabase configured, only real
  emails work (Supabase rejects usernames).
- `syncFromSupabase()` returns `false` immediately; no network calls.
- All `pushXToSupabase()` helpers early-return; data stays local.
- Realtime channels (parent↔student sync, presence for the dual-camera
  feature) skip the Supabase transport and fall back to `BroadcastChannel`
  — which only works between tabs in the same browser, not across
  devices. Useful for development demos.

Storage isolation still works in local-only mode: the user's email or
username becomes the stable `id` (set in `AuthScreen.tsx`), and
`storageKey('user_stats', id)` returns `oliver_user_stats:<email>`.

## Migrating existing local data

If you've been running in local-only mode and later add Supabase, the
first time a user signs in with Supabase auth the app calls
`migrateLegacyDataIfNeeded(userId)`. This copies any data under the
legacy unscoped keys (`oliver_user_stats`, `oliver_study_sessions`,
...) into the new scoped keys (`oliver_user_stats:<uuid>`) so the
user doesn't lose their history. The legacy keys are left in place as
a backup; signing out removes only the scoped keys via
`clearUserDataOnLogout(userId)`.

## Troubleshooting

- **"Cannot read properties of null (reading 'auth')"** — `supabase` is
  `null` because env vars are missing. Restart dev server after
  editing `.env`.
- **"Failed to fetch"** during sign-up — usually an Adblocker / Brave
  Shield / corporate firewall blocking `*.supabase.co`. Disable the
  blocker for the dev origin and retry.
- **New account still shows old session count** — confirm
  `oliver_current_user` in localStorage has an `id` field. If it
  doesn't, log out and back in (the AuthScreen now sets `id` on every
  login path). The user-scoped keys are `oliver_user_stats:<id>`.
- **`[sync] result: false`** in console — Supabase is reachable but
  `syncFromSupabase` returned `false`. Most often the schema hasn't
  been applied yet (the `from('user_stats').select()` query throws).
  Apply `supabase_schema.sql` and retry.
