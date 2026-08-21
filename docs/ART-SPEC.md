# Art drop-in contract

The Wisdom scene uses locally served assets in `site/art/wisdom/`. Keep the data files beside the art: the renderer loads the terrain sheet and puppet part URLs, while `npm run art:check` checks their dimensions and references before every production build.

## Terrain tiles

`tiles.json` is the source manifest and `tiles.svg` is the generated sheet. The sheet is an 8-column grid of 32×32 frames; each manifest tile has one stable ID and one layout glyph. Regenerate with `npm run art:generate`, then validate with `npm run art:check`. The current world renders these frames at 40×40 world pixels. A commissioned sheet can replace `tiles.svg` without code changes when it preserves the frame order, canvas dimensions, and names from the manifest. SVG is the current format; if PNG is needed, update the checker to read PNG dimensions and keep this atlas geometry.

## Props

`props.json` describes a 4×4 grid of 64×64 frames. `props.svg` reserves the first sixteen drop-in slots. Runtime props still use the existing physics-aware drawing functions; this atlas is prepared for the prop renderer migration and must not be treated as wired into gameplay yet. Keep slot IDs and frame indices stable when replacing the sheet.

## Character rigs

`rigs/kweku.json` and `rigs/anansi.json` define a 64×72 canvas, a foot anchor at `[32,68]`, a parented bone tree, ordered image parts, and named animation clips. Each part SVG is a full-size transparent 64×72 canvas with drawing aligned to the shared canvas coordinates. The renderer positions that canvas at the declared part pivot and rotates the associated bone. Keep pivots and layer order when replacing a part. Part art can be SVG now; the renderer can accept PNG textures with the same canvas and transparent padding when the commissioned work is ready.

The Kweku rig drives the physical player sprite. Anansi's rig is loaded and ready for story NPC placement. Animation remains visual only: collision and story position continue to come from Planck.

## Validation

`npm run art:check` verifies atlas bounds, complete tile glyph coverage, unique IDs, rig parent references and cycles, animation references, and every part file's dimensions. Production builds run the same check. Add new tale art under `site/art/<tale>/` and extend the checker before wiring it into a scene.
