'use strict';
// Regression tests for the recovered Command Table importer.
// Usage: node tests/verify-commandtable-recovery.cjs <source-or-patched-html>
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const filename = process.argv[2] || 'android/app/src/main/assets/index.html';
const html = fs.readFileSync(filename, 'utf8');
const start = html.indexOf('function parseDecklist(raw){');
const end = html.indexOf('async function fetchScryfall(', start);
assert(start !== -1 && end > start, 'Expected Command Table import parser not found');
const parseSource = html.slice(start, end);

const known = new Set(['barrin, master wizard', 'access denied']);
const sandbox = {
  equalName: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
  hasMetadata: name => known.has(String(name).toLowerCase()),
  card: name => ({name}),
  isCommander: c => c.name.toLowerCase() === 'barrin, master wizard',
};
const parse = vm.runInNewContext(parseSource + '\nparseDecklist', sandbox);

const sample = parse(
  'About\nName Boyoyoing\n\nCommander\n1x Barrin, Master Wizard (USG) 63\n\n' +
  'Deck\n1x Access Denied (NEC) 11\nSideboard\n1x Ignore Me (XXX) 1'
);
assert.equal(sample.deckName, 'Boyoyoing');
assert.equal(sample.commander, 'Barrin, Master Wizard');
assert.equal(sample.names.length, 1);
assert.equal(sample.names[0], 'Access Denied');
assert.equal(sample.cardCount, 2);
assert.equal(sample.errors.length, 0);
assert.equal(sample.entries.length, 2);

// Tests full-size decklists without requiring Scryfall or network access.
const full = parse('About\nName 100 card import\nCommander\n1x Barrin, Master Wizard (USG) 63\nDeck\n' +
  Array.from({length:99}, (_, i) => '1x Imported Card ' + (i+1) + ' (ABC) ' + (i+1)).join('\n'));
assert.equal(full.commander, 'Barrin, Master Wizard');
assert.equal(full.names.length, 99);
assert.equal(full.cardCount, 100);
assert.equal(full.errors.length, 0);
assert.equal(full.unknown.length, 99);

// 100-card lists can also put the commander in the main section.
const flat = parse('Deck\n1x Barrin, Master Wizard (USG) 63\n' +
  Array.from({length:99}, (_, i) => '1x Card ' + (i+1)).join('\n'));
assert.equal(flat.commander, 'Barrin, Master Wizard');
assert.equal(flat.names.length, 99);

const invalid = parse('Commander\n1x Barrin, Master Wizard\nDeck\n0x Invalid Card\n1x Access Denied');
assert(invalid.errors.some(e => e.includes('invalid quantity')));
assert.equal(invalid.names.length, 1);

assert(html.includes('function importDeck()'), 'Import editor missing');
assert(html.includes('id="importCommander"'), 'Editable commander selection missing');
console.log('PASS: Barrin export, 100-card imports, commander auto-detection, sideboard filtering and invalid quantities');