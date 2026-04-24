/**
 * YouTube adapter.
 *
 * Strategy (in priority order):
 *   1. YouTube Data API v3 if YOUTUBE_API_KEY is set — fetches search results
 *      for creator-economy keywords.
 *   2. YouTube trending RSS (unofficial but unauthenticated) as fallback.
 *      Note: YouTube removed its public trending RSS in 2022; this falls back
 *      to the channel RSS for curated creator channels instead.
 */

import type { SourceAdapter, SourceItem } from "../types.js";
import { parseRss } from "./rss-util.js";

const SEARCH_QUERIES = [
  "content creator strategy 2024",
  "YouTube growth tactics",
  "newsletter growth",
  "indie hacker build in public",
];

// Curated YouTube channels (channel IDs) to watch without API key
const CHANNEL_IDS = [
  "UCnUYZLuoy1rq1aVMwx4aTzw", // Graham Stephan
  "UCVLZmDKeT-mV4H3ToYXIFYg", // Ali Abdaal
  "UC295-Dw0tDd-rGHFztONtcQ", // Coding with Jan (indiehackers)
];

export class YouTubeAdapter implements SourceAdapter {
  readonly name = "youtube" as const;

  async fetch(lookbackDays: number): Promise<SourceItem[]> {
    const key = process.env["YOUTUBE_API_KEY"];
    if (key) {
      return this.#fetchApi(key, lookbackDays);
    }
    return this.#fetchChannelRss(lookbackDays);
  }

  async #fetchApi(key: string, lookbackDays: number): Promise<SourceItem[]> {
    const publishedAfter = new Date(
      Date.now() - lookbackDays * 86_400_000
    ).toISOString();
    const items: SourceItem[] = [];

    for (const q of SEARCH_QUERIES) {
      try {
        const params = new URLSearchParams({
          part: "snippet",
          q,
          type: "video",
          order: "relevance",
          publishedAfter,
          maxResults: "10",
          key,
        });
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?${params}`,
          { signal: AbortSignal.timeout(15_000) }
        );
        if (!res.ok) {
          console.error(`[youtube] API error for query "${q}": ${res.status}`);
          continue;
        }
        const data = (await res.json()) as {
          items?: Array<{
            id: { videoId: string };
            snippet: {
              title: string;
              description: string;
              publishedAt: string;
            };
          }>;
        };
        for (const video of data.items ?? []) {
          items.push({
            url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
            title: video.snippet.title,
            publishedAt: video.snippet.publishedAt,
            excerpt: video.snippet.description.slice(0, 500),
            source: "youtube",
          });
        }
      } catch (err) {
        console.error(`[youtube] error fetching query "${q}":`, err);
      }
    }
    return items;
  }

  async #fetchChannelRss(lookbackDays: number): Promise<SourceItem[]> {
    // Fallback: YouTube exposes Atom feeds per channel (no API key needed)
    const cutoff = Date.now() - lookbackDays * 86_400_000;
    const items: SourceItem[] = [];

    for (const channelId of CHANNEL_IDS) {
      try {
        const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        const parsed = await parseRss(url, "youtube");
        for (const item of parsed) {
          if (new Date(item.publishedAt).getTime() >= cutoff) {
            items.push(item);
          }
        }
      } catch (err) {
        console.error(`[youtube] channel RSS failed for ${channelId}:`, err);
      }
    }
    return items;
  }
}
