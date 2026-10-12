#!/usr/bin/env node
// The art contract, checked. Two kinds of art ship:
//
// 1. Tiled authoring tilesets (site/art/<tale>/tiles.json + tiles.svg): the
//    palette the map editor paints ground with. Every ground glyph must have
//    a tile, and every map must name only glyphs the world knows.
// 2. The first-person world's art, painted in code (site/world/ray/): every
//    wall, floor, person, animal and thing any map uses must have a painter,
//    paint something visible, and come out at the size the renderer expects.
//    Every hero has hands. Nothing falls back to the placeholder cairn.
//
// Exits non-zero with every problem listed. Imported by the build, run by
// test/art.test.js.
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TILES } from "../site/world/layout.js";
import { layoutsFor } from "../site/world/layouts/index.js";
import { worldArtFor, buildLevel } from "../site/world/ray/scene.js";
import { WALL, WALL_TALL, FLOOR } from "../site/world/ray/textures.js";
import { coverage } from "../site/world/ray/paint.js";
import { handFor, portraitOf } from "../site/world/ray/sprites.js";
import { TALE_WORLD } from "../site/world/tales.js";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const errors = [];
const summary = [];
const unique = (values) => new Set(values).size === values.length;

for (const dir of (await readdir(join(root, "site/art"), { withFileTypes: true })).filter((d) => d.isDirectory())) {
  const tale = dir.name;
  const where = (text) => errors.push(`${tale}: ${text}`);
  // ── Tiled tileset ──
  const tiles = JSON.parse(await readFile(join(root, "site/art", tale, "tiles.json"), "utf8"));
  if (tiles.version !== 1 || !Number.isInteger(tiles.tileSize)) where("tiles.json: invalid version or tile size");
  if (!unique(tiles.tiles.map((t) => t.glyph))) where("tiles.json: duplicate glyph");
  for (const glyph of Object.keys(TILES)) if (!tiles.tiles.some((t) => t.glyph === glyph)) where(`tiles.json: missing ground glyph ${JSON.stringify(glyph)}`);
  const svg = await readFile(join(root, "site/art", tale, tiles.output), "utf8");
  const size = svg.match(/<svg\b[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/s);
  if (!size || Number(size[1]) !== tiles.columns * tiles.tileSize || Number(size[2]) !== tiles.rows * tiles.tileSize) where("tiles.svg: size does not match its grid");

  // ── Painted world art ──
  const layouts = Object.values(layoutsFor(tale));
  const world = TALE_WORLD[tale];
  const art = worldArtFor(tale, layouts, (world?.followers ?? []).map((f) => f.kind));
  for (const [key, t] of art.walls) {
    if (!t) where(`wall ${key}: no painter`);
    else if (t.w !== WALL || t.h !== WALL_TALL) where(`wall ${key}: ${t.w}x${t.h}, expected ${WALL}x${WALL_TALL}`);
    else if (coverage(t) < 0.99) where(`wall ${key}: walls must be opaque`);
  }
  for (const [key, t] of art.floors) {
    if (!t) where(`floor ${key}: no painter`);
    else if (t.w !== FLOOR || t.h !== FLOOR) where(`floor ${key}: ${t.w}x${t.h}, expected ${FLOOR}x${FLOOR}`);
  }
  for (const [key, s] of art.sprites) {
    if (!s.known) where(`sprite ${key}: no painter (it would stand as a cairn)`);
    if (coverage(s.tex) < 0.01) where(`sprite ${key}: paints nothing`);
    if (!(s.h > 0.05 && s.h < 6 && s.w > 0.05 && s.w < 6)) where(`sprite ${key}: implausible size ${s.w.toFixed(2)}x${s.h.toFixed(2)} m`);
    if (s.frames && (s.frames.length !== 4 || s.frames.some((f) => f.w !== s.tex.w || f.h !== s.tex.h))) where(`sprite ${key}: walk frames must be four of one size`);
    if (s.person && coverage(portraitOf(s)) < 0.15) where(`sprite ${key}: portrait crop misses the face`);
  }
  if (world && coverage(handFor(tale, world.hero)) < 0.1) where(`hands for ${world.hero} paint nothing`);
  if (world && !art.sprites.size) where("no sprites");
  // Every cell of every level has a floor texture. (A level may have no
  // walls: open water runs on into the fog.)
  for (const layout of layouts) {
    const level = buildLevel(layout);
    if (level.floors.some((f) => !art.floors.get(f))) where("a level has a floor with no texture");
  }
  summary.push(`${tale}: ${tiles.tiles.length} tiles, ${art.walls.size} walls, ${art.floors.size} floors, ${art.sprites.size} sprites`);
}
if (errors.length) {
  console.error(`Art check failed:\n${errors.join("\n")}`);
  process.exit(1);
}
console.log(`Art valid. ${summary.join("; ")}`);
