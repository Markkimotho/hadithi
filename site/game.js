// Public engine entry point. The engine lives in ./engine/; this module keeps
// one stable import path for the UI, build script, tests, and evals.
export {
  Game,
  SAVE_VERSION,
  SCHEMA_VERSION,
  ACTION_TYPES,
  SYSTEM_COMMANDS,
  ASSIST_BONUS,
  defaultSeed,
  destinations,
} from "./engine/game.js";
export { matches, refersTo } from "./engine/conditions.js";
export { validateEpisode } from "./engine/validate.js";
export {
  rollFor,
  checkOdds,
  newSeed,
  seedCode,
  parseSeedCode,
} from "./engine/rng.js";
