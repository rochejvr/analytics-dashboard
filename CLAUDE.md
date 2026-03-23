# Xavant Ops Analytics Dashboard

Cross-app analytics and monitoring dashboard for Xavant Technology's internal tools.

## Quick Start

```bash
npm run dev        # Dev server on port 3004
npm run build      # Production build
npm start          # Production server
```

## Stack

- **Framework**: Next.js 16 + React 19 + TypeScript
- **Styling**: Tailwind CSS (light theme, blue accent #2563eb, DM Sans font)
- **Database**: Supabase (read-only, queries `activity_events` table)
- **Charts**: recharts
- **Icons**: lucide-react

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<same as other apps>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same as other apps>
```

## Architecture

Reads from the shared `activity_events` table that all Xavant apps write to via `trackEvent()` in their respective `src/lib/analytics.ts`.

### Tracked Apps (APP_REGISTRY in `src/lib/constants.ts`)
- `invoice_eval` — blue #2563eb
- `po_register` — purple #7c3aed (not yet instrumented)
- `bom_analysis` — green #059669
- `shipping` — orange #d97706 (not yet instrumented)
- `kpi_board` — red #dc2626

### Pages
- `/` — Overview: cross-app KPIs, activity by app, category breakdown, recent events
- `/apps/[appId]` — Per-app drill-down: events, errors, performance, actors
- `/adoption` — Feature adoption: usage over time chart, top features table, feature breakdown by app, users by app
- `/pipeline` — Pipeline health (invoice eval stages) — coming soon
- `/funnels` — Task completion funnels — coming soon

### API Routes
- `GET /api/events?hours=168&app=invoice_eval&category=error&limit=200` — Query events
- `GET /api/events/summary?hours=168` — Aggregated summary (counts by app/category, avg duration, cost)
- `GET /api/events/adoption?hours=168` — Feature adoption data (usage by app, daily buckets, top features, trends)

### Event Registry (`src/lib/event-registry.ts`)
Central dictionary mapping `app_id:event_name` → short description. Used by the Adoption page to display human-readable context for each tracked event. Add new entries here when instrumenting new events.

## Design

Light theme — NOT JARVIS dark theme. Clean professional style matching the invoice eval supplier portal:
- Background: #f8fafc
- Cards: white with #e2e8f0 borders
- Accent: #2563eb (blue)
- Fonts: DM Sans (body), DM Mono (numbers/codes)
