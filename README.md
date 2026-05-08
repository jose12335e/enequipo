# DuoLife

DuoLife is a shared couple app built with React, Vite, TypeScript, Tailwind CSS, Zustand, React Router, Supabase, Recharts, date-fns, react-hook-form, zod, and PWA support.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Fill `.env` with your Supabase project values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

## Supabase

Run the SQL in `supabase/schema.sql` from the Supabase SQL Editor. It creates the tables, RLS policies, auth profile trigger, realtime publication entries, and helper functions needed by the app.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run preview
```

## Production

See `DEPLOYMENT.md` for Vercel, Netlify, Supabase, environment variable, and CI setup.
