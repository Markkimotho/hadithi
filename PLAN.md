# Hadithi — adventure game rebuild plan

## 1. Product goal

Turn the current single-route item checklist into a browser-first anthology of playable adventures. A player chooses a story, makes consequential decisions, collects and uses objects, changes alliances and circumstances, and reaches endings that reflect those choices. The experience should feel like a game from its first screen: short readable scenes, visible goals, responsive choices, satisfying feedback, and a reason to replay. The initial release should work without an account or a paid content service.

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
- A genuine theme shift available during play: for example, an adventure can become a mystery, a tense survival route, or a hopeful diplomacy route. The selected mode changes scene text, available actions, sound/art treatment, and an ending condition; a palette toggle alone does not count.
- A non-obvious but understandable consequence. Show players what they know, and foreshadow important risks. Avoid arbitrary punishment and invisible win requirements.
- Distinct win, mixed, and loss or unresolved outcomes. An ending recap lists the choices and objects that mattered, then offers a replay from the beginning or from a discovered branch point.

The story library should label region, tradition, source type, genre, tone, estimated length, and content notes. After the three-episode release is solid, extend to the Middle East, South and Southeast Asia, additional African traditions, the Americas, and Oceania. Add nerdy literary science fiction and puzzle adventures where rights are clear. Do not claim global diversity based on a token story from each continent.

## 5. Game rules and data format

Replace the old room/boss schema with a versioned episode graph. Each scene has stable ID, prose, optional illustration/ambience key, choices, and optional inspectable objects or characters. Each choice has a label, destination, visible requirements, state changes, and a short consequence. State includes inventory, flags, named relationships, theme, visited scenes, discovered clues, and choice history. The engine must support conditional choices and text, object acquisition/use/drop, one-time events, reversible and irreversible choices, checkpoints, and multiple endings.

Keep story content in reviewed, local data files. Use a small declarative rules vocabulary rather than arbitrary JavaScript in content. Validate schema versions, missing destinations, impossible requirements, orphan scenes, soft locks, unreachable endings, and duplicate item IDs during the build. Set an explicit policy for save migration when content changes. Avoid random outcomes until they add drama without making a player's decision meaningless; if randomness is used, seed and show it so a run can be reproduced.

Core engine API: `startEpisode`, `view`, `choose`, `inspect`, `useItem`, `save`, `load`, and `restart`. State transitions should be pure enough for tests and an episode editor. The UI should never infer game rules from CSS or story prose. Story data should never depend on UI selectors.

## 6. Browser experience

1. **Story shelf:** strong cover compositions, concise hooks, region/tradition and source credit, clear New/Continue controls, tone and content information, completion marks.
2. **Play screen:** large readable scene text, illustrated setting or restrained CSS scene, 2–4 prominent choices, a compact objective, and a visible consequence log. The main text column must remain comfortable on phones.
3. **Inventory:** inspect each item for its story meaning, use it when an action allows it, and see when an item changes or is spent. No automatic pick-up without an intentional player action unless the story explains it.
4. **Journal/map:** visited branches, discovered clues, named characters, current objective, and a concise recap after returning to a save. Show known information without exposing undiscovered branches.
5. **Theme control:** offer an in-story choice to change narrative tone/direction and a separate accessibility control for visual comfort. The chosen narrative theme affects the episode's later scenes.
6. **Feedback:** tactile pressed states, short transitions, optional low-volume sound, and muted scene art. Include sound off by default or an immediately visible mute control. Support reduced motion.
7. **Accessibility:** semantic buttons/headings, keyboard play, visible focus, no color-only clues, sufficient contrast, adjustable text size, skip/reduce animation, screen-reader announcements for scene changes, and touch targets suitable for phones.

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
5. Define the versioned episode schema and validation script.
6. Implement the state engine, save/load, and one full episode from opening to all endings.
7. Add tests for every transition class and a graph traversal check for reachable endings and no trapped scenes.
8. Play the episode without developer tools; revise pacing, clarity, object value, and consequences.

### Gate C — anthology release
9. Author and review the other two episodes to the same depth.
10. Build story shelf, inventory, journal, theme UI, settings, responsive art system, and source/credit screens.
11. Test narrative paths, save migration, mobile layout, keyboard/screen-reader use, and reduced-motion mode. Conduct at least one blind playtest per episode; revise confusing choices and dead branches.
12. Update README, source ledger, and deployment config. Build and deploy to Render, then smoke-test a new run and a resumed run on the deployed URL.

## 9. Acceptance criteria

- Three distinct, complete, source-credited episodes from named traditions across Africa, Asia, and Europe; each has multiple endings and a playable theme shift.
- At least one choice in every episode visibly changes a later scene, an object use, and the ending recap. Collecting everything must not be the only winning strategy.
- A player can understand goals and act within one minute, finish a first episode without technical help, save and resume, and replay with a materially different route.
- The build rejects broken story links and invalid content; tests cover inventory, conditional choices, theme changes, endings, and save/load.
- Desktop and phone layouts are readable; keyboard and reduced-motion paths work; source and rights records are available from the game.
- Render deployment serves the release, and the live site passes a smoke test.

## 10. Scope decisions still to make after this plan

- Confirm the three specific tales and source editions after reading them in full and checking rights for the intended audience and launch markets.
- Decide whether the desktop Tkinter edition should later receive the new engine or be archived as the original version. Browser work does not need to wait for this.
- Decide whether accounts and cross-device sync have actual player demand after the static release.
