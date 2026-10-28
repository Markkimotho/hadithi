# The first-person world

Hadithi's world is seen through the hero's eyes. It is a software raycaster
in the style of Wolfenstein and of Bunker Run (`sdl-c-raycasting`), ported
from that C to plain JavaScript and drawn into a canvas. There is no game
framework. Planck.js (Box2D) does the physics, as before. The story engine is
unchanged and still decides everything that matters.

## How a frame is made

`site/world/boot.js` runs one loop per animation frame:

1. **Input** (`input.js`): forward, sideways, turn and mouse look from keys,
   mouse, touch stick and swipe, or gamepad.
2. **Movement**: intent is turned into a world-space push and handed to the
   Planck world (`physics.js`), which steps at a fixed 60 Hz. Walls, fences,
   rocks, deep water and standing people are solid. Rivers, tides and wind are
   force fields. A walked route (`walkTo`, a tap, a click on a signpost) uses
   A* over the map (`layout.js findPath`) and turns the camera to look where it
   walks.
3. **The world moves**: wanderers amble, companions follow your trail, loose
   jars and baskets slide, crack and fly.
4. **Render** (`ray/render.js`) into a low-resolution buffer (360 lines by
   default, fewer if a device is slow; see "Frame budget"):
   - sky with the tradition's skyline, or a beamed ceiling indoors;
   - floor (and ceiling) cast row by row, water rippling;
   - walls cast column by column (DDA), filling a depth buffer;
   - shadows, then billboard sprites far to near, each column tested
     against the depth buffer;
   - light on every pixel (below), then a vignette.
5. **Hands**: the hero's hands (or the donkey's hooves) are drawn into the
   same buffer, swaying with the walk, holding whatever you carry.
6. The buffer is put on the canvas and scaled to fill the screen with
   `image-rendering: pixelated`. Everything with words is DOM on top.

## Geometry

`ray/cast.js` is pure and tested in Node (`test/ray.test.js`).

- One tile is one metre. Walls are `WALL_H` = 2.5 m. The eye height depends on
  the hero (`tales.js`): Kweku 1.35 m, Urashima 1.58 m, the donkey 1.3 m, the
  Cadi 1.12 m.
- `castRay` walks the grid (digital differential analysis) and returns the
  perpendicular distance, so flat walls are flat. A ray that leaves the map
  without a wall returns nothing: a road out of a scene runs on into fog,
  and the floor repeats the edge row.
- `camera()` narrows the field of view on portrait screens so people keep
  their shape.
- `aimAt` picks what the crosshair rests on: nearest target in reach whose
  box covers the screen centre and that no wall hides.

## Light

Bunker Run's model, per pixel:

- **daylight** that falls off gently with distance, darker on north and south
  faces;
- **night ambient**, faint and bluish;
- **the torch**: a cone in the middle of the screen that falls off with the
  square of distance. It is on at night, in moonlight, underwater, by lamp and
  in storms;
- **point lights** from fires, lanterns, lamps and lit windows, stronger the
  darker it is (`ray/things.js sceneLights`);
- **fog** toward a colour per light, thicker in mist and dust.

The story's `atmosphere()` picks the light (`dawn`, `day`, `dusk`, `night`,
`moon`, `deep`, `lamp`); `lightmodel.js` adjusts it for weather. Rain, storm,
fireflies, lanterns and bubbles are also drawn as particles over the view by
`ui/atmosphere.js`. Mist and dust are not: they are fog in the renderer, and
drawing them twice washed the view out.

## What is a wall and what is a thing

`ray/scene.js buildLevel` turns a map layout into a level:

- **Walls** stop rays: `#` walls, `h` roofs, `T` forest, `b` hedges, the void,
  and props big enough to be buildings or trunks (`STRUCTURES` in
  `ray/textures.js`: huts, houses, the robbers' house, great trees, rock
  overhangs, stalls).
- **Floors**: every cell's ground, with marks on the ground (`DECALS`:
  leaves, bootprints, rugs, ripples) painted into it.
- **Things** stand as billboards: every other prop, one per cell it covers,
  plus fences (`=`) and rocks (`o`) from the ground plan. Loose physics
  props are placed from their bodies each frame.

On arrival the camera faces the middle of the scene's hotspots, but never a
wall: `facingFrom` scores 32 headings by how far you can see and how
directly they face the hotspots. Every spawn of every map is checked in the
gate tests and by the render eval.

## Acting

A gold diamond hangs over everything you can look at, take or talk to (blue if
it is remembered from an earlier telling, grey if not yet open). Put the
crosshair on it within 2.4 m and the prompt under the crosshair says what E
does. Standing on a place counts even if you are not aiming. Walking to a
place, by tap or by the test driver, ends looking at it. The hero acts the
action out (kneel to look, reach to take, a nod to talk) before the story
answers.

Exits are the gaps where a road leaves the map. Their signposts float over the
road when you face it and pin to the side of the screen when you do not.

## Trials

`trials/core.js` holds the rules, calibrated against the dice
(`evals/skills.mjs`). `trials/stage.js` stages them in first person on an
overlay canvas:

- **leap**: rings close on the real stepping stones ahead; a good press
  carries you onto the stone with a hop, a bad one dips you into the river;
- **brace**: gust shadows sweep in from the right toward the crosshair;
- **path** kinds: rings on points ahead of you;
- **place** kinds: a ring closing on the crosshair;
- **balance**: the view gives way to the climb, the pot swinging on its rope;
- **scale**: the elders' beam balance, a Planck simulation.

## The story panel

The story must never stand between you and the world:

- **Desktop:** a narrow panel in the bottom-left corner (at most 470 px, about
  a third of the screen). The hands keep to the middle 40% of the frame, so
  the two never meet. The bag sits in the opposite corner.
- **Phone:** the panel sits at the top, under a one-line quest bar, so the
  stick, the act button and the hands at the bottom stay clear. The minimap
  waits above the touch buttons.
- With nothing being told and nothing to choose, the panel steps away; the
  objective is always in the quest panel.
- **H** (or the Fold button) folds narration down to one line. A conversation
  or a trial always shows in full.
- Reading text (the telling, choices, bubbles, prompts, the journal, dialogs)
  is Atkinson Hyperlegible. The pixel face is kept for short labels: titles,
  names, keys.

## The HUD

`ui/play.js` and the play-screen block of `style.css`. One pixel face,
Pixelify Sans (OFL, self-hosted). Quest panel (tale, light and turn,
objective) top left. Minimap (`ui/minimap.js`, north up), journal, undo,
source and quit top right. Crosshair and prompt in the middle. Bag slots
painted from the world's own art. The dialogue box at the foot shows the
speaker's face, cropped from their sprite, with the teller's star when
nobody speaks. All text is at least 14 px. On phones the HUD reflows and the
touch controls step aside while a conversation or trial is open.

The title screen (`ui/title.js`) draws each tale's opening place with the
same renderer, the camera turning slowly, behind four tale cards.

## Frame budget

At 576 × 360 a frame takes about 3 ms on a laptop (Node: mean 2.7 ms, slowest
10 ms across all 166 arrival views; see `artifacts/eval/render-report.md`).
The world measures itself every 40 frames: above 12 ms it drops to a smaller
frame (300, 250, 210 lines), below 4 ms it climbs back.

## Tools

```sh
npm run art:sheet        # contact sheet of every painted texture and sprite → artifacts/art/
npm run art:view -- wisdom ford       # first-person frames of a scene in Node → artifacts/views/
npm run art:view -- orchestra clearing night   # the same, under another light
npm run look -- tide     # open the game in Chrome, walk a little, screenshot → artifacts/look/
npm run eval:render      # every arrival view: frame time, open view, detail
SHOTS=1 npx playwright test -g title   # browser suites, keeping review screenshots
```

`artifacts/` is not committed.

## Tests and evals

- `test/ray.test.js`: rays, projection, aiming, turning, light, weather,
  levels from layouts, arrival facing, rendered frames (opaque, deterministic,
  night darker with a torch cone, fires lighting the ground, walls hiding
  things, nothing drawn inside the eye), sprite sizes.
- `test/art.test.js` → `scripts/art-check.mjs`: every wall, floor and sprite
  any map uses has a painter, paints something, and has the expected size;
  every hero has hands; every person's portrait finds a face.
- `evals/render.mjs`: every scene from every spawn, timed and checked.
- Browser: `test/browser/world.spec.js` (first-person movement, turning,
  pausing, the crosshair, minimap and bag, touch stick and tap, gamepad, a
  jar lifted and thrown, offline) and `play.spec.js` (every walkthrough of
  every tale played through the world).
