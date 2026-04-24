/**
 * arXiv adapter — parses the Atom RSS feeds for cs.CL and cs.AI.
 * No API key required.
 */

import type { SourceAdapter, SourceItem } from "../types.js";
import { parseRss } from "./rss-util.js";

const FEEDS = [
  "https://rss.arxiv.org/rss/cs.CL", // Computation and Language
  "https://rss.arxiv.org/rss/cs.AI",  // Artificial Intelligence
];

export class ArxivAdapter implements SourceAdapter {
  readonly name = "arxiv" as const;

  async fetch(lookbackDays: number): Promise<SourceItem[]> {
    const cutoff = Date.now() - lookbackDays * 86_400_000;
    const items: SourceItem[] = [];

    for (const feedUrl of FEEDS) {
      try {
        const parsed = await parseRss(feedUrl, "arxiv");
        for (const item of parsed) {
          if (new Date(item.publishedAt).getTime() >= cutoff) {
            items.push(item);
          }
        }
      } catch (err) {
        console.error(`[arxiv] error fetching ${feedUrl}:`, err);
      }
    }
    return items;
  }
}
