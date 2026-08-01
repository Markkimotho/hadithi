// Authored walkthroughs: deterministic proofs that each ending (and the
// hardest marks) can be reached with the default seed's real dice. Each step
// is an action id, or "deduce:a+b", "theme:id", "combine:id", "solve".
import { Game } from "../site/game.js";
import { episodeById } from "../site/stories.js";

export const walkthroughs = [
  // ── 01 · The Wisdom in the Pot ─────────────────────────────────────────
  {
    episode: "wisdom",
    name: "shared: help the potter, teach the knot, open it together",
    steps: ["market", "listen", "home", "trail", "river", "ford", "wade", "tree", "knot", "shelter", "solve", "show", "hands", "council", "share"],
    expect: { ending: "shared" },
  },
  {
    episode: "wisdom",
    name: "keeper: mystery theme finds the second seal",
    steps: ["theme:mystery", "trail", "river", "ford", "wade", "bark", "tree", "ledge", "hands", "seal", "council", "shelter", "keeper"],
    expect: { ending: "keeper" },
  },
  {
    episode: "wisdom",
    name: "scattered: let the pot fall",
    steps: ["trail", "river", "ford", "wade", "tree", "ledge", "break"],
    expect: { ending: "scattered" },
  },
  {
    episode: "wisdom",
    name: "storyteller (secret): carry the child’s story from another telling",
    echoes: ["childsTale"],
    steps: ["market", "secret", "home", "trail", "river", "ford", "wade", "tree", "call", "childStory", "shelter", "deduce:treeSecret+lonely", "ledge", "hands", "council", "story"],
    expect: { ending: "storyteller", marks: ["light"] },
  },
  // ── 02 · The Palace Beneath the Tide ───────────────────────────────────
  {
    episode: "tide",
    name: "home: research the chart and negotiate honestly",
    steps: ["theme:mystery", "knife", "cut", "shell", "ask", "channel", "quiet", "promise", "hall", "garden", "solve", "cut", "stilled", "chart", "years", "archive", "research", "hall", "feast", "bargain", "accept"],
    expect: { ending: "home" },
  },
  {
    episode: "tide",
    name: "sea: choose a life in the lower harbor",
    steps: ["untie", "channel", "quiet", "hall", "feast", "homeSea", "stay"],
    expect: { ending: "sea", marks: ["nothingBorrowed"] },
  },
  {
    episode: "tide",
    name: "century: take the box and ride the strongest current",
    steps: ["untie", "channel", "quiet", "hall", "feast", "gift", "box", "return", "current", "open"],
    expect: { ending: "century" },
  },
  {
    episode: "tide",
    name: "door (secret): give the unopened box back to the tide",
    echoes: ["centuryChild"],
    steps: ["shoreMark", "untie", "remember", "channel", "quiet", "hall", "feast", "gift", "box", "askGift", "deduce:boxYears+highWater", "return", "wait", "giveBack"],
    expect: { ending: "door" },
  },
  // ── 03 · The Midnight Orchestra ────────────────────────────────────────
  {
    episode: "orchestra",
    name: "home: rehearse, win the house, hold it together",
    steps: ["bell", "dog", "invite", "cat", "invite", "rooster", "vote", "wood", "rehearsal", "solve", "ready", "song", "restore", "watch", "hold"],
    expect: { ending: "home" },
  },
  {
    episode: "orchestra",
    name: "case: mystery theme, ledger and witness to town",
    steps: ["theme:mystery", "dog", "invite", "cat", "invite", "rooster", "vote", "wood", "clearing", "sacks", "pantry", "risk", "witness", "agree", "hide", "escape", "case"],
    expect: { ending: "case" },
  },
  {
    episode: "orchestra",
    name: "road: rush everything and keep moving",
    steps: ["dog", "invite", "cat", "invite", "rooster", "rush", "wood", "clearing", "gate", "rush", "improvise", "escape", "road"],
    expect: { ending: "road" },
  },
  {
    episode: "orchestra",
    name: "every thread: all three deductions in one night",
    steps: [
      "dog", "invite", "cat", "invite", "rooster", "vote", "wood", "tracks", "rut", "clearing", "sacks",
      "pantry", "risk", "read", "deduce:sacksNames+ledgerDates", "witness", "why", "deduce:brokenWheel+millerCart",
      "back", "gate", "hide", "lanterns", "deduce:patrolRoute+lantern", "timed", "escape", "road",
    ],
    expect: { ending: "road", marks: ["weaver", "clear"] },
  },
  {
    episode: "orchestra",
    name: "bremen (secret): the tune and the dates from two other tellings",
    echoes: ["roadSong", "caseKnown"],
    steps: ["hum", "dog", "invite", "cat", "invite", "rooster", "vote", "wood", "rehearsal", "solve", "back", "sacks", "recall", "deduce:sacksNames+ledgerDates", "pantry", "witness", "hide", "agree", "escape", "bremen"],
    expect: { ending: "bremen" },
  },
  // ── 04 · The Olive Jar ─────────────────────────────────────────────────
  {
    episode: "olives",
    name: "verdict: the olives are too fresh",
    steps: ["hear", "takeOlive", "street", "olives", "keep", "show", "deduce:sevenYears+thisYear", "street", "fountain", "wait:6", "call", "begin", "taste", "dealers", "argue", "judge"],
    expect: { ending: "verdict", marks: ["cleanHands", "early"] },
  },
  {
    episode: "olives",
    name: "mercy: reconciliation through the merchant’s wife",
    steps: ["theme:diplomacy", "hear", "street", "gossip", "house", "help", "askWife", "ally", "deduce:warning+rumor", "street", "fountain", "call", "begin", "pretend", "dealers", "wife"],
    expect: { ending: "mercy" },
  },
  {
    episode: "olives",
    name: "dismissed: accept the oath",
    steps: ["street", "fountain", "wait:6", "call", "begin", "pretend", "dealers", "oath"],
    expect: { ending: "dismissed" },
  },
  {
    episode: "olives",
    name: "every thread: all six deductions before moonrise",
    steps: [
      "hear", "mint", "takeOlive", "street", "gossip", "shop", "dust", "ask", "street", "refuse",
      "house", "help", "askWife", "basket", "street", "olives", "keep", "show", "showTag",
      "deduce:sevenYears+thisYear", "deduce:threeYears+sevenYears", "deduce:oath+dustRing",
      "deduce:buyer+tagClue", "deduce:bribe+aliMint", "deduce:warning+rumor",
      "street", "fountain", "begin", "taste", "dealers", "argue", "judge",
    ],
    expect: { ending: "verdict", marks: ["weaver", "clear", "cleanHands"] },
  },
  {
    episode: "olives",
    name: "caliph (secret): invite the strangers in the corner",
    echoes: ["watched", "oathEcho"],
    steps: ["hear", "takeOlive", "street", "olives", "keep", "show", "deduce:sevenYears+thisYear", "street", "fountain", "wait:6", "call", "begin", "taste", "dealers", "argue", "strangers", "caliph"],
    expect: { ending: "caliph" },
  },
];

/** Replays a walkthrough. "wait:n" walks back and forth until turn n. */
export function play(walkthrough, { seed } = {}) {
  const ep = episodeById(walkthrough.episode);
  const game = new Game(ep, { echoes: walkthrough.echoes ?? [], ...(seed === undefined ? {} : { seed }) });
  const fail = (text) => {
    const where = `${ep.id}/${game.state.scene} (turn ${game.state.turn})`;
    const options = game
      .availableActions()
      .map((a) => `${a.id}${a.enabled ? "" : "✗"}`)
      .join(", ");
    throw new Error(`${walkthrough.name}: ${text} at ${where}; options: ${options}`);
  };
  for (const step of walkthrough.steps) {
    if (step === "solve") {
      const p = ep.scenes[game.state.scene].puzzle;
      if (!p) fail("no puzzle to solve");
      p.solution.forEach((id) => game.dispatch({ type: "PUZZLE", id }));
    } else if (step.startsWith("deduce:")) game.dispatch({ type: "DEDUCE", ids: step.slice(7).split("+") });
    else if (step.startsWith("theme:")) game.dispatch({ type: "SHIFT_THEME", id: step.slice(6) });
    else if (step.startsWith("combine:")) game.dispatch({ type: "COMBINE", id: step.slice(8) });
    else if (step.startsWith("wait:")) {
      const until = Number(step.slice(5));
      const scene = game.state.scene;
      while (game.state.turn < until) {
        const away = game.availableActions().find((a) => a.enabled && a.type === "TRAVEL" && !a.check);
        if (!away) fail("nowhere to wait");
        game.dispatch({ type: away.type, id: away.id });
        const back = game.availableActions().find((a) => a.enabled && a.effects?.to === scene);
        if (!back) fail("cannot return while waiting");
        game.dispatch({ type: back.type, id: back.id });
      }
    } else {
      const a = game.availableActions().find((x) => x.id === step);
      if (!a) fail(`missing action ${step}`);
      if (!a.enabled) fail(`unavailable action ${step} (${a.requires})`);
      game.dispatch({ type: a.type, id: a.id });
    }
  }
  return game;
}

/** The exact commands a walkthrough dispatches, for replaying through a UI. */
export function commandsOf(walkthrough) {
  return play(walkthrough).state.actions;
}
