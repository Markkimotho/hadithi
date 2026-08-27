// The storybook drawer and the closing page. Pure HTML-string renderers: they
// take the tale, the current view and a little UI state, and never touch the
// engine. Interaction wiring lives in play.js.
import { escape, mapSvg } from "./widgets.js";
import { seedCode } from "../engine/rng.js";

const pad = (n) => String(n).padStart(2, "0");

export const TABS = [
  ["bag", "Bag", "B"],
  ["mind", "What you know", "K"],
  ["people", "People", "P"],
  ["map", "Map", "M"],
];

export function journalHtml(ep, v, ui) {
  const counts = { bag: v.inventory.length, mind: v.clues.length, people: v.people.length, map: v.map.nodes.length };
  return `<div class="journal-head"><h2 id="journal-title">${escape(ep.role)}’s journal</h2><button class="journal-close" data-close-journal aria-label="Close the journal">×</button></div>
  <div class="journal-want"><span class="eyebrow">${v.ending ? "What it meant" : "What you want"}</span><p>${escape(v.endingData?.reflection || v.objective)}</p></div>
  <div class="journal-stats">${Object.entries(v.stats)
    .map(([key, n]) => `<div><span>${escape(ep.statLabels[key])}</span><b>${n}</b><div class="stat-track" aria-hidden="true"><span style="width:${n * 10}%"></span></div></div>`)
    .join("")}</div>
  <div class="journal-tabs" role="tablist" aria-label="Journal sections">${TABS.map(
    ([id, label, key]) =>
      `<button id="tab-${id}" role="tab" aria-controls="journal-panel" aria-selected="${ui.tab === id}" aria-keyshortcuts="${key}" data-tab="${id}">${label} <small>${counts[id]}</small></button>`,
  ).join("")}</div>
  <div id="journal-panel" role="tabpanel" aria-labelledby="tab-${ui.tab}" class="journal-panel">${panelHtml(ep, v, ui)}</div>
  <div class="journal-turn"><span class="eyebrow">What kind of story</span><button id="shift-theme" ${v.flags.themeShifted || v.encounter || v.ending ? "disabled" : ""}><span>${ep.themes[v.theme].icon} ${escape(ep.themes[v.theme].name)}</span><span>${v.flags.themeShifted ? "Already turned" : "Turn the tale ↗"}</span></button><p>${v.flags.themeShifted ? "Your chosen direction is changing the events ahead." : "Once in a telling you may turn it toward another kind of story."}</p></div>
  <div class="journal-save"><span>${ui.storageFailed ? "This browser will not keep your save. Export it." : "✓ Saved in this browser"} · Seed ${seedCode(v.seed)}${v.assist ? " · Grace +2" : ""}</span><button id="export-save">Export save ↓</button><button id="restart-story">Begin again ↺</button></div>`;
}

export function panelHtml(ep, v, ui) {
  if (ui.tab === "mind") return mindHtml(v, ui);
  if (ui.tab === "people") return peopleHtml(v);
  if (ui.tab === "map") return mapHtml(ep, v);
  return bagHtml(ep, v, ui);
}

function mindHtml(v, ui) {
  const used = new Set(v.deductionItems.flatMap((d) => d.from));
  const chosen = ui.clues ?? [];
  const ready = chosen.length === 2 && chosen.every((id) => v.clues.includes(id));
  return `<p class="journal-hint">${v.clues.length >= 2 ? "Pick two things that fit together. Thinking costs no time." : "Look closely at the world to learn more."}</p>${
    v.clueItems.length
      ? `<ol class="clue-list selectable">${v.clueItems
          .map(
            (c, i) =>
              `<li><button data-clue="${c.id}" aria-pressed="${chosen.includes(c.id)}" class="${used.has(c.id) ? "used" : ""}"><span>${pad(i + 1)}</span><p>${escape(c.text)}</p>${used.has(c.id) ? '<i aria-label="used in a conclusion">◆</i>' : ""}</button></li>`,
          )
          .join("")}</ol><button id="connect" class="button full connect" ${ready ? "" : "disabled"}>${ready ? "Put these two together ⟷" : `Choose ${2 - Math.min(2, chosen.length)} more`}</button>`
      : '<div class="empty-bag"><span>⌕</span><p>Nothing noted yet.</p></div>'
  }<div class="conclusions"><span class="eyebrow">Worked out · ${v.deductions.length} of ${v.deductionsTotal}</span>${
    v.deductionItems.length
      ? v.deductionItems.map((d) => `<article class="conclusion"><b>⟷ ${escape(d.title)}</b><p>${escape(d.text)}</p></article>`).join("")
      : '<p class="fineprint">What you work out will appear here and open new paths.</p>'
  }${v.wrongLinks ? `<p class="fineprint">${v.wrongLinks} idea${v.wrongLinks === 1 ? "" : "s"} that did not hold.</p>` : ""}</div><details class="history"><summary>The story so far</summary>${v.log
    .filter((e) => e.kind !== "roll")
    .slice(-40)
    .map((e) => `<p class="log-${e.kind}">${escape(e.text)}</p>`)
    .join("")}</details>`;
}

function peopleHtml(v) {
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
}

function mapHtml(ep, v) {
  return `${mapSvg(v.map)}<div class="exits"><span class="eyebrow">Roads from here</span>${
    v.map.exits.length && !v.encounter
      ? v.map.exits
          .map(
            (e) =>
              `<button data-travel="${e.action}" ${e.enabled ? "" : "disabled"}><span>${e.known ? escape(ep.scenes[e.to].kicker.split("·")[0].trim()) : "Somewhere new"}</span><small>${escape(e.label)}</small></button>`,
          )
          .join("")
      : `<p class="fineprint">${v.encounter ? "Deal with what is happening first." : "No road leads on from here yet."}</p>`
  }</div>${v.checkpoint ? '<button id="rewind-map" class="button secondary full">Go back to the last turning point ↶</button>' : ""}<p class="fineprint">Choosing a road walks you there. ◆ turning point · ? not yet seen.</p>`;
}

function bagHtml(ep, v, ui) {
  const usable = (id) => v.actions.some((a) => a.uses === id && a.enabled);
  return `${
    v.inventory.length
      ? `<div class="inventory-grid">${v.inventoryItems
          .map(
            (i) =>
              `<button class="inventory-item ${ui.item === i.id ? "selected" : ""} ${usable(i.id) ? "usable" : ""}" data-item="${i.id}" aria-expanded="${ui.item === i.id}"><span class="item-glyph" aria-hidden="true">${i.glyph}</span><span>${escape(i.name)}</span></button>`,
          )
          .join("")}</div>${
          ui.item && ep.items[ui.item]
            ? `<div class="item-detail"><b>${escape(ep.items[ui.item].name)}</b><p>${escape(ep.items[ui.item].description)}</p><small>${usable(ui.item) ? "Something nearby could use this." : "Keep it. Its moment may come."}</small></div>`
            : ""
        }`
      : '<div class="empty-bag"><span>◇</span><p>Your bag is empty.</p></div>'
  }${
    v.recipes.length
      ? `<div class="crafting"><span class="eyebrow">Put things together</span>${v.recipes
          .map((r) => `<button data-recipe="${r.id}">${escape(r.label)} <span>＋</span><small>${r.ingredients.map((id) => escape(ep.items[id].name)).join(" + ")} · takes a turn</small></button>`)
          .join("")}</div>`
      : ""
  }`;
}

/** The closing page of a telling. */
export function endingHtml(ep, v, { news, found }) {
  const meaningful = v.recap.length ? v.recap : v.log.filter((e) => e.kind === "action").slice(-4).map((e) => e.text);
  const checks = Object.values(v.checks);
  const stats = [
    ["Turns", v.turn],
    ["Places", v.visited.length],
    ["Trials", `${checks.filter((c) => c.passed).length} won · ${checks.reduce((n, c) => n + c.failures, 0)} lost`],
    ["Worked out", `${v.deductions.length} of ${v.deductionsTotal}`],
    ["Seed", seedCode(v.seed)],
  ];
  return `<article class="ending-page" aria-labelledby="ending-title">
  <span class="eyebrow">${escape(v.endingData.kind)} · ${found} of ${Object.keys(ep.endings).length} endings found</span>
  <h1 id="ending-title" tabindex="-1">${escape(v.endingData.title)}</h1>
  <p class="ending-text">${escape(v.endingData.text)}</p>
  <p class="ending-reflection">${escape(v.endingData.reflection)}</p>
  ${
    v.earnedEchoItems.length
      ? `<h2>What this telling teaches</h2><div class="echo-cards">${v.earnedEchoItems
          .map((e) => `<article class="echo-card ${news.echoes.includes(e.id) ? "new" : ""}"><span class="eyebrow">◈ Echo${news.echoes.includes(e.id) ? " · new" : ""}</span><b>${escape(e.title)}</b><p>${escape(e.text)}</p></article>`)
          .join("")}</div><p class="fineprint">The next time you tell this tale, you will remember.</p>`
      : ""
  }${
    v.markItems.length
      ? `<h2>Marks</h2><ul class="mark-chips">${v.markItems.map((m) => `<li class="${news.marks.includes(m.id) ? "new" : ""}" title="${escape(m.text)}">★ ${escape(m.title)}${news.marks.includes(m.id) ? " · new" : ""}</li>`).join("")}</ul>`
      : ""
  }
  <h2>The footsteps that brought you here</h2><ul class="footsteps">${meaningful.map((text) => `<li>${escape(text)}</li>`).join("")}</ul>
  <dl class="run-stats">${stats.map(([k, x]) => `<div><dt>${k}</dt><dd>${escape(x)}</dd></div>`).join("")}</dl>
  <div class="ending-buttons"><button id="retell" class="button">Tell it again ◈</button>${v.checkpoint ? '<button id="rewind" class="button secondary">Go back to the last turning point ↶</button>' : ""}<button id="open-chronicle" class="button secondary">Chronicle</button><button id="another-story" class="button secondary">Another tale →</button></div>
</article>`;
}
