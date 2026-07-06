#!/usr/bin/env python3
"""
Hadithi - A Simple Adventure Game
JSON-driven game state with Tkinter UI
"""

import json
import tkinter as tk
from tkinter import scrolledtext, messagebox
import os
import time


class AdventureGame:
    def __init__(self, root):
        self.root = root
        self.root.title("Hadithi")
        self.root.geometry("1000x600")
        self.root.configure(bg="#1a1a1a")
        
        # Load game data from JSON
        self.load_game_data()
        
        # Game state
        self.current_location = self.game_data["game_metadata"]["starting_location"]
        self.inventory = []
        self.boss_stage = 0
        self.in_boss_fight = False
        
        # Create save directory if it doesn't exist
        os.makedirs("saves", exist_ok=True)
        
        # Create UI
        self.create_ui()
        self.load_location(self.current_location)
        
        # Keyboard shortcuts
        self.root.bind("<Control-s>", lambda e: self.save_game())
        self.root.bind("<Control-l>", lambda e: self.load_game())
        
    def load_game_data(self):
        """Load game data from JSON file"""
        try:
            with open("game_data.json", "r") as f:
                self.game_data = json.load(f)
        except FileNotFoundError:
            messagebox.showerror("Error", "game_data.json not found!")
            self.root.quit()
    
    def create_ui(self):
        """Create the game UI"""
        # Main container
        main_frame = tk.Frame(self.root, bg="#1a1a1a")
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Left panel - Inventory & Menu
        left_frame = tk.Frame(main_frame, bg="#2a2a2a", width=150)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, padx=(0, 10))
        left_frame.pack_propagate(False)
        
        # Menu buttons
        menu_frame = tk.Frame(left_frame, bg="#2a2a2a")
        menu_frame.pack(fill=tk.X, padx=5, pady=5)
        
        save_btn = tk.Button(menu_frame, text="Save", bg="#333333", fg="#00FF00",
                            font=("Arial", 8), command=self.save_game, width=7)
        save_btn.pack(side=tk.LEFT, padx=2)
        
        load_btn = tk.Button(menu_frame, text="Load", bg="#333333", fg="#00FF00",
                            font=("Arial", 8), command=self.load_game, width=7)
        load_btn.pack(side=tk.LEFT, padx=2)
        
        inv_label = tk.Label(left_frame, text="INVENTORY", bg="#2a2a2a", fg="#00FF00", 
                            font=("Arial", 10, "bold"))
        inv_label.pack(pady=5)
        
        self.inventory_text = scrolledtext.ScrolledText(left_frame, width=18, height=25, 
                                                       bg="#1a1a1a", fg="#00FF00", 
                                                       font=("Courier", 9))
        self.inventory_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.inventory_text.config(state=tk.DISABLED)
        
        # Right panel - Game view
        right_frame = tk.Frame(main_frame, bg="#1a1a1a")
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        # Location name
        self.location_label = tk.Label(right_frame, text="", bg="#1a1a1a", fg="#FFFF00",
                                      font=("Arial", 14, "bold"))
        self.location_label.pack(pady=10)
        
        # Image placeholder
        self.image_label = tk.Label(right_frame, text="", bg="#1a1a1a", fg="#00CCFF",
                                   font=("Arial", 48))
        self.image_label.pack(pady=10)
        
        # Description
        self.description_text = scrolledtext.ScrolledText(right_frame, width=60, height=10,
                                                         bg="#0a0a0a", fg="#FFFFFF",
                                                         font=("Arial", 10))
        self.description_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.description_text.config(state=tk.DISABLED)
        
        # Button frame
        button_frame = tk.Frame(right_frame, bg="#1a1a1a")
        button_frame.pack(fill=tk.X, pady=10)
        
        self.buttons = []
        for i in range(4):
            btn = tk.Button(button_frame, text="", width=20, bg="#333333", fg="#00FF00",
                           font=("Arial", 10), command=lambda idx=i: self.click_button(idx))
            btn.pack(side=tk.LEFT, padx=5)
            self.buttons.append(btn)
    
    def update_inventory_display(self):
        """Update the inventory display"""
        self.inventory_text.config(state=tk.NORMAL)
        self.inventory_text.delete("1.0", tk.END)
        
        if not self.inventory:
            self.inventory_text.insert(tk.END, "Empty")
        else:
            for item_id in self.inventory:
                item = self.find_item(item_id)
                if item:
                    self.inventory_text.insert(tk.END, f"• {item['name']}\n")
        
        self.inventory_text.config(state=tk.DISABLED)
    
    def find_item(self, item_id):
        """Find item data by ID"""
        for item in self.game_data["items"]:
            if item["id"] == item_id:
                return item
        return None
    
    def load_location(self, location_id):
        """Load a location"""
        if location_id == "boss_arena":
            self.start_boss_fight()
            return
        
        if location_id not in self.game_data["locations"]:
            messagebox.showerror("Error", f"Location {location_id} not found!")
            return
        
        location = self.game_data["locations"][location_id]
        self.current_location = location_id
        
        # Update location display
        self.location_label.config(text=location["name"])
        self.image_label.config(text=location["image_placeholder"])
        
        self.description_text.config(state=tk.NORMAL)
        self.description_text.delete("1.0", tk.END)
        
        # Check for loot
        if location.get("loot"):
            loot = location["loot"]
            self.description_text.insert(tk.END, f"{location['description']}\n\n")
            self.description_text.insert(tk.END, f">>> {loot['message']}\n", "highlight")
            if loot["item_id"] not in self.inventory:
                self.inventory.append(loot["item_id"])
                self.update_inventory_display()
        else:
            self.description_text.insert(tk.END, location["description"])
        
        self.description_text.config(state=tk.DISABLED)
        
        # Update buttons
        self.update_buttons(location["exits"])
    
    def update_buttons(self, exits):
        """Update action buttons"""
        # Disable all buttons
        for btn in self.buttons:
            btn.config(state=tk.DISABLED, text="")
        
        # Enable buttons for available exits
        for i, exit_data in enumerate(exits[:4]):
            if i < len(self.buttons):
                self.buttons[i].config(
                    text=exit_data["text"],
                    state=tk.NORMAL,
                    command=lambda dest=exit_data["destination"]: self.load_location(dest)
                )
    
    def click_button(self, idx):
        """Handle button click"""
        pass  # Button commands are set in update_buttons
    
    def start_boss_fight(self):
        """Start the boss fight"""
        self.in_boss_fight = True
        self.boss_stage = 0
        self.show_boss_stage()
    
    def show_boss_stage(self):
        """Display current boss stage"""
        self.location_label.config(text="DRAGON BATTLE!")
        self.image_label.config(text="🐉")
        
        self.description_text.config(state=tk.NORMAL)
        self.description_text.delete("1.0", tk.END)
        
        stages = self.game_data["boss_fight"]["stages"]
        if self.boss_stage >= len(stages):
            self.show_victory()
            return
        
        current_stage = stages[self.boss_stage]
        self.description_text.insert(tk.END, f"Stage {current_stage['stage']}/{len(stages)}\n\n")
        self.description_text.insert(tk.END, current_stage["message"])
        
        self.description_text.config(state=tk.DISABLED)
        
        # Check for required item
        required_item = current_stage.get("required_item")
        if required_item and required_item not in self.inventory:
            # Player loses
            self.show_defeat()
            return
        
        # Create button to advance to next stage
        for btn in self.buttons:
            btn.config(state=tk.DISABLED, text="")
        
        self.buttons[0].config(
            text="Continue to Next Stage",
            state=tk.NORMAL,
            command=self.next_boss_stage
        )
    
    def next_boss_stage(self):
        """Advance to next boss stage"""
        self.boss_stage += 1
        stages = self.game_data["boss_fight"]["stages"]
        if self.boss_stage >= len(stages):
            self.show_victory()
        else:
            self.show_boss_stage()
    
    def show_victory(self):
        """Show victory screen"""
        self.location_label.config(text="VICTORY!", fg="#00FF00")
        self.image_label.config(text="⭐")
        
        self.description_text.config(state=tk.NORMAL)
        self.description_text.delete("1.0", tk.END)
        
        ending = self.game_data["endings"]["victory"]
        self.description_text.insert(tk.END, f"{ending['title']}\n\n")
        self.description_text.insert(tk.END, ending["message"])
        
        self.description_text.config(state=tk.DISABLED)
        
        # Disable all buttons
        for btn in self.buttons:
            btn.config(state=tk.DISABLED, text="")
    
    def show_defeat(self):
        """Show defeat screen"""
        self.location_label.config(text="DEFEAT!", fg="#FF0000")
        self.image_label.config(text="💀")
        
        self.description_text.config(state=tk.NORMAL)
        self.description_text.delete("1.0", tk.END)
        
        ending = self.game_data["endings"]["defeat"]
        self.description_text.insert(tk.END, f"{ending['title']}\n\n")
        self.description_text.insert(tk.END, ending["message"])
        
        self.description_text.config(state=tk.DISABLED)
        
        # Create restart button
        for btn in self.buttons[:3]:
            btn.config(state=tk.DISABLED, text="")
        
        self.buttons[0].config(
            text="Try Again",
            state=tk.NORMAL,
            command=self.restart_game
        )
    
    def restart_game(self):
        """Restart the game"""
        self.current_location = self.game_data["game_metadata"]["starting_location"]
        self.inventory = []
        self.boss_stage = 0
        self.in_boss_fight = False
        self.load_location(self.current_location)
        self.update_inventory_display()
    
    def save_game(self):
        """Save game state to JSON file"""
        save_data = {
            "location": self.current_location,
            "inventory": self.inventory,
            "boss_stage": self.boss_stage,
            "in_boss_fight": self.in_boss_fight,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        filename = f"saves/save_{int(time.time())}.json"
        try:
            with open(filename, "w") as f:
                json.dump(save_data, f, indent=2)
            messagebox.showinfo("Success", f"Game saved!\n\n{filename}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save: {e}")
    
    def load_game(self):
        """Load game state from most recent save"""
        saves = []
        if os.path.exists("saves"):
            saves = sorted([f for f in os.listdir("saves") if f.endswith(".json")])
        
        if not saves:
            messagebox.showwarning("No Saves", "No saved games found!")
            return
        
        # Load most recent save
        latest_save = os.path.join("saves", saves[-1])
        try:
            with open(latest_save, "r") as f:
                save_data = json.load(f)
            
            self.current_location = save_data["location"]
            self.inventory = save_data["inventory"]
            self.boss_stage = save_data["boss_stage"]
            self.in_boss_fight = save_data["in_boss_fight"]
            
            self.update_inventory_display()
            self.load_location(self.current_location)
            messagebox.showinfo("Loaded", f"Game loaded from:\n{save_data['timestamp']}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load: {e}")


def main():
    root = tk.Tk()
    game = AdventureGame(root)
    root.mainloop()


if __name__ == "__main__":
    main()
