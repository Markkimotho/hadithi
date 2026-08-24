# Hadithi

An atlas of playable tales. Four free browser adventures draw on a Fante Anansi tale, Urashima Tarō, the Grimms' travelling musicians, and Ali Cogia from the *Nights*. Explore a world that moves when you act, roll seeded dice with honest odds, connect clues into conclusions, and carry what each ending teaches into your next telling. Every tale hides one ending that only that remembered knowledge can reach.

[Play Hadithi](https://hadithi-i2us.onrender.com)

## Run

Requires Node.js 22 or newer. The game has no runtime dependencies, account requirement, paid story API, or analytics.

```sh
cd hadithi
npm ci
npm run dev
```

Open http://localhost:4173. To serve the production build (with offline support):

```sh
npm test
npm run build
npm start
```

`npm run build` validates every tale, proves a path to every ending, versions the offline cache, and copies the app into `dist/`. Any static HTTP host can serve that directory. Serve over HTTP; ES modules and the service worker do not work from `file://`.

## What you can play

| Story | Tradition | Your role | Main interactions |
| --- | --- | --- | --- |
| The Wisdom in the Pot | Fante, present-day Ghana | Kweku Tsin | Weave a sling, read a river, teach a knot, persuade a circle |
| The Palace Beneath the Tide | Japanese, Tango coast | Urashima Tarō | Rescue a turtle, read a feast that is a clock, choose a home |
| The Midnight Orchestra | German, Grimm collection | The donkey | Recruit an ensemble, time a patrol, build a case, conduct a four-voice entrance |
| The Olive Jar | Baghdad, *The Thousand and One Nights* (Galland) | The courtyard cadi | Investigate a theft, resist a bribe, cast a children's court, prove the olives are too fresh |

57 scenes and encounters, 49 world events, 18 dice checks, 16 deductions, 16 endings (4 secret), 12 echoes, and 20 marks.

## What makes a telling

- **A storyteller over a world you walk.** Each tale is a full-screen world. You walk it; a storyteller tells it. The opening line, a chapter card as each place opens, what you find, what people say (in bubbles over their heads), and what it costs all arrive a beat at a time in the parchment band at the foot of the screen.
- **Act it out.** Glints mark what you can look at, take or talk to. Walk up and press E: Kweku kneels to look, reaches to take, turns to talk, and the story answers. Taken things leave the ground and fly into your bag. People with several things to say open a conversation with lines to choose.
- **Turns, not timers.** Walking, lifting and throwing things, and thinking are free. Story actions take turns. Weather, tides, patrols and moonrise arrive on schedule and interrupt when they must.
- **Trials by hand.** Leaps, climbs, arguments and storms are played by hand, tuned to the odds your stats and choices earned. Turn trials off in Settings and seeded dice decide instead. Either way, failing moves the story on, and taking a step back cannot change how it went.
- **What you know.** In the journal, choose two things that fit together. A true connection opens conversations, arguments and endings. A wrong one costs nothing.
- **Echoes.** Endings teach echoes. A new telling remembers them and reveals ◈ remembered actions. Secret endings need them.
- **The turn of the tale.** Once per journey, turn it toward another kind of story (Mystery, Survival, Reconciliation). Routes, solutions and endings change.
- **Atmosphere.** Dawn-to-moonlight grading, rain, storms, mist and wind fields that push you and loose things around. Optional procedural sound starts off.

## Controls and saves

- Walk with WASD, the arrows, a controller, the touch joystick, or by tapping where to go (long walks break into a run). E, Space or the A button acts and moves the story on. 1 to 9 choose a line in a conversation. Q lifts or sets down, F throws. J opens the journal (B, K, P, M for its pages). U takes back a step. ? opens the guide.
- Progress saves after each action on this browser. Export a JSON save from the journal for a portable copy; import through Settings. Once loaded, the game plays offline.
- Settings: sound effects, ambience, volume, scene motion (respects reduced motion), three text sizes, physical trials on or off, Storyteller's grace (+2 to every trial's odds), and whether new journeys carry echoes.
- Only tales with a world map for every scene can be started. The others show "Being retold" on the shelf until their worlds are finished.

Saves contain the episode ID, schema version, content revision, seed, echoes, assist flag, and the command sequence. Loading replays the rules to rebuild everything; nothing stored is trusted. Saves from an older revision listed in `compatibleRevisions` are replayed through the new rules and carried forward if every command is still legal; otherwise the player is told clearly to start fresh.

## Verify

```sh
npm test              # gate: rules, dice, migration, walkthroughs, witnesses, type scale, prose lint, LLM service (<2 s)
npm run lint:prose    # the prose lint alone, with every issue printed
npm run build         # validation + a proven path to every ending
npm run eval          # 9,600 seeded agent playthroughs, trap checks, balance thresholds
npm run test:browser  # every walkthrough through the real UI, offline, axe audit, 14px floor, desktop + phone
npm run eval:prose    # paid: blind judge of rewritten text vs the baseline, via local Claude Code
```

Browser tests use installed Google Chrome locally and Playwright Chromium in CI (`CI=1` with `npx playwright install chromium`). The eval writes `artifacts/eval/playtest-report.md`; thresholds live in `evals/thresholds.json`. Screenshots land in `artifacts/`, failure traces in `test-results/`. See [engine and verification](docs/ENGINE.md).

## Deploy on Render

The live site is in the `main` Render workspace: [Hadithi](https://hadithi-i2us.onrender.com) · [service Dashboard](https://dashboard.render.com/static/srv-db9vii7avr4c73fj59ng). Build command: `npm ci && npm test && npm run build`. Publish directory: `dist`. No database or secrets are required. GitHub Actions runs the gate tests, build, eval, and browser tests on every push and nightly; Render publishes the static app.

The live service was created directly through the Render connector. Render reports auto-deploy enabled, but Git pushes did not queue deployments during setup, so the release was deployed manually. Check the Git provider connection in the service Dashboard before relying on automatic deployments. `render.yaml` is a validated provisioning reference that additionally specifies security headers and deployment after CI passes. Those additional settings are not automatically synced to a directly created service. Review the existing service before creating a Blueprint to avoid a duplicate site. The local server is for previewing and is not needed on Render. See [deployment details](docs/DEPLOYMENT.md).

## Authoring and sources

- [Episode briefs and source ledger](docs/EPISODES.md)
- [Engine and content rules](docs/ENGINE.md)
- [Voice guide: how the text should sound](docs/VOICE.md)
- [Original implementation plan](PLAN.md)

Text uses three self-hosted OFL faces from Fontsource (Literata for reading, Fraunces for titles, Atkinson Hyperlegible Next for the interface). They are installed by npm and copied at build by `scripts/vendor.mjs`, never committed. No text renders below 14px; `test/typography.test.js` and the browser suite enforce it. The only model access is `services/llm`, which shells out to the local Claude Code CLI.

Each tale lives in `site/stories/<id>.js`, written with small helpers from `site/stories/helpers.js` that produce plain declarative objects. Conditions and effects are data, not executable story scripts. Validation rejects broken references, unexplained locked actions, checks without a failure outcome, clues nobody can find, echoes that unlock nothing, endings nothing reaches, and secret endings not gated by an echo. New routes belong in `test/walkthroughs.js`, which feeds the gate tests, the eval, and the browser suite. Traditional narrative motifs inspired newly written text, original SVG artwork, and procedural sound. Read the in-game source notes or source ledger for edition details, the distinction between tradition and adaptation, and outstanding international rights/editorial review.

The original Tkinter prototype remains in `hadithi.py` with its original `game_data.json`. It is a separate legacy game and does not run the new episode engine.
