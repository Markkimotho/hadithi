# Event engine and episode authoring

`site/engine/` owns all game rules. `site/stories/<id>.js` holds each tale as plain declarative data. `site/app.js` and `site/ui/` render the engine's view and dispatch commands. The UI never changes inventory, flags, dice, or encounter state directly, and story data never refers to UI selectors.

| Module | Responsibility |
| --- | --- |
| `engine/game.js` | `Game`: dispatch, triggers, event queue, checks, deductions, echoes, marks, save/load/undo/rewind, view |
| `engine/conditions.js` | The condition vocabulary shared by every rule |
| `engine/rng.js` | Seeded dice (`rollFor`), exact odds (`checkOdds`), seed codes |
| `engine/validate.js` | Build-time structural validation |
| `engine/explore.js` | Bounded state-space exploration, A* witness search, dead-content analysis |
| `engine/simulate.js` | Seeded playtest agents (random, curious, hasty) |
| `game.js` | Stable public entry point re-exporting the engine |

## One command

`dispatch(command)` validates the command against the current state, records it, charges its turn cost, applies effects, evaluates triggers, and drains due events. A rejected command restores the prior state exactly. Inspection and deduction cost no turns; other scene actions default to one.

Commands: scene actions (`TRAVEL`, `INSPECT`, `TAKE_ITEM`, `USE_ITEM`, `TALK`, `BARGAIN`, `SOLVE`, `WAIT`, `CHOOSE`) plus `PUZZLE`, `CLEAR_PUZZLE`, `COMBINE`, `SHIFT_THEME`, and `DEDUCE { ids: [a, b] }`.

Events enter the queue at `turn + delay` and fire by priority, then due turn, then ID. An `interrupt` pushes an encounter scene; queued events wait until it resolves with `to: "$return"`. `recheck: true` re-tests a delayed event's guard when it lands. Recurring events use `maxRuns` (≤20) with a positive `cooldown`. More than 64 events in one command is treated as a content bug.

## Conditions

`all`, `any`, `not`, `item`, `flag`, `scene`, `theme`, `visited`, `event`, `turn` (≥), `stat` (`gte`/`lte`), `clue`, `deduction`, `echo`, `ending`, `check` (`passed`), and `count` over `turn`, `inventory`, `items` (ever held), `clues`, `deductions`, `wrongLinks`, `visited`, `checksPassed`, `checksFailed`.

`when` disables an action and requires a player-facing `requires` explanation (validation enforces it). `visible` hides it. Repeated pickups need a persistent flag.

## Effects

`give`, `remove`, `flags`, `stats` (deltas, clamped 0–10), `clues` (IDs from the episode's `clues` map), `objective`, `to`, `ending`.

## Dice checks

```js
C("leap", "Leap the stepping stones", "TRAVEL",
  roll("insight", 8,
    outcome("You land on the firm stones.", { to: "grove" }),
    outcome("You arrive soaked.", { to: "grove", stats: { danger: 2 } }),
    { mods: [against("danger", "Storm pressure"), mod("Ferryman’s tip", 2, flag("favor"))] }))
```

A check rolls 2d6 + stat + modifiers against `dc`. Double six always succeeds and double one always fails, so nothing is certain. Every modifier has a label, and the UI shows the exact probability before the player commits. **Red** checks (default) can be tried once. **White** checks can be retried only after the bonus improves. Both outcomes must have text, because failure moves the story forward.

Dice are a pure function of `(seed, scene/action, attempt)`. Replaying a save, undoing, or reloading always reproduces the same roll, so undo cannot be used to reroll. Each journey's seed is shown as a seven-character code. `?seed=CODE` in the URL, or the new-telling dialog, replays a seed. Storyteller's grace (`assist`) adds an itemized +2 and is stored in the save.

### Skill outcomes and the fate ledger

In the third-edition world, a check can be staged as a physical challenge. `roll(..., { skill: { kind: "leap", ...params } })` names one of the kinds in `site/engine/skills.js`. Validation rejects unknown kinds and any parameter that is not plain data. `game.checkProfile(action)` returns `{ kind, stat, dc, bonus, parts, chance, assist, skill }`, the same odds the player sees, so the world can tune the challenge to the dice odds.

The world reports the result as `{ type, id, outcome: { mode: "skill", pass, score } }`. The engine then:

- validates the outcome and rejects it atomically on anything other than a check action;
- applies the authored success or failure exactly as a roll would;
- shows dice chosen to agree with the result (`diceFor`).

Without `outcome`, the seeded dice decide, which is Story mode.

Each attempt's result is written to `state.ledger`, keyed `scene/action#attempt`. The ledger is saved and survives undo. Any later resolution of the same attempt, by skill or dice, follows it, so undo cannot reroll fate in either mode. White-check rules still apply: a failed skill attempt needs better odds before a retry.

### Trials: how a check is played by hand

`site/world/trials/core.js` holds the rules, and they are pure.

**Timed trials** (leap, brace, balance, steer, swim, sneak, carry, chase, formation, stack, rhythm):

- A timed trial is a short run of moments, and the player answers each one with a press. A trial passes when enough of the answers are good, for example 2 of 3, or 3 of 4.
- The timing window around each moment is solved from the check's dice odds, so a player with average timing (a 0.13 s standard deviation) passes exactly as often as the dice would. Experts pass more often and novices less.
- Storyteller's grace is already part of the odds.

**The scale** (persuasion):

- The doubt on one pan is `dc − 7`, which is what an average roll would need.
- The stones you can lay on the other pan are the positive parts of the check's own odds: your stat and each advantage you have earned. Their labels come from the tale's modifiers, so the arguments are exactly what you learned.
- Laying every earned stone passes exactly when `7 + bonus ≥ dc`.

`site/world/trials/stage.js` stages trials in the world: rings close on stones, gust shadows, a swinging pot, and a Planck beam balance. `evals/skills.mjs` plays 2,000 simulated trials per player type through the same core, for every timed check in the tales and a grid of odds. With trials turned off in Settings, the seeded dice decide.

### Physics flags

`physicsFlags: { id: { text, scenes?, effects? } }` declares facts the world may report, such as a pot cracking in a fall. `{ type: "PHYSICS", id }` sets the flag once, costs no turn, records the text, and triggers events like any command. Effects are limited to `flags`, `stats` and `clues`; movement and endings stay with authored actions. Physics flags are logged commands, so replay matches.

## Deductions

Episodes define `clues: { id: text }` and `deductions: [{ id, from: [clueA, clueB], title, text, effects }]`. `DEDUCE` with two known clues either makes the deduction (applying its effects) or records a free wrong link (`wrongLinks`). Deductions are conditions, so they open conversations, add check modifiers, and gate endings.

## Echoes, secret endings, and marks

`echoes: { id: { title, text, from: condition } }` are earned when an ending's final state matches `from`. The browser keeps known echoes per tale and passes them to `new Game(ep, { echoes })`. Actions whose conditions mention an echo are flagged `remembered` in the view. Each tale has one ending with `secret: true`. Validation requires every action that reaches a secret ending to be gated by an echo, so secrets need knowledge from an earlier telling. `marks` are achievement conditions evaluated at the ending.

## View data

`view()` adds `actions` (available actions with `enabled`, `odds`, `remembered`), `clueItems`, `deductionItems`, `people` (met characters with conditional notes and an optional disposition stat), `map` (discovered nodes, edges, exits; `mapAs` places staged scenes), `atmosphere` (`weather`, `light`, `ambience` from episode defaults, scene fields, then ordered `atmosphere` rules), `earnedEchoItems`, `markItems`, and `canUndo`. Note that `view().actions` lists available moves; the command history is `state.actions`.

## Persistence

`save()` → `{ version: 3, episodeId, revision, seed, echoes, assist, ledger, actions, savedAt }`. Version 2 saves load with an empty ledger. `Game.load()` replays at most 3,000 validated commands rather than trusting stored state. **Migration policy:** an episode lists `compatibleRevisions`. A save from one of those revisions is replayed through the current rules, and if every command is still legal it is carried forward (`migratedFrom`). Otherwise the player gets a clear "start a new journey" message. Version 1 saves (no seed) replay with the episode's default seed. Increment `revision` whenever rules, action IDs, costs, or event order change.

## Verification lanes

| Lane | Command | Budget | What it proves |
| --- | --- | --- | --- |
| Gate | `npm test` | < 2 s | Rules, dice math, migration, every authored walkthrough (all 16 endings), witness search for every ending, secrets unreachable without echoes, no dead ends near the start |
| Build | `npm run build` | seconds | Structural validation plus a witness path to every ending; build fails otherwise |
| Eval | `npm run eval` | ~30 s | 2,400 seeded agent runs per tale, trap checks, dead-content coverage, balance thresholds in `evals/thresholds.json`; report in `artifacts/eval/` |
| Browser | `npm run test:browser` | ~40 s | Every walkthrough through the real UI, dice/undo, deductions, echoes, map, saves, migration, reduced motion, offline service worker, axe WCAG 2 AA audit, desktop and phone |

Exhaustive search of the full state space is infeasible: turn timing multiplies every configuration past two million states for a single tale. The engine therefore combines a bounded breadth-first search near the start, requirement-aware A* witnesses for every ending, authored walkthroughs for needle-thin routes, and Monte Carlo agents whose sampled states must each still reach an ending. These are strong checks, not a proof of every state.
