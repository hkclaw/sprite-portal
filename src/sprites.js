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
    tagline: "令成隊精靈保持軌道嘅火花。",
    vibe: "青綠指揮、琥珀滾邊——成個苗圃嘅收件箱執漏。",
    accent: "teal-amber",
    brand: {
      primary: "#148F8A",
      secondary: "#F4A259",
      labels: ["青綠", "琥珀"],
    },
    actions: [{ id: "inbox", label: "整理", hint: "執漏未完成收件箱，釘低仲要跟進嘅。" }],
  },
  {
    id: "english-edge",
    name: "English Edge",
    slug: "english-edge",
    path: "/sprites/english-edge",
    tagline: "把句子磨到發亮。",
    vibe: "珊瑚羽毛筆配奶油紙——課室暖色，唔係糖果霓虹。",
    accent: "coral-cream",
    brand: {
      primary: "#E07A5F",
      secondary: "#F7E8D4",
      labels: ["珊瑚", "奶油"],
    },
    actions: [{ id: "class", label: "課堂", hint: "打開今日會話課卡片。" }],
  },
  {
    id: "chaptermind",
    name: "ChapterMind",
    slug: "chaptermind",
    path: "/sprites/chaptermind",
    tagline: "睇實故事、章節同線索，唔好飄走。",
    vibe: "墨同紙，頁邊一條鼠尾草絲帶。",
    accent: "ink-sage",
    brand: {
      primary: "#1B1B18",
      secondary: "#8FAF88",
      labels: ["墨", "紙", "鼠尾草"],
    },
    actions: [{ id: "progress", label: "進度", hint: "顯示書枱上嘅章節進度。" }],
  },
  {
    id: "homepilot",
    name: "HomePilot",
    slug: "homepilot",
    path: "/sprites/homepilot",
    tagline: "屋企、家務、同細細日常節奏。",
    vibe: "橡木、胡桃、暖木色——屋企精靈，唔係貼紙。",
    accent: "wood",
    brand: {
      primary: "#8B5E3C",
      secondary: "#C9A27A",
      labels: ["木色", "橡木", "胡桃"],
    },
    actions: [{ id: "urgent", label: "緊急", hint: "揭出唔可以再等嘅家務。" }],
  },
  {
    id: "jazz",
    name: "Jazz Bot",
    slug: "jazz",
    path: "/sprites/jazz",
    tagline: "夜車入油，爵士藍底下記里程。",
    vibe: "爵士藍夜燈——油箱同里程，唔係洋紅糖果。",
    accent: "jazz-blue",
    brand: {
      primary: "#1E4D8C",
      secondary: "#C9A24A",
      labels: ["爵士藍"],
    },
    actions: [{ id: "refuel", label: "入油", hint: "夜車前先記入油。" }],
  },
  {
    id: "vitalpilot",
    name: "VitalPilot",
    slug: "vitalpilot",
    path: "/sprites/vitalpilot",
    tagline: "習慣、輕推一把，同 Garmin 快照。",
    vibe: "森林綠 #2D6A4F——散步、伸展、Garmin snapshot。",
    accent: "forest",
    brand: {
      primary: "#2D6A4F",
      secondary: "#95D5B2",
      labels: ["森林綠"],
    },
    actions: [{ id: "garmin", label: "Garmin snapshot", hint: "釘低今個禮拜嘅 Garmin snapshot。" }],
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
