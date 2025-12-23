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
    <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
      <div className="mb-12 space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-white/60">Pricing</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Pick a plan that grows with you
        </h1>
        <p className="text-lg text-white/70">
          Fair, transparent pricing for founders, researchers, and teams.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => {
          const isPro = tier.name.toLowerCase() === 'pro';
          return (
            <div
              key={tier.name}
              className={`flex h-full flex-col rounded-2xl border p-6 shadow-sm backdrop-blur-sm ${
                isPro
                  ? 'border-white/15 bg-white/[0.06] shadow-[0_14px_40px_rgba(45,212,191,0.18)]'
                  : 'border-white/8 bg-white/[0.035]'
              }`}
            >
              <div className="mb-4 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white/85">{tier.name}</p>
                  {isPro && (
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">
                      Most popular
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-white">{tier.price}</p>
                <p className="text-sm text-white/65">{tier.description}</p>
              </div>
              <ul className="space-y-2 text-sm text-white/80">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-400/80" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`mt-6 w-full rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0 ${
                  isPro
                    ? 'bg-teal-500 text-white shadow-[0_10px_30px_rgba(45,212,191,0.2)] hover:bg-teal-400'
                    : 'border border-white/15 bg-white/5 text-white/85 hover:bg-white/10'
                }`}
              >
                {tier.name === 'Scale' ? 'Contact us' : 'Get started'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
