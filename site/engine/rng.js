// Seeded, inspectable dice. A roll is a pure function of (seed, key), so
// replaying a save, undoing an action, or reloading never rerolls a check.

/** 32-bit FNV-1a hash of a string. */
export function hash32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: tiny, fast, well distributed 32-bit generator. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Two six-sided dice for one named check attempt. */
export function rollFor(seed, key) {
  const next = mulberry32(hash32(`${seed >>> 0}|${key}`));
  return [1 + Math.floor(next() * 6), 1 + Math.floor(next() * 6)];
}

/**
 * Probability that 2d6 + bonus meets dc. Double six always succeeds and
 * double one always fails, so no check is ever certain or impossible.
 */
export function checkOdds(bonus, dc) {
  let wins = 0;
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++) if (checkSucceeds([a, b], bonus, dc)) wins++;
  return wins / 36;
}

export function checkSucceeds([a, b], bonus, dc) {
  if (a === 6 && b === 6) return true;
  if (a === 1 && b === 1) return false;
  return a + b + bonus >= dc;
}

/**
 * Dice that agree with a result decided elsewhere (a skill attempt or the
 * ledger). Draws seeded rolls until one fits; double six and double one always
 * fit, so the fallback is never wrong.
 */
export function diceFor(seed, key, bonus, dc, success) {
  for (let i = 0; i < 64; i++) {
    const dice = rollFor(seed, i ? `${key}~${i}` : key);
    if (checkSucceeds(dice, bonus, dc) === success) return dice;
  }
  return success ? [6, 6] : [1, 1];
}

/** A fresh 32-bit seed for a new journey. */
export function newSeed() {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  } catch {
    return Math.floor(Math.random() * 4294967296) >>> 0;
  }
}

/** Seeds shown to players are short base-36 codes that can be typed back. */
export const seedCode = (seed) =>
  (seed >>> 0).toString(36).toUpperCase().padStart(7, "0");
export function parseSeedCode(code) {
  const clean = String(code ?? "")
    .trim()
    .toLowerCase();
  if (!/^[0-9a-z]{1,7}$/.test(clean)) return null;
  const value = parseInt(clean, 36);
  return value <= 0xffffffff ? value >>> 0 : null;
}
