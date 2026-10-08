# Art drop-in contract

Each tale's art lives in `site/art/<tale>/`. The world loads the terrain sheet
and puppet part files from there. `npm run art:check`, which also runs in
every production build and in `npm test`, checks their dimensions and
references. Commissioned art can replace any file below without code changes,
as long as it keeps the same names, grid and canvas.

## Terrain tiles

`tiles.json` is the source manifest and `tiles.svg` is the generated sheet:
an 8-column grid of 32 × 32 frames. Each tile has a stable ID and one layout
glyph. Glyphs mean the same thing in every tale (`~` is slow water and `#`
blocks), but each tale draws them in its own palette:

- Wisdom: laterite and forest.
- Tide: lacquer, pearl, kelp and coral.
- Orchestra: an autumn wood, timber and cobbles.
- Olive Jar: mud-brick, lapis tile, carpets and palms.

Regenerate with `node scripts/generate-tileset.mjs site/art/<tale>/tiles.json`.
A commissioned sheet can replace `tiles.svg` if it keeps the frame order and
canvas size.

## Characters

`rigs/<name>.json` defines a canvas, a foot anchor, a parented bone tree,
ordered image parts and named clips (`idle`, `walk`, `carry`, `push`, `fall`).
Each part is a full-canvas transparent SVG, aligned to shared canvas
coordinates. There are two body plans:

- **People:** 64 × 72 canvas. Bones are root, torso, head, two arms and two
  legs. This covers Kweku, Anansi, Urashima, Otohime, the courtyard cadi and
  Ali Cogia.
- **Animals:** 80 × 64 canvas. Bones are root, body, head, tail and four legs
  (two for birds). This covers the donkey, dog, cat and rooster.

`scripts/generate-rigs.mjs` draws the generated cast from a short spec per
character (skin, hair, headwear, garment, colours, held object, or species)
and rewrites `site/art/rigs.js`, the index the world loads. Kweku and Anansi
were drawn by hand and are kept as they are.

To use commissioned art, replace a part SVG with one of the same canvas size
and keep its pivot. A PNG with the same canvas and transparent padding also
works, if the rig JSON points at it. Collision and story position always come
from physics, never from the art.

## Props and people without rigs

Props and minor people are drawn in code in `site/world/art.js`. Each prop is
a `kind` with its origin at the centre of its top-left tile, extending right
and down by its `w` and `h`. To replace one with commissioned art, add an
image case for that kind. Maps and story data don't change.

## Validation

`npm run art:check` verifies, for every tale:

- atlas bounds and complete glyph coverage;
- unique tile IDs;
- that every rig's bone parents exist and contain no cycles;
- that clips reference real bones;
- each part file's canvas dimensions.
