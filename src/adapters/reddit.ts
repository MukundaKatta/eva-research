/**
 * Reddit adapter — uses the public JSON endpoint (no auth required).
 *
 * Fetches the top posts from the last week for each configured subreddit.
 * Rate-limits itself to ~1 req/sec to be a good citizen.
 */

import type { SourceAdapter, SourceItem } from "../types.js";

const DEFAULT_SUBREDDITS = [
  "Entrepreneur",
  "startups",
  "SideProject",
  "indiehackers",
  "marketing",
];

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    url: string;
    permalink: string;
    created_utc: number;
    score: number;
  };
}

export class RedditAdapter implements SourceAdapter {
  readonly name = "reddit" as const;

  #subreddits: string[];

  constructor(subreddits?: string[]) {
    const fromEnv = process.env["REDDIT_SUBREDDITS"];
    this.#subreddits =
      subreddits ??
      (fromEnv ? fromEnv.split(",").map((s) => s.trim()) : DEFAULT_SUBREDDITS);
  }

  async fetch(lookbackDays: number): Promise<SourceItem[]> {
    const cutoff = Date.now() / 1000 - lookbackDays * 86_400;
    const items: SourceItem[] = [];

    for (const sub of this.#subreddits) {
      try {
        await sleep(1_000); // gentle rate-limit
        const url = `https://www.reddit.com/r/${sub}/top.json?t=week&limit=25`;
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "eva-research/0.1 (+https://github.com/MukundaKatta/eva-research)",
          },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          console.error(`[reddit] HTTP ${res.status} for r/${sub}`);
          continue;
        }
        const json = (await res.json()) as {
          data: { children: RedditPost[] };
        };
        for (const child of json.data.children) {
          const post = child.data;
          if (post.created_utc < cutoff) continue;
          items.push({
            url: `https://reddit.com${post.permalink}`,
            title: post.title,
            publishedAt: new Date(post.created_utc * 1000).toISOString(),
            excerpt: post.selftext.slice(0, 500),
            source: "reddit",
          });
        }
      } catch (err) {
        console.error(`[reddit] error fetching r/${sub}:`, err);
      }
    }
    return items;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
