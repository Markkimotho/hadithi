import { Game } from "./game.js";
const chapter = document.querySelector("#chapter");
const icon = document.querySelector("#icon");
const place = document.querySelector("#place");
const story = document.querySelector("#story");
const actions = document.querySelector("#actions");
const inventory = document.querySelector("#inventory");
const count = document.querySelector("#count");
let game;

function button(label, click) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.addEventListener("click", click);
  actions.append(element);
}
function render() {
  const view = game.view();
  chapter.textContent = view.status === "fighting" ? `Dragon encounter · ${view.stage} of ${view.totalStages}` : view.status === "exploring" ? "Explore / gather / return" : "The story ends here";
  icon.textContent = view.status === "victory" ? "✦" : view.status === "defeat" ? "✕" : view.icon;
  place.textContent = view.title;
  story.textContent = view.description;
  count.textContent = `${view.inventory.length} ${view.inventory.length === 1 ? "item" : "items"}`;
  inventory.replaceChildren();
  if (!view.inventory.length) {
    const li = document.createElement("li"); li.textContent = "Empty for now."; inventory.append(li);
  }
  for (const item of view.inventory) {
    const li = document.createElement("li"); li.textContent = item.name; inventory.append(li);
  }
  actions.replaceChildren();
  if (view.status === "exploring") for (const exit of view.exits) button(exit.text, () => { game.move(exit.destination); render(); });
  if (view.status === "fighting") button("Face the next attack →", () => { game.advance(); render(); });
  if (view.status === "defeat" || view.status === "victory") button("Try another journey ↺", reset);
}
function reset() { game.reset(); render(); }
document.querySelector("#restart").addEventListener("click", reset);
try {
  const response = await fetch("./game_data.json");
  if (!response.ok) throw new Error(`Story data unavailable (${response.status})`);
  game = new Game(await response.json());
  render();
} catch (error) {
  chapter.textContent = "Could not load story";
  story.textContent = error.message;
}
