import { layoutsFor } from "./layouts/index.js";

// The one boundary between the world and the story. The world reads story
// snapshots here and asks for story actions; the play shell decides how an
// action is told (a trial first, a conversation, or straight to the engine).
export function createBridge(getGame, { request, command }) {
  let tale,
    layouts = {};
  return {
    layouts(taleId) {
      if (tale !== taleId) {
        tale = taleId;
        layouts = layoutsFor(taleId);
      }
      return layouts;
    },
    read() {
      const game = getGame();
      if (!game) return null;
      const view = game.view();
      const layout = !view.ending && this.layouts(game.episode.id)[view.scene];
      return { tale: game.episode.id, view, layout, ground: layout?.shares ?? view.scene };
    },
    /** The world wants to do `action` at `place`. */
    request(action, place) {
      const live = getGame()?.view().actions.find((a) => a.id === action.id);
      if (!live?.enabled) return false;
      request(live, place);
      return true;
    },
    profile(id) {
      const game = getGame();
      const action = game?.episode.scenes[game.state.scene]?.actions.find((a) => a.id === id);
      if (!action?.check) return null;
      const s = game.state;
      return {
        ...game.checkProfile(action),
        clues: [...s.clues],
        deductions: [...s.deductions],
        flags: Object.keys(s.flags).filter((key) => s.flags[key]),
        stats: { ...s.stats },
      };
    },
    crack(prop) {
      const game = getGame();
      const id = prop.source.flag;
      const def = game?.episode.physicsFlags?.[id];
      const state = game?.state;
      if (!def || state.ending || state.returnScene || state.flags[id] || (def.scenes && !def.scenes.includes(state.scene))) return false;
      command({ type: "PHYSICS", id });
      return true;
    },
  };
}

/** Tales whose every scene has a world map. Only these can be played. */
export function playable(episode) {
  const layouts = layoutsFor(episode.id);
  return Object.keys(episode.scenes).every((id) => layouts[id]);
}
