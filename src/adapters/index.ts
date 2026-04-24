/**
 * Adapter registry.
 *
 * To add a new source:
 *   1. Create src/adapters/<name>.ts implementing SourceAdapter.
 *   2. Import and add an instance to ALL_ADAPTERS below.
 *
 * To disable a source: remove it from ALL_ADAPTERS or comment it out.
 */

import { TwitterAdapter } from "./twitter.js";
import { YouTubeAdapter } from "./youtube.js";
import { RedditAdapter } from "./reddit.js";
import { ArxivAdapter } from "./arxiv.js";
import { ProductHuntAdapter } from "./producthunt.js";
import { RssAdapter } from "./rss.js";
import type { SourceAdapter } from "../types.js";

export const ALL_ADAPTERS: SourceAdapter[] = [
  new TwitterAdapter(),
  new YouTubeAdapter(),
  new RedditAdapter(),
  new ArxivAdapter(),
  new ProductHuntAdapter(),
  new RssAdapter(),
];

export {
  TwitterAdapter,
  YouTubeAdapter,
  RedditAdapter,
  ArxivAdapter,
  ProductHuntAdapter,
  RssAdapter,
};
