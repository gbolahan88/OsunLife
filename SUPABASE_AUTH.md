# Email registration, username login

1. Keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.
2. Add `SUPABASE_SECRET_KEY` to `.env.local` using the project's secret key from **Settings > API Keys**. Never prefix it with `NEXT_PUBLIC_`, commit it, or share it in chat.
3. Run `supabase/migrations/20261009000000_username_profiles.sql` in the Supabase SQL Editor.
4. Keep the Email provider enabled. Email confirmation may remain on; players must confirm the signup email before username login works.
5. Set the Supabase Auth Site URL to your app origin and allow that origin in Redirect URLs. Configure custom SMTP before opening signup to the public; Supabase's default mailer is restricted and rate-limited.
6. Restart the dev server after changing environment variables.

Signup uses the player's real email. A private `profiles` table maps normalized, unique usernames to Auth user IDs. The server-only secret key resolves the username and account email for sign-in; the browser never receives that key, and RLS prevents users from reading other profiles.
