export const SAVE_VERSION = 1;
export const ACTION_TYPES = new Set([
  "TRAVEL",
  "INSPECT",
  "TAKE_ITEM",
  "USE_ITEM",
  "TALK",
  "BARGAIN",
  "SOLVE",
  "WAIT",
  "CHOOSE",
]);
const copy = (value) => structuredClone(value);

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
  if (c.turn !== undefined) return s.turn >= c.turn;
  if (c.stat) {
    const value = s.stats[c.stat] ?? 0;
    return (
      (c.gte === undefined || value >= c.gte) &&
      (c.lte === undefined || value <= c.lte)
    );
  }
  throw new Error("Unknown story condition");
}

export class Game {
  constructor(episode) {
    this.episode = episode;
    this.state = {
      scene: episode.start,
      inventory: [],
      flags: {},
      stats: copy(episode.initialStats),
      theme: "wonder",
      turn: 0,
      visited: [],
      clues: [],
      fired: [],
      scheduled: [],
      log: [],
      actions: [],
      puzzle: [],
      ending: null,
      returnScene: null,
      checkpoint: null,
    };
    this.enter(episode.start);
    this.record("world", episode.opening);
    this.evaluateTriggers({ type: "START" });
    this.processQueue();
  }
  record(kind, text) {
    if (text) this.state.log.push({ kind, text, turn: this.state.turn });
  }
  enter(id) {
    if (!this.episode.scenes[id]) throw new Error(`Unknown scene: ${id}`);
    this.state.scene = id;
    this.state.puzzle = [];
    if (!this.state.visited.includes(id)) this.state.visited.push(id);
    // Dispatch records its action before applying a scene transition.
    if (this.episode.scenes[id].checkpoint)
      this.state.checkpoint = {
        scene: id,
        actionCount: this.state.actions.length,
      };
  }
  availableActions() {
    if (this.state.ending) return [];
    const scene = this.episode.scenes[this.state.scene];
    return scene.actions
      .filter((a) => matches(a.visible, this.state))
      .map((a) => ({
        ...a,
        enabled:
          matches(a.when, this.state) &&
          (!scene.puzzle ||
            this.state.flags[scene.puzzle.solvedFlag] ||
            a.type !== "SOLVE"),
      }));
  }
  apply(e = {}) {
    const s = this.state;
    for (const id of e.remove ?? [])
      s.inventory = s.inventory.filter((x) => x !== id);
    for (const id of e.give ?? [])
      if (!s.inventory.includes(id)) s.inventory.push(id);
    Object.assign(s.flags, e.flags ?? {});
    for (const [key, delta] of Object.entries(e.stats ?? {}))
      s.stats[key] = Math.max(0, Math.min(10, (s.stats[key] ?? 0) + delta));
    for (const clue of e.clues ?? [])
      if (!s.clues.includes(clue)) s.clues.push(clue);
    if (e.objective) s.flags.objective = e.objective;
    if (e.to === "$return") {
      const id = s.returnScene;
      s.returnScene = null;
      this.enter(id);
    } else if (e.to) this.enter(e.to);
    if (e.ending) {
      s.ending = e.ending;
      s.scheduled = [];
      this.record("ending", this.episode.endings[e.ending].title);
    }
  }
  evaluateTriggers(signal) {
    for (const e of this.episode.events) {
      if (
        this.state.fired.includes(e.id) ||
        this.state.scheduled.some((q) => q.id === e.id)
      )
        continue;
      if (e.on && e.on !== signal.type && e.on !== "*") continue;
      if (!matches(e.when, this.state)) continue;
      this.state.scheduled.push({
        id: e.id,
        at: this.state.turn + (e.delay ?? 0),
        priority: e.priority ?? 0,
      });
    }
  }
  processQueue() {
    let count = 0;
    while (!this.state.ending) {
      if (this.state.returnScene) return;
      const due = this.state.scheduled
        .filter((q) => q.at <= this.state.turn)
        .sort(
          (a, b) =>
            b.priority - a.priority || a.at - b.at || a.id.localeCompare(b.id),
        );
      if (!due.length) return;
      if (++count > 64) throw new Error("Story event loop exceeded its limit");
      const next = due[0];
      this.state.scheduled = this.state.scheduled.filter(
        (q) => q.id !== next.id,
      );
      const e = this.episode.events.find((x) => x.id === next.id);
      this.state.fired.push(e.id);
      this.record(e.interrupt ? "encounter" : "world", e.text);
      this.apply(e.effects);
      if (e.interrupt && !this.state.ending) {
        this.state.returnScene = this.state.scene;
        this.enter(e.interrupt);
      }
      this.evaluateTriggers({ type: "EVENT" });
    }
  }
  dispatch(command) {
    if (this.state.ending) throw new Error("This journey has ended");
    if (
      !command ||
      typeof command.type !== "string" ||
      (command.type !== "CLEAR_PUZZLE" && typeof command.id !== "string")
    )
      throw new Error("This action could not be read");
    const previous = copy(this.state);
    try {
      if (command.type === "PUZZLE") return this.puzzleStep(command);
      if (command.type === "CLEAR_PUZZLE") {
        if (!this.episode.scenes[this.state.scene].puzzle)
          throw new Error("No puzzle here");
        this.state.puzzle = [];
        this.state.actions.push(copy(command));
        return this.view();
      }
      this.state.actions.push(copy(command));
      if (command.type === "SHIFT_THEME") {
        const theme = this.episode.themes[command.id];
        if (!theme || this.state.flags.themeShifted || this.state.returnScene)
          throw new Error("The tale cannot shift here");
        this.state.theme = command.id;
        this.state.flags.themeShifted = true;
        this.state.turn++;
        this.record(
          "action",
          `The tale turns toward ${theme.name.toLowerCase()}.`,
        );
        this.record("consequence", theme.effect);
        this.apply(theme.effects);
      } else if (command.type === "COMBINE") {
        const r = this.episode.recipes?.find((x) => x.id === command.id);
        if (
          !r ||
          !r.ingredients.every((id) => this.state.inventory.includes(id))
        )
          throw new Error("Missing materials");
        this.state.turn++;
        this.apply({ remove: r.ingredients, give: [r.result] });
        this.record("action", r.label);
        this.record("consequence", r.text);
      } else {
        const a = this.availableActions().find(
          (x) => x.id === command.id && x.type === command.type,
        );
        if (!a?.enabled) throw new Error("That action is not available");
        this.state.turn += a.cost ?? (a.type === "INSPECT" ? 0 : 1);
        this.record("action", a.label);
        this.apply(a.effects);
        this.record("consequence", a.text);
      }
      this.evaluateTriggers(command);
      this.processQueue();
      return this.view();
    } catch (error) {
      this.state = previous;
      throw error;
    }
  }
  puzzleStep(command) {
    const p = this.episode.scenes[this.state.scene].puzzle;
    if (
      !p ||
      this.state.flags[p.solvedFlag] ||
      !p.options.some((o) => o.id === command.id)
    )
      throw new Error("That puzzle action is not available");
    this.state.puzzle.push(command.id);
    this.state.actions.push(copy(command));
    if (this.state.puzzle.length === p.solution.length) {
      this.state.turn++;
      this.record("action", p.prompt);
      if (this.state.puzzle.every((id, i) => id === p.solution[i])) {
        this.state.flags[p.solvedFlag] = true;
        this.apply(p.effects);
        this.record("consequence", p.success);
      } else {
        this.state.puzzle = [];
        this.apply(p.failureEffects);
        this.record("consequence", p.failure);
      }
      this.evaluateTriggers({ type: "SOLVE" });
      this.processQueue();
    }
    return this.view();
  }
  view() {
    const s = this.state,
      scene = this.episode.scenes[s.scene];
    return {
      ...copy(s),
      title: scene.title,
      kicker: scene.kicker,
      description: scene.text,
      variant: (scene.variants ?? [])
        .filter((v) => matches(v.when, s))
        .map((v) => v.text)
        .join(" "),
      objective: s.flags.objective || this.episode.objective,
      actions: this.availableActions(),
      sceneArt: scene.art ?? this.episode.id,
      inventoryItems: s.inventory.map((id) => ({
        id,
        ...this.episode.items[id],
      })),
      recipes: (this.episode.recipes ?? []).filter((r) =>
        r.ingredients.every((id) => s.inventory.includes(id)),
      ),
      encounter: Boolean(s.returnScene),
      puzzleData: scene.puzzle,
      endingData: s.ending ? this.episode.endings[s.ending] : null,
    };
  }
  save() {
    return {
      version: SAVE_VERSION,
      episodeId: this.episode.id,
      revision: this.episode.revision,
      actions: copy(this.state.actions),
      savedAt: new Date().toISOString(),
    };
  }
  static load(episode, save) {
    if (
      save?.version !== SAVE_VERSION ||
      save.episodeId !== episode.id ||
      save.revision !== episode.revision
    )
      throw new Error(
        "This save belongs to a different story edition. Start a new journey.",
      );
    if (!Array.isArray(save.actions) || save.actions.length > 3000)
      throw new Error("This save could not be read");
    const game = new Game(episode);
    for (const command of save.actions) game.dispatch(command);
    return game;
  }
  rewind() {
    const count = this.state.checkpoint?.actionCount;
    if (count === undefined)
      throw new Error("No checkpoint has been discovered yet");
    return Game.load(this.episode, {
      ...this.save(),
      actions: this.state.actions.slice(0, count),
    });
  }
}

export function validateEpisode(ep) {
  const errors = [],
    check = (ok, text) => {
      if (!ok) errors.push(`${ep.id}: ${text}`);
    };
  check(ep.version === 1, "unknown episode schema");
  check(Boolean(ep.scenes[ep.start]), "missing start");
  const condition = (c) => {
    if (!c) return;
    if (c.all || c.any) return (c.all || c.any).forEach(condition);
    if (c.not) return condition(c.not);
    check(
      [
        "item",
        "flag",
        "scene",
        "theme",
        "visited",
        "event",
        "turn",
        "stat",
      ].some((k) => k in c),
      "unknown condition",
    );
    if (c.item) check(Boolean(ep.items[c.item]), `unknown item ${c.item}`);
    if (c.scene || c.visited)
      check(
        Boolean(ep.scenes[c.scene || c.visited]),
        "unknown scene condition",
      );
    if (c.theme) check(Boolean(ep.themes[c.theme]), "unknown theme");
    if (c.stat) check(c.stat in ep.initialStats, `unknown stat ${c.stat}`);
    if (c.event)
      check(
        ep.events.some((e) => e.id === c.event),
        `unknown event ${c.event}`,
      );
  };
  const effect = (e) => {
    if (!e) return;
    check(
      Object.keys(e).every((k) =>
        [
          "to",
          "give",
          "remove",
          "flags",
          "stats",
          "clues",
          "objective",
          "ending",
        ].includes(k),
      ),
      "unknown effect",
    );
    if (e.to)
      check(
        e.to === "$return" || Boolean(ep.scenes[e.to]),
        `unknown destination ${e.to}`,
      );
    for (const id of [...(e.give ?? []), ...(e.remove ?? [])])
      check(Boolean(ep.items[id]), `unknown item ${id}`);
    if (e.ending)
      check(Boolean(ep.endings[e.ending]), `unknown ending ${e.ending}`);
    for (const key of Object.keys(e.stats ?? {}))
      check(key in ep.initialStats, `unknown stat effect ${key}`);
  };
  for (const [id, s] of Object.entries(ep.scenes)) {
    const ids = new Set();
    check(s.actions.length > 0, `${id} has no way out`);
    for (const a of s.actions) {
      check(!ids.has(a.id), `duplicate action ${id}/${a.id}`);
      ids.add(a.id);
      check(ACTION_TYPES.has(a.type), `unknown action type ${a.type}`);
      condition(a.when);
      condition(a.visible);
      effect(a.effects);
    }
    s.variants?.forEach((v) => condition(v.when));
    if (s.puzzle) {
      const p = s.puzzle;
      check(
        p.solution.length > 0 &&
          p.solution.every((id) => p.options.some((o) => o.id === id)),
        `${id}: invalid puzzle`,
      );
      effect(p.effects);
      effect(p.failureEffects);
    }
  }
  const ids = new Set();
  for (const e of ep.events) {
    check(!ids.has(e.id), `duplicate event ${e.id}`);
    ids.add(e.id);
    check(Boolean(e.when || e.on), `unconditional event ${e.id}`);
    if (e.on)
      check(
        ACTION_TYPES.has(e.on) ||
          ["START", "EVENT", "*", "SHIFT_THEME", "COMBINE"].includes(e.on),
        `unknown trigger ${e.on}`,
      );
    if (e.interrupt)
      check(
        Boolean(ep.scenes[e.interrupt]),
        `unknown interrupt ${e.interrupt}`,
      );
    check((e.delay ?? 0) >= 0, "negative delay");
    condition(e.when);
    effect(e.effects);
  }
  for (const t of Object.values(ep.themes)) effect(t.effects);
  for (const r of ep.recipes ?? [])
    for (const id of [...r.ingredients, r.result])
      check(Boolean(ep.items[id]), `unknown recipe item ${id}`);
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
      ep.scenes[id]?.actions.forEach((a) => add(a.effects?.to));
    for (const e of ep.events)
      if (!e.when?.scene || reachable.has(e.when.scene)) {
        add(e.interrupt);
        add(e.effects?.to);
      }
  }
  for (const id of Object.keys(ep.scenes))
    check(reachable.has(id), `unreachable scene ${id}`);
  return errors;
}
