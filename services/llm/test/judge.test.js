import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runClaude } from "../claude.mjs";
import { judgePair, checkJudgement, SCHEMA } from "../judge.mjs";

const fake = fileURLToPath(new URL("./fake-claude.mjs", import.meta.url));
chmodSync(fake, 0o755);
process.env.HADITHI_CLAUDE_BIN = fake;
const pair = { tradition: "Fante", context: "scene text", a: "The fire is cold.", b: "Cold ash." };

test("judgePair returns a contract-shaped judgement and its cost", async () => {
  process.env.FAKE_CLAUDE = "ok";
  const j = await judgePair(pair);
  assert.equal(j.winner, "b");
  assert.equal(j.b.voice, 5);
  assert.equal(j.costUsd, 0.01);
  assert.deepEqual(checkJudgement(j), []);
});

test("the service sends a bare system prompt, no tools, no settings, and the schema", async () => {
  process.env.FAKE_CLAUDE = "argv";
  const schema = { type: "object" };
  const { output } = await runClaude({ system: "S", prompt: "P", schema, model: "opus" });
  const flag = (name) => output.argv[output.argv.indexOf(name) + 1];
  assert.ok(output.argv.includes("-p"));
  assert.equal(flag("--model"), "opus");
  assert.equal(flag("--tools"), "");
  assert.equal(flag("--setting-sources"), "");
  assert.equal(flag("--system-prompt"), "S");
  assert.equal(flag("--json-schema"), JSON.stringify(schema));
  assert.equal(output.argv.at(-1), "P");
});

test("contract violations, model errors, crashes and junk all reject", async () => {
  for (const [mode, pattern] of [
    ["bad", /broke the contract/],
    ["error", /claude error/],
    ["crash", /exited 2/],
    ["text", /non-JSON/],
  ]) {
    process.env.FAKE_CLAUDE = mode;
    await assert.rejects(judgePair(pair), pattern, mode);
  }
});

test("a missing binary rejects with a clear message", async () => {
  process.env.HADITHI_CLAUDE_BIN = "/nonexistent/claude";
  await assert.rejects(judgePair(pair), /could not start claude/);
  process.env.HADITHI_CLAUDE_BIN = fake;
});

test("the contract schema and validator agree on the score keys", () => {
  assert.deepEqual(SCHEMA.required, ["winner", "a", "b", "reason"]);
  assert.match(checkJudgement({ winner: "a", a: {}, b: {}, reason: "" }).join(), /a.specific/);
});
