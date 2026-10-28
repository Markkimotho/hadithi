# Art contract

The world's art is painted in code when a tale opens. Nothing in the world is
a committed image. The same seed paints the same pixels on every machine, and
`npm run art:check` (part of `npm test` and of every build) checks it all.

## Where it is painted

- `site/world/ray/textures.js`: each tradition's palette (`PALETTES`), walls
  (128 × 256, one metre wide and 2.5 m tall), floors (64 × 64), the beamed
  ceiling for interiors, and the skyline over the horizon (512 × 96).
- `site/world/ray/sprites.js`: people (`PEOPLE`, 64 × 128, four walk frames),
  animals (64 × 64, four frames, painted side-on and mirrored to face the way
  they walk), things (`PROPS`, 64 × 64), the hero's hands (`HANDS`) and the
  gold marker over places you can act on.
- `site/world/ray/paint.js`: the painter (rectangles, lit ellipses, polygons,
  thick lines, tiling noise, ink outlines).

Each tradition has its own look: Fante laterite, thatch and kente; vermilion
lacquer and grey tile on the Tango coast; plaster and timber in a German
autumn; ochre stucco and lapis in Baghdad.

## Adding a kind

A new `kind` in a map needs a painter, or the art check fails and names it:

- A person: add an entry to `PEOPLE` (robe, trim, head, pattern, what they
  carry, scale).
- An animal: add it to `ANIMALS` with its size.
- A thing: add it to `PROPS`, choosing an archetype painter (vessel, boxy,
  post, flame, plant, rock, cloth, timber, frame, device) and its height in
  metres. Set `emit` if it glows, and add it to `EMITTERS` in
  `ray/things.js` if it lights the ground at night.
- A building or trunk that should be a solid wall: add a painter to
  `STRUCTURES` in `textures.js`.
- A mark on the ground: add it to `DECALS`.

Review by eye with `npm run art:sheet` (contact sheets) and
`npm run art:view -- <tale> <scene> [light]` (first-person frames), both
written to `artifacts/`.

## Commissioned art

A painter can be replaced by an image without touching maps or story: give
`spriteFor` or `paintWall` a loaded texture of the same size for that kind.
Sizes in the world come from the painted figure's height, so keep the figure
standing on the bottom row with transparent space around it. Collision and
story position always come from physics and maps, never from art.

## Tiled palettes

`site/art/<tale>/tiles.json` and `tiles.svg` are the palette the Tiled editor
paints map ground with (`docs/MAPS.md`). The game does not draw them. The art
check makes sure every ground glyph has a tile. Regenerate a sheet with
`node scripts/generate-tileset.mjs site/art/<tale>/tiles.json`.

## What the check verifies

For every tale:

- the Tiled palette covers every ground glyph and matches its grid;
- every wall, floor and sprite any map uses has a painter and the expected
  size, walls are opaque, sprites paint something and stand a plausible
  height;
- people and animals have four walk frames of one size;
- every person's portrait crop finds a face;
- every hero has hands;
- every cell of every level has a floor texture.
