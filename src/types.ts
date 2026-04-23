// ─── Shared domain types ──────────────────────────────────────────────────────

export interface SourceItem {
  /** Canonical URL of the original content */
  url: string;
  /** Title or headline */
  title: string;
  /** ISO-8601 publication date (best-effort) */
  publishedAt: string;
  /** Short excerpt or description */
  excerpt: string;
  /** Which adapter produced this item */
  source: SourceName;
}

export type SourceName =
  | "twitter"
  | "youtube"
  | "reddit"
  | "arxiv"
  | "producthunt"
  | "rss";

// ─── Adapter interface ────────────────────────────────────────────────────────

export interface SourceAdapter {
  readonly name: SourceName;
  /**
   * Fetch items published within the last `lookbackDays` days.
   * Must never throw — return [] on any non-fatal error and log to stderr.
   */
  fetch(lookbackDays: number): Promise<SourceItem[]>;
}

// ─── Summarizer output ────────────────────────────────────────────────────────

export interface Theme {
  title: string;
  evidence: string[];
  hypothesis: string;
  confidence: number;
}

export interface Experiment {
  id: string;
  try_this: string;
  platform: "x" | "yt" | "reddit" | "newsletter";
  estimated_effort_min: number;
  theme_ref: string;
}

export interface WeeklyMemo {
  week_of: string; // "YYYY-WW"
  themes: Theme[];
  experiments: Experiment[];
}

// ─── Rankings ─────────────────────────────────────────────────────────────────

export interface SourceRanking {
  weight: number;
  wins: number;
  losses: number;
  last_updated: string | null;
}

export interface Rankings {
  sources: Record<SourceName, SourceRanking>;
}

export type ResultOutcome = "win" | "loss" | "neutral";
