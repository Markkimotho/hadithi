# Hadithi third edition: a top-down game with physics

## Recovered-plan progress — 18 October 2026

- **Phase 0:** typography, prose linting, and local LLM judge are implemented.
- **Phase 1:** engine bridge and v3 save outcomes are implemented.
- **Phase 2:** runtime is integrated locally. The Wisdom courtyard, market, and shared-ground well work with movement, pathfinding, physics objects, hotspots, travel, saves, Classic view, desktop controls, touch input, and controller input. Layout validation runs during builds.
- **Phase 3 is implemented locally.** The generated 18-frame Wisdom tilesheet is used by the world renderer; Kweku and Anansi have validated layered rigs and named animation clips; the player is rendered with the Kweku puppet. Art contract checks run both as `npm run art:check` and during production builds. Props have a documented 16-slot atlas contract, but the physics prop renderer still draws its current vector primitives.
- **Phase 4 implementation is complete locally.** All 14 Wisdom scenes use authored Tiled JSON maps, checked for action placement and reachability. The river and ford maps push bodies with current fields; the squall carries an authored wind field. World mode layers weather, light, and weather-dependent scene treatment over the maps. Leap has three shifting stone targets, balance responds to whether Anansi carries the pot behind him, the scale presents available clues and deductions against a patience timer, and brace reads changing gusts. Challenge tolerances follow story odds and assist. Wisdom narration follows the Fante voice guide, includes dialogue in every scene, and passes strict prose lint. See [MAPS.md](MAPS.md) for the Tiled conventions.
- **Next:** Mark's desktop and phone vertical-slice playtest, using [PLAYTEST-WISDOM.md](PLAYTEST-WISDOM.md). The third-edition work remains local and has not been deployed.
- The third-edition runtime is not deployed yet. Verification results are recorded in the root [PLAN.md](../PLAN.md).

The original plan follows.

## Context

Hadithi is a story engine with a strong core: deterministic replay saves, dice checks, deductions, echoes, 4 tales, 57 scenes, and 18 checks. On screen, though, it reads as a text cabinet:

- **Static backdrops.** Each scene is one flat SVG `<img>` with a weather canvas on top (`site/app.js:476`). Nothing in the world moves because of the player.
- **Small type.** There are 60+ rules at 9–11px in `site/style.css`. Labels are Courier New in uppercase with wide letter-spacing, which reads as a terminal dashboard rather than a storybook.
- **Generic prose.** The sentences are tidy and uniform in length, with abstract taglines ("Some things are too large to keep.", "Every action leaves a trace.") and UI words like "LOOK · THINK · ACT". There are no character voices and very little dialogue.

Mark wants a real game with moving parts and physics, plus text that is large and sounds human.

Decisions made with Mark:

| Decision | Choice |
|---|---|
| Form | Top-down exploration in 3/4 view (Zelda: A Link to the Past, Eastward, Stardew camera). You walk the hero between areas and push, carry, and throw objects with physics. |
| Outcomes | Skill decides physics moments. Stats change the physics. "Story mode" skips the skill and uses the existing dice. |
| Art | Vector art drawn in code now. The pipeline is built so commissioned art can be dropped in later, scene by scene, with no code changes. |
| Stack | Phaser 4.2.1 handles the renderer, camera, input, tilemaps, lights, filters, and tweens. Planck.js 1.5.0, a pure-JS Box2D port, handles physics. The existing engine stays the story brain. |

**Outcome this plan moves:** Hadithi goes from "read and click" to "walk, touch, and attempt". Every claim below has a measurable gate in the Verification section, covering frame time, minimum font size, prose-lint score, skill pass-rate bands, and walkthrough replay.

---

## Architecture

```
site/engine/        UNCHANGED BRAIN (game.js, conditions, rng, validate, explore, simulate)
   ▲  dispatch({type,id, outcome?})      view() / atmosphere() / mapView()
   │
site/world/         NEW: the playable world (Phaser + Planck)
   boot.js          lazy-loads vendor libs, creates Phaser.Game, owns the bridge
   bridge.js        the ONLY file that talks to Game: commands out, view in, events → world reactions
   scenes/
     ExploreScene.js   tilemap, player, NPCs, props, hotspots, exits, camera, lights
     SkillScene.js     runs one skill challenge, returns {pass, score, telemetry}
     OverlayScene.js   screen-space FX (vignette, lightning, transitions)
   physics/
     planck-world.js   fixed-step 60 Hz, top-down (gravity 0), damping as floor friction, z-height for jumps/throws
     bodies.js         factories: player capsule, crate, pot (fragile), rope chain, boat (buoyancy), water current field
     forces.js         wind fields, river currents, tide flood, crowd separation
   actors/
     puppet.js         vector rig: parts + bones, 8-direction 3/4 view, procedural walk/idle/carry/push/fall
     player.js         controller: walk/run, interact, grab/carry/throw, push, stamina
     npc.js            schedules + steering (seek, wander, flee, follow), patrol sight cones
   skills/             one module per skill kind (see Skill catalogue)
   input.js          keyboard, gamepad, touch joystick, tap-to-move (grid A*), unified "intent" stream
   audio-space.js    reuses site/ui/audio.js; adds StereoPanner by world x, distance gain
site/ui/            DOM overlay ABOVE the canvas: dialogue, bag, mind, people, map, settings
                    (existing renderers in widgets.js reused; text never drawn on canvas)
site/maps/<tale>/<scene>.json   Tiled JSON maps (Tiled editor is the authoring tool)
site/art/<tale>/                tiles.svg, props.svg, rigs/*.json  (artist drop-in slots)
site/vendor/                    phaser.esm.min.js + planck.mjs copied from node_modules at build (offline-safe)
```

Rules that keep the design sound:

1. **The engine stays authoritative for story state.** The world never mutates story state. It only calls `game.dispatch()` and re-reads `game.view()`.
2. **Turns stay action-counted, not real-time.** Walking, pushing a crate around, and looking at things cost 0 turns. Story actions keep their existing `cost`. Events, tides, moonrise, and interrupts keep their current balance, and the bots and evals stay valid.
3. **Real-time systems are cosmetic or local.** Wandering NPCs, weather, water, and loose props are cosmetic or local to the scene. They are not saved and are reset on load from a scene seed. The only exception is skill outcomes, which are recorded (rule 4).
4. **Skill outcomes are stored, not re-simulated.** A skill attempt dispatches `{type, id, outcome: {pass, score, mode: "skill"}}`. Replay reads the stored outcome, so saves stay deterministic even though physics is real-time. In Story mode there is no `outcome` field, and the existing dice roll from `rollFor(seed, key#attempt)` is used.
5. **Classic view is kept.** The current DOM cabinet becomes the "Classic view" setting. It is the accessibility path and the low-end-device path, and the browser tests already cover it.

### Engine changes (small, in `site/engine/game.js`)

- **`dispatch(command)`.** If a command targets a check action and carries `outcome`, validate it: `pass` is a boolean, `score` is in [0,1], `mode` is `"skill"`. Then pass it to `resolveCheck`.
- **`resolveCheck(a, outcome)`** (line 355).
  - Reuse the `forced` branch at line 361: when `outcome.pass` is set, synthesize dice that are consistent with the result. Pick the dice from `rollFor` candidates so `lastRoll` stays displayable.
  - Record `lastRoll.mode = "skill"` and `score`.
  - White-check retry rules are unchanged: a failed skill attempt still needs improved odds before a retry.
- **New `checkProfile(action)`.** Returns `{bonus, parts, dc, chance}` for the skill layer. Skill tuning reads the same stat bonuses the dice use (rule 2 of the Skill section).
- **`SAVE_VERSION` 3.** The v2 loader stays, because v2 command logs are a subset. Add a migration test.
- **Validator (`site/engine/validate.js`).** Add an optional `skill` field on `roll(...)` (helpers.js `roll(stat, dc, s, f, {kind, mods, name, skill})`). It must name a known skill kind with valid params.
- **Explorer, simulate, and evals are unchanged.** Bots play Story mode (dice).

---

## The world: how playing feels

**Moving around**
- Walk with WASD, arrows, a gamepad stick, or a touch joystick. Tap or click a spot to auto-walk there with grid A* over the tilemap collision layer. Hold Shift or B to run, which drains stamina; running while carrying something fragile risks it.
- The camera uses Phaser follow with lerp 0.12, a deadzone, a slight look-ahead in the walk direction, and zoom pulses on discoveries. Parallax overhangs (canopy, roofs) fade when the player walks under them.
- **Exits** are walk-off edges or doors (Tiled objects `exit` with `travel: <sceneId>`). Walking into one dispatches `TRAVEL`. Locked exits show a physical barrier with a reason line. The fade transition reuses the existing scene-title card.
- **Hotspots** are Tiled objects `hotspot` with `action: <actionId>`. Walking near one shows a prompt bubble ("E · Read the tracks"); pressing it dispatches the action. Hotspots hide when the engine reports the action unavailable, and show a padlock and the `requires` text when it is disabled.
- Every engine action needs a hotspot or the explicit flag `ui: "menu"`, which is reserved for abstract choices such as theme shifts and endings. The validator enforces this.

**Physics you can touch**
- **Push.** Crates, carts, and jars have mass, and the player capsule applies force. Crates stack, slide, and block doorways.
- **Carry and throw.** Lift light props with E. Throwing uses a z-arc with the shadow scaled by height, then lands with a bounce plus a dust puff.
- **Fragile props** (the pot, the olive jar) track an impact impulse. A hard collision makes them crack, which is a cosmetic stage, and the story can read it through a flag set by the bridge. Story flags from physics are allowed only through declared `physicsFlags` in the tale (for example `potCracked`). They cost 0 turns and are logged as commands so replay matches.
- **Water.** River current force fields push the player and floating bodies. Buoyancy bodies (boats, gourds, logs) bob with a spring on z. Tide maps flood: a water layer whose height follows the engine's turn-based tide event, lerped in real time.
- **Wind.** The squall is a directional force field with gusts from noise. It pushes the player, props, leaves, and rain particles together.
- **Ropes** are Planck chains of revolute joints: the mooring line, the carrying sling, and the bell rope. Rope bridges are plank bodies on rope joints that sag under the player.
- **Crowds** (the Baghdad street and the Bremen inn) are NPC bodies with separation steering. The player can push through slowly. A crowd can hide you from a patrol.

**People**
- NPCs walk daily schedules between waypoints and turn to face the player. Speech bubbles pop above heads in the DOM overlay, positioned from world-to-screen coordinates.
- Talking opens dialogue in the bottom panel at large type, with portrait chips from the puppet rig.
- **Interrupt events** (the bribe in the alley, patrols, the squall) arrive physically. The actor walks in on a path or the storm front moves across the screen, then the engine's encounter choice opens.

**Atmosphere**
- `game.atmosphere()` drives the look:
  - **Light.** Phaser 4 lights with an ambient colour per `light` (dawn, day, dusk, night, lamp), plus point lights on fires, lanterns, and fireflies. The player carries a torch at night.
  - **Weather.** The particle code in `site/ui/atmosphere.js` moves into Phaser particle emitters in world space. Rain collides with roofs, which use a "dry zone" mask.
- **Audio.** Ambience comes from `site/ui/audio.js`, and SFX pan by world x. Footstep sounds change with the surface (sand, wood, stone, water), read from a tile property.
- **Game feel.** Hit-stop of 60ms on impacts, a small screen shake on falls, squash and stretch on landings, and `navigator.vibrate` on mobile for skill fail/pass. All of it is off under reduced motion.

---

## Skill catalogue (all 18 checks)

Each check gets a `skill` kind. The skill scene runs in-world, or in an inset for the stacked and scale challenges. It returns `{pass, score}`.

**How stats tune physics.** `checkProfile().chance` sets the tolerance. The skill's difficulty parameter is solved so that an "average player model" passes at about `chance`, which keeps the existing balance. Stat bonuses become visible aids:
- Insight shows the trajectory arc.
- Trust steadies ropes and slows wobble.
- Pressure or alert values add wind or guard speed.

**Assist / Storyteller's grace** widens tolerances by the same +2 the dice get.

| Tale | Check | Skill kind | What you do |
|---|---|---|---|
| Wisdom | ford / leap | `leap` | Hop across bobbing stepping stones in a current. The centre stone sinks if you stand on it. The timing window shrinks with storm pressure. |
| Wisdom | tree / ledge | `balance` | Climb the trunk with the pot. A centre-of-mass bar shows that a pot carried in front tips you back. If you deduced "carry" (load behind), the pot moves to your back and the bar steadies. The tale's lesson becomes the physics. |
| Wisdom | council / persuade (white) | `scale` | Place argument stones on an elder's balance scale. Each clue or deduction has a weight, and you must tip the scale before the elders' patience runs out. |
| Wisdom | squall / push | `brace` | Push the cracked pot to shelter against gusts. Read the gust shadows on the grass and brace at the right moments. |
| Tide | fast (ride the bright current) | `steer` | Ride a current lane on a turtle, dodging eddies and rocks. |
| Tide | press Otohime (white) | `scale` | Same scale mechanic, with arguments drawn from clues. |
| Tide | memory (steer by your shore) | `steer` | Navigate in fog by remembered landmarks. Clues you hold place beacons. |
| Tide | swim against the reversal | `swim` | Stroke rhythm against the outflow with a breath meter. Surface at bubbles. |
| Orchestra | risk the floorboards | `sneak` | Cross creaking boards. Weight and speed raise a noise meter, and sleeping thieves stir. |
| Orchestra | approach together | `formation` | Keep the four animals together while you walk into lantern light. They follow with spring joints, and straggling breaks it. |
| Orchestra | improvise loudly | `stack` | Stack donkey, dog, cat, and rooster into the famous tower, each a physics body. Hold the tower steady while the noise builds. |
| Orchestra | bluff with one voice | `rhythm` | Hit call beats as the stacked tower sways. A miss shakes the tower. |
| Olives | borrow the jar | `carry` | Carry the heavy jar through a crowd without a hard impact (fragile-prop impulse limit). |
| Olives | slip into the back room | `sneak` | Avoid the shopkeeper's sight cone while he serves. |
| Olives | invite the dealers | `scale` | Persuade with weighed evidence. |
| Olives | call the court to order | `rhythm` | Call order in time with the crowd's ebb as the noise physically pushes crowd bodies. |
| Olives | argue the olives' age | `scale` | Place deductions on the scale. The "fresh olives" deduction is the heaviest stone. |
| Olives | duck past into the crowd | `chase` | Escape through crowd bodies. The pursuer uses steering, and alleys narrow. |

That gives 12 skill kinds: leap, balance, scale, brace, steer, swim, sneak, formation, stack, rhythm, carry, chase. Several share a core: `scale` is used 4 times, and `sneak`, `steer`, and `rhythm` twice each. Each skill module exports:

```js
export default {
  kind: "leap",
  params(profile, stats, assist) {},      // pure: chance → tolerances
  build(scene, world, params) {},          // Phaser + Planck setup
  update(dt, intent) {},                   // returns null | {pass, score}
  model(params, noise, rng) {},            // headless player model for evals (no Phaser)
};
```

`params` and `model` are pure and run in Node, so skills get gate tests and calibration evals with no browser.

**Retries and fail-forward.** A failed skill attempt resolves exactly like a failed dice check, using the existing failure text and flags. There is no game over. Red checks remain one try, and white checks reopen when odds improve, as today.

---

## Text: large, legible, and in a storyteller's voice

### Typography (ships first; independent of the world work)

- **Self-hosted OFL fonts** go in `site/fonts/` and are precached by the service worker, with no Google CDN at runtime:
  - Body: **Literata**, a variable serif designed for long reading.
  - Display and titles: **Fraunces**, which has storybook character.
  - UI and labels: **Atkinson Hyperlegible Next**, designed for low vision.
- **Drop Courier New and uppercase letter-spaced labels** everywhere. Labels use sentence case at normal tracking.
- **Scale tokens** on `:root`: `--fs-label 15px`, `--fs-ui 17px`, `--fs-body 19px`, `--fs-story clamp(21px, 1.2vw + 14px, 26px)`, `--fs-title clamp(32px, 4vw, 56px)`. The settings sizes normal, large, and larger multiply these. Line-height is 1.55 for story text and the measure is 62ch.
- **Minimum font size is 14px anywhere.** Every one of the 60+ 9–11px rules is replaced with a token.
- **In-world text** (bubbles, prompts, dialogue) is DOM, not canvas, so it stays crisp, scales with settings, and screen readers can read it. Bubbles are at least 18px.
- **Gate test** `test/typography.test.js`:
  - Parses `site/style.css` and fails on any `font-size` below 14px or any monospace family outside `code`.
  - Requires every size to come from a token.

### Prose rewrite (all 4 tales)

**What makes the current prose read as AI:**
- Uniform medium-length sentences.
- Abstract taglines and aphorisms ending scenes.
- Semicolon balance.
- Tidy "X, Y, and Z" triplets.
- Narration that summarises feelings instead of showing behaviour.
- No dialogue.
- The same tone across four very different traditions.

**Fix.** A voice bible per tale in `docs/VOICE.md`:
- **Narrator persona per tradition.** Fante: a teasing storyteller with call-and-response openers. Tango coast: quiet, seasonal, precise about light and water. Grimm: brisk, comic, rhythmic repetition. Baghdad: a court raconteur with nested asides. Each persona is grounded in the source text already cited in `docs/EPISODES.md`.
- **Rules:**
  - Characters speak in dialogue at least once per scene.
  - Use concrete nouns over abstractions.
  - No closing aphorisms.
  - Mix 3-word and 25-word sentences.
  - Humour where the source has it.
  - Use local names for things: kenkey, not "food".
- **Before and after example (courtyard):**
  - Before: "The cooking fire is cold. One enormous pot is missing. Beyond the wall, Anansi's footprints point toward the forest; someone has brushed leaves over them in a hurry."
  - After: "Cold ash. Mother's big pot is gone from its three stones, and so is Father. He swept leaves over his footprints, but he swept the way he does everything: fast, and only on the side he could see."
- **Scope.** Rewrite every player-facing string: scene text, action labels, outcomes, clues, notes, recaps, endings, hooks, and UI microcopy ("LOOK · THINK · ACT" → plain words or removed). Shorter scene text in world mode, because the world now shows what the prose used to describe. Scene text becomes 1–3 lines spoken by the narrator. The long versions stay in Classic view.
- **Gate: deterministic prose lint** `scripts/prose-lint.mjs` plus `test/prose.test.js`, run over every string in every tale. It fails on:
  - the banned-vocabulary list from CLAUDE.md;
  - em dashes;
  - "You notice", "You feel", "Something", "a sense of";
  - aphorism patterns (a final sentence under 8 words with an abstract noun and no concrete noun, using a curated list);
  - three or more consecutive sentences within ±3 words of each other in length (a burstiness floor);
  - a repeated sentence opener within a scene;
  - scenes with no quoted dialogue in world mode.
- **Periodic eval: LLM judge via local Claude Code.** It follows the CLAUDE.md LLM rule.
  - New `services/llm/` holds `judge.mjs`, which shells out to `claude -p` on the best available model, plus a contract (`contracts/llm-judge.schema.json`), tests that use a stub binary, and a README.
  - `evals/prose.mjs` runs blind pairwise comparisons of old and new text per scene against a rubric: specificity, voice fits the tradition, read-aloud rhythm, sounds human.
  - Threshold: new text wins at least 80% of pairs, and no scene has a median below 4/5. The report goes to `artifacts/eval/prose-report.md`.
  - It runs before ship and nightly, never in the commit gate.
- **Human gate.** Mark reads the Wisdom rewrite aloud before tales 2–4 are rewritten. A cultural-review note per tale is added to `docs/EPISODES.md`: the Akan storytelling opener and the Baghdad framing need a reader from the tradition.

---

## Art pipeline: vector now, artist later

- **Tiles.** Each tradition gets one `tiles.svg` sheet on a 32px grid at 3/4 perspective, with its own palette (Fante red laterite and forest greens, Tango coast blue-grey, Grimm autumn browns, Baghdad ochre and lapis). Phaser loads SVG textures at 2× for crisp rendering on high-DPI screens. Tiled tilesets reference the same sheet.
- **Puppet rigs.** Each `rigs/<character>.json` lists parts (SVG path data), bone hierarchy, pivots, and 8-direction draw order. `actors/puppet.js` builds a Phaser Container of part images and drives bones procedurally:
  - walk: sine swing on legs and arms, plus body bob;
  - carry: arms up, slower walk;
  - push: lean;
  - fall: brief ragdoll through Planck revolute joints, then a recover tween;
  - idle: breathing and blinking;
  - secondary motion: cloth and tails on spring chains.

  The cast is Kweku, Anansi, the ferryman, the wood-gatherer, the potter, and the elders; Urashima, Otohime, and a turtle; the donkey, dog, cat, rooster, and thieves; Ali Cogia, the merchant, the qadi, the children, the dealers, and the caliph.
- **Artist drop-in contract** (`docs/ART-SPEC.md`):
  - The same rig JSON can point a part at a PNG instead of path data.
  - A tiles PNG with the same grid replaces `tiles.svg`.
  - A Spine or sprite-sheet animation can override any procedural clip by name.
  - `scripts/art-check.mjs` validates the slot names, pivots, and grid, so swapping art needs no code change. It is a gate test.

---

## Phased delivery (each phase ships, commits, and pushes)

Work runs in parallel worktrees where phases are independent, per CLAUDE.md.

| # | Phase | Ships | Depends |
|---|---|---|---|
| 0 | Typography + prose lint + LLM judge service | Large text and new fonts live on today's game. Lint gate on. | none |
| 1 | Engine bridge | `outcome` commands, `checkProfile`, save v3, `physicsFlags`, validator `skill`/`hotspot` rules | none |
| 2 | World runtime | `site/world/*`: Phaser + Planck boot, player, camera, input (keys, pad, touch, tap-to-move), hotspots and exits wired to the engine, DOM overlay, Classic view toggle. Proven on 2 Wisdom scenes. | 1 |
| 3 | Art + rigs | Tileset generator, puppet system, Kweku and Anansi rigs, art-check gate | 2 (runs in parallel with 4's map work) |
| 4 | **Vertical slice: Wisdom** | All 14 scenes as Tiled maps, 4 skills (leap, balance, scale, brace), squall wind, river current, pot physics, prose rewrite. **Mark playtests here before scaling out.** | 0, 2, 3 |
| 5 | Tide | 15 maps; skills steer, swim, scale; tide flood; turtle ride | 4 |
| 6 | Orchestra | 15 maps; skills sneak, formation, stack, rhythm; animal followers | 4 |
| 7 | Olive Jar | 13 maps; skills carry, sneak, scale, rhythm, chase; crowd sim; moonrise light | 4 |
| 8 | Polish | Spatial audio, footsteps, haptics, perf pass, offline precache of vendor and fonts, lazy-load world (Phaser only after "Enter the story") | 5–7 |
| 9 | Docs + deploy | ENGINE.md world section, WORLD.md, VOICE.md, ART-SPEC.md, README, DEPLOYMENT.md; Render deploy | all |

Phases 5, 6, and 7 run as three parallel worktrees. They meet only at the bridge contract and `skills/` core.

---

## Critical files

**Modify**
- `site/engine/game.js`: `dispatch` (276), `resolveCheck` (355), `save`/`load`, new `checkProfile`
- `site/engine/validate.js`: hotspot coverage, skill params, physicsFlags
- `site/stories/helpers.js`: `roll(..., {skill})`, `hotspot` metadata
- `site/stories/{wisdom,tide,orchestra,olives}.js`: prose rewrite, `skill` on each check, `physicsFlags`
- `site/app.js`: mount the world vs Classic view, move tab panels into the overlay
- `site/style.css`: type tokens, remove sub-14px and monospace, overlay styles
- `site/ui/atmosphere.js`: logic moves into Phaser emitters (the canvas version stays for Classic view)
- `site/ui/audio.js`: spatial panning hooks
- `scripts/build.mjs`: copy vendor libs and fonts, validate maps and rigs, precache list
- `site/sw.js`: precache vendor libs and fonts
- `package.json`: deps `phaser@4.2.1`, `planck@1.5.0` (pinned; 1.5.1 is 6 days old), scripts `lint:prose`, `eval:skills`, `eval:prose`

**Reuse as-is**
- `rollFor` and `checkOdds` (`site/engine/rng.js`)
- `game.view()`, `atmosphere()`, `mapView()`
- `site/ui/widgets.js` (`diceTray`, `oddsBadge`, `mapSvg`) in the overlay
- `test/walkthroughs.js` `play()` for world replay
- the eval harness shape in `evals/playtest.mjs`

**New**
- `site/world/**`
- `site/maps/**`
- `site/art/**`
- `site/fonts/**`
- `services/llm/**`
- `contracts/llm-judge.schema.json`
- `scripts/prose-lint.mjs`, `scripts/art-check.mjs`
- `evals/skills.mjs`, `evals/prose.mjs`
- `docs/WORLD.md`, `docs/VOICE.md`, `docs/ART-SPEC.md`

---

## Verification

**Gate tests** (`npm test`; deterministic, Node only, under 2s total)
- `test/bridge.test.js`:
  - an outcome command passes and fails as stored;
  - replaying a save with skill outcomes gives an identical state;
  - a v2 save loads in v3;
  - an outcome on a non-check action is rejected;
  - a white-check retry is still blocked until odds improve.
- `test/maps.test.js`, for every scene map:
  - the JSON parses;
  - every engine action has a hotspot or `ui: "menu"`;
  - every hotspot and exit names a real action or scene;
  - grid BFS from every spawn reaches every hotspot and exit, so no hotspot is walled off.
- `test/physics.test.js`:
  - a Planck world with fixed inputs gives bit-identical positions over 600 steps, run twice;
  - the fragile-prop impulse threshold behaves as declared;
  - current and wind fields are bounded.
- `test/skills.test.js`:
  - each skill's `params()` is monotonic, so a higher chance always means looser tolerance;
  - `model()` is deterministic for a fixed seed.
- `test/typography.test.js` and `test/prose.test.js`, as described above.
- `test/art.test.js` runs `art-check` on every rig and tileset.
- The existing 36 tests stay green.

**Periodic evals** (`npm run eval`; before ship and nightly in CI)
- `evals/playtest.mjs`: unchanged thresholds, so the story balance is preserved.
- `evals/skills.mjs`:
  - Each skill is run 500 times with headless player models at novice, average, and expert noise.
  - Thresholds: average-model pass rate within ±0.08 of the check's dice `chance`; expert at least 0.85; novice at least 0.25 with assist.
  - Writes `artifacts/eval/skills-report.md`.
- `evals/prose.mjs`: the LLM judge via local Claude Code; new text wins at least 80% of pairs.

**Browser** (`npm run test:browser`; Playwright)
- **World replay.** All 18 walkthroughs play through the world using a test hook, `window.__hadithi.walkTo(hotspotId)`, which uses real input and pathfinding and then presses E. Skills in Story mode resolve by dice, so they are deterministic.
- **Input paths.**
  - Keyboard: walk to a hotspot, read the prompt, act.
  - Touch emulation: joystick plus tap-to-move.
  - Gamepad emulation: one test.
- **Physics in the browser.** Push a crate into a doorway and assert that the body position changed and the path recomputes. Throw a pot and assert the crack flag goes through `physicsFlags`.
- **Performance.** Sample frame times for 10s in the heaviest scenes (squall, Bremen crowd, Baghdad street). Thresholds:
  - p95 under 16.7ms on desktop Chrome;
  - p95 under 33ms with 4× CPU throttle and a mobile viewport.
- **Visual.** Screenshot every scene with motion off and diff against baselines.
- **Accessibility.**
  - The axe audit runs on the overlay and on Classic view.
  - Reduced motion disables shake, hit-stop, and parallax.
  - The computed font size on every visible text node is at least 14px.
- **Offline.** The service worker precaches vendor libs and fonts. A second load with the network off still plays.

**Manual (Mark)**
- Play the Wisdom vertical slice at phase 4 on desktop and phone.
- Read the courtyard, river, and council text aloud.
- Answer "does it feel like a game?" before tales 2–4 start.

**Deploy:** Render static site with build `npm ci && npm test && npm run build` and publish dir `dist`. After each phase, trigger a manual deploy (auto-deploy is not firing; see `docs/DEPLOYMENT.md`) and run a live smoke test: open each tale, walk, attempt one skill, reload, and resume.

---

## Risks and how they are handled

- **Turn-based story vs real-time world.** Turns stay action-counted, and real-time is cosmetic except for stored skill outcomes. Physics never drifts the story, and bots stay valid.
- **Floating-point physics differs across browsers.** Physics results are never replayed. Only the outcome is stored, so cross-device saves are safe. The Node determinism test only guards same-engine reproducibility for evals.
- **Bundle weight.** Phaser 4 (about 1.2MB minified, to be confirmed at phase 2) is loaded only when entering a tale and precached after the first visit. The shelf stays light.
- **Skill vs accessibility.** Story mode (dice), assist tolerances, remappable keys, tap-to-move, Classic view, and no time-pressure skill without a Story-mode alternative.
- **Scope.** 57 hand-built maps is the largest cost. Phase 4 proves the pipeline on 14 maps before committing to the remaining 43. Mark's playtest at phase 4 is the go/no-go.
- **Cultural accuracy of the voice rewrite.** VOICE.md cites the source collections. Openers and idioms are flagged for a reader from each tradition before release.
