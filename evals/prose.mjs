// Prose eval: does the rewritten text beat the second-edition text?
//
//   node evals/prose.mjs --snapshot   record today's text as the baseline
//   node evals/prose.mjs              judge every rewritten tale (voice >= 3)
//   node evals/prose.mjs wisdom       one tale
//
// Each passage is judged twice by the local Claude Code (services/llm), once
// in each order, to cancel position bias. The new text wins a passage only
// when it wins both orders. Paid and slow: runs before ship and nightly, never
// in the commit gate.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { episodes } from "../site/stories.js";
import { judgePair } from "../services/llm/judge.mjs";

const BASELINE = new URL("./prose-baseline.json", import.meta.url);
const OUT = new URL("../artifacts/eval/", import.meta.url);
const THRESHOLDS = { minWinRate: 0.8, minMedianScore: 4 };

/** The passages that carry a tale's voice: opening, scenes, endings. */
export function passages(ep) {
  const flat = (s) => String(s ?? "").replace(/\n/g, " ");
  return {
    opening: flat(ep.opening),
    ...Object.fromEntries(Object.entries(ep.scenes).map(([id, s]) => [`scene:${id}`, flat(s.description ?? s.text)])),
    ...Object.fromEntries(Object.entries(ep.endings).map(([id, e]) => [`ending:${id}`, flat(e.text)])),
  };
}

if (process.argv.includes("--snapshot")) {
  const snap = Object.fromEntries(episodes.map((ep) => [ep.id, passages(ep)]));
  writeFileSync(BASELINE, `${JSON.stringify(snap, null, 2)}\n`);
  console.log(`Baseline written: ${Object.values(snap).reduce((n, p) => n + Object.keys(p).length, 0)} passages.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const only = process.argv[2];
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : 0;
};
const mean = (o) => (o.specific + o.voice + o.rhythm + o.human) / 4;

const report = [];
let cost = 0;
let failed = false;
for (const ep of episodes.filter((e) => !only || e.id === only)) {
  if (!(ep.voice >= 3)) {
    report.push({ tale: ep.id, skipped: "not rewritten yet (voice < 3)" });
    continue;
  }
  const now = passages(ep);
  const rows = [];
  for (const [key, text] of Object.entries(now)) {
    const old = baseline[ep.id]?.[key];
    if (!old || old === text) continue;
    const context = key.replace(":", " ");
    const first = await judgePair({ tradition: ep.tradition, context, a: old, b: text });
    const second = await judgePair({ tradition: ep.tradition, context, a: text, b: old });
    cost += first.costUsd + second.costUsd;
    const win = first.winner === "b" && second.winner === "a";
    const loss = first.winner === "a" && second.winner === "b";
    rows.push({ key, result: win ? "win" : loss ? "loss" : "split", score: (mean(first.b) + mean(second.a)) / 2, reason: second.reason });
    process.stdout.write(win ? "W" : loss ? "L" : "s");
  }
  process.stdout.write("\n");
  const winRate = rows.filter((r) => r.result === "win").length / (rows.length || 1);
  const med = median(rows.map((r) => r.score));
  const pass = rows.length > 0 && winRate >= THRESHOLDS.minWinRate && med >= THRESHOLDS.minMedianScore;
  failed ||= !pass;
  report.push({ tale: ep.id, judged: rows.length, winRate, medianScore: med, pass, rows });
}

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL("prose-report.json", OUT), JSON.stringify({ thresholds: THRESHOLDS, cost, report }, null, 2));
const md = [
  "# Prose eval",
  "",
  `Thresholds: new text wins at least ${THRESHOLDS.minWinRate * 100}% of passages (both orders), median score at least ${THRESHOLDS.minMedianScore}/5. Cost $${cost.toFixed(2)}.`,
  "",
  "| Tale | Passages | Win rate | Median score | Result |",
  "|---|---|---|---|---|",
  ...report.map((r) =>
    r.skipped ? `| ${r.tale} | - | - | - | ${r.skipped} |` : `| ${r.tale} | ${r.judged} | ${(r.winRate * 100).toFixed(0)}% | ${r.medianScore.toFixed(2)} | ${r.pass ? "PASS" : "FAIL"} |`,
  ),
  "",
  ...report.flatMap((r) => (r.rows ?? []).filter((x) => x.result !== "win").map((x) => `- ${r.tale} ${x.key}: ${x.result}. ${x.reason}`)),
].join("\n");
writeFileSync(new URL("prose-report.md", OUT), `${md}\n`);
console.log(md);
process.exitCode = failed ? 1 : 0;
