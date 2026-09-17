// The rules behind every timed trial, with no drawing in them.
//
// A timed trial is a short run of moments: a stone rises, a gust arrives, the
// branch sways. Each moment has an ideal instant; the player answers with one
// press. A press close enough to the instant is a good answer. The trial is
// passed with enough good answers.
//
// The window around each instant is solved from the story's odds, so that a
// player of average timing passes as often as the dice would: the trial is a
// fair replacement for the roll, not a harder or softer one. The eval in
// evals/skills.mjs checks that claim against simulated players.
import { mulberry32, hash32 } from "../../engine/rng.js";

/** Timing error (seconds, one standard deviation) of an average player. */
export const AVERAGE_SIGMA = 0.13;
export const PLAYERS = { novice: 1.7, average: 1, expert: 0.45 };

const choose = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};
/** Chance of at least `need` good answers out of `n`, each good with chance p. */
export function passChance(p, n, need) {
  let sum = 0;
  for (let k = need; k <= n; k++) sum += choose(n, k) * p ** k * (1 - p) ** (n - k);
  return sum;
}

/** Inverse error function (Giles 2012, single precision is plenty here). */
export function erfinv(x) {
  const w = -Math.log((1 - x) * (1 + x));
  let p;
  if (w < 5) {
    const t = w - 2.5;
    p = 2.81022636e-8;
    for (const c of [3.43273939e-7, -3.5233877e-6, -4.39150654e-6, 0.00021858087, -0.00125372503, -0.00417768164, 0.246640727, 1.50140941]) p = c + p * t;
  } else {
    const t = Math.sqrt(w) - 3;
    p = -0.000200214257;
    for (const c of [0.000100950558, 0.00134934322, -0.00367342844, 0.00573950773, -0.0076224613, 0.00943887047, 1.00167406, 2.83297682]) p = c + p * t;
  }
  return p * x;
}

/**
 * Tolerances for a timed trial from the story's odds.
 * @param chance the probability the dice would succeed (0..1)
 * @param shape { moments, need, period } per kind
 */
export function timingParams(chance, shape = {}) {
  const moments = shape.moments ?? 3,
    need = shape.need ?? 2,
    period = shape.period ?? 1.6;
  const target = Math.min(0.995, Math.max(0.005, chance));
  // Solve passChance(p) = target for the per-moment chance p.
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (passChance(mid, moments, need) < target) lo = mid;
    else hi = mid;
  }
  const p = (lo + hi) / 2;
  // |error| <= window with error ~ N(0, sigma): p = erf(window / (sigma * sqrt 2)).
  const window = Math.min(0.6, Math.max(0.02, AVERAGE_SIGMA * Math.SQRT2 * erfinv(Math.min(0.9999, p))));
  return { moments, need, period, window, perMoment: p, chance: target };
}

/** The instants of a trial, a little uneven so it cannot be played by rhythm alone. */
export function schedule(params, seed) {
  const rnd = mulberry32(hash32(`trial:${seed}`));
  const times = [];
  let t = 1.4; // a breath before the first moment
  for (let i = 0; i < params.moments; i++) {
    times.push(t);
    t += params.period * (0.8 + rnd() * 0.4);
  }
  return times;
}

/**
 * A running trial. Feed it time and presses; read what to draw and the result.
 * Each press is matched to the nearest moment that has not been answered.
 */
export function createTiming(params, seed) {
  const times = schedule(params, seed);
  const answers = times.map(() => null); // null: unanswered; { error, good }
  let clock = 0;
  const reach = Math.max(params.window * 2.2, 0.45);
  const state = {
    params,
    times,
    answers,
    get clock() {
      return clock;
    },
    /** The moment the player is facing now (first unanswered, not yet missed). */
    current() {
      return times.findIndex((t, i) => answers[i] === null && clock <= t + reach);
    },
    advance(dt) {
      clock += dt;
      // Moments that pass unanswered are misses.
      times.forEach((t, i) => {
        if (answers[i] === null && clock > t + reach) answers[i] = { error: null, good: false, missed: true };
      });
      return this;
    },
    press() {
      const i = this.current();
      if (i < 0 || Math.abs(clock - times[i]) > reach) return null;
      const error = clock - times[i];
      answers[i] = { error, good: Math.abs(error) <= params.window, missed: false };
      return { index: i, ...answers[i] };
    },
    get done() {
      return answers.every((a) => a !== null);
    },
    get good() {
      return answers.filter((a) => a?.good).length;
    },
    /** 0..1: good answers, with a little credit for near misses. */
    get score() {
      const credit = answers.map((a) => (a?.good ? 1 : a?.error == null ? 0 : Math.max(0, 1 - Math.abs(a.error) / reach) * 0.5));
      return Number((credit.reduce((s, x) => s + x, 0) / answers.length).toFixed(3));
    },
    get pass() {
      return this.good >= params.need;
    },
    /** How near the current moment is: 1 at the instant, 0 a period away. */
    nearness() {
      const i = this.current();
      if (i < 0) return 0;
      return Math.max(0, 1 - Math.abs(times[i] - clock) / params.period);
    },
  };
  return state;
}

/** A simulated player: presses near each instant with Gaussian error. */
export function simulatePlayer(params, seed, skill = "average", { step = 1 / 60 } = {}) {
  const trial = createTiming(params, seed);
  const rnd = mulberry32(hash32(`player:${seed}:${skill}`));
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const sigma = AVERAGE_SIGMA * (PLAYERS[skill] ?? 1);
  const plan = trial.times.map((t) => t + gauss() * sigma);
  let next = 0;
  for (let guard = 0; guard < 6000 && !trial.done; guard++) {
    trial.advance(step);
    while (next < plan.length && trial.clock >= plan[next]) {
      trial.press();
      next++;
    }
  }
  return { pass: trial.pass, score: trial.score, good: trial.good };
}

/** The shape of each timed trial kind: how many moments, how many must be good. */
export const SHAPES = {
  leap: { moments: 3, need: 2, period: 1.5 },
  brace: { moments: 4, need: 3, period: 1.8 },
  balance: { moments: 4, need: 3, period: 1.4 },
  rhythm: { moments: 5, need: 3, period: 0.9 },
  steer: { moments: 4, need: 3, period: 1.4 },
  swim: { moments: 4, need: 3, period: 1.6 },
  sneak: { moments: 4, need: 3, period: 1.7 },
  carry: { moments: 4, need: 3, period: 1.5 },
  chase: { moments: 4, need: 3, period: 1.2 },
  formation: { moments: 4, need: 3, period: 1.5 },
  stack: { moments: 4, need: 3, period: 1.6 },
};

/** Assist (Storyteller's grace) is already inside the odds, so nothing extra here. */
export function paramsFor(kind, profile) {
  return timingParams(profile?.chance ?? 0.5, SHAPES[kind] ?? SHAPES.leap);
}
