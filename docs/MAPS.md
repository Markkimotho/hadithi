# World maps

Every scene of every tale has a walkable map in `site/maps/<tale>/<scene>.json`.
These are Tiled JSON maps and the source of truth: open them in Tiled as
orthogonal maps with 32 × 32 tiles. Each map embeds its tale's terrain tileset,
which points to `site/art/<tale>/tiles.svg`. `site/maps/<tale>/index.js` lists
the maps for the world to load. It is generated, so don't edit it by hand.

## Layers

- `ground`: the tile grid. Tile properties map atlas frames back to the
  runtime glyphs in `site/world/layout.js` (`.` earth, `,` grass, `~` slow
  water, `w` deep water, `#` wall, `T` tree, and so on). The glyph decides
  walking, blocking, footstep sound and slowness. The tale's tileset decides
  the look.
- `objects`: objects of these types:
  - `spawn`: where you arrive. The name is the scene you come from; `start`
    is the fallback.
  - `hotspot`: a place to act. The property `actions` lists engine action IDs
    and `label` names the place ("The potter"). A hotspot with several actions
    is a conversation; walking up and pressing E offers them as lines.
  - `exit`: tiles that leave the scene by a plain TRAVEL action when you
    step on them.
  - `prop`: scenery and loose things. `kind` picks the drawing. `w`, `h` and
    `block` give the footprint. `physics: "crate" | "jar"` makes it a Planck
    body you can push, lift or throw. `item: "<id>"` hides it once the story
    puts that item in your bag.
  - `person`: people and animals. A `kind` that has a rig in the tale is
    drawn as an animated puppet. `wander` lets them amble, `perch` raises them
    (Anansi up the trunk, a cat on a wall), and `when: "<flag>"` shows them
    only once the story has brought them.
  - `flow`: a rectangle with a `force` in metres per second squared: a river
    current, a tide, a reversing surge.

## Map properties

- `shares`: this scene uses another scene's ground. The well is part of the
  market, and the Olive Jar's trial, dealers and corner all happen in one
  moonlit courtyard. Moving between scenes that share ground keeps you
  where you stand.
- `menu`: actions offered in the story band instead of at a place.
- `wind`: a constant wind field, as in the Wisdom squall.

## Checks

`npm test` and every build parse every map and check it against its scene:

- every engine action has exactly one place (hotspot, exit or menu);
- every hotspot and exit names a real action;
- exits are plain travel actions;
- every hotspot and exit can be reached on foot from every spawn;
- there is a spawn for every way into the scene.

## Authoring

Edit maps in Tiled. For a new tale it is faster to sketch the ground in
ASCII and export it once with `node scripts/layouts-to-tiled.mjs <tale>
<source.mjs> [scene ...]`. After that, the JSON is the source of truth.

## Companions

`site/world/tales.js` names each tale's hero and any followers. In The
Midnight Orchestra the dog, cat and rooster trail the donkey from scene to
scene once their story flag is set, and their standing figures leave the
scene where they joined.
