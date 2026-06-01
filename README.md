# Old-Timers 🎵

A [Hitster](https://hitstergame.com/)-style music timeline game for the web. You hear a 30‑second
clip of a hidden song and guess where it fits on your timeline by release year. Single‑device,
pass‑and‑play (hot‑seat) — no accounts, no backend.

- **Russia** pool → built from a curated list of popular Russian/Soviet bands.
- **International** pool → built from the public [Hitster Canada deck](https://github.com/andygruber/songseeker-hitster-playlists).
- Audio = free 30‑second previews from the **iTunes Search API**. Year + artist baked in ahead of time.

## Run locally

```bash
npm run serve      # http://localhost:8080
```

(Open `index.html` through this server, not as a `file://` — the game fetches `data/songs.json`.)

## Re-bake the song pool

The game reads a pre-baked `data/songs.json`. To regenerate it (e.g. after editing the band list):

```bash
npm run bake       # queries iTunes, writes data/songs.json (~1–2 min)
```

- Edit the Russian bands in [`data/russian-bands.json`](data/russian-bands.json).
- Tunables (tracks per band, international sample size) are at the top of [`scripts/bake.mjs`](scripts/bake.mjs).

## Deploy to GitHub Pages

It's a pure static site — no build step.

1. Push this folder to a GitHub repo (commit `data/songs.json` too).
2. Repo **Settings → Pages → Deploy from branch → `main` / root**.
3. Done — it's live at `https://<user>.github.io/<repo>/`.

## How a round works

Each player starts with one free card on their timeline. On your turn a mystery clip plays;
tap the slot where you think it belongs (before / between / after your existing cards). Land it
in a spot that keeps the timeline in chronological order and the card stays — first to the target
card count wins. Equal years count as correct in either adjacent slot.

## Known limitations (prototype)

- **Years come from iTunes album dates**, so the odd reissue/remaster can be off. Add MusicBrainz
  enrichment to fix original recording years.
- **iTunes terms** treat previews as promotional — fine for private play, revisit before public launch.
- **"Country" = curated origin** (you list Russian bands) — not derived from any API.
- Single device only. Multi-device sync would add a small realtime layer (e.g. PartyKit) without
  changing the rest.

## Layout

```
index.html            game shell
css/styles.css        styling
js/app.js             game flow + DOM
js/engine.js          pure game logic (deck, placement rule)
data/russian-bands.json   curated input for the Russia pool
data/songs.json       baked pool the game reads
scripts/bake.mjs      builds songs.json from iTunes + Hitster
scripts/serve.mjs     local dev server
scripts/test-engine.mjs   engine unit tests (node scripts/test-engine.mjs)
```
