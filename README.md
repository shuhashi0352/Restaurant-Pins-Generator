<<<<<<< HEAD
# Restaurant Map Generator

A full-stack Next.js app for generating private, ranked restaurant maps from real Google Places entities. Users sign in with Google through Supabase Auth, answer a structured form, save maps privately, and optionally publish an unlisted read-only share link.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Supabase database, RLS, and Google OAuth auth
- Google Maps JavaScript API for rendering
- Google Places API and Geocoding API through backend routes

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project and run the SQL migration in `supabase/migrations/001_initial_schema.sql`.

3. Enable Google OAuth in Supabase:

- In Supabase, open Authentication -> Providers -> Google.
- Add your Google OAuth client ID and secret.
- Add `http://localhost:3000/auth/callback` to the allowed redirect URLs for local development.

4. Enable Google APIs in Google Cloud:

- Maps JavaScript API
- Places API
- Geocoding API

5. Copy `.env.local.example` to `.env.local` and fill in values:

```bash
cp .env.local.example .env.local
```

Use `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` only for browser map rendering. Keep `GOOGLE_PLACES_API_KEY`, `GOOGLE_GEOCODING_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` server-only.

6. Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Routes

- `/` homepage
- `/login` Google login
- `/dashboard` saved private maps
- `/create` 9-question map form
- `/maps/[mapId]` private owner-only map view
- `/share/[shareToken]` public unlisted read-only map view
- `/api/maps/generate` authenticated map generation endpoint
- `/api/maps/[mapId]/share` share enable/disable endpoint
- `/api/geocode` backend geocoding endpoint

## Security Notes

- Places and Geocoding API keys are never exposed to the browser.
- Map creation requires an authenticated Supabase user.
- Private map pages query by both map ID and owner ID.
- RLS restricts maps and pins to owners, while shared maps and pins are public only when `share_enabled = true`.
- Share tokens are generated with 32 random bytes and stored as hex strings.

## Product Scope

V1 is deliberately rule-based. It searches only Google Places restaurants, filters by the structured form inputs, ranks by rating descending, and uses review count as the tie-breaker. It does not support natural-language agents, other place categories, Google My Maps import/export, or saving pins into a user's Google Maps account.
=======
# Restaurant-Pins-Generator
>>>>>>> 9a7b9b15e9a280671845d69e50d305c6984f0bb8
