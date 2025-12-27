# IdeaSeek / IdeaSignal — Project Overview

## Product & Users
- **Positioning**: Idea discovery + early validation platform aggregating Reddit, YouTube, and Google Trends signals, with admin-curated ideas and shareable public pages.
- **Target users**: Indie hackers, founders, researchers looking for market signals; internal admins curating pipelines and content.
- **Core user journeys**:
  - Browse/search idea database (`/ideas`), view idea detail/share OG.
  - Explore trends (`/trends`, `/market-insights`), OG images for sharing.
  - Auth + saved ideas (Supabase auth).
  - Admin: configure ingest strategies, enqueue jobs, review raw data, promote to ideas, publish/pin/feature ideas.

## Information Architecture / Routes (App Router)
- Public: `/` (homepage), `/ideas`, `/ideas/[id]`, `/idea/[slug?]`, `/trends`, `/market-insights`, `/pricing`, `/login`, `/signup`.
- OG/SEO: `/api/og/idea`, `/api/og/trend`, sitemap/robots.
- Admin shell: `/admin` dashboard, `/admin/jobs`, `/admin/strategies`, `/admin/ideas` (overview), `/admin/trends`, `/admin/raw`.
- Admin data views: `/admin/data/ideas`, `/admin/data/reddit-posts`, `/admin/data/trends-snapshots`.
- Admin jobs detail: `/admin/jobs/[id]`.

## Admin workflows
- **Strategies**: CRUD strategies, set cron/config/source, run-now action enqueues `admin_jobs` with strategy_id.
- **Jobs**: Monitor queue status; job-runner executes ingest scripts.
- **Reddit posts**: Filter, soft-delete, annotate, promote to draft ideas (records promoted_idea_id/used flags).
- **Ideas data**: Publish/unpublish, pin/feature, soft-delete/restore; updates timestamps.
- **Trends snapshots**: Filter, mark processed/unprocessed, delete/restore, reprocess job enqueue.

## Data ingestion & automation
- **Pipelines (scripts/)**:
  - `ingest-reddit(-raw).ts`, `process-reddit-to-ideas.ts`
  - `ingest-youtube(-raw).ts`, `process-youtube-to-ideas.ts`
  - `ingest-trends(-raw|searchapi).ts`, `process-trends-to-trends.ts`, `enrich-trends.ts`
  - Shared helpers in `scripts/shared/` and `scripts/ingest-utils.ts`.
- **Strategies scheduler**: `scripts/strategy-scheduler.ts`
  - Finds due `ingest_strategies` (active, not deleted, cron due) and enqueues `admin_jobs` with dedupe.
  - Computes next_run_at via cron-parser.
- **Job queue/runner**:
  - Table: `admin_jobs` (queued/running/success/failed, payload, attempts).
  - Claim RPC `claim_admin_job` used by `scripts/job-runner.ts`.
  - Runner maps job_type → npm scripts (`ingest:reddit|youtube|trends`) and passes strategy env (ID/source/config).

## Database overview (key tables/columns)
- **profiles**: `user_id`, `role` (admin gating).
- **ideas**: `id`, `title`, `one_liner`, `description`, `tags`, `source_type`, `source_url`, `published`, `pinned`, `featured`, `status`, `published_at`, `unpublished_at`, `deleted_at`, `deleted_by`, `admin_note`, `created_at`, `updated_at`.
- **raw_reddit_posts**: `id`, `source_post_id`, `title`, `selftext`, `subreddit`, `score`, `num_comments`, `url`, `selected`, `selected_for_idea`, `used_for_ideas`, `promoted_idea_id`, `promoted_at`, `admin_note`, `is_deleted`, `created_utc`.
- **raw_trends_snapshots**: `id`, `snapshot_key`, `keyword`, `geo`, `timeframe`, `processed`, `processed_at`, `last_error`, `is_deleted`, timestamps.
- **ingest_strategies**: `id`, `name`, `strategy_key`, `type/source` (reddit|youtube|google_trends), `config` (JSON), `cron/cron_expr`, `is_active`, `next_run_at`, `last_enqueued_at`, `last_run_at/status/error`, `deleted_at`, `updated_at`.
- **admin_jobs**: `id`, `job_type`, `status`, `payload`, `strategy_id`, `source`, `dedupe_key`, attempts/max_attempts, `next_run_at`, `started_at`, `finished_at`, `log`, `error`.
- **raw_trends_snapshots → trends**: processed via scripts; `process-trends-snapshot` job_type also exists.

### RLS / admin model
- Admin guard via Supabase profiles.role = 'admin' (`requireAdmin`); non-admin => 403/redirect.
- Service role (SERVER) used by scripts and API routes for privileged operations.

### Schema checklist / common pitfalls
- Ensure `ingest_strategies` has: `strategy_key` (NOT NULL, unique), `cron` or `cron_expr`, `next_run_at`, `last_enqueued_at`, `last_error`, `deleted_at`, `updated_at`, and canonical `type`/`source` with allowed values (`reddit`,`youtube`,`google_trends`).
- Ensure `admin_jobs` has `strategy_id uuid` and `dedupe_key` with unique index.
- Ideas: soft-delete columns (`deleted_at`, `deleted_by`, `admin_note`), publish timestamps (`published_at`, `unpublished_at`).
- raw_reddit_posts: promotion flags (`promoted_idea_id`, `promoted_at`, `used_for_ideas`, `selected_for_idea`).
- Missing columns will surface as “column does not exist” in admin API or scheduler; verify migrations applied in order.

## Public share & SEO/OG
- OG routes: `/api/og/idea`, `/api/og/trend` generate OpenGraph images.
- Sitemap/robots configured via `app/sitemap.ts` and `app/robots.ts`.
- Idea and trend pages are SEO-friendly paths with metadata populated from Supabase.

## Local development
```bash
npm install
npm run dev       # http://localhost:3000
# Run lint
npm run lint
```

### Environment variables (common)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL` (for scripts/GitHub Actions if separate)
- Ingestion keys: `YOUTUBE_API_KEY`, any third-party keys used in scripts; `DEEPSEEK_API_KEY` for job-runner if enabled.
- Optional: `OPENAI_API_KEY` depending on features.

## Key scripts
- `npx tsx scripts/strategy-scheduler.ts --max=200` (cron-based enqueue; supports `--dry-run`).
- `npx tsx scripts/job-runner.ts --max=5` (claims and runs admin_jobs).
- Ingestors: `npm run ingest:reddit|youtube|trends` (used by runner).
- Processing/enrichment: `scripts/process-*.ts`, `scripts/enrich-trends.ts`.

## GitHub Actions workflows
- `.github/workflows/job-runner.yml` — runs job-runner on schedule and manual dispatch.
- `.github/workflows/strategy-scheduler.yml` — runs scheduler every 5 minutes and manual dispatch.

## Operational runbook
- **Enqueue manually**: from `/admin/jobs` (predefined ingest buttons) or `/admin/strategies` “Run now” per strategy; API `/api/admin/jobs`/`/api/admin/strategies/[id]/run`.
- **Recover stuck jobs**:
  - Inspect `/admin/jobs` or Supabase table.
  - If status=queued but past next_run_at, rerun job-runner.
  - If failed, check `log`/`error`; adjust data and requeue by setting `status='queued'`, `next_run_at=now()`, reset `error`.
  - Ensure strategy is active and config JSON valid.
- **Add admin users**: In Supabase `profiles` set `role='admin'` for the user’s `user_id`; user must exist in auth.
- **Scheduler issues**: Verify `ingest_strategies` cron values valid; check dedupe collisions; ensure GitHub Actions secrets present.

## Quality & roadmap
- Current: Admin UI refreshed (glass shell), strategy run-now + scheduler, job-runner integration, OG pages.
- Next steps: tighter observability (structured logs for jobs), validation on strategy configs, alerting on repeated failures, fuller e2e tests for promotion/publish flows, automated schema drift checks.
