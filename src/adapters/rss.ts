/**
 * Generic RSS/newsletter adapter.
 *
 * Reads the feed list from feeds.yaml (or the path in RSS_FEEDS_FILE env var)
 * and fetches all of them.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import type { SourceAdapter, SourceItem } from "../types.js";
import { parseRss } from "./rss-util.js";

interface FeedConfig {
  name: string;
  url: string;
}

interface FeedsFile {
  feeds: FeedConfig[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFeeds(): FeedConfig[] {
  const feedsFile =
    process.env["RSS_FEEDS_FILE"] ??
    path.resolve(__dirname, "../../feeds.yaml");
  try {
    const raw = fs.readFileSync(feedsFile, "utf8");
    const parsed = yaml.load(raw) as FeedsFile;
    return parsed.feeds ?? [];
  } catch (err) {
    console.error("[rss] could not load feeds.yaml:", err);
    return [];
  }
}

export class RssAdapter implements SourceAdapter {
  readonly name = "rss" as const;

  #feeds: FeedConfig[];

  constructor(feeds?: FeedConfig[]) {
    this.#feeds = feeds ?? loadFeeds();
  }

  async fetch(lookbackDays: number): Promise<SourceItem[]> {
    const cutoff = Date.now() - lookbackDays * 86_400_000;
    const items: SourceItem[] = [];

    const results = await Promise.allSettled(
      this.#feeds.map((feed) =>
        parseRss(feed.url, "rss").then((feedItems) =>
          feedItems
            .filter((item) => new Date(item.publishedAt).getTime() >= cutoff)
            .map((item) => ({ ...item, title: `[${feed.name}] ${item.title}` }))
        )
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        items.push(...result.value);
      } else {
        console.error("[rss] feed fetch failed:", result.reason);
      }
    }
    return items;
  }
}
