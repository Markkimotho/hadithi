# Voice guide

How Hadithi's text should sound. The prose lint (`scripts/prose-lint.mjs`)
checks the mechanical rules. The prose eval (`evals/prose.mjs`) judges the rest
blind against the second-edition text. A tale opts into the strict rules by
declaring `voice: 3` once it has been rewritten against this guide.

## What we are fixing

The second-edition text reads as if a machine wrote it. The tells:

- Every sentence is 9 to 14 words long. Read aloud, it drones.
- Scenes end on a moral: "Some things are too large to keep." "Every action
  leaves a trace."
- Semicolons balance two neat halves: "Beyond the wall, Anansi's footprints
  point toward the forest; someone has brushed leaves over them in a hurry."
- It summarises feelings ("Your father is leaving before anyone can ask him for
  advice") instead of showing what someone does.
- Almost nobody speaks.
- Ghana, Japan, Germany, and Baghdad all sound the same.

## Rules for every tale

1. **Someone speaks in every scene.** Use quoted dialogue with curly quotes.
   People reveal themselves by what they say and how.
2. **Concrete before abstract.** Write "cold ash", not "the fire is cold".
   Write "kenkey wrapped in plantain leaf", not "food".
3. **Vary the breath.** Mix 2-word sentences with 25-word ones. The lint fails
   three sentences in a row that sit within 3 words of each other.
4. **End on an image or a line of dialogue, never a moral.** Let the player
   draw the lesson.
5. **No semicolons in narration.** Split the sentence, or join it with "and" or
   "but".
6. **Humour where the source has it.** Anansi is funny. The Bremen animals are
   funny. The qadi's court has a comic edge. Urashima is not funny.
7. **Second person, present tense, for the player.** Past tense is only for
   what happened before the tale began.
8. **Scene text in world mode is 1 to 3 short lines.** The world now shows the
   place, so text carries voice and intent, not description. Classic view keeps
   the longer version.
9. **Banned:** the CLAUDE.md vocabulary list, em dashes, "you notice", "you
   feel a", "a sense of", "something shifts", and "hangs in the air".

## Narrators by tale

### The Wisdom in the Pot (Fante, Ghana)

Source: W. H. Barker and Cecilia Sinclair, *West African Folk-Tales* (1917).

A teasing village storyteller who knows Anansi too well and loves him anyway.
Asides to the listener. Proverb-flavoured lines belong in characters' mouths,
never in the narrator's closing line. Anansi talks fast, flatters, and
contradicts himself. Kweku is dry.

> Before: "The cooking fire is cold. One enormous pot is missing. Beyond the
> wall, Anansi's footprints point toward the forest; someone has brushed leaves
> over them in a hurry."
>
> After: "Cold ash. Mother's big pot is gone from its three stones, and so is
> Father. He swept leaves over his footprints, but he swept the way he does
> everything: fast, and only on the side he could see."

**Cultural review needed:** any Akan storytelling opener or closing formula,
and any Twi words, before release.

### The Palace Beneath the Tide (Tango coast, Japan)

Source: Yei Theodora Ozaki, *Japanese Fairy Tales* (1903).

Quiet and seasonal. The narrator is precise about light, water, and the
temperature of things. Use short lines and leave room between them. Otohime is
courteous and never says the sad thing directly. Grief is never named, only
shown.

### The Midnight Orchestra (Grimm, Germany)

Source: Grimm, *The Travelling Musicians* (Taylor and Edwardes translation).

Brisk and comic, with rhythmic repetition in the folk-tale manner: each animal
gets the same beat with a twist. The robbers bicker. The donkey is sure of
himself, and the cat is not.

### The Olive Jar (Baghdad, *The Thousand and One Nights*)

Source: Andrew Lang (ed.), *The Arabian Nights Entertainments* (1898), from
Galland's French.

A court raconteur with nested asides, polite formulas that cut, and merchants
who swear by everything. The children's mock court is played straight by the
children, and that is the joke.

**Cultural review needed:** honorifics, oath formulas, and the Galland framing.
The original storyteller cannot be confirmed (see `docs/EPISODES.md`).

## Interface text

Use sentence case, plain words, and no slogans. Write "Looking is free. Doing
takes a turn.", not "LOOK · THINK · ACT". Labels say what a thing is ("Your
bag", "What you know") and avoid metaphors.
