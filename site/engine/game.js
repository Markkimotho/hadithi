import { matches, refersTo } from "./conditions.js";
import { rollFor, checkOdds, checkSucceeds, hash32 } from "./rng.js";

export const SAVE_VERSION = 2;
export const SCHEMA_VERSION = 2;
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
/** Commands that are not scene actions. */
export const SYSTEM_COMMANDS = new Set([
  "PUZZLE",
  "CLEAR_PUZZLE",
  "SHIFT_THEME",
  "COMBINE",
  "DEDUCE",
]);
export const EVENT_SIGNALS = new Set([
  ...ACTION_TYPES,
  ...SYSTEM_COMMANDS,
  "START",
  "EVENT",
  "*",
]);
export const MAX_SAVE_ACTIONS = 3000;
export const ASSIST_BONUS = 2;

const copy = (value) => structuredClone(value);
const sameSet = (a, b) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** Every journey without an explicit seed uses the same per-episode seed. */
export const defaultSeed = (episode) => hash32(`hadithi:${episode.id}`);

/** Where an action's effects (or either check outcome) can send the player. */
export function destinations(action) {
  return [
    action.effects?.to,
    action.check?.success?.effects?.to,
    action.check?.failure?.effects?.to,
  ].filter((to) => to && to !== "$return");
}

export class Game {
  constructor(episode, options = {}) {
    this.episode = episode;
    this.forceRoll = null; // Explorer hook: (key) => true | false | null.
    this.unsafe = false; // Explorer hook: skip rollback copies.
    const known = episode.echoes ?? {};
    this.state = {
      scene: episode.start,
      inventory: [],
      taken: [],
      flags: {},
      stats: copy(episode.initialStats),
      theme: episode.startTheme ?? "wonder",
      turn: 0,
      visited: [],
      clues: [],
      deductions: [],
      wrongLinks: 0,
      checks: {},
      lastRoll: null,
      fired: [],
      eventRuns: {},
      lastFired: {},
      scheduled: [],
      log: [],
      actions: [],
      puzzle: [],
      ending: null,
      earnedEchoes: [],
      marks: [],
      returnScene: null,
      checkpoint: null,
      seed: (options.seed ?? defaultSeed(episode)) >>> 0,
      echoes: [...new Set(options.echoes ?? [])]
        .filter((id) => Object.hasOwn(known, id))
        .sort(),
      assist: Boolean(options.assist),
    };
    this.enter(episode.start);
    this.record("world", episode.opening);
    this.evaluateTriggers({ type: "START" });
    this.processQueue();
  }

  /** Rebuild a game from a trusted in-memory state (explorer and tests). */
  static fromState(episode, state) {
    const game = Object.create(Game.prototype);
    game.episode = episode;
    game.forceRoll = null;
    game.unsafe = false;
    game.state = copy(state);
    return game;
  }

  record(kind, text, extra) {
    if (text)
      this.state.log.push({ kind, text, turn: this.state.turn, ...extra });
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

  checkKey(action) {
    return `${this.state.scene}/${action.id}`;
  }

  /** Itemized bonus for a check in the current state. */
  checkBonus(check) {
    const s = this.state,
      labels = this.episode.statLabels;
    const parts = [];
    if (check.stat)
      parts.push({ label: labels[check.stat], value: s.stats[check.stat] ?? 0 });
    for (const m of check.mods ?? []) {
      if (m.stat) {
        const value = (m.sign ?? 1) * (s.stats[m.stat] ?? 0);
        if (value) parts.push({ label: m.label ?? labels[m.stat], value });
      } else if (matches(m.when, s)) parts.push({ label: m.label, value: m.value });
    }
    if (s.assist) parts.push({ label: "Storyteller’s grace", value: ASSIST_BONUS });
    return { bonus: parts.reduce((n, p) => n + p.value, 0), parts };
  }

  availableActions() {
    if (this.state.ending) return [];
    const s = this.state,
      scene = this.episode.scenes[s.scene];
    const result = [];
    for (const a of scene.actions) {
      if (!matches(a.visible, s)) continue;
      const view = {
        ...a,
        remembered: refersTo(a.visible, "echo") || refersTo(a.when, "echo"),
      };
      let enabled =
        matches(a.when, s) &&
        (!scene.puzzle || s.flags[scene.puzzle.solvedFlag] || a.type !== "SOLVE");
      if (a.check) {
        const record = s.checks[this.checkKey(a)];
        // A passed check is spent; a failed red check cannot be retried.
        if (record?.passed) continue;
        if (record?.attempts && a.check.kind !== "white") continue;
        const { bonus, parts } = this.checkBonus(a.check);
        const retryBlocked = Boolean(record?.attempts) && bonus <= record.bonus;
        if (retryBlocked) {
          enabled = false;
          view.requires = "Improve your odds to try again";
        }
        view.odds = {
          kind: a.check.kind ?? "red",
          stat: a.check.stat ?? null,
          dc: a.check.dc,
          bonus,
          parts,
          chance: checkOdds(bonus, a.check.dc),
          attempts: record?.attempts ?? 0,
        };
      }
      view.enabled = enabled;
      result.push(view);
    }
    return result;
  }

  apply(e = {}) {
    const s = this.state;
    for (const id of e.remove ?? [])
      s.inventory = s.inventory.filter((x) => x !== id);
    for (const id of e.give ?? []) {
      if (!s.inventory.includes(id)) s.inventory.push(id);
      if (!s.taken.includes(id)) s.taken.push(id);
    }
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
    if (e.ending) this.finish(e.ending);
  }

  finish(id) {
    const s = this.state,
      ep = this.episode;
    s.ending = id;
    s.scheduled = [];
    s.returnScene = null;
    this.record("ending", ep.endings[id].title);
    s.earnedEchoes = Object.entries(ep.echoes ?? {})
      .filter(([, echo]) => matches(echo.from, s))
      .map(([echoId]) => echoId);
    s.marks = (ep.marks ?? []).filter((m) => matches(m.when, s)).map((m) => m.id);
  }

  evaluateTriggers(signal) {
    for (const e of this.episode.events) {
      if (
        (this.state.eventRuns[e.id] ?? 0) >= (e.maxRuns ?? 1) ||
        this.state.scheduled.some((q) => q.id === e.id)
      )
        continue;
      if (
        this.state.lastFired[e.id] !== undefined &&
        this.state.turn - this.state.lastFired[e.id] < (e.cooldown ?? 1)
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
      // An event can be queued with a delay; recheck its guard when it lands.
      if (e.recheck && !matches(e.when, this.state)) continue;
      if (!this.state.fired.includes(e.id)) this.state.fired.push(e.id);
      this.state.eventRuns[e.id] = (this.state.eventRuns[e.id] ?? 0) + 1;
      this.state.lastFired[e.id] = this.state.turn;
      this.record(e.interrupt ? "encounter" : "world", e.text, {
        event: e.id,
      });
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
    if (!command || typeof command.type !== "string")
      throw new Error("This action could not be read");
    if (command.type === "DEDUCE") {
      if (
        !Array.isArray(command.ids) ||
        command.ids.length !== 2 ||
        !command.ids.every((id) => typeof id === "string")
      )
        throw new Error("This action could not be read");
    } else if (command.type !== "CLEAR_PUZZLE" && typeof command.id !== "string")
      throw new Error("This action could not be read");
    // Explorer mode discards a failed game, so it skips the rollback copy.
    const previous = this.unsafe ? null : copy(this.state);
    try {
      if (command.type === "PUZZLE") return this.puzzleStep(command);
      if (command.type === "CLEAR_PUZZLE") {
        if (!this.episode.scenes[this.state.scene].puzzle)
          throw new Error("No puzzle here");
        this.state.puzzle = [];
        this.state.actions.push(copy(command));
        return;
      }
      if (command.type === "DEDUCE") {
        this.deduce(command);
      } else if (command.type === "SHIFT_THEME") {
        const theme = this.episode.themes[command.id];
        if (
          !theme ||
          command.id === this.state.theme ||
          this.state.flags.themeShifted ||
          this.state.returnScene
        )
          throw new Error("The tale cannot shift here");
        this.state.actions.push(copy(command));
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
        this.state.actions.push(copy(command));
        this.state.turn++;
        this.apply({ remove: r.ingredients, give: [r.result] });
        this.record("action", r.label);
        this.record("consequence", r.text);
      } else {
        const a = this.availableActions().find(
          (x) => x.id === command.id && x.type === command.type,
        );
        if (!a?.enabled) throw new Error("That action is not available");
        this.state.actions.push(copy(command));
        this.state.turn += a.cost ?? (a.type === "INSPECT" ? 0 : 1);
        this.record("action", a.label);
        if (a.check) this.resolveCheck(a);
        else {
          this.apply(a.effects);
          this.record("consequence", a.text);
        }
      }
      this.evaluateTriggers(command);
      this.processQueue();
    } catch (error) {
      if (previous) this.state = previous;
      throw error;
    }
  }

  resolveCheck(a) {
    const s = this.state,
      key = this.checkKey(a),
      check = a.check;
    const record = (s.checks[key] ??= { attempts: 0, failures: 0, passed: false });
    const { bonus, parts } = this.checkBonus(check);
    const forced = this.forceRoll?.(key);
    const dice =
      forced === true
        ? [6, 6]
        : forced === false
          ? [1, 1]
          : rollFor(s.seed, `${key}#${record.attempts}`);
    const success = checkSucceeds(dice, bonus, check.dc);
    record.attempts++;
    record.bonus = bonus;
    if (success) record.passed = true;
    else record.failures++;
    const total = dice[0] + dice[1] + bonus;
    s.lastRoll = {
      key,
      label: a.label,
      stat: check.stat ?? null,
      kind: check.kind ?? "red",
      dice,
      bonus,
      parts,
      dc: check.dc,
      total,
      success,
      chance: checkOdds(bonus, check.dc),
      turn: s.turn,
    };
    const statName = check.stat
      ? this.episode.statLabels[check.stat]
      : (check.name ?? "Chance");
    this.record(
      "roll",
      `${statName} check · ${dice[0]} + ${dice[1]} ${bonus < 0 ? "−" : "+"} ${Math.abs(bonus)} = ${total} against ${check.dc} · ${success ? "success" : "failure"}`,
      { success, dice, total, dc: check.dc },
    );
    if (a.effects) this.apply(a.effects);
    const outcome = success ? check.success : check.failure;
    this.apply(outcome.effects);
    this.record("consequence", outcome.text);
  }

  deduce(command) {
    const s = this.state,
      [a, b] = command.ids;
    if (a === b || !s.clues.includes(a) || !s.clues.includes(b))
      throw new Error("Choose two different clues you have found");
    const d = (this.episode.deductions ?? []).find((x) => sameSet(x.from, [a, b]));
    if (d && s.deductions.includes(d.id))
      throw new Error("You have already connected those clues");
    s.actions.push(copy(command));
    if (!d) {
      s.wrongLinks++;
      this.record(
        "deduction-miss",
        "Those threads do not tie together. Nothing is lost by thinking.",
      );
      return;
    }
    s.deductions.push(d.id);
    this.record("deduction", d.title, { deduction: d.id });
    this.apply(d.effects);
    this.record("consequence", d.text);
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
      this.evaluateTriggers({ type: "PUZZLE" });
      this.processQueue();
    }
  }

  /** Static graph of scene → destinations, used by the map. */
  graph() {
    if (!this.episode.__graph) {
      const g = {};
      for (const [id, scene] of Object.entries(this.episode.scenes))
        g[id] = [...new Set(scene.actions.flatMap(destinations))];
      Object.defineProperty(this.episode, "__graph", { value: g });
    }
    return this.episode.__graph;
  }

  mapView(actions) {
    const s = this.state,
      ep = this.episode,
      graph = this.graph();
    const placed = (id) => Boolean(ep.scenes[id]?.map);
    const nodes = s.visited.filter(placed).map((id) => ({
      id,
      title: ep.scenes[id].title,
      kicker: ep.scenes[id].kicker,
      pos: ep.scenes[id].map,
      current: id === s.scene,
      checkpoint: Boolean(ep.scenes[id].checkpoint),
    }));
    const edges = [],
      seen = new Set();
    for (const from of s.visited.filter(placed))
      for (const to of graph[from] ?? []) {
        const key = [from, to].sort().join("|");
        if (seen.has(key) || !s.visited.includes(to) || !placed(to)) continue;
        seen.add(key);
        edges.push([from, to]);
      }
    const exits = actions
      .filter((a) => a.effects?.to && a.effects.to !== "$return" && !a.check)
      .filter((a) => placed(a.effects.to))
      .map((a) => ({
        to: a.effects.to,
        action: a.id,
        type: a.type,
        label: a.label,
        enabled: a.enabled,
        known: s.visited.includes(a.effects.to),
        pos: ep.scenes[a.effects.to].map,
      }));
    const scene = ep.scenes[s.scene];
    const here = placed(s.scene)
      ? s.scene
      : scene.mapAs ?? (placed(s.returnScene) ? s.returnScene : null);
    return { nodes, edges, exits, here };
  }

  atmosphere() {
    const s = this.state,
      ep = this.episode,
      scene = ep.scenes[s.scene];
    const result = { weather: "none", light: "day", ambience: "none", ...ep.ambient };
    for (const key of ["weather", "light", "ambience"])
      if (scene[key]) result[key] = scene[key];
    for (const rule of ep.atmosphere ?? [])
      if (matches(rule.when, s))
        for (const key of ["weather", "light", "ambience"])
          if (rule[key]) result[key] = rule[key];
    return result;
  }

  view() {
    const s = this.state,
      ep = this.episode,
      scene = ep.scenes[s.scene];
    const actions = this.availableActions();
    return {
      ...copy(s),
      title: scene.title,
      kicker: scene.kicker,
      description: scene.text,
      variant: (scene.variants ?? [])
        .filter((v) => matches(v.when, s))
        .map((v) => v.text)
        .join(" "),
      objective: s.flags.objective || ep.objective,
      actions,
      sceneArt: scene.art ?? ep.id,
      inventoryItems: s.inventory.map((id) => ({ id, ...ep.items[id] })),
      clueItems: s.clues.map((id) => ({ id, text: ep.clues[id] })),
      deductionItems: s.deductions.map((id) => {
        const d = ep.deductions.find((x) => x.id === id);
        return { id, title: d.title, text: d.text, from: d.from };
      }),
      deductionsTotal: (ep.deductions ?? []).length,
      recipes: (ep.recipes ?? []).filter((r) =>
        r.ingredients.every((id) => s.inventory.includes(id)),
      ),
      encounter: Boolean(s.returnScene),
      puzzleData: scene.puzzle,
      endingData: s.ending ? ep.endings[s.ending] : null,
      recap: (ep.recaps ?? []).filter((r) => matches(r.when, s)).map((r) => r.text),
      people: Object.entries(ep.characters ?? {})
        .filter(([, c]) => matches(c.met, s))
        .map(([id, c]) => ({
          id,
          name: c.name,
          role: c.role,
          glyph: c.glyph,
          notes: (c.notes ?? []).filter((n) => matches(n.when, s)).map((n) => n.text),
          disposition: c.stat
            ? { label: ep.statLabels[c.stat], value: s.stats[c.stat] ?? 0 }
            : null,
        })),
      atmosphere: this.atmosphere(),
      map: this.mapView(actions),
      earnedEchoItems: s.earnedEchoes.map((id) => ({ id, ...ep.echoes[id] })),
      markItems: s.marks.map((id) => ep.marks.find((m) => m.id === id)),
      canUndo: !s.ending && s.actions.length > 0,
    };
  }

  save() {
    return {
      version: SAVE_VERSION,
      episodeId: this.episode.id,
      revision: this.episode.revision,
      seed: this.state.seed,
      echoes: [...this.state.echoes],
      assist: this.state.assist,
      actions: copy(this.state.actions),
      savedAt: new Date().toISOString(),
    };
  }

  static load(episode, save) {
    const editionError = () =>
      new Error(
        "This save belongs to a different story edition. Start a new journey.",
      );
    if (!save || typeof save !== "object" || ![1, 2].includes(save.version))
      throw editionError();
    if (save.episodeId !== episode.id) throw editionError();
    const current = save.revision === episode.revision;
    if (!current && !(episode.compatibleRevisions ?? []).includes(save.revision))
      throw editionError();
    if (!Array.isArray(save.actions) || save.actions.length > MAX_SAVE_ACTIONS)
      throw new Error("This save could not be read");
    if (
      save.version === 2 &&
      (!Number.isInteger(save.seed) || save.seed < 0 || save.seed > 0xffffffff)
    )
      throw new Error("This save could not be read");
    const game = new Game(episode, {
      seed: save.version === 2 ? save.seed : defaultSeed(episode),
      echoes: Array.isArray(save.echoes)
        ? save.echoes.filter((x) => typeof x === "string")
        : [],
      assist: save.assist === true,
    });
    try {
      for (const command of save.actions) game.dispatch(command);
    } catch (error) {
      if (current) throw error;
      throw new Error(
        "This journey began in an earlier edition and its path no longer exists. Start a new journey.",
      );
    }
    game.migratedFrom = current ? null : save.revision;
    return game;
  }

  /** Step back one command. Dice are seeded, so redoing it rolls the same. */
  undo() {
    if (this.state.ending) throw new Error("This journey has ended");
    if (!this.state.actions.length) throw new Error("Nothing to undo yet");
    return Game.load(this.episode, {
      ...this.save(),
      actions: this.state.actions.slice(0, -1),
    });
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
