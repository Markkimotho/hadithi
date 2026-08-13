import { parseLayout, parseTiledMap } from "../layout.js";
import courtyard from "../../maps/wisdom/courtyard.json" with { type: "json" };
import market from "../../maps/wisdom/market.json" with { type: "json" };
import well from "../../maps/wisdom/well.json" with { type: "json" };
import trail from "../../maps/wisdom/trail.json" with { type: "json" };
import ridge from "../../maps/wisdom/ridge.json" with { type: "json" };
import river from "../../maps/wisdom/river.json" with { type: "json" };
import ford from "../../maps/wisdom/ford.json" with { type: "json" };
import grove from "../../maps/wisdom/grove.json" with { type: "json" };
import tree from "../../maps/wisdom/tree.json" with { type: "json" };
import knot from "../../maps/wisdom/knot.json" with { type: "json" };
import ledge from "../../maps/wisdom/ledge.json" with { type: "json" };
import pot from "../../maps/wisdom/pot.json" with { type: "json" };
import council from "../../maps/wisdom/council.json" with { type: "json" };
import squall from "../../maps/wisdom/squall.json" with { type: "json" };

const tiledWisdom = { courtyard, market, well, trail, ridge, river, ford, grove, tree, knot, ledge, pot, council, squall };
const raw = {
  wisdom: {
    ...Object.fromEntries(Object.entries(tiledWisdom).map(([id, map]) => [id, parseTiledMap(map, `wisdom/${id}`)])),
  },
};

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

export const talesWithLayouts = () => Object.keys(raw);
