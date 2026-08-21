# Wisdom maps

`site/maps/wisdom/*.json` are Tiled JSON maps and the source of truth for all 14
Wisdom scenes. Open them in Tiled as orthogonal maps with 32 × 32 tiles. The
embedded `WisdomTerrain` tileset points to `site/art/wisdom/tiles.svg`.

Each map has two layers:

- `ground`: the walkable and blocking tile grid. Embedded tile properties map
  atlas frames back to the runtime glyphs.
- `objects`: objects of type `spawn`, `hotspot`, `exit`, `prop`, `person`, or
  `flow`. A spawn object's name is the scene you arrive from. Hotspots keep
  engine action IDs in their `actions` property. Props and people use
  individual custom properties. Flow objects are rectangles with a two-number
  `force` property in metres per second squared.

Map properties `shares`, `menu`, and `wind` connect scenes, place abstract
actions in the UI, and set the local wind field. Build validation parses every
map, checks story-action coverage, and runs reachability from every spawn.
`scripts/layouts-to-tiled.mjs` is a migration/export utility; edit the maps in
Tiled after this baseline rather than rebuilding them from runtime layouts.
