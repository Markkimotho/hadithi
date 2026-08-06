# services/llm

The only route from Hadithi to a language model. It shells out to the local
Claude Code CLI (`claude -p`). It never calls a hosted API.

## Contract

`judgePair({ tradition, context, a, b, model? })` returns an object shaped by
[`contracts/llm-judge.schema.json`](../../contracts/llm-judge.schema.json):

```json
{ "winner": "a" | "b", "a": {scores}, "b": {scores}, "reason": "...", "costUsd": 0.013, "models": ["claude-opus-5-5"] }
```

`scores` are integers from 1 to 5 for `specific`, `voice`, `rhythm`, and
`human`. The schema goes to the CLI as `--json-schema`, and the reply is checked
again on return. A reply that breaks the contract rejects; nothing is coerced.

`runClaude({ system, prompt, schema, model?, timeoutMs? })` is the lower-level
call that other evals can reuse.

## Settings

| Env | Default | Meaning |
|---|---|---|
| `HADITHI_LLM_MODEL` | `opus` | Model alias passed to `--model`. Defaults to the best available model; it is never silently downgraded. |
| `HADITHI_CLAUDE_BIN` | `claude` | Path to the CLI. Tests point it at `test/fake-claude.mjs`. |

Every call sends `--tools ""`, `--setting-sources ""`, and a short system
prompt. Without them, the default Claude Code system prompt makes one judgement
cost about $0.60 instead of about $0.013, and pulls project instructions into
the task.

## Tests

`node --test services/llm/test/*.test.js` runs against the fake binary. It is
free, deterministic, and part of `npm test`.

## Users

- `evals/prose.mjs`: blind pairwise eval of rewritten tale text against
  `evals/prose-baseline.json`.
