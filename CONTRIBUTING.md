# Contributing to eva-research

Thanks for your interest in contributing! This document describes how to set
up the project locally and the conventions we follow.

`eva-research` is an auto-research loop that ingests signals from sources such
as X, YouTube, Reddit, arXiv, Product Hunt, and newsletters, then produces
weekly strategy memos.

## Prerequisites

- [Node.js](https://nodejs.org/) **>= 22** (see the `engines` field in `package.json`)
- [pnpm](https://pnpm.io/) **9.x** (the CI uses `pnpm install --frozen-lockfile`)

## Getting started

```bash
# Install dependencies
pnpm install

# Copy the example environment file and fill in your secrets
cp .env.example .env
```

The relevant secrets (see `.env.example`) include `ANTHROPIC_API_KEY`,
`X_BEARER_TOKEN`, and `YOUTUBE_API_KEY`.

## Development workflow

The following scripts are defined in `package.json`:

| Command               | Description                                      |
| --------------------- | ------------------------------------------------ |
| `pnpm test`           | Run the test suite once with Vitest              |
| `pnpm test:watch`     | Run Vitest in watch mode                         |
| `pnpm typecheck`      | Type-check the project with `tsc --noEmit`       |
| `pnpm lint`           | Lint `src`, `scripts`, and `tests` with ESLint   |
| `pnpm run-weekly`     | Run the weekly research loop locally             |
| `pnpm record-result` | Record a ranking result                          |

Before opening a pull request, please make sure the project builds, the type
checker passes, and the tests are green:

```bash
pnpm typecheck
pnpm test
pnpm lint
```

## Project layout

- `src/adapters/` — source adapters (arXiv, Product Hunt, Reddit, RSS, X, YouTube)
- `src/rankings/` — ranking logic
- `src/summarizer/` — summarization and output schema
- `scripts/` — entry points (`run-weekly.ts`, `record-result.ts`)
- `tests/` — Vitest test suites
- `docs/` and `ARCHITECTURE.md` — design and architecture notes

## Commit and pull request guidelines

- Use clear, descriptive commit messages. Conventional Commit prefixes
  (`feat:`, `fix:`, `chore:`, `docs:`, etc.) are appreciated.
- Keep pull requests focused and small where possible.
- Ensure CI passes before requesting review.

## Code style

- The codebase is written in **TypeScript** with ES modules (`"type": "module"`).
- Follow the existing formatting and ESLint rules.
- Prefer small, well-typed, and well-tested changes.

Happy hacking!
