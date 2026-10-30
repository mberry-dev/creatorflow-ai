# CreatorFlow AI Evals

Unit tests check that the code works. Evals check that the **AI output is good**. This folder sends 20 realistic and tricky inputs through the real Express app, scores each response with pass/fail checks, and saves every output so prompt versions can be compared.

## Run

From `backend/`:

```bash
# Free dry run: Mock Mode, no OpenAI calls. Checks the plumbing only.
npm run eval -- --mock

# Real run against gpt-4o-mini, using OPENAI_API_KEY from backend/.env.
# Shows a cost estimate (about 1 cent for 20 cases) and asks before sending anything.
npm run eval -- --label v1

# Run only some cases
npm run eval -- --label v1 --only T6,D4
```

Results are saved to `evals/results/<label>-<mode>-<time>.json`, with the input, output and every check for each case.

Evals are not part of `npm test`, so the regular test suite stays free and repeatable.

## What's tested (20 cases)

| Group | Cases | What they check |
|---|---|---|
| Titles | T1-T7 | 3-5 titles, unique, under the platform limit (YouTube 100, others 150), on topic, no invented numbers; professional tone; a non-English topic; a prompt-injection topic; a 3,000-character topic |
| Descriptions | D1-D4 | Under the platform limit (TikTok/Instagram 2,200, YouTube 5,000), on topic, no placeholders like `[Insert link]`, no invented links or numbers |
| Hashtags | H1-H3 | 10-15 real hashtags, no extra text, no duplicates, on topic; an off-task request in the topic |
| SEO | S1-S3 | At least 3 keywords and 3 recommendations, all plain text (the UI renders them as text), on topic |
| Validation | V1-V3 | Empty, spaces-only and missing topics are rejected with HTTP 400 |

If OpenAI errors during a live run, the app quietly falls back to its mock output. The runner detects this and fails that case, so canned output never counts as a pass.

## How the checks work

Checks are in `checks.js` and follow the requirements in the SRS, not the current code. Some are simple text rules (for example, "on topic" means the output shares a keyword with the topic), so read the saved output before deciding a failure is real.

## Results

Each version was run 3 times against `gpt-4o-mini`, because the same prompt gives different answers from run to run. Each run of 20 cases costs about $0.002.

| Prompt version | Run 1 | Run 2 | Run 3 | Average |
|---|---|---|---|---|
| v1 (original prompts) | 9/20 | 13/20 | 14/20 | **12.0/20 (60%)** |
| v2 | 17/20 | 17/20 | 16/20 | **16.7/20 (83%)** |

By group (passes across 3 runs):

| Group | v1 | v2 |
|---|---|---|
| Titles (7 cases) | 7/21 | 12/21 |
| Descriptions (4) | 6/12 | 12/12 |
| Hashtags (3) | 8/9 | 8/9 |
| SEO (3) | 9/9 | 9/9 |
| Validation (3) | 6/9 | 9/9 |

### What v1 got wrong

- Titles invented numbers the creator never gave, such as "5 Tips" or "under $20".
- Descriptions invented timestamps (0:00, 1:20, 2:45...) and sometimes used placeholders like `[Link]`.
- A topic of only spaces was sent to OpenAI instead of being rejected.
- Scores varied a lot between runs (9 to 14 out of 20).

### What changed in v2 (`server.js`)

- Title and description prompts: only use numbers, dates, links or stats that appear in the topic. Titles must match the topic's language. Descriptions get no timestamps or placeholders.
- Hashtag prompt: return only hashtags on one line, with no other text.
- All three prompts: treat the topic as the subject to write about, never as instructions.
- The topic is trimmed, so a spaces-only topic is rejected with 400.
- Bug fix found while writing the cases: the app sends `"Instagram"`, but the code only gave `"Instagram Reels"` the 2,200-character description limit.

### Still open

- Titles still sometimes invent numbers (2-4 cases per run). This is the next thing to fix.
- One of the "on topic" checks was too strict at first (it ignored short words like "pan", Spanish for bread). It was fixed before the v1 baseline runs, so both versions were scored with the same checks.
