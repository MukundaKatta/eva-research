import { describe, it, expect, vi, beforeEach } from "vitest";
import { RssAdapter } from "../../src/adapters/rss.js";

const MOCK_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Stratechery</title>
    <item>
      <title>The AI Platform Wars</title>
      <link>https://stratechery.com/2024/ai-platform-wars/</link>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>A deep dive into how platforms are competing in the AI era.</description>
    </item>
  </channel>
</rss>`;

describe("RssAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches items from configured feeds", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => MOCK_FEED,
    } as Response);

    const adapter = new RssAdapter([
      { name: "Stratechery", url: "https://stratechery.com/feed/" },
    ]);
    const items = await adapter.fetch(7);

    expect(items.length).toBe(1);
    expect(items[0].source).toBe("rss");
    expect(items[0].title).toContain("[Stratechery]");
    expect(items[0].url).toContain("stratechery.com");
  });

  it("continues fetching other feeds when one fails", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("network error"));
      return Promise.resolve({ ok: true, text: async () => MOCK_FEED } as Response);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const adapter = new RssAdapter([
      { name: "BadFeed", url: "https://bad.example.com/feed" },
      { name: "Stratechery", url: "https://stratechery.com/feed/" },
    ]);
    const items = await adapter.fetch(7);

    expect(items.length).toBe(1);
    expect(items[0].title).toContain("[Stratechery]");
  });

  it("filters items older than lookbackDays", async () => {
    const oldFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Old Article</title>
      <link>https://stratechery.com/old/</link>
      <pubDate>${new Date(Date.now() - 30 * 86_400_000).toUTCString()}</pubDate>
      <description>This is old content.</description>
    </item>
  </channel>
</rss>`;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => oldFeed,
    } as Response);

    const adapter = new RssAdapter([
      { name: "Test", url: "https://test.example.com/feed" },
    ]);
    const items = await adapter.fetch(7);

    expect(items).toEqual([]);
  });
});
