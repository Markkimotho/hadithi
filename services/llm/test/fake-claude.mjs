#!/usr/bin/env node
// Stand-in for the claude CLI in tests. Behaviour comes from FAKE_CLAUDE:
// "ok" (valid judgement), "bad" (breaks the contract), "error" (is_error),
// "crash" (exit 2), "text" (non-JSON stdout), "argv" (returns its argv as the
// structured output so tests can check the flags the service sends).
const mode = process.env.FAKE_CLAUDE || "ok";
const args = process.argv.slice(2);
const scores = { specific: 4, voice: 5, rhythm: 4, human: 5 };
if (mode === "crash") {
  process.stderr.write("boom");
  process.exit(2);
}
if (mode === "text") {
  process.stdout.write("not json");
  process.exit(0);
}
const structured =
  mode === "argv"
    ? { argv: args }
    : mode === "bad" ? { winner: "c", a: scores } : { winner: "b", a: { ...scores, voice: 2 }, b: scores, reason: "B shows the pot." };
process.stdout.write(
  JSON.stringify({
    is_error: mode === "error",
    result: mode === "error" ? "model refused" : JSON.stringify(structured),
    structured_output: mode === "error" ? undefined : structured,
    total_cost_usd: 0.01,
    modelUsage: { "claude-opus-5-5": {} },
  }),
);
