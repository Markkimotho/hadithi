// Blind pairwise judge for game prose. Contract: contracts/llm-judge.schema.json.
import { readFileSync } from "node:fs";
import { runClaude } from "./claude.mjs";

export const SCHEMA = JSON.parse(readFileSync(new URL("../../contracts/llm-judge.schema.json", import.meta.url), "utf8"));

const SYSTEM = `You are an editor of interactive fiction adapted from traditional tales. You compare two versions of the same passage, shown blind as A and B, and score each from 1 to 5:
- specific: concrete nouns, actions and details a listener can picture, not abstractions or summaries of feeling.
- voice: sounds like a storyteller from the stated tradition, with character and humour where the source has it; characters talk.
- rhythm: reads well aloud; sentence lengths vary; no tidy symmetrical clauses.
- human: could pass as written by a skilled human author; no stock phrases, morals stated outright, or machine-like evenness.
Pick the version a reader would rather hear. Judge only the text. Keep the reason under 60 words.`;

/** Small structural validator for the contract (no extra dependency). */
export function checkJudgement(j) {
  const errors = [];
  if (!j || typeof j !== "object") return ["not an object"];
  if (!["a", "b"].includes(j.winner)) errors.push("winner must be a or b");
  for (const side of ["a", "b"]) {
    const s = j[side];
    if (!s || typeof s !== "object") {
      errors.push(`${side} scores missing`);
      continue;
    }
    for (const k of Object.keys(SCHEMA.$defs.scores.properties))
      if (!Number.isInteger(s[k]) || s[k] < 1 || s[k] > 5) errors.push(`${side}.${k} must be an integer 1-5`);
  }
  if (typeof j.reason !== "string") errors.push("reason must be a string");
  return errors;
}

/**
 * Compare two passages. `a` and `b` are shown in the order given; callers
 * randomise or run both orders to cancel position bias.
 */
export async function judgePair({ tradition, context, a, b, model }) {
  const prompt = `Tradition: ${tradition}\nWhere this appears: ${context}\n\nA:\n${a}\n\nB:\n${b}`;
  const { output, costUsd, models } = await runClaude({ system: SYSTEM, prompt, schema: SCHEMA, model });
  const errors = checkJudgement(output);
  if (errors.length) throw new Error(`judge broke the contract: ${errors.join("; ")}`);
  return { ...output, costUsd, models };
}
