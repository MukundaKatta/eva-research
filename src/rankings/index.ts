/**
 * Rankings module — tracks how often each source contributes to winning
 * experiments and adjusts source weights via a simple Bayesian-ish update.
 *
 * ## Weight update formula
 *
 * Given prior weight w, wins W, and losses L:
 *
 *   posterior_mean = (W + α) / (W + L + α + β)
 *
 * where α = 1 (pseudocount for wins) and β = 1 (pseudocount for losses).
 * This is the mean of a Beta(W+α, L+β) distribution — it regresses toward 0.5
 * rather than being dominated by noise on few observations.
 *
 * The weight is then rescaled to [0.1, 2.0] so no source is ever fully silenced.
 */

import fs from "node:fs";
import type { Rankings, SourceName, ResultOutcome } from "../types.js";

const ALPHA = 1; // win pseudocount
const BETA = 1;  // loss pseudocount
const MIN_WEIGHT = 0.1;
const MAX_WEIGHT = 2.0;

export function loadRankings(filePath: string): Rankings {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as Rankings;
}

export function saveRankings(filePath: string, rankings: Rankings): void {
  fs.writeFileSync(filePath, JSON.stringify(rankings, null, 2) + "\n", "utf8");
}

export function updateRanking(
  rankings: Rankings,
  sourceName: SourceName,
  outcome: ResultOutcome
): Rankings {
  const src = rankings.sources[sourceName];
  if (!src) {
    throw new Error(`Unknown source: ${sourceName}`);
  }

  const updated = { ...src };
  if (outcome === "win") updated.wins += 1;
  else if (outcome === "loss") updated.losses += 1;
  // "neutral" → no wins/losses change, just update timestamp

  const posteriorMean =
    (updated.wins + ALPHA) / (updated.wins + updated.losses + ALPHA + BETA);

  // Rescale [0, 1] → [MIN_WEIGHT, MAX_WEIGHT]
  updated.weight =
    MIN_WEIGHT + posteriorMean * (MAX_WEIGHT - MIN_WEIGHT);

  updated.last_updated = new Date().toISOString();

  return {
    ...rankings,
    sources: {
      ...rankings.sources,
      [sourceName]: updated,
    },
  };
}
