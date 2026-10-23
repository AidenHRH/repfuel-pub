# Cloud backup: Supabase setup

One-off steps in the Supabase dashboard for the `repfuel` project (the app already has its URL and publishable key in
`src/services/cloud/config.ts`).

1. **Storage and rules.** SQL Editor › New query › paste all of `supabase/setup.sql` › **Run**. It creates the private
   `backups` bucket and the rules that let each account use only its own folder.
2. **No sign-in emails.** Authentication › Sign In / Providers › **Email**: turn **off Confirm email** and save. RepFuel
   signs in with an email and password, so no emails are sent (the free plan's email templates are locked without
   your own email service, and its sender allows only a few emails an hour).
3. That's all. In RepFuel: Settings › Cloud backup › Turn on cloud backup › your email and a password › Create account
   (the first time; Sign in on another phone).

Notes:
- Forgotten password: in Supabase › Authentication › Users, open the account and set a new password.
- A free project pauses after a week with no use. RepFuel backs up whenever it's opened online, so daily use keeps it
  awake. If it does pause, Supabase › the project › **Restore project**; nothing is lost.
- The project owner can see every account's backups in Storage. Tell anyone you share RepFuel with.
