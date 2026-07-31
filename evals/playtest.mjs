#!/usr/bin/env node
// Periodic playtest eval. Measures whether each tale is finishable, fair,
// varied, and free of dead content, then compares against thresholds.json.
// Deterministic: every agent run is seeded. Writes artifacts/eval/.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { episodes } from "../site/stories.js";
import { validateEpisode } from "../site/game.js";
import { explore, endingWitnesses, search, deadContent } from "../site/engine/explore.js";
import { playthrough } from "../site/engine/simulate.js";
import { walkthroughs, play } from "../test/walkthroughs.js";

const T = JSON.parse(await readFile(new URL("./thresholds.json", import.meta.url), "utf8"));
const only = process.argv[2];
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : null;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x) => `${(100 * x).toFixed(1)}%`;

const report = { generatedAt: new Date().toISOString(), thresholds: T, episodes: [] };
let failures = 0;

for (const ep of episodes.filter((e) => !only || e.id === only)) {
  const started = Date.now();
  const fail = [];
  const check = (ok, text) => {
    if (!ok) fail.push(text);
  };
  check(validateEpisode(ep).length === 0, `validation: ${validateEpisode(ep).join("; ")}`);

  const witnesses = endingWitnesses(ep);
  for (const [id, w] of Object.entries(witnesses)) check(Boolean(w.path), `ending ${id} has no witness path`);

  const allEchoes = Object.keys(ep.echoes ?? {});
  const bfs = [explore(ep, { maxStates: T.bfsStates }), explore(ep, { echoes: allEchoes, maxStates: T.bfsStates })];
  for (const r of bfs) {
    check(r.deadEndCount === 0, `bounded BFS found ${r.deadEndCount} dead ends: ${JSON.stringify(r.deadEnds[0])}`);
    check(r.errorCount === 0, `bounded BFS engine errors: ${JSON.stringify(r.errors[0])}`);
    check(r.truncated || r.trapCount === 0, `exhaustive BFS found ${r.trapCount} traps`);
  }

  const runs = [];
  for (const echoes of [[], allEchoes])
    for (const policy of ["random", "curious", "hasty"])
      for (let i = 0; i < T.runsPerMode; i++)
        runs.push(
          playthrough(ep, {
            seed: 1000 + i,
            policy,
            echoes,
            trapEvery: i < T.trapCheckedRuns ? T.trapEvery : 0,
            trapBudget: T.trapBudget,
          }),
        );
  const plain = runs.filter((r) => !r.echoes.length);
  const deadEnds = runs.filter((r) => r.deadEnd);
  const traps = runs.flatMap((r) => r.traps);
  check(deadEnds.length === 0, `${deadEnds.length} agent runs hit a dead end (first: ${deadEnds[0]?.deadEnd})`);
  check(traps.length === 0, `${traps.length} sampled states could not reach any ending: ${JSON.stringify(traps[0])}`);

  const byPolicy = {};
  for (const policy of ["random", "curious", "hasty"]) {
    const rs = plain.filter((r) => r.policy === policy);
    const done = rs.filter((r) => r.ending);
    const endings = {};
    for (const r of done) endings[r.ending] = (endings[r.ending] ?? 0) + 1;
    byPolicy[policy] = {
      runs: rs.length,
      stalled: 1 - done.length / rs.length,
      medianTurns: median(done.map((r) => r.turns)),
      endings,
    };
    if (policy !== "random")
      check(byPolicy[policy].stalled <= T.maxStalledRate, `${policy} agents stalled in ${pct(byPolicy[policy].stalled)} of runs`);
  }
  const [lo, hi] = T.curiousMedianTurns;
  const mt = byPolicy.curious.medianTurns;
  check(mt >= lo && mt <= hi, `curious median run length ${mt} turns outside ${lo}–${hi}`);

  const endingRate = {};
  for (const id of Object.keys(ep.endings))
    endingRate[id] = plain.filter((r) => r.ending === id).length / plain.length;
  for (const [id, e] of Object.entries(ep.endings))
    if (!e.secret) check(endingRate[id] >= T.minEndingRate, `ending ${id} reached in only ${pct(endingRate[id])} of agent runs`);
  const secretRate = Object.fromEntries(
    Object.entries(ep.endings)
      .filter(([, e]) => e.secret)
      .map(([id]) => {
        const rs = runs.filter((r) => r.echoes.length);
        return [id, rs.filter((r) => r.ending === id).length / rs.length];
      }),
  );

  const passed = runs.reduce((n, r) => n + r.checksPassed, 0);
  const failed = runs.reduce((n, r) => n + r.checksFailed, 0);
  const passRate = passed / Math.max(1, passed + failed);
  check(passRate >= T.checkPassRate[0] && passRate <= T.checkPassRate[1], `dice pass rate ${pct(passRate)} outside ${T.checkPassRate.map(pct).join("–")}`);
  const breadth = mean(runs.flatMap((r) => r.breadth));
  check(breadth >= T.minBreadth, `mean choices per turn ${breadth.toFixed(2)} below ${T.minBreadth}`);
  // A route is the set of places seen plus the ending: materially different
  // replays, not merely different orderings of ambient events.
  const routes = new Set(plain.filter((r) => r.ending).map((r) => `${r.ending}|${[...r.visited].sort().join(",")}`)).size;
  const sequences = new Set(plain.map((r) => r.signature)).size;
  const diversity = routes;
  check(routes >= T.minDistinctRoutes, `only ${routes} distinct routes (places + ending) across agent runs`);
  check(sequences >= T.minEventSequences, `only ${sequences} distinct world-event sequences`);

  // Dead content: everything must be touched by BFS, an agent, or a witness.
  const witnessStates = Object.values(witnesses).map((w) =>
    search(ep, { echoes: w.echoes, ending: Object.keys(witnesses).find((k) => witnesses[k] === w), budget: 200000 }).state,
  );
  const coverage = {
    actions: new Set(runs.flatMap((r) => r.usedActions)),
    events: new Set(runs.flatMap((r) => r.fired)),
    scenes: new Set(runs.flatMap((r) => r.visited)),
    clues: new Set(runs.flatMap((r) => r.clues)),
    deductions: new Set(runs.flatMap((r) => r.deductionIds)),
    items: new Set(runs.flatMap((r) => r.taken)),
    echoes: new Set(runs.flatMap((r) => r.earnedEchoes)),
    marks: new Set(runs.flatMap((r) => r.marks)),
    endings: new Map(),
  };
  // Authored walkthroughs replay with real dice and count as proofs too.
  const authored = walkthroughs.filter((w) => w.episode === ep.id).map((w) => {
    const g = play(w);
    check(g.state.ending === w.expect.ending, `walkthrough "${w.name}" ended in ${g.state.ending}`);
    for (const m of w.expect.marks ?? []) check(g.state.marks.includes(m), `walkthrough "${w.name}" missed mark ${m}`);
    return g.state;
  });
  for (const s of [...witnessStates.filter(Boolean), ...authored]) {
    s.fired.forEach((x) => coverage.events.add(x));
    s.visited.forEach((x) => coverage.scenes.add(x));
    s.clues.forEach((x) => coverage.clues.add(x));
    s.deductions.forEach((x) => coverage.deductions.add(x));
    s.taken.forEach((x) => coverage.items.add(x));
    s.earnedEchoes.forEach((x) => coverage.echoes.add(x));
    s.marks.forEach((x) => coverage.marks.add(x));
  }
  for (const w of Object.values(witnesses))
    (w.path ?? []).forEach((label) => coverage.actions.add(label.replace(/\+(pass|fail|solve)$/, "")));
  // Marks no agent happened to earn get a targeted search for a witness.
  for (const m of ep.marks ?? [])
    if (!coverage.marks.has(m.id)) {
      const found = search(ep, {
        echoes: allEchoes,
        need: m.when,
        goal: (s) => Boolean(s.ending) && s.marks.includes(m.id),
        budget: 100000,
      });
      if (found.path) coverage.marks.add(m.id);
    }
  for (const id of Object.keys(ep.endings)) coverage.endings.set(id, 0);
  const dead = deadContent(ep, [...bfs, { coverage, endings: Object.fromEntries([...coverage.endings]) }]);
  check(dead.length === 0, `dead content: ${dead.join("; ")}`);

  const summary = {
    id: ep.id,
    ms: Date.now() - started,
    witnesses: Object.fromEntries(Object.entries(witnesses).map(([k, w]) => [k, w.path?.length ?? null])),
    bfsStates: bfs.map((r) => r.states),
    agentRuns: runs.length,
    trapChecks: T.trapCheckedRuns * 6,
    byPolicy,
    endingRate,
    secretRate,
    passRate,
    breadth,
    diversity,
    remembered: runs.filter((r) => r.echoes.length).length,
    failures: fail,
  };
  report.episodes.push(summary);
  failures += fail.length;
  console.log(`\n${ep.id}  (${summary.ms} ms, ${runs.length} agent runs)`);
  console.log(`  witnesses   ${Object.entries(summary.witnesses).map(([k, v]) => `${k}:${v ?? "NONE"}`).join("  ")}`);
  console.log(`  endings     ${Object.entries(endingRate).map(([k, v]) => `${k} ${pct(v)}`).join("  ")}${Object.keys(secretRate).length ? `  | secret w/ echoes ${Object.entries(secretRate).map(([k, v]) => `${k} ${pct(v)}`).join(" ")}` : ""}`);
  console.log(`  dice        pass ${pct(passRate)}   choices/turn ${breadth.toFixed(2)}   routes ${routes}   event sequences ${sequences}   curious median ${mt} turns`);
  console.log(`  safety      dead ends ${deadEnds.length}   traps ${traps.length}   dead content ${dead.length}`);
  for (const f of fail) console.log(`  ✗ ${f}`);
  if (!fail.length) console.log("  ✓ all thresholds met");
}

await mkdir(new URL("../artifacts/eval/", import.meta.url), { recursive: true });
await writeFile(new URL("../artifacts/eval/playtest-report.json", import.meta.url), JSON.stringify(report, null, 2));
const md = [
  `# Hadithi playtest eval — ${report.generatedAt}`,
  "",
  "| Tale | Witnesses | Dice pass | Choices/turn | Distinct routes | Curious median turns | Dead ends | Traps | Result |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...report.episodes.map(
    (e) =>
      `| ${e.id} | ${Object.values(e.witnesses).every(Boolean) ? "all" : "missing"} | ${pct(e.passRate)} | ${e.breadth.toFixed(2)} | ${e.diversity} | ${e.byPolicy.curious.medianTurns} | 0 | 0 | ${e.failures.length ? `✗ ${e.failures.length}` : "✓"} |`,
  ),
  "",
  ...report.episodes.flatMap((e) => (e.failures.length ? [`## ${e.id}`, ...e.failures.map((f) => `- ${f}`), ""] : [])),
].join("\n");
await writeFile(new URL("../artifacts/eval/playtest-report.md", import.meta.url), md);
console.log(`\nReport: artifacts/eval/playtest-report.md · ${failures ? `${failures} threshold failures` : "PASS"}`);
process.exit(failures ? 1 : 0);
