# Sprite Portal

Local web app for the items Jacob’s Grok bots handle. Each bot is a lively little sprite assistant — a nursery, not a spreadsheet.

This is the **V1 shell**: a dashboard, six sprite rooms, a shared item schema stub, and a playful theme. Personas and real work items come later.

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
| Dashboard | Empty todo hopper + sprite overview cards |
| Six sprite routes | Placeholder persona copy and an empty desk |
| Theme | Soft motion, candy colors, CSS sprite creatures |
| Data | Local JSON at `public/data/items.json` (empty for now) |

## Shared item schema (stub)

Every future work item should look like this:

```js
{ title, status, botId, due, tags, notes }
```

See `src/schema.js` for field notes. JSON is enough for this shell; SQLite can replace the store later without changing the shape.

## Sprites

- **Jacob Bot** — crew conductor
- **English Edge** — wordsmith
- **ChapterMind** — story threads
- **HomePilot** — house rhythms
- **Jazz Bot** — late-night riffs
- **VitalPilot** — pulse checks

## Notes

- Localhost only. Do not expose the server.
- Thin stack: vanilla JS + Vite. No framework.
