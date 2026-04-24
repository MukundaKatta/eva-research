# Eva Operator Design

## Which repo

**Home: `eva-research`.** The operator's job is (1) read memos, (2) generate drafts, (3) call `record-result.ts` to close the loop into `rankings.json`. Steps 1 and 3 are entirely local to this repo — the operator is glue code between the memo files and the posting layer. Putting it in `fanout` would make `fanout` depend on `eva-research`'s schema; a new repo would split the feedback loop across three codebases with no benefit at v0.

## How the operator consumes memos

The operator reads the latest `memos/YYYY-WW.json` directly from disk — the file is already present after each Monday cron run. No network fetch, no `git pull`. Consuming the JSON (not the Markdown) is intentional: the Zod schema in `src/summarizer/schema.ts` is the contract, and the JSON is machine-readable with typed `platform`, `confidence`, and `evidence` fields the operator uses to construct prompts.

```ts
// scripts/operator.ts (v0 sketch)
const memo = JSON.parse(fs.readFileSync(`memos/${currentWeekOf()}.json`, "utf8"));
for (const exp of memo.experiments) { /* generate drafts */ }
```

## How one experiment becomes N platform drafts

Each `Experiment` has `platform ∈ {x, yt, reddit, newsletter}` and `try_this` (≤60-min action). The operator calls `POST /generate` on a running `fanout` backend once per experiment, passing a product string assembled from the memo fields:

```
product = `${exp.try_this}

Context: ${theme.hypothesis} (confidence ${(theme.confidence * 100).toFixed(0)}%)
Evidence: ${theme.evidence.join(", ")}`
platforms = [exp.platform mapped to fanout platform IDs]
```

Platform mapping: `x → "x"`, `yt → "youtube"` (title+desc via fanout's yt rules), `reddit → "reddit"`, `newsletter → "email"`.

Fanout's `SocialAgent` in `backend/app/agent.py` already runs Plan → Write → Critique → Refine and enforces platform constraints (280-char X limit, YT title ≤60 chars, etc.). The operator does not re-implement these rules.

For YouTube, fanout's yt platform adapter is called once and expected to produce a `{title, description}` block — the existing agent prompt shape handles this since the platform rules are loaded from `/web/lib/platforms.ts` by the backend.

## How posting/feedback closes the loop

**v0 is manual at the confirmation step** — this is the right call because `record-result.ts` expects a human judgment (win/loss/neutral) that can't be derived from an impression count alone.

1. Operator generates drafts → prints JSON to stdout (or saves to `drafts/YYYY-WW.json`)
2. Human reviews, selects drafts in fanout UI, queues them
3. Fanout extension auto-posts (X, LinkedIn) or assists (Reddit) and calls `POST /posted` with `post_url`
4. After observing performance (hours/days), human runs: `pnpm record-result <experiment-id> win|loss --delta N`
5. `record-result.ts` maps the experiment's `theme.evidence` URLs to source names and updates `rankings.json` weights via Beta posterior

No changes to `record-result.ts` are needed. The operator generates drafts; the human closes the loop.

## Fanout: reuse vs. build

**Reuse from fanout:**
- `POST /generate` endpoint and `SocialAgent` (plan/write/critique/refine pipeline + platform constraints)
- `POST /drafts/{id}/queue` and `GET /queue` for scheduling
- Chrome extension posting automation for X, LinkedIn, Threads — content scripts already handle DOM automation and `POST /posted` callback
- `Draft` data model for storage and status state machine (`pending → queued → posted`)

**Build new in eva-research:**
- `scripts/operator.ts` — reads memo JSON, assembles `product` string per experiment, calls fanout `/generate`, prints or saves draft output
- Fanout URL config in `operator.ts` (env var `FANOUT_URL`, `FANOUT_TOKEN`)
- A `drafts/YYYY-WW.json` output file format (optional, for audit trail)

Nothing in fanout's schema needs changing for v0.

## Minimum viable v0

**Ships in the first build PR:**
- `scripts/operator.ts`: reads latest memo, iterates experiments, calls `POST /generate` on fanout, writes `drafts/YYYY-WW.json`
- `.env.example` addition: `FANOUT_URL`, `FANOUT_TOKEN`
- `package.json` script: `"operator": "tsx scripts/operator.ts"`

**Deferred:**
- Auto-queuing drafts (skip human review step)
- Automatic `record-result` call from fanout's `POST /posted` webhook
- Scheduling experiments across the week
- Multi-experiment filtering by confidence threshold (run only top-N)
