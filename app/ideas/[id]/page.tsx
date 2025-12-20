"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import IdeaDetailHeader from "@/components/ideas/detail/IdeaDetailHeader";
import IdeaSection from "@/components/ideas/detail/IdeaSection";
import ScoreCard from "@/components/ideas/detail/ScoreCard";
import IdeaRightRail from "@/components/ideas/detail/IdeaRightRail";

type Idea = {
  id: string;
  title: string;
  one_liner: string | null;
  description: string | null;
  tags: string[] | null;
  difficulty: number | null;
  market_size: string | null;
  source_type: string | null;
  source_url: string | null;
  demand_strength: string | null;
  pain_points: string[] | null;
  target_users: string | null;
  market_stage: string | null;
  competition: string | null;
  monetization: string[] | null;
  key_risks: string[] | null;
  next_steps: string | null;
  created_at?: string | null;
};

type Props = {
  params: Promise<{ id: string }>;
};

export default function IdeaDetailPage({ params }: Props) {
  const { id } = use(params);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIdea() {
      try {
        const res = await fetch(`/api/ideas/${id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch idea");
        }
        const json = await res.json();
        const item = json.item as Idea;
        setIdea({
          ...item,
          source_url: item?.source_url ?? null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchIdea();
  }, [id]);

  const revenueRange = (size: string | null): string => {
    switch (size) {
      case "S":
      case "Small":
        return "$100k–$1M ARR potential";
      case "M":
      case "Medium":
        return "$1M–$10M ARR potential";
      case "L":
      case "Large":
        return "$10M+ ARR potential";
      default:
        return "N/A";
    }
  };

  const difficultyLabel = (num: number | null): string => {
    if (num == null) return "";
    if (num <= 2) return "Easy";
    if (num <= 4) return "Moderate";
    if (num <= 6) return "Challenging";
    if (num <= 8) return "Hard";
    return "Very hard";
  };

  const metaPills = useMemo(() => {
    const pills: { label: string; value: string }[] = [];
    if (idea?.market_size) pills.push({ label: "Market", value: idea.market_size });
    if (idea?.difficulty != null)
      pills.push({ label: "Difficulty", value: `${idea.difficulty}/10` });
    if (idea?.demand_strength)
      pills.push({ label: "Demand", value: idea.demand_strength });
    if (idea?.source_type) pills.push({ label: "Source", value: idea.source_type });
    return pills;
  }, [idea]);

  const scores = useMemo(() => {
    if (!idea) return [] as { label: string; score: string | number; descriptor: string }[];
    return [
      {
        label: "Opportunity",
        score:
          idea.demand_strength === "strong" ? "9" : idea.demand_strength === "medium" ? "7" : "5",
        descriptor:
          idea.demand_strength === "strong"
            ? "Exceptional"
            : idea.demand_strength === "medium"
            ? "Good"
            : "Moderate",
      },
      {
        label: "Problem",
        score:
          idea.pain_points && idea.pain_points.length > 0
            ? Math.min(9, idea.pain_points.length + 4)
            : "5",
        descriptor:
          idea.pain_points && idea.pain_points.length > 0 ? "Severe pain" : "Moderate pain",
      },
      {
        label: "Feasibility",
        score: idea.difficulty != null ? 10 - idea.difficulty : "7",
        descriptor: idea.difficulty != null ? difficultyLabel(idea.difficulty) : "Moderate",
      },
      {
        label: "Why Now",
        score:
          idea.demand_strength === "strong" ? "9" : idea.demand_strength === "medium" ? "7" : "5",
        descriptor:
          idea.demand_strength === "strong"
            ? "Perfect timing"
            : idea.demand_strength === "medium"
            ? "Good timing"
            : "Fair timing",
      },
    ];
  }, [idea]);

  const readingMinutes = useMemo(() => {
    if (!idea) return 1;
    const parts = [
      idea.description ?? "",
      idea.next_steps ?? "",
      idea.competition ?? "",
      (idea.monetization ?? []).join(" "),
      (idea.pain_points ?? []).join(" "),
    ];
    const words = parts.join(" ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }, [idea]);

  const sections = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    if (idea?.description) list.push({ id: "summary", label: "Summary" });
    list.push({ id: "scores", label: "Scores" });
    list.push({ id: "business-fit", label: "Business Fit" });
    if (idea?.monetization && idea.monetization.length > 0) list.push({ id: "offer", label: "Offer" });
    if (idea?.demand_strength) list.push({ id: "why-now", label: "Why Now" });
    if (idea?.pain_points && idea.pain_points.length > 0) list.push({ id: "proof-signals", label: "Proof & Signals" });
    if (idea?.target_users) list.push({ id: "market-gap", label: "Market Gap" });
    if (idea?.next_steps || (idea?.key_risks && idea.key_risks.length > 0)) list.push({ id: "execution", label: "Execution" });
    list.push({ id: "framework-fit", label: "Framework Fit" });
    return list;
  }, [idea]);

  if (loading) {
    return <div className="p-6 text-foreground/90">Loading idea...</div>;
  }
  if (error || !idea) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 text-foreground/90">
        <Link href="/ideas/database" className="text-sm font-semibold text-primary underline">
          ← Back to database
        </Link>
        <div className="rounded-2xl border border-border/60 bg-card/50 p-4 text-destructive-foreground shadow-soft">
          Failed to load idea: {error ?? "Not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
      <div className="flex-1 space-y-6">
        <IdeaDetailHeader
          title={idea.title}
          subtitle={idea.one_liner}
          tags={idea.tags}
          meta={metaPills}
          sourceUrl={idea.source_url}
          shareUrl={typeof window !== "undefined" ? window.location.href : undefined}
        />

        {idea.description ? (
          <IdeaSection
            id="summary"
            title="Idea Summary"
            description="A concise overview of the opportunity."
          >
            <p className="whitespace-pre-line leading-relaxed text-foreground/90">
              {idea.description}
            </p>
          </IdeaSection>
        ) : null}

        <IdeaSection
          id="scores"
          title="Scores & Signals"
          description="Quick heuristics on opportunity strength, problem severity, feasibility, and timing."
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {scores.map((score) => (
              <ScoreCard
                key={score.label}
                label={score.label}
                score={score.score}
                descriptor={score.descriptor}
              />
            ))}
          </div>
        </IdeaSection>

        <IdeaSection
          id="business-fit"
          title="Business Fit"
          description="Market potential, difficulty, and go-to-market notes."
        >
          <div className="space-y-2 text-foreground/90">
            <p><strong>Revenue Potential:</strong> {revenueRange(idea.market_size)}</p>
            {idea.difficulty != null && (
              <p>
                <strong>Execution Difficulty:</strong> {idea.difficulty}/10 ({difficultyLabel(idea.difficulty)})
              </p>
            )}
            <p>
              <strong>Go-to-market:</strong> The combination of {idea.demand_strength ?? "moderate demand"}
              {" "}
              and a {idea.market_size ?? "N/A"} market stage suggests a promising path.
            </p>
          </div>
        </IdeaSection>

        {idea.monetization && idea.monetization.length > 0 && (
          <IdeaSection
            id="offer"
            title="Offer"
            description="Ways to monetize and package the solution."
          >
            <ul className="list-disc space-y-1 pl-5 text-foreground/90">
              {idea.monetization.map((m, idx) => (
                <li key={idx}>{m}</li>
              ))}
            </ul>
          </IdeaSection>
        )}

        {idea.demand_strength && (
          <IdeaSection
            id="why-now"
            title="Why Now"
            description="Timing signals and urgency."
          >
            <p className="text-foreground/90">
              {idea.demand_strength === "strong"
                ? "Explosive growth makes this the perfect time to enter."
                : idea.demand_strength === "medium"
                ? "Steady interest could translate into solid demand."
                : "Opportunities exist but require creative positioning and timing."}
            </p>
          </IdeaSection>
        )}

        {idea.pain_points && idea.pain_points.length > 0 && (
          <IdeaSection
            id="proof-signals"
            title="Proof & Signals"
            description="Evidence from users, communities, and market discussions."
          >
            <p className="text-foreground/90">
              The following pain points were derived from real discussions and market signals:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-foreground/90">
              {idea.pain_points.map((p, idx) => (
                <li key={idx}>{p}</li>
              ))}
            </ul>
          </IdeaSection>
        )}

        {idea.target_users && (
          <IdeaSection
            id="market-gap"
            title="Market Gap"
            description="Who this serves and where incumbents fall short."
          >
            <div className="space-y-2 text-foreground/90">
              <p>
                This idea targets {idea.target_users}. The current market fails to meet these users’ needs,
                leaving a gap that this solution can fill.
              </p>
              {idea.competition && <p>{idea.competition}</p>}
            </div>
          </IdeaSection>
        )}

        {(idea.next_steps || (idea.key_risks && idea.key_risks.length > 0)) && (
          <IdeaSection
            id="execution"
            title="Execution Plan"
            description="Practical next steps and considerations."
          >
            <div className="space-y-3 text-foreground/90">
              {idea.next_steps && <p className="whitespace-pre-line">{idea.next_steps}</p>}
              {idea.key_risks && idea.key_risks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Key Risks</h3>
                  <ul className="list-disc space-y-1 pl-5 text-foreground/90">
                    {idea.key_risks.map((risk, idx) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </IdeaSection>
        )}

        <IdeaSection
          id="framework-fit"
          title="Framework Fit"
          description="How this maps to common evaluation frameworks."
        >
          <p className="text-foreground/90">
            Evaluate this opportunity using popular frameworks like the Value Equation, Market Matrix, or A.C.P
            Framework to determine its positioning. This section can expand with charts and deeper analysis over time.
          </p>
        </IdeaSection>
      </div>

      <IdeaRightRail
        idea={{
          market_size: idea.market_size,
          demand_strength: idea.demand_strength,
          difficulty: idea.difficulty,
          source_type: idea.source_type,
          source_url: idea.source_url,
        }}
        sections={sections}
        shareUrl={typeof window !== "undefined" ? window.location.href : undefined}
        backHref="/ideas/database"
        readingMinutes={readingMinutes}
      />
    </div>
  );
}
