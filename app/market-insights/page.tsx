export default function MarketInsightsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-slate-100">
      <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-8 shadow-sm backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">
          Market Insights
        </p>
        <h1 className="text-3xl font-bold text-white">Coming soon</h1>
        <p className="text-lg text-slate-300">
          We&apos;re building a live pulse on markets, categories, and early signals. Check back
          soon for deep dives, benchmarks, and curated analyses.
        </p>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/70 p-4 text-sm text-slate-200">
          Leave a note on the Trends page to tell us which categories you care about most.
        </div>
      </div>
    </div>
  );
}
