// The physical challenges a check can become in the world. The engine only
// needs the names to validate tales; the playable versions live in
// site/world/skills/<kind>.js and must cover every kind listed here.
export const SKILL_KINDS = Object.freeze([
  "leap", // hop moving stones across a current
  "balance", // climb while keeping a load's centre of mass over your feet
  "scale", // tip a balance with weighed arguments before patience runs out
  "brace", // move a load against gusts, bracing at the right moments
  "steer", // ride or row a lane through currents and hazards
  "swim", // stroke rhythm against a flow with a breath limit
  "sneak", // cross a space under sight cones and a noise meter
  "formation", // keep a group of followers together
  "stack", // build a tower of bodies and hold it steady
  "rhythm", // hit beats while something sways
  "carry", // move a fragile load through a crowd without a hard knock
  "chase", // get away through a crowd from a pursuer
]);

/** Skill parameters are plain data: numbers, strings, booleans, string lists. */
export function skillErrors(skill) {
  const errors = [];
  if (!skill || typeof skill !== "object") return ["skill must be an object"];
  if (!SKILL_KINDS.includes(skill.kind)) errors.push(`unknown skill kind ${skill.kind}`);
  for (const [key, value] of Object.entries(skill)) {
    const plain =
      (typeof value === "number" && Number.isFinite(value)) ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (Array.isArray(value) && value.every((x) => typeof x === "string"));
    if (!plain) errors.push(`skill parameter ${key} must be plain data`);
  }
  return errors;
}
