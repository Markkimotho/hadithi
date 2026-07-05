import { mkdir, cp, readFile } from "node:fs/promises";
const data = JSON.parse(await readFile(new URL("../game_data.json", import.meta.url), "utf8"));
for (const [name, location] of Object.entries(data.locations)) {
  for (const exit of location.exits) {
    if (!data.locations[exit.destination]) throw new Error(`Unknown exit from ${name}: ${exit.destination}`);
  }
}
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await cp(new URL("../site/", import.meta.url), new URL("../dist/", import.meta.url), { recursive: true });
await cp(new URL("../game_data.json", import.meta.url), new URL("../dist/game_data.json", import.meta.url));
console.log("Built browser game in dist/");
