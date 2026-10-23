# Cloud backup with Supabase — design

Status: approved (2026-10-23).

## Why

RepFuel keeps everything on the phone. A lost, broken or replaced phone loses every log, recipe photo and PR
(photos aren't even in the file backup). The owner wants the data stored off the phone, may share the app with a
friend for feedback, and WHOOP will need a server later to hold its secret key. Supabase (free tier) covers all
three, so it's set up now while it's small.

## Goals

- Nothing is lost when a phone is: sign in on a new phone, restore, carry on.
- Each person has their own account and can only ever see their own backups (the owner and a friend).
- The phone stays the main copy: logging works offline and never waits for the server.
- Sync happens on its own when there's internet, and there's a **Sync now** button.

## Non-goals (for now)

- Live sync between two devices, or a web view. (Possible later: see Approaches.)
- WHOOP itself: it comes with Health Connect; this only puts the server in place.
- Encrypting backups with a separate passphrase. The owner, as project owner, can technically see a friend's backup;
  the friend is told this.

## Anti-goals

- A sync that overwrites good data with bad: restoring is never automatic over existing data, and the server keeps
  older copies.
- Logging that fails or stalls because the server is unreachable or paused.

## Approaches

1. **Snapshot backup to Supabase Storage (chosen; my recommendation).** The app already turns the whole database
   into one JSON file (Settings › Back up to a file). Sync uploads that file plus any new photos to the person's own
   private folder. Restore downloads them. No tables to design, every table is covered automatically, and backups
   from older versions already restore. Costs: it's a whole-database copy each time (a few MB at most), and it's
   backup, not live sync.
2. **Row-by-row sync to Postgres tables.** Every table mirrored on the server with change tracking and merging.
   Needed for live sync across devices; several times the work, and a bug can corrupt data in two places. Not worth
   it until there's a second device to sync.
3. **Google Drive backup.** Simpler to sign in, but gives no server for WHOOP or for a shared app later.

## How it works

**Accounts.** Settings › **Cloud backup** › enter your email › Supabase emails a 6-digit code › type it in. Signed in
until you sign out. (A code instead of a link, so no deep-link setup is needed for the APK.) The friend does the
same with their email and gets their own account.

**What's uploaded**, to the private bucket `backups`, under the person's account id:
- `<user>/backup-<YYYY-MM-DD>.json`: the same file as Back up to a file. One per day (a later sync that day
  replaces it); copies older than 14 days are deleted, so a bad day can be undone.
- `<user>/photos/<file>`: recipe photos, each uploaded once (photos never change, only get added or removed).

**When it syncs.**
- Automatically when the app opens or comes back to the front, if something changed since the last sync and there's
  internet. Quietly: no error pop-ups.
- **Sync now** in Settings › Cloud backup, any time.
- Settings shows "Last backed up 14:32 today" or what went wrong.

**Restore.**
- Signing in on a phone with no data offers **Restore from your backup** (date shown) straight away.
- On a phone that already has data, **Restore from cloud** is in Settings and asks first: "This replaces what's on
  this phone with your backup from 22 Oct."
- Photos come back to the phone and the recipes point at them again.

**When the server can't be reached.** Offline: "Not backed up yet. Will try again when you're online." Paused
project (free projects pause after 7 days with no use): "Couldn't reach the server. If nobody has used RepFuel for a
week, open supabase.com and press Restore project." Logging is never affected.

**Security.** Storage rules let a signed-in person read and write only their own folder. The app holds the
publishable key only; the secret key stays in Supabase and is never in the app or the repo.

## What the owner does

1. Already done: project `repfuel` created (URL and publishable key given).
2. Paste `supabase/setup.sql` (in the repo) into Supabase › SQL Editor and press Run: it makes the private
   `backups` bucket and the own-folder-only rules.
3. Authentication › Email Templates › **Magic Link**: add `{{ .Token }}` to the message so the email contains the
   code (exact text given in the setup notes).
4. Tell the friend, before they sign in, that their backup sits in the owner's Supabase project.

Supabase's built-in email sender is limited to a few emails an hour, which is plenty for two people signing in.

## Builder's calls (left to the plan)

- Library: `@supabase/supabase-js`, with the session kept in the app's own storage, following the Expo guide for
  Supabase.
- Exact screen layout within the design tokens; tests use a pretend server (this environment can't reach
  supabase.co), so the first real sync happens on the owner's phone.
- Release as 0.20.0 once GitHub Actions builds again.
