# Contributing to Hadithi

Hadithi is a static web app in plain JavaScript (ES modules). There is no build framework and no server; the only runtime library is Planck.js for physics.

## Run it

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev        # http://localhost:4173
```

Serve over HTTP; ES modules and the service worker don't work from `file://`.

## Check your change

```sh
npm test              # gate tests: rules, saves, walkthroughs, maps, renderer, art, type, prose (under 2 s)
npm run build         # validates every tale and proves a path to every ending; output in dist/
npm run eval          # seeded playthroughs, trial fairness, every first-person view rendered and timed
npm run test:browser  # every walkthrough through the real game, on a desktop and a phone viewport
```

A pull request needs `npm test`, `npm run build` and `npm run eval` green, and the browser suite for anything you can see. Continuous integration runs all four on every push.

Useful while working on the world:

```sh
npm run art:sheet                  # contact sheets of all painted art → artifacts/art/
npm run art:view -- wisdom ford    # first-person frames of a scene → artifacts/views/
npm run look -- tide               # open the game in Chrome and screenshot it → artifacts/look/
SHOTS=1 npm run test:browser       # keep review screenshots → artifacts/
```

`artifacts/` is never committed.

## House rules

- **Story text** follows the [voice guide](docs/dev/VOICE.md); `npm run lint:prose` checks it.
- **Art** is painted in code. Don't commit images; see the [art contract](docs/dev/ART-SPEC.md).
- **New routes through a tale** go in `test/walkthroughs.js`, which feeds the tests, the eval and the browser suite.
- **Nothing under 14 px**, and every control reachable by keyboard and touch.
- **Every change ships with its tests.** A bug fix ships with the test that would have caught it.

## Developer docs

- [The first-person world](docs/dev/WORLD.md): renderer, light, controls, HUD, trials.
- [Engine and content rules](docs/dev/ENGINE.md)
- [Maps](docs/dev/MAPS.md) and the [art contract](docs/dev/ART-SPEC.md)
- [Voice guide](docs/dev/VOICE.md) and [episode briefs and source ledger](docs/dev/EPISODES.md)
- [Plans and history](docs/dev/PLAN.md)
