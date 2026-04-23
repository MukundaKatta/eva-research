/**
 * Twitter / X adapter.
 *
 * Strategy (in priority order):
 *   1. X v2 user-timeline endpoint if X_BEARER_TOKEN is set.
 *   2. Nitter-style public RSS mirrors (no auth required).
 *
 * The adapter fetches from a curated list of creator/marketing accounts.
 * Adjust ACCOUNTS to taste — it's the only knob.
 */

import type { SourceAdapter, SourceItem } from "../types.js";
import { parseRss } from "./rss-util.js";

// Accounts to watch when using the v2 API (username, no @)
const ACCOUNTS = [
  "levelsio",
  "marc_louvion",
  "swyx",
  "shreyas",
  "benedictevans",
];

// Nitter mirrors to try in order
const NITTER_MIRRORS = [
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
  "https://nitter.1d4.us",
];

export class TwitterAdapter implements SourceAdapter {
  readonly name = "twitter" as const;

  async fetch(lookbackDays: number): Promise<SourceItem[]> {
    const token = process.env["X_BEARER_TOKEN"];
    if (token) {
      return this.#fetchV2(token, lookbackDays);
    }
    return this.#fetchNitter(lookbackDays);
  }

  async #fetchV2(token: string, lookbackDays: number): Promise<SourceItem[]> {
    const startTime = new Date(
      Date.now() - lookbackDays * 86_400_000
    ).toISOString();
    const items: SourceItem[] = [];

    for (const username of ACCOUNTS) {
      try {
        // Resolve user ID
        const userRes = await fetch(
          `https://api.twitter.com/2/users/by/username/${username}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!userRes.ok) {
          console.error(`[twitter] user lookup failed for @${username}: ${userRes.status}`);
          continue;
        }
        const userData = (await userRes.json()) as { data?: { id: string } };
        const userId = userData.data?.id;
        if (!userId) continue;

        // Fetch recent tweets
        const params = new URLSearchParams({
          "tweet.fields": "created_at,text",
          "exclude": "retweets,replies",
          "start_time": startTime,
          "max_results": "20",
        });
        const tweetsRes = await fetch(
          `https://api.twitter.com/2/users/${userId}/tweets?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!tweetsRes.ok) {
          console.error(`[twitter] timeline fetch failed for @${username}: ${tweetsRes.status}`);
          continue;
        }
        const tweetsData = (await tweetsRes.json()) as {
          data?: Array<{ id: string; text: string; created_at: string }>;
        };
        for (const tweet of tweetsData.data ?? []) {
          items.push({
            url: `https://twitter.com/${username}/status/${tweet.id}`,
            title: tweet.text.slice(0, 100),
            publishedAt: tweet.created_at,
            excerpt: tweet.text,
            source: "twitter",
          });
        }
      } catch (err) {
        console.error(`[twitter] error fetching @${username}:`, err);
      }
    }
    return items;
  }

  async #fetchNitter(lookbackDays: number): Promise<SourceItem[]> {
    const cutoff = Date.now() - lookbackDays * 86_400_000;
    const items: SourceItem[] = [];

    for (const username of ACCOUNTS) {
      let fetched = false;
      for (const mirror of NITTER_MIRRORS) {
        try {
          const url = `${mirror}/${username}/rss`;
          const parsed = await parseRss(url);
          for (const item of parsed) {
            if (new Date(item.publishedAt).getTime() >= cutoff) {
              items.push({ ...item, source: "twitter" });
            }
          }
          fetched = true;
          break;
        } catch {
          // try next mirror
        }
      }
      if (!fetched) {
        console.error(`[twitter] all Nitter mirrors failed for @${username}`);
      }
    }
    return items;
  }
}
