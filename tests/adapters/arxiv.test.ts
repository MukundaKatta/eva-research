import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArxivAdapter } from "../../src/adapters/arxiv.js";

const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:arxiv="http://arxiv.org/schemas/atom" version="2.0">
  <channel>
    <title>cs.AI updates on arXiv.org</title>
    <item>
      <title>Attention Is All You Need (Redux)</title>
      <link>https://arxiv.org/abs/2401.00001</link>
      <description>We propose a new transformer architecture that improves...</description>
      <pubDate>${new Date().toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`;

describe("ArxivAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches cs.CL and cs.AI feeds", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => MOCK_RSS,
    } as Response);

    const adapter = new ArxivAdapter();
    const items = await adapter.fetch(7);

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].source).toBe("arxiv");
    expect(items[0].url).toContain("arxiv.org");

    // Should hit two feeds
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it("continues with remaining feeds when one fails", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("timeout"));
      return Promise.resolve({ ok: true, text: async () => MOCK_RSS } as Response);
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const adapter = new ArxivAdapter();
    const items = await adapter.fetch(7);

    expect(items.length).toBeGreaterThan(0);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[arxiv]"), expect.anything());
  });
});
