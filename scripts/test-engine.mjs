// Quick assertions for the pure game engine. Run: node scripts/test-engine.mjs
import { isCorrect, buildDeck, shuffle } from '../js/engine.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗', msg); } };

const tl = [{ year: 1973 }, { year: 1988 }, { year: 2000 }];

// boundaries
ok(isCorrect(tl, 1965, 0) === true,  '1965 before all (k=0)');
ok(isCorrect(tl, 1965, 1) === false, '1965 cannot go after 1973 (k=1)');
ok(isCorrect(tl, 1980, 1) === true,  '1980 between 1973 and 1988 (k=1)');
ok(isCorrect(tl, 1980, 0) === false, '1980 not before 1973 (k=0)');
ok(isCorrect(tl, 1980, 2) === false, '1980 not between 1988 and 2000 (k=2)');
ok(isCorrect(tl, 2010, 3) === true,  '2010 after all (k=3)');
ok(isCorrect(tl, 2010, 2) === false, '2010 not before 2000 (k=2)');

// ties — both adjacent slots accepted
ok(isCorrect(tl, 1988, 1) === true,  'tie 1988 accepted at k=1');
ok(isCorrect(tl, 1988, 2) === true,  'tie 1988 accepted at k=2');

// empty timeline
ok(isCorrect([], 1999, 0) === true,  'any year fits empty timeline');

// deck building
const pools = { RU: [{ id: 1 }, { id: 2 }, { id: 3 }], INT: [{ id: 4 }, { id: 5 }] };
ok(buildDeck(pools, 'RU').length === 3,   'RU deck size');
ok(buildDeck(pools, 'INT').length === 2,  'INT deck size');
ok(buildDeck(pools, 'BOTH').length === 5, 'BOTH deck size');
ok(shuffle([1, 2, 3, 4]).sort().join() === '1,2,3,4', 'shuffle preserves elements');

console.log(`\n${fail === 0 ? '✓ all' : '✗'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
