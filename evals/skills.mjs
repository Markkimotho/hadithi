// Skills eval: is each physical trial a fair stand-in for the dice?
//
//   node evals/skills.mjs
//
// For every timed trial kind, at every odds the tales actually use, simulated
// players of three skill levels play 2,000 trials each through the same rules
// the world runs (site/world/trials/core.js). Thresholds:
//   - an average player passes within ±0.08 of the dice odds;
//   - an expert passes at least 0.85 whenever the odds are 0.4 or better;
//   - a novice with Storyteller's grace passes at least 0.25 whenever the
//     un-graced odds are 0.4 or better.
// Writes artifacts/eval/skills-report.md and .json.
import { writeFileSync, mkdirSync } from "node:fs";
import { episodes } from "../site/stories.js";
import { Game } from "../site/game.js";
import { checkOdds } from "../site/engine/rng.js";
import { paramsFor, simulatePlayer, SHAPES } from "../site/world/trials/core.js";
import { ASSIST_BONUS } from "../site/engine/game.js";

const RUNS = 2000;
const OUT = new URL("../artifacts/eval/", import.meta.url);

// Every timed check in every tale, at the odds a fresh player would face it.
const checks = [];
for (const ep of episodes)
  for (const [sceneId, scene] of Object.entries(ep.scenes))
    for (const a of scene.actions)
      if (a.check?.skill && SHAPES[a.check.skill.kind]) {
        const g = new Game(ep);
        g.state.scene = sceneId;
        const profile = g.checkProfile(a);
        checks.push({ tale: ep.id, id: `${sceneId}/${a.id}`, kind: a.check.skill.kind, bonus: profile.bonus, dc: profile.dc });
      }
// Plus a grid, so kinds not yet used by any tale are still calibrated.
for (const kind of Object.keys(SHAPES)) for (const chance of [0.2, 0.4, 0.6, 0.8]) checks.push({ tale: "grid", id: `${kind}@${chance}`, kind, chance });

const rate = (params, kind, id, skill) => {
  let pass = 0;
  for (let s = 0; s < RUNS; s++) pass += simulatePlayer(params, `${kind}:${id}:${s}`, skill).pass;
  return pass / RUNS;
};

const rows = [];
let failed = 0;
for (const c of checks) {
  const chance = c.chance ?? checkOdds(c.bonus, c.dc);
  // Grace is +2 on the dice. For grid rows, find the bonus that gives these
  // odds against a typical difficulty (8), then add the same +2.
  const gridBonus = () => [...Array(17).keys()].map((i) => i - 6).sort((x, y) => Math.abs(checkOdds(x, 8) - chance) - Math.abs(checkOdds(y, 8) - chance))[0];
  const graced = c.chance != null ? checkOdds(gridBonus() + ASSIST_BONUS, 8) : checkOdds(c.bonus + ASSIST_BONUS, c.dc);
  const avg = rate(paramsFor(c.kind, { chance }), c.kind, c.id, "average");
  const expert = rate(paramsFor(c.kind, { chance }), c.kind, c.id, "expert");
  const novice = rate(paramsFor(c.kind, { chance: graced }), c.kind, c.id, "novice");
  const problems = [];
  if (Math.abs(avg - chance) > 0.08) problems.push(`average ${avg.toFixed(2)} vs odds ${chance.toFixed(2)}`);
  if (chance >= 0.4 && expert < 0.85) problems.push(`expert only ${expert.toFixed(2)}`);
  if (chance >= 0.4 && novice < 0.25) problems.push(`graced novice only ${novice.toFixed(2)}`);
  if (problems.length) failed++;
  rows.push({ ...c, chance, avg, expert, novice, problems });
}

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL("skills-report.json", OUT), JSON.stringify({ runs: RUNS, rows }, null, 2));
const md = [
  "# Skills eval",
  "",
  `${RUNS} simulated trials per player per row. Average must land within ±0.08 of the odds; experts ≥ 0.85 and graced novices ≥ 0.25 when the odds are 0.4 or better.`,
  "",
  "| Trial | Kind | Odds | Average | Expert | Graced novice | Result |",
  "|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.tale} ${r.id} | ${r.kind} | ${r.chance.toFixed(2)} | ${r.avg.toFixed(2)} | ${r.expert.toFixed(2)} | ${r.novice.toFixed(2)} | ${r.problems.length ? `FAIL: ${r.problems.join("; ")}` : "PASS"} |`),
].join("\n");
writeFileSync(new URL("skills-report.md", OUT), `${md}\n`);
console.log(md);
console.log(`\n${failed ? `${failed} rows FAIL` : "All trials fair"} · artifacts/eval/skills-report.md`);
process.exitCode = failed ? 1 : 0;
