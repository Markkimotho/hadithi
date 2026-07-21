// The declarative condition vocabulary shared by actions, events, variants,
// recaps, marks, echoes, characters, and atmosphere rules.

export const CONDITION_KEYS = [
  "item",
  "flag",
  "scene",
  "theme",
  "visited",
  "event",
  "turn",
  "stat",
  "clue",
  "deduction",
  "echo",
  "ending",
  "count",
  "check",
];
export const COUNTABLE = [
  "turn",
  "inventory",
  "clues",
  "deductions",
  "wrongLinks",
  "visited",
  "items",
  "checksPassed",
  "checksFailed",
];

const within = (value, c) =>
  (c.gte === undefined || value >= c.gte) &&
  (c.lte === undefined || value <= c.lte);

export function countOf(name, s) {
  switch (name) {
    case "turn":
      return s.turn;
    case "inventory":
      return s.inventory.length;
    case "items":
      return s.taken?.length ?? 0;
    case "wrongLinks":
      return s.wrongLinks ?? 0;
    case "checksPassed":
      return Object.values(s.checks ?? {}).filter((x) => x.passed).length;
    case "checksFailed":
      return Object.values(s.checks ?? {}).reduce(
        (n, x) => n + (x.failures ?? 0),
        0,
      );
    default:
      return s[name]?.length ?? 0;
  }
}

export function matches(c, s) {
  if (!c) return true;
  if (c.all) return c.all.every((x) => matches(x, s));
  if (c.any) return c.any.some((x) => matches(x, s));
  if (c.not) return !matches(c.not, s);
  if (c.item) return s.inventory.includes(c.item);
  if (c.flag) return Boolean(s.flags[c.flag]);
  if (c.scene) return s.scene === c.scene;
  if (c.theme) return s.theme === c.theme;
  if (c.visited) return s.visited.includes(c.visited);
  if (c.event) return s.fired.includes(c.event);
  if (c.clue) return s.clues.includes(c.clue);
  if (c.deduction) return (s.deductions ?? []).includes(c.deduction);
  if (c.echo) return (s.echoes ?? []).includes(c.echo);
  if (c.ending) return s.ending === c.ending;
  if (c.check) {
    const record = s.checks?.[c.check];
    if (c.passed !== undefined) return Boolean(record?.passed) === c.passed;
    return Boolean(record?.attempts);
  }
  if (c.turn !== undefined) return s.turn >= c.turn;
  if (c.stat) return within(s.stats[c.stat] ?? 0, c);
  if (c.count) return within(countOf(c.count, s), c);
  throw new Error("Unknown story condition");
}

/** True when a condition tree mentions a key, e.g. refersTo(c, "echo"). */
export function refersTo(c, key) {
  if (!c) return false;
  if (c.all || c.any) return (c.all || c.any).some((x) => refersTo(x, key));
  if (c.not) return refersTo(c.not, key);
  return key in c;
}

/** Visit every leaf condition, used by validation. */
export function eachLeaf(c, visit) {
  if (!c) return;
  if (c.all || c.any) return (c.all || c.any).forEach((x) => eachLeaf(x, visit));
  if (c.not) return eachLeaf(c.not, visit);
  visit(c);
}
