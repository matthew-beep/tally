# TODO

## Set up Supabase + Google OAuth

### 1. Create Supabase project
- [ ] Create project at supabase.com
- [ ] Copy URL and anon key into `.env.local` (see `.env.local.example`)
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (used by `/expense/[share_token]` public page)

### 2. Run database schema
- [ ] Run the full schema from `CLAUDE.md` in the Supabase SQL editor (profiles, groups, group_members, expenses, expense_splits, settlements, notifications, etc.)
- [ ] Add the `updated_at` trigger on `expenses`
- [ ] Add the `handle_new_user` trigger on `auth.users` to auto-create a `profiles` row on sign-up
- [ ] Enable RLS and add policies (see `CLAUDE.md` — "group members only" pattern on expenses, expense_splits, settlements, etc.)

### 3. Enable Google OAuth in Supabase
- [ ] Go to Supabase → Authentication → Providers → Google
- [ ] Create a Google OAuth app in Google Cloud Console, get client ID + secret
- [ ] Paste into Supabase, set the callback URL to `https://<your-project>.supabase.co/auth/v1/callback`
- [ ] Add `http://localhost:3000` to allowed redirect URLs

### 4. Re-enable the auth guard (`src/proxy.ts`)
- [ ] Uncomment the real `proxy` function body (the block inside `/* ... */`)
- [ ] Delete the stub `export function proxy` above it
- [ ] Uncomment the `import { createServerClient }` line at the top

### 5. Re-enable the login button (`src/app/login/LoginButton.tsx`)
- [ ] Replace `router.push('/')` with the real `supabase.auth.signInWithOAuth` call
- [ ] Restore imports: `createClient` from `@/lib/supabase`, `useSearchParams` from `next/navigation`
- [ ] The full original call:
  ```ts
  const supabase = createClient()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
      },
    })
  }
  ```
