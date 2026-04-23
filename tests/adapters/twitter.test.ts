import { describe, it, expect, vi, beforeEach } from "vitest";
import { TwitterAdapter } from "../../src/adapters/twitter.js";

const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>levelsio / X</title>
    <item>
      <title>Just shipped a new feature for NomadList</title>
      <link>https://nitter.privacydev.net/levelsio/status/123</link>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>Just shipped a new feature for NomadList — took 2 hours with AI</description>
    </item>
  </channel>
</rss>`;

describe("TwitterAdapter", () => {
  beforeEach(() => {
    delete process.env["X_BEARER_TOKEN"];
    vi.restoreAllMocks();
  });

  it("fetches items from Nitter RSS when no bearer token is set", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => MOCK_RSS,
    } as Response);

    const adapter = new TwitterAdapter();
    const items = await adapter.fetch(7);

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].source).toBe("twitter");
    expect(items[0].title).toBeTruthy();
    expect(items[0].url).toBeTruthy();
  });

  it("returns empty array and logs when all Nitter mirrors fail", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const adapter = new TwitterAdapter();
    const items = await adapter.fetch(7);

    expect(items).toEqual([]);
    expect(spy).toHaveBeenCalled();
  });

  it("filters out items older than lookbackDays", async () => {
    const oldDate = new Date(Date.now() - 30 * 86_400_000).toUTCString();
    const oldRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Old tweet</title>
      <link>https://nitter.privacydev.net/levelsio/status/999</link>
      <pubDate>${oldDate}</pubDate>
      <description>This is old</description>
    </item>
  </channel>
</rss>`;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => oldRss,
    } as Response);

    const adapter = new TwitterAdapter();
    const items = await adapter.fetch(7);

    expect(items).toEqual([]);
  });
});
