# Old-Timers

**About:** A [Hitster](https://hitstergame.com/)-style music timeline guessing game. You hear a
30-second clip of a hidden song and place it on your timeline by release year. Single-device,
pass-and-play (hot-seat). No accounts, no backend.

**Tech stack:** Plain static web app — vanilla HTML/CSS/JS (ES modules). No framework, no bundler,
no build step, **zero runtime dependencies**. Node (≥18, for global `fetch`) is used only for the
local bake script, dev server, and tests.
**Platform:** Any modern browser (desktop + mobile).
**Deployment:** GitHub Pages — static, served from the repo root, no build.

---

## 14 Mandatory Rules. FOLLOW THEM STRICTLY!

1. **No changes without explicit approval.** Always propose changes first and wait for confirmation before modifying any code. Exception: small, unambiguous tasks (e.g., "fix this typo") where the intent and scope are obvious may be done directly.

2. **Think beyond the scope of the change.** Don't fix symptoms — fix the root cause. Before proposing any modification, consider how it aligns with the project's architecture and patterns, what other parts of the project it may affect, and whether the change addresses the underlying problem or just papers over it.

3. **Follow architecture.** This is a plain static site: vanilla HTML/CSS/JS ES modules, no framework, no bundler, no build step, no runtime dependencies, deployed as-is to GitHub Pages. Do NOT introduce frameworks, build tooling, or npm runtime deps. New code goes into the existing files in their existing roles (see *Modules & Files*): pure game rules in `js/engine.js`, DOM + flow in `js/app.js`, offline data prep in `scripts/`.

4. **Strict separation between data, game logic, and UI.** The bake step (`scripts/bake.mjs`) produces ONE final, ready-to-play data file (`data/songs.json`) — all metadata work (resolve year, country, preview URL, dedup, filter) happens there, offline. The **runtime makes ZERO music-API calls**: the game only reads the pre-baked pool and shuffles/filters/renders it. Pure game rules (deck, placement, scoring) live in `js/engine.js` with **no DOM access** so they stay unit-testable; `js/app.js` only wires DOM + flow. Never push metadata fetching or year/country logic into the runtime, and never put DOM code into `engine.js`.

5. **Check for duplicates.** Before adding ANY new function, helper, or module, ALWAYS search for existing implementations first. If similar code exists, modify it instead of adding duplicates.

6. **Follow existing patterns.** Before writing new code, search for similar patterns in the codebase. Match existing conventions for naming, structure, and style. Do NOT introduce your preferred style — match what's already there.

7. **Check what the API provides first.** Before building workarounds, fallbacks, or generating synthetic data, always verify what the API already offers. Fetch a real response, inspect the fields, look for undocumented endpoints. This is how the music source was chosen (see *Music data sources*) — confirm before reinventing.

8. **Don't push or create PRs without asking first.** Always get explicit approval before pushing to remote or creating pull requests. (Not yet a git repo — `git init` is itself a change to confirm first.)

9. **Never use destructive git commands to undo own edits.** Never use `git checkout`, `git restore`, or `git reset` to undo your own edits — these can destroy uncommitted work. Use targeted Edit reverts instead.

10. **No AI attributions in commits.** NEVER add Claude, AI, or code-generation attribution in git commit messages.

11. **Do not install packages without explicit approval.** The project intentionally has zero dependencies — keep it that way unless a new dependency is approved, and verify any candidate is safe and widely used first.

12. **Test against real data, never fabricated.** Pure game logic has unit tests in `scripts/test-engine.mjs` — keep `engine.js` DOM-free and add cases when changing the placement/scoring rules (`npm test`-equivalent: `node scripts/test-engine.mjs`). The bake parsers (iTunes JSON, Hitster CSV) must be validated against a **real** captured response / the live source — never against made-up fixtures.

13. **Respond to the user in a very simple and short manner.** Do not add too many technical details unless the user asks about it.

14. **Do not write to memory without explicit approval.** Never create or update entries under the auto-memory directory or `MEMORY.md` unilaterally. Either the user initiates, or you propose a write and wait for confirmation. Apply one-off feedback in the current conversation; if something seems worth persisting, propose it and let the user decide.

---

## Documentation

- [README.md](README.md) — what it is, how to run locally, how to re-bake the pool, how to deploy to GitHub Pages.

---

## Modules & Files

```
index.html                game shell — setup / game / reveal / game-over screens
css/styles.css            all styling (dark theme; fixed-height app frame)
js/app.js                 game flow + DOM wiring (screens, audio, render, turns)
js/engine.js              PURE game logic — shuffle, buildDeck, isCorrect (no DOM)
js/i18n.js                EN/RU translations + language state (data-i18n + t())
data/russian-bands.json   curated input: the band list for the Russia pool
data/songs.json           the baked pool the game reads at runtime (committed)
scripts/bake.mjs          builds songs.json (the only thing that calls music APIs)
scripts/serve.mjs         local static dev server (prod needs none)
scripts/test-engine.mjs   unit tests for js/engine.js
```

**Runtime (browser):** `app.js` fetches `data/songs.json`, builds a shuffled deck from the chosen
pool(s) via `engine.buildDeck`, and runs the hot-seat loop. Placement correctness is decided by the
single pure function `engine.isCorrect`. Audio is played straight from Apple's CDN via a plain
`<audio>` element; the clip's title/artist/year stay hidden until reveal.

**Offline (Node):** `bake.mjs` is run by hand to (re)generate `data/songs.json`. Editing the band
list or tunables (`RU_TRACKS_PER_BAND`, `INT_SAMPLE`, `DELAY_MS`) and re-running is the whole
workflow. It is the **only** place that talks to a music API.

---

## Data architecture

**The metadata/audio layer is decoupled from playback and from the game.** Everything that needs a
network or could be slow/flaky happens once, offline, at bake time and is frozen into a static
`songs.json`. At play time there are no API calls, no rate limits, no auth — just a JSON read. This
is what lets the whole game host on GitHub Pages with no backend.

### Bake pipeline (`scripts/bake.mjs`)

Output: `{ generatedAt, counts, pools: { RU: [...], INT: [...] } }`, each song
`{ title, artist, year, country, previewUrl, artwork }`.

- **Russia pool (`RU`)** — for each band in `data/russian-bands.json`: iTunes Search (RU storefront,
  `attribute=artistTerm`) → take its tracks → dedup by normalized title → keep the first
  `RU_TRACKS_PER_BAND` that have a `previewUrl`. `country` is `"RU"` by curation (we *chose* these
  bands), not derived from any API. Year = iTunes `releaseDate`.
- **International pool (`INT`)** — download the public Hitster Canada deck CSV (gives `Artist`,
  `Title`, `Year`, already curated + recognizable) → evenly sample `INT_SAMPLE` across eras → match
  each to iTunes (US storefront) for a `previewUrl`. **Year is trusted from the Hitster CSV**, not
  iTunes (the CSV's curated year beats iTunes' album/reissue date). Songs with no preview are dropped.
- iTunes is rate-limited (~20 req/min); the script paces calls (`DELAY_MS`) and backs off on HTTP 429.

### Game model (`js/engine.js` + `js/app.js`)

- A **deck** is the chosen pool(s) shuffled. Each player starts with one free, revealed starter card.
- Each player keeps a **timeline** sorted ascending by year.
- On a turn the mystery clip plays; the player taps a slot (insertion index `k`). `isCorrect` accepts
  the placement iff inserting there keeps the timeline non-decreasing
  (`tl[k-1].year <= year <= tl[k].year`, with open ends). **Equal years → either adjacent slot is
  accepted** (fair Hitster behavior). Correct → card stays; wrong → discarded.
- First player to the target card count wins; if the deck empties, most cards wins.
- All players' timelines render at once; only the current player's slots are enabled, the rest are
  dimmed/disabled. The game screen is a fixed-height frame: centered title + exit on top, scrolling
  boards in the middle, the play bar pinned to the bottom.

### Known data caveats (prototype)

- **Years for the RU pool come from iTunes album dates**, so a reissue/remaster can be off by years.
  Fixing this means enriching with MusicBrainz (accurate original recording year) — not yet wired.
- **"Country" is curated, not derived.** RU = "we listed these bands"; INT = "in the Hitster deck."
  No API gives reliable artist origin (see below).
- iTunes terms treat previews as *promotional* — fine for private play, revisit before public launch.

---

## Music data sources (researched — Rule 7)

Why iTunes, and what was ruled out. Confirm against these before changing the audio/metadata path.

| Source | Role here | Key facts |
|---|---|---|
| **iTunes Search API** | Audio (30s preview) + year, at bake time | Free, no key. `country` = **storefront, not artist origin**. No popularity ranking, no charts endpoint (search needs a term). No CORS → needs JSONP if ever called from the browser. ~20 req/min. |
| **Hitster CA deck CSV** | International song list | Public, curated, recognizable, has accurate `Year`. No country/origin field. |
| **MusicBrainz** | (optional) accurate years + artist origin | Free, CORS-ok. Has artist `area` (origin) and original release dates — but **no popularity** data. Not yet used. |
| **Last.fm `artist.getTopTracks`** | (deferred) popularity ranking per artist | Free key. Would pick an artist's actual hits; ranking is global (Western-skewed for RU). |
| **Spotify** | rejected | Web Playback SDK plays full tracks but **requires Premium** and **Premium isn't available in Russia**; `preview_url` removed for new apps (Nov 2024); catalog API heavily cut (Feb 2026). |
| **Yandex Music** | rejected for runtime | No official API; unofficial/reverse-engineered, token = real account, against ToS. Best RU catalog — only consider for a one-time bake, never at runtime. |

**Scaling later (unchanged core):** more countries = one curated artist list per country (same RU
pattern); better RU "hits" = add Last.fm ranking in the bake; multi-device = add a realtime room
layer (e.g. PartyKit/Cloudflare) — the engine and data stay as-is.
