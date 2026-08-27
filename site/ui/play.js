// The play screen: one full-screen world with a storyteller over it.
//
// The world shows the place. The story band tells what happens, a beat at a
// time, the way a storyteller would: the opening, a chapter card when a new
// place opens, what you found, what was said, what it cost. People speak in
// bubbles above their heads. Choices that are not places (what to say, what
// to decide) appear in the band as lines you can choose.
import { createWorld } from "../world/boot.js";
import { createBridge } from "../world/bridge.js";
import { runSkillChallenge } from "../world/skill-challenge.js";
import { beatsFor, splitSpeech, firstSpeech } from "./narrator.js";
import { journalHtml, panelHtml, endingHtml, TABS } from "./journal.js";
import { escape, diceTray, oddsBadge } from "./widgets.js";

const flat = (t) => t.replace("\n", " ");
const LIGHT = { dawn: "Dawn", day: "Day", dusk: "Dusk", night: "Night", deep: "Deep water", moon: "Moonlight" };

/**
 * @param ctx {
 *   getGame, act(command) → boolean, undo(), restart(), library(), sources(),
 *   settings, toast(text), announce(text), audio, storageFailed(),
 *   endingNews(), found(), chronicle(), themes(), exportSave(), rewind()
 * }
 */
export function createPlay(main, ctx) {
  let world = null;
  let beats = [];
  let beat = -1;
  let typing = null;
  let chapterTimer = null;
  let conversation = null;
  let near = null;
  let trial = false;
  let journalOpen = false;
  const ui = { tab: "bag", item: null, clues: [] };
  let places = [];
  let bubble = null;
  let bandObserver = null;

  const root = document.createElement("section");
  root.className = "play";
  root.setAttribute("aria-label", "The tale");
  root.innerHTML = `
    <header class="play-hud">
      <button class="hud-back" id="back-library" aria-label="Back to the collection">←<span> Tales</span></button>
      <div class="hud-title"><span class="hud-tale"></span><small class="hud-time"></small></div>
      <div class="hud-actions">
        <button id="undo" aria-keyshortcuts="U" title="Take back your last step (U)">↶<span> Undo</span></button>
        <button id="open-journal" aria-keyshortcuts="J" aria-expanded="false" title="Your journal (J)">❖<span> Journal</span><i class="journal-dot" hidden></i></button>
        <button id="story-source" title="Where this tale comes from">ⓘ<span> Source</span></button>
      </div>
    </header>
    <div class="play-chapter" aria-hidden="true" hidden><span class="eyebrow"></span><h2></h2></div>
    <div class="play-markers"></div>
    <div class="play-prompt" hidden></div>
    <div class="play-bubble" hidden aria-hidden="true"><b></b><span></span></div>
    <section class="story-band" aria-labelledby="scene-title">
      <h1 id="scene-title" class="story-scene" tabindex="-1"></h1>
      <div class="story-body">
        <p class="story-line"></p>
        <ul class="story-notes"></ul>
        <div class="story-roll"></div>
      </div>
      <div class="story-choices" role="group" aria-label="What you could do"></div>
      <button class="story-next" hidden>Go on <span aria-hidden="true">▸</span></button>
    </section>
    <div class="play-touch">
      <div class="world-joystick" role="group" aria-label="Walk"><span aria-hidden="true"></span></div>
      <div class="touch-buttons"><button data-touch-act aria-label="Act or go on">E</button><button data-lift aria-label="Lift or set down" disabled>⤒</button><button data-throw aria-label="Throw" disabled>➶</button></div>
    </div>
    <p class="play-message" role="status"></p>
    <aside class="journal-drawer" role="dialog" aria-modal="false" aria-labelledby="journal-title" hidden></aside>
    <div class="play-ending" hidden></div>`;
  const $ = (s) => root.querySelector(s);
  const band = $(".story-band"),
    line = $(".story-line"),
    notesEl = $(".story-notes"),
    rollEl = $(".story-roll"),
    choicesEl = $(".story-choices"),
    nextBtn = $(".story-next"),
    chapterEl = $(".play-chapter"),
    markersEl = $(".play-markers"),
    promptEl = $(".play-prompt"),
    bubbleEl = $(".play-bubble"),
    messageEl = $(".play-message"),
    journal = $(".journal-drawer"),
    endingEl = $(".play-ending");

  const game = () => ctx.getGame();
  const view = () => game().view();
  const telling = () => beat >= 0 && beat < beats.length;
  const paused = () => !root.isConnected || document.hidden || ctx.modalOpen() || !endingEl.hidden;
  const busy = () => trial;

  const bridge = createBridge(game, {
    request: (action, place) => request(action, place),
    command: (cmd) => ctx.act(cmd),
  });

  // ── Telling ────────────────────────────────────────────────────────────
  function tell(list) {
    clearTimeout(chapterTimer);
    stopTyping();
    beats = list.filter((b) => b.kind !== "narrate" || b.text || b.notes?.length);
    beat = -1;
    advance();
  }

  /** Show the next beat. Returns true if something was shown or finished. */
  function advance() {
    if (typing) {
      finishTyping();
      return true;
    }
    if (beat >= beats.length) return false;
    beat++;
    if (beat >= beats.length) {
      idle();
      return true;
    }
    show(beats[beat]);
    return true;
  }

  function show(b) {
    choicesEl.replaceChildren();
    rollEl.replaceChildren();
    notesEl.replaceChildren();
    band.dataset.tone = b.tone ?? b.kind;
    band.dataset.state = "telling";
    nextBtn.hidden = false;
    if (b.kind === "chapter") {
      chapterEl.querySelector(".eyebrow").textContent = b.kicker;
      chapterEl.querySelector("h2").textContent = b.title;
      chapterEl.hidden = false;
      chapterEl.classList.remove("leaving");
      $("#scene-title").textContent = b.title;
      line.replaceChildren();
      ctx.announce(`${b.title}. ${b.kicker}.`);
      // The card lingers, then the storyteller goes on by itself.
      chapterTimer = setTimeout(() => {
        chapterEl.classList.add("leaving");
        if (beats[beat] === b) advance();
      }, ctx.settings.motion ? 1900 : 900);
      return;
    }
    if (b.kind !== "chapter") {
      chapterEl.classList.add("leaving");
      setTimeout(() => chapterEl.classList.contains("leaving") && (chapterEl.hidden = true), 500);
    }
    if (b.kind === "roll") {
      const ep = game().episode;
      rollEl.innerHTML = diceTray(b.roll, ep.statLabels, { fresh: ctx.settings.motion });
      line.textContent = b.roll.mode === "skill" ? (b.roll.success ? "You did it." : "Not quite.") : "";
      ctx.announce(rollEl.textContent);
      return;
    }
    if (b.kind === "deduction") {
      line.innerHTML = `<b class="story-deduction">⟷ ${escape(b.title)}</b> ${escape(b.text)}`;
      ctx.announce(`${b.title}. ${b.text}`);
      return;
    }
    if (b.kind === "ending") {
      // The closing page takes over; the telling is complete.
      beat = beats.length;
      nextBtn.hidden = true;
      openEnding();
      return;
    }
    // Narration, typed out like it is being told.
    renderNotes(b.notes ?? []);
    ctx.announce(b.text);
    typeOut(b.text);
    speakAbove(b);
  }

  function renderNotes(notes) {
    notesEl.replaceChildren(
      ...notes.map((n) => {
        const li = document.createElement("li");
        li.className = `note-${n.kind}`;
        if (n.kind === "clue") li.innerHTML = `<i aria-hidden="true">⌕</i> <span>You noted: ${escape(n.text)}</span>`;
        if (n.kind === "item") li.innerHTML = `<i aria-hidden="true">${escape(n.glyph)}</i> <span>${n.gained ? "Into your bag" : "Gone from your bag"}: ${escape(n.name)}</span>`;
        if (n.kind === "stat") li.innerHTML = `<i aria-hidden="true">${n.delta > 0 ? "▲" : "▼"}</i> <span>${escape(n.label)} ${n.delta > 0 ? "+" : "−"}${Math.abs(n.delta)}</span>`;
        return li;
      }),
    );
    for (const n of notes) {
      if (n.kind === "item" && n.gained && world) {
        const target = $("#open-journal").getBoundingClientRect();
        const stage = world.root.getBoundingClientRect();
        world.flyToBag(n.id, { x: target.left + target.width / 2 - stage.left, y: target.top + target.height / 2 - stage.top });
        $(".journal-dot").hidden = false;
      }
      if (n.kind === "clue") $(".journal-dot").hidden = false;
    }
  }

  function typeOut(text) {
    stopTyping();
    const parts = splitSpeech(text);
    if (!ctx.settings.motion || !text) {
      line.innerHTML = parts.map((p) => (p.speech ? `<q>${escape(p.text.slice(1, -1))}</q>` : escape(p.text))).join("");
      return;
    }
    let shown = 0;
    const total = text.length;
    const step = Math.max(1, Math.ceil(total / 70));
    line.innerHTML = "";
    const render = () => {
      let left = shown;
      line.innerHTML = parts
        .map((p) => {
          const take = Math.max(0, Math.min(p.text.length, left));
          left -= take;
          const t = p.text.slice(0, take);
          return p.speech ? (take ? `<q>${escape(t.replace(/^[“"]/, "").replace(/[”"]$/, ""))}</q>` : "") : escape(t);
        })
        .join("");
    };
    typing = {
      id: setInterval(() => {
        shown += step;
        render();
        if (shown >= total) finishTyping();
      }, 22),
      finish() {
        shown = total;
        render();
      },
    };
  }
  function finishTyping() {
    if (!typing) return;
    const t = typing;
    typing = null;
    clearInterval(t.id);
    t.finish();
  }
  function stopTyping() {
    if (typing) clearInterval(typing.id);
    typing = null;
  }

  /** A line of speech pops up above whoever said it. */
  function speakAbove(b) {
    const said = firstSpeech(b.text);
    if (!said || !b.speaker) return;
    bubble = { at: b.speaker.at, name: b.speaker.name, until: performance.now() + 5200 };
    bubbleEl.querySelector("b").textContent = b.speaker.name ?? "";
    bubbleEl.querySelector("span").textContent = said;
    bubbleEl.hidden = false;
  }

  // ── Between beats: what you could do ───────────────────────────────────
  function idle() {
    stopTyping();
    beat = beats.length;
    nextBtn.hidden = true;
    band.dataset.state = conversation ? "conversation" : "idle";
    band.dataset.tone = "idle";
    rollEl.replaceChildren();
    notesEl.replaceChildren();
    const v = view();
    if (v.ending) return;
    if (conversation) return showConversation();
    const puzzle = v.puzzleData && !v.flags[v.puzzleData.solvedFlag] ? v.puzzleData : null;
    const layout = bridge.read()?.layout;
    const menu = v.actions.filter((a) => layout?.menu.includes(a.id));
    line.innerHTML = puzzle
      ? `<b>${escape(puzzle.prompt)}</b> ${escape(puzzle.clue)}`
      : `<span class="story-want">${escape(v.objective)}</span>`;
    if (puzzle) renderPuzzle(v, puzzle);
    else choicesEl.replaceChildren(...menu.map((a, i) => choiceButton(a, i, () => request(a, null))));
  }

  function renderPuzzle(v, p) {
    const slots = p.solution.map((_, i) => p.options.find((o) => o.id === v.puzzle[i])?.label ?? "…").join(" → ");
    const status = document.createElement("p");
    status.className = "puzzle-slots";
    status.textContent = slots;
    choicesEl.replaceChildren(
      status,
      ...p.options.map((o, i) => {
        const b = document.createElement("button");
        b.className = "choice";
        b.dataset.puzzle = o.id;
        b.innerHTML = `<span class="choice-key">${i + 1}</span><span aria-hidden="true">${escape(o.glyph ?? "")}</span> ${escape(o.label)}`;
        b.onclick = () => ctx.act({ type: "PUZZLE", id: o.id });
        return b;
      }),
      Object.assign(document.createElement("button"), { className: "choice quiet", textContent: "Start again ↺", onclick: () => ctx.act({ type: "CLEAR_PUZZLE" }) }),
    );
  }

  function choiceButton(a, i, onClick) {
    const ep = game().episode;
    const b = document.createElement("button");
    b.className = `choice${a.remembered ? " remembered" : ""}${a.odds ? " check" : ""}`;
    b.dataset.choice = a.id;
    b.disabled = !a.enabled;
    b.innerHTML = `<span class="choice-key" aria-hidden="true">${i + 1}</span><span class="choice-text">${a.remembered ? '<em class="remembered-badge">◈ Remembered</em> ' : ""}${escape(a.label)}${
      !a.enabled ? `<small class="requires">${escape(a.requires ?? "Not yet")}</small>` : a.odds ? `<small>${oddsBadge(a.odds, ep.statLabels)}</small>` : ""
    }</span>`;
    b.onclick = onClick;
    return b;
  }

  function showConversation() {
    const place = conversation;
    const live = new Map(view().actions.map((a) => [a.id, a]));
    const actions = place.actions.map((a) => live.get(a.id)).filter(Boolean);
    if (!actions.some((a) => a.enabled)) {
      conversation = null;
      return idle();
    }
    band.dataset.state = "conversation";
    line.innerHTML = `<b class="story-speaker">${escape(place.name ?? "")}</b>`;
    choicesEl.replaceChildren(
      ...actions.map((a, i) =>
        choiceButton(a, i, () => {
          conversation = null;
          world?.interact(a.id) || request(a, place);
        }),
      ),
      Object.assign(document.createElement("button"), {
        className: "choice quiet",
        textContent: "Say nothing and step away",
        onclick: () => {
          conversation = null;
          idle();
        },
      }),
    );
    choicesEl.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
  }

  // ── Acting ─────────────────────────────────────────────────────────────
  let lastPlace = null;
  async function request(action, place) {
    lastPlace = place;
    if (action.check?.skill && ctx.settings.trials !== false) {
      trial = true;
      const outcome = await runSkillChallenge({ root, motion: ctx.settings.motion, set skillActive(v) {} }, action.check.skill.kind, bridge.profile(action.id));
      trial = false;
      if (!outcome) {
        world?.release();
        return;
      }
      ctx.act({ type: action.type, id: action.id, outcome });
      return;
    }
    ctx.act({ type: action.type, id: action.id });
  }

  /** The engine moved: tell it, then let the world catch up. */
  function after(before, now) {
    const list = beatsFor(game().episode, before, now);
    // Words spoken during this action belong to whoever you acted with.
    const speaker = lastPlace && !lastPlace.exit ? { at: lastPlace.at, name: lastPlace.name } : null;
    for (const b of list) if (b.kind === "narrate" && b.tone === "consequence" && speaker && firstSpeech(b.text)) b.speaker = speaker;
    lastPlace = null;
    conversation = null;
    // Whatever you did, you should see the story answer it.
    if (journalOpen) closeJournal();
    sync();
    tell(list);
  }

  // ── The journal ────────────────────────────────────────────────────────
  function openJournal(tab) {
    if (tab) ui.tab = tab;
    journalOpen = true;
    $(".journal-dot").hidden = true;
    renderJournal();
    journal.hidden = false;
    $("#open-journal").setAttribute("aria-expanded", "true");
    journal.querySelector(`#tab-${ui.tab}`)?.focus({ preventScroll: true });
  }
  function closeJournal() {
    journalOpen = false;
    journal.hidden = true;
    $("#open-journal").setAttribute("aria-expanded", "false");
    $("#open-journal").focus({ preventScroll: true });
  }
  function renderJournal() {
    const ep = game().episode;
    journal.innerHTML = journalHtml(ep, view(), { ...ui, storageFailed: ctx.storageFailed() });
    journal.querySelector("[data-close-journal]").onclick = closeJournal;
    journal.querySelectorAll("[data-tab]").forEach((el) => (el.onclick = () => switchTab(el.dataset.tab)));
    wireJournalPanel();
    journal.querySelector("#shift-theme").onclick = () => ctx.themes();
    journal.querySelector("#export-save").onclick = () => ctx.exportSave();
    journal.querySelector("#restart-story").onclick = () => ctx.restart();
  }
  function switchTab(tab) {
    ui.tab = tab;
    ui.item = null;
    renderJournal();
    journal.querySelector(`#tab-${tab}`)?.focus({ preventScroll: true });
  }
  function wireJournalPanel() {
    const panel = journal.querySelector("#journal-panel");
    panel.querySelectorAll("[data-item]").forEach((el) => {
      el.onclick = () => {
        ui.item = ui.item === el.dataset.item ? null : el.dataset.item;
        panel.innerHTML = panelHtml(game().episode, view(), ui);
        wireJournalPanel();
        panel.querySelector(`[data-item="${el.dataset.item}"]`)?.focus({ preventScroll: true });
      };
    });
    panel.querySelectorAll("[data-clue]").forEach((el) => {
      el.onclick = () => {
        const id = el.dataset.clue;
        ui.clues = ui.clues.includes(id) ? ui.clues.filter((x) => x !== id) : [...ui.clues.slice(-1), id];
        panel.innerHTML = panelHtml(game().episode, view(), ui);
        wireJournalPanel();
        panel.querySelector(`[data-clue="${id}"]`)?.focus({ preventScroll: true });
      };
    });
    const connect = panel.querySelector("#connect");
    if (connect)
      connect.onclick = () => {
        const ids = ui.clues;
        ui.clues = [];
        closeJournal();
        ctx.act({ type: "DEDUCE", ids });
      };
    panel.querySelectorAll("[data-recipe]").forEach((el) => {
      el.onclick = () => {
        closeJournal();
        ctx.act({ type: "COMBINE", id: el.dataset.recipe });
      };
    });
    panel.querySelectorAll("[data-travel]").forEach((el) => {
      el.onclick = () => {
        closeJournal();
        world?.walkTo(el.dataset.travel, true);
      };
    });
    const rewind = panel.querySelector("#rewind-map");
    if (rewind) rewind.onclick = () => (closeJournal(), ctx.rewind());
  }

  // ── The ending ─────────────────────────────────────────────────────────
  function openEnding() {
    const ep = game().episode;
    const v = view();
    endingEl.innerHTML = endingHtml(ep, v, { news: ctx.endingNews(), found: ctx.found() });
    endingEl.hidden = false;
    band.dataset.state = "ended";
    endingEl.querySelector("#retell").onclick = () => ctx.restart();
    endingEl.querySelector("#rewind")?.addEventListener("click", () => ctx.rewind());
    endingEl.querySelector("#open-chronicle").onclick = () => ctx.chronicle();
    endingEl.querySelector("#another-story").onclick = () => ctx.library();
    endingEl.querySelector("#ending-title").focus({ preventScroll: true });
  }

  // ── Places, prompts and bubbles over the world ─────────────────────────
  function renderMarkers(list) {
    places = list;
    markersEl.replaceChildren(
      ...list.map((place) => {
        const label = place.name ?? place.actions[0].label;
        const el = document.createElement("button");
        el.className = `world-marker${place.exit ? " world-exit" : ""}${place.actions.some((a) => a.remembered) ? " remembered" : ""}`;
        el.dataset.place = place.id;
        el.innerHTML = place.exit ? `<span>${escape(signpost(place))}</span>` : `<span class="sr-only">${escape(label)}</span>`;
        el.setAttribute("aria-label", `${place.exit ? "Take the road" : "Go to"}: ${label}`);
        el.title = label;
        el.onclick = () => world?.walkTo(place.id, true);
        return el;
      }),
    );
  }
  function signpost(place) {
    const a = place.actions[0];
    const to = a.effects?.to && game().episode.scenes[a.effects.to];
    return `${to ? flat(to.kicker.split("·")[0].trim()) : a.label} →`;
  }

  function onNear({ place, carrying, liftable }) {
    near = place;
    $("[data-lift]").disabled = !carrying && !liftable;
    $("[data-lift]").setAttribute("aria-label", carrying ? `Set down the ${carrying}` : liftable ? `Lift the ${liftable}` : "Lift");
    $("[data-throw]").disabled = !carrying;
    if (conversation && (!place || place.id !== conversation.id)) {
      conversation = null;
      if (!telling()) idle();
    }
    if (!place && !liftable && !carrying) {
      promptEl.hidden = true;
      return;
    }
    const enabled = place?.actions.filter((a) => a.enabled) ?? [];
    let text;
    if (place && enabled.length > 1) text = `Talk · ${place.name ?? "Speak"}`;
    else if (place && enabled.length === 1) text = enabled[0].label;
    else if (place) text = place.actions[0].requires ? `${place.actions[0].label}: ${place.actions[0].requires}` : place.actions[0].label;
    else if (carrying) text = `Carrying the ${carrying}. Q to set down, F to throw.`;
    else text = `Q to lift the ${liftable}.`;
    promptEl.innerHTML = `${place && enabled.length ? '<kbd aria-hidden="true">E</kbd>' : ""}<span>${escape(text)}</span>`;
    promptEl.dataset.enabled = String(Boolean(enabled.length));
    promptEl.hidden = false;
  }

  function onFrame() {
    if (!world) return;
    const w = root.clientWidth,
      h = root.clientHeight;
    for (const el of markersEl.children) {
      const place = places.find((p) => p.id === el.dataset.place);
      if (!place) continue;
      const at = world.project(place.at, place.exit ? 0 : 34);
      if (!at) continue;
      // Keep signposts on screen and clear of the HUD and the story band.
      const half = (el.offsetWidth || 28) / 2 + 10;
      const top = 96 + (el.offsetHeight || 28) / 2;
      const bottom = h - (band.offsetHeight || 0) - 26;
      el.style.transform = `translate(${Math.round(Math.max(half, Math.min(w - half, at.x)))}px, ${Math.round(Math.max(top, Math.min(bottom, at.y)))}px)`;
      el.dataset.near = String(near?.id === place.id);
    }
    const anchor = near ? world.project(near.at, 64) : world.heroScreen();
    if (anchor && !promptEl.hidden) promptEl.style.transform = `translate(${Math.round(anchor.x)}px, ${Math.round(anchor.y)}px)`;
    if (bubble) {
      if (performance.now() > bubble.until) {
        bubble = null;
        bubbleEl.hidden = true;
      } else {
        const at = world.project(bubble.at, 78);
        if (at) bubbleEl.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
      }
    }
  }

  // ── Keyboard for the band, the journal and the HUD ─────────────────────
  function onKey(event) {
    if (!root.isConnected || ctx.modalOpen() || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (!endingEl.hidden) return;
    if (journalOpen) {
      if (key === "escape" || key === "j") {
        event.preventDefault();
        closeJournal();
      }
      return;
    }
    if (/^(input|select|textarea)$/i.test(event.target.tagName)) return;
    if (key === "j") return event.preventDefault(), openJournal();
    const tab = TABS.find(([, , k]) => k.toLowerCase() === key);
    if (tab) return event.preventDefault(), openJournal(tab[0]);
    if (key === "u") return event.preventDefault(), ctx.undo();
    if (key === "escape" && conversation) return event.preventDefault(), (conversation = null), idle();
    const n = Number(event.key);
    if (n >= 1 && n <= 9 && !telling()) {
      const buttons = [...choicesEl.querySelectorAll("button.choice:not(.quiet)")];
      if (buttons[n - 1] && !buttons[n - 1].disabled) {
        event.preventDefault();
        buttons[n - 1].click();
      }
    }
  }

  // ── Mount, sync, teardown ──────────────────────────────────────────────
  function mount() {
    main.className = "play-screen";
    main.replaceChildren(root);
    const ep = game().episode;
    root.dataset.tale = ep.id;
    $(".hud-tale").textContent = flat(ep.title);
    $("#back-library").onclick = () => ctx.library();
    $("#undo").onclick = () => ctx.undo();
    $("#open-journal").onclick = () => (journalOpen ? closeJournal() : openJournal());
    $("#story-source").onclick = () => ctx.sources(ep.id);
    nextBtn.onclick = () => advance();
    chapterEl.addEventListener("click", () => beats[beat]?.kind === "chapter" && advance());
    band.addEventListener("click", (e) => {
      if (telling() && !e.target.closest("button")) advance();
    });
    $("[data-touch-act]").onclick = () => (telling() ? advance() : world?.interact());
    $("[data-lift]").onclick = () => world?.lift();
    $("[data-throw]").onclick = () => world?.toss();
    window.addEventListener("keydown", onKey);
    // Touch controls sit just above the storyteller's band, whatever its height.
    bandObserver = new ResizeObserver(() => root.style.setProperty("--band-h", `${band.offsetHeight}px`));
    bandObserver.observe(band);
    world = createWorld({
      bridge,
      root,
      paused: () => paused() || journalOpen,
      busy,
      motion: ctx.settings.motion,
      events: {
        onReady: () => sync(),
        onPlaces: renderMarkers,
        onNear,
        onConverse: (place) => {
          conversation = place;
          if (!telling()) showConversation();
        },
        onAdvance: () => (telling() ? advance() : false),
        onMessage: (text) => {
          messageEl.textContent = text;
          messageEl.classList.remove("show");
          void messageEl.offsetWidth;
          messageEl.classList.add("show");
        },
        onFrame,
        onImpact: (impulse) => impulse > 1.2 && ctx.audio.sfx("click"),
      },
      onError: (error) => {
        console.error("The world could not open", error);
        line.textContent = "The world could not open in this browser. Try another browser, or turn off strict content blocking for this site.";
      },
    });
    root.prepend(world.root);
    sync();
    tell(beatsFor(ep, null, view()));
  }

  function sync() {
    const v = view();
    const atm = v.atmosphere;
    root.dataset.light = atm.light;
    root.dataset.weather = atm.weather;
    root.dataset.encounter = String(v.encounter);
    $(".hud-time").textContent = `${LIGHT[atm.light] ?? atm.light} · turn ${v.turn}`;
    $("#undo").disabled = !v.canUndo;
    if (!telling() && !v.ending) $("#scene-title").textContent = v.title;
    world?.sync(ctx.settings.motion);
    ctx.audio.setAmbience(atm.ambience);
    if (journalOpen) renderJournal();
  }

  return {
    mount,
    after,
    sync,
    /** Undo, rewind or import replaced the game: retell from where we stand. */
    reset(note) {
      endingEl.hidden = true;
      conversation = null;
      sync();
      const v = view();
      tell([...(note ? [{ kind: "narrate", text: note, tone: "world", notes: [] }] : []), { kind: "chapter", title: v.title, kicker: v.kicker }, { kind: "narrate", text: v.description, tone: "scene", notes: [] }]);
    },
    get world() {
      return world;
    },
    destroy() {
      window.removeEventListener("keydown", onKey);
      bandObserver?.disconnect();
      clearTimeout(chapterTimer);
      stopTyping();
      world?.destroy();
      world = null;
      root.remove();
    },
    state: () => ({ telling: telling(), beat: beats[beat]?.kind ?? null, conversation: conversation?.id ?? null, journal: journalOpen }),
  };
}
