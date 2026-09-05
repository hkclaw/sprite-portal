/**
 * Brand colors per sprite (not the generic candy gold / teal / violet set):
 *   Jacob Bot     — teal + amber
 *   English Edge  — coral + cream
 *   ChapterMind   — ink / paper + sage
 *   HomePilot     — wood tones
 *   Jazz Bot      — jazz blue
 *   VitalPilot    — forest green #2D6A4F
 */

/** @typedef {{
 *   id: string,
 *   name: string,
 *   slug: string,
 *   path: string,
 *   tagline: string,
 *   vibe: string,
 *   accent: string,
 *   brand: { primary: string, secondary: string, labels: string[] },
 *   actions: { id: string, label: string, hint: string }[]
 * }} Sprite
 */

/** Six lively sprite assistants with their own brand rooms. */
export const SPRITES = [
  {
    id: "jacob",
    name: "Jacob Bot",
    slug: "jacob",
    path: "/sprites/jacob",
    tagline: "The spark that keeps the crew in orbit.",
    vibe: "Teal conductor with amber trim — inbox triage for the whole nursery.",
    accent: "teal-amber",
    brand: {
      primary: "#148F8A",
      secondary: "#F4A259",
      labels: ["teal", "amber"],
    },
    actions: [{ id: "inbox", label: "整理", hint: "Sweep the open inbox and pin what still matters." }],
  },
  {
    id: "english-edge",
    name: "English Edge",
    slug: "english-edge",
    path: "/sprites/english-edge",
    tagline: "Sharpens sentences until they gleam.",
    vibe: "Coral quill on cream paper — classroom warmth, not candy neon.",
    accent: "coral-cream",
    brand: {
      primary: "#E07A5F",
      secondary: "#F7E8D4",
      labels: ["coral", "cream"],
    },
    actions: [{ id: "class", label: "課堂", hint: "Open today’s conversation class card." }],
  },
  {
    id: "chaptermind",
    name: "ChapterMind",
    slug: "chaptermind",
    path: "/sprites/chaptermind",
    tagline: "Keeps stories, chapters, and threads from drifting.",
    vibe: "Ink and paper, with a sage ribbon in the margin.",
    accent: "ink-sage",
    brand: {
      primary: "#1B1B18",
      secondary: "#8FAF88",
      labels: ["ink", "paper", "sage"],
    },
    actions: [{ id: "progress", label: "進度", hint: "Show chapter progress across the desk." }],
  },
  {
    id: "homepilot",
    name: "HomePilot",
    slug: "homepilot",
    path: "/sprites/homepilot",
    tagline: "Nests, chores, and the little house rhythms.",
    vibe: "Oak, walnut, and warm wood — a house sprite, not a leaf sticker.",
    accent: "wood",
    brand: {
      primary: "#8B5E3C",
      secondary: "#C9A27A",
      labels: ["wood", "oak", "walnut"],
    },
    actions: [{ id: "urgent", label: "緊急", hint: "Surface the house jobs that cannot wait." }],
  },
  {
    id: "jazz",
    name: "Jazz Bot",
    slug: "jazz",
    path: "/sprites/jazz",
    tagline: "Late-night riffs, playlists, and swing.",
    vibe: "Jazz blue nightclub light — brass in the pocket, not magenta candy.",
    accent: "jazz-blue",
    brand: {
      primary: "#1E4D8C",
      secondary: "#C9A24A",
      labels: ["jazz blue"],
    },
    actions: [{ id: "refuel", label: "入油", hint: "Log a fill-up before the night drive." }],
  },
  {
    id: "vitalpilot",
    name: "VitalPilot",
    slug: "vitalpilot",
    path: "/sprites/vitalpilot",
    tagline: "Pulse checks, habits, and gentle nudges.",
    vibe: "Forest green #2D6A4F — walks, stretch, and a Garmin snapshot.",
    accent: "forest",
    brand: {
      primary: "#2D6A4F",
      secondary: "#95D5B2",
      labels: ["forest green"],
    },
    actions: [{ id: "garmin", label: "Garmin snapshot", hint: "Pin this week’s movement snapshot." }],
  },
];

/** @param {string} idOrSlug */
export function findSprite(idOrSlug) {
  return SPRITES.find((sprite) => sprite.id === idOrSlug || sprite.slug === idOrSlug) ?? null;
}

export const SHARED_ACTIONS = [
  { id: "complete", label: "完成" },
  { id: "snooze", label: "延後" },
];
