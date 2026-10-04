// Prose lint: deterministic checks for the habits that make game text read as
// machine-written. Every tale gets the universal rules. A tale that declares
// `voice: 3` (rewritten against docs/VOICE.md) also gets the strict rules.
//
//   node scripts/prose-lint.mjs            lint every tale, exit 1 on issues
//   node scripts/prose-lint.mjs wisdom     one tale

export const BANNED_WORDS = [
  "delve", "crucial", "robust", "comprehensive", "nuanced", "multifaceted",
  "furthermore", "moreover", "pivotal", "landscape", "tapestry", "underscore",
  "foster", "showcase", "intricate", "vibrant", "fundamental", "significant",
  "interplay", "testament", "realm", "embark", "unravel", "palpable", "beacon",
];
export const STOCK_PHRASES = [
  "you notice", "you feel a", "a sense of", "something shifts", "little did",
  "couldn't help but", "could not help but", "a reminder that", "hangs in the air",
  "hung in the air", "in that moment", "it was as if", "here's the thing",
  "the bottom line", "plot twist", "let me break this down", "make no mistake",
];
// Closing lines that state a moral instead of showing something.
const MAXIM = /^(some (things|people|stories|doors|debts|answers)|every (story|action|tale|choice|door|ending)|(nothing|everything) (is|was|has|changes|stays|lasts|ends)\b|no (plan|story|one) |the (best|truest|real) )/i;

const WORD_RE = new RegExp(`\\b(${BANNED_WORDS.join("|")})(s|es|d|ed|ing|ly)?\\b`, "i");

/** Sentences with their quote marks kept, to tell speech from telling. */
const splitSentences = (text) =>
  text
    .split(/(?<=[.!?][”"]?)\s+(?=[A-Z‘'(“"])/)
    .map((s) => s.trim())
    .filter(Boolean);
/**
 * The storyteller's own sentences: any sentence that opens inside a quote,
 * or contains one, is speech (or a speech tag) and is left out.
 */
function toldSentences(text) {
  let open = false;
  const told = [];
  for (const sentence of splitSentences(text)) {
    const hasQuote = /[“”"]/.test(sentence);
    if (!open && !hasQuote) told.push(sentence);
    for (const ch of sentence) {
      if (ch === "“") open = true;
      else if (ch === "”") open = false;
      else if (ch === '"') open = !open;
    }
  }
  return told;
}
const sentences = (text) =>
  text
    .replace(/[“”"]/g, "")
    .split(/(?<=[.!?])\s+(?=[A-Z‘'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
const words = (s) => s.split(/\s+/).filter((w) => /\w/.test(w)).length;

/** Universal rules for one string. */
export function lintText(text) {
  const issues = [];
  const lower = text.toLowerCase();
  const banned = text.match(WORD_RE);
  if (banned) issues.push(`banned word "${banned[0]}"`);
  for (const phrase of STOCK_PHRASES) if (lower.includes(phrase)) issues.push(`stock phrase "${phrase}"`);
  if (text.includes("—")) issues.push("em dash");
  const list = sentences(text);
  const last = list.at(-1);
  if (list.length > 1 && last && words(last) <= 8 && MAXIM.test(last)) issues.push(`closing maxim "${last}"`);
  return issues;
}

/** Strict rules for narration (scene text, outcomes, endings). */
export function lintNarration(text) {
  const issues = [];
  const list = sentences(text);
  // Rhythm is about the storyteller's own sentences. Lines of dialogue are
  // allowed to be quick and even ("Three years," says one. "Never more,"
  // says the other.), so sentences that open with speech are left out.
  const told = toldSentences(text);
  const lengths = told.map(words);
  for (let i = 0; i + 2 < lengths.length; i++) {
    const run = lengths.slice(i, i + 3);
    if (Math.max(...run) - Math.min(...run) <= 3) {
      issues.push(`flat rhythm: sentences ${i + 1}-${i + 3} are ${run.join("/")} words`);
      break;
    }
  }
  const openers = {};
  for (const s of list) {
    const first = s.split(/\s+/)[0].toLowerCase();
    openers[first] = (openers[first] ?? 0) + 1;
  }
  for (const [w, n] of Object.entries(openers)) if (n >= 3) issues.push(`${n} sentences open with "${w}"`);
  if (text.includes(";")) issues.push("semicolon in narration");
  return issues;
}

const PROSE_KEYS = new Set([
  "title", "subtitle", "hook", "opening", "objective", "description", "text",
  "effect", "label", "success", "failure", "name", "role", "reflection",
  "prompt", "clue", "requires", "kicker", "variant", "note",
]);
const NARRATION_KEYS = new Set(["description", "text", "success", "failure", "reflection", "opening", "variant"]);
const SKIP_KEYS = new Set(["source", "when", "requires_ids", "id", "url"]);

/** Every player-facing string in a tale, with a path for error messages. */
export function proseOf(episode) {
  const out = [];
  const walk = (value, path, key) => {
    if (typeof value === "string") {
      const prose = PROSE_KEYS.has(key) || path.startsWith("clues.") || /\s\S+\s/.test(value);
      if (prose && /[a-z]/.test(value) && !/^https?:/.test(value)) out.push({ path, key, text: value, narration: NARRATION_KEYS.has(key) });
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [k, v] of Object.entries(value)) {
      if (SKIP_KEYS.has(k)) continue;
      walk(v, path ? `${path}.${k}` : k, Array.isArray(value) ? key : k);
    }
  };
  walk(episode, "", "");
  return out;
}

/** Scenes in a strict tale must let someone speak. */
function sceneVoices(episode) {
  const issues = [];
  for (const [id, scene] of Object.entries(episode.scenes)) {
    const texts = proseOf(scene).map((p) => p.text).join(" ");
    if (!/[“"]/.test(texts)) issues.push({ path: `scenes.${id}`, issue: "no one speaks in this scene" });
  }
  return issues;
}

export function lintEpisode(episode) {
  const strict = episode.voice >= 3;
  const issues = [];
  for (const p of proseOf(episode)) {
    for (const issue of lintText(p.text)) issues.push({ path: p.path, issue, text: p.text });
    // Journal notes about people are fragments by design, not narration.
    if (strict && p.narration && !p.path.startsWith("characters.")) for (const issue of lintNarration(p.text)) issues.push({ path: p.path, issue, text: p.text });
  }
  if (strict) issues.push(...sceneVoices(episode));
  return issues;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { episodes } = await import("../site/stories.js");
  const only = process.argv[2];
  let total = 0;
  for (const ep of episodes.filter((e) => !only || e.id === only)) {
    const issues = lintEpisode(ep);
    total += issues.length;
    console.log(`${ep.id}: ${proseOf(ep).length} strings, ${issues.length} issues${ep.voice >= 3 ? " (strict)" : ""}`);
    for (const i of issues) console.log(`  ${i.path}: ${i.issue}${i.text ? `\n    ${i.text.slice(0, 140)}` : ""}`);
  }
  process.exitCode = total ? 1 : 0;
}
