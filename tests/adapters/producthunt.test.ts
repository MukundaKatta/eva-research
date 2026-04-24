import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductHuntAdapter } from "../../src/adapters/producthunt.js";

const MOCK_RESPONSE = {
  data: {
    posts: {
      edges: [
        {
          node: {
            id: "1",
            name: "SuperWriter AI",
            tagline: "Write 10x faster with AI",
            description: "An AI writing tool for creators and marketers.",
            url: "https://www.producthunt.com/posts/superwriter-ai",
            createdAt: new Date().toISOString(),
            votesCount: 542,
          },
        },
      ],
    },
  },
};

describe("ProductHuntAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches weekly top posts via GraphQL", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_RESPONSE,
    } as Response);

    const adapter = new ProductHuntAdapter();
    const items = await adapter.fetch(7);

    expect(items.length).toBe(1);
    expect(items[0].source).toBe("producthunt");
    expect(items[0].title).toContain("SuperWriter AI");
    expect(items[0].url).toContain("producthunt.com");
  });

  it("returns empty array on HTTP error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const adapter = new ProductHuntAdapter();
    const items = await adapter.fetch(7);

    expect(items).toEqual([]);
  });

  it("returns empty array when GraphQL errors are present", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: "Unauthorized" }] }),
    } as Response);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const adapter = new ProductHuntAdapter();
    const items = await adapter.fetch(7);

    expect(items).toEqual([]);
  });
});
