import { describe, it, expect, vi, beforeEach } from "vitest";
import { YouTubeAdapter } from "../../src/adapters/youtube.js";

const MOCK_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Ali Abdaal</title>
  <entry>
    <id>yt:video:abc123</id>
    <title>How I Grew to 5M Subscribers</title>
    <link href="https://www.youtube.com/watch?v=abc123"/>
    <published>${new Date().toISOString()}</published>
    <summary>My full strategy for growing on YouTube in 2024</summary>
  </entry>
</feed>`;

describe("YouTubeAdapter", () => {
  beforeEach(() => {
    delete process.env["YOUTUBE_API_KEY"];
    vi.restoreAllMocks();
  });

  it("fetches channel RSS when no API key is set", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => MOCK_ATOM,
    } as Response);

    const adapter = new YouTubeAdapter();
    const items = await adapter.fetch(7);

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].source).toBe("youtube");
    expect(items[0].url).toContain("youtube.com");
  });

  it("returns empty array and logs when channel RSS fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "",
    } as Response);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const adapter = new YouTubeAdapter();
    const items = await adapter.fetch(7);

    expect(items).toEqual([]);
    expect(spy).toHaveBeenCalled();
  });
});
