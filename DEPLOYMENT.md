# DuoLife Production Deployment

## Required environment variables

Set these in your hosting provider:

```env
VITE_SUPABASE_URL=https://ueghpvrqozduxjjhoqys.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Never add `service_role` keys to the frontend.

## Supabase checklist

1. Run `supabase/schema.sql` in the SQL Editor.
2. Confirm the `couple_members` view is `security_invoker`.
3. Enable realtime only for:
   - `events`
   - `tasks`
   - `expenses`
4. In Authentication settings, add the production domain to allowed redirect URLs.
5. Keep RLS enabled on all application tables.

## Vercel

1. Import `https://github.com/jose12335e/enequipo`.
2. Framework preset: Vite.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add the required environment variables.
6. Deploy.

`vercel.json` handles SPA rewrites and basic security headers.

## Netlify

1. Import the GitHub repository.
2. Build command: `npm run build`.
3. Publish directory: `dist`.
4. Add the required environment variables.
5. Deploy.

`netlify.toml` handles SPA redirects and basic security headers.

## GitHub Actions

The CI workflow runs:

```bash
npm ci
npm run lint
npm run test
npm run build
```

Add these repository secrets if you want the build to use real production variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
