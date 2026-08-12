import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const source = resolve(root, process.argv[2] ?? "site/art/wisdom/tiles.json");
const config = JSON.parse(await readFile(source, "utf8"));
if (!Number.isInteger(config.tileSize) || !Number.isInteger(config.columns) || !Number.isInteger(config.rows))
  throw new Error("Tileset needs integer tileSize, columns, and rows");
const names = new Set(), glyphs = new Set();
if (!Array.isArray(config.tiles) || !config.tiles.length || config.tiles.length > config.columns * config.rows)
  throw new Error("Tile definitions do not fit in the atlas");
const cells = config.tiles.map((tile, index) => {
  if (!tile.id || names.has(tile.id)) throw new Error(`Missing or duplicate tile id: ${tile.id}`);
  if (glyphs.has(tile.glyph)) throw new Error(`Duplicate tile glyph: ${JSON.stringify(tile.glyph)}`);
  names.add(tile.id); glyphs.add(tile.glyph);
  if (!/^#[\da-f]{6}$/i.test(tile.base)) throw new Error(`${tile.id}: base must be a six-digit hex colour`);
  const x = index % config.columns * config.tileSize;
  const y = Math.floor(index / config.columns) * config.tileSize;
  return `  <g id="tile-${tile.id}" transform="translate(${x} ${y})"><rect width="${config.tileSize}" height="${config.tileSize}" fill="${tile.base}"/>${tile.detail ?? ""}</g>`;
});
const width = config.columns * config.tileSize, height = config.rows * config.tileSize;
const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description"><title id="title">Wisdom world terrain</title><desc id="description">${config.tiles.length} original vector terrain tiles for the Fante Anansi tale.</desc>\n${cells.join("\n")}\n</svg>\n`;
const target = resolve(dirname(source), config.output ?? "tiles.svg");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, svg);
console.log(`Generated ${config.tiles.length} tiles (${width}×${height}) at ${target.slice(root.length + 1)}`);
