# Event engine and episode authoring

`site/game.js` owns game state. `site/stories.js` exports three versioned episode objects. `site/app.js` renders the engine's view and dispatches actions. The browser UI never changes inventory, story flags, or encounter state directly.

## One action

`dispatch({ type, id })` checks the action against the current scene, visibility, prerequisites, and puzzle state. It records the player's choice, charges its turn cost, applies its effects, checks triggers, and processes due events. A rejected action restores the entire prior state. Inspection defaults to zero turns; other scene actions default to one.

Events are considered after each action and after each event's effects. They fire once per journey. A matching event enters the queue at `turn + delay`. Due events sort by priority descending, due turn ascending, then ID. An interrupt saves the destination scene and enters an encounter. Queued events remain pending until that encounter resolves with `to: '$return'`. Resolving the encounter then drains due events. Processing is bounded at 64 immediate events per action to catch broken content.

The current implementation supports authored one-shot events. Repeatable encounters should be modeled as separate explicit events with their own conditions. Do not introduce an unrestricted repeat loop without an author-defined cap and new tests.

## Conditions

Conditions support `all`, `any`, `not`, `item`, `flag`, `scene`, `theme`, `visited`, `event`, `turn`, and `stat` with `gte`/`lte`. Examples:

```js
{
  all: [{ item: "chart" }, { theme: "mystery" }, { stat: "trust", gte: 3 }];
}
{
  not: {
    flag: "takeCord";
  }
}
```

`when` disables an unavailable action, preserving its explanation. `visible` controls whether it is shown at all. Use `requires` to explain a disabled action in player language. Repeated pickups should have a persistent flag: checking inventory alone would let a player pick the same object up again after consuming it.

## Effects

Supported effects are `give`, `remove`, `flags`, `stats`, `clues`, `objective`, `to`, and `ending`. Give/remove use arrays of item IDs. Stats use deltas and are clamped from 0 to 10. Clues are deduplicated. Scene transitions clear partial puzzle input. Event interrupts also clear the interrupted scene's partial puzzle input; completed puzzle flags remain. No real-time deadlines run during menus or reading.

```js
{
  id: 'chart', type: 'TAKE_ITEM', label: 'Copy the return current',
  when: { flag: 'passage' }, visible: { not: { flag: 'chartTaken' } },
  effects: { give: ['chart'], flags: { chartTaken: true }, stats: { insight: 1 } },
  text: 'You mark the sheltered current on your chart.'
}
```

## Puzzles, recipes, and themes

A scene's `puzzle` specifies labeled options, a solution sequence, a solved flag, success/failure text, and optional effects. `PUZZLE` adds one symbol. A complete attempt costs one turn and can trigger world events; partial input is saved. `CLEAR_PUZZLE` clears input without a turn. Scene actions of type `SOLVE` remain disabled until the puzzle's solved flag is set. Retrying does not consume an irreplaceable object.

Recipes name ingredients and a result. `COMBINE` requires every ingredient, consumes them, gives the result, and takes one turn. Item-specific scene actions use `uses` and `requires` so the bag can explain when use is available. Consumption belongs in the action's `remove` effect.

`SHIFT_THEME` allows one genre change per journey and costs one turn. A theme has descriptive copy and optional effects; scene variants and action/event conditions can then react to it. It is unavailable during an active interrupt. New themes need reachable routes and ending tests, not only a visual treatment.

## Persistence and replay

`save()` serializes `{ version, episodeId, revision, actions, savedAt }`. `Game.load()` checks versions and reconstructs state by replaying at most 3,000 validated actions. This avoids trusting a stored inventory or fabricated story flags. The latest checkpoint records the action prefix that entered a marked scene; `rewind()` replays that prefix. Discovered endings are kept separately so replaying a branch preserves collection progress.

Story content changes that alter action IDs, costs, rules, or event order must increment `revision`. Current migration policy is explicit incompatibility with an option to start a fresh journey. Never silently replay a different edition.

## Validation and limits

`validateEpisode()` is build-time structural validation, including static scene reachability. Conditional feasibility is covered by authored path tests for every ending and a browser playthrough for each episode. Static reachability does not prove that all possible state combinations are safe. New content needs tests for conditional branches, consuming objects before later requirements, interrupted puzzles, and routes with high pressure.

First-release limits: one active interrupt at a time, one latest checkpoint, authored deterministic encounters, three text-and-scene adventures, no combat simulator, no live story scraping, and no cloud save service. A service worker is intentionally deferred until asset and save revision caching are designed together. Regional editorial review and real human blind playtests remain important before a broad launch; automated playthroughs do not replace either.
