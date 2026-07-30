// Small pure renderers: each takes view data and returns an HTML string.
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );

const PIPS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

export function die(value, cls = "") {
  return `<svg class="die ${cls}" viewBox="0 0 100 100" aria-hidden="true"><rect x="5" y="5" width="90" height="90" rx="14"/>${PIPS[value]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`)
    .join("")}</svg>`;
}

const signed = (n) => (n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`);

/** The dice tray shown after a check resolves. */
export function diceTray(roll, statLabels, { fresh }) {
  const statName = roll.stat ? statLabels[roll.stat] : "Chance";
  const parts = roll.parts.filter((p) => p.value !== 0 || p.label === statName);
  return `<section class="dice-tray ${roll.success ? "pass" : "fail"} ${fresh ? "fresh" : ""}" aria-label="${escape(
    `${statName} check: rolled ${roll.dice[0]} and ${roll.dice[1]}, ${signed(roll.bonus)}, total ${roll.total} against ${roll.dc}. ${roll.success ? "Success" : "Failure"}.`,
  )}">
    <div class="dice-head"><span>${escape(statName).toUpperCase()} CHECK · ${roll.kind === "white" ? "RETRY IF ODDS IMPROVE" : "ONE CHANCE"}</span><span>${Math.round(roll.chance * 100)}% ODDS</span></div>
    <div class="dice-body">
      <div class="dice-pair">${die(roll.dice[0], "d1")}${die(roll.dice[1], "d2")}</div>
      <div class="dice-math">
        <div class="dice-sum"><b>${roll.dice[0] + roll.dice[1]}</b><span>${signed(roll.bonus)}</span><span>=</span><b>${roll.total}</b><span class="vs">vs ${roll.dc}</span></div>
        <ul class="dice-parts">${parts.map((p) => `<li><span>${escape(p.label)}</span><b>${signed(p.value)}</b></li>`).join("")}</ul>
      </div>
      <div class="dice-stamp" aria-hidden="true">${roll.success ? "SUCCESS" : "FAILURE"}</div>
    </div>
    ${roll.dice.join() === "6,6" ? '<p class="dice-note">Double six: fortune favours the bold.</p>' : roll.dice.join() === "1,1" ? '<p class="dice-note">Double one: no plan survives everything.</p>' : ""}
  </section>`;
}

/** Odds line for a check action before it is attempted. */
export function oddsBadge(odds, statLabels) {
  const pct = Math.round(odds.chance * 100);
  const name = odds.stat ? statLabels[odds.stat] : "Chance";
  const breakdown = odds.parts.map((p) => `${p.label} ${signed(p.value)}`).join(" · ");
  return `<span class="odds ${odds.kind}" title="${escape(breakdown)}"><span class="odds-meter"><i style="width:${pct}%"></i></span>${escape(name).toUpperCase()} ${pct}% · ${odds.kind === "white" ? "RETRY" : "ONE TRY"}</span><span class="odds-parts">${escape(breakdown || "No modifiers")} · need ${odds.dc}</span>`;
}

/** Node map of discovered places. Exits from here are drawn dashed. */
export function mapSvg(map) {
  const pos = Object.fromEntries(map.nodes.map((n) => [n.id, n.pos]));
  const hereNode = map.nodes.find((n) => n.id === map.here);
  const here = hereNode?.pos;
  const label = (text, [x, y], cls = "") =>
    `<text class="${cls}" x="${x}" y="${y > 85 ? y - 5.5 : y + 7.5}" text-anchor="${x > 82 ? "end" : x < 18 ? "start" : "middle"}">${escape(text)}</text>`;
  const edges = map.edges
    .map(([a, b]) => `<line class="edge" x1="${pos[a][0]}" y1="${pos[a][1]}" x2="${pos[b][0]}" y2="${pos[b][1]}"/>`)
    .join("");
  const exits = here
    ? map.exits
        .map(
          (e) =>
            `<line class="exit ${e.enabled ? "" : "locked"}" x1="${here[0]}" y1="${here[1]}" x2="${e.pos[0]}" y2="${e.pos[1]}"/>${
              e.known ? "" : `<g class="unknown"><circle cx="${e.pos[0]}" cy="${e.pos[1]}" r="3.2"/><text x="${e.pos[0]}" y="${e.pos[1] + 1.4}" text-anchor="middle">?</text></g>`
            }`,
        )
        .join("")
    : "";
  const nodes = map.nodes
    .map(
      (n) =>
        `<g class="node ${n.id === map.here ? "here" : ""} ${n.checkpoint ? "checkpoint" : ""}"><title>${escape(n.title)}</title>${
          n.checkpoint ? `<rect x="${n.pos[0] - 3.4}" y="${n.pos[1] - 3.4}" width="6.8" height="6.8" transform="rotate(45 ${n.pos[0]} ${n.pos[1]})"/>` : `<circle cx="${n.pos[0]}" cy="${n.pos[1]}" r="2.6"/>`
        }${n.id === map.here ? `<circle class="pulse" cx="${n.pos[0]}" cy="${n.pos[1]}" r="5.5"/>` : ""}${label(n.kicker.split("·")[0].trim(), n.pos)}</g>`,
    )
    .join("");
  return `<svg class="map-svg" viewBox="-4 -4 108 108" role="img" aria-label="Map of ${map.nodes.length} discovered places">${edges}${exits}${nodes}</svg>`;
}
