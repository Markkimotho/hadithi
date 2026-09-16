import { parseLayout, parseTiledMap } from "../layout.js";
import wisdomMaps from "../../maps/wisdom/index.js";
import tideMaps from "../../maps/tide/index.js";
import orchestraMaps from "../../maps/orchestra/index.js";
import olivesMaps from "../../maps/olives/index.js";

const tiled = { wisdom: wisdomMaps, tide: tideMaps, orchestra: orchestraMaps, olives: olivesMaps };
const raw = Object.fromEntries(
  Object.entries(tiled).map(([tale, maps]) => [tale, Object.fromEntries(Object.entries(maps).map(([id, map]) => [id, parseTiledMap(map, `${tale}/${id}`)]))]),
);

/**
 * Parsed layouts keyed by scene id. Shared-ground scenes inherit terrain,
 * props, people and spawns while retaining their own interactions.
 */
export function layoutsFor(taleId) {
  const tale = raw[taleId] ?? {};
  const out = {};
  for (const [sceneId, layout] of Object.entries(tale)) {
    const base = layout.shares ? tale[layout.shares] : null;
    if (layout.shares && !base) throw new Error(`${taleId}/${sceneId}: shares unknown scene ${layout.shares}`);
    const merged = base
      ? { ...layout, ground: base.ground, grid: base.grid, width: base.width, height: base.height,
          props: base.props, people: base.people, spawn: { ...base.spawn, ...layout.spawn } }
      : layout;
    out[sceneId] = merged.format === "tiled" ? merged : parseLayout(merged, `${taleId}/${sceneId}`);
  }
  return out;
}

export const talesWithLayouts = () => Object.keys(raw).filter((tale) => Object.keys(raw[tale]).length);
