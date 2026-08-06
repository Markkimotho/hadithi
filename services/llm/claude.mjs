// The one place Hadithi talks to a language model: the local Claude Code CLI,
// never a hosted API. Callers pass a system prompt, a user prompt, and a JSON
// Schema; they get back the validated structured output and the cost.
import { spawn } from "node:child_process";

export const DEFAULT_MODEL = process.env.HADITHI_LLM_MODEL || "opus";
const BIN = () => process.env.HADITHI_CLAUDE_BIN || "claude";

/**
 * @param {{system: string, prompt: string, schema: object, model?: string, timeoutMs?: number}} req
 * @returns {Promise<{output: any, costUsd: number, models: string[]}>}
 */
export function runClaude({ system, prompt, schema, model = DEFAULT_MODEL, timeoutMs = 180000 }) {
  const args = [
    "-p",
    "--model", model,
    "--output-format", "json",
    "--no-session-persistence",
    "--tools", "",
    // A bare system prompt and no settings: the default ones cost ~50x more
    // per call and would pull project instructions into a judging task.
    "--setting-sources", "",
    "--system-prompt", system,
    "--json-schema", JSON.stringify(schema),
    prompt,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(BIN(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`claude timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`could not start claude: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${(err || out).slice(0, 300)}`));
      let data;
      try {
        data = JSON.parse(out);
      } catch {
        return reject(new Error(`claude returned non-JSON: ${out.slice(0, 200)}`));
      }
      if (data.is_error) return reject(new Error(`claude error: ${String(data.result).slice(0, 300)}`));
      const output = data.structured_output ?? safeParse(data.result);
      if (output === undefined) return reject(new Error("claude returned no structured output"));
      resolve({ output, costUsd: data.total_cost_usd ?? 0, models: Object.keys(data.modelUsage ?? {}) });
    });
  });
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
