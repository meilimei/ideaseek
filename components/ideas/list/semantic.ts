export type Tone = "good" | "info" | "warn" | "bad" | "neutral";

export const subtleTonePillClasses = (tone: Tone): string => {
  switch (tone) {
    case "good":
      return "text-emerald-200/90 bg-emerald-500/8 border-emerald-500/15";
    case "info":
      return "text-sky-200/90 bg-sky-500/8 border-sky-500/15";
    case "warn":
      return "text-amber-200/90 bg-amber-500/8 border-amber-500/15";
    case "bad":
      return "text-rose-200/90 bg-rose-500/8 border-rose-500/15";
    case "neutral":
    default:
      return "text-foreground/75 bg-secondary/10 border-border/50";
  }
};

export const toneFromValue = (label: string, value?: string | number): Tone => {
  const val = typeof value === "string" ? value.toLowerCase() : value;
  const lowerLabel = label.toLowerCase();

  if (lowerLabel.includes("demand")) {
    if (typeof val === "string") {
      if (val.includes("strong") || val.includes("high")) return "good";
      if (val.includes("medium")) return "info";
      if (val.includes("weak") || val.includes("low")) return "warn";
    }
  }

  if (lowerLabel.includes("difficulty")) {
    if (typeof val === "number") {
      if (val <= 3) return "good";
      if (val <= 6) return "info";
      if (val <= 8) return "warn";
      return "bad";
    }
    if (typeof val === "string") {
      const match = val.match(/(\d+)/);
      const num = match ? Number(match[1]) : NaN;
      if (!Number.isNaN(num)) {
        if (num <= 3) return "good";
        if (num <= 6) return "info";
        if (num <= 8) return "warn";
        return "bad";
      }
    }
  }

  if (lowerLabel.includes("score") || lowerLabel.includes("overall")) {
    if (typeof val === "number") {
      if (val >= 8) return "good";
      if (val >= 6) return "info";
      if (val >= 4) return "warn";
      return "bad";
    }
    if (typeof val === "string") {
      const match = val.match(/(\d+)/);
      const num = match ? Number(match[1]) : NaN;
      if (!Number.isNaN(num)) {
        if (num >= 8) return "good";
        if (num >= 6) return "info";
        if (num >= 4) return "warn";
        return "bad";
      }
    }
  }

  return "neutral";
};
