#!/usr/bin/env tsx
/**
 * scripts/run-weekly.ts
 *
 * Manual / CI entry point for the weekly research loop.
 *
 * Usage:
 *   pnpm run-weekly
 *   LOOKBACK_DAYS=14 pnpm run-weekly
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_ADAPTERS } from "../src/adapters/index.js";
import { summarize, currentWeekOf } from "../src/summarizer/index.js";
import type { SourceItem } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const LOOKBACK_DAYS = Number(process.env["LOOKBACK_DAYS"] ?? "7");

async function main(): Promise<void> {
  console.log(`[run-weekly] lookback: ${LOOKBACK_DAYS} days`);
  console.log(`[run-weekly] running ${ALL_ADAPTERS.length} adapters…`);

  // Ingest all sources in parallel; failures are isolated per adapter
  const results = await Promise.allSettled(
    ALL_ADAPTERS.map((adapter) =>
      adapter
        .fetch(LOOKBACK_DAYS)
        .then((items) => {
          console.log(`[${adapter.name}] ✓ ${items.length} items`);
          return items;
        })
        .catch((err) => {
          console.error(`[${adapter.name}] ✗ fatal:`, err);
          return [] as SourceItem[];
        })
    )
  );

  const allItems: SourceItem[] = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );
  console.log(`[run-weekly] total items: ${allItems.length}`);

  if (allItems.length === 0) {
    console.error("[run-weekly] no items collected — aborting");
    process.exit(1);
  }

  console.log("[run-weekly] summarising…");
  const { memo, markdown } = await summarize(allItems);

  // Write memo JSON
  const weekOf = currentWeekOf();
  const jsonPath = path.join(ROOT, "memos", `${weekOf}.json`);
  const mdPath = path.join(ROOT, "memos", `${weekOf}.md`);

  fs.mkdirSync(path.join(ROOT, "memos"), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(memo, null, 2) + "\n", "utf8");
  fs.writeFileSync(mdPath, markdown, "utf8");

  console.log(`[run-weekly] memo written → ${mdPath}`);
  console.log(`[run-weekly] json written → ${jsonPath}`);
  console.log(`\n${"─".repeat(60)}`);
  console.log(markdown);
}

main().catch((err) => {
  console.error("[run-weekly] fatal:", err);
  process.exit(1);
});
