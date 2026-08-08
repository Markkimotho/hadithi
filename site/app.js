import { Game, newSeed, seedCode, parseSeedCode } from "./game.js";
import { episodes, episodeById, regions } from "./stories.js";
import { read, write, perTale, chronicle, MAX_CHRONICLE, storageFailed, onStorageFailure } from "./ui/storage.js";
import * as audio from "./ui/audio.js";
import { mountWeather } from "./ui/atmosphere.js";
import { escape, diceTray, oddsBadge, mapSvg } from "./ui/widgets.js";

const $ = (selector) => document.querySelector(selector);
const flat = (title) => title.replace("\n", " ");
const pad = (n) => String(n).padStart(2, "0");

// ── Persistent player state ───────────────────────────────────────────────
let settings = {
  sound: false,
  ambience: false,
  volume: 60,
  motion: !matchMedia("(prefers-reduced-motion: reduce)").matches,
  size: "normal",
  assist: false,
  carryEchoes: true,
  ...read("settings", {}),
};
const discoveries = perTale("discoveries", episodes, (ep, id) => Object.hasOwn(ep.endings, id));
const knownEchoes = perTale("echoes", episodes, (ep, id) => Object.hasOwn(ep.echoes ?? {}, id));
const earnedMarks = perTale("marks", episodes, (ep, id) => (ep.marks ?? []).some((m) => m.id === id));
const runs = chronicle(episodes);
const tips = new Set(read("tips", []));
const recorded = read("recorded", {});

// ── Session UI state ──────────────────────────────────────────────────────
let game = null,
  panel = "inventory",
  selectedItem = null,
  selectedClues = [],
  filter = "All tales",
  trayRoll = null,
  trayFresh = false,
  animateNext = false,
  endingNews = null,
  toastTimer;
const main = $("#main"),
  modal = $("#modal");

onStorageFailure(() => toast("Browser storage is unavailable. Export a save to keep this journey."));

function toast(text, ms = 4200) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, ms);
}
function bind(selector, action, scope = document) {
  scope.querySelectorAll(selector).forEach((el) => el.addEventListener("click", () => action(el)));
}
function saveSettings() {
  write("settings", settings);
  applySettings();
}
function applySettings() {
  document.body.dataset.motion = settings.motion ? "on" : "off";
  document.body.dataset.text = settings.size;
  audio.configure({ sfx: settings.sound, ambience: settings.ambience, volume: settings.volume / 100 });
  const on = settings.sound || settings.ambience;
  const button = $("#sound-link");
  button.setAttribute("aria-pressed", String(on));
  button.querySelector("span").textContent = on ? "Sound on" : "Sound off";

}
applySettings();
$("#sound-link").addEventListener("click", () => {
  const on = !(settings.sound || settings.ambience);
  settings.sound = on;
  settings.ambience = on;
  saveSettings();
  audio.sfx("click");
  toast(on ? "Sound on: effects and ambience. Adjust in Settings." : "Sound off.");
});
document.addEventListener("visibilitychange", () => (document.hidden ? audio.pause() : audio.resume()));

// ── Dialogs ───────────────────────────────────────────────────────────────
function showDialog(title, content, eyebrow = "Hadithi") {
  $("#modal-body").innerHTML = `<span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${escape(title)}</h2>${content}`;
  if (!modal.open) modal.showModal();
}
$("#close-modal").addEventListener("click", () => modal.close());
modal.addEventListener("click", (event) => {
  if (event.target !== modal) return;
  const r = modal.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) modal.close();
});

function sources(id) {
  const list = id ? [episodeById(id)] : episodes;
  showDialog(
    "Where the stories began",
    `<p>These are new interactive adaptations of traditional tales. The objects, dice, deductions, and alternative endings are part of the game. Every tradition has more than one telling.</p>${list
      .map(
        (ep) =>
          `<article class="source-note"><span class="eyebrow">${escape(ep.tradition)}</span><h3>${escape(flat(ep.title))}</h3><p><cite>${escape(ep.source.title)}</cite><br>${escape(ep.source.by)} · ${escape(ep.source.year)}</p><p>${escape(ep.source.note)}</p><p class="fineprint">Play as ${escape(ep.role)}. Content notes: ${escape(ep.notes)}</p><p class="fineprint">${escape(ep.source.rights)}</p><a href="${escape(ep.source.url)}" target="_blank" rel="noopener noreferrer">Read the source collection ↗</a></article>`,
      )
      .join("")}<p class="fineprint">Source records checked ${escape(episodes[0].source.checked)}. International edition rights and regional editorial review remain release checks. Illustrations, sound, game text, and interface were created for Hadithi. No source illustrations or ebook text are included.</p>`,
  );
}
$("#sources-link").addEventListener("click", () => sources());
$("#footer-sources").addEventListener("click", () => sources());

function showHelp() {
  showDialog(
    "How a telling works",
    `<div class="help-grid">
      <section><h3>⌕ Look, then act</h3><p>Inspecting, reading clues, and thinking are free. Every other action shows its cost in turns. The world moves when turns pass: weather, tides, patrols, and moonrise do not wait.</p></section>
      <section><h3>⚄ Dice checks</h3><p>Some actions roll two dice plus your stats and advantages against a difficulty. The exact odds and every modifier are shown before you commit. <b>One try</b> checks cannot be repeated. <b>Retry</b> checks can be attempted again once your odds improve. Failure always moves the story; it is never a wall. Each journey has a seed, so undoing cannot reroll fate.</p></section>
      <section><h3>⟷ Connect clues</h3><p>Open <b>Mind</b>, choose two clues, and connect them. A true connection becomes a conclusion that opens new conversations, arguments, and endings. A wrong one costs nothing.</p></section>
      <section><h3>◈ Echoes</h3><p>Every ending teaches you something. Echoes carry that knowledge into your next telling and reveal <b>remembered</b> actions that were not there before. Each tale hides one ending that only remembered knowledge can reach.</p></section>
      <section><h3>★ Marks</h3><p>Marks recognise how you played: travelling light, thinking clearly, keeping the peace. They are listed in the Chronicle.</p></section>
      <section><h3>✧ Direction</h3><p>Once per journey you can turn the tale toward a different genre. It changes scenes, solutions, and endings, not just colours.</p></section>
    </div>
    <h3>Keyboard</h3>
    <dl class="keys"><dt>1–9</dt><dd>Take the matching action</dd><dt>U</dt><dd>Undo one step</dd><dt>B · J · P · M</dt><dd>Bag, Mind, People, Map</dd><dt>S</dt><dd>Sound on or off</dd><dt>?</dt><dd>This guide</dd></dl>`,
  );
}
$("#help-link").addEventListener("click", showHelp);

function showSettings() {
  const row = (id, label, hint, control) =>
    `<div class="setting-row"><label for="${id}">${label}<small>${hint}</small></label>${control}</div>`;
  const check = (id, on) => `<input id="${id}" type="checkbox" ${on ? "checked" : ""}>`;
  showDialog(
    "Settle into the story",
    `<p>Time advances with your actions. Reading, inspecting your bag, thinking, and opening the journal never run down a clock.</p>
    <h3 class="setting-group">Sound</h3>
    ${row("sound", "Sound effects", "Dice, discoveries, interruptions. Off by default.", check("sound", settings.sound))}
    ${row("ambience", "Ambience", "Procedural rain, sea, market, and night. Generated live; no recordings.", check("ambience", settings.ambience))}
    ${row("volume", "Volume", `${settings.volume}%`, `<input id="volume" type="range" min="0" max="100" step="5" value="${settings.volume}">`)}
    <h3 class="setting-group">Comfort</h3>
    ${row("motion", "Scene motion", "Weather, dice tumbling, and encounter feedback.", check("motion", settings.motion))}
    ${row("text-size", "Story text size", "Applies to story and journal text.", `<select id="text-size">${[["normal", "Standard"], ["large", "Large"], ["larger", "Larger"]].map(([v, l]) => `<option value="${v}" ${settings.size === v ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
    ${row("assist", "Storyteller’s grace", "New journeys add +2 to every dice check. Shown in every roll.", check("assist", settings.assist))}
    ${row("carry", "Carry echoes", "New journeys remember what earlier endings taught you.", check("carry", settings.carryEchoes))}
    <p class="fineprint">Keyboard: Tab to move, Enter to act, 1–9 for actions, U to undo, ? for the guide. Progress saves after every action on this browser.</p>
    <div class="dialog-actions"><button class="button secondary" id="import-save">Import a journey</button><button class="button secondary" id="open-help">How to play</button></div>`,
  );
  for (const [id, key] of [["sound", "sound"], ["ambience", "ambience"], ["motion", "motion"], ["assist", "assist"], ["carry", "carryEchoes"]])
    $(`#${id}`).addEventListener("change", (event) => {
      settings[key] = event.target.checked;
      saveSettings();
      if (key === "sound") audio.sfx("click");
      if (key === "motion" && game) renderGame();
    });
  $("#volume").addEventListener("input", (event) => {
    settings.volume = Number(event.target.value);
    event.target.closest(".setting-row").querySelector("small").textContent = `${settings.volume}%`;
    saveSettings();
  });
  $("#text-size").addEventListener("change", (event) => {
    settings.size = event.target.value;
    saveSettings();
  });
  $("#import-save").addEventListener("click", () => $("#import-file").click());
  $("#open-help").addEventListener("click", showHelp);
}
$("#settings-link").addEventListener("click", showSettings);
$("#import-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1000000) throw new Error("This file is too large to be a Hadithi save.");
    const save = JSON.parse(await file.text());
    const ep = episodeById(save?.episodeId);
    if (!ep) throw new Error("This story is not in the collection.");
    game = Game.load(ep, save);
    panel = "mind";
    trayRoll = null;
    modal.close();
    persist();
    renderGame();
    toast(game.migratedFrom ? "Journey imported and carried into this edition." : "Journey imported.");
  } catch (error) {
    toast(error.message || "This save could not be imported.");
  } finally {
    event.target.value = "";
  }
});

// ── Chronicle: endings, echoes, marks, and past runs ──────────────────────
function showChronicle(id) {
  const list = id ? [episodeById(id)] : episodes;
  showDialog(
    "The chronicle",
    `<p>Everything this browser remembers: endings found, echoes learned, marks earned, and recent tellings with their seeds.</p>${list
      .map((ep) => {
        const found = discoveries[ep.id];
        const echoes = knownEchoes[ep.id];
        const marks = earnedMarks[ep.id];
        return `<article class="chronicle-tale"><span class="eyebrow">Tale ${Number(ep.number)} · ${escape(ep.tradition)}</span><h3>${escape(flat(ep.title))}</h3>
        <h4>Endings <small>${found.length}/${Object.keys(ep.endings).length}</small></h4><ul class="ending-list">${Object.entries(ep.endings)
          .map(([eid, e]) =>
            found.includes(eid)
              ? `<li class="found"><b>${escape(e.title)}</b><small>${escape(e.kind)}</small></li>`
              : `<li class="${e.secret ? "secret" : ""}"><b>${e.secret ? "A secret ending" : "Undiscovered"}</b><small>${e.secret ? "Reached only with remembered knowledge" : escape(e.kind)}</small></li>`,
          )
          .join("")}</ul>
        <h4>Echoes <small>${echoes.length}/${Object.keys(ep.echoes).length}</small></h4>${
          echoes.length
            ? `<ul class="echo-list">${echoes.map((x) => `<li><b>◈ ${escape(ep.echoes[x].title)}</b><p>${escape(ep.echoes[x].text)}</p></li>`).join("")}</ul>`
            : "<p class=\"fineprint\">No echoes yet. Each ending teaches one.</p>"
        }
        <h4>Marks <small>${marks.length}/${ep.marks.length}</small></h4><ul class="mark-list">${ep.marks
          .map((m) => `<li class="${marks.includes(m.id) ? "earned" : ""}"><b>${marks.includes(m.id) ? "★" : "☆"} ${escape(m.title)}</b><small>${escape(m.text)}</small></li>`)
          .join("")}</ul>
        ${
          runs[ep.id].length
            ? `<h4>Recent tellings</h4><table class="runs"><thead><tr><th>Ending</th><th>Turns</th><th>Dice</th><th>Seed</th></tr></thead><tbody>${runs[ep.id]
                .slice(0, 8)
                .map(
                  (r) =>
                    `<tr><td>${escape(ep.endings[r.ending].title)}</td><td>${r.turns}</td><td>${r.passed}✓ ${r.failed}✗</td><td><code>${escape(seedCode(r.seed))}</code></td></tr>`,
                )
                .join("")}</tbody></table>`
            : ""
        }</article>`;
      })
      .join("")}`,
    "Your chronicle",
  );
}
$("#chronicle-link").addEventListener("click", () => showChronicle());

// ── The shelf ─────────────────────────────────────────────────────────────
function endingSlots(ep) {
  return Object.entries(ep.endings)
    .map(([id, e]) => {
      const found = discoveries[ep.id].includes(id);
      return `<span class="slot ${found ? "found" : ""} ${e.secret ? "secret" : ""}" title="${found ? escape(e.title) : e.secret ? "Secret ending" : "Undiscovered ending"}">${e.secret ? "✦" : "◆"}</span>`;
    })
    .join("");
}
function library() {
  game = null;
  selectedItem = null;
  trayRoll = null;
  audio.setAmbience("none");
  main.className = "collection";
  delete main.dataset.theme;
  document.title = "Hadithi · Old tales you can play";
  const total = episodes.reduce((n, ep) => n + Object.keys(ep.endings).length, 0);
  const secrets = episodes.reduce((n, ep) => n + Object.values(ep.endings).filter((e) => e.secret).length, 0);
  const found = Object.values(discoveries).reduce((n, list) => n + list.length, 0);
  main.innerHTML = `<section class="collection-intro"><div class="intro-copy"><div class="edition"><span class="small-star">✳</span> Second edition <span class="rule"></span> ${episodes.length} tales</div><h1>Four old stories,<br>and <em>you in each one.</em></h1><p>Chase Anansi and his pot into the rain. Ride a turtle down to the sea palace. Scare robbers out of a house with a donkey, a dog, a cat and a rooster. Win back a jar of gold with a children’s game.</p><div class="intro-meta"><span>${episodes.length} tales</span><span>${total - secrets} endings, ${secrets} hidden</span><span>Saves as you go</span></div></div><div class="atlas-seal" aria-hidden="true"><span class="seal-top">Hadithi</span><div class="compass"><span class="compass-letter north">N</span><span class="compass-letter east">E</span><span class="compass-letter south">S</span><span class="compass-letter west">W</span><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="90"/><circle cx="100" cy="100" r="74"/><path d="m100 12 12 76 76 12-76 12-12 76-12-76-76-12 76-12z"/><path class="needle" d="m100 28 12 60 60 12-72 0zM100 172l-12-60-60-12h72z"/><path d="m46 46 54 32 54-32-32 54 32 54-54-32-54 32 32-54z"/><circle cx="100" cy="100" r="8"/></svg></div><span class="seal-bottom">Ghana · Japan · Germany · Baghdad</span></div></section>
  <section class="shelf"><div class="shelf-header"><div><span class="eyebrow">Pick a tale</span><h2>The collection</h2></div><button class="discovery-count" id="shelf-chronicle">${found} of ${total} endings found · Chronicle ↗</button></div><div class="filters" role="group" aria-label="Filter stories">${["All tales", ...regions]
    .map((f) => `<button class="filter ${filter === f ? "active" : ""}" data-filter="${f}" aria-pressed="${filter === f}">${f}</button>`)
    .join("")}<span class="filter-note">Free. No account.</span></div><div class="story-grid">${episodes
    .filter((ep) => filter === "All tales" || ep.region === filter)
    .map((ep) => {
      const save = read(`save.${ep.id}`, null);
      const echoes = knownEchoes[ep.id].length;
      const marks = earnedMarks[ep.id].length;
      return `<article class="story-card ${ep.id}"><div class="cover"><img src="./assets/${ep.id}.svg" alt="" /><div class="cover-top"><span>Tale ${Number(ep.number)}</span><span class="cover-region">${ep.region}</span></div><div class="cover-caption"><span>${escape(ep.genre)}</span><h3>${escape(ep.title).replace("\n", "<br>")}</h3></div><span class="cover-corner" aria-hidden="true">✧</span></div><div class="card-body"><div class="story-origin">${escape(ep.tradition)} <span>${ep.duration}</span></div><p>${escape(ep.hook)}</p><div class="card-bottom"><button class="button start-button" data-start="${ep.id}">${save ? "Resume journey" : "Enter the story"} <span>→</span></button><button class="source-button" data-source="${ep.id}" aria-label="Source notes for ${escape(flat(ep.title))}">ⓘ</button></div><div class="card-progress"><span class="slots" aria-label="${discoveries[ep.id].length} of ${Object.keys(ep.endings).length} endings found">${endingSlots(ep)}</span><span>${echoes ? `◈ ${echoes} echo${echoes === 1 ? "" : "es"}` : "No echoes yet"}</span><span>★ ${marks}/${ep.marks.length}</span></div><div class="card-foot"><span>${save ? "Saved in this browser" : "No account needed"}</span><button class="new-run" data-new="${ep.id}">${save ? "Begin again" : "Journey options"}</button></div></div></article>`;
    })
    .join("")}</div></section><section class="how-to"><span class="how-number">How to play</span><div><b>01. Look closely.</b><p>Inspect freely. Connect clues in your Mind.</p></div><div><b>02. Make your move.</b><p>Use your bag, your allies, and the dice.</p></div><div><b>03. Remember.</b><p>Each ending echoes into the next telling.</p></div><button class="how-help" id="shelf-help">The full guide ↗</button></section>`;
  bind("[data-filter]", (el) => {
    filter = el.dataset.filter;
    library();
    $(`[data-filter="${filter}"]`).focus({ preventScroll: true });
  });
  bind("[data-start]", (el) => start(el.dataset.start));
  bind("[data-new]", (el) => newJourney(el.dataset.new));
  bind("[data-source]", (el) => sources(el.dataset.source));
  $("#shelf-chronicle").onclick = () => showChronicle();
  $("#shelf-help").onclick = showHelp;
}
$("#brand").addEventListener("click", library);
$("#library-link").addEventListener("click", library);

/** A shared link can fix the dice: ?seed=CODE starts new journeys with it. */
const linkSeed = parseSeedCode(new URLSearchParams(location.search).get("seed"));
const freshSeed = () => linkSeed ?? newSeed();

function start(id, options = null) {
  const ep = episodeById(id);
  const save = !options && read(`save.${id}`, null);
  try {
    game = save
      ? Game.load(ep, save)
      : new Game(ep, options ?? { seed: freshSeed(), echoes: settings.carryEchoes ? knownEchoes[id] : [], assist: settings.assist });
  } catch (error) {
    showDialog(
      "A different edition",
      `<p>${escape(error.message)}</p><button class="button" id="fresh-start">Start a new journey →</button>`,
    );
    $("#fresh-start").onclick = () => {
      modal.close();
      start(id, { seed: freshSeed(), echoes: settings.carryEchoes ? knownEchoes[id] : [], assist: settings.assist });
    };
    return;
  }
  panel = "inventory";
  selectedItem = null;
  selectedClues = [];
  trayRoll = null;
  endingNews = null;
  persist();
  animateNext = true;
  renderGame();
  if (game.migratedFrom) toast("Your journey was carried into this edition of the tale.");
  else if (!save && game.state.echoes.length)
    toast(`◈ ${game.state.echoes.length} echo${game.state.echoes.length === 1 ? "" : "es"} from earlier tellings will shape this one.`, 5500);
  $("#scene-title")?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function newJourney(id) {
  const ep = episodeById(id);
  const echoes = knownEchoes[id];
  const hasSave = Boolean(read(`save.${id}`, null));
  showDialog(
    "A new telling",
    `<p>${hasSave ? `This replaces your current journey in <em>${escape(flat(ep.title))}</em>. ` : ""}Discovered endings, echoes, and marks stay in your chronicle.</p>
    <div class="setting-row"><label for="carry-now">Carry echoes<small>${
      echoes.length ? echoes.map((x) => `◈ ${escape(ep.echoes[x].title)}`).join(" · ") : "None yet: reach an ending to learn one."
    }</small></label><input id="carry-now" type="checkbox" ${settings.carryEchoes && echoes.length ? "checked" : ""} ${echoes.length ? "" : "disabled"}></div>
    <div class="setting-row"><label for="assist-now">Storyteller’s grace<small>+2 to every dice check this journey.</small></label><input id="assist-now" type="checkbox" ${settings.assist ? "checked" : ""}></div>
    <div class="setting-row"><label for="seed-now">Seed<small>Leave blank for fresh fortune, or enter a seed from your chronicle to replay the same dice.</small></label><input id="seed-now" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="7" placeholder="random" class="seed-input"></div>
    <div class="dialog-actions"><button class="button" id="begin-fresh">Begin →</button><button class="button secondary" id="keep-save">${hasSave ? "Keep my journey" : "Not yet"}</button></div>`,
    "A new telling",
  );
  $("#begin-fresh").onclick = () => {
    const code = $("#seed-now").value.trim();
    const seed = code ? parseSeedCode(code) : freshSeed();
    if (seed === null) {
      toast("A seed is up to seven letters and numbers.");
      return;
    }
    const options = { seed, echoes: $("#carry-now").checked ? echoes : [], assist: $("#assist-now").checked };
    modal.close();
    start(id, options);
  };
  $("#keep-save").onclick = () => modal.close();
}

// ── Persistence and ending bookkeeping ────────────────────────────────────
function persist() {
  if (!game) return;
  const id = game.episode.id;
  write(`save.${id}`, game.save());
  const s = game.state;
  if (!s.ending) return;
  const key = `${s.seed}:${s.actions.length}:${s.ending}`;
  if (recorded[id] === key) return;
  recorded[id] = key;
  write("recorded", recorded);
  const newEchoes = s.earnedEchoes.filter((x) => !knownEchoes[id].includes(x));
  const newMarks = s.marks.filter((x) => !earnedMarks[id].includes(x));
  const newEnding = !discoveries[id].includes(s.ending);
  endingNews = { key, echoes: newEchoes, marks: newMarks, ending: newEnding };
  if (newEnding) discoveries[id].push(s.ending);
  knownEchoes[id].push(...newEchoes);
  earnedMarks[id].push(...newMarks);
  const checks = Object.values(s.checks);
  runs[id].unshift({
    ending: s.ending,
    turns: s.turn,
    seed: s.seed,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.reduce((n, c) => n + c.failures, 0),
    deductions: s.deductions.length,
    marks: s.marks,
    date: new Date().toISOString(),
  });
  runs[id] = runs[id].slice(0, MAX_CHRONICLE);
  write("discoveries", discoveries);
  write("echoes", knownEchoes);
  write("marks", earnedMarks);
  write("chronicle", runs);
}

// ── Acting ────────────────────────────────────────────────────────────────
function act(command) {
  const before = game.state.log.length;
  const attempts = Object.values(game.state.checks).reduce((n, c) => n + c.attempts, 0);
  try {
    game.dispatch(command);
  } catch (error) {
    toast(error.message);
    return;
  }
  const fresh = game.state.log.slice(before);
  const rolled = Object.values(game.state.checks).reduce((n, c) => n + c.attempts, 0) > attempts;
  trayRoll = rolled ? game.state.lastRoll : command.type === "PUZZLE" || command.type === "CLEAR_PUZZLE" ? trayRoll : null;
  trayFresh = rolled;
  // Sound follows what actually happened, loudest moment first.
  const kinds = new Set(fresh.map((e) => e.kind));
  if (kinds.has("ending")) audio.sfx("ending");
  else if (kinds.has("encounter")) audio.sfx("interrupt");
  if (rolled) {
    audio.sfx("dice");
    audio.sfx(game.state.lastRoll.success ? "success" : "failure");
  } else if (kinds.has("deduction")) audio.sfx("deduction");
  else if (kinds.has("deduction-miss")) audio.sfx("wrong");
  else if (command.type === "TAKE_ITEM" || command.type === "COMBINE") audio.sfx("take");
  else if (!kinds.has("ending") && !kinds.has("encounter")) audio.sfx("click");
  if (command.type === "DEDUCE") selectedClues = [];
  persist();
  selectedItem = null;
  animateNext = true;
  renderGame();
  const spoken = fresh
    .filter((e) => e.kind !== "action")
    .map((e) => e.text)
    .join(" ");
  $("#announcement").textContent = `${game.view().title}. ${spoken}`;
  if (command.type === "DEDUCE") $("#tab-mind")?.focus({ preventScroll: true });
  else if (command.type !== "PUZZLE" && command.type !== "CLEAR_PUZZLE") {
    $("#scene-title")?.focus({ preventScroll: true });
    if (matchMedia("(max-width: 620px)").matches) $("#scene-title")?.scrollIntoView({ block: "start", behavior: "instant" });
  } else if (game.state.puzzle.length === 0) ($("#puzzle-heading") || $("#scene-title"))?.focus({ preventScroll: true });
  else $(`[data-puzzle="${command.id}"]`)?.focus({ preventScroll: true });
}
function undo() {
  if (!game?.view().canUndo) return;
  try {
    game = game.undo();
  } catch (error) {
    toast(error.message);
    return;
  }
  trayRoll = null;
  persist();
  renderGame();
  audio.sfx("click");
  toast("One step undone. The dice remember: the same choice rolls the same way.");
  $("#scene-title")?.focus({ preventScroll: true });
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
const verbs = {
  TRAVEL: "Go",
  TAKE_ITEM: "Take",
  USE_ITEM: "Use",
  TALK: "Talk",
  BARGAIN: "Bargain",
  SOLVE: "Try",
  WAIT: "Wait",
  CHOOSE: "Choose",
};

function showTip(v) {
  const offer = (id, text) => {
    if (tips.has(id)) return false;
    tips.add(id);
    write("tips", [...tips]);
    setTimeout(() => toast(text, 7000), 450);
    return true;
  };
  if (v.ending) return;
  if (v.actions.some((a) => a.odds) && offer("check", "⚄ Dice checks show your exact odds before you commit. Hover or focus one to see every modifier.")) return;
  if (v.clues.length >= 2 && !v.deductions.length && panel !== "mind" && offer("mind", "⟷ You have two clues. Open Mind to connect them; thinking never costs a turn.")) return;
  if (v.actions.some((a) => a.remembered) && offer("echo", "◈ A remembered action: an echo from an earlier telling has opened something new.")) return;
}

// ── Rendering the play screen ─────────────────────────────────────────────
function renderGame() {
  if (!game) return;
  const ep = game.episode,
    v = game.view(),
    atm = v.atmosphere;
  document.title = `${flat(ep.title)} · Hadithi`;
  main.className = `play-screen ${ep.id}`;
  main.dataset.theme = v.theme;
  const status = v.ending ? "The tale is told" : v.encounter ? "Interrupted" : "On the road";
  main.innerHTML = `<div class="journey-heading"><button class="back-link" id="back-library">← The collection</button><span>${escape(ep.tradition)} <span class="separator">/</span> Tale ${Number(ep.number)}</span><button class="back-link" id="story-source">Source notes ↗</button></div>
  <div class="game-cabinet"><div class="cabinet-bar"><span class="status-light"></span><span>${status}</span><span class="bar-right"><button id="undo" ${v.canUndo ? "" : "disabled"} aria-keyshortcuts="U">↶ Undo</button><span class="seed" title="This journey’s seed. Enter it in a new telling to replay the same dice.">Seed ${seedCode(v.seed)}</span>${v.assist ? '<span class="grace" title="Storyteller’s grace: +2 to every check">Grace +2</span>' : ""}${v.echoes.length ? `<span class="echo-count" title="Echoes carried into this telling">◈ ${v.echoes.length}</span>` : ""}</span></div>
  <div class="game-layout"><section class="play-column" aria-label="Current scene">
    <div class="scene-stage ${v.encounter ? "interrupted" : ""}" data-weather="${atm.weather}"><img class="scene-image" src="./assets/${v.sceneArt}.svg" alt="" /><div class="light-layer" data-light="${atm.light}"></div><canvas class="weather-layer" aria-hidden="true"></canvas><div class="stage-grid" aria-hidden="true"></div><div class="scene-location"><span class="eyebrow">${escape(v.kicker)}</span><span class="location-marker">⌖</span></div>${
      v.ending
        ? '<div class="ending-seal" aria-hidden="true">✧</div>'
        : v.actions
            .filter((a) => a.spot && a.enabled)
            .map((a) => `<button class="hotspot" style="--x:${a.spot[0]}%;--y:${a.spot[1]}%" data-hotspot="${a.id}" aria-label="On scene: ${escape(a.label)}"><span>＋</span><small>${escape(a.label)}</small></button>`)
            .join("")
    }<div class="stage-bottom"><span>${escape(ep.role)}</span><span class="clock">${atm.light[0].toUpperCase()}${atm.light.slice(1)}</span><span>${escape(ep.themes[v.theme].name)} ${ep.themes[v.theme].icon}</span></div></div>
    <div class="narrative ${animateNext ? "enter" : ""}"><div class="chapter-line"><span>${v.ending ? "How it ended" : v.encounter ? "Interrupted" : escape(v.kicker)}</span><span>Turn ${v.turn}</span></div><h1 id="scene-title" tabindex="-1">${escape(v.endingData?.title || v.title)}</h1><p class="story-text">${escape(v.endingData?.text || v.description)}</p>${v.variant && !v.ending ? `<p class="scene-variant">${escape(v.variant)}</p>` : ""}${trayRoll ? diceTray(trayRoll, ep.statLabels, { fresh: trayFresh && settings.motion }) : ""}${renderConsequence(v)}${v.ending ? renderEnding(ep, v) : `${renderPuzzle(v)}<div class="action-heading"><span>What do you do?</span><span>Looking is free. Doing takes a turn.</span></div><div class="actions">${v.actions.map((a, i) => renderAction(ep, a, i)).join("")}</div>`}</div></section>
  <aside class="field-panel" aria-label="Your field journal"><div class="field-panel-head"><span>Journal</span><span>${escape(ep.themes[v.theme].name)}</span></div><div class="objective"><span class="eyebrow">${v.ending ? "What it meant" : "What you want"}</span><p>${escape(v.endingData?.reflection || v.objective)}</p></div><div class="stats">${Object.entries(v.stats)
    .map(([key, n]) => `<div><label>${escape(ep.statLabels[key])}<b>${n}<small>/10</small></b></label><div class="stat-track"><span style="width:${n * 10}%"></span></div></div>`)
    .join("")}</div><div class="panel-tabs" role="tablist" aria-label="Field journal sections">${[
    ["inventory", "Bag", v.inventory.length, "B"],
    ["mind", "Mind", v.clues.length, "J"],
    ["people", "People", v.people.length, "P"],
    ["map", "Map", v.map.nodes.length, "M"],
  ]
    .map(
      ([id, label, n, key]) =>
        `<button id="tab-${id}" role="tab" aria-controls="panel-content" aria-selected="${panel === id}" aria-keyshortcuts="${key}" data-panel="${id}" ${panel === id ? 'class="selected"' : ""}>${label} <small>${n}</small></button>`,
    )
    .join("")}</div><div id="panel-content" role="tabpanel" aria-labelledby="tab-${panel}" class="panel-content">${renderPanel(ep, v)}</div><div class="theme-box"><span class="eyebrow">What kind of story</span><button id="shift-theme" ${v.flags.themeShifted || v.encounter || v.ending ? "disabled" : ""}><span>${ep.themes[v.theme].icon} ${escape(ep.themes[v.theme].name)}</span><span>${v.flags.themeShifted ? "Already turned" : "Turn the tale ↗"}</span></button><p>${v.flags.themeShifted ? "Your chosen direction is changing the events ahead." : "One turning point per journey. Choose a new genre and change what can happen."}</p></div><div class="save-tools"><span id="save-label">${storageFailed() ? "This browser will not keep your save. Export it." : "✓ Saved in this browser"}</span><button id="export-save">Export save ↓</button></div></aside></div>
  <div class="cabinet-footer"><span>${escape(flat(ep.title))}</span><span>${escape(ep.tradition)}</span><button id="restart-story">Begin again ↺</button></div></div>`;

  // Animate a move once; tab switches and other re-renders show it settled.
  trayFresh = false;
  animateNext = false;
  mountWeather(main.querySelector(".weather-layer"), atm.weather, settings.motion);
  audio.setAmbience(atm.ambience);
  $("#back-library").onclick = library;
  $("#story-source").onclick = () => sources(ep.id);
  $("#restart-story").onclick = () => newJourney(ep.id);
  $("#shift-theme").onclick = showThemes;
  $("#export-save").onclick = exportSave;
  $("#undo").onclick = undo;
  bind("[data-action]", (el) => {
    const a = v.actions.find((x) => x.id === el.dataset.action);
    act({ type: a.type, id: a.id });
  });
  bind("[data-hotspot]", (el) => {
    const a = v.actions.find((x) => x.id === el.dataset.hotspot);
    act({ type: a.type, id: a.id });
  });
  bind("[data-travel]", (el) => {
    const a = v.actions.find((x) => x.id === el.dataset.travel);
    if (a?.enabled) act({ type: a.type, id: a.id });
  });
  bind("[data-panel]", (el) => switchPanel(el.dataset.panel));
  bind("[data-item]", (el) => {
    const id = el.dataset.item;
    selectedItem = selectedItem === id ? null : id;
    renderGame();
    $(`[data-item="${id}"]`).focus({ preventScroll: true });
  });
  bind("[data-clue]", (el) => {
    const id = el.dataset.clue;
    selectedClues = selectedClues.includes(id) ? selectedClues.filter((x) => x !== id) : [...selectedClues.slice(-1), id];
    renderGame();
    $(`[data-clue="${id}"]`).focus({ preventScroll: true });
  });
  if ($("#connect")) $("#connect").onclick = () => act({ type: "DEDUCE", ids: selectedClues });
  bind("[data-recipe]", (el) => act({ type: "COMBINE", id: el.dataset.recipe }));
  bind("[data-puzzle]", (el) => act({ type: "PUZZLE", id: el.dataset.puzzle }));
  if ($("#clear-puzzle")) $("#clear-puzzle").onclick = () => act({ type: "CLEAR_PUZZLE" });
  bind("#rewind, #rewind-map", () => {
    game = game.rewind();
    trayRoll = null;
    persist();
    renderGame();
    toast("Returned to your last turning point.");
  });
  if ($("#another-story")) $("#another-story").onclick = library;
  if ($("#retell")) $("#retell").onclick = () => newJourney(ep.id);
  if ($("#open-chronicle")) $("#open-chronicle").onclick = () => showChronicle(ep.id);
  showTip(v);
}

function switchPanel(id) {
  panel = id;
  selectedItem = null;
  renderGame();
  $(`#tab-${panel}`)?.focus({ preventScroll: true });
}

function renderAction(ep, a, i) {
  let meta;
  if (!a.enabled) meta = `<small class="requires">${escape(a.requires || "Complete the puzzle first")}</small>`;
  else if (a.odds) meta = `<small>${oddsBadge(a.odds, ep.statLabels)}</small>`;
  else meta = `<small>${a.type === "INSPECT" ? "Look · free" : `${verbs[a.type] ?? "Act"} · ${a.cost ?? 1} ${(a.cost ?? 1) === 1 ? "turn" : "turns"}`}</small>`;
  return `<button class="action-button ${a.enabled ? "" : "unavailable"} ${a.odds ? `check ${a.odds.kind}` : ""} ${a.remembered ? "remembered" : ""}" data-action="${a.id}" ${a.enabled ? "" : "disabled"}><span class="action-icon" aria-hidden="true">${a.odds ? "⚄" : actionIcons[a.type]}</span><span>${a.remembered ? '<em class="remembered-badge">◈ Remembered</em>' : ""}<b>${escape(a.label)}</b>${meta}</span>${i < 9 ? `<span class="action-key" aria-hidden="true">${i + 1}</span>` : ""}</button>`;
}

function renderConsequence(v) {
  if (v.ending) return "";
  const start = v.log.findLastIndex((e) => ["action", "deduction", "deduction-miss"].includes(e.kind));
  const recent = v.log.slice(Math.max(0, start)).filter((e) => e.kind !== "action" && e.kind !== "roll");
  if (!recent.length) return "";
  const label = { world: "Meanwhile", encounter: "Interrupted", consequence: "What happened", deduction: "It fits", "deduction-miss": "It does not fit" };
  const cls = { encounter: "encounter-note", deduction: "deduction-note", "deduction-miss": "miss-note" };
  const shown = recent.map((e) => (e.kind === "deduction" ? { ...e, title: true } : e));
  const worlds = shown.filter((e) => e.kind === "world");
  const keep = shown.filter((e) => e.kind !== "world" || worlds.slice(-2).includes(e));
  return keep
    .map(
      (e) =>
        `<div class="consequence ${cls[e.kind] ?? ""} ${trayFresh && settings.motion ? "after-roll" : ""} ${animateNext ? "enter" : ""}"><span>${label[e.kind] ?? "What happened"}</span><p>${e.title ? `<b>${escape(e.text)}</b>` : escape(e.text)}</p></div>`,
    )
    .join("");
}

function renderPuzzle(v) {
  const p = v.puzzleData;
  if (!p) return "";
  const solved = v.flags[p.solvedFlag];
  return `<section class="puzzle"><div class="puzzle-top"><h2 id="puzzle-heading" tabindex="-1">${escape(p.prompt)}</h2><span>${solved ? "✓ Solved" : "Your turn"}</span></div><p>${escape(p.clue)}</p><div class="puzzle-slots" aria-label="Your sequence">${p.solution
    .map((_, i) => `<span class="${v.puzzle[i] ? "filled" : ""}">${escape(p.options.find((o) => o.id === v.puzzle[i])?.label || pad(i + 1))}</span>`)
    .join("")}</div>${
    solved
      ? `<p class="puzzle-success">${escape(p.success)}</p>`
      : `<div class="puzzle-options">${p.options.map((o) => `<button data-puzzle="${o.id}"><span aria-hidden="true">${o.glyph}</span>${escape(o.label)}</button>`).join("")}<button id="clear-puzzle" class="puzzle-clear">Clear ↺</button></div>`
  }</section>`;
}

function renderPanel(ep, v) {
  if (panel === "mind") {
    const used = new Set(v.deductionItems.flatMap((d) => d.from));
    const ready = selectedClues.length === 2 && selectedClues.every((id) => v.clues.includes(id));
    return `<div class="bag-heading"><span>What you know</span><span>${v.clues.length >= 2 ? "Pick two that fit together" : "Look around to learn more"}</span></div>${
      v.clueItems.length
        ? `<ol class="clue-list selectable">${v.clueItems
            .map(
              (c, i) =>
                `<li><button data-clue="${c.id}" aria-pressed="${selectedClues.includes(c.id)}" class="${used.has(c.id) ? "used" : ""}"><span>${pad(i + 1)}</span><p>${escape(c.text)}</p>${used.has(c.id) ? '<i aria-label="used in a conclusion">◆</i>' : ""}</button></li>`,
            )
            .join("")}</ol><button id="connect" class="button full connect" ${ready ? "" : "disabled"}>${ready ? "Connect these two clues ⟷" : `Select ${2 - Math.min(2, selectedClues.length)} more clue${selectedClues.length === 1 ? "" : "s"}`}</button>`
        : '<div class="empty-bag"><span>⌕</span><p>No clues recorded yet.</p><small>Look closely. Inspecting a scene costs no turns.</small></div>'
    }<div class="conclusions"><span class="eyebrow">Worked out: ${v.deductions.length} of ${v.deductionsTotal}</span>${
      v.deductionItems.length
        ? v.deductionItems.map((d) => `<article class="conclusion"><b>⟷ ${escape(d.title)}</b><p>${escape(d.text)}</p></article>`).join("")
        : '<p class="fineprint">Conclusions you reach will appear here, and open new possibilities.</p>'
    }${v.wrongLinks ? `<p class="fineprint">${v.wrongLinks} connection${v.wrongLinks === 1 ? "" : "s"} that did not hold.</p>` : ""}</div><details class="history"><summary>Journey log</summary>${v.log
      .slice(-40)
      .map((e) => `<p class="log-${e.kind}"><small>${e.turn} / ${e.kind}</small>${escape(e.text)}</p>`)
      .join("")}</details>`;
  }
  if (panel === "people")
    return v.people.length
      ? `<ul class="people-list">${v.people
          .map(
            (p) =>
              `<li><span class="person-glyph" aria-hidden="true">${p.glyph}</span><div><b>${escape(p.name)}</b><small>${escape(p.role)}</small>${
                p.disposition
                  ? `<div class="disposition"><span>${escape(p.disposition.label)} ${p.disposition.value}/10</span><div class="stat-track"><span style="width:${p.disposition.value * 10}%"></span></div></div>`
                  : ""
              }<ul>${p.notes.map((n) => `<li>${escape(n)}</li>`).join("")}</ul></div></li>`,
          )
          .join("")}</ul>`
      : '<div class="empty-bag"><span>❞</span><p>Nobody met yet.</p></div>';
  if (panel === "map") {
    const exits = v.map.exits;
    return `${mapSvg(v.map)}<div class="exits"><span class="eyebrow">Roads from here</span>${
      exits.length && !v.encounter
        ? exits
            .map(
              (e) =>
                `<button data-travel="${e.action}" ${e.enabled ? "" : "disabled"}><span>${e.known ? escape(ep.scenes[e.to].kicker.split("·")[0].trim()) : "Somewhere new"}</span><small>${escape(e.label)}</small></button>`,
            )
            .join("")
        : `<p class="fineprint">${v.encounter ? "Deal with the encounter first." : "No roads lead on from here; act to move the story."}</p>`
    }</div>${v.checkpoint ? '<button id="rewind-map" class="button secondary full">Replay from last turning point ↶</button>' : ""}<p class="fineprint">◆ turning point · ○ place · ? unexplored road. Replaying replaces the current browser save.</p>`;
  }
  return `<div class="bag-heading"><span>Your bag</span><span>${v.inventory.length} ${v.inventory.length === 1 ? "thing" : "things"}</span></div>${
    v.inventory.length
      ? `<div class="inventory-grid">${v.inventoryItems
          .map(
            (i) =>
              `<button class="inventory-item ${selectedItem === i.id ? "selected" : ""} ${v.actions.some((a) => a.uses === i.id && a.enabled) ? "usable" : ""}" data-item="${i.id}" aria-expanded="${selectedItem === i.id}"><span class="item-glyph" aria-hidden="true">${i.glyph}</span><span>${escape(i.name)}</span></button>`,
          )
          .join("")}</div>${
          selectedItem
            ? `<div class="item-detail"><b>${escape(ep.items[selectedItem].name)}</b><p>${escape(ep.items[selectedItem].description)}</p><small>${v.actions.some((a) => a.uses === selectedItem && a.enabled) ? "You can use this now. Look in your actions." : "Select a matching action when the situation allows."}</small></div>`
            : ""
        }`
      : '<div class="empty-bag"><span>◇</span><p>A little room for possibility.</p><small>Collect objects by interacting with the scene.</small></div>'
  }${
    v.recipes.length
      ? `<div class="crafting"><span class="eyebrow">Put things together</span>${v.recipes
          .map((r) => `<button data-recipe="${r.id}">${escape(r.label)} <span>＋</span><small>${r.ingredients.map((id) => escape(ep.items[id].name)).join(" + ")} · 1 turn</small></button>`)
          .join("")}</div>`
      : ""
  }`;
}

function renderEnding(ep, v) {
  const news = endingNews?.key === `${v.seed}:${game.state.actions.length}:${v.ending}` ? endingNews : { echoes: [], marks: [] };
  const meaningful = v.recap.length ? v.recap : v.log.filter((e) => e.kind === "action").slice(-4).map((e) => e.text);
  const checks = Object.values(v.checks);
  const stats = [
    ["Turns", v.turn],
    ["Places", v.visited.filter((id) => ep.scenes[id].map).length],
    ["Dice", `${checks.filter((c) => c.passed).length}✓ ${checks.reduce((n, c) => n + c.failures, 0)}✗`],
    ["Conclusions", `${v.deductions.length}/${v.deductionsTotal}`],
    ["Objects", v.taken.length],
    ["Seed", seedCode(v.seed)],
  ];
  return `<div class="ending-reflection"><span class="eyebrow">${escape(v.endingData.kind)} · ${discoveries[ep.id].length} of ${Object.keys(ep.endings).length} endings found</span><p>${escape(v.endingData.reflection)}</p>
  <dl class="run-stats">${stats.map(([k, x]) => `<div><dt>${k}</dt><dd>${escape(x)}</dd></div>`).join("")}</dl>
  ${
    v.earnedEchoItems.length
      ? `<h2>What this telling teaches</h2><div class="echo-cards">${v.earnedEchoItems
          .map((e) => `<article class="echo-card ${news.echoes.includes(e.id) ? "new" : ""}"><span class="eyebrow">◈ Echo${news.echoes.includes(e.id) ? " · new" : ""}</span><b>${escape(e.title)}</b><p>${escape(e.text)}</p></article>`)
          .join("")}</div><p class="fineprint">Echoes reveal remembered actions in your next telling of this tale.</p>`
      : ""
  }
  ${
    v.markItems.length
      ? `<h2>Marks</h2><ul class="mark-chips">${v.markItems.map((m) => `<li class="${news.marks.includes(m.id) ? "new" : ""}" title="${escape(m.text)}">★ ${escape(m.title)}${news.marks.includes(m.id) ? " · new" : ""}</li>`).join("")}</ul>`
      : ""
  }
  <h2>The footsteps that brought you here</h2><ul>${meaningful.map((text) => `<li>${escape(text)}</li>`).join("")}</ul>
  <div class="ending-buttons"><button id="retell" class="button">Begin a new telling ◈</button>${v.checkpoint ? '<button id="rewind" class="button secondary">Try the last turning point ↶</button>' : ""}<button id="open-chronicle" class="button secondary">Chronicle</button><button id="another-story" class="button secondary">Choose another tale →</button></div></div>`;
}

function showThemes() {
  const ep = game.episode;
  showDialog(
    "Where should the tale turn?",
    `<p>Choose once per journey. This takes one turn and changes events, solutions, and possible endings.</p><div class="theme-choices">${Object.entries(ep.themes)
      .filter(([id]) => id !== game.state.theme)
      .map(([id, t]) => `<button data-theme="${id}"><span>${t.icon}</span><b>${escape(t.name)}</b><p>${escape(t.description)}</p><small>${escape(t.effect)}</small></button>`)
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
  const url = URL.createObjectURL(new Blob([JSON.stringify(game.save(), null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `hadithi-${game.episode.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Journey exported. Import it through Settings on another browser.");
}

document.addEventListener("keydown", (event) => {
  if (modal.open || event.altKey || event.ctrlKey || event.metaKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
  if (event.key === "?") {
    event.preventDefault();
    showHelp();
    return;
  }
  if (event.key.toLowerCase() === "s" && !event.shiftKey) {
    $("#sound-link").click();
    return;
  }
  if (!game) return;
  const key = event.key.toLowerCase();
  const panels = { b: "inventory", j: "mind", p: "people", m: "map" };
  if (panels[key]) {
    event.preventDefault();
    switchPanel(panels[key]);
    return;
  }
  if (key === "u") {
    event.preventDefault();
    undo();
    return;
  }
  const index = Number(event.key) - 1;
  if (index >= 0 && index < 9) {
    const a = game.view().actions[index];
    if (a?.enabled) {
      event.preventDefault();
      act({ type: a.type, id: a.id });
    }
  }
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !/[?&]nosw\b/.test(location.search))
  navigator.serviceWorker.register("./sw.js").catch(() => {
    /* Offline play is a bonus; the game works without it. */
  });

library();
