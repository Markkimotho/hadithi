# Hadithi — adventure game rebuild plan

## 1. Product goal

Turn the current single-route item checklist into a browser-first anthology of playable adventures. A player chooses a story, makes consequential decisions, collects and uses objects, changes alliances and circumstances, and reaches endings that reflect those choices. The experience should feel like a game from its first screen: the world produces events, the player responds with actions, and those actions change what can happen next. Story text supplies context and consequence, but scrolling or repeatedly clicking “continue” must never be the main interaction. The initial release should work without an account or a paid content service.

The visual direction is a late-1990s game manual and first-person adventure terminal: coarse stone, parchment, copper, ink, limited muted colors, strong borders, bitmap-like type, and restrained motion. Doom and Wolfenstein are references for framing and nostalgia, not for copying their art, branding, enemies, or interface assets. Story artwork must support the setting of each episode; a West African tale should not inherit a generic European castle.

## 2. What exists and why it falls short

- Browser: static HTML/CSS/JavaScript, built by copying `site/` and `game_data.json` into `dist/`. No framework or server is currently required.
- Desktop: a separate Tkinter edition reads the same old JSON. The browser edition is the priority for this rebuild; keep the desktop code intact until a deliberate migration or retirement decision.
- Content: one crystal/dragon plot, eight locations, four defined objects, one boss, one victory route. Moving into a room automatically grants its loot. The fight advances through one repeated button and checks fixed inventory gates.
- Persistence: the browser has no save system or story selection. Existing tests prove only that prepared players win and unprepared players lose.
- Delivery: README describes GitHub Pages. Render is an option, but the proposed first release can still be a static site on Render; a server is useful only when a real feature needs it.

## 3. Story sourcing and rights

Use sources as research material for authored interactive adaptations, not as a live scrape displayed in the game. Record for each story: source title, collector/author/translator, publication date, source URL, cultural and geographic context, text rights, adaptation rights, date checked, and editorial notes. Separate a traditional narrative from the particular translation or retelling that put it in English. Exclude a source if its adaptation and distribution rights are unclear in intended launch markets. Keep original game prose and character dialogue in the repository so it can be reviewed, revised, and tested.

Research starting points:

| Collection or work | Possible episode seed | Editorial caution |
| --- | --- | --- |
| [Project Gutenberg West African folklore shelf](https://www.gutenberg.org/ebooks/subject/28313) | Anansi or another specific tale selected after reading the source | Identify the exact community and collector; old colonial retellings can distort names, motives, and customs. |
| [Project Gutenberg Japanese fairy tale shelf](https://www.gutenberg.org/ebooks/subject/5942) | Momotaro or Urashima Tarō | Compare more than one telling; label this as a Japanese tale, not a stand-in for all Asian stories. |
| [Grimm's Fairy Tales](https://www.gutenberg.org/ebooks/52521) | A compact bargaining or journey tale | Name the German collection and edition; do not imply all of Europe shares one tradition. |
| [The Arabian Nights Entertainments](https://www.gutenberg.org/ebooks/128) | A voyage, puzzle, or negotiation episode | Identify the version and translator; avoid flattening the collection into a single modern national label. |
| [The Wonderful Wizard of Oz](https://www.gutenberg.org/ebooks/55) | Optional literary fantasy or nerdy side campaign | Keep literary fantasy distinct from folklore and verify the chosen edition's rights. |

Project Gutenberg says most of its books are unrestricted by **US** copyright law, while some are distributed by permission and may still be restricted. It also warns that rights outside the US can differ. Its name and license have separate reuse rules. [Policy](https://www.gutenberg.org/policy/license), [permission guide](https://www.gutenberg.org/policy/permission.html). [Standard Ebooks](https://standardebooks.org/about/standard-ebooks-and-the-public-domain) dedicates its ebook files to the public domain, but a title's legal status still needs a launch-market check. A story's source screen will link to the specific edition and credit its collector/translator.

Editorial rules: do not present one perspective as the authentic voice of a whole region; preserve culturally important names and relationships; avoid turning sacred beings or living traditions into generic loot and monsters; consult region-specific sources and, before a broad public launch, seek compensated sensitivity reading for episodes where appropriate. Give the player decisions about strategy and consequence rather than assigning a culture a simplistic moral. The release roster should balance screen time, depth, polish, and agency across regions.

## 4. First playable release

Build **three complete episodes**, one rooted in a named African tradition, one in a named Asian tradition, and one in a named European tradition. Select the exact source tales after the rights and editorial review above. Each episode must have:

- A distinct premise, setting, playable role, goal, and source note.
- 12–20 substantial scenes, about 20–30 meaningful choices, at least 3 endings, and a typical 15–25 minute first run. These are scope targets, not a reason to pad prose.
- At least 4 obtainable objects, with at least 2 used in different ways. Objects can be consumed, exchanged, combined, or retained for a later consequence.
- At least 2 tracked relationships or world variables and a choice whose effect appears several scenes later.
- At least 8 authored gameplay events across travel, encounters, discoveries, hazards, negotiations, and world changes. Events must ask the player to act, spend a resource, use an object, solve a compact challenge, or accept a consequence.
- At least 2 event chains in which an earlier action changes which event fires later. Every episode must include one interrupt event that changes the immediate plan and one ambient world event that makes the setting feel alive.
- A genuine theme shift available during play: for example, an adventure can become a mystery, a tense survival route, or a hopeful diplomacy route. The selected mode changes scene text, available actions, sound/art treatment, and an ending condition; a palette toggle alone does not count.
- A non-obvious but understandable consequence. Show players what they know, and foreshadow important risks. Avoid arbitrary punishment and invisible win requirements.
- Distinct win, mixed, and loss or unresolved outcomes. An ending recap lists the choices and objects that mattered, then offers a replay from the beginning or from a discovered branch point.

The story library should label region, tradition, source type, genre, tone, estimated length, and content notes. After the three-episode release is solid, extend to the Middle East, South and Southeast Asia, additional African traditions, the Americas, and Oceania. Add nerdy literary science fiction and puzzle adventures where rights are clear. Do not claim global diversity based on a token story from each continent.

## 5. Game rules and data format

Replace the old room/boss schema with a versioned, event-driven episode graph. A scene establishes the current place and situation; events change that situation. Each player action is dispatched as an event such as `TRAVEL`, `INSPECT`, `TAKE_ITEM`, `USE_ITEM`, `TALK`, `BARGAIN`, `SOLVE`, `WAIT`, or `CHOOSE`. The engine evaluates rules, applies state changes, emits consequences, and queues follow-up events. The interface renders the resulting state. It never advances the story just because the player scrolled.

Each authored event has a stable ID, trigger, priority, conditions, available actions, effects, optional deadline or turn cost, follow-up events, and outcome text. Triggers can include entering a place, acquiring or using an object, a relationship crossing a threshold, completing an objective, a turn counter reaching a value, or another event finishing. Events may interrupt travel or conversation when the story calls for it. They must remain authored and deterministic by default so consequences are understandable and testable.

State includes current place, current encounter, inventory, resources, objectives, flags, named relationships, theme, turn counter, visited locations, discovered clues, event history, and queued events. The engine must support conditional actions and text, object acquisition/use/drop/combine, one-time and repeatable events, event chains, delayed consequences, reversible and irreversible actions, checkpoints, and multiple endings.

The core play loop is:

1. Present a situation, objective, and actions that are currently possible.
2. Let the player move, investigate, speak, use an object, solve a challenge, or take a strategic action.
3. Dispatch that action to the rules engine.
4. Update inventory, relationships, resources, objectives, time, and world state.
5. Fire any newly satisfied events and show immediate feedback.
6. Return control with a changed situation and a new set of meaningful actions.

Events should create playable pressure without demanding twitch reflexes. Turn limits, pursuit meters, resource costs, patrol cycles, and expiring opportunities are appropriate. Real-time countdowns are optional and must pause with the game, respect reduced-motion/accessibility settings, and offer a non-timed mode. Compact interactions may include clue assembly, route planning, matching an object to a problem, bargaining, stealth timing expressed in turns, or risk/reward choices. Avoid filler clicking and puzzles that require unexplained guessing.

Keep story content in reviewed, local data files. Use a small declarative rules vocabulary rather than arbitrary JavaScript in content. Validate schema versions, missing destinations, impossible requirements, orphan scenes, soft locks, unreachable endings, and duplicate item IDs during the build. Set an explicit policy for save migration when content changes. Avoid random outcomes until they add drama without making a player's decision meaningless; if randomness is used, seed and show it so a run can be reproduced.

Core engine API: `startEpisode`, `dispatch`, `evaluateTriggers`, `processQueue`, `view`, `save`, `load`, and `restart`. Domain events and their payloads form the boundary between UI and engine. State transitions should be deterministic and pure enough for tests, replay, save migration, and an episode editor. The UI should never infer game rules from CSS or story prose. Story data should never depend on UI selectors.

## 6. Browser experience

1. **Story shelf:** strong cover compositions, concise hooks, region/tradition and source credit, clear New/Continue controls, tone and content information, completion marks.
2. **Play screen:** the current encounter dominates the screen, with a compact objective, illustrated setting or restrained CSS scene, 2–5 contextual actions, and a visible consequence log. Story text appears in short passages around play events; it is not an endless feed. The layout must remain comfortable on phones.
3. **Inventory:** inspect each item for its story meaning, use it when an action allows it, and see when an item changes or is spent. No automatic pick-up without an intentional player action unless the story explains it.
4. **Journal/map:** visited branches, discovered clues, named characters, current objective, and a concise recap after returning to a save. Show known information without exposing undiscovered branches.
5. **Theme control:** offer an in-story choice to change narrative tone/direction and a separate accessibility control for visual comfort. The chosen narrative theme affects the episode's later scenes.
6. **Feedback:** tactile pressed states, short transitions, optional low-volume sound, and muted scene art. Include sound off by default or an immediately visible mute control. Support reduced motion.
7. **Accessibility:** semantic buttons/headings, keyboard play, visible focus, no color-only clues, sufficient contrast, adjustable text size, skip/reduce animation, screen-reader announcements for scene changes, and touch targets suitable for phones.
8. **Event feedback:** clearly distinguish a world event, the player's selected action, the rules consequence, and newly available actions. Interrupt events may shake or reframe the interface briefly, while reduced-motion mode uses a static alert.

Use original CSS or properly licensed art. Build a small visual system first: palette, type scale, panel shapes, icon rules, and scene composition. Create one representative story shelf and one play screen, review them at desktop and mobile sizes, then implement the rest. Avoid neon gradients, glowing cards, and generic AI-generated fantasy art.

## 7. Architecture and deployment

Phase 1 can remain a fast static web app with local story JSON and `localStorage` or IndexedDB saves. This gives offline-capable reading, low operating cost, and simple Render Static Site deployment. Add a service worker only after cache/version handling is tested. No account or database is needed for local saves.

Use Render Static Site for the first public release. Add `render.yaml` with the build command and publish directory, a single-page fallback if routing requires it, and security headers where supported. Keep GitHub Actions for tests if helpful, but remove GitHub Pages as the assumed deployment path. A full stack Render web service plus managed PostgreSQL becomes appropriate for optional cross-device saves, accounts, authoring/review workflow, or social features. Do not add user accounts or a story-generation API to the first release merely because full stack hosting is available.

Avoid live fetching of third-party stories at play time: availability, rights, formatting, and offensive historical text would be uncontrolled. Maintain a documented content ingestion and review process instead. Keep dependency count modest, and use build tooling only where it clearly improves content validation and maintainability.

## 8. Delivery sequence and gates

### Gate A — content and design (before feature coding)
1. Audit the existing browser and desktop behavior and preserve the current working baseline.
2. Select three exact source tales and editions. Record rights and cultural context in a source ledger.
3. Write episode briefs: role, goal, conflict, cast, objects, branch map, theme shifts, endings, and content notes.
4. Prototype the shelf and play screen and review mobile, desktop, and keyboard flow.

### Gate B — engine and first vertical slice
5. Define the versioned episode/event schema, action vocabulary, trigger rules, queue behavior, and validation script.
6. Implement event dispatch, trigger evaluation, deterministic queue processing, save/load, and one full episode from opening to all endings.
7. Add tests for every transition class, event priority, delayed effects, interruption, idempotency, and save/resume. Add a graph traversal check for reachable endings, dead events, loops, and trapped states.
8. Play the episode without developer tools; revise pacing, clarity, object value, and consequences.

### Gate C — anthology release
9. Author and review the other two episodes to the same depth.
10. Build story shelf, inventory, journal, theme UI, settings, responsive art system, and source/credit screens.
11. Test narrative paths, save migration, mobile layout, keyboard/screen-reader use, and reduced-motion mode. Conduct at least one blind playtest per episode; revise confusing choices and dead branches.
12. Update README, source ledger, and deployment config. Build and deploy to Render, then smoke-test a new run and a resumed run on the deployed URL.

## 9. Acceptance criteria

- Three distinct, complete, source-credited episodes from named traditions across Africa, Asia, and Europe; each has multiple endings and a playable theme shift.
- Every episode contains authored event chains, interruptions, world reactions, and at least one delayed consequence. At least one player action visibly changes a later event, an object use, and the ending recap. Collecting everything must not be the only winning strategy.
- A player can understand the goal and perform a meaningful action within one minute. No route can be completed by scrolling or using only a generic continue action. A completed episode can be replayed through a materially different sequence of events.
- The build rejects broken story links, invalid triggers, dead events, unbounded event loops, and invalid content. Tests cover event ordering, inventory, conditional actions, theme changes, endings, and save/load during an active encounter.
- Desktop and phone layouts are readable; keyboard and reduced-motion paths work; source and rights records are available from the game.
- Render deployment serves the release, and the live site passes a smoke test.

## 10. Scope decisions still to make after this plan

- Confirm the three specific tales and source editions after reading them in full and checking rights for the intended audience and launch markets.
- Decide whether the desktop Tkinter edition should later receive the new engine or be archived as the original version. Browser work does not need to wait for this.
- Decide whether accounts and cross-device sync have actual player demand after the static release.

## Implementation status — 18 October 2026 (second edition)

**First edition.** Three tales, 44 scenes, 30 events, nine endings, deployed at [Hadithi](https://hadithi-i2us.onrender.com).

**Second edition (this release).** The anthology grows to four tales with *The Olive Jar* (Ali Cogia, Lang's *Arabian Nights* from Galland; the first step of §4's "extend to the Middle East"). Every tale is deepened with systems drawn from modern narrative games. The engine stays deterministic and testable throughout:

- **Seeded dice checks** (2d6 + itemized modifiers vs DC) with exact odds shown before committing, one-try and retry rules, and fail-forward outcomes. §5's randomness rule is met: seeded, shown, reproducible, and undo cannot reroll.
- **Deductions**: connect two clues to reach a conclusion that changes what is possible.
- **Echoes and secret endings**: endings teach knowledge that later tellings remember; each tale has one ending reachable only that way.
- **Characters, marks, a travelable map, a chronicle of runs**, procedural weather and light, procedural WebAudio sound (off by default), undo, shareable seeds, Storyteller's grace (an assist mode), three text sizes, and offline play via a versioned service worker.
- **Save migration policy** (§5): saves from listed earlier revisions are replayed through current rules and carried forward when legal; first-edition saves load.

Totals: 57 scenes and encounters, 49 events, 18 dice checks, 16 deductions, 16 endings (4 secret), 12 echoes, 20 marks.

**Verification.**
- 36 gate tests (<2 s) cover rules, dice math, migration, and all 18 authored walkthroughs (every ending). They also prove secrets are unreachable without echoes.
- The build proves a path to every ending.
- A seeded playtest eval (9,600 agent runs, trap checks, dead-content coverage, balance thresholds) runs in CI and nightly.
- 45 browser tests replay every walkthrough through the real UI and cover offline play and an axe WCAG 2 AA audit at desktop and phone sizes.

Exhaustive state-space proof is infeasible (over 2M states per tale). The checks are strong but sampled, and `docs/ENGINE.md` says so.

**Still outstanding** (unchanged honesty):
- Regional editorial and sensitivity review, especially for the new Baghdad tale and its Galland/Diyab provenance.
- Commercial international rights review.
- Human blind playtests.

Automated agents measure fairness and reachability, not fun. Agents reach *The Olive Jar*'s losing ending in most runs because they rarely make its key deduction. Human playtests should confirm the tale is fair rather than obscure.

## Third edition — implementation status, 18 October 2026

The third-edition plan from the recovered Claude session is preserved in [docs/THIRD-EDITION.md](docs/THIRD-EDITION.md). It changes the presentation to a Phaser and Planck top-down world while keeping the current story engine authoritative and deterministic.

**Phases 0 and 1 are complete.** Large self-hosted type, prose linting, and the local-judge service are in place. The engine bridge records seeded skill outcomes, exposes check profiles, migrates v2 saves to v3, and accepts declared physics facts.

**Phase 2 is implemented in the workspace.** Phaser and Planck load only after entering a mapped tale. The Wisdom courtyard and market are walkable, with the well sharing the market ground. The world supports keyboard, controller, joystick, and tap-to-move input; collision, paths, pickup and throwing; hotspot actions and travel; saved story actions; focus and dialog pauses; and a Classic view. Unmapped scenes continue through Classic view. The build now checks every authored world layout against its story scene.

**Phase 3 is implemented locally.** The Wisdom vector tilesheet is generated from a checked manifest and drives the world renderer. Kweku and Anansi now have shared-anchor layered rigs and idle/walk/carry/push/fall clips; Kweku drives the physical player sprite. The art gate validates atlas grids, glyph coverage, rig bones, clips, and SVG part dimensions and runs in production builds. The prop sheet is reserved and documented, while live physics props still use their existing drawn art.

**Phase 4 implementation is complete locally.** All 14 Wisdom scenes use authored Tiled JSON maps with validated entry points and reachable interactions. River and ford currents and squall wind affect Planck physics. World mode layers weather and light over the map. Leap, balance, scale, and brace challenges reflect terrain, story evidence, character choices, check odds, and assist mode. Wisdom narration follows the Fante voice guide and passes strict prose lint. Mark's desktop and phone vertical-slice playtest remains the final human check; the handoff checklist is in [docs/PLAYTEST-WISDOM.md](docs/PLAYTEST-WISDOM.md). The third-edition work remains local and has not been deployed.
