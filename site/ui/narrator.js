// The storyteller: turns what the engine just did into beats the player sees
// and hears in order. Pure, so the order of telling is tested in Node.
//
// Beat kinds:
//   chapter  { title, kicker }                 a scene opens
//   narrate  { text, tone, notes }             the storyteller speaks
//   roll     { roll }                          dice or a skill attempt settled
//   deduction{ title, text }                   two clues came together
//   ending   { title }                         the tale closes
// `notes` carry small facts learned in that beat (a clue, an item, a stat).

/**
 * Split narration into spoken and told parts. Curly or straight double
 * quotes mark speech; the quote marks stay with the speech.
 */
export function splitSpeech(text) {
  const parts = [];
  const re = /“[^”]*”|"[^"]*"/g;
  let last = 0;
  for (const m of String(text ?? "").matchAll(re)) {
    if (m.index > last) parts.push({ speech: false, text: text.slice(last, m.index) });
    parts.push({ speech: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < String(text ?? "").length) parts.push({ speech: false, text: text.slice(last) });
  return parts.filter((p) => p.text.trim());
}

/**
 * Everything said aloud in a passage, as one line for a speech bubble:
 * quote marks removed, and a comma that led into "she says" made a stop.
 */
export function firstSpeech(text) {
  const said = splitSpeech(text)
    .filter((p) => p.speech)
    .map((p) => p.text.slice(1, -1).trim().replace(/,$/, "."));
  return said.length ? said.join(" ") : null;
}

const checksAttempted = (v) => Object.values(v.checks ?? {}).reduce((n, c) => n + c.attempts, 0);

/** What changed in the player's hands and head between two views. */
export function changes(episode, before, after) {
  const notes = [];
  for (const id of after.clues) if (!before.clues.includes(id)) notes.push({ kind: "clue", id, text: episode.clues[id] });
  for (const id of after.inventory)
    if (!before.inventory.includes(id)) notes.push({ kind: "item", id, gained: true, name: episode.items[id].name, glyph: episode.items[id].glyph });
  for (const id of before.inventory)
    if (!after.inventory.includes(id)) notes.push({ kind: "item", id, gained: false, name: episode.items[id].name, glyph: episode.items[id].glyph });
  for (const [key, value] of Object.entries(after.stats)) {
    const delta = value - (before.stats[key] ?? 0);
    if (delta) notes.push({ kind: "stat", id: key, label: episode.statLabels[key], delta, value });
  }
  return notes;
}

/** The scene's own telling: title card, then its text and any variant. */
function sceneBeats(view) {
  const beats = [{ kind: "chapter", title: view.title, kicker: view.kicker }];
  beats.push({ kind: "narrate", text: view.description, tone: "scene", notes: [] });
  if (view.variant) beats.push({ kind: "narrate", text: view.variant, tone: "scene", notes: [] });
  return beats;
}

/**
 * Beats for one moment of the story.
 * @param episode the tale
 * @param before the view before the command, or null when a telling opens
 * @param after the view now
 */
export function beatsFor(episode, before, after) {
  if (!before) {
    // A telling opens (or resumes): the opening line, then the scene.
    const opening = after.log.find((e) => e.kind === "world" && e.turn === 0 && e.text === episode.opening);
    const beats = [];
    if (after.turn === 0 && opening) beats.push({ kind: "narrate", text: opening.text, tone: "opening", notes: [] });
    if (after.ending) return [...beats, endingBeat(after)];
    return [...beats, ...sceneBeats(after)];
  }

  const fresh = after.log.slice(before.log.length);
  const notes = changes(episode, before, after);
  const beats = [];
  if (checksAttempted(after) > checksAttempted(before) && after.lastRoll) beats.push({ kind: "roll", roll: after.lastRoll });

  const told = [];
  const later = [];
  let pendingDeduction = null;
  for (const e of fresh) {
    if (e.kind === "action" || e.kind === "roll" || e.kind === "ending") continue;
    if (e.kind === "deduction") {
      pendingDeduction = { kind: "deduction", title: e.text, text: "" };
      told.push(pendingDeduction);
      continue;
    }
    if (pendingDeduction && e.kind === "consequence") {
      pendingDeduction.text = e.text;
      pendingDeduction = null;
      continue;
    }
    const tone = e.kind === "encounter" ? "encounter" : e.kind === "world" ? "world" : e.kind === "deduction-miss" ? "miss" : "consequence";
    const beat = { kind: "narrate", text: e.text, tone, notes: [] };
    // Things the world does after your action are told after you arrive.
    (e.kind === "world" || e.kind === "encounter" ? later : told).push(beat);
  }
  // Facts learned belong to the first thing said about this action.
  const carrier = told.find((b) => b.kind === "narrate") ?? later.find((b) => b.kind === "narrate");
  if (carrier) carrier.notes = notes;
  else if (notes.length) told.push({ kind: "narrate", text: "", tone: "consequence", notes });

  beats.push(...told);
  if (after.ending) return [...beats, ...later, endingBeat(after)];
  const moved = after.scene !== before.scene;
  const interrupted = after.encounter && !before.encounter;
  if (interrupted) beats.push(...later, ...sceneBeats(after));
  else if (moved) beats.push(...sceneBeats(after), ...later);
  else beats.push(...later);
  return beats;
}

function endingBeat(view) {
  return { kind: "ending", title: view.endingData?.title ?? "", text: view.endingData?.text ?? "" };
}
