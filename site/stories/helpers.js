// Content is declarative data. These helpers only reduce repeated authoring
// fields; every episode still exports a plain object the validator can read.
export const all = (...conditions) => ({ all: conditions });
export const any = (...conditions) => ({ any: conditions });
export const not = (c) => ({ not: c });
export const flag = (name) => ({ flag: name });
export const item = (name) => ({ item: name });
export const stat = (name, gte) => ({ stat: name, gte });
export const below = (name, lte) => ({ stat: name, lte });
export const theme = (name) => ({ theme: name });
export const clue = (name) => ({ clue: name });
export const deduced = (name) => ({ deduction: name });
export const echo = (name) => ({ echo: name });
export const ending = (name) => ({ ending: name });
export const scene = (name) => ({ scene: name });
export const always = { turn: 0 };

/** A scene action. */
export const A = (id, label, type, effects, text, extra = {}) => ({
  id,
  label,
  type,
  effects,
  text,
  ...extra,
});
export const go = (id, label, to, text, extra = {}) =>
  A(id, label, "TRAVEL", { to }, text, extra);
/** A free, one-time look that records a clue by ID. */
export const inspect = (id, label, clueId, text, { effects = {}, ...extra } = {}) =>
  A(
    id,
    label,
    "INSPECT",
    {
      ...effects,
      flags: { [id]: true, ...(effects.flags ?? {}) },
      clues: [clueId, ...(effects.clues ?? [])],
    },
    text,
    { visible: not(flag(id)), ...extra },
  );
/** An intentional, one-time pickup. */
export const take = (id, label, object, text, extra = {}) =>
  A(id, label, "TAKE_ITEM", { give: [object], flags: { [id]: true } }, text, {
    visible: not(flag(id)),
    ...extra,
  });

/**
 * A dice check: 2d6 + stat + modifiers against dc. Both outcomes move the
 * story; failure is a consequence, never a wall. Red checks happen once;
 * white checks can be retried after the odds improve.
 */
export const roll = (stat, dc, success, failure, extra = {}) => ({
  stat,
  dc,
  kind: extra.kind ?? "red",
  mods: extra.mods ?? [],
  success,
  failure,
  ...(extra.name ? { name: extra.name } : {}),
});
export const outcome = (text, effects = {}) => ({ text, effects });
export const mod = (label, value, when) => ({ label, value, when });
export const against = (name, label) => ({ stat: name, sign: -1, label });
/** A scene action resolved by a check. */
export const C = (id, label, type, check, extra = {}) => ({
  id,
  label,
  type,
  check,
  ...extra,
});

export const S = (title, kicker, text, actions, extra = {}) => ({
  title,
  kicker,
  text,
  actions,
  ...extra,
});
export const E = (id, when, text, effects = {}, extra = {}) => ({
  id,
  when,
  text,
  effects,
  ...extra,
});
export const source = (title, by, year, url, note, extra = {}) => ({
  title,
  by,
  year,
  url,
  note,
  rights:
    "Consulted edition: public domain in the USA. Original game adaptation; no source text or images reproduced.",
  checked: "18 October 2026",
  ...extra,
});
export const themes = (mystery, survival) => ({
  wonder: {
    name: "Wonder",
    icon: "✧",
    description: "Follow unexpected friendships and strange possibilities.",
    effect:
      "You leave room for unlikely help. Relationships now shape the road ahead.",
    effects: {},
  },
  mystery: {
    name: "Mystery",
    icon: "⌕",
    description: mystery.description,
    effect: mystery.effect,
    effects: mystery.effects ?? {},
  },
  survival: {
    name: "Survival",
    icon: "△",
    description: survival.description,
    effect: survival.effect,
    effects: survival.effects ?? {},
  },
});
/** Marks shared by every tale: careful reasoning is its own reward. */
export const thinkingMarks = (total) => [
  {
    id: "weaver",
    title: "Every thread",
    text: `Connect all ${total} deductions in one telling.`,
    when: { count: "deductions", gte: total },
  },
  {
    id: "clear",
    title: "Clear thinking",
    text: "Make at least two deductions without a single wrong link.",
    when: all({ count: "deductions", gte: 2 }, { count: "wrongLinks", lte: 0 }),
  },
];
