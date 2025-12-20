export type Tone = "good" | "info" | "warn" | "bad" | "neutral";

export const tonePillClasses = (tone: Tone): string => {
  switch (tone) {
    case "good":
      return "text-emerald-200 bg-emerald-500/15 border-emerald-500/30";
    case "info":
      return "text-sky-200 bg-sky-500/15 border-sky-500/30";
    case "warn":
      return "text-amber-200 bg-amber-500/15 border-amber-500/30";
    case "bad":
      return "text-rose-200 bg-rose-500/15 border-rose-500/30";
    case "neutral":
    default:
      return "text-foreground/80 bg-secondary/15 border-border/50";
  }
};

export const toneFromValue = (label: string, value?: string | number): Tone => {
  const val = typeof value === "string" ? value.toLowerCase() : value;
  const lowerLabel = label.toLowerCase();

  // Demand
  if (lowerLabel.includes("demand")) {
    if (typeof val === "string") {
      if (val.includes("strong") || val.includes("high")) return "good";
      if (val.includes("medium")) return "info";
      if (val.includes("weak") || val.includes("low")) return "warn";
    }
  }

  // Timing / Why Now
  if (lowerLabel.includes("why") || lowerLabel.includes("timing")) {
    if (typeof val === "string") {
      if (val.includes("now") || val.includes("grow") || val.includes("rising")) return "good";
      if (val.includes("stable")) return "info";
      if (val.includes("declin")) return "warn";
    }
  }

  // Risk
  if (lowerLabel.includes("risk")) {
    if (typeof val === "string") {
      if (val.includes("low")) return "good";
      if (val.includes("medium")) return "warn";
      if (val.includes("high")) return "bad";
    }
  }

  // Difficulty numeric
  if (lowerLabel.includes("difficulty")) {
    if (typeof val === "number") {
      if (val <= 3) return "good";
      if (val <= 6) return "info";
      if (val <= 8) return "warn";
      return "bad";
    }
    if (typeof val === "string") {
      const numMatch = val.match(/(\d+)/);
      const num = numMatch ? Number(numMatch[1]) : NaN;
      if (!Number.isNaN(num)) {
        if (num <= 3) return "good";
        if (num <= 6) return "info";
        if (num <= 8) return "warn";
        return "bad";
      }
    }
  }

  // Competition
  if (lowerLabel.includes("competition")) {
    if (typeof val === "string") {
      if (val.includes("low")) return "good";
      if (val.includes("medium")) return "warn";
      if (val.includes("high")) return "bad";
    }
  }

  return "neutral";
};
