/**
 * Product Hunt adapter — fetches the weekly top products via public GraphQL.
 * No auth required for basic queries (PH allows unauthenticated public access).
 */

import type { SourceAdapter, SourceItem } from "../types.js";

const PH_GRAPHQL = "https://api.producthunt.com/v2/api/graphql";

const QUERY = `
  query WeeklyTop($postedAfter: DateTime!) {
    posts(order: VOTES, postedAfter: $postedAfter, first: 20) {
      edges {
        node {
          id
          name
          tagline
          description
          url
          createdAt
          votesCount
        }
      }
    }
  }
`;

interface PHPost {
  id: string;
  name: string;
  tagline: string;
  description: string | null;
  url: string;
  createdAt: string;
  votesCount: number;
}

export class ProductHuntAdapter implements SourceAdapter {
  readonly name = "producthunt" as const;

  async fetch(lookbackDays: number): Promise<SourceItem[]> {
    const postedAfter = new Date(
      Date.now() - lookbackDays * 86_400_000
    ).toISOString();

    try {
      const res = await fetch(PH_GRAPHQL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "eva-research/0.1 (+https://github.com/MukundaKatta/eva-research)",
        },
        body: JSON.stringify({ query: QUERY, variables: { postedAfter } }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        console.error(`[producthunt] HTTP ${res.status}`);
        return [];
      }

      const data = (await res.json()) as {
        data?: {
          posts?: {
            edges?: Array<{ node: PHPost }>;
          };
        };
        errors?: Array<{ message: string }>;
      };

      if (data.errors?.length) {
        console.error("[producthunt] GraphQL errors:", data.errors);
        return [];
      }

      return (data.data?.posts?.edges ?? []).map(({ node }) => ({
        url: node.url,
        title: `${node.name} — ${node.tagline}`,
        publishedAt: node.createdAt,
        excerpt: node.description?.slice(0, 500) ?? node.tagline,
        source: "producthunt" as const,
      }));
    } catch (err) {
      console.error("[producthunt] fetch error:", err);
      return [];
    }
  }
}
