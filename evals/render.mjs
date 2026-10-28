#!/usr/bin/env node
// Periodic eval for the first-person renderer. For every scene of every tale,
// from every spawn, render the arrival view at the game's default frame size
// in Node and measure:
//
//   ms        time per frame (median of 5). The browser budget is 16 ms at
//             60 fps; Node has no GPU help either, so this is a fair proxy.
//   open      share of the screen that is not a wall closer than 2 m. An
//             arrival that opens on a wall in your face fails.
//   detail    distinct colours in the frame. A frame that is all fog or all
//             one texture fails.
//
// Thresholds below. Writes artifacts/eval/render-report.md and exits non-zero
// on any failure.
import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { layoutsFor } from "../site/world/layouts/index.js";
import { episodeById } from "../site/stories.js";
import { buildLevel, worldArtFor } from "../site/world/ray/scene.js";
import { createTarget, prepareLevel, renderFrame } from "../site/world/ray/render.js";
import { camera } from "../site/world/ray/cast.js";
import { lightModel } from "../site/world/lightmodel.js";
import { sceneThings, sceneLights, facingFrom } from "../site/world/ray/things.js";
import { eyeOf } from "../site/world/tales.js";

const W = 576,
  H = 360;
const MAX_MS = 16;
const MIN_OPEN = 0.5;
const MIN_DETAIL = 400;

const rows = [];
let failures = 0;
for (const tale of ["wisdom", "tide", "orchestra", "olives"]) {
  const ep = episodeById(tale);
  const layouts = layoutsFor(tale);
  const art = worldArtFor(tale, Object.values(layouts));
  for (const [id, layout] of Object.entries(layouts)) {
    const level = buildLevel(layout);
    const prepared = prepareLevel(level, art);
    const scene = ep.scenes[id];
    // The scene's own light, else the tale's default (rules may change it in play).
    const light = lightModel({ light: scene?.light ?? ep.ambient?.light ?? "day", weather: scene?.weather ?? ep.ambient?.weather ?? "none" });
    const things = sceneThings(level, layout, art);
    const lamps = sceneLights(level, layout, light);
    for (const [from, [sx, sy]] of Object.entries(layout.spawn)) {
      const cam = camera(sx + 0.5, sy + 0.5, facingFrom(layout, [sx, sy]), W / H);
      const target = createTarget(W, H);
      const times = [];
      let stats;
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        stats = renderFrame(target, prepared, cam, { light, time: i * 0.1, eye: eyeOf(tale), things, lights: lamps });
        times.push(performance.now() - t0);
      }
      const ms = times.sort((a, b) => a - b)[2];
      let close = 0;
      for (let x = 0; x < W; x++) if (target.columns.dist[x] < 2) close++;
      const open = 1 - close / W;
      const detail = new Set(target.data).size;
      const pass = ms <= MAX_MS && open >= MIN_OPEN && detail >= MIN_DETAIL;
      if (!pass) failures++;
      rows.push({ tale, id, from, ms, open, detail, things: stats.things, pass });
    }
  }
}

const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
const worst = rows.reduce((a, b) => (b.ms > a.ms ? b : a));
const report = [
  "# Renderer eval",
  "",
  `${rows.length} arrival views across 4 tales, ${W}x${H}. Thresholds: ≤ ${MAX_MS} ms, ≥ ${MIN_OPEN * 100}% open, ≥ ${MIN_DETAIL} colours.`,
  "",
  `Mean ${mean("ms").toFixed(2)} ms · slowest ${worst.ms.toFixed(2)} ms (${worst.tale}/${worst.id}) · mean open ${(mean("open") * 100).toFixed(0)}% · ${failures} failing`,
  "",
  "| Scene | From | ms | Open | Colours | Things | Result |",
  "| --- | --- | ---: | ---: | ---: | ---: | --- |",
  ...rows.map((r) => `| ${r.tale}/${r.id} | ${r.from} | ${r.ms.toFixed(2)} | ${(r.open * 100).toFixed(0)}% | ${r.detail} | ${r.things} | ${r.pass ? "PASS" : "FAIL"} |`),
  "",
].join("\n");
mkdirSync("artifacts/eval", { recursive: true });
writeFileSync("artifacts/eval/render-report.md", report);
console.log(report.split("\n").slice(0, 6).join("\n"));
for (const r of rows.filter((r) => !r.pass)) console.log(`FAIL ${r.tale}/${r.id} from ${r.from}: ${r.ms.toFixed(1)} ms, ${(r.open * 100).toFixed(0)}% open, ${r.detail} colours`);
console.log("artifacts/eval/render-report.md");
if (failures) process.exit(1);
