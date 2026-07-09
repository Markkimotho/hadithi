import { mkdir, cp, rm } from "node:fs/promises";
import { episodes } from "../site/stories.js";
import { validateEpisode } from "../site/game.js";
const errors = episodes.flatMap(validateEpisode);
if (errors.length)
  throw new Error(`Story validation failed:\n${errors.join("\n")}`);
const output = new URL("../dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("../site/", import.meta.url), output, { recursive: true });
console.log(
  `Built Hadithi: ${episodes.length} tales, ${episodes.reduce((n, e) => n + e.events.length, 0)} events, ${episodes.reduce((n, e) => n + Object.keys(e.endings).length, 0)} endings.`,
);
