const tiers = [
  {
    name: 'Starter',
    price: '$0',
    description: 'Explore ideas and trends with limited refreshes.',
    features: ['Access to public ideas', 'Basic trend browsing', 'Email support'],
  },
  {
    name: 'Pro',
    price: '$29',
    description: 'For founders and researchers who need weekly signals.',
    features: ['Unlimited searches', 'Saved ideas & bookmarks', 'Weekly market briefs', 'Priority support'],
  },
  {
    name: 'Scale',
    price: 'Let’s talk',
    description: 'Custom signals, data exports, and team access.',
    features: ['Custom pipelines', 'Team seats', 'Dedicated success', 'Data exports & API'],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 text-slate-100">
      <div className="mb-10 space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">Pricing</p>
        <h1 className="text-3xl font-bold text-white">Pick a plan that grows with you</h1>
        <p className="text-lg text-slate-300">
          Fair, transparent pricing for founders, researchers, and teams.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-6 shadow-sm backdrop-blur transition-transform hover:-translate-y-[2px] hover:border-[var(--primary)]/50"
          >
            <div className="mb-4 space-y-1">
              <p className="text-sm font-semibold text-[var(--primary)]">{tier.name}</p>
              <p className="text-3xl font-bold text-white">{tier.price}</p>
              <p className="text-sm text-slate-300">{tier.description}</p>
            </div>
            <ul className="space-y-2 text-sm text-slate-200">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[var(--primary)]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-6 w-full rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
            >
              {tier.name === 'Scale' ? 'Contact us' : 'Get started'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
