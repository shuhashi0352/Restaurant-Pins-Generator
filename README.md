# Restaurant Map Generator

#### [Current Link to The Page](https://restaurant-pins-generator-1664si5id.vercel.app/)
A full-stack Next.js app for generating private, ranked restaurant maps from real Google Places entities. Users sign in with Google through Supabase Auth, answer a structured form, save maps privately, and optionally share canonical maps through view-only or editable collaboration links.

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

2. Create a Supabase project and run the SQL migrations in `supabase/migrations`.

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
- `/dashboard` owned and joined collaborative maps
- `/create` guided map form
- `/maps/[mapId]` member-aware canonical map view
- `/share/[shareToken]` public share-link map view with editable join support
- `/api/maps/generate` authenticated map generation endpoint
- `/api/maps/[mapId]/share` owner-only share settings endpoint
- `/api/share/[shareToken]/join` editable-link collaboration join endpoint
- `/api/geocode` backend geocoding endpoint

## Security Notes

- Places and Geocoding API keys are never exposed to the browser.
- Map creation requires an authenticated Supabase user.
- `map_members` attaches users to canonical maps with `owner`, `editor`, or `viewer` roles.
- Editors edit through server-side API routes with explicit membership checks.
- View-only links can read shared maps but do not attach maps to dashboards.
- Share tokens are generated with 32 random bytes and stored as hex strings.

## Product Scope

V1 is deliberately rule-based. It searches only Google Places restaurants, filters by the structured form inputs, ranks by rating descending, and uses review count as the tie-breaker. It does not support natural-language agents, other place categories, Google My Maps import/export, or saving pins into a user's Google Maps account.
