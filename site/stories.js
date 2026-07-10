// Content is declarative data. These helpers only reduce repeated authoring fields.
const all = (...conditions) => ({ all: conditions });
const any = (...conditions) => ({ any: conditions });
const flag = (name) => ({ flag: name });
const not = (c) => ({ not: c });
const item = (name) => ({ item: name });
const stat = (name, gte) => ({ stat: name, gte });
const theme = (name) => ({ theme: name });
const A = (id, label, type, effects, text, extra = {}) => ({
  id,
  label,
  type,
  effects,
  text,
  ...extra,
});
const go = (id, label, to, text, extra = {}) =>
  A(id, label, "TRAVEL", { to }, text, extra);
const inspect = (id, label, clue, extra = {}) =>
  A(id, label, "INSPECT", { flags: { [id]: true }, clues: [clue] }, clue, {
    visible: not(flag(id)),
    ...extra,
  });
const take = (id, label, object, text, extra = {}) =>
  A(id, label, "TAKE_ITEM", { give: [object], flags: { [id]: true } }, text, {
    visible: not(flag(id)),
    ...extra,
  });
const S = (title, kicker, text, actions, extra = {}) => ({
  title,
  kicker,
  text,
  actions,
  ...extra,
});
const E = (id, when, text, effects = {}, extra = {}) => ({
  id,
  when,
  text,
  effects,
  ...extra,
});
const source = (title, by, year, url, note) => ({
  title,
  by,
  year,
  url,
  note,
  rights:
    "Consulted edition: public domain in the USA. Original game adaptation; no source text or images reproduced.",
  checked: "18 October 2026",
});
const themes = (mystery, survival) => ({
  wonder: {
    name: "Wonder",
    icon: "✧",
    description: "Follow unexpected friendships and strange possibilities.",
    effect:
      "You leave room for unlikely help. Relationships now shape the road ahead.",
    effects: {},
  },
  mystery: {
    name: "Mystery",
    icon: "⌕",
    description: mystery.description,
    effect: mystery.effect,
    effects: mystery.effects ?? {},
  },
  survival: {
    name: "Survival",
    icon: "△",
    description: survival.description,
    effect: survival.effect,
    effects: survival.effects ?? {},
  },
});

export const wisdom = {
  version: 1,
  revision: 1,
  id: "wisdom",
  number: "01",
  title: "The Wisdom\nin the Pot",
  subtitle: "Some things are too large to keep.",
  region: "Africa",
  tradition: "Fante · Ghana",
  genre: "Trickster adventure",
  duration: "10–20 min",
  difficulty: "Clever hands",
  role: "Kweku Tsin",
  notes: "Family conflict, storms, falls. No graphic violence.",
  hook: "Anansi is carrying the world’s wisdom into the forest. You are the one person who saw him leave.",
  source: source(
    "How Wisdom Became the Property of the Human Race",
    "W. H. Barker & Cecilia Sinclair, West African Folk-Tales",
    "1917",
    "https://www.gutenberg.org/ebooks/66923",
    "A Fante Anansi tale from present-day Ghana. The collection names Kweku Tsin as Anansi’s son. Its colonial framing is not reproduced. The river, puzzles, and alternative outcomes are new game fiction. The original oral storytellers were not individually credited in this edition.",
  ),
  start: "courtyard",
  objective: "Find Anansi. Discover what he is hiding.",
  opening:
    "Dawn. A pot scrapes the courtyard wall. Your father is leaving before anyone can ask him for advice.",
  initialStats: { trust: 1, insight: 0, danger: 0 },
  statLabels: { trust: "Trust", insight: "Insight", danger: "Storm pressure" },
  themes: themes(
    {
      description: "Read the traces. Find out why the pot was sealed.",
      effect:
        "The forest becomes a trail of evidence. A second seal on the pot may open a different bargain.",
      effects: { flags: { investigate: true }, stats: { insight: 1 } },
    },
    {
      description: "Watch the sky. Find the quickest safe route.",
      effect:
        "You focus on shelter and footing. A high route opens at the river, but trust alone will not hold a slipping rope.",
      effects: { stats: { danger: -1 } },
    },
  ),
  items: {
    cord: {
      name: "Palm cord",
      glyph: "⌁",
      description:
        "Strong enough for a load. Combine with the cloth to make a carrying sling.",
    },
    cloth: {
      name: "Woven cloth",
      glyph: "▧",
      description:
        "A wide strip of plain woven cloth. A rain cover, a bandage, or half of a sling.",
    },
    sling: {
      name: "Carrying sling",
      glyph: "⋈",
      description:
        "Cord joined to cloth. It leaves both hands free. Useful on a crossing or around a heavy pot.",
    },
    gourd: {
      name: "Empty gourd",
      glyph: "♧",
      description:
        "A watertight vessel. It can carry drinking water or catch something that escapes.",
    },
    water: {
      name: "Gourd of water",
      glyph: "◒",
      description:
        "Clean water from the market well. Someone working at the river might welcome it.",
    },
    reed: {
      name: "Long reed",
      glyph: "╱",
      description:
        "Light, straight, and much longer than your arm. Tests depth or reaches beyond a ledge.",
    },
    pot: {
      name: "Pot of wisdom",
      glyph: "Ω",
      description:
        "Warm through the clay. The voices inside disagree with each other.",
    },
  },
  recipes: [
    {
      id: "sling",
      label: "Weave a carrying sling",
      ingredients: ["cord", "cloth"],
      result: "sling",
      text: "You pass cord through the folded cloth. A broad pocket takes weight without tying up your hands.",
    },
  ],
  scenes: {
    courtyard: S(
      "A secret at daybreak",
      "Anansi’s courtyard",
      "The cooking fire is cold. One enormous pot is missing. Beyond the wall, Anansi’s footprints point toward the forest; someone has brushed leaves over them in a hurry.",
      [
        inspect(
          "tracks",
          "Study the covered footprints",
          "Anansi is walking slowly. A heavy load drags in front of him, not behind.",
          {
            effects: {
              flags: { tracks: true },
              stats: { insight: 1 },
              clues: ["A heavy load hangs in front of Anansi."],
            },
            spot: [67, 78],
          },
        ),
        take(
          "takeCord",
          "Lift the loose palm cord",
          "cord",
          "You coil the cord around your wrist.",
          { spot: [25, 72] },
        ),
        go(
          "market",
          "Visit the waking market",
          "market",
          "The first sellers are unfolding their awnings.",
        ),
        A(
          "trail",
          "Follow Anansi into the forest",
          "TRAVEL",
          { to: "trail", flags: { wild: true } },
          "A last glimpse of clay vanishes between the trees.",
        ),
      ],
    ),
    market: S(
      "Things people know",
      "The market well",
      "A potter repairs a cracked water jar. “Your father asked whether a tree could keep a secret,” she says. “I told him trees have roots everywhere.” A cloth and a spare gourd lie beside her tools.",
      [
        take(
          "takeCloth",
          "Ask for the spare cloth",
          "cloth",
          "“Bring it back if it survives,” the potter says.",
          { spot: [30, 65] },
        ),
        take(
          "takeGourd",
          "Take the offered gourd",
          "gourd",
          "You thank her and shoulder the light vessel.",
          { spot: [70, 70] },
        ),
        A(
          "listen",
          "Help repair the jar and listen",
          "TALK",
          {
            flags: { listened: true },
            stats: { trust: 1 },
            clues: ["A carrying sling should hold its load against the back."],
          },
          "While you steady the jar, she shows how a load rests safely against a carrier’s back.",
          { visible: not(flag("listened")) },
        ),
        go(
          "well",
          "Draw water at the well",
          "well",
          "A bucket knocks against the well stones.",
        ),
        go(
          "home",
          "Return to the courtyard",
          "courtyard",
          "The tracks are still visible.",
        ),
      ],
    ),
    well: S(
      "A small provision",
      "The well",
      "The bucket is full. Carrying water takes a moment, but a hot day in the forest can make that moment worthwhile.",
      [
        A(
          "fill",
          "Fill the gourd",
          "USE_ITEM",
          { remove: ["gourd"], give: ["water"], flags: { filled: true } },
          "You fill the gourd and tie its stopper.",
          {
            when: item("gourd"),
            visible: not(flag("filled")),
            requires: "Empty gourd",
            uses: "gourd",
            spot: [50, 62],
          },
        ),
        go(
          "back",
          "Return to the market",
          "market",
          "The potter waves you on.",
        ),
      ],
    ),
    trail: S(
      "The path that bends",
      "Forest edge",
      "One track goes down to the river. The other climbs through thorns toward a high crossing. Anansi has taken the low path. Rain clouds are collecting behind the hills.",
      [
        take(
          "takeReed",
          "Cut a fallen reed to length",
          "reed",
          "You strip the broken leaves from a long reed.",
          { spot: [20, 70] },
        ),
        go(
          "river",
          "Follow the low path",
          "river",
          "You hear a ferryman pulling a boat onto the bank.",
        ),
        go(
          "ridge",
          "Scout the high crossing",
          "ridge",
          "Roots make steps through the slope.",
        ),
        go(
          "back",
          "Return for supplies",
          "courtyard",
          "The forest is close enough to return without losing the track.",
        ),
      ],
    ),
    ridge: S(
      "Above the water",
      "A narrow ridge",
      "A fallen trunk spans the ravine. Rain has polished its bark. From here you can reach the grove without disturbing the ferry, if you can keep both hands free.",
      [
        A(
          "cross",
          "Secure the sling and cross",
          "USE_ITEM",
          { to: "grove", stats: { danger: -1 }, flags: { highRoute: true } },
          "The sling stays against your back. You cross slowly, hands on the trunk.",
          {
            when: all(item("sling"), theme("survival")),
            requires: "Carrying sling · survival theme",
            uses: "sling",
          },
        ),
        inspect(
          "ridgeClue",
          "Read the marks on the trunk",
          "Someone turned back here: the pot’s circular scrape faces the wrong way.",
        ),
        go(
          "back",
          "Take the river route",
          "river",
          "There is no shame in choosing firmer ground.",
        ),
      ],
    ),
    river: S(
      "A crossing has a price",
      "The riverbank",
      "A ferryman struggles with a tangled mooring. Anansi has already crossed on stepping stones. Water darkens their edges. You can help, investigate the ford, or spend time finding another route.",
      [
        A(
          "water",
          "Offer the ferryman your water",
          "USE_ITEM",
          {
            remove: ["water"],
            give: ["gourd"],
            flags: { favor: true },
            stats: { trust: 1 },
          },
          "He drinks, then points out where the current curls away from the stones. “I will remember this.”",
          {
            when: item("water"),
            visible: not(flag("favor")),
            uses: "water",
            requires: "Gourd of water",
            spot: [65, 65],
          },
        ),
        A(
          "untangle",
          "Help untangle the mooring",
          "TALK",
          { flags: { helped: true, favor: true }, stats: { trust: 1 } },
          "Two pairs of hands free the rope. He promises to watch the crossing.",
          { cost: 2, visible: not(flag("favor")) },
        ),
        go(
          "ford",
          "Examine the stepping stones",
          "ford",
          "The nearest stone is warm under the clouded sky.",
        ),
        go(
          "ridge",
          "Climb toward the ridge",
          "ridge",
          "You trade the current for a steep climb.",
        ),
      ],
      {
        variants: [
          {
            when: flag("rain"),
            text: "The storm has raised the water. An untested crossing will now cost more strain.",
          },
        ],
      },
    ),
    ford: S(
      "Measure before you leap",
      "The stepping stones",
      "Three pale stones break the surface. The center one rocks under drifting branches. The far bank is close, but the color of water does not reveal its depth.",
      [
        A(
          "probe",
          "Probe the stones with the reed",
          "USE_ITEM",
          {
            flags: { safeFord: true },
            stats: { insight: 1 },
            clues: [
              "The downstream stones sit on bedrock. The center stone is loose.",
            ],
          },
          "The reed finds firm ground downstream. You mark a safe way across.",
          {
            when: item("reed"),
            visible: not(flag("safeFord")),
            uses: "reed",
            requires: "Long reed",
            spot: [47, 68],
          },
        ),
        A(
          "safe",
          "Follow the tested crossing",
          "TRAVEL",
          { to: "grove" },
          "One firm step after another brings you to the far bank.",
          { when: flag("safeFord"), requires: "Test the crossing" },
        ),
        A(
          "wade",
          "Wade along the bank instead",
          "TRAVEL",
          { to: "grove", stats: { danger: 2 } },
          "You keep your feet on the gravel. The water is exhausting, but you reach the grove.",
          {
            cost: 2,
            when: { stat: "danger", lte: 5 },
            requires: "Storm pressure below 6; test the ford or ask for help",
          },
        ),
        A(
          "ferry",
          "Ask the ferryman to carry you across",
          "TALK",
          { to: "grove", stats: { danger: -1 } },
          "The ferryman keeps the boat close to shore. Your earlier help has opened a safe crossing.",
          { cost: 2, when: flag("favor"), requires: "Help the ferryman first" },
        ),
        go(
          "back",
          "Ask the ferryman for another way",
          "river",
          "You return to the mooring.",
        ),
      ],
    ),
    grove: S(
      "A voice above the leaves",
      "The silk-cotton grove",
      "Anansi is not here, but a branch trembles high above. A boy collecting fallen wood says he heard a pot arguing with itself. He offers to show you the tree if you help carry his bundle.",
      [
        A(
          "help",
          "Carry half the bundle",
          "TALK",
          { flags: { woodHelp: true }, stats: { trust: 1 } },
          "He sets down his load. “He keeps trying with the pot in front. Even I can see the problem.”",
          { visible: not(flag("woodHelp")) },
        ),
        inspect(
          "bark",
          "Examine the clay on the bark",
          "Two colors of wax cling to the tree. The pot may have been sealed twice.",
          {
            visible: all(theme("mystery"), not(flag("bark"))),
            effects: {
              flags: { bark: true, secondSeal: true },
              stats: { insight: 1 },
              clues: [
                "The pot has two seals. One was added after the wisdom was gathered.",
              ],
            },
          },
        ),
        go(
          "tree",
          "Approach the tallest tree",
          "tree",
          "A familiar irritated voice complains about the branches.",
        ),
        go(
          "back",
          "Return to the crossing",
          "ford",
          "You keep the tall tree in sight.",
        ),
      ],
      { checkpoint: true },
    ),
    tree: S(
      "All the wisdom, one problem",
      "Beneath Anansi’s tree",
      "Your father clings to the trunk. The pot hangs in front of his knees. “Go home,” he says. “This is a matter for someone who knows everything.” The cord gives a small, sharp creak.",
      [
        A(
          "call",
          "Ask why he is hiding the pot",
          "TALK",
          {
            flags: { reason: true },
            stats: { insight: 1 },
            clues: [
              "Anansi fears being useful only when someone needs an answer.",
            ],
          },
          "“They come for answers, never to ask how I am,” he says. For a moment the pot stops moving.",
          { visible: not(flag("reason")) },
        ),
        go(
          "knot",
          "Work out a safer carrying knot",
          "knot",
          "You lay out the cord’s path on the ground.",
        ),
        go(
          "ledge",
          "Climb to the lower ledge",
          "ledge",
          "You take the low branches, testing each before trusting it.",
        ),
        go(
          "grove",
          "Speak with the wood-gatherer again",
          "grove",
          "There may be another answer down below.",
        ),
      ],
    ),
    knot: S(
      "Let the weight follow",
      "A practical puzzle",
      "You can show Anansi how to carry the load. Arrange three steps: make a loop, put the weight behind the carrier, then tighten. The order matters; tightening first leaves no space for the pot.",
      [
        A(
          "show",
          "Demonstrate the carrying knot",
          "SOLVE",
          { to: "ledge", flags: { knotTaught: true }, stats: { trust: 1 } },
          "Anansi watches, then shifts the pot to his back. His first easy breath says more than his words.",
        ),
        go("back", "Return to the tree", "tree", "The knot can wait."),
      ],
      {
        puzzle: {
          prompt: "Build the carrying knot",
          clue: "Loop first → move the weight behind → tighten last.",
          options: [
            { id: "tighten", label: "Tighten", glyph: "⋈" },
            { id: "loop", label: "Make a loop", glyph: "◯" },
            { id: "back", label: "Move behind", glyph: "↶" },
          ],
          solution: ["loop", "back", "tighten"],
          solvedFlag: "knotSolved",
          success:
            "The loop holds without pinning the carrier’s arms. You can demonstrate it now.",
          failure:
            "The loop closes before the weight is secure. Lay it out again; no materials are lost.",
        },
      },
    ),
    ledge: S(
      "The crack in certainty",
      "A ledge above the grove",
      "The pot rests on a branch between you. A hairline crack runs beneath its wax. Anansi reaches for it, then hesitates. You have one clear moment to decide what you are trying to save.",
      [
        A(
          "sling",
          "Secure the pot in your sling",
          "USE_ITEM",
          {
            to: "pot",
            give: ["pot"],
            flags: { secured: true },
            stats: { danger: -1 },
          },
          "The cloth takes the pot’s weight. Neither of you needs to hold it alone.",
          {
            when: item("sling"),
            uses: "sling",
            requires: "Carrying sling",
            spot: [50, 50],
          },
        ),
        A(
          "hands",
          "Ask Anansi to lower it with you",
          "TALK",
          { to: "pot", give: ["pot"], stats: { danger: 1 } },
          "Together you lower the pot. The cracked clay groans, but holds.",
        ),
        A(
          "break",
          "Let the pot fall and catch what you can",
          "CHOOSE",
          { ending: "scattered" },
          "You step back. The pot strikes the root below, and its voices rise into the rain.",
        ),
      ],
    ),
    pot: S(
      "What the clay contains",
      "The open question",
      "A hundred contradictory answers press against the clay. Some are warnings. Some are jokes. One voice keeps asking who decided that knowing a thing meant owning it.",
      [
        inspect(
          "seal",
          "Examine the second wax seal",
          "The newer seal bears no lock. It is a promise Anansi made to himself.",
          {
            visible: all(theme("mystery"), not(flag("seal"))),
            effects: {
              flags: { seal: true, secondSeal: true },
              stats: { insight: 1 },
              clues: [
                "The second seal is a promise, not a lock. A keeper could choose to open it.",
              ],
            },
          },
        ),
        A(
          "gourd",
          "Use the gourd to catch a whisper",
          "USE_ITEM",
          { flags: { savedWhisper: true }, stats: { insight: 1 } },
          "One small answer settles in the gourd: “An answer can belong to everyone and still matter to its teller.”",
          {
            when: item("gourd"),
            visible: not(flag("savedWhisper")),
            uses: "gourd",
            requires: "Empty gourd",
          },
        ),
        go(
          "council",
          "Carry the question back to the grove",
          "council",
          "You and Anansi climb down together.",
        ),
      ],
    ),
    council: S(
      "A pot is also a circle",
      "The grove at evening",
      "The ferryman, potter, and wood-gatherer have followed the sound. Anansi sets the pot in the middle. Nobody asks him to be right. They ask what he wants to do next.",
      [
        A(
          "share",
          "Open the pot together",
          "CHOOSE",
          { ending: "shared" },
          "You make room in the circle for Anansi.",
          { when: stat("trust", 2), requires: "Trust 2 or more" },
        ),
        A(
          "keeper",
          "Propose a keeper, with an open door",
          "BARGAIN",
          { ending: "keeper" },
          "You name the promise under the second seal.",
          {
            when: all(theme("mystery"), flag("secondSeal")),
            requires: "Mystery theme · discover the second seal",
          },
        ),
        A(
          "release",
          "Release the wisdom into the wind",
          "CHOOSE",
          { ending: "scattered" },
          "No pot can decide where a thought should travel.",
        ),
      ],
      { checkpoint: true },
    ),
    squall: S(
      "The sky interrupts",
      "Storm encounter",
      "Rain crashes through the canopy. The path becomes a stream. You have to protect your footing before you can return to what you were doing.",
      [
        A(
          "cover",
          "Anchor the sling around a root",
          "USE_ITEM",
          { to: "$return", stats: { danger: -1 } },
          "You hold on while the first rush passes.",
          { when: item("sling"), requires: "Carrying sling", uses: "sling" },
        ),
        A(
          "shelter",
          "Wait under the rock overhang",
          "WAIT",
          { to: "$return" },
          "Two turns pass. The fiercest rain moves downstream.",
          { cost: 2 },
        ),
        A(
          "push",
          "Push through the rain",
          "CHOOSE",
          { to: "$return", stats: { danger: 2 } },
          "You get moving quickly, but the wet ground leaves you strained.",
        ),
      ],
    ),
  },
  events: [
    E(
      "marketWakes",
      { scene: "market" },
      "A seller starts a song. Another answers from across the well. Knowledge has always moved like this.",
    ),
    E(
      "clouds",
      { turn: 5 },
      "Thunder rolls behind the hills. The next rain will reach the crossing.",
      { flags: { clouds: true } },
    ),
    E(
      "rain",
      all({ turn: 10 }, flag("wild")),
      "The storm reaches you. Everything loose begins to move.",
      { flags: { rain: true } },
      { interrupt: "squall", priority: 10 },
    ),
    E(
      "riverRise",
      flag("rain"),
      "Downstream, the river swells. The center stepping stone disappears.",
      { stats: { danger: 1 } },
      { delay: 2 },
    ),
    E(
      "favorReturns",
      all(flag("favor"), { scene: "grove" }),
      "The ferryman catches up carrying a dry rope. Your earlier help has made the return crossing safer.",
      {
        stats: { danger: -1 },
        clues: ["The ferryman is watching the return crossing."],
      },
    ),
    E(
      "burden",
      item("sling"),
      "Your hands are free. A practical answer has changed the routes you can attempt.",
    ),
    E(
      "fatherListens",
      flag("knotTaught"),
      "Anansi asks you to show the knot once more. He is listening now.",
      { stats: { insight: 1 } },
    ),
    E(
      "whispers",
      item("pot"),
      "The voices inside the clay grow quieter when two people carry it.",
      { objective: "Decide who the wisdom should belong to." },
    ),
    E(
      "mystery",
      theme("mystery"),
      "A trace of fresh wax catches your eye. Look closely in the grove or at the pot.",
    ),
    E(
      "survival",
      theme("survival"),
      "Above the river, a fallen trunk offers a route that keeps you out of the current.",
    ),
  ],
  endings: {
    shared: {
      title: "A circle wide enough",
      kind: "Shared ending",
      text: "The seal opens without a crack. Each person hears an answer in a voice they recognize. Anansi is still a storyteller; now he can also ask questions. You leave the empty pot in the grove, where anyone can sit beside it.",
      reflection:
        "Trust made sharing possible. The pot survived because someone changed how its weight was carried.",
    },
    keeper: {
      title: "The keeper’s open door",
      kind: "Mystery ending",
      text: "Anansi breaks the newer seal himself. The pot stays in his courtyard, but its door stays open. You write one condition beside it: a keeper must listen as often as they speak. It is an imperfect arrangement, with room to change.",
      reflection:
        "Finding the second seal let you negotiate a new role for the keeper.",
    },
    scattered: {
      title: "What the wind remembers",
      kind: "Bittersweet ending",
      text: "The clay gives way, by accident or invitation. Wisdom scatters beyond the grove. Nobody receives all of it, and nobody can gather it all again. Later you hear a child tell a story your father never knew. You carry that news home.",
      reflection:
        "Releasing the pot ended anyone’s control over it. Something was lost, and something became possible.",
    },
  },
};

export const tide = {
  version: 1,
  revision: 1,
  id: "tide",
  number: "02",
  title: "The Palace\nBeneath the Tide",
  subtitle: "The sea keeps a different hour.",
  region: "Asia",
  tradition: "Japanese · Tango coast",
  genre: "Time-slip mystery",
  duration: "10–20 min",
  difficulty: "Watch the tide",
  role: "Urashima Tarō",
  notes: "Animal entanglement, separation, aging, uncertain homecoming.",
  hook: "You free a turtle. In return, it offers a journey to a palace where the seasons share one wall.",
  source: source(
    "The Story of Urashima Taro, the Fisher Lad",
    "Yei Theodora Ozaki, Japanese Fairy Tales",
    "1903 / consulted preface 1908",
    "https://www.gutenberg.org/ebooks/4018",
    "A Japanese tale in Ozaki’s English retelling, drawing on Sadanami Sanjin. The turtle, underwater palace, sealed box, and changed homecoming come from the tale. The dial, tide rules, and negotiated ending are new game fiction.",
  ),
  start: "shore",
  objective: "Free the turtle caught beside the tide pools.",
  opening:
    "The sea pulls away from the shore. Something trapped in a bright loop of line moves beneath a rock.",
  initialStats: { trust: 1, insight: 0, tide: 0 },
  statLabels: {
    trust: "Turtle’s trust",
    insight: "Understanding",
    tide: "Tide pressure",
  },
  themes: themes(
    {
      description: "Question the palace’s clock and the gift it guards.",
      effect:
        "The palace becomes a puzzle about borrowed time. The archive offers a way to negotiate a return.",
      effects: { stats: { insight: 1 } },
    },
    {
      description: "Track the current and keep a way back.",
      effect:
        "You begin marking safe water. The outer gate offers a direct return if you keep the turtle’s trust.",
      effects: { stats: { tide: -1 } },
    },
  ),
  items: {
    knife: {
      name: "Net knife",
      glyph: "╱",
      description:
        "A short work blade with a blunt tip. Cuts fishing line or frees a jammed mechanism.",
    },
    line: {
      name: "Fishing line",
      glyph: "⌁",
      description:
        "Salvaged from the rocks. It can tether an object against the current.",
    },
    shell: {
      name: "Listening shell",
      glyph: "◔",
      description:
        "The turtle’s gift. Held to the ear, it repeats the order of the seasons. Blown through, it calls a guide.",
    },
    chart: {
      name: "Tide chart",
      glyph: "▤",
      description:
        "A map of currents and years. A guide can read the narrow passage home.",
    },
    tether: {
      name: "Tethered shell",
      glyph: "⊙",
      description:
        "A shell tied to strong line. You can sound a current without losing the shell.",
    },
    box: {
      name: "Sealed box",
      glyph: "▣",
      description:
        "Cool lacquer around something warm. Otohime asked that it stay closed until you understand its cost.",
    },
  },
  recipes: [
    {
      id: "tether",
      label: "Tie a line to the shell",
      ingredients: ["line", "shell"],
      result: "tether",
      text: "The shell can now reach into the current while staying in your hand. It can still call the turtle.",
    },
  ],
  scenes: {
    shore: S(
      "A life in a loop",
      "Tango coast · low tide",
      "A sea turtle has caught its flipper in discarded fishing line. Your boat sits above the wet sand. A net knife rests beside it. The water is returning, one small pool at a time.",
      [
        take(
          "knife",
          "Take your net knife",
          "knife",
          "You slip the familiar work knife into your belt.",
          { spot: [25, 70] },
        ),
        A(
          "cut",
          "Cut the turtle free",
          "USE_ITEM",
          { to: "pools", flags: { rescued: true }, stats: { trust: 1 } },
          "You cut the line without pulling the flipper. The turtle follows you through the shallow water.",
          {
            when: item("knife"),
            requires: "Net knife",
            uses: "knife",
            spot: [65, 70],
          },
        ),
        A(
          "untie",
          "Work the knot loose by hand",
          "SOLVE",
          { to: "pools", flags: { rescued: true }, stats: { trust: 1 } },
          "Patiently, you tease the line apart. Two turns later the turtle is free.",
          { cost: 2 },
        ),
        inspect(
          "shoreMark",
          "Read the old high-water mark",
          "A line on the harbor wall shows how quickly the water can rise. Waiting and traveling advance the world; looking does not.",
        ),
      ],
    ),
    pools: S(
      "An invitation with no map",
      "The tide pools",
      "The turtle turns back. “You gave me time,” it says. “Would you like to see where ours begins?” It nudges a small shell toward you. Behind it, the sea opens into a green road.",
      [
        take(
          "shell",
          "Accept the listening shell",
          "shell",
          "In its spiral, you hear rain, insects, falling leaves, then snow.",
          { spot: [48, 65] },
        ),
        take(
          "line",
          "Recover the loose fishing line",
          "line",
          "You coil the useful length and leave no loops on the beach.",
          { spot: [25, 73] },
        ),
        A(
          "ask",
          "Ask how you will get home",
          "TALK",
          {
            flags: { askedHome: true },
            stats: { insight: 1 },
            clues: [
              "The turtle can guide a return only if you recognize the right current.",
            ],
          },
          "“Keep a chart, or keep a promise,” the turtle says. “The sea confuses people who keep neither.”",
          { visible: not(flag("askedHome")) },
        ),
        go(
          "channel",
          "Follow the green road underwater",
          "channel",
          "The turtle carries you beneath the surface. You can breathe, though you cannot explain how.",
        ),
      ],
    ),
    channel: S(
      "The current has a direction",
      "The descent",
      "Silver fish drift past your shoulder. The road forks around a column of bubbles. A chain of old bells marks the quiet passage; a bright open tunnel promises a faster descent.",
      [
        A(
          "quiet",
          "Follow the quiet bells",
          "TRAVEL",
          { to: "gate", stats: { trust: 1 } },
          "You stay close to the turtle. The bells sway without ringing.",
          { cost: 2 },
        ),
        A(
          "fast",
          "Ride the bright current",
          "TRAVEL",
          { to: "gate", stats: { tide: 2 } },
          "You arrive before your guide, with a current pulling at your clothes.",
        ),
        A(
          "sound",
          "Sound the channel with the tethered shell",
          "USE_ITEM",
          { to: "gate", flags: { safeCurrent: true }, stats: { insight: 1 } },
          "The line draws straight along a sheltered current. You follow it down.",
          { when: item("tether"), requires: "Tethered shell", uses: "tether" },
        ),
      ],
    ),
    gate: S(
      "A palace below the horizon",
      "The outer gate",
      "A roof of deep red tiles hangs against the green water. Otohime waits at the gate. “Welcome, Urashima,” she says. “Ask for what you need. Guests who never ask sometimes forget to leave.”",
      [
        A(
          "promise",
          "Promise to tell her before leaving",
          "TALK",
          { flags: { promised: true }, stats: { trust: 1 } },
          "She bows. “Then there will be no closed door between us.”",
          { visible: not(flag("promised")) },
        ),
        go(
          "hall",
          "Enter the hall of four seasons",
          "hall",
          "Through four windows, four different skies are visible.",
        ),
        A(
          "direct",
          "Ask the turtle for the marked current home",
          "TALK",
          { to: "return", flags: { routeKnown: true } },
          "You choose the short visit. The turtle shows you where to meet it.",
          {
            when: all(theme("survival"), stat("trust", 3)),
            requires: "Survival theme · trust 3",
          },
        ),
      ],
      { checkpoint: true },
    ),
    hall: S(
      "Four windows, one day",
      "The seasonal hall",
      "Spring rain touches one window. Summer insects tick against another. Leaves turn at the third; snow gathers at the fourth. The feast looks freshly set, but the flowers in its bowls have grown roots.",
      [
        inspect(
          "windows",
          "Listen at the four windows",
          "The current follows the year: spring, summer, autumn, winter. The dial in the garden shares that order.",
          { spot: [75, 37] },
        ),
        go(
          "garden",
          "Investigate the seasonal dial",
          "garden",
          "A stone dial turns beneath a canopy of drifting blossoms.",
        ),
        go(
          "archive",
          "Visit the archive of tides",
          "archive",
          "A fish attendant opens a low door.",
        ),
        go(
          "feast",
          "Sit down with Otohime",
          "feast",
          "She moves a bowl aside to make room for your questions.",
        ),
        go(
          "gate",
          "Return to the outer gate",
          "gate",
          "The turtle is waiting patiently.",
        ),
      ],
      {
        variants: [
          {
            when: theme("mystery"),
            text: "Every window has a tiny scale cut into the sill. This beauty is also an instrument.",
          },
          {
            when: theme("survival"),
            text: "The window currents are changing. The quickest exit is back through the outer gate.",
          },
        ],
      },
    ),
    garden: S(
      "Turn with the year",
      "The garden dial",
      "Four carved rings regulate the current. An inscription gives their order: spring rain feeds summer growth; autumn releases it; winter lets it rest. Set the rings in that order to still the water around the archive.",
      [
        A(
          "stilled",
          "Open the still-water passage",
          "SOLVE",
          { to: "stillwater", flags: { passage: true } },
          "The water settles into a transparent corridor.",
        ),
        go(
          "back",
          "Return to the seasonal hall",
          "hall",
          "The rings hold their place.",
        ),
      ],
      {
        puzzle: {
          prompt: "Align the seasonal rings",
          clue: "Spring → summer → autumn → winter.",
          options: [
            { id: "winter", label: "Winter", glyph: "❄" },
            { id: "summer", label: "Summer", glyph: "☀" },
            { id: "spring", label: "Spring", glyph: "❀" },
            { id: "autumn", label: "Autumn", glyph: "❧" },
          ],
          solution: ["spring", "summer", "autumn", "winter"],
          solvedFlag: "dialSolved",
          effects: { stats: { tide: -1, insight: 1 } },
          success: "The rings stop trembling. The passage is safe to open.",
          failure:
            "The seasons clash and a current tugs at you. Check the inscription and try again.",
          failureEffects: { stats: { tide: 1 } },
        },
      },
    ),
    stillwater: S(
      "The year beneath the water",
      "The still-water passage",
      "In this corridor the palace becomes transparent. Years slide past outside like schools of fish. The turtle cannot choose which one carries you home without a chart.",
      [
        take(
          "chart",
          "Copy the return current onto a chart",
          "chart",
          "You mark the narrow current that touches your own shore.",
          { spot: [54, 60] },
        ),
        inspect(
          "years",
          "Watch the years passing",
          "The box does not contain treasure. It holds the years that have not yet caught up with its bearer.",
          {
            effects: {
              flags: { years: true, boxKnown: true },
              stats: { insight: 1 },
              clues: [
                "Opening the box lets the missing years catch up. A chart can anchor a return.",
              ],
            },
          },
        ),
        go(
          "archive",
          "Take your findings to the archivist",
          "archive",
          "You can now ask a more precise question.",
        ),
        go(
          "garden",
          "Return to the seasonal dial",
          "garden",
          "The four rings turn quietly.",
        ),
      ],
    ),
    archive: S(
      "What a gift can cost",
      "Archive of tides",
      "The archivist has no books. Each shelf holds a bottle of seawater from a particular morning. “The princess offers a box when guests leave,” the archivist says. “It keeps a debt of time. Ask what happens when it opens.”",
      [
        A(
          "research",
          "Compare the bottles to your chart",
          "USE_ITEM",
          {
            flags: { negotiated: true, boxKnown: true },
            stats: { insight: 1 },
            clues: [
              "A return can be negotiated before the box opens. Otohime must agree.",
            ],
          },
          "One bottle matches your coast. “A meeting point,” the archivist says. “Not a guarantee. Speak with her.”",
          {
            when: all(item("chart"), theme("mystery")),
            visible: not(flag("negotiated")),
            requires: "Tide chart · mystery theme",
            uses: "chart",
          },
        ),
        A(
          "jam",
          "Free a jammed shelf with the knife",
          "USE_ITEM",
          { flags: { archiveHelp: true }, stats: { trust: 1 } },
          "A trapped bottle slips free. The archivist thanks you and shows a safer way to the gate.",
          {
            when: item("knife"),
            visible: not(flag("archiveHelp")),
            uses: "knife",
            requires: "Net knife",
          },
        ),
        go("hall", "Return to the hall", "hall", "The feast is still waiting."),
        go(
          "garden",
          "Find the chart beyond the garden",
          "garden",
          "The dial controls the way.",
        ),
      ],
    ),
    feast: S(
      "A welcome that could last",
      "Otohime’s table",
      "Otohime asks about the people on your shore. When you describe them, she listens carefully. “I can give you a place here,” she says. “I cannot promise your home will wait.”",
      [
        A(
          "truth",
          "Ask directly about the passing years",
          "TALK",
          { flags: { truth: true, boxKnown: true }, stats: { insight: 1 } },
          "“Time follows different currents,” she answers. “I should have told you before the feast. I am telling you now.”",
          { visible: not(flag("truth")) },
        ),
        A(
          "bargain",
          "Negotiate a return using the chart",
          "BARGAIN",
          { to: "promise", flags: { agreement: true } },
          "You spread the chart between you. Otohime traces a current back to the shore.",
          {
            when: all(flag("negotiated"), stat("trust", 3)),
            requires: "Research the chart · trust 3",
          },
        ),
        go(
          "gift",
          "Ask for the means to leave",
          "gift",
          "Otohime rises and brings a lacquered box.",
        ),
        go(
          "homeSea",
          "Explore what a life here would mean",
          "homeSea",
          "She invites you to see the harbor beneath the palace.",
        ),
      ],
    ),
    promise: S(
      "An honest return",
      "The princess’s promise",
      "“Your shore will have changed,” Otohime says. “With this chart, I can limit the years that pass. I will not hide the cost in a gift.” The turtle waits beside the marked current.",
      [
        A(
          "accept",
          "Accept a changed home and return",
          "CHOOSE",
          { ending: "home" },
          "You leave with a chart, a promise, and no unopened debt.",
        ),
        go(
          "stay",
          "Reconsider a life under the sea",
          "homeSea",
          "You take time to choose a life rather than simply avoid a loss.",
        ),
      ],
      { checkpoint: true },
    ),
    gift: S(
      "The box that must stay shut",
      "The departure chamber",
      "Otohime places the box in your hands. “Keep it closed until you know what it holds.” Its cord has no knot you recognize. The shell against your chest sounds like a distant harbor bell.",
      [
        take(
          "box",
          "Accept the sealed box",
          "box",
          "The lacquer is cool. Something inside is as warm as your own hand.",
          { spot: [50, 66] },
        ),
        A(
          "askGift",
          "Ask what the box is keeping",
          "TALK",
          {
            flags: { boxKnown: true },
            clues: [
              "The box holds the years that have not caught up with you.",
            ],
          },
          "“Your unspent years,” she says. “Opening it gives them back, all at once.”",
          { visible: not(flag("boxKnown")) },
        ),
        go(
          "return",
          "Meet the turtle at the gate",
          "return",
          "The water lifts you toward the surface.",
        ),
        go(
          "stay",
          "Set the gift aside and explore a life here",
          "homeSea",
          "There is still time to choose.",
        ),
      ],
    ),
    return: S(
      "The current home",
      "The outer water",
      "From below, your coast is a thin silver line. The turtle asks for a direction. It will follow your chart, your earlier promise, or simply the strongest current. Those are different journeys.",
      [
        A(
          "charted",
          "Guide the turtle with the tide chart",
          "USE_ITEM",
          { to: "newShore", flags: { chartedReturn: true } },
          "You follow the line you marked beneath the palace.",
          {
            when: all(item("chart"), { stat: "tide", lte: 5 }),
            uses: "chart",
            requires: "Tide chart · tide pressure below 6",
          },
        ),
        A(
          "settle",
          "Shelter behind the gate until the current settles",
          "WAIT",
          { stats: { tide: -3 }, flags: { settled: true } },
          "The strongest current passes. Your chart is easier to follow now.",
          { cost: 2, visible: all(stat("tide", 4), not(flag("settled"))) },
        ),
        A(
          "trusted",
          "Ask the turtle to honor your return promise",
          "TALK",
          { to: "newShore", flags: { chartedReturn: true } },
          "The turtle remembers the care you took at the shore.",
          {
            when: all(theme("survival"), stat("trust", 3)),
            requires: "Survival theme · trust 3",
          },
        ),
        A(
          "current",
          "Ride the strongest current to shore",
          "TRAVEL",
          { to: "newShore" },
          "The water lifts you swiftly, with no sign of which year travels beside you.",
        ),
      ],
    ),
    newShore: S(
      "A shore both familiar and strange",
      "Above the water",
      "The mountain is where it was. The houses are not. A child on the beach recognizes your boat only from a story. You still have to decide what to carry into this changed world.",
      [
        A(
          "closed",
          "Keep the box closed and seek a new beginning",
          "CHOOSE",
          { ending: "century" },
          "You walk inland, carrying your own name.",
        ),
        A(
          "anchor",
          "Use your chart to find the nearest remembered harbor",
          "USE_ITEM",
          { ending: "home" },
          "The chart gives you a place to begin looking.",
          {
            when: flag("chartedReturn"),
            requires: "A charted or guided return",
          },
        ),
        A(
          "open",
          "Open the box, accepting its years",
          "USE_ITEM",
          { ending: "century", flags: { openedBox: true } },
          "You loosen the unfamiliar cord. Time finally arrives.",
          { when: item("box"), requires: "Sealed box", uses: "box" },
        ),
      ],
      { checkpoint: true },
    ),
    homeSea: S(
      "A harbor beneath the sea",
      "The lower harbor",
      "The palace is beautiful. Beyond it, people mend roofs, argue over moorings, and need hands to help. A life here would be a life of work and friendship, not a never-ending feast.",
      [
        A(
          "stay",
          "Choose to make a life beneath the sea",
          "CHOOSE",
          { ending: "sea" },
          "You ask where a fisher’s hands might be useful.",
        ),
        go(
          "leave",
          "Return to Otohime and arrange to leave",
          "feast",
          "You thank the harbor workers and climb back to the hall.",
        ),
      ],
    ),
    surge: S(
      "The passage starts to close",
      "Tide encounter",
      "Water rushes across the corridor. A gate begins to turn. You must anchor yourself, cut a jam, or wait for the current to spend its force.",
      [
        A(
          "anchor",
          "Anchor the tethered shell in the gate",
          "USE_ITEM",
          { to: "$return", stats: { tide: -2 } },
          "The line draws taut. You hold until the current breaks.",
          { when: item("tether"), uses: "tether", requires: "Tethered shell" },
        ),
        A(
          "cut",
          "Cut the weed jamming the gate",
          "USE_ITEM",
          { to: "$return", stats: { tide: -1 } },
          "The freed gate turns with the current instead of against it.",
          { when: item("knife"), uses: "knife", requires: "Net knife" },
        ),
        A(
          "wait",
          "Shelter in a wall niche",
          "WAIT",
          { to: "$return", stats: { tide: 1 } },
          "You wait safely, but the return current shifts while you shelter.",
          { cost: 2 },
        ),
      ],
    ),
  },
  events: [
    E(
      "rescue",
      flag("rescued"),
      "The turtle stays beside you. An act on the shore has become a guide beneath the sea.",
      { objective: "Explore the palace and discover how to return." },
    ),
    E(
      "fish",
      { scene: "channel" },
      "A school of silver fish parts around you, then closes behind like a curtain.",
    ),
    E(
      "dusk",
      { turn: 6 },
      "The light changes. Your own shore may be further away in time than it is in water.",
      { stats: { tide: 1 } },
    ),
    E(
      "gateWelcome",
      { scene: "gate" },
      "The turtle names you as a friend. The gate attendants lower their spears.",
    ),
    E(
      "surge",
      all({ turn: 12 }, { visited: "hall" }),
      "A deep bell sounds. The current suddenly reverses.",
      {},
      { interrupt: "surge", priority: 10 },
    ),
    E(
      "afterSurge",
      { event: "surge" },
      "The seasonal windows slow their turning. The palace has fewer safe passages now.",
      { stats: { tide: 1 } },
      { delay: 2 },
    ),
    E(
      "chart",
      item("chart"),
      "The chart responds to your touch. There is a return current, but it must be chosen.",
      { objective: "Choose a return, or a life below the sea." },
    ),
    E(
      "promiseRemembered",
      all(flag("promised"), { scene: "feast" }),
      "Otohime remembers your promise to speak before leaving. She answers without ceremony.",
      { stats: { trust: 1 } },
    ),
    E(
      "mystery",
      theme("mystery"),
      "The bottles in the archive each preserve a different morning. Compare one with the still-water chart.",
    ),
    E(
      "gift",
      item("box"),
      "The sealed box ticks once. You can leave it closed; the decision belongs to you.",
    ),
  ],
  endings: {
    home: {
      title: "A harbor, honestly changed",
      kind: "Return ending",
      text: "You cannot recover every morning you missed. But the marked current brings you to a shore close enough to recognize and a harbor where your story can be checked. You begin with names, then with a meal. Home is something you can build again.",
      reflection:
        "A chart or a trusted guide gave your return a direction. Understanding the cost mattered more than accepting a beautiful gift.",
    },
    sea: {
      title: "A life with the tide",
      kind: "New home ending",
      text: "You take a room above the lower harbor. Some days you miss the smell of land after rain. Some days you repair a boat beside someone who has never seen a tree. Otohime still visits. Your choice becomes an ordinary, extraordinary life.",
      reflection:
        "You chose a new home with its duties as well as its wonders.",
    },
    century: {
      title: "The shore of another century",
      kind: "Bittersweet ending",
      text: "The names you knew have become stories. Whether you release the years or keep carrying them, your past cannot be restored by a box. The child on the shore asks what really happened. You sit on an overturned boat and begin telling it.",
      reflection:
        "The return current carried you beyond the life you remembered. The story continues through what you choose to tell.",
    },
  },
};

export const orchestra = {
  version: 1,
  revision: 1,
  id: "orchestra",
  number: "03",
  title: "The Midnight\nOrchestra",
  subtitle: "Make enough noise to change your fate.",
  region: "Europe",
  tradition: "German · Grimm collection",
  genre: "A woodland caper",
  duration: "10–20 min",
  difficulty: "Stay together",
  role: "The donkey",
  notes:
    "Threats against animals in the source premise, thieves, pursuit. No graphic violence.",
  hook: "Four unwanted musicians. One occupied house. And a plan that definitely needs a rehearsal.",
  source: source(
    "The Travelling Musicians",
    "Jacob & Wilhelm Grimm; English edition based on Edgar Taylor & Marian Edwardes",
    "19th-century collection",
    "https://www.gutenberg.org/ebooks/2591",
    "Commonly known as the Bremen Town Musicians. This German tale’s donkey, dog, cat, rooster, and occupied woodland house form the premise. Patrols, evidence, conducting puzzle, and negotiation are original additions.",
  ),
  start: "road",
  objective: "Find traveling companions and somewhere safe before night.",
  opening:
    "The farm gate falls shut behind you. Ahead is the road to Bremen. For the first time in years, no one is telling you what to carry.",
  initialStats: { harmony: 1, evidence: 0, alert: 0 },
  statLabels: {
    harmony: "Harmony",
    evidence: "Evidence",
    alert: "Patrol alert",
  },
  themes: themes(
    {
      description: "Follow the stolen goods and build a case.",
      effect:
        "The caper becomes an investigation. A ledger and a witness may give you a safer solution than a fight.",
      effects: { stats: { evidence: 1 } },
    },
    {
      description: "Protect the ensemble and plan an escape.",
      effect:
        "You mark an exit through the orchard. A short, coordinated diversion can keep everyone out of danger.",
      effects: { stats: { alert: -1 } },
    },
  ),
  items: {
    bread: {
      name: "Loaf of bread",
      glyph: "▰",
      description:
        "Dense, slightly stale bread. A meal can win trust or distract a watcher.",
    },
    bell: {
      name: "Old harness bell",
      glyph: "♧",
      description:
        "One clear note. It can time an entrance or draw a patrol away.",
    },
    cord: {
      name: "Baling cord",
      glyph: "⌁",
      description:
        "A long piece of cord. Tie it to the bell for a remote distraction.",
    },
    lure: {
      name: "Bell on a line",
      glyph: "♧",
      description:
        "A bell you can ring from cover. Useful at a gate or during a pursuit.",
    },
    whistle: {
      name: "Reed whistle",
      glyph: "╱",
      description:
        "The rooster’s practice whistle. A quiet signal can bring all four voices in together.",
    },
    ledger: {
      name: "Stolen-goods ledger",
      glyph: "▤",
      description:
        "Names, dates, and stolen goods. Evidence for the town, if you can carry it there.",
    },
  },
  recipes: [
    {
      id: "lure",
      label: "Tie the bell to the cord",
      ingredients: ["bell", "cord"],
      result: "lure",
      text: "You thread the bell onto a long line. It will ring while you remain out of sight.",
    },
  ],
  scenes: {
    road: S(
      "A road without a master",
      "The Bremen road",
      "You are an old donkey with a strong back and a voice no one has thought to ask about. A dog lies in the shade ahead. Beside the milestone, a traveler has left bread and an old harness bell.",
      [
        take(
          "bread",
          "Pick up the wrapped bread",
          "bread",
          "You tuck the loaf into your saddlebag.",
          { spot: [25, 75] },
        ),
        take(
          "bell",
          "Keep the discarded harness bell",
          "bell",
          "It has one clean note left in it.",
          { spot: [60, 73] },
        ),
        go(
          "dog",
          "Speak to the dog in the shade",
          "dog",
          "The dog lifts his head, wary but curious.",
        ),
      ],
    ),
    dog: S(
      "The first other voice",
      "A roadside oak",
      "The dog has run from a house that no longer wanted him. “I can still keep watch,” he says. “I simply cannot run all day.” A song could use a steady beat as much as a loud voice.",
      [
        A(
          "meal",
          "Share your bread and offer a place",
          "USE_ITEM",
          {
            remove: ["bread"],
            flags: { dog: true, meal: true },
            stats: { harmony: 2 },
          },
          "He eats slowly, then stands beside you. “I will cover the door if you need me.”",
          {
            when: item("bread"),
            visible: not(flag("dog")),
            uses: "bread",
            requires: "Loaf of bread",
          },
        ),
        A(
          "invite",
          "Invite him to join at his own pace",
          "TALK",
          { flags: { dog: true }, stats: { harmony: 1 } },
          "“My own pace?” he asks. Then he smiles.",
          { visible: not(flag("dog")) },
        ),
        go(
          "cat",
          "Continue to the orchard",
          "orchard",
          "You take the shady road, leaving room for your companion.",
          { when: flag("dog"), requires: "Invite the dog" },
        ),
      ],
    ),
    orchard: S(
      "A singer with claws",
      "The orchard wall",
      "A cat sits on the wall above a loop of loose cord. She has left a house where warmth had become conditional on catching mice. “What are you two doing?” she asks. “You walk as if it was your idea.”",
      [
        A(
          "invite",
          "Ask what song she would choose",
          "TALK",
          { flags: { cat: true }, stats: { harmony: 1 } },
          "She hums a low note. “Something with room for a solo.”",
          { visible: not(flag("cat")) },
        ),
        take(
          "cord",
          "Gather the loose baling cord",
          "cord",
          "You leave the orchard path free of the tangled cord.",
          { spot: [30, 75] },
        ),
        go(
          "rooster",
          "Follow the crowing at the next gate",
          "rooster",
          "The cat walks along the wall beside you.",
          { when: flag("cat"), requires: "Invite the cat" },
        ),
        go(
          "back",
          "Return to the roadside oak",
          "dog",
          "The oak makes a good place to gather your thoughts.",
        ),
      ],
    ),
    rooster: S(
      "One more for the road",
      "The farmyard gate",
      "A rooster announces tomorrow as if volume could guarantee it. He has heard the cook planning supper. “Come with us,” you can say. But he wants to know who decides what the group sings.",
      [
        A(
          "vote",
          "Promise every voice a turn",
          "TALK",
          { flags: { rooster: true }, stats: { harmony: 1 } },
          "He hops down, leaves the gate behind, and hands you a practice whistle.",
          {
            visible: not(flag("rooster")),
            effects: {
              flags: { rooster: true },
              give: ["whistle"],
              stats: { harmony: 1 },
            },
          },
        ),
        A(
          "rush",
          "Ask him to join first and argue later",
          "TALK",
          { flags: { rooster: true }, give: ["whistle"], stats: { alert: 1 } },
          "He joins you, but insists the argument is only postponed.",
          { visible: not(flag("rooster")) },
        ),
        go(
          "wood",
          "Take the path into the wood",
          "wood",
          "Four sets of footsteps become one uneven rhythm.",
          { when: flag("rooster"), requires: "Invite the rooster" },
        ),
      ],
    ),
    wood: S(
      "A light among the trees",
      "The wood at nightfall",
      "Bremen is too far for tonight. From a high branch, the rooster sees a light. The dog smells food, then a guard’s boots. A house in the clearing may be shelter, but someone is already using it.",
      [
        inspect(
          "tracks",
          "Read the tracks around the clearing",
          "A patrol circles clockwise: front gate, orchard, back door. The orchard is clear just after the gate.",
          {
            effects: {
              flags: { tracks: true },
              stats: { evidence: 1 },
              clues: [
                "Patrol route: gate → orchard → back door. Move after it passes the gate.",
              ],
            },
          },
        ),
        go(
          "clearing",
          "Watch the house from cover",
          "clearing",
          "You settle behind a tangle of hazel.",
        ),
        go(
          "rehearsal",
          "Rehearse before approaching",
          "rehearsal",
          "A fallen trunk makes an unlikely stage.",
        ),
        A(
          "exitLine",
          "Mark a protected escape through the orchard",
          "INSPECT",
          {
            flags: { safeExit: true },
            stats: { alert: -1 },
            clues: [
              "A sheltered orchard path lets the ensemble retreat together.",
            ],
          },
          "You mark a route behind the wall. It gives you a safer answer if the patrol returns.",
          { visible: all(theme("survival"), not(flag("safeExit"))) },
        ),
      ],
      { checkpoint: true },
    ),
    clearing: S(
      "The people inside",
      "The woodland house",
      "Through the window you see a feast and sacks marked with names from nearby farms. A thief writes in a ledger. The cat can reach the pantry. The dog can watch the gate. You can choose how this becomes your problem.",
      [
        inspect(
          "sacks",
          "Read the names on the sacks",
          "The sacks belong to people on the Bremen road. This is stolen food, not an abandoned feast.",
          {
            effects: {
              flags: { sacks: true },
              stats: { evidence: 1 },
              clues: [
                "The sacks are marked with owners’ names from the Bremen road.",
              ],
            },
            spot: [72, 65],
          },
        ),
        go(
          "pantry",
          "Send the cat to scout the pantry",
          "pantry",
          "The cat slips through a low opening.",
        ),
        go(
          "gate",
          "Plan a diversion at the gate",
          "gate",
          "The dog studies the path beyond the fence.",
        ),
        go(
          "rehearsal",
          "Prepare the four-voice entrance",
          "rehearsal",
          "You return to the fallen trunk.",
        ),
      ],
      {
        variants: [
          {
            when: theme("mystery"),
            text: "The ledger could prove what the sacks suggest. A witness would make the case stronger.",
          },
          {
            when: theme("survival"),
            text: "An orchard path leads away from the back door. Keep that exit open.",
          },
        ],
      },
    ),
    pantry: S(
      "Quiet paws, loud evidence",
      "Behind the pantry",
      "The cat returns with a route to the ledger. “I can take it,” she says, “but the floorboards will tell on me. One distraction, please.” The dog waits for your signal.",
      [
        A(
          "lure",
          "Ring the bell on a line outside",
          "USE_ITEM",
          { flags: { distracted: true }, stats: { alert: -1 } },
          "The guard follows the ringing into the trees.",
          {
            when: item("lure"),
            visible: not(flag("distracted")),
            requires: "Bell on a line",
            uses: "lure",
          },
        ),
        A(
          "bread",
          "Leave bread near the far gate",
          "USE_ITEM",
          { remove: ["bread"], flags: { distracted: true } },
          "The hungry lookout steps away to eat.",
          {
            when: item("bread"),
            visible: not(flag("distracted")),
            requires: "Loaf of bread",
            uses: "bread",
          },
        ),
        A(
          "ledger",
          "Take the ledger while the guard is away",
          "TAKE_ITEM",
          { give: ["ledger"], flags: { ledger: true }, stats: { evidence: 2 } },
          "The cat slides the book into your bag without touching a loose board.",
          {
            when: flag("distracted"),
            visible: not(flag("ledger")),
            requires: "Create a distraction",
            spot: [55, 60],
          },
        ),
        A(
          "risk",
          "Lift the ledger and risk the floorboards",
          "TAKE_ITEM",
          {
            give: ["ledger"],
            flags: { ledger: true },
            stats: { evidence: 2, alert: 2 },
          },
          "A board creaks. The ledger is yours, but someone knows the pantry is not empty.",
          { visible: not(flag("ledger")) },
        ),
        go(
          "witness",
          "Follow a whisper behind the shed",
          "witness",
          "Someone else is watching the house.",
        ),
        go(
          "back",
          "Return to the clearing",
          "clearing",
          "The cat brushes the dust from her paws.",
        ),
      ],
    ),
    witness: S(
      "Someone knows those names",
      "The woodshed",
      "A miller has followed a stolen cart here. She can identify the sacks. “I cannot walk into that room alone,” she says. “But I can carry a message if you can get everyone out.”",
      [
        A(
          "agree",
          "Share what you found and arrange a meeting",
          "TALK",
          { flags: { witness: true }, stats: { evidence: 1 } },
          "You agree to meet beyond the orchard. She will take your account seriously.",
          { visible: not(flag("witness")) },
        ),
        go(
          "back",
          "Return to your ensemble",
          "clearing",
          "The dog has kept watch while you spoke.",
        ),
        go(
          "escape",
          "Meet the miller beyond the orchard",
          "escape",
          "You choose evidence over a dramatic entrance.",
        ),
      ],
    ),
    gate: S(
      "A gap in the rounds",
      "The front gate",
      "The guard has just passed the gate. If you studied the tracks, you know the next stop. Otherwise you can spend a turn observing, use a remote bell, or accept the risk of an early entrance.",
      [
        A(
          "watch",
          "Watch one full patrol round",
          "WAIT",
          {
            flags: { patrolKnown: true },
            stats: { alert: 1 },
            clues: ["Move just after the guard leaves the front gate."],
          },
          "You learn the rhythm, but waiting gives the thieves time to finish their meal.",
          { visible: not(flag("patrolKnown")) },
        ),
        A(
          "lure",
          "Pull the bell from behind the fence",
          "USE_ITEM",
          {
            to: "window",
            flags: { quietApproach: true },
            stats: { alert: -1 },
          },
          "The guard goes the wrong way. All four of you reach the window.",
          { when: item("lure"), requires: "Bell on a line", uses: "lure" },
        ),
        A(
          "timed",
          "Move as the guard leaves the gate",
          "TRAVEL",
          { to: "window", flags: { quietApproach: true } },
          "You cross the light between two rounds.",
          {
            when: any(flag("tracks"), flag("patrolKnown")),
            requires: "Know the patrol route",
          },
        ),
        A(
          "rush",
          "Approach together and accept being seen",
          "TRAVEL",
          { to: "window", stats: { alert: 2 } },
          "The lookout shouts. You will have less time for your entrance.",
        ),
      ],
    ),
    rehearsal: S(
      "Four voices, one entrance",
      "The fallen-trunk stage",
      "Build the sound from the ground up. Your low bray is the foundation. The dog adds a beat, the cat a high phrase, and the rooster ends above everyone. Rehearse that order before you attempt it at the window.",
      [
        A(
          "ready",
          "Take the rehearsed entrance to the window",
          "SOLVE",
          { to: "window", flags: { rehearsed: true }, stats: { harmony: 1 } },
          "You know when to enter, and you know when to listen.",
        ),
        go(
          "back",
          "Return to watching the house",
          "clearing",
          "There is more than one way to solve this night.",
        ),
      ],
      {
        puzzle: {
          prompt: "Conduct the four voices",
          clue: "Build from the ground up: donkey → dog → cat → rooster.",
          options: [
            { id: "cat", label: "Cat", glyph: "♬" },
            { id: "rooster", label: "Rooster", glyph: "♯" },
            { id: "dog", label: "Dog", glyph: "♫" },
            { id: "donkey", label: "Donkey", glyph: "♩" },
          ],
          solution: ["donkey", "dog", "cat", "rooster"],
          solvedFlag: "songSolved",
          success:
            "The final note hangs between the trees. This time everyone came in together.",
          failure:
            "You collide halfway through. The cat demands another rehearsal; begin with the lowest voice.",
        },
      },
    ),
    window: S(
      "The moment before the noise",
      "At the window",
      "The thieves are arguing about the missing lookout. You can launch a rehearsed entrance, improvise a wall of sound, or back away with what you know. The dog is ready by the door.",
      [
        A(
          "song",
          "Signal the rehearsed entrance with the whistle",
          "USE_ITEM",
          { to: "hearth", flags: { houseWon: true }, stats: { alert: -1 } },
          "One small whistle. Four enormous voices. The thieves mistake the sound for something far larger and run.",
          {
            when: all(flag("rehearsed"), item("whistle")),
            uses: "whistle",
            requires: "Rehearse the entrance · reed whistle",
            spot: [50, 45],
          },
        ),
        A(
          "improvise",
          "Improvise as loudly as possible",
          "CHOOSE",
          { to: "hearth", flags: { houseWon: true }, stats: { alert: 2 } },
          "The thieves bolt, but the room is chaos and no one hears the dog’s warning.",
        ),
        go(
          "escape",
          "Withdraw toward the orchard",
          "escape",
          "A good plan can include deciding to leave.",
        ),
      ],
    ),
    hearth: S(
      "Shelter is a beginning",
      "The house hearth",
      "The room is yours for the moment. The sacks still belong to their owners. Outside, the thieves are beginning to wonder whether the terrible creature was only noise. You need a plan for their return.",
      [
        A(
          "restore",
          "Set the marked sacks aside for their owners",
          "CHOOSE",
          { flags: { restored: true }, stats: { harmony: 1 } },
          "You make room by the fire. The cat chooses the warmest stone.",
          { visible: not(flag("restored")) },
        ),
        A(
          "watch",
          "Arrange the ensemble’s watch",
          "TALK",
          { to: "lastWatch" },
          "The rooster takes the rafters. The dog settles by the door.",
        ),
        go(
          "escape",
          "Leave with the ledger before they return",
          "escape",
          "You carry the night’s evidence into the orchard.",
        ),
      ],
      { checkpoint: true },
    ),
    lastWatch: S(
      "Who holds the door?",
      "The last watch",
      "One thief has come back to test the house. The dog needs a clear signal, the cat needs space, and the rooster needs to wait for the right moment. Harmony can hold this room. Evidence can carry you out of it.",
      [
        A(
          "hold",
          "Give the signal and hold the house together",
          "CHOOSE",
          { ending: "home" },
          "Your four voices answer one another from four corners.",
          {
            when: all(stat("harmony", 4), { stat: "alert", lte: 5 }),
            requires: "Harmony 4 or more · patrol alert below 6",
          },
        ),
        go(
          "evidence",
          "Take the orchard exit with the evidence",
          "escape",
          "You choose the path you can all travel.",
        ),
        A(
          "scatter",
          "Call for everyone to escape through the trees",
          "CHOOSE",
          { ending: "road" },
          "Each musician knows the meeting place, even if the plan has fallen apart.",
        ),
      ],
    ),
    escape: S(
      "The orchard exit",
      "Beyond the back fence",
      "The road to town begins beyond the orchard. You can bring a witness and proof, or leave the house behind and keep the ensemble moving. The night has changed you; it does not have to finish you.",
      [
        A(
          "case",
          "Take the ledger and witness to town",
          "CHOOSE",
          { ending: "case" },
          "The miller meets you where she promised.",
          {
            when: all(item("ledger"), flag("witness"), theme("mystery")),
            requires: "Ledger · witness · mystery theme",
          },
        ),
        A(
          "home",
          "Return to claim the house with a united ensemble",
          "CHOOSE",
          { ending: "home" },
          "With a safe exit behind you, the choice to stay feels different.",
          {
            when: all(flag("houseWon"), stat("harmony", 4), {
              stat: "alert",
              lte: 5,
            }),
            requires: "Win the house · harmony 4 · patrol alert below 6",
          },
        ),
        A(
          "road",
          "Keep the ensemble together on the road",
          "CHOOSE",
          { ending: "road" },
          "The road is still there, and so are your companions.",
        ),
      ],
    ),
    patrol: S(
      "Boots where there should be silence",
      "Patrol encounter",
      "The lookout returns early. Your companions freeze. You need to send the boots away, hold perfectly still, or move everyone to new cover.",
      [
        A(
          "exitLine",
          "Use the sheltered orchard route",
          "TRAVEL",
          { to: "$return", stats: { alert: -2 } },
          "You guide the ensemble behind the wall and return after the lookout passes.",
          {
            when: flag("safeExit"),
            requires: "Mark the orchard escape in survival mode",
          },
        ),
        A(
          "bell",
          "Draw the lookout away with the bell on a line",
          "USE_ITEM",
          { to: "$return", stats: { alert: -2 } },
          "The sound comes from a place where none of you are.",
          { when: item("lure"), uses: "lure", requires: "Bell on a line" },
        ),
        A(
          "dog",
          "Let the dog cover your retreat",
          "TALK",
          { to: "$return", stats: { alert: -1 } },
          "The dog remembers the bread and the promise. He misleads the lookout with a bark from the far fence.",
          { when: flag("meal"), requires: "Share a meal with the dog" },
        ),
        A(
          "hide",
          "Wait silently until the boots pass",
          "WAIT",
          { to: "$return", stats: { alert: 1 } },
          "The boots pass, but the search widens.",
          { cost: 2 },
        ),
      ],
    ),
  },
  events: [
    E(
      "dogVoice",
      flag("dog"),
      "A low bark joins your footsteps. The road sounds less empty.",
    ),
    E(
      "catVoice",
      flag("cat"),
      "The cat tries a harmony without asking permission. The dog finds a place beneath it.",
    ),
    E(
      "fourVoices",
      flag("rooster"),
      "The ensemble has four voices. The next question is whether you can listen to one another.",
      { objective: "Find shelter. Decide how to handle the woodland house." },
    ),
    E(
      "night",
      { turn: 7 },
      "Night settles between the trees. A light in the wood becomes easier to see.",
    ),
    E(
      "patrol",
      all({ turn: 13 }, { visited: "clearing" }),
      "The lookout has finished a shorter round than expected.",
      {},
      { interrupt: "patrol", priority: 10 },
    ),
    E(
      "search",
      { event: "patrol" },
      "A second lantern appears at the back door. The earlier disturbance has widened the patrol.",
      { stats: { alert: 1 } },
      { delay: 2 },
    ),
    E(
      "mealRemembered",
      all(flag("meal"), { scene: "hearth" }),
      "The dog quietly takes the cold place by the door. He remembers who made room for him.",
      { stats: { harmony: 1 } },
    ),
    E(
      "ledgerMissing",
      item("ledger"),
      "A shout goes up inside. The thieves have noticed their ledger is missing.",
      {
        stats: { alert: 1 },
        objective: "Bring your evidence out, or secure the house together.",
      },
    ),
    E(
      "rehearsal",
      flag("rehearsed"),
      "The rooster lowers his voice. For the first time, the silence is part of the song.",
    ),
    E(
      "mystery",
      theme("mystery"),
      "The miller near the woodshed may recognize the names on the sacks.",
    ),
  ],
  endings: {
    home: {
      title: "A home for every voice",
      kind: "Ensemble ending",
      text: "The returning thief hears one voice at the door, another at the hearth, and two more above him. He flees. In the morning you return the sacks and invite their owners to a concert. You may still reach Bremen one day. For now, there is room around this fire.",
      reflection:
        "Listening, rehearsal, and shared care made the ensemble strong enough to hold its ground.",
    },
    case: {
      title: "The case of the midnight orchestra",
      kind: "Mystery ending",
      text: "The ledger has dates. The miller has names. You have four accounts that agree where it matters and disagree everywhere else. By noon the stolen goods are being returned. The town asks whether its new investigators also take concert bookings.",
      reflection:
        "You turned a noisy caper into a case by gathering evidence and keeping a witness safe.",
    },
    road: {
      title: "The next song",
      kind: "Open road ending",
      text: "You meet beyond the orchard as promised. The house remains behind you, with all its unfinished business. The cat says your entrance was terrible. The rooster says the ending needs work. The dog counts four shadows on the road. You have another day to practice.",
      reflection:
        "Shelter slipped away, but the ensemble survived. A failed plan did not end the journey.",
    },
  },
};

export const episodes = [wisdom, tide, orchestra];
export const episodeById = (id) => episodes.find((e) => e.id === id);
