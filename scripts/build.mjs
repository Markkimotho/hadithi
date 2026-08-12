import { mkdir, cp, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { episodes } from "../site/stories.js";
import { validateEpisode } from "../site/game.js";
import { endingWitnesses } from "../site/engine/explore.js";
import { VENDOR, vendorSource } from "./vendor.mjs";
import { layoutsFor, talesWithLayouts } from "../site/world/layouts/index.js";
import { layoutErrors } from "../site/world/layout.js";
import "./art-check.mjs";

// 1. Structural validation: every reference resolves, every rule is fair.
const errors = episodes.flatMap(validateEpisode);
for (const id of talesWithLayouts()) {
  const episode = episodes.find((e) => e.id === id);
  const layouts = layoutsFor(id);
  if (id === "wisdom") for (const scene of Object.keys(episode?.scenes ?? {}))
    if (!layouts[scene]) errors.push(`${id}: missing world layout for ${scene}`);
    else if (layouts[scene].format !== "tiled") errors.push(`${id}/${scene}: Wisdom maps must come from Tiled JSON`);
  for (const [scene, layout] of Object.entries(layouts)) {
    if (!episode?.scenes[scene]) errors.push(`${id}: unknown mapped scene ${scene}`);
    else errors.push(...layoutErrors(layout, episode.scenes[scene], `${id}/${scene}`));
  }
}
// 2. Behavioural proof: a witness path reaches every ending (secrets with echoes).
for (const ep of episodes)
  for (const [id, w] of Object.entries(endingWitnesses(ep, { budget: 100000 })))
    if (!w.path) errors.push(`${ep.id}: no path reaches ending ${id}`);
if (errors.length) throw new Error(`Story validation failed:\n${errors.join("\n")}`);

const site = fileURLToPath(new URL("../site/", import.meta.url));
const dist = fileURLToPath(new URL("../dist/", import.meta.url));
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(site, dist, { recursive: true });
for (const published of Object.keys(VENDOR)) {
  await mkdir(join(dist, published, ".."), { recursive: true });
  await cp(vendorSource(published), join(dist, published));
}

// 3. Version the offline cache by content, and precache every shipped file.
async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(path)));
    else if (!entry.name.startsWith(".")) out.push(path);
  }
  return out.sort();
}
const shipped = (await files(dist)).filter((f) => !f.endsWith("sw.js"));
const hash = createHash("sha256");
for (const f of shipped) hash.update(relative(dist, f)).update(await readFile(f));
const build = hash.digest("hex").slice(0, 12);
const precache = ["./", ...shipped.map((f) => `./${relative(dist, f).split("\\").join("/")}`)];
const sw = (await readFile(join(dist, "sw.js"), "utf8"))
  .replace('const BUILD = "dev";', `const BUILD = ${JSON.stringify(build)};`)
  .replace("const PRECACHE = [];", `const PRECACHE = ${JSON.stringify(precache)};`);
if (!sw.includes(build)) throw new Error("Service worker build marker not found");
await writeFile(join(dist, "sw.js"), sw);

const count = (fn) => episodes.reduce((n, e) => n + fn(e), 0);
console.log(
  `Built Hadithi ${build}: ${episodes.length} tales, ${count((e) => Object.keys(e.scenes).length)} scenes, ${count((e) => e.events.length)} events, ${count((e) => Object.keys(e.endings).length)} endings (${count((e) => Object.values(e.endings).filter((x) => x.secret).length)} secret), ${count((e) => e.deductions.length)} deductions, ${count((e) => Object.values(e.scenes).flatMap((s) => s.actions).filter((a) => a.check).length)} dice checks, ${precache.length} precached files.`,
);
