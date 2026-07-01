# Quest for the Crystal
## A Simple Adventure Game

A JSON-driven adventure game with a Python/Tkinter desktop edition and a browser edition. Navigate locations, collect items, and face the dragon.

## Browser edition

Run `npm test && npm run build`, then serve `dist/` with `python3 -m http.server 8000 --directory dist`. GitHub Actions runs the tests, validates location exits, and publishes the browser edition to GitHub Pages. Both editions read `game_data.json`; the build copies it into `dist/`.

## Quick Start

### Requirements
- Python 3.11+ (Tkinter included)
- No external dependencies

### Run the Game
```bash
cd adventure_game
python3.11 adventure_game.py
```

Or use the launcher script:
```bash
./run.sh
```

## Game Overview

**Objective:** Collect items and defeat the dragon boss

**Locations:**
- Village (start)
- Tavern
- Dark Forest
- Weapon Shop
- Dark Castle (boss location)

The castle is reachable from the village. Visit the tavern, forest, and shop first if you want a fighting chance.

**Mechanics:**
- Click buttons to navigate locations
- Pick up items as you explore
- Items stored automatically in inventory
- Boss fight requires specific items at each stage
- One ending (victory or defeat/try again)

## File Structure

```
adventure_game/
├── adventure_game.py    # Main game (Python reads JSON)
├── game_data.json       # Story, items, locations, boss
├── requirements.txt     # Dependencies (minimal)
├── run.sh              # Launcher script
└── README.md           # This file
```

## How It Works

The game is **100% JSON-driven**:
- `game_data.json` defines all game content
- `adventure_game.py` reads from JSON and provides UI
- Python just pulls/displays data, no hardcoding

Edit `game_data.json` to add:
- New locations
- New items
- New boss stages
- Different story text

## Game Controls

- Click buttons to navigate
- No keyboard controls needed
- Inventory updates automatically

## Boss Fight

**8 stages:**
- Stages 1-3: Intro (no items required)
- Stage 4: Requires Sword
- Stage 5: Requires Bow
- Stage 6: Combat continues
- Stage 7: Requires Health Potion
- Stage 8: Victory!

If you lack a required item at any stage, you get a "Defeat" message with retry option.

## That's It!

Simple, clean, JSON-driven. Perfect for a design component showcase.
