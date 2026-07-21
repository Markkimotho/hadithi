// Seeded playtest agents. Each run is reproducible from (episode, seed,
// policy, echoes). Agents roll real dice, so check balance is measured, and
// can periodically prove that the current state can still reach an ending.
import { Game } from "./game.js";
import { moves, search } from "./explore.js";
import { hash32, mulberry32 } from "./rng.js";

const typeOf = (move) => move.steps[0].type;
const isPuzzle = (move) => move.label.includes("/puzzle+");

/** How strongly each kind of player is drawn to a move. */
export const POLICIES = {
  /** Picks uniformly; a stress test, not a person. */
  random: () => 1,
  /** Explores, reads, collects, and thinks before committing. */
  curious(move, game) {
    const type = typeOf(move);
    const to = move.to;
    if (to && !game.state.visited.includes(to)) return 4;
    if (move.label.endsWith("puzzle+solve")) return 2;
    if (move.label.endsWith("puzzle+fail")) return 0.5;
    return (
      {
        DEDUCE: 6,
        INSPECT: 3,
        TAKE_ITEM: 3,
        USE_ITEM: 3,
        COMBINE: 3,
        TALK: 2,
        BARGAIN: 1.5,
        TRAVEL: 1,
        SOLVE: 2,
        CHOOSE: 0.6,
        WAIT: 0.5,
        SHIFT_THEME: 0.4,
      }[type] ?? 1
    );
  },
  /** Wants an ending soon; rarely reads, never dawdles. */
  hasty(move, game) {
    const type = typeOf(move);
    if (type === "CHOOSE" || type === "BARGAIN") return 6;
    if (move.to && !game.state.visited.includes(move.to)) return 3;
    if (type === "SHIFT_THEME") return 0.2;
    if (type === "INSPECT" || type === "DEDUCE") return 0.3;
    return 1;
  },
};

/** Moves an agent may choose from: forced dice outcomes are left to the dice. */
export function agentMoves(game) {
  const seen = new Set();
  const out = [];
  for (const move of moves(game)) {
    if (move.force === false) continue;
    const plain = { ...move, force: undefined, label: move.label.replace(/\+pass$/, "") };
    if (seen.has(plain.label)) continue;
    seen.add(plain.label);
    const step = plain.steps[0];
    const action = game.availableActions().find((a) => a.id === step.id && a.type === step.type);
    if (action?.effects?.to && action.effects.to !== "$return") plain.to = action.effects.to;
    out.push(plain);
  }
  return out;
}

export function playthrough(
  ep,
  { seed = 1, policy = "random", echoes = [], maxSteps = 300, trapEvery = 0, trapBudget = 20000 } = {},
) {
  const game = new Game(ep, { seed, echoes });
  game.unsafe = true;
  const weigh = POLICIES[policy];
  const rand = mulberry32(hash32(`agent|${policy}|${seed}`));
  const breadth = [];
  const odds = [];
  const traps = [];
  const used = new Set();
  let steps = 0;
  let deadEnd = null;
  while (!game.state.ending && steps < maxSteps) {
    const options = agentMoves(game);
    if (!options.length) {
      deadEnd = game.state.scene;
      break;
    }
    breadth.push(options.filter((m) => !isPuzzle(m)).length);
    const weights = options.map((m) => weigh(m, game));
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    let pick = options[options.length - 1];
    for (let i = 0; i < options.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pick = options[i];
        break;
      }
    }
    const before = game.state.lastRoll;
    used.add(`${game.state.scene}/${pick.steps[0].id}`);
    for (const step of pick.steps) game.dispatch(step);
    if (game.state.lastRoll && game.state.lastRoll !== before) odds.push(game.state.lastRoll.chance);
    steps++;
    if (trapEvery && steps % trapEvery === 0 && !game.state.ending) {
      const found = search(ep, { from: game.state, budget: trapBudget });
      if (!found.path) traps.push({ seed, policy, steps, scene: game.state.scene });
    }
  }
  const s = game.state;
  const checks = Object.values(s.checks);
  return {
    seed,
    policy,
    echoes,
    ending: s.ending,
    secret: Boolean(s.ending && ep.endings[s.ending].secret),
    turns: s.turn,
    steps,
    deadEnd,
    traps,
    breadth,
    odds,
    checksPassed: checks.filter((c) => c.passed).length,
    checksFailed: checks.reduce((n, c) => n + c.failures, 0),
    interrupts: s.log.filter((e) => e.kind === "encounter").length,
    deductions: s.deductions.length,
    deductionIds: s.deductions,
    wrongLinks: s.wrongLinks,
    fired: s.fired,
    visited: s.visited,
    clues: s.clues,
    taken: s.taken,
    marks: s.marks,
    earnedEchoes: s.earnedEchoes,
    usedActions: [...used],
    signature: s.fired.join(">"),
  };
}
