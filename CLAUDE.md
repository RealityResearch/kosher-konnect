# Kosher Konnect (JPS - Jewish Positioning System)

Interactive map app for discovering Jewish establishments across the US.

**Live:** https://jewishpositioningsystem.com

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Mapbox GL for map rendering (Standard style, monochrome night theme)
- Supabase for real-time visitor tracking ("Noticers")
- Tailwind CSS 4

## Commands

- `npm run dev` - local dev server
- `npm run build` - production build
- `npm run lint` - eslint

## Project Structure

- `app/page.tsx` - main page, sidebar, categories, all UI state
- `components/MapboxMap.tsx` - map component, heatmap layers, markers, popups
- `hooks/useNoticers.ts` - Supabase realtime presence
- `data/` - all JSON data files (locations, population, surnames)
- `scripts/` - Node.js data processing scripts (OSM fetching, merging, Census data)

## Data Sources

- OpenStreetMap (Overpass API) - synagogues, restaurants, schools, etc.
- US Census - surname frequency data (374 Jewish surnames)
- American Jewish Year Book - population by state/metro
- Processed data lives in `data/`, raw Census CSV in `data/census/`

## Data Pipeline

1. `scripts/fetch-osm-data.js` - pulls from Overpass API
2. `scripts/merge-data.js` - deduplicates and combines sources
3. `scripts/build-surname-data.js` - processes Census surname CSV into JSON
4. `scripts/build-surname-heatmap.js` - generates geographic surname heatmaps

## Key Features

- 3,147+ location markers with category filtering
- Heatmap at low zoom, individual pins at zoom 10+
- Shabbat mode (RTL Hebrew UI, auto-detects Friday evening)
- Surname heatmap overlays (Cohen, Levy, Goldstein, etc.)
- Jewish population density overlay
- Confetti on marker click
- Background music

## Environment Variables

- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Deployment

Push to `main` on GitHub triggers Vercel deploy automatically.
Domain: jewishpositioningsystem.com (connected via Vercel)
