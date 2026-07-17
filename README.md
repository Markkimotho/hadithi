# Hadithi

An atlas of playable tales. Three free browser adventures draw on a Fante Anansi tale, Urashima Tarō, and the German musicians tale. Explore a world that responds to your actions, collect and combine objects, investigate clues, solve practical puzzles, change the genre, and discover nine endings.

[Play Hadithi](https://hadithi-i2us.onrender.com)

## Run

Requires Node.js 22 or newer. The game has no runtime dependencies, account requirement, paid story API, or analytics.

```sh
cd hadithi
npm ci
npm run dev
```

Open http://localhost:4173. To serve the production build:

```sh
npm test
npm run build
npm start
```

`npm run build` validates the episodes and copies the browser app into `dist/`. Any static HTTP host can serve that directory. Serve over HTTP; ES modules do not work reliably when opening `index.html` directly from the filesystem.

## What you can play

| Story                       | Tradition                | Your role     | Main interactions                                                                        |
| --------------------------- | ------------------------ | ------------- | ---------------------------------------------------------------------------------------- |
| The Wisdom in the Pot       | Fante, present-day Ghana | Kweku Tsin    | Repair a sling, test a river crossing, teach a carrying knot, negotiate the pot's future |
| The Palace Beneath the Tide | Japanese, Tango coast    | Urashima Tarō | Rescue a turtle, align the seasonal dial, chart a return current, choose a home          |
| The Midnight Orchestra      | German, Grimm collection | The donkey    | Recruit an ensemble, time a patrol, recover evidence, conduct a four-voice entrance      |

There are 44 authored scenes and encounters, 30 triggered world events, and three endings per episode. Every episode supports Wonder, Mystery, and Survival. A genre shift is a one-time action that opens different routes and solutions. Its effects are described before choosing it.

Time advances by turns, never by scrolling or waiting outside the game. Inspection, reading clues, and opening inventory are free. Other actions show their cost. Weather, tides, patrols, favors, and relationships produce later consequences. Interrupting encounters temporarily take control, then return to the interrupted scene.

## Controls and saves

- Click a scene marker or a contextual action. Use Tab and Enter for keyboard play; 1–5 select the corresponding action.
- Inspect objects in the Bag tab. Matching uses appear among the current actions; available combinations appear below the bag.
- Read collected clues and the journey log. The Trail tab shows discovered places and the latest replay checkpoint.
- Progress saves after each action on the current browser. Export a JSON save to keep a portable copy; import through Settings.
- Text size, reduced motion, and optional quiet button sounds are in Settings. Sounds start off.

Saves contain an episode ID, schema version, content revision, and the action sequence. Loading replays the same rules to reconstruct inventory, puzzles, relationships, and pending events. Incompatible revisions are rejected clearly rather than partially loaded. Change an episode's `revision` when editing rules or action IDs. A future save migration should explicitly translate old action sequences.

## Verify

```sh
npm test
npm run build
npm run test:browser
```

Browser tests use installed Google Chrome locally. In CI they use Playwright Chromium. To run with the CI browser locally, install it with `npx playwright install chromium` and set `CI=1`. The browser suite plays all three episodes at desktop and phone sizes and covers sources, filters, inventory, crafting, puzzle input, a genre shift, autosave/resume, checkpoint replay, keyboard input, and settings. Engine tests cover all nine endings, event priority and delay, active-interrupt saves, schema failures, crafting, and puzzle retries. Screenshots are generated in `artifacts/`; failure traces are in `test-results/`.

## Deploy on Render

The live site is in the `main` Render workspace: [Hadithi](https://hadithi-i2us.onrender.com) · [service Dashboard](https://dashboard.render.com/static/srv-db9vii7avr4c73fj59ng). Build command: `npm ci && npm test && npm run build`. Publish directory: `dist`. No database or secrets are required. GitHub Actions verifies the build and browser tests; Render publishes the static app.

The live service was created directly through the Render connector and deploys on commits. `render.yaml` is a validated provisioning reference that additionally specifies security headers and deployment after CI passes. Those additional settings are not automatically synced to a directly created service; apply them through its Dashboard if desired. Review the existing service before creating a Blueprint to avoid a duplicate site. The local server is for previewing and is not needed on Render. See [deployment details](docs/DEPLOYMENT.md).

## Authoring and sources

- [Episode briefs and source ledger](docs/EPISODES.md)
- [Engine and content rules](docs/ENGINE.md)
- [Original implementation plan](PLAN.md)

`site/stories.js` uses small authoring helpers to produce plain declarative episode objects. Conditions and effects are data, not executable story scripts. Build validation checks references, conditions, effect types, puzzle options, recipes, duplicate events, and disconnected scenes. Engine and browser tests check actual playable routes. Traditional narrative motifs inspired newly written text and original SVG artwork. Read the in-game source notes or source ledger for edition details, the distinction between tradition and adaptation, and outstanding international rights/editorial review.

The original Tkinter prototype remains in `hadithi.py` with its original `game_data.json`. It is a separate legacy game and does not run the new episode engine.
