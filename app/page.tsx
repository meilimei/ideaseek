import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Check, Database, Lock, Radar, Sparkles, TrendingUp, Zap } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

const steps = [
  { title: "Discover", body: "Surface trends, niches, and signals across the web." },
  { title: "Validate", body: "See what’s growing, where, and how fast with real data." },
  { title: "Decide", body: "Save, score, and act on the ideas that matter." },
];

const features = [
  { title: "Signals radar", body: "Cross-source monitoring for trends, keywords, and breakout topics.", icon: Radar, href: "/trends" },
  { title: "Idea database", body: "Curated, searchable ideas with scoring and metadata.", icon: Database, href: "/ideas/database" },
  { title: "Growth lenses", body: "Filter by velocity, geography, channel, and seasonality.", icon: TrendingUp, href: "/market-insights" },
  { title: "AI summaries", body: "Explain why a signal matters in seconds.", icon: Sparkles, href: "/pricing" },
  { title: "Safe & secure", body: "Session-based auth with Supabase and protected routes.", icon: Lock, href: "/ideas/database" },
  { title: "Instant start", body: "No setup required—jump straight into live data.", icon: Zap, href: "/pricing" },
];

const plans = [
  {
    name: "Starter",
    price: "$0",
    desc: "Explore the experience.",
    cta: "Get started",
    features: ["Public trends", "Save up to 20 ideas", "Email support"],
  },
  {
    name: "Pro",
    price: "$39",
    desc: "For researchers and operators.",
    cta: "Upgrade",
    features: ["Full database access", "Unlimited saves", "Priority updates", "Export CSV"],
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Teams",
    price: "$89",
    desc: "Collaborate with your crew.",
    cta: "Contact sales",
    features: ["Shared workspaces", "SSO-ready", "Audit logs"],
  },
];

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const primaryHref = session ? "/ideas/database" : "/login";
  const primaryLabel = session ? "Go to Database" : "Start exploring";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0b0f1d] via-[#060914] to-[#02030a] text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(59,130,246,0.12),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.14),transparent_28%)]" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-24">
        <Hero primaryHref={primaryHref} primaryLabel={primaryLabel} />
        <HowItWorks />
        <FeatureGrid />
        <LivePreview />
        <Pricing />
        <Footer />
      </div>
    </main>
  );
}

function Hero({ primaryHref, primaryLabel }: { primaryHref: string; primaryLabel: string }) {
  return (
    <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
      <div className="space-y-6">
        <Badge className="rounded-full border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-teal-100 shadow-soft">
          IdeaSeek by IdeaSignal
        </Badge>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            Find signals before they peak. Turn them into products.
          </h1>
          <p className="text-lg text-slate-300">
            IdeaSeek surfaces fast-growing trends, scores them, and keeps your team aligned on what to build next.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            className="w-full justify-center rounded-2xl bg-teal-500 px-5 py-3 text-base text-white shadow-soft hover:bg-teal-400 sm:w-auto"
          >
            <Link href={primaryHref}>
              {primaryLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full justify-center rounded-2xl border-white/20 bg-white/5 px-5 py-3 text-base text-slate-100 shadow-soft hover:bg-white/10 sm:w-auto"
          >
            <Link href="/trends">See live trends</Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-slate-400">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <Sparkles className="h-4 w-4 text-teal-200" />
            Curated daily
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <Lock className="h-4 w-4 text-teal-200" />
            Secure by design
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <TrendingUp className="h-4 w-4 text-teal-200" />
            Growth-ready
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "signals indexed", value: "12,480" },
            { label: "trends tracked", value: "1,320" },
            { label: "to first insight", value: "3 min" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-soft backdrop-blur"
            >
              <p className="text-lg font-semibold text-slate-100">{stat.value}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <Card className="border-white/10 bg-white/5 shadow-soft backdrop-blur">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radar className="h-4 w-4 text-teal-300" />
              Signals snapshot
            </CardTitle>
            <CardDescription className="text-slate-300">What&apos;s rising this week.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { title: "AI-native research tools", growth: "+142%", tag: "B2B SaaS" },
              { title: "Personalized learning agents", growth: "+118%", tag: "Edtech" },
              { title: "Vertical AI CRMs", growth: "+96%", tag: "Sales Ops" },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.tag}</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                  {item.growth}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/5 shadow-soft backdrop-blur">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-4 w-4 text-teal-300" />
              Team activity
            </CardTitle>
            <CardDescription className="text-slate-300">Recent saves from your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {["Geo-specific travel AI", "Subscription compliance copilot", "AI fintech reconciliation"].map(
              (title, idx) => (
                <div
                  key={title}
                  className={cn(
                    "flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200",
                    idx === 0 && "shadow-glow",
                  )}
                >
                  <span>{title}</span>
                  <Badge className="rounded-full border-white/10 bg-teal-500/15 text-xs text-teal-100">New</Badge>
                </div>
              ),
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">How it works</p>
        <h2 className="text-2xl font-semibold text-foreground">From signal to shipped.</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, idx) => (
          <Card key={step.title} className="border-white/10 bg-white/5 shadow-soft backdrop-blur">
            <CardContent className="space-y-3 pt-6">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-sm font-semibold text-teal-100">
                {idx + 1}
              </div>
              <h3 className="text-lg font-semibold text-slate-100">{step.title}</h3>
              <p className="text-sm text-slate-400">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Why teams choose us</p>
        <h2 className="text-2xl font-semibold text-foreground">Stay ahead with the right signals.</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="border-white/10 bg-white/5 shadow-soft backdrop-blur">
            <CardContent className="space-y-3 pt-6">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-teal-100">
                <feature.icon className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">{feature.title}</h3>
              <p className="text-sm text-slate-400">{feature.body}</p>
              <Link
                href={feature.href}
                className="inline-flex items-center gap-1 text-sm text-teal-100 hover:underline"
              >
                Learn more →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function LivePreview() {
  const previews = [
    {
      title: "Live trends",
      items: [
        { title: "Voice-first UX", score: "Score 82" },
        { title: "AI design QA", score: "+24% WoW" },
        { title: "Contextual chatbots", score: "Score 79" },
      ],
    },
    {
      title: "Idea pipeline",
      items: [
        { title: "AI local commerce", score: "Shortlist" },
        { title: "Smart compliance ops", score: "Evaluate" },
        { title: "Autonomous QA tools", score: "Watch" },
      ],
    },
  ];

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">In-app preview</p>
        <h2 className="text-2xl font-semibold text-foreground">A workspace built for momentum.</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {previews.map((preview) => (
          <Card key={preview.title} className="border-white/10 bg-white/5 shadow-soft backdrop-blur">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg text-slate-100">{preview.title}</CardTitle>
              <CardDescription className="text-slate-400">Fresh data, auto-updated.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {preview.items.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <span className="text-sm text-slate-200">{item.title}</span>
                  <Badge className="rounded-full border-white/10 bg-white/10 text-xs text-teal-100">{item.score}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Pricing</p>
        <h2 className="text-2xl font-semibold text-foreground">Pick a plan and keep exploring.</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              "border-white/10 bg-white/5 shadow-soft backdrop-blur",
              plan.highlight && "border-teal-200/50 bg-teal-500/10 shadow-[0_10px_40px_rgba(45,212,191,0.25)]",
            )}
          >
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-slate-100">{plan.name}</CardTitle>
                {plan.badge && (
                  <Badge className="rounded-full border-white/30 bg-white/15 text-xs text-teal-50">
                    {plan.badge}
                  </Badge>
                )}
              </div>
              <div className="text-3xl font-semibold text-foreground">{plan.price}</div>
              <CardDescription className="text-slate-300">{plan.desc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-slate-200">
                {plan.features.map((feat) => (
                  <div key={feat} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-teal-200" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
              <Button
                asChild
                variant={plan.highlight ? "default" : "outline"}
                className={cn(
                  "w-full justify-center rounded-2xl px-4 py-2",
                  plan.highlight
                    ? "bg-teal-500 text-white hover:bg-teal-400"
                    : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10",
                )}
              >
                <Link href="/pricing">{plan.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-6 py-6 text-sm text-slate-400 shadow-soft backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-slate-200">
        <Sparkles className="h-4 w-4 text-teal-200" />
        <span className="font-semibold text-foreground">IdeaSignal</span>
        <Separator className="mx-2 h-4 w-px" />
        <span>Signals, trends, and ideas in one workspace.</span>
      </div>
      <div className="flex flex-col gap-2 text-xs text-white/50 sm:text-right">
        <div className="flex flex-wrap gap-3 sm:justify-end">
          <Link href="/trends" className="hover:text-slate-200">
            Trends
          </Link>
          <Link href="/ideas/database" className="hover:text-slate-200">
            Ideas
          </Link>
          <Link href="/pricing" className="hover:text-slate-200">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-slate-200">
            Sign in
          </Link>
        </div>
        <span className="text-xs text-white/50">
          Built with Next.js + Supabase • © {year} IdeaSignal
        </span>
      </div>
    </footer>
  );
}
