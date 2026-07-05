export class Game {
  constructor(data) {
    this.data = data;
    this.reset();
  }
  reset() {
    this.location = this.data.game_metadata.starting_location;
    this.inventory = new Set();
    this.stage = 0;
    this.status = "exploring";
    this.message = "Find what you need before facing the dragon.";
  }
  move(destination) {
    if (this.status !== "exploring") throw new Error("Restart to explore again");
    const exits = this.data.locations[this.location].exits;
    if (!exits.some((exit) => exit.destination === destination)) throw new Error("That path is not available");
    this.location = destination;
    const place = this.data.locations[destination];
    const loot = place.loot;
    if (loot && !this.inventory.has(loot.item_id)) {
      this.inventory.add(loot.item_id);
      this.message = loot.message;
    } else this.message = place.description;
    if (destination === "boss_arena") this.status = "fighting";
  }
  advance() {
    if (this.status !== "fighting") throw new Error("Not in a fight");
    const current = this.data.boss_fight.stages[this.stage];
    if (current.required_item && !this.inventory.has(current.required_item)) {
      this.status = "defeat";
      this.message = `${current.message} You needed ${this.data.items.find((item) => item.id === current.required_item)?.name || current.required_item}.`;
      return;
    }
    this.message = current.message;
    this.stage++;
    if (this.stage >= this.data.boss_fight.stages.length) this.status = "victory";
  }
  view() {
    const place = this.data.locations[this.location];
    return {
      title: this.status === "victory" ? this.data.endings.victory.title : this.status === "defeat" ? this.data.endings.defeat.title : place.name,
      description: this.status === "victory" ? this.data.endings.victory.message : this.message,
      icon: place.image_placeholder,
      exits: this.status === "exploring" ? place.exits : [],
      inventory: this.data.items.filter((item) => this.inventory.has(item.id)),
      status: this.status,
      stage: this.stage,
      totalStages: this.data.boss_fight.stages.length,
    };
  }
}
