import { layoutsFor } from "./layouts/index.js";

// The world reads story snapshots and requests commands through this boundary.
// The app owns saving, announcements and the journal after each command.
export function createBridge(getGame, onCommand) {
  let tale, layouts = {};
  return {
    read() {
      const game = getGame();
      if (!game) return null;
      if (tale !== game.episode.id) {
        tale = game.episode.id;
        layouts = layoutsFor(tale);
      }
      const view = game.view();
      const layout = !view.ending && layouts[view.scene];
      return { tale, view, layout, ground: layout?.shares ?? view.scene };
    },
    action(id, outcome) {
      const action = getGame()?.view().actions.find((a) => a.id === id);
      if (!action?.enabled) return false;
      onCommand({ type: action.type, id, ...(outcome ? { outcome } : {}) });
      return true;
    },
    profile(id) {
      const game = getGame();
      const action = game?.episode.scenes[game.state.scene]?.actions.find((a) => a.id === id);
      if (!action?.check) return null;
      const s = game.state;
      return {
        ...game.checkProfile(action),
        clues: [...s.clues], deductions: [...s.deductions],
        flags: Object.keys(s.flags).filter((key) => s.flags[key]), stats: { ...s.stats },
      };
    },
    crack(prop) {
      const game = getGame();
      const id = prop.source.flag;
      const def = game?.episode.physicsFlags?.[id];
      const state = game?.state;
      if (!def || state.ending || state.returnScene || state.flags[id] || (def.scenes && !def.scenes.includes(state.scene))) return false;
      onCommand({ type: "PHYSICS", id });
      return true;
    },
  };
}
