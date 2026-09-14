import { readFile, access, readdir } from "node:fs/promises";
import { resolve, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { TILES } from "../site/world/layout.js";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const errors = [];
const summary = [];
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const dimensions = async (path) => {
  const body = await readFile(path, "utf8");
  const match = body.match(/<svg\b[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/s);
  if (!match) throw new Error(`${relative(root, path)}: missing SVG pixel dimensions`);
  return [Number(match[1]), Number(match[2])];
};
const unique = (values) => new Set(values).size === values.length;

for (const taleDir of (await readdir(join(root, "site/art"), { withFileTypes: true })).filter((d) => d.isDirectory())) {
const art = join(root, "site/art", taleDir.name);
try { await access(join(art, "tiles.json")); } catch { continue; }
const tiles = await json(join(art, "tiles.json"));
if (tiles.version !== 1 || !Number.isInteger(tiles.tileSize) || !Number.isInteger(tiles.columns) || !Number.isInteger(tiles.rows)) errors.push("tiles.json: invalid version or atlas grid");
if (!unique(tiles.tiles.map((tile) => tile.glyph))) errors.push("tiles.json: duplicate glyph");
if (!unique(tiles.tiles.map((tile) => tile.id))) errors.push("tiles.json: duplicate tile id");
if (tiles.tiles.length > tiles.columns * tiles.rows) errors.push("tiles.json: too many frames for atlas");
for (const glyph of Object.keys(TILES)) if (!tiles.tiles.some((tile) => tile.glyph === glyph)) errors.push(`tiles.json: missing world glyph ${JSON.stringify(glyph)}`);
for (const tile of tiles.tiles) if (!/^#[\da-f]{6}$/i.test(tile.base)) errors.push(`${tile.id}: invalid base colour`);
try {
  const [width, height] = await dimensions(join(art, tiles.output));
  if (width !== tiles.columns * tiles.tileSize || height !== tiles.rows * tiles.tileSize) errors.push("tiles SVG dimensions do not match tile grid");
} catch (error) { errors.push(error.message); }

let props = { version: 1, slots: [], columns: 0, rows: 0 };
try { props = await json(join(art, "props.json")); } catch { /* the prop sheet is optional */ }
if (props.sheet) {
if (props.version !== 1 || props.slots.length > props.columns * props.rows) errors.push("props.json: invalid version or slots exceed atlas");
if (!unique(props.slots.map((slot) => slot.id)) || !unique(props.slots.map((slot) => slot.frame))) errors.push("props.json: duplicate slot id or frame");
for (const slot of props.slots) if (!Number.isInteger(slot.frame) || slot.frame < 0 || slot.frame >= props.columns * props.rows) errors.push(`${slot.id}: frame outside props atlas`);
try {
  const [width, height] = await dimensions(join(art, props.sheet));
  if (width !== props.columns * props.frameWidth || height !== props.rows * props.frameHeight) errors.push("props SVG dimensions do not match atlas grid");
} catch (error) { errors.push(error.message); }
}

let rigNames = [];
try { rigNames = (await readdir(join(art, "rigs"))).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)); } catch { /* no rigs */ }
for (const name of rigNames) {
  const path = join(art, "rigs", `${name}.json`);
  try {
    const rig = await json(path);
    const ids = rig.bones.map((bone) => bone.id);
    if (rig.version !== 1 || !rig.canvas?.width || !rig.canvas?.height || !Array.isArray(rig.canvas.anchor)) errors.push(`${name}: invalid canvas/version`);
    if (!unique(ids) || ids.filter((id) => id === "root").length !== 1) errors.push(`${name}: bone ids must be unique with one root`);
    for (const bone of rig.bones) if (bone.parent && !ids.includes(bone.parent)) errors.push(`${name}: ${bone.id} references missing parent ${bone.parent}`);
    for (const bone of rig.bones) {
      const seen = new Set(); let current = bone;
      while (current) {
        if (seen.has(current.id)) { errors.push(`${name}: cyclic bone hierarchy at ${bone.id}`); break; }
        seen.add(current.id); current = rig.bones.find((b) => b.id === current.parent);
      }
    }
    if (!unique(rig.parts.map((part) => part.id))) errors.push(`${name}: duplicate part ids`);
    for (const part of rig.parts) {
      if (!ids.includes(part.bone)) errors.push(`${name}/${part.id}: missing bone ${part.bone}`);
      const target = resolve(dirname(path), part.file);
      if (!target.startsWith(`${resolve(dirname(path))}${sep}`)) errors.push(`${name}/${part.id}: part path escapes rig directory`);
      else {
        try {
          await access(target);
          const [width, height] = await dimensions(target);
          if (width !== rig.canvas.width || height !== rig.canvas.height) errors.push(`${name}/${part.id}: SVG dimensions do not match rig canvas`);
        } catch (error) { errors.push(`${name}/${part.id}: ${error.message}`); }
      }
    }
    for (const [clipName, clip] of Object.entries(rig.clips ?? {})) {
      if (!(clip.duration > 0)) errors.push(`${name}/${clipName}: duration must be positive`);
      for (const [bone, properties] of Object.entries(clip.bones ?? {})) {
        if (!ids.includes(bone)) errors.push(`${name}/${clipName}: unknown bone ${bone}`);
        for (const values of Object.values(properties)) if (!Array.isArray(values) || !values.length || values.some((v) => !Number.isFinite(v))) errors.push(`${name}/${clipName}/${bone}: invalid motion values`);
      }
    }
  } catch (error) { errors.push(`${name}: ${error.message}`); }
}
summary.push(`${taleDir.name}: ${tiles.tiles.length} tiles, ${rigNames.length} rigs`);
}
if (errors.length) throw new Error(`Art validation failed:\n${errors.join("\n")}`);
console.log(`Art assets valid: ${summary.join("; ")}`);
