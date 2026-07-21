// Exhaustive state-space exploration. Starting from a new journey, the
// explorer applies every legal move (both outcomes of every dice check, every
// combination, theme shift, puzzle solution, and deduction) and deduplicates
// equivalent states. It proves, rather than samples, that:
//   • every ending is reachable (with and without remembered echoes),
//   • no reachable state lacks a legal move (no dead ends),
//   • no reachable state is cut off from every ending (no traps),
//   • no content is dead (every action, event, clue, deduction, item, mark).
import { Game } from "./game.js";
import { eachLeaf, matches } from "./conditions.js";

const sortedEntries = (object) =>
  Object.entries(object ?? {}).sort(([a], [b]) => (a < b ? -1 : 1));

/** Largest turn threshold that any transition-relevant rule can observe. */
export function turnHorizon(ep) {
  let horizon = 0;
  const visit = (c) =>
    eachLeaf(c, (leaf) => {
      if (leaf.turn !== undefined) horizon = Math.max(horizon, leaf.turn);
      if (leaf.count === "turn")
        horizon = Math.max(horizon, leaf.gte ?? 0, (leaf.lte ?? 0) + 1);
    });
  for (const s of Object.values(ep.scenes))
    for (const a of s.actions) {
      visit(a.when);
      visit(a.visible);
      for (const m of a.check?.mods ?? []) visit(m.when);
    }
  for (const e of ep.events) visit(e.when);
  return horizon + 1;
}

/** Every legal move from a state, each as a list of commands. */
export function moves(game) {
  const s = game.state,
    ep = game.episode,
    out = [];
  if (s.ending) return out;
  for (const a of game.availableActions()) {
    if (!a.enabled) continue;
    const command = { type: a.type, id: a.id };
    if (a.check) {
      out.push({ label: `${s.scene}/${a.id}+pass`, steps: [command], force: true });
      out.push({ label: `${s.scene}/${a.id}+fail`, steps: [command], force: false });
    } else out.push({ label: `${s.scene}/${a.id}`, steps: [command] });
  }
  for (const r of ep.recipes ?? [])
    if (r.ingredients.every((id) => s.inventory.includes(id)))
      out.push({ label: `combine:${r.id}`, steps: [{ type: "COMBINE", id: r.id }] });
  if (!s.flags.themeShifted && !s.returnScene)
    for (const id of Object.keys(ep.themes))
      if (id !== s.theme)
        out.push({ label: `theme:${id}`, steps: [{ type: "SHIFT_THEME", id }] });
  const p = ep.scenes[s.scene].puzzle;
  if (p && !s.flags[p.solvedFlag]) {
    const clear = s.puzzle.length ? [{ type: "CLEAR_PUZZLE" }] : [];
    out.push({
      label: `${s.scene}/puzzle+solve`,
      steps: [...clear, ...p.solution.map((id) => ({ type: "PUZZLE", id }))],
    });
    if (p.failureEffects) {
      const wrong = p.solution.map(() => p.options[0].id);
      if (wrong.join() === p.solution.join())
        wrong[0] = p.options.find((o) => o.id !== p.options[0].id).id;
      out.push({
        label: `${s.scene}/puzzle+fail`,
        steps: [...clear, ...wrong.map((id) => ({ type: "PUZZLE", id }))],
      });
    }
  }
  for (const d of ep.deductions ?? [])
    if (!s.deductions.includes(d.id) && d.from.every((c) => s.clues.includes(c)))
      out.push({ label: `deduce:${d.id}`, steps: [{ type: "DEDUCE", ids: d.from }] });
  return out;
}

/**
 * Events with no effects, no interrupt, one run, and no rule observing them
 * only add a log line. Whether they have fired cannot change any future move.
 */
export function inertEvents(ep) {
  const observed = new Set();
  const visit = (c) => eachLeaf(c, (leaf) => leaf.event && observed.add(leaf.event));
  for (const s of Object.values(ep.scenes))
    for (const a of s.actions) {
      visit(a.when);
      visit(a.visible);
      for (const m of a.check?.mods ?? []) visit(m.when);
    }
  for (const e of ep.events) visit(e.when);
  for (const echo of Object.values(ep.echoes ?? {})) visit(echo.from);
  for (const m of ep.marks ?? []) visit(m.when);
  return new Set(
    ep.events
      .filter(
        (e) =>
          !observed.has(e.id) &&
          !e.interrupt &&
          (e.maxRuns ?? 1) === 1 &&
          Object.keys(e.effects ?? {}).every((k) => k === "objective"),
      )
      .map((e) => e.id),
  );
}

export function stateKey(s, horizon, cooldownCap, inert = new Set()) {
  const t = s.turn;
  const live = (id) => !inert.has(id);
  return JSON.stringify([
    s.scene,
    s.returnScene,
    s.ending,
    s.theme,
    Math.min(t, horizon),
    [...s.inventory].sort(),
    sortedEntries(s.flags).filter(([k]) => k !== "objective"),
    sortedEntries(s.stats),
    [...s.clues].sort(),
    [...s.deductions].sort(),
    s.fired.filter(live).sort(),
    sortedEntries(s.eventRuns).filter(([k]) => live(k)),
    sortedEntries(s.lastFired)
      .filter(([k]) => live(k))
      .map(([id, at]) => [id, Math.min(t - at, cooldownCap)]),
    s.scheduled
      .filter((q) => live(q.id))
      .map((q) => [q.id, q.at - t, q.priority])
      .sort(),
    sortedEntries(s.checks).map(([id, c]) => [id, c.passed, c.attempts > 0, c.bonus]),
    s.puzzle,
  ]);
}

function lean(state) {
  state.log = [];
  state.actions = [];
  state.lastRoll = null;
  state.checkpoint = null;
  return state;
}

/**
 * Breadth-first exploration. Returns coverage, every ending with a shortest
 * path, and any dead ends, traps, or engine errors with reproducible paths.
 */
export function explore(ep, { echoes = [], maxStates = 300000 } = {}) {
  const horizon = turnHorizon(ep);
  const cooldownCap = Math.max(1, ...ep.events.map((e) => e.cooldown ?? 1));
  const inert = inertEvents(ep);
  const start = new Game(ep, { echoes });
  const nodes = [];
  const index = new Map();
  const add = (state, parent, via) => {
    observe(state);
    const key = stateKey(state, horizon, cooldownCap, inert);
    const known = index.get(key);
    if (known !== undefined) return known;
    const id = nodes.length;
    index.set(key, id);
    nodes.push({ parent, via, state: lean(state), next: [], ending: state.ending });
    return id;
  };
  const coverage = {
    scenes: new Set(),
    actions: new Set(),
    events: new Set(),
    clues: new Set(),
    deductions: new Set(),
    items: new Set(),
    endings: new Map(),
    echoes: new Set(),
    marks: new Set(),
  };
  // Coverage is observed on every generated state, including ones that are
  // merged into an equivalent state, so deduplication never hides content.
  function observe(s) {
    s.visited.forEach((x) => coverage.scenes.add(x));
    s.fired.forEach((x) => coverage.events.add(x));
    s.clues.forEach((x) => coverage.clues.add(x));
    s.deductions.forEach((x) => coverage.deductions.add(x));
    s.taken.forEach((x) => coverage.items.add(x));
    if (s.ending) {
      s.earnedEchoes.forEach((x) => coverage.echoes.add(x));
      s.marks.forEach((x) => coverage.marks.add(x));
    }
  }
  add(structuredClone(start.state), -1, "start");
  const deadEnds = [];
  const errors = [];
  let truncated = false;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const s = node.state;
    if (s.ending) {
      if (!coverage.endings.has(s.ending)) coverage.endings.set(s.ending, i);
      node.state = null;
      continue;
    }
    const game = Game.fromState(ep, s);
    const options = moves(game);
    if (!options.length) deadEnds.push(i);
    for (const move of options) {
      const g = Game.fromState(ep, s);
      g.unsafe = true;
      g.forceRoll = () => move.force ?? null;
      try {
        for (const step of move.steps) g.dispatch(step);
      } catch (error) {
        errors.push({ at: i, move: move.label, error: error.message });
        continue;
      }
      coverage.actions.add(move.label.replace(/\+(pass|fail|solve)$/, ""));
      if (nodes.length >= maxStates) {
        truncated = true;
        node.truncated = true;
        continue;
      }
      node.next.push(add(g.state, i, move.label));
    }
    node.state = null;
  }
  // Reverse reachability: which states can still reach an ending (or an
  // unexplored frontier, which is not counted against the content)?
  const reverse = nodes.map(() => []);
  nodes.forEach((n, i) => n.next.forEach((j) => reverse[j].push(i)));
  const alive = new Uint8Array(nodes.length);
  const stack = [];
  nodes.forEach((n, i) => {
    if (n.ending || n.truncated) {
      alive[i] = 1;
      stack.push(i);
    }
  });
  while (stack.length) {
    const j = stack.pop();
    for (const i of reverse[j])
      if (!alive[i]) {
        alive[i] = 1;
        stack.push(i);
      }
  }
  const traps = [];
  alive.forEach((ok, i) => {
    if (!ok) traps.push(i);
  });
  const path = (i) => {
    const steps = [];
    while (i > 0) {
      steps.push(nodes[i].via);
      i = nodes[i].parent;
    }
    return steps.reverse();
  };
  return {
    episode: ep.id,
    echoes,
    states: nodes.length,
    truncated,
    horizon,
    endings: Object.fromEntries(
      [...coverage.endings].map(([id, i]) => [id, path(i)]),
    ),
    coverage,
    deadEnds: deadEnds.slice(0, 5).map(path),
    deadEndCount: deadEnds.length,
    traps: traps.slice(0, 5).map(path),
    trapCount: traps.length,
    errors: errors.slice(0, 5).map((e) => ({ ...e, path: path(e.at) })),
    errorCount: errors.length,
  };
}

/** Content that no explored state ever used. */
export function deadContent(ep, results) {
  const union = (key) => new Set(results.flatMap((r) => [...r.coverage[key]]));
  const actions = union("actions");
  const out = [];
  for (const [id, scene] of Object.entries(ep.scenes))
    for (const a of scene.actions)
      if (!actions.has(`${id}/${a.id}`)) out.push(`action ${id}/${a.id} is never usable`);
  const events = union("events");
  for (const e of ep.events) if (!events.has(e.id)) out.push(`event ${e.id} never fires`);
  const scenes = union("scenes");
  for (const id of Object.keys(ep.scenes))
    if (!scenes.has(id)) out.push(`scene ${id} is never entered`);
  const clues = union("clues");
  for (const id of Object.keys(ep.clues ?? {}))
    if (!clues.has(id)) out.push(`clue ${id} is never found`);
  const deductions = union("deductions");
  for (const d of ep.deductions ?? [])
    if (!deductions.has(d.id)) out.push(`deduction ${d.id} is never possible`);
  const items = union("items");
  for (const id of Object.keys(ep.items))
    if (!items.has(id)) out.push(`item ${id} is never obtained`);
  const endings = new Set(results.flatMap((r) => Object.keys(r.endings)));
  for (const id of Object.keys(ep.endings))
    if (!endings.has(id)) out.push(`ending ${id} is never reached`);
  const echoes = union("echoes");
  for (const id of Object.keys(ep.echoes ?? {}))
    if (!echoes.has(id)) out.push(`echo ${id} is never earned`);
  const marks = union("marks");
  for (const m of ep.marks ?? [])
    if (!marks.has(m.id)) out.push(`mark ${m.id} is never earned`);
  return out;
}

/** Minimal binary heap keyed by [priority, tiebreak]. */
class Heap {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  less(a, b) {
    return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  }
  push(item) {
    const h = this.items;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }
  pop() {
    const h = this.items;
    const top = h[0];
    const last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < h.length && this.less(h[l], h[m])) m = l;
        if (r < h.length && this.less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
}

/** Scene-graph distance from every scene to the nearest target scene. */
export function sceneDistances(ep, targets) {
  const reverse = {};
  for (const [id, s] of Object.entries(ep.scenes))
    for (const a of s.actions)
      for (const to of [
        a.effects?.to,
        a.check?.success?.effects?.to,
        a.check?.failure?.effects?.to,
      ])
        if (to && to !== "$return") (reverse[to] ??= []).push(id);
  for (const e of ep.events)
    if (e.effects?.to) for (const id of Object.keys(ep.scenes)) (reverse[e.effects.to] ??= []).push(id);
  const dist = {};
  const queue = [...targets];
  targets.forEach((t) => (dist[t] = 0));
  while (queue.length) {
    const id = queue.shift();
    for (const from of reverse[id] ?? [])
      if (dist[from] === undefined) {
        dist[from] = dist[id] + 1;
        queue.push(from);
      }
  }
  return dist;
}

/** Scenes that hold an action able to finish with `ending` (any ending if null). */
export function endingScenes(ep, ending = null) {
  return Object.entries(ep.scenes)
    .filter(([, s]) =>
      s.actions.some((a) =>
        [a.effects?.ending, a.check?.success?.effects?.ending, a.check?.failure?.effects?.ending].some(
          (e) => e && (ending === null || e === ending),
        ),
      ),
    )
    .map(([id]) => id);
}

/** Actions that can finish a run with `ending` (any ending if null). */
function endingGates(ep, ending) {
  const gates = [];
  for (const [scene, s] of Object.entries(ep.scenes))
    for (const a of s.actions)
      if (
        [a.effects?.ending, a.check?.success?.effects?.ending].some(
          (e) => e && (ending === null || e === ending),
        )
      )
        gates.push({ scene, action: a });
  return gates;
}

/** All-pairs scene distances over unconditioned transitions. */
function allDistances(ep) {
  const ids = Object.keys(ep.scenes);
  const next = Object.fromEntries(ids.map((id) => [id, new Set()]));
  for (const [id, sc] of Object.entries(ep.scenes))
    for (const a of sc.actions)
      for (const to of [a.effects?.to, a.check?.success?.effects?.to, a.check?.failure?.effects?.to])
        if (to && to !== "$return") next[id].add(to);
  // Interrupts can arrive from anywhere; treat them as one step away.
  for (const e of ep.events)
    if (e.interrupt) for (const id of ids) next[id].add(e.interrupt);
  const table = {};
  for (const origin of ids) {
    const d = { [origin]: 0 };
    const queue = [origin];
    while (queue.length) {
      const u = queue.shift();
      for (const v of next[u]) if (d[v] === undefined) (d[v] = d[u] + 1), queue.push(v);
    }
    table[origin] = d;
  }
  return table;
}

/** Scenes whose actions can grant each clue, flag, or item. */
function provenance(ep) {
  const sources = {};
  const add = (key, scene, need) => (sources[key] ??= []).push({ scene, need });
  const record = (effects, scene, need) => {
    if (!effects) return;
    for (const c of effects.clues ?? []) add(`clue:${c}`, scene, need);
    for (const f of Object.keys(effects.flags ?? {})) add(`flag:${f}`, scene, need);
    for (const i of effects.give ?? []) add(`item:${i}`, scene, need);
  };
  for (const [id, sc] of Object.entries(ep.scenes)) {
    for (const a of sc.actions) {
      const need = { all: [a.when, a.visible].filter(Boolean) };
      record(a.effects, id, need);
      record(a.check?.success?.effects, id, need);
      record(a.check?.failure?.effects, id, need);
    }
    if (sc.puzzle) {
      add(`flag:${sc.puzzle.solvedFlag}`, id, null);
      record(sc.puzzle.effects, id, null);
    }
  }
  return sources;
}

/**
 * How far a state is from satisfying a condition, in rough moves: each unmet
 * requirement costs the distance to the nearest scene that can provide it.
 * Used only as a search heuristic; it never decides what is legal.
 */
function shortfall(c, s, ep, ctx, depth = 0) {
  if (!c) return 0;
  if (c.all) return c.all.reduce((n, x) => n + shortfall(x, s, ep, ctx, depth), 0);
  if (c.any) return Math.min(...c.any.map((x) => shortfall(x, s, ep, ctx, depth)));
  if (c.not) return matches(c.not, s) ? 2 : 0;
  if (matches(c, s)) return 0;
  if (c.echo) return 1000;
  const here = s.returnScene ?? s.scene;
  // Distance to the cheapest provider, plus (to a limited depth) whatever
  // that provider itself still requires.
  const reach = (key) => {
    const from = ctx.dist[here] ?? {};
    let best = 25;
    for (const src of ctx.sources[key] ?? []) {
      const extra = depth < 2 && src.need ? shortfall(src.need, s, ep, ctx, depth + 1) : 0;
      best = Math.min(best, (from[src.scene] ?? 25) + extra);
    }
    return 1 + best;
  };
  if (c.deduction) {
    const d = (ep.deductions ?? []).find((x) => x.id === c.deduction);
    return 1 + (d ? d.from.filter((id) => !s.clues.includes(id)).reduce((n, id) => n + reach(`clue:${id}`), 0) : 0);
  }
  if (c.clue) return reach(`clue:${c.clue}`);
  if (c.flag) return reach(`flag:${c.flag}`);
  if (c.item) return reach(`item:${c.item}`);
  if (c.stat) {
    const v = s.stats[c.stat] ?? 0;
    return c.gte !== undefined && v < c.gte ? 2 * (c.gte - v) : 2;
  }
  if (c.count === "deductions" && c.gte !== undefined) {
    const costs = (ep.deductions ?? [])
      .filter((d) => !s.deductions.includes(d.id))
      .map((d) => shortfall({ deduction: d.id }, s, ep, ctx, depth))
      .sort((a, b) => a - b);
    return costs.slice(0, c.gte - s.deductions.length).reduce((a, b) => a + b, 0);
  }
  return 2;
}

/**
 * Weighted A* from a game state toward an ending. The heuristic combines
 * scene-graph distance to each gate with how many of the gate's requirements
 * are unmet. Complete within its budget; returns a witness path or null.
 */
export function search(
  ep,
  { from, echoes = [], ending = null, goal, need = null, budget = 100000, weight = 2 } = {},
) {
  const horizon = turnHorizon(ep);
  const cooldownCap = Math.max(1, ...ep.events.map((e) => e.cooldown ?? 1));
  const inert = inertEvents(ep);
  const done = goal ?? ((s) => Boolean(s.ending) && (ending === null || s.ending === ending));
  const gates = endingGates(ep, ending).map((g) => ({
    ...g,
    need: { all: [g.action.when, g.action.visible, need].filter(Boolean) },
  }));
  // Scene edges with the conditions of the action that walks them.
  const edges = [];
  for (const [id, sc] of Object.entries(ep.scenes))
    for (const a of sc.actions)
      for (const to of [a.effects?.to, a.check?.success?.effects?.to])
        if (to && to !== "$return")
          edges.push({ from: id, to, need: { all: [a.when, a.visible].filter(Boolean) } });
  const sceneIds = Object.keys(ep.scenes);
  const ctx = { dist: allDistances(ep), sources: provenance(ep) };
  const h = (s) => {
    // Dijkstra over scenes; an edge costs more while its action is locked.
    const cost = Object.fromEntries(sceneIds.map((id) => [id, Infinity]));
    const origin = ep.scenes[s.scene].actions.some((a) => a.effects?.to === "$return")
      ? (s.returnScene ?? s.scene)
      : s.scene;
    cost[origin] = 0;
    const open = new Set(sceneIds);
    while (open.size) {
      let u = null;
      for (const id of open) if (u === null || cost[id] < cost[u]) u = id;
      if (cost[u] === Infinity) break;
      open.delete(u);
      for (const e of edges)
        if (e.from === u) {
          const c = cost[u] + 1 + shortfall(e.need, s, ep, ctx);
          if (c < cost[e.to]) cost[e.to] = c;
        }
    }
    let best = 1e6;
    for (const g of gates) best = Math.min(best, cost[g.scene] + shortfall(g.need, s, ep, ctx));
    return best;
  };
  const start = from ? Game.fromState(ep, from.state ?? from) : new Game(ep, { echoes });
  const nodes = [{ parent: -1, via: null }];
  const seen = new Set([stateKey(start.state, horizon, cooldownCap, inert)]);
  const heap = new Heap();
  heap.push([weight * h(start.state), 0, 0, lean(structuredClone(start.state)), 0]);
  let expanded = 0;
  const path = (i) => {
    const steps = [];
    for (; i > 0; i = nodes[i].parent) steps.push(nodes[i].via);
    return steps.reverse();
  };
  while (heap.size && expanded < budget) {
    const [, , index, state, depth] = heap.pop();
    if (done(state)) return { path: path(index), expanded, state };
    if (state.ending) continue;
    expanded++;
    for (const move of moves(Game.fromState(ep, state))) {
      const g = Game.fromState(ep, state);
      g.unsafe = true;
      g.forceRoll = () => move.force ?? null;
      try {
        for (const step of move.steps) g.dispatch(step);
      } catch {
        continue;
      }
      const key = stateKey(g.state, horizon, cooldownCap, inert);
      if (seen.has(key)) continue;
      seen.add(key);
      nodes.push({ parent: index, via: move.label });
      const f = depth + 1 + weight * h(g.state);
      heap.push([f, nodes.length - 1, nodes.length - 1, lean(g.state), depth + 1]);
    }
  }
  return { path: null, expanded };
}

/** A witness path for every ending. Secret endings may use all echoes. */
export function endingWitnesses(ep, { budget = 200000 } = {}) {
  const allEchoes = Object.keys(ep.echoes ?? {});
  return Object.fromEntries(
    Object.entries(ep.endings).map(([id, e]) => {
      const echoes = e.secret ? allEchoes : [];
      const result = search(ep, { echoes, ending: id, budget });
      return [id, { echoes, path: result.path, expanded: result.expanded }];
    }),
  );
}
