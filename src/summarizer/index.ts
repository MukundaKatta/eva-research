/**
 * Summarizer — calls Anthropic Claude to distil raw source items into a
 * structured WeeklyMemo (JSON) and a human-readable markdown memo.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SourceItem, WeeklyMemo } from "../types.js";
import { WeeklyMemoSchema } from "./schema.js";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

/** ISO week string "YYYY-WW" */
export function currentWeekOf(): string {
  const now = new Date();
  // ISO week number: Mon = day 1
  const day = now.getUTCDay() || 7;
  const thursday = new Date(now);
  thursday.setUTCDate(now.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return `${thursday.getUTCFullYear()}-${String(weekNo).padStart(2, "0")}`;
}

function buildPrompt(items: SourceItem[], weekOf: string): string {
  const digest = items
    .slice(0, 200) // guard against runaway token usage
    .map(
      (item, i) =>
        `[${i + 1}] [${item.source}] ${item.title}\n  URL: ${item.url}\n  Date: ${item.publishedAt}\n  ${item.excerpt.slice(0, 300)}`
    )
    .join("\n\n");

  return `You are Eva's research engine. Your job is to identify the highest-signal trends and opportunities for a creator at the 0→10M follower stage.

Analyse the following ${items.length} items collected in the past 7 days:

---
${digest}
---

Produce a JSON object ONLY (no prose, no markdown fences) with this exact schema:

{
  "week_of": "${weekOf}",
  "themes": [
    {
      "title": "<short theme name>",
      "evidence": ["<url1>", "<url2>"],
      "hypothesis": "<why this might win for a creator at the 0→10M stage>",
      "confidence": <0.0..1.0>
    }
  ],
  "experiments": [
    {
      "id": "<slug>",
      "try_this": "<concrete action Eva should try this week>",
      "platform": "<x|yt|reddit|newsletter>",
      "estimated_effort_min": <minutes>,
      "theme_ref": "<theme title this experiment is linked to>"
    }
  ]
}

Rules:
- 3–6 themes, ranked by confidence descending.
- 5–10 experiments (at least one per theme; prefer quick wins ≤60 min).
- evidence URLs must come verbatim from the item list above.
- hypothesis must mention "0→10M stage" context.
- Return ONLY valid JSON — no extra text.`;
}

function memoToMarkdown(memo: WeeklyMemo): string {
  const lines: string[] = [
    `# Eva Research Memo — Week ${memo.week_of}`,
    "",
    `_Generated ${new Date().toUTCString()}_`,
    "",
    "## Themes",
    "",
  ];

  for (const theme of memo.themes) {
    lines.push(`### ${theme.title}  (confidence: ${(theme.confidence * 100).toFixed(0)}%)`);
    lines.push("");
    lines.push(theme.hypothesis);
    lines.push("");
    lines.push("**Evidence:**");
    for (const url of theme.evidence) {
      lines.push(`- ${url}`);
    }
    lines.push("");
  }

  lines.push("## Experiments");
  lines.push("");
  lines.push(
    "| ID | Platform | Try This | Est. Effort | Theme |"
  );
  lines.push("|---|---|---|---|---|");
  for (const exp of memo.experiments) {
    lines.push(
      `| ${exp.id} | ${exp.platform} | ${exp.try_this} | ${exp.estimated_effort_min} min | ${exp.theme_ref} |`
    );
  }
  lines.push("");

  return lines.join("\n");
}

export async function summarize(items: SourceItem[]): Promise<{
  memo: WeeklyMemo;
  markdown: string;
}> {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. See .env.example for instructions."
    );
  }

  const client = new Anthropic();
  const weekOf = currentWeekOf();
  const prompt = buildPrompt(items, weekOf);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Strip accidental markdown fences
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();

  const parsed: unknown = JSON.parse(jsonText);
  const memo = WeeklyMemoSchema.parse(parsed);
  const markdown = memoToMarkdown(memo);

  return { memo, markdown };
}
