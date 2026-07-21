import { CONDITION_KEYS, COUNTABLE, eachLeaf, refersTo } from "./conditions.js";
import {
  ACTION_TYPES,
  EVENT_SIGNALS,
  SCHEMA_VERSION,
  destinations,
} from "./game.js";

const EFFECT_KEYS = [
  "to",
  "give",
  "remove",
  "flags",
  "stats",
  "clues",
  "objective",
  "ending",
];
export const WEATHER = [
  "none",
  "rain",
  "storm",
  "mist",
  "bubbles",
  "fireflies",
  "leaves",
  "dust",
  "lanterns",
  "stars",
];
export const LIGHT = ["dawn", "day", "dusk", "night", "deep", "moon"];
export const AMBIENCE = [
  "none",
  "market",
  "forest",
  "river",
  "rain",
  "sea",
  "underwater",
  "hall",
  "wind",
  "night",
  "court",
];

/**
 * Structural validation run on every build. Returns a list of errors; an
 * empty list means every reference resolves and every rule is well formed.
 * Behavioural guarantees (no soft-locks, every ending reachable) are proven
 * separately by the state-space explorer in explore.js.
 */
export function validateEpisode(ep) {
  const errors = [],
    check = (ok, text) => {
      if (!ok) errors.push(`${ep.id}: ${text}`);
    };
  check(ep.version === SCHEMA_VERSION, "unknown episode schema");
  check(Number.isInteger(ep.revision) && ep.revision >= 1, "invalid revision");
  check(Boolean(ep.scenes[ep.start]), "missing start");
  check(
    Boolean(ep.themes[ep.startTheme ?? "wonder"]),
    "missing starting theme",
  );
  const clues = ep.clues ?? {};
  const echoes = ep.echoes ?? {};
  const deductions = ep.deductions ?? [];
  const usedEchoes = new Set();
  const givenClues = new Set();
  const givenItems = new Set();
  const reachedEndings = new Set();

  const condition = (c) =>
    eachLeaf(c, (leaf) => {
      check(
        CONDITION_KEYS.some((k) => k in leaf),
        `unknown condition ${JSON.stringify(leaf)}`,
      );
      if (leaf.item) check(Boolean(ep.items[leaf.item]), `unknown item ${leaf.item}`);
      if (leaf.scene || leaf.visited)
        check(
          Boolean(ep.scenes[leaf.scene || leaf.visited]),
          "unknown scene condition",
        );
      if (leaf.theme) check(Boolean(ep.themes[leaf.theme]), "unknown theme");
      if (leaf.stat)
        check(leaf.stat in ep.initialStats, `unknown stat ${leaf.stat}`);
      if (leaf.event)
        check(
          ep.events.some((e) => e.id === leaf.event),
          `unknown event ${leaf.event}`,
        );
      if (leaf.clue) check(leaf.clue in clues, `unknown clue ${leaf.clue}`);
      if (leaf.deduction)
        check(
          deductions.some((d) => d.id === leaf.deduction),
          `unknown deduction ${leaf.deduction}`,
        );
      if (leaf.echo) {
        check(leaf.echo in echoes, `unknown echo ${leaf.echo}`);
        usedEchoes.add(leaf.echo);
      }
      if (leaf.ending)
        check(Boolean(ep.endings[leaf.ending]), `unknown ending ${leaf.ending}`);
      if (leaf.count)
        check(COUNTABLE.includes(leaf.count), `unknown count ${leaf.count}`);
    });
  const effect = (e, where) => {
    if (!e) return;
    check(
      Object.keys(e).every((k) => EFFECT_KEYS.includes(k)),
      `unknown effect in ${where}`,
    );
    if (e.to)
      check(
        e.to === "$return" || Boolean(ep.scenes[e.to]),
        `unknown destination ${e.to}`,
      );
    for (const id of [...(e.give ?? []), ...(e.remove ?? [])])
      check(Boolean(ep.items[id]), `unknown item ${id}`);
    for (const id of e.give ?? []) givenItems.add(id);
    for (const id of e.clues ?? []) {
      check(id in clues, `unknown clue ${id} in ${where}`);
      givenClues.add(id);
    }
    if (e.ending) {
      check(Boolean(ep.endings[e.ending]), `unknown ending ${e.ending}`);
      reachedEndings.add(e.ending);
    }
    for (const key of Object.keys(e.stats ?? {}))
      check(key in ep.initialStats, `unknown stat effect ${key}`);
  };
  const checkRule = (c, where) => {
    check(
      Number.isInteger(c.dc) && c.dc >= 2 && c.dc <= 20,
      `${where}: check difficulty must be 2–20`,
    );
    check(["red", "white", undefined].includes(c.kind), `${where}: check kind`);
    if (c.stat) check(c.stat in ep.initialStats, `${where}: unknown check stat`);
    else check(Boolean(c.name), `${where}: a check without a stat needs a name`);
    for (const m of c.mods ?? []) {
      if (m.stat) check(m.stat in ep.initialStats, `${where}: unknown mod stat`);
      else {
        check(
          Boolean(m.label) && Number.isInteger(m.value) && Boolean(m.when),
          `${where}: modifier needs label, integer value and condition`,
        );
        condition(m.when);
      }
    }
    for (const side of ["success", "failure"]) {
      check(
        Boolean(c[side]?.text),
        `${where}: check needs ${side} text (fail forward)`,
      );
      effect(c[side]?.effects, `${where}/${side}`);
    }
  };

  for (const [id, s] of Object.entries(ep.scenes)) {
    const ids = new Set();
    check(s.actions.length > 0, `${id} has no way out`);
    if (s.map)
      check(
        s.map.length === 2 && s.map.every((n) => n >= 0 && n <= 100),
        `${id}: map position must be two numbers 0–100`,
      );
    if (s.weather) check(WEATHER.includes(s.weather), `${id}: weather`);
    if (s.light) check(LIGHT.includes(s.light), `${id}: light`);
    if (s.ambience) check(AMBIENCE.includes(s.ambience), `${id}: ambience`);
    for (const a of s.actions) {
      const where = `${id}/${a.id}`;
      check(!ids.has(a.id), `duplicate action ${where}`);
      ids.add(a.id);
      check(ACTION_TYPES.has(a.type), `unknown action type ${a.type}`);
      check(Boolean(a.label), `${where}: missing label`);
      check(Boolean(a.text) || Boolean(a.check), `${where}: missing outcome text`);
      condition(a.when);
      condition(a.visible);
      effect(a.effects, where);
      if (a.uses) check(Boolean(ep.items[a.uses]), `${where}: uses unknown item`);
      if (a.check) checkRule(a.check, where);
      if (a.when)
        check(
          Boolean(a.requires),
          `${where}: conditional action needs a player-facing 'requires'`,
        );
    }
    s.variants?.forEach((v) => condition(v.when));
    if (s.puzzle) {
      const p = s.puzzle;
      check(
        p.solution.length > 0 &&
          p.solution.every((x) => p.options.some((o) => o.id === x)),
        `${id}: invalid puzzle`,
      );
      check(
        new Set(p.options.map((o) => o.id)).size === p.options.length,
        `${id}: duplicate puzzle option`,
      );
      effect(p.effects, `${id}/puzzle`);
      effect(p.failureEffects, `${id}/puzzle`);
    }
  }

  const eventIds = new Set();
  for (const e of ep.events) {
    check(!eventIds.has(e.id), `duplicate event ${e.id}`);
    eventIds.add(e.id);
    check(Boolean(e.when || e.on), `unconditional event ${e.id}`);
    if (e.on) check(EVENT_SIGNALS.has(e.on), `unknown trigger ${e.on}`);
    if (e.interrupt)
      check(Boolean(ep.scenes[e.interrupt]), `unknown interrupt ${e.interrupt}`);
    check((e.delay ?? 0) >= 0, "negative delay");
    check(
      Number.isInteger(e.maxRuns ?? 1) &&
        (e.maxRuns ?? 1) >= 1 &&
        (e.maxRuns ?? 1) <= 20,
      `invalid repeat limit ${e.id}`,
    );
    if ((e.maxRuns ?? 1) > 1)
      check(
        Number.isInteger(e.cooldown) && e.cooldown >= 1,
        `repeat event ${e.id} needs a positive cooldown`,
      );
    condition(e.when);
    effect(e.effects, `event ${e.id}`);
  }
  for (const t of Object.values(ep.themes)) effect(t.effects, "theme");
  for (const recap of ep.recaps ?? []) condition(recap.when);
  for (const r of ep.recipes ?? []) {
    for (const id of [...r.ingredients, r.result])
      check(Boolean(ep.items[id]), `unknown recipe item ${id}`);
    givenItems.add(r.result);
  }

  // Clues, deductions, and cross-run echoes.
  for (const [id, text] of Object.entries(clues)) {
    check(typeof text === "string" && text.length > 0, `clue ${id} has no text`);
  }
  const deductionIds = new Set();
  for (const d of deductions) {
    check(!deductionIds.has(d.id), `duplicate deduction ${d.id}`);
    deductionIds.add(d.id);
    check(
      Array.isArray(d.from) && d.from.length === 2 && d.from[0] !== d.from[1],
      `deduction ${d.id} must connect two different clues`,
    );
    for (const c of d.from ?? []) check(c in clues, `deduction ${d.id}: unknown clue ${c}`);
    check(Boolean(d.title && d.text), `deduction ${d.id} needs title and text`);
    effect(d.effects, `deduction ${d.id}`);
  }
  const pairs = deductions.map((d) => [...d.from].sort().join("+"));
  check(new Set(pairs).size === pairs.length, "two deductions share a clue pair");
  for (const [id, echo] of Object.entries(echoes)) {
    check(Boolean(echo.title && echo.text), `echo ${id} needs title and text`);
    check(Boolean(echo.from), `echo ${id} needs an earning condition`);
    condition(echo.from);
  }
  for (const m of ep.marks ?? []) {
    check(Boolean(m.id && m.title && m.text), "mark needs id, title, text");
    condition(m.when);
  }
  check(
    new Set((ep.marks ?? []).map((m) => m.id)).size === (ep.marks ?? []).length,
    "duplicate mark",
  );
  for (const [id, c] of Object.entries(ep.characters ?? {})) {
    check(Boolean(c.name && c.met), `character ${id} needs a name and met condition`);
    condition(c.met);
    for (const n of c.notes ?? []) condition(n.when);
    if (c.stat) check(c.stat in ep.initialStats, `character ${id}: unknown stat`);
  }
  for (const rule of ep.atmosphere ?? []) {
    condition(rule.when);
    if (rule.weather) check(WEATHER.includes(rule.weather), "atmosphere weather");
    if (rule.light) check(LIGHT.includes(rule.light), "atmosphere light");
    if (rule.ambience) check(AMBIENCE.includes(rule.ambience), "atmosphere ambience");
  }

  // Content that can never matter is a bug, not a flourish.
  for (const id of Object.keys(clues))
    check(givenClues.has(id), `clue ${id} is never discovered`);
  for (const id of Object.keys(ep.items))
    check(givenItems.has(id), `item ${id} is never obtainable`);
  for (const id of Object.keys(echoes))
    check(usedEchoes.has(id), `echo ${id} unlocks nothing`);
  for (const id of Object.keys(ep.endings))
    check(reachedEndings.has(id), `ending ${id} is never reached`);
  for (const [id, ending] of Object.entries(ep.endings)) {
    if (!ending.secret) continue;
    const gates = Object.values(ep.scenes).flatMap((s) =>
      s.actions.filter(
        (a) =>
          a.effects?.ending === id ||
          a.check?.success?.effects?.ending === id,
      ),
    );
    check(
      gates.length > 0 &&
        gates.every((a) => refersTo(a.when, "echo") || refersTo(a.visible, "echo")),
      `secret ending ${id} must be gated by a remembered echo`,
    );
  }

  // Static reachability over every authored transition.
  const reachable = new Set([ep.start]);
  let changed = true;
  while (changed) {
    changed = false;
    const add = (id) => {
      if (id && id !== "$return" && !reachable.has(id)) {
        reachable.add(id);
        changed = true;
      }
    };
    for (const id of reachable)
      ep.scenes[id]?.actions.forEach((a) => destinations(a).forEach(add));
    for (const e of ep.events)
      if (!e.when?.scene || reachable.has(e.when.scene)) {
        add(e.interrupt);
        add(e.effects?.to);
      }
    for (const d of deductions) add(d.effects?.to);
  }
  for (const id of Object.keys(ep.scenes))
    check(reachable.has(id), `unreachable scene ${id}`);
  return errors;
}
