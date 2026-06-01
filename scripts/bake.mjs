// Bake script — produces data/songs.json (the curated song pool the game reads).
// Runs LOCALLY (not on GitHub Pages). Re-run with: npm run bake
//
//   Russia        : curated band list (data/russian-bands.json) -> iTunes RU -> popular tracks
//   International : Hitster Canada deck (Artist/Title/Year) -> iTunes US -> matched preview
//
// iTunes Search API: free, no key. We add a polite delay to respect its ~20 req/min guidance.

import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---- config -------------------------------------------------------------
const DELAY_MS = 600;            // pause between iTunes calls (iTunes ~20 req/min)
const RU_TRACKS_PER_BAND = 8;    // popular tracks to keep per Russian band
const INT_SAMPLE = 140;          // how many international songs to sample from the deck
const HITSTER_CSV =
  'https://raw.githubusercontent.com/andygruber/songseeker-hitster-playlists/main/hitster-ca-aaad0001.csv';

// ---- helpers ------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function itunes(path, attempt = 0) {
  const res = await fetch('https://itunes.apple.com' + path, {
    headers: { 'User-Agent': 'OldTimers-bake/0.1 (prototype)' },
  });
  if (res.status === 429 && attempt < 5) {
    const wait = (parseInt(res.headers.get('retry-after'), 10) || 8) * 1000 * (attempt + 1);
    console.log(`    rate-limited, backing off ${wait / 1000}s…`);
    await sleep(wait);
    return itunes(path, attempt + 1);
  }
  await sleep(DELAY_MS);
  if (!res.ok) throw new Error(`iTunes HTTP ${res.status}`);
  return res.json();
}

const yearOf = (d) => {
  const y = parseInt(String(d ?? '').slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
};

// normalise a title so "Кукушка", "Кукушка (Live)" and "Кукушка - Remaster" dedupe together
const titleKey = (t) =>
  String(t).toLowerCase().replace(/\(.*?\)|\[.*?\]|[-–].*$/g, '').replace(/\s+/g, ' ').trim();

function song({ title, artist, year, country, previewUrl, artwork }) {
  return { title, artist, year, country, previewUrl, artwork: artwork ?? null };
}

// minimal CSV parser (handles quoted fields with commas)
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---- Russia: bands -> popular tracks -----------------------------------
const normName = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

// A band given by NAME: resolve to one artistId, keep each title's earliest release
// (year comes from iTunes). Reliable because artistId is unique.
async function bakeBandByName(band) {
  const found = await itunes(
    `/search?term=${encodeURIComponent(band)}&entity=musicArtist&limit=10&country=RU`,
  );
  const artist =
    (found.results ?? []).find((r) => normName(r.artistName) === normName(band)) ??
    found.results?.[0];
  if (!artist?.artistId) { console.warn(`  RU  ${band}: no artist match`); return []; }

  const data = await itunes(`/lookup?id=${artist.artistId}&entity=song&limit=200&country=RU`);
  const byTitle = new Map(); // titleKey -> { entry, order } ; order preserves popularity rank
  let order = 0;
  for (const t of data.results ?? []) {
    if (t.wrapperType !== 'track' || t.kind !== 'song' || !t.previewUrl) continue;
    const key = titleKey(t.trackName);
    if (!key) continue;
    const cur = byTitle.get(key);
    if (!cur) byTitle.set(key, { entry: t, order: order++ });
    else if (t.releaseDate && (!cur.entry.releaseDate || t.releaseDate < cur.entry.releaseDate)) cur.entry = t;
  }
  const picks = [...byTitle.values()].sort((a, b) => a.order - b.order).slice(0, RU_TRACKS_PER_BAND);
  console.log(`  RU  ${band.padEnd(22)} -> ${artist.artistName} (${picks.length})`);
  return picks.map(({ entry }) => song({
    title: entry.trackName,
    artist: artist.artistName,  // canonical name for this exact artistId
    year: yearOf(entry.releaseDate),
    country: 'RU',
    previewUrl: entry.previewUrl,
    artwork: entry.artworkUrl100,
  }));
}

// A CURATED artist: we supply the original years; iTunes provides only the audio.
// Use when iTunes has only mis-dated remasters (e.g. Высоцкий). Same idea as the INT pool.
async function bakeCuratedArtist({ artist, tracks }) {
  const out = [];
  for (const { title, year } of tracks) {
    try {
      const data = await itunes(
        `/search?term=${encodeURIComponent(`${artist} ${title}`)}&entity=song&limit=5&country=RU`,
      );
      const hits = (data.results ?? []).filter((r) => r.kind === 'song' && r.previewUrl);
      const t = hits.find((r) => normName(r.artistName).includes(normName(artist))) ?? hits[0];
      if (!t) { console.warn(`  RU  ${artist} – ${title}: no preview`); continue; }
      out.push(song({ title, artist, year, country: 'RU', previewUrl: t.previewUrl, artwork: t.artworkUrl100 }));
    } catch (e) {
      console.warn(`  RU  ${artist} – ${title}: ${e.message}`);
    }
  }
  console.log(`  RU  ${artist.padEnd(22)} -> curated (${out.length}/${tracks.length})`);
  return out;
}

async function bakeRussia() {
  const { bands } = JSON.parse(await readFile(join(ROOT, 'data/russian-bands.json'), 'utf8'));
  const out = [];
  for (const entry of bands) {
    try {
      const tracks = typeof entry === 'string'
        ? await bakeBandByName(entry)         // auto: iTunes picks songs + years
        : await bakeCuratedArtist(entry);     // curated: our years, iTunes audio
      out.push(...tracks);
    } catch (e) {
      console.warn(`  RU  ${typeof entry === 'string' ? entry : entry.artist}: ${e.message}`);
    }
  }
  return out.filter((s) => s.year);
}

// ---- International: Hitster deck -> iTunes preview ----------------------
async function bakeInternational() {
  const text = await (await fetch(HITSTER_CSV)).text();
  const rows = parseCSV(text);
  const header = rows.shift().map((h) => h.trim());
  const col = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const ai = col('Artist'), ti = col('Title'), yi = col('Year');

  const all = rows
    .filter((r) => r[ai] && r[ti] && r[yi])
    .map((r) => ({ artist: r[ai].trim(), title: r[ti].trim(), year: yearOf(r[yi]) }))
    .filter((r) => r.year);

  // even sample across the deck so we get a spread of eras, not just the first cards
  const step = Math.max(1, Math.floor(all.length / INT_SAMPLE));
  const sample = all.filter((_, i) => i % step === 0).slice(0, INT_SAMPLE);
  console.log(`  INT deck has ${all.length} songs; sampling ${sample.length}`);

  const out = [];
  for (const s of sample) {
    try {
      const data = await itunes(
        `/search?term=${encodeURIComponent(`${s.artist} ${s.title}`)}` +
        `&entity=song&limit=1&country=US`,
      );
      const t = data.results?.[0];
      if (!t?.previewUrl) { console.warn(`  INT  no preview: ${s.artist} – ${s.title}`); continue; }
      out.push(song({
        title: s.title,
        artist: s.artist,
        year: s.year,                 // trust the Hitster-curated year over iTunes album date
        country: 'INT',
        previewUrl: t.previewUrl,
        artwork: t.artworkUrl100,
      }));
    } catch (e) {
      console.warn(`  INT  ${s.artist} – ${s.title}: ${e.message}`);
    }
  }
  return out;
}

// ---- main ---------------------------------------------------------------
console.log('Baking Russian pool…');
const RU = await bakeRussia();
console.log('Baking International pool…');
const INT = await bakeInternational();

const payload = {
  generatedAt: new Date().toISOString(),
  counts: { RU: RU.length, INT: INT.length },
  pools: { RU, INT },
};

await writeFile(join(ROOT, 'data/songs.json'), JSON.stringify(payload, null, 2));
console.log(`\nDone. RU=${RU.length}  INT=${INT.length}  ->  data/songs.json`);
