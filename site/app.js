import { Game, newSeed, seedCode, parseSeedCode } from "./game.js";
import { episodes, episodeById, regions } from "./stories.js";
import { read, write, perTale, chronicle, MAX_CHRONICLE, storageFailed, onStorageFailure } from "./ui/storage.js";
import * as audio from "./ui/audio.js";
import { escape } from "./ui/widgets.js";
import { createPlay } from "./ui/play.js";
import { playable } from "./world/bridge.js";

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
  trials: true,
  ...read("settings", {}),
};
delete settings.view; // Classic view was retired in the third edition.
const discoveries = perTale("discoveries", episodes, (ep, id) => Object.hasOwn(ep.endings, id));
const knownEchoes = perTale("echoes", episodes, (ep, id) => Object.hasOwn(ep.echoes ?? {}, id));
const earnedMarks = perTale("marks", episodes, (ep, id) => (ep.marks ?? []).some((m) => m.id === id));
const runs = chronicle(episodes);
const tips = new Set(read("tips", []));
const recorded = read("recorded", {});

// ── Session UI state ──────────────────────────────────────────────────────
let game = null,
  play = null,
  filter = "All tales",
  endingNews = null,
  toastTimer;
const main = $("#main"),
  modal = $("#modal");
const ready = new Set(episodes.filter(playable).map((ep) => ep.id));

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
      <section><h3>⌕ Walk, look, act</h3><p>Walk anywhere: it costs nothing. Glints mark what you can look at, take or talk to. Walk up and press E. Looking is free; doing takes a turn, and the world moves when turns pass. Weather, tides, patrols and moonrise do not wait.</p></section>
      <section><h3>⚄ Trials</h3><p>Leaps, climbs and arguments are played by hand. Your stats make them easier, and the odds are shown first. Turn trials off in Settings and the dice decide instead. <b>One try</b> trials cannot be repeated. <b>Retry</b> trials open again once your odds improve. Failing always moves the story on. Taking a step back cannot change how a trial went.</p></section>
      <section><h3>⟷ Put things together</h3><p>Open your journal (J), go to <b>What you know</b>, and choose two things that fit. A true connection opens new conversations, arguments and endings. A wrong one costs nothing.</p></section>
      <section><h3>◈ Echoes</h3><p>Every ending teaches you something. Echoes carry that knowledge into your next telling and reveal <b>remembered</b> actions that were not there before. Each tale hides one ending that only remembered knowledge can reach.</p></section>
      <section><h3>★ Marks</h3><p>Marks recognise how you played: travelling light, thinking clearly, keeping the peace. They are listed in the Chronicle.</p></section>
      <section><h3>✧ Direction</h3><p>Once per journey you can turn the tale toward a different genre. It changes scenes, solutions, and endings, not just colours.</p></section>
    </div>
    <h3>Keyboard</h3>
    <dl class="keys"><dt>WASD · arrows</dt><dd>Walk (Shift to run)</dd><dt>E · Space</dt><dd>Act, talk, or go on with the story</dd><dt>1–9</dt><dd>Choose a line in a conversation</dd><dt>Q · F</dt><dd>Lift or set down · throw</dd><dt>J</dt><dd>Your journal (B, K, P, M for its pages)</dd><dt>U</dt><dd>Take back a step</dd><dt>?</dt><dd>This guide</dd></dl>`,
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
    ${row("trials", "Physical trials", "Leaps, climbs and arguments are played by hand. Turn off to let the dice decide instead.", check("trials", settings.trials))}
    ${row("motion", "Scene motion", "Weather, dice tumbling, and encounter feedback.", check("motion", settings.motion))}
    ${row("text-size", "Story text size", "Applies to story and journal text.", `<select id="text-size">${[["normal", "Standard"], ["large", "Large"], ["larger", "Larger"]].map(([v, l]) => `<option value="${v}" ${settings.size === v ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
    ${row("assist", "Storyteller’s grace", "New journeys add +2 to every dice check. Shown in every roll.", check("assist", settings.assist))}
    ${row("carry", "Carry echoes", "New journeys remember what earlier endings taught you.", check("carry", settings.carryEchoes))}
    <p class="fineprint">Walk with WASD or the arrows, act with E or Space, J for your journal, U to take back a step, ? for the guide. Progress saves after every action on this browser.</p>
    <div class="dialog-actions"><button class="button secondary" id="import-save">Import a journey</button><button class="button secondary" id="open-help">How to play</button></div>`,
  );
  for (const [id, key] of [["sound", "sound"], ["ambience", "ambience"], ["motion", "motion"], ["assist", "assist"], ["carry", "carryEchoes"], ["trials", "trials"]])
    $(`#${id}`).addEventListener("change", (event) => {
      settings[key] = event.target.checked;
      saveSettings();
      if (key === "sound") audio.sfx("click");
      if (key === "motion" && game) play?.sync();
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
    if (!ready.has(ep.id)) throw new Error("This tale is still being retold for the world. Its journey will open when it is ready.");
    modal.close();
    openTale(Game.load(ep, save));
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
  play?.destroy();
  play = null;
  game = null;
  document.body.classList.remove("playing");
  audio.setAmbience("none");
  main.className = "collection";
  delete main.dataset.theme;
  document.title = "Hadithi · Old tales you can play";
  const total = episodes.reduce((n, ep) => n + Object.keys(ep.endings).length, 0);
  const secrets = episodes.reduce((n, ep) => n + Object.values(ep.endings).filter((e) => e.secret).length, 0);
  const found = Object.values(discoveries).reduce((n, list) => n + list.length, 0);
  main.innerHTML = `<section class="collection-intro"><div class="intro-copy"><div class="edition"><span class="small-star">✳</span> Third edition <span class="rule"></span> ${episodes.length} tales</div><h1>Four old stories,<br>and <em>you in each one.</em></h1><p>Chase Anansi and his pot into the rain. Ride a turtle down to the sea palace. Scare robbers out of a house with a donkey, a dog, a cat and a rooster. Win back a jar of gold with a children’s game.</p><div class="intro-meta"><span>${episodes.length} tales</span><span>${total - secrets} endings, ${secrets} hidden</span><span>Saves as you go</span></div></div><div class="atlas-seal" aria-hidden="true"><span class="seal-top">Hadithi</span><div class="compass"><span class="compass-letter north">N</span><span class="compass-letter east">E</span><span class="compass-letter south">S</span><span class="compass-letter west">W</span><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="90"/><circle cx="100" cy="100" r="74"/><path d="m100 12 12 76 76 12-76 12-12 76-12-76-76-12 76-12z"/><path class="needle" d="m100 28 12 60 60 12-72 0zM100 172l-12-60-60-12h72z"/><path d="m46 46 54 32 54-32-32 54 32 54-54-32-54 32 32-54z"/><circle cx="100" cy="100" r="8"/></svg></div><span class="seal-bottom">Ghana · Japan · Germany · Baghdad</span></div></section>
  <section class="shelf"><div class="shelf-header"><div><span class="eyebrow">Pick a tale</span><h2>The collection</h2></div><button class="discovery-count" id="shelf-chronicle">${found} of ${total} endings found · Chronicle ↗</button></div><div class="filters" role="group" aria-label="Filter stories">${["All tales", ...regions]
    .map((f) => `<button class="filter ${filter === f ? "active" : ""}" data-filter="${f}" aria-pressed="${filter === f}">${f}</button>`)
    .join("")}<span class="filter-note">Free. No account.</span></div><div class="story-grid">${episodes
    .filter((ep) => filter === "All tales" || ep.region === filter)
    .map((ep) => {
      const open = ready.has(ep.id);
      const save = open && read(`save.${ep.id}`, null);
      const echoes = knownEchoes[ep.id].length;
      const marks = earnedMarks[ep.id].length;
      return `<article class="story-card ${ep.id}${open ? "" : " retelling"}"><div class="cover"><img src="./assets/${ep.id}.svg" alt="" /><div class="cover-top"><span>Tale ${Number(ep.number)}</span><span class="cover-region">${ep.region}</span></div><div class="cover-caption"><span>${escape(ep.genre)}</span><h3>${escape(ep.title).replace("\n", "<br>")}</h3></div><span class="cover-corner" aria-hidden="true">✧</span></div><div class="card-body"><div class="story-origin">${escape(ep.tradition)} <span>${ep.duration}</span></div><p>${escape(ep.hook)}</p><div class="card-bottom">${
        open
          ? `<button class="button start-button" data-start="${ep.id}">${save ? "Go on with the tale" : "Enter the story"} <span>→</span></button>`
          : `<span class="retelling-note">Being retold for the world. Soon.</span>`
      }<button class="source-button" data-source="${ep.id}" aria-label="Source notes for ${escape(flat(ep.title))}">ⓘ</button></div><div class="card-progress"><span class="slots" aria-label="${discoveries[ep.id].length} of ${Object.keys(ep.endings).length} endings found">${endingSlots(ep)}</span><span>${echoes ? `◈ ${echoes} echo${echoes === 1 ? "" : "es"}` : "No echoes yet"}</span><span>★ ${marks}/${ep.marks.length}</span></div>${
        open ? `<div class="card-foot"><span>${save ? "Saved in this browser" : "No account needed"}</span><button class="new-run" data-new="${ep.id}">${save ? "Begin again" : "Journey options"}</button></div>` : ""
      }</div></article>`;
    })
    .join("")}</div></section><section class="how-to"><span class="how-number">How to play</span><div><b>01. Walk and look.</b><p>Go where the glints are. Looking costs nothing.</p></div><div><b>02. Act it out.</b><p>Leap, climb, argue. Your hands decide.</p></div><div><b>03. Remember.</b><p>Each ending echoes into the next telling.</p></div><button class="how-help" id="shelf-help">The full guide ↗</button></section>`;
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
const freshOptions = (id) => ({ seed: freshSeed(), echoes: settings.carryEchoes ? knownEchoes[id] : [], assist: settings.assist });

function start(id, options = null) {
  const ep = episodeById(id);
  if (!ready.has(id)) return toast("This tale is still being retold for the world.");
  const save = !options && read(`save.${id}`, null);
  let next;
  try {
    next = save ? Game.load(ep, save) : new Game(ep, options ?? freshOptions(id));
  } catch (error) {
    showDialog("A different edition", `<p>${escape(error.message)}</p><button class="button" id="fresh-start">Start a new journey →</button>`);
    $("#fresh-start").onclick = () => {
      modal.close();
      start(id, freshOptions(id));
    };
    return;
  }
  openTale(next);
  if (game.migratedFrom) toast("Your journey was carried into this edition of the tale.");
  else if (!save && game.state.echoes.length)
    toast(`◈ ${game.state.echoes.length} echo${game.state.echoes.length === 1 ? "" : "es"} from earlier tellings will shape this one.`, 5500);
}

/** Put a game on screen: the world, the storyteller, the journal. */
function openTale(next) {
  play?.destroy();
  game = next;
  endingNews = null;
  persist();
  document.title = `${flat(game.episode.title)} · Hadithi`;
  document.body.classList.add("playing");
  window.scrollTo(0, 0);
  play = createPlay(main, {
    getGame: () => game,
    act,
    undo,
    rewind,
    restart: () => newJourney(game.episode.id),
    library,
    sources,
    chronicle: () => showChronicle(game.episode.id),
    themes: showThemes,
    exportSave,
    settings,
    toast,
    audio,
    announce: (text) => ($("#announcement").textContent = text),
    storageFailed,
    modalOpen: () => modal.open,
    endingNews: () => (endingNews?.key === endingKey() ? endingNews : { echoes: [], marks: [] }),
    found: () => discoveries[game.episode.id].length,
  });
  play.mount();
}
const endingKey = () => `${game.state.seed}:${game.state.actions.length}:${game.state.ending}`;

function newJourney(id) {
  const ep = episodeById(id);
  const echoes = knownEchoes[id];
  const hasSave = Boolean(read(`save.${id}`, null));
  showDialog(
    "A new telling",
    `<p>${hasSave ? `This replaces your current journey in <em>${escape(flat(ep.title))}</em>. ` : ""}Endings, echoes and marks you have found stay in your chronicle.</p>
    <div class="setting-row"><label for="carry-now">Carry echoes<small>${
      echoes.length ? echoes.map((x) => `◈ ${escape(ep.echoes[x].title)}`).join(" · ") : "None yet: reach an ending to learn one."
    }</small></label><input id="carry-now" type="checkbox" ${settings.carryEchoes && echoes.length ? "checked" : ""} ${echoes.length ? "" : "disabled"}></div>
    <div class="setting-row"><label for="assist-now">Storyteller’s grace<small>Every trial is easier this journey (+2 to the odds).</small></label><input id="assist-now" type="checkbox" ${settings.assist ? "checked" : ""}></div>
    <div class="setting-row"><label for="seed-now">Seed<small>Leave blank for fresh fortune, or enter a seed from your chronicle to replay the same luck.</small></label><input id="seed-now" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="7" placeholder="random" class="seed-input"></div>
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
  const key = endingKey();
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
/** Send one command to the story. The storyteller tells what happened. */
function act(command) {
  const before = game.view();
  const attempts = Object.values(game.state.checks).reduce((n, c) => n + c.attempts, 0);
  try {
    game.dispatch(command);
  } catch (error) {
    toast(error.message);
    play?.world?.release();
    return false;
  }
  const fresh = game.state.log.slice(before.log.length);
  const rolled = Object.values(game.state.checks).reduce((n, c) => n + c.attempts, 0) > attempts;
  // Sound follows what actually happened, loudest moment first.
  const kinds = new Set(fresh.map((e) => e.kind));
  if (kinds.has("ending")) audio.sfx("ending");
  else if (kinds.has("encounter")) audio.sfx("interrupt");
  if (rolled) {
    audio.sfx(game.state.lastRoll.mode === "skill" ? "click" : "dice");
    audio.sfx(game.state.lastRoll.success ? "success" : "failure");
  } else if (kinds.has("deduction")) audio.sfx("deduction");
  else if (kinds.has("deduction-miss")) audio.sfx("wrong");
  else if (command.type === "TAKE_ITEM" || command.type === "COMBINE") audio.sfx("take");
  else if (!kinds.has("ending") && !kinds.has("encounter")) audio.sfx("click");
  persist();
  play?.after(before, game.view());
  return true;
}
function undo() {
  if (!game?.view().canUndo) return;
  try {
    game = game.undo();
  } catch (error) {
    toast(error.message);
    return;
  }
  persist();
  audio.sfx("click");
  play?.reset("You take back your last step. What is done by luck stays done.");
}
function rewind() {
  try {
    game = game.rewind();
  } catch (error) {
    toast(error.message);
    return;
  }
  persist();
  play?.reset("The storyteller goes back to the last turning point.");
}

function showThemes() {
  const ep = game.episode;
  showDialog(
    "Where should the tale turn?",
    `<p>Once in a telling. It takes a turn and changes what can happen from here.</p><div class="theme-choices">${Object.entries(ep.themes)
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
  // S walks south while a tale is open; it toggles sound only on the shelf.
  if (!game && event.key.toLowerCase() === "s" && !event.shiftKey) $("#sound-link").click();
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !/[?&]nosw\b/.test(location.search))
  navigator.serviceWorker.register("./sw.js").catch(() => {
    /* Offline play is a bonus; the game works without it. */
  });

// Browser test driver: it walks and acts through the same paths as players.
// It cannot change story state or move the hero except by walking.
if (new URLSearchParams(location.search).has("worldtest")) {
  window.__hadithi = {
    walkTo: (id) => play?.world?.walkTo(id, true) ?? Promise.resolve(false),
    world: () => play?.world?.inspect() ?? null,
    story: () => play?.state() ?? null,
    placed: (id) => play?.world?.placed(id) ?? false,
  };
}

library();
