# Cloud backup: Supabase setup

One-off steps in the Supabase dashboard for the `repfuel` project (the app already has its URL and publishable key in
`src/services/cloud/config.ts`).

1. **Storage and rules.** SQL Editor › New query › paste all of `supabase/setup.sql` › **Run**. It creates the private
   `backups` bucket and the rules that let each account use only its own folder.
2. **Put the code in the sign-in emails.** Authentication › Emails (Email Templates). Edit both **Confirm signup**
   (first sign-in) and **Magic Link** (later sign-ins). Set the subject to `Your RepFuel code` and the body to:

   ```html
   <h2>Your RepFuel code</h2>
   <p>Enter this code in RepFuel: <strong>{{ .Token }}</strong></p>
   <p>If you didn't ask for it, you can ignore this email.</p>
   ```

   Save each one.
3. That's all. In RepFuel: Settings › Cloud backup › Turn on cloud backup › your email › Send code › type the code.

Notes:
- Supabase's built-in email sender allows only a few emails an hour, which is plenty for a couple of people.
- A free project pauses after a week with no use. RepFuel backs up whenever it's opened online, so daily use keeps it
  awake. If it does pause, Supabase › the project › **Restore project**; nothing is lost.
- The project owner can see every account's backups in Storage. Tell anyone you share RepFuel with.
