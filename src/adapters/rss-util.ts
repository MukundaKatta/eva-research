/**
 * Shared RSS/Atom fetching utility used by multiple adapters.
 */

import { XMLParser } from "fast-xml-parser";
import type { SourceItem, SourceName } from "../types.js";

const parser = new XMLParser({ ignoreAttributes: false });

interface RawItem {
  title?: string | { "#text"?: string };
  link?: string | { "#text"?: string } | { "@_href"?: string };
  description?: string;
  summary?: string;
  pubDate?: string;
  published?: string;
  updated?: string;
  "dc:date"?: string;
  guid?: string | { "#text"?: string };
  id?: string;
}

function coerceString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    return String(obj["#text"] ?? obj["@_href"] ?? "");
  }
  return "";
}

function extractItems(parsed: Record<string, unknown>): RawItem[] {
  // RSS 2.0
  const channel = (parsed["rss"] as Record<string, unknown> | undefined)?.["channel"];
  if (channel) {
    const items = (channel as Record<string, unknown>)["item"];
    if (Array.isArray(items)) return items as RawItem[];
    if (items) return [items as RawItem];
  }
  // Atom
  const feed = parsed["feed"] as Record<string, unknown> | undefined;
  if (feed) {
    const entries = feed["entry"];
    if (Array.isArray(entries)) return entries as RawItem[];
    if (entries) return [entries as RawItem];
  }
  return [];
}

function extractDate(item: RawItem): string {
  const raw =
    item.pubDate ??
    item.published ??
    item.updated ??
    item["dc:date"] ??
    "";
  const d = new Date(coerceString(raw));
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function extractLink(item: RawItem): string {
  const raw = item.link ?? item.guid ?? item.id ?? "";
  return coerceString(raw);
}

export async function parseRss(
  url: string,
  sourceName: SourceName = "rss"
): Promise<SourceItem[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "eva-research/0.1 (+https://github.com/MukundaKatta/eva-research)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const text = await res.text();
  const parsed = parser.parse(text) as Record<string, unknown>;
  const rawItems = extractItems(parsed);

  return rawItems.map((item) => ({
    url: extractLink(item) || url,
    title: coerceString(item.title).slice(0, 200) || "(no title)",
    publishedAt: extractDate(item),
    excerpt: coerceString(item.description ?? item.summary ?? "").slice(0, 500),
    source: sourceName,
  }));
}
