import { Game } from "./game.js";
import { episodes, episodeById } from "./stories.js";

const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const KEY = "hadithi.v1";
let storageNotice = false;
function read(key, fallback) {
  try {
    const value = localStorage.getItem(`${KEY}.${key}`);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(`${KEY}.${key}`, JSON.stringify(value));
    return true;
  } catch {
    if (!storageNotice) {
      storageNotice = true;
      toast(
        "Browser storage is unavailable. Export a save to keep this journey.",
      );
    }
    return false;
  }
}
let settings = {
  sound: false,
  motion: !matchMedia("(prefers-reduced-motion: reduce)").matches,
  size: "normal",
  ...read("settings", {}),
};
const savedDiscoveries = read("discoveries", {});
let discoveries = Object.fromEntries(
  episodes.map((ep) => [
    ep.id,
    Array.isArray(savedDiscoveries?.[ep.id])
      ? savedDiscoveries[ep.id].filter((id) => Object.hasOwn(ep.endings, id))
      : [],
  ]),
);
let game = null,
  panel = "inventory",
  selectedItem = null,
  filter = "All tales",
  toastTimer,
  audio;
const main = $("#main"),
  modal = $("#modal");
const sceneIllustrations = {
  wisdom: {
    courtyard: "market",
    market: "market",
    well: "market",
    trail: "river",
    ridge: "river",
    river: "river",
    ford: "river",
  },
  tide: {
    shore: "shore",
    pools: "shore",
    newShore: "shore",
    channel: "channel",
    return: "channel",
    surge: "channel",
  },
  orchestra: {
    road: "road",
    dog: "road",
    orchard: "road",
    rooster: "road",
    wood: "road",
    rehearsal: "stage",
  },
};
const art = (ep, css = "", alt = "") =>
  `<img class="${css}" src="./assets/${css === "scene-image" ? sceneIllustrations[ep.id][game.state.scene] || ep.id : ep.id}.svg" alt="${escape(alt)}" />`;
function bind(selector, action, scope = document) {
  scope
    .querySelectorAll(selector)
    .forEach((el) => el.addEventListener("click", () => action(el)));
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4200);
}
function tone() {
  if (!settings.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 180;
    gain.gain.setValueAtTime(0.025, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.09);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.1);
  } catch {
    /* Sound is optional. */
  }
}
function applySettings() {
  document.body.dataset.motion = settings.motion ? "on" : "off";
  document.body.dataset.text = settings.size;
}
applySettings();

function showDialog(title, content) {
  $("#modal-body").innerHTML =
    `<span class="eyebrow">HADITHI / FIELD GUIDE</span><h2 id="modal-title">${escape(title)}</h2>${content}`;
  if (!modal.open) modal.showModal();
}
$("#close-modal").addEventListener("click", () => modal.close());
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    const rect = modal.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      modal.close();
  }
});

function sources(id) {
  const list = id ? [episodeById(id)] : episodes;
  showDialog(
    "Where the stories began",
    `<p>These are new interactive adaptations of traditional tales. The objects, puzzles, and alternative endings are part of the game. Every tradition has more than one telling.</p>${list.map((ep) => `<article class="source-note"><span class="eyebrow">${escape(ep.tradition)}</span><h3>${escape(ep.title.replace("\n", " "))}</h3><p><cite>${escape(ep.source.title)}</cite><br>${escape(ep.source.by)} · ${escape(ep.source.year)}</p><p>${escape(ep.source.note)}</p><p class="fineprint">${escape(ep.source.rights)}</p><a href="${escape(ep.source.url)}" target="_blank" rel="noopener noreferrer">Read the source collection ↗</a></article>`).join("")}<p class="fineprint">Source records checked ${escape(episodes[0].source.checked)}. International edition rights and regional editorial review remain release checks. Illustrations, game text, and interface were created for Hadithi. No source illustrations or ebook text are included.</p>`,
  );
  modal.querySelectorAll(".source-note").forEach((article, index) => {
    const note = document.createElement("p");
    note.className = "fineprint";
    note.textContent = `Play as ${list[index].role}. Content notes: ${list[index].notes}`;
    article.insertBefore(note, article.querySelector("a"));
  });
}
$("#sources-link").addEventListener("click", () => sources());
$("#footer-sources").addEventListener("click", () => sources());

function showSettings() {
  showDialog(
    "Settle into the story",
    `<p>Time advances with your actions. Reading, inspecting your bag, and opening the journal never run down a clock.</p><div class="setting-row"><label for="sound">Button sounds<small>A short, quiet note. Off by default.</small></label><input id="sound" type="checkbox" ${settings.sound ? "checked" : ""}></div><div class="setting-row"><label for="motion">Scene motion<small>Subtle transitions and encounter feedback.</small></label><input id="motion" type="checkbox" ${settings.motion ? "checked" : ""}></div><div class="setting-row"><label for="text-size">Story text size</label><select id="text-size"><option value="normal" ${settings.size === "normal" ? "selected" : ""}>Standard</option><option value="large" ${settings.size === "large" ? "selected" : ""}>Large</option></select></div><p class="fineprint">Keyboard: Tab to move, Enter to act. Number keys 1–5 select encounter actions. Your progress saves after every action on this browser.</p><button class="button secondary" id="import-save">Import a journey</button>`,
  );
  for (const key of ["sound", "motion"])
    $(`#${key}`).addEventListener("change", (event) => {
      settings[key] = event.target.checked;
      write("settings", settings);
      applySettings();
      if (key === "sound") tone();
    });
  $("#text-size").addEventListener("change", (event) => {
    settings.size = event.target.value;
    write("settings", settings);
    applySettings();
  });
  $("#import-save").addEventListener("click", () => $("#import-file").click());
}
$("#settings-link").addEventListener("click", showSettings);
$("#import-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1000000)
      throw new Error("This file is too large to be a Hadithi save.");
    const save = JSON.parse(await file.text());
    const ep = episodeById(save.episodeId);
    if (!ep) throw new Error("This story is not in the collection.");
    const imported = Game.load(ep, save);
    game = imported;
    panel = "journal";
    modal.close();
    persist();
    renderGame();
    toast("Journey imported.");
  } catch (error) {
    toast(error.message || "This save could not be imported.");
  } finally {
    event.target.value = "";
  }
});

function library() {
  game = null;
  selectedItem = null;
  main.className = "collection";
  document.title = "Hadithi — An atlas of playable tales";
  const count = Object.values(discoveries).reduce(
    (sum, values) => sum + (Array.isArray(values) ? values.length : 0),
    0,
  );
  main.innerHTML = `<section class="collection-intro"><div class="intro-copy"><div class="edition"><span class="small-star">✳</span> VOLUME ONE <span class="rule"></span> THE FIRST CROSSING</div><h1>Every story has<br>a <em>turning point.</em></h1><p>Step inside an old tale. Find what others miss.<br>Leave the world a little different.</p><div class="intro-meta"><span>03 PLAYABLE TALES</span><span>09 POSSIBLE ENDINGS</span><span>ONE NEXT MOVE</span></div></div><div class="atlas-seal" aria-hidden="true"><span class="seal-top">A WORLD OF STORIES</span><div class="compass"><span class="compass-letter north">N</span><span class="compass-letter east">E</span><span class="compass-letter south">S</span><span class="compass-letter west">W</span><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="90"/><circle cx="100" cy="100" r="74"/><path d="m100 12 12 76 76 12-76 12-12 76-12-76-76-12 76-12z"/><path class="needle" d="m100 28 12 60 60 12-72 0zM100 172l-12-60-60-12h72z"/><path d="m46 46 54 32 54-32-32 54 32 54-54-32-54 32 32-54z"/><circle cx="100" cy="100" r="8"/></svg></div><span class="seal-bottom">EXPLORE · COLLECT · CHANGE</span></div></section>
  <section class="shelf"><div class="shelf-header"><div><span class="eyebrow">CHOOSE YOUR FIRST FOOTSTEP</span><h2>The collection <sup>01—03</sup></h2></div><span class="discovery-count">${String(count).padStart(2, "0")} / 09 endings found</span></div><div class="filters" role="group" aria-label="Filter stories">${["All tales", "Africa", "Asia", "Europe"].map((f) => `<button class="filter ${filter === f ? "active" : ""}" data-filter="${f}" aria-pressed="${filter === f}">${f}</button>`).join("")}<span class="filter-note">FREE TO PLAY · SAVES AS YOU GO</span></div><div class="story-grid">${episodes
    .filter((ep) => filter === "All tales" || ep.region === filter)
    .map((ep) => {
      const save = read(`save.${ep.id}`, null),
        found = discoveries[ep.id] ?? [];
      return `<article class="story-card ${ep.id}"><div class="cover">${art(ep)}<div class="cover-top"><span>TALE / ${ep.number}</span><span class="cover-region">${ep.region.toUpperCase()}</span></div><div class="cover-caption"><span>${escape(ep.genre)}</span><h3>${escape(ep.title).replace("\n", "<br>")}</h3></div><span class="cover-corner" aria-hidden="true">✧</span></div><div class="card-body"><div class="story-origin">${escape(ep.tradition)} <span>${ep.duration}</span></div><p>${escape(ep.hook)}</p><div class="card-bottom"><button class="button start-button" data-start="${ep.id}">${save ? "Resume journey" : "Enter the story"} <span>→</span></button><button class="source-button" data-source="${ep.id}" aria-label="Source notes for ${escape(ep.title.replace("\n", " "))}">ⓘ</button></div><div class="card-foot"><span>${save ? "JOURNEY ON THIS BROWSER" : "NO ACCOUNT NEEDED"}</span><span>${found.length}/3 ENDINGS</span></div>${save ? `<button class="new-run" data-new="${ep.id}">Begin again</button>` : ""}</div></article>`;
    })
    .join(
      "",
    )}</div></section><section class="how-to"><span class="how-number">HOW TO PLAY</span><div><b>01. Look closely.</b><p>Explore the scene. Read the signs.</p></div><div><b>02. Make your move.</b><p>Use your bag, your wits, your allies.</p></div><div><b>03. Live with the turn.</b><p>The world remembers what you do.</p></div></section>`;
  bind("[data-filter]", (el) => {
    filter = el.dataset.filter;
    library();
    $(`[data-filter="${filter}"]`).focus({ preventScroll: true });
  });
  bind("[data-start]", (el) => start(el.dataset.start));
  bind("[data-new]", (el) => newJourney(el.dataset.new));
  bind("[data-source]", (el) => sources(el.dataset.source));
}
$("#brand").addEventListener("click", library);
$("#library-link").addEventListener("click", library);
function start(id, fresh = false) {
  const ep = episodeById(id),
    save = !fresh && read(`save.${id}`, null);
  try {
    game = save ? Game.load(ep, save) : new Game(ep);
  } catch (error) {
    showDialog(
      "A different edition",
      `<p>${escape(error.message)}</p><button class="button" id="fresh-start">Start a new journey →</button>`,
    );
    $("#fresh-start").onclick = () => {
      modal.close();
      start(id, true);
    };
    return;
  }
  panel = "inventory";
  selectedItem = null;
  persist();
  renderGame();
  $("#scene-title")?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
function newJourney(id) {
  showDialog(
    "A fresh first footstep?",
    `<p>This starts a new journey in <em>${escape(episodeById(id).title.replace("\n", " "))}</em> and replaces its current browser save. Discovered endings remain in your collection.</p><div class="dialog-actions"><button class="button" id="begin-fresh">Begin again →</button><button class="button secondary" id="keep-save">Keep my journey</button></div>`,
  );
  $("#begin-fresh").onclick = () => {
    modal.close();
    start(id, true);
  };
  $("#keep-save").onclick = () => modal.close();
}
function persist() {
  if (!game) return;
  write(`save.${game.episode.id}`, game.save());
  if (game.state.ending) {
    const id = game.episode.id;
    discoveries[id] = Array.isArray(discoveries[id]) ? discoveries[id] : [];
    if (!discoveries[id].includes(game.state.ending))
      discoveries[id].push(game.state.ending);
    write("discoveries", discoveries);
  }
}
function act(command) {
  try {
    tone();
    const previousTurn = game.state.turn;
    game.dispatch(command);
    persist();
    selectedItem = null;
    renderGame();
    const last = game.state.log.at(-1);
    $("#announcement").textContent =
      `${game.view().title}. ${last?.text ?? ""}`;
    if (command.type !== "PUZZLE" && command.type !== "CLEAR_PUZZLE") {
      $("#scene-title")?.focus({ preventScroll: true });
      if (matchMedia("(max-width: 620px)").matches)
        $("#scene-title")?.scrollIntoView({
          block: "start",
          behavior: "instant",
        });
    } else if (
      game.state.turn > previousTurn ||
      command.type === "CLEAR_PUZZLE"
    )
      ($("#puzzle-heading") || $("#scene-title"))?.focus({
        preventScroll: true,
      });
    else $(`[data-puzzle="${command.id}"]`)?.focus({ preventScroll: true });
  } catch (error) {
    toast(error.message);
  }
}
const actionIcons = {
  TRAVEL: "↗",
  INSPECT: "⌕",
  TAKE_ITEM: "＋",
  USE_ITEM: "◇",
  TALK: "❞",
  BARGAIN: "⇌",
  SOLVE: "⌘",
  WAIT: "◷",
  CHOOSE: "✧",
};
function renderGame() {
  if (!game) return;
  const ep = game.episode,
    v = game.view();
  document.title = `${ep.title.replace("\n", " ")} — Hadithi`;
  main.className = `play-screen ${ep.id}`;
  main.dataset.theme = v.theme;
  main.innerHTML = `<div class="journey-heading"><button class="back-link" id="back-library">← The collection</button><span>${ep.tradition} <span class="separator">/</span> TALE ${ep.number}</span><button class="back-link" id="story-source">Source notes ↗</button></div><div class="game-cabinet"><div class="cabinet-bar"><span class="status-light"></span><span>${v.ending ? "JOURNEY COMPLETE" : v.encounter ? "ENCOUNTER IN PROGRESS" : "JOURNEY IN PROGRESS"}</span><span class="bar-right">HADITHI / VOL. 01</span></div><div class="game-layout"><section class="play-column" aria-label="Current scene"><div class="scene-stage ${v.encounter ? "interrupted" : ""}">${art(ep, "scene-image")}<div class="stage-grid" aria-hidden="true"></div><span class="stage-coordinate">${ep.number} / ${String(v.visited.length).padStart(2, "0")}</span><div class="scene-location"><span class="eyebrow">${escape(v.kicker)}</span><span class="location-marker">⌖</span></div>${
    v.ending
      ? '<div class="ending-seal" aria-hidden="true">✧</div>'
      : v.actions
          .filter((a) => a.spot && a.enabled)
          .map(
            (a) =>
              `<button class="hotspot" style="--x:${a.spot[0]}%;--y:${a.spot[1]}%" data-hotspot="${a.id}" aria-label="On scene: ${escape(a.label)}"><span>＋</span><small>${escape(a.label)}</small></button>`,
          )
          .join("")
  }<div class="stage-bottom"><span>${escape(ep.role)}</span><span>${escape(ep.themes[v.theme].name)} ${ep.themes[v.theme].icon}</span></div></div><div class="narrative"><div class="chapter-line"><span>${v.ending ? "THE TALE YOU MADE" : v.encounter ? "THE WORLD MAKES ITS MOVE" : "YOUR NEXT FOOTSTEP"}</span><span>TURN ${String(v.turn).padStart(2, "0")}</span></div><h1 id="scene-title" tabindex="-1">${escape(v.endingData?.title || v.title)}</h1><p class="story-text">${escape(v.endingData?.text || v.description)}</p>${v.variant && !v.ending ? `<p class="scene-variant">${escape(v.variant)}</p>` : ""}${renderConsequence(v)}${v.ending ? renderEnding(ep, v) : `${renderPuzzle(v)}<div class="action-heading"><span>YOUR MOVE</span><span>Inspect freely · actions take turns</span></div><div class="actions">${v.actions.map((a, i) => `<button class="action-button ${a.enabled ? "" : "unavailable"}" data-action="${a.id}" ${a.enabled ? "" : "disabled"}><span class="action-icon" aria-hidden="true">${actionIcons[a.type]}</span><span><b>${escape(a.label)}</b><small>${a.enabled ? (a.type === "INSPECT" ? "LOOK · NO TURN" : `${a.type.replace("_", " ")} · ${a.cost ?? 1} ${(a.cost ?? 1) === 1 ? "TURN" : "TURNS"}`) : escape(a.requires || "Complete the puzzle first")}</small></span><span class="action-key" aria-hidden="true">${i + 1}</span></button>`).join("")}</div>`}</div></section><aside class="field-panel" aria-label="Your field journal"><div class="field-panel-head"><span>FIELD JOURNAL</span><span>${ep.number} / ${v.theme.toUpperCase()}</span></div><div class="objective"><span class="eyebrow">${v.ending ? "JOURNEY COMPLETE" : "CURRENT OBJECTIVE"}</span><p>${escape(v.endingData?.reflection || v.objective)}</p></div><div class="stats">${Object.entries(
    v.stats,
  )
    .map(
      ([key, n]) =>
        `<div><label>${escape(ep.statLabels[key])}<b>${n}<small>/10</small></b></label><div class="stat-track"><span style="width:${n * 10}%"></span></div></div>`,
    )
    .join(
      "",
    )}</div><div class="panel-tabs" role="tablist" aria-label="Field journal sections">${[
    ["inventory", "Bag", v.inventory.length],
    ["journal", "Clues", v.clues.length],
    ["map", "Trail", v.visited.length],
  ]
    .map(
      ([id, label, n]) =>
        `<button id="tab-${id}" role="tab" aria-controls="panel-content" aria-selected="${panel === id}" data-panel="${id}" ${panel === id ? 'class="selected"' : ""}>${label} <small>${n}</small></button>`,
    )
    .join(
      "",
    )}</div><div id="panel-content" role="tabpanel" aria-labelledby="tab-${panel}" class="panel-content">${renderPanel(ep, v)}</div><div class="theme-box"><span class="eyebrow">THE DIRECTION OF THE TALE</span><button id="shift-theme" ${v.flags.themeShifted || v.encounter || v.ending ? "disabled" : ""}><span>${ep.themes[v.theme].icon} ${ep.themes[v.theme].name}</span><span>${v.flags.themeShifted ? "TURN TAKEN" : "Shift the tale ↗"}</span></button><p>${v.flags.themeShifted ? "Your chosen direction is changing the events ahead." : "One turning point per journey. Choose a new genre and change what can happen."}</p></div><div class="save-tools"><span id="save-label">${storageNotice ? "SAVE EXPORT RECOMMENDED" : "✓ SAVED ON THIS BROWSER"}</span><button id="export-save">Export save ↓</button></div></aside></div><div class="cabinet-footer"><span>LOOK · LISTEN · ACT</span><span>Every action leaves a trace.</span><button id="restart-story">Begin again ↺</button></div></div>`;
  $("#back-library").onclick = library;
  $("#story-source").onclick = () => sources(ep.id);
  $("#restart-story").onclick = () => newJourney(ep.id);
  $("#shift-theme").onclick = showThemes;
  $("#export-save").onclick = exportSave;
  bind("[data-action]", (el) => {
    const a = v.actions.find((a) => a.id === el.dataset.action);
    act({ type: a.type, id: a.id });
  });
  bind("[data-hotspot]", (el) => {
    const a = v.actions.find((a) => a.id === el.dataset.hotspot);
    act({ type: a.type, id: a.id });
  });
  bind("[data-panel]", (el) => {
    panel = el.dataset.panel;
    selectedItem = null;
    renderGame();
    $(`#tab-${panel}`).focus({ preventScroll: true });
  });
  bind("[data-item]", (el) => {
    const id = el.dataset.item;
    selectedItem = selectedItem === id ? null : id;
    renderGame();
    $(`[data-item="${id}"]`).focus({ preventScroll: true });
  });
  bind("[data-recipe]", (el) =>
    act({ type: "COMBINE", id: el.dataset.recipe }),
  );
  bind("[data-puzzle]", (el) => act({ type: "PUZZLE", id: el.dataset.puzzle }));
  if ($("#clear-puzzle"))
    $("#clear-puzzle").onclick = () => act({ type: "CLEAR_PUZZLE" });
  if ($("#rewind"))
    $("#rewind").onclick = () => {
      game = game.rewind();
      persist();
      renderGame();
      toast("Returned to your last turning point.");
    };
  if ($("#another-story")) $("#another-story").onclick = library;
}
function renderConsequence(v) {
  if (v.ending) return "";
  const actionIndex = v.log.findLastIndex((entry) => entry.kind === "action");
  const recent = v.log
    .slice(actionIndex + 1)
    .filter((entry) => entry.kind !== "action");
  if (!recent.length) return "";
  const consequence = recent.find((entry) => entry.kind === "consequence"),
    events = recent.filter(
      (entry) => entry.kind === "world" || entry.kind === "encounter",
    );
  const entries = consequence
    ? [consequence, ...events.slice(-1)]
    : events.slice(-1);
  return entries
    .map(
      (entry) =>
        `<div class="consequence ${entry.kind === "encounter" ? "encounter-note" : ""}"><span>${entry.kind === "world" ? "WORLD EVENT" : entry.kind === "encounter" ? "INTERRUPTION" : "WHAT CHANGED"}</span><p>${escape(entry.text)}</p></div>`,
    )
    .join("");
}
function renderPuzzle(v) {
  const p = v.puzzleData;
  if (!p) return "";
  const solved = v.flags[p.solvedFlag];
  return `<section class="puzzle"><div class="puzzle-top"><h2 id="puzzle-heading" tabindex="-1">${escape(p.prompt)}</h2><span>${solved ? "✓ SOLVED" : "HANDS ON"}</span></div><p>${escape(p.clue)}</p><div class="puzzle-slots" aria-label="Your sequence">${p.solution.map((_, i) => `<span class="${v.puzzle[i] ? "filled" : ""}">${escape(p.options.find((o) => o.id === v.puzzle[i])?.label || String(i + 1).padStart(2, "0"))}</span>`).join("")}</div>${solved ? `<p class="puzzle-success">${escape(p.success)}</p>` : `<div class="puzzle-options">${p.options.map((o) => `<button data-puzzle="${o.id}"><span aria-hidden="true">${o.glyph}</span>${escape(o.label)}</button>`).join("")}<button id="clear-puzzle" class="puzzle-clear">Clear ↺</button></div>`}</section>`;
}
function renderPanel(ep, v) {
  if (panel === "journal")
    return `${v.clues.length ? `<ol class="clue-list">${v.clues.map((c, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span><p>${escape(c)}</p></li>`).join("")}</ol>` : '<div class="empty-bag"><span>⌕</span><p>No clues recorded yet.</p><small>Look closely. Inspecting a scene costs no turns.</small></div>'}<details class="history"><summary>Journey log</summary>${v.log
      .slice(-30)
      .map(
        (e) => `<p><small>${e.turn} / ${e.kind}</small>${escape(e.text)}</p>`,
      )
      .join("")}</details>`;
  if (panel === "map")
    return `<ol class="trail-list">${v.visited.map((id) => `<li class="${v.scene === id ? "current" : ""}"><span>${v.scene === id ? "◆" : "○"}</span>${escape(ep.scenes[id].title)}${ep.scenes[id].checkpoint ? "<small>TURNING POINT</small>" : ""}</li>`).join("")}</ol>${v.checkpoint ? '<button id="rewind" class="button secondary full">Replay from last turning point ↶</button>' : ""}<p class="fineprint">Your trail shows places you have discovered. Replaying replaces the current browser save.</p>`;
  return `<div class="bag-heading"><span>YOUR SATCHEL</span><span>${String(v.inventory.length).padStart(2, "0")} OBJECTS</span></div>${v.inventory.length ? `<div class="inventory-grid">${v.inventoryItems.map((i) => `<button class="inventory-item ${selectedItem === i.id ? "selected" : ""}" data-item="${i.id}" aria-expanded="${selectedItem === i.id}"><span class="item-glyph" aria-hidden="true">${i.glyph}</span><span>${escape(i.name)}</span></button>`).join("")}</div>${selectedItem ? `<div class="item-detail"><b>${escape(ep.items[selectedItem].name)}</b><p>${escape(ep.items[selectedItem].description)}</p><small>${v.actions.some((a) => a.uses === selectedItem && a.enabled) ? "USE AVAILABLE IN YOUR MOVE" : "Select a matching action when the situation allows."}</small></div>` : ""}` : '<div class="empty-bag"><span>◇</span><p>A little room for possibility.</p><small>Collect objects by interacting with the scene.</small></div>'}${v.recipes.length ? `<div class="crafting"><span class="eyebrow">PUT THINGS TOGETHER</span>${v.recipes.map((r) => `<button data-recipe="${r.id}">${escape(r.label)} <span>＋</span><small>${r.ingredients.map((id) => escape(ep.items[id].name)).join(" + ")} · 1 turn</small></button>`).join("")}</div>` : ""}`;
}
function renderEnding(ep, v) {
  const meaningful = v.log.filter((e) => e.kind === "action").slice(-4);
  return `<div class="ending-reflection"><span class="eyebrow">${escape(v.endingData.kind)} / ${(discoveries[ep.id] ?? []).length} OF 3 FOUND</span><p>${escape(v.endingData.reflection)}</p><h2>The footsteps that brought you here</h2><ul>${meaningful.map((e) => `<li>${escape(e.text)}</li>`).join("")}</ul><div class="ending-buttons">${v.checkpoint ? '<button id="rewind" class="button">Try the last turning point ↶</button>' : ""}<button id="another-story" class="button secondary">Choose another tale →</button></div></div>`;
}
function showThemes() {
  const ep = game.episode;
  showDialog(
    "Where should the tale turn?",
    `<p>Choose once per journey. This takes one turn and changes events, solutions, and possible endings.</p><div class="theme-choices">${Object.entries(
      ep.themes,
    )
      .filter(([id]) => id !== game.state.theme)
      .map(
        ([id, t]) =>
          `<button data-theme="${id}"><span>${t.icon}</span><b>${escape(t.name)}</b><p>${escape(t.description)}</p><small>${escape(t.effect)}</small></button>`,
      )
      .join("")}</div>`,
  );
  bind(
    "[data-theme]",
    (el) => {
      modal.close();
      act({ type: "SHIFT_THEME", id: el.dataset.theme });
    },
    modal,
  );
}
function exportSave() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(game.save(), null, 2)], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `hadithi-${game.episode.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Journey exported. Import it through Settings on another browser.");
}
document.addEventListener("keydown", (event) => {
  if (
    !game ||
    modal.open ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)
  )
    return;
  const index = Number(event.key) - 1;
  if (index >= 0 && index < 5) {
    const action = game.view().actions[index];
    if (action?.enabled) {
      event.preventDefault();
      act({ type: action.type, id: action.id });
    }
  }
});
library();
