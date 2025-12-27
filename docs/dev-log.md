# Dev Log

Use this template for ongoing entries:
```
Date: YYYY-MM-DD
Summary: short summary of what changed
Key changes: paths/files touched
DB schema changes: migrations or manual SQL
Commands run: npm/tsx/supabase/etc
Decisions: rationale/notes
Next: immediate follow-ups
```

## Recent milestones

- Date: 2025-02-XX  
  Summary: Fixed cron parsing for strategy scheduler (cron-parser v4/v5 compatibility)  
  Key changes: `scripts/strategy-scheduler.ts`  
  DB schema changes: none  
  Commands run: `npx tsx scripts/strategy-scheduler.ts --max=10 --dry-run`  
  Decisions: Use namespace import and fallback parser to avoid default import errors  
  Next: Monitor scheduled enqueues in GitHub Actions

- Date: 2025-02-XX  
  Summary: Admin UI redesign with unified glass shell and navigation  
  Key changes: `app/admin/layout.tsx`, `components/admin/*`, `/admin` pages and clients  
  DB schema changes: none  
  Commands run: `npm run dev` for visual QA  
  Decisions: Single sidebar/drawer navigation, consistent cards/tables  
  Next: Add visual regression checks for admin routes

- Date: 2025-02-XX  
  Summary: Added run-now for strategies and linked job runner to strategies  
  Key changes: `app/api/admin/strategies/[id]/run/route.ts`, `lib/server/adminJobs.ts`, `scripts/job-runner.ts`  
  DB schema changes: ensure `admin_jobs.strategy_id/dedupe_key` exist (see schema checklist)  
  Commands run: `npx tsx scripts/job-runner.ts --max=5`  
  Decisions: Payload carries strategy metadata; job types mapped to ingest scripts  
  Next: Add more job-type coverage and retries telemetry

- Date: 2025-02-XX  
  Summary: Admin data tooling for ideas, Reddit posts promotion, and trends snapshots  
  Key changes: `/admin/data/*` clients and API routes, `lib/server/adminReddit.ts`, `lib/server/adminIdeas.ts`  
  DB schema changes: promotion flags on `raw_reddit_posts`, publish/unpublish timestamps on `ideas`  
  Commands run: API smoke via admin UI  
  Decisions: Prevent duplicate promotions, update timestamps on publish/unpublish  
  Next: Add bulk actions and analytics in admin data views
