import { wisdom } from "./wisdom.js";
import { tide } from "./tide.js";
import { orchestra } from "./orchestra.js";
import { olives } from "./olives.js";

export { wisdom, tide, orchestra, olives };
export const episodes = [wisdom, tide, orchestra, olives];
export const episodeById = (id) => episodes.find((episode) => episode.id === id);
/** Regions in shelf order; the filter only lists regions that have a tale. */
export const regions = [...new Set(episodes.map((episode) => episode.region))];
