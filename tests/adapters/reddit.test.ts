import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedditAdapter } from "../../src/adapters/reddit.js";

const MOCK_RESPONSE = {
  data: {
    children: [
      {
        data: {
          id: "abc123",
          title: "How I got 1000 paying customers",
          selftext: "Here is what I did...",
          url: "https://example.com/article",
          permalink: "/r/Entrepreneur/comments/abc123/",
          created_utc: Date.now() / 1000 - 86_400, // 1 day ago
          score: 450,
        },
      },
      {
        data: {
          id: "old456",
          title: "Old post that should be filtered",
          selftext: "",
          url: "https://reddit.com/r/Entrepreneur/old",
          permalink: "/r/Entrepreneur/comments/old456/",
          created_utc: Date.now() / 1000 - 30 * 86_400, // 30 days ago
          score: 100,
        },
      },
    ],
  },
};

describe("RedditAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches top posts and filters by lookback window", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_RESPONSE,
    } as Response);

    const adapter = new RedditAdapter(["Entrepreneur"]);
    const items = await adapter.fetch(7);

    expect(items.length).toBe(1);
    expect(items[0].source).toBe("reddit");
    expect(items[0].title).toBe("How I got 1000 paying customers");
    expect(items[0].url).toContain("reddit.com/r/Entrepreneur");
  });

  it("returns empty array and logs on HTTP error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as Response);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const adapter = new RedditAdapter(["Entrepreneur"]);
    const items = await adapter.fetch(7);

    expect(items).toEqual([]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[reddit]"), expect.anything());
  });

  it("uses REDDIT_SUBREDDITS env var when set", async () => {
    process.env["REDDIT_SUBREDDITS"] = "SideProject,indiehackers";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { children: [] } }),
    } as Response);

    const adapter = new RedditAdapter();
    await adapter.fetch(7);

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("SideProject");

    delete process.env["REDDIT_SUBREDDITS"];
  });
});
