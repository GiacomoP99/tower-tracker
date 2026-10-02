# Tower Tracker

Track The Tower runs (coins & cells) with a synced dashboard.

## Stack

- Vite + React + TypeScript
- TanStack Router, Query, Table, Form, Charts
- shadcn/ui + Tailwind CSS
- Supabase Auth + Postgres
- Vercel deploy

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run these migrations in order:
   - [`supabase/migrations/001_runs.sql`](supabase/migrations/001_runs.sql)
   - [`supabase/migrations/002_goals.sql`](supabase/migrations/002_goals.sql)
3. Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Find these under **Project Settings → API**.

4. (Optional) Under **Authentication → Providers**, keep Email enabled. Disable email confirmation for a personal app if you want instant sign-up.

### 3. Run locally

```bash
npm run dev
```

Sign up, then use **Log run** or **Import** (Battle History screenshot) and open the **Dashboard**.

### 4. Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Add the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars.
4. Deploy. SPA rewrites are already set in `vercel.json`.

## Screenshot import

Go to **Import** (`/runs/import`) and upload a Battle History screenshot.

- OCR runs in the browser with Tesseract.js (no extra API keys)
- Extracts tier, wave, date, coins, cells
- Estimates duration from `Coins / Coins/Hour`
- Opens a review wizard so you can edit, set AFK/manual, deselect bad rows, then bulk-save

Compact coin values like `111.81M` are supported in both manual entry and import.

## Goals & streaks

On **Home** (`/`):

- **Goals** — create targets (avg/best coins/h, cells/h, wave, totals, run count) for today / this week / this month / all time, with optional tier filter and live progress bars
- **Streaks** — current & longest day streaks, runs this week, 14-day consistency heatmap + chart

Charts and best-run markers live on **Dashboard** (`/dashboard`).

Requires the `002_goals.sql` migration.

## Run fields

| Field | Required | Notes |
| --- | --- | --- |
| Tier | yes | |
| Wave reached | yes | |
| Duration | yes | hours + minutes |
| Date/time | yes | when the run happened |
| Play mode | yes | `manual` or `afk` |
| Coins | yes | supports scientific notation (`1.5e12`) |
| Cells | yes | |
| Notes | no | |

Dashboard metrics (coins/h, cells/h, daily/weekly totals) are computed from these fields.
