# Sprite Portal

Local web app for the items Jacob’s Grok bots handle. Each bot is a lively little sprite assistant — a nursery, not a spreadsheet.

Dashboard plus six branded sprite rooms, local mock desks, and mock primary actions. Each sprite keeps its own colors — Jacob teal+amber, English Edge coral+cream, ChapterMind ink/paper+sage, HomePilot wood, Jazz Bot jazz blue, VitalPilot forest `#2D6A4F`.

## Run on localhost

Bind is **127.0.0.1** only. The app listens on **port 5173**.

```bash
npm i
npm start
```

Then open [http://127.0.0.1:5173](http://127.0.0.1:5173).

- Dashboard: `/`
- Sprites: `/sprites/jacob`, `/sprites/english-edge`, `/sprites/chaptermind`, `/sprites/homepilot`, `/sprites/jazz`, `/sprites/vitalpilot`

`npm start` is Vite in the foreground. Stop it with `Ctrl+C`.

## What’s in the shell

| Surface | What you get |
| --- | --- |
| Dashboard | Open counts + hopper from local mock items |
| Six sprite routes | Brand room, sample desk, 完成／延後 plus a sprite primary action |
| Theme | Per-sprite brand colors (not a shared candy palette) |
| Data | Local JSON at `public/data/items.json` |

介面預設繁體中文、Notion 式側欄書枱；每隻精靈用自己嘅 persona 欄位，種子喺 `public/data/items.json`。

## Sprites

- **Jacob Bot** — teal + amber
- **English Edge** — coral + cream · 課堂
- **ChapterMind** — ink / paper + sage · 進度
- **HomePilot** — wood tones · 緊急
- **Jazz Bot** — jazz blue · 入油
- **VitalPilot** — forest green `#2D6A4F` · Garmin snapshot

## Notes

- Localhost only. Do not expose the server.
- Thin stack: vanilla JS + Vite. No framework.
