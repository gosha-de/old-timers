// Pure game logic — no DOM, so it can be unit-tested in Node (scripts/test-engine.mjs).

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildDeck(pools, pool) {
  const src =
    pool === 'RU' ? pools.RU :
    pool === 'INT' ? pools.INT :
    [...pools.RU, ...pools.INT];
  return shuffle(src);
}

// Is it correct to insert a song of `year` at index `k` of an ascending-sorted timeline?
// Correct when inserting there keeps the timeline non-decreasing. Equal years => several
// valid slots, all accepted (fair Hitster behaviour).
export function isCorrect(timeline, year, k) {
  const leftOk = k === 0 || timeline[k - 1].year <= year;
  const rightOk = k === timeline.length || year <= timeline[k].year;
  return leftOk && rightOk;
}
