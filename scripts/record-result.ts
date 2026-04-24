#!/usr/bin/env tsx
/**
 * scripts/record-result.ts
 *
 * Log the outcome of an experiment and update rankings.json.
 *
 * Usage:
 *   pnpm record-result <experiment-id> <win|loss|neutral> [--delta <follower-delta>]
 *
 * Examples:
 *   pnpm record-result short-form-reels win --delta 412
 *   pnpm record-result reddit-ama loss
 *   pnpm record-result newsletter-cta neutral
 *
 * The experiment_id is matched against memos/*.json to find which source(s)
 * contributed the theme that spawned the experiment. All contributing sources
 * get their ranking updated.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRankings, saveRankings, updateRanking } from "../src/rankings/index.js";
import type { ResultOutcome, SourceName, WeeklyMemo } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RANKINGS_FILE = path.join(ROOT, "rankings.json");

function parseArgs(): {
  experimentId: string;
  outcome: ResultOutcome;
  delta: number | null;
} {
  const args = process.argv.slice(2);
  const experimentId = args[0];
  const outcome = args[1] as ResultOutcome;
  const deltaIdx = args.indexOf("--delta");
  const delta = deltaIdx !== -1 ? Number(args[deltaIdx + 1]) : null;

  if (!experimentId) {
    console.error("Usage: record-result <experiment-id> <win|loss|neutral> [--delta N]");
    process.exit(1);
  }
  if (!["win", "loss", "neutral"].includes(outcome)) {
    console.error(`Invalid outcome "${outcome}". Must be win, loss, or neutral.`);
    process.exit(1);
  }
  return { experimentId, outcome, delta };
}

function findExperiment(experimentId: string): {
  themeRef: string;
  evidenceUrls: string[];
} | null {
  const memosDir = path.join(ROOT, "memos");
  if (!fs.existsSync(memosDir)) return null;

  const memoFiles = fs
    .readdirSync(memosDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse(); // newest first

  for (const file of memoFiles) {
    try {
      const memo = JSON.parse(
        fs.readFileSync(path.join(memosDir, file), "utf8")
      ) as WeeklyMemo;
      const exp = memo.experiments.find((e) => e.id === experimentId);
      if (!exp) continue;
      const theme = memo.themes.find((t) => t.title === exp.theme_ref);
      return {
        themeRef: exp.theme_ref,
        evidenceUrls: theme?.evidence ?? [],
      };
    } catch {
      // ignore malformed files
    }
  }
  return null;
}

function urlToSourceName(url: string): SourceName | null {
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("reddit.com")) return "reddit";
  if (url.includes("arxiv.org")) return "arxiv";
  if (url.includes("producthunt.com")) return "producthunt";
  return "rss";
}

async function main(): Promise<void> {
  const { experimentId, outcome, delta } = parseArgs();

  const found = findExperiment(experimentId);
  if (!found) {
    console.error(`[record-result] experiment "${experimentId}" not found in any memo.`);
    console.error("  Run `ls memos/*.json` to see available memos.");
    process.exit(1);
  }

  const { themeRef, evidenceUrls } = found;
  const sourcesHit = new Set<SourceName>();
  for (const url of evidenceUrls) {
    const s = urlToSourceName(url);
    if (s) sourcesHit.add(s);
  }

  if (sourcesHit.size === 0) {
    // No evidence URLs → update all sources neutrally
    console.warn("[record-result] no evidence URLs found; no source weights updated.");
  }

  let rankings = loadRankings(RANKINGS_FILE);
  for (const sourceName of sourcesHit) {
    rankings = updateRanking(rankings, sourceName, outcome);
  }
  saveRankings(RANKINGS_FILE, rankings);

  console.log(`[record-result] recorded: experiment="${experimentId}" outcome="${outcome}"${delta !== null ? ` delta=${delta}` : ""}`);
  console.log(`[record-result] updated sources: ${[...sourcesHit].join(", ") || "(none)"}`);
  if (themeRef) {
    console.log(`[record-result] theme: "${themeRef}"`);
  }
}

main().catch((err) => {
  console.error("[record-result] fatal:", err);
  process.exit(1);
});
