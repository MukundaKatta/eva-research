# Architecture — The Compounding Loop

eva-research is designed around a single idea: **every experiment Eva runs
teaches the system which signals to trust, so each memo is sharper than the
last.**

## The Feedback Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│  Week N                                                             │
│                                                                     │
│  1. INGEST                                                          │
│     Six adapters pull items from Twitter, YouTube, Reddit, arXiv,  │
│     Product Hunt, and newsletters. Each adapter is independent;     │
│     a dead source does not block the run.                           │
│                                                                     │
│  2. SUMMARISE                                                       │
│     Claude Sonnet 4.6 reads up to 200 items and produces:          │
│       • 3–6 themes (what's moving + why it might win)              │
│       • 5–10 experiments (concrete actions, <60 min each)          │
│     Output is validated with Zod before being saved.               │
│                                                                     │
│  3. REVIEW                                                          │
│     A GitHub PR opens with the memo as its body.                   │
│     Eva (or a human) reviews and picks ONE experiment to run.      │
│                                                                     │
│  4. EXECUTE                                                         │
│     Eva posts the experiment (fanout handles the actual posting).   │
│     No social-API interaction happens inside eva-research.         │
│                                                                     │
│  5. OBSERVE                                                         │
│     After 24–72 h, observe the outcome (follower delta, engagement).│
│                                                                     │
│  6. LOG                                                             │
│     `pnpm record-result <id> win|loss|neutral --delta N`           │
│     Updates rankings.json using a Beta posterior mean.             │
│                                                                     │
│  ────────────────── rankings.json ──────────────────────────────   │
│                                                                     │
│  Week N+1                                                           │
│     The summariser re-runs. Sources with higher weights contribute  │
│     more signal to the next memo. Patterns that won compound.      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Why This Compounds

At week 0 all sources start equal (weight = 1.0). After a few months of
logging results:

- A source that consistently surfaces winning experiments drifts toward
  weight = 2.0 (4× the influence of a zero-signal source).
- A source that never produces actionable signal drifts toward weight = 0.1.

The Beta distribution prior (α=1, β=1, i.e. uniform) means the weights
do not swing wildly on one data point — they move slowly and only in the
direction the evidence supports.

## Weight Formula

```
posterior_mean = (wins + α) / (wins + losses + α + β)
                                where α = β = 1

weight = 0.1 + posterior_mean × (2.0 − 0.1)
```

At zero data (wins=0, losses=0): weight = 0.1 + 0.5 × 1.9 = 1.05 ≈ 1.0 ✓
At 10 wins, 0 losses:            weight = 0.1 + (11/12) × 1.9 ≈ 1.84
At 0 wins, 10 losses:            weight = 0.1 + (1/12) × 1.9 ≈ 0.26

## Component Responsibilities

| Component | File(s) | Responsibility |
|---|---|---|
| Source adapters | `src/adapters/*.ts` | Fetch + normalise raw items |
| Adapter registry | `src/adapters/index.ts` | One-line add/remove |
| RSS utility | `src/adapters/rss-util.ts` | Shared RSS/Atom parsing |
| Summariser | `src/summarizer/index.ts` | Claude API call + parsing |
| Memo schema | `src/summarizer/schema.ts` | Zod validation |
| Rankings | `src/rankings/index.ts` | Load, update, save weights |
| Weekly runner | `scripts/run-weekly.ts` | Orchestration entrypoint |
| Result logger | `scripts/record-result.ts` | Closes the feedback loop |
| Automation | `.github/workflows/weekly.yml` | CI/CD cron |
| Feed config | `feeds.yaml` | Newsletter list (user-editable) |
| Rankings state | `rankings.json` | Mutable source weights |
| Memos | `memos/` | Output artefacts (committed) |

## Eva Integration

fanout's agentic pipeline (`backend/app/agent.py`) reads Eva's persona and
task from an issue. In v1, Eva's system prompt will include:

```
Read the latest memo at:
https://raw.githubusercontent.com/MukundaKatta/eva-research/main/memos/<latest>.md

Pick one experiment from the "Experiments" table that fits your current
platform mix and estimated bandwidth.
```

No API call from fanout to eva-research is needed — the memo is a plain
markdown file on `main` that Eva can read via a raw GitHub URL.

## Non-Goals (v0)

- No social-API writes (posting, DMs)
- No web UI — memos are markdown, rankings are JSON
- No live follower-count polling — results are logged manually
- No multi-agent coordination — Eva picks experiments herself
