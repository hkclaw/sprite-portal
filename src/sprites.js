/** @typedef {{
 *   id: string,
 *   name: string,
 *   slug: string,
 *   path: string,
 *   tagline: string,
 *   vibe: string,
 *   accent: string
 * }} Sprite
 */

/** Six lively sprite assistants. Persona copy is placeholder for V1. */
export const SPRITES = [
  {
    id: "jacob",
    name: "Jacob Bot",
    slug: "jacob",
    path: "/sprites/jacob",
    tagline: "The spark that keeps the crew in orbit.",
    vibe: "Warm gold conductor. Placeholder persona — more voice coming soon.",
    accent: "gold",
  },
  {
    id: "english-edge",
    name: "English Edge",
    slug: "english-edge",
    path: "/sprites/english-edge",
    tagline: "Sharpens sentences until they gleam.",
    vibe: "Teal wordsmith with a sly quill. Placeholder persona — more voice coming soon.",
    accent: "teal",
  },
  {
    id: "chaptermind",
    name: "ChapterMind",
    slug: "chaptermind",
    path: "/sprites/chaptermind",
    tagline: "Keeps stories, chapters, and threads from drifting.",
    vibe: "Violet page-moth. Placeholder persona — more voice coming soon.",
    accent: "violet",
  },
  {
    id: "homepilot",
    name: "HomePilot",
    slug: "homepilot",
    path: "/sprites/homepilot",
    tagline: "Nests, chores, and the little house rhythms.",
    vibe: "Leaf-green nest keeper. Placeholder persona — more voice coming soon.",
    accent: "leaf",
  },
  {
    id: "jazz",
    name: "Jazz Bot",
    slug: "jazz",
    path: "/sprites/jazz",
    tagline: "Late-night riffs, playlists, and swing.",
    vibe: "Magenta night-club sprite. Placeholder persona — more voice coming soon.",
    accent: "magenta",
  },
  {
    id: "vitalpilot",
    name: "VitalPilot",
    slug: "vitalpilot",
    path: "/sprites/vitalpilot",
    tagline: "Pulse checks, habits, and gentle nudges.",
    vibe: "Coral wellness orb. Placeholder persona — more voice coming soon.",
    accent: "coral",
  },
];

/** @param {string} idOrSlug */
export function findSprite(idOrSlug) {
  return SPRITES.find((sprite) => sprite.id === idOrSlug || sprite.slug === idOrSlug) ?? null;
}
